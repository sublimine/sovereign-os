import {canonical,check,clone,sha256} from './contracts.mjs';

const ref=r=>({type:r.type,id:r.id,version:r.version,hash:r.hash});

// Shared historical check for freeze and post-opening evidence. Later exposure
// never backdates approval. This helper does not emit model context or authorize
// dispatch/opening: callers retain those separate stage-specific gates.
export function historicalBlindApproval(registry,artifact,original){
  const {store}=registry,missionId=artifact.missionId;
  const review=store.get('review',artifact.reviews.at(-1));
  check(review?.version===1&&review.data.artifactId===artifact.id&&review.data.result.decision==='ACCEPT'
    &&review.data.result.artifactHash===artifact.payloadHash,'BLIND_PROTOCOL','Immutable exact protocol acceptance required');
  const before=registry.committedSequence('review',review.id,review.version);
  check(Number.isSafeInteger(before)&&before>0,'BLIND_PROTOCOL','Protocol acceptance has no committed order');
  const runBefore=runId=>{
    const head=store.get('run',runId);
    for(let version=head?.version??0;version>0;version--){
      const sequence=registry.committedSequence('run',runId,version);
      check(Number.isSafeInteger(sequence)&&sequence>0,'BLIND_PROTOCOL','Run history has no committed order');
      if(sequence<before)return store.get('run',runId,version);
    }
    return null;
  };
  const observed=runBefore(review.data.reviewerRunId),producer=runBefore(original.payload.producerRunId);
  const run=observed?.data,originalRun=producer?.data;
  const originalCreated=registry.committedSequence('artifact',original.id,1);
  check(run?.mode==='reviewer'&&run.missionId===missionId&&original.missionId===missionId
    &&run.context.artifactIds.includes(original.id)&&run.context.artifactIds.includes(artifact.id)
    &&run.context.producerConversationIncluded===false&&originalRun&&originalCreated>0&&originalCreated<before
    &&store.get('artifact',original.id,1)?.data.payloadHash===original.payloadHash,
    'BLIND_PROTOCOL','The approving reviewer must have observed the exact existing target before acceptance');
  registry.requireCompletedExposure(run);
  const threads=new Set([originalRun.providerThreadId,...(originalRun.inferenceReceipts??[]).map(r=>r.threadId)]);
  check(run.id!==original.payload.producerRunId&&!threads.has(run.providerThreadId)
    &&!(run.inferenceReceipts??[]).some(r=>threads.has(r.threadId)),
    'BLIND_PROTOCOL','The approving reviewer must be independent of the original producer at acceptance');
  return {review:ref(review),reviewer:ref(observed),originalProducer:ref(producer),sequence:before};
}

// PRIVATE until the original has been opened. Called only by the post-opening
// comparison evidence builder, never by the replica/material evidence builder.
export function openedProtocolApproval(registry,registration,registered,original,replicaRequestSequence){
  const {store}=registry,p=registered.protocolRef;
  const protocol=store.get(p.type,p.id,p.version),artifact=protocol?.data;
  check(p.type==='artifact'&&protocol?.hash===p.hash&&artifact.status==='ACCEPTED'
    &&artifact.payload.purpose==='blind-protocol'&&artifact.payloadHash===sha256(artifact.payload)
    &&artifact.missionId===original.missionId,'BLIND_COMPARISON','Frozen accepted protocol reference differs');
  const approval=historicalBlindApproval(registry,artifact,original);
  check(canonical(approval)===canonical(registered.approval),'BLIND_COMPARISON','Frozen protocol approval differs from historical exposure');
  const sequence=r=>{const n=registry.committedSequence(r.type,r.id,r.version);
    check(Number.isSafeInteger(n)&&n>0,'BLIND_COMPARISON','Protocol approval provenance lacks committed order');return n;};
  const chronology={original:sequence({type:'artifact',id:original.id,version:1}),reviewer:sequence(approval.reviewer),
    review:sequence(approval.review),protocol:sequence(protocol),registration:sequence(registration),replicaRequest:replicaRequestSequence};
  check(chronology.original<chronology.reviewer&&chronology.reviewer<chronology.review
    &&chronology.review<chronology.protocol&&chronology.protocol<chronology.registration
    &&chronology.registration<chronology.replicaRequest,'BLIND_COMPARISON','Protocol review must precede acceptance, freeze and replica request');
  return {registration:ref(registration),protocol:ref(protocol),approval,chronology,
    reviewResult:clone(store.get('review',approval.review.id,approval.review.version).data.result),
    observedTargets:[{id:artifact.id,hash:artifact.payloadHash},{id:original.id,hash:original.payloadHash}],
    scope:'Exact historical completed reviewer exposure to protocol and original before approval, freeze and replica request. Exposed only after opening; no private conversation, backdated approval, cognitive independence or semantic certification.'};
}
