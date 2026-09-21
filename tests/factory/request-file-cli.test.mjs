import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {join} from 'node:path';import {tmpdir} from 'node:os';
import {spawnSync} from 'node:child_process';import {DatabaseSync} from 'node:sqlite';
const cli=new URL('../../factory/bin/sovereign.mjs',import.meta.url).pathname;
function fixture(t){const dir=fs.mkdtempSync(join(tmpdir(),'sovereign-request-file-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));return dir;}
function invoke(state,command,args=[]){return spawnSync(process.execPath,[cli,command,'--state-dir',state,...args],{encoding:'utf8',timeout:20000,maxBuffer:1024*1024});}
function inspect(state){const path=join(state,'state.sqlite');if(!fs.existsSync(path))return {records:[],protocol:null};
  const db=new DatabaseSync(path,{readOnly:true,defensive:true,allowExtension:false});try{db.exec('PRAGMA query_only=ON;PRAGMA trusted_schema=OFF;BEGIN');
    return {protocol:db.prepare('PRAGMA user_version').get().user_version,records:db.prepare('SELECT type,id,version,json FROM records ORDER BY type,id,version').all().map(r=>({...r,data:JSON.parse(r.json)}))};
  }finally{if(db.isTransaction)db.exec('ROLLBACK');db.close();}}
function unpublished(state){const s=inspect(state);for(const type of ['mission','queue-job','run','inference-request','effect','mission-input-manifest','mission-input-bytes','tool-workspace'])assert.equal(s.records.filter(r=>r.type===type).length,0,type);}

for(const command of ['submit','run'])for(const kind of ['invalid-utf8','surrogate-utf8','overlong-utf8','truncated-utf8','symlink','parent-symlink','hardlink','directory','fifo','oversize','missing'])test('real CLI '+command+' rejects unsafe request file: '+kind,t=>{
  const dir=fixture(t),state=join(dir,'state');let source=join(dir,'request.txt');
  if(kind==='invalid-utf8')fs.writeFileSync(source,Buffer.from([0x61,0xc3,0x28]));
  else if(kind==='surrogate-utf8')fs.writeFileSync(source,Buffer.from([0xed,0xa0,0x80]));
  else if(kind==='overlong-utf8')fs.writeFileSync(source,Buffer.from([0xc0,0xaf]));
  else if(kind==='truncated-utf8')fs.writeFileSync(source,Buffer.from([0xf0,0x9f,0xa7]));
  else if(kind==='directory')fs.mkdirSync(source);
  else if(kind==='fifo'){const r=spawnSync('mkfifo',[source],{timeout:5000,encoding:'utf8'});assert.equal(r.status,0,r.stderr);}
  else if(kind==='parent-symlink'){const real=join(dir,'real');fs.mkdirSync(real);fs.writeFileSync(join(real,'request.txt'),'Do not execute; fixture.');fs.symlinkSync(real,join(dir,'link'));source=join(dir,'link','request.txt');}
  else if(kind==='oversize')fs.writeFileSync(source,Buffer.alloc(1024*1024+1,65));
  else if(kind==='symlink'){const target=join(dir,'real.txt');fs.writeFileSync(target,'Do not execute; fixture.');fs.symlinkSync(target,source);}
  else if(kind==='hardlink'){const target=join(dir,'real.txt');fs.writeFileSync(target,'Do not execute; fixture.');fs.linkSync(target,source);}
  // Invalid budget is a second independent no-inference guard: if file admission
  // regresses, policy rejects before creating/dispatching a mission. It must NOT
  // be the observed failure: file validation occurs first in both CLI branches.
  const r=invoke(state,command,['--file',source,'--mission-call-limit','0']);assert.equal(r.error,undefined);assert.notEqual(r.status,0);
  const code=kind.endsWith('-utf8')?'ENCODING':kind==='missing'?'ENOENT':kind==='oversize'?'WORKSPACE_LIMIT':'WORKSPACE_PATH';
  assert.match(r.stderr,new RegExp('^'+code+':'));unpublished(state);
});

for(const command of ['submit','run'])for(const text of ['', 'request\0suffix'])test('real CLI '+command+' preserves original request rejection for '+(text?'NUL':'empty')+' text',t=>{
  const dir=fixture(t),source=join(dir,'request.txt'),state=join(dir,'state');fs.writeFileSync(source,text);
  const r=invoke(state,command,['--file',source,'--mission-call-limit','0']);assert.equal(r.error,undefined);assert.notEqual(r.status,0);assert.match(r.stderr,/^SCHEMA: original request/);unpublished(state);
});

test('real CLI --file preserves BOM, CRLF, whitespace and exact Unicode without treating request as an attachment',t=>{
  const dir=fixture(t),source=join(dir,'request.txt'),state=join(dir,'state'),text='\uFEFF  Petición\r\nCafe\u0301 / Café\u00a0🧪\n  ';
  const bytes=Buffer.from(text);fs.writeFileSync(source,bytes);
  const args=['--file',source,'--allowed-tools','','--request-id','submission:exact-request'];
  const first=invoke(state,'submit',args);assert.equal(first.status,0,first.stderr);const id=JSON.parse(first.stdout).missionId;
  const second=invoke(state,'submit',args);assert.equal(second.status,0,second.stderr);assert.equal(JSON.parse(second.stdout).missionId,id);
  let snapshot=inspect(state),missions=snapshot.records.filter(r=>r.type==='mission');assert.equal(missions.length,1);assert.equal(missions[0].data.intent,text);assert.deepEqual(Buffer.from(missions[0].data.intent),bytes);
  // Mission creation now stamps the prospective planning-close protocol even
  // though this test deliberately does not create a run or dispatch a worker.
  assert.equal(snapshot.protocol,15);for(const type of ['run','inference-request','effect','mission-input-manifest','mission-input-bytes','input-preparation'])assert.equal(snapshot.records.filter(r=>r.type===type).length,0,type);
  const workspaces=snapshot.records.filter(r=>r.type==='tool-workspace');assert.equal(workspaces.length,1);assert.deepEqual(fs.readdirSync(workspaces[0].data.path),[]);
  fs.writeFileSync(source,text+'changed');const changed=invoke(state,'submit',args);assert.notEqual(changed.status,0);snapshot=inspect(state);assert.equal(snapshot.records.filter(r=>r.type==='mission').length,1);
  assert.equal(snapshot.records.find(r=>r.type==='mission').data.intent,text);
});
test('request byte cap is unchanged: maximum multibyte text fits and one more byte fails',t=>{
  const dir=fixture(t),source=join(dir,'request.txt'),state=join(dir,'max'),cap=256*1024,text='漢'.repeat(Math.floor(cap/3))+'a'.repeat(cap%3);assert.equal(Buffer.byteLength(text),cap);fs.writeFileSync(source,text);
  const valid=invoke(state,'submit',['--file',source,'--allowed-tools','']);assert.equal(valid.status,0,valid.stderr);
  assert.equal(inspect(state).records.find(r=>r.type==='mission').data.intent,text);
  fs.writeFileSync(source,text+'a');const beyond=join(dir,'beyond'),invalid=invoke(beyond,'submit',['--file',source,'--mission-call-limit','0']);assert.notEqual(invalid.status,0);assert.match(invalid.stderr,/original request/);unpublished(beyond);
});
test('request --file, explicit --text and attached data remain distinct',t=>{
  const dir=fixture(t),request=join(dir,'request.txt'),data=join(dir,'data.txt'),manifest=join(dir,'inputs.json'),state=join(dir,'files');
  fs.writeFileSync(request,'Read data.txt; fixture only.');fs.writeFileSync(data,'original data');fs.writeFileSync(manifest,JSON.stringify([{source:data,path:'data.txt'}]));
  const r=invoke(state,'submit',['--file',request,'--inputs',manifest]);assert.equal(r.status,0,r.stderr);const s=inspect(state);assert.equal(s.protocol,15);
  assert.equal(s.records.find(r=>r.type==='mission').data.intent,'Read data.txt; fixture only.');const m=s.records.find(r=>r.type==='mission-input-manifest').data;assert.equal(m.files.length,1);assert.equal(m.files[0].path,'data.txt');
  assert.equal(s.records.filter(r=>r.type==='run'||r.type==='inference-request'||r.type==='effect').length,0);
  const textState=join(dir,'text'),literal='  Explicit\r\nCafe\u0301  ',tResult=invoke(textState,'submit',['--text',literal]);assert.equal(tResult.status,0,tResult.stderr);
  assert.equal(inspect(textState).records.find(r=>r.type==='mission').data.intent,literal);
});
