// One observed real failure -> at most one real proposal -> at most eight
// paired closed extraction evaluations. No production promotion or retry hunt.
import * as fs from 'node:fs';
import {DatabaseSync,backup} from 'node:sqlite';
import {join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {verifyRuntimeRelease} from '../../factory/lib/runtime-release.mjs';
import {canonical,sha256,safeCode} from '../../factory/lib/contracts.mjs';
import {literalEvidenceCases,literalEvidenceSchema,literalEvidenceTask,validLiteralEvidenceShape,measureLiteralEvidence} from './literal-evidence-case.mjs';
const [directory,runtimeRoot,sourceDirectory]=process.argv.slice(2);
if(!directory||!runtimeRoot||!sourceDirectory||fs.readdirSync(directory).length)throw Error('Explicit new empty state directory, frozen runtime and completed source qualification required');
process.umask(0o077);
const release=verifyRuntimeRelease(runtimeRoot),harnessHash=sha256(fs.readFileSync(new URL(import.meta.url))),oracleHash=sha256(fs.readFileSync(new URL('./literal-evidence-case.mjs',import.meta.url)));
const load=relative=>import(pathToFileURL(join(release.directory,relative)));
const {Store}=await load('factory/lib/store.mjs'),{Authority}=await load('factory/lib/authority.mjs');
const {LearningService}=await load('factory/lib/learning-service.mjs'),{LearningConductor}=await load('factory/lib/learning-conductor.mjs'),{SubscriptionCaseEvaluator}=await load('factory/lib/learning-evaluator.mjs');
const original=JSON.parse(fs.readFileSync(join(sourceDirectory,'summary.json')));
if(original.status!=='COMPLETED'||original.passed!==true)throw Error('Original qualification must be complete before taking its observed failure');
const source=new DatabaseSync(join(sourceDirectory,'state.sqlite'),{readOnly:true}),head=()=>({...source.prepare('SELECT seq,hash FROM events ORDER BY seq DESC LIMIT 1').get()}),originalHead=head();
await backup(source,join(directory,'state.sqlite'));
const store=new Store(join(directory,'state.sqlite')),authority=new Authority(store),service=new LearningService({store,authority}),conductor=new LearningConductor({service});
const write=(name,value)=>fs.writeFileSync(join(directory,name),JSON.stringify(value,null,2),{flag:'wx',mode:0o600});
const controller=new AbortController(),stop=()=>controller.abort();process.once('SIGTERM',stop);process.once('SIGINT',stop);
let cycle;
try{
  const record=store.get('worker-rejected-review','review-rejection:b8c1322f-b39a-4054-80c0-6ddc5ba4c13e');
  if(record?.version!==1||record.data.code!=='REVIEW_EVIDENCE'||record.hash!=='72ed4d3fca81d4f98336bd668555c50364b55e26b3f9806128af6cfb1ebb5765')throw Error('Exact observed original rejection required');
  const scope=store.get('worker-config',record.data.runId).data.compilationScope;
  const expectedScope={contextEncoding:'lossless-json-v2',instructionProfile:'scoped-v1',mode:'reviewer',purpose:'plan',reviewEncoding:'evidence-refs-v1',roleIds:['omega_22']};
  if(canonical(scope)!==canonical(expectedScope))throw Error('Observed scope differs');
  const cases=literalEvidenceCases(),datasetSpec={missionId:'learning-literal-extraction-qualification',evaluatorId:'trusted-exact-serialized-span-oracle',
    cases:cases.map(c=>({id:c.id,input:{taskInstructions:literalEvidenceTask,input:c.input,schema:literalEvidenceSchema,model:'gpt-5.6-sol',reasoningEffort:'high',instructionProfile:scope.instructionProfile},
      expected:c.expected,required:true,holdout:true,criteria:[{metric:'accuracy',direction:'higher',threshold:1}]})),policy:{requireImprovement:true}};
  const baseline=service.registerBaseline({roleId:'omega_22',scope,datasetSpec}),ref={type:record.type,id:record.id,version:record.version,hash:record.hash};
  const diagnostic=conductor.diagnosticEvidence(ref,record.data.runId),citations=diagnostic.diagnostic.artifactCitationChecks;
  if(citations.length!==13||canonical(citations.filter(c=>c.quoteIsExact===false).map(c=>c.evidenceIndex))!==canonical([0,4]))throw Error('Historical citation diagnosis differs');
  cycle=conductor.open({roleId:'omega_22',runId:record.data.runId,evidenceRefs:[ref]});
  write('qualification.json',{startedAt:new Date().toISOString(),stateDir:resolve(directory),sourceDirectory:resolve(sourceDirectory),originalHead,release,harnessHash,oracleHash,
    evidenceRef:ref,cycleId:cycle.id,scope,datasetHash:sha256(datasetSpec),cases,diagnostic,
    scopeCaveat:'One real proposal from an observed failure; if justified, four synthetic extraction cases evaluated once per baseline/candidate under the observed Sol/high scope. This measures exact evidence transport only, not semantic plan acceptance, general learning superiority, or production safety. No permission to promote.'});
  const evaluator=new SubscriptionCaseEvaluator({store,authority,validate:validLiteralEvidenceShape,
    measure:({value,case:c})=>{const measured=measureLiteralEvidence(value,c.expected);return {outcome:measured.outcome,metrics:measured.metrics};}});
  process.stdout.write(JSON.stringify({event:'learning.literal.started',cycleId:cycle.id})+'\n');
  const outcome=await conductor.advance(cycle.id,{signal:controller.signal,runCase:async(request,{signal}={})=>{
    process.stdout.write(JSON.stringify({event:'learning.literal.case.started',caseId:request.caseId,variant:request.variant})+'\n');
    const result=await evaluator.runCase(request,{signal});process.stdout.write(JSON.stringify({event:'learning.literal.case.completed',caseId:request.caseId,variant:request.variant,outcome:result.observations.outcome})+'\n');return result;
  }});
  const count=store.list('learning-provider-execution').length,proposalCount=store.list('learning-proposal').length,attemptCount=store.list('learning-provider-attempt').length;
  const again=await conductor.advance(cycle.id,{runCase:(request,options)=>evaluator.runCase(request,options)}),evaluation=outcome.candidateId?store.get('learning-evaluation',outcome.candidateId)?.data:null;
  const proposal=store.get('learning-proposal',outcome.proposalId)?.data,observed=proposal?.signed?authority.open(proposal.signed,'learning.proposal'):null;
  const executions=store.list('learning-provider-execution').map(r=>authority.open(r.data.signed,'learning.inference'));
  const checks={terminal:['SKIPPED','REJECTED','READY_FOR_PROMOTION'].includes(outcome.status),originalJournalUnchanged:canonical(head())===canonical(originalHead),
    exactFailurePreserved:store.get(ref.type,ref.id,ref.version)?.hash===ref.hash,historicalLiteralDiagnosis:citations.length===13&&citations.filter(c=>c.quoteIsExact===false).length===2,
    realProposal:observed?.response.receipt.simulation===false&&observed.closure.processExitObserved===true,
    boundedComparison:executions.length===(outcome.status==='SKIPPED'?0:cases.length*2)&&executions.every(e=>e.response.receipt.simulation===false&&e.closure.processExitObserved===true),
    allAttemptsRetained:attemptCount===executions.length&&store.list('learning-provider-attempt').every(r=>r.data.status==='COMPLETED'),
    noActivation:service.registry.getActive('omega_22').hash===baseline.hash,
    reentryNoReplay:again.status===outcome.status&&store.list('learning-provider-execution').length===count&&store.list('learning-proposal').length===proposalCount&&store.list('learning-provider-attempt').length===attemptCount,
    runtimeUnchanged:verifyRuntimeRelease(release.directory).releaseId===release.releaseId,
    inputsUnchanged:sha256(fs.readFileSync(new URL(import.meta.url)))===harnessHash&&sha256(fs.readFileSync(new URL('./literal-evidence-case.mjs',import.meta.url)))===oracleHash};
  const summary={completedAt:new Date().toISOString(),cycleId:cycle.id,status:outcome.status,passed:Object.values(checks).every(x=>x===true),checks,
    modelImprovementObserved:evaluation?.improved??false,evaluationPassed:evaluation?.passed??null,issues:evaluation?.issues??[],productionChanged:false,
    proposal:observed?.response.value??null,results:evaluation?.results.map(r=>({caseId:r.caseId,variant:r.variant,...r.result.observations,
      oracle:measureLiteralEvidence(r.result.observations.actual.value,r.request.case.expected)}))??[],
    usage:[observed?.response.receipt.usage??null,...executions.map(e=>e.response.receipt.usage??null)]};
  write('summary.json',summary);process.stdout.write(JSON.stringify({event:'learning.literal.finished',status:summary.status,passed:summary.passed,modelImprovementObserved:summary.modelImprovementObserved})+'\n');if(!summary.passed)process.exitCode=2;
}catch(error){
  write('failure.json',{at:new Date().toISOString(),code:safeCode(error),cycleId:cycle?.id??null,status:cycle?conductor.get(cycle.id).status:null,
    originalJournalUnchanged:canonical(head())===canonical(originalHead),attempts:store.list('learning-provider-attempt').map(r=>({id:r.id,status:r.data.status,code:r.data.code??null}))});
  throw error;
}finally{process.removeListener('SIGTERM',stop);process.removeListener('SIGINT',stop);store.close();source.close();}
