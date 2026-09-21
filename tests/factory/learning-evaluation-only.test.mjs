import test from 'node:test';
import assert from 'node:assert/strict';
import {Store} from '../../factory/lib/store.mjs';
import {Authority} from '../../factory/lib/authority.mjs';
import {LearningService,compileLearningPrefix} from '../../factory/lib/learning-service.mjs';
import {sha256,canonical,id} from '../../factory/lib/contracts.mjs';

// Pure in-memory, explicitly simulated comparison. No model or real improvement.
const scope={roleIds:['omega_22'],purpose:'bounded-review-evaluation-fixture',mode:'reviewer',
  instructionProfile:'scoped-v1',cardEncoding:'compact-json-v1',contextEncoding:'lossless-json-v2',
  reviewEncoding:'evidence-catalog-v1',boundedReadReview:'bounded-read-response-v1',
  producerBatch:'read-test-cursor-v1',inferenceBudgetHash:sha256({fixtureBudget:3})};
const legacyScope=Object.fromEntries(Object.entries(scope).filter(([k])=>!['boundedReadReview','producerBatch','inferenceBudgetHash'].includes(k)));
const spec=()=>({missionId:'evaluation-only-fixture',evaluatorId:'trusted-simulated-case-oracle',
  cases:[{id:'held-case',input:{taskInstructions:'Return the public fixture classification.',input:'public fixture',
    schema:{type:'object',properties:{answer:{type:'boolean'}},required:['answer'],additionalProperties:false},
    model:'gpt-6-astra',reasoningEffort:'ultra',instructionProfile:'scoped-v1'},expected:'ORACLE_NOT_IN_PROVIDER_INPUT',
    required:true,holdout:true,criteria:[{metric:'accuracy',direction:'higher',threshold:1}]}],
  policy:{requireImprovement:true,activation:'evaluation-only'}});
function setup(t){
  const store=new Store(':memory:'),authority=new Authority(store),service=new LearningService({store,authority});
  t.after(()=>store.close());return {store,authority,service,initialJournal:store.verifyJournal()};
}
function register(f,{declaredScope=scope,datasetSpec=spec()}={}){
  const baseline=f.service.registerBaseline({roleId:'omega_22',datasetSpec,scope:declaredScope});
  return {baseline,candidate:f.service.propose({roleId:'omega_22',parentHash:baseline.hash,
    instructions:'SIMULATED_DIAGNOSTIC_CANDIDATE',rationale:'Tests inactive comparison boundaries only.',authorRunId:'sim-author'})};
}
async function compare(f,candidate){
  const executed=[];const result=await f.service.evaluate(candidate.candidateId,{runCase:async request=>{
    executed.push(request);const good=request.variant==='candidate',observations={outcome:good?'pass':'fail',
      metrics:{accuracy:good?1:0},actual:{simulation:true,executionContext:request.executionContext}};
    const {evaluationId,datasetHash,caseId,caseHash,roleId,instructionHash,variant,evaluatorId}=request;
    return {observations,receipt:f.authority.seal('evaluation.case',{evaluationId,datasetHash,caseId,caseHash,roleId,instructionHash,
      variant,evaluatorId,evaluatorRunId:'sim-independent-oracle',executionId:id('sim-execution'),observationsHash:sha256(observations)})};
  }});return {result,executed};
}
test('evaluation-only registration preserves complete bounded-review scope and frozen policy',t=>{
  const f=setup(t),{baseline}=register(f),c=f.service.compilation('omega_22');
  assert.equal(canonical(c.scope),canonical(scope));assert.equal(c.scopeHash,sha256(scope));
  assert.equal(baseline.instructions,compileLearningPrefix(scope));
  assert.equal(f.store.get('learning-dataset',c.datasetHash).data.policy.activation,'evaluation-only');
});
test('passing SIM evaluation cannot promote through service or registry even with a valid grant',async t=>{
  const f=setup(t),{baseline,candidate}=register(f),{result,executed}=await compare(f,candidate);
  assert.equal(result.passed,true);assert.equal(result.improved,true);assert.equal(executed.length,2);
  assert(executed.every(r=>r.executionContext.scopeHash===sha256(scope)&&!r.effectiveRequest.input.includes('ORACLE_NOT_IN_PROVIDER_INPUT')));
  const lease=f.authority.issue({missionId:'evaluation-only-fixture',principalId:'owner',actions:['instructions.promote','instructions.rollback'],
    resources:['role:omega_22'],expiresAt:new Date(Date.now()+60000).toISOString()});
  const before=f.store.verifyJournal();
  assert.throws(()=>f.service.promote(candidate.candidateId,{lease,principalId:'owner'}),{code:'LEARNING_EVALUATION_ONLY'});
  assert.throws(()=>f.service.registry.promote(candidate.candidateId,{lease,principalId:'owner'}),{code:'LEARNING_EVALUATION_ONLY'});
  assert.throws(()=>f.service.rollback({roleId:'omega_22',targetHash:baseline.hash,lease,principalId:'owner',reason:'Cannot activate through rollback.'}),{code:'LEARNING_EVALUATION_ONLY'});
  assert.throws(()=>f.service.registry.rollback({roleId:'omega_22',targetHash:baseline.hash,lease,principalId:'owner',reason:'Same boundary.'}),{code:'LEARNING_EVALUATION_ONLY'});
  assert.deepEqual(f.store.verifyJournal(),before);assert.equal(f.service.registry.getActive('omega_22').hash,baseline.hash);
});
test('evaluation-only resolver and export never provide a deployable overlay',async t=>{
  const f=setup(t),{candidate}=register(f);await compare(f,candidate);
  const before=f.store.verifyJournal();const target={model:'gpt-6-astra',reasoningEffort:'ultra'};
  assert.equal(f.service.resolve('omega_22',scope),null);
  assert.equal(f.service.resolver()('omega_22',scope,target),null);
  assert.equal(f.service.resolver()('omega_22',legacyScope,target),null);
  f.service.exportRoot='/unused-evaluation-only-fixture';
  assert.throws(()=>f.service.exportActive({roleId:'omega_22',expectedVersion:0,principalId:'owner'}),{code:'LEARNING_APPROVAL'});
  assert.deepEqual(f.store.verifyJournal(),before);assert.equal(f.store.list('learning-export').length,0);
});
test('ordinary registration still rejects modern scope without explicit evaluation-only policy',t=>{
  const f=setup(t),datasetSpec=spec();delete datasetSpec.policy.activation;
  assert.throws(()=>register(f,{datasetSpec}),{code:'SCHEMA'});assert.deepEqual(f.store.verifyJournal(),f.initialJournal);
});
for(const activation of [null,false,true,'auto','eligible','evaluation-only-v2'])test('unknown activation policy is rejected atomically: '+String(activation),t=>{
  const f=setup(t),datasetSpec=spec();datasetSpec.policy.activation=activation;
  assert.throws(()=>register(f,{declaredScope:legacyScope,datasetSpec}));assert.deepEqual(f.store.verifyJournal(),f.initialJournal);
});
for(const [name,changes,remove]of [
  ['producer mode',{mode:'producer'},[]],['unknown controller',{boundedReadReview:'invented'},[]],
  ['missing controller',{},['boundedReadReview']],['bad batch',{producerBatch:'any'},[]],
  ['null batch',{producerBatch:null},[]],['bad digest',{inferenceBudgetHash:'abc'},[]],
  ['unknown contract',{documentContext:'document-context-v1'},[]],['unqualified closed review',{controllerReview:'closed-response-v2'},[]],
])test('evaluation-only scope rejects incompatible boundary: '+name,t=>{
  const f=setup(t),declaredScope={...scope,...changes};for(const key of remove)delete declaredScope[key];
  assert.throws(()=>register(f,{declaredScope}));assert.deepEqual(f.store.verifyJournal(),f.initialJournal);
});
test('optional bounded batch/budget stay absent, not invented or copied from another scope',t=>{
  const f=setup(t),declaredScope={...scope};delete declaredScope.producerBatch;delete declaredScope.inferenceBudgetHash;
  register(f,{declaredScope});assert.deepEqual(f.service.compilation('omega_22').scope,declaredScope);
});
test('evaluation-only policy also fences a legacy-shaped experimental scope',async t=>{
  const f=setup(t),{candidate}=register(f,{declaredScope:legacyScope});await compare(f,candidate);
  assert.throws(()=>f.service.registry.promote(candidate.candidateId),{code:'LEARNING_EVALUATION_ONLY'});
});
test('resolver does not mask a replaced frozen evaluation-only dataset',t=>{
  const f=setup(t);register(f);const c=f.service.compilation('omega_22'),r=f.store.get('learning-dataset',c.datasetHash);
  f.store.put(r.type,r.id,r.data,{expectedVersion:r.version});
  assert.throws(()=>f.service.resolver()('omega_22',scope,{model:'gpt-6-astra',reasoningEffort:'ultra'}),{code:'LEARNING_DATASET'});
});
