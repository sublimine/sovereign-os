import fs from 'node:fs';import {join} from 'node:path';import {tmpdir} from 'node:os';import {spawnSync} from 'node:child_process';
import test from 'node:test';import assert from 'node:assert/strict';
import {FactoryEngine} from '../../factory/lib/engine.mjs';import {sha256} from '../../factory/lib/contracts.mjs';
import {inferenceRequestHash} from '../../factory/providers/instruction-profiles.mjs';
import {assertProducerProviderClosed} from '../../factory/lib/producer-response.mjs';
import {missionInferenceBudget} from '../../factory/lib/mission-inference-budget.mjs';
const value={action:'final',tool:'',argsJson:'',body:'Exact controlled final',claims:[],method:'fixture',reason:''};
const tool={action:'tool',tool:'workspace.write',argsJson:JSON.stringify({path:'blocked.txt',content:'not permitted before closure',expectedHash:null}),body:'',claims:[],method:'fixture-write',reason:''};
function setup(t,{first=value,closeResult={processExitObserved:true},generationError=null,closeError=null,stop=true,mutateCleanup=null,cleanupEventError=null}={}){
  const directory=fs.mkdtempSync(join(tmpdir(),'producer-cleanup-')),engine=new FactoryEngine({databasePath:join(directory,'state.sqlite'),workspaceRoot:join(directory,'workspaces')});
  const mission=engine.create('Preserve the exact answer and require confirmed producer closure.',{allowedTools:['workspace.write'],inferenceBudget:{mode:'mission-calls-v1',maxCalls:2}});
  const node={id:'answer',purpose:'result',roleIds:['omega_02'],reviewerRoleIds:['omega_03'],instructions:mission.intent,outputKind:'delivery',
    criteria:[{id:'result',text:mission.intent}],tools:['workspace.write'],requiredEffects:[]};
  const run=engine.workers.createRun({missionId:mission.id,nodeId:node.id,mode:'producer',purpose:node.purpose,roleIds:node.roleIds});let calls=0,closes=0;
  engine.workers.providerFactory=()=>({async generate(request){calls++;if(generationError)throw generationError;const v=calls===1?first:value;
    await request.validate(v);return {value:v,receipt:{kind:'inference',status:'completed',simulation:true,threadId:'sim:'+calls,turnId:'sim:'+calls,
      model:request.model,reasoningEffort:request.reasoningEffort,contextHash:inferenceRequestHash(request)}};},async close(){closes++;if(closeError)throw closeError;return closeResult;}});
  const append=engine.store.append.bind(engine.store);engine.store.append=(kind,data)=>{
    if(cleanupEventError&&kind==='worker.producer.cleanup.recorded')throw cleanupEventError;
    if(stop&&kind==='worker.inference.completed'&&data.runId===run.id)throw Object.assign(Error('Response committed before controlled interruption'),{code:'TIMEOUT'});
    return append(kind,data);
  };
  if(mutateCleanup){const put=engine.store.put.bind(engine.store);engine.store.put=(type,id,data,options)=>put(type,id,type==='producer-cleanup'?mutateCleanup(structuredClone(data)):data,options);}
  t.after(()=>{engine.close();fs.rmSync(directory,{recursive:true,force:true});});
  return {engine,mission,node,run,args:{missionId:mission.id,node,runId:run.id,inputRefs:[]},get calls(){return calls;},get closes(){return closes;}};
}
for(const closeResult of [{processExitObserved:true},undefined])test('Durable adapter closure with process observation '+String(closeResult?.processExitObserved),async t=>{
  // Explicit undefined is distinguished from setup default.
  const s=setup(t,{closeResult:closeResult??{}});await assert.rejects(s.engine.workers.produce(s.args),{code:'TIMEOUT'});
  const before=s.engine.store.verifyJournal(),r=assertProducerProviderClosed(s.engine.registry,s.run.id);
  assert.equal(r.data.status,'CLOSED');assert.equal(r.data.adapterCloseConfirmed,true);assert.equal(r.data.processExitObserved,closeResult?.processExitObserved??null);
  assert.deepEqual(s.engine.store.verifyJournal(),before);assert.equal(s.engine.store.db.prepare('PRAGMA user_version').get().user_version,15);
  const artifact=s.engine.workers.recoverFinal(s.args);assert.equal(artifact.payload.body,value.body);assert.equal(artifact.status,'CANDIDATE');assert.equal(s.calls,1);assert.equal(s.closes,1);
});
for(const confirmed of [true,false])test('Diagnostic event failure preserves actual closure '+String(confirmed),async t=>{
  const s=setup(t,{stop:false,closeResult:{processExitObserved:confirmed},cleanupEventError:Object.assign(Error('Controlled post-proof event failure'),{code:'TIMEOUT'})});
  await assert.rejects(s.engine.workers.produce(s.args),{code:confirmed?'TIMEOUT':'CLEANUP_UNCONFIRMED'});
  assert.equal(s.engine.store.list('producer-cleanup')[0].data.status,confirmed?'CLOSED':'UNCONFIRMED');
  assert.equal(s.engine.store.list('artifact').length,0);assert.equal(s.calls,1);
  if(confirmed){const artifact=s.engine.workers.recoverFinal(s.args);assert.equal(artifact.payload.body,value.body);assert.equal(artifact.status,'CANDIDATE');}
  else assert.throws(()=>s.engine.workers.recoverFinal(s.args),{code:'CLEANUP_UNCONFIRMED'});
  assert.equal(s.calls,1);assert.equal(s.closes,1);s.engine.store.verifyJournal();
});
for(const [name,mutateCleanup]of [
  ['different request reference',d=>({...d,requestRecord:{...d.requestRecord,hash:'0'.repeat(64)}})],
  ['different origin reference',d=>({...d,producerOrigin:{...d.producerOrigin,version:2}})],
  ['different configuration reference',d=>({...d,workerConfiguration:{...d.workerConfiguration,hash:'0'.repeat(64)}})],
  ['invented response absence',d=>({...d,proposalRecord:null})],
  ['borrowed step',d=>({...d,step:d.step+1})],
  ['inconsistent closed status',d=>({...d,adapterCloseConfirmed:false})],
  ['string instead of process observation',d=>({...d,processExitObserved:'true'})]
])test('A first-version well-journaled but invalid cleanup cannot authorize '+name,async t=>{
  const s=setup(t,{mutateCleanup});await assert.rejects(s.engine.workers.produce(s.args),{code:'TIMEOUT'});
  assert.equal(s.engine.store.list('producer-cleanup')[0].version,1);s.engine.store.verifyJournal();
  assert.throws(()=>assertProducerProviderClosed(s.engine.registry,s.run.id),{code:'PRODUCER_RESPONSE_INTEGRITY'});
  assert.equal(s.engine.store.list('artifact').length,0);assert.equal(s.calls,1);
});
for(const boundary of ['before-cleanup-commit','after-cleanup-commit'])test('REAL SIGKILL at '+boundary+' preserves closure transaction outcome',t=>{
  const directory=fs.mkdtempSync(join(tmpdir(),'producer-cleanup-commit-'));t.after(()=>fs.rmSync(directory,{recursive:true,force:true}));
  const child=spawnSync(process.execPath,['tests/factory/fixtures/producer-response-process.mjs',directory,boundary],{encoding:'utf8',timeout:15000,maxBuffer:1024*1024});
  assert.equal(child.error,undefined);assert.equal(child.status,null);assert.equal(child.signal,'SIGKILL',child.stderr);
  const saved=JSON.parse(fs.readFileSync(join(directory,'fixture.json'))),engine=new FactoryEngine({databasePath:join(directory,'state.sqlite'),workspaceRoot:join(directory,'workspaces')});
  try{
    engine.workers.providerFactory=()=>assert.fail('Recovery may not purchase a replacement');engine.broker.execute=()=>assert.fail('No recovery effects');
    const before=missionInferenceBudget(engine.registry,saved.args.missionId),proposal=engine.store.list('worker-proposal')[0];
    assert.deepEqual(proposal.data.value,saved.value);assert.equal(engine.store.list('artifact').length,0);assert.equal(before.reserved,1);
    if(boundary==='before-cleanup-commit'){
      assert.equal(engine.store.list('producer-cleanup').length,0);
      assert.throws(()=>engine.workers.recoverFinal(saved.args),{code:'CLEANUP_UNCONFIRMED'});
    }else{
      assert.equal(assertProducerProviderClosed(engine.registry,saved.args.runId).data.status,'CLOSED');
      const artifact=engine.workers.recoverFinal(saved.args);assert.equal(artifact.status,'CANDIDATE');assert.equal(artifact.payload.body,saved.value.body);
      assert.equal(engine.workers.recoverFinal(saved.args).id,artifact.id);
    }
    assert.deepEqual(missionInferenceBudget(engine.registry,saved.args.missionId),before);engine.store.verifyJournal();
  }finally{engine.close();}
});
for(const code of ['QUOTA','AUTH','CANCELLED','TRANSIENT_PROVIDER'])test('Producer '+code+' records confirmed closure but no answer or refunded reservation',async t=>{
  const s=setup(t,{generationError:Object.assign(Error('Controlled provider boundary'),{code})});
  await assert.rejects(s.engine.workers.produce(s.args),{code});
  assert.equal(assertProducerProviderClosed(s.engine.registry,s.run.id).data.proposalRecord,null);
  assert.equal(s.engine.store.list('worker-proposal').length,0);assert.equal(s.engine.store.list('artifact').length,0);
  assert.equal(missionInferenceBudget(s.engine.registry,s.mission.id).reserved,1);assert.equal(s.calls,1);assert.equal(s.closes,1);
});
for(const first of [value,tool])test('Explicit false exit prevents '+first.action+' consumption/effects',async t=>{
  const s=setup(t,{first,stop:false,closeResult:{processExitObserved:false}});await assert.rejects(s.engine.workers.produce(s.args),{code:'CLEANUP_UNCONFIRMED'});
  const r=s.engine.store.list('producer-cleanup')[0];assert.equal(r.data.status,'UNCONFIRMED');assert.equal(r.data.adapterCloseConfirmed,true);assert.equal(r.data.processExitObserved,false);
  assert.equal(s.calls,1);assert.equal(s.engine.store.list('effect').length,0);assert.equal(s.engine.store.list('artifact').length,0);
  assert.throws(()=>s.engine.workers.recoverableFinal(s.args),{code:'CLEANUP_UNCONFIRMED'});
  await assert.rejects(s.engine.workers.tool(s.run.id,'workspace.write',{path:'blocked.txt',content:'x',expectedHash:null},s.run.id+':bypass'),{code:'CLEANUP_UNCONFIRMED'});
});
test('Thrown close failure is stored distinctly from explicit negative process observation',async t=>{
  const s=setup(t,{stop:false,closeError:Error('Controlled close failure')});await assert.rejects(s.engine.workers.produce(s.args),{code:'CLEANUP_UNCONFIRMED'});
  const r=s.engine.store.list('producer-cleanup')[0];assert.equal(r.data.adapterCloseConfirmed,false);assert.equal(r.data.processExitObserved,null);assert.equal(r.data.status,'UNCONFIRMED');
});
test('Failed generation with confirmed cleanup does not invent a public answer',async t=>{
  const s=setup(t,{generationError:Object.assign(Error('Controlled generation timeout'),{code:'TIMEOUT'})});await assert.rejects(s.engine.workers.produce(s.args),{code:'TIMEOUT'});
  const r=assertProducerProviderClosed(s.engine.registry,s.run.id);assert.equal(r.data.status,'CLOSED');assert.equal(r.data.proposalRecord,null);
  assert.equal(s.engine.workers.recoverableFinal(s.args),null);assert.equal(s.engine.store.list('worker-proposal').length,0);assert.equal(s.calls,1);
});
test('Cleanup persistence failure cannot consume a received answer',async t=>{
  const s=setup(t,{stop:false}),put=s.engine.store.put.bind(s.engine.store);
  s.engine.store.put=(type,...args)=>{if(type==='producer-cleanup')throw Error('Controlled cleanup persistence failure');return put(type,...args);};
  await assert.rejects(s.engine.workers.produce(s.args),{code:'CLEANUP_UNCONFIRMED'});assert.equal(s.engine.store.list('worker-proposal').length,1);
  assert.equal(s.engine.store.list('producer-cleanup').length,0);assert.equal(s.engine.store.list('artifact').length,0);
  assert.throws(()=>s.engine.workers.recoverableFinal(s.args),{code:'CLEANUP_UNCONFIRMED'});
});
for(const [name,mutate]of [
  ['cleanup version',s=>{const r=s.engine.store.list('producer-cleanup')[0];s.engine.store.put(r.type,r.id,r.data,{expectedVersion:r.version});}],
  ['cleanup marker',s=>{const r=s.engine.store.get('worker-production',s.run.id);delete r.data.cleanupProtocol;s.engine.store.put(r.type,r.id,r.data,{expectedVersion:r.version});}],
  ['configuration',s=>{const r=s.engine.store.get('worker-config',s.run.id);r.data.instructions+=' modified';r.data.prefixHash=sha256(r.data.instructions);s.engine.store.put(r.type,r.id,r.data,{expectedVersion:r.version});}]
])test('Changed '+name+' cannot authorize recovery',async t=>{
  const s=setup(t);await assert.rejects(s.engine.workers.produce(s.args),{code:'TIMEOUT'});mutate(s);
  assert.throws(()=>s.engine.workers.recoverableFinal(s.args),{code:'PRODUCER_RESPONSE_INTEGRITY'});assert.equal(s.engine.store.list('artifact').length,0);
});
test('Unknown closure cannot be bypassed by inheritance into a fresh producer',async t=>{
  const s=setup(t,{closeResult:{processExitObserved:false}});await assert.rejects(s.engine.workers.produce(s.args),{code:'CLEANUP_UNCONFIRMED'});
  const next=s.engine.workers.createRun({missionId:s.mission.id,nodeId:s.node.id,mode:'producer',purpose:s.node.purpose,roleIds:s.node.roleIds});
  assert.throws(()=>s.engine.workers.inheritProductionObservations(s.run.id,next.id),{code:'CLEANUP_UNCONFIRMED'});assert.equal(s.calls,1);
});
test('Protocol marker and floor commit together or both roll back before dispatch',async t=>{
  const s=setup(t),put=s.engine.store.put.bind(s.engine.store),before=s.engine.store.verifyJournal();
  s.engine.store.put=(type,...args)=>{const r=put(type,...args);if(type==='worker-production')throw Error('Controlled origin write interruption');return r;};
  await assert.rejects(s.engine.workers.produce(s.args),/Controlled origin/);assert.equal(s.calls,0);
  assert.equal(s.engine.store.get('worker-production',s.run.id),null);assert.equal(s.engine.store.db.prepare('PRAGMA user_version').get().user_version,15);
  assert.deepEqual(s.engine.store.verifyJournal(),before);
});
test('REAL full-engine SIGKILL before closure blocks replacement, effects and new reservations',async t=>{
  const directory=fs.mkdtempSync(join(tmpdir(),'producer-cleanup-engine-'));t.after(()=>fs.rmSync(directory,{recursive:true,force:true}));
  const child=spawnSync(process.execPath,['tests/factory/fixtures/producer-engine-process.mjs',directory,'after-response-commit'],{encoding:'utf8',timeout:15000,maxBuffer:1024*1024});
  assert.equal(child.error,undefined);assert.equal(child.status,null);assert.equal(child.signal,'SIGKILL');
  const saved=JSON.parse(fs.readFileSync(join(directory,'fixture.json'))),engine=new FactoryEngine({databasePath:join(directory,'state.sqlite'),workspaceRoot:join(directory,'workspaces')});
  try{const runCount=engine.store.list('run').length,budget=missionInferenceBudget(engine.registry,saved.missionId);assert.equal(budget.reserved,3);
    engine.workers.providerFactory=()=>assert.fail('No replacement inference');engine.broker.execute=()=>assert.fail('No new effect');
    const result=await engine.run(saved.missionId);assert.equal(result.mission.status,'WAITING_CAPABILITY');assert.equal(result.mission.pending[0].code,'CLEANUP_UNCONFIRMED');
    assert.equal(engine.store.list('run').length,runCount);assert.deepEqual(missionInferenceBudget(engine.registry,saved.missionId),budget);
    assert.equal(engine.store.list('artifact').filter(r=>r.data.payload.nodeId==='deliver').length,0);
    assert.equal(engine.store.list('worker-proposal').length,1);engine.store.verifyJournal();
  }finally{engine.close();}
});
