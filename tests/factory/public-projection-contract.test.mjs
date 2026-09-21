import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {Store} from '../../factory/lib/store.mjs';
import {sha256} from '../../factory/lib/contracts.mjs';
import {Authority} from '../../factory/lib/authority.mjs';
import {ArtifactRegistry} from '../../factory/lib/artifacts.mjs';
import {FactoryEngine} from '../../factory/lib/engine.mjs';
import {formatMissionReport,missionReport} from '../../factory/lib/report.mjs';

function fixture(t,{onEvent=()=>{}}={}){
  const root=mkdtempSync(join(tmpdir(),'public-projection-contract-')),store=new Store(':memory:'),authority=new Authority(store),
    registry=new ArtifactRegistry(store,authority),engine=new FactoryEngine({store,authority,registry,workspaceRoot:join(root,'jobs'),onEvent});
  t.after(()=>{engine.close();rmSync(root,{recursive:true,force:true});});
  return {store,engine,registry};
}

function assertNoLeak(label,value,sentinels){
  const serialized=JSON.stringify(value);
  for(const sentinel of sentinels)assert.equal(serialized.includes(sentinel),false,`${label} leaked ${sentinel}`);
}

function readAll({store,engine},missionId,sentinels){
  const before=store.verifyJournal(),status=engine.status(missionId),standalone=missionReport(store,missionId),throughEngine=engine.report(missionId);
  assert.deepEqual(store.verifyJournal(),before,'Public readers remain read-only');
  for(const [label,value] of [['engine.status',status],['missionReport',standalone],['engine.report',throughEngine]]){
    assertNoLeak(label,value,sentinels);
    assert.ok(value?.mission&&typeof value.mission==='object',`${label} returns a public mission projection`);
  }
  for(const [label,report] of [['missionReport text',standalone],['engine.report text',throughEngine]])
    assertNoLeak(label,formatMissionReport(report),sentinels);
  return {status,standalone,throughEngine};
}

test('admitted nested policy extensions are never copied through any public mission reader',t=>{
  const f=fixture(t),missionId='mission:public-policy-extension',intent='Keep private admission metadata out of every public read surface.',
    sentinels=['PRIVATE_ADMITTED_POLICY_INFERENCE_BUDGET_EXTENSION_SENTINEL','PRIVATE_ADMITTED_POLICY_SELECTION_EXTENSION_SENTINEL'];
  // These fields are written in version one, so the admission-freeze rule
  // correctly sees no later policy drift. Public readers still must use a
  // schema/projection boundary rather than deep-cloning known policy objects.
  const policy={model:'fixture-model',reasoningEffort:'high',allowedTools:[],maxPlanAttempts:1,maxNodeAttempts:1,
    inferenceBudget:{mode:'mission-calls-v1',maxCalls:2,privateExtension:sentinels[0]}},
    selectionDefinition={model:'fixture-model',reasoningEffort:'high',allowedTools:[],maxPlanAttempts:1,maxNodeAttempts:1,
      inferenceBudget:{mode:'mission-calls-v1',maxCalls:2,privateExtension:sentinels[1]}};
  f.store.put('mission',missionId,{id:missionId,intent,intentHash:sha256(intent),policy,
    policySelection:{presetId:'fixture',definition:selectionDefinition},status:'RUNNING',pending:[],history:[],finalArtifactId:null,
    createdAt:'2026-09-20T00:00:00.000Z',updatedAt:'2026-09-20T00:00:00.000Z'},{expectedVersion:0});
  const views=readAll(f,missionId,sentinels);
  // Either a safe projection or a full quarantine is acceptable, but a raw
  // nested object is not. This makes the contract explicit without dictating
  // which safe route a reader uses for a malformed admitted policy shape.
  for(const view of Object.values(views))assert.ok(['RUNNING','UNVERIFIED'].includes(view.mission.status));
});

test('malformed mutable lifecycle records quarantine rather than becoming a public secret channel',t=>{
  const f=fixture(t),missionId='mission:public-lifecycle-extension',intent='Lifecycle control metadata is not public evidence.',
    sentinels=['PRIVATE_LIFECYCLE_STATUS_SENTINEL','PRIVATE_LIFECYCLE_PENDING_SENTINEL','PRIVATE_LIFECYCLE_HISTORY_SENTINEL'];
  const origin=f.store.put('mission',missionId,{id:missionId,intent,intentHash:sha256(intent),status:'NEW',pending:[],history:[],finalArtifactId:null,
    createdAt:'2026-09-20T00:00:00.000Z',updatedAt:'2026-09-20T00:00:00.000Z'},{expectedVersion:0});
  f.store.put('mission',missionId,{...origin.data,status:sentinels[0],
    pending:[{code:'WAITING',reason:sentinels[1],private:{sentinel:sentinels[1]}}],
    history:[{status:'RUNNING',at:'2026-09-20T00:01:00.000Z',detail:{sentinel:sentinels[2]}}],
    updatedAt:'2026-09-20T00:01:00.000Z'},{expectedVersion:origin.version});
  const {status,standalone,throughEngine}=readAll(f,missionId,sentinels);
  for(const [label,view] of [['engine.status',status],['missionReport',standalone],['engine.report',throughEngine]]){
    assert.equal(view.mission.status,'UNVERIFIED',`${label} quarantines an unrecognised mutable lifecycle state`);
    assert.deepEqual(view.mission.pending,[],`${label} withholds mutable pending payloads`);
    assert.deepEqual(view.mission.history,[],`${label} withholds mutable history payloads`);
    assert.equal(view.plan,null,`${label} withholds adjacent plan data after lifecycle quarantine`);
    assert.deepEqual(view.nodes,[],`${label} withholds adjacent node data after lifecycle quarantine`);
  }
  assert.equal(status.outcome,null);assert.equal(status.outcomeIntegrity,'UNVERIFIED');
  for(const report of [standalone,throughEngine]){
    assert.equal(report.final,null);assert.equal(report.metrics.integrity,'UNVERIFIED');
  }
});

test('an unaccepted reviewer record cannot inject a quote into a healthy nonterminal report',t=>{
  const f=fixture(t),mission=f.engine.create('Report only independently established review evidence.',{allowedTools:[]}),
    runId='run:unaccepted-public-review',reviewId='review:unaccepted-public-review',sentinel='PRIVATE_UNACCEPTED_REVIEW_QUOTE_SENTINEL';
  // The mission itself is engine-created and remains nonterminal/healthy. The
  // only hostile data are a reviewer row and a review that lack an accepted
  // plan/node/artifact path, so a broad missionId/reviewerRunId scan is not a
  // sufficient public-evidence rule.
  f.store.put('run',runId,{id:runId,missionId:mission.id,mode:'reviewer',nodeId:'review:unaccepted',
    context:{purpose:'unaccepted',artifactIds:[],sourceIds:[]},inferenceReceipts:[]},{expectedVersion:0});
  f.store.put('review',reviewId,{id:reviewId,artifactId:'artifact:unaccepted-public-review',reviewerRunId:runId,
    result:{decision:'ACCEPT',checks:[{evidence:[{quote:sentinel}]}],findings:[]}},{expectedVersion:0});
  const {standalone,throughEngine}=readAll(f,mission.id,[sentinel]);
  for(const [label,report] of [['missionReport',standalone],['engine.report',throughEngine]])
    assert.deepEqual(report.reviews,[],`${label} exposes reviews only through an accepted mission product path`);
});

test('a verified final delivery never republishes raw tool-receipt bytes or artifact extensions',t=>{
  const f=fixture(t),missionId='mission:public-artifact-view',intent='Deliver only the reviewed public body.',
    producerId='run:public-artifact-producer',reviewerId='run:public-artifact-reviewer',reviewId='review:public-artifact-view',
    artifactId='artifact:public-artifact-view',receiptId='effect:public-artifact-private-read',
    receiptSentinel='PRIVATE_ACCEPTED_WORKSPACE_READ_BYTES_SENTINEL',extensionSentinel='PRIVATE_ACCEPTED_ARTIFACT_EXTENSION_SENTINEL';
  f.store.put('mission',missionId,{id:missionId,intent,intentHash:sha256(intent),status:'COMPLETED',pending:[],history:[],finalArtifactId:artifactId},
    {expectedVersion:0});
  f.store.put('run',producerId,{id:producerId,missionId,mode:'producer',nodeId:'delivery',context:{purpose:'delivery',artifactIds:[],sourceIds:[],producerConversationIncluded:false},
    toolObservations:[],inferenceReceipts:[]},{expectedVersion:0});
  const receipt={id:receiptId,missionId,principalId:producerId,tool:'workspace.read',argsHash:sha256({path:'private.txt'}),status:'SUCCEEDED',
    startedAt:'2026-09-20T00:00:00.000Z',completedAt:'2026-09-20T00:00:01.000Z',
    result:{path:'private.txt',content:receiptSentinel,sha256:sha256(receiptSentinel)}},signed=f.engine.authority.seal('tool.receipt',receipt);
  f.store.put('effect',receiptId,{...receipt,state:'SUCCEEDED',receipt:signed},{expectedVersion:0});
  const payload={missionId,nodeId:'delivery',producerRunId:producerId,kind:'delivery',purpose:'delivery',body:'Reviewed public delivery body.',
    claims:[],inputRefs:[],toolReceipts:[signed],requiredEffects:[],criteria:[],provisional:false},payloadHash=sha256(payload);
  f.store.put('artifact',artifactId,{id:artifactId,missionId,payload,payloadHash,status:'ACCEPTED',reviews:[reviewId],reviewDependencies:[],
    privateExtension:extensionSentinel},{expectedVersion:0});
  f.store.put('run',reviewerId,{id:reviewerId,missionId,mode:'reviewer',nodeId:'review:delivery',context:{purpose:'delivery',artifactIds:[artifactId],sourceIds:[],producerConversationIncluded:false},
    toolObservations:[],inferenceReceipts:[]},{expectedVersion:0});
  f.store.put('review',reviewId,{id:reviewId,artifactId,reviewerRunId:reviewerId,
    result:{decision:'ACCEPT',artifactHash:payloadHash,purpose:'delivery',checks:[],findings:[]}},{expectedVersion:0});

  const {status,standalone,throughEngine}=readAll(f,missionId,[receiptSentinel,extensionSentinel]);
  // Ordinary historic report readers need an explicit registry capability;
  // the standalone report is therefore deliberately quarantined even though
  // the Engine-owned status/report can validate this exact delivery.
  assert.equal(standalone.final,null);
  for(const [label,value] of [['engine.status',status.outcome],['engine.report',throughEngine.final]]){
    assert.equal(value?.payload?.body,'Reviewed public delivery body.',`${label} retains the actual delivery body`);
    assert.equal(Object.hasOwn(value.payload,'toolReceipts'),false,`${label} does not label a partial body as a raw payload`);
    assert.equal(Object.hasOwn(value,'privateExtension'),false,`${label} excludes uncontracted artifact metadata`);
    assert.equal(Object.hasOwn(value.payload,'producerRunId'),false,`${label} excludes producer custody data`);
  }
});

test('public source provenance is derived only from claims on the verified delivery and never scans raw source rows',t=>{
  const f=fixture(t),missionId='mission:public-source-provenance',intent='Show only verified source anchors for the delivered result.',
    producerId='run:public-source-producer',reviewerId='run:public-source-reviewer',reviewId='review:public-source-provenance',
    artifactId='artifact:public-source-provenance',sourceId='source:public-source-provenance',
    rawSentinel='PRIVATE_DELIVERED_SOURCE_RAW_BYTES_SENTINEL',urlSentinel='https://private.example/PRIVATE_SOURCE_URL_SENTINEL',
    quoteSentinel='PRIVATE_DELIVERED_SOURCE_QUOTE_SENTINEL',orphanSentinel='PRIVATE_ORPHAN_SOURCE_ROW_SENTINEL';
  f.store.put('mission',missionId,{id:missionId,intent,intentHash:sha256(intent),status:'COMPLETED',pending:[],history:[],finalArtifactId:artifactId},
    {expectedVersion:0});
  f.store.put('run',producerId,{id:producerId,missionId,mode:'producer',nodeId:'delivery',context:{purpose:'delivery',artifactIds:[],sourceIds:[sourceId],producerConversationIncluded:false},
    toolObservations:[],inferenceReceipts:[]},{expectedVersion:0});
  const raw=`Evidence begins. ${quoteSentinel}. ${rawSentinel}`;
  const receiptId='public-source-provenance',sourceReceipt={id:receiptId,missionId,principalId:producerId,tool:'source.fetch',
    argsHash:sha256({url:urlSentinel}),status:'SUCCEEDED',startedAt:'2026-09-20T00:00:00.000Z',completedAt:'2026-09-20T00:00:01.000Z',
    result:{content:raw,sha256:sha256(raw),url:urlSentinel,finalUrl:urlSentinel,status:200,retrievedAt:'2026-09-20T00:00:01.000Z',mediaType:'text/plain'}},
    signedSourceReceipt=f.engine.authority.seal('tool.receipt',sourceReceipt);
  f.store.put('effect',receiptId,{...sourceReceipt,state:'SUCCEEDED',receipt:signedSourceReceipt},{expectedVersion:0});
  assert.equal(f.registry.ingestSource(signedSourceReceipt).id,sourceId);
  f.store.put('source','source:orphan-public-source-provenance',{id:'source:orphan-public-source-provenance',missionId,status:'ADMITTED',
    hash:sha256(orphanSentinel),raw:orphanSentinel,url:orphanSentinel},{expectedVersion:0});
  const payload={missionId,nodeId:'delivery',producerRunId:producerId,kind:'delivery',purpose:'delivery',body:'Reviewed delivery with source-backed claim.',
    claims:[{id:'claim:source',text:'A bounded factual statement.',kind:'fact',sources:[{sourceId,hash:sha256(raw),quote:quoteSentinel}],basis:[],qualifiers:[],validUntil:null}],
    inputRefs:[],toolReceipts:[],requiredEffects:[],criteria:[{id:'source-support',text:'Independently verify the acquired source support.',evaluation:'content'}],provisional:false},payloadHash=sha256(payload),
    sourceEvidence={kind:'source',id:sourceId,hash:sha256(raw),quote:quoteSentinel};
  f.store.put('artifact',artifactId,{id:artifactId,missionId,payload,payloadHash,status:'ACCEPTED',reviews:[reviewId],reviewDependencies:[sourceEvidence]},{expectedVersion:0});
  f.store.put('run',reviewerId,{id:reviewerId,missionId,mode:'reviewer',nodeId:'review:delivery',context:{purpose:'delivery',artifactIds:[artifactId],sourceIds:[sourceId],producerConversationIncluded:false},
    toolObservations:[],inferenceReceipts:[]},{expectedVersion:0});
  f.store.put('review',reviewId,{id:reviewId,artifactId,reviewerRunId:reviewerId,
    result:{decision:'ACCEPT',artifactHash:payloadHash,purpose:'delivery',checks:[{criterionId:'source-support',verdict:'PASS',evidence:[sourceEvidence],
      reason:'Fixture reviewer independently cites the exact acquired source version.'}],findings:[],uncertainty:'Fixture factual review.'}},{expectedVersion:0});

  const report=f.engine.report(missionId),serialized=JSON.stringify(report),text=formatMissionReport(report);
  assert.equal(report.sourceProvenance.integrity,'VERIFIED');
  assert.deepEqual(report.sources,[{sourceId,hash:sha256(raw)}]);
  for(const sentinel of [rawSentinel,urlSentinel,quoteSentinel,orphanSentinel]){
    assertNoLeak('verified public source provenance',report,[sentinel]);
    assert.equal(text.includes(sentinel),false,`formatted source provenance leaked ${sentinel}`);
  }
});

test('malformed planning-inspection residue cannot crash a report or disclose its payload',t=>{
  const f=fixture(t),sentinel='PRIVATE_MALFORMED_PLANNING_INSPECTION_RESIDUE_SENTINEL',
    mission=f.engine.create('Keep public reporting available when a planning-control row is malformed.',{
      allowedTools:[],planningContracts:{mode:'on-demand-v1',maxCalls:2}
    });
  // The row is deliberately neither a reservation nor a valid actor lineage.
  // A report must not parse it optimistically, turn it into an actor entry, or
  // throw and force a caller to inspect raw storage instead.
  f.store.put('planning-inspection-call',`planning-call:${sha256(mission.id)}:1`,{
    missionId:mission.id,privatePayload:sentinel
  },{expectedVersion:0});
  const {standalone,throughEngine}=readAll(f,mission.id,[sentinel]);
  for(const [label,report] of [['missionReport',standalone],['engine.report',throughEngine]]){
    assert.equal(report.planningInspection.integrity,'UNVERIFIED',`${label} fails closed on malformed reservation evidence`);
    assert.equal(report.planningInspection.budget,null,`${label} withholds an unverifiable budget`);
    assert.deepEqual(report.planningInspection.actors,[],`${label} does not turn residue into an actor view`);
  }
});

test('engine progress callbacks use the same public boundary as status and never echo pending diagnostics',t=>{
  const events=[],f=fixture(t,{onEvent:event=>events.push(event)}),sentinel='PRIVATE_PENDING_EVENT_DIAGNOSIS_SENTINEL',
    mission=f.engine.create('Project only public execution progress.',{allowedTools:[]});
  f.engine.setStatus(mission.id,'WAITING_CAPABILITY',[{code:'CAPABILITY',reason:sentinel,diagnosis:sentinel,nodeId:'node:public-progress'}]);
  // `emit` is public on the engine object for coordinator integrations. An
  // unknown event must be chronology-only rather than a generic data tunnel.
  f.engine.emit('integration.private-progress',{missionId:mission.id,privatePayload:sentinel});
  assert.equal(events.at(-2).kind,'mission.status');
  assert.deepEqual(events.at(-2).pending,[{code:'CAPABILITY',nodeId:'node:public-progress'}]);
  assert.equal(events.at(-1).kind,'ENGINE_EVENT_RECORDED');
  assertNoLeak('public engine events',events,[sentinel]);
});
