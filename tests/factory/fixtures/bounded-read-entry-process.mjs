import fs from 'node:fs';import {join} from 'node:path';
import {FactoryEngine} from '../../../factory/lib/engine.mjs';
import {BOUNDED_READ_MODE} from '../../../factory/lib/bounded-read-spec.mjs';
import {captureProcessIdentity} from '../../../factory/lib/process-identity.mjs';
import {boundedReadSimulation} from './bounded-read-simulation.mjs';
const [directory,boundary]=process.argv.slice(2);
const boundaries=['before-entry-contract-commit','after-entry-contract-commit','after-read-prepared','after-read-dispatched','after-read-receipt',
  'after-producer-final-cleanup','after-candidate-commit','after-entry-review-checkpoint','after-review-commit','before-delivery-commit','after-delivery-commit'];
if(!directory||!boundaries.includes(boundary))throw Error('Exact fixture directory and boundary required');
const engine=new FactoryEngine({databasePath:join(directory,'state.sqlite'),workspaceRoot:join(directory,'workspaces')});
const mission=engine.create('Read input.txt and derive the sum of its supplied integers. Return text only, without external facts or effects.',
  {entryMode:BOUNDED_READ_MODE,allowedTools:['workspace.read'],producerBatch:'read-test-cursor-v1',inferenceBudget:{mode:'mission-calls-v1',maxCalls:3}});
fs.writeFileSync(join(engine.broker.registerWorkspace(mission.id).path,'input.txt'),'13\n17\n',{flag:'wx',mode:0o600});
const owner=captureProcessIdentity(),counts=boundedReadSimulation(engine,'child');let pending=false;
const kill=()=>{fs.writeFileSync(join(directory,'cut.json'),JSON.stringify({owner,missionId:mission.id,boundary,calls:counts.calls,closes:counts.closes,
  at:new Date().toISOString(),transactionOpen:engine.store.db.isTransaction}),{flag:'wx',mode:0o600});process.kill(process.pid,'SIGKILL');};
const put=engine.store.put.bind(engine.store),transact=engine.store.transact.bind(engine.store),append=engine.store.append.bind(engine.store);
engine.store.transact=fn=>{const outer=!engine.store.db.isTransaction,result=transact(fn);if(outer&&pending)kill();return result;};
engine.store.put=(type,id,data,options)=>{
  const result=put(type,id,data,options);
  if(boundary==='before-entry-contract-commit'&&type==='bounded-read-contract')kill();
  if(boundary==='after-entry-contract-commit'&&type==='bounded-read-entry'&&data.status==='PRODUCING')pending=true;
  if(type==='effect'&&data.tool==='workspace.read'){
    if(boundary==='after-read-prepared'&&data.state==='PREPARED')pending=true;
    if(boundary==='after-read-dispatched'&&data.state==='DISPATCHED')pending=true;
    if(boundary==='after-read-receipt'&&data.state==='SUCCEEDED')pending=true;
  }
  if(boundary==='after-candidate-commit'&&type==='artifact'&&data.payload.kind==='bounded-read-response'&&data.status==='CANDIDATE'){
    if(engine.store.db.isTransaction)pending=true;else kill();
  }
  if(boundary==='after-entry-review-checkpoint'&&type==='bounded-read-entry'&&data.status==='REVIEW_PENDING'){
    if(engine.store.db.isTransaction)pending=true;else kill();
  }
  if(boundary==='after-review-commit'&&type==='artifact'&&data.payload.kind==='bounded-read-response'&&data.status==='ACCEPTED')pending=true;
  if(boundary==='before-delivery-commit'&&type==='bounded-read-entry'&&data.status==='ACCEPTED')kill();
  if(boundary==='after-delivery-commit'&&type==='bounded-read-entry'&&data.status==='ACCEPTED')pending=true;
  return result;
};
engine.store.append=(kind,data)=>{
  const result=append(kind,data);
  if(boundary==='after-producer-final-cleanup'&&kind==='worker.producer.cleanup.recorded'){
    const proposals=engine.store.list('worker-proposal').filter(r=>r.data.runId===data.runId);
    if(proposals.some(r=>r.data.value.action==='final')){if(engine.store.db.isTransaction)pending=true;else kill();}
  }return result;
};
await engine.run(mission.id);throw Error('Expected controlled process death did not occur');
