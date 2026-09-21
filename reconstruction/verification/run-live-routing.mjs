// Observe the installed planner + independent plan judge on four natural requests.
// This never executes their products, tools or external sources.
import * as fs from 'node:fs';
import {join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {sha256,id} from '../../factory/lib/contracts.mjs';
import {verifyRuntimeRelease} from '../../factory/lib/runtime-release.mjs';
import {ROUTING_CASES,gradeRouting} from './routing-cases.mjs';
const [directory,runtimeRoot]=process.argv.slice(2);
if(!directory||!runtimeRoot||fs.readdirSync(directory).length)throw Error('New empty private directory and frozen runtime required');
process.umask(0o077);
const release=verifyRuntimeRelease(runtimeRoot),harnessHash=sha256(fs.readFileSync(new URL(import.meta.url))),caseHash=sha256(fs.readFileSync(new URL('./routing-cases.mjs',import.meta.url)));
const load=path=>import(pathToFileURL(join(release.directory,path)));
const {FactoryEngine}=await load('factory/lib/engine.mjs');
const {IsolatedExecutionRunner}=await load('factory/tools/execution.mjs');
const policy={model:'gpt-6-astra',reasoningEffort:'ultra',maxPlanAttempts:2,
  instructionProfile:'scoped-v1',contextEncoding:'lossless-json-v2',reviewEncoding:'evidence-refs-v1'};
const write=(path,value)=>fs.writeFileSync(join(directory,path),JSON.stringify(value,null,2),{flag:'wx',mode:0o600});
write('qualification.json',{startedAt:new Date().toISOString(),directory:resolve(directory),release,harnessHash,caseHash,policy,
  cases:ROUTING_CASES,scope:'Four fixed planning-only cases. Actual subscription planning and independent plan review; no task execution. External structural oracle absent from model context; semantic audit still required. Opt-in profiles, no defaults changed or universal efficiency claim.'});
const controller=new AbortController(),stop=()=>controller.abort();process.once('SIGTERM',stop);process.once('SIGINT',stop);
const results=[];
try{
  for(const c of ROUTING_CASES){
    if(controller.signal.aborted)break;
    const caseDir=join(directory,c.id);fs.mkdirSync(caseDir,{mode:0o700});
    const engine=new FactoryEngine({databasePath:join(caseDir,'state.sqlite'),workspaceRoot:join(caseDir,'workspaces'),
      executionRunner:new IsolatedExecutionRunner(),onEvent:event=>process.stdout.write(JSON.stringify({caseId:c.id,...event})+'\n')});
    const mission=engine.create(c.request,{...policy,allowedTools:c.allowedTools}),ownerId=id('qualification-planner');
    write(c.id+'/mission.json',{missionId:mission.id,caseId:c.id,requestHash:mission.intentHash});
    let failure=null,owner=false;
    try{
      engine.ledger.acquireEngine({ownerId});owner=true;
      await engine.ensurePlan(mission,controller.signal);
      engine.setStatus(mission.id,'PAUSED',[{code:'QUALIFICATION_PLAN_ONLY',reason:'This qualification observes planning only; no product was executed or delivered.'}]);
    }catch(error){failure={code:error.code??'INTERNAL'};engine.setStatus(mission.id,'PAUSED',[{code:'QUALIFICATION_PLAN_ONLY_FAILED',reason:'Planning observation failed or was interrupted; no delivery claimed.'}]);}
    finally{if(owner)engine.ledger.releaseEngine(ownerId);}
    try{
      const report=engine.report(mission.id),plan=engine.store.get('plan',mission.id)?.data.plan??null;
      const grade=gradeRouting(c,plan),effects=engine.store.list('effect'),sources=engine.store.list('source');
      const checks={...grade.checks,noQualificationFailure:failure===null,noTaskEffects:effects.length===0,
        noFetchedSources:sources.length===0,noFinalDelivery:report.final===null,
        realPlanningAndReview:report.metrics.completed>=2&&report.metrics.liveCompleted===report.metrics.completed&&report.metrics.simulatedCompleted===0};
      const result={caseId:c.id,missionId:mission.id,completedAt:new Date().toISOString(),failure,passed:Object.values(checks).every(v=>v===true),
        checks,grade,metrics:report.metrics,semanticAudit:'PENDING',scope:'Plan qualification only. PAUSED mission is intentional; not a completed user product.'};
      results.push(result);write(c.id+'/report.json',report);write(c.id+'/plan.json',plan);write(c.id+'/summary.json',result);
      process.stdout.write(JSON.stringify({event:'routing.case.completed',...result})+'\n');
    }finally{engine.close();}
    if(failure&&['QUOTA','AUTH','CAPABILITY','CANCELLED','ABORTED','TIMEOUT','TRANSIENT_PROVIDER'].includes(failure.code))break;
  }
  const checks={allFourObserved:results.length===ROUTING_CASES.length,allStructuralChecks:results.every(r=>r.passed),
    frozenRuntime:verifyRuntimeRelease(release.directory).releaseId===release.releaseId,
    harnessUnchanged:sha256(fs.readFileSync(new URL(import.meta.url)))===harnessHash,
    casesUnchanged:sha256(fs.readFileSync(new URL('./routing-cases.mjs',import.meta.url)))===caseHash};
  const summary={completedAt:new Date().toISOString(),releaseId:release.releaseId,checks,passed:Object.values(checks).every(Boolean),results,
    notRunCaseIds:ROUTING_CASES.filter(c=>!results.some(r=>r.caseId===c.id)).map(c=>c.id),semanticAudit:'PENDING',
    caveat:'Structural oracle is not semantic role/method validation, execution, routing calibration across models or general optimality. Every plan and rejected attempt is preserved for audit.'};
  write('summary.json',summary);process.stdout.write(JSON.stringify(summary)+'\n');if(!summary.passed)process.exitCode=2;
}finally{process.removeListener('SIGTERM',stop);process.removeListener('SIGINT',stop);}
