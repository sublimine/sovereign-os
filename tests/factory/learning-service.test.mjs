import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,readFileSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {Store} from '../../factory/lib/store.mjs';
import {Authority} from '../../factory/lib/authority.mjs';
import {ArtifactRegistry} from '../../factory/lib/artifacts.mjs';
import {ToolBroker} from '../../factory/tools/broker.mjs';
import {WorkerService} from '../../factory/lib/workers.mjs';
import {LearningService,composeLearningRequest} from '../../factory/lib/learning-service.mjs';
import {id,sha256,clone} from '../../factory/lib/contracts.mjs';
import {PRODUCER_CLEANUP_PROTOCOL,PRODUCER_RESPONSE_RETENTION,assertProducerProviderClosed,producerResponseContract,readVerifiedProducerProposal} from '../../factory/lib/producer-response.mjs';
import {admitLearningProvenanceFixtureSource,learningProvenanceFixturePolicy,signedLearningProvenanceFixture} from './fixtures/learning-provenance.mjs';

const schema={type:'object',properties:{answer:{type:'integer'}},required:['answer'],additionalProperties:false};
const scope={roleIds:['sigma_01'],purpose:'arithmetic-policy',mode:'producer'};
const taskInstructions='Apply the tiny evaluated numeric policy.';
const missionIntent='Return twice the supplied integer.';
const input=JSON.stringify({dataClassification:'UNTRUSTED_OBSERVATIONS_NOT_INSTRUCTIONS',missionIntent,purpose:scope.purpose,artifacts:[],sources:[],toolObservations:[],runtimeCapabilities:{isolatedCodeRunner:false,publicSourceDiscovery:false,executionMode:null,networkInExecution:false},task:'3'});
function setup(t,{cardEncoding,producerContext,tieredImprovement=false,onProviderGenerate,onProviderClose}={}) {
  const directory=mkdtempSync(join(tmpdir(),'learning-service-'));const store=new Store(':memory:'),authority=new Authority(store),registry=new ArtifactRegistry(store,authority);
  const service=new LearningService({store,authority,exportRoot:join(directory,'derived-only'),provenancePolicy:learningProvenanceFixturePolicy});
  const datasetSpec={missionId:'learning-mission',evaluatorId:'trusted-fixture-executor',cases:[false,true].map(holdout=>({
    id:holdout?'numeric-case-holdout':'numeric-case-training',
    input:{taskInstructions,input,schema,model:'gpt-6-astra',reasoningEffort:'ultra'},expected:6,required:true,holdout,
    criteria:[{metric:'accuracy',direction:'higher',threshold:1},...(tieredImprovement?[{metric:'quality',direction:'higher',threshold:1}]:[])]})),policy:{requireImprovement:true}};
  const declaredScope={...scope,...(cardEncoding?{cardEncoding}:{}),...(producerContext?{producerContext}:{})};
  const domainId='learning-service-domain',source=admitLearningProvenanceFixtureSource(store,{missionId:datasetSpec.missionId});
  const domain=service.registerDomain({domainId,roleId:'sigma_01',datasetSpec,scope:declaredScope,
    provenance:signedLearningProvenanceFixture({service,domainId,roleId:'sigma_01',datasetSpec,scope:declaredScope,source})});
  const policyId=domain.policyId,baseline=domain.baseline;
  const candidate=service.propose({roleId:policyId,parentHash:baseline.hash,instructions:'NUMERIC_POLICY: double',rationale:'Measured numeric transform for this bounded test, not model training.',authorRunId:'author'});
  const lease=authority.issue({missionId:'learning-mission',principalId:'owner',actions:['instructions.promote','instructions.rollback','instructions.export'],resources:[`role:${policyId}`],expiresAt:new Date(Date.now()+3600000).toISOString()});
  const executed=[];
  const runCase=async request=>{
    executed.push(request);
    // Deterministic fixture executor: no model, no claimed generalization.
    const n=Number(JSON.parse(request.effectiveRequest.input).task);
    const answer=request.effectivePrefix.includes('NUMERIC_POLICY: double')?n*2:n;
    const quality=request.effectivePrefix.includes('QUALITY_TIER: two')?2:request.effectivePrefix.includes('NUMERIC_POLICY: double')?1:0;
    const observations={outcome:answer===request.case.expected?'pass':'fail',metrics:{accuracy:answer===request.case.expected?1:0,...(tieredImprovement?{quality}:{})},actual:{answer,executionContext:request.executionContext}};
    const {evaluationId,datasetHash,caseId,caseHash,roleId,instructionHash,variant,evaluatorId}=request;
    return {observations,receipt:authority.seal('evaluation.case',{evaluationId,datasetHash,caseId,caseHash,roleId,instructionHash,variant,evaluatorId,evaluatorRunId:'independent-executor',executionId:id('execution'),observationsHash:sha256(observations)})};
  };
  store.put('mission','live-mission',{intent:missionIntent,intentHash:sha256(missionIntent),policy:{allowedTools:[],model:'gpt-6-astra',reasoningEffort:'ultra',...(cardEncoding?{cardEncoding}:{}),...(producerContext?{producerContext}:{})}},{expectedVersion:0});
  const broker=new ToolBroker({store,authority,workspaceRoot:join(directory,'workspaces')});broker.registerWorkspace('live-mission');
  const inferred=[],returnedReceipts=[];
  const workers=new WorkerService({store,authority,registry,broker,learningInstructionsResolver:service.resolver(),providerFactory:()=>({async generate(request){await onProviderGenerate?.({store,request});inferred.push(request);const value={answer:6};await request.validate(value);const receipt={kind:'inference',simulation:true,status:'completed',threadId:id('sim-thread'),turnId:id('sim-turn'),contextHash:sha256(JSON.stringify({instructions:request.instructions,input:request.input,schema:request.schema,model:request.model,reasoningEffort:request.reasoningEffort}))};returnedReceipts.push(clone(receipt));return {value,receipt};},async close(){return await onProviderClose?.();}})});
  const newRun=()=>workers.createRun({missionId:'live-mission',nodeId:'different-runtime-node',purpose:scope.purpose,mode:scope.mode,roleIds:scope.roleIds});
  t.after(()=>{store.close();rmSync(directory,{recursive:true,force:true});});
  return {directory,store,authority,registry,service,domain,policyId,source,baseline,candidate,lease,runCase,executed,workers,inferred,returnedReceipts,newRun};
}
function protectedProducerInference(f){
  const run=f.newRun(),node={id:'different-runtime-node',purpose:scope.purpose},producerInput=JSON.stringify({node,inputRefs:[],step:0,feedback:[],corrections:[]});
  f.store.put('worker-production',run.id,{status:'running',step:0,responseRetention:PRODUCER_RESPONSE_RETENTION,
    cleanupProtocol:PRODUCER_CLEANUP_PROTOCOL,contractHash:producerResponseContract({missionId:'live-mission',node,inputRefs:[]})},{expectedVersion:0});
  return {run,node,args:{runId:run.id,producerStep:0,instructions:taskInstructions,input:producerInput,schema,validate:v=>v.answer===6}};
}
async function failProposalWriteAfterAttach(f,{run,args},{expectedCode='SYNTHETIC_POST_ATTACH'}={}){
  const put=f.store.put.bind(f.store);let injected=false,sawAttached=false;
  f.store.put=(type,...rest)=>{
    const record=put(type,...rest);
    if(!injected&&type==='worker-proposal'){
      injected=true;const durable=f.store.get('run',run.id);
      sawAttached=!!durable?.data.inferenceReceipt&&durable.data.expectedRequestHash===null&&f.store.list('learning-dispatch-completion').length===1;
      throw Object.assign(Error('Controlled failure after attachInference and before outer proposal commit'),{code:'SYNTHETIC_POST_ATTACH'});
    }
    return record;
  };
  try{await assert.rejects(f.workers.infer(args),{code:expectedCode});}finally{f.store.put=put;}
  assert.equal(injected,true,'The test must fail at the outer proposal write');
  assert.equal(sawAttached,true,'The injected failure must observe the nested attachInference before outer rollback');
}
test('evaluated and live worker instruction/request bytes match; proposal inactive and existing runs stay frozen',async t=>{
  const f=setup(t),before=f.newRun();assert.equal(f.service.resolve(f.policyId,scope),null);
  assert.equal(f.store.get('worker-config',before.id).data.learnedInstructionVersions.length,0);
  assert.equal(f.store.get('worker-config',before.id).data.learningDisposition.status,'NO_MATCHING_OVERLAY');
  await f.service.evaluate(f.candidate.candidateId,{runCase:f.runCase});
  assert.equal(f.service.resolve(f.policyId,scope),null);
  f.service.promote(f.candidate.candidateId,{lease:f.lease,principalId:'owner'});
  assert.throws(()=>f.service.resolve(f.policyId,{...scope,contextEncoding:'source-text-v1'}),{code:'LEARNING_SCOPE'},'Prior overlays are not qualified for the literal-view scope');
  const after=f.newRun();assert.equal(f.store.get('worker-config',after.id).data.learnedInstructionVersions[0].hash,f.candidate.instructionHash);
  assert.deepEqual(f.store.get('worker-config',after.id).data.learningDisposition,
    {schema:'sovereign.learning-selection.v1',status:'OVERLAY_FROZEN',exclusions:[],resolverCalls:1});
  assert.equal(f.store.get('worker-config',before.id).data.learningDisposition.status,'NO_MATCHING_OVERLAY','Promotion never backdates the earlier selection');
  for(const r of [before,after])await f.workers.infer({runId:r.id,instructions:taskInstructions,input:'3',schema,validate:v=>v.answer===6});
  assert.equal(f.inferred[0].instructions,f.executed[0].effectiveInstructions);
  assert.equal(f.inferred[1].instructions,f.executed[1].effectiveInstructions);
  assert.equal(f.inferred[1].input,f.executed[1].effectiveRequest.input);
  const request=f.inferred[1];const fullHash=sha256(JSON.stringify({instructions:request.instructions,input:request.input,schema:request.schema,model:request.model,reasoningEffort:request.reasoningEffort}));
  assert.equal(fullHash,f.executed[1].executionContext.requestHash);
  const frozen=f.newRun(),frozenConfig=clone(f.store.get('worker-config',frozen.id).data);
  f.service.rollback({roleId:f.policyId,targetHash:f.baseline.hash,lease:f.lease,principalId:'owner',reason:'Restore baseline.'});
  assert.equal(f.service.resolve(f.policyId,scope),null);
  assert.equal(f.store.get('worker-config',after.id).data.learnedInstructionVersions[0].hash,f.candidate.instructionHash);
  const requestCount=f.store.list('inference-request').length,authorizationCount=f.store.list('learning-dispatch-authorization').length;
  await assert.rejects(f.workers.infer({runId:frozen.id,instructions:taskInstructions,input:'3',schema,validate:v=>v.answer===6}),{code:'LEARNING_REVOKED'});
  assert.equal(f.inferred.length,2,'A baseline rollback blocks the frozen overlay before a provider call');
  assert.equal(f.store.list('inference-request').length,requestCount,'A blocked frozen run leaves no prospective request');
  assert.equal(f.store.list('learning-dispatch-authorization').length,authorizationCount,'A blocked frozen run leaves no dispatch authorization');
  assert.deepEqual(f.store.get('worker-config',frozen.id).data,frozenConfig,'Rollback never rewrites the old worker configuration');
});
test('activation and dispatch receipts bind the exact committed overlay before the provider runs',async t=>{
  let visibleAtProvider=null;
  const f=setup(t,{onProviderGenerate:({store})=>{visibleAtProvider=store.list('learning-dispatch-authorization');}});
  await f.service.evaluate(f.candidate.candidateId,{runCase:f.runCase});
  f.service.promote(f.candidate.candidateId,{lease:f.lease,principalId:'owner'});
  const role=f.store.get('learning-role',f.policyId),activation=f.store.get('learning-activation',role.data.activeActivationId),binding=f.store.get('learning-activation-binding',role.data.activeActivationId);
  const {receipt:activationReceipt,...activationPayload}=activation.data;
  assert.equal(f.store.db.prepare('PRAGMA user_version').get().user_version,14,'Activation raises the guarded storage protocol atomically');
  assert.deepEqual(f.authority.open(activationReceipt,'learning.activation'),activationPayload);
  assert.equal(binding.data.roleId,f.policyId);assert.equal(binding.data.roleVersion,role.version);assert.equal(binding.data.roleHash,role.hash);
  const run=f.newRun();await f.workers.infer({runId:run.id,instructions:taskInstructions,input:'3',schema,validate:v=>v.answer===6});
  const [dispatch]=f.store.list('learning-dispatch-authorization');
  const {receipt:dispatchReceipt,...dispatchPayload}=dispatch.data;
  assert.equal(visibleAtProvider?.length,1,'The durable authorization is visible before provider entry');
  assert.equal(visibleAtProvider[0].hash,dispatch.hash);
  assert.deepEqual(f.authority.open(dispatchReceipt,'learning.dispatch-authorization'),dispatchPayload);
  assert.equal(dispatch.data.activationId,activation.id);
  assert.deepEqual(dispatch.data.activationRef,{type:activation.type,id:activation.id,version:activation.version,hash:activation.hash});
  assert.deepEqual(dispatch.data.activationBindingRef,{type:binding.type,id:binding.id,version:binding.version,hash:binding.hash});
  assert.equal(dispatch.data.runRef.id,run.id);assert.equal(dispatch.data.workerConfigRef.id,run.id);
  const retained=f.store.get(dispatch.data.inferenceRequestRef.type,dispatch.data.inferenceRequestRef.id);
  assert.equal(retained.data.requestHash,dispatch.data.requestHash);
  const [completion]=f.store.list('learning-dispatch-completion');
  const {receipt:completionReceipt,...completionPayload}=completion.data;
  assert.deepEqual(f.authority.open(completionReceipt,'learning.dispatch-completion'),completionPayload);
  assert.deepEqual(completion.data.authorizationRef,{type:dispatch.type,id:dispatch.id,version:dispatch.version,hash:dispatch.hash});
  const pendingRun=f.store.get(completion.data.runRef.type,completion.data.runRef.id,completion.data.runRef.version);
  assert.equal(pendingRun.hash,completion.data.runRef.hash,'Completion binds the exact pending run head, not a later mutable head');
  assert.equal(completion.data.receiptHash,sha256(f.store.get('run',run.id).data.inferenceReceipt));
  assert.throws(()=>f.registry.attachInference(run.id,{status:'completed',simulation:true,threadId:id('replay-thread'),turnId:id('replay-turn'),contextHash:dispatch.data.requestHash}),
    {code:'LEARNING_DISPATCH_AUTHORIZATION'},'A consumed authorization cannot be replayed through the raw registry');
  assert.equal(f.store.list('learning-dispatch-completion').length,1);
});
test('raw registry cannot stage or attach a learned inference without the private worker handoff',async t=>{
  const f=setup(t);
  await f.service.evaluate(f.candidate.candidateId,{runCase:f.runCase});f.service.promote(f.candidate.candidateId,{lease:f.lease,principalId:'owner'});
  const run=f.newRun(),config=f.store.get('worker-config',run.id).data;
  const {request}=composeLearningRequest({prefix:config.instructions,taskInstructions,input:'{}',schema,model:'gpt-6-astra',reasoningEffort:'ultra'});
  assert.throws(()=>f.registry.recordInferenceRequest(run.id,request),{code:'LEARNING_DISPATCH_AUTHORIZATION'});
  const fakeAuthorizationId=id('learning-dispatch-authorization');
  assert.throws(()=>f.registry.recordInferenceRequest(run.id,request,{learningDispatchAuthorizationId:fakeAuthorizationId,learningDispatchPreflight:{}}),
    {code:'LEARNING_DISPATCH_CONTROL'},'Knowing an authorization-shaped ID cannot retain a learned request or consume budget');
  assert.equal(f.store.list('inference-request').length,0,'The rejected direct path leaves no retained request');
  const durable=f.store.get('run',run.id);
  assert.equal(durable.data.expectedRequestHash,undefined);assert.equal(durable.data.pendingLearningDispatchAuthorizationId,undefined);
  assert.throws(()=>f.registry.attachInference(run.id,{status:'completed',simulation:true,threadId:id('raw-thread'),turnId:id('raw-turn'),contextHash:'0'.repeat(64)}),
    {code:'LEARNING_DISPATCH_AUTHORIZATION'});
  assert.equal(f.store.list('learning-dispatch-completion').length,0,'A direct caller cannot manufacture a learned completion');
});
test('a learned run keeps its creation-time trusted provider factory',async t=>{
  const f=setup(t);
  await f.service.evaluate(f.candidate.candidateId,{runCase:f.runCase});f.service.promote(f.candidate.candidateId,{lease:f.lease,principalId:'owner'});
  const run=f.newRun();let replacementCalls=0;
  f.workers.providerFactory=()=>{replacementCalls++;throw Error('Later public provider replacement must not serve a learned run');};
  await f.workers.infer({runId:run.id,instructions:taskInstructions,input:'3',schema,validate:v=>v.answer===6});
  assert.equal(replacementCalls,0);
  assert.equal(f.inferred.length,1);
  assert.equal(f.store.list('learning-dispatch-completion').length,1);
});
test('a pending learned marker fails closed if a later configuration head removes the overlay',async t=>{
  let enteredResolve,release;const entered=new Promise(resolve=>{enteredResolve=resolve;}),gate=new Promise(resolve=>{release=resolve;});
  t.after(()=>release?.());
  const f=setup(t,{onProviderGenerate:async()=>{enteredResolve();await gate;}});
  await f.service.evaluate(f.candidate.candidateId,{runCase:f.runCase});f.service.promote(f.candidate.candidateId,{lease:f.lease,principalId:'owner'});
  const run=f.newRun(),inFlight=f.workers.infer({runId:run.id,instructions:taskInstructions,input:'3',schema,validate:v=>v.answer===6});
  await entered;
  const config=f.store.get('worker-config',run.id);
  f.store.put('worker-config',run.id,{...config.data,learnedInstructionVersions:[]},{expectedVersion:config.version});
  const pending=f.store.get('run',run.id);
  assert.throws(()=>f.registry.attachInference(run.id,{status:'completed',simulation:true,threadId:id('tampered-thread'),turnId:id('tampered-turn'),contextHash:pending.data.expectedRequestHash}),
    {code:'LEARNING_DISPATCH_AUTHORIZATION'});
  assert.equal(f.store.list('learning-dispatch-completion').length,0);
  release();await assert.rejects(inFlight,{code:'LEARNING_DISPATCH_CONTROL'});
  assert.equal(f.store.get('run',run.id).data.inferenceReceipt,undefined);
});
test('an immutable learned-worker origin survives configuration replacement before and after a completion',async t=>{
  const before=setup(t);
  await before.service.evaluate(before.candidate.candidateId,{runCase:before.runCase});before.service.promote(before.candidate.candidateId,{lease:before.lease,principalId:'owner'});
  const unopened=before.newRun(),initialConfig=before.store.get('worker-config',unopened.id);
  before.store.put('worker-config',unopened.id,{...initialConfig.data,learnedInstructionVersions:[]},{expectedVersion:initialConfig.version});
  await assert.rejects(before.workers.infer({runId:unopened.id,instructions:taskInstructions,input:'3',schema,validate:v=>v.answer===6}),
    {code:'LEARNING_DISPATCH_AUTHORIZATION'});
  assert.equal(before.inferred.length,0);assert.equal(before.store.list('inference-request').length,0);assert.equal(before.store.list('learning-dispatch-authorization').length,0);

  const after=setup(t);
  await after.service.evaluate(after.candidate.candidateId,{runCase:after.runCase});after.service.promote(after.candidate.candidateId,{lease:after.lease,principalId:'owner'});
  const completed=after.newRun();await after.workers.infer({runId:completed.id,instructions:taskInstructions,input:'3',schema,validate:v=>v.answer===6});
  const completedConfig=after.store.get('worker-config',completed.id),beforeRequests=after.store.list('inference-request').length,beforeDispatches=after.store.list('learning-dispatch-authorization').length;
  after.store.put('worker-config',completed.id,{...completedConfig.data,learnedInstructionVersions:[]},{expectedVersion:completedConfig.version});
  const raw={instructions:'untrusted direct request',input:'{}',schema,model:'gpt-6-astra',reasoningEffort:'ultra'};
  assert.throws(()=>after.registry.recordInferenceRequest(completed.id,raw),{code:'LEARNING_DISPATCH_AUTHORIZATION'});
  assert.throws(()=>after.registry.attachInference(completed.id,{status:'completed',simulation:true,threadId:id('after-config-thread'),turnId:id('after-config-turn'),contextHash:'0'.repeat(64)}),
    {code:'LEARNING_DISPATCH_AUTHORIZATION'});
  assert.equal(after.store.list('inference-request').length,beforeRequests);assert.equal(after.store.list('learning-dispatch-authorization').length,beforeDispatches);
  assert.equal(after.store.get('run',completed.id).data.inferenceReceipts.length,1,'Configuration replacement cannot turn a learned run into an ordinary repeatable one');
});
test('a learned dispatch is single-flight, then each completed call consumes a distinct authorization',async t=>{
  let enteredResolve,release;const entered=new Promise(resolve=>{enteredResolve=resolve;}),gate=new Promise(resolve=>{release=resolve;});
  t.after(()=>release?.());
  const f=setup(t,{onProviderGenerate:async()=>{enteredResolve();await gate;}});
  await f.service.evaluate(f.candidate.candidateId,{runCase:f.runCase});f.service.promote(f.candidate.candidateId,{lease:f.lease,principalId:'owner'});
  const run=f.newRun(),first=f.workers.infer({runId:run.id,instructions:taskInstructions,input:'3',schema,validate:v=>v.answer===6});
  await entered;
  const pending=f.store.get('run',run.id),[authorization]=f.store.list('learning-dispatch-authorization');
  assert.throws(()=>f.registry.attachInference(run.id,{status:'completed',simulation:true,threadId:id('forged-thread'),turnId:id('forged-turn'),contextHash:pending.data.expectedRequestHash}),
    {code:'LEARNING_PROVIDER_ATTESTATION'},'A real signed authorization still cannot be completed with a fabricated local receipt');
  assert.equal(f.store.get('run',run.id).version,pending.version,'The forged receipt leaves the authorized pending run untouched');
  assert.equal(f.store.list('learning-dispatch-completion').length,0);
  assert.equal(authorization.data.runRef.hash,pending.hash);
  await assert.rejects(f.workers.infer({runId:run.id,instructions:taskInstructions,input:'3',schema,validate:v=>v.answer===6}),{code:'INFERENCE_PENDING'});
  release();await first;
  assert.equal(f.inferred.length,1);assert.equal(f.store.list('learning-dispatch-authorization').length,1);assert.equal(f.store.list('learning-dispatch-completion').length,1);
  await f.workers.infer({runId:run.id,instructions:taskInstructions,input:'3',schema,validate:v=>v.answer===6});
  const dispatches=f.store.list('learning-dispatch-authorization'),completions=f.store.list('learning-dispatch-completion');
  assert.equal(f.inferred.length,2);assert.equal(dispatches.length,2);assert.equal(completions.length,2);
  assert.notEqual(dispatches[0].id,dispatches[1].id,'Every physical provider attempt gets a distinct authorization');
  assert.notEqual(completions[0].data.authorizationId,completions[1].data.authorizationId);
});
test('a learned producer receipt survives an outer post-attach rollback and retains exactly once on its exact retry',async t=>{
  const f=setup(t);await f.service.evaluate(f.candidate.candidateId,{runCase:f.runCase});f.service.promote(f.candidate.candidateId,{lease:f.lease,principalId:'owner'});
  const protectedCall=protectedProducerInference(f);await failProposalWriteAfterAttach(f,protectedCall);
  const pending=f.store.get('run',protectedCall.run.id);
  assert.equal(f.inferred.length,1,'The provider returned once before the outer retention rollback');
  assert.equal(f.store.list('learning-dispatch-completion').length,0,'The nested completion was rolled back with the proposal');
  assert.equal(f.store.get('worker-proposal',`${protectedCall.run.id}:proposal:0`),null);
  assert.equal(typeof pending.data.pendingLearningDispatchAuthorizationId,'string');
  const priorCleanup=f.store.get('producer-cleanup',`${protectedCall.run.id}:cleanup:0`);
  assert.equal(priorCleanup.version,1);assert.equal(priorCleanup.data.proposalRecord,null,'The first close record must honestly describe the rolled-back outer proposal');

  const changedRoute={...protectedCall.args,producerStep:1},changedInput={...protectedCall.args,input:JSON.stringify({...JSON.parse(protectedCall.args.input),step:1})};
  await assert.rejects(f.workers.infer(changedRoute),{code:'LEARNING_PROVIDER_ATTESTATION'});
  await assert.rejects(f.workers.infer(changedInput),{code:'LEARNING_PROVIDER_ATTESTATION'});
  assert.equal(f.inferred.length,1,'A route or request mismatch cannot purchase another provider call');
  assert.equal(f.store.list('learning-dispatch-completion').length,0);

  const retries=await Promise.allSettled([f.workers.infer(protectedCall.args),f.workers.infer(protectedCall.args)]),recovered=retries.find(result=>result.status==='fulfilled')?.value;
  assert.equal(retries.filter(result=>result.status==='fulfilled').length,2,'Concurrent exact retries coalesce onto the same verified durable result');
  assert.equal(retries.filter(result=>result.status==='rejected').length,0);
  const durable=f.store.get('run',protectedCall.run.id),proposal=f.store.get('worker-proposal',`${protectedCall.run.id}:proposal:0`),cleanup=f.store.get('producer-cleanup',`${protectedCall.run.id}:cleanup:0`);
  assert.equal(f.inferred.length,1,'Exact recovery reuses the returned provider result instead of redispatching');
  assert.equal(f.store.list('learning-dispatch-completion').length,1);
  assert.equal(proposal.version,1);assert.equal(cleanup.version,2,'Recovery appends an honest linkage rather than overwriting its original close observation');
  assert.deepEqual(recovered.receipt,f.returnedReceipts[0]);assert.deepEqual(durable.data.inferenceReceipt,f.returnedReceipts[0]);
  assert.equal(recovered.receipt.threadId,f.returnedReceipts[0].threadId);assert.equal(recovered.receipt.turnId,f.returnedReceipts[0].turnId);
  assert.deepEqual(cleanup.data.reconciliation.priorCleanup,{type:priorCleanup.type,id:priorCleanup.id,version:priorCleanup.version,hash:priorCleanup.hash});
  assert.equal(assertProducerProviderClosed(f.registry,protectedCall.run.id).version,2);
  assert.equal(readVerifiedProducerProposal(f.registry,protectedCall.run.id).requestHash,durable.data.inferenceReceipt.contextHash);
  f.store.verifyJournal();
  const nextStep={...protectedCall.args,producerStep:1,input:JSON.stringify({...JSON.parse(protectedCall.args.input),step:1})};
  await f.workers.infer(nextStep);
  assert.equal(f.inferred.length,2,'A completed lower producer step does not block a legitimate next-step dispatch');
  assert.equal(f.store.list('learning-dispatch-completion').length,2);
});
test('a revocation or unconfirmed provider cleanup blocks a learned receipt recovery without consuming it',async t=>{
  const revoked=setup(t);await revoked.service.evaluate(revoked.candidate.candidateId,{runCase:revoked.runCase});revoked.service.promote(revoked.candidate.candidateId,{lease:revoked.lease,principalId:'owner'});
  const revokedCall=protectedProducerInference(revoked);await failProposalWriteAfterAttach(revoked,revokedCall);
  const source=revoked.store.get('source',revoked.source.id);
  revoked.store.put('source',source.id,{...source.data,status:'RETRACTED',revokedAt:'2026-09-19T00:05:00.000Z',reason:'Retraction before same-process receipt recovery.'},{expectedVersion:source.version});
  await assert.rejects(revoked.workers.infer(revokedCall.args),{code:'LEARNING_PROVENANCE_SOURCE'});
  assert.equal(revoked.inferred.length,1);assert.equal(revoked.store.list('learning-dispatch-completion').length,0);
  assert.equal(typeof revoked.store.get('run',revokedCall.run.id).data.pendingLearningDispatchAuthorizationId,'string');

  const unconfirmed=setup(t,{onProviderClose:()=>({processExitObserved:false})});await unconfirmed.service.evaluate(unconfirmed.candidate.candidateId,{runCase:unconfirmed.runCase});unconfirmed.service.promote(unconfirmed.candidate.candidateId,{lease:unconfirmed.lease,principalId:'owner'});
  const unconfirmedCall=protectedProducerInference(unconfirmed);await failProposalWriteAfterAttach(unconfirmed,unconfirmedCall,{expectedCode:'CLEANUP_UNCONFIRMED'});
  await assert.rejects(unconfirmed.workers.infer(unconfirmedCall.args),{code:'CLEANUP_UNCONFIRMED'});
  assert.equal(unconfirmed.inferred.length,1);assert.equal(unconfirmed.store.list('learning-dispatch-completion').length,0);
  assert.equal(unconfirmed.store.get('worker-proposal',`${unconfirmedCall.run.id}:proposal:0`),null);
  assert.equal(typeof unconfirmed.store.get('run',unconfirmedCall.run.id).data.pendingLearningDispatchAuthorizationId,'string');
});
test('a concurrent learned recovery revalidates a source retraction after the winner commits',async t=>{
  const f=setup(t);await f.service.evaluate(f.candidate.candidateId,{runCase:f.runCase});f.service.promote(f.candidate.candidateId,{lease:f.lease,principalId:'owner'});
  const protectedCall=protectedProducerInference(f);await failProposalWriteAfterAttach(f,protectedCall);
  let enteredResolve,release;const entered=new Promise(resolve=>{enteredResolve=resolve;}),gate=new Promise(resolve=>{release=resolve;});
  t.after(()=>release?.());
  const loser=f.workers.infer({...protectedCall.args,validate:async value=>{enteredResolve();await gate;return value.answer===6;}});
  await entered;
  const winner=await f.workers.infer(protectedCall.args);
  assert.deepEqual(winner.receipt,f.returnedReceipts[0],'The winner must retain the original exact receipt before revocation');
  assert.equal(f.store.list('learning-dispatch-completion').length,1);
  const source=f.store.get('source',f.source.id);
  f.store.put('source',source.id,{...source.data,status:'RETRACTED',revokedAt:'2026-09-19T00:06:00.000Z',reason:'Retraction after winner retention and before blocked loser continuation.'},{expectedVersion:source.version});
  release();await assert.rejects(loser,{code:'LEARNING_PROVENANCE_SOURCE'});
  assert.equal(f.inferred.length,1,'The blocked loser cannot buy a replacement provider call after revocation');
  assert.equal(f.store.list('learning-dispatch-completion').length,1,'The winner completion remains the only durable learned completion');
});
test('a replaced post-completion configuration cannot bypass a learned producer durable return',async t=>{
  const f=setup(t);await f.service.evaluate(f.candidate.candidateId,{runCase:f.runCase});f.service.promote(f.candidate.candidateId,{lease:f.lease,principalId:'owner'});
  const protectedCall=protectedProducerInference(f);await f.workers.infer(protectedCall.args);
  const config=f.store.get('worker-config',protectedCall.run.id);
  f.store.put('worker-config',config.id,{...config.data,learnedInstructionVersions:[]},{expectedVersion:config.version});
  const source=f.store.get('source',f.source.id);
  f.store.put('source',source.id,{...source.data,status:'RETRACTED',revokedAt:'2026-09-19T00:07:00.000Z',reason:'Retraction after a completed learned producer response.'},{expectedVersion:source.version});
  await assert.rejects(f.workers.infer(protectedCall.args),{code:'PRODUCER_RESPONSE_INTEGRITY'});
  assert.equal(f.inferred.length,1,'The replaced configuration cannot purchase a second provider call');
  assert.equal(f.store.list('learning-dispatch-completion').length,1,'The historical completion remains singular and cannot be replayed');
});
test('a learned response arriving after source retraction is never accepted into the run history',async t=>{
  let f;
  f=setup(t,{onProviderGenerate:({store})=>{
    const source=store.get('source',f.source.id);
    store.put('source',source.id,{...source.data,status:'RETRACTED',revokedAt:'2026-09-19T00:03:00.000Z',reason:'Retraction while the authorized provider call was in flight.'},{expectedVersion:source.version});
  }});
  await f.service.evaluate(f.candidate.candidateId,{runCase:f.runCase});f.service.promote(f.candidate.candidateId,{lease:f.lease,principalId:'owner'});
  const run=f.newRun();
  await assert.rejects(f.workers.infer({runId:run.id,instructions:taskInstructions,input:'3',schema,validate:v=>v.answer===6}),{code:'LEARNING_PROVENANCE_SOURCE'});
  assert.equal(f.inferred.length,1,'The test fixture did enter the provider once before the retraction was observed');
  const durable=f.store.get('run',run.id);
  assert.equal(durable.data.inferenceReceipt,undefined,'A response returned after revocation cannot enter durable run history');
  assert.equal(f.store.list('learning-dispatch-authorization').length,1,'Historical authorization remains auditable');
  assert.equal(f.store.list('learning-dispatch-completion').length,0,'The authorization was never consumed by an accepted receipt');
  assert.equal(typeof durable.data.pendingLearningDispatchAuthorizationId,'string','The pending state remains explicit for later reconciliation rather than being silently retried');
});
test('replacing the public resolver cannot waive trusted learned receipt revalidation',async t=>{
  let enteredResolve,release;const entered=new Promise(resolve=>{enteredResolve=resolve;}),gate=new Promise(resolve=>{release=resolve;});
  t.after(()=>release?.());
  const f=setup(t,{onProviderGenerate:async()=>{enteredResolve();await gate;}});
  await f.service.evaluate(f.candidate.candidateId,{runCase:f.runCase});f.service.promote(f.candidate.candidateId,{lease:f.lease,principalId:'owner'});
  const run=f.newRun(),inFlight=f.workers.infer({runId:run.id,instructions:taskInstructions,input:'3',schema,validate:v=>v.answer===6});
  await entered;
  const source=f.store.get('source',f.source.id);
  f.store.put('source',source.id,{...source.data,status:'RETRACTED',revokedAt:'2026-09-19T00:04:00.000Z',reason:'Retraction while the authorized provider call was in flight.'},{expectedVersion:source.version});
  f.workers.learningInstructionsResolver=Object.assign(()=>null,{validateFrozenOverlay:()=>undefined,authorizeFrozenOverlayDispatch:()=>undefined});
  release();
  await assert.rejects(inFlight,{code:'LEARNING_PROVENANCE_SOURCE'});
  const durable=f.store.get('run',run.id);
  assert.equal(durable.data.inferenceReceipt,undefined);
  assert.equal(f.store.list('learning-dispatch-completion').length,0);
});
test('evaluation rejects execution metadata not bound to the actual effective prefix',async t=>{
  const f=setup(t);
  await assert.rejects(f.service.evaluate(f.candidate.candidateId,{runCase:async request=>{const result=await f.runCase(request);result.observations.actual.executionContext.prefixHash='0'.repeat(64);return result;}}),{code:'LEARNING_EXECUTION_CONTEXT'});
  assert.throws(()=>f.service.promote(f.candidate.candidateId,{lease:f.lease,principalId:'owner'}),{code:'LEARNING_EXECUTION_CONTEXT'});
});
test('a source retracted by the first evaluation callback blocks the next dispatch and leaves no promotable prefix',async t=>{
  const f=setup(t);let calls=0;
  await assert.rejects(f.service.evaluate(f.candidate.candidateId,{runCase:async request=>{
    const result=await f.runCase(request);calls++;
    if(calls===1){
      const source=f.store.get('source',f.source.id);
      f.store.put('source',source.id,{...source.data,status:'RETRACTED',revokedAt:'2026-09-19T00:01:00.000Z',reason:'Retraction after the first callback.'},{expectedVersion:source.version});
    }
    return result;
  }}),{code:'LEARNING_PROVENANCE_SOURCE'});
  assert.equal(calls,1,'The candidate variant is never authorized after the retraction');
  const evaluation=f.store.get('learning-evaluation',f.candidate.candidateId),dispatches=f.store.list('learning-evaluation-dispatch');
  assert.equal(evaluation.version,2);assert.deepEqual(evaluation.data.status,'failed');assert.equal(evaluation.data.passed,false);assert.equal(evaluation.data.completedPairs,0);
  assert.equal(f.store.get('learning-evaluated-prefix',f.candidate.candidateId),null);
  assert.equal(dispatches.length,1);assert.equal(dispatches[0].data.status,'AUTHORIZED','The durable row records authorization, never a completed accepted evaluation');
  assert.equal(dispatches[0].data.evaluationId,evaluation.data.evaluationId);assert.equal(dispatches[0].data.caseId,'numeric-case-training');assert.equal(dispatches[0].data.variant,'baseline');
  assert.equal(dispatches[0].data.requestHash,f.executed[0].executionContext.requestHash);
  assert.throws(()=>f.service.promote(f.candidate.candidateId,{lease:f.lease,principalId:'owner'}),{code:'LEARNING_PROVENANCE_SOURCE'});
});
test('a retraction after the last callback cannot leave a completed usable evaluation',async t=>{
  const f=setup(t),evaluate=f.service.registry.evaluate.bind(f.service.registry);let calls=0;
  // The service wrapper has already accepted the callback result when this
  // wrapper retracts the source. The registry completion gate must still run
  // before its `completed` record is committed.
  f.service.registry.evaluate=async(candidateId,options)=>evaluate(candidateId,{...options,runCase:async request=>{
    const result=await options.runCase(request);calls++;
    if(calls===4){
      const source=f.store.get('source',f.source.id);
      f.store.put('source',source.id,{...source.data,status:'RETRACTED',revokedAt:'2026-09-19T00:02:00.000Z',reason:'Retraction after the final callback.'},{expectedVersion:source.version});
    }
    return result;
  }});
  await assert.rejects(f.service.evaluate(f.candidate.candidateId,{runCase:f.runCase}),{code:'LEARNING_PROVENANCE_SOURCE'});
  assert.equal(calls,4);const evaluation=f.store.get('learning-evaluation',f.candidate.candidateId);
  assert.equal(evaluation.version,2);assert.equal(evaluation.data.status,'failed');assert.equal(f.store.get('learning-evaluated-prefix',f.candidate.candidateId),null);
  assert.throws(()=>f.service.promote(f.candidate.candidateId,{lease:f.lease,principalId:'owner'}),{code:'LEARNING_PROVENANCE_SOURCE'});
});
test('compact-card learning evaluation and live selection use exactly the same prefix without promoting across representations',async t=>{
  const f=setup(t,{cardEncoding:'compact-json-v1'});await f.service.evaluate(f.candidate.candidateId,{runCase:f.runCase});f.service.promote(f.candidate.candidateId,{lease:f.lease,principalId:'owner'});
  const run=f.newRun();assert.equal(f.store.get('worker-config',run.id).data.compilationScope.cardEncoding,'compact-json-v1');
  await f.workers.infer({runId:run.id,instructions:taskInstructions,input:'3',schema,validate:v=>v.answer===6});
  assert.equal(f.inferred[0].instructions,f.executed[1].effectiveInstructions);
  assert.ok(f.service.resolve(f.policyId,{...scope,cardEncoding:'compact-json-v1'}));
  assert.throws(()=>f.service.resolve(f.policyId,scope),{code:'LEARNING_SCOPE'});
});
test('promotion is restricted to evaluated purpose/mode/facet combination, not mission ID',async t=>{
  const f=setup(t);await f.service.evaluate(f.candidate.candidateId,{runCase:f.runCase});f.service.promote(f.candidate.candidateId,{lease:f.lease,principalId:'owner'});
  assert.throws(()=>f.service.resolve(f.policyId,{...scope,purpose:'unrelated'}),{code:'LEARNING_SCOPE'});
  assert.throws(()=>f.service.resolve(f.policyId,{...scope,roleIds:['sigma_01','sigma_02']}),{code:'LEARNING_SCOPE'});
  assert.ok(f.newRun().id); // Live mission/node differ from evaluation mission.
  assert.equal(f.service.resolver()('sigma_01',{...scope,purpose:'unrelated'}),null);
  assert.equal(f.service.resolver()('sigma_01',{...scope,instructionProfile:'scoped-v1'}),null,'A new provider base cannot silently inherit a differently evaluated overlay');
  assert.equal(f.service.resolver()('sigma_01',{...scope,contextEncoding:'lossless-v1'}),null,'A different context encoding needs its own evaluated scope');
  assert.equal(f.service.resolver()('sigma_01',{...scope,contextEncoding:'lossless-json-v2'}),null,'A JSON-string transport cannot inherit an unevaluated instruction promotion');
  assert.equal(f.service.resolver()('sigma_01',{...scope,cardEncoding:'compact-json-v1'},{model:'gpt-6-astra',reasoningEffort:'ultra'}),null,'A different role representation cannot inherit an unevaluated promotion');
  assert.equal(f.service.resolver()('sigma_01',{...scope,producerContext:'node-contract-v1'},{model:'gpt-6-astra',reasoningEffort:'ultra'}),null,'A node-contract producer cannot inherit an overlay evaluated with full-plan scope');
  const unrelated=f.workers.createRun({missionId:'live-mission',nodeId:'unrelated-node',purpose:'unrelated',mode:'producer',roleIds:['sigma_01']});
  assert.deepEqual(f.store.get('worker-config',unrelated.id).data.learnedInstructionVersions,[]);
  assert.ok(!f.store.get('worker-config',unrelated.id).data.instructions.includes('NUMERIC_POLICY: double'));
});
test('node-contract prefix is evaluated exactly and cannot be promoted into full-plan or reviewer scope',async t=>{
  const f=setup(t,{producerContext:'node-contract-v1'});
  await f.service.evaluate(f.candidate.candidateId,{runCase:f.runCase});f.service.promote(f.candidate.candidateId,{lease:f.lease,principalId:'owner'});
  const r=f.newRun();await f.workers.infer({runId:r.id,instructions:taskInstructions,input:'3',schema,validate:v=>v.answer===6});
  assert.equal(f.inferred[0].instructions,f.executed[1].effectiveInstructions);
  assert.equal(f.store.get('worker-config',r.id).data.compilationScope.producerContext,'node-contract-v1');
  assert.throws(()=>f.service.resolve(f.policyId,scope),{code:'LEARNING_SCOPE'});
  assert.throws(()=>f.service.resolve(f.policyId,{...scope,producerContext:'node-contract-v1',mode:'reviewer'}),{code:'CONFIG'});
});
test('scope fallback does not hide corrupted frozen compilation metadata',async t=>{
  const f=setup(t),record=f.store.get('learning-compilation',f.policyId);
  f.store.put('learning-compilation',f.policyId,{...record.data,scopeHash:'0'.repeat(64)},{expectedVersion:record.version});
  assert.throws(()=>f.service.resolver()('sigma_01',{...scope,purpose:'unrelated'}),{code:'LEARNING_SCOPE'});
});
test('learned overlay applies only to frozen evaluated model/effort and cannot change target mid-run',async t=>{
  const f=setup(t);await f.service.evaluate(f.candidate.candidateId,{runCase:f.runCase});f.service.promote(f.candidate.candidateId,{lease:f.lease,principalId:'owner'});
  assert.deepEqual(f.service.evaluatedTargets(f.policyId),[{model:'gpt-6-astra',reasoningEffort:'ultra'}]);
  const resolver=f.service.resolver();assert.equal(resolver('sigma_01',scope),null);
  assert.equal(resolver('sigma_01',scope,{model:'gpt-5.6-sol',reasoningEffort:'ultra'}),null);
  assert.equal(resolver('sigma_01',scope,{model:'gpt-6-astra',reasoningEffort:'high'}),null);
  const same=f.newRun();assert.equal(f.store.get('worker-config',same.id).data.learnedInstructionVersions.length,1);
  const mission=f.store.get('mission','live-mission');f.store.put('mission',mission.id,{...mission.data,policy:{...mission.data.policy,model:'gpt-5.6-sol'}},{expectedVersion:mission.version});
  const other=f.newRun();assert.equal(f.store.get('worker-config',other.id).data.learnedInstructionVersions.length,0);
  await assert.rejects(f.workers.infer({runId:same.id,instructions:taskInstructions,input:'3',schema,validate:v=>v.answer===6}),{code:'LEARNING_SCOPE'});
  assert.equal(f.inferred.length,0,'Target mismatch must fail before a provider call');
});
test('a frozen worker rechecks attested source custody at dispatch, without replacing its selected version',async t=>{
  const f=setup(t);await f.service.evaluate(f.candidate.candidateId,{runCase:f.runCase});f.service.promote(f.candidate.candidateId,{lease:f.lease,principalId:'owner'});
  const run=f.newRun(),frozenConfig=clone(f.store.get('worker-config',run.id).data),source=f.store.get('source',f.source.id);
  f.store.put('source',source.id,{...source.data,status:'RETRACTED',revokedAt:'2026-09-19T00:01:00.000Z',reason:'Fixture retraction after selection.'},{expectedVersion:source.version});
  const requestCount=f.store.list('inference-request').length,authorizationCount=f.store.list('learning-dispatch-authorization').length;
  await assert.rejects(f.workers.infer({runId:run.id,instructions:taskInstructions,input:'3',schema,validate:v=>v.answer===6}),{code:'LEARNING_PROVENANCE_SOURCE'});
  assert.equal(f.inferred.length,0,'Retraction blocks before a provider dispatch');
  assert.equal(f.store.list('inference-request').length,requestCount,'Retraction blocks before prospective request retention');
  assert.equal(f.store.list('learning-dispatch-authorization').length,authorizationCount,'Retraction blocks before durable dispatch authorization');
  assert.deepEqual(f.store.get('worker-config',run.id).data,frozenConfig,'A retraction never rewrites the frozen worker bytes');
});
test('a changed activation dossier fails closed before a frozen run can record or dispatch',async t=>{
  const f=setup(t);await f.service.evaluate(f.candidate.candidateId,{runCase:f.runCase});f.service.promote(f.candidate.candidateId,{lease:f.lease,principalId:'owner'});
  const run=f.newRun(),frozenConfig=clone(f.store.get('worker-config',run.id).data),role=f.store.get('learning-role',f.policyId),activation=f.store.get('learning-activation',role.data.activeActivationId);
  // The Store version is part of the immutable record reference. A hostile or
  // accidental replacement, even with identical-looking bytes, is not the
  // service-issued authorization selected when this worker was created.
  f.store.put('learning-activation',activation.id,clone(activation.data),{expectedVersion:activation.version});
  const requestCount=f.store.list('inference-request').length,authorizationCount=f.store.list('learning-dispatch-authorization').length;
  await assert.rejects(f.workers.infer({runId:run.id,instructions:taskInstructions,input:'3',schema,validate:v=>v.answer===6}),{code:'LEARNING_ACTIVATION_AUTHORIZATION'});
  assert.equal(f.inferred.length,0);
  assert.equal(f.store.list('inference-request').length,requestCount);
  assert.equal(f.store.list('learning-dispatch-authorization').length,authorizationCount);
  assert.deepEqual(f.store.get('worker-config',run.id).data,frozenConfig);
});
test('a retracted attested source cannot produce a derived export',async t=>{
  const f=setup(t);await f.service.evaluate(f.candidate.candidateId,{runCase:f.runCase});f.service.promote(f.candidate.candidateId,{lease:f.lease,principalId:'owner'});
  const source=f.store.get('source',f.source.id);
  f.store.put('source',source.id,{...source.data,status:'RETRACTED',revokedAt:'2026-09-19T00:01:00.000Z',reason:'Fixture retraction before export.'},{expectedVersion:source.version});
  assert.throws(()=>f.service.exportActive({roleId:f.policyId,expectedVersion:0,lease:f.lease,principalId:'owner'}),{code:'LEARNING_PROVENANCE_SOURCE'});
  assert.equal(f.store.get('learning-export',f.policyId),null);
});
test('promotion rolls back if a same-transaction source retraction lands between its custody checks',async t=>{
  const f=setup(t);await f.service.evaluate(f.candidate.candidateId,{runCase:f.runCase});
  const promote=f.service.registry.promote.bind(f.service.registry);
  f.service.registry.promote=(...args)=>{
    const source=f.store.get('source',f.source.id);
    f.store.put('source',source.id,{...source.data,status:'RETRACTED',revokedAt:'2026-09-19T00:03:00.000Z',reason:'Adversarial interleave before durable promotion.'},{expectedVersion:source.version});
    return promote(...args);
  };
  assert.throws(()=>f.service.promote(f.candidate.candidateId,{lease:f.lease,principalId:'owner'}),{code:'LEARNING_PROVENANCE_SOURCE'});
  assert.equal(f.service.registry.getActive(f.policyId).hash,f.baseline.hash,'The durable promotion rolled back');
  const source=f.store.get('source',f.source.id);assert.equal(source.version,1);assert.equal(source.data.status,'ADMITTED','The adversarial mutation shared the rollback');
});
test('baseline rollback remains available if a same-transaction source retraction lands during emergency removal',async t=>{
  const f=setup(t);await f.service.evaluate(f.candidate.candidateId,{runCase:f.runCase});f.service.promote(f.candidate.candidateId,{lease:f.lease,principalId:'owner'});
  const rollback=f.service.registry.rollback.bind(f.service.registry);
  f.service.registry.rollback=(...args)=>{
    const source=f.store.get('source',f.source.id);
    f.store.put('source',source.id,{...source.data,status:'RETRACTED',revokedAt:'2026-09-19T00:04:00.000Z',reason:'Adversarial interleave before durable rollback.'},{expectedVersion:source.version});
    return rollback(...args);
  };
  const restored=f.service.rollback({roleId:f.policyId,targetHash:f.baseline.hash,lease:f.lease,principalId:'owner',reason:'Restore baseline.'});
  assert.equal(restored.hash,f.baseline.hash,'The emergency removal reaches the exact frozen baseline');
  assert.equal(f.service.registry.getActive(f.policyId).hash,f.baseline.hash);
  const source=f.store.get('source',f.source.id);assert.equal(source.version,2);assert.equal(source.data.status,'RETRACTED',
    'The source retraction commits; it is not silently undone to make rollback convenient');
});
test('dedicated derived export requires authority and CAS; never overwrites changed file',async t=>{
  const f=setup(t);await f.service.evaluate(f.candidate.candidateId,{runCase:f.runCase});f.service.promote(f.candidate.candidateId,{lease:f.lease,principalId:'owner'});
  assert.throws(()=>f.service.exportActive({roleId:f.policyId,expectedVersion:0,principalId:'owner'}));
  const exported=f.service.exportActive({roleId:f.policyId,expectedVersion:0,lease:f.lease,principalId:'owner'});
  assert.ok(exported.data.path.endsWith('/AGENTS.md'));assert.ok(readFileSync(exported.data.path,'utf8').includes('NUMERIC_POLICY: double'));
  assert.throws(()=>f.service.exportActive({roleId:f.policyId,expectedVersion:0,lease:f.lease,principalId:'owner'}),{code:'VERSION_CONFLICT'});
  writeFileSync(exported.data.path,'User edit must remain.');
  assert.throws(()=>f.service.exportActive({roleId:f.policyId,expectedVersion:1,lease:f.lease,principalId:'owner'}),{code:'EXPORT_CHANGED'});
  assert.equal(readFileSync(exported.data.path,'utf8'),'User edit must remain.');
});
test('existing unowned export directory is never adopted or overwritten',async t=>{
  const f=setup(t);await f.service.evaluate(f.candidate.candidateId,{runCase:f.runCase});f.service.promote(f.candidate.candidateId,{lease:f.lease,principalId:'owner'});
  mkdirSync(join(f.directory,'derived-only'));writeFileSync(join(f.directory,'derived-only','AGENTS.md'),'original user instructions');
  assert.throws(()=>f.service.exportActive({roleId:f.policyId,expectedVersion:0,lease:f.lease,principalId:'owner'}),{code:'EXPORT_EXISTS'});
  assert.equal(readFileSync(join(f.directory,'derived-only','AGENTS.md'),'utf8'),'original user instructions');
});
test('candidate and baseline cannot be exported as if promoted',t=>{
  const f=setup(t);assert.throws(()=>f.service.exportActive({roleId:f.policyId,expectedVersion:0,lease:f.lease,principalId:'owner'}),{code:'LEARNING_APPROVAL'});
});
test('a later evaluation baseline uses the exact previously promoted overlay',async t=>{
  const f=setup(t);await f.service.evaluate(f.candidate.candidateId,{runCase:f.runCase});f.service.promote(f.candidate.candidateId,{lease:f.lease,principalId:'owner'});
  const firstCandidatePrefix=f.executed[1].effectivePrefix;
  const next=f.service.propose({roleId:f.policyId,parentHash:f.candidate.instructionHash,instructions:'NUMERIC_POLICY: double\nKeep the same measured operation.',rationale:'Comparable second candidate; no asserted improvement.',authorRunId:'author-two'});
  const evaluation=await f.service.evaluate(next.candidateId,{runCase:f.runCase});
  assert.equal(f.executed[4].effectivePrefix,firstCandidatePrefix);assert.equal(evaluation.passed,false);
});
test('a later promotion supersedes an older frozen run without rewriting it or reaching a provider',async t=>{
  const f=setup(t,{tieredImprovement:true});
  await f.service.evaluate(f.candidate.candidateId,{runCase:f.runCase});f.service.promote(f.candidate.candidateId,{lease:f.lease,principalId:'owner'});
  const oldRun=f.newRun(),oldConfig=clone(f.store.get('worker-config',oldRun.id).data);
  const next=f.service.propose({roleId:f.policyId,parentHash:f.candidate.instructionHash,
    instructions:'NUMERIC_POLICY: double\nQUALITY_TIER: two',rationale:'A separately measured second-tier improvement.',authorRunId:'author-two'});
  const evaluation=await f.service.evaluate(next.candidateId,{runCase:f.runCase});assert.equal(evaluation.passed,true);
  f.service.promote(next.candidateId,{lease:f.lease,principalId:'owner'});
  const requestCount=f.store.list('inference-request').length,authorizationCount=f.store.list('learning-dispatch-authorization').length;
  await assert.rejects(f.workers.infer({runId:oldRun.id,instructions:taskInstructions,input:'3',schema,validate:v=>v.answer===6}),{code:'LEARNING_SUPERSEDED'});
  assert.equal(f.inferred.length,0,'The superseded run never reaches a provider');
  assert.equal(f.store.list('inference-request').length,requestCount);
  assert.equal(f.store.list('learning-dispatch-authorization').length,authorizationCount);
  assert.deepEqual(f.store.get('worker-config',oldRun.id).data,oldConfig,'Promotion does not mutate historic worker configuration');
  const current=f.newRun();assert.equal(f.store.get('worker-config',current.id).data.learnedInstructionVersions[0].hash,next.instructionHash);
  await f.workers.infer({runId:current.id,instructions:taskInstructions,input:'3',schema,validate:v=>v.answer===6});
  assert.equal(f.inferred.length,1,'A newly created run may use the newly authorized overlay');
  assert.equal(f.store.list('learning-dispatch-authorization').length,authorizationCount+1);
});
test('direct core promotion fails closed without a service activation dossier',async t=>{
  const f=setup(t);await f.service.evaluate(f.candidate.candidateId,{runCase:f.runCase});
  assert.throws(()=>f.service.registry.promote(f.candidate.candidateId,{lease:f.lease,principalId:'owner'}),{code:'LEARNING_ACTIVATION_AUTHORIZATION'});
  assert.equal(f.service.registry.getActive(f.policyId).hash,f.baseline.hash);
  assert.equal(f.store.list('learning-activation').length,0,'The raw call cannot mint a service dossier as a side effect');
  const promoted=f.service.promote(f.candidate.candidateId,{lease:f.lease,principalId:'owner'});
  assert.equal(promoted.hash,f.candidate.instructionHash);assert.equal(f.store.list('learning-activation').length,1);
});
