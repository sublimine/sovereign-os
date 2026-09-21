import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {join} from 'node:path';import {tmpdir} from 'node:os';
import {spawnSync} from 'node:child_process';
import {FactoryEngine} from '../../factory/lib/engine.mjs';
import {ownerProcessIsAlive} from '../../factory/lib/process-identity.mjs';
import {boundedReadSimulation} from './fixtures/bounded-read-simulation.mjs';
const boundaries=['before-entry-contract-commit','after-entry-contract-commit','after-read-prepared','after-read-dispatched','after-read-receipt',
  'after-producer-final-cleanup','after-candidate-commit','after-entry-review-checkpoint','after-review-commit','before-delivery-commit','after-delivery-commit'];
for(const boundary of boundaries)test('Bounded read REAL full-engine SIGKILL: '+boundary,async t=>{
  const directory=fs.mkdtempSync(join(tmpdir(),'sovereign-bounded-crash-'));let engine;
  t.after(()=>{engine?.close();fs.rmSync(directory,{recursive:true,force:true});});
  const child=spawnSync(process.execPath,[new URL('./fixtures/bounded-read-entry-process.mjs',import.meta.url).pathname,directory,boundary],
    {encoding:'utf8',timeout:30000});assert.equal(child.signal,'SIGKILL',child.stderr);assert.equal(child.status,null);
  const cut=JSON.parse(fs.readFileSync(join(directory,'cut.json')));assert.equal(cut.boundary,boundary);
  assert.equal(ownerProcessIsAlive({pid:cut.owner.pid,processIdentity:cut.owner}),false);
  engine=new FactoryEngine({databasePath:join(directory,'state.sqlite'),workspaceRoot:join(directory,'workspaces')});
  assert.equal(engine.store.db.prepare('PRAGMA user_version').get().user_version,6);
  const before=engine.store.get('bounded-read-entry',cut.missionId),oldCandidate=before?.data.artifactId;
  if(boundary==='before-entry-contract-commit'){assert.equal(before,null);assert.equal(engine.store.list('bounded-read-contract').length,0);assert.equal(cut.calls,0);}
  const counts=boundedReadSimulation(engine,'parent'),result=await engine.run(cut.missionId);
  if(boundary==='after-read-dispatched'){
    assert.equal(result.mission.status,'NEEDS_DIRECTION',JSON.stringify(result.mission.pending));assert.equal(result.mission.pending[0].code,'EFFECT_UNCERTAIN');
    assert.equal(counts.calls,0);assert.equal(result.mission.finalArtifactId,null);assert.equal(result.plan,null);assert.equal(engine.store.list('effect').length,1);
    await engine.run(cut.missionId);assert.equal(counts.calls,0);
  }else{
    assert.equal(result.mission.status,'COMPLETED',JSON.stringify(result.mission.pending));assert.equal(result.outcome.payload.body,'13 + 17 = 30.');
    assert.equal(result.plan,null);assert.equal(cut.calls+counts.calls,3);assert.equal(engine.store.list('mission-inference-call').length,3);
    assert.equal(engine.store.list('effect').length,2);assert.equal(engine.store.list('artifact').length,1);
    assert.equal(engine.store.list('producer-tool-charge').length,1);assert.equal(engine.store.get('bounded-read-entry',cut.missionId).data.productionAttempts,1);
    if(oldCandidate)assert.equal(result.outcome.id,oldCandidate);
    if(['after-review-commit','before-delivery-commit','after-delivery-commit'].includes(boundary))assert.equal(counts.calls,0);
    const currentCalls=counts.calls;await engine.run(cut.missionId);assert.equal(counts.calls,currentCalls);
  }
  engine.store.verifyJournal();assert.equal(fs.readFileSync(join(engine.broker.registerWorkspace(cut.missionId).path,'input.txt'),'utf8'),'13\n17\n');
});
