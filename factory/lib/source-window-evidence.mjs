// Control-plane building block. NOT a native worker tool, policy switch,
// sourceIds reinterpretation or acceptance bypass. The explicit documentary
// protocol composes it; ordinary unopted workers keep their legacy exposure.
import {canonical,check,clone,digest,identifier,keys,list,sha256,string,unique} from './contracts.mjs';
import {readSourceWindow,verifySourceWindow,sourceWindowContainsQuote} from './source-windows.mjs';
import {readSourceContextView} from './source-context-view.mjs';
import {inferenceRequestHash} from '../providers/instruction-profiles.mjs';
import {documentSourceActor as actor,verifiedDocumentSource as acquired,verifiedAcquisitionObservation} from './source-documentary-scope.mjs';
import {readSourceManifestGrant,readSourceManifestGrants} from './source-manifest-grants.mjs';

const SELECTION='sovereign.source-window-selection.v1',VIEW='sovereign.document-source-view.v1';
const MAX_WINDOWS=16,MAX_SELECTED_BYTES=256*1024;
const reference=r=>({type:r.type,id:r.id,version:r.version,hash:r.hash});
function readSnapshot(registry,fn){
  const db=registry.store.db,owns=!db.isTransaction;
  if(owns)db.exec('BEGIN');
  try{return fn();}finally{if(owns)db.exec('ROLLBACK');}
}
function record(registry,ref){
  keys(ref,['type','id','version','hash']);
  const r=registry.store.get(ref.type,ref.id,ref.version);
  check(r&&r.hash===ref.hash,'SOURCE_WINDOW_INTEGRITY','Bound historical record is missing or changed');return r;
}
// Shared trusted-control-plane validators. They expose no broker capability.
// Multi-record callers must hold a coherent SQLite read/write transaction.
export {actor as documentSourceActor,acquired as verifiedDocumentSource};
function authorized(registry,run,source,grantRecord=null,checkedGrants=null){
  if(grantRecord){
    const grant=checkedGrants===null?readSourceManifestGrant(registry,grantRecord.id,{runId:run.id}):checkedGrants.get(grantRecord.id);
    check(grant&&canonical(grant.grant)===canonical(grantRecord)&&grant.source.sourceId===source.id&&grant.source.sourceHash===source.hash,
      'SOURCE_GRANT_SCOPE','Window selection requires this actor and exact source grant');
    return;
  }
  if(run.context.sourceIds.includes(source.id))return;
  verifiedAcquisitionObservation(registry,run,source);
}
function selectionView(selection,source){
  const d=selection.data;
  return {schema:VIEW,selection:reference(selection),runId:d.runId,missionId:d.missionId,
    ...(d.grantRecord?{grantRecord:clone(d.grantRecord)}:{}),
    source:{id:source.id,hash:source.hash,bytes:Buffer.byteLength(source.raw),url:source.url,
      httpStatus:source.httpStatus,retrievedAt:source.retrievedAt,mediaType:source.mediaType,
      receiptId:source.receiptId,receiptHash:source.receiptHash,
      exposure:'MANIFEST_PLUS_LITERAL_WINDOWS_NOT_FULL_RAW'},windows:clone(d.windows)};
}

/** Prepare immutable, actor-authorized windows BEFORE any referring dispatch.
 * Source/receipt/run stay unchanged. The selection itself proves no inference,
 * semantic support or absence of other text in the eventual request. */
export function prepareSourceWindowSelection(registry,options){
  canonical(options);keys(options,['runId','sourceId','ranges','grantId'],['runId','sourceId','ranges']);
  const {runId,sourceId,ranges,grantId}=options;
  return registry.store.transact(()=>{
    const r=actor(registry,runId),run=r.data;
    check(!run.expectedRequestHash,'INFERENCE_PENDING','Cannot select source windows while inference is pending');
    const source=acquired(registry,sourceId,run.missionId);
    const grant=grantId===undefined?null:readSourceManifestGrant(registry,grantId,{runId}),grantRecord=grant?.grant??null;
    // This grant was just authenticated for this actor in the same synchronous
    // transaction. Bind its exact source here; do not read and validate it twice.
    // Historical selection readers still revalidate their stored grant anew.
    if(grant)check(grant.source.sourceId===source.data.id&&grant.source.sourceHash===source.data.hash,
      'SOURCE_GRANT_SCOPE','Window selection requires this actor and exact source grant');
    else authorized(registry,run,source.data);
    list(ranges,'window ranges',{min:1,max:MAX_WINDOWS});
    const windows=ranges.map(range=>readSourceWindow(source.data,range));unique(windows.map(sha256),'window identities');
    check(windows.reduce((sum,w)=>sum+w.endByte-w.startByte,0)<=MAX_SELECTED_BYTES,
      'SOURCE_WINDOW_LIMIT','Selected literal windows exceed their aggregate cap');
    const mission=registry.store.get('mission',run.missionId);
    check(mission?.data.policy,'SOURCE_WINDOW_SCOPE','Frozen mission policy required');
    const binding={schema:SELECTION,runId,missionId:run.missionId,nodeId:run.nodeId,mode:run.mode,
      runRecord:reference(r),sourceRecord:reference(source),policyHash:sha256(mission.data.policy),
      ...(grantRecord?{grantRecord}:{}),windows};
    const selectionId='source-window-selection:'+sha256(binding),old=registry.store.get('source-window-selection',selectionId);
    if(old)check(old.version===1&&canonical(old.data)===canonical(binding),'SOURCE_WINDOW_INTEGRITY','Immutable selection changed');
    const selected=old??registry.store.put('source-window-selection',selectionId,binding,{expectedVersion:0});
    return selectionView(selected,source.data);
  });
}

/** Revalidate the current source and original actor grant, not a cached label. */
export function readSourceWindowSelection(registry,selectionId,{runId}){
  return readSnapshot(registry,()=>readSelection(registry,selectionId,runId));
}
function selectionRecord(registry,selectionId){
  identifier(selectionId);const selection=registry.store.get('source-window-selection',selectionId),d=selection?.data;
  check(selection?.version===1&&d.schema===SELECTION&&selection.id==='source-window-selection:'+sha256(d),
    'SOURCE_WINDOW_INTEGRITY','Selection is missing, re-versioned or changed');
  return selection;
}
function selectionActor(selection,current){
  const d=selection.data;
  check(d.runId===current.id&&d.missionId===current.data.missionId&&d.nodeId===current.data.nodeId&&d.mode===current.data.mode,
    'SOURCE_WINDOW_SCOPE','Selection belongs to another actor or scope');
}
function readSelection(registry,selectionId,runId,checked=null){
  // checked is constructed only by the synchronous batch below. The scalar
  // API cannot receive it, and every later public call builds fresh authority.
  identifier(selectionId);const current=checked?.actor??actor(registry,runId),selection=checked?.selection??selectionRecord(registry,selectionId),d=selection.data;
  selectionActor(selection,current);
  const admitted=record(registry,d.runRecord),original=record(registry,d.sourceRecord);
  check(admitted.type==='run'&&admitted.id===runId&&original.type==='source'
    &&admitted.data.contextHash===sha256(admitted.data.context)
    &&admitted.data.missionId===d.missionId&&admitted.data.nodeId===d.nodeId&&admitted.data.mode===d.mode,
    'SOURCE_WINDOW_INTEGRITY','Selection admission binding differs');
  check(d.policyHash===sha256(registry.store.get('mission',d.missionId)?.data.policy),
    'SOURCE_WINDOW_SCOPE','Mission policy changed since selection');
  check(current.data.context.purpose===admitted.data.context.purpose,
    'SOURCE_WINDOW_SCOPE','Actor purpose changed since its source-window grant');
  const source=acquired(registry,original.id,d.missionId).data;
  check(original.data.hash===source.hash&&original.data.raw===source.raw&&original.data.receiptHash===source.receiptHash,
    'SOURCE_WINDOW_INTEGRITY','Selected snapshot differs from current admitted source');
  authorized(registry,admitted.data,source,d.grantRecord??null,checked?.grants??null);
  list(d.windows,'selected windows',{min:1,max:MAX_WINDOWS});unique(d.windows.map(sha256),'window identities');
  d.windows.forEach(w=>verifySourceWindow(source,w));
  check(d.windows.reduce((sum,w)=>sum+w.endByte-w.startByte,0)<=MAX_SELECTED_BYTES,'SOURCE_WINDOW_LIMIT','Window byte budget changed');
  const order=registry.committedSequence(selection.type,selection.id,1);
  check(registry.committedSequence(admitted.type,admitted.id,admitted.version)<order
    &&registry.committedSequence(original.type,original.id,original.version)<order
    &&(!d.grantRecord||registry.committedSequence(d.grantRecord.type,d.grantRecord.id,d.grantRecord.version)<order),
  'SOURCE_WINDOW_INTEGRITY','Selection precedes its grant or source');
  return selectionView(selection,source);
}

/** Exact scalar views for one actor's bounded selection set. Validate each
 * grant and common parent once inside this snapshot, never across calls.
 * No model exposure, callback, caller cache, partial result or journal write.
 * Whole-request aggregate window/byte limits still belong to its consumers. */
export function readSourceWindowSelections(registry,options){
  canonical(options);keys(options,['runId','selectionIds']);const {runId,selectionIds}=options;
  identifier(runId);list(selectionIds,'document selections',{max:MAX_WINDOWS});unique(selectionIds);
  return readSnapshot(registry,()=>{
    const current=actor(registry,runId),selections=selectionIds.map(id=>selectionRecord(registry,id));
    selections.forEach(selection=>selectionActor(selection,current));
    const grantIds=[...new Set(selections.flatMap(r=>r.data.grantRecord?[r.data.grantRecord.id]:[]))];
    const grants=new Map((grantIds.length?readSourceManifestGrants(registry,{runId,grantIds}):[]).map(g=>[g.grant.id,g]));
    return selections.map(selection=>readSelection(registry,selection.id,runId,{actor:current,selection,grants}));
  });
}

/** Read-only proof of ONE quote in ONE selected window actually sent in a
 * hash-retained completed request of THIS actor. No concatenation across gaps,
 * historical re-binding, manifest-only citation or cross-actor borrowing.
 * This is evidence for the future versioned protocol, not an acceptance method. */
export function sourceWindowRequestEvidence(registry,options){
  canonical(options);keys(options,['runId','requestHash','selectionId','windowHash','quote']);
  const {runId,requestHash,...quote}=options;digest(requestHash);validateQuote(quote);
  return readSnapshot(registry,()=>{
    // Preserve selection/actor admission before request evidence in the scalar
    // API. The same factors below serve batches; no alternate source parser.
    const view=readSourceWindowSelection(registry,quote.selectionId,{runId});
    return quoteEvidence(registry,completedRequest(registry,runId,requestHash),view,quote,new Map());
  });
}
function validateQuote(q){
  keys(q,['selectionId','windowHash','quote']);identifier(q.selectionId);digest(q.windowHash);
  string(q.quote,'window quote',{max:20000});
  check(q.quote.isWellFormed(),'SOURCE_WINDOW_RANGE','A quote cannot select half of a Unicode scalar');
}
function completedRequest(registry,runId,requestHash){
  const run=actor(registry,runId).data;
  const requests=(run.requests??[]).filter(q=>q.requestHash===requestHash),receipts=(run.inferenceReceipts??[])
    .filter(r=>r.contextHash===requestHash&&['completed','COMPLETED'].includes(r.status));
  check(requests.length>0&&receipts.length===1,'SOURCE_WINDOW_UNOBSERVED','No unique completed request of this actor binds the window');
  const retained=registry.store.get('inference-request','inference-request:'+sha256([runId,requestHash]));
  check(retained?.version===1&&retained.data.schema==='sovereign.inference-request.v1'&&retained.data.retention==='BEFORE_DISPATCH'
    &&retained.data.runId===runId&&retained.data.missionId===run.missionId&&retained.data.requestHash===requestHash,
  'SOURCE_WINDOW_REQUEST','Exact prospective request retention is required');
  let request,input;
  try{request=JSON.parse(retained.data.requestJson);input=readSourceContextView(request.input);}catch{}
  check(request&&inferenceRequestHash(request)===requestHash&&input,'SOURCE_WINDOW_REQUEST','Retained request bytes changed or cannot be decoded');
  const views=input.documentSourceViews;
  check(Array.isArray(views)&&views.length<=MAX_WINDOWS,'SOURCE_WINDOW_UNOBSERVED','No bounded literal document-view field was sent');
  const retainedSequence=registry.committedSequence(retained.type,retained.id,retained.version);
  // Find first committed admission and completion of this request, not merely
  // the latest run head or a timestamp that could conceal late registration.
  let firstRequest=null,firstCompletion=null;
  for(let version=registry.store.get('run',runId).version;version>=1;version--){
    const r=registry.store.get('run',runId,version);
    if(r.data.requests?.some(q=>q.requestHash===requestHash))firstRequest=r;
    if(r.data.inferenceReceipts?.some(q=>q.contextHash===requestHash))firstCompletion=r;
  }
  const dispatchSequence=firstRequest&&registry.committedSequence('run',runId,firstRequest.version);
  const completedSequence=firstCompletion&&registry.committedSequence('run',runId,firstCompletion.version);
  check(dispatchSequence<retainedSequence&&retainedSequence<completedSequence,
    'SOURCE_WINDOW_REQUEST','Dispatch, retention and completion were not committed in order');
  return {run,runId,requestHash,views,retained,receipt:receipts[0],dispatchSequence,retainedSequence,completedSequence};
}
function quoteEvidence(registry,context,view,{selectionId,windowHash,quote},sources){
  const {run,runId,requestHash,views,retained,receipt,dispatchSequence,retainedSequence,completedSequence}=context;
  const actual=views.filter(v=>v?.selection?.id===selectionId);
  check(actual.length===1&&canonical(actual[0])===canonical(view),'SOURCE_WINDOW_UNOBSERVED','Actual request did not contain this exact actor-bound literal view');
  if(!sources.has(view.source.id))sources.set(view.source.id,acquired(registry,view.source.id,run.missionId).data);
  const source=sources.get(view.source.id),window=view.windows.find(w=>sha256(w)===windowHash);
  check(window&&sourceWindowContainsQuote(source,window,quote),'SOURCE_WINDOW_UNOBSERVED','Quote was not observed inside this exact single window');
  const selectionSequence=registry.committedSequence(view.selection.type,selectionId,1);
  check(selectionSequence<dispatchSequence&&dispatchSequence<retainedSequence&&retainedSequence<completedSequence,
    'SOURCE_WINDOW_REQUEST','Selection, dispatch, retention and completion were not committed in order');
  const startByte=window.startByte+Buffer.byteLength(window.text.slice(0,window.text.indexOf(quote)));
  return {schema:'sovereign.source-window-request-evidence.v1',runId,missionId:run.missionId,requestHash,
    selection:clone(view.selection),requestRecord:reference(retained),sourceId:source.id,sourceHash:source.hash,windowHash,
    quote:{text:quote,startByte,endByte:startByte+Buffer.byteLength(quote)},
    inference:{threadId:receipt.threadId,turnId:receipt.turnId,simulation:receipt.simulation??null,receiptHash:sha256(receipt)},
    chronology:{selectionSequence,dispatchSequence,retainedSequence,completedSequence},
    scope:'Exact bytes in one completed actor-scoped request, not semantic support, full-document reading, independent review, absence of other exposure or artifact acceptance. Revalidated in one SQLite snapshot; consumers must recheck at point of use. Simulation/null is not a real-model qualification.'};
}

/** Complete scalar proofs for one actor/request in a coherent synchronous
 * snapshot. Reuse only freshly checked request/selection/source data inside
 * this call. No callback, caller cache, write, cross-call authority or verdict.
 * A failed member returns no partial result; duplicate quotes remain distinct
 * proofs with independent returned objects. Empty batches still bind a request. */
export function sourceWindowRequestEvidenceBatch(registry,options){
  canonical(options);keys(options,['runId','requestHash','quotes']);
  const {runId,requestHash,quotes}=options;identifier(runId);digest(requestHash);
  list(quotes,'window proof batch',{max:20000});quotes.forEach(validateQuote);
  return readSnapshot(registry,()=>{
    const context=completedRequest(registry,runId,requestHash),sources=new Map(),selectionIds=[...new Set(quotes.map(q=>q.selectionId))];
    const views=new Map((selectionIds.length?readSourceWindowSelections(registry,{runId,selectionIds}):[]).map(v=>[v.selection.id,v]));
    return quotes.map(q=>quoteEvidence(registry,context,views.get(q.selectionId),q,sources));
  });
}
