// Opt-in control contract only. No Store, provider, budget mutation or engine
// activation lives here. Validating twice must have no operational side effects.
import {DEFAULT_MAX_BYTES} from '../catalog/index.mjs';
import {check,clone,integer,keys,list,string,unique} from './contracts.mjs';
import {PLAN_SCHEMA,TOOL_NAMES,validatePlanProposal} from './plans.mjs';
import {normalizeBlindPlan} from './blind-plan.mjs';
import {normalizeInputCopyPlan} from './input-copy-contract.mjs';
import {assertPlanRoleExecution} from './role-execution.mjs';
import {inspectPlanningRoleContracts} from './plan-role-review.mjs';

export const PLANNING_INSPECTION_MODE='on-demand-v1';
const freeze=value=>{if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value;};
export const PLANNING_MESSAGE_SCHEMA=freeze({type:'object',properties:{
  action:{type:'string',enum:['inspect','plan']},roleIds:{type:'array',items:{type:'string'}},reason:{type:'string'},
  plan:{anyOf:[clone(PLAN_SCHEMA),{type:'null'}]},
},required:['action','roleIds','reason','plan'],additionalProperties:false,
description:'inspect: name exact unique catalog role IDs, give a short public reason, and set plan=null. This prepares whole contracts for a later request, never a placeholder plan or acceptance. plan: roleIds=[], plan is a complete proposed plan; reason may be empty because the plan contains its routing rationale. A plan without every assigned full contract in its actual completed request is provisional, not an acceptable candidate. The controller preserves independent plan review and all mandate/authority gates. No private reasoning, tools or extra authority fields.'});

/** Explicit caller selection. No missing-mode default or implicit call-budget
 * grant. maxCalls is a ceiling on planning dispatch attempts, not a token bill
 * or quality-attempt count; a later durable controller must actually enforce it. */
export function planningInspectionPolicy(input){
  const p=clone(input);keys(p,['mode','maxCalls','maxBytes'],['mode','maxCalls']);
  check(p.mode===PLANNING_INSPECTION_MODE,'POLICY','Unknown planning contract protocol');
  integer(p.maxCalls,'planning dispatch-attempt ceiling',{min:1,max:100});
  const maxBytes=Object.hasOwn(p,'maxBytes')?p.maxBytes:DEFAULT_MAX_BYTES;
  integer(maxBytes,'complete planning card bytes',{min:1,max:DEFAULT_MAX_BYTES});
  return {mode:PLANNING_INSPECTION_MODE,maxCalls:p.maxCalls,maxBytes};
}

/** A shape/authority validator, not proof of exposed cards or semantic fit.
 * Exact completed-request coverage and the separate judge are later gates. */
export function validatePlanningMessage(input,context){
  const snapshot=clone({input,context}),v=snapshot.input,c=snapshot.context;
  keys(c,['policy','intent','allowedTools','previousPlan'],['policy','intent','allowedTools']);
  const policy=planningInspectionPolicy(c.policy);string(c.intent,'immutable mission request');
  list(c.allowedTools,'mission tools',{max:TOOL_NAMES.length});unique(c.allowedTools);
  c.allowedTools.forEach(t=>check(TOOL_NAMES.includes(t),'PLAN_AUTHORITY','Unknown mission tool'));
  keys(v,['action','roleIds','reason','plan']);
  check(['inspect','plan'].includes(v.action),'SCHEMA','Unknown planning control action');
  list(v.roleIds,'inspection role IDs',{max:154});string(v.reason,'public inspection reason',{min:v.action==='inspect'?1:0,max:8000});
  if(v.action==='inspect'){
    check(v.plan===null,'SCHEMA','Inspection cannot contain a provisional or placeholder plan');
    inspectPlanningRoleContracts(v.roleIds,{maxBytes:policy.maxBytes});
  }else{
    check(v.roleIds.length===0,'SCHEMA','A plan is not a parallel inspection operation');
    validatePlanProposal(v.plan,c.intent,{allowedTools:c.allowedTools,previous:c.previousPlan??null});
    assertPlanRoleExecution(normalizeInputCopyPlan(normalizeBlindPlan(v.plan).plan).plan);
  }
  return true;
}
