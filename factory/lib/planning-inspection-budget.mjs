// Prospective planning reservations, not provider execution or a control cursor.
// The global ceiling is derived from immutable per-call records: there is no
// mutable counter to reset when a new planning actor or process is created.
import {check,clone,canonical,keys,identifier,digest,sha256} from './contracts.mjs';
import {planningInspectionPolicy,PLANNING_MESSAGE_SCHEMA} from './planning-inspection-contract.mjs';
import {assertPlanningMissionPolicyFrozen,planningCleanupEnabled,planningResponseActor,readPlanningCleanupObservation,readPlanningInspectionReplacementFailure,recordPlanningCleanupOrigin} from './planning-response.mjs';
import {readSourceContextView} from './source-context-view.mjs';
import {inferenceRequestHash} from '../providers/instruction-profiles.mjs';

const TYPE='planning-inspection-call',SCHEMA='sovereign.planning-inspection-call.v1';
const INSPECTION_RETENTION='planning-inspection-response-v1';
const ref=r=>({type:r.type,id:r.id,version:r.version,hash:r.hash});
const prefixFor=missionId=>'planning-call:'+sha256(missionId)+':';
const integrity=(ok,message)=>check(ok,'PLANNING_INSPECTION_INTEGRITY',message);
// A planning reservation is a durable admission boundary.  Capture its
// top-level data properties from descriptors before reading any value: a
// getter must not be able to execute merely because the call is rejected.
// `missionInferenceDispatchPreflight` is process-local and intentionally is
// not cloned into the durable request, but it is still required to be a data
// property so it cannot become an implicit callback at this boundary.
function reservationInput(input){
  check(input&&typeof input==='object'&&!Array.isArray(input)&&Object.getPrototypeOf(input)===Object.prototype,
    'SCHEMA','Planning inspection reservation input must be a plain object');
  const descriptors=Object.getOwnPropertyDescriptors(input),allowed=['runId','request','missionInferenceDispatchPreflight'];
  check(Reflect.ownKeys(input).every(key=>typeof key==='string'&&allowed.includes(key)&&descriptors[key].enumerable
    &&Object.hasOwn(descriptors[key],'value')),
  'SCHEMA','Planning inspection reservation input contains an unknown field or accessor');
  check(['runId','request'].every(key=>Object.hasOwn(descriptors,key)),
    'SCHEMA','Planning inspection reservation input is missing a required field');
  return {runId:descriptors.runId.value,request:descriptors.request.value,
    missionInferenceDispatchPreflight:descriptors.missionInferenceDispatchPreflight?.value??null};
}
function snapshot(registry,read){
  const db=registry.store.db,own=!db.isTransaction;if(own)db.exec('BEGIN');
  try{return read();}finally{if(own&&db.isTransaction)db.exec('ROLLBACK');}
}
// A reservation is not self-authenticating.  Its embedded references are
// evidence only when they resolve to the exact immutable rows that existed at
// reservation time (and, where custody requires it, still remain current).
// This local helper intentionally does not accept a shape-compatible record
// with the same ID and prevents a future report/budget reader from treating a
// caller-provided hash as a proof.
function boundRecord(store,bound,{type,id,head=false,label='planning reference'}={}){
  keys(bound,['type','id','version','hash']);
  identifier(bound.type);identifier(bound.id);digest(bound.hash);
  integrity(bound.type===type&&bound.id===id&&Number.isSafeInteger(bound.version)&&bound.version>0,
    `${label} type, identity or version changed`);
  const actual=store.get(type,id,head?null:bound.version);
  integrity(actual&&canonical(ref(actual))===canonical(bound),`${label} is missing, changed or no longer current`);
  return actual;
}
function sequence(registry,record,label){
  const value=registry.committedSequence(record.type,record.id,record.version);
  integrity(Number.isSafeInteger(value)&&value>0,`${label} has no committed journal order`);
  return value;
}
function requestEntry(run,requestHash,label,{bindCurrentContext=true}={}){
  const matches=Array.isArray(run?.data?.requests)?run.data.requests.filter(item=>item?.requestHash===requestHash):[];
  integrity(matches.length===1&&(!bindCurrentContext||matches[0].contextHash===run.data.contextHash),`${label} does not retain its exact request/context entry`);
  return matches[0];
}
function validateReservationLineage(registry,{mission,policy,call,index,prior=null}){
  const {store}=registry,d=call.data;
  try{
    const actor=planningResponseActor(registry,d.runId),currentRun=actor.run,configuration=boundRecord(store,d.workerConfiguration,
      {type:'worker-config',id:d.runId,head:true,label:'planning worker configuration'}),prepared=boundRecord(store,d.preparedRunRecord,
      {type:'run',id:d.runId,label:'prepared planning run'}),request=boundRecord(store,d.requestRecord,
      {type:'inference-request',id:'inference-request:'+sha256([d.runId,d.requestHash]),head:true,label:'prospective planning request'});
    // The current actor gate prevents an orphaned historical run from being
    // relabelled as a planner. The exact configuration reference prevents a
    // newer/mismatched compile from lending it its role charter.
    integrity(actor.mission.data.id===mission.id&&canonical(ref(actor.configuration))===canonical(d.workerConfiguration)
      &&configuration.version===1&&canonical(configuration.data.roleIds)===canonical(['omega_04','omega_05'])
      &&Array.isArray(configuration.data.learnedInstructionVersions)&&configuration.data.learnedInstructionVersions.length===0,
    'Planning actor or immutable configuration differs from its reservation');
    const preparedData=prepared.data,current=currentRun.data;
    integrity(preparedData.id===d.runId&&preparedData.missionId===mission.id&&preparedData.mode==='producer'
      &&preparedData.nodeId==='planning'&&preparedData.context?.purpose==='plan'
      &&preparedData.contextHash===sha256(preparedData.context)&&preparedData.expectedRequestHash===d.requestHash
      &&current.id===d.runId&&current.missionId===mission.id&&current.mode==='producer'&&current.nodeId==='planning'
      &&current.context?.purpose==='plan',
    'Prepared planning actor changed its mission, purpose, context or pending request');
    requestEntry(prepared,d.requestHash,'Prepared planning run');requestEntry(currentRun,d.requestHash,'Current planning run',{bindCurrentContext:false});
    const requestData=request.data;
    keys(requestData,['schema','runId','missionId','requestHash','retention','requestJson']);
    integrity(request.version===1&&requestData.schema==='sovereign.inference-request.v1'&&requestData.retention==='BEFORE_DISPATCH'
      &&requestData.runId===d.runId&&requestData.missionId===mission.id&&requestData.requestHash===d.requestHash,
    'Prospective planning request differs from its reservation');
    let wire,task;try{wire=JSON.parse(requestData.requestJson);task=JSON.parse(readSourceContextView(wire.input).task);}catch{}
    integrity(wire&&task&&inferenceRequestHash(wire)===d.requestHash&&sha256(wire.schema)===sha256(PLANNING_MESSAGE_SCHEMA)
      &&wire.model===mission.policy.model&&wire.reasoningEffort===mission.policy.reasoningEffort
      &&(wire.instructionProfile??'model-default')===(mission.policy.instructionProfile??'model-default')
      &&sha256(wire.instructions)===preparedData.context.instructionsHash&&wire.instructions.startsWith(configuration.data.instructions)
      &&task.originalRequest===mission.intent&&task.intentHash===mission.intentHash
      &&canonical(task.allowedTools)===canonical(mission.policy.allowedTools)
      &&canonical(task.planningContractControl)===canonical({schema:'sovereign.planning-contract-control.v1',runId:d.runId,
        callIndex:index+1,maxCalls:policy.maxCalls,maxBytes:policy.maxBytes}),
    'Prospective planning request does not bind the exact admitted mandate, contract control or worker configuration');
    let parent=null;
    if(d.parentPlanRecord!==null){
      parent=boundRecord(store,d.parentPlanRecord,{type:'plan',id:mission.id,label:'planning parent plan'});
      integrity(canonical(task.previousPlan??null)===canonical(parent.data.plan),'Planning request parent plan differs from its exact historical reference');
    }else integrity((task.previousPlan??null)===null,'Planning request invented a parent plan without a historical reference');
    const configurationSequence=sequence(registry,configuration,'Planning worker configuration'),preparedSequence=sequence(registry,prepared,'Prepared planning run'),
      requestSequence=sequence(registry,request,'Prospective planning request'),callSequence=sequence(registry,call,'Planning reservation'),
      priorSequence=prior?sequence(registry,prior,'Previous planning reservation'):0;
    integrity(configurationSequence<preparedSequence&&preparedSequence<requestSequence&&requestSequence<callSequence
      &&priorSequence<requestSequence,'Planning reservation chronology does not bind configuration, pending run, request and predecessor order');
    if(parent)integrity(sequence(registry,parent,'Planning parent plan')<requestSequence,
      'Planning parent plan was not committed before the request that referenced it');
  }catch(error){
    // Keep this reader failure-closed under the protocol-specific error code.
    // Its public caller turns that controlled failure into an UNVERIFIED budget
    // rather than falling back to the raw reservation payload.
    if(error?.code==='PLANNING_INSPECTION_INTEGRITY')throw error;
    integrity(false,'Planning reservation lineage could not be revalidated');
  }
}
function budgetSnapshot(registry,missionId){
  identifier(missionId);const store=registry.store,mission=assertPlanningMissionPolicyFrozen(registry,missionId,
    {code:'PLANNING_INSPECTION_INTEGRITY'}).mission.data;
  check(mission.policy?.planningContracts!==undefined,'PLANNING_INSPECTION_SCOPE','Explicit planning inspection policy required');
  const policy=planningInspectionPolicy(mission.policy.planningContracts),policyHash=sha256(mission.policy),prefix=prefixFor(missionId);
  // Indexed exact-prefix range, not a scan of other missions or their requests.
  const ids=store.db.prepare('SELECT id FROM heads WHERE type=? AND id>=? AND id<? ORDER BY id').all(TYPE,prefix,prefix+'\uffff');
  const history=store.db.prepare('SELECT count(*) AS n FROM records WHERE type=? AND id>=? AND id<?').get(TYPE,prefix,prefix+'\uffff').n;
  integrity(history===ids.length&&history<=policy.maxCalls,'Hidden, reversioned or excessive planning reservations');
  const calls=ids.map(({id})=>store.get(TYPE,id)).sort((a,b)=>a.data.ordinal-b.data.ordinal);
  let lastSequence=0;
  for(const [i,r]of calls.entries()){
    const d=r.data;
    integrity(r.version===1&&d.schema===SCHEMA&&d.ordinal===i+1&&r.id===prefix+(i+1)
      &&d.missionId===missionId&&d.intentHash===mission.intentHash&&d.policyHash===policyHash
      &&canonical(d.policy)===canonical(policy),'Planning reservation order, policy or scope changed');
    keys(d,['schema','missionId','intentHash','policyHash','policy','ordinal','runId','requestHash','requestRecord','preparedRunRecord','workerConfiguration','parentPlanRecord','priorCall']);
    identifier(d.runId);digest(d.requestHash);
    for(const r of [d.requestRecord,d.preparedRunRecord,d.workerConfiguration]){keys(r,['type','id','version','hash']);identifier(r.type);identifier(r.id);digest(r.hash);}
    if(d.parentPlanRecord!==null){const p=d.parentPlanRecord;keys(p,['type','id','version','hash']);digest(p.hash);
      integrity(p.type==='plan'&&p.id===missionId&&Number.isSafeInteger(p.version)&&p.version>0,'Planning parent-plan reference changed');}
    integrity(d.requestRecord.type==='inference-request'&&d.requestRecord.version===1
      &&d.requestRecord.id==='inference-request:'+sha256([d.runId,d.requestHash])
      &&d.preparedRunRecord.type==='run'&&d.preparedRunRecord.id===d.runId&&Number.isSafeInteger(d.preparedRunRecord.version)&&d.preparedRunRecord.version>0
      &&d.workerConfiguration.type==='worker-config'&&d.workerConfiguration.id===d.runId&&d.workerConfiguration.version===1
      &&canonical(d.priorCall)===canonical(i?ref(calls[i-1]):null),'Planning reservation references changed');
    validateReservationLineage(registry,{mission,policy,call:r,index:i,prior:i?calls[i-1]:null});
    const callSequence=sequence(registry,r,'Planning reservation');
    integrity(callSequence>lastSequence,'Planning reservation order is not strictly increasing');
    lastSequence=callSequence;
  }
  return {mission,policy,policyHash,calls,view:{schema:'sovereign.planning-inspection-budget.v1',missionId,
    mode:policy.mode,maxCalls:policy.maxCalls,maxBytes:policy.maxBytes,reserved:calls.length,remaining:policy.maxCalls-calls.length,
    lastReservation:calls.length?ref(calls.at(-1)):null,
    scope:'Prospective reserved planning attempts across this mission, not provider dispatches, completed responses, billed tokens or quality failures. No counter reset by actor/process; control-cursor and response recovery are separate obligations.'}};
}

export function planningInspectionBudget(registry,missionId){
  return snapshot(registry,()=>budgetSnapshot(registry,missionId).view);
}

/** Stable discovery from immutable reservations, never the mutable latest run
 * receipt. A pending newer call cannot redirect recovery to an older reply. */
export function planningInspectionReservation(registry,runId,requestHash=null){
  identifier(runId);if(requestHash!==null)digest(requestHash);
  return snapshot(registry,()=>{
    const actor=planningResponseActor(registry,runId),b=budgetSnapshot(registry,actor.mission.id);
    const candidates=b.calls.filter(c=>c.data.runId===runId);
    const call=requestHash===null?candidates.at(-1):candidates.find(c=>c.data.requestHash===requestHash);
    if(requestHash!==null)integrity(!!call,'Request has no prospective planning reservation');
    return call?clone(call):null;
  });
}

/** The caller must already have built/bounded the exact worker request. This
 * transaction records it and its charge together, before any provider call.
 * No replay is performed here; a pending inference remains a pending inference. */
export function reservePlanningInspection(registry,input){
  // Keep the process-local mission provenance handoff out of canonicalized
  // durable input.  It is intentionally opaque and is consumed only by the
  // registry in the same reservation transaction.
  const raw=reservationInput(input),missionInferenceDispatchPreflight=raw.missionInferenceDispatchPreflight,
    captured=clone({runId:raw.runId,request:raw.request}),{runId,request}=captured;
  return registry.store.transact(()=>{
    const actor=planningResponseActor(registry,runId),run=actor.run.data;
    check(!run.expectedRequestHash,'INFERENCE_PENDING','Planning actor already has a pending request; reconcile it before another reservation');
    check(actor.configuration.version===1&&actor.configuration.data.learnedInstructionVersions?.length===0,
      'LEARNING_SCOPE','Planning inspection cannot import an overlay evaluated under the previous protocol');
    const b=budgetSnapshot(registry,run.missionId);
    // A completed receipt clears `expectedRequestHash`, but it is not by
    // itself permission to issue a second control call.  In particular, a
    // response retained before close must remain quarantined until the exact
    // lifecycle is CLOSED/RETAINED; otherwise this low-level reservation API
    // could spend a new request on the same actor around an uncertain close.
    const priors=b.calls;
    if(priors.length&&planningCleanupEnabled(registry,runId)){
      // A second actor cannot turn an unresolved first actor into an excuse for
      // another physical dispatch. Inspect every mission reservation, not only
      // the current actor's latest call: an uncertain predecessor must remain
      // quarantined across actor replacement as well as across same-run retry.
      // A different actor may follow AVAILABLE, or a CLOSED
      // NO_DURABLE_RESPONSE only when the exact post-close failure token also
      // verifies. The disposition alone means merely that no response was
      // retained; a crash between cleanup and that token remains pending and
      // cannot buy a replacement. The same actor remains stricter: only a
      // closed retained control response can precede its next inspection
      // request.
      for(const prior of priors){
        const observation=readPlanningCleanupObservation(registry,{runId:prior.data.runId,requestHash:prior.data.requestHash,
          retention:INSPECTION_RETENTION,reservationRecord:ref(prior)});
        const sameActor=prior.data.runId===runId;
        const replacementFailure=!sameActor&&observation.publicState==='NO_DURABLE_RESPONSE'
          ?readPlanningInspectionReplacementFailure(registry,{runId:prior.data.runId,requestHash:prior.data.requestHash,
            reservationRecord:ref(prior)}):null;
        const permitted=sameActor?observation.publicState==='AVAILABLE'
          :observation.publicState==='AVAILABLE'||replacementFailure!==null;
        const code=observation.publicState==='RECONCILIATION_REQUIRED'?'INFERENCE_OUTCOME_UNKNOWN'
          :observation.publicState==='UNVERIFIED'?'PLANNING_INSPECTION_INTEGRITY'
          :observation.publicState==='NO_DURABLE_RESPONSE'?'PLANNING_INSPECTION_PENDING':'CLEANUP_UNCONFIRMED';
        check(permitted,code,sameActor
          ?'A prior planning control lifecycle is not a closed retained result; reconcile it before reserving another control call on this actor'
          :'A prior planning actor lacks an exact closed replacement-failure token; reconcile it before reserving another actor\'s control call');
      }
    }
    check(b.calls.length<b.policy.maxCalls,'PLANNING_INSPECTION_LIMIT','Explicit global planning reservation ceiling exhausted; no policy reset or implicit extension');
    keys(request,['instructions','input','schema','model','reasoningEffort','instructionProfile'],['instructions','input','schema','model','reasoningEffort']);
    let task;try{task=JSON.parse(readSourceContextView(request.input).task);}catch{}
    integrity(task&&task.originalRequest===b.mission.intent&&task.intentHash===b.mission.intentHash
      &&canonical(task.allowedTools)===canonical(b.mission.policy.allowedTools),'Exact immutable planning task required');
    const parentPlan=registry.store.get('plan',run.missionId);
    integrity(canonical(task.previousPlan??null)===canonical(parentPlan?.data.plan??null),'Planning request must preserve the exact prior plan at reservation');
    integrity(canonical(task.planningContractControl)===canonical({schema:'sovereign.planning-contract-control.v1',runId,
      callIndex:b.calls.length+1,maxCalls:b.policy.maxCalls,maxBytes:b.policy.maxBytes}),'Planning request reservation metadata changed');
    integrity(sha256(request.schema)===sha256(PLANNING_MESSAGE_SCHEMA)
      &&request.model===b.mission.policy.model&&request.reasoningEffort===b.mission.policy.reasoningEffort
      &&(request.instructionProfile??'model-default')===(b.mission.policy.instructionProfile??'model-default')
      &&sha256(request.instructions)===run.context.instructionsHash&&request.instructions.startsWith(actor.configuration.data.instructions),
    'Planning request schema, target, profile or instructions changed');
    const requestHash=registry.recordInferenceRequest(runId,request,{missionInferenceDispatchPreflight}),store=registry.store;
    const retained=store.get('inference-request','inference-request:'+sha256([runId,requestHash])),pending=store.get('run',runId);
    integrity(retained?.version===1&&retained.data.retention==='BEFORE_DISPATCH'&&retained.data.requestHash===requestHash
      &&pending.data.expectedRequestHash===requestHash,'Planning request was not prospectively retained');
    const ordinal=b.calls.length+1;
    const call=store.put(TYPE,prefixFor(run.missionId)+ordinal,{schema:SCHEMA,missionId:run.missionId,intentHash:b.mission.intentHash,
      policyHash:b.policyHash,policy:b.policy,ordinal,runId,requestHash,requestRecord:ref(retained),preparedRunRecord:ref(pending),
      workerConfiguration:ref(actor.configuration),parentPlanRecord:parentPlan?ref(parentPlan):null,
      priorCall:b.calls.length?ref(b.calls.at(-1)):null},{expectedVersion:0});
    if(planningCleanupEnabled(registry,runId))recordPlanningCleanupOrigin(registry,{runId,requestHash,retention:INSPECTION_RETENTION,
      reservationRecord:ref(call)});
    return call;
  });
}
