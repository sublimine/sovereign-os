// Retained, post-close evidence for one adaptive-v3 planned qualification.
// This is a local write-once, tamper-evident bundle, not a WORM device or a
// defence against the administrator who owns this VPS and its filesystem.
// O_NOFOLLOW protects final leaves, not a hostile concurrent replacement of
// intermediate pathnames; that local-owner/TOCTOU boundary is explicit.
import * as fs from 'node:fs';
import {basename,dirname,join,resolve,isAbsolute,relative,sep} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {DatabaseSync} from 'node:sqlite';
import {canonical,sha256} from '../../factory/lib/contracts.mjs';
import {collectRuntimeFiles} from '../../factory/lib/runtime-release.mjs';
import {Store} from '../../factory/lib/store.mjs';
import {Authority} from '../../factory/lib/authority.mjs';
import {ArtifactRegistry} from '../../factory/lib/artifacts.mjs';
import {adaptiveV3QualificationCase} from './adaptive-v3-qualification-cases.mjs';
import {auditAdaptiveV3QualificationCase} from './adaptive-v3-qualification-audit.mjs';
import {auditRouteReentryJournal} from './full-route-audit.mjs';

const SCHEMA='sovereign.adaptive-v3-evidence-bundle.v1';
const POST_CLOSE_SCHEMA='sovereign.adaptive-v3-post-close-audit.v1';
const PAYLOAD='payload';
const MANIFEST='manifest.json';
const POST_CLOSE_AUDIT='post-close-audit.json';
const WORKSPACE_BINDING_SCHEMA='sovereign.adaptive-v3-workspace-binding.v1';
const SQLITE_SIDECARS=new Set(['state.sqlite-wal','state.sqlite-shm']);
const repository=fs.realpathSync(resolve(dirname(fileURLToPath(import.meta.url)),'../..'));
const VERIFICATION_INPUTS=Object.freeze([
  'reconstruction/verification/adaptive-v3-evidence-bundle.mjs',
  'reconstruction/verification/adaptive-v3-external-execution-evidence.mjs',
  'reconstruction/verification/adaptive-v3-qualification-audit.mjs',
  'reconstruction/verification/adaptive-v3-qualification-cases.mjs',
  'reconstruction/verification/full-route-audit.mjs',
  'reconstruction/verification/full-route-cases.mjs',
  'reconstruction/verification/full-route-harness.mjs',
  'reconstruction/verification/interval-union-oracle.mjs',
  // The matrix contains the simulated provider/fixture implementation. It is
  // provenance for a retained CI row even though the read-only auditor does
  // not import a test file.
  'tests/factory/adaptive-v3-qualification-matrix.test.mjs'
]);

const fail=(code,message)=>{throw Object.assign(Error(message),{code});};
const exact=(value,keys)=>value!==null&&typeof value==='object'&&!Array.isArray(value)
  &&canonical(Object.keys(value).sort())===canonical([...keys].sort());
const digest=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
const errorView=error=>({code:error?.code??'UNKNOWN',message:error?.message??'Unknown evidence-bundle error'});
const plainObject=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const same=(left,right)=>canonical(left)===canonical(right);
// fs BigIntStats is not consistent about every field on every Node build.
// Normalise through BigInt before masking Unix permission bits.
const unixMode=stat=>Number(BigInt(stat.mode)&0o777n);

function safeRelative(path){
  if(typeof path!=='string'||!path||isAbsolute(path)||path.includes('\\')||path.includes('\0')
    ||path.split('/').some(part=>!part||part==='.'||part==='..'))fail('BUNDLE_PATH','Invalid relative evidence path');
  return path;
}

function safeDirectory(path,label){
  if(typeof path!=='string'||!path)fail('BUNDLE_PATH',`${label} directory is required`);
  const absolute=resolve(path);
  let stat;
  try{stat=fs.lstatSync(absolute,{bigint:true});}
  catch{fail('BUNDLE_PATH',`${label} directory is absent`);}
  if(!stat.isDirectory()||stat.isSymbolicLink())fail('BUNDLE_PATH',`${label} directory must be a real directory`);
  return absolute;
}

function safeRoot(path,label){
  const absolute=safeDirectory(path,label),actual=fs.realpathSync(absolute);
  if(actual!==absolute)fail('BUNDLE_PATH',`${label} directory must not resolve through a symbolic link`);
  return absolute;
}

function inside(root,relativePath){
  if(relativePath==='.')return root;
  const clean=safeRelative(relativePath),absolute=join(root,...clean.split('/'));
  if(relative(root,absolute).split(sep).join('/')!==clean)fail('BUNDLE_PATH','Evidence path escaped its root');
  return absolute;
}

function stableRegularRead(root,relativePath){
  const clean=safeRelative(relativePath),parts=clean.split('/');let parent=root;
  for(const part of parts.slice(0,-1)){
    parent=join(parent,part);const stat=fs.lstatSync(parent,{bigint:true});
    if(!stat.isDirectory()||stat.isSymbolicLink())fail('BUNDLE_TREE','Evidence parent is not a real directory');
  }
  const path=inside(root,clean),before=fs.lstatSync(path,{bigint:true});
  if(!before.isFile()||before.isSymbolicLink())fail('BUNDLE_TREE','Evidence leaf is not a regular non-symbolic file');
  const fd=fs.openSync(path,fs.constants.O_RDONLY|fs.constants.O_NOFOLLOW);
  try{
    const opened=fs.fstatSync(fd,{bigint:true});
    if(opened.dev!==before.dev||opened.ino!==before.ino||opened.size!==before.size||opened.mtimeNs!==before.mtimeNs||opened.ctimeNs!==before.ctimeNs)
      fail('BUNDLE_RACE','Evidence file changed while opening');
    const bytes=fs.readFileSync(fd),after=fs.fstatSync(fd,{bigint:true});
    if(opened.dev!==after.dev||opened.ino!==after.ino||opened.size!==after.size||opened.mtimeNs!==after.mtimeNs||opened.ctimeNs!==after.ctimeNs
      ||BigInt(bytes.length)!==after.size)fail('BUNDLE_RACE','Evidence file changed while reading');
    return {bytes,mode:unixMode(after),nlink:after.nlink};
  }finally{fs.closeSync(fd);}
}

function snapshotTree(root,{requireSingleLinks=false}={}){
  const rows=[];
  const visit=(path,relativePath)=>{
    const stat=fs.lstatSync(path,{bigint:true});
    if(stat.isSymbolicLink())fail('BUNDLE_SYMLINK','Evidence tree contains a symbolic link');
    if(stat.isDirectory()){
      rows.push({path:relativePath,type:'directory',mode:unixMode(stat)});
      for(const entry of fs.readdirSync(path,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name)))
        visit(join(path,entry.name),relativePath==='.'?entry.name:`${relativePath}/${entry.name}`);
      return;
    }
    if(!stat.isFile())fail('BUNDLE_TREE','Evidence tree contains a non-regular artifact');
    // Node's bigint stat option has varied for nlink across supported
    // runtimes: normalise it explicitly rather than mixing Number/BigInt.
    if(requireSingleLinks&&BigInt(stat.nlink)!==1n)fail('BUNDLE_HARDLINK','Retained payload file is not exclusively owned by the bundle');
    const read=stableRegularRead(root,relativePath);
    rows.push({path:relativePath,type:'file',mode:read.mode,bytes:read.bytes.length,sha256:sha256(read.bytes)});
  };
  visit(root,'.');
  // Traversal is depth first, whereas the manifest contract is a single
  // canonical path ordering.  Do not make validity depend on sibling names
  // that happen to sort around a directory prefix.
  return rows.sort((a,b)=>a.path.localeCompare(b.path));
}

function assertNoSqliteSidecars(root){
  for(const name of SQLITE_SIDECARS)if(fs.existsSync(join(root,name)))fail('BUNDLE_SQLITE_SIDECAR','Closed qualification contains a SQLite WAL/SHM sidecar');
}

const immutableSqliteUri=path=>{
  const url=pathToFileURL(path);url.searchParams.set('immutable','1');return url.href;
};

function jsonEvidence(root,path,label){
  try{return JSON.parse(stableRegularRead(root,path).bytes.toString('utf8'));}
  catch(error){
    if(error?.code)throw error;
    fail('BUNDLE_WORKSPACE_BINDING',`${label} is not a stable JSON evidence file`);
  }
}

function workspaceManifest(root){
  const rootStat=fs.lstatSync(root,{bigint:true});
  if(!rootStat.isDirectory()||rootStat.isSymbolicLink())fail('BUNDLE_WORKSPACE_BINDING','Closed workspace is not a real directory');
  const manifest=[];
  const walk=(directory,prefix='')=>{
    // Match ToolBroker.executionSnapshot exactly: lexical directory entries,
    // preorder directories, and no mode/timestamp claims.
    for(const name of fs.readdirSync(directory).sort()){
      const path=prefix?`${prefix}/${name}`:name;
      safeRelative(path);
      const absolute=join(directory,name),stat=fs.lstatSync(absolute,{bigint:true});
      if(stat.isSymbolicLink())fail('BUNDLE_WORKSPACE_BINDING','Closed workspace contains a symbolic link');
      if(stat.isDirectory()){
        manifest.push({type:'directory',path});walk(absolute,path);continue;
      }
      if(!stat.isFile())fail('BUNDLE_WORKSPACE_BINDING','Closed workspace contains a non-regular entry');
      const read=stableRegularRead(root,path);
      manifest.push({type:'file',path,sha256:sha256(read.bytes),bytes:read.bytes.length});
    }
  };
  walk(root);return manifest;
}

function effectReceipt(store,registry,{id,hash,missionId,principalId,tool}){
  if(typeof id!=='string'||!digest(hash))fail('BUNDLE_WORKSPACE_BINDING','Signed workspace observation reference is malformed');
  const effect=store.get('effect',id);
  if(!effect?.data?.receipt||effect.data.missionId!==missionId||effect.data.principalId!==principalId
    ||effect.data.tool!==tool||effect.data.state!=='SUCCEEDED'||sha256(effect.data.receipt)!==hash)
    fail('BUNDLE_WORKSPACE_BINDING','Signed workspace observation does not resolve to its original successful effect');
  let receipt;
  try{receipt=registry.verifiedToolReceipt(effect.data.receipt);}
  catch{fail('BUNDLE_WORKSPACE_BINDING','Signed workspace observation receipt is invalid');}
  if(receipt.id!==id||receipt.missionId!==missionId||receipt.principalId!==principalId
    ||receipt.tool!==tool||receipt.status!=='SUCCEEDED')
    fail('BUNDLE_WORKSPACE_BINDING','Signed workspace observation receipt has a different identity');
  return receipt;
}

function bindExecutionWorkspace({store,registry,validation,manifest}){
  if(!Array.isArray(validation.executions)||validation.executions.length===0)
    fail('BUNDLE_WORKSPACE_BINDING','Execution workspace binding is absent');
  const receipts=[];
  for(const row of validation.executions){
    if(!plainObject(row)||typeof row.operationId!=='string'||!digest(row.receiptHash)||!digest(row.snapshotHash))
      fail('BUNDLE_WORKSPACE_BINDING','Signed execution workspace binding is malformed');
    const receipt=effectReceipt(store,registry,{id:row.operationId,hash:row.receiptHash,missionId:validation.missionId,
      principalId:validation.principalId,tool:'execution.run'}),result=receipt.result;
    if(!plainObject(result)||result.snapshotHash!==row.snapshotHash||!Array.isArray(result.manifest)
      ||sha256(result.manifest)!==row.snapshotHash||!same(result.manifest,manifest))
      fail('BUNDLE_WORKSPACE_BINDING','Current workspace does not equal the signed B execution snapshot');
    receipts.push({operationId:row.operationId,receiptHash:row.receiptHash,snapshotHash:row.snapshotHash});
  }
  return {method:'execution-snapshot',manifest,hash:sha256(manifest),executions:receipts};
}

function bindListedWorkspace({store,registry,validation,manifest}){
  const listings=validation.listings??[];
  if(!Array.isArray(validation.files)||!Array.isArray(listings))
    fail('BUNDLE_WORKSPACE_BINDING','Non-execution workspace binding lacks signed file/list observations');
  if(manifest.some(row=>row.type==='directory'))
    fail('BUNDLE_WORKSPACE_BINDING','A non-execution workspace needs a signed full-tree snapshot for directories');
  if(manifest.length===0&&validation.files.length===0&&listings.length===0)
    return {method:'empty-workspace',manifest,hash:sha256(manifest),executions:[]};
  if(listings.length!==1)fail('BUNDLE_WORKSPACE_BINDING','A non-empty workspace needs exactly one signed root listing');
  const listing=listings[0];
  if(!plainObject(listing)||typeof listing.path!=='string'||!digest(listing.sha256)||typeof listing.observedReceiptId!=='string'
    ||!digest(listing.observedReceiptHash)||!['.',''].includes(listing.path))
    fail('BUNDLE_WORKSPACE_BINDING','Signed root listing is malformed');
  const listed=effectReceipt(store,registry,{id:listing.observedReceiptId,hash:listing.observedReceiptHash,missionId:validation.missionId,
    principalId:validation.principalId,tool:'workspace.list'}).result;
  if(!plainObject(listed)||listed.path!==listing.path||!Array.isArray(listed.entries)||sha256(listed)!==listing.sha256)
    fail('BUNDLE_WORKSPACE_BINDING','Signed root listing differs from its receipt');
  const rootEntries=manifest.map(row=>({name:row.path,type:'file',bytes:row.bytes}));
  if(!same(listed.entries,rootEntries))fail('BUNDLE_WORKSPACE_BINDING','Current workspace does not equal the signed B root listing');
  const rows=new Map();
  for(const row of validation.files){
    if(!plainObject(row)||typeof row.path!=='string'||row.path.includes('/')||!digest(row.sha256)
      ||typeof row.observedReceiptId!=='string'||!digest(row.observedReceiptHash)||rows.has(row.path))
      fail('BUNDLE_WORKSPACE_BINDING','Signed file workspace binding is malformed');
    const receipt=effectReceipt(store,registry,{id:row.observedReceiptId,hash:row.observedReceiptHash,missionId:validation.missionId,
      principalId:validation.principalId,tool:'workspace.read'}),result=receipt.result;
    if(!plainObject(result)||result.path!==row.path||result.sha256!==row.sha256||sha256(result.content)!==row.sha256)
      fail('BUNDLE_WORKSPACE_BINDING','Signed file workspace binding differs from its receipt');
    rows.set(row.path,row.sha256);
  }
  if(rows.size!==manifest.length||manifest.some(row=>rows.get(row.path)!==row.sha256))
    fail('BUNDLE_WORKSPACE_BINDING','Current workspace files do not equal every signed B file observation');
  return {method:'root-listing-files',manifest,hash:sha256(manifest),executions:[]};
}

/**
 * Rebuild the filesystem part of B's signed validation from the persisted
 * database.  This deliberately rejects a workspace that B did not observe:
 * a post-B edit must not become newly retained evidence merely because the
 * generic post-close auditor can still reconcile the historical SQLite state.
 */
function workspaceBinding(root){
  let db=null;
  try{
    assertNoSqliteSidecars(root);
    const result=jsonEvidence(root,'result.json','Result'),reentry=jsonEvidence(root,'reentry.json','Re-entry');
    if(!plainObject(result)||typeof result.missionId!=='string'||!plainObject(reentry?.before)
      ||!plainObject(reentry.before.journal)||!plainObject(reentry?.journal?.validation)
      ||typeof reentry.journal.validation.id!=='string'||!digest(reentry.journal.validation.hash))
      fail('BUNDLE_WORKSPACE_BINDING','Closed re-entry does not expose an exact signed validation reference');
    db=new DatabaseSync(immutableSqliteUri(inside(root,'state.sqlite')),{readOnly:true,defensive:true,allowExtension:false});
    db.exec('PRAGMA query_only=ON; PRAGMA trusted_schema=OFF; BEGIN');
    const store=Object.create(Store.prototype);store.db=db;
    if(!store.get('authority-key','local-authority-v1'))fail('BUNDLE_WORKSPACE_BINDING','Closed validation has no existing Authority key');
    const authority=new Authority(store),registry=new ArtifactRegistry(store,authority);
    const validationRecord=store.get('workspace-validation',reentry.journal.validation.id);
    if(!validationRecord||validationRecord.hash!==reentry.journal.validation.hash||validationRecord.version!==1||!validationRecord.data?.signed)
      fail('BUNDLE_WORKSPACE_BINDING','Closed re-entry validation record is absent or changed');
    let validation;
    try{validation=authority.open(validationRecord.data.signed,'workspace.validation');}
    catch{fail('BUNDLE_WORKSPACE_BINDING','Closed re-entry validation signature is invalid');}
    if(!plainObject(validation)||validation.id!==validationRecord.id||validation.missionId!==result.missionId
      ||typeof validation.principalId!=='string'||validation.status!=='UNCHANGED')
      fail('BUNDLE_WORKSPACE_BINDING','Closed re-entry validation has a different mission, reviewer or status');
    const journal=auditRouteReentryJournal({store,registry,missionId:result.missionId,reviewerRunId:validation.principalId,
      beforeJournal:reentry.before.journal});
    if(journal.validation.id!==validationRecord.id||journal.validation.hash!==validationRecord.hash
      ||journal.validation.artifactId!==validation.artifactId||journal.validation.artifactHash!==validation.artifactHash)
      fail('BUNDLE_WORKSPACE_BINDING','Closed re-entry journal does not bind this exact signed validation');
    const workspaceRecord=store.get('tool-workspace',result.missionId),workspaceName=`mission-${sha256(result.missionId)}`;
    if(!workspaceRecord||workspaceRecord.version!==1||workspaceRecord.data?.missionId!==result.missionId
      ||workspaceRecord.data.resource!==`workspace:${result.missionId}`||typeof workspaceRecord.data.path!=='string'
      ||basename(workspaceRecord.data.path)!==workspaceName)
      fail('BUNDLE_WORKSPACE_BINDING','Closed mission workspace registration is absent or differs from B');
    const workspaceContainer=inside(root,'workspace'),containerStat=fs.lstatSync(workspaceContainer,{bigint:true});
    if(!containerStat.isDirectory()||containerStat.isSymbolicLink()||!same(fs.readdirSync(workspaceContainer).sort(),[workspaceName]))
      fail('BUNDLE_WORKSPACE_BINDING','Closed workspace root has an unbound mission directory or extra entry');
    const workspaceRoot=`workspace/${workspaceName}`,manifest=workspaceManifest(inside(root,workspaceRoot));
    const workspace=validation.executions?.length
      ?bindExecutionWorkspace({store,registry,validation,manifest})
      :bindListedWorkspace({store,registry,validation,manifest});
    return {schema:WORKSPACE_BINDING_SCHEMA,
      validation:{id:validation.id,recordHash:validationRecord.hash,missionId:validation.missionId,reviewerRunId:validation.principalId,
        artifactId:validation.artifactId,artifactHash:validation.artifactHash,status:validation.status,checkedAt:validation.checkedAt},
      workspace:{root:workspaceRoot,...workspace}};
  }catch(error){
    if(error?.code?.startsWith?.('BUNDLE_'))throw error;
    fail('BUNDLE_WORKSPACE_BINDING',`Cannot bind retained workspace to signed B validation: ${error?.message??'unknown error'}`);
  }finally{
    try{if(db?.isTransaction)db.exec('ROLLBACK');}catch{}
    try{db?.close();}catch{}
  }
}

function writeExclusive(path,bytes,mode=0o600){
  const fd=fs.openSync(path,fs.constants.O_WRONLY|fs.constants.O_CREAT|fs.constants.O_EXCL|fs.constants.O_NOFOLLOW,mode);
  try{fs.writeFileSync(fd,bytes);fs.fsyncSync(fd);}finally{fs.closeSync(fd);}
}

function syncDirectory(path){
  const fd=fs.openSync(path,fs.constants.O_RDONLY);
  try{fs.fsyncSync(fd);}finally{fs.closeSync(fd);}
}

function copyTree(source,target,rows){
  const directories=rows.filter(row=>row.type==='directory'&&row.path!=='.')
    .sort((left,right)=>left.path.split('/').length-right.path.split('/').length||left.path.localeCompare(right.path));
  for(const row of directories){
    const path=inside(target,row.path);fs.mkdirSync(path,{mode:0o700});
  }
  for(const row of rows.filter(row=>row.type==='file')){
    const read=stableRegularRead(source,row.path);
    if(read.bytes.length!==row.bytes||sha256(read.bytes)!==row.sha256)fail('BUNDLE_RACE','Evidence changed between inventory and copy');
    writeExclusive(inside(target,row.path),read.bytes,0o600);
  }
  for(const row of [...rows].filter(row=>row.type==='directory').sort((a,b)=>b.path.length-a.path.length))syncDirectory(inside(target,row.path));
}

function lockTree(root,rows){
  for(const row of rows.filter(row=>row.type==='file'))fs.chmodSync(inside(root,row.path),0o400);
  for(const row of [...rows].filter(row=>row.type==='directory').sort((a,b)=>b.path.length-a.path.length))fs.chmodSync(inside(root,row.path),0o500);
  for(const row of [...rows].filter(row=>row.type==='directory').sort((a,b)=>b.path.length-a.path.length))syncDirectory(inside(root,row.path));
}

function privateJson(path,value){
  writeExclusive(path,Buffer.from(JSON.stringify(value,null,2)+'\n'),0o600);
}

function verifierInputsOnce(){
  const files=new Map();
  const add=(path,bytes)=>{
    const clean=safeRelative(path),buffer=Buffer.from(bytes),row={path:clean,bytes:buffer.length,sha256:sha256(buffer)};
    const previous=files.get(clean);
    if(previous&&canonical(previous)!==canonical(row))fail('BUNDLE_VERIFIER','Verifier input path has conflicting bytes');
    files.set(clean,row);
  };
  // This deliberately includes the complete Factory runtime and its pinned
  // catalog inputs: ArtifactRegistry/missionReport can reach catalog data via
  // filesystem reads that a superficial ESM-import walk would miss.
  for(const item of collectRuntimeFiles()){
    // collectRuntimeFiles protects the catalog topology, but its ordinary
    // reads are not a capture primitive. Re-read every selected path through
    // the descriptor-stable reader before accepting this pass.
    const stable=stableRegularRead(repository,item.path).bytes;
    if(!Buffer.from(item.content).equals(stable))fail('BUNDLE_RACE','Verifier input changed while collecting its runtime closure');
    add(item.path,stable);
  }
  for(const path of VERIFICATION_INPUTS)add(path,stableRegularRead(repository,path).bytes);
  return {schema:'sovereign.adaptive-v3-verifier-inputs.v1',node:{version:process.version,sqlite:process.versions.sqlite??null},
    files:[...files.values()].sort((a,b)=>a.path.localeCompare(b.path))};
}

function verifierInputs(){
  // Capture the verifier closure twice. If a compiler, checkout or editor
  // moves any selected byte or catalogue input between passes, do not seal an
  // ambiguous evaluator identity.
  const first=verifierInputsOnce(),second=verifierInputsOnce();
  if(canonical(first)!==canonical(second))fail('BUNDLE_RACE','Verifier inputs changed during identity capture');
  return first;
}

function currentVerifierMatches(expected){
  if(!exact(expected,['files','node','schema'])||expected.schema!=='sovereign.adaptive-v3-verifier-inputs.v1'
    ||!exact(expected.node,['sqlite','version'])||typeof expected.node.version!=='string'
    ||(expected.node.sqlite!==null&&typeof expected.node.sqlite!=='string')||!Array.isArray(expected.files))
    fail('BUNDLE_VERIFIER','Verifier input declaration is malformed');
  for(const file of expected.files)if(!exact(file,['bytes','path','sha256'])||!safeRelative(file.path)
    ||!Number.isSafeInteger(file.bytes)||file.bytes<0||!digest(file.sha256))fail('BUNDLE_VERIFIER','Verifier input entry is malformed');
  if(new Set(expected.files.map(file=>file.path)).size!==expected.files.length)fail('BUNDLE_VERIFIER','Verifier input list has duplicate paths');
  if(canonical(expected)!==canonical(verifierInputs()))fail('BUNDLE_VERIFIER_DRIFT','Current verifier inputs differ from the retained evaluator');
  return true;
}

function declaredPayload(payload){
  const qualification=JSON.parse(stableRegularRead(payload,'qualification.json').bytes.toString('utf8'));
  const result=JSON.parse(stableRegularRead(payload,'result.json').bytes.toString('utf8'));
  return {caseId:qualification.caseId??null,missionId:qualification.missionId??null,mode:qualification.mode??null,
    simulation:qualification.simulation??null,fixtureDeclaration:qualification.fixtureDeclaration??null,
    result:{missionStatus:result.missionStatus??null,structuralPassed:result.structuralPassed??null,
      actualSubscription:result.actualSubscription??null,passed:result.passed??null}};
}

function buildManifest({row,rows,postClose,inputs,payload,workspaceBinding}){
  return {schema:SCHEMA,capturedAt:new Date().toISOString(),row,
    payload:{root:PAYLOAD,entries:rows,treeHash:sha256(rows),declared:declaredPayload(payload)},
    postCloseAudit:{path:POST_CLOSE_AUDIT,sha256:sha256(Buffer.from(JSON.stringify(postClose,null,2)+'\n'))},
    topLevel:{rootMode:0o500,manifestMode:0o400,postCloseAuditMode:0o400},
    verifierInputs:inputs,workspaceBinding,
    scope:'Complete closed local case tree retained for one adaptive-v3 planned CI row. The manifest is write-once and tamper-evident only when its SHA-256 is anchored outside this directory. The external system must bind that hash to the intended row/case/mission/time; this module compares a supplied hash but does not verify an anchor signer or anti-rollback ordering. It is not WORM storage and does not defend against the VPS owner, concurrent pathname replacement or a replacement external anchor.'};
}

function validateWorkspaceBindingShape(value){
  if(!exact(value,['schema','validation','workspace'])||value.schema!==WORKSPACE_BINDING_SCHEMA
    ||!exact(value.validation,['artifactHash','artifactId','checkedAt','id','missionId','recordHash','reviewerRunId','status'])
    ||typeof value.validation.id!=='string'||typeof value.validation.missionId!=='string'||typeof value.validation.reviewerRunId!=='string'
    ||typeof value.validation.artifactId!=='string'||typeof value.validation.checkedAt!=='string'||value.validation.status!=='UNCHANGED'
    ||!digest(value.validation.recordHash)||!digest(value.validation.artifactHash)
    ||!exact(value.workspace,['executions','hash','manifest','method','root'])||!['execution-snapshot','empty-workspace','root-listing-files'].includes(value.workspace.method)
    ||typeof value.workspace.root!=='string'||!safeRelative(value.workspace.root)||!Array.isArray(value.workspace.manifest)||!Array.isArray(value.workspace.executions)||!digest(value.workspace.hash)
    ||value.workspace.hash!==sha256(value.workspace.manifest))
    fail('BUNDLE_MANIFEST','Workspace-to-B validation binding is malformed');
  const paths=new Set();
  for(const row of value.workspace.manifest){
    const keys=row.type==='directory'?['path','type']:['bytes','path','sha256','type'];
    if(!exact(row,keys)||(row.type!=='directory'&&row.type!=='file')||!safeRelative(row.path)||paths.has(row.path)
      ||row.type==='file'&&(!Number.isSafeInteger(row.bytes)||row.bytes<0||!digest(row.sha256)))
      fail('BUNDLE_MANIFEST','Workspace binding manifest entry is malformed');
    paths.add(row.path);
  }
  for(const row of value.workspace.executions)if(!exact(row,['operationId','receiptHash','snapshotHash'])
    ||typeof row.operationId!=='string'||!digest(row.receiptHash)||!digest(row.snapshotHash))
    fail('BUNDLE_MANIFEST','Workspace binding execution reference is malformed');
  if(value.workspace.method==='execution-snapshot'&&value.workspace.executions.length===0
    ||value.workspace.method!=='execution-snapshot'&&value.workspace.executions.length!==0)
    fail('BUNDLE_MANIFEST','Workspace binding method and execution references disagree');
  return value;
}

function validateManifest(value){
  if(!exact(value,['capturedAt','payload','postCloseAudit','row','schema','scope','topLevel','verifierInputs','workspaceBinding'])||value.schema!==SCHEMA
    ||typeof value.capturedAt!=='string'||typeof value.row!=='string'||typeof value.scope!=='string')fail('BUNDLE_MANIFEST','Evidence bundle manifest is malformed');
  if(!exact(value.payload,['declared','entries','root','treeHash'])||value.payload.root!==PAYLOAD||!Array.isArray(value.payload.entries)
    ||!digest(value.payload.treeHash))fail('BUNDLE_MANIFEST','Evidence payload manifest is malformed');
  for(const row of value.payload.entries){
    const keys=row.type==='directory'?['mode','path','type']:['bytes','mode','path','sha256','type'];
    if(!exact(row,keys)||!['directory','file'].includes(row.type)||(row.path!=='.'&&!safeRelative(row.path))
      ||!Number.isSafeInteger(row.mode)||row.mode<0||row.mode>0o777
      ||row.type==='file'&&(!Number.isSafeInteger(row.bytes)||row.bytes<0||!digest(row.sha256)))fail('BUNDLE_MANIFEST','Evidence payload entry is malformed');
  }
  if(new Set(value.payload.entries.map(row=>row.path)).size!==value.payload.entries.length
    ||canonical(value.payload.entries)!==canonical([...value.payload.entries].sort((a,b)=>a.path.localeCompare(b.path))))
    fail('BUNDLE_MANIFEST','Evidence payload entries are not unique and ordered');
  if(!exact(value.postCloseAudit,['path','sha256'])||value.postCloseAudit.path!==POST_CLOSE_AUDIT||!digest(value.postCloseAudit.sha256))
    fail('BUNDLE_MANIFEST','Post-close audit binding is malformed');
  if(!exact(value.topLevel,['manifestMode','postCloseAuditMode','rootMode'])||value.topLevel.rootMode!==0o500
    ||value.topLevel.manifestMode!==0o400||value.topLevel.postCloseAuditMode!==0o400)
    fail('BUNDLE_MANIFEST','Top-level private write-once modes are malformed');
  validateWorkspaceBindingShape(value.workspaceBinding);
  return value;
}

function manifestBytes(root){return stableRegularRead(root,MANIFEST).bytes;}

function bundleRoot(directory){
  const root=safeRoot(directory,'Bundle'),names=fs.readdirSync(root).sort();
  if(canonical(names)!==canonical([MANIFEST,PAYLOAD,POST_CLOSE_AUDIT].sort()))fail('BUNDLE_TOPOLOGY','Bundle contains an unexpected top-level artifact');
  const payload=join(root,PAYLOAD),payloadStat=fs.lstatSync(payload,{bigint:true});
  if(!payloadStat.isDirectory()||payloadStat.isSymbolicLink())fail('BUNDLE_TOPOLOGY','Bundle payload must be a real directory');
  return {root,payload};
}

function assertTopLevelModes(root,topLevel){
  const mode=path=>unixMode(fs.lstatSync(path,{bigint:true}));
  if(mode(root)!==topLevel.rootMode||mode(join(root,MANIFEST))!==topLevel.manifestMode
    ||mode(join(root,POST_CLOSE_AUDIT))!==topLevel.postCloseAuditMode)
    fail('BUNDLE_TOP_LEVEL_MODE','Bundle top-level write-once modes differ from the sealed manifest');
}

function postCloseAudit(root){
  const raw=stableRegularRead(root,POST_CLOSE_AUDIT).bytes;
  let value;try{value=JSON.parse(raw);}catch{fail('BUNDLE_POST_CLOSE','Post-close audit is not JSON');}
  if(!exact(value,['audit','row','schema'])||value.schema!==POST_CLOSE_SCHEMA||typeof value.row!=='string'
    ||!value.audit||typeof value.audit!=='object'||Array.isArray(value.audit))fail('BUNDLE_POST_CLOSE','Post-close audit is malformed');
  return {raw,value};
}

function bundleSnapshot(root){return snapshotTree(root,{requireSingleLinks:true});}

function status({status,row,manifestSha256,checks,error=null,audit=null}){
  return {status,row,manifestSha256,checks,...(error?{error}:{}),...(audit?{audit}:{}),
    scope:'Read-only retained-evidence reconciliation. A passing row remains limited to its declared simulated/operational scope; it is not a live subscription, semantic truth or factory-completion claim.'};
}

const within=(candidate,root)=>{
  const path=relative(root,candidate);
  return path===''||path!=='..'&&!path.startsWith(`..${sep}`)&&!isAbsolute(path);
};

function assertRetentionLayout(source,target,parent){
  // A staging/reservation under source would itself become a post-close
  // mutation of the evidence we claim only to observe.  An ancestor parent is
  // fine (for example /tmp), but target or its direct parent must not be the
  // source or sit below it.
  if(within(target,source)||within(parent,source)||within(source,target))
    fail('BUNDLE_LAYOUT','Bundle target and its reservation parent must not intersect the closed source tree');
}

function reserveTarget(target){
  try{fs.mkdirSync(target,{mode:0o700});}
  catch(error){
    if(error?.code==='EEXIST')fail('BUNDLE_TARGET_EXISTS','Evidence bundle target must not exist');
    fail('BUNDLE_TARGET','Cannot reserve evidence bundle target');
  }
  const stat=fs.lstatSync(target,{bigint:true});
  if(!stat.isDirectory()||stat.isSymbolicLink())fail('BUNDLE_TARGET_RACE','Evidence bundle reservation is not a real directory');
  return {dev:stat.dev,ino:stat.ino};
}

function sameReservation(target,identity){
  try{
    const stat=fs.lstatSync(target,{bigint:true});
    return stat.isDirectory()&&!stat.isSymbolicLink()&&stat.dev===identity.dev&&stat.ino===identity.ino;
  }catch{return false;}
}

function assertReservation(target,identity){
  if(!sameReservation(target,identity))fail('BUNDLE_TARGET_RACE','Evidence bundle reservation changed while being sealed');
}

function unlockOwnedTree(path){
  const stat=fs.lstatSync(path,{bigint:true});
  if(stat.isDirectory()&&!stat.isSymbolicLink()){
    for(const entry of fs.readdirSync(path))unlockOwnedTree(join(path,entry));
    fs.chmodSync(path,0o700);return;
  }
  if(!stat.isSymbolicLink())fs.chmodSync(path,0o600);
}

/**
 * Capture a completed V3 case only after its harness promise has resolved and
 * closed its Engine. The destination must not exist. A failed row is retained
 * with its post-close result; it is never retried or reconstructed here.
 */
export function retainAdaptiveV3QualificationBundle({sourceDirectory,targetDirectory,row}={}){
  if(!adaptiveV3QualificationCase(row))fail('BUNDLE_ROW','A preregistered adaptive-v3 qualification row is required');
  const source=safeRoot(sourceDirectory,'Source'),target=typeof targetDirectory==='string'&&targetDirectory?resolve(targetDirectory):null;
  if(!target)fail('BUNDLE_PATH','Target directory is required');
  const parent=safeRoot(dirname(target),'Target parent');
  assertRetentionLayout(source,target,parent);
  let reservation=null;
  let committed=false;
  try{
    // mkdir is the no-clobber publication reservation.  It closes the
    // existsSync→rename replacement race; a bundle is not auditable until its
    // final exclusive manifest exists and its root has been sealed below.
    reservation=reserveTarget(target);
    assertNoSqliteSidecars(source);
    const before=snapshotTree(source),inputs=verifierInputs(),sourceWorkspaceBinding=workspaceBinding(source);
    assertReservation(target,reservation);
    const payload=join(target,PAYLOAD);fs.mkdirSync(payload,{mode:0o700});
    copyTree(source,payload,before);
    assertNoSqliteSidecars(source);
    const after=snapshotTree(source);
    if(canonical(before)!==canonical(after))fail('BUNDLE_RACE','Source evidence changed during retention');
    assertNoSqliteSidecars(payload);
    const payloadWorkspaceBinding=workspaceBinding(payload);
    if(!same(sourceWorkspaceBinding,payloadWorkspaceBinding))fail('BUNDLE_RACE','Workspace binding changed while retaining evidence');
    const audit=auditAdaptiveV3QualificationCase({directory:payload,row});
    const postClose={schema:POST_CLOSE_SCHEMA,row,audit};privateJson(join(target,POST_CLOSE_AUDIT),postClose);
    const payloadRows=snapshotTree(payload,{requireSingleLinks:true});
    lockTree(payload,payloadRows);
    const sealedPayloadRows=snapshotTree(payload,{requireSingleLinks:true});
    const manifest=buildManifest({row,rows:sealedPayloadRows,postClose,inputs,payload,workspaceBinding:payloadWorkspaceBinding});
    assertReservation(target,reservation);
    fs.chmodSync(join(target,POST_CLOSE_AUDIT),0o400);syncDirectory(target);
    privateJson(join(target,MANIFEST),manifest);fs.chmodSync(join(target,MANIFEST),0o400);syncDirectory(target);
    fs.chmodSync(target,0o500);syncDirectory(target);syncDirectory(parent);committed=true;
    return {directory:target,row,caseId:manifest.payload.declared.caseId,manifestSha256:sha256(manifestBytes(target)),
      terminalStatus:audit.status,scope:'Retained locally. Supply manifestSha256 from an external anchor to the read-only verifier; this return value alone is not an external anchor.'};
  }finally{
    if(!committed&&reservation&&sameReservation(target,reservation)){
      // Only remove the exact inode created above.  If a concurrent local
      // owner replaced it, leave it in place rather than deleting a foreign
      // path; pathname races beyond this detection remain out of scope.
      try{unlockOwnedTree(target);fs.rmSync(target,{recursive:true,force:true});}catch{}
    }
  }
}

/**
 * Verify a retained bundle without creating engines, brokers, providers,
 * runners, leases or evidence. `expectedManifestSha256` is intentionally
 * mandatory: reading a hash back out of the bundle is not an external anchor.
 * The caller is responsible for proving that this hash was externally bound
 * to the intended row/case/mission/time; this narrow API proves no signer,
 * append order or anti-rollback property of that external system.
 */
export function auditAdaptiveV3QualificationBundle({directory,row,expectedManifestSha256}={}){
  const checks={externalAnchor:false,topology:false,payload:false,workspaceBinding:false,verifierInputs:false,postClose:false,readOnly:false};
  if(!adaptiveV3QualificationCase(row))return status({status:'NOT_RUN',row:row??null,manifestSha256:null,checks,
    error:{code:'BUNDLE_ROW',message:'A preregistered adaptive-v3 qualification row is required'}});
  if(!digest(expectedManifestSha256))return status({status:'NOT_RUN',row,manifestSha256:null,checks,
    error:{code:'BUNDLE_EXTERNAL_ANCHOR',message:'An externally retained manifest SHA-256 is required'}});
  let root=null,before=null,manifestSha256=null,outcome=null;
  try{
    const paths=bundleRoot(directory);root=paths.root;before=bundleSnapshot(root);
    const rawManifest=manifestBytes(root);manifestSha256=sha256(rawManifest);
    if(manifestSha256!==expectedManifestSha256)fail('BUNDLE_EXTERNAL_ANCHOR','Manifest does not match the supplied external anchor');
    checks.externalAnchor=true;
    let manifest;try{manifest=JSON.parse(rawManifest);}catch{fail('BUNDLE_MANIFEST','Manifest is not JSON');}
    validateManifest(manifest);checks.topology=true;
    assertTopLevelModes(root,manifest.topLevel);
    if(manifest.row!==row)fail('BUNDLE_ROW','Requested row differs from the retained manifest row');
    assertNoSqliteSidecars(paths.payload);
    if(!same(manifest.payload.declared,declaredPayload(paths.payload)))
      fail('BUNDLE_PAYLOAD_DECLARATION','Payload declaration differs from its retained exact case files');
    const payloadRows=snapshotTree(paths.payload,{requireSingleLinks:true});
    if(canonical(payloadRows)!==canonical(manifest.payload.entries)||sha256(payloadRows)!==manifest.payload.treeHash)
      fail('BUNDLE_PAYLOAD_TOPOLOGY','Payload topology or bytes differ from the sealed manifest');
    checks.payload=true;
    const binding=workspaceBinding(paths.payload);
    if(!same(binding,manifest.workspaceBinding))fail('BUNDLE_WORKSPACE_BINDING','Payload workspace does not equal the B-bound workspace in the sealed manifest');
    checks.workspaceBinding=true;
    try{currentVerifierMatches(manifest.verifierInputs);checks.verifierInputs=true;}
    catch(error){
      if(error.code==='BUNDLE_VERIFIER_DRIFT')outcome=status({status:'NOT_RUN',row,manifestSha256,checks,error:errorView(error)});
      else throw error;
    }
    if(!outcome){
      const stored=postCloseAudit(root);
      if(sha256(stored.raw)!==manifest.postCloseAudit.sha256||stored.value.row!==row)fail('BUNDLE_POST_CLOSE','Post-close audit differs from the sealed manifest');
      const audit=auditAdaptiveV3QualificationCase({directory:paths.payload,row});
      if(canonical(audit)!==canonical(stored.value.audit))fail('BUNDLE_POST_CLOSE','Recomputed post-close audit differs from retained audit result');
      checks.postClose=true;
      outcome=status({status:audit.status,row,manifestSha256,checks,audit});
    }
  }catch(error){
    if(!outcome)outcome=status({status:'OBSERVED_NOT_QUALIFIED',row,manifestSha256,checks,error:errorView(error)});
  }finally{
    let unchanged=false;
    try{unchanged=root!==null&&before!==null&&canonical(before)===canonical(bundleSnapshot(root));}catch{}
    checks.readOnly=unchanged;
    if(outcome&&root!==null&&before!==null&&!unchanged){
      outcome.status='OBSERVED_NOT_QUALIFIED';delete outcome.audit;
      outcome.error??={code:'BUNDLE_READ_ONLY_MUTATION',message:'Retained evidence changed while being audited'};
    }
  }
  return outcome;
}

export const ADAPTIVE_V3_EVIDENCE_BUNDLE_SCHEMA=SCHEMA;
