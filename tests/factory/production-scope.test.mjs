import test from 'node:test';
import assert from 'node:assert/strict';
import {Store} from '../../factory/lib/store.mjs';
import {Authority} from '../../factory/lib/authority.mjs';
import {ArtifactRegistry} from '../../factory/lib/artifacts.mjs';
import {productionScope} from '../../factory/lib/production-scope.mjs';
import {sha256} from '../../factory/lib/contracts.mjs';
function fixture(t){
  const store=new Store(':memory:'),authority=new Authority(store),registry=new ArtifactRegistry(store,authority);t.after(()=>store.close());
  store.put('mission','m',{intentHash:sha256('intent')},{expectedVersion:0});
  const run=(nodeId,{mode='producer',artifactIds=[],missionId='m'}={})=>registry.registerRun({missionId,nodeId,mode,context:{purpose:nodeId,artifactIds,sourceIds:[],instructionsHash:sha256('instructions'),producerConversationIncluded:false}});
  const artifact=(r,kind='fixture')=>{
    registry.attachInference(r.id,{status:'completed',threadId:`thread-${r.id}`,turnId:`turn-${r.id}`,simulation:true});
    return registry.create({missionId:r.missionId,nodeId:r.nodeId,producerRunId:r.id,kind,purpose:r.context.purpose,body:'PRIVATE PRODUCT BODY NEVER DISCLOSED BY METADATA',criteria:[{id:'result',text:'Check result.'}]});
  };
  return {store,registry,run,artifact};
}
test('production scope binds exact candidate and earlier attempts, preserves contamination and excludes later exposure',t=>{
  const f=fixture(t),secret=f.artifact(f.run('design'),'decision-model'),prior=f.run('challenge',{artifactIds:[secret.id]});
  const actual=f.run('challenge'),candidate=f.artifact(actual,'counterexamples');
  const frozen=productionScope(f.registry,candidate.id);
  assert.deepEqual(frozen.attempts.map(a=>a.runId),[prior.id,actual.id]);
  assert.equal(frozen.attempts[0].contexts[0].artifacts[0].id,secret.id);
  assert.equal(frozen.attempts[0].contexts[0].artifacts[0].kind,'decision-model');
  assert.deepEqual(frozen.attempts[1].contexts[0].artifacts,[]);
  assert.equal(JSON.stringify(frozen).includes('PRIVATE PRODUCT BODY'),false);
  const after=f.store.get('run',actual.id).data;
  f.registry.updateContext(actual.id,{...after.context,artifactIds:[secret.id]});
  f.run('challenge',{artifactIds:[secret.id]});
  assert.deepEqual(productionScope(f.registry,candidate.id),frozen,'Later admissions/attempts cannot rewrite the old candidate history');
});
test('all historical admitted contexts and actual request identities remain visible before candidate creation',t=>{
  const f=fixture(t),secret=f.artifact(f.run('design'),'decision-model'),r=f.run('challenge');
  f.registry.recordInferenceRequest(r.id,{instructions:'i',input:'{}',schema:{type:'object'},model:'fixture',reasoningEffort:'high'});
  const pending=f.store.get('run',r.id).data.expectedRequestHash;
  f.registry.attachInference(r.id,{status:'completed',threadId:'first-thread',turnId:'first-turn',contextHash:pending,simulation:true});
  f.registry.updateContext(r.id,{...f.store.get('run',r.id).data.context,artifactIds:[secret.id]});
  const candidate=f.artifact(f.store.get('run',r.id).data,'counterexamples'),scope=productionScope(f.registry,candidate.id);
  assert.equal(scope.attempts.length,1);assert.equal(scope.attempts[0].contexts.length,2);
  assert.deepEqual(scope.attempts[0].contexts[0].artifacts,[]);
  assert.equal(scope.attempts[0].contexts[1].artifacts[0].id,secret.id);
  assert.equal(scope.attempts[0].requests[0].requestHash,pending);
  assert.equal(scope.attempts[0].completedInferences.length,2);
});
test('scope is authenticated reviewer evidence, separately keyed per exposed artifact and stable after downstream work',t=>{
  const f=fixture(t),a=f.artifact(f.run('a')),b=f.artifact(f.run('b'));
  const reviewer=f.run('review:delivery',{mode:'reviewer',artifactIds:[a.id,b.id]});
  const scopes=f.registry.captureRuntimeObservations(reviewer.id).filter(o=>o.kind==='artifact-production-scope');
  assert.equal(scopes.length,2);assert.deepEqual(f.registry.captureRuntimeObservations(reviewer.id),[]);
  const current=f.store.get('run',reviewer.id).data,o=scopes[0],proof={kind:'runtime',id:o.id,hash:o.hash,quote:o.quoteText};
  assert.equal(f.registry.runtimeReference(proof,current).detail.artifactId,a.id);
  f.run('later');f.store.put('effect','later-effect',{missionId:'m',principalId:'later',tool:'workspace.write',state:'PREPARED'},{expectedVersion:0});
  assert.equal(f.registry.runtimeReference(proof,current).detail.artifactId,a.id);
  const other=f.run('review:other',{mode:'reviewer',artifactIds:[a.id]});
  assert.throws(()=>f.registry.runtimeReference(proof,other),{code:'UNOBSERVED_RUNTIME'});
  assert.throws(()=>f.registry.runtimeReference({...proof,quote:'invented'},current),{code:'UNOBSERVED_RUNTIME'});
  assert.throws(()=>f.registry.runtimeReference(proof,{...current,context:{...current.context,artifactIds:[b.id]}}),{code:'UNOBSERVED_RUNTIME'});
  const own=f.registry.captureRuntimeObservations(f.run('producer',{artifactIds:[a.id]}).id);
  assert.ok(own.every(o=>o.kind!=='artifact-production-scope'),'Production does not gain an unaccepted draft admission history');
});
test('consumer history is limited to accepted admitted material inputs, without draft, sibling, planning or current-candidate scopes',t=>{
  const f=fixture(t);
  const accept=a=>{
    const reviewer=f.run('review:'+a.payload.nodeId,{mode:'reviewer',artifactIds:[a.id]});
    f.registry.attachInference(reviewer.id,{status:'completed',threadId:'review-thread-'+reviewer.id,turnId:'review-turn-'+reviewer.id,simulation:true});
    return f.registry.review({artifactId:a.id,reviewerRunId:reviewer.id,result:{artifactHash:a.payloadHash,purpose:a.payload.purpose,decision:'ACCEPT',
      checks:[{criterionId:'result',verdict:'PASS',reason:'Synthetic acceptance for an exposure-boundary test only.',evidence:[{kind:'artifact',id:a.id,hash:a.payloadHash,quote:a.payload.body}]}],findings:[],uncertainty:''}});
  };
  const a=accept(f.artifact(f.run('a'))),sibling=accept(f.artifact(f.run('sibling'))),draft=f.artifact(f.run('draft'));
  const plan=accept(f.artifact(f.run('planning'),'mission-plan')),consumer=f.run('consumer',{artifactIds:[a.id,draft.id,plan.id]});
  const scopes=f.registry.captureRuntimeObservations(consumer.id).filter(o=>o.kind==='artifact-production-scope');
  assert.equal(scopes.length,1);
  const current=f.store.get('run',consumer.id).data,o=scopes[0],proof={kind:'runtime',id:o.id,hash:o.hash,quote:o.quoteText};
  const detail=f.registry.runtimeReference(proof,current).detail;
  assert.equal(detail.artifactId,a.id);assert.equal(detail.artifactHash,a.payloadHash);
  for(const excluded of [sibling.id,draft.id,plan.id])assert.ok(!JSON.stringify(scopes).includes(excluded));
  assert.ok(!JSON.stringify(scopes).includes('PRIVATE PRODUCT BODY'));
  assert.ok(f.registry.captureRuntimeObservations(consumer.id).every(x=>x.kind!=='artifact-dependency-gates'));
  const other=f.run('other',{artifactIds:[a.id]});
  assert.throws(()=>f.registry.runtimeReference(proof,other),{code:'UNOBSERVED_RUNTIME'});
  assert.throws(()=>f.registry.runtimeReference(proof,{...current,context:{...current.context,artifactIds:[]}}),{code:'UNOBSERVED_RUNTIME'});
  const record=f.store.get('artifact',a.id);f.store.put('artifact',a.id,{...record.data,status:'INVALIDATED'},{expectedVersion:record.version});
  const later=f.run('later',{artifactIds:[a.id]});
  assert.ok(f.registry.captureRuntimeObservations(later.id).every(x=>x.kind!=='artifact-production-scope'),'Revocation cannot provide a new accepted input history');
});
test('foreign historical artifact admission and changed context hashes cannot be certified',t=>{
  const f=fixture(t),foreign=f.artifact(f.run('foreign',{missionId:'foreign'}));
  const r=f.run('challenge',{artifactIds:[foreign.id]}),a=f.artifact(r);
  assert.throws(()=>productionScope(f.registry,a.id),{code:'RUNTIME_INTEGRITY'});
  const other=f.run('other'),head=f.store.get('run',other.id);
  f.store.put('run',other.id,{...head.data,contextHash:sha256('wrong')},{expectedVersion:head.version});
  const b=f.artifact(f.store.get('run',other.id).data);
  assert.throws(()=>productionScope(f.registry,b.id),{code:'RUNTIME_INTEGRITY'});
});
test('replicator candidates expose their actual mode and earlier mixed attempts to a separate reviewer',t=>{
  const f=fixture(t),prior=f.run('replica'),replica=f.run('replica',{mode:'replicator'}),a=f.artifact(replica);
  const reviewer=f.run('review:replica',{mode:'reviewer',artifactIds:[a.id]});
  const observations=f.registry.captureRuntimeObservations(reviewer.id),o=observations.find(o=>o.kind==='artifact-production-scope');
  const current=f.store.get('run',reviewer.id).data,scope=f.registry.runtimeReference({kind:'runtime',id:o.id,hash:o.hash,quote:o.quoteText},current).detail;
  assert.deepEqual(scope.attempts.map(a=>[a.runId,a.mode]),[[prior.id,'producer'],[replica.id,'replicator']]);
  assert.deepEqual(scope.attempts[1].contexts[0].artifacts,[]);
  assert.ok(!JSON.stringify(scope).includes('PRIVATE PRODUCT BODY'));
  assert.ok(!Object.hasOwn(scope,'sealed'),'A replicator mode label is not an attested seal');
  f.run('replica',{mode:'replicator'});assert.deepEqual(productionScope(f.registry,a.id),scope);
});
test('node effect inventory cannot omit an intent just because its actor is a replicator',t=>{
  const f=fixture(t),r=f.run('replica',{mode:'replicator'});
  // Inject a recorded intent, not an authorized/executed command. The inventory
  // must reveal it, even though the closed adapter grants no tools or effects.
  f.store.put('effect','fixture-replica-effect',{missionId:'m',principalId:r.id,tool:'workspace.write',state:'PREPARED'},{expectedVersion:0});
  const inventory=f.registry.nodeEffectInventory('m','replica');
  assert.equal(inventory.fileWriteCount,1);assert.equal(inventory.effects[0].principalId,r.id);
  assert.ok(inventory.productionRunIds.includes(r.id));assert.deepEqual(inventory.replicationRunIds,[r.id]);
  assert.equal(f.registry.nodeEffectInventory('m','other').fileWriteCount,0);
});
