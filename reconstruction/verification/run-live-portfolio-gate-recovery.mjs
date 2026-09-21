// Preserve the failed mission and all three source files. Re-review the exact
// candidate only for newly available historical acceptance evidence; no producer
// regeneration, lowered criterion, old journal edit or external oracle change.
import * as fs from 'node:fs';
import {DatabaseSync,backup} from 'node:sqlite';
import {join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {canonical,sha256} from '../../factory/lib/contracts.mjs';
import {verifyRuntimeRelease} from '../../factory/lib/runtime-release.mjs';
import {request,portfolioCases,portfolioOracle,BRIDGE} from './portfolio-case.mjs';
const [directory,runtimeRoot,sourceDirectory]=process.argv.slice(2);
if(!directory||!runtimeRoot||!sourceDirectory||fs.readdirSync(directory).length)throw Error('New empty directory, runtime and exact completed source qualification required');
process.umask(0o077);
const release=verifyRuntimeRelease(runtimeRoot),harnessHash=sha256(fs.readFileSync(new URL(import.meta.url))),oracleHash=sha256(fs.readFileSync(new URL('./portfolio-case.mjs',import.meta.url)));
const load=path=>import(pathToFileURL(join(release.directory,path)));
const {FactoryEngine}=await load('factory/lib/engine.mjs'),{IsolatedExecutionRunner}=await load('factory/tools/execution.mjs');
const original=JSON.parse(fs.readFileSync(join(sourceDirectory,'summary.json'))),sourceQualification=JSON.parse(fs.readFileSync(join(sourceDirectory,'qualification.json')));
if(original.status!=='WAITING_CAPABILITY'||original.externalOracle.total!==226||original.externalOracle.failures.length||!original.checks.candidateBytesUnchanged)throw Error('Unexpected source qualification');
const sourcePath=join(sourceDirectory,'state.sqlite'),source=new DatabaseSync(sourcePath,{readOnly:true});
const head=()=>({...source.prepare('SELECT seq,hash FROM events ORDER BY seq DESC LIMIT 1').get()}),originalHead=head();
await backup(source,join(directory,'state.sqlite'));
const write=(name,value)=>fs.writeFileSync(join(directory,name),JSON.stringify(value,null,2),{flag:'wx',mode:0o600});
const engine=new FactoryEngine({databasePath:join(directory,'state.sqlite'),workspaceRoot:join(directory,'workspaces'),executionRunner:new IsolatedExecutionRunner(),onEvent:e=>process.stdout.write(JSON.stringify(e)+'\n')});
const controller=new AbortController(),stop=()=>controller.abort();process.once('SIGTERM',stop);process.once('SIGINT',stop);
try{
  const mission=engine.store.get('mission',original.missionId)?.data;
  if(!mission||mission.intent!==request||mission.status!=='WAITING_CAPABILITY')throw Error('Exact intent and checkpoint required');
  if(!Object.entries(sourceQualification.policy).every(([k,v])=>canonical(mission.policy[k])===canonical(v)))throw Error('Frozen policy differs');
  const candidate=engine.store.get('artifact','artifact:df8cd261-344e-495f-88df-66ccc36e50df')?.data;
  const priorReview=candidate?engine.store.get('review',candidate.reviews.at(-1))?.data:null;
  const gateCriterion='req.prerequisite_gates.accepted_before_implementation';
  if(candidate?.status!=='RETURNED'||candidate.payloadHash!=='cbdfb722d6f79d303db5eaf795ac99613427a136f629eb766fff64f2a1a1bc42'
    ||!['RETURN','UNKNOWN'].includes(priorReview?.result.decision))throw Error('Exact returned integration candidate required');
  const unmet=priorReview.result.checks.filter(c=>c.verdict!=='PASS');
  if(unmet.length!==1||unmet[0].criterionId!==gateCriterion||unmet[0].verdict!=='UNKNOWN')throw Error('Not a review-only historical-gate uncertainty');
  const effects=()=>engine.store.list('effect').filter(r=>r.data.missionId===mission.id);
  if(effects().some(r=>!['SUCCEEDED','FAILED'].includes(r.data.state)))throw Error('Uncertain effects may not relocate or replay');
  const producers=()=>engine.store.list('run').filter(r=>r.data.missionId===mission.id&&r.data.mode==='producer').map(r=>r.id).sort();
  const originalProducers=producers(),originalWrites=effects().filter(r=>r.data.tool==='workspace.write').map(r=>r.id).sort();
  const binding=engine.store.get('tool-workspace',mission.id),oldWorkspace=binding.data.path,wanted=['README.md','portfolio.mjs','portfolio.test.mjs'];
  const snapshot=path=>{
    if(canonical(fs.readdirSync(path).sort())!==canonical(wanted))throw Error('Exact three-file workspace required');
    return wanted.map(name=>{const full=join(path,name),stat=fs.lstatSync(full);
      if(!stat.isFile()||stat.isSymbolicLink()||stat.nlink!==1||stat.size>1024*1024)throw Error('Unsafe candidate file');
      const content=new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(fs.readFileSync(full));return {path:name,content,sha256:sha256(content)};});
  };
  const originalFiles=snapshot(oldWorkspace),hashes=files=>files.map(({path,sha256})=>({path,sha256}));
  if(canonical(hashes(originalFiles))!==canonical(original.candidateFiles))throw Error('Source files no longer match the tested candidate');
  const workspace=join(directory,'workspaces','mission-'+sha256(mission.id));fs.mkdirSync(workspace,{mode:0o700});
  for(const file of originalFiles)fs.writeFileSync(join(workspace,file.path),file.content,{flag:'wx',mode:0o600});
  engine.store.put('tool-workspace',mission.id,{...binding.data,path:workspace},{expectedVersion:binding.version});
  engine.store.append('qualification.private-copy.relocated',{missionId:mission.id,originalHead,sourceDirectory:resolve(sourceDirectory),oldPath:oldWorkspace,newPath:workspace,
    sourceBindingHash:binding.hash,files:hashes(originalFiles),reason:'Exact private copy of already committed files; original database and files remain untouched. Old receipts are history, not new writes or independent reads.'});
  const recovery={sourceDirectory:resolve(sourceDirectory),originalHead,sourceReleaseId:sourceQualification.release.releaseId,
    candidateId:candidate.id,candidateHash:candidate.payloadHash,priorReviewId:priorReview.id,criterionId:gateCriterion,originalFiles:hashes(originalFiles)};
  write('qualification.json',{startedAt:new Date().toISOString(),missionId:mission.id,release,harnessHash,oracleHash,request,policy:mission.policy,recovery});
  const spec=engine.store.get('plan',mission.id).data.plan.nodes.find(n=>n.id===candidate.payload.nodeId);
  const ownerId='qualification:dependency-gate-recovery';engine.ledger.acquireEngine({ownerId});let reviewed;
  try{reviewed=await engine.workers.review({artifact:candidate,reviewerRoleIds:spec.reviewerRoleIds,missionIntent:mission.intent,signal:controller.signal,
    feedback:[{priorReviewId:priorReview.id,checks:unmet,scope:'New authenticated artifact-dependency-gates supplies the exact historical prerequisite decisions, substantive checks and journal ordering previously absent. Reassess every unchanged criterion of the same candidate. No acceptance is pre-authorized, no late gate may be backdated, and no code or criteria may be altered.'}]});}
  finally{engine.ledger.releaseEngine(ownerId);}
  const recoveryReview=engine.store.get('review',reviewed.reviews.at(-1))?.data;
  write('recovery-review.json',{candidateId:candidate.id,candidateHash:candidate.payloadHash,status:reviewed.status,review:recoveryReview});
  const outcome=reviewed.status==='ACCEPTED'?await engine.run(mission.id,{signal:controller.signal}):engine.status(mission.id),report=engine.report(mission.id),final=report.final;
  const accepted=engine.store.list('artifact').map(r=>r.data).filter(a=>a.missionId===mission.id&&a.status==='ACCEPTED'),models=accepted.filter(a=>a.payload.kind==='decision-model'),risks=accepted.filter(a=>a.payload.kind==='counterexamples');
  const design=models[0]?JSON.parse(models[0].payload.body):null,risk=risks[0]?JSON.parse(risks[0].payload.body):null;
  const riskIds=['greedy-trap','transitive-dependency','asymmetric-exclusion','robust-not-sum','prefix-tie','infeasible-required'].sort();
  const riskChecks=(risk?.cases??[]).map(c=>({id:c.id,pass:c.input.projects.length<=8&&typeof c.why==='string'&&c.why.length>0&&canonical(portfolioOracle(c.input))===canonical(c.expected)}));
  const finalRun=final?engine.store.get('run',final.payload.producerRunId)?.data:null,prerequisites=[...models,...risks];
  const depChecks=prerequisites.map(a=>({id:a.id,exactConsumption:!!final&&final.payload.inputRefs.some(r=>r.artifactId===a.id&&r.hash===a.payloadHash&&r.purpose===a.payload.purpose),
    exposed:!!finalRun&&finalRun.context.artifactIds.includes(a.id),acceptedBeforeProducer:!!finalRun&&engine.registry.committedSequence('artifact',a.id,engine.store.get('artifact',a.id).version)<engine.registry.committedSequence('run',finalRun.id,1)}));
  const files=snapshot(workspace),candidateFiles=hashes(files),cases=portfolioCases();
  for(const [path,content]of [['.qualification-bridge.mjs',BRIDGE],['.qualification-input.json',JSON.stringify(cases.map(({id,input})=>({id,input})))]] )files.push({path,content,sha256:sha256(content)});
  const manifest=files.map(f=>({type:'file',path:f.path,bytes:Buffer.byteLength(f.content),sha256:f.sha256}));
  const execution=await new IsolatedExecutionRunner({maxOutputBytes:1024*1024}).run({args:{argv:['node','.qualification-bridge.mjs'],cwd:'.'},snapshot:{files,manifest,hash:sha256(manifest)}});
  write('external-execution.json',execution);let answers;try{answers=JSON.parse(execution.stdout);}catch{}
  const externalChecks=cases.map(c=>{const rows=Array.isArray(answers)?answers.filter(a=>a.id===c.id):[];return {id:c.id,pass:rows.length===1&&canonical(rows[0])===canonical({id:c.id,...c.expected}),expected:c.expected,actual:rows.length===1?rows[0]:null};});write('external-checks.json',externalChecks);
  const reviews=accepted.map(a=>{const review=engine.store.get('review',a.reviews.at(-1))?.data,run=review?engine.store.get('run',review.reviewerRunId)?.data:null;return {artifactId:a.id,independent:!!run&&run.id!==a.payload.producerRunId&&run.context.producerConversationIncluded===false};});
  if(outcome.mission.status==='COMPLETED')await engine.run(mission.id);
  const later=engine.report(mission.id),riskRun=risks[0]?engine.store.get('run',risks[0].payload.producerRunId)?.data:null;
  const checks={originalSourceUnchanged:canonical(head())===canonical(originalHead)&&canonical(hashes(snapshot(oldWorkspace)))===canonical(hashes(originalFiles)),
    sameCandidateRecovered:reviewed.status==='ACCEPTED'&&reviewed.id===candidate.id&&reviewed.payloadHash===candidate.payloadHash,
    historicalGateEvidenceCited:!!recoveryReview&&recoveryReview.result.checks.some(c=>c.criterionId===gateCriterion&&c.verdict==='PASS'&&c.evidence.some(e=>e.kind==='runtime'&&engine.store.get('runtime-observation',e.id)?.data.signed.data.kind==='artifact-dependency-gates')),
    accepted:outcome.mission.status==='COMPLETED'&&final?.status==='ACCEPTED',distinctProducts:models.length===1&&risks.length===1&&prerequisites.every(a=>a.id!==final?.id)&&new Set(prerequisites.map(a=>a.payload.producerRunId)).size===2,
    objectiveOrder:canonical(design?.objectiveOrder??null)===canonical(['max-worst-benefit','max-total-benefit','min-cost','lexicographic-ids']),
    alternativesPresent:typeof design?.chosenAlgorithm==='string'&&design.chosenAlgorithm.length>0&&design.algorithms?.length>=3&&design.algorithms.every(a=>['name','rationale','limitation'].every(k=>typeof a[k]==='string'&&a[k].length>0)),
    sixCorrectRiskExamples:riskChecks.length===6&&canonical(riskChecks.map(c=>c.id).sort())===canonical(riskIds)&&riskChecks.every(c=>c.pass),
    riskProducerIndependentOfDesign:!!riskRun&&models.length===1&&!riskRun.context.artifactIds.includes(models[0].id),
    prerequisiteConsumption:depChecks.length===2&&depChecks.every(d=>d.exactConsumption&&d.exposed&&d.acceptedBeforeProducer),
    independentReviews:reviews.length>=4&&reviews.every(r=>r.independent),exactFiles:canonical(candidateFiles)===canonical(hashes(originalFiles)),
    noRegeneratedProduction:canonical(producers())===canonical(originalProducers),noRepeatedWrites:canonical(effects().filter(r=>r.data.tool==='workspace.write').map(r=>r.id).sort())===canonical(originalWrites),
    externalOracle:execution.exitCode===0&&Array.isArray(answers)&&answers.length===cases.length&&externalChecks.length===226&&externalChecks.every(c=>c.pass),
    candidateBytesUnchanged:canonical(hashes(snapshot(workspace)))===canonical(candidateFiles),realInference:report.metrics.completed>0&&report.metrics.liveCompleted===report.metrics.completed&&report.metrics.simulatedCompleted===0,
    noExternalResearch:report.effects.every(e=>!e.tool.startsWith('source.')),noReplay:outcome.mission.status==='COMPLETED'&&later.metrics.dispatched===report.metrics.dispatched&&later.effects.length===report.effects.length,
    runtimeUnchanged:verifyRuntimeRelease(release.directory).releaseId===release.releaseId,harnessUnchanged:sha256(fs.readFileSync(new URL(import.meta.url)))===harnessHash&&sha256(fs.readFileSync(new URL('./portfolio-case.mjs',import.meta.url)))===oracleHash};
  const summary={completedAt:new Date().toISOString(),stateDir:resolve(directory),missionId:mission.id,releaseId:release.releaseId,status:outcome.mission.status,passed:Object.values(checks).every(v=>v===true),checks,recovery,depChecks,reviews,riskChecks,candidateFiles,
    externalOracle:{total:externalChecks.length,failures:externalChecks.filter(c=>!c.pass)},metrics:report.metrics,pending:outcome.mission.pending,
    caveat:'Recovery across frozen runtime versions, not a fresh complete mission under the latest runtime. Historical calls remain in aggregate usage. Automated oracle checks supplement, not replace, semantic reading and independent review.'};
  write('report.json',report);write('summary.json',summary);process.stdout.write(JSON.stringify(summary)+'\n');if(!summary.passed)process.exitCode=2;
}finally{process.removeListener('SIGTERM',stop);process.removeListener('SIGINT',stop);engine.close();source.close();}
