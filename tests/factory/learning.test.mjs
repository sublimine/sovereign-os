import test from 'node:test';
import assert from 'node:assert/strict';
import {Store} from '../../factory/lib/store.mjs';
import {Authority} from '../../factory/lib/authority.mjs';
import {LearningRegistry} from '../../factory/lib/learning.mjs';
import {id,sha256} from '../../factory/lib/contracts.mjs';

const spec=()=>({missionId:'mission-learning',evaluatorId:'trusted-math-evaluator',cases:[
  {id:'visible',input:[2,2],expected:4,required:true,holdout:false,criteria:[{metric:'accuracy',direction:'higher',threshold:1}]},
  {id:'reserved',input:[7,3],expected:10,required:true,holdout:true,criteria:[{metric:'accuracy',direction:'higher',threshold:1}]},
],policy:{requireImprovement:true}});
function fixture() {
  const store=new Store(':memory:');const authority=new Authority(store);const registry=new LearningRegistry(store,authority);
  const baseline=registry.registerBaseline({roleId:'calculator',instructions:'subtract',datasetSpec:spec()});
  const candidate=registry.propose({roleId:'calculator',parentHash:baseline.hash,instructions:'add',rationale:'Addition is required by the frozen arithmetic cases.',authorRunId:'author-run'});
  const lease=authority.issue({missionId:'mission-learning',principalId:'owner',actions:['instructions.promote','instructions.rollback'],resources:['role:calculator'],expiresAt:new Date(Date.now()+3600000).toISOString()});
  return {store,authority,registry,baseline,candidate,lease};
}
function receipt(f,r,observations,overrides={}) {
  const {evaluationId,datasetHash,caseId,caseHash,roleId,instructionHash,variant,evaluatorId}=r;
  return f.authority.seal('evaluation.case',{evaluationId,datasetHash,caseId,caseHash,roleId,instructionHash,variant,evaluatorId,evaluatorRunId:'independent-evaluator-run',executionId:id('execution'),observationsHash:sha256(observations),...overrides});
}
function runner(f,change=x=>x,alterReceipt=()=>({})) {
  return async r=>{
    // Real deterministic callback execution, not a model or a keyword score.
    // The trusted evaluator maps this tiny instruction DSL to arithmetic.
    const [a,b]=r.case.input;
    const actual=r.instructions==='add'?a+b:a-b;
    const observations=change({outcome:actual===r.case.expected?'pass':'fail',metrics:{accuracy:actual===r.case.expected?1:0},actual},r);
    return {observations,receipt:receipt(f,r,observations,alterReceipt(r))};
  };
}
const code=c=>e=>e.code===c;
test('actual trusted callback compares every frozen case, while raw registry activation fails closed',async()=>{
  const f=fixture();try{
    const calls=[];
    const evaluation=await f.registry.evaluate(f.candidate.candidateId,{runCase:async r=>{calls.push([r.caseId,r.variant]);return runner(f)(r);}});
    assert.equal(evaluation.passed,true);assert.equal(evaluation.improved,true);assert.equal(calls.length,4);
    assert.equal(f.registry.getActive('calculator').hash,f.baseline.hash);
    assert.throws(()=>f.registry.promote(f.candidate.candidateId,{lease:f.lease,principalId:'owner'}),code('LEARNING_ACTIVATION_AUTHORIZATION'));
    assert.equal(f.store.get('learning-role','calculator',1).data.activeHash,f.baseline.hash);
    assert.equal(f.store.list('learning-case').length,4);assert.ok(f.store.verifyJournal().events>0);
  }finally{f.store.close();}
});
test('core promotion rejects an activatable dataset with no required holdout',async()=>{
  const store=new Store(':memory:'),authority=new Authority(store),registry=new LearningRegistry(store,authority);
  try{
    const unsafe=spec();unsafe.cases=unsafe.cases.filter(c=>!c.holdout);
    const baseline=registry.registerBaseline({roleId:'unsafe',instructions:'subtract',datasetSpec:unsafe});
    const candidate=registry.propose({roleId:'unsafe',parentHash:baseline.hash,instructions:'add',rationale:'Fixture candidate only.',authorRunId:'author-run'});
    const lease=authority.issue({missionId:unsafe.missionId,principalId:'owner',actions:['instructions.promote'],resources:['role:unsafe'],expiresAt:new Date(Date.now()+3600000).toISOString()});
    await registry.evaluate(candidate.candidateId,{runCase:runner({store,authority,registry},x=>x)});
    assert.throws(()=>registry.promote(candidate.candidateId,{lease,principalId:'owner'}),code('LEARNING_ACTIVATION_POLICY'));
    assert.equal(registry.getActive('unsafe').hash,baseline.hash);
  }finally{store.close();}
});
test('dataset inputs, criteria, required and holdout flags are frozen by value',async()=>{
  const s=new Store(':memory:');try{const a=new Authority(s),r=new LearningRegistry(s,a),d=spec();r.registerBaseline({roleId:'r',instructions:'base',datasetSpec:d});d.cases[0].expected=999;d.cases[1].holdout=false;const stored=s.list('learning-dataset')[0].data;assert.equal(stored.cases[0].expected,4);assert.equal(stored.cases[1].holdout,true);}finally{s.close();}
});
test('empty, duplicate and criterion-less datasets rejected',()=>{
  for(const transform of [d=>d.cases=[],d=>d.cases.push(d.cases[0]),d=>d.cases[0].criteria=[]]){
    const s=new Store(':memory:');try{const r=new LearningRegistry(s,new Authority(s)),d=spec();transform(d);assert.throws(()=>r.registerBaseline({roleId:'r',instructions:'base',datasetSpec:d}),code('SCHEMA'));}finally{s.close();}
  }
});
test('interrupted callback leaves failed non-promotable evaluation and retained prefix',async()=>{
  const f=fixture();try{let count=0;await assert.rejects(f.registry.evaluate(f.candidate.candidateId,{runCase:async r=>{if(++count===3)throw Error('fixture interruption');return runner(f)(r);}}));assert.equal(f.store.list('learning-case').length,2);assert.equal(f.store.get('learning-evaluation',f.candidate.candidateId).data.status,'failed');assert.throws(()=>f.registry.promote(f.candidate.candidateId,{lease:f.lease,principalId:'owner'}),code('LEARNING_EVALUATION'));}finally{f.store.close();}
});
test('reused execution identity is rejected even with valid signature',async()=>{
  const f=fixture();try{await assert.rejects(f.registry.evaluate(f.candidate.candidateId,{runCase:runner(f,x=>x,()=>({executionId:'same-execution'}))}),code('LEARNING_DUPLICATE'));}finally{f.store.close();}
});
test('word PASS does not compensate for failed measured outcome',async()=>{
  const f=fixture();try{const e=await f.registry.evaluate(f.candidate.candidateId,{runCase:runner(f,(o,r)=>r.variant==='candidate'?{...o,outcome:'fail',actual:'PASS correct excellent'}:o)});assert.equal(e.passed,false);assert.ok(e.issues.some(i=>i.code==='OUTCOME_FAILED'));assert.throws(()=>f.registry.promote(f.candidate.candidateId,{lease:f.lease,principalId:'owner'}),code('LEARNING_REJECTED'));}finally{f.store.close();}
});
test('nonfinite metrics rejected before acceptance',async()=>{
  const f=fixture();try{await assert.rejects(f.registry.evaluate(f.candidate.candidateId,{runCase:async r=>({observations:{outcome:'pass',metrics:{accuracy:NaN},actual:4},receipt:{}})}),code('LEARNING_METRIC'));}finally{f.store.close();}
});
for(const field of ['caseId','caseHash','instructionHash','evaluationId','datasetHash','roleId','variant','evaluatorId'])test(`signed receipt contamination in ${field} rejected`,async()=>{
  const f=fixture();try{await assert.rejects(f.registry.evaluate(f.candidate.candidateId,{runCase:runner(f,x=>x,()=>({[field]:'wrong-context'}))}),code('LEARNING_RECEIPT'));}finally{f.store.close();}
});
test('author run cannot evaluate own candidate',async()=>{const f=fixture();try{await assert.rejects(f.registry.evaluate(f.candidate.candidateId,{runCase:runner(f,x=>x,()=>({evaluatorRunId:'author-run'}))}),code('LEARNING_INDEPENDENCE'));}finally{f.store.close();}});
test('unsigned self-report cannot substitute for an execution receipt',async()=>{const f=fixture();try{await assert.rejects(f.registry.evaluate(f.candidate.candidateId,{runCase:async()=>({observations:{outcome:'pass',metrics:{accuracy:1},actual:4},receipt:{kind:'evaluation.case',data:{},signature:{algorithm:'HMAC-SHA256',keyId:f.authority.keyId,value:'0'.repeat(64)}}})}),code('BAD_SIGNATURE'));}finally{f.store.close();}});
test('holdout regression blocks otherwise improved candidate',async()=>{
  const f=fixture();try{const e=await f.registry.evaluate(f.candidate.candidateId,{runCase:runner(f,(o,r)=>r.case.holdout?{outcome:'pass',metrics:{accuracy:r.variant==='baseline'?1:0},actual:r.case.expected}:o)});assert.equal(e.passed,false);assert.ok(e.issues.some(i=>i.caseId==='reserved'&&i.code==='METRIC_REGRESSION'));}finally{f.store.close();}
});
test('promotion requires exact authority principal, action and resource',async()=>{
  const f=fixture();try{await f.registry.evaluate(f.candidate.candidateId,{runCase:runner(f)});assert.throws(()=>f.registry.promote(f.candidate.candidateId,{}));assert.throws(()=>f.registry.promote(f.candidate.candidateId,{lease:f.lease,principalId:'not-owner'}),code('PRINCIPAL'));assert.equal(f.registry.getActive('calculator').hash,f.baseline.hash);}finally{f.store.close();}
});
test('raw registry candidates cannot bypass service activation even when each paired evaluation passes',async()=>{
  const f=fixture();try{const other=f.registry.propose({roleId:'calculator',parentHash:f.baseline.hash,instructions:'add again',rationale:'Alternative candidate',authorRunId:'author-two'});await f.registry.evaluate(f.candidate.candidateId,{runCase:runner(f)});await f.registry.evaluate(other.candidateId,{runCase:runner(f,(o,r)=>r.variant==='candidate'?{outcome:'pass',metrics:{accuracy:1},actual:r.case.expected}:o)});for(const candidate of [f.candidate,other])assert.throws(()=>f.registry.promote(candidate.candidateId,{lease:f.lease,principalId:'owner'}),code('LEARNING_ACTIVATION_AUTHORIZATION'));assert.equal(f.registry.getActive('calculator').hash,f.baseline.hash);}finally{f.store.close();}
});
test('rollback cannot activate unapproved candidate and requires rollback action',async()=>{
  const f=fixture();try{assert.throws(()=>f.registry.rollback({roleId:'calculator',targetHash:f.candidate.instructionHash,lease:f.lease,principalId:'owner',reason:'unapproved'}),code('LEARNING_ROLLBACK'));const limited=f.authority.issue({missionId:'mission-learning',principalId:'owner',actions:['instructions.promote'],resources:['role:calculator'],expiresAt:new Date(Date.now()+3600000).toISOString()});assert.throws(()=>f.registry.rollback({roleId:'calculator',targetHash:f.baseline.hash,lease:limited,principalId:'owner',reason:'wrong scope'}),code('AUTHORITY_SCOPE'));}finally{f.store.close();}
});
test('a candidate cannot repeatedly evaluate until lucky or mutate frozen request',async()=>{
  const f=fixture();try{await f.registry.evaluate(f.candidate.candidateId,{runCase:async r=>{assert.ok(Object.isFrozen(r.case.criteria));assert.throws(()=>r.case.expected=999);return runner(f)(r);}});await assert.rejects(f.registry.evaluate(f.candidate.candidateId,{runCase:runner(f)}),code('LEARNING_EVALUATED'));}finally{f.store.close();}
});
test('unchanged finite outcomes do not meet a require-improvement policy',async()=>{
  const f=fixture();try{const result=await f.registry.evaluate(f.candidate.candidateId,{runCase:runner(f,(o,r)=>({outcome:'pass',metrics:{accuracy:1},actual:r.case.expected}))});assert.equal(result.passed,false);assert.ok(result.issues.some(i=>i.code==='NO_MEASURED_IMPROVEMENT'));}finally{f.store.close();}
});
test('optional-only lift cannot satisfy a required improvement policy',async()=>{
  const f=fixture();try{
    const dataset=f.store.list('learning-dataset')[0].data;
    // The frozen dataset itself has only the two required cases.  Build a
    // distinct candidate fixture with a required tie and an optional lift so
    // the assertion targets the promotion rule rather than a schema shortcut.
    const optional={...dataset,cases:[...dataset.cases,{id:'diagnostic-only',input:[10,1],expected:11,required:false,holdout:false,
      criteria:[{metric:'accuracy',direction:'higher',threshold:1}]}]};
    const baseline=f.registry.registerBaseline({roleId:'optional-only',instructions:'subtract',datasetSpec:optional});
    const candidate=f.registry.propose({roleId:'optional-only',parentHash:baseline.hash,instructions:'add',rationale:'Fixture only.',authorRunId:'author-optional'});
    const result=await f.registry.evaluate(candidate.candidateId,{runCase:runner(f,(o,r)=>{
      if(r.case.id==='diagnostic-only')return {...o,outcome:r.variant==='candidate'?'pass':'fail',metrics:{accuracy:r.variant==='candidate'?1:0},actual:r.case.expected};
      return {outcome:'pass',metrics:{accuracy:1},actual:r.case.expected};
    })});
    assert.equal(result.improved,false);assert.equal(result.passed,false);
    assert.ok(result.issues.some(issue=>issue.code==='NO_MEASURED_IMPROVEMENT'));
  }finally{f.store.close();}
});
test('missing metrics cannot pass by supplying only outcome labels',async()=>{
  const f=fixture();try{await assert.rejects(f.registry.evaluate(f.candidate.candidateId,{runCase:async r=>{const observations={outcome:'pass',metrics:{},actual:4};return {observations,receipt:receipt(f,r,observations)};}}),code('SCHEMA'));}finally{f.store.close();}
});
test('lower-is-better criteria compare numeric observations in correct direction',async()=>{
  const f=fixture();try{
    const d=spec();d.cases=d.cases.slice(0,1);d.cases[0].criteria=[{metric:'error',direction:'lower',threshold:0}];
    const baseline=f.registry.registerBaseline({roleId:'lower-metric',instructions:'subtract',datasetSpec:d});
    const c=f.registry.propose({roleId:'lower-metric',parentHash:baseline.hash,instructions:'add',rationale:'Reduce measured numeric error.',authorRunId:'author-run'});
    const result=await f.registry.evaluate(c.candidateId,{runCase:runner(f,(o,r)=>({...o,metrics:{error:Math.abs(o.actual-r.case.expected)}}))});
    assert.equal(result.passed,true);assert.equal(result.improved,true);
  }finally{f.store.close();}
});
