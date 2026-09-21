// Real SQLite/accounting, no live model or remote search in this file.
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {spawn} from 'node:child_process';
import {FactoryEngine} from '../../factory/lib/engine.mjs';
import {sha256} from '../../factory/lib/contracts.mjs';
import {missionInferenceBudgetPolicy,reserveMissionInference} from '../../factory/lib/mission-inference-budget.mjs';
import {inferenceRequestHash} from '../../factory/providers/instruction-profiles.mjs';
import {missionReport,formatMissionReport} from '../../factory/lib/report.mjs';

const selected=maxCalls=>({mode:'mission-calls-v1',maxCalls});
function fixture(t,{maxCalls=2,enabled=true}={}){
  const directory=mkdtempSync(join(tmpdir(),'mission-inference-budget-'));let engine;
  let providerCalls=0;
  const open=()=>{engine=new FactoryEngine({databasePath:join(directory,'state.sqlite'),workspaceRoot:join(directory,'jobs')});
    engine.workers.providerFactory=()=>({async generate(request){
      providerCalls++;
      const value={ok:true};assert.equal(await request.validate(value),true);
      return {value,receipt:{status:'completed',simulation:true,threadId:`budget-fixture-${providerCalls}`,turnId:'turn',
        model:request.model,reasoningEffort:request.reasoningEffort,contextHash:inferenceRequestHash(request)}};
    },async close(){}});};open();
  t.after(()=>{engine.close();rmSync(directory,{recursive:true,force:true});});
  const mission=engine.create('Complete every requested obligation and retain independent review.',{allowedTools:['source.search','workspace.list'],
    ...(enabled?{inferenceBudget:selected(maxCalls)}:{})});
  const actor=(phase='reviewer',nodeId='delivery')=>engine.workers.createRun({missionId:mission.id,nodeId:`review:${nodeId}:${phase}`,
    mode:'reviewer',purpose:nodeId,roleIds:['omega_03']});
  const requestFor=()=>({instructions:'bounded test instructions',input:'Exact synthetic input',schema:{type:'object',properties:{ok:{type:'boolean'}},required:['ok'],additionalProperties:false},
    model:mission.policy.model,reasoningEffort:mission.policy.reasoningEffort});
  const infer=run=>engine.workers.infer({runId:run.id,...requestFor(),validate:value=>value.ok===true});
  return {directory,mission,actor,requestFor,infer,get calls(){return providerCalls;},get e(){return engine;},reopen(){engine.close();open();}};
}
const view=async f=>(await import('../../factory/lib/mission-inference-budget.mjs')).missionInferenceBudget(f.e.registry,f.mission.id);

test('mission budget reads explicit policy without a provider call or storage mutation',async t=>{
  const f=fixture(t),before=f.e.store.verifyJournal(),v=await view(f);
  assert.equal(v.reserved,0);assert.equal(v.remaining,2);assert.deepEqual(v.byKind,{worker:0,search:0});
  assert.deepEqual(f.e.store.verifyJournal(),before);
});
test('different phases share one durable ceiling instead of resetting it for a new actor',async t=>{
  const f=fixture(t);for(const phase of ['first-phase','second-phase'])await f.infer(f.actor(phase));
  f.reopen();const run=f.actor('third-phase');
  await assert.rejects(f.infer(run),{code:'INFERENCE_BUDGET_EXHAUSTED'});
  assert.equal((await view(f)).reserved,2);assert.equal(f.e.store.list('mission-inference-call').length,2);
  assert.equal(f.e.store.get('run',run.id).data.expectedRequestHash,undefined);
});
test('same pending request cannot replay or consume a second reservation',async t=>{
  const f=fixture(t),run=f.actor();let release;const gate=new Promise(resolve=>{release=resolve;});
  f.e.workers.providerFactory=()=>({async generate(request){await gate;const value={ok:true};assert.equal(await request.validate(value),true);
    return {value,receipt:{status:'completed',simulation:true,threadId:'pending-worker',turnId:'turn',model:request.model,
      reasoningEffort:request.reasoningEffort,contextHash:inferenceRequestHash(request)}};},async close(){}});
  const first=f.infer(run);await new Promise(resolve=>setImmediate(resolve));
  const before=f.e.store.verifyJournal();await assert.rejects(f.infer(run),{code:'INFERENCE_PENDING'});
  assert.equal((await view(f)).reserved,1);assert.deepEqual(f.e.store.verifyJournal(),before);
  release();await first;
});
test('failed reservation commit rolls back pending run and retained request atomically',async t=>{
  const f=fixture(t),run=f.actor(),put=f.e.store.put.bind(f.e.store);
  const fault=t.mock.method(f.e.store,'put',(type,...args)=>{if(type==='mission-inference-call')throw Error('Synthetic reservation storage fault');return put(type,...args);});
  await assert.rejects(f.infer(run),/Synthetic reservation storage fault/);
  fault.mock.restore();assert.equal(f.e.store.list('mission-inference-call').length,0);assert.equal(f.e.store.list('inference-request').length,0);
  assert.equal(f.e.store.get('run',run.id).data.expectedRequestHash,undefined);assert.equal(f.calls,0);assert.equal((await view(f)).reserved,0);
});
test('unselected mission keeps the previous request shape and has no budget ledger',async t=>{
  const f=fixture(t,{enabled:false}),run=f.actor();f.e.registry.recordInferenceRequest(run.id,f.requestFor());
  assert.equal(await view(f),null);assert.equal(f.e.store.list('mission-inference-call').length,0);
  assert.equal(f.e.store.get('mission',f.mission.id).data.policy.inferenceBudget,undefined);
});

for(const value of [null,{}, {mode:'mission-calls-v1'}, {mode:'unknown',maxCalls:2},
  ...[0,-1,1.5,1001,Infinity,NaN,'2',null].map(maxCalls=>selected(maxCalls)),{...selected(2),unlimited:true}])
test('budget policy rejects invalid or ambiguous configuration '+JSON.stringify(value),()=>{
  assert.throws(()=>missionInferenceBudgetPolicy(value));
});
test('policy is detached and accepts only exact integer endpoints',()=>{
  const input=selected(1),p=missionInferenceBudgetPolicy(input);input.maxCalls=999;
  assert.deepEqual(p,selected(1));assert.deepEqual(missionInferenceBudgetPolicy(selected(1000)),selected(1000));
});
for(const change of ['higher-limit','remove-policy','changed-mandate','hidden-head','reversion','request-reversion','request-hidden'])
test('budget accounting detects '+change+' instead of refunding attempts',async t=>{
  const f=fixture(t),run=f.actor();await f.infer(run);
  const r=f.e.store.list('mission-inference-call')[0],m=f.e.store.get('mission',f.mission.id);
  if(change==='higher-limit')f.e.store.put(m.type,m.id,{...m.data,policy:{...m.data.policy,inferenceBudget:selected(20)}},{expectedVersion:m.version});
  if(change==='remove-policy'){const policy={...m.data.policy};delete policy.inferenceBudget;f.e.store.put(m.type,m.id,{...m.data,policy},{expectedVersion:m.version});}
  if(change==='changed-mandate'){const intent='Changed';f.e.store.put(m.type,m.id,{...m.data,intent,intentHash:sha256(intent)},{expectedVersion:m.version});}
  if(change==='hidden-head')f.e.store.db.prepare('DELETE FROM heads WHERE type=? AND id=?').run(r.type,r.id);
  if(change==='reversion')f.e.store.put(r.type,r.id,{...r.data,ordinal:0},{expectedVersion:r.version});
  if(change==='request-reversion'){const q=f.e.store.get('inference-request',r.data.binding.request.id);f.e.store.put(q.type,q.id,q.data,{expectedVersion:q.version});}
  if(change==='request-hidden')f.e.store.db.prepare('DELETE FROM heads WHERE type=? AND id=?').run('inference-request',r.data.binding.request.id);
  await assert.rejects(view(f),{code:'INFERENCE_BUDGET_INTEGRITY'});
});
test('budget cannot be retrofitted onto an already-created unselected mission',async t=>{
  const f=fixture(t,{enabled:false}),m=f.e.store.get('mission',f.mission.id);
  f.e.store.put(m.type,m.id,{...m.data,policy:{...m.data.policy,inferenceBudget:selected(2)}},{expectedVersion:m.version});
  await assert.rejects(view(f),{code:'INFERENCE_BUDGET_INTEGRITY'});
});

const searchResult=args=>({schema:'sovereign.discovery.v1',query:args.query,queryHash:sha256(args),candidates:[],
  closure:{processExitObserved:true},inference:{simulation:true,toolPolicy:'public-search-v1'},searchObservations:[{actionType:'search'}]});
const search=(f,run,operationId='search-1')=>f.e.workers.tool(run.id,'source.search',{query:'Public synthetic test query',limit:1},operationId);
test('worker and discovery share the last unit and a completed search receipt is recoverable without another charge',async t=>{
  const f=fixture(t,{maxCalls:2}),run=f.actor();let calls=0;
  f.e.broker.searchProvider={async search(args){calls++;return searchResult(args);}};
  await f.infer(run);
  // The discovery actor has its own authenticated WorkerService origin; it
  // never relies on a synthetic pending worker row.
  const searchRun=f.actor(),first=await search(f,searchRun),second=await search(f,searchRun);
  assert.equal(first.status,'SUCCEEDED');assert.deepEqual(second,first);assert.equal(calls,1);
  assert.deepEqual((await view(f)).byKind,{worker:1,search:1});
  const extra=await search(f,searchRun,'search-2');assert.equal(extra.status,'FAILED');
  assert.equal(extra.result.error.code,'INFERENCE_BUDGET_EXHAUSTED');assert.equal(calls,1);
  assert.equal((await view(f)).reserved,2);
  const denied=f.e.store.get('effect','search-2');
  for(let version=1;version<=denied.version;version++)assert.notEqual(f.e.store.get('effect','search-2',version).data.state,'DISPATCHED');
});
test('search failure retains its charge and cannot consume a worker retry under another actor',async t=>{
  const f=fixture(t,{maxCalls:1}),run=f.actor();let calls=0;
  f.e.broker.searchProvider={async search(){calls++;throw Object.assign(Error('Synthetic quota'),{code:'QUOTA'});}};
  const receipt=await search(f,run);assert.equal(receipt.result.error.code,'QUOTA');assert.equal(calls,1);
  const another=f.actor('reviewer');await assert.rejects(f.infer(another),{code:'INFERENCE_BUDGET_EXHAUSTED'});
  f.reopen();assert.equal((await view(f)).reserved,1);
});
test('search reservation storage failure rolls back DISPATCHED before any provider call',async t=>{
  const f=fixture(t),run=f.actor();let calls=0;f.e.broker.searchProvider={async search(args){calls++;return searchResult(args);}};
  const put=f.e.store.put.bind(f.e.store),fault=t.mock.method(f.e.store,'put',(type,...args)=>{
    if(type==='mission-inference-call')throw Object.assign(Error('Synthetic storage fault'),{code:'SYNTHETIC'});return put(type,...args);
  });
  const receipt=await search(f,run);fault.mock.restore();assert.equal(receipt.status,'FAILED');assert.equal(calls,0);
  assert.equal((await view(f)).reserved,0);const effect=f.e.store.get('effect','search-1');
  for(let v=1;v<=effect.version;v++)assert.notEqual(f.e.store.get('effect','search-1',v).data.state,'DISPATCHED');
});
test('ordinary read-only workspace operation consumes no model reservation',async t=>{
  const f=fixture(t,{maxCalls:1}),run=f.actor();await f.infer(run);
  const another=f.actor(),receipt=await f.e.workers.tool(another.id,'workspace.list',{path:'.'},'list-only');
  assert.equal(receipt.status,'SUCCEEDED');assert.equal((await view(f)).reserved,1);
});
test('report redacts operational reservation telemetry without mutating evidence',async t=>{
  const f=fixture(t),run=f.actor();await f.infer(run);
  const before=f.e.store.verifyJournal(),report=missionReport(f.e.store,f.mission.id),text=formatMissionReport(report);
  assert.equal(report.inferenceBudget.integrity,'NOT_PROJECTED');assert.equal(report.metrics.integrity,'NOT_ATTESTED');
  assert.match(text,/ledger interno no se proyecta como atestación pública/);
  assert.deepEqual(f.e.store.verifyJournal(),before);
});

function compiledActor(f,phase='reviewer'){
  return f.e.workers.createRun({missionId:f.mission.id,nodeId:`review:delivery:${phase}`,mode:'reviewer',purpose:'delivery',
    roleIds:['omega_03']});
}
const infer=(f,run)=>f.e.workers.infer({runId:run.id,instructions:'Emit only the synthetic test result.',input:'{}',
  schema:{type:'object',properties:{ok:{type:'boolean'}},required:['ok'],additionalProperties:false},validate:v=>v.ok===true});
test('actual WorkerService reviewer reserves before simulated provider and blocks the next actor',async t=>{
  const f=fixture(t,{maxCalls:1}),run=compiledActor(f);let calls=0;
  f.e.workers.providerFactory=()=>({async generate(request){calls++;
    assert.equal((await view(f)).reserved,1);const input=JSON.parse(request.input);
    assert.equal(input.runtimeCapabilities.missionInferenceBudget,undefined,'Judges do not receive mutable budget telemetry');
    return {value:{ok:true},receipt:{status:'completed',simulation:true,
      threadId:'simulated-worker',turnId:'simulated-turn',contextHash:inferenceRequestHash(request)}};
  },async close(){}});
  await infer(f,run);const judge=compiledActor(f,'exhausted-reviewer');await assert.rejects(infer(f,judge),{code:'INFERENCE_BUDGET_EXHAUSTED'});
  assert.equal(calls,1);assert.equal(f.e.store.get('run',judge.id).data.expectedRequestHash,undefined);
});
test('judges retain their scoped evidence context without the mission budget observation',async t=>{
  const f=fixture(t,{maxCalls:1}),run=compiledActor(f,'reviewer');
  f.e.workers.providerFactory=()=>({async generate(request){assert.equal(JSON.parse(request.input).runtimeCapabilities.missionInferenceBudget,undefined);
    return {value:{ok:true},receipt:{status:'completed',simulation:true,threadId:'simulated-judge',turnId:'simulated-turn',contextHash:inferenceRequestHash(request)}};
  },async close(){}});await infer(f,run);assert.equal((await view(f)).reserved,1);
});
test('unqualified budgeted scope does not import an old learned overlay',t=>{
  const f=fixture(t);f.e.workers.learningInstructionsResolver=()=>assert.fail('Old overlays are not qualified for budgeted execution');
  const run=compiledActor(f),config=f.e.store.get('worker-config',run.id).data;
  assert.deepEqual(config.learnedInstructionVersions,[]);assert.equal(config.compilationScope.inferenceBudgetHash,sha256(selected(2)));
});

function child(t,f,mode){
  const p=spawn(process.execPath,[new URL('./fixtures/mission-budget-process.mjs',import.meta.url).pathname,f.directory,mode],
    {stdio:['ignore','pipe','pipe']});let stderr='',stdout='';p.stdout.on('data',b=>{stdout+=b;});p.stderr.on('data',b=>{stderr+=b;});
  const timer=setTimeout(()=>{if(p.exitCode===null&&p.signalCode===null)p.kill('SIGKILL');},15000);
  t.after(()=>{clearTimeout(timer);if(p.exitCode===null&&p.signalCode===null)p.kill('SIGKILL');});
  return new Promise((resolve,reject)=>{p.once('error',reject);p.once('close',(code,signal)=>{clearTimeout(timer);resolve({code,signal,stdout,stderr});});});
}
test('REAL two-process contention cannot spend the final mission call twice',async t=>{
  const f=fixture(t,{maxCalls:1});
  const outcomes=await Promise.all([child(t,f,'reserve'),child(t,f,'reserve')]);
  assert.ok(outcomes.every(o=>o.signal===null),JSON.stringify(outcomes));
  assert.deepEqual(outcomes.map(o=>o.code).sort((a,b)=>a-b),[0,86],JSON.stringify(outcomes));
  assert.equal((await view(f)).reserved,1);assert.equal(f.e.store.list('inference-request').length,1);f.e.store.verifyJournal();
});
for(const kind of ['worker','search'])for(const boundary of ['before-commit','after-commit'])
test(`REAL SIGKILL ${kind} ${boundary} preserves the correct reservation boundary`,async t=>{
  const f=fixture(t,{maxCalls:1}),outcome=await child(t,f,kind+'-'+boundary);
  assert.equal(outcome.signal,'SIGKILL',JSON.stringify(outcome));f.reopen();
  const committed=boundary==='after-commit';assert.equal((await view(f)).reserved,committed?1:0);f.e.store.verifyJournal();
  if(kind==='worker'){
    assert.equal(f.e.store.list('inference-request').length,committed?1:0);
    const retry=f.actor('post-crash-worker');
    if(committed)await assert.rejects(f.infer(retry),{code:'INFERENCE_BUDGET_EXHAUSTED'});
    else await f.infer(retry);
  }else{
    let calls=0;f.e.broker.searchProvider={async search(args){calls++;return searchResult(args);}};const retry=f.actor('post-crash-search');
    if(committed){const receipt=await search(f,retry,'retry-search');assert.equal(receipt.status,'FAILED');assert.equal(receipt.result.error.code,'INFERENCE_BUDGET_EXHAUSTED');assert.equal(calls,0);}
    else{assert.equal((await search(f,retry,'retry-search')).status,'SUCCEEDED');assert.equal(calls,1);}
  }
  assert.equal((await view(f)).reserved,1);
});
test('accounting requires a trusted signed-provenance reader once a worker call exists',async t=>{
  const f=fixture(t),run=f.actor();await f.infer(run);
  const {missionInferenceBudget}=await import('../../factory/lib/mission-inference-budget.mjs');
  assert.throws(()=>missionInferenceBudget(f.e.store,f.mission.id),{code:'INFERENCE_BUDGET_INTEGRITY'});
  assert.equal((await view(f)).reserved,1);
});
test('budgeted receipt cannot bypass the prospective reservation through direct registry attachment',async t=>{
  const f=fixture(t),run=f.actor(),before=f.e.store.verifyJournal();
  assert.throws(()=>f.e.registry.attachInference(run.id,{status:'completed',simulation:true,threadId:'unreserved-thread',turnId:'synthetic',contextHash:sha256('unreserved')}),
    {code:'INFERENCE_BUDGET_INTEGRITY'});
  assert.deepEqual(f.e.store.verifyJournal(),before);assert.equal((await view(f)).reserved,0);
});
test('reservation rejects accessors without invoking them and retains the caller transaction',async t=>{
  const f=fixture(t),before=f.e.store.verifyJournal();let reads=0;
  const input={missionId:f.mission.id,kind:'worker'};Object.defineProperty(input,'binding',{enumerable:true,get(){reads++;return {};}});
  assert.throws(()=>reserveMissionInference(f.e.store,input),{code:'SCHEMA'});assert.equal(reads,0);
  const {missionInferenceBudget}=await import('../../factory/lib/mission-inference-budget.mjs');
  f.e.store.transact(()=>{assert.equal(missionInferenceBudget(f.e.store,f.mission.id).reserved,0);assert.equal(f.e.store.db.isTransaction,true);});
  assert.deepEqual(f.e.store.verifyJournal(),before);
});
