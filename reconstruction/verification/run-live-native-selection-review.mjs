import * as fs from 'node:fs';
import {join,resolve,dirname} from 'node:path';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {sha256,canonical} from '../../factory/lib/contracts.mjs';
import {verifyRuntimeRelease} from '../../factory/lib/runtime-release.mjs';
import {assertPassingRegression} from './regression-disposition.mjs';
import {nativeSelectionReviewCases as cases} from './native-selection-review-cases.mjs';
import {runNativeSelectionCase,selectionReviewPolicy,writeDiagnostic} from './native-selection-review-harness.mjs';

export async function runLiveNativeSelectionReview(directory,runtimeRoot,suitePath){
  if(!directory||!runtimeRoot||!suitePath||fs.readdirSync(directory).length)throw Error('New empty directory, frozen runtime and exact passing regression required');
  const release=verifyRuntimeRelease(runtimeRoot),manifest=JSON.parse(fs.readFileSync(join(runtimeRoot,'RELEASE.json')));
  const suite=JSON.parse(fs.readFileSync(suitePath));assertPassingRegression(suite);
  const repository=resolve(fileURLToPath(new URL('../..',import.meta.url)));
  const inventory=[];
  for(const base of ['factory','tests/factory'])for(const name of fs.readdirSync(join(repository,base),{recursive:true})){
    const path=join(base,name);if(fs.statSync(join(repository,path)).isFile()&&/\.(mjs|py|json)$/.test(path))inventory.push(path);
  }
  for(const base of ['reconstruction/verification','reconstruction/visualization'])
    for(const name of fs.readdirSync(join(repository,base)).filter(n=>n.endsWith('.mjs')))inventory.push(join(base,name));
  if(canonical(inventory.sort())!==canonical(Object.keys(suite.inputs).sort()))throw Error('Regression input set changed');
  const started=JSON.parse(fs.readFileSync(join(dirname(suitePath),'started.json')));
  if(canonical(started.inputs)!==canonical(suite.inputs)||started.startedAt!==suite.startedAt
    ||sha256(fs.readFileSync(join(dirname(suitePath),'results.tap')))!==suite.stdoutSha256
    ||sha256(fs.readFileSync(join(dirname(suitePath),'stderr.txt')))!==suite.stderrSha256)throw Error('Regression evidence integrity failed');
  const pins=Object.entries(suite.inputs).map(([path,hash])=>({path:join(repository,path),hash}));
  for(const name of ['run-live-native-selection-review.mjs','native-selection-review-harness.mjs','native-selection-review-cases.mjs','native-input-trial-acceptance.mjs'])
    if(!suite.inputs['reconstruction/verification/'+name])throw Error('Harness dependency absent from regression cut');
  for(const file of manifest.files.filter(f=>f.path.startsWith('factory/')&&/\.(mjs|py|json)$/.test(f.path)))
    if(suite.inputs[file.path]!==file.sha256)throw Error('Frozen runtime differs from regression');
  const frozen=()=>pins.every(p=>sha256(fs.readFileSync(p.path))===p.hash)&&verifyRuntimeRelease(runtimeRoot).releaseId===release.releaseId;
  if(!frozen())throw Error('Regression inputs have changed');
  const {CodexProvider}=await import(pathToFileURL(join(runtimeRoot,'factory/providers/codex.mjs')));
  const write=(name,value)=>writeDiagnostic(directory,name,value),controller=new AbortController(),stop=()=>controller.abort();
  const rows=[];let failure=null,liveCalls=0;
  write('qualification.json',{startedAt:new Date().toISOString(),release,pins,policy:selectionReviewPolicy,casesHash:sha256(cases),
    suite:{path:resolve(suitePath),hash:sha256(fs.readFileSync(suitePath)),counts:suite.counts},maxCalls:4,maxReviewRepairs:0,
    scope:'Four prospectively authored product reviews; all upstream planning/approval simulated. No rerun, installation, ordinary queue submission or general quality/efficiency claim.'});
  process.once('SIGTERM',stop);process.once('SIGINT',stop);
  try{
    for(const fixture of cases){
      if(controller.signal.aborted)throw Object.assign(Error('Interrupted'),{code:'ABORTED'});
      const caseDirectory=join(directory,fixture.id);fs.mkdirSync(caseDirectory,{mode:0o700});
      const result=await runNativeSelectionCase({runtimeRoot,directory:caseDirectory,fixture,frozen,signal:controller.signal,
        onEvent:event=>process.stdout.write(JSON.stringify({caseId:fixture.id,...event})+'\n'),
        reviewProviderFactory:()=>{if(liveCalls>=4)throw Object.assign(Error('Four-call ceiling'),{code:'EXPERIMENT_BOUNDARY'});liveCalls++;return new CodexProvider();}});
      rows.push(result);process.stdout.write(JSON.stringify({caseId:fixture.id,passed:result.passed,status:result.status,decision:result.review?.result.decision})+'\n');
      if(result.fatal){failure=result.fatal;break;}
    }
  }catch(error){failure={code:error.code??'UNKNOWN',at:new Date().toISOString()};write('failure.json',failure);}
  finally{process.removeListener('SIGTERM',stop);process.removeListener('SIGINT',stop);}
  const summary={completedAt:new Date().toISOString(),release,failure,liveCalls,completedCases:rows.length,
    passed:!failure&&rows.length===4&&rows.every(r=>r.passed)&&frozen(),results:rows.map(r=>({caseId:r.caseId,passed:r.passed,status:r.status,checks:r.checks,decision:r.review?.result.decision})),semanticAudit:'PENDING'};
  write('summary.json',summary);process.stdout.write(JSON.stringify({directory,...summary})+'\n');return summary;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const summary=await runLiveNativeSelectionReview(...process.argv.slice(2));process.exitCode=summary.passed?0:2;
}
