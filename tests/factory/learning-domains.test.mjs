import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,readFileSync,writeFileSync,mkdirSync,readdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {Store} from '../../factory/lib/store.mjs';
import {Authority} from '../../factory/lib/authority.mjs';
import {LearningService,composeLearningRequest} from '../../factory/lib/learning-service.mjs';
import {LearningConductor} from '../../factory/lib/learning-conductor.mjs';
import {FactoryEngine} from '../../factory/lib/engine.mjs';
import {sha256,id,canonical} from '../../factory/lib/contracts.mjs';
import {admitLearningProvenanceFixtureSource,learningProvenanceFixturePolicy,signedLearningProvenanceFixture} from './fixtures/learning-provenance.mjs';

const target={model:'gpt-6-astra',reasoningEffort:'ultra'};
const scope=purpose=>({roleIds:['sigma_01'],purpose,mode:'producer'});
const dataset=(name,{effort='ultra',evaluationOnly=false}={})=>({missionId:'diagnostic:'+name,evaluatorId:'trusted-local-fixture',
  cases:[false,true].map(holdout=>({id:holdout?'fixture-holdout':'fixture-training',
    input:{taskInstructions:'Fixture, no real model.',input:'{}',schema:{type:'object'},model:target.model,reasoningEffort:effort},
    expected:null,required:true,holdout,criteria:[{metric:'accuracy',direction:'higher',threshold:1}]})),
  policy:{requireImprovement:true,...(evaluationOnly?{activation:'evaluation-only'}:{})}});
function setup(t){const store=new Store(':memory:'),authority=new Authority(store),service=new LearningService({store,authority,provenancePolicy:learningProvenanceFixturePolicy});
  t.after(()=>store.close());return {store,authority,service};}
const register=(f,name,options={})=>{
  const request={domainId:name,roleId:'sigma_01',scope:scope(options.purpose??name),datasetSpec:dataset(name,options)};
  if(!options.evaluationOnly){
    const prepared=f.service.prepareDomain(request);
    // Sources are admitted before a real registration command. Keep that
    // fixture fact out of negative registration assertions: detect a known
    // overlap without adding a new source record first.
    f.service.assertNoDomainOverlap(prepared.roleId,prepared.scope,prepared.targets,{domainRegistration:true});
    const sourceId=`source:learning-provenance-fixture:${name}`,source=f.store.get('source',sourceId)?.data
      ??admitLearningProvenanceFixtureSource(f.store,{sourceId,missionId:request.datasetSpec.missionId});
    request.provenance=signedLearningProvenanceFixture({...request,service:f.service,source});
  }
  return f.service.registerDomain(request);
};
const state=s=>({version:s.db.prepare('PRAGMA user_version').get().user_version,journal:s.verifyJournal(),
  records:s.db.prepare('SELECT type,id,version,hash FROM records ORDER BY type,id,version').all()});
async function evaluated(f,domain,text){
  const candidate=f.service.propose({roleId:domain.policyId,parentHash:domain.baseline.hash,instructions:text,rationale:'Explicit synthetic improvement fixture only.',authorRunId:'fixture-author'}),requests=[];
  const result=await f.service.evaluate(candidate.candidateId,{runCase:async r=>{
    requests.push(r);const pass=r.variant==='candidate',observations={outcome:pass?'pass':'fail',metrics:{accuracy:pass?1:0},actual:{executionContext:r.executionContext,fixture:true}};
    const {evaluationId,datasetHash,caseId,caseHash,roleId,instructionHash,variant,evaluatorId}=r;
    return {observations,receipt:f.authority.seal('evaluation.case',{evaluationId,datasetHash,caseId,caseHash,roleId,instructionHash,variant,evaluatorId,
      evaluatorRunId:'local-fixture',executionId:id('fixture-execution'),observationsHash:sha256(observations)})};
  }});
  assert.equal(result.passed,true);return {candidate,requests};
}
function grant(f,d,resource='role:'+d.policyId){
  return f.authority.issue({missionId:dataset(d.domainId).missionId,principalId:'fixture-owner',actions:['instructions.promote','instructions.rollback','instructions.export'],
    resources:[resource],expiresAt:new Date(Date.now()+3600000).toISOString()});
}
test('one real catalog role has two independent immutable domain policies without a duplicate agent',t=>{
  const f=setup(t),a=register(f,'a'),b=register(f,'b');assert.notEqual(a.policyId,b.policyId);
  assert.equal(a.roleId,'sigma_01');assert.equal(f.store.list('learning-compilation').length,2);
  assert.equal(state(f.store).version,12);assert.equal(f.store.get('learning-role','sigma_01'),null);
  assert.equal(f.service.compilation(a.policyId).domain.domainId,'a');assert.equal(f.service.compilation(b.policyId).domain.domainId,'b');
  assert.equal(f.service.resolver()('sigma_01',scope('a'),target),null);
});
test('same exact scope may use disjoint targets, never overlapping coverage or reused domain identity',t=>{
  const f=setup(t);register(f,'a',{purpose:'same'});register(f,'b',{purpose:'same',effort:'high'});const before=state(f.store);
  assert.throws(()=>register(f,'c',{purpose:'same'}),{code:'LEARNING_DOMAIN_OVERLAP'});
  assert.throws(()=>register(f,'a',{purpose:'another'}),{code:'LEARNING_EXISTS'});assert.deepEqual(state(f.store),before);
});
test('legacy/domain overlap is rejected in both directions, before any protocol or record change',t=>{
  const f=setup(t);f.service.registerBaseline({roleId:'sigma_01',scope:scope('same'),datasetSpec:dataset('legacy',{evaluationOnly:true})});
  const old=state(f.store);assert.equal(old.version,2);
  assert.throws(()=>register(f,'a',{purpose:'same'}),{code:'LEARNING_DOMAIN_OVERLAP'});assert.deepEqual(state(f.store),old);
  register(f,'b',{purpose:'other'});const before=state(f.store);
  assert.throws(()=>f.service.registerBaseline({roleId:'sigma_01',scope:scope('other'),datasetSpec:dataset('new-legacy',{evaluationOnly:true})}),{code:'LEARNING_DOMAIN_OVERLAP'});
  assert.deepEqual(state(f.store),before);
});
test('failed domain registration rolls back the floor and every newly created record',t=>{
  const f=setup(t),before=state(f.store),bad=dataset('bad');bad.policy.activation='unsupported';
  assert.throws(()=>f.service.registerDomain({domainId:'bad',roleId:'sigma_01',scope:scope('bad'),datasetSpec:bad}),{code:'SCHEMA'});
  assert.deepEqual(state(f.store),before);
});
test('SDK registration cannot bypass the activatable split and improvement gate',t=>{
  const f=setup(t),before=state(f.store);
  for(const [name,change] of [
    ['no-improvement',spec=>spec.policy.requireImprovement=false],
    ['no-training',spec=>spec.cases.forEach(c=>c.holdout=true)],
    ['no-holdout',spec=>spec.cases.forEach(c=>c.holdout=false)],
  ]){
    const unsafe=dataset(name);change(unsafe);
    assert.throws(()=>f.service.registerDomain({domainId:name,roleId:'sigma_01',scope:scope(name),datasetSpec:unsafe}),
      {code:'LEARNING_ACTIVATION_POLICY'});
    assert.deepEqual(state(f.store),before);
  }
});
test('domain promotion uses actual role instructions, exact policy authority and separate rollback',async t=>{
  const f=setup(t),a=register(f,'a'),b=register(f,'b'),ea=await evaluated(f,a,'DOMAIN_A_ONLY'),eb=await evaluated(f,b,'DOMAIN_B_ONLY');
  const opts={principalId:'fixture-owner'};
  assert.throws(()=>f.service.promote(ea.candidate.candidateId,{...opts,lease:grant(f,a,'role:sigma_01')}),/./);
  assert.throws(()=>f.service.promote(ea.candidate.candidateId,{...opts,lease:grant(f,a,'role:'+b.policyId)}),/./);
  f.service.promote(ea.candidate.candidateId,{...opts,lease:grant(f,a)});
  f.service.promote(eb.candidate.candidateId,{...opts,lease:grant(f,b)});
  const active=f.service.resolver()('sigma_01',scope('a'),target);
  assert.equal(active.roleId,'sigma_01');assert.equal(active.policyId,a.policyId);assert.equal(active.domainId,'a');
  assert.equal(active.prefix,ea.requests[1].effectivePrefix);assert.ok(active.prefix.includes('DOMAIN_A_ONLY'));assert.ok(!active.prefix.includes('DOMAIN_B_ONLY'));
  assert.ok(!active.prefix.includes(a.policyId),'An opaque policy key is not substituted for the real catalog role in model instructions');
  assert.equal(f.service.resolver()('sigma_01',scope('a'),{...target,reasoningEffort:'high'}),null);
  assert.equal(f.service.resolver()('sigma_01',scope('unknown'),target),null);
  f.service.rollback({roleId:a.policyId,targetHash:a.baseline.hash,...opts,lease:grant(f,a),reason:'Fixture rollback'});
  assert.equal(f.service.resolver()('sigma_01',scope('a'),target),null);
  assert.equal(f.service.resolver()('sigma_01',scope('b'),target).policyId,b.policyId);
});
test('domain evaluation-only can measure a SIM improvement but cannot select or promote it',async t=>{
  const f=setup(t),d=register(f,'experimental',{evaluationOnly:true}),e=await evaluated(f,d,'INACTIVE_FIXTURE');
  assert.throws(()=>f.service.promote(e.candidate.candidateId,{lease:grant(f,d),principalId:'fixture-owner'}),{code:'LEARNING_EVALUATION_ONLY'});
  assert.throws(()=>f.service.registry.promote(e.candidate.candidateId,{lease:grant(f,d),principalId:'fixture-owner'}),{code:'LEARNING_EVALUATION_ONLY'});
  assert.equal(f.service.resolver()('sigma_01',scope('experimental'),target),null);
});
test('disjoint effort domains resolve only their own evaluated policy',async t=>{
  const f=setup(t),a=register(f,'ultra-policy',{purpose:'shared'}),b=register(f,'high-policy',{purpose:'shared',effort:'high'});
  for(const [d,marker]of [[a,'ULTRA_ONLY'],[b,'HIGH_ONLY']]){
    const e=await evaluated(f,d,marker);f.service.promote(e.candidate.candidateId,{lease:grant(f,d),principalId:'fixture-owner'});
  }
  assert.equal(f.service.resolver()('sigma_01',scope('shared'),target).policyId,a.policyId);
  assert.equal(f.service.resolver()('sigma_01',scope('shared'),{...target,reasoningEffort:'high'}).policyId,b.policyId);
  assert.equal(f.service.resolver()('sigma_01',scope('shared'),{...target,reasoningEffort:'low'}),null);
});
test('a later domain candidate compares the exact promoted parent under the real role identity',async t=>{
  const f=setup(t),d=register(f,'chain'),first=await evaluated(f,d,'FIRST_OVERLAY');
  f.service.promote(first.candidate.candidateId,{lease:grant(f,d),principalId:'fixture-owner'});
  const parent=f.service.resolver()('sigma_01',scope('chain'),target);
  const next=await evaluated(f,{...d,baseline:{hash:parent.hash}},'SECOND_OVERLAY');
  assert.equal(next.requests[0].effectivePrefix,parent.prefix);
  assert.ok(next.requests[1].effectivePrefix.includes('SECOND_OVERLAY'));
  assert.ok(!next.requests[1].effectivePrefix.includes('FIRST_OVERLAY'));
  assert.ok(!next.requests[1].effectivePrefix.includes(d.policyId));
});
test('new worker prefix matches the evaluated domain while old worker instructions remain frozen',async t=>{
  const workspaceRoot=mkdtempSync(join(tmpdir(),'learning-domain-worker-'));t.after(()=>rmSync(workspaceRoot,{recursive:true,force:true}));
  const f=setup(t),d=register(f,'work'),engine=new FactoryEngine({store:f.store,authority:f.authority,learning:f.service,workspaceRoot}),mission=engine.create('Fixture no inference',{model:target.model,reasoningEffort:target.reasoningEffort,allowedTools:[]});
  const create=()=>engine.workers.createRun({missionId:mission.id,nodeId:'node',purpose:'work',mode:'producer',roleIds:['sigma_01']});
  const before=create(),old=f.store.get('worker-config',before.id);const e=await evaluated(f,d,'DOMAIN_WORK_ONLY');
  f.service.promote(e.candidate.candidateId,{lease:grant(f,d),principalId:'fixture-owner'});
  const after=create(),c=f.store.get('worker-config',after.id).data;
  assert.equal(c.instructions,e.requests[1].effectivePrefix);assert.equal(c.learnedInstructionVersions[0].policyId,d.policyId);
  assert.equal(c.learnedInstructionVersions[0].roleId,'sigma_01');assert.equal(c.learnedInstructionVersions[0].domainId,'work');
  assert.deepEqual(f.store.get('worker-config',before.id),old);
  const actual=composeLearningRequest({prefix:c.instructions,...e.requests[1].case.input});
  assert.equal(actual.requestHash,e.requests[1].executionContext.requestHash);
});
test('domain binding corruption cannot be hidden by renaming its role or selecting another scope',t=>{
  const f=setup(t),d=register(f,'a'),r=f.store.get('learning-domain',d.policyId);
  f.store.put('learning-domain',d.policyId,{...r.data,roleId:'omega_22'},{expectedVersion:r.version});
  assert.throws(()=>f.service.resolver()('sigma_01',scope('unrelated'),target),{code:'LEARNING_DOMAIN'});
});
test('downgraded domain floor is rejected on inspection without rewriting history',t=>{
  const f=setup(t),d=register(f,'a');f.store.db.exec('PRAGMA user_version=10');const before=state(f.store);
  assert.throws(()=>f.service.compilation(d.policyId),{code:'LEARNING_DOMAIN'});assert.deepEqual(state(f.store),before);
});
test('a historical evaluation-only v1 domain cannot compile after an attested v2 domain raises the store to protocol 12',t=>{
  const f=setup(t),historical=register(f,'historical-v1',{evaluationOnly:true});
  assert.equal(f.store.db.prepare('PRAGMA user_version').get().user_version,11);
  assert.equal(f.service.compilation(historical.policyId).domain.schema,'sovereign.learning-domain.v1');

  const attested=register(f,'attested-v2');
  assert.equal(f.store.db.prepare('PRAGMA user_version').get().user_version,12);
  assert.equal(f.service.compilation(attested.policyId).domain.schema,'sovereign.learning-domain.v2');

  const before=state(f.store);
  assert.throws(()=>f.service.compilation(historical.policyId),{code:'LEARNING_DOMAIN'});
  assert.deepEqual(state(f.store),before);
});
test('domain observation needs a completed matching target and retains both policy and agent role identities',t=>{
  const f=setup(t),d=register(f,'a'),conductor=new LearningConductor({service:f.service,allowSimulation:true}),s=scope('a');
  for(const [runId,receipts]of [['missing',[]],['wrong',[{status:'completed',...target,reasoningEffort:'high'}]],['matching',[{status:'completed',...target,simulation:true}]]]){
    f.store.put('run',runId,{missionId:'m',mode:'producer',nodeId:'fixture',inferenceReceipts:receipts},{expectedVersion:0});
    f.store.put('worker-config',runId,{compilationScope:s},{expectedVersion:0});
    const r=f.store.put('worker-rejected-output','rejection:'+runId,{runId,accepted:false},{expectedVersion:0});
    const evidenceRefs=[{type:r.type,id:r.id,version:r.version,hash:r.hash}];
    if(runId!=='matching')assert.throws(()=>conductor.open({roleId:d.policyId,runId,evidenceRefs}),{code:'LEARNING_TARGET'});
    else {const c=conductor.open({roleId:d.policyId,runId,evidenceRefs});assert.equal(c.policyId,d.policyId);assert.equal(c.agentRoleId,'sigma_01');assert.equal(c.domainId,'a');}
  }
  const report=conductor.observeMission('m');assert.equal(report.cycles.length,1);assert.equal(report.unconfigured.length,2);
  assert.ok(report.unconfigured.every(x=>x.reason==='NO_COMPLETED_EVALUATED_TARGET'));
  const operational=new LearningConductor({service:f.service});
  assert.equal(operational.observeMission('m').cycles.length,0,'Synthetic observation does not become a real operational learning opportunity');
});
test('identical overlays in separate domains export to separate scoped AGENTS files without overwriting',async t=>{
  const directory=mkdtempSync(join(tmpdir(),'learning-domain-export-'));t.after(()=>rmSync(directory,{recursive:true,force:true}));
  const f=setup(t);f.service.exportRoot=join(directory,'derived-only');const a=register(f,'export-a'),b=register(f,'export-b');
  for(const d of [a,b]){const e=await evaluated(f,d,'SAME_SYNTHETIC_OVERLAY');f.service.promote(e.candidate.candidateId,{lease:grant(f,d),principalId:'fixture-owner'});}
  const exportDomain=(d,expectedVersion=0)=>f.service.exportActive({roleId:d.policyId,expectedVersion,lease:grant(f,d),principalId:'fixture-owner'});
  const first=exportDomain(a),firstBytes=readFileSync(first.data.path),second=exportDomain(b);
  assert.notEqual(first.data.path,second.data.path);assert.deepEqual(readFileSync(first.data.path),firstBytes);
  for(const [d,e]of [[a,first],[b,second]]){
    const text=readFileSync(e.data.path,'utf8');assert.ok(text.includes('Role: sigma_01\n'));assert.ok(text.includes('Domain: '+d.domainId+'\n'));
    assert.ok(text.includes('Policy: '+d.policyId+'\n'));assert.ok(text.includes('Scope hash: '+f.service.compilation(d.policyId).scopeHash+'\n'));
    assert.equal(e.data.policyId,d.policyId);assert.equal(e.data.agentRoleId,'sigma_01');assert.equal(e.data.domainId,d.domainId);
    assert.deepEqual(exportDomain(d,1),e,'Exact idempotent re-export');
  }
  writeFileSync(second.data.path,'User-owned edit retained.');
  assert.throws(()=>exportDomain(b,1),{code:'EXPORT_CHANGED'});assert.equal(readFileSync(second.data.path,'utf8'),'User-owned edit retained.');
  assert.deepEqual(readFileSync(first.data.path),firstBytes);
});
test('an existing pre-metadata domain export retains exact bytes and version on re-read',async t=>{
  const directory=mkdtempSync(join(tmpdir(),'learning-domain-old-export-'));t.after(()=>rmSync(directory,{recursive:true,force:true}));
  const f=setup(t),d=register(f,'old-export'),e=await evaluated(f,d,'OLD_EXPORT_OVERLAY');
  f.service.promote(e.candidate.candidateId,{lease:grant(f,d),principalId:'fixture-owner'});
  const root=join(directory,'derived-only');f.service.exportRoot=root;mkdirSync(root,{mode:0o700});
  const marker=f.authority.seal('learning.export-root',{id:id('export-root'),path:root});
  writeFileSync(join(root,'.sovereign-owner.json'),canonical(marker));f.store.put('learning-export-root',sha256(root),{marker},{expectedVersion:0});
  const active=f.service.resolve(d.policyId,scope('old-export')),folder=join(root,active.hash+'-'+active.version);mkdirSync(folder,{mode:0o700});
  const file=join(folder,'AGENTS.md'),content=`# Derived approved instructions\n\nRole: ${d.policyId}\nVersion: ${active.version}\nInstruction hash: ${active.hash}\nPrefix hash: ${active.prefixHash}\n\n${active.prefix}\n`;
  writeFileSync(file,content);const previous=f.store.put('learning-export',d.policyId,{roleId:d.policyId,root,activeHash:active.hash,activeVersion:active.version,prefixHash:active.prefixHash,path:file,contentHash:sha256(content),scopeHash:active.scopeHash},{expectedVersion:0});
  const lease=grant(f,d),before=state(f.store),entries=readdirSync(root);
  assert.deepEqual(f.service.exportActive({roleId:d.policyId,expectedVersion:1,lease,principalId:'fixture-owner'}),previous);
  assert.equal(readFileSync(file,'utf8'),content);assert.deepEqual(readdirSync(root),entries);
  assert.deepEqual(f.store.get('learning-export',d.policyId),previous);
  assert.equal(f.store.list('learning-export').length,1);assert.deepEqual(state(f.store),before);
});
test('domain export rejects another policy grant before creating any directory',async t=>{
  const directory=mkdtempSync(join(tmpdir(),'learning-domain-export-authority-'));t.after(()=>rmSync(directory,{recursive:true,force:true}));
  const f=setup(t),a=register(f,'authority-a'),b=register(f,'authority-b'),e=await evaluated(f,a,'SYNTHETIC_EXPORT');
  f.service.promote(e.candidate.candidateId,{lease:grant(f,a),principalId:'fixture-owner'});f.service.exportRoot=join(directory,'derived-only');
  const lease=grant(f,a,'role:'+b.policyId),before=state(f.store);
  assert.throws(()=>f.service.exportActive({roleId:a.policyId,expectedVersion:0,lease,principalId:'fixture-owner'}));
  assert.deepEqual(readdirSync(directory),[]);assert.deepEqual(state(f.store),before);
});
