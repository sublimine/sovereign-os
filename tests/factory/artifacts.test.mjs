import test from 'node:test';
import assert from 'node:assert/strict';
import {Store} from '../../factory/lib/store.mjs';
import {Authority} from '../../factory/lib/authority.mjs';
import {ArtifactRegistry} from '../../factory/lib/artifacts.mjs';
import {id, sha256} from '../../factory/lib/contracts.mjs';

// Deterministic fixture receipts model completed inference; these are NOT live model evaluations.
function setup(fn) {
  const store = new Store(':memory:'); let now = '2026-09-09T10:00:00.000Z';
  const authority = new Authority(store, {clock: () => now}), registry = new ArtifactRegistry(store, authority, {clock: () => now});
  const run = (mode, artifacts = [], sources = [], forbiddenArtifactIds = []) => {
    const r = registry.registerRun({missionId: 'm', nodeId: 'n', mode, forbiddenArtifactIds, context: {
      purpose: 'answer', artifactIds: artifacts, sourceIds: sources, instructionsHash: sha256('fixture instructions'), producerConversationIncluded: false,
    }});
    registry.attachInference(r.id, {status: 'completed', threadId: id('synthetic-thread'), turnId: 'test-turn'}); return store.get('run', r.id).data;
  };
  const create = (options = {}) => {
    const producer = run('producer', (options.inputRefs ?? []).map(r => r.artifactId), [...new Set((options.claims ?? []).flatMap(c => c.sources.map(s => s.sourceId)))]);
    return registry.create({missionId: 'm', nodeId: 'n', producerRunId: producer.id, kind: 'answer', purpose: 'answer', body: 'The acquired record reports 12.', criteria: [{id: 'support', text: 'Exact support'}], ...options});
  };
  const decision = (artifact, override = {}) => ({artifactHash: artifact.payloadHash, purpose: 'answer', decision: 'ACCEPT', checks: [{criterionId: 'support', verdict: 'PASS', evidence: [{kind: 'artifact', id: artifact.id, hash: artifact.payloadHash, quote: artifact.payload.body}], reason: 'Fixture exact text observed'}], findings: [], uncertainty: 'Synthetic review fixture, not semantic proof', ...override});
  const accept = artifact => {
    const sourceIds = [...new Set(artifact.payload.claims.flatMap(c => c.sources.map(s => s.sourceId)))];
    const result = decision(artifact);
    result.checks[0].evidence.push(...artifact.payload.claims.flatMap(c => c.sources.map(s => ({kind: 'source', id: s.sourceId, hash: s.hash, quote: s.quote}))));
    return registry.review({artifactId: artifact.id, reviewerRunId: run('reviewer', [artifact.id], sourceIds).id, result});
  };
  const source = ({committed = true} = {}) => {
    const content = 'Synthetic bulletin\nThe recorded value is 12.\nNo causal explanation is provided.';
    const receipt = {id: id('fixture-fetch'), missionId: 'm', principalId: 'fixture-worker', tool: 'source.fetch', status: 'SUCCEEDED',
      argsHash: sha256({url: 'https://example.com/fixture'}), startedAt: now, completedAt: now,
      result: {content, sha256: sha256(content), finalUrl: 'https://example.com/fixture', retrievedAt: now, mediaType: 'text/plain'}};
    const signed = authority.seal('tool.receipt', receipt);
    if (committed) store.put('effect', receipt.id, {id: receipt.id, missionId: 'm', principalId: receipt.principalId,
      tool: receipt.tool, state: receipt.status, argsHash: receipt.argsHash, receipt: signed}, {expectedVersion: 0});
    return registry.ingestSource(signed);
  };
  try { fn({store, authority, registry, run, create, accept, decision, source, setTime: t => now = t}); } finally { store.close(); }
}

test('URL or invented receipt is not an acquired source', () => setup(({registry, authority}) => {
  assert.throws(() => registry.ingestSource({url: 'https://example.com'}));
  assert.throws(() => registry.ingestSource(authority.seal('tool.receipt', {tool: 'workspace.read', status: 'SUCCEEDED'})), {code: 'SOURCE_RECEIPT'});
}));
test('facts require real support and cannot cite invented quote or hash', () => setup(({registry, create, source}) => {
  const s = source(); const fact = {id: 'value', text: 'The record reports 12', kind: 'fact', sources: [], basis: [], qualifiers: [], validUntil: null};
  assert.throws(() => create({claims: [fact]}), {code: 'UNSUPPORTED_FACT'});
  assert.throws(() => create({claims: [{...fact, sources: [{sourceId: s.id, hash: s.hash, quote: 'The recorded value is 999.'}]}]}), {code: 'SOURCE_SUPPORT'});
  assert.throws(() => registry.sourceReference({sourceId: s.id, hash: '0'.repeat(64), quote: 'The recorded value is 12.'}, 'm'), {code: 'SOURCE_SUPPORT'});
  assert.equal(create({claims: [{...fact, sources: [{sourceId: s.id, hash: s.hash, quote: 'The recorded value is 12.'}]}]}).status, 'CANDIDATE');
}));
test('material factual acceptance requires a committed acquisition and an independent source citation', () => setup(({registry, run, create, decision, source}) => {
  const s = source(), claim = {id: 'value', text: 'The record reports 12', kind: 'fact',
    sources: [{sourceId: s.id, hash: s.hash, quote: 'The recorded value is 12.'}], basis: [], qualifiers: [], validUntil: null};
  const artifact = create({claims: [claim]});
  assert.throws(() => registry.review({artifactId: artifact.id, reviewerRunId: run('reviewer', [artifact.id], [s.id]).id,
    result: decision(artifact)}), {code: 'FACTUAL_REVIEW_COVERAGE'});
  const result = decision(artifact);
  result.checks[0].evidence.push({kind: 'source', id: s.id, hash: s.hash, quote: 'The recorded value is 12.'});
  assert.equal(registry.review({artifactId: artifact.id, reviewerRunId: run('reviewer', [artifact.id], [s.id]).id, result}).status, 'ACCEPTED');

  const uncommitted = source({committed: false}), unverified = create({claims: [{...claim, id: 'uncommitted',
    sources: [{sourceId: uncommitted.id, hash: uncommitted.hash, quote: 'The recorded value is 12.'}]}]});
  const unverifiedResult = decision(unverified);
  unverifiedResult.checks[0].evidence.push({kind: 'source', id: uncommitted.id, hash: uncommitted.hash, quote: 'The recorded value is 12.'});
  assert.throws(() => registry.review({artifactId: unverified.id, reviewerRunId: run('reviewer', [unverified.id], [uncommitted.id]).id,
    result: unverifiedResult}), {code: 'SOURCE_WINDOW_ACQUISITION'});
}));
test('accepted factual artifacts revalidate acquisition provenance before later consumption', () => setup(({store, registry, create, accept, source}) => {
  const s = source(), artifact = create({claims: [{id: 'value', text: 'The record reports 12', kind: 'fact',
    sources: [{sourceId: s.id, hash: s.hash, quote: 'The recorded value is 12.'}], basis: [], qualifiers: [], validUntil: null}]});
  accept(artifact);
  const record = store.get('source', s.id);
  store.put('source', s.id, {...record.data, raw: record.data.raw + '\nInjected bytes after acceptance.'}, {expectedVersion: record.version});
  assert.throws(() => registry.assertUsable(artifact.id, {missionId: 'm', purpose: 'answer'}), {code: 'SOURCE_WINDOW_ACQUISITION'});
}));
test('review cannot approve missing receipts, missing criteria, failed obligations or wrong versions', () => setup(({registry, run, create, decision}) => {
  const a = create({criteria: [{id: 'support', text: 'support'}, {id: 'coverage', text: 'coverage'}]}); const reviewer = run('reviewer', [a.id]);
  assert.throws(() => registry.review({artifactId: a.id, reviewerRunId: reviewer.id, result: decision(a)}), {code: 'REVIEW_COVERAGE'});
  const b = create(); const rb = run('reviewer', [b.id]);
  assert.throws(() => registry.review({artifactId: b.id, reviewerRunId: rb.id, result: decision(b, {artifactHash: '0'.repeat(64)})}), {code: 'REVIEW_SCOPE'});
  const failed = decision(b); failed.checks[0].verdict = 'FAIL';
  assert.throws(() => registry.review({artifactId: b.id, reviewerRunId: rb.id, result: failed}), {code: 'FAILED_GATE'});
  const empty = decision(b); empty.checks[0].evidence = [];
  assert.throws(() => registry.review({artifactId: b.id, reviewerRunId: rb.id, result: empty}), error => {
    assert.equal(error.code, 'REVIEW_EVIDENCE');
    assert.deepEqual(error.details, {criterionId: 'support'});
    return true;
  });
  const invented = decision(b); invented.checks[0].evidence[0].id = 'artifact:nonexistent';
  assert.throws(() => registry.review({artifactId: b.id, reviewerRunId: rb.id, result: invented}), {code: 'REVIEW_EVIDENCE'});
  assert.equal(registry.store.get('artifact', b.id).data.status, 'CANDIDATE');
}));
test('new role name sharing the producer thread cannot self-certify', () => setup(({registry, store, run, create, decision}) => {
  const a = create(); const producer = store.get('run', a.payload.producerRunId).data; const reviewer = run('reviewer', [a.id]);
  const r = store.get('run', reviewer.id); store.put('run', r.id, {...r.data, providerThreadId: producer.providerThreadId}, {expectedVersion: r.version});
  assert.throws(() => registry.review({artifactId: a.id, reviewerRunId: reviewer.id, result: decision(a)}), {code: 'SELF_CERTIFICATION'});
}));
test('artifact citation diagnostics name the exact body boundary without admitting metadata as a passage',()=>setup(({registry,run,create,decision})=>{
  const a=create({claims:[{id:'note',text:'Unresolved ancillary point',kind:'unknown',sources:[],basis:[],qualifiers:['Qualifier is visible but is not the body.'],validUntil:null}]}),r=run('reviewer',[a.id]);
  const result=decision(a);result.checks[0].evidence[0].quote=a.payload.claims[0].qualifiers[0];
  assert.throws(()=>registry.review({artifactId:a.id,reviewerRunId:r.id,result}),e=>{
    assert.equal(e.code,'REVIEW_EVIDENCE');assert.deepEqual(e.details,{criterionId:'support',evidenceKind:'artifact',evidenceId:a.id,quoteField:'payload.body'});return true;
  });
  assert.equal(registry.store.get('artifact',a.id).data.status,'CANDIDATE');
}));
test('blind replication excludes the answer by actual manifest, not a self-report flag', () => setup(({registry}) => {
  assert.throws(() => registry.registerRun({missionId: 'm', nodeId: 'n', mode: 'replicator', forbiddenArtifactIds: ['answer:original'], context: {purpose: 'replicate', artifactIds: ['answer:original'], sourceIds: [], instructionsHash: sha256('test'), producerConversationIncluded: false}}), {code: 'BLIND_CONTAMINATION'});
}));
test('pending input cannot feed material analysis; accepted input is purpose bound', () => setup(({registry, create, accept}) => {
  const a = create(), ref = {artifactId: a.id, hash: a.payloadHash, purpose: 'answer'};
  assert.throws(() => create({inputRefs: [ref]}), {code: 'UNACCEPTED_INPUT'});
  accept(a); assert.equal(create({inputRefs: [ref]}).status, 'CANDIDATE');
  assert.throws(() => registry.assertUsable(a.id, {missionId: 'm', purpose: 'causal-attribution'}), {code: 'UNACCEPTED_INPUT'});
}));
test('provisional exploration cannot be accepted or converted into factual foundation', () => setup(({create, accept}) => {
  const a = create({provisional: true}); assert.throws(() => accept(a), {code: 'PROVISIONAL'});
}));
test('inference cannot be relabeled as fact through a parent citation', () => setup(({create, accept}) => {
  const a = create({claims: [{id: 'hypothesis', text: 'May have increased', kind: 'hypothesis', sources: [], basis: [], qualifiers: ['Unconfirmed'], validUntil: null}]}); accept(a);
  assert.throws(() => create({inputRefs: [{artifactId: a.id, hash: a.payloadHash, purpose: 'answer'}], claims: [{id: 'promoted', text: 'It increased', kind: 'fact', sources: [], basis: [{artifactId: a.id, hash: a.payloadHash, claimId: 'hypothesis'}], qualifiers: [], validUntil: null}]}), {code: 'EPISTEMIC_PROMOTION'});
}));
test('retraction atomically invalidates all material descendants and keeps old versions', () => setup(({registry, store, create, accept, source}) => {
  const s = source(); const a = create({claims: [{id: 'value', text: 'Reports 12', kind: 'fact', sources: [{sourceId: s.id, hash: s.hash, quote: 'The recorded value is 12.'}], basis: [], qualifiers: [], validUntil: null}]}); accept(a);
  const b = create({inputRefs: [{artifactId: a.id, hash: a.payloadHash, purpose: 'answer'}]}); accept(b);
  const c = create({inputRefs: [{artifactId: b.id, hash: b.payloadHash, purpose: 'answer'}]}); accept(c);
  assert.deepEqual(new Set(registry.retractSource(s.id, 'Fixture correction')), new Set([a.id, b.id, c.id]));
  for (const artifact of [a, b, c]) assert.throws(() => registry.assertUsable(artifact.id, {missionId: 'm', purpose: 'answer'}), {code: 'UNACCEPTED_INPUT'});
  assert.equal(store.get('artifact', a.id, 1).data.status, 'CANDIDATE');
}));
test('freshness is checked at consumption, not only initial acceptance', () => setup(({registry, create, accept, source, setTime}) => {
  const s = source(), a = create({claims: [{id: 'value', text: 'Reports 12', kind: 'fact', sources: [{sourceId: s.id, hash: s.hash, quote: 'The recorded value is 12.'}], basis: [], qualifiers: [], validUntil: '2026-09-09T10:10:00.000Z'}]}); accept(a);
  setTime('2026-09-09T10:10:00.000Z'); assert.throws(() => registry.assertUsable(a.id, {missionId: 'm', purpose: 'answer'}), {code: 'STALE_CLAIM'});
}));
