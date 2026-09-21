import test from 'node:test';import assert from 'node:assert/strict';
import {nativeInputTrialAcceptance,independentlySelectedBody} from '../../reconstruction/verification/native-input-trial-acceptance.mjs';
import {sha256} from '../../factory/lib/contracts.mjs';
const expected='🧭e\u0301\r\n\\n  ',before='Real:\n<obj>',after='</obj>\nDistractor:',request='Mention <obj> and </obj> here.\n'+before+expected+after+' OTHER';
const criteria=[{id:'exact',text:'Keep the complete literal object.'},{id:'input-copy-selection',text:'Check intended selection.'},{id:'input-copy-fidelity',text:'Check fidelity, not truth.'}];
function report(kind){const execution=kind==='literal-input-span-v1'?{kind,before,after}:{kind,requestQuote:before+expected+after,copyText:expected};
  const payload={missionId:'m',nodeId:'n',kind:'literal-input-copy',body:expected,claims:[],toolReceipts:[],requiredEffects:[],criteria,inputRefs:[{artifactId:'plan-a',hash:'a'.repeat(64),purpose:'plan'}],provisional:false};
  const review=(id,hash,actor)=>({artifactId:id,reviewerRunId:actor,result:{artifactHash:hash,decision:'ACCEPT',checks:[{verdict:'PASS'}],findings:[]}});
  return {mission:{id:'m',status:'COMPLETED',intent:request,intentHash:sha256(request),finalArtifactId:'a'},
    plan:{nodes:[{id:'n',execution,outputKind:'literal-input-copy',roleIds:[],specialist:null,dependencies:[],tools:[],requiredEffects:[],criteria}],
      finalNodeId:'n',requirements:[{id:'r',criteria}]},nodes:[{id:'n',status:'ACCEPTED',artifactId:'a',execution}],
    final:{id:'a',status:'ACCEPTED',payload,payloadHash:sha256(payload)},reviews:[review('plan-a','a'.repeat(64),'plan-judge'),review('a',sha256(payload),'final-judge')]};}
const pass=r=>Object.values(nativeInputTrialAcceptance(r,{request,expected})).every(v=>v===true);
for(const kind of ['literal-input-copy-v1','literal-input-span-v1'])test(`independent native trial predicate accepts ${kind} only with source, product and both reviews`,()=>{
  assert.equal(pass(report(kind)),true);
  for(const mutate of [r=>r.mission.status='RUNNING',r=>r.mission.intent+='x',r=>r.mission.intentHash='0'.repeat(64),r=>r.mission.finalArtifactId='other',
    r=>r.final.status='CANDIDATE',r=>r.final.payload.body=expected.normalize('NFC'),r=>r.final.payload.body=expected.trim(),r=>r.final.payloadHash='0'.repeat(64),
    r=>r.nodes[0].execution={kind:'literal-input-span-v1',before:'unknown',after},r=>r.plan.nodes[0].roleIds=['sigma_01'],r=>r.plan.nodes[0].specialist={},
    r=>r.plan.nodes[0].execution={kind:'unrecognized'},r=>r.plan.nodes.push({...r.plan.nodes[0],id:'extra'}),r=>r.plan.nodes[0].dependencies=['other'],
    r=>r.final.payload.claims=[{kind:'fact'}],r=>r.final.payload.requiredEffects=[{type:'file'}],r=>r.final.payload.toolReceipts=[{}],r=>r.final.payload.provisional=true,
    r=>r.plan.requirements=[],r=>r.plan.requirements[0].criteria=[],r=>r.final.payload.criteria=[],r=>r.reviews=[],r=>r.reviews[1].reviewerRunId='plan-judge',
    r=>r.reviews[0].result.decision='RETURN',r=>r.reviews[1].result.checks[0].verdict='UNKNOWN',r=>r.reviews[1].result.findings=[{severity:'material'}],
    r=>r.reviews[0].result.artifactHash='foreign',r=>r.final.payload.inputRefs=[],r=>{delete r.final;},r=>delete r.plan.nodes[0].criteria]){
    const r=structuredClone(report(kind));mutate(r);assert.equal(pass(r),false);
  }
  for(const empty of [null,{}, {plan:{nodes:[]}}, {final:{}}])assert.equal(pass(empty),false);
});
test('independent oracle distinguishes actual newlines, literal backslashes, repeated markers and source ordering',()=>{
  assert.equal(independentlySelectedBody(request,{kind:'literal-input-span-v1',before,after}),expected);
  for(const execution of [{kind:'literal-input-span-v1',before:'<obj>',after:'</obj>'},{kind:'literal-input-span-v1',before:before.replace('\n','\\n'),after},
    {kind:'literal-input-span-v1',before:after,after:before},{kind:'literal-input-span-v1',before:'',after},{kind:'literal-input-span-v1',before,after,offset:0},
    {kind:'literal-input-copy-v1',requestQuote:before+expected+after,copyText:expected.normalize('NFC')},null])assert.equal(independentlySelectedBody(request,execution),null);
});
