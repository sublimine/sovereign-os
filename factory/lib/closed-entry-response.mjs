// Durable public closed-entry answer/handoff. Never acceptance or a tool cursor.
import {canonical,check,clone,keys,sha256,string} from './contracts.mjs';
import {CLOSED_ENTRY_MODE,CLOSED_ENTRY_V2,CLOSED_ENTRY_NODE,PURPOSE,ROLES,CLOSED_ENTRY_SCHEMA,CLOSED_ENTRY_CRITERIA,entryContractHash} from './closed-entry-spec.mjs';
import {assertClosedResponseExposure} from './closed-response-contract.mjs';
import {inferenceRequestHash} from '../providers/instruction-profiles.mjs';
import {readSourceContextView} from './source-context-view.mjs';
export const CLOSED_ENTRY_RESPONSE_RETENTION='closed-entry-response-v1';
const ref=r=>({type:r.type,id:r.id,version:r.version,hash:r.hash});
const integrity=(ok,message)=>check(ok,'ENTRY_RESPONSE_INTEGRITY',message);
export function validateClosedEntryResponse(value){
  keys(value,['action','body','reason']);check(['answer','plan'].includes(value.action),'SCHEMA','Unknown closed-entry action');
  string(value.body,'closed body',{min:value.action==='answer'?1:0,max:256*1024});string(value.reason,'public entry reason',{max:4000});
  check(value.action!=='plan'||value.body==='','SCHEMA','Planning handoff cannot carry an unaccepted answer');return true;
}
export function closedEntryResponseActor(registry,runId){
  const {store}=registry,run=store.get('run',runId),configuration=store.get('worker-config',runId),mission=run&&store.get('mission',run.data.missionId),
    progress=mission&&store.get('closed-entry',mission.id),origin=mission&&store.get('closed-entry',mission.id,1),mode=mission?.data.policy.entryMode;
  check(run?.data.mode==='producer'&&run.data.nodeId===CLOSED_ENTRY_NODE&&run.data.context.purpose===PURPOSE
    &&[CLOSED_ENTRY_MODE,CLOSED_ENTRY_V2].includes(mode)&&progress?.data.runId===runId
    &&origin?.data.responseRetention===CLOSED_ENTRY_RESPONSE_RETENTION,'ENTRY_RESPONSE_SCOPE','Only the registered durable closed-entry actor can retain its response');
  integrity(progress.data.responseRetention===CLOSED_ENTRY_RESPONSE_RETENTION&&progress.data.version===mode&&progress.data.contractHash===entryContractHash(mode)
    &&mission.data.intentHash===sha256(mission.data.intent)&&progress.data.intentHash===mission.data.intentHash&&progress.data.policyHash===sha256(mission.data.policy)
    &&run.data.contextHash===sha256(run.data.context)&&configuration?.data.prefixHash===sha256(configuration?.data.instructions)
    &&canonical(configuration.data.roleIds)===canonical(mode===CLOSED_ENTRY_V2?[]:ROLES),'Closed entry mandate, prefix, role or protocol changed');
  integrity(!(run.data.context.artifactIds?.length)&&!(run.data.context.sourceIds?.length)&&!(run.data.context.planViews?.length)&&!(run.data.toolObservations?.length)
    &&!store.get('plan',mission.id)&&!store.list('node').some(r=>r.data.missionId===mission.id)&&!store.list('effect').some(r=>r.data.missionId===mission.id),
    'Closed entry cannot import effectful or planned exposure');
  if(mode===CLOSED_ENTRY_V2)assertClosedResponseExposure(store,run.data);
  return {run,configuration,mission,progress};
}
function requestFor(registry,actor,requestHash){
  const {run,mission,configuration}=actor,record=registry.store.get('inference-request','inference-request:'+sha256([run.id,requestHash]));let request,context,task;
  try{request=JSON.parse(record.data.requestJson);context=readSourceContextView(request.input);task=JSON.parse(context.task);}catch{}
  integrity(record?.version===1&&record.data.schema==='sovereign.inference-request.v1'&&record.data.retention==='BEFORE_DISPATCH'
    &&record.data.runId===run.id&&record.data.missionId===mission.id&&record.data.requestHash===requestHash
    &&run.data.requests?.length===1&&run.data.requests[0].requestHash===requestHash&&request&&inferenceRequestHash(request)===requestHash
    &&sha256(request.schema)===sha256(CLOSED_ENTRY_SCHEMA)&&request.model===mission.data.policy.model&&request.reasoningEffort===mission.data.policy.reasoningEffort
    &&(request.instructionProfile??'model-default')===(mission.data.policy.instructionProfile??'model-default')
    &&context.missionIntent===mission.data.intent&&canonical(task)===canonical({originalRequest:mission.data.intent,acceptanceCriteria:CLOSED_ENTRY_CRITERIA,entryMode:mission.data.policy.entryMode,tools:[]})
    &&sha256(request.instructions)===run.data.context.instructionsHash&&request.instructions.startsWith(configuration.data.instructions),
    'Closed response lacks its unique original request, criteria, model or complete prefix');
  return record;
}
export function retainClosedEntryResponse(registry,{runId,requestHash,value,receipt,learningReceiptAttestation=null}){
  return registry.store.transact(()=>{
    const a=closedEntryResponseActor(registry,runId),request=requestFor(registry,a,requestHash);validateClosedEntryResponse(value);
    integrity(a.run.data.expectedRequestHash===requestHash,'Closed answer is not its pending inference');
    const completed=registry.attachInference(runId,receipt,{learningReceiptAttestation});
    return registry.store.put('closed-entry-response',runId,{schema:CLOSED_ENTRY_RESPONSE_RETENTION,runId,missionId:a.mission.id,requestHash,
      value:clone(value),valueHash:sha256(value),receiptHash:sha256(receipt),requestRecord:ref(request),completedRunRecord:ref(completed),
      workerConfiguration:ref(a.configuration),intentHash:a.mission.data.intentHash,policyHash:sha256(a.mission.data.policy),contractHash:entryContractHash(a.mission.data.policy.entryMode)},
      {expectedVersion:0});
  });
}
// Trusted provider adapter outcome, not a claim about host-wide process absence.
// A real crash before this record leaves closure UNKNOWN and blocks automatic reuse.
export function recordClosedEntryCleanup(registry,{runId,confirmed,result=null}){
  const a=closedEntryResponseActor(registry,runId),requestHash=a.run.data.requests?.at(-1)?.requestHash;requestFor(registry,a,requestHash);
  return registry.store.put('closed-entry-cleanup',runId,{schema:CLOSED_ENTRY_RESPONSE_RETENTION,runId,requestHash,
    workerConfiguration:ref(a.configuration),status:confirmed&&result?.processExitObserved!==false?'CLOSED':'UNCONFIRMED',
    processExitObserved:typeof result?.processExitObserved==='boolean'?result.processExitObserved:null,
    scope:'Trusted provider.close returned without error, or failed. Optional process-exit observation is not inferred when adapter omits it.'},{expectedVersion:0});
}
export function readClosedEntryResponse(registry,runId){
  const db=registry.store.db,own=!db.isTransaction;if(own)db.exec('BEGIN');
  try{
    const run=registry.store.get('run',runId),origin=run&&registry.store.get('closed-entry',run.data.missionId,1);
    if(origin?.data.responseRetention!==CLOSED_ENTRY_RESPONSE_RETENTION)return null;
    const a=closedEntryResponseActor(registry,runId),record=registry.store.get('closed-entry-response',runId),cleanup=registry.store.get('closed-entry-cleanup',runId);
    if(!a.run.data.requests?.length){integrity(!record&&!cleanup,'Response or cleanup exists without dispatch');return null;}
    const requestHash=a.run.data.requests[0].requestHash,request=requestFor(registry,a,requestHash);
    if(cleanup)integrity(cleanup.version===1&&cleanup.data.schema===CLOSED_ENTRY_RESPONSE_RETENTION&&cleanup.data.runId===runId
      &&cleanup.data.requestHash===requestHash&&canonical(cleanup.data.workerConfiguration)===canonical(ref(a.configuration))
      &&['CLOSED','UNCONFIRMED'].includes(cleanup.data.status),'Closed-entry cleanup identity changed');
    check(cleanup?.data.status==='CLOSED','CLEANUP_UNCONFIRMED','Closed-entry provider closure is unconfirmed; reconcile original dispatch, do not buy a replacement');
    if(!record){integrity(!a.run.data.inferenceReceipt&&!(a.run.data.inferenceReceipts?.length),'Completed new entry lacks its durable public answer');return null;}
    const d=record.data;integrity(record.version===1&&d.schema===CLOSED_ENTRY_RESPONSE_RETENTION&&d.runId===runId&&d.missionId===a.mission.id
      &&d.requestHash===requestHash&&d.valueHash===sha256(d.value)&&d.intentHash===a.mission.data.intentHash&&d.policyHash===sha256(a.mission.data.policy)
      &&d.contractHash===entryContractHash(a.mission.data.policy.entryMode)&&canonical(d.requestRecord)===canonical(ref(request))
      &&canonical(d.workerConfiguration)===canonical(ref(a.configuration)),'Retained closed-entry response changed');
    const completed=d.completedRunRecord?.type==='run'&&d.completedRunRecord.id===runId?registry.store.get('run',runId,d.completedRunRecord.version):null;
    integrity(completed?.hash===d.completedRunRecord?.hash&&!completed.data.expectedRequestHash&&!a.run.data.expectedRequestHash
      &&registry.exposureHash(completed.data)===registry.exposureHash(a.run.data)&&sha256(completed.data.inferenceReceipt)===d.receiptHash
      &&sha256(a.run.data.inferenceReceipt)===d.receiptHash&&a.run.data.inferenceReceipts?.length===1&&sha256(a.run.data.inferenceReceipts[0])===d.receiptHash,
      'Closed-entry completion or exact exposure changed');
    const order=[registry.committedSequence(request.type,request.id,1),registry.committedSequence('run',runId,completed.version),
      registry.committedSequence(record.type,record.id,1),registry.committedSequence(cleanup.type,cleanup.id,1)];
    integrity(order.every(n=>Number.isSafeInteger(n)&&n>0)&&order.every((n,i)=>i===0||order[i-1]<n),'Request, receipt, response and cleanup order changed');
    validateClosedEntryResponse(d.value);registry.requireCompletedExposure(a.run.data);
    return {value:clone(d.value),receipt:clone(a.run.data.inferenceReceipt),responseRecord:ref(record)};
  }finally{if(own&&db.isTransaction)db.exec('ROLLBACK');}
}
