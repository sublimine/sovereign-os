// Read-only post-run structural audit. Keeps the original false gate counter
// visible, and qualifies its exact replacement without invoking any model.
import * as fs from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {join} from 'node:path';
import {Store} from '../../factory/lib/store.mjs';
import {ArtifactRegistry} from '../../factory/lib/artifacts.mjs';
import {missionReport} from '../../factory/lib/report.mjs';
import {dependencyGates} from '../../factory/lib/dependency-gates.mjs';
import {exactHistoricalGates} from './recovery-gates.mjs';
import {inferenceRequestHash} from '../../factory/providers/instruction-profiles.mjs';
import {canonical,sha256,check} from '../../factory/lib/contracts.mjs';

const [output]=process.argv.slice(2),directory='/home/cardeex/codex-workspace/sovereign-feedback-recovery-b6jLY0q2';
check(output&&!fs.existsSync(output),'AUDIT_OUTPUT','New audit output required');
const qualificationPath=join(directory,'qualification.json'),summaryPath=join(directory,'summary.json');
const qualification=JSON.parse(fs.readFileSync(qualificationPath)),summary=JSON.parse(fs.readFileSync(summaryPath));
const db=new DatabaseSync(join(qualification.source,'state.sqlite'),{readOnly:true,allowExtension:false,defensive:true});db.exec('BEGIN');
const store={db,get:Store.prototype.get,list:Store.prototype.list,events:Store.prototype.events},registry=new ArtifactRegistry(store,null);
try{
  const journal=Store.prototype.verifyJournal.call(store),report=missionReport(store,summary.missionId);
  check(report.mission.status==='COMPLETED'&&report.final?.status==='ACCEPTED','AUDIT_PENDING','Actual final independent acceptance is still required');
  const expected=qualification.before.protectedRecords.filter(r=>r.type==='artifact').map(r=>{
    const a=store.get(r.type,r.id,r.version);check(a?.hash===r.hash,'AUDIT_INTEGRITY','Original accepted input record differs');
    return {artifactId:a.id,hash:a.data.payloadHash,purpose:a.data.payload.purpose};
  });
  check(expected.length===3&&expected.filter(r=>r.purpose==='plan').length===1,'AUDIT_INTEGRITY','Two material inputs and the accepted plan must be fixed independently');
  const gates=dependencyGates(registry,report.final.id);
  const captures=fs.readdirSync(directory).filter(n=>/^request-\d+\.json$/.test(n)).map(n=>JSON.parse(fs.readFileSync(join(directory,n))));
  const retained=store.list('inference-request');
  const checks={actualAcceptedFinal:report.mission.status===summary.status&&summary.status==='COMPLETED',
    originalHarnessNonGateControls:Object.entries(summary.checks).filter(([k])=>k!=='gates').every(([,v])=>v===true),
    diagnosedHarnessFalseRetained:summary.passed===false&&summary.checks.gates===false&&gates.dependencies.length===3,
    exactHistoricalGates:exactHistoricalGates(gates,expected),
    candidateInputsExact:canonical(report.final.payload.inputRefs.map(r=>canonical(r)).sort())===canonical(expected.map(r=>canonical(r)).sort()),
    originalFilesRetained:Object.entries(qualification.before.originalFiles).every(([path,hash])=>sha256(fs.readFileSync(path))===hash),
    originalRecordsRetained:qualification.before.protectedRecords.every(r=>{const now=store.get(r.type,r.id);return now.version===r.version&&now.hash===r.hash;}),
    policyAndIntentRetained:report.mission.intentHash===qualification.before.mission.intentHash&&canonical(report.mission.policy)===canonical(qualification.before.mission.policy),
    exactNewRequestRetention:captures.length===summary.additionalCalls&&captures.every(q=>inferenceRequestHash(q.request)===q.requestHash
      &&store.get('run',q.runId)?.data.requests.some(r=>r.requestHash===q.requestHash)
      &&retained.some(r=>r.data.runId===q.runId&&r.data.requestHash===q.requestHash&&r.data.retention==='BEFORE_DISPATCH'&&inferenceRequestHash(JSON.parse(r.data.requestJson))===q.requestHash)),
    noPostSummaryInference:report.metrics.dispatched===summary.metrics.dispatched&&report.metrics.completed===summary.metrics.completed,
    noEffects:report.effects.length===0};
  const result={capturedAt:new Date().toISOString(),missionId:summary.missionId,passed:Object.values(checks).every(x=>x===true),checks,
    scope:'Read-only structural audit of completed recovery; replaces only the diagnosed harness gate-count error with exact material-plus-plan identity and chronology checks. Does not rewrite either original result, run inference or certify the whole factory. Semantic review reading is recorded separately.',
    originalHarness:{summaryPath,summaryHash:sha256(fs.readFileSync(summaryPath)),passed:summary.passed,checks:summary.checks},
    qualification:{path:qualificationPath,hash:sha256(fs.readFileSync(qualificationPath)),releaseId:qualification.release.releaseId},
    auditSourceHash:sha256(fs.readFileSync(new URL(import.meta.url))),oracleHash:sha256(fs.readFileSync(new URL('./recovery-gates.mjs',import.meta.url))),
    journal,final:{id:report.final.id,hash:report.final.payloadHash,reviewId:report.final.reviews.at(-1)},expectedInputs:expected,gates,
    metrics:report.metrics,additionalCalls:summary.additionalCalls,semanticAudit:'PENDING'};
  fs.writeFileSync(output,JSON.stringify(result,null,2),{flag:'wx',mode:0o600});process.stdout.write(JSON.stringify({output,passed:result.passed,checks,final:result.final})+'\n');
  if(!result.passed)process.exitCode=2;
}finally{if(db.isTransaction)db.exec('ROLLBACK');db.close();}
