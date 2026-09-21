import test from 'node:test';
import assert from 'node:assert/strict';
import {Store} from '../../factory/lib/store.mjs';
import {Authority} from '../../factory/lib/authority.mjs';
import {ArtifactRegistry} from '../../factory/lib/artifacts.mjs';
import {dependencyGates} from '../../factory/lib/dependency-gates.mjs';
import {dependencyInferences} from '../../factory/lib/dependency-inferences.mjs';
import {BLIND_REVIEW_OBSERVATIONS} from '../../factory/lib/blind-material.mjs';
import {canonical,sha256} from '../../factory/lib/contracts.mjs';

// Every receipt below is a unit-test fixture, including simulation:false values
// used to test classification. No model, subscription or external call is made.
function fixture(t){
  const store=new Store(':memory:'),registry=new ArtifactRegistry(store,new Authority(store));t.after(()=>store.close());
  store.put('mission','m',{intentHash:sha256('request')},{expectedVersion:0});let serial=0;
  const register=(nodeId,artifactIds=[],mode='producer')=>registry.registerRun({missionId:'m',nodeId,mode,
    context:{purpose:'answer',artifactIds,sourceIds:[],instructionsHash:sha256('PRIVATE INSTRUCTIONS'),producerConversationIncluded:false}});
  const infer=(run,simulation=true,{bound=true}={})=>{
    const contextHash=bound?registry.recordInferenceRequest(run.id,{instructions:'PRIVATE INSTRUCTIONS',input:'PRIVATE SOURCE',schema:{type:'object'}}):null;
    registry.attachInference(run.id,{status:'completed',threadId:'thread-'+(++serial),turnId:'turn-'+serial,
      ...(simulation==='missing'?{}:{simulation}),...(bound?{contextHash}:{})});return store.get('run',run.id).data;
  };
  const run=(nodeId,artifactIds=[],mode='producer',simulation=true)=>infer(register(nodeId,artifactIds,mode),simulation);
  const create=(nodeId,parents=[],producer=null,kind='answer')=>registry.create({missionId:'m',nodeId,
    producerRunId:(producer??run(nodeId,parents.map(a=>a.id))).id,kind,purpose:'answer',body:'PRIVATE ARTIFACT BODY',
    inputRefs:parents.map(a=>({artifactId:a.id,hash:a.payloadHash,purpose:a.payload.purpose})),criteria:[{id:'correct',text:'Fixture criterion'}]});
  const accept=(a,reviewer=null)=>registry.review({artifactId:a.id,reviewerRunId:(reviewer??run('review:'+a.payload.nodeId,[a.id],'reviewer')).id,
    result:{artifactHash:a.payloadHash,purpose:a.payload.purpose,decision:'ACCEPT',checks:[{criterionId:'correct',verdict:'PASS',
      reason:'Fixture check with no origin label.',evidence:[{kind:'artifact',id:a.id,hash:a.payloadHash,quote:a.payload.body}]}],findings:[],uncertainty:''}});
  const observe=c=>{
    const reviewer=register('review:'+c.payload.nodeId,[c.id],'reviewer');
    const observation=registry.captureRuntimeObservations(reviewer.id).find(o=>o.kind==='artifact-dependency-inferences');
    const actor=store.get('run',reviewer.id).data,proof={kind:'runtime',id:observation.id,hash:observation.hash,quote:observation.quoteText};
    return {observation,actor,proof,detail:registry.runtimeReference(proof,actor).detail};
  };
  return {store,registry,register,infer,run,create,accept,observe};
}
test('provenance reports simulation separately from unchanged historical passing gates',t=>{
  const f=fixture(t),a=f.accept(f.create('a')),c=f.create('c',[a]),gates=dependencyGates(f.registry,c.id);
  const detail=dependencyInferences(f.registry,c.id),d=detail.dependencies[0];
  assert.equal(d.acceptedBeforeFirstAttempt,true);assert.equal(d.producer.origin,'SIMULATED');assert.equal(d.reviewer.origin,'SIMULATED');
  assert.equal(d.recordedRealReviewedGate,false);assert.equal(d.productionAndReviewRecordedReal,false);
  assert.deepEqual(dependencyGates(f.registry,c.id),gates);
  for(const privateText of ['PRIVATE INSTRUCTIONS','PRIVATE SOURCE','PRIVATE ARTIFACT BODY','Fixture check'])assert(!canonical(detail).includes(privateText));
});
test('explicit false with completed matching dispatch is classified as recorded real, not provider attestation',t=>{
  const f=fixture(t),a=f.create('a',[],f.run('a',[],'producer',false));
  f.accept(a,f.run('review:a',[a.id],'reviewer',false));const d=dependencyInferences(f.registry,f.create('c',[a]).id).dependencies[0];
  assert.equal(d.producer.origin,'REAL');assert.equal(d.reviewer.origin,'REAL');assert.equal(d.recordedRealReviewedGate,true);
  assert.equal(d.productionAndReviewRecordedReal,true);assert(d.producer.receipts.every(r=>r.completed&&r.requestRecorded));
});
for(const simulation of ['missing',null,'false',0])test(`missing/non-boolean simulation ${JSON.stringify(simulation)} stays UNKNOWN`,t=>{
  const f=fixture(t),a=f.create('a');f.accept(a,f.run('review:a',[a.id],'reviewer',simulation));
  const d=dependencyInferences(f.registry,f.create('c',[a]).id).dependencies[0];
  assert.equal(d.reviewer.origin,'UNKNOWN');assert.equal(d.recordedRealReviewedGate,false);
});
test('unbound legacy false receipt is visible but cannot qualify a recorded-real reviewed gate',t=>{
  const f=fixture(t),a=f.create('a'),reviewer=f.infer(f.register('review:a',[a.id],'reviewer'),false,{bound:false});
  f.accept(a,reviewer);const d=dependencyInferences(f.registry,f.create('c',[a]).id).dependencies[0];
  assert.equal(d.reviewer.origin,'REAL');assert.equal(d.reviewer.receipts[0].requestRecorded,false);assert.equal(d.recordedRealReviewedGate,false);
});
test('mixed run includes all prior receipts; latest false cannot erase earlier simulation',t=>{
  const f=fixture(t),a=f.create('a'),reviewer=f.run('review:a',[a.id],'reviewer',true);f.infer(reviewer,false);f.accept(a,reviewer);
  const d=dependencyInferences(f.registry,f.create('c',[a]).id).dependencies[0];
  assert.equal(d.reviewer.origin,'MIXED');assert.deepEqual(d.reviewer.receipts.map(r=>r.origin),['SIMULATED','REAL']);
  assert.equal(d.recordedRealReviewedGate,false);
});
test('no producer receipt is NONE, never silently upgraded into native or real origin',t=>{
  const f=fixture(t),a=f.create('a',[],f.register('a'),'deterministic-result');f.accept(a,f.run('review:a',[a.id],'reviewer',false));
  const d=dependencyInferences(f.registry,f.create('c',[a]).id).dependencies[0];
  assert.equal(d.producer.origin,'NONE');assert.equal(d.recordedRealReviewedGate,true);assert.equal(d.productionAndReviewRecordedReal,false);
});
test('later producer and reviewer calls do not alter original historical provenance',t=>{
  const f=fixture(t),a=f.create('a'),reviewer=f.run('review:a',[a.id],'reviewer');f.accept(a,reviewer);
  const c=f.create('c',[a]),before=dependencyInferences(f.registry,c.id);
  f.infer(f.store.get('run',a.payload.producerRunId).data,false);f.infer(reviewer,false);
  assert.deepEqual(dependencyInferences(f.registry,c.id),before);
});
test('gate cutoff is first material attempt, not later acceptance or a producer mode switch',t=>{
  const f=fixture(t),early=f.register('c',[],'replicator'),a=f.accept(f.create('a')),c=f.create('c',[a]);
  const detail=dependencyInferences(f.registry,c.id),d=detail.dependencies[0];
  assert.equal(detail.firstProducerRecord.id,early.id);assert.equal(d.artifactRecord,null);assert.equal(d.producer,null);
  assert.equal(d.reviewer,null);assert.equal(d.acceptedBeforeFirstAttempt,false);assert.equal(d.recordedRealReviewedGate,false);
});
test('authenticated observation is scoped, deduplicated and preserves current revocation enforcement',t=>{
  const f=fixture(t),a=f.accept(f.create('a')),sibling=f.accept(f.create('sibling')),c=f.create('c',[a]);
  const {actor,proof,detail}=f.observe(c);assert.deepEqual(f.registry.captureRuntimeObservations(actor.id),[]);
  assert.equal(detail.dependencies.length,1);assert(!canonical(detail).includes(sibling.id));
  assert.throws(()=>f.registry.runtimeReference({...proof,quote:'invented'},actor),{code:'UNOBSERVED_RUNTIME'});
  assert.throws(()=>f.registry.runtimeReference(proof,{...actor,mode:'producer'}),{code:'UNOBSERVED_RUNTIME'});
  assert.throws(()=>f.registry.runtimeReference(proof,{...actor,context:{...actor.context,artifactIds:[]}}),{code:'UNOBSERVED_RUNTIME'});
  const record=f.store.get('artifact',a.id);f.store.put('artifact',a.id,{...record.data,status:'INVALIDATED'},{expectedVersion:record.version});
  assert.throws(()=>f.registry.runtimeReference(proof,actor),{code:'UNACCEPTED_INPUT'});
  assert.deepEqual(f.registry.runtimeReference(proof,actor,{current:false}).detail,detail);
});
test('even a freshly signed altered classification fails exact historical recomputation',t=>{
  const f=fixture(t),a=f.accept(f.create('a')),c=f.create('c',[a]),{actor,observation}=f.observe(c);
  const data=JSON.parse(observation.quoteText);data.id='runtime-observation:altered';data.detail.dependencies[0].reviewer.origin='REAL';
  const signed=f.registry.authority.seal('runtime.observation',data);f.store.put('runtime-observation',data.id,{signed},{expectedVersion:0});
  const replacement={id:data.id,kind:data.kind,hash:sha256(signed),quoteText:canonical(data)};
  const altered={...actor,runtimeObservations:[...actor.runtimeObservations,replacement]};
  assert.throws(()=>f.registry.runtimeReference({...replacement,quote:replacement.quoteText},altered),{code:'RUNTIME_INTEGRITY'});
});
test('provenance is excluded from producer and closed blind-review exposure',t=>{
  const f=fixture(t),a=f.accept(f.create('a')),c=f.accept(f.create('c',[a])),consumer=f.register('consumer',[c.id]);
  assert(f.registry.captureRuntimeObservations(consumer.id).every(o=>o.kind!=='artifact-dependency-inferences'));
  assert(!BLIND_REVIEW_OBSERVATIONS.includes('artifact-dependency-inferences'));
});
