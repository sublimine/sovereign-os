import test from 'node:test';
import assert from 'node:assert/strict';
import {Store} from '../../factory/lib/store.mjs';
import {Authority} from '../../factory/lib/authority.mjs';
import {LearningService} from '../../factory/lib/learning-service.mjs';
import {validateLearningProvenance,verifyLearningProvenance} from '../../factory/lib/learning-provenance.mjs';
import {admitLearningProvenanceFixtureSource,learningProvenanceFixturePolicy,signedLearningProvenanceFixture} from './fixtures/learning-provenance.mjs';

const scope={roleIds:['sigma_01'],purpose:'learning-provenance-fixture',mode:'producer'};
const dataset={missionId:'learning-provenance-fixture',evaluatorId:'fixture-evaluator',policy:{requireImprovement:true},cases:[
  {id:'training',input:{taskInstructions:'Fixture only.',input:'{}',schema:{type:'object'},model:'gpt-6-astra',reasoningEffort:'ultra'},expected:{answer:'fixture-training'},required:true,holdout:false,criteria:[{metric:'accuracy',direction:'higher',threshold:1}]},
  {id:'holdout',input:{taskInstructions:'Fixture only.',input:'{}',schema:{type:'object'},model:'gpt-6-astra',reasoningEffort:'ultra'},expected:{answer:'fixture-holdout'},required:true,holdout:true,criteria:[{metric:'accuracy',direction:'higher',threshold:1}]},
]};

function setup(t){
  const store=new Store(':memory:'),authority=new Authority(store),service=new LearningService({store,authority,provenancePolicy:learningProvenanceFixturePolicy});
  const source=admitLearningProvenanceFixtureSource(store,{missionId:dataset.missionId}),request={domainId:'learning-provenance-fixture',roleId:'sigma_01',scope,datasetSpec:structuredClone(dataset)};
  const provenance=signedLearningProvenanceFixture({...request,service,source});
  t.after(()=>store.close());return {store,authority,service,source,request,provenance};
}

test('trusted dual attestation binds every frozen expected without asserting truth',t=>{
  const f=setup(t),prepared=f.service.prepareDomain(f.request);
  const verified=verifyLearningProvenance({store:f.store,policy:learningProvenanceFixturePolicy,provenance:f.provenance,expectedBinding:prepared.provenanceBinding,
    missionId:f.request.datasetSpec.missionId});
  assert.equal(verified.provenanceStatus,'VERIFIED_CUSTODY_AND_REVIEW');
  assert.equal(verified.caseCount,2);assert.equal(verified.sourceRefCount,2);
  assert.match(verified.provenance.limitations,/does not establish factual truth/i);
  assert.equal(Object.hasOwn(verified,'truthCertified'),false);
});

test('any changed expected binding, duplicate signer identity, or untrusted role fails before registration',t=>{
  const f=setup(t),prepared=f.service.prepareDomain(f.request);
  const changed=structuredClone(f.provenance);changed.binding.cases[0].expectedHash='0'.repeat(64);
  assert.throws(()=>validateLearningProvenance({provenance:changed,expectedBinding:prepared.provenanceBinding}),{code:'LEARNING_PROVENANCE_BINDING'});
  const duplicate=structuredClone(f.provenance);duplicate.attestations[1].keyId=duplicate.attestations[0].keyId;
  assert.throws(()=>validateLearningProvenance({provenance:duplicate,expectedBinding:prepared.provenanceBinding}),{code:'LEARNING_PROVENANCE_INDEPENDENCE'});
  const wrongRole={...learningProvenanceFixturePolicy,keys:learningProvenanceFixturePolicy.keys.map(key=>key.keyId==='fixture-reviewer'?{...key,roles:['labeler']}:key)};
  assert.throws(()=>verifyLearningProvenance({store:f.store,policy:wrongRole,provenance:f.provenance,expectedBinding:prepared.provenanceBinding,
    missionId:f.request.datasetSpec.missionId}),{code:'LEARNING_PROVENANCE_POLICY'});
  const sameKeyUnderTwoIds={...learningProvenanceFixturePolicy,keys:[learningProvenanceFixturePolicy.keys[0],{...learningProvenanceFixturePolicy.keys[1],publicKey:learningProvenanceFixturePolicy.keys[0].publicKey}]};
  assert.throws(()=>verifyLearningProvenance({store:f.store,policy:sameKeyUnderTwoIds,provenance:f.provenance,expectedBinding:prepared.provenanceBinding,
    missionId:f.request.datasetSpec.missionId}),{code:'LEARNING_PROVENANCE_INDEPENDENCE'});
});

test('an attested source from another mission cannot qualify an activatable learning domain',t=>{
  const f=setup(t),request={...f.request,domainId:'learning-provenance-cross-mission',datasetSpec:{...f.request.datasetSpec,missionId:'other-mission'}};
  const provenance=signedLearningProvenanceFixture({...request,service:f.service,source:f.source});
  assert.throws(()=>f.service.registerDomain({...request,provenance}),{code:'LEARNING_PROVENANCE_SOURCE'});
  assert.equal(f.store.list('learning-domain').length,0);
});

test('a different runtime provenance policy identity cannot reinterpret an attested domain even with identical keys',t=>{
  const f=setup(t),domain=f.service.registerDomain({...f.request,provenance:f.provenance}),before=f.store.verifyJournal();
  const differentIdentity={...learningProvenanceFixturePolicy,policyId:'fixture-learning-provenance-policy-replaced'};
  const resumed=new LearningService({store:f.store,authority:f.authority,provenancePolicy:differentIdentity});
  assert.throws(()=>resumed.compilation(domain.policyId),{code:'LEARNING_PROVENANCE_POLICY'});
  assert.deepEqual(f.store.verifyJournal(),before);
});

test('source retraction or byte substitution blocks use even after an attested domain was persisted',t=>{
  const f=setup(t),domain=f.service.registerDomain({...f.request,provenance:f.provenance});
  assert.equal(f.store.db.prepare('PRAGMA user_version').get().user_version,12);
  assert.equal(f.service.compilation(domain.policyId).domain.schema,'sovereign.learning-domain.v2');
  const stored=f.store.get('source',f.source.id);f.store.put('source',f.source.id,{...stored.data,status:'RETRACTED',revokedAt:'2026-09-19T00:01:00.000Z'},{expectedVersion:stored.version});
  assert.throws(()=>f.service.compilation(domain.policyId),{code:'LEARNING_PROVENANCE_SOURCE'});

  const g=setup(t),substituted=g.service.registerDomain({...g.request,provenance:g.provenance});
  const original=g.store.get('source',g.source.id);g.store.put('source',g.source.id,{...original.data,raw:original.data.raw+'\nTampered bytes retaining the quoted passage.'},{expectedVersion:original.version});
  assert.throws(()=>g.service.compilation(substituted.policyId),{code:'LEARNING_PROVENANCE_SOURCE'});
});

test('a source whose stored bytes no longer match its claimed digest cannot activate a domain',t=>{
  const f=setup(t),source=f.store.get('source',f.source.id);
  f.store.put('source',f.source.id,{...source.data,raw:source.data.raw+'\nInjected suffix.'},{expectedVersion:source.version});
  assert.throws(()=>f.service.registerDomain({...f.request,provenance:f.provenance}),{code:'LEARNING_PROVENANCE_SOURCE'});
  assert.equal(f.store.get('learning-domain',f.service.prepareDomain(f.request).policyId),null);
  assert.equal(f.store.list('learning-provenance').length,0);
});

test('an activatable domain cannot omit provenance, while an explicit evaluation-only experiment can',t=>{
  const f=setup(t);
  assert.throws(()=>f.service.registerDomain(f.request),{code:'LEARNING_PROVENANCE_REQUIRED'});
  const experimental={...f.request,domainId:'learning-provenance-experimental',datasetSpec:{...f.request.datasetSpec,policy:{...f.request.datasetSpec.policy,activation:'evaluation-only'}}};
  assert.equal(f.service.registerDomain(experimental).domainId,'learning-provenance-experimental');
});

test('the legacy service baseline route cannot bypass an attested activatable domain',t=>{
  const f=setup(t),before=f.store.verifyJournal();
  assert.throws(()=>f.service.registerBaseline({roleId:'sigma_01',scope,datasetSpec:structuredClone(dataset)}),{code:'LEARNING_PROVENANCE_REQUIRED'});
  assert.deepEqual(f.store.verifyJournal(),before);assert.equal(f.store.list('learning-role').length,0);
});
