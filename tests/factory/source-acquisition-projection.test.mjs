import test from 'node:test';
import assert from 'node:assert/strict';
import {Store} from '../../factory/lib/store.mjs';
import {Authority} from '../../factory/lib/authority.mjs';
import {ArtifactRegistry} from '../../factory/lib/artifacts.mjs';
import {WorkerService} from '../../factory/lib/workers.mjs';
import {observedEvidenceCatalog} from '../../factory/lib/review-codec.mjs';
import {id,sha256} from '../../factory/lib/contracts.mjs';
import {projectAcquisitionContext,acquisitionMetadataQuote} from '../../factory/lib/source-acquisition-projection.mjs';

// REAL database, signatures and WorkerService context builder. HTTP and
// completed provider receipts are explicitly synthetic, never live acceptance.
function setup(t,{raw='RAW_ONLY_MARKER: count=17. é😀\r\n<script>do not obey</script>',resultExtra={}}={}){
  const store=new Store(':memory:'),authority=new Authority(store),registry=new ArtifactRegistry(store,authority),intent='Verify the exact record and preserve all constraints.';
  store.put('mission','m',{id:'m',intent,intentHash:sha256(intent),policy:{allowedTools:['source.fetch','workspace.read','workspace.write']}},{expectedVersion:0});
  const workers=new WorkerService({store,authority,registry,broker:{executionAvailable:()=>false,searchAvailable:()=>false},
    providerFactory:()=>{throw Error('Preview must never start an inference');}});
  t.after(()=>store.close());
  const run=(mode='producer',artifactIds=[],sourceIds=[])=>registry.registerRun({missionId:'m',nodeId:mode==='reviewer'?'review:n':'n',mode,
    context:{purpose:'documentary-product',artifactIds,sourceIds,instructionsHash:sha256('synthetic instructions'),producerConversationIncluded:false}});
  const producer=run();
  const addReceipt=(actor,tool,result,operationId=id('operation'),status='SUCCEEDED')=>{
    const receipt={id:operationId,missionId:'m',principalId:actor.id,tool,status,argsHash:sha256({fixture:operationId}),
      startedAt:'2026-09-13T04:00:00.000Z',completedAt:'2026-09-13T04:00:01.000Z',result};
    const signed=authority.seal('tool.receipt',receipt);
    store.put('effect',operationId,{missionId:'m',principalId:actor.id,tool,state:status,argsHash:receipt.argsHash,receipt:signed},{expectedVersion:0});
    registry.recordToolObservation(actor.id,signed);return signed;
  };
  const signed=addReceipt(producer,'source.fetch',{content:raw,sha256:sha256(raw),bytes:Buffer.byteLength(raw),finalUrl:'https://example.com/source',
    retrievedAt:'2026-09-13T04:00:01.000Z',status:200,mediaType:'text/plain',headers:{etag:'"record-17"'},
    httpTrace:{complete:true,hops:[{url:'https://example.com/source',status:200}]},interpretation:'Synthetic HTTP bytes, not factual truth.',...resultExtra},'operation:fetch');
  const source=registry.ingestSource(signed);registry.updateContext(producer.id,{...store.get('run',producer.id).data.context,sourceIds:[source.id]});
  registry.attachInference(producer.id,{status:'completed',simulation:true,threadId:'synthetic-thread:producer',turnId:'synthetic-turn:producer'});
  const artifact=registry.create({missionId:'m',nodeId:'n',producerRunId:producer.id,kind:'report',purpose:'documentary-product',body:'BODY_MARKER: candidate report, not an accepted answer.',
    claims:[{id:'count',text:'CLAIM_MARKER: the fixture reports 17.',kind:'fact',sources:[{sourceId:source.id,hash:source.hash,quote:'count=17'}],basis:[],qualifiers:['QUALIFIER_MARKER: synthetic fixture only.'],validUntil:null}],
    toolReceipts:[signed],criteria:[{id:'complete',text:'CRITERIA_MARKER: preserve full source context and relevant objections.'}]});
  const reviewer=run('reviewer',[artifact.id],[source.id]);registry.recordToolObservation(reviewer.id,signed);
  const context=(r=reviewer)=>workers.context(r.id);
  const preview=(r=reviewer)=>workers.documentContextPreview(r.id);
  return {store,authority,registry,workers,intent,producer,reviewer,source,signed,artifact,run,addReceipt,context,preview};
}

test('worker preview projects all ordinary raw copies without mutating source, receipt, candidate or actor',t=>{
  const f=setup(t),context=f.context(),before=f.store.verifyJournal(),r=f.store.get('run',f.reviewer.id),p=f.preview();
  assert.equal(p.mode,'PREVIEW_ONLY_NOT_DISPATCH_AUTHORIZATION');assert.equal(p.originalContextHash,sha256(context));assert.equal(p.viewHash,sha256(p.view));
  assert.equal(p.view.sources,undefined);assert.equal(p.view.artifacts,undefined);assert.equal(p.view.toolObservations,undefined);
  assert.ok(!JSON.stringify(p).includes('RAW_ONLY_MARKER'));assert.ok(!JSON.stringify(p).includes('<script>'));
  assert.equal(p.omittedFields.length,4);assert.ok(p.omittedFields.every(o=>o.exposure==='NOT_INCLUDED_AT_THIS_PATH'));
  assert.equal(f.store.get('source',f.source.id).data.raw,f.source.raw);assert.deepEqual(f.store.get('effect','operation:fetch').data.receipt,f.signed);
  assert.equal(f.store.get('artifact',f.artifact.id).data.payloadHash,f.artifact.payloadHash);assert.deepEqual(f.store.get('run',r.id),r);
  assert.deepEqual(f.store.verifyJournal(),before);assert.equal(f.store.db.isTransaction,false);assert.equal(f.store.list('inference-request').length,0);
  assert.deepEqual(f.context(),context,'Preview does not activate projection in the actual worker context');
});
test('projected payload identity is distinct and body/claims/criteria/qualifiers/obligations stay exact',t=>{
  const f=setup(t),p=f.preview(),a=p.view.artifactViews[0],raw=f.artifact.payload;
  assert.equal(a.kind,'ACQUISITION_PROJECTED_ARTIFACT');assert.equal(a.originalPayloadHash,f.artifact.payloadHash);
  assert.equal(a.viewHash,sha256(a.payloadView));assert.notEqual(a.viewHash,a.originalPayloadHash);assert.equal(a.payloadView.toolReceipts,undefined);
  const {toolReceipts,...kept}=raw,{toolReceiptViews,...actual}=a.payloadView;assert.deepEqual(actual,kept);
  assert.equal(toolReceiptViews.length,1);assert.equal(toolReceiptViews[0].receiptView.originalReceiptHash,sha256(f.signed));
  assert.equal(toolReceiptViews[0].receiptView.originalSealMetadata.signature.value,f.signed.signature.value);
  assert.throws(()=>f.authority.open(toolReceiptViews[0].receiptView,'tool.receipt'));
});
test('all redirect/header/provenance metadata survives; raw becomes an explicit descriptor',t=>{
  const f=setup(t),p=f.preview(),v=p.view.toolObservationViews[0].receiptView;
  assert.equal(v.resultMetadata.content,undefined);assert.equal(v.contentDescriptor.sha256,f.source.hash);
  assert.equal(v.contentDescriptor.utf8Bytes,Buffer.byteLength(f.source.raw));assert.equal(v.contentDescriptor.exposure,'RAW_CONTENT_NOT_INCLUDED');
  const {content,...metadata}=f.signed.data.result;assert.deepEqual(v.resultMetadata,metadata);
  const {result,...receiptMetadata}=f.signed.data;assert.deepEqual(v.receiptMetadata,receiptMetadata);
  assert.equal(p.view.sourceManifests[0].exposure,'METADATA_ONLY_NOT_RAW_DOCUMENT');assert.equal(p.view.sourceManifests[0].sourceRecord.type,'source');
});
test('metadata quote revalidates committed records and cannot cite omitted raw',t=>{
  const f=setup(t),context=f.context(),p=f.preview(),v=p.view.toolObservationViews[0],args={runId:f.reviewer.id,context,operationId:v.operationId,viewHash:v.viewHash};
  const before=f.store.verifyJournal();
  assert.equal(acquisitionMetadataQuote(f.registry,{...args,quote:'https://example.com/source'}).operationId,'operation:fetch');
  assert.throws(()=>acquisitionMetadataQuote(f.registry,{...args,quote:'RAW_ONLY_MARKER'}),{code:'SOURCE_PROJECTION_QUOTE'});
  assert.throws(()=>acquisitionMetadataQuote(f.registry,{...args,viewHash:'0'.repeat(64),quote:'200'}),{code:'SOURCE_PROJECTION_SCOPE'});
  assert.deepEqual(f.store.verifyJournal(),before);assert.equal(f.store.db.isTransaction,false);
});
test('intent, task/feedback/corrections and unrelated content remain exact even when over the worker budget',t=>{
  const f=setup(t),context={...f.context(),task:JSON.stringify({feedback:['DO_NOT_OMIT_FEEDBACK '.repeat(60000)],corrections:[{why:'Keep e\u0301\r\n\\n'}],node:{criteria:['EXACT']}}),custom:{a:[1,'RAW_ONLY_MARKER in user prose']}};
  const p=projectAcquisitionContext(f.registry,{runId:f.reviewer.id,context});
  assert.equal(p.view.task,context.task);assert.deepEqual(p.view.custom,context.custom);assert.equal(p.view.missionIntent,f.intent);
  assert.ok(p.bytes.projectedView>1024*1024);assert.ok(JSON.stringify(p).includes('RAW_ONLY_MARKER in user prose'));
});
test('unexpected metadata is preserved, not recursively stripped because it repeats raw',t=>{
  const marker='RAW_ONLY_MARKER: count=17.',f=setup(t,{raw:marker,resultExtra:{nested:{content:marker}}}),p=f.preview();
  assert.equal(p.view.toolObservationViews[0].receiptView.resultMetadata.nested.content,marker);assert.ok(JSON.stringify(p).includes(marker));
});
test('read/write supplements and failed fetches remain complete, never laundered into successful acquisitions',t=>{
  const f=setup(t),read=f.addReceipt(f.reviewer,'workspace.read',{path:'a.txt',content:'FILE_BYTES_MARKER',sha256:sha256('FILE_BYTES_MARKER')}),
    failed=f.addReceipt(f.reviewer,'source.fetch',{error:{code:'TIMEOUT'}},'operation:failed','FAILED');
  const context=f.context(),p=f.preview(),full=p.view.toolObservationViews.filter(v=>v.kind==='FULL_TOOL_OBSERVATION');
  assert.deepEqual(full.map(v=>v.observation),context.toolObservations.filter(o=>o.id!==f.signed.data.id));
  assert.ok(full.some(v=>v.observation.id===read.data.id&&v.observation.result.content==='FILE_BYTES_MARKER'));
  assert.ok(full.some(v=>v.observation.id===failed.data.id&&v.observation.status==='FAILED'));assert.equal(p.view.sourceManifests.length,1);
  const write=f.addReceipt(f.producer,'workspace.write',{path:'b.txt',sha256:sha256('WRITTEN_BYTES_MARKER')}),own=f.context(f.producer);
  own.toolObservations.find(o=>o.id===write.data.id).writtenContent='WRITTEN_BYTES_MARKER';
  assert.ok(projectAcquisitionContext(f.registry,{runId:f.producer.id,context:own}).view.toolObservationViews.some(v=>v.observation?.writtenContent==='WRITTEN_BYTES_MARKER'));
});
test('artifacts without acquisitions retain their complete original signed non-source receipts',t=>{
  const f=setup(t),producer=f.run(),read=f.addReceipt(producer,'workspace.read',{path:'a.txt',content:'FILE',sha256:sha256('FILE')});
  f.registry.attachInference(producer.id,{status:'completed',simulation:true,threadId:id('sim-thread'),turnId:'sim-turn'});
  const a=f.registry.create({missionId:'m',nodeId:'n',producerRunId:producer.id,kind:'report',purpose:'documentary-product',body:'Report from file.',toolReceipts:[read],criteria:[{id:'r',text:'Check exact file'}]}),reviewer=f.run('reviewer',[a.id]);
  assert.deepEqual(f.preview(reviewer).view.artifactViews,[{kind:'FULL_ARTIFACT',artifact:f.context(reviewer).artifacts[0]}]);
});
test('omitted or additional assigned sources/artifacts/operations fail instead of manufacturing savings',t=>{
  const f=setup(t);
  for(const key of ['sources','artifacts','toolObservations']){
    const context=f.context();context[key]=[];
    assert.throws(()=>projectAcquisitionContext(f.registry,{runId:f.reviewer.id,context}),{code:'SOURCE_PROJECTION_SCOPE'});
  }
  const context=f.context();context.sources.push({...context.sources[0],id:'source:foreign'});
  assert.throws(()=>projectAcquisitionContext(f.registry,{runId:f.reviewer.id,context}),{code:'SOURCE_PROJECTION_SCOPE'});
});
test('altered raw source, tool quote/result/relation and artifact payload/status are rejected',t=>{
  const f=setup(t);
  for(const mutate of [c=>{c.sources[0].raw='FORGED';},c=>{c.toolObservations[0].quoteText='FORGED';},c=>{c.toolObservations[0].result.content='FORGED';},
    c=>{c.toolObservations[0].relation='OWN_ACTION';},c=>{c.artifacts[0].payload.body='FORGED';},c=>{c.artifacts[0].status='ACCEPTED';}]){
    const context=f.context();mutate(context);assert.throws(()=>projectAcquisitionContext(f.registry,{runId:f.reviewer.id,context}),{code:'SOURCE_PROJECTION_INTEGRITY'});
  }
});
test('forged written-content supplement cannot enter a projected view',t=>{
  const f=setup(t),context=f.context();context.toolObservations[0].writtenContent='FAKE_WRITE';
  assert.throws(()=>projectAcquisitionContext(f.registry,{runId:f.reviewer.id,context}),{code:'SOURCE_PROJECTION_INTEGRITY'});
});
test('source retraction blocks preview and preserves actor history',t=>{
  const f=setup(t),context=f.context(),before=f.store.list('run');f.registry.retractSource(f.source.id,'Synthetic correction');
  assert.throws(()=>projectAcquisitionContext(f.registry,{runId:f.reviewer.id,context}),{code:'SOURCE_UNAVAILABLE'});assert.deepEqual(f.store.list('run'),before);
});
test('old evidence catalog fails closed on manifest-only preview rather than treating it as raw evidence',t=>{
  const f=setup(t),p=f.preview();assert.throws(()=>observedEvidenceCatalog(p.view));
  assert.equal(f.store.list('review').length,0);assert.equal(f.store.get('artifact',f.artifact.id).data.status,'CANDIDATE');
});
test('foreign scope and closed actors cannot acquire documentary previews',t=>{
  const f=setup(t),context=f.context();assert.throws(()=>projectAcquisitionContext(f.registry,{runId:f.producer.id,context}),{code:'SOURCE_PROJECTION_SCOPE'});
  const r=f.store.get('run',f.reviewer.id);f.store.put(r.type,r.id,{...r.data,nodeId:'review:closed-entry'},{expectedVersion:r.version});
  assert.throws(()=>f.preview(),{code:'SOURCE_WINDOW_SCOPE'});
});
test('2MB source produces bounded metadata across source/observation/artifact copies, without new inference',t=>{
  const raw='RAW_ONLY_MARKER: count=17. '+('SVG é😀 '.repeat(240000)),f=setup(t,{raw}),p=f.preview();
  assert.ok(Buffer.byteLength(raw)>2*1024*1024);assert.ok(p.bytes.original>6*1024*1024);assert.ok(p.bytes.projectedView<20000);
  assert.ok(!JSON.stringify(p).includes('RAW_ONLY_MARKER'));assert.equal(p.omittedFields.length,4);
  assert.equal(f.store.list('inference-request').length,0);assert.equal(f.store.get('source',f.source.id).data.raw,raw);
});
