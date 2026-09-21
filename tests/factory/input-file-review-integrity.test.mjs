// Native deterministic fixture products, actual broker files, explicit SIM judgments.
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {join} from 'node:path';import {tmpdir} from 'node:os';
import {FactoryEngine} from '../../factory/lib/engine.mjs';import {sha256} from '../../factory/lib/contracts.mjs';
import {candidateInputFiles,inputFileReviewContract,INPUT_FILE_REVIEW} from '../../factory/lib/input-file-review.mjs';
function setup(t){
  const directory=fs.mkdtempSync(join(tmpdir(),'sovereign-input-integrity-'));
  const engine=new FactoryEngine({databasePath:join(directory,'state.sqlite'),workspaceRoot:join(directory,'workspaces')});
  const mission=engine.create('Inspect exact fixture bytes.',{entryMode:'planned',allowedTools:['workspace.read','workspace.write']});
  const workspace=engine.broker.registerWorkspace(mission.id).path;fs.writeFileSync(join(workspace,'input.txt'),'13\n');
  const producer=engine.workers.createRun({missionId:mission.id,nodeId:'audit',mode:'producer',purpose:'audit',roleIds:['omega_02']});
  const read=run=>engine.workers.tool(run.id,'workspace.read',{path:'input.txt'},run.id+':read:'+engine.store.list('effect').length);
  const candidate=()=>engine.registry.create({missionId:mission.id,nodeId:'audit',producerRunId:producer.id,kind:'deterministic-result',purpose:'audit',
    body:'Native control fixture, not model quality.',criteria:[{id:'input',text:'Own post-candidate input read.'}],
    toolReceipts:(engine.store.get('run',producer.id).data.toolObservations??[]).filter(o=>o.principalId===producer.id&&o.signedReceipt.data.status==='SUCCEEDED').map(o=>o.signedReceipt)});
  const reviewer=artifact=>engine.workers.createRun({missionId:mission.id,nodeId:'review:audit',mode:'reviewer',purpose:'audit',roleIds:['omega_22'],artifactIds:artifact?[artifact.id]:[]});
  const commit=(a,r,observations)=>{
    engine.registry.attachInference(r.id,{kind:'inference',status:'completed',simulation:true,threadId:'sim:'+r.id,turnId:'sim'});
    return engine.registry.review({artifactId:a.id,reviewerRunId:r.id,result:{artifactHash:a.payloadHash,purpose:'audit',decision:'ACCEPT',
      checks:[{criterionId:'input',verdict:'PASS',reason:'SIM adversarial control response.',evidence:[{kind:'artifact',id:a.id,hash:a.payloadHash,quote:a.payload.body},
        ...observations.map(o=>({kind:'tool',id:o.id,hash:o.hash,quote:o.quoteText}))]}],findings:[],uncertainty:'Fixture only'}});
  };
  t.after(()=>{engine.close();fs.rmSync(directory,{recursive:true,force:true});});
  return {engine,mission,workspace,producer,read,candidate,reviewer,commit};
}
test('Low-level registry cannot bypass required input proof with a permissive result',async t=>{
  const s=setup(t);await s.read(s.producer);const a=s.candidate(),r=s.reviewer(a);
  assert.throws(()=>s.commit(a,r,[]),{code:'MISSING_INPUT_PROOF'});assert.equal(s.engine.store.list('review').length,0);
});
test('A foreign reviewer read cannot masquerade as the actual reviewer own read',async t=>{
  const s=setup(t);await s.read(s.producer);const a=s.candidate(),other=s.reviewer(a),r=s.reviewer(a);
  await s.read(other);const observation=s.engine.registry.getToolObservations(other.id)[0];
  s.engine.registry.recordToolObservation(r.id,s.engine.store.get('effect',observation.id).data.receipt);
  assert.throws(()=>s.commit(a,r,[observation]),{code:'TOOL_ACTOR'});
});
test('A same-actor read before candidate creation is not independent post-candidate evidence',async t=>{
  const s=setup(t);await s.read(s.producer);const r=s.reviewer();await s.read(r);const a=s.candidate();
  const current=s.engine.store.get('run',r.id).data;
  s.engine.registry.updateContext(r.id,{...current.context,artifactIds:[a.id]});
  assert.throws(()=>s.commit(a,r,s.engine.registry.getToolObservations(r.id)),{code:'STALE_TOOL'});
});
test('Registry rejects a post-candidate own read of changed source bytes',async t=>{
  const s=setup(t);await s.read(s.producer);const a=s.candidate(),r=s.reviewer(a);fs.writeFileSync(join(s.workspace,'input.txt'),'changed');
  await s.read(r);assert.throws(()=>s.commit(a,r,s.engine.registry.getToolObservations(r.id)),{code:'WORKSPACE_CHANGED'});
});
test('A failed historical input attempt is not a successful original file version',async t=>{
  const s=setup(t);fs.renameSync(join(s.workspace,'input.txt'),join(s.workspace,'saved.txt'));
  const failed=await s.read(s.producer);assert.equal(failed.status,'FAILED');const a=s.candidate(),r=s.reviewer(a);
  assert.deepEqual(inputFileReviewContract(s.engine.registry,r,a).inputs,[]);
});
test('Reviewer origin commits atomically without lowering the active execution protocol',async t=>{
  const s=setup(t);await s.read(s.producer);const a=s.candidate(),before=s.engine.store.verifyJournal();
  const prior=s.engine.store.db.prepare('PRAGMA user_version').get().user_version;
  assert.throws(()=>s.engine.store.transact(()=>{s.reviewer(a);assert.equal(s.engine.store.db.prepare('PRAGMA user_version').get().user_version,15);throw Error('cut');}),/cut/);
  assert.equal(s.engine.store.db.prepare('PRAGMA user_version').get().user_version,prior);assert.deepEqual(s.engine.store.verifyJournal(),before);
  assert.equal(s.engine.store.list('run').filter(r=>r.data.mode==='reviewer').length,0);
  const r=s.reviewer(a);assert.equal(s.engine.store.get('run',r.id,1).data.inputReviewProtocol,INPUT_FILE_REVIEW);
  assert.equal(s.engine.store.db.prepare('PRAGMA user_version').get().user_version,15);
});
test('A downgraded header cannot make a new input-review identity behave like a legacy judge',async t=>{
  const s=setup(t);await s.read(s.producer);const a=s.candidate(),r=s.reviewer(a);
  s.engine.store.db.exec('PRAGMA user_version=4');
  assert.throws(()=>inputFileReviewContract(s.engine.registry,r,a),{code:'INPUT_REVIEW_INTEGRITY'});
});
test('Explicit new own read supersedes older external recovery hints without erasing history',async t=>{
  const s=setup(t);await s.read(s.producer);const replacement=s.engine.workers.createRun({missionId:s.mission.id,nodeId:'audit',mode:'producer',purpose:'audit',roleIds:['omega_02']});
  s.engine.workers.inheritProductionObservations(s.producer.id,replacement.id);fs.writeFileSync(join(s.workspace,'input.txt'),'17\n');await s.read(replacement);
  const a=s.engine.registry.create({missionId:s.mission.id,nodeId:'audit',producerRunId:replacement.id,kind:'deterministic-result',purpose:'audit',body:'New observed version.',criteria:[{id:'input',text:'Own current input.'}]});
  const c=candidateInputFiles(s.engine.registry,a);assert.equal(c.inputs.length,1);assert.equal(c.inputs[0].sha256,sha256('17\n'));
  assert.equal(c.inputs[0].observations[0].principalId,replacement.id);
  assert.equal(s.engine.registry.getToolObservations(replacement.id).length,2,'The older external history remains intact');
});
test('No unqualified learned prefix is imported into a new file-input review',async t=>{
  const s=setup(t);await s.read(s.producer);const a=s.candidate();let lookups=0;
  s.engine.workers.learningInstructionsResolver=()=>{lookups++;throw Error('Unqualified scope');};
  const r=s.reviewer(a);assert.equal(lookups,0);assert.deepEqual(s.engine.store.get('worker-config',r.id).data.learnedInstructionVersions,[]);
});
test('Accepted ancestor input does not manufacture a new producer observation in a child',async t=>{
  const s=setup(t);await s.read(s.producer);const a=s.candidate(),r=s.reviewer(a);await s.read(r);s.commit(a,r,s.engine.registry.getToolObservations(r.id));
  const p=s.engine.workers.createRun({missionId:s.mission.id,nodeId:'child',mode:'producer',purpose:'child',roleIds:['omega_02'],artifactIds:[a.id]});
  const child=s.engine.registry.create({missionId:s.mission.id,nodeId:'child',producerRunId:p.id,kind:'deterministic-result',purpose:'child',body:'Use an accepted versioned parent.',
    inputRefs:[{artifactId:a.id,hash:a.payloadHash,purpose:'audit'}],criteria:[{id:'child',text:'Preserve the parent version and scope.'}]});
  assert.deepEqual(candidateInputFiles(s.engine.registry,child).inputs,[]);
  assert.equal(child.payload.inputRefs[0].hash,a.payloadHash);
});
