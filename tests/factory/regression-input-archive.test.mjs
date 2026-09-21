import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {join} from 'node:path';
import {tmpdir} from 'node:os';import {createHash} from 'node:crypto';
import {archiveRegressionInputs,verifyRegressionInputArchive,assertCurrentRegressionInputs} from '../../reconstruction/verification/regression-input-archive.mjs';
const hash=b=>createHash('sha256').update(b).digest('hex');
function fixture(t){
  const root=fs.mkdtempSync(join(tmpdir(),'sovereign-regression-input-')),repository=join(root,'repository'),directory=join(root,'archive');
  fs.mkdirSync(repository);t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  return {root,repository,directory,put(path,bytes){fs.mkdirSync(join(repository,path,'..'),{recursive:true});fs.writeFileSync(join(repository,path),bytes);return hash(bytes);}};
}
test('archive retains exact BOM, CRLF, Unicode and zero-byte input, with deterministic names and private permissions',t=>{
  const f=fixture(t),body=Buffer.from('\ufeffá\r\n最后\n'),inputs={'test/zero.mjs':f.put('test/zero.mjs',Buffer.alloc(0)),'test/a.mjs':f.put('test/a.mjs',body)};
  const r=archiveRegressionInputs({...f,inputs});assert.equal(r.fileCount,2);assert.equal(r.phase,'prospective');
  assert.equal(fs.statSync(f.directory).mode&0o777,0o700);assert.equal(fs.statSync(join(f.directory,'manifest.json')).mode&0o777,0o600);
  assert.deepEqual(fs.readFileSync(join(f.directory,'blobs',hash(body))),body);
  assert.deepEqual(verifyRegressionInputArchive({directory:f.directory,inputs,manifestSha256:r.manifestSha256}),r);
});
test('identical contents share one blob without losing either exact path',t=>{
  const f=fixture(t),inputs={'a.mjs':f.put('a.mjs','same'),'b.mjs':f.put('b.mjs','same')};
  const r=archiveRegressionInputs({...f,inputs});assert.equal(r.fileCount,2);assert.equal(r.blobCount,1);
  assert.equal(JSON.parse(fs.readFileSync(join(f.directory,'manifest.json'))).files.length,2);
  assert.equal(verifyRegressionInputArchive({...f,inputs}).blobCount,1);
});
test('later edits to the working tree do not overwrite archived bytes but fail the current-input check',t=>{
  const f=fixture(t),inputs={'a.mjs':f.put('a.mjs','original')},r=archiveRegressionInputs({...f,inputs});
  f.put('a.mjs','later change');assert.deepEqual(verifyRegressionInputArchive({...f,inputs,manifestSha256:r.manifestSha256}),r);
  assert.throws(()=>assertCurrentRegressionInputs({...f,inputs}),/Pinned input changed/);
  assert.equal(fs.readFileSync(join(f.directory,'blobs',inputs['a.mjs']),'utf8'),'original');
});
test('post-close matching capture is labeled, never represented as prospective evidence',t=>{
  const f=fixture(t),inputs={'a.mjs':f.put('a.mjs','old')};
  const r=archiveRegressionInputs({...f,inputs,phase:'post-close-matching'});
  assert.equal(r.phase,'post-close-matching');assert.equal(verifyRegressionInputArchive({...f,inputs}).phase,'post-close-matching');
});
test('source hash mismatch refuses before producing output',t=>{
  const f=fixture(t);f.put('a.mjs','changed');assert.throws(()=>archiveRegressionInputs({...f,inputs:{'a.mjs':hash('old')}}),/Pinned input changed/);
  assert.equal(fs.existsSync(f.directory),false);
});
test('missing source refuses before producing output',t=>{
  const f=fixture(t);assert.throws(()=>archiveRegressionInputs({...f,inputs:{'absent.mjs':hash('old')}}),{code:'ENOENT'});
  assert.equal(fs.existsSync(f.directory),false);
});
test('archive never overwrites or clears an existing directory',t=>{
  const f=fixture(t),inputs={'a.mjs':f.put('a.mjs','original')};fs.mkdirSync(f.directory);fs.writeFileSync(join(f.directory,'keep'),'keep');
  assert.throws(()=>archiveRegressionInputs({...f,inputs}),/never overwrite/);assert.equal(fs.readFileSync(join(f.directory,'keep'),'utf8'),'keep');
});
for(const path of ['../escape.mjs','/absolute.mjs','a/../escape.mjs','a//b.mjs','./a.mjs','a\\b.mjs','a\0b'])test('invalid archive source path is rejected: '+JSON.stringify(path),t=>{
  const f=fixture(t);assert.throws(()=>archiveRegressionInputs({...f,inputs:{[path]:hash('x')}}),/Invalid pinned input/);assert.equal(fs.existsSync(f.directory),false);
});
for(const kind of ['file','parent'])test('source '+kind+' symlink cannot redirect acquisition',t=>{
  const f=fixture(t),outside=join(f.root,'outside');fs.mkdirSync(outside);fs.writeFileSync(join(outside,'a.mjs'),'outside');
  if(kind==='file')fs.symlinkSync(join(outside,'a.mjs'),join(f.repository,'a.mjs'));else fs.symlinkSync(outside,join(f.repository,'linked'));
  const path=kind==='file'?'a.mjs':'linked/a.mjs';assert.throws(()=>archiveRegressionInputs({...f,inputs:{[path]:hash('outside')}}),{code:'REGRESSION_INPUT_ARCHIVE'});
  assert.equal(fs.existsSync(f.directory),false);
});
test('unlisted files are not captured',t=>{
  const f=fixture(t),inputs={'a.mjs':f.put('a.mjs','included')};f.put('not-an-input.txt','unrelated');
  const r=archiveRegressionInputs({...f,inputs});assert.equal(r.fileCount,1);assert.equal(fs.readdirSync(join(f.directory,'blobs')).length,1);
});
test('modified blob, even with the old filename, is rejected',t=>{
  const f=fixture(t),inputs={'a.mjs':f.put('a.mjs','original')};archiveRegressionInputs({...f,inputs});
  fs.writeFileSync(join(f.directory,'blobs',inputs['a.mjs']),'tampered');assert.throws(()=>verifyRegressionInputArchive({...f,inputs}),/Archived input bytes changed/);
});
test('manifest mutation and different input map are independently rejected',t=>{
  const f=fixture(t),inputs={'a.mjs':f.put('a.mjs','original')},r=archiveRegressionInputs({...f,inputs});
  assert.throws(()=>verifyRegressionInputArchive({...f,inputs:{'b.mjs':inputs['a.mjs']}}),/Archive map differs/);
  fs.appendFileSync(join(f.directory,'manifest.json'),' ');assert.throws(()=>verifyRegressionInputArchive({...f,inputs,manifestSha256:r.manifestSha256}),/Archive manifest changed/);
});
test('symlink replacement of an archived object is rejected, even when bytes match',t=>{
  const f=fixture(t),inputs={'a.mjs':f.put('a.mjs','original')};archiveRegressionInputs({...f,inputs});const path=join(f.directory,'blobs',inputs['a.mjs']);
  fs.unlinkSync(path);fs.symlinkSync(join(f.repository,'a.mjs'),path);assert.throws(()=>verifyRegressionInputArchive({...f,inputs}),/regular file/);
});
test('additional objects are not silently admitted to the archive',t=>{
  const f=fixture(t),inputs={'a.mjs':f.put('a.mjs','original')};archiveRegressionInputs({...f,inputs});
  fs.writeFileSync(join(f.directory,'blobs','extra'),'x');assert.throws(()=>verifyRegressionInputArchive({...f,inputs}),/Unexpected archive objects/);
});
test('malformed map and unsupported phase fail without output',t=>{
  const f=fixture(t);for(const inputs of [null,[],{}, {'a.mjs':'not-a-hash'}])assert.throws(()=>archiveRegressionInputs({...f,inputs}),{code:'REGRESSION_INPUT_ARCHIVE'});
  const inputs={'a.mjs':f.put('a.mjs','a')};assert.throws(()=>archiveRegressionInputs({...f,inputs,phase:'retroactive-pass'}),/capture phase/);
  assert.equal(fs.existsSync(f.directory),false);
});
