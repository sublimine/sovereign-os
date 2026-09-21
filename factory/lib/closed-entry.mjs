import {canonical,check,clone,sha256} from './contracts.mjs';
import {CLOSED_ENTRY_MODE,CLOSED_ENTRY_V2,CLOSED_ENTRY_NODE,PURPOSE,ROLES,REVIEWERS,INSTRUCTIONS,CLOSED_ENTRY_CRITERIA,CLOSED_ENTRY_SCHEMA,entryContractHash} from './closed-entry-spec.mjs';
import {makeClosedResponseBinding} from './closed-response-contract.mjs';
import {CLOSED_ENTRY_RESPONSE_RETENTION,readClosedEntryResponse,validateClosedEntryResponse as validate} from './closed-entry-response.mjs';
export {CLOSED_ENTRY_MODE,CLOSED_ENTRY_V2,CLOSED_ENTRY_NODE,CLOSED_ENTRY_CRITERIA,CLOSED_ENTRY_SCHEMA} from './closed-entry-spec.mjs';
const recoverableOutput=new Set(['SCHEMA','OUTPUT_LIMIT','REVIEW_ENCODING','REVIEW_EVIDENCE','REVIEW_COVERAGE','REVIEW_SCOPE','SOURCE_SUPPORT','UNOBSERVED_TOOL','UNOBSERVED_SOURCE','UNOBSERVED_RUNTIME']);

/** Optional entry, under the engine's existing exclusive owner. No broker calls.
 * This is NOT a synthetic accepted plan. Failure moves once to the ordinary
 * planner; its context never receives the unaccepted answer or routing reason.
 */
export async function runClosedEntry(engine,mission,signal){
  if(![CLOSED_ENTRY_MODE,CLOSED_ENTRY_V2].includes(mission.policy.entryMode))return null;
  const version=mission.policy.entryMode,roleIds=version===CLOSED_ENTRY_V2?[]:ROLES;
  const contractHash=()=>entryContractHash(version);
  const actorScope=version===CLOSED_ENTRY_V2?{controllerContract:'closed-response-production-v1'}:{};
  const {store,registry,workers}=engine;
  let progress=store.get('closed-entry',mission.id);
  if(progress)check(progress.data.intentHash===mission.intentHash&&progress.data.policyHash===sha256(mission.policy)
    &&progress.data.contractHash===contractHash(),'ENTRY_DRIFT','Direct entry is bound to its exact mandate, policy and pre-response acceptance contract');
  if(progress?.data.status==='FALLBACK')return null;
  // Existing planned/effectful work never gets retroactively shortened.
  if(store.get('plan',mission.id)||store.list('node').some(r=>r.data.missionId===mission.id)
    ||store.list('effect').some(r=>r.data.missionId===mission.id)){
    check(!progress,'ENTRY_CONFLICT','Active direct response conflicts with prior planned or effectful work');return null;
  }
  const save=changes=>{progress=store.put('closed-entry',mission.id,{...progress.data,...clone(changes)},{expectedVersion:progress.version});};
  const fallback=(code,detail={})=>{
    save({status:'FALLBACK',disposition:{code,...detail},completedAt:engine.clock()});
    engine.emit('entry.fallback',{missionId:mission.id,code,...detail,scope:'Unchanged request to full planner; rejected answer and routing reason are NOT admitted as planning inputs.'});return null;
  };
  check(!signal?.aborted,'CANCELLED','Closed entry cancelled');
  if(!progress)store.transact(()=>{
    if(version===CLOSED_ENTRY_V2)store.put('closed-entry-contract',mission.id,makeClosedResponseBinding(mission),{expectedVersion:0});
    const run=workers.createRun({missionId:mission.id,nodeId:CLOSED_ENTRY_NODE,mode:'producer',purpose:PURPOSE,roleIds,...actorScope});
    progress=store.put('closed-entry',mission.id,{version,missionId:mission.id,intentHash:mission.intentHash,
      policyHash:sha256(mission.policy),contractHash:contractHash(),status:'PRODUCING',runId:run.id,productionAttempts:1,
      roleIds,reviewerRoleIds:REVIEWERS,criteria:CLOSED_ENTRY_CRITERIA,response:null,artifactId:null,createdAt:engine.clock(),
      responseRetention:CLOSED_ENTRY_RESPONSE_RETENTION,...actorScope}, {expectedVersion:0});
    engine.emit('entry.started',{missionId:mission.id,runId:run.id,version,contractHash:contractHash()});
  });
  const durable=store.get('closed-entry',mission.id,1)?.data.responseRetention===CLOSED_ENTRY_RESPONSE_RETENTION;
  const retained=durable?readClosedEntryResponse(registry,progress.data.runId):null;
  if(retained&&!progress.data.response){
    save({response:retained.value,responseHash:sha256(retained.value),inferenceReceiptHash:sha256(retained.receipt),responseRecord:retained.responseRecord});
    engine.emit('entry.response.recovered',{missionId:mission.id,runId:progress.data.runId,responseRecord:retained.responseRecord,
      scope:'Original public response restored after confirmed provider cleanup, without inference or acceptance.'});
  }
  if(!progress.data.response){
    const oldRun=workers.run(progress.data.runId);
    if(oldRun.requests?.length){
      // The original call may have completed before its output checkpoint. A
      // fresh pure inference is allowed on resume, never called exactly-once.
      // Quota/cancellation resumes do not recycle a thread or erase its usage.
      store.transact(()=>{
        const run=workers.createRun({missionId:mission.id,nodeId:CLOSED_ENTRY_NODE,mode:'producer',purpose:PURPOSE,roleIds,...actorScope});
        save({runId:run.id,productionAttempts:progress.data.productionAttempts+1});
        engine.emit('entry.inference.recovered',{missionId:mission.id,previousRunId:oldRun.id,runId:run.id,
          previousCompletedReceipts:oldRun.inferenceReceipts?.length??0,scope:'No output checkpoint; pure inference can repeat, original usage/uncertainty preserved.'});
      });
    }
    engine.setStatus(mission.id,'RUNNING');
    try{
      const {value}=await workers.infer({runId:progress.data.runId,instructions:INSTRUCTIONS,
        input:JSON.stringify({originalRequest:mission.intent,acceptanceCriteria:CLOSED_ENTRY_CRITERIA,entryMode:version,tools:[]}),
        schema:CLOSED_ENTRY_SCHEMA,validate,signal,retention:durable?CLOSED_ENTRY_RESPONSE_RETENTION:null});
      const run=workers.run(progress.data.runId);
      const stored=durable?readClosedEntryResponse(registry,progress.data.runId):null;
      check(!durable||stored&&canonical(stored.value)===canonical(value),'ENTRY_RESPONSE_INTEGRITY','Entry result differs from its committed response');
      save({response:clone(value),responseHash:sha256(value),inferenceReceiptHash:sha256(run.inferenceReceipt),...(stored?{responseRecord:stored.responseRecord}:{})});
    }catch(error){
      if(recoverableOutput.has(error.code))return fallback(error.code,{phase:'entry-production'});
      throw error;
    }
  }
  const response=progress.data.response,producer=workers.run(progress.data.runId);
  if(durable){const stored=readClosedEntryResponse(registry,producer.id);
    check(stored&&canonical(stored.value)===canonical(response)&&canonical(stored.responseRecord)===canonical(progress.data.responseRecord),
      'ENTRY_RESPONSE_INTEGRITY','Entry checkpoint differs from the original retained public response');}
  validate(response);
  check(sha256(response)===progress.data.responseHash&&sha256(producer.inferenceReceipt)===progress.data.inferenceReceiptHash,
    'ENTRY_DRIFT','Direct response checkpoint differs from its completed inference');
  if(response.action==='plan')return fallback('PLANNING_REQUIRED');
  let artifact;
  if(!progress.data.artifactId)store.transact(()=>{
    artifact=registry.create({missionId:mission.id,nodeId:CLOSED_ENTRY_NODE,producerRunId:producer.id,
      kind:'closed-response',purpose:PURPOSE,body:response.body,claims:[],inputRefs:[],toolReceipts:[],requiredEffects:[],criteria:CLOSED_ENTRY_CRITERIA});
    save({status:'REVIEW_PENDING',artifactId:artifact.id,artifactHash:artifact.payloadHash});
  });
  artifact=store.get('artifact',progress.data.artifactId)?.data;
  check(artifact?.payloadHash===progress.data.artifactHash&&sha256(artifact.payload)===artifact.payloadHash
    &&artifact.payload.producerRunId===producer.id&&artifact.payload.body===response.body
    &&canonical(artifact.payload.criteria)===canonical(CLOSED_ENTRY_CRITERIA),'ENTRY_DRIFT','Direct candidate differs from its frozen response or criteria');
  if(['RETURNED','INVALIDATED'].includes(artifact.status))return fallback('DIRECT_NOT_ACCEPTED',{artifactId:artifact.id,status:artifact.status});
  try{
    const reviewed=artifact.status==='ACCEPTED'?registry.assertUsable(artifact.id,{missionId:mission.id,purpose:PURPOSE})
      :await workers.review({artifact,reviewerRoleIds:REVIEWERS,missionIntent:mission.intent,signal});
    if(reviewed.status!=='ACCEPTED')return fallback('DIRECT_NOT_ACCEPTED',{artifactId:artifact.id,reviewId:reviewed.reviews.at(-1)});
    check(!signal?.aborted,'CANCELLED','Closed entry cancelled before delivery');
    const review=store.get('review',reviewed.reviews.at(-1)).data;
    workers.verifyWorkspaceSnapshot(reviewed,{runId:review.reviewerRunId,signal});
    store.transact(()=>{
      registry.assertUsable(reviewed.id,{missionId:mission.id,purpose:PURPOSE});
      check(!store.list('effect').some(r=>r.data.missionId===mission.id),'ENTRY_EFFECT','Direct entry cannot certify any mission broker operation');
      const current=store.get('mission',mission.id);
      check(current.data.intentHash===mission.intentHash&&sha256(current.data.policy)===sha256(mission.policy),'ENTRY_DRIFT','Mission changed during direct execution');
      store.put('mission',mission.id,{...current.data,finalArtifactId:reviewed.id},{expectedVersion:current.version});
      save({status:'ACCEPTED',reviewId:review.id,completedAt:engine.clock()});
      engine.setStatus(mission.id,'COMPLETED');
      engine.emit('entry.accepted',{missionId:mission.id,artifactId:reviewed.id,reviewId:review.id,
        scope:'Closed response accepted without a generated plan; substantive independent review and frozen runtime controls retained.'});
    });
    return reviewed;
  }catch(error){
    if(recoverableOutput.has(error.code))return fallback(error.code,{phase:'entry-review',artifactId:artifact.id});
    throw error;
  }
}
