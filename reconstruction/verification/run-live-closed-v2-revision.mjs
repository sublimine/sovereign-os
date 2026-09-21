// One new fixed pair; not the old unbounded eight-arm entry harness.
import fs from 'node:fs';
import {join,resolve} from 'node:path';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {sha256} from '../../factory/lib/contracts.mjs';
import {captureProcessIdentity} from '../../factory/lib/process-identity.mjs';
import {qualifyFullRoute} from './run-live-full-route.mjs';
import {runFullRouteCase,fullRoutePolicy,writeRouteEvidence} from './full-route-harness.mjs';
import {CLOSED_V2_REVISION_CASE as spec} from './closed-v2-revision-case.mjs';

export async function runLiveClosedV2Revision(directory,runtimeRoot,suitePath){
  if(!directory||!runtimeRoot||!suitePath||fs.readdirSync(directory).length)throw Error('New empty directory, frozen runtime and passing regression required');
  process.umask(0o077);
  const qualified=qualifyFullRoute(runtimeRoot,suitePath),{frozen}=qualified;
  for(const path of [fileURLToPath(import.meta.url),fileURLToPath(new URL('./closed-v2-revision-case.mjs',import.meta.url))])
    if(!qualified.pins.some(p=>p.path===path))throw Error('Prospective harness and case must be regression-pinned');
  const {CodexProvider}=await import(pathToFileURL(join(runtimeRoot,'factory/providers/codex.mjs')));
  const owner=captureProcessIdentity(),controller=new AbortController(),stop=()=>controller.abort();
  const write=(name,data)=>writeRouteEvidence(directory,name,data),results=[];
  write('qualification.json',{startedAt:new Date().toISOString(),owner,...qualified,frozen:undefined,spec,specHash:sha256(spec),
    arms:spec.modes.map(mode=>({mode,policy:fullRoutePolicy(spec,mode),maxCalls:spec.maxCalls})),maxCalls:16,
    scope:'One new known-case complete pair, v2 first. Two fresh databases; no result transfer, old-arm resume, ordinary queue, install, API fallback or acceptance-policy repair. Stop after an unqualified first arm. Descriptive costs only, not causal/general savings or full mandate acceptance.'});
  process.once('SIGTERM',stop);process.once('SIGINT',stop);
  process.stdout.write(JSON.stringify({directory,owner,started:true,maxCalls:16})+'\n');
  try{
    for(const mode of spec.modes){
      if(controller.signal.aborted||!frozen())break;
      const path=join(directory,mode);fs.mkdirSync(path,{mode:0o700});
      const result=await runFullRouteCase({runtimeRoot,directory:path,spec,mode,simulation:false,frozen,signal:controller.signal,
        providerFactory:()=>new CodexProvider(),onEvent:event=>process.stdout.write(JSON.stringify({mode,...event})+'\n')});
      results.push(result);process.stdout.write(JSON.stringify({mode,passed:result.passed,checks:result.checks,calls:result.calls.length})+'\n');
      if(!result.passed)break;
    }
    const summary={completedAt:new Date().toISOString(),release:qualified.release,passed:results.length===2&&results.every(r=>r.passed)&&frozen()&&!controller.signal.aborted,
      interrupted:controller.signal.aborted,arms:results.map(r=>({mode:r.mode,missionId:r.missionId,passed:r.passed,checks:r.checks,
        calls:r.calls.length,wallMs:Date.parse(r.completedAt)-Date.parse(r.startedAt),metrics:r.metrics})),
      dispatchedCalls:results.reduce((n,r)=>n+r.calls.length,0),semanticAudit:'PENDING',
      scope:'One fixed-order known-case pair, not broad routing calibration, a default change, live documentary-batch qualification or full acceptance.'};
    write('summary.json',summary);process.stdout.write(JSON.stringify(summary)+'\n');return summary;
  }finally{process.removeListener('SIGTERM',stop);process.removeListener('SIGINT',stop);}
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const result=await runLiveClosedV2Revision(...process.argv.slice(2));process.exitCode=result.passed?0:2;
}
