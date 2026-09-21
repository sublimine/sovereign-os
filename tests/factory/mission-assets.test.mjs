import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {spawnSync} from 'node:child_process';
import {FactoryEngine} from '../../factory/lib/engine.mjs';
import {sha256} from '../../factory/lib/contracts.mjs';
import {prepareMissionInputWorkspace} from '../../factory/lib/mission-input-workspace.mjs';
import {
  SUBLIMINE_ASSET_MANIFEST_INPUT_PATH,
  SUBLIMINE_ASSET_MANIFEST_OPTION_SCHEMA,
  SUBLIMINE_ASSET_MANIFEST_SCHEMA,
  sublimineMissionAssetManifest,
} from '../../factory/lib/mission-assets.mjs';

const cli=new URL('../../factory/bin/sovereign.mjs',import.meta.url).pathname;

function fixture(t){
  const directory=fs.mkdtempSync(join(tmpdir(),'sublimine-assets-'));
  t.after(()=>fs.rmSync(directory,{recursive:true,force:true}));
  return directory;
}

function system(t){
  const directory=fixture(t);
  const engine=new FactoryEngine({databasePath:join(directory,'state.sqlite'),workspaceRoot:join(directory,'workspaces')});
  t.after(()=>engine.close());
  return {directory,engine};
}

function assetManifest({filename='board-pack.pdf',mediaType='application/pdf',size=4096}={}){
  return {
    schema:SUBLIMINE_ASSET_MANIFEST_SCHEMA,
    projectId:'project:123e4567-e89b-12d3-a456-426614174000',
    assets:[{
      assetId:'asset:223e4567-e89b-12d3-a456-426614174000',
      sha256:'a'.repeat(64),
      mediaType,
      size,
      filename,
    }],
  };
}

function admittedAssets(manifest=assetManifest()){
  const content=JSON.stringify(manifest);
  return {
    manifest,
    content,
    inputs:[
      {path:'brief.txt',content:'ordinary public brief'},
      {path:SUBLIMINE_ASSET_MANIFEST_INPUT_PATH,content},
    ],
    option:{
      schema:SUBLIMINE_ASSET_MANIFEST_OPTION_SCHEMA,
      inputSha256:sha256(content),
      manifest,
    },
  };
}

function privateValues(manifest){
  const asset=manifest.assets[0];
  return [manifest.projectId,asset.assetId,asset.sha256,asset.mediaType,asset.filename,SUBLIMINE_ASSET_MANIFEST_INPUT_PATH];
}

test('sealed asset metadata is immutable but excluded from generic worker, broker snapshot and public report surfaces',async t=>{
  const {engine}=system(t),admitted=admittedAssets();
  const mission=engine.create('Produce an institutional brief from the ordinary request.',{
    inputs:admitted.inputs,
    assetManifest:admitted.option,
    allowedTools:['workspace.list','workspace.read'],
  });
  assert.equal(engine.store.db.prepare('PRAGMA user_version').get().user_version,17);
  const binding=sublimineMissionAssetManifest(engine.store,mission.id);
  assert.deepEqual(binding.manifest,admitted.manifest);
  assert.equal(binding.input.path,SUBLIMINE_ASSET_MANIFEST_INPUT_PATH);
  assert.equal(binding.input.sha256,admitted.option.inputSha256);

  prepareMissionInputWorkspace(engine.broker,mission.id);
  const planner=engine.workers.createRun({missionId:mission.id,nodeId:'planning',mode:'producer',purpose:'plan',roleIds:['omega_04','omega_05']});
  const exposure=engine.workers.context(planner.id),serializedExposure=JSON.stringify(exposure);
  assert.equal(exposure.assetsPresent,true);
  assert.deepEqual(exposure.missionInputs.files.map(file=>file.path),['brief.txt']);
  for(const value of privateValues(admitted.manifest))assert.ok(!serializedExposure.includes(value),value);

  const blocked=await engine.workers.tool(planner.id,'workspace.read',{path:SUBLIMINE_ASSET_MANIFEST_INPUT_PATH},'asset-manifest-read');
  assert.equal(blocked.status,'FAILED');
  assert.equal(blocked.result.error.code,'ASSET_MANIFEST_SCOPE');
  const listed=await engine.workers.tool(planner.id,'workspace.list',{path:'assets'},'asset-manifest-list');
  assert.equal(listed.status,'SUCCEEDED');
  assert.deepEqual(listed.result.entries,[]);

  const snapshot=engine.broker.executionSnapshot(mission.id,{principalId:planner.id}),serializedSnapshot=JSON.stringify(snapshot);
  assert.ok(snapshot.files.some(file=>file.path==='brief.txt'));
  for(const value of privateValues(admitted.manifest))assert.ok(!serializedSnapshot.includes(value),value);
  assert.ok(!snapshot.manifest.some(entry=>entry.path==='assets'));

  const status=engine.status(mission.id),report=engine.report(mission.id),serializedReport=JSON.stringify(report);
  assert.equal(status.mission.status,'NEW');
  assert.deepEqual(report.assets,{
    present:true,
    count:1,
    inspect:'UNAVAILABLE_NO_CAPABILITY_BOUND_RESOLVER',
    scope:'Immutable project assets are attached to this mission, but this Factory version has no byte-reading or extraction capability for them.',
  });
  assert.deepEqual(report.inputs.files.map(file=>file.path),['brief.txt']);
  for(const value of privateValues(admitted.manifest))assert.ok(!serializedReport.includes(value),value);
  assert.ok(!JSON.stringify(status).includes(admitted.manifest.projectId));
});

test('planner is explicitly warned about the missing resolver while provider input carries only the presence flag',async t=>{
  const {engine}=system(t),admitted=admittedAssets();
  const mission=engine.create('Use the attached source material only when a qualified resolver exists.',{
    inputs:admitted.inputs,
    assetManifest:admitted.option,
    maxPlanAttempts:1,
  });
  prepareMissionInputWorkspace(engine.broker,mission.id);
  let request=null;
  engine.workers.providerFactory=()=>({
    async generate(candidate){
      request=candidate;
      throw Object.assign(Error('Fixture quota stop after capturing the exact planner request'),{code:'QUOTA'});
    },
    async close(){return {processExitObserved:true};},
  });
  await assert.rejects(engine.plan(mission,new AbortController().signal),{code:'QUOTA'});
  assert.ok(request);
  assert.match(request.instructions,/sealed project assets/);
  assert.match(request.instructions,/no asset byte-reading, extraction or inspection capability/);
  assert.match(request.input,/"assetsPresent":true/);
  for(const value of privateValues(admitted.manifest)){
    assert.ok(!request.instructions.includes(value),value);
    assert.ok(!request.input.includes(value),value);
  }
});

test('execution producer receives the same no-resolver boundary without asset metadata or a hidden path',async t=>{
  const {engine}=system(t),admitted=admittedAssets();
  const mission=engine.create('Produce a bounded project result without inventing attached-file contents.',{
    inputs:admitted.inputs,
    assetManifest:admitted.option,
  });
  prepareMissionInputWorkspace(engine.broker,mission.id);
  const node={
    id:'asset-aware-producer',
    title:'Bounded producer',
    purpose:'bounded production',
    roleIds:['omega_02'],
    reviewerRoleIds:['omega_03'],
    requirementIds:['r1'],
    dependencies:[],
    method:{id:'bounded-production',rationale:'Use only actually available evidence.',alternatives:['Pause for an explicit resolver capability.']},
    instructions:'Do not claim facts from an unavailable attached file.',
    outputKind:'delivery',
    criteria:[],
    requiredEffects:[],
    tools:[],
    specialist:null,
  };
  const run=engine.workers.createRun({missionId:mission.id,nodeId:node.id,mode:'producer',purpose:node.purpose,roleIds:node.roleIds});
  let request=null;
  engine.workers.providerFactory=()=>({
    async generate(candidate){
      request=candidate;
      throw Object.assign(Error('Fixture quota stop after capturing the exact producer request'),{code:'QUOTA'});
    },
    async close(){},
  });
  await assert.rejects(engine.workers.produce({missionId:mission.id,node,runId:run.id}),{code:'QUOTA'});
  assert.ok(request);
  assert.match(request.instructions,/sealed project assets/);
  assert.match(request.instructions,/do not infer contents, filenames, types, provenance or facts/);
  assert.match(request.input,/"assetsPresent":true/);
  for(const value of privateValues(admitted.manifest)){
    assert.ok(!request.instructions.includes(value),value);
    assert.ok(!request.input.includes(value),value);
  }
});

test('asset manifest admission rejects unsealed, malformed, mismatched and bypassable descriptors',t=>{
  const {engine}=system(t),admitted=admittedAssets();
  assert.throws(()=>engine.create('Reserved input cannot become an ordinary attachment.',{
    inputs:[{path:SUBLIMINE_ASSET_MANIFEST_INPUT_PATH,content:admitted.content}],
  }),{code:'ASSET_MANIFEST_ADMISSION'});
  assert.throws(()=>engine.create('Missing immutable input.',{assetManifest:admitted.option}),{code:'ASSET_MANIFEST_ADMISSION'});
  assert.throws(()=>engine.create('Wrong capture path.',{
    inputs:[{path:'other-manifest.json',content:admitted.content}],assetManifest:admitted.option,
  }),{code:'ASSET_MANIFEST_ADMISSION'});
  assert.throws(()=>engine.create('Different exact input bytes.',{
    inputs:[{path:SUBLIMINE_ASSET_MANIFEST_INPUT_PATH,content:admitted.content+'\n'}],assetManifest:admitted.option,
  }),{code:'ASSET_MANIFEST_ADMISSION'});
  const hostPath=structuredClone(admitted.manifest);
  hostPath.assets[0].path='/srv/project-assets/top-secret.pdf';
  assert.throws(()=>engine.create('Host path injection.',{
    inputs:admitted.inputs,
    assetManifest:{...admitted.option,manifest:hostPath},
  }),{code:'ASSET_MANIFEST_ADMISSION'});
  const url=structuredClone(admitted.manifest);
  url.assets[0].url='https://vault.invalid/object';
  assert.throws(()=>engine.create('URL injection.',{
    inputs:admitted.inputs,
    assetManifest:{...admitted.option,manifest:url},
  }),{code:'ASSET_MANIFEST_ADMISSION'});
  const bytes=structuredClone(admitted.manifest);
  bytes.assets[0].base64='cHJldGVuZC1ieXRlcw==';
  assert.throws(()=>engine.create('Bytes injection.',{
    inputs:admitted.inputs,
    assetManifest:{...admitted.option,manifest:bytes},
  }),{code:'ASSET_MANIFEST_ADMISSION'});
  assert.equal(engine.store.list('mission').length,0);
});

test('asset binding tampering quarantines public status and report instead of exposing the private manifest',t=>{
  const {engine}=system(t),admitted=admittedAssets();
  const mission=engine.create('Fail closed on asset binding tamper.',{inputs:admitted.inputs,assetManifest:admitted.option});
  const record=engine.store.get('mission-asset-manifest',mission.id);
  const changed=structuredClone(record.data);
  changed.manifest.assets[0].filename='substituted.pdf';
  engine.store.put('mission-asset-manifest',mission.id,changed,{expectedVersion:record.version});
  assert.throws(()=>sublimineMissionAssetManifest(engine.store,mission.id),{code:'ASSET_MANIFEST_INTEGRITY'});
  const status=engine.status(mission.id),report=engine.report(mission.id);
  assert.equal(status.integrity,'UNVERIFIED');
  assert.equal(report.metrics.integrity,'UNVERIFIED');
  const projected=JSON.stringify({status,report});
  for(const value of privateValues(admitted.manifest))assert.ok(!projected.includes(value),value);
  assert.ok(!projected.includes('substituted.pdf'));
});

test('asset binding refuses a downgraded execution protocol before any ordinary input surface can use it',t=>{
  const {engine}=system(t),admitted=admittedAssets();
  const mission=engine.create('Fail closed on protocol downgrade.',{inputs:admitted.inputs,assetManifest:admitted.option});
  engine.store.db.exec('PRAGMA user_version=16');
  assert.throws(()=>sublimineMissionAssetManifest(engine.store,mission.id),{code:'ASSET_MANIFEST_INTEGRITY'});
  const projected=JSON.stringify({status:engine.status(mission.id),report:engine.report(mission.id)});
  for(const value of privateValues(admitted.manifest))assert.ok(!projected.includes(value),value);
});

test('CLI admits only the exact metadata-only assets/manifest.json input and keeps report JSON private',t=>{
  const directory=fixture(t),state=join(directory,'state'),assetPath=join(directory,'asset-manifest.json'),inputPath=join(directory,'inputs.json');
  const admitted=admittedAssets();
  fs.writeFileSync(assetPath,admitted.content);
  fs.writeFileSync(inputPath,JSON.stringify([
    {source:assetPath,path:SUBLIMINE_ASSET_MANIFEST_INPUT_PATH},
  ]));
  const unbound=spawnSync(process.execPath,[cli,'submit','--text','Unbound reserved manifest.','--inputs',inputPath,
    '--state-dir',join(directory,'unbound-state')],{encoding:'utf8',timeout:15000,maxBuffer:1024*1024});
  assert.notEqual(unbound.status,0);
  assert.match(unbound.stderr,/reserved sealed asset channel/);
  const submit=spawnSync(process.execPath,[cli,'submit','--text','CLI attachment request.','--inputs',inputPath,
    '--asset-manifest',assetPath,'--state-dir',state],{encoding:'utf8',timeout:15000,maxBuffer:1024*1024});
  assert.equal(submit.status,0,submit.stderr);
  const missionId=JSON.parse(submit.stdout).missionId;
  const report=spawnSync(process.execPath,[cli,'report',missionId,'--state-dir',state,'--json'],{encoding:'utf8',timeout:15000,maxBuffer:1024*1024});
  assert.equal(report.status,0,report.stderr);
  assert.match(report.stdout,/UNAVAILABLE_NO_CAPABILITY_BOUND_RESOLVER/);
  for(const value of privateValues(admitted.manifest))assert.ok(!report.stdout.includes(value),value);

  const wrongPath=join(directory,'wrong-manifest.json');
  fs.writeFileSync(wrongPath,JSON.stringify(assetManifest({filename:'different.pdf'})));
  const mismatch=spawnSync(process.execPath,[cli,'submit','--text','Mismatch.','--inputs',inputPath,
    '--asset-manifest',wrongPath,'--state-dir',join(directory,'mismatch-state')],{encoding:'utf8',timeout:15000,maxBuffer:1024*1024});
  assert.notEqual(mismatch.status,0);
  assert.match(mismatch.stderr,/does not name the captured input bytes/);
});
