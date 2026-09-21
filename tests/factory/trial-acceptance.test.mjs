import test from 'node:test';
import assert from 'node:assert/strict';
import {allTrialNodesAccepted,acceptedFinalConsumesComparison,comparisonPreservesResiduals} from '../../reconstruction/verification/trial-acceptance.mjs';
import {sha256} from '../../factory/lib/contracts.mjs';

function fixture(){
  const criteria=[{id:'criterion',text:'Retain the exact supplied object.'}],payload={nodeId:'original',criteria,body:'62'};
  const artifact={id:'artifact:original',missionId:'mission:trial',status:'ACCEPTED',payload,payloadHash:sha256(payload)};
  return {artifact,report:{mission:{id:'mission:trial'},nodes:[{id:'original',artifactId:artifact.id,status:'ACCEPTED',criteria}]}};
}
test('inconclusive or unstarted nodes never look up a null artifact',()=>{
  const f=fixture();f.report.nodes.push({id:'replica',status:'RETURNED',artifactId:null,criteria:f.report.nodes[0].criteria});
  const seen=[];assert.equal(allTrialNodesAccepted(f.report,id=>{seen.push(id);assert.equal(typeof id,'string');return f.artifact;}),false);
  assert.deepEqual(seen,['artifact:original']);
  for(const status of ['PENDING','RUNNING','REVIEW_PENDING','INVALIDATED'])assert.equal(allTrialNodesAccepted({...f.report,nodes:[{status,artifactId:null}]},()=>{throw Error('Unexpected lookup');}),false);
});
test('no planned nodes is not vacuous trial acceptance',()=>{
  for(const report of [null,{}, {mission:{id:'mission:trial'},nodes:[]}])assert.equal(allTrialNodesAccepted(report,()=>{throw Error('Unexpected lookup');}),false);
});
test('accepted products require exact identity, mission, payload hash, node and criteria',()=>{
  const f=fixture();assert.equal(allTrialNodesAccepted(f.report,()=>f.artifact),true);
  for(const mutate of [a=>a.id='artifact:other',a=>a.missionId='mission:other',a=>a.status='RETURNED',a=>a.payloadHash='0'.repeat(64),
    a=>{a.payload.nodeId='other';a.payloadHash=sha256(a.payload);},a=>{a.payload.criteria=[];a.payloadHash=sha256(a.payload);},
    a=>{delete a.payload.criteria;a.payloadHash=sha256(a.payload);}]){
    const a=structuredClone(f.artifact);mutate(a);assert.equal(allTrialNodesAccepted(f.report,()=>a),false);
  }
  assert.equal(allTrialNodesAccepted(f.report,()=>null),false);
  delete f.report.nodes[0].id;assert.equal(allTrialNodesAccepted(f.report,()=>f.artifact),false);
});
test('storage corruption is not hidden as ordinary incomplete work',()=>{
  const f=fixture(),error=Object.assign(Error('Fixture corruption'),{code:'STORAGE_CORRUPTION'});
  assert.throws(()=>allTrialNodesAccepted(f.report,()=>{throw error;}),e=>e===error);
});

function finalFixture(converge=false){
  const criteria=[{id:'exact',text:'Inspect exact immutable comparison.'}],artifacts=new Map();
  const make=(id,purpose,inputRefs=[])=>{const payload={nodeId:id,purpose,criteria,inputRefs,body:'Synthetic report fixture'};
    const a={id:'artifact:'+id,missionId:'mission:trial',status:'ACCEPTED',payload,payloadHash:sha256(payload)};artifacts.set(a.id,a);return a;};
  const comparison=make('comparison','closed-blind-comparison');
  const final=converge?make('dossier','report',[{artifactId:comparison.id,hash:comparison.payloadHash,purpose:comparison.payload.purpose}]):comparison;
  const report={mission:{id:'mission:trial',status:'COMPLETED'},plan:{finalNodeId:final.payload.nodeId},final,
    nodes:[...artifacts.values()].map(a=>({id:a.payload.nodeId,artifactId:a.id,status:'ACCEPTED',criteria}))};
  return {comparison,final,report,artifacts,lookup:id=>artifacts.get(id)};
}
test('native final or exact accepted convergence is valid consumption, not restricted to one final artifact identity',()=>{
  for(const converge of [false,true]){const f=finalFixture(converge);assert.equal(acceptedFinalConsumesComparison(f.report,f.comparison,f.lookup),true);}
});
test('planned dependency alone, unrelated final, changed hash, revoked ancestor or final node cannot qualify consumption',()=>{
  for(const mutate of [f=>{f.final.payload.inputRefs=[];f.final.payloadHash=sha256(f.final.payload);},
    f=>{f.final.payload.inputRefs[0].hash='0'.repeat(64);f.final.payloadHash=sha256(f.final.payload);},
    f=>{f.comparison.status='RETURNED';},f=>{f.comparison.missionId='mission:alien';},
    f=>{f.report.plan.finalNodeId='absent';},f=>{f.report.mission.status='NEEDS_DIRECTION';},
    f=>{f.report.final={...f.final,payloadHash:'0'.repeat(64)};},
    f=>{f.final.payload.inputRefs[0].purpose='different';f.final.payloadHash=sha256(f.final.payload);}]){
    const f=finalFixture(true);mutate(f);assert.equal(acceptedFinalConsumesComparison(f.report,f.comparison,f.lookup),false);
  }
  const f=finalFixture();assert.equal(acceptedFinalConsumesComparison(f.report,null,f.lookup),false);
});
test('final consumption does not mask storage errors',()=>{
  const f=finalFixture(),error=Error('Read failure');assert.throws(()=>acceptedFinalConsumesComparison(f.report,f.comparison,()=>{throw error;}),e=>e===error);
});
test('faithful residuals preserve legitimate unknowns and failed controls without calling them successful replication',()=>{
  const sealed={status:'RESULT',result:'61',publicArgument:'Synthetic argument',controls:[{id:'a',verdict:'PASS',observation:'given'},
    {id:'b',verdict:'FAIL',observation:'reported failure'}],deviations:['recorded deviation'],unknowns:['Another actor approval is not visible here.']};
  const body={replica:structuredClone(sealed),comparison:{replicationEstablished:false,
    unresolvedControls:[sealed.controls[1]],deviations:[...sealed.deviations],unknowns:[...sealed.unknowns]}};
  assert.equal(comparisonPreservesResiduals(body,sealed),true);
  for(const mutate of [b=>b.replica.unknowns=[],b=>b.comparison.unknowns=[],b=>b.comparison.deviations=[],
    b=>b.comparison.unresolvedControls=[],b=>b.comparison.replicationEstablished=true,b=>b.replica.result='62']){
    const b=structuredClone(body);mutate(b);assert.equal(comparisonPreservesResiduals(b,sealed),false);
  }
  assert.equal(comparisonPreservesResiduals(null,sealed),false);assert.equal(comparisonPreservesResiduals(body,null),false);
});
