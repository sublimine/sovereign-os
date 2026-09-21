import test from 'node:test';
import assert from 'node:assert/strict';
import {Store} from '../../factory/lib/store.mjs';
import {Authority} from '../../factory/lib/authority.mjs';
import {ArtifactRegistry} from '../../factory/lib/artifacts.mjs';
import {WorkerService} from '../../factory/lib/workers.mjs';
import {canonical,id,sha256} from '../../factory/lib/contracts.mjs';
import {prepareSourceManifestGrant,revokeSourceManifestGrant} from '../../factory/lib/source-manifest-grants.mjs';
import {prepareSourceWindowSelection} from '../../factory/lib/source-window-evidence.mjs';
import {prepareDocumentContextFrame,readDocumentContextFrame,documentContextRequestEvidence,documentContextQuoteEvidence} from '../../factory/lib/document-context-frames.mjs';
import {packJsonContext} from '../../factory/lib/context-json-codec.mjs';
import {packSourceContextView} from '../../factory/lib/source-context-view.mjs';
import {observedEvidenceCatalog} from '../../factory/lib/review-codec.mjs';
import * as frameModule from '../../factory/lib/document-context-frames.mjs';

// Real worker context, SQLite, authority seal and request retention. Acquisition
// and provider completions are synthetic; this is not a live qualification.
function setup(t,{raw='HEAD é😀 count=17.\r\nUNSEEN_RAW_ONLY count=99.'}={}){
  const store=new Store(':memory:'),authority=new Authority(store),registry=new ArtifactRegistry(store,authority);
  t.after(()=>store.close());
  const intent='Check count and relevant counterevidence.',instructions='Observe this exact scoped input.';
  store.put('mission','m',{id:'m',intent,intentHash:sha256(intent),policy:{allowedTools:['source.fetch','workspace.read']}},{expectedVersion:0});
  const workers=new WorkerService({store,authority,registry,broker:{executionAvailable:()=>true,searchAvailable:()=>false},
    providerFactory:()=>{throw Error('Preparation must not call a provider');}});
  const run=(mode='producer',artifactIds=[],sourceIds=[])=>registry.registerRun({missionId:'m',nodeId:mode==='reviewer'?'review:n':'n',mode,
    context:{purpose:'document-product',artifactIds,sourceIds,instructionsHash:sha256(instructions),producerConversationIncluded:false}});
  const producer=run();
  const receipt=(actor,tool,result,operationId=id('operation'),status='SUCCEEDED')=>{
    const data={id:operationId,missionId:'m',principalId:actor.id,tool,status,argsHash:sha256({fixture:operationId}),
      startedAt:'2026-09-13T05:20:00.000Z',completedAt:'2026-09-13T05:20:01.000Z',result},signed=authority.seal('tool.receipt',data);
    store.put('effect',data.id,{missionId:'m',principalId:actor.id,tool,argsHash:data.argsHash,state:status,receipt:signed},{expectedVersion:0});
    registry.recordToolObservation(actor.id,signed);return signed;
  };
  const signed=receipt(producer,'source.fetch',{content:raw,sha256:sha256(raw),url:'https://example.com/record',finalUrl:'https://example.com/record',
    status:200,retrievedAt:'2026-09-13T05:20:01.000Z',mediaType:'text/plain',headers:{etag:'fixture17'},httpTrace:{complete:true,hops:[{url:'https://example.com/record',status:200}]}},'operation:fetch');
  const source=registry.ingestSource(signed);
  const grant=(actor=producer,origin={kind:'observed-acquisition'})=>prepareSourceManifestGrant(registry,{runId:actor.id,sourceId:source.id,origin});
  const select=(g,ranges=[{startByte:0,maxBytes:24}])=>prepareSourceWindowSelection(registry,{runId:g.runId,sourceId:source.id,grantId:g.grant.id,ranges});
  const task=JSON.stringify({criteria:['Verify both support and counterevidence.'],feedback:['Keep the previous failure.'],corrections:['Do not infer full reading from the digest.'],step:1});
  const prepare=(g,views=[],extra={})=>workers.prepareDocumentInput({runId:g.runId,task,grantIds:[g.grant.id],selectionIds:views.map(v=>v.selection.id),...extra});
  const request=(input,encoding='plain')=>({instructions,input:encoding==='json'?packJsonContext(input).input:encoding==='literal'?packSourceContextView(input).input:JSON.stringify(input),schema:{type:'object'}});
  const dispatch=(input,encoding='plain',extra={})=>registry.recordInferenceRequest(input.documentContextFrame?store.get('document-context-frame',input.documentContextFrame.id).data.signed.data.runId:producer.id,{...request(input,encoding),...extra});
  const complete=(actorId,hash)=>registry.attachInference(actorId,{status:'completed',simulation:true,threadId:id('synthetic-thread'),turnId:'synthetic-turn',contextHash:hash});
  const args=(input,hash)=>({runId:store.get('document-context-frame',input.documentContextFrame.id).data.signed.data.runId,requestHash:hash,frameId:input.documentContextFrame.id});
  const proof=(input,hash)=>documentContextRequestEvidence(registry,args(input,hash));
  const quote=(input,hash,sourceKey,text)=>documentContextQuoteEvidence(registry,{...args(input,hash),sourceKey,quote:text});
  const candidate=()=>{
    registry.updateContext(producer.id,{...store.get('run',producer.id).data.context,sourceIds:[source.id]});
    registry.attachInference(producer.id,{status:'completed',simulation:true,threadId:id('synthetic-thread'),turnId:'synthetic-turn'});
    return registry.create({missionId:'m',nodeId:'n',producerRunId:producer.id,kind:'report',purpose:'document-product',body:'BODY_ONLY: synthetic candidate reports 17.',
      claims:[{id:'count',text:'CLAIM_ONLY: count17.',kind:'fact',sources:[{sourceId:source.id,hash:source.hash,quote:'count=17'}],basis:[],qualifiers:['QUALIFIER_ONLY: fixture.'],validUntil:null}],
      toolReceipts:[signed],criteria:[{id:'verify',text:'CRITERION_ONLY: examine complete limitations.'}]});
  };
  return {store,authority,registry,workers,intent,instructions,producer,source,signed,run,receipt,grant,select,task,prepare,request,dispatch,complete,args,proof,quote,candidate};
}

const legacyCandidate=(f,extra={})=>f.registry.create({missionId:'m',nodeId:'n',producerRunId:f.producer.id,kind:'report',purpose:'document-product',body:'Synthetic material candidate.',
  claims:[{id:'hidden',text:'Omitted count is 99.',kind:'fact',sources:[{sourceId:f.source.id,hash:f.source.hash,quote:'UNSEEN_RAW_ONLY count=99'}],basis:[],qualifiers:[],validUntil:null}],
  criteria:[{id:'verify',text:'Verify the cited literal.'}],...extra});

const materialEvidence=(registry,args)=>{assert.equal(typeof frameModule.documentContextMaterialEvidence,'function');return frameModule.documentContextMaterialEvidence(registry,args);};
for(const encoding of ['plain','json','literal'])test('completed material evidence shares exact input and proofs in one frame for '+encoding,t=>{
  const f=setup(t),g=f.grant(),input=f.prepare(g,[f.select(g)]),hash=f.dispatch(input,encoding);f.complete(g.runId,hash);
  const window=input.documentEvidenceCatalog.find(e=>e.kind==='source-window'),quotes=[{sourceKey:window.sourceKey,quote:'count=17'},{sourceKey:window.sourceKey,quote:'é😀'}];
  const args={...f.args(input,hash),quotes},expected=frameModule.documentContextQuoteEvidenceBatch(f.registry,args),before=f.store.verifyJournal();
  let reads=0;const get=f.store.get.bind(f.store);f.store.get=(type,...args)=>{if(type==='document-context-frame')reads++;return get(type,...args);};
  let result;try{result=materialEvidence(f.registry,args);}finally{f.store.get=get;}
  assert.deepEqual(result,{...expected,input});assert.equal(reads,1);assert.deepEqual(f.store.verifyJournal(),before);
  result.input.documentSourceViews[0].windows[0].text='MUTATED';result.quotes[0].exposure.runId='MUTATED';
  assert.equal(result.quotes[1].exposure.runId,g.runId);assert.deepEqual(materialEvidence(f.registry,args),{...expected,input});
  assert.ok(!JSON.stringify(result.input).includes('UNSEEN_RAW_ONLY'));assert.equal(f.store.db.isTransaction,false);
});
test('completed material evidence requires its own completed input even with no quotes',t=>{
  const f=setup(t),g=f.grant(),input=f.prepare(g),hash=f.dispatch(input),args={...f.args(input,hash),quotes:[]};
  assert.equal(typeof frameModule.documentContextMaterialEvidence,'function');
  assert.throws(()=>materialEvidence(f.registry,args),{code:'DOCUMENT_FRAME_UNOBSERVED'});f.complete(g.runId,hash);
  const before=f.store.verifyJournal();f.store.transact(()=>{
    assert.deepEqual(materialEvidence(f.registry,args),{exposure:f.proof(input,hash),quotes:[],input});assert.equal(f.store.db.isTransaction,true);
  });assert.deepEqual(f.store.verifyJournal(),before);
  assert.throws(()=>materialEvidence(f.registry,{...args,runId:f.run().id}),{code:'DOCUMENT_FRAME_SCOPE'});
  const record=f.store.get('inference-request','inference-request:'+sha256([g.runId,hash]));
  f.store.put(record.type,record.id,{...record.data,requestJson:'{}'},{expectedVersion:record.version});
  assert.throws(()=>materialEvidence(f.registry,args),{code:'DOCUMENT_FRAME_REQUEST'});
});
test('completed material evidence has no partial return and rechecks revoked grants',t=>{
  const f=setup(t),g=f.grant(),input=f.prepare(g,[f.select(g)]),hash=f.dispatch(input);f.complete(g.runId,hash);
  const w=input.documentEvidenceCatalog.find(e=>e.kind==='source-window'),valid={sourceKey:w.sourceKey,quote:'count=17'},args={...f.args(input,hash),quotes:[valid]};
  materialEvidence(f.registry,args);const before=f.store.verifyJournal();
  assert.throws(()=>materialEvidence(f.registry,{...args,quotes:[valid,{...valid,quote:'UNSEEN_RAW_ONLY'}]}),{code:'DOCUMENT_FRAME_QUOTE'});
  let touched=false;const bad={sourceKey:w.sourceKey,get quote(){touched=true;return 'count=17';}};
  assert.throws(()=>materialEvidence(f.registry,{...args,quotes:[bad]}),{code:'SCHEMA'});assert.equal(touched,false);
  assert.deepEqual(f.store.verifyJournal(),before);
  revokeSourceManifestGrant(f.registry,g.grant.id,{runId:g.runId,reason:'Material-view boundary revoked.'});
  const withdrawn=f.store.verifyJournal();assert.throws(()=>materialEvidence(f.registry,args),{code:'SOURCE_GRANT_REVOKED'});assert.deepEqual(f.store.verifyJournal(),withdrawn);
});

for(const encoding of ['plain','json','literal'])test('legacy producer gate cannot treat '+encoding+' documentary frame as full raw exposure',t=>{
  const f=setup(t);f.registry.updateContext(f.producer.id,{...f.store.get('run',f.producer.id).data.context,sourceIds:[f.source.id]});
  const g=f.grant(),input=f.prepare(g,[f.select(g)]),hash=f.dispatch(input,encoding);f.complete(g.runId,hash);
  assert.ok(!JSON.stringify(input).includes('UNSEEN_RAW_ONLY'));assert.equal(f.proof(input,hash).inference.simulation,true);
  const before=f.store.verifyJournal();assert.throws(()=>legacyCandidate(f),{code:'DOCUMENT_FRAME_NOT_INTEGRATED'});
  assert.deepEqual(f.store.verifyJournal(),before);assert.equal(f.store.list('artifact').length,0);
});
test('legacy reviewer cannot accept omitted raw using historical full-source admission and its own documentary frame',t=>{
  const f=setup(t),a=f.candidate(),reviewer=f.run('reviewer',[a.id],[f.source.id]),g=f.grant(reviewer,{kind:'assigned-artifact',artifactId:a.id});
  const input=f.prepare(g,[f.select(g)]),hash=f.dispatch(input);f.complete(g.runId,hash);assert.ok(!JSON.stringify(input).includes('UNSEEN_RAW_ONLY'));
  const before=f.store.verifyJournal();assert.throws(()=>f.registry.review({artifactId:a.id,reviewerRunId:reviewer.id,result:{artifactHash:a.payloadHash,purpose:a.payload.purpose,
    decision:'ACCEPT',checks:[{criterionId:'verify',verdict:'PASS',evidence:[{kind:'source',id:f.source.id,hash:f.source.hash,quote:'UNSEEN_RAW_ONLY count=99'}],reason:'Synthetic forbidden omitted-source proof.'}],findings:[],uncertainty:''}}),{code:'DOCUMENT_FRAME_NOT_INTEGRATED'});
  assert.deepEqual(f.store.verifyJournal(),before);assert.equal(f.store.get('artifact',a.id).data.status,'CANDIDATE');assert.equal(f.store.list('review').length,0);
});
test('source-less documentary frame cannot silently activate material acceptance either',t=>{
  const f=setup(t),input=f.workers.prepareDocumentInput({runId:f.producer.id,task:'No selected source.'}),hash=f.dispatch(input);f.complete(f.producer.id,hash);
  assert.throws(()=>legacyCandidate(f,{claims:[]}),{code:'DOCUMENT_FRAME_NOT_INTEGRATED'});assert.equal(f.store.list('artifact').length,0);
});
test('deterministic-result label cannot bypass the documentary material-gate boundary',t=>{
  const f=setup(t),g=f.grant(),input=f.prepare(g),hash=f.dispatch(input);f.complete(g.runId,hash);
  assert.throws(()=>legacyCandidate(f,{kind:'deterministic-result',claims:[]}),{code:'DOCUMENT_FRAME_NOT_INTEGRATED'});assert.equal(f.store.list('artifact').length,0);
});
test('preparation and previous framed inference do not contaminate a subsequent complete legacy request',t=>{
  const f=setup(t);f.registry.updateContext(f.producer.id,{...f.store.get('run',f.producer.id).data.context,sourceIds:[f.source.id]});
  const g=f.grant(),input=f.prepare(g),framedHash=f.dispatch(input);f.complete(g.runId,framedHash);
  const legacy={...f.workers.context(g.runId),task:'Legacy full source exposure.'},hash=f.registry.recordInferenceRequest(g.runId,f.request(legacy));f.complete(g.runId,hash);
  assert.ok(JSON.stringify(legacy).includes('UNSEEN_RAW_ONLY'));assert.equal(legacyCandidate(f).status,'CANDIDATE');
});
test('a documentary field name quoted inside task text is not a root documentary input',t=>{
  const f=setup(t);f.registry.updateContext(f.producer.id,{...f.store.get('run',f.producer.id).data.context,sourceIds:[f.source.id]});
  const input={...f.workers.context(f.producer.id),task:'Discuss {"documentContextFrame":null} without activating it.'},hash=f.registry.recordInferenceRequest(f.producer.id,f.request(input));f.complete(f.producer.id,hash);
  assert.equal(legacyCandidate(f).status,'CANDIDATE');
});
test('escaped root key and incomplete documentary envelopes cannot bypass the material boundary',t=>{
  for(const field of ['documentContextFrame','documentSourceGrants','documentSourceViews','documentAcquisitionProjection','documentEvidenceCatalog']){
    const f=setup(t),input={task:'Synthetic root envelope.',[field]:null},request=f.request(input);
    // Parse semantics, not a substring check, identify the key.
    request.input=request.input.replace('"'+field+'":','"\\u0064'+field.slice(1)+'":');
    const hash=f.registry.recordInferenceRequest(f.producer.id,request);f.complete(f.producer.id,hash);
    assert.throws(()=>legacyCandidate(f,{claims:[]}),{code:'DOCUMENT_FRAME_NOT_INTEGRATED'});
  }
});
test('legacy opaque input remains supported but mutated retained material request bytes fail closed',t=>{
  const f=setup(t),request={instructions:f.instructions,input:'Historical opaque fixture.',schema:{type:'object'}},hash=f.registry.recordInferenceRequest(f.producer.id,request);f.complete(f.producer.id,hash);
  assert.equal(legacyCandidate(f,{claims:[]}).status,'CANDIDATE');
  const record=f.store.get('inference-request','inference-request:'+sha256([f.producer.id,hash]));
  f.store.put(record.type,record.id,{...record.data,requestJson:JSON.stringify({...request,input:'Mutated retained input.'})},{expectedVersion:record.version});
  assert.throws(()=>legacyCandidate(f,{claims:[]}),{code:'REQUEST_INTEGRITY'});
});

test('worker prepares a complete signed input, without dispatch, actor/source mutation or implicit activation',t=>{
  const f=setup(t),g=f.grant(),v=f.select(g),before=f.store.get('run',g.runId),original=f.workers.context(g.runId),input=f.prepare(g,[v]);
  assert.equal(input.task,f.task);assert.deepEqual(input.runtimeCapabilities,{isolatedCodeRunner:true,publicSourceDiscovery:false,executionMode:'snapshot-discard',networkInExecution:false});
  assert.equal(input.sources,undefined);assert.equal(input.artifacts,undefined);assert.equal(input.toolObservations,undefined);
  assert.ok(!JSON.stringify(input).includes('UNSEEN_RAW_ONLY'));assert.ok(JSON.stringify(input).includes('count=17'));
  assert.deepEqual(input.documentSourceViews,[v]);assert.deepEqual(input.documentSourceGrants,[g]);
  assert.deepEqual(f.prepare(g,[v]),input);assert.deepEqual(f.store.get('run',g.runId),before);assert.deepEqual(f.workers.context(g.runId),original);
  assert.equal(f.store.list('document-context-frame').length,1);assert.equal(f.store.list('inference-request').length,0);
  assert.equal(f.store.get('source',f.source.id).data.raw,f.source.raw);
  assert.deepEqual(readDocumentContextFrame(f.registry,input.documentContextFrame.id,{runId:g.runId}),input);
});
for(const encoding of ['plain','json','literal'])test('completed '+encoding+' transport binds the entire prepared input and distinct metadata/window quotes',t=>{
  const f=setup(t),g=f.grant(),v=f.select(g),input=f.prepare(g,[v]),hash=f.dispatch(input,encoding);f.complete(g.runId,hash);
  const before=f.store.verifyJournal(),proof=f.proof(input,hash);assert.equal(proof.inference.simulation,true);assert.equal(proof.inputHash,sha256(input));
  const metadata=input.documentEvidenceCatalog.find(e=>e.kind==='acquisition-metadata'),window=input.documentEvidenceCatalog.find(e=>e.kind==='source-window');
  assert.equal(f.quote(input,hash,metadata.sourceKey,'https://example.com/record').target.kind,'acquisition-metadata');
  const observed=f.quote(input,hash,window.sourceKey,'count=17');assert.equal(observed.sourceEvidence.quote.text,'count=17');assert.equal(observed.sourceEvidence.runId,g.runId);
  assert.throws(()=>f.quote(input,hash,metadata.sourceKey,'count=17'),{code:'DOCUMENT_FRAME_QUOTE'});
  assert.throws(()=>f.quote(input,hash,window.sourceKey,'UNSEEN_RAW_ONLY'),{code:'DOCUMENT_FRAME_QUOTE'});
  assert.deepEqual(f.store.verifyJournal(),before);assert.equal(f.store.db.isTransaction,false);
});
test('manifest-only input provides metadata, not completed raw reading or legacy evidence catalog entries',t=>{
  const f=setup(t),g=f.grant(),input=f.prepare(g),hash=f.dispatch(input);f.complete(g.runId,hash);
  assert.equal(input.documentSourceViews.length,0);assert.ok(!JSON.stringify(input).includes('count=17'));
  assert.ok(!input.documentEvidenceCatalog.some(e=>e.kind==='source-window'));assert.throws(()=>observedEvidenceCatalog(input));
  const m=input.documentEvidenceCatalog.find(e=>e.kind==='source-manifest');assert.equal(f.quote(input,hash,m.sourceKey,f.source.hash).target.kind,'source-manifest');
  assert.throws(()=>f.quote(input,hash,m.sourceKey,'count=17'),{code:'DOCUMENT_FRAME_QUOTE'});assert.equal(f.store.list('review').length,0);
});
test('independent reviewer cites its own prepared artifact body and window, never omitted raw in its embedded receipt',t=>{
  const f=setup(t),a=f.candidate(),reviewer=f.run('reviewer',[a.id]),g=f.grant(reviewer,{kind:'assigned-artifact',artifactId:a.id}),v=f.select(g),input=f.prepare(g,[v]);
  const hash=f.dispatch(input);f.complete(g.runId,hash);
  const body=input.documentEvidenceCatalog.find(e=>e.kind==='artifact-body'),metadata=input.documentEvidenceCatalog.find(e=>e.kind==='acquisition-metadata'),window=input.documentEvidenceCatalog.find(e=>e.kind==='source-window');
  assert.equal(f.quote(input,hash,body.sourceKey,'BODY_ONLY').target.hash,a.payloadHash);
  assert.equal(f.quote(input,hash,metadata.sourceKey,'fixture17').target.relation,'EMBEDDED_RECEIPT_NOT_ACTOR_ACTION');
  assert.equal(f.quote(input,hash,window.sourceKey,'count=17').sourceEvidence.runId,reviewer.id);
  for(const text of ['UNSEEN_RAW_ONLY','CLAIM_ONLY','QUALIFIER_ONLY','CRITERION_ONLY'])assert.throws(()=>f.quote(input,hash,body.sourceKey,text),{code:'DOCUMENT_FRAME_QUOTE'});
  assert.throws(()=>f.quote(input,hash,metadata.sourceKey,'count=17'),{code:'DOCUMENT_FRAME_QUOTE'});
  assert.deepEqual(f.store.get('run',reviewer.id).data.context.sourceIds,[]);assert.equal(f.store.get('run',reviewer.id).data.toolObservations,undefined);
  assert.equal(f.store.get('artifact',a.id).data.status,'CANDIDATE');assert.equal(f.store.list('review').length,0);
});
test('complete non-acquisition observations stay independently quotable and never become own actions of another actor',t=>{
  const f=setup(t),g=f.grant();f.receipt(f.producer,'workspace.read',{path:'a.txt',content:'READ_BYTES',sha256:sha256('READ_BYTES')});
  const input=f.prepare(g),hash=f.dispatch(input);f.complete(g.runId,hash);
  const e=input.documentEvidenceCatalog.find(e=>e.kind==='tool-observation');assert.equal(f.quote(input,hash,e.sourceKey,'READ_BYTES').target.relation,'OWN_ACTION');
  const other=f.run(),q=f.request(input),otherHash=f.registry.recordInferenceRequest(other.id,q);f.complete(other.id,otherHash);
  assert.throws(()=>documentContextRequestEvidence(f.registry,{runId:other.id,requestHash:otherHash,frameId:input.documentContextFrame.id}),{code:'DOCUMENT_FRAME_SCOPE'});
});
test('pending, unretained, historically rebound or unrelated completions do not prove a prepared frame',t=>{
  const f=setup(t),g=f.grant(),input=f.prepare(g),hash=f.dispatch(input);
  assert.throws(()=>f.proof(input,hash),{code:'DOCUMENT_FRAME_UNOBSERVED'});assert.throws(()=>f.prepare(g),{code:'INFERENCE_PENDING'});
  f.complete(g.runId,hash);assert.throws(()=>f.proof(input,'0'.repeat(64)),{code:'DOCUMENT_FRAME_UNOBSERVED'});
  const h=setup(t),other=h.grant(),prepared=h.prepare(other),q=h.request(prepared),rHash=sha256('unretained');
  h.complete(other.runId,rHash);assert.throws(()=>h.proof(prepared,rHash),{code:'DOCUMENT_FRAME_UNOBSERVED'});
  const stored=f.store.get('inference-request','inference-request:'+sha256([g.runId,hash]));
  f.store.put(stored.type,stored.id,{...stored.data,retention:'HASH_BOUND_HISTORICAL'},{expectedVersion:stored.version});
  assert.throws(()=>f.proof(input,hash),{code:'DOCUMENT_FRAME_REQUEST'});
});
test('adding text, dropping criteria/feedback, swapping catalog identities or changing windows after preparation fails exact request binding',t=>{
  for(const mutate of [i=>{i.extra='UNSEEN_RAW_ONLY';},i=>{i.task='Discard criteria and feedback';},i=>{i.documentEvidenceCatalog[0].hash='0'.repeat(64);},
    i=>{i.documentSourceViews[0].windows[0].text='FORGED';},i=>{i.documentContextFrame.hash='0'.repeat(64);},i=>{delete i.documentSourceGrants;}]){
    const f=setup(t),g=f.grant(),v=f.select(g),input=f.prepare(g,[v]),changed=structuredClone(input);mutate(changed);
    const hash=f.registry.recordInferenceRequest(g.runId,f.request(changed));f.complete(g.runId,hash);
    assert.throws(()=>f.proof(input,hash),{code:'DOCUMENT_FRAME_REQUEST'});
  }
});
test('frame hidden inside task and intact quoted text elsewhere do not prove the required exact input',t=>{
  const f=setup(t),g=f.grant(),v=f.select(g),input=f.prepare(g,[v]);
  const hash=f.registry.recordInferenceRequest(g.runId,f.request({task:JSON.stringify(input),documentSourceViews:[v]}));f.complete(g.runId,hash);
  assert.throws(()=>f.proof(input,hash),{code:'DOCUMENT_FRAME_REQUEST'});
});
test('different instructions and admitted evidence added before dispatch cannot reuse an older frame',t=>{
  for(const kind of ['instructions','observations']){
    const f=setup(t),g=f.grant(),input=f.prepare(g);
    if(kind==='observations')f.receipt(f.producer,'workspace.read',{path:'a.txt',content:'NEW_OBSERVATION',sha256:sha256('NEW_OBSERVATION')});
    const hash=f.dispatch(input,'plain',kind==='instructions'?{instructions:'Different instructions.'}:{});f.complete(g.runId,hash);
    assert.throws(()=>f.proof(input,hash),{code:'DOCUMENT_FRAME_REQUEST'});
  }
});
test('revoked grants or sources block frame evidence without deleting exact request, window or signed frame',t=>{
  for(const kind of ['grant','source']){
    const f=setup(t),g=f.grant(),v=f.select(g),input=f.prepare(g,[v]),hash=f.dispatch(input);f.complete(g.runId,hash);
    const frames=f.store.list('document-context-frame'),requests=f.store.list('inference-request'),windows=f.store.list('source-window-selection');
    if(kind==='grant')revokeSourceManifestGrant(f.registry,g.grant.id,{runId:g.runId,reason:'Fixture revoke.'});else f.registry.retractSource(f.source.id,'Fixture correction.');
    assert.throws(()=>f.proof(input,hash),{code:kind==='grant'?'SOURCE_GRANT_REVOKED':'SOURCE_UNAVAILABLE'});
    assert.deepEqual(f.store.list('document-context-frame'),frames);assert.deepEqual(f.store.list('inference-request'),requests);assert.deepEqual(f.store.list('source-window-selection'),windows);
  }
});
test('worker compilation, intent and policy drift invalidate the frame even if the actor ID is unchanged',t=>{
  for(const kind of ['config','intent','policy']){
    const f=setup(t),g=f.grant(),input=f.prepare(g),hash=f.dispatch(input);f.complete(g.runId,hash);
    if(kind==='config')f.store.put('worker-config',g.runId,{instructions:'Injected overlay'},{expectedVersion:0});
    else {const r=f.store.get('mission','m'),delta=kind==='intent'?{intent:'Changed mandate',intentHash:sha256('Changed mandate')}:{policy:{allowedTools:[]}};f.store.put(r.type,r.id,{...r.data,...delta},{expectedVersion:r.version});}
    assert.throws(()=>f.proof(input,hash),{code:'DOCUMENT_FRAME_SCOPE'});
  }
});
test('untrusted preview self-hashes or stored frame reversioning cannot fabricate an authority-signed input',t=>{
  const f=setup(t),g=f.grant(),input=f.prepare(g),r=f.store.get('document-context-frame',input.documentContextFrame.id),signed=structuredClone(r.data.signed);
  signed.data.view.task='Forged task';signed.data.viewHash=sha256(signed.data.view);
  const fakeId='document-context-frame:'+sha256(signed.data);f.store.put(r.type,fakeId,{signed},{expectedVersion:0});
  assert.throws(()=>readDocumentContextFrame(f.registry,fakeId,{runId:g.runId}),{code:'BAD_SIGNATURE'});
  f.store.put(r.type,r.id,r.data,{expectedVersion:r.version});assert.throws(()=>readDocumentContextFrame(f.registry,r.id,{runId:g.runId}),{code:'DOCUMENT_FRAME_INTEGRITY'});
});
test('source quote preserves whole Unicode scalars without normalization or alternate catalog lookup',t=>{
  const f=setup(t,{raw:'é 😀 e\u0301 count=17 TAIL'}),g=f.grant(),v=f.select(g,[{startByte:0,maxBytes:24}]),input=f.prepare(g,[v]),hash=f.dispatch(input);f.complete(g.runId,hash);
  const w=input.documentEvidenceCatalog.find(e=>e.kind==='source-window');assert.equal(f.quote(input,hash,w.sourceKey,'e\u0301').quote,'e\u0301');
  assert.throws(()=>f.quote(input,hash,w.sourceKey,'\ud83d'),{code:'DOCUMENT_FRAME_QUOTE'});
  assert.throws(()=>f.quote(input,hash,'d999','count=17'),{code:'DOCUMENT_FRAME_QUOTE'});
});
test('whole-input cap preserves a large task and creates no partial frame or undocumented truncation',t=>{
  const f=setup(t),g=f.grant(),before=f.store.verifyJournal(),task='KEEP_FEEDBACK_AND_CRITERIA '.repeat(50000);
  assert.throws(()=>f.prepare(g,[],{task}),{code:'CONTEXT_LIMIT'});assert.deepEqual(f.store.verifyJournal(),before);assert.equal(f.store.list('document-context-frame').length,0);
});
test('prepared input also fits the narrower actual request string guard, not only the nominal 1MiB worker cap',t=>{
  const f=setup(t),g=f.grant(),empty=f.prepare(g,[],{task:''}),base=Buffer.byteLength(JSON.stringify(empty));
  const task='x'.repeat(1000000-base-64),input=f.prepare(g,[],{task}),bytes=Buffer.byteLength(JSON.stringify(input));
  assert.ok(bytes>999800&&bytes<=1000000);const hash=f.dispatch(input);f.complete(g.runId,hash);assert.equal(f.proof(input,hash).requestHash,hash);
  const before=f.store.verifyJournal();assert.throws(()=>f.prepare(g,[],{task:task+'x'.repeat(1024)}),{code:'CONTEXT_LIMIT'});
  assert.deepEqual(f.store.verifyJournal(),before);
});
test('actual signed runtime inventory is retained and cited historically without promising current absence of effects',t=>{
  const f=setup(t),g=f.grant();f.registry.captureRuntimeObservations(g.runId);
  const input=f.prepare(g),hash=f.dispatch(input);f.complete(g.runId,hash);
  const runtime=input.documentEvidenceCatalog.find(e=>e.kind==='runtime-observation'),text=input.runtimeObservations.find(o=>o.id===runtime.id).quoteText;
  assert.equal(f.quote(input,hash,runtime.sourceKey,text).target.kind,'runtime-observation');
  f.receipt(f.producer,'workspace.read',{path:'later.txt',content:'LATER',sha256:sha256('LATER')});
  const historical=f.quote(input,hash,runtime.sourceKey,text);assert.match(historical.exposure.scope,/not semantic support, full-raw reading, current external state/);
  const original=f.store.get('runtime-observation',runtime.id);f.store.put(original.type,original.id,original.data,{expectedVersion:original.version});
  assert.throws(()=>f.proof(input,hash),{code:'RUNTIME_INTEGRITY'});
});
test('source/receipt and artifact payload drift cannot be hidden behind the signed frame',t=>{
  for(const kind of ['source','artifact','effect']){
    const f=setup(t),a=f.candidate(),reviewer=f.run('reviewer',[a.id]),g=f.grant(reviewer,{kind:'assigned-artifact',artifactId:a.id}),input=f.prepare(g),hash=f.dispatch(input);f.complete(g.runId,hash);
    if(kind==='source'){const r=f.store.get('source',f.source.id);f.store.put(r.type,r.id,{...r.data,raw:'ALTERED'},{expectedVersion:r.version});}
    else if(kind==='artifact'){const r=f.store.get('artifact',a.id),payload={...r.data.payload,body:'ALTERED'};f.store.put(r.type,r.id,{...r.data,payload,payloadHash:sha256(payload)},{expectedVersion:r.version});}
    else {const r=f.store.get('effect',f.signed.data.id),receipt=structuredClone(r.data.receipt);receipt.data.result.status=204;f.store.put(r.type,r.id,{...r.data,receipt},{expectedVersion:r.version});}
    assert.throws(()=>f.proof(input,hash));
  }
});
test('a different selected input needs its own frame and completion; frame keys are not reusable global identifiers',t=>{
  const f=setup(t),g=f.grant(),first=f.prepare(g),firstHash=f.dispatch(first);f.complete(g.runId,firstHash);
  const v=f.select(g),second=f.prepare(g,[v]);assert.notEqual(second.documentContextFrame.id,first.documentContextFrame.id);
  assert.throws(()=>f.proof(second,firstHash),{code:'DOCUMENT_FRAME_REQUEST'});
  const secondHash=f.dispatch(second);f.complete(g.runId,secondHash);assert.equal(f.proof(second,secondHash).requestHash,secondHash);
  assert.equal(f.proof(first,firstHash).requestHash,firstHash,'Earlier exact exposure remains historical, not relabelled');
});
test('closed/blind/native contexts and an altered completion chronology cannot obtain a documentary proof',t=>{
  for(const kind of ['closed','blind','native','chronology']){
    const f=setup(t),g=f.grant(),input=f.prepare(g),hash=f.dispatch(input);f.complete(g.runId,hash);
    if(kind==='native')f.store.put('node','m:n',{missionId:'m',nodeId:'n',spec:{execution:{kind:'literal-input-copy-v1'}}},{expectedVersion:0});
    else if(kind==='chronology'){
      const original=f.registry.committedSequence.bind(f.registry),completion=original('run',g.runId,f.store.get('run',g.runId).version);
      f.registry.committedSequence=(type,id,version)=>type==='document-context-frame'?completion+1:original(type,id,version);
    }else {const r=f.store.get('run',g.runId),context={...r.data.context,...(kind==='blind'?{purpose:'closed-blind-comparison'}:{})};
      f.store.put(r.type,r.id,{...r.data,context,contextHash:sha256(context),...(kind==='closed'?{nodeId:'closed-entry'}:{})},{expectedVersion:r.version});}
    assert.throws(()=>f.proof(input,hash),{code:kind==='chronology'?'DOCUMENT_FRAME_REQUEST':'SOURCE_WINDOW_SCOPE'});
  }
});
test('aggregate window budget is across all selections; existing grants and selections survive a rejected frame',t=>{
  const f=setup(t,{raw:'count=17. '+('é '.repeat(180000))}),g=f.grant(),views=[];
  for(const startByte of [0,65535,131070,196605,262140])views.push(f.select(g,[{startByte,maxBytes:65535}]));
  const before=f.store.verifyJournal();assert.throws(()=>f.prepare(g,views),{code:'DOCUMENT_FRAME_LIMIT'});assert.deepEqual(f.store.verifyJournal(),before);
});
test('selection without its explicit grant, reserved caller fields and forged supplemental observations are rejected',t=>{
  const f=setup(t),g=f.grant(),v=f.select(g);
  assert.throws(()=>f.prepare(g,[v],{grantIds:[]}),{code:'DOCUMENT_FRAME_SCOPE'});
  for(const patch of [{documentContextFrame:{}},{runtimeObservations:[{id:'runtime:fake',hash:sha256('fake'),quoteText:'Forged',interpretation:'Fake'}]},{planViews:[]}]){
    const context={...f.workers.context(g.runId),task:f.task,...patch};
    assert.throws(()=>prepareDocumentContextFrame(f.registry,{runId:g.runId,context,grantIds:[g.grant.id]}));
  }
});
test('2MiB acquisition is projected once into a bounded complete prepared request with raw unchanged',t=>{
  const raw='HEAD count=17. '+('UNSEEN_RAW_ONLY '.repeat(150000)),f=setup(t,{raw}),g=f.grant(),v=f.select(g,[{startByte:0,maxBytes:14}]),input=f.prepare(g,[v]);
  assert.ok(input.documentAcquisitionProjection.bytes.original>4*1024*1024);assert.ok(Buffer.byteLength(JSON.stringify(input))<30000);
  assert.ok(!JSON.stringify(input).includes('UNSEEN_RAW_ONLY'));assert.equal(f.store.get('source',f.source.id).data.raw,raw);assert.equal(f.store.list('inference-request').length,0);
});

for(const encoding of ['plain','json','literal'])test('batched document proofs preserve each single proof and validate one completed frame for '+encoding,t=>{
  const f=setup(t),g=f.grant(),input=f.prepare(g,[f.select(g)]),hash=f.dispatch(input,encoding);f.complete(g.runId,hash);
  const metadata=input.documentEvidenceCatalog.find(e=>e.kind==='acquisition-metadata'),window=input.documentEvidenceCatalog.find(e=>e.kind==='source-window');
  const quotes=[{sourceKey:metadata.sourceKey,quote:'https://example.com/record'},{sourceKey:window.sourceKey,quote:'count=17'},
    {sourceKey:window.sourceKey,quote:'é😀'},{sourceKey:window.sourceKey,quote:'count=17'}];
  const expected=quotes.map(q=>f.quote(input,hash,q.sourceKey,q.quote)),exposure=f.proof(input,hash),before=f.store.verifyJournal(),args={...f.args(input,hash),quotes};
  let frameReads=0;const get=f.store.get.bind(f.store);f.store.get=(type,...rest)=>{if(type==='document-context-frame')frameReads++;return get(type,...rest);};
  let result;try{result=frameModule.documentContextQuoteEvidenceBatch(f.registry,args);}finally{f.store.get=get;}
  assert.deepEqual(result,{exposure,quotes:expected});assert.equal(frameReads,1,'No full-frame reconstruction per quote');
  assert.deepEqual(f.store.verifyJournal(),before);assert.equal(f.store.db.isTransaction,false);
  result.quotes[0].exposure.runId='MUTATED_RETURN';assert.equal(result.quotes[1].exposure.runId,g.runId,'Proof objects do not alias across results');
  assert.equal(frameModule.documentContextQuoteEvidenceBatch(f.registry,{...f.args(input,hash),quotes}).exposure.runId,g.runId,'No cache or mutated return survives a call');
});

for(const encoding of ['plain','json','literal'])test('frame source proofs reuse their own completed request and selection once for '+encoding,t=>{
  const f=setup(t),g=f.grant(),v=f.select(g),input=f.prepare(g,[v]),hash=f.dispatch(input,encoding);f.complete(g.runId,hash);
  const w=input.documentEvidenceCatalog.find(e=>e.kind==='source-window'),quotes=[{sourceKey:w.sourceKey,quote:'count=17'},{sourceKey:w.sourceKey,quote:'é😀'},{sourceKey:w.sourceKey,quote:'count=17'}];
  const expected=quotes.map(q=>f.quote(input,hash,q.sourceKey,q.quote)),args={...f.args(input,hash),quotes},before=f.store.verifyJournal();
  const get=f.store.get.bind(f.store);let requests=0,selections=0;
  f.store.get=(type,id,...rest)=>{if(type==='inference-request')requests++;if(type==='source-window-selection'&&id===v.selection.id)selections++;return get(type,id,...rest);};
  let result;try{result=frameModule.documentContextQuoteEvidenceBatch(f.registry,args);}finally{f.store.get=get;}
  assert.deepEqual(result.quotes,expected);assert.equal(requests,1,'Same completed request must not be authenticated twice');
  assert.equal(selections,1,'Frame already revalidated this exact selected view');assert.deepEqual(f.store.verifyJournal(),before);
  result.quotes[0].sourceEvidence.selection.hash='MUTATED';assert.equal(result.quotes[2].sourceEvidence.selection.hash,v.selection.hash);
  assert.deepEqual(frameModule.documentContextQuoteEvidenceBatch(f.registry,args).quotes,expected);
});

test('frame source proofs preserve disjoint windows, exact byte offsets and no cross-gap quotation',t=>{
  const raw='é😀alpha OMITTED beta count=17',f=setup(t,{raw}),g=f.grant();
  const beta=Buffer.byteLength(raw.slice(0,raw.indexOf('beta'))),v=f.select(g,[{startByte:0,maxBytes:11},{startByte:beta,maxBytes:13}]);
  const input=f.prepare(g,[v]),hash=f.dispatch(input,'literal');f.complete(g.runId,hash);
  const windows=input.documentEvidenceCatalog.filter(e=>e.kind==='source-window'),quotes=[{sourceKey:windows[0].sourceKey,quote:'é😀alpha'},{sourceKey:windows[1].sourceKey,quote:'count=17'}];
  const args={...f.args(input,hash),quotes},result=frameModule.documentContextQuoteEvidenceBatch(f.registry,args);
  assert.deepEqual(result.quotes,quotes.map(q=>f.quote(input,hash,q.sourceKey,q.quote)));
  assert.equal(result.quotes[0].sourceEvidence.quote.startByte,0);assert.equal(result.quotes[1].sourceEvidence.quote.startByte,beta+5);
  assert.throws(()=>frameModule.documentContextQuoteEvidenceBatch(f.registry,{...args,quotes:[quotes[0],{...quotes[0],quote:'alpha beta'}]}),{code:'DOCUMENT_FRAME_QUOTE'});
});

test('frame source proofs reject caller-supplied checked contexts, views or cache state',t=>{
  const f=setup(t),g=f.grant(),input=f.prepare(g,[f.select(g)]),hash=f.dispatch(input);f.complete(g.runId,hash);
  const w=input.documentEvidenceCatalog.find(e=>e.kind==='source-window'),args={...f.args(input,hash),quotes:[{sourceKey:w.sourceKey,quote:'count=17'}]};
  for(const key of ['completedFrame','checkedRequest','checkedSelections','cache'])assert.throws(()=>frameModule.documentContextQuoteEvidenceBatch(f.registry,{...args,[key]:{accepted:true}}),{code:'SCHEMA'});
});
test('batched document proofs have no partial return, quote repair or manifest/raw substitution',t=>{
  const f=setup(t),g=f.grant(),input=f.prepare(g,[f.select(g)]),hash=f.dispatch(input);f.complete(g.runId,hash);
  const window=input.documentEvidenceCatalog.find(e=>e.kind==='source-window'),manifest=input.documentEvidenceCatalog.find(e=>e.kind==='source-manifest'),args=f.args(input,hash);
  const valid={sourceKey:window.sourceKey,quote:'count=17'},before=f.store.verifyJournal();
  for(const invalid of [{...valid,quote:'UNSEEN_RAW_ONLY'},{...valid,sourceKey:manifest.sourceKey},{...valid,sourceKey:'d999'},
    {...valid,quote:'\ud83d'},{...valid,quote:'count=17.\r\nUNSEEN_RAW_ONLY'}])
    assert.throws(()=>frameModule.documentContextQuoteEvidenceBatch(f.registry,{...args,quotes:[valid,invalid]}),{code:'DOCUMENT_FRAME_QUOTE'});
  for(const quotes of [[{...valid,usage:'source'}],[{...valid,quote:''}],Array(2),Array.from({length:20001},()=>valid)])
    assert.throws(()=>frameModule.documentContextQuoteEvidenceBatch(f.registry,{...args,quotes}),{code:'SCHEMA'});
  let touched=false;const accessor={sourceKey:valid.sourceKey,get quote(){touched=true;return valid.quote;}};
  assert.throws(()=>frameModule.documentContextQuoteEvidenceBatch(f.registry,{...args,quotes:[accessor]}),{code:'SCHEMA'});assert.equal(touched,false);
  assert.deepEqual(f.store.verifyJournal(),before);assert.equal(f.store.db.isTransaction,false);
});
test('batched document proofs revalidate grants and sources on every call without cached authority',t=>{
  for(const kind of ['grant','source']){
    const f=setup(t),g=f.grant(),input=f.prepare(g,[f.select(g)]),hash=f.dispatch(input);f.complete(g.runId,hash);
    const window=input.documentEvidenceCatalog.find(e=>e.kind==='source-window'),args={...f.args(input,hash),quotes:[{sourceKey:window.sourceKey,quote:'count=17'}]};
    frameModule.documentContextQuoteEvidenceBatch(f.registry,args);
    if(kind==='grant')revokeSourceManifestGrant(f.registry,g.grant.id,{runId:g.runId,reason:'Batch regression revoke.'});else f.registry.retractSource(f.source.id,'Batch regression retract.');
    const before=f.store.verifyJournal();assert.throws(()=>frameModule.documentContextQuoteEvidenceBatch(f.registry,args),{code:kind==='grant'?'SOURCE_GRANT_REVOKED':'SOURCE_UNAVAILABLE'});
    assert.deepEqual(f.store.verifyJournal(),before);assert.equal(f.store.db.isTransaction,false);
  }
});
test('even an empty batch needs its exact actor frame and completed request; it preserves the caller transaction',t=>{
  const f=setup(t),g=f.grant(),input=f.prepare(g),hash=f.dispatch(input),args={...f.args(input,hash),quotes:[]};
  assert.throws(()=>frameModule.documentContextQuoteEvidenceBatch(f.registry,args),{code:'DOCUMENT_FRAME_UNOBSERVED'});f.complete(g.runId,hash);
  f.store.transact(()=>{const result=frameModule.documentContextQuoteEvidenceBatch(f.registry,args);assert.deepEqual(result,{exposure:f.proof(input,hash),quotes:[]});assert.equal(f.store.db.isTransaction,true);});
  const other=f.run();assert.throws(()=>frameModule.documentContextQuoteEvidenceBatch(f.registry,{...args,runId:other.id}),{code:'DOCUMENT_FRAME_SCOPE'});
  assert.throws(()=>frameModule.documentContextQuoteEvidenceBatch(f.registry,{...args,requestHash:'0'.repeat(64)}),{code:'DOCUMENT_FRAME_UNOBSERVED'});
  const record=f.store.get('inference-request','inference-request:'+sha256([g.runId,hash]));f.store.put(record.type,record.id,{...record.data,requestJson:'{}'},{expectedVersion:record.version});
  assert.throws(()=>frameModule.documentContextQuoteEvidenceBatch(f.registry,args),{code:'DOCUMENT_FRAME_REQUEST'});
});
test('batched document proofs reject changed frame, window, payload, policy, receipt and chronology after a valid call',t=>{
  for(const kind of ['frame','window','artifact','policy','effect','chronology']){
    const f=setup(t),a=f.candidate(),reviewer=f.run('reviewer',[a.id]),g=f.grant(reviewer,{kind:'assigned-artifact',artifactId:a.id}),input=f.prepare(g,[f.select(g)]),hash=f.dispatch(input);f.complete(g.runId,hash);
    const window=input.documentEvidenceCatalog.find(e=>e.kind==='source-window'),args={...f.args(input,hash),quotes:[{sourceKey:window.sourceKey,quote:'count=17'}]};
    frameModule.documentContextQuoteEvidenceBatch(f.registry,args);
    if(kind==='frame'||kind==='window'){
      const type=kind==='frame'?'document-context-frame':'source-window-selection',record=f.store.get(type,kind==='frame'?input.documentContextFrame.id:window.id);
      f.store.put(type,record.id,record.data,{expectedVersion:record.version});
    }else if(kind==='artifact'){
      const record=f.store.get('artifact',a.id),payload={...record.data.payload,body:'ALTERED'};f.store.put(record.type,record.id,{...record.data,payload,payloadHash:sha256(payload)},{expectedVersion:record.version});
    }else if(kind==='policy'){
      const record=f.store.get('mission','m');f.store.put(record.type,record.id,{...record.data,policy:{allowedTools:[]}},{expectedVersion:record.version});
    }else if(kind==='effect'){
      const record=f.store.get('effect',f.signed.data.id),receipt=structuredClone(record.data.receipt);receipt.data.result.status=204;f.store.put(record.type,record.id,{...record.data,receipt},{expectedVersion:record.version});
    }else {
      const original=f.registry.committedSequence.bind(f.registry),completion=original('run',g.runId,f.store.get('run',g.runId).version);
      f.registry.committedSequence=(type,...rest)=>type==='document-context-frame'?completion+1:original(type,...rest);
    }
    const before=f.store.verifyJournal();assert.throws(()=>frameModule.documentContextQuoteEvidenceBatch(f.registry,args));
    assert.deepEqual(f.store.verifyJournal(),before);assert.equal(f.store.db.isTransaction,false);
  }
});
