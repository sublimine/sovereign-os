// Explicit local crash fixture; simulated model, actual SQLite and SIGKILL.
import fs from 'node:fs';import {join} from 'node:path';
import {FactoryEngine} from '../../../factory/lib/engine.mjs';
import {inferenceRequestHash} from '../../../factory/providers/instruction-profiles.mjs';
import {captureProcessIdentity} from '../../../factory/lib/process-identity.mjs';
const [directory,boundary]=process.argv.slice(2);
if(!directory||!['before-response-commit','after-response-commit','before-cleanup-commit','after-cleanup-commit','before-candidate-commit','after-candidate-commit'].includes(boundary))throw Error('Exact fixture boundary required');
const engine=new FactoryEngine({databasePath:join(directory,'state.sqlite'),workspaceRoot:join(directory,'workspaces')});
const mission=engine.create('Preserve the original public final after an actual process death.',{allowedTools:[],inferenceBudget:{mode:'mission-calls-v1',maxCalls:1}});
const node={id:'answer',purpose:'bounded-result',roleIds:['omega_02'],reviewerRoleIds:['omega_03'],instructions:mission.intent,outputKind:'delivery',
  criteria:[{id:'result',text:'Deliver the exact retained response for independent review.'}],tools:[],requiredEffects:[]};
const actor=engine.workers.createRun({missionId:mission.id,nodeId:node.id,mode:'producer',purpose:node.purpose,roleIds:node.roleIds});
const args={missionId:mission.id,node,runId:actor.id,inputRefs:[]},value={action:'final',tool:'',argsJson:'',body:'Original child-process response',claims:[],method:'fixture-derived-result',reason:''};
fs.writeFileSync(join(directory,'fixture.json'),JSON.stringify({args,value,owner:captureProcessIdentity(),boundary}),{flag:'wx',mode:0o600});
engine.workers.providerFactory=()=>({async generate(request){await request.validate(value);return {value,receipt:{kind:'inference',simulation:true,status:'completed',
  threadId:'sim-child-thread',turnId:'sim-child-turn',model:request.model,reasoningEffort:request.reasoningEffort,contextHash:inferenceRequestHash(request)}};},async close(){}});
const kill=()=>process.kill(process.pid,'SIGKILL'),put=engine.store.put.bind(engine.store),append=engine.store.append.bind(engine.store);
let interrupted=false;
engine.store.put=(type,id,data,options)=>{
  const result=put(type,id,data,options);
  if(boundary==='before-response-commit'&&type==='worker-proposal')kill();
  if(boundary==='before-cleanup-commit'&&type==='producer-cleanup')kill();
  if(boundary==='before-candidate-commit'&&type==='artifact'&&data.payload.nodeId===node.id)kill();
  return result;
};
engine.store.append=(kind,data)=>{
  if(boundary==='after-cleanup-commit'&&kind==='worker.producer.cleanup.recorded'&&data.runId===actor.id)kill();
  if(kind==='worker.inference.completed'&&data.runId===actor.id){
    if(boundary==='after-response-commit')kill();
    if(boundary.includes('candidate')&&!interrupted){interrupted=true;throw Object.assign(Error('Prepare retained response for candidate crash boundary'),{code:'TIMEOUT'});}
  }
  const result=append(kind,data);return result;
};
if(boundary.includes('candidate')){
  try{await engine.workers.produce(args);}catch(error){if(error.code!=='TIMEOUT')throw error;}
  engine.workers.recoverFinal(args);
  if(boundary==='after-candidate-commit')kill();
}else await engine.workers.produce(args);
throw Error('Expected fixture process death did not occur');
