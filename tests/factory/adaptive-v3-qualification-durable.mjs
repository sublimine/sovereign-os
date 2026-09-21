// Test-only reconciliation around the historical adaptive-v3 qualification
// harness.  The public report intentionally withholds generic run/effect
// telemetry.  This helper proves the harness's call-accounting and tool-scope
// controls from retained Store records instead; it does not re-project any of
// those records through the public report or modify reconstruction evidence
// outside the temporary test directory.
import * as fs from 'node:fs';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {DatabaseSync} from 'node:sqlite';
import {canonical,sha256} from '../../factory/lib/contracts.mjs';
import {Store} from '../../factory/lib/store.mjs';
import {Authority} from '../../factory/lib/authority.mjs';
import {ArtifactRegistry} from '../../factory/lib/artifacts.mjs';
import {inferenceRequestHash} from '../../factory/providers/instruction-profiles.mjs';
import {methodRecoveryReport} from '../../factory/lib/method-recovery.mjs';
import {runFullRouteCase as runHistoricalFullRouteCase} from '../../reconstruction/verification/full-route-harness.mjs';
import {auditAdaptiveV3QualificationCase as auditHistoricalAdaptiveV3QualificationCase} from '../../reconstruction/verification/adaptive-v3-qualification-audit.mjs';

const failure=message=>Object.assign(Error(message),{code:'TEST_DURABLE_ACCOUNTING'});
const require=(condition,message)=>{if(!condition)throw failure(message);};
const same=(left,right)=>canonical(left)===canonical(right);

function immutableStore(databasePath){
  const url=pathToFileURL(databasePath);url.searchParams.set('immutable','1');
  const db=new DatabaseSync(url.href,{readOnly:true,defensive:true,allowExtension:false});
  db.exec('PRAGMA query_only=ON; PRAGMA trusted_schema=OFF; BEGIN');
  const store=Object.create(Store.prototype);store.db=db;
  return {store,close(){try{if(db.isTransaction)db.exec('ROLLBACK');}finally{db.close();}}};
}

function publicBoundary(report){
  return report?.metrics?.integrity==='NOT_ATTESTED'
    &&report.metrics.dispatched===undefined&&report.metrics.withoutFinalOutcome===undefined
    &&report.metrics.simulatedCompleted===undefined&&report.metrics.unclassifiedCompleted===undefined
    &&Array.isArray(report.timeline)&&report.timeline.length===0
    &&Array.isArray(report.effects)&&report.effects.length===0
    &&Array.isArray(report.reviews)&&report.reviews.length===0;
}

function durableAccounting({directory,result,spec}){
  const databasePath=join(directory,'state.sqlite'),handle=immutableStore(databasePath);
  try{
    const {store}=handle,authority=new Authority(store),registry=new ArtifactRegistry(store,authority);
    const mission=store.get('mission',result.missionId)?.data;
    require(mission?.id===result.missionId&&mission.status==='COMPLETED'&&typeof mission.finalArtifactId==='string',
      'Completed durable mission and final pointer are required');
    const finalRecord=store.get('artifact',mission.finalArtifactId)?.data;
    require(finalRecord?.missionId===mission.id&&finalRecord.status==='ACCEPTED'&&finalRecord.payloadHash===sha256(finalRecord.payload),
      'Final durable artifact is missing, unaccepted, or altered');
    registry.assertUsable(mission.finalArtifactId,{missionId:mission.id,purpose:finalRecord.payload.purpose});

    const calls=result.calls;
    require(Array.isArray(calls)&&calls.length>0,'Harness must retain at least one call');
    const keys=new Set();
    for(const call of calls){
      require(Number.isSafeInteger(call?.index)&&typeof call.runId==='string'&&typeof call.requestHash==='string'
        &&call.receipt?.status==='completed'&&call.receipt.contextHash===call.requestHash&&call.error===null,
      'Retained call shape is incomplete');
      const key=canonical([call.runId,call.requestHash]);
      require(!keys.has(key),'Two retained calls share one run/request identity');keys.add(key);
      const requestPath=join(directory,`request-${call.index}.json`);
      require(fs.existsSync(requestPath),'Exact retained request capture is missing');
      const capture=JSON.parse(fs.readFileSync(requestPath,'utf8'));
      require(capture.index===call.index&&capture.runId===call.runId&&capture.requestHash===call.requestHash
        &&same(capture.receipt??null,null)&&inferenceRequestHash(capture.request)===call.requestHash,
      'Retained request capture no longer binds this call');

      const run=store.get('run',call.runId)?.data;
      require(run?.id===call.runId&&run.missionId===mission.id&&Array.isArray(run.requests)
        &&run.requests.filter(request=>request.requestHash===call.requestHash).length===1,
      'Durable run does not contain exactly this dispatched request');
      const requestId=`inference-request:${sha256([call.runId,call.requestHash])}`;
      const retained=store.get('inference-request',requestId);
      require(retained?.version===1&&retained.data.schema==='sovereign.inference-request.v1'
        &&retained.data.retention==='BEFORE_DISPATCH'&&retained.data.runId===call.runId
        &&retained.data.missionId===mission.id&&retained.data.requestHash===call.requestHash
        &&same(JSON.parse(retained.data.requestJson),JSON.parse(JSON.stringify(capture.request))),
      'Durable retained request does not match the captured dispatched bytes');
      const receipts=(run.inferenceReceipts??[]).filter(receipt=>receipt.contextHash===call.requestHash);
      require(receipts.length===1&&same(receipts[0],call.receipt),'Durable completion receipt does not match this retained call');
    }

    const missionRuns=store.list('run').map(record=>record.data).filter(run=>run.missionId===mission.id);
    const allRequests=store.list('inference-request').filter(record=>record.data.missionId===mission.id);
    const allReceipts=missionRuns.flatMap(run=>(run.inferenceReceipts??[]).map(receipt=>({runId:run.id,requestHash:receipt.contextHash,receipt})));
    require(allRequests.length===calls.length&&allReceipts.length===calls.length
      &&missionRuns.every(run=>run.expectedRequestHash===null||run.expectedRequestHash===undefined),
    'Mission retains an unaccounted or pending inference');
    require(same([...new Set(allRequests.map(record=>canonical([record.data.runId,record.data.requestHash])))].sort(),[...keys].sort()),
      'Durable retained request identities diverge from captured calls');
    require(same([...new Set(allReceipts.map(item=>canonical([item.runId,item.requestHash])))].sort(),[...keys].sort())
      &&allReceipts.every(item=>item.receipt.status==='completed'&&item.receipt.simulation===true),
    'Durable completion receipts diverge from captured simulated calls');

    const effects=store.list('effect').filter(record=>record.data.missionId===mission.id);
    const scopedEffects=effects.every(record=>{
      const effect=record.data;
      if(!spec.allowedTools.includes(effect.tool)||!['SUCCEEDED','FAILED'].includes(effect.state)||!effect.receipt)return false;
      try{
        const receipt=registry.verifiedToolReceipt(effect.receipt);
        return receipt.id===record.id&&receipt.missionId===mission.id&&receipt.principalId===effect.principalId
          &&receipt.tool===effect.tool&&receipt.status===effect.state;
      }catch{return false;}
    });
    require(scopedEffects,'Durable effect is outside the admitted scope, nonterminal, or lacks its exact signed receipt');
    return {schema:'sovereign.test-durable-call-accounting.v1',integrity:'VERIFIED',
      calls:calls.length,retainedRequests:allRequests.length,completedReceipts:allReceipts.length,effects:effects.length,
      scope:'Test-only verification of exact retained request/call/receipt identities and terminal admitted effects. It is not a public telemetry projection.'};
  }finally{handle.close();}
}

export async function runFullRouteCaseDurably(options){
  const result=await runHistoricalFullRouteCase(options);
  // Historical non-V3 paths keep their own compatibility behavior.  The
  // adaptive-v3 qualification arm is always simulated, so public operational
  // telemetry must stay redacted even while this test-private audit is exact.
  if(options.mode!=='adaptive-v3-planned'||options.simulation===false)return result;
  const nonAccountingChecks=Object.entries(result.checks??{}).filter(([key])=>key!=='fullCallAccounting');
  if(result.fatal||!nonAccountingChecks.every(([,value])=>value===true))return result;
  const reportPath=join(options.directory,'final-report.json');
  const report=fs.existsSync(reportPath)?JSON.parse(fs.readFileSync(reportPath,'utf8')):null;
  if(!publicBoundary(report))return result;
  let accounting;
  try{accounting=durableAccounting({directory:options.directory,result,spec:options.spec});}
  catch{return result;}
  const checks={...result.checks,fullCallAccounting:accounting.integrity==='VERIFIED',scopedEffects:accounting.integrity==='VERIFIED'&&result.checks.scopedEffects};
  const reconciled={...result,checks,structuralPassed:Object.values(checks).every(Boolean),
    passed:Object.values(checks).every(Boolean)&&result.actualSubscription,durableTestAccounting:accounting,
    publicProjection:{metricsIntegrity:report.metrics.integrity,telemetryProjected:false,timelineEntries:report.timeline.length,
      effectEntries:report.effects.length,reviewEntries:report.reviews.length}};
  fs.writeFileSync(join(options.directory,'result.json'),JSON.stringify(reconciled,null,2),{mode:0o600});
  return reconciled;
}

// A narrow test reader for assertions that previously consumed `report.effects`.
// It returns only authenticated effect facts from the immutable test database;
// callers must not use it to widen report.mjs.
export function readDurableQualificationEffects({directory,missionId}){
  const handle=immutableStore(join(directory,'state.sqlite'));
  try{
    const authority=new Authority(handle.store),registry=new ArtifactRegistry(handle.store,authority);
    return handle.store.list('effect').filter(record=>record.data.missionId===missionId).map(record=>{
      const effect=record.data;
      require(effect.state==='SUCCEEDED'&&effect.receipt&&typeof effect.receipt==='object',
        `Qualification effect is not a completed signed operation: ${record.id}:${effect.tool}:${effect.state}`);
      const receipt=registry.verifiedToolReceipt(effect.receipt);
      require(receipt.id===record.id&&receipt.missionId===missionId&&receipt.principalId===effect.principalId
        &&receipt.tool===effect.tool&&receipt.status==='SUCCEEDED','Qualification effect receipt diverges from its durable operation');
      return {id:record.id,tool:effect.tool,principalId:effect.principalId,state:effect.state,receiptHash:sha256(effect.receipt)};
    });
  }finally{handle.close();}
}

const recordMatches=(record,reference)=>record?.type===reference?.type&&record.id===reference.id
  &&record.version===reference.version&&record.hash===reference.hash;

// The public method-recovery summary intentionally has no diagnostic failure,
// method or instruction fields. This reader revalidates the rich internal
// recovery chain only for this test's closed evidence assertions.
export function readDurableQualificationRecovery({directory,missionId}){
  const handle=immutableStore(join(directory,'state.sqlite'));
  try{
    const authority=new Authority(handle.store),registry=new ArtifactRegistry(handle.store,authority);
    const recovery=methodRecoveryReport(handle.store,missionId);
    require(recovery?.mode==='reviewed-method-v1'&&recovery.rounds.length===1
      &&recovery.rounds[0].status==='INSTALLED_HISTORICALLY','Durable recovery round is absent or not installed');
    const round=recovery.rounds[0],failure=round.failures?.[0];
    require(round.failures?.length===1&&failure?.previousMethod?.id==='direct-synthesis'
      &&failure.replacementMethod?.id==='independent-reconstruction','Durable recovery method is not causally distinct');
    const origin=handle.store.get(round.origin.type,round.origin.id,round.origin.version);
    const replacement=handle.store.get(round.replacementPlan.type,round.replacementPlan.id,round.replacementPlan.version);
    const rejectedArtifact=handle.store.get(failure.artifact.type,failure.artifact.id,failure.artifact.version);
    const rejectedReview=handle.store.get(failure.review.type,failure.review.id,failure.review.version);
    require(recordMatches(origin,round.origin)&&recordMatches(replacement,round.replacementPlan)
      &&recordMatches(rejectedArtifact,failure.artifact)&&recordMatches(rejectedReview,failure.review)
      &&rejectedArtifact.data.status==='RETURNED'&&rejectedReview.data.result.decision==='RETURN',
    'Durable recovery references no longer bind the recorded rejection and replacement plan');
    const replacementArtifact=handle.store.get('artifact',replacement.data.acceptedPlanArtifactId)?.data;
    require(replacementArtifact?.status==='ACCEPTED'&&replacementArtifact.missionId===missionId,
      'Replacement plan lacks its accepted durable artifact');
    registry.assertUsable(replacementArtifact.id,{missionId,purpose:'plan'});
    return {schema:'sovereign.test-durable-method-recovery.v1',integrity:'VERIFIED',rounds:1,
      previousMethod:failure.previousMethod.id,replacementMethod:failure.replacementMethod.id,
      scope:'Test-only authenticated recovery diagnosis; rejected product/review details and method rationale remain outside public reporting.'};
  }finally{handle.close();}
}

export function auditAdaptiveV3QualificationCaseDurably(options){
  const observed=auditHistoricalAdaptiveV3QualificationCase(options);
  if(options?.row!=='recovery'||observed.status==='QUALIFIED_FOR_DECLARED_ROW')return observed;
  // The historical auditor establishes every preceding immutable route,
  // receipt, journal and read-only condition before this exact redaction
  // failure. Do not bridge any other audit error.
  if(observed.status!=='OBSERVED_NOT_QUALIFIED'||observed.error?.code!=='ADAPTIVE_V3_READ_ONLY_AUDIT'
    ||observed.error?.message!=='Recovery method did not remain causally distinct from the rejected method'
    ||observed.checks?.readOnly!==true)return observed;
  try{
    const result=JSON.parse(fs.readFileSync(join(options.directory,'result.json'),'utf8'));
    const report=JSON.parse(fs.readFileSync(join(options.directory,'final-report.json'),'utf8'));
    require(result?.missionId&&publicBoundary(report),'Recovery bridge requires the strict redacted public boundary');
    const publicRound=report.methodRecovery?.rounds?.[0];
    require(publicRound?.status==='INSTALLED_HISTORICALLY'&&!Object.hasOwn(publicRound,'failures')
      &&!Object.hasOwn(publicRound,'previousMethod')&&!Object.hasOwn(publicRound,'replacementMethod'),
    'Public recovery report unexpectedly exposes private diagnosis');
    const recovery=readDurableQualificationRecovery({directory:options.directory,missionId:result.missionId});
    return {...observed,status:'QUALIFIED_FOR_DECLARED_ROW',error:null,
      checks:{...observed.checks,historicalPrerequisites:true,durableRecovery:true,publicMethodRecoveryRedacted:true,readOnly:true},
      details:{...observed.details,recovery}};
  }catch{return observed;}
}
