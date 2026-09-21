import test from 'node:test';
import assert from 'node:assert/strict';
import {Store} from '../../factory/lib/store.mjs';
import {Authority} from '../../factory/lib/authority.mjs';
import {ArtifactRegistry} from '../../factory/lib/artifacts.mjs';
import {sha256,canonical} from '../../factory/lib/contracts.mjs';
import {executionHistory} from '../../factory/lib/execution-history.mjs';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {WorkerService} from '../../factory/lib/workers.mjs';
import {ToolBroker} from '../../factory/tools/broker.mjs';
import {IsolatedExecutionRunner} from '../../factory/tools/execution.mjs';
import {readSourceContextView} from '../../factory/lib/source-context-view.mjs';
import {inferenceRequestHash} from '../../factory/providers/instruction-profiles.mjs';

// Synthetic receipt/data fixtures in real in-memory SQLite. They validate the
// contract only: no provider, native program, filesystem or historical mission.
function fixture(t){
  const store=new Store(':memory:');t.after(()=>store.close());
  const authority=new Authority(store),registry=new ArtifactRegistry(store,authority);
  store.put('mission','m',{intent:'Audit the complete scoped execution history.',intentHash:sha256('Audit the complete scoped execution history.')},{expectedVersion:0});
  const run=(nodeId='review:n',missionId='m')=>registry.registerRun({missionId,nodeId,mode:'reviewer',context:{purpose:'audit',
    artifactIds:[],sourceIds:[],instructionsHash:sha256('Synthetic complete role'),producerConversationIncluded:false}});
  const effect=(operationId,principalId,{state='SUCCEEDED',missionId='m',argv=['node','--test','probe.test.mjs'],cwd='.',job=false}={})=>{
    const args={argv,cwd},binding={missionId,principalId,tool:'execution.run',argsHash:sha256(args)};
    const base={...binding,state,startedAt:'2026-09-13T12:00:00.000Z'},manifest=[];
    const result={schema:'sovereign.execution.v1',simulation:false,mode:'snapshot-discard',argv,cwd,exitCode:0,
      stdout:'synthetic stdout\n',stderr:'',stdoutSha256:sha256('synthetic stdout\n'),stderrSha256:sha256(''),
      outputTruncated:false,manifest,snapshotHash:sha256(manifest),
      isolation:{enforced:true,processesTerminated:true,scratchRemoved:true,network:false,cleanEnvironment:true}};
    const signed=['SUCCEEDED','FAILED'].includes(state)?authority.seal('tool.receipt',{id:operationId,...binding,status:state,
      result:state==='SUCCEEDED'?result:{error:{code:'EXECUTION_START'}},startedAt:base.startedAt,completedAt:'2026-09-13T12:00:01.000Z'}):null;
    const record=store.put('effect',operationId,{...base,...(signed?{receipt:signed}:{})},{expectedVersion:0});
    if(job)store.put('execution-job',operationId,{...binding,args,manifest,snapshotHash:sha256(manifest),
      mode:'snapshot-discard',state:state==='SUCCEEDED'?'COMPLETED':'FAILED',...(state==='SUCCEEDED'?{result}:{}),
      ...(state==='FAILED'?{failure:{code:'EXECUTION_START'}}:{})},{expectedVersion:0});
    return {record,signed,result,args};
  };
  const history=runId=>{
    registry.captureRuntimeObservations(runId);
    const actor=store.get('run',runId).data,observation=actor.runtimeObservations.find(o=>o.kind==='execution-history');
    assert.ok(observation,'New reviewer must receive execution history, not only effect IDs');
    return {actor,observation,data:JSON.parse(observation.quoteText)};
  };
  return {store,authority,registry,run,effect,history};
}

test('prior reviewer execution arguments reach a new reviewer as authenticated history, not OWN_ACTION',t=>{
  const s=fixture(t),previous=s.run(),current=s.run(),operation=s.effect('old-review-test',previous.id,{job:true});
  const {actor,observation,data}=s.history(current.id),row=data.detail.effects[0];
  assert.equal(data.detail.version,'execution-history-v1');assert.equal(data.detail.effects.length,1);
  assert.equal(row.id,'old-review-test');assert.equal(row.principalId,previous.id);
  assert.deepEqual(row.recordedArgs,operation.args);assert.equal(row.receiptHash,sha256(operation.signed));
  assert.equal(row.recordedResult.snapshotHash,operation.result.snapshotHash);assert.equal(row.recordedResult.exitCode,0);
  assert.equal(row.recordedResult.stdoutSha256,sha256('synthetic stdout\n'));
  assert.equal(Object.hasOwn(row.recordedResult,'stdout'),false,'No unnecessary repeated output body');
  assert.equal((actor.toolObservations??[]).length,0,'History grants no action identity');
  assert.ok(s.registry.runtimeReference({id:observation.id,hash:observation.hash,quote:'probe.test.mjs'},actor));
});

test('an uncertain intent without retained arguments remains explicitly unknown',t=>{
  const s=fixture(t),old=s.run(),current=s.run();s.effect('uncertain-test',old.id,{state:'UNCERTAIN'});
  const {data}=s.history(current.id),row=data.detail.effects[0];
  assert.equal(row.state,'UNCERTAIN');assert.equal(row.recordedArgs,null);assert.equal(row.receiptHash,null);
  assert.equal(row.recordedResult,null);assert.equal(row.argumentOrigin,'UNAVAILABLE');
});

test('successful legacy receipt without a job exposes only what was actually recorded',t=>{
  const s=fixture(t),old=s.run(),current=s.run();s.effect('legacy',old.id);
  const row=s.history(current.id).data.detail.effects[0];
  assert.equal(row.argumentOrigin,'COMPLETED_RECEIPT');assert.equal(row.jobRecord,null);
  assert.equal(Object.hasOwn(row.recordedResult,'programStart'),false,'No retroactive post-exec proof');
});

test('failed signed operation keeps its actual failure and recorded job arguments, never exit zero',t=>{
  const s=fixture(t),old=s.run(),current=s.run();s.effect('failed',old.id,{state:'FAILED',job:true});
  const row=s.history(current.id).data.detail.effects[0];
  assert.equal(row.state,'FAILED');assert.equal(row.argumentOrigin,'RECORDED_JOB');
  assert.deepEqual(row.recordedArgs,{argv:['node','--test','probe.test.mjs'],cwd:'.'});
  assert.equal(row.recordedResult.errorCode,'EXECUTION_START');assert.equal(row.recordedResult.outcomeKnown,null);
  assert.equal(Object.hasOwn(row.recordedResult,'exitCode'),false);
});

test('history is mission-scoped and does not add empty observations',t=>{
  const s=fixture(t),current=s.run();s.effect('private-other','foreign-actor',{missionId:'other',argv:['node','private.mjs']});
  assert.equal(executionHistory(s.registry,'m'),null);
  s.registry.captureRuntimeObservations(current.id);
  assert.equal(s.store.get('run',current.id).data.runtimeObservations.some(o=>o.kind==='execution-history'),false);
  s.effect('local',current.id);const data=s.history(current.id).data;
  assert.deepEqual(data.detail.effects.map(e=>e.id),['local']);assert.equal(canonical(data).includes('private.mjs'),false);
});

test('planning and ordinary producers receive no new execution-history grant',t=>{
  const s=fixture(t),old=s.run(),planner=s.run('review:planning');s.effect('prior',old.id);
  const producer=s.registry.registerRun({missionId:'m',nodeId:'n',mode:'producer',context:{purpose:'audit',artifactIds:[],sourceIds:[],
    instructionsHash:sha256('producer'),producerConversationIncluded:false}});
  for(const actor of [planner,producer]){
    s.registry.captureRuntimeObservations(actor.id);
    assert.equal((s.store.get('run',actor.id).data.runtimeObservations??[]).some(o=>o.kind==='execution-history'),false);
  }
});

test('unrelated commits and another mission do not duplicate an unchanged history exposure',t=>{
  const s=fixture(t),old=s.run(),current=s.run();s.effect('prior',old.id,{job:true});
  const first=s.history(current.id).data.detail;
  s.store.append('fixture.unrelated',{value:1});s.effect('other-mission','foreign',{missionId:'other'});
  const second=s.history(current.id);
  assert.equal(second.actor.runtimeObservations.filter(o=>o.kind==='execution-history').length,1);
  assert.deepEqual(second.data.detail,first);
});

test('a later execution makes the old current proof stale but does not rewrite its historical cutoff',t=>{
  const s=fixture(t),old=s.run(),current=s.run();s.effect('first',old.id);
  const {actor,observation,data}=s.history(current.id),proof={id:observation.id,hash:observation.hash,quote:'probe.test.mjs'};
  s.effect('later',old.id,{argv:['node','another.mjs']});
  assert.throws(()=>s.registry.runtimeReference(proof,actor),{code:'STALE_RUNTIME'});
  assert.deepEqual(s.registry.runtimeReference(proof,actor,{current:false}).detail,data.detail);
  assert.equal(s.history(current.id).actor.runtimeObservations.filter(o=>o.kind==='execution-history').length,2);
});

test('historical uncertain version stays unknown after a later signed completion',t=>{
  const s=fixture(t),old=s.run(),current=s.run();s.effect('pending',old.id,{state:'UNCERTAIN'});
  const {actor,observation,data}=s.history(current.id),proof={id:observation.id,hash:observation.hash,quote:'UNAVAILABLE'};
  const complete=s.effect('template',old.id),prior=s.store.get('effect','pending');
  const receipt=s.authority.seal('tool.receipt',{...complete.signed.data,id:'pending'});
  s.store.put('effect','pending',{...prior.data,state:'SUCCEEDED',receipt},{expectedVersion:prior.version});
  assert.deepEqual(s.registry.runtimeReference(proof,actor,{current:false}).detail,data.detail);
  assert.equal(data.detail.effects[0].recordedArgs,null);
  assert.equal(executionHistory(s.registry,'m').effects.find(e=>e.id==='pending').argumentOrigin,'COMPLETED_RECEIPT');
});

test('a history quote cannot be relabeled as an independent tool receipt',t=>{
  const s=fixture(t),old=s.run(),current=s.run();s.effect('prior',old.id);
  const {actor,observation}=s.history(current.id);
  assert.throws(()=>s.registry.toolReference({id:observation.id,hash:observation.hash,quote:'probe.test.mjs'},actor),{code:'UNOBSERVED_TOOL'});
});

test('pending inference forbids adding a historical exposure',t=>{
  const s=fixture(t),old=s.run(),current=s.run();s.effect('prior',old.id);
  const prior=s.store.get('run',current.id);s.store.put('run',current.id,{...prior.data,expectedRequestHash:sha256('pending')},{expectedVersion:prior.version});
  assert.throws(()=>s.registry.captureRuntimeObservations(current.id),{code:'INFERENCE_PENDING'});
});

test('bad receipt signature is rejected without any partial runtime observation commit',t=>{
  const s=fixture(t),old=s.run(),current=s.run(),effect=s.effect('forged',old.id);
  const bad=structuredClone(effect.record.data);bad.receipt.signature.value='0'.repeat(64);
  s.store.put('effect','forged',bad,{expectedVersion:effect.record.version});const before=s.store.verifyJournal();
  assert.throws(()=>s.registry.captureRuntimeObservations(current.id),{code:'BAD_SIGNATURE'});
  assert.deepEqual(s.store.verifyJournal(),before);assert.equal(s.store.list('runtime-observation').length,0);
});

test('completed effect without a receipt cannot become an observed execution',t=>{
  const s=fixture(t),old=s.run(),current=s.run(),effect=s.effect('absent',old.id);
  const {receipt,...bare}=effect.record.data;s.store.put('effect','absent',bare,{expectedVersion:effect.record.version});
  assert.throws(()=>s.history(current.id),{code:'EXECUTION_HISTORY'});
});

for(const field of ['args','principal','snapshot'])test(`historical job ${field} mismatch is rejected`,t=>{
  const s=fixture(t),old=s.run(),current=s.run();s.effect('bad-job',old.id,{job:true});
  const job=s.store.get('execution-job','bad-job'),bad=structuredClone(job.data);
  if(field==='args')bad.args.argv=['node','different.mjs'];
  if(field==='principal')bad.principalId='different-actor';
  if(field==='snapshot')bad.snapshotHash='0'.repeat(64);
  s.store.put('execution-job','bad-job',bad,{expectedVersion:job.version});
  assert.throws(()=>s.history(current.id),{code:'EXECUTION_HISTORY'});
});

test('signed successful result argv must match the argument hash, not only a valid JSON shape',t=>{
  const s=fixture(t),old=s.run(),current=s.run(),effect=s.effect('bad-argv',old.id);
  const data={...effect.signed.data,result:{...effect.result,argv:['node','different.mjs']}};
  s.store.put('effect','bad-argv',{...effect.record.data,receipt:s.authority.seal('tool.receipt',data)},{expectedVersion:effect.record.version});
  assert.throws(()=>s.history(current.id),{code:'EXECUTION_HISTORY'});
});

test('individually valid but different job and completed-result snapshots cannot share one historical proof',t=>{
  const s=fixture(t),old=s.run(),current=s.run();s.effect('split-snapshot',old.id,{job:true});
  const job=s.store.get('execution-job','split-snapshot'),manifest=[{type:'file',path:'different.txt',bytes:1,sha256:sha256('x')}];
  s.store.put('execution-job','split-snapshot',{...job.data,manifest,snapshotHash:sha256(manifest)},{expectedVersion:job.version});
  assert.throws(()=>s.history(current.id),{code:'EXECUTION_HISTORY'});
});

test('historical cutoff reconstruction covers more than one journal page',t=>{
  const s=fixture(t),old=s.run(),current=s.run();s.effect('early',old.id);
  for(let i=0;i<1005;i++)s.store.append('fixture.padding',{i});
  s.effect('late',old.id);const {actor,observation,data}=s.history(current.id);
  assert.deepEqual(data.detail.effects.map(e=>e.id),['early','late']);
  assert.ok(s.registry.runtimeReference({id:observation.id,hash:observation.hash,quote:'probe.test.mjs'},actor));
});

test('future, wrong-hash and malformed cutoffs fail without writing',t=>{
  const s=fixture(t),old=s.run();s.effect('one',old.id);const history=executionHistory(s.registry,'m'),before=s.store.verifyJournal();
  for(const cutoff of [{...history.cutoff,seq:history.cutoff.seq+100}, {...history.cutoff,hash:'0'.repeat(64)},
    {seq:0,hash:history.cutoff.hash},{...history.cutoff,extra:true}])assert.throws(()=>executionHistory(s.registry,'m',{cutoff}));
  assert.deepEqual(s.store.verifyJournal(),before);
});

for(const mutation of ['omit-operation','change-arguments','wrong-cutoff'])test(`a freshly signed but false history projection is rejected: ${mutation}`,t=>{
  const s=fixture(t),old=s.run(),current=s.run();s.effect('first',old.id);s.effect('second',old.id);
  const {data}=s.history(current.id),forged=structuredClone(data);forged.id='runtime-observation:forged';
  if(mutation==='omit-operation')forged.detail.effects.pop();
  if(mutation==='change-arguments')forged.detail.effects[0].recordedArgs.argv=['node','false.mjs'];
  if(mutation==='wrong-cutoff')forged.detail.cutoff.hash='0'.repeat(64);
  const signed=s.authority.seal('runtime.observation',forged);
  s.store.put('runtime-observation',forged.id,{signed},{expectedVersion:0});
  const observation={id:forged.id,hash:sha256(signed),kind:forged.kind,quoteText:canonical(forged)},row=s.store.get('run',current.id);
  s.store.put('run',current.id,{...row.data,runtimeObservations:[...row.data.runtimeObservations,observation]},{expectedVersion:row.version});
  assert.throws(()=>s.registry.runtimeReference({id:observation.id,hash:observation.hash,quote:'execution-history-v1'},s.store.get('run',current.id).data,{current:false}));
});

for(const mismatch of [false,true])test(`REAL isolated commands / SIMULATED semantic review: prior review scope ${mismatch?'mismatch is retained':'is fully exposed'}`,async t=>{
  const runner=new IsolatedExecutionRunner();
  if(!runner.available().available){t.skip('Native isolated execution unavailable');return;}
  const directory=mkdtempSync(join(tmpdir(),'sovereign-execution-history-')),store=new Store(':memory:');
  t.after(()=>{store.close();rmSync(directory,{recursive:true,force:true});});
  const authority=new Authority(store),registry=new ArtifactRegistry(store,authority),
    broker=new ToolBroker({store,authority:authority,workspaceRoot:join(directory,'workspace'),executionRunner:runner});
  const intent='Audit exactly the authorized command, including previous reviewers. Historical metadata alone is insufficient.',
    args={argv:['node','-e',"process.stdout.write('scope fixture')"],cwd:'.'},purpose='command-scope';
  store.put('mission','m',{intent,intentHash:sha256(intent),policy:{allowedTools:['execution.run'],model:'gpt-6-astra',reasoningEffort:'ultra'}},{expectedVersion:0});
  broker.registerWorkspace('m');let calls=0,previousId,ownId;
  const workers=new WorkerService({store,authority,registry,broker,providerFactory:()=>({
    async generate(request){
      calls++;const context=readSourceContextView(request.input),task=JSON.parse(context.task);
      const observation=context.runtimeObservations.find(o=>o.kind==='execution-history');assert.ok(observation);
      const detail=JSON.parse(observation.quoteText).detail;
      assert.equal(detail.effects.length,3,'Producer, former reviewer and this reviewer executions');
      const previous=detail.effects.find(e=>e.id===previousId);assert.ok(previous);
      assert.equal(context.toolObservations.some(o=>o.id===previousId),false,'Not inherited as this reviewer action');
      const own=context.toolObservations.find(o=>o.relation==='OWN_ACTION'&&o.tool==='execution.run');assert.ok(own);ownId=own.id;
      assert.notEqual(previous.principalId,own.principalId);
      assert.equal(own.result.simulation,false);assert.equal(own.result.isolation.programStart.kind,'sovereign.execution.started.v1');
      const scopeMatches=detail.effects.every(e=>canonical(e.recordedArgs)===canonical(args));
      assert.equal(scopeMatches,!mismatch);
      const value={artifactHash:task.artifactHash,purpose:task.purpose,decision:scopeMatches?'ACCEPT':'RETURN',
        checks:[{criterionId:'scope',verdict:scopeMatches?'PASS':'UNKNOWN',evidence:[
          {kind:'runtime',id:observation.id,hash:observation.hash,quote:canonical(previous)},
          {kind:'tool',id:own.id,hash:own.hash,quote:own.quoteText}],
        reason:scopeMatches?'SIMULATED judge: every actual recorded command matches the fixture authority.'
          :'SIMULATED judge: previous reviewer command differs; a new correct command does not erase it.'}],
        findings:scopeMatches?[]:[{severity:'material',description:'Prior recorded command differs.',recovery:'Preserve and investigate the prior event; never replace it with a fresh successful execution.'}],
        uncertainty:'Semantic judgment is a test fixture; the three isolated executions and broker receipts are real.'};
      await request.validate(value);
      return {value,receipt:{kind:'inference',status:'completed',simulation:true,threadId:'simulated-scope-review',turnId:'simulated-turn',
        model:request.model,reasoningEffort:request.reasoningEffort,contextHash:inferenceRequestHash(request)}};
    },async close(){}
  })});
  const producer=registry.registerRun({missionId:'m',nodeId:'n',mode:'producer',context:{purpose,artifactIds:[],sourceIds:[],
    instructionsHash:sha256('Synthetic producer message, actual command'),producerConversationIncluded:false}});
  const produced=await workers.tool(producer.id,'execution.run',args,producer.id+':test');
  assert.equal(produced.result.isolation.programStart.kind,'sovereign.execution.started.v1');
  registry.attachInference(producer.id,{status:'completed',simulation:true,threadId:'simulated-producer',turnId:'simulated-turn'});
  const candidate=registry.create({missionId:'m',nodeId:'n',producerRunId:producer.id,kind:'answer',purpose,
    body:'Actual authorized command executed; independent historical scope review remains required.',claims:[],
    criteria:[{id:'scope',text:intent}],toolReceipts:[store.get('effect',producer.id+':test').data.receipt],
    requiredEffects:[{type:'execution',path:'.',command:JSON.stringify(args.argv),expectedExit:0}]});
  const previous=registry.registerRun({missionId:'m',nodeId:'review:n',mode:'reviewer',context:{purpose,artifactIds:[candidate.id],sourceIds:[],
    instructionsHash:sha256('Prior reviewer whose inference did not complete'),producerConversationIncluded:false}});
  previousId=previous.id+':test';
  const priorArgs=mismatch?{argv:['node','-e',"process.stdout.write('different prior scope')"],cwd:'.'}:args;
  await workers.tool(previous.id,'execution.run',priorArgs,previousId);
  const reviewed=await workers.review({artifact:candidate,reviewerRoleIds:['omega_22'],missionIntent:intent});
  assert.equal(reviewed.status,mismatch?'RETURNED':'ACCEPTED');assert.equal(calls,1);
  assert.equal(store.list('effect').length,3);assert.equal(store.list('execution-job').length,3);
  assert.equal(store.list('run').length,3);assert.ok(ownId);
  assert.equal(store.get('effect',previousId).data.receipt.data.result.argv[2],priorArgs.argv[2]);
});
