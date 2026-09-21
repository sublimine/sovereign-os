import {check, clone, identifier, keys, list, string, unique} from './contracts.mjs';
import {getRole} from '../catalog/index.mjs';

// This is an admission-time control boundary, not a claim that a catalog role
// has already performed its method or accepted a mission. The plan and its
// independent reviews retain those separate responsibilities.
// v1 direction records are already durable historical policy snapshots.  Keep
// them readable, but admit new directions as v2 so the final-participation
// requirement cannot retroactively invalidate an older accepted plan.
export const LEGACY_MISSION_DIRECTION_SCHEMA='sovereign.mission-direction.v1';
export const MISSION_DIRECTION_SCHEMA='sovereign.mission-direction.v2';
export const MISSION_RISK_LEVELS=Object.freeze(['low','moderate','high','critical']);
const CLOSURE_EVALUATORS=new Set(['content','runtime.independent_review','runtime.no_file_writes','runtime.no_code_execution','runtime.no_source_fetch']);

const validateClosureCriterion=value=>{
  keys(value,['text','evaluation']);
  string(value.text,'mission direction closure criterion',{max:20000});
  check(CLOSURE_EVALUATORS.has(value.evaluation),'MISSION_DIRECTION_CLOSURE',
    'Mission direction closure criterion has an unknown evaluator');
};

const validateEscalation=value=>{
  keys(value,['trigger','target','action']);
  string(value.trigger,'mission direction escalation trigger',{max:12000});
  string(value.target,'mission direction escalation target',{max:512});
  string(value.action,'mission direction escalation action',{max:12000});
};

/** Validate the durable, mission-local direction boundary. It intentionally
 * uses one accountable catalog role rather than a set, while roleJustifications
 * records why each execution or review facet may be selected later by the plan. */
export function missionDirectionPolicy(value,{roleLookup=getRole,allowLegacy=false}={}){
  keys(value,['schema','responsibleRoleId','roleJustifications','riskLevel','closureCriterion','escalation']);
  check(value.schema===MISSION_DIRECTION_SCHEMA||(allowLegacy&&value.schema===LEGACY_MISSION_DIRECTION_SCHEMA),
    'MISSION_DIRECTION_SCHEMA','Unknown or legacy-only mission direction schema');
  identifier(value.responsibleRoleId,'mission responsible role');roleLookup(value.responsibleRoleId);
  list(value.roleJustifications,'mission direction role justifications',{min:1,max:154});
  const justified=[];
  for(const item of value.roleJustifications){
    keys(item,['roleId','rationale']);identifier(item.roleId,'justified role');roleLookup(item.roleId);
    string(item.rationale,'role selection rationale',{max:20000});justified.push(item.roleId);
  }
  unique(justified,'mission direction justified roles');
  check(justified.includes(value.responsibleRoleId),'MISSION_DIRECTION_RESPONSIBLE',
    'The single mission responsible role needs its own selection justification');
  check(MISSION_RISK_LEVELS.includes(value.riskLevel),'MISSION_DIRECTION_RISK','Unknown mission risk level');
  validateClosureCriterion(value.closureCriterion);validateEscalation(value.escalation);
  return clone(value);
}

/** Bind a declared direction boundary to the concrete plan before it is
 * accepted or installed. Direction does not assign roles by itself: every
 * producer and reviewer actually selected by the plan must have a durable
 * justification, and the final product must carry the stated closure test. */
export function assertMissionDirectionPlan(direction,plan,{roleLookup=getRole}={}){
  if(direction===undefined||direction===null)return null;
  // Existing v1 missions retain their exact historical policy/plan semantics.
  // New v2 admissions are held to the stronger final-product participation rule.
  const normalized=missionDirectionPolicy(direction,{roleLookup,allowLegacy:true});
  list(plan?.nodes,'plan nodes',{min:1,max:256});identifier(plan?.finalNodeId,'plan final node');
  const justified=new Set(normalized.roleJustifications.map(item=>item.roleId));
  for(const node of plan.nodes){
    for(const roleId of [...node.roleIds,...node.reviewerRoleIds])check(justified.has(roleId),'MISSION_DIRECTION_ROLE_SELECTION',
      `Plan selects ${roleId} without a durable mission-direction justification`);
  }
  const final=plan.nodes.find(node=>node.id===plan.finalNodeId);
  check(final,'MISSION_DIRECTION_CLOSURE','Mission direction final node is absent');
  if(normalized.schema===MISSION_DIRECTION_SCHEMA)check([...final.roleIds,...final.reviewerRoleIds].includes(normalized.responsibleRoleId),
    'MISSION_DIRECTION_RESPONSIBLE_PARTICIPATION',
    'The single mission responsible role must produce or independently review the final product');
  const closure=normalized.closureCriterion;
  check(final.criteria.some(criterion=>criterion?.text===closure.text&&(criterion.evaluation??'content')===closure.evaluation),
    'MISSION_DIRECTION_CLOSURE','Mission direction closure criterion is missing from the final product');
  return normalized;
}
