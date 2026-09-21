import test from 'node:test';
import assert from 'node:assert/strict';
import {Store} from '../../factory/lib/store.mjs';
import {Authority} from '../../factory/lib/authority.mjs';
import {ArtifactRegistry} from '../../factory/lib/artifacts.mjs';
import {sha256,id,canonical} from '../../factory/lib/contracts.mjs';
import {inferenceRequestHash} from '../../factory/providers/instruction-profiles.mjs';
import {unpackContext} from '../../factory/lib/context-codec.mjs';
import {unpackJsonContext} from '../../factory/lib/context-json-codec.mjs';
import {packSourceContextView,readSourceContextView} from '../../factory/lib/source-context-view.mjs';
import {mkdtempSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {execFileSync,spawn} from 'node:child_process';
import {BlindReplicationService,BLIND_PROTOCOL_CRITERIA} from '../../factory/lib/blind-replication.mjs';
import {BLIND_MATERIAL_KIND,blindMaterialEvidence} from '../../factory/lib/blind-material.mjs';
import {WorkerService} from '../../factory/lib/workers.mjs';
import {FactoryEngine} from '../../factory/lib/engine.mjs';
import {compactCatalogReview,compactReviewEvidence} from '../../factory/lib/review-codec.mjs';
import {BLIND_COMPARISON_PURPOSE,blindComparisonEvidence,evaluateBlindComparison,isBlindComparison,validateComparisonRule} from '../../factory/lib/blind-comparison.mjs';
import {frozenBlindWorkflow} from '../../factory/lib/closed-blind-workflow.mjs';
import {missionInferenceBudget} from '../../factory/lib/mission-inference-budget.mjs';

function setup(t,respond=null,databasePath=':memory:',intentOverride=null,inferenceBudget=null){
  const store=new Store(databasePath),authority=new Authority(store),registry=new ArtifactRegistry(store,authority);
  const intent=intentOverride??'Independently reproduce a closed calculation without seeing the original.';
  store.put('mission','m',{...(inferenceBudget?{id:'m'}:{}),intent,intentHash:sha256(intent),policy:{allowedTools:[],model:'gpt-6-astra',reasoningEffort:'ultra',cardEncoding:'compact-json-v1',instructionProfile:'scoped-v1',...(inferenceBudget?{inferenceBudget}:{})}},{expectedVersion:0});
  const context=(purpose,artifactIds=[])=>({purpose,artifactIds,sourceIds:[],instructionsHash:sha256('fixture'),producerConversationIncluded:false});
  function run(mode,purpose,artifactIds=[]){const r=registry.registerRun({missionId:'m',nodeId:id('node'),mode,context:context(purpose,artifactIds)});
    const requestHash=inferenceBudget?registry.recordInferenceRequest(r.id,{instructions:'fixture',input:'Synthetic upstream fixture; not real inference.',schema:{type:'object',properties:{}},model:'gpt-6-astra',reasoningEffort:'ultra'}):null;
    registry.attachInference(r.id,{status:'completed',threadId:id('sim-original-thread'),turnId:'fixture',...(inferenceBudget?{simulation:true,contextHash:requestHash}:{})});return store.get('run',r.id).data;}
  function create(body,purpose='answer',criteria=[{id:'correct',text:'Correct result.'}]){const r=run('producer',purpose);return registry.create({missionId:'m',nodeId:r.nodeId,producerRunId:r.id,kind:'test-fixture',purpose,body,criteria});}
  function accept(a,observed=[]){
    const r=run('reviewer',a.payload.purpose,[a.id,...observed]),proof=[];
    if(a.payload.kind===BLIND_MATERIAL_KIND||isBlindComparison(a)){
      const o=registry.captureRuntimeObservations(r.id).find(o=>o.kind===(isBlindComparison(a)?'artifact-blind-comparison':'artifact-blind-material'));
      proof.push({kind:'runtime',id:o.id,hash:o.hash,quote:'"artifactId":'+JSON.stringify(a.id)});
      registry.attachInference(r.id,{status:'completed',simulation:true,threadId:id('sim-material-review'),turnId:'sim-review'});
    }
    return registry.review({artifactId:a.id,reviewerRunId:r.id,result:{artifactHash:a.payloadHash,purpose:a.payload.purpose,decision:'ACCEPT',checks:a.payload.criteria.map(c=>({criterionId:c.id,verdict:'PASS',evidence:[{kind:'artifact',id:a.id,hash:a.payloadHash,quote:a.payload.body},...proof],reason:'SIMULATED judgment, not live semantic proof.'})),findings:[],uncertainty:'Synthetic review fixture.'}});
  }
  const original=create('PRIVATE_ORIGINAL_RESULT_AND_RATIONALE_971');
  const protocol={schema:'sovereign.closed-blind-protocol.v1',missionIntentHash:sha256(intent),original:{artifactId:original.id,hash:original.payloadHash},roleId:'veritas_04',public:{purpose:'reproduce-sum',question:'Compute 17 + 25 from the supplied operands.',scope:'Closed integer arithmetic only.',method:'Decompose by tens and units and use subtraction as a reverse control.',tolerance:'Exact integer equality; no rounding.',stopping:'One complete derivation; UNKNOWN if premises or method are insufficient.',controls:[{id:'reverse',procedure:'Subtract 25 from the computed sum.',expected:'Recovers the supplied other operand.'}],varyingDimensions:['derivation','reverse control'],sharedRoots:['Same model family; cognitive independence is not established.'],limitations:['No external evidence, tools, or factual claims beyond supplied definitions.']}};
  const p=create(JSON.stringify(protocol),'blind-protocol',BLIND_PROTOCOL_CRITERIA);accept(p,[original.id]);
  let calls=0,closes=0;const requests=[];
  const response=()=>({status:'RESULT',result:'42',publicArgument:'17 + 25 = (10 + 20) + (7 + 5) = 42.',controls:[{id:'reverse',verdict:'PASS',observation:'42 - 25 = 17.'}],deviations:[],unknowns:[]});
  const providerFactory=()=>({async generate(request){calls++;requests.push(request);const value=respond?await respond({request,store,registry,original,protocol,p,response}):response();await request.validate(value);return {value,receipt:{status:'completed',simulation:true,threadId:id('sim-replica-thread'),turnId:'sim-replica-turn',model:request.model,reasoningEffort:request.reasoningEffort,contextHash:inferenceRequestHash(request)}};},async close(){closes++;}});
  const service=new BlindReplicationService({store,authority,registry,providerFactory});
  const freeze=(replicationId='replication:test')=>service.freeze({replicationId,missionId:'m',protocolArtifactId:p.id});
  t.after(()=>store.close());return {store,authority,registry,service,original,p,protocol,create,accept,run,freeze,requests,response,get calls(){return calls;},get closes(){return closes;}};
}

test('a legal two-call mission charges a closed blind replica through its own signed dispatch lineage',async t=>{
  // This is deliberately not a seeded budget ledger: deterministic fixtures
  // establish the private original/protocol, an independent WorkerService
  // reviewer consumes call one, and the closed replica consumes call two.
  const engine=new FactoryEngine({databasePath:':memory:',workspaceRoot:'/tmp/sovereign-blind-budget-fixture'});
  t.after(()=>engine.close());
  const intent='Calculate 17 + 25 with a closed blind replication.';
  const mission=engine.create(intent,{allowedTools:[],inferenceBudget:{mode:'mission-calls-v1',maxCalls:2}});
  const {store,authority,registry}=engine;
  const context=(purpose,artifactIds=[])=>({purpose,artifactIds,sourceIds:[],instructionsHash:sha256('blind budget fixture'),producerConversationIncluded:false});
  const deterministic=(nodeId,purpose,body,criteria)=>{
    const run=registry.registerRun({missionId:mission.id,nodeId,mode:'producer',context:context(purpose)});
    return registry.create({missionId:mission.id,nodeId,producerRunId:run.id,kind:'deterministic-result',purpose,body,criteria});
  };
  const original=deterministic('original','answer','PRIVATE_ORIGINAL_RESULT_AND_RATIONALE_971',[{id:'correct',text:'Correct result.'}]);
  const protocol={schema:'sovereign.closed-blind-protocol.v1',missionIntentHash:sha256(intent),original:{artifactId:original.id,hash:original.payloadHash},roleId:'veritas_04',public:{
    purpose:'reproduce-sum',question:'Compute 17 + 25 from the supplied operands.',scope:'Closed integer arithmetic only.',
    method:'Decompose by tens and units and use subtraction as a reverse control.',tolerance:'Exact integer equality; no rounding.',
    stopping:'One complete derivation; UNKNOWN if premises or method are insufficient.',controls:[{id:'reverse',procedure:'Subtract 25 from the computed sum.',expected:'Recovers the supplied other operand.'}],
    varyingDimensions:['derivation','reverse control'],sharedRoots:['Same model family; cognitive independence is not established.'],
    limitations:['No external evidence, tools, or factual claims beyond supplied definitions.']
  }};
  const approvedProtocol=deterministic('protocol','blind-protocol',JSON.stringify(protocol),BLIND_PROTOCOL_CRITERIA);

  let reviewerCalls=0;
  engine.workers.providerFactory=()=>({async generate(request){
    reviewerCalls++;
    const value={ok:true};assert.equal(await request.validate(value),true);
    return {value,receipt:{status:'completed',simulation:true,threadId:`blind-budget-reviewer-${reviewerCalls}`,turnId:'turn',
      model:request.model,reasoningEffort:request.reasoningEffort,contextHash:inferenceRequestHash(request)}};
  },async close(){}});
  const reviewer=engine.workers.createRun({missionId:mission.id,nodeId:'review:protocol',mode:'reviewer',purpose:'blind-protocol',
    roleIds:['omega_03'],artifactIds:[approvedProtocol.id,original.id]});
  await engine.workers.infer({runId:reviewer.id,instructions:'Validate the closed protocol fixture.',input:'{}',
    schema:{type:'object',properties:{ok:{type:'boolean'}},required:['ok'],additionalProperties:false},validate:value=>value.ok===true});
  registry.review({artifactId:approvedProtocol.id,reviewerRunId:reviewer.id,result:{artifactHash:approvedProtocol.payloadHash,
    purpose:approvedProtocol.payload.purpose,decision:'ACCEPT',checks:approvedProtocol.payload.criteria.map(criterion=>({criterionId:criterion.id,
      verdict:'PASS',evidence:[{kind:'artifact',id:approvedProtocol.id,hash:approvedProtocol.payloadHash,quote:approvedProtocol.payload.body}],
      reason:'Fixture review with a completed independent reviewer receipt.'})),findings:[],uncertainty:'Fixture.'}});

  assert.deepEqual(missionInferenceBudget(registry,mission.id).byKind,{worker:1,search:0});
  const rawReplicator=registry.registerRun({missionId:mission.id,nodeId:'raw-replica',mode:'replicator',context:context('blind-replica')});
  assert.throws(()=>registry.recordInferenceRequest(rawReplicator.id,{instructions:'forged',input:'{}',schema:{type:'object',properties:{}},
    model:mission.policy.model,reasoningEffort:mission.policy.reasoningEffort}),{code:'BLIND_INFERENCE_PATH'});

  let blindCalls=0;
  const blind=new BlindReplicationService({store,authority,registry,providerFactory:()=>({async generate(request){
    blindCalls++;
    const budget=missionInferenceBudget(registry,mission.id);
    assert.deepEqual([budget.reserved,budget.remaining,budget.byKind['blind-replica']],[2,0,1],
      'The blind reservation and its signed proof commit before provider I/O');
    assert.equal(store.get('blind-replication','replication:budgeted').data.state,'RUNNING');
    assert.equal(store.list('mission-blind-replica-dispatch-proof').length,1);
    const value={status:'RESULT',result:'42',publicArgument:'17 + 25 = 42.',controls:[{id:'reverse',verdict:'PASS',observation:'42 - 25 = 17.'}],deviations:[],unknowns:[]};
    assert.equal(await request.validate(value),true);
    return {value,receipt:{status:'completed',simulation:true,threadId:'blind-budget-replica',turnId:'turn',model:request.model,
      reasoningEffort:request.reasoningEffort,contextHash:inferenceRequestHash(request)}};
  },async close(){}})});
  blind.freeze({replicationId:'replication:budgeted',missionId:mission.id,protocolArtifactId:approvedProtocol.id});
  const genericProofs=store.list('mission-inference-dispatch-proof').length;
  const put=store.put.bind(store),fault=t.mock.method(store,'put',(type,...args)=>{
    if(type==='mission-inference-call')throw Error('Synthetic blind reservation storage fault');
    return put(type,...args);
  });
  await assert.rejects(blind.execute('replication:budgeted'),/Synthetic blind reservation storage fault/);
  fault.mock.restore();
  assert.equal(blind.status('replication:budgeted').state,'FROZEN');
  assert.equal(store.list('inference-request').length,1,'A failed inner reservation cannot retain a blind pending request');
  assert.equal(store.list('mission-blind-replica-dispatch-proof').length,0,'A failed inner reservation cannot retain a blind proof');
  const sealed=await blind.execute('replication:budgeted');
  assert.equal(sealed.state,'SEALED');assert.equal(reviewerCalls,1);assert.equal(blindCalls,1);
  const budget=missionInferenceBudget(registry,mission.id);
  assert.deepEqual([budget.reserved,budget.remaining,budget.byKind.worker,budget.byKind['blind-replica']],[2,0,1,1]);
  assert.equal(store.list('mission-blind-replica-dispatch-proof').length,1);
  assert.equal(store.list('mission-inference-dispatch-proof').length,genericProofs,'The replicator cannot borrow a worker proof family');
  const retainedBlindRequest=store.list('inference-request').find(record=>record.data.runId===sealed.runId);
  assert.ok(retainedBlindRequest,'The replica retains its own exact public request before dispatch');
  for(const secret of [original.id,original.payloadHash,original.payload.body,approvedProtocol.id,approvedProtocol.payloadHash])
    assert.ok(!JSON.stringify(retainedBlindRequest.data).includes(secret),secret);

  const material=blind.materialize('replication:budgeted');
  const historical=blindMaterialEvidence(registry,material.id,{current:false});
  const originalClock=store.clock;store.clock=()=> 'not-an-issuance-time';
  assert.equal(missionInferenceBudget(registry,mission.id).reserved,2,'Historical proof validation never invokes the mutable current clock');
  store.clock=originalClock;
  const missionHead=store.get('mission',mission.id),frozenPolicy=structuredClone(missionHead.data.policy);
  store.put(missionHead.type,missionHead.id,{...missionHead.data,policy:{...frozenPolicy,model:'mutated-after-seal'}},{expectedVersion:missionHead.version});
  assert.throws(()=>blindMaterialEvidence(registry,material.id),{code:'INFERENCE_PROVENANCE_INTEGRITY'});
  assert.deepEqual(blindMaterialEvidence(registry,material.id,{current:false}),historical,
    'Historical material proof is scoped to its own frozen registration and signed dispatch');
  const changedMission=store.get('mission',mission.id);
  store.put(changedMission.type,changedMission.id,{...changedMission.data,policy:frozenPolicy},{expectedVersion:changedMission.version});
  assert.deepEqual(blindMaterialEvidence(registry,material.id),historical);
  // A contemporary, id-bearing mission cannot become a legacy-shaped record
  // after the sealed dispatch.  Otherwise an attacker could use the old
  // compatibility route to weaken the current-mission identity check.
  const restoredMission=store.get('mission',mission.id),{id:removedMissionId,...withoutMissionId}=restoredMission.data;
  assert.equal(removedMissionId,mission.id);
  store.put(restoredMission.type,restoredMission.id,withoutMissionId,{expectedVersion:restoredMission.version});
  assert.throws(()=>blindMaterialEvidence(registry,material.id),{code:'INFERENCE_PROVENANCE_INTEGRITY'});
  const idRemovedMission=store.get('mission',mission.id);
  store.put(idRemovedMission.type,idRemovedMission.id,{...idRemovedMission.data,id:mission.id},{expectedVersion:idRemovedMission.version});
  assert.deepEqual(blindMaterialEvidence(registry,material.id),historical);

  const exhausted=blind.freeze({replicationId:'replication:budget-exhausted',missionId:mission.id,protocolArtifactId:approvedProtocol.id});
  assert.equal(exhausted.state,'FROZEN');
  await assert.rejects(blind.execute('replication:budget-exhausted'),{code:'INFERENCE_BUDGET_EXHAUSTED'});
  assert.equal(blind.status('replication:budget-exhausted').state,'FROZEN');
  assert.equal(blindCalls,1,'Capacity refusal cannot initiate another provider call');
  assert.equal(store.list('inference-request').length,2,'Capacity refusal rolls back the blind pending request');
  assert.equal(store.list('mission-blind-replica-dispatch-proof').length,1,'Capacity refusal cannot leave a partial blind proof');

  // Direct Store mutation simulates a compromised local controller.  The
  // public material boundary must reject it rather than trusting a stale seal.
  const proof=store.list('mission-blind-replica-dispatch-proof')[0];
  store.put(proof.type,proof.id,{...proof.data,mutatedBy:'adversarial-fixture'},{expectedVersion:proof.version});
  assert.throws(()=>blind.materialize('replication:budgeted'),{code:'INFERENCE_PROVENANCE_INTEGRITY'});
  assert.throws(()=>blindMaterialEvidence(registry,material.id,{current:false}),{code:'INFERENCE_PROVENANCE_INTEGRITY'});
  store.verifyJournal();
});
test('sealed replica: accepted protocol -> exact hidden-context request -> immutable result -> later opening',async t=>{
  const f=setup(t);const initial=f.freeze();assert.equal(initial.state,'FROZEN');assert.equal(f.calls,0);
  assert.deepEqual(f.freeze(),initial);assert.throws(()=>f.service.open('replication:test'),{code:'BLIND_STATE'});
  const sealed=await f.service.execute('replication:test');assert.equal(sealed.state,'SEALED');assert.equal(f.calls,1);assert.equal(f.closes,1);
  const req=f.requests[0],input=JSON.parse(req.input);assert.equal(input.publicProtocol.question,f.protocol.public.question);
  assert.ok(req.instructions.includes('Replicación blind'));assert.ok(req.instructions.includes('resultado ciego'));
  for(const secret of [f.original.id,f.original.payloadHash,f.original.payload.body,f.p.id,f.p.payloadHash])assert.ok(!JSON.stringify({instructions:req.instructions,input:req.input,schema:req.schema}).includes(secret),secret);
  assert.equal(req.model,'gpt-6-astra');assert.equal(req.reasoningEffort,'ultra');assert.equal(req.instructionProfile,'scoped-v1');
  assert.equal(f.store.list('inference-request').length,1);assert.equal(f.store.list('effect').length,0);
  const originalBefore=f.store.get('artifact',f.original.id);
  assert.deepEqual(await f.service.execute('replication:test'),sealed);assert.equal(f.calls,1);
  assert.throws(()=>f.service.open('replication:test'),{code:'BLIND_REVIEW'});
  f.accept(f.service.materialize('replication:test'));
  const opened=f.service.open('replication:test');assert.equal(opened.state,'OPENED');assert.equal(opened.original.payload.body,f.original.payload.body);assert.equal(opened.replica.result,'42');
  assert.deepEqual(f.service.open('replication:test'),opened);assert.equal((await f.service.execute('replication:test')).state,'OPENED');assert.equal(f.calls,1);
  assert.deepEqual(f.store.get('artifact',f.original.id),originalBefore,'Opening is not original acceptance or repair');
  const events=f.store.events({limit:10000});const seq=kind=>events.find(e=>e.kind===kind).seq;
  assert.ok(seq('blind.protocol.frozen')<seq('blind.inference.dispatched'));assert.ok(seq('blind.inference.dispatched')<seq('blind.result.sealed'));assert.ok(seq('blind.result.sealed')<seq('blind.original.opened'));assert.ok(f.store.verifyJournal());
});
test('protocol must be accepted with all prior gate texts and exact original version; failed freeze creates no run',t=>{
  const f=setup(t),cases=[f.create(JSON.stringify(f.protocol),'blind-protocol',BLIND_PROTOCOL_CRITERIA)];
  const wrong=f.create(JSON.stringify({...f.protocol,original:{...f.protocol.original,hash:sha256('wrong')}}),'blind-protocol',BLIND_PROTOCOL_CRITERIA);f.accept(wrong,[f.original.id]);cases.push(wrong);
  const relaxed=f.create(JSON.stringify(f.protocol),'blind-protocol',[{id:BLIND_PROTOCOL_CRITERIA[0].id,text:'Approve anything.'}]);f.accept(relaxed,[f.original.id]);cases.push(relaxed);
  const before=f.store.list('run').length;
  for(const a of cases)assert.throws(()=>f.service.freeze({replicationId:'replication:bad',missionId:'m',protocolArtifactId:a.id}));
  assert.equal(f.store.list('run').length,before);assert.equal(f.store.list('blind-registration').length,0);assert.equal(f.calls,0);
  assert.throws(()=>f.service.freeze({replicationId:'replication:alien',missionId:'other',protocolArtifactId:f.p.id}));
});
test('unknown result stays sealed inconclusive and never unblinds',async t=>{
  const f=setup(t,({response})=>({...response(),status:'UNKNOWN',result:'',unknowns:['Cannot establish the requested derivation.']}));f.freeze();
  assert.equal((await f.service.execute('replication:test')).state,'INCONCLUSIVE');assert.throws(()=>f.service.open('replication:test'),{code:'BLIND_STATE'});
  const material=f.accept(f.service.materialize('replication:test'));
  assert.equal(JSON.parse(material.payload.body).result.status,'UNKNOWN');
  assert.throws(()=>f.service.open('replication:test'),{code:'BLIND_STATE'},'Accepting an UNKNOWN record does not make it a result');
  assert.equal((await f.service.execute('replication:test')).state,'INCONCLUSIVE');assert.equal(f.calls,1);
});
test('missing controls fail without a usable seal or automatic repeat',async t=>{
  const f=setup(t,({response})=>({...response(),controls:[]}));f.freeze();await assert.rejects(f.service.execute('replication:test'),{code:'BLIND_CONTROLS'});
  assert.equal(f.service.status('replication:test').state,'FAILED');await assert.rejects(f.service.execute('replication:test'),{code:'BLIND_STATE'});assert.throws(()=>f.service.open('replication:test'),{code:'BLIND_STATE'});assert.equal(f.calls,1);assert.equal(f.closes,1);
  assert.deepEqual(f.store.list('blind-rejected-output')[0].data.payload.controls,[]);assert.equal(f.store.list('blind-seal').length,0);
});
test('exposure change during inference invalidates rather than sealing a contaminated result',async t=>{
  const f=setup(t,({store,registry,response})=>{
    const r=store.list('run').find(r=>r.data.mode==='replicator'),context={...r.data.context,sourceIds:['source:unapproved']};
    assert.throws(()=>registry.updateContext(r.id,context),{code:'INFERENCE_PENDING'},'Existing registry already prevents ordinary pending-context changes');
    // Deliberately simulate corruption by trusted controller code to exercise
    // the adapter second-line check, not an available worker permission.
    store.put('run',r.id,{...r.data,context,contextHash:sha256(context)},{expectedVersion:r.version});return response();
  });f.freeze();
  await assert.rejects(f.service.execute('replication:test'),{code:'BLIND_CONTAMINATION'});assert.equal(f.service.status('replication:test').state,'INVALIDATED');assert.throws(()=>f.service.open('replication:test'),{code:'BLIND_STATE'});
});
test('revoked protocol or changed private original blocks use even after a successful seal',async t=>{
  const f=setup(t);f.freeze();await f.service.execute('replication:test');
  const r=f.store.get('artifact',f.p.id);f.store.put('artifact',r.id,{...r.data,status:'INVALIDATED',invalidation:'fixture revocation'},{expectedVersion:r.version});
  assert.throws(()=>f.service.open('replication:test'));assert.equal(f.calls,1);assert.equal(f.store.list('blind-opening').length,0);
});
test('second service cannot duplicate a running provider call or unblind before it completes',async t=>{
  let release;const wait=new Promise(r=>release=r);const f=setup(t,async({response})=>{await wait;return response();});f.freeze();
  const running=f.service.execute('replication:test');
  const other=new BlindReplicationService({store:f.store,authority:f.authority,registry:f.registry,providerFactory:()=>{throw Error('Must not dispatch again');}});
  await assert.rejects(other.execute('replication:test'),{code:'BLIND_STATE'});assert.throws(()=>other.open('replication:test'),{code:'BLIND_STATE'});release();await running;assert.equal(f.calls,1);
});

for(const encoding of ['lossless-v1','lossless-json-v2','source-text-v1'])test(`sealed replica preserves frozen ${encoding} without adding global/private context`,async t=>{
  const f=setup(t),m=f.store.get('mission','m');f.store.put('mission','m',{...m.data,policy:{...m.data.policy,contextEncoding:encoding}},{expectedVersion:m.version});
  f.freeze();await f.service.execute('replication:test');
  const raw=JSON.parse(f.requests[0].input),input=raw.encoding==='sovereign.lossless-context.v2'?unpackJsonContext(raw):raw.encoding==='sovereign.lossless-context.v1'?unpackContext(raw):raw;
  assert.deepEqual(input.publicProtocol,f.protocol.public);assert.deepEqual(Object.keys(input).sort(),['publicProtocol','replicationId','schema']);
  assert.ok(!JSON.stringify(input).includes(f.original.payloadHash));assert.ok(!Object.hasOwn(input,'missionIntent'));
});
test('protocol and policy are frozen; ID conflicts and post-freeze changes cannot start inference',async t=>{
  const f=setup(t);f.freeze();const other=f.create(JSON.stringify(f.protocol),'blind-protocol',BLIND_PROTOCOL_CRITERIA);f.accept(other,[f.original.id]);
  assert.throws(()=>f.service.freeze({replicationId:'replication:test',missionId:'m',protocolArtifactId:other.id}),{code:'BLIND_CONFLICT'});
  const m=f.store.get('mission','m');f.store.put('mission','m',{...m.data,policy:{...m.data.policy,model:'another-model'}},{expectedVersion:m.version});
  await assert.rejects(f.service.execute('replication:test'),{code:'BLIND_INTEGRITY'});assert.equal(f.calls,0);assert.equal(f.store.list('inference-request').length,0);
  assert.equal(f.service.status('replication:test').state,'FROZEN');
});
test('private ID and escaped multiline original tripwires reject a supposedly approved leaking packet',t=>{
  const f=setup(t),multiline=f.create('Private conclusion on line one.\nHidden rationale on line two.');
  for(const [target,text] of [[f.original,f.original.id],[multiline,multiline.payload.body]]){
    const protocol={...f.protocol,original:{artifactId:target.id,hash:target.payloadHash},public:{...f.protocol.public,question:'Premises plus leaked content: '+text}};
    const p=f.create(JSON.stringify(protocol),'blind-protocol',BLIND_PROTOCOL_CRITERIA);f.accept(p,[target.id]);
    assert.throws(()=>f.service.freeze({replicationId:id('replication'),missionId:'m',protocolArtifactId:p.id}),{code:'BLIND_CONTAMINATION'});
  }
  assert.equal(f.store.list('blind-registration').length,0);assert.equal(f.calls,0);
});
test('same provider thread cannot masquerade as independent even with a valid response and request hash',async t=>{
  const f=setup(t),make=f.service.providerFactory;
  f.service.providerFactory=()=>{const provider=make();return {async generate(request){const r=await provider.generate(request);r.receipt.threadId=f.store.get('run',f.original.payload.producerRunId).data.providerThreadId;return r;},close:()=>provider.close()};};
  f.freeze();await assert.rejects(f.service.execute('replication:test'),{code:'BLIND_CONTAMINATION'});assert.equal(f.service.status('replication:test').state,'INVALIDATED');assert.equal(f.store.list('blind-seal').length,0);assert.equal(f.closes,1);
});
test('divergent result and failed control stay exact; neither is erased to match the original',async t=>{
  const f=setup(t,({response})=>({...response(),result:'41',publicArgument:'A deliberately wrong simulated candidate.',controls:[{id:'reverse',verdict:'FAIL',observation:'41 - 25 = 16, not 17.'}],deviations:['The derivation did not meet its reverse check.']}));f.freeze();
  await f.service.execute('replication:test');f.accept(f.service.materialize('replication:test'));
  const opened=f.service.open('replication:test');assert.equal(opened.replica.result,'41');assert.equal(opened.replica.controls[0].verdict,'FAIL');assert.equal(opened.replica.deviations.length,1);
  assert.equal(f.store.get('artifact',f.original.id).data.status,'CANDIDATE');assert.equal(f.store.list('review').length,2,'Synthetic protocol and attempt reviews do not accept the original');
});
test('cancellation before dispatch preserves the frozen attempt; cancellation during dispatch never seals',async t=>{
  const controller=new AbortController(),f=setup(t,({response})=>{controller.abort();return response();});f.freeze();
  const already=new AbortController();already.abort();await assert.rejects(f.service.execute('replication:test',{signal:already.signal}),{code:'CANCELLED'});assert.equal(f.calls,0);assert.equal(f.service.status('replication:test').state,'FROZEN');
  await assert.rejects(f.service.execute('replication:test',{signal:controller.signal}),{code:'CANCELLED'});assert.equal(f.calls,1);assert.equal(f.closes,1);assert.equal(f.service.status('replication:test').state,'FAILED');assert.equal(f.store.list('blind-seal').length,0);
});
test('unrequested private fields are rejected and never retained as public evidence',async t=>{
  const f=setup(t,({response})=>({...response(),privateReasoning:'UNREQUESTED_PRIVATE_SENTINEL'}));f.freeze();await assert.rejects(f.service.execute('replication:test'),{code:'SCHEMA'});
  const rejected=f.store.list('blind-rejected-output');assert.equal(rejected.length,1);assert.equal(rejected[0].data.payloadCaptured,false);assert.equal(rejected[0].data.payload,null);
  assert.equal(f.store.list('blind-returned').length,0);assert.ok(!JSON.stringify(f.store.events({limit:10000})).includes('UNREQUESTED_PRIVATE_SENTINEL'));
});
test('mutated seal or missing/changed opening fails closed, not an idempotent success',async t=>{
  const f=setup(t);f.freeze();await f.service.execute('replication:test');f.accept(f.service.materialize('replication:test'));f.service.open('replication:test');
  const r=f.store.get('blind-opening','replication:test');f.store.put('blind-opening',r.id,r.data,{expectedVersion:r.version});
  assert.throws(()=>f.service.open('replication:test'),{code:'BLIND_INTEGRITY'});assert.equal(f.calls,1);
});
test('bounded context rejects without truncation; native search profile cannot enter a closed replica',t=>{
  const f=setup(t);f.service.maxContextBytes=10;assert.throws(()=>f.freeze(),{code:'CONTEXT_LIMIT'});assert.equal(f.store.list('blind-registration').length,0);
  f.service.maxContextBytes=1024*1024;const m=f.store.get('mission','m');f.store.put('mission','m',{...m.data,policy:{...m.data.policy,instructionProfile:'public-search-v1'}},{expectedVersion:m.version});
  assert.throws(()=>f.freeze(),{code:'BLIND_PROTOCOL'});assert.equal(f.calls,0);
});
test('REAL SQLite/second process: a persisted RUNNING replica cannot be reissued after coordinator replacement',async t=>{
  const directory=mkdtempSync('/tmp/sovereign-blind-process-'),databasePath=join(directory,'state.sqlite');
  let release;const wait=new Promise(r=>release=r);const f=setup(t,async({response})=>{await wait;return response();},databasePath);
  // setup registers its close hook first; filesystem cleanup runs last.
  t.after(()=>rmSync(directory,{recursive:true}));f.freeze();const running=f.service.execute('replication:test');
  const base=new URL('../../factory/lib/',import.meta.url).href;
  const program=`import{Store}from${JSON.stringify(base+'store.mjs')};import{Authority}from${JSON.stringify(base+'authority.mjs')};import{ArtifactRegistry}from${JSON.stringify(base+'artifacts.mjs')};import{BlindReplicationService}from${JSON.stringify(base+'blind-replication.mjs')};const store=new Store(process.argv[1]),authority=new Authority(store),registry=new ArtifactRegistry(store,authority);let calls=0;const service=new BlindReplicationService({store,authority,registry,providerFactory:()=>{calls++;throw Error('No dispatch authorized');}});let code=null;try{await service.execute('replication:test');}catch(e){code=e.code;}console.log(JSON.stringify({state:service.status('replication:test').state,code,calls}));store.close();`;
  try{assert.deepEqual(JSON.parse(execFileSync(process.execPath,['--input-type=module','-e',program,databasePath],{encoding:'utf8',stdio:['ignore','pipe','pipe']})),{state:'RUNNING',code:'BLIND_STATE',calls:0});}finally{release();await running;}
  assert.equal(f.calls,1);assert.ok(f.store.verifyJournal());
});
test('a protocol reviewer seeing the original only AFTER approval cannot backdate target verification',t=>{
  const f=setup(t),p=f.create(JSON.stringify(f.protocol),'blind-protocol',BLIND_PROTOCOL_CRITERIA);const accepted=f.accept(p);
  const review=f.store.get('review',accepted.reviews.at(-1)).data,run=f.store.get('run',review.reviewerRunId).data;
  f.registry.updateContext(run.id,{...run.context,artifactIds:[...run.context.artifactIds,f.original.id]});
  f.registry.attachInference(run.id,{status:'completed',threadId:id('sim-later-thread'),turnId:'later'});
  assert.throws(()=>f.service.freeze({replicationId:'replication:late-context',missionId:'m',protocolArtifactId:p.id}),{code:'BLIND_PROTOCOL'});
  assert.equal(f.store.list('blind-registration').length,0);assert.equal(f.calls,0);
});
test('equivalent explicit content evaluator is accepted without allowing a changed gate',t=>{
  const f=setup(t),p=f.create(JSON.stringify(f.protocol),'blind-protocol',BLIND_PROTOCOL_CRITERIA.map(c=>({...c,evaluation:'content'})));f.accept(p,[f.original.id]);
  assert.equal(f.service.freeze({replicationId:'replication:explicit-evaluation',missionId:'m',protocolArtifactId:p.id}).state,'FROZEN');
});
test('the frozen approval binds historical versions, not later reviewer state or timestamps',async t=>{
  const f=setup(t),accepted=f.store.get('artifact',f.p.id).data,review=f.store.get('review',accepted.reviews.at(-1));
  const historical=f.store.get('run',review.data.reviewerRunId),original=f.store.get('run',f.original.payload.producerRunId);
  f.store.clock=()=> '2000-01-01T00:00:00.000Z'; // deliberately misleading later wall-clock
  f.registry.updateContext(historical.id,{...historical.data.context,instructionsHash:sha256('later task instructions')});
  f.registry.attachInference(historical.id,{status:'completed',threadId:id('sim-later-thread'),turnId:'later'});
  f.freeze();const binding=f.service.registration('replication:test').data.approval;
  assert.deepEqual(binding.reviewer,{type:'run',id:historical.id,version:historical.version,hash:historical.hash});
  assert.deepEqual(binding.originalProducer,{type:'run',id:original.id,version:original.version,hash:original.hash});
  assert.equal(binding.sequence,f.registry.committedSequence('review',review.id,1));
  assert.ok(f.registry.committedSequence('run',historical.id,historical.version)<binding.sequence);
  assert.equal((await f.service.execute('replication:test')).state,'SEALED');
  f.accept(f.service.materialize('replication:test'));
  assert.equal(f.service.open('replication:test').state,'OPENED');
  assert.ok(!f.requests[0].input.includes(review.id));
});
test('rewriting a review head cannot substitute new approval history',t=>{
  const f=setup(t),accepted=f.store.get('artifact',f.p.id).data,review=f.store.get('review',accepted.reviews.at(-1));
  f.store.put('review',review.id,review.data,{expectedVersion:review.version});
  assert.throws(()=>f.freeze(),{code:'BLIND_PROTOCOL'});assert.equal(f.calls,0);
  assert.equal(f.store.list('blind-registration').length,0);
});
test('an earlier favorable review cannot compensate for the last approval lacking original exposure',t=>{
  const f=setup(t),accepted=f.store.get('artifact',f.p.id);
  // Deliberate trusted-controller corruption: retain a prior good ACCEPT while
  // reopening the candidate and adding a newer incomplete ACCEPT through registry.
  // A returned candidate requires producer correction; CANDIDATE is the only
  // state from which the adversarial-acceptance fixture can be registered.
  f.store.put('artifact',f.p.id,{...accepted.data,status:'CANDIDATE'},{expectedVersion:accepted.version});
  f.accept(f.p);
  assert.throws(()=>f.freeze(),{code:'BLIND_PROTOCOL'});assert.equal(f.calls,0);
});
test('non-content protocol gates are not equivalent to semantic acceptance',t=>{
  const f=setup(t),p=f.create(JSON.stringify(f.protocol),'blind-protocol',BLIND_PROTOCOL_CRITERIA.map(c=>({...c,evaluation:'runtime.independent_review'})));
  const reviewer=f.run('reviewer',p.payload.purpose,[p.id,f.original.id]);
  const accepted=f.registry.review({artifactId:p.id,reviewerRunId:reviewer.id,result:{artifactHash:p.payloadHash,
    purpose:p.payload.purpose,decision:'ACCEPT',checks:[],findings:[],uncertainty:'Synthetic runtime-only review; not semantic approval.'}});
  assert.equal(accepted.status,'ACCEPTED');
  assert.equal(f.registry.assertUsable(p.id,{missionId:'m',purpose:'blind-protocol'}).payloadHash,p.payloadHash,
    'The candidate is immutable and genuinely passes its declared runtime-only gates');
  assert.throws(()=>f.service.freeze({replicationId:'replication:runtime-gates',missionId:'m',protocolArtifactId:p.id}),{code:'BLIND_PROTOCOL'});
  assert.equal(f.calls,0);assert.equal(f.store.list('blind-registration').length,0);
});
test('coordinated candidate and review-head rewrites fail the original input-review binding before blind protocol use',t=>{
  const f=setup(t),p=f.create(JSON.stringify(f.protocol),'blind-protocol',BLIND_PROTOCOL_CRITERIA),accepted=f.accept(p,[f.original.id]);
  // Deliberately alter trusted artifact/review records together, with matching
  // hashes. New reviews bind the original candidate, so corruption must be
  // rejected before the blind protocol's separate exact-evaluator guard.
  const record=f.store.get('artifact',p.id),payload={...record.data.payload,criteria:BLIND_PROTOCOL_CRITERIA.map(c=>({...c,evaluation:'runtime.independent_review'}))};
  const old=f.store.get('review',accepted.reviews.at(-1)).data,newId=id('review');
  f.store.put('review',newId,{...old,id:newId,result:{...old.result,artifactHash:sha256(payload)}},{expectedVersion:0});
  f.store.put('artifact',p.id,{...record.data,payload,payloadHash:sha256(payload),reviews:[newId]},{expectedVersion:record.version});
  assert.equal(f.store.get('artifact',p.id,1).data.payloadHash,p.payloadHash);
  assert.throws(()=>f.service.freeze({replicationId:'replication:runtime-gates',missionId:'m',protocolArtifactId:p.id}),{code:'INPUT_REVIEW_INTEGRITY'});
  assert.equal(f.calls,0);assert.equal(f.store.list('blind-registration').length,0);
});
test('sealed replica history can reach an independent material reviewer without pretending ordinary feedback coverage',async t=>{
  const f=setup(t),frozen=f.freeze();await f.service.execute('replication:test');
  // Integration fixture only: the production planner does not materialize or
  // accept a sealed attempt yet. Exercise its real registry/evidence boundary.
  const candidate=f.registry.create({missionId:'m',nodeId:'replication:test',producerRunId:frozen.runId,
    kind:'sealed-attempt-fixture',purpose:'reproduce-sum',body:JSON.stringify(f.response()),
    criteria:[{id:'method',text:'Assess the public method and controls, not mere agreement with an original.'}]});
  const reviewer=f.run('reviewer',candidate.payload.purpose,[candidate.id]);
  const observations=f.registry.captureRuntimeObservations(reviewer.id),o=observations.find(o=>o.kind==='artifact-production-scope');
  const r=f.store.get('run',reviewer.id).data,detail=f.registry.runtimeReference({kind:'runtime',id:o.id,hash:o.hash,quote:o.quoteText},r).detail;
  assert.equal(detail.attempts.length,1);assert.equal(detail.attempts[0].mode,'replicator');
  assert.equal(detail.attempts[0].requests.length,1);
  assert.equal(detail.attempts[0].requests[0].requestHash,inferenceRequestHash(f.requests[0]));
  assert.equal(detail.attempts[0].requests[0].producerInput.coverage,'UNSUPPORTED_INPUT_SHAPE');
  assert.ok(!Object.hasOwn(detail.attempts[0].requests[0].producerInput,'feedback'),'Closed packets are not ordinary worker feedback contracts');
  assert.equal(f.store.get('artifact',candidate.id).data.status,'CANDIDATE');
  assert.throws(()=>f.registry.assertUsable(candidate.id,{missionId:'m',purpose:candidate.payload.purpose}),{code:'UNACCEPTED_INPUT'});
  assert.equal(f.calls,1);assert.equal(f.store.list('effect').length,0);
  assert.ok(!JSON.stringify(observations).includes(f.original.payload.body));
  assert.equal(f.store.list('blind-opening').length,0);
});
test('materialization is exact, idempotent, public-only and ordered after seal; candidate is not acceptance',async t=>{
  const f=setup(t);f.freeze();assert.throws(()=>f.service.materialize('replication:test'),{code:'BLIND_STATE'});
  await f.service.execute('replication:test');const a=f.service.materialize('replication:test'),before=f.store.verifyJournal();
  assert.deepEqual(f.service.materialize('replication:test'),a);assert.deepEqual(f.store.verifyJournal(),before);
  assert.equal(a.status,'CANDIDATE');assert.throws(()=>f.service.open('replication:test'),{code:'UNACCEPTED_INPUT'});
  const evidence=blindMaterialEvidence(f.registry,a.id),order=evidence.chronology;
  assert.ok(order.registration<order.request&&order.request<order.completedRun&&order.completedRun<order.seal&&order.seal<order.candidate&&order.candidate<order.binding);
  assert.deepEqual(evidence.result,f.response());assert.deepEqual(evidence.publicProtocol,f.protocol.public);
  assert.equal(inferenceRequestHash(evidence.request),inferenceRequestHash(f.requests[0]));
  for(const secret of [f.original.id,f.original.payloadHash,f.original.payload.body,f.p.id,f.p.payloadHash])assert.ok(!JSON.stringify(evidence).includes(secret));
  assert.equal(f.calls,1);assert.equal(f.store.list('effect').length,0);
});
test('a copied body cannot borrow another artifact seal; failed materialization never accepts or replaces output',async t=>{
  const f=setup(t);f.freeze();await f.service.execute('replication:test');const a=f.service.materialize('replication:test');
  const copied=f.registry.create({...a.payload});assert.notEqual(copied.id,a.id);
  assert.throws(()=>blindMaterialEvidence(f.registry,copied.id),{code:'BLIND_MATERIAL'});
  const reviewer=f.run('reviewer',a.payload.purpose,[copied.id]);
  assert.throws(()=>f.registry.captureRuntimeObservations(reviewer.id),{code:'BLIND_MATERIAL'});
  assert.deepEqual(f.service.materialize('replication:test'),a);assert.equal(f.calls,1);
});
test('material acceptance cannot cite only its own claims; authenticated binding must be observed and used',async t=>{
  const f=setup(t);f.freeze();await f.service.execute('replication:test');const a=f.service.materialize('replication:test');
  const r=f.run('reviewer',a.payload.purpose,[a.id]);
  const result={artifactHash:a.payloadHash,purpose:a.payload.purpose,decision:'ACCEPT',checks:a.payload.criteria.map(c=>({criterionId:c.id,verdict:'PASS',reason:'Deliberately insufficient synthetic evidence.',evidence:[{kind:'artifact',id:a.id,hash:a.payloadHash,quote:a.payload.body}]})),findings:[],uncertainty:''};
  assert.throws(()=>f.registry.review({artifactId:a.id,reviewerRunId:r.id,result}),{code:'BLIND_REVIEW_PROOF'});
  assert.equal(f.store.get('artifact',a.id).data.status,'CANDIDATE');assert.equal(f.store.list('blind-opening').length,0);
  f.accept(a);assert.equal(f.service.open('replication:test').state,'OPENED');
});
test('revoked protocol invalidates current material use while historical public proof remains readable',async t=>{
  const f=setup(t);f.freeze();await f.service.execute('replication:test');const a=f.service.materialize('replication:test');f.accept(a);
  const evidence=blindMaterialEvidence(f.registry,a.id),r=f.store.get('artifact',f.p.id);
  f.store.put('artifact',f.p.id,{...r.data,status:'INVALIDATED'},{expectedVersion:r.version});
  assert.throws(()=>f.registry.assertUsable(a.id,{missionId:'m',purpose:a.payload.purpose}),{code:'BLIND_MATERIAL'});
  assert.throws(()=>f.service.open('replication:test'));assert.deepEqual(blindMaterialEvidence(f.registry,a.id,{current:false}),evidence);
  assert.equal(f.store.list('blind-opening').length,0);assert.equal(f.calls,1);
});
test('actor-scoped material evidence cannot be transferred or survive new replica operations as current proof',async t=>{
  const f=setup(t);f.freeze();await f.service.execute('replication:test');const a=f.service.materialize('replication:test');
  const r=f.run('reviewer',a.payload.purpose,[a.id]),o=f.registry.captureRuntimeObservations(r.id).find(o=>o.kind==='artifact-blind-material');
  const actual=f.store.get('run',r.id).data,proof={kind:'runtime',id:o.id,hash:o.hash,quote:o.quoteText};
  const original=f.registry.runtimeReference(proof,actual).detail,other=f.run('reviewer',a.payload.purpose,[a.id]);
  assert.throws(()=>f.registry.runtimeReference(proof,other),{code:'UNOBSERVED_RUNTIME'});
  f.store.put('effect','replica:injected-intent',{missionId:'m',principalId:a.payload.producerRunId,tool:'workspace.write',state:'PREPARED'},{expectedVersion:0});
  assert.throws(()=>f.registry.runtimeReference(proof,actual),{code:'BLIND_MATERIAL'});
  assert.deepEqual(f.registry.runtimeReference(proof,actual,{current:false}).detail,original);
});
test('material reviewer exposed to the private original is rejected before assessment and cannot unblind',async t=>{
  const f=setup(t);f.freeze();await f.service.execute('replication:test');const a=f.service.materialize('replication:test');
  assert.throws(()=>f.accept(a,[f.original.id]),{code:'BLIND_REVIEW_CONTEXT'});
  assert.throws(()=>f.service.open('replication:test'),{code:'UNACCEPTED_INPUT'});assert.equal(f.store.list('blind-opening').length,0);
});
for(const [contextEncoding,reviewEncoding] of [['plain-json','expanded-json'],['lossless-v1','evidence-refs-v1'],['lossless-json-v2','evidence-catalog-v1'],['source-text-v1','evidence-catalog-v1']])test(`WorkerService reuses independent bound material review: ${contextEncoding}/${reviewEncoding}`,async t=>{
  const f=setup(t,null,':memory:','Private original is PRIVATE_ORIGINAL_RESULT_AND_RATIONALE_971; independently replicate without seeing it.');
  const m=f.store.get('mission','m');f.store.put('mission','m',{...m.data,policy:{...m.data.policy,contextEncoding,reviewEncoding}},{expectedVersion:m.version});
  f.freeze();await f.service.execute('replication:test');const a=f.service.materialize('replication:test');let reviews=0;
  f.store.put('queue-job','m',{missionId:'m',status:'RUNNING',privateRoute:'PRIVATE_AMBIENT_QUEUE_SENTINEL'},{expectedVersion:0});
  const providerFactory=()=>({async generate(request){
    reviews++;const input=readSourceContextView(request.input),o=input.runtimeObservations.find(o=>o.kind==='artifact-blind-material');
    assert.ok(o);assert.ok(request.schema.description.includes('artifact-blind-material'));
    assert.ok(!request.input.includes(f.original.payload.body));assert.equal(input.artifacts.length,1);
    assert.ok(!request.input.includes('PRIVATE_AMBIENT_QUEUE_SENTINEL'));
    assert.ok(!Object.hasOwn(input,'missionIntent'),'The private global request is not the public attempt review mandate');
    assert.equal(input.publicReviewMandate.schema,'sovereign.closed-blind-review.v1');
    assert.ok(input.runtimeObservations.every(o=>['artifact-blind-material','artifact-production-scope','node-effect-inventory'].includes(o.kind)));
    const expanded={artifactHash:a.payloadHash,purpose:a.payload.purpose,decision:'ACCEPT',checks:a.payload.criteria.map(c=>({criterionId:c.id,verdict:'PASS',reason:'SIMULATED substantive judgment; this test verifies integration only.',evidence:[{kind:'artifact',id:a.id,hash:a.payloadHash,quote:a.payload.body},{kind:'runtime',id:o.id,hash:o.hash,quote:o.quoteText}]})),findings:[],uncertainty:'Simulation, not real semantic qualification.'};
    const value=reviewEncoding==='evidence-catalog-v1'?compactCatalogReview(expanded,JSON.parse(input.task).observedEvidenceCatalog)
      :reviewEncoding==='evidence-refs-v1'?compactReviewEvidence(expanded):expanded;
    await request.validate(value);return {value,receipt:{status:'completed',simulation:true,threadId:id('sim-worker-review'),turnId:'review',model:request.model,reasoningEffort:request.reasoningEffort,contextHash:inferenceRequestHash(request)}};
  },async close(){}});
  // No tool operation is requested. Every method that could operate is absent;
  // the capability queries are read-only, explicitly false test doubles.
  const broker={executionAvailable:()=>false,searchAvailable:()=>false};
  const workers=new WorkerService({store:f.store,authority:f.authority,registry:f.registry,broker,providerFactory,
    learningInstructionsResolver:()=>{throw Error('Unqualified overlays cannot enter closed assessment');}});
  await assert.rejects(workers.review({artifact:a,reviewerRoleIds:['sigma_02'],missionIntent:f.store.get('mission','m').data.intent,feedback:[{hint:'PRIVATE_ORIGINAL_HINT'}]}),{code:'BLIND_REVIEW_CONTEXT'});
  assert.equal(reviews,0);
  const accepted=await workers.review({artifact:a,reviewerRoleIds:['sigma_02'],missionIntent:f.store.get('mission','m').data.intent});
  assert.equal(accepted.status,'ACCEPTED');assert.equal(reviews,1);assert.equal(f.calls,1);assert.equal(f.store.list('effect').length,0);
  assert.equal(f.service.open('replication:test').state,'OPENED');assert.equal(f.store.get('artifact',f.original.id).data.status,'CANDIDATE');
});
test('closed material review does not import private arguments from ambient execution history',async t=>{
  const f=setup(t);f.freeze();await f.service.execute('replication:test');const a=f.service.materialize('replication:test');
  const args={argv:['node','-e',f.original.payload.body],cwd:'.'},binding={missionId:'m',
    principalId:f.original.payload.producerRunId,tool:'execution.run',argsHash:sha256(args)};
  // Prepared control-plane fixtures only. No private command is dispatched.
  f.store.put('effect','private-ambient-execution',{...binding,state:'PREPARED',startedAt:'2026-09-13T12:00:00.000Z'},{expectedVersion:0});
  f.store.put('execution-job','private-ambient-execution',{...binding,args,state:'PREPARED',mode:'snapshot-discard',
    manifest:[],snapshotHash:sha256([])},{expectedVersion:0});
  const reviewer=f.run('reviewer',a.payload.purpose,[a.id]);f.registry.captureRuntimeObservations(reviewer.id);
  const observations=f.store.get('run',reviewer.id).data.runtimeObservations;
  assert.ok(observations.length>0);assert.equal(observations.some(o=>o.kind==='execution-history'),false);
  assert.equal(canonical(observations).includes(f.original.payload.body),false);
  assert.equal(canonical(observations).includes('private-ambient-execution'),false);
  assert.equal(f.calls,1);assert.equal(f.store.get('effect','private-ambient-execution').data.state,'PREPARED');
});
test('a material RETURN preserves the exact failed attempt without unblinding or another production call',async t=>{
  const f=setup(t);f.freeze();await f.service.execute('replication:test');const a=f.service.materialize('replication:test');
  const r=f.run('reviewer',a.payload.purpose,[a.id]),o=f.registry.captureRuntimeObservations(r.id).find(o=>o.kind==='artifact-blind-material');
  f.registry.attachInference(r.id,{status:'completed',threadId:id('sim-return-review'),turnId:'return',simulation:true});
  const returned=f.registry.review({artifactId:a.id,reviewerRunId:r.id,result:{artifactHash:a.payloadHash,purpose:a.payload.purpose,decision:'RETURN',
    checks:a.payload.criteria.map((c,i)=>({criterionId:c.id,verdict:i===1?'FAIL':'PASS',reason:'SIMULATED method rejection.',evidence:[{kind:'runtime',id:o.id,hash:o.hash,quote:o.quoteText}]})),
    findings:[{severity:'material',description:'Synthetic method objection.',recovery:'A different preregistered attempt would be needed; do not edit this seal.'}],uncertainty:''}});
  assert.equal(returned.status,'RETURNED');assert.deepEqual(f.service.materialize('replication:test'),returned);
  assert.throws(()=>f.service.open('replication:test'),{code:'UNACCEPTED_INPUT'});
  assert.equal((await f.service.execute('replication:test')).state,'SEALED');assert.equal(f.calls,1);
  assert.equal(f.store.get('artifact',a.id).data.payloadHash,a.payloadHash);assert.equal(f.store.list('blind-opening').length,0);
});
test('earlier ambient history cannot be removed to retrofit a closed reviewer',async t=>{
  const f=setup(t);f.freeze();await f.service.execute('replication:test');const a=f.service.materialize('replication:test');
  const r=f.run('reviewer',a.payload.purpose,[]);f.registry.captureRuntimeObservations(r.id);
  f.registry.updateContext(r.id,{...f.store.get('run',r.id).data.context,artifactIds:[a.id]});
  assert.throws(()=>f.registry.captureRuntimeObservations(r.id),{code:'BLIND_REVIEW_CONTEXT'});
  assert.ok(f.store.get('run',r.id).data.runtimeObservations.some(o=>o.kind==='effect-inventory'));
  assert.equal(f.store.list('blind-opening').length,0);
});
for(const encoding of ['plain-json','source-text-v1'])test(`an earlier ordinary ${encoding} request cannot be laundered into a closed review through empty document lists`,async t=>{
  const f=setup(t);f.freeze();await f.service.execute('replication:test');const a=f.service.materialize('replication:test');
  const r=f.run('reviewer',a.payload.purpose,[]);
  const logical={missionIntent:f.original.payload.body};
  const requestHash=f.registry.recordInferenceRequest(r.id,{instructions:'Ordinary prior task',input:encoding==='source-text-v1'?packSourceContextView(logical).input:JSON.stringify(logical),schema:{type:'object'}});
  f.registry.attachInference(r.id,{status:'completed',threadId:id('sim-private-prior'),turnId:'prior',contextHash:requestHash,simulation:true});
  f.registry.updateContext(r.id,{...f.store.get('run',r.id).data.context,artifactIds:[a.id]});
  assert.throws(()=>f.registry.captureRuntimeObservations(r.id),{code:'BLIND_REVIEW_CONTEXT'});
  assert.equal(f.store.get('artifact',a.id).data.status,'CANDIDATE');assert.equal(f.store.list('blind-opening').length,0);
});
test('altered material binding and post-seal exposure cannot be silently reused',async t=>{
  const f=setup(t);f.freeze();await f.service.execute('replication:test');const a=f.service.materialize('replication:test');
  const run=f.store.get('run',a.payload.producerRunId);
  f.registry.updateContext(run.id,{...run.data.context,instructionsHash:sha256('post-seal extra instructions')});
  assert.throws(()=>blindMaterialEvidence(f.registry,a.id),{code:'BLIND_MATERIAL'});
  assert.throws(()=>f.service.materialize('replication:test'),{code:'BLIND_CONTAMINATION'});
  const record=f.store.get('blind-material','replication:test');f.store.put('blind-material',record.id,record.data,{expectedVersion:record.version});
  assert.throws(()=>blindMaterialEvidence(f.registry,a.id,{current:false}),{code:'BLIND_MATERIAL'});
  assert.equal(f.calls,1);assert.equal(f.store.list('blind-opening').length,0);
});
test('missing reviewer journal order cannot be treated as an earlier valid approval',async t=>{
  const f=setup(t);f.freeze();await f.service.execute('replication:test');const a=f.accept(f.service.materialize('replication:test'));
  const reviewerId=f.store.get('review',a.reviews.at(-1)).data.reviewerRunId,sequence=f.registry.committedSequence.bind(f.registry);
  f.registry.committedSequence=(type,id,version)=>type==='run'&&id===reviewerId?null:sequence(type,id,version);
  assert.throws(()=>f.service.open('replication:test'),{code:'BLIND_REVIEW'});assert.equal(f.store.list('blind-opening').length,0);
});

async function comparisonFixture(t,{original='42',result='42',rule={kind:'exact-text-v1'},overrides={},databasePath=':memory:'}={}){
  const f=setup(t,({response})=>({...response(),result,...overrides}),databasePath),target=f.create(original);
  const protocol={...f.protocol,original:{artifactId:target.id,hash:target.payloadHash},public:{...f.protocol.public,comparison:rule}};
  const acceptedProtocol=f.create(JSON.stringify(protocol),'blind-protocol',BLIND_PROTOCOL_CRITERIA);f.accept(acceptedProtocol,[target.id]);
  f.service.freeze({replicationId:'replication:oracle',missionId:'m',protocolArtifactId:acceptedProtocol.id});
  await f.service.execute('replication:oracle');const material=f.accept(f.service.materialize('replication:oracle'));
  return {...f,target,acceptedProtocol,material,compare:()=>f.service.compare('replication:oracle')};
}
test('deterministic comparison follows accepted material/opening without inference or promoting the original',async t=>{
  const f=await comparisonFixture(t),before=f.store.list('inference-request').length,original=f.store.get('artifact',f.target.id);
  const a=f.compare(),body=JSON.parse(a.payload.body),proof=blindComparisonEvidence(f.registry,a.id);
  assert.equal(a.status,'CANDIDATE');assert.equal(a.payload.purpose,BLIND_COMPARISON_PURPOSE);assert.equal(a.payload.kind,'deterministic-result');
  assert.equal(body.comparison.outcome,'MATCH');assert.equal(body.comparison.replicationEstablished,false);
  assert.deepEqual(f.compare(),a);assert.equal(f.store.list('inference-request').length,before);
  assert.deepEqual(f.store.get('artifact',f.target.id),original);assert.equal(f.store.list('blind-comparison').length,1);
  assert.ok(proof.chronology.review<proof.chronology.opening);assert.ok(proof.chronology.opening<proof.chronology.run);
  assert.ok(proof.chronology.run<proof.chronology.candidate);assert.ok(f.store.verifyJournal());
  const accepted=f.accept(a);assert.equal(accepted.status,'ACCEPTED');
  assert.equal(f.registry.assertUsable(a.id,{missionId:'m',purpose:BLIND_COMPARISON_PURPOSE}).id,a.id);
  assert.equal(f.store.get('artifact',f.target.id).data.status,'CANDIDATE');
});
test('post-opening comparison exposes the exact historical protocol approval without leaking it into material review',async t=>{
  const f=await comparisonFixture(t),a=f.compare(),proof=blindComparisonEvidence(f.registry,a.id);
  const prior=proof.protocolApproval,registration=f.store.get('blind-registration','replication:oracle');
  const frozen=registration.data.signed.data,review=f.store.get('review',frozen.approval.review.id);
  assert.ok(prior,'Final reviewer needs actual protocol approval provenance, not merely a prospective promise');
  assert.deepEqual(prior.registration,{type:registration.type,id:registration.id,version:registration.version,hash:registration.hash});
  assert.deepEqual(prior.protocol,frozen.protocolRef);
  assert.deepEqual(prior.approval,frozen.approval);
  assert.equal(prior.approval.review.id,review.id);
  assert.deepEqual(prior.reviewResult,review.data.result,'The full prior judgment and citations remain inspectable, not just an approval label');
  assert.deepEqual(prior.observedTargets,[{id:f.acceptedProtocol.id,hash:f.acceptedProtocol.payloadHash},{id:f.target.id,hash:f.target.payloadHash}]);
  assert.ok(prior.chronology.original<prior.chronology.reviewer);
  assert.ok(prior.chronology.reviewer<prior.chronology.review);
  assert.ok(prior.chronology.review<prior.chronology.protocol);
  assert.ok(prior.chronology.protocol<prior.chronology.registration);
  assert.ok(prior.chronology.registration<prior.chronology.replicaRequest);
  const material=JSON.stringify(blindMaterialEvidence(f.registry,f.material.id));
  for(const hidden of [f.acceptedProtocol.id,f.acceptedProtocol.payloadHash,f.target.id,f.target.payloadHash,review.id,frozen.approval.reviewer.id])assert.ok(!material.includes(hidden),hidden);
  const reviewer=f.run('reviewer',a.payload.purpose,[a.id]);
  const observation=f.registry.captureRuntimeObservations(reviewer.id).find(o=>o.kind==='artifact-blind-comparison');
  assert.deepEqual(JSON.parse(observation.quoteText).detail.protocolApproval,prior);
  const before=f.store.list('run').length;
  assert.deepEqual(blindComparisonEvidence(f.registry,a.id).protocolApproval,prior);
  assert.equal(f.store.list('run').length,before,'Projecting history cannot dispatch a new actor');
});
test('later protocol reviewer exposure cannot change the prior approval in a comparison observation',async t=>{
  const f=await comparisonFixture(t),a=f.compare(),before=blindComparisonEvidence(f.registry,a.id);
  const run=f.store.get('run',before.protocolApproval.approval.reviewer.id);
  f.registry.updateContext(run.id,{...run.data.context,instructionsHash:sha256('Additional later instructions, not a historical approval')});
  f.registry.attachInference(run.id,{status:'completed',simulation:true,threadId:id('sim-later-protocol-review'),turnId:'later'});
  assert.ok(f.store.get('run',run.id).version>before.protocolApproval.approval.reviewer.version);
  assert.deepEqual(blindComparisonEvidence(f.registry,a.id),before);
  assert.deepEqual(blindComparisonEvidence(f.registry,a.id,{current:false}),before);
});
test('missing or backdated protocol approval evidence cannot be displayed as a valid earlier gate',async t=>{
  const f=await comparisonFixture(t),a=f.compare(),proof=blindComparisonEvidence(f.registry,a.id);
  const sequence=f.registry.committedSequence.bind(f.registry),ref=proof.protocolApproval.approval.review;
  f.registry.committedSequence=(type,id,version)=>type===ref.type&&id===ref.id?null:sequence(type,id,version);
  assert.throws(()=>blindComparisonEvidence(f.registry,a.id),{code:'BLIND_PROTOCOL'});
  f.registry.committedSequence=(type,id,version)=>type===ref.type&&id===ref.id?proof.protocolApproval.chronology.replicaRequest+1:sequence(type,id,version);
  assert.throws(()=>blindComparisonEvidence(f.registry,a.id),{code:'BLIND_COMPARISON'});
  f.registry.committedSequence=sequence;
  assert.deepEqual(blindComparisonEvidence(f.registry,a.id),proof);
});
test('missing frozen protocol history cannot borrow the comparison report as proof of prior approval',async t=>{
  const f=await comparisonFixture(t),a=f.compare(),proof=blindComparisonEvidence(f.registry,a.id);
  const get=f.store.get.bind(f.store),ref=proof.protocolApproval.protocol;
  f.store.get=(type,id,version)=>type===ref.type&&id===ref.id&&version===ref.version?null:get(type,id,version);
  assert.throws(()=>blindComparisonEvidence(f.registry,a.id,{current:false}));
  f.store.get=get;assert.deepEqual(blindComparisonEvidence(f.registry,a.id),proof);
});

function historicalComparisonObservation(f,a,mutate=()=>{}){
  const actor=f.run('reviewer',a.payload.purpose,[a.id]);
  const detail=blindComparisonEvidence(f.registry,a.id,{approvalEvidence:'legacy',exposureEvidence:'legacy'});mutate(detail);
  // Simulate bytes signed by the previous runtime BEFORE this actor's review.
  // Do not remove or rewrite a real observation that already committed.
  const data={id:id('runtime-observation'),missionId:'m',runId:actor.id,intentHash:f.store.get('mission','m').data.intentHash,
    capturedAt:new Date().toISOString(),kind:'artifact-blind-comparison',detail};
  const signed=f.authority.seal('runtime.observation',data);
  f.store.put('runtime-observation',data.id,{signed},{expectedVersion:0});
  const observation={id:data.id,hash:sha256(signed),kind:data.kind,quoteText:canonical(data)},run=f.store.get('run',actor.id);
  f.store.put('run',run.id,{...run.data,runtimeObservations:[observation]},{expectedVersion:run.version});
  f.registry.attachInference(run.id,{status:'completed',simulation:true,threadId:id('sim-historical-format'),turnId:'old-format'});
  return {run:f.store.get('run',run.id).data,observation,evidence:{...observation,quote:observation.quoteText}};
}
test('legacy comparison observation stays valid without backdating new approval exposure',async t=>{
  const f=await comparisonFixture(t),a=f.compare(),old=historicalComparisonObservation(f,a);
  const historical=f.registry.runtimeReference(old.evidence,old.run,{current:false});
  assert.equal(Object.hasOwn(historical.detail,'protocolApproval'),false);
  assert.deepEqual(f.registry.runtimeReference(old.evidence,old.run),historical);
  const added=f.registry.captureRuntimeObservations(old.run.id).find(o=>o.kind==='artifact-blind-comparison');
  assert.ok(added);assert.notEqual(added.id,old.observation.id);
  const now=f.store.get('run',old.run.id).data;
  assert.equal(now.runtimeObservations.filter(o=>o.kind==='artifact-blind-comparison').length,2);
  assert.throws(()=>f.registry.requireCompletedExposure(now),{code:'UNOBSERVED_CONTEXT'},'New exposure requires a new completed inference');
  assert.ok(f.registry.runtimeReference({...added,quote:added.quoteText},now).detail.protocolApproval.reviewResult);
  assert.deepEqual(f.registry.runtimeReference(old.evidence,old.run,{current:false}),historical);
});
test('legacy format never licenses a changed report or partially erased enhanced proof',async t=>{
  const f=await comparisonFixture(t),a=f.compare();
  const bad=historicalComparisonObservation(f,a,d=>{d.report.comparison.outcome='UNKNOWN';});
  assert.throws(()=>f.registry.runtimeReference(bad.evidence,bad.run,{current:false}),{code:'RUNTIME_INTEGRITY'});
  const partial=historicalComparisonObservation(f,a,d=>{d.protocolApproval={approval:{}};});
  assert.throws(()=>f.registry.runtimeReference(partial.evidence,partial.run,{current:false}),{code:'RUNTIME_INTEGRITY'});
});
test('protocol-approval-only historical format cannot acquire bilateral knowledge retroactively',async t=>{
  const f=await comparisonFixture(t),a=f.compare();
  const old=historicalComparisonObservation(f,a,d=>{d.protocolApproval=blindComparisonEvidence(f.registry,a.id).protocolApproval;});
  const prior=f.registry.runtimeReference(old.evidence,old.run);
  assert.ok(prior.detail.protocolApproval);assert.equal(Object.hasOwn(prior.detail,'closedExposure'),false);
  assert.deepEqual(f.registry.runtimeReference(old.evidence,old.run,{current:false}),prior);
  const fresh=f.registry.captureRuntimeObservations(old.run.id).find(o=>o.kind==='artifact-blind-comparison');
  assert.notEqual(fresh.id,old.observation.id);assert.ok(JSON.parse(fresh.quoteText).detail.closedExposure);
  assert.throws(()=>f.registry.requireCompletedExposure(f.store.get('run',old.run.id).data),{code:'UNOBSERVED_CONTEXT'});
  const partial=historicalComparisonObservation(f,a,d=>{d.closedExposure={schema:'sovereign.closed-exposure.v1'};});
  assert.throws(()=>f.registry.runtimeReference(partial.evidence,partial.run,{current:false}),{code:'RUNTIME_INTEGRITY'});
});
test('one accepted-report revalidation reuses chronology lookup without skipping its evidence checks',async t=>{
  const f=await comparisonFixture(t),a=f.compare();f.accept(a);
  const events=f.store.events.bind(f.store),reference=f.registry.runtimeReference.bind(f.registry);
  let pages=0,references=0;f.store.events=options=>{pages++;return events(options);};
  f.registry.runtimeReference=(...args)=>{references++;return reference(...args);};
  assert.equal(f.registry.assertUsable(a.id,{missionId:'m',purpose:a.payload.purpose}).id,a.id);
  assert.ok(references>=5,'Repeated citations still receive their individual evidence validation');
  assert.ok(pages<=4,`Repeated full-history scans were not eliminated: ${pages} pages`);
  t.diagnostic(`Chronology pages in one validation: ${pages}; individual runtime evidence checks: ${references}`);
  const first=pages;f.registry.assertUsable(a.id,{missionId:'m',purpose:a.payload.purpose});
  assert.ok(pages>first,'An independent public revalidation gets fresh chronology, not a cross-call approval cache');
});
test('chronology lookup cannot preserve an uncommitted event after its transaction rolls back',async t=>{
  const f=await comparisonFixture(t),a=f.compare();f.accept(a);
  const reference=f.registry.runtimeReference.bind(f.registry);let injected=false;
  f.registry.runtimeReference=(...args)=>{
    if(!injected){
      injected=true;const marker=new Error('Deliberate isolated rollback');
      assert.throws(()=>f.store.transact(()=>{
        f.store.put('test-probe','rolled-back',{value:1},{expectedVersion:0});
        assert.ok(f.registry.committedSequence('test-probe','rolled-back',1)>0);
        throw marker;
      }),error=>error===marker);
      assert.equal(f.store.get('test-probe','rolled-back'),null);
      assert.equal(f.registry.committedSequence('test-probe','rolled-back',1),null,'A rolled-back position is not a committed prerequisite');
    }
    return reference(...args);
  };
  assert.equal(f.registry.assertUsable(a.id,{missionId:'m',purpose:a.payload.purpose}).id,a.id);
  assert.ok(injected);assert.ok(f.store.verifyJournal());
});
test('chronology lookup observes another connection commit inside the same validation scope',async t=>{
  const dir=mkdtempSync('/tmp/chronology-cross-'),path=join(dir,'state.sqlite');
  const f=await comparisonFixture(t,{databasePath:path}),a=f.compare();f.accept(a);
  const writer=new Store(path);t.after(()=>{writer.close();rmSync(dir,{recursive:true,force:true});});
  const reference=f.registry.runtimeReference.bind(f.registry);let injected=false;
  f.registry.runtimeReference=(...args)=>{
    if(!injected){
      injected=true;assert.equal(f.registry.committedSequence('test-probe','external',1),null);
      writer.put('test-probe','external',{value:1},{expectedVersion:0});
      assert.ok(f.registry.committedSequence('test-probe','external',1)>0,'A separate connection invalidates the position index');
    }
    return reference(...args);
  };
  assert.equal(f.registry.assertUsable(a.id,{missionId:'m',purpose:a.payload.purpose}).id,a.id);
  assert.ok(injected);assert.ok(f.store.verifyJournal());
});
test('a replaced journal reader cannot borrow an earlier cached prerequisite sequence',async t=>{
  const f=await comparisonFixture(t),a=f.compare();f.accept(a);
  const reference=f.registry.runtimeReference.bind(f.registry);let injected=false;
  f.registry.runtimeReference=(...args)=>{
    if(!injected){
      injected=true;const id='replication:oracle',events=f.store.events;
      assert.ok(f.registry.committedSequence('blind-registration',id,1)>0);
      f.store.events=options=>events.call(f.store,options).filter(e=>!(e.kind==='record.committed'&&e.data.type==='blind-registration'&&e.data.id===id));
      assert.equal(f.registry.committedSequence('blind-registration',id,1),null);
      f.store.events=events;assert.ok(f.registry.committedSequence('blind-registration',id,1)>0);
    }
    return reference(...args);
  };
  assert.equal(f.registry.assertUsable(a.id,{missionId:'m',purpose:a.payload.purpose}).id,a.id);
  assert.ok(injected);
});
test('legacy protocol cannot invent a comparison rule after the sealed result exists',async t=>{
  const f=setup(t);f.freeze();await f.service.execute('replication:test');f.accept(f.service.materialize('replication:test'));
  assert.throws(()=>f.service.compare('replication:test'),{code:'BLIND_COMPARISON_RULE'});
  assert.equal(f.store.list('blind-opening').length,0);assert.equal(f.store.list('blind-comparison').length,0);
});
test('deterministic comparison still requires material review before opening',async t=>{
  const f=setup(t),protocol={...f.protocol,public:{...f.protocol.public,comparison:{kind:'exact-text-v1'}}};
  const p=f.create(JSON.stringify(protocol),'blind-protocol',BLIND_PROTOCOL_CRITERIA);f.accept(p,[f.original.id]);
  f.service.freeze({replicationId:'replication:oracle',missionId:'m',protocolArtifactId:p.id});await f.service.execute('replication:oracle');
  f.service.materialize('replication:oracle');assert.throws(()=>f.service.compare('replication:oracle'),{code:'UNACCEPTED_INPUT'});
  assert.equal(f.store.list('blind-opening').length,0);assert.equal(f.store.list('blind-comparison').length,0);
});
test('literal comparison preserves whitespace, case and whole-string mismatch',async t=>{
  const f=await comparisonFixture(t,{original:'42\n',result:'42'}),a=f.compare();
  assert.equal(JSON.parse(a.payload.body).comparison.outcome,'MISMATCH');
  assert.equal(JSON.parse(a.payload.body).original.body,'42\n');assert.equal(f.accept(a).status,'ACCEPTED','Accurate mismatch report may be accepted');
  const g=await comparisonFixture(t,{original:'Result',result:'result'});assert.equal(JSON.parse(g.compare().payload.body).comparison.outcome,'MISMATCH');
});
test('matching values do not hide failed controls, deviations or unknowns',async t=>{
  const f=await comparisonFixture(t,{overrides:{controls:[{id:'reverse',verdict:'FAIL',observation:'Deliberate failed fixture control.'}],deviations:['Fixture deviation'],unknowns:['Fixture unknown']}});
  const value=JSON.parse(f.compare().payload.body).comparison;
  assert.equal(value.outcome,'MATCH');assert.equal(value.replicationEstablished,false);assert.equal(value.unresolvedControls.length,1);
  assert.deepEqual(value.deviations,['Fixture deviation']);assert.deepEqual(value.unknowns,['Fixture unknown']);
});
test('exact decimal distance avoids binary rounding and integer precision loss',async t=>{
  for(const [original,result,tolerance,outcome,distance] of [
    ['0.3','0.1','0.2','MATCH','0.2'],['9007199254740993','9007199254740992','0','MISMATCH','1'],
    ['-0.01','0.02','0.0300','MATCH','0.03'],['1.000000000000000000001','1','0.0000000000000000000009','MISMATCH','0.000000000000000000001'],
  ]){
    const f=await comparisonFixture(t,{original,result,rule:{kind:'decimal-distance-v1',absoluteTolerance:tolerance,unit:'dimensionless'}});
    const a=f.compare(),value=JSON.parse(a.payload.body).comparison;
    assert.equal(value.outcome,outcome);assert.equal(value.calculation.absoluteDistance,distance);assert.equal(blindComparisonEvidence(f.registry,a.id).report.comparison.outcome,outcome);
  }
});
test('unsupported complete numeric values stay UNKNOWN without extracting or normalizing them',async t=>{
  for(const original of ['42 meters',' 42','4.2e1','NaN','0x2a','1'+'0'.repeat(301)]){
    const f=await comparisonFixture(t,{original,rule:{kind:'decimal-distance-v1',absoluteTolerance:'0',unit:'dimensionless'}});
    assert.equal(JSON.parse(f.compare().payload.body).comparison.outcome,'UNKNOWN');
  }
});
test('comparison rule validation rejects extra fields and unbounded or negative tolerance',()=>{
  for(const rule of [{kind:'exact-text-v1',trim:true},{kind:'semantic-equality'},{kind:'decimal-distance-v1',absoluteTolerance:-1,unit:'m'},
    {kind:'decimal-distance-v1',absoluteTolerance:'-1',unit:'m'},{kind:'decimal-distance-v1',absoluteTolerance:'1e9',unit:'m'},
    {kind:'decimal-distance-v1',absoluteTolerance:'1'+'0'.repeat(301),unit:'m'}])assert.throws(()=>validateComparisonRule(rule));
});
test('comparison acceptance cannot cite only its own text or a borrowed runtime proof',async t=>{
  const f=await comparisonFixture(t),a=f.compare(),run=f.run('reviewer',a.payload.purpose,[a.id]);
  const result={artifactHash:a.payloadHash,purpose:a.payload.purpose,decision:'ACCEPT',checks:a.payload.criteria.map(c=>({criterionId:c.id,verdict:'PASS',
    evidence:[{kind:'artifact',id:a.id,hash:a.payloadHash,quote:a.payload.body}],reason:'Synthetic unbound assertion'})),findings:[],uncertainty:'Simulation'};
  assert.throws(()=>f.registry.review({artifactId:a.id,reviewerRunId:run.id,result}),{code:'BLIND_COMPARISON'});
  const observer=f.run('reviewer',a.payload.purpose,[a.id]),o=f.registry.captureRuntimeObservations(observer.id).find(o=>o.kind==='artifact-blind-comparison');
  result.checks[0].evidence.push({kind:'runtime',id:o.id,hash:o.hash,quote:o.quoteText});
  assert.throws(()=>f.registry.review({artifactId:a.id,reviewerRunId:run.id,result}),{code:'UNOBSERVED_RUNTIME'});
  assert.equal(f.store.get('artifact',a.id).data.status,'CANDIDATE');
});
test('copied comparison body has no authenticated oracle binding',async t=>{
  const f=await comparisonFixture(t),a=f.compare(),run=f.run('producer',a.payload.purpose);
  const copy=f.registry.create({...a.payload,nodeId:run.nodeId,producerRunId:run.id});
  assert.throws(()=>blindComparisonEvidence(f.registry,copy.id),{code:'BLIND_COMPARISON'});
});
test('original acceptance after opening does not backdate its status into the comparison packet',async t=>{
  const f=await comparisonFixture(t);f.service.open('replication:oracle');f.accept(f.target);
  const a=f.compare();assert.equal(JSON.parse(a.payload.body).original.statusAtOpening,'CANDIDATE');
  assert.equal(f.store.get('artifact',f.target.id).data.status,'ACCEPTED');
  assert.equal(blindComparisonEvidence(f.registry,a.id).report.original.statusAtOpening,'CANDIDATE');
});
test('revoked material invalidates accepted comparison without changing historical evidence',async t=>{
  const f=await comparisonFixture(t),a=f.accept(f.compare()),proof=blindComparisonEvidence(f.registry,a.id);
  const r=f.store.get('artifact',f.material.id);f.store.put('artifact',r.id,{...r.data,status:'INVALIDATED'},{expectedVersion:r.version});
  assert.throws(()=>f.registry.assertUsable(a.id,{missionId:'m',purpose:BLIND_COMPARISON_PURPOSE}));assert.throws(()=>f.compare());
  assert.deepEqual(blindComparisonEvidence(f.registry,a.id,{current:false}),proof);
});
test('oracle run mutation and missing comparison chronology cannot be treated as current proof',async t=>{
  const f=await comparisonFixture(t),a=f.compare(),sequence=f.registry.committedSequence.bind(f.registry);
  f.registry.committedSequence=(type,id,version)=>type==='run'&&id===a.payload.producerRunId?null:sequence(type,id,version);
  assert.throws(()=>blindComparisonEvidence(f.registry,a.id),{code:'BLIND_COMPARISON'});
  f.registry.committedSequence=sequence;const r=f.store.get('run',a.payload.producerRunId);
  f.registry.updateContext(r.id,{...r.data.context,instructionsHash:sha256('Additional instructions after the oracle')});
  assert.throws(()=>blindComparisonEvidence(f.registry,a.id),{code:'BLIND_COMPARISON'});
});
test('comparison rejection is preserved without producing another report or replica',async t=>{
  const f=await comparisonFixture(t),a=f.compare(),r=f.run('reviewer',a.payload.purpose,[a.id]);
  const o=f.registry.captureRuntimeObservations(r.id).find(o=>o.kind==='artifact-blind-comparison');
  f.registry.attachInference(r.id,{status:'completed',simulation:true,threadId:id('sim-report-return'),turnId:'review'});
  const returned=f.registry.review({artifactId:a.id,reviewerRunId:r.id,result:{artifactHash:a.payloadHash,purpose:a.payload.purpose,decision:'RETURN',
    checks:a.payload.criteria.map((c,i)=>({criterionId:c.id,verdict:i===2?'FAIL':'PASS',reason:'Synthetic rule mismatch objection',evidence:[{kind:'runtime',id:o.id,hash:o.hash,quote:o.quoteText}]})),
    findings:[{severity:'material',description:'Supplied whole values are not the intended quantities.',recovery:'Revise scope in a separately reviewed prospective protocol, never edit this recorded attempt.'}],uncertainty:'Simulation'}});
  const counts={runs:f.store.list('run').length,inferences:f.store.list('inference-request').length,comparisons:f.store.list('blind-comparison').length};
  assert.equal(returned.status,'RETURNED');assert.deepEqual(f.compare(),returned);
  assert.deepEqual({runs:f.store.list('run').length,inferences:f.store.list('inference-request').length,comparisons:f.store.list('blind-comparison').length},counts);
  assert.throws(()=>f.registry.assertUsable(a.id,{missionId:'m',purpose:a.payload.purpose}),{code:'UNACCEPTED_INPUT'});
});
test('rewritten comparison binding and modified original invalidate rather than returning cached success',async t=>{
  const f=await comparisonFixture(t),a=f.compare(),r=f.store.get('blind-comparison',a.payload.nodeId);
  f.store.put(r.type,r.id,r.data,{expectedVersion:r.version});assert.throws(()=>f.compare(),{code:'BLIND_COMPARISON'});
  const g=await comparisonFixture(t),b=g.compare(),original=g.store.get('artifact',g.target.id);
  const payload={...original.data.payload,body:'43'};g.store.put('artifact',original.id,{...original.data,payload,payloadHash:sha256(payload)},{expectedVersion:original.version});
  assert.throws(()=>blindComparisonEvidence(g.registry,b.id));assert.throws(()=>g.compare());
});
test('decimal oracle agrees with a separately scaled small-integer reference over signs and boundaries',()=>{
  const asDecimal=n=>(n<0?'-':'')+Math.floor(Math.abs(n)/100)+'.'+String(Math.abs(n)%100).padStart(2,'0');
  let cases=0;
  for(let a=-99;a<=99;a+=11)for(let b=-80;b<=80;b+=16)for(const tolerance of [0,1,50]){
    const replica={result:asDecimal(b),controls:[],deviations:[],unknowns:[]};
    const actual=evaluateBlindComparison({kind:'decimal-distance-v1',absoluteTolerance:asDecimal(tolerance),unit:'dimensionless'},asDecimal(a),replica);
    assert.equal(actual.outcome,Math.abs(a-b)<=tolerance?'MATCH':'MISMATCH');cases++;
  }
  assert.equal(cases,627);
});
test('original producer thread cannot independently accept the comparison report',async t=>{
  const f=await comparisonFixture(t),a=f.compare(),r=f.run('reviewer',a.payload.purpose,[a.id]);
  const o=f.registry.captureRuntimeObservations(r.id).find(o=>o.kind==='artifact-blind-comparison');
  f.registry.attachInference(r.id,{status:'completed',simulation:true,threadId:f.store.get('run',f.target.payload.producerRunId).data.providerThreadId,turnId:'reused-original'});
  assert.throws(()=>f.registry.review({artifactId:a.id,reviewerRunId:r.id,result:{artifactHash:a.payloadHash,purpose:a.payload.purpose,decision:'ACCEPT',
    checks:a.payload.criteria.map(c=>({criterionId:c.id,verdict:'PASS',reason:'Synthetic self-approval',evidence:[{kind:'runtime',id:o.id,hash:o.hash,quote:o.quoteText}]})),findings:[],uncertainty:'Simulation'}}),{code:'SELF_CERTIFICATION'});
  assert.equal(f.store.get('artifact',a.id).data.status,'CANDIDATE');
});
test('review of a derived ordinary product is not mistaken for re-review of its sealed ancestor',async t=>{
  const f=await comparisonFixture(t),producer=f.run('producer','derived-assessment',[f.material.id]);
  const a=f.registry.create({missionId:'m',nodeId:producer.nodeId,producerRunId:producer.id,kind:'test-fixture',purpose:'derived-assessment',body:'A derivative fixture, not a new material review.',
    inputRefs:[{artifactId:f.material.id,hash:f.material.payloadHash,purpose:f.material.payload.purpose}],criteria:[{id:'derived',text:'Review the derived assessment.'}]});
  const workers=new WorkerService({store:f.store,authority:f.authority,registry:f.registry,broker:{executionAvailable:()=>false,searchAvailable:()=>false}});
  const reviewer=workers.createRun({missionId:'m',nodeId:`review:${a.payload.nodeId}`,mode:'reviewer',purpose:a.payload.purpose,roleIds:['sigma_02'],artifactIds:[a.id,f.material.id]});
  const observed=f.registry.captureRuntimeObservations(reviewer.id);assert.ok(observed.some(o=>o.kind==='artifact-blind-material'));
  assert.ok(Object.hasOwn(workers.context(reviewer.id),'missionIntent'));assert.equal(f.accept(a,[f.material.id]).status,'ACCEPTED');
});
test('a material judge cannot escape closed context enforcement by declaring another purpose',async t=>{
  const f=setup(t);f.freeze();await f.service.execute('replication:test');const a=f.service.materialize('replication:test');
  const r=f.run('reviewer','not-a-closed-review',[a.id]),o=f.registry.captureRuntimeObservations(r.id).find(o=>o.kind==='artifact-blind-material');
  f.registry.attachInference(r.id,{status:'completed',simulation:true,threadId:id('sim-wrong-purpose'),turnId:'review'});
  assert.throws(()=>f.registry.review({artifactId:a.id,reviewerRunId:r.id,result:{artifactHash:a.payloadHash,purpose:a.payload.purpose,decision:'ACCEPT',
    checks:a.payload.criteria.map(c=>({criterionId:c.id,verdict:'PASS',reason:'Synthetic purpose laundering',evidence:[{kind:'runtime',id:o.id,hash:o.hash,quote:o.quoteText}]})),findings:[],uncertainty:'Simulation'}}),{code:'BLIND_REVIEW_CONTEXT'});
});
for(const [contextEncoding,reviewEncoding] of [['plain-json','expanded-json'],['lossless-v1','evidence-refs-v1'],['lossless-json-v2','evidence-catalog-v1']])test(`WorkerService can review deterministic comparison with complete evidence: ${contextEncoding}/${reviewEncoding}`,async t=>{
  // This is a transport/registry test, not real semantic qualification. Freeze
  // each policy before the protocol and replica; never change it for a PASS.
  const f=setup(t),m=f.store.get('mission','m');f.store.put('mission','m',{...m.data,policy:{...m.data.policy,contextEncoding,reviewEncoding}},{expectedVersion:m.version});
  const target=f.create('42'),protocol={...f.protocol,original:{artifactId:target.id,hash:target.payloadHash},public:{...f.protocol.public,comparison:{kind:'exact-text-v1'}}};
  const p=f.create(JSON.stringify(protocol),'blind-protocol',BLIND_PROTOCOL_CRITERIA);f.accept(p,[target.id]);
  f.service.freeze({replicationId:'replication:oracle',missionId:'m',protocolArtifactId:p.id});await f.service.execute('replication:oracle');
  f.accept(f.service.materialize('replication:oracle'));const a=f.service.compare('replication:oracle');let reviews=0;
  const providerFactory=()=>({async generate(request){
    reviews++;const raw=JSON.parse(request.input),input=raw.encoding==='sovereign.lossless-context.v2'?unpackJsonContext(raw)
      :raw.encoding==='sovereign.lossless-context.v1'?unpackContext(raw):raw;
    const o=input.runtimeObservations.find(o=>o.kind==='artifact-blind-comparison');assert.ok(o);assert.equal(input.artifacts[0].id,a.id);
    const report=JSON.parse(o.quoteText).detail.report;assert.equal(report.original.id,target.id);assert.equal(report.comparison.outcome,'MATCH');
    assert.equal(report.comparison.replicationEstablished,false);assert.equal(report.publicProtocol.comparison.kind,'exact-text-v1');
    const expanded={artifactHash:a.payloadHash,purpose:a.payload.purpose,decision:'ACCEPT',checks:a.payload.criteria.map(c=>({criterionId:c.id,verdict:'PASS',
      reason:'SIMULATED judgment of exact comparison report, not original truth.',evidence:[{kind:'artifact',id:a.id,hash:a.payloadHash,quote:a.payload.body},{kind:'runtime',id:o.id,hash:o.hash,quote:o.quoteText}]})),findings:[],uncertainty:'Simulated, not live semantic proof.'};
    const value=reviewEncoding==='evidence-catalog-v1'?compactCatalogReview(expanded,JSON.parse(input.task).observedEvidenceCatalog)
      :reviewEncoding==='evidence-refs-v1'?compactReviewEvidence(expanded):expanded;
    await request.validate(value);return {value,receipt:{status:'completed',simulation:true,threadId:id('sim-comparison-review'),turnId:'review',
      model:request.model,reasoningEffort:request.reasoningEffort,contextHash:inferenceRequestHash(request)}};
  },async close(){}});
  const workers=new WorkerService({store:f.store,authority:f.authority,registry:f.registry,broker:{executionAvailable:()=>false,searchAvailable:()=>false},providerFactory});
  const accepted=await workers.review({artifact:a,reviewerRoleIds:['sigma_02'],missionIntent:m.data.intent});
  assert.equal(accepted.status,'ACCEPTED');assert.equal(reviews,1);assert.equal(f.calls,1);assert.equal(f.store.list('effect').length,0);
  assert.equal(f.registry.assertUsable(a.id,{missionId:'m',purpose:a.payload.purpose}).id,a.id);assert.equal(f.store.get('artifact',target.id).data.status,'CANDIDATE');
});

function workflowFixture(t,{respondReview,respondReplica,maxReviewAttempts=4,contextEncoding='plain-json',reviewEncoding='expanded-json',databasePath=':memory:'}={}){
  const f=setup(t,respondReplica,databasePath),m=f.store.get('mission','m');
  f.store.put('mission','m',{...m.data,policy:{...m.data.policy,maxNodeAttempts:maxReviewAttempts,contextEncoding,reviewEncoding}},{expectedVersion:m.version});
  const target=f.create('42'),protocol={...f.protocol,original:{artifactId:target.id,hash:target.payloadHash},public:{...f.protocol.public,comparison:{kind:'exact-text-v1'}}};
  const acceptedProtocol=f.create(JSON.stringify(protocol),'blind-protocol',BLIND_PROTOCOL_CRITERIA);f.accept(acceptedProtocol,[target.id]);
  const reviewers={material:['sigma_02'],comparison:['sigma_02']};
  f.service.freeze({replicationId:'replication:workflow',missionId:'m',protocolArtifactId:acceptedProtocol.id,reviewers});
  const reviewRequests=[];
  const providerFactory=()=>({async generate(request){
    const input=readSourceContextView(request.input);
    const a=input.artifacts[0],stage=a.payload.purpose===BLIND_COMPARISON_PURPOSE?'comparison':'material';
    const o=input.runtimeObservations.find(o=>o.kind===(stage==='material'?'artifact-blind-material':'artifact-blind-comparison'));assert.ok(o);
    reviewRequests.push({request,input,stage});
    const expanded={artifactHash:a.hash,purpose:a.payload.purpose,decision:'ACCEPT',checks:a.payload.criteria.map(c=>({criterionId:c.id,verdict:'PASS',reason:'SIMULATED workflow judgment; not original truth.',
      // Cite the exact binding passage instead of repeating the entire nested
      // request inventory five times. Full evidence is still delivered above;
      // the real output budget is not raised to accommodate fixture repetition.
      evidence:[{kind:'artifact',id:a.id,hash:a.hash,quote:a.payload.body},{kind:'runtime',id:o.id,hash:o.hash,quote:'"artifactId":'+JSON.stringify(a.id)}]})),findings:[],uncertainty:'Simulation, not live qualification.'};
    const response=respondReview?await respondReview({stage,request,input,expanded,f,number:reviewRequests.length}):expanded;
    const value=reviewEncoding==='evidence-catalog-v1'?compactCatalogReview(response,JSON.parse(input.task).observedEvidenceCatalog):reviewEncoding==='evidence-refs-v1'?compactReviewEvidence(response):response;
    await request.validate(value);return {value,receipt:{status:'completed',simulation:true,threadId:id('sim-workflow-review'),turnId:'review',
      model:request.model,reasoningEffort:request.reasoningEffort,contextHash:inferenceRequestHash(request)}};
  },async close(){}});
  const workers=new WorkerService({store:f.store,authority:f.authority,registry:f.registry,broker:{executionAvailable:()=>false,searchAvailable:()=>false},providerFactory});
  return Object.assign(f,{target,acceptedProtocol,reviewers,workers,reviewRequests,runWorkflow:options=>f.service.runReviewed('replication:workflow',{workers,...options})});
}
test('material judge cannot reuse the private protocol author thread before unblinding',async t=>{
  const f=workflowFixture(t),factory=f.workers.providerFactory;
  const author=f.store.get('run',f.acceptedProtocol.payload.producerRunId).data;
  f.workers.providerFactory=()=>{const provider=factory();return {async generate(request){
    const result=await provider.generate(request),input=JSON.parse(request.input);
    if(input.publicReviewMandate)result.receipt.threadId=author.providerThreadId;
    return result;
  },close:()=>provider.close()};};
  await assert.rejects(f.runWorkflow(),{code:'BLIND_REVIEW'});
  assert.equal(f.reviewRequests.length,1,'A contaminated actor must not be retried as a citation repair');
  assert.equal(f.store.list('blind-opening').length,0);
  assert.equal(f.store.list('artifact').find(a=>a.data.payload.kind===BLIND_MATERIAL_KIND).data.status,'CANDIDATE','Contaminated judge cannot approve even the material node');
});
test('closed judge rejects reuse of any other earlier actor, even outside declared private ancestry',async t=>{
  const f=workflowFixture(t),other=f.run('producer','unrelated-history'),factory=f.workers.providerFactory;
  f.workers.providerFactory=()=>{const provider=factory();return {async generate(request){const response=await provider.generate(request);
    if(JSON.parse(request.input).publicReviewMandate)response.receipt.threadId=other.providerThreadId;return response;
  },close:()=>provider.close()};};
  await assert.rejects(f.runWorkflow(),{code:'BLIND_REVIEW'});assert.equal(f.store.list('blind-opening').length,0);
  assert.equal(f.reviewRequests.length,1,'Thread contamination is terminal, regardless of response byte length');
});
test('missing closed binding citation can be corrected without treating thread contamination as repairable',async t=>{
  const f=workflowFixture(t,{respondReview:({stage,number,expanded})=>stage==='material'&&number===1
    ?{...expanded,checks:expanded.checks.map(c=>({...c,evidence:c.evidence.filter(e=>e.kind!=='runtime')}))}:expanded});
  const result=await f.runWorkflow();assert.equal(result.status,'REPORT_ACCEPTED');
  assert.equal(f.calls,1);assert.equal(f.reviewRequests.length,3);
  assert.equal(f.store.list('worker-rejected-review')[0].data.code,'BLIND_REVIEW_PROOF');
  const exposure=blindComparisonEvidence(f.registry,result.comparisonArtifactId).closedExposure.materialReviewer;
  assert.equal(exposure.coverage,'RECORDED');assert.equal(exposure.requests.length,2);
  assert.equal(exposure.completedInferences.length,2);assert.notEqual(exposure.completedInferences[0].threadId,exposure.completedInferences[1].threadId);
});
test('a later actor thread reuse does not rewrite the historical closed approval',async t=>{
  const f=workflowFixture(t);assert.equal((await f.runWorkflow()).status,'REPORT_ACCEPTED');
  const material=f.store.get('artifact',f.store.get('blind-workflow','replication:workflow').data.material.artifactId).data;
  const review=f.store.get('review',material.reviews.at(-1)).data,reviewer=f.store.get('run',review.reviewerRunId).data;
  const later=f.run('producer','later-history');
  f.registry.attachInference(later.id,{status:'completed',simulation:true,threadId:reviewer.providerThreadId,turnId:'later'});
  assert.doesNotThrow(()=>f.service.open('replication:workflow'));
});
test('comparison exposes both completed closed actor requests, not just comparator or protocol-reviewer metadata',async t=>{
  const f=workflowFixture(t),result=await f.runWorkflow();
  const proof=blindComparisonEvidence(f.registry,result.comparisonArtifactId),exposure=proof.closedExposure;
  assert.ok(exposure,'wmUkhp: bilateral admission evidence must reach the final reviewer');
  assert.equal(exposure.schema,'sovereign.closed-exposure.v1');
  for(const actor of [exposure.replica,exposure.materialReviewer]){
    assert.equal(actor.coverage,'RECORDED');assert.equal(actor.requests.length,1);
    assert.equal(inferenceRequestHash(actor.requests[0].request),actor.requests[0].requestHash);
    assert.ok(actor.requests[0].sequence<actor.completedSequence);
    assert.ok(actor.completedSequence<exposure.openingSequence);
    assert.equal(actor.completedInferences[0].contextHash,actor.requests[0].requestHash);
  }
  const replica=JSON.parse(exposure.replica.requests[0].request.input);
  assert.deepEqual(Object.keys(replica).sort(),['publicProtocol','replicationId','schema']);
  const review=JSON.parse(exposure.materialReviewer.requests[0].request.input);
  assert.equal(review.publicReviewMandate.artifactId,result.materialArtifactId);
  assert.equal(Object.hasOwn(review,'missionIntent'),false);
  assert.notEqual(exposure.replica.completedInferences[0].threadId,exposure.materialReviewer.completedInferences[0].threadId);
  assert.equal(exposure.materialReview.result.decision,'ACCEPT');
  assert.equal(JSON.stringify(f.reviewRequests[0].input).includes('closedExposure'),false,'No later bilateral proof leaks into the closed judge');
  const delivered=JSON.parse(f.reviewRequests[1].input.runtimeObservations.find(o=>o.kind==='artifact-blind-comparison').quoteText).detail;
  assert.deepEqual(delivered.closedExposure,exposure);
});
test('a synthetic material approval with no retained request stays explicitly unobserved in bilateral proof',async t=>{
  const f=await comparisonFixture(t),a=f.compare();
  const exposure=blindComparisonEvidence(f.registry,a.id).closedExposure;
  assert.equal(exposure.replica.coverage,'RECORDED');
  assert.equal(exposure.materialReviewer.coverage,'UNKNOWN');
  assert.equal(exposure.materialReviewer.requests.length,0);
  assert.ok(exposure.materialReviewer.unknowns.length>0,'A completed fixture receipt is not a retained request');
});
test('later material-reviewer exposure cannot backdate a completed bilateral snapshot',async t=>{
  const f=workflowFixture(t),result=await f.runWorkflow();
  const before=blindComparisonEvidence(f.registry,result.comparisonArtifactId);
  assert.ok(before.closedExposure);
  const r=f.store.get('run',before.closedExposure.materialReviewer.record.id);
  f.registry.updateContext(r.id,{...r.data.context,instructionsHash:sha256('Later private exposure not part of past acceptance')});
  f.registry.attachInference(r.id,{status:'completed',simulation:true,threadId:id('later-material'),turnId:'later'});
  assert.deepEqual(blindComparisonEvidence(f.registry,result.comparisonArtifactId,{current:false}),before);
});
test('missing or backdated material-review request cannot support bilateral recorded coverage',async t=>{
  const f=workflowFixture(t),result=await f.runWorkflow(),proof=blindComparisonEvidence(f.registry,result.comparisonArtifactId);
  const ref=proof.closedExposure.materialReviewer.requests[0].record,get=f.store.get.bind(f.store);
  f.store.get=(type,id,version)=>type===ref.type&&id===ref.id?null:get(type,id,version);
  assert.throws(()=>blindComparisonEvidence(f.registry,result.comparisonArtifactId,{current:false}),{code:'BLIND_REVIEW_CONTEXT'});
  f.store.get=get;
  const sequence=f.registry.committedSequence.bind(f.registry);
  f.registry.committedSequence=(type,id,version)=>type===ref.type&&id===ref.id?null:sequence(type,id,version);
  assert.throws(()=>blindComparisonEvidence(f.registry,result.comparisonArtifactId,{current:false}),{code:'BLIND_EXPOSURE'});
  f.registry.committedSequence=(type,id,version)=>type===ref.type&&id===ref.id?proof.closedExposure.openingSequence+1:sequence(type,id,version);
  assert.throws(()=>blindComparisonEvidence(f.registry,result.comparisonArtifactId,{current:false}),{code:'BLIND_EXPOSURE'});
  f.registry.committedSequence=sequence;assert.deepEqual(blindComparisonEvidence(f.registry,result.comparisonArtifactId),proof);
});
for(const [contextEncoding,reviewEncoding] of [['plain-json','expanded-json'],['lossless-v1','evidence-refs-v1'],['lossless-json-v2','evidence-catalog-v1'],['source-text-v1','evidence-catalog-v1']])test(`durable closed workflow composes replica, material judge, oracle and report judge: ${contextEncoding}/${reviewEncoding}`,async t=>{
  const f=workflowFixture(t,{contextEncoding,reviewEncoding}),mission=f.store.get('mission','m'),original=f.store.get('artifact',f.target.id);
  const result=await f.runWorkflow();assert.equal(result.status,'REPORT_ACCEPTED');assert.equal(f.calls,1);assert.equal(f.reviewRequests.length,2);
  assert.ok(result.pending.some(p=>p.code==='NOT_MISSION_ACCEPTANCE'));assert.equal(f.store.list('effect').length,0);
  assert.deepEqual(f.store.get('mission','m'),mission);assert.deepEqual(f.store.get('artifact',f.target.id),original);
  const [material,comparison]=f.reviewRequests;
  assert.equal(material.stage,'material');assert.ok(!Object.hasOwn(material.input,'missionIntent'));assert.ok(!JSON.stringify(material.input).includes(f.target.payloadHash));
  assert.equal(comparison.stage,'comparison');assert.ok(JSON.stringify(comparison.input).includes(f.target.payloadHash));
  const progress=f.store.get('blind-workflow','replication:workflow').data;assert.equal(progress.owner,null);
  assert.equal(progress.material.state,'DECIDED');assert.equal(progress.comparison.state,'DECIDED');
  assert.notEqual(progress.material.proof.reviewer.id,progress.comparison.proof.reviewer.id);
  assert.equal(f.registry.assertUsable(result.comparisonArtifactId,{missionId:'m',purpose:BLIND_COMPARISON_PURPOSE}).id,result.comparisonArtifactId);
  assert.deepEqual(await f.runWorkflow(),result);assert.equal(f.calls,1);assert.equal(f.reviewRequests.length,2);assert.ok(f.store.verifyJournal());
});
test('reviewer assignment is frozen before replica dispatch; another role or unsupported rule cannot be slipped in',t=>{
  const f=workflowFixture(t);assert.equal(f.calls,0);
  const contract=f.service.registration('replication:workflow').data.workflow;
  assert.deepEqual(contract,frozenBlindWorkflow(f.reviewers,4,f.store.get('mission','m').data.policy));assert.equal(contract.cards.length,1);
  assert.throws(()=>f.service.freeze({replicationId:'replication:workflow',missionId:'m',protocolArtifactId:f.acceptedProtocol.id,
    reviewers:{...f.reviewers,material:['omega_22']}}),{code:'BLIND_CONFLICT'});
  assert.throws(()=>f.service.freeze({replicationId:'replication:workflow',missionId:'m',protocolArtifactId:f.acceptedProtocol.id}),{code:'BLIND_CONFLICT'});
  assert.throws(()=>frozenBlindWorkflow({material:['veritas_04'],comparison:['sigma_02']}),{code:'ROLE_EXECUTION_UNSUPPORTED'});
  assert.throws(()=>frozenBlindWorkflow(f.reviewers,0));assert.equal(f.calls,0);
});
test('unfrozen workflow roles cannot be selected after seeing a sealed result',async t=>{
  const f=setup(t);f.freeze();await f.service.execute('replication:test');
  const workers=new WorkerService({store:f.store,authority:f.authority,registry:f.registry,broker:{executionAvailable:()=>false,searchAvailable:()=>false}});
  await assert.rejects(f.service.runReviewed('replication:test',{workers}),{code:'BLIND_WORKFLOW_DRIFT'});
  assert.equal(f.store.list('blind-workflow').length,0);assert.equal(f.calls,1);
});
for(const rejectedStage of ['material','comparison'])test(`a ${rejectedStage} RETURN is preserved; the workflow neither retries a quality vote nor marks the mission complete`,async t=>{
  const f=workflowFixture(t,{respondReview:({stage,expanded})=>stage!==rejectedStage?expanded:{...expanded,decision:'RETURN',checks:expanded.checks.map(c=>({...c,verdict:'FAIL'})),
    findings:[{severity:'material',description:'Synthetic substantive objection.',recovery:'Change the prospective method, not this sealed result.'}]}});
  const result=await f.runWorkflow();assert.equal(result.status,rejectedStage==='material'?'MATERIAL_RETURNED':'COMPARISON_RETURNED');
  assert.equal(f.reviewRequests.length,rejectedStage==='material'?1:2);const count=f.reviewRequests.length;
  assert.deepEqual(await f.runWorkflow(),result);assert.equal(f.reviewRequests.length,count);assert.equal(f.calls,1);
  if(rejectedStage==='material')assert.equal(f.store.list('blind-opening').length,0);
  assert.ok(!f.store.get('mission','m').data.finalArtifactId);
});
for(const quotaStage of ['material','comparison'])test(`quota at ${quotaStage} review resumes the same candidate with bounded history and no repeated replica`,async t=>{
  let failed=false;
  const f=workflowFixture(t,{respondReview:({stage,expanded})=>{if(stage===quotaStage&&!failed){failed=true;throw Object.assign(Error('Simulated quota'),{code:'QUOTA'});}return expanded;}});
  await assert.rejects(f.runWorkflow(),{code:'QUOTA'});const before=f.store.get('blind-workflow','replication:workflow').data;
  assert.equal(before.status,'WAITING_QUOTA');assert.equal(before.owner,null);assert.equal(before[quotaStage].state,'RETRYABLE');
  const originalCandidate=before[quotaStage].artifactId;
  assert.equal((await f.runWorkflow()).status,'REPORT_ACCEPTED');const after=f.store.get('blind-workflow','replication:workflow').data;
  assert.equal(after[quotaStage].artifactId,originalCandidate);assert.equal(after[quotaStage].attempts,2);
  assert.equal(after[quotaStage].attemptsHistory[0].code,'QUOTA');assert.equal(f.calls,1);assert.equal(f.reviewRequests.length,3);
});
test('the frozen review retry budget cannot reset on reentry',async t=>{
  const f=workflowFixture(t,{maxReviewAttempts:1,respondReview:()=>{throw Object.assign(Error('Simulated quota'),{code:'QUOTA'});}});
  await assert.rejects(f.runWorkflow(),{code:'QUOTA'});await assert.rejects(f.runWorkflow(),{code:'BLIND_REVIEW_BUDGET'});
  assert.equal(f.reviewRequests.length,1);assert.equal(f.calls,1);assert.equal(f.store.get('blind-workflow','replication:workflow').data.material.attempts,1);
});
test('an uncertain review is retained for reconciliation rather than producing another vote',async t=>{
  const f=workflowFixture(t,{respondReview:()=>{throw Object.assign(Error('Lost review outcome'),{code:'INFERENCE_OUTCOME_UNKNOWN'});}});
  await assert.rejects(f.runWorkflow(),{code:'INFERENCE_OUTCOME_UNKNOWN'});
  await assert.rejects(f.runWorkflow(),{code:'BLIND_REVIEW_UNCERTAIN'});
  assert.equal(f.reviewRequests.length,1);assert.equal(f.calls,1);assert.equal(f.store.list('blind-opening').length,0);
});
test('a committed review survives interruption before the workflow checkpoint without a repeated judge',async t=>{
  const f=workflowFixture(t),originalReview=f.workers.review.bind(f.workers);let interrupted=false;
  f.workers.review=async args=>{const result=await originalReview(args);if(!interrupted){interrupted=true;throw Object.assign(Error('After commit interruption'),{code:'INTERRUPTED_AFTER_COMMIT'});}return result;};
  await assert.rejects(f.runWorkflow(),{code:'INTERRUPTED_AFTER_COMMIT'});
  const pending=f.store.get('blind-workflow','replication:workflow').data;assert.equal(pending.material.state,'UNRECONCILED');
  assert.equal(f.store.get('artifact',pending.material.artifactId).data.status,'ACCEPTED');
  assert.equal((await f.runWorkflow()).status,'REPORT_ACCEPTED');assert.equal(f.reviewRequests.length,2);assert.equal(f.calls,1);
});
test('concurrent coordinators cannot issue duplicate workflow reviews',async t=>{
  let release,entered;const waiting=new Promise(r=>release=r),started=new Promise(r=>entered=r);
  const f=workflowFixture(t,{respondReview:async({stage,expanded})=>{if(stage==='material'){entered();await waiting;}return expanded;}});
  const first=f.runWorkflow();await started;
  try{await assert.rejects(f.runWorkflow(),{code:'BLIND_WORKFLOW_BUSY'});assert.equal(f.reviewRequests.length,1);}
  finally{release();await first;}
  assert.equal(f.reviewRequests.length,2);assert.equal(f.calls,1);
});
for(const [contextEncoding,reviewEncoding] of [['plain-json','expanded-json'],['lossless-v1','evidence-refs-v1'],['lossless-json-v2','evidence-catalog-v1']])test(`completed UNKNOWN receives independent assessment but never opens: ${contextEncoding}`,async t=>{
  const f=workflowFixture(t,{contextEncoding,reviewEncoding,respondReplica:({response})=>({...response(),status:'UNKNOWN',result:'',unknowns:['Fixture missing proof']})});
  const result=await f.runWorkflow();assert.equal(result.status,'INCONCLUSIVE_ACCEPTED');assert.equal(result.pending[0].code,'REPLICA_INCONCLUSIVE');
  assert.equal(f.reviewRequests.length,1);assert.equal(f.reviewRequests[0].stage,'material');
  const body=JSON.parse(f.store.get('artifact',result.materialArtifactId).data.payload.body);
  assert.equal(body.result.status,'UNKNOWN');assert.equal(body.result.result,'');assert.deepEqual(body.result.unknowns,['Fixture missing proof']);
  const input=f.reviewRequests[0].input;assert.equal(input.artifacts.length,1);assert.ok(!Object.hasOwn(input,'missionIntent'));
  assert.ok(!JSON.stringify(input).includes(f.target.id));assert.ok(!JSON.stringify(input).includes(f.target.payloadHash));
  assert.equal(result.comparisonArtifactId,null);assert.equal(f.store.list('blind-opening').length,0);assert.equal(f.store.list('blind-comparison').length,0);
  assert.equal((await f.runWorkflow()).status,'INCONCLUSIVE_ACCEPTED');assert.equal(f.calls,1);assert.equal(f.reviewRequests.length,1);
  assert.throws(()=>f.service.open('replication:workflow'),{code:'BLIND_STATE'});
  assert.throws(()=>f.service.compare('replication:workflow'),{code:'BLIND_STATE'});
});

test('UNKNOWN assessment RETURN is retained without another vote or replacement replica',async t=>{
  const f=workflowFixture(t,{respondReplica:({response})=>({...response(),status:'UNKNOWN',result:'',unknowns:['Fixture unsupported stopping claim']}),
    respondReview:({expanded})=>({...expanded,decision:'RETURN',checks:expanded.checks.map(c=>({...c,verdict:'FAIL'})),
      findings:[{severity:'material',description:'SIMULATED: the asserted missing premise is not justified by the packet.',recovery:'Preserve this failed attempt; diagnose the method without another vote or opening.'}]})});
  const result=await f.runWorkflow();assert.equal(result.status,'MATERIAL_RETURNED');
  assert.equal(f.store.get('artifact',result.materialArtifactId).data.status,'RETURNED');
  assert.equal((await f.runWorkflow()).status,'MATERIAL_RETURNED');assert.equal(f.calls,1);assert.equal(f.reviewRequests.length,1);
  assert.equal(f.store.list('blind-opening').length,0);assert.equal(f.store.list('blind-comparison').length,0);
});

test('UNKNOWN assessment quota resumes exact sealed attempt, never its inference',async t=>{
  let first=true;
  const f=workflowFixture(t,{respondReplica:({response})=>({...response(),status:'UNKNOWN',result:'',unknowns:['Fixture missing proof']}),
    respondReview:({expanded})=>{if(first){first=false;throw Object.assign(Error('Quota fixture'),{code:'QUOTA'});}return expanded;}});
  await assert.rejects(f.runWorkflow(),{code:'QUOTA'});const seal=f.store.get('blind-seal','replication:workflow');
  assert.equal((await f.runWorkflow()).status,'INCONCLUSIVE_ACCEPTED');assert.equal(f.calls,1);assert.equal(f.reviewRequests.length,2);
  assert.deepEqual(f.store.get('blind-seal','replication:workflow'),seal);assert.equal(f.store.list('blind-opening').length,0);
});

test('UNKNOWN assessment reconciles a committed judgment after interruption without a new vote',async t=>{
  const f=workflowFixture(t,{respondReplica:({response})=>({...response(),status:'UNKNOWN',result:'',unknowns:['Fixture missing proof']})});
  const review=f.workers.review.bind(f.workers);let first=true;
  f.workers.review=async args=>{const result=await review(args);if(first){first=false;throw Object.assign(Error('After commit'),{code:'INTERRUPTED_AFTER_COMMIT'});}return result;};
  await assert.rejects(f.runWorkflow(),{code:'INTERRUPTED_AFTER_COMMIT'});
  assert.equal((await f.runWorkflow()).status,'INCONCLUSIVE_ACCEPTED');assert.equal(f.calls,1);assert.equal(f.reviewRequests.length,1);
  assert.equal(f.store.list('blind-opening').length,0);
});

test('mutable state cannot relabel a sealed UNKNOWN as a result to authorize opening',async t=>{
  const f=workflowFixture(t,{respondReplica:({response})=>({...response(),status:'UNKNOWN',result:'',unknowns:['Fixture missing proof']})});
  const result=await f.runWorkflow();assert.equal(result.status,'INCONCLUSIVE_ACCEPTED');
  const state=f.store.get('blind-replication','replication:workflow');
  f.store.put(state.type,state.id,{...state.data,state:'SEALED'},{expectedVersion:state.version});
  assert.throws(()=>f.service.open('replication:workflow'),{code:'BLIND_MATERIAL'});
  assert.equal(f.store.list('blind-opening').length,0);assert.equal(f.calls,1);
});

test('contradictory ACCEPT plus a material upstream finding is retained without automatic relabeling or another vote',async t=>{
  const finding={severity:'material',description:'SIMULATED upstream method defect; the stopped attempt reports it faithfully.',recovery:'Preserve this attempt and diagnose the protocol; no opening or repeat is authorized.'};
  const f=workflowFixture(t,{reviewEncoding:'evidence-catalog-v1',respondReplica:({response})=>({...response(),status:'UNKNOWN',result:'',unknowns:['Fixture upstream method unresolved']}),
    respondReview:({request,expanded})=>{
      assert.ok(request.schema.description.includes('DECISION CONSISTENCY: ACCEPT requires every check to be PASS and zero material findings.'));
      return {...expanded,decision:'ACCEPT',findings:[finding]};
    }});
  await assert.rejects(f.runWorkflow(),{code:'FAILED_GATE'});
  const rejected=f.store.list('worker-rejected-review');assert.equal(rejected.length,1);
  assert.equal(rejected[0].data.response.decision,'ACCEPT');assert.deepEqual(rejected[0].data.response.findings,[finding]);
  assert.equal(f.store.get('artifact',rejected[0].data.artifactId).data.status,'CANDIDATE');
  await assert.rejects(f.runWorkflow(),{code:'BLIND_REVIEW_UNCERTAIN'});
  assert.equal(f.calls,1);assert.equal(f.reviewRequests.length,1);assert.equal(f.store.list('blind-opening').length,0);
});
test('cancellation after a committed material review does not cross the opening barrier',async t=>{
  const f=workflowFixture(t),controller=new AbortController(),review=f.workers.review.bind(f.workers);let first=true;
  f.workers.review=async args=>{const result=await review(args);if(first){first=false;controller.abort();}return result;};
  await assert.rejects(f.runWorkflow({signal:controller.signal}),{code:'CANCELLED'});assert.equal(f.store.list('blind-opening').length,0);
  assert.equal(f.store.get('blind-workflow','replication:workflow').data.status,'PAUSED');
  assert.equal((await f.runWorkflow()).status,'REPORT_ACCEPTED');assert.equal(f.reviewRequests.length,2);assert.equal(f.calls,1);
});
test('a manual synthetic acceptance without the frozen worker assignment cannot impersonate the workflow judge',async t=>{
  const f=workflowFixture(t);await f.service.execute('replication:workflow');f.accept(f.service.materialize('replication:workflow'));
  await assert.rejects(f.runWorkflow(),{code:'BLIND_WORKFLOW_REVIEW'});assert.equal(f.reviewRequests.length,0);assert.equal(f.store.list('blind-opening').length,0);
});
test('a reviewer card record added after synthetic approval cannot backdate actual workflow execution',async t=>{
  const f=workflowFixture(t);await f.service.execute('replication:workflow');const a=f.accept(f.service.materialize('replication:workflow'));
  const reviewerId=f.store.get('review',a.reviews.at(-1)).data.reviewerRunId;
  f.store.put('worker-config',reviewerId,{roleIds:f.reviewers.material},{expectedVersion:0});
  await assert.rejects(f.runWorkflow(),{code:'BLIND_WORKFLOW_REVIEW'});assert.equal(f.reviewRequests.length,0);assert.equal(f.store.list('blind-opening').length,0);
});
test('workflow freezes baseline reviewer prefixes and does not import an unqualified learned overlay',async t=>{
  const f=workflowFixture(t);f.workers.learningInstructionsResolver=()=>{throw Error('No overlay has been qualified for this closed route');};
  assert.equal((await f.runWorkflow()).status,'REPORT_ACCEPTED');
  const contract=f.service.registration('replication:workflow').data.workflow,progress=f.store.get('blind-workflow','replication:workflow').data;
  for(const stage of ['material','comparison']){
    const config=f.store.get('worker-config',progress[stage].proof.config.id).data;
    assert.equal(config.prefixHash,contract.stages[stage].prefixHash);assert.deepEqual(config.learnedInstructionVersions,[]);
    assert.equal(progress[stage].attemptsHistory[0].state,'DECIDED');
  }
});
test('missing reviewer configuration order fails closed even when the review itself committed',async t=>{
  const f=workflowFixture(t),sequence=f.registry.committedSequence.bind(f.registry);
  f.registry.committedSequence=(type,id,version)=>type==='worker-config'?null:sequence(type,id,version);
  await assert.rejects(f.runWorkflow(),{code:'BLIND_WORKFLOW_REVIEW'});assert.equal(f.store.list('blind-opening').length,0);
  f.registry.committedSequence=sequence;assert.equal((await f.runWorkflow()).status,'REPORT_ACCEPTED');assert.equal(f.reviewRequests.length,2);
});
test('REAL process crash leaves the dispatched replica unresolved and never reissues it in a replacement workflow owner',async t=>{
  const directory=mkdtempSync('/tmp/sovereign-workflow-process-'),databasePath=join(directory,'state.sqlite');
  const f=workflowFixture(t,{databasePath});t.after(()=>rmSync(directory,{recursive:true}));
  const base=new URL('../../factory/lib/',import.meta.url).href;
  const program=`import{Store}from${JSON.stringify(base+'store.mjs')};import{Authority}from${JSON.stringify(base+'authority.mjs')};import{ArtifactRegistry}from${JSON.stringify(base+'artifacts.mjs')};import{BlindReplicationService}from${JSON.stringify(base+'blind-replication.mjs')};import{WorkerService}from${JSON.stringify(base+'workers.mjs')};const store=new Store(process.argv[1]),authority=new Authority(store),registry=new ArtifactRegistry(store,authority);const providerFactory=()=>({async generate(){process.stdout.write('DISPATCHED\\n');await new Promise(()=>{setInterval(()=>{},1000);});},async close(){}});const service=new BlindReplicationService({store,authority,registry,providerFactory});const workers=new WorkerService({store,authority,registry,broker:{executionAvailable:()=>false,searchAvailable:()=>false},providerFactory});await service.runReviewed('replication:workflow',{workers});`;
  const child=spawn(process.execPath,['--input-type=module','-e',program,databasePath],{stdio:['ignore','pipe','pipe']});
  const closed=new Promise(resolve=>child.once('close',resolve));let output='',stderr='';child.stderr.on('data',x=>stderr+=x);
  try{
    await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Child did not dispatch: '+stderr)),10000);
      child.stdout.on('data',data=>{output+=data;if(output.includes('DISPATCHED')){clearTimeout(timer);resolve();}});child.once('error',e=>{clearTimeout(timer);reject(e);});child.once('close',()=>{clearTimeout(timer);if(!output.includes('DISPATCHED'))reject(Error('Child closed: '+stderr));});});
    await assert.rejects(f.runWorkflow(),{code:'BLIND_WORKFLOW_BUSY'});
    child.kill('SIGKILL');await closed;
    const result=await f.runWorkflow();assert.equal(result.status,'REPLICA_UNRESOLVED');assert.equal(f.calls,0);assert.equal(f.reviewRequests.length,0);
    assert.equal(f.store.list('inference-request').length,1);assert.equal(f.service.status('replication:workflow').state,'RUNNING');
    assert.equal(f.store.get('blind-workflow','replication:workflow').data.owner,null);assert.ok(f.store.verifyJournal());
  }finally{if(child.exitCode===null&&child.signalCode===null)child.kill('SIGKILL');await closed;}
});
