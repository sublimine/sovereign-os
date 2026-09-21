import {canonical,check,clone,sha256} from './contracts.mjs';
import {inferenceRequestHash} from '../providers/instruction-profiles.mjs';
import {assertClosedReviewThreadFresh,blindRecordRef,closedBlindReviewTarget} from './blind-material.mjs';

// Read only the versions bound by the sealed attempt and its later opening.
// Full retained public requests are needed: a manifest cannot describe incidental
// free text. These are inputs, not private model reasoning or provider secrets.
export function openedClosedExposure(registry,material,reviewerRecord,reviewRecord,opening){
  const {store}=registry;
  const sequence=record=>{
    const n=registry.committedSequence(record.type,record.id,record.version);
    check(Number.isSafeInteger(n)&&n>0,'BLIND_EXPOSURE','Historical exposure lacks committed order');return n;
  };
  const replica=store.get('run',material.records.run.id,material.records.run.version);
  check(replica?.hash===material.records.run.hash&&replica.data.mode==='replicator'
    &&reviewerRecord.type==='run'&&reviewerRecord.data.mode==='reviewer'
    &&reviewRecord.data.reviewerRunId===reviewerRecord.id&&reviewRecord.data.artifactId===material.artifactId,
    'BLIND_EXPOSURE','Exposure actors must be those actually bound to the seal and material approval');
  const reviewSequence=sequence(reviewRecord),openingSequence=sequence(opening);
  check(sequence(replica)<material.chronology.seal&&material.chronology.binding<sequence(reviewerRecord)
    &&sequence(reviewerRecord)<reviewSequence&&reviewSequence<openingSequence,
    'BLIND_EXPOSURE','Closed exposure was not completed before the bound review and opening');
  registry.requireCompletedExposure(reviewerRecord.data);
  assertClosedReviewThreadFresh(registry,reviewerRecord.data,{before:reviewSequence});
  check(closedBlindReviewTarget(store,reviewerRecord.data)?.id===material.artifactId,
    'BLIND_EXPOSURE','Bound reviewer did not perform this exact closed material assessment');

  const actor=record=>{
    const r=record.data,completedSequence=sequence(record);
    registry.requireCompletedExposure(r);
    const contexts=[...(r.contextHistory??[]),{context:r.context,contextHash:r.contextHash}].map(entry=>{
      check(sha256(entry.context)===entry.contextHash,'BLIND_EXPOSURE','Historical context digest differs');
      return {contextHash:entry.contextHash,context:clone(entry.context)};
    });
    const requests=(r.requests??[]).map(q=>{
      const retained=store.get('inference-request','inference-request:'+sha256([r.id,q.requestHash]));
      check(retained?.version===1&&retained.data.retention==='BEFORE_DISPATCH'
        &&retained.data.runId===r.id&&retained.data.missionId===r.missionId&&retained.data.requestHash===q.requestHash,
        'BLIND_EXPOSURE','Historical request has no exact pre-dispatch retention');
      let request;try{request=JSON.parse(retained.data.requestJson);}catch{}
      check(request&&inferenceRequestHash(request)===q.requestHash
        &&contexts.some(c=>c.contextHash===q.contextHash),'BLIND_EXPOSURE','Retained request or admitted context differs');
      const requestSequence=sequence(retained);
      check(requestSequence<completedSequence,'BLIND_EXPOSURE','Request retention occurred after the completed actor');
      return {record:blindRecordRef(retained),sequence:requestSequence,requestHash:q.requestHash,contextHash:q.contextHash,request};
    });
    const completedInferences=clone(r.inferenceReceipts??[]);
    const covered=requests.length>0&&completedInferences.length>0
      &&completedInferences.every(receipt=>receipt.status==='completed'&&requests.some(q=>q.requestHash===receipt.contextHash))
      &&requests.every(q=>completedInferences.some(receipt=>receipt.contextHash===q.requestHash));
    return {record:blindRecordRef(record),mode:r.mode,nodeId:r.nodeId,completedSequence,
      completedExposureHash:r.completedExposureHash,contexts,requests,completedInferences,
      toolObservationIds:(r.toolObservations??[]).map(o=>o.id),
      runtimeObservationIds:(r.runtimeObservations??[]).map(o=>o.id),
      coverage:covered?'RECORDED':'UNKNOWN',
      unknowns:covered?[]:['The retained request history does not cover every completed inference. A receipt or role label alone cannot establish admitted input.']};
  };
  const replicaExposure=actor(replica),reviewerExposure=actor(reviewerRecord);
  check(replicaExposure.requests.length===1&&canonical(replicaExposure.requests[0].request)===canonical(material.request),
    'BLIND_EXPOSURE','Projected replica request differs from the actual sealed material request');
  return {schema:'sovereign.closed-exposure.v1',replicationId:material.replicationId,
    replica:replicaExposure,materialReviewer:reviewerExposure,
    materialReview:{record:blindRecordRef(reviewRecord),sequence:reviewSequence,result:clone(reviewRecord.data.result)},
    opening:blindRecordRef(opening),openingSequence,
    scope:'Exact completed controller-admitted contexts and retained public requests of the sealed replica and its material reviewer, as bound before opening. Later contexts cannot rewrite this snapshot. RECORDED means request coverage, not semantic nonexposure, cognitive independence, provider internals or host isolation. Inspect all actual request content; missing coverage remains UNKNOWN. Exposed only after opening, never supplied to either closed actor.'};
}
