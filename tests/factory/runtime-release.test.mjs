import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {buildRuntimeRelease,verifyRuntimeRelease,collectRuntimeFiles} from '../../factory/lib/runtime-release.mjs';
function directory(t){const path=fs.mkdtempSync(join(tmpdir(),'factory-release-'));t.after(()=>fs.rmSync(path,{recursive:true}));return path;}
test('REAL package: all 154 complete cards load using the copied runtime and its bundled source paths',t=>{
  const dir=directory(t),files=collectRuntimeFiles(),built=buildRuntimeRelease(dir,{files});
  assert.ok(built.verified);assert.ok(built.fileCount>154);
  const child=spawnSync(process.execPath,[join(built.directory,'factory/bin/sovereign.mjs'),'roles'],{cwd:dir,encoding:'utf8',timeout:30000,maxBuffer:4*1024*1024});
  assert.equal(child.status,0,child.stderr);assert.equal(JSON.parse(child.stdout).length,154);
  assert.equal(buildRuntimeRelease(dir,{files}).reused,true);assert.equal(verifyRuntimeRelease(built.directory).releaseId,built.releaseId);
  assert.ok(files.every(f=>!f.path.includes('.git/')&&!f.path.includes('auth.json')&&!f.path.endsWith('.sqlite')));
  fs.unlinkSync(join(built.directory,'RELEASE.json'));
  const missing=spawnSync(process.execPath,[join(built.directory,'factory/bin/sovereign.mjs'),'--help'],{cwd:dir,encoding:'utf8',timeout:30000});
  assert.notEqual(missing.status,0,'Deleting the manifest cannot silently turn the installed runtime into an unverified development checkout');
});
test('REAL package: deterministic identity, changed bytes create distinct preserved versions',t=>{
  const dir=directory(t),first=buildRuntimeRelease(dir,{files:[{path:'a.txt',content:'first'}]}),second=buildRuntimeRelease(dir,{files:[{path:'a.txt',content:'second'}]});
  assert.notEqual(first.releaseId,second.releaseId);assert.equal(fs.readFileSync(join(first.directory,'a.txt'),'utf8'),'first');
  assert.equal(verifyRuntimeRelease(first.directory).verified,true);
});
test('REAL package: tampering, extra files, missing files, symlinks and manifest identity fail verification',t=>{
  const dir=directory(t);
  for(const mode of ['tamper','extra','missing','symlink','manifest']){
    const result=buildRuntimeRelease(join(dir,mode),{files:[{path:'a.txt',content:'original'}]}),file=join(result.directory,'a.txt');
    if(mode==='tamper'){fs.chmodSync(file,0o600);fs.writeFileSync(file,'tampered');}
    if(mode==='extra')fs.writeFileSync(join(result.directory,'extra.txt'),'unexpected');
    if(mode==='missing')fs.unlinkSync(file);
    if(mode==='symlink'){fs.unlinkSync(file);fs.symlinkSync('/dev/null',file);}
    if(mode==='manifest'){const path=join(result.directory,'RELEASE.json');fs.chmodSync(path,0o600);const m=JSON.parse(fs.readFileSync(path));m.releaseId='0'.repeat(64);fs.writeFileSync(path,JSON.stringify(m));}
    assert.throws(()=>verifyRuntimeRelease(result.directory));
  }
});
test('REAL package: traversal, duplicates and symlink release parent rejected before writing payload',t=>{
  const dir=directory(t);
  for(const path of ['../outside','/absolute','a/../../outside','a\\b','a//b','RELEASE.json'])assert.throws(()=>buildRuntimeRelease(dir,{files:[{path,content:'no'}]}),{code:'RELEASE_PATH'});
  assert.throws(()=>buildRuntimeRelease(dir,{files:[{path:'a',content:'1'},{path:'a',content:'2'}]}),{code:'RELEASE_MANIFEST'});
  fs.symlinkSync(dir,join(dir,'linked'));assert.throws(()=>buildRuntimeRelease(join(dir,'linked'),{files:[{path:'a',content:'no'}]}),{code:'RELEASE_PATH'});
});
