// Durable public plan answers, not plan acceptance or remote exactly-once.
import {canonical,check,clone,digest,identifier,keys,sha256} from './contracts.mjs';
import {assertMissionPolicyFrozen} from './mission-policy-freeze.mjs';
import {PLAN_SCHEMA,validatePlanProposal} from './plans.mjs';
import {inferenceRequestHash} from '../providers/instruction-profiles.mjs';
import {readSourceContextView} from './source-context-view.mjs';
import {planningRoleCoverage} from './plan-role-review.mjs';

export const PLANNING_RESPONSE_RETENTION='planning-response-v1';
// New planning missions bind every physical planning dispatch to a durable
// close barrier.  This is deliberately policy-versioned: a historical mission
// that was created before the protocol is not retroactively claimed to have
// closure evidence it never recorded.
export const PLANNING_CLEANUP_PROTOCOL='planning-cleanup-v1';
export const PLANNING_CLEANUP_ORIGIN_SCHEMA='sovereign.planning-cleanup-origin.v1';
export const PLANNING_PROVIDER_CLEANUP_SCHEMA='sovereign.planning-provider-cleanup.v1';
// A read-only diagnostic projection.  It is deliberately weaker than a
// consumption proof: it describes the local barrier without revealing a
// quarantined value or granting any replay/replacement authority.
export const PLANNING_CLEANUP_OBSERVATION_SCHEMA='sovereign.planning-cleanup-observation.v1';
const TYPE='planning-response',SCHEMA='sovereign.planning-response.v1';
const FAILURE='planning-response-failure',FAILURE_SCHEMA='sovereign.planning-response-failure.v1';
const ORIGIN='planning-cleanup-origin',CLEANUP='planning-provider-cleanup';
const INSPECTION_FAILURE='planning-inspection-failure';
// Kept as a literal here to avoid a planning-response <-> inspection-response
// import cycle. The inspection module owns the public constant and passes it
// back through the same exact retention string.
const INSPECTION_RETENTION='planning-inspection-response-v1';
const ref=r=>({type:r.type,id:r.id,version:r.version,hash:r.hash});
// One final plan response per planning run, even if a future inspection protocol
// makes earlier control calls. A changed/missing run receipt cannot hide it by
// redirecting the lookup to another request hash.
const identity=runId=>TYPE+':'+sha256(runId);
const failureIdentity=runId=>FAILURE+':'+sha256(runId);
const inspectionResponseIdentity=reservationRecord=>'planning-inspection-response:'+sha256(reservationRecord);
const inspectionFailureIdentity=reservationRecord=>INSPECTION_FAILURE+':'+sha256(reservationRecord);
const originIdentity=(runId,requestHash)=>ORIGIN+':'+sha256([runId,requestHash]);
const cleanupIdentity=(runId,requestHash)=>CLEANUP+':'+sha256([runId,requestHash]);
const integrity=(condition,message)=>check(condition,'PLANNING_RESPONSE_INTEGRITY',message);
const cleanupScope='Trusted provider.close outcome for one exact planning request. Missing or failed closure is UNKNOWN; a public response never proves provider shutdown, remote exactly-once delivery, or whole-host process absence.';
const originScope='Prospective planning-dispatch origin retained in the same transaction as its exact request (and inspection reservation when applicable), before any physical provider call.';
const cleanupRetentions=[PLANNING_RESPONSE_RETENTION,INSPECTION_RETENTION];
const cleanupOutcomes=['RETAINED','NO_DURABLE_RESPONSE','RESPONSE_UNRETAINED'];

/** Bind planning to the exact policy admitted with mission version one. Status,
 * pending work and final-artifact pointers may evolve, but a later policy head
 * is never authority to widen, narrow or reclassify a planning route. Keeping
 * this check independent of a worker lets budget/report callers fail before a
 * first reservation as well as after one exists. */
export function assertPlanningMissionPolicyFrozen(registry,missionId,{code='PLANNING_RESPONSE_INTEGRITY'}={}){
  // Keep the established planning error code while sharing the historical
  // freeze with every policy-driven report/control surface.  A route-specific
  // duplicate would inevitably leave a later policy feature unprotected.
  return assertMissionPolicyFrozen(registry,missionId,{code});
}

export function planningResponseActor(registry,runId){
  identifier(runId);const run=registry.store.get('run',runId),configuration=registry.store.get('worker-config',runId),r=run?.data;
  check(r?.id===runId&&r.mode==='producer'&&r.nodeId==='planning'&&r.context.purpose==='plan'
    &&canonical(configuration?.data.roleIds??null)===canonical(['omega_04','omega_05']),
  'PLANNING_RESPONSE_SCOPE','Only the registered planning producer may retain a plan response');
  const {mission,origin}=assertPlanningMissionPolicyFrozen(registry,r.missionId);
  // Planning policy is an admission boundary, not a mutable runtime hint. A
  // worker compiled under inspection may otherwise be reclassified as legacy
  // by deleting only planningContracts before its first provider call. Status
  // and final-artifact lifecycle versions remain legal; the policy bytes do
  // not. The immutable v1 mission record is the common binding for all plan
  // actors, including ones created before their first reservation.
  integrity(r.contextHash===sha256(r.context)&&configuration.data.prefixHash===sha256(configuration.data.instructions),
  'Planning context or compilation changed');
  return {run,configuration,mission,origin,store:registry.store};
}
function retainedRequest(registry,actor,requestHash){
  digest(requestHash);const {run,mission,configuration}=actor,m=mission.data;
  const record=registry.store.get('inference-request','inference-request:'+sha256([run.id,requestHash]));
  integrity(record?.version===1&&record.data.schema==='sovereign.inference-request.v1'
    &&record.data.retention==='BEFORE_DISPATCH'&&record.data.runId===run.id&&record.data.missionId===m.id
    &&record.data.requestHash===requestHash&&run.data.requests?.some(r=>r.requestHash===requestHash),
  'Planning response requires its exact prospective request');
  let request,task;try{request=JSON.parse(record.data.requestJson);task=JSON.parse(readSourceContextView(request.input).task);}catch{}
  integrity(request&&task&&inferenceRequestHash(request)===requestHash&&sha256(request.schema)===sha256(PLAN_SCHEMA)
    &&request.model===m.policy.model&&request.reasoningEffort===m.policy.reasoningEffort
    &&(request.instructionProfile??'model-default')===(m.policy.instructionProfile??'model-default')
    &&task.originalRequest===m.intent&&task.intentHash===m.intentHash&&canonical(task.allowedTools)===canonical(m.policy.allowedTools)
    &&sha256(request.instructions)===run.data.context.instructionsHash&&request.instructions.startsWith(configuration.data.instructions),
  'Planning response request, target, instructions or immutable mandate changed');
  return {record,task};
}

function cleanupProtocol(actor,code='PLANNING_RESPONSE_INTEGRITY'){
  // A version-one mission is the immutable admission point for this protocol.
  // Looking only at the mutable current policy would let a later edit erase the
  // marker and relabel a v15 mission as historical after it has already made a
  // prospective planning request. Historical missions remain historical; new
  // missions cannot add, remove or swap this lifecycle contract in place.
  const origin=actor.store.get('mission',actor.mission.id,1),initial=origin?.data?.policy?.planningCleanupProtocol,
    current=actor.mission.data.policy?.planningCleanupProtocol;
  check(origin?.version===1&&origin.data?.id===actor.mission.id,code,
    'Planning mission origin is absent or does not bind its cleanup protocol');
  check(initial===undefined||initial===PLANNING_CLEANUP_PROTOCOL,code,
    'Planning mission origin has an unknown provider-cleanup protocol');
  check(current===undefined||current===PLANNING_CLEANUP_PROTOCOL,code,
    'Planning mission has an unknown provider-cleanup protocol');
  check(current===initial,code,
    'Planning provider-cleanup protocol cannot be added, removed or changed after mission creation');
  return initial===PLANNING_CLEANUP_PROTOCOL;
}

/** Whether this exact planning actor was created under the durable close
 * protocol.  A missing run remains an ordinary absent read, preserving the
 * historic null API for a never-created actor. */
export function planningCleanupEnabled(registry,runId){
  identifier(runId);if(!registry.store.get('run',runId))return false;
  return cleanupProtocol(planningResponseActor(registry,runId));
}

function validRecordRef(value){
  try{keys(value,['type','id','version','hash']);identifier(value.type);identifier(value.id);digest(value.hash);
    return Number.isSafeInteger(value.version)&&value.version>0;}catch{return false;}
}
function cleanupBinding(registry,{runId,requestHash,retention,reservationRecord=null,code='PLANNING_RESPONSE_INTEGRITY'}){
  identifier(runId);digest(requestHash);
  check(cleanupRetentions.includes(retention),code,'Planning cleanup has an unknown response-retention scope');
  const actor=planningResponseActor(registry,runId),request=registry.store.get('inference-request','inference-request:'+sha256([runId,requestHash]));
  check(request?.version===1&&request.data.schema==='sovereign.inference-request.v1'
    &&request.data.retention==='BEFORE_DISPATCH'&&request.data.runId===runId&&request.data.missionId===actor.mission.id
    &&request.data.requestHash===requestHash&&(actor.run.data.requests??[]).some(r=>r.requestHash===requestHash),code,
  'Planning cleanup requires the exact retained prospective request');
  check(retention===INSPECTION_RETENTION?validRecordRef(reservationRecord):reservationRecord===null,code,
    'Planning cleanup reservation scope changed');
  return {actor,request,retention,enabled:cleanupProtocol(actor,code),reservationRecord};
}
function responseTypeFor(retention){return retention===PLANNING_RESPONSE_RETENTION?'planning-response':'planning-inspection-response';}
function responseIdentityFor(b){return b.retention===PLANNING_RESPONSE_RETENTION?identity(b.actor.run.id)
  :'planning-inspection-response:'+sha256(b.reservationRecord);}
function boundCleanupOutcome(registry,b,{outcome,outcomeRecord,code='PLANNING_RESPONSE_INTEGRITY'}={}){
  const store=registry.store,expectedType=responseTypeFor(b.retention),expectedId=responseIdentityFor(b),existing=store.get(expectedType,expectedId);
  if(outcome==='RETAINED'){
    check(validRecordRef(outcomeRecord),code,'A retained planning cleanup requires its exact pre-close public outcome record');
    const record=store.get(outcomeRecord.type,outcomeRecord.id,outcomeRecord.version);
    check(record&&record.type===expectedType&&record.id===expectedId&&canonical(ref(record))===canonical(outcomeRecord)
      &&record.data?.runId===b.actor.run.id&&record.data?.requestHash===b.request.data.requestHash,code,
    'Planning cleanup retained outcome is absent, altered or belongs to another request');
    // The cleanup binds an immutable outcome, but availability also requires
    // that outcome to remain the public head.  A later version (or a hidden
    // head) makes strict readers reject the response; treating its old v1 as
    // AVAILABLE here would let a control reservation bypass that quarantine.
    check(existing&&canonical(ref(existing))===canonical(outcomeRecord),code,
      'Planning cleanup retained outcome is no longer the exact public record head');
    if(b.retention===INSPECTION_RETENTION)check(canonical(record.data.reservationRecord)===canonical(b.reservationRecord),code,
      'Planning cleanup retained control outcome changed reservation');
    return ref(record);
  }
  check(outcomeRecord===null,code,'A non-retained planning cleanup cannot carry a public outcome reference');
  // `get(type,id)` only sees the current head.  Consult the initial outcome as
  // well so a hidden head cannot reclassify an already retained response as
  // absent while recording a non-retained cleanup disposition.
  check(!existing&&!store.get(expectedType,expectedId,1),code,
    'A non-retained planning cleanup conflicts with an already retained public outcome');
  return null;
}
function cleanupOriginData({actor,request,requestHash,retention,reservationRecord}){
  return {schema:PLANNING_CLEANUP_ORIGIN_SCHEMA,protocol:PLANNING_CLEANUP_PROTOCOL,runId:actor.run.id,requestHash,retention,
    requestRecord:ref(request),workerConfiguration:ref(actor.configuration),reservationRecord,policyHash:sha256(actor.mission.data.policy),scope:originScope};
}
function originRecord(registry,b,{code='PLANNING_RESPONSE_INTEGRITY'}={}){
  const record=registry.store.get(ORIGIN,originIdentity(b.actor.run.id,b.request.data.requestHash));
  check(record,'CLEANUP_UNCONFIRMED',
    'Planning dispatch origin is absent; reconcile the original request before consuming or replacing it');
  const d=record.data;
  keys(d,['schema','protocol','runId','requestHash','retention','requestRecord','workerConfiguration','reservationRecord','policyHash','scope']);
  check(record.version===1&&canonical(d)===canonical(cleanupOriginData({...b,requestHash:b.request.data.requestHash})),code,
    'Planning dispatch origin was altered or rebound');
  const chronology=[registry.committedSequence(b.request.type,b.request.id,b.request.version)];
  if(b.reservationRecord!==null){
    const reservation=registry.store.get(b.reservationRecord.type,b.reservationRecord.id,b.reservationRecord.version);
    check(reservation&&canonical(ref(reservation))===canonical(b.reservationRecord),code,'Planning cleanup reservation record changed');
    chronology.push(registry.committedSequence(reservation.type,reservation.id,reservation.version));
  }
  chronology.push(registry.committedSequence(record.type,record.id,record.version));
  check(chronology.every((n,i)=>Number.isSafeInteger(n)&&n>0&&(!i||chronology[i-1]<n)),code,
    'Planning request, reservation and dispatch origin were not committed in order');
  return record;
}

/** Retained in the same transaction as the exact prospective dispatch.  The
 * origin makes a later crash-before-close visible; reopening SQLite is never a
 * substitute for evidence that a provider was safely closed. */
export function recordPlanningCleanupOrigin(registry,{runId,requestHash,retention,reservationRecord=null}){
  return registry.store.transact(()=>{
    const b=cleanupBinding(registry,{runId,requestHash,retention,reservationRecord});
    check(b.enabled,'PLANNING_RESPONSE_INTEGRITY','Historical planning actor cannot manufacture a new cleanup protocol');
    registry.store.requireExecutionProtocol(15);
    const data=cleanupOriginData({...b,requestHash}),existing=registry.store.get(ORIGIN,originIdentity(runId,requestHash));
    if(existing){
      check(existing.version===1&&canonical(existing.data)===canonical(data),'PLANNING_RESPONSE_INTEGRITY',
        'Planning dispatch origin cannot be rewritten with a different binding');
      return existing;
    }
    return registry.store.put(ORIGIN,originIdentity(runId,requestHash),data,{expectedVersion:0});
  });
}
/** A response may be retained only while its exact provider lifecycle is still
 * open.  Once a cleanup disposition exists, late storage would create an
 * internally contradictory transcript.  Idempotent readers may still inspect
 * an already retained record; this guard only protects a new write. */
export function assertPlanningProviderOutcomeOpen(registry,{runId,requestHash,retention,reservationRecord=null,code='PLANNING_RESPONSE_INTEGRITY'}={}){
  const b=cleanupBinding(registry,{runId,requestHash,retention,reservationRecord,code});
  if(!b.enabled)return null;
  const origin=originRecord(registry,b,{code}),existing=registry.store.get(CLEANUP,cleanupIdentity(runId,requestHash));
  check(!existing,code,'Planning provider cleanup outcome is already durable; a later response cannot be retained');
  return {origin};
}
function cleanupData({actor,request,requestHash,retention,reservationRecord,origin,confirmed,result,outcome,outcomeRecord}){
  return {schema:PLANNING_PROVIDER_CLEANUP_SCHEMA,protocol:PLANNING_CLEANUP_PROTOCOL,runId:actor.run.id,requestHash,retention,
    originRecord:ref(origin),requestRecord:ref(request),workerConfiguration:ref(actor.configuration),reservationRecord,
    status:confirmed&&result?.processExitObserved!==false?'CLOSED':'UNCONFIRMED',adapterCloseConfirmed:confirmed,
    processExitObserved:typeof result?.processExitObserved==='boolean'?result.processExitObserved:null,outcome,outcomeRecord,scope:cleanupScope};
}

/** Validate the durable cleanup record up to (but deliberately not including)
 * its CLOSED requirement.  Consumers call `assertPlanningProviderClosed` for
 * the stronger barrier; diagnostics may safely distinguish a valid
 * UNCONFIRMED record from a missing or altered one without consuming data. */
function validatedPlanningProviderCleanup(registry,b,{code='PLANNING_RESPONSE_INTEGRITY'}={}){
  const origin=originRecord(registry,b,{code}),record=registry.store.get(CLEANUP,cleanupIdentity(b.actor.run.id,b.request.data.requestHash));
  check(record,'CLEANUP_UNCONFIRMED',
    'Planning provider closure is absent; reconcile the original dispatch before consuming or replacing it');
  const d=record.data;
  keys(d,['schema','protocol','runId','requestHash','retention','originRecord','requestRecord','workerConfiguration','reservationRecord',
    'status','adapterCloseConfirmed','processExitObserved','outcome','outcomeRecord','scope']);
  check(record.version===1&&d.schema===PLANNING_PROVIDER_CLEANUP_SCHEMA&&d.protocol===PLANNING_CLEANUP_PROTOCOL
    &&d.runId===b.actor.run.id&&d.requestHash===b.request.data.requestHash&&d.retention===b.retention&&canonical(d.originRecord)===canonical(ref(origin))
    &&canonical(d.requestRecord)===canonical(ref(b.request))&&canonical(d.workerConfiguration)===canonical(ref(b.actor.configuration))
    &&canonical(d.reservationRecord)===canonical(b.reservationRecord)&&['CLOSED','UNCONFIRMED'].includes(d.status)
    &&typeof d.adapterCloseConfirmed==='boolean'&&[true,false,null].includes(d.processExitObserved)
    &&d.status===(d.adapterCloseConfirmed&&d.processExitObserved!==false?'CLOSED':'UNCONFIRMED')
    &&cleanupOutcomes.includes(d.outcome)&&d.scope===cleanupScope,code,'Planning provider cleanup was altered or rebound');
  const boundOutcome=boundCleanupOutcome(registry,b,{outcome:d.outcome,outcomeRecord:d.outcomeRecord,code});
  const baseOrder=[registry.committedSequence(origin.type,origin.id,origin.version),registry.committedSequence(record.type,record.id,record.version)];
  check(baseOrder.every((n,i)=>Number.isSafeInteger(n)&&n>0&&(!i||baseOrder[i-1]<n)),code,
    'Planning dispatch origin and provider cleanup were not committed in order');
  return {origin,cleanup:record,boundOutcome};
}

function safeObservationRef(record){return record?ref(record):null;}
function cleanupObservation({runId,requestHash,retention,reservationRecord=null,protocol=null,originState='UNVERIFIED',originRecord=null,
  cleanupState='UNVERIFIED',cleanupRecord=null,localDisposition=null,publicState='UNVERIFIED'}={}){
  return {schema:PLANNING_CLEANUP_OBSERVATION_SCHEMA,runId,requestHash,retention,reservationRecord,
    protocol,origin:{state:originState,record:safeObservationRef(originRecord)},
    cleanup:{state:cleanupState,localDisposition,record:safeObservationRef(cleanupRecord)},publicState};
}

/** A total, read-only lifecycle observation for diagnostics and reports. It
 * never returns close-adapter internals, raw provider data, or a retained
 * response. `AVAILABLE` means the local close barrier is valid and CLOSED;
 * callers must still validate the appropriate public response before showing
 * its contents. */
export function readPlanningCleanupObservation(registry,{runId,requestHash,retention,reservationRecord=null}={}){
  const fallback=()=>cleanupObservation({runId:typeof runId==='string'?runId:null,
    requestHash:typeof requestHash==='string'&&/^[a-f0-9]{64}$/.test(requestHash)?requestHash:null,
    retention:cleanupRetentions.includes(retention)?retention:null,
    reservationRecord:validRecordRef(reservationRecord)?clone(reservationRecord):null});
  return planningSnapshot(registry,()=>{
    let b;
    try{b=cleanupBinding(registry,{runId,requestHash,retention,reservationRecord});}
    catch{return fallback();}
    if(!b.enabled)return cleanupObservation({runId,requestHash,retention,reservationRecord,protocol:null,
      originState:'MISSING',cleanupState:'MISSING',publicState:'NOT_APPLICABLE'});
    const rawOrigin=registry.store.get(ORIGIN,originIdentity(runId,requestHash)),rawCleanup=registry.store.get(CLEANUP,cleanupIdentity(runId,requestHash));
    if(!rawOrigin)return cleanupObservation({runId,requestHash,retention,reservationRecord,protocol:PLANNING_CLEANUP_PROTOCOL,
      originState:'UNVERIFIED',cleanupState:rawCleanup?'UNVERIFIED':'MISSING',cleanupRecord:rawCleanup,publicState:'UNVERIFIED'});
    let origin;
    try{origin=originRecord(registry,b);}
    catch{return cleanupObservation({runId,requestHash,retention,reservationRecord,protocol:PLANNING_CLEANUP_PROTOCOL,
      originState:'UNVERIFIED',originRecord:rawOrigin,cleanupState:rawCleanup?'UNVERIFIED':'MISSING',cleanupRecord:rawCleanup,publicState:'UNVERIFIED'});}
    if(!rawCleanup)return cleanupObservation({runId,requestHash,retention,reservationRecord,protocol:PLANNING_CLEANUP_PROTOCOL,
      originState:'RECORDED',originRecord:origin,cleanupState:'MISSING',publicState:'PENDING_CLEANUP'});
    let lifecycle;
    try{lifecycle=validatedPlanningProviderCleanup(registry,b);}
    catch{return cleanupObservation({runId,requestHash,retention,reservationRecord,protocol:PLANNING_CLEANUP_PROTOCOL,
      originState:'RECORDED',originRecord:origin,cleanupState:'UNVERIFIED',cleanupRecord:rawCleanup,publicState:'UNVERIFIED'});}
    const d=lifecycle.cleanup.data;
    const publicState=d.status==='UNCONFIRMED'?'PENDING_CLEANUP'
      :d.outcome==='RETAINED'?'AVAILABLE'
      :d.outcome==='NO_DURABLE_RESPONSE'?'NO_DURABLE_RESPONSE':'RECONCILIATION_REQUIRED';
    return cleanupObservation({runId,requestHash,retention,reservationRecord,protocol:PLANNING_CLEANUP_PROTOCOL,
      originState:'RECORDED',originRecord:lifecycle.origin,cleanupState:d.status,cleanupRecord:lifecycle.cleanup,
      localDisposition:d.outcome,publicState});
  });
}

/** The adapter's close result is durable control-plane evidence, not evidence
 * that the remote provider completed exactly once. `outcome` tells the reader
 * whether an exact public answer was retained before closure, absent after a
 * known local failure, or lost at the persistence boundary. */
export function recordPlanningProviderCleanup(registry,{runId,requestHash,retention,reservationRecord=null,confirmed,result=null,outcome,outcomeRecord=null}){
  check(typeof confirmed==='boolean','SCHEMA','Planning cleanup confirmation must be explicit');
  check(cleanupOutcomes.includes(outcome),'SCHEMA','Planning cleanup requires an exact durable-outcome disposition');
  return registry.store.transact(()=>{
    const b=cleanupBinding(registry,{runId,requestHash,retention,reservationRecord});
    check(b.enabled,'PLANNING_RESPONSE_INTEGRITY','Historical planning actor cannot manufacture a cleanup result');
    const origin=originRecord(registry,b),boundOutcome=boundCleanupOutcome(registry,b,{outcome,outcomeRecord});
    const data=cleanupData({...b,requestHash,origin,confirmed,result,outcome,outcomeRecord:boundOutcome}),existing=registry.store.get(CLEANUP,cleanupIdentity(runId,requestHash));
    if(existing){
      check(existing.version===1&&canonical(existing.data)===canonical(data),'PLANNING_RESPONSE_INTEGRITY',
        'Planning provider cleanup cannot be rewritten with a different outcome');
      return existing;
    }
    return registry.store.put(CLEANUP,cleanupIdentity(runId,requestHash),data,{expectedVersion:0});
  });
}

/** Require a CLOSED durable cleanup barrier for a response or local failure.
 * `outcomeOrder` binds retained answers before close and retained local
 * failures after close; neither shape can be silently exchanged. */
export function assertPlanningProviderClosed(registry,{runId,requestHash,retention,reservationRecord=null,
  outcomeRecord=null,outcomeOrder='before-cleanup',expectedOutcome=null,code='PLANNING_RESPONSE_INTEGRITY'}={}){
  const b=cleanupBinding(registry,{runId,requestHash,retention,reservationRecord,code});
  if(!b.enabled)return null;
  const {origin,cleanup:record,boundOutcome}=validatedPlanningProviderCleanup(registry,b,{code}),d=record.data;
  const baseOrder=[registry.committedSequence(origin.type,origin.id,origin.version),registry.committedSequence(record.type,record.id,record.version)];
  check(d.status==='CLOSED','CLEANUP_UNCONFIRMED',
    'Planning provider closure is unconfirmed; reconcile the original dispatch before consuming or replacing it');
  if(expectedOutcome!==null)check(d.outcome===expectedOutcome,code,
    'Planning durable-outcome disposition conflicts with the requested recovery path');
  if(outcomeRecord!==null){
    check(validRecordRef(outcomeRecord),code,'Planning cleanup lacks an exact protected outcome reference');
    const outcome=registry.store.get(outcomeRecord.type,outcomeRecord.id,outcomeRecord.version);
    check(outcome&&canonical(ref(outcome))===canonical(outcomeRecord),code,'Planning cleanup protected outcome changed');
    const outcomeSequence=registry.committedSequence(outcome.type,outcome.id,outcome.version),originSequence=baseOrder[0],cleanupSequence=baseOrder[1];
    check(Number.isSafeInteger(outcomeSequence)&&outcomeSequence>0&&['before-cleanup','after-cleanup'].includes(outcomeOrder),code,
      'Planning cleanup outcome ordering is invalid');
    check(outcomeOrder==='before-cleanup'?originSequence<outcomeSequence&&outcomeSequence<cleanupSequence
      :originSequence<cleanupSequence&&cleanupSequence<outcomeSequence,code,
    'Planning request outcome and cleanup were not committed in the required order');
    if(d.outcome==='RETAINED')check(outcomeOrder==='before-cleanup'&&canonical(boundOutcome)===canonical(outcomeRecord),code,
      'Planning cleanup retained outcome does not match the public response being consumed');
  }else if(d.outcome==='RETAINED'){
    check(false,code,'A retained planning cleanup must be consumed with its exact public outcome record');
  }
  return {origin,cleanup:record};
}

/** A closed NO_DURABLE_RESPONSE is not, by itself, authority to replace an
 * inspection actor. The replacement path requires a second, post-close token
 * that binds the exact local failure to the same reservation. This deliberately
 * lives below the inspection budget so the budget can enforce it without an
 * import cycle through the public inspection-response reader. It exposes no
 * provider output and grants no replay authority. */
export function readPlanningInspectionReplacementFailure(registry,{runId,requestHash,reservationRecord}={}){
  return planningSnapshot(registry,()=>{
    const b=cleanupBinding(registry,{runId,requestHash,retention:INSPECTION_RETENTION,reservationRecord,
      code:'PLANNING_INSPECTION_INTEGRITY'});
    if(!b.enabled)return null;
    const inspectionIntegrity=(condition,message)=>check(condition,'PLANNING_INSPECTION_INTEGRITY',message),
      store=registry.store,id=inspectionFailureIdentity(reservationRecord),record=store.get(INSPECTION_FAILURE,id);
    inspectionIntegrity(record||!store.get(INSPECTION_FAILURE,id,1),'Existing planning inspection failure head was hidden');
    if(!record)return null;
    const d=record.data;
    keys(d,['schema','runId','requestHash','reservationRecord','code','disposition','providerCompletion','cleanupRecord']);
    inspectionIntegrity(record.version===1&&d.schema==='sovereign.planning-inspection-failure.v1'&&d.runId===b.actor.run.id
      &&d.requestHash===b.request.data.requestHash&&canonical(d.reservationRecord)===canonical(reservationRecord)
      &&typeof d.code==='string'&&/^[A-Z][A-Z0-9_]{0,79}$/.test(d.code)
      &&d.disposition==='ABANDONED_INFERENCE_ONLY'&&d.providerCompletion==='UNCONFIRMED'
      &&b.actor.run.data.expectedRequestHash===d.requestHash
      &&!(b.actor.run.data.inferenceReceipts??[]).some(q=>q.contextHash===d.requestHash)
      &&!store.get('planning-inspection-response',inspectionResponseIdentity(reservationRecord))
      &&!store.get('planning-inspection-response',inspectionResponseIdentity(reservationRecord),1),
    'Planning inspection replacement failure changed or conflicts with a completed response');
    const closed=assertPlanningProviderClosed(registry,{runId,requestHash,retention:INSPECTION_RETENTION,reservationRecord,
      outcomeRecord:ref(record),outcomeOrder:'after-cleanup',expectedOutcome:'NO_DURABLE_RESPONSE',code:'PLANNING_INSPECTION_INTEGRITY'});
    inspectionIntegrity(canonical(d.cleanupRecord)===canonical(ref(closed.cleanup)),
      'Planning inspection replacement failure cleanup binding changed');
    return record;
  });
}

/** Called only after the provider answer passed the caller's pure validator.
 * Receipt and public value commit together or neither becomes durable. No
 * private provider fields, acceptance, new dispatch or inferred card exposure. */
export function retainPlanningResponse(registry,{runId,requestHash,value,receipt,learningReceiptAttestation=null}){
  return registry.store.transact(()=>{
    const actor=planningResponseActor(registry,runId),{record:request}=retainedRequest(registry,actor,requestHash);
    integrity(actor.run.data.expectedRequestHash===requestHash,'Plan response is not the pending request');
    if(cleanupProtocol(actor))assertPlanningProviderOutcomeOpen(registry,{runId,requestHash,retention:PLANNING_RESPONSE_RETENTION});
    validatePlanProposal(value,actor.mission.data.intent,{allowedTools:actor.mission.data.policy.allowedTools});
    const completed=registry.attachInference(runId,receipt,{learningReceiptAttestation});
    const data={schema:SCHEMA,runId,requestHash,missionId:actor.mission.id,intentHash:actor.mission.data.intentHash,policyHash:sha256(actor.mission.data.policy),
      requestRecord:ref(request),completedRunRecord:ref(completed),workerConfiguration:ref(actor.configuration),schemaHash:sha256(PLAN_SCHEMA),
      value:clone(value),valueHash:sha256(value),receiptHash:sha256(receipt)};
    return registry.store.put(TYPE,identity(runId),data,{expectedVersion:0});
  });
}

/** A caught legacy planner failure is explicit durable abandonment of this
 * inference only. It does not assert that no remote work happened; replacement
 * still requires the exact close barrier to be CLOSED. */
export function retainPlanningResponseFailure(registry,{runId,requestHash,code}){
  check(typeof code==='string'&&/^[A-Z][A-Z0-9_]{0,79}$/.test(code),'SCHEMA','Bounded planning failure code required');
  return registry.store.transact(()=>{
    const actor=planningResponseActor(registry,runId),{record:request}=retainedRequest(registry,actor,requestHash);
    integrity(actor.run.data.expectedRequestHash===requestHash,'Planning failure does not concern the pending exact request');
    integrity(!registry.store.get(TYPE,identity(runId)),'A completed planning response cannot become a failure');
    const cleanupRequired=cleanupProtocol(actor),closed=cleanupRequired?assertPlanningProviderClosed(registry,{runId,requestHash,
      retention:PLANNING_RESPONSE_RETENTION,expectedOutcome:'NO_DURABLE_RESPONSE'}):null;
    const data={schema:FAILURE_SCHEMA,runId,requestHash,missionId:actor.mission.id,intentHash:actor.mission.data.intentHash,
      policyHash:sha256(actor.mission.data.policy),requestRecord:ref(request),workerConfiguration:ref(actor.configuration),code,
      disposition:'ABANDONED_INFERENCE_ONLY',providerCompletion:'UNCONFIRMED',...(closed?{cleanupRecord:ref(closed.cleanup)}:{})};
    const existing=registry.store.get(FAILURE,failureIdentity(runId));
    const record=existing?(integrity(existing.version===1&&canonical(existing.data)===canonical(data),'Planning failure cannot be rewritten'),existing)
      :registry.store.put(FAILURE,failureIdentity(runId),data,{expectedVersion:0});
    if(closed)assertPlanningProviderClosed(registry,{runId,requestHash,retention:PLANNING_RESPONSE_RETENTION,
      outcomeRecord:ref(record),outcomeOrder:'after-cleanup',expectedOutcome:'NO_DURABLE_RESPONSE'});
    return record;
  });
}

/** A durable local failure permits a later distinct actor only after its
 * provider close outcome is durably confirmed. Missing failure evidence remains
 * an unknown dispatched outcome and must not be replaced. */
export function readPlanningResponseFailure(registry,runId){
  return planningSnapshot(registry,()=>{
    identifier(runId);const record=registry.store.get(FAILURE,failureIdentity(runId));if(!record)return null;
    const actor=planningResponseActor(registry,runId),d=record.data;
    const cleanupRequired=cleanupProtocol(actor);
    keys(d,cleanupRequired?['schema','runId','requestHash','missionId','intentHash','policyHash','requestRecord','workerConfiguration','code','disposition','providerCompletion','cleanupRecord']:
      ['schema','runId','requestHash','missionId','intentHash','policyHash','requestRecord','workerConfiguration','code','disposition','providerCompletion']);
    integrity(record.version===1&&d.schema===FAILURE_SCHEMA&&d.runId===runId&&d.missionId===actor.mission.id
      &&d.intentHash===actor.mission.data.intentHash&&d.policyHash===sha256(actor.mission.data.policy)
      &&typeof d.code==='string'&&/^[A-Z][A-Z0-9_]{0,79}$/.test(d.code)
      &&d.disposition==='ABANDONED_INFERENCE_ONLY'&&d.providerCompletion==='UNCONFIRMED',
    'Durable planning failure changed');
    const {record:request}=retainedRequest(registry,actor,d.requestHash);
    integrity(canonical(d.requestRecord)===canonical(ref(request))&&canonical(d.workerConfiguration)===canonical(ref(actor.configuration))
      &&actor.run.data.expectedRequestHash===d.requestHash&&!registry.store.get(TYPE,identity(runId)),
    'Planning failure no longer matches its unresolved exact request');
    if(cleanupRequired){
      const closed=assertPlanningProviderClosed(registry,{runId,requestHash:d.requestHash,retention:PLANNING_RESPONSE_RETENTION,
        outcomeRecord:ref(record),outcomeOrder:'after-cleanup',expectedOutcome:'NO_DURABLE_RESPONSE'});
      integrity(canonical(d.cleanupRecord)===canonical(ref(closed.cleanup)),'Planning failure cleanup binding changed');
    }
    return {record:ref(record),code:d.code,requestHash:d.requestHash};
  });
}

function publicPlanningResponseEvidence(registry,runId,evidence){
  const rawRun=registry.store.get('run',runId);
  if(!rawRun)return evidence;
  // Keep the historic read API narrow: a nonplanning run with no planning
  // record is simply unrelated, not a reason to invoke a planning actor.
  const plausible=rawRun.data?.mode==='producer'&&rawRun.data?.nodeId==='planning'&&rawRun.data?.context?.purpose==='plan';
  if(!plausible)return evidence;
  const actor=planningResponseActor(registry,runId);if(!cleanupProtocol(actor))return evidence;
  const requestHash=evidence?.response.requestHash??actor.run.data.expectedRequestHash??null;
  if(requestHash===null){
    integrity((actor.run.data.requests??[]).length===0&&!evidence,'Planning response disappeared after a dispatched request');
    return evidence;
  }
  digest(requestHash);
  const closed=assertPlanningProviderClosed(registry,{runId,requestHash,retention:PLANNING_RESPONSE_RETENTION,
    outcomeRecord:evidence?.response.responseRecord??null,expectedOutcome:evidence?'RETAINED':null});
  if(evidence)return evidence;
  if(closed.cleanup.data.outcome==='RETAINED')integrity(false,'Planning cleanup reports a retained response that is not durably readable');
  if(closed.cleanup.data.outcome==='RESPONSE_UNRETAINED')check(false,'INFERENCE_OUTCOME_UNKNOWN',
    'A validated planning response was not durably retained; explicit reconciliation is required before a replacement');
  return null;
}

/** Missing legacy response is not manufactured from a receipt or conversation.
 * Existing but altered evidence throws before a replacement plan can be made. */
export function readPlanningResponse(registry,runId){
  return planningSnapshot(registry,()=>publicPlanningResponseEvidence(registry,runId,readPlanningResponseSnapshot(registry,runId))?.response??null);
}

/** Completed-request presence proof for the original public proposal, not an
 * acceptance gate or a certificate of the model's comprehension. Does not yet
 * implement the on-demand inspection protocol or change legacy planning. */
export function readPlanningContractCoverage(registry,runId){
  return planningSnapshot(registry,()=>{
    const evidence=publicPlanningResponseEvidence(registry,runId,readPlanningResponseSnapshot(registry,runId));if(!evidence)return null;
    const {response,requestRecord,task}=evidence;
    return {schema:'sovereign.completed-planning-role-coverage.v1',runId,requestHash:response.requestHash,
      responseRecord:response.responseRecord,requestRecord,coverage:planningRoleCoverage(response.value,task),
      scope:'Full role cards included in the exact retained and completed request for the original public plan proposal, not comprehension, compatibility, implementation or acceptance. Controller-added normalized gates and independent substantive review are separate obligations.'};
  });
}
function planningSnapshot(registry,read){
  const db=registry.store.db,ownSnapshot=!db.isTransaction;
  if(ownSnapshot)db.exec('BEGIN');
  try{return read();}
  finally{if(ownSnapshot&&db.isTransaction)db.exec('ROLLBACK');}
}
function readPlanningResponseSnapshot(registry,runId){
  identifier(runId);const record=registry.store.get(TYPE,identity(runId));
  if(!record)return null;
  const actor=planningResponseActor(registry,runId),d=record.data,requestHash=d.requestHash;
  integrity(record.version===1&&d.schema===SCHEMA&&d.runId===runId&&d.missionId===actor.mission.id
    &&d.intentHash===actor.mission.data.intentHash&&d.policyHash===sha256(actor.mission.data.policy)
    &&d.schemaHash===sha256(PLAN_SCHEMA)&&d.valueHash===sha256(d.value)
    &&canonical(d.workerConfiguration)===canonical(ref(actor.configuration)),
  'Durable planning response was altered or changed scope');
  keys(d,['schema','runId','requestHash','missionId','intentHash','policyHash','requestRecord','completedRunRecord','workerConfiguration','schemaHash','value','valueHash','receiptHash']);
  const {record:request,task}=retainedRequest(registry,actor,requestHash);
  integrity(canonical(d.requestRecord)===canonical(ref(request)),'Planning request record changed');
  const bound=d.completedRunRecord;
  integrity(bound?.type==='run'&&bound.id===runId,'Planning completion belongs to another actor');
  const completed=registry.store.get('run',runId,bound.version);
  integrity(completed?.hash===bound.hash&&completed.data.id===runId&&completed.data.missionId===actor.mission.id
    &&completed.data.expectedRequestHash===null&&actor.run.data.expectedRequestHash===null
    &&registry.exposureHash(completed.data)===registry.exposureHash(actor.run.data),
  'Planning completion or its exact evidence exposure changed');
  const receipt=completed.data.inferenceReceipt,receipts=(actor.run.data.inferenceReceipts??[]).filter(r=>r.contextHash===requestHash);
  integrity(receipt&&['completed','COMPLETED'].includes(receipt.status)&&receipt.contextHash===requestHash
    &&sha256(receipt)===d.receiptHash&&receipts.length===1&&sha256(receipts[0])===d.receiptHash
    &&actor.run.data.inferenceReceipt&&sha256(actor.run.data.inferenceReceipt)===d.receiptHash,'Planning response lacks its unique exact completion');
  const order=[registry.committedSequence(request.type,request.id,1),registry.committedSequence('run',runId,completed.version),registry.committedSequence(TYPE,record.id,1)];
  integrity(order.every(n=>Number.isSafeInteger(n)&&n>0)&&order[0]<order[1]&&order[1]<order[2],
    'Planning request, completion and response were not committed in order');
  validatePlanProposal(d.value,actor.mission.data.intent,{allowedTools:actor.mission.data.policy.allowedTools});
  return {response:{value:clone(d.value),receipt:clone(receipt),requestHash,responseRecord:ref(record)},task,requestRecord:ref(request)};
}
