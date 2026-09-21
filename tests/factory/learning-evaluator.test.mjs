import test from 'node:test';
import assert from 'node:assert/strict';
import {Store} from '../../factory/lib/store.mjs';
import {Authority} from '../../factory/lib/authority.mjs';
import {SubscriptionCaseEvaluator} from '../../factory/lib/learning-evaluator.mjs';
import {inferenceRequestHash} from '../../factory/providers/instruction-profiles.mjs';
import {sha256} from '../../factory/lib/contracts.mjs';
function setup(t,{allowSimulation=false,wrongHash=false,exit=true}={}){
  const store=new Store(':memory:'),authority=new Authority(store),sent=[];
  const effectiveRequest={instructions:'fixed prefix\ntask',input:'question without hidden oracle',schema:{type:'object'},model:'gpt-6-astra',reasoningEffort:'ultra',instructionProfile:'scoped-v1'};
  const request={effectiveRequest,effectivePrefix:'fixed prefix',executionContext:{requestHash:inferenceRequestHash(effectiveRequest),prefixHash:sha256('fixed prefix'),scopeHash:sha256('scope')},
    case:{expected:{answer:42},holdout:true},caseId:'case',caseHash:sha256('case'),evaluationId:'e',datasetHash:sha256('dataset'),roleId:'role',instructionHash:sha256('instructions'),variant:'candidate',evaluatorId:'oracle'};
  const evaluator=new SubscriptionCaseEvaluator({store,authority,allowSimulation,validate:v=>v.answer===42,measure:({value,case:c})=>({outcome:value.answer===c.expected.answer?'pass':'fail',metrics:{accuracy:value.answer===c.expected.answer?1:0}}),
    providerFactory:()=>({async generate(r){sent.push(r);const value={answer:42};await r.validate(value);return {value,receipt:{contextHash:wrongHash?'wrong':inferenceRequestHash(r),status:'completed',simulation:true}};},async close(){return {processExitObserved:exit};}})});
  t.after(()=>store.close());return {store,authority,sent,request,evaluator};
}
test('SIMULATED evaluator seam: exact profile-bound request executes; oracle and holdout metadata never enter model input',async t=>{
  const s=setup(t,{allowSimulation:true}),result=await s.evaluator.runCase(s.request);
  assert.equal(result.observations.outcome,'pass');assert.equal(result.observations.actual.simulation,true);
  assert.equal(s.sent[0].input,s.request.effectiveRequest.input);assert.ok(!Object.hasOwn(s.sent[0],'case'));
  const stored=s.store.list('learning-provider-execution')[0];
  const evidence=s.authority.open(stored.data.signed,'learning.inference');
  assert.equal(evidence.observationsHash,sha256(result.observations));assert.equal(evidence.requestHash,s.request.executionContext.requestHash);
});
test('evaluator default rejects simulated inference as real qualification',async t=>{
  const s=setup(t);await assert.rejects(s.evaluator.runCase(s.request),{code:'LEARNING_INFERENCE'});assert.equal(s.store.list('learning-provider-execution').length,0);
});
test('evaluator refuses mismatched provider request binding and unobserved process exit',async t=>{
  const s=setup(t,{allowSimulation:true,wrongHash:true});await assert.rejects(s.evaluator.runCase(s.request),{code:'LEARNING_INFERENCE'});
  const other=setup(t,{allowSimulation:true,exit:false});await assert.rejects(other.evaluator.runCase(other.request),{code:'LEARNING_CLEANUP'});
});
test('pre-cancelled evaluation never creates a provider or a dispatch record',async t=>{
  const s=setup(t,{allowSimulation:true}),controller=new AbortController();controller.abort();
  await assert.rejects(s.evaluator.runCase(s.request,{signal:controller.signal}),{code:'CANCELLED'});
  assert.equal(s.sent.length,0);assert.equal(s.store.list('learning-provider-attempt').length,0);
});
test('in-flight cancellation reaches provider, observes cleanup and never grades partial work',async t=>{
  const s=setup(t,{allowSimulation:true}),controller=new AbortController();let ready,closed=false,measured=false;
  const started=new Promise(resolve=>{ready=resolve;});
  s.evaluator.measure=()=>{measured=true;throw Error('Must not grade an interrupted inference');};
  s.evaluator.providerFactory=()=>({generate:async r=>{
    assert.equal(r.signal,controller.signal);assert.equal(inferenceRequestHash(r),s.request.executionContext.requestHash);
    ready();return new Promise((resolve,reject)=>r.signal.addEventListener('abort',()=>reject(Object.assign(Error('cancelled'),{code:'CANCELLED'})),{once:true}));
  },close:async()=>{closed=true;return {processExitObserved:true};}});
  const pending=s.evaluator.runCase(s.request,{signal:controller.signal});await started;controller.abort();
  await assert.rejects(pending,{code:'CANCELLED'});assert.equal(closed,true);assert.equal(measured,false);
  const attempt=s.store.list('learning-provider-attempt')[0].data;
  assert.equal(attempt.status,'CANCELLED');assert.equal(attempt.processExitObserved,true);assert.equal(attempt.signed,undefined);
  assert.equal(s.store.list('learning-provider-execution').length,0);
});
test('cancellation after completed inference preserves its signed usage without awarding a score',async t=>{
  const s=setup(t,{allowSimulation:true}),controller=new AbortController();let measured=false;
  s.evaluator.measure=()=>{measured=true;};
  s.evaluator.providerFactory=()=>({generate:async r=>{
    controller.abort();return {value:{answer:42},receipt:{contextHash:inferenceRequestHash(r),status:'completed',simulation:true,usage:{totalTokens:123}}};
  },close:async()=>({processExitObserved:true})});
  await assert.rejects(s.evaluator.runCase(s.request,{signal:controller.signal}),{code:'CANCELLED'});
  const attempt=s.store.list('learning-provider-attempt')[0].data;
  assert.equal(attempt.status,'CANCELLED');assert.equal(s.authority.open(attempt.signed,'learning.attempt').response.receipt.usage.totalTokens,123);
  assert.equal(measured,false);assert.equal(s.store.list('learning-provider-execution').length,0);
});
test('oracle failure retains completed provider evidence but not a successful evaluation',async t=>{
  const s=setup(t,{allowSimulation:true});s.evaluator.measure=()=>{throw Object.assign(Error('private oracle body'),{code:'ORACLE_FAILURE'});};
  await assert.rejects(s.evaluator.runCase(s.request),{code:'ORACLE_FAILURE'});
  const attempt=s.store.list('learning-provider-attempt')[0].data;
  assert.equal(attempt.status,'FAILED');assert.equal(attempt.code,'ORACLE_FAILURE');assert.ok(attempt.signed);
  assert.ok(!JSON.stringify(attempt).includes('private oracle body'));assert.equal(s.store.list('learning-provider-execution').length,0);
});
