// SIM provider, real registry/broker/SQLite. No subscription usage.
import test from 'node:test';import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';import {join} from 'node:path';import {tmpdir} from 'node:os';
import {FactoryEngine} from '../../factory/lib/engine.mjs';import {sha256} from '../../factory/lib/contracts.mjs';
import {missionInferenceBudget} from '../../factory/lib/mission-inference-budget.mjs';
import {readSourceContextView} from '../../factory/lib/source-context-view.mjs';
import {inferenceRequestHash} from '../../factory/providers/instruction-profiles.mjs';
async function fixture(t,{maxCalls=1,enabled=true}={}){
  const directory=mkdtempSync(join(tmpdir(),'review-budget-admission-')),
    e=new FactoryEngine({databasePath:join(directory,'state.sqlite'),workspaceRoot:join(directory,'jobs')}),f={e,calls:0};
  t.after(()=>{e.close();rmSync(directory,{recursive:true,force:true});});e.workers.maxReviewRepairs=0;
  f.mission=e.create('Read input.txt as supplied premises and return 13 + 17 = 30 with an independent check.',
    {allowedTools:['workspace.read'],...(enabled?{inferenceBudget:{mode:'mission-calls-v1',maxCalls}}:{})});
  const workspace=e.broker.registerWorkspace(f.mission.id);writeFileSync(join(workspace.path,'input.txt'),'13\n17\n');
  e.workers.nativeProviderFactory=()=>assert.fail('No native provider in ordinary review admission');
  e.workers.providerFactory=()=>({async generate(request){f.calls++;const c=readSourceContextView(request.input),task=JSON.parse(c.task);
    const a=task.candidateId?c.artifacts.find(a=>a.id===task.candidateId):null,
      evidence=a?[{kind:'artifact',id:a.id,hash:a.hash,quote:a.payload.body},...c.toolObservations.filter(o=>o.relation==='OWN_ACTION').map(o=>({kind:'tool',id:o.id,hash:o.hash,quote:o.quoteText}))]:[];
    const value=a?{artifactHash:a.hash,purpose:a.payload.purpose,decision:'ACCEPT',checks:task.criteria.map(x=>({criterionId:x.id,verdict:'PASS',evidence,reason:'SIM fixture only.'})),findings:[],uncertainty:'SIM'}
      :{action:'final',tool:'',argsJson:'',body:'13 + 17 = 30.',claims:[],method:'supplied-sum',reason:''};
    await request.validate(value);return {value,receipt:{kind:'inference',simulation:true,status:'completed',threadId:'sim-review-budget-'+f.calls,
      turnId:'turn',contextHash:inferenceRequestHash(request)}};
  },async close(){return {processExitObserved:true};}});
  const node={id:'sum',purpose:'closed-sum',roleIds:['omega_02'],reviewerRoleIds:['omega_22'],instructions:'Use the supplied numbers, no external factual claim.',
    outputKind:'derivation',criteria:[{id:'sum',text:'Independently verify the requested sum from the supplied input.'}],requiredEffects:[],tools:['workspace.read']},
    producer=e.workers.createRun({missionId:f.mission.id,nodeId:node.id,mode:'producer',purpose:node.purpose,roleIds:node.roleIds});
  await e.workers.tool(producer.id,'workspace.read',{path:'input.txt'},producer.id+':read');
  f.artifact=await e.workers.produce({missionId:f.mission.id,node,runId:producer.id,inputRefs:[]});
  f.review=artifact=>e.workers.review({artifact:artifact??f.artifact,reviewerRoleIds:node.reviewerRoleIds,missionIntent:f.mission.intent});
  // Budgeted worker reservations carry signed dispatch provenance.  Read the
  // accounting through the trusted registry envelope, not a naked Store that
  // cannot verify those signatures.
  f.budget=()=>missionInferenceBudget(e.registry,f.mission.id);return f;
}
test('exhausted review admission creates no reviewer, lease, read or inference request',async t=>{
  const f=await fixture(t),before=f.e.store.verifyJournal(),effects=f.e.store.list('effect'),runs=f.e.store.list('run');
  await assert.rejects(f.review(),{code:'INFERENCE_BUDGET_EXHAUSTED'});
  assert.deepEqual(f.e.store.verifyJournal(),before);assert.deepEqual(f.e.store.list('effect'),effects);assert.deepEqual(f.e.store.list('run'),runs);
  assert.equal(f.calls,1);assert.equal(f.e.store.list('review').length,0);assert.equal(f.budget().reserved,1);
});
for(const enabled of [true,false])test('available '+(enabled?'budget':'legacy unselected policy')+' keeps complete own-read review',async t=>{
  const f=await fixture(t,{maxCalls:2,enabled}),a=await f.review();assert.equal(a.status,'ACCEPTED');assert.equal(f.calls,2);
  assert.equal(f.e.store.list('effect').length,2);assert.equal(f.e.store.list('review').length,1);
  assert.equal(f.budget()?.reserved??null,enabled?2:null);
});
test('corrupt accounting stops before reviewer side effects rather than treating missing heads as capacity',async t=>{
  const f=await fixture(t),r=f.e.store.list('mission-inference-call')[0];f.e.store.db.prepare('DELETE FROM heads WHERE type=? AND id=?').run(r.type,r.id);
  const raw=()=>({records:f.e.store.db.prepare('SELECT type,id,version,hash FROM records ORDER BY type,id,version').all(),
    heads:f.e.store.db.prepare('SELECT type,id,version FROM heads ORDER BY type,id').all(),
    events:f.e.store.events({limit:10000})}),before=raw(),effects=f.e.store.list('effect'),runs=f.e.store.list('run');
  await assert.rejects(f.review(),{code:'INFERENCE_BUDGET_INTEGRITY'});assert.equal(f.calls,1);
  assert.deepEqual(raw(),before);assert.deepEqual(f.e.store.list('effect'),effects);assert.deepEqual(f.e.store.list('run'),runs);
});
test('candidate version integrity is not hidden behind an exhausted-budget message',async t=>{
  const f=await fixture(t),before=f.e.store.verifyJournal();await assert.rejects(f.review({...f.artifact,payloadHash:sha256('other')}),{code:'ARTIFACT_INTEGRITY'});
  assert.deepEqual(f.e.store.verifyJournal(),before);
});
test('positive preflight is not a reservation: late contention still rejects dispatch atomically',async t=>{
  const f=await fixture(t,{maxCalls:2}),execute=f.e.broker.execute.bind(f.e.broker);let consumed=false;
  f.e.broker.execute=async request=>{const result=await execute(request);if(!consumed){consumed=true;
    // Consume the other slot through a complete ordinary WorkerService
    // producer route.  A raw Registry request would be precisely the bypass
    // this test is meant to prove cannot win the contention race.
    const node={id:'other',purpose:'other',roleIds:['omega_02'],reviewerRoleIds:[],instructions:'Return the supplied closed result.',
      outputKind:'derivation',criteria:[],requiredEffects:[],tools:[]},
      run=f.e.workers.createRun({missionId:f.mission.id,nodeId:node.id,mode:'producer',purpose:node.purpose,roleIds:node.roleIds});
    await f.e.workers.produce({missionId:f.mission.id,node,runId:run.id,inputRefs:[]});
  }return result;};
  await assert.rejects(f.review(),{code:'INFERENCE_BUDGET_EXHAUSTED'});assert.ok(consumed);assert.equal(f.calls,2);
  assert.equal(f.budget().reserved,2);assert.equal(f.e.store.list('review').length,0);
});
