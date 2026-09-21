import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {spawnSync} from 'node:child_process';
import {Store} from '../../factory/lib/store.mjs';
import {FactoryEngine} from '../../factory/lib/engine.mjs';
import {EXACT_JSON_EVALUATOR} from '../../factory/lib/registered-learning-evaluator.mjs';
import {admitLearningProvenanceFixtureSource,learningProvenanceFixturePolicy,signedLearningProvenanceFixture} from './fixtures/learning-provenance.mjs';

const cli=new URL('../../factory/bin/sovereign.mjs',import.meta.url).pathname;
const preload=new URL('./fixtures/registered-learning-cli-provider.mjs',import.meta.url).pathname;
function fixture(t,{evaluatorId=EXACT_JSON_EVALUATOR}={}){
  const root=fs.mkdtempSync(join(tmpdir(),'sovereign-registered-cli-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  const policyFile=join(root,'provenance-policy.json');fs.writeFileSync(policyFile,JSON.stringify(learningProvenanceFixturePolicy),{mode:0o600});
  const store=new Store(join(root,'state.sqlite')),engine=new FactoryEngine({store,workspaceRoot:join(root,'workspaces'),learningProvenancePolicy:learningProvenanceFixturePolicy});
  try{
    const scope={roleIds:['sigma_01'],purpose:'registered-cli-fixture',mode:'producer',instructionProfile:'scoped-v1'};
    const spec={missionId:'eval-fixture',evaluatorId,cases:[42,13].map((answer,i)=>({id:'private-case-'+i,
      input:{taskInstructions:'Return the requested object.',input:i?'frozen-holdout-question':'frozen-first-question',schema:{type:'object',properties:{answer:{type:'integer'}},required:['answer'],additionalProperties:false},model:'gpt-6-astra',reasoningEffort:'ultra',instructionProfile:'scoped-v1'},
      expected:{answer},required:true,holdout:!!i,criteria:[{metric:'exactMatch',direction:'higher',threshold:1}]})),policy:{requireImprovement:true}};
    const request={domainId:'registered-learning-cli-fixture',roleId:'sigma_01',scope,datasetSpec:spec};
    const source=admitLearningProvenanceFixtureSource(store,{missionId:spec.missionId});
    const domain=engine.learning.registerDomain({...request,provenance:signedLearningProvenanceFixture({...request,service:engine.learning,source})});
    const baseline=domain.baseline;
    store.put('run','cli-worker',{id:'cli-worker',missionId:'cli-mission',mode:'producer',context:{purpose:scope.purpose},
      inferenceReceipts:[{status:'completed',simulation:false,model:'gpt-6-astra',reasoningEffort:'ultra'}]},{expectedVersion:0});
    store.put('worker-config','cli-worker',{compilationScope:scope},{expectedVersion:0});
    const rejected=store.put('worker-rejected-output','cli-rejection',{runId:'cli-worker',code:'SCHEMA',payload:{answer:'bad type'},accepted:false},{expectedVersion:0});
    const ref=(({type,id,version,hash})=>({type,id,version,hash}))(rejected);
    const cycle=engine.learningConductor.open({roleId:domain.policyId,runId:'cli-worker',evidenceRefs:[ref]});
    return {root,policyFile,cycle,baseline,policyId:domain.policyId};
  }finally{store.close();}
}
function invoke(f,args,{sim=false}={}){return spawnSync(process.execPath,[...(sim?['--import',preload]:[]),cli,...args,'--state-dir',f.root,'--provenance-policy',f.policyFile],{encoding:'utf8',timeout:30000,maxBuffer:1024*1024});}
function success(f,args,opts){const r=invoke(f,args,opts);assert.equal(r.error,undefined);assert.equal(r.status,0,r.stderr);return {result:JSON.parse(r.stdout),tool:r};}
function inspect(f,fn){const store=new Store(join(f.root,'state.sqlite'));try{return fn(store);}finally{store.close();}}
const fence=f=>inspect(f,store=>({journal:store.verifyJournal(),versions:store.db.prepare('SELECT count(*) AS n FROM records').get().n}));

test('CLI read-only evaluator discovery exposes compatibility, not hidden cases or authority',t=>{
  const f=fixture(t),before=fence(f),{result}=success(f,['learn-evaluators']);
  assert.equal(result[0].executable,true);assert.equal(result[0].evaluatorId,EXACT_JSON_EVALUATOR);assert.equal(result[0].pairedInferenceCalls,4);
  for(const secret of ['private-case-','"expected":','frozen-holdout-question','frozen-first-question'])assert(!JSON.stringify(result).includes(secret));
  assert.deepEqual(fence(f),before);
});
test('CLI learn-status is read-only, exposes lifecycle metadata and withholds frozen cases',t=>{
  const f=fixture(t),sentinel='PRIVATE_LEARNING_STATUS_CYCLE_SENTINEL';
  inspect(f,store=>{const cycle=store.get('learning-cycle',f.cycle.id);store.put('learning-cycle',cycle.id,{...cycle.data,privateBytes:sentinel},{expectedVersion:cycle.version});});
  const before=fence(f),{result}=success(f,['learn-status']);
  assert.equal(result.schema,'sovereign.learning-status.v1');
  assert.equal(result.registration.scopeCount,1);assert.equal(result.registration.domainCount,1);
  assert.equal(result.scopes.length,1);assert.equal(result.scopes[0].lifecycle,'REGISTERED_BASELINE');
  assert.equal(result.scopes[0].caseCount,2);assert.equal(result.scopes[0].trainingCaseCount,1);assert.equal(result.scopes[0].holdoutCaseCount,1);
  assert.equal(result.cycles,undefined);assert.equal(result.totals.cycleCount,undefined);assert.equal(result.cycleProjection.integrity,'NOT_PROJECTED');
  assert.equal(result.safety.providerCalls,0);assert.equal(result.safety.stateChanges,0);assert.equal(result.safety.automaticActivation,false);
  for(const secret of ['private-case-','"expected":','frozen-holdout-question','frozen-first-question',sentinel])assert(!JSON.stringify(result).includes(secret));
  assert.deepEqual(fence(f),before);
});
test('CLI evaluation refuses OBSERVED and proposal/evaluation options before dispatch or state changes',t=>{
  const f=fixture(t),before=fence(f);const bad=invoke(f,['learn-evaluate',f.cycle.id]);assert.equal(bad.status,1);assert.match(bad.stderr,/LEARNING_STATE/);
  for(const command of ['learn-evaluate','learn-propose','learn-evaluators'])for(const args of [['--model','different'],['--effort','low'],['--text','change the request'],['extra-positional']]){
    const r=invoke(f,[command,...(command==='learn-evaluators'?[]:[f.cycle.id]),...args]);assert.equal(r.status,1);assert.deepEqual(fence(f),before);
  }
  assert.deepEqual(fence(f),before);
});
test('REAL CLI + SQLite with explicit SIM: proposal, comparison, process restart and terminal reentry are distinct stages',t=>{
  const f=fixture(t),sentinel='PRIVATE_LEARNING_ACTION_SENTINEL';
  inspect(f,store=>{const cycle=store.get('learning-cycle',f.cycle.id);store.put('learning-cycle',cycle.id,{...cycle.data,privateBytes:sentinel},{expectedVersion:cycle.version});});
  const proposal=success(f,['learn-propose',f.cycle.id],{sim:true});
  assert.equal(proposal.result.schema,'sovereign.learning-action-public-boundary.v1');assert.equal(proposal.result.integrity,'NOT_PROJECTED');assert.equal(proposal.result.action,'PROPOSE');assert.deepEqual(proposal.result.cycles,[]);assert(!JSON.stringify(proposal.result).includes(sentinel));assert.equal(proposal.tool.stderr.split('SIM_REGISTERED_CALL ').length-1,1);
  assert.equal(inspect(f,s=>s.list('learning-evaluation').length),0);
  assert.equal(inspect(f,s=>s.get('learning-cycle',f.cycle.id).data.status),'PROPOSED');
  const again=success(f,['learn-propose',f.cycle.id],{sim:true});assert.equal(again.result.action,'PROPOSE');assert(!again.tool.stderr.includes('SIM_REGISTERED_CALL'));
  const evaluated=success(f,['learn-evaluate',f.cycle.id],{sim:true});assert.equal(evaluated.result.schema,'sovereign.learning-action-public-boundary.v1');assert.equal(evaluated.result.integrity,'NOT_PROJECTED');assert.equal(evaluated.result.action,'EVALUATE');assert.deepEqual(evaluated.result.cycles,[]);assert(!JSON.stringify(evaluated.result).includes(sentinel));
  const calls=evaluated.tool.stderr.split('\n').filter(x=>x.startsWith('SIM_REGISTERED_CALL ')).map(x=>JSON.parse(x.slice('SIM_REGISTERED_CALL '.length)));
  assert.equal(calls.length,4);assert(calls.every(c=>c.kind==='comparison'&&c.model==='gpt-6-astra'&&c.reasoningEffort==='ultra'));
  assert.equal(evaluated.tool.stderr.split('SIM_REGISTERED_CLOSE').length-1,4);
  inspect(f,s=>{assert.equal(s.get('learning-cycle',f.cycle.id).data.status,'READY_FOR_PROMOTION');assert.equal(s.get('learning-role',f.policyId).data.activeHash,f.baseline.hash);assert.equal(s.list('learning-provider-execution').length,4);assert.equal(s.list('learning-export').length,0);});
  const before=fence(f),reentry=success(f,['learn-evaluate',f.cycle.id]); // No test preload is necessary for read-only terminal reentry.
  assert.deepEqual(reentry.result,evaluated.result);assert.deepEqual(fence(f),before);
});
test('CLI unimplemented evaluator preserves the saved proposal and spends no comparison',t=>{
  const f=fixture(t,{evaluatorId:'domain-without-executable-oracle'});success(f,['learn-propose',f.cycle.id],{sim:true});const before=fence(f);
  const info=success(f,['learn-evaluators']).result[0];assert.equal(info.executable,false);assert.equal(info.code,'LEARNING_EVALUATOR');
  const r=invoke(f,['learn-evaluate',f.cycle.id],{sim:true});assert.equal(r.status,1);assert.match(r.stderr,/LEARNING_EVALUATOR/);assert(!r.stderr.includes('SIM_REGISTERED_CALL'));
  assert.deepEqual(fence(f),before);
});
test('CLI help advertises separate evaluation and production CLI never exposes a simulation flag',t=>{
  const f=fixture(t),before=fence(f),r=invoke(f,['--help']);assert.equal(r.status,0);assert.match(r.stdout,/learn-evaluators/);assert.match(r.stdout,/learn-evaluate CICLO/);
  const sim=invoke(f,['learn-evaluate',f.cycle.id,'--allow-simulation']);assert.notEqual(sim.status,0);assert.match(sim.stderr,/Unknown option/);assert.deepEqual(fence(f),before);
});
