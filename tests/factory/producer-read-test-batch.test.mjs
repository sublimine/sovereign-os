import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {Store} from '../../factory/lib/store.mjs';
import {Authority} from '../../factory/lib/authority.mjs';
import {ArtifactRegistry} from '../../factory/lib/artifacts.mjs';
import {FactoryEngine} from '../../factory/lib/engine.mjs';
import {ToolBroker} from '../../factory/tools/broker.mjs';
import {IsolatedExecutionRunner} from '../../factory/tools/execution.mjs';
import {WorkerService,WORKER_SCHEMA} from '../../factory/lib/workers.mjs';
import {sha256,canonical} from '../../factory/lib/contracts.mjs';
import {inferenceRequestHash} from '../../factory/providers/instruction-profiles.mjs';
import {readSourceContextView} from '../../factory/lib/source-context-view.mjs';
import {producerToolBudget} from '../../factory/lib/producer-tool-budget.mjs';
import {readProducerBatchCursor} from '../../factory/lib/producer-batch-cursor.mjs';

const intent='Create and independently test the exact fixture files without expanding tool authority.';
const args={argv:['node','test.mjs'],cwd:'.'};
const contents={
  'value.mjs':'export const value = 42;\n',
  'test.mjs':"import assert from 'node:assert/strict';\nimport {value} from './value.mjs';\nassert.equal(value, 42);\nprocess.stdout.write('EXACT_FIXTURE_PASSED\\n');\n"
};
const writes=Object.entries(contents).map(([path,content])=>({tool:'workspace.write',args:{path,content,expectedHash:null}}));
const reads=Object.keys(contents).map(path=>({tool:'workspace.read',args:{path}}));
const execution={tool:'execution.run',args};
const node={id:'build',purpose:'tested-files',roleIds:['omega_02'],reviewerRoleIds:['omega_03'],
  instructions:intent,outputKind:'delivery',criteria:[{id:'exact',text:intent}],
  tools:['workspace.write','workspace.read','workspace.list','execution.run'],
  requiredEffects:[...Object.keys(contents).map(path=>({type:'file',path,command:'',expectedExit:null})),
    {type:'execution',path:'.',command:JSON.stringify(args.argv),expectedExit:0}]};
const proposal=(operations)=>({action:'batch',tool:'',argsJson:JSON.stringify(operations),body:'',claims:[],method:'preknown-exact-arguments',reason:''});
const single=operation=>({...proposal([]),action:'tool',tool:operation.tool,argsJson:JSON.stringify(operation.args)});
const final=()=>({action:'final',tool:'',argsJson:'',body:'Exact fixture files with observed isolated execution; independent review required.',claims:[],method:'observed-fixture',reason:''});
// Inference is ALWAYS simulated here. The native tests explicitly opt into the
// actual isolated runner; preflight cases use a runner that must never execute.
function setup(t,respond,{mode='read-test-v1',native=false,limits={}}={}){
  const directory=mkdtempSync(join(tmpdir(),'sovereign-read-test-batch-')),store=new Store(':memory:');
  t.after(()=>{store.close();rmSync(directory,{recursive:true,force:true});});
  const authority=new Authority(store),registry=new ArtifactRegistry(store,authority);
  let runnerCalls=0,modelCalls=0;const requests=[];
  const runner=native?new IsolatedExecutionRunner():{available:()=>({available:true}),run:async()=>{runnerCalls++;throw Error('PREFLIGHT MUST NOT EXECUTE');}};
  const broker=new ToolBroker({store,authority,workspaceRoot:join(directory,'workspace'),executionRunner:runner});
  const workspace=broker.registerWorkspace('m');
  store.put('mission','m',{intent,intentHash:sha256(intent),policy:{allowedTools:[...node.tools,'source.fetch','source.search'],
    model:'gpt-6-astra',reasoningEffort:'ultra',...(mode!==undefined?{producerBatch:mode}:{})}},{expectedVersion:0});
  const workers=new WorkerService({store,authority,registry,broker,...limits,providerFactory:()=>({
    async generate(request){
      modelCalls++;requests.push(request);const exposure=readSourceContextView(request.input);
      const value=await respond({request,exposure,task:JSON.parse(exposure.task),number:modelCalls,store,workers});
      await request.validate(value);
      return {value,receipt:{kind:'inference',status:'completed',simulation:true,threadId:`sim-${modelCalls}`,turnId:`sim-turn-${modelCalls}`,
        model:request.model,reasoningEffort:request.reasoningEffort,contextHash:inferenceRequestHash(request)}};
    },async close(){}
  })});
  return {store,authority,registry,broker,workers,workspace,runner,requests,get modelCalls(){return modelCalls;},get runnerCalls(){return runnerCalls;},
    producer:(n=node)=>workers.createRun({missionId:'m',nodeId:n.id,mode:'producer',purpose:n.purpose,roleIds:n.roleIds})};
}

for(const boundary of ['before-declaration','after-charge','after-receipt','after-observation'])
for(const index of boundary==='before-declaration'?[0]:[0,2])test('Cursor production resumes exact native read/test batch: '+boundary+'/'+index,async t=>{
  const s=setup(t,({number,task})=>{
    if(number===1)return proposal(writes);if(number===2)return proposal([...reads,execution]);
    assert.equal(number,3,'Recovered batch does not purchase another proposal');assert.equal(task.step,2);assert.equal(task.remainingToolOperations,3);
    return final();
  },{mode:'read-test-cursor-v1',native:true,limits:{maxSteps:4,maxToolOperations:8,maxBatchOperations:3}});
  const actor=s.producer(),args={missionId:'m',node,runId:actor.id,inputRefs:[]},target=actor.id+':step:1:batch:'+index;
  const originalTool=s.workers.tool.bind(s.workers),originalExecute=s.broker.execute.bind(s.broker),originalRun=s.runner.run.bind(s.runner);
  let cut=false,executions=0;const dispatched=[];s.runner.run=async(...params)=>{executions++;return originalRun(...params);};
  const originalAppend=s.store.append.bind(s.store);s.store.append=(kind,data)=>{
    if(!cut&&boundary==='before-declaration'&&kind==='worker.producer.cleanup.recorded'&&data.runId===actor.id&&s.modelCalls===2){
      cut=true;throw Object.assign(Error('Controlled post-cleanup interruption before declaring cursor'),{code:'TIMEOUT'});}
    return originalAppend(kind,data);
  };
  s.broker.execute=async request=>{dispatched.push(request.operationId);const result=await originalExecute(request);
    if(!cut&&request.operationId===target&&boundary==='after-receipt'){cut=true;throw Object.assign(Error('Controlled post-receipt interruption'),{code:'TIMEOUT'});}return result;};
  s.workers.tool=async(...params)=>{
    if(!cut&&params[3]===target&&boundary==='after-charge'){cut=true;throw Object.assign(Error('Controlled post-charge interruption'),{code:'TIMEOUT'});}
    const result=await originalTool(...params);
    if(!cut&&params[3]===target&&boundary==='after-observation'){cut=true;throw Object.assign(Error('Controlled post-observation interruption'),{code:'TIMEOUT'});}return result;
  };
  await assert.rejects(s.workers.produce(args),{code:'TIMEOUT'});assert.equal(cut,true);assert.equal(s.modelCalls,2);
  const cursor=readProducerBatchCursor(s.registry,actor.id);
  if(boundary==='before-declaration'){assert.equal(cursor,null);assert.equal(producerToolBudget(s.registry,actor.id).used,2);}
  else {assert.equal(cursor.nextIndex,index+(boundary==='after-observation'?1:0));assert.equal(producerToolBudget(s.registry,actor.id).used,3+index);}
  const result=await s.workers.produce(args);assert.equal(result.status,'CANDIDATE');assert.equal(s.modelCalls,3);assert.equal(executions,1);
  assert.equal(s.store.list('effect').length,5);assert.equal(new Set(dispatched).size,5);assert.equal(dispatched.length,5);
  assert.equal(producerToolBudget(s.registry,actor.id).used,5);assert.equal(s.store.list('review').length,0,'Recovery never grants acceptance');s.store.verifyJournal();
});

for(const [name,value]of [['wider tools',99],['stricter tools',1]])test('Cursor cannot silently substitute '+name,async t=>{
  const s=setup(t,({number})=>number===1?proposal(writes):proposal([...reads,execution]),{mode:'read-test-cursor-v1',native:true});
  const actor=s.producer(),args={missionId:'m',node,runId:actor.id},original=s.workers.tool.bind(s.workers);let cut=false;
  s.workers.tool=async(...params)=>{const r=await original(...params);if(!cut&&params[3]===actor.id+':step:1:batch:0'){
    cut=true;throw Object.assign(Error('fixture interruption'),{code:'TIMEOUT'});}return r;};
  await assert.rejects(s.workers.produce(args),{code:'TIMEOUT'});const before=s.store.verifyJournal();s.workers.maxToolOperations=value;
  await assert.rejects(s.workers.produce(args),{code:'WORKER_RECOVERY_LIMITS'});assert.deepEqual(s.store.verifyJournal(),before);assert.equal(s.modelCalls,2);
});
test('An active cursor prevents a later inference request and concurrent same-service production',async t=>{
  const s=setup(t,({number})=>number===1?proposal(writes):proposal([...reads,execution]),{mode:'read-test-cursor-v1',native:true});
  const actor=s.producer(),args={missionId:'m',node,runId:actor.id},original=s.workers.tool.bind(s.workers);let release,entered;
  const ready=new Promise(r=>entered=r),gate=new Promise(r=>release=r);
  s.workers.tool=async(...params)=>{if(params[3]===actor.id+':step:1:batch:0'){entered();await gate;throw Object.assign(Error('controlled interruption'),{code:'TIMEOUT'});}return original(...params);};
  const first=s.workers.produce(args);await ready;
  try{
    await assert.rejects(s.workers.produce(args),{code:'WORKER_BUSY'});
    const before=s.store.verifyJournal();await assert.rejects(s.workers.infer({runId:actor.id,producerStep:2,instructions:'Cannot bypass active batch',input:'{}',schema:{type:'object'},validate:()=>true}),{code:'PRODUCER_BATCH_ACTIVE'});
    assert.deepEqual(s.store.verifyJournal(),before);assert.equal(s.modelCalls,2);
  }finally{release();await assert.rejects(first,{code:'TIMEOUT'});}
});

test('explicit read-test policy freezes at mission creation; baseline and budgets are unchanged',t=>{
  const s=setup(t,()=>final()),engine=new FactoryEngine({store:s.store,authority:s.authority,registry:s.registry,broker:s.broker,workers:s.workers});
  const baseline=engine.create(intent),selected=engine.create(intent,{producerBatch:'read-test-v1',preset:'adaptive-v1'});
  assert.equal(baseline.policy.producerBatch,undefined);assert.equal(selected.policy.producerBatch,'read-test-v1');
  for(const k of ['model','reasoningEffort','allowedTools','maxPlanAttempts','maxNodeAttempts'])assert.deepEqual(selected.policy[k],baseline.policy[k]);
  assert.equal(selected.policySelection.effectivePolicyHash,sha256(selected.policy));
  for(const mode of ['unknown','',null,{},true])assert.throws(()=>engine.create(intent,{producerBatch:mode}),{code:'POLICY'});
  assert.equal(s.store.list('mission').length,3);assert.equal(s.modelCalls,0);assert.equal(s.runnerCalls,0);
});

for(const [name,operations,code,selectedMode,changed]of [
  ['legacy policy',[...reads,execution],'BATCH_DEPENDENCY',null],
  ['write before execution',[writes[0],execution],'BATCH_DEPENDENCY'],
  ['write after execution',[execution,writes[0]],'BATCH_DEPENDENCY'],
  ['execution before read',[execution,reads[0]],'BATCH_DEPENDENCY'],
  ['two executions',[reads[0],execution,execution],'BATCH_DEPENDENCY'],
  ['undeclared command',[reads[0],{...execution,args:{...args,argv:['node','other.mjs']}}],'BATCH_DEPENDENCY'],
  ['different cwd',[reads[0],{...execution,args:{...args,cwd:'nested'}}],'BATCH_DEPENDENCY'],
  ['result placeholder',[reads[0],{...execution,args:{...args,argv:['node','${previous.path}']}}],'BATCH_DEPENDENCY'],
  ['source acquisition',[{tool:'source.fetch',args:{url:'https://example.com'}},execution],'BATCH_DEPENDENCY',undefined,{tools:[...node.tools,'source.fetch']}],
  ['source discovery',[{tool:'source.search',args:{query:'public fixture',limit:1}},execution],'BATCH_DEPENDENCY',undefined,{tools:[...node.tools,'source.search']}],
  ['malformed late argv',[reads[0],{...execution,args:{argv:[],cwd:'.'}}],'SCHEMA'],
  ['late unauthorized execution',[reads[0],execution],'AUTHORITY_SCOPE',undefined,{tools:['workspace.read']}],
  ['missing execution obligation',[reads[0],execution],'BATCH_DEPENDENCY',undefined,{requiredEffects:node.requiredEffects.filter(e=>e.type==='file')}],
])test(`SIMULATED: read-test preflight rejects ${name} before ALL effects`,async t=>{
  const s=setup(t,()=>proposal(operations)),n={...node,...changed};
  if(selectedMode===null){const m=s.store.get('mission','m');delete m.data.policy.producerBatch;s.store.put('mission','m',m.data,{expectedVersion:m.version});}
  const r=s.producer(n);
  await assert.rejects(s.workers.produce({missionId:'m',node:n,runId:r.id}),{code});
  assert.equal(s.store.list('effect').length,0);assert.equal(s.store.list('execution-job').length,0);assert.equal(s.runnerCalls,0);
});

test('SIMULATED: batch read failure prevents the pre-known execution and preserves actual receipts',async t=>{
  const s=setup(t,({number,task})=>{
    if(number===1)return proposal([{tool:'workspace.list',args:{path:'.'}},{tool:'workspace.read',args:{path:'missing.mjs'}},execution]);
    assert.equal(task.corrections.at(-1).failedIndex,1);assert.equal(task.corrections.at(-1).unattempted,1);
    return {...final(),action:'blocked',body:'',reason:'Missing input requires recovery; do not execute.'};
  });
  const r=s.producer();await assert.rejects(s.workers.produce({missionId:'m',node,runId:r.id}),{code:'CAPABILITY'});
  assert.deepEqual(s.store.list('effect').map(r=>r.data.state),['SUCCEEDED','FAILED']);
  assert.equal(s.store.list('execution-job').length,0);assert.equal(s.runnerCalls,0);assert.equal(s.modelCalls,2);
});

test('SIMULATED: read-test batch cannot exceed remaining tool operations',async t=>{
  const s=setup(t,()=>proposal([...reads,execution]),{limits:{maxToolOperations:2}}),r=s.producer();
  await assert.rejects(s.workers.produce({missionId:'m',node,runId:r.id}),{code:'WORKER_LIMIT'});
  assert.equal(s.store.list('effect').length,0);assert.equal(s.runnerCalls,0);
});

test('read-test actors never borrow a learned overlay from the baseline scope',t=>{
  let resolverCalls=0;const s=setup(t,()=>final(),{limits:{learningInstructionsResolver:()=>{resolverCalls++;throw Error('No qualified overlay for this mode');}}});
  const producer=s.producer(),reviewer=s.workers.createRun({missionId:'m',nodeId:'review:build',mode:'reviewer',purpose:node.purpose,roleIds:node.reviewerRoleIds});
  for(const run of [producer,reviewer]){
    const config=s.store.get('worker-config',run.id).data;assert.equal(config.compilationScope.producerBatch,'read-test-v1');
    assert.deepEqual(config.learnedInstructionVersions,[]);
  }
  assert.equal(resolverCalls,0);
});

test('SIMULATED: every batch member reacquires current authority, not just the initial preflight',async t=>{
  const s=setup(t,()=>proposal([{tool:'workspace.list',args:{path:'.'}},execution]));
  const original=s.workers.tool.bind(s.workers);s.workers.tool=async(...args)=>{
    const receipt=await original(...args),m=s.store.get('mission','m');
    m.data.policy.allowedTools=m.data.policy.allowedTools.filter(t=>t!=='execution.run');
    s.store.put('mission','m',m.data,{expectedVersion:m.version});return receipt;
  };
  const r=s.producer();await assert.rejects(s.workers.produce({missionId:'m',node,runId:r.id}),{code:'AUTHORITY_SCOPE'});
  assert.equal(s.store.list('effect').length,1);assert.equal(s.runnerCalls,0);
});

for(const phase of ['after-first-read','before-execution','dispatched-no-result','after-execution-receipt','after-execution-observation'])
test(`REAL process exit / SQLite / native execution where reached: batch recovery at ${phase}`,async t=>{
  const runner=new IsolatedExecutionRunner();if(!runner.available().available){t.skip('Native isolated runner unavailable');return;}
  const directory=mkdtempSync(join(tmpdir(),'sovereign-batch-process-cut-'));
  t.after(()=>rmSync(directory,{recursive:true,force:true}));
  const child=spawnSync(process.execPath,[new URL('./fixtures/producer-batch-controller.mjs',import.meta.url).pathname,directory,phase],
    {timeout:30000,encoding:'utf8',stdio:['ignore','pipe','pipe']});
  assert.equal(child.error,undefined);assert.equal(child.status,86,child.stderr+child.stdout);
  const store=new Store(join(directory,'state.sqlite'));t.after(()=>store.close());
  const authority=new Authority(store),registry=new ArtifactRegistry(store,authority),broker=new ToolBroker({store,authority,workspaceRoot:join(directory,'workspaces'),executionRunner:runner});
  let calls=0;const workers=new WorkerService({store,authority,registry,broker,providerFactory:()=>{calls++;throw Error('Reconciliation must not call a model');}});
  const prior=store.list('run')[0].data,effects=store.list('effect'),jobs=store.list('execution-job'),before=effects.map(e=>({id:e.id,hash:e.hash,version:e.version}));
  assert.equal(store.list('worker-proposal').length,2);assert.equal(store.get('worker-production',prior.id).data.status,'running');
  await assert.rejects(workers.produce({missionId:'m',node:{...node,tools:store.get('mission','m').data.policy.allowedTools},runId:prior.id}),{code:'WORKER_REENTRY'});
  const replacement=workers.createRun({missionId:'m',nodeId:prior.nodeId,mode:'producer',purpose:prior.context.purpose,roleIds:['omega_02']});
  if(phase==='dispatched-no-result'){
    assert.equal(jobs.length,1);assert.equal(jobs[0].data.state,'PREPARED');
    assert.equal(effects.find(e=>e.data.tool==='execution.run').data.state,'DISPATCHED');
    assert.throws(()=>workers.inheritProductionObservations(prior.id,replacement.id),{code:'EFFECT_UNCERTAIN'});
    assert.equal((workers.run(replacement.id).toolObservations??[]).length,0);
  }else{
    const recovered=workers.inheritProductionObservations(prior.id,replacement.id),observed=registry.getToolObservations(replacement.id);
    assert.equal(recovered.operationIds.length,effects.length);assert.equal(observed.length,effects.length);
    assert.ok(observed.every(o=>o.relation==='EXTERNAL_OBSERVATION'&&o.principalId===prior.id));
    const complete=phase.startsWith('after-execution');assert.equal(jobs.length,complete?1:0);
    if(complete){const execution=observed.find(o=>o.tool==='execution.run');
      assert.equal(execution.result.simulation,false);assert.equal(execution.result.exitCode,0);
      assert.equal(execution.result.isolation.programStart.kind,'sovereign.execution.started.v1');
      assert.equal(jobs[0].data.result.isolation.scratchRemoved,true);
      assert.equal(prior.toolObservations.length,phase==='after-execution-receipt'?4:5);
    }
  }
  assert.deepEqual(store.list('effect').map(e=>({id:e.id,hash:e.hash,version:e.version})),before);
  assert.equal(store.list('execution-job').length,jobs.length);assert.equal(store.list('artifact').length,0);assert.equal(calls,0);
  assert.ok(store.verifyJournal());
});

test('SIMULATED: cancellation between listing and execution does not dispatch the command or allow same-run replay',async t=>{
  const controller=new AbortController(),s=setup(t,()=>proposal([{tool:'workspace.list',args:{path:'.'}},execution]));
  const original=s.workers.tool.bind(s.workers);s.workers.tool=async(...args)=>{const receipt=await original(...args);controller.abort();return receipt;};
  const r=s.producer();await assert.rejects(s.workers.produce({missionId:'m',node,runId:r.id,signal:controller.signal}),{code:'CANCELLED'});
  assert.equal(s.store.list('effect').length,1);assert.equal(s.runnerCalls,0);
  await assert.rejects(s.workers.produce({missionId:'m',node,runId:r.id}),{code:'WORKER_REENTRY'});
});

test('REAL isolated files/commands, SIMULATED judge: read-test saves one dispatch, not a tool operation or independent review',async t=>{
  const results=[],baselineSchema=canonical(WORKER_SCHEMA);
  for(const selected of [false,true]){
    const s=setup(t,({request,exposure,task,number})=>{
      if(task.candidateId){
        const own=exposure.toolObservations.filter(o=>o.relation==='OWN_ACTION'&&['workspace.read','execution.run'].includes(o.tool));
        assert.equal(own.length,3);const executed=own.find(o=>o.tool==='execution.run');
        assert.equal(executed.result.simulation,false);assert.equal(executed.result.exitCode,0);assert.match(executed.result.stdout,/EXACT_FIXTURE_PASSED/);
        assert.equal(executed.result.isolation.programStart.kind,'sovereign.execution.started.v1');
        return {artifactHash:task.artifactHash,purpose:task.purpose,decision:'ACCEPT',checks:[{criterionId:'exact',verdict:'PASS',
          evidence:own.map(o=>({kind:'tool',id:o.id,hash:o.hash,quote:o.quoteText})),reason:'SIMULATED fixture checked exact files and own isolated command.'}],findings:[],uncertainty:'Synthetic semantic judge, native actual effects.'};
      }
      if(selected){assert.match(request.schema.description,/read-test-v1/);assert.doesNotMatch(request.schema.description,/no execution\.run or source\.search/);
        assert.doesNotMatch(request.instructions,/Never batch execution\.run/);}
      else assert.equal(canonical(request.schema),baselineSchema);
      if(number===1)return proposal(writes);
      if(number===2)return proposal(selected?[...reads,execution]:reads);
      if(!selected&&number===3)return single(execution);
      assert.equal(exposure.toolObservations.length,5);return final();
    },{native:true,limits:{maxToolOperations:5}});
    if(!s.runner.available().available){t.skip('Native isolated runner unavailable');return;}
    if(!selected){const m=s.store.get('mission','m');delete m.data.policy.producerBatch;s.store.put('mission','m',m.data,{expectedVersion:m.version});}
    const r=s.producer(),a=await s.workers.produce({missionId:'m',node,runId:r.id});
    assert.equal(a.payload.toolReceipts.length,5);assert.equal(a.status,'CANDIDATE');
    const reviewed=await s.workers.review({artifact:a,reviewerRoleIds:node.reviewerRoleIds,missionIntent:intent});
    assert.equal(reviewed.status,'ACCEPTED');assert.notEqual(reviewed.reviewerRunId,r.id);
    assert.equal(s.store.list('effect').length,8);assert.equal(s.store.list('execution-job').length,2);
    for(const [path,content]of Object.entries(contents))assert.equal(readFileSync(join(s.workspace.path,path),'utf8'),content);
    results.push({calls:s.modelCalls,effects:s.store.list('effect').length,inputBytes:s.requests.reduce((n,r)=>n+Buffer.byteLength(r.input),0)});
  }
  assert.equal(results[0].calls,5);assert.equal(results[1].calls,4);assert.ok(results[1].inputBytes<results[0].inputBytes);
  assert.equal(canonical(WORKER_SCHEMA),baselineSchema,'Global baseline schema is not mutated');
  t.diagnostic(JSON.stringify({baseline:results[0],readTest:results[1],scope:'One synthetic trajectory, no measured subscription token saving or general efficiency claim.'}));
});

test('REAL failed isolated test / SIMULATED dishonest producer: batch completion never becomes a passing outcome',async t=>{
  const s=setup(t,({number,exposure})=>{
    if(number===1)return proposal([writes[0],{tool:'workspace.write',args:{...writes[1].args,content:'process.exit(7);\n'}}]);
    if(number===2)return proposal([...reads,execution]);
    assert.equal(number,3,'A known failing independent command must reject before judge inference');
    const observed=exposure.toolObservations.find(o=>o.tool==='execution.run');
    assert.equal(observed.status,'SUCCEEDED');assert.equal(observed.result.exitCode,7);
    return {...final(),body:'DISHONEST FIXTURE: all tests passed.'};
  },{native:true});
  if(!s.runner.available().available){t.skip('Native isolated runner unavailable');return;}
  const r=s.producer(),a=await s.workers.produce({missionId:'m',node,runId:r.id});assert.equal(a.status,'CANDIDATE');
  await assert.rejects(s.workers.review({artifact:a,reviewerRoleIds:node.reviewerRoleIds,missionIntent:intent}),{code:'EXECUTION_FAILED'});
  assert.notEqual(s.store.get('artifact',a.id).data.status,'ACCEPTED');assert.equal(s.modelCalls,3);
  assert.equal(s.store.list('execution-job').length,2);
  assert.ok(s.store.list('execution-job').every(j=>j.data.result.exitCode===7&&j.data.result.simulation===false));
});
