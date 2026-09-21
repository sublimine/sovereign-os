// Public-message storage only; provider/model and external tools never run.
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {FactoryEngine} from '../../factory/lib/engine.mjs';
import {sha256,canonical} from '../../factory/lib/contracts.mjs';
import {composeLearningRequest} from '../../factory/lib/learning-service.mjs';
import {inferenceRequestHash} from '../../factory/providers/instruction-profiles.mjs';
import {PLAN_SCHEMA} from '../../factory/lib/plans.mjs';
import {PLANNING_MESSAGE_SCHEMA} from '../../factory/lib/planning-inspection-contract.mjs';
import {planningInspectionBudget,reservePlanningInspection} from '../../factory/lib/planning-inspection-budget.mjs';
import {inspectPlanningRoleContracts} from '../../factory/lib/plan-role-review.mjs';
import {PLANNING_RESPONSE_RETENTION,recordPlanningCleanupOrigin,recordPlanningProviderCleanup,readPlanningCleanupObservation} from '../../factory/lib/planning-response.mjs';
import * as messages from '../../factory/lib/planning-inspection-response.mjs';
import {missionReport,formatMissionReport} from '../../factory/lib/report.mjs';

const inspection=()=>({action:'inspect',roleIds:['omega_02','omega_03'],reason:'Read the complete methods and review boundaries.',plan:null});
const ref=r=>({type:r.type,id:r.id,version:r.version,hash:r.hash});
const reportFence=store=>canonical({journal:store.verifyJournal(),userVersion:store.db.prepare('PRAGMA user_version').get().user_version,
  records:store.db.prepare('SELECT type,id,version,hash,json,created_at FROM records ORDER BY type,id,version').all().map(row=>({...row}))});
const cli=new URL('../../factory/bin/sovereign.mjs',import.meta.url).pathname;
function readReport(f){
  const before=reportFence(f.e.store);let report;
  assert.doesNotThrow(()=>{report=missionReport(f.e.store,f.missionId);});
  assert.doesNotThrow(()=>JSON.parse(JSON.stringify(report)));assert.doesNotThrow(()=>formatMissionReport(report));
  assert.deepEqual(reportFence(f.e.store),before);assert.equal(f.e.store.db.isTransaction,false);return report;
}
function fixture(t){
  const dir=mkdtempSync(join(tmpdir(),'planning-messages-'));let e;
  const open=()=>{e=new FactoryEngine({databasePath:join(dir,'state.sqlite'),workspaceRoot:join(dir,'jobs')});e.workers.providerFactory=()=>assert.fail('No provider in storage test');};open();
  const mission=e.create('Produce the requested result with an independent substantive review.',{allowedTools:[],planningContracts:{mode:'on-demand-v1',maxCalls:5,maxBytes:262144}});
  const m=e.store.get('mission',mission.id);
  const run=e.workers.createRun({missionId:m.id,nodeId:'planning',mode:'producer',purpose:'plan',roleIds:['omega_04','omega_05']});
  const propose=()=>({action:'plan',roleIds:[],reason:'',plan:{requirements:[{id:'r',text:mission.intent,requestQuote:mission.intent,criteria:[{id:'exact',text:mission.intent}]}],
    nodes:[{id:'result',title:'Result',purpose:'result',roleIds:['omega_02'],reviewerRoleIds:['omega_03'],requirementIds:['r'],dependencies:[],
      method:{id:'derive',rationale:'Requested bounded work.',alternatives:['Independent reconstruction after diagnosis.']},instructions:mission.intent,
      outputKind:'delivery',criteria:[],requiredEffects:[],tools:[],specialist:null}],finalNodeId:'result',routingRationale:'Separate substantive review.'}});
  const reserve=(extra={})=>{
    const m=e.store.get('mission',mission.id).data,c=e.store.get('worker-config',run.id).data,b=planningInspectionBudget(e.registry,m.id);
    const task={originalRequest:m.intent,intentHash:m.intentHash,allowedTools:m.policy.allowedTools,...extra,
      planningContractControl:{schema:'sovereign.planning-contract-control.v1',runId:run.id,callIndex:b.reserved+1,maxCalls:b.maxCalls,maxBytes:b.maxBytes}};
    const {request}=composeLearningRequest({prefix:c.instructions,taskInstructions:'Return the inspect/plan public message only.',
      input:JSON.stringify({...e.workers.context(run.id),task:JSON.stringify(task)}),schema:PLANNING_MESSAGE_SCHEMA,model:m.policy.model,reasoningEffort:m.policy.reasoningEffort});
    e.registry.updateContext(run.id,{...e.store.get('run',run.id).data.context,instructionsHash:sha256(request.instructions)});
    const call=reservePlanningInspection(e.registry,{runId:run.id,request});
    return {call,requestHash:inferenceRequestHash(request),receipt:{status:'completed',threadId:'fixture-thread:'+call.data.ordinal,
      turnId:'fixture-turn:'+call.data.ordinal,contextHash:inferenceRequestHash(request)}};
  };
  // Storage-level tests deliberately model the physical-provider lifecycle in
  // two distinct commits: response retention is allowed before `close()`, but
  // public consumption is not.  This lets the tests prove that no reader
  // confuses an attached receipt with a safely closed provider session.
  const retainRaw=(r,value=inspection())=>messages.retainPlanningInspectionMessage(e.registry,{runId:run.id,requestHash:r.requestHash,receipt:r.receipt,value});
  const close=(r,{outcome='RETAINED',outcomeRecord=null,confirmed=true,result={processExitObserved:true}}={})=>recordPlanningProviderCleanup(e.registry,{runId:run.id,
    requestHash:r.requestHash,retention:messages.PLANNING_INSPECTION_RETENTION,reservationRecord:ref(r.call),confirmed,result,outcome,outcomeRecord});
  const retain=(r,value=inspection())=>{const saved=retainRaw(r,value);close(r,{outcomeRecord:ref(saved)});return saved;};
  const abandon=(r,code='QUOTA')=>{close(r,{outcome:'NO_DURABLE_RESPONSE'});return messages.retainPlanningInspectionFailure(e.registry,{runId:run.id,requestHash:r.requestHash,code});};
  t.after(()=>{e.close();rmSync(dir,{recursive:true,force:true});});
  return {get e(){return e;},dir,runId:run.id,missionId:m.id,propose,reserve,retainRaw,close,retain,abandon,reopen(){e.close();open();}};
}
function historicalPlanningFixture(t){
  const dir=mkdtempSync(join(tmpdir(),'historical-planning-cleanup-')),
    engine=new FactoryEngine({databasePath:join(dir,'state.sqlite'),workspaceRoot:join(dir,'jobs')}),
    intent='Preserve the historical planning lifecycle without fabricating a later cleanup protocol.',
    mission={id:'mission:historical-planning-cleanup',intent,intentHash:sha256(intent),
      policy:{model:'gpt-6-astra',reasoningEffort:'ultra',allowedTools:[],maxPlanAttempts:1,maxNodeAttempts:1},
      status:'NEW',createdAt:'2026-09-19T00:00:00.000Z',updatedAt:'2026-09-19T00:00:00.000Z',finalArtifactId:null,pending:[],history:[]};
  t.after(()=>{engine.close();rmSync(dir,{recursive:true,force:true});});
  engine.store.put('mission',mission.id,mission,{expectedVersion:0});
  const run=engine.workers.createRun({missionId:mission.id,nodeId:'planning',mode:'producer',purpose:'plan',roleIds:['omega_04','omega_05']}),
    config=engine.store.get('worker-config',run.id).data,
    request={instructions:config.instructions,input:'{}',schema:PLAN_SCHEMA,model:mission.policy.model,reasoningEffort:mission.policy.reasoningEffort},
    requestHash=engine.registry.recordInferenceRequest(run.id,request);
  return {engine,mission,run,requestHash};
}
test('control message and exact receipt commit together; public reading is durable, isolated and idempotent',t=>{
  const f=fixture(t);assert.equal(messages.readPlanningInspectionMessage(f.e.registry,f.runId),null);
  const r=f.reserve(),saved=f.retainRaw(r);
  assert.throws(()=>messages.readPlanningInspectionMessage(f.e.registry,f.runId),{code:'CLEANUP_UNCONFIRMED'});
  const cleanup=f.close(r,{outcomeRecord:ref(saved)}),before=f.e.store.verifyJournal();f.reopen();
  const result=messages.readPlanningInspectionMessage(f.e.registry,f.runId);
  assert.deepEqual(result.value,inspection());assert.equal(result.responseRecord.hash,saved.hash);assert.equal(result.reservationRecord.hash,r.call.hash);
  assert.equal(cleanup.data.status,'CLOSED');assert.equal(cleanup.data.outcome,'RETAINED');
  assert.deepEqual(cleanup.data.outcomeRecord,ref(saved));
  const origin=f.e.store.list('planning-cleanup-origin').at(-1),sequence=r=>f.e.registry.committedSequence(r.type,r.id,r.version);
  assert.deepEqual(origin.data.requestRecord,r.call.data.requestRecord);assert.deepEqual(origin.data.reservationRecord,ref(r.call));
  assert.ok(sequence(f.e.store.get('inference-request',r.call.data.requestRecord.id))<sequence(r.call));
  assert.ok(sequence(r.call)<sequence(origin));assert.ok(sequence(origin)<sequence(saved));assert.ok(sequence(saved)<sequence(cleanup));
  assert.equal(result.requestHash,r.requestHash);assert.deepEqual(result.receipt,r.receipt);assert.equal(result.coverage,null);
  assert.equal(f.retain(r).hash,saved.hash);assert.deepEqual(f.e.store.verifyJournal(),before);
  result.value.roleIds=[];assert.deepEqual(messages.readPlanningInspectionMessage(f.e.registry,f.runId).value,inspection());
  assert.equal(f.e.store.list('artifact').length,0);assert.equal(f.e.store.db.isTransaction,false);
});
test('a retained cleanup cannot be written without its exact pre-close response record',t=>{
  const f=fixture(t),r=f.reserve(),before=f.e.store.verifyJournal();
  assert.throws(()=>f.close(r),{code:'PLANNING_RESPONSE_INTEGRITY'});assert.deepEqual(f.e.store.verifyJournal(),before);
  const saved=f.retainRaw(r),afterRaw=f.e.store.verifyJournal();
  assert.throws(()=>f.close(r,{outcomeRecord:{...ref(saved),hash:'0'.repeat(64)}}),{code:'PLANNING_RESPONSE_INTEGRITY'});
  assert.deepEqual(f.e.store.verifyJournal(),afterRaw);
  const cleanup=f.close(r,{outcomeRecord:ref(saved)});assert.equal(cleanup.data.outcome,'RETAINED');
});
test('a closed unretained outcome blocks late response or failure retention across reopen',t=>{
  const f=fixture(t),r=f.reserve(),cleanup=f.close(r,{outcome:'RESPONSE_UNRETAINED'}),before=f.e.store.verifyJournal();
  assert.equal(cleanup.data.status,'CLOSED');assert.equal(cleanup.data.outcomeRecord,null);f.reopen();
  assert.throws(()=>messages.readPlanningInspectionMessage(f.e.registry,f.runId),{code:'INFERENCE_OUTCOME_UNKNOWN'});
  assert.throws(()=>f.retainRaw(r),{code:'PLANNING_INSPECTION_INTEGRITY'});
  assert.throws(()=>messages.retainPlanningInspectionFailure(f.e.registry,{runId:f.runId,requestHash:r.requestHash,code:'QUOTA'}),{code:'PLANNING_INSPECTION_INTEGRITY'});
  assert.deepEqual(f.e.store.verifyJournal(),before);assert.equal(f.e.store.get('run',f.runId).data.expectedRequestHash,r.requestHash);
  assert.equal(planningInspectionBudget(f.e.registry,f.missionId).reserved,1);
});
for(const [name,options] of [['adapter-close-failed',{outcome:'NO_DURABLE_RESPONSE',confirmed:false,result:null}],
  ['process-exit-not-observed',{outcome:'NO_DURABLE_RESPONSE',confirmed:true,result:{processExitObserved:false}}]])
test('an '+name+' cleanup is never cured by reopen or late storage',t=>{
  const f=fixture(t),r=f.reserve(),cleanup=f.close(r,options),before=f.e.store.verifyJournal();
  assert.equal(cleanup.data.status,'UNCONFIRMED');f.reopen();
  assert.throws(()=>messages.readPlanningInspectionMessage(f.e.registry,f.runId),{code:'CLEANUP_UNCONFIRMED'});
  assert.throws(()=>f.retainRaw(r),{code:'PLANNING_INSPECTION_INTEGRITY'});
  assert.throws(()=>messages.retainPlanningInspectionFailure(f.e.registry,{runId:f.runId,requestHash:r.requestHash,code:'QUOTA'}),{code:'CLEANUP_UNCONFIRMED'});
  assert.deepEqual(f.e.store.verifyJournal(),before);assert.equal(f.e.store.get('run',f.runId).data.expectedRequestHash,r.requestHash);
});
test('failed public-message storage rolls receipt back while preserving the prior reservation and pending request',t=>{
  const f=fixture(t),r=f.reserve(),before=f.e.store.verifyJournal(),put=f.e.store.put.bind(f.e.store);
  const fault=t.mock.method(f.e.store,'put',(type,...args)=>{if(type==='planning-inspection-response')throw Error('Synthetic message storage failure');return put(type,...args);});
  assert.throws(()=>f.retain(r),/Synthetic message storage failure/);fault.mock.restore();
  assert.deepEqual(f.e.store.verifyJournal(),before);assert.equal(f.e.store.get('run',f.runId).data.expectedRequestHash,r.requestHash);
  assert.equal(f.e.store.get('run',f.runId).data.inferenceReceipt,undefined);assert.equal(planningInspectionBudget(f.e.registry,f.missionId).reserved,1);
  assert.throws(()=>messages.readPlanningInspectionMessage(f.e.registry,f.runId),{code:'CLEANUP_UNCONFIRMED'});
});
test('a newer pending call never falls back to an older completed message; historical completions remain readable',t=>{
  const f=fixture(t),first=f.reserve();f.retain(first);
  const next=f.reserve({inspectedRoleContracts:inspectPlanningRoleContracts(['omega_02','omega_03'])});
  assert.throws(()=>messages.readPlanningInspectionMessage(f.e.registry,f.runId),{code:'CLEANUP_UNCONFIRMED'});
  assert.deepEqual(messages.readPlanningInspectionMessage(f.e.registry,f.runId,first.requestHash).value,inspection());
  f.retain(next,f.propose());const result=messages.readPlanningInspectionMessage(f.e.registry,f.runId);
  assert.equal(result.requestHash,next.requestHash);assert.equal(result.coverage.complete,true);
  assert.deepEqual(result.coverage.requiredRoleIds,['omega_02','omega_03']);assert.equal(f.e.store.list('artifact').length,0);
  assert.equal(messages.readPlanningInspectionMessage(f.e.registry,f.runId,first.requestHash).receipt.contextHash,first.requestHash);
});
test('cleanup observation and report quarantine a retained control response until its provider close is durably confirmed',t=>{
  const f=fixture(t),r=f.reserve(),sentinel='PRIVATE_PRE_CLOSE_CONTROL_SENTINEL';f.retainRaw(r,{...inspection(),reason:sentinel});
  const observation=readPlanningCleanupObservation(f.e.registry,{runId:f.runId,requestHash:r.requestHash,
    retention:messages.PLANNING_INSPECTION_RETENTION,reservationRecord:ref(r.call)});
  assert.equal(observation.origin.state,'RECORDED');assert.equal(observation.cleanup.state,'MISSING');assert.equal(observation.publicState,'PENDING_CLEANUP');
  const report=readReport(f),serialized=JSON.stringify(report),text=formatMissionReport(report);
  assert.equal(report.planningCleanup.integrity,'NOT_PROJECTED');assert.deepEqual(report.planningCleanup.actors,[]);
  assert.equal(report.planningInspection.integrity,'VERIFIED');assert.deepEqual(report.planningInspection.actors,[]);
  assert.ok(!serialized.includes(sentinel));assert.ok(!text.includes(sentinel));
});
test('historical planning actors remain NOT_APPLICABLE and cannot manufacture retrospective cleanup proof',t=>{
  const f=historicalPlanningFixture(t),before=reportFence(f.engine.store),args={runId:f.run.id,requestHash:f.requestHash,
    retention:PLANNING_RESPONSE_RETENTION};
  const observation=readPlanningCleanupObservation(f.engine.registry,args);
  assert.equal(observation.protocol,null);assert.equal(observation.origin.state,'MISSING');assert.equal(observation.cleanup.state,'MISSING');
  assert.equal(observation.publicState,'NOT_APPLICABLE');
  assert.throws(()=>recordPlanningCleanupOrigin(f.engine.registry,args),{code:'PLANNING_RESPONSE_INTEGRITY'});
  assert.throws(()=>recordPlanningProviderCleanup(f.engine.registry,{...args,confirmed:true,result:{processExitObserved:true},
    outcome:'NO_DURABLE_RESPONSE'}),{code:'PLANNING_RESPONSE_INTEGRITY'});
  assert.equal(reportFence(f.engine.store),before);
  assert.deepEqual(f.engine.store.list('planning-cleanup-origin'),[]);assert.deepEqual(f.engine.store.list('planning-provider-cleanup'),[]);
});
for(const [name,arrange,expected] of [
  ['closed retained',f=>{const r=f.reserve(),saved=f.retain(r);return {r,saved};},{state:'CLOSED',outcome:'RETAINED',publicState:'AVAILABLE',response:'inspect',failure:null}],
  ['closed no durable response',f=>{const r=f.reserve(),failure=f.abandon(r,'QUOTA');return {r,failure};},{state:'CLOSED',outcome:'NO_DURABLE_RESPONSE',publicState:'NO_DURABLE_RESPONSE',response:null,failure:'QUOTA'}],
  ['closed unretained response',f=>{const r=f.reserve();f.close(r,{outcome:'RESPONSE_UNRETAINED'});return {r};},{state:'CLOSED',outcome:'RESPONSE_UNRETAINED',publicState:'RECONCILIATION_REQUIRED',response:null,failure:null}],
  ['unconfirmed retained response',f=>{const r=f.reserve(),saved=f.retainRaw(r,{...inspection(),reason:'PRIVATE_UNCONFIRMED_CONTROL_SENTINEL'});f.close(r,{outcomeRecord:ref(saved),confirmed:true,result:{processExitObserved:false}});return {r};},{state:'UNCONFIRMED',outcome:'RETAINED',publicState:'PENDING_CLEANUP',response:null,failure:null}]
])
test('cleanup report projects '+name+' without consuming a quarantined lifecycle',t=>{
  const f=fixture(t),{r}=arrange(f),observation=readPlanningCleanupObservation(f.e.registry,{runId:f.runId,requestHash:r.requestHash,
    retention:messages.PLANNING_INSPECTION_RETENTION,reservationRecord:ref(r.call)}),report=readReport(f),serialized=JSON.stringify(report);
  assert.equal(observation.origin.state,'RECORDED');assert.equal(observation.cleanup.state,expected.state);
  assert.equal(observation.cleanup.localDisposition,expected.outcome);assert.equal(observation.publicState,expected.publicState);
  assert.equal(report.planningCleanup.integrity,'NOT_PROJECTED');assert.deepEqual(report.planningCleanup.actors,[]);
  assert.equal(report.planningInspection.integrity,'VERIFIED');assert.deepEqual(report.planningInspection.actors,[]);
  if(name==='unconfirmed retained response')assert.ok(!serialized.includes('PRIVATE_UNCONFIRMED_CONTROL_SENTINEL'));
});
test('cleanup report retains every on-demand attempt in stable reservation order',t=>{
  const f=fixture(t),first=f.reserve();f.retain(first);const second=f.reserve({inspectedRoleContracts:inspectPlanningRoleContracts(['omega_02','omega_03'])});
  const observation=r=>readPlanningCleanupObservation(f.e.registry,{runId:f.runId,requestHash:r.requestHash,
    retention:messages.PLANNING_INSPECTION_RETENTION,reservationRecord:ref(r.call)}),attempts=[observation(first),observation(second)],report=readReport(f);
  assert.deepEqual(attempts.map(a=>a.requestHash),[first.requestHash,second.requestHash]);
  assert.deepEqual(attempts.map(a=>a.publicState),['AVAILABLE','PENDING_CLEANUP']);
  assert.equal(attempts[0].cleanup.state,'CLOSED');assert.equal(attempts[1].cleanup.state,'MISSING');
  assert.equal(report.planningCleanup.integrity,'NOT_PROJECTED');assert.deepEqual(report.planningCleanup.actors,[]);
  assert.equal(report.planningInspection.integrity,'VERIFIED');assert.equal(report.planningInspection.budget.reserved,2);
  assert.deepEqual(report.planningInspection.actors,[],'Inspection response custody remains outside the public aggregate');
});
for(const change of ['origin','cleanup'])
test('cleanup report marks altered '+change+' evidence unverified without leaking its retained control response',t=>{
  const f=fixture(t),r=f.reserve(),sentinel='PRIVATE_ALTERED_'+change.toUpperCase()+'_SENTINEL';f.retain(r,{...inspection(),reason:sentinel});
  const record=change==='origin'?f.e.store.list('planning-cleanup-origin').at(-1):f.e.store.list('planning-provider-cleanup').at(-1),data=structuredClone(record.data);
  if(change==='origin')data.scope+=' altered';else data.outcome='NO_DURABLE_RESPONSE';
  f.e.store.put(record.type,record.id,data,{expectedVersion:record.version});
  const observation=readPlanningCleanupObservation(f.e.registry,{runId:f.runId,requestHash:r.requestHash,
    retention:messages.PLANNING_INSPECTION_RETENTION,reservationRecord:ref(r.call)}),report=readReport(f),serialized=JSON.stringify(report);
  assert.equal(observation.publicState,'UNVERIFIED');assert.equal(report.planningCleanup.integrity,'NOT_PROJECTED');
  assert.deepEqual(report.planningCleanup.actors,[]);assert.deepEqual(report.planningInspection.actors,[]);assert.ok(!serialized.includes(sentinel));
});
test('a v15 inspection mission cannot be downgraded to historical semantics by removing its current policy',t=>{
  const f=fixture(t),r=f.reserve(),sentinel='PRIVATE_POLICY_DOWNGRADE_SENTINEL';f.retain(r,{...inspection(),reason:sentinel});
  const mission=f.e.store.get('mission',f.missionId),policy={...mission.data.policy};delete policy.planningContracts;delete policy.planningCleanupProtocol;
  f.e.store.put(mission.type,mission.id,{...mission.data,policy},{expectedVersion:mission.version});
  assert.throws(()=>messages.readPlanningInspectionMessage(f.e.registry,f.runId),{code:'PLANNING_RESPONSE_INTEGRITY'});
  const observation=readPlanningCleanupObservation(f.e.registry,{runId:f.runId,requestHash:r.requestHash,
    retention:messages.PLANNING_INSPECTION_RETENTION,reservationRecord:ref(r.call)});
  assert.equal(observation.publicState,'UNVERIFIED');
  const report=readReport(f),serialized=JSON.stringify(report),text=formatMissionReport(report);
  assert.equal(report.planningInspection.integrity,'UNVERIFIED');assert.equal(report.planningInspection.budget,null);
  assert.equal(report.planningCleanup.integrity,'UNVERIFIED');assert.deepEqual(report.planningCleanup.actors,[]);
  assert.deepEqual(report.planningInspection.actors,[]);
  assert.equal(report.mission.policy,null);assert.equal(report.mission.policyIntegrity,'UNVERIFIED');
  assert.ok(!serialized.includes(sentinel));assert.ok(!text.includes(sentinel));assert.match(text,/Cuarentena de integridad/);
  const cliReport=spawnSync(process.execPath,[cli,'report',f.missionId,'--state-dir',f.dir,'--json'],{encoding:'utf8',timeout:15000,maxBuffer:1024*1024});
  assert.equal(cliReport.error,undefined);assert.equal(cliReport.signal,null);assert.equal(cliReport.status,0,cliReport.stderr);
  const cliPayload=JSON.parse(cliReport.stdout);assert.equal(cliPayload.planningInspection.integrity,'UNVERIFIED');
  assert.equal(cliPayload.mission.policy,null);assert.equal(cliPayload.mission.policyIntegrity,'UNVERIFIED');assert.ok(!cliReport.stdout.includes(sentinel));
});

test('a cleanup-only planned policy drift quarantines every mutable report surface, including timeline payloads',t=>{
  const dir=mkdtempSync(join(tmpdir(),'planning-cleanup-only-report-')),
    engine=new FactoryEngine({databasePath:join(dir,'state.sqlite'),workspaceRoot:join(dir,'jobs')});
  t.after(()=>{engine.close();rmSync(dir,{recursive:true,force:true});});
  const mission=engine.create('Preserve the full requested result and independent substantive review.',{allowedTools:[]}),
    origin=engine.store.get('mission',mission.id),sentinels={policy:'PRIVATE_CLEANUP_POLICY_DRIFT_SENTINEL',
      pending:'PRIVATE_UNVERIFIED_PENDING_REASON_SENTINEL',history:'PRIVATE_UNVERIFIED_HISTORY_SENTINEL',
      pointer:'artifact:PRIVATE_FORGED_FINAL_POINTER_SENTINEL',entry:'PRIVATE_QUARANTINED_ENTRY_RESPONSE_SENTINEL',
      review:'PRIVATE_QUARANTINED_REVIEW_QUOTE_SENTINEL',plan:'PRIVATE_QUARANTINED_PLAN_SENTINEL',
      source:'PRIVATE_QUARANTINED_SOURCE_SENTINEL',effect:'PRIVATE_QUARANTINED_EFFECT_SENTINEL',
      requestHash:'PRIVATE_PENDING_REQUEST_HASH_SENTINEL',adaptivePointer:'artifact:PRIVATE_ADAPTIVE_ACCEPTED_POINTER_SENTINEL',
      runId:'run:PRIVATE_QUARANTINED_RUN_ID_SENTINEL',eventKind:'PRIVATE_QUARANTINED_EVENT_KIND_SENTINEL',
      timestamp:'PRIVATE_QUARANTINED_CLOCK_SENTINEL'},
    runId=sentinels.runId;
  assert.equal(origin.data.policy.planningContracts,undefined);assert.equal(origin.data.policy.planningCleanupProtocol,'planning-cleanup-v1');
  engine.store.put('mission',mission.id,{...origin.data,status:'COMPLETED',finalArtifactId:sentinels.pointer,
    pending:[{code:'PRIVATE',reason:sentinels.pending}],history:[{status:'COMPLETED',detail:sentinels.history}],
    policy:{...origin.data.policy,maxPlanAttempts:99,untrustedMarker:sentinels.policy}},
    {expectedVersion:origin.version});
  engine.store.put('plan',mission.id,{plan:{nodes:[],routingRationale:sentinels.plan}},{expectedVersion:0});
  engine.store.put('node',`${mission.id}:private`,{missionId:mission.id,nodeId:'private',spec:{title:sentinels.plan}},{expectedVersion:0});
  engine.store.put('run',runId,{id:runId,missionId:mission.id,nodeId:'planning',mode:'producer',expectedRequestHash:sentinels.requestHash,inferenceReceipts:[]},{expectedVersion:0});
  engine.store.put('planning-inspection-call','planning-inspection-call:quarantined',{missionId:mission.id,runId,requestHash:sentinels.requestHash},{expectedVersion:0});
  engine.store.put('closed-entry',mission.id,{missionId:mission.id,response:{body:sentinels.entry}},{expectedVersion:0});
  engine.store.put('bounded-read-entry',mission.id,{missionId:mission.id,response:{body:sentinels.entry}},{expectedVersion:0});
  engine.store.put('sourced-response-entry',mission.id,{missionId:mission.id,response:{body:sentinels.entry}},{expectedVersion:0});
  engine.store.put('review','review:quarantined',{reviewerRunId:runId,result:{checks:[{evidence:[{quote:sentinels.review}]}]}},{expectedVersion:0});
  engine.store.put('source','source:quarantined',{missionId:mission.id,url:sentinels.source},{expectedVersion:0});
  engine.store.put('effect','effect:quarantined',{missionId:mission.id,principalId:runId,tool:sentinels.effect,state:'SUCCEEDED'},{expectedVersion:0});
  const originalClock=engine.store.clock;let privateEvent;
  try{
    engine.store.clock=()=>sentinels.timestamp;
    privateEvent=engine.store.append(`mission.${sentinels.eventKind}`,{missionId:mission.id,rawPolicy:sentinels.policy});
  }finally{engine.store.clock=originalClock;}
  engine.store.append('adaptive-v3.direct.accepted',{missionId:mission.id,artifactId:sentinels.adaptivePointer});
  const before=reportFence(engine.store),report=missionReport(engine.store,mission.id),serialized=JSON.stringify(report),text=formatMissionReport(report);
  assert.deepEqual(reportFence(engine.store),before);assert.equal(report.mission.policy,null);assert.equal(report.mission.policyIntegrity,'UNVERIFIED');
  assert.equal(report.mission.planningAdmissionIntegrity,'UNVERIFIED');assert.equal(report.mission.status,'UNVERIFIED');
  assert.equal(report.mission.lifecycleIntegrity,'UNVERIFIED');assert.equal(report.mission.finalArtifactId,null);assert.deepEqual(report.mission.pending,[]);assert.deepEqual(report.mission.history,[]);
  assert.equal(report.final,null);assert.equal(report.metrics.integrity,'UNVERIFIED');assert.equal(report.plan,null);assert.equal(report.learning,null);
  assert.deepEqual(report.nodes,[]);assert.deepEqual(report.sources,[]);assert.deepEqual(report.reviews,[]);assert.deepEqual(report.effects,[]);
  assert.ok(!Object.hasOwn(report,'entry'));assert.ok(!Object.hasOwn(report,'boundedEntry'));assert.ok(!Object.hasOwn(report,'sourcedEntry'));assert.ok(!Object.hasOwn(report,'controllerExecutions'));
  assert.equal(report.planningCleanup.integrity,'UNVERIFIED');assert.deepEqual(report.planningCleanup.actors,[]);
  assert.equal(report.planningInspection.integrity,'UNVERIFIED');assert.deepEqual(report.planningInspection.actors,[]);
  for(const sentinel of Object.values(sentinels)){assert.ok(!serialized.includes(sentinel),`JSON ${sentinel}`);assert.ok(!text.includes(sentinel),`text ${sentinel}`);}
  assert.deepEqual(report.timeline,[],'Raw journal chronology stays out of quarantined public reports');
});
test('a forged adaptive route inside a drifted planning policy is quarantined before report routing',t=>{
  const f=fixture(t),origin=f.e.store.get('mission',f.missionId),hashes=['a','b','c','d'].map(char=>char.repeat(64)),policy={...origin.data.policy,
    entryMode:'closed-response-v3',routing:{schema:'sovereign.adaptive-v3-routing.v1',revision:1,
      selectorCatalogHash:hashes[0],decisionHash:hashes[1],staticPolicyHash:hashes[2],finalPolicyHash:hashes[3]}};
  f.e.store.put(origin.type,origin.id,{...origin.data,policy},{expectedVersion:origin.version});
  const report=readReport(f),serialized=JSON.stringify(report),text=formatMissionReport(report);
  assert.equal(report.planningInspection.integrity,'UNVERIFIED');assert.equal(report.planningInspection.budget,null);
  assert.equal(report.mission.policy,null);assert.equal(report.mission.policyIntegrity,'UNVERIFIED');
  assert.ok(!Object.hasOwn(report,'adaptiveV3'));assert.equal(report.final,null);
  for(const value of hashes){assert.ok(!serialized.includes(value));assert.ok(!text.includes(value));}
  const cliReport=spawnSync(process.execPath,[cli,'report',f.missionId,'--state-dir',f.dir,'--json'],{encoding:'utf8',timeout:15000,maxBuffer:1024*1024});
  assert.equal(cliReport.error,undefined);assert.equal(cliReport.signal,null);assert.equal(cliReport.status,0,cliReport.stderr);
  const cliPayload=JSON.parse(cliReport.stdout);assert.ok(!Object.hasOwn(cliPayload,'adaptiveV3'));assert.equal(cliPayload.mission.policy,null);
  for(const value of hashes)assert.ok(!cliReport.stdout.includes(value));
});
test('a drifted real adaptive-v3 planning mission keeps its private route-event namespace redacted',t=>{
  const dir=mkdtempSync(join(tmpdir(),'planning-adaptive-report-')),engine=new FactoryEngine({databasePath:join(dir,'state.sqlite'),workspaceRoot:join(dir,'jobs')});
  t.after(()=>{engine.close();rmSync(dir,{recursive:true,force:true});});
  const mission=engine.create('Keep private adaptive route evidence out of every quarantined report.',{preset:'adaptive-v3',entryMode:'planned',
    model:'gpt-6-terra',reasoningEffort:'high',allowedTools:[]}),sentinel='PRIVATE_R14_ADAPTIVE_EVENT_SENTINEL';
  engine.store.append('adaptive-v3.private.fixture',{missionId:mission.id,selectorProof:sentinel,privatePolicy:sentinel});
  const current=engine.store.get('mission',mission.id),policy={...current.data.policy,maxPlanAttempts:99};
  engine.store.put(current.type,current.id,{...current.data,policy},{expectedVersion:current.version});
  const report=missionReport(engine.store,mission.id),serialized=JSON.stringify(report),text=formatMissionReport(report);
  assert.equal(report.planningInspection.integrity,'UNVERIFIED');assert.equal(report.mission.policy,null);
  assert.ok(!Object.hasOwn(report,'adaptiveV3'));assert.equal(report.final,null);
  assert.ok(!report.timeline.some(event=>event.kind==='adaptive-v3.private.fixture'));assert.ok(!serialized.includes(sentinel));assert.ok(!text.includes(sentinel));
  const cliReport=spawnSync(process.execPath,[cli,'report',mission.id,'--state-dir',dir,'--json'],{encoding:'utf8',timeout:15000,maxBuffer:1024*1024});
  assert.equal(cliReport.error,undefined);assert.equal(cliReport.signal,null);assert.equal(cliReport.status,0,cliReport.stderr);
  assert.ok(!cliReport.stdout.includes(sentinel));assert.ok(!Object.hasOwn(JSON.parse(cliReport.stdout),'adaptiveV3'));
});
for(const [name,mutate] of [
  ['cleanup marker',policy=>{delete policy.planningCleanupProtocol;}],
  ['unspent inspection ceiling',policy=>{policy.planningContracts={...policy.planningContracts,maxCalls:99};}],
  ['forged method-recovery ceiling',policy=>{policy.methodRecovery={mode:'reviewed-method-v1',maxRounds:99};}]
])
test('report does not project an altered '+name+' as a valid pre-dispatch budget',t=>{
  const f=fixture(t),mission=f.e.store.get('mission',f.missionId),policy={...mission.data.policy};mutate(policy);
  f.e.store.put(mission.type,mission.id,{...mission.data,policy},{expectedVersion:mission.version});
  assert.throws(()=>planningInspectionBudget(f.e.registry,f.missionId),{code:'PLANNING_INSPECTION_INTEGRITY'});
  const report=readReport(f),text=formatMissionReport(report),serialized=JSON.stringify(report);
  assert.equal(report.planningInspection.integrity,'UNVERIFIED');assert.equal(report.planningInspection.budget,null);
  assert.equal(report.mission.policy,null);assert.equal(report.mission.policyIntegrity,'UNVERIFIED');
  assert.match(text,/Cuarentena de integridad/);assert.deepEqual(report.planningInspection.actors,[]);
  if(name==='unspent inspection ceiling')assert.ok(!serialized.includes('"maxCalls":99'));
  if(name==='forged method-recovery ceiling'){
    assert.ok(!Object.hasOwn(report,'methodRecovery'));assert.ok(!serialized.includes('"maxRounds":99'));
  }
});
for(const [name,mutate,forbidden] of [
  ['policy mutation later reverted',(f,origin)=>{
    const altered='UNTRUSTED_POLICY_HEAD_SENTINEL',widened={...origin.data.policy,untrustedMarker:altered,
      planningContracts:{...origin.data.policy.planningContracts,maxCalls:99}},drifted=f.e.store.put(origin.type,origin.id,
        {...origin.data,policy:widened},{expectedVersion:origin.version});
    f.e.store.put(drifted.type,drifted.id,{...drifted.data,policy:origin.data.policy},{expectedVersion:drifted.version});return altered;
  }],
  ['substituted mandate',(f,origin)=>{
    const altered='UNTRUSTED_MANDATE_HEAD_SENTINEL';f.e.store.put(origin.type,origin.id,
      {...origin.data,intent:altered,intentHash:sha256(altered)},{expectedVersion:origin.version});return altered;
  }]
])
test('report quarantines '+name+' rather than leaking an apparent planning authority',t=>{
  const f=fixture(t),r=f.reserve(),responseSentinel='PRIVATE_ADMISSION_RESPONSE_SENTINEL';f.retain(r,{...inspection(),reason:responseSentinel});
  const origin=f.e.store.get('mission',f.missionId,1),altered=mutate(f,origin);
  assert.throws(()=>planningInspectionBudget(f.e.registry,f.missionId),{code:'PLANNING_INSPECTION_INTEGRITY'});
  assert.throws(()=>messages.readPlanningInspectionMessage(f.e.registry,f.runId),{code:'PLANNING_RESPONSE_INTEGRITY'});
  const report=readReport(f),serialized=JSON.stringify(report),text=formatMissionReport(report);
  assert.equal(report.planningInspection.integrity,'UNVERIFIED');assert.equal(report.planningInspection.budget,null);
  assert.equal(report.mission.policy,null);assert.equal(report.mission.policyIntegrity,'UNVERIFIED');
  assert.equal(report.mission.planningAdmissionIntegrity,'UNVERIFIED');assert.equal(report.mission.intent,origin.data.intent);
  assert.deepEqual(report.planningCleanup.actors,[]);assert.deepEqual(report.planningInspection.actors,[]);
  for(const value of [responseSentinel,altered]){assert.ok(!serialized.includes(value));assert.ok(!text.includes(value));}
});
for(const [name,arrange,expected] of [
  ['missing cleanup with retained response',f=>{const r=f.reserve(),sentinel='PRIVATE_CLI_MISSING_SENTINEL';f.retainRaw(r,{...inspection(),reason:sentinel});return {sentinel,r};},{state:'MISSING',outcome:null,publicState:'PENDING_CLEANUP'}],
  ['unconfirmed retained response',f=>{const r=f.reserve(),sentinel='PRIVATE_CLI_UNCONFIRMED_SENTINEL',saved=f.retainRaw(r,{...inspection(),reason:sentinel});f.close(r,{outcomeRecord:ref(saved),confirmed:true,result:{processExitObserved:false}});return {sentinel,r};},{state:'UNCONFIRMED',outcome:'RETAINED',publicState:'PENDING_CLEANUP'}],
  ['closed unretained response',f=>{const r=f.reserve();f.close(r,{outcome:'RESPONSE_UNRETAINED'});return {sentinel:null,r};},{state:'CLOSED',outcome:'RESPONSE_UNRETAINED',publicState:'RECONCILIATION_REQUIRED'}]
])
test('CLI report is read-only and projects '+name,t=>{
  const f=fixture(t),{sentinel,r}=arrange(f),before=reportFence(f.e.store),json=spawnSync(process.execPath,[cli,'report',f.missionId,'--state-dir',f.dir,'--json'],
    {encoding:'utf8',timeout:15000,maxBuffer:1024*1024});
  assert.equal(json.error,undefined);assert.equal(json.signal,null);assert.equal(json.status,0,json.stderr);
  const observation=readPlanningCleanupObservation(f.e.registry,{runId:f.runId,requestHash:r.requestHash,
    retention:messages.PLANNING_INSPECTION_RETENTION,reservationRecord:ref(r.call)}),report=JSON.parse(json.stdout);
  assert.equal(observation.cleanup.state,expected.state);assert.equal(observation.cleanup.localDisposition,expected.outcome);assert.equal(observation.publicState,expected.publicState);
  assert.equal(report.planningCleanup.integrity,'NOT_PROJECTED');assert.deepEqual(report.planningCleanup.actors,[]);
  assert.equal(report.planningInspection.integrity,'VERIFIED');assert.deepEqual(report.planningInspection.actors,[]);
  const text=spawnSync(process.execPath,[cli,'report',f.missionId,'--state-dir',f.dir],{encoding:'utf8',timeout:15000,maxBuffer:1024*1024});
  assert.equal(text.error,undefined);assert.equal(text.signal,null);assert.equal(text.status,0,text.stderr);assert.match(text.stdout,/Cierres de planificación/);
  if(sentinel){assert.ok(!json.stdout.includes(sentinel));assert.ok(!text.stdout.includes(sentinel));}
  assert.deepEqual(reportFence(f.e.store),before);assert.equal(f.e.store.db.isTransaction,false);
});
test('a well-shaped plan without contracts is retained only as a provisional public proposal',t=>{
  const f=fixture(t),r=f.reserve();f.retain(r,f.propose());const result=messages.readPlanningInspectionMessage(f.e.registry,f.runId);
  assert.equal(result.coverage.complete,false);assert.deepEqual(result.coverage.missingRoleIds,['omega_02','omega_03']);
  assert.equal(f.e.store.list('artifact').length,0);assert.equal(f.e.store.list('plan').length,0);
});
for(const change of ['receipt','value','request','message-version','message-head','reservation','context','configuration','missing-receipt','duplicate-receipt','policy','origin','cleanup','outcome-record'])
test('completed control evidence rejects changed '+change+' without replacement or writes',t=>{
  const f=fixture(t),r=f.reserve(),saved=f.retain(r);let record;
  if(change==='receipt')assert.throws(()=>f.retain({...r,receipt:{...r.receipt,turnId:'changed'}}));
  if(change==='value')assert.throws(()=>f.retain(r,{...inspection(),reason:'changed'}));
  if(['receipt','value'].includes(change))return;
  if(change==='message-head')f.e.store.db.prepare('DELETE FROM heads WHERE type=? AND id=?').run(saved.type,saved.id);
  else{
    if(change==='request')record=f.e.store.get('inference-request',r.call.data.requestRecord.id);
    if(change==='message-version')record=saved;
    if(change==='reservation')record=r.call;
    if(change==='configuration')record=f.e.store.get('worker-config',f.runId);
    if(change==='policy')record=f.e.store.get('mission',f.missionId);
    if(change==='origin')record=f.e.store.list('planning-cleanup-origin').at(-1);
    if(['cleanup','outcome-record'].includes(change))record=f.e.store.list('planning-provider-cleanup').at(-1);
    if(['context','missing-receipt','duplicate-receipt'].includes(change))record=f.e.store.get('run',f.runId);
    const data=structuredClone(record.data);
    if(change==='policy')data.policy.maxPlanAttempts++;
    if(change==='context')data.contextHash='e'.repeat(64);
    if(change==='missing-receipt')data.inferenceReceipts=[];
    if(change==='duplicate-receipt')data.inferenceReceipts.push(data.inferenceReceipt);
    if(change==='origin')data.scope+=' altered';
    if(change==='cleanup')data.outcome='NO_DURABLE_RESPONSE';
    if(change==='outcome-record')data.outcomeRecord={...data.outcomeRecord,hash:'0'.repeat(64)};
    f.e.store.put(record.type,record.id,data,{expectedVersion:record.version});
  }
  // Deliberately hiding a head already invalidates journal/head reconciliation;
  // compare the event bytes to test the reader, not an impossible clean journal.
  const events=()=>f.e.store.db.prepare('SELECT seq,hash FROM events ORDER BY seq').all(),before=events();
  assert.throws(()=>messages.readPlanningInspectionMessage(f.e.registry,f.runId));
  assert.deepEqual(events(),before);assert.equal(f.e.store.db.isTransaction,false);
});
test('noncompleted, foreign and malformed replies cannot commit a message or receipt',t=>{
  const f=fixture(t),r=f.reserve(),before=f.e.store.verifyJournal();
  for(const receipt of [{...r.receipt,status:'failed'},{...r.receipt,contextHash:'f'.repeat(64)}])assert.throws(()=>f.retain({...r,receipt}));
  assert.throws(()=>f.retain(r,{...inspection(),accepted:true}));
  assert.throws(()=>f.retain({...r,requestHash:'e'.repeat(64)}));
  assert.deepEqual(f.e.store.verifyJournal(),before);
});
test('previous-plan binding is versioned at reservation, not reinterpreted from a later installed plan',t=>{
  const f=fixture(t),prior=f.propose().plan;
  f.e.store.put('plan',f.missionId,{plan:prior},{expectedVersion:0});
  assert.throws(()=>f.reserve(),{code:'PLANNING_INSPECTION_INTEGRITY'});
  const r=f.reserve({previousPlan:prior});f.retain(r,f.propose());
  f.e.store.put('plan',f.missionId,{plan:{...prior,routingRationale:'Later accepted replacement'}},{expectedVersion:1});
  assert.equal(messages.readPlanningInspectionMessage(f.e.registry,f.runId).value.plan.routingRationale,prior.routingRationale);
});
test('message reads preserve caller transactions and retention rejects accessors without executing them',t=>{
  const f=fixture(t),r=f.reserve();f.retain(r);
  f.e.store.transact(()=>{assert.ok(messages.readPlanningInspectionMessage(f.e.registry,f.runId));assert.equal(f.e.store.db.isTransaction,true);});
  let calls=0;const input={runId:f.runId,requestHash:r.requestHash,receipt:r.receipt};
  Object.defineProperty(input,'value',{enumerable:true,get(){calls++;return inspection();}});
  assert.throws(()=>messages.retainPlanningInspectionMessage(f.e.registry,input),{code:'SCHEMA'});assert.equal(calls,0);
});
test('a caught inference failure is durable abandonment, never a completed reply, budget refund or replay',t=>{
  const f=fixture(t),r=f.reserve();
  assert.throws(()=>messages.retainPlanningInspectionFailure(f.e.registry,{runId:f.runId,requestHash:r.requestHash,code:'QUOTA'}),{code:'CLEANUP_UNCONFIRMED'});
  const failure=f.abandon(r);
  const cleanup=f.e.store.list('planning-provider-cleanup').at(-1),origin=f.e.store.list('planning-cleanup-origin').at(-1),before=f.e.store.verifyJournal();
  assert.equal(cleanup.data.outcome,'NO_DURABLE_RESPONSE');assert.equal(cleanup.data.outcomeRecord,null);assert.deepEqual(failure.data.cleanupRecord,ref(cleanup));
  const sequence=q=>f.e.registry.committedSequence(q.type,q.id,q.version);
  assert.ok(sequence(f.e.store.get('inference-request',r.call.data.requestRecord.id))<sequence(r.call));assert.ok(sequence(r.call)<sequence(origin));
  assert.ok(sequence(origin)<sequence(cleanup));assert.ok(sequence(cleanup)<sequence(failure));
  f.reopen();assert.equal(messages.readPlanningInspectionFailure(f.e.registry,f.runId).hash,failure.hash);
  assert.equal(messages.readPlanningInspectionMessage(f.e.registry,f.runId),null);assert.equal(planningInspectionBudget(f.e.registry,f.missionId).reserved,1);
  assert.equal(messages.retainPlanningInspectionFailure(f.e.registry,{runId:f.runId,requestHash:r.requestHash,code:'QUOTA'}).hash,failure.hash);
  assert.throws(()=>f.retain(r),{code:'PLANNING_INSPECTION_INTEGRITY'});assert.deepEqual(f.e.store.verifyJournal(),before);
  assert.equal(f.e.store.get('run',f.runId).data.expectedRequestHash,r.requestHash);
});
test('a completion cannot be retroactively turned into a failed call',t=>{
  const f=fixture(t),r=f.reserve();f.retain(r);const before=f.e.store.verifyJournal();
  assert.equal(messages.retainPlanningInspectionFailure(f.e.registry,{runId:f.runId,requestHash:r.requestHash,code:'TIMEOUT'}),null);
  assert.equal(messages.readPlanningInspectionFailure(f.e.registry,f.runId),null);assert.deepEqual(f.e.store.verifyJournal(),before);
});
