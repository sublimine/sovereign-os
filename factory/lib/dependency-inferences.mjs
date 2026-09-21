import {canonical,check,sha256} from './contracts.mjs';
import {dependencyGates} from './dependency-gates.mjs';

const ref=r=>r?{type:r.type,id:r.id,version:r.version,hash:r.hash}:null;
function before(registry,type,id,cutoff){
  let record=registry.store.get(type,id);
  while(record){
    const sequence=registry.committedSequence(type,id,record.version);
    check(sequence!==null,'RUNTIME_INTEGRITY','Inference provenance record lacks a journal commitment');
    if(sequence<cutoff)return record;
    record=record.version>1?registry.store.get(type,id,record.version-1):null;
  }
  return null;
}
function describeRun(registry,record,{missionId,mode,nodeId=null,artifactId=null}){
  if(!record)return null;
  const run=record.data,raw=run.inferenceReceipts??(run.inferenceReceipt?[run.inferenceReceipt]:[]);
  check(Array.isArray(raw)&&(!raw.length&&!run.inferenceReceipt||raw.length&&run.inferenceReceipt&&canonical(raw.at(-1))===canonical(run.inferenceReceipt)),
    'RUNTIME_INTEGRITY','Completed inference inventory and last receipt disagree');
  const receipts=raw.map(receipt=>({hash:sha256(receipt),
    origin:receipt.simulation===false?'REAL':receipt.simulation===true?'SIMULATED':'UNKNOWN',
    completed:['completed','COMPLETED'].includes(receipt.status),requestHash:receipt.contextHash??null,
    requestRecorded:typeof receipt.contextHash==='string'&&!!run.requests?.some(q=>q.requestHash===receipt.contextHash)}));
  const origins=new Set(receipts.map(r=>r.origin));
  const origin=!receipts.length?'NONE':origins.has('UNKNOWN')?'UNKNOWN':origins.size===1?[...origins][0]:'MIXED';
  const actorMatches=run.missionId===missionId&&mode.includes(run.mode)
    &&(nodeId===null||run.nodeId===nodeId)
    &&(artifactId===null||run.context.artifactIds.includes(artifactId));
  const completedExposure=!run.expectedRequestHash&&run.completedExposureHash===registry.exposureHash(run);
  return {record:ref(record),committedSequence:registry.committedSequence('run',record.id,record.version),
    actorMatches,completedExposure,pendingRequest:!!run.expectedRequestHash,origin,receipts,
    allReceiptsRecordedReal:receipts.length>0&&receipts.every(r=>r.origin==='REAL'),
    allReceiptsCompletedAndRequestRecorded:receipts.length>0&&receipts.every(r=>r.completed&&r.requestRecorded)};
}
const recordedReal=run=>!!run&&run.actorMatches&&run.completedExposure
  &&run.allReceiptsRecordedReal&&run.allReceiptsCompletedAndRequestRecorded;

/** Additive provenance, not a reinterpretation of historical acceptance.
 * Read the producer before dependency creation and the judge before its review.
 * Later real calls cannot turn a simulated historical gate into a real one.
 */
export function dependencyInferences(registry,artifactId){
  const gates=dependencyGates(registry,artifactId),candidate=registry.store.get('artifact',artifactId,1).data;
  const dependencies=gates.dependencies.map(gate=>{
    const prior=gate.artifactRecord?registry.store.get('artifact',gate.artifactRecord.id,gate.artifactRecord.version):null;
    const created=prior?registry.committedSequence('artifact',prior.id,1):null;
    check(!prior||created!==null,'RUNTIME_INTEGRITY','Dependency creation is not journaled');
    const producerRecord=prior&&typeof prior.data.payload.producerRunId==='string'
      ?before(registry,'run',prior.data.payload.producerRunId,created):null;
    const reviewerRef=gate.review?.reviewerRecord;
    const reviewerRecord=reviewerRef?registry.store.get('run',reviewerRef.id,reviewerRef.version):null;
    check(!reviewerRef||reviewerRecord?.hash===reviewerRef.hash,'RUNTIME_INTEGRITY','Historical reviewer record changed');
    check(!gate.review?.inferenceReceiptHash||sha256(reviewerRecord?.data.inferenceReceipt)===gate.review.inferenceReceiptHash,
      'RUNTIME_INTEGRITY','Historical approval receipt differs from its gate binding');
    const producer=describeRun(registry,producerRecord,{missionId:candidate.missionId,mode:['producer','replicator'],nodeId:prior?.data.payload.nodeId??null});
    const reviewer=describeRun(registry,reviewerRecord,{missionId:candidate.missionId,mode:['reviewer'],artifactId:gate.input.artifactId});
    const recordedRealReviewedGate=gate.acceptedBeforeFirstAttempt&&gate.review?.completePassingChecks===true
      &&gate.review.separateCompletedReviewerExposure&&recordedReal(reviewer);
    return {input:gate.input,artifactRecord:gate.artifactRecord,reviewRecord:gate.review?.record??null,
      acceptedBeforeFirstAttempt:gate.acceptedBeforeFirstAttempt,producer,reviewer,recordedRealReviewedGate,
      productionAndReviewRecordedReal:recordedRealReviewedGate&&recordedReal(producer)};
  });
  return {schema:'sovereign.dependency-inferences.v1',artifactId,artifactHash:gates.artifactHash,
    candidateRecord:gates.candidateRecord,firstProducerRecord:gates.firstProducerRecord,
    firstProducerSequence:gates.firstProducerSequence,dependencies,
    scope:'Recorded inference provenance for immediate inputRefs only, at the historical gate BEFORE this candidate node first material attempt. REAL means an explicit simulation:false in a stored receipt, not independent attestation of a provider call or semantic truth. SIMULATED means simulation:true; UNKNOWN includes missing or non-boolean metadata; NONE means no recorded inference, not verified native execution. All receipts in the selected producer/reviewer run are included, not only the last; other attempts and transitive ancestors are not certified. Producer cutoff is dependency creation; reviewer cutoff is its recorded review. RequestRecorded means a matching dispatched hash in that run, not an external receipt signature. These classifications do not issue or upgrade acceptance. A conditional fixture assessment is not end-to-end real-workflow qualification. Existing acceptance, evidence, native-origin and current revocation controls remain separate.'};
}
