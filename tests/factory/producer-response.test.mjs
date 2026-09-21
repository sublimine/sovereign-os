import test from 'node:test';import assert from 'node:assert/strict';
import fs from 'node:fs';import {join} from 'node:path';import {tmpdir} from 'node:os';
import {spawnSync} from 'node:child_process';
import {FactoryEngine} from '../../factory/lib/engine.mjs';
import {sha256} from '../../factory/lib/contracts.mjs';
import {inferenceRequestHash} from '../../factory/providers/instruction-profiles.mjs';
import {ownerProcessIsAlive} from '../../factory/lib/process-identity.mjs';
import {missionInferenceBudget} from '../../factory/lib/mission-inference-budget.mjs';
import {readSourceContextView} from '../../factory/lib/source-context-view.mjs';
import {missionReport} from '../../factory/lib/report.mjs';
import {readVerifiedProducerProposal} from '../../factory/lib/producer-response.mjs';
const final=(body='Original public fixture',claims=[])=>({action:'final',tool:'',argsJson:'',body,claims,method:'fixture-derivation',reason:''});
const unsupported=()=>final('An unsupported factual assertion',[{id:'claim',text:'An external fact without evidence',kind:'fact',sources:[],basis:[],qualifiers:[],validUntil:null}]);
const tool=()=>({action:'tool',tool:'workspace.read',argsJson:'{"path":"missing.txt"}',body:'',claims:[],method:'inspect-input',reason:''});
function setup(t,{respond=()=>final(),contextEncoding='plain-json',stopAfter=1}={}){
  const directory=fs.mkdtempSync(join(tmpdir(),'producer-response-test-'));
  const engine=new FactoryEngine({databasePath:join(directory,'state.sqlite'),workspaceRoot:join(directory,'workspaces')});
  const mission=engine.create('Preserve the original public response and require independent acceptance.',{allowedTools:['workspace.read'],contextEncoding});
  const node={id:'answer',purpose:'bounded-result',roleIds:['omega_02'],reviewerRoleIds:['omega_03'],instructions:mission.intent,
    outputKind:'delivery',criteria:[{id:'result',text:'Preserve the complete requested result.'}],tools:['workspace.read'],requiredEffects:[]};
  const actor=engine.workers.createRun({missionId:mission.id,nodeId:node.id,mode:'producer',purpose:node.purpose,roleIds:node.roleIds});
  let count=0,closed=0;engine.workers.providerFactory=()=>({async generate(request){count++;const value=await respond({number:count,request});
    assert.equal(await request.validate(value),true);return {value,receipt:{kind:'inference',simulation:true,status:'completed',threadId:'sim-thread-'+count,
      turnId:'sim-turn-'+count,model:request.model,reasoningEffort:request.reasoningEffort,contextHash:inferenceRequestHash(request)}};
  },async close(){closed++;}});
  const append=engine.store.append.bind(engine.store);
  engine.store.append=(kind,data)=>{if(kind==='worker.inference.completed'&&data.runId===actor.id&&count===stopAfter)
    throw Object.assign(Error('Controlled interruption before producer consumes its received response'),{code:'TIMEOUT'});return append(kind,data);};
  const args={missionId:mission.id,node,runId:actor.id,inputRefs:[]};
  t.after(()=>{engine.close();fs.rmSync(directory,{recursive:true,force:true});});
  return {engine,mission,node,actor,args,directory,get count(){return count;},get closed(){return closed;},
    async stop(){await assert.rejects(engine.workers.produce(args),{code:'TIMEOUT'});},
    read(){return engine.workers.recoverableFinal(args);},recover(){return engine.workers.recoverFinal(args);}};
}
for(const contextEncoding of ['plain-json','lossless-v1','lossless-json-v2','source-text-v1'])
test('producer response: exact final recovery with '+contextEncoding+' remains candidate and is idempotent',async t=>{
  const s=setup(t,{contextEncoding});await s.stop();const before=s.engine.store.verifyJournal(),r=s.read();assert.deepEqual(r.value,final());
  assert.deepEqual(s.engine.store.verifyJournal(),before,'Reading a recoverable response does not mutate it');
  const a=s.recover();assert.equal(a.status,'CANDIDATE');assert.equal(a.payload.body,final().body);assert.equal(a.payload.producerRunId,s.actor.id);
  assert.equal(s.engine.store.list('review').length,0);assert.equal(s.engine.store.list('effect').length,0);assert.equal(s.count,1);assert.equal(s.closed,1);
  const after=s.engine.store.verifyJournal();assert.deepEqual(s.recover(),a);assert.deepEqual(s.engine.store.verifyJournal(),after);
});
for(const [name,change]of [
  ['public value',s=>{const p=s.engine.store.list('worker-proposal')[0];p.data.value.body='Changed answer';s.engine.store.put(p.type,p.id,p.data,{expectedVersion:p.version});}],
  ['worker prefix',s=>{const r=s.engine.store.get('worker-config',s.actor.id);r.data.instructions+=' changed';r.data.prefixHash=sha256(r.data.instructions);s.engine.store.put(r.type,r.id,r.data,{expectedVersion:r.version});}],
  ['mission policy',s=>{const r=s.engine.store.get('mission',s.mission.id);r.data.policy.maxNodeAttempts++;s.engine.store.put(r.type,r.id,r.data,{expectedVersion:r.version});}],
  ['retention marker',s=>{const r=s.engine.store.get('worker-production',s.actor.id);delete r.data.responseRetention;s.engine.store.put(r.type,r.id,r.data,{expectedVersion:r.version});}],
  ['invocation contract',s=>{const r=s.engine.store.get('worker-production',s.actor.id);r.data.contractHash='0'.repeat(64);s.engine.store.put(r.type,r.id,r.data,{expectedVersion:r.version});}],
  ['retained request',s=>{const r=s.engine.store.list('inference-request')[0];r.data.requestJson+=' ';s.engine.store.put(r.type,r.id,r.data,{expectedVersion:r.version});}],
  ['latest receipt pointer',s=>{const r=s.engine.store.get('run',s.actor.id);r.data.inferenceReceipt.contextHash='0'.repeat(64);s.engine.store.put(r.type,r.id,r.data,{expectedVersion:r.version});}]
])test('producer response: changed '+name+' fails closed without model or artifact',async t=>{
  const s=setup(t);await s.stop();change(s);assert.throws(()=>s.read(),{code:'PRODUCER_RESPONSE_INTEGRITY'});
  assert.throws(()=>readVerifiedProducerProposal(s.engine.registry,s.actor.id),{code:'PRODUCER_RESPONSE_INTEGRITY'});
  assert.equal(s.count,1);assert.equal(s.engine.store.list('artifact').length,0);
});
test('producer response: caller cannot weaken node criteria or change input contract on recovery',async t=>{
  const s=setup(t);await s.stop();
  for(const args of [{...s.args,node:{...s.node,criteria:[{id:'weak',text:'Return anything.'}]}},{...s.args,inputRefs:[{artifactId:'foreign',hash:'0'.repeat(64),purpose:'other'}]}])
    assert.throws(()=>s.engine.workers.recoverableFinal(args),{code:'PRODUCER_RESPONSE_INTEGRITY'});
  assert.equal(s.engine.store.list('artifact').length,0);
});
test('producer response: a new observation after final requires a new completed exposure, not old-answer reuse',async t=>{
  const s=setup(t);await s.stop();await s.engine.workers.tool(s.actor.id,'workspace.read',{path:'missing.txt'},s.actor.id+':external-after-final');
  assert.throws(()=>s.read(),{code:'PRODUCER_RESPONSE_INTEGRITY'});assert.equal(s.count,1);assert.equal(s.engine.store.list('effect').length,1);
});
test('producer response: unconfirmed provider cleanup is not bypassed by a retained answer',async t=>{
  const s=setup(t);await s.stop();const r=s.engine.store.get('worker-production',s.actor.id);r.data.errorCode='CLEANUP_UNCONFIRMED';
  s.engine.store.put(r.type,r.id,r.data,{expectedVersion:r.version});assert.throws(()=>s.recover(),{code:'CLEANUP_UNCONFIRMED'});
  assert.equal(s.engine.store.list('artifact').length,0);assert.equal(s.count,1);
});
test('producer response: an unapplied tool proposal is retained but never dispatched by final recovery',async t=>{
  const s=setup(t,{respond:tool});await s.stop();assert.equal(s.read(),null);assert.equal(s.engine.store.list('worker-proposal')[0].data.value.action,'tool');
  assert.equal(s.engine.store.list('effect').length,0);assert.equal(s.count,1);
});
for(const contextEncoding of ['plain-json','lossless-v1','lossless-json-v2','source-text-v1'])test('Verified public tool reader preserves the exact request and never dispatches: '+contextEncoding,async t=>{
  const s=setup(t,{respond:tool,contextEncoding});await s.stop();const before=s.engine.store.verifyJournal();
  const value=readVerifiedProducerProposal(s.engine.registry,s.actor.id);
  assert.deepEqual(value.value,tool());assert.deepEqual(value.task.node,s.node);assert.deepEqual(value.task.inputRefs,[]);
  assert.equal(value.documentary,null);assert.equal(value.cleanup.type,'producer-cleanup');assert.equal(value.proposal.type,'worker-proposal');
  value.value.argsJson='tampered caller copy';value.task.node.criteria=[];
  assert.deepEqual(readVerifiedProducerProposal(s.engine.registry,s.actor.id).value,tool());
  assert.deepEqual(s.engine.store.verifyJournal(),before);assert.equal(s.engine.store.list('effect').length,0);assert.equal(s.count,1);
});
test('A historical tool observation does not rewrite the retained proposal task',async t=>{
  const s=setup(t,{respond:tool});await s.stop();const before=readVerifiedProducerProposal(s.engine.registry,s.actor.id);
  await s.engine.workers.tool(s.actor.id,'workspace.read',{path:'missing.txt'},s.actor.id+':completed-observation');
  const journal=s.engine.store.verifyJournal();assert.deepEqual(readVerifiedProducerProposal(s.engine.registry,s.actor.id),before);
  assert.deepEqual(s.engine.store.verifyJournal(),journal);assert.equal(s.count,1);
});
test('producer response: an unsupported final is rejected again on materialization and cannot later resurrect',async t=>{
  const s=setup(t,{respond:unsupported});await s.stop();assert.ok(s.read());assert.throws(()=>s.recover(),{code:'UNSUPPORTED_FACT'});
  assert.equal(s.read(),null);assert.equal(s.engine.store.list('producer-final-disposition').length,1);assert.equal(s.engine.store.list('artifact').length,0);
});
test('producer response: a previously rejected final stays rejected when its correction inference fails',async t=>{
  const s=setup(t,{stopAfter:99,respond:({number})=>{if(number===1)return unsupported();throw Object.assign(Error('Simulated correction transport timeout'),{code:'TIMEOUT'});}});
  await s.stop();assert.equal(s.read(),null);assert.equal(s.count,2);assert.equal(s.engine.store.list('producer-final-disposition').length,1);
});
test('producer response: an actual close failure is classified and cannot be bypassed by recovery',async t=>{
  const s=setup(t,{stopAfter:99}),factory=s.engine.workers.providerFactory;
  s.engine.workers.providerFactory=()=>({...factory(),async close(){throw Error('Explicit simulated cleanup failure');}});
  await assert.rejects(s.engine.workers.produce(s.args),{code:'CLEANUP_UNCONFIRMED'});
  assert.equal(s.engine.store.list('worker-proposal').length,1);assert.throws(()=>s.read(),{code:'CLEANUP_UNCONFIRMED'});
  assert.equal(s.engine.store.list('artifact').length,0);
});
test('producer response: older tool response does not block recovery merely because later pending instructions changed',async t=>{
  const s=setup(t,{stopAfter:99,respond:({number})=>{if(number===1)return tool();throw Object.assign(Error('Explicit simulated next-call timeout'),{code:'TIMEOUT'});}});
  await s.stop();assert.ok(s.engine.workers.run(s.actor.id).expectedRequestHash);assert.equal(s.read(),null);
  assert.equal(s.engine.store.list('effect').length,1);assert.equal(s.count,2);
  assert.throws(()=>readVerifiedProducerProposal(s.engine.registry,s.actor.id),{code:'PRODUCER_RESPONSE_INTEGRITY'});
});
test('producer response: legacy receipt-only production is not retroactively given a response',async t=>{
  const s=setup(t,{stopAfter:99});s.engine.store.put('worker-production',s.actor.id,{status:'running',step:0},{expectedVersion:0});
  await s.engine.workers.infer({runId:s.actor.id,instructions:'Explicit legacy inference fixture.',input:'{}',schema:{type:'object'},validate:()=>true});
  assert.ok(s.engine.workers.run(s.actor.id).inferenceReceipt);assert.equal(s.read(),null);assert.equal(s.engine.store.list('worker-proposal').length,0);
});
test('producer response: a changed rejected-final disposition fails closed',async t=>{
  const s=setup(t,{respond:unsupported});await s.stop();assert.throws(()=>s.recover(),{code:'UNSUPPORTED_FACT'});
  const d=s.engine.store.list('producer-final-disposition')[0];d.data.code='REWRITTEN';s.engine.store.put(d.type,d.id,d.data,{expectedVersion:d.version});
  assert.throws(()=>s.read(),{code:'PRODUCER_RESPONSE_INTEGRITY'});
});
test('producer response: REAL full-engine SIGKILL AFTER cleanup resumes the same producer and spends only the independent review',async t=>{
  const directory=fs.mkdtempSync(join(tmpdir(),'producer-engine-crash-'));t.after(()=>fs.rmSync(directory,{recursive:true,force:true}));
  const child=spawnSync(process.execPath,['tests/factory/fixtures/producer-engine-process.mjs',directory],{encoding:'utf8',timeout:15000,maxBuffer:1024*1024});
  assert.equal(child.error,undefined);assert.equal(child.status,null,child.stderr);assert.equal(child.signal,'SIGKILL',child.stderr);
  const saved=JSON.parse(fs.readFileSync(join(directory,'fixture.json')));
  assert.equal(saved.owner.pid,child.pid);assert.equal(ownerProcessIsAlive({pid:child.pid,processIdentity:saved.owner}),false);
  const engine=new FactoryEngine({databasePath:join(directory,'state.sqlite'),workspaceRoot:join(directory,'workspaces')});let calls=0;
  try{
    const original=engine.store.list('run').find(r=>r.data.nodeId==='deliver');assert.equal(missionInferenceBudget(engine.registry,saved.missionId).reserved,3);
    engine.workers.providerFactory=()=>({async generate(request){
      calls++;assert.equal(calls,1);assert.ok(request.schema.properties.artifactHash,'Only final independent review may infer');
      const e=readSourceContextView(request.input),task=JSON.parse(e.task),a=e.artifacts.find(a=>a.id===task.candidateId);
      assert.equal(a.payload.nodeId,'deliver');assert.equal(a.payload.body,'Original full-engine response');assert.equal(a.payload.producerRunId,original.id);
      const value={artifactHash:a.hash,purpose:a.payload.purpose,decision:'ACCEPT',checks:task.criteria.map(c=>({criterionId:c.id,verdict:'PASS',
        evidence:[{kind:'artifact',id:a.id,hash:a.hash,quote:a.payload.body}],reason:'Explicitly simulated reviewer after actual process recovery'})),findings:[],uncertainty:'Simulated model'};
      await request.validate(value);return {value,receipt:{kind:'inference',simulation:true,status:'completed',threadId:'sim-parent-review',turnId:'sim-parent-review-turn',
        model:request.model,reasoningEffort:request.reasoningEffort,contextHash:inferenceRequestHash(request)}};
    },async close(){}});
    engine.broker.execute=()=>{assert.fail('Pure final recovery has no tool execution');};
    const result=await engine.run(saved.missionId);assert.equal(result.mission.status,'COMPLETED',JSON.stringify(result.mission.pending));
    assert.equal(calls,1);assert.equal(engine.store.list('run').filter(r=>r.data.nodeId==='deliver').length,1);
    assert.equal(missionInferenceBudget(engine.registry,saved.missionId).reserved,4);
    const report=missionReport(engine.store,saved.missionId,{registry:engine.registry});
    assert.equal(report.metrics.integrity,'NOT_ATTESTED');assert.equal(report.metrics.operationalTelemetry,'NOT_PROJECTED');
    assert.deepEqual(report.timeline,[],'The public report cannot turn raw journal rows into a delivery claim');
    assert.equal(engine.store.events({limit:1000}).filter(e=>e.kind==='worker.final.recovered').length,1);
    assert.equal((await engine.run(saved.missionId)).mission.status,'COMPLETED');assert.equal(calls,1);engine.store.verifyJournal();
  }finally{engine.close();}
});
for(const boundary of ['before-response-commit','after-response-commit','before-candidate-commit','after-candidate-commit'])
test('producer response: REAL SIGKILL at '+boundary+' preserves the original transaction outcome',t=>{
  const directory=fs.mkdtempSync(join(tmpdir(),'producer-response-crash-'));
  t.after(()=>fs.rmSync(directory,{recursive:true,force:true}));
  const child=spawnSync(process.execPath,['tests/factory/fixtures/producer-response-process.mjs',directory,boundary],{encoding:'utf8',timeout:15000,maxBuffer:1024*1024});
  assert.equal(child.error,undefined);assert.equal(child.status,null,child.stderr);assert.equal(child.signal,'SIGKILL',child.stderr);
  const saved=JSON.parse(fs.readFileSync(join(directory,'fixture.json')));
  assert.equal(saved.owner.pid,child.pid);assert.equal(ownerProcessIsAlive({pid:child.pid,processIdentity:saved.owner}),false);
  const engine=new FactoryEngine({databasePath:join(directory,'state.sqlite'),workspaceRoot:join(directory,'workspaces')});
  try{
    engine.workers.providerFactory=()=>{assert.fail('Recovery may not call a model');};
    engine.broker.execute=()=>{assert.fail('Final recovery may not execute a tool');};
    engine.store.verifyJournal();const run=engine.workers.run(saved.args.runId);
    assert.equal(missionInferenceBudget(engine.registry,saved.args.missionId).reserved,1,'No refund on process death');
    if(boundary==='before-response-commit'){
      assert.equal(engine.store.list('worker-proposal').length,0);assert.equal(run.inferenceReceipt,undefined);assert.ok(run.expectedRequestHash);
      assert.throws(()=>engine.workers.recoverableFinal(saved.args),{code:'CLEANUP_UNCONFIRMED'},'Missing response and closure are not manufactured from a request');
      assert.equal(engine.store.list('artifact').length,0);
    }else if(boundary==='after-response-commit'){
      assert.equal(engine.store.list('worker-proposal').length,1);assert.equal(run.inferenceReceipt.simulation,true);
      assert.throws(()=>engine.workers.recoverFinal(saved.args),{code:'CLEANUP_UNCONFIRMED'},'Retained response does not establish provider closure');
      assert.equal(engine.store.list('artifact').length,0);assert.equal(engine.store.list('producer-cleanup').length,0);
    }else{
      assert.equal(engine.store.list('worker-proposal').length,1);assert.equal(run.inferenceReceipt.simulation,true);
      const before=engine.store.list('artifact');assert.equal(before.length,boundary==='after-candidate-commit'?1:0);
      const artifact=engine.workers.recoverFinal(saved.args);assert.equal(artifact.payload.body,saved.value.body);assert.equal(artifact.status,'CANDIDATE');
      if(before.length)assert.equal(artifact.id,before[0].id);
      assert.equal(engine.store.list('artifact').length,1);assert.equal(engine.store.list('review').length,0);
      assert.equal(engine.store.list('effect').length,0);assert.equal(missionInferenceBudget(engine.registry,saved.args.missionId).reserved,1);
    }
    engine.store.verifyJournal();
  }finally{engine.close();}
});
