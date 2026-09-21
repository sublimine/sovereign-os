import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import {join,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
import {id,sha256,canonical} from '../../factory/lib/contracts.mjs';
import {readSourceContextView} from '../../factory/lib/source-context-view.mjs';
import {inferenceRequestHash} from '../../factory/providers/instruction-profiles.mjs';
import {compactCatalogReview} from '../../factory/lib/review-codec.mjs';
import {Store} from '../../factory/lib/store.mjs';
import {Authority} from '../../factory/lib/authority.mjs';
import {ArtifactRegistry} from '../../factory/lib/artifacts.mjs';
import {getRole} from '../../factory/catalog/index.mjs';
import {FULL_ROUTE_CASES,DEVELOPMENT_FILES,DEVELOPMENT_COMMAND,DOCUMENT_URLS} from '../../reconstruction/verification/full-route-cases.mjs';
import {runFullRouteCase,fullRoutePolicy} from '../../reconstruction/verification/full-route-harness.mjs';
import {auditRouteTool,gradeDevelopmentBinding,verifiedRouteSources,routeMaterialState,compareRouteMaterial} from '../../reconstruction/verification/full-route-audit.mjs';
import {CLOSED_V2_REVISION_CASE} from '../../reconstruction/verification/closed-v2-revision-case.mjs';
import {READ_TEST_DEVELOPMENT_CASE} from '../../reconstruction/verification/read-test-development-case.mjs';
import {readTestBatchUsage} from '../../reconstruction/verification/read-test-development-audit.mjs';
const runtimeRoot=resolve(fileURLToPath(new URL('../..',import.meta.url))),spec=FULL_ROUTE_CASES[0];
function directory(t){const path=fs.mkdtempSync(join(tmpdir(),'full-route-test-'));t.after(()=>fs.rmSync(path,{recursive:true,force:true}));return path;}
const readRouteEvidence=(path,name)=>JSON.parse(fs.readFileSync(join(path,name)));

// A generic mission report intentionally does not project mutable operational
// ledgers.  The full-route fixture is different: it owns a disposable SQLite
// database and must prove its captured calls/effects against the durable
// records, not re-introduce those records through report.json.
function durableRouteEvidence(t,path,result,caseSpec,mode){
  const store=new Store(join(path,'state.sqlite'),{existingOnly:true}),authority=new Authority(store,{existingOnly:true}),registry=new ArtifactRegistry(store,authority);
  t.after(()=>store.close());
  const report=readRouteEvidence(path,'report.json');
  assert.deepEqual(report.effects,[],'Generic report must not disclose the operational effect ledger');
  assert.deepEqual(report.timeline,[],'Generic report must not disclose raw journal chronology');
  assert.equal(report.metrics.integrity,'NOT_ATTESTED','Generic report must not claim unattested operational metrics');
  assert.equal(result.metrics.integrity,'NOT_ATTESTED','Harness result must retain the report telemetry boundary');

  const missionRecord=store.get('mission',result.missionId),mission=missionRecord?.data;
  assert.equal(mission?.id,result.missionId,'Durable mission identity');
  assert.equal(mission.intent,caseSpec.request,'Durable mission preserves the complete request');
  assert.equal(mission.status,result.missionStatus,'Durable and captured lifecycle agree');
  assert.deepEqual(store.verifyJournal(),result.journal,'Captured journal head is the verified durable journal head');

  const effects=registry.operationalEffects(result.missionId).map(summary=>{
    const record=store.get('effect',summary.id,summary.version),effect=record?.data;
    assert.equal(record?.hash,summary.hash,'Operational inventory is bound to its exact durable effect head');
    assert.deepEqual({id:effect?.id??record?.id,tool:effect?.tool,state:effect?.state,principalId:effect?.principalId},
      {id:summary.id,tool:summary.tool,state:summary.state,principalId:summary.principalId},'Operational inventory differs from durable effect');
    assert.equal(effect.missionId,result.missionId,'Effect belongs to this exact mission');
    let receiptHash=null;
    if(['SUCCEEDED','FAILED'].includes(effect.state)){
      const receipt=registry.verifiedToolReceipt(effect.receipt);
      assert.equal(receipt.id,record.id,'Verified receipt is bound to its exact effect');
      let preparedVersion=null,dispatchedVersion=null;
      for(let version=1;version<=record.version;version++){
        const historical=store.get('effect',record.id,version)?.data;
        if(historical?.state==='PREPARED')preparedVersion??=version;
        if(historical?.state==='DISPATCHED')dispatchedVersion??=version;
      }
      const preparedSequence=registry.committedSequence('effect',record.id,preparedVersion),
        dispatchedSequence=registry.committedSequence('effect',record.id,dispatchedVersion),finalSequence=registry.committedSequence('effect',record.id,record.version);
      assert.ok(Number.isSafeInteger(preparedSequence)&&Number.isSafeInteger(dispatchedSequence)&&Number.isSafeInteger(finalSequence)
        &&preparedSequence<dispatchedSequence&&dispatchedSequence<finalSequence,'Effect preparation, dispatch and final receipt are not durable chronological evidence');
      receiptHash=sha256(effect.receipt);
    }else assert.equal(effect.receipt,undefined,'Unfinished effect cannot carry a completed receipt');
    return {id:record.id,principalId:effect.principalId,tool:effect.tool,argsHash:effect.argsHash,state:effect.state,receiptHash};
  });
  const scopedEffects=effects.every(effect=>caseSpec.allowedTools.includes(effect.tool))
    &&effects.every(effect=>['SUCCEEDED','FAILED'].includes(effect.state));
  assert.equal(scopedEffects,true,'Every durable effect is allowed and has a final outcome');

  const runs=store.list('run').filter(record=>record.data.missionId===result.missionId),requests=store.list('inference-request')
    .filter(record=>record.data.missionId===result.missionId),key=({runId,requestHash})=>canonical([runId,requestHash]);
  const expectedCalls=new Map(result.calls.map(call=>[key(call),call]));
  assert.equal(expectedCalls.size,result.calls.length,'Captured calls have unique durable identities');
  assert.equal(requests.length,result.calls.length,'Every captured provider call has one retained prospective request');
  const requestByCall=new Map(requests.map(record=>[key(record.data),record]));
  assert.equal(requestByCall.size,requests.length,'Retained prospective requests have unique actor/hash identities');
  assert.deepEqual([...requestByCall.keys()].sort(),[...expectedCalls.keys()].sort(),'No hidden or uncaptured provider request remains');
  const declaredRequests=runs.flatMap(record=>(record.data.requests??[]).map(request=>key({runId:record.id,requestHash:request.requestHash}))),
    completedReceipts=runs.flatMap(record=>(record.data.inferenceReceipts??[]).map(receipt=>key({runId:record.id,requestHash:receipt.contextHash})));
  assert.deepEqual([...declaredRequests].sort(),[...expectedCalls.keys()].sort(),'Run request histories exactly match captured calls');
  assert.deepEqual([...completedReceipts].sort(),[...expectedCalls.keys()].sort(),'Run completion histories exactly match captured calls');

  const threads=new Set();
  for(const [index,call] of result.calls.entries()){
    assert.equal(call.index,index,'Call capture index is contiguous');
    assert.deepEqual(readRouteEvidence(path,`call-${index}.json`),call,'Call capture differs from returned call record');
    const requestCapture=readRouteEvidence(path,`request-${index}.json`),response=readRouteEvidence(path,`response-${index}.json`);
    assert.equal(call.error,null,'Successful route cannot hide a failed provider call');assert.ok(call.receipt,'Successful route requires a captured receipt');
    assert.equal(requestCapture.runId,call.runId);assert.equal(requestCapture.nodeId,call.nodeId);assert.equal(requestCapture.mode,call.mode);
    assert.equal(requestCapture.requestHash,call.requestHash);assert.equal(inferenceRequestHash(requestCapture.request),call.requestHash,
      'Captured request bytes do not match its declared request hash');
    assert.deepEqual(response.receipt,call.receipt,'Captured provider receipt differs from returned call receipt');
    const request=requestByCall.get(key(call)),runRecord=store.get('run',call.runId),run=runRecord?.data;
    assert.equal(request?.version,1,'Prospective request is immutable');assert.equal(request?.id,`inference-request:${sha256([call.runId,call.requestHash])}`);
    assert.equal(request?.data.schema,'sovereign.inference-request.v1');assert.equal(request?.data.retention,'BEFORE_DISPATCH');
    assert.equal(request?.data.runId,call.runId);assert.equal(request?.data.missionId,result.missionId);assert.equal(request?.data.requestHash,call.requestHash);
    assert.deepEqual(JSON.parse(request.data.requestJson),requestCapture.request,'Retained request bytes differ from the captured request');
    assert.equal(run?.missionId,result.missionId);assert.equal(run?.nodeId,call.nodeId);assert.equal(run?.mode,call.mode);assert.equal(run?.expectedRequestHash,null);
    assert.equal(run.requests.filter(item=>item.requestHash===call.requestHash).length,1,'Run has no unique pending-request history');
    const receipts=run.inferenceReceipts.filter(receipt=>receipt.contextHash===call.requestHash);
    assert.equal(receipts.length,1,'Run has no unique completed receipt for captured request');assert.deepEqual(receipts[0],call.receipt);
    assert.equal(threads.has(call.receipt.threadId),false,'Distinct captured calls cannot reuse a provider thread');threads.add(call.receipt.threadId);
    let pendingVersion=null,completionVersion=null;
    for(let version=1;version<=runRecord.version;version++){
      const historical=store.get('run',call.runId,version)?.data;
      if(historical?.requests?.some(item=>item.requestHash===call.requestHash))pendingVersion??=version;
      if(historical?.inferenceReceipts?.some(receipt=>receipt.contextHash===call.requestHash))completionVersion??=version;
    }
    const pendingSequence=registry.committedSequence('run',call.runId,pendingVersion),requestSequence=registry.committedSequence('inference-request',request.id,1),
      completionSequence=registry.committedSequence('run',call.runId,completionVersion);
    assert.ok(Number.isSafeInteger(pendingSequence)&&Number.isSafeInteger(requestSequence)&&Number.isSafeInteger(completionSequence)
      &&pendingSequence<requestSequence&&requestSequence<completionSequence,'Pending run, retained request and completion are not durable chronological evidence');
  }

  const finalRecord=store.get('artifact',mission.finalArtifactId),final=finalRecord?.data;
  assert.equal(final?.id,mission.finalArtifactId,'Completed mission has its exact durable final artifact');
  registry.assertUsable(final.id,{missionId:result.missionId,purpose:final.payload.purpose});
  const planRecord=store.get('plan',result.missionId),plan=planRecord?.data,entry=store.get('closed-entry',result.missionId)?.data;
  if(plan){
    assert.equal(plan.intent,caseSpec.request);assert.equal(plan.intentHash,sha256(caseSpec.request));
    const acceptedPlan=registry.assertUsable(plan.acceptedPlanArtifactId,{missionId:result.missionId,purpose:'plan'});
    assert.deepEqual(JSON.parse(acceptedPlan.payload.body),plan.plan,'Installed plan differs from its independently accepted durable artifact');
  }
  if(mode==='planned'||mode==='adaptive-v3-planned'){
    assert.equal(entry,undefined,'A planned route cannot synthesize a closed-entry result');assert.ok(plan,'Planned route requires an accepted durable plan');
  }else if(entry?.status==='ACCEPTED'){
    assert.equal(plan,undefined,'Accepted closed entry cannot also install a plan');assert.equal(entry.artifactId,mission.finalArtifactId);
    registry.assertUsable(entry.artifactId,{missionId:result.missionId,purpose:final.payload.purpose});
  }else{
    assert.equal(entry?.status,'FALLBACK','Adaptive route must durably record a closed acceptance or an explicit fallback');assert.ok(plan,'Closed-entry fallback requires the ordinary accepted plan');
  }
  const controllerExecutions=store.list('worker-config').filter(record=>{
    const run=store.get('run',record.id)?.data;return run?.missionId===result.missionId&&record.data.controllerContract;
  }).map(record=>({runId:record.id,roleIds:record.data.roleIds,binding:record.data.controllerContract}));
  if(entry?.controllerContract){
    const contract=store.get('closed-entry-contract',result.missionId)?.data,controller=controllerExecutions.find(item=>item.runId===entry.runId);
    assert.deepEqual(controller?.binding,contract,'Controller execution must remain bound to the exact durable controller contract');
  }
  return {mission,effects,entry,plan,controllerExecutions,scopedEffects,fullCallAccounting:true,routing:true};
}

function assertDurableRouteControls(t,path,result,caseSpec,mode){
  const evidence=durableRouteEvidence(t,path,result,caseSpec,mode);
  for(const [name,passed] of Object.entries(result.checks))if(!['routing','scopedEffects','fullCallAccounting'].includes(name))
    assert.equal(passed,true,`Harness control ${name} must still pass`);
  assert.equal(evidence.routing,true,'Durable route evidence must satisfy routing control');
  assert.equal(evidence.scopedEffects,true,'Durable effect evidence must satisfy scope/finality control');
  assert.equal(evidence.fullCallAccounting,true,'Durable request/receipt evidence must satisfy full call accounting');
  return evidence;
}
function model({caseSpec=spec,body=JSON.stringify(caseSpec.expected),mutateReceipt,throwCode,onInput}={}){return ()=>({async generate(input){
  onInput?.(input);if(throwCode)throw Object.assign(Error('SIMULATED provider failure'),{code:throwCode});
  const context=readSourceContextView(input.input),task=JSON.parse(context.task);let value;
  assert.equal(context.missionIntent,caseSpec.request);assert(!Object.hasOwn(task,'expected'));
  if(task.entryMode)value={action:'answer',body,reason:'SIMULATED closed fixture, not semantic judgment.'};
  else if(Object.hasOwn(input.schema.properties,'requirements'))value={
    requirements:[{id:'r1',text:caseSpec.request,requestQuote:caseSpec.request,criteria:[{id:'correct',text:'Every original transformation obligation and exact JSON result.'}]}],
    nodes:[{id:'deliver',title:'Exact transformation',purpose:'transformation',roleIds:['omega_02'],reviewerRoleIds:['omega_03'],requirementIds:['r1'],dependencies:[],
      method:{id:'last-map',rationale:'SIMULATED routing fixture.',alternatives:['Reconstruct surviving rows independently.']},instructions:caseSpec.request,
      outputKind:'delivery',criteria:[],tools:[],requiredEffects:[],specialist:null}],finalNodeId:'deliver',routingRationale:'SIMULATED known fixture.'};
  else if(Object.hasOwn(input.schema.properties,'artifactHash')){
    const a=context.artifacts.find(a=>a.id===task.candidateId);
    value=compactCatalogReview({artifactHash:a.hash,purpose:a.payload.purpose,decision:'ACCEPT',
      checks:task.criteria.map(c=>({criterionId:c.id,verdict:'PASS',reason:'SIMULATED acceptance to test independent external rejection, not actual model expertise.',
        evidence:[{kind:'artifact',id:a.id,hash:a.hash,quote:a.payload.body}]})),findings:[],uncertainty:'Simulated test.'},task.observedEvidenceCatalog);
  }else value={action:'final',tool:'',argsJson:'',body,claims:[],method:'last-map',reason:''};
  await input.validate(value);
  let receipt={status:'completed',simulation:true,threadId:id('simulated-route'),turnId:'fixture',model:input.model,
    reasoningEffort:input.reasoningEffort,contextHash:inferenceRequestHash(input),usage:{totalTokens:1}};
  if(mutateReceipt)receipt=mutateReceipt(receipt);
  return {value,receipt};
},async close(){}});}

// This is a separately preregistered CI arm.  It is intentionally not added
// to FULL_ROUTE_CASES: the historical live runner enumerates that array and
// must never gain a V3 subscription arm merely because a fixture was added.
const ADAPTIVE_V3_TRANSFORMATION_CASE=Object.freeze({...structuredClone(spec),
  id:'orders-last-record-adaptive-v3-planned-sim',modes:['adaptive-v3-planned'],adaptiveV3Qualification:true});
function adaptiveV3PlannedModel({caseSpec=ADAPTIVE_V3_TRANSFORMATION_CASE,body=JSON.stringify(caseSpec.expected)}={}){
  let calls=0;
  return ()=>({async generate(input){
    calls++;const context=readSourceContextView(input.input),task=JSON.parse(context.task);let value;
    assert.equal(context.missionIntent,caseSpec.request);assert(!Object.hasOwn(task,'expected'));
    if(Object.hasOwn(input.schema.properties,'plan')){
      if(!task.inspectedRoleContracts)value={action:'inspect',roleIds:['omega_02','omega_03'],
        reason:'Read the complete producer and independent reviewer contracts before committing the bounded transformation plan.',plan:null};
      else{
        assert.deepEqual(task.inspectedRoleContracts.cards,['omega_02','omega_03'].map(getRole));
        value={action:'plan',roleIds:[],reason:'',plan:{
          requirements:[{id:'r1',text:caseSpec.request,requestQuote:caseSpec.request,
            criteria:[{id:'correct',text:'Every original transformation obligation and exact JSON result.'}]}],
          nodes:[{id:'deliver',title:'Exact transformation',purpose:'transformation',roleIds:['omega_02'],reviewerRoleIds:['omega_03'],
            requirementIds:['r1'],dependencies:[],method:{id:'last-map',rationale:'SIMULATED routing fixture.',
              alternatives:['Reconstruct surviving rows independently.']},instructions:caseSpec.request,outputKind:'delivery',
            criteria:[],tools:[],requiredEffects:[],specialist:null}],finalNodeId:'deliver',
          routingRationale:'SIMULATED known fixture under an explicitly signed adaptive-v3 planned route.'}};
      }
    }else if(Object.hasOwn(input.schema.properties,'artifactHash')){
      const artifact=context.artifacts.find(item=>item.id===task.candidateId);assert.ok(artifact);
      value=compactCatalogReview({artifactHash:artifact.hash,purpose:artifact.payload.purpose,decision:'ACCEPT',
        checks:task.criteria.map(criterion=>({criterionId:criterion.id,verdict:'PASS',
          reason:'SIMULATED acceptance used only to exercise independent V3 route custody.',
          evidence:[{kind:'artifact',id:artifact.id,hash:artifact.hash,quote:artifact.payload.body}]})),
        findings:[],uncertainty:'Simulated test; external deterministic oracle remains independent.'},task.observedEvidenceCatalog);
    }else value={action:'final',tool:'',argsJson:'',body,claims:[],method:'last-map',reason:''};
    await input.validate(value);
    return {value,receipt:{status:'completed',simulation:true,threadId:`sim-v3-route-${calls}`,turnId:`sim-v3-route-turn-${calls}`,
      model:input.model,reasoningEffort:input.reasoningEffort,contextHash:inferenceRequestHash(input),usage:{totalTokens:1}}};
  },async close(){}});
}
for(const mode of ['adaptive','planned'])test('SIMULATED prospective v2 revision '+mode+' preserves complete intent, lineage and no-replay without live qualification',async t=>{
  const path=directory(t),caseSpec=CLOSED_V2_REVISION_CASE,result=await runFullRouteCase({runtimeRoot,directory:path,spec:caseSpec,mode,providerFactory:model({caseSpec})});
  const evidence=assertDurableRouteControls(t,path,result,caseSpec,mode);
  assert.equal(result.passed,false);assert.equal(result.actualSubscription,false);
  assert.equal(result.calls.length,mode==='adaptive'?2:4);assert.equal(result.checks.noReplay,true);
  assert.equal(evidence.mission.intent,caseSpec.request);
  if(mode==='adaptive'){
    assert.equal(evidence.entry.controllerContract,'closed-response-production-v1');assert.deepEqual(evidence.entry.roleIds,[]);
    assert.equal(evidence.controllerExecutions.length,1);assert.equal(evidence.controllerExecutions[0].binding.origin,'trusted-controller-contract');
    assert.equal(evidence.entry.criteria.length,7);
  }else assert.ok(evidence.plan);
});
test('v2 qualification selection is opt-in and cannot be applied to sources, effects or an unknown entry contract',()=>{
  const caseSpec=CLOSED_V2_REVISION_CASE;
  assert.equal(fullRoutePolicy(caseSpec,'adaptive').entryMode,'closed-response-v2');assert.equal(fullRoutePolicy(caseSpec,'planned').entryMode,'planned');
  assert.equal(fullRoutePolicy(spec,'adaptive').entryMode,undefined);
  for(const change of [{closedEntryVersion:'invented'},{family:'sources'},{allowedTools:['workspace.write']}])
    assert.throws(()=>fullRoutePolicy({...caseSpec,...change},'adaptive'),{code:'EXPERIMENT_BOUNDARY'});
  const direct=fullRoutePolicy(caseSpec,'adaptive'),planned=fullRoutePolicy(caseSpec,'planned');delete direct.entryMode;delete planned.entryMode;
  assert.deepEqual(direct,planned);
});
for(const mode of spec.modes)test(`SIMULATED ${mode} full-route harness completes, independently grades, checks every lineage gate and refuses live qualification`,async t=>{
  const path=directory(t),result=await runFullRouteCase({runtimeRoot,directory:path,spec,mode,providerFactory:model()});
  assertDurableRouteControls(t,path,result,spec,mode);assert.equal(result.passed,false);assert.equal(result.actualSubscription,false);
  assert.equal(result.calls.length,mode==='adaptive'?2:4);assert.equal(result.checks.noReplay,true);
  const lineage=JSON.parse(fs.readFileSync(join(path,'lineage.json')));
  assert.equal(lineage.length,mode==='adaptive'?1:2);assert(lineage.every(a=>a.producerRunId!==a.reviewerRunId));
  const reentry=JSON.parse(fs.readFileSync(join(path,'reentry.json')));assert.equal(reentry.before.material,reentry.after.material);
  assert.notDeepEqual(reentry.before.journal,reentry.after.journal,'Honest ownership/validation events must remain, not a false journal-unchanged assertion');
});
test('SIMULATED adaptive-v3 planned arm binds Terra/high, signed routing, inspected planning, independent review and no-inference re-entry',async t=>{
  const path=directory(t),policy=fullRoutePolicy(ADAPTIVE_V3_TRANSFORMATION_CASE,'adaptive-v3-planned');
  assert.deepEqual({preset:policy.preset,model:policy.model,reasoningEffort:policy.reasoningEffort,entryMode:policy.entryMode},
    {preset:'adaptive-v3',model:'gpt-5.6-terra',reasoningEffort:'high',entryMode:'planned'});
  assert.throws(()=>fullRoutePolicy({...ADAPTIVE_V3_TRANSFORMATION_CASE,adaptiveV3Qualification:false},'adaptive-v3-planned'),
    {code:'EXPERIMENT_BOUNDARY'});
  assert.throws(()=>fullRoutePolicy({...ADAPTIVE_V3_TRANSFORMATION_CASE,closedEntryVersion:'closed-response-v2'},'adaptive-v3-planned'),
    {code:'EXPERIMENT_BOUNDARY'});
  const result=await runFullRouteCase({runtimeRoot,directory:path,spec:ADAPTIVE_V3_TRANSFORMATION_CASE,
    mode:'adaptive-v3-planned',providerFactory:adaptiveV3PlannedModel()});
  assertDurableRouteControls(t,path,result,ADAPTIVE_V3_TRANSFORMATION_CASE,'adaptive-v3-planned');assert.equal(result.passed,false);
  assert.equal(result.actualSubscription,false);assert.equal(result.calls.length,5);
  assert.equal(result.checks.adaptiveV3,true);assert.equal(result.checks.routing,true);assert.equal(result.checks.noReplay,true);
  assert.equal(result.entryStatus,null);assert.equal(result.firstEntryDecision,null);
  for(const checkpoint of [result.adaptiveV3.initial,result.adaptiveV3.beforeReentry,result.adaptiveV3.afterReentry])
    assert.equal(checkpoint.passed,true,JSON.stringify(checkpoint));
  assert.equal(result.adaptiveV3.ciOnly,true);assert.equal(result.adaptiveV3.subscriptionQualification,false);
  const reentry=JSON.parse(fs.readFileSync(join(path,'reentry.json')));
  assert.equal(reentry.restart.mode,'fresh-engine-validation-only-v1');assert.equal(reentry.restart.freshInstance,true);
  assert.equal(reentry.restart.freshStore,true);assert.equal(reentry.restart.freshLedger,true);assert.equal(reentry.restart.freshBroker,true);
  assert.equal(reentry.restart.executionRunnerPresent,false);assert.deepEqual(reentry.restart.guards.blocked,[]);
  assert.equal(reentry.journal.engine.released.version,reentry.journal.engine.acquired.version+1);
  const report=JSON.parse(fs.readFileSync(join(path,'report.json')));
  assert.equal(report.adaptiveV3.selectedEntryMode,'planned');assert.equal(report.adaptiveV3.originRecord,null);
  assert.equal(report.adaptiveV3.deterministicCertificationRecord,null);assert.ok(report.plan);
  const lineage=JSON.parse(fs.readFileSync(join(path,'lineage.json')));
  assert.equal(lineage.length,2);assert(lineage.every(row=>row.producerRunId!==row.reviewerRunId));
});
test('an accepted wrong product stays accepted in mission history but fails the external qualification, with no repair or extra vote',async t=>{
  const result=await runFullRouteCase({runtimeRoot,directory:directory(t),spec,mode:'adaptive',providerFactory:model({body:'[]'})});
  assert.equal(result.missionStatus,'COMPLETED');assert.equal(result.checks.externalOracle,false);assert.equal(result.passed,false);
  assert.equal(result.calls.length,2);assert.equal(result.checks.noReplay,true);
});
for(const mode of ['adaptive','planned'])test(`SIMULATED ${mode} duplicate JSON acceptance remains in history but fails external qualification`,async t=>{
  const path=directory(t),caseSpec=CLOSED_V2_REVISION_CASE,body='{"total":999,'+JSON.stringify(caseSpec.expected).slice(1);
  const result=await runFullRouteCase({runtimeRoot,directory:path,spec:caseSpec,mode,providerFactory:model({caseSpec,body})});
  assert.equal(result.missionStatus,'COMPLETED','Simulated judge deliberately approves this bad candidate');
  assert.deepEqual(result.external,{passed:false,reason:'BODY_DUPLICATE_KEYS'});
  assert.equal(result.structuralPassed,false);assert.equal(result.passed,false);
  assert.equal(result.calls.length,mode==='adaptive'?2:4);assert.equal(result.checks.noReplay,true);
  const report=JSON.parse(fs.readFileSync(join(path,'report.json')));
  assert.equal(report.final.payload.body,body,'No repair or rewriting the accepted candidate');
  assert.equal(result.scope.startsWith('One operator-authored case/arm;'),true);
});
test('receipt classification downgrade is retained raw and cannot qualify a simulated call as real',async t=>{
  const path=directory(t),result=await runFullRouteCase({runtimeRoot,directory:path,spec,mode:'adaptive',providerFactory:model({mutateReceipt:r=>({...r,simulation:false})})});
  assert.equal(result.passed,false);assert.equal(result.calls.length,1);assert.equal(result.calls[0].error.code,'EXPERIMENT_BOUNDARY');
  assert.equal(JSON.parse(fs.readFileSync(join(path,'response-0.json'))).receipt.simulation,false);
});
test('quota retains original request and failed call without replay or response fabrication',async t=>{
  const path=directory(t),result=await runFullRouteCase({runtimeRoot,directory:path,spec,mode:'adaptive',providerFactory:model({throwCode:'QUOTA'})});
  assert.equal(result.passed,false);assert.equal(result.calls.length,1);assert.equal(result.calls[0].error.code,'QUOTA');
  assert.equal(result.missionStatus,'WAITING_QUOTA');assert(!fs.existsSync(join(path,'response-0.json')));
});
test('prospective inference ceiling blocks before a second provider and does not waive independent review',async t=>{
  let count=0;const result=await runFullRouteCase({runtimeRoot,directory:directory(t),spec:{...spec,maxCalls:1},mode:'adaptive',providerFactory:model({onInput:()=>count++})});
  assert.equal(count,1);assert.equal(result.passed,false);assert.notEqual(result.missionStatus,'COMPLETED');
});
for(const reason of ['freeze','interruption'])test(`${reason} blocks before provider construction`,async t=>{
  let count=0;const controller=new AbortController();if(reason==='interruption')controller.abort();
  const result=await runFullRouteCase({runtimeRoot,directory:directory(t),spec,mode:'adaptive',signal:controller.signal,
    frozen:()=>reason!=='freeze',providerFactory:()=>{count++;throw Error('Must not construct');}});
  assert.equal(count,0);assert.equal(result.passed,false);assert.equal(result.calls.length,0);
});
test('read-test qualification keeps the exact development mandate, oracle scope and bounded policy without mutating prior arms',()=>{
  const prior=FULL_ROUTE_CASES.find(s=>s.family==='development'),current=READ_TEST_DEVELOPMENT_CASE;
  assert.equal(current.request,prior.request);assert.deepEqual(current.allowedTools,prior.allowedTools);
  assert.equal(current.maxCalls,14);assert.equal(prior.maxCalls,18);assert.equal(prior.producerBatch,undefined);
  const selected=fullRoutePolicy(current,'adaptive'),baseline=fullRoutePolicy(prior,'adaptive');
  assert.equal(selected.producerBatch,'read-test-v1');delete selected.producerBatch;assert.deepEqual(selected,baseline);
  for(const change of [{producerBatch:'unknown'},{producerBatch:null},{family:'sources'},{family:'transformation'}])
    assert.throws(()=>fullRoutePolicy({...current,...change},'adaptive'),{code:'EXPERIMENT_BOUNDARY'});
});
test('paired policy keeps the model, complete cards, transport, tools, correction limits and concurrency identical',()=>{
  const adaptive=fullRoutePolicy(spec,'adaptive'),planned=fullRoutePolicy(spec,'planned');delete planned.entryMode;
  assert.deepEqual(planned,adaptive);assert.equal(adaptive.maxPlanAttempts,2);assert.equal(adaptive.maxNodeAttempts,2);
  assert.throws(()=>fullRoutePolicy(spec,'invented'),{code:'EXPERIMENT_BOUNDARY'});
});
test('tool scope allows only explicitly requested URLs, root, files and exact command',()=>{
  const sources=FULL_ROUTE_CASES[1],development=FULL_ROUTE_CASES[2];
  for(const url of Object.values(DOCUMENT_URLS))assert.doesNotThrow(()=>auditRouteTool(sources,'source.fetch',{url}));
  for(const url of ['http://localhost/','https://www.sqlite.org/','https://www.postgresql.org/docs/18/queries-select-lists.html'])
    assert.throws(()=>auditRouteTool(sources,'source.fetch',{url}),{code:'ROUTE_AUDIT'});
  assert.doesNotThrow(()=>auditRouteTool(development,'execution.run',{argv:DEVELOPMENT_COMMAND,cwd:'.'}));
  for(const input of [['source.fetch',{url:DOCUMENT_URLS.sqlite}],['workspace.write',{path:'../escape'}],['workspace.read',{path:'.env'}],
    ['workspace.list',{path:'nested'}],['execution.run',{argv:['node','--eval','process.exit(0)'],cwd:'.'}]])
    assert.throws(()=>auditRouteTool(development,...input),{code:'ROUTE_AUDIT'});
});
test('development binding rejects missing obligations, extra files, other commands, different snapshots and forged textual success',()=>{
  const manifest=DEVELOPMENT_FILES.map(path=>({type:'file',path,bytes:1,sha256:sha256('x')})),snapshot={manifest,hash:sha256(manifest)};
  const lineage=[{requiredEffects:[...DEVELOPMENT_FILES.map(path=>({type:'file',path})),
    {type:'execution',path:'.',expectedExit:0,command:canonical(DEVELOPMENT_COMMAND)}]}];
  const execution={manifest,snapshotHash:snapshot.hash};
  assert(Object.values(gradeDevelopmentBinding(snapshot,lineage,execution)).every(Boolean));
  assert.equal(gradeDevelopmentBinding(snapshot,[],execution).frozenFiles,false);
  assert.equal(gradeDevelopmentBinding(snapshot,[{requiredEffects:lineage[0].requiredEffects.slice(0,3)}],execution).frozenExecution,false);
  assert.equal(gradeDevelopmentBinding({...snapshot,manifest:[...manifest,{type:'directory',path:'extra'}]},lineage,execution).exactFiles,false);
  assert.equal(gradeDevelopmentBinding(snapshot,lineage,{...execution,snapshotHash:sha256('other')}).sameSnapshot,false);
});
test('execution obligation compares parsed argv, accepting JSON whitespace but rejecting wrong arguments and malformed JSON',()=>{
  const snapshot={manifest:[],hash:sha256([])},execution={manifest:[],snapshotHash:snapshot.hash};
  const grade=command=>gradeDevelopmentBinding(snapshot,[{requiredEffects:[{type:'execution',path:'.',expectedExit:0,command}]}],execution).frozenExecution;
  assert.equal(grade(JSON.stringify(DEVELOPMENT_COMMAND,null,2)),true);
  assert.equal(grade('["node", "--test", "merge-windows.test.mjs"]'),true);
  assert.equal(grade('["node","--test"]'),false);assert.equal(grade('{bad json'),false);
});
test('SYNTHETIC source fixture binds actual receipt lookup, primary URL, raw body and current acquisition time; none is a live fetch',()=>{
  const startedAt='2026-09-13T00:00:00.000Z',raw='SYNTHETIC raw content';
  const result={content:raw,sha256:sha256(raw),finalUrl:DOCUMENT_URLS.sqlite,status:200,retrievedAt:startedAt,httpTrace:{complete:true,hops:[{}]}};
  const receipt={missionId:'m',tool:'source.fetch',status:'SUCCEEDED',startedAt,completedAt:startedAt,result};
  const source={id:'source:fixture',missionId:'m',receiptId:'fixture',receiptHash:sha256(receipt),status:'ADMITTED',revokedAt:null,
    hash:sha256(raw),raw,url:result.finalUrl,httpStatus:200,retrievedAt:startedAt};
  let observed=0;const engine={store:{list:()=>[{data:source}],get:()=>({data:{receipt}})},registry:{verifiedToolReceipt:r=>{observed++;assert.equal(r,receipt);return r;}}};
  assert.equal(verifiedRouteSources(engine,'m',startedAt).length,1);assert.equal(observed,1);
  for(const mutation of [{raw:'changed'},{url:'https://wrong.example/'},{retrievedAt:'2026-09-12T00:00:00.000Z'},{receiptHash:sha256('wrong')},{status:'REVOKED'}]){
    const changed={...source,...mutation};assert.throws(()=>verifiedRouteSources({...engine,store:{...engine.store,list:()=>[{data:changed}]}},'m',startedAt),{code:'ROUTE_AUDIT'});
  }
});

for(const readTest of [false,true])test(`NATIVE full development path (${readTest?'read-test-v1':'baseline'}): SIMULATED model, own test, independent retest, external oracle and re-entry`,async t=>{
  const development=readTest?READ_TEST_DEVELOPMENT_CASE:FULL_ROUTE_CASES[2],path=directory(t);
  const code=`export function coalesceRanges(ranges){
    if(!Array.isArray(ranges))throw new TypeError();const copy=[];
    for(const pair of ranges){if(!Array.isArray(pair)||pair.length!==2||![...pair].every(Number.isSafeInteger))throw new TypeError();
      if(pair[0]>pair[1])throw new RangeError();copy.push(pair.map(n=>n===0?0:n));}
    copy.sort((a,b)=>a[0]<b[0]?-1:a[0]>b[0]?1:0);const out=[];
    for(const pair of copy){const last=out.at(-1);if(!last||BigInt(pair[0])>BigInt(last[1])+1n)out.push(pair);
      else if(pair[1]>last[1])last[1]=pair[1];}return out;
  }`;
  const files={'merge-windows.mjs':code,'merge-windows.test.mjs':`import test from 'node:test';import assert from 'node:assert/strict';import {coalesceRanges} from './merge-windows.mjs';test('SYNTHETIC minimal fixture, not sufficient user coverage',()=>assert.deepEqual(coalesceRanges([[1,2],[3,4]]),[[1,4]]));`,
    'README.md':'SYNTHETIC harness fixture. This README does not satisfy real user documentation. Semantic reviews are simulated; never qualify live work.'};
  let step=0;const providerFactory=()=>({async generate(input){
    const context=readSourceContextView(input.input),task=JSON.parse(context.task);let value;
    assert.equal(context.missionIntent,development.request);
    if(task.entryMode)value={action:'plan',body:'',reason:'Actual files and execution need the full workflow.'};
    else if(Object.hasOwn(input.schema.properties,'requirements'))value={
      requirements:[{id:'r1',text:development.request,requestQuote:development.request,criteria:[{id:'correct',text:'All requested code, files and independent tests.'}]}],
      nodes:[{id:'deliver',title:'Development fixture',purpose:'development',roleIds:['omega_02'],reviewerRoleIds:['omega_03'],requirementIds:['r1'],dependencies:[],
        method:{id:'sorted-union',rationale:'SYNTHETIC integration fixture.',alternatives:['Discrete finite-point oracle.']},instructions:development.request,
        outputKind:'delivery',criteria:[],tools:development.allowedTools,requiredEffects:[...DEVELOPMENT_FILES.map(path=>({type:'file',path,command:'',expectedExit:null})),
          {type:'execution',path:'.',command:canonical(DEVELOPMENT_COMMAND),expectedExit:0}],specialist:null}],
      finalNodeId:'deliver',routingRationale:'SYNTHETIC integration fixture.'};
    else if(Object.hasOwn(input.schema.properties,'artifactHash')){
      const a=context.artifacts.find(a=>a.id===task.candidateId),evidence=[{kind:'artifact',id:a.id,hash:a.hash,quote:a.payload.body},
        ...context.toolObservations.filter(o=>o.relation==='OWN_ACTION'&&o.status==='SUCCEEDED').map(o=>({kind:'tool',id:o.id,hash:o.hash,quote:o.quoteText}))];
      value=compactCatalogReview({artifactHash:a.hash,purpose:a.payload.purpose,decision:'ACCEPT',checks:task.criteria.map(c=>({criterionId:c.id,verdict:'PASS',
        reason:'SIMULATED semantic approval for native harness integration only.',evidence})),findings:[],uncertainty:'Simulated, not real product acceptance.'},task.observedEvidenceCatalog);
    }else{
      const base={tool:'',argsJson:'',body:'',claims:[],method:'sorted-union',reason:''};
      value=step===0?{...base,action:'batch',argsJson:JSON.stringify(Object.entries(files).map(([path,content])=>({tool:'workspace.write',args:{path,content,expectedHash:null}})))}
        :step===1?readTest?{...base,action:'batch',argsJson:JSON.stringify([...DEVELOPMENT_FILES.map(path=>({tool:'workspace.read',args:{path}})),{tool:'execution.run',args:{argv:DEVELOPMENT_COMMAND,cwd:'.'}}])}
          :{...base,action:'tool',tool:'execution.run',argsJson:JSON.stringify({argv:DEVELOPMENT_COMMAND,cwd:'.'})}
        :{...base,action:'final',body:'Synthetic delivered files for native infrastructure validation. Not semantic qualification.'};step++;
    }
    await input.validate(value);return {value,receipt:{status:'completed',simulation:true,threadId:id('simulated-development'),turnId:'fixture',
      model:input.model,reasoningEffort:input.reasoningEffort,contextHash:inferenceRequestHash(input)}};
  },async close(){}});
  const result=await runFullRouteCase({runtimeRoot,directory:path,spec:development,mode:'adaptive',providerFactory});
  const evidence=assertDurableRouteControls(t,path,result,development,'adaptive');assert.equal(result.passed,false);assert.equal(result.actualSubscription,false);
  assert.equal(result.external.content.checks,3193);assert.equal(result.external.binding.sameSnapshot,true);
  assert.equal(result.calls.length,7);assert.equal(step,3);
  const executions=evidence.effects.filter(e=>e.tool==='execution.run');
  const usageInput={calls:result.calls,effects:evidence.effects,
    loadRequest:index=>JSON.parse(fs.readFileSync(join(path,`request-${index}.json`))),
    loadResponse:index=>JSON.parse(fs.readFileSync(join(path,`response-${index}.json`)))};
  const usage=readTestBatchUsage(usageInput);assert.equal(usage.observed,readTest);
  if(readTest){
    assert.equal(usage.attempts.length,1);assert.equal(usage.attempts[0].operations.length,4);
    const target=usage.attempts[0].operations.at(-1).id;
    for(const state of ['DISPATCHED','FAILED'])assert.equal(readTestBatchUsage({...usageInput,
      effects:evidence.effects.map(e=>e.id===target?{...e,state}:e)}).observed,false);
    assert.throws(()=>readTestBatchUsage({...usageInput,effects:evidence.effects.map(e=>e.id===target?{...e,argsHash:sha256('forged')}:e)}),{code:'EXPERIMENT_BOUNDARY'});
    assert.throws(()=>readTestBatchUsage({...usageInput,loadRequest:index=>({...usageInput.loadRequest(index),requestHash:sha256('other')})}),{code:'EXPERIMENT_BOUNDARY'});
  }
  assert.equal(evidence.mission.policy.producerBatch,readTest?'read-test-v1':undefined);
  if(readTest){assert.equal(executions.some(e=>e.id.endsWith(':step:1:batch:3')),true);assert.equal(evidence.effects.length,11);}
  assert.equal(executions.length,2);assert.notEqual(executions[0].principalId,executions[1].principalId);
  const external=JSON.parse(fs.readFileSync(join(path,'external-execution.json')));assert.equal(external.simulation,false);
  assert.equal(external.isolation.scratchRemoved,true);assert.equal(external.isolation.processesTerminated,true);
  assert(fs.existsSync(join(path,'external-execution-owner.json')));assert.equal(result.checks.noReplay,true);
  const reentry=JSON.parse(fs.readFileSync(join(path,'reentry.json')));assert.equal(reentry.material.readLeases.length,3);
});

for(const action of ['workspace.read','workspace.write','execution.run'])test(`re-entry permits scoped reviewer reads but cannot hide ${action} authority or changed material records`,t=>{
  const store=new Store(':memory:'),authority=new Authority(store),registry=new ArtifactRegistry(store,authority);t.after(()=>store.close());
  const before=routeMaterialState(store);
  authority.issue({missionId:'m',principalId:'reviewer',actions:[action],resources:['workspace:m'],classification:'INTERNAL',expiresAt:new Date(Date.now()+60000).toISOString()});
  const options={missionId:'m',reviewerRunId:'reviewer'};
  if(action==='workspace.read'){
    assert.equal(compareRouteMaterial(before,routeMaterialState(store),registry,options).readLeases.length,1);
    assert.throws(()=>compareRouteMaterial(before,routeMaterialState(store),registry,{...options,reviewerRunId:'other'}),{code:'ROUTE_AUDIT'});
  }else assert.throws(()=>compareRouteMaterial(before,routeMaterialState(store),registry,options),{code:'ROUTE_AUDIT'});
  store.put('artifact','unexpected',{status:'ACCEPTED'},{expectedVersion:0});
  assert.throws(()=>compareRouteMaterial(before,routeMaterialState(store),registry,options),{code:'ROUTE_AUDIT'});
});
