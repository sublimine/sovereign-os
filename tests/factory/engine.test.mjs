import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {Store} from '../../factory/lib/store.mjs';
import {Authority} from '../../factory/lib/authority.mjs';
import {ArtifactRegistry} from '../../factory/lib/artifacts.mjs';
import {WorkerService} from '../../factory/lib/workers.mjs';
import {FactoryEngine} from '../../factory/lib/engine.mjs';
import {ToolBroker} from '../../factory/tools/broker.mjs';
import {MissionQueue} from '../../factory/lib/queue.mjs';
import {sha256} from '../../factory/lib/contracts.mjs';
import {MISSION_DIRECTION_SCHEMA} from '../../factory/lib/mission-direction.mjs';
import {compactReviewEvidence,compactCatalogReview} from '../../factory/lib/review-codec.mjs';
import {CLOSED_ENTRY_MODE,CLOSED_ENTRY_CRITERIA} from '../../factory/lib/closed-entry.mjs';
import {missionReport,formatMissionReport} from '../../factory/lib/report.mjs';
import {readSourceContextView} from '../../factory/lib/source-context-view.mjs';
import {inferenceRequestHash} from '../../factory/providers/instruction-profiles.mjs';
import {productionScope} from '../../factory/lib/production-scope.mjs';
import {producerPlanView} from '../../factory/lib/producer-plan-view.mjs';
import {getRole} from '../../factory/catalog/index.mjs';
import {reviewEvidenceBoundary} from '../../factory/lib/review-evidence-boundary.mjs';
import {PLANNING_RESPONSE_RETENTION,readPlanningResponse} from '../../factory/lib/planning-response.mjs';
import * as planningResponses from '../../factory/lib/planning-response.mjs';
import {planningInspectionBudget,reservePlanningInspection} from '../../factory/lib/planning-inspection-budget.mjs';
import {PLANNING_INSPECTION_RETENTION,readPlanningInspectionMessage} from '../../factory/lib/planning-inspection-response.mjs';
import {runPlanningInspection} from '../../factory/lib/planning-inspection.mjs';
import {missionInferenceBudget} from '../../factory/lib/mission-inference-budget.mjs';
import {PLAN_SCHEMA} from '../../factory/lib/plans.mjs';
import {PLANNING_MESSAGE_SCHEMA} from '../../factory/lib/planning-inspection-contract.mjs';
import {composeLearningRequest} from '../../factory/lib/learning-service.mjs';
import {admitLearningProvenanceFixtureSource,learningProvenanceFixturePolicy,signedLearningProvenanceFixture} from './fixtures/learning-provenance.mjs';

// Provider responses and public-network transport are SIMULATED. SQLite,
// WorkerService, registry, signed broker receipts and filesystem are REAL.
const tool=(name,args)=>({action:'tool',tool:name,argsJson:JSON.stringify(args),body:'',claims:[],method:'scoped-observation',reason:'Acquire requested observation'});
const final=(body='Synthetic fixture result',claims=[])=>({action:'final',tool:'',argsJson:'',body,claims,method:'observed-delivery',reason:'Return observed product for separate review'});
function makePlan(intent,{tools=[],two=false,requiredEffects=[]}={}){
  const node=(id,deps=[])=>({id,title:id,purpose:id,roleIds:['omega_02'],reviewerRoleIds:['omega_03'],requirementIds:['r1'],dependencies:deps,
    method:{id:'direct',rationale:'Concrete requested product',alternatives:['Independent reconstruction']},instructions:intent,outputKind:'delivery',criteria:[{id:'result',text:intent}],tools,requiredEffects,specialist:null});
  return {requirements:[{id:'r1',text:intent,requestQuote:intent,criteria:[{id:'result',text:intent}]}],nodes:two?[node('build'),node('deliver',[{nodeId:'build',purpose:'build',reason:'Compose from observed product'}])]:[node('deliver')],finalNodeId:'deliver',routingRationale:'Synthetic bounded case routing, not universal agent count'};
}
function forkPlan(intent){
  const p=makePlan(intent,{two:true}),b=structuredClone(p.nodes[0]);
  b.id='challenge';b.title='challenge';b.purpose='challenge';
  p.nodes.splice(1,0,b);p.nodes[2].dependencies.push({nodeId:'challenge',purpose:'challenge',reason:'Independent material challenge before integration'});
  return p;
}
function review(exposure,task,{decision='ACCEPT',reason='Observed fixture satisfies criterion',artifactOnly=false}={}){
  const a=exposure.artifacts.find(a=>a.id===task.candidateId);
  const reads=exposure.toolObservations.filter(o=>o.tool==='workspace.read'&&o.relation==='OWN_ACTION'&&o.status==='SUCCEEDED');
  const evidence=[{kind:'artifact',id:a.id,hash:a.hash,quote:a.payload.body},...exposure.sources.map(s=>({kind:'source',id:s.id,hash:s.hash,quote:s.raw}))];
  if(!artifactOnly)evidence.push(...reads.map(o=>({kind:'tool',id:o.id,hash:o.hash,quote:o.quoteText})));
  return {artifactHash:a.hash,purpose:a.payload.purpose,decision,checks:task.criteria.map(c=>({criterionId:c.id,verdict:decision==='ACCEPT'?'PASS':'FAIL',evidence,reason})),findings:decision==='ACCEPT'?[]:[{severity:'material',description:reason,recovery:'Correct the observed defect without weakening criteria'}],uncertainty:'Simulated reviewer fixture, not live semantic validation'};
}
function setup(t,respond,{learningProvenancePolicy=null}={}){
  const dir=mkdtempSync(join(tmpdir(),'factory-engine-')),databasePath=join(dir,'state.sqlite'),workspaceRoot=join(dir,'workspaces');
  let store,engine,registry,broker,count=0,closed=0;const exposures=[];
  const open=()=>{
    store=new Store(databasePath);const authority=new Authority(store);registry=new ArtifactRegistry(store,authority);
    broker=new ToolBroker({store,authority,workspaceRoot,lookup:async()=>[{address:'93.184.216.34',family:4}],transport:async()=>({statusCode:200,headers:{'content-type':'text/plain'},body:Buffer.from('Synthetic record: value is 12.'),remoteAddress:'93.184.216.34'})});
    const providerFactory=()=>({async generate(request){
      count++;const exposure=readSourceContextView(request.input);
      const task=JSON.parse(exposure.task);exposures.push({exposure,task});
      const type=Object.hasOwn(request.schema.properties,'requirements')?'plan':Object.hasOwn(request.schema.properties,'plan')?'planning-control':Object.hasOwn(request.schema.properties,'artifactHash')?'review':'produce';
      const value=await respond({request,exposure,task,type,number:count,engine,store,registry,broker});assert.equal(await request.validate(value),true);
      return {value,receipt:{kind:'inference',simulation:true,status:'completed',threadId:`sim-thread-${count}`,turnId:`sim-turn-${count}`,model:request.model,reasoningEffort:request.reasoningEffort,contextHash:inferenceRequestHash(request)}};
    },async close(){closed++;}});
    const workers=new WorkerService({store,authority,registry,broker,providerFactory});engine=new FactoryEngine({store,authority,registry,broker,workers,learningProvenancePolicy});return engine;
  };open();
  t.after(()=>{engine.close();rmSync(dir,{recursive:true,force:true});});
  return {directory:dir,get engine(){return engine;},get store(){return store;},get registry(){return registry;},get broker(){return broker;},get count(){return count;},get closed(){return closed;},exposures,
    reopen(){engine.close();return open();},workspace(missionId){return broker.registerWorkspace(missionId).path;}};
}
// Public Engine/Report values are deliberately thin delivery views.  Tests
// that prove controller, ledger or worker invariants read the authenticated
// durable record explicitly rather than turning a public projection into an
// accidental diagnostic channel.
const durableArtifact=(store,artifactId)=>{
  const record=store.get('artifact',artifactId);assert.ok(record,`Missing durable artifact ${artifactId}`);return record.data;
};
const durableNode=(store,missionId,nodeId)=>{
  const record=store.get('node',`${missionId}:${nodeId}`);assert.ok(record,`Missing durable node ${nodeId}`);return record.data;
};
const durableMission=(store,missionId)=>{
  const record=store.get('mission',missionId);assert.ok(record,`Missing durable mission ${missionId}`);return record.data;
};
test('REAL engine / SIMULATED models: mission budget preserves candidate and stops queue without a quality retry',async t=>{
  const intent='Produce one bounded result with independent review.';
  const s=setup(t,({type,task,exposure})=>type==='plan'?makePlan(intent):type==='review'?review(exposure,task):final());
  const q=new MissionQueue({engine:s.engine}),job=q.submit(intent,{allowedTools:[],maxNodeAttempts:1,inferenceBudget:{mode:'mission-calls-v1',maxCalls:3}});
  q.acquire();try{
    const stopped=await q.runNext();assert.equal(stopped.status,'WAITING');assert.equal(stopped.lastCode,'INFERENCE_BUDGET_EXHAUSTED');
    assert.equal(stopped.lastMissionStatus,'NEEDS_DIRECTION');assert.equal(stopped.automaticRetries,0);assert.equal(s.count,3);
    const candidate=s.store.list('artifact').find(a=>a.data.payload.nodeId==='deliver');assert.equal(candidate.data.status,'CANDIDATE');
    assert.equal(await q.runNext(),null);q.request(job.missionId,'continue');
    const again=await q.runNext();assert.equal(again.lastCode,'INFERENCE_BUDGET_EXHAUSTED');assert.equal(s.count,3);
    assert.deepEqual(s.store.get('artifact',candidate.id),candidate);
    assert.equal(missionInferenceBudget(s.registry,job.missionId).reserved,3);
    const report=missionReport(s.store,job.missionId,{registry:s.registry});
    assert.equal(report.metrics.integrity,'NOT_ATTESTED');
    assert.equal(report.metrics.correctionRequests,undefined,'Generic correction telemetry is never a public report field');
  }finally{q.release();}
});
test('REAL engine / SIMULATED models: high-risk review waits for a fresh adversarial judge, resumes it, and never delivers the first ACCEPT',async t=>{
  const intent='Deliver one bounded result whose elevated-risk acceptance needs an independent adversarial review.';
  const missionDirection={schema:MISSION_DIRECTION_SCHEMA,responsibleRoleId:'omega_02',riskLevel:'high',
    roleJustifications:[{roleId:'omega_02',rationale:'Produces the bounded fixture result.'},{roleId:'omega_03',rationale:'Reviews the bounded fixture result independently.'}],
    closureCriterion:{text:'A second independent adversarial reviewer accepts the final bounded result.',evaluation:'content'},
    escalation:{trigger:'A material conflict remains unresolved.',target:'omega_01',action:'Pause for an explicit decision.'}};
  let productions=0,deliverReviews=0,interrupted=false;const phases=[];
  const s=setup(t,({type,task,exposure})=>{
    if(type==='plan'){
      const proposed=makePlan(intent);proposed.nodes[0].criteria.push({id:'risk-close',...missionDirection.closureCriterion});return proposed;
    }
    if(type==='review'){
      const candidate=exposure.artifacts.find(a=>a.id===task.candidateId);
      if(candidate?.payload.nodeId==='deliver'){
        phases.push(task.reviewPhase);
        if(deliverReviews++===1&&!interrupted){interrupted=true;throw Object.assign(Error('Second judge quota pause'),{code:'QUOTA'});}
      }
      return review(exposure,task);
    }
    productions++;return final('Elevated-risk fixture result.');
  });
  const mission=s.engine.create(intent,{allowedTools:[],maxNodeAttempts:1,missionDirection});
  const paused=await s.engine.run(mission.id),candidate=s.store.list('artifact').find(record=>record.data.payload.nodeId==='deliver')?.data;
  assert.equal(paused.mission.status,'WAITING_QUOTA');assert.equal(candidate.status,'CANDIDATE');assert.equal(candidate.reviews.length,1);
  assert.equal(s.store.get('review',candidate.reviews[0]).data.reviewKind,'independent');
  s.reopen();const completed=await s.engine.run(mission.id),accepted=s.store.get('artifact',completed.outcome.id).data;
  assert.equal(completed.mission.status,'COMPLETED',JSON.stringify(completed.mission.pending));assert.equal(productions,1);
  assert.deepEqual(phases,['independent-initial','adversarial-second-independent','adversarial-second-independent']);
  assert.equal(accepted.reviews.length,2);assert.deepEqual(accepted.reviews.map(id=>s.store.get('review',id).data.reviewKind),['independent','adversarial']);
  const [first,second]=accepted.reviews.map(id=>s.store.get('review',id).data.reviewerRunId).map(id=>s.store.get('run',id).data);
  assert.notEqual(first.id,second.id);assert.notEqual(first.providerThreadId,second.providerThreadId);assert.notEqual(first.inferenceReceipt.threadId,second.inferenceReceipt.threadId);
  s.registry.invalidate([accepted.id],{kind:'fixture-revocation'});
  assert.throws(()=>s.registry.assertUsable(accepted.id,{missionId:mission.id,purpose:'deliver'}),{code:'UNACCEPTED_INPUT'});
});
test('producer response durability: a final received before completion-event failure survives reopening without a new producer',async t=>{
  const intent='Deliver the original bounded response and review it independently.';let productionCalls=0;
  const s=setup(t,({type,task,exposure})=>type==='plan'?makePlan(intent):type==='review'?review(exposure,task):final('Original response '+(++productionCalls)));
  const m=s.engine.create(intent,{allowedTools:[],maxNodeAttempts:1,inferenceBudget:{mode:'mission-calls-v1',maxCalls:4}});
  const append=s.store.append.bind(s.store);let interrupted=false;
  s.store.append=(kind,data)=>{
    if(!interrupted&&kind==='worker.inference.completed'&&s.store.get('run',data.runId)?.data.nodeId==='deliver'){
      interrupted=true;throw Object.assign(Error('Controlled failure after receiving final response'),{code:'TIMEOUT'});
    }
    return append(kind,data);
  };
  assert.equal((await s.engine.run(m.id)).mission.status,'WAITING_PROVIDER');assert.equal(productionCalls,1);
  const original=s.store.list('run').find(r=>r.data.nodeId==='deliver');
  assert.equal(s.store.list('artifact').filter(a=>a.data.payload.nodeId==='deliver').length,0);
  s.reopen();const result=await s.engine.run(m.id);
  assert.equal(result.mission.status,'COMPLETED',JSON.stringify(result.mission.pending));
  assert.equal(productionCalls,1,'Do not buy a replacement for a durably received final');
  const delivered=s.store.get('artifact',result.mission.finalArtifactId).data;
  assert.equal(delivered.payload.body,'Original response 1');assert.equal(delivered.payload.producerRunId,original.id);
  assert.equal(missionInferenceBudget(s.registry,m.id).reserved,4,'Three original calls plus one independent final review');
});
test('producer response durability: proposal write failure cannot leave a completed receipt without its public response',async t=>{
  const intent='Keep receipt and public producer response in one transaction.';
  const s=setup(t,({type,task,exposure})=>type==='plan'?makePlan(intent):type==='review'?review(exposure,task):final());
  const m=s.engine.create(intent,{allowedTools:[]});const put=s.store.put.bind(s.store);
  s.store.put=(type,id,data,options)=>{if(type==='worker-proposal')throw Object.assign(Error('Controlled proposal persistence failure'),{code:'STORAGE_CORRUPTION'});return put(type,id,data,options);};
  assert.equal((await s.engine.run(m.id)).mission.status,'FAILED');
  const actor=s.store.list('run').find(r=>r.data.nodeId==='deliver').data;
  assert.equal(actor.inferenceReceipt,undefined,'Uncommitted response must not leave an orphan completed receipt');
  assert.ok(actor.expectedRequestHash,'The unresolved request remains visible');
  assert.equal(s.store.list('worker-proposal').length,0);
});
test('REAL engine / SIMULATED models: exact sufficient mission budget completes and reentry spends nothing',async t=>{
  const intent='Deliver the bounded result with every independent gate.';
  const s=setup(t,({type,task,exposure})=>type==='plan'?makePlan(intent):type==='review'?review(exposure,task):final());
  const m=s.engine.create(intent,{allowedTools:[],inferenceBudget:{mode:'mission-calls-v1',maxCalls:4}});
  assert.equal((await s.engine.run(m.id)).mission.status,'COMPLETED');assert.equal(s.count,4);
  s.reopen();assert.equal((await s.engine.run(m.id)).mission.status,'COMPLETED');assert.equal(s.count,4);
  assert.equal(missionInferenceBudget(s.registry,m.id).reserved,4);
});
test('REAL engine / SIMULATED models: planning and global ceilings compose without a partial double reservation',async t=>{
  const intent='Preserve all obligations while explicitly inspecting full planning role cards.';
  const s=setup(t,({type})=>{assert.equal(type,'planning-control');return {action:'inspect',roleIds:['omega_02','omega_03'],reason:'Inspect complete roles before committing a plan.',plan:null};});
  const m=s.engine.create(intent,{allowedTools:[],planningContracts:{mode:'on-demand-v1',maxCalls:3},inferenceBudget:{mode:'mission-calls-v1',maxCalls:1}});
  const result=await s.engine.run(m.id);assert.equal(result.mission.status,'NEEDS_DIRECTION');
  assert.equal(result.mission.pending[0].code,'INFERENCE_BUDGET_EXHAUSTED',JSON.stringify(result.mission.pending));assert.equal(s.count,1);
  assert.equal(planningInspectionBudget(s.registry,m.id).reserved,1);assert.equal(missionInferenceBudget(s.registry,m.id).reserved,1);
  assert.equal(s.store.list('inference-request').length,1);
  assert.equal(s.store.get('planning-progress',m.id).data.qualityFailures,0);
  assert.equal(s.store.get('planning-progress',m.id).data.attempts,1);
});
test('REAL engine / SIMULATED model quota: no refund or new producer after a failed final review',async t=>{
  const intent='Deliver one result while preserving independent acceptance.';
  const s=setup(t,({type,task,exposure,number})=>{if(number===4)throw Object.assign(Error('Synthetic quota after reservation'),{code:'QUOTA'});
    return type==='plan'?makePlan(intent):type==='review'?review(exposure,task):final();});
  const m=s.engine.create(intent,{allowedTools:[],maxNodeAttempts:1,inferenceBudget:{mode:'mission-calls-v1',maxCalls:4}});
  assert.equal((await s.engine.run(m.id)).mission.status,'WAITING_QUOTA');assert.equal(s.count,4);
  const candidate=s.store.list('artifact').find(a=>a.data.payload.nodeId==='deliver');assert.equal(candidate.data.status,'CANDIDATE');
  s.reopen();const result=await s.engine.run(m.id);assert.equal(result.mission.status,'NEEDS_DIRECTION');
  assert.equal(result.mission.pending[0].code,'INFERENCE_BUDGET_EXHAUSTED');assert.equal(s.count,4);
  assert.deepEqual(s.store.get('artifact',candidate.id),candidate);assert.equal(missionInferenceBudget(s.registry,m.id).reserved,4);
});
for(const encoding of ['plain-json','lossless-v1','lossless-json-v2','source-text-v1'])
test('REAL coordinator / SIMULATED model: on-demand planning inspects full contracts before independent acceptance with '+encoding,async t=>{
  const intent='Produce one bounded result and independently review it.';let planning=0;
  const s=setup(t,({type,task,exposure,store})=>{
    if(type==='planning-control'){
      planning++;assert.equal(task.planningContractControl.callIndex,planning);assert.equal(store.list('artifact').length,0);
      if(planning===1){assert.equal(task.inspectedRoleContracts,undefined);return {action:'inspect',roleIds:['omega_02','omega_03'],reason:'Check complete methods and reviewer boundaries.',plan:null};}
      assert.deepEqual(task.inspectedRoleContracts.cards,['omega_02','omega_03'].map(getRole));
      return {action:'plan',roleIds:[],reason:'',plan:makePlan(intent)};
    }
    if(type==='review')return review(exposure,task);return final();
  });
  const m=s.engine.create(intent,{allowedTools:[],contextEncoding:encoding,planningContracts:{mode:'on-demand-v1',maxCalls:3}});
  const result=await s.engine.run(m.id);assert.equal(result.mission.status,'COMPLETED',JSON.stringify(result.mission.pending));
  assert.equal(s.count,5);assert.equal(planning,2);assert.equal(planningInspectionBudget(s.registry,m.id).reserved,2);
  assert.equal(s.store.list('planning-inspection-response').length,2);assert.equal(s.store.list('planning-inspection-step').length,1);
  assert.equal(s.store.list('planning-response').length,0,'No legacy final-plan schema is silently substituted');
  const producer=s.store.list('run').find(r=>r.data.nodeId==='planning');
  assert.equal(readPlanningInspectionMessage(s.registry,producer.id).coverage.complete,true);
  const judged=s.store.list('run').find(r=>r.data.nodeId==='review:planning');assert.notEqual(judged.id,producer.id);
  assert.equal(s.store.get('planning-progress',m.id).data.attempts,1);assert.equal(s.store.get('planning-progress',m.id).data.qualityFailures,0);
  const before=s.store.verifyJournal(),report=missionReport(s.store,m.id,{registry:s.registry});
  assert.equal(report.planningInspection.integrity,'VERIFIED');assert.equal(report.planningInspection.budget.reserved,2);
  assert.deepEqual(report.planningInspection.actors,[],'Per-actor inspection custody is not a public report channel');
  assert.equal(report.metrics.integrity,'NOT_ATTESTED');
  assert.match(formatMissionReport(report),/2\/3 reservas de planificación/);assert.deepEqual(s.store.verifyJournal(),before);
});
test('on-demand planning never submits a provisional plan missing assigned cards to the judge',async t=>{
  const intent='Produce a bounded independently reviewed result.';let planning=0;
  const s=setup(t,({type,task,exposure,store})=>{
    if(type==='planning-control'){
      planning++;assert.equal(store.list('artifact').length,0);
      if(planning===2){assert.deepEqual(task.planningContractFeedback.missingRoleIds,['omega_02','omega_03']);assert.ok(task.planningContractFeedback.provisionalPlan);}
      return {action:'plan',roleIds:[],reason:'',plan:makePlan(intent)};
    }
    return type==='review'?review(exposure,task):final();
  });
  const m=s.engine.create(intent,{allowedTools:[],planningContracts:{mode:'on-demand-v1',maxCalls:2}});
  assert.equal((await s.engine.run(m.id)).mission.status,'COMPLETED');assert.equal(planning,2);assert.equal(s.count,5);
});
test('on-demand global exhaustion cannot reset through resume or buy a judge for an unseen plan',async t=>{
  const intent='Return a bounded result.';
  const s=setup(t,({type})=>{assert.equal(type,'planning-control');return {action:'plan',roleIds:[],reason:'',plan:makePlan(intent)};});
  const m=s.engine.create(intent,{allowedTools:[],planningContracts:{mode:'on-demand-v1',maxCalls:1}});
  let result=await s.engine.run(m.id);assert.equal(result.mission.status,'NEEDS_DIRECTION');assert.equal(result.mission.pending[0].code,'PLANNING_INSPECTION_LIMIT');
  s.reopen();result=await s.engine.run(m.id);assert.equal(result.mission.status,'NEEDS_DIRECTION');assert.equal(s.count,1);
  assert.equal(s.store.list('artifact').length,0);assert.equal(s.store.get('planning-progress',m.id).data.qualityFailures,0);
});
test('on-demand quality rejection keeps independent review and the same global reservation ceiling across actors',async t=>{
  const intent='Produce a bounded result under independent review.';let planning=0,judges=0;
  const s=setup(t,({type,task,exposure})=>{
    if(type==='planning-control'){
      planning++;if(planning===1)return {action:'inspect',roleIds:['omega_02','omega_03'],reason:'Inspect the full assignment contracts.',plan:null};
      if(planning===3)assert.deepEqual(task.rejectedRoleContracts.cards,['omega_02','omega_03'].map(getRole));
      return {action:'plan',roleIds:[],reason:'',plan:makePlan(intent)};
    }
    if(type==='review'){if(task.purpose==='plan'&&++judges===1)return review(exposure,task,{decision:'RETURN',reason:'Fixture rejects the first proposed method.'});return review(exposure,task);}
    return final();
  });
  const m=s.engine.create(intent,{allowedTools:[],planningContracts:{mode:'on-demand-v1',maxCalls:3}});
  const result=await s.engine.run(m.id);assert.equal(result.mission.status,'COMPLETED',JSON.stringify(result.mission.pending));
  assert.equal(planning,3);assert.equal(judges,2);assert.equal(s.count,7);
  assert.equal(planningInspectionBudget(s.registry,m.id).reserved,3);
  const p=s.store.get('planning-progress',m.id).data;assert.equal(p.qualityFailures,1);assert.equal(p.attempts,2);
});
test('on-demand quota recovery uses a distinct bounded actor and never resets a consumed reservation',async t=>{
  const intent='Produce one independently checked result.';let planning=0;
  const s=setup(t,({type,task,exposure})=>{
    if(type==='planning-control'){
      planning++;if(planning===1)throw Object.assign(Error('Synthetic quota refusal'),{code:'QUOTA'});
      if(planning===2)return {action:'inspect',roleIds:['omega_02','omega_03'],reason:'Inspect the full contracts.',plan:null};
      return {action:'plan',roleIds:[],reason:'',plan:makePlan(intent)};
    }
    return type==='review'?review(exposure,task):final();
  });
  const m=s.engine.create(intent,{allowedTools:[],planningContracts:{mode:'on-demand-v1',maxCalls:3}});
  assert.equal((await s.engine.run(m.id)).mission.status,'WAITING_QUOTA');
  const old=s.store.get('planning-progress',m.id).data.active.runId;s.reopen();
  const result=await s.engine.run(m.id);assert.equal(result.mission.status,'COMPLETED',JSON.stringify(result.mission.pending));
  assert.equal(planningInspectionBudget(s.registry,m.id).reserved,3);assert.equal(s.store.list('planning-inspection-failure').length,1);
  assert.ok(s.store.get('run',old).data.expectedRequestHash);assert.equal(s.store.get('planning-progress',m.id).data.qualityFailures,0);
});
test('on-demand persistence failure records a closed unretained outcome and blocks replacement',async t=>{
  const s=setup(t,()=>({action:'inspect',roleIds:['omega_02'],reason:'Inspect the complete method.',plan:null}));
  const m=s.engine.create('One bounded result.',{allowedTools:[],planningContracts:{mode:'on-demand-v1',maxCalls:3}}),put=s.store.put.bind(s.store);
  const fault=t.mock.method(s.store,'put',(type,...args)=>{if(type==='planning-inspection-response')throw Error('Synthetic storage failure');return put(type,...args);});
  let result=await s.engine.run(m.id);assert.equal(result.mission.pending[0].code,'PLANNING_INSPECTION_PERSISTENCE');fault.mock.restore();s.reopen();
  result=await s.engine.run(m.id);assert.equal(result.mission.status,'NEEDS_DIRECTION');assert.equal(result.mission.pending[0].code,'INFERENCE_OUTCOME_UNKNOWN');
  const cleanup=s.store.list('planning-provider-cleanup').at(-1).data;
  assert.equal(cleanup.status,'CLOSED');assert.equal(cleanup.outcome,'RESPONSE_UNRETAINED');
  assert.equal(s.count,1);assert.equal(s.store.list('planning-inspection-failure').length,0);assert.equal(s.store.get('planning-progress',m.id).data.qualityFailures,0);
});
test('on-demand provider close failure keeps a retained response private and remains blocked after reopen',async t=>{
  const intent='Preserve the bounded result and its independent review.';let planning=0;
  const s=setup(t,({type,task,exposure})=>{
    if(type==='planning-control'){
      planning++;return planning===1?{action:'inspect',roleIds:['omega_02','omega_03'],reason:'Read complete methods and review boundaries.',plan:null}
        :{action:'plan',roleIds:[],reason:'',plan:makePlan(intent)};
    }
    return type==='review'?review(exposure,task):final();
  });
  const factory=s.engine.workers.providerFactory;
  s.engine.workers.providerFactory=()=>{const p=factory();return {generate:p.generate,async close(){await p.close();throw Object.assign(Error('Synthetic failure reporting provider cleanup'),{code:'PROTOCOL'});}};};
  const m=s.engine.create(intent,{allowedTools:[],maxPlanAttempts:1,planningContracts:{mode:'on-demand-v1',maxCalls:3}});
  const first=await s.engine.run(m.id);assert.equal(first.mission.status,'WAITING_CAPABILITY');assert.equal(first.mission.pending[0].code,'CLEANUP_UNCONFIRMED');
  const before=s.store.get('planning-progress',m.id).data;assert.equal(before.qualityFailures,0);assert.ok(before.active);
  assert.throws(()=>readPlanningInspectionMessage(s.registry,before.active.runId),{code:'CLEANUP_UNCONFIRMED'});
  const raw=s.store.list('planning-inspection-response').at(-1),cleanup=s.store.list('planning-provider-cleanup').at(-1).data;
  assert.equal(cleanup.status,'UNCONFIRMED');assert.equal(cleanup.outcome,'RETAINED');assert.ok(raw);
  // Reopening SQLite or replacing the in-process factory does not certify an
  // old physical provider close.  No public response is consumed and no
  // replacement planning call may be purchased without reconciliation.
  s.reopen();const result=await s.engine.run(m.id);assert.equal(result.mission.status,'WAITING_CAPABILITY');assert.equal(result.mission.pending[0].code,'CLEANUP_UNCONFIRMED');
  assert.equal(planning,1);assert.equal(s.count,1);assert.equal(s.store.list('run').filter(r=>r.data.nodeId==='planning').length,1);
  assert.equal(s.store.get('planning-progress',m.id).data.qualityFailures,0);assert.equal(s.store.get('planning-progress',m.id).data.attempts,1);
  assert.equal(s.store.get(raw.type,raw.id).hash,raw.hash);
});
test('an unresolved planning actor cannot be bypassed by directly creating a second actor',async t=>{
  const intent='Do not dispatch a replacement planner while the first provider close remains unresolved.';
  const s=setup(t,({type})=>{
    if(type==='planning-control')return {action:'inspect',roleIds:['omega_02'],reason:'Read the complete method before planning.',plan:null};
    return final();
  });
  const providerFactory=s.engine.workers.providerFactory;
  s.engine.workers.providerFactory=()=>{const provider=providerFactory();return {generate:provider.generate,async close(){
    await provider.close();throw Object.assign(Error('Synthetic unresolved close'),{code:'PROTOCOL'});
  }}};
  const mission=s.engine.create(intent,{allowedTools:[],planningContracts:{mode:'on-demand-v1',maxCalls:3}});
  const first=await s.engine.run(mission.id);assert.equal(first.mission.status,'WAITING_CAPABILITY');assert.equal(first.mission.pending[0].code,'CLEANUP_UNCONFIRMED');
  const active=s.store.get('planning-progress',mission.id).data.active;
  const second=s.engine.workers.createRun({missionId:mission.id,nodeId:'planning',mode:'producer',purpose:'plan',roleIds:['omega_04','omega_05']});
  const frozen=s.store.get('mission',mission.id).data,before=s.store.verifyJournal();
  await assert.rejects(runPlanningInspection({workers:s.engine.workers,runId:second.id,instructions:'Attempt a direct replacement.',
    task:{originalRequest:frozen.intent,intentHash:frozen.intentHash,allowedTools:frozen.policy.allowedTools}}),{code:'PLANNING_ACTOR_ADMISSION'});
  assert.deepEqual(s.store.verifyJournal(),before);assert.equal(s.count,1,'The rejected actor cannot reach the provider');
  assert.equal(s.store.list('planning-inspection-call').length,1,'The rejected actor cannot reserve another control call');
  assert.equal(s.store.list('inference-request').length,1);assert.equal(s.store.get('planning-progress',mission.id).data.active.runId,active.runId);
});
test('an orphan closed no-response control without its failure token cannot reach a replacement provider',async t=>{
  const intent='Do not replace a control request until its exact post-close local failure is durable.';
  const s=setup(t,()=>assert.fail('The blocked replacement must not reach a provider'));
  const mission=s.engine.create(intent,{allowedTools:[],planningContracts:{mode:'on-demand-v1',maxCalls:3}});
  const first=s.engine.workers.createRun({missionId:mission.id,nodeId:'planning',mode:'producer',purpose:'plan',roleIds:['omega_04','omega_05']}),
    current=s.store.get('mission',mission.id).data,config=s.store.get('worker-config',first.id).data,
    task={originalRequest:current.intent,intentHash:current.intentHash,allowedTools:current.policy.allowedTools,
      planningContractControl:{schema:'sovereign.planning-contract-control.v1',runId:first.id,callIndex:1,maxCalls:3,maxBytes:262144}},
    {request}=composeLearningRequest({prefix:config.instructions,taskInstructions:'Return an explicit inspection control message.',
      input:JSON.stringify({...s.engine.workers.context(first.id),task:JSON.stringify(task)}),schema:PLANNING_MESSAGE_SCHEMA,
      model:current.policy.model,reasoningEffort:current.policy.reasoningEffort});
  s.registry.updateContext(first.id,{...s.store.get('run',first.id).data.context,instructionsHash:sha256(request.instructions)});
  const call=reservePlanningInspection(s.registry,{runId:first.id,request});
  planningResponses.recordPlanningProviderCleanup(s.registry,{runId:first.id,requestHash:call.data.requestHash,
    retention:PLANNING_INSPECTION_RETENTION,reservationRecord:{type:call.type,id:call.id,version:call.version,hash:call.hash},
    confirmed:true,result:{processExitObserved:true},outcome:'NO_DURABLE_RESPONSE'});
  const result=await s.engine.run(mission.id);
  assert.equal(result.mission.status,'NEEDS_DIRECTION');assert.equal(result.mission.pending[0].code,'PLANNING_INSPECTION_PENDING');
  assert.equal(s.count,0);assert.equal(s.store.list('planning-inspection-call').length,1);
  assert.equal(s.store.list('inference-request').length,1);assert.equal(s.store.get('run',first.id).data.expectedRequestHash,call.data.requestHash);
});
for(const [name,mutate,expectedCode] of [
  ['inspection policy',policy=>{delete policy.planningContracts;},'PLANNING_RESPONSE_INTEGRITY'],
  ['cleanup marker',policy=>{delete policy.planningCleanupProtocol;},'PLANNING_INSPECTION_INTEGRITY'],
  ['unspent inspection ceiling',policy=>{policy.planningContracts={...policy.planningContracts,maxCalls:99};},'PLANNING_INSPECTION_INTEGRITY']
])
test('altering '+name+' cannot downgrade a v15 planner into a provider dispatch',async t=>{
  const s=setup(t,()=>assert.fail('Policy drift must stop before any provider dispatch'));
  const mission=s.engine.create('Do not reinterpret an admitted inspection mission as legacy planning.',
    {allowedTools:[],planningContracts:{mode:'on-demand-v1',maxCalls:3}});
  const stored=s.store.get('mission',mission.id),policy={...stored.data.policy};mutate(policy);
  s.store.put(stored.type,stored.id,{...stored.data,policy},{expectedVersion:stored.version});
  const result=await s.engine.run(mission.id),durable=durableMission(s.store,mission.id);
  assert.equal(result.mission.status,'UNVERIFIED');assert.deepEqual(result.mission.pending,[]);
  assert.equal(durable.status,'FAILED');assert.equal(durable.pending[0].code,expectedCode);
  assert.equal(s.count,0);assert.equal(s.store.list('inference-request').length,0);assert.equal(s.store.list('planning-inspection-call').length,0);
});
for(const [name,mutate] of [
  ['substituted mandate',(s,stored)=>{const intent='Substituted mandate must never become a planning authority.';return {...stored.data,intent,intentHash:sha256(intent)};}],
  ['policy mutation later reverted',(s,stored)=>{
    const widened={...stored.data.policy,planningContracts:{...stored.data.policy.planningContracts,maxCalls:99}};
    const drifted=s.store.put(stored.type,stored.id,{...stored.data,policy:widened},{expectedVersion:stored.version});
    return {...drifted.data,policy:stored.data.policy};
  }]
])
test(name+' cannot reach a planning provider even if the current head appears admissible',async t=>{
  const s=setup(t,()=>assert.fail('Mandate or policy history drift must stop before any provider dispatch'));
  const mission=s.engine.create('Keep the planning admission bound to its original mission record.',
    {allowedTools:[],planningContracts:{mode:'on-demand-v1',maxCalls:3}});
  const stored=s.store.get('mission',mission.id),replacement=mutate(s,stored);
  s.store.put(stored.type,stored.id,replacement,{expectedVersion:s.store.get(stored.type,stored.id).version});
  const result=await s.engine.run(mission.id),durable=durableMission(s.store,mission.id);
  assert.equal(result.mission.status,'UNVERIFIED');assert.deepEqual(result.mission.pending,[]);
  assert.equal(durable.status,'FAILED');assert.equal(durable.pending[0].code,'PLANNING_INSPECTION_INTEGRITY');
  assert.equal(s.count,0);assert.equal(s.store.list('inference-request').length,0);assert.equal(s.store.list('planning-inspection-call').length,0);
});
test('legacy planning close failure keeps its response private and remains blocked after reopen',async t=>{
  const intent='Preserve the original planning response when provider cleanup is uncertain.',privateRationale='PRIVATE_LEGACY_UNCONFIRMED_PLAN_SENTINEL';let plans=0;
  const s=setup(t,({type,task,exposure})=>{
    if(type==='plan'){plans++;const plan=makePlan(intent);plan.routingRationale=privateRationale;return plan;}
    if(type==='review')return review(exposure,task);
    return final();
  });
  const factory=s.engine.workers.providerFactory;
  s.engine.workers.providerFactory=()=>{const p=factory();return {generate:p.generate,async close(){
    await p.close();throw Object.assign(Error('Synthetic legacy planner cleanup failure'),{code:'PROTOCOL'});
  }};};
  const mission=s.engine.create(intent,{allowedTools:[],maxPlanAttempts:1});
  const first=await s.engine.run(mission.id);
  assert.equal(first.mission.status,'WAITING_CAPABILITY',JSON.stringify(first.mission.pending));
  assert.equal(first.mission.pending[0].code,'CLEANUP_UNCONFIRMED');
  const before=s.store.get('planning-progress',mission.id).data;
  assert.equal(before.qualityFailures,0);assert.equal(before.attempts,1);assert.ok(before.active);
  assert.throws(()=>readPlanningResponse(s.registry,before.active.runId),{code:'CLEANUP_UNCONFIRMED'});
  const raw=s.store.list('planning-response').at(-1),cleanupRecord=s.store.list('planning-provider-cleanup').at(-1),cleanup=cleanupRecord.data;
  assert.equal(cleanup.status,'UNCONFIRMED');assert.equal(cleanup.outcome,'RETAINED');assert.ok(raw);
  // Even an unconfirmed close must bind the quarantined response exactly.  It
  // is not public yet, but it cannot later be swapped for a different result.
  assert.deepEqual(cleanup.outcomeRecord,{type:raw.type,id:raw.id,version:raw.version,hash:raw.hash});
  const origin=s.store.list('planning-cleanup-origin').find(r=>r.data.runId===before.active.runId),sequence=r=>s.registry.committedSequence(r.type,r.id,r.version);
  assert.ok(sequence(origin)<sequence(raw));assert.ok(sequence(raw)<sequence(cleanupRecord));
  const reportBefore=s.store.verifyJournal(),report=missionReport(s.store,mission.id,{registry:s.registry});
  assert.equal(report.planningCleanup,undefined,'Legacy cleanup custody has no generic public projection');
  assert.ok(!JSON.stringify(report).includes(privateRationale));assert.match(formatMissionReport(report),/CLEANUP_UNCONFIRMED/);assert.deepEqual(s.store.verifyJournal(),reportBefore);
  assert.equal(plans,1);assert.equal(s.count,1);
  assert.equal(s.store.list('run').filter(r=>r.data.nodeId==='planning').length,1);
  // Reopening does not supply evidence that the old physical provider session
  // closed.  The old response remains quarantined rather than being consumed
  // or silently replaced.
  s.reopen();const resumed=await s.engine.run(mission.id);
  assert.equal(resumed.mission.status,'WAITING_CAPABILITY');assert.equal(resumed.mission.pending[0].code,'CLEANUP_UNCONFIRMED');
  assert.equal(plans,1,'Do not dispatch a replacement planner');assert.equal(s.count,1);
  assert.equal(s.store.list('run').filter(r=>r.data.nodeId==='planning').length,1);
  assert.equal(s.store.get('planning-progress',mission.id).data.qualityFailures,0);
});
test('a pending legacy planning request cannot bypass its lifecycle through generic infer or the same retention',async t=>{
  let planningCalls=0;
  const s=setup(t,({type})=>{
    if(type==='plan'){planningCalls++;throw Object.assign(Error('Synthetic local planner refusal'),{code:'QUOTA'});}
    return final();
  });
  const mission=s.engine.create('Never replay an unresolved legacy planning request.',{allowedTools:[],maxPlanAttempts:2});
  const first=await s.engine.run(mission.id);assert.equal(first.mission.status,'WAITING_QUOTA');
  const active=s.store.get('planning-progress',mission.id).data.active,before=s.store.verifyJournal(),run=s.store.get('run',active.runId).data;
  assert.ok(run.expectedRequestHash);assert.equal(s.store.list('planning-response-failure').length,1);
  const request={runId:active.runId,instructions:'Attempt to bypass the planning lifecycle.',input:'{}',schema:PLAN_SCHEMA,validate:()=>true};
  await assert.rejects(s.engine.workers.infer(request),{code:'PLANNING_RESPONSE_SCOPE'});
  await assert.rejects(s.engine.workers.infer({...request,retention:PLANNING_RESPONSE_RETENTION}),{code:'INFERENCE_PENDING'});
  assert.equal(planningCalls,1);assert.equal(s.count,1);assert.deepEqual(s.store.verifyJournal(),before);
});
test('on-demand inspection receipts cannot become artifacts through a direct registry call or legacy inference bypass',async t=>{
  const intent='Produce a bounded result.';
  const s=setup(t,()=>({action:'inspect',roleIds:['omega_02','omega_03'],reason:'Read complete contracts before choosing.',plan:null}));
  const m=s.engine.create(intent,{allowedTools:[],planningContracts:{mode:'on-demand-v1',maxCalls:1}});
  assert.equal((await s.engine.run(m.id)).mission.status,'NEEDS_DIRECTION');
  const runId=s.store.get('planning-progress',m.id).data.active.runId,before=s.store.verifyJournal();
  assert.throws(()=>s.registry.create({missionId:m.id,nodeId:'planning',producerRunId:runId,kind:'mission-plan',purpose:'plan',body:JSON.stringify(makePlan(intent)),criteria:[{id:'intent',text:intent}]}),{code:'PLANNING_INSPECTION_INTEGRITY'});
  await assert.rejects(s.engine.workers.infer({runId,instructions:'Bypass the control protocol.',input:'{}',schema:{type:'object'},validate:()=>true}),{code:'PLANNING_INSPECTION_SCOPE'});
  assert.deepEqual(s.store.verifyJournal(),before);assert.equal(s.count,1);assert.equal(s.store.list('artifact').length,0);
});
test('on-demand full-contract completion cannot authorize a changed body through the artifact API',async t=>{
  const intent='Produce a bounded result with separate review.';let calls=0;
  const s=setup(t,({type,task,exposure})=>{
    if(type==='planning-control'){calls++;return calls===1?{action:'inspect',roleIds:['omega_02','omega_03'],reason:'Read the actual methods.',plan:null}:{action:'plan',roleIds:[],reason:'',plan:makePlan(intent)};}
    return type==='review'?review(exposure,task):final();
  });
  const m=s.engine.create(intent,{allowedTools:[],planningContracts:{mode:'on-demand-v1',maxCalls:2}});assert.equal((await s.engine.run(m.id)).mission.status,'COMPLETED');
  const candidate=s.store.list('artifact').find(a=>a.data.payload.nodeId==='planning').data,body=JSON.parse(candidate.payload.body);body.routingRationale+=' Changed after completion.';
  const before=s.store.verifyJournal();assert.throws(()=>s.registry.create({...candidate.payload,body:JSON.stringify(body)}),{code:'PLANNING_INSPECTION_INTEGRITY'});
  assert.deepEqual(s.store.verifyJournal(),before);
});
for(const phase of ['reservation-committed','response-uncommitted','cleanup-uncommitted','cleanup-committed','inspection-committed','step-committed','plan-committed','candidate-committed'])
test('REAL process exit/SQLite: on-demand recovery at '+phase+' preserves exact actor, budget and review',async t=>{
  const intent='Produce one bounded result with independent review after recovery.';
  const s=setup(t,({type,task,exposure})=>{
    if(type==='planning-control'){
      assert.deepEqual(task.inspectedRoleContracts.cards,['omega_02','omega_03'].map(getRole));
      return {action:'plan',roleIds:[],reason:'',plan:makePlan(intent)};
    }
    return type==='review'?review(exposure,task):final();
  });
  const m=s.engine.create(intent,{allowedTools:[],planningContracts:{mode:'on-demand-v1',maxCalls:3}});
  const child=spawnSync(process.execPath,[new URL('./fixtures/planning-inspection-controller.mjs',import.meta.url).pathname,s.directory,m.id,phase,JSON.stringify(makePlan(intent))],
    {encoding:'utf8',timeout:15000,maxBuffer:65536});
  assert.equal(child.error,undefined);assert.equal(child.signal,null);assert.equal(child.status,86,child.stderr);
  s.reopen();assert.equal(s.store.get('mission',m.id).data.status,'PLANNING');
  const before=s.store.get('planning-progress',m.id).data,runId=before.active.runId;
  const replies=s.store.list('planning-inspection-response').map(r=>({id:r.id,hash:r.hash}));
  const result=await s.engine.run(m.id);
  if(['reservation-committed','response-uncommitted','cleanup-uncommitted'].includes(phase)){
    assert.equal(result.mission.status,'WAITING_CAPABILITY');assert.equal(result.mission.pending[0].code,'CLEANUP_UNCONFIRMED');
    assert.equal(s.count,0);assert.equal(replies.length,phase==='cleanup-uncommitted'?1:0);assert.equal(s.store.list('artifact').length,0);
    assert.equal(planningInspectionBudget(s.registry,m.id).reserved,1);
    assert.equal(s.store.list('planning-cleanup-origin').length,1);assert.equal(s.store.list('planning-provider-cleanup').length,0);
    if(phase==='cleanup-uncommitted')assert.throws(()=>readPlanningInspectionMessage(s.registry,runId),{code:'CLEANUP_UNCONFIRMED'});
  }else{
    assert.equal(result.mission.status,'COMPLETED',JSON.stringify(result.mission.pending));
    assert.equal(s.count,['cleanup-committed','inspection-committed','step-committed'].includes(phase)?4:3);
    assert.equal(planningInspectionBudget(s.registry,m.id).reserved,2);
    assert.equal(s.store.list('planning-inspection-step').length,1);
    assert.equal(s.store.list('artifact').filter(r=>r.data.payload.nodeId==='planning').length,1);
  }
  assert.equal(s.store.list('run').filter(r=>r.data.nodeId==='planning').length,1);assert.ok(s.store.get('run',runId));
  assert.equal(s.store.get('planning-progress',m.id).data.attempts,1);assert.equal(s.store.get('planning-progress',m.id).data.qualityFailures,0);
  for(const r of replies)assert.equal(s.store.get('planning-inspection-response',r.id).hash,r.hash);
  s.store.verifyJournal();
});
test('REAL coordinator / SIMULATED model: an accepted standalone specialist uses its exact charter without borrowing an incompatible catalog role',async t=>{
  const intent='Derive a closed finite result and independently review it.';
  const charter={question:'Which finite candidates satisfy the supplied relation?',methods:['Enumerate every supplied candidate and exhibit every exclusion.'],
    falsifier:'A valid omitted candidate or an invalid included candidate.',expectedBenefit:'No existing selected facet implements this bounded derivation.',completion:'Return the exact requested result and a public completeness argument, not an acceptance receipt.'};
  let produced=0;
  const s=setup(t,({type,task,exposure,request,store})=>{
    if(type==='plan'){
      const p=makePlan(intent);p.nodes[0].roleIds=[];p.nodes[0].specialist=charter;
      assert.equal(task.runtimeCapabilities.standaloneSpecialists,true);return p;
    }
    if(type==='review'){
      if(task.purpose==='plan'){
        assert.deepEqual(task.targetRoleContracts.assignments[0].standaloneSpecialist,charter);
        assert.deepEqual(task.targetRoleContracts.cards.map(c=>c.id),['omega_03']);
      }
      return review(exposure,task);
    }
    produced++;
    const config=store.list('worker-config').find(r=>r.data.standaloneSpecialist)?.data;
    assert.ok(config);assert.deepEqual(config.roleIds,[]);assert.deepEqual(config.standaloneSpecialist.charter,charter);
    assert.equal(config.standaloneSpecialist.nodeId,'deliver');
    assert.equal(config.standaloneSpecialist.planArtifactId,store.list('plan')[0].data.acceptedPlanArtifactId);
    assert.equal(config.compilationScope.standaloneSpecialistHash,sha256(config.standaloneSpecialist));
    assert.ok(request.instructions.includes(JSON.stringify(charter.methods[0])));
    assert.match(request.instructions,/STANDALONE SPECIALIST/);
    assert.equal(config.learnedInstructionVersions.length,0);
    assert.ok(exposure.planViews.length===1);return final('Complete public finite derivation.');
  });
  const m=s.engine.create(intent,{allowedTools:[],contextEncoding:'lossless-json-v2',cardEncoding:'compact-json-v1',producerContext:'node-contract-v1'});
  const result=await s.engine.run(m.id);
  assert.equal(result.mission.status,'COMPLETED');assert.equal(produced,1);assert.equal(s.count,4);
  assert.equal(s.store.list('effect').length,0);assert.equal(s.store.get('artifact',result.outcome.id).data.status,'ACCEPTED');
  const report=missionReport(s.store,m.id,{registry:s.registry});assert.deepEqual(report.nodes[0].specialist,charter);
  assert.equal(report.nodes[0].specialistMode,'standalone');assert.equal(report.nodes[0].specialistExecutions,undefined,
    'Worker execution bindings stay inside the authenticated control plane');
  assert.equal(s.store.list('worker-config').filter(r=>r.data.standaloneSpecialist).length,1);
  assert.ok(formatMissionReport(report).includes(charter.falsifier));
  s.reopen();assert.equal((await s.engine.run(m.id)).mission.status,'COMPLETED');assert.equal(s.count,4,'Accepted standalone product survives reopen without another inference');
  const n=durableNode(s.store,m.id,'deliver'),plan=s.store.get('plan',m.id),worker=s.store.list('worker-config').find(r=>r.data.standaloneSpecialist);
  const args={missionId:m.id,nodeId:n.nodeId,mode:'producer',purpose:n.spec.purpose,roleIds:[],artifactIds:[plan.data.acceptedPlanArtifactId]};
  const run=s.engine.workers.createRun(args);
  assert.deepEqual(s.store.get('worker-config',run.id).data.standaloneSpecialist,worker.data.standaloneSpecialist);
  assert.throws(()=>s.engine.workers.createRun({...args,nodeId:'unknown'}),{code:'SPECIALIST_BINDING'});
  assert.throws(()=>s.engine.workers.createRun({...args,artifactIds:[]}),{code:'SPECIALIST_BINDING'});
  assert.throws(()=>s.engine.workers.createRun({...args,purpose:'other'}),{code:'SPECIALIST_BINDING'});
  assert.throws(()=>s.engine.workers.createRun({...args,mode:'reviewer'}),{code:'SPECIALIST_BINDING'});
  const bad=structuredClone(s.store.get('worker-config',run.id).data);bad.standaloneSpecialist.charter.methods=['Silently replace the approved method.'];
  const prior=s.store.get('worker-config',run.id);s.store.put('worker-config',run.id,bad,{expectedVersion:prior.version});
  const count=s.count;
  await assert.rejects(s.engine.workers.infer({runId:run.id,instructions:'Return a result',input:'{}',schema:{type:'object',properties:{}},validate:()=>true}),{code:'SPECIALIST_BINDING'});
  assert.equal(s.count,count,'Changed charter must fail before provider dispatch');
  s.registry.invalidate([plan.data.acceptedPlanArtifactId],{reason:'Withdraw exact plan acceptance'});
  assert.throws(()=>s.engine.workers.createRun(args));
});
test('standalone specialist requires a charter and cannot be introduced before accepted planning',async t=>{
  const s=setup(t,()=>assert.fail('No inference authorized in this admission test'));
  const m=s.engine.create('Preserve the requested work.',{allowedTools:[]});
  for(const nodeId of ['planning','deliver'])assert.throws(()=>s.engine.workers.createRun({missionId:m.id,nodeId,mode:'producer',purpose:'deliver',roleIds:[]}),{code:'SPECIALIST_BINDING'});
  assert.equal(s.count,0);assert.equal(s.store.list('run').length,0);
});
test('REAL concurrent coordinator / SIMULATED model: separate standalone charters do not expose sibling methods or products',async t=>{
  const intent='Produce two independent closed results, review them, and combine accepted outputs.';
  const seen=[];
  const s=setup(t,({type,task,exposure,request})=>{
    if(type==='plan'){
      const p=forkPlan(intent);for(const [index,n] of p.nodes.slice(0,2).entries()){
        n.roleIds=[];n.specialist={question:`Derive own case ${index}`,methods:[index===0?'ALPHA_PRIVATE_METHOD':'BETA_PRIVATE_METHOD'],
          falsifier:'Missing finite case',expectedBenefit:'Distinct bounded derivation not supplied by an existing facet',completion:'Exact public candidate for independent review'};
      }return p;
    }
    if(type==='review')return review(exposure,task);
    if(['build','challenge'].includes(task.node.id)){
      const own=task.node.id==='build'?'ALPHA_PRIVATE_METHOD':'BETA_PRIVATE_METHOD',sibling=task.node.id==='build'?'BETA_PRIVATE_METHOD':'ALPHA_PRIVATE_METHOD';
      assert.ok(request.instructions.includes(own));assert.ok(!request.instructions.includes(sibling));
      assert.ok(!JSON.stringify(exposure).includes(sibling));assert.equal(exposure.artifacts.length,0);
      seen.push(task.node.id);
    }else assert.deepEqual(exposure.artifacts.map(a=>a.payload.nodeId).sort(),['build','challenge']);
    return final(`Public result for ${task.node.id}`);
  });
  const m=s.engine.create(intent,{allowedTools:[],maxParallelPureNodes:2,producerContext:'node-contract-v1'});
  const result=await s.engine.run(m.id);assert.equal(result.mission.status,'COMPLETED');assert.deepEqual(seen.sort(),['build','challenge']);
  assert.equal(s.count,8);assert.equal(s.store.list('effect').length,0);
});
test('REAL coordinator / SIMULATED model: pure consumers can inspect exact accepted parent production scopes without leaking them to sibling roots',async t=>{
  const intent='Derive two independent products and integrate their accepted versions after checking their recorded input histories.';
  let joint=false;
  const s=setup(t,({type,task,exposure})=>{
    if(type==='plan')return forkPlan(intent);
    if(type==='review')return review(exposure,task);
    const scopes=(exposure.runtimeObservations??[]).filter(o=>o.kind==='artifact-production-scope').map(o=>JSON.parse(o.quoteText).detail);
    if(task.node.id==='deliver'){
      joint=true;assert.deepEqual(scopes.map(x=>x.nodeId).sort(),['build','challenge']);
      for(const detail of scopes){
        const parent=exposure.artifacts.find(a=>a.id===detail.artifactId);
        assert.ok(parent);assert.equal(parent.status,'ACCEPTED');assert.equal(detail.artifactHash,parent.hash);
        for(const attempt of detail.attempts)for(const request of attempt.requests){
          assert.equal(request.producerInput.coverage,'RECORDED');assert.deepEqual(request.producerInput.feedback,[]);
          assert.deepEqual(request.producerInput.corrections,[]);
        }
      }
    }else assert.deepEqual(scopes,[],'Independent producer cannot acquire sibling history');
    assert.ok(!scopes.some(x=>x.nodeId===task.node.id),'No future current-candidate history');
    return final();
  });
  const m=s.engine.create(intent,{allowedTools:[],maxParallelPureNodes:2,producerContext:'node-contract-v1'});
  const result=await s.engine.run(m.id);assert.equal(result.mission.status,'COMPLETED');assert.ok(joint);assert.equal(s.count,8);assert.equal(s.store.list('effect').length,0);
});
test('REAL coordinator / SIMULATED semantic judge: local evidence boundaries and joint convergence match actual exposures after plan correction',async t=>{
  const intent='Produce two independent products without mutual consumption, independently check each, then integrate both accepted products and verify bilateral separation.';
  let planned=0;const scopes=[];
  const s=setup(t,({type,task,exposure,request})=>{
    if(type==='plan'){
      planned++;assert.deepEqual(task.runtimeCapabilities.reviewEvidenceBoundary,reviewEvidenceBoundary());
      assert.match(request.instructions,/impossible evidence dependency/);
      const p=forkPlan(intent);
      for(const n of p.nodes.slice(0,2))n.criteria=[{id:'local',text:planned===1?'Require both sibling production histories here.':'Check this own producer did not consume the other result.'}];
      if(planned===2)assert.equal(task.feedback.length,1);
      return p;
    }
    if(type==='review'){
      if(task.purpose==='plan'){
        const view=task.reviewEvidenceContext;
        assert.equal(view.artifactHash,task.artifactHash);assert.deepEqual(view.boundary,reviewEvidenceBoundary());
        assert.match(request.instructions,/unavailable sibling histories/);
        assert.deepEqual(view.nodes.find(n=>n.nodeId==='build').reviewedProductNodeIds,['build']);
        assert.deepEqual(view.nodes.find(n=>n.nodeId==='deliver').reviewedProductNodeIds,['build','challenge','deliver']);
        if(planned===1)return review(exposure,task,{decision:'RETURN',reason:'SIMULATED semantic diagnosis: root criterion needs an unexposed sibling; preserve full bilateral obligation at convergence.'});
      }else{
        assert.equal(task.reviewEvidenceContext,undefined);
        const observed=exposure.runtimeObservations.filter(o=>o.kind==='artifact-production-scope').map(o=>JSON.parse(o.quoteText).detail.nodeId).sort();
        const candidate=exposure.artifacts.find(a=>a.id===task.candidateId),nodeId=candidate.payload.nodeId;
        assert.deepEqual(observed,nodeId==='deliver'?['build','challenge','deliver']:[nodeId]);scopes.push(nodeId);
      }
      return review(exposure,task);
    }
    if(task.node.id!=='deliver')assert.ok(exposure.artifacts.every(a=>a.payload.nodeId==='planning'),'No sibling product delivered to either producer');
    return final();
  });
  const mission=s.engine.create(intent,{allowedTools:[],maxParallelPureNodes:2}),result=await s.engine.run(mission.id);
  assert.equal(result.mission.status,'COMPLETED');assert.equal(result.mission.intent,intent);assert.equal(planned,2);
  assert.deepEqual(scopes.sort(),['build','challenge','deliver']);
  const plans=s.store.list('artifact').filter(a=>a.data.payload.kind==='mission-plan');assert.equal(plans.length,2);
  for(const a of plans){const p=JSON.parse(a.data.payload.body);assert.equal(p.requirements[0].text,intent);assert.ok(p.nodes.at(-1).criteria.some(c=>c.text===intent));}
  assert.equal(s.store.list('effect').length,0);
});
test('REAL coordinator / SIMULATED model: incompatible plan is retained, rejected before review and corrected without changing request',async t=>{
  const intent='Check this bounded in-memory result independently.';let plans=0;
  const s=setup(t,({type,task,exposure})=>{
    if(type==='plan'){
      plans++;assert.deepEqual(task.runtimeCapabilities.roleExecutionConstraints.map(c=>c.roleId),['omega_07','omega_09','veritas_04']);
      assert.deepEqual(task.knownRoleContracts.cards.map(c=>c.id),['omega_23']);
      const p=makePlan(intent);
      if(plans===1)p.nodes[0].reviewerRoleIds=['veritas_04'];
      else assert.equal(task.feedback.at(-1).failure.code,'ROLE_EXECUTION_UNSUPPORTED');
      return p;
    }
    if(type==='review')return review(exposure,task);
    return final();
  });
  const mission=s.engine.create(intent,{allowedTools:[]}),result=await s.engine.run(mission.id);
  assert.equal(result.mission.status,'COMPLETED');assert.equal(plans,2);assert.equal(s.count,5);
  const rejected=s.store.list('worker-rejected-output');assert.equal(rejected.length,1);
  assert.equal(rejected[0].data.code,'ROLE_EXECUTION_UNSUPPORTED');
  assert.deepEqual(rejected[0].data.payload.nodes[0].reviewerRoleIds,['veritas_04']);
  assert.ok(s.store.list('worker-config').every(r=>!r.data.roleIds.includes('veritas_04')));
  assert.equal(s.store.list('effect').length,0);assert.equal(result.mission.intent,intent);
});
for(const field of ['roleIds','reviewerRoleIds'])test(`REAL coordinator / SIMULATED model: unavailable provenance ${field} is retained before review and recovered with unchanged obligations`,async t=>{
  const intent='Read the supplied description and give a separately reviewed scoped response without effects.';
  let plans=0;
  const s=setup(t,({type,task,exposure})=>{
    if(type==='plan'){
      plans++;
      assert.deepEqual(task.knownRoleContracts.cards,[getRole('omega_23')]);
      assert.equal(task.knownRoleContracts.cardsHash,sha256(task.knownRoleContracts.cards));
      const constraint=task.runtimeCapabilities.roleExecutionConstraints.find(c=>c.roleId==='omega_07');
      assert.equal(constraint.contractHash,sha256(getRole('omega_07')));
      const p=makePlan(intent);
      if(plans===1)p.nodes[0][field]=['omega_07'];
      else assert.equal(task.feedback.at(-1).failure.code,'ROLE_EXECUTION_UNSUPPORTED');
      return p;
    }
    if(type==='review')return review(exposure,task);
    return final();
  });
  const m=s.engine.create(intent,{allowedTools:[],maxPlanAttempts:2}),policy=structuredClone(m.policy);
  const result=await s.engine.run(m.id);
  assert.equal(result.mission.status,'COMPLETED');assert.equal(plans,2);assert.equal(s.count,5);
  assert.equal(result.mission.intent,intent);assert.deepEqual(result.mission.policy,policy);
  const rejected=s.store.list('worker-rejected-output');assert.equal(rejected.length,1);
  assert.deepEqual(rejected[0].data.payload.nodes[0][field],['omega_07']);
  assert.equal(rejected[0].data.payload.requirements[0].text,intent);
  assert.equal(rejected[0].data.code,'ROLE_EXECUTION_UNSUPPORTED');
  assert.ok(s.store.list('worker-config').every(r=>!r.data.roleIds.includes('omega_07')));
  assert.equal(s.store.list('review').length,2,'No paid semantic judgment on the incompatible plan');
  assert.equal(s.store.list('effect').length,0);
  s.reopen();assert.equal((await s.engine.run(m.id)).mission.status,'COMPLETED');assert.equal(s.count,5);
});
test('REAL coordinator / SIMULATED model: repeated incompatible plans stop within budget without any material producer or acceptance',async t=>{
  const intent='Perform a sealed blind replication, preserving that obligation.';
  const s=setup(t,({type})=>{
    assert.equal(type,'plan');const p=makePlan(intent);p.nodes[0].roleIds=['omega_09'];return p;
  });
  const mission=s.engine.create(intent,{allowedTools:[],maxPlanAttempts:2}),result=await s.engine.run(mission.id);
  assert.equal(result.mission.status,'NEEDS_DIRECTION');assert.equal(s.count,2);
  assert.equal(s.store.list('artifact').length,0);assert.equal(s.store.list('node').length,0);
  assert.equal(s.store.list('review').length,0);assert.equal(s.store.list('worker-rejected-output').length,2);
  assert.equal(result.mission.intent,intent);assert.equal(result.mission.finalArtifactId,null);
});
test('REAL coordinator / SIMULATED model: plan judge receives full assigned role contracts, ordinary product judge does not',async t=>{
  const intent='Derive and independently review the supplied closed result.';let observed=false;
  const s=setup(t,({type,task,exposure,request,store})=>{
    if(type==='plan')return makePlan(intent);
    if(type==='review'){
      if(task.purpose==='plan'){
        observed=true;const contracts=task.targetRoleContracts;
        assert.equal(contracts.artifactId,task.candidateId);assert.equal(contracts.artifactHash,task.artifactHash);
        assert.deepEqual(contracts.cards,[getRole('omega_02'),getRole('omega_03')]);
        assert.equal(contracts.cardsHash,sha256(contracts.cards));
        assert.ok(request.instructions.includes('Compare EACH assignment'));
        assert.ok(!contracts.cards.some(c=>c.id==='omega_22'),'The reviewer role is not silently part of the proposed worker team');
        const reviewer=store.list('worker-config').at(-1);
        assert.ok(store.list('worker-config').some(r=>r.data.roleIds.length===1&&r.data.roleIds[0]==='omega_22'));
      }else assert.equal(task.targetRoleContracts,undefined,'No unrelated role-card panel in product review');
      return review(exposure,task);
    }
    return final();
  });
  const mission=s.engine.create(intent,{allowedTools:[]});
  assert.equal((await s.engine.run(mission.id)).mission.status,'COMPLETED');assert.ok(observed);assert.equal(s.count,4);
});
for(const producerContext of ['full-plan','node-contract-v1'])test(`REAL SQLite + SIMULATED model: ${producerContext} exposes exact own contract without rewriting plan provenance`,async t=>{
  const intent='Build, challenge and integrate three independently reviewed products.';
  let frozenPlan;
  const s=setup(t,({type,task,exposure,store,request})=>{
    if(type==='plan'){
      const p=forkPlan(intent);p.routingRationale+=' GLOBAL_ROUTING_SENTINEL';
      for(const n of p.nodes)n.instructions+=` PRIVATE_NODE_${n.id}_SENTINEL`;
      return p;
    }
    if(type==='review'){
      assert.equal(exposure.planViews,undefined,'Review exposure is not silently narrowed');
      assert.ok(exposure.artifacts.some(a=>a.payload.nodeId==='planning'&&a.payload.body.includes('GLOBAL_ROUTING_SENTINEL')));
      return review(exposure,task);
    }
    const acceptedPlan=store.list('artifact').find(r=>r.data.payload.nodeId==='planning').data;
    frozenPlan??=structuredClone(acceptedPlan);
    assert.equal(acceptedPlan.payloadHash,sha256(acceptedPlan.payload));
    assert.equal(exposure.missionIntent,intent);assert.deepEqual(task.node,JSON.parse(acceptedPlan.payload.body).nodes.find(n=>n.id===task.node.id));
    if(producerContext==='node-contract-v1'){
      assert.ok(!exposure.artifacts.some(a=>a.id===acceptedPlan.id));assert.equal(exposure.planViews.length,1);
      const v=exposure.planViews[0];assert.equal(v.artifactHash,acceptedPlan.payloadHash);assert.equal(v.viewHash,sha256(v.view));
      assert.deepEqual(v.view.node,task.node);assert.equal(v.artifactId,acceptedPlan.id);
      assert.equal(request.input.includes('GLOBAL_ROUTING_SENTINEL'),false);
      for(const other of ['build','challenge','deliver'].filter(n=>n!==task.node.id))assert.equal(request.input.includes(`PRIVATE_NODE_${other}_SENTINEL`),false);
      assert.ok(request.instructions.includes('planning dependency may be exposed as planViews'));
      if(task.node.id==='deliver')assert.deepEqual(v.view.requirements,JSON.parse(acceptedPlan.payload.body).requirements);
    }else{
      assert.equal(exposure.planViews,undefined);assert.ok(request.input.includes('GLOBAL_ROUTING_SENTINEL'));
    }
    return final(`Observed simulated product ${task.node.id}.`);
  });
  const m=s.engine.create(intent,{producerContext,allowedTools:[],maxParallelPureNodes:2});s.reopen();
  const result=await s.engine.run(m.id);assert.equal(result.mission.status,'COMPLETED',JSON.stringify(result.mission.pending));
  assert.equal(s.count,8);assert.equal(s.store.get('artifact',frozenPlan.id).data.payloadHash,frozenPlan.payloadHash);
  const candidate=s.store.list('artifact').find(r=>r.data.payload.nodeId==='challenge').data;
  const admission=productionScope(s.registry,candidate.id).attempts[0].contexts[0].artifacts.find(a=>a.nodeId==='planning');
  assert.equal(admission.exposure,producerContext==='node-contract-v1'?'NODE_CONTRACT_VIEW':undefined);
  if(producerContext==='node-contract-v1'){
    assert.equal(admission.viewedNodeId,'challenge');assert.deepEqual(admission.viewedRequirementIds,['r1']);
    assert.equal(admission.viewHash,s.store.get('run',candidate.payload.producerRunId).data.context.planViews[0].viewHash);
  }
  const before=s.count;s.reopen();await s.engine.run(m.id);assert.equal(s.count,before,'No rerun after reopened completed mission');
});
test('node contract requires exact accepted origin and cannot be omitted, erased, changed or reused for another node',async t=>{
  const intent='Produce and independently review all three products.';
  const s=setup(t,({type,task,exposure})=>type==='plan'?forkPlan(intent):review(exposure,task));
  const m=s.engine.create(intent,{producerContext:'node-contract-v1',allowedTools:[]});
  s.engine.ledger.acquireEngine({ownerId:'view-fixture'});try{await s.engine.plan(m);}finally{s.engine.ledger.releaseEngine('view-fixture');}
  const p=s.store.list('artifact').find(r=>r.data.payload.nodeId==='planning').data;
  const args={missionId:m.id,nodeId:'build',mode:'producer',purpose:'build',roleIds:['omega_02'],artifactIds:[p.id]};
  const r=s.engine.workers.createRun(args),original=structuredClone(r.context);
  assert.throws(()=>s.registry.updateContext(r.id,{...r.context,planViews:undefined}),{code:'CONTEXT_ERASURE'});
  const changed=structuredClone(r.context);changed.planViews[0].view.node.instructions='Weakened obligation';changed.planViews[0].viewHash=sha256(changed.planViews[0].view);
  assert.throws(()=>s.registry.updateContext(r.id,changed),{code:'CONTEXT_ERASURE'});
  const without={...r.context};delete without.planViews;
  assert.throws(()=>s.registry.registerRun({...args,context:without}),{code:'PLAN_VIEW'});
  assert.throws(()=>s.registry.registerRun({...args,nodeId:'challenge',context:r.context}),{code:'PLAN_VIEW'});
  assert.throws(()=>s.registry.registerRun({...args,mode:'reviewer',context:r.context}),{code:'PLAN_VIEW'});
  assert.throws(()=>s.registry.registerRun({...args,context:changed}),{code:'PLAN_VIEW'});
  assert.throws(()=>producerPlanView({...p,missionId:'foreign'},{missionId:m.id,nodeId:'build',intent}),{code:'PLAN_VIEW'});
  assert.throws(()=>producerPlanView(p,{missionId:m.id,nodeId:'missing',intent}),{code:'PLAN_VIEW'});
  s.reopen();assert.deepEqual(s.store.get('run',r.id).data.context,original);
  assert.deepEqual(s.engine.workers.context(r.id).planViews,original.planViews);
  assert.throws(()=>s.engine.create('bad',{producerContext:'invented'}),{code:'POLICY'});
  assert.equal(s.engine.create('legacy',{allowedTools:[]}).policy.producerContext,undefined);
});
test('node contract excludes other requirement text but final contract preserves all frozen obligations',async t=>{
  const intent='Build a model. Challenge the model independently. Integrate both results.';
  const s=setup(t,({type,task,exposure})=>{
    if(type!=='plan')return review(exposure,task);
    const p=forkPlan(intent),quotes=['Build a model.','Challenge the model independently.','Integrate both results.'];
    p.requirements=quotes.map((q,i)=>({id:`r${i}`,text:`${q} REQUIREMENT_${i}_SENTINEL`,requestQuote:q,criteria:[{id:'result',text:q}]}));
    p.nodes.forEach((n,i)=>{n.requirementIds=[`r${i}`];});return p;
  });
  const m=s.engine.create(intent,{producerContext:'node-contract-v1',allowedTools:[]});
  s.engine.ledger.acquireEngine({ownerId:'view-fixture'});try{await s.engine.plan(m);}finally{s.engine.ledger.releaseEngine('view-fixture');}
  const p=s.store.list('artifact').find(r=>r.data.payload.nodeId==='planning').data;
  const first=producerPlanView(p,{missionId:m.id,nodeId:'build',intent}),last=producerPlanView(p,{missionId:m.id,nodeId:'deliver',intent});
  assert.deepEqual(first.view.requirements.map(r=>r.id),['r0']);assert.equal(JSON.stringify(first).includes('REQUIREMENT_1_SENTINEL'),false);
  assert.deepEqual(last.view.requirements.map(r=>r.id),['r0','r1','r2']);
  for(const requirement of last.view.requirements)for(const c of requirement.criteria)assert.ok(last.view.node.criteria.some(n=>n.id===`req.${requirement.id}.${c.id}`&&n.text===c.text));
});
test('closed-response entry is explicit and frozen; ordinary missions retain full planning',async t=>{
  const s=setup(t,({type,task,exposure})=>type==='plan'?makePlan(task.originalRequest):type==='review'?review(exposure,task):final());
  assert.throws(()=>s.engine.create('Invalid direct entry',{entryMode:'always-shortcut'}),{code:'POLICY'});
  assert.equal(s.store.list('mission').length,0);
  const direct=s.engine.create('A closed response.',{entryMode:CLOSED_ENTRY_MODE}),ordinary=s.engine.create('Keep ordinary planning.');
  s.reopen();assert.equal(s.engine.status(direct.id).mission.policy.entryMode,CLOSED_ENTRY_MODE);
  assert.equal(ordinary.policy.entryMode,undefined);
  assert.equal((await s.engine.run(ordinary.id)).mission.status,'COMPLETED');
  assert.equal(s.count,4);assert.equal(s.store.get('closed-entry',ordinary.id),null);
});
test('SIMULATED: versioned preset actually drives the combined entry and review after SQLite reentry',async t=>{
  const s=setup(t,({task,exposure,type})=>{
    if(task.entryMode)return {action:'answer',body:'Exact supplied fixture.',reason:'Text-only fixture.'};
    assert.equal(type,'review');return compactCatalogReview(review(exposure,task),task.observedEvidenceCatalog);
  });
  const m=s.engine.create('Return the supplied text: Exact supplied fixture.',{preset:'adaptive-v1',allowedTools:[]});
  assert.deepEqual(m.policy.allowedTools,[]);assert.equal(m.policySelection.effectivePolicyHash,sha256(m.policy));
  s.reopen();const result=await s.engine.run(m.id);assert.equal(result.mission.status,'COMPLETED',JSON.stringify(result.mission.pending));
  assert.equal(s.count,2);assert.equal(result.plan,null);assert.equal(s.store.list('worker-review-encoding')[0].data.encoding,'evidence-catalog-v1');
  const before=s.engine.status(m.id).mission.policySelection;s.reopen();await s.engine.run(m.id);
  assert.equal(s.count,2);assert.deepEqual(s.engine.status(m.id).mission.policySelection,before);
});
test('SIMULATED: observed-catalog review uses actual closed evidence bindings and persists its exact exposure',async t=>{
  const s=setup(t,({type,task,exposure})=>{
    if(task.entryMode)return {action:'answer',body:'Closed fixture result.',reason:'Only supplied text.'};
    assert.equal(type,'review');assert.ok(task.observedEvidenceCatalog.length);
    for(const entry of task.observedEvidenceCatalog)assert.ok([
      ...exposure.artifacts.map(e=>({...e,kind:'artifact'})),...exposure.runtimeObservations.map(e=>({...e,kind:'runtime'}))
    ].some(e=>e.kind===entry.kind&&e.id===entry.id&&e.hash===entry.hash));
    return compactCatalogReview(review(exposure,task),task.observedEvidenceCatalog);
  });
  const mission=s.engine.create('Return the supplied closed text.',{entryMode:CLOSED_ENTRY_MODE,reviewEncoding:'evidence-catalog-v1'});
  s.reopen();const result=await s.engine.run(mission.id);assert.equal(result.mission.status,'COMPLETED',JSON.stringify(result.mission.pending));
  const encoding=s.store.list('worker-review-encoding')[0].data;
  assert.equal(encoding.encoding,'evidence-catalog-v1');assert.equal(encoding.catalogHash,sha256(encoding.observedCatalog));
  const reviewer=s.store.get('run',encoding.runId).data;
  assert.equal(encoding.completedExposureHash,reviewer.completedExposureHash);
  assert.equal(encoding.inferenceReceiptHash,sha256(reviewer.inferenceReceipt));
  assert.equal(s.store.get('worker-config',reviewer.id).data.compilationScope.reviewEncoding,'evidence-catalog-v1');
  assert.equal(s.count,2);
});
test('SIMULATED: catalog mode preserves planning and actual write/independent-read provenance',async t=>{
  let wrote=false;
  const s=setup(t,({type,task,exposure})=>{
    if(type==='plan')return makePlan(task.originalRequest,{tools:['workspace.write','workspace.read'],requiredEffects:[{type:'file',path:'product.txt',command:'',expectedExit:null}]});
    if(type==='review'){
      assert.ok(task.observedEvidenceCatalog.some(e=>e.kind==='artifact'));
      return compactCatalogReview(review(exposure,task),task.observedEvidenceCatalog);
    }
    if(!wrote){wrote=true;return tool('workspace.write',{path:'product.txt',content:'Actual fixture bytes.',expectedHash:null});}
    return final('Delivered product.txt with actual fixture bytes.');
  });
  const mission=s.engine.create('Create product.txt and independently review its current bytes.',{reviewEncoding:'evidence-catalog-v1'});
  const result=await s.engine.run(mission.id);assert.equal(result.mission.status,'COMPLETED',JSON.stringify(result.mission.pending));
  const read=s.store.list('effect').find(r=>r.data.tool==='workspace.read').data;
  const delivered=durableArtifact(s.store,result.outcome.id);
  const finalReview=s.store.get('review',delivered.reviews.at(-1)).data;
  assert.equal(read.principalId,finalReview.reviewerRunId);assert.equal(read.state,'SUCCEEDED');
  assert.equal(s.store.list('worker-review-encoding').length,2);
  const calls=s.count;s.reopen();await s.engine.run(mission.id);assert.equal(s.count,calls);
});
test('SIMULATED: catalog historical producer read cannot replace the reviewer own read',async t=>{
  let produced=0,bad=true;
  const s=setup(t,({type,task,exposure})=>{
    if(type==='plan')return makePlan(task.originalRequest,{tools:['workspace.write','workspace.read'],requiredEffects:[{type:'file',path:'product.txt',command:'',expectedExit:null}]});
    if(type==='review'){
      const result=review(exposure,task);
      if(task.purpose==='deliver'&&bad){
        bad=false;const historic=exposure.toolObservations.find(o=>o.tool==='workspace.read'&&o.relation==='EXTERNAL_OBSERVATION');
        assert.ok(historic);result.checks.forEach(c=>{c.evidence=c.evidence.filter(e=>e.kind!=='tool');c.evidence.push({kind:'tool-history',id:historic.id,hash:historic.hash,quote:historic.quoteText});});
      }else if(task.purpose==='deliver')assert.equal(task.recoveryFeedback[0].code,'UNVERIFIED_WRITE');
      return compactCatalogReview(result,task.observedEvidenceCatalog);
    }
    if(produced++===0)return tool('workspace.write',{path:'product.txt',content:'Actual fixture.',expectedHash:null});
    if(produced===2)return tool('workspace.read',{path:'product.txt'});
    return final('Actual fixture file delivered.');
  });
  const m=s.engine.create('Write product.txt and review its actual current state.',{reviewEncoding:'evidence-catalog-v1'});
  const result=await s.engine.run(m.id);assert.equal(result.mission.status,'COMPLETED',JSON.stringify(result.mission.pending));
  assert.equal(s.store.list('worker-rejected-review').length,1);assert.equal(produced,3);
  assert.equal(s.store.list('effect').filter(e=>e.data.tool==='workspace.write').length,1);
});
test('SIMULATED: wrong exact quote in catalog mode is rejected and repaired in place without replacing candidate',async t=>{
  let bad=true,productions=0;
  const s=setup(t,({task,exposure})=>{
    if(task.entryMode){productions++;return {action:'answer',body:'Literal accepted candidate.',reason:'Closed fixture.'};}
    const encoded=compactCatalogReview(review(exposure,task),task.observedEvidenceCatalog);
    if(bad){bad=false;encoded.evidence[0].quote='This sentence is absent from the candidate.';}
    else {assert.ok(task.recoveryFeedback[0].previousObservedEvidenceCatalog);assert.equal(task.recoveryFeedback[0].code,'REVIEW_EVIDENCE');}
    return encoded;
  });
  const m=s.engine.create('Return the supplied closed text exactly.',{entryMode:CLOSED_ENTRY_MODE,reviewEncoding:'evidence-catalog-v1'});
  const result=await s.engine.run(m.id);assert.equal(result.mission.status,'COMPLETED',JSON.stringify(result.mission.pending));
  assert.equal(productions,1);assert.equal(s.count,3);assert.equal(s.store.list('worker-rejected-review').length,1);
  const encodings=s.store.list('worker-review-encoding').map(r=>r.data);
  assert.equal(encodings.length,2);assert.equal(new Set(encodings.map(e=>e.artifactId)).size,1);
});
test('SIMULATED: direct answer takes two calls, exact criteria and separate review, with durable no-replay delivery',async t=>{
  const s=setup(t,({type,task,exposure,request})=>{
    assert.notEqual(type,'plan','No synthetic or generated plan on direct route');
    if(task.entryMode){
      assert.deepEqual(task.acceptanceCriteria,CLOSED_ENTRY_CRITERIA);assert.deepEqual(task.tools,[]);
      assert.ok(request.instructions.includes('Mando de misión'));assert.ok(request.instructions.includes('Síntesis fiel'));
      return {action:'answer',body:'(12 + 7 + 5) / 3 = 8.',reason:'The three inputs and requested calculation are closed.'};
    }
    assert.equal(type,'review');assert.equal(exposure.missionIntent,'Calcula la media de 12, 7 y 5 sin ejecutar código.');
    assert.equal(exposure.artifacts.length,1);assert.equal(exposure.artifacts[0].payload.kind,'closed-response');
    return review(exposure,task);
  });
  const m=s.engine.create('Calcula la media de 12, 7 y 5 sin ejecutar código.',{entryMode:CLOSED_ENTRY_MODE});
  const result=await s.engine.run(m.id);assert.equal(result.mission.status,'COMPLETED',JSON.stringify(result.mission.pending));
  assert.equal(s.count,2);assert.equal(result.plan,null);assert.equal(result.nodes.length,0);
  assert.equal(result.outcome.payload.body,'(12 + 7 + 5) / 3 = 8.');assert.equal(s.store.list('effect').length,0);
  const checks=s.store.list('review')[0].data.result.checks;assert.equal(checks.length,7);assert.ok(checks.every(c=>c.verdict==='PASS'));
  const report=missionReport(s.store,m.id,{registry:s.registry});
  assert.equal(report.entry,undefined,'Closed-entry controller state is not inferred into the public report');
  assert.doesNotMatch(formatMissionReport(report),/Ruta cerrada sin plan generado/);
  assert.equal(s.store.get('closed-entry',m.id).data.status,'ACCEPTED');
  assert.equal(report.metrics.integrity,'NOT_ATTESTED');assert.equal(report.metrics.completed,undefined);
  const previous=s.store.get('closed-entry',m.id);s.reopen();await s.engine.run(m.id);assert.equal(s.count,2);
  assert.equal(s.store.get('closed-entry',m.id).hash,previous.hash);
});
test('SIMULATED: producer requests planning once without exposing its rejected answer or public reason to planner',async t=>{
  let entries=0;
  const s=setup(t,({type,task,exposure,request})=>{
    if(task.entryMode){entries++;return {action:'plan',body:'',reason:'INADMISSIBLE_PRIVATE_ROUTING_MARKER: request requires a distinct material process.'};}
    assert.ok(!request.input.includes('INADMISSIBLE_PRIVATE_ROUTING_MARKER'));
    assert.ok(exposure.artifacts.every(a=>a.payload.kind!=='closed-response'));
    return type==='plan'?makePlan(task.originalRequest):type==='review'?review(exposure,task):final();
  });
  const m=s.engine.create('Perform the full requested process.',{entryMode:CLOSED_ENTRY_MODE});
  const result=await s.engine.run(m.id);assert.equal(result.mission.status,'COMPLETED',JSON.stringify(result.mission.pending));
  assert.equal(entries,1);assert.equal(s.count,5);assert.equal(s.store.get('closed-entry',m.id).data.disposition.code,'PLANNING_REQUIRED');
  assert.ok(result.plan);assert.equal(s.store.list('artifact').filter(r=>r.data.payload.kind==='closed-response').length,0);
  s.reopen();await s.engine.run(m.id);assert.equal(s.count,5);
});
test('SIMULATED: independent rejection sends unchanged request to full planning; rejected candidate is never an input',async t=>{
  const s=setup(t,({type,task,exposure,request})=>{
    if(task.entryMode)return {action:'answer',body:'WRONG_CLOSED_CANDIDATE',reason:'A deliberately wrong fixture route.'};
    if(type==='review'&&exposure.artifacts.some(a=>a.payload.kind==='closed-response'))return review(exposure,task,{decision:'RETURN',reason:'Required material work is absent.'});
    assert.ok(!request.input.includes('WRONG_CLOSED_CANDIDATE'));
    return type==='plan'?makePlan(task.originalRequest):type==='review'?review(exposure,task):final('Full-path product.');
  });
  const m=s.engine.create('Preserve the full obligation after an unsuitable direct answer.',{entryMode:CLOSED_ENTRY_MODE});
  const result=await s.engine.run(m.id);assert.equal(result.mission.status,'COMPLETED',JSON.stringify(result.mission.pending));
  assert.equal(s.count,6);assert.equal(s.store.get('closed-entry',m.id).data.status,'FALLBACK');
  const rejected=s.store.list('artifact').find(r=>r.data.payload.kind==='closed-response').data;
  assert.equal(rejected.status,'RETURNED');assert.equal(rejected.payload.body,'WRONG_CLOSED_CANDIDATE');
  assert.ok(s.store.list('artifact').every(r=>!r.data.payload.inputRefs.some(ref=>ref.artifactId===rejected.id)));
});
for(const phase of ['plan','plan-review','production','product-review'])
test('SIMULATED provider timeout is waiting, not terminal failure, and preserves recovery at '+phase,async t=>{
  let failed=false,productions=0;
  const s=setup(t,({type,task,exposure})=>{
    const here=type==='plan'?'plan':type==='review'?task.purpose==='plan'?'plan-review':'product-review':'production';
    if(here===phase&&!failed){failed=true;throw Object.assign(Error('Synthetic incomplete provider turn'),{code:'TIMEOUT'});}
    if(type==='plan')return makePlan(task.originalRequest);
    if(type==='review')return review(exposure,task);
    productions++;return final('Preserved exact candidate after an incomplete provider turn.');
  });
  const m=s.engine.create('Complete the bounded product without treating timeout as quality rejection.',{allowedTools:[],maxPlanAttempts:1,maxNodeAttempts:1});
  const first=await s.engine.run(m.id);
  assert.equal(first.mission.status,'WAITING_PROVIDER');assert.equal(first.mission.pending[0].code,'TIMEOUT');
  assert.equal(first.mission.finalArtifactId,null);
  const pending=s.store.list('run').filter(r=>r.data.expectedRequestHash);
  assert.equal(pending.length,1);const pendingRecord=pending[0];
  const savedCandidates=s.store.list('artifact').filter(r=>r.data.status==='CANDIDATE')
    .map(r=>({id:r.id,payloadHash:r.data.payloadHash}));
  assert.equal(s.store.get('planning-progress',m.id).data.qualityFailures,0);
  assert.equal(s.store.list('effect').length,0);
  s.reopen();const second=await s.engine.run(m.id);
  assert.equal(second.mission.status,'COMPLETED',JSON.stringify(second.mission.pending));
  assert.equal(productions,1,'No extra producer after a completed candidate');
  for(const prior of savedCandidates){const a=s.store.get('artifact',prior.id).data;assert.equal(a.status,'ACCEPTED');assert.equal(a.payloadHash,prior.payloadHash);}
  assert.equal(s.store.get('run',pendingRecord.id,pendingRecord.version).hash,pendingRecord.hash,
    'The incomplete historical request is never overwritten with an invented result');
  assert.equal(s.store.list('effect').length,0);
  const report=missionReport(s.store,m.id,{registry:s.registry});
  assert.equal(report.metrics.integrity,'NOT_ATTESTED');
  assert.equal(report.metrics.failed,undefined);assert.equal(report.metrics.dispatched,undefined);assert.equal(report.metrics.completed,undefined);
  assert.equal(s.closed,s.count);s.store.verifyJournal();
});

test('SIMULATED: direct review quota/restart retains exact producer candidate and does not regenerate',async t=>{
  let first=true,productions=0;
  const s=setup(t,({type,task,exposure})=>{
    if(task.entryMode){productions++;return {action:'answer',body:'Closed candidate retained.',reason:'Supplied text only.'};}
    assert.equal(type,'review');if(first){first=false;throw Object.assign(Error('Fixture quota'),{code:'QUOTA'});}
    return review(exposure,task);
  });
  const m=s.engine.create('Respond with the supplied text.',{entryMode:CLOSED_ENTRY_MODE});
  assert.equal((await s.engine.run(m.id)).mission.status,'WAITING_QUOTA');
  const checkpoint=s.store.get('closed-entry',m.id).data;assert.equal(checkpoint.status,'REVIEW_PENDING');
  const artifact=s.store.get('artifact',checkpoint.artifactId).data;
  s.reopen();const result=await s.engine.run(m.id);assert.equal(result.mission.status,'COMPLETED',JSON.stringify(result.mission.pending));
  assert.equal(productions,1);assert.equal(result.outcome.id,artifact.id);assert.equal(result.outcome.payloadHash,artifact.payloadHash);
  assert.equal(s.count,3);assert.equal(s.store.list('effect').length,0);
});
test('SIMULATED: direct production quota resumes with a fresh run and preserves the uncertain inference record',async t=>{
  let first=true;
  const s=setup(t,({task,exposure})=>{
    if(task.entryMode){if(first){first=false;throw Object.assign(Error('Fixture quota'),{code:'QUOTA'});}
      return {action:'answer',body:'Closed result.',reason:'Closed fixture.'};}
    return review(exposure,task);
  });
  const m=s.engine.create('Closed fixture request.',{entryMode:CLOSED_ENTRY_MODE});
  assert.equal((await s.engine.run(m.id)).mission.status,'WAITING_QUOTA');
  const prior=s.store.get('closed-entry',m.id).data;
  s.reopen();assert.equal((await s.engine.run(m.id)).mission.status,'COMPLETED');
  const current=s.store.get('closed-entry',m.id).data;assert.notEqual(current.runId,prior.runId);assert.equal(current.productionAttempts,2);
  assert.ok(s.store.get('run',prior.runId).data.expectedRequestHash);assert.equal(s.count,3);
  assert.equal(s.store.events({limit:1000}).filter(e=>e.kind==='entry.inference.recovered').length,1);
});
test('SIMULATED: a tool proposal cannot perform effects through the closed entry and instead follows full planning',async t=>{
  const s=setup(t,({type,task,exposure})=>{
    if(task.entryMode)return tool('workspace.write',{path:'UNAUTHORIZED.txt',content:'Do not write this',expectedHash:null});
    return type==='plan'?makePlan(task.originalRequest):type==='review'?review(exposure,task):final();
  });
  const m=s.engine.create('A closed response without effects.',{entryMode:CLOSED_ENTRY_MODE});
  assert.equal((await s.engine.run(m.id)).mission.status,'COMPLETED');
  assert.equal(s.store.list('effect').length,0);assert.equal(s.store.get('closed-entry',m.id).data.status,'FALLBACK');
  assert.ok(s.store.list('worker-rejected-output').length);assert.equal(s.count,5);
});
test('SIMULATED: cancellation before accepted direct delivery and revoked acceptance cannot be relabelled completed',async t=>{
  const controller=new AbortController();let interrupt=true;
  const s=setup(t,({type,task,exposure})=>{
    if(task.entryMode)return {action:'answer',body:'Closed result.',reason:'Supplied data.'};
    if(type==='review'&&interrupt){interrupt=false;controller.abort();return review(exposure,task);}
    return type==='plan'?makePlan(task.originalRequest):type==='review'?review(exposure,task):final();
  });
  const m=s.engine.create('Preserve cancellation and later revocation.',{entryMode:CLOSED_ENTRY_MODE});
  assert.equal((await s.engine.run(m.id,{signal:controller.signal,pauseOnAbort:true})).mission.status,'PAUSED');
  assert.equal(s.engine.status(m.id).mission.finalArtifactId,null);
  const completed=await s.engine.run(m.id);assert.equal(completed.mission.status,'COMPLETED');
  s.registry.invalidate([completed.outcome.id],{reason:'Direct response invalidated by exact scoped review.'});
  s.reopen();const result=await s.engine.run(m.id);assert.equal(result.mission.status,'COMPLETED',JSON.stringify(result.mission.pending));
  assert.notEqual(result.outcome.id,completed.outcome.id);assert.ok(result.plan);
  assert.equal(s.store.get('closed-entry',m.id).data.status,'FALLBACK');
  assert.equal(s.store.get('artifact',completed.outcome.id).data.status,'INVALIDATED');
});
test('SIMULATED: checkpoint policy drift fails before any resumed inference',async t=>{
  const s=setup(t,()=>{throw Object.assign(Error('Fixture quota'),{code:'QUOTA'});});
  const m=s.engine.create('Freeze exact entry policy.',{entryMode:CLOSED_ENTRY_MODE});
  await s.engine.run(m.id);assert.equal(s.count,1);
  const stored=s.store.get('mission',m.id);
  s.store.put('mission',m.id,{...stored.data,policy:{...stored.data.policy,maxNodeAttempts:9}},{expectedVersion:stored.version});
  s.reopen();const result=await s.engine.run(m.id),durable=durableMission(s.store,m.id);
  assert.equal(result.mission.status,'UNVERIFIED');assert.deepEqual(result.mission.pending,[]);
  assert.equal(durable.status,'FAILED');assert.equal(durable.pending[0].code,'ENTRY_DRIFT');assert.equal(s.count,1);
});
test('context encoding is explicit durable mission policy, validated before mission creation',async t=>{
  const s=setup(t,()=>{throw Error('No inference expected in this configuration test');});
  assert.throws(()=>s.engine.create('Invalid codec must not persist.',{contextEncoding:'lossy-summary'}),{code:'POLICY'});
  assert.equal(s.store.list('mission').length,0);
  const encoded=s.engine.create('Keep lossless encoding across restart.',{contextEncoding:'lossless-v1'});
  const encodedJson=s.engine.create('Keep exact JSON-contained source bytes across restart.',{contextEncoding:'lossless-json-v2'});
  const ordinary=s.engine.create('Preserve legacy default.');
  assert.equal(ordinary.policy.contextEncoding,undefined);
  s.reopen();assert.equal(s.engine.status(encoded.id).mission.policy.contextEncoding,'lossless-v1');
  assert.equal(s.engine.status(encodedJson.id).mission.policy.contextEncoding,'lossless-json-v2');
  s.engine.workers.contextEncoding='plain-json';
  for(const mode of ['producer','reviewer']){
    const r=s.engine.workers.createRun({missionId:encoded.id,nodeId:mode,mode,purpose:'codec policy qualification',roleIds:['omega_22']});
    assert.equal(s.store.get('worker-config',r.id).data.compilationScope.contextEncoding,'lossless-v1');
    const jr=s.engine.workers.createRun({missionId:encodedJson.id,nodeId:mode,mode,purpose:'JSON codec policy qualification',roleIds:['omega_22']});
    assert.equal(s.store.get('worker-config',jr.id).data.compilationScope.contextEncoding,'lossless-json-v2');
  }
  const pinnedPlain=s.engine.create('Explicit plain encoding overrides a worker default.',{contextEncoding:'plain-json'});
  s.engine.workers.contextEncoding='lossless-v1';
  const r=s.engine.workers.createRun({missionId:pinnedPlain.id,nodeId:'plain',mode:'producer',purpose:'codec policy qualification',roleIds:['omega_22']});
  assert.equal(s.store.get('worker-config',r.id).data.compilationScope.contextEncoding,undefined);
  assert.equal(s.count,0);
});
test('pure-node concurrency is a bounded durable opt-in, not inferred from available providers',t=>{
  const s=setup(t,()=>{throw Error('Configuration test does not infer');});
  for(const maxParallelPureNodes of [0,5,2.5,'2'])assert.throws(()=>s.engine.create('Invalid concurrency',{maxParallelPureNodes}));
  assert.equal(s.store.list('mission').length,0);
  const m=s.engine.create('Two independent pure products.',{maxParallelPureNodes:2});
  const serial=s.engine.create('Keep the established serial default.');
  s.reopen();assert.equal(s.engine.status(m.id).mission.policy.maxParallelPureNodes,2);
  assert.equal(s.engine.status(serial.id).mission.policy.maxParallelPureNodes,undefined);
});
test('SIMULATED: two pure products overlap, remain isolated and both accepted before final consumer',async t=>{
  const started=new Set(),barrier=Promise.withResolvers();let timer;
  t.after(()=>clearTimeout(timer));timer=setTimeout(()=>barrier.reject(Error('Independent producers were serialized')),2500);
  const s=setup(t,async({type,task,exposure,engine})=>{
    if(type==='plan')return forkPlan(task.originalRequest);
    if(type==='review')return review(exposure,task);
    if(task.node.id!=='deliver'){
      started.add(task.node.id);if(started.size===2){clearTimeout(timer);barrier.resolve();}
      await barrier.promise;
      assert.ok(exposure.artifacts.every(a=>a.payload.kind==='mission-plan'),'Sibling product cannot leak into independent producer context');
    }else for(const id of ['build','challenge']){
      const n=engine.store.list('node').find(n=>n.data.nodeId===id).data;
      assert.equal(n.status,'ACCEPTED');assert.ok(exposure.artifacts.some(a=>a.id===n.artifactId));
    }
    return final(`Product ${task.node.id}`);
  });
  const m=s.engine.create('Independently develop two foundations before integration.',{maxParallelPureNodes:2,allowedTools:[]});
  const result=await s.engine.run(m.id);assert.equal(result.mission.status,'COMPLETED',JSON.stringify(result.mission.pending));
  assert.equal(s.store.list('effect').length,0);
  assert.equal(s.store.events({limit:1000}).filter(e=>e.kind==='nodes.parallel.started').length,1);
  const count=s.count;s.reopen();await s.engine.run(m.id);assert.equal(s.count,count);
});
test('SIMULATED: quota aborts a concurrent peer and drains its cleanup before releasing engine; resume preserves quality budgets',async t=>{
  let first=true,drained=false;const both=Promise.withResolvers();
  const s=setup(t,async({type,task,exposure,request})=>{
    if(type==='plan')return forkPlan(task.originalRequest);
    if(type==='review')return review(exposure,task);
    if(first&&task.node.id==='build'){
      await both.promise;first=false;throw Object.assign(Error('Synthetic quota'),{code:'QUOTA'});
    }
    if(first&&task.node.id==='challenge'){
      both.resolve();
      await new Promise(resolve=>request.signal.aborted?resolve():request.signal.addEventListener('abort',resolve,{once:true}));
      await new Promise(resolve=>setTimeout(resolve,20));drained=true;
      throw Object.assign(Error('Synthetic peer cancellation'),{code:'CANCELLED'});
    }
    return final(`Resumed ${task.node.id}`);
  });
  const m=s.engine.create('Keep partial pure work safe across quota.',{maxParallelPureNodes:2,maxNodeAttempts:1,allowedTools:[]});
  const result=await s.engine.run(m.id);assert.equal(result.mission.status,'WAITING_QUOTA');assert.equal(drained,true);assert.equal(s.engine.active,null);
  for(const nodeId of ['build','challenge'])assert.ok(durableNode(s.store,m.id,nodeId).history.some(h=>h.status==='RETURNED'),
    `${nodeId} retains its durable returned history while the public topology withholds it`);
  s.reopen();const resumed=await s.engine.run(m.id);assert.equal(resumed.mission.status,'COMPLETED',JSON.stringify(resumed.mission.pending));
  assert.equal(s.store.list('effect').length,0);
});
test('SIMULATED: an accepted concurrent sibling is reused when another encounters quota',async t=>{
  let quota=true,builds=0;const accepted=Promise.withResolvers();
  const s=setup(t,async({type,task,exposure})=>{
    if(type==='plan')return forkPlan(task.originalRequest);
    if(type==='review')return review(exposure,task);
    if(task.node.id==='build')builds++;
    if(task.node.id==='challenge'&&quota){await accepted.promise;quota=false;throw Object.assign(Error('Synthetic quota after sibling accepted'),{code:'QUOTA'});}
    return final(`Retained ${task.node.id}`);
  });
  s.engine.onEvent=e=>{if(e.kind==='node.accepted'&&e.nodeId==='build')accepted.resolve();};
  const m=s.engine.create('Preserve accepted work when its independent sibling waits.',{maxParallelPureNodes:2,allowedTools:[]});
  const initial=await s.engine.run(m.id);assert.equal(initial.mission.status,'WAITING_QUOTA');assert.equal(builds,1);
  const prior=durableNode(s.store,m.id,'build');assert.equal(prior.status,'ACCEPTED');
  s.reopen();const resumed=await s.engine.run(m.id);assert.equal(resumed.mission.status,'COMPLETED');assert.equal(builds,1);
  assert.equal(durableNode(s.store,m.id,'build').artifactId,prior.artifactId);
});
test('SIMULATED: returned product automatically records an exact-scope learning opportunity without extra inference or promotion',async t=>{
  let rejected=false;
  const s=setup(t,({type,task,exposure})=>{
    if(type==='plan')return makePlan(task.originalRequest);
    if(type==='review'){
      if(task.purpose!=='plan'&&!rejected){rejected=true;return review(exposure,task,{decision:'RETURN',reason:'Synthetic independently observed defect requiring a corrected product.'});}
      return review(exposure,task);
    }
    return final(rejected?'Corrected fixture.':'Initial defective fixture.');
  },{learningProvenancePolicy:learningProvenanceFixturePolicy});
  const scope={roleIds:['omega_02'],purpose:'deliver',mode:'producer'},datasetSpec={missionId:'bounded-eval',evaluatorId:'synthetic-only',cases:[false,true].map(holdout=>({
    id:holdout?'holdout-case':'training-case',input:{taskInstructions:'Fixture comparison, not executed by capture.',input:'{}',schema:{type:'object',properties:{},additionalProperties:false,required:[]},model:'gpt-6-astra',reasoningEffort:'ultra'},
    expected:{},required:true,holdout,criteria:[{metric:'accuracy',direction:'higher',threshold:1}]})),policy:{requireImprovement:true}};
  const domainRequest={domainId:'engine-returned-product',roleId:'omega_02',scope,datasetSpec};
  const source=admitLearningProvenanceFixtureSource(s.store,{missionId:datasetSpec.missionId});
  const domain=s.engine.learning.registerDomain({...domainRequest,provenance:signedLearningProvenanceFixture({service:s.engine.learning,source,...domainRequest})});
  // The provider is deliberately simulated in this test. Production leaves this
  // false, so a simulated receipt can never initiate a real learning cycle.
  s.engine.learningConductor.allowSimulation=true;
  const mission=s.engine.create('Observe a returned product before suggesting instruction changes.'),result=await s.engine.run(mission.id);
  assert.equal(result.mission.status,'COMPLETED',JSON.stringify(result.mission.pending));
  const cycles=s.engine.learningConductor.listInternal();
  assert.equal(cycles.length,1);assert.equal(cycles[0].status,'OBSERVED');assert.equal(cycles[0].policyId,domain.policyId);assert.equal(cycles[0].agentRoleId,'omega_02');assert.equal(cycles[0].evidenceRefs[0].type,'review');
  assert.equal(s.store.list('learning-proposal').length,0);assert.equal(s.engine.learning.registry.getActive(domain.policyId).hash,domain.baseline.hash);
  const count=s.count;await s.engine.run(mission.id);assert.equal(s.count,count);assert.deepEqual(s.engine.learningConductor.listInternal(),cycles);
});
test('SIMULATED models / REAL broker: pure prerequisite keeps scoped no-effects acceptance after downstream file creation',async t=>{
  let writes=0;
  const s=setup(t,({type,task,exposure})=>{
    if(type==='plan'){
      const p=makePlan(task.originalRequest,{two:true});
      p.nodes[0].criteria=[{id:'stage-only',text:'The build prerequisite produces only its in-memory artifact, without file writes or code execution.'}];
      p.nodes[1].tools=['workspace.write','workspace.read'];p.nodes[1].requiredEffects=[{type:'file',path:'delivery.txt',command:'',expectedExit:null}];return p;
    }
    if(type==='produce'){
      if(exposure.purpose==='build')return final('Accepted pure foundation.');
      if(!writes++){return tool('workspace.write',{path:'delivery.txt',content:'Uses the accepted pure foundation.',expectedHash:null});}
      return final('Integrated file from the accepted pure foundation.');
    }
    const result=review(exposure,task);
    if(task.purpose!=='plan'){
      const inventory=exposure.runtimeObservations.find(o=>o.kind==='node-effect-inventory'&&JSON.parse(o.quoteText).detail.nodeId==='build');assert.ok(inventory,'Independent reviewer must receive actual no-effects evidence for the pure prerequisite');
      const detail=JSON.parse(inventory.quoteText).detail;assert.equal(detail.fileWriteCount,0);assert.equal(detail.codeExecutionCount,0);
      if(task.purpose==='deliver')assert.equal(JSON.parse(exposure.runtimeObservations.find(o=>o.kind==='effect-inventory').quoteText).detail.fileWriteCount,1);
      result.checks.forEach(c=>c.evidence.push({kind:'runtime',id:inventory.id,hash:inventory.hash,quote:inventory.quoteText}));
    }
    return result;
  });
  const mission=s.engine.create('First accept a pure in-memory prerequisite, then create delivery.txt from it.'),outcome=await s.engine.run(mission.id);
  assert.equal(outcome.mission.status,'COMPLETED',JSON.stringify(outcome.mission.pending));
  const before=s.count;await s.engine.run(mission.id);assert.equal(s.count,before);
  assert.equal(readFileSync(join(s.workspace(mission.id),'delivery.txt'),'utf8'),'Uses the accepted pure foundation.');
});
test('SIMULATED: opt-in review encoding survives restart; default missions and stored criteria remain unchanged',async t=>{
  const s=setup(t,({type,task,exposure,request})=>{
    if(type==='plan')return makePlan(task.originalRequest);
    if(type==='review')return request.schema.properties.evidence?compactReviewEvidence(review(exposure,task)):review(exposure,task);
    return final();
  });
  assert.throws(()=>s.engine.create('Invalid encoding.',{reviewEncoding:'arbitrary'}),{code:'POLICY'});
  assert.equal(s.store.list('mission').length,0);
  const encoded=s.engine.create('Keep all review evidence.',{reviewEncoding:'evidence-refs-v1'}),ordinary=s.engine.create('Keep established default.');
  s.reopen();assert.equal(s.engine.status(encoded.id).mission.policy.reviewEncoding,'evidence-refs-v1');
  assert.equal(s.engine.status(ordinary.id).mission.policy.reviewEncoding,undefined);
  const result=await s.engine.run(encoded.id);assert.equal(result.mission.status,'COMPLETED',JSON.stringify(result.mission.pending));
  assert.equal(s.store.list('worker-review-encoding').length,2,'Plan and product review use the same pinned transport contract');
  const count=s.count;s.reopen();assert.equal((await s.engine.run(encoded.id)).mission.status,'COMPLETED');assert.equal(s.count,count);
});
test('SIMULATED: a material exhausted method receives a separately reviewed revision without replaying accepted ancestors',async t=>{
  let plans=0,builds=0,deliveries=0,replacementReviewed=false;
  const s=setup(t,({type,task,exposure})=>{
    if(type==='plan'){
      plans++;if(plans===1)return makePlan(task.originalRequest,{two:true});
      assert.equal(task.methodRecovery.failures[0].node.nodeId,'deliver');
      assert.equal(task.methodRecovery.failures[0].review.result.decision,'RETURN');
      const next=structuredClone(task.previousPlan),n=next.nodes.find(n=>n.id==='deliver');
      n.method={id:'reconstruct',rationale:'Reconstruct from accepted input to correct the specifically rejected result',alternatives:['Direct synthesis was rejected']};
      n.instructions+=' Reconstruct the result from the accepted input with an independent arithmetic check.';return next;
    }
    if(type==='review'){
      if(task.purpose==='plan'&&plans===2){assert.ok(task.methodRecoveryContext);assert.ok(task.criteria.some(c=>c.id==='recovery-method'));replacementReviewed=true;}
      return review(exposure,task,{decision:task.purpose==='deliver'&&plans===1?'RETURN':'ACCEPT',reason:'The first synthesis lost a required value; reconstruct from the accepted input.'});
    }
    if(task.node.id==='build'){builds++;return final('Accepted input preserved');}
    deliveries++;if(deliveries===2)assert.equal(replacementReviewed,true);return final('Candidate '+deliveries);
  });
  const m=s.engine.create('Preserve input and reconstruct the correct final result.',{allowedTools:[],maxNodeAttempts:1,maxPlanAttempts:2,
    methodRecovery:{mode:'reviewed-method-v1',maxRounds:1}});
  const result=await s.engine.run(m.id);assert.equal(result.mission.status,'COMPLETED',JSON.stringify(result.mission.pending));
  assert.equal(plans,2);assert.equal(builds,1);assert.equal(deliveries,2);
  assert.equal(s.store.list('method-recovery-round').length,1);assert.equal(s.store.list('method-recovery-completion').length,1);
  const node=durableNode(s.store,m.id,'deliver');assert.equal(node.history.filter(h=>h.status==='RETURNED').length,1);
  assert.deepEqual(result.mission.policy,m.policy);const count=s.count;s.reopen();await s.engine.run(m.id);assert.equal(s.count,count);
});
function revisedMethod(task){
  const p=structuredClone(task.previousPlan),n=p.nodes.find(n=>n.id==='deliver');
  n.instructions+=' Independently reconstruct the answer from the original input and cross-check each retained value.';
  n.method={id:'reconstruct',rationale:'The original synthesis lost a required value; reconstruct and check each value.',alternatives:['Original direct synthesis rejected']};return p;
}
const methodPolicy={allowedTools:[],maxPlanAttempts:1,maxNodeAttempts:1,methodRecovery:{mode:'reviewed-method-v1',maxRounds:1}};
for(const mutation of ['rename','whitespace','criterion','accepted-ancestor'])test(`SIMULATED method recovery: reject ${mutation} without another producer or erased history`,async t=>{
  let plans=0,productions=0;
  const s=setup(t,({type,task,exposure})=>{
    if(type==='plan'){
      plans++;if(plans===1)return makePlan(task.originalRequest,{two:mutation==='accepted-ancestor'});
      const p=revisedMethod(task),n=p.nodes.find(n=>n.id==='deliver');
      if(mutation==='rename')n.instructions=task.previousPlan.nodes.find(n=>n.id==='deliver').instructions;
      if(mutation==='whitespace')n.instructions='  '+task.previousPlan.nodes.find(n=>n.id==='deliver').instructions+'\n';
      if(mutation==='criterion')n.criteria[0].text='An easier local criterion';
      if(mutation==='accepted-ancestor')p.nodes[0].instructions+=' Rewrite already accepted work.';
      return p;
    }
    if(type==='review')return review(exposure,task,{decision:task.purpose==='deliver'?'RETURN':'ACCEPT',reason:'Required value omitted by the original method.'});
    productions++;return final();
  });
  const m=s.engine.create('Retain the exact required values.',methodPolicy),result=await s.engine.run(m.id);
  assert.equal(result.mission.status,'NEEDS_DIRECTION');assert.equal(plans,2);assert.equal(productions,mutation==='accepted-ancestor'?2:1);
  assert.equal(s.store.get('plan',m.id).version,1);assert.equal(s.store.list('method-recovery-completion').length,0);
  const expected=mutation==='criterion'?'MANDATE_DRIFT':mutation==='accepted-ancestor'?'METHOD_RECOVERY_SCOPE':'METHOD_UNCHANGED';
  assert.equal(s.store.get('planning-progress',m.id).data.feedback.at(-1).failure.code,expected);
  const count=s.count;s.reopen();await s.engine.run(m.id);assert.equal(s.count,count,'Reentry cannot reset failed planning budget');
});
test('SIMULATED method recovery: rejection by the new plan judge does not authorize changed production',async t=>{
  let plans=0,productions=0;
  const s=setup(t,({type,task,exposure})=>{
    if(type==='plan')return ++plans===1?makePlan(task.originalRequest):revisedMethod(task);
    if(type==='review')return review(exposure,task,{decision:task.purpose==='plan'&&plans===1?'ACCEPT':'RETURN',reason:'Proposed reconstruction does not address the actual missing evidence.'});
    productions++;return final();
  });
  const m=s.engine.create('Keep the complete evidence obligation.',methodPolicy),result=await s.engine.run(m.id);
  assert.equal(result.mission.status,'NEEDS_DIRECTION');assert.equal(plans,2);assert.equal(productions,1);
  assert.equal(s.store.get('plan',m.id).version,1);assert.equal(s.store.list('method-recovery-completion').length,0);
  assert.equal(s.store.list('artifact').filter(a=>a.data.payload.purpose==='plan'&&a.data.status==='RETURNED').length,1);
});
test('SIMULATED method recovery: quota resumes the exact revised plan candidate without replenishing call budget',async t=>{
  let plans=0,quota=true;
  const s=setup(t,({type,task,exposure})=>{
    if(type==='plan')return ++plans===1?makePlan(task.originalRequest):revisedMethod(task);
    if(type==='review'){
      if(task.purpose==='plan'&&plans===2&&quota){quota=false;throw Object.assign(Error('Controlled quota on revised plan review'),{code:'QUOTA'});}
      return review(exposure,task,{decision:task.purpose==='deliver'&&plans===1?'RETURN':'ACCEPT',reason:'Reconstruct the omitted value.'});
    }
    return final();
  });
  const m=s.engine.create('Retain all values and review each method.',{...methodPolicy,inferenceBudget:{mode:'mission-calls-v1',maxCalls:9}});
  assert.equal((await s.engine.run(m.id)).mission.status,'WAITING_QUOTA');assert.equal(s.count,6);
  const candidate=s.store.get('planning-progress',m.id).data.active.artifactId,origin=s.store.list('method-recovery-round')[0];
  s.reopen();const result=await s.engine.run(m.id);assert.equal(result.mission.status,'COMPLETED',JSON.stringify(result.mission.pending));
  assert.equal(plans,2);assert.equal(s.store.get('plan',m.id).data.acceptedPlanArtifactId,candidate);
  assert.deepEqual(s.store.get('method-recovery-round',origin.id),origin);assert.equal(missionInferenceBudget(s.registry,m.id).reserved,9);
  const count=s.count;s.reopen();await s.engine.run(m.id);assert.equal(s.count,count);
});
test('SIMULATED method recovery: exhausting a revised method cannot buy another round on restart',async t=>{
  let plans=0,productions=0;
  const s=setup(t,({type,task,exposure})=>{
    if(type==='plan')return ++plans===1?makePlan(task.originalRequest):revisedMethod(task);
    if(type==='review')return review(exposure,task,{decision:task.purpose==='deliver'?'RETURN':'ACCEPT',reason:'The revised product still omits a required value.'});
    productions++;return final();
  });
  const m=s.engine.create('Keep the complete requested result.',methodPolicy),result=await s.engine.run(m.id);
  assert.equal(result.mission.pending[0].code,'METHODS_EXHAUSTED');assert.equal(plans,2);assert.equal(productions,2);
  assert.equal(durableNode(s.store,m.id,'deliver').history.filter(h=>h.status==='RETURNED').length,2);
  assert.equal(s.store.list('method-recovery-round').length,1);assert.equal(s.store.list('method-recovery-completion').length,1);
  const count=s.count;s.reopen();await s.engine.run(m.id);assert.equal(s.count,count);assert.deepEqual(s.engine.status(m.id).mission.policy,m.policy);
});
test('SIMULATED method recovery: malformed evidence is not a material finding that authorizes another producer',async t=>{
  let plans=0,productions=0;
  const s=setup(t,({type,task,exposure})=>{
    if(type==='plan'){plans++;return makePlan(task.originalRequest);}
    if(type==='review'){const r=review(exposure,task);if(task.purpose==='deliver')r.checks[0].evidence[0].quote='This passage does not exist in the candidate.';return r;}
    productions++;return final();
  });
  const m=s.engine.create('Keep original production when only a citation is malformed.',methodPolicy),result=await s.engine.run(m.id);
  assert.equal(result.mission.pending[0].code,'METHODS_EXHAUSTED');assert.equal(plans,1);assert.equal(productions,1);
  assert.equal(s.store.list('method-recovery-round').length,0);
});
test('SIMULATED method recovery: installation and completion roll back together then resume an already reviewed candidate',async t=>{
  let plans=0,productions=0;
  const s=setup(t,({type,task,exposure})=>{
    if(type==='plan')return ++plans===1?makePlan(task.originalRequest):revisedMethod(task);
    if(type==='review')return review(exposure,task,{decision:task.purpose==='deliver'&&plans===1?'RETURN':'ACCEPT',reason:'Reconstruct the omitted value.'});
    productions++;return final();
  });
  const m=s.engine.create('Commit the complete method revision atomically.',methodPolicy),put=s.store.put.bind(s.store);
  s.store.put=(type,id,data,options)=>{if(type==='method-recovery-completion')throw Object.assign(Error('Controlled completion commit failure'),{code:'STORAGE_CORRUPTION'});return put(type,id,data,options);};
  assert.equal((await s.engine.run(m.id)).mission.status,'FAILED');assert.equal(s.store.get('plan',m.id).version,1);
  const candidate=s.store.get('planning-progress',m.id).data.active.artifactId;
  assert.equal(s.store.get('artifact',candidate).data.status,'ACCEPTED');assert.equal(productions,1);assert.equal(s.count,6);
  s.reopen();const result=await s.engine.run(m.id);assert.equal(result.mission.status,'COMPLETED',JSON.stringify(result.mission.pending));
  assert.equal(plans,2);assert.equal(productions,2);assert.equal(s.count,8,'Already accepted replacement requires neither another planner nor another plan judge');
  assert.equal(s.store.get('plan',m.id).data.acceptedPlanArtifactId,candidate);assert.equal(s.store.list('method-recovery-completion').length,1);
});
for(const change of ['origin','candidate-binding','accepted-input','plan-withdrawal'])test(`SIMULATED method recovery: ${change} change stops resumed planning before another inference`,async t=>{
  let plans=0;
  const s=setup(t,({type,task,exposure})=>{
    if(type==='plan')return ++plans===1?makePlan(task.originalRequest,{two:true}):revisedMethod(task);
    if(type==='review'){
      if(task.purpose==='plan'&&plans===2)throw Object.assign(Error('Controlled review pause'),{code:'QUOTA'});
      return review(exposure,task,{decision:task.purpose==='deliver'?'RETURN':'ACCEPT',reason:'The synthesis omitted a required value.'});
    }
    return final();
  });
  const m=s.engine.create('Keep accepted input valid during revision.',methodPolicy);
  assert.equal((await s.engine.run(m.id)).mission.status,'WAITING_QUOTA');const count=s.count;
  if(change==='origin'||change==='candidate-binding'){
    const type=change==='origin'?'method-recovery-round':'method-recovery-candidate',record=s.store.list(type)[0];
    s.store.put(type,record.id,{...record.data,forgedAnnotation:'A new record version is not the immutable original.'},{expectedVersion:record.version});
  }else if(change==='accepted-input'){
    s.registry.invalidate([s.store.get('node',`${m.id}:build`).data.artifactId],{reason:'Explicit withdrawal of previously accepted input'});
  }else s.registry.invalidate([s.store.get('plan',m.id).data.acceptedPlanArtifactId],{reason:'Explicit operator withdrawal, not permission to reapprove'});
  s.reopen();const result=await s.engine.run(m.id);assert.equal(s.count,count);
  assert.equal(result.mission.pending[0].code,change==='origin'||change==='candidate-binding'?'METHOD_RECOVERY_INTEGRITY':'METHOD_RECOVERY_STALE');
  assert.equal(result.mission.status,change==='origin'||change==='candidate-binding'?'FAILED':'NEEDS_DIRECTION');
  assert.equal(s.store.list('method-recovery-completion').length,0);
});
test('SIMULATED method recovery: reserving a round does not override the exhausted mission call ceiling',async t=>{
  let plans=0;
  const s=setup(t,({type,task,exposure})=>{
    if(type==='plan'){plans++;return makePlan(task.originalRequest);}
    if(type==='review')return review(exposure,task,{decision:task.purpose==='deliver'?'RETURN':'ACCEPT',reason:'The product omits a necessary input.'});
    return final();
  });
  const m=s.engine.create('Preserve the shared call ceiling.',{...methodPolicy,inferenceBudget:{mode:'mission-calls-v1',maxCalls:4}});
  const result=await s.engine.run(m.id);assert.equal(result.mission.pending[0].code,'INFERENCE_BUDGET_EXHAUSTED');
  assert.equal(plans,1);assert.equal(s.count,4);assert.equal(s.store.list('method-recovery-round').length,1);
  assert.equal(s.store.get('plan',m.id).version,1);assert.equal(s.store.list('method-recovery-completion').length,0);
  s.reopen();await s.engine.run(m.id);assert.equal(s.count,4);assert.equal(missionInferenceBudget(s.registry,m.id).reserved,4);
});
test('SIMULATED: revoked plan triggers independently accepted replan without weakening any frozen requirement',async t=>{
  let plans=0;
  const s=setup(t,({type,task,exposure})=>{
    if(type==='plan'){plans++;const result=makePlan(task.originalRequest);
      if(plans>1){assert.deepEqual(task.previousPlan.requirements,result.requirements);assert.equal(task.recovery.diagnosis.code,'UNACCEPTED_INPUT');result.routingRationale='Reassessed acceptance after exact prior plan was retracted';}
      return result;
    }
    return type==='review'?review(exposure,task):final('Same requested result under its current accepted plan.');
  });
  const mission=s.engine.create('Preserve all original requirements during a replan.'),first=await s.engine.run(mission.id);
  const prior=s.store.get('plan',mission.id);s.registry.invalidate([prior.data.acceptedPlanArtifactId],{reason:'Synthetic accepted plan revocation',recovery:'replan'});
  s.reopen();const result=await s.engine.run(mission.id);
  assert.equal(result.mission.status,'COMPLETED',JSON.stringify(result.mission.pending));assert.equal(plans,2);
  assert.deepEqual(result.plan.requirements,first.plan.requirements);assert.deepEqual(result.mission.policy,mission.policy);
  assert.notEqual(s.store.get('plan',mission.id).data.acceptedPlanArtifactId,prior.data.acceptedPlanArtifactId);
  assert.equal(s.store.get('artifact',prior.data.acceptedPlanArtifactId).data.status,'INVALIDATED');
  assert.equal(s.store.get('plan-recovery',mission.id).data.active,false);
});
test('SIMULATED: replan cannot weaken the frozen mandate even after previous plan revocation',async t=>{
  let plans=0;
  const s=setup(t,({type,task,exposure})=>{
    if(type==='plan'){const result=makePlan(task.originalRequest);if(++plans>1)result.requirements[0].criteria[0].text='An easier replacement';return result;}
    return type==='review'?review(exposure,task):final();
  });
  const mission=s.engine.create('Never weaken the required result.',{maxPlanAttempts:1});await s.engine.run(mission.id);
  const prior=s.store.get('plan',mission.id);s.registry.invalidate([prior.data.acceptedPlanArtifactId],{reason:'Synthetic revocation',recovery:'replan'});
  const result=await s.engine.run(mission.id),durable=durableMission(s.store,mission.id);
  assert.equal(result.mission.status,'UNVERIFIED');assert.deepEqual(result.mission.pending,[]);
  assert.equal(durable.status,'NEEDS_DIRECTION');assert.equal(plans,2);
  assert.equal(s.store.get('plan',mission.id).hash,prior.hash);assert.equal(s.store.get('planning-progress',mission.id).data.feedback.at(-1).failure.code,'MANDATE_DRIFT');
  s.reopen();await s.engine.run(mission.id);assert.equal(plans,2,'A restart cannot reset failed planning attempts');
});
test('SIMULATED: quota during replacement-plan review resumes that exact candidate, not a new plan',async t=>{
  let plans=0,quota=true;
  const s=setup(t,({type,task,exposure})=>{
    if(type==='plan'){plans++;return makePlan(task.originalRequest);}
    if(type==='review'){if(plans>1&&task.purpose==='plan'&&quota){quota=false;throw Object.assign(Error('Synthetic replacement review quota'),{code:'QUOTA'});}return review(exposure,task);}
    return final();
  });
  const mission=s.engine.create('Retain replacement plan across quota.');await s.engine.run(mission.id);
  s.registry.invalidate([s.store.get('plan',mission.id).data.acceptedPlanArtifactId],{reason:'Synthetic revocation',recovery:'replan'});
  const pending=await s.engine.run(mission.id);assert.equal(pending.mission.status,'UNVERIFIED');assert.deepEqual(pending.mission.pending,[]);
  assert.equal(durableMission(s.store,mission.id).status,'WAITING_QUOTA');const candidate=s.store.get('planning-progress',mission.id).data.active.artifactId;
  s.reopen();assert.equal((await s.engine.run(mission.id)).mission.status,'COMPLETED');assert.equal(plans,2);
  assert.equal(s.store.get('plan',mission.id).data.acceptedPlanArtifactId,candidate);assert.equal(s.store.get('plan-recovery',mission.id).data.attempts,1);
});
test('SIMULATED: explicit review retry preserves exhausted history, candidate, policy and files across restart',async t=>{
  let repair=false;
  const s=setup(t,({type,task,exposure})=>{
    if(type==='plan')return makePlan(task.originalRequest,{tools:['workspace.write','workspace.read'],requiredEffects:[{type:'file',path:'result.txt',command:'',expectedExit:null}]});
    if(type==='review')return review(exposure,task,{artifactOnly:task.purpose!=='plan'&&!repair});
    return task.step===0?tool('workspace.write',{path:'result.txt',content:'verified result',expectedHash:null}):final();
  });
  const m=s.engine.create('Create the exact required file.',{maxNodeAttempts:1}),first=await s.engine.run(m.id);
  assert.equal(first.mission.pending[0].code,'METHODS_EXHAUSTED');const candidate=durableNode(s.store,m.id,'deliver').artifactId;
  const before=s.count;assert.equal((await s.engine.run(m.id)).mission.status,'NEEDS_DIRECTION');assert.equal(s.count,before);
  const reason='The fixture reviewer now cites its independent read instead of producer prose.';
  const grant=s.engine.grantReviewRetry(m.id,{nodeId:'deliver',reason});
  assert.deepEqual(s.engine.grantReviewRetry(m.id,{nodeId:'deliver',reason}),grant,'Idempotent authorization does not accumulate extra attempts');
  assert.equal(grant.additionalAttempts,1);assert.equal(s.count,before);
  repair=true;s.reopen();const complete=await s.engine.run(m.id);
  assert.equal(complete.mission.status,'COMPLETED',JSON.stringify(complete.mission.pending));
  assert.equal(complete.outcome.id,candidate);assert.deepEqual(complete.mission.policy,m.policy);
  assert.ok(durableNode(s.store,m.id,'deliver').history.some(h=>h.detail?.code==='UNVERIFIED_WRITE'));
  assert.equal(s.store.list('effect').filter(e=>e.data.tool==='workspace.write').length,1);
  assert.equal(s.store.list('review-retry')[0].data.status,'USED');
  assert.equal(s.store.list('review-retry')[0].data.usedAttempt,2);
});
test('SIMULATED: explicit review grant supplies only one attempt and cannot reset material failure budget',async t=>{
  const s=setup(t,({type,task,exposure})=>{
    if(type==='plan')return makePlan(task.originalRequest,{tools:['workspace.write','workspace.read'],requiredEffects:[{type:'file',path:'result.txt',command:'',expectedExit:null}]});
    if(type==='review')return review(exposure,task,{artifactOnly:task.purpose!=='plan'});
    return task.step===0?tool('workspace.write',{path:'result.txt',content:'verified result',expectedHash:null}):final();
  });
  const m=s.engine.create('Create a verified file.',{maxNodeAttempts:1});await s.engine.run(m.id);
  s.engine.grantReviewRetry(m.id,{nodeId:'deliver',reason:'Try a corrected independent evidence citation, without any new producer.'});
  const retry=await s.engine.run(m.id);assert.equal(retry.mission.pending[0].code,'METHODS_EXHAUSTED');assert.equal(durableNode(s.store,m.id,'deliver').attempt,2);
  const count=s.count;s.reopen();await s.engine.run(m.id);assert.equal(s.count,count);
  assert.equal(s.store.list('effect').filter(e=>e.data.tool==='workspace.write').length,1);
});
test('SIMULATED: real material RETURN cannot be overridden by review-only operator authorization',async t=>{
  const s=setup(t,({type,task,exposure})=>type==='plan'?makePlan(task.originalRequest):type==='review'?review(exposure,task,{decision:task.purpose==='plan'?'ACCEPT':'RETURN',reason:'Substantive required output is wrong'}):final());
  const m=s.engine.create('Produce correct content.',{maxNodeAttempts:1});await s.engine.run(m.id);
  assert.throws(()=>s.engine.grantReviewRetry(m.id,{nodeId:'deliver',reason:'An operator cannot turn substantive failure into evidence success.'}),{code:'REVIEW_RECOVERY_SCOPE'});
  assert.equal(s.store.list('review-retry').length,0);
});
test('SIMULATED: invalidated candidate makes a pending review grant stale without launching production',async t=>{
  const s=setup(t,({type,task,exposure})=>{
    if(type==='plan')return makePlan(task.originalRequest,{tools:['workspace.write','workspace.read'],requiredEffects:[{type:'file',path:'result.txt',command:'',expectedExit:null}]});
    if(type==='review')return review(exposure,task,{artifactOnly:task.purpose!=='plan'});
    return task.step===0?tool('workspace.write',{path:'result.txt',content:'verified result',expectedHash:null}):final();
  });
  const m=s.engine.create('Keep exact reviewed file.',{maxNodeAttempts:1}),first=await s.engine.run(m.id);
  s.engine.grantReviewRetry(m.id,{nodeId:'deliver',reason:'Correct only the previously malformed evidence citation.'});
  s.registry.invalidate([durableNode(s.store,m.id,'deliver').artifactId],{reason:'Explicit fixture retraction'});const count=s.count;
  const result=await s.engine.run(m.id);assert.equal(result.mission.status,'NEEDS_DIRECTION');assert.equal(result.mission.pending[0].code,'RECOVERY_STALE');assert.equal(s.count,count);
});
test('SIMULATED inference / REAL integration: accepted plan → file effect → candidate → independent reread → complete',async t=>{
  const intent='Create result.txt containing verified result.';
  const s=setup(t,({type,task,exposure})=>{
    if(type==='plan')return makePlan(task.originalRequest,{tools:['workspace.write','workspace.read'],two:true,requiredEffects:[{type:'file',path:'result.txt',command:'',expectedExit:null}]});
    if(type==='review')return review(exposure,task);
    if(task.node.id==='build'&&task.step===0)return tool('workspace.write',{path:'result.txt',content:'verified result',expectedHash:null});
    return final('File observation preserved in signed receipt.');
  });
  const m=s.engine.create(intent),result=await s.engine.run(m.id);assert.equal(result.mission.status,'COMPLETED',JSON.stringify(result.mission.pending));
  assert.equal(readFileSync(join(s.workspace(m.id),'result.txt'),'utf8'),'verified result');assert.equal(result.nodes.length,2);assert.ok(result.nodes.every(n=>n.status==='ACCEPTED'));
  const all=s.store.list('artifact'),delivered=durableArtifact(s.store,result.outcome.id);assert.ok(all.every(a=>a.data.status==='ACCEPTED'));assert.ok(delivered.payload.criteria.some(c=>c.id==='req.r1.result'));
  const producer=s.store.get('run',delivered.payload.producerRunId).data,reviewer=s.store.get('run',s.store.get('review',delivered.reviews[0]).data.reviewerRunId).data;
  assert.notEqual(producer.providerThreadId,reviewer.providerThreadId);assert.equal(reviewer.context.producerConversationIncluded,false);assert.equal(s.count,s.closed);
  const before=s.store.list('effect').length,inferences=s.count;s.reopen();const resumed=await s.engine.run(m.id);assert.equal(resumed.mission.status,'COMPLETED');assert.equal(s.store.list('effect').length,before);assert.equal(s.count,inferences);
});
test('SIMULATED inference / REAL queue: operational evidence is exposed, cited and still usable after queue completion',async t=>{
  const s=setup(t,({type,task,exposure})=>{
    assert.ok(exposure.runtimeObservations.some(o=>o.kind==='queue-history'));
    if(type==='plan')return makePlan(task.originalRequest);
    if(type==='review'){
      const result=review(exposure,task);
      const observations=exposure.runtimeObservations.filter(o=>o.kind==='queue-history'||task.purpose!=='plan');
      result.checks[0].evidence.push(...observations.map(o=>({kind:'runtime',id:o.id,hash:o.hash,quote:o.quoteText})));
      return result;
    }
    return final('42');
  });
  const queue=new MissionQueue({engine:s.engine}),job=queue.submit('Return 42 through this actual local fixture queue.');queue.acquire();
  try{assert.equal((await queue.runNext()).status,'COMPLETED');}finally{queue.release();}
  const result=s.engine.status(job.missionId);assert.equal(result.outcome.payload.body,'42');
  assert.ok(s.registry.assertUsable(result.outcome.id,{missionId:job.missionId,purpose:'deliver'}));
  assert.equal((await s.engine.run(job.missionId)).mission.status,'COMPLETED');
});
test('SIMULATED factual request: broker-fetched exact source precedes accepted factual claim',async t=>{
  const s=setup(t,({type,task,exposure})=>{
    if(type==='plan')return makePlan(task.originalRequest,{tools:['source.fetch']});if(type==='review')return review(exposure,task);
    if(task.step===0)return tool('source.fetch',{url:'https://example.com/fixture'});const source=exposure.sources[0];
    return final('The synthetic record says value is 12.',[{id:'value',text:'Recorded value is 12.',kind:'fact',sources:[{sourceId:source.id,hash:source.hash,quote:source.raw}],basis:[],qualifiers:['Synthetic transport fixture, not live internet.'],validUntil:null}]);
  });
  const m=s.engine.create('Report the value in the acquired fixture.'),r=await s.engine.run(m.id);assert.equal(r.mission.status,'COMPLETED',JSON.stringify(r.mission.pending));assert.equal(s.store.list('source').length,1);assert.equal(r.plan.nodes.length,1);
  const source=s.store.list('source')[0].data;s.registry.retractSource(source.id,'Synthetic retraction');assert.throws(()=>s.registry.assertUsable(r.outcome.id,{missionId:m.id,purpose:'deliver'}));
});
test('SIMULATED: omitted request requirement rejected by independent plan review never completes',async t=>{
  const s=setup(t,({type,task,exposure})=>{
    if(type==='plan'){const p=makePlan(task.originalRequest);p.requirements[0].text='Only first part';p.requirements[0].requestQuote='first part';return p;}
    if(type==='review')return review(exposure,task,{decision:'RETURN',reason:'Missing required second part'});throw Error('No product work before accepted mandate');
  });
  const m=s.engine.create('Do first part and required second part.',{maxPlanAttempts:2}),r=await s.engine.run(m.id);assert.equal(r.mission.status,'NEEDS_DIRECTION');assert.equal(r.plan,null);assert.equal(r.mission.finalArtifactId,null);assert.equal(s.store.list('effect').length,0);
});
test('SIMULATED: plan normalization is independently reviewed once and frozen across restart',async t=>{
  const s=setup(t,({type,task,exposure,request})=>{
    if(type==='plan'){
      assert.match(request.instructions,/do not paraphrase the same obligation into additional checks/);
      const p=makePlan(task.originalRequest);
      p.nodes[0].criteria.push({id:'distinct',text:'Disclose any unverified assumptions.'});
      return p;
    }
    if(type==='review'){
      const a=exposure.artifacts.find(a=>a.id===task.candidateId);
      const criteria=task.purpose==='plan'?JSON.parse(a.payload.body).nodes[0].criteria:a.payload.criteria;
      assert.deepEqual(criteria.map(c=>c.id),['req.r1.result','distinct']);
      return review(exposure,task);
    }
    assert.deepEqual(task.node.criteria.map(c=>c.id),['req.r1.result','distinct']);
    return final('Requested result; all remaining uncertainty disclosed in this simulated case.');
  });
  const m=s.engine.create('Keep the complete result and independent acceptance.');
  const r=await s.engine.run(m.id);assert.equal(r.mission.status,'COMPLETED');
  const normalized=s.store.events({limit:1000}).filter(e=>e.kind==='planning.coverage.normalized');
  assert.equal(normalized.length,1);assert.equal(normalized[0].data.criteriaAfter,2);
  assert.equal(normalized[0].data.legacyFinalCriterionCount,3);
  const accepted=s.store.get('plan',m.id).data.acceptedPlanArtifactId;
  assert.equal(normalized[0].data.artifactId,accepted);
  assert.equal(normalized[0].data.normalizedPlanHash,sha256(r.plan));
  const count=s.count,hash=s.store.get('plan',m.id).hash;
  s.reopen();assert.equal((await s.engine.run(m.id)).mission.status,'COMPLETED');
  assert.equal(s.count,count);assert.equal(s.store.get('plan',m.id).hash,hash);
});
test('SIMULATED: reviewer RETURN is retained and next producer corrects without weakening criteria',async t=>{
  let returned=false;const s=setup(t,({type,task,exposure})=>{
    if(type==='plan')return makePlan(task.originalRequest);if(type==='review'){
      if(task.purpose!=='plan'&&!returned){returned=true;return review(exposure,task,{decision:'RETURN',reason:'Specific fixture defect'});}return review(exposure,task);
    }
    if(returned){assert.ok(task.feedback.some(f=>f.findings?.some(x=>x.description==='Specific fixture defect')));return final('Corrected fixture result');}return final('Initial fixture defect');
  });
  const m=s.engine.create('Deliver a corrected fixture result.'),r=await s.engine.run(m.id),node=durableNode(s.store,m.id,'deliver');
  assert.equal(r.mission.status,'COMPLETED');assert.equal(node.attempt,2);assert.ok(node.history.some(h=>h.status==='RETURNED'));assert.equal(r.outcome.payload.body,'Corrected fixture result');
});
test('SIMULATED: final-local proposal [] becomes a complete independently reviewed frozen plan, never an empty acceptance gate',async t=>{
  const s=setup(t,({type,task,exposure,request})=>{
    if(type==='plan'){
      assert.match(request.instructions,/Do not copy requirement criteria into the final node/);
      const p=makePlan(task.originalRequest,{two:true});p.nodes[1].criteria=[];
      p.requirements[0].criteria.push({id:'unknowns',text:'Disclose remaining uncertainty.',evaluation:'content'});
      return p;
    }
    if(type==='review'){
      const candidate=exposure.artifacts.find(a=>a.id===task.candidateId);
      const criteria=task.purpose==='plan'?JSON.parse(candidate.payload.body).nodes[1].criteria:task.purpose==='deliver'?task.criteria:null;
      if(criteria)assert.deepEqual(criteria.map(c=>c.id),['req.r1.result','req.r1.unknowns']);
      return review(exposure,task);
    }
    if(task.node.id==='deliver')assert.deepEqual(task.node.criteria.map(c=>c.id),['req.r1.result','req.r1.unknowns']);
    return final('Complete simulated result, with uncertainty disclosed.');
  });
  const m=s.engine.create('Preserve both required parts while avoiding duplicate proposal text.');
  const result=await s.engine.run(m.id);assert.equal(result.mission.status,'COMPLETED');
  const event=s.store.events({limit:1000}).find(e=>e.kind==='planning.coverage.normalized');
  assert.equal(event.data.criteriaBefore,0);assert.equal(event.data.criteriaAfter,2);
  assert.deepEqual(event.data.added,['req.r1.result','req.r1.unknowns']);
  const accepted=s.store.get('artifact',s.store.get('plan',m.id).data.acceptedPlanArtifactId).data;
  assert.equal(JSON.parse(accepted.payload.body).nodes[1].criteria.length,2);
  const count=s.count;s.reopen();await s.engine.run(m.id);assert.equal(s.count,count);
});
for(const producerBatch of [undefined,'read-test-v1'])test(`SIMULATED: ${producerBatch??'baseline'} planning/production guidance agrees and adds no authority`,async t=>{
  const s=setup(t,({type,task,exposure,request})=>{
    if(type==='plan'){
      assert.equal(request.instructions.includes('read-test-v1'),producerBatch!==undefined);
      assert.equal(request.instructions.includes('dependent writes, execution.run or source.search'),producerBatch===undefined);
      assert.deepEqual(task.allowedTools,[]);return makePlan(task.originalRequest);
    }
    if(type==='review')return review(exposure,task);
    assert.equal(request.instructions.includes('read-test-v1'),producerBatch!==undefined);
    assert.equal(request.instructions.includes('Never batch execution.run'),producerBatch===undefined);
    return final();
  });
  const m=s.engine.create('Keep the exact bounded task; batching is not permission.',{allowedTools:[],...(producerBatch?{producerBatch}:{})});
  const result=await s.engine.run(m.id);assert.equal(result.mission.status,'COMPLETED',JSON.stringify(result.mission.pending));
  assert.equal(s.count,4);assert.equal(s.store.list('effect').length,0);
  for(const config of s.store.list('worker-config')){
    assert.equal(config.data.compilationScope.producerBatch,producerBatch);
    assert.deepEqual(config.data.learnedInstructionVersions,[]);
  }
  const count=s.count;s.reopen();await s.engine.run(m.id);assert.equal(s.count,count);
});
test('SIMULATED: partial-order planning guidance retains authority and accepted data dependencies',async t=>{
  const s=setup(t,({type,task,exposure,request,engine})=>{
    if(type==='plan'){
      for(const clause of ['partial order of actual dependencies','different disjoint file',
        'concrete data dependency','explicit user requirement','observed expectedHash',
        'stop on failures','not parallel execution or an atomic transaction',
        'A dependency that genuinely changes later arguments must never be removed'])assert.ok(request.instructions.includes(clause),clause);
      assert.deepEqual(task.allowedTools,[],'Scheduling guidance never grants a tool');
      return makePlan(task.originalRequest,{two:true});
    }
    if(type==='review')return review(exposure,task);
    if(task.node.id==='deliver'){
      const build=engine.store.list('node').find(n=>n.data.nodeId==='build')?.data;
      assert.equal(build.status,'ACCEPTED','Actual accepted dependency remains mandatory');
      assert.ok(exposure.artifacts.some(a=>a.id===build.artifactId));
    }
    return final();
  });
  const m=s.engine.create('Produce a prerequisite, then compose from that accepted prerequisite.',{allowedTools:[]});
  const result=await s.engine.run(m.id);
  assert.equal(result.mission.status,'COMPLETED',JSON.stringify(result.mission.pending));
  assert.equal(result.plan.nodes.length,2);
  assert.equal(result.plan.nodes[1].dependencies[0].nodeId,'build');
  assert.equal(s.store.list('effect').length,0);
});
test('SIMULATED: quota checkpoint and SQLite reopen preserve request and criteria',async t=>{
  let quota=true;const s=setup(t,({type,task,exposure})=>{
    if(type==='plan')return makePlan(task.originalRequest);if(type==='review')return review(exposure,task);if(quota){quota=false;throw Object.assign(Error('Synthetic quota'),{code:'QUOTA'});}return final();
  });
  const m=s.engine.create('Keep this exact requirement through quota.'),r=await s.engine.run(m.id);assert.equal(r.mission.status,'WAITING_QUOTA');
  const frozenPlan=s.store.get('plan',m.id).data.plan,planHash=sha256(frozenPlan),criteria=JSON.stringify(frozenPlan.nodes[0].criteria);
  s.reopen();const resumed=await s.engine.run(m.id),delivered=durableArtifact(s.store,resumed.outcome.id);
  assert.equal(resumed.mission.status,'COMPLETED');assert.equal(resumed.mission.intent,m.intent);assert.equal(resumed.mission.intentHash,m.intentHash);
  assert.equal(sha256(s.store.get('plan',m.id).data.plan),planHash);assert.equal(JSON.stringify(delivered.payload.criteria),criteria);
});
test('SIMULATED planning response survives interruption before candidate creation without another plan call',async t=>{
  const privateRationale='PRIVATE_LEGACY_CLOSED_PLAN_SENTINEL';let plans=0;const s=setup(t,({type,task,exposure})=>{if(type==='plan'){plans++;const plan=makePlan(task.originalRequest);plan.routingRationale=privateRationale;return plan;}if(type==='review')return review(exposure,task);return final();});
  const create=s.registry.create.bind(s.registry);let interrupted=false;
  s.registry.create=options=>{if(options.nodeId==='planning'&&!interrupted){interrupted=true;throw Object.assign(Error('Injected interruption after completed response, before candidate'),{code:'TRANSIENT_PROVIDER'});}return create(options);};
  const mission=s.engine.create('Preserve this actual plan response before creating its candidate.',{allowedTools:[]});
  const first=await s.engine.run(mission.id);assert.equal(first.mission.status,'WAITING_PROVIDER');
  const active=s.store.get('planning-progress',mission.id).data.active;
  assert.equal(active.artifactId,null);assert.equal(s.store.list('planning-response').length,1);
  const raw=s.store.list('planning-response').at(-1),cleanup=s.store.list('planning-provider-cleanup').find(r=>r.data.runId===active.runId),origin=s.store.list('planning-cleanup-origin').find(r=>r.data.runId===active.runId);
  assert.equal(cleanup.data.status,'CLOSED');assert.equal(cleanup.data.outcome,'RETAINED');
  assert.deepEqual(cleanup.data.outcomeRecord,{type:raw.type,id:raw.id,version:raw.version,hash:raw.hash});
  const sequence=r=>s.registry.committedSequence(r.type,r.id,r.version);
  assert.ok(sequence(origin)<sequence(raw));assert.ok(sequence(raw)<sequence(cleanup));
  const reportBefore=s.store.verifyJournal(),report=missionReport(s.store,mission.id,{registry:s.registry});
  assert.equal(report.planningCleanup,undefined,'Legacy planner cleanup custody has no generic public projection');
  assert.ok(!JSON.stringify(report).includes(privateRationale));assert.deepEqual(s.store.verifyJournal(),reportBefore);
  assert.equal(s.store.list('artifact').length,0);assert.equal(plans,1);
  const recovered=readPlanningResponse(s.registry,active.runId);recovered.value.nodes[0].instructions='MUTATED RETURN';
  assert.equal(readPlanningResponse(s.registry,active.runId).value.nodes[0].instructions,mission.intent);
  await assert.rejects(s.engine.workers.infer({runId:active.runId,retention:PLANNING_RESPONSE_RETENTION,instructions:'Do not replace',input:'{}',schema:{type:'object'},validate:()=>true}),{code:'PLANNING_RESPONSE_INTEGRITY'});
  assert.equal(s.count,1,'No second dispatch over an existing final plan response');
  s.reopen();const resumed=await s.engine.run(mission.id);assert.equal(resumed.mission.status,'COMPLETED',JSON.stringify(resumed.mission.pending));
  assert.equal(plans,1,'Recover the recorded response, not a new model plan');assert.equal(s.count,4);
  const accepted=s.store.get('artifact',s.store.get('plan',mission.id).data.acceptedPlanArtifactId).data;
  assert.equal(accepted.payload.producerRunId,active.runId);assert.equal(accepted.reviews.length,1);
  assert.equal(s.store.get('planning-progress',mission.id).data.attempts,1);
  assert.equal(s.store.events({limit:10000}).filter(e=>e.kind==='planning.attempt').length,1,'Recovery is not reported as another planning attempt');
  assert.equal(s.store.list('planning-response').length,1,'Other producers/reviewers do not retain planning responses');
  s.reopen();await s.engine.run(mission.id);assert.equal(s.count,4);
});
test('SIMULATED planning close barrier retains a response across post-retention telemetry failure without another plan call',async t=>{
  const intent='Preserve the exact retained plan when its completion telemetry fails after response storage.';let plans=0;
  const s=setup(t,({type,task,exposure})=>{
    if(type==='plan'){plans++;return makePlan(task.originalRequest);}
    if(type==='review')return review(exposure,task);
    return final();
  });
  const append=s.store.append.bind(s.store);let interrupted=false;
  s.store.append=(kind,data)=>{
    if(!interrupted&&kind==='worker.inference.completed'&&s.store.get('run',data.runId)?.data.nodeId==='planning'){
      interrupted=true;throw Object.assign(Error('Injected planning telemetry failure after durable response retention'),{code:'TIMEOUT'});
    }
    return append(kind,data);
  };
  const mission=s.engine.create(intent,{allowedTools:[]}),first=await s.engine.run(mission.id);
  assert.equal(interrupted,true);assert.equal(first.mission.status,'WAITING_CAPABILITY');assert.equal(first.mission.pending[0].code,'PLANNING_RESPONSE_PERSISTENCE');
  const active=s.store.get('planning-progress',mission.id).data.active,raw=s.store.list('planning-response').find(r=>r.data.runId===active.runId);
  const run=s.store.get('run',active.runId).data,cleanup=s.store.list('planning-provider-cleanup').find(r=>r.data.runId===active.runId),
    origin=s.store.list('planning-cleanup-origin').find(r=>r.data.runId===active.runId),sequence=r=>s.registry.committedSequence(r.type,r.id,r.version);
  assert.ok(raw,'The exact plan response remains durable despite the diagnostic event failure');
  assert.equal(run.expectedRequestHash,null);assert.equal(run.inferenceReceipts.length,1);assert.equal(s.store.list('planning-response-failure').length,0);
  assert.equal(cleanup.data.status,'CLOSED');assert.equal(cleanup.data.outcome,'RETAINED');
  assert.deepEqual(cleanup.data.outcomeRecord,{type:raw.type,id:raw.id,version:raw.version,hash:raw.hash});
  assert.ok(sequence(origin)<sequence(raw));assert.ok(sequence(raw)<sequence(cleanup));
  assert.equal(planningResponses.readPlanningCleanupObservation(s.registry,{runId:active.runId,requestHash:raw.data.requestHash,
    retention:PLANNING_RESPONSE_RETENTION}).publicState,'AVAILABLE');
  assert.equal(s.store.list('artifact').length,0);assert.equal(plans,1);assert.equal(s.count,1);assert.equal(s.closed,1);
  s.reopen();const resumed=await s.engine.run(mission.id);
  assert.equal(resumed.mission.status,'COMPLETED',JSON.stringify(resumed.mission.pending));
  assert.equal(plans,1,'Recovery consumes the sealed response rather than commissioning another plan');
  assert.equal(s.count,4,'One original plan, plan review, producer and final review');
  const accepted=s.store.get('artifact',s.store.get('plan',mission.id).data.acceptedPlanArtifactId).data;
  assert.equal(accepted.payload.producerRunId,active.runId);assert.equal(s.store.get('planning-progress',mission.id).data.attempts,1);
  assert.equal(s.store.events({limit:10000}).filter(e=>e.kind==='planning.attempt').length,1);
  assert.equal(s.store.list('planning-response').length,1);
});
test('SIMULATED planning response storage failure becomes a closed unretained outcome, not a replacement opportunity',async t=>{
  const s=setup(t,({type,task,exposure})=>type==='plan'?makePlan(task.originalRequest):type==='review'?review(exposure,task):final());
  const put=s.store.put.bind(s.store);s.store.put=(type,...args)=>{if(type==='planning-response')throw Object.assign(Error('Injected response storage failure'),{code:'TRANSIENT_PROVIDER'});return put(type,...args);};
  const mission=s.engine.create('Keep response and receipt atomic.',{allowedTools:[]}),first=await s.engine.run(mission.id);
  assert.equal(first.mission.status,'WAITING_CAPABILITY');assert.equal(first.mission.pending[0].code,'PLANNING_RESPONSE_PERSISTENCE');
  const active=s.store.get('planning-progress',mission.id).data.active,run=s.store.get('run',active.runId).data;
  assert.equal(s.store.list('planning-response').length,0);assert.equal(s.store.list('artifact').length,0);
  assert.ok(run.expectedRequestHash);assert.equal(run.inferenceReceipt,undefined);assert.equal(run.inferenceReceipts,undefined);
  const cleanup=s.store.list('planning-provider-cleanup').find(r=>r.data.runId===active.runId);
  assert.equal(cleanup.data.status,'CLOSED');assert.equal(cleanup.data.outcome,'RESPONSE_UNRETAINED');assert.equal(cleanup.data.outcomeRecord,null);
  const reportBefore=s.store.verifyJournal(),report=missionReport(s.store,mission.id,{registry:s.registry});
  assert.equal(report.planningCleanup,undefined,'Legacy planner cleanup custody has no generic public projection');
  assert.deepEqual(s.store.verifyJournal(),reportBefore);
  assert.equal(s.count,1);s.store.verifyJournal();
  // A restart cannot infer that a response was absent just because its local
  // retention failed.  Preserve the original dispatch and require direction.
  s.reopen();const blocked=await s.engine.run(mission.id);
  assert.equal(blocked.mission.status,'NEEDS_DIRECTION');assert.equal(blocked.mission.pending[0].code,'INFERENCE_OUTCOME_UNKNOWN');assert.equal(s.count,1);
});
for(const contextEncoding of ['plain-json','lossless-v1','lossless-json-v2','source-text-v1'])
test('completed planning role coverage binds the original proposal to its exact retained '+contextEncoding+' request',async t=>{
  const s=setup(t,({task})=>{const p=makePlan(task.originalRequest);p.nodes[0].roleIds=['omega_23'];p.nodes[0].reviewerRoleIds=['omega_22'];return p;});
  s.registry.create=()=>{throw Object.assign(Error('Synthetic pause before candidate'),{code:'TRANSIENT_PROVIDER'});};
  const m=s.engine.create('Inspect contract presence without claiming the assignment fits.',{allowedTools:[],contextEncoding});
  assert.equal((await s.engine.run(m.id)).mission.status,'WAITING_PROVIDER');
  const runId=s.store.get('planning-progress',m.id).data.active.runId,journal=s.store.verifyJournal();
  const proof=planningResponses.readPlanningContractCoverage(s.registry,runId);
  assert.equal(proof.schema,'sovereign.completed-planning-role-coverage.v1');assert.equal(proof.runId,runId);
  assert.equal(proof.requestHash,s.store.list('planning-response')[0].data.requestHash);
  assert.equal(proof.responseRecord.hash,s.store.list('planning-response')[0].hash);
  assert.equal(proof.requestRecord.hash,s.store.list('inference-request')[0].hash);
  assert.deepEqual(proof.coverage.requiredRoleIds,['omega_22','omega_23']);assert.equal(proof.coverage.complete,false);
  assert.deepEqual(proof.coverage.included.map(c=>c.id),['omega_23']);assert.deepEqual(proof.coverage.missingRoleIds,['omega_22']);
  assert.match(proof.scope,/not.*acceptance/);assert.deepEqual(s.store.verifyJournal(),journal);assert.equal(s.count,1);
  proof.coverage.included[0].locations.push('UNVERIFIED');
  assert.deepEqual(planningResponses.readPlanningContractCoverage(s.registry,runId).coverage.included[0].locations,['knownRoleContracts']);
  assert.equal(planningResponses.readPlanningContractCoverage(s.registry,'run:no-durable-planning-response'),null);
  assert.equal(s.store.db.isTransaction,false);
});
test('completed planning role coverage distinguishes complete recovery cards from the earlier directory-only proposal',async t=>{
  let plans=0;const s=setup(t,({type,task,exposure})=>{if(type==='plan'){plans++;return makePlan(task.originalRequest);}return review(exposure,task,{decision:'RETURN',reason:'Synthetic planning return for contract-exposure recovery fixture, not a semantic finding.'});});
  const create=s.registry.create.bind(s.registry);s.registry.create=options=>{if(options.nodeId==='planning'&&plans===2)throw Object.assign(Error('Synthetic pause after second response'),{code:'TRANSIENT_PROVIDER'});return create(options);};
  const m=s.engine.create('Compare exact contract presence on separate attempts.',{allowedTools:[]});
  assert.equal((await s.engine.run(m.id)).mission.status,'WAITING_PROVIDER');assert.equal(plans,2);
  const runId=s.store.get('planning-progress',m.id).data.active.runId;
  const prior=s.store.list('planning-response').find(r=>r.data.runId!==runId).data.runId;
  assert.equal(planningResponses.readPlanningContractCoverage(s.registry,prior).coverage.complete,false);
  const proof=planningResponses.readPlanningContractCoverage(s.registry,runId);assert.equal(proof.coverage.complete,true);
  assert.deepEqual(proof.coverage.requiredRoleIds,['omega_02','omega_03']);assert.deepEqual(proof.coverage.missingRoleIds,[]);
  assert.ok(proof.coverage.included.every(c=>JSON.stringify(c.locations)===JSON.stringify(['rejectedRoleContracts'])));
  assert.equal(s.store.list('artifact').length,1,'The coverage diagnostic did not create or accept the second plan');
  assert.equal(s.store.list('artifact')[0].data.status,'RETURNED');assert.equal(s.count,3);
});
test('completed planning role coverage rejects a shortened card even within an actually completed bound request',async t=>{
  const s=setup(t,({task})=>makePlan(task.originalRequest)),infer=s.engine.workers.infer.bind(s.engine.workers);
  s.engine.workers.infer=options=>{const task=JSON.parse(options.input);delete task.knownRoleContracts.cards[0].inputContract;
    task.knownRoleContracts.cardsHash=sha256(task.knownRoleContracts.cards);return infer({...options,input:JSON.stringify(task)});};
  s.registry.create=()=>{throw Object.assign(Error('Synthetic pause before candidate'),{code:'TRANSIENT_PROVIDER'});};
  const m=s.engine.create('Completion of a request does not make a partial card complete.',{allowedTools:[]});
  assert.equal((await s.engine.run(m.id)).mission.status,'WAITING_PROVIDER');const runId=s.store.get('planning-progress',m.id).data.active.runId;
  assert.ok(readPlanningResponse(s.registry,runId),'The response/request receipt is genuinely bound in this synthetic fixture');
  assert.throws(()=>planningResponses.readPlanningContractCoverage(s.registry,runId),{code:'PLANNING_CONTRACT_INTEGRITY'});
  assert.equal(s.store.db.isTransaction,false);assert.equal(s.store.list('artifact').length,0);assert.equal(s.count,1);
});
test('SIMULATED altered durable planning response fails closed without a replacement planning call',async t=>{
  let plans=0;const s=setup(t,({type,task,exposure})=>{if(type==='plan'){plans++;return makePlan(task.originalRequest);}if(type==='review')return review(exposure,task);return final();});
  const create=s.registry.create.bind(s.registry);s.registry.create=options=>{if(options.nodeId==='planning')throw Object.assign(Error('Injected interruption before candidate'),{code:'TRANSIENT_PROVIDER'});return create(options);};
  const mission=s.engine.create('Never replace altered planning evidence.',{allowedTools:[]});assert.equal((await s.engine.run(mission.id)).mission.status,'WAITING_PROVIDER');
  const responses=s.store.list('planning-response');assert.equal(responses.length,1);const response=responses[0];
  s.store.put(response.type,response.id,{...response.data,value:{altered:true}},{expectedVersion:response.version});
  s.reopen();const result=await s.engine.run(mission.id);assert.equal(result.mission.status,'FAILED');
  assert.equal(result.mission.pending[0].code,'PLANNING_RESPONSE_INTEGRITY');assert.equal(plans,1);assert.equal(s.store.list('artifact').length,0);
});
for(const mutation of ['missing-receipt','other-receipt','duplicate-completion','pending','policy','configuration','request','context'])test('SIMULATED durable planning response rejects '+mutation+' without replacing the producer',async t=>{
  let plans=0;const s=setup(t,({type,task,exposure})=>{if(type==='plan'){plans++;return makePlan(task.originalRequest);}if(type==='review')return review(exposure,task);return final();});
  const create=s.registry.create.bind(s.registry);s.registry.create=options=>{if(options.nodeId==='planning')throw Object.assign(Error('Injected interruption before candidate'),{code:'TRANSIENT_PROVIDER'});return create(options);};
  const mission=s.engine.create('Keep the planning checkpoint scoped and exact.',{allowedTools:[]});assert.equal((await s.engine.run(mission.id)).mission.status,'WAITING_PROVIDER');
  const runId=s.store.get('planning-progress',mission.id).data.active.runId,run=s.store.get('run',runId),data=structuredClone(run.data);
  if(mutation==='policy'){
    const m=s.store.get('mission',mission.id);s.store.put(m.type,m.id,{...m.data,policy:{...m.data.policy,allowedTools:['workspace.write']}},{expectedVersion:m.version});
  }else if(mutation==='configuration'){
    const c=s.store.get('worker-config',runId),instructions=c.data.instructions+' ALTERED';s.store.put(c.type,c.id,{...c.data,instructions,prefixHash:sha256(instructions)},{expectedVersion:c.version});
  }else if(mutation==='request'){
    const request=s.store.list('inference-request').find(r=>r.data.runId===runId);s.store.put(request.type,request.id,request.data,{expectedVersion:request.version});
  }else{
    if(mutation==='missing-receipt')delete data.inferenceReceipt;
    else if(mutation==='other-receipt')data.inferenceReceipt={...data.inferenceReceipt,contextHash:'f'.repeat(64)};
    else if(mutation==='duplicate-completion')data.inferenceReceipts.push({...data.inferenceReceipt,threadId:'synthetic-extra-completion'});
    else if(mutation==='pending')data.expectedRequestHash='e'.repeat(64);
    else {data.context.instructionsHash='0'.repeat(64);data.contextHash=sha256(data.context);}
    s.store.put(run.type,run.id,data,{expectedVersion:run.version});
  }
  s.reopen();const result=await s.engine.run(mission.id),durable=durableMission(s.store,mission.id);
  if(mutation==='policy'){
    assert.equal(result.mission.status,'UNVERIFIED');assert.deepEqual(result.mission.pending,[]);
    assert.equal(durable.status,'FAILED');assert.equal(durable.pending[0].code,'PLANNING_RESPONSE_INTEGRITY');
  }else{
    assert.equal(result.mission.status,'FAILED');
    assert.equal(result.mission.pending[0].code,'PLANNING_RESPONSE_INTEGRITY',JSON.stringify(result.mission.pending));
  }
  assert.equal(plans,1);assert.equal(s.store.list('artifact').length,0);assert.equal(s.store.list('run').filter(r=>r.data.nodeId==='planning').length,1);
});
test('planning response retention cannot be enabled by an ordinary producer or an unknown retention mode',async t=>{
  const s=setup(t,()=>assert.fail('No provider dispatch is permitted')),m=s.engine.create('Only the planning actor may retain a plan.',{allowedTools:[]});
  const run=s.engine.workers.createRun({missionId:m.id,nodeId:'deliver',mode:'producer',purpose:'deliver',roleIds:['omega_02']});
  const request={runId:run.id,instructions:'Return a result',input:'{}',schema:{type:'object'},validate:()=>true};
  await assert.rejects(s.engine.workers.infer({...request,retention:PLANNING_RESPONSE_RETENTION}),{code:'PLANNING_RESPONSE_SCOPE'});
  await assert.rejects(s.engine.workers.infer({...request,retention:'unregistered'}),{code:'CONFIG'});
  assert.equal(s.count,0);assert.equal(s.store.list('inference-request').length,0);assert.equal(s.store.list('planning-response').length,0);
});
test('planning response retention rejects a different schema before any dispatch or request record',async t=>{
  const s=setup(t,()=>assert.fail('Wrong schema must fail before the provider')),m=s.engine.create('Retain only an explicit final plan schema.',{allowedTools:[]});
  const run=s.engine.workers.createRun({missionId:m.id,nodeId:'planning',mode:'producer',purpose:'plan',roleIds:['omega_04','omega_05']});
  await assert.rejects(s.engine.workers.infer({runId:run.id,retention:PLANNING_RESPONSE_RETENTION,instructions:'Return a result',input:'{}',schema:{type:'object',properties:{}},validate:()=>true}),{code:'PLANNING_RESPONSE_SCOPE'});
  assert.equal(s.count,0);assert.equal(s.store.list('inference-request').length,0);
});
test('planning response scope corruption during generation cannot be retried as a quality correction',async t=>{
  const s=setup(t,({type,task,store})=>{
    assert.equal(type,'plan');const r=store.list('run').find(r=>r.data.nodeId==='planning'&&r.data.expectedRequestHash),data=structuredClone(r.data);
    data.context.instructionsHash='c'.repeat(64);data.contextHash=sha256(data.context);store.put(r.type,r.id,data,{expectedVersion:r.version});
    return makePlan(task.originalRequest);
  });
  const m=s.engine.create('Scope failure is not a request to regenerate a plan.',{allowedTools:[]}),result=await s.engine.run(m.id);
  assert.equal(result.mission.status,'FAILED');assert.equal(result.mission.pending[0].code,'PLANNING_RESPONSE_INTEGRITY');
  assert.equal(s.count,1);assert.equal(s.store.get('planning-progress',m.id).data.qualityFailures,0);
  assert.equal(s.store.list('planning-response').length,0);assert.equal(s.store.list('artifact').length,0);
});
test('durable planning response does not mix heads when another SQLite connection commits during a read',async t=>{
  const s=setup(t,({task})=>makePlan(task.originalRequest)),m=s.engine.create('Read one coherent committed response.',{allowedTools:[]});
  s.registry.create=()=>{throw Object.assign(Error('Synthetic stop before candidate'),{code:'TRANSIENT_PROVIDER'});};
  await s.engine.run(m.id);const runId=s.store.get('planning-progress',m.id).data.active.runId;
  const other=new Store(join(s.directory,'state.sqlite'));t.after(()=>other.close());
  const get=s.store.get.bind(s.store);let committed=false;
  const mocked=t.mock.method(s.store,'get',(...args)=>{
    const result=get(...args);
    if(args[0]==='planning-response'&&!committed){committed=true;const r=other.get('worker-config',runId);other.put(r.type,r.id,r.data,{expectedVersion:r.version});}
    return result;
  });
  assert.ok(readPlanningResponse(s.registry,runId),'The already-pinned snapshot sees its original configuration');assert.equal(committed,true);
  mocked.mock.restore();assert.throws(()=>readPlanningResponse(s.registry,runId),{code:'PLANNING_RESPONSE_INTEGRITY'});
  assert.equal(s.store.db.isTransaction,false);s.store.verifyJournal();
});
test('durable planning response uses one owned read snapshot and preserves a caller transaction',async t=>{
  const s=setup(t,({task})=>makePlan(task.originalRequest)),m=s.engine.create('Read the plan checkpoint coherently.',{allowedTools:[]});
  s.registry.create=()=>{throw Object.assign(Error('Synthetic stop before candidate'),{code:'TRANSIENT_PROVIDER'});};
  await s.engine.run(m.id);const runId=s.store.get('planning-progress',m.id).data.active.runId,journal=s.store.verifyJournal(),get=s.store.get.bind(s.store);
  const mocked=t.mock.method(s.store,'get',(...args)=>{assert.equal(s.store.db.isTransaction,true,'Every checkpoint read belongs to one snapshot');return get(...args);});
  assert.ok(readPlanningResponse(s.registry,runId));assert.equal(s.store.db.isTransaction,false);
  assert.equal(readPlanningResponse(s.registry,'run:no-plan-response'),null);assert.equal(s.store.db.isTransaction,false);
  s.store.transact(()=>{assert.ok(readPlanningResponse(s.registry,runId));assert.equal(s.store.db.isTransaction,true);});
  mocked.mock.restore();assert.deepEqual(s.store.verifyJournal(),journal);
  const r=s.store.get('worker-config',runId);s.store.put(r.type,r.id,r.data,{expectedVersion:r.version});
  assert.throws(()=>readPlanningResponse(s.registry,runId),{code:'PLANNING_RESPONSE_INTEGRITY'});assert.equal(s.store.db.isTransaction,false);
  s.store.transact(()=>{assert.throws(()=>readPlanningResponse(s.registry,runId),{code:'PLANNING_RESPONSE_INTEGRITY'});assert.equal(s.store.db.isTransaction,true);});
});
for(const phase of ['origin-committed','response-uncommitted','cleanup-uncommitted','cleanup-committed','candidate-committed'])
test('REAL planning process exits at '+phase+'; simulated provider, real SQLite recovery',async t=>{
  const s=setup(t,({type,task,exposure})=>{assert.notEqual(type,'plan','A committed response must never regenerate its plan');return type==='review'?review(exposure,task):final();});
  const m=s.engine.create('Preserve exact planning work across an abrupt process exit.',{allowedTools:[]});
  const child=spawnSync(process.execPath,[new URL('./fixtures/planning-response-controller.mjs',import.meta.url).pathname,
    s.directory,m.id,phase,JSON.stringify(makePlan(m.intent))],{encoding:'utf8',timeout:15000,maxBuffer:1024*1024});
  assert.equal(child.signal,null,child.stderr);assert.equal(child.status,86,child.stderr);
  s.reopen();const active=s.store.get('planning-progress',m.id).data.active,run=s.store.get('run',active.runId).data;
  assert.equal(s.store.list('inference-request').length,1);assert.equal(s.store.list('effect').length,0);
  assert.equal(s.store.get('mission',m.id).data.status,'PLANNING','Abrupt death preserves the last committed planning status, not invented completion or pause');
  if(['origin-committed','response-uncommitted','cleanup-uncommitted'].includes(phase)){
    const retained=phase==='cleanup-uncommitted';
    assert.equal(s.store.list('planning-response').length,retained?1:0);
    if(retained){assert.equal(run.expectedRequestHash,null);assert.equal(run.inferenceReceipts.length,1);}
    else {assert.equal(run.inferenceReceipt,undefined);assert.equal(run.inferenceReceipts,undefined);assert.ok(run.expectedRequestHash);}
    assert.equal(s.store.list('planning-provider-cleanup').length,0);assert.equal(s.store.list('planning-cleanup-origin').length,1);
    assert.equal(s.store.list('artifact').length,0);
    const blocked=await s.engine.run(m.id);assert.equal(blocked.mission.status,'WAITING_CAPABILITY');assert.equal(blocked.mission.pending[0].code,'CLEANUP_UNCONFIRMED');
    assert.equal(s.count,0,'An unresolved original dispatch must not buy a replacement planner');s.store.verifyJournal();return;
  }
  const checkpoint=s.store.list('planning-response')[0];assert.equal(s.store.list('planning-response').length,1);
  assert.equal(run.expectedRequestHash,null);assert.equal(run.inferenceReceipts.length,1);
  const cleanup=s.store.list('planning-provider-cleanup').at(-1);assert.equal(cleanup.data.status,'CLOSED');assert.equal(cleanup.data.outcome,'RETAINED');
  const candidate=s.store.list('artifact')[0];assert.equal(!!candidate,phase==='candidate-committed');
  assert.equal(active.artifactId,null,'Crash precedes durable progress linkage');
  const result=await s.engine.run(m.id);assert.equal(result.mission.status,'COMPLETED',JSON.stringify(result.mission.pending));
  const accepted=s.store.get('artifact',s.store.get('plan',m.id).data.acceptedPlanArtifactId).data;
  assert.equal(accepted.payload.producerRunId,active.runId);if(candidate)assert.equal(accepted.id,candidate.id);
  assert.equal(s.count,3,'Only plan review, ordinary production and result review infer after recovery');
  assert.equal(s.store.get(checkpoint.type,checkpoint.id).hash,checkpoint.hash);
  assert.equal(s.store.get('planning-progress',m.id).data.attempts,1);s.store.verifyJournal();
});
test('SIMULATED planning-review quota: reopen reuses the durable plan candidate without another planning call',async t=>{
  let quota=true,plans=0;
  const s=setup(t,({type,task,exposure})=>{
    if(type==='plan'){plans++;return makePlan(task.originalRequest);}
    if(type==='review'){if(task.purpose==='plan'&&quota){quota=false;throw Object.assign(Error('Synthetic quota'),{code:'QUOTA'});}return review(exposure,task);}
    return final();
  });
  const mission=s.engine.create('Preserve a reviewed planning checkpoint.'),first=await s.engine.run(mission.id);
  assert.equal(first.mission.status,'WAITING_QUOTA');
  const candidateId=s.store.get('planning-progress',mission.id).data.active.artifactId;
  assert.equal(s.store.get('artifact',candidateId).data.status,'CANDIDATE');
  s.reopen();const result=await s.engine.run(mission.id);
  assert.equal(result.mission.status,'COMPLETED');assert.equal(plans,1);
  assert.equal(s.store.get('plan',mission.id).data.acceptedPlanArtifactId,candidateId);
});
test('SIMULATED planning correction budget and feedback remain durable across reopen',async t=>{
  let plans=0;
  const s=setup(t,({type,task,exposure})=>{
    if(type==='plan'){plans++;if(plans>1)assert.ok(task.feedback.length);return makePlan(task.originalRequest);}
    if(type==='review')return review(exposure,task,{decision:'RETURN',reason:'Synthetic material planning defect'});
    throw Error('Never execute unaccepted plan');
  });
  const mission=s.engine.create('A plan that must satisfy the frozen criterion.',{maxPlanAttempts:2});
  assert.equal((await s.engine.run(mission.id)).mission.status,'NEEDS_DIRECTION');assert.equal(plans,2);
  s.reopen();assert.equal((await s.engine.run(mission.id)).mission.status,'NEEDS_DIRECTION');assert.equal(plans,2);
  assert.equal(s.store.get('planning-progress',mission.id).data.qualityFailures,2);
});
test('SIMULATED: cancellation prevents further production and does not pretend completed',async t=>{
  const s=setup(t,({type,task,exposure,engine})=>{if(type==='plan')return makePlan(task.originalRequest);if(type==='review')return review(exposure,task);engine.cancel(engine.active.missionId);return final();});
  const m=s.engine.create('A cancellable product.'),r=await s.engine.run(m.id);assert.equal(r.mission.status,'CANCELLED');assert.equal(r.mission.finalArtifactId,null);assert.equal(s.store.list('effect').length,0);
  const before=s.count;const repeated=await s.engine.run(m.id);assert.equal(repeated.mission.status,'CANCELLED');assert.equal(s.count,before);
});
test('SIMULATED: service shutdown can pause durably and resume, while explicit cancel remains terminal',async t=>{
  const controller=new AbortController();let first=true;
  const s=setup(t,({type,task,exposure})=>{if(type==='plan')return makePlan(task.originalRequest);if(type==='review')return review(exposure,task);if(first){first=false;controller.abort();}return final();});
  const mission=s.engine.create('Pause without losing the original request.');
  const paused=await s.engine.run(mission.id,{signal:controller.signal,pauseOnAbort:true});assert.equal(paused.mission.status,'PAUSED');
  s.reopen();assert.equal((await s.engine.run(mission.id)).mission.status,'COMPLETED');
});
test('SIMULATED: execution.run yields genuine WAITING_CAPABILITY, not textual test success',async t=>{
  const s=setup(t,({type,task,exposure})=>type==='plan'?makePlan(task.originalRequest,{tools:['execution.run'],requiredEffects:[{type:'execution',path:'.',command:'["node","--test"]',expectedExit:0}]}):type==='review'?review(exposure,task):tool('execution.run',{}));
  const m=s.engine.create('Run real code tests.'),r=await s.engine.run(m.id);assert.equal(r.mission.status,'WAITING_CAPABILITY');assert.equal(r.mission.finalArtifactId,null);assert.ok(s.store.list('effect').every(e=>e.data.receipt?.data.status==='FAILED'),'Preflight may reject before dispatch; no successful execution receipt');assert.ok(!s.store.list('artifact').some(a=>a.data.payload.nodeId==='deliver'));
});
test('SIMULATED: stale own-write proof cannot certify current filesystem',async t=>{
  let ws;const s=setup(t,({type,task,exposure})=>{
    if(type==='plan')return makePlan(task.originalRequest,{tools:['workspace.write','workspace.read'],requiredEffects:[{type:'file',path:'result.txt',command:'',expectedExit:null}]});
    if(type==='review'){
      if(task.purpose!=='plan')writeFileSync(join(ws,'result.txt'),'externally changed fixture'); // Explicit test adversary, not an agent effect.
      return review(exposure,task);
    }
    if(task.step===0)return tool('workspace.write',{path:'result.txt',content:'verified result',expectedHash:null});return final();
  });
  const m=s.engine.create('Write and verify result.txt.');ws=s.workspace(m.id);const r=await s.engine.run(m.id);assert.notEqual(r.mission.status,'COMPLETED');assert.equal(r.mission.finalArtifactId,null);
});
test('SIMULATED: promised file with only prose and dishonest review cannot complete',async t=>{
  const s=setup(t,({type,task,exposure})=>{
    if(type==='plan')return makePlan(task.originalRequest,{tools:['workspace.write','workspace.read'],requiredEffects:[{type:'file',path:'missing.txt',command:'',expectedExit:null}]});
    if(type==='review')return review(exposure,task,{artifactOnly:true});return final('I created missing.txt and everything passed.');
  });
  const m=s.engine.create('Create missing.txt with the requested result.'),r=await s.engine.run(m.id);assert.notEqual(r.mission.status,'COMPLETED');assert.equal(r.mission.finalArtifactId,null);
});
test('SIMULATED: repeated quota failures do not consume cognitive correction budget',async t=>{
  let quotaCount=2;const s=setup(t,({type,task,exposure})=>{
    if(type==='plan')return makePlan(task.originalRequest);if(type==='review')return review(exposure,task);
    if(quotaCount-->0)throw Object.assign(Error('Synthetic quota'),{code:'QUOTA'});return final();
  });
  const m=s.engine.create('Deliver after subscription reset.',{maxNodeAttempts:1});
  assert.equal((await s.engine.run(m.id)).mission.status,'WAITING_QUOTA');
  assert.equal((await s.engine.run(m.id)).mission.status,'WAITING_QUOTA');
  assert.equal((await s.engine.run(m.id)).mission.status,'COMPLETED');
});
test('REAL broker crash boundary: observed write without durable success is not dispatched again on restart',async t=>{
  const s=setup(t,({type,task,exposure})=>{
    if(type==='plan')return makePlan(task.originalRequest,{tools:['workspace.write','workspace.read'],requiredEffects:[{type:'file',path:'result.txt',command:'',expectedExit:null}]});
    if(type==='review')return review(exposure,task);return tool('workspace.write',{path:'result.txt',content:'verified result',expectedHash:null});
  });
  const m=s.engine.create('Create result.txt exactly once.');const original=s.store.put.bind(s.store);let injected=false;
  const fault=t.mock.method(s.store,'put',(type,key,data,options)=>{
    if(type==='effect'&&data.state==='SUCCEEDED'&&data.tool==='workspace.write'&&!injected){injected=true;throw Object.assign(Error('Explicit synthetic storage failure after actual effect'),{code:'STORAGE_WRITE'});}
    return original(type,key,data,options);
  });
  const first=await s.engine.run(m.id);fault.mock.restore();assert.equal(first.mission.status,'NEEDS_DIRECTION');assert.ok(injected);assert.equal(readFileSync(join(s.workspace(m.id),'result.txt'),'utf8'),'verified result');
  assert.equal(s.store.list('effect').length,1);assert.equal(s.store.list('effect')[0].data.state,'DISPATCHED');const before=s.count;
  s.reopen();const second=await s.engine.run(m.id);assert.equal(second.mission.status,'NEEDS_DIRECTION');assert.equal(second.mission.pending[0].code,'EFFECT_UNCERTAIN');assert.equal(s.count,before);assert.equal(s.store.list('effect').length,1);
});
test('SIMULATED quota during review: durable candidate resumes without repeating its actual write or production',async t=>{
  let quota=true,productions=0;
  const s=setup(t,({type,task,exposure})=>{
    if(type==='plan')return makePlan(task.originalRequest,{tools:['workspace.write','workspace.read'],requiredEffects:[{type:'file',path:'result.txt',command:'',expectedExit:null}]});
    if(type==='review'){
      if(task.purpose!=='plan'&&quota){quota=false;throw Object.assign(Error('Synthetic review quota'),{code:'QUOTA'});}
      return review(exposure,task);
    }
    productions++;if(task.step===0)return tool('workspace.write',{path:'result.txt',content:'verified result',expectedHash:null});return final();
  });
  const m=s.engine.create('Create the file and preserve the candidate across review quota.');
  const first=await s.engine.run(m.id);assert.equal(first.mission.status,'WAITING_QUOTA');
  const candidateId=durableNode(s.store,m.id,'deliver').artifactId,producer=s.store.get('artifact',candidateId).data.payload.producerRunId;
  s.reopen();const second=await s.engine.run(m.id);assert.equal(second.mission.status,'COMPLETED',JSON.stringify(second.mission.pending));
  assert.equal(second.outcome.id,candidateId);assert.equal(durableArtifact(s.store,second.outcome.id).payload.producerRunId,producer);assert.equal(productions,2);
  assert.equal(s.store.list('effect').filter(e=>e.data.tool==='workspace.write').length,1);
});
test('REAL file and queue / SIMULATED timeout: bounded restart reviews the exact candidate without rewriting',async t=>{
  let fail=true,productions=0,now=Date.parse('2026-09-13T00:00:00Z');
  const s=setup(t,({type,task,exposure})=>{
    if(type==='plan')return makePlan(task.originalRequest,{tools:['workspace.write','workspace.read'],requiredEffects:[{type:'file',path:'result.txt',command:'',expectedExit:null}]});
    if(type==='review'){
      if(task.purpose!=='plan'&&fail){fail=false;throw Object.assign(Error('Synthetic review timeout after actual independent read'),{code:'TIMEOUT'});}
      return review(exposure,task);
    }
    productions++;return task.step===0?tool('workspace.write',{path:'result.txt',content:'exact committed file',expectedHash:null}):final();
  });
  const queue=()=>new MissionQueue({engine:s.engine,clock:()=>new Date(now).toISOString(),retryBaseMs:1000,retryMaxMs:1000,maxAutomaticRetries:1});
  let q=queue();const job=q.submit('Write the exact file once and independently review it.',{maxNodeAttempts:1});
  q.acquire();const first=await q.runNext();q.release();
  assert.equal(first.status,'RETRY_WAIT');assert.equal(first.lastMissionStatus,'WAITING_PROVIDER');assert.equal(first.automaticRetries,1);
  const candidate=s.store.list('artifact').find(r=>r.data.payload.nodeId==='deliver');assert.equal(candidate.data.status,'CANDIDATE');
  const write=s.store.list('effect').find(r=>r.data.tool==='workspace.write');assert.equal(write.data.state,'SUCCEEDED');
  const path=join(s.workspace(job.missionId),'result.txt');assert.equal(readFileSync(path,'utf8'),'exact committed file');
  s.reopen();q=queue();q.acquire();
  try{q.recover();assert.equal(await q.runNext(),null);now+=1000;
    assert.equal((await q.runNext()).status,'COMPLETED');
    assert.equal(q.get(job.missionId).automaticRetries,1);assert.equal(q.get(job.missionId).attempts,2);
  }finally{q.release();}
  const accepted=s.store.get('artifact',candidate.id).data;assert.equal(accepted.status,'ACCEPTED');
  assert.equal(accepted.payloadHash,candidate.data.payloadHash);assert.equal(accepted.payload.producerRunId,candidate.data.payload.producerRunId);
  assert.equal(productions,2);assert.equal(s.store.list('effect').filter(r=>r.data.tool==='workspace.write').length,1);
  assert.equal(s.store.get('effect',write.id).hash,write.hash);assert.equal(readFileSync(path,'utf8'),'exact committed file');
  assert.equal(new Set(s.store.list('effect').filter(r=>r.data.tool==='workspace.read').map(r=>r.data.principalId)).size,2);
  const report=missionReport(s.store,job.missionId,{registry:s.registry});assert.equal(report.metrics.integrity,'NOT_ATTESTED');assert.equal(report.metrics.failed,undefined);s.store.verifyJournal();
});

test('SIMULATED quota mid-production / REAL file: recovered producer sees prior committed effects as history, rereads and does not rewrite',async t=>{
  let firstProducer=null,interrupted=false;
  const s=setup(t,({type,task,exposure,store})=>{
    if(type==='plan')return makePlan(task.originalRequest,{tools:['workspace.write','workspace.read'],requiredEffects:[{type:'file',path:'result.txt',command:'',expectedExit:null}]});
    if(type==='review')return review(exposure,task);
    const pending=store.list('run').find(r=>r.data.mode==='producer'&&r.data.nodeId==='deliver'&&r.data.expectedRequestHash);
    if(!firstProducer)firstProducer=pending.id;
    if(!interrupted){if(task.step===0)return tool('workspace.write',{path:'result.txt',content:'verified result',expectedHash:null});interrupted=true;throw Object.assign(Error('Synthetic quota after committed write, before candidate'),{code:'QUOTA'});}
    const historical=exposure.toolObservations.find(o=>o.tool==='workspace.write');
    assert.ok(historical,'Recovered producer needs observed history, not an empty workspace assumption');
    assert.equal(historical.relation,'EXTERNAL_OBSERVATION');assert.equal(historical.principalId,firstProducer);
    if(task.step===0)return tool('workspace.read',{path:'result.txt'});
    assert.equal(exposure.toolObservations.find(o=>o.tool==='workspace.read'&&o.relation==='OWN_ACTION').result.content,'verified result');
    return final('The existing committed result was reread, not created twice.');
  });
  const m=s.engine.create('Create result.txt with verified result and recover without duplicate writes.');
  assert.equal((await s.engine.run(m.id)).mission.status,'WAITING_QUOTA');
  assert.equal(s.store.list('artifact').filter(a=>a.data.payload.nodeId==='deliver').length,0);
  s.reopen();const recovered=await s.engine.run(m.id);
  assert.equal(recovered.mission.status,'COMPLETED',JSON.stringify(recovered.mission.pending));
  const delivered=durableArtifact(s.store,recovered.outcome.id);
  assert.notEqual(delivered.payload.producerRunId,firstProducer);
  assert.equal(s.store.list('effect').filter(e=>e.data.tool==='workspace.write').length,1);
  assert.equal(s.store.list('effect').filter(e=>e.data.tool==='workspace.read').length,2);
  assert.ok(delivered.payload.toolReceipts.every(r=>r.data.principalId===delivered.payload.producerRunId));
});
test('REAL file mutation after delivery: re-entry cannot return cached COMPLETED or overwrite external edits',async t=>{
  const s=setup(t,({type,task,exposure})=>{
    if(type==='plan')return makePlan(task.originalRequest,{tools:['workspace.write','workspace.read'],requiredEffects:[{type:'file',path:'result.txt',command:'',expectedExit:null}]});
    if(type==='review')return review(exposure,task);
    return task.step===0?tool('workspace.write',{path:'result.txt',content:'verified result',expectedHash:null}):final();
  });
  const m=s.engine.create('Deliver a verified file snapshot.');assert.equal((await s.engine.run(m.id)).mission.status,'COMPLETED');
  const path=join(s.workspace(m.id),'result.txt');writeFileSync(path,'External authorized fixture edit');const before=s.count;
  s.reopen();const result=await s.engine.run(m.id),durable=durableMission(s.store,m.id);
  assert.equal(result.mission.status,'UNVERIFIED');assert.deepEqual(result.mission.pending,[]);assert.equal(result.outcome,null);
  assert.equal(durable.status,'NEEDS_DIRECTION');assert.equal(durable.pending[0].code,'WORKSPACE_CHANGED');
  assert.equal(s.count,before);assert.equal(readFileSync(path,'utf8'),'External authorized fixture edit');
});
test('SIMULATED malformed proposal: retries with recorded failure without weakening criteria',async t=>{
  let malformed=true;
  const s=setup(t,({type,task,exposure})=>{
    if(type==='plan')return makePlan(task.originalRequest);if(type==='review')return review(exposure,task);
    if(malformed){malformed=false;return {...final(),method:''};}
    assert.ok(task.feedback.some(f=>f.code==='SCHEMA'));return final('Correctly shaped observed response');
  });
  const m=s.engine.create('Recover a structurally invalid response without lowering the standard.');
  const result=await s.engine.run(m.id);assert.equal(result.mission.status,'COMPLETED',JSON.stringify(result.mission.pending));
  assert.equal(durableNode(s.store,m.id,'deliver').attempt,2);assert.equal(s.store.list('worker-rejected-output').length,1);
});
