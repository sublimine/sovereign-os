import {check,safeCode,sha256} from './contracts.mjs';
import {blindStage,createBlindPlanBinding} from './blind-plan.mjs';

/** The producer identities remain the real replica/oracle identities. Each
 * material barrier is committed to PlanLedger before its consumer is ready. */
export async function processPlannedBlindNode(engine,mission,node,signal){
  const {store,registry,ledger,blind}=engine,stage=blindStage(node.spec);
  check(stage&&blind,'CAPABILITY','The closed planned adapter is unavailable');
  check(!signal?.aborted,'CANCELLED','Closed node cancelled before entry');
  const plan=store.get('plan',mission.id).data;
  registry.assertUsable(plan.acceptedPlanArtifactId,{missionId:mission.id,purpose:'plan'});
  for(const dependency of node.spec.dependencies){
    const parent=store.get('node',`${mission.id}:${dependency.nodeId}`)?.data;
    check(parent?.status==='ACCEPTED','NODE_DEPENDENCY','Closed stage needs an accepted prerequisite');ledger.assertProduct(parent);
  }
  let replicationId,runId,artifactId=null;
  if(stage==='material'){
    const parent=store.get('node',`${mission.id}:${node.spec.execution.protocolNodeId}`).data;
    const binding=createBlindPlanBinding(registry,mission.id,node.nodeId,parent.artifactId);
    replicationId='planned-blind:'+sha256([mission.id,binding.planHash,node.nodeId]);
    const frozen=blind.freeze({replicationId,missionId:mission.id,protocolArtifactId:parent.artifactId,materialNodeId:node.nodeId,
      reviewers:{material:binding.material.reviewerRoleIds,comparison:binding.comparison.reviewerRoleIds}});
    runId=frozen.runId;
  }else{
    const parent=store.get('node',`${mission.id}:${node.spec.execution.materialNodeId}`).data;
    replicationId=JSON.parse(store.get('artifact',parent.artifactId).data.payload.body).replicationId;
    check(blind.status(replicationId).state!=='INCONCLUSIVE','REPLICA_INCONCLUSIVE',
      'The completed UNKNOWN attempt has independent assessment but no result. Preserve its judgment, controls and diagnosis; do not open, compare or automatically resample.');
    const report=blind.compare(replicationId);runId=report.payload.producerRunId;artifactId=report.id;
  }
  check(!signal?.aborted,'CANCELLED','Closed node cancelled before claim');
  const ownership=ledger.claim(mission.id,node.nodeId,{runId,ttlMs:3600000});
  engine.emit('node.closed.started',{missionId:mission.id,nodeId:node.nodeId,runId,replicationId,stage,attempt:ownership.attempt});
  const controller=new AbortController(),abort=()=>controller.abort();signal?.addEventListener('abort',abort,{once:true});if(signal?.aborted)abort();
  let leaseFailure=null;
  const renewal=setInterval(()=>{try{ledger.renew(mission.id,node.nodeId,{runId,fence:ownership.fence,ttlMs:3600000});}
    catch(error){leaseFailure=error;controller.abort();}},60000);renewal.unref();
  try{
    const result=await blind.runReviewed(replicationId,{workers:engine.workers,signal:controller.signal,through:stage});
    check(!controller.signal.aborted,'CANCELLED','Closed node cancelled at ledger barrier');
    artifactId=stage==='material'?result.materialArtifactId:result.comparisonArtifactId;
    check(artifactId,'NEEDS_DIRECTION',`Closed ${stage} unresolved: ${result.status}; no automatic replacement replica`);
    const artifact=store.get('artifact',artifactId).data;
    ledger.transition(mission.id,node.nodeId,{runId,fence:ownership.fence,status:'REVIEW_PENDING',artifactId});
    const accepted=artifact.status==='ACCEPTED';
    const review=store.get('review',artifact.reviews.at(-1))?.data;
    check(review&&['ACCEPTED','RETURNED'].includes(artifact.status),'NEEDS_DIRECTION','Closed stage lacks a committed decision');
    ledger.transition(mission.id,node.nodeId,{runId,fence:ownership.fence,status:accepted?'ACCEPTED':'RETURNED',artifactId,
      detail:{reviewId:review.id,replicationId,stage,findings:review.result.findings,unmet:review.result.checks.filter(c=>c.verdict!=='PASS')}});
    engine.emit(accepted?'node.accepted':'node.returned',{missionId:mission.id,nodeId:node.nodeId,artifactId,replicationId,stage});
    check(accepted,'NEEDS_DIRECTION','Closed material rejection retained. A new method requires an explicit prospective recovery contract and independent acceptance; a replacement plan or another vote alone cannot authorize another replica.');
  }catch(error){
    error=leaseFailure??error;
    try{ledger.transition(mission.id,node.nodeId,{runId,fence:ownership.fence,status:'RETURNED',artifactId,detail:{code:safeCode(error),reason:error.message,replicationId,stage}});}
    catch(transitionError){if(!['STALE_WORKER','NODE_TRANSITION'].includes(transitionError.code))throw transitionError;}
    throw error;
  }finally{clearInterval(renewal);signal?.removeEventListener('abort',abort);}
}
