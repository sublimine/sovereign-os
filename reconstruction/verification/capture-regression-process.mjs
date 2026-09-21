import * as fs from 'node:fs';
import {spawn} from 'node:child_process';
import {join} from 'node:path';

// The parent owns only this child. Preserve raw partial bytes immediately and
// decode after completion, never independently decode arbitrary UTF-8 chunks.
export async function captureRegressionProcess({command,args,cwd,env,directory,killAfterMs=5000}){
  if(!Number.isSafeInteger(killAfterMs)||killAfterMs<1)throw Error('Positive drain timeout required');
  const stdoutFd=fs.openSync(join(directory,'results.partial.tap'),'wx',0o600);
  let stderrFd,child,killTimer,interruptedBy=null,streamError=null;
  const stdout=[],stderr=[];
  const stop=signal=>{
    if(interruptedBy)return;interruptedBy=signal;
    if(child?.pid&&child.exitCode===null&&child.signalCode===null)child.kill(signal);
    killTimer=setTimeout(()=>{if(child?.pid&&child.exitCode===null&&child.signalCode===null)child.kill('SIGKILL');},killAfterMs);
    killTimer.unref();
  };
  const onTerm=()=>stop('SIGTERM'),onInt=()=>stop('SIGINT');
  const retain=(fd,chunks,bytes)=>{
    try{
      for(let offset=0;offset<bytes.length;){const n=fs.writeSync(fd,bytes,offset,bytes.length-offset);if(n<1)throw Error('Partial stream made no write progress');offset+=n;}
      chunks.push(bytes);
    }catch(error){streamError??=error;stop('SIGTERM');}
  };
  try{
    stderrFd=fs.openSync(join(directory,'stderr.partial.txt'),'wx',0o600);
    child=spawn(command,args,{cwd,env,stdio:['ignore','pipe','pipe']});
    process.once('SIGTERM',onTerm);process.once('SIGINT',onInt);
    child.stdout?.on('data',bytes=>retain(stdoutFd,stdout,bytes));
    child.stderr?.on('data',bytes=>retain(stderrFd,stderr,bytes));
    let launchError;
    const outcome=await new Promise(resolve=>{
      child.once('error',error=>{launchError=error;});
      child.once('close',(exitCode,signal)=>resolve({exitCode,signal}));
    });
    if(launchError)throw launchError;if(streamError)throw streamError;
    return {...outcome,interruptedBy,stdout:Buffer.concat(stdout).toString('utf8'),stderr:Buffer.concat(stderr).toString('utf8')};
  }finally{
    clearTimeout(killTimer);process.removeListener('SIGTERM',onTerm);process.removeListener('SIGINT',onInt);
    fs.closeSync(stdoutFd);if(stderrFd!==undefined)fs.closeSync(stderrFd);
  }
}
