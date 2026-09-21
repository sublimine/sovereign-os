// Whole-mission v2 qualification; reuses the original immutable question/oracle.
// It is a fresh acquisition, not a causal paired benchmark against an old run.
import * as fs from 'node:fs';
import {join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {verifyRuntimeRelease} from '../../factory/lib/runtime-release.mjs';
import {sha256} from '../../factory/lib/contracts.mjs';
import {request,urls,assessMultisourceAnswer} from './multisource-case.mjs';
const [directory,runtimeRoot]=process.argv.slice(2);
if(!directory||!runtimeRoot||fs.readdirSync(directory).length)throw Error('New empty result directory and exact runtime required');
const release=verifyRuntimeRelease(runtimeRoot),harnessHash=sha256(fs.readFileSync(new URL(import.meta.url))),oracleHash=sha256(fs.readFileSync(new URL('./multisource-case.mjs',import.meta.url)));
const {FactoryEngine}=await import(pathToFileURL(join(release.directory,'factory/lib/engine.mjs')));
const policy={model:'gpt-6-astra',reasoningEffort:'ultra',allowedTools:['source.fetch'],instructionProfile:'scoped-v1',contextEncoding:'lossless-json-v2'};
const write=(name,value)=>fs.writeFileSync(join(directory,name),JSON.stringify(value,null,2),{flag:'wx',mode:0o600});
const engine=new FactoryEngine({databasePath:join(directory,'state.sqlite'),workspaceRoot:join(directory,'workspaces'),onEvent:e=>process.stdout.write(JSON.stringify(e)+'\n')});
const mission=engine.create(request,policy);
write('qualification.json',{startedAt:new Date().toISOString(),missionId:mission.id,request,policy,release,harnessHash,oracleHash,
  scope:'New real planning, acquisitions and independent review with opt-in lossless-json-v2. Same original question/oracle; not a controlled paired comparison with earlier plans or page versions. No review-output codec.'});
const controller=new AbortController(),stop=()=>controller.abort();process.once('SIGTERM',stop);process.once('SIGINT',stop);
try{
  const outcome=await engine.run(mission.id,{signal:controller.signal}),report=engine.report(mission.id),artifact=report.final;
  const sources=engine.store.list('source').filter(r=>r.data.missionId===mission.id),relevant=sources.filter(r=>urls.includes(r.data.url));
  const review=artifact?engine.store.get('review',artifact.reviews.at(-1))?.data:null;
  const reviewer=review?engine.store.get('run',review.reviewerRunId)?.data:null,exposure=reviewer?engine.workers.context(reviewer.id):null;
  const oracle=artifact?assessMultisourceAnswer(artifact.payload.body,sources.map(s=>s.data)):{passed:false,reason:'No final artifact'};
  const claimSourceIds=artifact?[...new Set(artifact.payload.claims.flatMap(c=>c.sources.map(s=>s.sourceId)))]:[];
  const encodings=[];let after=0;
  for(;;){const page=engine.store.events({after,limit:1000});if(!page.length)break;after=page.at(-1).seq;encodings.push(...page.filter(e=>e.kind==='worker.context.encoding').map(e=>e.data));}
  const repeated=outcome.mission.status==='COMPLETED'?await engine.run(mission.id):null,later=engine.report(mission.id);
  const checks={accepted:outcome.mission.status==='COMPLETED'&&artifact?.status==='ACCEPTED',oracle:oracle.passed,
    realAcquisitions:urls.every(url=>relevant.some(r=>r.data.url===url&&r.data.httpStatus===200&&r.data.status==='ADMITTED')),
    acquiredBeforeCandidate:!!artifact&&relevant.length>=2&&relevant.every(r=>engine.registry.committedSequence('source',r.id,1)<engine.registry.committedSequence('artifact',artifact.id,1)),
    bothPagesSupportClaims:urls.every(url=>relevant.some(s=>s.data.url===url&&claimSourceIds.includes(s.id))),
    reviewerSawBothPages:!!reviewer&&urls.every(url=>exposure.sources.some(s=>s.url===url)),
    independentReview:!!reviewer&&reviewer.context.producerConversationIncluded===false&&reviewer.id!==artifact.payload.producerRunId,
    unknownRootIndependence:exposure?.sourceRelationships?.rootIndependence==='NOT_ESTABLISHED'&&sources.every(s=>s.data.rootAssessment==='UNKNOWN'),
    sharedOrigin:exposure?.sourceRelationships?.sharedHttpOrigin.some(g=>g.origin==='https://www.sqlite.org'&&g.sourceIds.length>=2)===true,
    noCodeOrFiles:report.effects.every(e=>e.tool==='source.fetch'),
    v2ActuallyExercised:encodings.some(e=>e.encoding==='sovereign.lossless-context.v2')&&!!reviewer&&encodings.some(e=>e.runId===reviewer.id&&e.encoding==='sovereign.lossless-context.v2'),
    exactRoundTrips:encodings.every(e=>e.roundTripVerified===true&&e.wireBytes<=e.logicalBytes),
    noReplay:repeated?.mission.status==='COMPLETED'&&later.metrics.dispatched===report.metrics.dispatched&&later.effects.length===report.effects.length,
    runtimeUnchanged:verifyRuntimeRelease(release.directory).releaseId===release.releaseId,
    harnessUnchanged:sha256(fs.readFileSync(new URL(import.meta.url)))===harnessHash&&sha256(fs.readFileSync(new URL('./multisource-case.mjs',import.meta.url)))===oracleHash};
  const result={completedAt:new Date().toISOString(),stateDir:resolve(directory),missionId:mission.id,releaseId:release.releaseId,status:outcome.mission.status,
    passed:Object.values(checks).every(v=>v===true),checks,oracle,metrics:report.metrics,encodings,sources:report.sources,answer:artifact?.payload.body??null,pending:outcome.mission.pending};
  write('report.json',report);write('summary.json',result);process.stdout.write(JSON.stringify(result)+'\n');if(!result.passed)process.exitCode=2;
}finally{process.removeListener('SIGTERM',stop);process.removeListener('SIGINT',stop);engine.close();}
