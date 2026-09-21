// Real SQLite reopen, broker file effects, workers, registry and engine.
// Model inference is explicitly simulated; faults interrupt exact API boundaries.
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {Store} from '../../factory/lib/store.mjs';
import {Authority} from '../../factory/lib/authority.mjs';
import {ArtifactRegistry} from '../../factory/lib/artifacts.mjs';
import {ToolBroker} from '../../factory/tools/broker.mjs';
import {WorkerService} from '../../factory/lib/workers.mjs';
import {FactoryEngine} from '../../factory/lib/engine.mjs';
import {sha256} from '../../factory/lib/contracts.mjs';

function setup(t) {
  const root=mkdtempSync(join(tmpdir(),'factory-recovery-peer-')),databasePath=join(root,'state.sqlite'),workspaceRoot=join(root,'jobs');
  let store,engine,broker,registry,calls=0,productions=0,reviews=0;
  const open=()=>{
    store=new Store(databasePath);const authority=new Authority(store);registry=new ArtifactRegistry(store,authority);broker=new ToolBroker({store,authority,workspaceRoot});
    const providerFactory=()=>({async generate(request){
      const exposure=JSON.parse(request.input),task=JSON.parse(exposure.task);let value;
      if(request.schema.properties.requirements) {
        const intent=task.originalRequest;
        value={requirements:[{id:'request',text:intent,requestQuote:intent,criteria:[{id:'file',text:intent}]}],nodes:[{id:'deliver',title:'Deliver',purpose:'delivery',roleIds:['omega_02'],reviewerRoleIds:['omega_03'],requirementIds:['request'],dependencies:[],method:{id:'write-observe',rationale:'Observed file deliverable.',alternatives:['Inspect existing checkpoint.']},instructions:intent,outputKind:'delivery',criteria:[{id:'file',text:intent}],requiredEffects:[{type:'file',path:'result.txt',command:'',expectedExit:null}],tools:['workspace.write','workspace.read'],specialist:null}],finalNodeId:'deliver',routingRationale:'Single concrete file obligation.'};
      } else if(request.schema.properties.artifactHash) {
        reviews++;const a=exposure.artifacts.find(a=>a.id===task.candidateId);
        const evidence=[{kind:'artifact',id:a.id,hash:a.hash,quote:a.payload.body},...exposure.toolObservations.filter(o=>o.tool==='workspace.read'&&o.relation==='OWN_ACTION'&&o.status==='SUCCEEDED').map(o=>({kind:'tool',id:o.id,hash:o.hash,quote:o.quoteText}))];
        value={artifactHash:a.hash,purpose:a.payload.purpose,decision:'ACCEPT',checks:task.criteria.map(c=>({criterionId:c.id,verdict:'PASS',evidence,reason:'Explicit simulated acceptance of exact fixture.'})),findings:[],uncertainty:'Fixture, not live model quality.'};
      } else {
        productions++;
        value=task.step===0?{action:'tool',tool:'workspace.write',argsJson:JSON.stringify({path:'result.txt',content:'durable result',expectedHash:null}),body:'',claims:[],method:'write-once',reason:'Requested scoped file.'}:{action:'final',tool:'',argsJson:'',body:'Durable observed result.',claims:[],method:'report-observed',reason:'Use successful observations.'};
      }
      assert.equal(await request.validate(value),true);const n=++calls;
      return {value,receipt:{simulation:true,status:'completed',threadId:`peer-thread-${n}`,turnId:`peer-turn-${n}`,contextHash:sha256(JSON.stringify({instructions:request.instructions,input:request.input,schema:request.schema,model:request.model,reasoningEffort:request.reasoningEffort}))}};
    },async close(){}});
    const workers=new WorkerService({store,authority,registry,broker,providerFactory});engine=new FactoryEngine({store,authority,registry,broker,workers});
  };open();
  t.after(()=>{engine.close();rmSync(root,{recursive:true,force:true});});
  return {get engine(){return engine;},get store(){return store;},get registry(){return registry;},get calls(){return calls;},get productions(){return productions;},get reviews(){return reviews;},reopen(){engine.close();open();},writes(){return store.list('effect').filter(e=>e.data.tool==='workspace.write');},workspace(missionId){return broker.registerWorkspace(missionId).path;}};
}

test('RPR01: candidate persisted before ledger checkpoint is recovered without re-proposing its durable write',async t=>{
  const s=setup(t),mission=s.engine.create('Create result.txt containing durable result.');
  const transition=s.engine.ledger.transition.bind(s.engine.ledger);let interrupted=false;
  s.engine.ledger.transition=(m,n,change)=>{if(!interrupted&&change.status==='REVIEW_PENDING'){interrupted=true;throw Object.assign(Error('Injected interruption before candidate ledger publication'),{code:'TEST_INTERRUPTION'});}return transition(m,n,change);};
  const first=await s.engine.run(mission.id);assert.equal(first.mission.status,'FAILED');
  const checkpoint=s.store.list('worker-production').find(r=>r.data.status==='candidate');assert.ok(checkpoint?.data.artifactId);
  assert.equal(s.writes().length,1);assert.equal(readFileSync(join(s.workspace(mission.id),'result.txt'),'utf8'),'durable result');
  const produced=s.productions;s.reopen();const resumed=await s.engine.run(mission.id);
  assert.equal(resumed.mission.status,'COMPLETED',JSON.stringify(resumed.mission.pending));
  assert.equal(s.productions,produced,'Durable candidate must not invoke another producer');
  assert.equal(s.writes().length,1,'Already committed write must not be proposed/dispatched under a fresh operation ID');
  assert.equal(resumed.outcome.id,checkpoint.data.artifactId);
});

test('RPR02: accepted artifact before ledger acceptance survives reopen without another model call',async t=>{
  const s=setup(t),mission=s.engine.create('Create result.txt containing durable result.');
  const transition=s.engine.ledger.transition.bind(s.engine.ledger);let interrupted=false;
  s.engine.ledger.transition=(m,n,change)=>{if(!interrupted&&change.status==='ACCEPTED'){interrupted=true;throw Object.assign(Error('Injected interruption after registry acceptance'),{code:'TEST_INTERRUPTION'});}return transition(m,n,change);};
  const first=await s.engine.run(mission.id);assert.equal(first.mission.status,'FAILED');
  const candidate=s.store.list('artifact').find(a=>a.data.payload.nodeId==='deliver').data;
  assert.equal(candidate.status,'ACCEPTED');const calls=s.calls;
  s.reopen();const resumed=await s.engine.run(mission.id);
  assert.equal(resumed.mission.status,'COMPLETED',JSON.stringify(resumed.mission.pending));
  assert.equal(resumed.outcome.id,candidate.id);assert.equal(s.calls,calls);assert.equal(s.writes().length,1);
});

test('RPR03: invalidating the accepted plan revokes completed delivery on reopen',async t=>{
  const s=setup(t),mission=s.engine.create('Create result.txt containing durable result.'),complete=await s.engine.run(mission.id);
  assert.equal(complete.mission.status,'COMPLETED');
  const planId=s.store.get('plan',mission.id).data.acceptedPlanArtifactId;
  const affected=s.registry.invalidate([planId],{reason:'Confirmed mandate omission; existing plan is withdrawn.'});assert.ok(affected.includes(complete.outcome.id));
  const calls=s.calls;s.reopen();const resumed=await s.engine.run(mission.id);
  assert.notEqual(resumed.mission.status,'COMPLETED');assert.equal(resumed.mission.finalArtifactId,null);assert.equal(s.calls,calls);assert.equal(s.writes().length,1);
});
