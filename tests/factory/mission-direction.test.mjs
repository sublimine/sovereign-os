import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {Store} from '../../factory/lib/store.mjs';
import {Authority} from '../../factory/lib/authority.mjs';
import {ArtifactRegistry} from '../../factory/lib/artifacts.mjs';
import {FactoryEngine} from '../../factory/lib/engine.mjs';
import {validatePlan} from '../../factory/lib/plans.mjs';
import {formatMissionReport} from '../../factory/lib/report.mjs';
import {sha256} from '../../factory/lib/contracts.mjs';
import {LEGACY_MISSION_DIRECTION_SCHEMA,MISSION_DIRECTION_SCHEMA,missionDirectionPolicy} from '../../factory/lib/mission-direction.mjs';
import {publicPolicy} from '../../factory/lib/mission-public-projection.mjs';

const intent='Deliver the requested result with independent review.';
const direction=(riskLevel='high')=>({
  schema:MISSION_DIRECTION_SCHEMA,responsibleRoleId:'omega_02',
  roleJustifications:[
    {roleId:'omega_02',rationale:'Owns the bounded production coordination required by this fixture.'},
    {roleId:'omega_03',rationale:'Provides a separate reviewer for the requested result.'}
  ],
  riskLevel,
  closureCriterion:{text:'An independent reviewer accepts the complete final result against the frozen request.',evaluation:'content'},
  escalation:{trigger:'A material requirement, authority or evidence conflict remains unresolved.',target:'omega_01',action:'Pause delivery and request an explicit decision without weakening the mandate.'}
});

const plan=(finalCriterion=direction().closureCriterion)=>({
  requirements:[{id:'r1',text:intent,requestQuote:intent,criteria:[{id:'request',text:intent,evaluation:'content'}]}],
  nodes:[{id:'deliver',title:'deliver',purpose:'delivery',roleIds:['omega_02'],reviewerRoleIds:['omega_03'],requirementIds:['r1'],dependencies:[],
    method:{id:'direct',rationale:'Produce the requested bounded result.',alternatives:['Independent reconstruction']},instructions:intent,outputKind:'answer',
    criteria:[{id:'direction-close',...finalCriterion}],requiredEffects:[],tools:[],specialist:null}],
  finalNodeId:'deliver',routingRationale:'One material product is sufficient for this focused direction-boundary fixture.'
});

function fixture(t){
  const directory=mkdtempSync(join(tmpdir(),'factory-mission-direction-')),store=new Store(join(directory,'state.sqlite')),
    authority=new Authority(store),registry=new ArtifactRegistry(store,authority),engine=new FactoryEngine({store,authority,registry,workspaceRoot:join(directory,'workspaces')});
  t.after(()=>{engine.close();rmSync(directory,{recursive:true,force:true});});
  return {store,registry,engine};
}

function fixtureRun(registry,missionId,{nodeId,mode,artifactIds=[],threadId}){
  const run=registry.registerRun({missionId,nodeId,mode,context:{purpose:'delivery',artifactIds,sourceIds:[],
    instructionsHash:sha256(`fixture ${nodeId}`),producerConversationIncluded:false}});
  registry.attachInference(run.id,{status:'completed',simulation:true,threadId,turnId:`turn:${threadId}`});return run;
}
function approval(artifact){return {artifactHash:artifact.payloadHash,purpose:artifact.payload.purpose,decision:'ACCEPT',
  checks:artifact.payload.criteria.filter(c=>(c.evaluation??'content')==='content').map(criterion=>({criterionId:criterion.id,verdict:'PASS',
    evidence:[{kind:'artifact',id:artifact.id,hash:artifact.payloadHash,quote:artifact.payload.body}],reason:'Exact candidate body is visible to this independent fixture reviewer.'})),
  findings:[],uncertainty:'Synthetic independent review fixture.'};}

test('mission direction is frozen at admission and rendered through the public report boundary',t=>{
  const {store,engine}=fixture(t),selected=direction(),mission=engine.create(intent,{allowedTools:[],missionDirection:selected}),
    durable=store.get('mission',mission.id).data,directionReport=engine.report(mission.id),text=formatMissionReport(directionReport);
  assert.deepEqual(durable.policy.missionDirection,selected);
  assert.deepEqual(directionReport.mission.policy.missionDirection,selected);
  assert.match(text,/Dirección responsable de misión/);assert.match(text,/Responsable único: omega_02; riesgo: high/);
  assert.match(text,/Rol omega_03: Provides a separate reviewer/);
});

test('direction-bound plans need both justified selected roles and the frozen closure test',()=>{
  const selected=direction();
  assert.doesNotThrow(()=>validatePlan(plan(),intent,{allowedTools:[],missionDirection:selected}));
  const noClosure=plan({text:'A different local check.',evaluation:'content'});
  assert.throws(()=>validatePlan(noClosure,intent,{allowedTools:[],missionDirection:selected}),{code:'MISSION_DIRECTION_CLOSURE'});
  const missingReviewerJustification={...selected,roleJustifications:selected.roleJustifications.filter(item=>item.roleId!=='omega_03')};
  assert.throws(()=>validatePlan(plan(),intent,{allowedTools:[],missionDirection:missingReviewerJustification}),{code:'MISSION_DIRECTION_ROLE_SELECTION'});
});

test('a newly admitted responsible role must participate in the final product, while v1 remains readable only as historical policy',t=>{
  const base=direction(),selected={...base,roleJustifications:[...base.roleJustifications,
    {roleId:'omega_04',rationale:'Provides an independently justified non-responsible producer for this boundary test.'}]},absent=plan();
  absent.nodes[0].roleIds=['omega_04'];absent.nodes[0].reviewerRoleIds=['omega_03'];
  assert.throws(()=>validatePlan(absent,intent,{allowedTools:[],missionDirection:selected}),{code:'MISSION_DIRECTION_RESPONSIBLE_PARTICIPATION'});

  const asFinalReviewer=plan();asFinalReviewer.nodes[0].roleIds=['omega_03'];asFinalReviewer.nodes[0].reviewerRoleIds=['omega_02'];
  assert.doesNotThrow(()=>validatePlan(asFinalReviewer,intent,{allowedTools:[],missionDirection:selected}));

  const historical={...selected,schema:LEGACY_MISSION_DIRECTION_SCHEMA};
  assert.throws(()=>missionDirectionPolicy(historical),{code:'MISSION_DIRECTION_SCHEMA'});
  const {engine}=fixture(t);
  assert.throws(()=>engine.create(intent,{allowedTools:[],missionDirection:historical}),{code:'MISSION_DIRECTION_SCHEMA'});
  assert.doesNotThrow(()=>validatePlan(absent,intent,{allowedTools:[],missionDirection:historical}));
  assert.deepEqual(publicPolicy({allowedTools:[],missionDirection:historical}).missionDirection,historical);
});

test('the planner receives direction and cannot accept a route that omits its closure criterion',async t=>{
  const {store,engine}=fixture(t),mission=engine.create(intent,{allowedTools:[],maxPlanAttempts:1,missionDirection:direction()});let task;
  engine.workers={
    createRun:()=>({id:'run:direction-planning'}),producerOperationalEnvelope:()=>null,
    infer:async ({input,validate})=>{task=JSON.parse(input);const proposal=plan({text:'A different local check.',evaluation:'content'});validate(proposal);return {value:proposal};}
  };
  await assert.rejects(engine.plan(mission),{code:'NEEDS_DIRECTION'});
  assert.deepEqual(task.missionDirection,direction());
  assert.equal(store.get('planning-progress',mission.id).data.feedback[0].failure.code,'MISSION_DIRECTION_CLOSURE');
});

test('legacy callers remain valid and a direction cannot be attached to a route without a plan',t=>{
  const {engine}=fixture(t),legacy=engine.create(intent,{allowedTools:[]}),legacyReport=engine.report(legacy.id);
  assert.equal(legacyReport.mission.policy.missionDirection,undefined);
  assert.throws(()=>engine.create(intent,{allowedTools:[],entryMode:'closed-response-v2',missionDirection:direction()}),{code:'MISSION_DIRECTION_ENTRY'});
});

test('high risk keeps the first acceptance pending across re-entry, requires a fresh adversarial judge, and remains revocable',t=>{
  const {store,registry,engine}=fixture(t),mission=engine.create(intent,{allowedTools:[],missionDirection:direction('high')});
  const producer=fixtureRun(registry,mission.id,{nodeId:'deliver',mode:'producer',threadId:'producer-thread'});
  const artifact=registry.create({missionId:mission.id,nodeId:'deliver',producerRunId:producer.id,kind:'answer',purpose:'delivery',
    body:'Candidate delivery body.',criteria:[{id:'delivery',text:'Deliver the exact bounded result.'}]});
  const first=fixtureRun(registry,mission.id,{nodeId:'review:deliver',mode:'reviewer',artifactIds:[artifact.id],threadId:'judge-one'});
  const pending=registry.review({artifactId:artifact.id,reviewerRunId:first.id,result:approval(artifact)});
  assert.equal(pending.status,'CANDIDATE','The first elevated-risk ACCEPT is a durable pending gate, not delivery');
  assert.deepEqual(pending.reviewRequirement,{schema:'sovereign.risk-proportional-review.v1',riskLevel:'high',independentAcceptances:2});
  assert.throws(()=>registry.assertUsable(artifact.id,{missionId:mission.id,purpose:'delivery'}),{code:'UNACCEPTED_INPUT'});

  const reopened=new ArtifactRegistry(store,engine.authority),sameThread=fixtureRun(reopened,mission.id,{nodeId:'review:deliver',mode:'reviewer',artifactIds:[artifact.id],threadId:'judge-one'});
  assert.equal(reopened.reviewProgress(artifact.id).requiresAdditionalIndependentReview,true,'The pending gate survives a new registry instance');
  assert.throws(()=>reopened.review({artifactId:artifact.id,reviewerRunId:sameThread.id,result:approval(artifact)}),{code:'SELF_CERTIFICATION'});
  const second=fixtureRun(reopened,mission.id,{nodeId:'review:deliver',mode:'reviewer',artifactIds:[artifact.id],threadId:'judge-two'});
  const accepted=reopened.review({artifactId:artifact.id,reviewerRunId:second.id,result:approval(artifact)});
  assert.equal(accepted.status,'ACCEPTED');assert.deepEqual(accepted.reviews.map(id=>store.get('review',id).data.reviewKind),['independent','adversarial']);
  assert.equal(reopened.assertUsable(artifact.id,{missionId:mission.id,purpose:'delivery'}).status,'ACCEPTED');
  reopened.invalidate([artifact.id],{kind:'fixture-revocation'});
  assert.throws(()=>reopened.assertUsable(artifact.id,{missionId:mission.id,purpose:'delivery'}),{code:'UNACCEPTED_INPUT'});
});

test('low and moderate direction keep the existing single independent judge',t=>{
  const {registry,engine}=fixture(t),mission=engine.create(intent,{allowedTools:[],missionDirection:direction('moderate')});
  const producer=fixtureRun(registry,mission.id,{nodeId:'deliver',mode:'producer',threadId:'low-producer'});
  const artifact=registry.create({missionId:mission.id,nodeId:'deliver',producerRunId:producer.id,kind:'answer',purpose:'delivery',
    body:'Normal-risk delivery body.',criteria:[{id:'delivery',text:'Deliver the exact bounded result.'}]});
  const reviewer=fixtureRun(registry,mission.id,{nodeId:'review:deliver',mode:'reviewer',artifactIds:[artifact.id],threadId:'normal-judge'});
  assert.equal(registry.review({artifactId:artifact.id,reviewerRunId:reviewer.id,result:approval(artifact)}).status,'ACCEPTED');
});
