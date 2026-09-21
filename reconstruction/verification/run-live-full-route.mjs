import * as fs from 'node:fs';
import {join,resolve,dirname} from 'node:path';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {sha256,canonical} from '../../factory/lib/contracts.mjs';
import {verifyRuntimeRelease} from '../../factory/lib/runtime-release.mjs';
import {assertPassingRegression} from './regression-disposition.mjs';
import {verifyRegressionInputArchive} from './regression-input-archive.mjs';
import {FULL_ROUTE_CASES} from './full-route-cases.mjs';
import {runFullRouteCase,fullRoutePolicy,writeRouteEvidence} from './full-route-harness.mjs';

export function qualifyFullRoute(runtimeRoot,suitePath){
  const release=verifyRuntimeRelease(runtimeRoot),manifest=JSON.parse(fs.readFileSync(join(runtimeRoot,'RELEASE.json')));
  const suiteBytes=fs.readFileSync(suitePath),suiteHash=sha256(suiteBytes),suite=JSON.parse(suiteBytes);assertPassingRegression(suite);
  const repository=resolve(fileURLToPath(new URL('../..',import.meta.url))),inventory=[];
  for(const base of ['factory','tests/factory'])for(const name of fs.readdirSync(join(repository,base),{recursive:true})){
    const path=join(base,name);if(fs.statSync(join(repository,path)).isFile()&&/\.(mjs|py|json)$/.test(path))inventory.push(path);
  }
  for(const base of ['reconstruction/verification','reconstruction/visualization'])
    for(const name of fs.readdirSync(join(repository,base)).filter(n=>n.endsWith('.mjs')))inventory.push(join(base,name));
  if(canonical(inventory.sort())!==canonical(Object.keys(suite.inputs).sort()))throw Error('Regression input set changed');
  const started=JSON.parse(fs.readFileSync(join(dirname(suitePath),'started.json')));
  if(canonical(started.inputs)!==canonical(suite.inputs)||started.startedAt!==suite.startedAt
    ||sha256(fs.readFileSync(join(dirname(suitePath),'results.tap')))!==suite.stdoutSha256
    ||sha256(fs.readFileSync(join(dirname(suitePath),'stderr.txt')))!==suite.stderrSha256)throw Error('Regression evidence differs');
  if(suite.inputArchive){
    if(canonical(started.inputArchive)!==canonical(suite.inputArchive))throw Error('Regression input archive binding differs');
    const archived=verifyRegressionInputArchive({directory:join(dirname(suitePath),'input-archive'),inputs:suite.inputs,
      manifestSha256:suite.inputArchive.manifestSha256});
    if(canonical(archived)!==canonical(suite.inputArchive))throw Error('Regression input archive differs');
  }
  const evidencePins=[suitePath,...['started.json','results.tap','stderr.txt'].map(n=>join(dirname(suitePath),n))]
    .map(path=>({path:resolve(path),hash:sha256(fs.readFileSync(path))}));
  if(evidencePins[0].hash!==suiteHash)throw Error('Regression summary changed during qualification');
  const pins=Object.entries(suite.inputs).map(([path,hash])=>({path:join(repository,path),hash}));
  for(const name of ['run-live-full-route.mjs','full-route-harness.mjs','full-route-audit.mjs','full-route-cases.mjs','interval-union-oracle.mjs'])
    if(!suite.inputs['reconstruction/verification/'+name])throw Error('Full route harness not pinned');
  for(const file of manifest.files.filter(f=>f.path.startsWith('factory/')&&/\.(mjs|py|json)$/.test(f.path)))
    if(suite.inputs[file.path]!==file.sha256)throw Error('Runtime not covered by regression');
  const frozen=()=>{
    try{return pins.every(p=>sha256(fs.readFileSync(p.path))===p.hash)
      &&evidencePins.every(p=>sha256(fs.readFileSync(p.path))===p.hash)&&verifyRuntimeRelease(runtimeRoot).releaseId===release.releaseId
      &&(!suite.inputArchive||canonical(verifyRegressionInputArchive({directory:join(dirname(suitePath),'input-archive'),inputs:suite.inputs,
        manifestSha256:suite.inputArchive.manifestSha256}))===canonical(suite.inputArchive));}
    catch{return false;}
  };
  if(!frozen())throw Error('Regression inputs changed');
  return {release,pins,frozen,suite:{path:resolve(suitePath),hash:suiteHash,counts:suite.counts}};
}

export async function runLiveFullRoute(directory,runtimeRoot,suitePath){
  if(!directory||!runtimeRoot||!suitePath||fs.readdirSync(directory).length)throw Error('Fresh empty output, frozen runtime and passing regression required');
  process.umask(0o077);
  const qualification=qualifyFullRoute(runtimeRoot,suitePath),{release,frozen}=qualification;
  const {CodexProvider}=await import(pathToFileURL(join(runtimeRoot,'factory/providers/codex.mjs')));
  const controller=new AbortController(),stop=()=>controller.abort(),write=(name,value)=>writeRouteEvidence(directory,name,value);
  const arms=FULL_ROUTE_CASES.flatMap(spec=>spec.modes.map(mode=>({caseId:spec.id,mode,policy:fullRoutePolicy(spec,mode),maxCalls:spec.maxCalls})));
  write('qualification.json',{startedAt:new Date().toISOString(),...qualification,frozen:undefined,arms,casesHash:sha256(FULL_ROUTE_CASES),
    maxCalls:arms.reduce((sum,a)=>sum+a.maxCalls,0),scope:'Four full engine.run arms, three known cases, no simulated upstream. No API fallback, repairs outside fixed policy, installation, ordinary mission, release claim or broad holdout claim.'});
  const results=[];let failure=null;
  process.once('SIGTERM',stop);process.once('SIGINT',stop);
  try{
    for(const spec of FULL_ROUTE_CASES)for(const mode of spec.modes){
      if(failure||controller.signal.aborted)break;
      const path=join(directory,spec.id+'-'+mode);fs.mkdirSync(path,{mode:0o700});
      const result=await runFullRouteCase({runtimeRoot,directory:path,spec,mode,simulation:false,frozen,signal:controller.signal,
        providerFactory:()=>new CodexProvider(),onEvent:e=>process.stdout.write(JSON.stringify({caseId:spec.id,mode,...e})+'\n')});
      results.push(result);process.stdout.write(JSON.stringify({caseId:spec.id,mode,passed:result.passed,status:result.missionStatus,checks:result.checks})+'\n');
      if(!result.passed)failure={code:result.fatal?.code??'ARM_NOT_QUALIFIED',caseId:spec.id,mode,
        scope:'Stop for diagnosis, preserve this arm, do not repeat it or change its oracle.'};
    }
  }catch(error){failure={code:error.code??'UNKNOWN'};write('failure.json',{at:new Date().toISOString(),failure});}
  finally{process.removeListener('SIGTERM',stop);process.removeListener('SIGINT',stop);}
  const pair=results.filter(r=>r.caseId===FULL_ROUTE_CASES[0].id),observed=r=>{
    const receipts=r.calls.map(c=>c.receipt),tokens=receipts.map(r=>r?.usage?.totalTokens).filter(Number.isFinite);
    return {mode:r.mode,passed:r.passed,calls:r.calls.length,receipts:receipts.filter(Boolean).length,
      totalTokensObserved:tokens.length?tokens.reduce((a,b)=>a+b,0):null,totalTokenCoverage:tokens.length===r.calls.length,
      wallMs:Date.parse(r.completedAt)-Date.parse(r.startedAt),corrections:r.metrics.correctionRequests};
  };
  const summary={completedAt:new Date().toISOString(),release,failure,interrupted:controller.signal.aborted,
    passed:!failure&&!controller.signal.aborted&&results.length===4&&results.every(r=>r.passed)&&frozen(),
    completedArms:results.length,dispatchedCalls:results.reduce((n,r)=>n+r.calls.length,0),
    results:results.map(r=>({caseId:r.caseId,mode:r.mode,missionId:r.missionId,passed:r.passed,checks:r.checks,metrics:r.metrics})),
    pairedTransformation:{bothQualified:pair.length===2&&pair.every(r=>r.passed),observations:pair.map(observed),
      scope:'One same-policy pair in fixed adaptive-first order. Descriptive cost only; no causal/general savings claim.'},semanticAudit:'PENDING',
    scope:'No full factory acceptance or release promotion. The ordinary installed service is unchanged.'};
  write('summary.json',summary);process.stdout.write(JSON.stringify({directory,...summary})+'\n');return summary;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const summary=await runLiveFullRoute(...process.argv.slice(2));process.exitCode=summary.passed?0:2;
}
