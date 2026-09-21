import test from 'node:test';
import assert from 'node:assert/strict';
import {Store} from '../../factory/lib/store.mjs';
import {MissionQueue} from '../../factory/lib/queue.mjs';
import {id} from '../../factory/lib/contracts.mjs';

// Real SQLite/queue/time decisions; the mission executor below is explicitly
// simulated. Full engine integration and native processes have separate tests.
function fixture(t,execute=async()=>({status:'COMPLETED',pending:[]})){
  let now=Date.parse('2026-09-09T12:00:00Z'),calls=0;const store=new Store(':memory:');
  const engine={store,active:null,create(intent,options){const mission={id:id('mission'),intent,options,status:'NEW',pending:[]};store.put('mission',mission.id,mission,{expectedVersion:0});return mission;},
    status(missionId){return {mission:store.get('mission',missionId).data};},
    setStatus(missionId,status,pending=[]){const row=store.get('mission',missionId);store.put('mission',missionId,{...row.data,status,pending},{expectedVersion:row.version});},
    cancel(missionId){this.setStatus(missionId,'CANCELLED');this.active.controller.abort();},
    async run(missionId,options){calls++;const controller=new AbortController();this.active={missionId,controller};
      try{const outcome=await execute({missionId,options,engine:this,controller});this.setStatus(missionId,outcome.status,outcome.pending);return this.status(missionId);}finally{this.active=null;}}
  };
  const config={engine,clock:()=>new Date(now).toISOString(),pollMs:5,retryBaseMs:1000,retryMaxMs:4000,maxAutomaticRetries:2};
  const queue=new MissionQueue(config);t.after(()=>{if(queue.owner)queue.release();store.close();});
  return {store,engine,queue,config,get calls(){return calls;},advance(ms){now+=ms;}};
}
// Direct Store mutation is used only to model a process-crash/corrupt-record
// recovery fixture.  Queue lifecycle writes are intentionally not public API.
function forgeJob(f,missionId,changes){
  const record=f.store.get('queue-job',missionId);
  return f.store.put('queue-job',missionId,{...record.data,...changes},{expectedVersion:record.version}).data;
}
test('queue submission is durable and idempotent by exact request/options, conflicting reuse rejected',t=>{
  const f=fixture(t),first=f.queue.submit('Exact request',{model:'fixture'},'submission:one');
  assert.deepEqual(f.queue.submit('Exact request',{model:'fixture'},'submission:one'),first);
  assert.equal(f.store.list('mission').length,1);assert.equal(f.queue.list().length,1);
  assert.throws(()=>f.queue.submit('Different request',{},'submission:one'),{code:'SUBMISSION_CONFLICT'});
  assert.equal(new MissionQueue(f.config).get(first.missionId).status,'QUEUED');
});
test('queue live owner cannot be stolen; release allows a new epoch',t=>{
  const f=fixture(t),first=f.queue.acquire();const second=new MissionQueue(f.config);
  assert.throws(()=>second.acquire(),{code:'QUEUE_BUSY'});f.queue.release();
  assert.equal(second.acquire().epoch,first.epoch+1);second.release();
  assert.throws(()=>f.queue.recover(),{code:'QUEUE_OWNERSHIP'});
});
test('queue quota retry time and finite automatic budget survive a new coordinator',async t=>{
  const f=fixture(t,async()=>({status:'WAITING_QUOTA',pending:[{code:'QUOTA'}]}));const job=f.queue.submit('Wait for actual quota');f.queue.acquire();
  assert.equal((await f.queue.runNext()).status,'RETRY_WAIT');assert.equal(f.calls,1);
  assert.equal(await f.queue.runNext(),null);f.advance(1000);
  assert.equal((await f.queue.runNext()).automaticRetries,2);assert.equal(f.calls,2);
  f.queue.release();const q=new MissionQueue(f.config);q.acquire();q.recover();
  assert.equal(await q.runNext(),null);f.advance(2000);
  assert.equal((await q.runNext()).lastCode,'AUTOMATIC_RETRY_BUDGET');assert.equal(f.calls,3);
  f.advance(100000);assert.equal(await q.runNext(),null);q.release();
  assert.equal(f.queue.get(job.missionId).status,'WAITING');
});
for(const status of ['FAILED','WAITING_PROVIDER'])
test('queue timeout finite retry policy preserves legacy and waiting states: '+status,async t=>{
  const f=fixture(t,async()=>({status,pending:[{code:'TIMEOUT'}]}));
  const job=f.queue.submit('Keep timeout attempts bounded and durable');f.queue.acquire();
  const first=await f.queue.runNext();assert.equal(first.status,'RETRY_WAIT');
  assert.equal(first.lastMissionStatus,status);assert.equal(first.lastCode,'TIMEOUT');assert.equal(first.automaticRetries,1);
  assert.equal(await f.queue.runNext(),null);f.advance(1000);
  assert.equal((await f.queue.runNext()).automaticRetries,2);f.queue.release();
  const replacement=new MissionQueue(f.config);replacement.acquire();
  try{replacement.recover();assert.equal(await replacement.runNext(),null);f.advance(2000);
    const exhausted=await replacement.runNext();assert.equal(exhausted.status,'WAITING');
    assert.equal(exhausted.lastCode,'AUTOMATIC_RETRY_BUDGET');assert.equal(exhausted.automaticRetries,3);
    f.advance(100000);assert.equal(await replacement.runNext(),null);assert.equal(f.calls,3);
    assert.equal(replacement.get(job.missionId).lastMissionStatus,status);
  }finally{replacement.release();}
});

test('queue missing authority or uncertain effect never enters blind timed retries',async t=>{
  for(const [status,code]of [['WAITING_CAPABILITY','AUTH'],['NEEDS_DIRECTION','EFFECT_UNCERTAIN'],['NEEDS_DIRECTION','METHODS_EXHAUSTED']]){
    const f=fixture(t,async()=>({status,pending:[{code}]}));f.queue.submit(code);f.queue.acquire();
    assert.equal((await f.queue.runNext()).status,'WAITING');f.advance(999999);assert.equal(await f.queue.runNext(),null);assert.equal(f.calls,1);
  }
});
test('queue pause, explicit continuation and queued cancellation are durable without provider calls',async t=>{
  const f=fixture(t),job=f.queue.submit('Pause before dispatch');f.queue.acquire();
  assert.equal(f.queue.request(job.missionId,'pause').status,'PAUSED');assert.equal(await f.queue.runNext(),null);
  assert.equal(f.queue.request(job.missionId,'continue').status,'QUEUED');
  assert.equal(f.queue.request(job.missionId,'cancel').status,'CANCELLED');assert.equal(await f.queue.runNext(),null);assert.equal(f.calls,0);
  assert.equal(f.engine.status(job.missionId).mission.status,'CANCELLED');
  assert.throws(()=>f.queue.request(job.missionId,'continue'),{code:'QUEUE_TERMINAL'});
});
test('queue graceful shutdown pauses engine, retains RUN intent and costs no retry',async t=>{
  let started;const ready=new Promise(r=>started=r);
  const f=fixture(t,async({options})=>{assert.equal(options.pauseOnAbort,true);started();await new Promise(r=>options.signal.addEventListener('abort',r,{once:true}));return {status:'PAUSED',pending:[{code:'CANCELLED'}]};});
  const job=f.queue.submit('Continue across process shutdown'),stop=new AbortController();f.queue.acquire();
  const pending=f.queue.runNext({signal:stop.signal});await ready;stop.abort();const result=await pending;
  assert.equal(result.status,'QUEUED');assert.equal(result.desired,'RUN');assert.equal(result.automaticRetries,0);
  assert.equal(f.engine.status(job.missionId).mission.status,'PAUSED');
});
test('queue pause request during execution is observed without confusing it with shutdown',async t=>{
  let started;const ready=new Promise(r=>started=r);
  const f=fixture(t,async({options})=>{started();await new Promise(r=>options.signal.addEventListener('abort',r,{once:true}));return {status:'PAUSED',pending:[]};});
  const job=f.queue.submit('Pause in flight');f.queue.acquire();const pending=f.queue.runNext();await ready;
  assert.equal(f.queue.request(job.missionId,'pause').desired,'PAUSE');assert.equal((await pending).status,'PAUSED');
});
test('queue crash recovery preserves terminal results and does not erase explicit pause/cancel',t=>{
  const f=fixture(t);f.queue.acquire();
  for(const desired of ['RUN','PAUSE','CANCEL']){const job=f.queue.submit(desired);forgeJob(f,job.missionId,{status:'RUNNING',desired});}
  const completed=f.queue.submit('completed before queue commit');forgeJob(f,completed.missionId,{status:'RUNNING'});f.engine.setStatus(completed.missionId,'COMPLETED');
  f.queue.recover();assert.deepEqual(f.queue.list().map(j=>j.status).sort(),['CANCELLED','COMPLETED','PAUSED','QUEUED']);
});
test('queue late cancel intent is honored after engine cleanup and cannot erase uncertain-effect diagnosis',async t=>{
  let f;f=fixture(t,async({missionId})=>{
    forgeJob(f,missionId,{desired:'CANCEL'});
    return {status:'NEEDS_DIRECTION',pending:[{code:'EFFECT_UNCERTAIN'}]};
  });
  const job=f.queue.submit('Cancel exact mission');f.queue.acquire();
  const result=await f.queue.runNext();
  assert.equal(result.status,'CANCELLED');assert.equal(f.engine.status(job.missionId).mission.pending[0].code,'EFFECT_UNCERTAIN');
});
