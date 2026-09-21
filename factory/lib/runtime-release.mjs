// Local content-addressed runtime snapshots. Not a sandbox or an OS immutability
// claim: the owning administrator can change permissions. Verify before use.
import * as fs from 'node:fs';
import {dirname,join,resolve,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomUUID} from 'node:crypto';
import {check,sha256} from './contracts.mjs';
import {runtimeFilesInside,safeRuntimePath,verifyRuntimeRelease} from './runtime-integrity.mjs';
import {getRole,listCapabilities} from '../catalog/index.mjs';

export {verifyRuntimeRelease} from './runtime-integrity.mjs';

const repository=fs.realpathSync(resolve(dirname(fileURLToPath(import.meta.url)),'../..'));
const ordered=(a,b)=>a<b?-1:a>b?1:0;
export function collectRuntimeFiles(){
  const paths=new Set(runtimeFilesInside(join(repository,'factory')).map(p=>'factory/'+p));
  const catalog=JSON.parse(fs.readFileSync(join(repository,'factory/catalog/manifest.json'),'utf8'));
  for(const input of catalog.inputs)paths.add(input.path);
  for(const role of listCapabilities())for(const source of getRole(role.id).sourceRefs)paths.add(source.path);
  const files=[];
  for(const path of [...paths].sort(ordered)){
    safeRuntimePath(path);const absolute=join(repository,path),actual=fs.realpathSync(absolute);
    check(actual.startsWith(repository+sep)&&actual===absolute&&fs.lstatSync(absolute).isFile(),'RELEASE_PATH','Dependency must be a regular file within repository');
    files.push({path,content:fs.readFileSync(absolute)});
  }
  return files;
}
export function buildRuntimeRelease(releasesDir,{files=collectRuntimeFiles()}={}){
  const parent=resolve(releasesDir);
  fs.mkdirSync(parent,{recursive:true,mode:0o700});
  check(fs.realpathSync(parent)===parent&&fs.lstatSync(parent).isDirectory(),'RELEASE_PATH','Release parent must be a real owned directory');
  check(files.length>0,'RELEASE_MANIFEST','Empty runtime is invalid');
  const entries=files.map(({path,content})=>({path:safeRuntimePath(path),content:Buffer.from(content)})).sort((a,b)=>ordered(a.path,b.path));
  check(new Set(entries.map(e=>e.path)).size===entries.length,'RELEASE_MANIFEST','Duplicate runtime path');
  const body={schema:'sovereign.runtime-release.v1',files:entries.map(e=>({path:e.path,bytes:e.content.length,sha256:sha256(e.content)}))};
  const releaseId=sha256(body),target=join(parent,releaseId);
  if(fs.existsSync(target))return {...verifyRuntimeRelease(target,releaseId),reused:true};
  const staging=join(parent,'.staging-'+randomUUID());fs.mkdirSync(staging,{mode:0o700});
  try{
    for(const entry of entries){const path=join(staging,entry.path);fs.mkdirSync(dirname(path),{recursive:true,mode:0o700});
      fs.writeFileSync(path,entry.content,{flag:'wx',mode:0o444});}
    fs.writeFileSync(join(staging,'RELEASE.json'),JSON.stringify({...body,releaseId},null,2),{flag:'wx',mode:0o444});
    verifyRuntimeRelease(staging,releaseId);
    try{fs.renameSync(staging,target);}catch(error){if(!['EEXIST','ENOTEMPTY'].includes(error.code))throw error;verifyRuntimeRelease(target,releaseId);}
    return {...verifyRuntimeRelease(target,releaseId),reused:false};
  }finally{if(fs.existsSync(staging))fs.rmSync(staging,{recursive:true});}
}
