import {canonical,check,clone,id,integer,keys,list,safeCode,sha256,unique} from './contracts.mjs';
import {getRole} from '../catalog/index.mjs';
import {assertRoleExecution} from './role-execution.mjs';
import {captureProcessIdentity,ownerProcessIsAlive} from './process-identity.mjs';
import {blindRecordRef,BLIND_MATERIAL_PURPOSE} from './blind-material.mjs';
import {BLIND_COMPARISON_PURPOSE,validateComparisonRule} from './blind-comparison.mjs';
import {inferenceRequestHash} from '../providers/instruction-profiles.mjs';
import {compileLearningPrefix} from './learning-service.mjs';

export function frozenBlindWorkflow(reviewers,maxReviewAttempts=4,policy={}){
  keys(reviewers,['material','comparison']);
  for(const roleIds of Object.values(reviewers)){list(roleIds,'workflow reviewer roles',{min:1,max:30});unique(roleIds);assertRoleExecution(roleIds,'reviewer');}
  integer(maxReviewAttempts,'workflow review attempts',{min:1,max:100});
  const roleIds=[...new Set([...reviewers.material,...reviewers.comparison])].sort();
  const configuration={contextEncoding:policy.contextEncoding??'plain-json',reviewEncoding:policy.reviewEncoding??'expanded-json',
    instructionProfile:policy.instructionProfile??'model-default',cardEncoding:policy.cardEncoding??'pretty-json'};
  const stages=Object.fromEntries([['material',BLIND_MATERIAL_PURPOSE],['comparison',BLIND_COMPARISON_PURPOSE]].map(([stage,purpose])=>{
    const scope={roleIds:[...reviewers[stage]].sort(),purpose,mode:'reviewer',
      ...(configuration.contextEncoding!=='plain-json'?{contextEncoding:configuration.contextEncoding}:{}),
      ...(configuration.reviewEncoding!=='expanded-json'?{reviewEncoding:configuration.reviewEncoding}:{}),
      ...(configuration.instructionProfile!=='model-default'?{instructionProfile:configuration.instructionProfile}:{}),
      ...(configuration.cardEncoding!=='pretty-json'?{cardEncoding:configuration.cardEncoding}:{})};
    return [stage,{scope,prefixHash:sha256(compileLearningPrefix(scope))}];
  }));
  return {schema:'sovereign.closed-blind-workflow.v1',reviewers:clone(reviewers),maxReviewAttempts,
    cards:roleIds.map(id=>({id,hash:sha256(getRole(id))})),configuration,stages,
    scope:'One frozen replica, exact material and comparison candidates, independent reviews. Only explicit quota/transport review failures permit a bounded fresh review; uncertain review dispatch does not. Report acceptance is not mission or original-claim acceptance.'};
}
export function assertFrozenBlindWorkflow(workflow){
  check(workflow&&canonical(workflow)===canonical(frozenBlindWorkflow(workflow.reviewers,workflow.maxReviewAttempts,workflow.configuration)),
    'BLIND_WORKFLOW_DRIFT','Frozen reviewer cards, policy or workflow contract changed');
}

/** Trusted controller composition, deliberately not an ordinary producer or a
 * planner permission bypass. Durable barriers reuse the existing worker and
 * artifact services. No extra inference produces or restates the comparison.
 */
export async function runClosedBlindWorkflow(service,replicationId,{workers,signal,through='comparison'}={}){
  check(['material','comparison'].includes(through),'BLIND_WORKFLOW_SCOPE','Unknown requested barrier');
  const {store,registry,authority}=service;
  check(workers?.store===store&&workers.registry===registry&&workers.authority===authority&&typeof workers.review==='function',
    'BLIND_WORKFLOW_SCOPE','Reviews must use the same trusted store, registry and authority');
  check(!signal?.aborted,'CANCELLED','Workflow cancelled before entry');
  const registration=service.registration(replicationId),contract=registration.data.workflow;
  assertFrozenBlindWorkflow(contract);validateComparisonRule(service.current(registration.data).protocol.public.comparison);
  const ownerId=id('blind-workflow-owner');let progress;
  store.transact(()=>{
    const previous=store.get('blind-workflow',replicationId);
    if(previous){
      check(previous.data.registrationHash===registration.record.hash&&previous.data.contractHash===sha256(contract),
        'BLIND_WORKFLOW_DRIFT','Workflow belongs to another frozen registration');
      check(!previous.data.owner?.ownerId||!ownerProcessIsAlive(previous.data.owner),'BLIND_WORKFLOW_BUSY','A live or unverified owner already coordinates this workflow');
    }
    const owner={ownerId,pid:process.pid,processIdentity:captureProcessIdentity(process.pid)};
    progress=store.put('blind-workflow',replicationId,{...(previous?.data??{replicationId,registrationHash:registration.record.hash,
      contractHash:sha256(contract),status:'READY',material:null,comparison:null}),owner},{expectedVersion:previous?.version??0});
    store.append('blind.workflow.entered',{replicationId,ownerId,previousOwnerId:previous?.data.owner?.ownerId??null});
  });
  const save=changes=>{
    const current=store.get('blind-workflow',replicationId);
    check(current?.data.owner?.ownerId===ownerId,'BLIND_WORKFLOW_OWNER','Workflow ownership changed; late caller cannot advance');
    progress=store.put('blind-workflow',replicationId,{...current.data,...clone(changes)},{expectedVersion:current.version});
  };
  const outcome=()=>({replicationId,status:progress.data.status,
    materialArtifactId:progress.data.material?.artifactId??null,comparisonArtifactId:progress.data.comparison?.artifactId??null,
    pending:clone(progress.data.pending??[]),scope:contract.scope});
  const finish=(status,pending=[])=>{save({status,pending});return outcome();};
  const sameRegistration=()=>{
    const now=service.registration(replicationId);
    check(now.record.hash===registration.record.hash,'BLIND_WORKFLOW_DRIFT','Frozen registration changed while coordinating');
    service.current(now.data);assertFrozenBlindWorkflow(now.data.workflow);
    check(!signal?.aborted,'CANCELLED','Workflow cancelled at a material barrier');
  };
  const reviewProof=(artifact,stage)=>{
    const review=store.get('review',artifact.reviews.at(-1));
    check(review?.version===1&&review.data.artifactId===artifact.id&&review.data.result.artifactHash===artifact.payloadHash,
      'BLIND_WORKFLOW_REVIEW','Exact immutable review required at this barrier');
    const config=store.get('worker-config',review.data.reviewerRunId);
    check(config?.version===1&&canonical(config.data.roleIds)===canonical(contract.reviewers[stage])
      &&config.data.prefixHash===contract.stages[stage].prefixHash
      &&canonical(config.data.compilationScope)===canonical(contract.stages[stage].scope)
      &&Array.isArray(config.data.learnedInstructionVersions)&&config.data.learnedInstructionVersions.length===0,
      'BLIND_WORKFLOW_REVIEW','Accepted review does not use the preregistered stage roles');
    const sequence=registry.committedSequence('review',review.id,1);
    check(Number.isSafeInteger(sequence)&&sequence>0,'BLIND_WORKFLOW_REVIEW','Review has no committed order');
    let actor=store.get('run',review.data.reviewerRunId);
    while(actor){
      const prior=registry.committedSequence('run',actor.id,actor.version);
      check(Number.isSafeInteger(prior)&&prior>0,'BLIND_WORKFLOW_REVIEW','Reviewer history lacks committed order');
      if(prior<sequence)break;
      actor=actor.version>1?store.get('run',actor.id,actor.version-1):null;
    }
    check(actor?.data.mode==='reviewer'&&actor.data.missionId===artifact.missionId&&actor.data.context.artifactIds.includes(artifact.id),
      'BLIND_WORKFLOW_REVIEW','Reviewer did not observe this candidate before its decision');
    registry.requireCompletedExposure(actor.data);
    const configSequence=registry.committedSequence('worker-config',config.id,1),actorSequence=registry.committedSequence('run',actor.id,actor.version);
    const requestHash=actor.data.inferenceReceipt?.contextHash;
    const requestRecord=typeof requestHash==='string'?store.get('inference-request','inference-request:'+sha256([actor.id,requestHash])):null;
    check(requestRecord?.version===1&&requestRecord.data.retention==='BEFORE_DISPATCH'&&requestRecord.data.runId===actor.id
      &&requestRecord.data.missionId===artifact.missionId&&requestRecord.data.requestHash===requestHash
      &&actor.data.requests?.some(q=>q.requestHash===requestHash),'BLIND_WORKFLOW_REVIEW','Actual approving request was not retained before dispatch');
    const requestSequence=registry.committedSequence('inference-request',requestRecord.id,1);
    check(Number.isSafeInteger(configSequence)&&configSequence>0&&Number.isSafeInteger(requestSequence)&&requestSequence>configSequence
      &&requestSequence<actorSequence&&actorSequence<sequence,'BLIND_WORKFLOW_REVIEW','Reviewer configuration/request cannot be added after approval');
    let request;try{request=JSON.parse(requestRecord.data.requestJson);}catch{}
    const target=JSON.parse(registration.data.requestJson);
    check(request&&inferenceRequestHash(request)===requestHash&&typeof config.data.instructions==='string'
      &&config.data.instructions.length>0&&config.data.prefixHash===sha256(config.data.instructions)
      &&request.instructions.startsWith(config.data.instructions)&&actor.data.context.instructionsHash===sha256(request.instructions)
      &&request.model===target.model&&request.reasoningEffort===target.reasoningEffort,
      'BLIND_WORKFLOW_REVIEW','Approving request does not bind the frozen role prefix, exposure, model and effort');
    return {review:blindRecordRef(review),reviewer:blindRecordRef(actor),config:blindRecordRef(config),request:blindRecordRef(requestRecord)};
  };
  const assess=async(stage,candidate)=>{
    sameRegistration();
    let prior=progress.data[stage],artifact=store.get('artifact',candidate.id)?.data;
    check(artifact?.payloadHash===candidate.payloadHash,'BLIND_WORKFLOW_DRIFT','Stage candidate changed');
    if(prior)check(prior.artifactId===artifact.id&&prior.artifactHash===artifact.payloadHash,'BLIND_WORKFLOW_DRIFT','Stage cannot substitute another candidate');
    const decided=()=>{
      if(artifact.status==='ACCEPTED')registry.assertUsable(artifact.id,{missionId:artifact.missionId,purpose:artifact.payload.purpose});
      else check(artifact.status==='RETURNED','BLIND_WORKFLOW_REVIEW','Stage has no usable material decision');
      const proof=reviewProof(artifact,stage);
      if(prior?.proof)check(canonical(prior.proof)===canonical(proof),'BLIND_WORKFLOW_DRIFT','Committed stage decision changed');
      save({[stage]:{...prior,artifactId:artifact.id,artifactHash:artifact.payloadHash,state:'DECIDED',decision:artifact.status,proof,
        attemptsHistory:(prior?.attemptsHistory??[]).map(h=>h.attempt===prior.attempts?{...h,state:'DECIDED',decision:artifact.status,reviewId:proof.review.id}:h)}});
      return artifact.status==='ACCEPTED';
    };
    // Close the crash window after registry.review commits but before the phase
    // checkpoint. A valid committed judgment is reused, not a second LLM vote.
    if(['ACCEPTED','RETURNED'].includes(artifact.status))return decided();
    check(artifact.status==='CANDIDATE','BLIND_WORKFLOW_REVIEW','Revoked stage cannot be reviewed as a fresh candidate');
    check(!prior||prior.state==='RETRYABLE','BLIND_REVIEW_UNCERTAIN','A dispatched review without a committed decision needs reconciliation, not another vote');
    const attempts=prior?.attempts??0;
    check(attempts<contract.maxReviewAttempts,'BLIND_REVIEW_BUDGET','Frozen review retry budget exhausted');
    save({status:stage==='material'?'REVIEWING_MATERIAL':'REVIEWING_COMPARISON',
      [stage]:{...prior,artifactId:artifact.id,artifactHash:artifact.payloadHash,state:'DISPATCHING',attempts:attempts+1,
        attemptsHistory:[...(prior?.attemptsHistory??[]),{attempt:attempts+1,state:'DISPATCHING'}]}});
    store.append('blind.workflow.review.dispatched',{replicationId,stage,artifactId:artifact.id,attempt:attempts+1,reviewerRoleIds:contract.reviewers[stage]});
    try{
      await workers.review({artifact,reviewerRoleIds:contract.reviewers[stage],missionIntent:store.get('mission',artifact.missionId).data.intent,signal});
      sameRegistration();artifact=store.get('artifact',artifact.id).data;prior=progress.data[stage];return decided();
    }catch(error){
      const current=store.get('artifact',artifact.id)?.data;
      // A committed decision survives a cancelled return/transport wrapper. It
      // is reconciled on resume, without crossing any barrier after cancellation.
      const code=safeCode(error),retryable=['QUOTA','TRANSIENT_PROVIDER'].includes(code)&&current?.status==='CANDIDATE';
      const step=progress.data[stage];
      save({[stage]:{...step,state:retryable?'RETRYABLE':'UNRECONCILED',failure:{code},
        attemptsHistory:step.attemptsHistory.map(h=>h.attempt===attempts+1?{...h,state:retryable?'RETRYABLE':'UNRECONCILED',code}:h)}});
      throw error;
    }
  };
  try{
    sameRegistration();save({status:'REPLICATING',pending:[]});
    const state=service.status(replicationId).state;
    if(['RUNNING','FAILED','INVALIDATED'].includes(state))return finish('REPLICA_UNRESOLVED',[{phase:'replica',code:'BLIND_STATE',state}]);
    const result=await service.execute(replicationId,{signal});sameRegistration();
    const material=service.materialize(replicationId);
    check(material.payload.purpose===BLIND_MATERIAL_PURPOSE,'BLIND_WORKFLOW_DRIFT','Unexpected material purpose');
    if(!await assess('material',material))return finish('MATERIAL_RETURNED',[{phase:'material',code:'QUALITY_RETURN',artifactId:material.id}]);
    sameRegistration();
    if(result.state==='INCONCLUSIVE')return finish('INCONCLUSIVE_ACCEPTED',[{phase:'comparison',code:'REPLICA_INCONCLUSIVE',
      reason:'Only faithful reporting of the completed UNKNOWN attempt was accepted. There is no result to compare, no original opening and no automatic replacement replica.'}]);
    if(through==='material')return finish('MATERIAL_ACCEPTED',[{phase:'comparison',code:'NOT_OPENED_BY_THIS_CALL'}]);
    sameRegistration();const comparison=service.compare(replicationId);
    check(comparison.payload.purpose===BLIND_COMPARISON_PURPOSE,'BLIND_WORKFLOW_DRIFT','Unexpected comparison purpose');
    if(!await assess('comparison',comparison))return finish('COMPARISON_RETURNED',[{phase:'comparison',code:'QUALITY_RETURN',artifactId:comparison.id}]);
    sameRegistration();return finish('REPORT_ACCEPTED',[{phase:'mission',code:'NOT_MISSION_ACCEPTANCE',
      reason:'Only the bounded comparison report is accepted. Remaining original-claim and user-request obligations require their own acceptance.'}]);
  }catch(error){
    save({status:error.code==='QUOTA'?'WAITING_QUOTA':error.code==='TRANSIENT_PROVIDER'?'WAITING_PROVIDER'
      :['CANCELLED','ABORTED'].includes(error.code)?'PAUSED':'NEEDS_RECONCILIATION',pending:[{code:safeCode(error)}]});
    throw error;
  }finally{
    const current=store.get('blind-workflow',replicationId);
    if(current?.data.owner?.ownerId===ownerId){
      store.put('blind-workflow',replicationId,{...current.data,owner:null},{expectedVersion:current.version});
      store.append('blind.workflow.left',{replicationId,ownerId,status:current.data.status});
    }
  }
}
