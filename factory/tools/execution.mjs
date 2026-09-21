import * as fs from 'node:fs';
import {spawn, execFileSync} from 'node:child_process';
import {dirname, join, resolve, isAbsolute, basename} from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomUUID} from 'node:crypto';
import {setTimeout as delay} from 'node:timers/promises';
import {check, keys, list, string, integer, sha256, canonical, clone, ContractError} from '../lib/contracts.mjs';
import {ExecutionLaunchProtocol} from './execution-launch.mjs';

const BOOTSTRAP = fileURLToPath(new URL('./execution-bootstrap.py', import.meta.url));
const TMPFS_MAGIC = 0x01021994;
const fail = (code, message) => new ContractError(code, message);
const cancelled = signal => { if (signal?.aborted) throw fail('ABORTED', 'Execution cancelled'); };
function resolveExecutable(candidate, label) {
  string(candidate, label, {min: 1, max: 4096});
  const candidates = isAbsolute(candidate) || candidate.includes('/')
    ? [resolve(candidate)]
    : (process.env.PATH || '').split(':').filter(Boolean).map(directory => join(directory, candidate));
  for (const path of candidates) {
    try {
      const stat = fs.statSync(path);
      if (stat.isFile() && (stat.mode & 0o111) !== 0) return fs.realpathSync(path);
    } catch {}
  }
  throw fail('CAPABILITY', label + ' executable is unavailable; set SUBLIMINE_CODEX_BIN or PATH explicitly');
}
function outputText(bytes) {
  try {
    const text = new TextDecoder('utf-8', {fatal: true, ignoreBOM: true}).decode(bytes);
    check(!text.includes('\0'), 'ENCODING', 'Binary output is not a textual execution proof'); return text;
  } catch { throw fail('ENCODING', 'Execution output must be lossless UTF-8 text'); }
}
export function validateExecutionResult(result) {
  check(result?.schema === 'sovereign.execution.v1' && result.simulation === false && result.mode === 'snapshot-discard'
    && result.isolation?.enforced === true && result.isolation.processesTerminated === true
    && result.isolation.scratchRemoved === true && result.isolation.network === false && result.isolation.cleanEnvironment === true
    && result.outputTruncated === false && Array.isArray(result.manifest) && sha256(result.manifest) === result.snapshotHash,
  'EXECUTION_RECEIPT', 'Execution receipt is incomplete or not a real isolated observation');
  validateExecutionArgs({argv: result.argv, cwd: result.cwd}); integer(result.exitCode, 'execution exitCode', {max: 255});
  // Historic v1 receipts remain readable, but never gain a new launch proof.
  if (result.isolation.programStart !== undefined) {
    const start = result.isolation.programStart;
    check(start?.kind === 'sovereign.execution.started.v1' && start.snapshotHash === result.snapshotHash
      && typeof start.nonce === 'string' && start.nonce.length > 0 && Number.isSafeInteger(start.pid) && start.pid > 0,
    'EXECUTION_RECEIPT', 'Observed program launch binding is invalid');
  }
  for (const stream of ['stdout', 'stderr']) {
    string(result[stream], stream, {min: 0, max: 1024 * 1024});
    check(sha256(result[stream]) === result[stream + 'Sha256'], 'EXECUTION_RECEIPT', 'Execution output digest differs');
  }
  return result;
}
export function executionPath(value, allowRoot = true) {
  string(value, 'execution cwd', {max: 2048});
  check(allowRoot && value === '.' || !isAbsolute(value) && !value.includes('\\')
    && value.split('/').every(p => p && p !== '.' && p !== '..') && value.split('/').length <= 32,
  'WORKSPACE_PATH', 'Execution cwd must be workspace-relative');
  return value;
}
export function validateExecutionArgs(args) {
  keys(args, ['argv', 'cwd']); executionPath(args.cwd);
  list(args.argv, 'execution argv', {min: 1, max: 256});
  args.argv.forEach((part, index) => string(part, 'argument', {min: index ? 0 : 1, max: 16000}));
  check(Buffer.byteLength(canonical(args.argv)) <= 64000, 'SCHEMA', 'Execution argv exceeds cap');
  return args;
}
export function validateExecutionSnapshot(snapshot) {
  keys(snapshot, ['manifest', 'files', 'hash']);
  list(snapshot.manifest, 'snapshot manifest', {max: 2000});
  list(snapshot.files, 'snapshot files', {max: 2000});
  check(sha256(snapshot.manifest) === snapshot.hash, 'EXECUTION_SNAPSHOT', 'Snapshot manifest digest differs');
  const entries = new Map(); let bytes = 0;
  for (const entry of snapshot.manifest) {
    keys(entry, entry.type === 'directory' ? ['type', 'path'] : ['type', 'path', 'bytes', 'sha256']);
    executionPath(entry.path, false);
    check(['directory', 'file'].includes(entry.type) && !entries.has(entry.path), 'EXECUTION_SNAPSHOT', 'Invalid or repeated snapshot entry');
    if (entry.type === 'file') { integer(entry.bytes, 'snapshot file bytes', {max: 4 * 1024 * 1024}); bytes += entry.bytes; }
    entries.set(entry.path, entry);
  }
  check(bytes <= 32 * 1024 * 1024, 'EXECUTION_SNAPSHOT', 'Snapshot exceeds aggregate byte cap');
  for (const entry of entries.values()) {
    let parent = dirname(entry.path);
    while (parent !== '.') {
      check(entries.get(parent)?.type === 'directory', 'EXECUTION_SNAPSHOT', 'Explicit directory ancestors required');
      parent = dirname(parent);
    }
  }
  const seen = new Set();
  for (const file of snapshot.files) {
    keys(file, ['path', 'content', 'sha256']); executionPath(file.path, false);
    string(file.content, 'snapshot text', {min: 0, max: 4 * 1024 * 1024});
    const entry = entries.get(file.path);
    check(!seen.has(file.path) && entry?.type === 'file' && Buffer.byteLength(file.content) === entry.bytes
      && sha256(file.content) === entry.sha256 && entry.sha256 === file.sha256,
    'EXECUTION_SNAPSHOT', 'Snapshot bytes and manifest must correspond exactly');
    seen.add(file.path);
  }
  check(seen.size === [...entries.values()].filter(e => e.type === 'file').length,
    'EXECUTION_SNAPSHOT', 'Manifest file has no snapshot bytes');
  return snapshot;
}
function realDirectory(path, uid, create = false) {
  if (create && !fs.existsSync(path)) fs.mkdirSync(path, {mode: 0o700});
  const stat = fs.lstatSync(path);
  check(stat.isDirectory() && !stat.isSymbolicLink() && stat.uid === uid && (stat.mode & 0o077) === 0,
    'EXECUTION_ROOT', 'Private, owned real directory required');
  check(fs.realpathSync(path) === resolve(path), 'EXECUTION_ROOT', 'Directory ancestry may not contain symbolic links');
}
function properties(text) {
  return Object.fromEntries(text.trim().split('\n').filter(Boolean).map(line => {
    const at = line.indexOf('='); return [line.slice(0, at), line.slice(at + 1)];
  }));
}
function microseconds(text) {
  let result = 0, matched = '';
  for (const match of text.matchAll(/([0-9.]+)(us|ms|s|min|h)/g)) {
    result += Number(match[1]) * ({us: 1, ms: 1000, s: 1000000, min: 60000000, h: 3600000000}[match[2]]);
    matched += match[0];
  }
  check(matched === text.replaceAll(' ', '') && result > 0, 'EXECUTION_LIMITS', 'Unrecognized manager duration');
  return result;
}

/** Snapshot-discard runner: no original workspace or controller state is mounted.
 * Each operation gets an individually named transient systemd user service, real
 * kernel cgroup limits, a tmpfs scratch tree and official Codex namespaces/seccomp.
 * The requested program cannot start before both independent gates are checked.
 * No model-supplied property, environment, mount, service name or helper is accepted.
 */
export class IsolatedExecutionRunner {
  constructor({codexPath = process.env.SUBLIMINE_CODEX_BIN || process.env.CODEX_BIN || 'codex', nodePath = process.execPath,
    memoryBytes = 512 * 1024 * 1024, maxTasks = 32, wallTimeMs = 30000,
    maxOutputBytes = 128 * 1024, scratchFileBytes = 8 * 1024 * 1024} = {}) {
    check(process.platform === 'linux' && typeof process.getuid === 'function', 'CAPABILITY', 'Linux runner required');
    this.uid = process.getuid(); check(this.uid !== 0, 'EXECUTION_ROOT', 'Do not run the factory as root');
    integer(memoryBytes, 'memoryBytes', {min: 64 * 1024 * 1024, max: 1024 * 1024 * 1024});
    integer(maxTasks, 'maxTasks', {min: 8, max: 128});
    integer(wallTimeMs, 'wallTimeMs', {min: 1000, max: 120000});
    integer(maxOutputBytes, 'maxOutputBytes', {min: 1024, max: 1024 * 1024});
    integer(scratchFileBytes, 'scratchFileBytes', {min: 1024, max: 32 * 1024 * 1024});
    this.codex = resolveExecutable(codexPath, 'Codex CLI'); this.node = resolveExecutable(nodePath, 'Node runtime');
    this.runtime = `/run/user/${this.uid}`; this.root = join(this.runtime, 'sovereign-factory-jobs');
    this.clientEnv = {PATH: '/usr/bin:/bin', LANG: 'C.UTF-8', LC_ALL: 'C.UTF-8',
      XDG_RUNTIME_DIR: this.runtime, DBUS_SESSION_BUS_ADDRESS: `unix:path=${this.runtime}/bus`};
    Object.assign(this, {memoryBytes, maxTasks, wallTimeMs, maxOutputBytes, scratchFileBytes});
    this.active = new Set();
  }
  available() {
    try {
      realDirectory(this.runtime, this.uid);
      check(fs.statfsSync(this.runtime).type === TMPFS_MAGIC, 'EXECUTION_ROOT', 'Scratch root must be memory-backed');
      check(fs.existsSync('/usr/bin/bwrap') && fs.existsSync('/usr/bin/systemd-run') && fs.existsSync('/usr/bin/python3'), 'CAPABILITY', 'Required official OS components missing');
      return {available: true, mode: 'snapshot-discard', network: false, perRunGatesRequired: true};
    } catch (error) { return {available: false, mode: 'snapshot-discard', code: error.code ?? 'CAPABILITY'}; }
  }
  control(args, {optional = false} = {}) {
    try { return execFileSync('/usr/bin/systemctl', ['--user', ...args], {env: this.clientEnv,
      encoding: 'utf8', timeout: 5000, maxBuffer: 64 * 1024, stdio: ['ignore', 'pipe', 'pipe']}); }
    catch (error) {
      if (args[0] === 'show' && typeof error.stdout === 'string' && /^LoadState=not-found$/m.test(error.stdout)) return error.stdout;
      if (optional) return null; throw fail('EXECUTION_CONTROL', 'User service control failed');
    }
  }
  state(unit) {
    check(/^sovereign-exec-[a-f0-9-]+\.service$/.test(unit), 'EXECUTION_ID', 'Invalid owned service name');
    const raw = this.control(['show', unit, '-p', 'LoadState', '-p', 'ActiveState', '-p', 'SubState',
      '-p', 'Result', '-p', 'ExecMainCode', '-p', 'ExecMainStatus', '-p', 'ControlGroup',
      '-p', 'MemoryMax', '-p', 'MemorySwapMax', '-p', 'TasksMax', '-p', 'CPUQuotaPerSecUSec',
      '-p', 'RuntimeMaxUSec', '-p', 'KillMode', '-p', 'NoNewPrivileges']);
    return properties(raw);
  }
  verifyLimits(state) {
    check(state.NoNewPrivileges === 'yes' && state.KillMode === 'control-group'
      && Number(state.MemoryMax) === this.memoryBytes && state.MemorySwapMax === '0'
      && Number(state.TasksMax) === this.maxTasks && microseconds(state.CPUQuotaPerSecUSec) === 500000
      && microseconds(state.RuntimeMaxUSec) === Math.ceil(this.wallTimeMs / 1000) * 1000000,
    'EXECUTION_LIMITS', 'Manager did not apply exact requested limits');
    const group = state.ControlGroup;
    check(group?.startsWith(`/user.slice/user-${this.uid}.slice/user@${this.uid}.service/`)
      && !group.split('/').includes('..') && group.endsWith('.service'), 'EXECUTION_LIMITS', 'Unexpected cgroup ownership');
    const path = '/sys/fs/cgroup' + group;
    const value = file => fs.readFileSync(join(path, file), 'utf8').trim();
    const cpu = value('cpu.max').split(/\s+/).map(Number);
    check(value('memory.max') === String(this.memoryBytes) && value('memory.swap.max') === '0'
      && value('pids.max') === String(this.maxTasks) && cpu.length === 2 && cpu[0] / cpu[1] === 0.5,
    'EXECUTION_LIMITS', 'Kernel cgroup limits differ from the requested limits');
    return {path, memoryBytes: this.memoryBytes, swapBytes: 0, maxTasks: this.maxTasks, cpuCores: 0.5,
      wallTimeMs: Math.ceil(this.wallTimeMs / 1000) * 1000, noNewPrivileges: true, killMode: 'control-group'};
  }
  groupEmpty(path) {
    if (!path) return false;
    try { return /^populated 0$/m.test(fs.readFileSync(join(path, 'cgroup.events'), 'utf8')); }
    catch (error) { if (error.code === 'ENOENT') return true; throw error; }
  }
  removeScratch({unit, scratch, inode}) {
    check(/^sovereign-exec-[a-f0-9-]+\.service$/.test(unit), 'EXECUTION_ID', 'Invalid owned service name');
    const token = unit.slice('sovereign-exec-'.length, -'.service'.length);
    check(dirname(scratch) === this.root && basename(scratch) === token, 'EXECUTION_CLEANUP', 'Scratch path is not bound to this service');
    realDirectory(this.root, this.uid);
    if (!fs.existsSync(scratch)) return;
    const stat = fs.lstatSync(scratch);
    check(stat.isDirectory() && !stat.isSymbolicLink() && stat.ino === inode && stat.uid === this.uid,
      'EXECUTION_CLEANUP', 'Scratch ownership changed');
    fs.rmSync(scratch, {recursive: true});
  }
  reconcile(metadata) {
    check(metadata?.scope === 'snapshot-discard' && !this.active.has(metadata.unit), 'EXECUTION_CLEANUP', 'Cannot reconcile a live controller operation');
    const {unit, scratch, inode} = metadata;
    check(typeof scratch === 'string' && Number.isSafeInteger(inode), 'EXECUTION_CLEANUP', 'Durable scratch identity required');
    const before = this.state(unit);
    const group = before.ControlGroup;
    check(!group || group.startsWith(`/user.slice/user-${this.uid}.slice/user@${this.uid}.service/`)
      && !group.split('/').includes('..') && group.endsWith('/' + unit), 'EXECUTION_CLEANUP', 'Foreign cgroup rejected');
    if (before.LoadState !== 'not-found') this.control(['stop', unit]);
    const after = this.state(unit);
    check((['inactive', 'failed'].includes(after.ActiveState) || after.LoadState === 'not-found')
      && (!group || this.groupEmpty('/sys/fs/cgroup' + group)), 'EXECUTION_CLEANUP', 'Stopped execution is not confirmed');
    this.removeScratch({unit, scratch, inode});
    this.control(['reset-failed', unit], {optional: true});
    return {unit, processesTerminated: true, scratchRemoved: true, reconciledAt: new Date().toISOString()};
  }
  async run({args, snapshot, signal, verifyAuthority = () => {}, onCreated = () => {}}) {
    validateExecutionArgs(args); cancelled(signal); verifyAuthority();
    check(this.available().available, 'CAPABILITY', 'Required isolated execution infrastructure missing');
    validateExecutionSnapshot(snapshot);
    realDirectory(this.root, this.uid, true);
    const token = randomUUID(), unit = `sovereign-exec-${token}.service`, scratch = join(this.root, token);
    fs.mkdirSync(scratch, {mode: 0o700}); const inode = fs.lstatSync(scratch).ino;
    const job = join(scratch, 'job'), launch = join(scratch, 'launch'), configPath = join(scratch, 'request.json');
    const bootstrapPath = join(scratch, 'bootstrap.py'), outsideCanary = join(scratch, 'outside-canary');
    let bootstrapSha256;
    const startedAt = new Date().toISOString();
    let child, closed, gate = null, limits = null, failure = null, managerState = null, stopStarted = false;
    let stdout = Buffer.alloc(0), stderr = Buffer.alloc(0), programStarted = false;
    const launchProtocol = new ExecutionLaunchProtocol({nonce: token, snapshotHash: snapshot.hash});
    const append = (previous, chunk) => {
      if (previous.length + chunk.length > this.maxOutputBytes) { failure ??= fail('OUTPUT_LIMIT', 'Execution output cap reached'); return previous; }
      return Buffer.concat([previous, chunk]);
    };
    this.active.add(unit);
    const aborted = () => { failure ??= fail('ABORTED', 'Execution cancelled'); };
    signal?.addEventListener('abort', aborted, {once: true});
    const deadline = Date.now() + this.wallTimeMs + 5000;
    try {
      // Persist the exact empty directory identity before copying bytes or
      // launching anything. Await durable adapters; a rejected callback also
      // enters cleanup and can never release the requested program.
      await onCreated({unit, scratch, inode, snapshotHash: snapshot.hash, startedAt, scope: 'snapshot-discard'});
      cancelled(signal); verifyAuthority();
      const bootstrap = fs.readFileSync(BOOTSTRAP); bootstrapSha256 = sha256(bootstrap);
      fs.mkdirSync(job, {mode: 0o700}); fs.mkdirSync(launch, {mode: 0o700});
      fs.writeFileSync(outsideCanary, 'synthetic-private-canary', {mode: 0o600, flag: 'wx'});
      for (const entry of snapshot.manifest) {
        executionPath(entry.path, false);
        if (entry.type === 'directory') fs.mkdirSync(join(job, entry.path), {mode: 0o700, recursive: true});
      }
      for (const file of snapshot.files) {
        executionPath(file.path, false);
        check(sha256(file.content) === file.sha256, 'EXECUTION_SNAPSHOT', 'Snapshot file digest differs');
        fs.mkdirSync(dirname(join(job, file.path)), {mode: 0o700, recursive: true});
        fs.writeFileSync(join(job, file.path), file.content, {mode: 0o600, flag: 'wx'});
      }
      const cwd = join(job, args.cwd);
      check(fs.lstatSync(cwd).isDirectory(), 'WORKSPACE_PATH', 'Execution cwd does not exist');
      const temporaryDirectory = fs.mkdtempSync(join(job, '.sovereign-tmp-'));
      const config = {nonce: token, ...clone(args), job, temporaryDirectory, outsideCanary,
        runtimePath: `${dirname(this.node)}:/usr/bin:/bin`, manifest: snapshot.manifest,
        snapshotHash: snapshot.hash, maxFileBytes: 4 * 1024 * 1024, scratchFileBytes: this.scratchFileBytes,
        hostNamespaces: Object.fromEntries(['pid', 'net', 'mnt', 'user'].map(name => [name, fs.readlinkSync(`/proc/self/ns/${name}`)]))};
      fs.writeFileSync(configPath, JSON.stringify(config), {mode: 0o600, flag: 'wx'});
      fs.writeFileSync(bootstrapPath, bootstrap, {mode: 0o400, flag: 'wx'});
      const rule = `permissions.execution.filesystem={":minimal"="read",${JSON.stringify(job)}="write",${JSON.stringify(launch)}="read",${JSON.stringify(this.codex)}="read",${JSON.stringify(this.node)}="read",${JSON.stringify(bootstrapPath)}="read",${JSON.stringify(configPath)}="read"}`;
      const command = ['--user', '--pipe', '--quiet', `--unit=${unit}`, '--property=RemainAfterExit=yes',
        `--property=MemoryMax=${this.memoryBytes}`, '--property=MemorySwapMax=0', `--property=TasksMax=${this.maxTasks}`,
        '--property=CPUQuota=50%', `--property=RuntimeMaxSec=${Math.ceil(this.wallTimeMs / 1000)}`,
        '--property=KillMode=control-group', '--property=TimeoutStopSec=1', '--property=NoNewPrivileges=yes',
        '/usr/bin/env', '-i', 'PATH=/usr/bin:/bin', 'LANG=C.UTF-8', 'LC_ALL=C.UTF-8', this.codex,
        'sandbox', '-P', 'execution', '-c', rule, '-c', 'permissions.execution.network.enabled=false',
        '-c', 'features.use_legacy_landlock=false', '-C', launch, '--', '/usr/bin/python3', '-I', bootstrapPath, configPath];
      child = spawn('/usr/bin/systemd-run', command, {env: this.clientEnv, stdio: ['pipe', 'pipe', 'pipe']});
      closed = new Promise(resolveClose => {
        child.once('error', () => { failure ??= fail('CAPABILITY', 'Service launcher unavailable'); });
        child.once('close', (code, processSignal) => resolveClose({code, signal: processSignal}));
      });
      child.stdin.on('error', () => { failure ??= fail('EXECUTION_GATE', 'Execution gate pipe closed'); });
      child.stderr.on('data', chunk => { stderr = append(stderr, chunk); });
      child.stdout.on('data', chunk => {
        try {
          const output = launchProtocol.feed(chunk); gate = launchProtocol.ready;
          programStarted = launchProtocol.started !== null;
          if (output.length) stdout = append(stdout, output);
        } catch (error) { failure ??= error; }
      });
      for (;;) {
        if (Date.now() > deadline) failure ??= fail('TIMEOUT', 'Execution deadline exceeded');
        if (signal?.aborted) aborted();
        if (failure) break;
        verifyAuthority();
        managerState = this.state(unit);
        if (gate && !launchProtocol.released) {
          limits = this.verifyLimits(managerState); verifyAuthority(); cancelled(signal);
          launchProtocol.release(); child.stdin.end(`GO ${token}\n`);
        }
        if (managerState.ActiveState === 'failed' || ['exited', 'dead'].includes(managerState.SubState)
          && Number(managerState.ExecMainCode) > 0) break;
        if (child.exitCode !== null) { failure ??= fail('EXECUTION_START', 'Launcher exited before an observed service outcome'); break; }
        await delay(100);
      }
      if (!failure) {
        managerState = this.state(unit);
        if (managerState.Result === 'timeout') failure = fail('TIMEOUT', 'Kernel-managed execution deadline reached');
        else if (managerState.Result === 'oom-kill') failure = fail('MEMORY_LIMIT', 'Execution memory limit reached');
        else if (!['success', 'exit-code'].includes(managerState.Result) || managerState.ExecMainCode !== '1') failure = fail('EXECUTION_SIGNAL', 'Execution did not exit normally');
      }
    } catch (error) { failure ??= error; }
    finally {
      signal?.removeEventListener('abort', aborted);
      try { if (child) {
        this.control(['stop', unit], {optional: true}); stopStarted = true;
        let closeTimer;
        const exit = await Promise.race([closed, new Promise(resolveClose => { closeTimer = setTimeout(() => resolveClose(null), 3000); })]);
        clearTimeout(closeTimer);
        if (!exit) { child.kill('SIGKILL'); failure = fail('EXECUTION_CLEANUP', 'Service client exit not confirmed'); }
        const after = this.state(unit);
        const inactive = ['inactive', 'failed'].includes(after.ActiveState) || after.LoadState === 'not-found';
        if (!inactive || limits && !this.groupEmpty(limits.path)) failure = fail('EXECUTION_CLEANUP', 'Owned cgroup still contains processes');
        this.control(['reset-failed', unit], {optional: true});
      }
      const removable = !child || stopStarted && failure?.code !== 'EXECUTION_CLEANUP';
      if (removable) {
        this.removeScratch({unit, scratch, inode});
      }
      } catch (cleanupError) {
        failure = fail('EXECUTION_CLEANUP', 'Execution cleanup could not be verified');
        failure.details = {cleanupCode: cleanupError.code ?? 'INTERNAL'};
      } finally { this.active.delete(unit); }
    }
    // The manager may report a quick exit before queued stdout is delivered.
    // Cleanup above awaits the launcher's close, which drains its stdio first.
    if (!failure && !programStarted) failure = fail('EXECUTION_START', 'Requested program exec was not confirmed after the execution gate');
    let stdoutText, stderrText;
    if (!failure) { try { stdoutText = outputText(stdout); stderrText = outputText(stderr); } catch (error) { failure = error; } }
    if (failure) {
      failure.details = {...(failure.details ?? {}), unit, programStarted, executionGateReleased: launchProtocol.released, scratchRetained: fs.existsSync(scratch),
        diagnosticStderr: stderr.toString('utf8').slice(0, 8192), diagnosticStdout: stdout.toString('utf8').slice(0, 8192)};
      if (failure.code === 'EXECUTION_CLEANUP') failure.effectUncertain = true;
      throw failure;
    }
    verifyAuthority(); cancelled(signal);
    return {schema: 'sovereign.execution.v1', simulation: false, mode: 'snapshot-discard',
      argv: clone(args.argv), cwd: args.cwd, snapshotHash: snapshot.hash, manifest: clone(snapshot.manifest),
      exitCode: Number(managerState.ExecMainStatus), stdout: stdoutText, stderr: stderrText,
      stdoutSha256: sha256(stdout), stderrSha256: sha256(stderr), outputTruncated: false,
      isolation: {enforced: true, bootstrapSha256, namespaces: gate.namespaces, programStart: launchProtocol.started,
        limits, unit, network: false, cleanEnvironment: true, processesTerminated: true, scratchRemoved: true},
      startedAt, completedAt: new Date().toISOString(),
      interpretation: 'Observed argv execution on this exact snapshot; exit code and stdout do not by themselves establish semantic correctness. Scratch writes are discarded. Captured streams contain bytes actually received, not an attestation that every descendant emitted its intended output. Node test children can discard their reporter output under this sandbox; an aggregate file PASS does not establish subtest coverage. Inspect assertions and completion evidence without changing the required command or isolation.'};
  }
}
