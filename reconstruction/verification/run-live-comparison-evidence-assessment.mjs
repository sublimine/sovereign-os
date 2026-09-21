// One prospective assessment of an unchanged returned comparison, in a copy.
// Supplies pre-existing approval and bilateral exposure; no new calculation, replica, source
// write, mission run, workflow reconciliation, vote loop, or production install.
import * as fs from 'node:fs';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {DatabaseSync,backup} from 'node:sqlite';
import {sha256,canonical,check} from '../../factory/lib/contracts.mjs';
import {verifyRuntimeRelease} from '../../factory/lib/runtime-release.mjs';
import {readHistoryFingerprint} from './read-history-fingerprint.mjs';

const [directory,runtimeRoot]=process.argv.slice(2);
if(!directory||!runtimeRoot||fs.readdirSync(directory).length)throw Error('New empty output directory and frozen runtime required');
const release=verifyRuntimeRelease(runtimeRoot),self=new URL(import.meta.url),harnessHash=sha256(fs.readFileSync(self));
const helper=new URL('./read-history-fingerprint.mjs',import.meta.url),helperHash=sha256(fs.readFileSync(helper));
const sourceDirectory=new URL('./runs/planned-blind-live-wmUkhp/',import.meta.url);
const sourceSummaryBytes=fs.readFileSync(new URL('summary.json',sourceDirectory)),sourceSummary=JSON.parse(sourceSummaryBytes);
check(sourceSummary.status==='NEEDS_DIRECTION'&&sourceSummary.passed===false,'EXPERIMENT_BOUNDARY','A preserved failed source trial is required');
const source=new DatabaseSync(new URL('state.sqlite',sourceDirectory),{readOnly:true,defensive:true,allowExtension:false});
const before=readHistoryFingerprint(source),sourceUnchanged=()=>canonical(readHistoryFingerprint(source))===canonical(before)
  &&sha256(fs.readFileSync(new URL('summary.json',sourceDirectory)))===sha256(sourceSummaryBytes);
await backup(source,join(directory,'state.sqlite'));
check(sourceUnchanged(),'EXPERIMENT_BOUNDARY','Source changed during backup');
const mod=path=>import(pathToFileURL(join(release.directory,path)));
const {FactoryEngine}=await mod('factory/lib/engine.mjs'),{CodexProvider}=await mod('factory/providers/codex.mjs');
const {inferenceRequestHash}=await mod('factory/providers/instruction-profiles.mjs');
const {unpackContext}=await mod('factory/lib/context-codec.mjs'),{unpackJsonContext}=await mod('factory/lib/context-json-codec.mjs');
const {blindComparisonEvidence}=await mod('factory/lib/blind-comparison.mjs');
const write=(name,value)=>fs.writeFileSync(join(directory,name),JSON.stringify(value,null,2),{flag:'wx',mode:0o600});
const engine=new FactoryEngine({databasePath:join(directory,'state.sqlite'),workspaceRoot:join(directory,'workspaces')});
const {store}=engine,mission=store.get('mission',sourceSummary.missionId),journal=store.verifyJournal();
check(journal.events===before.head.seq&&journal.head===before.head.hash,'EXPERIMENT_BOUNDARY','Fork differs from source journal');
const candidates=store.list('artifact').filter(r=>r.data.payload.purpose==='closed-blind-comparison');
check(candidates.length===1&&candidates[0].data.status==='RETURNED','EXPERIMENT_BOUNDARY','One exact returned comparison required');
const candidate=candidates[0].data,priorReview=store.get('review',candidate.reviews.at(-1));
check(priorReview.data.result.decision==='RETURN'&&priorReview.data.result.findings.some(f=>f.severity==='material'),
  'EXPERIMENT_BOUNDARY','Preserve the diagnosed material rejection');
check(priorReview.data.result.checks.some(c=>c.criterionId==='req.closed_exposure.bilateral_recorded_nonexposure'&&c.verdict==='UNKNOWN'),
  'EXPERIMENT_BOUNDARY','The source must retain the diagnosed missing bilateral evidence');
const registrations=store.list('blind-registration');check(registrations.length===1,'EXPERIMENT_BOUNDARY','One historical replica required');
const registration=registrations[0],replicationId=registration.id;
const registered=engine.authority.open(registration.data.signed,'blind.registration');
const preservedTypes=['blind-registration','blind-seal','blind-replication','blind-opening','blind-comparison','blind-workflow'];
const preserved=()=>Object.fromEntries(preservedTypes.map(type=>[type,store.list(type).map(r=>({id:r.id,version:r.version,hash:r.hash}))]));
const controlBefore=preserved(),oldRuns=new Set(store.list('run').map(r=>r.id));
const priorThreads=store.list('run').flatMap(r=>r.data.inferenceReceipts??[]).map(r=>r.threadId);
const proof=blindComparisonEvidence(engine.registry,candidate.id);
check(proof.protocolApproval?.approval.review.id===registered.approval.review.id
  &&proof.protocolApproval.chronology.review<proof.protocolApproval.chronology.registration
  &&proof.protocolApproval.chronology.registration<proof.protocolApproval.chronology.replicaRequest,
  'EXPERIMENT_BOUNDARY','Must supply exact pre-existing approval, never a new or backdated gate');
check(proof.closedExposure?.schema==='sovereign.closed-exposure.v1'
  &&proof.closedExposure.replica.coverage==='RECORDED'&&proof.closedExposure.materialReviewer.coverage==='RECORDED'
  &&proof.closedExposure.replica.requests.length===1&&proof.closedExposure.materialReviewer.requests.length===1
  &&proof.closedExposure.replica.completedSequence<proof.closedExposure.openingSequence
  &&proof.closedExposure.materialReviewer.completedSequence<proof.closedExposure.openingSequence,
  'EXPERIMENT_BOUNDARY','Both completed historical requests must be available before dispatching a new assessment');
const frozen=()=>harnessHash===sha256(fs.readFileSync(self))&&helperHash===sha256(fs.readFileSync(helper))
  &&verifyRuntimeRelease(runtimeRoot).releaseId===release.releaseId&&sourceUnchanged();
const captures=[];
engine.workers.providerFactory=()=>{const provider=new CodexProvider();return {async generate(input){
  check(frozen()&&captures.length<1,'EXPERIMENT_BOUNDARY','Exactly one assessment maximum, no replacement vote');
  const wire=JSON.parse(input.input),exposure=wire.encoding==='sovereign.lossless-context.v2'?unpackJsonContext(wire)
    :wire.encoding==='sovereign.lossless-context.v1'?unpackContext(wire):wire;
  const candidateInput=exposure.artifacts?.find(a=>a.id===candidate.id);
  const observation=exposure.runtimeObservations?.find(o=>o.kind==='artifact-blind-comparison');
  const observed=observation?JSON.parse(observation.quoteText).detail:null;
  check(exposure.artifacts?.length===1&&candidateInput?.payload.body===candidate.payload.body
    &&candidateInput.hash===candidate.payloadHash&&canonical(candidateInput.payload.criteria)===canonical(candidate.payload.criteria)
    &&canonical(observed?.protocolApproval)===canonical(proof.protocolApproval)
    &&canonical(observed?.closedExposure)===canonical(proof.closedExposure),
    'EXPERIMENT_BOUNDARY','Exact candidate, unchanged criteria and new authenticated historical evidence required');
  const request={instructions:input.instructions,input:input.input,schema:input.schema,model:input.model,reasoningEffort:input.reasoningEffort,
    ...(input.instructionProfile?{instructionProfile:input.instructionProfile}:{})};
  const requestHash=inferenceRequestHash(request),runs=store.list('run').filter(r=>!oldRuns.has(r.id));
  check(runs.length===1&&runs[0].data.mode==='reviewer'&&runs[0].data.expectedRequestHash===requestHash,'EXPERIMENT_BOUNDARY','One exact pending reviewer required');
  const config=store.get('worker-config',runs[0].id);
  check(canonical(config.data.roleIds)===canonical(registered.workflow.reviewers.comparison)
    &&config.data.prefixHash===registered.workflow.stages.comparison.prefixHash
    &&canonical(config.data.compilationScope)===canonical(registered.workflow.stages.comparison.scope)
    &&request.model===mission.data.policy.model&&request.reasoningEffort===mission.data.policy.reasoningEffort,
    'EXPERIMENT_BOUNDARY','Keep frozen role cards/prefix/model/effort');
  const capture={at:new Date().toISOString(),runId:runs[0].id,requestHash,request};
  captures.push(capture);write('request.json',capture);return provider.generate(input);
},close:()=>provider.close()};};
engine.blind.providerFactory=()=>({generate(){throw Object.assign(Error('No new replica authorized'),{code:'EXPERIMENT_BOUNDARY'});},async close(){}});
write('qualification.json',{startedAt:new Date().toISOString(),source:sourceDirectory.pathname,sourceMissionId:mission.id,
  sourceJournal:before,sourceSummaryHash:sha256(sourceSummaryBytes),sourceRuntime:sourceSummary.release,runtime:release,harnessHash,helperHash,
  candidateId:candidate.id,candidateHash:candidate.payloadHash,priorReview:{id:priorReview.id,hash:priorReview.hash,result:priorReview.data.result},
  replicationId,controlBefore,proofHash:sha256(proof),maxProviderCalls:1,
  scope:'One new independent assessment after supplying omitted pre-existing bilateral request/exposure evidence and prior protocol approval. Original source failure and judgment are immutable. Same payload, criteria, rule, seal, roles and policy. No new replica, gate, workflow/mission continuation or installation; even ACCEPT is not integrated mission qualification.'});
try{
  check(frozen(),'EXPERIMENT_BOUNDARY','Inputs changed before assessment');
  store.append('qualification.comparison-evidence-extension',{sourceJournal:before.head,candidateId:candidate.id,
    candidateHash:candidate.payloadHash,priorReviewId:priorReview.id,proofHash:sha256(proof),maxProviderCalls:1});
  const result=await engine.workers.review({artifact:candidate,reviewerRoleIds:registered.workflow.reviewers.comparison,
    missionIntent:mission.data.intent,feedback:[{artifactId:candidate.id,artifactHash:candidate.payloadHash,reviewId:priorReview.id,result:priorReview.data.result}]});
  const final=store.get('artifact',candidate.id).data,review=store.get('review',final.reviews.at(-1));
  const runs=store.list('run').filter(r=>!oldRuns.has(r.id)),receipt=runs.length===1?runs[0].data.inferenceReceipt:null;
  const checks={newDisposition:review.id!==priorReview.id&&['ACCEPTED','RETURNED'].includes(result.status),
    exactCandidate:final.payloadHash===candidate.payloadHash&&canonical(final.payload)===canonical(candidate.payload),
    priorJudgmentPreserved:store.get('review',priorReview.id).hash===priorReview.hash&&final.reviews.includes(priorReview.id),
    exactControlHistory:canonical(preserved())===canonical(controlBefore),missionUnchanged:store.get('mission',mission.id).hash===mission.hash,
    oneReviewer:captures.length===1&&runs.length===1&&runs[0].data.mode==='reviewer',
    real:receipt?.simulation===false&&receipt?.status==='completed',exactRequest:receipt?.contextHash===captures[0]?.requestHash,
    freshThread:typeof receipt?.threadId==='string'&&!priorThreads.includes(receipt.threadId),noEffects:store.list('effect').length===0,frozen:frozen()};
  const summary={completedAt:new Date().toISOString(),checks,boundariesPassed:Object.values(checks).every(v=>v===true),
    candidateId:candidate.id,candidateHash:candidate.payloadHash,decision:review.data.result.decision,review:review.data,receipt,
    journal:store.verifyJournal(),semanticAudit:'PENDING',
    caveat:'A controlled assessment extension only, not workflow reconciliation, new integrated mission, source-trial rehabilitation, calibration or completed factory mandate.'};
  write('report.json',engine.report(mission.id));write('result.json',summary);
  process.stdout.write(JSON.stringify({directory,boundariesPassed:summary.boundariesPassed,decision:summary.decision,completedAt:summary.completedAt})+'\n');
  if(!summary.boundariesPassed)process.exitCode=2;
}catch(error){write('failure.json',{at:new Date().toISOString(),code:error.code??'UNKNOWN',capturedRequests:captures.length,journal:store.verifyJournal()});throw error;}
finally{engine.close();source.close();}
