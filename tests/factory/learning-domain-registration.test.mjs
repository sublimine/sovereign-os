import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {spawnSync} from 'node:child_process';
import {FactoryEngine} from '../../factory/lib/engine.mjs';
import {Store} from '../../factory/lib/store.mjs';
import {Authority} from '../../factory/lib/authority.mjs';
import {LearningService} from '../../factory/lib/learning-service.mjs';
import {canonical,sha256} from '../../factory/lib/contracts.mjs';
import {registerLearningDomain,validateLearningDomainRegistration} from '../../factory/lib/learning-domain-registration.mjs';
import {admitLearningProvenanceFixtureSource,learningProvenanceFixturePolicy,signedLearningProvenanceFixture} from './fixtures/learning-provenance.mjs';

const cli=new URL('../../factory/bin/sovereign.mjs',import.meta.url).pathname;
function manifest(){return {domainId:'registration-fixture',roleId:'sigma_01',
  scope:{roleIds:['sigma_01'],purpose:'registered-domain-fixture',mode:'producer',instructionProfile:'scoped-v1'},
  datasetSpec:{missionId:'registration-fixture-evaluation',evaluatorId:'exact-json-value-v1',policy:{requireImprovement:true},
    cases:[false,true].map((holdout,i)=>({id:'private-case-'+i,required:true,holdout,
      input:{taskInstructions:'Return only the requested object.',input:'Frozen private question '+i+' café café\r\n',
        schema:{type:'object',properties:{answer:{type:'string'}},required:['answer'],additionalProperties:false},
        model:'gpt-6-astra',reasoningEffort:'ultra',instructionProfile:'scoped-v1'},
      expected:{answer:'private-expected-'+i},criteria:[{metric:'exactMatch',direction:'higher',threshold:1}]}))}};}
function attested(spec){
  const store=new Store(':memory:'),service=new LearningService({store,authority:new Authority(store),provenancePolicy:learningProvenanceFixturePolicy});
  try{const value=structuredClone(spec),source=admitLearningProvenanceFixtureSource(store,{missionId:value.datasetSpec.missionId});
    value.provenance=signedLearningProvenanceFixture({...value,service,source});return value;
  }finally{store.close();}
}
function fixture(t){
  const root=fs.mkdtempSync(join(tmpdir(),'sovereign-domain-register-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  const spec=attested(manifest()),engine=new FactoryEngine({databasePath:join(root,'state.sqlite'),workspaceRoot:join(root,'workspaces'),learningProvenancePolicy:learningProvenanceFixturePolicy});
  admitLearningProvenanceFixtureSource(engine.store,{missionId:spec.datasetSpec.missionId});engine.close();
  const file=join(root,'domain.json'),policyFile=join(root,'provenance-policy.json');
  fs.writeFileSync(file,JSON.stringify(spec),{mode:0o600});fs.writeFileSync(policyFile,JSON.stringify(learningProvenanceFixturePolicy),{mode:0o600});return {root,file,policyFile,spec};
}
function validationFixture(t){
  const root=fs.mkdtempSync(join(tmpdir(),'sovereign-domain-validate-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  const file=join(root,'domain.json'),policyFile=join(root,'provenance-policy.json'),spec=attested(manifest());
  fs.writeFileSync(file,JSON.stringify(spec),{mode:0o600});fs.writeFileSync(policyFile,JSON.stringify(learningProvenanceFixturePolicy),{mode:0o600});return {root,file,policyFile,spec};
}
function invoke(f,args=['learn-register','--file',f.file]){return spawnSync(process.execPath,[cli,...args,'--state-dir',f.root,...(f.policyFile?['--provenance-policy',f.policyFile]:[])],{encoding:'utf8',timeout:15000,maxBuffer:1024*1024});}
function invokeWithoutPolicy(f,args=['learn-register','--file',f.file]){return spawnSync(process.execPath,[cli,...args,'--state-dir',f.root],{encoding:'utf8',timeout:15000,maxBuffer:1024*1024});}
function invokeValidation(f,args=['learn-validate','--file',f.file]){return spawnSync(process.execPath,[cli,...args],{encoding:'utf8',timeout:15000,maxBuffer:1024*1024});}
function ok(f,args){const r=invoke(f,args);assert.equal(r.error,undefined);assert.equal(r.status,0,r.stderr);return JSON.parse(r.stdout);}
function inspect(f,fn){const store=new Store(join(f.root,'state.sqlite'));try{return fn(store);}finally{store.close();}}
const state=f=>inspect(f,s=>({protocol:s.db.prepare('PRAGMA user_version').get().user_version,journal:s.verifyJournal(),records:s.db.prepare('SELECT type,id,version,hash FROM records ORDER BY type,id,version').all()}));
function noCalls(f){inspect(f,s=>{for(const type of ['mission','queue-job','learning-cycle','learning-proposal','learning-provider-attempt','learning-provider-execution','learning-candidate','learning-evaluation','learning-export'])assert.equal(s.list(type).length,0,type);});}

test('in-memory validator reveals only safe registration metadata and never opens destination state',t=>{
  const f=validationFixture(t),before=fs.readdirSync(f.root).sort(),info=validateLearningDomainRegistration(f.spec);
  assert.equal(info.domainId,f.spec.domainId);assert.equal(info.roleId,f.spec.roleId);assert.equal(info.caseCount,2);assert.equal(info.pairedInferenceCalls,4);
  assert(!JSON.stringify(info).includes('private-case-'));assert(!JSON.stringify(info).includes('private-expected-'));
  const r=invokeValidation(f);assert.equal(r.error,undefined);assert.equal(r.status,0,r.stderr);const result=JSON.parse(r.stdout);
  assert.equal(result.validation,'VALID');assert.equal(result.readOnly,true);assert.equal(result.datasetHash,sha256(f.spec.datasetSpec));
  assert.deepEqual(fs.readdirSync(f.root).sort(),before);assert(!JSON.stringify(result).includes('private-case-'));assert(!JSON.stringify(result).includes('Frozen private question'));
});

test('validator rejects state, overrides and invalid manifests without creating a Store',t=>{
  const f=validationFixture(t),before=fs.readdirSync(f.root).sort();
  for(const suffix of [['--state-dir',f.root],['--model','different'],['extra']]){
    const r=invokeValidation(f,['learn-validate','--file',f.file,...suffix]);assert.equal(r.status,1);assert.deepEqual(fs.readdirSync(f.root).sort(),before);
  }
  f.spec.datasetSpec.cases[1].holdout=false;fs.writeFileSync(f.file,JSON.stringify(f.spec));
  const r=invokeValidation(f);assert.equal(r.status,1);assert.match(r.stderr,/LEARNING_REGISTRATION_POLICY/);
  assert.deepEqual(fs.readdirSync(f.root).sort(),before);
});

test('attested registration never trusts policy material from the manifest or silently proceeds without operator policy',t=>{
  const f=fixture(t),before=state(f),without=invokeWithoutPolicy(f);
  assert.equal(without.status,1);assert.match(without.stderr,/LEARNING_PROVENANCE_POLICY/);assert.deepEqual(state(f),before);
  f.spec.trustPolicy=learningProvenanceFixturePolicy;fs.writeFileSync(f.file,JSON.stringify(f.spec));
  const embedded=invoke(f);assert.equal(embedded.status,1);assert.match(embedded.stderr,/SCHEMA/);assert.deepEqual(state(f),before);
});

test('policy form can be checked during in-memory validation without opening a destination Store',t=>{
  const f=validationFixture(t),before=fs.readdirSync(f.root).sort();
  const valid=invokeValidation(f,['learn-validate','--file',f.file,'--provenance-policy',f.policyFile]);
  assert.equal(valid.status,0,valid.stderr);assert.deepEqual(fs.readdirSync(f.root).sort(),before);
  fs.writeFileSync(f.policyFile,'{"schema":"bad"}');
  const invalid=invokeValidation(f,['learn-validate','--file',f.file,'--provenance-policy',f.policyFile]);
  assert.equal(invalid.status,1);assert.match(invalid.stderr,/(SCHEMA|LEARNING_PROVENANCE_POLICY)/);assert.deepEqual(fs.readdirSync(f.root).sort(),before);
});

test('CLI registers a complete immutable domain without inference; exact reentry is read-only',t=>{
  const f=fixture(t),r=ok(f);assert.equal(r.registration,'REGISTERED');assert.equal(r.domainId,f.spec.domainId);assert.equal(r.roleId,'sigma_01');
  assert.equal(r.executable,true);assert.equal(r.caseCount,2);assert.equal(r.pairedInferenceCalls,4);assert.equal(r.datasetHash,sha256(f.spec.datasetSpec));
  assert.equal(state(f).protocol,12);assert.equal(r.provenanceStatus,'VERIFIED_CUSTODY_AND_REVIEW');noCalls(f);
  inspect(f,s=>{assert.deepEqual(s.get('learning-dataset',r.datasetHash).data,f.spec.datasetSpec);const role=s.get('learning-role',r.policyId).data;assert.equal(role.activeHash,role.baselineHash);});
  for(const secret of ['private-case-','private-expected-','Frozen private question'])assert(!JSON.stringify(r).includes(secret));
  const before=state(f),again=ok(f);assert.equal(again.registration,'ALREADY_REGISTERED');assert.deepEqual(state(f),before);
  assert.deepEqual(ok(f,['learn-evaluators'])[0].datasetHash,r.datasetHash);
});

test('CLI idempotence normalizes explicit default scope fields but never changes stored cases',t=>{
  const f=fixture(t),r=ok(f),before=state(f);f.spec.scope.contextEncoding='plain-json';f.spec.scope.cardEncoding='pretty-json';f.spec.scope.producerContext='full-plan';
  fs.writeFileSync(f.file,JSON.stringify(f.spec,null,2));assert.equal(ok(f).registration,'ALREADY_REGISTERED');assert.deepEqual(state(f),before);
  f.spec.datasetSpec.cases[1].expected.answer+=' changed';f.spec=attested(f.spec);fs.writeFileSync(f.file,JSON.stringify(f.spec));
  const failed=invoke(f);assert.equal(failed.status,1);assert.match(failed.stderr,/LEARNING_REGISTRATION_CONFLICT/);assert.deepEqual(state(f),before);
  inspect(f,s=>assert.equal(s.get('learning-domain',r.policyId).data.datasetHash,r.datasetHash));
});

for(const [name,change,code] of [
  ['unknown evaluator',s=>s.datasetSpec.evaluatorId='unimplemented','LEARNING_EVALUATOR'],
  ['weakened criterion in last case',s=>s.datasetSpec.cases[1].criteria[0].threshold=0,'LEARNING_EVALUATOR_CONTRACT'],
  ['no improvement policy',s=>s.datasetSpec.policy.requireImprovement=false,'LEARNING_REGISTRATION_POLICY'],
  ['no holdout',s=>s.datasetSpec.cases.forEach(c=>c.holdout=false),'LEARNING_REGISTRATION_POLICY'],
  ['no required training case',s=>s.datasetSpec.cases.forEach(c=>c.holdout=true),'LEARNING_REGISTRATION_POLICY'],
  ['scope target mismatch',s=>s.scope.roleIds=['omega_22'],'LEARNING_SCOPE'],
  ['unknown scope field',s=>s.scope.owner='forged','SCHEMA'],
  ['extra outer field',s=>s.activate=true,'SCHEMA'],
  ['bad last case profile',s=>s.datasetSpec.cases[1].input.instructionProfile='model-default','LEARNING_SCOPE'],
  ['duplicate case ID',s=>s.datasetSpec.cases[1].id=s.datasetSpec.cases[0].id,'SCHEMA'],
  ['extra policy field',s=>s.datasetSpec.policy.autoPromote=true,'SCHEMA'],
])test(`CLI preflight rejects ${name} without changing installed state`,t=>{
  const f=fixture(t),before=state(f);change(f.spec);fs.writeFileSync(f.file,JSON.stringify(f.spec));const r=invoke(f);
  assert.equal(r.status,1,r.stdout);assert.match(r.stderr,new RegExp(code));assert.deepEqual(state(f),before);noCalls(f);
});

test('CLI rejects an overlapping second domain atomically',t=>{
  const f=fixture(t);ok(f);const before=state(f);f.spec.domainId='another-name';f.spec=attested(f.spec);fs.writeFileSync(f.file,JSON.stringify(f.spec));const r=invoke(f);
  assert.equal(r.status,1);assert.match(r.stderr,/LEARNING_DOMAIN_OVERLAP/);assert.deepEqual(state(f),before);
});
test('CLI accepts evaluation-only but still creates no proposal or active overlay',t=>{
  const f=fixture(t);f.spec.datasetSpec.policy.activation='evaluation-only';delete f.spec.provenance;fs.writeFileSync(f.file,JSON.stringify(f.spec));
  const r=ok(f);assert.equal(r.activation,'evaluation-only');noCalls(f);
});

for(const [name,prepare] of [
  ['malformed JSON',f=>fs.writeFileSync(f.file,'{"domainId":')],
  ['malformed UTF8',f=>fs.writeFileSync(f.file,Buffer.from([0x61,0xc3,0x28]))],
  ['symlink',f=>{fs.renameSync(f.file,f.file+'.target');fs.symlinkSync(f.file+'.target',f.file);}],
  ['hardlink',f=>fs.linkSync(f.file,f.file+'.linked')],
  ['directory',f=>{fs.renameSync(f.file,f.file+'.target');fs.mkdirSync(f.file);}],
  ['FIFO',f=>{fs.renameSync(f.file,f.file+'.target');assert.equal(spawnSync('mkfifo',[f.file]).status,0);}],
  ['missing file',f=>fs.renameSync(f.file,f.file+'.missing')],
  ['oversized file',f=>fs.writeFileSync(f.file,' '.repeat(1024*1024+1))],
  ['symlink parent',f=>{const actual=join(f.root,'real-parent'),link=join(f.root,'linked-parent');fs.mkdirSync(actual);fs.renameSync(f.file,join(actual,'domain.json'));fs.symlinkSync(actual,link);f.file=join(link,'domain.json');}],
])test(`CLI rejects ${name} without hanging, inference or registry mutations`,t=>{
  const f=fixture(t),before=state(f);prepare(f);const r=invoke(f);assert.equal(r.error,undefined);assert.equal(r.status,1);assert.deepEqual(state(f),before);noCalls(f);
});

test('CLI registration refuses overrides, extra arguments and missing file/state',t=>{
  const f=fixture(t),before=state(f);
  for(const suffix of [['extra'],['--model','different'],['--effort','low'],['--text','new cases'],['--allowed-tools','source.fetch'],['--inputs',f.file]]){
    const r=invoke(f,['learn-register','--file',f.file,...suffix]);assert.equal(r.status,1);assert.deepEqual(state(f),before);
  }
  assert.equal(invoke(f,['learn-register']).status,1);assert.deepEqual(state(f),before);
  const absent=join(f.root,'absent-state'),r=invoke({...f,root:absent});assert.equal(r.status,1);assert.equal(fs.existsSync(absent),false);
});
test('CLI help exposes registration independently of missions and evaluation',t=>{
  const f=fixture(t),r=invoke(f,['--help']);assert.equal(r.status,0);assert.match(r.stdout,/learn-register --file/);noCalls(f);
});

test('re-registering preserves an evaluated and promoted local-fixture version, without provider activity',async t=>{
  const f=fixture(t),registered=ok(f),engine=new FactoryEngine({databasePath:join(f.root,'state.sqlite'),workspaceRoot:join(f.root,'workspaces'),learningProvenancePolicy:learningProvenanceFixturePolicy});
  try{
    const service=engine.learning,baseline=service.registry.getActive(registered.policyId),candidate=service.propose({roleId:registered.policyId,
      parentHash:baseline.hash,instructions:'LOCAL FIXTURE ONLY: not a learned improvement.',rationale:'Check pointer preservation.',authorRunId:'local-registration-fixture'});
    let calls=0;
    await service.evaluate(candidate.candidateId,{runCase:async request=>{
      calls++;const pass=request.case.holdout||request.variant==='candidate';
      const observations={outcome:pass?'pass':'fail',metrics:{exactMatch:pass?1:0},actual:{executionContext:request.executionContext,kind:'LOCAL_FIXTURE_NO_INFERENCE'}};
      const {evaluationId,datasetHash,caseId,caseHash,roleId,instructionHash,variant,evaluatorId}=request;
      return {observations,receipt:engine.authority.seal('evaluation.case',{evaluationId,datasetHash,caseId,caseHash,roleId,instructionHash,variant,evaluatorId,
        evaluatorRunId:'local-fixture-oracle',executionId:'local-registration-execution:'+calls,observationsHash:sha256(observations)})};
    }});
    const lease=engine.authority.issue({missionId:f.spec.datasetSpec.missionId,principalId:'fixture-owner',actions:['instructions.promote'],
      resources:['role:'+registered.policyId],expiresAt:new Date(Date.now()+60000).toISOString()});
    const promoted=service.promote(candidate.candidateId,{lease,principalId:'fixture-owner'});assert.notEqual(promoted.hash,baseline.hash);
    const before=state(f);assert.equal(ok(f).registration,'ALREADY_REGISTERED');assert.deepEqual(state(f),before);
    assert.deepEqual(service.registry.getActive(registered.policyId),promoted);assert.equal(calls,4);
    assert.equal(engine.store.list('learning-provider-attempt').length,0);
  }finally{engine.close();}
});

test('failed staging never enters the real registry transaction',t=>{
  const f=fixture(t),bad=structuredClone(f.spec);bad.datasetSpec.cases[1].criteria[0].threshold=0;let touched=false;
  const service={store:{transact(){touched=true;throw Error('Real store must not be touched');}}};
  assert.throws(()=>registerLearningDomain(service,bad),{code:'LEARNING_EVALUATOR_CONTRACT'});assert.equal(touched,false);
});

for(const [label,text] of [['malformed JSON','{'],['invalid manifest','{}'],['incompatible evaluator',JSON.stringify({...manifest(),datasetSpec:{...manifest().datasetSpec,evaluatorId:'unknown'}})]])
test(`CLI ${label} leaves an initially empty Store and filesystem untouched`,t=>{
  const root=fs.mkdtempSync(join(tmpdir(),'sovereign-register-empty-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  const file=join(root,'domain.json'),store=new Store(join(root,'state.sqlite'));store.close();fs.writeFileSync(file,text);
  const f={root,file},before=state(f),files=fs.readdirSync(root).sort();const r=invoke(f);
  assert.equal(r.status,1);assert.deepEqual(state(f),before);assert.deepEqual(fs.readdirSync(root).sort(),files);
});

test('unexpected commit failure rolls back every registration record and protocol change',t=>{
  const f=fixture(t),engine=new FactoryEngine({databasePath:join(f.root,'state.sqlite'),workspaceRoot:join(f.root,'workspaces'),learningProvenancePolicy:learningProvenanceFixturePolicy}),before=state(f);
  try{
    const original=engine.learning.registerDomain.bind(engine.learning);
    engine.learning.registerDomain=request=>{original(request);throw Object.assign(Error('Injected after register'),{code:'INJECTED'});};
    assert.throws(()=>registerLearningDomain(engine.learning,f.spec),{code:'INJECTED'});assert.deepEqual(state(f),before);
  }finally{engine.close();}
});

test('scope and target conflicts cannot mutate or overwrite a saved domain',t=>{
  const f=fixture(t);ok(f);const before=state(f);
  for(const change of [s=>s.scope.purpose='different',s=>s.datasetSpec.cases[1].input.reasoningEffort='high',s=>s.datasetSpec.cases[1].input.input+=' changed']){
    let changed=structuredClone(f.spec);change(changed);changed=attested(changed);fs.writeFileSync(f.file,JSON.stringify(changed));const r=invoke(f);
    assert.equal(r.status,1);assert.match(r.stderr,/LEARNING_REGISTRATION_CONFLICT/);assert.deepEqual(state(f),before);
  }
});
