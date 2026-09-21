import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {FactoryEngine} from '../../factory/lib/engine.mjs';
import {sha256} from '../../factory/lib/contracts.mjs';
import {inferenceRequestHash} from '../../factory/providers/instruction-profiles.mjs';
import {retainInferenceRequest} from '../../factory/lib/inference-request-evidence.mjs';
import {missionInferenceBudget,missionBudgetRecordRef,reserveMissionInference} from '../../factory/lib/mission-inference-budget.mjs';

const selected=maxCalls=>({mode:'mission-calls-v1',maxCalls});
const responseSchema={type:'object',properties:{ok:{type:'boolean'}},required:['ok'],additionalProperties:false};

function fixture(t,{maxCalls=3}={}){
  const root=mkdtempSync(join(tmpdir(),'mission-inference-provenance-'));
  const engine=new FactoryEngine({databasePath:join(root,'state.sqlite'),workspaceRoot:join(root,'workspaces')});
  engine.workers.providerFactory=()=>({
    async generate(request){
      const value={ok:true};
      assert.equal(await request.validate(value),true);
      return {value,receipt:{status:'completed',simulation:true,threadId:'provenance-thread',turnId:'provenance-turn',contextHash:inferenceRequestHash(request)}};
    },
    async close(){}
  });
  t.after(()=>{engine.close();rmSync(root,{recursive:true,force:true});});
  const mission=engine.create('Preserve durable provenance for every model dispatch.',{allowedTools:[],inferenceBudget:selected(maxCalls)});
  return {engine,mission};
}

function rawRun(engine,mission,{mode='producer',nodeId='delivery',purpose='delivery'}={}){
  return engine.registry.registerRun({missionId:mission.id,nodeId,mode,context:{purpose,artifactIds:[],sourceIds:[],
    instructionsHash:sha256('forged fixture instructions'),producerConversationIncluded:false}});
}

function forgedWorkerReservation(engine,mission){
  const run=rawRun(engine,mission),store=engine.store;
  const request={instructions:'forged fixture instructions',input:'{}',schema:responseSchema,model:mission.policy.model,reasoningEffort:mission.policy.reasoningEffort};
  const requestHash=inferenceRequestHash(request);
  store.transact(()=>{
    store.put('worker-config',run.id,{instructions:request.instructions,prefixHash:sha256(request.instructions),roleIds:[],compilationScope:{},
      learnedInstructionVersions:[],learningDisposition:{schema:'sovereign.learning-selection.v1',status:'NO_CATALOG_ROLES',exclusions:[],resolverCalls:0}},{expectedVersion:0});
    const initial=store.get('run',run.id);
    const pending=store.put('run',run.id,{...initial.data,expectedRequestHash:requestHash,
      requests:[{requestHash,contextHash:initial.data.contextHash,at:store.clock()}]},{expectedVersion:initial.version});
    const retained=retainInferenceRequest(store,run.id,request,'BEFORE_DISPATCH');
    reserveMissionInference(engine.registry,{missionId:mission.id,kind:'worker',binding:{run:missionBudgetRecordRef(pending),
      request:missionBudgetRecordRef(retained),requestHash}});
  });
  return run;
}

test('a syntactically complete forged worker reservation is not budget-valid without a signed dispatch proof',t=>{
  const {engine,mission}=fixture(t);forgedWorkerReservation(engine,mission);
  assert.equal(engine.store.list('mission-inference-call').length,1);
  assert.equal(engine.store.list('mission-inference-dispatch-proof').length,0);
  assert.throws(()=>missionInferenceBudget(engine.registry,mission.id),{code:'INFERENCE_PROVENANCE_INTEGRITY'});
});

test('a raw registry caller cannot reserve a budgeted worker request without the private WorkerService handoff',t=>{
  const {engine,mission}=fixture(t),run=rawRun(engine,mission);
  assert.throws(()=>engine.registry.recordInferenceRequest(run.id,{instructions:'untrusted direct request',input:'{}',schema:responseSchema,
    model:mission.policy.model,reasoningEffort:mission.policy.reasoningEffort}),{code:'INFERENCE_PROVENANCE_CONTROL'});
  assert.equal(engine.store.list('mission-inference-call').length,0);
});

test('a real WorkerService reviewer reservation carries signed actor and dispatch lineage',async t=>{
  const {engine,mission}=fixture(t),run=engine.workers.createRun({missionId:mission.id,nodeId:'review:delivery',mode:'reviewer',purpose:'delivery',
    roleIds:['omega_03']});
  await engine.workers.infer({runId:run.id,instructions:'Return the fixture verdict.',input:'{}',schema:responseSchema,validate:value=>value.ok===true});
  const view=missionInferenceBudget(engine.registry,mission.id);
  assert.equal(view.reserved,1);
  assert.equal(engine.store.list('mission-inference-actor-origin').length,1);
  assert.equal(engine.store.list('mission-inference-dispatch-proof').length,1);
});

test('a later worker-configuration rewrite invalidates the previously signed reservation',async t=>{
  const {engine,mission}=fixture(t),run=engine.workers.createRun({missionId:mission.id,nodeId:'review:delivery',mode:'reviewer',purpose:'delivery',
    roleIds:['omega_03']});
  await engine.workers.infer({runId:run.id,instructions:'Return the fixture verdict.',input:'{}',schema:responseSchema,validate:value=>value.ok===true});
  const configuration=engine.store.get('worker-config',run.id),instructions='mutated after dispatch';
  engine.store.put(configuration.type,configuration.id,{...configuration.data,instructions,prefixHash:sha256(instructions)},{expectedVersion:configuration.version});
  assert.throws(()=>missionInferenceBudget(engine.registry,mission.id),{code:'INFERENCE_PROVENANCE_INTEGRITY'});
});
