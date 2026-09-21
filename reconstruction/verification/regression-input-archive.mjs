// Exact bytes of the explicitly pinned regression inputs. This is not a
// filesystem-wide snapshot, execution sandbox, secret backup or test result.
import fs from 'node:fs';
import {join,resolve,isAbsolute} from 'node:path';
import {createHash} from 'node:crypto';
const hash=b=>createHash('sha256').update(b).digest('hex');
const check=(condition,message)=>{if(!condition)throw Object.assign(Error(message),{code:'REGRESSION_INPUT_ARCHIVE'});};
const validPath=p=>typeof p==='string'&&p.length>0&&!isAbsolute(p)&&!p.includes('\\')&&!p.includes('\0')
  &&p.split('/').every(c=>c&&c!=='.'&&c!=='..');
const entries=inputs=>{
  check(inputs&&typeof inputs==='object'&&!Array.isArray(inputs),'Pinned input map required');
  const rows=Object.entries(inputs).sort(([a],[b])=>a<b?-1:a>b?1:0);
  check(rows.length>0&&rows.every(([p,h])=>validPath(p)&&typeof h==='string'&&/^[a-f0-9]{64}$/.test(h)),'Invalid pinned input path/hash');return rows;
};
function regularRead(root,path){
  const parts=path.split('/');let parent=root;
  check(fs.lstatSync(root).isDirectory()&&!fs.lstatSync(root).isSymbolicLink(),'Root must be a real directory');
  for(const part of parts.slice(0,-1)){
    parent=join(parent,part);const s=fs.lstatSync(parent);check(s.isDirectory()&&!s.isSymbolicLink(),'Input parent must be a real directory');
  }
  const absolute=join(root,path),before=fs.lstatSync(absolute,{bigint:true});
  check(before.isFile()&&!before.isSymbolicLink(),'Pinned input must be a regular file');
  const fd=fs.openSync(absolute,fs.constants.O_RDONLY|fs.constants.O_NOFOLLOW);
  try{
    const opened=fs.fstatSync(fd,{bigint:true});check(opened.dev===before.dev&&opened.ino===before.ino,'Input identity changed while opening');
    const bytes=fs.readFileSync(fd),after=fs.fstatSync(fd,{bigint:true});
    check(opened.dev===after.dev&&opened.ino===after.ino&&opened.size===after.size&&opened.mtimeNs===after.mtimeNs
      &&opened.ctimeNs===after.ctimeNs&&BigInt(bytes.length)===after.size,'Input changed during capture');return bytes;
  }finally{fs.closeSync(fd);}
}
function createFile(path,bytes){
  const fd=fs.openSync(path,'wx',0o600);try{fs.writeFileSync(fd,bytes);fs.fsyncSync(fd);}finally{fs.closeSync(fd);}
}
function syncDirectory(path){const fd=fs.openSync(path,'r');try{fs.fsyncSync(fd);}finally{fs.closeSync(fd);}}
export function assertCurrentRegressionInputs({repository,inputs}){
  const root=resolve(repository);for(const [path,sha256]of entries(inputs))check(hash(regularRead(root,path))===sha256,'Pinned input changed: '+path);
  return true;
}
export function archiveRegressionInputs({repository,directory,inputs,phase='prospective'}){
  check(['prospective','post-close-matching'].includes(phase),'Explicit capture phase required');
  const root=resolve(repository),target=resolve(directory),rows=entries(inputs),data=[];
  check(!fs.existsSync(target),'Archive target must not exist; never overwrite a closed archive');
  // Verify all source bytes before creating output. No partial manifest can
  // certify a capture whose source already differs from its claimed digest.
  for(const [path,sha256]of rows){const bytes=regularRead(root,path);check(hash(bytes)===sha256,'Pinned input changed: '+path);data.push({path,sha256,bytes});}
  const parent=resolve(target,'..');check(fs.lstatSync(parent).isDirectory()&&!fs.lstatSync(parent).isSymbolicLink(),'Archive parent must be real');
  fs.mkdirSync(target,{mode:0o700});const blobs=join(target,'blobs');fs.mkdirSync(blobs,{mode:0o700});const written=new Set();
  for(const row of data)if(!written.has(row.sha256)){createFile(join(blobs,row.sha256),row.bytes);written.add(row.sha256);}
  syncDirectory(blobs);
  const manifest={schema:'sovereign.regression-input-archive.v1',capturedAt:new Date().toISOString(),phase,
    files:data.map(r=>({path:r.path,sha256:r.sha256,bytes:r.bytes.length,blob:'blobs/'+r.sha256})),
    scope:'Exact bytes for the supplied pinned input map. Capture phase is explicit. Not a complete environment snapshot, execution proof, continuous file-integrity guarantee or test acceptance.'};
  const bytes=Buffer.from(JSON.stringify(manifest,null,2)+'\n');createFile(join(target,'manifest.json'),bytes);syncDirectory(target);syncDirectory(parent);
  return {schema:manifest.schema,directory:target,manifestSha256:hash(bytes),fileCount:data.length,blobCount:written.size,
    bytes:data.reduce((n,r)=>n+r.bytes.length,0),phase};
}
export function verifyRegressionInputArchive({directory,inputs,manifestSha256}){
  const target=resolve(directory),expected=entries(inputs),raw=regularRead(target,'manifest.json');
  if(manifestSha256!==undefined)check(hash(raw)===manifestSha256,'Archive manifest changed');
  const m=JSON.parse(raw);check(m.schema==='sovereign.regression-input-archive.v1'&&['prospective','post-close-matching'].includes(m.phase)
    &&Array.isArray(m.files)&&m.files.length===expected.length,'Invalid archive manifest');
  const pairs=m.files.map(r=>[r.path,r.sha256]);check(JSON.stringify(pairs)===JSON.stringify(expected),'Archive map differs from pinned inputs');
  const blobNames=new Set();let bytes=0;
  for(const r of m.files){
    check(r.blob==='blobs/'+r.sha256&&Number.isSafeInteger(r.bytes)&&r.bytes>=0,'Invalid archive object reference');
    const body=regularRead(target,r.blob);check(body.length===r.bytes&&hash(body)===r.sha256,'Archived input bytes changed: '+r.path);
    blobNames.add(r.sha256);bytes+=body.length;
  }
  check(JSON.stringify(fs.readdirSync(target).sort())===JSON.stringify(['blobs','manifest.json']),'Unexpected archive contents');
  check(JSON.stringify(fs.readdirSync(join(target,'blobs')).sort())===JSON.stringify([...blobNames].sort()),'Unexpected archive objects');
  return {schema:m.schema,directory:target,manifestSha256:hash(raw),fileCount:m.files.length,blobCount:blobNames.size,bytes,phase:m.phase};
}
