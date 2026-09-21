import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtempSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {FactoryEngine} from '../../factory/lib/engine.mjs';
import {runBoundedReadEntry} from '../../factory/lib/bounded-read-entry.mjs';
import {nativeReadRecovery} from '../../factory/lib/native-read-session.mjs';
import {missionInferenceBudget} from '../../factory/lib/mission-inference-budget.mjs';

for(const boundary of ['BEFORE_CALL_COMMIT','AFTER_CALL_COMMIT','PREPARED','DISPATCH_INTENT','ACKNOWLEDGED','COMPLETED','OUTCOME'])
test('REAL isolated native-controller SIGKILL / SIM provider at '+boundary,async t=>{
  const directory=mkdtempSync(join(tmpdir(),'sovereign-native-crash-'));let e;
  t.after(()=>{e?.close();rmSync(directory,{recursive:true,force:true});});
  const child=spawn(process.execPath,[new URL('./fixtures/native-read-crash.mjs',import.meta.url).pathname,directory,boundary],{stdio:['ignore','pipe','pipe']});
  let output='';for(const stream of [child.stdout,child.stderr])stream.on('data',d=>{output+=d;if(output.length>65536)child.kill('SIGKILL');});
  const exit=await new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>{child.kill('SIGKILL');reject(Error('Crash fixture timed out'));},30000);
    child.once('error',error=>{clearTimeout(timer);reject(error);});child.once('exit',(code,signal)=>{clearTimeout(timer);resolve({code,signal});});
  });assert.equal(exit.signal,'SIGKILL',output);assert.equal(exit.code,null);
  e=new FactoryEngine({databasePath:join(directory,'state.sqlite'),workspaceRoot:join(directory,'jobs')});
  const mission=e.store.list('mission')[0].data,runId=e.store.get('bounded-read-entry',mission.id).data.runId;
  const state=nativeReadRecovery(e.registry,runId),expected={BEFORE_CALL_COMMIT:'BOUND',AFTER_CALL_COMMIT:'CALLED',OUTCOME:'COMPLETED'}[boundary]??boundary;
  assert.equal(state.phase,expected);assert.equal(state.recovery.mayResend,false);
  assert.equal(missionInferenceBudget(e.registry,mission.id).reserved,boundary==='BEFORE_CALL_COMMIT'?1:2);
  assert.equal(e.store.list('native-read-continuation').length,boundary==='BEFORE_CALL_COMMIT'?0:1);
  assert.equal(e.store.list('effect').length,['BEFORE_CALL_COMMIT','AFTER_CALL_COMMIT'].includes(boundary)?0:1);
  assert.equal(e.store.list('worker-proposal').length,boundary==='OUTCOME'?1:0);
  if(state.prepared)assert.equal(JSON.parse(JSON.parse(state.prepared.responseJson).contentItems[0].text).result.content,'13\n17\n');
  assert.equal(e.store.list('producer-cleanup').length,0,'A killed controller has no fabricated close outcome');
  e.workers.providerFactory=e.workers.nativeProviderFactory=()=>assert.fail('Crash recovery must not buy a new inference');
  const before=e.store.verifyJournal();await assert.rejects(runBoundedReadEntry(e,mission),{code:'CLEANUP_UNCONFIRMED'});
  // Entry may record RUNNING again, but material outcome/consumption cannot change.
  assert.equal(e.store.list('inference-request').length,1);assert.equal(e.store.list('artifact').length,0);
  assert.equal(e.store.list('worker-proposal').length,boundary==='OUTCOME'?1:0);
  assert.ok(e.store.verifyJournal().events>=before.events);
});
