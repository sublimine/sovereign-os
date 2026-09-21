import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {join} from 'node:path';import {tmpdir} from 'node:os';
import {spawnSync} from 'node:child_process';
import {FactoryEngine} from '../../factory/lib/engine.mjs';import {MissionQueue} from '../../factory/lib/queue.mjs';
import {boundedReadSimulation} from './fixtures/bounded-read-simulation.mjs';
const cli=new URL('../../factory/bin/sovereign.mjs',import.meta.url).pathname;
function fixture(t){const dir=fs.mkdtempSync(join(tmpdir(),'sovereign-input-cli-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));return dir;}
test('real CLI submission captures data before queue visibility and resumes without source host files',async t=>{
  const dir=fixture(t),state=join(dir,'state'),source=join(dir,'original.txt'),manifest=join(dir,'inputs.json');
  fs.writeFileSync(source,'13\n17\n');fs.writeFileSync(manifest,JSON.stringify([{source,path:'input.txt'}]));
  const args=[cli,'submit','--state-dir',state,'--text','Read input.txt and add its supplied numbers only. No writes or execution.',
    '--entry-mode','bounded-read-response-v1','--allowed-tools','workspace.read','--inputs',manifest,'--request-id','submission:cli'];
  const first=spawnSync(process.execPath,args,{encoding:'utf8',timeout:30000});assert.equal(first.status,0,first.stderr);const job=JSON.parse(first.stdout);
  const same=spawnSync(process.execPath,args,{encoding:'utf8',timeout:30000});assert.equal(same.status,0,same.stderr);assert.equal(JSON.parse(same.stdout).missionId,job.missionId);
  const engine=new FactoryEngine({databasePath:join(state,'state.sqlite'),workspaceRoot:join(state,'workspaces')});t.after(()=>engine.close());
  assert.equal(engine.store.list('mission').length,1);assert.equal(engine.store.get('tool-workspace',job.missionId),null);
  fs.unlinkSync(source);fs.unlinkSync(manifest);const model=boundedReadSimulation(engine,'cli'),queue=new MissionQueue({engine});
  queue.acquire();try{assert.equal((await queue.runNext()).status,'COMPLETED',JSON.stringify(engine.status(job.missionId).mission.pending));}finally{queue.release();}
  assert.equal(model.calls,3);assert.equal(fs.readFileSync(engine.broker.resolvePath(job.missionId,'input.txt'),'utf8'),'13\n17\n');
});
test('CLI rejects malformed or unsafe attachments without publishing a mission',t=>{
  const dir=fixture(t),state=join(dir,'state'),source=join(dir,'source'),manifest=join(dir,'inputs.json');fs.writeFileSync(source,'text');
  for(const contents of ['not-json',JSON.stringify([{source,path:'../bad'}]),JSON.stringify([{source,path:'x'},{source,path:'x'}])]){
    fs.writeFileSync(manifest,contents);const result=spawnSync(process.execPath,[cli,'submit','--state-dir',state,'--text','Read files','--inputs',manifest],{encoding:'utf8',timeout:30000});
    assert.notEqual(result.status,0);const engine=new FactoryEngine({databasePath:join(state,'state.sqlite'),workspaceRoot:join(state,'workspaces')});
    try{assert.equal(engine.store.list('mission').length,0);assert.equal(engine.store.list('queue-job').length,0);}finally{engine.close();}
  }
});
test('CLI cannot retrofit attachments on status, resume or queue controls',t=>{
  const dir=fixture(t);for(const command of ['status','resume','continue','pause','serve']){
    const result=spawnSync(process.execPath,[cli,command,'--state-dir',join(dir,'missing'),'--inputs',join(dir,'not-read')],{encoding:'utf8',timeout:30000});
    assert.notEqual(result.status,0);assert.match(result.stderr,/sólo se admiten al crear/);assert.equal(fs.existsSync(join(dir,'missing')),false);
  }
});
