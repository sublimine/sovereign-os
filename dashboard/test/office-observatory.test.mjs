import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';

import {publicOfficeObservatoryProjection, renderOfficeObservatory} from '../public/office-observatory.js';

const operationsSchema = 'sublimine.operations-room-projection.v1';

function publicOperationsInput(overrides = {}) {
  return {
    schema: operationsSchema,
    project: {id: 'project:observatory', name: 'Sublimine · Laboratorio', runtime: 'RUNNING'},
    missions: [{id: 'mission:alpha', lifecycle: 'RUNNING', selected: true}],
    selected: {
      id: 'mission:alpha',
      lifecycle: 'RUNNING',
      nodes: [
        {id: 'research', title: 'Título público que el observatorio no lee', state: 'COMPLETED', roles: ['researcher']},
        {id: 'review', title: 'Otro título que el observatorio no lee', state: 'RUNNING', roles: ['reviewer', 'quality']},
      ],
    },
    ...overrides,
  };
}

test('office projection maps only declared public roles to desk cells', () => {
  const sentinel = 'PRIVATE_OFFICE_SENTINEL_DO_NOT_PROJECT';
  const projection = publicOfficeObservatoryProjection(publicOperationsInput({
    project: {
      id: 'project:observatory', name: 'Sublimine · Laboratorio', runtime: 'RUNNING',
      credentials: sentinel,
    },
    missions: [{
      id: 'mission:alpha', lifecycle: 'RUNNING', selected: true,
      title: sentinel, originalIntent: sentinel, privatePrompt: sentinel,
    }],
    selected: {
      id: 'mission:alpha', lifecycle: 'RUNNING', privateChainOfThought: sentinel,
      nodes: [
        {id: 'research', title: sentinel, state: 'COMPLETED', roles: ['researcher'], sourceUrl: 'https://private.invalid/'},
        {id: 'review', title: sentinel, state: 'RUNNING', roles: ['reviewer', 'quality'], artifactBody: sentinel},
      ],
      sources: [{url: 'https://private.invalid/', body: sentinel}],
    },
    rawProviderPayload: sentinel,
  }));

  assert.deepEqual(projection, {
    schema: 'sublimine.office-observatory-projection.v1',
    integrity: 'VERIFIED',
    project: {name: 'Sublimine · Laboratorio', runtime: 'RUNNING'},
    missionSummary: {published: 1, active: 1, terminal: 0},
    selectedMission: {lifecycle: 'RUNNING', ordinal: 1, publishedNodes: 2},
    desks: [
      {desk: 1, role: 'researcher', node: 1, nodeState: 'COMPLETED'},
      {desk: 2, role: 'reviewer', node: 2, nodeState: 'RUNNING'},
      {desk: 3, role: 'quality', node: 2, nodeState: 'RUNNING'},
    ],
    receipt: {
      state: 'PUBLIC_ROLE_RECEIPTS_AVAILABLE',
      detail: 'Cada mesa corresponde a un rol declarado por un nodo público; no infiere agentes ni trabajo adicional.',
    },
  });
  assert.equal(Object.isFrozen(projection), true);
  assert.equal(Object.isFrozen(projection.desks), true);
  assert.throws(() => projection.desks.push({desk: 4}));
  assert.doesNotMatch(JSON.stringify(projection), new RegExp(sentinel));
  assert.doesNotMatch(JSON.stringify(projection), /private\.invalid|Título público/);
});

test('office projection fails closed when it is not an Operations Room projection', () => {
  const projection = publicOfficeObservatoryProjection({
    schema: 'future.untrusted.schema',
    project: {name: 'PRIVATE_SCHEMA_SENTINEL'},
    selected: {privateChainOfThought: 'PRIVATE_SCHEMA_SENTINEL'},
  });
  assert.equal(projection.integrity, 'UNVERIFIED');
  assert.deepEqual(projection.desks, []);
  assert.equal(projection.receipt.state, 'NO_PUBLIC_ROLE_RECEIPT');
  assert.doesNotMatch(JSON.stringify(projection), /PRIVATE_SCHEMA_SENTINEL/);
});

test('office projection explicitly reports no role receipt when no mission is selected', () => {
  const projection = publicOfficeObservatoryProjection(publicOperationsInput({
    missions: [{id: 'mission:alpha', lifecycle: 'COMPLETED', selected: false}],
    selected: null,
  }));
  assert.equal(projection.integrity, 'ABSENT');
  assert.equal(projection.selectedMission, null);
  assert.deepEqual(projection.desks, []);
  assert.deepEqual(projection.receipt, {
    state: 'NO_PUBLIC_ROLE_RECEIPT',
    detail: 'No hay una misión pública seleccionada.',
  });
});

test('office projection reports no desk rather than inventing a role for nodes without public roles', () => {
  const projection = publicOfficeObservatoryProjection(publicOperationsInput({
    selected: {
      id: 'mission:alpha', lifecycle: 'COMPLETED',
      nodes: [{id: 'sealed-delivery', state: 'COMPLETED', roles: [], rawSource: 'https://private.invalid/never'}],
    },
  }));
  assert.equal(projection.integrity, 'VERIFIED');
  assert.deepEqual(projection.selectedMission, {lifecycle: 'COMPLETED', ordinal: 1, publishedNodes: 1});
  assert.deepEqual(projection.desks, []);
  assert.equal(projection.receipt.state, 'NO_PUBLIC_ROLE_RECEIPT');
  assert.match(projection.receipt.detail, /ninguno declaró un rol público/i);
  assert.doesNotMatch(JSON.stringify(projection), /private\.invalid/);
});

test('office projection fails closed for malformed node receipts, unsafe labels, and duplicate nodes', () => {
  const malformedCases = [
    [{id: 'node:one', state: 'RUNNING', roles: ['reviewer', 'reviewer']}],
    [{id: 'node:one', state: 'RUNNING', roles: ['https://private.invalid/role']}],
    [{id: 'node one', state: 'RUNNING', roles: ['reviewer']}],
    [
      {id: 'node:one', state: 'RUNNING', roles: ['reviewer']},
      {id: 'node:one', state: 'PENDING', roles: ['researcher']},
    ],
    [{id: 'node:one', state: 'UNKNOWN_FUTURE_STATE', roles: ['reviewer']}],
  ];
  for (const nodes of malformedCases) {
    const projection = publicOfficeObservatoryProjection(publicOperationsInput({
      selected: {id: 'mission:alpha', lifecycle: 'RUNNING', nodes},
    }));
    assert.equal(projection.integrity, 'UNVERIFIED');
    assert.deepEqual(projection.desks, []);
    assert.equal(projection.receipt.state, 'NO_PUBLIC_ROLE_RECEIPT');
    assert.doesNotMatch(JSON.stringify(projection), /private\.invalid|UNKNOWN_FUTURE_STATE/);
  }
});

test('office projection rejects ambiguous mission selection rather than assigning a desk to the wrong mission', () => {
  const projection = publicOfficeObservatoryProjection(publicOperationsInput({
    missions: [
      {id: 'mission:alpha', lifecycle: 'RUNNING', selected: true},
      {id: 'mission:beta', lifecycle: 'PENDING', selected: true},
    ],
    selected: {
      id: 'mission:alpha', lifecycle: 'RUNNING',
      nodes: [{id: 'review', state: 'RUNNING', roles: ['reviewer']}],
    },
  }));
  assert.equal(projection.integrity, 'UNVERIFIED');
  assert.deepEqual(projection.desks, []);
});

test('office projection permits an unmatched selected mission only when no published mission claims selection', () => {
  const projection = publicOfficeObservatoryProjection(publicOperationsInput({
    missions: [],
    selected: {
      id: 'mission:historical-receipt', lifecycle: 'COMPLETED',
      nodes: [{id: 'sealed', state: 'ACCEPTED', roles: ['reviewer']}],
      sourcedRoute: {url: 'https://must-not-render.invalid/'},
    },
  }));
  assert.equal(projection.integrity, 'VERIFIED');
  assert.deepEqual(projection.selectedMission, {lifecycle: 'COMPLETED', ordinal: null, publishedNodes: 1});
  assert.deepEqual(projection.desks, [{desk: 1, role: 'reviewer', node: 1, nodeState: 'ACCEPTED'}]);
  assert.doesNotMatch(JSON.stringify(projection), /must-not-render/);
});

function fakeElement(tagName) {
  return {
    tagName: tagName.toUpperCase(),
    className: '',
    textContent: '',
    attributes: {},
    children: [],
    append(...children) { this.children.push(...children); },
    setAttribute(name, value) { this.attributes[name] = value; },
  };
}

function renderedText(node) {
  return [node.textContent, ...node.children.flatMap(renderedText)].filter(Boolean).join(' ');
}

test('office renderer is semantic and cannot render hidden report content', () => {
  const priorDocument = globalThis.document;
  globalThis.document = {createElement: fakeElement};
  try {
    const sentinel = 'PRIVATE_RENDER_SENTINEL';
    const root = renderOfficeObservatory(publicOperationsInput({
      selected: {
        id: 'mission:alpha', lifecycle: 'RUNNING', privateReasoning: sentinel,
        nodes: [{id: 'review', title: sentinel, state: 'RUNNING', roles: ['reviewer'], rawArtifact: sentinel}],
      },
    }));
    const output = renderedText(root);
    assert.equal(root.tagName, 'SECTION');
    assert.equal(root.className, 'office-observatory');
    assert.equal(root.attributes['aria-label'], 'Observatorio de roles publicados');
    assert.equal(root.attributes['data-office-integrity'], 'VERIFIED');
    assert.match(output, /MESA 01/);
    assert.match(output, /reviewer/);
    assert.match(output, /Vista de recibos públicos/);
    assert.doesNotMatch(output, new RegExp(sentinel));
  } finally {
    globalThis.document = priorDocument;
  }
});

test('office module has no network, scheduling, animation, or external dependency path', async () => {
  const source = await readFile(new URL('../public/office-observatory.js', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /^\s*import\s/m);
  assert.doesNotMatch(source, /\b(?:fetch|setTimeout|setInterval|requestAnimationFrame)\s*\(/u);
  assert.doesNotMatch(source, /https?:\/\//u);
});
