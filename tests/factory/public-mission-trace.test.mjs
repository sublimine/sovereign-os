import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

import {Authority} from '../../factory/lib/authority.mjs';
import {FactoryEngine} from '../../factory/lib/engine.mjs';
import {
  PUBLIC_MISSION_TRACE_HEAD_RECORD_TYPE,
  readPublicMissionTrace,
  recordPublicMissionTrace,
} from '../../factory/lib/public-mission-trace.mjs';
import {Store} from '../../factory/lib/store.mjs';

function fixture(t) {
  const store = new Store(':memory:');
  const authority = new Authority(store, {key: Buffer.alloc(32, 29)});
  const missionId = 'mission:public-trace-fixture';
  store.put('mission', missionId, {
    id: missionId,
    intent: 'Keep the trace fixture isolated.',
    intentHash: '0'.repeat(64),
    policy: {},
    status: 'NEW',
    createdAt: '2026-09-21T05:00:00.000Z',
    updatedAt: '2026-09-21T05:00:00.000Z',
    finalArtifactId: null,
    pending: [],
    history: [],
  }, {expectedVersion: 0});
  t.after(() => store.close());
  return {store, authority, missionId};
}

function appendPublic(store, authority, kind, data) {
  return store.transact(() => {
    const event = store.append(kind, data);
    const receipt = recordPublicMissionTrace({store, authority, event});
    return {event, receipt};
  });
}

test('a signed mission trace exposes only reprojected public engine events in order', t => {
  const {store, authority, missionId} = fixture(t);
  appendPublic(store, authority, 'mission.created', {missionId, privateCreationNote: 'PRIVATE_CREATE_SENTINEL'});
  appendPublic(store, authority, 'mission.status', {
    missionId,
    status: 'WAITING_PROVIDER',
    pending: [{code: 'TIMEOUT', reason: 'PRIVATE_REASON_SENTINEL', diagnosis: 'PRIVATE_DIAGNOSIS_SENTINEL'}],
  });

  const before = store.verifyJournal();
  const trace = readPublicMissionTrace({store, authority, missionId});
  assert.deepEqual(store.verifyJournal(), before, 'reading the trace is read-only');
  assert.equal(trace.integrity, 'VERIFIED');
  assert.equal(trace.coverage, 'FROM_ADMISSION');
  assert.equal(trace.entries.length, 2);
  assert.deepEqual(trace.entries.map(entry => entry.event.kind), ['mission.created', 'mission.status']);
  assert.deepEqual(trace.entries.at(-1).event.pending, [{code: 'TIMEOUT'}]);
  assert.match(trace.entries.at(-1).receiptHash, /^[a-f0-9]{64}$/);
  const rendered = JSON.stringify(trace);
  for (const sentinel of ['PRIVATE_CREATE_SENTINEL', 'PRIVATE_REASON_SENTINEL', 'PRIVATE_DIAGNOSIS_SENTINEL']) {
    assert.equal(rendered.includes(sentinel), false, 'private engine material escaped the trace');
  }
});

test('unknown internal events do not manufacture a public trace receipt', t => {
  const {store, authority, missionId} = fixture(t);
  appendPublic(store, authority, 'mission.created', {missionId});
  const internal = store.transact(() => {
    const event = store.append('internal.private.event', {missionId, prompt: 'PRIVATE_PROMPT_SENTINEL'});
    return recordPublicMissionTrace({store, authority, event});
  });
  assert.equal(internal, null);
  const trace = readPublicMissionTrace({store, authority, missionId});
  assert.equal(trace.integrity, 'VERIFIED');
  assert.equal(trace.entries.length, 1);
  assert.doesNotMatch(JSON.stringify(trace), /PRIVATE_PROMPT_SENTINEL/);
});

test('sourced-route transitions retain only fixed public facts, never runs, scopes or provider material', t => {
  const {store, authority, missionId} = fixture(t);
  appendPublic(store, authority, 'mission.created', {missionId});
  appendPublic(store, authority, 'sourced-entry.started', {
    missionId, runId: 'run:PRIVATE_RUN_SENTINEL', contractHash: 'PRIVATE_CONTRACT_SENTINEL', scope: 'PRIVATE_SCOPE_SENTINEL',
  });
  appendPublic(store, authority, 'sourced-entry.fallback', {
    missionId, code: 'DIRECT_NOT_ACCEPTED', phase: 'PRIVATE_PHASE_SENTINEL', scope: 'PRIVATE_FALLBACK_SCOPE_SENTINEL',
  });
  const trace = readPublicMissionTrace({store, authority, missionId});
  assert.equal(trace.integrity, 'VERIFIED');
  assert.deepEqual(trace.entries.map(entry => entry.event), [
    trace.entries[0].event,
    {schema: 'sovereign.public-engine-event.v1', kind: 'sourced-entry.started', seq: trace.entries[1].revision, at: trace.entries[1].at, missionId},
    {schema: 'sovereign.public-engine-event.v1', kind: 'sourced-entry.fallback', seq: trace.entries[2].revision, at: trace.entries[2].at, missionId, code: 'DIRECT_NOT_ACCEPTED'},
  ]);
  assert.doesNotMatch(JSON.stringify(trace), /PRIVATE_RUN|PRIVATE_CONTRACT|PRIVATE_SCOPE|PRIVATE_PHASE|PRIVATE_FALLBACK/);
});

test('a missing eligible public engine event invalidates coverage instead of yielding a truthful-looking subset', t => {
  const {store, authority, missionId} = fixture(t);
  appendPublic(store, authority, 'mission.created', {missionId});
  // Deliberately bypass the trace writer to model a buggy/incomplete future
  // caller. The reader must not call the retained first receipt "complete".
  store.append('mission.status', {missionId, status: 'WAITING_PROVIDER', pending: [{code: 'TIMEOUT'}]});
  const trace = readPublicMissionTrace({store, authority, missionId});
  assert.equal(trace.integrity, 'UNVERIFIED');
  assert.deepEqual(trace.entries, []);
});

test('a historical engine event cannot receive a trace receipt from a later transaction', t => {
  const {store, authority, missionId} = fixture(t);
  const historical = store.append('mission.created', {missionId});
  assert.throws(() => store.transact(() => recordPublicMissionTrace({store, authority, event: historical})), {
    code: 'TRANSACTION_WITNESS',
  });
  const trace = readPublicMissionTrace({store, authority, missionId});
  assert.equal(trace.integrity, 'ABSENT');
  assert.deepEqual(trace.entries, []);
});

test('a trace that did not begin at immutable admission fails closed instead of claiming full history', t => {
  const {store, authority, missionId} = fixture(t);
  appendPublic(store, authority, 'mission.status', {missionId, status: 'RUNNING', pending: []});
  const trace = readPublicMissionTrace({store, authority, missionId});
  assert.equal(trace.integrity, 'UNVERIFIED');
  assert.deepEqual(trace.entries, []);
});

test('a changed signed head fails closed without forwarding its stored contents', t => {
  const {store, authority, missionId} = fixture(t);
  appendPublic(store, authority, 'mission.created', {missionId});
  const head = store.get(PUBLIC_MISSION_TRACE_HEAD_RECORD_TYPE, missionId);
  store.put(PUBLIC_MISSION_TRACE_HEAD_RECORD_TYPE, missionId, {signed: {
    kind: 'PRIVATE_HEAD_SENTINEL',
    data: {private: 'PRIVATE_HEAD_BODY_SENTINEL'},
    signature: {algorithm: 'HMAC-SHA256', keyId: 'local-authority-v1', value: '0'.repeat(64)},
  }}, {expectedVersion: head.version});
  const trace = readPublicMissionTrace({store, authority, missionId});
  assert.equal(trace.integrity, 'UNVERIFIED');
  assert.deepEqual(trace.entries, []);
  assert.doesNotMatch(JSON.stringify(trace), /PRIVATE_HEAD/);
});

test('FactoryEngine commits a mission-created public receipt with its engine event', t => {
  const root = mkdtempSync(join(tmpdir(), 'public-mission-trace-engine-'));
  const engine = new FactoryEngine({databasePath: join(root, 'state.sqlite'), workspaceRoot: join(root, 'workspace')});
  t.after(() => { engine.close(); rmSync(root, {recursive: true, force: true}); });
  const mission = engine.create('Create only the minimal trace fixture.', {allowedTools: []});
  const trace = readPublicMissionTrace({store: engine.store, authority: engine.authority, missionId: mission.id});
  assert.equal(trace.integrity, 'VERIFIED');
  assert.equal(trace.coverage, 'FROM_ADMISSION');
  assert.deepEqual(trace.entries.map(entry => entry.event.kind), ['mission.created']);
});

test('FactoryEngine commits a status state and its signed receipt as one normal transition', t => {
  const root = mkdtempSync(join(tmpdir(), 'public-mission-trace-status-'));
  const engine = new FactoryEngine({databasePath: join(root, 'state.sqlite'), workspaceRoot: join(root, 'workspace')});
  t.after(() => { engine.close(); rmSync(root, {recursive: true, force: true}); });
  const mission = engine.create('Create only the status trace fixture.', {allowedTools: []});
  engine.setStatus(mission.id, 'WAITING_PROVIDER', [{code: 'TIMEOUT'}]);
  const trace = readPublicMissionTrace({store: engine.store, authority: engine.authority, missionId: mission.id});
  assert.equal(trace.integrity, 'VERIFIED');
  assert.deepEqual(trace.entries.map(entry => entry.event.kind), ['mission.created', 'mission.status']);
  assert.deepEqual(trace.entries.at(-1).event.pending, [{code: 'TIMEOUT'}]);
});
