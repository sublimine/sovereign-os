// New mission, never a repair of unavailable historical HTTP traces. The same
// original request is retained; the external oracle's unsupported quote cap is
// separately versioned, and its original result remains visible.
import * as fs from 'node:fs';
import {join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {sha256,canonical} from '../../factory/lib/contracts.mjs';
import {verifyRuntimeRelease} from '../../factory/lib/runtime-release.mjs';
import {CATALOG_SOURCE_URLS} from './catalog-live-cases.mjs';
import {TRACE_CASE,ORACLE_V2_SCOPE,assessTraceAnswer} from './catalog-trace-case.mjs';
const [directory,runtimeRoot]=process.argv.slice(2);
if(!directory||!runtimeRoot||fs.readdirSync(directory).length)throw Error('New empty private result directory and frozen runtime required');
process.umask(0o077);
const release=verifyRuntimeRelease(runtimeRoot),inputFiles=['run-live-catalog-trace.mjs','catalog-trace-case.mjs','catalog-live-cases.mjs'];
const inputHashes=Object.fromEntries(inputFiles.map(f=>[f,sha256(fs.readFileSync(new URL('./'+f,import.meta.url)))]));
const load=path=>import(pathToFileURL(join(release.directory,path)));
const {FactoryEngine}=await load('factory/lib/engine.mjs'),{expandCatalogReview}=await load('factory/lib/review-codec.mjs');
const options={preset:'adaptive-v1',model:'gpt-6-astra',reasoningEffort:'ultra',maxPlanAttempts:2,maxNodeAttempts:2,allowedTools:TRACE_CASE.allowedTools};
const write=(path,value)=>fs.writeFileSync(join(directory,path),JSON.stringify(value,null,2),{flag:'wx',mode:0o600});
const engine=new FactoryEngine({databasePath:join(directory,'state.sqlite'),workspaceRoot:join(directory,'workspaces'),onEvent:e=>process.stdout.write(JSON.stringify(e)+'\n')});
const mission=engine.create(TRACE_CASE.request,options);
write('qualification.json',{startedAt:new Date().toISOString(),directory:resolve(directory),release,inputHashes,options,policy:mission.policy,selection:mission.policySelection,request:mission.intent,missionId:mission.id,
  scope:'One new whole documentary mission using the versioned preset, actual HTTP acquisition traces and catalog review. Not recovery of IcWvS5Z8, global calibration or an efficiency comparison.',oracleChange:ORACLE_V2_SCOPE});
const controller=new AbortController(),stop=()=>controller.abort();process.once('SIGTERM',stop);process.once('SIGINT',stop);let failure=null;
try{
  try{await engine.run(mission.id,{signal:controller.signal,pauseOnAbort:true});}catch(error){failure={code:error.code??'INTERNAL'};}
  const report=engine.report(mission.id),artifact=report.final;
  const sources=engine.store.list('source').filter(r=>r.data.missionId===mission.id).map(r=>r.data);
  const review=artifact?engine.store.get('review',artifact.reviews.at(-1))?.data:null;
  const reviewer=review?engine.store.get('run',review.reviewerRunId)?.data:null,exposure=reviewer?engine.workers.context(reviewer.id):null;
  const encoded=review?engine.store.list('worker-review-encoding').map(r=>r.data).filter(e=>e.runId===review.reviewerRunId&&e.artifactId===artifact.id):[];
  const audited=encoded.map(e=>{
    const expanded=expandCatalogReview(e.rawResponse,e.observedCatalog);
    return {exact:e.catalogHash===sha256(e.observedCatalog)&&e.rawResponseHash===sha256(e.rawResponse)&&e.expandedResponseHash===sha256(expanded),
      acceptedBinding:expanded.decision==='ACCEPT'&&expanded.checks.every(k=>review.result.checks.some(a=>canonical(a)===canonical(k))),
      sources:expanded.checks.flatMap(c=>c.evidence).filter(e=>e.kind==='source'),tools:expanded.checks.flatMap(c=>c.evidence).filter(e=>e.kind==='tool')};
  });
  const receipts=engine.store.list('effect').filter(e=>e.data.missionId===mission.id&&e.data.tool==='source.fetch').map(e=>e.data.receipt?engine.authority.open(e.data.receipt,'tool.receipt'):null);
  const traceChecks=receipts.map(r=>{
    const trace=r?.result?.httpTrace,hops=trace?.hops??[];
    return {operationId:r?.id??null,successful:r?.status==='SUCCEEDED',complete:trace?.complete===true,
      boundedToRequested:!!hops.length&&hops.every(h=>CATALOG_SOURCE_URLS.includes(h.url)),
      observedAll:hops.length>0&&hops.every(h=>h.response&&Number.isInteger(h.response.status)&&/^[a-f0-9]{64}$/.test(h.response.sha256)),
      terminalBound:hops.at(-1)?.url===r?.result.finalUrl&&hops.at(-1)?.response?.sha256===r?.result.sha256,
      hops};
  });
  const oracle=assessTraceAnswer(artifact?.payload.body??'',sources);
  const checks={noFailure:failure===null,completed:report.mission.status==='COMPLETED'&&artifact?.status==='ACCEPTED',externalOracle:oracle.passed,
    actualSubscription:report.metrics.completed>0&&report.metrics.completed===report.metrics.liveCompleted&&report.metrics.simulatedCompleted===0,
    presetBound:report.mission.policySelection?.effectivePolicyHash===sha256(report.mission.policy)&&report.mission.policySelection?.presetId==='adaptive-v1',
    fullRoute:report.entry?.status==='FALLBACK'&&!!report.plan,
    actualSources:CATALOG_SOURCE_URLS.every(url=>sources.some(s=>s.url===url&&s.httpStatus===200&&s.status==='ADMITTED')),
    traceComplete:traceChecks.length===2&&traceChecks.every(t=>t.successful&&t.complete&&t.boundedToRequested&&t.observedAll&&t.terminalBound),
    acquiredBeforeCandidate:!!artifact&&sources.every(s=>engine.registry.committedSequence('source',s.id,1)<engine.registry.committedSequence('artifact',artifact.id,1)),
    independentReview:!!reviewer&&reviewer.id!==artifact.payload.producerRunId&&reviewer.context.producerConversationIncluded===false,
    acceptedCatalog:audited.some(a=>a.exact&&a.acceptedBinding),
    sourceKeysActuallyCited:CATALOG_SOURCE_URLS.every(url=>sources.some(s=>s.url===url&&audited.some(a=>a.acceptedBinding&&a.sources.some(e=>e.id===s.id&&e.hash===s.hash&&s.raw.includes(e.quote))))),
    reviewerSawTraces:receipts.length===2&&receipts.every(r=>exposure?.toolObservations.some(o=>o.id===r.id&&o.result?.httpTrace?.complete===true)),
    noFalseRootPromotion:exposure?.sourceRelationships?.rootIndependence==='NOT_ESTABLISHED'&&sources.every(s=>s.rootAssessment==='UNKNOWN'),
    noOtherEffects:report.effects.every(e=>e.tool==='source.fetch')};
  if(report.mission.status==='COMPLETED'){
    await engine.run(mission.id);const again=engine.report(mission.id);
    checks.noReplay=again.mission.status==='COMPLETED'&&again.metrics.dispatched===report.metrics.dispatched&&again.effects.length===report.effects.length;
  }else checks.noReplay=false;
  checks.runtimeUnchanged=verifyRuntimeRelease(release.directory).releaseId===release.releaseId;
  checks.inputsUnchanged=inputFiles.every(f=>inputHashes[f]===sha256(fs.readFileSync(new URL('./'+f,import.meta.url))));
  const summary={completedAt:new Date().toISOString(),missionId:mission.id,releaseId:release.releaseId,status:report.mission.status,failure,passed:Object.values(checks).every(v=>v===true),checks,oracle,traceChecks,metrics:report.metrics,semanticAudit:'PENDING'};
  write('report.json',report);write('summary.json',summary);process.stdout.write(JSON.stringify(summary)+'\n');if(!summary.passed)process.exitCode=2;
}finally{process.removeListener('SIGTERM',stop);process.removeListener('SIGINT',stop);engine.close();}
