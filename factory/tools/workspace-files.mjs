import * as fs from 'node:fs';
import {resolve,isAbsolute,sep} from 'node:path';
import {check,string,ContractError} from '../lib/contracts.mjs';

export const WORKSPACE_DEFAULTS=Object.freeze({maxFileBytes:1024*1024,maxWorkspaceBytes:32*1024*1024,maxEntries:2000});
export function safeDirectories(path,create=false){
  const absolute=resolve(path);let current=isAbsolute(absolute)?sep:'';
  for(const part of absolute.split(sep).filter(Boolean)){
    current=resolve(current,part);
    if(create&&!fs.existsSync(current))fs.mkdirSync(current,{mode:0o700});
    let stat;
    try{stat=fs.lstatSync(current);}catch(error){
      if(error?.code==='ENOENT')check(false,'WORKSPACE_PATH','Directory ancestry must already exist');
      throw error;
    }
    check(stat.isDirectory()&&!stat.isSymbolicLink(),'WORKSPACE_PATH','Directory ancestry must be real directories');
  }
  return absolute;
}
export function relativePath(path,rootAllowed=false){
  string(path,'workspace path',{max:2048});
  if(rootAllowed&&path==='.')return [];
  check(!isAbsolute(path)&&!path.includes('\\')&&!path.includes('\0')&&path.split('/').every(part=>part&&part!=='.'&&part!=='..'),
    'WORKSPACE_PATH','Only normalized relative paths are accepted');
  check(path.split('/').length<=32,'WORKSPACE_LIMIT','Path depth cap exceeded');return path.split('/');
}
export function regular(stat){check(stat.isFile()&&!stat.isSymbolicLink()&&stat.nlink===1,'WORKSPACE_PATH','Only regular nonlinked files are supported');}
export function utf8(buffer){
  try{return new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(buffer);}
  catch{throw new ContractError('ENCODING','Only lossless UTF-8 text is supported');}
}
export function syncDirectory(path){const fd=fs.openSync(path,fs.constants.O_RDONLY|fs.constants.O_DIRECTORY|fs.constants.O_NOFOLLOW);try{fs.fsyncSync(fd);}finally{fs.closeSync(fd);}}
