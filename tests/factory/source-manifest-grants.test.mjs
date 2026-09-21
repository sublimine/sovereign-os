import test from 'node:test';
import assert from 'node:assert/strict';
import {Store} from '../../factory/lib/store.mjs';
import {Authority} from '../../factory/lib/authority.mjs';
import {ArtifactRegistry} from '../../factory/lib/artifacts.mjs';
import {id,sha256} from '../../factory/lib/contracts.mjs';
import {prepareSourceManifestGrant,readSourceManifestGrant,revokeSourceManifestGrant} from '../../factory/lib/source-manifest-grants.mjs';
import * as grantModule from '../../factory/lib/source-manifest-grants.mjs';
import {WorkerService} from '../../factory/lib/workers.mjs';
import {readDocumentContextFrame} from '../../factory/lib/document-context-frames.mjs';
import {prepareSourceWindowSelection,readSourceWindowSelection,sourceWindowRequestEvidence,sourceWindowRequestEvidenceBatch} from '../../factory/lib/source-window-evidence.mjs';
import * as windowModule from '../../factory/lib/source-window-evidence.mjs';

// Real admission, identity, retention, journal and revocation gates. HTTP and
// inference receipts are synthetic and cannot qualify a live model outcome.
function setup(t,{secondSource=false}={}){
  const store=new Store(':memory:'),authority=new Authority(store),registry=new ArtifactRegistry(store,authority);
  t.after(()=>store.close());
  const intent='Verify the exact acquired count with its limitations.';
  store.put('mission','m',{id:'m',intent,intentHash:sha256(intent),policy:{allowedTools:['source.fetch']}},{expectedVersion:0});
  const run=(mode='producer',artifactIds=[],sourceIds=[])=>registry.registerRun({missionId:'m',nodeId:mode==='reviewer'?'review:n':'n',mode,
    context:{purpose:'source-check',artifactIds,sourceIds,instructionsHash:sha256('fixture'),producerConversationIncluded:false}});
  const producer=run(),raw='HEAD é😀 count=17.\r\nTAIL NOT SELECTED';
  const receipt={id:'operation:fetch',missionId:'m',principalId:producer.id,tool:'source.fetch',status:'SUCCEEDED',argsHash:sha256({fixture:true}),
    startedAt:'2026-09-13T04:30:00.000Z',completedAt:'2026-09-13T04:30:01.000Z',
    result:{content:raw,sha256:sha256(raw),url:'https://example.com/source',status:200,retrievedAt:'2026-09-13T04:30:01.000Z',mediaType:'text/plain'}};
  const signed=authority.seal('tool.receipt',receipt);
  store.put('effect',receipt.id,{missionId:'m',principalId:producer.id,tool:receipt.tool,argsHash:receipt.argsHash,state:receipt.status,receipt:signed},{expectedVersion:0});
  const source=registry.ingestSource(signed);registry.recordToolObservation(producer.id,signed);
  const sources=[source],receipts=[signed];
  if(secondSource){
    const content='OTHER acquired document count=17, with a different scope.';
    const extra={...receipt,id:'operation:fetch-second',argsHash:sha256({second:true}),
      result:{...receipt.result,content,sha256:sha256(content),url:'https://example.org/second'}};
    const sealed=authority.seal('tool.receipt',extra);
    store.put('effect',extra.id,{missionId:'m',principalId:producer.id,tool:extra.tool,argsHash:extra.argsHash,state:extra.status,receipt:sealed},{expectedVersion:0});
    sources.push(registry.ingestSource(sealed));registry.recordToolObservation(producer.id,sealed);receipts.push(sealed);
  }
  const grant=(actor=producer,origin={kind:'observed-acquisition'})=>prepareSourceManifestGrant(registry,{runId:actor.id,sourceId:source.id,origin});
  const select=(g)=>prepareSourceWindowSelection(registry,{runId:g.runId,sourceId:source.id,grantId:g.grant.id,ranges:[{startByte:0,maxBytes:24}]});
  const candidate=({validUntil=null}={})=>{
    registry.updateContext(producer.id,{...store.get('run',producer.id).data.context,sourceIds:sources.map(s=>s.id)});
    registry.attachInference(producer.id,{status:'completed',simulation:true,threadId:id('synthetic-thread'),turnId:'synthetic-turn'});
    return registry.create({missionId:'m',nodeId:'n',producerRunId:producer.id,kind:'report',purpose:'source-check',body:'Synthetic candidate only.',
      claims:[{id:'c',text:'count=17',kind:'fact',sources:sources.map(s=>({sourceId:s.id,hash:s.hash,quote:'count=17'})),basis:[],qualifiers:['Fixture only.'],validUntil}],
      criteria:[{id:'verify',text:'Verify count, context and limitations.'}],toolReceipts:receipts});
  };
  const dispatch=(view,actorId=view.runId)=>registry.recordInferenceRequest(actorId,{instructions:'Synthetic fixture.',
    input:JSON.stringify({documentSourceViews:[view]}),schema:{type:'object'}});
  const complete=(actorId,hash)=>registry.attachInference(actorId,{status:'completed',simulation:true,contextHash:hash,threadId:id('synthetic-thread'),turnId:'synthetic-turn'});
  const proof=(view,hash)=>sourceWindowRequestEvidence(registry,{runId:view.runId,requestHash:hash,selectionId:view.selection.id,windowHash:sha256(view.windows[0]),quote:'count=17'});
  return {store,authority,registry,producer,source,sources,signed,run,grant,select,candidate,dispatch,complete,proof};
}

function acceptedInput(f,options={}){
  const a=f.candidate(options),reviewer=f.run('reviewer',[a.id],f.sources.map(s=>s.id));
  f.registry.attachInference(reviewer.id,{status:'completed',simulation:true,threadId:id('synthetic-thread'),turnId:'synthetic-turn'});
  f.registry.review({artifactId:a.id,reviewerRunId:reviewer.id,result:{artifactHash:a.payloadHash,purpose:a.payload.purpose,decision:'ACCEPT',
    checks:[{criterionId:'verify',verdict:'PASS',evidence:f.sources.map(source=>({kind:'source',id:source.id,hash:source.hash,quote:'count=17'})),reason:'Synthetic accepted-input fixture.'}],
    findings:[],uncertainty:'No live model or general quality qualification.'}});
  return a;
}

function batchRead(registry,options){
  assert.equal(typeof grantModule.readSourceManifestGrants,'function','The complete batch reader must exist');
  return grantModule.readSourceManifestGrants(registry,options);
}
function batchFixture(t,{accepted=true}={}){
  const f=setup(t,{secondSource:true}),a=accepted?acceptedInput(f):f.candidate();
  const actor=f.run(accepted?'producer':'reviewer',[a.id]);
  const grants=f.sources.map(s=>prepareSourceManifestGrant(f.registry,{runId:actor.id,sourceId:s.id,origin:{kind:'assigned-artifact',artifactId:a.id}}));
  const options={runId:actor.id,grantIds:grants.map(g=>g.grant.id)};
  return {...f,a,actor,grants,options,read:()=>batchRead(f.registry,options)};
}
function selectedBatchFixture(t){
  const f=batchFixture(t),views=f.grants.map(g=>prepareSourceWindowSelection(f.registry,{runId:f.actor.id,
    sourceId:g.source.sourceId,grantId:g.grant.id,ranges:[{startByte:0,maxBytes:128}]}));
  const options={runId:f.actor.id,selectionIds:views.map(v=>v.selection.id)};
  const read=()=>{assert.equal(typeof windowModule.readSourceWindowSelections,'function');return windowModule.readSourceWindowSelections(f.registry,options);};
  return {...f,views,selectionOptions:options,readSelections:read};
}
test('selection batch shares its fresh grants and common accepted parent without borrowing authority across calls',t=>{
  const f=selectedBatchFixture(t),original=f.registry.assertUsable;let calls=0;
  f.registry.assertUsable=function(...args){calls++;return original.apply(this,args);};
  const before=f.store.verifyJournal();assert.deepEqual(f.readSelections(),f.views);assert.equal(calls,1);
  assert.deepEqual(f.readSelections(),f.views);assert.equal(calls,2);assert.deepEqual(f.store.verifyJournal(),before);
  f.store.db.exec('BEGIN');try{
    assert.deepEqual(f.readSelections(),f.views);assert.equal(calls,3);
    revokeSourceManifestGrant(f.registry,f.grants[1].grant.id,{runId:f.actor.id,reason:'Same-transaction withdrawal.'});
    const revoked=f.store.verifyJournal();assert.throws(f.readSelections,{code:'SOURCE_GRANT_REVOKED'});assert.equal(f.store.db.isTransaction,true);assert.deepEqual(f.store.verifyJournal(),revoked);
  }finally{f.store.db.exec('ROLLBACK');}
  assert.deepEqual(f.readSelections(),f.views);assert.deepEqual(f.store.verifyJournal(),before);
});
test('selection batch cannot pair an otherwise valid grant with another selected source',t=>{
  const f=selectedBatchFixture(t);assert.deepEqual(f.readSelections(),f.views);
  const r=f.store.get('source-window-selection',f.views[0].selection.id),data={...r.data,grantRecord:f.grants[1].grant};
  const key='source-window-selection:'+sha256(data);f.store.put(r.type,key,data,{expectedVersion:0});
  f.selectionOptions.selectionIds=[f.views[1].selection.id,key];const before=f.store.verifyJournal();
  assert.throws(f.readSelections,{code:'SOURCE_GRANT_SCOPE'});assert.deepEqual(f.store.verifyJournal(),before);
});
test('selection batch rechecks parent claim expiry without any database mutation',t=>{
  const f=setup(t,{secondSource:true});let now='2026-09-13T05:00:00.000Z';f.registry.clock=()=>now;
  const a=acceptedInput(f,{validUntil:'2026-09-13T06:00:00.000Z'}),actor=f.run('producer',[a.id]);
  const views=f.sources.map(s=>{
    const g=prepareSourceManifestGrant(f.registry,{runId:actor.id,sourceId:s.id,origin:{kind:'assigned-artifact',artifactId:a.id}});
    return prepareSourceWindowSelection(f.registry,{runId:actor.id,sourceId:s.id,grantId:g.grant.id,ranges:[{startByte:0,maxBytes:128}]});
  });
  const read=()=>windowModule.readSourceWindowSelections(f.registry,{runId:actor.id,selectionIds:views.map(v=>v.selection.id)});
  assert.deepEqual(read(),views);const before=f.store.verifyJournal();now='2026-09-13T06:00:00.000Z';
  assert.throws(read,{code:'STALE_CLAIM'});assert.deepEqual(f.store.verifyJournal(),before);
});
test('selection batch integration preserves every quote while checking one shared parent per request-proof batch',t=>{
  const f=selectedBatchFixture(t),requestHash=f.registry.recordInferenceRequest(f.actor.id,{instructions:'Synthetic complete views.',
    input:JSON.stringify({documentSourceViews:f.views}),schema:{type:'object'}});f.complete(f.actor.id,requestHash);
  const quotes=[f.views[0],f.views[1],f.views[0]].map(v=>({selectionId:v.selection.id,windowHash:sha256(v.windows[0]),quote:'count=17'}));
  const expected=quotes.map(q=>sourceWindowRequestEvidence(f.registry,{runId:f.actor.id,requestHash,...q}));
  const original=f.registry.assertUsable;let calls=0;f.registry.assertUsable=function(...args){calls++;return original.apply(this,args);};
  const before=f.store.verifyJournal();assert.deepEqual(sourceWindowRequestEvidenceBatch(f.registry,{runId:f.actor.id,requestHash,quotes}),expected);
  assert.equal(calls,1);assert.deepEqual(f.store.verifyJournal(),before);
});
test('selection batch integration validates a shared parent once per grant set and once per window set in a frame',t=>{
  const f=selectedBatchFixture(t),workers=new WorkerService({store:f.store,authority:f.authority,registry:f.registry,
    broker:{executionAvailable:()=>false,searchAvailable:()=>false},providerFactory:()=>{throw Error('No model calls in preparation');}});
  const original=f.registry.assertUsable;let calls=0;f.registry.assertUsable=function(...args){calls++;return original.apply(this,args);};
  const input=workers.prepareDocumentInput({runId:f.actor.id,task:'Complete synthetic mandate and exact selected views.',
    grantIds:f.options.grantIds,selectionIds:f.selectionOptions.selectionIds});
  assert.equal(calls,2);assert.deepEqual(input.documentSourceViews,f.views);
  calls=0;const before=f.store.verifyJournal();
  assert.deepEqual(readDocumentContextFrame(f.registry,input.documentContextFrame.id,{runId:f.actor.id}),input);assert.equal(calls,2);
  assert.deepEqual(f.store.verifyJournal(),before);
});
test('manifest batch validates one common parent for distinct sources, but never reuses acceptance between calls',t=>{
  const f=batchFixture(t),original=f.registry.assertUsable,checks=[];
  f.registry.assertUsable=function(...args){checks.push(args);return original.apply(this,args);};
  const before=f.store.verifyJournal(),result=f.read();assert.deepEqual(result,f.grants);
  assert.deepEqual(checks,[[f.a.id,{missionId:'m',purpose:f.a.payload.purpose}]]);
  result[0].source.url='changed only in returned value';assert.deepEqual(f.read(),f.grants);assert.equal(checks.length,2);
  f.store.db.exec('BEGIN');try{assert.deepEqual(f.read(),f.grants);assert.equal(checks.length,3);assert.equal(f.store.db.isTransaction,true);}finally{f.store.db.exec('ROLLBACK');}
  assert.deepEqual(f.store.verifyJournal(),before);assert.equal(f.store.list('inference-request').length,0);
});
test('manifest batch checks separate parents separately even when the acquired sources are the same',t=>{
  const f=setup(t,{secondSource:true}),a=acceptedInput(f),b=acceptedInput(f),actor=f.run('producer',[a.id,b.id]);
  const grants=[a,b].map((parent,index)=>prepareSourceManifestGrant(f.registry,{runId:actor.id,sourceId:f.sources[index].id,origin:{kind:'assigned-artifact',artifactId:parent.id}}));
  const original=f.registry.assertUsable,checks=[];f.registry.assertUsable=function(...args){checks.push(args);return original.apply(this,args);};
  assert.deepEqual(batchRead(f.registry,{runId:actor.id,grantIds:grants.map(g=>g.grant.id)}),grants);
  assert.deepEqual(checks.map(c=>c[0]),[a.id,b.id]);
  const r=f.store.get('review',f.store.get('artifact',b.id).data.reviews.at(-1));
  f.store.put(r.type,r.id,{...r.data,result:{...r.data.result,decision:'RETURN'}},{expectedVersion:r.version});
  const before=f.store.verifyJournal(),read=()=>batchRead(f.registry,{runId:actor.id,grantIds:grants.map(g=>g.grant.id)});
  assert.throws(read,{code:'ACCEPTANCE_MISSING'});assert.throws(read,{code:'ACCEPTANCE_MISSING'});
  assert.deepEqual(checks.map(c=>c[0]),[a.id,b.id,a.id,b.id,a.id,b.id]);assert.deepEqual(f.store.verifyJournal(),before);
});
test('manifest batch rechecks current claim expiry on each call without requiring a storage mutation',t=>{
  const f=setup(t,{secondSource:true});let now='2026-09-13T05:00:00.000Z';f.registry.clock=()=>now;
  const a=acceptedInput(f,{validUntil:'2026-09-13T06:00:00.000Z'}),actor=f.run('producer',[a.id]);
  const grants=f.sources.map(s=>prepareSourceManifestGrant(f.registry,{runId:actor.id,sourceId:s.id,origin:{kind:'assigned-artifact',artifactId:a.id}}));
  const read=()=>batchRead(f.registry,{runId:actor.id,grantIds:grants.map(g=>g.grant.id)});
  assert.deepEqual(read(),grants);const before=f.store.verifyJournal();now='2026-09-13T06:00:00.000Z';
  assert.throws(read,{code:'STALE_CLAIM'});assert.deepEqual(f.store.verifyJournal(),before);
});
test('manifest batch does not require candidate acceptance for its assigned independent reviewer',t=>{
  const f=batchFixture(t,{accepted:false});let calls=0;const original=f.registry.assertUsable;
  f.registry.assertUsable=function(...args){calls++;return original.apply(this,args);};
  const before=f.store.verifyJournal();assert.deepEqual(f.read(),f.grants);assert.equal(calls,0);
  assert.equal(f.store.get('artifact',f.a.id).data.status,'CANDIDATE');assert.deepEqual(f.store.verifyJournal(),before);
});
for(const target of ['grant','review','source','parent','policy','historical','current'])test('manifest batch rechecks '+target+' withdrawal and cannot return a valid prefix',t=>{
  const f=batchFixture(t);assert.deepEqual(f.read(),f.grants);
  if(target==='grant')revokeSourceManifestGrant(f.registry,f.grants[1].grant.id,{runId:f.actor.id,reason:'Withdraw last member.'});
  else if(target==='review'){
    const r=f.store.get('review',f.store.get('artifact',f.a.id).data.reviews.at(-1));f.store.put(r.type,r.id,{...r.data,result:{...r.data.result,decision:'RETURN'}},{expectedVersion:r.version});
  }else if(target==='source'){
    f.registry.retractSource(f.sources[1].id,'Withdraw second source.');
    // Retraction also invalidates the common parent. The first grant therefore
    // fails parent scope; reading the withdrawn second source itself fails
    // source availability. Neither order is allowed to return a valid prefix.
    assert.equal(f.store.get('artifact',f.a.id).data.status,'INVALIDATED');
    assert.throws(()=>readSourceManifestGrant(f.registry,f.options.grantIds[0],{runId:f.actor.id}),{code:'SOURCE_GRANT_SCOPE'});
    assert.throws(()=>batchRead(f.registry,{...f.options,grantIds:[f.options.grantIds[1]]}),{code:'SOURCE_UNAVAILABLE'});
  }
  else if(target==='parent'){const r=f.store.get('artifact',f.a.id);f.store.put(r.type,r.id,{...r.data,status:'INVALIDATED'},{expectedVersion:r.version});}
  else if(target==='policy'){const r=f.store.get('mission','m');f.store.put(r.type,r.id,{...r.data,policy:{allowedTools:[]}},{expectedVersion:r.version});}
  else if(target==='current'){const r=f.store.get('run',f.actor.id);f.store.put(r.type,r.id,{...r.data,forbiddenArtifactIds:[f.a.id]},{expectedVersion:r.version});}
  else {
    const g=f.store.get('source-manifest-grant',f.grants[1].grant.id),foreign=f.run('producer');
    const r=f.store.get('run',foreign.id),data={...g.data,runRecord:{type:r.type,id:r.id,version:r.version,hash:r.hash}};
    const id='source-manifest-grant:'+sha256(data);f.store.put('source-manifest-grant',id,data,{expectedVersion:0});f.options.grantIds[1]=id;
  }
  const before=f.store.verifyJournal();let returned=false;
  assert.throws(()=>{f.read();returned=true;},{code:{grant:'SOURCE_GRANT_REVOKED',review:'ACCEPTANCE_MISSING',source:'SOURCE_GRANT_SCOPE',parent:'SOURCE_GRANT_SCOPE',policy:'SOURCE_GRANT_SCOPE',historical:'SOURCE_GRANT_INTEGRITY',current:'SOURCE_GRANT_SCOPE'}[target]});
  assert.equal(returned,false);assert.deepEqual(f.store.verifyJournal(),before);
});
test('manifest batch rejects late invalid IDs, duplicates, excess members and caller authority objects without running accessors',t=>{
  const f=batchFixture(t);assert.deepEqual(f.read(),f.grants);const before=f.store.verifyJournal();
  assert.throws(()=>batchRead(f.registry,{...f.options,grantIds:[f.options.grantIds[0],'source-manifest-grant:missing']}),{code:'SOURCE_GRANT_INTEGRITY'});
  for(const options of [{...f.options,grantIds:[f.options.grantIds[0],f.options.grantIds[0]]},{...f.options,grantIds:Array(65).fill(f.options.grantIds[0])},
    {...f.options,accepted:true},{...f.options,parents:{}},{...f.options,cache:[]}])assert.throws(()=>batchRead(f.registry,options),{code:'SCHEMA'});
  let calls=0;const options={runId:f.actor.id,get grantIds(){calls++;return f.options.grantIds;}};
  assert.throws(()=>batchRead(f.registry,options),{code:'SCHEMA'});assert.equal(calls,0);assert.deepEqual(f.store.verifyJournal(),before);
});
test('manifest batch authenticates an empty actor and preserves an external transaction across later withdrawal',t=>{
  const f=batchFixture(t);assert.deepEqual(batchRead(f.registry,{runId:f.actor.id,grantIds:[]}),[]);
  assert.throws(()=>batchRead(f.registry,{runId:'run:missing',grantIds:[]}),{code:'SOURCE_WINDOW_SCOPE'});
  f.store.db.exec('BEGIN');try{
    assert.deepEqual(f.read(),f.grants);revokeSourceManifestGrant(f.registry,f.grants[1].grant.id,{runId:f.actor.id,reason:'Same-transaction withdrawal.'});
    const before=f.store.verifyJournal();assert.throws(f.read,{code:'SOURCE_GRANT_REVOKED'});assert.deepEqual(f.store.verifyJournal(),before);assert.equal(f.store.db.isTransaction,true);
  }finally{f.store.db.exec('ROLLBACK');}
  assert.deepEqual(f.read(),f.grants);
});
test('manifest batch consumers validate one common parent during frame preparation and each later read',t=>{
  const f=batchFixture(t),workers=new WorkerService({store:f.store,authority:f.authority,registry:f.registry,
    broker:{executionAvailable:()=>false,searchAvailable:()=>false},providerFactory:()=>{throw Error('No model calls in preparation');}});
  let calls=0;const original=f.registry.assertUsable;
  f.registry.assertUsable=function(...args){calls++;return original.apply(this,args);};
  const input=workers.prepareDocumentInput({runId:f.actor.id,task:'Complete synthetic mandate, with no raw window selected.',grantIds:f.options.grantIds});
  assert.equal(calls,1);assert.deepEqual(input.documentSourceGrants,f.grants);assert.deepEqual(input.documentSourceViews,[]);
  calls=0;const before=f.store.verifyJournal();
  assert.deepEqual(readDocumentContextFrame(f.registry,input.documentContextFrame.id,{runId:f.actor.id}),input);assert.equal(calls,1);
  assert.deepEqual(f.store.verifyJournal(),before);assert.equal(f.store.list('inference-request').length,0);
  revokeSourceManifestGrant(f.registry,f.grants[1].grant.id,{runId:f.actor.id,reason:'Withdraw after the frame was prepared.'});
  const withdrawn=f.store.verifyJournal();
  assert.throws(()=>readDocumentContextFrame(f.registry,input.documentContextFrame.id,{runId:f.actor.id}),{code:'SOURCE_GRANT_REVOKED'});
  assert.deepEqual(f.store.verifyJournal(),withdrawn);
});

test('producer grant validates its same current parent once per read, never across reads or writes',t=>{
  const f=setup(t),a=acceptedInput(f),producer=f.run('producer',[a.id]),g=f.grant(producer,{kind:'assigned-artifact',artifactId:a.id});
  const original=f.registry.assertUsable,checks=[];
  f.registry.assertUsable=function(...args){checks.push(args);return original.apply(this,args);};
  const before=f.store.verifyJournal(),read=()=>readSourceManifestGrant(f.registry,g.grant.id,{runId:producer.id});
  assert.deepEqual(read(),g);assert.equal(checks.length,1);
  assert.deepEqual(checks[0],[a.id,{missionId:'m',purpose:a.payload.purpose}]);
  assert.deepEqual(read(),g);assert.equal(checks.length,2);assert.deepEqual(f.store.verifyJournal(),before);
  f.store.db.exec('BEGIN');
  try{assert.deepEqual(read(),g);assert.equal(checks.length,3);assert.equal(f.store.db.isTransaction,true);}finally{f.store.db.exec('ROLLBACK');}
  const r=f.store.get('review',f.store.get('artifact',a.id).data.reviews.at(-1));
  f.store.put(r.type,r.id,{...r.data,result:{...r.data.result,decision:'RETURN'}},{expectedVersion:r.version});
  const withdrawn=f.store.verifyJournal();assert.throws(read,{code:'ACCEPTANCE_MISSING'});assert.equal(checks.length,4);
  assert.deepEqual(f.store.verifyJournal(),withdrawn);assert.equal(f.store.get('artifact',a.id).data.status,'ACCEPTED');
});
test('selection preparation uses its exact freshly checked grant once without calling acceptance twice',t=>{
  const f=setup(t),a=acceptedInput(f),producer=f.run('producer',[a.id]),g=f.grant(producer,{kind:'assigned-artifact',artifactId:a.id});
  const original=f.registry.assertUsable;let count=0;
  f.registry.assertUsable=function(...args){count++;return original.apply(this,args);};
  const v=f.select(g);assert.equal(count,1);assert.deepEqual(v.grantRecord,g.grant);
  assert.equal(f.store.list('source-window-selection').length,1);assert.equal(f.store.list('inference-request').length,0);
  count=0;readSourceWindowSelection(f.registry,v.selection.id,{runId:g.runId});assert.equal(count,1,'A later read must revalidate acceptance');
});
for(const target of ['admitted','current'])test('producer grant checks '+target+' assignment before validating current acceptance',t=>{
  const f=setup(t),a=acceptedInput(f),producer=f.run('producer'),unassigned=f.store.get('run',producer.id);
  f.registry.updateContext(producer.id,{...unassigned.data.context,artifactIds:[a.id]});
  const g=f.grant(producer,{kind:'assigned-artifact',artifactId:a.id});let grantId=g.grant.id;
  if(target==='admitted'){
    // A correctly content-addressed but unauthorised historical binding must
    // fail membership, not rely on the later current actor being authorised.
    const d=f.store.get('source-manifest-grant',grantId).data;
    const data={...d,runRecord:{type:unassigned.type,id:unassigned.id,version:unassigned.version,hash:unassigned.hash}};
    grantId='source-manifest-grant:'+sha256(data);f.store.put('source-manifest-grant',grantId,data,{expectedVersion:0});
  }else {
    const r=f.store.get('run',producer.id);
    f.store.put(r.type,r.id,{...r.data,forbiddenArtifactIds:[a.id]},{expectedVersion:r.version});
  }
  let checks=0;const original=f.registry.assertUsable;
  f.registry.assertUsable=function(...args){checks++;return original.apply(this,args);};
  const before=f.store.verifyJournal();assert.throws(()=>readSourceManifestGrant(f.registry,grantId,{runId:producer.id}),{code:'SOURCE_GRANT_SCOPE'});
  assert.equal(checks,0);assert.deepEqual(f.store.verifyJournal(),before);
});

test('manifest grant is immutable, actor-bound and metadata-only; sourceIds and actor history stay exact',t=>{
  const f=setup(t),before=f.store.get('run',f.producer.id),g=f.grant();
  assert.equal(g.exposure,'METADATA_ONLY_NOT_RAW_DOCUMENT');assert.equal(g.source.raw,undefined);assert.ok(!JSON.stringify(g).includes('count=17'));
  assert.deepEqual(f.grant(),g);assert.deepEqual(f.store.get('run',f.producer.id),before);assert.equal(f.store.list('source-manifest-grant').length,1);
  assert.deepEqual(f.store.get('run',f.producer.id).data.context.sourceIds,[]);assert.equal(f.store.list('inference-request').length,0);
  const journal=f.store.verifyJournal();assert.deepEqual(readSourceManifestGrant(f.registry,g.grant.id,{runId:g.runId}),g);
  assert.deepEqual(f.store.verifyJournal(),journal);assert.equal(f.store.db.isTransaction,false);
});
test('assigned reviewer can obtain its own grant and observed window without receiving any full-raw sourceIds or producer observation',t=>{
  const f=setup(t),a=f.candidate(),reviewer=f.run('reviewer',[a.id]),before=f.store.get('run',reviewer.id),g=f.grant(reviewer,{kind:'assigned-artifact',artifactId:a.id});
  assert.deepEqual(f.store.get('run',reviewer.id),before);assert.equal(before.data.toolObservations,undefined);
  const view=f.select(g);assert.deepEqual(view.grantRecord,g.grant);const hash=f.dispatch(view);
  assert.throws(()=>f.proof(view,hash),{code:'SOURCE_WINDOW_UNOBSERVED'});f.complete(view.runId,hash);
  const proof=f.proof(view,hash);assert.equal(proof.inference.simulation,true);assert.equal(proof.runId,reviewer.id);
  assert.deepEqual(f.store.get('run',reviewer.id).data.context.sourceIds,[]);assert.equal(f.store.get('run',reviewer.id).data.toolObservations,undefined);
  assert.equal(f.store.get('artifact',a.id).data.status,'CANDIDATE');assert.equal(f.store.list('review').length,0);
});
test('grant does not launder a legacy source-based candidate into acceptance',t=>{
  const f=setup(t),g=f.grant(),v=f.select(g),hash=f.dispatch(v);f.complete(v.runId,hash);
  assert.equal(f.proof(v,hash).quote.text,'count=17');
  const create=()=>f.registry.create({missionId:'m',nodeId:'n',producerRunId:f.producer.id,kind:'report',purpose:'source-check',body:'Must not pass legacy raw-source proof.',
    claims:[{id:'c',text:'count=17',kind:'fact',sources:[{sourceId:f.source.id,hash:f.source.hash,quote:'count=17'}],basis:[],qualifiers:[],validUntil:null}],criteria:[{id:'v',text:'Verify.'}]});
  // The explicit documentary boundary now rejects before the legacy source
  // check. Both remain enforced; grants never populate full-raw sourceIds.
  const before=f.store.verifyJournal();assert.throws(create,{code:'DOCUMENT_FRAME_NOT_INTEGRATED'});assert.deepEqual(f.store.verifyJournal(),before);
  const legacyHash=f.registry.recordInferenceRequest(f.producer.id,{instructions:'Synthetic fixture.',input:'Legacy fixture without raw admission.',schema:{type:'object'}});
  f.complete(f.producer.id,legacyHash);assert.throws(create,{code:'UNOBSERVED_SOURCE'});
  assert.deepEqual(f.store.get('run',f.producer.id).data.context.sourceIds,[]);assert.equal(f.store.list('artifact').length,0);
});
test('a mission source or an unassigned or undeclared artifact is not an actor grant',t=>{
  const f=setup(t),other=f.run(),a=f.candidate();
  assert.throws(()=>f.grant(other),{code:'SOURCE_WINDOW_SCOPE'});
  assert.throws(()=>f.grant(other,{kind:'assigned-artifact',artifactId:a.id}),{code:'SOURCE_GRANT_SCOPE'});
  const reviewer=f.run('reviewer',[a.id]);
  const r=f.store.get('artifact',a.id),payload={...r.data.payload,claims:[]};
  f.store.put(r.type,r.id,{...r.data,payload,payloadHash:sha256(payload)},{expectedVersion:r.version});
  assert.throws(()=>f.grant(reviewer,{kind:'assigned-artifact',artifactId:a.id}),{code:'SOURCE_GRANT_SCOPE'});
});
test('producer cannot derive access from an unaccepted input; reviewer cannot derive it from an invalidated one',t=>{
  const f=setup(t),a=f.candidate(),producer=f.run('producer',[a.id]),reviewer=f.run('reviewer',[a.id]);
  assert.throws(()=>f.grant(producer,{kind:'assigned-artifact',artifactId:a.id}),{code:'SOURCE_GRANT_SCOPE'});
  const g=f.grant(reviewer,{kind:'assigned-artifact',artifactId:a.id}),r=f.store.get('artifact',a.id);
  f.store.put(r.type,r.id,{...r.data,status:'INVALIDATED'},{expectedVersion:r.version});
  assert.throws(()=>readSourceManifestGrant(f.registry,g.grant.id,{runId:g.runId}),{code:'SOURCE_GRANT_SCOPE'});
});
test('accepted assigned input grants a new producer snapshot access, not the previous actors reading or acceptance',t=>{
  const f=setup(t),a=f.candidate(),reviewer=f.run('reviewer',[a.id],[f.source.id]);
  f.registry.attachInference(reviewer.id,{status:'completed',simulation:true,threadId:id('synthetic-thread'),turnId:'synthetic-turn'});
  f.registry.review({artifactId:a.id,reviewerRunId:reviewer.id,result:{artifactHash:a.payloadHash,purpose:a.payload.purpose,decision:'ACCEPT',
    checks:[{criterionId:'verify',verdict:'PASS',evidence:[{kind:'source',id:f.source.id,hash:f.source.hash,quote:'count=17'}],reason:'Synthetic exact-source check only.'}],
    findings:[],uncertainty:'Synthetic upstream acceptance, not a live qualification.'}});
  const producer=f.run('producer',[a.id]),g=f.grant(producer,{kind:'assigned-artifact',artifactId:a.id}),v=f.select(g);
  assert.deepEqual(f.store.get('run',producer.id).data.context.sourceIds,[]);
  assert.throws(()=>f.proof(v,sha256('not-observed')),{code:'SOURCE_WINDOW_UNOBSERVED'});
  const hash=f.dispatch(v);f.complete(v.runId,hash);assert.equal(f.proof(v,hash).runId,producer.id);
  const r=f.store.get('artifact',a.id);f.store.put(r.type,r.id,{...r.data,status:'INVALIDATED'},{expectedVersion:r.version});
  assert.throws(()=>f.proof(v,hash),{code:'SOURCE_GRANT_SCOPE'});
});
for(const target of ['parent','review','source','grant'])test('source-window proof batch revalidates assigned producer ancestry after '+target+' withdrawal',t=>{
  const f=setup(t),a=f.candidate(),reviewer=f.run('reviewer',[a.id],[f.source.id]);
  f.registry.attachInference(reviewer.id,{status:'completed',simulation:true,threadId:id('synthetic-thread'),turnId:'synthetic-turn'});
  f.registry.review({artifactId:a.id,reviewerRunId:reviewer.id,result:{artifactHash:a.payloadHash,purpose:a.payload.purpose,decision:'ACCEPT',
    checks:[{criterionId:'verify',verdict:'PASS',evidence:[{kind:'source',id:f.source.id,hash:f.source.hash,quote:'count=17'}],reason:'Synthetic ancestry fixture.'}],
    findings:[],uncertainty:'No live-model qualification.'}});
  const producer=f.run('producer',[a.id]),g=f.grant(producer,{kind:'assigned-artifact',artifactId:a.id}),v=f.select(g),hash=f.dispatch(v);
  f.complete(v.runId,hash);
  const queries=Array.from({length:4},()=>({selectionId:v.selection.id,windowHash:sha256(v.windows[0]),quote:'count=17'}));
  const read=()=>sourceWindowRequestEvidenceBatch(f.registry,{runId:v.runId,requestHash:hash,quotes:queries});
  assert.deepEqual(read(),queries.map(()=>f.proof(v,hash)));
  if(target==='parent'){
    const r=f.store.get('artifact',a.id);f.store.put(r.type,r.id,{...r.data,status:'INVALIDATED'},{expectedVersion:r.version});
  }else if(target==='review'){
    const r=f.store.get('review',f.store.get('artifact',a.id).data.reviews.at(-1));
    f.store.put(r.type,r.id,{...r.data,result:{...r.data.result,decision:'RETURN'}},{expectedVersion:r.version});
  }else if(target==='source')f.registry.retractSource(f.source.id,'Synthetic source withdrawal after first batch.');
  else revokeSourceManifestGrant(f.registry,g.grant.id,{runId:v.runId,reason:'Synthetic grant withdrawal after first batch.'});
  const before=f.store.verifyJournal();
  assert.throws(read,{code:{parent:'SOURCE_GRANT_SCOPE',review:'ACCEPTANCE_MISSING',source:'SOURCE_UNAVAILABLE',grant:'SOURCE_GRANT_REVOKED'}[target]});
  assert.deepEqual(f.store.verifyJournal(),before);
});
test('reviewer grant survives candidate RETURNED status without treating it as accepted producer input',t=>{
  const f=setup(t),a=f.candidate(),reviewer=f.run('reviewer',[a.id]),g=f.grant(reviewer,{kind:'assigned-artifact',artifactId:a.id});
  const r=f.store.get('artifact',a.id);f.store.put(r.type,r.id,{...r.data,status:'RETURNED'},{expectedVersion:r.version});
  assert.deepEqual(readSourceManifestGrant(f.registry,g.grant.id,{runId:g.runId}),g);
  assert.throws(()=>f.grant(f.run('producer',[a.id]),{kind:'assigned-artifact',artifactId:a.id}),{code:'SOURCE_GRANT_SCOPE'});
});
test('revoked assigned-artifact grant cannot be bypassed by omitting it on a manifest-only reviewer',t=>{
  const f=setup(t),a=f.candidate(),reviewer=f.run('reviewer',[a.id]),g=f.grant(reviewer,{kind:'assigned-artifact',artifactId:a.id});
  revokeSourceManifestGrant(f.registry,g.grant.id,{runId:g.runId,reason:'Revoke this grant.'});
  assert.throws(()=>prepareSourceWindowSelection(f.registry,{runId:g.runId,sourceId:f.source.id,ranges:[{startByte:0,maxBytes:24}]}),{code:'SOURCE_WINDOW_SCOPE'});
  assert.throws(()=>f.grant(reviewer,{kind:'assigned-artifact',artifactId:a.id}),{code:'SOURCE_GRANT_REVOKED'});
});
test('foreign actor, source, missing grant and wrong grant cannot select a window',t=>{
  const f=setup(t),g=f.grant(),other=f.run();
  assert.throws(()=>readSourceManifestGrant(f.registry,g.grant.id,{runId:other.id}),{code:'SOURCE_GRANT_SCOPE'});
  assert.throws(()=>prepareSourceWindowSelection(f.registry,{runId:other.id,sourceId:f.source.id,grantId:g.grant.id,ranges:[{startByte:0,maxBytes:24}]}),{code:'SOURCE_GRANT_SCOPE'});
  assert.throws(()=>f.select({...g,grant:{id:'source-manifest-grant:missing'}}),{code:'SOURCE_GRANT_INTEGRITY'});
  const r=f.store.get('source',f.source.id);f.store.put(r.type,r.id,{...r.data,missionId:'foreign'},{expectedVersion:r.version});
  assert.throws(()=>f.select(g),{code:'SOURCE_UNAVAILABLE'});
});
test('grant revocation blocks historical selection and completed citation without erasing either',t=>{
  const f=setup(t),g=f.grant(),v=f.select(g),hash=f.dispatch(v);f.complete(v.runId,hash);
  const runs=f.store.list('run'),views=f.store.list('source-window-selection'),requests=f.store.list('inference-request');
  const options={runId:g.runId,reason:'Synthetic grant revoked.'},r=revokeSourceManifestGrant(f.registry,g.grant.id,options);
  assert.deepEqual(revokeSourceManifestGrant(f.registry,g.grant.id,options),r);
  assert.throws(()=>readSourceWindowSelection(f.registry,v.selection.id,{runId:g.runId}),{code:'SOURCE_GRANT_REVOKED'});
  assert.throws(()=>f.proof(v,hash),{code:'SOURCE_GRANT_REVOKED'});
  assert.deepEqual(f.store.list('run'),runs);assert.deepEqual(f.store.list('source-window-selection'),views);assert.deepEqual(f.store.list('inference-request'),requests);
});
test('revocation while a request is pending prevents subsequent completed citation',t=>{
  const f=setup(t),g=f.grant(),v=f.select(g),hash=f.dispatch(v);
  assert.throws(()=>f.grant(),{code:'INFERENCE_PENDING'});
  revokeSourceManifestGrant(f.registry,g.grant.id,{runId:g.runId,reason:'Cancel this access before completion.'});
  f.complete(v.runId,hash);assert.throws(()=>f.proof(v,hash),{code:'SOURCE_GRANT_REVOKED'});
});
test('source retraction remains stronger than the manifest grant and retained completed input',t=>{
  const f=setup(t),g=f.grant(),v=f.select(g),hash=f.dispatch(v);f.complete(v.runId,hash);
  f.registry.retractSource(f.source.id,'Correct the underlying evidence.');
  assert.throws(()=>f.proof(v,hash),{code:'SOURCE_UNAVAILABLE'});
});
test('grant re-versioning and mission policy drift fail without moving sourceIds',t=>{
  for(const kind of ['grant','policy']){
    const f=setup(t),g=f.grant();
    const r=kind==='grant'?f.store.get('source-manifest-grant',g.grant.id):f.store.get('mission','m');
    f.store.put(r.type,r.id,kind==='grant'?r.data:{...r.data,policy:{allowedTools:[]}},{expectedVersion:r.version});
    assert.throws(()=>readSourceManifestGrant(f.registry,g.grant.id,{runId:g.runId}),{code:kind==='grant'?'SOURCE_GRANT_INTEGRITY':'SOURCE_GRANT_SCOPE'});
    assert.deepEqual(f.store.get('run',g.runId).data.context.sourceIds,[]);
  }
});
test('closed, blind, native execution and forbidden artifact scopes do not gain documentary access',t=>{
  for(const scope of ['closed','blind','native','forbidden']){
    const f=setup(t),a=f.candidate(),actor=f.run('reviewer',[a.id]),r=f.store.get('run',actor.id);
    if(scope==='native')f.store.put('node','m:n',{missionId:'m',nodeId:'n',spec:{execution:{kind:'literal-input-copy-v1'}}},{expectedVersion:0});
    else {
      const context=scope==='blind'?{...r.data.context,purpose:'closed-blind-comparison'}:r.data.context;
      f.store.put(r.type,r.id,{...r.data,context,contextHash:sha256(context),...(scope==='closed'?{nodeId:'review:closed-entry'}:{}),
        ...(scope==='forbidden'?{forbiddenArtifactIds:[a.id]}:{})},{expectedVersion:r.version});
    }
    assert.throws(()=>f.grant(actor,{kind:'assigned-artifact',artifactId:a.id}),{code:scope==='forbidden'?'SOURCE_GRANT_SCOPE':'SOURCE_WINDOW_SCOPE'});
  }
});
test('uncommitted acquisition and altered actor relation cannot create a manifest grant',t=>{
  const f=setup(t),r=f.store.get('run',f.producer.id),observations=structuredClone(r.data.toolObservations);
  observations[0].relation='EXTERNAL_OBSERVATION';
  f.store.put(r.type,r.id,{...r.data,toolObservations:observations},{expectedVersion:r.version});
  assert.throws(()=>f.grant(),{code:'SOURCE_WINDOW_SCOPE'});
  const signed=f.authority.seal('tool.receipt',{...f.signed.data,id:'operation:uncommitted'}),source=f.registry.ingestSource(signed);
  assert.throws(()=>prepareSourceManifestGrant(f.registry,{runId:f.producer.id,sourceId:source.id,origin:{kind:'observed-acquisition'}}),{code:'SOURCE_WINDOW_ACQUISITION'});
});
