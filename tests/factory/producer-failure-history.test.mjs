// Real SIGKILL / SQLite WAL recovery and file effects; replacement inference
// is explicitly SIMULATED. No live subscription, network, ordinary mission.
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {FactoryEngine} from '../../factory/lib/engine.mjs';
import {inferenceRequestHash} from '../../factory/providers/instruction-profiles.mjs';
import {readSourceContextView} from '../../factory/lib/source-context-view.mjs';

for(const mode of ['receipt-only','observed','repaired'])test(`REAL SIGKILL ${mode}: failure/progress persists into a replacement producer`,async t=>{
  const directory=mkdtempSync(join(tmpdir(),'producer-failure-crash-'));let engine=null;
  t.after(()=>{engine?.close();rmSync(directory,{recursive:true,force:true});});
  const child=spawnSync(process.execPath,[new URL('./fixtures/producer-failure-process.mjs',import.meta.url).pathname,directory,mode],
    {encoding:'utf8',timeout:15000,killSignal:'SIGKILL'});
  assert.equal(child.error,undefined,child.stderr);assert.equal(child.status,null,child.stderr);assert.equal(child.signal,'SIGKILL',child.stderr);
  engine=new FactoryEngine({databasePath:join(directory,'state.sqlite'),workspaceRoot:join(directory,'workspace')});
  const mission=engine.store.list('mission')[0].data,prior=engine.store.list('run')[0].data;
  const effectsBefore=engine.store.list('effect').map(r=>({id:r.id,hash:r.hash}));
  assert.equal(effectsBefore.length,mode==='repaired'?2:1);
  assert.equal((prior.toolObservations??[]).length,mode==='receipt-only'?0:mode==='repaired'?2:1);
  assert.equal(engine.store.list('inference-request').length,0,'Preparation never used a model');
  const node={id:'result',purpose:'file-delivery',roleIds:['omega_02'],reviewerRoleIds:['omega_03'],
    instructions:mission.intent,outputKind:'delivery',criteria:[{id:'file',text:mission.intent}],
    tools:['workspace.read','workspace.write'],requiredEffects:[{type:'file',path:'result.txt',command:'',expectedExit:null}]};
  const replacement=engine.workers.createRun({missionId:mission.id,nodeId:node.id,mode:'producer',purpose:node.purpose,roleIds:node.roleIds});
  const inherited=engine.workers.inheritProductionObservations(prior.id,replacement.id);
  assert.equal(inherited.operationIds.length,effectsBefore.length,'A closed receipt before observation is recovered from its real effect');
  let calls=0;engine.workers.maxSteps=2;
  engine.workers.providerFactory=()=>({async generate(request){
    const exposure=readSourceContextView(request.input);assert.equal(exposure.missionIntent,mission.intent);
    assert.match(request.instructions,/Failed exact requests remain in admitted history/);
    assert.equal(exposure.toolObservations.filter(o=>o.relation==='EXTERNAL_OBSERVATION').length,effectsBefore.length);
    const index=++calls,value=index===1?{action:'tool',tool:'workspace.read',argsJson:JSON.stringify({path:'result.txt'}),
      body:'',claims:[],method:'inspect-after-recovery',reason:'Use observed history, not a renamed retry.'}
      :{action:'final',tool:'',argsJson:'',body:'Observed verified result in result.txt.',claims:[],method:'deliver-observed',reason:''};
    assert.equal(await request.validate(value),true);
    return {value,receipt:{kind:'inference',simulation:true,status:'completed',threadId:'fixture:'+mode+':'+index,turnId:'fixture',
      model:request.model,reasoningEffort:request.reasoningEffort,contextHash:inferenceRequestHash(request)}};
  },async close(){}});
  const work=()=>engine.workers.produce({missionId:mission.id,node,runId:replacement.id});
  if(mode==='repaired'){
    const candidate=await work();assert.equal(candidate.status,'CANDIDATE');assert.equal(calls,2);
    assert.equal(engine.store.list('effect').length,3);assert.equal(engine.store.list('effect').filter(r=>r.data.tool==='workspace.write').length,1);
    const root=engine.broker.workspace(mission.id);assert.equal(readFileSync(join(root,'result.txt'),'utf8'),'verified result');
    const progress=engine.store.events({limit:1000}).filter(e=>e.kind==='worker.failure.progress-observed');
    assert.equal(progress.length,1);assert.ok(progress[0].data.progressSequence>progress[0].data.failedSequence);
  }else{
    await assert.rejects(work(),{code:'WORKER_REPEATED_FAILURE'});assert.equal(calls,1);
    assert.equal(engine.store.list('effect').length,1,'No replay across the real process crash');assert.equal(engine.store.list('artifact').length,0);
  }
  for(const old of effectsBefore)assert.equal(engine.store.get('effect',old.id).hash,old.hash,'Historical result remains unchanged');
  assert.equal(engine.store.list('review').length,0,'No simulated producer is a judge');assert.ok(engine.store.verifyJournal().events>0);
});
