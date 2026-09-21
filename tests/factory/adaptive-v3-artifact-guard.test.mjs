import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {Store} from '../../factory/lib/store.mjs';
import {Authority} from '../../factory/lib/authority.mjs';
import {ArtifactRegistry} from '../../factory/lib/artifacts.mjs';
import {FactoryEngine} from '../../factory/lib/engine.mjs';
import {sha256} from '../../factory/lib/contracts.mjs';
import {
  ADAPTIVE_V3_DIRECT_CRITERIA,
  ADAPTIVE_V3_DIRECT_ENTRY_INTEGRITY,
  ADAPTIVE_V3_DIRECT_ENTRY_NODE,
  ADAPTIVE_V3_DIRECT_ENTRY_PURPOSE,
  ADAPTIVE_V3_DIRECT_CERTIFICATION_TYPE,
  assertAdaptiveV3ClosedEvidence
} from '../../factory/lib/adaptive-v3-deterministic-entry.mjs';

const literal = (transform, payload) => `LITERAL-TRANSFORM/1 ${transform}\n<<<\n${payload}\n>>>`;
let sequence = 0;

function setup(t, {intent = literal('uppercase-ascii-v1', 'hello')} = {}) {
  const root=mkdtempSync(join(tmpdir(),'sovereign-adaptive-v3-artifact-'));
  const engine=new FactoryEngine({databasePath:join(root,'state.sqlite'),workspaceRoot:join(root,'workspaces')});
  const mission=engine.create(intent,{preset:'adaptive-v3',model:'gpt-6-terra',reasoningEffort:'high',allowedTools:[]});
  t.after(()=>{engine.close();rmSync(root,{recursive:true,force:true});});
  return {store:engine.store,authority:engine.authority,registry:engine.registry,engine,mission,missionId:mission.id};
}

test('adaptive-v3 direct artifact is certified by exact recomputation, not a fabricated reviewer', async t => {
  const f = setup(t);
  const outcome = (await f.engine.run(f.missionId)).outcome;
  const artifact = f.store.get('artifact', outcome.id);
  assert.equal(artifact.version, 2);
  assert.equal(artifact.data.status, 'ACCEPTED');
  assert.equal(artifact.data.payload.kind, 'deterministic-result');
  assert.equal(artifact.data.payload.nodeId, ADAPTIVE_V3_DIRECT_ENTRY_NODE);
  assert.equal(artifact.data.payload.purpose, ADAPTIVE_V3_DIRECT_ENTRY_PURPOSE);
  assert.deepEqual(artifact.data.payload.criteria, ADAPTIVE_V3_DIRECT_CRITERIA);
  assert.deepEqual(artifact.data.reviews, []);
  assert.deepEqual(artifact.data.reviewDependencies, []);
  assert.equal(f.store.list('review').length, 0);
  assert.equal(f.store.list('effect').length, 0);
  assert.equal(f.store.list('source').length, 0);
  assert.equal(f.store.list('node').length, 0);
  assert.equal(f.store.list('plan').length, 0);
  assert.equal(f.store.list('worker-config').length, 0);
  assert.equal(f.store.list('inference-request').length, 0);
  const run = f.store.get('run', artifact.data.payload.producerRunId);
  assert.equal(run.version, 1);
  assert.equal(run.data.providerThreadId, null);
  assert.equal(run.data.inferenceReceipt, undefined);
  assert.equal(run.data.requests, undefined);

  const evidence = assertAdaptiveV3ClosedEvidence(f.registry, artifact.id);
  assert.ok(evidence.order.mission < evidence.order.route);
  assert.ok(evidence.order.route < evidence.order.run);
  assert.ok(evidence.order.run < evidence.order.origin);
  assert.ok(evidence.order.origin < evidence.order.candidate);
  assert.ok(evidence.order.candidate < evidence.order.certification);
  assert.ok(evidence.order.certification < evidence.order.accepted);
  assert.equal(f.registry.assertUsable(artifact.id, {missionId: f.missionId, purpose: ADAPTIVE_V3_DIRECT_ENTRY_PURPOSE}).id, artifact.id);
  assert.equal(f.registry.certifyAdaptiveV3Closed(artifact.id).artifact.id, artifact.id, 'certification is idempotent only after revalidation');

  assert.throws(() => f.registry.review({artifactId: artifact.id, reviewerRunId: 'run:invented', result: {}}),
    {code: ADAPTIVE_V3_DIRECT_ENTRY_INTEGRITY});
  assert.equal(f.store.list('review').length, 0);
});

test('the native v3 producer rejects provider, context, tool and runtime mutation before it can poison delivery', async t => {
  const f = setup(t), outcome = (await f.engine.run(f.missionId)).outcome;
  // The delivered public artifact intentionally excludes its producer control
  // binding.  This guard is about durable native ownership, so read that
  // binding from the authenticated stored artifact rather than teaching the
  // public delivery projection to disclose it.
  const runId = f.store.get('artifact',outcome.id).data.payload.producerRunId, before = f.store.get('run', runId);
  const rejected = action => assert.throws(action, {code: ADAPTIVE_V3_DIRECT_ENTRY_INTEGRITY});

  rejected(() => f.registry.attachInference(runId, {status: 'completed', threadId: 'provider:injected', turnId: 'turn:injected'}));
  rejected(() => f.registry.recordInferenceRequest(runId, {instructions: 'injected', input: '{}', schema: {type: 'object'}}));
  rejected(() => f.registry.updateContext(runId, {...before.data.context, instructionsHash: sha256('injected context')}));
  rejected(() => f.registry.recordToolObservation(runId, 'not-a-signed-receipt'));
  rejected(() => f.registry.captureRuntimeObservations(runId));
  rejected(() => f.registry.bindHistoricalInferenceRequest(runId, {instructions: 'injected', input: '{}', schema: {type: 'object'}}));
  rejected(() => f.registry.ingestSource(f.authority.seal('tool.receipt', {
    id: 'effect:injected-source', missionId: f.missionId, principalId: runId, tool: 'source.fetch', status: 'SUCCEEDED',
    result: {content: 'injected source', sha256: sha256('injected source'), retrievedAt: '2026-09-19T00:00:00.000Z'}
  })));

  const after = f.store.get('run', runId);
  assert.equal(after.version, 1);
  assert.equal(after.hash, before.hash, 'every rejected mutation rolls back before changing the native producer');
  assert.equal(f.store.list('inference-request').filter(record => record.data.runId === runId).length, 0);
  assert.equal(f.store.list('runtime-observation').filter(record => record.data.runId === runId).length, 0);
  assert.equal(f.store.list('source').filter(record => record.data.missionId === f.missionId).length, 0);
  assert.equal(f.registry.assertUsable(outcome.id, {
    missionId: f.missionId, purpose: ADAPTIVE_V3_DIRECT_ENTRY_PURPOSE
  }).id, outcome.id, 'rejected mutations leave the native certified delivery usable');
});

test('the reserved pair cannot be manufactured without its signed route and origin', t => {
  const store = new Store(':memory:'), authority = new Authority(store, {key: Buffer.alloc(32, 43)});
  const registry = new ArtifactRegistry(store, authority);
  t.after(() => store.close());
  const run = registry.registerRun({missionId: 'mission:unbound-v3', nodeId: ADAPTIVE_V3_DIRECT_ENTRY_NODE, mode: 'producer', context: {
    purpose: ADAPTIVE_V3_DIRECT_ENTRY_PURPOSE, artifactIds: [], sourceIds: [], instructionsHash: sha256('unbound'), producerConversationIncluded: false
  }});
  assert.throws(() => registry.create({missionId: 'mission:unbound-v3', nodeId: ADAPTIVE_V3_DIRECT_ENTRY_NODE,
    producerRunId: run.id, kind: 'deterministic-result', purpose: ADAPTIVE_V3_DIRECT_ENTRY_PURPOSE, body: 'HELLO',
    claims: [], inputRefs: [], toolReceipts: [], requiredEffects: [], criteria: ADAPTIVE_V3_DIRECT_CRITERIA, provisional: false}));
  assert.equal(store.list('artifact').length, 0);
});

test('a direct v3 mission blocks the former alternate Registry actor and candidate chain before acceptance', t => {
  const f = setup(t);
  assert.throws(() => f.registry.registerRun({missionId: f.missionId, nodeId: 'escape', mode: 'producer', context: {
    purpose: 'escape', artifactIds: [], sourceIds: [], instructionsHash: sha256('injected producer'), producerConversationIncluded: false
  }}), {code: ADAPTIVE_V3_DIRECT_ENTRY_INTEGRITY});
  assert.throws(() => f.registry.create({missionId: f.missionId, nodeId: 'escape', producerRunId: 'run:injected',
    kind: 'deterministic-result', purpose: 'escape', body: 'INJECTED', claims: [], inputRefs: [], toolReceipts: [],
    requiredEffects: [], criteria: [{id: 'escape', text: 'Injected criterion'}], provisional: false}),
  {code: ADAPTIVE_V3_DIRECT_ENTRY_INTEGRITY});
  assert.equal(f.store.list('run').filter(record => record.data.missionId === f.missionId).length, 0);
  assert.equal(f.store.list('artifact').filter(record => record.data.missionId === f.missionId).length, 0);
  assert.equal(f.store.list('review').length, 0);
});

test('a manually recorded ordinary accepted artifact cannot become usable or deliverable on a direct v3 route', async t => {
  const f = setup(t), artifactId = 'artifact:manual-v3-injection';
  const payload = {missionId: f.missionId, nodeId: 'escape', producerRunId: 'run:manual-v3-injection',
    kind: 'deterministic-result', purpose: 'escape', body: 'INJECTED', claims: [], inputRefs: [], toolReceipts: [],
    requiredEffects: [], criteria: [{id: 'escape', text: 'Injected criterion'}], provisional: false};
  const candidate = {id: artifactId, payload, payloadHash: sha256(payload), missionId: f.missionId,
    status: 'CANDIDATE', reviews: [], createdAt: '2026-09-19T00:00:00.000Z', invalidation: null};
  f.store.transact(() => f.store.put('artifact', artifactId, candidate, {expectedVersion: 0}));
  assert.throws(() => f.registry.review({artifactId, reviewerRunId: 'run:invented', result: {}}),
    {code: ADAPTIVE_V3_DIRECT_ENTRY_INTEGRITY});
  f.store.put('artifact', artifactId, {...candidate, status: 'ACCEPTED', reviews: ['review:invented'], reviewDependencies: []}, {expectedVersion: 1});
  assert.throws(() => f.registry.assertUsable(artifactId, {missionId: f.missionId, purpose: 'escape'}),
    {code: ADAPTIVE_V3_DIRECT_ENTRY_INTEGRITY});
  const halted=await f.engine.run(f.missionId);
  assert.equal(halted.mission.status,'NEEDS_DIRECTION');
  assert.equal(f.store.get('mission', f.missionId).data.finalArtifactId, null);
  assert.equal(f.store.list('adaptive-v3-origin').length, 0);
  assert.equal(f.store.list('adaptive-v3-certification').length, 0);
});

test('only the signed deterministic v3 reservation may carry an empty materialized body', async t => {
  const f = setup(t, {intent: literal('trim-ascii-v1', '\t \r\n')});
  const outcome = (await f.engine.run(f.missionId)).outcome;
  assert.equal(outcome.payload.body, '');
  assert.equal(f.registry.assertUsable(outcome.id, {
    missionId: f.missionId, purpose: ADAPTIVE_V3_DIRECT_ENTRY_PURPOSE
  }).payload.body, '');
});

test('a re-versioned deterministic certificate invalidates use rather than falling back to normal review', async t => {
  const f = setup(t), outcome = (await f.engine.run(f.missionId)).outcome;
  const certificate = f.store.get(ADAPTIVE_V3_DIRECT_CERTIFICATION_TYPE, outcome.id);
  f.store.put(ADAPTIVE_V3_DIRECT_CERTIFICATION_TYPE, outcome.id, certificate.data, {expectedVersion: certificate.version});
  assert.throws(() => f.registry.assertUsable(outcome.id, {missionId: f.missionId, purpose: ADAPTIVE_V3_DIRECT_ENTRY_PURPOSE}),
    {code: ADAPTIVE_V3_DIRECT_ENTRY_INTEGRITY});
  assert.equal(f.store.list('review').length, 0);
});
