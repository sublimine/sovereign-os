// Public producer proposals committed with their receipts. This is not a tool
// cursor, semantic acceptance, or exactly-once remote inference guarantee.
import {canonical,check,clone,integer,keys,sha256} from './contracts.mjs';
import {inferenceRequestHash} from '../providers/instruction-profiles.mjs';
import {nativeReadActor,nativeReadCompletion} from './native-read-session.mjs';
import {readSourceContextView} from './source-context-view.mjs';
export const PRODUCER_RESPONSE_RETENTION='producer-response-v1';
export const PRODUCER_CLEANUP_PROTOCOL='producer-cleanup-v1';
const PRODUCER_CLEANUP_RECONCILIATION='producer-cleanup-reconciliation-v1';
const integrity=(ok,message)=>check(ok,'PRODUCER_RESPONSE_INTEGRITY',message);
const ref=r=>({type:r.type,id:r.id,version:r.version,hash:r.hash});
const cleanupId=(runId,step)=>`${runId}:cleanup:${step}`;
const CLEANUP_FIELDS=['schema','runId','step','requestHash','requestRecord','producerOrigin','workerConfiguration','proposalRecord','status','adapterCloseConfirmed','processExitObserved','scope'];
const CLEANUP_RECONCILIATION_FIELDS=['schema','priorCleanup','scope'];
const CLEANUP_SCOPE='Trusted adapter close outcome for this exact request. Omitted process observation is null, never invented. No whole-host absence or remote exactly-once guarantee.';
const CLEANUP_RECONCILIATION_SCOPE='The exact provider response was retained only after an earlier outer retention rollback. This row preserves the original durable close observation and links it to the later exact proposal; it is not a new provider call or a new close observation.';
export const producerResponseContract=({missionId,node,inputRefs})=>sha256({missionId,node,inputRefs});
function actor(registry,runId){
  const run=registry.store.get('run',runId),config=registry.store.get('worker-config',runId),production=registry.store.get('worker-production',runId);
  integrity(run?.data.mode==='producer'&&run.data.nodeId!=='planning'&&config&&production?.data.responseRetention===PRODUCER_RESPONSE_RETENTION,
    'Only a registered production invocation can retain its public proposals');
  const mission=registry.store.get('mission',run.data.missionId);
  const origin=registry.store.get('worker-production',runId,1);
  integrity(mission&&mission.data.intentHash===sha256(mission.data.intent)&&run.data.contextHash===sha256(run.data.context)
    &&config.data.prefixHash===sha256(config.data.instructions)&&origin?.data.responseRetention===PRODUCER_RESPONSE_RETENTION
    &&origin.data.contractHash===production.data.contractHash
    &&(origin.data.cleanupProtocol??null)===(production.data.cleanupProtocol??null)
    &&(origin.data.cleanupProtocol===undefined||origin.data.cleanupProtocol===PRODUCER_CLEANUP_PROTOCOL),
    'Producer mandate, context, invocation or prefix changed');
  return {run,config,production,mission,origin};
}
function requestFor(registry,a,requestHash){
  const record=registry.store.get('inference-request','inference-request:'+sha256([a.run.id,requestHash]));let request,exposure,task;
  try{request=JSON.parse(record.data.requestJson);exposure=readSourceContextView(request.input);task=JSON.parse(exposure.task);}catch{}
  integrity(record?.version===1&&record.data.schema==='sovereign.inference-request.v1'&&record.data.retention==='BEFORE_DISPATCH'&&record.data.runId===a.run.id
    &&record.data.missionId===a.run.data.missionId&&record.data.requestHash===requestHash
    &&request&&task&&inferenceRequestHash(request)===requestHash&&exposure.missionIntent===a.mission.data.intent
    &&task.node?.id===a.run.data.nodeId&&task.node.purpose===a.run.data.context.purpose
    &&producerResponseContract({missionId:a.run.data.missionId,node:task.node,inputRefs:task.inputRefs})===a.production.data.contractHash
    &&request.instructions.startsWith(a.config.data.instructions),
    'Producer response lacks its exact retained request and invocation contract');
  integer(task.step,'producer step',{min:0,max:100000});return {record,request,task};
}
function cleanupData({a,r,proposal,confirmed,result}){
  return {schema:PRODUCER_CLEANUP_PROTOCOL,runId:a.run.id,step:r.task.step,requestHash:r.record.data.requestHash,
    requestRecord:ref(r.record),producerOrigin:ref(a.origin),workerConfiguration:ref(a.config),proposalRecord:proposal?ref(proposal):null,
    status:confirmed&&result?.processExitObserved!==false?'CLOSED':'UNCONFIRMED',adapterCloseConfirmed:confirmed,
    processExitObserved:typeof result?.processExitObserved==='boolean'?result.processExitObserved:null,scope:CLEANUP_SCOPE};
}
function assertOriginalCleanup(a,r,record,{proposal=null}={}){
  const d=record?.data;
  keys(d,CLEANUP_FIELDS);
  integrity(record?.version===1&&d.schema===PRODUCER_CLEANUP_PROTOCOL&&d.runId===a.run.id&&d.step===r.task.step&&d.requestHash===r.record.data.requestHash
    &&canonical(d.requestRecord)===canonical(ref(r.record))&&canonical(d.producerOrigin)===canonical(ref(a.origin))
    &&canonical(d.workerConfiguration)===canonical(ref(a.config))&&['CLOSED','UNCONFIRMED'].includes(d.status)
    &&typeof d.adapterCloseConfirmed==='boolean'&&[true,false,null].includes(d.processExitObserved)
    &&d.status===(d.adapterCloseConfirmed&&d.processExitObserved!==false?'CLOSED':'UNCONFIRMED')
    &&canonical(d.proposalRecord)===canonical(proposal?ref(proposal):null)&&d.scope===CLEANUP_SCOPE,
  'Producer cleanup identity, state or original invocation changed');
  return d;
}
function assertCleanupKeys(value,allowed,message){
  try{keys(value,allowed);}catch{integrity(false,message);}
}
function assertReconciledCleanup(registry,{a,r,record,proposal}){
  const d=record?.data;
  assertCleanupKeys(d,[...CLEANUP_FIELDS,'reconciliation'],'Recovered producer cleanup record schema changed');
  assertCleanupKeys(d?.reconciliation,CLEANUP_RECONCILIATION_FIELDS,'Recovered producer cleanup linkage schema changed');
  integrity(record?.version===2&&d.schema===PRODUCER_CLEANUP_PROTOCOL&&d.runId===a.run.id&&d.step===r.task.step&&d.requestHash===r.record.data.requestHash
    &&canonical(d.requestRecord)===canonical(ref(r.record))&&canonical(d.producerOrigin)===canonical(ref(a.origin))
    &&canonical(d.workerConfiguration)===canonical(ref(a.config))&&['CLOSED','UNCONFIRMED'].includes(d.status)
    &&typeof d.adapterCloseConfirmed==='boolean'&&[true,false,null].includes(d.processExitObserved)
    &&d.status===(d.adapterCloseConfirmed&&d.processExitObserved!==false?'CLOSED':'UNCONFIRMED')
    &&d.status==='CLOSED'&&proposal?.version===1&&canonical(d.proposalRecord)===canonical(ref(proposal))&&d.scope===CLEANUP_SCOPE
    &&d.reconciliation.schema===PRODUCER_CLEANUP_RECONCILIATION&&d.reconciliation.scope===CLEANUP_RECONCILIATION_SCOPE,
  'Recovered producer cleanup identity or closure state changed');
  const prior=registry.store.get('producer-cleanup',record.id,1),priorData=assertOriginalCleanup(a,r,prior,{proposal:null});
  integrity(canonical(d.reconciliation.priorCleanup)===canonical(ref(prior)),
    'Recovered producer cleanup must bind its exact earlier close observation');
  const {proposalRecord:priorProposal,...priorCore}=priorData,{proposalRecord,reconciliation,...currentCore}=d;
  integrity(priorProposal===null&&canonical(currentCore)===canonical(priorCore),
    'Recovered producer cleanup may only add the exact retained proposal linkage');
  const order=[registry.committedSequence(r.record.type,r.record.id,1),registry.committedSequence(prior.type,prior.id,1),
    registry.committedSequence(proposal.type,proposal.id,1),registry.committedSequence(record.type,record.id,2)];
  integrity(order.every((n,i)=>Number.isSafeInteger(n)&&n>0&&(!i||n>order[i-1])),
    'Recovered producer cleanup chronology changed');
  return d;
}
// Trusted adapter outcome, captured even after generation fails. Missing closure
// is UNKNOWN; a completed public response is not evidence that close returned.
export function recordProducerCleanup(registry,{runId,requestHash,confirmed,result=null}){
  return registry.store.transact(()=>{
    const a=actor(registry,runId),r=requestFor(registry,a,requestHash);
    integrity(a.origin.data.cleanupProtocol===PRODUCER_CLEANUP_PROTOCOL&&typeof confirmed==='boolean'
      &&a.run.data.requests?.at(-1)?.requestHash===requestHash,'Cleanup belongs to the exact latest protected producer request');
    const proposal=registry.store.get('worker-proposal',`${runId}:proposal:${r.task.step}`);
    integrity(!proposal||proposal.version===1&&proposal.data.requestHash===requestHash,'Cleanup cannot borrow another proposal');
    return registry.store.put('producer-cleanup',cleanupId(runId,r.task.step),cleanupData({a,r,proposal,confirmed,result}),{expectedVersion:0});
  });
}
/** A provider may already have a durable v1 close observation when the outer
 * response transaction rolls back after attachInference.  Once the exact same
 * response is retained in-process, preserve that history and append a narrow
 * v2 linkage rather than pretending the provider was called or closed again. */
export function reconcileProducerCleanup(registry,{runId,requestHash}){
  return registry.store.transact(()=>{
    const a=actor(registry,runId),r=requestFor(registry,a,requestHash);
    integrity(a.origin.data.cleanupProtocol===PRODUCER_CLEANUP_PROTOCOL&&a.run.data.requests?.at(-1)?.requestHash===requestHash,
      'Cleanup reconciliation belongs to the exact latest protected producer request');
    const proposal=registry.store.get('worker-proposal',`${runId}:proposal:${r.task.step}`),current=registry.store.get('producer-cleanup',cleanupId(runId,r.task.step));
    if(!current)return null;
    integrity(proposal?.version===1&&proposal.data.requestHash===requestHash,'Cleanup reconciliation requires its exact retained proposal');
    if(current.version===2){assertReconciledCleanup(registry,{a,r,record:current,proposal});return current;}
    const prior=registry.store.get('producer-cleanup',current.id,1),priorData=assertOriginalCleanup(a,r,prior,{proposal:null});
    integrity(current.version===1&&current.hash===prior.hash,
      'Only the original no-proposal cleanup can be reconciled after rollback');
    integrity(priorData.status==='CLOSED',
      'An unconfirmed provider close cannot be rebound to a recovered proposal');
    return registry.store.put('producer-cleanup',current.id,{...priorData,proposalRecord:ref(proposal),reconciliation:{schema:PRODUCER_CLEANUP_RECONCILIATION,
      priorCleanup:ref(prior),scope:CLEANUP_RECONCILIATION_SCOPE}},{expectedVersion:current.version});
  });
}
/** Before response consumption, tool effects or replacement of a producer.
 * Historical unconsumed v1 proposals without a closure protocol cannot be
 * upgraded into proof. Existing accepted artifacts are not rewritten here. */
export function assertProducerProviderClosed(registry,runId){
  const db=registry.store.db,own=!db.isTransaction;if(own)db.exec('BEGIN');
  try{
  const origin=registry.store.get('worker-production',runId,1),state=registry.store.get('worker-production',runId);
  check(state?.data.errorCode!=='CLEANUP_UNCONFIRMED','CLEANUP_UNCONFIRMED','Original producer cleanup remains unconfirmed');
  if(origin?.data.responseRetention!==PRODUCER_RESPONSE_RETENTION)return null;
  const a=actor(registry,runId),requestHash=a.run.data.requests?.at(-1)?.requestHash;
  if(!requestHash)return null;
  check(a.origin.data.cleanupProtocol===PRODUCER_CLEANUP_PROTOCOL,'CLEANUP_UNCONFIRMED','Legacy producer has no durable closure evidence; do not infer it or buy a replacement');
  const r=requestFor(registry,a,requestHash),record=registry.store.get('producer-cleanup',cleanupId(runId,r.task.step)),proposal=registry.store.get('worker-proposal',`${runId}:proposal:${r.task.step}`),d=record?.data;
  if(d){
    if(record.version===1){
      assertOriginalCleanup(a,r,record,{proposal});
      const order=[registry.committedSequence(r.record.type,r.record.id,1),
        ...(proposal?[registry.committedSequence(proposal.type,proposal.id,1)]:[]),registry.committedSequence(record.type,record.id,1)];
      integrity(order.every((n,i)=>Number.isSafeInteger(n)&&n>0&&(!i||n>order[i-1])),'Producer request/response/cleanup chronology changed');
    }else if(record.version===2)assertReconciledCleanup(registry,{a,r,record,proposal});
    else integrity(false,'Producer cleanup has an unsupported history version');
  }
  check(d?.status==='CLOSED','CLEANUP_UNCONFIRMED','Producer closure is absent or unconfirmed; retain the exact request and public response');
  return record;
  }finally{if(own&&db.isTransaction)db.exec('ROLLBACK');}
}
export function retainProducerProposal(registry,{runId,step,requestHash,value,receipt,documentary=null,learningReceiptAttestation=null}){
  return registry.store.transact(()=>{
    const a=actor(registry,runId),r=requestFor(registry,a,requestHash);
    integrity(a.run.data.expectedRequestHash===requestHash&&r.task.step===step
      &&sha256(r.request.instructions)===a.run.data.context.instructionsHash,'Producer proposal is not the pending step');
    if(nativeReadActor(registry.store,a.run.data))nativeReadCompletion(registry,a.run.data,receipt,{value});
    const completed=registry.attachInference(runId,receipt,{learningReceiptAttestation});
    const proposal=registry.store.put('worker-proposal',`${runId}:proposal:${step}`,{runId,step,value:clone(value),inferenceReceiptHash:sha256(receipt),requestHash,
      retention:{schema:PRODUCER_RESPONSE_RETENTION,valueHash:sha256(value),requestRecord:ref(r.record),completedRunRecord:ref(completed),
        workerConfiguration:ref(a.config),policyHash:sha256(a.mission.data.policy),intentHash:a.mission.data.intentHash,
        contractHash:a.production.data.contractHash,documentary:clone(documentary)}},{expectedVersion:0});
    reconcileProducerCleanup(registry,{runId,requestHash});return proposal;
  });
}
export function rejectProducerFinal(registry,{runId,step,value,code}){
  const proposal=registry.store.get('worker-proposal',`${runId}:proposal:${step}`);
  if(proposal?.data.retention?.schema!==PRODUCER_RESPONSE_RETENTION)return;
  integrity(proposal.data.value.action==='final'&&sha256(proposal.data.value)===sha256(value),'Rejected final must identify its retained exact proposal');
  return registry.store.put('producer-final-disposition',proposal.id,{runId,step,proposal:ref(proposal),valueHash:sha256(value),code,disposition:'REJECTED'},{expectedVersion:0});
}
// Shared verification only. Callers own a coherent read/write transaction.
function verifiedLatestProducerProposal(registry,runId){
  if(registry.store.get('worker-production',runId,1)?.data.responseRetention!==PRODUCER_RESPONSE_RETENTION)return null;
  const a=actor(registry,runId),cleanup=assertProducerProviderClosed(registry,runId);
  const receipt=a.run.data.inferenceReceipt;if(!receipt)return null;
  const r=requestFor(registry,a,receipt.contextHash),proposal=registry.store.get('worker-proposal',`${runId}:proposal:${r.task.step}`),p=proposal?.data,h=p?.retention;
  integrity(proposal?.version===1&&p.runId===runId&&p.step===r.task.step&&p.requestHash===receipt.contextHash
    &&h?.schema===PRODUCER_RESPONSE_RETENTION&&h.valueHash===sha256(p.value)&&p.inferenceReceiptHash===sha256(receipt)
    &&canonical(h.requestRecord)===canonical(ref(r.record))&&canonical(h.workerConfiguration)===canonical(ref(a.config))
    &&h.policyHash===sha256(a.mission.data.policy)&&h.intentHash===a.mission.data.intentHash&&h.contractHash===a.production.data.contractHash,
    'Retained producer proposal or binding changed');
  const completed=h.completedRunRecord?.type==='run'&&h.completedRunRecord.id===runId
    ?registry.store.get('run',runId,h.completedRunRecord.version):null;
  integrity(completed?.hash===h.completedRunRecord?.hash&&completed.data.expectedRequestHash===null
    &&sha256(r.request.instructions)===completed.data.context.instructionsHash
    &&sha256(completed.data.inferenceReceipt)===p.inferenceReceiptHash
    &&sha256(a.run.data.inferenceReceipts?.at(-1)??null)===p.inferenceReceiptHash
    &&(a.run.data.inferenceReceipts??[]).filter(x=>x.contextHash===p.requestHash).length===1,
    'Retained producer proposal lacks its unique exact completed receipt');
  const seq=[registry.committedSequence(r.record.type,r.record.id,1),registry.committedSequence('run',runId,completed.version),registry.committedSequence(proposal.type,proposal.id,1)];
  integrity(seq.every(n=>Number.isSafeInteger(n)&&n>0)&&seq[0]<seq[1]&&seq[1]<seq[2],'Producer request, receipt and proposal commit order changed');
  return {a,receipt,r,proposal,p,h,completed,cleanup};
}
/** Exact public proposal data only, never dispatch/acceptance authority. Unlike
 * final-only lookup, a cursor must not borrow an older tool proposal when a
 * newer request is pending or completed without a retained answer. */
export function readVerifiedProducerProposal(registry,runId){
  const db=registry.store.db,own=!db.isTransaction;if(own)db.exec('BEGIN');
  try{
    const v=verifiedLatestProducerProposal(registry,runId);if(!v)return null;
    const {a,r,proposal,p,h,completed,cleanup}=v;
    integrity(!a.run.data.expectedRequestHash&&a.run.data.requests?.at(-1)?.requestHash===p.requestHash
      &&cleanup?.data.requestHash===p.requestHash,'A proposal reader cannot reuse an earlier response under a later request');
    return clone({runId,missionId:a.run.data.missionId,nodeId:a.run.data.nodeId,value:p.value,step:p.step,task:r.task,
      proposal:ref(proposal),requestHash:p.requestHash,requestRecord:ref(r.record),completedRunRecord:ref(completed),
      producerOrigin:ref(a.origin),workerConfiguration:ref(a.config),cleanup:ref(cleanup),contractHash:a.production.data.contractHash,
      documentary:h.documentary,scope:'Verified retained public proposal, not a permission grant, current-file observation or semantic acceptance.'});
  }finally{if(own&&db.isTransaction)db.exec('ROLLBACK');}
}
/** Read only; legacy responses, tools and already rejected finals are not
 * executed or inferred from history. Changed durable proof fails closed. */
export function readRecoverableProducerFinal(registry,{missionId,node,runId,inputRefs}){
  const db=registry.store.db,own=!db.isTransaction;if(own)db.exec('BEGIN');
  try{
    const state=registry.store.get('worker-production',runId);
    const verified=verifiedLatestProducerProposal(registry,runId);if(!verified)return null;
    const {a,r,proposal,p,h,completed}=verified;
    if(p.value.action!=='final')return null;
    // A review RETURN (or later invalidation) consumed this candidate. Retaining
    // the old public answer is not permission to resurrect it or ask for a new vote.
    if(registry.store.list('artifact').some(r=>r.data.payload.producerRunId===runId
      &&r.data.payload.nodeId===node.id&&!['CANDIDATE','ACCEPTED'].includes(r.data.status)))return null;
    const disposition=registry.store.get('producer-final-disposition',proposal.id);
    if(disposition){integrity(disposition.version===1&&disposition.data.disposition==='REJECTED'&&disposition.data.runId===runId
      &&disposition.data.step===p.step&&disposition.data.valueHash===h.valueHash&&canonical(disposition.data.proposal)===canonical(ref(proposal)),
      'Producer rejection disposition changed');return null;}
    // Documentary navigation has its own frame/cursor protocol. Retain its
    // answer, but do not import its windows into an ordinary recovery path.
    if(h.documentary!==null)return null;
    integrity(a.run.data.missionId===missionId&&a.production.data.contractHash===producerResponseContract({missionId,node,inputRefs}),
      'Final recovery must preserve exact node and input contract');
    integrity(!a.run.data.expectedRequestHash&&registry.exposureHash(a.run.data)===registry.exposureHash(completed.data),
      'An unconsumed final cannot be recovered under changed exposure or another pending request');
    check(state.data.errorCode!=='CLEANUP_UNCONFIRMED','CLEANUP_UNCONFIRMED','Reconcile provider cleanup before recovering its retained final');
    registry.requireCompletedExposure(a.run.data);
    return {value:clone(p.value),step:p.step,proposal:ref(proposal),requestHash:p.requestHash};
  }finally{if(own&&db.isTransaction)db.exec('ROLLBACK');}
}
