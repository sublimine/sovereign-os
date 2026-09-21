import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {Store} from '../../factory/lib/store.mjs';
import {Authority} from '../../factory/lib/authority.mjs';
import {ArtifactRegistry} from '../../factory/lib/artifacts.mjs';
import {WorkerService} from '../../factory/lib/workers.mjs';
import {FactoryEngine} from '../../factory/lib/engine.mjs';
import {ToolBroker} from '../../factory/tools/broker.mjs';
import {MissionQueue} from '../../factory/lib/queue.mjs';
import {sha256} from '../../factory/lib/contracts.mjs';
import {compactReviewEvidence,compactCatalogReview} from '../../factory/lib/review-codec.mjs';
import {CLOSED_ENTRY_V2 as CLOSED_ENTRY_MODE,CLOSED_ENTRY_CRITERIA} from '../../factory/lib/closed-entry.mjs';
import {missionReport,formatMissionReport} from '../../factory/lib/report.mjs';
import {unpackContext} from '../../factory/lib/context-codec.mjs';
import {unpackJsonContext} from '../../factory/lib/context-json-codec.mjs';
import {inferenceRequestHash} from '../../factory/providers/instruction-profiles.mjs';
import {productionScope} from '../../factory/lib/production-scope.mjs';
import {producerPlanView} from '../../factory/lib/producer-plan-view.mjs';
import {getRole} from '../../factory/catalog/index.mjs';
import {reviewEvidenceBoundary} from '../../factory/lib/review-evidence-boundary.mjs';
import {makeClosedResponseBinding,CLOSED_RESPONSE_CONTRACT,compileClosedResponsePrefix} from '../../factory/lib/closed-response-contract.mjs';
import {PURPOSE,CLOSED_ENTRY_NODE,entryContractHash} from '../../factory/lib/closed-entry-spec.mjs';

// Provider responses and public-network transport are SIMULATED. SQLite,
// WorkerService, registry, signed broker receipts and filesystem are REAL.
const tool=(name,args)=>({action:'tool',tool:name,argsJson:JSON.stringify(args),body:'',claims:[],method:'scoped-observation',reason:'Acquire requested observation'});
const final=(body='Synthetic fixture result',claims=[])=>({action:'final',tool:'',argsJson:'',body,claims,method:'observed-delivery',reason:'Return observed product for separate review'});
function makePlan(intent,{tools=[],two=false,requiredEffects=[]}={}){
  const node=(id,deps=[])=>({id,title:id,purpose:id,roleIds:['omega_02'],reviewerRoleIds:['omega_03'],requirementIds:['r1'],dependencies:deps,
    method:{id:'direct',rationale:'Concrete requested product',alternatives:['Independent reconstruction']},instructions:intent,outputKind:'delivery',criteria:[{id:'result',text:intent}],tools,requiredEffects,specialist:null});
  return {requirements:[{id:'r1',text:intent,requestQuote:intent,criteria:[{id:'result',text:intent}]}],nodes:two?[node('build'),node('deliver',[{nodeId:'build',purpose:'build',reason:'Compose from observed product'}])]:[node('deliver')],finalNodeId:'deliver',routingRationale:'Synthetic bounded case routing, not universal agent count'};
}
function forkPlan(intent){
  const p=makePlan(intent,{two:true}),b=structuredClone(p.nodes[0]);
  b.id='challenge';b.title='challenge';b.purpose='challenge';
  p.nodes.splice(1,0,b);p.nodes[2].dependencies.push({nodeId:'challenge',purpose:'challenge',reason:'Independent material challenge before integration'});
  return p;
}
function review(exposure,task,{decision='ACCEPT',reason='Observed fixture satisfies criterion',artifactOnly=false}={}){
  const a=exposure.artifacts.find(a=>a.id===task.candidateId);
  const reads=exposure.toolObservations.filter(o=>o.tool==='workspace.read'&&o.relation==='OWN_ACTION'&&o.status==='SUCCEEDED');
  const evidence=[{kind:'artifact',id:a.id,hash:a.hash,quote:a.payload.body},...exposure.sources.map(s=>({kind:'source',id:s.id,hash:s.hash,quote:s.raw}))];
  if(!artifactOnly)evidence.push(...reads.map(o=>({kind:'tool',id:o.id,hash:o.hash,quote:o.quoteText})));
  return {artifactHash:a.hash,purpose:a.payload.purpose,decision,checks:task.criteria.map(c=>({criterionId:c.id,verdict:decision==='ACCEPT'?'PASS':'FAIL',evidence,reason})),findings:decision==='ACCEPT'?[]:[{severity:'material',description:reason,recovery:'Correct the observed defect without weakening criteria'}],uncertainty:'Simulated reviewer fixture, not live semantic validation'};
}
function setup(t,respond){
  const dir=mkdtempSync(join(tmpdir(),'factory-engine-')),databasePath=join(dir,'state.sqlite'),workspaceRoot=join(dir,'workspaces');
  let store,engine,registry,broker,count=0,closed=0;const exposures=[];
  const open=()=>{
    store=new Store(databasePath);const authority=new Authority(store);registry=new ArtifactRegistry(store,authority);
    broker=new ToolBroker({store,authority,workspaceRoot,lookup:async()=>[{address:'93.184.216.34',family:4}],transport:async()=>({statusCode:200,headers:{'content-type':'text/plain'},body:Buffer.from('Synthetic record: value is 12.'),remoteAddress:'93.184.216.34'})});
    const providerFactory=()=>({async generate(request){
      count++;const wire=JSON.parse(request.input),exposure=wire.encoding==='sovereign.lossless-context.v1'?unpackContext(wire):wire.encoding==='sovereign.lossless-context.v2'?unpackJsonContext(wire):wire;
      const task=JSON.parse(exposure.task);exposures.push({exposure,task});
      const type=Object.hasOwn(request.schema.properties,'requirements')?'plan':Object.hasOwn(request.schema.properties,'artifactHash')?'review':'produce';
      const value=await respond({request,exposure,task,type,number:count,engine,store,registry,broker});assert.equal(await request.validate(value),true);
      return {value,receipt:{kind:'inference',simulation:true,status:'completed',threadId:`sim-thread-${count}`,turnId:`sim-turn-${count}`,model:request.model,reasoningEffort:request.reasoningEffort,contextHash:inferenceRequestHash(request)}};
    },async close(){closed++;}});
    const workers=new WorkerService({store,authority,registry,broker,providerFactory});engine=new FactoryEngine({store,authority,registry,broker,workers});return engine;
  };open();
  t.after(()=>{engine.close();rmSync(dir,{recursive:true,force:true});});
  return {get engine(){return engine;},get store(){return store;},get registry(){return registry;},get broker(){return broker;},get count(){return count;},get closed(){return closed;},exposures,
    reopen(){engine.close();return open();},workspace(missionId){return broker.registerWorkspace(missionId).path;}};
}
test('V2 / SIMULATED: direct answer takes two calls, exact criteria and separate review, with durable no-replay delivery',async t=>{
  const s=setup(t,({type,task,exposure,request})=>{
    assert.notEqual(type,'plan','No synthetic or generated plan on direct route');
    if(task.entryMode){
      assert.deepEqual(task.acceptanceCriteria,CLOSED_ENTRY_CRITERIA);assert.deepEqual(task.tools,[]);
      assert.match(request.instructions,/MODE: CLOSED RESPONSE PRODUCER/);assert.ok(!request.instructions.includes('Síntesis fiel'));
      assert.ok(!request.instructions.includes('Mando de misión'));
      return {action:'answer',body:'(12 + 7 + 5) / 3 = 8.',reason:'The three inputs and requested calculation are closed.'};
    }
    assert.equal(type,'review');assert.equal(exposure.missionIntent,'Calcula la media de 12, 7 y 5 sin ejecutar código.');
    assert.equal(exposure.artifacts.length,1);assert.equal(exposure.artifacts[0].payload.kind,'closed-response');
    return review(exposure,task);
  });
  const m=s.engine.create('Calcula la media de 12, 7 y 5 sin ejecutar código.',{entryMode:CLOSED_ENTRY_MODE});
  const result=await s.engine.run(m.id);assert.equal(result.mission.status,'COMPLETED',JSON.stringify(result.mission.pending));
  assert.equal(s.count,2);assert.equal(result.plan,null);assert.equal(result.nodes.length,0);
  assert.equal(result.outcome.payload.body,'(12 + 7 + 5) / 3 = 8.');assert.equal(s.store.list('effect').length,0);
  const checks=s.store.list('review')[0].data.result.checks;assert.equal(checks.length,7);assert.ok(checks.every(c=>c.verdict==='PASS'));
  const beforeReport=s.store.verifyJournal(),untrusted=missionReport(s.store,m.id);
  assert.equal(untrusted.final,null);assert.equal(untrusted.mission.finalArtifactId,null);
  assert.equal(untrusted.mission.deliveryIntegrity,'UNVERIFIED');assert.equal(untrusted.metrics.integrity,'DELIVERY_UNVERIFIED');
  assert.equal(untrusted.entry,undefined);assert.deepEqual(untrusted.reviews,[]);
  const report=missionReport(s.store,m.id,{registry:s.registry});assert.equal(report.entry,undefined);
  assert.equal(s.store.get('closed-entry',m.id).data.status,'ACCEPTED');
  assert.equal(report.final.id,result.mission.finalArtifactId);assert.equal(report.mission.deliveryIntegrity,undefined);
  assert.deepEqual(s.store.verifyJournal(),beforeReport,'both delivery-quarantine and authenticated validation are read-only');
  assert.match(formatMissionReport(report),/Último artefacto ACCEPTED/);
  assert.equal(report.metrics.integrity,'NOT_ATTESTED');assert.equal(report.metrics.operationalTelemetry,'NOT_PROJECTED');
  const previous=s.store.get('closed-entry',m.id);s.reopen();await s.engine.run(m.id);assert.equal(s.count,2);
  assert.equal(s.store.get('closed-entry',m.id).hash,previous.hash);
});
test('V2 / SIMULATED: producer requests planning once without exposing its rejected answer or public reason to planner',async t=>{
  let entries=0;
  const s=setup(t,({type,task,exposure,request})=>{
    if(task.entryMode){entries++;return {action:'plan',body:'',reason:'INADMISSIBLE_PRIVATE_ROUTING_MARKER: request requires a distinct material process.'};}
    assert.ok(!request.input.includes('INADMISSIBLE_PRIVATE_ROUTING_MARKER'));
    assert.ok(exposure.artifacts.every(a=>a.payload.kind!=='closed-response'));
    return type==='plan'?makePlan(task.originalRequest):type==='review'?review(exposure,task):final();
  });
  const m=s.engine.create('Perform the full requested process.',{entryMode:CLOSED_ENTRY_MODE});
  const result=await s.engine.run(m.id);assert.equal(result.mission.status,'COMPLETED',JSON.stringify(result.mission.pending));
  assert.equal(entries,1);assert.equal(s.count,5);assert.equal(s.store.get('closed-entry',m.id).data.disposition.code,'PLANNING_REQUIRED');
  assert.ok(result.plan);assert.equal(s.store.list('artifact').filter(r=>r.data.payload.kind==='closed-response').length,0);
  s.reopen();await s.engine.run(m.id);assert.equal(s.count,5);
});
test('V2 / SIMULATED: independent rejection sends unchanged request to full planning; rejected candidate is never an input',async t=>{
  const s=setup(t,({type,task,exposure,request})=>{
    if(task.entryMode)return {action:'answer',body:'WRONG_CLOSED_CANDIDATE',reason:'A deliberately wrong fixture route.'};
    if(type==='review'&&exposure.artifacts.some(a=>a.payload.kind==='closed-response'))return review(exposure,task,{decision:'RETURN',reason:'Required material work is absent.'});
    assert.ok(!request.input.includes('WRONG_CLOSED_CANDIDATE'));
    return type==='plan'?makePlan(task.originalRequest):type==='review'?review(exposure,task):final('Full-path product.');
  });
  const m=s.engine.create('Preserve the full obligation after an unsuitable direct answer.',{entryMode:CLOSED_ENTRY_MODE});
  const result=await s.engine.run(m.id);assert.equal(result.mission.status,'COMPLETED',JSON.stringify(result.mission.pending));
  assert.equal(s.count,6);assert.equal(s.store.get('closed-entry',m.id).data.status,'FALLBACK');
  const rejected=s.store.list('artifact').find(r=>r.data.payload.kind==='closed-response').data;
  assert.equal(rejected.status,'RETURNED');assert.equal(rejected.payload.body,'WRONG_CLOSED_CANDIDATE');
  assert.ok(s.store.list('artifact').every(r=>!r.data.payload.inputRefs.some(ref=>ref.artifactId===rejected.id)));
});
test('V2 / SIMULATED: direct review quota/restart retains exact producer candidate and does not regenerate',async t=>{
  let first=true,productions=0;
  const s=setup(t,({type,task,exposure})=>{
    if(task.entryMode){productions++;return {action:'answer',body:'Closed candidate retained.',reason:'Supplied text only.'};}
    assert.equal(type,'review');if(first){first=false;throw Object.assign(Error('Fixture quota'),{code:'QUOTA'});}
    return review(exposure,task);
  });
  const m=s.engine.create('Respond with the supplied text.',{entryMode:CLOSED_ENTRY_MODE});
  assert.equal((await s.engine.run(m.id)).mission.status,'WAITING_QUOTA');
  const checkpoint=s.store.get('closed-entry',m.id).data;assert.equal(checkpoint.status,'REVIEW_PENDING');
  const artifact=s.store.get('artifact',checkpoint.artifactId).data;
  s.reopen();const result=await s.engine.run(m.id);assert.equal(result.mission.status,'COMPLETED',JSON.stringify(result.mission.pending));
  assert.equal(productions,1);assert.equal(result.outcome.id,artifact.id);assert.equal(result.outcome.payloadHash,artifact.payloadHash);
  assert.equal(s.count,3);assert.equal(s.store.list('effect').length,0);
});
test('V2 / SIMULATED: direct production quota resumes with a fresh run and preserves the uncertain inference record',async t=>{
  let first=true;
  const s=setup(t,({task,exposure})=>{
    if(task.entryMode){if(first){first=false;throw Object.assign(Error('Fixture quota'),{code:'QUOTA'});}
      return {action:'answer',body:'Closed result.',reason:'Closed fixture.'};}
    return review(exposure,task);
  });
  const m=s.engine.create('Closed fixture request.',{entryMode:CLOSED_ENTRY_MODE});
  assert.equal((await s.engine.run(m.id)).mission.status,'WAITING_QUOTA');
  const prior=s.store.get('closed-entry',m.id).data;
  s.reopen();assert.equal((await s.engine.run(m.id)).mission.status,'COMPLETED');
  const current=s.store.get('closed-entry',m.id).data;assert.notEqual(current.runId,prior.runId);assert.equal(current.productionAttempts,2);
  assert.ok(s.store.get('run',prior.runId).data.expectedRequestHash);assert.equal(s.count,3);
  assert.equal(s.store.events({limit:1000}).filter(e=>e.kind==='entry.inference.recovered').length,1);
});
test('V2 / SIMULATED: a tool proposal cannot perform effects through the closed entry and instead follows full planning',async t=>{
  const s=setup(t,({type,task,exposure})=>{
    if(task.entryMode)return tool('workspace.write',{path:'UNAUTHORIZED.txt',content:'Do not write this',expectedHash:null});
    return type==='plan'?makePlan(task.originalRequest):type==='review'?review(exposure,task):final();
  });
  const m=s.engine.create('A closed response without effects.',{entryMode:CLOSED_ENTRY_MODE});
  assert.equal((await s.engine.run(m.id)).mission.status,'COMPLETED');
  assert.equal(s.store.list('effect').length,0);assert.equal(s.store.get('closed-entry',m.id).data.status,'FALLBACK');
  assert.ok(s.store.list('worker-rejected-output').length);assert.equal(s.count,5);
});
test('V2 / SIMULATED: cancellation before accepted direct delivery and revoked acceptance cannot be relabelled completed',async t=>{
  const controller=new AbortController();let interrupt=true;
  const s=setup(t,({type,task,exposure})=>{
    if(task.entryMode)return {action:'answer',body:'Closed result.',reason:'Supplied data.'};
    if(type==='review'&&interrupt){interrupt=false;controller.abort();return review(exposure,task);}
    return type==='plan'?makePlan(task.originalRequest):type==='review'?review(exposure,task):final();
  });
  const m=s.engine.create('Preserve cancellation and later revocation.',{entryMode:CLOSED_ENTRY_MODE});
  assert.equal((await s.engine.run(m.id,{signal:controller.signal,pauseOnAbort:true})).mission.status,'PAUSED');
  assert.equal(s.engine.status(m.id).mission.finalArtifactId,null);
  const completed=await s.engine.run(m.id);assert.equal(completed.mission.status,'COMPLETED');
  s.registry.invalidate([completed.outcome.id],{reason:'Direct response invalidated by exact scoped review.'});
  s.reopen();const result=await s.engine.run(m.id);assert.equal(result.mission.status,'COMPLETED',JSON.stringify(result.mission.pending));
  assert.notEqual(result.outcome.id,completed.outcome.id);assert.ok(result.plan);
  assert.equal(s.store.get('closed-entry',m.id).data.status,'FALLBACK');
  assert.equal(s.store.get('artifact',completed.outcome.id).data.status,'INVALIDATED');
});
test('V2 / SIMULATED: checkpoint policy drift fails before any resumed inference',async t=>{
  const s=setup(t,()=>{throw Object.assign(Error('Fixture quota'),{code:'QUOTA'});});
  const m=s.engine.create('Freeze exact entry policy.',{entryMode:CLOSED_ENTRY_MODE});
  await s.engine.run(m.id);assert.equal(s.count,1);
  const stored=s.store.get('mission',m.id);
  s.store.put('mission',m.id,{...stored.data,policy:{...stored.data.policy,maxNodeAttempts:9}},{expectedVersion:stored.version});
  s.reopen();const result=await s.engine.run(m.id);assert.equal(result.mission.status,'UNVERIFIED');
  assert.deepEqual(result.mission.pending,[],'A drifted mission is quarantined rather than exposing raw failure details publicly');
  assert.equal(s.store.get('mission',m.id).data.status,'FAILED');
  assert.equal(s.store.get('mission',m.id).data.pending[0].code,'ENTRY_DRIFT');assert.equal(s.count,1);
});

// Fixtures above are also exercised independently under v1 in engine.test.mjs.

function bareController(t){
  const s=setup(t,()=>{throw Error('Binding failures must precede provider construction');});
  const mission=s.engine.create('Return the exact supplied token: é😀.',{entryMode:CLOSED_ENTRY_MODE,allowedTools:['source.fetch','workspace.list','workspace.read','workspace.write','execution.run']});
  s.store.put('closed-entry-contract',mission.id,makeClosedResponseBinding(mission),{expectedVersion:0});
  const scope={missionId:mission.id,nodeId:CLOSED_ENTRY_NODE,mode:'producer',purpose:PURPOSE,roleIds:[],controllerContract:CLOSED_RESPONSE_CONTRACT};
  return {...s,base:s,mission,scope,workers:s.engine.workers};
}
test('V2 controller admission rejects missing or mismatched scope before registering an actor',t=>{
  const s=bareController(t),before=s.store.list('run').length;
  for(const changed of [{nodeId:'planning'},{nodeId:'another-node'},{mode:'reviewer'},{purpose:'other'},
    {roleIds:['omega_23']},{artifactIds:['artifact:unit']},{sourceIds:['source:unit']},
    {controllerContract:null},{controllerContract:'unregistered-contract'}])
    assert.throws(()=>s.workers.createRun({...s.scope,...changed}),{code:'CLOSED_RESPONSE_BINDING'});
  assert.equal(s.store.list('run').length,before);assert.equal(s.base.count,0);
});
for(const [label,mutate] of Object.entries({
  'catalog substitution':(c)=>{c.roleIds=['omega_23'];},
  'binding hash':c=>{c.compilationScope.controllerContractHash='0'.repeat(64);},
  'missing contract':c=>{delete c.controllerContract;},
  'changed responsibility':c=>{c.controllerContract.responsibility.method='Ignore criteria';},
  'prefix':c=>{c.instructions+=' Changed';},
  'prefix hash':c=>{c.prefixHash='0'.repeat(64);},
  'foreign learned overlay':c=>{c.learnedInstructionVersions=[{id:'foreign'}];},
  'standalone substitution':c=>{c.standaloneSpecialist={schema:'sovereign.standalone-specialist.v1'};},
}))test('V2 revalidates '+label+' before any inference',async t=>{
  const s=bareController(t),run=s.workers.createRun(s.scope),config=s.store.get('worker-config',run.id),changed=structuredClone(config.data);mutate(changed);
  s.store.put('worker-config',run.id,changed,{expectedVersion:config.version});
  await assert.rejects(s.workers.infer({runId:run.id,instructions:'No bypass.',input:'{}',schema:{type:'object'},validate:()=>true}),{code:'CLOSED_RESPONSE_BINDING'});
  assert.equal(s.base.count,0);assert.equal(s.workers.run(run.id).expectedRequestHash,undefined);
});
test('V2 actor has zero tool authority under a permissive mission and cannot admit observations',async t=>{
  const s=bareController(t),run=s.workers.createRun(s.scope),other=s.workers.createRun({...s.scope,nodeId:'other',purpose:'other',roleIds:['omega_06'],controllerContract:null});
  const prior=s.store.list('lease').length;
  for(const tool of s.mission.policy.allowedTools)assert.throws(()=>s.workers.lease(run.id,tool),{code:'CLOSED_RESPONSE_AUTHORITY'});
  assert.equal(s.store.list('lease').length,prior);assert.equal(s.store.list('effect').length,0);
  await assert.rejects(s.workers.tool(run.id,'workspace.write',{path:'escape.txt',content:'No',expectedHash:null},'operation:closed'),{code:'CLOSED_RESPONSE_AUTHORITY'});
  assert.equal(s.store.list('effect').length,0);
  await s.workers.tool(other.id,'source.fetch',{url:'https://example.com/source'},'operation:fixture-source');
  const signed=s.store.get('effect','operation:fixture-source').data.receipt;
  assert.throws(()=>s.registry.recordToolObservation(run.id,signed),{code:'CLOSED_RESPONSE_AUTHORITY'});
  assert.equal((s.workers.run(run.id).toolObservations??[]).length,0);
});
test('V2 cannot add source or artifact exposure and cannot weaken candidate criteria or impersonate native execution',t=>{
  const s=bareController(t),run=s.workers.createRun(s.scope);
  for(const changed of [{sourceIds:['source:foreign']},{artifactIds:['artifact:foreign']},{purpose:'other'}])
    assert.throws(()=>s.registry.updateContext(run.id,{...run.context,...changed}),{code:'CLOSED_RESPONSE_BINDING'});
  const payload={missionId:s.mission.id,nodeId:CLOSED_ENTRY_NODE,producerRunId:run.id,kind:'closed-response',purpose:PURPOSE,body:'é😀',criteria:CLOSED_ENTRY_CRITERIA};
  for(const changed of [{kind:'deterministic-result'},{purpose:'other'},{provisional:true},{criteria:CLOSED_ENTRY_CRITERIA.slice(1)},
    {claims:[{kind:'fact'}]},{inputRefs:[{}]},{toolReceipts:[{}]},{requiredEffects:[{}]}])
    assert.throws(()=>s.registry.create({...payload,...changed}),{code:'CLOSED_RESPONSE_BINDING'});
  assert.equal(s.store.list('artifact').length,0);assert.equal(s.base.count,0);
});
test('V2 same-content contract revision and mission drift are not silently reauthorized',t=>{
  const s=bareController(t),contract=s.store.get('closed-entry-contract',s.mission.id);
  s.store.put('closed-entry-contract',s.mission.id,contract.data,{expectedVersion:1});
  assert.throws(()=>s.workers.createRun(s.scope),{code:'CLOSED_RESPONSE_BINDING'});
});
test('V2 bound actor cannot resume after the mission moves to a material planned route',async t=>{
  const s=bareController(t),run=s.workers.createRun(s.scope);
  s.store.put('plan',s.mission.id,{fixture:'Presence only; not an accepted-plan fixture.'},{expectedVersion:0});
  await assert.rejects(s.workers.infer({runId:run.id,instructions:'No bypass.',input:'{}',schema:{type:'object'},validate:()=>true}),{code:'CLOSED_RESPONSE_BINDING'});
  assert.equal(s.base.count,0);
});
test('V2 complete controller prefix is reproducible and compact formatting cannot bypass its logical ceiling',t=>{
  const s=bareController(t),binding=makeClosedResponseBinding(s.mission),options={mode:'producer',purpose:PURPOSE,contextEncoding:'source-text-v1'};
  const pretty=compileClosedResponsePrefix(binding,options),compact=compileClosedResponsePrefix(binding,{...options,cardEncoding:'compact-json-v1'});
  assert.ok(pretty.includes(JSON.stringify(binding,null,2)));assert.ok(compact.includes(JSON.stringify(binding)));
  assert.ok(compact.includes('sovereign.source-context-view.v1'));assert.ok(compact.length<pretty.length);
  assert.throws(()=>compileClosedResponsePrefix(binding,{...options,cardEncoding:'compact-json-v1',maxBytes:Buffer.byteLength(pretty)-1}),{code:'CONTEXT_LIMIT'});
});
test('V2 report distinguishes the controller contract and simulated inference from a catalog or planned specialist',async t=>{
  const s=setup(t,({task,exposure})=>task.entryMode?{action:'answer',body:'é😀',reason:'Exact supplied text.'}:review(exposure,task));
  const m=s.engine.create('Return é😀 exactly.',{entryMode:CLOSED_ENTRY_MODE,cardEncoding:'compact-json-v1',contextEncoding:'lossless-json-v2'});
  assert.equal((await s.engine.run(m.id)).mission.status,'COMPLETED');
  const controller=s.store.list('worker-config').find(record=>record.data.controllerContract);
  assert.deepEqual(controller.data.roleIds,[]);assert.equal(controller.data.controllerContract.contract,CLOSED_RESPONSE_CONTRACT);
  const report=missionReport(s.store,m.id,{registry:s.registry}),serialized=JSON.stringify(report);
  assert.equal(report.controllerExecutions,undefined);assert.equal(report.entry,undefined);
  assert.ok(!serialized.includes('trusted-controller-contract'));
  assert.equal(report.metrics.integrity,'NOT_ATTESTED');assert.equal(report.metrics.operationalTelemetry,'NOT_PROJECTED');
});
test('V1 contract hash is unchanged; V2 has a distinct contract and remains opt-in',()=>{
  assert.equal(entryContractHash(),'f3650cab63bba8302702ee9f2025fa2c127ff38425f583a6f587b2e2faec65bd');
  assert.notEqual(entryContractHash(CLOSED_ENTRY_MODE),entryContractHash());
});
test('V2 neither production nor independent review invokes a legacy learned-overlay resolver',async t=>{
  const s=setup(t,({task,exposure})=>task.entryMode?{action:'answer',body:'Token.',reason:'Supplied literal.'}:review(exposure,task));
  let resolves=0;s.engine.workers.learningInstructionsResolver=()=>{resolves++;throw Error('Unqualified overlay requested');};
  const m=s.engine.create('Return Token.',{entryMode:CLOSED_ENTRY_MODE});
  assert.equal((await s.engine.run(m.id)).mission.status,'COMPLETED');assert.equal(resolves,0);
  const reviewer=s.store.list('run').find(r=>r.data.mode==='reviewer');
  assert.equal(s.store.get('worker-config',reviewer.id).data.compilationScope.controllerReview,'closed-response-v2');
  assert.ok(s.store.list('worker-config').every(c=>c.data.learnedInstructionVersions.length===0));
});
