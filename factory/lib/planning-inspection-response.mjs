// Durable public inspect/plan messages. No provider execution, cursor mutation,
// inferred comprehension or plan acceptance is granted by this storage layer.
import {canonical,check,clone,keys,sha256} from './contracts.mjs';
import {assertPlanningProviderClosed,assertPlanningProviderOutcomeOpen,planningCleanupEnabled,planningResponseActor} from './planning-response.mjs';
import {planningInspectionReservation} from './planning-inspection-budget.mjs';
import {PLANNING_MESSAGE_SCHEMA,validatePlanningMessage} from './planning-inspection-contract.mjs';
import {inferenceRequestHash} from '../providers/instruction-profiles.mjs';
import {readSourceContextView} from './source-context-view.mjs';
import {planningRoleCoverage,planningContractInventory} from './plan-role-review.mjs';

export const PLANNING_INSPECTION_RETENTION='planning-inspection-response-v1';
const TYPE='planning-inspection-response',SCHEMA='sovereign.planning-inspection-response.v1';
const FAILURE='planning-inspection-failure';
const ref=r=>({type:r.type,id:r.id,version:r.version,hash:r.hash});
const identity=call=>TYPE+':'+sha256(ref(call));
const failureIdentity=call=>FAILURE+':'+sha256(ref(call));
const integrity=(ok,message)=>check(ok,'PLANNING_INSPECTION_INTEGRITY',message);
function snapshot(registry,read){
  const db=registry.store.db,own=!db.isTransaction;if(own)db.exec('BEGIN');
  try{return read();}finally{if(own&&db.isTransaction)db.exec('ROLLBACK');}
}
function boundRecord(store,bound,type,id,{head=false}={}){
  keys(bound,['type','id','version','hash']);
  integrity(bound.type===type&&bound.id===id,'Planning message reference changed actor or type');
  const record=store.get(type,id,head?null:bound.version);
  integrity(record&&canonical(ref(record))===canonical(bound),'Planning message bound record changed');return record;
}
function binding(registry,runId,requestHash){
  const actor=planningResponseActor(registry,runId),call=planningInspectionReservation(registry,runId,requestHash);
  if(!call)return null;
  const d=call.data,store=registry.store,m=actor.mission.data;
  integrity(canonical(d.workerConfiguration)===canonical(ref(actor.configuration)), 'Planning message compilation changed');
  const prepared=boundRecord(store,d.preparedRunRecord,'run',runId),r=prepared.data;
  integrity(r.id===runId&&r.missionId===m.id&&r.nodeId==='planning'&&r.mode==='producer'
    &&r.context.purpose==='plan'&&r.contextHash===sha256(r.context)&&r.expectedRequestHash===d.requestHash,
    'Planning message preparation or mandate changed');
  const request=boundRecord(store,d.requestRecord,'inference-request','inference-request:'+sha256([runId,d.requestHash]),{head:true});
  integrity(request.version===1&&request.data.schema==='sovereign.inference-request.v1'&&request.data.retention==='BEFORE_DISPATCH'
    &&request.data.runId===runId&&request.data.missionId===m.id&&request.data.requestHash===d.requestHash,
    'Planning message requires its exact prospective request');
  for(const current of [r,actor.run.data]){
    const entries=(current.requests??[]).filter(q=>q.requestHash===d.requestHash);
    integrity(entries.length===1&&entries[0].contextHash===r.contextHash,'Planning request association changed');
  }
  let req,task;try{req=JSON.parse(request.data.requestJson);task=JSON.parse(readSourceContextView(req.input).task);}catch{}
  integrity(req&&task&&inferenceRequestHash(req)===d.requestHash&&sha256(req.schema)===sha256(PLANNING_MESSAGE_SCHEMA)
    &&req.model===m.policy.model&&req.reasoningEffort===m.policy.reasoningEffort
    &&(req.instructionProfile??'model-default')===(m.policy.instructionProfile??'model-default')
    &&sha256(req.instructions)===r.context.instructionsHash&&req.instructions.startsWith(actor.configuration.data.instructions)
    &&task.originalRequest===m.intent&&task.intentHash===m.intentHash&&canonical(task.allowedTools)===canonical(m.policy.allowedTools)
    &&canonical(task.planningContractControl)===canonical({schema:'sovereign.planning-contract-control.v1',runId,
      callIndex:d.ordinal,maxCalls:d.policy.maxCalls,maxBytes:d.policy.maxBytes}),
    'Planning message request schema, instructions, target or control scope changed');
  const parent=d.parentPlanRecord?boundRecord(store,d.parentPlanRecord,'plan',m.id):null;
  integrity(canonical(task.previousPlan??null)===canonical(parent?.data.plan??null),'Historical planning mandate changed');
  return {actor,call,prepared,request,task,validation:{policy:d.policy,intent:m.intent,allowedTools:m.policy.allowedTools,previousPlan:parent?.data.plan??null}};
}
function responseRecord(store,call){
  const id=identity(call),record=store.get(TYPE,id);
  integrity(record||!store.get(TYPE,id,1),'Existing planning message head was hidden');return record;
}
// Internal validation deliberately does not require provider closure: response
// retention runs before `provider.close()` and must be able to prove an exact
// pre-close duplicate without accidentally treating it as publicly consumable.
function readBoundRaw(registry,b){
  const {actor,call,prepared,request,task,validation}=b,record=responseRecord(registry.store,call);
  if(!record)return null;const d=record.data;
  keys(d,['schema','runId','requestHash','missionId','intentHash','policyHash','reservationRecord','requestRecord',
    'completedRunRecord','workerConfiguration','schemaHash','value','valueHash','receiptHash']);
  integrity(record.version===1&&d.schema===SCHEMA&&d.runId===actor.run.id&&d.requestHash===call.data.requestHash
    &&d.missionId===actor.mission.id&&d.intentHash===actor.mission.data.intentHash&&d.policyHash===call.data.policyHash
    &&canonical(d.reservationRecord)===canonical(ref(call))&&canonical(d.requestRecord)===canonical(ref(request))
    &&canonical(d.workerConfiguration)===canonical(ref(actor.configuration))&&d.schemaHash===sha256(PLANNING_MESSAGE_SCHEMA)
    &&d.valueHash===sha256(d.value),'Durable planning control response changed');
  const completed=boundRecord(registry.store,d.completedRunRecord,'run',actor.run.id),r=completed.data;
  integrity(r.missionId===actor.mission.id&&r.contextHash===prepared.data.contextHash&&r.expectedRequestHash===null
    &&r.completedExposureHash===registry.exposureHash(prepared.data)
    &&registry.exposureHash(r)===registry.exposureHash(prepared.data),
    'Planning control response lacks its exact completed exposure');
  const receipt=r.inferenceReceipt,receipts=(actor.run.data.inferenceReceipts??[]).filter(q=>q.contextHash===d.requestHash);
  integrity(receipt&&['completed','COMPLETED'].includes(receipt.status)&&receipt.contextHash===d.requestHash
    &&sha256(receipt)===d.receiptHash&&receipts.length===1&&sha256(receipts[0])===d.receiptHash,
    'Planning control response lacks its unique exact receipt');
  const latest=planningInspectionReservation(registry,actor.run.id);
  if(latest.id===call.id)integrity(actor.run.data.expectedRequestHash===null&&sha256(actor.run.data.inferenceReceipt??null)===d.receiptHash,
    'Latest planning completion was replaced or reverted to pending');
  const order=[request,call,completed,record].map(r=>registry.committedSequence(r.type,r.id,r.version));
  integrity(order.every((n,i)=>Number.isSafeInteger(n)&&n>0&&(!i||n>order[i-1])),
    'Planning request, reservation, completion and message were not committed in order');
  validatePlanningMessage(d.value,validation);
  const coverage=d.value.action==='plan'?planningRoleCoverage(d.value.plan,task):null;
  return {value:clone(d.value),receipt:clone(receipt),requestHash:d.requestHash,responseRecord:ref(record),
    reservationRecord:ref(call),requestRecord:ref(request),coverage,contractInventory:planningContractInventory(task)};
}
function publicBound(registry,b){
  const response=readBoundRaw(registry,b);if(!planningCleanupEnabled(registry,b.actor.run.id))return response;
  const closed=assertPlanningProviderClosed(registry,{runId:b.actor.run.id,requestHash:b.call.data.requestHash,
    retention:PLANNING_INSPECTION_RETENTION,reservationRecord:ref(b.call),outcomeRecord:response?.responseRecord??null,
    expectedOutcome:response?'RETAINED':null,code:'PLANNING_INSPECTION_INTEGRITY'});
  if(response)return response;
  if(closed.cleanup.data.outcome==='RETAINED')integrity(false,'Planning cleanup reports a retained control response that is not durably readable');
  if(closed.cleanup.data.outcome==='RESPONSE_UNRETAINED')check(false,'INFERENCE_OUTCOME_UNKNOWN',
    'A validated planning control response was not durably retained; explicit reconciliation is required before another call');
  return null;
}

/** Latest reservation is authoritative for discovery, including a pending call
 * with no response. Optional exact hash reads an older completed public message
 * without asserting that its exposure is the current one. */
export function readPlanningInspectionMessage(registry,runId,requestHash=null){
  return snapshot(registry,()=>{const b=binding(registry,runId,requestHash);return b?publicBound(registry,b):null;});
}

export function retainPlanningInspectionMessage(registry,input){
  // The optional process-local handoff is deliberately not cloned into durable
  // input. Inspect property descriptors first so an accessor cannot execute
  // while an otherwise rejected retention call is being validated.
  check(input&&typeof input==='object'&&!Array.isArray(input)&&Object.getPrototypeOf(input)===Object.prototype,'SCHEMA','Planning inspection input must be a plain object');
  const descriptors=Object.getOwnPropertyDescriptors(input),allowed=['runId','requestHash','value','receipt','learningReceiptAttestation'];
  check(Reflect.ownKeys(input).every(key=>typeof key==='string'&&allowed.includes(key)&&descriptors[key].enumerable&&Object.hasOwn(descriptors[key],'value')),
    'SCHEMA','Planning inspection input contains an unknown field or accessor');
  check(['runId','requestHash','value','receipt'].every(key=>Object.hasOwn(descriptors,key)),'SCHEMA','Planning inspection input is missing a required field');
  const learningReceiptAttestation=descriptors.learningReceiptAttestation?.value??null;
  const v=clone({runId:descriptors.runId.value,requestHash:descriptors.requestHash.value,value:descriptors.value.value,receipt:descriptors.receipt.value});
  keys(v,['runId','requestHash','value','receipt']);
  return registry.store.transact(()=>{
    const b=binding(registry,v.runId,v.requestHash),existing=readBoundRaw(registry,b);
    if(existing){
      integrity(canonical(existing.value)===canonical(v.value)&&canonical(existing.receipt)===canonical(v.receipt),
        'A completed planning control response cannot be replaced');
      return registry.store.get(TYPE,existing.responseRecord.id);
    }
    if(planningCleanupEnabled(registry,v.runId))assertPlanningProviderOutcomeOpen(registry,{runId:v.runId,requestHash:v.requestHash,
      retention:PLANNING_INSPECTION_RETENTION,reservationRecord:ref(b.call),code:'PLANNING_INSPECTION_INTEGRITY'});
    integrity(!failureRecord(registry,b),'Abandoned planning inference cannot later become a completed control message');
    integrity(b.actor.run.data.expectedRequestHash===v.requestHash
      &&registry.exposureHash(b.actor.run.data)===registry.exposureHash(b.prepared.data),
      'Planning message is not completing its exact pending exposure');
    validatePlanningMessage(v.value,b.validation);
    planningContractInventory(b.task);
    if(v.value.action==='plan')planningRoleCoverage(v.value.plan,b.task); // Partial/forged cards never become presence evidence.
    const completed=registry.attachInference(v.runId,v.receipt,{learningReceiptAttestation});
    return registry.store.put(TYPE,identity(b.call),{schema:SCHEMA,runId:v.runId,requestHash:v.requestHash,
      missionId:b.actor.mission.id,intentHash:b.actor.mission.data.intentHash,policyHash:b.call.data.policyHash,
      reservationRecord:ref(b.call),requestRecord:ref(b.request),completedRunRecord:ref(completed),workerConfiguration:ref(b.actor.configuration),
      schemaHash:sha256(PLANNING_MESSAGE_SCHEMA),value:v.value,valueHash:sha256(v.value),receiptHash:sha256(v.receipt)},{expectedVersion:0});
  });
}

function failureRecord(registry,b){
  const id=failureIdentity(b.call),r=registry.store.get(FAILURE,id);
  integrity(r||!registry.store.get(FAILURE,id,1),'Existing planning failure head was hidden');
  if(!r)return null;
  const d=r.data;
  const cleanupRequired=planningCleanupEnabled(registry,b.actor.run.id);
  keys(d,cleanupRequired?['schema','runId','requestHash','reservationRecord','code','disposition','providerCompletion','cleanupRecord']:
    ['schema','runId','requestHash','reservationRecord','code','disposition','providerCompletion']);
  integrity(r.version===1&&d.schema==='sovereign.planning-inspection-failure.v1'&&d.runId===b.actor.run.id
    &&d.requestHash===b.call.data.requestHash&&canonical(d.reservationRecord)===canonical(ref(b.call))
    &&typeof d.code==='string'&&/^[A-Z][A-Z0-9_]{0,79}$/.test(d.code)
    &&d.disposition==='ABANDONED_INFERENCE_ONLY'&&d.providerCompletion==='UNCONFIRMED'
    &&b.actor.run.data.expectedRequestHash===d.requestHash
    &&!(b.actor.run.data.inferenceReceipts??[]).some(q=>q.contextHash===d.requestHash)
    &&!responseRecord(registry.store,b.call), 'Planning failure changed or conflicts with a completed response');
  const order=[b.call,r].map(q=>registry.committedSequence(q.type,q.id,q.version));
  integrity(order[1]>order[0],'Planning failure precedes its reservation');return r;
}
/** A caught local inference failure permits a later separately budgeted actor,
 * not replay of this request or a claim about remote completion/effects. A crash
 * without this record remains pending and requires explicit reconciliation. */
export function readPlanningInspectionFailure(registry,runId,requestHash=null){
  return snapshot(registry,()=>{
    const b=binding(registry,runId,requestHash),failure=b?failureRecord(registry,b):null;if(!failure)return null;
    if(planningCleanupEnabled(registry,runId)){
      const closed=assertPlanningProviderClosed(registry,{runId,requestHash:b.call.data.requestHash,retention:PLANNING_INSPECTION_RETENTION,
        reservationRecord:ref(b.call),outcomeRecord:ref(failure),outcomeOrder:'after-cleanup',expectedOutcome:'NO_DURABLE_RESPONSE',
        code:'PLANNING_INSPECTION_INTEGRITY'});
      integrity(canonical(failure.data.cleanupRecord)===canonical(ref(closed.cleanup)),'Planning failure cleanup binding changed');
    }
    return failure;
  });
}
export function retainPlanningInspectionFailure(registry,{runId,requestHash,code}){
  check(typeof code==='string'&&/^[A-Z][A-Z0-9_]{0,79}$/.test(code),'SCHEMA','Bounded public failure code required');
  return registry.store.transact(()=>{
    const b=binding(registry,runId,requestHash);
    if(readBoundRaw(registry,b))return null; // Storage/event failure after success never retracts the response.
    const previous=failureRecord(registry,b);if(previous)return previous;
    integrity(b.actor.run.data.expectedRequestHash===requestHash,'Failure does not concern the pending inspection request');
    const cleanupRequired=planningCleanupEnabled(registry,runId),closed=cleanupRequired?assertPlanningProviderClosed(registry,{runId,requestHash,
      retention:PLANNING_INSPECTION_RETENTION,reservationRecord:ref(b.call),expectedOutcome:'NO_DURABLE_RESPONSE',
      code:'PLANNING_INSPECTION_INTEGRITY'}):null;
    const record=registry.store.put(FAILURE,failureIdentity(b.call),{schema:'sovereign.planning-inspection-failure.v1',runId,requestHash,
      reservationRecord:ref(b.call),code,disposition:'ABANDONED_INFERENCE_ONLY',providerCompletion:'UNCONFIRMED',
      ...(closed?{cleanupRecord:ref(closed.cleanup)}:{})},{expectedVersion:0});
    if(closed)assertPlanningProviderClosed(registry,{runId,requestHash,retention:PLANNING_INSPECTION_RETENTION,reservationRecord:ref(b.call),
      outcomeRecord:ref(record),outcomeOrder:'after-cleanup',expectedOutcome:'NO_DURABLE_RESPONSE',code:'PLANNING_INSPECTION_INTEGRITY'});
    return record;
  });
}
