import * as fs from 'node:fs';
import {resolve,dirname,basename} from 'node:path';
import {randomUUID} from 'node:crypto';
import {check,sha256,canonical} from './contracts.mjs';
import {missionInputManifest} from './mission-inputs.mjs';
import {safeDirectories,relativePath,syncDirectory} from '../tools/workspace-files.mjs';

const requireInput=(ok,message)=>check(ok,'INPUT_PREPARATION_UNCERTAIN',message);
const identity=stat=>({dev:String(stat.dev),ino:String(stat.ino)});
const same=(stat,bound)=>bound&&String(stat.dev)===bound.dev&&String(stat.ino)===bound.ino;
const optionalStat=path=>{try{return fs.lstatSync(path);}catch(e){if(e.code==='ENOENT')return null;throw e;}};
const change=(store,type,id,data)=>{const old=store.get(type,id);return store.put(type,id,data,{expectedVersion:old?.version??0});};
function directoryBinding(store,key,r){
  const origin=store.get('input-directory',key,1);
  requireInput(origin?.data.status==='RESERVED'&&origin.data.identity===null
    &&(r.version===1&&r.data.status==='RESERVED'||r.version===2&&r.data.status==='READY'&&r.data.identity
      &&canonical({...r.data,status:'RESERVED',identity:null})===canonical(origin.data)),'Directory reservation history changed');
}
function fileBinding(store,key,r){
  const origin=store.get('input-prepared-file',key,1),stage=store.get('input-prepared-file',key,2);
  requireInput(origin?.data.status==='RESERVED'&&origin.data.identity===null
    &&(r.version===1&&r.data.status==='RESERVED'||[2,3].includes(r.version)&&stage?.data.status==='STAGED'&&stage.data.identity
      &&canonical({...stage.data,status:'RESERVED',identity:null})===canonical(origin.data)
      &&canonical(r.data)===canonical({...stage.data,status:r.version===2?'STAGED':'PUBLISHED'})),'File preparation history changed');
}

// A durable intent does NOT prove ownership of a subsequently found inode.
// Crash between creation and its identity commit deliberately remains uncertain.
function prepareDirectory(broker,missionId,path,checkpoint){
  const key=missionId+':dir:'+sha256(path),store=broker.store;
  let r=store.get('input-directory',key);
  if(!r){requireInput(!optionalStat(path),'Unregistered input directory must not be adopted');
    r=change(store,'input-directory',key,{missionId,path,status:'RESERVED',identity:null});checkpoint('directory.reserved',{path});}
  requireInput(r.data.path===path&&r.data.missionId===missionId,'Directory reservation changed');
  directoryBinding(store,key,r);
  if(r.data.status==='RESERVED'){
    requireInput(!optionalStat(path),'Directory creation lacks an observed durable identity');safeDirectories(dirname(path));
    fs.mkdirSync(path,{mode:0o700});syncDirectory(dirname(path));checkpoint('directory.created',{path});
    const stat=fs.lstatSync(path);r=change(store,'input-directory',key,{...r.data,status:'READY',identity:identity(stat)});checkpoint('directory.committed',{path});
  }
  const stat=fs.lstatSync(path);requireInput(r.data.status==='READY'&&stat.isDirectory()&&!stat.isSymbolicLink()&&same(stat,r.data.identity),'Prepared directory identity changed');
}

function prepareFile(broker,manifest,file,root,checkpoint){
  const store=broker.store,key=manifest.missionId+':file:'+sha256(file.path),target=resolve(root,...relativePath(file.path));
  let r=store.get('input-prepared-file',key);
  if(!r){requireInput(!optionalStat(target),'Unregistered input file must not be adopted');
    r=change(store,'input-prepared-file',key,{missionId:manifest.missionId,path:file.path,target,sha256:file.sha256,bytes:file.bytes,
      temporary:resolve(broker.workspaceRoot,'admission-'+randomUUID()+'.tmp'),status:'RESERVED',identity:null});checkpoint('file.reserved',{path:file.path});}
  requireInput(r.data.missionId===manifest.missionId&&r.data.path===file.path&&r.data.target===target&&r.data.sha256===file.sha256
    &&r.data.bytes===file.bytes&&dirname(r.data.temporary)===broker.workspaceRoot&&/^admission-[a-f0-9-]{36}\.tmp$/.test(basename(r.data.temporary)),
    'Prepared file reservation differs from original manifest');
  const temporary=r.data.temporary;
  fileBinding(store,key,r);
  if(r.data.status==='RESERVED'){
    requireInput(!optionalStat(target)&&!optionalStat(temporary),'Unobserved file creation cannot be adopted or replayed');
    const raw=Buffer.from(store.get('mission-input-bytes',file.record.id,1).data.base64,'base64');
    const fd=fs.openSync(temporary,fs.constants.O_WRONLY|fs.constants.O_CREAT|fs.constants.O_EXCL|fs.constants.O_NOFOLLOW,0o600);
    let stat;try{checkpoint('file.created',{path:file.path});fs.writeFileSync(fd,raw);fs.fsyncSync(fd);stat=fs.fstatSync(fd);}finally{fs.closeSync(fd);}
    syncDirectory(broker.workspaceRoot);checkpoint('file.synced',{path:file.path});
    r=change(store,'input-prepared-file',key,{...r.data,status:'STAGED',identity:identity(stat)});checkpoint('file.staged',{path:file.path});
  }
  if(r.data.status==='STAGED'){
    const staged=optionalStat(temporary),published=optionalStat(target);
    // link() publishes without replacement. Both names during a crash recovery
    // must identify the SAME observed inode; do not treat arbitrary hardlinks as inputs.
    if(published){requireInput(published.isFile()&&!published.isSymbolicLink()&&same(published,r.data.identity),'Published target is foreign');
      requireInput(!staged||same(staged,r.data.identity),'Staging target changed');}
    else requireInput(staged&&same(staged,r.data.identity),'Observed staging file is missing');
    const current=published??staged;
    requireInput(current.isFile()&&!current.isSymbolicLink()&&current.nlink===(published&&staged?2:1),'Unexpected staging link count');
    const fd=fs.openSync(published?target:temporary,fs.constants.O_RDONLY|fs.constants.O_NOFOLLOW);
    try{const st=fs.fstatSync(fd);requireInput(same(st,r.data.identity)&&st.size===file.bytes,'Staged input identity/size changed');
      const raw=Buffer.alloc(file.bytes+1);let used=0;while(used<raw.length){const n=fs.readSync(fd,raw,used,raw.length-used,null);if(!n)break;used+=n;}
      requireInput(used===file.bytes&&sha256(raw.subarray(0,used))===file.sha256,'Staged input contents changed');
    }finally{fs.closeSync(fd);}
    if(!published){fs.linkSync(temporary,target);syncDirectory(dirname(target));checkpoint('file.published',{path:file.path});}
    if(staged){requireInput(same(fs.lstatSync(temporary),r.data.identity)&&same(fs.lstatSync(target),r.data.identity),'Staged publication identity changed');
      fs.unlinkSync(temporary);syncDirectory(broker.workspaceRoot);checkpoint('file.unlinked',{path:file.path});}
    r=change(store,'input-prepared-file',key,{...r.data,status:'PUBLISHED'});checkpoint('file.committed',{path:file.path});
  }
  requireInput(r.data.status==='PUBLISHED'&&same(fs.lstatSync(target),r.data.identity)&&broker.fileHash(target)===file.sha256,'Published input differs from its admitted snapshot');
}

export function prepareMissionInputWorkspace(broker,missionId,{checkpoint=()=>{}}={}){
  const store=broker.store,manifest=missionInputManifest(store,missionId);if(!manifest)return false;
  const ready=store.get('input-preparation',missionId);
  if(ready){requireInput(ready.version===1&&ready.data.manifestHash===sha256(manifest)&&ready.data.status==='READY','Preparation binding changed');
    assertInputWorkingState(broker,missionId);return true;}
  requireInput(!store.list('run').some(r=>r.data.missionId===missionId)&&!store.list('effect').some(r=>r.data.missionId===missionId),
    'Unprepared mission already contains worker or effect activity');
  safeDirectories(broker.workspaceRoot);const root=resolve(broker.workspaceRoot,'mission-'+sha256(missionId));
  prepareDirectory(broker,missionId,root,checkpoint);
  const registration=store.get('tool-workspace',missionId);
  if(registration)requireInput(registration.version===1&&canonical(registration.data)===canonical({missionId,path:root,resource:'workspace:'+missionId}),'Workspace registration changed');
  else store.put('tool-workspace',missionId,{missionId,path:root,resource:'workspace:'+missionId},{expectedVersion:0});
  const directories=new Set();for(const file of manifest.files){const parts=relativePath(file.path);for(let i=1;i<parts.length;i++)directories.add(parts.slice(0,i).join('/'));}
  for(const path of [...directories].sort((a,b)=>a.split('/').length-b.split('/').length||a.localeCompare(b)))prepareDirectory(broker,missionId,resolve(root,path),checkpoint);
  for(const file of manifest.files)prepareFile(broker,manifest,file,root,checkpoint);
  const expected=new Set([...directories,...manifest.files.map(f=>f.path)]),actual=[];
  const visit=(dir,prefix='')=>{for(const name of fs.readdirSync(dir)){const path=prefix?prefix+'/'+name:name;actual.push(path);if(fs.lstatSync(resolve(root,path)).isDirectory())visit(resolve(root,path),path);}};
  broker.scan(root);visit(root);requireInput(actual.length===expected.size&&actual.every(p=>expected.has(p)),'Unexpected file in prepared workspace');
  checkpoint('inputs.before-ready',{missionId});
  store.put('input-preparation',missionId,{missionId,manifestHash:sha256(manifest),status:'READY',
    scope:'Controller-created private input copies; not worker writes, facts or accepted products.'},{expectedVersion:0});
  checkpoint('inputs.ready',{missionId});assertInputWorkingState(broker,missionId);return true;
}

export function assertInputWorkingState(broker,missionId,options={}){
  try{return inspectInputWorkingState(broker,missionId,options);}catch(error){
    if(['ENOENT','ENOTDIR','ELOOP'].includes(error.code))check(false,'WORKSPACE_CHANGED','Admitted input path is missing or no longer a real owned path');throw error;
  }
}
function inspectInputWorkingState(broker,missionId,{excludeOperationId=null}={}){
  const store=broker.store;if(!store.get('mission',missionId))return null;
  const manifest=missionInputManifest(store,missionId);if(!manifest)return null;
  const ready=store.get('input-preparation',missionId);
  check(ready?.version===1&&ready.data.status==='READY'&&ready.data.manifestHash===sha256(manifest),'INPUT_NOT_PREPARED','Inputs must be prepared before inference or broker effects');
  const root=broker.workspace(missionId);
  const directories=new Set([root]);for(const f of manifest.files){const parts=relativePath(f.path);for(let i=1;i<parts.length;i++)directories.add(resolve(root,...parts.slice(0,i)));}
  for(const path of directories){
    const key=missionId+':dir:'+sha256(path),r=store.get('input-directory',key);check(r&&r.data.path===path&&r.data.missionId===missionId,'INPUT_ADMISSION_INTEGRITY','Required input directory record missing');
    directoryBinding(store,key,r);
    const stat=fs.lstatSync(path);check(r.data.status==='READY'&&stat.isDirectory()&&!stat.isSymbolicLink()&&same(stat,r.data.identity),'WORKSPACE_CHANGED','Admitted directory identity changed');
  }
  const versions=new Map(manifest.files.map(f=>[f.path,{hash:f.sha256,original:true}]));
  const writes=store.list('effect').filter(r=>r.data.missionId===missionId&&r.data.tool==='workspace.write'&&r.id!==excludeOperationId);
  check(writes.every(r=>!['DISPATCHED','UNCERTAIN'].includes(r.data.state)),'EFFECT_UNCERTAIN','Unresolved write cannot redefine an admitted input');
  const seq=r=>store.db.prepare("SELECT seq FROM events WHERE kind='record.committed' AND json_extract(json,'$.type')='effect' AND json_extract(json,'$.id')=? AND json_extract(json,'$.version')=?").get(r.id,r.version)?.seq??0;
  for(const r of writes.filter(r=>r.data.state==='SUCCEEDED').sort((a,b)=>seq(a)-seq(b))){
    const receipt=broker.authority.open(r.data.receipt,'tool.receipt');check(receipt.id===r.id&&receipt.missionId===missionId&&receipt.tool==='workspace.write'&&receipt.status==='SUCCEEDED'
      &&receipt.argsHash===r.data.argsHash&&receipt.principalId===r.data.principalId&&seq(r)>0,'INPUT_ADMISSION_INTEGRITY','Write receipt differs');
    const old=versions.get(receipt.result.path);if(!old)continue;
    check(receipt.result.beforeSha256===old.hash&&receipt.result.afterSha256===receipt.result.sha256,'INPUT_ADMISSION_INTEGRITY','Input write history has no continuous original lineage');
    versions.set(receipt.result.path,{hash:receipt.result.sha256,original:false});
  }
  for(const file of manifest.files){
    const target=broker.resolvePath(missionId,file.path),version=versions.get(file.path),key=missionId+':file:'+sha256(file.path),record=store.get('input-prepared-file',key),prepared=record?.data;
    check(prepared?.status==='PUBLISHED'&&prepared.sha256===file.sha256,'INPUT_ADMISSION_INTEGRITY','Prepared original missing');
    fileBinding(store,key,record);
    check((!version.original||same(fs.lstatSync(target),prepared.identity))&&broker.fileHash(target)===version.hash,'WORKSPACE_CHANGED','Admitted input differs from original or authorized write lineage');
  }
  return {manifest,versions};
}
