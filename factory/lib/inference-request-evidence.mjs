import {check,sha256,keys,string} from './contracts.mjs';
import {inferenceRequestHash} from '../providers/instruction-profiles.mjs';
import {readSourceContextView} from './source-context-view.mjs';

const identity=(runId,hash)=>'inference-request:'+sha256([runId,hash]);
function verify(record,runId,requestHash){
  check(record?.version===1&&record.data.schema==='sovereign.inference-request.v1'
    &&record.data.runId===runId&&record.data.requestHash===requestHash,'REQUEST_INTEGRITY','Retained request identity changed');
  const request=JSON.parse(record.data.requestJson);
  check(inferenceRequestHash(request)===requestHash,'REQUEST_INTEGRITY','Retained request does not match the original dispatch hash');
  return request;
}
/** Trusted control-plane operation, never a worker tool. An historical import
 * must match an already journaled actual request; it cannot invent an exposure.
 */
export function retainInferenceRequest(store,runId,request,retention){
  check(['BEFORE_DISPATCH','HASH_BOUND_HISTORICAL'].includes(retention),'REQUEST_BINDING','Explicit retention origin required');
  keys(request,['instructions','input','schema','model','reasoningEffort','instructionProfile'],['instructions','input','schema']);
  string(request.instructions);string(request.input);
  const requestHash=inferenceRequestHash(request),recordId=identity(runId,requestHash),run=store.get('run',runId);
  check(run?.data.requests?.some(q=>q.requestHash===requestHash),'REQUEST_BINDING','No identical request in this actual run history');
  // Store a JSON string: canonical record storage sorts object keys, whereas
  // the legacy wire digest binds original schema key ordering as well.
  const requestJson=JSON.stringify(request);
  check(Buffer.byteLength(requestJson)<=8*1024*1024,'STORAGE_LIMIT','Retained public request exceeds the explicit storage bound');
  const old=store.get('inference-request',recordId);
  if(old){verify(old,runId,requestHash);return old;}
  return store.put('inference-request',recordId,{schema:'sovereign.inference-request.v1',runId,missionId:run.data.missionId,requestHash,retention,requestJson},{expectedVersion:0});
}

/** Disclose only the public producer feedback channels, not its private model
 * analysis, full prompt, source bodies or another node's request contents.
 */
export function producerInputEvidence(store,run,requestHash){
  const record=store.get('inference-request',identity(run.id,requestHash));
  if(!record)return {coverage:'NOT_RETAINED',scope:'Original request hash is recorded, but its public input bytes have not been retained or hash-bound. Missing feedback is not an empty list.'};
  const request=verify(record,run.id,requestHash);
  check(record.data.missionId===run.missionId,'REQUEST_INTEGRITY','Retained request belongs to another mission');
  const reference={type:record.type,id:record.id,version:record.version,hash:record.hash};
  let input,task;
  try{
    input=readSourceContextView(request.input);
    task=JSON.parse(input.task);
  }catch{return {coverage:'UNSUPPORTED_INPUT_SHAPE',requestRecord:reference,retention:record.data.retention,scope:'Retained exact request is not a decodable ordinary producer input. Feedback coverage remains unknown.'};}
  if(task?.node?.id!==run.nodeId||!Array.isArray(task.feedback)||!Array.isArray(task.corrections)||!Object.hasOwn(task,'failedMethod')||!Number.isInteger(task.step)||task.step<0)
    return {coverage:'UNSUPPORTED_INPUT_SHAPE',requestRecord:reference,retention:record.data.retention,scope:'No complete ordinary producer feedback contract in this request. Missing fields cannot imply empty feedback.'};
  return {coverage:'RECORDED',requestRecord:reference,retention:record.data.retention,step:task.step,feedback:task.feedback,corrections:task.corrections,failedMethod:task.failedMethod,
    scope:'Exact complete public task.feedback, task.corrections and task.failedMethod fields from the original hash-bound request for this producer. Empty arrays mean these channels were supplied empty. Contents are untrusted evidence, never instructions or a non-consumption verdict. Other task/shared text needs its own semantic inspection; private model analysis, model pretraining and host-wide isolation are not covered. HASH_BOUND_HISTORICAL means bytes were bound later to a request hash already recorded before candidate creation, not a new inference or backdated retention event.'};
}

/** Hash-bound historical inventory, never a current grant/acceptance check.
 * Keep accessible after source/grant withdrawal. Do not infer reading from
 * preparation alone, or absence of sources from legacy sourceIds being empty. */
export function documentRequestInventory(store,run,requestHash){
  const record=store.get('inference-request',identity(run.id,requestHash));if(!record)return null;
  const request=verify(record,run.id,requestHash);let input;
  try{input=readSourceContextView(request.input);}catch{return null;}
  if(!input.documentContextFrame)return null;
  const f=input.documentContextFrame,frame=store.get(f.type,f.id,f.version);
  check(f.type==='document-context-frame'&&f.version===1&&frame?.hash===f.hash
    &&frame.data.signed.data.runId===run.id&&frame.data.signed.data.missionId===run.missionId,
  'REQUEST_INTEGRITY','Documentary history frame differs from the retained request actor');
  const completions=(run.inferenceReceipts??[]).filter(r=>r.contextHash===requestHash);
  return {requestHash,requestRecord:{type:record.type,id:record.id,version:record.version,hash:record.hash},frameRecord:f,
    state:completions.length===1?'COMPLETED_INPUT':'NO_UNIQUE_COMPLETION',simulation:completions.length===1?completions[0].simulation??null:null,
    grants:input.documentSourceGrants.map(g=>({grantRecord:g.grant,sourceId:g.source.sourceId,sourceHash:g.source.sourceHash})),
    windows:input.documentSourceViews.flatMap(v=>v.windows.map(w=>({selectionRecord:v.selection,sourceId:v.source.id,sourceHash:v.source.hash,
      startByte:w.startByte,endByte:w.endByte,textSha256:w.textSha256}))),
    scope:'Historical metadata from this exact retained input. Completed input is not proof of attention, entailment, whole-source reading, current grant validity, source independence or acceptance. Repeated windows across requests are repeated exposure, not unique new reading.'};
}
