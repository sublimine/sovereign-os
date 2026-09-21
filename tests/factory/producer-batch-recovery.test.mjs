import test from 'node:test';import assert from 'node:assert/strict';
import fs from 'node:fs';import {join} from 'node:path';import {tmpdir} from 'node:os';import {spawnSync} from 'node:child_process';
import {FactoryEngine} from '../../factory/lib/engine.mjs';import {IsolatedExecutionRunner} from '../../factory/tools/execution.mjs';
import {readSourceContextView} from '../../factory/lib/source-context-view.mjs';import {inferenceRequestHash} from '../../factory/providers/instruction-profiles.mjs';
import {producerToolBudget} from '../../factory/lib/producer-tool-budget.mjs';import {readRecoverableProducerBatch} from '../../factory/lib/producer-batch-cursor.mjs';
import {missionInferenceBudget} from '../../factory/lib/mission-inference-budget.mjs';import {ownerProcessIsAlive} from '../../factory/lib/process-identity.mjs';
for(const boundary of ['before-declaration','before-declaration-commit','after-charge','prepared-not-dispatched','after-receipt','before-observation-commit','after-observation','dispatched-no-result'])
test('REAL SIGKILL and full-engine same-producer recovery: '+boundary,async t=>{
  const directory=fs.mkdtempSync(join(tmpdir(),'producer-cursor-engine-'));t.after(()=>fs.rmSync(directory,{recursive:true,force:true}));
  const child=spawnSync(process.execPath,['tests/factory/fixtures/producer-cursor-engine-process.mjs',directory,boundary],{encoding:'utf8',timeout:20000,maxBuffer:1024*1024});
  assert.equal(child.error,undefined,child.stderr);assert.equal(child.status,null,child.stderr);assert.equal(child.signal,'SIGKILL',child.stderr);
  const saved=JSON.parse(fs.readFileSync(join(directory,'fixture.json')));assert.equal(ownerProcessIsAlive({pid:child.pid,processIdentity:saved.owner}),false);
  const runner=new IsolatedExecutionRunner(),engine=new FactoryEngine({databasePath:join(directory,'state.sqlite'),workspaceRoot:join(directory,'workspaces'),executionRunner:runner});
  let calls=0,nativeExecutions=0;const dispatches=[],originalExecute=engine.broker.execute.bind(engine.broker),originalRun=runner.run.bind(runner);
  engine.broker.execute=async request=>{dispatches.push(request);return originalExecute(request);};runner.run=async(...args)=>{nativeExecutions++;return originalRun(...args);};
  try{
    const original=engine.store.list('run').find(r=>r.data.nodeId==='build');assert.ok(original);const runId=original.id;
    assert.equal(missionInferenceBudget(engine.registry,saved.missionId).reserved,4);assert.equal(engine.store.db.prepare('PRAGMA user_version').get().user_version,15);
    const before=readRecoverableProducerBatch(engine.registry,runId);assert.ok(before);
    const beforeDeclaration=boundary.startsWith('before-declaration');
    assert.equal(before.nextIndex,beforeDeclaration?0:boundary==='after-observation'?3:2);
    if(boundary==='after-charge'){
      engine.workers.providerFactory=()=>assert.fail('Changed limits must not buy a response');engine.workers.maxToolOperations=99;
      const limited=await engine.run(saved.missionId);assert.equal(limited.mission.status,'NEEDS_DIRECTION');
      assert.equal(limited.mission.pending[0].code,'WORKER_RECOVERY_LIMITS');assert.equal(dispatches.length,0);
      assert.equal(missionInferenceBudget(engine.registry,saved.missionId).reserved,4);assert.equal(producerToolBudget(engine.registry,runId).used,5);
      engine.workers.maxToolOperations=12; // Exact original configuration, not a new larger allowance.
    }
    engine.workers.providerFactory=()=>({async generate(request){
      calls++;const exposure=readSourceContextView(request.input),task=JSON.parse(exposure.task);let value;
      if(!request.schema.properties.artifactHash){
        assert.equal(calls,1);assert.equal(task.step,2);assert.equal(task.remainingToolOperations,7);assert.equal(exposure.toolObservations.length,5);
        if(boundary==='dispatched-no-result'){
          assert.equal(task.failedMethod,'fixture-exact-arguments');assert.equal(task.corrections.at(-1).code,'BATCH_STOPPED');
          const failed=exposure.toolObservations.find(o=>o.tool==='execution.run');assert.equal(failed.status,'FAILED');
          value={action:'blocked',tool:'',argsJson:'',body:'',claims:[],method:'reconcile-interrupted-execution',reason:'Interrupted execution has no completed result; do not replay it or certify success.'};
        }else value={action:'final',tool:'',argsJson:'',body:'Exact native files and original observed test are preserved. Independent review remains required.',claims:[],method:'observed-original-result',reason:''};
      }else{
        assert.equal(calls,2);const own=exposure.toolObservations.filter(o=>o.relation==='OWN_ACTION');assert.equal(own.length,3);
        const executed=own.find(o=>o.tool==='execution.run');assert.equal(executed.result.exitCode,0);assert.match(executed.result.stdout,/CURSOR_NATIVE_PASS/);
        assert.equal(executed.result.simulation,false);assert.notEqual(executed.principalId,runId);
        value={artifactHash:task.artifactHash,purpose:task.purpose,decision:'ACCEPT',checks:task.criteria.map(c=>({criterionId:c.id,verdict:'PASS',
          evidence:own.map(o=>({kind:'tool',id:o.id,hash:o.hash,quote:o.quoteText})),reason:'SIM independent semantic judgment using actual own reads and test.'})),findings:[],uncertainty:'Simulated model; actual independent native effects.'};
      }
      await request.validate(value);return {value,receipt:{kind:'inference',simulation:true,status:'completed',threadId:'sim-cursor-parent-'+calls,turnId:'sim-parent-turn-'+calls,
        model:request.model,reasoningEffort:request.reasoningEffort,contextHash:inferenceRequestHash(request)}};
    },async close(){}});
    const result=await engine.run(saved.missionId);
    assert.equal(engine.store.list('run').filter(r=>r.data.nodeId==='build').length,1,'Coordinator must keep the original producer');
    assert.equal(producerToolBudget(engine.registry,runId).used,5);
    if(boundary==='dispatched-no-result'){
      assert.notEqual(result.mission.status,'COMPLETED');assert.equal(calls,1);assert.equal(nativeExecutions,0);assert.equal(dispatches.length,0);
      const execution=engine.store.list('effect').find(r=>r.data.tool==='execution.run');assert.equal(execution.data.state,'FAILED');
      assert.equal(execution.data.receipt.data.result.error.code,'EXECUTION_INTERRUPTED');assert.equal(engine.store.list('artifact').filter(r=>r.data.payload.nodeId==='build').length,0);
    }else{
      assert.equal(result.mission.status,'COMPLETED',JSON.stringify(result.mission.pending));assert.equal(calls,2);
      assert.equal(nativeExecutions,beforeDeclaration||['after-charge','prepared-not-dispatched'].includes(boundary)?2:1);
      assert.equal(engine.store.list('effect').length,8);assert.equal(engine.store.list('execution-job').length,2);
      assert.equal(dispatches.filter(r=>r.principalId===runId).length,beforeDeclaration?3:['after-charge','prepared-not-dispatched'].includes(boundary)?1:0);
      // Reentry still acquires/releases the coordinator lease. Those ownership
      // events legitimately change the journal; material work must not change.
      const materialTypes=['mission','node','run','worker-production','worker-proposal','producer-cleanup','producer-tool-budget','producer-tool-charge','producer-batch-cursor','artifact','review','effect','execution-job','mission-inference-call'];
      const material=()=>Object.fromEntries(materialTypes.map(type=>[type,engine.store.list(type)]));
      const beforeReentry=material(),dispatchCount=dispatches.length,executionCount=nativeExecutions;
      assert.equal((await engine.run(saved.missionId)).mission.status,'COMPLETED');assert.equal(calls,2);assert.deepEqual(material(),beforeReentry);
      assert.equal(dispatches.length,dispatchCount);assert.equal(nativeExecutions,executionCount);
    }
    engine.store.verifyJournal();
  }finally{engine.close();}
});
