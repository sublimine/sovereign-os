import test from 'node:test';
import assert from 'node:assert/strict';
import {getRole,listCapabilities} from '../../factory/catalog/index.mjs';
import {sha256} from '../../factory/lib/contracts.mjs';
import {planRoleReviewContext,planningRoleRecoveryContracts,planningKnownRoleContracts} from '../../factory/lib/plan-role-review.mjs';
import * as roleContracts from '../../factory/lib/plan-role-review.mjs';

function candidate(){
  const criteria=[{id:'checked',text:'Check the result'}];
  const node=(id,roleIds,reviewerRoleIds,dependencies=[])=>({id,title:id,purpose:id,roleIds,reviewerRoleIds,dependencies,requirementIds:['r'],
    method:{id:'derive',rationale:'Exact bounded derivation',alternatives:['Independent method']},instructions:'Check the result',outputKind:'result',criteria,requiredEffects:[],tools:[],specialist:null});
  const plan={requirements:[{id:'r',text:'Check the result',requestQuote:'Check the result',criteria}],nodes:[
    node('first',['veritas_07'],['omega_22','veritas_04']),
    node('second',['omega_23','veritas_07'],['omega_22'],[{nodeId:'first',purpose:'first',reason:'Requires accepted prior result'}]),
  ],finalNodeId:'second',routingRationale:'Explicit products'};
  const payload={nodeId:'planning',purpose:'plan',kind:'mission-plan',body:JSON.stringify(plan)};
  return {id:'candidate:plan',payload,payloadHash:sha256(payload)};
}
test('plan review carries full exact cards for all target assignments once, including an incompatible proposal under audit',()=>{
  const a=candidate(),before=JSON.stringify(a),view=planRoleReviewContext(a,'Check the result');
  assert.equal(view.schema,'sovereign.plan-role-contracts.v1');assert.equal(view.artifactHash,a.payloadHash);
  assert.equal(view.cardsHash,sha256(view.cards));assert.deepEqual(view.cards.map(c=>c.id),['omega_22','omega_23','veritas_04','veritas_07']);
  for(const card of view.cards)assert.deepEqual(card,getRole(card.id));
  assert.deepEqual(view.assignments[0].reviewerRoleIds,['omega_22','veritas_04']);
  assert.deepEqual(view.assignments[1].producerRoleIds,['omega_23','veritas_07']);
  assert.equal(JSON.stringify(a),before);assert.equal(view.cards.length,4);
});
test('target card review rejects stale or malformed plans and does not expand ordinary product review',()=>{
  const a=candidate();a.payload.body+=' ';assert.throws(()=>planRoleReviewContext(a,'Check the result'),{code:'ARTIFACT_INTEGRITY'});
  assert.throws(()=>planRoleReviewContext(candidate(),'Different request'),{code:'MANDATE_QUOTE'});
  const product=candidate();product.payload.nodeId='first';assert.equal(planRoleReviewContext(product,'Check the result'),null);
});
test('routing uses exact purposes and recovery exposes full rejected contracts once without altering the audit cards',()=>{
  const original=listCapabilities(),routed=listCapabilities({routing:true});
  assert.equal(original.length,154);assert.equal(routed.length,154);
  for(let i=0;i<original.length;i++){
    assert.deepEqual(routed[i],{...original[i],purpose:getRole(original[i].id).purpose});
    assert.equal(original[i].purpose,undefined);
  }
  const plan=JSON.parse(candidate().payload.body),feedback=[{attempt:1,rejectedPlan:plan},{attempt:2,failure:{code:'SCHEMA'}},{attempt:3,rejectedPlan:structuredClone(plan)}];
  const before=JSON.stringify(feedback),view=planningRoleRecoveryContracts(feedback);
  assert.deepEqual(view.rejectedPlanHashes,[sha256(plan),sha256(plan)]);
  assert.deepEqual(view.cards.map(c=>c.id),['omega_22','omega_23','veritas_04','veritas_07']);
  for(const c of view.cards)assert.deepEqual(c,getRole(c.id));
  assert.equal(view.cardsHash,sha256(view.cards));assert.equal(JSON.stringify(feedback),before);
  assert.equal(planningRoleRecoveryContracts([]),null);
});

test('known planning input pitfalls expose complete source-bound contracts before any rejection',()=>{
  const before=listCapabilities().map(c=>sha256(getRole(c.id))),view=planningKnownRoleContracts();
  assert.equal(view.schema,'sovereign.planning-known-role-contracts.v1');
  assert.deepEqual(view.cards,[getRole('omega_23')]);assert.equal(view.cardsHash,sha256(view.cards));
  assert.match(view.scope,/not an exhaustive prerequisite inventory/);
  assert.deepEqual(listCapabilities().map(c=>sha256(getRole(c.id))),before);
  view.cards.push(getRole('omega_22'));
  assert.deepEqual(planningKnownRoleContracts().cards,[getRole('omega_23')]);
});

const proposedRoles=()=>({nodes:[{roleIds:['omega_11','omega_23'],reviewerRoleIds:['omega_22']},
  {roleIds:['omega_23'],reviewerRoleIds:['omega_22']}]});
test('local planning inspection preserves every selected card and source link, sorted without changing the catalog',()=>{
  const view=roleContracts.inspectPlanningRoleContracts(['omega_22','omega_11']);
  assert.equal(view.schema,'sovereign.planning-role-inspection.v1');assert.deepEqual(view.cards.map(c=>c.id),['omega_11','omega_22']);
  for(const c of view.cards)assert.deepEqual(c,getRole(c.id));assert.equal(view.cardsHash,sha256(view.cards));
  assert.match(view.scope,/not.*completed inference/);const before=sha256(getRole('omega_11'));
  view.cards[0].methods.push('MUTATED RETURN');assert.equal(sha256(getRole('omega_11')),before);
  assert.equal(roleContracts.inspectPlanningRoleContracts(['omega_11','omega_22']).cardsHash,sha256([getRole('omega_11'),getRole('omega_22')]));
});
test('local planning inspection rejects invalid IDs, duplicates, empty selection and a full-catalog dump',()=>{
  for(const ids of [[],['omega_11','omega_11'],['omega_99'],['../../private'],['omega_11',null]])
    assert.throws(()=>roleContracts.inspectPlanningRoleContracts(ids));
  assert.throws(()=>roleContracts.inspectPlanningRoleContracts(listCapabilities().map(c=>c.id)),{code:'CATALOG_BUDGET_EXCEEDED'});
});
test('local planning inspection caps the complete envelope, permits an exact budget and rejects silent overrides',()=>{
  const view=roleContracts.inspectPlanningRoleContracts(['omega_22']),bytes=Buffer.byteLength(JSON.stringify(view));
  assert.deepEqual(roleContracts.inspectPlanningRoleContracts(['omega_22'],{maxBytes:bytes}),view);
  assert.throws(()=>roleContracts.inspectPlanningRoleContracts(['omega_22'],{maxBytes:bytes-1}),{code:'PLANNING_CONTRACT_LIMIT'});
  for(const options of [{maxBytes:262145},{maxBytes:0},{maxBytes:1.5},{maxBytes:Infinity},{maxBytes:null},{truncate:true},{maxCards:154}])
    assert.throws(()=>roleContracts.inspectPlanningRoleContracts(['omega_22'],options),{code:'SCHEMA'});
});
test('planning role coverage is a pure exact-card diagnostic across designated task collections, not a completion or fit verdict',()=>{
  const plan=proposedRoles(),task={knownRoleContracts:planningKnownRoleContracts(),
    rejectedRoleContracts:planningRoleRecoveryContracts([{rejectedPlan:plan}]),inspectedRoleContracts:roleContracts.inspectPlanningRoleContracts(['omega_22'])};
  const before=JSON.stringify({plan,task}),view=roleContracts.planningRoleCoverage(plan,task);
  assert.equal(view.schema,'sovereign.planning-role-coverage.v1');assert.deepEqual(view.requiredRoleIds,['omega_11','omega_22','omega_23']);
  assert.equal(view.complete,true);assert.deepEqual(view.missingRoleIds,[]);
  assert.deepEqual(view.included.map(c=>c.id),view.requiredRoleIds);
  assert.deepEqual(view.included.find(c=>c.id==='omega_22').locations,['rejectedRoleContracts','inspectedRoleContracts']);
  for(const c of view.included)assert.equal(c.cardHash,sha256(getRole(c.id)));
  assert.match(view.scope,/not.*completion/);assert.match(view.scope,/compatibility/);assert.equal(JSON.stringify({plan,task}),before);
});
test('planning role coverage reports missing reviewer and producer cards; directory, declarations and unrelated fields cannot fill them',()=>{
  const plan=proposedRoles(),task={knownRoleContracts:planningKnownRoleContracts(),capabilities:listCapabilities({routing:true}),
    claimedComplete:true,roleIds:['omega_11','omega_22'],cards:[getRole('omega_11'),getRole('omega_22')],
    privateUnrecognizedContainer:{cards:[getRole('omega_11'),getRole('omega_22')]}};
  const view=roleContracts.planningRoleCoverage(plan,task);assert.equal(view.complete,false);
  assert.deepEqual(view.missingRoleIds,['omega_11','omega_22']);assert.deepEqual(view.included.map(c=>c.id),['omega_23']);
  assert.deepEqual(roleContracts.planningRoleCoverage(plan,{}).missingRoleIds,['omega_11','omega_22','omega_23']);
});
for(const field of ['methods','inputContract','outputContract','activation','completion','forbiddenActions','failureRecovery','independence','sourceRefs','originalAudit','limitations'])
test('planning role coverage rejects a shortened '+field+' even after recomputing its collection hash',()=>{
  const inspected=roleContracts.inspectPlanningRoleContracts(['omega_11','omega_22']),card=inspected.cards.find(c=>c.id==='omega_11');
  delete card[field];inspected.cardsHash=sha256(inspected.cards);
  assert.throws(()=>roleContracts.planningRoleCoverage(proposedRoles(),{inspectedRoleContracts:inspected}),{code:'PLANNING_CONTRACT_INTEGRITY'});
});
for(const mutation of ['hash','schema','duplicate','unknown-id','extra-field','changed-purpose'])
test('planning role coverage rejects '+mutation+' in its declared card collection',()=>{
  const inspected=roleContracts.inspectPlanningRoleContracts(['omega_11','omega_22']);
  if(mutation==='hash')inspected.cardsHash='0'.repeat(64);
  if(mutation==='schema')inspected.schema='sovereign.untrusted-role-list.v1';
  if(mutation==='duplicate'){inspected.cards.push(structuredClone(inspected.cards[0]));inspected.cardsHash=sha256(inspected.cards);}
  if(mutation==='unknown-id'){inspected.cards[0].id='omega_99';inspected.cardsHash=sha256(inspected.cards);}
  if(mutation==='extra-field'){inspected.cards[0].approved=true;inspected.cardsHash=sha256(inspected.cards);}
  if(mutation==='changed-purpose'){inspected.cards[0].purpose='Different work';inspected.cardsHash=sha256(inspected.cards);}
  assert.throws(()=>roleContracts.planningRoleCoverage(proposedRoles(),{inspectedRoleContracts:inspected}));
});
test('planning role coverage rejects a conflicting card even when another designated collection contains its correct version',()=>{
  const plan=proposedRoles(),recovery=structuredClone(planningRoleRecoveryContracts([{rejectedPlan:plan}]));
  recovery.cards.find(c=>c.id==='omega_23').purpose='UNVERIFIED REPLACEMENT';recovery.cardsHash=sha256(recovery.cards);
  assert.throws(()=>roleContracts.planningRoleCoverage(plan,{knownRoleContracts:planningKnownRoleContracts(),rejectedRoleContracts:recovery}),{code:'PLANNING_CONTRACT_INTEGRITY'});
});
test('planning role coverage rejects unknown or repeated role IDs and still requires independent reviewer contracts for a standalone producer',()=>{
  assert.throws(()=>roleContracts.planningRoleCoverage({nodes:[{roleIds:['omega_99'],reviewerRoleIds:['omega_22']}]},{}));
  assert.throws(()=>roleContracts.planningRoleCoverage({nodes:[{roleIds:['omega_11','omega_11'],reviewerRoleIds:['omega_22']}]},{}));
  const view=roleContracts.planningRoleCoverage({nodes:[{roleIds:[],reviewerRoleIds:['omega_22']}]},{});
  assert.deepEqual(view.requiredRoleIds,['omega_22']);assert.deepEqual(view.missingRoleIds,['omega_22']);assert.equal(view.complete,false);
});
test('planning role coverage rejects JavaScript accessors without running them and never accepts a caller-provided coverage certificate',()=>{
  let reads=0;const task={};Object.defineProperty(task,'inspectedRoleContracts',{enumerable:true,get(){reads++;return {};}});
  assert.throws(()=>roleContracts.planningRoleCoverage(proposedRoles(),task),{code:'SCHEMA'});assert.equal(reads,0);
  const fabricated={schema:'sovereign.planning-role-coverage.v1',complete:true,missingRoleIds:[]};
  assert.equal(roleContracts.planningRoleCoverage(proposedRoles(),{coverage:fabricated}).complete,false);
});
