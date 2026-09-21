// Two actual processes, not two calls in one engine; no retry or waiver on failure.
import * as fs from 'node:fs';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {join,resolve} from 'node:path';
import {createHash} from 'node:crypto';
const directory=process.argv[2],script=fileURLToPath(new URL('./run-live-production-recovery.mjs',import.meta.url));
if(process.argv.length!==3||!directory||!fs.statSync(directory).isDirectory()||fs.readdirSync(directory).length)throw Error('New empty qualification directory required');
const scriptHash=createHash('sha256').update(fs.readFileSync(script)).digest('hex');
let current,stopping=false;
const stop=()=>{stopping=true;current?.kill('SIGTERM');};
process.once('SIGINT',stop);process.once('SIGTERM',stop);
const phases=[];
try{
  for(const args of [[directory],[directory,'--resume']]){
    if(stopping)break;
    if(createHash('sha256').update(fs.readFileSync(script)).digest('hex')!==scriptHash)throw Error('Qualification harness changed between phases');
    current=spawn(process.execPath,[script,...args],{env:process.env,stdio:['ignore','inherit','inherit']});
    const outcome=await new Promise((resolve,reject)=>{current.once('error',reject);current.once('close',(code,signal)=>resolve({pid:current.pid,code,signal}));});
    phases.push({phase:args.length===1?'interrupt':'resume',...outcome});current=null;
    if(outcome.code!==0){process.exitCode=outcome.code??1;break;}
  }
}finally{
  process.removeListener('SIGINT',stop);process.removeListener('SIGTERM',stop);
  const result={capturedAt:new Date().toISOString(),directory:resolve(directory),parentPID:process.pid,script,scriptHash,
    runtimeRoot:process.env.SOVEREIGN_QUALIFICATION_RUNTIME??null,stopping,phases};
  fs.writeFileSync(join(directory,'process-pair.json'),JSON.stringify(result,null,2),{flag:'wx',mode:0o600});
  process.stdout.write(JSON.stringify(result)+'\n');
}
