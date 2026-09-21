import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fork} from 'node:child_process';
import {setTimeout as delay} from 'node:timers/promises';
import {Store} from '../../factory/lib/store.mjs';
import {Authority} from '../../factory/lib/authority.mjs';
import {ArtifactRegistry} from '../../factory/lib/artifacts.mjs';
import {WorkerService} from '../../factory/lib/workers.mjs';
import {FactoryEngine} from '../../factory/lib/engine.mjs';
import {ToolBroker} from '../../factory/tools/broker.mjs';
import {IsolatedExecutionRunner} from '../../factory/tools/execution.mjs';
import {sha256} from '../../factory/lib/contracts.mjs';

const native = new IsolatedExecutionRunner();
const real = {skip: native.available().available ? false : 'Native isolated execution infrastructure unavailable'};
const code = 'import assert from "node:assert/strict"; assert.equal(6*7,42); console.log("TESTED 42");\n';
const intent = 'Deliver check.mjs and run it, independently verifying that its assertions pass.';
const command = {argv: ['node', 'check.mjs'], cwd: '.'};
const effects = [{type: 'file', path: 'check.mjs', command: '', expectedExit: null},
  {type: 'execution', path: '.', command: JSON.stringify(command.argv), expectedExit: 0}];
const proposal = (tool = '', args = {}) => ({action: tool ? 'tool' : 'final', tool, argsJson: tool ? JSON.stringify(args) : '',
  body: tool ? '' : 'Delivered check.mjs with observed assertions.', claims: [], method: 'observed-code', reason: ''});
function plan(originalRequest) {
  return {requirements: [{id: 'r1', text: intent, requestQuote: originalRequest, criteria: [{id: 'pass', text: intent}]}],
    nodes: [{id: 'code', title: 'Tested code', purpose: 'delivery', roleIds: ['sigma_01'], reviewerRoleIds: ['sigma_02'],
      requirementIds: ['r1'], dependencies: [], method: {id: 'code-test', rationale: 'Run assertions against delivered bytes', alternatives: ['Independent rewrite with counterexamples']},
      instructions: intent, outputKind: 'delivery', criteria: [{id: 'pass', text: intent}], requiredEffects: effects,
      tools: ['workspace.write', 'workspace.read', 'execution.run'], specialist: null}], finalNodeId: 'code',
    routingRationale: 'One delivered product with a separate reviewer and actual post-candidate execution'};
}
function fixtureReview(exposure, task, {producerOnly = false, omitExecution = false,producerHistory=false,historyOnly=false} = {}) {
  const a = exposure.artifacts.find(a => a.id === task.candidateId);
  const observed = exposure.toolObservations.filter(o => o.status === 'SUCCEEDED' &&
    (o.tool === 'workspace.read' && o.relation === 'OWN_ACTION' || o.tool === 'execution.run' && !omitExecution
      && o.relation === (producerOnly ? 'EXTERNAL_OBSERVATION' : 'OWN_ACTION')));
  const evidence = [{kind: 'artifact', id: a.id, hash: a.hash, quote: a.payload.body},
    ...observed.map(o => ({kind: 'tool', id: o.id, hash: o.hash, quote: o.quoteText}))];
  if(producerHistory)evidence.push(...exposure.toolObservations.filter(o=>o.tool==='execution.run'&&o.relation==='EXTERNAL_OBSERVATION')
    .map(o=>({kind:'tool-history',id:o.id,hash:o.hash,quote:o.quoteText})));
  if(historyOnly)for(const e of evidence)if(e.kind==='tool'&&exposure.toolObservations.find(o=>o.id===e.id)?.tool==='execution.run')e.kind='tool-history';
  return {artifactHash: a.hash, purpose: a.payload.purpose, decision: 'ACCEPT',
    checks: task.criteria.map(c => ({criterionId: c.id, verdict: 'PASS', evidence, reason: 'Synthetic reviewer fixture cites actual independent observations'})),
    findings: [], uncertainty: 'Inference is explicitly simulated in this regression; native execution is real.'};
}
function setup(t, {reviewOptions = {}, mutateOnReview = false, inputCode = code, repairAfterReturn = false} = {}) {
  const dir = fs.mkdtempSync(join(tmpdir(), 'factory-exec-integration-'));
  const store = new Store(join(dir, 'state.sqlite')), authority = new Authority(store), registry = new ArtifactRegistry(store, authority);
  const config = {store, authority, workspaceRoot: join(dir, 'workspaces'), executionRunner: native};
  const broker = new ToolBroker(config); let count = 0;
  const providerFactory = () => ({async generate(request) {
    const exposure = JSON.parse(request.input), task = JSON.parse(exposure.task); count++;
    assert.equal(exposure.runtimeCapabilities.isolatedCodeRunner, true);
    assert.equal(exposure.runtimeCapabilities.executionMode, 'snapshot-discard');
    assert.ok(!request.instructions.includes('No accredited execution runner is available'));
    let value;
    if (Object.hasOwn(request.schema.properties, 'requirements')) {
      assert.equal(task.runtimeCapabilities.isolatedCodeRunner, true); value = plan(task.originalRequest);
    } else if (Object.hasOwn(request.schema.properties, 'artifactHash')) {
      value = fixtureReview(exposure, task, task.purpose === 'plan' ? {} : reviewOptions);
      if (mutateOnReview && task.purpose !== 'plan') {
        const a = exposure.artifacts.find(a => a.id === task.candidateId);
        fs.writeFileSync(join(broker.workspace(a.payload.missionId), 'unlisted.txt'), 'unreviewed addition');
      }
    } else if (task.step === 0) {
      const repairing=repairAfterReturn&&task.feedback.some(f=>f.code==='EXECUTION_FAILED');
      value = proposal('workspace.write', {path: 'check.mjs', content: repairing?code:inputCode, expectedHash: repairing?sha256(inputCode):null});
    }
    else if (task.step === 1) value = proposal('execution.run', command);
    else value = proposal();
    await request.validate(value);
    return {value, receipt: {kind: 'inference', simulation: true, status: 'completed', threadId: `sim-${count}`, turnId: `turn-${count}`,
      model: request.model, reasoningEffort: request.reasoningEffort,
      contextHash: sha256(JSON.stringify({instructions: request.instructions, input: request.input, schema: request.schema, model: request.model, reasoningEffort: request.reasoningEffort}))}};
  }, async close() {}});
  const workers = new WorkerService({store, authority, registry, broker, providerFactory});
  const engine = new FactoryEngine({store, authority, registry, broker, workers});
  t.after(() => { engine.close(); fs.rmSync(dir, {recursive: true}); });
  return {store, authority, registry, broker, workers, engine, config, get count() { return count; }};
}
function request(s, tool = 'execution.run', args = command, operationId = 'test-execution') {
  return {missionId: 'test-mission', principalId: 'test-worker', operationId, tool, args,
    lease: s.authority.issue({missionId: 'test-mission', principalId: 'test-worker', actions: [tool],
      resources: ['workspace:test-mission'], classification: 'INTERNAL', expiresAt: new Date(Date.now() + 60000).toISOString()})};
}
test('REAL execution / SIMULATED inference: full plan→file→execution→independent rerun→accepted delivery', real, async t => {
  const s = setup(t), m = s.engine.create(intent), result = await s.engine.run(m.id);
  assert.equal(result.mission.status, 'COMPLETED', JSON.stringify(result.mission.pending));
  const jobs = s.store.list('execution-job'); assert.equal(jobs.length, 2);
  assert.ok(jobs.every(j => j.data.state === 'COMPLETED' && j.data.result.simulation === false && j.data.result.stdout === 'TESTED 42\n'));
  assert.ok(jobs.every(j => j.data.result.isolation.programStart?.kind === 'sovereign.execution.started.v1'
    && j.data.result.isolation.programStart.snapshotHash === j.data.snapshotHash));
  assert.notEqual(jobs[0].data.principalId, jobs[1].data.principalId);
  assert.equal(jobs[0].data.snapshotHash, jobs[1].data.snapshotHash);
  assert.equal(fs.readFileSync(join(s.broker.workspace(m.id), 'check.mjs'), 'utf8'), code);
  const calls = s.count; assert.equal((await s.engine.run(m.id)).mission.status, 'COMPLETED');
  assert.equal(s.count, calls); assert.equal(s.store.list('execution-job').length, 2);
  fs.writeFileSync(join(s.broker.workspace(m.id), 'extra.txt'), 'workspace changed');
  const changed = await s.engine.run(m.id);
  assert.equal(changed.mission.status, 'UNVERIFIED','Public status must quarantine a formerly accepted delivery once its current workspace proof fails');
  assert.deepEqual(changed.mission.pending,[],'The public projection does not expose raw recovery detail through a stale delivery claim');
  const durableMission=s.store.get('mission',m.id).data;
  assert.equal(durableMission.status,'NEEDS_DIRECTION');assert.equal(durableMission.pending[0].code,'WORKSPACE_CHANGED');
});
test('REAL execution: explicit producer history and independent current proof may jointly establish two observed executions',real,async t=>{
  const s=setup(t,{reviewOptions:{producerHistory:true}}),m=s.engine.create(intent),result=await s.engine.run(m.id);
  assert.equal(result.mission.status,'COMPLETED',JSON.stringify(result.mission.pending));
  const finalArtifact=s.store.get('artifact',result.mission.finalArtifactId).data,
    verdict=s.store.get('review',finalArtifact.reviews.at(-1)).data.result;
  assert.ok(verdict.checks.some(c=>c.evidence.some(e=>e.kind==='tool-history')));
  assert.ok(verdict.checks.some(c=>c.evidence.some(e=>e.kind==='tool'&&e.id.includes(':reexecute:'))));
  assert.ok(s.registry.assertUsable(result.outcome.id,{missionId:m.id,purpose:'delivery'}));
});
test('REAL execution: producer receipt cannot replace independently cited reviewer execution', real, async t => {
  for (const reviewOptions of [{producerOnly: true}, {omitExecution: true}, {producerHistory:true,historyOnly:true}]) {
    await t.test(JSON.stringify(reviewOptions), async t => {
      const s = setup(t, {reviewOptions}), m = s.engine.create(intent, {maxNodeAttempts: 1}), result = await s.engine.run(m.id);
      assert.notEqual(result.mission.status, 'COMPLETED');
      assert.ok(s.store.list('node')[0].data.history.some(h => ['EXECUTION_PROOF', 'TOOL_ACTOR'].includes(h.detail?.code)));
    });
  }
});
test('REAL execution: dishonest PASS for exit 9 never satisfies expectedExit 0', real, async t => {
  const s = setup(t, {inputCode: 'process.exit(9);\n'}), m = s.engine.create(intent, {maxNodeAttempts: 1});
  const result = await s.engine.run(m.id); assert.notEqual(result.mission.status, 'COMPLETED');
  assert.ok(s.store.list('execution-job').every(j => j.data.result.exitCode === 9));
  assert.ok(s.store.list('node')[0].data.history.some(h => h.detail?.code === 'EXECUTION_FAILED'));
  assert.equal(s.store.list('effect-rejection').length,1);
  assert.equal(s.store.list('artifact').find(a=>a.data.payload.nodeId==='code').data.status,'RETURNED');
});
test('REAL execution: observed failing tests return to a new producer for repair, not another review of unchanged code',real,async t=>{
  const s=setup(t,{inputCode:'process.exit(9);\n',repairAfterReturn:true}),m=s.engine.create(intent,{maxNodeAttempts:2});
  const result=await s.engine.run(m.id);
  assert.equal(result.mission.status,'COMPLETED',JSON.stringify(result.mission.pending));
  const candidates=s.store.list('artifact').filter(a=>a.data.payload.nodeId==='code');
  assert.equal(candidates.length,2);assert.equal(candidates.filter(a=>a.data.status==='RETURNED').length,1);
  assert.equal(candidates.filter(a=>a.data.status==='ACCEPTED').length,1);
  assert.equal(s.store.list('execution-job').length,4);
  assert.equal(fs.readFileSync(join(s.broker.workspace(m.id),'check.mjs'),'utf8'),code);
});
test('REAL execution: any input-manifest change after reviewer rerun rejects acceptance', real, async t => {
  const s = setup(t, {mutateOnReview: true}), m = s.engine.create(intent, {maxNodeAttempts: 1});
  const result = await s.engine.run(m.id);
  assert.equal(result.mission.status, 'NEEDS_DIRECTION'); assert.equal(result.mission.pending[0].code, 'WORKSPACE_CHANGED');
  assert.equal(s.store.list('artifact').find(a => a.data.payload.nodeId === 'code').data.status, 'CANDIDATE');
});
test('REAL execution: stable operation replays its receipt, not the program or a new workspace snapshot', real, async t => {
  const s = setup(t), ws = s.broker.registerWorkspace('test-mission'); fs.writeFileSync(join(ws.path, 'check.mjs'), code);
  const req = request(s), first = await s.broker.execute(req);
  fs.writeFileSync(join(ws.path, 'check.mjs'), 'throw Error("must not replay");');
  assert.deepEqual(await new ToolBroker(s.config).execute(req), first);
  assert.equal(s.store.list('execution-job').length, 1);
  const second = s.authority.open(await s.broker.execute({...req, operationId: 'new-operation'}), 'tool.receipt');
  assert.equal(second.result.exitCode, 1); assert.notEqual(second.result.snapshotHash, first.data.result.snapshotHash);
});
test('REAL execution: missing exec is a durable FAILED operation, never exit 1 or automatic replay',real,async t=>{
  const s=setup(t);s.broker.registerWorkspace('test-mission');
  const req=request(s,'execution.run',{argv:['./sovereign-missing-executable-canary'],cwd:'.'},'missing-exec');
  const signed=await s.broker.execute(req),receipt=s.authority.open(signed,'tool.receipt');
  assert.equal(receipt.status,'FAILED');assert.equal(receipt.result.error.code,'EXECUTION_START');
  assert.equal(Object.hasOwn(receipt.result,'exitCode'),false);
  const job=s.store.get('execution-job',req.operationId).data;
  assert.equal(job.state,'FAILED');assert.equal(job.failure.code,'EXECUTION_START');
  assert.equal(job.failure.details.executionGateReleased,true);assert.equal(job.failure.details.programStarted,false);
  assert.equal(job.failure.details.scratchRetained,false);
  const before=s.store.verifyJournal(),replay=new ToolBroker({...s.config,executionRunner:{available:()=>({available:true}),
    run:async()=>{throw Error('A failed stable operation must not launch again');}}});
  assert.deepEqual(await replay.execute(req),signed);assert.deepEqual(s.store.verifyJournal(),before);
  assert.equal(s.store.list('execution-job').length,1);
});
test('REAL execution: durable completed job restores lost receipt after controller storage failure, without replay', real, async t => {
  const s = setup(t), ws = s.broker.registerWorkspace('test-mission'); fs.writeFileSync(join(ws.path, 'check.mjs'), code);
  const req = request(s), originalPut = s.store.put.bind(s.store); let fail = true;
  s.store.put = (kind, id, data, options) => {
    if (fail && kind === 'effect' && id === req.operationId && data.state === 'SUCCEEDED') { fail = false; throw Error('Injected crash window'); }
    return originalPut(kind, id, data, options);
  };
  await assert.rejects(s.broker.execute(req), {code: 'EFFECT_UNCERTAIN'});
  const result = s.store.get('execution-job', req.operationId).data.result;
  assert.equal(s.store.get('effect', req.operationId).data.state, 'DISPATCHED');
  const restarted = new ToolBroker(s.config);
  assert.deepEqual(restarted.reconcileExecutions('test-mission'), [req.operationId]);
  assert.deepEqual(s.authority.open(await restarted.execute(req), 'tool.receipt').result, result);
  assert.equal(s.store.list('execution-job').length, 1);
});
test('REAL process death: restart terminates the recorded orphan service and records interruption, never success', real, async t => {
  const s = setup(t); s.broker.registerWorkspace('test-mission');
  const snapshot = s.broker.executionSnapshot('test-mission'), args = {argv: ['python3', '-c', 'import time;time.sleep(60)'], cwd: '.'};
  const req = request(s, 'execution.run', args, 'interrupted-operation');
  const binding = {missionId: req.missionId, principalId: req.principalId, tool: req.tool, argsHash: sha256(args)};
  let effect = s.store.put('effect', req.operationId, {...binding, state: 'PREPARED', startedAt: new Date().toISOString()}, {expectedVersion: 0});
  s.store.put('effect', req.operationId, {...effect.data, state: 'DISPATCHED'}, {expectedVersion: effect.version});
  const child = fork(new URL('./fixtures/execution-controller.mjs', import.meta.url), [], {stdio: ['ignore', 'ignore', 'pipe', 'ipc']});
  let diagnostic = ''; child.stderr.on('data', data => { diagnostic += data.toString(); });
  const closed = new Promise(resolve => child.once('exit', resolve));
  t.after(() => { if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL'); });
  const metadata = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(Error('Fixture metadata timeout: ' + diagnostic)), 5000);
    child.once('message', value => { clearTimeout(timer); resolve(value); });
    child.once('error', error => { clearTimeout(timer); reject(error); });
    child.send({args, snapshot});
  });
  s.store.put('execution-job', req.operationId, {...binding, args, snapshotHash: snapshot.hash, manifest: snapshot.manifest,
    mode: 'snapshot-discard', state: 'STARTING', ...metadata}, {expectedVersion: 0});
  for (let attempt = 0; attempt < 30 && native.state(metadata.unit).SubState !== 'running'; attempt++) await delay(50);
  assert.equal(native.state(metadata.unit).SubState, 'running');
  child.kill('SIGKILL'); await closed;
  assert.equal(fs.existsSync(metadata.scratch), true, 'Abrupt controller death leaves its known scratch for reconciliation');
  const restarted = new ToolBroker(s.config);
  assert.deepEqual(restarted.reconcileExecutions('test-mission'), [req.operationId]);
  const result = s.authority.open(await restarted.execute(req), 'tool.receipt');
  assert.equal(result.status, 'FAILED'); assert.equal(result.result.error.code, 'EXECUTION_INTERRUPTED');
  assert.equal(result.result.outcomeKnown, false); assert.equal(result.result.automaticReplay, false);
  assert.equal(fs.existsSync(metadata.scratch), false);
  const state = native.state(metadata.unit); assert.ok(state.LoadState === 'not-found' || state.ActiveState === 'inactive');
});
