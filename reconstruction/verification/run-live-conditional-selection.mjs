import * as fs from 'node:fs';
import {join,resolve,dirname} from 'node:path';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {sha256,canonical} from '../../factory/lib/contracts.mjs';
import {verifyRuntimeRelease} from '../../factory/lib/runtime-release.mjs';
import {assertPassingRegression} from './regression-disposition.mjs';
import {conditionalSelectionCases as cases,conditionalSelectionCriteria as criteria} from './conditional-selection-cases.mjs';
import {runConditionalSelectionCase,conditionalSelectionPolicy as policy,writeConditionalDiagnostic} from './conditional-selection-harness.mjs';

export async function runLiveConditionalSelection(directory,runtimeRoot,suitePath){
  if(!directory||!runtimeRoot||!suitePath||fs.readdirSync(directory).length)throw Error('Fresh empty output, frozen runtime and passing regression required');
  const release=verifyRuntimeRelease(runtimeRoot),manifest=JSON.parse(fs.readFileSync(join(runtimeRoot,'RELEASE.json')));
  const suite=JSON.parse(fs.readFileSync(suitePath));assertPassingRegression(suite);
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
  const pins=Object.entries(suite.inputs).map(([path,hash])=>({path:join(repository,path),hash}));
  for(const name of ['run-live-conditional-selection.mjs','conditional-selection-harness.mjs','conditional-selection-cases.mjs'])
    if(!suite.inputs['reconstruction/verification/'+name])throw Error('Diagnostic harness not pinned');
  for(const file of manifest.files.filter(f=>f.path.startsWith('factory/')&&/\.(mjs|py|json)$/.test(f.path)))
    if(suite.inputs[file.path]!==file.sha256)throw Error('Runtime not covered by regression');
  const frozen=()=>pins.every(p=>sha256(fs.readFileSync(p.path))===p.hash)&&verifyRuntimeRelease(runtimeRoot).releaseId===release.releaseId;
  if(!frozen())throw Error('Regression inputs changed');
  const {CodexProvider}=await import(pathToFileURL(join(runtimeRoot,'factory/providers/codex.mjs')));
  const write=(name,value)=>writeConditionalDiagnostic(directory,name,value),controller=new AbortController(),stop=()=>controller.abort();
  write('qualification.json',{startedAt:new Date().toISOString(),release,pins,policy,casesHash:sha256(cases),criteriaHash:sha256(criteria),
    suite:{path:resolve(suitePath),hash:sha256(fs.readFileSync(suitePath)),counts:suite.counts},maxCalls:2,maxRepairs:0,
    scope:'New conditional-diagnostic objective. Two real assessments max, four simulated upstream stages, native copies, no product acceptance, installation, purchases or ordinary submission. Not a broad holdout or end-to-end real-workflow qualification.'});
  let liveCalls=0,failure=null;const rows=[];process.once('SIGTERM',stop);process.once('SIGINT',stop);
  try{
    for(const fixture of cases){
      if(controller.signal.aborted)throw Object.assign(Error('Interrupted'),{code:'ABORTED'});
      const caseDirectory=join(directory,fixture.id);fs.mkdirSync(caseDirectory,{mode:0o700});
      const result=await runConditionalSelectionCase({runtimeRoot,directory:caseDirectory,fixture,frozen,signal:controller.signal,
        onEvent:event=>process.stdout.write(JSON.stringify({caseId:fixture.id,...event})+'\n'),
        assessmentProviderFactory:()=>{if(liveCalls>=2)throw Object.assign(Error('Two-call ceiling'),{code:'EXPERIMENT_BOUNDARY'});liveCalls++;return new CodexProvider();}});
      rows.push(result);process.stdout.write(JSON.stringify({caseId:fixture.id,passed:result.passed,checks:result.checks,fatal:result.fatal})+'\n');
      if(result.fatal){failure=result.fatal;break;}
    }
  }catch(error){failure={code:error.code??'UNKNOWN',at:new Date().toISOString()};write('failure.json',failure);}
  finally{process.removeListener('SIGTERM',stop);process.removeListener('SIGINT',stop);}
  const summary={completedAt:new Date().toISOString(),release,failure,liveCalls,completedCases:rows.length,
    passed:!failure&&rows.length===2&&rows.every(r=>r.passed)&&frozen(),results:rows.map(r=>({caseId:r.caseId,missionId:r.missionId,passed:r.passed,checks:r.checks,fatal:r.fatal})),
    operationalAcceptance:false,semanticAudit:'PENDING'};
  write('summary.json',summary);process.stdout.write(JSON.stringify({directory,...summary})+'\n');return summary;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const summary=await runLiveConditionalSelection(...process.argv.slice(2));process.exitCode=summary.passed?0:2;
}
