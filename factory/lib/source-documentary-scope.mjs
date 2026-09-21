// Trusted-control-plane validators, not broker capabilities or acceptance.
// Multi-record callers must hold a coherent SQLite transaction.
import {canonical,check,identifier,sha256} from './contracts.mjs';

export function documentSourceActor(registry,runId){
  identifier(runId);const r=registry.store.get('run',runId),run=r?.data;
  check(run?.id===runId&&['producer','reviewer'].includes(run.mode)
    &&!['closed-entry','review:closed-entry'].includes(run.nodeId)
    &&!['closed-blind-attempt-assessment','closed-blind-comparison','blind-protocol'].includes(run.context.purpose)
    &&!registry.store.get('worker-config',runId)?.data.controllerContract,
  'SOURCE_WINDOW_SCOPE','This actor cannot receive documentary windows');
  const nodeId=run.mode==='reviewer'&&run.nodeId.startsWith('review:')?run.nodeId.slice(7):run.nodeId;
  const node=registry.store.get('node',`${run.missionId}:${nodeId}`)?.data;
  check(!node?.spec.execution,'SOURCE_WINDOW_SCOPE','Special closed/native execution cannot acquire window exposure');
  check(run.contextHash===sha256(run.context),'SOURCE_WINDOW_INTEGRITY','Current context binding differs');
  return r;
}
// This is a provenance check for every acquired source, not just documentary
// windows.  Keep the historical name below as an alias for existing callers.
export function verifiedAcquiredSource(registry,sourceId,missionId){
  identifier(sourceId);const r=registry.store.get('source',sourceId),s=r?.data;
  check(s?.id===sourceId&&s.missionId===missionId&&s.status==='ADMITTED','SOURCE_UNAVAILABLE','Source missing, foreign or retracted');
  const signed=registry.store.get('effect',s.receiptId)?.data.receipt;
  check(signed,'SOURCE_WINDOW_ACQUISITION','Source has no committed acquisition');
  const receipt=registry.verifiedToolReceipt(signed),v=receipt.result;
  check(receipt.tool==='source.fetch'&&receipt.status==='SUCCEEDED'&&receipt.missionId===missionId
    &&s.id===`source:${receipt.id}`&&s.receiptId===receipt.id&&s.receiptHash===sha256(signed)
    &&s.raw===v.content&&sha256(s.raw)===s.hash&&s.hash===v.sha256
    &&s.url===(v.finalUrl??v.url)&&s.retrievedAt===v.retrievedAt
    &&s.httpStatus===(v.status??null)&&s.mediaType===(v.mediaType??'unknown'),
  'SOURCE_WINDOW_ACQUISITION','Raw source and acquisition identity must match the committed receipt');
  return r;
}
export const verifiedDocumentSource=verifiedAcquiredSource;
export function verifiedAcquisitionObservation(registry,run,source){
  const observed=(run.toolObservations??[]).find(o=>o.id===source.receiptId);
  check(observed&&observed.hash===source.receiptHash,'SOURCE_WINDOW_SCOPE','Admitted source was not granted to this actor');
  const receipt=registry.verifiedToolReceipt(observed.signedReceipt);
  check(receipt.id===source.receiptId&&receipt.missionId===run.missionId
    &&observed.hash===sha256(observed.signedReceipt)&&observed.principalId===receipt.principalId
    &&observed.resultText===canonical(receipt.result)
    &&observed.relation===(receipt.principalId===run.id?'OWN_ACTION':'EXTERNAL_OBSERVATION'),
  'SOURCE_WINDOW_SCOPE','Acquisition observation is not bound to this actor');
  return observed;
}
