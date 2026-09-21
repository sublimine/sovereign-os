import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {join} from 'node:path';import {tmpdir} from 'node:os';
import {spawnSync} from 'node:child_process';
import {FactoryEngine} from '../../factory/lib/engine.mjs';import {MissionQueue} from '../../factory/lib/queue.mjs';
import {ownerProcessIsAlive} from '../../factory/lib/process-identity.mjs';
import {boundedReadSimulation} from './fixtures/bounded-read-simulation.mjs';
const uncertain=new Set(['directory.created','file.created','file.synced']);
const boundaries=['submission.before-commit','submission.committed','directory.reserved','directory.created','directory.committed',
  'file.reserved','file.created','file.synced','file.staged','file.published','file.unlinked','file.committed','inputs.before-ready','inputs.ready'];
for(const boundary of boundaries)test('Input admission REAL SIGKILL and actual queued engine recovery: '+boundary,async t=>{
  const directory=fs.mkdtempSync(join(tmpdir(),'sovereign-input-crash-'));let engine,queue;
  t.after(()=>{if(queue?.owner)queue.release();engine?.close();fs.rmSync(directory,{recursive:true,force:true});});
  const child=spawnSync(process.execPath,[new URL('./fixtures/mission-input-process.mjs',import.meta.url).pathname,directory,boundary],{encoding:'utf8',timeout:30000});
  assert.equal(child.signal,'SIGKILL',child.stderr);assert.equal(child.status,null);
  const cut=JSON.parse(fs.readFileSync(join(directory,'cut.json')));assert.equal(ownerProcessIsAlive({pid:cut.owner.pid,processIdentity:cut.owner}),false);
  engine=new FactoryEngine({databasePath:join(directory,'state.sqlite'),workspaceRoot:join(directory,'workspaces')});
  queue=new MissionQueue({engine});const counts=boundedReadSimulation(engine,'input-crash-parent');
  assert.equal(engine.store.list('mission-inference-call').length,0);assert.equal(engine.store.list('run').length,0);
  queue.acquire();queue.recover();
  if(boundary==='submission.before-commit'){
    assert.equal(engine.store.list('mission').length,0);assert.equal(engine.store.list('mission-input-bytes').length,0);
    assert.equal(engine.store.db.prepare('PRAGMA user_version').get().user_version,2);assert.equal(await queue.runNext(),null);
  }else{
    assert.equal(engine.store.db.prepare('PRAGMA user_version').get().user_version,7);const result=await queue.runNext();
    if(uncertain.has(boundary)){
      assert.equal(result.status,'WAITING');assert.equal(result.lastCode,'INPUT_PREPARATION_UNCERTAIN');assert.equal(counts.calls,0);
      assert.equal(engine.store.list('mission-inference-call').length,0);assert.equal(await queue.runNext(),null);
    }else{
      assert.equal(result.status,'COMPLETED',JSON.stringify(engine.status(cut.missionId).mission.pending));
      assert.equal(counts.calls,3);assert.equal(engine.store.list('effect').length,2);assert.equal(engine.store.list('mission-input-bytes').length,1);
      assert.equal(fs.readFileSync(engine.broker.resolvePath(cut.missionId,'input.txt'),'utf8'),'13\n17\n');
      await engine.run(cut.missionId);assert.equal(counts.calls,3);
    }
  }
  engine.store.verifyJournal();
});
