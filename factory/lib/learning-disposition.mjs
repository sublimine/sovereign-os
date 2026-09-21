import {clone} from './contracts.mjs';

/** Explain the existing opt-in boundary without widening it. Truthiness for
 * actor flags and explicit presence for mission policies intentionally differ. */
export function learningOverlayExclusions(o){
  const reasons=[];
  if(!o.resolverPresent)reasons.push('NO_RESOLVER');
  for(const [key,reason]of [
    ['inputBoundReview','INPUT_FILE_REVIEW_UNQUALIFIED'],['closedReview','SEALED_REVIEW_UNQUALIFIED'],
    ['comparisonReview','BLIND_COMPARISON_UNQUALIFIED'],['closedResponse','CLOSED_CONTROLLER_UNQUALIFIED'],
    ['controllerReview','CLOSED_REVIEW_UNQUALIFIED'],['boundedRead','BOUNDED_CONTROLLER_UNQUALIFIED'],
    ['boundedReview','BOUNDED_REVIEW_UNQUALIFIED'],['documentContext','DOCUMENT_CONTEXT_UNQUALIFIED'],
    ['sourcedResponse','SOURCED_CONTROLLER_UNQUALIFIED'],['sourcedReview','SOURCED_REVIEW_UNQUALIFIED'],
    ['contractInspection','PLANNING_INSPECTION_UNQUALIFIED']])if(o[key])reasons.push(reason);
  if(o.producerBatch!==undefined)reasons.push('PRODUCER_BATCH_UNQUALIFIED');
  if(o.inferenceBudget!==undefined)reasons.push('INFERENCE_BUDGET_UNQUALIFIED');
  return reasons;
}

/** Only reports committed configuration/registry records. No resolver call,
 * evaluator invocation, repair, registration or inferred retrospective gate. */
export function learningStateReport(store,{missionId,runs}){
  const workers=runs.map(run=>{
    const record=store.get('worker-config',run.id),config=record?.data;
    return {runId:run.id,configHash:record?.hash??null,
      selection:config?.learningDisposition?clone(config.learningDisposition):{
        schema:'sovereign.learning-selection.v1',status:'NOT_RECORDED',exclusions:null,resolverCalls:null},
      frozenInstructionVersions:Array.isArray(config?.learnedInstructionVersions)?clone(config.learnedInstructionVersions):null};
  });
  const registeredScopeCount=store.list('learning-compilation').length;
  const cycles=store.list('learning-cycle').filter(r=>r.data.missionId===missionId).map(r=>({id:r.id,version:r.version,hash:r.hash,
    roleId:r.data.roleId,...(r.data.policyId?{policyId:r.data.policyId,agentRoleId:r.data.agentRoleId,domainId:r.data.domainId}:{}),runId:r.data.runId,status:r.data.status,candidateId:r.data.candidateId??null,lastCode:r.data.lastCode??null}));
  return {registration:registeredScopeCount?'SCOPES_REGISTERED':'NO_SCOPES_REGISTERED',registeredScopeCount,workers,cycles,
    unrecordedSelectionCount:workers.filter(w=>w.selection.status==='NOT_RECORDED').length,
    frozenOverlayCount:workers.reduce((n,w)=>n+(w.frozenInstructionVersions?.length??0),0),
    unknownOverlayConfigurationCount:workers.filter(w=>w.frozenInstructionVersions===null).length,
    scope:'Recorded registration, cycle status and original worker configuration only. Registration is not evaluator readiness, scope applicability, measured improvement or automatic activation. Frozen overlays are historical selections, not current active pointers. Missing history remains unknown. No model call or state change.'};
}
