import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {Store} from '../../factory/lib/store.mjs';
import {SOAK_POLICY,parseProcessStat,evaluateSoak,appendSample,readSamples,readQueueDatabase,readLiveExecutable} from '../../reconstruction/verification/service-soak.mjs';

const origin=Date.parse('2026-09-10T00:00:00.000Z');
test('executable observer binds actual open bytes and distinguishes the same file',()=>{
  const value=readLiveExecutable(process.pid,process.execPath);
  assert.equal(value.relation,'SAME_FILE');assert.equal(value.deleted,false);assert.equal(value.live.hash,value.configured.hash);
  assert.match(value.live.hash,/^[a-f0-9]{64}$/);assert.equal(value.live.identity.ino,value.configured.identity.ino);
  assert.throws(()=>readLiveExecutable(0,process.execPath),{code:'SOAK_PROC'});
});
test('native unlinked running executable remains verifiable without restarting; changed configured bytes fail',async()=>{
  const directory=fs.mkdtempSync(join(tmpdir(),'sovereign-executable-test-')),path=join(directory,'node');
  fs.copyFileSync(process.execPath,path);fs.chmodSync(path,0o700);
  const child=spawn(path,['-e','process.stdout.write("READY\\n");setInterval(()=>{},1000);'],{stdio:['ignore','pipe','pipe']});
  const exited=once(child,'exit');
  try{
    await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Test child startup deadline')),10000);
      child.once('error',error=>{clearTimeout(timer);reject(error);});child.stdout.once('data',bytes=>{clearTimeout(timer);assert.match(bytes.toString(),/READY/);resolve();});});
    const before=readLiveExecutable(child.pid,path);assert.equal(before.relation,'SAME_FILE');
    fs.unlinkSync(path); // Only the binary created above, never the installed runtime.
    fs.copyFileSync(process.execPath,path);fs.chmodSync(path,0o700);
    const after=readLiveExecutable(child.pid,path);assert.equal(after.deleted,true);assert.equal(after.relation,'IDENTICAL_BYTES_DIFFERENT_FILE');
    assert.equal(after.live.hash,before.live.hash);assert.notEqual(after.live.identity.ino,after.configured.identity.ino);
    fs.appendFileSync(path,'changed fixture bytes');assert.throws(()=>readLiveExecutable(child.pid,path),{code:'SOAK_EXECUTABLE'});
    assert.equal(child.exitCode,null,'Observer never restarts or stops the live process');
  }finally{if(child.exitCode===null&&child.signalCode===null)child.kill('SIGTERM');await exited;fs.rmSync(directory,{recursive:true});}
});
function sample(minutes=0){
  const capturedAt=new Date(origin+minutes*60000).toISOString();
  return {id:'soak-sample:'+minutes,capturedAt,probeHash:'probe1',healthy:true,observation:{
    clock:{bootId:'boot1',uptimeMs:100000000+minutes*60000,wallTime:capturedAt},
    process:{pid:77,startTicks:'1234',executableHash:'node1'},service:{properties:{NRestarts:'0'}},
    release:{releaseId:'release1'},unitHash:'unit1',wrapperHash:'wrapper1',
    database:{identity:{path:'/private/test.sqlite',dev:2,ino:7},journal:{events:5,head:'hash1'},predecessor:'EXTENDS',
      owner:{ownerId:'owner1',epoch:1},jobs:[],missions:[]}}};
}
test('soak begins at first observation, not process boot time or one healthy sample',()=>{
  assert.equal(evaluateSoak([]).status,'NOT_STARTED');
  const actual=evaluateSoak([sample()]);
  assert.equal(actual.status,'OBSERVING');assert.equal(actual.currentSegmentMs,0);
  assert.equal(actual.continuousUptimeProven,false);assert.equal(actual.missionWorkProven,false);
});
test('72-hour synthetic sampled window requires actual cadence, never claims continuous uptime or useful work',()=>{
  const samples=Array.from({length:145},(_,i)=>sample(i*30));
  assert.equal(evaluateSoak(samples.slice(0,-1)).status,'OBSERVING');
  const report=evaluateSoak(samples);assert.equal(report.status,'SAMPLED_WINDOW_MET');
  assert.equal(report.currentSegmentMs,72*3600000);assert.equal(report.sampleCount,145);
  assert.equal(report.continuousUptimeProven,false);assert.equal(report.missionWorkProven,false);
  assert.deepEqual(report.incidents,[]);
});
test('duplicate instants add no duration; a missing checkpoint breaks coverage at strict max gap',()=>{
  assert.equal(evaluateSoak([sample(),sample()]).currentSegmentMs,0);
  assert.equal(evaluateSoak([sample(),sample(45)]).currentSegmentMs,45*60000);
  const report=evaluateSoak([sample(),sample(45.001),sample(75.001)]);
  assert.equal(report.currentSegmentMs,30*60000);
  assert.deepEqual(report.incidents[0].codes,['OBSERVATION_GAP']);
  assert.equal(evaluateSoak([sample(),sample(4320)]).status,'OBSERVING');
});
test('same PID with different start ticks, automatic restart and reboot break sampled segment',()=>{
  for(const [mutate,expected]of [
    [s=>s.observation.process.startTicks='9999','PROCESS_CHANGED'],
    [s=>s.observation.service.properties.NRestarts='1','RESTART_COUNTER_CHANGED'],
    [s=>s.observation.clock.bootId='boot2','BOOT_CHANGED'],
    [s=>s.observation.process.pid=78,'PROCESS_CHANGED'],
  ]){const next=sample(30);mutate(next);const result=evaluateSoak([sample(),next]);
    assert.equal(result.currentSegmentMs,0);assert.ok(result.incidents[0].codes.includes(expected));}
});
test('release, executable, wrapper, unit, observer and queue owner changes are recorded, never merged',()=>{
  for(const [mutate,expected]of [
    [s=>s.observation.release.releaseId='release2','RELEASE_CHANGED'],
    [s=>s.observation.process.executableHash='node2','ENTRYPOINT_CHANGED'],
    [s=>s.observation.wrapperHash='wrapper2','ENTRYPOINT_CHANGED'],
    [s=>s.observation.unitHash='unit2','ENTRYPOINT_CHANGED'],
    [s=>s.probeHash='probe2','PROBE_CHANGED'],
    [s=>s.observation.database.owner.ownerId='owner2','QUEUE_OWNER_CHANGED'],
    [s=>s.observation.database.owner.epoch=2,'QUEUE_OWNER_CHANGED'],
    [s=>s.observation.database.identity.ino=8,'DATABASE_CHANGED'],
  ]){const next=sample(30);mutate(next);const result=evaluateSoak([sample(),next]);
    assert.equal(result.currentSegmentMs,0);assert.ok(result.incidents[0].codes.includes(expected));}
});
test('wall-clock change cannot turn minutes into days; monotonic rollback fails coverage',()=>{
  const jump=sample(30);jump.observation.clock.wallTime=new Date(origin+73*3600000).toISOString();
  const result=evaluateSoak([sample(),jump]);assert.equal(result.currentSegmentMs,0);
  assert.ok(result.incidents[0].codes.includes('WALL_CLOCK_CHANGED'));
  const reverse=sample(-1);assert.ok(evaluateSoak([sample(),reverse]).incidents[0].codes.includes('MONOTONIC_ROLLBACK'));
});
test('failed snapshots remain in history; recovery starts a new segment without resetting longest observation',()=>{
  const failed={id:'soak-sample:failed',capturedAt:sample(60).capturedAt,healthy:false,failure:{code:'SOAK_SERVICE'}};
  const before=evaluateSoak([sample(),sample(30),failed]);assert.equal(before.status,'SNAPSHOT_FAILED');
  assert.equal(before.currentSegmentMs,0);assert.equal(before.longestSampledSegmentMs,30*60000);
  const after=evaluateSoak([sample(),sample(30),failed,sample(90),sample(120)]);
  assert.equal(after.currentSegmentMs,30*60000);assert.equal(after.failedSnapshots,1);
  assert.deepEqual(after.incidents[0].codes,['SOAK_SERVICE']);
});
test('journal replacement, rewind and fork remain distinct incidents',()=>{
  for(const code of ['DATABASE_CHANGED','JOURNAL_REWOUND','JOURNAL_FORKED']){
    const next=sample(30);next.observation.database.predecessor=code;
    const result=evaluateSoak([sample(),next]);assert.equal(result.currentSegmentMs,0);assert.deepEqual(result.incidents[0].codes,[code]);
  }
});
test('process stat parses parentheses in command and rejects malformed identity or missing start ticks',()=>{
  const text='77 (a ) tricky (name)) S '+Array.from({length:19},(_,i)=>i===18?'12345':'0').join(' ');
  assert.deepEqual(parseProcessStat(text,77),{pid:77,state:'S',startTicks:'12345'});
  for(const [value,pid]of [[text,78],['77 (a) S 0',77],['not stat',77]])assert.throws(()=>parseProcessStat(value,pid),{code:'SOAK_PROC'});
});
test('observer journal is idempotent, conflicts fail, policy cannot change and observations keep commit order',()=>{
  const store=new Store(':memory:');
  try{
    appendSample(store,sample(30));const head=store.verifyJournal();appendSample(store,sample(30));
    assert.deepEqual(store.verifyJournal(),head);
    assert.throws(()=>appendSample(store,{...sample(30),healthy:false}),{code:'SOAK_CONFLICT'});
    assert.throws(()=>appendSample(store,sample(60),{...SOAK_POLICY,targetMs:1}),{code:'SOAK_POLICY'});
    appendSample(store,sample(0));assert.deepEqual(readSamples(store).map(s=>s.id),['soak-sample:30','soak-sample:0']);
    assert.ok(evaluateSoak(readSamples(store)).incidents[0].codes.includes('MONOTONIC_ROLLBACK'));
    assert.throws(()=>store.db.exec('DELETE FROM events'));
  }finally{store.close();}
});
test('production database inspection leaves all records unchanged, exposes no request or secret, detects owner and ancestry',()=>{
  const directory=fs.mkdtempSync(join(tmpdir(),'sovereign-soak-test-')),path=join(directory,'state.sqlite');
  const store=new Store(path),now=sample().capturedAt;
  try{
    store.put('queue-owner','exclusive',{ownerId:'owner:1',pid:77,epoch:1},{expectedVersion:0});
    store.put('mission','mission:1',{status:'COMPLETED',intent:'PRIVATE_INTENT'},{expectedVersion:0});
    store.put('authority','key',{secret:'PRIVATE_SECRET'},{expectedVersion:0});
    store.put('queue-job','mission:1',{missionId:'mission:1',status:'COMPLETED',desired:'RUN',attempts:1,lastCode:null,updatedAt:now},{expectedVersion:0});
    const before=store.verifyJournal(),inspection=readQueueDatabase(path,77);
    assert.deepEqual(store.verifyJournal(),before);assert.deepEqual(inspection.journal,before);
    assert.ok(!JSON.stringify(inspection).includes('PRIVATE_'));assert.equal(inspection.jobs.length,1);
    assert.equal(readQueueDatabase(path,77,inspection).predecessor,'EXTENDS');
    assert.throws(()=>readQueueDatabase(path,78),{code:'SOAK_OWNER'});
    assert.equal(readQueueDatabase(path,77,{...inspection,journal:{events:999,head:'bad'}}).predecessor,'JOURNAL_REWOUND');
    assert.equal(readQueueDatabase(path,77,{...inspection,journal:{events:1,head:'bad'}}).predecessor,'JOURNAL_FORKED');
    assert.equal(readQueueDatabase(path,77,{...inspection,identity:{...inspection.identity,ino:999}}).predecessor,'DATABASE_CHANGED');
    assert.deepEqual(store.verifyJournal(),before);
  }finally{store.close();fs.rmSync(directory,{recursive:true});}
});
