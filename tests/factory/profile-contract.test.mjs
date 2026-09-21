import test from 'node:test';
import assert from 'node:assert/strict';
import {instructionProfile,inferenceRequestHash} from '../../factory/providers/instruction-profiles.mjs';
import {PROFILE_CASES} from '../../reconstruction/verification/profile-cases.mjs';
import {Store} from '../../factory/lib/store.mjs';
import {Authority} from '../../factory/lib/authority.mjs';
import {ArtifactRegistry} from '../../factory/lib/artifacts.mjs';
import {sha256} from '../../factory/lib/contracts.mjs';
test('qualification oracles obey their own exact sorted unique issue contract',()=>{
  for(const c of PROFILE_CASES)assert.deepEqual(c.expected.issues,[...new Set(c.expected.issues)].sort());
});
test('provider profile ID and exact base bytes are immutable, default retains legacy hash',()=>{
  const req={instructions:'task',input:'data',schema:{type:'object'},model:'gpt-6-astra',reasoningEffort:'ultra'};
  assert.equal(inferenceRequestHash(req),sha256(JSON.stringify(req)));
  assert.notEqual(inferenceRequestHash(req),inferenceRequestHash({...req,instructionProfile:'scoped-v1'}));
  const profile=instructionProfile('scoped-v1');profile.baseInstructions='changed';assert.notEqual(instructionProfile('scoped-v1').baseInstructions,'changed');
  assert.throws(()=>instructionProfile('unknown'),{code:'PROVIDER_PROFILE'});
});
test('a default-profile inference receipt cannot fulfill a scoped-profile request',()=>{
  const store=new Store(':memory:');try{
    const registry=new ArtifactRegistry(store,new Authority(store));
    const run=registry.registerRun({missionId:'m',nodeId:'n',mode:'producer',context:{purpose:'p',artifactIds:[],sourceIds:[],instructionsHash:sha256('task'),producerConversationIncluded:false}});
    const req={instructions:'task',input:'data',schema:{type:'object'},model:'gpt-6-astra',reasoningEffort:'ultra'};
    registry.recordInferenceRequest(run.id,{...req,instructionProfile:'scoped-v1'});
    assert.throws(()=>registry.attachInference(run.id,{status:'completed',threadId:'t',turnId:'turn',contextHash:inferenceRequestHash(req)}),{code:'INFERENCE_CONTEXT'});
    registry.attachInference(run.id,{status:'completed',threadId:'t',turnId:'turn',contextHash:inferenceRequestHash({...req,instructionProfile:'scoped-v1'})});
  }finally{store.close();}
});
