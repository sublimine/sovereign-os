import test from 'node:test';
import assert from 'node:assert/strict';
import {Store} from '../../factory/lib/store.mjs';
import {Authority} from '../../factory/lib/authority.mjs';
import {LearningService} from '../../factory/lib/learning-service.mjs';
import {learningStatusReport} from '../../factory/lib/learning-status.mjs';
import {admitLearningProvenanceFixtureSource,learningProvenanceFixturePolicy,signedLearningProvenanceFixture} from './fixtures/learning-provenance.mjs';

const scope = purpose => ({roleIds:['sigma_01'],purpose,mode:'producer'});
const dataset = name => ({missionId:`status-${name}`,evaluatorId:'trusted-status-fixture',cases:[
  {id:'training',input:{taskInstructions:'fixture',input:'{}',schema:{type:'object'},model:'gpt-6-astra',reasoningEffort:'ultra'},expected:{answer:'secret-training'},required:true,holdout:false,criteria:[{metric:'accuracy',direction:'higher',threshold:1}]},
  {id:'holdout',input:{taskInstructions:'fixture',input:'{}',schema:{type:'object'},model:'gpt-6-astra',reasoningEffort:'ultra'},expected:{answer:'secret-holdout'},required:true,holdout:true,criteria:[{metric:'accuracy',direction:'higher',threshold:1}]},
],policy:{requireImprovement:true}});
function registerAttested(service,store,{domainId,scope:domainScope,datasetSpec}){
  const source=admitLearningProvenanceFixtureSource(store,{missionId:datasetSpec.missionId}),request={domainId,roleId:'sigma_01',scope:domainScope,datasetSpec};
  return service.registerDomain({...request,provenance:signedLearningProvenanceFixture({...request,service,source})});
}

test('empty learning status is explicit and side-effect free', () => {
  const store = new Store(':memory:');
  try {
    const before = store.verifyJournal(), report = learningStatusReport(store);
    assert.equal(report.schema,'sovereign.learning-status.v1');
    assert.deepEqual(report.registration,{scopeCount:0,domainCount:0,legacyScopeCount:0,provenanceStatusCounts:{}});
    assert.deepEqual(report.lifecycleCounts,{});
    assert.equal(report.safety.providerCalls,0);assert.equal(report.safety.stateChanges,0);
    assert.deepEqual(store.verifyJournal(),before);
  } finally { store.close(); }
});

test('status fail-closes unverified learning-cycle rows and their count', () => {
  const store = new Store(':memory:'), sentinel='PRIVATE_LEARNING_STATUS_CYCLE_SENTINEL';
  try {
    store.put('learning-cycle','learning-cycle:private',{id:'learning-cycle:private',missionId:'mission:private',runId:'run:private',roleId:'role:private',status:'OBSERVED',privateBytes:sentinel},{expectedVersion:0});
    const before=store.verifyJournal(),report=learningStatusReport(store);
    assert.equal(report.cycles,undefined);assert.equal(report.totals.cycleCount,undefined);
    assert.equal(report.cycleProjection.integrity,'NOT_PROJECTED');assert(!JSON.stringify(report).includes(sentinel));
    assert.deepEqual(store.verifyJournal(),before);
  } finally { store.close(); }
});

test('status exposes registration and proposal lifecycle without leaking frozen cases', () => {
  const store = new Store(':memory:'), service = new LearningService({store,authority:new Authority(store),provenancePolicy:learningProvenanceFixturePolicy});
  try {
    const domain = registerAttested(service,store,{domainId:'status-domain',scope:scope('status'),datasetSpec:dataset('domain')});
    let report = learningStatusReport(store), item = report.scopes[0];
    assert.equal(item.lifecycle,'REGISTERED_BASELINE');assert.equal(item.caseCount,2);
    assert.equal(item.trainingCaseCount,1);assert.equal(item.holdoutCaseCount,1);assert.equal(item.evaluatorId,'trusted-status-fixture');
    assert.equal(item.policyId,domain.policyId);assert.equal(item.activeHash,item.baselineHash);assert.equal(item.approvedVersionCount,1);
    assert.equal(item.provenanceStatus,'ATTESTED_STORED_RUNTIME_RECHECK_REQUIRED');
    assert(!JSON.stringify(report).includes('secret-training'));assert(!JSON.stringify(report).includes('secret-holdout'));
    const baseline = service.registry.getActive(domain.policyId);
    service.propose({roleId:domain.policyId,parentHash:baseline.hash,instructions:'STATUS_FIXTURE_CANDIDATE',rationale:'private rationale omitted from status',authorRunId:'status-author'});
    report = learningStatusReport(store);item = report.scopes[0];
    assert.equal(item.lifecycle,'PROPOSED');assert.equal(item.candidateCount,1);assert.equal(item.evaluationCount,0);
    assert(!JSON.stringify(report).includes('STATUS_FIXTURE_CANDIDATE'));assert(!JSON.stringify(report).includes('private rationale'));
    assert.equal(report.safety.automaticActivation,false);
  } finally { store.close(); }
});

test('evaluation-only registration is never reported as an active overlay', () => {
  const store = new Store(':memory:'), service = new LearningService({store,authority:new Authority(store)});
  try {
    service.registerDomain({domainId:'status-eval-only',roleId:'sigma_01',scope:scope('evaluation-only'),datasetSpec:{...dataset('eval-only'),policy:{requireImprovement:true,activation:'evaluation-only'}}});
    const item = learningStatusReport(store).scopes[0];
    assert.equal(item.lifecycle,'REGISTERED_EVALUATION_ONLY');assert.equal(item.activation,'evaluation-only');
    assert.equal(item.provenanceStatus,'EVALUATION_ONLY_UNATTESTED');
    assert.notEqual(item.lifecycle,'ACTIVE_OVERLAY');
  } finally { store.close(); }
});
