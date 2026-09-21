import * as fs from 'node:fs';
import {join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {verifyRuntimeRelease} from '../../factory/lib/runtime-release.mjs';
import {sha256,canonical} from '../../factory/lib/contracts.mjs';
import {request,urls,assessMultisourceAnswer} from './multisource-case.mjs';
const [directory,runtimeRoot]=process.argv.slice(2);
if(!directory||!runtimeRoot||fs.readdirSync(directory).length)throw Error('New empty qualification directory and exact immutable runtime required');
const release=verifyRuntimeRelease(runtimeRoot),harnessHash=sha256(fs.readFileSync(new URL(import.meta.url))),oracleHash=sha256(fs.readFileSync(new URL('./multisource-case.mjs',import.meta.url)));
const {FactoryEngine}=await import(pathToFileURL(join(release.directory,'factory/lib/engine.mjs')));
const write=(name,value)=>fs.writeFileSync(join(directory,name),JSON.stringify(value,null,2),{flag:'wx',mode:0o600});
const engine=new FactoryEngine({databasePath:join(directory,'state.sqlite'),workspaceRoot:join(directory,'workspaces'),onEvent:e=>process.stdout.write(JSON.stringify(e)+'\n')});
const mission=engine.create(request,{model:'gpt-6-astra',reasoningEffort:'ultra',allowedTools:['source.fetch'],instructionProfile:'scoped-v1',contextEncoding:'lossless-v1'});
write('qualification.json',{startedAt:new Date().toISOString(),missionId:mission.id,request,release,harnessHash,oracleHash,
  scope:'Live subscription planning, two actual primary page acquisitions, conditional reconciliation and independent review. The URLs are supplied; this is not a discovery test. Same publisher, no independent-root proof or local SQLite execution.'});
const controller=new AbortController(),stop=()=>controller.abort();process.once('SIGTERM',stop);process.once('SIGINT',stop);
try{
  const outcome=await engine.run(mission.id,{signal:controller.signal}),report=engine.report(mission.id);
  const sources=engine.store.list('source').filter(r=>r.data.missionId===mission.id),artifact=report.final;
  const finalSources=artifact?[...new Set(artifact.payload.claims.flatMap(c=>c.sources.map(s=>s.sourceId)))]:[];
  const relevant=sources.filter(s=>urls.includes(s.data.url));
  const review=artifact?engine.store.get('review',artifact.reviews.at(-1))?.data:null;
  const reviewer=review?engine.store.get('run',review.reviewerRunId)?.data:null;
  const exposure=reviewer?engine.workers.context(reviewer.id):null;
  const oracle=artifact?assessMultisourceAnswer(artifact.payload.body,sources.map(s=>s.data)):{passed:false,reason:'No final artifact'};
  const repeated=outcome.mission.status==='COMPLETED'?await engine.run(mission.id):null,after=engine.report(mission.id);
  const checks={accepted:outcome.mission.status==='COMPLETED'&&artifact?.status==='ACCEPTED',oracle:oracle.passed,
    twoPagesAcquired:urls.every(url=>relevant.some(s=>s.data.url===url&&s.data.httpStatus===200&&s.data.status==='ADMITTED')),
    acquiredBeforeCandidate:!!artifact&&relevant.length>=2&&relevant.every(s=>engine.registry.committedSequence('source',s.id,1)<engine.registry.committedSequence('artifact',artifact.id,1)),
    bothPagesSupportClaims:urls.every(url=>relevant.some(s=>s.data.url===url&&finalSources.includes(s.id))),
    reviewerSawBothPages:!!reviewer&&urls.every(url=>exposure.sources.some(s=>s.url===url)),
    sharedOriginVisible:exposure?.sourceRelationships?.sharedHttpOrigin.some(g=>g.origin==='https://www.sqlite.org'&&g.sourceIds.length>=2)===true,
    noInventedRootIndependence:exposure?.sourceRelationships?.rootIndependence==='NOT_ESTABLISHED'&&sources.every(s=>s.data.rootAssessment==='UNKNOWN'),
    noCodeOrFileEffects:report.effects.every(e=>e.tool==='source.fetch'),
    noReplay:repeated?.mission.status==='COMPLETED'&&after.metrics.dispatched===report.metrics.dispatched&&after.effects.length===report.effects.length,
    runtimeUnchanged:verifyRuntimeRelease(release.directory).releaseId===release.releaseId,
    harnessUnchanged:sha256(fs.readFileSync(new URL(import.meta.url)))===harnessHash&&sha256(fs.readFileSync(new URL('./multisource-case.mjs',import.meta.url)))===oracleHash};
  const result={completedAt:new Date().toISOString(),stateDir:resolve(directory),missionId:mission.id,releaseId:release.releaseId,status:outcome.mission.status,
    passed:Object.values(checks).every(v=>v===true),checks,oracle,metrics:report.metrics,answer:artifact?.payload.body??null,
    sources:report.sources,pending:outcome.mission.pending};
  write('report.json',report);write('summary.json',result);process.stdout.write(JSON.stringify(result)+'\n');
  if(!result.passed)process.exitCode=2;
}finally{process.removeListener('SIGTERM',stop);process.removeListener('SIGINT',stop);engine.close();}
