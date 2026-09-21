import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,mkdtempSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {FactoryEngine} from '../../factory/lib/engine.mjs';
import {LearningConductor} from '../../factory/lib/learning-conductor.mjs';
import {RegisteredLearningEvaluator} from '../../factory/lib/registered-learning-evaluator.mjs';
import {sha256} from '../../factory/lib/contracts.mjs';

const DIRECT_BLOCK='ADAPTIVE_V3_ROUTE_INTEGRITY';
const literal=(transform,payload)=>`LITERAL-TRANSFORM/1 ${transform}\n<<<\n${payload}\n>>>`;
const options={preset:'adaptive-v3',model:'gpt-6-terra',reasoningEffort:'high',allowedTools:[]};
const scope={roleIds:['sigma_01'],purpose:'adaptive-v3-learning-boundary-fixture',mode:'producer'};
const learningTypes=[
  'learning-role','learning-dataset','learning-instructions','learning-domain','learning-provenance','learning-compilation',
  'learning-candidate','learning-evaluation','learning-evaluation-dispatch','learning-evaluated-prefix','learning-activation',
  'learning-activation-binding','learning-worker-origin','learning-dispatch-authorization','learning-dispatch-completion','learning-cycle',
  'learning-proposal','learning-owner','learning-export','learning-export-root'
];

function datasetSpec(missionId){
  return {missionId,evaluatorId:'exact-json-value-v1',cases:[{
    id:'frozen-fixture-case',input:{taskInstructions:'Return the frozen fixture value.',input:'{}',schema:{type:'object'},
      model:'gpt-6-terra',reasoningEffort:'high'},expected:{answer:'fixture'},required:true,holdout:true,
    criteria:[{metric:'exactMatch',direction:'higher',threshold:1}]
  }],policy:{requireImprovement:true,activation:'evaluation-only'}};
}

function learningShape(store){
  return learningTypes.map(type=>[type,store.list(type).map(({id,version,hash})=>({id,version,hash}))]);
}

function completedDirect(t){
  const root=mkdtempSync(join(tmpdir(),'sovereign-adaptive-v3-learning-'));
  const engine=new FactoryEngine({databasePath:join(root,'state.sqlite'),workspaceRoot:join(root,'workspaces')});
  t.after(()=>{engine.close();rmSync(root,{recursive:true,force:true});});
  const mission=engine.create(literal('uppercase-ascii-v1','learning must stay closed'),options);
  return {root,engine,mission};
}

test('a real completed adaptive-v3 direct mission rejects public baseline, domain, proposal and discovery entry points without learning writes',async t=>{
  const f=completedDirect(t),completed=await f.engine.run(f.mission.id);
  assert.equal(completed.mission.status,'COMPLETED');
  const directRun=f.engine.store.list('run').find(record=>record.data.missionId===f.mission.id)?.data;
  assert.ok(directRun,'the completed direct route has its one native deterministic run');
  const directDataset=datasetSpec(f.mission.id),beforeRegistration=learningShape(f.engine.store);

  assert.throws(()=>f.engine.learning.registry.registerBaseline({roleId:'sigma_01',instructions:'DIRECT_BASELINE',datasetSpec:directDataset}),{code:DIRECT_BLOCK});
  assert.throws(()=>f.engine.learning.registerBaseline({roleId:'sigma_01',scope,datasetSpec:directDataset}),{code:DIRECT_BLOCK});
  assert.throws(()=>f.engine.learning.registerDomain({domainId:'direct-learning-domain',roleId:'sigma_01',scope,datasetSpec:directDataset}),{code:DIRECT_BLOCK});
  assert.deepEqual(learningShape(f.engine.store),beforeRegistration,
    'a direct mission cannot register a baseline or domain even when evaluation-only');

  // This is a legitimate non-v3 evaluation-only baseline.  It proves the
  // boundary is keyed to direct provenance rather than disabling learning.
  const baseline=f.engine.learning.registerBaseline({roleId:'sigma_01',scope,datasetSpec:datasetSpec('ordinary-evaluation-only-mission')});
  assert.equal(baseline.roleId,'sigma_01');
  const beforeProposal=learningShape(f.engine.store);
  const request={roleId:'sigma_01',parentHash:baseline.hash,instructions:'A candidate that must not be attributed to the direct native run.',
    rationale:'Fixture checks the direct-run custody boundary.',authorRunId:directRun.id};
  assert.throws(()=>f.engine.learning.registry.propose(request),{code:DIRECT_BLOCK});
  assert.throws(()=>f.engine.learning.propose(request),{code:DIRECT_BLOCK});
  assert.deepEqual(learningShape(f.engine.store),beforeProposal,
    'a direct native run cannot author either raw-registry or service-level proposal');

  let providerFactories=0;
  const conductor=new LearningConductor({service:f.engine.learning,allowSimulation:true,providerFactory:()=>{
    providerFactories++;throw Error('direct learning must not construct a proposal provider');
  }});
  const beforeDiscovery=learningShape(f.engine.store);
  assert.deepEqual(conductor.observeMission(f.mission.id),
    {missionId:f.mission.id,cycles:[],unconfigured:[],excluded:'ADAPTIVE_V3_DIRECT_ENTRY'});
  assert.throws(()=>conductor.open({roleId:'sigma_01',runId:directRun.id,
    evidenceRefs:[{type:'worker-rejected-output',id:'unreachable-evidence',version:1,hash:'0'.repeat(64)}]}),{code:DIRECT_BLOCK});
  assert.equal(providerFactories,0);assert.deepEqual(learningShape(f.engine.store),beforeDiscovery,
    'direct observation and opening an opportunity stay provider-free and write-free');
});

test('retained or malformed direct-linked learning objects fail before evaluation, export, advancement or registered-evaluator provider dispatch',async t=>{
  const f=completedDirect(t);await f.engine.run(f.mission.id);
  const store=f.engine.store,directRun=store.list('run').find(record=>record.data.missionId===f.mission.id)?.data;
  const normalDataset=datasetSpec('ordinary-evaluation-only-mission'),baseline=f.engine.learning.registerBaseline({roleId:'sigma_01',scope,datasetSpec:normalDataset});
  const ordinary=f.engine.learning.propose({roleId:'sigma_01',parentHash:baseline.hash,instructions:'NORMAL_CANDIDATE',
    rationale:'A legitimate evaluation-only fixture candidate.',authorRunId:'external-fixture-author'});

  // Public APIs can no longer create this object.  Retain one adversarial row
  // solely to prove that a pre-existing/corrupt direct attribution cannot
  // reach the evaluator after the boundary is deployed.
  const directCandidateId='candidate:direct-native-author';
  store.put('learning-candidate',directCandidateId,{...ordinary,candidateId:directCandidateId,authorRunId:directRun.id},{expectedVersion:0});
  const malformedCandidateId='candidate:malformed-direct';
  store.put('learning-candidate',malformedCandidateId,{candidateId:malformedCandidateId,missionId:f.mission.id,
    roleId:'not-a-real-role',parentHash:'0'.repeat(64),instructionHash:'0'.repeat(64),datasetHash:'not-a-digest',
    rationale:'Malformed retained direct candidate.',authorRunId:'not-a-real-run'},{expectedVersion:0});
  const beforeEvaluation=learningShape(store);let callbacks=0;
  const runCase=async()=>{callbacks++;throw Error('direct-linked candidate reached an evaluator callback');};
  await assert.rejects(f.engine.learning.registry.evaluate(directCandidateId,{runCase}),{code:DIRECT_BLOCK});
  await assert.rejects(f.engine.learning.evaluate(directCandidateId,{runCase}),{code:DIRECT_BLOCK});
  await assert.rejects(f.engine.learning.evaluate(malformedCandidateId,{runCase}),{code:DIRECT_BLOCK});
  assert.throws(()=>f.engine.learning.registry.promote(directCandidateId,{}),{code:DIRECT_BLOCK});
  assert.throws(()=>f.engine.learning.promote(directCandidateId,{}),{code:DIRECT_BLOCK});
  assert.equal(callbacks,0);assert.deepEqual(learningShape(store),beforeEvaluation,
    'retained direct candidates cannot create evaluation records, dispatches or promotions');

  const compilation=f.engine.learning.compilation('sigma_01'),cycleId='learning-cycle:direct-learning-boundary';
  const directCycle={id:cycleId,missionId:f.mission.id,runId:directRun.id,roleId:'sigma_01',evidenceRefs:[],
    scopeHash:compilation.scopeHash,datasetHash:compilation.datasetHash,parentHash:ordinary.parentHash,
    status:'OBSERVED',candidateId:directCandidateId,proposalId:null,createdAt:'2026-09-19T00:00:00.000Z',updatedAt:'2026-09-19T00:00:00.000Z',lastCode:null};
  store.put('learning-cycle',cycleId,directCycle,{expectedVersion:0});
  let proposalProviders=0,registeredProviders=0;
  const conductor=new LearningConductor({service:f.engine.learning,allowSimulation:true,providerFactory:()=>{
    proposalProviders++;throw Error('direct cycle reached proposal provider creation');
  }});
  const beforeAdvance=learningShape(store);
  await assert.rejects(conductor.advance(cycleId,{runCase}),{code:DIRECT_BLOCK});
  await assert.rejects(conductor.propose(directCycle),{code:DIRECT_BLOCK});
  assert.throws(()=>conductor.promote(cycleId,{}),{code:DIRECT_BLOCK});
  assert.throws(()=>conductor.update(cycleId,{status:'PROPOSING'}),{code:DIRECT_BLOCK});
  const detachedDirectCycle={...directCycle,id:'learning-cycle:detached-direct-boundary'};
  assert.throws(()=>conductor.proposalRequest(detachedDirectCycle),{code:DIRECT_BLOCK});
  await assert.rejects(conductor.propose(detachedDirectCycle),{code:DIRECT_BLOCK});
  assert.throws(()=>conductor.finishProposal(detachedDirectCycle),{code:DIRECT_BLOCK});
  assert.equal(proposalProviders,0);assert.equal(callbacks,0);assert.deepEqual(learningShape(store),beforeAdvance,
    'a direct cycle cannot acquire learning ownership, proposal state or evaluation work');

  const registered=new RegisteredLearningEvaluator({service:f.engine.learning,conductor,allowSimulation:true,providerFactory:()=>{
    registeredProviders++;throw Error('direct cycle reached registered evaluator provider creation');
  }});
  assert.throws(()=>registered.prepare(directCycle),{code:DIRECT_BLOCK});
  // The dispatch closure is independently rechecked.  It was prepared under a
  // normal evaluation-only lineage, then the caller tries to retarget it to
  // the completed direct mission before invoking it.
  const normalCycle={id:'learning-cycle:normal-prepared',missionId:'ordinary-evaluation-only-mission',runId:'external-cycle-run',roleId:'sigma_01',
    evidenceRefs:[],scopeHash:compilation.scopeHash,datasetHash:compilation.datasetHash,parentHash:ordinary.parentHash,
    status:'PROPOSED',candidateId:ordinary.candidateId,proposalId:'learning-proposal:normal',createdAt:'2026-09-19T00:00:00.000Z',updatedAt:'2026-09-19T00:00:00.000Z',lastCode:null};
  const prepared=registered.prepare(normalCycle),frozenCase=normalDataset.cases[0];
  normalCycle.missionId=f.mission.id;
  assert.throws(()=>prepared({evaluatorId:'exact-json-value-v1',datasetHash:compilation.datasetHash,roleId:'sigma_01',
    caseId:frozenCase.id,caseHash:sha256(frozenCase),case:frozenCase}),{code:DIRECT_BLOCK});
  assert.equal(registeredProviders,0,'the public registered evaluator rechecks immediately before provider dispatch');

  const directExportRole='direct-learning-export-role',directExportDataset=datasetSpec(f.mission.id),directHash=sha256(directExportDataset),exportRoot=join(f.root,'derived-learning');
  store.put('learning-dataset',directHash,directExportDataset,{expectedVersion:0});
  store.put('learning-role',directExportRole,{roleId:directExportRole,activeHash:'0'.repeat(64),baselineHash:'0'.repeat(64),datasetHash:directHash,approvedHashes:['0'.repeat(64)]},{expectedVersion:0});
  f.engine.learning.exportRoot=exportRoot;
  assert.throws(()=>f.engine.learning.exportActive({roleId:directExportRole,expectedVersion:0,principalId:'owner'}),{code:DIRECT_BLOCK});
  assert.throws(()=>f.engine.learning.registry.rollback({roleId:directExportRole,targetHash:'0'.repeat(64),principalId:'owner',reason:'direct route must not rollback learning'}),{code:DIRECT_BLOCK});
  assert.equal(existsSync(exportRoot),false,'direct-linked learning never creates a derived export directory');
});

test('a retained direct-author active parent cannot seed normal descendants, resolution, rollback or proposal dispatch',async t=>{
  const f=completedDirect(t);await f.engine.run(f.mission.id);
  const store=f.engine.store,directRun=store.list('run').find(record=>record.data.missionId===f.mission.id)?.data;
  const normalDataset=datasetSpec('ordinary-evaluation-only-mission'),datasetHash=sha256(normalDataset);
  const baseline=f.engine.learning.registerBaseline({roleId:'sigma_01',scope,datasetSpec:normalDataset});
  const compilation=f.engine.learning.compilation('sigma_01');

  // This represents a role promoted before the v3 boundary existed.  Its role
  // and dataset look normal; only the immutable candidate author points to the
  // completed direct route.  A later normal request must not build on it.
  const directActiveId='candidate:retained-direct-active',directInstructions='RETAINED_DIRECT_ACTIVE_PARENT',
    directHash=sha256({roleId:'sigma_01',instructions:directInstructions});
  store.put('learning-instructions',directHash,{roleId:'sigma_01',instructions:directInstructions,hash:directHash,parentHash:baseline.hash},{expectedVersion:0});
  store.put('learning-candidate',directActiveId,{candidateId:directActiveId,roleId:'sigma_01',parentHash:baseline.hash,
    instructionHash:directHash,datasetHash,rationale:'Retained direct-author lineage fixture.',authorRunId:directRun.id},{expectedVersion:0});
  const role=store.get('learning-role','sigma_01');
  store.put('learning-role','sigma_01',{...role.data,activeHash:directHash,approvedHashes:[...role.data.approvedHashes,directHash]},{expectedVersion:role.version});

  let providers=0;
  const conductor=new LearningConductor({service:f.engine.learning,allowSimulation:true,providerFactory:()=>{
    providers++;throw Error('a direct-author active parent must not create a proposal provider');
  }});
  const cycleId='learning-cycle:retained-direct-active-parent';
  store.put('learning-cycle',cycleId,{id:cycleId,missionId:'ordinary-evaluation-only-mission',runId:'external-cycle-run',roleId:'sigma_01',
    evidenceRefs:[],scopeHash:compilation.scopeHash,datasetHash:compilation.datasetHash,parentHash:directHash,status:'OBSERVED',
    candidateId:null,proposalId:null,createdAt:'2026-09-19T00:00:00.000Z',updatedAt:'2026-09-19T00:00:00.000Z',lastCode:null},{expectedVersion:0});
  const before=learningShape(store);
  const descendant={roleId:'sigma_01',parentHash:directHash,instructions:'NORMAL_LOOKING_DESCENDANT',
    rationale:'This must not extend a direct-authored parent.',authorRunId:'external-fixture-author'};
  assert.throws(()=>f.engine.learning.registry.getActive('sigma_01'),{code:DIRECT_BLOCK});
  assert.throws(()=>f.engine.learning.registry.propose(descendant),{code:DIRECT_BLOCK});
  assert.throws(()=>f.engine.learning.propose(descendant),{code:DIRECT_BLOCK});
  assert.throws(()=>f.engine.learning.resolve('sigma_01',scope),{code:DIRECT_BLOCK});
  assert.throws(()=>f.engine.learning.registry.rollback({roleId:'sigma_01',targetHash:baseline.hash,principalId:'owner',reason:'Do not consume a direct active lineage.'}),{code:DIRECT_BLOCK});
  assert.throws(()=>f.engine.learning.rollback({roleId:'sigma_01',targetHash:baseline.hash,principalId:'owner',reason:'Do not consume a direct active lineage.'}),{code:DIRECT_BLOCK});
  await assert.rejects(conductor.advance(cycleId,{runCase:async()=>{throw Error('unreachable evaluator');}}),{code:DIRECT_BLOCK});
  assert.equal(providers,0);assert.deepEqual(learningShape(store),before,
    'active direct ancestry rejects before an owner, proposal, evaluator or descendant write exists');

  // Rollback has a second historical ingress: a direct candidate can be
  // inactive but already listed as an approved target.  Target validation is
  // independent of the current active parent and runs before authority work.
  const rollbackRole='retained-direct-rollback-target',rollbackBaseline=f.engine.learning.registry.registerBaseline({roleId:rollbackRole,
    instructions:'ROLLBACK_BASELINE',datasetSpec:normalDataset}),rollbackInstructions='RETAINED_DIRECT_ROLLBACK_TARGET',
    rollbackHash=sha256({roleId:rollbackRole,instructions:rollbackInstructions}),rollbackCandidateId='candidate:retained-direct-rollback-target';
  store.put('learning-instructions',rollbackHash,{roleId:rollbackRole,instructions:rollbackInstructions,hash:rollbackHash,parentHash:rollbackBaseline.hash},{expectedVersion:0});
  store.put('learning-candidate',rollbackCandidateId,{candidateId:rollbackCandidateId,roleId:rollbackRole,parentHash:rollbackBaseline.hash,
    instructionHash:rollbackHash,datasetHash,rationale:'Retained direct rollback target fixture.',authorRunId:directRun.id},{expectedVersion:0});
  const rollbackRoleRecord=store.get('learning-role',rollbackRole);
  store.put('learning-role',rollbackRole,{...rollbackRoleRecord.data,approvedHashes:[...rollbackRoleRecord.data.approvedHashes,rollbackHash]},
    {expectedVersion:rollbackRoleRecord.version});
  const beforeRollbackTarget=learningShape(store);
  assert.throws(()=>f.engine.learning.registry.rollback({roleId:rollbackRole,targetHash:rollbackHash,principalId:'owner',reason:'Direct provenance cannot be reactivated.'}),{code:DIRECT_BLOCK});
  assert.throws(()=>f.engine.learning.rollback({roleId:rollbackRole,targetHash:rollbackHash,principalId:'owner',reason:'Direct provenance cannot be reactivated.'}),{code:DIRECT_BLOCK});
  assert.deepEqual(learningShape(store),beforeRollbackTarget,
    'an inactive direct candidate cannot be selected as a rollback target');

  // The role stores only a hash.  Two retained candidate rows for that hash
  // are deliberately ambiguous, even when neither row individually names a
  // direct run; accepting the first would permit a direct duplicate to hide.
  const ambiguousRole='ambiguous-active-lineage',ambiguousBaseline=f.engine.learning.registry.registerBaseline({roleId:ambiguousRole,
    instructions:'AMBIGUOUS_BASELINE',datasetSpec:normalDataset}),ambiguous=f.engine.learning.registry.propose({roleId:ambiguousRole,
      parentHash:ambiguousBaseline.hash,instructions:'AMBIGUOUS_ACTIVE',rationale:'Ambiguity fixture.',authorRunId:'external-fixture-author'});
  store.put('learning-candidate','candidate:ambiguous-duplicate',{...ambiguous,candidateId:'candidate:ambiguous-duplicate'}, {expectedVersion:0});
  const ambiguousRoleRecord=store.get('learning-role',ambiguousRole);
  store.put('learning-role',ambiguousRole,{...ambiguousRoleRecord.data,activeHash:ambiguous.instructionHash,
    approvedHashes:[...ambiguousRoleRecord.data.approvedHashes,ambiguous.instructionHash]},{expectedVersion:ambiguousRoleRecord.version});
  assert.throws(()=>f.engine.learning.registry.getActive(ambiguousRole),{code:DIRECT_BLOCK},
    'active lineage never guesses which repeated candidate provenance is authoritative');

  // A candidate may look ordinary itself yet inherit from a direct author.
  // Its role is intentionally still at baseline, so this exercises candidate
  // ancestry rather than merely the active-parent gate.
  const ancestorRole='direct-ancestor-candidate',ancestorBaseline=f.engine.learning.registry.registerBaseline({roleId:ancestorRole,
    instructions:'ANCESTOR_BASELINE',datasetSpec:normalDataset}),ancestorInstructions='DIRECT_ANCESTOR',
    ancestorHash=sha256({roleId:ancestorRole,instructions:ancestorInstructions}),ancestorId='candidate:direct-ancestor',
    childInstructions='ORDINARY_LOOKING_CHILD',childHash=sha256({roleId:ancestorRole,instructions:childInstructions}),childId='candidate:ordinary-child-of-direct';
  store.put('learning-instructions',ancestorHash,{roleId:ancestorRole,instructions:ancestorInstructions,hash:ancestorHash,parentHash:ancestorBaseline.hash},{expectedVersion:0});
  store.put('learning-candidate',ancestorId,{candidateId:ancestorId,roleId:ancestorRole,parentHash:ancestorBaseline.hash,instructionHash:ancestorHash,
    datasetHash,rationale:'Direct root retained before the boundary.',authorRunId:directRun.id},{expectedVersion:0});
  store.put('learning-instructions',childHash,{roleId:ancestorRole,instructions:childInstructions,hash:childHash,parentHash:ancestorHash},{expectedVersion:0});
  store.put('learning-candidate',childId,{candidateId:childId,roleId:ancestorRole,parentHash:ancestorHash,instructionHash:childHash,
    datasetHash,rationale:'An ordinary-looking child must inherit the direct denial.',authorRunId:'external-fixture-author'},{expectedVersion:0});
  let callbacks=0;const beforeDescendantEvaluation=learningShape(store);
  await assert.rejects(f.engine.learning.registry.evaluate(childId,{runCase:async()=>{callbacks++;throw Error('direct descendant reached callback');}}),{code:DIRECT_BLOCK});
  await assert.rejects(f.engine.learning.evaluate(childId,{runCase:async()=>{callbacks++;throw Error('direct descendant reached callback');}}),{code:DIRECT_BLOCK});
  assert.equal(callbacks,0);assert.deepEqual(learningShape(store),beforeDescendantEvaluation,
    'a normal-looking descendant of a direct candidate cannot open an evaluation or dispatch provider work');
});
