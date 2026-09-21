// Prospective, signed documentary inputs and completed-request evidence.
// This is NOT a production policy switch, broker tool or acceptance method.
import {canonical,check,clone,digest,identifier,keys,list,sha256,string,unique} from './contracts.mjs';
import {projectAcquisitionContext} from './source-acquisition-projection.mjs';
import {documentSourceActor,verifiedDocumentSource} from './source-documentary-scope.mjs';
import {readSourceManifestGrants} from './source-manifest-grants.mjs';
import {readSourceWindowSelections,sourceWindowRequestEvidence} from './source-window-evidence.mjs';
import {sourceWindowContainsQuote} from './source-windows.mjs';
import {readSourceContextView} from './source-context-view.mjs';
import {describeSourceRelationships} from './source-relationships.mjs';
import {inferenceRequestHash} from '../providers/instruction-profiles.mjs';

const TYPE='document-context-frame',SCHEMA='sovereign.document-context-frame.v1',SEAL='document.context.frame';
// The caller/retention string contract is 1,000,000 bytes, narrower than the
// worker 1MiB cap. Preparation must fit BOTH, not fail later during retention.
const MAX_BYTES=1000000,MAX_WINDOWS=16,MAX_WINDOW_BYTES=256*1024;
const RESERVED=['documentContextFrame','documentSourceGrants','documentSourceViews','documentAcquisitionProjection','documentEvidenceCatalog','documentSourceRelationships'];
const ref=r=>({type:r.type,id:r.id,version:r.version,hash:r.hash});
function snapshot(registry,fn){const db=registry.store.db,own=!db.isTransaction;if(own)db.exec('BEGIN');try{return fn();}finally{if(own)db.exec('ROLLBACK');}}
function historical(registry,r,type){
  keys(r,['type','id','version','hash']);const value=registry.store.get(r.type,r.id,r.version);
  check(r.type===type&&value?.hash===r.hash,'DOCUMENT_FRAME_INTEGRITY','Historical frame binding changed');return value;
}
function inputFor(record){return {...clone(record.data.signed.data.view),documentContextFrame:ref(record)};}
function windowLimits(views){
  list(views,'document selections',{max:MAX_WINDOWS});unique(views.map(v=>v.selection.id));
  const windows=views.flatMap(v=>v.windows);
  check(windows.length<=MAX_WINDOWS&&windows.reduce((n,w)=>n+w.endByte-w.startByte,0)<=MAX_WINDOW_BYTES,
    'DOCUMENT_FRAME_LIMIT','Whole-request windows exceed their aggregate count or byte cap');
}
// A catalogue identifies fields; it does not duplicate their text or turn a
// projected receipt into a complete receipt. Keys are local to one exact frame.
function targets(view){
  const result=[],add=(identity,text)=>result.push({...identity,sourceKey:'d'+(result.length+1),text});
  for(const a of view.artifactViews){
    const full=a.kind==='FULL_ARTIFACT',payload=full?a.artifact.payload:a.payloadView;
    add({kind:'artifact-body',id:full?a.artifact.id:a.artifactId,hash:full?a.artifact.hash:a.originalPayloadHash},payload.body);
    for(const receipt of full?[]:payload.toolReceiptViews){
      if(receipt.kind!=='ACQUISITION_METADATA_VIEW')continue;
      const v=receipt.receiptView;
      add({kind:'acquisition-metadata',id:v.receiptMetadata.id,hash:v.originalReceiptHash,viewHash:receipt.viewHash,
        containerArtifactId:a.artifactId,relation:'EMBEDDED_RECEIPT_NOT_ACTOR_ACTION'},canonical(v.resultMetadata));
    }
  }
  for(const o of view.toolObservationViews){
    if(o.kind==='FULL_TOOL_OBSERVATION')add({kind:'tool-observation',id:o.observation.id,hash:o.observation.hash,
      principalId:o.observation.principalId,relation:o.observation.relation},o.observation.quoteText);
    else add({kind:'acquisition-metadata',id:o.operationId,hash:o.originalReceiptHash,viewHash:o.viewHash,
      principalId:o.principalId,relation:o.relation},canonical(o.receiptView.resultMetadata));
  }
  for(const r of view.runtimeObservations??[])add({kind:'runtime-observation',id:r.id,hash:r.hash},r.quoteText);
  for(const g of view.documentSourceGrants)add({kind:'source-manifest',id:g.grant.id,hash:g.grant.hash,sourceId:g.source.sourceId},canonical(g.source));
  for(const v of view.documentSourceViews)for(const w of v.windows)add({kind:'source-window',id:v.selection.id,hash:sha256(w),
    sourceId:v.source.id,sourceHash:v.source.hash,startByte:w.startByte,endByte:w.endByte},w.text);
  return result;
}
const catalog=view=>targets(view).map(({text,...identity})=>identity);
function authenticateSupplementalContext(run,context){
  check(canonical(context.planViews??null)===canonical(run.context.planViews??null),
    'DOCUMENT_FRAME_SCOPE','Plan views must remain the complete actual assigned views');
  const expected=run.runtimeObservations??[],actual=context.runtimeObservations??[];
  list(actual,'runtime observations',{max:1000});
  check(actual.length===expected.length&&actual.every((value,index)=>{
    const {interpretation,...observed}=value;
    return typeof interpretation==='string'&&canonical(observed)===canonical(expected[index]);
  }),'DOCUMENT_FRAME_INTEGRITY','Runtime observations differ from the actual actor inventory');
  const relationships=context.sources.length>1?describeSourceRelationships(context.sources):null;
  check(canonical(context.sourceRelationships??null)===canonical(relationships),
    'DOCUMENT_FRAME_INTEGRITY','Source relationships differ from the complete source inventory');
}

/** Caller supplies the complete trusted next input (task/feedback included).
 * Preparation only freezes evidence. It never dispatches, infers or changes
 * run/sourceIds/worker configuration, and cannot hide previous raw exposure. */
export function prepareDocumentContextFrame(registry,options){
  canonical(options);keys(options,['runId','context','grantIds','selectionIds'],['runId','context']);
  const {runId,context,grantIds=[],selectionIds=[]}=options;
  return registry.store.transact(()=>{
    const actor=documentSourceActor(registry,runId),run=actor.data;
    check(!run.expectedRequestHash,'INFERENCE_PENDING','Freeze documentary input before dispatch');
    check(RESERVED.every(k=>!Object.hasOwn(context,k)),'DOCUMENT_FRAME_SCOPE','Caller cannot overwrite reserved documentary fields');
    string(context.task,'complete worker task',{min:0,max:4*1024*1024});
    const preview=projectAcquisitionContext(registry,{runId,context});authenticateSupplementalContext(run,context);
    list(grantIds,'document grants',{max:64});unique(grantIds);list(selectionIds,'document selections',{max:MAX_WINDOWS});unique(selectionIds);
    const grants=readSourceManifestGrants(registry,{runId,grantIds}),selections=readSourceWindowSelections(registry,{runId,selectionIds});
    for(const selected of selections)check(selected.grantRecord&&grants.some(g=>canonical(g.grant)===canonical(selected.grantRecord)),
      'DOCUMENT_FRAME_SCOPE','Every selected window must use an explicit grant included in this frame');
    windowLimits(selections);
    const {view:projectedView,...projection}=preview;
    const view={...projectedView,documentSourceGrants:grants,documentSourceViews:selections,
      ...(grants.length>1?{documentSourceRelationships:describeSourceRelationships(grants.map(g=>({id:g.source.sourceId,hash:g.source.sourceHash,url:g.source.url})))}:{}),
      documentAcquisitionProjection:{...projection,mode:'SIGNED_FRAME_PREPARATION_NOT_DISPATCH_AUTHORIZATION'}};
    view.documentEvidenceCatalog=catalog(view);
    const sourceIds=new Set([...context.sources.map(s=>s.id),...grants.map(g=>g.source.sourceId)]),effects=new Map();
    for(const signed of [...(run.toolObservations??[]).map(o=>o.signedReceipt),...context.artifacts.flatMap(a=>a.payload.toolReceipts)]){
      const receipt=registry.verifiedToolReceipt(signed);effects.set(receipt.id,ref(registry.store.get('effect',receipt.id)));
      if(receipt.tool==='source.fetch'&&receipt.status==='SUCCEEDED')sourceIds.add('source:'+receipt.id);
    }
    const mission=registry.store.get('mission',run.missionId),configuration=registry.store.get('worker-config',runId);
    const runtimeRecords=(run.runtimeObservations??[]).map(o=>{
      registry.runtimeReference({...o,quote:o.quoteText},run,{current:false});
      return ref(registry.store.get('runtime-observation',o.id));
    });
    const binding={schema:SCHEMA,runId,missionId:run.missionId,nodeId:run.nodeId,mode:run.mode,purpose:run.context.purpose,
      runRecord:ref(actor),missionRecord:ref(mission),intentHash:mission.data.intentHash,policyHash:sha256(mission.data.policy),
      workerConfiguration:configuration?ref(configuration):null,
      sourceRecords:[...sourceIds].sort().map(id=>ref(verifiedDocumentSource(registry,id,run.missionId))),
      artifactRecords:run.context.artifactIds.map(id=>ref(registry.store.get('artifact',id))),effectRecords:[...effects.values()],runtimeRecords,
      view,viewHash:sha256(view),scope:'Complete next-input projection frozen before any referring request. Acquisition metadata is not raw text; windows, criteria, task and other evidence remain distinct. Not dispatch authority, semantic truth, full-document reading, independent review or material acceptance.'};
    const frameId=TYPE+':'+sha256(binding),signed=registry.authority.seal(SEAL,binding),old=registry.store.get(TYPE,frameId);
    const prospective={type:TYPE,id:frameId,version:1,hash:sha256({signed}),data:{signed}};
    check(Buffer.byteLength(JSON.stringify(inputFor(prospective)))<=MAX_BYTES,'CONTEXT_LIMIT','Complete documentary input exceeds the 1,000,000-byte request guard; no non-acquisition fields were truncated');
    if(old)check(old.version===1&&canonical(old.data)===canonical({signed}),'DOCUMENT_FRAME_INTEGRITY','Immutable documentary frame changed');
    return inputFor(old??registry.store.put(TYPE,frameId,{signed},{expectedVersion:0}));
  });
}

function readFrame(registry,frameId,runId){
  identifier(frameId);const actor=documentSourceActor(registry,runId),record=registry.store.get(TYPE,frameId);
  check(record?.version===1,'DOCUMENT_FRAME_INTEGRITY','Documentary frame is absent or re-versioned');
  const d=registry.authority.open(record.data.signed,SEAL);
  check(d.schema===SCHEMA&&frameId===TYPE+':'+sha256(d)&&sha256(d.view)===d.viewHash,
    'DOCUMENT_FRAME_INTEGRITY','Signed frame content or identity changed');
  check(d.runId===runId&&d.missionId===actor.data.missionId&&d.nodeId===actor.data.nodeId&&d.mode===actor.data.mode
    &&d.purpose===actor.data.context.purpose,'DOCUMENT_FRAME_SCOPE','Documentary frame belongs to a different actor or purpose');
  const admitted=historical(registry,d.runRecord,'run'),mission=historical(registry,d.missionRecord,'mission'),currentMission=registry.store.get('mission',d.missionId);
  check(admitted.id===runId&&admitted.data.contextHash===sha256(admitted.data.context)
    &&admitted.data.missionId===d.missionId&&admitted.data.nodeId===d.nodeId&&admitted.data.mode===d.mode
    &&admitted.data.context.purpose===d.purpose&&!admitted.data.expectedRequestHash,
  'DOCUMENT_FRAME_INTEGRITY','Original documentary actor binding changed');
  check(mission.id===d.missionId&&mission.data.intentHash===sha256(mission.data.intent)&&mission.data.intentHash===d.intentHash
    &&currentMission.data.intentHash===d.intentHash&&currentMission.data.intent===mission.data.intent
    &&sha256(mission.data.policy)===d.policyHash&&sha256(currentMission.data.policy)===d.policyHash,
  'DOCUMENT_FRAME_SCOPE','Documentary intent or mission policy changed');
  const config=registry.store.get('worker-config',runId);
  check(d.workerConfiguration?config&&canonical(ref(config))===canonical(d.workerConfiguration):!config,
    'DOCUMENT_FRAME_SCOPE','Worker compilation changed after documentary preparation');
  if(d.workerConfiguration)historical(registry,d.workerConfiguration,'worker-config');
  for(const r of d.sourceRecords){
    const original=historical(registry,r,'source'),current=verifiedDocumentSource(registry,r.id,d.missionId);
    check(original.data.hash===current.data.hash&&original.data.raw===current.data.raw&&original.data.receiptHash===current.data.receiptHash,
      'DOCUMENT_FRAME_INTEGRITY','Documentary snapshot changed');
  }
  for(const r of d.artifactRecords){
    const original=historical(registry,r,'artifact'),current=registry.store.get('artifact',r.id);
    check(original.data.missionId===d.missionId&&original.data.payloadHash===sha256(original.data.payload)
      &&current?.data.missionId===d.missionId&&current.data.payloadHash===original.data.payloadHash&&sha256(current.data.payload)===original.data.payloadHash,
    'DOCUMENT_FRAME_INTEGRITY','Input artifact identity changed');
  }
  for(const r of d.effectRecords){
    const original=historical(registry,r,'effect'),current=registry.store.get('effect',r.id);
    check(current&&canonical(current.data.receipt)===canonical(original.data.receipt),'DOCUMENT_FRAME_INTEGRITY','Observed receipt changed');
    registry.verifiedToolReceipt(current.data.receipt);
  }
  for(const r of d.runtimeRecords){
    historical(registry,r,'runtime-observation');
    const o=admitted.data.runtimeObservations?.find(o=>o.id===r.id);
    check(o,'DOCUMENT_FRAME_INTEGRITY','Runtime record was not observed by the original actor');
    registry.runtimeReference({...o,quote:o.quoteText},admitted.data,{current:false});
  }
  const grants=readSourceManifestGrants(registry,{runId,grantIds:d.view.documentSourceGrants.map(g=>g.grant.id)});
  for(const [index,g]of d.view.documentSourceGrants.entries())check(canonical(g)===canonical(grants[index]),
    'DOCUMENT_FRAME_INTEGRITY','Documentary grant changed');
  const selections=readSourceWindowSelections(registry,{runId,selectionIds:d.view.documentSourceViews.map(v=>v.selection.id)});
  for(const [index,v]of d.view.documentSourceViews.entries())check(canonical(v)===canonical(selections[index]),
    'DOCUMENT_FRAME_INTEGRITY','Selected documentary window changed');
  windowLimits(d.view.documentSourceViews);
  check(canonical(catalog(d.view))===canonical(d.view.documentEvidenceCatalog),'DOCUMENT_FRAME_INTEGRITY','Documentary field catalogue changed');
  const frameSequence=registry.committedSequence(TYPE,frameId,1);
  for(const r of [d.runRecord,d.missionRecord,...d.sourceRecords,...d.artifactRecords,...d.effectRecords,...d.runtimeRecords,
    ...(d.workerConfiguration?[d.workerConfiguration]:[]),...d.view.documentSourceGrants.map(g=>g.grant),...d.view.documentSourceViews.map(v=>v.selection)])
    check(registry.committedSequence(r.type,r.id,r.version)<frameSequence,'DOCUMENT_FRAME_INTEGRITY','Documentary frame precedes an actual prerequisite');
  const input=inputFor(record);
  check(Buffer.byteLength(JSON.stringify(input))<=MAX_BYTES,'CONTEXT_LIMIT','Stored documentary input exceeds its complete bound');
  return {record,binding:d,input,frameSequence};
}
export function readDocumentContextFrame(registry,frameId,{runId}){return snapshot(registry,()=>readFrame(registry,frameId,runId).input);}

function completedFrame(registry,{runId,requestHash,frameId}){
  digest(requestHash);const frame=readFrame(registry,frameId,runId),run=documentSourceActor(registry,runId).data;
  const receipts=(run.inferenceReceipts??[]).filter(r=>r.contextHash===requestHash);
  check(run.requests?.some(r=>r.requestHash===requestHash)&&receipts.length===1&&['completed','COMPLETED'].includes(receipts[0].status),
    'DOCUMENT_FRAME_UNOBSERVED','No unique completed inference of this actor binds the frame');
  const retained=registry.store.get('inference-request','inference-request:'+sha256([runId,requestHash]));
  check(retained?.version===1&&retained.data.schema==='sovereign.inference-request.v1'&&retained.data.retention==='BEFORE_DISPATCH'
    &&retained.data.runId===runId&&retained.data.missionId===run.missionId&&retained.data.requestHash===requestHash,
  'DOCUMENT_FRAME_REQUEST','Exact prospective request retention required');
  let request,input;try{request=JSON.parse(retained.data.requestJson);input=readSourceContextView(request.input);}catch{}
  const admitted=historical(registry,frame.binding.runRecord,'run');
  check(request&&inferenceRequestHash(request)===requestHash&&sha256(request.instructions)===admitted.data.context.instructionsHash
    &&input&&canonical(input)===canonical(frame.input),'DOCUMENT_FRAME_REQUEST','Actual request differs from complete prepared input or frozen instructions');
  let firstRequest=null,firstCompletion=null;
  for(let version=registry.store.get('run',runId).version;version>=1;version--){
    const r=registry.store.get('run',runId,version);
    if(r.data.requests?.some(q=>q.requestHash===requestHash))firstRequest=r;
    if(r.data.inferenceReceipts?.some(q=>q.contextHash===requestHash))firstCompletion=r;
  }
  const dispatchSequence=firstRequest&&registry.committedSequence('run',runId,firstRequest.version),
    retainedSequence=registry.committedSequence(retained.type,retained.id,retained.version),
    completedSequence=firstCompletion&&registry.committedSequence('run',runId,firstCompletion.version);
  check(frame.frameSequence<dispatchSequence&&dispatchSequence<retainedSequence&&retainedSequence<completedSequence,
    'DOCUMENT_FRAME_REQUEST','Frame, dispatch, retention and completion were not committed in order');
  check(registry.exposureHash(firstRequest.data)===registry.exposureHash(admitted.data)
    &&registry.exposureHash(firstCompletion.data)===registry.exposureHash(admitted.data),
  'DOCUMENT_FRAME_REQUEST','Actor evidence changed between preparation, dispatch and completion');
  const receipt=receipts[0];
  return {...frame,exposure:{schema:'sovereign.completed-document-context.v1',runId,missionId:run.missionId,requestHash,
    frameRecord:ref(frame.record),requestRecord:ref(retained),inputHash:sha256(input),
    chronology:{frameSequence:frame.frameSequence,dispatchSequence,retainedSequence,completedSequence},
    inference:{threadId:receipt.threadId,turnId:receipt.turnId,simulation:receipt.simulation??null,receiptHash:sha256(receipt)},
    scope:'Exact complete projected input of one completed scoped inference; not semantic support, full-raw reading, current external state, independent review or material acceptance. Synthetic/null inference provenance is not live qualification.'}};
}
export function documentContextRequestEvidence(registry,options){
  canonical(options);keys(options,['runId','requestHash','frameId']);
  return snapshot(registry,()=>completedFrame(registry,options).exposure);
}
/** Consumer chooses the original key and exact quote. No quote/hash repair,
 * implicit raw lookup, old catalogue conversion or semantic acceptance. */
export function documentContextQuoteEvidence(registry,options){
  canonical(options);keys(options,['runId','requestHash','frameId','sourceKey','quote']);
  const {runId,requestHash,frameId,sourceKey,quote}=options;identifier(sourceKey);string(quote,'document quote',{max:20000});
  check(quote.isWellFormed(),'DOCUMENT_FRAME_QUOTE','Document quote must preserve whole Unicode scalars');
  return snapshot(registry,()=>{
    const frame=completedFrame(registry,{runId,requestHash,frameId}),target=targets(frame.binding.view).find(t=>t.sourceKey===sourceKey);
    check(target&&target.text.includes(quote),'DOCUMENT_FRAME_QUOTE','Quote is outside the exact typed field observed in this frame');
    const {text,...identity}=target;
    const sourceEvidence=target.kind==='source-window'?sourceWindowRequestEvidence(registry,{runId,requestHash,selectionId:target.id,windowHash:target.hash,quote}):null;
    return {schema:'sovereign.document-context-quote.v1',exposure:frame.exposure,target:identity,quote,
      ...(sourceEvidence?{sourceEvidence}:{}),
      scope:target.kind==='source-window'?'Exact raw bytes in one observed actor-bound window; still not semantic entailment, completeness or acceptance.'
        :'Exact observed typed-field substring only. Acquisition metadata is not raw-content evidence; an embedded receipt or inherited observation is not this actor action. No acceptance verdict.'};
  });
}

/** Validate multiple typed quotes from ONE exact completed input in ONE read
 * snapshot. Reuse only the freshly authenticated frame within this synchronous
 * call, never authority across calls, actors, frames or commits. Every source
 * quote retains its separate source-window/completion/chronology proof. This
 * changes local verification work, not what was exposed or what is accepted. */
export function documentContextQuoteEvidenceBatch(registry,options){return quoteBatch(registry,options,false);}

/** Trusted material consumers may need the exact prepared input as well as
 * proofs. Return both from one completed-frame check, including for zero quotes.
 * This is not a model tool, partial-frame view, extra exposure or authority
 * cache. The original quote-batch API keeps its exact output shape. */
export function documentContextMaterialEvidence(registry,options){return quoteBatch(registry,options,true);}

// Only quoteBatch supplies this freshly completed private frame. readFrame has
// already revalidated every selection/grant, and completedFrame binds the EXACT
// retained input and first dispatch/completion. Repeating the generic unframed
// reader would repeat those checks. Keep its proof schema, literal verifier and
// current-source check; the scalar API remains an independent validation path.
function sourceProofFromFrame(registry,frame,{selectionId,windowHash,quote},sources){
  const views=frame.input.documentSourceViews.filter(v=>v.selection.id===selectionId);
  check(views.length===1,'SOURCE_WINDOW_UNOBSERVED','Actual request did not contain this exact actor-bound literal view');
  const view=views[0],e=frame.exposure;
  if(!sources.has(view.source.id))sources.set(view.source.id,verifiedDocumentSource(registry,view.source.id,e.missionId).data);
  const source=sources.get(view.source.id),window=view.windows.find(w=>sha256(w)===windowHash);
  check(window&&sourceWindowContainsQuote(source,window,quote),'SOURCE_WINDOW_UNOBSERVED','Quote was not observed inside this exact single window');
  const selectionSequence=registry.committedSequence(view.selection.type,selectionId,1),
    {dispatchSequence,retainedSequence,completedSequence}=e.chronology;
  check(selectionSequence<dispatchSequence&&dispatchSequence<retainedSequence&&retainedSequence<completedSequence,
    'SOURCE_WINDOW_REQUEST','Selection, dispatch, retention and completion were not committed in order');
  const startByte=window.startByte+Buffer.byteLength(window.text.slice(0,window.text.indexOf(quote)));
  return {schema:'sovereign.source-window-request-evidence.v1',runId:e.runId,missionId:e.missionId,requestHash:e.requestHash,
    selection:clone(view.selection),requestRecord:clone(e.requestRecord),sourceId:source.id,sourceHash:source.hash,windowHash,
    quote:{text:quote,startByte,endByte:startByte+Buffer.byteLength(quote)},inference:clone(e.inference),
    chronology:{selectionSequence,dispatchSequence,retainedSequence,completedSequence},
    scope:'Exact bytes in one completed actor-scoped request, not semantic support, full-document reading, independent review, absence of other exposure or artifact acceptance. Revalidated in one SQLite snapshot; consumers must recheck at point of use. Simulation/null is not a real-model qualification.'};
}

function quoteBatch(registry,options,includeInput){
  canonical(options);keys(options,['runId','requestHash','frameId','quotes']);
  const {runId,requestHash,frameId,quotes}=options;
  // Material validation can bind up to 10k review and 10k factual selectors.
  list(quotes,'document quote batch',{max:20000});
  for(const q of quotes){
    keys(q,['sourceKey','quote']);identifier(q.sourceKey);string(q.quote,'document quote',{max:20000});
    check(q.quote.isWellFormed(),'DOCUMENT_FRAME_QUOTE','Document quote must preserve whole Unicode scalars');
  }
  return snapshot(registry,()=>{
    const frame=completedFrame(registry,{runId,requestHash,frameId}),fields=new Map(targets(frame.binding.view).map(t=>[t.sourceKey,t]));
    const selected=quotes.map(({sourceKey,quote})=>{
      const target=fields.get(sourceKey);
      check(target&&target.text.includes(quote),'DOCUMENT_FRAME_QUOTE','Quote is outside the exact typed field observed in this frame');
      return {target,quote};
    });
    const sourceQuotes=selected.filter(q=>q.target.kind==='source-window').map(({target,quote})=>({selectionId:target.id,windowHash:target.hash,quote}));
    const sources=new Map(),sourceProofs=sourceQuotes.map(q=>sourceProofFromFrame(registry,frame,q,sources));
    let sourceIndex=0;
    const proofs=selected.map(({target,quote})=>{
      const {text,...identity}=target;
      const sourceEvidence=target.kind==='source-window'?sourceProofs[sourceIndex++]:null;
      return {schema:'sovereign.document-context-quote.v1',exposure:clone(frame.exposure),target:identity,quote,
        ...(sourceEvidence?{sourceEvidence}:{}),
        scope:target.kind==='source-window'?'Exact raw bytes in one observed actor-bound window; still not semantic entailment, completeness or acceptance.'
          :'Exact observed typed-field substring only. Acquisition metadata is not raw-content evidence; an embedded receipt or inherited observation is not this actor action. No acceptance verdict.'};
    });
    return {exposure:clone(frame.exposure),quotes:proofs,...(includeInput?{input:clone(frame.input)}:{})};
  });
}
