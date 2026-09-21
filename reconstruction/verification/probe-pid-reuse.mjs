// Counterexample against an exact frozen runtime; no production database writes.
import * as fs from 'node:fs';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {verifyRuntimeRelease} from '../../factory/lib/runtime-release.mjs';
import {sha256} from '../../factory/lib/contracts.mjs';
const [runtimeRoot,output]=process.argv.slice(2);
if(!runtimeRoot||!output)throw Error('Frozen runtime and new evidence output required');
const release=verifyRuntimeRelease(runtimeRoot),load=p=>import(pathToFileURL(join(release.directory,p)));
const {Store}=await load('factory/lib/store.mjs'),{PlanLedger}=await load('factory/lib/plans.mjs');
const {MissionQueue}=await load('factory/lib/queue.mjs'),{LearningConductor}=await load('factory/lib/learning-conductor.mjs');
const results=[];
for(const type of ['engine','queue-owner','learning-owner']){
  const store=new Store(':memory:');
  try{
    // Synthetic record of a previous boot with a PID now occupied by this probe.
    store.put(type,'exclusive',{ownerId:'previous-process',pid:process.pid,epoch:1,
      processIdentity:{pid:process.pid,bootId:'00000000-0000-0000-0000-000000000000',startTicks:'1'}},{expectedVersion:0});
    let error=null;
    try{
      if(type==='engine')new PlanLedger(store,{registry:{assertUsable(){}}}).acquireEngine({ownerId:'new-owner'});
      if(type==='queue-owner')new MissionQueue({engine:{store,run(){throw Error('Must not execute');}}}).acquire();
      if(type==='learning-owner')new LearningConductor({service:{store,authority:{}},providerFactory:()=>{throw Error('Must not infer');}}).acquire();
    }catch(e){error=e.code??'INTERNAL';}
    results.push({type,error,reclaimed:error===null,epoch:store.get(type,'exclusive').data.epoch});
  }finally{store.close();}
}
const result={capturedAt:new Date().toISOString(),release,harnessHash:sha256(fs.readFileSync(new URL(import.meta.url))),results,
  scope:'Real in-memory SQLite and live self PID; explicitly synthetic previous-boot owner records. No OS reboot, actual PID reuse, task execution, model calls or production modifications.'};
fs.writeFileSync(output,JSON.stringify(result,null,2),{flag:'wx',mode:0o600});console.log(JSON.stringify(result));
