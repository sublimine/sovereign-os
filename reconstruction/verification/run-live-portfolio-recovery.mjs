// Recovery qualification on a private SQLite backup. Original failed evidence is
// untouched; no replanning, regenerated prerequisites or lowered criteria. New
// authenticated admission evidence is independently judged for the exact candidate.
import * as fs from 'node:fs';
import {DatabaseSync,backup} from 'node:sqlite';
import {join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {verifyRuntimeRelease} from '../../factory/lib/runtime-release.mjs';
import {canonical,sha256} from '../../factory/lib/contracts.mjs';
import {request,portfolioCases,portfolioOracle,BRIDGE} from './portfolio-case.mjs';
const [directory,runtimeRoot,sourceDirectory]=process.argv.slice(2);
if(!directory||!runtimeRoot||!sourceDirectory||fs.readdirSync(directory).length)throw Error('New empty result directory and exact runtime required');
const release=verifyRuntimeRelease(runtimeRoot),harnessHash=sha256(fs.readFileSync(new URL(import.meta.url))),oracleHash=sha256(fs.readFileSync(new URL('./portfolio-case.mjs',import.meta.url)));
const {FactoryEngine}=await import(pathToFileURL(join(release.directory,'factory/lib/engine.mjs')));
const {IsolatedExecutionRunner}=await import(pathToFileURL(join(release.directory,'factory/tools/execution.mjs')));
const policy={model:'gpt-6-astra',reasoningEffort:'ultra',allowedTools:['workspace.list','workspace.read','workspace.write','execution.run'],instructionProfile:'scoped-v1',contextEncoding:'lossless-json-v2',reviewEncoding:'evidence-refs-v1'};
const write=(name,value)=>fs.writeFileSync(join(directory,name),JSON.stringify(value,null,2),{flag:'wx',mode:0o600});
process.umask(0o077);
const sourceQualification=JSON.parse(fs.readFileSync(join(sourceDirectory,'qualification.json'),'utf8'));
const sourceDatabase=join(sourceDirectory,'state.sqlite');
const sourceHead=()=>{const db=new DatabaseSync(sourceDatabase,{readOnly:true});try{return {...db.prepare('SELECT seq,hash FROM events ORDER BY seq DESC LIMIT 1').get()};}finally{db.close();}};
const originalHead=sourceHead(),source=new DatabaseSync(sourceDatabase,{readOnly:true});
try{await backup(source,join(directory,'state.sqlite'));}finally{source.close();}
const engine=new FactoryEngine({databasePath:join(directory,'state.sqlite'),workspaceRoot:join(directory,'workspaces'),executionRunner:new IsolatedExecutionRunner(),onEvent:e=>process.stdout.write(JSON.stringify(e)+'\n')});
const mission=engine.store.get('mission',sourceQualification.missionId)?.data,cases=portfolioCases();
if(!mission||mission.intent!==request||mission.status!=='WAITING_CAPABILITY'||!Object.entries(policy).every(([k,v])=>canonical(mission.policy[k])===canonical(v)))throw Error('Recovery source does not match frozen intent/policy/checkpoint');
if(engine.store.list('effect').some(e=>e.data.missionId===mission.id))throw Error('Only effect-free source checkpoint can relocate its empty workspace');
const binding=engine.store.get('tool-workspace',mission.id);
if(!binding||fs.readdirSync(binding.data.path).length)throw Error('Original mission workspace is not empty');
const relocated=join(directory,'workspaces','mission-'+sha256(mission.id));fs.mkdirSync(relocated,{mode:0o700});
engine.store.put('tool-workspace',mission.id,{...binding.data,path:relocated},{expectedVersion:binding.version});
engine.store.append('qualification.private-copy.relocated',{missionId:mission.id,originalHead,sourceDirectory:resolve(sourceDirectory),priorBindingHash:binding.hash,oldPath:binding.data.path,newPath:relocated,reason:'Original is immutable evidence; this exact effect-free checkpoint resumes only in a new empty private workspace.'});
const candidate=engine.store.list('artifact').map(r=>r.data).find(a=>a.missionId===mission.id&&a.payload.kind==='counterexamples'&&a.status==='RETURNED');
const previousReview=candidate?engine.store.get('review',candidate.reviews.at(-1))?.data:null;
if(!candidate||previousReview?.result.decision!=='UNKNOWN'||previousReview.result.checks.filter(c=>c.verdict!=='PASS').some(c=>c.verdict!=='UNKNOWN'||c.criterionId!=='blind_generation'))throw Error('Recovery is restricted to the observed admission-evidence uncertainty, not material product failure');
const baselineMetrics=engine.report(mission.id).metrics;
const recovery={sourceDirectory:resolve(sourceDirectory),originalHead,sourceReleaseId:sourceQualification.release.releaseId,candidateId:candidate.id,candidateHash:candidate.payloadHash,priorReviewId:previousReview.id,baselineMetrics,scope:'Explicit independent re-review of exact returned candidate with newly exposed historical admission evidence. No change to old journal, policy, criteria, candidate bytes or prerequisite production.'};
write('qualification.json',{startedAt:new Date().toISOString(),missionId:mission.id,request,policy,release,harnessHash,oracleHash,casesHash:sha256(cases),caseCount:cases.length,recovery,
  scope:'Real multi-product planning/production/independent acceptance with two distinct material prerequisites and external isolated software oracle. Synthetic mathematical task; not actual calibrated role economics or complete mandate acceptance.'});
write('cases.json',cases);
const controller=new AbortController(),stop=()=>controller.abort();process.once('SIGTERM',stop);process.once('SIGINT',stop);
try{
  const spec=engine.store.get('plan',mission.id).data.plan.nodes.find(n=>n.id===candidate.payload.nodeId);
  const ownerId='qualification:context-provenance-recovery';engine.ledger.acquireEngine({ownerId});
  let reReviewed;
  try{reReviewed=await engine.workers.review({artifact:candidate,reviewerRoleIds:spec.reviewerRoleIds,missionIntent:mission.intent,
    feedback:[{priorReviewId:previousReview.id,scope:'New authenticated artifact-production-scope observations expose the historical admission records missing in the previous UNKNOWN. Reassess the exact frozen criterion and candidate; no acceptance is pre-authorized.',checks:previousReview.result.checks.filter(c=>c.verdict!=='PASS')}],signal:controller.signal});}
  finally{engine.ledger.releaseEngine(ownerId);}
  const recoveryReview=engine.store.get('review',reReviewed.reviews.at(-1))?.data;
  write('recovery-review.json',{candidateId:candidate.id,candidateHash:candidate.payloadHash,status:reReviewed.status,review:recoveryReview});
  const outcome=reReviewed.status==='ACCEPTED'?await engine.run(mission.id,{signal:controller.signal}):engine.status(mission.id),report=engine.report(mission.id),final=report.final;
  const accepted=engine.store.list('artifact').filter(a=>a.data.missionId===mission.id&&a.data.status==='ACCEPTED');
  const models=accepted.filter(a=>a.data.payload.kind==='decision-model'),risks=accepted.filter(a=>a.data.payload.kind==='counterexamples');
  const parse=a=>{try{return JSON.parse(a?.data.payload.body);}catch{return null;}};
  const design=parse(models[0]),risk=parse(risks[0]),riskIds=['greedy-trap','transitive-dependency','asymmetric-exclusion','robust-not-sum','prefix-tie','infeasible-required'];
  const riskChecks=Array.isArray(risk?.cases)?risk.cases.map(c=>{let actual;try{actual=portfolioOracle(c.input);}catch(e){actual={error:e.code??'UNKNOWN'};}return {id:c.id,passed:c.input?.projects?.length<=8&&typeof c.why==='string'&&c.why.trim().length>0&&canonical(actual)===canonical(c.expected),actual,expected:c.expected,why:c.why};}):[];
  const producers=final?engine.store.get('run',final.payload.producerRunId)?.data:null;
  const prerequisites=[...models,...risks],depChecks=prerequisites.map(a=>({id:a.id,kind:a.data.payload.kind,
    finalRef:!!final&&final.payload.inputRefs.some(ref=>ref.artifactId===a.id&&ref.hash===a.data.payloadHash&&ref.purpose===a.data.payload.purpose),
    exposed:producers?.context.artifactIds.includes(a.id)===true,
    acceptedBeforeProducer:!!producers&&engine.registry.committedSequence('artifact',a.id,a.version)<engine.registry.committedSequence('run',producers.id,1)}));
  const workspace=engine.broker.workspace(mission.id),wanted=['README.md','portfolio.mjs','portfolio.test.mjs'];
  const actualNames=fs.readdirSync(workspace).sort(),files=[];
  for(const name of wanted)if(fs.existsSync(join(workspace,name))){const stat=fs.lstatSync(join(workspace,name));if(!stat.isFile()||stat.isSymbolicLink()||stat.nlink!==1||stat.size>1024*1024)throw Error('Unsafe candidate file');const content=new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(fs.readFileSync(join(workspace,name)));files.push({path:name,content,sha256:sha256(content)});}
  const candidateFiles=files.map(({path,sha256})=>({path,sha256}));let execution=null,answers=null,externalChecks=[];
  if(files.length===wanted.length){
    for(const [path,content] of [['.qualification-bridge.mjs',BRIDGE],['.qualification-input.json',JSON.stringify(cases.map(({id,input})=>({id,input})))]] )files.push({path,content,sha256:sha256(content)});
    const manifest=files.map(f=>({type:'file',path:f.path,bytes:Buffer.byteLength(f.content),sha256:f.sha256}));
    execution=await new IsolatedExecutionRunner({maxOutputBytes:1024*1024}).run({args:{argv:['node','.qualification-bridge.mjs'],cwd:'.'},snapshot:{files,manifest,hash:sha256(manifest)}});
    write('external-execution.json',execution);try{answers=JSON.parse(execution.stdout);}catch{}
    externalChecks=cases.map(c=>{const rows=Array.isArray(answers)?answers.filter(a=>a.id===c.id):[];return {id:c.id,pass:rows.length===1&&canonical(rows[0])===canonical({id:c.id,...c.expected}),expected:c.expected,actual:rows.length===1?rows[0]:null};});
    write('external-checks.json',externalChecks);
  }
  const reviews=accepted.map(a=>{const r=engine.store.get('review',a.data.reviews.at(-1))?.data,run=r?engine.store.get('run',r.reviewerRunId)?.data:null;return {artifactId:a.id,reviewerId:run?.id??null,independent:!!run&&run.id!==a.data.payload.producerRunId&&run.context.producerConversationIncluded===false};});
  const noReplay=outcome.mission.status==='COMPLETED'?await engine.run(mission.id):null,later=engine.report(mission.id);
  const riskProducer=risks[0]?engine.store.get('run',risks[0].data.payload.producerRunId)?.data:null;
  const checks={originalSourceUnchanged:canonical(sourceHead())===canonical(originalHead),sameCandidateRecovered:reReviewed.status==='ACCEPTED'&&reReviewed.id===candidate.id&&reReviewed.payloadHash===candidate.payloadHash,
    admissionEvidenceCited:!!recoveryReview&&recoveryReview.result.checks.some(c=>c.criterionId==='blind_generation'&&c.verdict==='PASS'&&c.evidence.some(e=>e.kind==='runtime'&&engine.store.get('runtime-observation',e.id)?.data.signed.data.kind==='artifact-production-scope')),
    accepted:outcome.mission.status==='COMPLETED'&&final?.status==='ACCEPTED',
    distinctProducts:models.length===1&&risks.length===1&&prerequisites.every(p=>p.id!==final?.id)&&new Set(prerequisites.map(p=>p.data.payload.producerRunId)).size===2,
    objectiveOrder:canonical(design?.objectiveOrder??null)===canonical(['max-worst-benefit','max-total-benefit','min-cost','lexicographic-ids']),
    alternativesPresent:typeof design?.chosenAlgorithm==='string'&&design.chosenAlgorithm.length>0&&Array.isArray(design.algorithms)&&design.algorithms.length>=3&&design.algorithms.every(a=>['name','rationale','limitation'].every(k=>typeof a[k]==='string'&&a[k].length>0)),
    sixCorrectRiskExamples:riskChecks.length===6&&canonical(riskChecks.map(c=>c.id).sort())===canonical(riskIds.sort())&&riskChecks.every(c=>c.passed),
    riskProducerIndependentOfDesign:!!riskProducer&&models.length===1&&!riskProducer.context.artifactIds.includes(models[0].id),
    prerequisiteConsumption:depChecks.length===2&&depChecks.every(c=>c.finalRef&&c.exposed&&c.acceptedBeforeProducer),
    independentReviews:reviews.length>=4&&reviews.every(r=>r.independent),
    exactFiles:canonical(actualNames)===canonical(wanted),
    externalOracle:execution?.exitCode===0&&Array.isArray(answers)&&answers.length===cases.length&&externalChecks.length===cases.length&&externalChecks.every(c=>c.pass),
    candidateBytesUnchanged:candidateFiles.length===wanted.length&&candidateFiles.every(f=>sha256(fs.readFileSync(join(workspace,f.path)))===f.sha256),
    realInference:report.metrics.completed>0&&report.metrics.liveCompleted===report.metrics.completed&&report.metrics.simulatedCompleted===0,
    noExternalResearch:report.effects.every(e=>!e.tool.startsWith('source.')),
    noReplay:noReplay?.mission.status==='COMPLETED'&&later.metrics.dispatched===report.metrics.dispatched&&later.effects.length===report.effects.length,
    runtimeUnchanged:verifyRuntimeRelease(release.directory).releaseId===release.releaseId,
    harnessUnchanged:sha256(fs.readFileSync(new URL(import.meta.url)))===harnessHash&&sha256(fs.readFileSync(new URL('./portfolio-case.mjs',import.meta.url)))===oracleHash};
  const result={completedAt:new Date().toISOString(),stateDir:resolve(directory),missionId:mission.id,releaseId:release.releaseId,status:outcome.mission.status,passed:Object.values(checks).every(v=>v===true),checks,
    scope:'Automated checks do not establish the semantic adequacy of each named counterexample or overall strategic depth; inspect the complete prerequisite artifacts and independent reviews separately.',
    recovery,metrics:report.metrics,depChecks,reviews,riskChecks,design,candidateFiles,externalOracle:{total:externalChecks.length,failures:externalChecks.filter(c=>!c.pass)},pending:outcome.mission.pending};
  write('report.json',report);write('summary.json',result);process.stdout.write(JSON.stringify(result)+'\n');if(!result.passed)process.exitCode=2;
}finally{process.removeListener('SIGTERM',stop);process.removeListener('SIGINT',stop);engine.close();}
