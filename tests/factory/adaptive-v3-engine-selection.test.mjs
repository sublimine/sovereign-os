import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {FactoryEngine} from '../../factory/lib/engine.mjs';
import {sha256} from '../../factory/lib/contracts.mjs';
import {ADAPTIVE_V3_DIRECT_ENTRY_MODE,ADAPTIVE_V3_PLANNED_ENTRY_MODE,ADAPTIVE_V3_ROUTING_MODE} from '../../factory/lib/adaptive-v3-routing.mjs';
import {ADAPTIVE_V3_ROUTE_RECORD_TYPE,assertAdaptiveV3MissionRoute} from '../../factory/lib/adaptive-v3-route-contract.mjs';
import {ADAPTIVE_V3_DIRECT_CERTIFICATION_TYPE,ADAPTIVE_V3_DIRECT_ORIGIN_TYPE} from '../../factory/lib/adaptive-v3-deterministic-entry.mjs';

const literal=(transform,payload)=>`LITERAL-TRANSFORM/1 ${transform}\n<<<\n${payload}\n>>>`;
function setup(t){
  const root=mkdtempSync(join(tmpdir(),'sovereign-adaptive-v3-engine-'));
  const engine=new FactoryEngine({databasePath:join(root,'state.sqlite'),workspaceRoot:join(root,'workspaces')});
  t.after(()=>{engine.close();rmSync(root,{recursive:true,force:true});});
  return engine;
}
const options={preset:'adaptive-v3',model:'gpt-6-terra',reasoningEffort:'high',allowedTools:[]};

test('engine publishes a direct v3 route atomically before any worker, effect or workspace exists',t=>{
  const engine=setup(t),mission=engine.create(literal('uppercase-ascii-v1','hello'),options);
  assert.equal(mission.policy.entryMode,ADAPTIVE_V3_DIRECT_ENTRY_MODE);
  assert.equal(mission.policy.routing.routingMode,ADAPTIVE_V3_ROUTING_MODE);
  assert.equal(mission.policy.routing.requestedEntryMode,null);
  assert.equal(mission.policy.model,'gpt-6-terra');assert.equal(mission.policy.reasoningEffort,'high');
  assert.equal(engine.store.get(ADAPTIVE_V3_ROUTE_RECORD_TYPE,mission.id)?.version,1);
  assert.equal(engine.store.db.prepare('PRAGMA user_version').get().user_version,13);
  assert.equal(engine.store.list('run').length,0);assert.equal(engine.store.list('effect').length,0);
  assert.equal(engine.store.list('workspace').length,0);assert.equal(engine.store.get('plan',mission.id),null);
  assert.equal(assertAdaptiveV3MissionRoute(engine.store,engine.authority,mission.id).decision.selectedEntryMode,ADAPTIVE_V3_DIRECT_ENTRY_MODE);
});

test('engine completes a signed direct v3 route before every ordinary recovery, worker or planner boundary',async t=>{
  const engine=setup(t),mission=engine.create(literal('uppercase-ascii-v1','terra keeps the boundary'),options),calls=[];
  // A direct route must return before these ordinary paths.  Replacing them
  // with throwing sentinels proves ordering rather than merely checking an
  // empty ledger after the fact.
  engine.ledger.recover=()=>{calls.push('ledger.recover');throw Error('direct route reached plan recovery');};
  engine.broker.reconcileExecutions=()=>{calls.push('broker.reconcileExecutions');throw Error('direct route reached broker recovery');};
  engine.workers.verifyWorkspaceSnapshot=()=>{calls.push('workers.verifyWorkspaceSnapshot');throw Error('direct route invented a workspace review');};
  const first=await engine.run(mission.id);
  assert.equal(first.mission.status,'COMPLETED');assert.deepEqual(calls,[]);
  const delivered=engine.store.get('artifact',first.mission.finalArtifactId).data;
  assert.equal(delivered.payload.body,'TERRA KEEPS THE BOUNDARY');
  assert.equal(engine.store.list('run').length,1);
  assert.equal(engine.store.list('review').length,0);assert.equal(engine.store.list('effect').length,0);
  assert.equal(engine.store.list('source').length,0);assert.equal(engine.store.list('node').length,0);
  assert.equal(engine.store.get('plan',mission.id),null);assert.equal(engine.store.list('workspace').length,0);
  assert.equal(engine.store.list('worker-config').length,0);assert.equal(engine.store.list('inference-request').length,0);
  assert.equal(engine.store.get(ADAPTIVE_V3_DIRECT_ORIGIN_TYPE,mission.id)?.version,1);
  assert.equal(engine.store.get(ADAPTIVE_V3_DIRECT_CERTIFICATION_TYPE,delivered.id)?.version,1);
  // Engine lease acquire/release records advance on every invocation.  Exclude
  // those coordination-only records while requiring every mission product and
  // route record to be byte-for-byte unchanged on validation-only reentry.
  const durableProductShape=()=>engine.store.db.prepare("SELECT type,id,version,hash FROM records WHERE type <> 'engine' ORDER BY type,id,version").all();
  const before=durableProductShape();
  const second=await engine.run(mission.id);
  assert.equal(second.mission.finalArtifactId,delivered.id);assert.deepEqual(calls,[]);
  assert.deepEqual(durableProductShape(),before,
    'a delivered deterministic result must validate rather than recreate ordinary work');
});

test('a signed direct v3 route rejects every ordinary worker and broker entry even with a raw-forged actor and lease',async t=>{
  const engine=setup(t),mission=engine.create(literal('identity-utf8-v1','closed'),options);
  assert.throws(()=>engine.workers.createRun({missionId:mission.id,nodeId:'ordinary',mode:'producer',purpose:'ordinary',roleIds:['sigma_01']}),
    {code:'ADAPTIVE_V3_ROUTE_INTEGRITY'});
  assert.equal(engine.store.list('run').length,0);assert.equal(engine.store.list('worker-config').length,0);
  const context={purpose:'ordinary',artifactIds:[],sourceIds:[],instructionsHash:sha256('forged-direct-worker'),producerConversationIncluded:false};
  assert.throws(()=>engine.registry.registerRun({missionId:mission.id,nodeId:'ordinary',mode:'producer',context}),
    {code:'ADAPTIVE_V3_DIRECT_ENTRY_INTEGRITY'});
  // Bypass the Registry only inside this adversarial fixture.  WorkerService
  // and ToolBroker must independently reject a corrupt durable actor before a
  // provider request, lease or effect can be retained.
  const forged={id:'run:raw-forged-direct',missionId:mission.id,nodeId:'ordinary',mode:'producer',context,contextHash:sha256(context),
    forbiddenArtifactIds:[],providerThreadId:null,createdAt:'2026-09-19T00:00:00.000Z'};
  engine.store.put('run',forged.id,forged,{expectedVersion:0});
  await assert.rejects(engine.workers.infer({runId:forged.id,instructions:'must not dispatch',input:'{}',schema:{type:'object'},validate:()=>true}),
    {code:'ADAPTIVE_V3_ROUTE_INTEGRITY'});
  assert.throws(()=>engine.workers.lease(forged.id,'workspace.read'),{code:'ADAPTIVE_V3_ROUTE_INTEGRITY'});
  await assert.rejects(engine.workers.tool(forged.id,'workspace.read',{path:'nope.txt'},'direct:worker:tool'),
    {code:'ADAPTIVE_V3_ROUTE_INTEGRITY'});
  const lease=engine.authority.issue({missionId:mission.id,principalId:forged.id,actions:['workspace.read'],resources:[`workspace:${mission.id}`],classification:'INTERNAL',
    expiresAt:new Date(Date.now()+60000).toISOString()});
  await assert.rejects(engine.broker.execute({missionId:mission.id,principalId:forged.id,lease,operationId:'direct:broker:tool',tool:'workspace.read',args:{path:'nope.txt'}}),
    {code:'ADAPTIVE_V3_ROUTE_INTEGRITY'});
  assert.throws(()=>engine.broker.reconcileExecutions(mission.id),{code:'ADAPTIVE_V3_ROUTE_INTEGRITY'});
  assert.equal(engine.store.list('worker-config').length,0);assert.equal(engine.store.list('inference-request').length,0);
  assert.equal(engine.store.list('effect').length,0);assert.equal(engine.store.list('source').length,0);
  assert.equal(engine.store.list('node').length,0);assert.equal(engine.store.get('plan',mission.id),null);
  const halted=await engine.run(mission.id);
  assert.equal(halted.mission.status,'NEEDS_DIRECTION');assert.equal(halted.mission.finalArtifactId,null);
  assert.equal(engine.store.get('plan',mission.id),null,'a corrupted direct route must stop rather than silently plan around the boundary');
});

test('a forged direct-route input manifest stops before input preparation or workspace creation',async t=>{
  const engine=setup(t),mission=engine.create(literal('identity-utf8-v1','no inputs'),options);
  // The record is deliberately durable but has no matching mission@1 binding.
  // Route validation must reject it before the controller can copy a byte or
  // reserve a workspace directory.
  engine.store.put('mission-input-manifest',mission.id,{untrusted:'forged'}, {expectedVersion:0});
  const halted=await engine.run(mission.id),durable=engine.store.get('mission',mission.id).data;
  assert.equal(halted.mission.status,'UNVERIFIED');assert.deepEqual(halted.mission.pending,[]);
  assert.equal(durable.status,'NEEDS_DIRECTION');
  assert.equal(durable.pending.at(-1).code,'ADAPTIVE_V3_ROUTE_INTEGRITY');
  for(const type of ['input-preparation','input-directory','input-prepared-file','tool-workspace','workspace','run','effect','node','plan'])
    assert.equal(engine.store.list(type).length,0,`${type} must not be created before direct-route rejection`);
});

test('a manually marked ordinary final cannot use the completed-mission path to bypass direct certification',async t=>{
  const engine=setup(t),mission=engine.create(literal('identity-utf8-v1','closed'),options),artifactId='artifact:manual-direct-final';
  const payload={missionId:mission.id,nodeId:'escape',producerRunId:'run:manual-direct-final',kind:'deterministic-result',purpose:'escape',body:'INJECTED',
    claims:[],inputRefs:[],toolReceipts:[],requiredEffects:[],criteria:[{id:'escape',text:'Injected criterion'}],provisional:false};
  engine.store.put('artifact',artifactId,{id:artifactId,payload,payloadHash:sha256(payload),missionId:mission.id,status:'ACCEPTED',reviews:['review:invented'],
    reviewDependencies:[],createdAt:'2026-09-19T00:00:00.000Z',invalidation:null},{expectedVersion:0});
  const current=engine.store.get('mission',mission.id);
  engine.store.put('mission',mission.id,{...current.data,status:'COMPLETED',finalArtifactId:artifactId,updatedAt:'2026-09-19T00:01:00.000Z',
    history:[...(current.data.history??[]),{status:'COMPLETED',at:'2026-09-19T00:01:00.000Z'}]},{expectedVersion:current.version});
  const calls=[];
  engine.workers.verifyWorkspaceSnapshot=()=>{calls.push('workspace-validation');throw Error('direct final reached workspace validation');};
  engine.ledger.recover=()=>{calls.push('ledger-recovery');throw Error('direct final reached ledger recovery');};
  const halted=await engine.run(mission.id),durable=engine.store.get('mission',mission.id).data;
  assert.equal(halted.mission.status,'UNVERIFIED');assert.deepEqual(halted.mission.pending,[]);
  assert.equal(durable.status,'NEEDS_DIRECTION');assert.equal(durable.pending.at(-1).code,'ADAPTIVE_V3_DIRECT_ENTRY_INTEGRITY');
  assert.deepEqual(calls,[]);assert.equal(halted.mission.finalArtifactId,null,
    'A quarantined public result must not disclose the suspicious pointer');
  assert.equal(durable.finalArtifactId,artifactId,
    'The internal recovery record retains the pointer rather than replacing it');
  assert.equal(engine.store.list('workspace').length,0);assert.equal(engine.store.get('plan',mission.id),null);
});

test('facts, admitted resource ceilings and authenticated input manifests select planning without falling back to legacy direct entry',t=>{
  const engine=setup(t);
  const fact=engine.create('¿Cuál es la capital actual de Francia?',options);
  const resource=engine.create(literal('identity-utf8-v1','x'.repeat(20*1024+1)),options);
  const input=engine.create(literal('identity-utf8-v1','local'),{...options,inputs:[{path:'brief.txt',content:'untrusted local premise'}]});
  for(const mission of [fact,resource,input]){
    const route=assertAdaptiveV3MissionRoute(engine.store,engine.authority,mission.id);
    assert.equal(mission.policy.entryMode,ADAPTIVE_V3_PLANNED_ENTRY_MODE);
    assert.equal(route.decision.selectedEntryMode,ADAPTIVE_V3_PLANNED_ENTRY_MODE);
    assert.notEqual(mission.policy.entryMode,'closed-response-v1');assert.notEqual(mission.policy.entryMode,'closed-response-v2');
  }
  assert.equal(resource.policy.routing.requestedEntryMode,null);
  assert.equal(input.inputManifestHash!==undefined,true);
});

test('a v3 direct override cannot weaken a required plan and an unscoped direct mode cannot create a mission',t=>{
  const engine=setup(t),before=engine.store.verifyJournal();
  assert.throws(()=>engine.create('¿Cuál es la capital actual de Francia?',{...options,entryMode:ADAPTIVE_V3_DIRECT_ENTRY_MODE}),
    {code:'ROUTE_OVERRIDE_WEAKENS'});
  assert.equal(engine.store.list('mission').length,0);assert.deepEqual(engine.store.verifyJournal(),before);
  assert.throws(()=>engine.create(literal('identity-utf8-v1','hello'),{model:'gpt-6-terra',reasoningEffort:'high',entryMode:ADAPTIVE_V3_DIRECT_ENTRY_MODE}),
    {code:'POLICY'});
  assert.equal(engine.store.list('mission').length,0);assert.deepEqual(engine.store.verifyJournal(),before);
});

test('an explicit planned override is preserved in the signed route even for an exact deterministic request',t=>{
  const engine=setup(t),mission=engine.create(literal('reverse-ascii-v1','abc'),{...options,entryMode:'planned'});
  const route=assertAdaptiveV3MissionRoute(engine.store,engine.authority,mission.id);
  assert.equal(mission.policy.entryMode,ADAPTIVE_V3_PLANNED_ENTRY_MODE);
  assert.equal(mission.policy.routing.requestedEntryMode,'planned');
  assert.equal(route.decision.disposition,'HARDENED_TO_PLANNED');
});

test('validation-only rejects an unfinished planned V3 mission before ownership, inference, effects or recovery exist',async t=>{
  const engine=setup(t),mission=engine.create('Produce a reviewed bounded result.',{...options,entryMode:'planned'}),before=engine.store.verifyJournal();
  let providers=0;engine.workers.providerFactory=()=>{providers++;throw Error('Validation-only preflight must not construct a provider');};
  await assert.rejects(engine.run(mission.id,{validationOnly:true}),{code:'REENTRY_SCOPE'});
  assert.deepEqual(engine.store.verifyJournal(),before);
  assert.equal(engine.store.get('mission',mission.id).data.status,'NEW');assert.equal(providers,0);
  for(const type of ['engine','run','effect','node','plan','workspace-validation','lease'])assert.equal(engine.store.list(type).length,0,type);
});
