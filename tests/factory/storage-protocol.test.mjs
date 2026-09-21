import test from 'node:test';import assert from 'node:assert/strict';
import fs from 'node:fs';import {join} from 'node:path';import {tmpdir} from 'node:os';
import {DatabaseSync} from 'node:sqlite';import {Store} from '../../factory/lib/store.mjs';
import {spawnSync} from 'node:child_process';import {ownerProcessIsAlive} from '../../factory/lib/process-identity.mjs';
const version=s=>s.db.prepare('PRAGMA user_version').get().user_version;
function setup(t){const directory=fs.mkdtempSync(join(tmpdir(),'sovereign-storage-protocol-')),path=join(directory,'state.sqlite');
  t.after(()=>fs.rmSync(directory,{recursive:true,force:true}));return {directory,path};}
test('First material record commits execution protocol 2 atomically',()=>{
  const s=new Store(':memory:');try{assert.equal(version(s),1);s.put('fixture','record',{value:1},{expectedVersion:0});assert.equal(version(s),2);assert.equal(s.verifyJournal().events,1);}finally{s.close();}
});
test('An event-only write also protects the execution protocol',()=>{
  const s=new Store(':memory:');try{s.append('fixture.event',{value:1});assert.equal(version(s),2);assert.equal(s.verifyJournal().events,1);}finally{s.close();}
});
test('Opening and reading an untouched legacy database does not promote its floor',t=>{
  const {path}=setup(t);let s=new Store(path);s.close();s=new Store(path);try{assert.equal(version(s),1);assert.deepEqual(s.list('mission'),[]);assert.equal(s.verifyJournal().events,0);assert.equal(version(s),1);}finally{s.close();}
});
test('Reopening protocol 2 never silently lowers it to 1',t=>{
  const {path}=setup(t);let s=new Store(path);s.put('fixture','record',{value:2},{expectedVersion:0});s.close();s=new Store(path);
  try{assert.equal(version(s),2);assert.equal(s.get('fixture','record').data.value,2);}finally{s.close();}
});
test('Outer transaction rollback restores both prior floor and complete history',()=>{
  const s=new Store(':memory:');try{assert.throws(()=>s.transact(()=>{s.put('fixture','record',{value:3},{expectedVersion:0});assert.equal(version(s),2);throw Error('cut');}),/cut/);
    assert.equal(version(s),1);assert.equal(s.get('fixture','record'),null);assert.equal(s.verifyJournal().events,0);}finally{s.close();}
});
test('A failed optimistic write cannot promote an otherwise unchanged database',()=>{
  const s=new Store(':memory:');try{assert.throws(()=>s.put('fixture','record',{}, {expectedVersion:1}),{code:'VERSION_CONFLICT'});assert.equal(version(s),1);assert.equal(s.verifyJournal().events,0);}finally{s.close();}
});
test('Current protocol 12 opens without rewriting its version',t=>{
  const {path}=setup(t);const s=new Store(path);s.close();const raw=new DatabaseSync(path);raw.exec('PRAGMA user_version=12');raw.close();
  const reopened=new Store(path);try{assert.equal(version(reopened),12);assert.equal(reopened.verifyJournal().events,0);}finally{reopened.close();}
});
for(const current of [12,13,14,15,16,17])test('An existing current writer also accepts protocol '+current,()=>{
  const s=new Store(':memory:');try{s.db.exec('PRAGMA user_version='+current);s.append('fixture.event',{});assert.equal(s.verifyJournal().events,1);assert.equal(version(s),current);}finally{s.close();}
});
test('Protocol 15 opens as the current durable floor without rewriting its version',t=>{
  const {path}=setup(t);const s=new Store(path);s.close();const raw=new DatabaseSync(path);raw.exec('PRAGMA user_version=15');raw.close();
  const reopened=new Store(path);try{assert.equal(version(reopened),15);reopened.append('fixture.event',{});assert.equal(reopened.verifyJournal().events,1);assert.equal(version(reopened),15);}finally{reopened.close();}
});
test('Protocol 16 opens as the current durable floor without rewriting its version',t=>{
  const {path}=setup(t);const s=new Store(path);s.close();const raw=new DatabaseSync(path);raw.exec('PRAGMA user_version=16');raw.close();
  const reopened=new Store(path);try{assert.equal(version(reopened),16);reopened.append('fixture.event',{});assert.equal(reopened.verifyJournal().events,1);assert.equal(version(reopened),16);}finally{reopened.close();}
});
test('A future protocol is rejected on new opening without rewriting its version',t=>{
  const {path}=setup(t);const s=new Store(path);s.close();const raw=new DatabaseSync(path);raw.exec('PRAGMA user_version=18');raw.close();
  assert.throws(()=>new Store(path),{code:'STORAGE_VERSION'});const check=new DatabaseSync(path,{readOnly:true});try{assert.equal(check.prepare('PRAGMA user_version').get().user_version,18);}finally{check.close();}
});
test('An existing current writer refuses a later unsupported protocol',()=>{
  const s=new Store(':memory:');try{s.db.exec('PRAGMA user_version=18');assert.throws(()=>s.append('fixture.event',{}),{code:'STORAGE_VERSION'});assert.equal(s.verifyJournal().events,0);assert.equal(version(s),18);}finally{s.close();}
});
test('Protocol 14 may be required in its material transaction and never lowers afterward',()=>{
  const s=new Store(':memory:');try{s.transact(()=>{s.requireExecutionProtocol(14);s.put('fixture','activation-authorization',{}, {expectedVersion:0});});
    assert.equal(version(s),14);s.append('fixture.later',{});assert.equal(version(s),14);assert.equal(s.verifyJournal().events,2);
  }finally{s.close();}
});
test('Protocol 15 promotion is atomic and rolls back with its first cleanup-bound record',()=>{
  const s=new Store(':memory:');try{
    const before=s.verifyJournal();
    assert.throws(()=>s.transact(()=>{s.requireExecutionProtocol(15);s.put('fixture','planning-cleanup-origin',{}, {expectedVersion:0});throw Error('rollback');}),/rollback/);
    assert.equal(version(s),1);assert.equal(s.get('fixture','planning-cleanup-origin'),null);assert.deepEqual(s.verifyJournal(),before);
    s.transact(()=>{s.requireExecutionProtocol(15);s.put('fixture','planning-cleanup-origin',{}, {expectedVersion:0});});
    assert.equal(version(s),15);assert.equal(s.get('fixture','planning-cleanup-origin').version,1);assert.equal(s.verifyJournal().events,1);
  }finally{s.close();}
});
test('A feature can require protocol 3 only within its material transaction',()=>{
  const s=new Store(':memory:');try{
    assert.throws(()=>s.requireExecutionProtocol(3),{code:'STORAGE_VERSION'});assert.equal(version(s),1);
    s.transact(()=>{s.requireExecutionProtocol(3);s.put('fixture','protected',{protocol:3},{expectedVersion:0});});
    assert.equal(version(s),3);s.append('fixture.later',{});assert.equal(version(s),3);assert.equal(s.verifyJournal().events,2);
  }finally{s.close();}
});
for(const prior of [1,2])test('Protocol 3 promotion rollback preserves prior '+prior,()=>{
  const s=new Store(':memory:');try{if(prior===2)s.append('fixture.original',{});const before=s.verifyJournal();
    assert.throws(()=>s.transact(()=>{s.requireExecutionProtocol(3);s.put('fixture','protected',{}, {expectedVersion:0});throw Error('rollback');}),/rollback/);
    assert.equal(version(s),prior);assert.equal(s.get('fixture','protected'),null);assert.deepEqual(s.verifyJournal(),before);
  }finally{s.close();}
});
test('Opening protocol 3 preserves it; requesting protocol 2 never lowers it',t=>{
  const {path}=setup(t);let s=new Store(path);s.transact(()=>{s.requireExecutionProtocol(3);s.append('fixture.protected',{});});s.close();
  s=new Store(path);try{assert.equal(version(s),3);s.transact(()=>s.requireExecutionProtocol(2));assert.equal(version(s),3);assert.equal(s.verifyJournal().events,1);}finally{s.close();}
});
for(const prior of [1,2,3])test('Protocol 4 origin rolls back to prior '+prior+' and never lowers after commit',t=>{
  const {path}=setup(t);let s=new Store(path);try{
    if(prior>1)s.transact(()=>{s.requireExecutionProtocol(prior);s.append('fixture.prior',{});});
    const before=s.verifyJournal();assert.throws(()=>s.requireExecutionProtocol(4),{code:'STORAGE_VERSION'});
    assert.throws(()=>s.transact(()=>{s.requireExecutionProtocol(4);s.put('fixture','cursor',{}, {expectedVersion:0});throw Error('cut');}),/cut/);
    assert.equal(version(s),prior);assert.deepEqual(s.verifyJournal(),before);assert.equal(s.get('fixture','cursor'),null);
    s.transact(()=>{s.requireExecutionProtocol(4);s.put('fixture','cursor',{}, {expectedVersion:0});});s.close();s=new Store(path);
    assert.equal(version(s),4);s.transact(()=>s.requireExecutionProtocol(3));assert.equal(version(s),4);s.append('fixture.later',{});
    assert.equal(version(s),4);assert.equal(s.verifyJournal().events,before.events+2);
  }finally{s.close();}
});
for(const [boundary,kind]of [['before-write','record'],['before-commit','record'],['before-commit','event'],['after-commit','record'],['after-commit','event']])
  test('REAL SIGKILL preserves atomic header/history: '+boundary+'/'+kind,t=>{
    const {directory,path}=setup(t);let s=new Store(path);s.close();
    const child=spawnSync(process.execPath,[new URL('./fixtures/storage-protocol-crash.mjs',import.meta.url).pathname,directory,boundary,kind],{encoding:'utf8',timeout:30000});
    assert.equal(child.signal,'SIGKILL',child.stderr);assert.equal(child.status,null);
    const cut=JSON.parse(fs.readFileSync(join(directory,'cut.json')));assert.equal(ownerProcessIsAlive({pid:cut.owner.pid,processIdentity:cut.owner}),false);
    assert.equal(cut.protocol,boundary==='before-write'?1:2);
    s=new Store(path);try{const committed=boundary==='after-commit';assert.equal(version(s),committed?2:1);
      assert.equal(s.verifyJournal().events,committed?1:0);assert.equal(s.get('fixture','record')?.data.value,committed&&kind==='record'?1:undefined);
    }finally{s.close();}
  });
test('Two current connections observe the same monotonic floor',t=>{
  const {path}=setup(t),first=new Store(path),second=new Store(path);try{
    assert.equal(version(first),1);second.append('fixture.second',{});assert.equal(version(first),2);
    first.append('fixture.first',{});assert.equal(version(second),2);assert.equal(first.verifyJournal().events,2);
  }finally{first.close();second.close();}
});
