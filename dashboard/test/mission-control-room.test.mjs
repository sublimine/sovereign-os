import assert from 'node:assert/strict';
import test from 'node:test';

import {missionControlRoom, missionControlRoomSelectedTab} from '../public/mission-control-room.js';

test('mission control room exposes a bounded live operational summary and ready controls', () => {
  const room = missionControlRoom({
    mission: {
      status: 'RUNNING',
      pending: [{code: 'WAITING_PROVIDER', privateReason: 'never project this'}],
    },
    queueJob: {
      status: 'RUNNING',
      lifecycle: {pendingCodes: ['WAITING_PROVIDER', 'PRIVATE bad code']},
    },
    nodes: [
      {title: 'Investigación de mercado', status: 'COMPLETED', roles: ['researcher']},
      {title: 'Validación independiente', status: 'RUNNING', roles: ['reviewer', 'quality']},
    ],
    plan: {finalNodeId: 'node:final'},
    report: {reviews: []},
    detailReady: true,
    reportReady: true,
  });

  assert.equal(room.schema, 'sublimine.mission-control-room.v1');
  assert.equal(room.status, 'RUNNING');
  assert.deepEqual(room.phase, {label: 'NODO ACTIVO', value: 'RUNNING'});
  assert.deepEqual(room.coordination, {label: 'COORDINACIÓN', value: 'COLA · RUNNING'});
  assert.equal(room.assignment.value, 'Validación independiente');
  assert.deepEqual(room.assignment.roles, ['reviewer', 'quality']);
  assert.deepEqual(room.blockingCodes, ['WAITING_PROVIDER']);
  assert.deepEqual(room.blocking, {state: 'BLOCKED', label: 'WAITING_PROVIDER'});
  assert.equal(room.execution.nodes.length, 2);
  assert.equal(room.tabs.trace.enabled, true);
  assert.equal(room.tabs.plan.enabled, true);
  assert.equal(room.tabs.evidence.enabled, true);
  assert.equal(room.controls.export.enabled, true);
  assert.equal(room.controls.runtimeActions.enabled, true);
  assert.equal(room.controls.retryReview.enabled, false);
  assert.doesNotMatch(JSON.stringify(room), /never project this|PRIVATE bad code/);
});

test('sourced control room distinguishes sealed phase, blocks unavailable tabs, and never invents a retry', () => {
  const room = missionControlRoom({
    mission: {status: 'NEEDS_DIRECTION', pending: [{code: 'SOURCED_EVIDENCE_PROFILE_COVERAGE', diagnostic: 'hidden'}]},
    queueJob: {status: 'QUEUED', lifecycle: {pendingCodes: []}},
    nodes: [{title: 'Private planned title must not become assignment', status: 'RUNNING'}],
    plan: {finalNodeId: 'node:private'},
    report: {reviews: [{decision: 'RETURN'}]},
    sourcedProgress: {phase: 'ESCALATED', independentReview: {state: 'RETURNED'}},
    isSourcedRoute: true,
    detailReady: true,
    reportReady: false,
  });

  assert.deepEqual(room.phase, {label: 'RUTA CON FUENTES', value: 'ESCALATED'});
  assert.deepEqual(room.assignment, {label: 'ASIGNACIÓN', value: 'PRODUCTOR DE RESPUESTA PÚBLICA', roles: []});
  assert.deepEqual(room.blocking, {state: 'BLOCKED', label: 'SOURCED_EVIDENCE_PROFILE_COVERAGE'});
  assert.equal(room.tabs.plan.enabled, false);
  assert.match(room.tabs.plan.reason, /no crea un grafo/i);
  assert.equal(room.tabs.evidence.enabled, false);
  assert.equal(room.tabs.raw.enabled, true);
  assert.equal(room.controls.export.enabled, false);
  assert.equal(room.controls.runtimeActions.enabled, false);
  assert.match(room.controls.runtimeActions.reason, /escalado explícito/i);
  assert.equal(room.controls.retryReview.enabled, false);
  assert.doesNotMatch(JSON.stringify(room), /Private planned title|hidden|node:private/);
});

test('control room distinguishes a durable provider retry from an unobserved queue', () => {
  const room = missionControlRoom({
    mission: {status: 'WAITING_PROVIDER', pending: [{code: 'TIMEOUT'}]},
    queueJob: {
      status: 'RETRY_WAIT',
      automaticRetries: 1,
      nextAttemptAt: '2026-09-21T05:17:02.835Z',
      lifecycle: {pendingCodes: ['TIMEOUT']},
    },
    sourcedProgress: {phase: 'CANDIDATE_PENDING_REVIEW', independentReview: {state: 'PENDING'}},
    isSourcedRoute: true,
    detailReady: true,
    reportReady: true,
  });

  assert.deepEqual(room.coordination, {
    label: 'COORDINACIÓN',
    value: 'COLA · RETRY_WAIT',
    retrySchedule: {at: '2026-09-21T05:17:02.835Z', automaticRetries: 1},
  });
  assert.deepEqual(room.blocking, {state: 'BLOCKED', label: 'TIMEOUT'});
});

test('control room exposes an already-running automatic retry without erasing its last confirmed timeout', () => {
  const room = missionControlRoom({
    mission: {status: 'WAITING_PROVIDER', pending: [{code: 'TIMEOUT'}]},
    queueJob: {
      status: 'RUNNING',
      attempts: 2,
      automaticRetries: 1,
      lifecycle: {status: 'WAITING_PROVIDER', pendingCodes: ['TIMEOUT']},
    },
    sourcedProgress: {phase: 'CANDIDATE_PENDING_REVIEW', independentReview: {state: 'PENDING'}},
    isSourcedRoute: true,
    detailReady: true,
    reportReady: true,
  });

  assert.deepEqual(room.coordination, {
    label: 'COORDINACIÓN',
    value: 'COLA · RUNNING',
    retryInFlight: {attempts: 2, automaticRetries: 1, lastLifecycleStatus: 'WAITING_PROVIDER'},
  });
  assert.deepEqual(room.blocking, {state: 'RECOVERING', label: 'REINTENTO ACTIVO · TIMEOUT'});
});

test('mission control room accepts a retry only for an explicit returned review on a nonterminal planned mission', () => {
  const ready = missionControlRoom({
    mission: {status: 'RUNNING', pending: []},
    report: {reviews: [{status: 'RETURNED'}]},
    plan: {finalNodeId: 'node:review'},
    nodes: [{title: 'Revisión', status: 'RETURNED'}],
    detailReady: true,
    reportReady: true,
  });
  const terminal = missionControlRoom({
    mission: {status: 'COMPLETED', pending: []},
    report: {reviews: [{status: 'RETURNED'}]},
    plan: {finalNodeId: 'node:review'},
    nodes: [{title: 'Revisión', status: 'RETURNED'}],
    detailReady: true,
    reportReady: true,
  });
  assert.equal(ready.controls.retryReview.enabled, true);
  assert.equal(terminal.controls.retryReview.enabled, false);
  assert.deepEqual(terminal.phase, {label: 'CICLO DE MISIÓN', value: 'COMPLETED'});
  assert.deepEqual(terminal.assignment, {label: 'ASIGNACIÓN', value: 'EJECUCIÓN CERRADA', roles: []});
  assert.equal(terminal.execution.activeNodeTitle, null);
});

test('control-room tab selection falls back to the live trace when a panel is not ready', () => {
  const room = missionControlRoom({
    mission: {status: 'RUNNING', pending: []},
    nodes: [],
    plan: {},
    detailReady: true,
    reportReady: false,
  });
  assert.equal(missionControlRoomSelectedTab(room, 'summary'), 'summary');
  assert.equal(missionControlRoomSelectedTab(room, 'plan'), 'trace');
  assert.equal(missionControlRoomSelectedTab(room, 'evidence'), 'trace');
  assert.equal(missionControlRoomSelectedTab(room, 'does-not-exist'), 'trace');
});

test('control room derives a bounded verified DAG for the visual execution graph', () => {
  const room = missionControlRoom({
    mission: {status: 'RUNNING', pending: []},
    nodes: [
      {id: 'research', title: 'Investigación', status: 'ACCEPTED', spec: {dependencies: [], roleIds: ['researcher']}},
      {id: 'verify', title: 'Verificación', status: 'RUNNING', spec: {dependencies: ['research'], roleIds: ['reviewer']}},
      {id: 'synthesis', title: 'Síntesis final', status: 'PENDING', spec: {dependencies: ['research', 'verify'], roleIds: ['editor']}},
    ],
    plan: {finalNodeId: 'synthesis'}, detailReady: true, reportReady: true,
  });

  assert.equal(room.execution.integrity, 'VERIFIED');
  assert.deepEqual(room.execution.nodes.map(node => [node.id, node.level]), [
    ['research', 0], ['verify', 1], ['synthesis', 2],
  ]);
  assert.deepEqual(room.execution.edges, [
    {from: 'research', to: 'verify'},
    {from: 'research', to: 'synthesis'},
    {from: 'verify', to: 'synthesis'},
  ]);
});

test('control room withholds graph connections when dependencies are malformed, cyclic, or outside the verified node set', () => {
  const room = missionControlRoom({
    mission: {status: 'RUNNING', pending: []},
    nodes: [
      {id: 'left', title: 'Left', status: 'RUNNING', spec: {dependencies: ['right'], roleIds: []}},
      {id: 'right', title: 'Right', status: 'PENDING', spec: {dependencies: ['left'], roleIds: []}},
      {id: 'private', title: 'Private', status: 'PENDING', spec: {dependencies: ['OUTSIDE_NODE', {nodeId: 'PRIVATE_SENTINEL'}], roleIds: []}},
    ],
    plan: {finalNodeId: 'left'}, detailReady: true, reportReady: true,
  });

  assert.equal(room.execution.integrity, 'UNVERIFIED');
  assert.deepEqual(room.execution.edges, []);
  assert.doesNotMatch(JSON.stringify(room.execution.edges), /PRIVATE_SENTINEL|OUTSIDE_NODE/);
});
