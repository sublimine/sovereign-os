import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {spawnSync} from 'node:child_process';
import {DatabaseSync} from 'node:sqlite';
const cli=new URL('../../factory/bin/sovereign.mjs',import.meta.url).pathname;
function setup(t){const dir=fs.mkdtempSync(join(tmpdir(),'sovereign-sourced-cli-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));return join(dir,'state');}
const invoke=(state,args)=>spawnSync(process.execPath,[cli,...args,'--state-dir',state],{encoding:'utf8',timeout:20000,maxBuffer:1024*1024});
function snapshot(state){const db=new DatabaseSync(join(state,'state.sqlite'),{readOnly:true,defensive:true,allowExtension:false});
  try{db.exec('PRAGMA query_only=ON;BEGIN');return {protocol:db.prepare('PRAGMA user_version').get().user_version,
    records:db.prepare('SELECT * FROM records ORDER BY type,id,version').all(),heads:db.prepare('SELECT * FROM heads ORDER BY type,id').all(),events:db.prepare('SELECT * FROM events ORDER BY seq').all()};}
  finally{db.exec('ROLLBACK');db.close();}}
test('Sourced CLI: exact request/preset override admitted once, zero inference or network',t=>{
  const state=setup(t),intent='  Consulta pública\r\nCafe\u0301 · 🧪  ',args=['submit','--text',intent,'--request-id','submission:sourced-cli',
    '--preset','adaptive-v2','--entry-mode','sourced-response-v1','--allowed-tools','source.fetch'];
  const first=invoke(state,args);assert.equal(first.status,0,first.stderr);const saved=snapshot(state);
  assert.equal(saved.protocol,10);const m=JSON.parse(saved.records.find(r=>r.type==='mission').json);
  assert.equal(m.intent,intent);assert.equal(m.policy.entryMode,'sourced-response-v1');assert.equal(m.policy.model,'gpt-6-astra');assert.equal(m.policy.reasoningEffort,'ultra');
  assert.equal(m.policySelection.definition.entryMode,'closed-response-v2');assert.ok(m.policySelection.explicitOverrides.includes('entryMode'));
  assert.deepEqual(m.policy.allowedTools,['source.fetch']);assert.equal(m.policy.nativeReadTransport,undefined);
  const again=invoke(state,args);assert.equal(again.status,0,again.stderr);assert.deepEqual(snapshot(state),saved);
  assert.equal(JSON.parse(again.stdout).missionId,JSON.parse(first.stdout).missionId);
  const changed=invoke(state,args.map(x=>x==='sourced-response-v1'?'planned':x));assert.equal(changed.status,1);assert.match(changed.stderr,/SUBMISSION_CONFLICT/);assert.deepEqual(snapshot(state),saved);
  for(const type of ['run','effect','inference-request','queue-owner'])assert.equal(saved.records.filter(r=>r.type===type).length,0,type);
});
test('Sourced CLI: existing mission cannot be retrofitted by resume',t=>{
  const state=setup(t),initial=invoke(state,['submit','--text','Untouched original','--allowed-tools','']);assert.equal(initial.status,0,initial.stderr);
  const saved=snapshot(state),r=invoke(state,['resume',JSON.parse(initial.stdout).missionId,'--entry-mode','sourced-response-v1']);
  assert.equal(r.status,1);assert.match(r.stderr,/sólo se selecciona al crear/);assert.deepEqual(snapshot(state),saved);
});
test('Sourced CLI: defer-only fallback is frozen at admission and cannot be selected on another route',t=>{
  const state=setup(t),args=['submit','--text','A public source question','--request-id','submission:sourced-defer',
    '--entry-mode','sourced-response-v1','--sourced-fallback','defer-only-v1','--allowed-tools','source.fetch'];
  const first=invoke(state,args);assert.equal(first.status,0,first.stderr);const saved=snapshot(state);
  const mission=JSON.parse(saved.records.find(record=>record.type==='mission').json);
  assert.equal(mission.policy.sourcedFallback,'defer-only-v1');assert.equal(mission.policy.entryMode,'sourced-response-v1');
  const again=invoke(state,args);assert.equal(again.status,0,again.stderr);assert.deepEqual(snapshot(state),saved);
  const invalid=invoke(state,['submit','--text','No route','--sourced-fallback','defer-only-v1']);
  assert.equal(invalid.status,1);assert.match(invalid.stderr,/requiere --entry-mode sourced-response-v1/);assert.deepEqual(snapshot(state),saved);
});
test('Sourced CLI: incompatible presentation rejects before a mission exists',t=>{
  const state=setup(t),r=invoke(state,['submit','--text','No inference','--entry-mode','sourced-response-v1','--bounded-read-presentation','separate-evidence-v1']);
  assert.equal(r.status,1);assert.match(r.stderr,/^POLICY:/);const s=snapshot(state);assert.equal(s.protocol,2);
  assert.equal(s.records.filter(r=>r.type==='mission'||r.type==='queue-job'||r.type==='run').length,0);
});
test('Sourced CLI: help exposes its protocol and creates no state',t=>{
  const state=setup(t),r=invoke(state,['--help']);assert.equal(r.status,0,r.stderr);
  assert.match(r.stdout,/sourced-response-v1.*protocolo 10/);assert.match(r.stdout,/sourced-fallback defer-only-v1/);assert.equal(fs.existsSync(state),false);
});
