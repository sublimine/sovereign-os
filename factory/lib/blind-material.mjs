import {canonical,check,clone,sha256} from './contracts.mjs';
import {inferenceRequestHash} from '../providers/instruction-profiles.mjs';
import {readSourceContextView} from './source-context-view.mjs';
import {assertBlindPlanBinding} from './blind-plan.mjs';
import {missionInferenceBudget} from './mission-inference-budget.mjs';
import {assertMissionBlindReplicaDispatchProvenance,readMissionBlindReplicaRegistration} from './mission-blind-replica-provenance.mjs';

export const BLIND_MATERIAL_KIND='closed-blind-attempt';
export const BLIND_MATERIAL_PURPOSE='closed-blind-attempt-assessment';
export const BLIND_MATERIAL_CRITERIA=Object.freeze([
  ['attempt-binding','The authenticated artifact-blind-material observation binds this exact candidate to the preregistered public protocol, actual request, completed replica and seal in the required journal order. A producer statement or mode label alone is insufficient.'],
  ['attempt-method','The public argument substantively follows the preregistered method and supplied premises; the record does not invent computation, tools, observations or missing empirical evidence.'],
  ['attempt-controls','Every preregistered control is reported exactly once and its verdict matches its recorded observation. Failed controls and divergent outcomes remain explicit; accepting an accurately reported failed attempt is not accepting the original claim.'],
  ['attempt-limits','Deviations, unknowns, stopping conditions, varying dimensions, shared roots and limitations are faithfully accounted for. Missing material support is not certainty or a claim of cognitive independence.'],
  ['attempt-boundary','This is assessment of the recorded attempt, not comparison with the private original or final material acceptance of its claim. No tolerance, original, protocol or sealed result has been repaired after seeing the outcome.'],
].map(([id,text])=>Object.freeze({id,text})));
export const blindRecordRef=r=>({type:r.type,id:r.id,version:r.version,hash:r.hash});
export const BLIND_REVIEW_OBSERVATIONS=Object.freeze(['artifact-blind-material','artifact-production-scope','node-effect-inventory']);
/** Closed judges require fresh threads across actors, not just a new local run
 * ID. A later actor reusing a thread cannot rewrite a past approval's exposure. */
export function assertClosedReviewThreadFresh(registry,run,{before=null}={}){
  registry.requireCompletedExposure(run);
  const threads=new Set([run.providerThreadId,...(run.inferenceReceipts??[]).map(r=>r.threadId)].filter(Boolean));
  for(let record of registry.store.list('run')){
    if(record.id===run.id)continue;
    if(before!==null)while(record){
      const sequence=registry.committedSequence('run',record.id,record.version);
      check(Number.isSafeInteger(sequence)&&sequence>0,'BLIND_REVIEW','Other actor history lacks committed order');
      if(sequence<before)break;
      record=record.version>1?registry.store.get('run',record.id,record.version-1):null;
    }
    if(!record)continue;
    check(!threads.has(record.data.providerThreadId)&&!(record.data.inferenceReceipts??[]).some(r=>threads.has(r.threadId)),
      'BLIND_REVIEW','Closed attempt assessment cannot reuse any earlier actor thread, including the private protocol author or planner');
  }
}
function decodedInput(input){
  return readSourceContextView(input);
}
export function closedBlindReviewTarget(store,run){
  // A later product may legitimately consume an already accepted attempt.
  // Seeing that ancestor does not make the later product's reviewer the closed
  // attempt judge. Actual attempt acceptance separately requires this purpose.
  if(run.mode!=='reviewer'||run.context.purpose!==BLIND_MATERIAL_PURPOSE)return null;
  const targets=run.context.artifactIds.map(id=>store.get('artifact',id)?.data).filter(a=>a?.payload.kind===BLIND_MATERIAL_KIND);
  if(!targets.length)return null;
  const target=targets[0];
  check(targets.length===1&&run.context.artifactIds.length===1&&run.context.sourceIds.length===0
    &&!(run.toolObservations?.length)&&!(run.runtimeObservations??[]).some(o=>!BLIND_REVIEW_OBSERVATIONS.includes(o.kind)),
    'BLIND_REVIEW_CONTEXT','Closed attempt review cannot receive siblings, sources, tools or ambient mission history');
  for(const prior of run.contextHistory??[])check(prior.context.artifactIds.every(id=>id===target.id)
    &&prior.context.sourceIds.length===0,'BLIND_REVIEW_CONTEXT','Earlier private exposure cannot be erased before attempt review');
  for(const observed of run.runtimeObservations??[]){
    let snapshot;try{snapshot=JSON.parse(observed.quoteText);}catch{}
    check(snapshot&&(snapshot.kind==='node-effect-inventory'?snapshot.detail.nodeId===target.payload.nodeId:snapshot.detail.artifactId===target.id),
      'BLIND_REVIEW_CONTEXT','Prior ambient observation is outside this exact closed attempt');
  }
  // Artifact/source manifests do not describe free-text exposure. Every actual
  // retained request of a reused actor must itself be a closed assessment of
  // this target; a later sanitized envelope cannot erase a prior ordinary one.
  for(const q of run.requests??[]){
    const retained=store.get('inference-request','inference-request:'+sha256([run.id,q.requestHash]));
    check(retained?.version===1&&retained.data.runId===run.id&&retained.data.requestHash===q.requestHash
      &&retained.data.retention==='BEFORE_DISPATCH','BLIND_REVIEW_CONTEXT','Prior request has no exact pre-dispatch public retention');
    let request,input;try{request=JSON.parse(retained.data.requestJson);input=decodedInput(request.input);}catch{}
    check(request&&inferenceRequestHash(request)===q.requestHash&&input?.publicReviewMandate?.schema==='sovereign.closed-blind-review.v1'
      &&input.publicReviewMandate.artifactId===target.id&&!Object.hasOwn(input,'missionIntent')
      &&Array.isArray(input.artifacts)&&input.artifacts.length===1&&input.artifacts[0].id===target.id&&input.artifacts[0].hash===target.payloadHash
      &&Array.isArray(input.sources)&&input.sources.length===0&&Array.isArray(input.toolObservations)&&input.toolObservations.length===0
      &&(input.runtimeObservations??[]).every(o=>BLIND_REVIEW_OBSERVATIONS.includes(o.kind)),
      'BLIND_REVIEW_CONTEXT','An earlier ordinary/private request cannot become a closed material review');
  }
  return target;
}
export function blindMaterialBody(replicationId,publicProtocol,result){
  return canonical({schema:'sovereign.closed-blind-attempt.v1',replicationId,publicProtocol,result});
}
const SCOPE='Authenticated public request, frozen protocol section, exact sealed response and journal order for this candidate. No original/private protocol binding is disclosed. Integrity, controller-recorded exposure and order are not semantic correctness, successful replication, cognitive independence, host isolation or final acceptance. Failed controls remain evidence, not something to erase. An explicit completed UNKNOWN is assessable as an attempt record; even if accepted it has no result and never authorizes original opening or comparison. A lost or incomplete provider response cannot be substituted with UNKNOWN.';

/** Read-only public projection. Never return the signed PRIVATE registration or
 * full protocol artifact. The separately signed observation is actor-scoped by
 * ArtifactRegistry. Historical reads preserve proof without reviving authority.
 */
export function blindMaterialEvidence(registry,artifactId,{current=true}={}){
  const {store,authority}=registry,artifact=store.get('artifact',artifactId,1),a=artifact?.data;
  check(a?.payload.kind===BLIND_MATERIAL_KIND&&a.payloadHash===sha256(a.payload),'BLIND_MATERIAL','Exact material candidate required');
  let parsed;try{parsed=JSON.parse(a.payload.body);}catch{}
  const replicationId=parsed?.replicationId,material=store.get('blind-material',replicationId);
  check(material?.version===1,'BLIND_MATERIAL','Material binding is missing or changed');
  const binding=authority.open(material.data.signed,'blind.material');
  check(binding.replicationId===replicationId&&binding.artifactId===artifactId&&binding.artifactHash===a.payloadHash,
    'BLIND_MATERIAL','A different artifact cannot borrow a sealed attempt binding');
  const exact=ref=>{
    const r=store.get(ref.type,ref.id,ref.version);
    check(r&&r.hash===ref.hash,'BLIND_MATERIAL','Bound historical record changed');return r;
  };
  const registration=exact(binding.registration),registered=authority.open(registration.data.signed,'blind.registration');
  const frozenRegistration=readMissionBlindReplicaRegistration({store,authority},blindRecordRef(registration),{current});
  check(frozenRegistration.replicationId===replicationId&&frozenRegistration.missionId===a.missionId&&frozenRegistration.runId===a.payload.producerRunId
    &&frozenRegistration.requestHash===registered.requestHash,'BLIND_MATERIAL','Signed registration lineage differs from material binding');
  if(registered.planBinding)assertBlindPlanBinding(registry,registered.planBinding,{current,before:registry.committedSequence(registration.type,registration.id,registration.version)});
  const sealRecord=exact(binding.seal),seal=authority.open(sealRecord.data.signed,'blind.result'),runRecord=exact(binding.run),run=runRecord.data;
  check(registration.version===1&&sealRecord.version===1&&registration.id===replicationId&&sealRecord.id===replicationId
    &&registered.replicationId===replicationId&&registered.missionId===a.missionId&&registered.runId===a.payload.producerRunId
    &&seal.replicationId===replicationId&&seal.runId===run.id&&seal.registrationHash===registration.hash&&seal.requestHash===registered.requestHash,
    'BLIND_MATERIAL','Registration, seal and candidate refer to different executions');
  const request=JSON.parse(registered.requestJson);
  check(inferenceRequestHash(request)===registered.requestHash,'BLIND_MATERIAL','Actual request does not match its frozen digest');
  const requestRecord=store.get('inference-request','inference-request:'+sha256([run.id,registered.requestHash]));
  check(requestRecord?.version===1&&requestRecord.data.retention==='BEFORE_DISPATCH'
    &&requestRecord.data.runId===run.id&&requestRecord.data.missionId===a.missionId
    &&requestRecord.data.requestHash===registered.requestHash&&requestRecord.data.requestJson===registered.requestJson,
    'BLIND_MATERIAL','Exact public request was not retained before dispatch');
  // A budgeted replica needs both its ordinary closed-material evidence and
  // the separate immutable logical-call provenance.  Do not expose the proof
  // or its private registration payload in this public projection; merely
  // fail closed if a later mutation/removal would make the sealed attempt
  // unaccounted for.
  const budgetedAtFreeze=frozenRegistration.missionPolicy.inferenceBudget!==undefined;
  // Current use remains conservative across the whole mission ledger.  A
  // historical evidence read instead verifies only the immutable closed
  // dispatch that produced this candidate, so an unrelated later reservation
  // or policy mutation cannot rewrite the past.
  const currentBudget=current?missionInferenceBudget(registry,a.missionId):null;
  if(current?currentBudget!==null:budgetedAtFreeze){
    const dispatch=assertMissionBlindReplicaDispatchProvenance({store,authority},{replicationId,requestHash:registered.requestHash,
      registration:blindRecordRef(registration),request:blindRecordRef(requestRecord)},{current});
    check(dispatch.runId===run.id&&dispatch.missionId===a.missionId&&dispatch.pendingRun.id===run.id,
      'BLIND_MATERIAL','Budgeted blind dispatch proof belongs to another material attempt');
  }
  const logical=decodedInput(request.input);
  check(canonical(Object.keys(logical).sort())===canonical(['publicProtocol','replicationId','schema'])
    &&logical.schema==='sovereign.blind-input.v1'&&logical.replicationId===replicationId,'BLIND_MATERIAL','Unexpected closed request envelope');
  check(run.mode==='replicator'&&run.missionId===a.missionId&&run.nodeId===(registered.planBinding?.material.id??replicationId)&&a.payload.nodeId===run.nodeId
    &&run.contextHash===registered.contextHash&&sha256(run.context)===registered.contextHash
    &&run.context.artifactIds.length===0&&run.context.sourceIds.length===0&&run.context.producerConversationIncluded===false
    &&!(run.contextHistory?.length)&&!(run.toolObservations?.length)&&!(run.runtimeObservations?.length)
    &&run.requests?.length===1&&run.requests[0].requestHash===registered.requestHash
    &&run.inferenceReceipts?.length===1&&canonical(run.inferenceReceipt)===canonical(seal.receipt),
    'BLIND_MATERIAL','Replica has exposure beyond its one frozen closed request');
  registry.requireCompletedExposure(run);
  check(['RESULT','UNKNOWN'].includes(seal.result.status)
    &&(seal.result.status!=='UNKNOWN'||seal.result.result===''&&Array.isArray(seal.result.unknowns)&&seal.result.unknowns.length>0)
    &&a.payload.body===blindMaterialBody(replicationId,logical.publicProtocol,seal.result)
    &&a.payload.purpose===BLIND_MATERIAL_PURPOSE&&canonical(a.payload.criteria)===canonical(registered.planBinding?.material.criteria??BLIND_MATERIAL_CRITERIA)
    &&a.payload.claims.length===0&&a.payload.inputRefs.length===0&&a.payload.toolReceipts.length===0
    &&a.payload.requiredEffects.length===0&&!a.payload.provisional,'BLIND_MATERIAL','Candidate changed or embellished the exact public attempt');
  const seq=r=>{const n=registry.committedSequence(r.type,r.id,r.version);check(Number.isSafeInteger(n)&&n>0,'BLIND_MATERIAL','Missing journal order');return n;};
  const chronology={registration:seq(registration),request:seq(requestRecord),completedRun:seq(runRecord),seal:seq(sealRecord),candidate:seq(artifact),binding:seq(material)};
  check(chronology.registration<chronology.request&&chronology.request<chronology.completedRun&&chronology.completedRun<chronology.seal
    &&chronology.seal<chronology.candidate&&chronology.candidate<chronology.binding,'BLIND_MATERIAL','Material attempt violates the preregister/request/complete/seal/candidate order');
  if(current){
    const state=store.get('blind-replication',replicationId)?.data,now=store.get('artifact',artifactId)?.data;
    check(state&&(seal.result.status==='UNKNOWN'?state.state==='INCONCLUSIVE':['SEALED','OPENED'].includes(state.state))&&state.materialArtifactId===artifactId
      &&state.registrationHash===registration.hash&&state.sealHash===sealRecord.hash
      &&store.get('blind-registration',replicationId)?.hash===registration.hash&&store.get('blind-registration',replicationId)?.version===1
      &&store.get('blind-seal',replicationId)?.hash===sealRecord.hash&&store.get('blind-seal',replicationId)?.version===1
      &&store.get('run',run.id)?.hash===runRecord.hash&&store.get('run',run.id)?.version===runRecord.version
      &&now?.payloadHash===a.payloadHash&&['CANDIDATE','ACCEPTED','RETURNED'].includes(now.status),
      'BLIND_MATERIAL','Current material binding, replica exposure or seal is no longer valid');
    const protocol=store.get('artifact',registered.protocolRef.id);
    check(protocol?.hash===registered.protocolRef.hash&&protocol.version===registered.protocolRef.version,'BLIND_MATERIAL','Frozen protocol record changed');
    registry.assertUsable(protocol.id,{missionId:a.missionId,purpose:'blind-protocol'});
    const original=store.get('artifact',registered.originalRef.artifactId)?.data;
    check(original?.missionId===a.missionId&&original.payloadHash===registered.originalRef.hash&&sha256(original.payload)===original.payloadHash
      &&['CANDIDATE','ACCEPTED'].includes(original.status)&&!original.payload.provisional,'BLIND_MATERIAL','Original binding has been revoked or altered');
    check(!store.list('effect').some(e=>e.data.principalId===run.id),'BLIND_MATERIAL','Closed replica has a recorded operation intent');
    const mission=store.get('mission',a.missionId)?.data;
    check(mission?.intentHash===registered.missionIntentHash&&sha256(mission.policy)===registered.policyHash,'BLIND_MATERIAL','Mission policy changed');
  }
  return {artifactId,artifactHash:a.payloadHash,replicationId,runId:run.id,
    records:{material:blindRecordRef(material),registration:blindRecordRef(registration),seal:blindRecordRef(sealRecord),run:blindRecordRef(runRecord),request:blindRecordRef(requestRecord)},
    chronology,request:clone(request),publicProtocol:clone(logical.publicProtocol),result:clone(seal.result),scope:SCOPE};
}
