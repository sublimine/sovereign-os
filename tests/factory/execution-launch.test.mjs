import test from 'node:test';
import assert from 'node:assert/strict';
import {ExecutionLaunchProtocol} from '../../factory/tools/execution-launch.mjs';

const scope = {nonce:'exact-test-nonce',snapshotHash:'f'.repeat(64)};
const ready = {kind:'sovereign.execution.ready.v1',...scope,namespaces:{pid:'pid:[1]'},
  noNewPrivileges:true,effectiveCapabilities:'0',seccomp:true};
const started = {kind:'sovereign.execution.started.v1',...scope,pid:3};
const bytes = v => Buffer.from(JSON.stringify(v)+'\n');
const protocol = () => new ExecutionLaunchProtocol(scope);
const released = () => { const p=protocol();p.feed(bytes(ready));p.release();return p; };

test('ready, released and exec observed are distinct facts', () => {
  const p=protocol();assert.equal(p.ready,null);assert.equal(p.started,null);assert.equal(p.released,false);
  assert.deepEqual(p.feed(bytes(ready)),Buffer.alloc(0));assert.deepEqual(p.ready,ready);assert.equal(p.started,null);
  p.release();assert.equal(p.released,true);assert.equal(p.started,null);
  assert.deepEqual(p.feed(Buffer.concat([bytes(started),Buffer.from('result\n')])),Buffer.from('result\n'));
  assert.deepEqual(p.started,started);
  // A program's lookalike JSON is ordinary program output, never another ack.
  assert.deepEqual(p.feed(bytes({...started,pid:999})),bytes({...started,pid:999}));assert.equal(p.started.pid,3);
});
test('every split in both control frames preserves exactly the original output', () => {
  for(let i=0;i<=bytes(ready).length;i++)for(let j=0;j<=bytes(started).length;j++){
    const p=protocol(),a=bytes(ready),b=bytes(started);
    assert.equal(p.feed(a.subarray(0,i)).length,0);assert.equal(p.feed(a.subarray(i)).length,0);p.release();
    const out=Buffer.concat([p.feed(b.subarray(0,j)),p.feed(Buffer.concat([b.subarray(j),Buffer.from('é\n')]))]);
    assert.equal(out.toString(),'é\n');assert.equal(p.started.pid,3);
  }
});
test('coalesced large program output is not charged to the control frame cap', () => {
  const p=released(),data=Buffer.alloc(65536,65);
  assert.deepEqual(p.feed(Buffer.concat([bytes(started),data])),data);
});
test('ready and started snapshots cannot mutate protocol state', () => {
  const p=released();p.ready.namespaces.pid='changed';assert.equal(p.ready.namespaces.pid,'pid:[1]');
  p.feed(bytes(started));p.started.pid=99;assert.equal(p.started.pid,3);
});
test('release without readiness or duplicate release is forbidden', () => {
  assert.throws(()=>protocol().release(),{code:'EXECUTION_GATE'});
  const p=released();assert.throws(()=>p.release(),{code:'EXECUTION_GATE'});
});
for(const [name,chunk] of [
  ['coalesced premature ack',Buffer.concat([bytes(ready),bytes(started)])],
  ['coalesced premature output',Buffer.concat([bytes(ready),Buffer.from('result')])],
  ['wrong ready nonce',bytes({...ready,nonce:'other'})],
  ['wrong ready snapshot',bytes({...ready,snapshotHash:'a'.repeat(64)})],
  ['wrong ready kind',bytes({...ready,kind:started.kind})],
  ['unprotected ready',bytes({...ready,seccomp:false})],
  ['extra ready field',bytes({...ready,extra:true})],
  ['invalid utf8',Buffer.from([255,10])],
  ['malformed JSON',Buffer.from('{bad}\n')],
  ['oversized unterminated frame',Buffer.alloc(16385,32)],
  ['oversized terminated frame',Buffer.from(' '.repeat(16384)+'\n')],
])test(name+' poisons the control stream',()=>{
  const p=protocol();assert.throws(()=>p.feed(chunk),{code:'EXECUTION_GATE'});
  assert.throws(()=>p.feed(bytes(ready)),{code:'EXECUTION_GATE'});assert.throws(()=>p.release(),{code:'EXECUTION_GATE'});
  assert.equal(p.started,null);
});
for(const [name,frame] of [
  ['wrong start nonce',{...started,nonce:'other'}],['wrong start snapshot',{...started,snapshotHash:'a'.repeat(64)}],
  ['wrong start kind',{...started,kind:ready.kind}],['zero PID',{...started,pid:0}],
  ['fractional PID',{...started,pid:1.5}],['missing PID',(({pid,...v})=>v)(started)],
  ['extra start field',{...started,extra:true}],
])test(name+' cannot attest exec',()=>{
  const p=released();assert.throws(()=>p.feed(bytes(frame)),{code:'EXECUTION_GATE'});assert.equal(p.started,null);
});
test('separate premature bytes after ready are rejected',()=>{
  const p=protocol();p.feed(bytes(ready));assert.throws(()=>p.feed(bytes(started)),{code:'EXECUTION_GATE'});
  assert.equal(p.released,false);assert.equal(p.started,null);
});
