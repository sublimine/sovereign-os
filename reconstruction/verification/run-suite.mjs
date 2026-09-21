// Ordinary regression: does not enable subscription tests or install services.
import * as fs from 'node:fs';
import {join,resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {sha256} from '../../factory/lib/contracts.mjs';
import {captureRegressionProcess} from './capture-regression-process.mjs';
import {archiveRegressionInputs,verifyRegressionInputArchive,assertCurrentRegressionInputs} from './regression-input-archive.mjs';
const here=dirname(fileURLToPath(import.meta.url)),repository=resolve(here,'../..');
const testFiles=fs.readdirSync(join(repository,'tests/factory')).filter(n=>n.endsWith('.test.mjs')).sort().map(n=>'tests/factory/'+n);
const inputs={};
for(const base of ['factory','tests/factory'])for(const name of fs.readdirSync(join(repository,base),{recursive:true})){
  const path=join(base,name),absolute=join(repository,path);if(fs.statSync(absolute).isFile()&&/\.(mjs|py|json)$/.test(path))inputs[path]=sha256(fs.readFileSync(absolute));
}
// Pin external oracle modules imported by the test suite as well as the runtime.
// These files are inputs, not a claim that every live harness was executed.
for(const name of fs.readdirSync(here).filter(n=>n.endsWith('.mjs'))){const path='reconstruction/verification/'+name;inputs[path]=sha256(fs.readFileSync(join(here,name)));}
// The closed-evidence projection is imported by regression tests. Pin the
// presentation helpers too; test evidence must include all of its local inputs.
for(const name of fs.readdirSync(join(repository,'reconstruction/visualization')).filter(n=>n.endsWith('.mjs'))){const path='reconstruction/visualization/'+name;inputs[path]=sha256(fs.readFileSync(join(repository,path)));}
const root=join(here,'runs');fs.mkdirSync(root,{recursive:true});
const directory=fs.mkdtempSync(join(root,'suite-'));
const env={...process.env,SOVEREIGN_CODEX_LIVE_SMOKE:'0',NO_COLOR:'1'};
// Native isolation and package tests share this VPS with interactive work.
// Bounded test-file concurrency avoids launching every OS fixture at once.
const concurrency=Number(process.env.SOVEREIGN_TEST_CONCURRENCY??2);
if(!Number.isInteger(concurrency)||concurrency<1||concurrency>4)throw Error('Test concurrency must be 1..4');
const args=['--test',`--test-concurrency=${concurrency}`,'--test-reporter=tap',...testFiles];
const startedAt=new Date().toISOString();
const inputArchive=archiveRegressionInputs({repository,inputs,directory:join(directory,'input-archive')});
fs.writeFileSync(join(directory,'started.json'),JSON.stringify({startedAt,command:[process.execPath,...args],inputs,inputArchive,
  scope:'Prospective inputs only, not a test result. Partial streams survive interruption; no summary means no completed regression.'},null,2),{flag:'wx',mode:0o600});
const {stdout,stderr,interruptedBy,...outcome}=await captureRegressionProcess({command:process.execPath,args,cwd:repository,env,directory});
const counts=Object.fromEntries([...stdout.matchAll(/^# (tests|suites|pass|fail|cancelled|skipped|todo|duration_ms) ([\d.]+)$/gm)].map(m=>[m[1],Number(m[2])]));
let inputsStillMatch=false,inputArchiveVerified=false;const inputIntegrityErrors=[];
try{verifyRegressionInputArchive({directory:inputArchive.directory,inputs,manifestSha256:inputArchive.manifestSha256});inputArchiveVerified=true;}
catch(error){inputIntegrityErrors.push({check:'archive',code:error.code??'UNKNOWN',message:error.message});}
try{assertCurrentRegressionInputs({repository,inputs});inputsStillMatch=true;}
catch(error){inputIntegrityErrors.push({check:'current-inputs',code:error.code??'UNKNOWN',message:error.message});}
const result={startedAt,completedAt:new Date().toISOString(),node:process.version,scope:'Factory regression with live model smoke explicitly disabled; native VPS execution tests are real',
  command:[process.execPath,...args],...outcome,interruptedBy,counts,inputs,inputArchive,inputsStillMatch,inputArchiveVerified,inputIntegrityErrors,
  stdoutSha256:sha256(stdout),stderrSha256:sha256(stderr)};
fs.writeFileSync(join(directory,'results.tap'),stdout,{flag:'wx'});fs.writeFileSync(join(directory,'stderr.txt'),stderr,{flag:'wx'});
fs.writeFileSync(join(directory,'summary.json'),JSON.stringify(result,null,2),{flag:'wx'});
process.stdout.write(JSON.stringify({directory,...outcome,counts,inputArchive,inputsStillMatch,inputArchiveVerified,inputIntegrityErrors})+'\n');
process.exitCode=!interruptedBy&&outcome.exitCode===0&&counts.fail===0&&inputsStillMatch&&inputArchiveVerified?0:1;
