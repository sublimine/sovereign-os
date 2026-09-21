import test from 'node:test';
import assert from 'node:assert/strict';
import {Store} from '../../factory/lib/store.mjs';
import {Authority} from '../../factory/lib/authority.mjs';
import {ArtifactRegistry} from '../../factory/lib/artifacts.mjs';
import {LearningService} from '../../factory/lib/learning-service.mjs';
import {LearningConductor} from '../../factory/lib/learning-conductor.mjs';
import {inferenceRequestHash} from '../../factory/providers/instruction-profiles.mjs';
import {id,sha256} from '../../factory/lib/contracts.mjs';
import {admitLearningProvenanceFixtureSource,learningProvenanceFixturePolicy,signedLearningProvenanceFixture} from './fixtures/learning-provenance.mjs';

function fixture(t,{action='propose',improves=true,providerHook=null,receiptPatch={},closure={processExitObserved:true},evaluationOnly=false}={}) {
  const store=new Store(':memory:'),authority=new Authority(store),service=new LearningService({store,authority,provenancePolicy:learningProvenanceFixturePolicy});t.after(()=>store.close());
  const scope={roleIds:['sigma_01'],purpose:'numeric-fixture',mode:'producer'},schema={type:'object',additionalProperties:false,required:['answer'],properties:{answer:{type:'integer'}}};
  const datasetSpec={missionId:'evaluation-mission',evaluatorId:'trusted-fixture',cases:[false,true].map(holdout=>({
    id:holdout?'hidden-qualification-id':'training-qualification-id',
    input:{taskInstructions:'Compute the requested numeric transform.',input:'3',schema,model:'gpt-6-astra',reasoningEffort:'ultra'},
    expected:{answer:6,privateLabel:holdout?'NEVER_EXPOSE_HOLDOUT':'TRAINING_FIXTURE_ONLY'},required:true,holdout,
    criteria:[{metric:'accuracy',direction:'higher',threshold:1}]})),policy:{requireImprovement:true}};
  if(evaluationOnly)datasetSpec.policy.activation='evaluation-only';
  let domain=null,policyId='sigma_01',baseline;
  if(evaluationOnly)baseline=service.registerBaseline({roleId:'sigma_01',scope,datasetSpec});
  else {
    const domainId='learning-conductor-domain',source=admitLearningProvenanceFixtureSource(store,{missionId:datasetSpec.missionId});
    domain=service.registerDomain({domainId,roleId:'sigma_01',scope,datasetSpec,
      provenance:signedLearningProvenanceFixture({service,domainId,roleId:'sigma_01',datasetSpec,scope,source})});
    policyId=domain.policyId;baseline=domain.baseline;
  }
  store.put('run','observed-worker',{id:'observed-worker',missionId:'observed-mission',mode:'producer',context:{purpose:scope.purpose},
    inferenceReceipts:[{status:'completed',simulation:true,model:'gpt-6-astra',reasoningEffort:'ultra'}]},{expectedVersion:0});
  store.put('worker-config','observed-worker',{compilationScope:scope},{expectedVersion:0});
  const rejected=store.put('worker-rejected-output','rejected-1',{runId:'observed-worker',code:'SCHEMA',payload:{answer:'wrong numeric type'},accepted:false},{expectedVersion:0});
  const ref=(({type,id,version,hash})=>({type,id,version,hash}))(rejected),generated=[],evaluated=[];
  const providerFactory=()=>({async generate(request){
    generated.push(request);if(providerHook)await providerHook({request,store,service});
    const value={action,instructions:action==='skip'?'':'FIXTURE_DOUBLE',rationale:'Bounded deterministic fixture proposal, not a claim of model improvement.',evidenceIds:action==='skip'?[]:[`worker-rejected-output:${ref.id}:${ref.version}`]};
    await request.validate(value);return {value,receipt:{status:'completed',simulation:true,contextHash:inferenceRequestHash(request),usage:{totalTokens:17},...receiptPatch}};
  },async close(){return closure;}});
  const conductor=new LearningConductor({service,providerFactory,allowSimulation:true});
  const cycle=conductor.open({roleId:policyId,runId:'observed-worker',evidenceRefs:[ref]});
  const runCase=async request=>{
    evaluated.push(request);const pass=request.variant==='candidate'||!improves;
    const observations={outcome:pass?'pass':'fail',metrics:{accuracy:pass?1:0},actual:{answer:pass?6:3,executionContext:request.executionContext}};
    const {evaluationId,datasetHash,caseId,caseHash,roleId,instructionHash,variant,evaluatorId}=request;
    return {observations,receipt:authority.seal('evaluation.case',{evaluationId,datasetHash,caseId,caseHash,roleId,instructionHash,variant,evaluatorId,evaluatorRunId:'independent-fixture-evaluator',executionId:id('execution'),observationsHash:sha256(observations)})};
  };
  const lease=authority.issue({missionId:'evaluation-mission',principalId:'owner',actions:['instructions.promote','instructions.rollback'],resources:[`role:${policyId}`],expiresAt:new Date(Date.now()+3600000).toISOString()});
  return {store,authority,service,conductor,cycle,scope,domain,policyId,baseline,ref,generated,evaluated,runCase,lease,providerFactory};
}
test('observation discovery deduplicates exact scope without inference and omits unregistered scopes',t=>{
  const f=fixture(t),first=f.conductor.observeMission('observed-mission'),again=f.conductor.observeMission('observed-mission');
  assert.equal(first.cycles.length,1);assert.equal(first.cycles[0].id,f.cycle.id);assert.deepEqual(first,again);assert.equal(f.generated.length,0);
  f.store.put('run','unregistered',{id:'unregistered',missionId:'observed-mission'},{expectedVersion:0});
  f.store.put('worker-config','unregistered',{compilationScope:{...f.scope,purpose:'unrelated'}},{expectedVersion:0});
  f.store.put('worker-rejected-output','other-rejection',{runId:'unregistered',accepted:false},{expectedVersion:0});
  assert.equal(f.conductor.observeMission('observed-mission').unconfigured[0].reason,'NO_FROZEN_EVALUATOR_SCOPE');
});
test('public learning-cycle list fails closed while the conductor retains its private coordination reader',t=>{
  const f=fixture(t),sentinel='PRIVATE_LEARNING_CYCLE_SENTINEL';
  f.store.put('learning-cycle','learning-cycle:unlinked-private',{id:'learning-cycle:unlinked-private',missionId:'mission:foreign',runId:'run:foreign',
    roleId:'role:foreign',status:'OBSERVED',privateBytes:sentinel,evidenceRefs:[{id:'evidence:private'}]},{expectedVersion:0});
  const view=f.conductor.list();
  assert.equal(view.schema,'sovereign.learning-cycles-public-boundary.v1');
  assert.equal(view.integrity,'NOT_PROJECTED');assert.deepEqual(view.cycles,[]);
  assert(!JSON.stringify(view).includes(sentinel));
  assert(f.conductor.listInternal().some(c=>c.privateBytes===sentinel),'Internal coordination still has the raw durable cycle.');
});
test('whole bounded cycle diagnoses then evaluates once; no holdout/expected/authority exposure, no automatic promotion',async t=>{
  const f=fixture(t),result=await f.conductor.advance(f.cycle.id,{runCase:f.runCase});
  assert.equal(result.status,'READY_FOR_PROMOTION');assert.equal(f.generated.length,1);assert.equal(f.evaluated.length,4);
  const prompt=JSON.stringify({instructions:f.generated[0].instructions,input:f.generated[0].input});
  for(const absent of ['NEVER_EXPOSE_HOLDOUT','hidden-qualification-id',f.authority.key.toString('hex')])assert(!prompt.includes(absent));
  assert(prompt.includes('wrong numeric type'));assert(prompt.includes('untrusted data'));
  assert.equal(f.service.registry.getActive(f.policyId).hash,f.baseline.hash);
  assert.deepEqual(await f.conductor.advance(f.cycle.id,{runCase:f.runCase}),result);assert.equal(f.generated.length,1);assert.equal(f.evaluated.length,4);
  const proposal=f.store.get('learning-proposal',result.proposalId).data;
  assert.equal(inferenceRequestHash(JSON.parse(proposal.requestJson)),inferenceRequestHash(f.generated[0]));
  assert.equal(f.authority.open(proposal.signed,'learning.proposal').response.receipt.usage.totalTokens,17);
  const promoted=f.conductor.promote(f.cycle.id,{lease:f.lease,principalId:'owner'});assert.equal(promoted.status,'PROMOTED');assert.notEqual(promoted.activeHash,f.baseline.hash);
  f.service.rollback({roleId:f.policyId,targetHash:f.baseline.hash,lease:f.lease,principalId:'owner',reason:'Fixture rollback.'});assert.equal(f.service.registry.getActive(f.policyId).hash,f.baseline.hash);
});
test('committed proposal survives coordinator replacement with no second proposal inference',async t=>{
  const f=fixture(t);assert.equal((await f.conductor.advance(f.cycle.id)).status,'PROPOSED');
  const next=new LearningConductor({service:f.service,providerFactory:f.providerFactory,allowSimulation:true});
  assert.equal((await next.advance(f.cycle.id,{runCase:f.runCase})).status,'READY_FOR_PROMOTION');assert.equal(f.generated.length,1);assert.equal(f.evaluated.length,4);
});
test('evaluation-only conductor records a passing SIM comparison as inactive even when autoPromote is requested',async t=>{
  const f=fixture(t,{evaluationOnly:true}),options={runCase:f.runCase,autoPromote:true,lease:f.lease,principalId:'owner'};
  const result=await f.conductor.advance(f.cycle.id,options);
  assert.equal(result.status,'EVALUATED_ONLY');assert.equal(result.lastCode,'LEARNING_EVALUATION_ONLY');
  assert.equal(f.generated.length,1);assert.equal(f.evaluated.length,4);
  assert.equal(f.service.registry.getActive(f.policyId).hash,f.baseline.hash);
  assert.equal(f.store.get('learning-evaluation',result.candidateId).data.passed,true);
  assert.deepEqual(await f.conductor.advance(f.cycle.id,options),result);
  assert.equal(f.generated.length,1);assert.equal(f.evaluated.length,4);
  assert.throws(()=>f.conductor.promote(f.cycle.id,{lease:f.lease,principalId:'owner'}),{code:'LEARNING_STATE'});
});
test('evaluation-only conductor reconciles completed comparison without claiming promotion readiness or replaying',async t=>{
  const f=fixture(t,{evaluationOnly:true}),proposed=await f.conductor.advance(f.cycle.id);
  await f.service.evaluate(proposed.candidateId,{runCase:f.runCase});f.conductor.update(f.cycle.id,{status:'EVALUATING'});
  const replacement=new LearningConductor({service:f.service,providerFactory:f.providerFactory,allowSimulation:true});
  const result=await replacement.advance(f.cycle.id,{runCase:f.runCase,autoPromote:true,lease:f.lease,principalId:'owner'});
  assert.equal(result.status,'EVALUATED_ONLY');assert.equal(result.lastCode,'LEARNING_EVALUATION_ONLY');
  assert.equal(f.generated.length,1);assert.equal(f.evaluated.length,4);
  assert.equal(f.service.registry.getActive(f.policyId).hash,f.baseline.hash);
});
test('evaluation-only conductor preserves a failed comparison as rejected, not successfully evaluated',async t=>{
  const f=fixture(t,{evaluationOnly:true,improves:false}),result=await f.conductor.advance(f.cycle.id,{runCase:f.runCase});
  assert.equal(result.status,'REJECTED');assert.equal(result.lastCode,'EVALUATION_REJECTED');
  assert.equal(f.service.registry.getActive(f.policyId).hash,f.baseline.hash);
});
test('signed completed proposal recovers the pre-candidate crash window without inference replay',async t=>{
  const f=fixture(t);f.conductor.acquire();
  const original=f.conductor.finishProposal.bind(f.conductor);f.conductor.finishProposal=()=>{throw Object.assign(new Error('Injected checkpoint crash'),{code:'TRANSIENT_PROVIDER'});};
  await assert.rejects(f.conductor.propose(f.cycle),{code:'TRANSIENT_PROVIDER'});f.conductor.release();f.conductor.finishProposal=original;
  assert.equal(f.conductor.get(f.cycle.id).status,'PROPOSING');assert.equal(f.store.list('learning-candidate').length,0);
  assert.equal((await f.conductor.advance(f.cycle.id,{runCase:f.runCase})).status,'READY_FOR_PROMOTION');assert.equal(f.generated.length,1);assert.equal(f.evaluated.length,4);
});
test('no-measured-improvement cycle remains rejected and cannot promote',async t=>{
  const f=fixture(t,{improves:false}),result=await f.conductor.advance(f.cycle.id,{runCase:f.runCase,autoPromote:true,lease:f.lease,principalId:'owner'});
  assert.equal(result.status,'REJECTED');assert.equal(f.service.registry.getActive(f.policyId).hash,f.baseline.hash);
  assert.throws(()=>f.conductor.promote(f.cycle.id,{lease:f.lease,principalId:'owner'}),{code:'LEARNING_STATE'});
});
test('skip is durable and never dispatches comparison calls',async t=>{
  const f=fixture(t,{action:'skip'});assert.equal((await f.conductor.advance(f.cycle.id,{runCase:f.runCase})).status,'SKIPPED');assert.equal(f.evaluated.length,0);assert.equal(f.store.list('learning-candidate').length,0);
});
test('automatic promotion requires actual exact-role authority; failure retains evaluated candidate for authorized promotion',async t=>{
  const f=fixture(t);await assert.rejects(f.conductor.advance(f.cycle.id,{runCase:f.runCase,autoPromote:true,principalId:'owner'}));
  assert.equal(f.conductor.get(f.cycle.id).status,'READY_FOR_PROMOTION');assert.equal(f.service.registry.getActive(f.policyId).hash,f.baseline.hash);
  assert.equal(f.conductor.promote(f.cycle.id,{lease:f.lease,principalId:'owner'}).status,'PROMOTED');
});
test('explicit authorized policy atomically promotes passing cycle',async t=>{
  const f=fixture(t);assert.equal((await f.conductor.advance(f.cycle.id,{runCase:f.runCase,autoPromote:true,lease:f.lease,principalId:'owner'})).status,'PROMOTED');
  assert.equal(f.store.list('learning-role')[0].data.activeHash,f.conductor.get(f.cycle.id).activeHash);
});
test('interrupted in-flight proposal is not blindly replayed or called completed',async t=>{
  const f=fixture(t);f.conductor.update(f.cycle.id,{status:'PROPOSING',proposalId:'lost-call'});
  assert.equal((await f.conductor.advance(f.cycle.id,{runCase:f.runCase})).status,'INTERRUPTED');assert.equal(f.generated.length,0);assert.equal(f.evaluated.length,0);
});
test('incomplete evaluation cannot be promoted or silently rerun',async t=>{
  const f=fixture(t);await f.conductor.advance(f.cycle.id);f.conductor.update(f.cycle.id,{status:'EVALUATING'});
  assert.equal((await f.conductor.advance(f.cycle.id,{runCase:f.runCase})).lastCode,'EVALUATION_OUTCOME_INCOMPLETE');assert.equal(f.evaluated.length,0);
});
test('completed bound evaluation reconciles a cycle checkpoint without more calls',async t=>{
  const f=fixture(t);const proposed=await f.conductor.advance(f.cycle.id);await f.service.evaluate(proposed.candidateId,{runCase:f.runCase});f.conductor.update(f.cycle.id,{status:'EVALUATING'});
  assert.equal((await f.conductor.advance(f.cycle.id,{runCase:f.runCase})).status,'READY_FOR_PROMOTION');assert.equal(f.evaluated.length,4);
});
test('foreign or tampered observations and mismatched compilation are rejected',t=>{
  const f=fixture(t);assert.throws(()=>f.conductor.open({roleId:f.policyId,runId:'observed-worker',evidenceRefs:[{...f.ref,hash:'0'.repeat(64)}]}),{code:'LEARNING_EVIDENCE'});
  assert.throws(()=>f.conductor.open({roleId:f.policyId,runId:'missing',evidenceRefs:[f.ref]}),{code:'LEARNING_SCOPE'});
  assert.throws(()=>f.conductor.open({roleId:f.policyId,runId:'observed-worker',evidenceRefs:[{...f.ref,type:'authority-key'}]}),{code:'LEARNING_EVIDENCE'});
});
test('diagnostic capsule authenticates actor metadata and excludes observations acquired after rejection',t=>{
  const f=fixture(t),registry=new ArtifactRegistry(f.store,f.authority);
  const receipt=actor=>{const value={id:id('operation'),missionId:'observed-mission',principalId:actor,tool:'workspace.read',argsHash:sha256({path:'example.txt'}),status:'SUCCEEDED',startedAt:'2026-09-09T00:00:00.000Z',completedAt:'2026-09-09T00:00:01.000Z',result:{path:'example.txt',content:'Do not disclose this file body to a metadata-only diagnostic.',sha256:sha256('Do not disclose this file body to a metadata-only diagnostic.')}};
    const signed=f.authority.seal('tool.receipt',value);f.store.put('effect',value.id,{...value,state:value.status,receipt:signed},{expectedVersion:0});return signed;};
  const foreign=receipt('prior-producer');registry.recordToolObservation('observed-worker',foreign);
  const rejected=f.store.put('worker-rejected-output','rejected-after-observation',{runId:'observed-worker',code:'TOOL_ACTOR',accepted:false},{expectedVersion:0});
  const own=receipt('observed-worker');registry.recordToolObservation('observed-worker',own);
  const ref=(({type,id,version,hash})=>({type,id,version,hash}))(rejected),capsule=f.conductor.diagnosticEvidence(ref,'observed-worker');
  assert.equal(capsule.diagnostic.toolMetadata.length,1);assert.equal(capsule.diagnostic.toolMetadata[0].id,foreign.data.id);assert.equal(capsule.diagnostic.toolMetadata[0].relation,'EXTERNAL_OBSERVATION');
  assert(!JSON.stringify(capsule).includes('Do not disclose this file body'));
  assert.equal(f.conductor.diagnosticEvidence(f.ref,'observed-worker').diagnostic.toolMetadata.length,0);
  const effect=f.store.get('effect',foreign.data.id);f.store.put('effect',foreign.data.id,{...effect.data,principalId:'forged-actor'},{expectedVersion:effect.version});
  assert.throws(()=>f.conductor.diagnosticEvidence(ref,'observed-worker'),{code:'TOOL_RECEIPT'});
});
test('UNKNOWN independent review is a learning observation, not an accepted artifact or invented failure verdict',t=>{
  const f=fixture(t);
  f.store.put('run','reviewer',{id:'reviewer',missionId:'observed-mission',nodeId:'review:node',mode:'reviewer',context:{artifactIds:[]}},{expectedVersion:0});
  f.store.put('artifact','uncertain-artifact',{missionId:'observed-mission',payload:{producerRunId:'observed-worker'}},{expectedVersion:0});
  const r=f.store.put('review','uncertain-review',{artifactId:'uncertain-artifact',reviewerRunId:'reviewer',result:{decision:'UNKNOWN',checks:[]}},{expectedVersion:0});
  const ref=(({type,id,version,hash})=>({type,id,version,hash}))(r),capsule=f.conductor.diagnosticEvidence(ref,'observed-worker');
  assert.equal(capsule.observation.result.decision,'UNKNOWN');assert.equal(capsule.diagnostic.observingRunId,'reviewer');
  assert(f.conductor.observeMission('observed-mission').cycles.some(c=>c.evidenceRefs.some(e=>e.id==='uncertain-review')));
});
test('invented evidence and simulated or unbound proposal receipts cannot create candidates',async t=>{
  const f=fixture(t,{receiptPatch:{contextHash:'0'.repeat(64)}});
  assert.throws(()=>f.conductor.validateProposal({action:'propose',instructions:'x',rationale:'x',evidenceIds:['invented']},f.cycle),{code:'LEARNING_EVIDENCE'});
  await assert.rejects(f.conductor.advance(f.cycle.id),{code:'LEARNING_INFERENCE'});assert.equal(f.store.list('learning-candidate').length,0);
  const g=fixture(t);const realOnly=new LearningConductor({service:g.service,providerFactory:g.providerFactory});await assert.rejects(realOnly.advance(g.cycle.id),{code:'LEARNING_INFERENCE'});
});
test('unobserved process closure is a failed proposal, never an approved candidate',async t=>{
  const f=fixture(t,{closure:{processExitObserved:false}});await assert.rejects(f.conductor.advance(f.cycle.id),{code:'LEARNING_CLEANUP'});assert.equal(f.conductor.get(f.cycle.id).status,'FAILED');assert.equal(f.store.list('learning-candidate').length,0);
});
test('live owner excludes concurrent advancement without a second inference',async t=>{
  let release,started;const waiting=new Promise(r=>{release=r;}),inFlight=new Promise(r=>{started=r;});
  const f=fixture(t,{providerHook:async()=>{started();await waiting;}}),first=f.conductor.advance(f.cycle.id);
  await inFlight;const other=new LearningConductor({service:f.service,providerFactory:f.providerFactory,allowSimulation:true});
  await assert.rejects(other.advance(f.cycle.id),{code:'LEARNING_BUSY'});release();await first;assert.equal(f.generated.length,1);
});
test('cancellation during paired evaluation reaches callback and cannot start another case or promote',async t=>{
  const f=fixture(t),controller=new AbortController();let calls=0;
  await assert.rejects(f.conductor.advance(f.cycle.id,{signal:controller.signal,runCase:async(request,{signal})=>{
    calls++;assert.equal(signal,controller.signal);const result=await f.runCase(request);controller.abort();return result;
  }}),{code:'CANCELLED'});
  assert.equal(calls,1);assert.equal(f.conductor.get(f.cycle.id).status,'FAILED');
  assert.equal(f.conductor.get(f.cycle.id).lastCode,'CANCELLED');
  assert.equal(f.service.registry.getActive(f.policyId).hash,f.baseline.hash);
  await f.conductor.advance(f.cycle.id,{runCase:f.runCase});assert.equal(calls,1);assert.equal(f.evaluated.length,1);
  assert.equal(f.store.get('learning-owner','exclusive').data.ownerId,null);
});
test('citation diagnostics bind exact pre-rejection artifact text, preserve paraphrase failure and reveal no new body',t=>{
  const f=fixture(t),toRef=r=>({type:r.type,id:r.id,version:r.version,hash:r.hash});
  const payload={body:'The first constraint applies. The second constraint differs. PRIVATE_BODY_TAIL',producerRunId:'another-worker'},hash=sha256(payload);
  f.store.put('artifact','cited',{missionId:'observed-mission',payload,payloadHash:hash},{expectedVersion:0});
  const run=f.store.get('run','observed-worker');f.store.put('run',run.id,{...run.data,context:{...run.data.context,artifactIds:['cited']}},{expectedVersion:run.version});
  const proof=quote=>({kind:'artifact',id:'cited',hash,quote});
  const response={evidence:[proof('The first constraint applies.'),proof('The first constraint applies. The second is identical.'),proof(''),{...proof('The first constraint applies.'),hash:sha256('wrong')},{...proof('late body'),id:'late'}]};
  const rejection=f.store.put('worker-rejected-review','citation-rejection',{runId:run.id,code:'REVIEW_EVIDENCE',response,accepted:false},{expectedVersion:0});
  const first=f.conductor.diagnosticEvidence(toRef(rejection),run.id),checks=first.diagnostic.artifactCitationChecks;
  assert.deepEqual(checks.map(c=>c.quoteIsExact),[true,false,false,null,null]);
  assert.equal(checks[3].admittedBeforeRejection,true);assert.equal(checks[3].payloadBindingMatches,false);
  assert.equal(checks[4].admittedBeforeRejection,false);assert(!JSON.stringify(first).includes('PRIVATE_BODY_TAIL'));
  const latePayload={body:'late body'},lateHash=sha256(latePayload);
  f.store.put('artifact','late',{missionId:'observed-mission',payload:latePayload,payloadHash:lateHash},{expectedVersion:0});
  const current=f.store.get('run',run.id);f.store.put('run',run.id,{...current.data,context:{...current.data.context,artifactIds:['cited','late']}},{expectedVersion:current.version});
  // A later version must not repair the old quote or enter its historical scope.
  const cited=f.store.get('artifact','cited'),changed={...payload,body:response.evidence[1].quote};
  f.store.put('artifact','cited',{...cited.data,payload:changed,payloadHash:sha256(changed)},{expectedVersion:cited.version});
  assert.deepEqual(f.conductor.diagnosticEvidence(toRef(rejection),run.id),first);
  const expanded=f.store.put('worker-rejected-review','expanded-citation',{runId:run.id,code:'REVIEW_EVIDENCE',response:{checks:[{evidence:[proof('The first constraint applies.')]}]},accepted:false},{expectedVersion:0});
  const check=f.conductor.diagnosticEvidence(toRef(expanded),run.id).diagnostic.artifactCitationChecks[0];
  assert.equal(check.checkIndex,0);assert.equal(check.evidenceIndex,0);assert.equal(check.quoteIsExact,true);
});
