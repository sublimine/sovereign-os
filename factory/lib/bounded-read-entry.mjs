import {canonical,check,clone,sha256} from './contracts.mjs';
import {BOUNDED_READ_MODE,BOUNDED_READ_CONTRACT,BOUNDED_READ_NODE,BOUNDED_READ_PURPOSE,BOUNDED_READ_REVIEWERS,
  BOUNDED_READ_CRITERIA,boundedReadNode,boundedReadContractHash} from './bounded-read-spec.mjs';
import {makeBoundedReadBinding,assertBoundedReadMission,assertBoundedReadExposure,assertBoundedReadCandidate} from './bounded-read-contract.mjs';
import {readVerifiedProducerProposal} from './producer-response.mjs';
import {nativeReadActor,nativeReadRecovery} from './native-read-session.mjs';

const fallbackCodes=new Set(['BOUNDED_READ_SCOPE','CAPABILITY','SCHEMA','OUTPUT_LIMIT','CONTEXT_LIMIT','WORKER_LIMIT',
  'AUTHORITY_SCOPE','REVIEW_ENCODING','REVIEW_EVIDENCE','REVIEW_COVERAGE','REVIEW_SCOPE','SOURCE_SUPPORT',
  'UNOBSERVED_TOOL','UNOBSERVED_SOURCE','UNOBSERVED_RUNTIME','MISSING_INPUT_PROOF']);

/** Fixed controller charter, NOT a synthetic plan. Ordinary durable production
 * and independent input-file review are reused under the engine's owner. */
export async function runBoundedReadEntry(engine,mission,signal){
  if(!assertBoundedReadMission(engine.store,mission))return null;
  const {store,registry,workers}=engine,node=boundedReadNode(mission),contractHash=boundedReadContractHash(mission);
  let progress=store.get('bounded-read-entry',mission.id);
  if(progress){
    const origin=store.get('bounded-read-entry',mission.id,1)?.data;
    check(origin?.version===BOUNDED_READ_MODE&&origin.intentHash===mission.intentHash&&origin.policyHash===sha256(mission.policy)
      &&origin.contractHash===contractHash&&progress.data.intentHash===origin.intentHash&&progress.data.policyHash===origin.policyHash
      &&progress.data.contractHash===contractHash&&progress.data.version===origin.version
      &&canonical(progress.data.criteria)===canonical(BOUNDED_READ_CRITERIA)
      &&canonical(progress.data.reviewerRoleIds)===canonical(BOUNDED_READ_REVIEWERS)
      &&progress.data.roleIds.length===0&&progress.data.controllerContract===BOUNDED_READ_CONTRACT
      &&Array.isArray(progress.data.runIds)&&new Set(progress.data.runIds).size===progress.data.runIds.length
      &&progress.data.runIds[0]===origin.runId&&progress.data.runIds.at(-1)===progress.data.runId
      &&progress.data.productionAttempts===progress.data.runIds.length,
      'BOUNDED_READ_BINDING','Entry mandate, policy, original charter or durable attempt history changed');
  }
  if(progress?.data.status==='FALLBACK')return null;
  check(!signal?.aborted,'CANCELLED','Bounded entry cancelled');
  if(store.get('plan',mission.id)||store.list('node').some(r=>r.data.missionId===mission.id)){
    check(!progress,'BOUNDED_READ_BINDING','Active entry conflicts with already planned work');return null;
  }
  const save=changes=>{progress=store.put('bounded-read-entry',mission.id,{...progress.data,...clone(changes)},{expectedVersion:progress.version});};
  const fallback=(code,detail={})=>{
    save({status:'FALLBACK',disposition:{code,...detail},completedAt:engine.clock()});
    engine.emit('bounded-entry.fallback',{missionId:mission.id,code,...detail,
      scope:'Complete unchanged request to planning. No rejected candidate, producer conversation or routing reason admitted as planning premises; authentic operation history is retained.'});return null;
  };
  const createRun=()=>workers.createRun({missionId:mission.id,nodeId:BOUNDED_READ_NODE,mode:'producer',purpose:BOUNDED_READ_PURPOSE,
    roleIds:[],controllerContract:BOUNDED_READ_CONTRACT});
  if(!progress)store.transact(()=>{
    check(!store.list('effect').some(r=>r.data.missionId===mission.id),'BOUNDED_READ_BINDING','Entry cannot start after external operations');
    store.put('bounded-read-contract',mission.id,makeBoundedReadBinding(mission),{expectedVersion:0});
    const run=createRun();
    progress=store.put('bounded-read-entry',mission.id,{version:BOUNDED_READ_MODE,missionId:mission.id,
      intentHash:mission.intentHash,policyHash:sha256(mission.policy),contractHash,status:'PRODUCING',runId:run.id,runIds:[run.id],
      productionAttempts:1,roleIds:[],controllerContract:BOUNDED_READ_CONTRACT,reviewerRoleIds:BOUNDED_READ_REVIEWERS,
      criteria:BOUNDED_READ_CRITERIA,artifactId:null,createdAt:engine.clock()},{expectedVersion:0});
    engine.emit('bounded-entry.started',{missionId:mission.id,runId:run.id,contractHash});
  });
  let artifact=progress.data.artifactId?store.get('artifact',progress.data.artifactId)?.data:null;
  check(!progress.data.artifactId||artifact,'BOUNDED_READ_BINDING','Committed candidate is missing, not permission to regenerate');
  if(artifact&&['RETURNED','INVALIDATED'].includes(artifact.status))return fallback('DIRECT_NOT_ACCEPTED',{artifactId:artifact.id,status:artifact.status});
  if(!artifact){
    engine.setStatus(mission.id,'RUNNING');
    try{
      let run=workers.run(progress.data.runId),production=store.get('worker-production',run.id);
      if(production){
        workers.assertProducerClosed(run.id);
        const latestComplete=!run.expectedRequestHash&&run.requests?.at(-1)?.requestHash===run.inferenceReceipt?.contextHash;
        const retained=latestComplete?readVerifiedProducerProposal(registry,run.id):null;
        if(nativeReadActor(store,run)){
          nativeReadRecovery(registry,run.id);
          check(retained,'NATIVE_READ_RECONCILE','Interrupted native turn has no retained exact proposal; no automatic new actor or inference');
        }
        if(retained?.value.action==='blocked')return fallback('CAPABILITY',{phase:'retained-production-handoff'});
        if(retained?.value.action==='final'&&workers.recoverableFinal({missionId:mission.id,node,runId:run.id,inputRefs:[]}))
          artifact=workers.recoverFinal({missionId:mission.id,node,runId:run.id,inputRefs:[],signal});
        else if(!retained||!workers.recoverableBatch({missionId:mission.id,node,runId:run.id,inputRefs:[]})){
          if(nativeReadActor(store,run))return fallback('DIRECT_NOT_ACCEPTED',{phase:'retained-native-final-not-usable'});
          // No eligible retained final/cursor: fresh inference under the same
          // charter, retaining old consumption and authenticated observations.
          // Unknown provider closure or uncertain effects already fail above.
          const previous=run.id;
          store.transact(()=>{
            run=createRun();save({runId:run.id,runIds:[...progress.data.runIds,run.id],productionAttempts:progress.data.productionAttempts+1});
            workers.inheritProductionObservations(previous,run.id);
            engine.emit('bounded-entry.producer.recovered',{missionId:mission.id,previousRunId:previous,runId:run.id,
              scope:'Fresh inference may repeat, not exactly once. Original usage and read intents retained; no conversation or accepted product transferred.'});
          });
        }
      }
      artifact??=await workers.produce({missionId:mission.id,node,runId:run.id,inputRefs:[],signal});
      save({status:'REVIEW_PENDING',artifactId:artifact.id,artifactHash:artifact.payloadHash});
    }catch(error){if(fallbackCodes.has(error.code))return fallback(error.code,{phase:'production'});throw error;}
  }
  const producer=workers.run(progress.data.runId);
  assertBoundedReadExposure(store,producer);
  assertBoundedReadCandidate(store,producer,artifact.payload);
  check(artifact.payloadHash===progress.data.artifactHash&&sha256(artifact.payload)===artifact.payloadHash
    &&artifact.payload.producerRunId===producer.id,'BOUNDED_READ_BINDING','Candidate differs from its durable entry binding');
  try{
    const reviewed=artifact.status==='ACCEPTED'?registry.assertUsable(artifact.id,{missionId:mission.id,purpose:BOUNDED_READ_PURPOSE})
      :await workers.review({artifact,reviewerRoleIds:BOUNDED_READ_REVIEWERS,missionIntent:mission.intent,signal});
    if(reviewed.status!=='ACCEPTED')return fallback('DIRECT_NOT_ACCEPTED',{artifactId:artifact.id,reviewId:reviewed.reviews.at(-1)});
    check(!signal?.aborted,'CANCELLED','Bounded entry cancelled before delivery');
    const review=store.get('review',reviewed.reviews.at(-1)).data;
    workers.verifyWorkspaceSnapshot(reviewed,{runId:review.reviewerRunId,signal});
    store.transact(()=>{
      registry.assertUsable(reviewed.id,{missionId:mission.id,purpose:BOUNDED_READ_PURPOSE});
      const current=store.get('mission',mission.id);
      check(current.data.intentHash===mission.intentHash&&canonical(current.data.policy)===canonical(mission.policy),
        'BOUNDED_READ_BINDING','Mission changed before bounded delivery');
      check(store.list('effect').filter(r=>r.data.missionId===mission.id).every(r=>r.data.tool==='workspace.read'),
        'BOUNDED_READ_BINDING','Bounded delivery cannot certify other mission operations');
      store.put('mission',mission.id,{...current.data,finalArtifactId:reviewed.id},{expectedVersion:current.version});
      save({status:'ACCEPTED',reviewId:review.id,completedAt:engine.clock()});engine.setStatus(mission.id,'COMPLETED');
      engine.emit('bounded-entry.accepted',{missionId:mission.id,artifactId:reviewed.id,reviewId:review.id,
        scope:'Complete closed response accepted without a generated plan, with independently reviewed eligibility, substance and post-candidate input version.'});
    });
    return reviewed;
  }catch(error){if(fallbackCodes.has(error.code))return fallback(error.code,{phase:'review',artifactId:artifact.id});throw error;}
}
