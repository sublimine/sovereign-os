// Test-only reconciliation for the historical conditional-selection harness.
//
// The public mission report intentionally does not project generic inference
// telemetry.  The historical harness predates that boundary and therefore
// mistakes NOT_ATTESTED public metrics for a missing assessment.  This module
// keeps that report redacted and proves the closed test's call accounting from
// the immutable Store, signed conditional result, retained dispatch requests,
// and completed receipts instead.  It is deliberately not a production
// reporting path.
import * as fs from 'node:fs';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {DatabaseSync} from 'node:sqlite';
import {canonical,sha256} from '../../factory/lib/contracts.mjs';
import {Store} from '../../factory/lib/store.mjs';
import {Authority} from '../../factory/lib/authority.mjs';
import {ArtifactRegistry} from '../../factory/lib/artifacts.mjs';
import {inputCopyEvidence} from '../../factory/lib/input-copy.mjs';
import {inferenceRequestHash} from '../../factory/providers/instruction-profiles.mjs';
import {runConditionalSelectionCase as runHistoricalConditionalSelectionCase} from '../../reconstruction/verification/conditional-selection-harness.mjs';

const failure=message=>Object.assign(Error(message),{code:'TEST_DURABLE_CONDITIONAL_ACCOUNTING'});
const require=(condition,message)=>{if(!condition)throw failure(message);};
const same=(left,right)=>canonical(left)===canonical(right);
const ref=record=>record&&({type:record.type,id:record.id,version:record.version,hash:record.hash});

function immutableStore(databasePath){
  const url=pathToFileURL(databasePath);url.searchParams.set('immutable','1');
  const db=new DatabaseSync(url.href,{readOnly:true,defensive:true,allowExtension:false});
  db.exec('PRAGMA query_only=ON; PRAGMA trusted_schema=OFF; BEGIN');
  const store=Object.create(Store.prototype);store.db=db;
  return {store,close(){try{if(db.isTransaction)db.exec('ROLLBACK');}finally{db.close();}}};
}

function publicBoundary(report){
  return report?.metrics?.integrity==='NOT_ATTESTED'
    &&report.metrics.dispatched===undefined&&report.metrics.completed===undefined
    &&report.metrics.simulatedCompleted===undefined&&report.metrics.liveCompleted===undefined
    &&Array.isArray(report.timeline)&&report.timeline.length===0
    &&Array.isArray(report.effects)&&report.effects.length===0
    &&Array.isArray(report.reviews)&&report.reviews.length===0;
}

function captureFiles(directory){
  const names=fs.readdirSync(directory).filter(name=>/^(?:request|response)-\d+\.json$/.test(name)).sort((left,right)=>{
    const [leftKind,leftIndex]=left.split(/[.-]/),[rightKind,rightIndex]=right.split(/[.-]/);
    return Number(leftIndex)-Number(rightIndex)||leftKind.localeCompare(rightKind);
  });
  require(same(names,['request-0.json','response-0.json','request-1.json','response-1.json','request-2.json','response-2.json']),
    'Exactly three retained request/response capture pairs are required');
  return [0,1,2].map(index=>({
    request:JSON.parse(fs.readFileSync(join(directory,`request-${index}.json`),'utf8')),
    response:JSON.parse(fs.readFileSync(join(directory,`response-${index}.json`),'utf8')),
  }));
}

function durableAssessmentAccounting({directory,result,assessmentSimulation}){
  const handle=immutableStore(join(directory,'state.sqlite'));
  try{
    const {store}=handle,authority=new Authority(store),registry=new ArtifactRegistry(store,authority);
    const journal=store.verifyJournal();
    require(same(journal,result.journal),'Historical result no longer binds the durable journal head');
    const missionRecord=store.get('mission',result.missionId),mission=missionRecord?.data;
    require(missionRecord?.id===result.missionId&&mission?.id===result.missionId&&mission.finalArtifactId===null&&mission.status!=='COMPLETED',
      'Conditional diagnostic must retain an unfinished, non-accepted mission');

    const candidates=store.list('artifact').filter(record=>record.data.missionId===mission.id
      &&record.data.payload?.kind==='literal-input-copy');
    require(candidates.length===1,'Exactly one durable native candidate is required');
    const candidateRecord=store.get('artifact',candidates[0].id,1),candidate=store.get('artifact',candidates[0].id)?.data;
    require(candidateRecord?.version===1&&candidate?.id===result.candidateId&&candidate.status==='CANDIDATE'
      &&candidate.payloadHash===result.candidateHash&&candidate.payloadHash===sha256(candidate.payload),
    'Native candidate is missing, accepted, or altered');
    const origin=inputCopyEvidence(registry,candidate.id);
    require(origin.artifactId===candidate.id&&origin.artifactHash===candidate.payloadHash,
      'Native candidate no longer has its authenticated input-copy origin');

    const assessmentHeads=store.list('conditional-assessment').filter(record=>record.data.contract?.missionId===mission.id);
    require(assessmentHeads.length===1&&assessmentHeads[0].id===result.assessmentRunId,
      'Exactly one conditional assessment head must belong to this mission');
    const prepared=store.get('conditional-assessment',result.assessmentRunId,1),state=store.get('conditional-assessment',result.assessmentRunId);
    const contract=prepared?.data?.contract;
    require(prepared?.data?.status==='PREPARED'&&state?.version===3&&state.data.status==='ASSESSED'
      &&same(state.data.contract,contract)&&contract?.schema==='sovereign.conditional-assessment.v1'
      &&contract.runId===result.assessmentRunId&&contract.missionId===mission.id&&contract.artifactId===candidate.id
      &&contract.artifactHash===candidate.payloadHash&&same(contract.targetRecord,ref(candidateRecord))
      &&contract.operationalAcceptance===false&&contract.condition==='RECORDED_PREREQUISITE_APPROVALS_ARE_FIXTURE_CHECKPOINTS_ONLY',
    'Conditional assessment contract or its three-state durable lifecycle changed');

    const resultHeads=store.list('conditional-result').filter(record=>record.id===result.assessmentRunId);
    const signedRecord=store.get('conditional-result',result.assessmentRunId,1);
    require(resultHeads.length===1&&signedRecord?.version===1&&sha256(signedRecord.data.signed)===state.data.resultHash,
      'Completed conditional result is absent, duplicated, or no longer bound to the assessed state');
    const assessment=authority.open(signedRecord.data.signed,'conditional.assessment');
    require(same(assessment,result.assessment)&&assessment.schema==='sovereign.conditional-assessment-result.v1'
      &&assessment.assessmentId===contract.id&&assessment.runId===contract.runId&&assessment.contractHash===sha256(contract)
      &&assessment.artifactId===candidate.id&&assessment.artifactHash===candidate.payloadHash&&assessment.kind==='CONDITIONAL_DIAGNOSTIC'
      &&assessment.operationalAcceptance===false&&assessment.scope===contract.scope
      &&assessment.simulation===Boolean(assessmentSimulation),
    'Signed conditional result does not exactly bind this diagnostic-only contract');

    const runRecord=store.get('run',assessment.runId,assessment.runRecord?.version),run=runRecord?.data;
    require(assessment.runRecord?.type==='run'&&assessment.runRecord.id===assessment.runId&&assessment.runRecord.hash===runRecord?.hash
      &&run?.missionId===mission.id&&run.mode==='reviewer'&&run.nodeId===`review:${candidate.payload.nodeId}`
      &&run.inferenceReceipt?.status==='completed'&&sha256(run.inferenceReceipt)===assessment.inferenceReceiptHash
      &&run.completedExposureHash===assessment.completedExposureHash,
    'Assessment run, receipt, or exposure is no longer bound to its signed result');

    const events=store.events({limit:10000}).filter(event=>event.kind==='assessment.recorded');
    require(events.length===1&&same(events[0].data,{runId:assessment.runId,assessmentId:contract.id,artifactId:candidate.id,operationalAcceptance:false}),
      'Assessment-recorded journal event is absent, duplicated, or changed');

    const captures=captureFiles(directory),expectedPhases=['simulated-plan','simulated-plan-review','conditional-assessment'];
    const identities=new Set();
    for(const [index,capture] of captures.entries()){
      const {request,response}=capture;
      require(request?.phase===expectedPhases[index]&&request.runId&&request.requestHash&&request.request
        &&inferenceRequestHash(request.request)===request.requestHash&&response?.receipt?.status==='completed'
        &&response.receipt.contextHash===request.requestHash,
      'Retained request/response capture is malformed or has a different wire hash');
      const key=canonical([request.runId,request.requestHash]);require(!identities.has(key),'Two captures share one run/request identity');identities.add(key);
      const capturedRunRecord=store.get('run',request.runId),capturedRun=capturedRunRecord?.data;
      require(capturedRun?.missionId===mission.id&&Array.isArray(capturedRun.requests)
        &&capturedRun.requests.filter(item=>item.requestHash===request.requestHash).length===1,
      'Captured request is not dispatched exactly once by its durable run');
      const requestId=`inference-request:${sha256([request.runId,request.requestHash])}`;
      const retained=store.get('inference-request',requestId,1);
      require(retained?.data?.schema==='sovereign.inference-request.v1'&&retained.data.retention==='BEFORE_DISPATCH'
        &&retained.data.runId===request.runId&&retained.data.missionId===mission.id&&retained.data.requestHash===request.requestHash
        &&same(JSON.parse(retained.data.requestJson),request.request),
      'Retained pre-dispatch request is absent or differs from the captured bytes');
      const receipts=(capturedRun.inferenceReceipts??[]).filter(receipt=>receipt.contextHash===request.requestHash);
      require(receipts.length===1&&same(receipts[0],response.receipt)&&same(capturedRun.inferenceReceipt,response.receipt),
        'Durable completion receipt does not exactly match its retained response');
      require(response.receipt.simulation===(index===2?Boolean(assessmentSimulation):true),
        'Capture simulation classification is not the declared fixture classification');
    }

    const missionRuns=store.list('run').map(record=>record.data).filter(record=>record.missionId===mission.id);
    const retainedRequests=store.list('inference-request').filter(record=>record.data.missionId===mission.id);
    const receipts=missionRuns.flatMap(record=>(record.inferenceReceipts??[]).map(receipt=>({runId:record.id,requestHash:receipt.contextHash,receipt})));
    const retainedKeys=retainedRequests.map(record=>canonical([record.data.runId,record.data.requestHash])).sort();
    const receiptKeys=receipts.map(item=>canonical([item.runId,item.requestHash])).sort();
    const captureKeys=[...identities].sort();
    require(retainedRequests.length===3&&receipts.length===3&&same(retainedKeys,captureKeys)&&same(receiptKeys,captureKeys)
      &&missionRuns.every(record=>!record.expectedRequestHash),
    'Mission has an unaccounted, pending, duplicated, or unretained inference');
    require(same(captures[2].response.value,assessment.result),
      'Diagnostic response was not the exact value sealed as the conditional result');
    require(store.list('effect').filter(record=>record.data.missionId===mission.id).length===0,
      'Pure conditional diagnostic produced an operational effect');

    const reentry=JSON.parse(fs.readFileSync(join(directory,'reentry.json'),'utf8'));
    require(reentry.noReplay===true&&same(reentry.before,reentry.after),
      'Re-entry changed the durable journal or dispatched another diagnostic');
    return {schema:'sovereign.test-durable-conditional-assessment-accounting.v1',integrity:'VERIFIED',
      assessments:assessmentHeads.length,conditionalResults:resultHeads.length,retainedRequests:retainedRequests.length,
      completedReceipts:receipts.length,simulatedCompleted:receipts.filter(item=>item.receipt.simulation===true).length,
      liveCompleted:receipts.filter(item=>item.receipt.simulation===false).length,
      scope:'Test-only exact accounting from signed Store records, retained pre-dispatch requests, and receipts. It is not a public telemetry projection.'};
  }finally{handle.close();}
}

function isOnlyRedactedTelemetryFailure(result){
  const checks=result?.checks??{},fatal=result?.fatal;
  return checks.oneAssessment===false&&result?.metrics?.integrity==='NOT_ATTESTED'
    &&fatal?.code==='EXPERIMENT_INTEGRITY'&&same([...(fatal.checks??[])].sort(),['oneAssessment'])
    &&Object.entries(checks).filter(([key])=>!['selection','fidelity','oneAssessment'].includes(key)).every(([,value])=>value===true);
}

export async function runConditionalSelectionCaseDurably(options){
  const result=await runHistoricalConditionalSelectionCase(options);
  // Do not mask provider, citation, quota, freeze, or any independent control
  // failure.  This narrow bridge applies only when the old metric projection is
  // the sole failed integrity condition and the public surface remains strict.
  if(!isOnlyRedactedTelemetryFailure(result))return result;
  const reportPath=join(options.directory,'report.json');
  const report=fs.existsSync(reportPath)?JSON.parse(fs.readFileSync(reportPath,'utf8')):null;
  if(!publicBoundary(report)||!same(result.metrics,report.metrics))return result;
  let accounting;
  try{accounting=durableAssessmentAccounting({directory:options.directory,result,assessmentSimulation:options.assessmentSimulation});}
  catch{return result;}
  const checks={...result.checks,oneAssessment:accounting.integrity==='VERIFIED'};
  const reconciled={...result,checks,fatal:null,passed:Object.values(checks).every(value=>value===true),
    durableTestAssessment:accounting,
    publicProjection:{metricsIntegrity:report.metrics.integrity,telemetryProjected:false,timelineEntries:report.timeline.length,
      effectEntries:report.effects.length,reviewEntries:report.reviews.length}};
  // The result artifact lives only in the temporary test directory.  It retains
  // the actual redacted report metrics while labeling the test-private proof.
  fs.writeFileSync(join(options.directory,'result.json'),JSON.stringify(reconciled,null,2),{mode:0o600});
  return reconciled;
}
