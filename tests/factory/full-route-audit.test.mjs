import test from 'node:test';
import assert from 'node:assert/strict';
import {canonical,id,sha256} from '../../factory/lib/contracts.mjs';
import {Store} from '../../factory/lib/store.mjs';
import {Authority} from '../../factory/lib/authority.mjs';
import {ArtifactRegistry} from '../../factory/lib/artifacts.mjs';
import {PlanLedger} from '../../factory/lib/plans.mjs';
import {auditRouteReentryJournal} from '../../reconstruction/verification/full-route-audit.mjs';

function acceptedReviewerState(store,authority,registry,{missionId,reviewerRunId,artifactStatus='ACCEPTED',incompleteReviewer=false}){
  const at='2026-01-01T00:00:00.000Z',artifactId='artifact:accepted',reviewId='review:accepted';
  const effect=(operationId,tool,args,result)=>{
    const receipt={id:operationId,missionId,principalId:reviewerRunId,tool,argsHash:sha256(args),status:'SUCCEEDED',result,startedAt:at,completedAt:at};
    const signed=authority.seal('tool.receipt',receipt);
    store.put('effect',operationId,{missionId,principalId:reviewerRunId,tool,argsHash:receipt.argsHash,state:'SUCCEEDED',receipt:signed},{expectedVersion:0});
    return {id:operationId,hash:sha256(signed),principalId:reviewerRunId,relation:'OWN_ACTION',signedReceipt:signed,resultText:canonical(result),observedAt:at};
  };
  const listingResult={path:'.',entries:[]},fileResult={path:'README.md',content:'read',sha256:sha256('read'),bytes:4},executionResult={snapshotHash:sha256('snapshot')};
  const listing=effect('effect:list','workspace.list',{path:'.'},listingResult);
  const file=effect('effect:read','workspace.read',{path:'README.md'},fileResult);
  const execution=effect('effect:execution','execution.run',{argv:['node','--test'],cwd:'.'},executionResult);
  const payload={missionId,nodeId:'delivery',producerRunId:'run:producer',kind:'delivery',purpose:'deliver',body:'accepted result',claims:[],inputRefs:[],toolReceipts:[],requiredEffects:[],criteria:[],provisional:false};
  const payloadHash=sha256(payload);
  const reviewer={id:reviewerRunId,missionId,nodeId:'review:delivery',mode:'reviewer',context:{artifactIds:[artifactId]},toolObservations:[listing,file,execution],
    inferenceReceipt:{status:'completed',threadId:'reviewer-thread'},inferenceReceipts:[{status:'completed',threadId:'reviewer-thread'}],expectedRequestHash:null};
  if(!incompleteReviewer)reviewer.completedExposureHash=registry.exposureHash(reviewer);
  store.put('run',reviewerRunId,reviewer,{expectedVersion:0});
  store.put('review',reviewId,{id:reviewId,artifactId,reviewerRunId,result:{decision:'ACCEPT',artifactHash:payloadHash}},{expectedVersion:0});
  store.put('artifact',artifactId,{id:artifactId,missionId,payload,payloadHash,status:artifactStatus,reviews:[reviewId]},{expectedVersion:0});
  store.put('mission',missionId,{id:missionId,status:'COMPLETED',finalArtifactId:artifactId},{expectedVersion:0});
  return {artifactId,payloadHash,listing,file,execution,listingResult,fileResult,executionResult};
}

function completedReentry(t,{extraEvent=false,withValidation=true,leasePrincipal=null,eventRunId=null,forgedObservation=false,artifactStatus='ACCEPTED',incompleteReviewer=false}={}){
  const store=new Store(':memory:'),authority=new Authority(store),registry=new ArtifactRegistry(store,authority);
  t.after(()=>store.close());
  const missionId='mission:reentry',reviewerRunId='run:reviewer',ledger=new PlanLedger(store,{registry});
  const accepted=acceptedReviewerState(store,authority,registry,{missionId,reviewerRunId,artifactStatus,incompleteReviewer});
  const beforeJournal=store.verifyJournal();
  ledger.acquireEngine({ownerId:'engine:reentry'});
  if(withValidation){
    const expiresAt=new Date(Date.now()+60_000).toISOString();
    const leaseRunId=leasePrincipal??reviewerRunId;
    authority.issue({missionId,principalId:leaseRunId,actions:['workspace.list'],resources:[`workspace:${missionId}`],classification:'INTERNAL',expiresAt});
    authority.issue({missionId,principalId:leaseRunId,actions:['workspace.read'],resources:[`workspace:${missionId}`],classification:'INTERNAL',expiresAt});
    const validation={id:id('workspace-validation'),missionId,principalId:reviewerRunId,artifactId:accepted.artifactId,artifactHash:accepted.payloadHash,status:'UNCHANGED',
      files:[{path:'README.md',sha256:accepted.fileResult.sha256,observedReceiptId:forgedObservation?'effect:forged':accepted.file.id,observedReceiptHash:forgedObservation?sha256('forged'):accepted.file.hash}],
      listings:[{path:'.',sha256:sha256(accepted.listingResult),observedReceiptId:accepted.listing.id,observedReceiptHash:accepted.listing.hash}],
      executions:[{operationId:accepted.execution.id,receiptHash:accepted.execution.hash,snapshotHash:accepted.executionResult.snapshotHash}],checkedAt:new Date().toISOString()};
    store.put('workspace-validation',validation.id,{signed:authority.seal('workspace.validation',validation)},{expectedVersion:0});
    store.append('workspace.validation',{validationId:validation.id,missionId,runId:eventRunId??reviewerRunId,artifactId:validation.artifactId,status:'UNCHANGED',fileCount:validation.files.length});
  }
  ledger.releaseEngine('engine:reentry');
  if(extraEvent)store.append('worker.inference.completed',{missionId,runId:reviewerRunId});
  return {store,registry,missionId,reviewerRunId,beforeJournal,accepted};
}

test('re-entry journal audit accepts only the signed ownership, scoped read and validation route',t=>{
  const input=completedReentry(t);
  const audited=auditRouteReentryJournal(input);
  assert.equal(audited.journal.eventCount,6);
  assert.equal(audited.engine.released.version,audited.engine.acquired.version+1);
  assert.deepEqual(audited.readLeases.map(lease=>lease.action).sort(),['workspace.list','workspace.read']);
  assert.deepEqual(audited.validation,{id:audited.validation.id,hash:audited.validation.hash,artifactId:input.accepted.artifactId,artifactHash:input.accepted.payloadHash,
    status:'UNCHANGED',fileCount:1,listingCount:1,executionCount:1});
});

test('re-entry journal audit rejects missing validation and every extra side effect',t=>{
  const withoutValidation=completedReentry(t,{withValidation:false});
  assert.throws(()=>auditRouteReentryJournal(withoutValidation),{code:'ROUTE_AUDIT'});
  const withExtraEvent=completedReentry(t,{extraEvent:true});
  assert.throws(()=>auditRouteReentryJournal(withExtraEvent),{code:'ROUTE_AUDIT'});
});

test('re-entry journal audit binds both temporary leases and validation event to the accepting reviewer',t=>{
  assert.throws(()=>auditRouteReentryJournal(completedReentry(t,{leasePrincipal:'run:other-reviewer'})),{code:'ROUTE_AUDIT'});
  assert.throws(()=>auditRouteReentryJournal(completedReentry(t,{eventRunId:'run:other-reviewer'})),{code:'ROUTE_AUDIT'});
});

test('re-entry journal audit requires the pre-existing accepted final artifact and its exact reviewer effects',t=>{
  assert.throws(()=>auditRouteReentryJournal(completedReentry(t,{artifactStatus:'CANDIDATE'})),{code:'ROUTE_AUDIT'});
  assert.throws(()=>auditRouteReentryJournal(completedReentry(t,{forgedObservation:true})),{code:'ROUTE_AUDIT'});
  assert.throws(()=>auditRouteReentryJournal(completedReentry(t,{incompleteReviewer:true})),{code:'ROUTE_AUDIT'});
});
