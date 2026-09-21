import test from 'node:test';
import assert from 'node:assert/strict';
import {Store} from '../../factory/lib/store.mjs';
import {Authority} from '../../factory/lib/authority.mjs';
import {ArtifactRegistry} from '../../factory/lib/artifacts.mjs';
import {canonical,id,sha256} from '../../factory/lib/contracts.mjs';
import {packJsonContext} from '../../factory/lib/context-json-codec.mjs';
import {packSourceContextView} from '../../factory/lib/source-context-view.mjs';
import {prepareSourceWindowSelection,readSourceWindowSelection,sourceWindowRequestEvidence} from '../../factory/lib/source-window-evidence.mjs';
import * as windowProofs from '../../factory/lib/source-window-evidence.mjs';
import {prepareSourceManifestGrant,revokeSourceManifestGrant} from '../../factory/lib/source-manifest-grants.mjs';

// REAL Store/Authority/retention/byte gates; explicitly SYNTHETIC HTTP and model
// receipts. These tests cannot qualify source reading by a live model.
function setup(t,raw='HEAD é\r\nvalue=17; e\u0301; \\n\nTAIL unseen value=99'){
  const store=new Store(':memory:'),authority=new Authority(store),registry=new ArtifactRegistry(store,authority);
  t.after(()=>store.close());
  store.put('mission','m',{id:'m',intent:'Verify an acquired record.',intentHash:sha256('Verify an acquired record.'),policy:{allowedTools:['source.fetch']}},{expectedVersion:0});
  const run=(mode='producer',sources=[])=>registry.registerRun({missionId:'m',nodeId:mode==='reviewer'?'review:n':'n',mode,
    context:{purpose:'source-verification',artifactIds:[],sourceIds:sources,instructionsHash:sha256('instructions'),producerConversationIncluded:false}});
  const producer=run(),receipt={id:'operation:fetch',missionId:'m',principalId:producer.id,tool:'source.fetch',status:'SUCCEEDED',argsHash:sha256({url:'https://example.com/record'}),
    startedAt:'2026-09-13T03:20:00.000Z',completedAt:'2026-09-13T03:20:01.000Z',
    result:{content:raw,sha256:sha256(raw),url:'https://example.com/record',finalUrl:'https://example.com/record',status:200,retrievedAt:'2026-09-13T03:20:01.000Z',mediaType:'text/plain'}};
  const signed=authority.seal('tool.receipt',receipt);
  store.put('effect',receipt.id,{id:receipt.id,missionId:'m',principalId:producer.id,tool:receipt.tool,state:receipt.status,argsHash:receipt.argsHash,receipt:signed},{expectedVersion:0});
  const source=registry.ingestSource(signed);registry.recordToolObservation(producer.id,signed);
  const prepare=(runId=producer.id,ranges=[{startByte:0,maxBytes:31}])=>prepareSourceWindowSelection(registry,{runId,sourceId:source.id,ranges});
  const request=(views,encoding='plain')=>{const input={missionIntent:'Verify an acquired record.',documentSourceViews:views,task:'Quote only observed material.'};
    return {instructions:'Synthetic fixture instructions.',input:encoding==='plain'?JSON.stringify(input):encoding==='literal'?packSourceContextView(input).input:packJsonContext(input).input,
      schema:{type:'object',properties:{value:{type:'string'}},required:['value'],additionalProperties:false},model:'synthetic-test',reasoningEffort:'high'};};
  const dispatch=(view,options={})=>registry.recordInferenceRequest(options.runId??view.runId,request(options.views??[view],options.encoding));
  const complete=(runId,hash)=>registry.attachInference(runId,{simulation:true,status:'completed',threadId:id('synthetic-thread'),turnId:id('synthetic-turn'),contextHash:hash});
  const evidence=(view,hash,quote='value=17',options={})=>sourceWindowRequestEvidence(registry,{runId:view.runId,requestHash:hash,selectionId:view.selection.id,windowHash:sha256(view.windows[0]),quote,...options});
  return {store,authority,registry,producer,source,signed,run,prepare,request,dispatch,complete,evidence};
}

test('selection is actor-bound, bounded and idempotent; preparing it is not model exposure or a raw-source context change',t=>{
  const f=setup(t),before=f.store.get('run',f.producer.id),view=f.prepare();
  assert.equal(view.schema,'sovereign.document-source-view.v1');assert.equal(view.source.raw,undefined);
  assert.equal(view.source.bytes,Buffer.byteLength(f.source.raw));assert.equal(view.windows.length,1);
  assert.ok(!JSON.stringify(view).includes('TAIL unseen value=99'));
  assert.deepEqual(f.prepare(),view);assert.deepEqual(f.store.get('run',f.producer.id),before);
  assert.equal(f.store.list('inference-request').length,0);assert.equal(f.store.list('source-window-selection').length,1);
  assert.equal(f.store.get('source',f.source.id).data.raw,f.source.raw);
});
test('actual retained completed request binds one exact literal quote and byte range, without asserting semantic truth',t=>{
  const f=setup(t),view=f.prepare(),hash=f.dispatch(view);f.complete(view.runId,hash);
  const before=f.store.verifyJournal(),proof=f.evidence(view,hash);
  assert.equal(proof.inference.simulation,true);assert.equal(proof.requestHash,hash);assert.equal(proof.quote.text,'value=17');
  const bytes=Buffer.from(f.source.raw);assert.equal(bytes.subarray(proof.quote.startByte,proof.quote.endByte).toString(),'value=17');
  assert.equal(proof.selection.id,view.selection.id);assert.equal(proof.semanticallySupported,undefined);assert.equal(proof.accepted,undefined);
  assert.match(proof.scope,/not semantic/);assert.deepEqual(f.store.verifyJournal(),before,'Evidence query is read-only');
});
for(const encoding of ['json','literal'])test('completed window evidence decodes full '+encoding+' context transport without repairing its bytes',t=>{
  const f=setup(t),view=f.prepare(),hash=f.dispatch(view,{encoding});f.complete(view.runId,hash);
  assert.equal(f.evidence(view,hash,'e\u0301').quote.text,'e\u0301');assert.throws(()=>f.evidence(view,hash,'é;'),{code:'SOURCE_WINDOW_UNOBSERVED'});
});
test('pending, unretained and unrelated completions do not prove window exposure',t=>{
  const f=setup(t),view=f.prepare(),hash=f.dispatch(view);
  assert.throws(()=>f.evidence(view,hash),{code:'SOURCE_WINDOW_UNOBSERVED'});
  assert.throws(()=>f.prepare(view.runId,[{startByte:31,maxBytes:8}]),{code:'INFERENCE_PENDING'});
  f.complete(view.runId,hash);
  assert.throws(()=>f.evidence(view,'0'.repeat(64)),{code:'SOURCE_WINDOW_UNOBSERVED'});
  const second=f.run('reviewer',[f.source.id]),own=f.prepare(second.id),q=f.request([own]);
  f.registry.attachInference(second.id,{status:'completed',simulation:true,threadId:id('synthetic-thread'),turnId:'turn',contextHash:sha256(q)});
  assert.throws(()=>f.evidence(own,sha256(q)),{code:'SOURCE_WINDOW_UNOBSERVED'});
});
test('source or selection inventory, a tool receipt, and source text elsewhere in task are not the required window exposure',t=>{
  const f=setup(t),view=f.prepare();
  const q={...f.request([]),input:JSON.stringify({documentSourceViews:[],sources:[f.source],task:canonical(view)})};
  const hash=f.registry.recordInferenceRequest(view.runId,q);f.complete(view.runId,hash);
  assert.throws(()=>f.evidence(view,hash),{code:'SOURCE_WINDOW_UNOBSERVED'});
});
test('reviewer cannot borrow producer request or selection, but can independently observe its own selection',t=>{
  const f=setup(t),view=f.prepare(),hash=f.dispatch(view);f.complete(view.runId,hash);
  const reviewer=f.run('reviewer',[f.source.id]);
  assert.throws(()=>f.evidence(view,hash,'value=17',{runId:reviewer.id}),{code:'SOURCE_WINDOW_SCOPE'});
  assert.throws(()=>readSourceWindowSelection(f.registry,view.selection.id,{runId:reviewer.id}),{code:'SOURCE_WINDOW_SCOPE'});
  const borrowed=f.dispatch(view,{runId:reviewer.id});f.complete(reviewer.id,borrowed);
  assert.throws(()=>f.evidence(view,borrowed,'value=17',{runId:reviewer.id}),{code:'SOURCE_WINDOW_SCOPE'});
  const own=f.prepare(reviewer.id),ownHash=f.dispatch(own);f.complete(reviewer.id,ownHash);
  assert.equal(f.evidence(own,ownHash).runId,reviewer.id);assert.notEqual(own.selection.id,view.selection.id);
});
test('unobserved and foreign sources cannot be selected; source admission alone grants no actor access',t=>{
  const f=setup(t),other=f.run();assert.throws(()=>f.prepare(other.id),{code:'SOURCE_WINDOW_SCOPE'});
  const s=f.store.get('source',f.source.id);f.store.put('source',s.id,{...s.data,missionId:'foreign'},{expectedVersion:s.version});
  assert.throws(()=>f.prepare(),{code:'SOURCE_UNAVAILABLE'});
});
test('a source signed without its committed successful broker effect is rejected',t=>{
  const f=setup(t),r=f.authority.open(f.signed,'tool.receipt'),forged={...r,id:'operation:no-commit'};
  const source=f.registry.ingestSource(f.authority.seal('tool.receipt',forged)),actor=f.run('reviewer',[source.id]);
  assert.throws(()=>prepareSourceWindowSelection(f.registry,{runId:actor.id,sourceId:source.id,ranges:[{startByte:0,maxBytes:16}]}),{code:'SOURCE_WINDOW_ACQUISITION'});
});
test('revocation blocks both selection and later citation while retaining all prior requests and selections',t=>{
  const f=setup(t),view=f.prepare(),hash=f.dispatch(view);f.complete(view.runId,hash);
  const records=f.store.list('source-window-selection'),requests=f.store.list('inference-request');
  f.registry.retractSource(f.source.id,'Synthetic correction');
  assert.throws(()=>f.prepare(),{code:'SOURCE_UNAVAILABLE'});assert.throws(()=>f.evidence(view,hash),{code:'SOURCE_UNAVAILABLE'});
  assert.deepEqual(f.store.list('source-window-selection'),records);assert.deepEqual(f.store.list('inference-request'),requests);
});
test('window text, complete-document label, selection hash and source manifest cannot change in the actual input',t=>{
  for(const mutate of [v=>{v.windows[0].text+='FORGED';},v=>{v.windows[0].completeRawDocument=true;},v=>{v.selection.hash='0'.repeat(64);},v=>{v.source.bytes++;}]){
    const f=setup(t),view=f.prepare(),changed=structuredClone(view);mutate(changed);
    const hash=f.dispatch(view,{views:[changed]});f.complete(view.runId,hash);
    assert.throws(()=>f.evidence(view,hash),{code:'SOURCE_WINDOW_UNOBSERVED'});
  }
});
test('raw content and metadata drift cannot be hidden behind a cached hash',t=>{
  for(const delta of [{raw:'changed'},{url:'https://example.com/different'},{receiptHash:'0'.repeat(64)}]){
    const f=setup(t),view=f.prepare(),hash=f.dispatch(view);f.complete(view.runId,hash);
    const s=f.store.get('source',f.source.id);f.store.put('source',s.id,{...s.data,...delta},{expectedVersion:s.version});
    assert.throws(()=>f.evidence(view,hash));
  }
});
test('quote cannot cross a gap, normalize text or use another selected window hash',t=>{
  const f=setup(t,'ABCD--GAP--WXYZ'),view=f.prepare(undefined,[{startByte:0,maxBytes:4},{startByte:11,maxBytes:4}]),hash=f.dispatch(view);f.complete(view.runId,hash);
  assert.throws(()=>f.evidence(view,hash,'ABCDWXYZ'),{code:'SOURCE_WINDOW_UNOBSERVED'});
  assert.throws(()=>f.evidence(view,hash,'WXYZ'),{code:'SOURCE_WINDOW_UNOBSERVED'});
  assert.equal(f.evidence(view,hash,'WXYZ',{windowHash:sha256(view.windows[1])}).quote.startByte,11);
});
test('selection cannot be re-versioned to inject a different scope',t=>{
  const f=setup(t),view=f.prepare(),hash=f.dispatch(view);f.complete(view.runId,hash);
  const selection=f.store.get('source-window-selection',view.selection.id);
  f.store.put(selection.type,selection.id,selection.data,{expectedVersion:selection.version});
  assert.throws(()=>readSourceWindowSelection(f.registry,selection.id,{runId:view.runId}),{code:'SOURCE_WINDOW_INTEGRITY'});
});
test('a sequence mismatch rejects retrospective selection even when the public bytes and digests match',t=>{
  const f=setup(t),view=f.prepare(),hash=f.dispatch(view);f.complete(view.runId,hash);
  const original=f.registry.committedSequence.bind(f.registry);
  const completion=original('run',view.runId,f.store.get('run',view.runId).version);
  // Inject an inconsistent chronology as a negative control, not an actual
  // mutation of the immutable journal or a claim of a successful live attack.
  f.registry.committedSequence=(type,recordId,version)=>type==='source-window-selection'?completion+1:original(type,recordId,version);
  assert.throws(()=>f.evidence(view,hash),{code:'SOURCE_WINDOW_REQUEST'});
});
test('Unicode quote offsets are scalar-aligned bytes; half-surrogates are not citations',t=>{
  const f=setup(t,'á 😀 e\u0301 tail'),view=f.prepare(undefined,[{startByte:3,maxBytes:16}]),hash=f.dispatch(view);f.complete(view.runId,hash);
  const proof=f.evidence(view,hash,'😀');assert.deepEqual(proof.quote,{text:'😀',startByte:3,endByte:7});
  for(const quote of ['\ud83d','\ude00'])assert.throws(()=>f.evidence(view,hash,quote),{code:'SOURCE_WINDOW_RANGE'});
});
test('a known selected view duplicated in the same request is ambiguous and fails closed',t=>{
  const f=setup(t),view=f.prepare(),hash=f.dispatch(view,{views:[view,view]});f.complete(view.runId,hash);
  assert.throws(()=>f.evidence(view,hash),{code:'SOURCE_WINDOW_UNOBSERVED'});
});
test('policy or purpose drift cannot reuse a prior source-window grant',t=>{
  for(const target of ['policy','purpose']){
    const f=setup(t),view=f.prepare(),hash=f.dispatch(view);f.complete(view.runId,hash);
    if(target==='policy'){const r=f.store.get('mission','m');f.store.put(r.type,r.id,{...r.data,policy:{allowedTools:[]}},{expectedVersion:r.version});}
    else {const r=f.store.get('run',view.runId),context={...r.data.context,purpose:'different-purpose'};
      f.store.put(r.type,r.id,{...r.data,context,contextHash:sha256(context)},{expectedVersion:r.version});}
    assert.throws(()=>f.evidence(view,hash),{code:'SOURCE_WINDOW_SCOPE'});
  }
});
test('native execution node and explicit closed controller remain denied under non-reserved node names',t=>{
  for(const kind of ['node','controller']){
    const f=setup(t);
    if(kind==='node')f.store.put('node','m:n',{missionId:'m',nodeId:'n',spec:{execution:{kind:'literal-input-copy-v1'}}},{expectedVersion:0});
    else f.store.put('worker-config',f.producer.id,{controllerContract:{contract:'closed-response-production-v1'}},{expectedVersion:0});
    assert.throws(()=>f.prepare(),{code:'SOURCE_WINDOW_SCOPE'});
  }
});
test('aggregate byte cap is independent of per-window cap and preserves selection history on failure',t=>{
  const f=setup(t,'X'.repeat(400000)),ranges=Array.from({length:5},(_,i)=>({startByte:i*65536,maxBytes:65536})),before=f.store.verifyJournal();
  assert.throws(()=>f.prepare(undefined,ranges),{code:'SOURCE_WINDOW_LIMIT'});
  assert.deepEqual(f.store.verifyJournal(),before);assert.equal(f.store.list('source-window-selection').length,0);
});
test('incomplete, unknown and duplicate provider completion metadata do not become a real qualification',t=>{
  const f=setup(t),view=f.prepare(),hash=f.dispatch(view);f.complete(view.runId,hash);
  let r=f.store.get('run',view.runId),receipts=r.data.inferenceReceipts;
  f.store.put(r.type,r.id,{...r.data,inferenceReceipts:receipts.map(({simulation,...q})=>q)},{expectedVersion:r.version});
  assert.equal(f.evidence(view,hash).inference.simulation,null);
  r=f.store.get('run',view.runId);f.store.put(r.type,r.id,{...r.data,inferenceReceipts:receipts.map(q=>({...q,status:'failed'}))},{expectedVersion:r.version});
  assert.throws(()=>f.evidence(view,hash),{code:'SOURCE_WINDOW_UNOBSERVED'});
  r=f.store.get('run',view.runId);f.store.put(r.type,r.id,{...r.data,inferenceReceipts:[...receipts,...receipts]},{expectedVersion:r.version});
  assert.throws(()=>f.evidence(view,hash),{code:'SOURCE_WINDOW_UNOBSERVED'});
});
test('changed or historically bound retained input is not a prospective completed-window receipt',t=>{
  for(const delta of [{retention:'HASH_BOUND_HISTORICAL'},{requestJson:'{}'}]){
    const f=setup(t),view=f.prepare(),hash=f.dispatch(view);f.complete(view.runId,hash);
    const record=f.store.list('inference-request')[0];f.store.put(record.type,record.id,{...record.data,...delta},{expectedVersion:record.version});
    assert.throws(()=>f.evidence(view,hash),{code:'SOURCE_WINDOW_REQUEST'});
  }
});
test('closed, blind and native-input roles cannot gain a new documentary exposure through this controller helper',t=>{
  for(const changes of [{mode:'replicator'},{nodeId:'closed-entry'},{context:{purpose:'closed-blind-attempt-assessment'}},{context:{purpose:'closed-blind-comparison'}},{context:{purpose:'blind-protocol'}}]){
    const f=setup(t),record=f.store.get('run',f.producer.id),context={...record.data.context,...changes.context};
    f.store.put('run',record.id,{...record.data,...changes,context,contextHash:sha256(context)},{expectedVersion:record.version});
    assert.throws(()=>f.prepare(),{code:'SOURCE_WINDOW_SCOPE'});
  }
});
test('invalid, duplicate or excessive windows fail without creating partial selection records',t=>{
  const f=setup(t),before=f.store.verifyJournal();
  for(const ranges of [[],[{startByte:6,maxBytes:4}],Array(17).fill({startByte:0,maxBytes:4}),[{startByte:0,maxBytes:4},{startByte:0,maxBytes:4}],new Array(2)])
    assert.throws(()=>f.prepare(undefined,ranges));
  assert.equal(f.store.list('source-window-selection').length,0);assert.deepEqual(f.store.verifyJournal(),before);
});
test('a 2MB source produces a bounded literal view without editing source, suppressing feedback or implying complete coverage',t=>{
  const raw='value=17\r\n'+('SVG e\u0301 '.repeat(300000))+'contradiction at end',f=setup(t,raw),view=f.prepare();
  assert.ok(Buffer.byteLength(raw)>2*1024*1024);assert.ok(Buffer.byteLength(JSON.stringify(view))<4096);
  assert.equal(view.windows[0].completeRawDocument,false);assert.equal(f.store.get('source',f.source.id).data.raw,raw);
  const hash=f.dispatch(view);f.complete(view.runId,hash);assert.equal(f.evidence(view,hash).inference.simulation,true);
  assert.throws(()=>f.evidence(view,hash,'contradiction at end'),{code:'SOURCE_WINDOW_UNOBSERVED'});
});

const batchProof=(f,view,requestHash,quotes,extra={})=>windowProofs.sourceWindowRequestEvidenceBatch(f.registry,
  {runId:view.runId,requestHash,quotes,...extra});
const selector=(view,quote,index=0)=>({selectionId:view.selection.id,windowHash:sha256(view.windows[index]),quote});
const selectionBatch=(f,selectionIds,extra={})=>{
  assert.equal(typeof windowProofs.readSourceWindowSelections,'function','Complete selection batch reader required');
  return windowProofs.readSourceWindowSelections(f.registry,{runId:f.producer.id,selectionIds,...extra});
};
function secondSource(f){
  const raw='Second source: é😀 value=21.',receipt={...f.authority.open(f.signed,'tool.receipt'),id:'operation:second',
    argsHash:sha256({url:'https://example.com/second'}),result:{content:raw,sha256:sha256(raw),url:'https://example.com/second',
      finalUrl:'https://example.com/second',status:200,retrievedAt:'2026-09-13T03:20:01.000Z',mediaType:'text/plain'}};
  const signed=f.authority.seal('tool.receipt',receipt);
  f.store.put('effect',receipt.id,{id:receipt.id,missionId:'m',principalId:f.producer.id,tool:'source.fetch',state:'SUCCEEDED',
    argsHash:receipt.argsHash,receipt:signed},{expectedVersion:0});
  const source=f.registry.ingestSource(signed);f.registry.recordToolObservation(f.producer.id,signed);
  return prepareSourceWindowSelection(f.registry,{runId:f.producer.id,sourceId:source.id,ranges:[{startByte:0,maxBytes:128}]});
}
test('selection batch returns exact scalar views once each, keeps order and isolates returned data',t=>{
  const f=setup(t),first=f.prepare(),second=secondSource(f),ids=[second.selection.id,first.selection.id];
  const expected=ids.map(id=>readSourceWindowSelection(f.registry,id,{runId:f.producer.id})),before=f.store.verifyJournal();
  let reads=0;const get=f.store.get.bind(f.store);f.store.get=(type,...args)=>{if(type==='source-window-selection')reads++;return get(type,...args);};
  let result;try{result=selectionBatch(f,ids);}finally{f.store.get=get;}
  assert.deepEqual(result,expected);assert.equal(reads,2);result[0].windows[0].text='Returned object only';
  assert.deepEqual(selectionBatch(f,ids),expected);assert.deepEqual(f.store.verifyJournal(),before);assert.equal(f.store.db.isTransaction,false);
});
test('selection batch authenticates empty actors and rejects foreign selections before borrowing any grants',t=>{
  const f=setup(t),view=f.prepare(),other=f.run('reviewer',[f.source.id]);
  assert.deepEqual(selectionBatch(f,[]),[]);assert.throws(()=>selectionBatch(f,[],{runId:'run:missing'}),{code:'SOURCE_WINDOW_SCOPE'});
  assert.throws(()=>selectionBatch(f,[view.selection.id],{runId:other.id}),{code:'SOURCE_WINDOW_SCOPE'});
  const own=f.prepare(other.id),before=f.store.verifyJournal();
  assert.throws(()=>selectionBatch(f,[view.selection.id,own.selection.id]),{code:'SOURCE_WINDOW_SCOPE'});assert.deepEqual(f.store.verifyJournal(),before);
});
test('selection batch refuses duplicates, excess, missing last member, accessors and caller-provided authority',t=>{
  const f=setup(t),v=f.prepare();assert.deepEqual(selectionBatch(f,[v.selection.id]),[v]);const before=f.store.verifyJournal();
  for(const ids of [[v.selection.id,v.selection.id],Array(17).fill(v.selection.id),new Array(1)])assert.throws(()=>selectionBatch(f,ids),{code:'SCHEMA'});
  assert.throws(()=>selectionBatch(f,[v.selection.id,'source-window-selection:missing']),{code:'SOURCE_WINDOW_INTEGRITY'});
  for(const extra of [{grants:[]},{checked:{}},{parents:{}},{accepted:true}])assert.throws(()=>selectionBatch(f,[v.selection.id],extra),{code:'SCHEMA'});
  let calls=0;const options={runId:f.producer.id,get selectionIds(){calls++;return [v.selection.id];}};
  assert.throws(()=>windowProofs.readSourceWindowSelections(f.registry,options),{code:'SCHEMA'});assert.equal(calls,0);assert.deepEqual(f.store.verifyJournal(),before);
});
for(const target of ['source','selection','policy','history','window'])test('selection batch revalidates '+target+' after a successful read, without partial results',t=>{
  const f=setup(t),a=f.prepare(),b=secondSource(f),ids=[a.selection.id,b.selection.id];selectionBatch(f,ids);
  if(target==='source')f.registry.retractSource(b.source.id,'Withdraw second selected source.');
  else if(target==='selection'){const r=f.store.get('source-window-selection',b.selection.id);f.store.put(r.type,r.id,r.data,{expectedVersion:r.version});}
  else if(target==='policy'){const r=f.store.get('mission','m');f.store.put(r.type,r.id,{...r.data,policy:{allowedTools:[]}},{expectedVersion:r.version});}
  else {
    const r=f.store.get('source-window-selection',b.selection.id),data=structuredClone(r.data);
    if(target==='history')data.sourceRecord.hash='0'.repeat(64);else data.windows[0].text='Changed selected text';
    const key='source-window-selection:'+sha256(data);f.store.put(r.type,key,data,{expectedVersion:0});ids[1]=key;
  }
  const before=f.store.verifyJournal();
  assert.throws(()=>selectionBatch(f,ids),{code:{source:'SOURCE_UNAVAILABLE',selection:'SOURCE_WINDOW_INTEGRITY',policy:'SOURCE_WINDOW_SCOPE',history:'SOURCE_WINDOW_INTEGRITY',window:'SOURCE_WINDOW_INTEGRITY'}[target]});
  assert.deepEqual(f.store.verifyJournal(),before);
  assert.equal(f.store.list('inference-request').length,0);
});
for(const equalBytes of [false,true])test('fresh grant cannot select another acquired source even with equal bytes: '+equalBytes,t=>{
  const f=setup(t,equalBytes?'Second source: é😀 value=21.':'Different first source.'),other=secondSource(f);
  const g=prepareSourceManifestGrant(f.registry,{runId:f.producer.id,sourceId:f.source.id,origin:{kind:'observed-acquisition'}});
  assert.equal(g.source.sourceHash===other.source.hash,equalBytes);
  const options={runId:f.producer.id,sourceId:other.source.id,grantId:g.grant.id,ranges:[{startByte:0,maxBytes:128}]},before=f.store.verifyJournal();
  assert.throws(()=>prepareSourceWindowSelection(f.registry,options),{code:'SOURCE_GRANT_SCOPE'});assert.deepEqual(f.store.verifyJournal(),before);
  const view=prepareSourceWindowSelection(f.registry,{...options,sourceId:f.source.id});assert.deepEqual(view.grantRecord,g.grant);
  assert.equal(view.source.id,f.source.id);assert.equal(f.store.list('inference-request').length,0);
});
for(const encoding of ['plain','json','literal'])test('source-window proof batch equals individual proofs across sources and windows: '+encoding,t=>{
  const f=setup(t,'á 😀 value=17; GAP value=18; END'),other=secondSource(f),view=f.prepare(undefined,
    [{startByte:0,maxBytes:18},{startByte:20,maxBytes:128}]);
  const hash=f.dispatch(view,{encoding,views:[view,other]});f.complete(view.runId,hash);
  const queries=[selector(view,'😀'),selector(other,'value=21'),selector(view,'value=18',1),selector(view,'😀')];
  const expected=queries.map(q=>sourceWindowRequestEvidence(f.registry,{runId:view.runId,requestHash:hash,...q}));
  const before=f.store.verifyJournal();assert.deepEqual(batchProof(f,view,hash,queries),expected);
  assert.deepEqual(f.store.verifyJournal(),before);
});
test('source-window proof batch authenticates a retained request and each distinct selection once, not once per quote',t=>{
  const f=setup(t),view=f.prepare(),hash=f.dispatch(view);f.complete(view.runId,hash);
  const get=f.store.get.bind(f.store),counts={};
  f.store.get=(type,...args)=>{counts[type]=(counts[type]??0)+1;return get(type,...args);};
  try{
    const result=batchProof(f,view,hash,Array.from({length:20},()=>selector(view,'value=17')));
    assert.equal(result.length,20);assert.equal(counts['inference-request'],1);assert.equal(counts['source-window-selection'],1);
  }finally{f.store.get=get;}
});
test('source-window proof batch is all-or-nothing, preserves outer transaction and isolates returned objects',t=>{
  const f=setup(t),view=f.prepare(),hash=f.dispatch(view);f.complete(view.runId,hash);
  const queries=[selector(view,'value=17'),selector(view,'value=17')],before=f.store.verifyJournal();
  const result=batchProof(f,view,hash,queries);result[0].selection.hash='0'.repeat(64);result[0].quote.text='changed';
  assert.equal(result[1].selection.hash,view.selection.hash);assert.equal(result[1].quote.text,'value=17');
  assert.equal(batchProof(f,view,hash,queries)[0].selection.hash,view.selection.hash);
  f.store.db.exec('BEGIN');
  try{
    assert.throws(()=>batchProof(f,view,hash,[...queries,selector(view,'unseen value=99')]),{code:'SOURCE_WINDOW_UNOBSERVED'});
    assert.equal(f.store.db.isTransaction,true);assert.equal(batchProof(f,view,hash,queries).length,2);
    assert.equal(f.store.db.isTransaction,true);assert.deepEqual(f.store.verifyJournal(),before);
  }finally{f.store.db.exec('ROLLBACK');}
  assert.deepEqual(f.store.verifyJournal(),before);
});
test('source-window proof batch rejects missing completion, foreign actors, changed retention and revoked grants between calls',t=>{
  const f=setup(t),grant=prepareSourceManifestGrant(f.registry,{runId:f.producer.id,sourceId:f.source.id,origin:{kind:'observed-acquisition'}});
  const view=prepareSourceWindowSelection(f.registry,{runId:f.producer.id,sourceId:f.source.id,grantId:grant.grant.id,ranges:[{startByte:0,maxBytes:31}]}),hash=f.dispatch(view);
  assert.throws(()=>batchProof(f,view,hash,[]),{code:'SOURCE_WINDOW_UNOBSERVED'});f.complete(view.runId,hash);
  assert.deepEqual(batchProof(f,view,hash,[]),[]);assert.equal(batchProof(f,view,hash,[selector(view,'value=17')]).length,1);
  const other=f.run('reviewer',[f.source.id]),borrowed=f.dispatch(view,{runId:other.id});f.complete(other.id,borrowed);
  assert.throws(()=>batchProof(f,view,borrowed,[selector(view,'value=17')],{runId:other.id}),{code:'SOURCE_WINDOW_SCOPE'});
  revokeSourceManifestGrant(f.registry,grant.grant.id,{runId:view.runId,reason:'Synthetic revocation after a successful batch'});
  assert.throws(()=>batchProof(f,view,hash,[selector(view,'value=17')]),{code:'SOURCE_GRANT_REVOKED'});
  const g=setup(t),v=g.prepare(),h=g.dispatch(v);g.complete(v.runId,h);
  const saved=g.store.list('inference-request')[0];g.store.put(saved.type,saved.id,{...saved.data,retention:'HASH_BOUND_HISTORICAL'},{expectedVersion:saved.version});
  assert.throws(()=>batchProof(g,v,h,[selector(v,'value=17')]),{code:'SOURCE_WINDOW_REQUEST'});
});
test('source-window proof batch validates bounded plain data and does not execute accessors',t=>{
  assert.equal(typeof windowProofs.sourceWindowRequestEvidenceBatch,'function');
  const f=setup(t),view=f.prepare(),hash=f.dispatch(view);f.complete(view.runId,hash);const good=selector(view,'value=17');let touched=false;
  const accessor={...good};Object.defineProperty(accessor,'quote',{enumerable:true,get(){touched=true;return 'value=17';}});
  for(const queries of [new Array(1),[accessor],[{...good,extra:true}],Array(20001).fill(good),[{...good,quote:'\ud83d'}],
    [{...good,quote:'x'.repeat(20001)}],[{...good,windowHash:'bad'}],[{...good,selectionId:'../foreign'}]])
    assert.throws(()=>batchProof(f,view,hash,queries));
  assert.equal(touched,false);
});
