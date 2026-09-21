import {check,sha256} from './contracts.mjs';
import {producerInputEvidence,documentRequestInventory} from './inference-request-evidence.mjs';

/** Historical admission metadata only. No artifact/source bodies, private
 * conversation, or claims about model pretraining/host-wide surveillance.
 * Cut off at immutable candidate creation, not its later review/status version.
 */
export function productionScope(registry,artifactId) {
  const {store}=registry,artifact=store.get('artifact',artifactId,1);
  check(artifact&&artifact.data.payloadHash===sha256(artifact.data.payload),'RUNTIME_INTEGRITY','Candidate creation record is required');
  const a=artifact.data,cutoff=registry.committedSequence('artifact',artifactId,1),attempts=[];
  for(const head of store.list('run')){
    if(head.data.missionId!==a.missionId||!['producer','replicator'].includes(head.data.mode)||head.data.nodeId!==a.payload.nodeId)continue;
    let record=head;
    while(record&&registry.committedSequence('run',record.id,record.version)>=cutoff)record=record.version>1?store.get('run',record.id,record.version-1):null;
    if(!record)continue;
    const r=record.data;
    check(r.missionId===a.missionId&&r.mode===head.data.mode&&r.nodeId===a.payload.nodeId,'RUNTIME_INTEGRITY','Historical producer identity drifted');
    const histories=[...(r.contextHistory??[]),{context:r.context,contextHash:r.contextHash}],contexts=[];
    for(const entry of histories){
      check(entry.contextHash===sha256(entry.context),'RUNTIME_INTEGRITY','Historical context digest differs');
      if(contexts.some(c=>c.contextHash===entry.contextHash))continue;
      const c=entry.context;
      const artifacts=c.artifactIds.map(id=>{
        const record=store.get('artifact',id,1),p=record?.data;
        check(p&&p.missionId===a.missionId&&p.payloadHash===sha256(p.payload)&&registry.committedSequence('artifact',id,1)<cutoff,'RUNTIME_INTEGRITY','Admitted artifact is missing, foreign or later than the candidate');
        const view=c.planViews?.find(v=>v.artifactId===id);
        if(view)check(view.artifactHash===p.payloadHash&&view.viewHash===sha256(view.view),'RUNTIME_INTEGRITY','Historical plan view binding differs');
        return {id,hash:p.payloadHash,kind:p.payload.kind,nodeId:p.payload.nodeId,purpose:p.payload.purpose,
          ...(view?{exposure:'NODE_CONTRACT_VIEW',viewHash:view.viewHash,viewSchema:view.view.schema,
            viewedNodeId:view.view.node.id,viewedRequirementIds:view.view.requirements.map(r=>r.id),scope:view.scope}:{})};
      });
      const sources=c.sourceIds.map(id=>{const source=store.get('source',id,1)?.data;check(source&&source.missionId===a.missionId,'RUNTIME_INTEGRITY','Admitted source is missing or foreign');return {id,hash:source.hash};});
      contexts.push({contextHash:entry.contextHash,purpose:c.purpose,instructionsHash:c.instructionsHash,
        producerConversationIncluded:c.producerConversationIncluded,artifacts,sources});
    }
    attempts.push({runId:r.id,mode:r.mode,record:{type:'run',id:record.id,version:record.version,hash:record.hash},
      creationSequence:registry.committedSequence('run',r.id,1),contexts,
      requests:(r.requests??[]).map(q=>{const documentary=documentRequestInventory(store,r,q.requestHash);return {requestHash:q.requestHash,contextHash:q.contextHash,producerInput:producerInputEvidence(store,r,q.requestHash),...(documentary?{documentary}:{})};}),
      completedInferences:(r.inferenceReceipts??[]).map(q=>({threadId:q.threadId,turnId:q.turnId,requestHash:q.contextHash??null,simulation:q.simulation??null})),
      toolObservationIds:(r.toolObservations??[]).map(o=>o.id)});
  }
  check(attempts.some(r=>r.runId===a.payload.producerRunId),'RUNTIME_INTEGRITY','Candidate producer has no prior admission record');
  attempts.sort((a,b)=>a.creationSequence-b.creationSequence);
  return {artifactId,artifactHash:a.payloadHash,nodeId:a.payload.nodeId,producerRunId:a.payload.producerRunId,
    candidateRecord:{type:'artifact',id:artifact.id,version:1,hash:artifact.hash},candidateCreationSequence:cutoff,attempts,
    scope:'Authenticated context-admission metadata of this exact candidate producer and earlier material attempts (producer or replicator) of the same mission/node, as recorded BEFORE candidate creation. Includes actual actor modes, every retained context version and declared artifact/source identity, request hashes and completed inference thread identities. For documentary actors, legacy contexts.sources may be empty: inspect requests.documentary for actual grants and literal window ranges in the retained input. A replicator mode label is NOT proof of a sealed or successful blind replication. No source/artifact bodies or private conversation are disclosed. A manifest proves controller-admitted artifacts, not their semantic truth, all incidental text in feedback, model pretraining knowledge, host-wide isolation or future attempts. No absence or acceptance verdict is inferred by this inventory.'};
}
