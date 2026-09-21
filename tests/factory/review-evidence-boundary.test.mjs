import test from 'node:test';
import assert from 'node:assert/strict';
import {sha256} from '../../factory/lib/contracts.mjs';
import {reviewEvidenceBoundary,planReviewEvidenceContext} from '../../factory/lib/review-evidence-boundary.mjs';

function candidate(){
  const criteria=[{id:'result',text:'Preserve all results.'}];
  const node=(id,deps=[])=>({id,title:id,purpose:id,roleIds:['omega_02'],reviewerRoleIds:['omega_22'],requirementIds:['r'],
    dependencies:deps.map(nodeId=>({nodeId,purpose:nodeId,reason:'Requires exact accepted product'})),
    method:{id:'derive',rationale:'Explicit result',alternatives:['Independent derivation']},instructions:'Preserve all results.',outputKind:'result',criteria,requiredEffects:[],tools:[],specialist:null});
  const plan={requirements:[{id:'r',text:'Preserve all results.',requestQuote:'Preserve all results.',criteria}],
    nodes:[node('a'),node('b'),node('merge',['a','b']),node('delivery',['merge','a'])],finalNodeId:'delivery',routingRationale:'Two independent inputs, merged and delivered.'};
  const payload={nodeId:'planning',purpose:'plan',kind:'mission-plan',body:JSON.stringify(plan)};
  return {id:'candidate:plan',payload,payloadHash:sha256(payload)};
}
test('prospective evidence map includes exact self and transitive ancestors once, never independent siblings or downstream',()=>{
  const a=candidate(),before=JSON.stringify(a),map=planReviewEvidenceContext(a,'Preserve all results.');
  assert.deepEqual(map.nodes,[
    {nodeId:'a',reviewedProductNodeIds:['a'],unexposedProductNodeIds:['b','delivery','merge']},
    {nodeId:'b',reviewedProductNodeIds:['b'],unexposedProductNodeIds:['a','delivery','merge']},
    {nodeId:'merge',reviewedProductNodeIds:['a','b','merge'],unexposedProductNodeIds:['delivery']},
    {nodeId:'delivery',reviewedProductNodeIds:['a','b','delivery','merge'],unexposedProductNodeIds:[]},
  ]);
  assert.equal(map.artifactHash,a.payloadHash);assert.deepEqual(map.boundary,reviewEvidenceBoundary());
  assert.match(map.scope,/not acquired artifacts or completed reviews/);assert.equal(JSON.stringify(a),before);
  map.boundary.placement='mutated';assert.notEqual(reviewEvidenceBoundary().placement,'mutated');
});
test('prospective map rejects changed candidate, cyclic plan and request drift; no expansion for ordinary product',()=>{
  const a=candidate();a.payload.body+=' ';assert.throws(()=>planReviewEvidenceContext(a,'Preserve all results.'),{code:'ARTIFACT_INTEGRITY'});
  assert.throws(()=>planReviewEvidenceContext(candidate(),'Unrelated request'),{code:'MANDATE_QUOTE'});
  const b=candidate(),plan=JSON.parse(b.payload.body);plan.nodes[0].dependencies=[{nodeId:'delivery',purpose:'delivery',reason:'circular'}];
  b.payload.body=JSON.stringify(plan);b.payloadHash=sha256(b.payload);assert.throws(()=>planReviewEvidenceContext(b,'Preserve all results.'));
  const p=candidate();p.payload.nodeId='a';assert.equal(planReviewEvidenceContext(p,'Preserve all results.'),null);
});
test('planned review boundary separates acquired provenance from independent factual judgment',()=>{
  const map=planReviewEvidenceContext(candidate(),'Preserve all results.'),factual=map.boundary.factualClaims;
  assert.match(factual.acquisition,/not factual truth or acceptance/);
  assert.match(factual.verification,/separate run, provider thread and private context/);
  assert.match(factual.limits,/not entailment/);
});
