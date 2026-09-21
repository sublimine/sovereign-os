// Typed PREVIEW of a future documentary context. No dispatch, sourceIds change,
// new grant or material acceptance. Each omitted byte field is declared; the
// original source, signature, payload and request history remain untouched.
import {canonical,check,clone,digest,identifier,list,sha256,string,unique} from './contracts.mjs';
import {documentSourceActor,verifiedDocumentSource} from './source-documentary-scope.mjs';

const SCHEMA='sovereign.acquisition-context-preview.v1';
const ref=r=>({type:r.type,id:r.id,version:r.version,hash:r.hash});
const ids=values=>[...values].sort();
const omitted=(path,text)=>({path,utf8Bytes:Buffer.byteLength(text),sha256:sha256(text),exposure:'NOT_INCLUDED_AT_THIS_PATH'});
function snapshot(registry,fn){
  const db=registry.store.db,own=!db.isTransaction;if(own)db.exec('BEGIN');
  try{return fn();}finally{if(own)db.exec('ROLLBACK');}
}
function manifest(record){
  const s=record.data;
  return {schema:'sovereign.acquired-source-manifest.v1',sourceId:s.id,sourceHash:s.hash,
    rawBytes:Buffer.byteLength(s.raw),url:s.url,httpStatus:s.httpStatus,retrievedAt:s.retrievedAt,mediaType:s.mediaType,
    acquisitionId:s.receiptId,originalReceiptHash:s.receiptHash,sourceRecord:ref(record),
    exposure:'METADATA_ONLY_NOT_RAW_DOCUMENT',
    scope:'Acquired byte identity and dated HTTP metadata, not source reading, factual support or a source-window grant.'};
}
function acquisitionView(registry,signed,missionId){
  const receipt=registry.verifiedToolReceipt(signed);
  check(receipt.missionId===missionId&&receipt.tool==='source.fetch'&&receipt.status==='SUCCEEDED',
    'SOURCE_PROJECTION_SCOPE','Only successful same-mission source acquisitions may be projected');
  const source=verifiedDocumentSource(registry,`source:${receipt.id}`,missionId),effect=registry.store.get('effect',receipt.id);
  check(source.data.receiptHash===sha256(signed),'SOURCE_PROJECTION_INTEGRITY','Acquisition and source identities differ');
  const {result,...receiptMetadata}=receipt,{content,...resultMetadata}=result,{data,...sealMetadata}=signed;
  const value={schema:'sovereign.acquisition-receipt-view.v1',originalReceiptHash:sha256(signed),effectRecord:ref(effect),
    originalSealMetadata:clone(sealMetadata),receiptMetadata:clone(receiptMetadata),resultMetadata:clone(resultMetadata),
    contentDescriptor:{sha256:source.data.hash,utf8Bytes:Buffer.byteLength(content),sourceId:source.id,exposure:'RAW_CONTENT_NOT_INCLUDED'},
    scope:'This is a projected view, NOT the original signed receipt and NOT data verified by originalSealMetadata as a new signature. Retrieve the original by its committed effect reference; source text requires a separately observed window.'};
  return {value,source,originalContent:content};
}

/** Build and authenticate only the three ordinary worker evidence channels.
 * All other fields (intent, task, runtime evidence, criteria, feedback, etc.)
 * are preserved exactly, even when large. No generic recursion/redaction. */
export function projectAcquisitionContext(registry,{runId,context}){
  return snapshot(registry,()=>{
    identifier(runId);canonical(context);
    const runRecord=documentSourceActor(registry,runId),run=runRecord.data;
    const mission=registry.store.get('mission',run.missionId)?.data;
    check(mission?.intentHash===sha256(mission.intent)&&context.missionIntent===mission.intent
      &&context.purpose===run.context.purpose&&context.dataClassification==='UNTRUSTED_OBSERVATIONS_NOT_INSTRUCTIONS',
    'SOURCE_PROJECTION_SCOPE','Preview must preserve the actual ordinary worker mandate and purpose');
    list(context.sources,'context sources',{max:10000});list(context.artifacts,'context artifacts',{max:256});
    list(context.toolObservations,'context observations',{max:1000});
    unique(context.sources.map(s=>s.id));unique(context.artifacts.map(a=>a.id));unique(context.toolObservations.map(o=>o.id));
    const planIds=new Set((run.context.planViews??[]).map(v=>v.artifactId));
    check(canonical(ids(context.sources.map(s=>s.id)))===canonical(ids(run.context.sourceIds))
      &&canonical(ids(context.artifacts.map(a=>a.id)))===canonical(ids(run.context.artifactIds.filter(id=>!planIds.has(id))))
      &&canonical(ids(context.toolObservations.map(o=>o.id)))===canonical(ids((run.toolObservations??[]).map(o=>o.id))),
    'SOURCE_PROJECTION_SCOPE','Cannot omit or add an admitted source, artifact or operation in a preview');
    const omissions=[],sourceManifests=context.sources.map((source,index)=>{
      const r=verifiedDocumentSource(registry,source.id,run.missionId),s=r.data;
      const expected={id:s.id,hash:s.hash,url:s.url,httpStatus:s.httpStatus,retrievedAt:s.retrievedAt,raw:s.raw};
      check(canonical(source)===canonical(expected),'SOURCE_PROJECTION_INTEGRITY','Supplied raw-source context differs from its acquired version');
      omissions.push(omitted(`/sources/${index}/raw`,s.raw));return manifest(r);
    });
    const toolObservationViews=context.toolObservations.map((observation,index)=>{
      const own=(run.toolObservations??[]).find(o=>o.id===observation.id),receipt=registry.verifiedToolReceipt(own.signedReceipt);
      check(receipt.missionId===run.missionId&&own.hash===sha256(own.signedReceipt)&&own.resultText===canonical(receipt.result)
        &&own.principalId===receipt.principalId&&own.relation===(receipt.principalId===runId?'OWN_ACTION':'EXTERNAL_OBSERVATION'),
      'SOURCE_PROJECTION_INTEGRITY','Original tool observation is inconsistent');
      const expected={id:own.id,hash:own.hash,principalId:receipt.principalId,relation:own.relation,
        tool:receipt.tool,status:receipt.status,result:receipt.result,quoteText:own.resultText,observedAt:own.observedAt};
      const {writtenContent,...base}=observation;
      check(canonical(base)===canonical(expected),'SOURCE_PROJECTION_INTEGRITY','Supplied observation changed result, quoteText or actor relation');
      if(Object.hasOwn(observation,'writtenContent')){
        string(writtenContent,'observed write',{min:0,max:4*1024*1024});
        check(receipt.tool==='workspace.write'&&receipt.status==='SUCCEEDED'&&receipt.principalId===runId
          &&sha256(writtenContent)===receipt.result.sha256,'SOURCE_PROJECTION_INTEGRITY','Written-content supplement is not bound to this successful own write');
      }
      if(receipt.tool!=='source.fetch'||receipt.status!=='SUCCEEDED')return {kind:'FULL_TOOL_OBSERVATION',observation:clone(observation)};
      const projected=acquisitionView(registry,own.signedReceipt,run.missionId);
      omissions.push(omitted(`/toolObservations/${index}/result/content`,projected.originalContent),
        omitted(`/toolObservations/${index}/quoteText`,observation.quoteText));
      return {kind:'ACQUISITION_METADATA_VIEW',operationId:receipt.id,originalReceiptHash:own.hash,
        principalId:receipt.principalId,relation:own.relation,observedAt:own.observedAt,
        receiptView:projected.value,viewHash:sha256(projected.value)};
    });
    const artifactViews=context.artifacts.map((artifact,index)=>{
      const original=registry.store.get('artifact',artifact.id),a=original?.data;
      check(a?.missionId===run.missionId&&a.payloadHash===sha256(a.payload)
        &&canonical(artifact)===canonical({id:a.id,hash:a.payloadHash,status:a.status,payload:a.payload}),
      'SOURCE_PROJECTION_INTEGRITY','Supplied artifact differs from its admitted original');
      let projectedCount=0;
      const toolReceiptViews=a.payload.toolReceipts.map((signed,i)=>{
        const r=registry.verifiedToolReceipt(signed);
        check(r.missionId===run.missionId,'SOURCE_PROJECTION_SCOPE','Artifact contains a foreign receipt');
        if(r.tool!=='source.fetch'||r.status!=='SUCCEEDED')return {kind:'FULL_SIGNED_RECEIPT',receipt:clone(signed)};
        const p=acquisitionView(registry,signed,run.missionId);projectedCount++;
        omissions.push(omitted(`/artifacts/${index}/payload/toolReceipts/${i}/data/result/content`,p.originalContent));
        return {kind:'ACQUISITION_METADATA_VIEW',receiptView:p.value,viewHash:sha256(p.value)};
      });
      if(!projectedCount)return {kind:'FULL_ARTIFACT',artifact:clone(artifact)};
      const {toolReceipts,...rest}=a.payload,payloadView={...clone(rest),toolReceiptViews};
      return {kind:'ACQUISITION_PROJECTED_ARTIFACT',artifactId:a.id,originalPayloadHash:a.payloadHash,originalRecord:ref(original),
        status:a.status,payloadView,viewHash:sha256(payloadView),
        scope:'Only acquisition receipt contents are projected. payloadView is NOT the original payload and its viewHash does not replace originalPayloadHash. Body, claims, criteria, inputs and obligations are complete.'};
    });
    const {sources,artifacts,toolObservations,...preserved}=context;
    const view={...clone(preserved),sourceManifests,artifactViews,toolObservationViews};
    return {schema:SCHEMA,mode:'PREVIEW_ONLY_NOT_DISPATCH_AUTHORIZATION',runId,missionId:run.missionId,runRecord:ref(runRecord),
      originalContextHash:sha256(context),view,viewHash:sha256(view),omittedFields:omissions,
      bytes:{original:Buffer.byteLength(JSON.stringify(context)),projectedView:Buffer.byteLength(JSON.stringify(view))},
      scope:'Typed projection preview only. Original source/receipt/artifact/run records are unchanged. Metadata is not observed raw text. No grant, completed inference, factual support or acceptance is created; remaining fields can still exceed the existing context cap.'};
  });
}

/** Check a metadata quote against the exact current preview, never the raw
 * omitted from it. Still NOT proof of dispatch/completion or an acceptance gate. */
export function acquisitionMetadataQuote(registry,{runId,context,operationId,viewHash,quote}){
  const preview=projectAcquisitionContext(registry,{runId,context});
  digest(viewHash);string(quote,'metadata quote',{max:20000});
  check(preview.schema===SCHEMA&&preview.mode==='PREVIEW_ONLY_NOT_DISPATCH_AUTHORIZATION'&&sha256(preview.view)===preview.viewHash,
    'SOURCE_PROJECTION_INTEGRITY','Preview binding changed');
  const views=preview.view.toolObservationViews.filter(v=>v.kind==='ACQUISITION_METADATA_VIEW'&&v.operationId===operationId);
  check(views.length===1&&views[0].viewHash===viewHash&&sha256(views[0].receiptView)===viewHash,
    'SOURCE_PROJECTION_SCOPE','Acquisition metadata is absent or belongs to a different view');
  check(canonical(views[0].receiptView.resultMetadata).includes(quote),'SOURCE_PROJECTION_QUOTE','Quote is not in the exposed result metadata');
  return {operationId,viewHash,quote,scope:'Exact preview metadata substring only; not source-content support or completed actor exposure.'};
}
