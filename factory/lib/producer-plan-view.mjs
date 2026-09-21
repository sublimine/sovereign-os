import {canonical,check,clone,sha256} from './contracts.mjs';
import {validatePlan} from './plans.mjs';

export const PRODUCER_CONTEXT_MODES=Object.freeze(['full-plan','node-contract-v1']);

/** A derived contract is not the full artifact under its original payload hash.
 * Keep the original dependency identity, and hash the actual view separately.
 * The immutable user request is still exposed. This closes one structural
 * channel, not semantic contamination through every possible field or tool.
 */
export function producerPlanView(artifact,{missionId,nodeId,intent}) {
  check(artifact?.missionId===missionId&&artifact.payloadHash===sha256(artifact.payload)
    &&artifact.payload.nodeId==='planning'&&artifact.payload.purpose==='plan',
  'PLAN_VIEW','An exact same-mission planning artifact is required');
  let plan;try{plan=JSON.parse(artifact.payload.body);}catch{check(false,'PLAN_VIEW','Planning artifact body must contain the frozen plan');}
  validatePlan(plan,intent);
  const node=plan.nodes.find(n=>n.id===nodeId);
  check(node,'PLAN_VIEW','The producer node must exist in this exact plan');
  const requirementIds=new Set(node.requirementIds);
  const view={schema:'sovereign.node-contract.v1',node:clone(node),
    requirements:clone(plan.requirements.filter(r=>nodeId===plan.finalNodeId||requirementIds.has(r.id))),
    isFinalProduct:nodeId===plan.finalNodeId};
  return {artifactId:artifact.id,artifactHash:artifact.payloadHash,planHash:sha256(plan),
    viewHash:sha256(view),view,
    scope:'Exact own node and its served requirements; final node retains all requirements. Other node contracts and global routing prose are not supplied by this projection. Original user intent, declared accepted dependencies, own observations and feedback remain separate context. Not a guarantee of semantic blindness, workspace isolation or absence of incidental hints.'};
}

/** Recompute from trusted records. No caller-supplied summary or altered view. */
export function validateProducerPlanViews(store,{missionId,nodeId,mode,context}) {
  const mission=store.get('mission',missionId)?.data;
  const plans=context.artifactIds.map(id=>store.get('artifact',id)?.data).filter(a=>a?.payload.nodeId==='planning');
  if(context.planViews===undefined){
    check(!(mode==='producer'&&nodeId!=='planning'&&mission?.policy?.producerContext==='node-contract-v1'&&plans.length),
      'PLAN_VIEW','Selected node contract cannot silently expose a full planning artifact');
    return;
  }
  check(mode==='producer'&&nodeId!=='planning'&&Array.isArray(context.planViews)&&context.planViews.length>0,
    'PLAN_VIEW','Only an actual material producer may receive plan views');
  check(mission&&mission.intentHash===sha256(mission.intent)&&mission.policy?.producerContext==='node-contract-v1',
    'PLAN_VIEW','A frozen mission policy must select node contracts');
  check(plans.length===1&&plans[0].status==='ACCEPTED','PLAN_VIEW','Exactly one accepted planning dependency is required');
  const expected=plans.map(artifact=>producerPlanView(artifact,{missionId,nodeId,intent:mission.intent}));
  check(canonical(expected)===canonical(context.planViews),'PLAN_VIEW','Stored plan view differs from the exact contract');
}
