import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {Store} from '../../factory/lib/store.mjs';
import {Authority} from '../../factory/lib/authority.mjs';
import {ArtifactRegistry} from '../../factory/lib/artifacts.mjs';
import {ToolBroker} from '../../factory/tools/broker.mjs';
import {WorkerService} from '../../factory/lib/workers.mjs';
import {sha256} from '../../factory/lib/contracts.mjs';
import {compactReviewEvidence} from '../../factory/lib/review-codec.mjs';
import {unpackContext} from '../../factory/lib/context-codec.mjs';
import {unpackJsonContext} from '../../factory/lib/context-json-codec.mjs';
import {readSourceContextView} from '../../factory/lib/source-context-view.mjs';

const intent='Create a text file with a verifiable result.';
const node={id:'write-result',purpose:'file-delivery',roleIds:['sigma_01'],reviewerRoleIds:['sigma_02'],instructions:'Create result.txt containing verified result.',outputKind:'delivery',criteria:[{id:'file',text:'The requested file has the stated content.'}],requiredEffects:[{type:'file',path:'result.txt',command:'',expectedExit:null}],tools:['workspace.write','workspace.read']};
const final=(body='Created the requested file.')=>({action:'final',tool:'',argsJson:'',body,claims:[],method:'deliver-observed-product',reason:'Report only observed results.'});
const tool=(name,args,method='scoped-operation')=>({action:'tool',tool:name,argsJson:JSON.stringify(args),body:'',claims:[],method,reason:'Acquire the concrete required observation.'});
const batch=operations=>({action:'batch',tool:'',argsJson:JSON.stringify(operations),body:'',claims:[],method:'independent-exact-operations',reason:''});
function setup(t,respond,limits={}) {
  const dir=mkdtempSync(join(tmpdir(),'factory-workers-'));const store=new Store(':memory:');const authority=new Authority(store);const registry=new ArtifactRegistry(store,authority);
  const broker=new ToolBroker({store,authority,workspaceRoot:join(dir,'workspaces'),lookup:async()=>[{address:'93.184.216.34',family:4}],transport:async()=>({statusCode:200,headers:{'content-type':'text/plain'},body:Buffer.from('Exact public source fixture.'),remoteAddress:'93.184.216.34'})});
  const ws=broker.registerWorkspace('mission');
  store.put('mission','mission',{intent,intentHash:sha256(intent),policy:{allowedTools:['source.fetch','workspace.list','workspace.read','workspace.write','execution.run'],model:'gpt-6-astra',reasoningEffort:'ultra'}},{expectedVersion:0});
  let count=0,closed=0;const exposures=[];
  // Explicitly simulated inference; ToolBroker/Store/Authority and filesystem are real.
  const providerFactory=()=>{const number=++count;return {async generate(request){
    const exposure=readSourceContextView(request.input);exposures.push(exposure);
    const pending=store.list('run').filter(r=>r.data.expectedRequestHash);
    assert.ok(pending.length>0,'request is recorded before simulated inference');
    const value=await respond({request,exposure,number,store,registry,authority,broker});
    assert.equal(await request.validate(value),true);
    return {value,receipt:{kind:'inference',simulation:true,status:'completed',threadId:`sim-thread-${number}`,turnId:`sim-turn-${number}`,model:request.model,reasoningEffort:request.reasoningEffort,contextHash:sha256(JSON.stringify({instructions:request.instructions,input:request.input,schema:request.schema,model:request.model,reasoningEffort:request.reasoningEffort}))}};
  },async close(){closed++;}};};
  const workers=new WorkerService({store,authority,registry,broker,providerFactory,...limits});
  t.after(()=>{store.close();rmSync(dir,{recursive:true,force:true});});
  return {workers,store,authority,registry,broker,ws,exposures,get count(){return count;},get closed(){return closed;}};
}
const run=(s,n=node)=>s.workers.createRun({missionId:'mission',nodeId:n.id,mode:'producer',purpose:n.purpose,roleIds:n.roleIds});
test('recovery failure memory: a fresh actor cannot repeat an unchanged failed read under a new method label',async t=>{
  const n={...node,requiredEffects:[]};
  const s=setup(t,()=>tool('workspace.read',{path:'missing.txt'},'renamed-same-request'),{maxSteps:1});
  const prior=run(s,n),receipt=await s.workers.tool(prior.id,'workspace.read',{path:'missing.txt'},prior.id+':failed-read');
  assert.equal(receipt.status,'FAILED');const replacement=run(s,n);
  s.workers.inheritProductionObservations(prior.id,replacement.id);
  await assert.rejects(s.workers.produce({missionId:'mission',node:n,runId:replacement.id}),{code:'WORKER_REPEATED_FAILURE'});
  assert.equal(s.store.list('effect').length,1,'No second broker request merely because the producer identity changed');
  assert.equal(s.count,1,'The changed actor may propose an alternative; the invalid replay is stopped before its effect');
});
test('recovery failure memory: reading a missing file is allowed after an actual committed creation of that exact file',async t=>{
  const s=setup(t,({number})=>number===1?tool('workspace.read',{path:'result.txt'},'inspect-current')
    :number===2?tool('workspace.write',{path:'result.txt',content:'verified result',expectedHash:null},'create-missing-file')
    :number===3?tool('workspace.read',{path:'result.txt'},'verify-created-state'):final(),{maxSteps:4});
  const producer=run(s),candidate=await s.workers.produce({missionId:'mission',node,runId:producer.id});
  assert.equal(candidate.status,'CANDIDATE');assert.equal(s.count,4);
  assert.deepEqual(s.workers.run(producer.id).toolObservations.map(o=>s.registry.verifiedToolReceipt(o.signedReceipt).status),['FAILED','SUCCEEDED','SUCCEEDED']);
  assert.equal(readFileSync(join(s.ws.path,'result.txt'),'utf8'),'verified result');
  assert.equal(s.store.list('review').length,0,'A repaired observation is not independent acceptance');
});
test('recovery failure memory: an unrelated committed write cannot excuse the same failed request',async t=>{
  const n={...node,requiredEffects:[]},s=setup(t,()=>tool('workspace.read',{path:'missing.txt'},'another-label'),{maxSteps:1}),prior=run(s,n);
  await s.workers.tool(prior.id,'workspace.read',{path:'missing.txt'},prior.id+':failed');
  await s.workers.tool(prior.id,'workspace.write',{path:'unrelated.txt',content:'Not a repair of missing.txt',expectedHash:null},prior.id+':unrelated');
  const replacement=run(s,n);s.workers.inheritProductionObservations(prior.id,replacement.id);
  await assert.rejects(s.workers.produce({missionId:'mission',node:n,runId:replacement.id}),{code:'WORKER_REPEATED_FAILURE'});
  assert.equal(s.store.list('effect').length,2);
});
test('recovery failure memory: a relevant committed write remains valid progress after actor replacement',async t=>{
  const s=setup(t,({number})=>number===1?tool('workspace.read',{path:'result.txt'},'verify-changed-state'):final(),{maxSteps:2}),prior=run(s);
  await s.workers.tool(prior.id,'workspace.read',{path:'result.txt'},prior.id+':failed');
  await s.workers.tool(prior.id,'workspace.write',{path:'result.txt',content:'verified result',expectedHash:null},prior.id+':repair');
  const replacement=run(s);s.workers.inheritProductionObservations(prior.id,replacement.id);
  const candidate=await s.workers.produce({missionId:'mission',node,runId:replacement.id});
  assert.equal(candidate.status,'CANDIDATE');assert.equal(s.store.list('effect').length,3);assert.equal(s.count,2);
  assert.equal(candidate.payload.producerRunId,replacement.id,'Progress does not transfer prior producer identity');
});
test('recovery failure memory: a write before the latest failure is not evidence of a later repair',async t=>{
  const n={...node,requiredEffects:[]},s=setup(t,()=>tool('workspace.read',{path:'result.txt'},'renamed'),{maxSteps:1}),prior=run(s,n);
  await s.workers.tool(prior.id,'workspace.read',{path:'result.txt'},prior.id+':first-failure');
  await s.workers.tool(prior.id,'workspace.write',{path:'result.txt',content:'intermediate',expectedHash:null},prior.id+':old-repair');
  rmSync(join(s.ws.path,'result.txt')); // Explicit external change inside this temporary fixture only.
  await s.workers.tool(prior.id,'workspace.read',{path:'result.txt'},prior.id+':latest-failure');
  const record=s.store.get('run',prior.id);record.data.toolObservations.reverse();s.store.put('run',prior.id,record.data,{expectedVersion:record.version});
  const replacement=run(s,n);s.workers.inheritProductionObservations(prior.id,replacement.id);
  await assert.rejects(s.workers.produce({missionId:'mission',node:n,runId:replacement.id}),{code:'WORKER_REPEATED_FAILURE'});
  assert.equal(s.store.list('effect').length,3,'Journal order, not array order, decides whether repair is later');
});
test('recovery failure memory: a failed suffix blocks the complete batch before its new prefix writes',async t=>{
  const n={...node,requiredEffects:[]},s=setup(t,()=>batch([
    {tool:'workspace.write',args:{path:'unrelated.txt',content:'Must not be written',expectedHash:null}},
    {tool:'workspace.read',args:{path:'missing.txt'}}]),{maxSteps:1,maxToolOperations:2}),prior=run(s,n);
  await s.workers.tool(prior.id,'workspace.read',{path:'missing.txt'},prior.id+':failed');
  const replacement=run(s,n);s.workers.inheritProductionObservations(prior.id,replacement.id);
  await assert.rejects(s.workers.produce({missionId:'mission',node:n,runId:replacement.id}),{code:'WORKER_REPEATED_FAILURE'});
  assert.equal(s.store.list('effect').length,1);assert.throws(()=>readFileSync(join(s.ws.path,'unrelated.txt')),{code:'ENOENT'});
});
test('recovery failure memory: two replacements do not erase an admitted failed request',async t=>{
  const n={...node,requiredEffects:[]},s=setup(t,()=>tool('workspace.read',{path:'missing.txt'},'renamed-again'),{maxSteps:1}),first=run(s,n);
  await s.workers.tool(first.id,'workspace.read',{path:'missing.txt'},first.id+':failed');
  const second=run(s,n);s.workers.inheritProductionObservations(first.id,second.id);
  const third=run(s,n);s.workers.inheritProductionObservations(second.id,third.id);
  await assert.rejects(s.workers.produce({missionId:'mission',node:n,runId:third.id}),{code:'WORKER_REPEATED_FAILURE'});
  assert.equal(s.store.list('effect').length,1);
});
test('recovery failure memory: a classified infrastructure timeout can be retried without inventing a cognitive method failure',async t=>{
  const n={...node,requiredEffects:[],tools:['source.fetch']},url='https://example.com/source';
  const s=setup(t,()=>tool('source.fetch',{url},'same-scoped-operation'),{maxSteps:1}),prior=run(s,n),transport=s.broker.transport;
  s.broker.transport=async()=>{throw Object.assign(Error('Explicit SIMULATED transport timeout'),{code:'TIMEOUT'});};
  const failed=await s.workers.tool(prior.id,'source.fetch',{url},prior.id+':timeout');assert.equal(failed.status,'FAILED');assert.equal(failed.result.error.code,'TIMEOUT');
  s.broker.transport=transport;const replacement=run(s,n);s.workers.inheritProductionObservations(prior.id,replacement.id);
  await assert.rejects(s.workers.produce({missionId:'mission',node:n,runId:replacement.id}),{code:'WORKER_LIMIT'});
  assert.equal(s.store.list('effect').length,2);assert.equal(s.store.list('source').length,1,'New successful transport is observed, not assumed');
});
test('recovery failure memory: a changed request is permitted while the original failure remains visible',async t=>{
  const n={...node,requiredEffects:[],tools:['workspace.read','workspace.list']},s=setup(t,()=>tool('workspace.list',{path:'.'},'inspect-other-evidence'),{maxSteps:1}),prior=run(s,n);
  await s.workers.tool(prior.id,'workspace.read',{path:'missing.txt'},prior.id+':failed');
  const replacement=run(s,n);s.workers.inheritProductionObservations(prior.id,replacement.id);
  await assert.rejects(s.workers.produce({missionId:'mission',node:n,runId:replacement.id}),{code:'WORKER_LIMIT'});
  assert.equal(s.store.list('effect').length,2);assert.equal(s.workers.context(replacement.id).toolObservations.filter(o=>o.status==='FAILED').length,1);
});
test('recovery failure memory: a fresh parent listing can prove an externally created formerly missing file exists',async t=>{
  const n={...node,tools:['workspace.read','workspace.list','workspace.write']};
  const s=setup(t,({number})=>number===1?tool('workspace.read',{path:'result.txt'},'read-observed-existing-file'):final(),{maxSteps:2}),prior=run(s,n);
  const failed=await s.workers.tool(prior.id,'workspace.read',{path:'result.txt'},prior.id+':failed');assert.equal(failed.result.error.code,'ENOENT');
  writeFileSync(join(s.ws.path,'result.txt'),'verified result'); // Simulated owner edit, not a broker write.
  await s.workers.tool(prior.id,'workspace.list',{path:'.'},prior.id+':observe-parent');
  const replacement=run(s,n);s.workers.inheritProductionObservations(prior.id,replacement.id);
  const candidate=await s.workers.produce({missionId:'mission',node:n,runId:replacement.id});
  assert.equal(candidate.status,'CANDIDATE');assert.equal(s.store.list('effect').filter(r=>r.data.tool==='workspace.write').length,0);
  assert.equal(s.store.list('effect').length,3,'Re-read is a real separately authorized observation, not the parent list reused as content');
});
test('recovery failure memory: an empty parent listing is not progress on a missing file',async t=>{
  const n={...node,requiredEffects:[],tools:['workspace.read','workspace.list']};
  const s=setup(t,()=>tool('workspace.read',{path:'missing.txt'},'same-missing-file'),{maxSteps:1}),prior=run(s,n);
  await s.workers.tool(prior.id,'workspace.read',{path:'missing.txt'},prior.id+':failed');
  await s.workers.tool(prior.id,'workspace.list',{path:'.'},prior.id+':still-empty');
  const replacement=run(s,n);s.workers.inheritProductionObservations(prior.id,replacement.id);
  await assert.rejects(s.workers.produce({missionId:'mission',node:n,runId:replacement.id}),{code:'WORKER_REPEATED_FAILURE'});
  assert.equal(s.store.list('effect').length,2);
});
test('queued cancellation is processed before preparing or dispatching another inference',async t=>{
  const s=setup(t,()=>final()),producer=run(s),controller=new AbortController();
  const before=s.store.verifyJournal(),timer=setImmediate(()=>controller.abort());
  try{await assert.rejects(s.workers.infer({runId:producer.id,instructions:'No dispatch after pending cancellation.',input:'{}',
    schema:{type:'object'},validate:()=>true,signal:controller.signal}),{code:'CANCELLED'});}
  finally{clearImmediate(timer);}
  assert.equal(s.count,0);assert.equal(s.store.list('inference-request').length,0);
  assert.deepEqual(s.store.verifyJournal(),before);assert.equal(s.store.list('effect').length,0);
});
test('queued cancellation between worker steps preserves the committed write without a second inference',async t=>{
  const s=setup(t,({number})=>number===1?tool('workspace.write',{path:'result.txt',content:'keep confirmed content',expectedHash:null}):final());
  const producer=run(s),controller=new AbortController(),execute=s.broker.execute.bind(s.broker);let timer;
  s.broker.execute=async input=>{const receipt=await execute(input);timer=setImmediate(()=>controller.abort());return receipt;};
  try{await assert.rejects(s.workers.produce({missionId:'mission',node,runId:producer.id,signal:controller.signal}),{code:'CANCELLED'});}
  finally{if(timer)clearImmediate(timer);}
  assert.equal(s.count,1);assert.equal(s.store.list('inference-request').length,1);
  const effects=s.store.list('effect');assert.equal(effects.length,1);assert.equal(effects[0].data.state,'SUCCEEDED');
  assert.equal(readFileSync(join(s.ws.path,'result.txt'),'utf8'),'keep confirmed content');
  assert.equal(s.store.list('artifact').length,0);assert.equal(s.store.list('worker-proposal').length,1);
});
test('opt-in source view reaches workers with full task, scoped prefix, exact request hash and no self-acceptance',async t=>{
  const s=setup(t,({request,exposure})=>{
    assert.ok(request.input.startsWith('SOVEREIGN_SOURCE_CONTEXT_VIEW_V1\n'));
    assert.ok(request.instructions.includes('sovereign.source-context-view.v1'));
    assert.equal(exposure.missionIntent,intent);assert.ok(exposure.task.includes('Preserve these criteria.'));
    return final('A simulated candidate, not an accepted result.');
  },{contextEncoding:'source-text-v1'});
  const producer=run(s),config=s.store.get('worker-config',producer.id).data;
  assert.equal(config.compilationScope.contextEncoding,'source-text-v1');assert.equal(config.prefixHash,sha256(config.instructions));
  await s.workers.infer({runId:producer.id,instructions:'Check only the requested shape.',input:'Preserve these criteria.',schema:{type:'object'},validate:()=>true});
  const event=s.store.events({limit:1000}).find(e=>e.kind==='worker.context.encoding');
  assert.equal(event.data.sourceViewCount,1);assert.equal(event.data.encoding,'sovereign.source-context-view.v1');
  assert.ok(event.data.savedBytes<0,'Redundant literal view is not claimed as byte savings');
  assert.equal(s.count,1);assert.equal(s.closed,1);assert.equal(s.store.list('review').length,0);assert.equal(s.store.list('effect').length,0);
});
test('literal source supplement cannot bypass the worker wire budget',async t=>{
  const s=setup(t,()=>{throw Error('Budget violation must precede inference');},{contextEncoding:'source-text-v1',maxContextBytes:6000});
  const mission=s.store.get('mission','mission'),text='A'.repeat(4000);
  s.store.put('mission','mission',{...mission.data,intent:text,intentHash:sha256(text)},{expectedVersion:mission.version});
  const producer=run(s);
  await assert.rejects(s.workers.infer({runId:producer.id,instructions:'No truncation.',input:'{}',schema:{type:'object'},validate:()=>true}),{code:'CONTEXT_LIMIT'});
  assert.equal(s.count,0);assert.equal(s.workers.run(producer.id).expectedRequestHash,undefined);
});
test('incompatible role is rejected before run, effects or provider dispatch; legacy worker cannot bypass at inference',async t=>{
  const s=setup(t,()=>{throw Error('No provider call authorized for incompatible role');});
  const events=s.store.events({limit:1000}).length;
  for(const roleId of ['omega_09','veritas_04'])for(const mode of ['producer','reviewer'])
    assert.throws(()=>s.workers.createRun({missionId:'mission',nodeId:'blind',mode,purpose:'blind',roleIds:[roleId]}),{code:'ROLE_EXECUTION_UNSUPPORTED'});
  assert.equal(s.store.list('run').length,0);assert.equal(s.store.list('effect').length,0);
  assert.equal(s.store.events({limit:1000}).length,events);assert.equal(s.count,0);
  // Simulate a persisted pre-gate worker configuration; creation is no longer enough.
  const legacy=run(s),config=s.store.get('worker-config',legacy.id);
  s.store.put('worker-config',legacy.id,{...config.data,roleIds:['veritas_04']},{expectedVersion:config.version});
  await assert.rejects(s.workers.infer({runId:legacy.id,instructions:'Do not dispatch.',input:'{}',schema:{type:'object'},validate:()=>true}),{code:'ROLE_EXECUTION_UNSUPPORTED'});
  assert.equal(s.count,0);assert.equal(s.workers.run(legacy.id).expectedRequestHash,undefined);
});
test('oversized context fails before codec/provider with exact size diagnostics, no content leak and no invented inference',async t=>{
  const marker='PRIVATE_CONTEXT_SIZE_FIXTURE',raw=marker+'é'.repeat(1000000),input='{}';
  const s=setup(t,()=>{throw Error('Oversize cannot dispatch');},{contextEncoding:'lossless-json-v2'}),producer=run(s);
  s.broker.transport=async()=>({statusCode:200,headers:{'content-type':'text/plain'},body:Buffer.from(raw),remoteAddress:'93.184.216.34'});
  await s.workers.tool(producer.id,'source.fetch',{url:'https://example.com/large-source'},'operation:oversize-source');
  await assert.rejects(s.workers.infer({runId:producer.id,instructions:'Preserve all evidence.',input,schema:{type:'object'},validate:()=>true}),{code:'CONTEXT_LIMIT'});
  const events=s.store.events({limit:1000}),blocked=events.filter(e=>e.kind==='worker.context.blocked');
  assert.equal(blocked.length,1);assert.equal(blocked[0].data.runId,producer.id);
  const d=blocked[0].data.diagnostic;assert.ok(d.logicalBytes>4*1024*1024);assert.equal(d.maxContextBytes,1024*1024);
  assert.equal(d.wireBytes,null);assert.equal(d.fieldBytes.task,Buffer.byteLength(JSON.stringify(input)));
  assert.equal(d.sourceBytes[0].rawBytes,Buffer.byteLength(raw));assert.equal(d.sourceCount,1);assert.equal(d.toolObservationCount,1);
  assert.ok(!JSON.stringify(blocked[0]).includes(marker));assert.equal(s.count,0);
  assert.equal(s.workers.run(producer.id).expectedRequestHash,undefined);
  assert.equal(events.filter(e=>e.kind==='worker.inference.dispatched'||e.kind==='worker.inference.completed'||e.kind==='worker.inference.failed').length,0);
});
test('closed derivation guidance reaches producer without relaxing typed premise or evidence validation',async t=>{
  const s=setup(t,({request})=>{
    const description=request.schema.properties.claims.description;
    assert.ok(description.includes('existing entry in that artifact payload.claims'));
    assert.ok(description.includes('fully supplied closed mathematical/logical derivation'));
    assert.ok(description.includes('substantive independent review'));
    return final('From the supplied integers 1 and 1, addition gives 2.');
  });
  const n={...node,instructions:'Derive one plus one.',requiredEffects:[],tools:[],criteria:[{id:'derivation',text:'Derive from the supplied operands.'}]};
  const producer=run(s,n),candidate=await s.workers.produce({missionId:'mission',node:n,runId:producer.id});
  assert.equal(s.count,1);assert.equal(candidate.status,'CANDIDATE');assert.deepEqual(candidate.payload.claims,[]);
  assert.equal(s.store.list('review').length,0,'An explanation is not self-acceptance');
  const claim={id:'derived',kind:'inference',text:'Two',sources:[],basis:[],qualifiers:[],validUntil:null};
  assert.throws(()=>s.registry.validateClaims([claim],'mission',[]),{code:'UNSUPPORTED_INFERENCE'});
  assert.throws(()=>s.registry.validateClaims([{...claim,kind:'fact'}],'mission',[]),{code:'UNSUPPORTED_FACT'});
  assert.throws(()=>s.registry.validateClaims([{...claim,basis:[{artifactId:candidate.id,hash:candidate.payloadHash,claimId:'requirement-id'}]}],
    'mission',[{artifactId:candidate.id,hash:candidate.payloadHash,purpose:candidate.payload.purpose}]),{code:'UNDECLARED_PREMISE'});
});
test('REAL broker / SIMULATED model and HTTP: JSON codec keeps acquired evidence and independent source review intact',async t=>{
  const sourceText='Exact source count: 17.\n'+'Padding is still evidence; do not omit it. '.repeat(250);
  const n={...node,purpose:'source-codec-check',instructions:'Acquire both supplied records and report their exact documentary statement.',tools:['source.fetch'],requiredEffects:[],criteria:[{id:'source',text:'Both acquired documents state the exact count; make no claim of independence.'}]};
  const s=setup(t,({number,exposure,request})=>{
    assert.ok(request.instructions.includes('sovereign.lossless-context.v2'));
    if(number===1)return batch(['first','second'].map(path=>({tool:'source.fetch',args:{url:'https://example.com/'+path}})));
    assert.equal(JSON.parse(request.input).encoding,'sovereign.lossless-context.v2');
    assert.equal(exposure.sources.length,2);assert.ok(exposure.sources.every(s=>s.raw===sourceText));
    assert.equal(exposure.sourceRelationships.rootIndependence,'NOT_ESTABLISHED');
    if(number===2)return {...final('Both supplied records state count 17; independence has not been established.'),claims:[{
      id:'recorded-count',text:'Both supplied records state count 17.',kind:'fact',
      sources:exposure.sources.map(s=>({sourceId:s.id,hash:s.hash,quote:'Exact source count: 17.'})),basis:[],qualifiers:['Supplied fixture records only.'],validUntil:null}]};
    const a=exposure.artifacts[0];return {artifactHash:a.hash,purpose:a.payload.purpose,decision:'ACCEPT',
      checks:[{criterionId:'source',verdict:'PASS',reason:'Both decoded source bodies retain the exact passage and distinct IDs.',
        evidence:exposure.sources.map(s=>({kind:'source',id:s.id,hash:s.hash,quote:'Exact source count: 17.'}))}],findings:[],uncertainty:''};
  },{contextEncoding:'lossless-json-v2'});
  s.broker.transport=async()=>({statusCode:200,headers:{'content-type':'text/plain'},body:Buffer.from(sourceText),remoteAddress:'93.184.216.34'});
  const producer=run(s,n),candidate=await s.workers.produce({missionId:'mission',node:n,runId:producer.id});
  const accepted=await s.workers.review({artifact:candidate,reviewerRoleIds:n.reviewerRoleIds,missionIntent:intent});
  assert.equal(accepted.status,'ACCEPTED');assert.equal(s.count,3);assert.equal(s.store.list('effect').length,2);
  const reviewer=s.store.list('run').find(r=>r.data.mode==='reviewer');assert.equal(reviewer.data.context.producerConversationIncluded,false);
  const events=s.store.events({limit:1000}).filter(e=>e.kind==='worker.context.encoding');
  assert.ok(events.filter(e=>e.data.encoding==='sovereign.lossless-context.v2').length>=2);
  assert.ok(events.every(e=>e.data.roundTripVerified));
  s.registry.retractSource(s.store.list('source')[0].id,'Fixture retraction remains binding');
  assert.throws(()=>s.registry.assertUsable(accepted.id,{missionId:'mission',purpose:n.purpose}));
});
test('JSON wire savings cannot bypass the original logical worker budget',async t=>{
  const s=setup(t,()=>{throw Error('Oversized logical input must not reach the model');},{contextEncoding:'lossless-json-v2',maxContextBytes:10000});
  const producer=run(s),text='Repeated but still logically present. '.repeat(1000);
  await assert.rejects(s.workers.infer({runId:producer.id,instructions:'Retain evidence.',input:JSON.stringify({first:text,second:text}),schema:{type:'object'},validate:()=>true}),{code:'CONTEXT_LIMIT'});
  assert.equal(s.count,0);assert.equal(s.store.list('effect').length,0);
});
for(const scenario of ['accept','repair-reference','missing-own-read','mutated-file'])test(`SIMULATED encoded review / REAL file: ${scenario}`,async t=>{
  let reviewCalls=0;
  const s=setup(t,({number,exposure,request})=>{
    if(number===1)return tool('workspace.write',{path:'result.txt',content:'verified result',expectedHash:null});
    if(number===2)return final();
    reviewCalls++;
    assert.ok(request.schema.properties.evidence);assert.ok(request.schema.properties.checks.items.properties.evidenceIds);
    const a=exposure.artifacts[0],own=exposure.toolObservations.find(o=>o.relation==='OWN_ACTION'&&o.tool==='workspace.read');
    const proof=scenario==='missing-own-read'?{kind:'artifact',id:a.id,hash:a.hash,quote:a.payload.body}
      :{kind:'tool',id:own.id,hash:own.hash,quote:own.quoteText};
    const result=compactReviewEvidence({artifactHash:a.hash,purpose:a.payload.purpose,decision:'ACCEPT',
      checks:JSON.parse(exposure.task).criteria.map(c=>({criterionId:c.id,verdict:'PASS',evidence:[proof],reason:'Fixture-only substantive assertion.'})),findings:[],uncertainty:''});
    if(scenario==='repair-reference'&&reviewCalls===1)result.checks[0].evidenceIds=['missing'];
    if(scenario==='repair-reference'&&reviewCalls===2)assert.equal(JSON.parse(exposure.task).recoveryFeedback.at(-1).code,'REVIEW_ENCODING');
    if(scenario==='mutated-file')writeFileSync(join(s.ws.path,'result.txt'),'external change');
    return result;
  });
  const record=s.store.get('mission','mission');s.store.put('mission','mission',{...record.data,policy:{...record.data.policy,reviewEncoding:'evidence-refs-v1'}},{expectedVersion:record.version});
  const n={...node,criteria:[node.criteria[0],{id:'exact',text:'Also preserve exact bytes, without substituting current evidence.'}]},producer=run(s,n);
  const candidate=await s.workers.produce({missionId:'mission',node:n,runId:producer.id});
  const review=()=>s.workers.review({artifact:candidate,reviewerRoleIds:n.reviewerRoleIds,missionIntent:intent});
  if(scenario==='missing-own-read')await assert.rejects(review(),{code:'UNVERIFIED_WRITE'});
  else if(scenario==='mutated-file')await assert.rejects(review(),{code:'WORKSPACE_CHANGED'});
  else{
    const accepted=await review();assert.equal(accepted.status,'ACCEPTED');
    const result=s.store.get('review',accepted.reviews.at(-1)).data.result;
    assert.equal(result.checks.length,2);assert.ok(result.checks.every(c=>Array.isArray(c.evidence)&&!('evidenceIds'in c)));
    const encoded=s.store.list('worker-review-encoding').at(-1).data;
    assert.equal(encoded.rawResponse.evidence.length,1);assert.equal(encoded.expandedResponseHash,sha256(result));
    assert.equal(s.store.list('effect').filter(e=>e.data.tool==='workspace.read').length,1,'Encoding correction never repeats the independent read');
  }
  assert.equal(s.store.list('effect').filter(e=>e.data.tool==='workspace.write').length,1);
  const reviewer=s.store.list('run').find(r=>r.data.mode==='reviewer');
  assert.equal(s.store.get('worker-config',reviewer.id).data.compilationScope.reviewEncoding,'evidence-refs-v1');
  assert.equal(s.store.get('worker-config',producer.id).data.compilationScope.reviewEncoding,undefined);
});
test('REAL broker receipts / SIMULATED HTTP: source relationships reach only exposed contexts without inferred independence',async t=>{
  const s=setup(t,()=>{throw Error('No inference required');}),producer=run(s),unrelated=run(s);
  assert.equal(s.workers.context(producer.id).sourceRelationships,undefined);
  const first=await s.workers.tool(producer.id,'source.fetch',{url:'https://example.com/first'},producer.id+':first');
  assert.equal(s.workers.context(producer.id).sourceRelationships,undefined,'No extra grouping context for one source');
  const second=await s.workers.tool(producer.id,'source.fetch',{url:'https://example.com/second'},producer.id+':second');
  const context=s.workers.context(producer.id);
  assert.equal(context.sourceRelationships.rootIndependence,'NOT_ESTABLISHED');
  assert.deepEqual(context.sourceRelationships.identicalContent[0].sourceIds,[`source:${first.id}`,`source:${second.id}`].sort());
  assert.equal(context.sourceRelationships.sharedHttpOrigin[0].origin,'https://example.com');
  assert.ok(context.sources.every(source=>source.raw==='Exact public source fixture.'));
  const reviewer=s.workers.createRun({missionId:'mission',nodeId:node.id,mode:'reviewer',purpose:node.purpose,roleIds:node.reviewerRoleIds,
    sourceIds:context.sources.map(source=>source.id)});
  assert.deepEqual(s.workers.context(reviewer.id).sourceRelationships,context.sourceRelationships);
  assert.equal(s.workers.context(unrelated.id).sourceRelationships,undefined);
  assert.equal(s.workers.context(unrelated.id).sources.length,0);assert.equal(s.count,0);
});
test('REAL standalone receipt recovery + SIMULATED review: old writes and empty inventory reach the new independent reviewer as authenticated history',async t=>{
  let priorRunId;
  const s=setup(t,({number,exposure})=>{
    if(number===1)return tool('workspace.read',{path:'result.txt'});
    if(number===2)return final('Existing correct bytes preserved; prior producer wrote once.');
    const history=exposure.runtimeObservations.find(o=>o.kind==='workspace-history');assert.ok(history);
    const effects=JSON.parse(history.quoteText).detail.effects;
    const writes=effects.filter(e=>e.tool==='workspace.write');assert.equal(writes.length,1);
    assert.equal(writes[0].principalId,priorRunId);assert.equal(writes[0].recordedResult.path,'result.txt');
    assert.equal(writes[0].recordedResult.sha256,sha256('verified result'));
    assert.deepEqual(effects.find(e=>e.id===priorRunId+':before').recordedResult.entries,[]);
    assert.ok(effects.filter(e=>e.tool==='workspace.read').every(e=>!('content'in e.recordedResult)));
    const own=exposure.toolObservations.find(o=>o.relation==='OWN_ACTION'&&o.tool==='workspace.read');assert.ok(own);
    const a=exposure.artifacts[0];assert.ok(a.payload.toolReceipts.every(r=>r.data.principalId===a.payload.producerRunId));
    return {artifactHash:a.hash,purpose:a.payload.purpose,decision:'ACCEPT',checks:[{criterionId:'file',verdict:'PASS',reason:'Fixture oracle checked preserved write history and independent exact bytes.',evidence:[
      {kind:'tool',id:own.id,hash:own.hash,quote:own.quoteText},
      {kind:'runtime',id:history.id,hash:history.hash,quote:'"tool":"workspace.write"'}]}],findings:[],uncertainty:'Simulated semantic review; real files and receipts.'};
  });
  const prior=run(s);priorRunId=prior.id;
  await s.workers.tool(prior.id,'workspace.list',{path:'.'},prior.id+':before');
  await s.workers.tool(prior.id,'workspace.write',{path:'result.txt',content:'verified result',expectedHash:null},prior.id+':write');
  const replacement=run(s);s.workers.inheritProductionObservations(prior.id,replacement.id);
  const candidate=await s.workers.produce({missionId:'mission',node,runId:replacement.id,inputRefs:[]});
  const accepted=await s.workers.review({artifact:candidate,reviewerRoleIds:node.reviewerRoleIds,missionIntent:intent});
  assert.equal(accepted.status,'ACCEPTED');assert.equal(s.count,3);
  assert.equal(s.store.list('effect').filter(e=>e.data.tool==='workspace.write').length,1);
  const reviewer=s.store.list('run').find(r=>r.data.mode==='reviewer').data;
  const history=reviewer.runtimeObservations.find(o=>o.kind==='workspace-history');
  const proof={kind:'runtime',id:history.id,hash:history.hash,quote:'"tool":"workspace.write"'};
  assert.ok(s.registry.runtimeReference(proof,reviewer));
  await s.workers.tool(replacement.id,'workspace.read',{path:'result.txt'},replacement.id+':later-read');
  assert.throws(()=>s.registry.runtimeReference(proof,reviewer),{code:'STALE_RUNTIME'});
});
test('REAL receipt recovery: committed but not yet observed acquisition is inherited without another fetch',async t=>{
  const s=setup(t,()=>{throw Error('No inference expected');}),from=run(s),to=run(s);
  const signed=await s.broker.execute({missionId:'mission',principalId:from.id,lease:s.workers.lease(from.id,'source.fetch'),operationId:`${from.id}:committed`,tool:'source.fetch',args:{url:'https://example.com/source'}});
  assert.equal(s.store.list('source').length,0);assert.equal(s.workers.context(from.id).toolObservations.length,0);
  s.workers.inheritProductionObservations(from.id,to.id);
  const context=s.workers.context(to.id);assert.equal(context.sources.length,1);assert.equal(context.sources[0].raw,'Exact public source fixture.');
  assert.equal(context.toolObservations[0].relation,'EXTERNAL_OBSERVATION');assert.equal(context.toolObservations[0].principalId,from.id);
  assert.equal(s.store.list('effect').length,1);assert.equal(s.count,0);assert.equal(context.sources[0].id,`source:${signed.data.id}`);
});
test('REAL receipt recovery: revoked sources are not readmitted and prior authority/identity never transfers',async t=>{
  const s=setup(t,()=>{throw Error('No inference expected');}),from=run(s),to=run(s);
  const receipt=await s.workers.tool(from.id,'source.fetch',{url:'https://example.com/source'},`${from.id}:fetch`);
  s.registry.retractSource(`source:${receipt.id}`,'Synthetic source withdrawal before recovery');
  s.workers.inheritProductionObservations(from.id,to.id);
  assert.equal(s.workers.context(to.id).sources.length,0);assert.equal(s.store.get('source',`source:${receipt.id}`).data.status,'RETRACTED');
  assert.equal(s.workers.context(to.id).toolObservations[0].relation,'EXTERNAL_OBSERVATION');
  assert.throws(()=>s.workers.inheritProductionObservations(from.id,to.id),{code:'RECOVERY_SCOPE'});
});
test('REAL receipt recovery: different scopes, tampering and uncertain operations fail atomically',async t=>{
  for(const kind of ['node','purpose','inputs','tamper','uncertain']){
    const s=setup(t,()=>{throw Error('No inference expected');}),from=run(s),to=run(s,kind==='node'?{...node,id:'other'}:kind==='purpose'?{...node,purpose:'other'}:node);
    await s.workers.tool(from.id,'workspace.write',{path:'prior.txt',content:'kept',expectedHash:null},`${from.id}:write`);
    if(kind==='inputs'){const r=s.store.get('run',from.id);s.store.put('run',r.id,{...r.data,context:{...r.data.context,artifactIds:['artifact:other']}},{expectedVersion:r.version});}
    if(kind==='tamper'){const r=s.store.get('run',from.id);r.data.toolObservations[0].resultText='tampered';s.store.put('run',r.id,r.data,{expectedVersion:r.version});}
    if(kind==='uncertain')s.store.put('effect','operation:uncertain',{missionId:'mission',principalId:from.id,tool:'workspace.write',state:'DISPATCHED'},{expectedVersion:0});
    assert.throws(()=>s.workers.inheritProductionObservations(from.id,to.id),{code:kind==='tamper'?'TOOL_RECEIPT':kind==='uncertain'?'EFFECT_UNCERTAIN':'RECOVERY_SCOPE'});
    assert.equal(s.workers.context(to.id).toolObservations.length,0);assert.equal(s.store.events().filter(e=>e.kind==='worker.observations.inherited').length,0);
    assert.equal(readFileSync(join(s.ws.path,'prior.txt'),'utf8'),'kept');
  }
});
test('REAL receipt recovery: an undispatched PREPARED intent is recorded as unexecuted, never as an observation',async t=>{
  const s=setup(t,()=>{throw Error('No inference expected');}),from=run(s),to=run(s);
  s.store.put('effect','operation:prepared',{missionId:'mission',principalId:from.id,tool:'workspace.write',state:'PREPARED'},{expectedVersion:0});
  const recovery=s.workers.inheritProductionObservations(from.id,to.id);
  assert.deepEqual(recovery.preparedOperationIds,['operation:prepared']);assert.equal(s.workers.context(to.id).toolObservations.length,0);
  assert.equal(s.store.get('effect','operation:prepared').data.state,'PREPARED');assert.equal(s.count,0);
});
test('SIMULATED inference + REAL files: batched writes save two calls and retain distinct receipts, exact bytes and independent reviews',async t=>{
  const writes=['a.txt','b.txt','c.txt'].map(path=>({tool:'workspace.write',args:{path,content:`Exact ${path} ñ`,expectedHash:null}}));
  const n={...node,requiredEffects:writes.map(w=>({type:'file',path:w.args.path,command:'',expectedExit:null}))};
  const results=[];
  for(const batched of [false,true]){
    const s=setup(t,({number,exposure})=>{
      const task=JSON.parse(exposure.task);
      if('candidateId'in task){const a=exposure.artifacts[0],own=exposure.toolObservations.filter(o=>o.relation==='OWN_ACTION'&&o.tool==='workspace.read');
        assert.equal(own.length,3);
        return {artifactHash:a.hash,purpose:a.payload.purpose,decision:'ACCEPT',checks:[{criterionId:'file',verdict:'PASS',reason:'Independent fixture oracle checked every exact file.',evidence:own.map(o=>({kind:'tool',id:o.id,hash:o.hash,quote:o.quoteText}))}],findings:[],uncertainty:'Simulated semantic review'};}
      if(batched&&number===1)return batch(writes);
      if(!batched&&number<=3)return tool(writes[number-1].tool,writes[number-1].args);
      assert.equal(exposure.toolObservations.length,3);
      for(const [i,o]of exposure.toolObservations.entries())assert.equal(o.writtenContent,writes[i].args.content);
      return final();
    });
    const r=run(s,n),a=await s.workers.produce({missionId:'mission',node:n,runId:r.id});
    assert.equal(a.payload.toolReceipts.length,3);assert.equal(new Set(a.payload.toolReceipts.map(s=>s.data.id)).size,3);
    assert.equal((await s.workers.review({artifact:a,reviewerRoleIds:n.reviewerRoleIds,missionIntent:intent})).status,'ACCEPTED');
    assert.equal(s.store.list('effect').length,6);
    for(const w of writes)assert.equal(readFileSync(join(s.ws.path,w.args.path),'utf8'),w.args.content);
    if(batched){assert.equal(s.store.list('effect').filter(e=>e.id.startsWith(r.id)).length,3);assert.ok(s.store.get('effect',`${r.id}:step:0:batch:2`));}
    results.push({calls:s.count,inputBytes:s.exposures.reduce((n,e)=>n+Buffer.byteLength(JSON.stringify(e)),0)});
  }
  assert.equal(results[0].calls,5);assert.equal(results[1].calls,3);assert.ok(results[1].inputBytes<results[0].inputBytes);
  t.diagnostic(JSON.stringify({sequential:results[0],batch:results[1],caveat:'Synthetic model, real files; not billed tokens.'}));
});
for(const [name,operations,code]of [
  ['late unauthorized tool',[{tool:'workspace.write',args:{path:'first.txt',content:'no',expectedHash:null}},{tool:'source.fetch',args:{url:'https://example.com/'}}],'AUTHORITY_SCOPE'],
  ['late invalid path',[{tool:'workspace.write',args:{path:'first.txt',content:'no',expectedHash:null}},{tool:'workspace.read',args:{path:'../outside'}}],'WORKSPACE_PATH'],
  ['late missing workspace path',[{tool:'workspace.write',args:{path:'first.txt',content:'no',expectedHash:null}},{tool:'workspace.read',args:{}}],'SCHEMA'],
  ['late null operation',[{tool:'workspace.write',args:{path:'first.txt',content:'no',expectedHash:null}},null],'SCHEMA'],
  ['late non-string tool',[{tool:'workspace.write',args:{path:'first.txt',content:'no',expectedHash:null}},{tool:23,args:{path:'later.txt'}}],'AUTHORITY_SCOPE'],
  ['duplicate operation',[{tool:'workspace.read',args:{path:'a.txt'}},{tool:'workspace.read',args:{path:'a.txt'}}],'BATCH_DUPLICATE'],
  ['same path dependency',[{tool:'workspace.write',args:{path:'a.txt',content:'no',expectedHash:null}},{tool:'workspace.read',args:{path:'a.txt'}}],'BATCH_DEPENDENCY'],
  ['write affects directory listing',[{tool:'workspace.write',args:{path:'a.txt',content:'no',expectedHash:null}},{tool:'workspace.list',args:{path:'.'}}],'BATCH_DEPENDENCY'],
  ['execution in batch',[{tool:'workspace.write',args:{path:'a.txt',content:'no',expectedHash:null}},{tool:'execution.run',args:{argv:['true'],cwd:'.'}}],'BATCH_DEPENDENCY'],
])test(`SIMULATED: whole batch preflight rejects ${name} before any effect`,async t=>{
  const s=setup(t,()=>batch(operations));const n={...node,tools:['workspace.write','workspace.read','workspace.list','execution.run']},r=run(s,n);
  await assert.rejects(s.workers.produce({missionId:'mission',node:n,runId:r.id}),{code});assert.equal(s.store.list('effect').length,0);
});
test('SIMULATED + REAL files: partial batch failure preserves successful prefix and never attempts suffix',async t=>{
  const s=setup(t,({number,exposure})=>{
    if(number===1)return batch([{tool:'workspace.write',args:{path:'kept.txt',content:'kept',expectedHash:null}},{tool:'workspace.read',args:{path:'missing.txt'}},{tool:'workspace.write',args:{path:'unattempted.txt',content:'must not happen',expectedHash:null}}]);
    assert.equal(exposure.toolObservations.length,2);assert.equal(exposure.toolObservations[0].writtenContent,'kept');
    const correction=JSON.parse(exposure.task).corrections.at(-1);assert.equal(correction.failedIndex,1);assert.equal(correction.unattempted,1);
    return {...final(),action:'blocked',body:'',reason:'Required source is missing; original success preserved.'};
  });const r=run(s);
  await assert.rejects(s.workers.produce({missionId:'mission',node,runId:r.id}),{code:'CAPABILITY'});
  assert.equal(s.store.list('effect').length,2);assert.equal(readFileSync(join(s.ws.path,'kept.txt'),'utf8'),'kept');
  assert.throws(()=>readFileSync(join(s.ws.path,'unattempted.txt')),{code:'ENOENT'});assert.equal(s.store.list('artifact').length,0);
  await assert.rejects(s.workers.produce({missionId:'mission',node,runId:r.id}),{code:'WORKER_REENTRY'});
});
test('SIMULATED: batching does not multiply the total tool budget',async t=>{
  const s=setup(t,({number})=>batch([0,1].map(i=>({tool:'workspace.list',args:{path:number===1?(i===0?'.':'missing'):`dir${i}`}}))),{maxToolOperations:2});
  const n={...node,tools:['workspace.list']},r=run(s,n);
  await assert.rejects(s.workers.produce({missionId:'mission',node:n,runId:r.id}),{code:'WORKER_LIMIT'});assert.equal(s.count,2);assert.equal(s.store.list('effect').length,2);
});
test('SIMULATED: batch size cap and empty batches fail before effects',async t=>{
  for(const operations of [[],Array.from({length:5},(_,i)=>({tool:'workspace.read',args:{path:`f${i}`}}))]){
    const s=setup(t,()=>batch(operations)),r=run(s);
    await assert.rejects(s.workers.produce({missionId:'mission',node,runId:r.id}),{code:'SCHEMA'});assert.equal(s.store.list('effect').length,0);
  }
});
test('SIMULATED + REAL files: cancellation between batch members stops further effects',async t=>{
  const c=new AbortController(),s=setup(t,()=>batch(['a.txt','b.txt'].map(path=>({tool:'workspace.write',args:{path,content:'x',expectedHash:null}}))));
  const original=s.workers.tool.bind(s.workers);s.workers.tool=async(...args)=>{const r=await original(...args);c.abort();return r;};const r=run(s);
  await assert.rejects(s.workers.produce({missionId:'mission',node,runId:r.id,signal:c.signal}),{code:'CANCELLED'});
  assert.equal(s.store.list('effect').length,1);assert.equal(readFileSync(join(s.ws.path,'a.txt'),'utf8'),'x');assert.throws(()=>readFileSync(join(s.ws.path,'b.txt')),{code:'ENOENT'});
});
test('SIMULATED + REAL files: batch write context detects proposal tampering',async t=>{
  const s=setup(t,({number})=>number===1?batch([{tool:'workspace.write',args:{path:'result.txt',content:'real',expectedHash:null}}]):final()),r=run(s);
  await s.workers.produce({missionId:'mission',node,runId:r.id});
  const p=s.store.get('worker-proposal',`${r.id}:proposal:0`),value={...p.data.value,argsJson:JSON.stringify([{tool:'workspace.write',args:{path:'result.txt',content:'forged',expectedHash:null}}])};
  s.store.put('worker-proposal',p.id,{...p.data,value},{expectedVersion:p.version});
  assert.throws(()=>s.workers.context(r.id),{code:'TOOL_RECEIPT'});
});
for(const mode of ['accept','historical-only','mutate-during-review','mutate-after-accept'])test(`SIMULATED + REAL directories: independent listing ${mode}`,async t=>{
  const n={...node,requiredEffects:[],tools:['workspace.list']};
  const s=setup(t,({number,exposure})=>{
    if(number===1)return tool('workspace.list',{path:'.'});
    if(number===2)return final('The observed directory is empty.');
    const a=exposure.artifacts[0],listing=exposure.toolObservations.find(o=>o.tool==='workspace.list'&&o.relation===(mode==='historical-only'?'EXTERNAL_OBSERVATION':'OWN_ACTION'));
    assert.ok(listing);
    if(mode==='mutate-during-review')writeFileSync(join(s.ws.path,'unexpected.txt'),'new');
    return {artifactHash:a.hash,purpose:a.payload.purpose,decision:'ACCEPT',checks:[{criterionId:'file',verdict:'PASS',evidence:[{kind:'tool',id:listing.id,hash:listing.hash,quote:listing.quoteText}],reason:'Check the independently observed directory membership.'}],findings:[],uncertainty:''};
  },{maxReviewRepairs:0});
  const r=run(s,n),a=await s.workers.produce({missionId:'mission',node:n,runId:r.id});
  const review=()=>s.workers.review({artifact:a,reviewerRoleIds:n.reviewerRoleIds,missionIntent:intent});
  if(mode==='historical-only'||mode==='mutate-during-review'){
    await assert.rejects(review(),{code:mode==='historical-only'?'MISSING_EFFECT_PROOF':'WORKSPACE_CHANGED'});assert.equal(s.store.list('review').length,0);
  }else{
    const accepted=await review();assert.equal(accepted.status,'ACCEPTED');
    const reviewer=s.store.list('run').find(r=>r.data.mode==='reviewer').id;
    assert.equal(s.workers.verifyWorkspaceSnapshot(accepted,{runId:reviewer}).data.listings.length,1);
    if(mode==='mutate-after-accept'){writeFileSync(join(s.ws.path,'new.txt'),'new');assert.throws(()=>s.workers.verifyWorkspaceSnapshot(accepted,{runId:reviewer}),{code:'WORKSPACE_CHANGED'});}
  }
  assert.equal(s.store.list('effect').length,2,'producer list plus real independent repeat; no invented observation');
});
function reviewResult(exposure,{artifactOnly=false}={}) {
  const candidate=exposure.artifacts[0];
  const own=exposure.toolObservations.find(o=>o.relation==='OWN_ACTION'&&o.tool==='workspace.read');
  const evidence=artifactOnly?[{kind:'artifact',id:candidate.id,hash:candidate.hash,quote:candidate.payload.body}]:[{kind:'tool',id:own.id,hash:own.hash,quote:own.quoteText}];
  return {artifactHash:candidate.hash,purpose:candidate.payload.purpose,decision:'ACCEPT',checks:[{criterionId:'file',verdict:'PASS',evidence,reason:'Exact independently reread file bytes match the intended result.'}],findings:[],uncertainty:''};
}
test('SIMULATED + REAL files: invalid review citation repaired in same reviewer without replaying operations',async t=>{
  const s=setup(t,({number,exposure,request})=>{
    if(number===1)return tool('workspace.write',{path:'result.txt',content:'verified result',expectedHash:null});
    if(number===2)return final();
    const result=reviewResult(exposure);
    if(number===3){result.checks[0].evidence[0].quote='a passage never observed';return result;}
    const correction=JSON.parse(exposure.task).recoveryFeedback.at(-1);
    assert.equal(correction.code,'UNOBSERVED_TOOL');
    assert.equal(correction.previousRequestedReview.checks[0].evidence[0].quote,'a passage never observed');
    assert.equal(exposure.toolObservations.length,2);
    assert.ok(request.schema.description.includes('with kind=tool must be OWN_ACTION'));
    return result;
  });
  const r=run(s),a=await s.workers.produce({missionId:'mission',node,runId:r.id});
  const accepted=await s.workers.review({artifact:a,reviewerRoleIds:node.reviewerRoleIds,missionIntent:intent});
  assert.equal(accepted.status,'ACCEPTED');assert.equal(s.count,4);
  assert.equal(s.store.list('effect').length,2,'one write and one independent read, no repair tool replay');
  const reviewers=s.store.list('run').filter(r=>r.data.mode==='reviewer');assert.equal(reviewers.length,1);
  assert.equal(reviewers[0].data.inferenceReceipts.length,2);
  const rejection=s.store.list('worker-rejected-review')[0].data;
  assert.equal(rejection.accepted,false);assert.equal(rejection.code,'UNOBSERVED_TOOL');
});
test('SIMULATED + REAL file: a producer read cannot be smuggled alongside the independent reviewer proof',async t=>{
  const s=setup(t,({number,exposure})=>{
    if(number===1)return tool('workspace.write',{path:'result.txt',content:'verified result',expectedHash:null});
    if(number===2)return tool('workspace.read',{path:'result.txt'});
    if(number===3)return final();
    const result=reviewResult(exposure);
    if(number===4){const historical=exposure.toolObservations.find(o=>o.tool==='workspace.read'&&o.relation==='EXTERNAL_OBSERVATION');
      result.checks[0].evidence.push({kind:'tool',id:historical.id,hash:historical.hash,quote:historical.quoteText});}
    else {
      const feedback=JSON.parse(exposure.task).recoveryFeedback.at(-1);assert.equal(feedback.code,'TOOL_ACTOR');
      const own=exposure.toolObservations.find(o=>o.tool==='workspace.read'&&o.relation==='OWN_ACTION'),historical=exposure.toolObservations.find(o=>o.tool==='workspace.read'&&o.relation==='EXTERNAL_OBSERVATION');
      assert.equal(feedback.validationDiagnostic.criterionId,'file');assert.equal(feedback.validationDiagnostic.evidenceKind,'tool');assert.equal(feedback.validationDiagnostic.evidenceId,historical.id);
      assert.equal(feedback.validationDiagnostic.expectedPrincipalId,own.principalId);assert.equal(feedback.validationDiagnostic.observedPrincipalId,historical.principalId);
    }
    return result;
  });
  const r=run(s),a=await s.workers.produce({missionId:'mission',node,runId:r.id});
  assert.equal((await s.workers.review({artifact:a,reviewerRoleIds:node.reviewerRoleIds,missionIntent:intent})).status,'ACCEPTED');
  assert.equal(s.count,5);assert.equal(s.store.list('effect').length,3);
  const rejection=s.store.list('worker-rejected-review')[0].data;
  assert.equal(rejection.validationDiagnostic.operationId,rejection.validationDiagnostic.evidenceId);
  assert.equal(rejection.validationDiagnostic.expectedPrincipalId,rejection.runId);
});
test('SIMULATED + REAL file: artifact citation repair identifies its exact field and retains the acceptance boundary',async t=>{
  const s=setup(t,({number,exposure,request})=>{
    if(number===1)return tool('workspace.write',{path:'result.txt',content:'verified result',expectedHash:null});
    if(number===2)return final();
    const result=reviewResult(exposure),a=exposure.artifacts[0];
    assert.ok(request.schema.description.includes('payload.body'));
    if(number===3)result.checks[0].evidence.push({kind:'artifact',id:a.id,hash:a.hash,quote:'Unobserved body passage'});
    else{
      const diagnostic=JSON.parse(exposure.task).recoveryFeedback.at(-1).citationDiagnostic;
      assert.deepEqual(diagnostic,{criterionId:'file',evidenceKind:'artifact',evidenceId:a.id,quoteField:'payload.body'});
    }
    return result;
  });
  const r=run(s),a=await s.workers.produce({missionId:'mission',node,runId:r.id});
  const accepted=await s.workers.review({artifact:a,reviewerRoleIds:node.reviewerRoleIds,missionIntent:intent});
  assert.equal(accepted.status,'ACCEPTED');assert.equal(s.count,4);assert.equal(s.store.list('effect').length,2);
  assert.equal(s.store.list('run').filter(r=>r.data.mode==='reviewer').length,1);
});
test('SIMULATED: repeated identical invalid review stops bounded repair without accepting or repeating reads',async t=>{
  const s=setup(t,({number,exposure})=>number===1?tool('workspace.write',{path:'result.txt',content:'verified result',expectedHash:null}):number===2?final():reviewResult(exposure,{artifactOnly:true}));
  const r=run(s),a=await s.workers.produce({missionId:'mission',node,runId:r.id});
  await assert.rejects(s.workers.review({artifact:a,reviewerRoleIds:node.reviewerRoleIds,missionIntent:intent}),{code:'UNVERIFIED_WRITE'});
  assert.equal(s.count,4);assert.equal(s.store.list('effect').length,2);assert.equal(s.store.list('review').length,0);
  assert.equal(s.store.list('worker-rejected-review').length,2);
});
test('SIMULATED: evidence repair may honestly return unresolved rather than inventing a passing proof',async t=>{
  const s=setup(t,({number,exposure})=>{
    if(number===1)return final('No file was produced.');
    const result=reviewResult(exposure,{artifactOnly:true});
    if(number>2){result.decision='UNKNOWN';result.checks[0].verdict='UNKNOWN';result.uncertainty='Required file is missing.';}
    return result;
  });
  const r=run(s),a=await s.workers.produce({missionId:'mission',node,runId:r.id});
  assert.equal((await s.workers.review({artifact:a,reviewerRoleIds:node.reviewerRoleIds,missionIntent:intent})).status,'RETURNED');
  assert.equal(s.count,3);assert.equal(s.store.list('effect').length,1);
});
test('SIMULATED model + REAL files: proposal, durable observation, fresh-thread final, independent reread review',async t=>{
  const s=setup(t,({number,exposure})=>number===1?tool('workspace.write',{path:'result.txt',content:'verified result',expectedHash:null}):number===2?final():reviewResult(exposure));
  const r=run(s),artifact=await s.workers.produce({missionId:'mission',node,runId:r.id,inputRefs:[]});
  assert.equal(artifact.status,'CANDIDATE');assert.equal(readFileSync(join(s.ws.path,'result.txt'),'utf8'),'verified result');
  assert.equal(s.exposures[1].toolObservations[0].status,'SUCCEEDED');assert.equal(s.exposures[1].toolObservations[0].principalId,r.id);
  assert.equal(s.exposures[1].toolObservations[0].writtenContent,'verified result','A fresh inference receives the exact bytes of its committed write without an extra read proposal');
  assert.equal(artifact.payload.toolReceipts.length,1);
  const accepted=await s.workers.review({artifact,reviewerRoleIds:node.reviewerRoleIds,missionIntent:intent});
  assert.equal(accepted.status,'ACCEPTED');assert.equal(s.count,3);assert.equal(s.closed,3);
  const reviewRun=s.store.list('run').find(x=>x.data.mode==='reviewer').data;
  assert.notEqual(reviewRun.id,r.id);assert.equal(reviewRun.context.producerConversationIncluded,false);
  assert.ok(s.exposures[2].toolObservations.some(o=>o.relation==='OWN_ACTION'&&o.tool==='workspace.read'&&o.result.content==='verified result'));
  s.registry.assertUsable(artifact.id,{missionId:'mission',purpose:node.purpose});
});
test('SIMULATED: claimed PASS from artifact body cannot replace current-state read evidence',async t=>{
  const s=setup(t,({number,exposure})=>number===1?tool('workspace.write',{path:'result.txt',content:'verified result',expectedHash:null}):number===2?final():reviewResult(exposure,{artifactOnly:true}));
  const r=run(s),a=await s.workers.produce({missionId:'mission',node,runId:r.id});
  await assert.rejects(s.workers.review({artifact:a,reviewerRoleIds:node.reviewerRoleIds,missionIntent:intent}),{code:'UNVERIFIED_WRITE'});
  assert.equal(s.store.get('artifact',a.id).data.status,'CANDIDATE');
});
test('SIMULATED: source fetch fixture is ingested and raw bytes observed before final claim',async t=>{
  const sourceNode={...node,tools:['source.fetch'],outputKind:'analysis',requiredEffects:[]};
  const s=setup(t,({number,exposure})=>{
    if(number===1)return tool('source.fetch',{url:'https://example.com/source'});
    assert.equal(exposure.sources.length,1);const source=exposure.sources[0];assert.equal(source.raw,'Exact public source fixture.');
    return {...final('The acquired fixture contains the quoted text.'),claims:[{id:'fact1',text:'The fixture contains the exact quoted sentence.',kind:'fact',sources:[{sourceId:source.id,hash:source.hash,quote:source.raw}],basis:[],qualifiers:['Fixture, not live internet evidence.'],validUntil:null}]};
  });
  const r=run(s,sourceNode),a=await s.workers.produce({missionId:'mission',node:sourceNode,runId:r.id});
  assert.equal(a.payload.claims.length,1);assert.equal(s.store.list('source').length,1);assert.ok(s.store.get('run',r.id).data.context.sourceIds.includes(a.payload.claims[0].sources[0].sourceId));
});
test('SIMULATED: tool outside node intersection never executes',async t=>{
  const s=setup(t,()=>tool('workspace.write',{path:'forbidden.txt',content:'no',expectedHash:null}));const n={...node,tools:[]};const r=run(s,n);
  await assert.rejects(s.workers.produce({missionId:'mission',node:n,runId:r.id}),{code:'AUTHORITY_SCOPE'});assert.equal(s.store.list('effect').length,0);assert.equal(s.store.list('artifact').length,0);
});
test('SIMULATED: unauthorized mission tool is rejected before model generation',async t=>{
  const s=setup(t,()=>final());const m=s.store.get('mission','mission');s.store.put('mission','mission',{...m.data,policy:{...m.data.policy,allowedTools:[]}},{expectedVersion:m.version});const r=run(s);
  await assert.rejects(s.workers.produce({missionId:'mission',node,runId:r.id}),{code:'AUTHORITY_SCOPE'});assert.equal(s.count,0);
});
test('SIMULATED: failed identical request cannot repeat under a changed method label',async t=>{
  const s=setup(t,({number})=>tool('workspace.read',{path:'missing.txt'},`method-${number}`));const r=run(s);
  await assert.rejects(s.workers.produce({missionId:'mission',node,runId:r.id}),{code:'WORKER_REPEATED_FAILURE'});assert.equal(s.store.list('effect').length,1);assert.equal(s.store.list('artifact').length,0);
});
test('SIMULATED: runner capability failure never yields a completed artifact',async t=>{
  const s=setup(t,()=>tool('execution.run',{argv:['true'],cwd:'.'}));const n={...node,tools:['execution.run']},r=run(s,n);
  await assert.rejects(s.workers.produce({missionId:'mission',node:n,runId:r.id}),{code:'CAPABILITY'});assert.equal(s.store.list('artifact').length,0);assert.equal(s.store.list('effect')[0].data.receipt.data.status,'FAILED');
});
test('SIMULATED: blocked proposal is a typed error, not a final artifact',async t=>{
  const s=setup(t,()=>({...final(),action:'blocked',body:'',reason:'Required evidence missing.'}));const r=run(s);
  await assert.rejects(s.workers.produce({missionId:'mission',node,runId:r.id}),{code:'CAPABILITY'});assert.equal(s.store.list('artifact').length,0);
});
test('SIMULATED: context cap fails explicitly without generation or silent truncation',async t=>{
  const s=setup(t,()=>final(),{maxContextBytes:16});const r=run(s);
  await assert.rejects(s.workers.produce({missionId:'mission',node,runId:r.id}),{code:'CONTEXT_LIMIT'});assert.equal(s.count,0);assert.equal(s.store.get('run',r.id).data.expectedRequestHash,undefined);
});
test('SIMULATED: provider failure closes client and leaves pending request visible for reconciliation',async t=>{
  const s=setup(t,()=>{const e=Error('synthetic failure');e.code='QUOTA';throw e;});const r=run(s);
  await assert.rejects(s.workers.produce({missionId:'mission',node,runId:r.id}),{code:'QUOTA'});assert.equal(s.closed,1);assert.ok(s.store.get('run',r.id).data.expectedRequestHash);assert.equal(s.store.list('artifact').length,0);
});
test('SIMULATED: exact schema rejects producer-added receipt authority field',async t=>{
  const s=setup(t,()=>({...final(),receipt:{fake:true}}));const r=run(s);
  await assert.rejects(s.workers.produce({missionId:'mission',node,runId:r.id}),{code:'SCHEMA'});assert.equal(s.store.list('artifact').length,0);
});
test('SIMULATED: malformed argsJson cannot reach broker',async t=>{
  const s=setup(t,()=>({...tool('workspace.read',{}),argsJson:'not JSON'}));const r=run(s);
  await assert.rejects(s.workers.produce({missionId:'mission',node,runId:r.id}),{code:'SCHEMA'});assert.equal(s.store.list('effect').length,0);
});
test('SIMULATED: requested structured rejection is retained locally without accepting inference',async t=>{
  const s=setup(t,()=>({...final(),method:''}));const r=run(s);
  await assert.rejects(s.workers.produce({missionId:'mission',node,runId:r.id}),{code:'SCHEMA'});
  const rejection=s.store.list('worker-rejected-output')[0].data;
  assert.equal(rejection.accepted,false);assert.equal(rejection.payload.method,'');assert.equal(rejection.requestHash,s.store.get('run',r.id).data.expectedRequestHash);assert.equal(s.store.get('run',r.id).data.inferenceReceipt,undefined);
});
test('SIMULATED: valid final proposal permits empty inactive blocking reason',async t=>{
  const s=setup(t,()=>({...final(),reason:''}));const r=run(s);
  const a=await s.workers.produce({missionId:'mission',node,runId:r.id});assert.equal(a.status,'CANDIDATE');assert.equal(s.store.list('worker-rejected-output').length,0);
});
test('SIMULATED + REAL file: invalid documentary source in a final proposal is corrected without repeating the write',async t=>{
  const s=setup(t,({number,exposure})=>{
    if(number===1)return tool('workspace.write',{path:'result.txt',content:'verified result',expectedHash:null});
    if(number===2)return {...final(),claims:[{id:'file-created',text:'The file was created.',kind:'fact',sources:[{sourceId:'invented-tool-source',hash:sha256('verified result'),quote:'verified result'}],basis:[],qualifiers:[],validUntil:null}]};
    const task=JSON.parse(exposure.task);assert.equal(task.corrections[0].code,'SOURCE_UNAVAILABLE');assert.equal(exposure.toolObservations.length,1);
    return final('The observed file write is bound in toolReceipts, not a fabricated documentary source.');
  });
  const r=run(s),a=await s.workers.produce({missionId:'mission',node,runId:r.id});
  assert.equal(a.status,'CANDIDATE');assert.equal(s.store.list('effect').length,1);assert.equal(s.store.list('worker-proposal').length,3);
  assert.equal(s.store.list('worker-proposal')[1].data.value.claims[0].sources[0].sourceId,'invented-tool-source');
});
test('SIMULATED: unrequested reasoning fields are not captured in rejected-output diagnostic',async t=>{
  const s=setup(t,()=>({...final(),privateReasoning:'not requested and must not be stored'}));const r=run(s);
  await assert.rejects(s.workers.produce({missionId:'mission',node,runId:r.id}),{code:'SCHEMA'});
  const rejection=s.store.list('worker-rejected-output')[0].data;assert.equal(rejection.payloadCaptured,false);assert.equal(rejection.payload,null);assert.equal(rejection.omissionReason,'UNREQUESTED_FIELDS');
});
test('SIMULATED: stable operation IDs are bound to run and step and production cannot replay',async t=>{
  const s=setup(t,({number})=>number===1?tool('workspace.write',{path:'result.txt',content:'verified result',expectedHash:null}):final());const r=run(s);
  await s.workers.produce({missionId:'mission',node,runId:r.id});assert.equal(s.store.list('effect')[0].id,`${r.id}:step:0`);
  await assert.rejects(s.workers.produce({missionId:'mission',node,runId:r.id}),{code:'WORKER_REENTRY'});assert.equal(s.store.list('effect').length,1);
});
test('SIMULATED: proposal step cap is not interpreted as completion',async t=>{
  const s=setup(t,()=>tool('workspace.list',{path:'.'}),{maxSteps:1});const n={...node,tools:['workspace.list']},r=run(s,n);
  await assert.rejects(s.workers.produce({missionId:'mission',node:n,runId:r.id}),{code:'WORKER_LIMIT'});assert.equal(s.store.list('artifact').length,0);
});
test('SIMULATED: cancellation before produce never invokes provider or tool',async t=>{
  const s=setup(t,()=>final());const r=run(s);const c=new AbortController();c.abort();
  await assert.rejects(s.workers.produce({missionId:'mission',node,runId:r.id,signal:c.signal}),{code:'CANCELLED'});assert.equal(s.count,0);assert.equal(s.store.list('effect').length,0);
});
test('SIMULATED: reviewer receives cited raw sources and source receipt data, not producer conversations',async t=>{
  const n={...node,tools:['source.fetch'],outputKind:'analysis',requiredEffects:[],criteria:[{id:'file',text:'The acquired fixture contains the exact reported sentence.'}]};
  const s=setup(t,({number,exposure})=>{
    if(number===1)return tool('source.fetch',{url:'https://example.com/fixture'});
    const source=exposure.sources[0];
    if(number===2)return {...final('Exact public source fixture.'),claims:[{id:'fact1',text:'Fixture text was acquired.',kind:'fact',sources:[{sourceId:source.id,hash:source.hash,quote:source.raw}],basis:[],qualifiers:[],validUntil:null}]};
    assert.equal(source.raw,'Exact public source fixture.');assert.equal(exposure.toolObservations[0].relation,'EXTERNAL_OBSERVATION');
    assert.ok(!('producerConversation' in exposure));
    const a=exposure.artifacts[0];return {artifactHash:a.hash,purpose:a.payload.purpose,decision:'ACCEPT',checks:[{criterionId:'file',verdict:'PASS',evidence:[{kind:'source',id:source.id,hash:source.hash,quote:source.raw}],reason:'Acquired fixture contains exact quoted text.'}],findings:[],uncertainty:'Fixture-only verification.'};
  });
  const r=run(s,n),a=await s.workers.produce({missionId:'mission',node:n,runId:r.id});
  const reviewed=await s.workers.review({artifact:a,reviewerRoleIds:n.reviewerRoleIds,missionIntent:intent});assert.equal(reviewed.status,'ACCEPTED');
  const consumer=s.workers.createRun({missionId:'mission',nodeId:'consumer',mode:'producer',purpose:'consume',roleIds:['sigma_01'],artifactIds:[a.id]});
  assert.deepEqual(consumer.context.sourceIds,a.payload.claims[0].sources.map(x=>x.sourceId));
});
test('SIMULATED: omitted required file is reread and cannot pass a body-only review',async t=>{
  const s=setup(t,({number,exposure})=>number===1?final('PASS: all files exist.'):reviewResult(exposure,{artifactOnly:true}));
  const r=run(s),a=await s.workers.produce({missionId:'mission',node,runId:r.id});
  assert.equal(a.payload.toolReceipts.length,0);assert.equal(a.payload.requiredEffects[0].path,'result.txt');
  await assert.rejects(s.workers.review({artifact:a,reviewerRoleIds:node.reviewerRoleIds,missionIntent:intent}),{code:'UNVERIFIED_WRITE'});
  const reads=s.store.list('effect').filter(e=>e.data.tool==='workspace.read');assert.equal(reads.length,1);assert.equal(reads[0].data.receipt.data.status,'FAILED');
  assert.equal(s.store.get('artifact',a.id).data.status,'CANDIDATE');
});
test('SIMULATED + REAL file: existing required file passes only with new reviewer read, without producer write',async t=>{
  const s=setup(t,({number,exposure})=>number===1?final('The previously created file exists.'):reviewResult(exposure));
  const lease=s.authority.issue({missionId:'mission',principalId:'trusted-setup',actions:['workspace.write'],resources:['workspace:mission'],classification:'INTERNAL',expiresAt:new Date(Date.now()+60000).toISOString()});
  await s.broker.execute({missionId:'mission',principalId:'trusted-setup',lease,operationId:'fixture-existing-file',tool:'workspace.write',args:{path:'result.txt',content:'verified result',expectedHash:null}});
  const r=run(s),a=await s.workers.produce({missionId:'mission',node,runId:r.id});assert.equal(a.payload.toolReceipts.length,0);
  const accepted=await s.workers.review({artifact:a,reviewerRoleIds:node.reviewerRoleIds,missionIntent:intent});assert.equal(accepted.status,'ACCEPTED');
});
test('SIMULATED: typed execution obligation blocks before model can claim PASS',async t=>{
  const s=setup(t,()=>final('PASS execution completed.'));
  const n={...node,requiredEffects:[{type:'execution',path:'.',command:'["node","--test"]',expectedExit:0}]},r=run(s,n);
  await assert.rejects(s.workers.produce({missionId:'mission',node:n,runId:r.id}),{code:'CAPABILITY'});assert.equal(s.count,0);assert.equal(s.store.list('artifact').length,0);
});
test('SIMULATED + REAL mutation: changed-during-review-inference is rejected at synchronous acceptance boundary',async t=>{
  let s;
  s=setup(t,({number,exposure})=>{
    if(number===1)return tool('workspace.write',{path:'result.txt',content:'verified result',expectedHash:null});
    if(number===2)return final();
    const staleResult=reviewResult(exposure);
    writeFileSync(join(s.ws.path,'result.txt'),'changed after model observation');
    return staleResult;
  });
  const r=run(s),a=await s.workers.produce({missionId:'mission',node,runId:r.id});
  await assert.rejects(s.workers.review({artifact:a,reviewerRoleIds:node.reviewerRoleIds,missionIntent:intent}),{code:'WORKSPACE_CHANGED'});
  assert.equal(s.store.get('artifact',a.id).data.status,'CANDIDATE');assert.equal(s.store.list('workspace-validation').length,0);
});
test('SIMULATED + REAL mutation: later re-delivery can recheck snapshot without claiming new model exposure',async t=>{
  const s=setup(t,({number,exposure})=>number===1?tool('workspace.write',{path:'result.txt',content:'verified result',expectedHash:null}):number===2?final():reviewResult(exposure));
  const r=run(s),a=await s.workers.produce({missionId:'mission',node,runId:r.id});
  const accepted=await s.workers.review({artifact:a,reviewerRoleIds:node.reviewerRoleIds,missionIntent:intent});
  const reviewer=s.store.get('review',accepted.reviews.at(-1)).data.reviewerRunId;
  const before=s.store.get('run',reviewer).data.completedExposureHash;
  const signed=s.workers.verifyWorkspaceSnapshot(accepted,{runId:reviewer});
  assert.equal(s.authority.open(signed,'workspace.validation').status,'UNCHANGED');assert.equal(s.store.get('run',reviewer).data.completedExposureHash,before);
  writeFileSync(join(s.ws.path,'result.txt'),'later change');
  assert.throws(()=>s.workers.verifyWorkspaceSnapshot(accepted,{runId:reviewer}),{code:'WORKSPACE_CHANGED'});
});
test('SIMULATED + REAL mutation: validation-only snapshot failure rolls back provisional leases and emits no failure event',async t=>{
  const s=setup(t,({number,exposure})=>number===1?tool('workspace.write',{path:'result.txt',content:'verified result',expectedHash:null}):number===2?final():reviewResult(exposure));
  const r=run(s),a=await s.workers.produce({missionId:'mission',node,runId:r.id});
  const accepted=await s.workers.review({artifact:a,reviewerRoleIds:node.reviewerRoleIds,missionIntent:intent});
  const reviewer=s.store.get('review',accepted.reviews.at(-1)).data.reviewerRunId,before=s.store.verifyJournal(),
    beforeLeases=s.store.list('lease').length,beforeValidations=s.store.list('workspace-validation').length;
  writeFileSync(join(s.ws.path,'result.txt'),'changed after acceptance');
  assert.throws(()=>s.workers.verifyWorkspaceSnapshot(accepted,{runId:reviewer,recordFailure:false}),{code:'WORKSPACE_CHANGED'});
  assert.deepEqual(s.store.verifyJournal(),before);
  assert.equal(s.store.list('lease').length,beforeLeases);assert.equal(s.store.list('workspace-validation').length,beforeValidations);
});
test('SIMULATED: runtime review criterion is committed separately without self-review circularity or hiding original criteria',async t=>{
  const n={...node,tools:[],requiredEffects:[],criteria:[{id:'content',text:'Provide a scoped answer.',evaluation:'content'},{id:'independent',text:'Record independent review.',evaluation:'runtime.independent_review'}]};
  const s=setup(t,({number,exposure,request})=>{
    if(number===1)return final('A scoped answer.');
    const task=JSON.parse(exposure.task),a=exposure.artifacts[0];
    assert.deepEqual(task.criteria.map(c=>c.id),['content']);assert.deepEqual(task.runtimeCriteria.map(c=>c.id),['independent']);
    assert.equal(a.payload.criteria.length,2);assert.equal(a.hash,sha256(a.payload));
    assert.ok(request.instructions.includes('NOT prerequisites'));
    return {artifactHash:a.hash,purpose:a.payload.purpose,decision:'ACCEPT',checks:[{criterionId:'content',verdict:'PASS',evidence:[{kind:'artifact',id:a.id,hash:a.hash,quote:a.payload.body}],reason:'Exact scoped answer observed.'}],findings:[],uncertainty:''};
  });
  const r=run(s,n),a=await s.workers.produce({missionId:'mission',node:n,runId:r.id});
  const accepted=await s.workers.review({artifact:a,reviewerRoleIds:n.reviewerRoleIds,missionIntent:intent});
  assert.equal(accepted.status,'ACCEPTED');const review=s.store.get('review',accepted.reviews.at(-1)).data;
  assert.equal(review.result.checks.length,2);assert.deepEqual(review.result.checks.map(c=>c.criterionId).sort(),['content','independent']);
  const metrics=s.store.events().find(e=>e.kind==='worker.inference.dispatched').data;assert.ok(metrics.instructionBytes>0&&metrics.inputBytes>0&&metrics.schemaBytes>0);
});
test('SIMULATED: all-runtime criteria request zero model checks, not a fabricated prior self-review',async t=>{
  const n={...node,tools:[],requiredEffects:[],criteria:[{id:'independent',text:'Commit independent review.',evaluation:'runtime.independent_review'}]};
  const s=setup(t,({number,exposure})=>{
    if(number===1)return final('No material-content acceptance claimed in this runtime-only fixture.');
    const task=JSON.parse(exposure.task),a=exposure.artifacts[0];assert.deepEqual(task.criteria,[]);assert.equal(task.runtimeCriteria.length,1);
    return {artifactHash:a.hash,purpose:a.payload.purpose,decision:'ACCEPT',checks:[],findings:[],uncertainty:'Runtime-only fixture; no content quality assertion.'};
  });
  const r=run(s,n),a=await s.workers.produce({missionId:'mission',node:n,runId:r.id});assert.equal((await s.workers.review({artifact:a,reviewerRoleIds:n.reviewerRoleIds,missionIntent:intent})).status,'ACCEPTED');
});
