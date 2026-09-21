// Own isolated crash fixture: no provider, network, credentials or service.
// exit(86) deliberately bypasses engine and SQLite cleanup at exact boundaries.
import {join} from 'node:path';
import {FactoryEngine} from '../../../factory/lib/engine.mjs';
import {inferenceRequestHash} from '../../../factory/providers/instruction-profiles.mjs';
const [directory,missionId,phase,planJson]=process.argv.slice(2);
if(!['reservation-committed','response-uncommitted','cleanup-uncommitted','cleanup-committed','inspection-committed','step-committed','plan-committed','candidate-committed'].includes(phase))throw Error('Exact own-fixture crash phase required');
const engine=new FactoryEngine({databasePath:join(directory,'state.sqlite'),workspaceRoot:join(directory,'workspaces')});let calls=0;
engine.workers.providerFactory=()=>({async generate(request){
  if(!Object.hasOwn(request.schema.properties,'plan'))throw Error('Crash fixture must stop before any nonplanning inference');
  calls++;const value=calls===1?{action:'inspect',roleIds:['omega_02','omega_03'],reason:'Read the complete contracts before assignment.',plan:null}
    :{action:'plan',roleIds:[],reason:'',plan:JSON.parse(planJson)};
  await request.validate(value);
  return {value,receipt:{simulation:true,status:'completed',threadId:'crash-inspection:'+calls,turnId:'fixture',contextHash:inferenceRequestHash(request)}};
},async close(){}});
const append=engine.store.append.bind(engine.store),put=engine.store.put.bind(engine.store),transact=engine.store.transact.bind(engine.store),infer=engine.workers.infer.bind(engine.workers),create=engine.registry.create.bind(engine.registry);
let cleanupCommittedCrash=false;
// `planning-provider-cleanup` is committed by its own synchronous outer
// transaction.  Exit only after that outer transaction returns, rather than
// from its nested `put`, so this phase proves the post-COMMIT recovery path.
engine.store.transact=fn=>{
  const before=phase==='cleanup-committed'&&!engine.store.db.isTransaction?engine.store.list('planning-provider-cleanup').length:null;
  const result=transact(fn);
  if(before!==null&&!cleanupCommittedCrash&&!engine.store.db.isTransaction&&engine.store.list('planning-provider-cleanup').length===before+1){
    cleanupCommittedCrash=true;process.exit(86);
  }
  return result;
};
engine.store.append=(kind,...args)=>{
  if(kind==='worker.inference.dispatched'&&phase==='reservation-committed'){
    if(engine.store.db.isTransaction)throw Error('Reservation must already be committed');process.exit(86);
  }
  return append(kind,...args);
};
engine.store.put=(type,...args)=>{
  if(type==='planning-inspection-response'&&phase==='response-uncommitted'){
    if(!engine.store.db.isTransaction)throw Error('Message must share the receipt transaction');process.exit(86);
  }
  if(type==='planning-provider-cleanup'&&phase==='cleanup-uncommitted'){
    if(!engine.store.db.isTransaction)throw Error('Cleanup must share its own atomic transaction');process.exit(86);
  }
  if(type==='planning-inspection-step'&&phase==='inspection-committed')process.exit(86);
  return put(type,...args);
};
engine.workers.infer=(...args)=>{
  if(phase==='step-committed'&&engine.store.list('planning-inspection-step').length){
    if(engine.store.db.isTransaction)throw Error('Local step must already be committed');process.exit(86);
  }
  return infer(...args);
};
engine.registry.create=options=>{
  if(options.nodeId==='planning'&&phase==='plan-committed')process.exit(86);
  const candidate=create(options);if(options.nodeId==='planning'&&phase==='candidate-committed')process.exit(86);return candidate;
};
try{const result=await engine.run(missionId);throw Error('Expected crash was not reached: '+JSON.stringify(result.mission.pending));}
finally{engine.close();}
