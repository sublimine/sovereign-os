// Budget/storage tests only: no provider starts or inferred plan acceptance.
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,writeFileSync} from 'node:fs';
import {spawn} from 'node:child_process';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {FactoryEngine} from '../../factory/lib/engine.mjs';
import {sha256} from '../../factory/lib/contracts.mjs';
import {composeLearningRequest} from '../../factory/lib/learning-service.mjs';
import {PLANNING_MESSAGE_SCHEMA} from '../../factory/lib/planning-inspection-contract.mjs';
import {recordPlanningProviderCleanup,readPlanningCleanupObservation} from '../../factory/lib/planning-response.mjs';
import {PLANNING_INSPECTION_RETENTION,readPlanningInspectionMessage,retainPlanningInspectionFailure,retainPlanningInspectionMessage} from '../../factory/lib/planning-inspection-response.mjs';
import * as budget from '../../factory/lib/planning-inspection-budget.mjs';

const ref=r=>({type:r.type,id:r.id,version:r.version,hash:r.hash});
const inspection=()=>({action:'inspect',roleIds:['omega_02','omega_03'],reason:'Read exact role contracts before selecting work.',plan:null});

function fixture(t,{maxCalls=2,enabled=true}={}){
  const directory=mkdtempSync(join(tmpdir(),'planning-budget-'));let engine;
  const open=()=>{engine=new FactoryEngine({databasePath:join(directory,'state.sqlite'),workspaceRoot:join(directory,'jobs')});
    engine.workers.providerFactory=()=>assert.fail('Budget tests cannot start a provider');};open();
  const m=engine.create('Reserve only explicit planning calls for this immutable request.',{allowedTools:[],
    ...(enabled?{planningContracts:{mode:'on-demand-v1',maxCalls,maxBytes:262144}}:{})});
  const makeRun=()=>engine.workers.createRun({missionId:m.id,nodeId:'planning',mode:'producer',purpose:'plan',roleIds:['omega_04','omega_05']});
  const requestFor=(run,callIndex=1,{updateContext=true}={})=>{
    const config=engine.store.get('worker-config',run.id).data,mission=engine.store.get('mission',m.id).data;
    const task={originalRequest:mission.intent,intentHash:mission.intentHash,allowedTools:mission.policy.allowedTools,
      planningContractControl:{schema:'sovereign.planning-contract-control.v1',runId:run.id,callIndex,maxCalls,maxBytes:262144}};
    const {request}=composeLearningRequest({prefix:config.instructions,taskInstructions:'Return an explicit inspect or plan control message.',
      input:JSON.stringify({...engine.workers.context(run.id),task:JSON.stringify(task)}),schema:PLANNING_MESSAGE_SCHEMA,
      model:mission.policy.model,reasoningEffort:mission.policy.reasoningEffort});
    if(updateContext){const current=engine.store.get('run',run.id).data;engine.registry.updateContext(run.id,{...current.context,instructionsHash:sha256(request.instructions)});}
    return request;
  };
  t.after(()=>{engine.close();rmSync(directory,{recursive:true,force:true});});
  return {directory,missionId:m.id,makeRun,requestFor,get engine(){return engine;},reopen(){engine.close();open();}};
}

// Build the same prospective rows as a real reservation, but leave the final
// call record under test under explicit fixture control. This isolates the
// public-budget attack: all IDs/order/schema are genuine, and only one
// embedded immutable reference is falsified.
function persistedReservationFixture(f,{mutate=()=>{}}={}){
  const run=f.makeRun(),request=f.requestFor(run),requestHash=f.engine.registry.recordInferenceRequest(run.id,request),
    mission=f.engine.store.get('mission',f.missionId).data,retained=f.engine.store.get('inference-request','inference-request:'+sha256([run.id,requestHash])),
    pending=f.engine.store.get('run',run.id),configuration=f.engine.store.get('worker-config',run.id),policy=mission.policy.planningContracts,
    data={schema:'sovereign.planning-inspection-call.v1',missionId:mission.id,intentHash:mission.intentHash,policyHash:sha256(mission.policy),policy,
      ordinal:1,runId:run.id,requestHash,requestRecord:ref(retained),preparedRunRecord:ref(pending),workerConfiguration:ref(configuration),
      parentPlanRecord:null,priorCall:null};
  mutate(data);
  return f.engine.store.put('planning-inspection-call',`planning-call:${sha256(mission.id)}:1`,data,{expectedVersion:0});
}

test('planning budget reads an explicit policy without creating records or claiming a dispatch',t=>{
  const f=fixture(t),before=f.engine.store.verifyJournal(),b=budget.planningInspectionBudget(f.engine.registry,f.missionId);
  assert.equal(b.reserved,0);assert.equal(b.remaining,2);assert.equal(b.maxCalls,2);assert.equal(b.lastReservation,null);
  assert.deepEqual(f.engine.store.verifyJournal(),before);assert.equal(f.engine.store.db.isTransaction,false);
});
test('planning budget binds the entire version-one policy before the first reservation',t=>{
  const f=fixture(t),mission=f.engine.store.get('mission',f.missionId),policy={...mission.data.policy,
    planningContracts:{...mission.data.policy.planningContracts,maxCalls:99}};
  f.engine.store.put(mission.type,mission.id,{...mission.data,policy},{expectedVersion:mission.version});
  assert.throws(()=>budget.planningInspectionBudget(f.engine.registry,f.missionId),{code:'PLANNING_INSPECTION_INTEGRITY'});
  assert.equal(f.engine.store.list('planning-inspection-call').length,0);assert.equal(f.engine.store.list('inference-request').length,0);
});
test('planning budget rejects a policy mutation even when a later head restores the original bytes',t=>{
  const f=fixture(t),origin=f.engine.store.get('mission',f.missionId),widened={...origin.data.policy,
    planningContracts:{...origin.data.policy.planningContracts,maxCalls:99}},drifted=f.engine.store.put(origin.type,origin.id,
      {...origin.data,policy:widened},{expectedVersion:origin.version});
  f.engine.store.put(drifted.type,drifted.id,{...drifted.data,policy:origin.data.policy},{expectedVersion:drifted.version});
  assert.throws(()=>budget.planningInspectionBudget(f.engine.registry,f.missionId),{code:'PLANNING_INSPECTION_INTEGRITY'});
  assert.equal(f.engine.store.list('planning-inspection-call').length,0);assert.equal(f.engine.store.list('inference-request').length,0);
});
test('planning budget rejects a substituted mandate even when its replacement hash is self-consistent',t=>{
  const f=fixture(t),origin=f.engine.store.get('mission',f.missionId),intent='A substituted mandate cannot inherit this planning admission.';
  f.engine.store.put(origin.type,origin.id,{...origin.data,intent,intentHash:sha256(intent)},{expectedVersion:origin.version});
  const run=f.makeRun(),request=f.requestFor(run),before=f.engine.store.verifyJournal();
  assert.throws(()=>budget.reservePlanningInspection(f.engine.registry,{runId:run.id,request}),
    {code:'PLANNING_RESPONSE_INTEGRITY'});
  assert.deepEqual(f.engine.store.verifyJournal(),before);assert.equal(f.engine.store.list('planning-inspection-call').length,0);
  assert.equal(f.engine.store.list('inference-request').length,0);
});
test('planning budget permits ordinary lifecycle versions that preserve the admitted mandate and policy',t=>{
  const f=fixture(t);f.engine.setStatus(f.missionId,'PLANNING');
  const view=budget.planningInspectionBudget(f.engine.registry,f.missionId);
  assert.equal(view.reserved,0);assert.equal(view.remaining,2);
});
test('planning reservation commits the exact prospective request, pending run and append-only charge together',t=>{
  const f=fixture(t),run=f.makeRun(),request=f.requestFor(run),r=budget.reservePlanningInspection(f.engine.registry,{runId:run.id,request});
  assert.equal(r.type,'planning-inspection-call');assert.equal(r.version,1);assert.equal(r.data.ordinal,1);assert.equal(r.data.runId,run.id);
  assert.equal(r.data.requestHash,f.engine.store.get('run',run.id).data.expectedRequestHash);
  const stored=f.engine.store.get('inference-request',r.data.requestRecord.id);assert.equal(stored.hash,r.data.requestRecord.hash);
  assert.deepEqual(JSON.parse(stored.data.requestJson),request);assert.equal(stored.data.retention,'BEFORE_DISPATCH');
  const origin=f.engine.store.list('planning-cleanup-origin').at(-1),sequence=q=>f.engine.registry.committedSequence(q.type,q.id,q.version);
  assert.ok(origin);assert.deepEqual(origin.data.requestRecord,r.data.requestRecord);assert.deepEqual(origin.data.reservationRecord,{type:r.type,id:r.id,version:r.version,hash:r.hash});
  assert.ok(sequence(stored)<sequence(r));assert.ok(sequence(r)<sequence(origin));
  const b=budget.planningInspectionBudget(f.engine.registry,f.missionId);assert.equal(b.reserved,1);assert.equal(b.remaining,1);
  assert.equal(b.lastReservation.hash,r.hash);assert.equal(f.engine.store.list('artifact').length,0);
  assert.equal(f.engine.store.list('run')[0].data.inferenceReceipt,undefined);assert.ok(f.engine.store.verifyJournal());
});
for(const reference of ['requestRecord','preparedRunRecord','workerConfiguration'])
test('planning budget rejects a syntactically valid reservation with a forged '+reference+' hash',t=>{
  const f=fixture(t),call=persistedReservationFixture(f,{mutate:data=>{data[reference]={...data[reference],hash:'0'.repeat(64)};}});
  assert.equal(call.version,1,'The call itself remains v1; this is not merely hidden-history detection');
  assert.throws(()=>budget.planningInspectionBudget(f.engine.registry,f.missionId),{code:'PLANNING_INSPECTION_INTEGRITY'});
  assert.equal(f.engine.store.get('planning-inspection-call',call.id).version,1);
});
test('planning reservation ceiling survives closed no-response actors and a real SQLite reopen, without pretending reserved calls completed',t=>{
  const f=fixture(t,{maxCalls:2});
  for(let i=1;i<=2;i++){
    const run=f.makeRun(),call=budget.reservePlanningInspection(f.engine.registry,{runId:run.id,request:f.requestFor(run,i)});
    // A reservation alone is not completion. Close the local lifecycle as an
    // explicit no-durable-response disposition so the next distinct actor is
    // a legitimate prospective replacement, not a bypass around an unresolved
    // physical attempt.
    recordPlanningProviderCleanup(f.engine.registry,{runId:run.id,requestHash:call.data.requestHash,
      retention:PLANNING_INSPECTION_RETENTION,reservationRecord:ref(call),confirmed:true,
      result:{processExitObserved:true},outcome:'NO_DURABLE_RESPONSE'});
    retainPlanningInspectionFailure(f.engine.registry,{runId:run.id,requestHash:call.data.requestHash,code:'QUOTA'});
  }
  f.reopen();assert.equal(budget.planningInspectionBudget(f.engine.registry,f.missionId).reserved,2);
  const run=f.makeRun(),request=f.requestFor(run,3),before=f.engine.store.verifyJournal();
  assert.throws(()=>budget.reservePlanningInspection(f.engine.registry,{runId:run.id,request}),{code:'PLANNING_INSPECTION_LIMIT'});
  assert.deepEqual(f.engine.store.verifyJournal(),before);assert.equal(f.engine.store.list('inference-request').length,2);
  assert.ok(f.engine.store.list('run').every(r=>!r.data.inferenceReceipt));
});
test('an unopted mission and an ordinary producer cannot reserve planning inspection',t=>{
  const f=fixture(t,{enabled:false}),r=f.makeRun(),request=f.requestFor(r);
  assert.throws(()=>budget.reservePlanningInspection(f.engine.registry,{runId:r.id,request}));assert.equal(f.engine.store.list('inference-request').length,0);
  const g=fixture(t),ordinary=g.engine.workers.createRun({missionId:g.missionId,nodeId:'result',mode:'producer',purpose:'result',roleIds:['omega_02']});
  assert.throws(()=>budget.reservePlanningInspection(g.engine.registry,{runId:ordinary.id,request:g.requestFor(ordinary)}));
  assert.equal(g.engine.store.list('inference-request').length,0);
});
for(const change of ['ordinal','intent','tools','schema','instructions','model','effort','profile','run-id','call-limit','byte-limit'])
test('planning reservation rejects changed '+change+' before persisting request or budget',t=>{
  const f=fixture(t),run=f.makeRun(),request=f.requestFor(run),envelope=JSON.parse(request.input),task=JSON.parse(envelope.task);
  if(change==='ordinal')task.planningContractControl.callIndex=2;if(change==='intent')task.originalRequest+=' altered';
  if(change==='tools')task.allowedTools=['source.fetch'];if(change==='run-id')task.planningContractControl.runId='run:another';
  if(change==='call-limit')task.planningContractControl.maxCalls=20;if(change==='byte-limit')task.planningContractControl.maxBytes=999999;
  envelope.task=JSON.stringify(task);request.input=JSON.stringify(envelope);
  if(change==='schema')request.schema={type:'object',properties:{}};
  if(change==='instructions')request.instructions+=' altered';if(change==='model')request.model='unapproved-model';
  if(change==='effort')request.reasoningEffort='unapproved-effort';if(change==='profile')request.instructionProfile='scoped-v1';
  const before=f.engine.store.verifyJournal();assert.throws(()=>budget.reservePlanningInspection(f.engine.registry,{runId:run.id,request}));
  assert.deepEqual(f.engine.store.verifyJournal(),before);assert.equal(f.engine.store.list('inference-request').length,0);
  assert.equal(budget.planningInspectionBudget(f.engine.registry,f.missionId).reserved,0);
});
test('planning reservation rollback does not leave a pending request or partially consumed budget on storage failure',t=>{
  const f=fixture(t),run=f.makeRun(),request=f.requestFor(run),put=f.engine.store.put.bind(f.engine.store),before=f.engine.store.verifyJournal();
  const fault=t.mock.method(f.engine.store,'put',(type,...args)=>{if(type==='planning-inspection-call')throw Error('Synthetic reservation write failure');return put(type,...args);});
  assert.throws(()=>budget.reservePlanningInspection(f.engine.registry,{runId:run.id,request}),/Synthetic reservation write failure/);
  fault.mock.restore();assert.deepEqual(f.engine.store.verifyJournal(),before);
  assert.equal(f.engine.store.get('run',run.id).data.expectedRequestHash,undefined);assert.equal(f.engine.store.list('inference-request').length,0);
  assert.equal(f.engine.store.list('planning-cleanup-origin').length,0);assert.equal(budget.planningInspectionBudget(f.engine.registry,f.missionId).reserved,0);
});
test('same-run reservation replay is rejected instead of charging twice or claiming exactly-once remote execution',t=>{
  const f=fixture(t),run=f.makeRun(),request=f.requestFor(run);
  budget.reservePlanningInspection(f.engine.registry,{runId:run.id,request});const before=f.engine.store.verifyJournal();
  assert.throws(()=>budget.reservePlanningInspection(f.engine.registry,{runId:run.id,request}),{code:'INFERENCE_PENDING'});
  assert.deepEqual(f.engine.store.verifyJournal(),before);assert.equal(budget.planningInspectionBudget(f.engine.registry,f.missionId).reserved,1);
});
for(const [name,close] of [
  ['missing cleanup',null],
  ['unconfirmed cleanup',{confirmed:true,result:{processExitObserved:false}}]
])
test('a retained '+name+' cannot open a second planning-control reservation on the same actor',t=>{
  const f=fixture(t),run=f.makeRun(),first=budget.reservePlanningInspection(f.engine.registry,{runId:run.id,request:f.requestFor(run)}),receipt={status:'completed',threadId:'retained-'+name,
    turnId:'fixture',contextHash:first.data.requestHash},raw=retainPlanningInspectionMessage(f.engine.registry,{runId:run.id,requestHash:first.data.requestHash,receipt,value:inspection()});
  if(close)recordPlanningProviderCleanup(f.engine.registry,{runId:run.id,requestHash:first.data.requestHash,retention:PLANNING_INSPECTION_RETENTION,
    reservationRecord:ref(first),outcome:'RETAINED',outcomeRecord:ref(raw),...close});
  assert.equal(f.engine.store.get('run',run.id).data.expectedRequestHash,null,'The completed receipt alone is not the new-reservation authority');
  const next=f.requestFor(run,2,{updateContext:false}),before=f.engine.store.verifyJournal();
  assert.throws(()=>budget.reservePlanningInspection(f.engine.registry,{runId:run.id,request:next}),{code:'CLEANUP_UNCONFIRMED'});
  assert.deepEqual(f.engine.store.verifyJournal(),before);assert.equal(f.engine.store.list('planning-inspection-call').length,1);
  assert.equal(f.engine.store.list('inference-request').length,1);assert.equal(budget.planningInspectionBudget(f.engine.registry,f.missionId).reserved,1);
});
test('an unresolved first planning actor cannot reserve a second actor control call',t=>{
  const f=fixture(t),firstActor=f.makeRun(),first=budget.reservePlanningInspection(f.engine.registry,{runId:firstActor.id,request:f.requestFor(firstActor)}),receipt={status:'completed',
    threadId:'foreign-pending-control',turnId:'fixture',contextHash:first.data.requestHash};
  retainPlanningInspectionMessage(f.engine.registry,{runId:firstActor.id,requestHash:first.data.requestHash,receipt,value:inspection()});
  const secondActor=f.makeRun(),next=f.requestFor(secondActor,2),before=f.engine.store.verifyJournal();
  assert.throws(()=>budget.reservePlanningInspection(f.engine.registry,{runId:secondActor.id,request:next}),{code:'CLEANUP_UNCONFIRMED'});
  assert.deepEqual(f.engine.store.verifyJournal(),before);assert.equal(f.engine.store.list('planning-inspection-call').length,1);
  assert.equal(f.engine.store.list('inference-request').length,1);assert.equal(f.engine.store.get('run',secondActor.id).data.expectedRequestHash,undefined);
  assert.equal(budget.planningInspectionBudget(f.engine.registry,f.missionId).reserved,1);
});
test('a closed no-response actor needs its exact failure token before another actor can reserve',t=>{
  const f=fixture(t),firstActor=f.makeRun(),first=budget.reservePlanningInspection(f.engine.registry,
    {runId:firstActor.id,request:f.requestFor(firstActor)});
  recordPlanningProviderCleanup(f.engine.registry,{runId:firstActor.id,requestHash:first.data.requestHash,
    retention:PLANNING_INSPECTION_RETENTION,reservationRecord:ref(first),confirmed:true,
    result:{processExitObserved:true},outcome:'NO_DURABLE_RESPONSE'});
  const secondActor=f.makeRun(),next=f.requestFor(secondActor,2),before=f.engine.store.verifyJournal();
  assert.throws(()=>budget.reservePlanningInspection(f.engine.registry,{runId:secondActor.id,request:next}),
    {code:'PLANNING_INSPECTION_PENDING'});
  assert.deepEqual(f.engine.store.verifyJournal(),before);assert.equal(f.engine.store.list('planning-inspection-call').length,1);
  const failure=retainPlanningInspectionFailure(f.engine.registry,{runId:firstActor.id,requestHash:first.data.requestHash,code:'QUOTA'});
  const replacement=budget.reservePlanningInspection(f.engine.registry,{runId:secondActor.id,request:next});
  assert.equal(failure.type,'planning-inspection-failure');assert.equal(replacement.data.ordinal,2);
  assert.equal(replacement.data.runId,secondActor.id);assert.equal(f.engine.store.list('planning-inspection-call').length,2);
});
for(const [name,install] of [
  ['a superseded failure token',(f,first)=>{
    const failure=retainPlanningInspectionFailure(f.engine.registry,{runId:first.actor.id,requestHash:first.call.data.requestHash,code:'QUOTA'});
    f.engine.store.put(failure.type,failure.id,failure.data,{expectedVersion:failure.version});
  }],
  ['a token bound to the wrong cleanup record',(f,first)=>{
    const cleanup=f.engine.store.list('planning-provider-cleanup').at(-1),id='planning-inspection-failure:'+sha256(ref(first.call));
    f.engine.store.put('planning-inspection-failure',id,{schema:'sovereign.planning-inspection-failure.v1',runId:first.actor.id,
      requestHash:first.call.data.requestHash,reservationRecord:ref(first.call),code:'QUOTA',disposition:'ABANDONED_INFERENCE_ONLY',
      providerCompletion:'UNCONFIRMED',cleanupRecord:{...ref(cleanup),hash:'0'.repeat(64)}},{expectedVersion:0});
  }],
  ['a hidden failure-token head',(f,first)=>{
    const failure=retainPlanningInspectionFailure(f.engine.registry,{runId:first.actor.id,requestHash:first.call.data.requestHash,code:'QUOTA'});
    f.engine.store.db.prepare('DELETE FROM heads WHERE type=? AND id=?').run(failure.type,failure.id);
  }]
])
test('a closed no-response actor with '+name+' cannot authorize another actor',t=>{
  const f=fixture(t),actor=f.makeRun(),call=budget.reservePlanningInspection(f.engine.registry,{runId:actor.id,request:f.requestFor(actor)});
  recordPlanningProviderCleanup(f.engine.registry,{runId:actor.id,requestHash:call.data.requestHash,retention:PLANNING_INSPECTION_RETENTION,
    reservationRecord:ref(call),confirmed:true,result:{processExitObserved:true},outcome:'NO_DURABLE_RESPONSE'});
  install(f,{actor,call});const replacementActor=f.makeRun(),next=f.requestFor(replacementActor,2),beforeCalls=f.engine.store.list('planning-inspection-call').length,
    beforeRequests=f.engine.store.list('inference-request').length;
  assert.throws(()=>budget.reservePlanningInspection(f.engine.registry,{runId:replacementActor.id,request:next}),
    {code:'PLANNING_INSPECTION_INTEGRITY'});
  assert.equal(f.engine.store.list('planning-inspection-call').length,beforeCalls);
  assert.equal(f.engine.store.list('inference-request').length,beforeRequests);
});
test('a superseded retained control outcome is unverified and cannot authorize a second reservation',t=>{
  const f=fixture(t),run=f.makeRun(),first=budget.reservePlanningInspection(f.engine.registry,{runId:run.id,request:f.requestFor(run)}),receipt={status:'completed',
    threadId:'superseded-control',turnId:'fixture',contextHash:first.data.requestHash},raw=retainPlanningInspectionMessage(f.engine.registry,
      {runId:run.id,requestHash:first.data.requestHash,receipt,value:inspection()});
  recordPlanningProviderCleanup(f.engine.registry,{runId:run.id,requestHash:first.data.requestHash,retention:PLANNING_INSPECTION_RETENTION,
    reservationRecord:ref(first),confirmed:true,result:{processExitObserved:true},outcome:'RETAINED',outcomeRecord:ref(raw)});
  // This is a valid append-only SQLite history but not a valid response
  // lifecycle: the cleanup deliberately binds v1 while the public head is v2.
  f.engine.store.put(raw.type,raw.id,raw.data,{expectedVersion:raw.version});
  const observation=readPlanningCleanupObservation(f.engine.registry,{runId:run.id,requestHash:first.data.requestHash,
    retention:PLANNING_INSPECTION_RETENTION,reservationRecord:ref(first)});
  assert.equal(observation.publicState,'UNVERIFIED');
  assert.throws(()=>readPlanningInspectionMessage(f.engine.registry,run.id,first.data.requestHash),{code:'PLANNING_INSPECTION_INTEGRITY'});
  const next=f.requestFor(run,2,{updateContext:false}),before=f.engine.store.verifyJournal();
  assert.throws(()=>budget.reservePlanningInspection(f.engine.registry,{runId:run.id,request:next}),{code:'PLANNING_INSPECTION_INTEGRITY'});
  assert.deepEqual(f.engine.store.verifyJournal(),before);assert.equal(f.engine.store.list('planning-inspection-call').length,1);
  assert.equal(f.engine.store.list('inference-request').length,1);assert.equal(budget.planningInspectionBudget(f.engine.registry,f.missionId).reserved,1);
});
test('an older uncertain lifecycle blocks a third reservation even when the latest historical call was closed',t=>{
  const f=fixture(t,{maxCalls:3}),run=f.makeRun(),retain=(call,label)=>{
    const receipt={status:'completed',threadId:'history-'+label,turnId:'fixture',contextHash:call.data.requestHash},raw=retainPlanningInspectionMessage(f.engine.registry,
      {runId:run.id,requestHash:call.data.requestHash,receipt,value:inspection()});
    return recordPlanningProviderCleanup(f.engine.registry,{runId:run.id,requestHash:call.data.requestHash,retention:PLANNING_INSPECTION_RETENTION,
      reservationRecord:ref(call),confirmed:true,result:{processExitObserved:true},outcome:'RETAINED',outcomeRecord:ref(raw)});
  };
  const first=budget.reservePlanningInspection(f.engine.registry,{runId:run.id,request:f.requestFor(run,1)});retain(first,'first');
  const second=budget.reservePlanningInspection(f.engine.registry,{runId:run.id,request:f.requestFor(run,2,{updateContext:false})});retain(second,'second');
  // Simulate an old contaminated history: the first close was later found
  // inconsistent while the latest call remains a clean closed record. The
  // next reservation must inspect every ancestor, not just `second`.
  const firstCleanup=f.engine.store.list('planning-provider-cleanup').find(r=>r.data.requestHash===first.data.requestHash),altered={...firstCleanup.data,
    status:'UNCONFIRMED',adapterCloseConfirmed:false,processExitObserved:null};
  f.engine.store.put(firstCleanup.type,firstCleanup.id,altered,{expectedVersion:firstCleanup.version});
  const third=f.requestFor(run,3,{updateContext:false}),before=f.engine.store.verifyJournal();
  assert.throws(()=>budget.reservePlanningInspection(f.engine.registry,{runId:run.id,request:third}),{code:'PLANNING_INSPECTION_INTEGRITY'});
  assert.deepEqual(f.engine.store.verifyJournal(),before);assert.equal(f.engine.store.list('planning-inspection-call').length,2);
  assert.equal(f.engine.store.list('inference-request').length,2);assert.equal(budget.planningInspectionBudget(f.engine.registry,f.missionId).reserved,2);
});
for(const change of ['reversion','hidden-head','policy'])test('planning budget cannot be reset through '+change,t=>{
  const f=fixture(t),run=f.makeRun(),request=f.requestFor(run),r=budget.reservePlanningInspection(f.engine.registry,{runId:run.id,request});
  if(change==='reversion')f.engine.store.put(r.type,r.id,{...r.data,ordinal:0},{expectedVersion:r.version});
  if(change==='hidden-head')f.engine.store.db.prepare('DELETE FROM heads WHERE type=? AND id=?').run(r.type,r.id);
  if(change==='policy'){const m=f.engine.store.get('mission',f.missionId);f.engine.store.put(m.type,m.id,{...m.data,policy:{...m.data.policy,planningContracts:{...m.data.policy.planningContracts,maxCalls:20}}},{expectedVersion:m.version});}
  assert.throws(()=>budget.planningInspectionBudget(f.engine.registry,f.missionId),{code:'PLANNING_INSPECTION_INTEGRITY'});
  assert.equal(f.engine.store.db.isTransaction,false);
});
test('planning budget preserves caller transactions and rejects JavaScript accessors without executing them',t=>{
  const f=fixture(t),run=f.makeRun(),request=f.requestFor(run),before=f.engine.store.verifyJournal();
  f.engine.store.transact(()=>{assert.equal(budget.planningInspectionBudget(f.engine.registry,f.missionId).reserved,0);assert.equal(f.engine.store.db.isTransaction,true);});
  let reads=0;const input={runId:run.id};Object.defineProperty(input,'request',{enumerable:true,get(){reads++;return request;}});
  assert.throws(()=>budget.reservePlanningInspection(f.engine.registry,input),{code:'SCHEMA'});assert.equal(reads,0);
  const opaque={runId:run.id,request};Object.defineProperty(opaque,'missionInferenceDispatchPreflight',{enumerable:true,get(){reads++;return {opaque:true};}});
  assert.throws(()=>budget.reservePlanningInspection(f.engine.registry,opaque),{code:'SCHEMA'});assert.equal(reads,0,'The process-local handoff is never an executable accessor either');
  assert.deepEqual(f.engine.store.verifyJournal(),before);
});
test('planning inspection rejects a prefix carrying an overlay from an unevaluated protocol',t=>{
  const f=fixture(t),run=f.makeRun(),request=f.requestFor(run),c=f.engine.store.get('worker-config',run.id);
  f.engine.store.put(c.type,c.id,{...c.data,learnedInstructionVersions:[{roleId:'omega_04',hash:'f'.repeat(64),version:1}]},{expectedVersion:c.version});
  assert.throws(()=>budget.reservePlanningInspection(f.engine.registry,{runId:run.id,request}),{code:'LEARNING_SCOPE'});
  assert.equal(budget.planningInspectionBudget(f.engine.registry,f.missionId).reserved,0);assert.equal(f.engine.store.list('inference-request').length,0);
});
test('REAL two-process SQLite contention cannot create a second planning reservation',async t=>{
  const f=fixture(t,{maxCalls:1}),actors=[f.makeRun(),f.makeRun()];
  const children=actors.map((run,i)=>{
    const inputPath=join(f.directory,'request-'+i+'.json');writeFileSync(inputPath,JSON.stringify(f.requestFor(run)),{flag:'wx',mode:0o600});
    const child=spawn(process.execPath,[new URL('./fixtures/planning-budget-reserve.mjs',import.meta.url).pathname,f.directory,run.id,inputPath],
      {stdio:['ignore','ignore','pipe']});let stderr='';child.stderr.on('data',b=>{stderr+=b;});
    const done=new Promise((resolve,reject)=>{child.once('error',reject);child.once('close',(code,signal)=>resolve({code,signal,stderr}));});
    t.after(()=>{if(child.exitCode===null&&child.signalCode===null)child.kill('SIGKILL');});return {child,done};
  });
  const timer=setTimeout(()=>{for(const {child}of children)if(child.exitCode===null&&child.signalCode===null)child.kill('SIGKILL');},15000);
  let outcomes;try{outcomes=await Promise.all(children.map(c=>c.done));}finally{clearTimeout(timer);}
  assert.ok(outcomes.every(r=>r.signal===null),JSON.stringify(outcomes));
  assert.deepEqual(outcomes.map(r=>r.code).sort((a,b)=>a-b),[0,86],JSON.stringify(outcomes));
  const b=budget.planningInspectionBudget(f.engine.registry,f.missionId);assert.equal(b.reserved,1);assert.equal(b.remaining,0);
  assert.equal(f.engine.store.list('inference-request').length,1);assert.equal(f.engine.store.list('artifact').length,0);f.engine.store.verifyJournal();
});
