import {check,sha256,canonical} from './contracts.mjs';
import {documentRequestInventory} from './inference-request-evidence.mjs';
import {methodRecoveryGateBoundary} from './method-recovery.mjs';

/** Historical acceptance gates, not a new judgment of dependency content.
 * A current ACCEPTED label must not be backdated into an earlier producer run.
 * The cutoff is the FIRST attempt of this candidate's node, including failed
 * attempts, and records are selected by journal sequence rather than wall time.
 */
export function dependencyGates(registry,artifactId) {
  const {store}=registry,record=store.get('artifact',artifactId,1),a=record?.data;
  check(a&&a.payloadHash===sha256(a.payload),'RUNTIME_INTEGRITY','Exact candidate creation required');
  const ref=r=>({type:r.type,id:r.id,version:r.version,hash:r.hash});
  const candidateSequence=registry.committedSequence('artifact',artifactId,1);
  const producers=store.list('run').filter(r=>r.data.missionId===a.missionId&&['producer','replicator'].includes(r.data.mode)&&r.data.nodeId===a.payload.nodeId)
    .map(r=>store.get('run',r.id,1)).map(r=>({record:r,seq:registry.committedSequence('run',r.id,1)}))
    .filter(r=>r.seq!==null&&r.seq<candidateSequence).sort((a,b)=>a.seq-b.seq);
  check(producers.some(r=>r.record.id===a.payload.producerRunId),'RUNTIME_INTEGRITY','Candidate producer precedes its artifact');
  const first=producers[0];
  const before=(type,id,cutoff)=>{
    let r=store.get(type,id);
    while(r){
      const seq=registry.committedSequence(type,id,r.version);
      check(seq!==null,'RUNTIME_INTEGRITY','Historical gate record lacks its journal commitment');
      if(seq<cutoff)break;
      r=r.version>1?store.get(type,id,r.version-1):null;
    }
    return r;
  };
  const dependenciesAt=attempt=>{const dependencies=[];
  for(const input of a.payload.inputRefs){
    const prior=before('artifact',input.artifactId,attempt.seq),p=prior?.data;
    if(p)check(p.missionId===a.missionId&&p.payloadHash===sha256(p.payload),'RUNTIME_INTEGRITY','Historical dependency integrity differs');
    const matches=!!p&&p.payloadHash===input.hash&&p.payload.purpose===input.purpose;
    const review=matches&&p.reviews?.length?before('review',p.reviews.at(-1),attempt.seq):null;
    const judgment=review?.data,reviewer=judgment?before('run',judgment.reviewerRunId,registry.committedSequence('review',review.id,review.version)):null;
    const reviewMatches=!!judgment&&judgment.artifactId===input.artifactId&&judgment.result.artifactHash===input.hash&&judgment.result.purpose===input.purpose;
    const accepted=matches&&p.status==='ACCEPTED'&&reviewMatches&&judgment.result.decision==='ACCEPT';
    const criteria=matches?p.payload.criteria:[];
    const checks=reviewMatches?judgment.result.checks.map(c=>({criterionId:c.criterionId,verdict:c.verdict,reason:c.reason,
      evidenceBindings:c.evidence.map(e=>({kind:e.kind,id:e.id,hash:e.hash}))})):[];
    const documentary=reviewer&&judgment?.documentary?documentRequestInventory(store,reviewer.data,judgment.documentary.requestHash):null;
    const reviewerMatches=!!reviewer&&reviewer.data.missionId===a.missionId&&reviewer.data.mode==='reviewer'
      &&reviewer.id!==p?.payload.producerRunId&&reviewer.data.context.producerConversationIncluded===false
      &&reviewer.data.context.artifactIds.includes(input.artifactId)&&reviewer.data.completedExposureHash===registry.exposureHash(reviewer.data)
      &&!reviewer.data.expectedRequestHash&&(!judgment.documentary||documentary?.state==='COMPLETED_INPUT'
        &&documentary.frameRecord.id===judgment.documentary.frameId&&reviewer.data.inferenceReceipt?.contextHash===judgment.documentary.requestHash);
    dependencies.push({input:{...input},artifactRecord:prior?ref(prior):null,
      statusBeforeFirstAttempt:p?.status??null,payloadBindingMatches:matches,
      acceptanceSequence:accepted?registry.committedSequence('artifact',prior.id,prior.version):null,
      acceptedBeforeFirstAttempt:accepted,
      review:reviewMatches?{record:ref(review),committedSequence:registry.committedSequence('review',review.id,review.version),decision:judgment.result.decision,
        reviewerRunId:judgment.reviewerRunId,producerRunId:p.payload.producerRunId,criteria,checks,
        completePassingChecks:canonical(checks.map(c=>c.criterionId).sort())===canonical(criteria.map(c=>c.id).sort())&&checks.every(c=>c.verdict==='PASS'),
        separateCompletedReviewerExposure:reviewerMatches,reviewerRecord:reviewer?ref(reviewer):null,
        ...(documentary?{documentary}:{}),
        inferenceReceiptHash:reviewer?.data.inferenceReceipt?sha256(reviewer.data.inferenceReceipt):null}:null});
  }
  return dependencies;};
  const boundary=methodRecoveryGateBoundary(registry,a);let methodRevision=null;
  if(boundary){
    const revised=producers.find(p=>p.seq>boundary.afterSequence&&p.record.data.context.artifactIds.includes(boundary.planArtifactId));
    check(revised,'RUNTIME_INTEGRITY','Method epoch has no prospective producer');
    methodRevision={...boundary,firstProducerRunId:revised.record.id,firstProducerSequence:revised.seq,firstProducerRecord:ref(revised.record),
      dependencies:dependenciesAt(revised).map(({acceptedBeforeFirstAttempt,statusBeforeFirstAttempt,...rest})=>({...rest,
        acceptedBeforeFirstRevisionAttempt:acceptedBeforeFirstAttempt,statusBeforeFirstRevisionAttempt:statusBeforeFirstAttempt}))};
  }
  return {artifactId,artifactHash:a.payloadHash,candidateRecord:ref(record),candidateSequence,
    firstProducerRunId:first.record.id,firstProducerMode:first.record.data.mode,firstProducerSequence:first.seq,firstProducerRecord:ref(first.record),dependencies:dependenciesAt(first),
    ...(methodRevision?{methodRevision}:{}),
    scope:'Historical exact-version acceptance and stored substantive check results BEFORE the first producer attempt of this candidate node. Includes plan and material inputRefs, not arbitrary siblings or the current candidate own acceptance. Metadata and public check reasons only; no artifact/source bodies, evidence passages or private conversation. A recorded PASS is a prior reviewer decision, not a new truth guarantee; late/current acceptance cannot repair an absent historical gate. Current revocation remains separately enforced at point of use.'};
}
