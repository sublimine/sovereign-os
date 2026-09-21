import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import {join} from 'node:path';
import {execFileSync,spawn} from 'node:child_process';
import {setTimeout as delay} from 'node:timers/promises';
import {Store} from '../../factory/lib/store.mjs';
import {sha256} from '../../factory/lib/contracts.mjs';
import {missionInferenceBudget} from '../../factory/lib/mission-inference-budget.mjs';

const cli=new URL('../../factory/bin/sovereign.mjs',import.meta.url).pathname;
test('REAL CLI/SQLite: bounded read is opt-in, freezes protocol 6 and never starts inference on submission',()=>{
  const directory=fs.mkdtempSync('/tmp/sovereign-bounded-read-cli-');
  try{
    const command=(...args)=>JSON.parse(execFileSync(process.execPath,[cli,...args,'--state-dir',directory],{encoding:'utf8',stdio:['ignore','pipe','pipe']}));
    const args=['submit','--text','Read input.txt only when this complete task is eligible.','--request-id','submission:bounded-read-cli',
      '--preset','adaptive-v2','--entry-mode','bounded-read-response-v1','--allowed-tools','workspace.read'];
    const first=command(...args),m=command('status',first.missionId,'--json').mission;
    assert.equal(command(...args).missionId,first.missionId);assert.equal(m.policy.entryMode,'bounded-read-response-v1');
    assert.deepEqual(m.policy.allowedTools,['workspace.read']);assert.equal(m.policy.producerBatch,'read-test-cursor-v1');
    assert.equal(m.policySelection.presetId,'adaptive-v2');assert.equal(m.policySelection.definition.entryMode,'closed-response-v2');
    assert.throws(()=>command(...args.map(x=>x==='bounded-read-response-v1'?'closed-response-v2':x)),e=>String(e.stderr).includes('SUBMISSION_CONFLICT'));
    for(const action of ['status','resume','continue','queue'])assert.throws(()=>command(action,first.missionId,'--allowed-tools','workspace.write'));
    for(const action of ['status','resume','continue','queue'])assert.throws(()=>command(action,first.missionId,'--entry-mode','bounded-read-response-v1'));
    for(const invalid of ['shell','workspace.read,','workspace.read,workspace.read'])assert.throws(()=>command('submit','--text','Invalid must create nothing.','--allowed-tools',invalid));
    const old=command('submit','--text','Preserve the previous preset in a protocol 6 database.','--preset','adaptive-v2');
    assert.equal(command('status',old.missionId,'--json').mission.policy.entryMode,'closed-response-v2');
    const none=command('submit','--text','No tools are authorized.','--allowed-tools','');assert.deepEqual(command('status',none.missionId,'--json').mission.policy.allowedTools,[]);
    const store=new Store(join(directory,'state.sqlite'));try{
      assert.equal(store.db.prepare('PRAGMA user_version').get().user_version,15);assert.equal(store.list('mission').length,3);assert.equal(store.list('queue-job').length,3);
      for(const type of ['run','effect','inference-request','bounded-read-entry','queue-owner'])assert.equal(store.list(type).length,0,type);
      store.verifyJournal();
    }finally{store.close();}
  }finally{fs.rmSync(directory,{recursive:true});}
});
test('REAL CLI/SQLite: adaptive v2 freezes composition, preserves v1 and rejects unsupported options before submission',()=>{
  const directory=fs.mkdtempSync('/tmp/sovereign-adaptive-v2-cli-');
  try{
    const command=(...args)=>JSON.parse(execFileSync(process.execPath,[cli,...args,'--state-dir',directory],{encoding:'utf8',stdio:['ignore','pipe','pipe']}));
    const args=['submit','--text','Combined future mission; no service or inference is started.','--request-id','submission:adaptive-v2-cli','--preset','adaptive-v2'];
    const first=command(...args),m=command('status',first.missionId,'--json').mission;
    assert.equal(command(...args).missionId,first.missionId);assert.equal(m.policySelection.presetId,'adaptive-v2');
    assert.equal(m.policySelection.effectivePolicyHash,sha256(m.policy));assert.equal(m.policy.planningContracts.maxCalls,12);
    assert.equal(m.policy.producerBatch,'read-test-cursor-v1');assert.equal(m.policy.methodRecovery.maxRounds,1);
    assert.throws(()=>command(...args.slice(0,-1),'adaptive-v1'),e=>String(e.stderr).includes('SUBMISSION_CONFLICT'));
    for(const action of ['resume','continue','status','queue'])assert.throws(()=>command(action,first.missionId,'--preset','adaptive-v2'));
    assert.throws(()=>command('submit','--text','Incompatible must create nothing.','--preset','adaptive-v2','--document-context','literal-windows-v1'),
      e=>String(e.stderr).includes("Unknown option '--document-context'"));
    const legacy=command('submit','--text','Preserve legacy selection.','--preset','adaptive-v1');
    const old=command('status',legacy.missionId,'--json').mission;
    assert.equal(old.policy.entryMode,'closed-response-v1');assert.equal(old.policy.producerBatch,undefined);
    const override=command('submit','--text','Preserve explicit limits and representation.','--preset','adaptive-v2',
      '--entry-mode','planned','--producer-batch','read-test-v1','--planning-contracts','on-demand-v1','--planning-call-limit','3',
      '--method-recovery-rounds','2','--mission-call-limit','7');
    const p=command('status',override.missionId,'--json').mission.policy;
    assert.equal(p.entryMode,'planned');assert.equal(p.producerBatch,'read-test-v1');assert.equal(p.planningContracts.maxCalls,3);
    assert.equal(p.methodRecovery.maxRounds,2);assert.equal(p.inferenceBudget.maxCalls,7);
    assert.deepEqual(command('status',first.missionId,'--json').mission,m);
    const store=new Store(join(directory,'state.sqlite'));try{
      assert.equal(store.list('mission').length,3);assert.equal(store.list('queue-job').length,3);
      for(const type of ['run','inference-request','effect','queue-owner','method-recovery-round'])assert.equal(store.list(type).length,0,type);
      store.verifyJournal();
    }finally{store.close();}
  }finally{fs.rmSync(directory,{recursive:true});}
});
test('REAL CLI/SQLite: method-recovery rounds are explicit, frozen and idempotent without inference',()=>{
  const directory=fs.mkdtempSync('/tmp/sovereign-method-recovery-cli-');
  try{
    const command=(...args)=>JSON.parse(execFileSync(process.execPath,[cli,...args,'--state-dir',directory],{encoding:'utf8',stdio:['ignore','pipe','pipe']}));
    const args=['submit','--text','Authorize bounded reviewed changes of method.','--request-id','submission:method-recovery-cli','--method-recovery-rounds','2'];
    const first=command(...args);assert.equal(command(...args).missionId,first.missionId);
    const before=command('status',first.missionId,'--json').mission;
    assert.deepEqual(before.policy.methodRecovery,{mode:'reviewed-method-v1',maxRounds:2});
    assert.throws(()=>command(...args.slice(0,-1),'3'),e=>String(e.stderr).includes('SUBMISSION_CONFLICT'));
    for(const action of ['resume','continue','status','queue'])assert.throws(()=>command(action,first.missionId,'--method-recovery-rounds','2'));
    for(const invalid of ['0','-1','101','1.5','NaN',''])assert.throws(()=>command('submit','--text','Invalid must create nothing.','--method-recovery-rounds',invalid));
    assert.deepEqual(command('status',first.missionId,'--json').mission,before);
    const store=new Store(join(directory,'state.sqlite'));try{
      assert.equal(store.list('mission').length,1);assert.equal(store.list('run').length,0);assert.equal(store.list('effect').length,0);
      assert.equal(store.list('method-recovery-round').length,0);store.verifyJournal();
    }finally{store.close();}
  }finally{fs.rmSync(directory,{recursive:true});}
});
test('REAL CLI/SQLite: mission call ceiling is explicit, immutable and idempotent, without inference',()=>{
  const directory=fs.mkdtempSync('/tmp/sovereign-mission-budget-cli-');
  try{
    const command=(...args)=>JSON.parse(execFileSync(process.execPath,[cli,...args,'--state-dir',directory],{encoding:'utf8',stdio:['ignore','pipe','pipe']}));
    const args=['submit','--text','Bound the complete mission, including judges and discovery.','--request-id','submission:mission-budget-cli','--mission-call-limit','17'];
    const first=command(...args);assert.equal(command(...args).missionId,first.missionId);
    const before=command('status',first.missionId,'--json').mission;
    assert.deepEqual(before.policy.inferenceBudget,{mode:'mission-calls-v1',maxCalls:17});
    const publicReport=command('report',first.missionId,'--json');
    assert.equal(publicReport.inferenceBudget.integrity,'NOT_PROJECTED');
    assert.equal(publicReport.inferenceBudget.remaining,undefined,'Public report must not turn the internal reservation ledger into telemetry');
    assert.throws(()=>command(...args.slice(0,-1),'18'),e=>String(e.stderr).includes('SUBMISSION_CONFLICT'));
    for(const action of ['resume','continue','status','queue'])assert.throws(()=>command(action,first.missionId,'--mission-call-limit','17'));
    for(const invalid of ['0','-1','1001','1.5','NaN',''])assert.throws(()=>command('submit','--text','Invalid must create nothing.','--mission-call-limit',invalid));
    assert.deepEqual(command('status',first.missionId,'--json').mission,before);
    const store=new Store(join(directory,'state.sqlite'));try{
      assert.equal(store.list('mission').length,1);assert.equal(store.list('run').length,0);
      assert.equal(missionInferenceBudget(store,first.missionId).remaining,17,'Trusted local enforcement view retains the exact frozen ceiling');
      assert.equal(store.list('mission-inference-call').length,0);assert.equal(store.list('effect').length,0);store.verifyJournal();
    }finally{store.close();}
  }finally{fs.rmSync(directory,{recursive:true});}
});
test('REAL CLI/SQLite: read-test batching is opt-in, idempotent and cannot change an existing mission',()=>{
  const directory=fs.mkdtempSync('/tmp/sovereign-read-test-cli-');
  try{
    const command=(...args)=>JSON.parse(execFileSync(process.execPath,[cli,...args,'--state-dir',directory],{encoding:'utf8',stdio:['ignore','pipe','pipe']}));
    const args=['submit','--text','Frozen batch option; no service or inference.','--request-id','submission:read-test-cli','--producer-batch','read-test-v1'];
    const first=command(...args);assert.equal(command(...args).missionId,first.missionId);
    const before=command('status',first.missionId,'--json').mission;
    assert.equal(before.policy.producerBatch,'read-test-v1');
    assert.throws(()=>command(...args.slice(0,-2)),e=>String(e.stderr).includes('SUBMISSION_CONFLICT'));
    for(const action of ['resume','continue','status','queue'])assert.throws(()=>command(action,first.missionId,'--producer-batch','read-test-v1'));
    for(const mode of ['','unknown'])assert.throws(()=>command('submit','--text','Invalid mode creates nothing.','--producer-batch',mode));
    assert.deepEqual(command('status',first.missionId,'--json').mission,before);
    const baseline=command('submit','--text','No batch policy selected.');
    assert.equal(command('status',baseline.missionId,'--json').mission.policy.producerBatch,undefined);
    const store=new Store(join(directory,'state.sqlite'));try{
      assert.equal(store.list('mission').length,2);assert.equal(store.list('run').length,0);
      assert.equal(store.list('inference-request').length,0);assert.equal(store.list('effect').length,0);assert.ok(store.verifyJournal());
    }finally{store.close();}
  }finally{fs.rmSync(directory,{recursive:true});}
});
test('REAL CLI/SQLite: planning inspection is explicit, bounded, frozen and idempotent without inference',()=>{
  const directory=fs.mkdtempSync('/tmp/sovereign-inspection-cli-');
  try{
    const command=(...args)=>JSON.parse(execFileSync(process.execPath,[cli,...args,'--state-dir',directory],{encoding:'utf8',stdio:['ignore','pipe','pipe']}));
    const args=['submit','--text','Inspect complete planning cards if this mission later needs a plan.','--request-id','submission:inspection-cli',
      '--preset','adaptive-v1','--planning-contracts','on-demand-v1','--planning-call-limit','5','--planning-card-bytes','65536'];
    const first=command(...args);assert.equal(command(...args).missionId,first.missionId);
    const m=command('status',first.missionId,'--json').mission;
    assert.deepEqual(m.policy.planningContracts,{mode:'on-demand-v1',maxCalls:5,maxBytes:65536});assert.equal(m.policySelection.effectivePolicyHash,sha256(m.policy));
    const changed=[...args];changed[changed.indexOf('--planning-call-limit')+1]='6';
    assert.throws(()=>command(...changed),e=>String(e.stderr).includes('SUBMISSION_CONFLICT'));
    assert.throws(()=>command('resume',first.missionId,'--planning-contracts','on-demand-v1','--planning-call-limit','5'));
    for(const invalid of [['--planning-call-limit','5'],['--planning-contracts','on-demand-v1'],['--planning-card-bytes','1000'],
      ['--planning-contracts','on-demand-v1','--planning-call-limit','0'],['--planning-contracts','on-demand-v1','--planning-call-limit','101'],
      ['--planning-contracts','on-demand-v1','--planning-call-limit','2.5'],['--planning-contracts','unknown','--planning-call-limit','2'],
      ['--planning-contracts','on-demand-v1','--planning-call-limit','2','--planning-card-bytes','262145']])
      assert.throws(()=>command('submit','--text','Invalid inspection policy must create nothing.',...invalid));
    const store=new Store(join(directory,'state.sqlite'));try{assert.equal(store.list('mission').length,1);assert.equal(store.list('run').length,0);assert.equal(store.list('inference-request').length,0);assert.ok(store.verifyJournal());}finally{store.close();}
  }finally{fs.rmSync(directory,{recursive:true});}
});
test('REAL CLI/SQLite: chat entry combination preserves every frozen choice and never starts inference',()=>{
  const directory=fs.mkdtempSync('/tmp/sovereign-chat-entry-cli-');
  try{
    const command=(...args)=>JSON.parse(execFileSync(process.execPath,[cli,...args,'--state-dir',directory],{encoding:'utf8',stdio:['ignore','pipe','pipe']}));
    const selection=['--preset','adaptive-v1','--card-encoding','compact-json-v1','--producer-context','node-contract-v1','--parallel-pure-nodes','2'];
    const args=['submit','--text','Exact chat entry fixture; no service is running.','--request-id','submission:chat-entry',...selection];
    const first=command(...args);assert.equal(command(...args).missionId,first.missionId);
    const m=command('status',first.missionId,'--json').mission;
    for(const [key,value] of Object.entries({entryMode:'closed-response-v1',reviewEncoding:'evidence-catalog-v1',instructionProfile:'scoped-v1',contextEncoding:'lossless-json-v2',cardEncoding:'compact-json-v1',producerContext:'node-contract-v1',maxParallelPureNodes:2}))assert.equal(m.policy[key],value,key);
    assert.equal(m.policySelection.effectivePolicyHash,sha256(m.policy));
    for(const [option,value] of [['--card-encoding','pretty-json'],['--producer-context','full-plan'],['--parallel-pure-nodes','1']]){
      const changed=[...args];changed[changed.indexOf(option)+1]=value;
      assert.throws(()=>command(...changed),e=>String(e.stderr).includes('SUBMISSION_CONFLICT'));
    }
    assert.deepEqual(command('status',first.missionId,'--json').mission,m,'Rejected changes leave original policy unchanged');
    const explicit=['--preset','adaptive-v1','--card-encoding','pretty-json','--producer-context','full-plan','--parallel-pure-nodes','1','--entry-mode','planned'];
    const other=command('submit','--text','An explicit user choice remains binding.',...explicit);
    const p=command('status',other.missionId,'--json').mission.policy;
    assert.equal(p.cardEncoding,'pretty-json');assert.equal(p.producerContext,'full-plan');assert.equal(p.maxParallelPureNodes,1);assert.equal(p.entryMode,'planned');
    for(const [option,value] of [['--card-encoding','lossy'],['--producer-context','invented']]){
      const changed=[...selection];changed[changed.indexOf(option)+1]=value;
      assert.throws(()=>command('submit','--text','Invalid combined configuration.',...changed));
    }
    const store=new Store(join(directory,'state.sqlite'));
    try{assert.equal(store.list('mission').length,2);assert.equal(store.list('run').length,0);assert.equal(store.list('effect').length,0);assert.equal(store.list('queue-owner').length,0);assert.ok(store.verifyJournal());}finally{store.close();}
  }finally{fs.rmSync(directory,{recursive:true});}
});
test('REAL CLI/SQLite: adaptive preset is expanded once, recorded and idempotent without inference',()=>{
  const directory=fs.mkdtempSync('/tmp/sovereign-preset-cli-');
  try{
    const command=(...args)=>JSON.parse(execFileSync(process.execPath,[cli,...args,'--state-dir',directory],{encoding:'utf8',stdio:['ignore','pipe','pipe']}));
    const args=['submit','--text','Preset fixture, no service execution.','--request-id','submission:preset-cli','--preset','adaptive-v1'];
    const first=command(...args);assert.equal(command(...args).missionId,first.missionId);
    const m=command('status',first.missionId,'--json').mission;
    assert.equal(m.policy.entryMode,'closed-response-v1');assert.equal(m.policy.reviewEncoding,'evidence-catalog-v1');
    assert.equal(m.policy.instructionProfile,'scoped-v1');assert.equal(m.policy.contextEncoding,'lossless-json-v2');
    assert.equal(m.policySelection.effectivePolicyHash,sha256(m.policy));assert.equal(m.policySelection.presetId,'adaptive-v1');
    assert.throws(()=>command(...args,'--entry-mode','planned'),e=>String(e.stderr).includes('SUBMISSION_CONFLICT'));
    assert.throws(()=>command('resume',first.missionId,'--preset','adaptive-v1'));
    assert.throws(()=>command('submit','--text','Unknown preset','--preset','unknown'));
    const other=command('submit','--text','Explicit policy override.','--preset','adaptive-v1','--entry-mode','planned');
    assert.equal(command('status',other.missionId,'--json').mission.policy.entryMode,'planned');
    const store=new Store(join(directory,'state.sqlite'));try{assert.equal(store.list('mission').length,2);assert.equal(store.list('run').length,0);assert.equal(store.list('effect').length,0);}finally{store.close();}
  }finally{fs.rmSync(directory,{recursive:true});}
});
test('REAL CLI/SQLite: concurrency is explicit, durable and immutable for an existing submission',()=>{
  const directory=fs.mkdtempSync('/tmp/sovereign-parallel-cli-');
  try{
    const command=(...args)=>JSON.parse(execFileSync(process.execPath,[cli,...args,'--state-dir',directory],{encoding:'utf8',stdio:['ignore','pipe','pipe']}));
    const args=['submit','--text','Concurrency policy fixture, no service execution.','--request-id','submission:parallel-cli','--parallel-pure-nodes','2'];
    const first=command(...args);assert.equal(command(...args).missionId,first.missionId);
    assert.equal(command('status',first.missionId,'--json').mission.policy.maxParallelPureNodes,2);
    assert.throws(()=>command(...args.slice(0,-1),'1'),e=>String(e.stderr).includes('SUBMISSION_CONFLICT'));
    for(const limit of ['0','5','2.5','not-a-number'])assert.throws(()=>command('submit','--text','Invalid limit','--parallel-pure-nodes',limit));
    const store=new Store(join(directory,'state.sqlite'));try{assert.equal(store.list('mission').length,1);assert.equal(store.list('run').length,0);}finally{store.close();}
  }finally{fs.rmSync(directory,{recursive:true});}
});
test('REAL CLI/SQLite: learning status and capture never create missions or invoke a provider',()=>{
  const directory=fs.mkdtempSync('/tmp/sovereign-learning-cli-');
  try{
    const command=(...args)=>JSON.parse(execFileSync(process.execPath,[cli,...args,'--state-dir',directory],{encoding:'utf8',stdio:['ignore','pipe','pipe']}));
    assert.throws(()=>command('learn-list'));
    const job=command('submit','--text','Observe this untouched fixture without executing it.');
    const emptyList=command('learn-list');
    assert.equal(emptyList.schema,'sovereign.learning-cycles-public-boundary.v1');assert.equal(emptyList.integrity,'NOT_PROJECTED');assert.deepEqual(emptyList.cycles,[]);
    const observed=command('learn-observe',job.missionId);
    assert.equal(observed.schema,'sovereign.learning-action-public-boundary.v1');assert.equal(observed.integrity,'NOT_PROJECTED');assert.equal(observed.action,'OBSERVE');assert.deepEqual(observed.cycles,[]);
    const sentinel='PRIVATE_LEARNING_CYCLE_CLI_SENTINEL',injectedStore=new Store(join(directory,'state.sqlite'));
    try{injectedStore.put('learning-cycle','learning-cycle:cli-private',{id:'learning-cycle:cli-private',missionId:'mission:foreign',runId:'run:foreign',roleId:'role:foreign',status:'OBSERVED',privateBytes:sentinel},{expectedVersion:0});}
    finally{injectedStore.close();}
    const redactedList=command('learn-list');assert.equal(redactedList.integrity,'NOT_PROJECTED');assert.deepEqual(redactedList.cycles,[]);assert(!JSON.stringify(redactedList).includes(sentinel));
    const redactedObserve=command('learn-observe',job.missionId);assert.equal(redactedObserve.integrity,'NOT_PROJECTED');assert.equal(redactedObserve.action,'OBSERVE');assert.deepEqual(redactedObserve.cycles,[]);assert(!JSON.stringify(redactedObserve).includes(sentinel));
    assert.throws(()=>command('learn-observe','missing'));assert.throws(()=>command('learn-propose','missing'));
    const store=new Store(join(directory,'state.sqlite'));try{assert.equal(store.list('mission').length,1);assert.equal(store.list('run').length,0);assert.equal(store.list('effect').length,0);assert.equal(store.list('learning-proposal').length,0);}finally{store.close();}
  }finally{fs.rmSync(directory,{recursive:true});}
});
for(const encoding of ['lossless-v1','lossless-json-v2'])test(`REAL CLI/SQLite: ${encoding} selection is durable, idempotent and cannot change under an existing request ID`,()=>{
  const directory=fs.mkdtempSync('/tmp/sovereign-queue-codec-');
  try{
    const command=(...args)=>JSON.parse(execFileSync(process.execPath,[cli,...args,'--state-dir',directory],{encoding:'utf8',stdio:['ignore','pipe','pipe']}));
    const args=['submit','--text','Codec configuration fixture; no service is started.','--request-id','submission:codec-cli','--context-encoding',encoding];
    const first=command(...args);assert.equal(command(...args).missionId,first.missionId);
    assert.equal(command('status',first.missionId,'--json').mission.policy.contextEncoding,encoding);
    assert.throws(()=>command(...args.slice(0,-1),'plain-json'),e=>String(e.stderr).includes('SUBMISSION_CONFLICT'));
    assert.throws(()=>command('submit','--text','Invalid codec.','--context-encoding','lossy'),e=>String(e.stderr).includes('POLICY'));
    const store=new Store(join(directory,'state.sqlite'));try{
      assert.equal(store.list('mission').length,1);assert.equal(store.list('run').length,0);assert.equal(store.list('effect').length,0);
    }finally{store.close();}
  }finally{fs.rmSync(directory,{recursive:true});}
});
test('REAL CLI/process/SQLite: idempotent inbox, paused job, idle service restart, no model invocation',async t=>{
  const directory=fs.mkdtempSync('/tmp/sovereign-queue-cli-');t.after(()=>fs.rmSync(directory,{recursive:true}));
  const command=(...args)=>JSON.parse(execFileSync(process.execPath,[cli,...args,'--state-dir',directory],{encoding:'utf8',stdio:['ignore','pipe','pipe']}));
  const first=command('submit','--text','Local queue fixture. Do not execute: paused before starting service.','--request-id','submission:cli-test');
  const repeated=command('submit','--text','Local queue fixture. Do not execute: paused before starting service.','--request-id','submission:cli-test');
  assert.equal(first.missionId,repeated.missionId);assert.equal(command('queue').length,1);
  assert.equal(command('pause',first.missionId).status,'PAUSED');
  for(let restart=0;restart<2;restart++){
    const child=spawn(process.execPath,[cli,'serve','--state-dir',directory],{stdio:['ignore','pipe','pipe']});
    let stderr='';child.stderr.on('data',b=>stderr+=b);child.stdout.resume();
    const exit=new Promise(r=>child.once('close',(code,signal)=>r({code,signal})));
    t.after(()=>{if(child.exitCode===null&&!child.killed)child.kill('SIGKILL');});
    let observed=false;
    for(let i=0;i<100;i++){await delay(20);const store=new Store(join(directory,'state.sqlite'));try{observed=store.get('queue-owner','exclusive')?.data.pid===child.pid&&Boolean(store.get('queue-owner','exclusive')?.data.ownerId);}finally{store.close();}if(observed)break;}
    assert.equal(observed,true,stderr);child.kill('SIGTERM');assert.deepEqual(await exit,{code:0,signal:null});
  }
  const store=new Store(join(directory,'state.sqlite'));try{
    assert.equal(store.list('run').length,0);assert.equal(store.list('effect').length,0);
    assert.equal(store.get('queue-owner','exclusive').data.ownerId,null);
    assert.equal(store.get('queue-job',first.missionId).data.status,'PAUSED');
  }finally{store.close();}
  assert.equal(command('cancel',first.missionId).status,'CANCELLED');
});
