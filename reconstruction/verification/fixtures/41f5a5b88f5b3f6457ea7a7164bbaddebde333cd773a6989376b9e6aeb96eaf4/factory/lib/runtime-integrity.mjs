// Pure verifier for a local content-addressed runtime snapshot.
//
// This module deliberately has no catalogue, provider, workspace or service
// dependency.  It is safe to freeze as a tiny verifier dependency: callers
// can establish that a specific packaged runtime is complete before importing
// its operational modules.
import * as fs from 'node:fs';
import {isAbsolute,join,relative,resolve,sep} from 'node:path';
import {canonical,check,sha256} from './contracts.mjs';

const ordered=(a,b)=>a<b?-1:a>b?1:0;

export function safeRuntimePath(path){
  check(typeof path==='string'&&path.length>0&&!isAbsolute(path)&&!path.includes('\\')
    &&path.split('/').every(part=>part&&part!=='.'&&part!=='..')&&path!=='RELEASE.json',
  'RELEASE_PATH','Invalid packaged path');
  return path;
}

export function runtimeFilesInside(root){
  const result=[];
  const visit=directory=>{
    for(const entry of fs.readdirSync(directory,{withFileTypes:true})){
      const path=join(directory,entry.name);
      check(!entry.isSymbolicLink(),'RELEASE_PATH','Runtime snapshot cannot contain symlinks');
      if(entry.isDirectory())visit(path);
      else {
        check(entry.isFile(),'RELEASE_PATH','Runtime snapshot must contain only regular files');
        result.push(relative(root,path).split(sep).join('/'));
      }
    }
  };
  visit(root);
  return result.sort(ordered);
}

/**
 * Verify all paths, bytes and content hashes in a sealed runtime manifest.
 * This establishes snapshot integrity only; it is not a sandbox or an OS
 * immutability claim.
 */
export function verifyRuntimeRelease(directory,expectedId=null){
  const root=resolve(directory);
  check(fs.lstatSync(root).isDirectory()&&!fs.lstatSync(root).isSymbolicLink(),
    'RELEASE_PATH','Specific runtime directory required');
  const manifestPath=join(root,'RELEASE.json');
  check(fs.lstatSync(manifestPath).isFile()&&!fs.lstatSync(manifestPath).isSymbolicLink(),
    'RELEASE_PATH','Regular release manifest required');
  const manifest=JSON.parse(fs.readFileSync(manifestPath,'utf8'));
  check(canonical(Object.keys(manifest).sort())===canonical(['files','releaseId','schema']),
    'RELEASE_MANIFEST','Unknown manifest field');
  check(manifest.schema==='sovereign.runtime-release.v1'&&Array.isArray(manifest.files)&&manifest.files.length>0,
    'RELEASE_MANIFEST','Unknown runtime manifest');
  const expectedKeys=['bytes','path','sha256'];
  for(const entry of manifest.files){
    check(canonical(Object.keys(entry).sort())===canonical(expectedKeys),
      'RELEASE_MANIFEST','Unknown manifest entry');
    safeRuntimePath(entry.path);
    check(Number.isSafeInteger(entry.bytes)&&entry.bytes>=0&&/^[a-f0-9]{64}$/.test(entry.sha256),
      'RELEASE_MANIFEST','Invalid manifest metadata');
  }
  const paths=manifest.files.map(entry=>entry.path);
  check(new Set(paths).size===paths.length&&canonical(paths)===canonical([...paths].sort(ordered)),
    'RELEASE_MANIFEST','Manifest paths must be unique and sorted');
  const releaseId=sha256({schema:manifest.schema,files:manifest.files});
  check(manifest.releaseId===releaseId&&(!expectedId||releaseId===expectedId),
    'RELEASE_INTEGRITY','Runtime release identity changed');
  check(canonical(runtimeFilesInside(root).filter(path=>path!=='RELEASE.json'))===canonical(paths),
    'RELEASE_INTEGRITY','Missing or additional runtime file');
  for(const entry of manifest.files){
    const bytes=fs.readFileSync(join(root,entry.path));
    check(bytes.length===entry.bytes&&sha256(bytes)===entry.sha256,
      'RELEASE_INTEGRITY','Runtime file differs from its snapshot');
  }
  return {releaseId,directory:root,fileCount:paths.length,
    bytes:manifest.files.reduce((sum,entry)=>sum+entry.bytes,0),verified:true};
}
