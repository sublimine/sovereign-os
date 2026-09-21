import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {Store} from '../../factory/lib/store.mjs';
import {Authority} from '../../factory/lib/authority.mjs';
import {ArtifactRegistry} from '../../factory/lib/artifacts.mjs';
import {WorkerService} from '../../factory/lib/workers.mjs';
import {FactoryEngine} from '../../factory/lib/engine.mjs';
import {ToolBroker} from '../../factory/tools/broker.mjs';
import {readSourceContextView} from '../../factory/lib/source-context-view.mjs';
import {inferenceRequestHash} from '../../factory/providers/instruction-profiles.mjs';

// Models and capability availability are SIMULATED; controller, SQLite and
// scoped workspace listing are REAL. This is not a native execution proof.
const intent='Produce one bounded result and independently review it.';
const final=()=>({action:'final',tool:'',argsJson:'',body:'Bounded fixture result.',claims:[],method:'bounded-result',reason:''});
function plan(){return {requirements:[{id:'r1',text:intent,requestQuote:intent,criteria:[{id:'result',text:intent}]}],
  nodes:[{id:'deliver',title:'Deliver',purpose:'delivery',roleIds:['omega_02'],reviewerRoleIds:['omega_03'],
    requirementIds:['r1'],dependencies:[],method:{id:'direct',rationale:'One bounded product.',alternatives:['Independent reconstruction.']},
    instructions:intent,outputKind:'delivery',criteria:[{id:'result',text:intent}],tools:['workspace.list'],requiredEffects:[],specialist:null}],
  finalNodeId:'deliver',routingRationale:'Bounded fixture, not a general agent count.'};}
function setup(t,{selected=true,inspection=false,workerOptions={},executionAvailable=false,listFirst=false}={}){
  const directory=mkdtempSync(join(tmpdir(),'producer-operational-context-')),store=new Store(join(directory,'state.sqlite'));
  const authority=new Authority(store),registry=new ArtifactRegistry(store,authority),requests=[];let count=0,planning=0;
  const runner=executionAvailable?{available:()=>({available:true}),run:()=>{throw Error('Unexpected execution in metadata fixture');}}:null;
  const broker=new ToolBroker({store,authority,workspaceRoot:join(directory,'workspaces'),executionRunner:runner});
  const workers=new WorkerService({store,authority,registry,broker,...workerOptions,providerFactory:()=>({async generate(request){
    count++;const exposure=readSourceContextView(request.input),task=JSON.parse(exposure.task);
    const type=Object.hasOwn(request.schema.properties,'requirements')?'plan':Object.hasOwn(request.schema.properties,'plan')?'planning-control':Object.hasOwn(request.schema.properties,'artifactHash')?'review':'produce';
    requests.push({request,exposure,task,type});let value;
    if(type==='plan')value=plan();
    else if(type==='planning-control')value=++planning===1?{action:'inspect',roleIds:['omega_02','omega_03'],reason:'Inspect complete contracts.',plan:null}:{action:'plan',roleIds:[],reason:'',plan:plan()};
    else if(type==='review'){
      const a=exposure.artifacts.find(a=>a.id===task.candidateId);
      value={artifactHash:a.hash,purpose:a.payload.purpose,decision:'ACCEPT',checks:task.criteria.map(c=>({criterionId:c.id,verdict:'PASS',
        evidence:[{kind:'artifact',id:a.id,hash:a.hash,quote:a.payload.body},...exposure.toolObservations.filter(o=>o.relation==='OWN_ACTION'&&o.status==='SUCCEEDED')
          .map(o=>({kind:'tool',id:o.id,hash:o.hash,quote:o.quoteText}))],reason:'Synthetic bounded review.'})),findings:[],uncertainty:'SIMULATED model only.'};
    }else value=listFirst&&task.step===0?{action:'tool',tool:'workspace.list',argsJson:'{"path":"."}',body:'',claims:[],method:'inspect-root',reason:''}:final();
    await request.validate(value);return {value,receipt:{kind:'inference',simulation:true,status:'completed',threadId:`sim-${count}`,turnId:`turn-${count}`,
      model:request.model,reasoningEffort:request.reasoningEffort,contextHash:inferenceRequestHash(request)}};
  },async close(){}})});
  const engine=new FactoryEngine({store,authority,registry,broker,workers});
  const mission=engine.create(intent,{allowedTools:['workspace.list'],...(selected?{producerBatch:'read-test-v1'}:{}),
    ...(inspection?{planningContracts:{mode:'on-demand-v1',maxCalls:3}}:{})});
  t.after(()=>{engine.close();rmSync(directory,{recursive:true,force:true});});
  return {engine,workers,store,registry,requests,mission};
}
for(const inspection of [false,true])test('selected planner receives actual non-default producer limits before any tool: '+inspection,async t=>{
  const f=setup(t,{inspection,workerOptions:{maxSteps:5,maxToolOperations:7,maxBatchOperations:2}});
  const result=await f.engine.run(f.mission.id);assert.equal(result.mission.status,'COMPLETED');
  const plans=f.requests.filter(r=>r.type==='plan'||r.type==='planning-control');assert.equal(plans.length,inspection?2:1);
  for(const r of plans){const e=r.task.runtimeCapabilities.producerOperationalEnvelope;
    assert.ok(e,'Missing operational envelope at planning time');
    assert.deepEqual(e.limits,{maxProposalSteps:5,maxBrokerOperations:7,maxOperationsPerBatch:2});
    assert.equal(e.finalConsumesProposalStep,true);assert.equal(e.executionDiagnostics,null);
    assert.match(e.scope,/per producer/);assert.match(e.scope,/not.*permission/i);
    assert.deepEqual(r.task.allowedTools,['workspace.list']);assert.equal(r.task.originalRequest,intent);
  }
  const p=f.requests.find(r=>r.type==='produce');assert.deepEqual(p.task.operationalEnvelope,plans[0].task.runtimeCapabilities.producerOperationalEnvelope);
  assert.equal(p.task.remainingProposalSteps,5);assert.equal(f.store.list('effect').length,0);
});
test('selected producer sees decreasing actual budgets and can final with zero broker operations left',async t=>{
  const f=setup(t,{workerOptions:{maxSteps:2,maxToolOperations:1,maxBatchOperations:1},listFirst:true});
  const result=await f.engine.run(f.mission.id);assert.equal(result.mission.status,'COMPLETED',JSON.stringify(result.mission.pending));
  const p=f.requests.filter(r=>r.type==='produce');assert.equal(p.length,2);
  assert.deepEqual(p.map(r=>r.task.remainingProposalSteps),[2,1]);assert.deepEqual(p.map(r=>r.task.remainingToolOperations),[1,0]);
  const own=f.store.list('effect').filter(r=>r.data.principalId===f.store.list('run').find(r=>r.data.nodeId==='deliver').id);
  assert.equal(own.length,1);assert.equal(own[0].data.tool,'workspace.list');
  assert.equal(p[1].task.operationalEnvelope.finalConsumesProposalStep,true);
});
test('selected metadata never increases the enforced proposal ceiling',async t=>{
  const f=setup(t,{workerOptions:{maxSteps:1,maxToolOperations:3,maxBatchOperations:2},listFirst:true});
  await f.engine.run(f.mission.id);
  const p=f.requests.filter(r=>r.type==='produce');assert.ok(p.length>0);
  for(const r of p)assert.equal(r.task.remainingProposalSteps,1);
  assert.ok(f.store.list('worker-production').every(r=>r.data.errorCode==='WORKER_LIMIT'));
  assert.equal(f.store.list('artifact').filter(r=>r.data.payload.nodeId==='deliver').length,0);
});
test('known descendant reporter limitation is visible before first execution, not a claim that tests passed',async t=>{
  const f=setup(t,{executionAvailable:true});assert.equal((await f.engine.run(f.mission.id)).mission.status,'COMPLETED');
  for(const r of f.requests.filter(r=>['plan','produce'].includes(r.type))){
    const e=r.type==='plan'?r.task.runtimeCapabilities.producerOperationalEnvelope:r.task.operationalEnvelope;
    assert.ok(e?.executionDiagnostics,'Missing early execution diagnostics');
    assert.match(e.executionDiagnostics.nodeTestReporter,/may.*omit/i);
    assert.match(e.executionDiagnostics.coverage,/completion/i);assert.match(e.executionDiagnostics.coverage,/assertions/i);
    assert.match(e.executionDiagnostics.constraints,/command/);assert.match(e.executionDiagnostics.constraints,/isolation/);
    assert.equal(Object.hasOwn(e.executionDiagnostics,'passed'),false);
  }
  assert.equal(f.store.list('execution-job').length,0);
});
test('baseline and learned-scope shape remain unchanged without explicit read-test selection',async t=>{
  const f=setup(t,{selected:false,listFirst:true}),result=await f.engine.run(f.mission.id);assert.equal(result.mission.status,'COMPLETED',JSON.stringify(result.mission.pending));
  for(const r of f.requests){assert.equal(Object.hasOwn(r.task,'operationalEnvelope'),false);assert.equal(Object.hasOwn(r.task,'remainingProposalSteps'),false);
    assert.equal(Object.hasOwn(r.task.runtimeCapabilities??{},'producerOperationalEnvelope'),false);}
  for(const c of f.store.list('worker-config'))assert.equal(Object.hasOwn(c.data.compilationScope,'producerBatch'),false);
});
test('operational envelope is a detached observation, not a mutable budget or tool permission',t=>{
  const f=setup(t,{workerOptions:{maxSteps:3,maxToolOperations:2,maxBatchOperations:1}});
  const e=f.workers.producerOperationalEnvelope(f.mission.id);e.limits.maxBrokerOperations=100;e.finalConsumesProposalStep=false;
  assert.equal(f.workers.producerOperationalEnvelope(f.mission.id).limits.maxBrokerOperations,2);
  assert.equal(f.workers.producerOperationalEnvelope(f.mission.id).finalConsumesProposalStep,true);
  assert.equal(f.workers.maxToolOperations,2);assert.deepEqual(f.store.get('mission',f.mission.id).data.policy.allowedTools,['workspace.list']);
  assert.equal(f.store.list('effect').length,0);
});
test('selected contextual diagnostics cannot borrow old learned overlays',async t=>{
  const f=setup(t);f.workers.learningInstructionsResolver=()=>{throw Error('Old overlay resolver must not be called for this protocol');};
  assert.equal((await f.engine.run(f.mission.id)).mission.status,'COMPLETED');
  for(const c of f.store.list('worker-config')){assert.equal(c.data.compilationScope.producerBatch,'read-test-v1');assert.deepEqual(c.data.learnedInstructionVersions,[]);}
});
test('completed planning response retains its original envelope and is not regenerated after candidate-creation interruption',async t=>{
  const f=setup(t,{workerOptions:{maxSteps:3,maxToolOperations:5,maxBatchOperations:2}});
  const create=f.registry.create.bind(f.registry);let interrupted=false;
  f.registry.create=options=>{if(options.nodeId==='planning'&&!interrupted){interrupted=true;throw Object.assign(Error('Synthetic interruption after retained plan'),{code:'TRANSIENT_PROVIDER'});}return create(options);};
  assert.equal((await f.engine.run(f.mission.id)).mission.status,'WAITING_PROVIDER');
  const retained=f.store.list('planning-response')[0],request=f.requests.find(r=>r.type==='plan').request.input;
  assert.equal(f.requests.filter(r=>r.type==='plan').length,1);assert.ok(retained);
  assert.equal((await f.engine.run(f.mission.id)).mission.status,'COMPLETED');
  assert.equal(f.requests.filter(r=>r.type==='plan').length,1);assert.deepEqual(f.store.get('planning-response',retained.id),retained);
  assert.equal(f.requests.find(r=>r.type==='plan').request.input,request);
});
