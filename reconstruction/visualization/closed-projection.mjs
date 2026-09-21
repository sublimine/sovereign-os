import {canonical,sha256} from '../../factory/lib/contracts.mjs';
import {inferenceRequestHash} from '../../factory/providers/instruction-profiles.mjs';
import {unpackJsonContext} from '../../factory/lib/context-json-codec.mjs';
import {unpackContext} from '../../factory/lib/context-codec.mjs';
import {expandCatalogReview,expandReviewReferences} from '../../factory/lib/review-codec.mjs';

export function decodedRequest(request){
  const wire=JSON.parse(request.input);
  return wire.encoding==='sovereign.lossless-context.v2'?unpackJsonContext(wire)
    :wire.encoding==='sovereign.lossless-context.v1'?unpackContext(wire):wire;
}

// A closed replica has no ordinary artifacts collection. Do not fabricate one,
// or confuse private controller bindings with model-visible dependencies.
export function exposedArtifacts(input){
  if(input.schema==='sovereign.blind-input.v1'){
    if(canonical(Object.keys(input).sort())!==canonical(['publicProtocol','replicationId','schema']))throw Error('Unexpected closed input fields');
    return [];
  }
  if(!Array.isArray(input.artifacts))throw Error('Unrecognized ordinary input: artifact exposure unavailable');
  return input.artifacts.map(a=>a.id);
}

export function projectClosedExperiments(store,missionId,pool){
  const keep=record=>{
    if(!record)return null;
    pool[record.hash]??={type:record.type,id:record.id,version:record.version,hash:record.hash,createdAt:record.createdAt,data:record.data};
    return record.hash;
  };
  return store.list('blind-registration').filter(r=>r.data.signed.data.missionId===missionId).map(registration=>{
    const binding=registration.data.signed.data,request=JSON.parse(binding.requestJson),input=decodedRequest(request);
    if(inferenceRequestHash(request)!==binding.requestHash||input.replicationId!==registration.id)throw Error('Closed registration request identity differs');
    exposedArtifacts(input);
    const run=store.get('run',binding.runId),state=store.get('blind-replication',registration.id),seal=store.get('blind-seal',registration.id);
    if(!state||state.data.registrationHash!==registration.hash)throw Error('Closed registration/state binding differs');
    if(seal&&(state.data.sealHash!==seal.hash||seal.data.signed.data.registrationHash!==registration.hash||seal.data.signed.data.requestHash!==binding.requestHash))throw Error('Closed seal identity differs');
    return {replicationId:registration.id,nodeId:run?.data.nodeId??null,state:state.data.state,runId:binding.runId,
      requestHash:binding.requestHash,publicInput:input,
      requestDispatched:run?.data.requests?.some(r=>r.requestHash===binding.requestHash)??false,
      requestCompleted:run?.data.inferenceReceipts?.some(r=>r.contextHash===binding.requestHash)??false,
      records:[registration,state,seal,store.get('blind-workflow',registration.id),store.get('blind-material',registration.id),
        store.get('blind-opening',registration.id),...store.list('blind-comparison').filter(r=>r.data.signed.data.replicationId===registration.id)]
        .filter(Boolean).map(keep),
      result:seal?.data.signed.data.result??null,
      openingRecorded:!!store.get('blind-opening',registration.id),
      scope:'Journal-verified historical projection. The private control records are not model input. No live external or universal independence certification.'};
  });
}

export function projectRejectedReview(store,record){
  const value=record.data;
  if(value.payloadCaptured&&sha256(value.response)!==value.responseHash)throw Error('Rejected response hash differs');
  const encoding=store.list('worker-review-encoding').find(r=>r.data.runId===value.runId&&r.data.artifactId===value.artifactId&&r.data.rawResponseHash===value.responseHash);
  let expanded=null;
  if(value.payloadCaptured){
    if(!encoding)return {recordId:record.id,recordHash:record.hash,...value,expanded:null,encoding:null,
      disposition:'Controller-rejected response, NOT a committed semantic review or acceptance. No exact codec record: raw response retained, no invented expansion.'};
    const e=encoding.data;
    if(!['evidence-catalog-v1','evidence-refs-v1'].includes(e.encoding))throw Error('Unrecognized retained review codec');
    if(sha256(e.rawResponse)!==value.responseHash||canonical(e.rawResponse)!==canonical(value.response))throw Error('Rejected response/codec binding differs');
    expanded=e.encoding==='evidence-catalog-v1'?expandCatalogReview(value.response,e.observedCatalog)
      :e.encoding==='evidence-refs-v1'?expandReviewReferences(value.response):value.response;
    if(sha256(expanded)!==e.expandedResponseHash)throw Error('Expanded rejected response hash differs');
  }
  return {recordId:record.id,recordHash:record.hash,...value,expanded,
    encoding:encoding?{recordId:encoding.id,recordHash:encoding.hash,...encoding.data}:null,
    disposition:'Controller-rejected response, NOT a committed semantic review or acceptance.'};
}
