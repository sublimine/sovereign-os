// A new review policy, not retroactive evidence for an old accepted review.
import {canonical,check,clone,sha256} from './contracts.mjs';
export const INPUT_FILE_REVIEW='input-file-review-v1';
const ref=r=>({type:r.type,id:r.id,version:r.version,hash:r.hash});
const integrity=(ok,message)=>check(ok,'INPUT_REVIEW_INTEGRITY',message);

/** Read the producer's actual admitted observations BEFORE candidate creation.
 * Later producer activity cannot rewrite the inputs of an earlier candidate.
 * Direct successful reads supersede external recovery hints for the same path;
 * conflicting direct versions are ambiguous, never silently "latest wins".
 */
export function candidateInputFiles(registry,artifact){
  const s=registry.store,original=s.get('artifact',artifact.id,1);
  integrity(original&&original.data.payloadHash===artifact.payloadHash&&sha256(artifact.payload)===artifact.payloadHash,
    'Input review requires the original immutable candidate');
  const cutoff=registry.committedSequence(original.type,original.id,1);
  integrity(Number.isSafeInteger(cutoff)&&cutoff>0,'Candidate creation is missing from the journal');
  let producer=s.get('run',artifact.payload.producerRunId);
  while(producer&&registry.committedSequence(producer.type,producer.id,producer.version)>=cutoff)
    producer=producer.version>1?s.get(producer.type,producer.id,producer.version-1):null;
  integrity(producer&&producer.data.missionId===artifact.missionId
    &&['producer','replicator'].includes(producer.data.mode)&&producer.data.nodeId===artifact.payload.nodeId,
    'Original pre-candidate producer snapshot is missing or has changed identity');
  const producerSequence=registry.committedSequence(producer.type,producer.id,producer.version);
  integrity(Number.isSafeInteger(producerSequence)&&producerSequence>0&&producerSequence<cutoff,'Producer snapshot is not before the candidate');
  const written=new Set(artifact.payload.toolReceipts.map(r=>registry.verifiedToolReceipt(r))
    .filter(r=>r.tool==='workspace.write'&&r.status==='SUCCEEDED').map(r=>r.result.path));
  const byPath=new Map();
  for(const observed of producer.data.toolObservations??[]){
    const receipt=registry.verifiedToolReceipt(observed.signedReceipt);
    integrity(observed.id===receipt.id&&observed.hash===sha256(observed.signedReceipt)
      &&observed.principalId===receipt.principalId&&observed.resultText===canonical(receipt.result)
      &&receipt.missionId===artifact.missionId,'Producer input observation changed');
    if(receipt.tool!=='workspace.read'||receipt.status!=='SUCCEEDED'||written.has(receipt.result.path))continue;
    integrity(typeof receipt.result.content==='string'&&sha256(receipt.result.content)===receipt.result.sha256,
      'A file input must contain its complete authenticated bytes');
    const effect=s.get('effect',receipt.id);
    const sequence=registry.committedSequence(effect.type,effect.id,effect.version);
    integrity(Number.isSafeInteger(sequence)&&sequence>0&&sequence<producerSequence,'Input operation is not prior to its producer observation');
    const path=receipt.result.path,entries=byPath.get(path)??[];
    entries.push({id:receipt.id,hash:observed.hash,sha256:receipt.result.sha256,principalId:receipt.principalId});byPath.set(path,entries);
  }
  const inputs=[...byPath].sort(([a],[b])=>a.localeCompare(b)).map(([path,observations])=>{
    const own=observations.filter(o=>o.principalId===producer.id),selected=own.length?own:observations;
    check(new Set(selected.map(o=>o.sha256)).size===1,'INPUT_REVIEW_AMBIGUOUS',
      'The candidate observed conflicting versions of a read-only input; an explicit version disposition is required');
    return {path,sha256:selected[0].sha256,observations:selected.sort((a,b)=>a.id.localeCompare(b.id))};
  });
  return {schema:INPUT_FILE_REVIEW,artifact:ref(original),artifactHash:artifact.payloadHash,producerSnapshot:ref(producer),inputs};
}

/** Original reviewer identity opts in; old historical judgments stay unchanged. */
export function inputFileReviewContract(registry,run,artifact){
  integrity(run&&typeof run.id==='string','An actual reviewer is required');
  const original=registry.store.get('run',run.id,1)?.data;
  integrity(original&&original.mode==='reviewer'&&run.mode==='reviewer','An actual reviewer origin is required');
  integrity(run.inputReviewProtocol===original.inputReviewProtocol,'Reviewer input policy was removed or changed');
  if(original.inputReviewProtocol===undefined)return null;
  // Protocol 12 adds learning-provenance custody; it does not alter this
  // already-bound reviewer identity or its input-byte verification semantics.
  integrity(original.inputReviewProtocol===INPUT_FILE_REVIEW
    &&[5,6,7,8,9,10,11,12,13,14,15,16,17].includes(registry.store.db.prepare('PRAGMA user_version').get().user_version),'Unsupported or downgraded input review protocol');
  integrity(run.missionId===artifact.missionId&&run.context.artifactIds.includes(artifact.id),'Input contract is outside reviewer exposure');
  return candidateInputFiles(registry,artifact);
}

export function verifyInputFileRead(registry,receipt,artifact,run){
  const contract=inputFileReviewContract(registry,run,artifact),input=contract?.inputs.find(i=>i.path===receipt.result.path);
  if(!input)return;
  registry.verifyAfterCandidate(receipt,artifact,run);
  check(receipt.tool==='workspace.read'&&receipt.status==='SUCCEEDED'&&receipt.result.sha256===input.sha256
    &&typeof receipt.result.content==='string'&&sha256(receipt.result.content)===input.sha256,
    'WORKSPACE_CHANGED','Independent input bytes differ from the candidate original version');
}

export function verifyInputFileProofs(registry,artifact,run,result){
  const contract=inputFileReviewContract(registry,run,artifact);
  if(!contract?.inputs.length)return;
  const cited=result.checks.flatMap(c=>c.evidence).filter(e=>e.kind==='tool').map(e=>registry.toolReference(e,run));
  for(const input of contract.inputs){
    const read=cited.find(r=>r.tool==='workspace.read'&&r.status==='SUCCEEDED'&&r.principalId===run.id&&r.result.path===input.path);
    check(read,'MISSING_INPUT_PROOF','Acceptance requires a cited own post-candidate read of every original file input');
    verifyInputFileRead(registry,read,artifact,run);
  }
  return clone(contract);
}
