import test from 'node:test';
import assert from 'node:assert/strict';
import {Store} from '../../factory/lib/store.mjs';
import {FactoryEngine} from '../../factory/lib/engine.mjs';
import {RegisteredLearningEvaluator,EXACT_JSON_EVALUATOR} from '../../factory/lib/registered-learning-evaluator.mjs';
import {inferenceRequestHash} from '../../factory/providers/instruction-profiles.mjs';
import {canonical,sha256} from '../../factory/lib/contracts.mjs';
import {admitLearningProvenanceFixtureSource,learningProvenanceFixturePolicy,signedLearningProvenanceFixture} from './fixtures/learning-provenance.mjs';

const fence=store=>({journal:store.verifyJournal(),versions:store.db.prepare('SELECT count(*) AS n FROM records').get().n});
function fixture(t,{evaluatorId=EXACT_JSON_EVALUATOR,criteria,activation,values=[{answer:0},{answer:42},{answer:13},{answer:13}],expected={answer:42},allowSimulation=true}={}){
  const store=new Store(':memory:');t.after(()=>store.close());
  const engine=new FactoryEngine({store,workspaceRoot:'/tmp/sovereign-registered-evaluator-no-tools',learningProvenancePolicy:learningProvenanceFixturePolicy}),service=engine.learning,conductor=engine.learningConductor;
  const scope={roleIds:['sigma_01'],purpose:'registered-exact-json-fixture',mode:'producer',instructionProfile:'scoped-v1'};
  const input={taskInstructions:'Return the requested JSON object.',input:'question without the oracle',schema:{type:'object'},model:'gpt-6-astra',reasoningEffort:'ultra',instructionProfile:'scoped-v1'};
  const spec={missionId:'local-evaluation',evaluatorId,cases:[
    {id:'private-case-identity',input,expected,required:true,holdout:false,criteria:criteria??[{metric:'exactMatch',direction:'higher',threshold:1}]},
    {id:'private-holdout-identity',input:{...input,input:'independent frozen question'},expected:{answer:13},required:true,holdout:true,criteria:[{metric:'exactMatch',direction:'higher',threshold:1}]}
  ],policy:{requireImprovement:true,...(activation?{activation}:{})}};
  const request={domainId:'registered-learning-evaluator-fixture',roleId:'sigma_01',scope,datasetSpec:spec};
  const source=admitLearningProvenanceFixtureSource(store,{missionId:spec.missionId});
  const domain=service.registerDomain({...request,...(spec.policy.activation==='evaluation-only'?{}:{provenance:signedLearningProvenanceFixture({...request,service,source})})});
  const baseline=domain.baseline;
  store.put('run','observed-worker',{id:'observed-worker',missionId:'observed-mission',mode:'producer',context:{purpose:scope.purpose},
    inferenceReceipts:[{status:'completed',simulation:false,model:'gpt-6-astra',reasoningEffort:'ultra'}]},{expectedVersion:0});
  store.put('worker-config','observed-worker',{compilationScope:scope},{expectedVersion:0});
  const rejected=store.put('worker-rejected-output','rejection',{runId:'observed-worker',accepted:false,code:'SCHEMA',payload:{answer:'wrong type'}},{expectedVersion:0});
  const ref=(({type,id,version,hash})=>({type,id,version,hash}))(rejected),proposals=[],sent=[];let closed=0;
  conductor.allowSimulation=true;
  conductor.providerFactory=()=>({async generate(r){proposals.push(r);const value={action:'propose',instructions:'Fixture only: check the exact requested value.',rationale:'SIM plumbing qualification, not real learning.',evidenceIds:['worker-rejected-output:rejection:1']};r.validate(value);return {value,receipt:{status:'completed',simulation:true,contextHash:inferenceRequestHash(r)}};},async close(){return {processExitObserved:true};}});
  const providerFactory=()=>({async generate(r){const value=values[sent.length];sent.push(r);assert.equal(await r.validate(value),true,'wrong answer must still reach measurement without oracle feedback');return {value,receipt:{status:'completed',simulation:true,contextHash:inferenceRequestHash(r)}};},async close(){closed++;return {processExitObserved:true};}});
  const evaluator=new RegisteredLearningEvaluator({service,conductor,providerFactory,allowSimulation});
  const cycle=conductor.open({roleId:domain.policyId,runId:'observed-worker',evidenceRefs:[ref]});
  return {engine,store,service,conductor,evaluator,cycle,baseline,policyId:domain.policyId,spec,proposals,sent,providerFactory,closed:()=>closed};
}

test('engine exposes the registered evaluator without dispatch, observation or activation',t=>{
  const store=new Store(':memory:');t.after(()=>store.close());
  const engine=new FactoryEngine({store,workspaceRoot:'/tmp/sovereign-registered-evaluator-no-tools'});
  assert.equal(typeof engine.learningEvaluation?.list,'function');
  assert.equal(typeof engine.learningEvaluation?.evaluate,'function');
  const before=store.verifyJournal();
  assert.deepEqual(engine.learningEvaluation.list(),[]);
  assert.deepEqual(store.verifyJournal(),before);
  for(const type of ['learning-cycle','learning-provider-attempt','learning-proposal','queue-job'])assert.equal(store.list(type).length,0);
});

test('SIM: registered comparison measures complete exact values, preserves requests and never auto-activates',async t=>{
  const f=fixture(t),proposed=await f.conductor.advance(f.cycle.id),before=fence(f.store);
  const info=f.evaluator.list()[0];assert.equal(info.executable,true);assert.equal(info.pairedInferenceCalls,4);assert.deepEqual(fence(f.store),before);
  for(const secret of ['private-case-identity','private-holdout-identity','question without the oracle','"expected"'])assert(!JSON.stringify(info).includes(secret));
  const result=await f.evaluator.evaluate(f.cycle.id);
  assert.equal(result.status,'READY_FOR_PROMOTION');assert.equal(f.proposals.length,1);assert.equal(f.sent.length,4);assert.equal(f.closed(),4);
  assert.equal(f.service.registry.getActive(f.policyId).hash,f.baseline.hash);
  const evaluation=f.store.get('learning-evaluation',proposed.candidateId).data;
  assert.equal(evaluation.passed,true);assert.equal(evaluation.improved,true);
  for(const [index,r] of f.sent.entries()){
    const stored=f.store.list('learning-case').find(x=>x.data.caseId===f.spec.cases[Math.floor(index/2)].id&&x.data.variant===(index%2?'candidate':'baseline')).data;
    assert.equal(inferenceRequestHash(r),stored.result.observations.actual.executionContext.requestHash);
    assert.equal(r.input,f.spec.cases[Math.floor(index/2)].input.input);
    assert.equal(r.model,'gpt-6-astra');assert.equal(r.reasoningEffort,'ultra');assert.equal(r.instructionProfile,'scoped-v1');
    assert.equal(r.instructions.includes('Fixture only: check'),Boolean(index%2));
    for(const field of ['expected','holdout','case','evaluatorId'])assert(!Object.hasOwn(r,field));
    assert(!r.input.includes('private-case-identity'));assert(!r.instructions.includes('private-holdout-identity'));
  }
  const after=fence(f.store);assert.deepEqual(await f.evaluator.evaluate(f.cycle.id),result);assert.deepEqual(fence(f.store),after);assert.equal(f.sent.length,4);
  for(const type of ['effect','learning-export','queue-job'])assert.equal(f.store.list(type).length,0);
});

for(const [name,expected,actual,pass] of [
  ['object order',{b:2,a:1},{a:1,b:2},true],
  ['numeric type',{answer:42},{answer:'42'},false],
  ['array order',{answer:[1,2]},{answer:[2,1]},false],
  ['extra field',{answer:42},{answer:42,extra:true},false],
  ['whitespace',{answer:' x '},{answer:'x'},false],
  ['Unicode normalization',{answer:'é'},{answer:'e\u0301'},false]
])test(`exact JSON oracle: ${name} has explicit value semantics`,async t=>{
  const f=fixture(t,{expected,values:[{bad:true},actual,{answer:13},{answer:13}]});await f.conductor.advance(f.cycle.id);
  assert.equal((await f.evaluator.evaluate(f.cycle.id)).status,pass?'READY_FOR_PROMOTION':'REJECTED');
  const e=f.store.get('learning-evaluation',f.conductor.get(f.cycle.id).candidateId).data;
  assert.equal(e.results[1].result.observations.metrics.exactMatch,pass?1:0);
});

for(const [name,options,code] of [
  ['unknown evaluator',{evaluatorId:'not-an-implementation'},'LEARNING_EVALUATOR'],
  ['path-like identifier',{evaluatorId:'file:arbitrary-code.mjs'},'LEARNING_EVALUATOR'],
  ['wrong metric',{criteria:[{metric:'accuracy',direction:'higher',threshold:1}]},'LEARNING_EVALUATOR_CONTRACT'],
  ['relaxed threshold',{criteria:[{metric:'exactMatch',direction:'higher',threshold:0}]},'LEARNING_EVALUATOR_CONTRACT'],
  ['inverted direction',{criteria:[{metric:'exactMatch',direction:'lower',threshold:1}]},'LEARNING_EVALUATOR_CONTRACT']
])test(`registered evaluator preflight: ${name} is rejected before any mutation or call`,async t=>{
  const f=fixture(t,options);await f.conductor.advance(f.cycle.id);const before=fence(f.store);
  assert.equal(f.evaluator.list()[0].code,code);assert.equal(f.evaluator.list()[0].executable,false);
  await assert.rejects(f.evaluator.evaluate(f.cycle.id),{code});assert.deepEqual(fence(f.store),before);assert.equal(f.sent.length,0);
  assert.equal(f.conductor.get(f.cycle.id).status,'PROPOSED');assert.equal(f.store.list('learning-evaluation').length,0);
});

test('registered evaluator validates the last case before spending on the first',async t=>{
  const f=fixture(t);await f.conductor.advance(f.cycle.id);
  const cycle=f.conductor.get(f.cycle.id),original=f.evaluator.dataset.bind(f.evaluator);
  f.evaluator.dataset=(roleId)=>{const r=original(roleId);r.spec.cases[1].criteria[0].threshold=0;return r;};
  const before=fence(f.store);await assert.rejects(f.evaluator.evaluate(cycle.id),{code:'LEARNING_EVALUATOR_CONTRACT'});
  assert.deepEqual(fence(f.store),before);assert.equal(f.sent.length,0);
});

for(const state of ['OBSERVED','PROPOSING'])test(`learn-evaluate cannot start/recover a proposal in ${state}`,async t=>{
  const f=fixture(t);if(state!=='OBSERVED')f.conductor.update(f.cycle.id,{status:state});const before=fence(f.store);
  await assert.rejects(f.evaluator.evaluate(f.cycle.id),{code:'LEARNING_STATE'});assert.deepEqual(fence(f.store),before);
  assert.equal(f.proposals.length,0);assert.equal(f.sent.length,0);
});

test('equal outcomes are rejected as NO_MEASURED_IMPROVEMENT, not relabelled success',async t=>{
  const f=fixture(t,{values:[{answer:42},{answer:42},{answer:13},{answer:13}]});await f.conductor.advance(f.cycle.id);
  const result=await f.evaluator.evaluate(f.cycle.id);assert.equal(result.status,'REJECTED');
  assert(f.store.get('learning-evaluation',result.candidateId).data.issues.some(x=>x.code==='NO_MEASURED_IMPROVEMENT'));
});
test('a training-case improvement cannot excuse a holdout regression',async t=>{
  const f=fixture(t,{values:[{answer:0},{answer:42},{answer:13},{answer:0}]});await f.conductor.advance(f.cycle.id);
  const result=await f.evaluator.evaluate(f.cycle.id);assert.equal(result.status,'REJECTED');
  const e=f.store.get('learning-evaluation',result.candidateId).data;assert.equal(e.improved,true);
  assert(e.issues.some(x=>x.code==='OUTCOME_REGRESSION'));assert.equal(f.service.registry.getActive(f.policyId).hash,f.baseline.hash);
});
test('evaluation-only policy remains inactive after a passing executable SIM comparison',async t=>{
  const f=fixture(t,{activation:'evaluation-only'});await f.conductor.advance(f.cycle.id);
  const result=await f.evaluator.evaluate(f.cycle.id);assert.equal(result.status,'EVALUATED_ONLY');
  assert.throws(()=>f.service.promote(result.candidateId,{}),{code:'LEARNING_EVALUATION_ONLY'});
});
test('unknown interrupted execution never replays; completed comparison reconciles without provider creation',async t=>{
  const f=fixture(t);await f.conductor.advance(f.cycle.id);f.conductor.update(f.cycle.id,{status:'EVALUATING'});
  assert.equal((await f.evaluator.evaluate(f.cycle.id)).status,'INTERRUPTED');assert.equal(f.sent.length,0);
  const g=fixture(t);await g.conductor.advance(g.cycle.id);const cycle=g.conductor.get(g.cycle.id);
  await g.service.evaluate(cycle.candidateId,{runCase:g.evaluator.prepare(cycle)});g.conductor.update(cycle.id,{status:'EVALUATING'});
  g.evaluator.providerFactory=()=>{throw Error('Recovery must not start provider');};
  assert.equal((await g.evaluator.evaluate(cycle.id)).status,'READY_FOR_PROMOTION');assert.equal(g.sent.length,4);
});
test('pre-cancelled comparison leaves exact state and one-shot evaluation available',async t=>{
  const f=fixture(t);await f.conductor.advance(f.cycle.id);const before=fence(f.store),c=new AbortController();c.abort();
  assert.equal((await f.evaluator.evaluate(f.cycle.id,{signal:c.signal})).status,'PROPOSED');assert.deepEqual(fence(f.store),before);assert.equal(f.sent.length,0);
});
test('SIM receipt is rejected by production default after cleanup without grading',async t=>{
  const f=fixture(t,{allowSimulation:false});await f.conductor.advance(f.cycle.id);
  await assert.rejects(f.evaluator.evaluate(f.cycle.id),{code:'LEARNING_INFERENCE'});assert.equal(f.closed(),1);assert.equal(f.sent.length,1);
  assert.equal(f.store.list('learning-provider-execution').length,0);assert.equal(f.store.get('learning-evaluation',f.conductor.get(f.cycle.id).candidateId).data.passed,false);
});
test('prepared evaluator refuses altered expected/case or evaluator binding before dispatch',async t=>{
  const f=fixture(t);await f.conductor.advance(f.cycle.id);const cycle=f.conductor.get(f.cycle.id),run=f.evaluator.prepare(cycle);
  const before=fence(f.store),c=f.spec.cases[0];
  for(const patch of [{evaluatorId:'other'},{case:{...c,expected:{answer:0}}},{caseId:'other-case'},{datasetHash:sha256('wrong')},{roleId:'omega_22'}]){
    assert.throws(()=>run({evaluatorId:EXACT_JSON_EVALUATOR,datasetHash:cycle.datasetHash,roleId:cycle.roleId,caseId:c.id,caseHash:sha256(c),case:c,...patch}),{code:'LEARNING_EVALUATOR_CONTRACT'});
  }
  assert.deepEqual(fence(f.store),before);assert.equal(f.sent.length,0);
});
test('registered comparison respects a live exclusive learning coordinator',async t=>{
  const f=fixture(t);await f.conductor.advance(f.cycle.id);f.conductor.acquire();
  const before=fence(f.store);
  try{await assert.rejects(f.evaluator.evaluate(f.cycle.id),{code:'LEARNING_BUSY'});assert.deepEqual(fence(f.store),before);assert.equal(f.sent.length,0);}finally{f.conductor.release();}
});
test('cancel after completed inference preserves its signed attempt and never repeats or grades it',async t=>{
  const f=fixture(t);await f.conductor.advance(f.cycle.id);const c=new AbortController();let calls=0,closed=0;
  f.evaluator.providerFactory=()=>({async generate(r){calls++;c.abort();return {value:{answer:42},receipt:{status:'completed',simulation:true,contextHash:inferenceRequestHash(r),usage:{totalTokens:7}}};},async close(){closed++;return {processExitObserved:true};}});
  await assert.rejects(f.evaluator.evaluate(f.cycle.id,{signal:c.signal}),{code:'CANCELLED'});assert.equal(calls,1);assert.equal(closed,1);
  const cycle=f.conductor.get(f.cycle.id);assert.equal(cycle.status,'FAILED');assert.equal(cycle.lastCode,'CANCELLED');
  const attempt=f.store.list('learning-provider-attempt')[0].data;assert.equal(attempt.status,'CANCELLED');
  assert.equal(f.service.authority.open(attempt.signed,'learning.attempt').response.receipt.usage.totalTokens,7);
  assert.equal(f.store.list('learning-provider-execution').length,0);assert.equal(f.store.list('learning-case').length,0);
  const before=fence(f.store);await f.evaluator.evaluate(f.cycle.id);assert.deepEqual(fence(f.store),before);assert.equal(calls,1);
});
test('replaced frozen dataset is a hard integrity error, not unsupported or a new executable domain',async t=>{
  const f=fixture(t);await f.conductor.advance(f.cycle.id);const cycle=f.conductor.get(f.cycle.id);
  f.store.put('learning-dataset',cycle.datasetHash,{...f.spec,evaluatorId:'tampered'},{expectedVersion:1});const before=fence(f.store);
  assert.throws(()=>f.evaluator.list(),{code:'LEARNING_DOMAIN'});
  await assert.rejects(f.evaluator.evaluate(cycle.id),{code:'LEARNING_DOMAIN'});assert.deepEqual(fence(f.store),before);assert.equal(f.sent.length,0);
});
