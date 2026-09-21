import {canonical,sha256} from '../../factory/lib/contracts.mjs';

// Structural consistency of already recorded trial products, not a new review
// or semantic acceptance. Missing/unproduced nodes are false, not lookup errors.
// Storage errors deliberately propagate; corruption must not be hidden as false.
export function allTrialNodesAccepted(report,artifactById){
  if(typeof report?.mission?.id!=='string'||!Array.isArray(report.nodes)||!report.nodes.length)return false;
  return report.nodes.every(node=>{
    if(node?.status!=='ACCEPTED'||typeof node.id!=='string'||!node.id||typeof node.artifactId!=='string'||!node.artifactId
      ||!Array.isArray(node.criteria)||!node.criteria.length)return false;
    const artifact=artifactById(node.artifactId);
    return !!artifact&&artifact.id===node.artifactId&&artifact.missionId===report.mission.id&&artifact.status==='ACCEPTED'
      &&artifact.payload?.nodeId===node.id&&Array.isArray(artifact.payload.criteria)&&artifact.payloadHash===sha256(artifact.payload)
      &&canonical(artifact.payload.criteria)===canonical(node.criteria);
  });
}

// Final may be the native comparison or an accepted downstream deliverable.
// Follow actual immutable inputRefs, not merely the planner's intended edges.
// This establishes consumption, NOT faithful prose or semantic correctness.
export function acceptedFinalConsumesComparison(report,comparison,artifactById){
  if(report?.mission?.status!=='COMPLETED'||!report.final?.id||!comparison?.id
    ||!report.plan?.finalNodeId||!allTrialNodesAccepted(report,artifactById))return false;
  const valid=a=>!!a&&a.missionId===report.mission.id&&a.status==='ACCEPTED'&&a.payloadHash===sha256(a.payload);
  const final=artifactById(report.final.id),target=artifactById(comparison.id);
  if(!valid(final)||!valid(target)||final.payloadHash!==report.final.payloadHash
    ||target.payloadHash!==comparison.payloadHash||final.payload.nodeId!==report.plan.finalNodeId
    ||target.payload.purpose!=='closed-blind-comparison')return false;
  const nodes=report.nodes;
  if(!nodes.some(n=>n.id===final.payload.nodeId&&n.artifactId===final.id)
    ||!nodes.some(n=>n.id===target.payload.nodeId&&n.artifactId===target.id))return false;
  const active=new Set(),done=new Map();let count=0;
  const visit=a=>{
    if(active.has(a.id)||!valid(a))return {valid:false,found:false};
    if(done.has(a.id))return done.get(a.id);
    if(++count>256||!Array.isArray(a.payload.inputRefs))return {valid:false,found:false};
    active.add(a.id);let found=a.id===target.id;
    for(const ref of a.payload.inputRefs){
      if(typeof ref?.artifactId!=='string')return {valid:false,found:false};
      const parent=artifactById(ref.artifactId);
      if(!valid(parent)||parent.payloadHash!==ref.hash||parent.payload.purpose!==ref.purpose)return {valid:false,found:false};
      const result=visit(parent);if(!result.valid)return result;found||=result.found;
    }
    active.delete(a.id);const result={valid:true,found};done.set(a.id,result);return result;
  };
  const result=visit(final);return result.valid&&result.found;
}

// Honest stage-local limits are not a defect merely because unknowns is nonempty.
// Require the whole sealed response and every residual to survive unchanged.
// Their substantive adequacy remains a separate independent review obligation.
export function comparisonPreservesResiduals(body,sealed){
  if(!body?.replica||!body?.comparison||!sealed||!Array.isArray(sealed.controls)
    ||!Array.isArray(sealed.deviations)||!Array.isArray(sealed.unknowns))return false;
  const c=body.comparison;
  return Array.isArray(c.unresolvedControls)&&Array.isArray(c.deviations)&&Array.isArray(c.unknowns)
    &&canonical(body.replica)===canonical(sealed)&&c.replicationEstablished===false
    &&canonical(c.unresolvedControls)===canonical(sealed.controls.filter(control=>control.verdict!=='PASS'))
    &&canonical(c.deviations)===canonical(sealed.deviations)&&canonical(c.unknowns)===canonical(sealed.unknowns);
}
