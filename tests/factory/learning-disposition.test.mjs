import test from 'node:test';
import assert from 'node:assert/strict';
import {learningOverlayExclusions,learningStateReport} from '../../factory/lib/learning-disposition.mjs';
import {Store} from '../../factory/lib/store.mjs';
import {FactoryEngine} from '../../factory/lib/engine.mjs';
import {missionReport,formatMissionReport} from '../../factory/lib/report.mjs';
import {sha256,canonical} from '../../factory/lib/contracts.mjs';
import {mkdtempSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';

test('learning exclusion explanation matches the entire previous admission predicate',()=>{
  const names=['inputBoundReview','closedReview','comparisonReview','closedResponse','controllerReview',
    'boundedRead','boundedReview','documentContext','contractInspection','producerBatch','inferenceBudget'];
  for(let mask=0;mask<(1<<names.length);mask++)for(const resolverPresent of [false,true]){
    const o={resolverPresent};names.forEach((k,i)=>{o[k]=mask&(1<<i)?true:undefined;});
    const previous=resolverPresent&&!o.inputBoundReview&&!o.closedReview&&!o.comparisonReview&&!o.closedResponse
      &&!o.controllerReview&&!o.boundedRead&&!o.boundedReview&&!o.documentContext&&!o.contractInspection
      &&o.producerBatch===undefined&&o.inferenceBudget===undefined;
    assert.equal(learningOverlayExclusions(o).length===0,previous,'mask '+mask+' resolver '+resolverPresent);
  }
});
test('declared false/null batch or budget remains excluded rather than becoming truthy-only',()=>{
  for(const key of ['producerBatch','inferenceBudget'])for(const value of [false,null,0,'']){
    const reasons=learningOverlayExclusions({resolverPresent:true,[key]:value});assert.equal(reasons.length,1);
  }
});

function fixture(t){
  const directory=mkdtempSync(join(tmpdir(),'learning-disposition-')),
    engine=new FactoryEngine({databasePath:':memory:',workspaceRoot:directory});
  engine.workers.providerFactory=()=>assert.fail('No inference permitted by disposition tests');
  t.after(()=>{engine.close();rmSync(directory,{recursive:true,force:true});});return engine;
}
test('plain worker records the actual resolver lookup without claiming an overlay',t=>{
  const engine=fixture(t),m=engine.create('No execution: constructor classification only.',{allowedTools:[]});let calls=0;
  engine.workers.learningInstructionsResolver=()=>{calls++;return null;};
  const run=engine.workers.createRun({missionId:m.id,nodeId:'product',mode:'producer',purpose:'constructor-only',roleIds:['sigma_01']});
  assert.equal(calls,1);const config=engine.store.get('worker-config',run.id).data;
  assert.deepEqual(config.learningDisposition,{schema:'sovereign.learning-selection.v1',status:'NO_MATCHING_OVERLAY',exclusions:[],resolverCalls:1});
  assert.deepEqual(config.learnedInstructionVersions,[]);assert.equal(engine.store.list('inference-request').length,0);
});
test('adaptive-v2 constructor records exclusion and never invokes an old resolver',t=>{
  const engine=fixture(t),m=engine.create('No execution: adaptive constructor classification.',{preset:'adaptive-v2',allowedTools:[]});
  engine.workers.learningInstructionsResolver=()=>assert.fail('Excluded resolver must not be called');
  const run=engine.workers.createRun({missionId:m.id,nodeId:'planning',mode:'producer',purpose:'plan',roleIds:['sigma_01']}),
    config=engine.store.get('worker-config',run.id).data;
  assert.equal(config.learningDisposition.status,'EXCLUDED');assert.equal(config.learningDisposition.resolverCalls,0);
  assert(config.learningDisposition.exclusions.includes('PRODUCER_BATCH_UNQUALIFIED'));
  assert(config.learningDisposition.exclusions.includes('PLANNING_INSPECTION_UNQUALIFIED'));
  assert.deepEqual(config.learnedInstructionVersions,[]);
});
test('no resolver has its own recorded reason, not a fabricated attempted lookup',t=>{
  const engine=fixture(t),m=engine.create('Constructor only.',{allowedTools:[]});engine.workers.learningInstructionsResolver=null;
  const run=engine.workers.createRun({missionId:m.id,nodeId:'product',mode:'producer',purpose:'constructor-only',roleIds:['sigma_01']});
  assert.deepEqual(engine.store.get('worker-config',run.id).data.learningDisposition,
    {schema:'sovereign.learning-selection.v1',status:'EXCLUDED',exclusions:['NO_RESOLVER'],resolverCalls:0});
});
test('nonterminal installed-style historical data reports unconfigured and unknown; inspection writes nothing',()=>{
  const store=new Store(':memory:');try{
    const missionId='m',intent='Retain historical uncertainty';store.put('mission',missionId,{id:missionId,intent,intentHash:sha256(intent),status:'RUNNING',pending:[],finalArtifactId:null},{expectedVersion:0});
    store.put('run','old',{missionId,inferenceReceipts:[]},{expectedVersion:0});
    store.put('worker-config','old',{instructions:'PRIVATE_INSTRUCTION_SENTINEL',learnedInstructionVersions:[],compilationScope:{producerBatch:'read-test-cursor-v1'}},{expectedVersion:0});
    const before=canonical({journal:store.verifyJournal(),rows:store.db.prepare('SELECT type,id,version,hash,json FROM records ORDER BY type,id,version').all().map(r=>({...r}))});
    const publicReport=missionReport(store,missionId),r=learningStateReport(store,{missionId,runs:[{id:'old'}]}),
      after=canonical({journal:store.verifyJournal(),rows:store.db.prepare('SELECT type,id,version,hash,json FROM records ORDER BY type,id,version').all().map(r=>({...r}))});
    assert.equal(before,after);assert.equal(publicReport.learning,null,'A malformed historical mission must not project private learning custody publicly');
    assert.equal(publicReport.metrics.integrity,'NOT_ATTESTED');assert(!formatMissionReport(publicReport).includes('PRIVATE_INSTRUCTION_SENTINEL'));
    assert.equal(r.registration,'NO_SCOPES_REGISTERED');assert.equal(r.unrecordedSelectionCount,1);
    assert.deepEqual(r.workers[0].selection,{schema:'sovereign.learning-selection.v1',status:'NOT_RECORDED',exclusions:null,resolverCalls:null});
    assert.equal(r.frozenOverlayCount,0);assert.equal(r.unknownOverlayConfigurationCount,0);
    assert(!JSON.stringify(r).includes('PRIVATE_INSTRUCTION_SENTINEL'));
  }finally{store.close();}
});
test('missing worker config is unknown rather than an explicit zero-overlay decision',()=>{
  const store=new Store(':memory:');try{
    const r=learningStateReport(store,{missionId:'m',runs:[{id:'missing'}]});
    assert.equal(r.unknownOverlayConfigurationCount,1);assert.equal(r.workers[0].frozenInstructionVersions,null);
  }finally{store.close();}
});
test('registration and promotion history cannot replace the original frozen worker selection',()=>{
  const store=new Store(':memory:');try{
    store.put('learning-compilation','role',{scope:{},datasetHash:'dataset-secret'},{expectedVersion:0});
    store.put('learning-role','role',{activeHash:'new-version',baselineHash:'baseline'},{expectedVersion:0});
    store.put('learning-cycle','local',{missionId:'m',runId:'worker',roleId:'role',status:'READY_FOR_PROMOTION',candidateId:'pending'},{expectedVersion:0});
    store.put('learning-cycle','foreign',{missionId:'other',runId:'foreign',roleId:'role',status:'PROMOTED',candidateId:'other-secret'},{expectedVersion:0});
    const frozen={schema:'sovereign.learning-selection.v1',status:'OVERLAY_FROZEN',exclusions:[],resolverCalls:1};
    store.put('worker-config','worker',{learningDisposition:frozen,learnedInstructionVersions:[{roleId:'role',hash:'old-version',version:1}]},{expectedVersion:0});
    const r=learningStateReport(store,{missionId:'m',runs:[{id:'worker'}]});
    assert.equal(r.registration,'SCOPES_REGISTERED');assert.equal(r.cycles.length,1);assert.equal(r.cycles[0].status,'READY_FOR_PROMOTION');
    assert.equal(r.frozenOverlayCount,1);assert.equal(r.workers[0].frozenInstructionVersions[0].hash,'old-version');
    assert(!JSON.stringify(r).includes('other-secret'));assert(!JSON.stringify(r).includes('dataset-secret'));
    r.workers[0].selection.status='mutated';assert.equal(store.get('worker-config','worker').data.learningDisposition.status,'OVERLAY_FROZEN');
  }finally{store.close();}
});
