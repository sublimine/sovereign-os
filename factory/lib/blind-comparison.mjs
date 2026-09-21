import {canonical,check,clone,keys,sha256,string} from './contracts.mjs';
import {openedProtocolApproval} from './blind-approval.mjs';
import {openedClosedExposure} from './blind-exposure.mjs';
import {blindMaterialEvidence,blindRecordRef,BLIND_MATERIAL_PURPOSE} from './blind-material.mjs';
import {assertBlindPlanBinding} from './blind-plan.mjs';

export const BLIND_COMPARISON_PURPOSE='closed-blind-comparison';
export const BLIND_COMPARISON_CRITERIA=Object.freeze([
  ['comparison-binding','The cited authenticated artifact-blind-comparison observation binds this exact report to the reviewed sealed attempt, prior opening, original and preregistered executable rule in committed order.'],
  ['comparison-target','The complete original body and complete replica result are the intended comparable quantities or texts. No selected fragment, normalization, changed unit or post-hoc rule substitutes for the requested target.'],
  ['comparison-rule','The executable rule implements the independently approved tolerance and scope. Decimal strings are exact supplied quantities, not evidence of measurement precision; a unit label is not dimensional verification. Literal text equality is not semantic equivalence.'],
  ['comparison-residuals','All original replica controls, deviations and unknowns are retained. A numeric/text MATCH with failed or unknown controls does not establish successful replication; MISMATCH and UNKNOWN are legitimate reported outcomes.'],
  ['comparison-boundary','Acceptance is of this bounded comparison report, not automatic acceptance or repair of the original claim, cognitive independence, world truth or completion of the mission. Remaining material obligations stay explicit.'],
].map(([id,text])=>Object.freeze({id,text})));
export const isBlindComparison=a=>a?.payload.kind==='deterministic-result'&&a.payload.purpose===BLIND_COMPARISON_PURPOSE;
const decimalPattern=/^-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?$/;
function decimal(value){
  if(typeof value!=='string'||value.length>600||!decimalPattern.test(value))return null;
  const [whole,fraction='']=value.split('.');
  if(whole.replace('-','').length>300||fraction.length>300)return null;
  return {integer:BigInt(whole+fraction),scale:fraction.length};
}
function displayDecimal(integer,scale){
  const negative=integer<0n;if(negative)integer=-integer;
  let value=integer.toString().padStart(scale+1,'0');
  if(scale)value=(value.slice(0,-scale)+'.'+value.slice(-scale)).replace(/0+$/,'').replace(/\.$/,'');
  return (negative?'-':'')+value;
}
export function validateComparisonRule(rule){
  check(rule&&typeof rule==='object','BLIND_COMPARISON_RULE','An executable rule must have been included in the accepted public protocol');
  if(rule.kind==='exact-text-v1'){keys(rule,['kind']);return;}
  check(rule.kind==='decimal-distance-v1','BLIND_COMPARISON_RULE','Unsupported preregistered comparison rule');
  keys(rule,['kind','absoluteTolerance','unit']);string(rule.unit,'declared comparison unit',{max:256});
  const tolerance=decimal(rule.absoluteTolerance);
  check(tolerance&&tolerance.integer>=0n,'BLIND_COMPARISON_RULE','Tolerance must be a bounded exact nonnegative decimal string');
}
/** Pure oracle: no model, floating point, parsing of prose, whitespace cleanup,
 * case folding, field selection or inferred tolerance. UNKNOWN preserves an
 * unsupported representation instead of silently coercing it to a number.
 */
export function evaluateBlindComparison(rule,originalBody,replica){
  validateComparisonRule(rule);string(originalBody,'complete original',{max:4*1024*1024});
  let outcome,calculation;
  if(rule.kind==='exact-text-v1'){
    outcome=originalBody===replica.result?'MATCH':'MISMATCH';
    calculation={operation:'Literal equality of complete strings; no normalization',original:originalBody,replica:replica.result};
  }else{
    const a=decimal(originalBody),b=decimal(replica.result),tolerance=decimal(rule.absoluteTolerance);
    if(!a||!b){outcome='UNKNOWN';calculation={operation:'Exact absolute decimal distance',original:originalBody,replica:replica.result,
      reason:'At least one complete value is not a bounded decimal string; no prose extraction, exponent, whitespace or binary-number coercion is permitted.'};}
    else{
      const scale=Math.max(a.scale,b.scale,tolerance.scale),align=v=>v.integer*10n**BigInt(scale-v.scale);
      let distance=align(a)-align(b);if(distance<0n)distance=-distance;
      outcome=distance<=align(tolerance)?'MATCH':'MISMATCH';
      calculation={operation:'abs(original - replica) <= preregistered absolute tolerance',original:originalBody,replica:replica.result,
        absoluteDistance:displayDecimal(distance,scale),absoluteTolerance:rule.absoluteTolerance,declaredUnit:rule.unit};
    }
  }
  const unresolvedControls=replica.controls.filter(c=>c.verdict!=='PASS');
  return {outcome,calculation,unresolvedControls:clone(unresolvedControls),deviations:clone(replica.deviations),unknowns:clone(replica.unknowns),
    replicationEstablished:false,remaining:['Independent assessment of this comparison report.',
      'Separate material acceptance of the original claim, including all unresolved controls, deviations, unknowns and shared roots.'],
    scope:'The recorded rule compares supplied complete values only. MATCH is not truth, cognitive independence, successful controls, a dimensional audit or final claim acceptance.'};
}
export const blindComparisonBody=(replicationId,opening,original,material)=>canonical({schema:'sovereign.closed-blind-comparison.v1',replicationId,
  original:{id:original.id,hash:original.payloadHash,body:original.payload.body,statusAtOpening:original.status},
  materialArtifact:{id:material.artifactId,hash:material.artifactHash},opening:blindRecordRef(opening),
  publicProtocol:material.publicProtocol,replica:material.result,
  comparison:evaluateBlindComparison(material.publicProtocol.comparison,original.payload.body,material.result)});

/** Read-only actor-scoped evidence builder. The report embeds the original only
 * AFTER an accepted sealed attempt and opening. No acceptance of the original
 * is fabricated to smuggle its raw body in as a verified premise.
 */
export function blindComparisonEvidence(registry,artifactId,{current=true,approvalEvidence='historical-v1',exposureEvidence='bilateral-v1'}={}){
  check(['legacy','historical-v1'].includes(approvalEvidence),'BLIND_COMPARISON','Unknown comparison evidence version');
  check(['legacy','bilateral-v1'].includes(exposureEvidence),'BLIND_COMPARISON','Unknown closed exposure evidence version');
  const {store,authority}=registry,candidate=store.get('artifact',artifactId,1),a=candidate?.data;
  check(isBlindComparison(a)&&a.payloadHash===sha256(a.payload),'BLIND_COMPARISON','Exact comparison candidate required');
  let parsed;try{parsed=JSON.parse(a.payload.body);}catch{}
  const record=store.get('blind-comparison','comparison:'+parsed?.replicationId);
  check(record?.version===1,'BLIND_COMPARISON','Immutable comparison binding required');
  const binding=authority.open(record.data.signed,'blind.comparison');
  check(binding.artifactId===artifactId&&binding.artifactHash===a.payloadHash&&binding.nodeId===a.payload.nodeId,
    'BLIND_COMPARISON','Copied report cannot borrow another comparison binding');
  const registration=store.get('blind-registration',binding.replicationId);
  check(registration?.version===1,'BLIND_COMPARISON','Exact preregistration required');
  const registered=authority.open(registration.data.signed,'blind.registration');
  if(registered.planBinding)assertBlindPlanBinding(registry,registered.planBinding,{current,before:registry.committedSequence(registration.type,registration.id,registration.version)});
  check(binding.nodeId===(registered.planBinding?.comparison.id??'comparison:'+binding.replicationId),'BLIND_COMPARISON','Report node differs from frozen assignment');
  const exact=ref=>{const r=store.get(ref.type,ref.id,ref.version);check(r&&r.hash===ref.hash,'BLIND_COMPARISON','Historical comparison dependency changed');return r;};
  const opening=exact(binding.opening),opened=authority.open(opening.data.signed,'blind.opening');
  check(opening.type==='blind-opening'&&opening.version===1&&opening.id===binding.replicationId&&opened.replicationId===binding.replicationId,
    'BLIND_COMPARISON','Opening belongs to another replication');
  const material=blindMaterialEvidence(registry,opened.materialArtifact.id,{current}),originalRecord=exact(binding.original),original=originalRecord.data;
  const materialRecord=exact(binding.material),review=exact(opened.review),reviewer=exact(opened.reviewer),runRecord=exact(binding.run),run=runRecord.data;
  check(material.replicationId===binding.replicationId&&material.artifactHash===opened.materialArtifact.hash
    &&material.records.registration.hash===opened.registrationHash&&material.records.seal.hash===opened.sealHash
    &&originalRecord.type==='artifact'&&original.id===opened.originalRef.artifactId&&original.payloadHash===opened.originalRef.hash
    &&sha256(original.payload)===original.payloadHash&&original.missionId===a.missionId&&['CANDIDATE','ACCEPTED'].includes(original.status)
    &&materialRecord.type==='artifact'&&materialRecord.id===material.artifactId&&materialRecord.data.status==='ACCEPTED'
    &&materialRecord.data.payloadHash===material.artifactHash&&materialRecord.data.reviews.at(-1)===review.id
    &&review.type==='review'&&review.version===1&&review.data.artifactId===material.artifactId&&review.data.reviewerRunId===reviewer.id
    &&review.data.result.decision==='ACCEPT'&&review.data.result.artifactHash===material.artifactHash,
    'BLIND_COMPARISON','Opening, original or accepted material references disagree');
  check(runRecord.type==='run'&&runRecord.version===1&&run.id===a.payload.producerRunId&&run.missionId===a.missionId&&run.nodeId===a.payload.nodeId
    &&run.mode==='producer'&&run.contextHash===sha256(run.context)&&run.context.purpose===BLIND_COMPARISON_PURPOSE
    &&run.context.instructionsHash===sha256({schema:'sovereign.blind-oracle.v1',rule:material.publicProtocol.comparison})
    &&canonical(run.context.artifactIds)===canonical([material.artifactId,original.id])&&run.context.sourceIds.length===0
    &&run.context.producerConversationIncluded===false&&!(run.contextHistory?.length)&&!(run.requests?.length)
    &&!(run.inferenceReceipts?.length)&&!run.inferenceReceipt&&!(run.toolObservations?.length)&&!(run.runtimeObservations?.length),
    'BLIND_COMPARISON','Oracle actor must be the exact fresh deterministic comparison, not a reused model run');
  const body=blindComparisonBody(binding.replicationId,opening,original,material);
  check(a.payload.body===body&&canonical(a.payload.criteria)===canonical(registered.planBinding?.comparison.criteria??BLIND_COMPARISON_CRITERIA)
    &&!a.payload.provisional&&a.payload.claims.length===0&&a.payload.inputRefs.length===0
    &&a.payload.toolReceipts.length===0&&a.payload.requiredEffects.length===0,
    'BLIND_COMPARISON','Report changed, relaxed gates or promoted the raw original to an accepted premise');
  const sequence=r=>{const n=registry.committedSequence(r.type,r.id,r.version);check(Number.isSafeInteger(n)&&n>0,'BLIND_COMPARISON','Comparison dependency lacks committed order');return n;};
  const chronology={material:sequence(materialRecord),review:sequence(review),reviewer:sequence(reviewer),opening:sequence(opening),
    original:sequence(originalRecord),run:sequence(runRecord),candidate:sequence(candidate),binding:sequence(record)};
  check(material.chronology.binding<chronology.reviewer&&chronology.reviewer<chronology.review&&chronology.review<chronology.material
    &&chronology.material<chronology.opening&&chronology.original<chronology.opening&&chronology.opening<chronology.run
    &&chronology.run<chronology.candidate&&chronology.candidate<chronology.binding,'BLIND_COMPARISON','Comparison did not follow material acceptance and unblinding');
  if(current){
    const state=store.get('blind-replication',binding.replicationId)?.data,now=store.get('artifact',artifactId)?.data;
    check(state?.state==='OPENED'&&store.get('blind-opening',binding.replicationId)?.version===1
      &&store.get('blind-opening',binding.replicationId)?.hash===opening.hash&&store.get('run',run.id)?.hash===runRecord.hash
      &&store.get('run',run.id)?.version===runRecord.version&&now?.payloadHash===a.payloadHash
      &&['CANDIDATE','ACCEPTED','RETURNED'].includes(now.status)&&!store.list('effect').some(e=>e.data.principalId===run.id),
      'BLIND_COMPARISON','Oracle exposure, operation history, opening or report was invalidated');
    const accepted=registry.assertUsable(material.artifactId,{missionId:a.missionId,purpose:BLIND_MATERIAL_PURPOSE});
    check(accepted.reviews.at(-1)===review.id&&store.get('review',review.id)?.version===1&&store.get('review',review.id)?.hash===review.hash,
      'BLIND_COMPARISON','Opening approval was superseded');
  }
  // Reproduce a legacy signed observation without pretending its reviewer saw
  // this later extension. Current use still checks the actual prior approval;
  // fresh captures always use historical-v1 and create a new exposure record.
  const protocolApproval=current||approvalEvidence==='historical-v1'
    ?openedProtocolApproval(registry,registration,registered,original,material.chronology.request):null;
  const closedExposure=current||exposureEvidence==='bilateral-v1'
    ?openedClosedExposure(registry,material,reviewer,review,opening):null;
  return {artifactId,artifactHash:a.payloadHash,replicationId:binding.replicationId,
    ...(approvalEvidence==='historical-v1'?{protocolApproval}:{}),...(exposureEvidence==='bilateral-v1'?{closedExposure}:{}),
    records:{binding:blindRecordRef(record),opening:binding.opening,
    material:binding.material,review:opened.review,reviewer:opened.reviewer,original:binding.original,run:binding.run},chronology,
    report:JSON.parse(body),scope:'Authenticated deterministic recomputation of this exact preregistered comparison after accepted material and opening. This is not independent semantic judgment, original acceptance or provider qualification.'};
}
