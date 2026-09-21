import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {spawnSync} from 'node:child_process';
import {FactoryEngine} from '../../factory/lib/engine.mjs';
import {sha256} from '../../factory/lib/contracts.mjs';
import {prepareMissionInputWorkspace} from '../../factory/lib/mission-input-workspace.mjs';
import {assertProjectContextReadReceipts,projectContextDescriptor} from '../../factory/lib/project-context.mjs';
import {readVerifiedPublicTopology} from '../../factory/lib/public-topology.mjs';
import {validatePlan} from '../../factory/lib/plans.mjs';

const cli=new URL('../../factory/bin/sovereign.mjs',import.meta.url).pathname;

function fixture(t){
  const directory=fs.mkdtempSync(join(tmpdir(),'sovereign-project-context-'));
  t.after(()=>fs.rmSync(directory,{recursive:true,force:true}));
  return directory;
}

function system(t){
  const directory=fixture(t),engine=new FactoryEngine({databasePath:join(directory,'state.sqlite'),workspaceRoot:join(directory,'workspaces')});
  t.after(()=>engine.close());
  return {directory,engine};
}

function admittedContext(secret='SOVEREIGN_PROJECT_CONTEXT_PACK_V1 private fixture bytes',path='private/project-context.json'){
  const descriptor={path,sha256:sha256(secret),classification:'project-context-untrusted-v1',requiredRead:true};
  return {secret,descriptor,inputs:[{path:descriptor.path,content:secret},{path:'brief.txt',content:'ordinary attachment'}]};
}

function contextPlan(intent){
  const requirement={id:'r1',text:intent,requestQuote:intent,criteria:[{id:'complete',text:'Produce the requested bounded result.',evaluation:'content'}]};
  const intake={id:'context-intake',title:'Private context intake',purpose:'context intake',roleIds:['omega_02'],reviewerRoleIds:['omega_03'],requirementIds:['r1'],dependencies:[],
    method:{id:'project-context-intake-v1',rationale:'Read the immutable controller-bound context before deriving a bounded brief.',alternatives:['Do not consume an unbound context file.']},
    instructions:'Read the controller-bound project context through the broker and produce a bounded untrusted intake brief.',outputKind:'project-context-intake',
    criteria:[{id:'intake-read',text:'The intake is based on an authenticated immutable workspace read.',evaluation:'content'}],requiredEffects:[],tools:['workspace.read'],specialist:null};
  const delivery={id:'deliver',title:'Deliver',purpose:'delivery',roleIds:['omega_02'],reviewerRoleIds:['omega_03'],requirementIds:['r1'],
    dependencies:[{nodeId:'context-intake',purpose:'context intake',reason:'The bounded intake must be independently accepted before downstream work.'}],
    method:{id:'bounded-delivery',rationale:'Use only the accepted intake product for downstream work.',alternatives:['Request direction if the intake cannot be accepted.']},
    instructions:'Produce the requested bounded result from the accepted intake.',outputKind:'delivery',
    criteria:[{id:'delivery-complete',text:'The requested bounded result is complete.',evaluation:'content'}],requiredEffects:[],tools:[],specialist:null};
  return {requirements:[requirement],nodes:[intake,delivery],finalNodeId:'deliver',routingRationale:'A private controller context needs a mandatory intake/review boundary before normal work.'};
}

test('project context admission binds one immutable input while public mission, status, report and topology omit it',t=>{
  const {engine}=system(t),{secret,descriptor,inputs}=admittedContext();
  const mission=engine.create('Visible original request only.',{inputs,projectContext:descriptor});
  const binding=engine.store.get('project-context-binding',mission.id).data;
  const context=projectContextDescriptor(engine.store,mission.id);
  assert.equal(engine.store.db.prepare('PRAGMA user_version').get().user_version,16);
  assert.equal(mission.intent,'Visible original request only.');
  assert.ok(!mission.intent.includes(secret));
  assert.deepEqual(context,descriptor);
  assert.ok(!JSON.stringify(binding).includes(secret));
  assert.ok(!JSON.stringify(engine.store.get('mission',mission.id).data.policy).includes(secret));

  const status=engine.status(mission.id),report=engine.report(mission.id);
  const topology=readVerifiedPublicTopology({store:engine.store,registry:engine.registry,mission:engine.store.get('mission',mission.id).data});
  for(const value of [status,report,topology]){
    const projected=JSON.stringify(value);
    assert.ok(!projected.includes(secret));
    assert.ok(!projected.includes(descriptor.path));
    assert.ok(!projected.includes(descriptor.sha256));
    assert.ok(!projected.includes('projectContextBindingHash'));
  }
  assert.equal(report.inputs.manifestHash,null);
  assert.deepEqual(report.inputs.files.map(file=>file.path),['brief.txt']);
  assert.equal(report.inputs.preparation.integrity,'NOT_PROJECTED');
  assert.equal(topology.integrity,'ABSENT');
});

test('project context refuses entry routes or authority that cannot perform its mandatory intake',t=>{
  const {engine}=system(t),{descriptor,inputs}=admittedContext();
  assert.throws(()=>engine.create('No direct context bypass.',{inputs,projectContext:descriptor,entryMode:'closed-response-v1'}),{code:'PROJECT_CONTEXT_ENTRY'});
  assert.throws(()=>engine.create('No unreadable context bypass.',{inputs,projectContext:descriptor,allowedTools:[]}),{code:'PROJECT_CONTEXT_AUTHORITY'});
  assert.equal(engine.store.list('mission').length,0);
});

test('project-context plan requires a root intake and the intake candidate requires the exact authenticated read',async t=>{
  const {engine}=system(t),{secret,descriptor,inputs}=admittedContext('private input must only travel through a broker read');
  const mission=engine.create('Deliver a bounded result.',{inputs,projectContext:descriptor,allowedTools:['workspace.read']});
  const plan=contextPlan(mission.intent);
  assert.equal(validatePlan(plan,mission.intent,{allowedTools:['workspace.read'],projectContext:descriptor}).valid,true);
  const noDependency=structuredClone(plan);noDependency.nodes[1].dependencies=[];
  assert.throws(()=>validatePlan(noDependency,mission.intent,{allowedTools:['workspace.read'],projectContext:descriptor}),{code:'PROJECT_CONTEXT_INTEGRITY'});
  const copiedDescriptor=structuredClone(plan);copiedDescriptor.nodes[0].instructions+=' '+descriptor.path;
  assert.throws(()=>validatePlan(copiedDescriptor,mission.intent,{allowedTools:['workspace.read'],projectContext:descriptor}),{code:'PROJECT_CONTEXT_INTEGRITY'});

  prepareMissionInputWorkspace(engine.broker,mission.id);
  engine.store.put('node',`${mission.id}:context-intake`,{missionId:mission.id,nodeId:'context-intake',planVersion:1,spec:plan.nodes[0],
    status:'PENDING',attempt:0,fence:1,leaseUntil:null,runId:null,artifactId:null,history:[]},{expectedVersion:0});
  const planner=engine.workers.createRun({missionId:mission.id,nodeId:'planning',mode:'producer',purpose:'plan',roleIds:['omega_04','omega_05']});
  const plannerExposure=engine.workers.context(planner.id),plannerSerialized=JSON.stringify(plannerExposure);
  assert.equal(plannerExposure.projectContext,undefined);
  for(const privateValue of [secret,descriptor.path,descriptor.sha256])assert.ok(!plannerSerialized.includes(privateValue));
  const run=engine.workers.createRun({missionId:mission.id,nodeId:'context-intake',mode:'producer',purpose:'context intake',roleIds:['omega_02']});
  const exposure=engine.workers.context(run.id),serialized=JSON.stringify(exposure);
  assert.deepEqual(exposure.projectContext,descriptor);
  assert.ok(!serialized.includes(secret));
  assert.equal(exposure.missionInputs.manifestHash,undefined);
  assert.deepEqual(exposure.missionInputs.files.map(file=>file.path),['brief.txt']);
  const downstream=engine.workers.createRun({missionId:mission.id,nodeId:'deliver',mode:'producer',purpose:'delivery',roleIds:['omega_02']});
  const downstreamExposure=engine.workers.context(downstream.id),downstreamSerialized=JSON.stringify(downstreamExposure);
  assert.equal(downstreamExposure.projectContext,undefined);
  for(const privateValue of [secret,descriptor.path,descriptor.sha256])assert.ok(!downstreamSerialized.includes(privateValue));
  assert.throws(()=>assertProjectContextReadReceipts(engine.registry,{missionId:mission.id,producerRunId:run.id,toolReceipts:[],projectContext:descriptor}),
    {code:'PROJECT_CONTEXT_READ_REQUIRED'});
  await engine.workers.tool(run.id,'workspace.read',{path:descriptor.path},'fixture-project-context-read');
  const observed=engine.workers.run(run.id).toolObservations.map(observation=>observation.signedReceipt);
  assert.equal(assertProjectContextReadReceipts(engine.registry,{missionId:mission.id,producerRunId:run.id,toolReceipts:observed,
    projectContext:projectContextDescriptor(engine.store,mission.id)}),true);
  const intakePayload={missionId:mission.id,nodeId:'context-intake',producerRunId:run.id,kind:'project-context-intake',purpose:'context intake',
    body:'Bounded intake fixture.',claims:[],inputRefs:[],toolReceipts:observed,criteria:plan.nodes[0].criteria,requiredEffects:[],provisional:false};
  const intakeArtifact={id:'artifact:context-fixture',missionId:mission.id,status:'CANDIDATE',payload:intakePayload,payloadHash:sha256(intakePayload),reviews:[],createdAt:new Date().toISOString(),invalidation:null};
  engine.store.put('artifact',intakeArtifact.id,intakeArtifact,{expectedVersion:0});
  const reviewer=engine.registry.registerRun({missionId:mission.id,nodeId:'review:context-intake',mode:'reviewer',context:{purpose:'context intake',artifactIds:[intakeArtifact.id],sourceIds:[],
    instructionsHash:sha256('fixture reviewer'),producerConversationIncluded:false}});
  const reviewerExposure=engine.workers.context(reviewer.id);
  assert.deepEqual(reviewerExposure.projectContext,descriptor);
  assert.ok(!JSON.stringify(reviewerExposure).includes(secret));
  const reviewerRead=await engine.workers.tool(reviewer.id,'workspace.read',{path:descriptor.path},'fixture-reviewer-project-context-read');
  assert.equal(reviewerRead.status,'SUCCEEDED');
  const downstreamWithIntake=engine.workers.createRun({missionId:mission.id,nodeId:'deliver',mode:'producer',purpose:'delivery',roleIds:['omega_02'],artifactIds:[intakeArtifact.id]});
  const downstreamIntakeExposure=engine.workers.context(downstreamWithIntake.id),downstreamIntakeSerialized=JSON.stringify(downstreamIntakeExposure);
  assert.equal(downstreamIntakeExposure.projectContext,undefined);
  for(const privateValue of [secret,descriptor.path,descriptor.sha256])assert.ok(!downstreamIntakeSerialized.includes(privateValue));
  assert.equal(downstreamIntakeExposure.artifacts[0].privateReceiptProjection.integrity,'REDACTED');
  assert.deepEqual(downstreamIntakeExposure.artifacts[0].payload.toolReceipts,[]);
  const blockedRead=await engine.workers.tool(downstreamWithIntake.id,'workspace.read',{path:descriptor.path},'fixture-downstream-private-read');
  assert.equal(blockedRead.status,'FAILED');
  assert.equal(blockedRead.result.error.code,'PROJECT_CONTEXT_SCOPE');
  const isolatedSnapshot=engine.broker.executionSnapshot(mission.id,{principalId:downstreamWithIntake.id});
  for(const privateValue of [secret,descriptor.path,descriptor.sha256])assert.ok(!JSON.stringify(isolatedSnapshot).includes(privateValue));
  assert.ok(isolatedSnapshot.files.some(file=>file.path==='brief.txt'));
  engine.registry.captureRuntimeObservations(downstreamWithIntake.id);
  const afterHistory=engine.workers.context(downstreamWithIntake.id);
  for(const privateValue of [secret,descriptor.path,descriptor.sha256])assert.ok(!JSON.stringify(afterHistory).includes(privateValue));
  assert.ok(!(afterHistory.runtimeObservations??[]).some(observation=>observation.kind==='workspace-history'));
});

test('non-recipient execution snapshots prune a private-only ancestor chain while the intake recipient retains it',t=>{
  const {engine}=system(t),{secret,descriptor,inputs}=admittedContext(
    'nested private snapshot context must not reveal its directory lineage',
    'client-acme/internal/project-context.json');
  const mission=engine.create('Use a private project context safely.',{inputs,projectContext:descriptor,allowedTools:['workspace.read']});
  const plan=contextPlan(mission.intent);
  prepareMissionInputWorkspace(engine.broker,mission.id);
  engine.store.put('node',`${mission.id}:context-intake`,{missionId:mission.id,nodeId:'context-intake',planVersion:1,spec:plan.nodes[0],
    status:'PENDING',attempt:0,fence:1,leaseUntil:null,runId:null,artifactId:null,history:[]},{expectedVersion:0});
  const intake=engine.workers.createRun({missionId:mission.id,nodeId:'context-intake',mode:'producer',purpose:'context intake',roleIds:['omega_02']});
  const downstream=engine.workers.createRun({missionId:mission.id,nodeId:'deliver',mode:'producer',purpose:'delivery',roleIds:['omega_02']});

  const hidden=engine.broker.executionSnapshot(mission.id,{principalId:downstream.id});
  const hiddenSerialized=JSON.stringify(hidden);
  for(const privateValue of [secret,descriptor.path,descriptor.sha256,'client-acme','internal'])assert.ok(!hiddenSerialized.includes(privateValue));
  assert.ok(hidden.files.some(file=>file.path==='brief.txt'));
  assert.ok(!hidden.manifest.some(entry=>entry.type==='directory'&&['client-acme','client-acme/internal'].includes(entry.path)));

  const recipient=engine.broker.executionSnapshot(mission.id,{principalId:intake.id});
  assert.ok(recipient.files.some(file=>file.path===descriptor.path&&file.content===secret));
  assert.ok(recipient.manifest.some(entry=>entry.type==='directory'&&entry.path==='client-acme'));
  assert.ok(recipient.manifest.some(entry=>entry.type==='directory'&&entry.path==='client-acme/internal'));
});

test('CLI admits the descriptor only with an immutable input manifest and never exports private context through report JSON',t=>{
  const directory=fixture(t),state=join(directory,'state'),secretPath=join(directory,'context.json'),briefPath=join(directory,'brief.txt'),manifestPath=join(directory,'inputs.json'),descriptorPath=join(directory,'descriptor.json');
  const secret='SOVEREIGN_PROJECT_CONTEXT_PACK_V1 cli private bytes',descriptor={path:'private/project-context.json',sha256:sha256(secret),classification:'project-context-untrusted-v1',requiredRead:true};
  fs.writeFileSync(secretPath,secret);fs.writeFileSync(briefPath,'ordinary attachment');
  fs.writeFileSync(manifestPath,JSON.stringify([{source:secretPath,path:descriptor.path},{source:briefPath,path:'brief.txt'}]));
  fs.writeFileSync(descriptorPath,JSON.stringify(descriptor));
  const submit=spawnSync(process.execPath,[cli,'submit','--text','Visible CLI request.','--inputs',manifestPath,'--project-context',descriptorPath,'--state-dir',state],
    {encoding:'utf8',timeout:15000,maxBuffer:1024*1024});
  assert.equal(submit.status,0,submit.stderr);
  const missionId=JSON.parse(submit.stdout).missionId;
  const report=spawnSync(process.execPath,[cli,'report',missionId,'--state-dir',state,'--json'],{encoding:'utf8',timeout:15000,maxBuffer:1024*1024});
  assert.equal(report.status,0,report.stderr);
  for(const privateValue of [secret,descriptor.path,descriptor.sha256,'projectContextBindingHash'])assert.ok(!report.stdout.includes(privateValue));
  assert.match(report.stdout,/brief\.txt/);

  const missingInputs=spawnSync(process.execPath,[cli,'submit','--text','x','--project-context',descriptorPath,'--state-dir',join(directory,'missing-inputs')],
    {encoding:'utf8',timeout:15000,maxBuffer:1024*1024});
  assert.notEqual(missingInputs.status,0);
  assert.match(missingInputs.stderr,/requiere --inputs/);
});

test('private intake receipts are masked from learning diagnostics and never open a learning cycle',async t=>{
  const {engine}=system(t),{secret,descriptor,inputs}=admittedContext('learning must not receive this private project context');
  const mission=engine.create('Assess the private project context.',{inputs,projectContext:descriptor,allowedTools:['workspace.read']});
  const plan=contextPlan(mission.intent);
  prepareMissionInputWorkspace(engine.broker,mission.id);
  engine.store.put('node',`${mission.id}:context-intake`,{missionId:mission.id,nodeId:'context-intake',planVersion:1,spec:plan.nodes[0],
    status:'PENDING',attempt:0,fence:1,leaseUntil:null,runId:null,artifactId:null,history:[]},{expectedVersion:0});
  const run=engine.workers.createRun({missionId:mission.id,nodeId:'context-intake',mode:'producer',purpose:'context intake',roleIds:['omega_02']});
  await engine.workers.tool(run.id,'workspace.read',{path:descriptor.path},'fixture-learning-project-context-read');
  const rejected=engine.store.put('worker-rejected-output','private-context-rejection',{runId:run.id,code:'SCHEMA',accepted:false},{expectedVersion:0});
  const ref=(({type,id,version,hash})=>({type,id,version,hash}))(rejected);
  const diagnostic=engine.learningConductor.diagnosticEvidence(ref,run.id),serialized=JSON.stringify(diagnostic);
  assert.deepEqual(diagnostic.diagnostic.toolMetadata.map(item=>({path:item.path,contentHash:item.contentHash})),[{path:null,contentHash:null}]);
  for(const privateValue of [secret,descriptor.path,descriptor.sha256])assert.ok(!serialized.includes(privateValue));
  assert.deepEqual(engine.learningConductor.observeMission(mission.id),{missionId:mission.id,cycles:[],unconfigured:[]});
});
