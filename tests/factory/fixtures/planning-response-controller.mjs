// Own isolated fixture process. No real provider, network, credentials or
// service. process.exit deliberately skips all engine/SQLite cleanup.
import {join} from 'node:path';
import {FactoryEngine} from '../../../factory/lib/engine.mjs';
import {inferenceRequestHash} from '../../../factory/providers/instruction-profiles.mjs';
const [directory,missionId,phase,planJson]=process.argv.slice(2);
if(!['origin-committed','response-uncommitted','cleanup-uncommitted','cleanup-committed','candidate-committed'].includes(phase))throw Error('Known own-test crash phase required');
const engine=new FactoryEngine({databasePath:join(directory,'state.sqlite'),workspaceRoot:join(directory,'workspaces')});
engine.workers.providerFactory=()=>({async generate(request){
  if(!Object.hasOwn(request.schema.properties,'requirements'))throw Error('Test must stop before any nonplanning inference');
  const value=JSON.parse(planJson);await request.validate(value);
  return {value,receipt:{simulation:true,status:'completed',threadId:'sim-planning-crash',turnId:'test',
    contextHash:inferenceRequestHash(request),model:request.model,reasoningEffort:request.reasoningEffort}};
},async close(){}});
const append=engine.store.append.bind(engine.store),put=engine.store.put.bind(engine.store),transact=engine.store.transact.bind(engine.store);
let cleanupCommittedCrash=false;
// The nested cleanup put is still inside the outer transaction.  Crash only
// after the outer transaction returns, which is the first post-COMMIT point.
engine.store.transact=fn=>{
  const before=phase==='cleanup-committed'&&!engine.store.db.isTransaction?engine.store.list('planning-provider-cleanup').length:null;
  const result=transact(fn);
  if(before!==null&&!cleanupCommittedCrash&&!engine.store.db.isTransaction&&engine.store.list('planning-provider-cleanup').length===before+1){
    cleanupCommittedCrash=true;process.exit(86);
  }
  return result;
};
engine.store.append=(kind,...args)=>{
  if(kind==='worker.inference.dispatched'&&phase==='origin-committed'){
    if(engine.store.db.isTransaction)throw Error('Planning origin must already be committed');process.exit(86);
  }
  return append(kind,...args);
};
engine.store.put=(type,...args)=>{
  if(type==='planning-response'&&phase==='response-uncommitted'){
    if(!engine.store.db.isTransaction)throw Error('The completion receipt must share the response transaction');
    process.exit(86);
  }
  if(type==='planning-provider-cleanup'&&phase==='cleanup-uncommitted'){
    if(!engine.store.db.isTransaction)throw Error('Cleanup must share its own atomic transaction');process.exit(86);
  }
  return put(type,...args);
};
const create=engine.registry.create.bind(engine.registry);
engine.registry.create=options=>{
  const candidate=create(options);
  if(options.nodeId==='planning'&&phase==='candidate-committed')process.exit(86);
  return candidate;
};
try{const r=await engine.run(missionId);throw Error('Expected crash boundary was not reached: '+JSON.stringify(r.mission.pending));}
finally{engine.close();}
