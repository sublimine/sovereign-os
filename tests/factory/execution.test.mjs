import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import {join} from 'node:path';
import {IsolatedExecutionRunner, validateExecutionArgs, validateExecutionSnapshot, validateExecutionResult} from '../../factory/tools/execution.mjs';
import {sha256} from '../../factory/lib/contracts.mjs';

const runner = new IsolatedExecutionRunner();
const supported = runner.available().available;
const real = {skip: supported ? false : 'Real Linux user-service sandbox infrastructure unavailable'};
const snapshot = (entries = {}) => {
  const files = Object.entries(entries).sort().map(([path, content]) => ({path, content, sha256: sha256(content)}));
  const directories = [...new Set(files.flatMap(f => {
    const parts = f.path.split('/'); return parts.slice(0, -1).map((_, index) => parts.slice(0, index + 1).join('/'));
  }))].sort().map(path => ({type: 'directory', path}));
  const manifest = [...directories, ...files.map(f => ({type: 'file', path: f.path, sha256: f.sha256, bytes: Buffer.byteLength(f.content)}))];
  return {files, manifest, hash: sha256(manifest)};
};
const run = (argv, options = {}) => (options.runner ?? runner).run({args: {argv, cwd: options.cwd ?? '.'},
  snapshot: options.snapshot ?? snapshot(), ...(options.signal ? {signal: options.signal} : {})});
function cleaned(error, target = runner) {
  assert.equal(error.details.scratchRetained, false);
  const state = target.state(error.details.unit);
  assert.ok(state.LoadState === 'not-found' || ['inactive', 'failed'].includes(state.ActiveState));
  assert.equal(target.active.size, 0);
  return true;
}

test('execution argv schema rejects shell-style objects, traversal and ambient controls', () => {
  for (const bad of [{argv: 'echo x', cwd: '.'}, {argv: [], cwd: '.'}, {argv: ['true'], cwd: '../other'},
    {argv: ['true'], cwd: '.', env: {SECRET: 'x'}}, {argv: ['true'], cwd: '/tmp'}]) {
    assert.throws(() => validateExecutionArgs(bad));
  }
});
test('snapshot contract rejects missing, duplicated, extra or mismatched bytes and undeclared parents', () => {
  const good = snapshot({'src/a': 'actual'});
  assert.equal(validateExecutionSnapshot(good), good);
  for (const modify of [s => s.files.pop(), s => s.files.push(s.files[0]), s => s.files[0].content = 'other',
    s => { s.manifest.shift(); s.hash = sha256(s.manifest); },
    s => { s.manifest.push(s.manifest[0]); s.hash = sha256(s.manifest); },
    s => { s.manifest[1].bytes++; s.hash = sha256(s.manifest); }]) {
    const bad = structuredClone(good); modify(bad); assert.throws(() => validateExecutionSnapshot(bad));
  }
});
test('REAL runner: Python and Node execute only after sandbox and kernel budget gates', real, async () => {
  for (const argv of [['python3', '-c', 'print(17+25)'], ['node', '-e', 'console.log(17+25)']]) {
    const result = await run(argv);
    assert.equal(result.exitCode, 0); assert.equal(result.stdout, '42\n'); assert.equal(result.simulation, false);
    assert.equal(result.isolation.limits.memoryBytes, 512 * 1024 * 1024);
    assert.equal(result.isolation.limits.maxTasks, 32); assert.equal(result.isolation.limits.cpuCores, 0.5);
    assert.equal(result.isolation.processesTerminated, true); assert.equal(result.isolation.scratchRemoved, true);
    assert.equal(result.isolation.programStart.kind, 'sovereign.execution.started.v1');
    assert.equal(result.isolation.programStart.snapshotHash, result.snapshotHash);
    assert.ok(result.isolation.programStart.pid > 0);
    assert.match(result.interpretation, /not an attestation that every descendant emitted/);
    assert.match(result.interpretation, /aggregate file PASS does not establish subtest coverage/);
    assert.equal(validateExecutionResult(result), result);
    assert.throws(() => validateExecutionResult({...result, stdout: 'forged'}), {code: 'EXECUTION_RECEIPT'});
    assert.throws(() => validateExecutionResult({...result,isolation:{...result.isolation,
      programStart:{...result.isolation.programStart,snapshotHash:'0'.repeat(64)}}}),{code:'EXECUTION_RECEIPT'});
  }
});
test('REAL runner: exact input snapshot, relative cwd and disposable scratch writes', real, async () => {
  const input = snapshot({'src/input.txt': 'original'});
  const result = await run(['python3', '-c', 'print(open("input.txt").read());open("input.txt","w").write("changed")'], {snapshot: input, cwd: 'src'});
  assert.equal(result.exitCode, 0); assert.equal(result.stdout, 'original\n');
  assert.equal(result.snapshotHash, input.hash); assert.equal(input.files[0].content, 'original');
  assert.equal(result.mode, 'snapshot-discard');
});
test('REAL runner: command nonzero exit is preserved, not called a passing test', real, async () => {
  const result = await run(['python3', '-c', 'import sys;sys.exit(7)']);
  assert.equal(result.exitCode, 7); assert.equal(result.outputTruncated, false);
});
test('REAL runner: missing executable cannot become an observed program exit', real, async () => {
  await assert.rejects(() => run(['./sovereign-missing-executable-canary']), error => {
    assert.equal(error.code, 'EXECUTION_START');
    assert.equal(error.details.programStarted, false);
    assert.equal(error.details.executionGateReleased, true);
    assert.match(error.details.diagnosticStderr, /FileNotFoundError/);
    return cleaned(error);
  });
});
test('REAL runner: immediate successful exits retain their drained launch confirmation', real, async () => {
  for(let i=0;i<5;i++){
    const result=await run(['python3','-c','pass']);
    assert.equal(result.exitCode,0);assert.equal(result.stdout,'');assert.equal(result.stderr,'');
    assert.equal(result.isolation.programStart.kind,'sovereign.execution.started.v1');
    assert.equal(result.isolation.programStart.snapshotHash,result.snapshotHash);
  }
});
test('REAL runner: node:test assertion failure cannot become an aggregate file PASS', real, async () => {
  const input = snapshot({'probe.test.mjs': [
    "import test from 'node:test';",
    "import assert from 'node:assert/strict';",
    "test('valid-a', () => assert.equal(2 + 2, 4));",
    "test('valid-b', () => assert.equal(3 + 4, 7));",
    "test('failure-canary', () => assert.equal(1, 2));",
    '',
  ].join('\n')});
  const result = await run(['node', '--test', 'probe.test.mjs'], {snapshot: input});
  assert.notEqual(result.exitCode, 0);
  assert.equal(result.snapshotHash, input.hash);
  assert.equal(validateExecutionResult(result), result);
  // Reporter formatting and child event visibility are not callback proofs.
  // Do not make this check pass merely by matching a string in stdout.
});
test('REAL runner: a node:test file top-level error cannot become a passing execution', real, async () => {
  const input = snapshot({'probe.test.mjs': "throw new Error('TOP_LEVEL_FAILURE_CANARY');\n"});
  const result = await run(['node', '--test', 'probe.test.mjs'], {snapshot: input});
  assert.notEqual(result.exitCode, 0);
  assert.equal(result.snapshotHash, input.hash);
  assert.equal(validateExecutionResult(result), result);
});
test('REAL runner: awaited node:test callbacks finish despite aggregate reporter output', real, async () => {
  const input = snapshot({'probe.test.mjs': [
    "import test from 'node:test';",
    "import assert from 'node:assert/strict';",
    'let completed = 0;',
    "await test('valid-a', () => { assert.equal(2 + 2, 4); completed++; });",
    "await test('valid-b', () => { assert.equal(3 + 4, 7); completed++; });",
    "assert.equal(completed, 2, 'CALLBACKS_MUST_COMPLETE');",
    '',
  ].join('\n')});
  const result = await run(['node', '--test', 'probe.test.mjs'], {snapshot: input});
  assert.equal(result.exitCode, 0, result.stdout + result.stderr);
  assert.equal(result.snapshotHash, input.hash);
  assert.equal(validateExecutionResult(result), result);
  // Only these two fixture callbacks are covered; no universal runner claim.
});
test('REAL runner: host canary, synthetic ambient secret and host network are unavailable', real, async t => {
  const temp = fs.mkdtempSync('/tmp/sovereign-runner-outside-'); const canary = join(temp, 'canary');
  fs.writeFileSync(canary, 'SYNTHETIC'); t.after(() => fs.rmSync(temp, {recursive: true}));
  const previous = process.env.SOVEREIGN_TEST_PRIVATE_CANARY;
  process.env.SOVEREIGN_TEST_PRIVATE_CANARY = 'SYNTHETIC-NOT-A-REAL-SECRET';
  try {
    const code = `import os,socket,errno
assert 'SOVEREIGN_TEST_PRIVATE_CANARY' not in os.environ
try:
 open(${JSON.stringify(canary)}).read()
 raise AssertionError('outside readable')
except OSError as e:
 assert e.errno in (errno.ENOENT,errno.EACCES,errno.EPERM)
for family,kind in [(socket.AF_INET,socket.SOCK_STREAM),(socket.AF_INET6,socket.SOCK_STREAM),(socket.AF_UNIX,socket.SOCK_STREAM)]:
 try:
  s=socket.socket(family,kind)
  s.connect(('127.0.0.1',9) if family==socket.AF_INET else ('::1',9) if family==socket.AF_INET6 else '\\0sovereign-nonexistent')
  raise AssertionError('network allowed')
 except OSError as e:
  assert e.errno in (errno.EPERM,errno.EACCES)
print('DENIED')`;
    const result = await run(['python3', '-c', code]);
    assert.equal(result.exitCode, 0, result.stderr); assert.equal(result.stdout, 'DENIED\n');
    assert.equal(fs.readFileSync(canary, 'utf8'), 'SYNTHETIC');
  } finally { if (previous === undefined) delete process.env.SOVEREIGN_TEST_PRIVATE_CANARY; else process.env.SOVEREIGN_TEST_PRIVATE_CANARY = previous; }
});
test('REAL runner: malicious argv strings are literal data, not interpolated shell commands', real, async () => {
  const value = '$(false); `false` $USER %n';
  const result = await run(['python3', '-c', 'import sys;print(sys.argv[1])', value]);
  assert.equal(result.exitCode, 0); assert.equal(result.stdout, value + '\n');
});
test('REAL runner: cancellation stops a descendant that created a new session', real, async () => {
  const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), 1500);
  try {
    await assert.rejects(run(['python3', '-c', 'import os,subprocess,time;subprocess.Popen(["python3","-c","import os,time;os.setsid();time.sleep(60)"]);time.sleep(60)'], {signal: controller.signal}), error => {
      assert.equal(error.code, 'ABORTED'); return cleaned(error);
    });
  } finally { clearTimeout(timer); }
});
test('REAL runner: enforced deadline terminates waiting command and removes scratch', real, async () => {
  const target = new IsolatedExecutionRunner({wallTimeMs: 2000});
  await assert.rejects(run(['python3', '-c', 'import time;time.sleep(60)'], {runner: target}), error => {
    assert.equal(error.code, 'TIMEOUT'); return cleaned(error, target);
  });
});
test('REAL runner: excess output is a typed failure, never silently truncated success', real, async () => {
  const target = new IsolatedExecutionRunner({maxOutputBytes: 2048});
  await assert.rejects(run(['python3', '-c', 'while True: print("x"*4096,flush=True)'], {runner: target}), error => {
    assert.equal(error.code, 'OUTPUT_LIMIT'); return cleaned(error, target);
  });
});
test('REAL runner: aggregate memory ceiling is enforced by the owned cgroup', real, async () => {
  const target = new IsolatedExecutionRunner({memoryBytes: 64 * 1024 * 1024});
  await assert.rejects(run(['python3', '-c', 'x=bytearray(256*1024*1024);print(len(x))'], {runner: target}), error => {
    assert.equal(error.code, 'MEMORY_LIMIT'); return cleaned(error, target);
  });
});
test('REAL runner: bounded child-creation test reaches TasksMax without escaping cleanup', real, async () => {
  const target = new IsolatedExecutionRunner({maxTasks: 16});
  const code = `import errno,subprocess
children=[]
try:
 for _ in range(40):
  children.append(subprocess.Popen(['python3','-c','import time;time.sleep(20)']))
 raise AssertionError('TasksMax not enforced')
except OSError as e:
 assert e.errno==errno.EAGAIN
 print('TASK_LIMIT')
finally:
 for p in children: p.terminate()
 for p in children: p.wait()`;
  const result = await run(['python3', '-c', code], {runner: target});
  assert.equal(result.exitCode, 0, result.stderr); assert.equal(result.stdout, 'TASK_LIMIT\n');
});
test('REAL runner: revoked authority at release never executes the requested program', real, async () => {
  let checks = 0;
  await assert.rejects(runner.run({args: {argv: ['python3', '-c', 'print("MUST_NOT_RUN")'], cwd: '.'},
    snapshot: snapshot(), verifyAuthority: () => { if (++checks > 1) throw Object.assign(Error('revoked'), {code: 'LEASE_REVOKED'}); }}), error => {
    assert.equal(error.code, 'LEASE_REVOKED'); assert.equal(error.details.programStarted, false); return cleaned(error);
  });
});
test('REAL runner: revocation during a running program stops it promptly', real, async () => {
  const start = Date.now();
  await assert.rejects(runner.run({args: {argv: ['python3', '-c', 'import time;print("STARTED",flush=True);time.sleep(60)'], cwd: '.'},
    snapshot: snapshot(), verifyAuthority: () => {
      if (Date.now() - start > 1500) throw Object.assign(Error('revoked'), {code: 'LEASE_REVOKED'});
    }}), error => {
    assert.equal(error.code, 'LEASE_REVOKED'); assert.equal(error.details.programStarted, true);
    assert.ok(Date.now() - start < 5000); return cleaned(error);
  });
});
test('REAL runner: binary output cannot be silently decoded into a textual receipt', real, async () => {
  await assert.rejects(run(['python3', '-c', 'import os;os.write(1,bytes([255,254,0]))']), error => {
    assert.equal(error.code, 'ENCODING'); return cleaned(error);
  });
});
test('REAL runner: workspace configuration cannot relax the external launcher isolation', real, async () => {
  const input = snapshot({'.codex/config.toml': 'sandbox_mode = "danger-full-access"\n[features]\nuse_legacy_landlock = true\n'});
  const result = await run(['python3', '-c', 'import socket,errno\ntry:\n socket.socket()\n raise AssertionError("network enabled")\nexcept OSError as e:\n assert e.errno in (errno.EPERM,errno.EACCES)\nprint("CONFIG_DENIED")'], {snapshot: input});
  assert.equal(result.exitCode, 0, result.stderr); assert.equal(result.stdout, 'CONFIG_DENIED\n');
});
test('REAL runner: child cannot open trusted supervisor memory or descriptor table', real, async () => {
  const result = await run(['python3', '-c', 'import os,errno\np="/proc/"+str(os.getppid())\nfor action in [lambda:open(p+"/mem","rb"),lambda:os.readlink(p+"/fd/1")]:\n try:\n  action()\n  raise AssertionError("supervisor accessible")\n except OSError as e:\n  assert e.errno in (errno.EPERM,errno.EACCES)\nprint("SUPERVISOR_DENIED")']);
  assert.equal(result.exitCode, 0, result.stderr); assert.equal(result.stdout, 'SUPERVISOR_DENIED\n');
});
test('REAL runner: durable identity is awaited before snapshot preparation; failed journal leaves no scratch or command', real, async () => {
  let recorded;
  await assert.rejects(runner.run({args:{argv:['node','-e','console.log("MUST_NOT_RUN")'],cwd:'.'},snapshot:snapshot({'data':'copied only later'}),
    onCreated:async metadata=>{
      recorded=metadata; assert.deepEqual(fs.readdirSync(metadata.scratch),[]);
      await Promise.resolve(); throw Object.assign(Error('journal refused'),{code:'JOURNAL_FAILED'});
    }}), error=>{
    assert.equal(error.code,'JOURNAL_FAILED'); assert.equal(error.details.programStarted,false);
    assert.equal(error.details.diagnosticStdout,''); return cleaned(error);
  });
  assert.ok(recorded); assert.equal(fs.existsSync(recorded.scratch),false);
});
test('REAL runner: snapshot preparation failure has a durable identity and cleans its exact directory', real, async () => {
  let recorded;
  await assert.rejects(runner.run({args:{argv:['node','-e','console.log("MUST_NOT_RUN")'],cwd:'absent'},snapshot:snapshot(),
    onCreated:metadata=>{recorded=metadata;}}), error=>{
    assert.equal(error.code,'ENOENT'); assert.equal(error.details.programStarted,false); return cleaned(error);
  });
  assert.ok(recorded); assert.equal(fs.existsSync(recorded.scratch),false);
  assert.equal(runner.reconcile(recorded).scratchRemoved,true);
});
