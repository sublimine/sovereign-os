import test from 'node:test';
import assert from 'node:assert/strict';
import {Store} from '../../factory/lib/store.mjs';
import {Authority} from '../../factory/lib/authority.mjs';
import {ArtifactRegistry} from '../../factory/lib/artifacts.mjs';
import {sha256} from '../../factory/lib/contracts.mjs';
function setup(t,{queued=true}={}){const store=new Store(':memory:'),authority=new Authority(store),registry=new ArtifactRegistry(store,authority);
  store.put('mission','m',{intentHash:sha256('intent')},{expectedVersion:0});
  if(queued){store.put('queue-job','m',{missionId:'m',status:'RUNNING',attempts:1},{expectedVersion:0});store.put('submission','submission:m',{missionId:'m',fingerprint:sha256('intent')},{expectedVersion:0});}
  const run=nodeId=>registry.registerRun({missionId:'m',nodeId,mode:'reviewer',context:{purpose:'p',artifactIds:[],sourceIds:[],instructionsHash:sha256('instructions'),producerConversationIncluded:false}});
  t.after(()=>store.close());return {store,registry,run};}
test('runtime queue history remains valid after job completion; exact version and observed run required',t=>{
  const f=setup(t),r=f.run('review:product');const observed=f.registry.captureRuntimeObservations(r.id),proof={...observed.find(o=>o.kind==='queue-history'),kind:'runtime',quote:'"status":"RUNNING"'};
  f.store.put('queue-job','m',{missionId:'m',status:'COMPLETED',attempts:1},{expectedVersion:1});
  assert.equal(f.registry.runtimeReference(proof,f.store.get('run',r.id).data).kind,'queue-history');
  assert.throws(()=>f.registry.runtimeReference(proof,f.run('review:other')),{code:'UNOBSERVED_RUNTIME'});
  assert.throws(()=>f.registry.runtimeReference({...proof,quote:'not observed'},f.store.get('run',r.id).data),{code:'UNOBSERVED_RUNTIME'});
});
test('runtime effect absence is invalidated by any later mission effect intent, including failed attempts',t=>{
  const f=setup(t),r=f.run('review:product'),observed=f.registry.captureRuntimeObservations(r.id),o=observed.find(o=>o.kind==='effect-inventory');
  const proof={kind:'runtime',id:o.id,hash:o.hash,quote:'"sourceFetchCount":0'},run=f.store.get('run',r.id).data;
  assert.equal(f.registry.runtimeReference(proof,run).detail.sourceFetchCount,0);
  f.store.put('effect','effect:one',{missionId:'m',tool:'source.fetch',state:'FAILED',principalId:'actor'},{expectedVersion:0});
  assert.throws(()=>f.registry.runtimeReference(proof,run),{code:'STALE_RUNTIME'});
});
test('runtime observation changes exposure; captured facts cannot be appended to an in-flight inference',t=>{
  const f=setup(t),r=f.run('review:product'),before=f.registry.exposureHash(r);f.registry.captureRuntimeObservations(r.id);
  const updated=f.store.get('run',r.id);assert.notEqual(before,f.registry.exposureHash(updated.data));
  f.store.put('run',r.id,{...updated.data,expectedRequestHash:'pending'},{expectedVersion:updated.version});
  assert.throws(()=>f.registry.captureRuntimeObservations(r.id),{code:'INFERENCE_PENDING'});
});
test('planning receives historical queue metadata, never a premature no-effects certificate',t=>{
  const f=setup(t),r=f.run('review:planning');assert.deepEqual(f.registry.captureRuntimeObservations(r.id).map(o=>o.kind),['queue-history']);
});
test('standalone missions expose real effect inventory without fabricating queue reception; planning exposes neither',t=>{
  const f=setup(t,{queued:false});
  assert.deepEqual(f.registry.captureRuntimeObservations(f.run('planning').id),[]);
  assert.deepEqual(f.registry.captureRuntimeObservations(f.run('review:planning').id),[]);
  const r=f.run('review:product'),observations=f.registry.captureRuntimeObservations(r.id);
  assert.deepEqual(observations.map(o=>o.kind),['effect-inventory','node-effect-inventory']);
  assert.equal(JSON.parse(observations[0].quoteText).detail.fileWriteCount,0);
  const before=f.registry.exposureHash(f.store.get('run',r.id).data);
  assert.deepEqual(f.registry.captureRuntimeObservations(r.id),[]);
  assert.equal(f.registry.exposureHash(f.store.get('run',r.id).data),before);
});
test('node-scoped absence survives another node effects but is invalidated by any effect from its own attempts',t=>{
  const f=setup(t,{queued:false}),first=f.run('review:analysis');
  const observed=f.registry.captureRuntimeObservations(first.id),o=observed.find(o=>o.kind==='node-effect-inventory');
  const proof={kind:'runtime',id:o.id,hash:o.hash,quote:'"fileWriteCount":0'},run=f.store.get('run',first.id).data;
  assert.equal(f.registry.runtimeReference(proof,run).detail.nodeId,'analysis');
  const other=f.run('review:delivery');f.store.put('effect','other:write',{missionId:'m',tool:'workspace.write',state:'FAILED',principalId:other.id},{expectedVersion:0});
  assert.equal(f.registry.runtimeReference(proof,run).detail.fileWriteCount,0);
  const retry=f.run('review:analysis');f.store.put('effect','analysis:attempt',{missionId:'m',tool:'execution.run',state:'PREPARED',principalId:retry.id},{expectedVersion:0});
  assert.throws(()=>f.registry.runtimeReference(proof,run),{code:'STALE_RUNTIME'});
});
test('consumer receives separately keyed histories of its exposed prerequisites, never other mission nodes',t=>{
  const f=setup(t,{queued:false}),reviewer=f.run('review:delivery');
  f.store.put('artifact','artifact:prior',{missionId:'m',payload:{nodeId:'analysis'}},{expectedVersion:0});
  const r=f.store.get('run',reviewer.id);f.store.put('run',reviewer.id,{...r.data,context:{...r.data.context,artifactIds:['artifact:prior']}},{expectedVersion:r.version});
  const histories=f.registry.captureRuntimeObservations(reviewer.id).filter(o=>o.kind==='node-effect-inventory').map(o=>JSON.parse(o.quoteText).detail.nodeId);
  assert.deepEqual(histories,['analysis','delivery']);assert.deepEqual(f.registry.captureRuntimeObservations(reviewer.id),[]);
  f.store.put('artifact','artifact:foreign',{missionId:'another',payload:{nodeId:'secret'}},{expectedVersion:0});
  const next=f.store.get('run',reviewer.id);f.store.put('run',reviewer.id,{...next.data,context:{...next.data.context,artifactIds:['artifact:foreign']}},{expectedVersion:next.version});
  assert.throws(()=>f.registry.captureRuntimeObservations(reviewer.id),{code:'RUNTIME_INTEGRITY'});
});
test('node names containing review prefix do not impersonate another node reviewer',t=>{
  const f=setup(t,{queued:false});
  f.store.put('run','prefix-producer',{id:'prefix-producer',missionId:'m',nodeId:'review:analysis',mode:'producer',context:{artifactIds:[]}},{expectedVersion:0});
  f.store.put('effect','prefix-effect',{missionId:'m',tool:'workspace.write',state:'PREPARED',principalId:'prefix-producer'},{expectedVersion:0});
  assert.equal(f.registry.nodeEffectInventory('m','analysis').effects.length,0);
  assert.equal(f.registry.nodeEffectInventory('m','review:analysis').effects.length,1);
  assert.deepEqual(f.registry.exposedNodeIds(f.store.get('run','prefix-producer').data),['review:analysis']);
});
test('workspace history retains PREPARED and uncertain intents; completed records missing receipts cannot be certified',t=>{
  const f=setup(t,{queued:false}),r=f.run('review:product');
  f.store.put('effect','other:secret',{missionId:'other',tool:'workspace.write',state:'SUCCEEDED',principalId:'other:actor'},{expectedVersion:0});
  f.store.put('effect','operation:pending',{missionId:'m',tool:'workspace.write',state:'PREPARED',principalId:'actor'},{expectedVersion:0});
  const observed=f.registry.captureRuntimeObservations(r.id).find(o=>o.kind==='workspace-history');
  const effects=JSON.parse(observed.quoteText).detail.effects;
  assert.equal(effects.length,1);assert.equal(effects[0].state,'PREPARED');assert.equal(effects[0].recordedResult,null);
  f.store.put('effect','operation:pending',{missionId:'m',tool:'workspace.write',state:'UNCERTAIN',principalId:'actor'},{expectedVersion:1});
  assert.equal(f.registry.workspaceHistory('m')[0].state,'UNCERTAIN');
  f.store.put('effect','operation:pending',{missionId:'m',tool:'workspace.write',state:'SUCCEEDED',principalId:'actor'},{expectedVersion:2});
  assert.throws(()=>f.registry.captureRuntimeObservations(r.id),{code:'TOOL_RECEIPT'});
});
