// Two completed paired products plus four entry-boundary probes. All exact
// requests/gold frozen before dispatch; negative-case products are not executed.
import * as fs from 'node:fs';
import {join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {sha256,id,canonical} from '../../factory/lib/contracts.mjs';
import {verifyRuntimeRelease} from '../../factory/lib/runtime-release.mjs';
import {CLOSED_ENTRY_CASES,checkClosedAnswer} from './closed-entry-cases.mjs';
const [directory,runtimeRoot]=process.argv.slice(2);
if(!directory||!runtimeRoot||fs.readdirSync(directory).length)throw Error('New empty private directory and frozen runtime required');
process.umask(0o077);
const release=verifyRuntimeRelease(runtimeRoot),harnessHash=sha256(fs.readFileSync(new URL(import.meta.url))),caseHash=sha256(fs.readFileSync(new URL('./closed-entry-cases.mjs',import.meta.url)));
const load=path=>import(pathToFileURL(join(release.directory,path)));
const {FactoryEngine}=await load('factory/lib/engine.mjs'),{runClosedEntry,CLOSED_ENTRY_MODE}=await load('factory/lib/closed-entry.mjs');
const policy={model:'gpt-6-astra',reasoningEffort:'ultra',maxPlanAttempts:2,maxNodeAttempts:2,
  instructionProfile:'scoped-v1',contextEncoding:'lossless-json-v2',reviewEncoding:'evidence-refs-v1'};
const write=(path,value)=>fs.writeFileSync(join(directory,path),JSON.stringify(value,null,2),{flag:'wx',mode:0o600});
write('qualification.json',{startedAt:new Date().toISOString(),directory:resolve(directory),release,harnessHash,caseHash,policy,cases:CLOSED_ENTRY_CASES,
  scope:'Paired actual products for two closed tasks, four negative entry-only probes. Same model, effort, transport, original request and external oracle. No tool effects, ordinary service or defaults changed. Pair order counterbalanced but one sample per case, not a general efficiency claim.'});
const controller=new AbortController(),stop=()=>controller.abort();process.once('SIGTERM',stop);process.once('SIGINT',stop);
const results=[];
try{
  for(const [caseIndex,c]of CLOSED_ENTRY_CASES.entries()){
    for(const mode of c.pair?(caseIndex%2?['direct','planned']:['planned','direct']):['direct']){
      if(controller.signal.aborted)break;
      const key=c.id+'-'+mode,caseDir=join(directory,key);fs.mkdirSync(caseDir,{mode:0o700});
      const engine=new FactoryEngine({databasePath:join(caseDir,'state.sqlite'),workspaceRoot:join(caseDir,'workspaces'),
        onEvent:event=>process.stdout.write(JSON.stringify({caseId:c.id,mode,...event})+'\n')});
      const mission=engine.create(c.request,{...policy,allowedTools:c.allowedTools,...(mode==='direct'?{entryMode:CLOSED_ENTRY_MODE}:{entryMode:'planned'})});
      write(key+'/mission.json',{missionId:mission.id,caseId:c.id,mode,requestHash:mission.intentHash});
      const startedAt=new Date().toISOString();let failure=null;
      try{
        if(mode==='planned')await engine.run(mission.id,{signal:controller.signal,pauseOnAbort:true});
        else{
          const ownerId=id('qualification-entry');engine.ledger.acquireEngine({ownerId});
          try{
            const answer=await runClosedEntry(engine,mission,controller.signal);
            if(!answer)engine.setStatus(mission.id,'PAUSED',[{code:'QUALIFICATION_ENTRY_BOUNDARY',reason:'Full planning is deliberately outside this boundary probe; no required product executed or delivered.'}]);
          }finally{engine.ledger.releaseEngine(ownerId);}
        }
      }catch(error){failure={code:error.code??'INTERNAL'};engine.setStatus(mission.id,'PAUSED',[{code:'QUALIFICATION_INTERRUPTED',reason:'Entry qualification failed or was interrupted, not a delivery.'}]);}
      try{
        const report=engine.report(mission.id),entry=engine.store.get('closed-entry',mission.id)?.data??null;
        const expectedDirect=mode==='direct'&&c.expected==='DIRECT';
        const checks={noFailure:failure===null,noEffects:report.effects.length===0,noSources:report.sources.length===0,
          actualSubscription:report.metrics.completed>0&&report.metrics.completed===report.metrics.liveCompleted&&report.metrics.simulatedCompleted===0,
          routing:mode==='planned'?Boolean(report.plan)&&report.mission.status==='COMPLETED'
            :expectedDirect?entry?.status==='ACCEPTED'&&report.mission.status==='COMPLETED'&&!report.plan
              :entry?.status==='FALLBACK'&&report.mission.status==='PAUSED'&&!report.final&&!report.plan,
          externalAnswer:c.answer===undefined?report.final===null:checkClosedAnswer(c,report.final?.payload.body),
          distinctReview:!report.final||report.reviews.some(r=>r.artifactId===report.final.id&&r.reviewerRunId!==report.final.payload.producerRunId&&r.result.decision==='ACCEPT')};
        const result={caseId:c.id,mode,missionId:mission.id,startedAt,completedAt:new Date().toISOString(),failure,checks,
          passed:Object.values(checks).every(v=>v===true),entryStatus:entry?.status??null,missionStatus:report.mission.status,
          metrics:report.metrics,semanticAudit:'PENDING',scope:c.pair?'Completed product comparison, not generalization.':'Entry decision only; requested source/file/blind product is NOT delivered by this probe.'};
        results.push(result);write(key+'/report.json',report);write(key+'/summary.json',result);
        process.stdout.write(JSON.stringify({event:'closed-entry.case.completed',...result})+'\n');
        if(failure||['WAITING_QUOTA','WAITING_PROVIDER','WAITING_CAPABILITY','CANCELLED'].includes(report.mission.status))controller.abort();
      }finally{engine.close();}
    }
    if(controller.signal.aborted)break;
  }
  const pairs=CLOSED_ENTRY_CASES.filter(c=>c.pair).map(c=>{
    const arms=results.filter(r=>r.caseId===c.id),planned=arms.find(r=>r.mode==='planned'),direct=arms.find(r=>r.mode==='direct');
    const counts=r=>({calls:r?.metrics.dispatched??null,totalTokens:r?.metrics.providerUsage.byFieldObserved.totalTokens??null,
      tokenCoverage:r?.metrics.providerUsage.observedCompletedCalls===r?.metrics.completed,wallMs:r?Date.parse(r.completedAt)-Date.parse(r.startedAt):null});
    const p=counts(planned),d=counts(direct),complete=Boolean(planned&&direct&&planned.passed&&direct.passed);
    return {caseId:c.id,bothCorrect:complete,planned:p,direct:d,
      observedReduction:complete&&p.tokenCoverage&&d.tokenCoverage?{calls:p.calls-d.calls,totalTokens:p.totalTokens-d.totalTokens}:null};
  });
  const checks={allEightObserved:results.length===8,allChecks:results.every(r=>r.passed),
    frozenRuntime:verifyRuntimeRelease(release.directory).releaseId===release.releaseId,
    harnessUnchanged:sha256(fs.readFileSync(new URL(import.meta.url)))===harnessHash,
    casesUnchanged:sha256(fs.readFileSync(new URL('./closed-entry-cases.mjs',import.meta.url)))===caseHash};
  const summary={completedAt:new Date().toISOString(),releaseId:release.releaseId,checks,passed:Object.values(checks).every(Boolean),results,pairs,
    semanticAudit:'PENDING',scope:'Two exact paired closed products and four boundary decisions, one sample each. Not full negative-case execution, widespread routing calibration, causal global savings, or a change of default.'};
  write('summary.json',summary);process.stdout.write(JSON.stringify(summary)+'\n');if(!summary.passed)process.exitCode=2;
}finally{process.removeListener('SIGTERM',stop);process.removeListener('SIGINT',stop);}
