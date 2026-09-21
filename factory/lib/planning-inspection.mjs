// One planning actor, bounded requests, durable public responses and local
// preparation. The independent plan judge remains in FactoryEngine.plan.
import {check,clone,canonical,sha256} from './contracts.mjs';
import {planningInspectionBudget,planningInspectionReservation} from './planning-inspection-budget.mjs';
import {PLANNING_MESSAGE_SCHEMA,validatePlanningMessage} from './planning-inspection-contract.mjs';
import {PLANNING_INSPECTION_RETENTION,readPlanningInspectionMessage} from './planning-inspection-response.mjs';
import {inspectPlanningRoleContracts,planningContractInventory} from './plan-role-review.mjs';
import {normalizeBlindPlan} from './blind-plan.mjs';
import {normalizeInputCopyPlan} from './input-copy-contract.mjs';
import {normalizeFinalCoverage} from './final-coverage.mjs';

const INSTRUCTIONS='This mission uses on-demand-v1 planning control. Return action=inspect with exact catalog roleIds, a concise public reason and plan=null when complete contracts are needed. Return action=plan, roleIds=[] and the complete plan when ready. A final proposal requires EVERY assigned producer and reviewer full card in this exact request. Directory titles, a previous unseen contract, a provisional proposal and local preparation are not a completed inspection. Use the whole methods, inputs, outputs, limitations and independence to justify assignments; report genuine capability gaps. Do not ask for contracts already present. A provisional plan missing contracts is not a candidate: inspect the returned full cards and submit a new proposal. Every response consumes the explicitly frozen global call ceiling; it is not reset by another planning actor or quality correction. The controller retains independent plan review and all mandate/authority gates. No tools, private reasoning or extra authority fields in a control message.';
const TYPE='planning-inspection-step';
/** The artifact API and crash recovery share the same gate. A caller cannot
 * turn a receipt for inspect, or an altered proposal, into a plan candidate. */
export function assertPlanningInspectionCandidate(registry,runId,body){
  const response=readPlanningInspectionMessage(registry,runId);
  check(response?.value.action==='plan'&&response.coverage.complete,'PLANNING_INSPECTION_INTEGRITY','Plan candidate lacks completed full-contract coverage');
  const expected=normalizeFinalCoverage(normalizeInputCopyPlan(normalizeBlindPlan(response.value.plan).plan).plan).plan;
  let proposed;try{proposed=JSON.parse(body);}catch{}
  check(proposed&&canonical(proposed)===canonical(expected),'PLANNING_INSPECTION_INTEGRITY','Plan candidate differs from its completed inspected proposal and deterministic gates');
  return true;
}
function prepareStep(workers,runId,task,response,policy){
  const base=new Set(planningContractInventory(task).map(c=>c.id)),seen=new Set(response.contractInventory.map(c=>c.id));
  const requested=response.value.action==='inspect'?response.value.roleIds:response.coverage.missingRoleIds;
  const added=requested.filter(id=>!seen.has(id));
  check(added.length>0,'PLANNING_INSPECTION_STALLED','The completed request already contained every requested card; choose a materially different next action');
  const ids=[...new Set([...response.contractInventory.map(c=>c.id),...added])].filter(id=>!base.has(id)).sort();
  const contracts=inspectPlanningRoleContracts(ids,{maxBytes:policy.maxBytes});
  const id=TYPE+':'+sha256([runId,response.responseRecord]),data={schema:'sovereign.planning-inspection-step.v1',runId,
    responseRecord:response.responseRecord,baseTaskHash:sha256(task),roleIds:ids,cardsHash:contracts.cardsHash,
    disposition:response.value.action==='inspect'?'REQUESTED_CONTRACTS_PREPARED':'PROVISIONAL_PLAN_CONTRACTS_PREPARED'};
  workers.store.transact(()=>{
    const existing=workers.store.get(TYPE,id);
    check(existing||!workers.store.get(TYPE,id,1),'PLANNING_INSPECTION_INTEGRITY','Planning preparation head was hidden');
    if(existing)check(existing.version===1&&canonical(existing.data)===canonical(data),'PLANNING_INSPECTION_INTEGRITY','Durable planning preparation changed');
    else workers.store.put(TYPE,id,data,{expectedVersion:0});
  });
  return {inspectedRoleContracts:contracts,planningContractFeedback:{responseRecord:response.responseRecord,action:response.value.action,
    reason:response.value.reason,missingRoleIds:response.coverage?.missingRoleIds??[],provisionalPlan:response.value.action==='plan'?response.value.plan:null}};
}

export async function runPlanningInspection({workers,runId,instructions,task,signal}){
  task=clone(task);const mission=workers.mission(workers.run(runId).missionId);
  const validation={policy:mission.policy.planningContracts,intent:mission.intent,allowedTools:mission.policy.allowedTools,previousPlan:task.previousPlan??null};
  for(;;){
    if(signal?.aborted)throw Object.assign(Error('Cancelled'),{code:'CANCELLED'});
    const response=readPlanningInspectionMessage(workers.registry,runId);
    if(response?.value.action==='plan'&&response.coverage.complete)return {...response,value:response.value.plan};
    const reservation=planningInspectionReservation(workers.registry,runId);
    check(!reservation||response,'PLANNING_INSPECTION_PENDING','The reserved inference has no durable response; no silent replay or replacement');
    const budget=planningInspectionBudget(workers.registry,mission.id);
    check(budget.remaining>0,'PLANNING_INSPECTION_LIMIT','Global planning call ceiling exhausted before an inspectable plan was independently reviewed');
    const extra=response?prepareStep(workers,runId,task,response,validation.policy):{};
    await workers.infer({runId,instructions:instructions+'\n'+INSTRUCTIONS,retention:PLANNING_INSPECTION_RETENTION,
      input:JSON.stringify({...task,...extra,planningContractControl:{schema:'sovereign.planning-contract-control.v1',runId,
        callIndex:budget.reserved+1,maxCalls:budget.maxCalls,maxBytes:budget.maxBytes}}),schema:PLANNING_MESSAGE_SCHEMA,
      validate:value=>validatePlanningMessage(value,validation),signal});
    // Never trust only the in-memory reply. Next iteration reads the atomically
    // retained public message and proves its actual completed-request coverage.
  }
}
