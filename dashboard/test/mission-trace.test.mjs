import assert from 'node:assert/strict';
import test from 'node:test';

import {publicMissionTrace, renderOperationalTrace} from '../public/mission-trace.js';

// The trace renderer is intentionally DOM-only. Keep its contract test free of
// browser packages so it can run in the same isolated Node test environment as
// the console tests.
class TestElement {
  constructor(tagName) {
    this.tagName = tagName;
    this.children = [];
    this.className = '';
    this.dataset = {};
    this.attributes = new Map();
    this._text = '';
  }

  set textContent(value) {
    this._text = String(value ?? '');
  }

  get textContent() {
    return this._text + this.children.map(child => String(child?.textContent ?? child ?? '')).join('');
  }

  setAttribute(name, value) {
    this.attributes.set(name, String(value));
  }

  append(...items) {
    this.children.push(...items.filter(item => item !== null && item !== undefined));
  }
}

function traceText(input) {
  const previousDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
  Object.defineProperty(globalThis, 'document', {
    configurable: true,
    writable: true,
    value: {createElement: tagName => new TestElement(tagName)},
  });
  try {
    return renderOperationalTrace(input).textContent;
  } finally {
    if (previousDocument) Object.defineProperty(globalThis, 'document', previousDocument);
    else delete globalThis.document;
  }
}

const publicSourcedBinding = {
  schema: 'sublimine.project-route-binding.v1',
  kind: 'project-public-sourced-v1',
  factoryEntryMode: 'sourced-response-v1',
  privateContext: 'WITHHELD_NOT_SAMPLED',
  assets: 'FORBIDDEN',
  fallback: 'EXPLICIT_NEW_PLANNED_ADMISSION_REQUIRED',
};

function sourcedRouteProgress({
  integrity = 'VERIFIED',
  phase = 'ACQUIRING',
  searchUsed = 0,
  searchLimit = 1,
  fetchUsed = 0,
  fetchLimit = 2,
  discovery = null,
  reviewState = 'NOT_STARTED',
  anchors = 0,
  availability = 'NOT_AVAILABLE',
} = {}) {
  return {
    schema: 'sovereign.sourced-route-progress.v1',
    revision: 1,
    integrity,
    phase,
    acquisition: {
      search: {used: searchUsed, limit: searchLimit},
      fetch: {used: fetchUsed, limit: fetchLimit},
      maxSourceBytes: 65_536,
      ...(discovery === null ? {} : {discovery}),
    },
    independentReview: {required: true, state: reviewState},
    verifiedSourceAnchorCount: anchors,
    delivery: {availability},
  };
}

const signedTraceMissionId = 'mission:trace-visible';
const signedTraceAt = '2026-09-21T05:00:00.000Z';

function signedEntry(revision, kind, fields = {}) {
  return {
    revision,
    at: signedTraceAt,
    receiptHash: (revision % 16).toString(16).repeat(64),
    event: {
      schema: 'sovereign.public-engine-event.v1',
      kind,
      seq: revision,
      at: signedTraceAt,
      missionId: signedTraceMissionId,
      ...fields,
    },
  };
}

function signedTrace(entries, overrides = {}) {
  return {
    schema: 'sublimine.public-mission-trace.v1',
    revision: 1,
    integrity: 'VERIFIED',
    coverage: 'FROM_ADMISSION',
    entries,
    scope: 'Static trace boundary only; this text must never be rendered as an event payload.',
    ...overrides,
  };
}

test('public sourced admission explains the sealed public route without echoing hidden projection fields', () => {
  const output = traceText({
    data: {},
    mission: {status: 'NEW', history: []},
    plan: {},
    nodes: [],
    mapping: {
      missionId: 'mission:private-mission-id',
      projectId: 'project:private-project-id',
      admission: {
        state: 'ACCEPTED',
        id: 'admission:private-admission-id',
        assetCount: 83,
        contextPackHash: 'private-context-hash',
        routeBinding: {...publicSourcedBinding, internalPrompt: 'private prompt must never render'},
      },
    },
  });

  assert.match(output, /Entrada pública acotada/);
  assert.match(output, /respuesta pública con fuentes \(sourced-response-v1\)/);
  assert.match(output, /Contexto privado: WITHHELD_NOT_SAMPLED/);
  assert.match(output, /Adjuntos: FORBIDDEN/);
  assert.match(output, /Mandato: sólo el texto público exacto enviado por la persona operadora/);
  assert.match(output, /nueva admisión planificada explícita/);
  assert.match(output, /no escala contexto privado en silencio/);
  assert.doesNotMatch(output, /private-mission-id|private-project-id|private-admission-id|private-context-hash|private prompt|83/);
});

test('legacy planned admissions keep their established public admission summary', () => {
  const output = traceText({
    data: {},
    mission: {status: 'NEW', history: []},
    plan: {},
    nodes: [],
    mapping: {
      missionId: 'mission:public-id',
      admission: {
        state: 'ACCEPTED',
        id: 'admission:public-id',
        assetCount: 2,
        contextPackHash: 'abcdef0123456789fedcba',
      },
    },
  });

  assert.match(output, /Entrada de la misión/);
  assert.match(output, /Admisión: admission:public-id/);
  assert.match(output, /Adjuntos sellados: 2/);
  assert.match(output, /Contexto sellado: abcdef0123456789…/);
  assert.doesNotMatch(output, /WITHHELD_NOT_SAMPLED|Entrada pública acotada/);
});

test('an unrecognised route binding suppresses admission metadata instead of rendering it as legacy data', () => {
  const output = traceText({
    data: {},
    mission: {status: 'NEW', history: []},
    plan: {},
    nodes: [],
    mapping: {
      missionId: 'mission:private-mission-id',
      admission: {
        state: 'ACCEPTED',
        id: 'admission:private-admission-id',
        assetCount: 19,
        contextPackHash: 'private-context-hash',
        routeBinding: {kind: 'project-public-sourced-v1'},
      },
    },
  });

  assert.match(output, /Ruta de admisión no verificable/);
  assert.match(output, /no muestra contexto, adjuntos ni identificadores de admisión/);
  assert.doesNotMatch(output, /private-mission-id|private-admission-id|private-context-hash|19|WITHHELD_NOT_SAMPLED/);
});

test('a verified sourced-route receipt renders only the bounded public operational fields', () => {
  const progress = {
    ...sourcedRouteProgress({
      phase: 'ACQUIRING',
      searchUsed: 1,
      fetchUsed: 1,
      reviewState: 'PENDING',
      anchors: 1,
    }),
    prompt: 'hidden prompt must never render',
    rawSource: 'https://private.example/source-body',
    providerDiagnostic: 'hidden provider diagnostic',
  };
  const output = traceText({
    data: {},
    mission: {status: 'RUNNING', history: [], sourcedRouteProgress: progress},
    plan: {},
    nodes: [],
    report: {
      sources: [{url: 'https://private.example/another-source', body: 'raw source body'}],
      mission: {sourcedRouteProgress: progress},
    },
    mapping: {missionId: 'mission:public', admission: {routeBinding: publicSourcedBinding}},
  });

  assert.match(output, /Ejecución pública acotada/);
  assert.match(output, /Fase publicada: ACQUIRING/);
  assert.match(output, /Búsqueda acotada: 1 \/ 1/);
  assert.match(output, /Obtenciones completas: 1 \/ 2/);
  assert.match(output, /Anclas de fuentes verificadas: 1/);
  assert.match(output, /Revisión independiente requerida: sí · PENDING/);
  assert.match(output, /Entrega final: NOT_AVAILABLE/);
  assert.match(output, /No aplica a esta ruta acotada/);
  assert.doesNotMatch(output, /hidden prompt|private\.example|raw source body|hidden provider diagnostic/);
  assert.doesNotMatch(output, /aún no ha proyectado una topología/);
});

test('the current four-fetch sourced acquisition envelope remains public and bounded', () => {
  const progress = {
    ...sourcedRouteProgress({
      phase: 'ACQUIRING',
      searchUsed: 1,
      fetchUsed: 3,
      fetchLimit: 4,
      reviewState: 'NOT_STARTED',
      anchors: 0,
    }),
    rawSource: 'https://private.example/raw-source',
    providerDiagnostic: 'never render this diagnostic',
  };
  const output = traceText({
    data: {},
    mission: {status: 'RUNNING', history: [], sourcedRouteProgress: progress},
    plan: {},
    nodes: [],
    mapping: {missionId: 'mission:public', admission: {routeBinding: publicSourcedBinding}},
  });

  assert.match(output, /Fase publicada: ACQUIRING/);
  assert.match(output, /Obtenciones completas: 3 \/ 4/);
  assert.doesNotMatch(output, /private\.example|never render this diagnostic/);
});

test('a sealed evidence packet renders zero discovery and no source URLs', () => {
  const progress = {
    ...sourcedRouteProgress({
      phase: 'ACQUIRING',
      searchLimit: 0,
      fetchUsed: 1,
      fetchLimit: 2,
      discovery: 'SEALED_DISABLED',
    }),
    rawSource: 'https://private.example/never-render',
  };
  const output = traceText({
    data: {},
    mission: {status: 'RUNNING', history: [], sourcedRouteProgress: progress},
    plan: {},
    nodes: [],
    mapping: {missionId: 'mission:public', admission: {routeBinding: publicSourcedBinding}},
  });

  assert.match(output, /Búsqueda acotada: 0 \/ 0/);
  assert.match(output, /Descubrimiento público: desactivado · paquete de fuentes sellado/);
  assert.match(output, /Obtenciones completas: 1 \/ 2/);
  assert.doesNotMatch(output, /private\.example/);
});

test('the sealed three-source used-car v2 packet renders its bounded public progress', () => {
  const progress = {
    ...sourcedRouteProgress({
      phase: 'ACQUIRING',
      searchLimit: 0,
      fetchUsed: 3,
      fetchLimit: 3,
      discovery: 'SEALED_DISABLED',
    }),
    rawSource: 'https://private.example/never-render',
    providerDiagnostic: 'never render this diagnostic',
  };
  const output = traceText({
    data: {},
    mission: {status: 'RUNNING', history: [], sourcedRouteProgress: progress},
    plan: {},
    nodes: [],
    mapping: {missionId: 'mission:public', admission: {routeBinding: publicSourcedBinding}},
  });

  assert.match(output, /Búsqueda acotada: 0 \/ 0/);
  assert.match(output, /Obtenciones completas: 3 \/ 3/);
  assert.match(output, /Descubrimiento público: desactivado · paquete de fuentes sellado/);
  assert.doesNotMatch(output, /private\.example|never render this diagnostic/);
});

test('a report-only sourced-route receipt is safely rendered and an escalation explains its explicit boundary', () => {
  const output = traceText({
    data: {},
    mission: {status: 'NEEDS_DIRECTION', history: []},
    plan: {},
    nodes: [],
    report: {
      mission: {
        sourcedRouteProgress: sourcedRouteProgress({
          phase: 'ESCALATED',
          searchUsed: 1,
          fetchUsed: 2,
          reviewState: 'RETURNED',
          anchors: 2,
        }),
      },
    },
    mapping: {missionId: 'mission:public', admission: {routeBinding: publicSourcedBinding}},
  });

  assert.match(output, /Fase publicada: ESCALATED/);
  assert.match(output, /nueva admisión planificada explícita/);
  assert.match(output, /no continuará acumulando búsquedas ni usará memoria, adjuntos o contexto privado/);
  assert.match(output, /La ruta pública acotada no publica un nodo final ni una topología de handoffs/);
  assert.doesNotMatch(output, /El plan no proyectó aún un nodo final/);
});

test('a malformed sourced-route receipt fails closed without rendering its arbitrary fields', () => {
  const output = traceText({
    data: {},
    mission: {
      status: 'RUNNING',
      history: [],
      sourcedRouteProgress: {
        ...sourcedRouteProgress(),
        phase: 'UNRECOGNISED_INTERNAL_PHASE',
        acquisition: {search: {used: 80, limit: 80}, fetch: {used: 2, limit: 2}, maxSourceBytes: 65_536},
        rawSourceUrl: 'https://leak.example/never-render',
        thought: 'never render hidden thought',
      },
    },
    plan: {},
    nodes: [],
    mapping: {missionId: 'mission:public', admission: {routeBinding: publicSourcedBinding}},
  });

  assert.match(output, /Proyección de ruta no verificable/);
  assert.match(output, /no cumple el contrato público exacto/);
  assert.doesNotMatch(output, /UNRECOGNISED_INTERNAL_PHASE|80 \/ 80|leak\.example|never render hidden thought/);
});

test('a verified signed trace renders only its allow-listed operational receipts in expandable rows', () => {
  const trace = signedTrace([
    signedEntry(31, 'mission.created'),
    signedEntry(34, 'mission.status', {status: 'WAITING_PROVIDER', pending: [{code: 'TIMEOUT'}]}),
  ]);
  const output = traceText({
    data: {},
    mission: {status: 'WAITING_PROVIDER', history: []},
    plan: {},
    nodes: [],
    report: {publicTrace: trace},
    mapping: {missionId: signedTraceMissionId, admission: {}},
  });

  assert.match(output, /2 recibos verificables/);
  assert.match(output, /Misión admitida/);
  assert.match(output, /Estado de la misión publicado/);
  assert.match(output, /WAITING_PROVIDER/);
  assert.match(output, /Pendientes publicados: TIMEOUT/);
  assert.match(output, /Recibo: f{16}…/);
  assert.doesNotMatch(output, /Static trace boundary/);
});

test('the browser-safe trace parser accepts zero planning criteria and does not depend on Node Buffer', () => {
  const trace = signedTrace([
    signedEntry(31, 'mission.created'),
    signedEntry(34, 'planning.coverage.normalized', {
      artifactId: 'artifact:plan', criteriaBefore: 0, criteriaAfter: 1, added: ['criterion:one'],
    }),
  ]);
  const priorBuffer = globalThis.Buffer;
  try {
    delete globalThis.Buffer;
    const parsed = publicMissionTrace(trace, {missionId: signedTraceMissionId});
    assert.equal(parsed?.integrity, 'VERIFIED');
    assert.equal(parsed?.entries.at(-1).event.criteriaBefore, 0);
  } finally {
    globalThis.Buffer = priorBuffer;
  }
});

test('a signed trace with an injected field or a selected-mission mismatch fails closed without rendering the sentinel', () => {
  const injected = signedTrace([
    signedEntry(31, 'mission.created'),
    signedEntry(34, 'mission.status', {status: 'WAITING_PROVIDER', pending: [{code: 'TIMEOUT', privateExtra: 'PRIVATE_PENDING_SENTINEL'}]}),
  ], {privateRoot: 'PRIVATE_ROOT_SENTINEL'});
  const output = traceText({
    data: {},
    mission: {status: 'WAITING_PROVIDER', history: []},
    plan: {},
    nodes: [],
    report: {publicTrace: injected},
    mapping: {missionId: 'mission:another-project', admission: {}},
  });

  assert.match(output, /Traza firmada no verificable/);
  assert.doesNotMatch(output, /PRIVATE_PENDING_SENTINEL|PRIVATE_ROOT_SENTINEL|TIMEOUT/);
});
