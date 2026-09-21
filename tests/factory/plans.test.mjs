import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {Store} from '../../factory/lib/store.mjs';
import {Authority} from '../../factory/lib/authority.mjs';
import {ArtifactRegistry} from '../../factory/lib/artifacts.mjs';
import {PlanLedger, validatePlan, validatePlanProposal, processIsAlive,validateRequiredEffects} from '../../factory/lib/plans.mjs';
import {id, sha256} from '../../factory/lib/contracts.mjs';

const intent = 'Build and test the requested result.';
const criteria = [{id:'verified',text:'Observe the requested result'}];
function plan() {
  const node = (name, dependencies = []) => ({id:name,title:name,purpose:name,roleIds:['omega_02'],reviewerRoleIds:['omega_03'],requirementIds:['r1'],dependencies,
    method:{id:'inspect',rationale:'Direct inspection',alternatives:['Independent reconstruction']},instructions:'Follow frozen request',outputKind:'answer',criteria,requiredEffects:[],tools:[],specialist:null});
  return {requirements:[{id:'r1',text:intent,requestQuote:intent,criteria}],nodes:[node('build'),node('final',[{nodeId:'build',purpose:'build',reason:'Needs the produced result'}])],finalNodeId:'final',routingRationale:'Two causal products for this synthetic fixture; not an optimal universal number'};
}
function fixture(fn,{disk=false}={}) {
  const dir=disk?mkdtempSync(join(tmpdir(),'factory-plans-')):null, path=dir?join(dir,'state.sqlite'):':memory:';
  const store=new Store(path); let now='2026-09-09T10:00:00.000Z'; const clock=()=>now;
  const authority=new Authority(store,{clock}),registry=new ArtifactRegistry(store,authority,{clock}),ledger=new PlanLedger(store,{registry,clock});
  ledger.acquireEngine({ownerId:'test-engine'});
  // Synthetic inference receipts exercise real registry/state transitions; no claim of model evaluation.
  const run=(nodeId,mode='producer',artifactIds=[],missionId='m',sourceIds=[])=>{
    const r=registry.registerRun({missionId,nodeId,mode,context:{purpose:nodeId,artifactIds,sourceIds,instructionsHash:sha256('synthetic fixture'),producerConversationIncluded:false}});
    registry.attachInference(r.id,{status:'completed',threadId:id('synthetic-thread'),turnId:id('synthetic-turn')});return r.id;
  };
  const create=(nodeId,body='Synthetic result',{missionId='m',purpose=nodeId,inputRefs=[],producerRunId=run(nodeId,'producer',inputRefs.map(r=>r.artifactId),missionId),claims=[],...extra}={})=>registry.create({missionId,nodeId,producerRunId,kind:'answer',purpose,body,inputRefs,claims,criteria,...extra});
  const accept=a=>registry.review({artifactId:a.id,reviewerRunId:run(a.payload.nodeId,'reviewer',[a.id],a.missionId,a.payload.claims.flatMap(c=>c.sources.map(s=>s.sourceId))),result:{artifactHash:a.payloadHash,purpose:a.payload.purpose,decision:'ACCEPT',checks:a.payload.criteria.map(c=>({criterionId:c.id,verdict:'PASS',evidence:[{kind:'artifact',id:a.id,hash:a.payloadHash,quote:a.payload.body},...a.payload.claims.flatMap(c=>c.sources.map(s=>({kind:'source',id:s.sourceId,hash:s.hash,quote:s.quote})))],reason:'Synthetic exact body observation; not semantic quality proof'})),findings:[],uncertainty:'Synthetic fixture'}});
  const install=(p=plan())=>{const a=accept(create('planning',JSON.stringify(p),{purpose:'plan'}));ledger.install('m',p,{intent,acceptedPlanArtifactId:a.id});return a;};
  const finish=(nodeId,{inputRefs=[],...extra}={})=>{
    const producerRunId=run(nodeId,'producer',inputRefs.map(r=>r.artifactId),'m',(extra.claims??[]).flatMap(c=>c.sources.map(s=>s.sourceId)));const lease=ledger.claim('m',nodeId,{runId:producerRunId});
    const a=accept(create(nodeId,'Synthetic result',{producerRunId,inputRefs,...extra}));
    ledger.transition('m',nodeId,{...lease,status:'REVIEW_PENDING',artifactId:a.id});
    ledger.transition('m',nodeId,{...lease,status:'ACCEPTED',artifactId:a.id});return a;
  };
  const ref=a=>({artifactId:a.id,hash:a.payloadHash,purpose:a.payload.purpose});
  try { fn({store,path,clock,registry,ledger,authority,run,create,accept,install,finish,ref,setTime:t=>now=t}); }
  finally {store.close();if(dir)rmSync(dir,{recursive:true,force:true});}
}
test('plan validation rejects invented request quotes, uncovered requirements, cycles, orphans and purpose mismatches',()=>{
  const mutate=(fn,code)=>{const p=plan();fn(p);assert.throws(()=>validatePlan(p,intent),{code});};
  mutate(p=>p.requirements[0].requestQuote='not in request','MANDATE_QUOTE');
  mutate(p=>p.requirements.push({id:'r2',text:'test',requestQuote:'test',criteria}),'PLAN_COVERAGE');
  mutate(p=>p.nodes[0].dependencies.push({nodeId:'final',purpose:'final',reason:'cycle'}),'PLAN_CYCLE');
  mutate(p=>p.nodes[1].dependencies=[],'ORPHAN_WORK');
  mutate(p=>p.nodes[1].dependencies[0].purpose='other','PLAN_PURPOSE');
  mutate(p=>p.nodes[0].criteria=[],'SCHEMA');
  mutate(p=>p.nodes[0].tools=['host.unrestricted'],'PLAN_AUTHORITY');
  const p=plan(),next=plan();next.requirements[0].criteria=[{id:'easy',text:'Weakened'}];assert.throws(()=>validatePlan(next,intent,{previous:p}),{code:'MANDATE_DRIFT'});
});
test('typed effect contracts reject missing fields, escaping files and non-argv execution',()=>{
  const p=plan();delete p.nodes[0].requiredEffects;assert.throws(()=>validatePlan(p,intent),{code:'SCHEMA'});
  for(const effect of [
    {type:'file',path:'../escape',command:'',expectedExit:null},
    {type:'file',path:'.',command:'',expectedExit:null},
    {type:'file',path:'result.txt',command:'do anything',expectedExit:0},
    {type:'execution',path:'.',command:'node --test',expectedExit:0},
    {type:'execution',path:'.',command:'[]',expectedExit:0},
    {type:'execution',path:'.',command:'["node"]',expectedExit:null},
  ])assert.throws(()=>validateRequiredEffects([effect]));
  assert.doesNotThrow(()=>validateRequiredEffects([{type:'execution',path:'.',command:'["node","--test"]',expectedExit:0}]));
});
test('historical blind-role plan stays structurally readable but independent ACCEPT cannot authorize incompatible installation',()=>fixture(s=>{
  const p=plan();p.nodes[0].reviewerRoleIds=['veritas_04'];
  assert.doesNotThrow(()=>validatePlan(p,intent));
  const accepted=s.accept(s.create('planning',JSON.stringify(p),{purpose:'plan'}));
  const before=s.store.events({limit:1000}).length;
  assert.throws(()=>s.ledger.install('m',p,{intent,acceptedPlanArtifactId:accepted.id}),{code:'ROLE_EXECUTION_UNSUPPORTED'});
  assert.equal(s.store.get('plan','m'),null);assert.equal(s.store.list('node').length,0);
  assert.equal(s.store.events({limit:1000}).length,before);
  assert.equal(s.store.get('artifact',accepted.id).data.status,'ACCEPTED','Historical judgment is preserved, not a present execution permit');
}));
test('only fresh plan proposals may omit final-local checks; installed plans and all other obligations remain strict',()=>{
  const p=plan();p.nodes[1].criteria=[];
  assert.doesNotThrow(()=>validatePlanProposal(p,intent));
  assert.throws(()=>validatePlan(p,intent),{code:'SCHEMA'});
  for(const change of [
    q=>{q.nodes[0].criteria=[];},q=>{q.requirements[0].criteria=[];},
    q=>{delete q.nodes[1].criteria;},q=>{q.nodes[1].criteria=null;},
    q=>{q.nodes[1].criteria=[{id:'bad',text:'',evaluation:'content'}];},
    q=>{q.nodes[1].criteria=[{id:'bad',text:'No magic',evaluation:'always.accept'}];},
  ]){const q=structuredClone(p);change(q);assert.throws(()=>validatePlanProposal(q,intent));}
  const conflict=structuredClone(p);
  conflict.requirements[0].criteria=[{id:'no-write',text:'No writes',evaluation:'runtime.no_file_writes'}];
  conflict.nodes[1].requiredEffects=[{type:'file',path:'required.txt',command:'',expectedExit:null}];
  assert.throws(()=>validatePlanProposal(conflict,intent),{code:'PLAN_CONTROL_CONFLICT'});
  const changed=structuredClone(p);changed.requirements[0].text='Weaker mandate';
  assert.throws(()=>validatePlanProposal(changed,intent,{previous:plan()}),{code:'MANDATE_DRIFT'});
});
test('automatic replan may add but cannot erase or substitute accepted effect obligations',()=>{
  const p=plan();p.nodes[0].requiredEffects=[{type:'file',path:'required.txt',command:'',expectedExit:null}];
  const removed=plan();assert.throws(()=>validatePlan(removed,intent,{previous:p}),{code:'MANDATE_DRIFT'});
  const changed=structuredClone(p);changed.nodes[0].requiredEffects[0].path='easier.txt';assert.throws(()=>validatePlan(changed,intent,{previous:p}),{code:'MANDATE_DRIFT'});
  const added=structuredClone(p);added.nodes[1].requiredEffects=[{type:'file',path:'extra.txt',command:'',expectedExit:null}];assert.doesNotThrow(()=>validatePlan(added,intent,{previous:p}));
});
test('mission-wide absence controls cannot contradict required writes or executions in any node',()=>{
  for(const [evaluation,effect] of [
    ['runtime.no_file_writes',{type:'file',path:'result.txt',command:'',expectedExit:null}],
    ['runtime.no_code_execution',{type:'execution',path:'.',command:'["node","--test"]',expectedExit:0}],
  ]){
    const p=plan();p.nodes[0].requiredEffects=[effect];p.nodes[1].criteria=[{id:'absence',text:'No effects in final stage only',evaluation}];
    assert.throws(()=>validatePlan(p,intent),{code:'PLAN_CONTROL_CONFLICT'});
    p.nodes[1].criteria=[{id:'scope',text:'Report prior accepted work without claiming mission-wide absence',evaluation:'content'}];
    assert.doesNotThrow(()=>validatePlan(p,intent));
  }
});
test('install requires accepted exact mission/node/purpose/body, never an invented ID',()=>fixture(({ledger,create,accept})=>{
  assert.throws(()=>ledger.install('m',plan(),{intent,acceptedPlanArtifactId:'invented'}),{code:'UNACCEPTED_INPUT'});
  const a=create('planning',JSON.stringify(plan()),{purpose:'plan'});assert.throws(()=>ledger.install('m',plan(),{intent,acceptedPlanArtifactId:a.id}),{code:'UNACCEPTED_INPUT'});
  for(const options of [{missionId:'foreign',purpose:'plan'},{purpose:'wrong'}]){
    const b=accept(create('planning',JSON.stringify(plan()),options));assert.throws(()=>ledger.install('m',plan(),{intent,acceptedPlanArtifactId:b.id}),{code:'UNACCEPTED_INPUT'});
  }
  const wrongNode=accept(create('other',JSON.stringify(plan()),{purpose:'plan'}));assert.throws(()=>ledger.install('m',plan(),{intent,acceptedPlanArtifactId:wrongNode.id}),{code:'ARTIFACT_NODE'});
  const changed=plan();changed.routingRationale='Different accepted plan';const body=accept(create('planning',JSON.stringify(changed),{purpose:'plan'}));assert.throws(()=>ledger.install('m',plan(),{intent,acceptedPlanArtifactId:body.id}),{code:'PLAN_ARTIFACT'});
}));
test('node acceptance needs exact accepted product, producer, criteria and dependency version',()=>fixture(({ledger,install,finish,ref,run,create,accept})=>{
  install();const parent=finish('build');const refs=[ref(parent)],r=run('final','producer',refs.map(r=>r.artifactId)),lease=ledger.claim('m','final',{runId:r});
  ledger.transition('m','final',{...lease,status:'REVIEW_PENDING'});
  assert.throws(()=>ledger.transition('m','final',{...lease,status:'ACCEPTED',artifactId:'missing'}),{code:'UNACCEPTED_INPUT'});
  const omitted=accept(create('final','Synthetic result',{producerRunId:r}));assert.throws(()=>ledger.transition('m','final',{...lease,status:'ACCEPTED',artifactId:omitted.id}),{code:'ARTIFACT_DEPENDENCY'});
  const otherCriteria=accept(create('final','Synthetic result',{producerRunId:r,inputRefs:refs,criteria:[{id:'other',text:'Different'}]}));assert.throws(()=>ledger.transition('m','final',{...lease,status:'ACCEPTED',artifactId:otherCriteria.id}),{code:'ARTIFACT_CRITERIA'});
  const a=accept(create('final','Synthetic result',{producerRunId:r,inputRefs:refs}));assert.equal(ledger.transition('m','final',{...lease,status:'ACCEPTED',artifactId:a.id}).status,'ACCEPTED');
}));
test('ready propagates source retraction and expiration before material consumption',()=>fixture(({ledger,registry,authority,install,finish,ref,store,setTime})=>{
  install();const receipt={id:'fixture-source',missionId:'m',principalId:'test',tool:'source.fetch',status:'SUCCEEDED',argsHash:sha256({url:'https://example.com'}),
    startedAt:'2026-09-09T10:00:00.000Z',completedAt:'2026-09-09T10:00:00.000Z',result:{content:'Value 12',sha256:sha256('Value 12'),retrievedAt:'2026-09-09T10:00:00.000Z',url:'https://example.com'}};
  const signed=authority.seal('tool.receipt',receipt);store.put('effect',receipt.id,{id:receipt.id,missionId:'m',principalId:receipt.principalId,tool:receipt.tool,state:receipt.status,argsHash:receipt.argsHash,receipt:signed},{expectedVersion:0});
  const s=registry.ingestSource(signed);
  const a=finish('build',{claims:[{id:'v',text:'Value 12',kind:'fact',sources:[{sourceId:s.id,hash:s.hash,quote:'Value 12'}],basis:[],qualifiers:[],validUntil:'2026-09-09T10:01:00.000Z'}]});finish('final',{inputRefs:[ref(a)]});
  setTime('2026-09-09T10:01:00.000Z');assert.deepEqual(ledger.ready('m').map(n=>n.nodeId),['build']);assert.equal(store.get('node','m:final').data.status,'INVALIDATED');
  registry.retractSource(s.id,'Synthetic correction');assert.equal(store.get('artifact',a.id).data.status,'INVALIDATED');
}));
test('replan preserves exact accepted ancestors, invalidates changed closure and retires removed nodes',()=>fixture(({ledger,install,finish,ref,store})=>{
  install();const a=finish('build');finish('final',{inputRefs:[ref(a)]});install();assert.equal(store.get('node','m:final').data.status,'ACCEPTED');
  const p=plan();p.nodes[0].instructions='Changed method execution';install(p);assert.equal(store.get('node','m:build').data.status,'PENDING');assert.equal(store.get('node','m:final').data.status,'PENDING');
  const reduced=plan();reduced.nodes=[reduced.nodes[1]];reduced.nodes[0].dependencies=[];install(reduced);
  assert.equal(store.get('node','m:build').data.status,'CANCELLED');assert.deepEqual(ledger.ready('m').map(n=>n.nodeId),['final']);assert.throws(()=>ledger.claim('m','build',{runId:'retired-run'}),{code:'NODE_NOT_READY'});
}));
test('plan revocation stops every node until independently accepted replan',()=>fixture(({ledger,registry,install})=>{
  const p=install();registry.invalidate([p.id],{reason:'Plan withdrawn'});assert.deepEqual(ledger.ready('m'),[]);
}));
test('acceptance rejects wrong node/purpose/mission and another attempt even when registry accepted',()=>fixture(({ledger,install,create,accept,run})=>{
  install();const lease=ledger.claim('m','build',{runId:run('build')});ledger.transition('m','build',{...lease,status:'REVIEW_PENDING'});
  for(const [nodeId,options,code] of [['other',{purpose:'build'},'ARTIFACT_NODE'],['build',{purpose:'other'},'UNACCEPTED_INPUT'],['build',{missionId:'foreign'},'UNACCEPTED_INPUT'],['build',{},'ARTIFACT_PRODUCER']]){
    const a=accept(create(nodeId,'Synthetic result',options));assert.throws(()=>ledger.transition('m','build',{...lease,status:'ACCEPTED',artifactId:a.id}),{code});
  }
}));
test('upstream invalidation fences a running consumer before its late result',()=>fixture(({ledger,registry,install,finish,run,store})=>{
  install();const a=finish('build'),lease=ledger.claim('m','final',{runId:run('final')});registry.invalidate([a.id],{reason:'Fixture upstream correction'});
  assert.deepEqual(ledger.ready('m').map(n=>n.nodeId),['build']);assert.equal(store.get('node','m:final').data.status,'INVALIDATED');
  assert.throws(()=>ledger.transition('m','final',{...lease,status:'REVIEW_PENDING'}),{code:'STALE_WORKER'});
}));
test('leases, restart fencing and explicit engine ownership reject old results',()=>fixture(({ledger,store,registry,clock,install,run,setTime})=>{
  install();const lease=ledger.claim('m','build',{runId:run('build'),ttlMs:1});setTime('2026-09-09T10:00:00.001Z');
  assert.throws(()=>ledger.transition('m','build',{...lease,status:'REVIEW_PENDING'}),{code:'STALE_WORKER'});
  assert.throws(()=>ledger.recover('m'),{code:'ENGINE_OWNERSHIP'});
  ledger.releaseEngine('test-engine');const next=new PlanLedger(store,{registry,clock});next.acquireEngine({ownerId:'next-engine'});
  assert.throws(()=>ledger.recover('m',{ownerId:'test-engine'}),{code:'ENGINE_OWNERSHIP'});
  assert.deepEqual(next.recover('m',{ownerId:'next-engine'}),['build']);assert.ok(store.get('node','m:build').data.fence>lease.fence);
  assert.throws(()=>next.transition('m','build',{...lease,status:'REVIEW_PENDING'}),{code:'STALE_WORKER'});
}));
test('a long node can renew its live lease without changing fence or reviving an expired owner',()=>fixture(({ledger,install,run,setTime})=>{
  install();const lease=ledger.claim('m','build',{runId:run('build'),ttlMs:1000});setTime('2026-09-09T10:00:00.500Z');
  const renewed=ledger.renew('m','build',{runId:lease.runId,fence:lease.fence,ttlMs:2000});
  assert.equal(renewed.leaseUntil,'2026-09-09T10:00:02.500Z');assert.equal(renewed.fence,lease.fence);assert.equal(renewed.attempt,lease.attempt);
  assert.throws(()=>ledger.renew('m','build',{runId:'foreign-run',fence:lease.fence}),{code:'STALE_WORKER'});
  setTime('2026-09-09T10:00:02.500Z');assert.throws(()=>ledger.renew('m','build',{runId:lease.runId,fence:lease.fence}),{code:'STALE_WORKER'});
}));
test('exclusive ownership persists across SQLite connections; no live lock theft by elapsed time',()=>fixture(({ledger,path,setTime})=>{
  const otherStore=new Store(path),other=new PlanLedger(otherStore,{registry:new ArtifactRegistry(otherStore,new Authority(otherStore))});
  try {setTime('2030-09-09T10:00:00.000Z');assert.throws(()=>other.acquireEngine({ownerId:'other'}),{code:'ENGINE_BUSY'});ledger.releaseEngine('test-engine');assert.equal(other.acquireEngine({ownerId:'other'}).ownerId,'other');}
  finally {otherStore.close();}
},{disk:true}));
test('dead PID recovery uses signal zero only and EPERM remains alive',t=>fixture(({ledger,store,registry})=>{
  const other=new PlanLedger(store,{registry});const calls=[];t.mock.method(process,'kill',(pid,signal)=>{calls.push([pid,signal]);const e=new Error('mock');e.code='EPERM';throw e;});
  assert.equal(processIsAlive(process.pid),true);assert.throws(()=>other.acquireEngine({ownerId:'other'}),{code:'ENGINE_BUSY'});
  t.mock.restoreAll();t.mock.method(process,'kill',(pid,signal)=>{calls.push([pid,signal]);const e=new Error('mock dead PID');e.code='ESRCH';throw e;});
  assert.equal(other.acquireEngine({ownerId:'other'}).ownerId,'other');assert.throws(()=>ledger.ready('m'),{code:'ENGINE_OWNERSHIP'});assert.ok(calls.every(c=>c[1]===0));t.mock.restoreAll();
}));
