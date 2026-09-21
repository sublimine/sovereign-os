// Real process/SQLite crash fixture. It never starts a model or public search.
import {join} from 'node:path';
import {FactoryEngine} from '../../../factory/lib/engine.mjs';
import {inferenceRequestHash} from '../../../factory/providers/instruction-profiles.mjs';
const [directory,mode]=process.argv.slice(2);
const e=new FactoryEngine({databasePath:join(directory,'state.sqlite'),workspaceRoot:join(directory,'jobs')});
const mission=e.store.list('mission')[0].data;
const die=()=>process.kill(process.pid,'SIGKILL');
e.workers.providerFactory=()=>({async generate(request){
  if(mode==='worker-after-commit')die();
  const value={ok:true};await request.validate(value);
  return {value,receipt:{status:'completed',simulation:true,threadId:`crash-worker:${process.pid}`,turnId:'turn',model:request.model,
    reasoningEffort:request.reasoningEffort,contextHash:inferenceRequestHash(request)}};
},async close(){}});
const run=e.workers.createRun({missionId:mission.id,nodeId:`review:crash:${mode}`,mode:'reviewer',purpose:'delivery',roleIds:['omega_03']});
if(mode.endsWith('before-commit')){
  const put=e.store.put.bind(e.store);e.store.put=(type,...args)=>{const r=put(type,...args);if(type==='mission-inference-call')die();return r;};
}
try{
  if(mode.startsWith('search')){
    e.broker.searchProvider={async search(){if(mode==='search-after-commit')die();throw Error('Search must not execute in this fixture');}};
    await e.workers.tool(run.id,'source.search',{query:'Public synthetic test query',limit:1},'crash-search');
  }else{
    await e.workers.infer({runId:run.id,instructions:'bounded test instructions',input:'Exact synthetic input',
      schema:{type:'object',properties:{ok:{type:'boolean'}},required:['ok'],additionalProperties:false},validate:value=>value.ok===true});
  }
}catch(error){if(error.code==='INFERENCE_BUDGET_EXHAUSTED')process.exitCode=86;else throw error;}
finally{e.close();}
