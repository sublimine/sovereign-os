import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {spawn} from 'node:child_process';
import {setTimeout as delay} from 'node:timers/promises';
import {captureRegressionProcess} from '../../reconstruction/verification/capture-regression-process.mjs';
import {assertPassingRegression} from '../../reconstruction/verification/regression-disposition.mjs';
const directory=t=>{const d=fs.mkdtempSync(join(tmpdir(),'regression-capture-'));t.after(()=>fs.rmSync(d,{recursive:true,force:true}));return d;};

test('partial bytes and final decoded output preserve a UTF-8 character split across writes',async t=>{
  const d=directory(t),result=await captureRegressionProcess({command:process.execPath,directory:d,args:['-e',
    "process.stdout.write(Buffer.from([0xc3]));process.stderr.write(Buffer.from([0xe2,0x82]));setTimeout(()=>{process.stdout.write(Buffer.from([0xa1]));process.stderr.write(Buffer.from([0xac]));},30);"]});
  assert.equal(result.exitCode,0);assert.equal(result.interruptedBy,null);
  assert.equal(result.stdout,'á');assert.equal(result.stderr,'€');
  assert.equal(fs.readFileSync(join(d,'results.partial.tap'),'utf8'),result.stdout);
  assert.equal(fs.readFileSync(join(d,'stderr.partial.txt'),'utf8'),result.stderr);
});

test('real SIGTERM drains its owned child and cannot turn the interrupted exit zero into a pass',async t=>{
  const d=directory(t),moduleURL=new URL('../../reconstruction/verification/capture-regression-process.mjs',import.meta.url).href;
  const fixture="process.on('SIGTERM',()=>{process.stdout.write('DRAINED\\n');process.exit(0);});process.stdout.write('READY\\n');setInterval(()=>{},1000);";
  const script=`import {captureRegressionProcess} from ${JSON.stringify(moduleURL)};const r=await captureRegressionProcess({command:process.execPath,args:['-e',${JSON.stringify(fixture)}],directory:${JSON.stringify(d)},killAfterMs:1000});process.stdout.write(JSON.stringify(r));`;
  const driver=spawn(process.execPath,['--input-type=module','-e',script],{stdio:['ignore','pipe','pipe']});
  let text='',errors='';driver.stdout.on('data',b=>text+=b);driver.stderr.on('data',b=>errors+=b);
  const closed=new Promise((resolve,reject)=>{driver.once('error',reject);driver.once('close',(code,signal)=>resolve({code,signal}));});
  t.after(()=>{if(driver.exitCode===null&&driver.signalCode===null)driver.kill('SIGKILL');});
  const end=Date.now()+5000,partial=join(d,'results.partial.tap');
  while(Date.now()<end&&!(fs.existsSync(partial)&&fs.readFileSync(partial,'utf8').includes('READY')))await delay(10);
  assert.ok(fs.existsSync(partial)&&fs.readFileSync(partial,'utf8').includes('READY'),'Actual child must be ready before signal');
  assert.equal(driver.kill('SIGTERM'),true);const finish=await closed;
  assert.deepEqual(finish,{code:0,signal:null},errors);
  const result=JSON.parse(text);assert.equal(result.interruptedBy,'SIGTERM');assert.equal(result.exitCode,0);
  assert.equal(result.stdout,'READY\nDRAINED\n');assert.equal(fs.readFileSync(partial,'utf8'),result.stdout);
  assert.throws(()=>assertPassingRegression({...result,counts:{tests:1,pass:1,fail:0,cancelled:0,skipped:0,todo:0}}),/uninterrupted/);
});

test('spawn failure preserves partial files, releases signal handlers and never fabricates a result',async t=>{
  const d=directory(t),before=['SIGTERM','SIGINT'].map(s=>process.listenerCount(s));
  await assert.rejects(captureRegressionProcess({command:join(d,'absent-program'),args:[],directory:d}),{code:'ENOENT'});
  assert.deepEqual(['SIGTERM','SIGINT'].map(s=>process.listenerCount(s)),before);
  assert.equal(fs.statSync(join(d,'results.partial.tap')).size,0);assert.equal(fs.statSync(join(d,'stderr.partial.txt')).size,0);
});
