// SIGKILL fixture: real process, SQLite and engine; no external model process.
import fs from 'node:fs';import {join} from 'node:path';
import {FactoryEngine} from '../../../factory/lib/engine.mjs';
import {captureProcessIdentity} from '../../../factory/lib/process-identity.mjs';
import {inferenceRequestHash} from '../../../factory/providers/instruction-profiles.mjs';
const [directory,mode,boundary]=process.argv.slice(2);
if(!directory||!['closed-response-v1','closed-response-v2'].includes(mode)
  ||!['before-response-commit','after-response-commit','before-cleanup-commit','after-cleanup-commit','before-candidate-commit','after-candidate-commit'].includes(boundary))throw Error('Exact fixture arguments');
const engine=new FactoryEngine({databasePath:join(directory,'state.sqlite'),workspaceRoot:join(directory,'workspace')});
const mission=engine.create('Calcula la media de 12, 7 y 5 sin ejecutar código.',{entryMode:mode,allowedTools:[],inferenceBudget:{mode:'mission-calls-v1',maxCalls:2}});
fs.writeFileSync(join(directory,'fixture.json'),JSON.stringify({owner:captureProcessIdentity(),missionId:mission.id,boundary,mode}),{flag:'wx',mode:0o600});
let count=0;engine.workers.providerFactory=()=>({async generate(request){
  if(++count!==1)throw Error('Only the original simulated producer may infer in the child');
  const value={action:'answer',body:'(12 + 7 + 5) / 3 = 8.',reason:'Complete closed arithmetic fixture.'};
  await request.validate(value);return {value,receipt:{kind:'inference',status:'completed',simulation:true,threadId:'sim-child-production',turnId:'sim-child-turn',
    model:request.model,reasoningEffort:request.reasoningEffort,contextHash:inferenceRequestHash(request)}};
},async close(){}});
const kill=()=>process.kill(process.pid,'SIGKILL'),put=engine.store.put.bind(engine.store),append=engine.store.append.bind(engine.store);
engine.store.put=(type,...args)=>{
  const result=put(type,...args);
  // Response and candidate put return inside the enclosing semantic transaction.
  if(boundary==='before-response-commit'&&type==='closed-entry-response'||boundary==='before-candidate-commit'&&type==='artifact'
    ||boundary==='after-cleanup-commit'&&type==='closed-entry-cleanup')kill();return result;
};
engine.store.append=(kind,data)=>{
  if(boundary==='after-response-commit'&&kind==='worker.inference.completed'
    ||boundary==='before-cleanup-commit'&&kind==='record.committed'&&data.type==='closed-entry-cleanup')kill();return append(kind,data);
};
if(boundary==='after-candidate-commit')engine.workers.review=async()=>kill();
const result=await engine.run(mission.id);throw Error('Expected real SIGKILL not reached: '+JSON.stringify(result.mission.pending));
