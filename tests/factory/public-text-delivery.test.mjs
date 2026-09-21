import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {DatabaseSync} from 'node:sqlite';
import {Store} from '../../factory/lib/store.mjs';
import {Authority} from '../../factory/lib/authority.mjs';
import {ArtifactRegistry} from '../../factory/lib/artifacts.mjs';
import {FactoryEngine} from '../../factory/lib/engine.mjs';
import {sha256} from '../../factory/lib/contracts.mjs';
import {
  MAX_PUBLIC_TEXT_DELIVERY_BYTES,
  PUBLIC_TEXT_DELIVERY_MEDIA_TYPE,
  PUBLIC_TEXT_DELIVERY_SCHEMA,
  readPublicTextDelivery
} from '../../factory/lib/public-text-delivery.mjs';

const cli=new URL('../../factory/bin/sovereign.mjs',import.meta.url).pathname;
const code=expected=>error=>error?.code===expected;

function memoryFixture(t){
  const root=mkdtempSync(join(tmpdir(),'sovereign-public-text-delivery-')),
    store=new Store(':memory:'),authority=new Authority(store),registry=new ArtifactRegistry(store,authority),
    engine=new FactoryEngine({store,authority,registry,workspaceRoot:join(root,'workspaces')});
  t.after(()=>{engine.close();rmSync(root,{recursive:true,force:true});});
  return {store,authority,registry,engine};
}

function putMission(store,{missionId,intent='Deliver the exact accepted text.',status='COMPLETED',finalArtifactId=null}={}){
  store.put('mission',missionId,{id:missionId,intent,intentHash:sha256(intent),status,pending:[],history:[],finalArtifactId},
    {expectedVersion:0});
}

// Deliberately minimal accepted legacy lineage. It exercises the public
// delivery boundary rather than a particular planner/entry route, while still
// satisfying ArtifactRegistry's independent producer/reviewer assertion.
function putAcceptedLegacyDelivery(store,{missionId,artifactId,body,purpose='delivery',privateSentinel=''}={}){
  const producerId=`run:producer:${missionId}`,reviewerId=`run:reviewer:${missionId}`,reviewId=`review:${missionId}`,
    payload={missionId,nodeId:'delivery',producerRunId:producerId,kind:'delivery',purpose,body,
      claims:[],inputRefs:[],toolReceipts:[{opaque:privateSentinel}],requiredEffects:[],criteria:[],provisional:false},
    payloadHash=sha256(payload);
  store.put('run',producerId,{id:producerId,missionId,mode:'producer',nodeId:'delivery',
    context:{purpose,artifactIds:[],sourceIds:[],producerConversationIncluded:false},toolObservations:[],inferenceReceipts:[],
    privateProviderTranscript:privateSentinel},{expectedVersion:0});
  store.put('artifact',artifactId,{id:artifactId,missionId,payload,payloadHash,status:'ACCEPTED',reviews:[reviewId],reviewDependencies:[],
    privateArtifactExtension:privateSentinel},{expectedVersion:0});
  store.put('run',reviewerId,{id:reviewerId,missionId,mode:'reviewer',nodeId:'review:delivery',
    context:{purpose,artifactIds:[artifactId],sourceIds:[],producerConversationIncluded:false},toolObservations:[],inferenceReceipts:[],
    privateReviewerTranscript:privateSentinel},{expectedVersion:0});
  store.put('review',reviewId,{id:reviewId,artifactId,reviewerRunId:reviewerId,
    result:{decision:'ACCEPT',artifactHash:payloadHash,purpose,checks:[],findings:[]},privateReviewNotes:privateSentinel},{expectedVersion:0});
  return {artifactId,payloadHash,producerId,reviewerId,reviewId};
}

function diskSnapshot(state){
  const path=join(state,'state.sqlite'),db=new DatabaseSync(path,{readOnly:true,defensive:true,allowExtension:false});let contents;
  try{
    db.exec('PRAGMA query_only=ON; PRAGMA trusted_schema=OFF; BEGIN');
    contents={protocol:db.prepare('PRAGMA user_version').get().user_version,
      records:db.prepare('SELECT * FROM records ORDER BY type,id,version').all(),
      heads:db.prepare('SELECT * FROM heads ORDER BY type,id').all(),
      events:db.prepare('SELECT * FROM events ORDER BY seq').all()};
  }finally{if(db.isTransaction)db.exec('ROLLBACK');db.close();}
  const stat=fs.lstatSync(path,{bigint:true});
  return {...contents,bytes:fs.readFileSync(path),metadata:{mode:stat.mode.toString(),mtimeNs:stat.mtimeNs.toString(),ctimeNs:stat.ctimeNs.toString()},
    wal:fs.existsSync(path+'-wal'),shm:fs.existsSync(path+'-shm')};
}

function invoke(state,args){
  return spawnSync(process.execPath,[cli,...args,'--state-dir',state],{encoding:'utf8',timeout:20000,maxBuffer:2*1024*1024});
}

test('accepted textual delivery has a fixed minimal contract and no internal artifact or actor fields',t=>{
  const f=memoryFixture(t),missionId='mission:public-text-delivery',artifactId='artifact:public-text-delivery',
    body='Resultado revisado: texto UTF-8 exacto.',secret='PRIVATE_DELIVERY_INTERNAL_EVIDENCE_SENTINEL';
  putMission(f.store,{missionId,finalArtifactId:artifactId});
  const accepted=putAcceptedLegacyDelivery(f.store,{missionId,artifactId,body,privateSentinel:secret}),before=f.store.verifyJournal();
  const delivery=f.engine.delivery(missionId);
  assert.deepEqual(f.store.verifyJournal(),before,'Engine delivery is read-only');
  assert.deepEqual(delivery,{schema:PUBLIC_TEXT_DELIVERY_SCHEMA,missionId,status:'ACCEPTED',
    artifact:{id:artifactId,payloadHash:accepted.payloadHash},
    content:{mediaType:PUBLIC_TEXT_DELIVERY_MEDIA_TYPE,sha256:sha256(body),bytes:Buffer.byteLength(body),body}});
  assert.deepEqual(Object.keys(delivery).sort(),['artifact','content','missionId','schema','status']);
  assert.deepEqual(Object.keys(delivery.artifact).sort(),['id','payloadHash']);
  assert.deepEqual(Object.keys(delivery.content).sort(),['body','bytes','mediaType','sha256']);
  const serialized=JSON.stringify(delivery);
  for(const privateValue of [secret,accepted.producerId,accepted.reviewerId,accepted.reviewId])
    assert.equal(serialized.includes(privateValue),false,`delivery leaked ${privateValue}`);
  assert.ok(Object.isFrozen(delivery));assert.ok(Object.isFrozen(delivery.artifact));assert.ok(Object.isFrozen(delivery.content));
  assert.deepEqual(readPublicTextDelivery({registry:f.registry,missionId}),delivery,'Engine facade adds no data');
});

test('only a completed accepted final can cross the textual delivery boundary',t=>{
  const waiting=memoryFixture(t),waitingId='mission:delivery-not-completed',waitingSecret='PRIVATE_WAITING_BODY_SENTINEL';
  putMission(waiting.store,{missionId:waitingId,status:'RUNNING',finalArtifactId:'artifact:waiting'});
  putAcceptedLegacyDelivery(waiting.store,{missionId:waitingId,artifactId:'artifact:waiting',body:waitingSecret});
  const waitingBefore=waiting.store.verifyJournal();
  assert.throws(()=>waiting.engine.delivery(waitingId),code('DELIVERY_UNAVAILABLE'));
  assert.deepEqual(waiting.store.verifyJournal(),waitingBefore);

  const candidate=memoryFixture(t),candidateId='mission:delivery-candidate',candidateArtifact='artifact:delivery-candidate',candidateSecret='PRIVATE_CANDIDATE_BODY_SENTINEL';
  putMission(candidate.store,{missionId:candidateId,finalArtifactId:candidateArtifact});
  putAcceptedLegacyDelivery(candidate.store,{missionId:candidateId,artifactId:candidateArtifact,body:candidateSecret});
  const current=candidate.store.get('artifact',candidateArtifact);
  candidate.store.put('artifact',candidateArtifact,{...current.data,status:'CANDIDATE'},{expectedVersion:current.version});
  const candidateBefore=candidate.store.verifyJournal();
  let error;try{candidate.engine.delivery(candidateId);}catch(value){error=value;}
  assert.equal(error?.code,'DELIVERY_UNAVAILABLE');assert.equal(error?.message.includes(candidateSecret),false);
  assert.deepEqual(candidate.store.verifyJournal(),candidateBefore);
});

test('delivery explicitly rejects non-text, lossy UTF-8 and text beyond its byte ceiling',t=>{
  const cases=[
    {name:'non-text',body:{mediaType:'application/octet-stream',bytes:'PRIVATE_BINARY_BODY_SENTINEL'},expected:'DELIVERY_TEXT_UNSUPPORTED'},
    {name:'lone-surrogate',body:'lossy \ud800 UTF-16 surrogate',expected:'DELIVERY_TEXT_ENCODING'},
    {name:'oversized',body:'€'.repeat(Math.floor(MAX_PUBLIC_TEXT_DELIVERY_BYTES/2)),expected:'DELIVERY_TEXT_SIZE'}
  ];
  for(const [index,variant] of cases.entries()){
    const f=memoryFixture(t),missionId=`mission:delivery-format-${index}`,artifactId=`artifact:delivery-format-${index}`;
    putMission(f.store,{missionId,finalArtifactId:artifactId});
    putAcceptedLegacyDelivery(f.store,{missionId,artifactId,body:variant.body});
    const before=f.store.verifyJournal();
    assert.throws(()=>f.engine.delivery(missionId),code(variant.expected),variant.name);
    assert.deepEqual(f.store.verifyJournal(),before,variant.name+' leaves state untouched');
  }
});

test('CLI delivery is JSON-only, opens no workspace and leaves the durable state byte-for-byte unchanged',t=>{
  const root=mkdtempSync(join(tmpdir(),'sovereign-delivery-cli-')),state=join(root,'state'),missionId='mission:delivery-cli',artifactId='artifact:delivery-cli',
    body='CLI delivery body — UTF-8.',secret='PRIVATE_CLI_DELIVERY_EVIDENCE_SENTINEL';
  t.after(()=>rmSync(root,{recursive:true,force:true}));
  const store=new Store(join(state,'state.sqlite')),authority=new Authority(store),registry=new ArtifactRegistry(store,authority);
  putMission(store,{missionId,finalArtifactId:artifactId});
  const accepted=putAcceptedLegacyDelivery(store,{missionId,artifactId,body,privateSentinel:secret});
  assert.equal(readPublicTextDelivery({registry,missionId}).content.body,body);
  store.close();
  const before=diskSnapshot(state),workspaceRoot=join(state,'workspaces');
  assert.equal(fs.existsSync(workspaceRoot),false,'fixture starts with no workspace directory');
  const result=invoke(state,['delivery',missionId,'--json']);
  assert.equal(result.error,undefined);assert.equal(result.status,0,result.stderr);assert.equal(result.stderr,'');
  const delivery=JSON.parse(result.stdout);
  assert.deepEqual(delivery,{schema:PUBLIC_TEXT_DELIVERY_SCHEMA,missionId,status:'ACCEPTED',
    artifact:{id:artifactId,payloadHash:accepted.payloadHash},
    content:{mediaType:PUBLIC_TEXT_DELIVERY_MEDIA_TYPE,sha256:sha256(body),bytes:Buffer.byteLength(body),body}});
  for(const privateValue of [secret,accepted.producerId,accepted.reviewerId,accepted.reviewId])
    assert.equal(result.stdout.includes(privateValue),false,`CLI delivery leaked ${privateValue}`);
  assert.equal(fs.existsSync(workspaceRoot),false,'delivery never constructs a workspace broker');
  assert.deepEqual(diskSnapshot(state),before,'delivery does not mutate durable state or SQLite sidecars');

  for(const args of [
    ['delivery',missionId],
    ['delivery',missionId,'--json','--text','irrelevant'],
    ['delivery',missionId,'extra','--json']
  ]){
    const rejected=invoke(state,args);
    assert.notEqual(rejected.status,0,JSON.stringify(args));assert.equal(rejected.stdout,'');
    assert.equal(rejected.stderr.includes(body),false);assert.equal(rejected.stderr.includes(secret),false);
    assert.deepEqual(diskSnapshot(state),before,JSON.stringify(args)+' stays read-only');
  }
});
