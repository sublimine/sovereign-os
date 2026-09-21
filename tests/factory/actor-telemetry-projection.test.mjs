import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {FactoryEngine} from '../../factory/lib/engine.mjs';
import {inferenceRequestHash} from '../../factory/providers/instruction-profiles.mjs';
import {projectMissionActorTelemetry} from '../../factory/lib/actor-telemetry-projection.mjs';
import {formatMissionReport,missionReport} from '../../factory/lib/report.mjs';

const schema={type:'object',properties:{ok:{type:'boolean'}},required:['ok'],additionalProperties:false};

function fixture(t,{receiptPatch={}}={}){
  const root=mkdtempSync(join(tmpdir(),'actor-telemetry-projection-')),
    engine=new FactoryEngine({databasePath:join(root,'state.sqlite'),workspaceRoot:join(root,'workspace')});
  t.after(()=>{engine.close();rmSync(root,{recursive:true,force:true});});
  engine.workers.providerFactory=()=>({
    async generate(request){
      const value={ok:true};
      assert.equal(await request.validate(value),true);
      return {value,receipt:{kind:'inference',status:'completed',simulation:true,
        threadId:'PRIVATE_THREAD_SENTINEL',turnId:'PRIVATE_TURN_SENTINEL',model:request.model,
        reasoningEffort:request.reasoningEffort,contextHash:inferenceRequestHash(request),
        usage:{inputTokens:17,outputTokens:4,totalTokens:21},usageScope:'fresh-thread-total',...receiptPatch}};
    },
    async close() {}
  });
  const mission=engine.create('Keep this synthetic telemetry fixture isolated.',{allowedTools:[],model:'gpt-6-astra',reasoningEffort:'ultra',
    inferenceBudget:{mode:'mission-calls-v1',maxCalls:3}});
  return {engine,mission};
}

function createReviewer(engine,mission,{nodeId='review:PRIVATE_NODE_SENTINEL',roleIds=['omega_03']}={}){
  return engine.workers.createRun({missionId:mission.id,nodeId,mode:'reviewer',purpose:'delivery',roleIds});
}

async function infer(engine,run){
  return engine.workers.infer({runId:run.id,instructions:'PRIVATE_PROMPT_SENTINEL',input:'PRIVATE_INPUT_SENTINEL',
    schema:{...schema,description:'PRIVATE_SCHEMA_SENTINEL'},validate:value=>value.ok===true});
}

function onlyActor(projection){
  assert.equal(projection.actors.length,1);return projection.actors[0];
}

test('projects a valid retained receipt as local actor telemetry without mutating Factory state',async t=>{
  const {engine,mission}=fixture(t),run=createReviewer(engine,mission);
  await infer(engine,run);
  const before=engine.store.verifyJournal(),projection=projectMissionActorTelemetry(engine,mission.id);
  assert.deepEqual(engine.store.verifyJournal(),before,'the projection is read-only');
  assert.equal(projection.schema,'sovereign.actor-telemetry.v1');
  assert.equal(projection.integrity,'LOCAL_RECORD_CHAIN');
  assert.deepEqual(projection.coverage,{actors:1,completedRecorded:1,pendingRecords:0,created:0,noRecordedCompletion:0,unverified:0,notCovered:0});
  const actor=onlyActor(projection);
  assert.equal(actor.actor,'Actor 1');assert.equal(actor.kind,'REVIEWER');assert.equal(actor.state,'COMPLETED_RECORDED');
  assert.equal(actor.integrity,'SIGNED_LOCAL_LINEAGE');
  assert.deepEqual(actor.target,{model:'gpt-6-astra',reasoningEffort:'ultra'});
  assert.deepEqual(actor.execution,{origin:'SIMULATED',usage:{inputTokens:17,outputTokens:4,totalTokens:21},usageScope:'fresh-thread-total'});
  assert.equal(Object.hasOwn(actor.execution,'cost'),false);
});

test('missing or altered receipts never become a recorded completion',async t=>{
  const missing=fixture(t),pendingRun=createReviewer(missing.engine,missing.mission);
  const created=onlyActor(projectMissionActorTelemetry(missing.engine,missing.mission.id));
  assert.equal(created.state,'CREATED');assert.equal(Object.hasOwn(created,'target'),false);assert.equal(Object.hasOwn(created,'execution'),false);

  const altered=fixture(t),run=createReviewer(altered.engine,altered.mission);
  await infer(altered.engine,run);
  const current=altered.engine.store.get('run',run.id),badReceipt={...current.data.inferenceReceipt,model:'gpt-5.5'},
    receipts=current.data.inferenceReceipts.map((receipt,index)=>index===current.data.inferenceReceipts.length-1?badReceipt:receipt);
  altered.engine.store.put('run',run.id,{...current.data,inferenceReceipt:badReceipt,inferenceReceipts:receipts},{expectedVersion:current.version});
  const actor=onlyActor(projectMissionActorTelemetry(altered.engine,altered.mission.id));
  assert.equal(actor.state,'UNVERIFIED');assert.equal(actor.integrity,'UNVERIFIED');
  assert.equal(Object.hasOwn(actor,'target'),false);assert.equal(Object.hasOwn(actor,'execution'),false);
});

test('a retained receipt is withheld when its exact signed dispatch proof no longer verifies',async t=>{
  const {engine,mission}=fixture(t),run=createReviewer(engine,mission);
  await infer(engine,run);
  assert.equal(engine.store.list('mission-inference-actor-origin').length,1,'fixture has a real signed actor origin');
  const proof=engine.store.list('mission-inference-dispatch-proof')[0];
  assert.ok(proof,'fixture has a real signed dispatch proof');
  // Keep the actor, request and receipt intact, but corrupt the immutable proof
  // through a new historical version. The journal remains structurally valid;
  // a projection must still fail closed rather than trust matching IDs.
  engine.store.put(proof.type,proof.id,{signed:'not-a-valid-dispatch-proof'},{expectedVersion:proof.version});
  const actor=onlyActor(projectMissionActorTelemetry(engine,mission.id));
  assert.equal(actor.state,'UNVERIFIED');assert.equal(actor.integrity,'UNVERIFIED');
  assert.equal(Object.hasOwn(actor,'target'),false);assert.equal(Object.hasOwn(actor,'execution'),false);
});

test('Factory report adds the reduced actor projection only with a trusted Registry capability',async t=>{
  const {engine,mission}=fixture(t),run=createReviewer(engine,mission);
  await infer(engine,run);
  const before=engine.store.verifyJournal(),trusted=missionReport(engine.store,mission.id,{registry:engine.registry}),
    untrusted=missionReport(engine.store,mission.id);
  assert.deepEqual(engine.store.verifyJournal(),before,'report integration remains read-only');
  assert.ok(trusted.actorTelemetry);assert.equal(onlyActor(trusted.actorTelemetry).state,'COMPLETED_RECORDED');
  assert.equal(Object.hasOwn(untrusted,'actorTelemetry'),false);
  const serialized=JSON.stringify(trusted);
  for(const sentinel of ['PRIVATE_PROMPT_SENTINEL','PRIVATE_INPUT_SENTINEL','PRIVATE_SCHEMA_SENTINEL','PRIVATE_THREAD_SENTINEL',
    'PRIVATE_TURN_SENTINEL','PRIVATE_NODE_SENTINEL','omega_03',run.id])assert.equal(serialized.includes(sentinel),false,`report leaked ${sentinel}`);
  for(const field of ['requestJson','instructions','input','contextHash','threadId','turnId','nativeTranscript','providerDiagnostics'])
    assert.equal(serialized.includes(`\"${field}\"`),false,`report exported ${field}`);
  assert.match(formatMissionReport(trusted),/Telemetría operativa genérica no proyectada/);
});

test('never exports prompts, inputs, schemas, outputs, raw identifiers or provider identifiers',async t=>{
  const {engine,mission}=fixture(t),run=createReviewer(engine,mission);
  await infer(engine,run);
  const projection=projectMissionActorTelemetry(engine,mission.id),serialized=JSON.stringify(projection);
  const sentinels=['PRIVATE_PROMPT_SENTINEL','PRIVATE_INPUT_SENTINEL','PRIVATE_SCHEMA_SENTINEL','PRIVATE_THREAD_SENTINEL',
    'PRIVATE_TURN_SENTINEL','PRIVATE_NODE_SENTINEL','omega_03',run.id,mission.id];
  for(const sentinel of sentinels)assert.equal(serialized.includes(sentinel),false,`projection leaked ${sentinel}`);
  for(const field of ['requestJson','instructions','input','contextHash','threadId','turnId','nativeTranscript','providerDiagnostics'])
    assert.equal(serialized.includes(`\"${field}\"`),false,`projection exported ${field}`);
});
