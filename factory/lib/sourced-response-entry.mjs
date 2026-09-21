import {canonical,check,clone,sha256} from './contracts.mjs';
import {SOURCED_RESPONSE_MODE,SOURCED_RESPONSE_CONTRACT,SOURCED_RESPONSE_NODE,SOURCED_RESPONSE_PURPOSE,SOURCED_RESPONSE_REVIEWERS,
  SOURCED_RESPONSE_DEFER_ONLY_FALLBACK,sourcedResponseDeferOnly,sourcedResponseNode,sourcedResponseContractHash} from './sourced-response-spec.mjs';
import {makeSourcedResponseBinding,assertSourcedResponseMission,assertSourcedResponseExposure,assertSourcedResponseCandidate} from './sourced-response-contract.mjs';
import {readVerifiedProducerProposal} from './producer-response.mjs';

const fallbackCodes=new Set(['SOURCED_RESPONSE_SCOPE','CAPABILITY','SCHEMA','OUTPUT_LIMIT','CONTEXT_LIMIT','WORKER_LIMIT',
  'WORKER_REPEATED_FAILURE',
  'AUTHORITY_SCOPE','REVIEW_ENCODING','REVIEW_EVIDENCE','REVIEW_COVERAGE','REVIEW_SCOPE','SOURCE_SUPPORT',
  'SOURCED_REVIEW_COVERAGE','SOURCED_REVIEW_EVIDENCE','SOURCED_EVIDENCE_PROFILE_SEQUENCE','SOURCED_EVIDENCE_PROFILE_COVERAGE',
  'SOURCED_EVIDENCE_PROFILE_PRESENTATION',
  'UNOBSERVED_TOOL','UNOBSERVED_SOURCE','UNOBSERVED_RUNTIME','MISSING_INPUT_PROOF']);

/** Fixed source-acquisition charter, not a generated plan. Ordinary durable
 * production and independent raw-source review retain the engine's owner. */
export async function runSourcedResponseEntry(engine,mission,signal){
  if(!assertSourcedResponseMission(engine.store,mission))return null;
  const {store,registry,workers}=engine,node=sourcedResponseNode(mission),contractHash=sourcedResponseContractHash(mission),deferOnly=sourcedResponseDeferOnly(mission);
  let progress=store.get('sourced-response-entry',mission.id);
  if(progress){
    const origin=store.get('sourced-response-entry',mission.id,1)?.data;
    check(origin?.version===SOURCED_RESPONSE_MODE&&origin.intentHash===mission.intentHash&&origin.policyHash===sha256(mission.policy)
      &&origin.contractHash===contractHash&&progress.data.intentHash===origin.intentHash&&progress.data.policyHash===origin.policyHash
      &&progress.data.contractHash===contractHash&&progress.data.version===origin.version
      &&canonical(progress.data.criteria)===canonical(node.criteria)
      &&canonical(progress.data.reviewerRoleIds)===canonical(SOURCED_RESPONSE_REVIEWERS)
      &&progress.data.roleIds.length===0&&progress.data.controllerContract===SOURCED_RESPONSE_CONTRACT
      &&Array.isArray(progress.data.runIds)&&new Set(progress.data.runIds).size===progress.data.runIds.length
      &&progress.data.runIds[0]===origin.runId&&progress.data.runIds.at(-1)===progress.data.runId
      &&progress.data.productionAttempts===progress.data.runIds.length
      &&(deferOnly?progress.data.sourcedFallback===SOURCED_RESPONSE_DEFER_ONLY_FALLBACK:progress.data.sourcedFallback===undefined),
      'SOURCED_RESPONSE_BINDING','Entry mandate, policy, original charter or durable attempt history changed');
  }
  check(!signal?.aborted,'CANCELLED','Sourced entry cancelled');
  const save=changes=>{progress=store.put('sourced-response-entry',mission.id,{...progress.data,...clone(changes)},{expectedVersion:progress.version});};
  const deferred=()=>{
    // A defer-only entry never obtains a workspace at admission.  Reassert the
    // absence at the escalation boundary so a forged/historical plan cannot be
    // treated as an authorized continuation of this public-only route.
    check(!store.get('plan',mission.id)&&!store.list('node').some(r=>r.data.missionId===mission.id)
      &&!store.get('tool-workspace',mission.id),'SOURCED_RESPONSE_BINDING',
      'Defer-only sourced route cannot retain a plan, node or workspace');
    const pending=[{code:'SOURCED_ROUTE_ESCALATION_REQUIRED',reason:
      'The public sourced route did not close. Submit a distinct planned mission to consider project context, inputs or assets.'}];
    const current=store.get('mission',mission.id)?.data;
    if(current?.status!=='NEEDS_DIRECTION'||canonical(current.pending)!==canonical(pending))engine.setStatus(mission.id,'NEEDS_DIRECTION',pending);
    engine.emit('sourced-entry.deferred',{missionId:mission.id,code:'SOURCED_ROUTE_ESCALATION_REQUIRED',
      scope:'Public source route stopped without a generated plan, workspace, private project context, input, asset metadata or rejected candidate becoming a new premise.'});
    return {handled:true,kind:'sourced-route-deferred'};
  };
  if(progress?.data.status==='FALLBACK')return deferOnly?deferred():null;
  if(store.get('plan',mission.id)||store.list('node').some(r=>r.data.missionId===mission.id)){
    check(!progress,'SOURCED_RESPONSE_BINDING','Active entry conflicts with already planned work');return null;
  }
  const fallback=(code,detail={})=>{
    save({status:'FALLBACK',disposition:{code,...detail},completedAt:engine.clock()});
    if(deferOnly)return deferred();
    engine.emit('sourced-entry.fallback',{missionId:mission.id,code,...detail,
      scope:'Complete unchanged request to planning. No rejected candidate, producer conversation or routing reason admitted as planning premises; authentic operation history is retained.'});return null;
  };
  const createRun=()=>workers.createRun({missionId:mission.id,nodeId:SOURCED_RESPONSE_NODE,mode:'producer',purpose:SOURCED_RESPONSE_PURPOSE,
    roleIds:[],controllerContract:SOURCED_RESPONSE_CONTRACT});
  if(!progress)store.transact(()=>{
    check(!store.list('effect').some(r=>r.data.missionId===mission.id),'SOURCED_RESPONSE_BINDING','Entry cannot start after external operations');
    store.put('sourced-response-contract',mission.id,makeSourcedResponseBinding(mission),{expectedVersion:0});
    const run=createRun();
    progress=store.put('sourced-response-entry',mission.id,{version:SOURCED_RESPONSE_MODE,missionId:mission.id,
      intentHash:mission.intentHash,policyHash:sha256(mission.policy),contractHash,status:'PRODUCING',runId:run.id,runIds:[run.id],
      productionAttempts:1,roleIds:[],controllerContract:SOURCED_RESPONSE_CONTRACT,reviewerRoleIds:SOURCED_RESPONSE_REVIEWERS,
      criteria:node.criteria,artifactId:null,createdAt:engine.clock(),
      ...(deferOnly?{sourcedFallback:SOURCED_RESPONSE_DEFER_ONLY_FALLBACK}:{})},{expectedVersion:0});
    engine.emit('sourced-entry.started',{missionId:mission.id,runId:run.id,contractHash});
  });
  let artifact=progress.data.artifactId?store.get('artifact',progress.data.artifactId)?.data:null;
  check(!progress.data.artifactId||artifact,'SOURCED_RESPONSE_BINDING','Committed candidate is missing, not permission to regenerate');
  if(artifact&&['RETURNED','INVALIDATED'].includes(artifact.status))return fallback('DIRECT_NOT_ACCEPTED',{artifactId:artifact.id,status:artifact.status});
  if(!artifact){
    engine.setStatus(mission.id,'RUNNING');
    try{
      let run=workers.run(progress.data.runId),production=store.get('worker-production',run.id),recoveryFeedback=[];
      if(production){
        workers.assertProducerClosed(run.id);
        const latestComplete=!run.expectedRequestHash&&run.requests?.at(-1)?.requestHash===run.inferenceReceipt?.contextHash;
        let retained=latestComplete?readVerifiedProducerProposal(registry,run.id):null;
        if(retained?.value.action==='blocked')return fallback('CAPABILITY',{phase:'retained-production-handoff'});
        if(retained?.value.action==='final'&&workers.recoverableFinal({missionId:mission.id,node,runId:run.id,inputRefs:[]})){
          try{artifact=workers.recoverFinal({missionId:mission.id,node,runId:run.id,inputRefs:[],signal});}
          catch(error){
            // A retained final can fail a producer-side content/presentation
            // gate after an interruption. `recoverFinal` records an exact
            // REJECTED disposition for that immutable proposal. Treat only
            // that durable state as a request for a fresh producer: preserve
            // the original finite source packet and its receipts, but never
            // resurrect the rejected body or replay its inference.
            const dispositionRecord=store.get('producer-final-disposition',`${run.id}:proposal:${retained.step}`),
              disposition=dispositionRecord?.data;
            const rejected=dispositionRecord?.version===1&&disposition?.disposition==='REJECTED'
              &&disposition.runId===run.id&&disposition.step===retained.step
              &&disposition.valueHash===sha256(retained.value)&&disposition.code===error.code
              &&canonical(disposition.proposal)===canonical(retained.proposal);
            // Re-run the canonical reader as an integrity check. A matching
            // looking record is not enough to authorize a replacement if its
            // provenance/version was forged or it failed its own validation.
            if(!rejected||workers.recoverableFinal({missionId:mission.id,node,runId:run.id,inputRefs:[]})!==null)throw error;
            retained=null;
            recoveryFeedback=[{kind:'retained-final-rejection-v1',code:disposition.code,
              scope:'The previous producer body was rejected by the controller materialization gate. Produce a distinct corrected public answer from the inherited authenticated observations; do not repeat or quote the rejected body.'}];
            engine.emit('sourced-entry.producer.final-rejected',{missionId:mission.id,runId:run.id,
              proposalStep:disposition.step,code:disposition.code,
              scope:'A retained producer final failed its exact materialization gate. Its body stays rejected; a new producer may use inherited authenticated source observations only.'});
          }
        }
        if(!artifact&&(!retained||!workers.recoverableBatch({missionId:mission.id,node,runId:run.id,inputRefs:[]}))){
          // No eligible retained final/cursor: fresh inference under the same
          // charter, retaining old acquisition consumption and authenticated observations.
          // Unknown provider closure or uncertain effects already fail above.
          const previous=run.id;
          store.transact(()=>{
            check(progress.data.productionAttempts<mission.policy.maxNodeAttempts,'WORKER_LIMIT',
              'Frozen source-route producer-attempt ceiling reached; preserve the rejected answer and route for direction instead of spending another inference');
            run=createRun();save({runId:run.id,runIds:[...progress.data.runIds,run.id],productionAttempts:progress.data.productionAttempts+1});
            workers.inheritProductionObservations(previous,run.id);
            engine.emit('sourced-entry.producer.recovered',{missionId:mission.id,previousRunId:previous,runId:run.id,
              scope:'Fresh inference may repeat, not exactly once. Original usage and acquisition intents retained; no conversation or accepted product transferred.'});
          });
        }
      }
      artifact??=await workers.produce({missionId:mission.id,node,runId:run.id,inputRefs:[],feedback:recoveryFeedback,signal});
      save({status:'REVIEW_PENDING',artifactId:artifact.id,artifactHash:artifact.payloadHash});
    }catch(error){if(fallbackCodes.has(error.code))return fallback(error.code,{phase:'production'});throw error;}
  }
  const producer=workers.run(progress.data.runId);
  assertSourcedResponseExposure(store,producer);
  assertSourcedResponseCandidate(store,producer,artifact.payload);
  check(artifact.payloadHash===progress.data.artifactHash&&sha256(artifact.payload)===artifact.payloadHash
    &&artifact.payload.producerRunId===producer.id,'SOURCED_RESPONSE_BINDING','Candidate differs from its durable entry binding');
  try{
    const reviewed=artifact.status==='ACCEPTED'?registry.assertUsable(artifact.id,{missionId:mission.id,purpose:SOURCED_RESPONSE_PURPOSE})
      :await workers.review({artifact,reviewerRoleIds:SOURCED_RESPONSE_REVIEWERS,missionIntent:mission.intent,signal});
    if(reviewed.status!=='ACCEPTED')return fallback('DIRECT_NOT_ACCEPTED',{artifactId:artifact.id,reviewId:reviewed.reviews.at(-1)});
    check(!signal?.aborted,'CANCELLED','Sourced entry cancelled before delivery');
    const review=store.get('review',reviewed.reviews.at(-1)).data;
    workers.verifyWorkspaceSnapshot(reviewed,{runId:review.reviewerRunId,signal});
    store.transact(()=>{
      registry.assertUsable(reviewed.id,{missionId:mission.id,purpose:SOURCED_RESPONSE_PURPOSE});
      const current=store.get('mission',mission.id);
      check(current.data.intentHash===mission.intentHash&&canonical(current.data.policy)===canonical(mission.policy),
        'SOURCED_RESPONSE_BINDING','Mission changed before sourced delivery');
      check(store.list('effect').filter(r=>r.data.missionId===mission.id).every(r=>['source.search','source.fetch'].includes(r.data.tool)&&progress.data.runIds.includes(r.data.principalId)),
        'SOURCED_RESPONSE_BINDING','Sourced delivery cannot certify other mission operations');
      store.put('mission',mission.id,{...current.data,finalArtifactId:reviewed.id},{expectedVersion:current.version});
      save({status:'ACCEPTED',reviewId:review.id,completedAt:engine.clock()});engine.setStatus(mission.id,'COMPLETED');
      engine.emit('sourced-entry.accepted',{missionId:mission.id,artifactId:reviewed.id,reviewId:review.id,
        scope:'Complete public answer accepted without a generated plan, with independently reviewed eligibility and cited acquired source support.'});
    });
    return reviewed;
  }catch(error){if(fallbackCodes.has(error.code))return fallback(error.code,{phase:'review',artifactId:artifact.id});throw error;}
}
