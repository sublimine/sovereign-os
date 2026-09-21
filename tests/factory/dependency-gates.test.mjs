import test from 'node:test';
import assert from 'node:assert/strict';
import {Store} from '../../factory/lib/store.mjs';
import {Authority} from '../../factory/lib/authority.mjs';
import {ArtifactRegistry} from '../../factory/lib/artifacts.mjs';
import {dependencyGates} from '../../factory/lib/dependency-gates.mjs';
import {sha256} from '../../factory/lib/contracts.mjs';

function fixture(t){
  const store=new Store(':memory:'),authority=new Authority(store),registry=new ArtifactRegistry(store,authority);t.after(()=>store.close());
  store.put('mission','m',{intentHash:sha256('request')},{expectedVersion:0});
  const run=(nodeId,artifactIds=[],mode='producer')=>{
    const r=registry.registerRun({missionId:'m',nodeId,mode,context:{purpose:'answer',artifactIds,sourceIds:[],instructionsHash:sha256('fixture'),producerConversationIncluded:false}});
    registry.attachInference(r.id,{status:'completed',threadId:'thread-'+r.id,turnId:'turn-'+r.id,simulation:true});return store.get('run',r.id).data;
  };
  const input=a=>({artifactId:a.id,hash:a.payloadHash,purpose:a.payload.purpose});
  const create=(nodeId,parents=[],producer=null)=>{
    producer??=run(nodeId,parents.map(a=>a.id));
    return registry.create({missionId:'m',nodeId,producerRunId:producer.id,kind:'answer',purpose:'answer',body:'PRIVATE ARTIFACT BODY',inputRefs:parents.map(input),criteria:[{id:'correct',text:'Substantive fixture criterion.'}]});
  };
  const accept=a=>{
    const reviewer=run('review:'+a.payload.nodeId,[a.id],'reviewer');
    return registry.review({artifactId:a.id,reviewerRunId:reviewer.id,result:{artifactHash:a.payloadHash,purpose:a.payload.purpose,decision:'ACCEPT',checks:[{criterionId:'correct',verdict:'PASS',reason:'Synthetic substantive check, not real model expertise.',evidence:[{kind:'artifact',id:a.id,hash:a.payloadHash,quote:a.payload.body}]}],findings:[],uncertainty:''}});
  };
  return {store,authority,registry,run,input,create,accept};
}
test('historical gates expose exact earlier decisions, checks and reviewer completion, not bodies or self-acceptance',t=>{
  const f=fixture(t),a=f.accept(f.create('a')),b=f.accept(f.create('b')),c=f.create('c',[a,b]);
  const scope=dependencyGates(f.registry,c.id);
  assert.equal(scope.dependencies.length,2);
  for(const d of scope.dependencies){
    assert.equal(d.acceptedBeforeFirstAttempt,true);assert.ok(d.acceptanceSequence<scope.firstProducerSequence);
    assert.ok(d.review.committedSequence<d.acceptanceSequence);
    assert.equal(d.review.completePassingChecks,true);assert.equal(d.review.separateCompletedReviewerExposure,true);
    assert.equal(d.review.checks[0].criterionId,'correct');assert.equal(d.review.criteria[0].text,'Substantive fixture criterion.');
  }
  assert(!JSON.stringify(scope).includes('PRIVATE ARTIFACT BODY'));
  assert(scope.dependencies.every(d=>d.input.artifactId!==c.id));
  f.accept(c);f.run('c');assert.deepEqual(dependencyGates(f.registry,c.id),scope);
});
test('late acceptance cannot be backdated, including a prior failed attempt before dependency creation',t=>{
  const f=fixture(t),a=f.create('a'),early=f.run('c',[a.id]);f.accept(a);
  const later=f.run('c',[a.id]),c=f.create('c',[a],later),scope=dependencyGates(f.registry,c.id);
  assert.equal(scope.firstProducerRunId,early.id);assert.equal(scope.dependencies[0].acceptedBeforeFirstAttempt,false);
  assert.equal(scope.dependencies[0].statusBeforeFirstAttempt,'CANDIDATE');assert.equal(scope.dependencies[0].review,null);
  const before=f.run('d'),b=f.accept(f.create('b')),d=f.create('d',[b]);
  const absent=dependencyGates(f.registry,d.id);assert.equal(absent.firstProducerRunId,before.id);
  assert.equal(absent.dependencies[0].artifactRecord,null);assert.equal(absent.dependencies[0].acceptedBeforeFirstAttempt,false);
});
test('gates are scoped authenticated observations; revoked current input fails while its history stays intact',t=>{
  const f=fixture(t),a=f.accept(f.create('a')),c=f.create('c',[a]),r=f.run('review:c',[c.id,a.id],'reviewer');
  const observed=f.registry.captureRuntimeObservations(r.id).find(o=>o.kind==='artifact-dependency-gates');assert.ok(observed);
  assert.deepEqual(f.registry.captureRuntimeObservations(r.id),[]);
  const current=f.store.get('run',r.id).data,proof={kind:'runtime',id:observed.id,hash:observed.hash,quote:observed.quoteText};
  const historical=f.registry.runtimeReference(proof,current).detail;
  assert.equal(historical.dependencies[0].acceptedBeforeFirstAttempt,true);
  assert.throws(()=>f.registry.runtimeReference({...proof,quote:'made-up quotation'},current),{code:'UNOBSERVED_RUNTIME'});
  assert.throws(()=>f.registry.runtimeReference(proof,f.run('review:other',[c.id],'reviewer')),{code:'UNOBSERVED_RUNTIME'});
  assert.throws(()=>f.registry.runtimeReference(proof,{...current,context:{...current.context,artifactIds:[a.id]}}),{code:'UNOBSERVED_RUNTIME'});
  const record=f.store.get('artifact',a.id);f.store.put('artifact',a.id,{...record.data,status:'INVALIDATED'},{expectedVersion:record.version});
  assert.deepEqual(dependencyGates(f.registry,c.id),historical);
  assert.throws(()=>f.registry.runtimeReference(proof,current),{code:'UNACCEPTED_INPUT'});
  assert.deepEqual(f.registry.runtimeReference(proof,current,{current:false}).detail,historical);
});
test('production cannot acquire reviewer gate inventory or arbitrary sibling metadata',t=>{
  const f=fixture(t),a=f.accept(f.create('a')),sibling=f.accept(f.create('sibling')),c=f.create('c',[a]);
  const scope=dependencyGates(f.registry,c.id);assert(scope.dependencies.every(d=>d.input.artifactId!==sibling.id));
  const r=f.run('producer',[c.id]);assert(f.registry.captureRuntimeObservations(r.id).every(o=>o.kind!=='artifact-dependency-gates'));
});
test('replicator dependencies use the earliest material attempt, not a later mode switch',t=>{
  const f=fixture(t),early=f.run('replica',[],'replicator'),a=f.accept(f.create('a'));
  const later=f.run('replica',[a.id]),candidate=f.create('replica',[a],later);
  const gates=dependencyGates(f.registry,candidate.id);
  assert.equal(gates.firstProducerRunId,early.id);assert.equal(gates.firstProducerMode,'replicator');
  assert.equal(gates.dependencies[0].acceptedBeforeFirstAttempt,false);
  const valid=f.run('separate',[a.id],'replicator'),replica=f.create('separate',[a],valid);
  const accepted=dependencyGates(f.registry,replica.id);
  assert.equal(accepted.firstProducerMode,'replicator');assert.equal(accepted.dependencies[0].acceptedBeforeFirstAttempt,true);
  const reviewer=f.run('review:separate',[replica.id],'reviewer');
  const observation=f.registry.captureRuntimeObservations(reviewer.id).find(o=>o.kind==='artifact-dependency-gates');
  assert.ok(observation);assert.equal(f.registry.runtimeReference({kind:'runtime',id:observation.id,hash:observation.hash,quote:observation.quoteText},f.store.get('run',reviewer.id).data).detail.artifactId,replica.id);
});
