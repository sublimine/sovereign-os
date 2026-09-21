import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {normalizeMissionInputs,captureMissionInputs,inputSubmissionFingerprint} from '../../factory/lib/mission-inputs.mjs';
import {sha256} from '../../factory/lib/contracts.mjs';
import {FactoryEngine} from '../../factory/lib/engine.mjs';
import {MissionQueue} from '../../factory/lib/queue.mjs';
import {missionInputManifest,missionInputContext} from '../../factory/lib/mission-inputs.mjs';
import {prepareMissionInputWorkspace,assertInputWorkingState} from '../../factory/lib/mission-input-workspace.mjs';
import {boundedReadSimulation} from './fixtures/bounded-read-simulation.mjs';
import {BOUNDED_READ_MODE} from '../../factory/lib/bounded-read-spec.mjs';
import {missionReport,formatMissionReport} from '../../factory/lib/report.mjs';

const limits={maxFileBytes:1024,maxWorkspaceBytes:2048,maxEntries:10};
function fixture(t){const dir=fs.mkdtempSync(join(tmpdir(),'sovereign-input-test-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));return dir;}
test('input admission preserves complete UTF8 including BOM, NFD and control bytes',()=>{
  const content='\uFEFFcafe\u0301\u00a0😀\n\t\u0000',a=normalizeMissionInputs([{path:'a/data.txt',content,provenance:'user-provided'}],limits);
  assert.equal(Buffer.from(a[0].base64,'base64').toString('utf8'),content);assert.equal(a[0].sha256,sha256(Buffer.from(content)));
  assert.equal(a[0].bytes,Buffer.byteLength(content));assert.equal(a[0].evidenceStatus,'USER_SUPPLIED_UNVERIFIED');
  assert.equal(inputSubmissionFingerprint('r',{inputs:[{path:'x',content}]}),inputSubmissionFingerprint('r',{inputs:[{path:'x',content:Buffer.from(content)}]}));
});
for(const path of ['/absolute','a/../b','./a','a//b','a\\b','a/','x\u0000y'])test('input rejects path '+JSON.stringify(path),()=>assert.throws(()=>normalizeMissionInputs([{path,content:'x'}],limits)));
test('input admission rejects duplicates, file/parent collisions and quota overflow',()=>{
  for(const paths of [['x','x'],['x','x/y'],['x/y','x']])assert.throws(()=>normalizeMissionInputs(paths.map(path=>({path,content:'x'})),limits));
  assert.throws(()=>normalizeMissionInputs([{path:'x',content:Buffer.from([0xff])}],limits),{code:'ENCODING'});
  assert.throws(()=>normalizeMissionInputs([{path:'x',content:'\uD800'}],limits),{code:'ENCODING'});
  assert.throws(()=>normalizeMissionInputs([{path:'x',content:'a'.repeat(1025)}],limits),{code:'WORKSPACE_LIMIT'});
  assert.throws(()=>normalizeMissionInputs([1,2,3].map(i=>({path:String(i),content:'a'.repeat(800)})),limits),{code:'WORKSPACE_LIMIT'});
  assert.throws(()=>normalizeMissionInputs([{path:'a/b/c',content:'x'}],{...limits,maxEntries:2}),{code:'WORKSPACE_LIMIT'});
});
test('host intake reads only explicit regular files and preserves original provenance',t=>{
  const d=fixture(t),source=join(d,'raw.txt');fs.writeFileSync(source,'original');
  const a=captureMissionInputs([{source,path:'input/raw.txt'}],limits);assert.equal(a[0].content.toString(),'original');assert.equal(a[0].provenance,source);
  fs.writeFileSync(source,'changed');assert.equal(a[0].content.toString(),'original');
  fs.symlinkSync(source,join(d,'link'));assert.throws(()=>captureMissionInputs([{source:join(d,'link'),path:'x'}],limits));
  fs.linkSync(source,join(d,'hard'));assert.throws(()=>captureMissionInputs([{source,path:'x'}],limits));
  assert.throws(()=>captureMissionInputs([{source:d,path:'x'}],limits));
});
test('host read detects changed open file rather than authenticating mixed contents',t=>{
  const d=fixture(t),source=join(d,'raw');fs.writeFileSync(source,'before');
  assert.throws(()=>captureMissionInputs([{source,path:'x'}],limits,{afterRead:()=>fs.writeFileSync(source,'after!')}),{code:'INPUT_SOURCE_CHANGED'});
});
function system(t){const dir=fixture(t),config={databasePath:join(dir,'state.sqlite'),workspaceRoot:join(dir,'workspaces')};
  const engine=new FactoryEngine(config);t.after(()=>engine.close());return {dir,engine,store:engine.store,queue:new MissionQueue({engine}),config};}
test('queue publishes original input bytes and floor atomically, without a workspace race',t=>{
  const s=system(t),options={inputs:[{path:'a/input.txt',content:'original',provenance:'/private/origin'}]};
  const job=s.queue.submit('Read a/input.txt',options,'submission:input');
  assert.equal(s.store.db.prepare('PRAGMA user_version').get().user_version,15);
  assert.equal(missionInputManifest(s.store,job.missionId).files[0].sha256,sha256('original'));
  assert.equal(s.store.get('tool-workspace',job.missionId),null);assert.equal(s.store.list('run').length,0);
  assert.deepEqual(s.queue.submit('Read a/input.txt',options,'submission:input'),job);
  assert.throws(()=>s.queue.submit('Read a/input.txt',{inputs:[{path:'a/input.txt',content:'changed'}]},'submission:input'),{code:'SUBMISSION_CONFLICT'});
  assert.equal(s.store.list('mission').length,1);assert.ok(!JSON.stringify(missionInputContext(s.store,job.missionId)).includes('/private/origin'));
  assert.ok(!JSON.stringify(s.store.get('mission',job.missionId).data.policy).includes('original'));
  assert.equal(prepareMissionInputWorkspace(s.engine.broker,job.missionId),true);
  const path=s.engine.broker.resolvePath(job.missionId,'a/input.txt');assert.equal(fs.readFileSync(path,'utf8'),'original');
  const before=fs.statSync(path);assert.equal(prepareMissionInputWorkspace(s.engine.broker,job.missionId),true);assert.equal(fs.statSync(path).ino,before.ino);
  assert.equal(s.store.list('effect').length,0);assert.equal(s.store.get('input-preparation',job.missionId).version,1);
});
test('input creation rollback leaves no partially queued mission, floor or filesystem copy',t=>{
  const s=system(t),put=s.store.put.bind(s.store),floor=s.store.db.prepare('PRAGMA user_version').get().user_version;
  s.store.put=(type,...args)=>{if(type==='queue-job')throw Error('SIM commit failure');return put(type,...args);};
  assert.throws(()=>s.queue.submit('r',{inputs:[{path:'x',content:'x'}]},'submission:rollback'),/SIM commit failure/);
  assert.equal(s.store.list('mission').length,0);assert.equal(s.store.list('mission-input-bytes').length,0);
  assert.equal(s.store.db.prepare('PRAGMA user_version').get().user_version,floor);assert.deepEqual(fs.readdirSync(s.config.workspaceRoot),[]);
});
test('changed prepared input blocks before any planning/provider request and is never restored',async t=>{
  const s=system(t),m=s.engine.create('Read x',{inputs:[{path:'x',content:'original'}]});prepareMissionInputWorkspace(s.engine.broker,m.id);
  const path=s.engine.broker.resolvePath(m.id,'x');fs.writeFileSync(path,'external');let called=0;s.engine.workers.providerFactory=()=>{called++;throw Error('should not call');};
  const result=await s.engine.run(m.id);assert.equal(result.mission.status,'NEEDS_DIRECTION');assert.equal(result.mission.pending[0].code,'WORKSPACE_CHANGED');
  assert.equal(called,0);assert.equal(s.store.list('mission-inference-call').length,0);assert.equal(fs.readFileSync(path,'utf8'),'external');
});
test('authorized broker writes retain original snapshot and recover without reapplying it',async t=>{
  const s=system(t),m=s.engine.create('Edit x',{inputs:[{path:'x',content:'original'}]});prepareMissionInputWorkspace(s.engine.broker,m.id);
  const lease=s.engine.authority.issue({missionId:m.id,principalId:'test-worker',actions:['workspace.write','workspace.read'],resources:['workspace:'+m.id],classification:'INTERNAL',expiresAt:new Date(Date.now()+60000).toISOString()});
  const receipt=await s.engine.broker.execute({missionId:m.id,principalId:'test-worker',lease,operationId:'test-write',tool:'workspace.write',args:{path:'x',content:'updated',expectedHash:sha256('original')}});
  assert.equal(s.engine.authority.open(receipt,'tool.receipt').status,'SUCCEEDED');assertInputWorkingState(s.engine.broker,m.id);
  prepareMissionInputWorkspace(s.engine.broker,m.id);assert.equal(fs.readFileSync(s.engine.broker.resolvePath(m.id,'x'),'utf8'),'updated');
  assert.equal(missionInputManifest(s.store,m.id).files[0].sha256,sha256('original'));
});
test('manifest removal cannot skip file admission',t=>{
  const s=system(t),m=s.engine.create('Read x',{inputs:[{path:'x',content:'original'}]});
  const r=s.store.get('mission',m.id),{inputManifestHash,...changed}=r.data;s.store.put('mission',m.id,changed,{expectedVersion:r.version});
  assert.throws(()=>missionInputManifest(s.store,m.id),{code:'INPUT_ADMISSION_INTEGRITY'});
});
for(const mutation of ['manifest-version','blob-version','floor'])test('input binding rejects '+mutation,t=>{
  const s=system(t),m=s.engine.create('Read x',{inputs:[{path:'x',content:'original'}]});
  if(mutation==='floor')s.store.db.exec('PRAGMA user_version=6');
  else{const type=mutation==='manifest-version'?'mission-input-manifest':'mission-input-bytes',r=s.store.list(type)[0];s.store.put(type,r.id,r.data,{expectedVersion:r.version});}
  assert.throws(()=>missionInputManifest(s.store,m.id),{code:'INPUT_ADMISSION_INTEGRITY'});
});
test('normal queued input traverses actual engine, broker and independent review with SIM provider',async t=>{
  const s=system(t),model=boundedReadSimulation(s.engine,'queued-input');
  const job=s.queue.submit('Read input.txt and add its supplied numbers only. Do not write or execute.',
    {entryMode:BOUNDED_READ_MODE,allowedTools:['workspace.read'],inputs:[{path:'input.txt',content:'13\n17\n',provenance:'/private/source'}]});
  s.queue.acquire();try{const result=await s.queue.runNext();assert.equal(result.status,'COMPLETED',JSON.stringify(s.engine.status(job.missionId).mission.pending));}finally{s.queue.release();}
  assert.equal(model.calls,3);assert.equal(model.closes,3);assert.equal(s.store.list('effect').length,2);
  assert.ok(s.store.list('effect').every(r=>r.data.tool==='workspace.read'&&r.data.state==='SUCCEEDED'));
  assert.equal(s.engine.status(job.missionId).outcome.payload.body,'13 + 17 = 30.');
  assert.equal((await s.engine.run(job.missionId)).mission.status,'COMPLETED');assert.equal(model.calls,3);
  const retained=s.store.list('inference-request').map(r=>r.data.requestJson);assert.ok(retained.length===3);
  assert.ok(retained.every(r=>r.includes('USER_SUPPLIED_UNVERIFIED')&&!r.includes('/private/source')));
  const report=missionReport(s.store,job.missionId,{registry:s.engine.registry});assert.equal(report.inputs.preparation.status,'READY');
  assert.match(formatMissionReport(report),/Adjuntos originales/);assert.ok(!JSON.stringify(report.inputs).includes('/private/source'));
});
for(const boundary of ['directory.reserved','directory.committed','file.reserved','file.staged','file.published','file.unlinked','file.committed','inputs.before-ready','inputs.ready'])
  test('local preparation resumes exact durable state after '+boundary,t=>{
    const s=system(t),m=s.engine.create('Read input.txt',{inputs:[{path:'input.txt',content:'13\n17\n'}]});let cut=false;
    assert.throws(()=>prepareMissionInputWorkspace(s.engine.broker,m.id,{checkpoint:stage=>{if(stage===boundary&&!cut){cut=true;throw Error('SIM interruption');}}}),/SIM interruption/);
    assert.equal(prepareMissionInputWorkspace(s.engine.broker,m.id),true);
    assert.equal(fs.readFileSync(s.engine.broker.resolvePath(m.id,'input.txt'),'utf8'),'13\n17\n');assert.equal(s.store.list('run').length,0);
  });
for(const boundary of ['directory.created','file.created','file.synced'])test('unobserved identity after '+boundary+' remains uncertain, never overwritten',t=>{
  const s=system(t),m=s.engine.create('Read x',{inputs:[{path:'x',content:'original'}]});
  assert.throws(()=>prepareMissionInputWorkspace(s.engine.broker,m.id,{checkpoint:stage=>{if(stage===boundary)throw Error('SIM interruption');}}),/SIM interruption/);
  assert.throws(()=>prepareMissionInputWorkspace(s.engine.broker,m.id),{code:'INPUT_PREPARATION_UNCERTAIN'});assert.equal(s.store.list('run').length,0);
});
test('admission never adopts a foreign workspace',t=>{
  const s=system(t),m=s.engine.create('Read x',{inputs:[{path:'x',content:'original'}]});
  const root=join(s.config.workspaceRoot,'mission-'+sha256(m.id));fs.mkdirSync(root);fs.writeFileSync(join(root,'foreign'),'preserve');
  assert.throws(()=>prepareMissionInputWorkspace(s.engine.broker,m.id),{code:'INPUT_PREPARATION_UNCERTAIN'});
  assert.equal(fs.readFileSync(join(root,'foreign'),'utf8'),'preserve');assert.equal(s.store.get('tool-workspace',m.id),null);
});
test('changed staging bytes cannot be published or overwritten on recovery',t=>{
  const s=system(t),m=s.engine.create('Read x',{inputs:[{path:'x',content:'original'}]});
  assert.throws(()=>prepareMissionInputWorkspace(s.engine.broker,m.id,{checkpoint:stage=>{if(stage==='file.staged')throw Error('cut');}}),/cut/);
  const temporary=s.store.list('input-prepared-file')[0].data.temporary;fs.writeFileSync(temporary,'external');
  assert.throws(()=>prepareMissionInputWorkspace(s.engine.broker,m.id),{code:'INPUT_PREPARATION_UNCERTAIN'});assert.equal(fs.readFileSync(temporary,'utf8'),'external');
  assert.equal(fs.existsSync(s.engine.broker.resolvePath(m.id,'x')),false);
});
test('a source altered at the actual read boundary is never returned with an admitted version',t=>{
  const s=system(t),m=s.engine.create('Read x',{inputs:[{path:'x',content:'original'}]});prepareMissionInputWorkspace(s.engine.broker,m.id);
  const target=s.engine.broker.resolvePath(m.id,'x'),read=s.engine.broker.readFile.bind(s.engine.broker);let reads=0;
  s.engine.broker.readFile=path=>{if(path===target&&++reads===2)fs.writeFileSync(path,'modified');return read(path);};
  assert.throws(()=>s.engine.broker.workspaceTool(m.id,'workspace.read',{path:'x'}),{code:'WORKSPACE_CHANGED'});assert.equal(reads,2);
});
test('same-byte foreign inode cannot replace owned admission',t=>{
  const s=system(t),m=s.engine.create('Read a/x',{inputs:[{path:'a/x',content:'original'}]});prepareMissionInputWorkspace(s.engine.broker,m.id);
  const target=s.engine.broker.resolvePath(m.id,'a/x');fs.renameSync(target,join(s.dir,'saved'));fs.writeFileSync(target,'original');
  assert.throws(()=>assertInputWorkingState(s.engine.broker,m.id),{code:'WORKSPACE_CHANGED'});
});
test('foreign final target appearing after staging is never replaced',t=>{
  const s=system(t),m=s.engine.create('Read x',{inputs:[{path:'x',content:'original'}]});
  assert.throws(()=>prepareMissionInputWorkspace(s.engine.broker,m.id,{checkpoint:stage=>{if(stage==='file.staged')throw Error('cut');}}),/cut/);
  const target=s.engine.broker.resolvePath(m.id,'x');fs.writeFileSync(target,'foreign');
  assert.throws(()=>prepareMissionInputWorkspace(s.engine.broker,m.id),{code:'INPUT_PREPARATION_UNCERTAIN'});assert.equal(fs.readFileSync(target,'utf8'),'foreign');
});
test('parent directory symlink cannot replace admitted directory even with matching bytes',t=>{
  const s=system(t),m=s.engine.create('Read a/x',{inputs:[{path:'a/x',content:'original'}]});prepareMissionInputWorkspace(s.engine.broker,m.id);
  const parent=join(s.engine.broker.workspace(m.id),'a'),moved=join(s.dir,'moved');fs.renameSync(parent,moved);fs.symlinkSync(moved,parent);
  assert.throws(()=>assertInputWorkingState(s.engine.broker,m.id),{code:'WORKSPACE_CHANGED'});
});
test('direct worker invocation cannot reserve or dispatch inference before input preparation',async t=>{
  const s=system(t),m=s.engine.create('Read x',{inputs:[{path:'x',content:'original'}]});let calls=0;
  const run=s.engine.registry.registerRun({missionId:m.id,nodeId:'test-node',mode:'producer',context:{purpose:'test',artifactIds:[],sourceIds:[],instructionsHash:sha256('test'),producerConversationIncluded:false}});
  s.engine.workers.providerFactory=()=>{calls++;throw Error('provider must not start');};
  await assert.rejects(s.engine.workers.infer({runId:run.id,instructions:'test',input:'{}',schema:{},validate:()=>true}),{code:'INPUT_NOT_PREPARED'});
  assert.equal(calls,0);assert.equal(s.store.list('mission-inference-call').length,0);
});
test('direct broker call cannot perform any effect before input preparation',async t=>{
  const s=system(t),m=s.engine.create('Read x',{inputs:[{path:'x',content:'original'}]});
  const lease=s.engine.authority.issue({missionId:m.id,principalId:'test-worker',actions:['workspace.read'],resources:['workspace:'+m.id],classification:'INTERNAL',expiresAt:new Date(Date.now()+60000).toISOString()});
  await assert.rejects(s.engine.broker.execute({missionId:m.id,principalId:'test-worker',lease,operationId:'test-before-ready',tool:'workspace.read',args:{path:'x'}}),{code:'INPUT_NOT_PREPARED'});
  assert.equal(s.store.list('effect').length,0);
});
for(const type of ['input-directory','input-prepared-file'])test('input preparation cannot silently replace its original identity via '+type,t=>{
  const s=system(t),m=s.engine.create('Read x',{inputs:[{path:'x',content:'original'}]});prepareMissionInputWorkspace(s.engine.broker,m.id);
  const r=s.store.list(type)[0];s.store.put(type,r.id,r.data,{expectedVersion:r.version});
  assert.throws(()=>assertInputWorkingState(s.engine.broker,m.id),{code:'INPUT_PREPARATION_UNCERTAIN'});
});
