import test from 'node:test';import assert from 'node:assert/strict';
import {Store} from '../../factory/lib/store.mjs';import {Authority} from '../../factory/lib/authority.mjs';
import {LearningService,compileLearningPrefix} from '../../factory/lib/learning-service.mjs';
import {LearningConductor} from '../../factory/lib/learning-conductor.mjs';
import {sha256,id,canonical} from '../../factory/lib/contracts.mjs';
const scope={roleIds:['omega_22'],purpose:'sourced-review-fixture',mode:'reviewer',instructionProfile:'scoped-v1',
  cardEncoding:'compact-json-v1',contextEncoding:'lossless-json-v2',reviewEncoding:'evidence-catalog-v1',
  producerBatch:'read-test-cursor-v1',inferenceBudgetHash:sha256({fixtureBudget:6}),sourcedResponseReview:'sourced-response-v1'};
const spec=()=>({missionId:'source-evaluation-fixture',evaluatorId:'trusted-local-fixture',cases:[{id:'known-construction-case',
  input:{taskInstructions:'Synthetic classification test, no model.',input:'public-data',schema:{type:'object'},model:'gpt-6-astra',reasoningEffort:'ultra',instructionProfile:'scoped-v1'},
  expected:'ORACLE_NOT_SENT',required:true,holdout:false,criteria:[{metric:'accuracy',direction:'higher',threshold:1}]}],policy:{requireImprovement:true,activation:'evaluation-only'}});
function setup(t){const store=new Store(':memory:'),authority=new Authority(store),service=new LearningService({store,authority});t.after(()=>store.close());return {store,authority,service};}
const state=s=>({floor:s.db.prepare('PRAGMA user_version').get().user_version,journal:s.verifyJournal(),records:s.db.prepare('SELECT type,id,version,hash FROM records ORDER BY type,id,version').all()});
const register=(f,name='source',{declaredScope=scope,datasetSpec=spec()}={})=>f.service.registerDomain({domainId:name,roleId:'omega_22',scope:declaredScope,datasetSpec});
async function compare(f,d){let calls=0;const candidate=f.service.propose({roleId:d.policyId,parentHash:d.baseline.hash,instructions:'SIMULATED_SOURCE_CANDIDATE',rationale:'Local fixture only.',authorRunId:'fixture-author'});
  const result=await f.service.evaluate(candidate.candidateId,{runCase:async r=>{calls++;assert(!r.effectiveRequest.input.includes('ORACLE_NOT_SENT'));
    assert.equal(r.executionContext.scopeHash,sha256(scope));const good=r.variant==='candidate',observations={outcome:good?'pass':'fail',metrics:{accuracy:good?1:0},actual:{simulation:true,executionContext:r.executionContext}};
    const {evaluationId,datasetHash,caseId,caseHash,roleId,instructionHash,variant,evaluatorId}=r;
    return {observations,receipt:f.authority.seal('evaluation.case',{evaluationId,datasetHash,caseId,caseHash,roleId,instructionHash,variant,evaluatorId,evaluatorRunId:'fixture-evaluator',executionId:id('synthetic-case'),observationsHash:sha256(observations)})};}});
  return {candidate,result,calls};}
test('source evaluation-only preserves full reviewer scope and disjoint budget domains',t=>{
  const f=setup(t),a=register(f),other={...scope,inferenceBudgetHash:sha256({fixtureBudget:3})},b=register(f,'source-other',{declaredScope:other});
  assert.notEqual(a.policyId,b.policyId);assert.deepEqual(f.service.compilation(a.policyId).scope,scope);assert.deepEqual(f.service.compilation(b.policyId).scope,other);
  assert.equal(a.baseline.instructions,compileLearningPrefix(scope));assert.equal(b.baseline.instructions,a.baseline.instructions);
  assert.notEqual(f.service.compilation(a.policyId).scopeHash,f.service.compilation(b.policyId).scopeHash);
  assert.equal(f.service.registry.activationPolicy(a.policyId),'evaluation-only');
});
test('source SIM comparison cannot resolve, promote, rollback or export its inactive domain',async t=>{
  const f=setup(t),d=register(f),{candidate,result,calls}=await compare(f,d);assert(result.passed&&result.improved);assert.equal(calls,2);
  const lease=f.authority.issue({missionId:spec().missionId,principalId:'fixture-owner',actions:['instructions.promote','instructions.rollback','instructions.export'],resources:['role:'+d.policyId],expiresAt:new Date(Date.now()+60000).toISOString()}),before=state(f.store);
  assert.throws(()=>f.service.promote(candidate.candidateId,{lease,principalId:'fixture-owner'}),{code:'LEARNING_EVALUATION_ONLY'});
  assert.throws(()=>f.service.registry.promote(candidate.candidateId,{lease,principalId:'fixture-owner'}),{code:'LEARNING_EVALUATION_ONLY'});
  assert.throws(()=>f.service.rollback({roleId:d.policyId,targetHash:d.baseline.hash,lease,principalId:'fixture-owner',reason:'Cannot deploy evaluation-only.'}),{code:'LEARNING_EVALUATION_ONLY'});
  assert.equal(f.service.resolve(d.policyId,scope),null);assert.equal(f.service.resolver()('omega_22',scope,{model:'gpt-6-astra',reasoningEffort:'ultra'}),null);
  f.service.exportRoot='/unused-source-evaluation-fixture';assert.throws(()=>f.service.exportActive({roleId:d.policyId,expectedVersion:0,lease,principalId:'fixture-owner'}),{code:'LEARNING_APPROVAL'});
  assert.deepEqual(state(f.store),before);
});
test('source completed comparison reconciles to EVALUATED_ONLY and never schedules promotion on replay',async t=>{
  const f=setup(t),d=register(f),{candidate}=await compare(f,d),c=f.service.compilation(d.policyId),cycleId='source-sim-cycle';
  f.store.put('learning-cycle',cycleId,{id:cycleId,roleId:d.policyId,policyId:d.policyId,agentRoleId:d.roleId,domainId:d.domainId,
    runId:'fixture',missionId:spec().missionId,evidenceRefs:[],scopeHash:c.scopeHash,datasetHash:c.datasetHash,parentHash:d.baseline.hash,status:'EVALUATING',candidateId:candidate.candidateId},{expectedVersion:0});
  let calls=0;const conductor=new LearningConductor({service:f.service,providerFactory:()=>{throw Error('No new proposal');}});
  const options={autoPromote:true,runCase:()=>{calls++;throw Error('No repeated comparison');}};
  assert.equal((await conductor.advance(cycleId,options)).status,'EVALUATED_ONLY');assert.equal((await conductor.advance(cycleId,options)).status,'EVALUATED_ONLY');assert.equal(calls,0);
});
test('source evaluator contract can omit optional batch and budget without inventing either',t=>{
  const f=setup(t),s={...scope};delete s.producerBatch;delete s.inferenceBudgetHash;const d=register(f,'minimal',{declaredScope:s});
  assert.equal(canonical(f.service.compilation(d.policyId).scope),canonical(s));
});
for(const [name,patch,remove]of [
  ['producer',{mode:'producer'},[]],['null source',{sourcedResponseReview:null},[]],['unknown source',{sourcedResponseReview:'another'},[]],
  ['mixed controllers',{boundedReadReview:'bounded-read-response-v1'},[]],['mixed unknown bounded',{boundedReadReview:'unknown'},[]],
  ['controller absent',{},['sourcedResponseReview']],['null batch',{producerBatch:null},[]],['bad budget',{inferenceBudgetHash:'invalid'},[]],
  ['producer own contract',{sourcedResponseContractHash:'a'.repeat(64)},[]],['closed reviewer',{controllerReview:'closed-response-v2'},[]],
])test('source learning rejects incompatible scope atomically: '+name,t=>{
  const f=setup(t),s={...scope,...patch};for(const k of remove)delete s[k];const before=state(f.store);
  assert.throws(()=>register(f,'invalid',{declaredScope:s}));assert.deepEqual(state(f.store),before);
});
test('source reviewer scope never becomes operational merely by omitting evaluation-only',t=>{
  const f=setup(t),datasetSpec=spec();delete datasetSpec.policy.activation;const before=state(f.store);
  assert.throws(()=>register(f,'operational',{datasetSpec}),{code:'SCHEMA'});assert.deepEqual(state(f.store),before);
});
