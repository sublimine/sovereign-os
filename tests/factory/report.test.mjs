import test from 'node:test';
import assert from 'node:assert/strict';
import {tmpdir} from 'node:os';
import {Store} from '../../factory/lib/store.mjs';
import {sha256,canonical} from '../../factory/lib/contracts.mjs';
import {Authority} from '../../factory/lib/authority.mjs';
import {ArtifactRegistry} from '../../factory/lib/artifacts.mjs';
import {FactoryEngine} from '../../factory/lib/engine.mjs';
import {missionReport,formatMissionReport,safeDisplay} from '../../factory/lib/report.mjs';

// Deliberately minimal historic lineage: it exercises the read boundary rather
// than a particular entry controller.  The reviewer origin is still present
// because ArtifactRegistry validates a real independent reviewer identity.
function putAcceptedLegacyDelivery(store,{missionId,artifactId,body,purpose='delivery'}={}){
  const producerId=`run:producer:${missionId}`,reviewerId=`run:reviewer:${missionId}`,reviewId=`review:${missionId}`,
    payload={missionId,nodeId:'delivery',producerRunId:producerId,kind:'delivery',purpose,body,
      claims:[],inputRefs:[],toolReceipts:[],requiredEffects:[],criteria:[],provisional:false},payloadHash=sha256(payload);
  store.put('run',producerId,{id:producerId,missionId,mode:'producer',nodeId:'delivery',context:{purpose,artifactIds:[],sourceIds:[],producerConversationIncluded:false},
    toolObservations:[],inferenceReceipts:[]},{expectedVersion:0});
  store.put('artifact',artifactId,{id:artifactId,missionId,payload,payloadHash,status:'ACCEPTED',reviews:[reviewId],reviewDependencies:[]},{expectedVersion:0});
  store.put('run',reviewerId,{id:reviewerId,missionId,mode:'reviewer',nodeId:'review:delivery',context:{purpose,artifactIds:[artifactId],sourceIds:[],producerConversationIncluded:false},
    toolObservations:[],inferenceReceipts:[]},{expectedVersion:0});
  store.put('review',reviewId,{id:reviewId,artifactId,reviewerRunId:reviewerId,
    result:{decision:'ACCEPT',artifactHash:payloadHash,purpose,checks:[],findings:[]}},{expectedVersion:0});
  return {artifactId,body,payload,payloadHash,producerId,reviewerId,reviewId};
}

test('synthetic operational rows remain read-only but are not public telemetry',()=>{
  const store=new Store(':memory:');
  try {
    const intent='Exact original request';
    store.put('mission','mission:report',{id:'mission:report',intent,intentHash:sha256(intent),status:'WAITING_QUOTA',pending:[{code:'QUOTA',reason:'Fixture quota'}],finalArtifactId:null},{expectedVersion:0});
    store.put('run','run:report',{id:'run:report',missionId:'mission:report',inferenceReceipts:[{simulation:true,usage:{inputTokens:10,outputTokens:2,totalTokens:12}}]},{expectedVersion:0});
    store.append('worker.inference.dispatched',{runId:'run:report',contextBytes:100});
    store.append('worker.inference.dispatched',{runId:'run:report',contextBytes:110,instructionBytes:20,schemaBytes:30});
    store.append('worker.inference.failed',{runId:'run:report',code:'QUOTA'});
    store.put('effect','effect:report',{missionId:'mission:report',principalId:'run:report',tool:'source.fetch',state:'FAILED',argsHash:'0'.repeat(64)},{expectedVersion:0});
    const before=store.events().length,report=missionReport(store,'mission:report'),serialized=JSON.stringify(report);
    assert.equal(store.events().length,before);
    assert.equal(report.metrics.integrity,'NOT_ATTESTED');
    assert.equal(report.metrics.operationalTelemetry,'NOT_PROJECTED');
    assert.equal(report.metrics.correctionTelemetry,'NOT_PROJECTED');
    assert.equal(report.metrics.usageTelemetry,'NOT_PROJECTED');
    assert.ok(!Object.hasOwn(report.metrics,'dispatched'));
    assert.ok(!Object.hasOwn(report.metrics,'providerUsage'));
    assert.deepEqual(report.effects,[]);assert.deepEqual(report.timeline,[]);
    for(const privateValue of ['run:report','effect:report','source.fetch'])assert.ok(!serialized.includes(privateValue),privateValue);
    assert.match(formatMissionReport(report),/Informe histórico/);
    assert.match(formatMissionReport(report),/Telemetría operativa no proyectada/);
    assert.match(formatMissionReport(report),/Pendiente \[QUOTA\]/);
    assert.doesNotMatch(formatMissionReport(report),/Fixture quota/);
    store.append('worker.inference.dispatched',{runId:'run:report',contextBytes:120});
    const interrupted=missionReport(store,'mission:report');
    assert.deepEqual(interrupted.metrics,report.metrics);
    assert.deepEqual(interrupted.effects,[]);assert.deepEqual(interrupted.timeline,[]);
    assert.doesNotMatch(formatMissionReport(interrupted),/sin resultado final registrado/);
  } finally {store.close();}
});
test('terminal display makes untrusted control sequences visible without damaging ordinary Spanish',()=>{
  const result=safeDisplay('Título: español\n\u001b]52;c;fixture\u0007\u202e');
  assert.equal(result,'Título: español\n\\u001b]52;c;fixture\\u0007\\u202e');
  assert.ok(!result.includes('\u001b'));
});
test('a report never projects a labelled legacy final without revalidating its accepted lineage',()=>{
  const store=new Store(':memory:'),authority=new Authority(store),missionId='mission:unverified-final',
    intent='Do not call a forged artifact a delivered result.',artifactId='artifact:PRIVATE_UNVERIFIED_FINAL_POINTER_SENTINEL',
    body='PRIVATE_UNVERIFIED_FINAL_BODY_SENTINEL';
  try{
    store.put('mission',missionId,{id:missionId,intent,intentHash:sha256(intent),status:'COMPLETED',pending:[],history:[],finalArtifactId:artifactId},{expectedVersion:0});
    const payload={missionId,nodeId:'delivery',producerRunId:'run:forged',kind:'delivery',purpose:'delivery',body,
      claims:[],inputRefs:[],toolReceipts:[],requiredEffects:[],criteria:[],provisional:false};
    store.put('artifact',artifactId,{id:artifactId,missionId,payload,payloadHash:sha256(payload),status:'ACCEPTED',reviews:[],reviewDependencies:[]},{expectedVersion:0});
    const before=store.verifyJournal(),report=missionReport(store,missionId),serialized=JSON.stringify(report),text=formatMissionReport(report);
    assert.deepEqual(store.verifyJournal(),before);assert.equal(report.final,null);assert.equal(report.mission.finalArtifactId,null);
    assert.equal(report.mission.deliveryIntegrity,'UNVERIFIED');assert.doesNotMatch(text,/Último artefacto ACCEPTED/);
    for(const sentinel of [artifactId,body]){assert.ok(!serialized.includes(sentinel),sentinel);assert.ok(!text.includes(sentinel),sentinel);}
    assert.ok(authority,'The persisted authority is reopened read-only by the report boundary.');
  }finally{store.close();}
});
test('legacy delivery remains quarantined until the caller supplies its trusted registry capability',()=>{
  const store=new Store(':memory:'),authority=new Authority(store,{keyId:'trusted-legacy-delivery-key',key:Buffer.alloc(32,0x31)}),
    alternateAuthority=new Authority(store,{keyId:'operator-supplied-other-key',key:Buffer.alloc(32,0x32)}),
    registry=new ArtifactRegistry(store,authority),alternateRegistry=new ArtifactRegistry(store,alternateAuthority),
    missionId='mission:legacy-capability',intent='Return the independently accepted historic delivery.',
    artifactId='artifact:PRIVATE_LEGACY_CAPABILITY_POINTER_SENTINEL',body='PRIVATE_LEGACY_CAPABILITY_BODY_SENTINEL';
  try{
    store.put('mission',missionId,{id:missionId,intent,intentHash:sha256(intent),status:'COMPLETED',pending:[],history:[],finalArtifactId:artifactId},{expectedVersion:0});
    putAcceptedLegacyDelivery(store,{missionId,artifactId,body});
    assert.equal(registry.assertUsable(artifactId,{missionId,purpose:'delivery'}).payload.body,body);
    assert.throws(()=>alternateAuthority.open(authority.seal('legacy-delivery-fixture',{id:artifactId}),'legacy-delivery-fixture'),{code:'BAD_SIGNATURE'});
    const before=store.verifyJournal(),withoutCapability=missionReport(store,missionId),withoutJson=JSON.stringify(withoutCapability),withoutText=formatMissionReport(withoutCapability);
    assert.deepEqual(store.verifyJournal(),before);assert.equal(withoutCapability.metrics.integrity,'DELIVERY_UNVERIFIED');
    assert.equal(withoutCapability.final,null);assert.equal(withoutCapability.mission.finalArtifactId,null);
    for(const sentinel of [artifactId,body]){assert.ok(!withoutJson.includes(sentinel),sentinel);assert.ok(!withoutText.includes(sentinel),sentinel);}
    const trusted=missionReport(store,missionId,{registry});
    assert.equal(trusted.final.id,artifactId);assert.equal(trusted.final.payload.body,body);
    // Historic ordinary lineages predate a signed key-binding record.  This is
    // intentionally a caller-trusted capability boundary, not a claim that
    // this report can reconstruct cryptographic authority from the old rows.
    assert.doesNotThrow(()=>alternateRegistry.assertUsable(artifactId,{missionId,purpose:'delivery'}));
    assert.equal(missionReport(store,missionId,{registry:alternateRegistry}).final.id,artifactId);
  }finally{store.close();}
});
test('ordinary report projection whitelists stable admission fields instead of cloning private control-plane extensions',()=>{
  const store=new Store(':memory:'),missionId='mission:public-whitelist',intent='Report only the defined public mission projection.',
    envelope='PRIVATE_STABLE_ADMISSION_ENVELOPE_SENTINEL',routing='PRIVATE_STABLE_ROUTING_SENTINEL';
  try{
    store.put('mission',missionId,{id:missionId,intent,intentHash:sha256(intent),status:'RUNNING',pending:[],history:[],finalArtifactId:null,
      privateEnvelope:envelope,policy:{model:'fixture',reasoningEffort:'high',allowedTools:[],maxPlanAttempts:1,maxNodeAttempts:1,
        routing:{secret:routing}},policySelection:{presetId:'fixture',definition:{model:'fixture',routingMode:routing},explicitOverrides:[]}},
      {expectedVersion:0});
    const report=missionReport(store,missionId),serialized=JSON.stringify(report),text=formatMissionReport(report);
    assert.equal(report.metrics.integrity,'NOT_ATTESTED');assert.equal(report.metrics.operationalTelemetry,'NOT_PROJECTED');
    assert.deepEqual(report.effects,[]);assert.deepEqual(report.timeline,[]);assert.ok(!Object.hasOwn(report.mission,'privateEnvelope'));
    assert.ok(!Object.hasOwn(report.mission.policy,'routing'));assert.ok(!Object.hasOwn(report.mission.policySelection.definition,'routingMode'));
    for(const sentinel of [envelope,routing]){assert.ok(!serialized.includes(sentinel),sentinel);assert.ok(!text.includes(sentinel),sentinel);}
  }finally{store.close();}
});
test('a transient non-lifecycle mission extension is an admission breach even when the current head restores itself',()=>{
  const store=new Store(':memory:'),missionId='mission:transient-admission-extension',intent='Keep historic admission fields immutable.',
    envelope='PRIVATE_TRANSIENT_ADMISSION_ENVELOPE_SENTINEL',eventSecret='PRIVATE_TRANSIENT_EVENT_PAYLOAD_SENTINEL';
  try{
    const origin={id:missionId,intent,intentHash:sha256(intent),status:'NEW',pending:[],history:[],finalArtifactId:null};
    const v1=store.put('mission',missionId,origin,{expectedVersion:0});
    const v2=store.put('mission',missionId,{...v1.data,privateEnvelope:envelope},{expectedVersion:v1.version});
    store.put('mission',missionId,{...origin,status:'RUNNING',history:[{status:'RUNNING',at:'2026-09-20T00:00:00.000Z'}]},
      {expectedVersion:v2.version});
    const event=store.append('mission.private-transient-report-fixture',{missionId,eventSecret});
    const before=store.verifyJournal(),report=missionReport(store,missionId),serialized=JSON.stringify(report),text=formatMissionReport(report);
    assert.deepEqual(store.verifyJournal(),before);assert.equal(report.metrics.integrity,'UNVERIFIED');
    assert.equal(report.mission.admissionIntegrity,'UNVERIFIED');assert.equal(report.mission.status,'UNVERIFIED');
    assert.equal(report.final,null);assert.deepEqual(report.timeline,[]);
    for(const sentinel of [envelope,eventSecret]){assert.ok(!serialized.includes(sentinel),sentinel);assert.ok(!text.includes(sentinel),sentinel);}
  }finally{store.close();}
});
test('ordinary status never exposes a revoked or nonterminal legacy final pointer',()=>{
  const store=new Store(':memory:'),authority=new Authority(store),registry=new ArtifactRegistry(store,authority),
    engine=new FactoryEngine({store,authority,registry,workspaceRoot:tmpdir()}),missionId='mission:legacy-status',intent='Do not expose a stale final pointer.',
    artifactId='artifact:legacy-status',body='PRIVATE_LEGACY_STATUS_BODY_SENTINEL';
  try{
    store.put('mission',missionId,{id:missionId,intent,intentHash:sha256(intent),status:'COMPLETED',pending:[],history:[],finalArtifactId:artifactId},{expectedVersion:0});
    putAcceptedLegacyDelivery(store,{missionId,artifactId,body});
    assert.equal(engine.status(missionId).outcome.payload.body,body);
    // Engine-owned consumers carry the exact registry capability rather than
    // reimplementing a potentially unsafe legacy report fallback.
    assert.equal(engine.report(missionId).final.payload.body,body);
    registry.invalidate([artifactId],{kind:'test-revocation'});
    const revoked=engine.status(missionId),revokedJson=JSON.stringify(revoked);
    assert.equal(revoked.outcome,null);assert.equal(revoked.outcomeIntegrity,'UNVERIFIED');
    assert.equal(revoked.mission.finalArtifactId,null);assert.equal(revoked.mission.deliveryIntegrity,'UNVERIFIED');
    assert.equal(revoked.plan,null);assert.deepEqual(revoked.nodes,[]);
    for(const sentinel of [artifactId,body])assert.ok(!revokedJson.includes(sentinel),sentinel);
    const revokedReport=missionReport(store,missionId,{registry}),revokedReportJson=JSON.stringify(revokedReport),revokedReportText=formatMissionReport(revokedReport);
    assert.equal(revokedReport.metrics.integrity,'DELIVERY_UNVERIFIED');assert.equal(revokedReport.final,null);
    assert.equal(revokedReport.mission.finalArtifactId,null);assert.deepEqual(revokedReport.nodes,[]);assert.deepEqual(revokedReport.reviews,[]);
    for(const sentinel of [artifactId,body]){assert.ok(!revokedReportJson.includes(sentinel),sentinel);assert.ok(!revokedReportText.includes(sentinel),sentinel);}
  }finally{engine.close();}
  const secondStore=new Store(':memory:'),secondAuthority=new Authority(secondStore),secondRegistry=new ArtifactRegistry(secondStore,secondAuthority),
    secondEngine=new FactoryEngine({store:secondStore,authority:secondAuthority,registry:secondRegistry,workspaceRoot:tmpdir()}),secondId='mission:legacy-nonterminal-pointer',
    secondIntent='Do not expose a pointer after cancellation.',secondArtifact='artifact:legacy-nonterminal',secondBody='PRIVATE_LEGACY_NONTERMINAL_BODY_SENTINEL';
  try{
    secondStore.put('mission',secondId,{id:secondId,intent:secondIntent,intentHash:sha256(secondIntent),status:'COMPLETED',pending:[],history:[],finalArtifactId:secondArtifact},{expectedVersion:0});
    putAcceptedLegacyDelivery(secondStore,{missionId:secondId,artifactId:secondArtifact,body:secondBody});
    assert.equal(secondEngine.status(secondId).outcome.payload.body,secondBody);
    const completed=secondStore.get('mission',secondId);
    secondStore.put('mission',secondId,{...completed.data,status:'CANCELLED',history:[{status:'CANCELLED',at:'2026-09-20T00:00:00.000Z'}]},
      {expectedVersion:completed.version});
    const cancelled=secondEngine.status(secondId),cancelledJson=JSON.stringify(cancelled);
    assert.equal(cancelled.outcome,null);assert.equal(cancelled.outcomeIntegrity,'UNVERIFIED');
    assert.equal(cancelled.mission.finalArtifactId,null);assert.equal(cancelled.mission.deliveryIntegrity,'UNVERIFIED');
    assert.equal(cancelled.plan,null);assert.deepEqual(cancelled.nodes,[]);
    for(const sentinel of [secondArtifact,secondBody])assert.ok(!cancelledJson.includes(sentinel),sentinel);
    const cancelledReport=missionReport(secondStore,secondId,{registry:secondRegistry}),cancelledReportJson=JSON.stringify(cancelledReport),cancelledReportText=formatMissionReport(cancelledReport);
    assert.equal(cancelledReport.metrics.integrity,'DELIVERY_UNVERIFIED');assert.equal(cancelledReport.final,null);
    assert.equal(cancelledReport.mission.finalArtifactId,null);assert.deepEqual(cancelledReport.nodes,[]);assert.deepEqual(cancelledReport.reviews,[]);
    for(const sentinel of [secondArtifact,secondBody]){assert.ok(!cancelledReportJson.includes(sentinel),sentinel);assert.ok(!cancelledReportText.includes(sentinel),sentinel);}
  }finally{secondEngine.close();}
});
test('correction, review and retry rows stay outside the public report without a dedicated attestation',()=>{
  const store=new Store(':memory:'),missionId='m',intent='Preserve actual correction history';
  try{
    store.put('mission',missionId,{id:missionId,intent,intentHash:sha256(intent),status:'RUNNING',pending:[],finalArtifactId:null},{expectedVersion:0});
    store.put('run','producer',{id:'producer',missionId,mode:'producer',nodeId:'product',inferenceReceipts:[{simulation:true}]},{expectedVersion:0});
    store.put('run','reviewer',{id:'reviewer',missionId,mode:'reviewer',nodeId:'review:product',inferenceReceipts:[{simulation:true}]},{expectedVersion:0});
    store.append('worker.inference.dispatched',{runId:'producer'});store.append('worker.inference.dispatched',{runId:'reviewer'});
    store.append('worker.final.correction.required',{runId:'producer'});
    store.append('worker.review.correction.required',{runId:'reviewer'});
    store.append('node.correction.required',{missionId,nodeId:'product'});
    store.append('worker.final.correction.required',{runId:'foreign'});
    store.put('review','r1',{reviewerRunId:'reviewer',result:{decision:'UNKNOWN'}},{expectedVersion:0});
    store.put('review','r2',{reviewerRunId:'reviewer',result:{decision:'ACCEPT'}},{expectedVersion:0});
    const before=store.events().length,r=missionReport(store,missionId);
    assert.equal(store.events().length,before);
    assert.equal(r.metrics.integrity,'NOT_ATTESTED');
    assert.equal(r.metrics.operationalTelemetry,'NOT_PROJECTED');
    assert.equal(r.metrics.correctionTelemetry,'NOT_PROJECTED');
    assert.ok(!Object.hasOwn(r.metrics,'correctionRequests'));
    assert.ok(!Object.hasOwn(r.metrics,'reviewDecisions'));
    assert.ok(!Object.hasOwn(r.metrics,'completed'));
    assert.deepEqual(r.reviews,[]);assert.deepEqual(r.timeline,[]);
    assert.match(formatMissionReport(r),/Telemetría operativa no proyectada/);
    assert.doesNotMatch(formatMissionReport(r),/Correcciones solicitadas/);
  }finally{store.close();}
});
test('phase and usage rows remain private even when records contain completed, failed and pending calls',()=>{
  const store=new Store(':memory:'),missionId='mission:phases',intent='Keep complete phase evidence.';
  try{
    store.put('mission',missionId,{id:missionId,intent,intentHash:sha256(intent),status:'RUNNING',pending:[],finalArtifactId:null},{expectedVersion:0});
    const actors=[['planner','producer','planning',{inputTokens:10,totalTokens:12}],['plan-judge','reviewer','review:planning',{totalTokens:0}],
      ['writer','producer','final',{inputTokens:20}],['product-judge','reviewer','review:final',null]];
    for(const [id,mode,nodeId,usage]of actors){
      store.put('run',id,{id,missionId,mode,nodeId,inferenceReceipts:usage===null?[]:[{usage,simulation:true}]},{expectedVersion:0});
      store.append('worker.inference.dispatched',{missionId,runId:id});
    }
    store.append('worker.inference.dispatched',{runId:'writer'});store.append('worker.inference.failed',{runId:'writer',code:'QUOTA'});
    const before=store.events().length,report=missionReport(store,missionId);
    assert.equal(store.events().length,before);
    assert.equal(report.metrics.integrity,'NOT_ATTESTED');
    assert.equal(report.metrics.usageTelemetry,'NOT_PROJECTED');
    assert.ok(!Object.hasOwn(report.metrics,'workerPhases'));
    assert.ok(!Object.hasOwn(report.metrics,'dispatched'));
    assert.ok(!Object.hasOwn(report.metrics,'providerUsage'));
    assert.deepEqual(report.timeline,[]);
    assert.match(formatMissionReport(report),/Telemetría operativa no proyectada/);
    assert.doesNotMatch(formatMissionReport(report),/tokens totales observados/);
  }finally{store.close();}
});

test('native retry notifications remain private operational custody evidence',()=>{
  const store=new Store(':memory:'),missionId='mission:native-retry',intent='Preserve supplied counters and unknown retry coverage';
  try{
    store.put('mission',missionId,{id:missionId,intent,intentHash:sha256(intent),status:'RUNNING',pending:[],finalArtifactId:null},{expectedVersion:0});
    for(const [id,mode,nodeId,receipts]of [['p','producer','product',[{simulation:true,usage:{inputTokens:10,outputTokens:3,totalTokens:13},usageScope:'fresh-thread-total'}]],
      ['j','reviewer','review:product',[{simulation:true,usage:{totalTokens:0},usageScope:'last-response-only'}]],['pending','producer','planning',[]]]){
      store.put('run',id,{id,missionId,mode,nodeId,inferenceReceipts:receipts},{expectedVersion:0});store.append('worker.inference.dispatched',{runId:id});
    }
    for(const runId of ['p','p','j','pending'])store.append('worker.provider.retry',{runId,code:'TRANSIENT_PROVIDER',providerCategory:'responseStreamDisconnected',httpStatusCode:null});
    // Membership must be checked by actor, even if an unrelated event names the
    // mission. The count is telemetry, not a new inference or known retry cost.
    store.append('worker.provider.retry',{missionId,runId:'foreign',code:'QUOTA'});
    store.append('worker.inference.progress',{runId:'p',agentOutputBytes:7645,usage:{totalTokens:5000}});
    const before=canonical({journal:store.verifyJournal(),rows:store.db.prepare('SELECT type,id,version,hash,json FROM records ORDER BY type,id,version').all().map(r=>({...r}))}),r=missionReport(store,missionId),serialized=JSON.stringify(r);
    assert.equal(r.metrics.integrity,'NOT_ATTESTED');
    assert.equal(r.metrics.operationalTelemetry,'NOT_PROJECTED');
    assert.equal(r.metrics.usageTelemetry,'NOT_PROJECTED');
    assert.ok(!Object.hasOwn(r.metrics,'providerUsage'));
    assert.ok(!Object.hasOwn(r.metrics,'workerPhases'));
    assert.deepEqual(r.timeline,[]);
    for(const privateValue of ['worker.provider.retry','responseStreamDisconnected','run:p'])assert.ok(!serialized.includes(privateValue),privateValue);
    const formatted=formatMissionReport(r);assert.match(formatted,/Telemetría operativa no proyectada/);
    assert.doesNotMatch(formatted,/Reintentos nativos notificados/);
    assert.equal(canonical({journal:store.verifyJournal(),rows:store.db.prepare('SELECT type,id,version,hash,json FROM records ORDER BY type,id,version').all().map(r=>({...r}))}),before);
  }finally{store.close();}
});

test('a missing retry ledger is not projected, and pre-attestation report objects still format',()=>{
  const store=new Store(':memory:'),missionId='mission:no-native-telemetry',intent='Do not invent coverage';
  try{
    store.put('mission',missionId,{id:missionId,intent,intentHash:sha256(intent),status:'NEW',pending:[],finalArtifactId:null},{expectedVersion:0});
    const r=missionReport(store,missionId);
    assert.equal(r.metrics.integrity,'NOT_ATTESTED');
    assert.equal(r.metrics.operationalTelemetry,'NOT_PROJECTED');
    assert.ok(!Object.hasOwn(r.metrics,'providerUsage'));
    assert.match(formatMissionReport(r),/Telemetría operativa no proyectada/);
    const legacy={...r,metrics:{dispatched:0,completed:0,failed:0,withoutFinalOutcome:0}};
    assert.doesNotThrow(()=>formatMissionReport(legacy));
  }finally{store.close();}
});
