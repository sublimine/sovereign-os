// One exact closed task and one fully executed documentary task. The original
// requests and external oracle are frozen before any subscription dispatch.
import * as fs from 'node:fs';
import {join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {sha256,canonical} from '../../factory/lib/contracts.mjs';
import {verifyRuntimeRelease} from '../../factory/lib/runtime-release.mjs';
import {CATALOG_LIVE_CASES,CATALOG_SOURCE_URLS,assessCatalogAnswer} from './catalog-live-cases.mjs';
const [directory,runtimeRoot]=process.argv.slice(2);
if(!directory||!runtimeRoot||fs.readdirSync(directory).length)throw Error('New empty private result directory and frozen runtime required');
process.umask(0o077);
const release=verifyRuntimeRelease(runtimeRoot),harnessHash=sha256(fs.readFileSync(new URL(import.meta.url))),caseHash=sha256(fs.readFileSync(new URL('./catalog-live-cases.mjs',import.meta.url)));
const load=path=>import(pathToFileURL(join(release.directory,path)));
const {FactoryEngine}=await load('factory/lib/engine.mjs'),{expandCatalogReview}=await load('factory/lib/review-codec.mjs');
const policy={model:'gpt-6-astra',reasoningEffort:'ultra',maxPlanAttempts:2,maxNodeAttempts:2,instructionProfile:'scoped-v1',contextEncoding:'lossless-json-v2',reviewEncoding:'evidence-catalog-v1',entryMode:'closed-response-v1'};
const write=(path,value)=>fs.writeFileSync(join(directory,path),JSON.stringify(value,null,2),{flag:'wx',mode:0o600});
write('qualification.json',{startedAt:new Date().toISOString(),directory:resolve(directory),release,harnessHash,caseHash,policy,cases:CATALOG_LIVE_CASES,
  scope:'Two full real products, including actual public acquisitions after closed-entry fallback. A transport/integration qualification, not a causal savings benchmark, broad semantic calibration or certification of independent source roots.'});
const controller=new AbortController(),stop=()=>controller.abort();process.once('SIGTERM',stop);process.once('SIGINT',stop);
const results=[];
try{
  for(const c of CATALOG_LIVE_CASES){
    if(controller.signal.aborted)break;
    const caseDir=join(directory,c.id);fs.mkdirSync(caseDir,{mode:0o700});
    const engine=new FactoryEngine({databasePath:join(caseDir,'state.sqlite'),workspaceRoot:join(caseDir,'workspaces'),onEvent:e=>process.stdout.write(JSON.stringify({caseId:c.id,...e})+'\n')});
    const mission=engine.create(c.request,{...policy,allowedTools:c.allowedTools});
    write(c.id+'/mission.json',{missionId:mission.id,caseId:c.id,requestHash:mission.intentHash});
    const startedAt=new Date().toISOString();let failure=null;
    try{
      try{await engine.run(mission.id,{signal:controller.signal,pauseOnAbort:true});}
      catch(error){failure={code:error.code??'INTERNAL'};}
      const report=engine.report(mission.id),artifact=report.final,entry=engine.store.get('closed-entry',mission.id)?.data;
      const sources=engine.store.list('source').filter(r=>r.data.missionId===mission.id).map(r=>r.data);
      const review=artifact?engine.store.get('review',artifact.reviews.at(-1))?.data:null;
      const reviewer=review?engine.store.get('run',review.reviewerRunId)?.data:null;
      const exposure=reviewer?engine.workers.context(reviewer.id):null;
      const encodings=engine.store.list('worker-review-encoding').map(r=>r.data);
      const audit=encodings.map(e=>{
        const expanded=expandCatalogReview(e.rawResponse,e.observedCatalog),runHead=engine.store.get('run',e.runId);let matchingVersion=null;
        for(let v=1;v<=runHead.version;v++){
          const r=engine.store.get('run',e.runId,v);
          if(r.data.completedExposureHash===e.completedExposureHash&&sha256(r.data.inferenceReceipt??null)===e.inferenceReceiptHash){matchingVersion=v;break;}
        }
        return {runId:e.runId,artifactId:e.artifactId,matchingVersion,exactExpansion:e.expandedResponseHash===sha256(expanded),catalogHash:e.catalogHash===sha256(e.observedCatalog),rawHash:e.rawResponseHash===sha256(e.rawResponse),
          sourceKeysOnly:e.rawResponse.evidence.every(x=>canonical(Object.keys(x).sort())===canonical(['evidenceId','quote','sourceKey'])),
          sourceEvidence:expanded.checks.flatMap(k=>k.evidence).filter(x=>x.kind==='source').map(x=>({id:x.id,hash:x.hash,quote:x.quote})),
          acceptedReviewBinding:report.reviews.some(r=>r.reviewerRunId===e.runId&&r.artifactId===e.artifactId&&r.result.decision===expanded.decision&&expanded.checks.every(k=>r.result.checks.some(actual=>canonical(actual)===canonical(k))))};
      });
      const oracle=assessCatalogAnswer(c.id,artifact?.payload.body??'',sources);
      const factual=c.id==='documentary-catalog';
      const acceptedAudit=review?audit.find(a=>a.runId===review.reviewerRunId&&a.artifactId===artifact.id&&a.acceptedReviewBinding):null;
      const checks={noFailure:failure===null,completed:report.mission.status==='COMPLETED'&&artifact?.status==='ACCEPTED',externalOracle:oracle.passed,
        actualSubscription:report.metrics.completed>0&&report.metrics.completed===report.metrics.liveCompleted&&report.metrics.simulatedCompleted===0,
        independentReviewer:!!reviewer&&reviewer.id!==artifact.payload.producerRunId&&reviewer.context.producerConversationIncluded===false,
        correctRoute:factual?entry?.status==='FALLBACK'&&!!report.plan:entry?.status==='ACCEPTED'&&!report.plan,
        codecExercised:audit.length>0&&encodings.every(e=>e.encoding==='evidence-catalog-v1'),
        exactObservedBindings:audit.length>0&&audit.every(a=>a.matchingVersion&&a.exactExpansion&&a.catalogHash&&a.rawHash&&a.sourceKeysOnly),
        acceptedCodecBinding:!!acceptedAudit,
        actualAcquisitions:factual?CATALOG_SOURCE_URLS.every(url=>sources.some(s=>s.url===url&&s.httpStatus===200&&s.status==='ADMITTED')):sources.length===0,
        sourceOrder:factual?!!artifact&&sources.length>=2&&sources.every(s=>engine.registry.committedSequence('source',s.id,1)<engine.registry.committedSequence('artifact',artifact.id,1)):true,
        citedActualSourceKeys:factual?CATALOG_SOURCE_URLS.every(url=>sources.some(s=>s.url===url&&acceptedAudit?.sourceEvidence.some(e=>e.id===s.id&&e.hash===s.hash&&s.raw.includes(e.quote)))):true,
        reviewerSawSources:factual?CATALOG_SOURCE_URLS.every(url=>exposure?.sources.some(s=>s.url===url)):true,
        distinctOriginsNotIndependentRoots:factual?new Set(sources.map(s=>new URL(s.url).origin)).size===2&&exposure?.sourceRelationships.rootIndependence==='NOT_ESTABLISHED'&&sources.every(s=>s.rootAssessment==='UNKNOWN'):true,
        noUnrequestedEffects:report.effects.every(e=>c.allowedTools.includes(e.tool))};
      const beforeReplay={calls:report.metrics.dispatched,effects:report.effects.length};
      if(report.mission.status==='COMPLETED'){
        await engine.run(mission.id);const again=engine.report(mission.id);
        checks.noReplay=again.mission.status==='COMPLETED'&&again.metrics.dispatched===beforeReplay.calls&&again.effects.length===beforeReplay.effects;
      }else checks.noReplay=false;
      const result={caseId:c.id,missionId:mission.id,startedAt,completedAt:new Date().toISOString(),failure,status:report.mission.status,passed:Object.values(checks).every(v=>v===true),checks,oracle,audit,metrics:report.metrics,semanticAudit:'PENDING'};
      results.push(result);write(c.id+'/report.json',report);write(c.id+'/summary.json',result);
      process.stdout.write(JSON.stringify({event:'catalog.case.completed',...result})+'\n');
      if(failure||['WAITING_QUOTA','WAITING_PROVIDER','WAITING_CAPABILITY','CANCELLED'].includes(report.mission.status))controller.abort();
    }finally{engine.close();}
  }
  const checks={bothCases:results.length===2,allPassed:results.every(r=>r.passed),runtimeUnchanged:verifyRuntimeRelease(release.directory).releaseId===release.releaseId,harnessUnchanged:sha256(fs.readFileSync(new URL(import.meta.url)))===harnessHash,casesUnchanged:sha256(fs.readFileSync(new URL('./catalog-live-cases.mjs',import.meta.url)))===caseHash};
  const summary={completedAt:new Date().toISOString(),releaseId:release.releaseId,passed:Object.values(checks).every(Boolean),checks,results,semanticAudit:'PENDING'};
  write('summary.json',summary);process.stdout.write(JSON.stringify({event:'catalog.finished',...summary})+'\n');if(!summary.passed)process.exitCode=2;
}finally{process.removeListener('SIGTERM',stop);process.removeListener('SIGINT',stop);}
