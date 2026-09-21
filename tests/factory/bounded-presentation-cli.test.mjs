import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {spawnSync} from 'node:child_process';
import {DatabaseSync} from 'node:sqlite';
import {sha256} from '../../factory/lib/contracts.mjs';
import {Store} from '../../factory/lib/store.mjs';

const cli=new URL('../../factory/bin/sovereign.mjs',import.meta.url).pathname;
const flag='--bounded-read-presentation',presentation='separate-evidence-v1';
const selected=['--entry-mode','bounded-read-response-v1',flag,presentation];
const simPreload=new URL('./fixtures/presentation-cli-provider.mjs',import.meta.url).pathname;
function fixture(t){const dir=fs.mkdtempSync(join(tmpdir(),'sovereign-presentation-cli-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));return dir;}
function invoke(state,args){return spawnSync(process.execPath,[cli,...args,'--state-dir',state],{encoding:'utf8',timeout:20000,maxBuffer:1024*1024});}
function success(state,args){const r=invoke(state,args);assert.equal(r.error,undefined);assert.equal(r.status,0,r.stderr);return JSON.parse(r.stdout);}
function snapshot(state){const path=join(state,'state.sqlite');if(!fs.existsSync(path))return null;
  const db=new DatabaseSync(path,{readOnly:true,defensive:true,allowExtension:false});
  try{db.exec('PRAGMA query_only=ON;PRAGMA trusted_schema=OFF;BEGIN');
    return {protocol:db.prepare('PRAGMA user_version').get().user_version,
      records:db.prepare('SELECT * FROM records ORDER BY type,id,version').all(),
      heads:db.prepare('SELECT * FROM heads ORDER BY type,id').all(),events:db.prepare('SELECT * FROM events ORDER BY seq').all()};
  }finally{if(db.isTransaction)db.exec('ROLLBACK');db.close();}
}
function inert(state){const s=snapshot(state);if(!s)return;
  for(const type of ['mission','queue-job','submission','run','inference-request','effect','mission-input-manifest','mission-input-bytes','input-preparation','tool-workspace','queue-owner'])
    assert.equal(s.records.filter(r=>r.type===type).length,0,type);
  // FactoryEngine initializes exactly one local signing authority even without
  // a mission. Its existing bootstrap advances 1 -> 2, not the opt-in floor9.
  assert.equal(s.protocol,2);assert.equal(s.events.length,1);
  assert.deepEqual(s.records.map(r=>[r.type,r.id,r.version]),[['authority-key','local-authority-v1',1]]);
  assert.deepEqual(s.heads.map(r=>[r.type,r.id,r.version]),[['authority-key','local-authority-v1',1]]);
  assert.equal(s.events[0].kind,'record.committed');assert.equal(JSON.parse(s.events[0].json).type,'authority-key');
}
function records(s,type){const heads=new Map(s.heads.filter(r=>r.type===type).map(r=>[r.id,r.version]));
  return s.records.filter(r=>r.type===type&&r.version===heads.get(r.id)).map(r=>JSON.parse(r.json));}

test('presentation CLI: explicit submission preserves literal inputs, authority, budgets and idempotence with zero inference',t=>{
  const dir=fixture(t),state=join(dir,'state'),source=join(dir,'source.txt'),manifest=join(dir,'manifest.json');
  const intent='  Petición\r\nCafe\u0301 · 🧪  ',content='\uFEFF  dato\r\n\u0065\u0301 / é\n';
  fs.writeFileSync(source,content);fs.writeFileSync(manifest,JSON.stringify([{source,path:'entrada.txt'}]));
  const args=['submit','--text',intent,'--inputs',manifest,'--request-id','submission:presentation-cli',
    '--preset','adaptive-v2',...selected,'--allowed-tools','workspace.read','--mission-call-limit','3'];
  const job=success(state,args),before=snapshot(state),mission=records(before,'mission')[0];
  assert.equal(mission.intent,intent);assert.equal(mission.policy.boundedReadPresentation,presentation);
  assert.equal(mission.policy.nativeReadTransport,undefined);assert.deepEqual(mission.policy.allowedTools,['workspace.read']);
  assert.deepEqual(mission.policy.inferenceBudget,{mode:'mission-calls-v1',maxCalls:3});
  assert.equal(mission.policySelection.definition.entryMode,'closed-response-v2');
  assert.equal(mission.policySelection.definition.boundedReadPresentation,undefined);
  assert.equal(mission.policySelection.effectivePolicyHash,sha256(mission.policy));
  assert.ok(mission.policySelection.explicitOverrides.includes('boundedReadPresentation'));
  assert.equal(before.protocol,9);const input=records(before,'mission-input-manifest')[0].files[0];
  assert.equal(input.path,'entrada.txt');assert.equal(input.bytes,Buffer.byteLength(content));assert.equal(input.sha256,sha256(Buffer.from(content)));
  assert.equal(success(state,args).missionId,job.missionId);assert.deepEqual(snapshot(state),before);
  for(const change of [args.filter((x,i)=>i!==args.indexOf(flag)&&i!==args.indexOf(flag)+1),args.map(x=>x===presentation?'unknown':x)]){
    const r=invoke(state,change);assert.equal(r.status,1);assert.match(r.stderr,/^SUBMISSION_CONFLICT:/);assert.deepEqual(snapshot(state),before);
  }
  for(const type of ['run','inference-request','effect','queue-owner','input-preparation','native-read-attempt'])assert.equal(records(before,type).length,0,type);
  const s=new Store(join(state,'state.sqlite'));try{s.verifyJournal();}finally{s.close();}
});

const invalids=[
  {name:'unknown value',args:['--entry-mode','bounded-read-response-v1',flag,'unknown'],error:/^POLICY: Separate bounded/},
  {name:'empty value',args:['--entry-mode','bounded-read-response-v1',flag,''],error:/^POLICY: Separate bounded/},
  {name:'missing entry',args:[flag,presentation],error:/^POLICY: Separate bounded/},
  {name:'planned entry',args:['--entry-mode','planned',flag,presentation],error:/^POLICY: Separate bounded/},
  {name:'preset v1 without bounded override',args:['--preset','adaptive-v1',flag,presentation],error:/^POLICY: Separate bounded/},
  {name:'preset v2 without bounded override',args:['--preset','adaptive-v2',flag,presentation],error:/^POLICY: Separate bounded/},
  {name:'source text representation',args:[...selected,'--context-encoding','source-text-v1'],error:/^POLICY: Bounded read entry requires/}
];
for(const command of ['submit','run'])for(const {name,args,error} of invalids)test(`presentation CLI: ${command} rejects ${name} before any material mutation`,t=>{
  const dir=fixture(t),state=join(dir,'state'),source=join(dir,'source.txt'),manifest=join(dir,'inputs.json');
  fs.writeFileSync(source,'Explicit fixture only');fs.writeFileSync(manifest,JSON.stringify([{source,path:'source.txt'}]));
  // A second no-inference guard must never become the observed error. Policy
  // validation of presentation/entry precedes budget validation in the engine.
  const r=invoke(state,[command,'--text','No execution allowed in this invalid-policy fixture.','--inputs',manifest,...args,'--mission-call-limit','0']);
  assert.equal(r.error,undefined);assert.equal(r.status,1);assert.match(r.stderr,error);inert(state);
});

test('presentation CLI: creation-only guard preserves exact existing state for every non-creation command',t=>{
  const dir=fixture(t),state=join(dir,'state'),job=success(state,['submit','--text','Untouched old mission','--allowed-tools','']);
  const before=snapshot(state);
  for(const command of ['status','show','plan','report','resume','retry-review','queue','continue','pause','cancel','serve','doctor','service-status','roles','learn-list','learn-observe','learn-propose']){
    const r=invoke(state,[command,job.missionId,flag,presentation]);assert.equal(r.error,undefined);assert.equal(r.status,1);
    assert.match(r.stderr,/^ERROR: La presentación acotada sólo se selecciona al crear una misión/);assert.deepEqual(snapshot(state),before,command);
  }
});
test('presentation CLI: help describes explicit floor9 correction and creates no state',t=>{
  const state=join(fixture(t),'absent'),r=invoke(state,['run','--help',flag,presentation]);assert.equal(r.status,0,r.stderr);
  assert.match(r.stdout,/--bounded-read-presentation separate-evidence-v1/);assert.match(r.stdout,/protocolo 9/);
  assert.match(r.stdout,/no cambia transporte/);assert.equal(fs.existsSync(state),false);
});
test('presentation CLI: native transport remains unpublished; adaptive-v3 is a separate public preset',t=>{
  const dir=fixture(t),state=join(dir,'state');
  const native=invoke(state,['submit','--text','Must not execute','--native-read-transport','native-read-v1']);assert.equal(native.status,1);assert.match(native.stderr,/Unknown option '--native-read-transport'/);inert(state);
  const job=success(state,['submit','--text','Must not execute','--preset','adaptive-v3','--allowed-tools','']),after=snapshot(state),mission=records(after,'mission').find(m=>m.id===job.missionId);
  assert.equal(mission.policySelection.presetId,'adaptive-v3');assert.equal(mission.policy.entryMode,'planned');
  assert.equal(mission.policy.nativeReadTransport,undefined);assert.equal(mission.policy.boundedReadPresentation,undefined);
  // New planned missions also retain the planning close origin atomically, so
  // the stronger protocol 15 floor supersedes the route's own protocol 13.
  assert.equal(after.protocol,15);assert.equal(records(after,'adaptive-v3-route').length,1);
});
test('presentation CLI: implicit policy and both frozen presets remain exact across an upgraded database',t=>{
  const dir=fixture(t),state=join(dir,'state'),legacy=[];
  for(const preset of [null,'adaptive-v1','adaptive-v2']){
    const args=['submit','--text','Same old policy',...(preset?['--preset',preset]:[])];
    const m=success(state,['status',success(state,args).missionId,'--json']).mission;legacy.push({args,m});
  }
  const before=snapshot(state);success(state,['submit','--text','Only this mission selects the correction',...selected,'--allowed-tools','']);
  for(const {args,m}of legacy){assert.deepEqual(success(state,['status',m.id,'--json']).mission,m);
    const next=success(state,['status',success(state,args).missionId,'--json']).mission;
    assert.deepEqual(next.policy,m.policy);assert.deepEqual(next.policySelection,m.policySelection);
    assert.equal(next.policy.boundedReadPresentation,undefined);assert.equal(next.policy.nativeReadTransport,undefined);
  }
  // The presentation contract stays protocol 9; creating a planned mission in
  // the same database may promote it further for the independent close barrier.
  const after=snapshot(state);assert.equal(after.protocol,15);
  for(const record of before.records)assert.deepEqual(after.records.find(r=>r.type===record.type&&r.id===record.id&&r.version===record.version),record);
  assert.deepEqual(after.events.slice(0,before.events.length),before.events);
});

for(const read of [false,true])test('presentation CLI: real run/resume with SIM inference and '+(read?'actual independent input reads':'literal output with forbidden input unread'),t=>{
  const dir=fixture(t),state=join(dir,'state'),source=join(dir,'source.txt'),manifest=join(dir,'manifest.json');
  const intent=read?'Read only input.txt. Return exactly JSON {"sum":30} from the two supplied integers. No other fields, proof, or prose.'
    :'Do not read any attached file. Return exactly Órbita e\u0301 🚀 without newline, quotes or explanation.';
  fs.writeFileSync(source,read?'13\n17\n':'NEVER_READ_PRESENTATION_CLI_5197');fs.writeFileSync(manifest,JSON.stringify([{source,path:'input.txt'}]));
  const run=(args)=>spawnSync(process.execPath,['--import',simPreload,cli,...args,'--state-dir',state,'--json'],
    {env:{...process.env,SOVEREIGN_PRESENTATION_CLI_SIM:'1',SOVEREIGN_PRESENTATION_CLI_READ:read?'1':'0'},encoding:'utf8',timeout:30000,maxBuffer:1024*1024});
  const first=run(['run','--text',intent,'--inputs',manifest,...selected,'--profile','scoped-v1','--allowed-tools','workspace.read','--mission-call-limit',read?'3':'2']);
  assert.equal(first.error,undefined);assert.equal(first.status,0,first.stderr);const result=JSON.parse(first.stdout);
  assert.equal(result.mission.status,'COMPLETED');assert.equal(result.outcome.status,'ACCEPTED');assert.equal(result.outcome.payload.body,read?'{"sum":30}':'Órbita e\u0301 🚀');
  assert.equal(result.mission.policy.nativeReadTransport,undefined);assert.equal(result.mission.intent,intent);
  const traces=first.stderr.split('\n').filter(x=>x.startsWith('SIM_PRESENTATION_CALL ')).map(x=>JSON.parse(x.slice(22)));
  assert.equal(traces.length,read?3:2);assert.equal(traces.filter(x=>x.reviewer).length,1);
  assert.equal(traces.at(-1).ownReads,read?1:0);for(const trace of traces)assert.equal(trace.missionIntent,intent);
  const before=snapshot(state);assert.equal(records(before,'effect').length,read?2:0);
  assert.equal(records(before,'mission-inference-call').length,read?3:2);assert.equal(records(before,'queue-owner').length,0);
  const again=run(['resume',result.mission.id]);assert.equal(again.error,undefined);assert.equal(again.status,0,again.stderr);
  assert.equal(JSON.parse(again.stdout).outcome.id,result.outcome.id);assert.ok(!again.stderr.includes('SIM_PRESENTATION_CALL '));
  const after=snapshot(state);assert.equal(records(after,'mission-inference-call').length,read?3:2);
  assert.equal(records(after,'effect').length,read?2:0);for(const row of before.records)assert.deepEqual(after.records.find(r=>r.type===row.type&&r.id===row.id&&r.version===row.version),row);
  const s=new Store(join(state,'state.sqlite'));try{s.verifyJournal();}finally{s.close();}
});
