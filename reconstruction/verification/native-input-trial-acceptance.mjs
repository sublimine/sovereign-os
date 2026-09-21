import {canonical,sha256} from '../../factory/lib/contracts.mjs';

// Independent finite oracle for this prospective trial. It does not call the
// production selector, repair escapes or replace authenticated origin checks.
export function independentlySelectedBody(request,execution){
  if(typeof request!=='string'||!request.isWellFormed()||request.includes('\0'))return null;
  const exact=value=>typeof value==='string'&&value.length>0&&value.isWellFormed()&&!value.includes('\0');
  const once=(source,part)=>exact(part)&&source.indexOf(part)>=0&&source.indexOf(part)===source.lastIndexOf(part);
  if(execution?.kind==='literal-input-span-v1'){
    if(Object.keys(execution).sort().join(',')!=='after,before,kind'||!once(request,execution.before)||!once(request,execution.after))return null;
    const start=request.indexOf(execution.before)+execution.before.length,end=request.indexOf(execution.after);
    return start<end?request.substring(start,end):null;
  }
  if(execution?.kind==='literal-input-copy-v1'){
    if(Object.keys(execution).sort().join(',')!=='copyText,kind,requestQuote'||!once(request,execution.requestQuote)||!once(execution.requestQuote,execution.copyText))return null;
    const start=request.indexOf(execution.requestQuote)+execution.requestQuote.indexOf(execution.copyText);
    return request.substring(start,start+execution.copyText.length);
  }
  return null;
}
const same=(a,b)=>{try{return canonical(a)===canonical(b);}catch{return false;}};
const empty=a=>Array.isArray(a)&&a.length===0;
const substantiveAccept=r=>r?.result?.decision==='ACCEPT'&&Array.isArray(r.result.checks)&&r.result.checks.length>0
  &&r.result.checks.every(c=>c.verdict==='PASS')&&Array.isArray(r.result.findings)&&!r.result.findings.some(f=>f.severity==='material');
export function nativeInputTrialAcceptance(report,{request,expected}){
  const p=report?.plan,final=report?.final,oneNode=p?.nodes?.length===1&&report?.nodes?.length===1;
  const node=oneNode?p.nodes[0]:null,scheduled=oneNode?report.nodes[0]:null;
  const selected=independentlySelectedBody(request,node?.execution);
  const native=!!node&&['literal-input-copy-v1','literal-input-span-v1'].includes(node.execution?.kind)
    &&node.outputKind==='literal-input-copy'&&empty(node.roleIds)&&node.specialist===null
    &&empty(node.dependencies)&&empty(node.tools)&&empty(node.requiredEffects);
  const ref=final?.payload?.inputRefs?.length===1?final.payload.inputRefs[0]:null;
  const finalReview=report?.reviews?.find(r=>r.artifactId===final?.id&&substantiveAccept(r));
  const planReview=report?.reviews?.find(r=>r.artifactId===ref?.artifactId&&substantiveAccept(r));
  return {
    complete:report?.mission?.status==='COMPLETED'&&!!final&&report.mission.finalArtifactId===final.id,
    originalRequest:typeof request==='string'&&report?.mission?.intent===request&&report.mission.intentHash===sha256(request),
    selectedExactly:typeof expected==='string'&&selected===expected,
    exactBody:typeof expected==='string'&&final?.payload?.body===expected,
    payloadIntegrity:!!final?.payload&&final.payloadHash===sha256(final.payload),
    oneNativeProduct:native&&!!final&&scheduled.id===node.id&&scheduled.status==='ACCEPTED'&&scheduled.artifactId===final.id
      &&same(scheduled.execution,node.execution)&&p.finalNodeId===node.id&&final.payload?.nodeId===node.id
      &&final.payload.kind==='literal-input-copy'&&final.payload.missionId===report?.mission?.id&&final.status==='ACCEPTED',
    frozenNodeCriteria:native&&node.criteria?.length>0&&same(final?.payload?.criteria,node.criteria),
    nativeGates:native&&['input-copy-selection','input-copy-fidelity'].every(id=>node.criteria?.some(c=>c.id===id)),
    allRequirements:Array.isArray(p?.requirements)&&p.requirements.length>0&&p.requirements.every(r=>r.criteria?.length>0
      &&r.criteria.every(c=>final?.payload?.criteria?.some(f=>f.text===c.text&&(f.evaluation??'content')===(c.evaluation??'content')))),
    independentAcceptances:!!planReview&&!!finalReview&&ref?.purpose==='plan'&&planReview.reviewerRunId!==finalReview.reviewerRunId
      &&planReview.result.artifactHash===ref.hash&&finalReview.result.artifactHash===final.payloadHash,
    noEpistemicPromotion:!!final&&empty(final.payload?.claims)&&empty(final.payload?.toolReceipts)
      &&empty(final.payload?.requiredEffects)&&final.payload?.provisional===false,
  };
}
