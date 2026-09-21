// Independent API-level review. Inference receipts are explicit synthetic fixtures;
// HTTP transport is fake, but broker signing, registry, SQLite and FS effects are real.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {Store} from '../../factory/lib/store.mjs';
import {Authority} from '../../factory/lib/authority.mjs';
import {ArtifactRegistry} from '../../factory/lib/artifacts.mjs';
import {ToolBroker} from '../../factory/tools/broker.mjs';
import {canonical,sha256} from '../../factory/lib/contracts.mjs';

function setup(t,{httpStatus=200}={}) {
  const temp=fs.mkdtempSync(join(tmpdir(),'factory-adversarial-core-'));
  let now=Date.now(), sequence=0, networkCalls=0;
  const clock=()=>new Date(now).toISOString();
  const store=new Store(':memory:',{clock});
  const authority=new Authority(store,{clock});
  const registry=new ArtifactRegistry(store,authority,{clock});
  const broker=new ToolBroker({store,authority,clock,workspaceRoot:join(temp,'jobs'),lookup:async()=>[{address:'8.8.8.8',family:4}],transport:async({address})=>{
    networkCalls++;return {remoteAddress:address,statusCode:httpStatus,headers:{'content-type':'text/plain; charset=utf-8'},body:Buffer.from('Observed service status: PASS.\n')};
  }});
  const workspace=broker.registerWorkspace('mission');
  const lease=principalId=>authority.issue({missionId:'mission',principalId,actions:['source.fetch','workspace.write','workspace.read'],resources:['public-web','workspace:mission'],classification:'INTERNAL',expiresAt:new Date(now+60000).toISOString()});
  const source=async()=>{
    const principalId='collector', operationId='fetch:'+ ++sequence;
    const receipt=await broker.execute({missionId:'mission',principalId,lease:lease(principalId),operationId,tool:'source.fetch',args:{url:'https://example.com/evidence'}});
    return {source:registry.ingestSource(receipt),receipt};
  };
  const run=({mode='producer',artifactIds=[],sourceIds=[],threadId=null}={})=>{
    const n=++sequence;
    const r=registry.registerRun({missionId:'mission',nodeId:'node:'+n,mode,context:{purpose:'Evaluate exact obligation',artifactIds,sourceIds,instructionsHash:sha256('fixture instructions'),producerConversationIncluded:false}});
    registry.attachInference(r.id,{status:'completed',threadId:threadId??'fixture-thread:'+n,turnId:'fixture-turn:'+n});
    return r;
  };
  const artifact=(r,options={})=>registry.create({missionId:'mission',nodeId:r.nodeId,producerRunId:r.id,kind:'analysis',purpose:'decision-support',body:'Candidate conclusion.',criteria:[{id:'criterion1',text:'Provide exact supporting evidence'}],...options});
  const evidence=a=>({kind:'artifact',id:a.id,hash:a.payloadHash,quote:a.payload.body});
  const sourceEvidence=s=>({kind:'source',id:s.id,hash:s.hash,quote:'Observed service status: PASS.'});
  const review=(a,r,proof,options={})=>registry.review({artifactId:a.id,reviewerRunId:r.id,result:{artifactHash:a.payloadHash,purpose:a.payload.purpose,decision:'ACCEPT',checks:a.payload.criteria.map(c=>({criterionId:c.id,verdict:'PASS',evidence:[proof],reason:'Fixture observes the required exact evidence.'})),findings:[],uncertainty:'Fixture, not a model quality evaluation.',...options}});
  const accept=a=>review(a,run({mode:'reviewer',artifactIds:[a.id],sourceIds:[...new Set(a.payload.claims.flatMap(c=>c.sources.map(ref=>ref.sourceId)))]}),evidence(a));
  const claim=s=>({id:'claim1',text:'Observed service status is PASS.',kind:'fact',sources:[{sourceId:s.id,hash:s.hash,quote:'Observed service status: PASS.'}],basis:[],qualifiers:[],validUntil:null});
  t.after(()=>{store.close();fs.rmSync(temp,{recursive:true,force:true});});
  return {store,authority,registry,broker,workspace,lease,source,run,artifact,evidence,sourceEvidence,review,accept,claim,clock,advance:ms=>{now+=ms;},networkCalls:()=>networkCalls};
}

test('AC01: producer cannot cite acquired source absent from its observed context',async t=>{
  const s=setup(t), {source}=await s.source();
  const producer=s.run({sourceIds:[]});
  assert.throws(()=>s.artifact(producer,{claims:[s.claim(source)]}), 'Unobserved raw source must not become producer evidence');
});

test('AC02: reviewer cannot cite a source absent from its own observed context',async t=>{
  const s=setup(t), {source}=await s.source();
  const a=s.artifact(s.run());
  const reviewer=s.run({mode:'reviewer',artifactIds:[a.id],sourceIds:[]});
  assert.throws(()=>s.review(a,reviewer,s.sourceEvidence(source)), 'A real source exists, but this reviewer never received it');
});

test('AC03: invalidated artifact cannot serve as external acceptance evidence',t=>{
  const s=setup(t), foundation=s.artifact(s.run(),{body:'Prior proof.'});
  s.accept(foundation);s.registry.invalidate([foundation.id],{kind:'confirmed-error'});
  const a=s.artifact(s.run());
  const reviewer=s.run({mode:'reviewer',artifactIds:[a.id,foundation.id]});
  assert.throws(()=>s.review(a,reviewer,s.evidence(foundation)), 'Invalidated proof is not an accepted foundation');
});

test('AC04: retracting a source used only by acceptance review invalidates dependent acceptance',async t=>{
  const s=setup(t), {source}=await s.source();
  const a=s.artifact(s.run());
  s.review(a,s.run({mode:'reviewer',artifactIds:[a.id],sourceIds:[source.id]}),s.sourceEvidence(source));
  s.registry.assertUsable(a.id,{missionId:'mission',purpose:'decision-support'});
  s.registry.retractSource(source.id,'Observed source withdrawn');
  assert.throws(()=>s.registry.assertUsable(a.id,{missionId:'mission',purpose:'decision-support'}), 'Review evidence must remain a live dependency after acceptance');
});

test('AC05: invalidation propagates through external artifact proof in a review',t=>{
  const s=setup(t), foundation=s.artifact(s.run(),{body:'Accepted independent proof.'});s.accept(foundation);
  const a=s.artifact(s.run());
  s.review(a,s.run({mode:'reviewer',artifactIds:[a.id,foundation.id]}),s.evidence(foundation));
  s.registry.invalidate([foundation.id],{kind:'foundation-retracted'});
  assert.throws(()=>s.registry.assertUsable(a.id,{missionId:'mission',purpose:'decision-support'}), 'Review proof is not exempt from transitive invalidation');
});

test('AC06: provisional external proof cannot authorize acceptance of a nonprovisional target',t=>{
  const s=setup(t), hypothesis=s.artifact(s.run(),{provisional:true,body:'Exploratory only.'});
  const a=s.artifact(s.run());
  const reviewer=s.run({mode:'reviewer',artifactIds:[a.id,hypothesis.id]});
  assert.throws(()=>s.review(a,reviewer,s.evidence(hypothesis)), 'Provisional evidence must not be laundered by the review channel');
});

test('AC07: source admission retains actual HTTP error status independently of admission status',async t=>{
  const s=setup(t,{httpStatus:404}), {source,receipt}=await s.source();
  assert.equal(receipt.data.result.status,404);
  assert.equal(source.httpStatus,404,'A 404 document is acquired evidence, not an unlabelled successful representation');
  assert.equal(source.url,'https://example.com/evidence');
});

test('AC08: rejected async transaction callback must not later commit work outside the transaction',async t=>{
  const s=setup(t);
  assert.throws(()=>s.store.transact(async()=>{await Promise.resolve();s.store.put('probe','escaped',{value:1},{expectedVersion:0});}),{code:'ASYNC_TRANSACTION'});
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(s.store.get('probe','escaped'),null,'Reject before executing async callback, not after it already scheduled work');
});

test('AC09: canonicalization rejects sparse arrays disguised with named properties',()=>{
  const malicious=[];malicious.length=1;malicious.extra='hidden';
  assert.throws(()=>canonical(malicious), 'A missing index plus extra key must not silently serialize as an empty array');
});

test('AC10: factual acceptance requires delivered raw sources even when reviewer quotes only the candidate',async t=>{
  const s=setup(t), {source}=await s.source();
  const a=s.artifact(s.run({sourceIds:[source.id]}),{claims:[s.claim(source)]});
  const reviewer=s.run({mode:'reviewer',artifactIds:[a.id],sourceIds:[]});
  assert.throws(()=>s.review(a,reviewer,s.evidence(a)), 'Reading the producer conclusion cannot replace observation of its cited raw support');
});

test('AC11: ordinary callback returning a promise cannot leak a late write after rejection',async t=>{
  const s=setup(t);let pending;
  assert.throws(()=>s.store.transact(()=>{
    pending=Promise.resolve().then(()=>s.store.put('probe','late-promise',{value:1},{expectedVersion:0}));
    return pending;
  }),{code:'ASYNC_TRANSACTION'});
  await pending.catch(()=>{});
  assert.equal(s.store.get('probe','late-promise'),null,'Promise-returning callbacks need scope invalidation, not just AsyncFunction detection');
});

test('control: forged and missing receipt authority cannot admit source evidence',async t=>{
  const s=setup(t), {receipt}=await s.source();
  const forged=structuredClone(receipt);forged.data.result.content='forged';forged.data.result.sha256=sha256('forged');
  assert.throws(()=>s.registry.ingestSource(forged),{code:'BAD_SIGNATURE'});
  assert.throws(()=>s.registry.ingestSource(receipt.data));
});

test('control: every frozen criterion is checked and material failures cannot be waived',t=>{
  const s=setup(t), a=s.artifact(s.run(),{criteria:[{id:'criterion1',text:'First'},{id:'criterion2',text:'Second'}]});
  const reviewer=s.run({mode:'reviewer',artifactIds:[a.id]});
  assert.throws(()=>s.review(a,reviewer,s.evidence(a),{checks:[{criterionId:'criterion1',verdict:'PASS',evidence:[s.evidence(a)],reason:'Only one criterion'}]}),{code:'REVIEW_COVERAGE'});
  assert.throws(()=>s.review(a,reviewer,s.evidence(a),{findings:[{severity:'material',description:'Critical unmet obligation',recovery:'Correct and retest'}]}),{code:'FAILED_GATE'});
  assert.equal(s.store.get('artifact',a.id).data.status,'CANDIDATE');
});

test('control: same producer thread cannot independently certify and provisional target is not accepted',t=>{
  const s=setup(t), producer=s.run({threadId:'same-thread'}), a=s.artifact(producer);
  const reviewer=s.run({mode:'reviewer',artifactIds:[a.id],threadId:'same-thread'});
  assert.throws(()=>s.review(a,reviewer,s.evidence(a)),{code:'SELF_CERTIFICATION'});
  const p=s.artifact(s.run(),{provisional:true});
  assert.throws(()=>s.accept(p),{code:'PROVISIONAL'});
});

test('control: accepted factual source and input dependencies invalidate transitively',async t=>{
  const s=setup(t), {source}=await s.source();
  const parent=s.artifact(s.run({sourceIds:[source.id]}),{claims:[s.claim(source)]});
  s.review(parent,s.run({mode:'reviewer',artifactIds:[parent.id],sourceIds:[source.id]}),s.sourceEvidence(source));
  const child=s.artifact(s.run({artifactIds:[parent.id]}),{inputRefs:[{artifactId:parent.id,hash:parent.payloadHash,purpose:parent.payload.purpose}]});s.accept(child);
  const unaffected=s.artifact(s.run());s.accept(unaffected);
  s.registry.retractSource(source.id,'Root corrected');
  assert.throws(()=>s.registry.assertUsable(child.id,{missionId:'mission',purpose:'decision-support'}),{code:'UNACCEPTED_INPUT'});
  assert.equal(s.registry.assertUsable(unaffected.id,{missionId:'mission',purpose:'decision-support'}).status,'ACCEPTED');
});

test('control: stale claim validity and stale store CAS cannot remain accepted',async t=>{
  const s=setup(t), {source}=await s.source();
  const c={...s.claim(source),validUntil:new Date(Date.parse(s.clock())+1000).toISOString()};
  const a=s.artifact(s.run({sourceIds:[source.id]}),{claims:[c]});
  s.review(a,s.run({mode:'reviewer',artifactIds:[a.id],sourceIds:[source.id]}),s.sourceEvidence(source));s.advance(1001);
  assert.throws(()=>s.registry.assertUsable(a.id,{missionId:'mission',purpose:'decision-support'}),{code:'STALE_CLAIM'});
  s.store.put('probe','cas',{value:1},{expectedVersion:0});
  assert.throws(()=>s.store.put('probe','cas',{value:2},{expectedVersion:0}),{code:'VERSION_CONFLICT'});
  assert.equal(s.store.get('probe','cas').data.value,1);
});

test('control: actual broker file effect binds to producer run and replays receipt without repeating write',async t=>{
  const s=setup(t), producer=s.run(), req={missionId:'mission',principalId:producer.id,lease:s.lease(producer.id),operationId:'write:stable',tool:'workspace.write',args:{path:'output.txt',content:'actual file',expectedHash:null}};
  const receipt=await s.broker.execute(req);
  assert.equal(fs.readFileSync(join(s.workspace.path,'output.txt'),'utf8'),'actual file');
  s.registry.recordToolObservation(producer.id,receipt);
  s.registry.attachInference(producer.id,{status:'completed',threadId:'after-write',turnId:'after-write'});
  const a=s.artifact(producer,{toolReceipts:[receipt]});assert.equal(a.payload.toolReceipts[0].data.principalId,producer.id);
  const other=s.run();assert.throws(()=>s.artifact(other,{toolReceipts:[receipt]}),{code:'TOOL_RECEIPT'});
  assert.deepEqual(await s.broker.execute(req),receipt);
  const changed={...req,args:{...req.args,content:'different'}};
  await assert.rejects(s.broker.execute(changed),{code:'IDEMPOTENCY_CONFLICT'});
  assert.equal(fs.readFileSync(join(s.workspace.path,'output.txt'),'utf8'),'actual file');
});

test('observations: real read supports independent acceptance only after delivery and new inference',async t=>{
  const s=setup(t), producer=s.run();
  const write=await s.broker.execute({missionId:'mission',principalId:producer.id,lease:s.lease(producer.id),operationId:'write-observed',tool:'workspace.write',args:{path:'proof.txt',content:'exact state',expectedHash:null}});
  assert.throws(()=>s.artifact(producer,{toolReceipts:[write]}),{code:'UNOBSERVED_TOOL'});
  s.registry.recordToolObservation(producer.id,write);
  assert.throws(()=>s.artifact(producer,{toolReceipts:[write]}),{code:'UNOBSERVED_CONTEXT'});
  s.registry.attachInference(producer.id,{status:'completed',threadId:'producer-after-effect',turnId:'turn'});
  const a=s.artifact(producer,{toolReceipts:[write]}), reviewer=s.run({mode:'reviewer',artifactIds:[a.id]});
  const read=await s.broker.execute({missionId:'mission',principalId:reviewer.id,lease:s.lease(reviewer.id),operationId:'read-observed',tool:'workspace.read',args:{path:'proof.txt'}});
  const proof={kind:'tool',id:read.data.id,hash:sha256(read),quote:'exact state'};
  assert.throws(()=>s.review(a,reviewer,proof),{code:'UNOBSERVED_TOOL'});
  s.registry.recordToolObservation(reviewer.id,read);
  assert.throws(()=>s.review(a,reviewer,proof),{code:'UNOBSERVED_CONTEXT'});
  s.registry.attachInference(reviewer.id,{status:'completed',threadId:'reviewer-after-read',turnId:'turn'});
  assert.equal(s.registry.getToolObservations(reviewer.id)[0].quoteText,canonical(read.data.result));
  assert.equal(s.review(a,reviewer,proof).status,'ACCEPTED');
  assert.equal(s.registry.assertUsable(a.id,{missionId:'mission',purpose:a.payload.purpose}).status,'ACCEPTED');
});

test('observations: signatures, durable receipt binding and foreign actors cannot be laundered',async t=>{
  const s=setup(t), {receipt}=await s.source(), r=s.run();
  assert.throws(()=>s.registry.recordToolObservation(r.id,{...receipt,signature:'fake'}));
  const invented=s.authority.seal('tool.receipt',{...receipt.data,id:'uncommitted'});
  assert.throws(()=>s.registry.recordToolObservation(r.id,invented),{code:'TOOL_RECEIPT'});
  const observed=s.registry.recordToolObservation(r.id,receipt);
  assert.equal(observed.relation,'EXTERNAL_OBSERVATION');assert.equal(observed.principalId,'collector');
  assert.deepEqual(s.registry.recordToolObservation(r.id,receipt),observed);
  s.registry.attachInference(r.id,{status:'completed',threadId:'external-observed',turnId:'turn'});
  assert.throws(()=>s.artifact(r,{toolReceipts:[receipt]}),{code:'TOOL_RECEIPT'});
});

test('multi-inference: request hash, exposure erasure and all historical producer threads are guarded',t=>{
  const s=setup(t), producer=s.run({threadId:'old-producer'});
  const hash=s.registry.recordInferenceRequest(producer.id,{instructions:'Scoped',input:'Data',schema:{type:'object'}});
  assert.throws(()=>s.registry.attachInference(producer.id,{status:'completed',threadId:'new-producer',turnId:'turn',contextHash:sha256('wrong')}),{code:'INFERENCE_CONTEXT'});
  s.registry.attachInference(producer.id,{status:'completed',threadId:'new-producer',turnId:'turn',contextHash:hash});
  const a=s.artifact(producer), reviewer=s.run({mode:'reviewer',artifactIds:[a.id],threadId:'old-producer'});
  s.registry.attachInference(reviewer.id,{status:'completed',threadId:'apparently-clean',turnId:'turn'});
  assert.throws(()=>s.review(a,reviewer,s.evidence(a)),{code:'SELF_CERTIFICATION'});
  assert.throws(()=>s.registry.updateContext(reviewer.id,{...reviewer.context,artifactIds:[]}),{code:'CONTEXT_ERASURE'});
});

test('observations: historical read before candidate cannot certify current state even with equal timestamps',async t=>{
  const s=setup(t), producer=s.run(), reviewer=s.run({mode:'reviewer'});
  await s.broker.execute({missionId:'mission',principalId:producer.id,lease:s.lease(producer.id),operationId:'historical-write',tool:'workspace.write',args:{path:'old.txt',content:'old',expectedHash:null}});
  const read=await s.broker.execute({missionId:'mission',principalId:reviewer.id,lease:s.lease(reviewer.id),operationId:'historical-read',tool:'workspace.read',args:{path:'old.txt'}});
  const a=s.artifact(producer);
  s.registry.updateContext(reviewer.id,{...reviewer.context,artifactIds:[a.id]});
  s.registry.recordToolObservation(reviewer.id,read);
  s.registry.attachInference(reviewer.id,{status:'completed',threadId:'historical-review',turnId:'turn'});
  assert.throws(()=>s.review(a,reviewer,{kind:'tool',id:read.data.id,hash:sha256(read),quote:'old'}),{code:'STALE_TOOL'});
});

test('observations: independent read rejects changed written bytes and foreign read ownership',async t=>{
  const s=setup(t), producer=s.run();
  const write=await s.broker.execute({missionId:'mission',principalId:producer.id,lease:s.lease(producer.id),operationId:'changed-write',tool:'workspace.write',args:{path:'changed.txt',content:'original',expectedHash:null}});
  s.registry.recordToolObservation(producer.id,write);s.registry.attachInference(producer.id,{status:'completed',threadId:'changed-producer',turnId:'turn'});
  const a=s.artifact(producer,{toolReceipts:[write]}), reviewer=s.run({mode:'reviewer',artifactIds:[a.id]});
  fs.writeFileSync(join(s.workspace.path,'changed.txt'),'externally changed');
  const read=await s.broker.execute({missionId:'mission',principalId:reviewer.id,lease:s.lease(reviewer.id),operationId:'changed-read',tool:'workspace.read',args:{path:'changed.txt'}});
  s.registry.recordToolObservation(reviewer.id,read);s.registry.attachInference(reviewer.id,{status:'completed',threadId:'changed-reviewer',turnId:'turn'});
  const proof={kind:'tool',id:read.data.id,hash:sha256(read),quote:'externally changed'};
  assert.throws(()=>s.review(a,reviewer,proof),{code:'TOOL_STATE_MISMATCH'});
  const other=s.run({mode:'reviewer',artifactIds:[a.id]});s.registry.recordToolObservation(other.id,read);
  s.registry.attachInference(other.id,{status:'completed',threadId:'foreign-reviewer',turnId:'turn'});
  assert.throws(()=>s.review(a,other,proof),{code:'TOOL_ACTOR'});
});

test('observations: failed real read is diagnostic, never successful acceptance',async t=>{
  const s=setup(t), a=s.artifact(s.run()), reviewer=s.run({mode:'reviewer',artifactIds:[a.id]});
  const failed=await s.broker.execute({missionId:'mission',principalId:reviewer.id,lease:s.lease(reviewer.id),operationId:'missing-read',tool:'workspace.read',args:{path:'missing.txt'}});
  assert.equal(failed.data.status,'FAILED');
  s.registry.recordToolObservation(reviewer.id,failed);s.registry.attachInference(reviewer.id,{status:'completed',threadId:'failed-read-reviewer',turnId:'turn'});
  const proof={kind:'tool',id:failed.data.id,hash:sha256(failed),quote:canonical(failed.data.result)};
  assert.throws(()=>s.review(a,reviewer,proof),{code:'FAILED_TOOL'});
  assert.equal(s.review(a,reviewer,proof,{decision:'RETURN'}).status,'RETURNED');
});

test('required effects: omitted file proof and unavailable execution cannot be accepted',t=>{
  const s=setup(t), file={type:'file',path:'must-exist.txt',command:'',expectedExit:null};
  const a=s.artifact(s.run(),{requiredEffects:[file]});
  assert.deepEqual(a.payload.requiredEffects,[file]);
  assert.throws(()=>s.accept(a),{code:'MISSING_EFFECT_PROOF'});
  const execution=s.artifact(s.run(),{requiredEffects:[{type:'execution',path:'.',command:'["node","--test"]',expectedExit:0}]});
  assert.throws(()=>s.accept(execution),{code:'EXECUTION_PROOF'});
});

test('required effects: downstream product cannot erase inherited file obligations',t=>{
  const s=setup(t), file={type:'file',path:'inherited.txt',command:'',expectedExit:null};
  const parent=s.artifact(s.run(),{requiredEffects:[file],provisional:true});
  const child=s.artifact(s.run({artifactIds:[parent.id]}),{requiredEffects:[],provisional:true,inputRefs:[{artifactId:parent.id,hash:parent.payloadHash,purpose:parent.payload.purpose}]});
  assert.deepEqual(child.payload.requiredEffects,[file]);
});
