import fs from 'node:fs';import {join} from 'node:path';
import {FactoryEngine} from '../../../factory/lib/engine.mjs';
import {MissionQueue} from '../../../factory/lib/queue.mjs';
import {BOUNDED_READ_MODE} from '../../../factory/lib/bounded-read-spec.mjs';
import {captureProcessIdentity} from '../../../factory/lib/process-identity.mjs';
import {prepareMissionInputWorkspace} from '../../../factory/lib/mission-input-workspace.mjs';
const [directory,boundary]=process.argv.slice(2);
if(!directory||!boundary)throw Error('Exact fixture directory and boundary required');
const engine=new FactoryEngine({databasePath:join(directory,'state.sqlite'),workspaceRoot:join(directory,'workspaces')}),queue=new MissionQueue({engine});
const owner=captureProcessIdentity();let missionId;
const kill=()=>{fs.writeFileSync(join(directory,'cut.json'),JSON.stringify({owner,missionId,boundary,at:new Date().toISOString(),transactionOpen:engine.store.db.isTransaction}),{flag:'wx',mode:0o600});process.kill(process.pid,'SIGKILL');};
if(boundary==='submission.before-commit'){
  const put=engine.store.put.bind(engine.store);engine.store.put=(type,id,data,options)=>{const r=put(type,id,data,options);if(type==='queue-job'){missionId=data.missionId;kill();}return r;};
}
const job=queue.submit('Read input.txt and derive the sum from its supplied integers only. No writes or execution.',
  {entryMode:BOUNDED_READ_MODE,allowedTools:['workspace.read'],inputs:[{path:'input.txt',content:'13\n17\n',provenance:'original captured before submission'}]},'submission:crash-input');
missionId=job.missionId;if(boundary==='submission.committed')kill();
queue.acquire();
// Model a durable in-flight job after an abrupt coordinator transition.  This
// fixture writes the test Store directly because MissionQueue state mutation
// is deliberately coordinator-private.
const queued=engine.store.get('queue-job',missionId);
engine.store.put('queue-job',missionId,{...queued.data,status:'RUNNING'},{expectedVersion:queued.version});
prepareMissionInputWorkspace(engine.broker,missionId,{checkpoint:stage=>{if(stage===boundary)kill();}});
throw Error('Expected process death did not occur');
