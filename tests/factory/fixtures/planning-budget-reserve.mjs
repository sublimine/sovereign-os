// Own isolated budget-contention fixture, never a provider or production CLI.
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {Store} from '../../../factory/lib/store.mjs';
import {Authority} from '../../../factory/lib/authority.mjs';
import {ArtifactRegistry} from '../../../factory/lib/artifacts.mjs';
import {reservePlanningInspection} from '../../../factory/lib/planning-inspection-budget.mjs';
const [directory,runId,inputPath]=process.argv.slice(2),store=new Store(join(directory,'state.sqlite'));
try{
  const registry=new ArtifactRegistry(store,new Authority(store));
  reservePlanningInspection(registry,{runId,request:JSON.parse(readFileSync(inputPath,'utf8'))});
}catch(error){
  // Under the lifecycle barrier a concurrent actor can be stopped either by
  // the immutable ceiling or, earlier, because the winning reservation has no
  // closed durable disposition yet. Both outcomes prove that no second
  // prospective dispatch was recorded.
  if(['PLANNING_INSPECTION_LIMIT','CLEANUP_UNCONFIRMED'].includes(error.code))process.exitCode=86;
  else throw error;
}
finally{store.close();}
