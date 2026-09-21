import test from 'node:test';
import assert from 'node:assert/strict';
import {inputCopyTrialAcceptance} from '../../reconstruction/verification/input-copy-trial-acceptance.mjs';
const criteria=[{id:'exact',text:'Keep the complete literal object.',evaluation:'content'}];
function report(){return {mission:{id:'m',status:'COMPLETED',finalArtifactId:'a'},
  plan:{nodes:[{id:'n',execution:{kind:'literal-input-copy-v1'},outputKind:'literal-input-copy',roleIds:[],specialist:null,dependencies:[],tools:[],requiredEffects:[],criteria}],
    finalNodeId:'n',requirements:[{id:'r',criteria}]},nodes:[{id:'n',status:'ACCEPTED',artifactId:'a'}],
  final:{id:'a',status:'ACCEPTED',payload:{missionId:'m',nodeId:'n',kind:'literal-input-copy',body:'🧭e\u0301\r\n  ',claims:[],toolReceipts:[],requiredEffects:[],criteria,provisional:false}}};}
const pass=r=>Object.values(inputCopyTrialAcceptance(r,'🧭e\u0301\r\n  ')).every(v=>v===true);
test('native trial predicate requires whole literal bytes and accepted native final, not a status label',()=>{
  assert.equal(pass(report()),true);
  for(const mutate of [r=>r.mission.status='RUNNING',r=>r.mission.finalArtifactId='other',r=>r.final.status='CANDIDATE',
    r=>r.final.payload.body=r.final.payload.body.normalize('NFC'),r=>r.final.payload.body=r.final.payload.body.trim(),
    r=>r.final.payload.nodeId='other',r=>r.final.payload.missionId='foreign',r=>r.final.payload.kind='delivery',
    r=>r.nodes[0].status='RETURNED',r=>r.nodes[0].artifactId='other',r=>r.plan.nodes[0].roleIds=['omega_02'],
    r=>r.plan.nodes[0].execution=null,r=>r.plan.nodes.push({...r.plan.nodes[0],id:'extra'}),
    r=>r.final.payload.claims=[{kind:'fact'}],r=>r.final.payload.requiredEffects=[{type:'file'}],
    r=>r.final.payload.toolReceipts=[{}],r=>r.final.payload.provisional=true,
    r=>r.plan.requirements=[],r=>r.plan.requirements[0].criteria=[],r=>r.final.payload.criteria=[],
    r=>{delete r.final;delete r.nodes[0].artifactId;},r=>delete r.plan.nodes[0].criteria]){
    const changed=structuredClone(report());mutate(changed);assert.equal(pass(changed),false);
  }
  for(const empty of [null,{}, {plan:{nodes:[]}}, {final:{}}])assert.equal(pass(empty),false);
});
