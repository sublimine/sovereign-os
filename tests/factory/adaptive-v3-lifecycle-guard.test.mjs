import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {FactoryEngine} from '../../factory/lib/engine.mjs';
import {MissionQueue} from '../../factory/lib/queue.mjs';
import {sha256} from '../../factory/lib/contracts.mjs';
import {missionReport,formatMissionReport} from '../../factory/lib/report.mjs';

const literal=(transform,payload)=>`LITERAL-TRANSFORM/1 ${transform}\n<<<\n${payload}\n>>>`;
const options={preset:'adaptive-v3',model:'gpt-6-terra',reasoningEffort:'high',allowedTools:[]};
const directCode='ADAPTIVE_V3_DIRECT_ENTRY_INTEGRITY';

function setup(t){
  const root=mkdtempSync(join(tmpdir(),'sovereign-adaptive-v3-lifecycle-'));
  const engine=new FactoryEngine({databasePath:join(root,'state.sqlite'),workspaceRoot:join(root,'workspaces')});
  t.after(()=>{engine.close();rmSync(root,{recursive:true,force:true});});
  return {root,engine};
}

test('a public direct-v3 status setter cannot manufacture COMPLETED before authenticated delivery',async t=>{
  const {engine}=setup(t),mission=engine.create(literal('uppercase-ascii-v1','state cannot certify'),options);
  assert.throws(()=>engine.setStatus(mission.id,'COMPLETED'),{code:directCode});
  assert.equal(engine.status(mission.id).mission.status,'NEW');
  assert.equal(engine.store.list('run').length,0);assert.equal(engine.store.list('artifact').length,0);
  const completed=await engine.run(mission.id);
  assert.equal(completed.mission.status,'COMPLETED');assert.equal(completed.outcome.payload.body,'STATE CANNOT CERTIFY');
});

test('a cancelled direct mission cannot be revived through ordinary Engine execution',async t=>{
  const {engine}=setup(t),mission=engine.create(literal('identity-utf8-v1','cancel must win'),options);
  engine.setStatus(mission.id,'CANCELLED',[{code:'OWNER_CANCELLED'}]);
  const result=await engine.run(mission.id);
  assert.equal(result.mission.status,'CANCELLED');
  const state=engine.status(mission.id);
  assert.equal(state.mission.status,'CANCELLED');assert.equal(state.mission.finalArtifactId,null);
  assert.equal(engine.store.list('run').length,0);assert.equal(engine.store.list('artifact').length,0);
});

test('the deterministic entry runner is absent from the public module and an engine facade cannot obtain it',async t=>{
  const {engine}=setup(t),mission=engine.create(literal('identity-utf8-v1','private engine runner'),options);
  const api=await import('../../factory/lib/adaptive-v3-deterministic-entry.mjs');
  assert.equal(Object.hasOwn(api,'installAdaptiveV3EntryRunner'),false);
  assert.equal(Object.hasOwn(api,'runAdaptiveV3Entry'),false);
  const facade=Object.create(engine);
  facade.assertAdaptiveV3EntryOwnership=()=>{};
  assert.equal(typeof facade.runAdaptiveV3Entry,'undefined');
  assert.equal(engine.store.list('run').length,0);assert.equal(engine.store.list('artifact').length,0);
  const result=await engine.run(mission.id);
  assert.equal(result.mission.status,'COMPLETED');assert.equal(result.outcome.payload.body,'private engine runner');
});

test('a certified direct delivery is terminal even during an adversarial event callback',async t=>{
  const root=mkdtempSync(join(tmpdir(),'sovereign-adaptive-v3-terminal-'));
  let engine,cancelError=null;
  engine=new FactoryEngine({databasePath:join(root,'state.sqlite'),workspaceRoot:join(root,'workspaces'),onEvent:event=>{
    if(event.kind==='adaptive-v3.direct.accepted'){
      try{engine.cancel(event.missionId);}catch(error){cancelError=error;}
    }
  }});
  t.after(()=>{engine.close();rmSync(root,{recursive:true,force:true});});
  const mission=engine.create(literal('uppercase-ascii-v1','terminal means terminal'),options);
  const result=await engine.run(mission.id);
  assert.equal(cancelError?.code,'MISSION_COMPLETED');
  assert.equal(result.mission.status,'COMPLETED');
  assert.equal(result.outcome.payload.body,'TERMINAL MEANS TERMINAL');
  const finalId=result.mission.finalArtifactId;
  for(const status of ['NEW','PLANNING','RUNNING','PAUSED','WAITING_PROVIDER','WAITING_QUOTA','WAITING_CAPABILITY','NEEDS_DIRECTION','FAILED','CANCELLING','CANCELLED']){
    assert.throws(()=>engine.setStatus(mission.id,status),{code:directCode},status);
    const state=engine.status(mission.id);
    assert.equal(state.mission.status,'COMPLETED');assert.equal(state.mission.finalArtifactId,finalId);assert.equal(state.outcome.id,finalId);
  }
  assert.throws(()=>engine.setStatus(mission.id,'COMPLETED',[{code:'LATE_ANNOTATION'}]),{code:directCode});
});

test('a forged direct final is neither projected nor reported as delivery, then is quarantined by Engine recovery',async t=>{
  const {engine}=setup(t),mission=engine.create(literal('identity-utf8-v1','no forged outcome'),options),artifactId='artifact:forged-direct-state';
  const payload={missionId:mission.id,nodeId:'escape',producerRunId:'run:escape',kind:'deterministic-result',purpose:'escape',body:'FORGED',
    claims:[],inputRefs:[],toolReceipts:[],requiredEffects:[],criteria:[{id:'escape',text:'forged'}],provisional:false};
  engine.store.put('artifact',artifactId,{id:artifactId,missionId:mission.id,payload,payloadHash:sha256(payload),status:'ACCEPTED',reviews:[],reviewDependencies:[],
    createdAt:'2026-09-19T00:00:00.000Z',invalidation:null},{expectedVersion:0});
  const current=engine.store.get('mission',mission.id);
  engine.store.put('mission',mission.id,{...current.data,status:'COMPLETED',finalArtifactId:artifactId,updatedAt:'2026-09-19T00:01:00.000Z',
    history:[...current.data.history,{status:'COMPLETED',at:'2026-09-19T00:01:00.000Z'}]},{expectedVersion:current.version});

  assert.throws(()=>engine.status(mission.id),{code:directCode});
  assert.throws(()=>missionReport(engine.store,mission.id,{registry:engine.registry}),{code:directCode});
  assert.throws(()=>missionReport(engine.store,mission.id),{code:directCode});

  const halted=await engine.run(mission.id);
  // Recovery records the concrete operational state internally, but the
  // public return is a delivery quarantine: a persisted pointer with invalid
  // evidence must not disclose recovery detail or become a usable outcome.
  assert.equal(halted.mission.status,'UNVERIFIED');assert.equal(halted.outcome,null);
  assert.equal(halted.mission.finalArtifactId,null,'public status never republishes a suspicious delivery pointer');
  assert.equal(halted.mission.deliveryIntegrity,'UNVERIFIED');
  const durable=engine.store.get('mission',mission.id).data;
  assert.equal(durable.status,'NEEDS_DIRECTION');assert.equal(durable.pending.at(-1).code,directCode);
  assert.equal(durable.finalArtifactId,artifactId,
    'the durable suspicious state is retained for internal diagnosis, not overwritten');
  const report=missionReport(engine.store,mission.id,{registry:engine.registry});
  assert.equal(report.final,null);assert.equal(report.adaptiveV3.finalArtifact,null);
  assert.equal(report.adaptiveV3.deterministicCertificationRecord,null);
  assert.doesNotMatch(formatMissionReport(report),/Último artefacto ACCEPTED/);
});

test('a forged planned-v3 final is neither projected by status nor retained as an outcome after recovery',async t=>{
  const {engine}=setup(t),mission=engine.create('What is the current capital of France?',options),
    artifactId='artifact:forged-planned-status',body='PRIVATE_FORGED_PLANNED_STATUS_BODY_SENTINEL',
    payload={missionId:mission.id,nodeId:'forged',producerRunId:'run:forged',kind:'delivery',purpose:'forged',body,
      claims:[],inputRefs:[],toolReceipts:[],requiredEffects:[],criteria:[],provisional:false};
  assert.equal(engine.store.get('adaptive-v3-route',mission.id).data.signed.data.decision.selectedEntryMode,'planned');
  engine.store.put('artifact',artifactId,{id:artifactId,missionId:mission.id,payload,payloadHash:sha256(payload),status:'ACCEPTED',reviews:[],reviewDependencies:[],
    createdAt:'2026-09-20T00:00:00.000Z',invalidation:null},{expectedVersion:0});
  const current=engine.store.get('mission',mission.id);
  engine.store.put('mission',mission.id,{...current.data,status:'COMPLETED',finalArtifactId:artifactId,updatedAt:'2026-09-20T00:01:00.000Z',
    history:[...current.data.history,{status:'COMPLETED',at:'2026-09-20T00:01:00.000Z'}]},{expectedVersion:current.version});
  const beforeRecovery=engine.status(mission.id);
  assert.equal(beforeRecovery.outcome,null);assert.equal(beforeRecovery.outcomeIntegrity,'UNVERIFIED');
  const result=await engine.run(mission.id),serialized=JSON.stringify(result);
  assert.notEqual(result.mission.status,'COMPLETED');assert.equal(result.outcome,null);assert.ok(!serialized.includes(body));
  assert.equal(engine.status(mission.id).outcome,null);
});

test('a planned-v3 final pointer cannot redirect validation through a detached artifact payload id',t=>{
  const {engine}=setup(t),mission=engine.create('What is the current capital of France?',options),pointer='artifact:planned-pointer';
  assert.equal(engine.store.get('adaptive-v3-route',mission.id).data.signed.data.decision.selectedEntryMode,'planned');
  const payload={missionId:mission.id,nodeId:'forged',producerRunId:'run:forged',kind:'delivery',purpose:'forged',body:'detached id',
    claims:[],inputRefs:[],toolReceipts:[],requiredEffects:[],criteria:[],provisional:false};
  engine.store.put('artifact',pointer,{id:'artifact:redirect-target',missionId:mission.id,payload,payloadHash:sha256(payload),status:'ACCEPTED',reviews:[],reviewDependencies:[]},{expectedVersion:0});
  const current=engine.store.get('mission',mission.id);
  engine.store.put('mission',mission.id,{...current.data,status:'COMPLETED',finalArtifactId:pointer,updatedAt:'2026-09-20T00:01:00.000Z',
    history:[...current.data.history,{status:'COMPLETED',at:'2026-09-20T00:01:00.000Z'}]},{expectedVersion:current.version});
  const state=engine.status(mission.id);
  assert.equal(state.outcome,null);assert.equal(state.outcomeIntegrity,'UNVERIFIED');
  assert.throws(()=>engine.registry.assertUsable(pointer,{missionId:mission.id,purpose:'forged'}),{code:'ARTIFACT_IDENTITY'});
});

test('durable learning causal roots quarantine a direct certificate rather than leaving contaminated delivery usable',async t=>{
  const roots=[
    ['learning-dataset','learning-dataset:direct',({missionId})=>({missionId,cases:[]})],
    ['learning-candidate','learning-candidate:direct',({runId})=>({authorRunId:runId})],
    ['learning-cycle','learning-cycle:direct',({missionId,runId})=>({missionId,runId,status:'OBSERVED'})]
  ];
  for(const [type,id,makeData] of roots){
    const {engine}=setup(t),mission=engine.create(literal('identity-utf8-v1',`learning root ${type}`),options);
    const delivered=await engine.run(mission.id),finalId=delivered.mission.finalArtifactId,
      // `run()` exposes the same delivery-safe view as status. The test needs
      // the producer identity only to create an internal causal-root fixture,
      // so obtain it from the trusted durable artifact rather than asking the
      // public delivery projection to leak custody metadata.
      runId=engine.store.get('artifact',finalId).data.payload.producerRunId;
    engine.store.put(type,id,makeData({missionId:mission.id,runId}),{expectedVersion:0});
    assert.throws(()=>engine.registry.assertUsable(delivered.mission.finalArtifactId,
      {missionId:mission.id,purpose:'adaptive-v3-deterministic-closed-output'}),{code:directCode},type);
    assert.throws(()=>engine.status(mission.id),{code:directCode},type);
    assert.throws(()=>missionReport(engine.store,mission.id,{registry:engine.registry}),{code:directCode},type);
    const quarantined=await engine.run(mission.id);
    assert.equal(quarantined.mission.status,'UNVERIFIED',type);assert.equal(quarantined.outcome,null,type);
    assert.equal(quarantined.mission.deliveryIntegrity,'UNVERIFIED',type);
    const durable=engine.store.get('mission',mission.id).data;
    assert.equal(durable.status,'NEEDS_DIRECTION',type);assert.equal(durable.pending.at(-1).code,directCode,type);
  }
});

test('mutable policy drift cannot downgrade a signed direct route into a public planned completion',t=>{
  const {engine}=setup(t),mission=engine.create(literal('identity-utf8-v1','route is authoritative'),options),artifactId='artifact:policy-drift';
  const payload={missionId:mission.id,nodeId:'escape',producerRunId:'run:escape',kind:'ordinary',purpose:'escape',body:'FORGED_POLICY_DRIFT',
    claims:[],inputRefs:[],toolReceipts:[],requiredEffects:[],criteria:[{id:'escape',text:'forged'}],provisional:false};
  engine.store.put('artifact',artifactId,{id:artifactId,missionId:mission.id,payload,payloadHash:sha256(payload),status:'ACCEPTED',reviews:[],reviewDependencies:[],
    createdAt:'2026-09-19T00:00:00.000Z',invalidation:null},{expectedVersion:0});
  const original=engine.store.get('mission',mission.id);
  const drifted={...original.data,policy:{...original.data.policy,entryMode:'planned'},finalArtifactId:artifactId};
  engine.store.put('mission',mission.id,drifted,{expectedVersion:original.version});
  assert.throws(()=>engine.setStatus(mission.id,'COMPLETED'),{code:'ADAPTIVE_V3_ROUTE_INTEGRITY'});
  const current=engine.store.get('mission',mission.id);
  engine.store.put('mission',mission.id,{...current.data,status:'COMPLETED',updatedAt:'2026-09-19T00:01:00.000Z',
    history:[...current.data.history,{status:'COMPLETED',at:'2026-09-19T00:01:00.000Z'}]},{expectedVersion:current.version});
  // The engine remains a hard execution boundary, while read-only reporting
  // deliberately converts historical admission drift into a chronology-only
  // quarantine. Throwing here would make a corrupted record unreadable rather
  // than ensuring it cannot disclose the forged completion through a report.
  const quarantined=missionReport(engine.store,mission.id,{registry:engine.registry}),serialized=JSON.stringify(quarantined);
  assert.equal(quarantined.metrics.integrity,'UNVERIFIED');
  assert.equal(quarantined.mission.admissionIntegrity,'UNVERIFIED');
  assert.equal(quarantined.final,null);assert.ok(!serialized.includes('FORGED_POLICY_DRIFT'));
  assert.ok(quarantined.timeline.every(event=>event.kind==='RECORDED_EVENT'||event.kind==='record.committed'));
  const status=engine.status(mission.id),statusSerialized=JSON.stringify(status);
  assert.equal(status.integrity,'UNVERIFIED');assert.equal(status.mission.status,'UNVERIFIED');
  assert.equal(status.mission.admissionIntegrity,'UNVERIFIED');assert.equal(status.plan,null);assert.deepEqual(status.nodes,[]);
  assert.equal(status.outcome,null);assert.ok(!statusSerialized.includes('FORGED_POLICY_DRIFT'));
});

test('a restored direct-v3 head cannot erase a historical policy or mandate attack before dispatch',async t=>{
  const attacks=[
    {name:'policy',mutate:mission=>({...mission,policy:{...mission.policy,reasoningEffort:'ultra'}})},
    {name:'mandate',mutate:mission=>{
      const intent=literal('identity-utf8-v1','substituted before restoration');
      return {...mission,intent,intentHash:sha256(intent)};
    }}
  ];
  for(const attack of attacks){
    const {engine}=setup(t),mission=engine.create(literal('identity-utf8-v1',`historical ${attack.name}`),options),origin=engine.store.get('mission',mission.id);
    const changed=engine.store.put('mission',mission.id,attack.mutate(origin.data),{expectedVersion:origin.version});
    engine.store.put('mission',mission.id,{...changed.data,intent:origin.data.intent,intentHash:origin.data.intentHash,
      policy:origin.data.policy},{expectedVersion:changed.version});
    const halted=await engine.run(mission.id);
    assert.equal(halted.mission.status,'UNVERIFIED',attack.name);assert.equal(halted.outcome,null,attack.name);
    assert.equal(halted.mission.admissionIntegrity,'UNVERIFIED',attack.name);assert.deepEqual(halted.mission.pending,[],attack.name);
    const durable=engine.store.get('mission',mission.id).data;
    assert.equal(durable.status,'NEEDS_DIRECTION',attack.name);
    assert.equal(durable.pending.at(-1).code,'ADAPTIVE_V3_ROUTE_INTEGRITY',attack.name);
    assert.equal(engine.store.list('run').filter(record=>record.data.missionId===mission.id).length,0,attack.name);
    assert.equal(engine.store.list('artifact').filter(record=>record.data.missionId===mission.id).length,0,attack.name);
  }
});

test('a mission payload cannot detach from its durable key to hide a direct route or cancel delivery',async t=>{
  const {engine}=setup(t),mission=engine.create(literal('identity-utf8-v1','identity remains key-bound'),options);
  await engine.run(mission.id);
  const current=engine.store.get('mission',mission.id),policy={...current.data.policy,entryMode:'planned'};
  delete policy.routing;
  engine.store.put('mission',mission.id,{...current.data,id:'mission:detached-marker',policy},{expectedVersion:current.version});
  const before=engine.store.get('mission',mission.id);
  for(const read of [
    ()=>engine.status(mission.id),
    ()=>engine.setStatus(mission.id,'CANCELLED'),
    ()=>missionReport(engine.store,mission.id,{registry:engine.registry})
  ])assert.throws(read,{code:'MISSION_IDENTITY'});
  const after=engine.store.get('mission',mission.id);
  assert.equal(after.version,before.version);assert.deepEqual(after.data,before.data);
});

test('direct evidence rejects privileged broker residue and queue lifecycle mutators remain coordinator-private',async t=>{
  const {engine}=setup(t),mission=engine.create(literal('identity-utf8-v1','residue is not inert'),options);
  engine.store.put('tool-workspace',mission.id,{missionId:mission.id,path:'/untrusted',resource:`workspace:${mission.id}`},{expectedVersion:0});
  const halted=await engine.run(mission.id);
  assert.equal(halted.mission.status,'NEEDS_DIRECTION');assert.equal(halted.mission.pending.at(-1).code,directCode);
  assert.equal(engine.store.list('run').length,0);assert.equal(engine.store.list('artifact').length,0);

  const separate=setup(t).engine,queue=new MissionQueue({engine:separate});
  t.after(()=>{if(queue.owner)queue.release();});
  const job=queue.submit(literal('lowercase-ascii-v1','QUEUE'),options);
  assert.equal(typeof queue.update,'undefined');assert.equal(typeof queue.finish,'undefined');
  queue.acquire();const completed=await queue.runNext();queue.release();
  assert.equal(completed.status,'COMPLETED');assert.equal(separate.status(job.missionId).outcome.payload.body,'queue');
});
