import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import {join,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {spawnSync} from 'node:child_process';
import * as soak from '../../reconstruction/verification/service-soak.mjs';

const repo=resolve(import.meta.dirname,'../..');
const expectedId='41f5a5b88f5b3f6457ea7a7164bbaddebde333cd773a6989376b9e6aeb96eaf4';
function fixture(){
  const root=fs.mkdtempSync(join(tmpdir(),'sovereign-soak-pinning-'));
  const verification=join(root,'reconstruction/verification');fs.mkdirSync(verification,{recursive:true});
  for(const name of ['service-soak.mjs','service-soak-runtime.mjs'])fs.copyFileSync(join(repo,'reconstruction/verification',name),join(verification,name));
  const runtime=join(verification,'fixtures',expectedId);
  fs.cpSync(join(repo,'reconstruction/verification/fixtures',expectedId),runtime,{recursive:true});
  fs.chmodSync(join(runtime,'factory/lib/contracts.mjs'),0o600);
  const mutable=join(root,'factory/lib');fs.mkdirSync(mutable,{recursive:true});
  for(const name of ['store.mjs','contracts.mjs','service-status.mjs','runtime-integrity.mjs'])fs.writeFileSync(join(mutable,name),'throw Error("MUTABLE_IMPORT_FORBIDDEN");');
  return {root,verification,runtime,mutable};
}
function probe(f,script='console.log(JSON.stringify(m.probeIdentity()));'){
  return spawnSync(process.execPath,['--input-type=module','-e',`const m=await import(${JSON.stringify(join(f.verification,'service-soak.mjs'))});${script}`],{encoding:'utf8',timeout:30000,maxBuffer:100000});
}
test('soak probe binds the exact complete frozen helper runtime, not mutable factory imports',()=>{
  assert.equal(typeof soak.probeIdentity,'function');
  const p=soak.probeIdentity();assert.equal(p.runtime.releaseId,expectedId);assert.equal(p.runtime.fileCount,4);
  assert.equal(p.runtime.verified,true);assert.equal(p.files.length,2);assert.match(p.hash,/^[a-f0-9]{64}$/);
  assert.ok(p.files.every(f=>f.path.endsWith('/service-soak.mjs')||f.path.endsWith('/service-soak-runtime.mjs')));
});
test('development modules are never loaded and editing them cannot change the frozen probe identity',()=>{
  assert.equal(typeof soak.probeIdentity,'function');const f=fixture();
  try{const a=probe(f);assert.equal(a.status,0,a.stderr);const before=JSON.parse(a.stdout);
    fs.writeFileSync(join(f.mutable,'store.mjs'),'throw Error("NEW_DEVELOPMENT_CHANGE");');
    const b=probe(f);assert.equal(b.status,0,b.stderr);assert.deepEqual(JSON.parse(b.stdout),before);
  }finally{fs.rmSync(f.root,{recursive:true});}
});
test('changed, absent, extra and linked frozen dependencies fail closed instead of using development',()=>{
  assert.equal(typeof soak.probeIdentity,'function');const f=fixture();
  // Change a transitively packaged file, not the top-level imported implementation.
  const path=join(f.runtime,'factory/lib/contracts.mjs'),original=fs.readFileSync(path);
  try{for(const kind of ['changed','missing','extra','symlink']){
    if(kind==='changed')fs.appendFileSync(path,' ');
    if(kind==='missing')fs.renameSync(path,path+'.missing');
    if(kind==='extra')fs.writeFileSync(join(f.runtime,'unexpected.txt'),'extra');
    if(kind==='symlink'){fs.renameSync(path,path+'.target');fs.symlinkSync(path+'.target',path);}
    const r=probe(f);assert.notEqual(r.status,0,kind+' must reject');assert.ok(!r.stderr.includes('MUTABLE_IMPORT_FORBIDDEN'));
    if(kind==='changed')fs.writeFileSync(path,original);
    if(kind==='missing')fs.renameSync(path+'.missing',path);
    if(kind==='extra')fs.unlinkSync(join(f.runtime,'unexpected.txt'));
    if(kind==='symlink'){fs.unlinkSync(path);fs.renameSync(path+'.target',path);}
  }}finally{fs.rmSync(f.root,{recursive:true});}
});
test('post-load helper mutation is retained as failed sample without service inspection',()=>{
  assert.equal(typeof soak.probeIdentity,'function');const f=fixture();
  try{const path=join(f.runtime,'factory/lib/contracts.mjs');
    const r=probe(f,`const fs=await import('node:fs');fs.appendFileSync(${JSON.stringify(path)},' ');console.log(JSON.stringify(m.captureSample(null,{sampleId:'soak-sample:corrupt-probe'})));`);
    assert.equal(r.status,0,r.stderr);const s=JSON.parse(r.stdout);assert.equal(s.healthy,false);assert.equal(s.failure.code,'RELEASE_INTEGRITY');assert.equal(s.observation,undefined);
  }finally{fs.rmSync(f.root,{recursive:true});}
});
test('a post-load observer source edit fails instead of attesting new bytes as loaded code',()=>{
  const f=fixture();
  try{for(const name of ['service-soak.mjs','service-soak-runtime.mjs']){
    const r=probe(f,`const fs=await import('node:fs');fs.appendFileSync(${JSON.stringify(join(f.verification,name))},${JSON.stringify('\n// edited fixture\n')});console.log(JSON.stringify(m.captureSample(null,{sampleId:'soak-sample:source-edit'})));`);
    assert.equal(r.status,0,r.stderr);const s=JSON.parse(r.stdout);assert.equal(s.healthy,false);assert.equal(s.failure.code,'SOAK_PROBE_CHANGED');assert.equal(s.observation,undefined);
  }}finally{fs.rmSync(f.root,{recursive:true});}
});
test('a symlinked runtime parent is rejected and cannot silently redirect dependencies',()=>{
  const f=fixture(),parent=join(f.verification,'fixtures'),moved=join(f.verification,'relocated-fixtures');
  try{fs.renameSync(parent,moved);fs.symlinkSync(moved,parent);const r=probe(f);assert.notEqual(r.status,0);assert.match(r.stderr,/SOAK_PATH|cannot be redirected/);
  }finally{fs.rmSync(f.root,{recursive:true});}
});
test('new probe never inherits old sampled hours; same version resumes only subsequent observed interval',()=>{
  const p=soak.probeIdentity();
  const make=(minute,probeHash)=>({id:'soak-sample:'+minute,capturedAt:new Date(Date.UTC(2026,8,14,0,minute)).toISOString(),probeHash,healthy:true,
    observation:{clock:{bootId:'same',uptimeMs:minute*60000,wallTime:new Date(Date.UTC(2026,8,14,0,minute)).toISOString()},
      process:{pid:1,startTicks:'1',executableHash:'same'},service:{properties:{NRestarts:'0'}},release:{releaseId:'same'},unitHash:'same',wrapperHash:'same',
      database:{identity:{path:'same'},predecessor:'EXTENDS',owner:{ownerId:'same',epoch:1}}}});
  const old=[make(0,'old'),make(30,'old'),make(60,'old')],first=soak.evaluateSoak([...old,make(90,p.hash)]);
  assert.equal(first.currentSegmentMs,0);assert.equal(first.longestSampledSegmentMs,3600000);assert.deepEqual(first.incidents.at(-1).codes,['PROBE_CHANGED']);
  const next=soak.evaluateSoak([...old,make(90,p.hash),make(120,p.hash)]);
  assert.equal(next.currentSegmentMs,1800000);assert.equal(next.longestSampledSegmentMs,3600000);assert.equal(next.continuousUptimeProven,false);
});
