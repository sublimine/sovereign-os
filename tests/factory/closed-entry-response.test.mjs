// Fault-boundary tests. Simulated models; real SQLite and coordinator.
import test from 'node:test';import assert from 'node:assert/strict';
import fs from 'node:fs';import {join} from 'node:path';import {tmpdir} from 'node:os';
import {spawnSync} from 'node:child_process';
import {FactoryEngine} from '../../factory/lib/engine.mjs';
import {inferenceRequestHash} from '../../factory/providers/instruction-profiles.mjs';
import {readSourceContextView} from '../../factory/lib/source-context-view.mjs';
import {CLOSED_ENTRY_MODE,CLOSED_ENTRY_V2} from '../../factory/lib/closed-entry-spec.mjs';
import {readClosedEntryResponse} from '../../factory/lib/closed-entry-response.mjs';
import {sha256} from '../../factory/lib/contracts.mjs';
import {ownerProcessIsAlive} from '../../factory/lib/process-identity.mjs';
import {missionInferenceBudget} from '../../factory/lib/mission-inference-budget.mjs';

function fixture(t,mode,{contextEncoding='plain-json'}={}){
  const directory=fs.mkdtempSync(join(tmpdir(),'closed-response-durable-'));let engine,count=0;
  const open=()=>{
    engine=new FactoryEngine({databasePath:join(directory,'state.sqlite'),workspaceRoot:join(directory,'workspace')});
    engine.workers.providerFactory=()=>({async generate(request){
      count++;const context=readSourceContextView(request.input),task=JSON.parse(context.task);let value;
      if(task.entryMode)value={action:'answer',body:'(12 + 7 + 5) / 3 = 8.',reason:'All inputs supplied; exact closed derivation.'};
      else{
        assert.ok(request.schema.properties.artifactHash,'No planner or replacement route in this fixture');
        const a=context.artifacts.find(a=>a.id===task.candidateId);
        value={artifactHash:a.hash,purpose:a.payload.purpose,decision:'ACCEPT',checks:task.criteria.map(c=>({criterionId:c.id,verdict:'PASS',
          evidence:[{kind:'artifact',id:a.id,hash:a.hash,quote:a.payload.body}],reason:'Explicit simulated check of bounded fixture'})),findings:[],uncertainty:'SIMULATED'};
      }
      await request.validate(value);return {value,receipt:{kind:'inference',status:'completed',simulation:true,threadId:'sim:'+count,turnId:'simturn:'+count,
        model:request.model,reasoningEffort:request.reasoningEffort,contextHash:inferenceRequestHash(request)}};
    },async close(){}});return engine;
  };open();const mission=engine.create('Calcula la media de 12, 7 y 5 sin ejecutar código.',{entryMode:mode,contextEncoding,allowedTools:[],inferenceBudget:{mode:'mission-calls-v1',maxCalls:2}});
  t.after(()=>{engine.close();fs.rmSync(directory,{recursive:true,force:true});});
  return {mission,get engine(){return engine;},get count(){return count;},reopen(){engine.close();return open();}};
}
async function stopped(t,mode=CLOSED_ENTRY_V2,options){
  const s=fixture(t,mode,options),infer=s.engine.workers.infer.bind(s.engine.workers);
  s.engine.workers.infer=async args=>{await infer(args);throw Object.assign(Error('Controlled stop after closed provider, before entry checkpoint'),{code:'TIMEOUT'});};
  const result=await s.engine.run(s.mission.id);assert.notEqual(result.mission.status,'COMPLETED');assert.equal(s.count,1);
  const runId=s.engine.store.get('closed-entry',s.mission.id).data.runId;
  assert.equal(s.engine.store.get('closed-entry-cleanup',runId).data.status,'CLOSED');
  return {...s,get engine(){return s.engine;},get count(){return s.count;},runId};
}
const durableOutcome=(engine,outcome)=>engine.store.get('artifact',outcome.id).data;
for(const encoding of ['plain-json','lossless-v1','lossless-json-v2','source-text-v1'])
test('closed entry response preserves exact public value and read-only proof with '+encoding,async t=>{
  const s=await stopped(t,CLOSED_ENTRY_V2,{contextEncoding:encoding}),before=s.engine.store.verifyJournal(),r=readClosedEntryResponse(s.engine.registry,s.runId);
  assert.equal(r.value.body,'(12 + 7 + 5) / 3 = 8.');assert.deepEqual(s.engine.store.verifyJournal(),before);assert.equal(s.engine.store.list('artifact').length,0);
  s.reopen();const result=await s.engine.run(s.mission.id);assert.equal(result.mission.status,'COMPLETED',JSON.stringify(result.mission.pending));
  assert.equal(result.outcome.payload.producerRunId,undefined,'The public delivery does not expose its worker identity');
  assert.equal(durableOutcome(s.engine,result.outcome).payload.producerRunId,s.runId);assert.equal(s.count,2);assert.equal(s.engine.store.list('effect').length,0);
});
const revise=(s,type,id,change)=>{const r=s.engine.store.get(type,id);change(r.data);s.engine.store.put(type,id,r.data,{expectedVersion:r.version});};
for(const [name,change]of [
  ['public response with recomputed hash',s=>revise(s,'closed-entry-response',s.runId,d=>{d.value.body='Changed';d.valueHash=sha256(d.value);})],
  ['same response re-versioned',s=>revise(s,'closed-entry-response',s.runId,()=>{})],
  ['worker prefix with recomputed hash',s=>revise(s,'worker-config',s.runId,d=>{d.instructions+=' Changed';d.prefixHash=sha256(d.instructions);})],
  ['request record',s=>{const r=s.engine.store.list('inference-request')[0];revise(s,r.type,r.id,d=>{d.requestJson+=' ';});}],
  ['current receipt pointer',s=>revise(s,'run',s.runId,d=>{d.inferenceReceipt.contextHash='0'.repeat(64);})],
  ['current completed exposure',s=>revise(s,'run',s.runId,d=>{d.context.instructionsHash='0'.repeat(64);d.contextHash=sha256(d.context);})],
  ['protocol marker',s=>revise(s,'closed-entry',s.mission.id,d=>{delete d.responseRetention;})],
  ['cleanup confirmation re-versioned',s=>revise(s,'closed-entry-cleanup',s.runId,()=>{})],
  ['cleanup points at another request',s=>revise(s,'closed-entry-cleanup',s.runId,d=>{d.requestHash='0'.repeat(64);})],
])test('closed entry response refuses changed '+name+' before a new model or artifact',async t=>{
  const s=await stopped(t);change(s);assert.throws(()=>readClosedEntryResponse(s.engine.registry,s.runId),{code:'ENTRY_RESPONSE_INTEGRITY'});
  assert.equal(s.count,1);assert.equal(s.engine.store.list('artifact').length,0);
});
test('closed entry response blocks missing cleanup after an otherwise committed answer',async t=>{
  const s=fixture(t,CLOSED_ENTRY_V2),put=s.engine.store.put.bind(s.engine.store);
  s.engine.store.put=(type,...args)=>{if(type==='closed-entry-cleanup')throw Object.assign(Error('Controlled closure-write failure'),{code:'STORAGE_CORRUPTION'});return put(type,...args);};
  await s.engine.run(s.mission.id);const runId=s.engine.store.get('closed-entry',s.mission.id).data.runId;
  assert.ok(s.engine.store.get('closed-entry-response',runId));assert.equal(s.engine.store.get('closed-entry-cleanup',runId),null);
  s.reopen();const result=await s.engine.run(s.mission.id);assert.equal(result.mission.pending[0].code,'CLEANUP_UNCONFIRMED');assert.equal(s.count,1);
});
test('legacy closed entry is not retrospectively labelled with durable response proof',async t=>{
  const s=fixture(t,CLOSED_ENTRY_MODE),put=s.engine.store.put.bind(s.engine.store);
  s.engine.store.put=(type,id,data,options)=>{if(type==='closed-entry'&&options.expectedVersion===0){data={...data};delete data.responseRetention;}return put(type,id,data,options);};
  const result=await s.engine.run(s.mission.id);assert.equal(result.mission.status,'COMPLETED');assert.equal(s.count,2);
  assert.equal(s.engine.store.list('closed-entry-response').length,0);assert.equal(s.engine.store.list('closed-entry-cleanup').length,0);
  assert.equal(readClosedEntryResponse(s.engine.registry,durableOutcome(s.engine,result.outcome).payload.producerRunId),null);
});
for(const mode of [CLOSED_ENTRY_MODE,CLOSED_ENTRY_V2])for(const boundary of [
  'before-response-commit','after-response-commit','before-cleanup-commit','after-cleanup-commit','before-candidate-commit','after-candidate-commit'])
test('closed entry response REAL SIGKILL '+mode+' / '+boundary,async t=>{
  const directory=fs.mkdtempSync(join(tmpdir(),'closed-entry-real-crash-'));t.after(()=>fs.rmSync(directory,{recursive:true,force:true}));
  const child=spawnSync(process.execPath,['tests/factory/fixtures/closed-entry-response-process.mjs',directory,mode,boundary],{encoding:'utf8',timeout:15000,maxBuffer:1024*1024});
  assert.equal(child.error,undefined);assert.equal(child.status,null,child.stderr);assert.equal(child.signal,'SIGKILL',child.stderr);
  const saved=JSON.parse(fs.readFileSync(join(directory,'fixture.json')));assert.equal(saved.owner.pid,child.pid);
  assert.equal(ownerProcessIsAlive({pid:child.pid,processIdentity:saved.owner}),false);
  const engine=new FactoryEngine({databasePath:join(directory,'state.sqlite'),workspaceRoot:join(directory,'workspace')});let calls=0;
  try{
    const entry=engine.store.get('closed-entry',saved.missionId).data,run=engine.workers.run(entry.runId),before=engine.store.list('artifact');engine.store.verifyJournal();
    assert.equal(missionInferenceBudget(engine.registry,saved.missionId).reserved,1);
    assert.equal(engine.store.list('closed-entry-response').length,boundary==='before-response-commit'?0:1);
    if(boundary==='before-response-commit'){assert.equal(run.inferenceReceipt,undefined);assert.ok(run.expectedRequestHash);}
    else assert.equal(run.inferenceReceipt.simulation,true);
    engine.broker.execute=async()=>assert.fail('No tool in closed recovery');
    engine.workers.providerFactory=()=>({async generate(request){
      calls++;assert.equal(calls,1);assert.ok(request.schema.properties.artifactHash,'Only the independent reviewer may infer after recoverable cut');
      const context=readSourceContextView(request.input),task=JSON.parse(context.task),a=context.artifacts.find(a=>a.id===task.candidateId);
      assert.equal(a.payload.producerRunId,entry.runId);assert.equal(a.payload.body,'(12 + 7 + 5) / 3 = 8.');
      const value={artifactHash:a.hash,purpose:a.payload.purpose,decision:'ACCEPT',checks:task.criteria.map(c=>({criterionId:c.id,verdict:'PASS',
        evidence:[{kind:'artifact',id:a.id,hash:a.hash,quote:a.payload.body}],reason:'Explicit simulated independent check after real process death'})),findings:[],uncertainty:'SIMULATED'};
      await request.validate(value);return {value,receipt:{kind:'inference',status:'completed',simulation:true,threadId:'sim-parent-review',turnId:'sim-parent-review-turn',
        model:request.model,reasoningEffort:request.reasoningEffort,contextHash:inferenceRequestHash(request)}};
    },async close(){}});
    const result=await engine.run(saved.missionId);
    if(['before-response-commit','after-response-commit','before-cleanup-commit'].includes(boundary)){
      assert.equal(result.mission.pending[0].code,'CLEANUP_UNCONFIRMED');assert.equal(calls,0);assert.equal(engine.store.list('artifact').length,0);
      assert.equal(missionInferenceBudget(engine.registry,saved.missionId).reserved,1,'Unknown closure never refunds or buys a substitute');
    }else{
      assert.equal(result.mission.status,'COMPLETED',JSON.stringify(result.mission.pending));assert.equal(calls,1);
      assert.equal(durableOutcome(engine,result.outcome).payload.producerRunId,entry.runId);assert.equal(engine.store.list('run').filter(r=>r.data.mode==='producer').length,1);
      assert.equal(engine.store.list('artifact').length,1);assert.equal(missionInferenceBudget(engine.registry,saved.missionId).reserved,2);
      if(boundary==='after-candidate-commit')assert.equal(result.outcome.id,before[0].id);else assert.equal(before.length,0);
      assert.equal((await engine.run(saved.missionId)).mission.status,'COMPLETED');assert.equal(calls,1);
    }
    engine.store.verifyJournal();
  }finally{engine.close();}
});
for(const mode of [CLOSED_ENTRY_MODE,CLOSED_ENTRY_V2]){
  test(mode+' cannot accept an explicit negative process-exit observation as a successful cleanup',async t=>{
    const s=fixture(t,mode),factory=s.engine.workers.providerFactory;
    s.engine.workers.providerFactory=()=>({...factory(),async close(){return {processExitObserved:false};}});
    const result=await s.engine.run(s.mission.id);assert.equal(result.mission.status,'WAITING_CAPABILITY');
    assert.equal(result.mission.pending[0].code,'CLEANUP_UNCONFIRMED');assert.equal(s.count,1);
    const runId=s.engine.store.get('closed-entry',s.mission.id).data.runId;
    assert.equal(s.engine.store.get('closed-entry-cleanup',runId).data.status,'UNCONFIRMED');
    assert.equal(s.engine.store.get('closed-entry-cleanup',runId).data.processExitObserved,false);
  });
  test(mode+' retains the received entry answer across completion-event failure without buying a replacement',async t=>{
    const s=fixture(t,mode),append=s.engine.store.append.bind(s.engine.store);let cut=true;
    s.engine.store.append=(kind,data)=>{if(cut&&kind==='worker.inference.completed'){cut=false;throw Object.assign(Error('Controlled completion-event outage'),{code:'TIMEOUT'});}return append(kind,data);};
    const first=await s.engine.run(s.mission.id);assert.notEqual(first.mission.status,'COMPLETED');assert.equal(s.count,1);
    const before=s.engine.store.get('closed-entry',s.mission.id).data,originalRun=before.runId;
    s.reopen();const final=await s.engine.run(s.mission.id);
    assert.equal(final.mission.status,'COMPLETED',JSON.stringify(final.mission.pending));assert.equal(s.count,2);
    assert.equal(s.engine.store.get('closed-entry',s.mission.id).data.runId,originalRun);
    assert.equal(final.outcome.payload.body,'(12 + 7 + 5) / 3 = 8.');assert.equal(final.plan,null);
  });
  test(mode+' keeps a durable public answer when the later entry checkpoint cannot be written',async t=>{
    const s=fixture(t,mode),put=s.engine.store.put.bind(s.engine.store);let fail=true;
    s.engine.store.put=(type,id,data,options)=>{if(fail&&type==='closed-entry'&&data.response){fail=false;throw Object.assign(Error('Controlled checkpoint failure'),{code:'STORAGE_CORRUPTION'});}return put(type,id,data,options);};
    const first=await s.engine.run(s.mission.id);assert.notEqual(first.mission.status,'COMPLETED');assert.equal(s.count,1);
    const original=s.engine.store.get('closed-entry',s.mission.id).data.runId;
    s.reopen();const final=await s.engine.run(s.mission.id);assert.equal(final.mission.status,'COMPLETED',JSON.stringify(final.mission.pending));
    assert.equal(s.count,2);assert.equal(durableOutcome(s.engine,final.outcome).payload.producerRunId,original);
  });
  test(mode+' cannot bypass unconfirmed provider cleanup by resuming the retained entry answer',async t=>{
    const s=fixture(t,mode),factory=s.engine.workers.providerFactory;
    s.engine.workers.providerFactory=()=>{const provider=factory();provider.close=async()=>{throw Object.assign(Error('Controlled missing close confirmation'),{code:'TIMEOUT'});};return provider;};
    const first=await s.engine.run(s.mission.id);assert.equal(first.mission.pending[0].code,'CLEANUP_UNCONFIRMED');
    assert.equal(s.count,1);s.reopen();const again=await s.engine.run(s.mission.id);
    assert.equal(again.mission.pending[0].code,'CLEANUP_UNCONFIRMED');assert.equal(s.count,1);assert.equal(s.engine.store.list('artifact').length,0);
  });
}
