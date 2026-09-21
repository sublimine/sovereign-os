import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readdirSync,readFileSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {FactoryEngine} from '../../factory/lib/engine.mjs';
import {resolveMissionPreset,MISSION_PRESETS} from '../../factory/lib/mission-presets.mjs';
import {sha256} from '../../factory/lib/contracts.mjs';
import {readSourceContextView} from '../../factory/lib/source-context-view.mjs';
import {inferenceRequestHash} from '../../factory/providers/instruction-profiles.mjs';
import {compactCatalogReview} from '../../factory/lib/review-codec.mjs';
import {getRole} from '../../factory/catalog/index.mjs';
import {planningInspectionBudget} from '../../factory/lib/planning-inspection-budget.mjs';
import {missionInferenceBudget} from '../../factory/lib/mission-inference-budget.mjs';
import {producerToolBudget} from '../../factory/lib/producer-tool-budget.mjs';
import {methodRecoveryPlan,methodRecoveryIntent} from './fixtures/method-recovery-model.mjs';
import {auditRouteLineage} from '../../reconstruction/verification/full-route-audit.mjs';

function setup(t,respond=null){
  const root=mkdtempSync(join(tmpdir(),'adaptive-integration-'));
  const engine=new FactoryEngine({databasePath:join(root,'state.sqlite'),workspaceRoot:join(root,'workspaces')});
  let calls=0;const captures=[];engine.workers.providerFactory=()=>({async generate(request){
    calls++;assert.ok(respond,'Policy checks must not infer');
    const exposure=readSourceContextView(request.input),task=JSON.parse(exposure.task);
    const type=request.schema.properties.plan?'planning-control':request.schema.properties.artifactHash?'review':request.schema.properties.action.enum.includes('answer')?'entry':'produce';
    captures.push({type,exposure,task});const value=await respond({type,exposure,task,request,engine});
    await request.validate(value);return {value,receipt:{kind:'inference',simulation:true,status:'completed',threadId:'sim-adaptive-'+calls,turnId:'sim-adaptive-turn-'+calls,
      model:request.model,reasoningEffort:request.reasoningEffort,contextHash:inferenceRequestHash(request)}};
  },async close(){return {processExitObserved:true};}});
  let closed=false;const close=()=>{if(!closed){engine.close();closed=true;}};
  t.after(()=>{close();rmSync(root,{recursive:true,force:true});});
  return {engine,root,captures,close,get calls(){return calls;}};
}

// SIM model judgments only. Runtime, SQLite, real workspace operations and
// independent reviewer observations are exercised; no claim of semantic skill.
function review({exposure,task},{fail=false}={}){
  const a=exposure.artifacts.find(a=>a.id===task.candidateId);
  const evidence=[{kind:'artifact',id:a.id,hash:a.hash,quote:a.payload.body},
    ...exposure.toolObservations.filter(o=>o.relation==='OWN_ACTION'&&o.status==='SUCCEEDED'&&['workspace.read','workspace.list'].includes(o.tool))
      .map(o=>({kind:'tool',id:o.id,hash:o.hash,quote:o.quoteText}))];
  const value={artifactHash:a.hash,purpose:a.payload.purpose,decision:fail?'RETURN':'ACCEPT',
    checks:task.criteria.map(c=>({criterionId:c.id,verdict:fail?'FAIL':'PASS',evidence,reason:fail?'The second term 4 was omitted.':'SIM independent control response.'})),
    findings:fail?[{severity:'material',description:'The second term 4 is absent from the computed answer.',recovery:'Enumerate both terms before summing.'}]:[],uncertainty:'SIM fixture, not live semantic qualification'};
  return compactCatalogReview(value,task.observedEvidenceCatalog);
}
function planning(task,plan){
  if(!task.inspectedRoleContracts)return {action:'inspect',roleIds:['omega_02','omega_03'],reason:'Read the full producer and judge methods before assignment.',plan:null};
  assert.deepEqual(task.inspectedRoleContracts.cards,['omega_02','omega_03'].map(getRole));
  return {action:'plan',roleIds:[],reason:'',plan};
}
const final=body=>({action:'final',tool:'',argsJson:'',body,claims:[],method:'direct-fixture',reason:''});
async function completedReentry(s,missionId){
  const before=s.calls,original=s.engine.status(missionId),policy=original.mission.policy;
  s.close();const reopened=new FactoryEngine({databasePath:join(s.root,'state.sqlite'),workspaceRoot:join(s.root,'workspaces')});
  reopened.workers.providerFactory=()=>{throw Error('Completed mission must not infer again');};
  try{const again=await reopened.run(missionId);assert.equal(again.outcome.id,original.outcome.id);assert.deepEqual(again.mission.policy,policy);
    assert.equal(s.calls,before);reopened.store.verifyJournal();}finally{reopened.close();}
}
test('adaptive v2 composes named mechanisms without changing v1, model, authority or concurrency',()=>{
  const old=resolveMissionPreset({preset:'adaptive-v1'}),v2=resolveMissionPreset({preset:'adaptive-v2'});
  assert.deepEqual(old.options,{instructionProfile:'scoped-v1',contextEncoding:'lossless-json-v2',reviewEncoding:'evidence-catalog-v1',entryMode:'closed-response-v1'});
  assert.deepEqual(v2.options,{instructionProfile:'scoped-v1',contextEncoding:'lossless-json-v2',reviewEncoding:'evidence-catalog-v1',entryMode:'closed-response-v2',
    cardEncoding:'compact-json-v1',producerContext:'node-contract-v1',planningContracts:{mode:'on-demand-v1',maxCalls:12},
    producerBatch:'read-test-cursor-v1',methodRecovery:{mode:'reviewed-method-v1',maxRounds:1}});
  assert.equal(v2.selection.definitionHash,sha256(MISSION_PRESETS['adaptive-v2']));
  for(const key of ['model','reasoningEffort','allowedTools','maxParallelPureNodes','inferenceBudget','documentContext'])assert.equal(v2.options[key],undefined);
});
test('adaptive v2 deeply freezes definitions while explicit options and returned copies stay independent',()=>{
  const options={preset:'adaptive-v2',entryMode:'planned',planningContracts:{mode:'on-demand-v1',maxCalls:2},
    producerBatch:'read-test-v1',methodRecovery:{mode:'reviewed-method-v1',maxRounds:3},allowedTools:[]};
  const selected=resolveMissionPreset(options);
  assert.deepEqual(selected.options.planningContracts,options.planningContracts);
  assert.equal(selected.options.producerBatch,'read-test-v1');assert.equal(selected.options.entryMode,'planned');
  assert.deepEqual(selected.selection.explicitOverrides,['allowedTools','entryMode','methodRecovery','planningContracts','producerBatch']);
  assert.throws(()=>{MISSION_PRESETS['adaptive-v2'].planningContracts.maxCalls=99;},TypeError);
  assert.throws(()=>{MISSION_PRESETS['adaptive-v2'].methodRecovery.maxRounds=99;},TypeError);
  selected.selection.definition.planningContracts.maxCalls=99;
  const next=resolveMissionPreset({preset:'adaptive-v2'});next.options.methodRecovery.maxRounds=88;
  assert.equal(MISSION_PRESETS['adaptive-v2'].planningContracts.maxCalls,12);
  assert.equal(MISSION_PRESETS['adaptive-v2'].methodRecovery.maxRounds,1);
});
for(const preset of [undefined,'adaptive-v1','adaptive-v2'])test('documentary/cursor conflict fails before durable mission or workspace: '+preset,t=>{
  const s=setup(t),before=s.engine.store.verifyJournal(),files=readdirSync(join(s.root,'workspaces'));
  const options={...(preset?{preset}:{}),documentContext:'literal-windows-v1',producerBatch:'read-test-cursor-v1'};
  assert.throws(()=>s.engine.create('Keep exact incompatible options visible.',options),{code:'POLICY_CONFLICT'});
  assert.equal(s.engine.store.list('mission').length,0);assert.equal(s.engine.store.list('run').length,0);
  assert.deepEqual(s.engine.store.verifyJournal(),before);assert.deepEqual(readdirSync(join(s.root,'workspaces')),files);assert.equal(s.calls,0);
});
test('adaptive v2 stores the expanded exact selection once and preserves explicit authority and ceilings',t=>{
  const s=setup(t),m=s.engine.create('Preserve this complete request.',{preset:'adaptive-v2',allowedTools:[],maxPlanAttempts:1,maxNodeAttempts:1,
    inferenceBudget:{mode:'mission-calls-v1',maxCalls:5}});
  assert.equal(m.policySelection.presetId,'adaptive-v2');assert.equal(m.policySelection.effectivePolicyHash,sha256(m.policy));
  assert.equal(m.policy.producerBatch,'read-test-cursor-v1');assert.equal(m.policy.entryMode,'closed-response-v2');
  assert.equal(m.policy.planningContracts.maxCalls,12);assert.equal(m.policy.methodRecovery.maxRounds,1);
  assert.equal(m.policy.maxNodeAttempts,1);assert.equal(m.policy.inferenceBudget.maxCalls,5);assert.deepEqual(m.policy.allowedTools,[]);
  assert.equal(m.policy.maxParallelPureNodes,undefined);assert.equal(s.calls,0);
});
test('adaptive v2 REAL engine / SIM models: closed request has separate acceptance and no ceremonial planner',async t=>{
  const s=setup(t,context=>context.type==='entry'?{action:'answer',body:'(12 + 7 + 5) / 3 = 8.',reason:'All premises are supplied arithmetic.'}:review(context));
  const m=s.engine.create('Calcula la media de 12, 7 y 5 sin ejecutar código ni crear archivos.',{preset:'adaptive-v2',allowedTools:[],inferenceBudget:{mode:'mission-calls-v1',maxCalls:2}});
  const result=await s.engine.run(m.id);assert.equal(result.mission.status,'COMPLETED',JSON.stringify(result.mission.pending));
  assert.equal(result.plan,null);assert.equal(result.outcome.payload.body,'(12 + 7 + 5) / 3 = 8.');assert.equal(s.calls,2);
  assert.deepEqual(s.captures.map(c=>c.type),['entry','review']);assert.equal(missionInferenceBudget(s.engine.registry,m.id).reserved,2);
  for(const type of ['planning-inspection-response','producer-tool-budget','producer-batch-cursor','effect','method-recovery-round'])assert.equal(s.engine.store.list(type).length,0,type);
  const configs=s.engine.store.list('worker-config');assert.equal(configs.length,2);
  assert.ok(configs.some(c=>c.data.controllerContract));assert.ok(configs.some(c=>c.data.compilationScope.controllerReview==='closed-response-v2'));
  await completedReentry(s,m.id);
});
test('adaptive v2 does not replenish the mission ceiling after entry and retained planning inspection',async t=>{
  const s=setup(t,({type,task})=>type==='entry'?{action:'plan',body:'',reason:'Full planning is required for the requested material product.'}:planning(task,methodRecoveryPlan()));
  const m=s.engine.create(methodRecoveryIntent,{preset:'adaptive-v2',allowedTools:[],inferenceBudget:{mode:'mission-calls-v1',maxCalls:2}});
  const result=await s.engine.run(m.id);assert.equal(result.mission.status,'NEEDS_DIRECTION');assert.equal(s.calls,2);
  assert.equal(result.mission.pending[0].code,'INFERENCE_BUDGET_EXHAUSTED');assert.equal(s.engine.store.list('artifact').length,0);
  const response=s.engine.store.list('planning-inspection-response');assert.equal(response.length,1);
  assert.equal(planningInspectionBudget(s.engine.registry,m.id).reserved,1);assert.equal(missionInferenceBudget(s.engine.registry,m.id).remaining,0);
  s.close();const reopened=new FactoryEngine({databasePath:join(s.root,'state.sqlite'),workspaceRoot:join(s.root,'workspaces')});
  reopened.workers.providerFactory=()=>{throw Error('No free planning dispatch on reopening');};
  try{const again=await reopened.run(m.id);assert.equal(again.mission.pending[0].code,'INFERENCE_BUDGET_EXHAUSTED');
    assert.deepEqual(again.mission.policy,m.policy);assert.deepEqual(reopened.store.list('planning-inspection-response'),response);
    assert.equal(missionInferenceBudget(reopened.registry,m.id).reserved,2);assert.equal(planningInspectionBudget(reopened.registry,m.id).reserved,1);
    assert.equal(reopened.store.list('method-recovery-round').length,0);assert.equal(reopened.store.list('artifact').length,0);
  }finally{reopened.close();}
});
test('adaptive v2 REAL engine / SIM models: material route inspects full cards, writes, uses cursor and receives its own current-file review',async t=>{
  const intent='Create result.txt containing 13 and verify its exact bytes independently.';
  const plan=methodRecoveryPlan();plan.requirements[0]={id:'r1',text:intent,requestQuote:intent,criteria:[{id:'file',text:intent}]};
  const n=plan.nodes[0];n.instructions=intent;n.criteria=[];n.tools=['workspace.write','workspace.read','workspace.list'];
  n.requiredEffects=[{type:'file',path:'result.txt',command:'',expectedExit:null}];
  const s=setup(t,context=>{
    const {type,task}=context;if(type==='entry')return {action:'plan',body:'',reason:'A file delivery requires the material path.'};
    if(type==='planning-control')return planning(task,plan);if(type==='review')return review(context);
    if(task.step===0)return {...final(''),action:'tool',tool:'workspace.write',argsJson:JSON.stringify({path:'result.txt',content:'13',expectedHash:null})};
    if(task.step===1)return {...final(''),action:'batch',argsJson:JSON.stringify([{tool:'workspace.list',args:{path:'.'}},{tool:'workspace.read',args:{path:'result.txt'}}])};
    return final('Observed result.txt contains exactly 13. Independent acceptance remains pending.');
  });
  const m=s.engine.create(intent,{preset:'adaptive-v2',allowedTools:n.tools,maxNodeAttempts:1,inferenceBudget:{mode:'mission-calls-v1',maxCalls:8}});
  const result=await s.engine.run(m.id);assert.equal(result.mission.status,'COMPLETED',JSON.stringify({pending:result.mission.pending,
    calls:s.captures.map(c=>({type:c.type,step:c.task.step,feedback:c.task.feedback,corrections:c.task.corrections,planningFeedback:c.task.planningContractFeedback})),nodes:result.nodes}));assert.equal(s.calls,8);
  assert.equal(readFileSync(join(s.engine.broker.registerWorkspace(m.id).path,'result.txt'),'utf8'),'13');
  assert.equal(planningInspectionBudget(s.engine.registry,m.id).reserved,2);assert.equal(missionInferenceBudget(s.engine.registry,m.id).reserved,8);
  const actor=s.engine.store.list('run').find(r=>r.data.nodeId==='deliver'),config=s.engine.store.get('worker-config',actor.id).data;
  assert.equal(config.compilationScope.producerBatch,'read-test-cursor-v1');assert.equal(config.compilationScope.producerContext,'node-contract-v1');
  assert.equal(config.compilationScope.cardEncoding,'compact-json-v1');assert.equal(config.learnedInstructionVersions.length,0);
  assert.equal(producerToolBudget(s.engine.registry,actor.id).used,3);
  const cursor=s.engine.store.list('producer-batch-cursor');assert.equal(cursor.length,1);assert.equal(cursor[0].data.status,'COMPLETED');
  assert.equal(s.engine.store.list('effect').filter(e=>e.data.tool==='workspace.write').length,1);
  const own=s.engine.store.list('run').find(r=>r.data.nodeId==='review:deliver');assert.notEqual(actor.id,own.id);
  assert.ok(own.data.toolObservations.some(o=>o.signedReceipt.data.tool==='workspace.read'&&o.principalId===own.id));
  assert.ok(own.data.toolObservations.some(o=>o.signedReceipt.data.tool==='workspace.list'&&o.principalId===own.id));
  assert.equal(auditRouteLineage(s.engine,m.id).length,2);await completedReentry(s,m.id);
});
test('adaptive v2 REAL engine / SIM models: material rejection changes method after independent plan review with original budgets retained',async t=>{
  const s=setup(t,context=>{
    const {type,task,exposure}=context;if(type==='entry')return {action:'plan',body:'',reason:'Use the complete material method test path.'};
    if(type==='planning-control'){
      const p=task.previousPlan?structuredClone(task.previousPlan):methodRecoveryPlan();
      if(task.previousPlan){p.nodes[0].instructions+=' Recompute each original term separately and reconcile their sum.';
        p.nodes[0].method={id:'term-reconstruction',rationale:'The rejected direct synthesis omitted the second term; explicitly enumerate both before summing.',alternatives:['Rejected direct synthesis']};}
      return planning(task,p);
    }
    if(type==='review'){const a=exposure.artifacts.find(a=>a.id===task.candidateId);return review(context,{fail:a.payload.purpose==='deliver'&&a.payload.body==='9'});}
    return final(task.node.instructions.includes('Recompute each original term')?'13':'9');
  });
  const m=s.engine.create(methodRecoveryIntent,{preset:'adaptive-v2',allowedTools:[],maxNodeAttempts:1,inferenceBudget:{mode:'mission-calls-v1',maxCalls:16}});
  const result=await s.engine.run(m.id);assert.equal(result.mission.status,'COMPLETED',JSON.stringify(result.mission.pending));
  assert.equal(result.outcome.payload.body,'13');assert.deepEqual(result.mission.policy,m.policy);
  assert.equal(s.engine.store.list('method-recovery-round').length,1);assert.equal(s.engine.store.list('method-recovery-completion').length,1);
  const deliveredNode=s.engine.store.get('node',`${m.id}:deliver`).data;
  assert.equal(deliveredNode.history.filter(h=>h.status==='RETURNED').length,1);
  const failure=s.engine.store.list('method-recovery-round')[0].data.failures[0];
  assert.equal(failure.artifact.status,'RETURNED');assert.equal(failure.artifact.payload.body,'9');
  assert.deepEqual(s.engine.store.get(failure.artifactRecord.type,failure.artifactRecord.id,failure.artifactRecord.version).data,failure.artifact);
  assert.equal(s.engine.store.list('worker-production').length,2);assert.equal(s.engine.store.list('producer-tool-budget').length,2);
  assert.equal(missionInferenceBudget(s.engine.registry,m.id).reserved,s.calls);assert.ok(s.calls<=16);
  assert.equal(planningInspectionBudget(s.engine.registry,m.id).reserved,4);
  assert.equal(auditRouteLineage(s.engine,m.id).length,2);await completedReentry(s,m.id);
});
