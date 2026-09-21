// Only inference is simulated. Actual SQLite, lease verification, broker reads,
// retained proposals and independent post-candidate input review are exercised.
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {FactoryEngine} from '../../factory/lib/engine.mjs';
import {Store} from '../../factory/lib/store.mjs';
import {runBoundedReadEntry} from '../../factory/lib/bounded-read-entry.mjs';
import {BOUNDED_READ_MODE} from '../../factory/lib/bounded-read-spec.mjs';
import {nativeReadRecovery} from '../../factory/lib/native-read-session.mjs';
import {missionInferenceBudget} from '../../factory/lib/mission-inference-budget.mjs';
import {readSourceContextView} from '../../factory/lib/source-context-view.mjs';
import {inferenceRequestHash,instructionProfile} from '../../factory/providers/instruction-profiles.mjs';
import {NATIVE_READ_PROFILE,NATIVE_READ_TOOL_BINDING} from '../../factory/providers/native-read-policy.mjs';
import {canonical,sha256} from '../../factory/lib/contracts.mjs';
import {missionReport,formatMissionReport} from '../../factory/lib/report.mjs';

const final=()=>({action:'final',tool:'',argsJson:'',body:'13 + 17 = 30.',claims:[],method:'closed-sum',reason:''});
function fixture(t,{read=true,maxCalls=3,options={},hook=async()=>{},finishValue=final,readArgs={path:'input.txt'}}={}){
  const directory=mkdtempSync(join(tmpdir(),'sovereign-native-integration-'));
  const f={nativeCalls:0,reviewCalls:0,closed:0,hook,readArgs,finishValue,requests:[],responses:[],read};
  const open=()=>{
    const e=new FactoryEngine({databasePath:join(directory,'state.sqlite'),workspaceRoot:join(directory,'jobs')});f.e=e;e.workers.maxReviewRepairs=0;
    e.workers.nativeProviderFactory=()=>({async generate(request){
      f.nativeCalls++;f.requests.push(request);const s=request.nativeSession;f.session=s;
      const threadId='native-sim-'+f.nativeCalls,turnId='turn',callId='call';f.ids={threadId,turnId,callId};
      assert.equal(request.instructionProfile,NATIVE_READ_PROFILE);assert.equal(request.schema.properties.action.enum.join(','),'final,blocked');
      assert.ok(!request.instructions.includes('You are not being asked to use native tools'));
      s.bind({threadId,turnId});await f.hook('bound',f);
      if(f.read){
        const prepared=await s.prepare({threadId,turnId,callId,namespace:NATIVE_READ_TOOL_BINDING.namespace,tool:NATIVE_READ_TOOL_BINDING.name,
          arguments:f.readArgs,signal:request.signal});f.prepared=prepared;
        await f.hook('prepared',f);
        const p=prepared.frames.at(-1).event;
        s.dispatch({callId,responseHash:sha256(p.responseJson)});await f.hook('dispatch',f);
        s.ack({threadId,turnId,callId,responseJson:p.responseJson});await f.hook('ack',f);
      }
      const value=f.finishValue();await request.validate(value);s.finish({threadId,turnId,outputJson:canonical(value)});
      await f.hook('finish',f);const transcript=s.checkpoint(),receipt={kind:'inference',simulation:true,status:'completed',threadId,turnId,
        contextHash:inferenceRequestHash(request),model:request.model,reasoningEffort:request.reasoningEffort,toolPolicy:NATIVE_READ_PROFILE,
        nativeTranscript:{schema:transcript.schema,head:transcript.head,callbackCount:f.read?1:0},
        instructionProfile:{id:NATIVE_READ_PROFILE,hash:instructionProfile(NATIVE_READ_PROFILE).hash}};
      const response={value,receipt,nativeTranscript:transcript};f.responses.push(response);await f.hook('before-retention',f);
      s.retainOutcome({value,receipt});await f.hook('returned',f);return response;
    },async close(){f.closed++;await f.hook('close',f);return {processExitObserved:true};}});
    e.workers.providerFactory=()=>({async generate(request){
      f.reviewCalls++;assert.equal(request.instructionProfile,'scoped-v1');assert.equal(request.nativeSession,undefined);
      const exposure=readSourceContextView(request.input),task=JSON.parse(exposure.task);f.review={request,exposure,task};
      assert.ok(task.candidateId,'A transport fault must not be converted to planning');await f.hook('review',f);
      const a=exposure.artifacts.find(x=>x.id===task.candidateId),evidence=[{kind:'artifact',id:a.id,hash:a.hash,quote:a.payload.body},
        ...exposure.toolObservations.filter(o=>o.relation==='OWN_ACTION').map(o=>({kind:'tool',id:o.id,hash:o.hash,quote:o.quoteText}))];
      const value={artifactHash:a.hash,purpose:a.payload.purpose,decision:'ACCEPT',checks:task.criteria.map(c=>({criterionId:c.id,verdict:'PASS',evidence,
        reason:'SIM control-path test, not a semantic judgment from a live model.'})),findings:[],uncertainty:'SIM'};
      await request.validate(value);return {value,receipt:{kind:'inference',simulation:true,status:'completed',threadId:'review-sim-'+f.reviewCalls,
        turnId:'review-turn',contextHash:inferenceRequestHash(request)}};
    },async close(){return {processExitObserved:true};}});
  };open();
  f.mission=f.e.create(read?'Read input.txt and calculate the sum of its supplied numbers. Return only a text derivation.':'Calculate 13 + 17 from the supplied integers.',
    {entryMode:BOUNDED_READ_MODE,nativeReadTransport:NATIVE_READ_PROFILE,instructionProfile:'scoped-v1',allowedTools:['workspace.read'],
      ...(maxCalls===null?{}:{inferenceBudget:{mode:'mission-calls-v1',maxCalls}}),...options});
  f.workspace=f.e.broker.registerWorkspace(f.mission.id).path;writeFileSync(join(f.workspace,'input.txt'),'13\n17\n');
  f.run=signal=>runBoundedReadEntry(f.e,f.e.store.get('mission',f.mission.id).data,signal);
  f.runId=()=>f.e.store.get('bounded-read-entry',f.mission.id).data.runId;
  // Budgeted histories include signed dispatch lineage; use the trusted
  // registry envelope rather than a naked Store, which deliberately cannot
  // authenticate historical reservations.
  f.budget=()=>missionInferenceBudget(f.e.registry,f.mission.id);
  f.reopen=()=>{f.e.close();open();};
  t.after(()=>{f.e.close();rmSync(directory,{recursive:true,force:true});});return f;
}
test('native integration: real one-read broker, charged continuation, isolated later reviewer and exact recovery',async t=>{
  const f=fixture(t,{options:{producerBatch:'read-test-cursor-v1'},hook:async(phase,f)=>{
    if(['prepared','ack','finish'].includes(phase)){
      const run=f.e.store.get('run',f.runId()).data;assert.ok(run.expectedRequestHash);assert.equal(run.toolObservations?.length??0,0);
      assert.equal(f.budget().reserved,2);assert.equal(f.e.store.list('effect').length,1);
    }
  }}),a=await f.run();assert.equal(a.status,'ACCEPTED');assert.equal(f.nativeCalls,1);assert.equal(f.reviewCalls,1);
  assert.deepEqual(f.budget().byKind,{worker:2,search:0,'native-continuation':1});assert.equal(f.budget().reserved,3);
  assert.equal(f.e.store.list('producer-tool-charge').length,0);assert.equal(f.e.store.list('native-read-continuation').length,1);
  const producer=f.e.store.get('run',f.runId()).data;assert.equal(producer.toolObservations.length,1);
  const own=f.review.exposure.toolObservations.find(o=>o.relation==='OWN_ACTION');assert.equal(own.result.content,'13\n17\n');
  assert.ok(f.e.registry.committedSequence('effect',own.id,1)>f.e.registry.committedSequence('artifact',a.id,1));
  assert.equal(nativeReadRecovery(f.e.registry,f.runId()).phase,'COMPLETED');
  const material=()=>['run','artifact','effect','worker-proposal','inference-request','mission-inference-call','native-read-session','native-read-continuation']
    .flatMap(type=>f.e.store.list(type).map(r=>({type,id:r.id,version:r.version,hash:r.hash})));
  const before=material();f.reopen();assert.equal((await f.run()).id,a.id);
  assert.equal(f.nativeCalls,1);assert.equal(f.reviewCalls,1);assert.deepEqual(material(),before);f.e.store.verifyJournal();
});
test('native integration: no-input response consumes no callback or invented tool evidence',async t=>{
  const f=fixture(t,{read:false,maxCalls:2}),a=await f.run();assert.equal(a.status,'ACCEPTED');
  assert.equal(f.e.store.list('effect').length,0);assert.equal(f.budget().reserved,2);
  assert.equal(f.e.store.list('native-read-continuation').length,0);
});
test('native integration: a completed producer that exhausted the budget does not trigger a futile reviewer read',async t=>{
  const f=fixture(t,{maxCalls:2});await assert.rejects(f.run(),{code:'INFERENCE_BUDGET_EXHAUSTED'});
  assert.equal(f.nativeCalls,1);assert.equal(f.reviewCalls,0);assert.equal(f.e.store.list('effect').length,1);
  assert.equal(f.e.store.list('run').filter(r=>r.data.mode==='reviewer').length,0);
  assert.equal(f.e.store.list('artifact').length,1);assert.equal(f.e.store.list('review').length,0);
});
test('native integration: timed-out judge recovery preserves the exact candidate without new reads or actors at exhausted budget',async t=>{
  const f=fixture(t,{hook:async phase=>{if(phase==='review')throw Object.assign(Error('SIM judge timeout'),{code:'TIMEOUT'});}});
  await assert.rejects(f.run(),{code:'TIMEOUT'});const before=f.e.store.verifyJournal(),proposal=f.e.store.list('worker-proposal'),runs=f.e.store.list('run');
  assert.equal(f.e.store.list('effect').length,2);f.reopen();await assert.rejects(f.run(),{code:'INFERENCE_BUDGET_EXHAUSTED'});
  assert.deepEqual(f.e.store.verifyJournal(),before);assert.deepEqual(f.e.store.list('worker-proposal'),proposal);assert.deepEqual(f.e.store.list('run'),runs);
  assert.equal(f.e.store.list('effect').length,2);assert.equal(f.nativeCalls,1);assert.equal(f.reviewCalls,1);assert.equal(f.budget().reserved,3);
});
test('native integration: local consumption remains durable without a global budget',async t=>{
  const f=fixture(t,{maxCalls:null});await f.run();assert.equal(f.budget(),null);
  assert.equal(f.e.store.list('mission-inference-call').length,0);assert.equal(f.e.store.list('native-read-continuation').length,1);
});
for(const limit of ['mission','steps'])test('native integration: exhausted '+limit+' stops before read or tool-result dispatch',async t=>{
  const f=fixture(t,{maxCalls:limit==='mission'?1:3});if(limit==='steps')f.e.workers.maxSteps=1;
  await assert.rejects(f.run(),{code:'NATIVE_READ_RECONCILE'});assert.equal(f.e.store.list('effect').length,0);
  assert.equal(f.e.store.list('native-read-continuation').length,0);assert.equal(f.budget().reserved,1);
  const state=nativeReadRecovery(f.e.registry,f.runId());assert.equal(state.phase,'BOUND');assert.equal(state.recovery.mayResend,false);
  const before=f.nativeCalls;f.reopen();await assert.rejects(f.run(),{code:'NATIVE_READ_RECONCILE'});assert.equal(f.nativeCalls,before);
});
for(const boundary of ['prepared','dispatch','ack','finish'])test('native integration: failure after '+boundary+' preserves state and prohibits replacement inference',async t=>{
  const f=fixture(t,{hook:async phase=>{if(phase===boundary)throw Object.assign(Error('Synthetic boundary failure'),{code:'SYNTHETIC'});}});
  await assert.rejects(f.run(),{code:'NATIVE_READ_RECONCILE'});const expected={prepared:'PREPARED',dispatch:'DISPATCH_INTENT',ack:'ACKNOWLEDGED',finish:'COMPLETED'}[boundary];
  assert.equal(nativeReadRecovery(f.e.registry,f.runId()).phase,expected);assert.equal(f.budget().reserved,2);
  assert.equal(f.e.store.list('effect').length,1);assert.equal(f.e.store.list('worker-proposal').length,0);
  f.reopen();await assert.rejects(f.run(),{code:'NATIVE_READ_RECONCILE'});assert.equal(f.nativeCalls,1);assert.equal(f.reviewCalls,0);
});
test('native integration: general observation API still rejects a mid-inference receipt',async t=>{
  const f=fixture(t,{hook:async(phase,f)=>{if(phase==='prepared'){
    const signed=f.e.store.list('effect')[0].data.receipt;
    assert.throws(()=>f.e.registry.recordToolObservation(f.runId(),signed),{code:'INFERENCE_PENDING'});
  }}});await f.run();
});
test('native integration: response substitution after FINISH cannot attach inference or a candidate',async t=>{
  const f=fixture(t,{hook:async(phase,f)=>{if(phase==='before-retention')f.responses.at(-1).value.body='Unacknowledged replacement';}});
  await assert.rejects(f.run(),{code:'NATIVE_READ_RECONCILE'});
  assert.equal(f.e.store.list('artifact').length,0);assert.equal(f.e.store.list('worker-proposal').length,0);
  assert.ok(f.e.store.get('run',f.runId()).data.expectedRequestHash);assert.equal(f.budget().reserved,2);
});
test('native integration: invalid callback path never becomes a broker intent',async t=>{
  const f=fixture(t,{readArgs:{path:'../escape.txt'}});await assert.rejects(f.run(),{code:'NATIVE_READ_RECONCILE'});
  assert.equal(f.e.store.list('effect').length,0);assert.equal(f.e.store.list('native-read-continuation').length,0);
});
test('native integration: declared transport cannot promote a native profile to every actor',t=>{
  const f=fixture(t);for(const options of [{instructionProfile:NATIVE_READ_PROFILE},{nativeReadTransport:NATIVE_READ_PROFILE},
    {nativeReadTransport:'unknown',entryMode:BOUNDED_READ_MODE}])assert.throws(()=>f.e.create('A complete immutable request',options),{code:'POLICY'});
});
test('native integration: revoked lease after preparation prevents dispatch without refund',async t=>{
  const f=fixture(t,{hook:async(phase,f)=>{if(phase==='prepared'){
    const c=f.e.store.get('native-read-continuation',f.runId());f.e.authority.revoke(c.data.lease.data.id,'Synthetic callback revocation');
  }}});
  await assert.rejects(f.run(),{code:'NATIVE_READ_RECONCILE'});const state=nativeReadRecovery(f.e.registry,f.runId());
  assert.equal(state.phase,'PREPARED');assert.equal(state.dispatchIntended,false);assert.equal(f.budget().reserved,2);
});
test('native integration: denied mission read authority creates neither consumption nor effect',async t=>{
  const f=fixture(t,{options:{allowedTools:[]}});await assert.rejects(f.run(),{code:'NATIVE_READ_RECONCILE'});
  assert.equal(f.e.store.list('effect').length,0);assert.equal(f.e.store.list('native-read-continuation').length,0);
});
test('native integration: a second callback cannot purchase another unit or issue another read',async t=>{
  const f=fixture(t,{hook:async(phase,f)=>{if(phase==='prepared'){
    const before=f.e.store.verifyJournal();await assert.rejects(f.session.prepare({...f.ids,namespace:NATIVE_READ_TOOL_BINDING.namespace,
      tool:NATIVE_READ_TOOL_BINDING.name,arguments:{path:'input.txt'}}),{code:'BOUNDED_READ_SCOPE'});
    assert.deepEqual(f.e.store.verifyJournal(),before);
  }}});await f.run();assert.equal(f.budget().reserved,3);assert.equal(f.e.store.list('effect').length,2);
});
test('native integration: oversized input is committed as observed bytes but never prepared or truncated',async t=>{
  const f=fixture(t);writeFileSync(join(f.workspace,'input.txt'),'a'.repeat(65537));
  await assert.rejects(f.run(),{code:'NATIVE_READ_RECONCILE'});const state=nativeReadRecovery(f.e.registry,f.runId());
  assert.equal(state.phase,'CALLED');assert.equal(f.e.store.list('effect')[0].data.receipt.data.result.content.length,65537);
  assert.equal(f.budget().reserved,2);assert.equal(f.e.store.list('artifact').length,0);
});
test('native integration: global reservation storage failure rolls back CALL and local consumption before broker access',async t=>{
  const f=fixture(t),put=f.e.store.put.bind(f.e.store);
  const fault=t.mock.method(f.e.store,'put',(type,id,data,...args)=>{
    if(type==='mission-inference-call'&&data.kind==='native-continuation')throw Object.assign(Error('Synthetic reservation failure'),{code:'SYNTHETIC'});
    return put(type,id,data,...args);
  });
  await assert.rejects(f.run(),{code:'NATIVE_READ_RECONCILE'});fault.mock.restore();
  assert.equal(nativeReadRecovery(f.e.registry,f.runId()).phase,'BOUND');assert.equal(f.e.store.list('effect').length,0);
  assert.equal(f.e.store.list('native-read-continuation').length,0);assert.equal(f.budget().reserved,1);
});
test('native integration: prepare rollback leaves its controller checkpoint usable for diagnosis',async t=>{
  const f=fixture(t);writeFileSync(join(f.workspace,'input.txt'),'a'.repeat(65537));
  await assert.rejects(f.run(),{code:'NATIVE_READ_RECONCILE'});
  assert.equal(f.session.checkpoint().frames.at(-1).event.kind,'CALL');f.e.store.verifyJournal();
});
test('native integration: retained public outcome survives failure before provider return without another inference',async t=>{
  let failed=false;
  const f=fixture(t,{hook:async phase=>{if(phase==='returned'&&!failed){failed=true;throw Object.assign(Error('Synthetic return failure'),{code:'SYNTHETIC'});}}});
  await assert.rejects(f.run(),{code:'NATIVE_READ_RECONCILE'});assert.equal(f.e.store.list('worker-proposal').length,1);
  assert.equal(f.e.store.get('run',f.runId()).data.expectedRequestHash,null);assert.equal(f.budget().reserved,2);
  f.reopen();const a=await f.run();assert.equal(a.status,'ACCEPTED');assert.equal(f.nativeCalls,1);assert.equal(f.reviewCalls,1);
  assert.equal(f.e.store.list('effect').length,2);assert.equal(f.budget().reserved,3);
});
test('native integration: committed public outcome still cannot bypass unconfirmed provider cleanup',async t=>{
  const f=fixture(t,{hook:async phase=>{if(phase==='close')throw Object.assign(Error('Synthetic cleanup failure'),{code:'CLEANUP_UNCONFIRMED'});}});
  await assert.rejects(f.run(),{code:'NATIVE_READ_RECONCILE'});assert.equal(f.e.store.list('worker-proposal').length,1);
  f.reopen();await assert.rejects(f.run(),{code:'CLEANUP_UNCONFIRMED'});assert.equal(f.nativeCalls,1);assert.equal(f.reviewCalls,0);
});
for(const phase of ['bound','prepared'])test('native integration: cancellation at '+phase+' cannot dispatch a tool result',async t=>{
  const controller=new AbortController(),f=fixture(t,{hook:async p=>{if(p===phase)controller.abort();}});
  await assert.rejects(f.run(controller.signal),{code:'NATIVE_READ_RECONCILE'});
  const state=nativeReadRecovery(f.e.registry,f.runId());assert.equal(state.dispatchIntended,false);
  assert.equal(state.phase,phase==='bound'?'BOUND':'PREPARED');assert.equal(f.budget().reserved,phase==='bound'?1:2);
});
test('native integration: public report exposes only the admitted native boundary, not callbacks, receipts or budget telemetry',async t=>{
  const f=fixture(t);await f.run();const before=f.e.store.verifyJournal(),report=missionReport(f.e.store,f.mission.id,{registry:f.e.registry}),text=formatMissionReport(report);
  assert.deepEqual(f.e.store.verifyJournal(),before);
  assert.deepEqual(report.metrics,{
    integrity:'NOT_ATTESTED',
    scope:'Operational telemetry is intentionally not projected from generic run, effect or journal rows. A matching missionId/runId does not prove actor lineage, dispatch, completion, failure, usage, retry, review, correction or billing. Use the separately verified immutable reservation budgets above for bounded capacity; expose runtime telemetry only through a future signed, end-to-end attestation contract.',
    operationalTelemetry:'NOT_PROJECTED',correctionTelemetry:'NOT_PROJECTED',usageTelemetry:'NOT_PROJECTED'
  });
  assert.deepEqual(report.inferenceBudget,{
    integrity:'NOT_PROJECTED',
    scope:'The global inference-reservation ledger is retained for internal enforcement but is not yet a public attestation: generic reservation/run/request rows must first be bound to their exact worker configuration, production contract and request lineage. No capacity, actor, request, operation or usage detail is projected here.'
  });
  assert.deepEqual(report.nativeInput,{
    schema:'sovereign.native-read-public-boundary.v1',integrity:'NOT_PROJECTED',transport:'native-read-v1',actors:[],
    scope:'The bounded native-read transport is selected by the admitted policy. Session, request, transcript, callback, continuation, cleanup, outcome, file path and file bytes remain private until a dedicated end-to-end public attestation exists.'
  });
  const publicJson=canonical(report);
  assert.ok(!publicJson.includes('13\\n17\\n'));
  for(const [field,value] of Object.entries(f.ids))assert.ok(!publicJson.includes(`\"${field}\":${JSON.stringify(value)}`));
  assert.match(text,/ledger interno no se proyecta como atestación pública/);
  assert.match(text,/Lectura nativa acotada: el transporte está admitido/);
  assert.doesNotMatch(text,/Continuaciones nativas reservadas:/);
});
for(const corruption of ['rewound-session','continuation-reversion','changed-effect','removed-policy'])
test('native integration: '+corruption+' cannot be consumed or refunded on recovery',async t=>{
  const f=fixture(t,{hook:async phase=>{if(phase==='prepared')throw Object.assign(Error('Synthetic stop'),{code:'SYNTHETIC'});}});
  await assert.rejects(f.run(),{code:'NATIVE_READ_RECONCILE'});const s=f.e.store,runId=f.runId();
  if(corruption==='rewound-session')s.db.prepare("UPDATE heads SET version=version-1 WHERE type='native-read-session' AND id=?").run(runId);
  if(corruption==='continuation-reversion'){const r=s.get('native-read-continuation',runId);s.put(r.type,r.id,r.data,{expectedVersion:r.version});}
  if(corruption==='changed-effect'){const r=s.list('effect')[0];s.put(r.type,r.id,r.data,{expectedVersion:r.version});}
  if(corruption==='removed-policy'){const r=s.get('mission',f.mission.id),policy={...r.data.policy};delete policy.nativeReadTransport;s.put(r.type,r.id,{...r.data,policy},{expectedVersion:r.version});}
  assert.throws(()=>nativeReadRecovery(f.e.registry,runId));assert.equal(f.nativeCalls,1);assert.equal(s.list('worker-proposal').length,0);
});
test('native integration: execution floor 8 and selected mission roll back together on failed creation',t=>{
  const f=fixture(t),store=new Store(':memory:'),e=new FactoryEngine({store,workspaceRoot:join(f.workspace,'rollback-fixture')});
  t.after(()=>e.close());assert.equal(store.db.prepare('PRAGMA user_version').get().user_version,2);
  const before=store.verifyJournal(),put=store.put.bind(store),fault=t.mock.method(store,'put',(type,...args)=>{
    if(type==='mission')throw Object.assign(Error('Synthetic admission fault'),{code:'SYNTHETIC'});return put(type,...args);
  });
  assert.throws(()=>e.create('An exact closed request',{entryMode:BOUNDED_READ_MODE,nativeReadTransport:NATIVE_READ_PROFILE}),{code:'SYNTHETIC'});
  fault.mock.restore();assert.deepEqual(store.verifyJournal(),before);assert.equal(store.db.prepare('PRAGMA user_version').get().user_version,2);
  e.create('An exact closed request',{entryMode:BOUNDED_READ_MODE,nativeReadTransport:NATIVE_READ_PROFILE});
  assert.equal(store.db.prepare('PRAGMA user_version').get().user_version,8);
});
