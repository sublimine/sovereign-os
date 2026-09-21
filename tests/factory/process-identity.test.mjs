import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {captureProcessIdentity,ownerProcessIsAlive,processIsAlive} from '../../factory/lib/process-identity.mjs';
import {Store} from '../../factory/lib/store.mjs';
import {PlanLedger} from '../../factory/lib/plans.mjs';
import {MissionQueue} from '../../factory/lib/queue.mjs';
import {LearningConductor} from '../../factory/lib/learning-conductor.mjs';

const bootA='00000000-0000-0000-0000-000000000001',bootB='00000000-0000-0000-0000-000000000002';
const owner={pid:77,processIdentity:{pid:77,bootId:bootA,startTicks:'1234'}};
function fixture({bootId=bootA,ticks='1234',state='S',readError=null,killError=null}={}){
  const signals=[];
  const read=path=>{if(readError)throw Object.assign(Error('Unreadable'),{code:readError});
    if(path==='/proc/sys/kernel/random/boot_id')return bootId+'\n';
    assert.equal(path,'/proc/77/stat');return '77 (a ) parenthesized (name)) '+state+' '+Array.from({length:19},(_,i)=>i===18?ticks:'0').join(' ');};
  const signal=(pid,value)=>{signals.push([pid,value]);if(killError)throw Object.assign(Error('signal'),{code:killError});};
  return {read,signal,signals};
}
test('process identity binds boot, PID and exact start ticks, including unusual comm names',()=>{
  const f=fixture();assert.deepEqual(captureProcessIdentity(77,f),owner.processIdentity);
  assert.equal(ownerProcessIsAlive(owner,f),true);assert.deepEqual(f.signals,[[77,0]]);
});
test('a reused PID or previous boot is not the original owner, despite successful signal zero',()=>{
  for(const patch of [{ticks:'1235'},{bootId:bootB},{state:'Z'},{state:'X'}]){
    const f=fixture(patch);assert.equal(ownerProcessIsAlive(owner,f),false);assert.deepEqual(f.signals,[[77,0]]);
  }
  const f=fixture({state:'T'});assert.equal(ownerProcessIsAlive(owner,f),true); // stopped is not dead
});
test('permission denied or unreadable proc never turns a live or legacy owner into a dead one',()=>{
  for(const patch of [{killError:'EPERM'},{readError:'EACCES'},{readError:'ENOENT'}])assert.equal(ownerProcessIsAlive(owner,fixture(patch)),true);
  assert.equal(ownerProcessIsAlive({pid:77},fixture({ticks:'9999',bootId:bootB})),true);
  assert.equal(ownerProcessIsAlive(owner,fixture({killError:'ESRCH'})),false);
  assert.throws(()=>ownerProcessIsAlive(owner,fixture({killError:'EINVAL'})),{code:'EINVAL'});
});
test('invalid stored identities or changing/newly dead capture fail closed',()=>{
  for(const identity of [{...owner.processIdentity,pid:78},{...owner.processIdentity,bootId:'not-boot'},{...owner.processIdentity,startTicks:'1x'}])
    assert.throws(()=>ownerProcessIsAlive({pid:77,processIdentity:identity},fixture()),{code:'PROCESS_IDENTITY'});
  assert.throws(()=>captureProcessIdentity(77,fixture({state:'Z'})),{code:'PROCESS_IDENTITY'});
  let calls=0;const f=fixture();assert.throws(()=>captureProcessIdentity(77,{read:path=>path.endsWith('/stat')&&++calls===2?fixture({ticks:'99'}).read(path):f.read(path)}),{code:'PROCESS_IDENTITY'});
  assert.throws(()=>captureProcessIdentity(77,fixture({readError:'EACCES'})),{code:'EACCES'});
  for(const pid of [0,-1,1.2,2147483648])assert.throws(()=>captureProcessIdentity(pid));
});
test('native process identity remains stable while alive, and is dead after observed exit; no PID-reuse claim',async()=>{
  const self=captureProcessIdentity();assert.deepEqual(captureProcessIdentity(),self);assert.equal(ownerProcessIsAlive({pid:process.pid,processIdentity:self}),true);
  const child=spawn(process.execPath,['-e','process.stdout.write("ready\\n");setInterval(()=>{},1000)'],{stdio:['ignore','pipe','pipe']});
  const exited=once(child,'exit');
  try{
    await once(child.stdout,'data');const identity=captureProcessIdentity(child.pid);
    assert.equal(ownerProcessIsAlive({pid:child.pid,processIdentity:identity}),true);
    child.kill('SIGTERM');await exited;
    assert.equal(processIsAlive(child.pid),false);assert.equal(ownerProcessIsAlive({pid:child.pid,processIdentity:identity}),false);
  }finally{if(child.exitCode===null&&child.signalCode===null){child.kill('SIGTERM');await exited;}}
});
for(const kind of ['engine','queue-owner','learning-owner'])test(`${kind} reclaims a synthetic prior-process identity, fences prior owner, and preserves PID-only legacy exclusion`,()=>{
  const store=new Store(':memory:');
  const make=()=>kind==='engine'?new PlanLedger(store,{registry:{assertUsable(){}}}):kind==='queue-owner'?new MissionQueue({engine:{store,run(){assert.fail('No task execution');}}}):new LearningConductor({service:{store,authority:{}},providerFactory:()=>assert.fail('No inference')});
  const acquire=(object,name)=>kind==='engine'?object.acquireEngine({ownerId:name}):object.acquire();
  const verify=object=>kind==='engine'?object.assertEngine():object.assertOwner();
  const release=object=>kind==='engine'?object.releaseEngine(object.engine.ownerId):object.release();
  const busy={engine:'ENGINE_BUSY','queue-owner':'QUEUE_BUSY','learning-owner':'LEARNING_BUSY'}[kind];
  const stale={engine:'ENGINE_OWNERSHIP','queue-owner':'QUEUE_OWNERSHIP','learning-owner':'LEARNING_OWNERSHIP'}[kind];
  try{
    const first=make();acquire(first,'first');const old=store.get(kind,'exclusive');
    assert.deepEqual(old.data.processIdentity,captureProcessIdentity());
    assert.throws(()=>acquire(make(),'second'),{code:busy});
    // Fault injection: a recorded older incarnation now shares our live PID.
    store.put(kind,'exclusive',{...old.data,processIdentity:{...old.data.processIdentity,startTicks:'0'}},{expectedVersion:old.version});
    const second=make();acquire(second,'second');assert.equal(store.get(kind,'exclusive').data.epoch,old.data.epoch+1);
    assert.throws(()=>verify(first),{code:stale});verify(second);release(second);
    const vacant=store.get(kind,'exclusive');store.put(kind,'exclusive',{ownerId:'legacy',pid:process.pid,epoch:vacant.data.epoch+1},{expectedVersion:vacant.version});
    assert.throws(()=>acquire(make(),'third'),{code:busy});
    // Old snapshots have no identity; do not invent one retrospectively.
    assert.equal(store.get(kind,'exclusive').data.processIdentity,undefined);
  }finally{store.close();}
});
