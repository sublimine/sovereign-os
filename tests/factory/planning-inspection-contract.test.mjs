import test from 'node:test';
import assert from 'node:assert/strict';
import * as protocol from '../../factory/lib/planning-inspection-contract.mjs';
import {PLAN_SCHEMA} from '../../factory/lib/plans.mjs';
import {sha256} from '../../factory/lib/contracts.mjs';
import {listCapabilities} from '../../factory/catalog/index.mjs';

const intent='Produce the bounded requested result with an independent check.';
const policy=()=>({mode:'on-demand-v1',maxCalls:5});
const scope=()=>({intent,allowedTools:[]});
const plan=()=>({requirements:[{id:'r',text:intent,requestQuote:intent,criteria:[{id:'exact',text:intent}]}],
  nodes:[{id:'result',title:'Result',purpose:'result',roleIds:['omega_02'],reviewerRoleIds:['omega_03'],requirementIds:['r'],dependencies:[],
    method:{id:'derive',rationale:'Bounded work only.',alternatives:['A materially distinct construction after diagnosis.']},instructions:intent,
    outputKind:'delivery',criteria:[],requiredEffects:[],tools:[],specialist:null}],finalNodeId:'result',routingRationale:'One product with a separate review.'});
const inspect=()=>({action:'inspect',roleIds:['omega_02','omega_03'],reason:'Compare their full methods and boundaries before assigning them.',plan:null});
const propose=()=>({action:'plan',roleIds:[],reason:'',plan:plan()});

test('inspection policy is explicit, bounded and canonical; the helper cannot activate an omitted policy',()=>{
  const input=policy(),before=JSON.stringify(input),p=protocol.planningInspectionPolicy(input);
  assert.deepEqual(p,{...input,maxBytes:262144});assert.equal(JSON.stringify(input),before);
  p.maxCalls=1;assert.equal(input.maxCalls,5);
  assert.deepEqual(protocol.planningInspectionPolicy({...policy(),maxCalls:1,maxBytes:4096}),{...policy(),maxCalls:1,maxBytes:4096});
  assert.throws(()=>protocol.planningInspectionPolicy(undefined));
});
for(const value of [null,{}, {mode:'on-demand-v1'}, {mode:'unknown',maxCalls:5},
  {mode:'on-demand-v1',maxCalls:0},{mode:'on-demand-v1',maxCalls:101},{mode:'on-demand-v1',maxCalls:1.5},
  {mode:'on-demand-v1',maxCalls:null},{mode:'on-demand-v1',maxCalls:5,maxBytes:0},
  {mode:'on-demand-v1',maxCalls:5,maxBytes:262145},{mode:'on-demand-v1',maxCalls:5,maxBytes:null},
  {mode:'on-demand-v1',maxCalls:5,unlimited:true}])
test('inspection policy rejects invalid or unbounded configuration '+JSON.stringify(value),()=>{
  assert.throws(()=>protocol.planningInspectionPolicy(value));
});
test('planning control schema permits a real nullable plan, not a fabricated placeholder for inspection',()=>{
  const s=protocol.PLANNING_MESSAGE_SCHEMA;
  assert.deepEqual(s.required,['action','roleIds','reason','plan']);assert.equal(s.additionalProperties,false);
  assert.deepEqual(s.properties.action.enum,['inspect','plan']);assert.equal(s.properties.plan.anyOf[1].type,'null');
  assert.deepEqual(s.properties.plan.anyOf[0],PLAN_SCHEMA);assert.notEqual(s.properties.plan.anyOf[0],PLAN_SCHEMA);
});
test('inspection message validates IDs and complete-card bytes without modifying input, policy or a budget',()=>{
  const v=inspect(),p=policy(),s=scope(),before=sha256({v,p,s});
  assert.equal(protocol.validatePlanningMessage(v,{policy:p,...s}),true);
  assert.equal(protocol.validatePlanningMessage(v,{policy:p,...s}),true,'Provider callback plus final validation is harmless');
  assert.equal(sha256({v,p,s}),before);
});
for(const change of ['empty','duplicate','unknown','path','empty-reason','inactive-plan','extra-field','bad-action'])
test('inspection message rejects '+change+' without being mistaken for a plan',()=>{
  const v=inspect();
  if(change==='empty')v.roleIds=[];if(change==='duplicate')v.roleIds=['omega_02','omega_02'];
  if(change==='unknown')v.roleIds=['omega_99'];if(change==='path')v.roleIds=['../../private'];
  if(change==='empty-reason')v.reason='';if(change==='inactive-plan')v.plan=plan();
  if(change==='extra-field')v.accepted=true;if(change==='bad-action')v.action='execute';
  assert.throws(()=>protocol.validatePlanningMessage(v,{policy:policy(),...scope()}));
});
test('inspection cannot override the complete-card byte cap or summarize the catalog to fit it',()=>{
  assert.throws(()=>protocol.validatePlanningMessage({...inspect(),roleIds:listCapabilities().map(c=>c.id)},
    {policy:policy(),...scope()}),{code:'CATALOG_BUDGET_EXCEEDED'});
  assert.throws(()=>protocol.validatePlanningMessage(inspect(),{policy:{...policy(),maxBytes:1024},...scope()}));
});
test('plan message preserves existing proposal validation; valid shape alone does not assert contract coverage or acceptance',()=>{
  const v=propose(),before=sha256(v);assert.equal(protocol.validatePlanningMessage(v,{policy:policy(),...scope()}),true);
  assert.equal(sha256(v),before);assert.deepEqual(v.plan.nodes[0].criteria,[],'Only the existing later normalizer inserts final criteria');
  for(const change of ['null','inactive-ids','invented-quote','unknown-role','unauthorized-tool']){
    const bad=propose();if(change==='null')bad.plan=null;if(change==='inactive-ids')bad.roleIds=['omega_02'];
    if(change==='invented-quote')bad.plan.requirements[0].requestQuote='NOT IN THE REQUEST';
    if(change==='unknown-role')bad.plan.nodes[0].roleIds=['omega_99'];if(change==='unauthorized-tool')bad.plan.nodes[0].tools=['source.fetch'];
    assert.throws(()=>protocol.validatePlanningMessage(bad,{policy:policy(),...scope()}));
  }
});
test('plan message cannot weaken previous requirements or infer a larger tool policy',()=>{
  const previous=plan(),v=propose();previous.requirements[0].criteria.push({id:'extra',text:'Preserve this exact previously frozen obligation.'});
  assert.throws(()=>protocol.validatePlanningMessage(v,{policy:policy(),...scope(),previousPlan:previous}),{code:'MANDATE_DRIFT'});
  assert.throws(()=>protocol.validatePlanningMessage(v,{policy:policy(),intent}));
  assert.throws(()=>protocol.validatePlanningMessage(v,{policy:policy(),intent,allowedTools:['host.shell']}));
});
test('planning control rejects accessors without executing them and extra authority fields',()=>{
  let reads=0;const v=inspect();Object.defineProperty(v,'reason',{enumerable:true,get(){reads++;return 'hidden';}});
  assert.throws(()=>protocol.validatePlanningMessage(v,{policy:policy(),...scope()}),{code:'SCHEMA'});assert.equal(reads,0);
  assert.throws(()=>protocol.validatePlanningMessage(inspect(),{policy:policy(),...scope(),approved:true}));
});
