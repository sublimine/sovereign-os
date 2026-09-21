import {canonical, check, clone, digest, id, identifier, instant, integer, keys, list, sha256, string, timestamp, unique} from './contracts.mjs';
import {validateRequiredEffects, mergeRequiredEffects} from './plans.mjs';
import {inferenceRequestHash} from '../providers/instruction-profiles.mjs';
import {nativeReadActor,nativeReadCompletion} from './native-read-session.mjs';
import {productionScope} from './production-scope.mjs';
import {dependencyGates} from './dependency-gates.mjs';
import {dependencyInferences} from './dependency-inferences.mjs';
import {executionHistory} from './execution-history.mjs';
import {validateProducerPlanViews} from './producer-plan-view.mjs';
import {retainInferenceRequest} from './inference-request-evidence.mjs';
import {missionInferenceBudget,reserveMissionInference,missionBudgetRecordRef,assertMissionInferenceReserved} from './mission-inference-budget.mjs';
import {assertMissionInferenceDispatchProvenance} from './mission-inference-provenance.mjs';
import {readSourceContextView} from './source-context-view.mjs';
import {documentaryRun} from './documentary-mode.mjs';
import {documentaryExposure,validateDocumentClaims,validateDocumentReview} from './documentary-material.mjs';
import {verifiedAcquiredSource} from './source-documentary-scope.mjs';
import {BLIND_MATERIAL_KIND,BLIND_REVIEW_OBSERVATIONS,blindMaterialEvidence,closedBlindReviewTarget,assertClosedReviewThreadFresh} from './blind-material.mjs';
import {isBlindComparison,blindComparisonEvidence} from './blind-comparison.mjs';
import {INPUT_COPY_KIND,isInputCopyArtifact} from './input-copy-contract.mjs';
import {assertInputCopyPayload,inputCopyEvidence} from './input-copy.mjs';
import {assertPlanningInspectionCandidate} from './planning-inspection.mjs';
import {INPUT_FILE_REVIEW,verifyInputFileRead,verifyInputFileProofs} from './input-file-review.mjs';
import {isClosedResponseActor,assertClosedResponseExposure} from './closed-response-contract.mjs';
import {CLOSED_ENTRY_CRITERIA,PURPOSE as CLOSED_RESPONSE_PURPOSE} from './closed-entry-spec.mjs';
import {isBoundedReadActor,assertBoundedReadReceipt,assertBoundedReadCandidate} from './bounded-read-contract.mjs';
import {isSourcedResponseActor,isSourcedResponseReviewer,assertSourcedResponseReceipt,assertSourcedResponseCandidate,
  assertSourcedResponseReview,assertSourcedResponseReviewEvidence,sourcedResponseReviewBoundary} from './sourced-response-contract.mjs';
import {
  ADAPTIVE_V3_DIRECT_ENTRY_INTEGRITY,
  ADAPTIVE_V3_DIRECT_ENTRY_NODE,
  ADAPTIVE_V3_DIRECT_ENTRY_PURPOSE,
  assertAdaptiveV3ClosedEvidence,
  assertAdaptiveV3ClosedPayload,
  isAdaptiveV3ClosedArtifact
} from './adaptive-v3-deterministic-entry.mjs';
import {ADAPTIVE_V3_DIRECT_ENTRY_MODE} from './adaptive-v3-routing.mjs';
import {assertAdaptiveV3MissionRoute} from './adaptive-v3-route-contract.mjs';
import {consumeLearningDispatchAuthorization} from './learning.mjs';
const EVALUATIONS = ['content', 'runtime.independent_review', 'runtime.no_file_writes', 'runtime.no_code_execution', 'runtime.no_source_fetch'];
const RISK_PROPORTIONAL_REVIEW_SCHEMA='sovereign.risk-proportional-review.v1';
const ELEVATED_MISSION_RISKS=new Set(['high','critical']);
const MISSION_RISK_LEVELS=new Set(['low','moderate','high','critical']);
// Returning null for a legacy or planned mission is intentional.  A malformed
// v3 marker is rejected by the route contract before an ArtifactRegistry
// mutation can turn it into a permissive legacy path.
const isAdaptiveV3DirectMission = (registry, missionId) =>
  assertAdaptiveV3MissionRoute(registry.store, registry.authority, missionId)?.decision?.selectedEntryMode === ADAPTIVE_V3_DIRECT_ENTRY_MODE;
// Risk lives in the immutable mission admission envelope.  The resulting
// requirement is persisted when an ordinary review commits, so a restart
// cannot reinterpret a first ACCEPT as a deliverable result.
const reviewRequirementForArtifact=(registry,artifact)=>{
  const direction=registry.store.get('mission',artifact.missionId)?.data?.policy?.missionDirection;
  const riskLevel=direction?.riskLevel??null;
  check(riskLevel===null||MISSION_RISK_LEVELS.has(riskLevel),'REVIEW_REQUIREMENT','Mission risk direction is malformed');
  const expected={schema:RISK_PROPORTIONAL_REVIEW_SCHEMA,riskLevel,independentAcceptances:ELEVATED_MISSION_RISKS.has(riskLevel)?2:1};
  if(artifact.reviewRequirement===undefined)return expected;
  const stored=artifact.reviewRequirement;
  keys(stored,['schema','riskLevel','independentAcceptances']);
  check(canonical(stored)===canonical(expected),'REVIEW_REQUIREMENT','Persisted review requirement differs from the frozen mission risk');
  return clone(stored);
};
const reviewRecordsForArtifact=(registry,artifact)=>{
  list(artifact.reviews,'artifact review references',{max:1000});unique(artifact.reviews,'artifact review references');
  return artifact.reviews.map(reviewId=>{
    identifier(reviewId,'review reference');
    const review=registry.store.get('review',reviewId)?.data;
    check(review&&review.artifactId===artifact.id&&review.result?.artifactHash===artifact.payloadHash
      &&review.result?.purpose===artifact.payload.purpose,'ACCEPTANCE_MISSING','Artifact review history is missing or belongs to another product');
    return review;
  });
};
const runThreadIds=run=>new Set([run?.providerThreadId,...(run?.inferenceReceipts??[]).map(receipt=>receipt.threadId),run?.inferenceReceipt?.threadId]
  .filter(threadId=>typeof threadId==='string'&&threadId.length>0));
const assertIndependentReviewer=(registry,artifact,run,priorAcceptingRuns=[])=>{
  const producer=registry.store.get('run',artifact.payload.producerRunId)?.data;
  const producerThreads=runThreadIds(producer),reviewerThreads=runThreadIds(run);
  check(run.id!==artifact.payload.producerRunId&&!producerThreads.has(run.providerThreadId)
    &&![...reviewerThreads].some(threadId=>producerThreads.has(threadId))&&run.context.producerConversationIncluded===false,
  'SELF_CERTIFICATION','Material acceptance must not share producer identity, thread or private conversation');
  for(const prior of priorAcceptingRuns){
    check(prior&&prior.mode==='reviewer'&&prior.missionId===artifact.missionId,'REVIEW_INDEPENDENCE','Prior accepting reviewer is missing or outside this mission');
    const priorThreads=runThreadIds(prior);
    check(run.id!==prior.id&&!priorThreads.has(run.providerThreadId)
      &&![...reviewerThreads].some(threadId=>priorThreads.has(threadId)),
    'SELF_CERTIFICATION','A required second acceptance must use a different reviewer run and provider thread');
  }
};
// The direct route's certificate binds the native producer at run@1 and
// proves the absence of provider, context, tool and runtime work.  Refuse
// those mutation APIs before they can even turn a valid direct result into a
// permanently unusable one.  This is deliberately narrower than generic run
// registration: a foreign actor is also rejected by the direct evidence
// verifier, whereas these methods would mutate the one native actor itself.
const assertNoAdaptiveV3DirectMutation = (registry, missionId, operation) =>
  check(!isAdaptiveV3DirectMission(registry, missionId), ADAPTIVE_V3_DIRECT_ENTRY_INTEGRITY,
    `A direct adaptive-v3 mission cannot ${operation}; its deterministic producer has no provider, context, tool or runtime mutation path`);
const learnedWorkerConfig=(store,runId)=>{
  const config=store.get('worker-config',runId);
  if(!config||!Object.hasOwn(config.data??{},'learnedInstructionVersions'))return null;
  check(Array.isArray(config.data.learnedInstructionVersions),'LEARNING_DISPATCH_AUTHORIZATION','Worker learning overlay metadata is malformed');
  return config.data.learnedInstructionVersions.length?config:null;
};
const recordReference=record=>{
  check(record&&typeof record.type==='string'&&typeof record.id==='string'&&Number.isSafeInteger(record.version)&&record.version>0&&typeof record.hash==='string',
    'LEARNING_DISPATCH_AUTHORIZATION','Exact immutable record reference is required');
  identifier(record.type,'record type');identifier(record.id,'record ID');integer(record.version,'record version',{min:1});digest(record.hash,'record hash');
  return {type:record.type,id:record.id,version:record.version,hash:record.hash};
};
const LEARNING_WORKER_ORIGIN_SCHEMA='sovereign.learning-worker-origin.v1';
const storedLearnedWorkerOrigin=(registry,runId)=>{
  const origin=registry.store.get('learning-worker-origin',runId);
  if(!origin)return null;
  check(origin.version===1,'LEARNING_DISPATCH_AUTHORIZATION','Learned worker origin is not immutable');
  const {receipt,...payload}=origin.data??{};
  keys(payload,['schema','runRef','workerConfigRef','learnedInstructionVersionsHash','issuedAt']);
  check(payload.schema===LEARNING_WORKER_ORIGIN_SCHEMA,'LEARNING_DISPATCH_AUTHORIZATION','Unknown learned worker origin schema');
  keys(payload.runRef,['type','id','version','hash']);keys(payload.workerConfigRef,['type','id','version','hash']);
  check(payload.runRef.type==='run'&&payload.runRef.id===runId&&payload.workerConfigRef.type==='worker-config'&&payload.workerConfigRef.id===runId,
    'LEARNING_DISPATCH_AUTHORIZATION','Learned worker origin belongs to another run or configuration');
  for(const reference of [payload.runRef,payload.workerConfigRef]){
    identifier(reference.id,'learned origin record ID');integer(reference.version,'learned origin record version',{min:1});digest(reference.hash,'learned origin record hash');
  }
  digest(payload.learnedInstructionVersionsHash,'learned origin overlay hash');instant(payload.issuedAt,'learned origin time');
  check(canonical(registry.authority?.open(receipt,'learning.worker-origin'))===canonical(payload),
    'LEARNING_DISPATCH_AUTHORIZATION','Learned worker origin receipt differs from its signed payload');
  return {record:origin,payload};
};
const assertLearnedWorkerOrigin=(registry,runId,origin,currentConfig)=>{
  check(origin,'LEARNING_DISPATCH_AUTHORIZATION','Learned worker lacks its immutable creation binding');
  check(currentConfig&&canonical(recordReference(currentConfig))===canonical(origin.payload.workerConfigRef)
    &&sha256(currentConfig.data?.learnedInstructionVersions)===origin.payload.learnedInstructionVersionsHash
    &&Array.isArray(currentConfig.data?.learnedInstructionVersions)&&currentConfig.data.learnedInstructionVersions.length>0,
  'LEARNING_DISPATCH_AUTHORIZATION','Learned worker configuration differs from its immutable creation binding');
  return currentConfig;
};

export class ArtifactRegistry {
  #sequenceIndex = null;
  // A learned overlay crosses a stricter boundary than a generic completed
  // receipt.  The trusted WorkerService installs this once and keeps the
  // process-local handoff capabilities private, so a caller holding only this
  // public registry cannot fabricate a provider completion or stage a learned
  // dispatch with an arbitrary request body.
  #learningDispatchControl = null;
  // Mission-wide inference accounting has a separate capability from learned
  // overlays.  The registry retains a request, but must never be able to
  // bless its own generic row shape as a billable/valid dispatch.
  #missionInferenceDispatchControl = null;
  // Closed blind replication has a different durable root from a worker
  // (signed registration + FROZEN state, never worker-config/production).  It
  // therefore gets a nominally separate capability and request entry point,
  // rather than a caller-selected `kind` on the worker path.
  #blindInferenceDispatchControl = null;
  static #isGenuineRegistry(registry) {
    try {
      void registry.#sequenceIndex;
      return true;
    } catch {
      return false;
    }
  }
  static assertGenuine(registry, {store, code = 'ARTIFACT_REGISTRY', message = 'A genuine ArtifactRegistry is required'} = {}) {
    check(registry instanceof ArtifactRegistry && ArtifactRegistry.#isGenuineRegistry(registry), code, message);
    if (store !== undefined) check(registry.store === store, code, message);
    return registry;
  }
  constructor(store, authority, {clock = timestamp} = {}) { this.store = store; this.authority = authority; this.clock = clock; }
  reviewProgress(target) {
    const artifactId=typeof target==='string'?target:target?.id;
    identifier(artifactId,'artifact ID');
    const artifact=this.store.get('artifact',artifactId)?.data;
    check(artifact&&artifact.id===artifactId,'NOT_FOUND','Artifact does not exist');
    if(typeof target==='object'&&target!==null)check(target.payloadHash===artifact.payloadHash,'ARTIFACT_INTEGRITY','Review target version changed');
    const requirement=reviewRequirementForArtifact(this,artifact);
    const acceptedReviews=reviewRecordsForArtifact(this,artifact).filter(review=>review.result.decision==='ACCEPT');
    return {riskLevel:requirement.riskLevel,independentAcceptances:requirement.independentAcceptances,
      acceptedReviewCount:acceptedReviews.length,requiresAdditionalIndependentReview:acceptedReviews.length>0&&acceptedReviews.length<requirement.independentAcceptances};
  }
  installLearningDispatchControl(control) {
    check(control&&typeof control.assertPrepared==='function'&&typeof control.assertCompletion==='function',
      'LEARNING_DISPATCH_CONTROL','A complete trusted learning dispatch control is required');
    check(this.#learningDispatchControl===null,'LEARNING_DISPATCH_CONTROL',
      'A learning dispatch control is already bound to this registry');
    this.#learningDispatchControl=control;
  }
  installMissionInferenceDispatchControl(control) {
    check(control&&typeof control.issueReservation==='function',
      'INFERENCE_PROVENANCE_CONTROL','A complete trusted mission dispatch control is required');
    check(this.#missionInferenceDispatchControl===null,'INFERENCE_PROVENANCE_CONTROL',
      'A mission inference dispatch control is already bound to this registry');
    this.#missionInferenceDispatchControl=control;
  }
  installBlindInferenceDispatchControl(control) {
    check(control&&typeof control.assertPrepared==='function'&&typeof control.reservationBinding==='function'
      &&typeof control.issueBlindReservation==='function'&&typeof control.completeUnbudgetedBlindRequest==='function'&&typeof control.abort==='function',
    'INFERENCE_PROVENANCE_CONTROL','A complete trusted blind dispatch control is required');
    if(this.#blindInferenceDispatchControl===null){this.#blindInferenceDispatchControl=control;return;}
    // Multiple coordinator/service instances may share the same closed blind
    // controller after a local handoff.  A different object must never replace
    // the installed capability or reinterpret its opaque preflights.
    check(this.#blindInferenceDispatchControl===control,'INFERENCE_PROVENANCE_CONTROL',
      'A different blind dispatch control is already bound to this registry');
  }
  recordLearnedWorkerOrigin({runRecord,workerConfigRecord}={}) {
    check(this.store.db.isTransaction,'LEARNING_DISPATCH_AUTHORIZATION','Learned worker origin must share worker creation transaction');
    const runRef=recordReference(runRecord),workerConfigRef=recordReference(workerConfigRecord);
    check(runRef.type==='run'&&workerConfigRef.type==='worker-config'&&runRef.id===workerConfigRef.id&&runRef.version===1&&workerConfigRef.version===1,
      'LEARNING_DISPATCH_AUTHORIZATION','Learned worker origin must bind the initial run and worker configuration');
    const overlays=workerConfigRecord.data?.learnedInstructionVersions;
    check(Array.isArray(overlays)&&overlays.length>0,'LEARNING_DISPATCH_AUTHORIZATION','Only an initial learned configuration can create a learned worker origin');
    this.store.requireExecutionProtocol(14);
    const payload={schema:LEARNING_WORKER_ORIGIN_SCHEMA,runRef,workerConfigRef,learnedInstructionVersionsHash:sha256(overlays),issuedAt:this.clock()};
    instant(payload.issuedAt,'learned worker origin time');
    return this.store.put('learning-worker-origin',runRef.id,{...payload,receipt:this.authority.seal('learning.worker-origin',payload)},{expectedVersion:0});
  }
  // Cache positions, never judgments, source validity or proof contents. Scope
  // is one synchronous public validation; every later call starts from scratch.
  #withSequenceIndex(fn) {
    if(this.#sequenceIndex)return fn();
    this.#sequenceIndex={};
    try{return fn();}finally{this.#sequenceIndex=null;}
  }
  runtimeEffects(missionId, evaluation) {
    const tool = evaluation === 'runtime.no_file_writes' ? 'workspace.write' : evaluation === 'runtime.no_code_execution' ? 'execution.run' : evaluation === 'runtime.no_source_fetch' ? 'source.fetch' : null;
    return tool ? this.store.list('effect').filter(e => e.data.missionId === missionId && (e.data.tool === tool || evaluation==='runtime.no_source_fetch'&&e.data.tool==='source.search'))
      .map(e => ({id: e.id, hash: e.hash, version: e.version, state: e.data.state, tool: e.data.tool})).sort((a, b) => a.id.localeCompare(b.id)) : [];
  }
  runtimeCheck(criterion, artifact, run) {
    const effects = this.runtimeEffects(artifact.missionId, criterion.evaluation);
    const verdict = effects.length ? effects.some(e => ['FAILED', 'SUCCEEDED'].includes(e.state)) ? 'FAIL' : 'UNKNOWN' : 'PASS';
    const reason = criterion.evaluation === 'runtime.independent_review'
      ? 'Assigned independent reviewer identity, complete inference exposure and disjoint producer threads were verified in this transaction.'
      : effects.length ? 'Mission effect intents prevent certifying the requested absence of operations.' : 'No matching mission effect intent exists in the durable broker ledger at this control checkpoint.';
    const data = {id: id('control'), missionId: artifact.missionId, artifactId: artifact.id, artifactHash: artifact.payloadHash,
      reviewerRunId: run.id, criterionId: criterion.id, evaluation: criterion.evaluation, verdict, reason, effects,
      completedExposureHash: run.completedExposureHash, inferenceReceiptHash: sha256(run.inferenceReceipt), checkedAt: this.clock(),
      scope: 'Broker-mediated mission operations only; not host-wide filesystem or process surveillance.'};
    const signed = this.authority.seal('review.control', data);
    this.store.put('review-control', data.id, {signed}, {expectedVersion: 0});
    return {criterionId: criterion.id, verdict, evidence: [{kind: 'control', id: data.id, hash: sha256(signed), quote: reason}], reason};
  }
  controlReference(proof, artifact, review) {
    const signed = this.store.get('review-control', proof.id)?.data.signed;
    check(signed && sha256(signed) === proof.hash, 'RUNTIME_CONTROL', 'Control evidence is missing or changed');
    const data = this.authority.open(signed, 'review.control');
    const criterion = artifact.payload.criteria.find(c => c.id === data.criterionId);
    check(data.id === proof.id && data.missionId === artifact.missionId && data.artifactId === artifact.id && data.artifactHash === artifact.payloadHash
      && data.reviewerRunId === review.reviewerRunId && criterion?.evaluation === data.evaluation && data.verdict === 'PASS'
      && data.reason.includes(proof.quote), 'RUNTIME_CONTROL', 'Control evidence does not bind this accepted obligation');
    check(this.runtimeEffects(artifact.missionId, data.evaluation).length === 0, 'UNACCEPTED_INPUT', 'A subsequent mission operation invalidated an absence-of-effects control');
    return data;
  }
  exposureHash(run) { return sha256({context: run.context, toolObservations: run.toolObservations ?? [],
    ...(run.runtimeObservations?.length?{runtimeObservations:run.runtimeObservations}:{})}); }
  operationalEffects(missionId) {
    return this.store.list('effect').filter(r=>r.data.missionId===missionId).map(r=>({id:r.id,version:r.version,hash:r.hash,
      tool:r.data.tool,state:r.data.state,principalId:r.data.principalId}));
  }
  nodeEffectInventory(missionId,nodeId) {
    identifier(nodeId);
    const runs=this.store.list('run').filter(r=>r.data.missionId===missionId&&(['producer','replicator'].includes(r.data.mode)&&r.data.nodeId===nodeId||r.data.mode==='reviewer'&&r.data.nodeId===`review:${nodeId}`));
    const actors=new Set(runs.map(r=>r.id)),effects=this.operationalEffects(missionId).filter(e=>actors.has(e.principalId));
    const replicationRunIds=runs.filter(r=>r.data.mode==='replicator').map(r=>r.id);
    return {nodeId,productionRunIds:runs.filter(r=>['producer','replicator'].includes(r.data.mode)).map(r=>r.id),
      ...(replicationRunIds.length?{replicationRunIds}:{}),reviewerRunIds:runs.filter(r=>r.data.mode==='reviewer').map(r=>r.id),effects,
      fileWriteCount:effects.filter(e=>e.tool==='workspace.write').length,codeExecutionCount:effects.filter(e=>e.tool==='execution.run').length,
      sourceFetchCount:effects.filter(e=>e.tool==='source.fetch').length,sourceSearchCount:effects.filter(e=>e.tool==='source.search').length,
      scope:'Broker intents belonging to all recorded producer and reviewer runs of this exact mission/node, including failed or uncertain attempts. This scopes a stage-specific historical obligation, not mission-wide absence, current file correctness or host-wide activity. Other nodes may legitimately produce their own later effects.'};
  }
  exposedNodeIds(run) {
    const ids=new Set([run.mode==='reviewer'&&run.nodeId.startsWith('review:')?run.nodeId.slice(7):run.nodeId]);
    for(const artifactId of run.context.artifactIds){const a=this.store.get('artifact',artifactId)?.data;check(a&&a.missionId===run.missionId,'RUNTIME_INTEGRITY','Scoped history requires an actually exposed same-mission artifact');ids.add(a.payload.nodeId);}
    return [...ids].filter(n=>n!=='planning').sort();
  }
  workspaceHistory(missionId) {
    return this.store.list('effect').filter(r=>r.data.missionId===missionId&&r.data.tool.startsWith('workspace.')).map(r=>{
      const effect=r.data,receipt=effect.receipt?this.verifiedToolReceipt(effect.receipt):null;
      check(!['SUCCEEDED','FAILED'].includes(effect.state)||receipt,'TOOL_RECEIPT','Completed workspace history requires a committed receipt');
      // Read content is already delivered through independent observations. The
      // audit inventory retains exact paths, hashes, sizes and directory entries,
      // but does not duplicate whole file bodies or any worker conversation.
      const result=receipt?clone(receipt.result):null;
      if(result&&effect.tool==='workspace.read')delete result.content;
      return {id:r.id,version:r.version,recordHash:r.hash,tool:effect.tool,state:effect.state,principalId:effect.principalId,
        argsHash:effect.argsHash??null,receiptHash:receipt?sha256(effect.receipt):null,
        startedAt:receipt?.startedAt??effect.startedAt??null,completedAt:receipt?.completedAt??null,recordedResult:result};
    });
  }
  captureRuntimeObservations(runId) {
    return this.store.transact(()=>{
      const record=this.store.get('run',runId);check(record&&!record.data.expectedRequestHash,'INFERENCE_PENDING','Capture operational evidence before dispatch only');
      const run=record.data,mission=this.store.get('mission',run.missionId),queue=this.store.get('queue-job',run.missionId);
      assertNoAdaptiveV3DirectMutation(this,run.missionId,'capture runtime observations');
      check(mission,'NOT_FOUND','An actual mission is required');
      const closedReview=closedBlindReviewTarget(this.store,run);
      const ref=r=>r?{type:r.type,id:r.id,version:r.version,hash:r.hash}:null;
      const submissions=this.store.list('submission').filter(r=>r.data.missionId===run.missionId);
      const plan=this.store.get('plan',run.missionId),effects=this.operationalEffects(run.missionId);
      const snapshots=[...(queue?[{kind:'queue-history',detail:{queue:clone(queue.data),queueRecord:ref(queue),submissionRecords:submissions.map(ref),
        acceptedPlan:plan?{record:ref(plan),artifactId:plan.data.acceptedPlanArtifactId}:null,
        contextArtifactIds:[...run.context.artifactIds],
        completedInferences:this.store.list('run').filter(r=>r.data.missionId===run.missionId).flatMap(r=>(r.data.inferenceReceipts??[]).map(receipt=>({runId:r.id,threadId:receipt.threadId,turnId:receipt.turnId,simulation:receipt.simulation??null}))),
        scope:'Historical persisted queue reception and execution state at capture. Current review and future delivery are not already completed. No claim about all host processes.'}}]:[]),
        {kind:'effect-inventory',detail:{effects,sourceFetchCount:effects.filter(e=>e.tool==='source.fetch').length,sourceSearchCount:effects.filter(e=>e.tool==='source.search').length,
          fileWriteCount:effects.filter(e=>e.tool==='workspace.write').length,codeExecutionCount:effects.filter(e=>e.tool==='execution.run').length,
          scope:'Complete broker effect-intent inventory for this mission at capture, including unsuccessful or uncertain intents. Ordinary worker native tools are denied; a source.search intent may use a separate native-web-only client. This is not host-wide surveillance.'}}];
      // Planning is a prospective contract. It must not cite an absence of
      // pre-production effects as a promise that allowed future effects vanish.
      let selected=['planning','review:planning'].includes(run.nodeId)?snapshots.filter(s=>s.kind==='queue-history'):snapshots;
      if(!['planning','review:planning'].includes(run.nodeId))for(const nodeId of this.exposedNodeIds(run))selected.push({kind:'node-effect-inventory',detail:this.nodeEffectInventory(run.missionId,nodeId)});
      if(!['planning','review:planning'].includes(run.nodeId))for(const artifactId of run.context.artifactIds){
        const artifact=this.store.get('artifact',artifactId)?.data;
        // A consumer may inspect the history of its already admitted accepted
        // inputs. Never expose an unrelated sibling, an unaccepted draft or a
        // history of the candidate this producer has not created yet.
        if(run.mode!=='reviewer'&&artifact?.status!=='ACCEPTED')continue;
        if(artifact?.payload.kind===BLIND_MATERIAL_KIND)selected.push({kind:'artifact-blind-material',detail:blindMaterialEvidence(this,artifactId)});
        if(isBlindComparison(artifact))selected.push({kind:'artifact-blind-comparison',detail:blindComparisonEvidence(this,artifactId)});
        if(isInputCopyArtifact(artifact))selected.push({kind:'artifact-input-copy',detail:inputCopyEvidence(this,artifactId)});
        if(artifact?.payload.nodeId!=='planning'&&typeof artifact?.payload.producerRunId==='string')selected.push({kind:'artifact-production-scope',detail:productionScope(this,artifactId)});
        if(run.mode==='reviewer'&&artifact?.payload.nodeId!=='planning'&&typeof artifact?.payload.producerRunId==='string'&&artifact.payload.inputRefs.length)selected.push({kind:'artifact-dependency-gates',detail:dependencyGates(this,artifactId)});
        if(!closedReview&&run.mode==='reviewer'&&artifact?.payload.nodeId!=='planning'&&typeof artifact?.payload.producerRunId==='string'&&artifact.payload.inputRefs.length)selected.push({kind:'artifact-dependency-inferences',detail:dependencyInferences(this,artifactId)});
      }
      if(!['planning','review:planning'].includes(run.nodeId)&&effects.some(e=>e.tool.startsWith('workspace.'))){
        selected.push({kind:'workspace-history',detail:{effects:this.workspaceHistory(run.missionId),
          scope:'Complete durable workspace broker intent history for this mission at capture, including unsuccessful, PREPARED and uncertain records and all prior actors. Timestamps record broker events; read bodies are omitted, exact content hashes remain. Not current file bytes, native internal temporary files, host-wide surveillance, inherited actor identity or a substitute for independent post-candidate reads/listings.'}});
      }
      if(run.mode==='reviewer'&&!closedReview&&run.nodeId!=='review:planning'&&effects.some(e=>e.tool==='execution.run'))
        selected.push({kind:'execution-history',detail:executionHistory(this,run.missionId)});
      // A sourced reviewer needs one authenticated answer boundary, not the
      // producer's broker history.  In particular, source.fetch receipts and
      // their result metadata are not a second factual-evidence channel.
      if(isSourcedResponseReviewer(this.store,run))selected=[{kind:'sourced-answer-boundary',
        detail:sourcedResponseReviewBoundary(this.store,run)}];
      if(closedReview)selected=selected.filter(s=>BLIND_REVIEW_OBSERVATIONS.includes(s.kind)
        &&(s.kind!=='node-effect-inventory'||s.detail.nodeId===closedReview.payload.nodeId));
      if(!selected.length)return [];
      const changed=selected.filter(snapshot=>{
        const scopeKey=snapshot.kind==='node-effect-inventory'?'nodeId':['artifact-production-scope','artifact-dependency-gates','artifact-dependency-inferences','artifact-blind-material','artifact-blind-comparison','artifact-input-copy'].includes(snapshot.kind)?'artifactId':null;
        const previous=[...(run.runtimeObservations??[])].reverse().find(o=>o.kind===snapshot.kind&&(!scopeKey||this.runtimeReference({...o,quote:o.quoteText},run,{current:false}).detail[scopeKey]===snapshot.detail[scopeKey]));
        if(!previous)return true;
        const data=this.runtimeReference({...previous,quote:previous.quoteText},run,{current:false});
        return canonical(data.detail)!==canonical(snapshot.detail);
      });
      if(!changed.length)return [];
      const observations=changed.map(snapshot=>{
        const data={id:id('runtime-observation'),missionId:run.missionId,runId,intentHash:mission.data.intentHash,capturedAt:this.clock(),...snapshot};
        const signed=this.authority.seal('runtime.observation',data);this.store.put('runtime-observation',data.id,{signed},{expectedVersion:0});
        return {id:data.id,hash:sha256(signed),kind:data.kind,quoteText:canonical(data)};
      });
      this.store.put('run',runId,{...run,runtimeObservations:[...(run.runtimeObservations??[]),...observations]},{expectedVersion:record.version});return observations;
    });
  }
  runtimeReference(evidence,run,{current=true}={}) {
    const observed=(run.runtimeObservations??[]).find(o=>o.id===evidence.id);
    check(observed&&observed.hash===evidence.hash&&observed.quoteText.includes(evidence.quote),'UNOBSERVED_RUNTIME','Operational evidence was not exposed with this exact hash and passage');
    const record=this.store.get('runtime-observation',evidence.id),signed=record?.data.signed;
    check(record?.version===1&&sha256(signed)===evidence.hash,'RUNTIME_INTEGRITY','Operational observation changed');
    const data=this.authority.open(signed,'runtime.observation');
    check(data.missionId===run.missionId&&data.runId===run.id&&canonical(data)===observed.quoteText,'RUNTIME_INTEGRITY','Operational observation binding differs');
    if(data.kind==='sourced-answer-boundary'){
      check(isSourcedResponseReviewer(this.store,run),
        'UNOBSERVED_RUNTIME','Sourced answer boundary is outside the exact sourced reviewer scope');
      check(canonical(sourcedResponseReviewBoundary(this.store,run))===canonical(data.detail),
        'SOURCED_RESPONSE_BINDING','Sourced answer boundary differs from the immutable reviewer contract');
    }else if(data.kind==='effect-inventory'){
      if(current)check(canonical(data.detail.effects)===canonical(this.operationalEffects(run.missionId)),'STALE_RUNTIME','Mission effects changed since the operational observation');
    }else if(data.kind==='node-effect-inventory'){
      check(this.exposedNodeIds(run).includes(data.detail.nodeId),'UNOBSERVED_RUNTIME','Node history is outside the actual artifact exposure');
      if(current)check(canonical(data.detail.effects)===canonical(this.nodeEffectInventory(run.missionId,data.detail.nodeId).effects),'STALE_RUNTIME','Effects of this exact mission/node changed since the scoped observation');
    }else if(data.kind==='artifact-blind-material'){
      check(run.context.artifactIds.includes(data.detail.artifactId),'UNOBSERVED_RUNTIME','Blind material evidence is outside this actor context');
      const actual=blindMaterialEvidence(this,data.detail.artifactId,{current});
      check(canonical(actual)===canonical(data.detail),'RUNTIME_INTEGRITY','Blind material evidence differs from its exact recorded binding');
    }else if(data.kind==='artifact-blind-comparison'){
      check(run.context.artifactIds.includes(data.detail.artifactId),'UNOBSERVED_RUNTIME','Comparison evidence is outside this actor context');
      const approvalEvidence=Object.hasOwn(data.detail,'protocolApproval')?'historical-v1':'legacy';
      const exposureEvidence=Object.hasOwn(data.detail,'closedExposure')?'bilateral-v1':'legacy';
      check(canonical(blindComparisonEvidence(this,data.detail.artifactId,{current,approvalEvidence,exposureEvidence}))===canonical(data.detail),
        'RUNTIME_INTEGRITY','Comparison evidence differs from its exact recorded binding');
    }else if(data.kind==='artifact-input-copy'){
      check(run.context.artifactIds.includes(data.detail.artifactId),'UNOBSERVED_RUNTIME','Native input-copy evidence is outside this actor context');
      check(canonical(inputCopyEvidence(this,data.detail.artifactId,{current}))===canonical(data.detail),
        'INPUT_COPY_INTEGRITY','Native input-copy observation differs from authenticated recomputation');
    }else if(data.kind==='artifact-production-scope'){
      const artifact=this.store.get('artifact',data.detail.artifactId)?.data;
      check(run.context.artifactIds.includes(data.detail.artifactId)&&artifact?.missionId===run.missionId&&artifact.payloadHash===data.detail.artifactHash,'UNOBSERVED_RUNTIME','Production scope is outside the exact observed candidate');
      for(const ref of [data.detail.candidateRecord,...data.detail.attempts.map(a=>a.record)])check(this.store.get(ref.type,ref.id,ref.version)?.hash===ref.hash,'RUNTIME_INTEGRITY','Historical admission record is missing or changed');
      for(const ref of data.detail.attempts.flatMap(a=>a.requests.map(q=>q.producerInput?.requestRecord).filter(Boolean)))check(this.store.get(ref.type,ref.id,ref.version)?.hash===ref.hash,'RUNTIME_INTEGRITY','Retained public request evidence is missing or changed');
    }else if(data.kind==='artifact-dependency-inferences'){
      const artifact=this.store.get('artifact',data.detail.artifactId)?.data;
      check(run.mode==='reviewer'&&!closedBlindReviewTarget(this.store,run)&&run.context.artifactIds.includes(data.detail.artifactId)
        &&artifact?.missionId===run.missionId&&artifact.payloadHash===data.detail.artifactHash,
      'UNOBSERVED_RUNTIME','Dependency inference provenance is outside the exact reviewer exposure');
      check(canonical(dependencyInferences(this,data.detail.artifactId))===canonical(data.detail),
        'RUNTIME_INTEGRITY','Dependency inference provenance differs from historical recomputation');
      if(current)for(const dependency of data.detail.dependencies){
        const usable=this.assertUsable(dependency.input.artifactId,{missionId:run.missionId,purpose:dependency.input.purpose});
        check(usable.payloadHash===dependency.input.hash,'UNACCEPTED_INPUT','Current dependency differs from the historical inference provenance');
      }
    }else if(data.kind==='artifact-dependency-gates'){
      const artifact=this.store.get('artifact',data.detail.artifactId)?.data;
      check(run.context.artifactIds.includes(data.detail.artifactId)&&artifact?.missionId===run.missionId&&artifact.payloadHash===data.detail.artifactHash,'UNOBSERVED_RUNTIME','Dependency gates are outside the observed candidate');
      for(const ref of [data.detail.candidateRecord,data.detail.firstProducerRecord,...data.detail.dependencies.flatMap(d=>[d.artifactRecord,d.review?.record,d.review?.reviewerRecord].filter(Boolean))])check(this.store.get(ref.type,ref.id,ref.version)?.hash===ref.hash,'RUNTIME_INTEGRITY','Historical dependency acceptance record changed');
      if(current)for(const dependency of data.detail.dependencies){
        const usable=this.assertUsable(dependency.input.artifactId,{missionId:run.missionId,purpose:dependency.input.purpose});
        check(usable.payloadHash===dependency.input.hash,'UNACCEPTED_INPUT','Current dependency payload differs from the historical gate');
      }
    }else if(data.kind==='execution-history'){
      check(run.mode==='reviewer'&&run.nodeId!=='review:planning'&&!closedBlindReviewTarget(this.store,run),
        'UNOBSERVED_RUNTIME','Execution history is outside this reviewer scope');
      check(data.detail.version==='execution-history-v1'
        &&data.detail.cutoff.seq<this.committedSequence('runtime-observation',data.id,1)
        &&canonical(executionHistory(this,run.missionId,{cutoff:data.detail.cutoff}))===canonical(data.detail),
        'RUNTIME_INTEGRITY','Historical execution evidence differs from its complete recorded cutoff');
      if(current)check(canonical(executionHistory(this,run.missionId))===canonical(data.detail),
        'STALE_RUNTIME','Execution history changed since the operational observation');
    }else if(data.kind==='workspace-history'){
      if(current)check(canonical(data.detail.effects)===canonical(this.workspaceHistory(run.missionId)),'STALE_RUNTIME','Workspace broker history changed since observation');
    }else if(data.kind==='queue-history'){
      for(const ref of [data.detail.queueRecord,...data.detail.submissionRecords,...(data.detail.acceptedPlan?[data.detail.acceptedPlan.record]:[])]){
        const r=this.store.get(ref.type,ref.id,ref.version);check(r?.hash===ref.hash,'RUNTIME_INTEGRITY','Historical queue record is missing or changed');
      }
    }else check(false,'RUNTIME_INTEGRITY','Unknown operational observation kind');
    return data;
  }
  requireCompletedExposure(run,{documentary=null}={}) {
    check(!run.expectedRequestHash && run.completedExposureHash === this.exposureHash(run), 'UNOBSERVED_CONTEXT', 'Current observations require a completed inference in this exact exposure');
    if(documentary)documentaryExposure(this,run,{frameId:documentary.frameId,requestHash:documentary.requestHash},{latest:true});
    else this.requireLegacyMaterialContext(run);
  }
  requireLegacyMaterialContext(run) {
    check(!documentaryRun(this.store,run),'DOCUMENT_FRAME_NOT_INTEGRATED','Compiled documentary actor requires its versioned material binding, never a legacy gate');
    // Preparing a documentary input is not activation of its acceptance path.
    // Legacy sourceIds/exposureHash still describe full raw admission, not the
    // actual projected request. Only the separately validated versioned path
    // may materialize these inputs; never relax this legacy guard.
    const requestHash=run.inferenceReceipt?.contextHash;
    if(!requestHash)return; // Historical/synthetic legacy receipts can lack bytes.
    const record=this.store.get('inference-request','inference-request:'+sha256([run.id,requestHash]));
    if(!record)return;
    check(record.version===1&&record.data.schema==='sovereign.inference-request.v1'
      &&record.data.runId===run.id&&record.data.missionId===run.missionId&&record.data.requestHash===requestHash,
    'REQUEST_INTEGRITY','Material request retention changed');
    const request=JSON.parse(record.data.requestJson);
    check(inferenceRequestHash(request)===requestHash,'REQUEST_INTEGRITY','Material request bytes changed');
    let input;
    try{input=readSourceContextView(request.input);}catch{return;} // Legacy inputs also include opaque text, not only structured context.
    const documentary=['documentContextFrame','documentSourceGrants','documentSourceViews','documentAcquisitionProjection','documentEvidenceCatalog','documentSourceRelationships'];
    check(!input||typeof input!=='object'||!documentary.some(key=>Object.hasOwn(input,key)),
      'DOCUMENT_FRAME_NOT_INTEGRATED','Documentary projected inputs require their own versioned material binding, not legacy gates');
  }
  verifiedToolReceipt(signed) {
    const receipt = this.authority.open(signed, 'tool.receipt');
    identifier(receipt.id); identifier(receipt.missionId); identifier(receipt.principalId); string(receipt.tool); digest(receipt.argsHash);
    instant(receipt.startedAt); instant(receipt.completedAt);
    const effect = this.store.get('effect', receipt.id)?.data;
    check(effect && ['SUCCEEDED', 'FAILED'].includes(receipt.status) && effect.state === receipt.status
      && effect.missionId === receipt.missionId && effect.principalId === receipt.principalId && effect.tool === receipt.tool
      && effect.argsHash === receipt.argsHash && sha256(effect.receipt) === sha256(signed), 'TOOL_RECEIPT', 'Receipt must match a committed broker operation and its real actor');
    return receipt;
  }
  recordToolObservation(runId, signedReceipt) {
    return this.store.transact(() => {
      const record = this.store.get('run', runId); check(record, 'NOT_FOUND', 'Run is not registered');
      const run = record.data;
      assertNoAdaptiveV3DirectMutation(this,run.missionId,'record a tool observation');
      const receipt = this.verifiedToolReceipt(signedReceipt);
      check(!isClosedResponseActor(this.store,run)&&!this.store.get('worker-config',runId)?.data.controllerContract,
        'CLOSED_RESPONSE_AUTHORITY','Closed entry cannot receive broker observations');
      check(receipt.missionId === run.missionId, 'TOOL_RECEIPT', 'Observation belongs to another mission');
      if(isBoundedReadActor(this.store,run)||this.store.get('worker-config',runId)?.data.boundedReadContract)
        assertBoundedReadReceipt(this.store,run,receipt);
      if(isSourcedResponseActor(this.store,run)||this.store.get('worker-config',runId)?.data.sourcedResponseContract)
        assertSourcedResponseReceipt(this.store,run,receipt);
      const hash = sha256(signedReceipt), previous = (run.toolObservations ?? []).find(o => o.id === receipt.id);
      if (previous) { check(previous.hash === hash, 'IDEMPOTENCY_CONFLICT', 'Observed receipt changed'); return previous; }
      check(!run.expectedRequestHash, 'INFERENCE_PENDING', 'Cannot change exposure during a dispatched inference');
      const observation = {id: receipt.id, hash, principalId: receipt.principalId,
        relation: receipt.principalId === runId ? 'OWN_ACTION' : 'EXTERNAL_OBSERVATION', signedReceipt: clone(signedReceipt),
        resultText: canonical(receipt.result), observedAt: this.clock()};
      this.store.put('run', runId, {...run, toolObservations: [...(run.toolObservations ?? []), observation]}, {expectedVersion: record.version});
      return observation;
    });
  }
  toolReference(evidence, run, {requireAdmittedSources = false} = {}) {
    const observed = (run.toolObservations ?? []).find(o => o.id === evidence.id);
    check(observed && observed.hash === evidence.hash && observed.resultText.includes(evidence.quote), 'UNOBSERVED_TOOL', 'Exact signed tool evidence was not delivered to this run');
    const receipt = this.verifiedToolReceipt(observed.signedReceipt);
    check(receipt.missionId === run.missionId && canonical(receipt.result) === observed.resultText, 'TOOL_RECEIPT', 'Observed result changed');
    if (requireAdmittedSources && receipt.tool === 'source.fetch') {
      const source = this.store.get('source', `source:${receipt.id}`)?.data;
      check(source && source.missionId === run.missionId && source.status === 'ADMITTED'
        && source.receiptId === receipt.id && source.receiptHash === observed.hash
        && source.hash === receipt.result.sha256 && sha256(source.raw) === source.hash,
        'SOURCE_UNAVAILABLE', 'Acquisition receipt used as acceptance support requires its exact admitted source version');
    }
    return receipt;
  }
  getToolObservations(runId) {
    const run = this.store.get('run', runId)?.data; check(run, 'NOT_FOUND', 'Run is not registered');
    return (run.toolObservations ?? []).map(observation => {
      const receipt = this.verifiedToolReceipt(observation.signedReceipt);
      return {id: observation.id, hash: observation.hash, principalId: receipt.principalId, relation: observation.relation,
        tool: receipt.tool, status: receipt.status, result: clone(receipt.result), quoteText: observation.resultText, observedAt: observation.observedAt};
    });
  }
  committedSequence(type, recordId, version) {
    const cache=this.#sequenceIndex,db=this.store.db;
    if(cache&&db&&typeof db.prepare==='function'){
      const state=()=>({...db.prepare('SELECT total_changes() AS changes, (SELECT seq FROM events ORDER BY seq DESC LIMIT 1) AS head, (SELECT hash FROM events ORDER BY seq DESC LIMIT 1) AS hash').get(),
        dataVersion:db.prepare('PRAGMA data_version').get().data_version,events:this.store.events});
      const same=(a,b)=>a&&b&&a.changes===b.changes&&a.head===b.head&&a.hash===b.hash&&a.dataVersion===b.dataVersion&&a.events===b.events;
      const before=state(),key=JSON.stringify([type,recordId,version]);
      if(cache.db===db&&cache.index&&same(cache.state,before))return cache.index.get(key)??null;
      const index=new Map();let after=0;
      for(;;){
        const events=this.store.events({after,limit:1000});
        for(const event of events)if(event.kind==='record.committed'){
          const d=event.data,k=JSON.stringify([d.type,d.id,d.version]);
          if(!index.has(k))index.set(k,event.seq);
        }
        if(events.length<1000)break;after=events.at(-1).seq;
      }
      // A same-connection write, rollback, another connection's commit, or a
      // replaced event reader invalidates the lookup. Changed scans are never
      // retained. Historical positions do not suppress time-sensitive checks.
      const afterState=state();
      if(same(before,afterState))Object.assign(cache,{db,state:afterState,index});
      else Object.assign(cache,{db:null,state:null,index:null});
      return index.get(key)??null;
    }
    let after = 0;
    for (;;) {
      const events = this.store.events({after, limit: 1000});
      for (const event of events) if (event.kind === 'record.committed' && event.data.type === type && event.data.id === recordId && event.data.version === version) return event.seq;
      if (!events.length) return null;
      after = events.at(-1).seq;
    }
  }
  verifyAfterCandidate(receipt, artifact, run) {
    check(receipt.principalId === run.id, 'TOOL_ACTOR', 'Current-state proof must be an independent reviewer operation',
      {expectedPrincipalId:run.id,observedPrincipalId:receipt.principalId,operationId:receipt.id,artifactId:artifact.id,tool:receipt.tool});
    const final = this.store.get('effect', receipt.id);
    let dispatched = null;
    for (let version = 1; version <= final.version; version++) if (this.store.get('effect', receipt.id, version)?.data.state === 'DISPATCHED') { dispatched = this.committedSequence('effect', receipt.id, version); break; }
    const created = this.committedSequence('artifact', artifact.id, 1);
    check(dispatched !== null && created !== null && dispatched > created, 'STALE_TOOL', 'Current-state read must begin after this candidate was created');
  }
  verifyCurrentExecution(receipt, artifact, run, obligation = null) {
    this.verifyAfterCandidate(receipt, artifact, run);
    const result = receipt.result;
    check(receipt.tool === 'execution.run' && receipt.status === 'SUCCEEDED'
      && result.schema === 'sovereign.execution.v1' && result.simulation === false
      && result.mode === 'snapshot-discard' && result.isolation?.enforced === true
      && result.isolation.processesTerminated === true && result.isolation.scratchRemoved === true
      && result.outputTruncated === false && sha256(result.manifest) === result.snapshotHash,
    'EXECUTION_PROOF', 'Independent execution needs a complete, real, bounded snapshot receipt');
    if (obligation) check(result.cwd === obligation.path && canonical(result.argv) === canonical(JSON.parse(obligation.command))
      && result.exitCode === obligation.expectedExit, 'EXECUTION_PROOF', 'Execution differs from required command, cwd or exit outcome');
    return result;
  }
  rejectObservedExecution(artifactId, reviewerRunId, signedReceipt, obligation) {
    return this.store.transact(() => {
      const record=this.store.get('artifact',artifactId),run=this.store.get('run',reviewerRunId)?.data;
      check(record?.data.status==='CANDIDATE'&&run?.mode==='reviewer'&&run.missionId===record.data.missionId
        &&run.id!==record.data.payload.producerRunId&&run.context.artifactIds.includes(artifactId),
      'REVIEW_IDENTITY','Deterministic rejection requires an independent assigned reviewer');
      const receipt=this.verifiedToolReceipt(signedReceipt);
      this.verifyCurrentExecution(receipt,record.data,run);
      check(record.data.payload.requiredEffects.some(e=>canonical(e)===canonical(obligation))
        &&receipt.result.cwd===obligation.path&&canonical(receipt.result.argv)===canonical(JSON.parse(obligation.command))
        &&receipt.result.exitCode!==obligation.expectedExit,'EXECUTION_PROOF','No observed failing execution obligation');
      const rejection={id:id('effect-rejection'),artifactId,artifactHash:record.data.payloadHash,reviewerRunId,
        code:'EXECUTION_FAILED',operationId:receipt.id,receiptHash:sha256(signedReceipt),obligation,
        observedExit:receipt.result.exitCode,reason:'Actual independent execution differs from the frozen required exit',createdAt:this.clock()};
      this.store.put('effect-rejection',rejection.id,{signed:this.authority.seal('effect.rejection',rejection)},{expectedVersion:0});
      this.store.put('artifact',artifactId,{...record.data,status:'RETURNED',effectRejections:[...(record.data.effectRejections??[]),rejection.id]},{expectedVersion:record.version});
      this.store.append('artifact.effect.rejected',{missionId:record.data.missionId,artifactId,rejectionId:rejection.id,code:rejection.code});
      return rejection;
    });
  }
  verifyCurrentRead(receipt, artifact, run) {
    this.verifyAfterCandidate(receipt, artifact, run);
    verifyInputFileRead(this,receipt,artifact,run);
    const expectedWrites = (candidate, seen = new Set()) => {
      check(!seen.has(candidate.id), 'LINEAGE_CYCLE', 'Effect lineage cycle'); seen.add(candidate.id);
      const own = candidate.payload.toolReceipts.map(s => this.verifiedToolReceipt(s)).filter(r => r.tool === 'workspace.write' && r.result.path === receipt.result.path);
      const writes = own.length ? [own.at(-1)] : candidate.payload.inputRefs.flatMap(ref => expectedWrites(this.store.get('artifact', ref.artifactId).data, new Set(seen)));
      return writes;
    };
    const writes = expectedWrites(artifact);
    if (writes.length) check(writes.every(write => receipt.result.sha256 === write.result.sha256), 'TOOL_STATE_MISMATCH', 'Read state differs from a declared candidate or inherited write');
    check(sha256(receipt.result.content) === receipt.result.sha256, 'TOOL_STATE_MISMATCH', 'Read bytes do not match their digest');
  }
  registerRun({missionId, nodeId, mode, context, forbiddenArtifactIds = [], providerThreadId = null}) {
    identifier(missionId); identifier(nodeId); check(['producer', 'reviewer', 'replicator'].includes(mode), 'RUN_MODE', 'Unknown run mode');
    keys(context, ['purpose', 'artifactIds', 'sourceIds', 'instructionsHash', 'producerConversationIncluded', 'planViews'], ['purpose', 'artifactIds', 'sourceIds', 'instructionsHash', 'producerConversationIncluded']);
    string(context.purpose); digest(context.instructionsHash); list(context.artifactIds, 'context artifacts'); list(context.sourceIds, 'context sources');
    check(context.producerConversationIncluded === false, 'CONTEXT_CONTAMINATION', 'Private producer conversation must not enter scoped worker context');
    validateProducerPlanViews(this.store,{missionId,nodeId,mode,context});
    if (mode === 'replicator') check(!context.artifactIds.some(a => forbiddenArtifactIds.includes(a)), 'BLIND_CONTAMINATION', 'Blind replication context contains the original answer');
    const run = {id: id('run'), missionId, nodeId, mode, context: clone(context), contextHash: sha256(context), forbiddenArtifactIds: [...forbiddenArtifactIds], providerThreadId, createdAt: this.clock()};
    return this.store.transact(()=>{
      // The native producer is now written only by FactoryEngine's private
      // materializer under its active engine lease.  A public Registry caller
      // must never be able to bootstrap that privileged path, even by
      // reproducing an apparently exact empty context.
      if (isAdaptiveV3DirectMission(this, missionId)) {
        check(false,ADAPTIVE_V3_DIRECT_ENTRY_INTEGRITY,
          'A direct adaptive-v3 producer may only be materialized inside FactoryEngine\'s private execution boundary');
      }
      if(mode==='reviewer'){this.store.requireExecutionProtocol(5);run.inputReviewProtocol=INPUT_FILE_REVIEW;}
      this.store.put('run', run.id, run, {expectedVersion: 0});return run;
    });
  }
  attachInference(runId, receipt, {learningReceiptAttestation=null}={}) {
    return this.store.transact(()=>{
    const run = this.store.get('run', runId); check(run, 'NOT_FOUND', 'Run is not registered');
    assertNoAdaptiveV3DirectMutation(this,run.data.missionId,'attach provider inference');
    check(receipt.status === 'completed' || receipt.status === 'COMPLETED', 'INFERENCE_INCOMPLETE', 'Incomplete inference cannot produce an artifact');
    string(receipt.threadId); string(receipt.turnId);
    const previous = run.data.inferenceReceipts ?? [];
    check(!previous.some(r => r.threadId === receipt.threadId), 'INFERENCE_THREAD_REUSE', 'Each scoped inference must use a fresh provider thread');
    if (run.data.expectedRequestHash) check(receipt.contextHash === run.data.expectedRequestHash, 'INFERENCE_CONTEXT', 'Provider receipt does not match the dispatched request');
    assertMissionInferenceReserved(this,run.data,receipt);
    const native=nativeReadActor(this.store,run.data);
    check(native||!receipt.nativeTranscript&&receipt.toolPolicy!=='native-read-v1','NATIVE_READ_INTEGRITY','Native proof cannot be attached to an unselected actor');
    const workerConfig=learnedWorkerConfig(this.store,runId),origin=storedLearnedWorkerOrigin(this,runId);
    // The marker is written with the retained request.  Treat its mere
    // presence as learned even if a later writer corrupts/replaces the current
    // configuration; otherwise a changed config could skip consumption.
    const hasPendingLearning=run.data.pendingLearningDispatchAuthorizationId!==undefined;
    if(workerConfig||hasPendingLearning||origin){
      const boundWorkerConfig=assertLearnedWorkerOrigin(this,runId,origin,this.store.get('worker-config',runId));
      const authorizationId=run.data.pendingLearningDispatchAuthorizationId;
      check(boundWorkerConfig?.version===1,'LEARNING_DISPATCH_AUTHORIZATION','A learned receipt requires its original immutable worker configuration');
      check(typeof authorizationId==='string','LEARNING_DISPATCH_AUTHORIZATION','Learned inference receipt has no pending dispatch authorization');
      identifier(authorizationId,'pending learning dispatch authorization ID');
      check(typeof run.data.expectedRequestHash==='string','LEARNING_DISPATCH_AUTHORIZATION','Learned inference receipt has no pending request hash');
      check(this.#learningDispatchControl,'LEARNING_DISPATCH_CONTROL','Learned receipt cannot be accepted without the trusted worker dispatch control');
      this.#learningDispatchControl.assertCompletion({run,workerConfig:boundWorkerConfig,authorizationId,receipt,learningReceiptAttestation});
      const requestRecord=this.store.get('inference-request','inference-request:'+sha256([runId,run.data.expectedRequestHash]));
      consumeLearningDispatchAuthorization({store:this.store,authority:this.authority,authorizationId,runRecord:run,
        workerConfigRecord:boundWorkerConfig,inferenceRequestRecord:requestRecord,receipt});
    }
    const rawExposed=native?{...run.data,toolObservations:[...(run.data.toolObservations??[]),...nativeReadCompletion(this,run.data,receipt)]}:run.data;
    // A consumed learned permit is a one-shot reservation. Remove it from the
    // new run head while its immutable authorization/completion records retain
    // the full historical chain; a later receipt cannot replay it.
    const {pendingLearningDispatchAuthorizationId,...exposed}=rawExposed;
    return this.store.put('run', runId, {...exposed, providerThreadId: receipt.threadId, inferenceReceipt: clone(receipt), inferenceReceipts: [...previous, clone(receipt)], expectedRequestHash: null, completedExposureHash: this.exposureHash(exposed)}, {expectedVersion: run.version});
    });
  }
  recordInferenceRequest(runId, {instructions, input, schema, model, reasoningEffort, instructionProfile}, {learningDispatchAuthorizationId=null,learningDispatchPreflight=null,missionInferenceDispatchPreflight=null}={}) {
    return this.store.transact(()=>{
    const run = this.store.get('run', runId); check(run, 'NOT_FOUND', 'Run is not registered');
    check(run.data.mode!=='replicator','BLIND_INFERENCE_PATH',
      'A closed blind replica must use the nominal blind inference request path');
    assertNoAdaptiveV3DirectMutation(this,run.data.missionId,'record a provider inference request');
    string(instructions); string(input); check(schema && typeof schema === 'object', 'SCHEMA', 'Inference schema is missing');
    const workerConfig=learnedWorkerConfig(this.store,runId),origin=storedLearnedWorkerOrigin(this,runId),learned=!!workerConfig||!!origin;
    const request={instructions,input,schema,model,reasoningEffort,instructionProfile};
    const requestHash = inferenceRequestHash(request);
    if(learned){
      const boundWorkerConfig=assertLearnedWorkerOrigin(this,runId,origin,this.store.get('worker-config',runId));
      check(typeof learningDispatchAuthorizationId==='string','LEARNING_DISPATCH_AUTHORIZATION','A learned overlay requires a reserved dispatch authorization ID');
      identifier(learningDispatchAuthorizationId,'learning dispatch authorization ID');
      check(!run.data.expectedRequestHash&&!run.data.pendingLearningDispatchAuthorizationId,
        'INFERENCE_PENDING','A learned pending dispatch must be reconciled, not replayed');
      check(this.#learningDispatchControl,'LEARNING_DISPATCH_CONTROL','A learned overlay requires the trusted worker dispatch control');
      this.#learningDispatchControl.assertPrepared({run,workerConfig:boundWorkerConfig,request,requestHash,authorizationId:learningDispatchAuthorizationId,learningDispatchPreflight});
    }else check(learningDispatchAuthorizationId===null&&learningDispatchPreflight===null,
      'LEARNING_DISPATCH_AUTHORIZATION','An ordinary worker cannot reserve a learning dispatch authorization');
    const budget=missionInferenceBudget(this,run.data.missionId);
    if(budget)check(this.#missionInferenceDispatchControl&&missionInferenceDispatchPreflight!==null,
      'INFERENCE_PROVENANCE_CONTROL','A budgeted worker request requires a trusted dispatch provenance preflight');
    else check(missionInferenceDispatchPreflight===null,
      'INFERENCE_PROVENANCE_CONTROL','An unbudgeted worker cannot carry a mission dispatch provenance preflight');
    if(budget)check(!run.data.expectedRequestHash,'INFERENCE_PENDING','Budgeted pending inference must be reconciled, not replayed');
    check(!run.data.expectedRequestHash || run.data.expectedRequestHash === requestHash, 'INFERENCE_PENDING', 'Another inference request is pending');
    const pendingRun=this.store.put('run', runId, {...run.data, expectedRequestHash: requestHash,...(learned?{pendingLearningDispatchAuthorizationId:learningDispatchAuthorizationId}:{}),
      requests: [...(run.data.requests ?? []), {requestHash, contextHash: run.data.contextHash, at: this.clock()}]}, {expectedVersion: run.version});
    const retainedRequest=retainInferenceRequest(this.store,runId,{instructions,input,schema,...(model!==undefined?{model}:{}),...(reasoningEffort!==undefined?{reasoningEffort}:{}),...(instructionProfile!==undefined?{instructionProfile}:{})},'BEFORE_DISPATCH');
    if(budget){
      const call=reserveMissionInference(this,{missionId:run.data.missionId,kind:'worker',binding:{
        run:missionBudgetRecordRef(pendingRun),request:missionBudgetRecordRef(retainedRequest),requestHash}});
      this.#missionInferenceDispatchControl.issueReservation({runRecord:pendingRun,requestRecord:retainedRequest,callRecord:call,
        preflight:missionInferenceDispatchPreflight});
      // The private callback must leave the exact signed proof behind before
      // this transaction commits.  A partial integration cannot create a
      // syntactically shaped reservation which only fails after a provider
      // dispatch has already started.
      assertMissionInferenceDispatchProvenance({store:this.store,authority:this.authority},{
        run:missionBudgetRecordRef(pendingRun),request:missionBudgetRecordRef(retainedRequest),call:missionBudgetRecordRef(call)});
    }
    return requestHash;
    });
  }
  // Closed replicas intentionally cannot use the worker request API.  Their
  // trusted service supplies an opaque preflight tied to a signed registration
  // and FROZEN lifecycle state; the Registry derives the only admissible
  // `blind-replica` reservation binding itself.
  recordBlindInferenceRequest(runId, {instructions, input, schema, model, reasoningEffort, instructionProfile}, {replicationId,blindInferenceDispatchPreflight=null}={}) {
    const control=this.#blindInferenceDispatchControl;let completed=false;
    try{return this.store.transact(()=>{
      const run=this.store.get('run',runId);check(run,'NOT_FOUND','Run is not registered');
      assertNoAdaptiveV3DirectMutation(this,run.data.missionId,'record a closed blind provider inference request');
      check(run.data.mode==='replicator','BLIND_INFERENCE_PATH','Only a registered closed replicator may use the blind inference path');
      identifier(replicationId,'blind replication ID');string(instructions);string(input);check(schema&&typeof schema==='object','SCHEMA','Inference schema is missing');
      // A closed replica may not acquire a learned/worker overlay merely by
      // entering through another public Registry method.
      check(!learnedWorkerConfig(this.store,runId)&&!storedLearnedWorkerOrigin(this,runId),
        'BLIND_INFERENCE_PATH','A closed blind replica cannot carry a worker learning overlay');
      const request={instructions,input,schema,model,reasoningEffort,instructionProfile},requestHash=inferenceRequestHash(request);
      check(control&&blindInferenceDispatchPreflight!==null,
        'INFERENCE_PROVENANCE_CONTROL','A closed blind request requires its trusted dispatch provenance preflight');
      control.assertPrepared({preflight:blindInferenceDispatchPreflight,replicationId,runRecord:run,request,requestHash});
      check(!run.data.expectedRequestHash,'INFERENCE_PENDING','A closed blind pending inference must be reconciled, not replayed');
      const pendingRun=this.store.put('run',runId,{...run.data,expectedRequestHash:requestHash,
        requests:[...(run.data.requests??[]),{requestHash,contextHash:run.data.contextHash,at:this.clock()}]},{expectedVersion:run.version});
      const retainedRequest=retainInferenceRequest(this.store,runId,{instructions,input,schema,...(model!==undefined?{model}:{}),
        ...(reasoningEffort!==undefined?{reasoningEffort}:{}),...(instructionProfile!==undefined?{instructionProfile}:{})},'BEFORE_DISPATCH');
      const budget=missionInferenceBudget(this,run.data.missionId);
      if(budget){
        const binding=control.reservationBinding({preflight:blindInferenceDispatchPreflight,pendingRun,requestRecord:retainedRequest});
        const call=reserveMissionInference(this,{missionId:run.data.missionId,kind:'blind-replica',binding});
        control.issueBlindReservation({preflight:blindInferenceDispatchPreflight,pendingRun,requestRecord:retainedRequest,callRecord:call});
      }else control.completeUnbudgetedBlindRequest({preflight:blindInferenceDispatchPreflight,pendingRun,requestRecord:retainedRequest});
      completed=true;return requestHash;
    });}finally{
      if(!completed&&control&&blindInferenceDispatchPreflight!==null)control.abort({preflight:blindInferenceDispatchPreflight});
    }
  }
  bindHistoricalInferenceRequest(runId,request) {
    return this.store.transact(()=>{
      const run=this.store.get('run',runId);check(run,'NOT_FOUND','Run is not registered');
      assertNoAdaptiveV3DirectMutation(this,run.data.missionId,'bind historical provider inference');
      return retainInferenceRequest(this.store,runId,request,'HASH_BOUND_HISTORICAL');
    });
  }
  updateContext(runId, context) {
    const run = this.store.get('run', runId); check(run, 'NOT_FOUND', 'Run is not registered');
    assertNoAdaptiveV3DirectMutation(this,run.data.missionId,'change producer context');
    if(isClosedResponseActor(this.store,run.data)||this.store.get('worker-config',runId)?.data.controllerContract)
      assertClosedResponseExposure(this.store,{...run.data,context});
    check(!run.data.expectedRequestHash, 'INFERENCE_PENDING', 'Cannot change exposure during a dispatched inference');
    keys(context, ['purpose', 'artifactIds', 'sourceIds', 'instructionsHash', 'producerConversationIncluded', 'planViews'], ['purpose', 'artifactIds', 'sourceIds', 'instructionsHash', 'producerConversationIncluded']);
    check(canonical(context.planViews??null)===canonical(run.data.context.planViews??null),'CONTEXT_ERASURE','Frozen plan exposure cannot be changed or removed');
    validateProducerPlanViews(this.store,{...run.data,context});
    check(context.purpose === run.data.context.purpose && context.producerConversationIncluded === false, 'CONTEXT_CONTAMINATION', 'Context cannot change the scoped purpose or import a producer conversation');
    digest(context.instructionsHash); list(context.artifactIds, 'context artifacts'); list(context.sourceIds, 'context sources');
    unique(context.artifactIds); unique(context.sourceIds);
    check(run.data.context.artifactIds.every(a => context.artifactIds.includes(a)) && run.data.context.sourceIds.every(s => context.sourceIds.includes(s)),
      'CONTEXT_ERASURE', 'Observed exposure may not be erased from the manifest');
    if (run.data.mode === 'replicator') check(!context.artifactIds.some(a => run.data.forbiddenArtifactIds.includes(a)), 'BLIND_CONTAMINATION', 'Replica received the original answer');
    return this.store.put('run', runId, {...run.data, context: clone(context), contextHash: sha256(context),
      contextHistory: [...(run.data.contextHistory ?? []), {context: run.data.context, contextHash: run.data.contextHash, at: this.clock()}]}, {expectedVersion: run.version});
  }
  ingestSource(signedReceipt) {
    const receipt = this.authority.open(signedReceipt, 'tool.receipt');
    check(receipt.tool === 'source.fetch' && receipt.status === 'SUCCEEDED', 'SOURCE_RECEIPT', 'A source requires a successful acquisition receipt');
    assertNoAdaptiveV3DirectMutation(this,receipt.missionId,'admit an acquired source');
    const result = receipt.result;
    string(result.content, 'source content', {min: 0, max: 8 * 1024 * 1024}); digest(result.sha256); instant(result.retrievedAt);
    check(sha256(result.content) === result.sha256, 'SOURCE_INTEGRITY', 'Fetched content does not match its receipt digest');
    const sourceId = `source:${receipt.id}`;
    const previous = this.store.get('source', sourceId);
    if (previous) { check(previous.data.receiptHash === sha256(signedReceipt), 'IDEMPOTENCY_CONFLICT', 'Source receipt changed'); return previous.data; }
    const source = {id: sourceId, missionId: receipt.missionId, receiptId: receipt.id, receiptHash: sha256(signedReceipt), raw: result.content,
      hash: result.sha256, url: result.finalUrl ?? result.url, httpStatus: result.status ?? null, retrievedAt: result.retrievedAt, mediaType: result.mediaType ?? 'unknown',
      ...(result.acquisition===undefined?{}:{acquisition:clone(result.acquisition)}),
      status: 'ADMITTED', rootGroup: null, rootAssessment: 'UNKNOWN', revokedAt: null};
    this.store.put('source', sourceId, source, {expectedVersion: 0}); return source;
  }
  sourceReference(ref, missionId) {
    keys(ref, ['sourceId', 'hash', 'quote'], ['sourceId', 'hash', 'quote'], 'source reference');
    digest(ref.hash); string(ref.quote, 'source quote', {max: 20000});
    const source = this.store.get('source', ref.sourceId)?.data;
    check(source && source.missionId === missionId && source.status === 'ADMITTED', 'SOURCE_UNAVAILABLE', 'Source is missing, outside mission, or retracted');
    check(source.hash === ref.hash && source.raw.includes(ref.quote), 'SOURCE_SUPPORT', 'The cited exact passage does not exist in the acquired version');
    return source;
  }
  assertMaterialClaimReviewBoundary(artifact, run, result, documentary = null) {
    if (result.decision !== 'ACCEPT') return;
    const producer = this.store.get('run', artifact.payload.producerRunId)?.data;
    // The sourced-response entry has a stronger, route-specific chronology and
    // coverage gate below. Do not replace its typed fallback outcome with this
    // reusable ordinary-artifact diagnostic.
    if (isSourcedResponseActor(this.store, producer) || this.store.get('worker-config', producer?.id)?.data.sourcedResponseContract) return;
    const evidence = result.checks.flatMap(checkResult => checkResult.evidence);
    for (const claim of artifact.payload.claims) {
      // Hypotheses and typed UNKNOWN remain explicitly non-factual. A fact or
      // inference may instead rely on an already accepted input; this gate
      // covers every direct acquired-source premise without re-acquiring it.
      if (!['fact', 'inference'].includes(claim.kind)) continue;
      for (const ref of claim.sources) {
        this.sourceReference(ref, artifact.missionId);
        verifiedAcquiredSource(this, ref.sourceId, artifact.missionId);
        if (documentary) continue; // validateDocumentReview binds a separate raw window below.
        check(evidence.some(item => item.kind === 'source' && item.id === ref.sourceId && item.hash === ref.hash),
          'FACTUAL_REVIEW_COVERAGE', 'Each direct factual premise needs an independently cited acquired source version');
      }
    }
  }
  validateClaims(claims, missionId, inputRefs) {
    list(claims, 'claims'); unique(claims.map(c => c.id), 'claim IDs');
    for (const claim of claims) {
      keys(claim, ['id', 'text', 'kind', 'sources', 'basis', 'qualifiers', 'validUntil']);
      identifier(claim.id); string(claim.text, 'claim text');
      check(['fact', 'inference', 'hypothesis', 'unknown'].includes(claim.kind), 'CLAIM_KIND', 'Claim kind is not an epistemic category');
      list(claim.sources, 'claim sources'); list(claim.basis, 'claim basis'); list(claim.qualifiers, 'qualifiers').forEach(q => string(q));
      if (claim.validUntil !== null) check(instant(claim.validUntil) > instant(this.clock()), 'STALE_CLAIM', 'Claim is already outside its declared validity');
      claim.sources.forEach(ref => this.sourceReference(ref, missionId));
      check(claim.kind !== 'fact' || claim.sources.length > 0 || claim.basis.length > 0, 'UNSUPPORTED_FACT', 'A factual assertion requires acquired support');
      check(claim.kind !== 'inference' || claim.basis.length > 0 || claim.sources.length > 0, 'UNSUPPORTED_INFERENCE', 'An inference must identify its premises');
      for (const basis of claim.basis) {
        keys(basis, ['artifactId', 'hash', 'claimId']); digest(basis.hash);
        check(inputRefs.some(r => r.artifactId === basis.artifactId && r.hash === basis.hash), 'UNDECLARED_PREMISE', 'Claim basis was not declared as an input');
        const parent = this.store.get('artifact', basis.artifactId)?.data;
        const parentClaim = parent?.payload.claims.find(c => c.id === basis.claimId);
        check(parent && parent.payloadHash === basis.hash && parentClaim, 'UNDECLARED_PREMISE', 'Claim premise cannot be resolved');
        check(claim.kind !== 'fact' || parentClaim.kind === 'fact', 'EPISTEMIC_PROMOTION', 'An inference or hypothesis cannot become a fact by citation');
      }
    }
  }
  create({missionId, nodeId, producerRunId, kind, purpose, body, claims = [], inputRefs = [], toolReceipts = [], requiredEffects = [], criteria, provisional = false, documentary = null}) {
    identifier(missionId); identifier(nodeId); identifier(kind); string(purpose);
    // The v3 closed-result purpose and node are a deliberately reserved pair.
    // They must never be repurposed as an ordinary model-produced artifact and
    // then sent through the normal reviewer path.  The full authenticated
    // recomputation happens below after the canonical candidate payload exists.
    const adaptiveV3Reserved = purpose === ADAPTIVE_V3_DIRECT_ENTRY_PURPOSE || nodeId === ADAPTIVE_V3_DIRECT_ENTRY_NODE;
    const adaptiveV3Direct = isAdaptiveV3DirectMission(this, missionId);
    if (adaptiveV3Direct) check(false,ADAPTIVE_V3_DIRECT_ENTRY_INTEGRITY,
      'A direct adaptive-v3 candidate may only be materialized inside FactoryEngine\'s private execution boundary');
    // `trim-ascii-v1` can deterministically yield the empty byte sequence.
    // No ordinary artifact gains that allowance; the reserved path is still
    // required to prove the exact materialized payload below.
    string(body, 'artifact body', {max: 4 * 1024 * 1024, min: adaptiveV3Reserved ? 0 : 1});
    const run = this.store.get('run', producerRunId)?.data;
    if (adaptiveV3Reserved) check(kind === 'deterministic-result' && nodeId === ADAPTIVE_V3_DIRECT_ENTRY_NODE
      && purpose === ADAPTIVE_V3_DIRECT_ENTRY_PURPOSE, ADAPTIVE_V3_DIRECT_ENTRY_INTEGRITY,
    'The adaptive-v3 deterministic reservation cannot be relabeled as another product');
    if(isBoundedReadActor(this.store,run)||this.store.get('worker-config',producerRunId)?.data.boundedReadContract)
      assertBoundedReadCandidate(this.store,run,{kind,purpose,claims,inputRefs,requiredEffects,criteria,provisional,toolReceipts});
    if(isSourcedResponseActor(this.store,run)||this.store.get('worker-config',producerRunId)?.data.sourcedResponseContract)
      // The V2 public-listing profile validates the delivered body shape
      // (required headings and editorial boundaries) before a candidate can
      // enter review. Pass the exact candidate body into that sealed check;
      // omitting it would turn a malformed producer answer into an INTERNAL
      // exception rather than a typed, recoverable presentation failure.
      assertSourcedResponseCandidate(this.store,run,{kind,purpose,body,claims,inputRefs,requiredEffects,criteria,provisional,toolReceipts});
    if(isClosedResponseActor(this.store,run)||this.store.get('worker-config',producerRunId)?.data.controllerContract){
      assertClosedResponseExposure(this.store,run);
      check(kind==='closed-response'&&purpose===CLOSED_RESPONSE_PURPOSE&&provisional===false
        &&claims.length===0&&inputRefs.length===0&&toolReceipts.length===0&&requiredEffects.length===0
        &&canonical(criteria)===canonical(CLOSED_ENTRY_CRITERIA),
        'CLOSED_RESPONSE_BINDING','Closed producer cannot claim another product, external provenance, effects or weaker criteria');
    }
    check(run && run.missionId === missionId && run.nodeId === nodeId && ['producer', 'replicator'].includes(run.mode), 'PRODUCER_IDENTITY', 'Artifact producer is not the assigned run');
    if(nodeId==='planning'&&this.store.get('mission',missionId)?.data.policy?.planningContracts!==undefined){
      check(kind==='mission-plan'&&purpose==='plan'&&provisional===false,'PLANNING_INSPECTION_INTEGRITY','Planning control actor can submit only its inspected final plan');
      assertPlanningInspectionCandidate(this,producerRunId,body);
    }
    check(run.inferenceReceipt || kind === 'deterministic-result'||kind===INPUT_COPY_KIND, 'INFERENCE_MISSING', 'Artifact requires a real inference receipt or explicit deterministic origin');
    if (kind !== 'deterministic-result'&&kind!==INPUT_COPY_KIND) this.requireCompletedExposure(run,{documentary});
    else {check(!documentary,'DOCUMENT_PROTOCOL','Native/deterministic products cannot borrow model documentary origin');this.requireLegacyMaterialContext(run);}
    check(typeof provisional === 'boolean', 'SCHEMA', 'provisional must be a boolean');
    list(inputRefs, 'input refs'); unique(inputRefs.map(r => r.artifactId), 'input artifacts');
    validateRequiredEffects(requiredEffects);
    const inheritedEffects = [];
    for (const ref of inputRefs) {
      keys(ref, ['artifactId', 'hash', 'purpose']); digest(ref.hash); string(ref.purpose);
      const parent = this.store.get('artifact', ref.artifactId)?.data;
      check(parent && parent.missionId === missionId && parent.payloadHash === ref.hash, 'INPUT_VERSION', 'Input version is missing or changed');
      check(run.context.artifactIds.includes(ref.artifactId), 'UNOBSERVED_INPUT', 'The producer did not receive a declared material input');
      inheritedEffects.push(parent.payload.requiredEffects ?? []);
      if (!provisional) this.assertUsable(ref.artifactId, {missionId, purpose: ref.purpose});
    }
    list(criteria, 'criteria', {min: 1}); unique(criteria.map(c => c.id), 'criteria IDs');
    criteria.forEach(c => { keys(c, ['id', 'text', 'evaluation'], ['id', 'text']); identifier(c.id); string(c.text); check(EVALUATIONS.includes(c.evaluation ?? 'content'), 'SCHEMA', 'Unknown criterion evaluator'); });
    this.validateClaims(claims, missionId, inputRefs);
    if(documentary)validateDocumentClaims(this,run,claims,documentary,{latest:true});
    else for (const claim of claims) for (const ref of claim.sources)
      check(run.context.sourceIds.includes(ref.sourceId), 'UNOBSERVED_SOURCE', 'Producer did not receive a cited raw source');
    const verifiedReceipts = toolReceipts.map(signed => {
      const receipt = this.verifiedToolReceipt(signed);
      check(receipt.missionId === missionId && receipt.principalId === producerRunId && receipt.status === 'SUCCEEDED', 'TOOL_RECEIPT', 'Tool receipt is not a successful action by this producer');
      check((run.toolObservations ?? []).some(o => o.id === receipt.id && o.hash === sha256(signed)), 'UNOBSERVED_TOOL', 'Producer must observe its own operation before producing the candidate');
      return signed;
    });
    const payload = {missionId, nodeId, producerRunId, kind, purpose, body, claims: clone(claims), inputRefs: clone(inputRefs), toolReceipts: clone(verifiedReceipts), requiredEffects: clone(mergeRequiredEffects(requiredEffects, ...inheritedEffects)), criteria: clone(criteria), provisional,...(documentary?{documentary:clone(documentary)}:{})};
    if(kind===INPUT_COPY_KIND||this.store.get('input-copy-origin',producerRunId)){
      check(kind===INPUT_COPY_KIND,'INPUT_COPY_INTEGRITY','Native input identity cannot be reused for another product kind');
      check(!this.store.list('artifact').some(r=>r.data.payload.producerRunId===producerRunId),
        'INPUT_COPY_INTEGRITY','One native identity cannot create multiple candidates');
      assertInputCopyPayload(this,payload);
    }
    if (adaptiveV3Reserved) assertAdaptiveV3ClosedPayload(this, payload);
    const artifact = {id: id('artifact'), payload, payloadHash: sha256(payload), missionId, status: 'CANDIDATE', reviews: [], createdAt: this.clock(), invalidation: null};
    this.store.put('artifact', artifact.id, artifact, {expectedVersion: 0}); return artifact;
  }
  review(input) { return this.#withSequenceIndex(()=>this.#review(input)); }
  #review({artifactId, reviewerRunId, result, documentary = null}) {
    return this.store.transact(() => {
      check(!this.store.get('conditional-assessment',reviewerRunId,1),'ASSESSMENT_ONLY','A conditional diagnostic actor cannot issue material acceptance');
      result = clone(result);
      const record = this.store.get('artifact', artifactId); check(record, 'NOT_FOUND', 'Artifact does not exist');
      const artifact = record.data, run = this.store.get('run', reviewerRunId)?.data, producer = this.store.get('run', artifact.payload.producerRunId)?.data;
      if (isAdaptiveV3DirectMission(this, artifact.missionId)) check(false, ADAPTIVE_V3_DIRECT_ENTRY_INTEGRITY,
        'A direct adaptive-v3 mission cannot obtain ordinary reviewer acceptance');
      const adaptiveV3Reserved = artifact.payload?.purpose === ADAPTIVE_V3_DIRECT_ENTRY_PURPOSE
        || artifact.payload?.nodeId === ADAPTIVE_V3_DIRECT_ENTRY_NODE;
      if (adaptiveV3Reserved) {
        check(isAdaptiveV3ClosedArtifact(artifact), ADAPTIVE_V3_DIRECT_ENTRY_INTEGRITY,
          'A malformed adaptive-v3 reservation cannot be reviewed as an ordinary artifact');
        check(false, ADAPTIVE_V3_DIRECT_ENTRY_INTEGRITY,
          'Adaptive-v3 deterministic output is certified by authenticated recomputation, never an ordinary reviewer');
      }
      check(run && run.mode === 'reviewer' && run.missionId === artifact.missionId && run.inferenceReceipt, 'REVIEW_IDENTITY', 'Review requires an assigned reviewer with completed inference');
      this.requireCompletedExposure(run,{documentary});
      if(artifact.payload.documentary)validateDocumentClaims(this,producer,artifact.payload.claims,artifact.payload.documentary);
      if(documentary)validateDocumentReview(this,run,result,artifact,documentary,{latest:true});
      const requirement=reviewRequirementForArtifact(this,artifact);
      const priorReviews=reviewRecordsForArtifact(this,artifact),priorAcceptances=priorReviews.filter(review=>review.result.decision==='ACCEPT');
      const priorAcceptingRuns=priorAcceptances.map(review=>this.store.get('run',review.reviewerRunId)?.data);
      assertIndependentReviewer(this,artifact,run,priorAcceptingRuns);
      check(run.context.artifactIds.includes(artifactId), 'UNOBSERVED_ARTIFACT', 'Reviewer did not receive this artifact');
      check((priorAcceptances.length>0?['CANDIDATE']:['CANDIDATE','RETURNED']).includes(artifact.status), 'ARTIFACT_STATE',
        'An adversarial acceptance may follow only a pending first acceptance; a returned candidate needs producer correction');
      keys(result, ['artifactHash', 'purpose', 'decision', 'checks', 'findings', 'uncertainty']);
      check(result.artifactHash === artifact.payloadHash && result.purpose === artifact.payload.purpose, 'REVIEW_SCOPE', 'Review does not match the exact product and purpose');
      check(['ACCEPT', 'RETURN', 'UNKNOWN'].includes(result.decision), 'REVIEW_DECISION', 'Unknown review decision');
      string(result.uncertainty, 'uncertainty', {min: 0}); list(result.checks, 'review checks'); list(result.findings, 'review findings');
      unique(result.checks.map(c => c.criterionId), 'review criterion IDs');
      const required = artifact.payload.criteria.filter(c => (c.evaluation ?? 'content') === 'content').map(c => c.id).sort();
      check(canonical(result.checks.map(c => c.criterionId).sort()) === canonical(required), 'REVIEW_COVERAGE', 'Model review must cover exactly the semantic criteria; runtime checks cannot be supplied by a caller');
      // Validate the sourced review's narrow evidence boundary before the
      // generic dispatcher reaches toolReference().  This makes a forged or
      // stale producer receipt a precise contract violation, not an apparent
      // absence of a reviewer-owned tool observation.
      assertSourcedResponseReviewEvidence(this,artifact,run,result);
      for (const checkResult of result.checks) {
        keys(checkResult, ['criterionId', 'verdict', 'evidence', 'reason']);
        check(['PASS', 'FAIL', 'UNKNOWN'].includes(checkResult.verdict), 'REVIEW_DECISION', 'Unknown criterion verdict'); string(checkResult.reason);
        // The wire schema can describe an empty array, but a semantic verdict
        // without any observed proof cannot enter a review record.  Give this
        // the review-specific code so WorkerService can make its bounded,
        // evidence-only correction from the same reviewer exposure; never
        // silently add a citation or weaken the invariant for non-ACCEPTs.
        list(checkResult.evidence, 'observed evidence');
        check(checkResult.evidence.length>0,'REVIEW_EVIDENCE',
          'Every independent semantic check needs at least one cited observed evidence object',
          {criterionId:checkResult.criterionId});
        for (const evidence of checkResult.evidence) {
          keys(evidence, ['kind', 'id', 'hash', 'quote']); digest(evidence.hash); string(evidence.quote, 'observed passage');
          if (evidence.kind === 'source') {
            check(documentary||run.context.sourceIds.includes(evidence.id), 'UNOBSERVED_SOURCE', 'Reviewer did not receive this raw source');
            this.sourceReference({sourceId: evidence.id, hash: evidence.hash, quote: evidence.quote}, artifact.missionId);
          }
          else if (evidence.kind === 'artifact') {
            const cited = this.store.get('artifact', evidence.id)?.data;
            check(cited && cited.missionId === artifact.missionId && cited.payloadHash === evidence.hash && cited.payload.body.includes(evidence.quote)
              && run.context.artifactIds.includes(cited.id), 'REVIEW_EVIDENCE', 'Artifact evidence must quote the observed payload.body exactly, not claims, qualifiers or metadata',
              {criterionId:checkResult.criterionId,evidenceKind:'artifact',evidenceId:evidence.id,quoteField:'payload.body'});
            if (result.decision === 'ACCEPT' && cited.id !== artifactId) this.assertUsable(cited.id, {missionId: artifact.missionId, purpose: cited.payload.purpose});
          } else if (evidence.kind === 'tool') {
            const receipt = this.toolReference(evidence, run, {requireAdmittedSources: result.decision === 'ACCEPT'});
            if (result.decision === 'ACCEPT') {
              check(receipt.status === 'SUCCEEDED', 'FAILED_TOOL', 'Failed operation cannot establish successful acceptance');
              try{
                if (receipt.tool === 'workspace.read') this.verifyCurrentRead(receipt, artifact, run);
                if (receipt.tool === 'workspace.list') this.verifyAfterCandidate(receipt, artifact, run);
                if (receipt.tool === 'execution.run') this.verifyCurrentExecution(receipt, artifact, run);
              }catch(error){error.details={...error.details,criterionId:checkResult.criterionId,evidenceKind:evidence.kind,evidenceId:evidence.id};throw error;}
            }
          } else if(evidence.kind==='tool-history') {
            const receipt=this.toolReference(evidence,run);
            check(['workspace.read','execution.run'].includes(receipt.tool),'HISTORY_SCOPE','Historical kind is only for recorded reads/executions, not current-state or documentary-source proof');
            // Exact observed signed history is admissible as history, even a
            // prior failed operation in a recovery criterion. It is never
            // counted below as an independent current-state effect obligation.
          } else if(evidence.kind==='runtime')this.runtimeReference(evidence,run);
          else check(false, 'REVIEW_EVIDENCE', 'Unknown review evidence kind');
        }
      }
      result.findings.forEach(f => { keys(f, ['severity', 'description', 'recovery']); check(['material', 'minor'].includes(f.severity), 'SCHEMA', 'Finding severity invalid'); string(f.description); string(f.recovery); });
      const runtimeChecks = artifact.payload.criteria.filter(c => (c.evaluation ?? 'content') !== 'content').map(c => this.runtimeCheck(c, artifact, run));
      result.checks.push(...runtimeChecks);
      if (result.decision === 'ACCEPT' && runtimeChecks.some(c => c.verdict !== 'PASS')) {
        result.decision = 'RETURN';
        result.findings.push({severity: 'material', description: 'A deterministic runtime obligation failed or remains unknown.', recovery: 'Resolve the recorded mission effect conflict; do not manufacture an absence-of-effects claim.'});
      }
      if (result.decision === 'ACCEPT') {
        verifyInputFileProofs(this,artifact,run,result);
        if(isInputCopyArtifact(artifact)){
          inputCopyEvidence(this,artifact.id);
          check(result.checks.flatMap(c=>c.evidence).filter(e=>e.kind==='runtime').some(e=>{
            const data=this.runtimeReference(e,run);return data.kind==='artifact-input-copy'&&data.detail.artifactId===artifact.id;
          }),'INPUT_COPY_PROOF','Literal-copy acceptance needs its observed authenticated source/selection proof, not only copied text');
        }
        if(isBlindComparison(artifact)){
          const comparison=blindComparisonEvidence(this,artifact.id);
          const original=this.store.get('artifact',comparison.records.original.id,comparison.records.original.version).data;
          const material=this.store.get('artifact',comparison.records.material.id,comparison.records.material.version).data;
          const actors=[original.payload.producerRunId,material.payload.producerRunId];
          const threads=new Set(actors.flatMap(id=>{const r=this.store.get('run',id)?.data;return [r?.providerThreadId,...(r?.inferenceReceipts??[]).map(q=>q.threadId)];}).filter(Boolean));
          check(!actors.includes(run.id)&&!threads.has(run.providerThreadId)&&!(run.inferenceReceipts??[]).some(r=>threads.has(r.threadId)),
            'SELF_CERTIFICATION','Comparison assessment cannot reuse the original or replica producer thread');
          check(result.checks.flatMap(c=>c.evidence).filter(e=>e.kind==='runtime').some(e=>{
            const data=this.runtimeReference(e,run);return data.kind==='artifact-blind-comparison'&&data.detail.artifactId===artifact.id;
          }),'BLIND_COMPARISON','Comparison acceptance needs its own observed authenticated recomputation');
        }
        if(artifact.payload.kind===BLIND_MATERIAL_KIND){
          check(closedBlindReviewTarget(this.store,run)?.id===artifact.id,'BLIND_REVIEW_CONTEXT','The actual attempt reviewer must have the exact closed assessment purpose and target');
          assertClosedReviewThreadFresh(this,run);
          blindMaterialEvidence(this,artifact.id);
          const proof=result.checks.flatMap(c=>c.evidence).filter(e=>e.kind==='runtime').some(e=>{
            const data=this.runtimeReference(e,run);return data.kind==='artifact-blind-material'&&data.detail.artifactId===artifact.id;
          });
          check(proof,'BLIND_REVIEW_PROOF','Sealed material acceptance needs its observed authenticated binding, not only a producer statement');
        }
        for (const obligation of artifact.payload.requiredEffects ?? []) {
          if (obligation.type === 'execution') {
            const proof = result.checks.flatMap(c => c.evidence).filter(e => e.kind === 'tool').map(e => this.toolReference(e, run))
              .find(r => r.status === 'SUCCEEDED' && r.tool === 'execution.run' && r.principalId === reviewerRunId
                && r.result.cwd === obligation.path && canonical(r.result.argv) === canonical(JSON.parse(obligation.command))
                && r.result.exitCode === obligation.expectedExit);
            check(proof, 'EXECUTION_PROOF', 'Every execution obligation needs a cited independent post-candidate execution');
            this.verifyCurrentExecution(proof, artifact, run, obligation); continue;
          }
          const proof = result.checks.flatMap(c => c.evidence).filter(e => e.kind === 'tool').map(e => this.toolReference(e, run))
            .find(r => r.status === 'SUCCEEDED' && r.tool === 'workspace.read' && r.principalId === reviewerRunId && r.result.path === obligation.path);
          check(proof, 'MISSING_EFFECT_PROOF', 'Each required file needs a cited independent current-state read');
          this.verifyCurrentRead(proof, artifact, run);
        }
        check(!artifact.payload.provisional, 'PROVISIONAL', 'Provisional exploration cannot be accepted as a final foundation');
        check(result.checks.every(c => c.verdict === 'PASS') && !result.findings.some(f => f.severity === 'material'), 'FAILED_GATE', 'An acceptance cannot override failed, unknown or material obligations');
        for (const ref of artifact.payload.inputRefs) this.assertUsable(ref.artifactId, {missionId: artifact.missionId, purpose: ref.purpose});
        this.validateClaims(artifact.payload.claims, artifact.missionId, artifact.payload.inputRefs);
        if(!documentary)for (const claim of artifact.payload.claims) for (const ref of claim.sources)
          check(run.context.sourceIds.includes(ref.sourceId), 'UNOBSERVED_SOURCE', 'Factual acceptance requires the reviewer to receive the underlying sources');
        this.assertMaterialClaimReviewBoundary(artifact, run, result, documentary);
      }
      assertSourcedResponseReview(this,artifact,run,result);
      const acceptanceOrdinal=priorAcceptances.length+(result.decision==='ACCEPT'?1:0);
      const review = {id: id('review'), artifactId, reviewerRunId, result: clone(result), reviewedAt: this.clock(),
        reviewKind:requirement.independentAcceptances>1&&priorAcceptances.length>0?'adversarial':'independent',acceptanceOrdinal,
        ...(documentary?{documentary:clone(documentary)}:{})};
      this.store.put('review', review.id, review, {expectedVersion: 0});
      const reviewDependencies = result.decision === 'ACCEPT' ? result.checks.flatMap(c => c.evidence).filter(e => e.kind === 'source' || e.id !== artifactId) : [];
      const accepted=result.decision==='ACCEPT'&&acceptanceOrdinal>=requirement.independentAcceptances;
      const data = {...artifact, status: result.decision==='ACCEPT'?(accepted?'ACCEPTED':'CANDIDATE'):'RETURNED',reviews:[...artifact.reviews,review.id],
        reviewRequirement:clone(requirement),reviewDependencies:clone(reviewDependencies)};
      this.store.put('artifact', artifactId, data, {expectedVersion: record.version}); return data;
    });
  }
  certifyAdaptiveV3Closed(artifactId) {
    // Certification is performed atomically by FactoryEngine before the
    // accepted record exists.  This public method is intentionally read-only:
    // it can revalidate a completed certificate but cannot promote a candidate.
    return this.#withSequenceIndex(() => assertAdaptiveV3ClosedEvidence(this, artifactId));
  }
  assertUsable(artifactId, scope, visited = new Set()) {
    return this.#withSequenceIndex(()=>this.#assertUsable(artifactId,scope,visited));
  }
  #assertUsable(artifactId, {missionId, purpose}, visited) {
    check(!visited.has(artifactId), 'LINEAGE_CYCLE', 'Material dependency cycle'); visited.add(artifactId);
    const artifact = this.store.get('artifact', artifactId)?.data;
    // Missing input and a detached record key are different failures.  Do not
    // call an absent record an identity mismatch: consumers need to distinguish
    // a normal unavailable dependency from an attempt to redirect a durable
    // record through a mutable payload id.
    check(artifact,'UNACCEPTED_INPUT','A material consumer requires accepted input for this mission and purpose');
    check(artifact.id===artifactId,'ARTIFACT_IDENTITY','Artifact record key and payload identity differ');
    check(artifact.missionId === missionId && artifact.status === 'ACCEPTED' && artifact.payload.purpose === purpose,
      'UNACCEPTED_INPUT', 'A material consumer requires accepted input for this mission and purpose');
    check(!artifact.payload.provisional && artifact.payloadHash === sha256(artifact.payload), 'ARTIFACT_INTEGRITY', 'Product is provisional or altered');
    if (isAdaptiveV3DirectMission(this, missionId)) {
      try {
        check(isAdaptiveV3ClosedArtifact(artifact), ADAPTIVE_V3_DIRECT_ENTRY_INTEGRITY,
          'A direct adaptive-v3 mission cannot consume an ordinary or alternate artifact');
        assertAdaptiveV3ClosedEvidence(this, artifactId);
        return artifact;
      } finally { visited.delete(artifactId); }
    }
    const adaptiveV3Reserved = artifact.payload?.purpose === ADAPTIVE_V3_DIRECT_ENTRY_PURPOSE
      || artifact.payload?.nodeId === ADAPTIVE_V3_DIRECT_ENTRY_NODE;
    if (adaptiveV3Reserved) {
      try {
        check(isAdaptiveV3ClosedArtifact(artifact), ADAPTIVE_V3_DIRECT_ENTRY_INTEGRITY,
          'A malformed adaptive-v3 reservation cannot enter the ordinary acceptance path');
        // This validates mission@1, the signed route, producer, signed origin,
        // candidate v1, certification, materialization, absence of model/tool
        // work, and the exact durable journal ordering.  It intentionally does
        // not fabricate a reviewer or a semantic judgment.
        assertAdaptiveV3ClosedEvidence(this, artifactId);
        return artifact;
      } finally { visited.delete(artifactId); }
    }
    if(artifact.payload.kind===BLIND_MATERIAL_KIND)blindMaterialEvidence(this,artifactId);
    if(isBlindComparison(artifact))blindComparisonEvidence(this,artifactId);
    if(isInputCopyArtifact(artifact))inputCopyEvidence(this,artifactId);
    // A malformed/empty review history is an absent acceptance, not a route
    // to call Store.get with an invalid identifier. Keep the failure at the
    // public artifact-integrity boundary so callers (including reports) can
    // fail closed without exposing a raw candidate as a final delivery.
    const latestReviewId=Array.isArray(artifact.reviews)?artifact.reviews.at(-1):null;
    const review=typeof latestReviewId==='string'?this.store.get('review',latestReviewId)?.data:null;
    check(review && review.artifactId === artifactId && review.result.decision === 'ACCEPT' && review.result.artifactHash === artifact.payloadHash
      && review.result.purpose === purpose, 'ACCEPTANCE_MISSING', 'Accepted state requires its exact independent review record');
    const requirement=reviewRequirementForArtifact(this,artifact);
    const acceptedReviews=reviewRecordsForArtifact(this,artifact).filter(candidate=>candidate.result.decision==='ACCEPT');
    check(acceptedReviews.length>=requirement.independentAcceptances,'ACCEPTANCE_QUORUM',
      'Mission risk requires more independently accepting reviews before this product is usable');
    const acceptingRuns=[];
    for(const [index,acceptedReview] of acceptedReviews.entries()){
      if(requirement.independentAcceptances>1)check(acceptedReview.reviewKind===(index===0?'independent':'adversarial'),
        'ACCEPTANCE_QUORUM','Elevated-risk acceptance history lacks the required independent/adversarial phases');
      const acceptingRun=this.store.get('run',acceptedReview.reviewerRunId)?.data;
      check(acceptingRun&&acceptingRun.mode==='reviewer'&&acceptingRun.missionId===missionId,'REVIEW_IDENTITY','Accepting reviewer is missing or outside this mission');
      assertIndependentReviewer(this,artifact,acceptingRun,acceptingRuns);acceptingRuns.push(acceptingRun);
      for(const evidence of acceptedReview.result.checks.flatMap(checkResult=>checkResult.evidence).filter(evidence=>evidence.kind==='source'))
        this.sourceReference({sourceId:evidence.id,hash:evidence.hash,quote:evidence.quote},missionId);
    }
    check(acceptedReviews.at(-1)?.id===review.id,'ACCEPTANCE_MISSING','Latest accepted review differs from the terminal review record');
    const producer=this.store.get('run',artifact.payload.producerRunId)?.data,reviewer=acceptingRuns.at(-1);
    assertSourcedResponseReview(this,artifact,reviewer,review.result);
    this.assertMaterialClaimReviewBoundary(artifact, reviewer, review.result, review.documentary ?? null);
    verifyInputFileProofs(this,artifact,reviewer,review.result);
    if(artifact.payload.documentary)validateDocumentClaims(this,producer,artifact.payload.claims,artifact.payload.documentary);
    else if(producer)check(!documentaryRun(this.store,producer),'DOCUMENT_EVIDENCE','Documentary candidate lost its frozen material binding');
    if(review.documentary)validateDocumentReview(this,reviewer,review.result,artifact,review.documentary);
    else if(reviewer)check(!documentaryRun(this.store,reviewer),'DOCUMENT_EVIDENCE','Documentary acceptance lost its own frozen material binding');
    for (const claim of artifact.payload.claims) {
      if (claim.validUntil !== null) check(instant(claim.validUntil) > instant(this.clock()), 'STALE_CLAIM', 'Accepted claim has expired');
      claim.sources.forEach(ref => this.sourceReference(ref, missionId));
    }
    for (const ref of artifact.payload.inputRefs) {
      const parent = this.assertUsable(ref.artifactId, {missionId, purpose: ref.purpose}, visited);
      check(parent.payloadHash === ref.hash, 'INPUT_VERSION', 'Parent product differs from accepted version');
    }
    for (const proof of artifact.reviewDependencies ?? []) {
      if (proof.kind === 'source') this.sourceReference({sourceId: proof.id, hash: proof.hash, quote: proof.quote}, missionId);
      else if (proof.kind === 'control') this.controlReference(proof, artifact, review);
      else if (proof.kind === 'tool'||proof.kind==='tool-history') this.toolReference(proof, this.store.get('run', review.reviewerRunId).data, {requireAdmittedSources: true});
      else if (proof.kind === 'runtime') this.runtimeReference(proof,this.store.get('run',review.reviewerRunId).data);
      else {
        const cited = this.store.get('artifact', proof.id)?.data;
        check(cited && cited.payloadHash === proof.hash, 'REVIEW_EVIDENCE', 'Acceptance proof is missing or changed');
        this.assertUsable(proof.id, {missionId, purpose: cited.payload.purpose}, visited);
      }
    }
    visited.delete(artifactId); return artifact;
  }
  retractSource(sourceId, reason) {
    string(reason, 'retraction reason');
    return this.store.transact(() => {
      const record = this.store.get('source', sourceId); check(record, 'NOT_FOUND', 'Source does not exist');
      this.store.put('source', sourceId, {...record.data, status: 'RETRACTED', revokedAt: this.clock(), reason}, {expectedVersion: record.version});
      const reviewedSource=a=>(a.data.reviews??[]).some(reviewId=>this.store.get('review',reviewId)?.data?.result?.checks
        ?.some(checkResult=>checkResult.evidence?.some(evidence=>evidence.kind==='source'&&evidence.id===sourceId)));
      const affected = this.store.list('artifact').filter(a => a.data.payload.claims.some(c => c.sources.some(s => s.sourceId === sourceId))||reviewedSource(a)
        || a.data.reviewDependencies?.some(e => (e.kind === 'source' && e.id === sourceId)
          || (e.kind === 'tool' && e.id === record.data.receiptId && e.hash === record.data.receiptHash))).map(a => a.id);
      return this.invalidate(affected, {kind: 'source-retraction', sourceId, reason});
    });
  }
  invalidate(artifactIds, reason) {
    return this.store.transact(() => {
      const queue = [...artifactIds], affected = new Set(), all = this.store.list('artifact');
      while (queue.length) {
        const artifactId = queue.shift(); if (affected.has(artifactId)) continue;
        const record = this.store.get('artifact', artifactId); check(record, 'NOT_FOUND', 'Invalidation target does not exist'); affected.add(artifactId);
        if (record.data.status !== 'INVALIDATED') this.store.put('artifact', artifactId, {...record.data, status: 'INVALIDATED', invalidation: {reason: clone(reason), at: this.clock()}}, {expectedVersion: record.version});
        for (const child of all) if (child.data.payload.inputRefs.some(r => r.artifactId === artifactId)
          || child.data.reviewDependencies?.some(e => e.kind === 'artifact' && e.id === artifactId)) queue.push(child.id);
      }
      this.store.append('artifact.invalidation', {affected: [...affected], reason: clone(reason)}); return [...affected];
    });
  }
}

/**
 * Require the private brand of an actual ArtifactRegistry, optionally bound to
 * one exact Store. Structural objects and proxies cannot supply that brand.
 */
export function assertGenuineArtifactRegistry(registry, options = {}) {
  return ArtifactRegistry.assertGenuine(registry, options);
}
