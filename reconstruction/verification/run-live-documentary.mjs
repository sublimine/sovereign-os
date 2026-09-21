// One new opt-in documentary trial; never recover/rewrite the old spVGwI arm.
import * as fs from 'node:fs';
import {join,resolve} from 'node:path';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {sha256} from '../../factory/lib/contracts.mjs';
import {captureProcessIdentity} from '../../factory/lib/process-identity.mjs';
import {qualifyFullRoute} from './run-live-full-route.mjs';
import {FULL_ROUTE_CASES} from './full-route-cases.mjs';
import {runFullRouteCase,fullRoutePolicy,writeRouteEvidence} from './full-route-harness.mjs';

export const DOCUMENTARY_CASE=Object.freeze({...FULL_ROUTE_CASES[1],id:'distinct-literal-windows-v1',modes:['planned'],
  documentContext:'literal-windows-v1',maxCalls:20});

export async function runLiveDocumentary(directory,runtimeRoot,suitePath){
  if(!directory||!runtimeRoot||!suitePath||fs.readdirSync(directory).length)throw Error('Fresh empty output, frozen runtime and passing regression required');
  process.umask(0o077);const qualification=qualifyFullRoute(runtimeRoot,suitePath),{frozen}=qualification;
  if(!qualification.pins.some(p=>p.path===fileURLToPath(import.meta.url)))throw Error('Documentary harness not pinned');
  const {CodexProvider}=await import(pathToFileURL(join(runtimeRoot,'factory/providers/codex.mjs')));
  const controller=new AbortController(),stop=()=>controller.abort(),write=(name,value)=>writeRouteEvidence(directory,name,value);
  const owner={pid:process.pid,processIdentity:captureProcessIdentity(process.pid)};
  write('qualification.json',{startedAt:new Date().toISOString(),owner,...qualification,frozen:undefined,
    spec:DOCUMENTARY_CASE,specHash:sha256(DOCUMENTARY_CASE),policy:fullRoutePolicy(DOCUMENTARY_CASE,'planned'),
    scope:'One known-case planned documentary arm, 20-call absolute ceiling, fresh acquisitions and real subscription only. Same original request/content oracle as the failed historical source case; new protocol and route, not a causal efficiency comparison or full factory qualification. No ordinary queue, install, paid API fallback, failed-arm resume or verdict repair outside frozen policy.'});
  const path=join(directory,DOCUMENTARY_CASE.id);fs.mkdirSync(path,{mode:0o700});
  process.once('SIGTERM',stop);process.once('SIGINT',stop);
  process.stdout.write(JSON.stringify({directory,owner,started:true,maxCalls:20})+'\n');
  try{
    const result=await runFullRouteCase({runtimeRoot,directory:path,spec:DOCUMENTARY_CASE,mode:'planned',simulation:false,
      frozen,signal:controller.signal,providerFactory:()=>new CodexProvider(),onEvent:e=>process.stdout.write(JSON.stringify(e)+'\n')});
    const summary={completedAt:new Date().toISOString(),release:qualification.release,passed:result.passed&&frozen()&&!controller.signal.aborted,
      missionId:result.missionId,missionStatus:result.missionStatus,checks:result.checks,dispatchedCalls:result.calls.length,metrics:result.metrics,
      interrupted:controller.signal.aborted,semanticAudit:'PENDING',scope:'Single known-case documentary qualification only. No installation or full mandate acceptance.'};
    write('summary.json',summary);process.stdout.write(JSON.stringify({directory,...summary})+'\n');return summary;
  }finally{process.removeListener('SIGTERM',stop);process.removeListener('SIGINT',stop);}
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const summary=await runLiveDocumentary(...process.argv.slice(2));process.exitCode=summary.passed?0:2;
}
