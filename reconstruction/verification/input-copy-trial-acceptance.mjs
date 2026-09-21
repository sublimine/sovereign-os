import {canonical} from '../../factory/lib/contracts.mjs';

/** Finite external oracle for this diagnostic, not a semantic quality judge. */
export function inputCopyTrialAcceptance(report,expected){
  const plan=report?.plan,nodes=report?.nodes??[],final=report?.final;
  const oneNode=Array.isArray(plan?.nodes)&&plan.nodes.length===1&&nodes.length===1;
  const node=oneNode?plan.nodes[0]:null;
  const actual=nodes[0];
  const native=oneNode&&node.execution?.kind==='literal-input-copy-v1'&&node.outputKind==='literal-input-copy'
    &&node.roleIds?.length===0&&node.specialist===null&&node.dependencies?.length===0&&node.tools?.length===0&&node.requiredEffects?.length===0;
  return {
    complete:report?.mission?.status==='COMPLETED'&&!!final&&report.mission.finalArtifactId===final.id,
    exactBody:typeof expected==='string'&&final?.payload?.body===expected,
    oneNativeProduct:!!native&&!!final&&actual?.id===node.id&&actual.status==='ACCEPTED'&&actual.artifactId===final.id
      &&plan.finalNodeId===node.id&&final.payload?.nodeId===node.id&&final.payload.kind==='literal-input-copy'
      &&final.payload.missionId===report?.mission?.id&&final.status==='ACCEPTED',
    frozenNodeCriteria:!!native&&Array.isArray(node.criteria)&&node.criteria.length>0
      &&Array.isArray(final?.payload?.criteria)&&canonical(final.payload.criteria)===canonical(node.criteria),
    allRequirements:Array.isArray(plan?.requirements)&&plan.requirements.length>0&&plan.requirements.every(r=>Array.isArray(r.criteria)&&r.criteria.length>0
      &&r.criteria.every(c=>final?.payload?.criteria?.some(f=>f.text===c.text&&(f.evaluation??'content')===(c.evaluation??'content')))),
    noEpistemicPromotion:!!final&&final.payload?.claims?.length===0&&final.payload.toolReceipts?.length===0
      &&final.payload.requiredEffects?.length===0&&final.payload.provisional===false,
  };
}
