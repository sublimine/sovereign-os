#!/usr/bin/env node
// Bounded, real OS preflight. Not a production runner or a sandbox certificate.
// Creates only synthetic fixtures; preserves them and the report for inspection.
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createHash} from 'node:crypto';
import {readFileSync, writeFileSync, mkdirSync, mkdtempSync, realpathSync,
  readlinkSync, symlinkSync, existsSync} from 'node:fs';
import {createServer, createConnection} from 'node:net';
import {createSocket} from 'node:dgram';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';

const codex = realpathSync('/home/cardeex/.local/bin/codex');
const base = mkdtempSync('/tmp/sovereign-isolation-check-');
const homeBase = mkdtempSync('/home/cardeex/codex-workspace/isolation-canary-');
const job = join(base, 'job');
const outside = join(base, 'outside');
mkdirSync(job, {mode: 0o700});
mkdirSync(outside, {mode: 0o700});
const allowedFile = join(job, 'allowed.txt');
const outsideFile = join(outside, 'denied.txt');
const homeFile = join(homeBase, 'denied.txt');
const readOnlyFile = join(outside, 'read-only.txt');
const outFile = join(job, 'output.txt');
const output = process.argv[2] ?? join(base, 'results.json');
assert(!existsSync(output), 'Refusing to overwrite an existing report');
const marker = 'SYNTHETIC-ISOLATION-CANARY\n';
for (const file of [allowedFile, outsideFile, homeFile, readOnlyFile]) {
  writeFileSync(file, marker, {flag: 'wx', mode: 0o600});
}
symlinkSync(outsideFile, join(job, 'outside-link'));
const hostNamespaces = Object.fromEntries(['pid', 'net', 'mnt', 'user'].map(
  name => [name, readlinkSync(`/proc/self/ns/${name}`)]));

async function listen(server, options) {
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(options, () => { server.off('error', reject); resolve(); });
  });
}
async function connect(options) {
  await new Promise((resolve, reject) => {
    const client = createConnection(options);
    client.setTimeout(2000, () => client.destroy(new Error('Control connection timed out')));
    client.once('error', reject);
    client.once('connect', () => { client.destroy(); resolve(); });
  });
}
async function run(args) {
  return await new Promise((resolve, reject) => {
    // Do not inherit the controller's environment or extra file descriptors.
    const child = spawn(codex, args, {cwd: job, detached: true,
      env: {PATH: '/usr/bin:/bin', LANG: 'C.UTF-8', LC_ALL: 'C.UTF-8'},
      stdio: ['ignore', 'pipe', 'pipe']});
    let stdout = '', stderr = '', stopReason = null;
    function stop(reason) {
      stopReason ??= reason;
      if (child.pid) {
        try { process.kill(-child.pid, 'SIGKILL'); }
        catch (error) { if (error.code !== 'ESRCH') reject(error); }
      }
    }
    const timer = setTimeout(() => stop('timeout'), 15000);
    child.stdout.on('data', chunk => {
      if (stdout.length + chunk.length > 128 * 1024) stop('stdout-limit');
      else stdout += chunk.toString();
    });
    child.stderr.on('data', chunk => {
      if (stderr.length + chunk.length > 128 * 1024) stop('stderr-limit');
      else stderr += chunk.toString();
    });
    child.once('error', error => { clearTimeout(timer); reject(error); });
    child.once('close', (code, signal) => {
      clearTimeout(timer);
      resolve({code, signal, stopReason, stdout, stderr});
    });
  });
}

const tcp = createServer(socket => socket.end());
const unix = createServer(socket => socket.end());
const udp = createSocket('udp4');
const unixPath = join(outside, 'control.sock');
try {
  await listen(tcp, {host: '127.0.0.1', port: 0});
  await listen(unix, {path: unixPath});
  await new Promise((resolve, reject) => {
    udp.once('error', reject);
    udp.bind(0, '127.0.0.1', resolve);
  });
  await connect({host: '127.0.0.1', port: tcp.address().port});
  await connect({path: unixPath});
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('UDP control timed out')), 2000);
    udp.once('message', message => {
      clearTimeout(timer);
      try { assert.equal(message.toString(), 'control'); resolve(); }
      catch (error) { reject(error); }
    });
    udp.send('control', udp.address().port, '127.0.0.1', error => {
      if (error) { clearTimeout(timer); reject(error); }
    });
  });
  const controls = {outsideReadable: readFileSync(outsideFile, 'utf8') === marker,
    homeCanaryReadable: readFileSync(homeFile, 'utf8') === marker,
    tcpReachable: true, udpReachable: true, unixReachable: true};
  assert(Object.values(controls).every(Boolean));
  const config = {job, outsideFile, homeFile, readOnlyFile, allowedFile, outFile,
    marker, hostPid: process.pid, tcpPort: tcp.address().port,
    udpPort: udp.address().port, unixPath, hostNamespaces};
  const profile = `permissions.post_install.filesystem={":minimal"="read",${JSON.stringify(job)}="write",${JSON.stringify(codex)}="read",${JSON.stringify(readOnlyFile)}="read"}`;
  const args = ['sandbox', '-P', 'post_install', '-c', profile,
    '-c', 'permissions.post_install.network.enabled=false', '-C', job, '--'];
  const startup = await run([...args, '/usr/bin/true']);
  const probeCode = String.raw`
import errno, json, os, socket, subprocess, sys
c = json.loads(sys.argv[1])
checks = []
def record(name, passed, observed):
    checks.append(dict(name=name, passed=bool(passed), observed=observed))
def read(path):
    with open(path, 'r') as handle:
        return handle.read()
def expect_value(name, fn, expected):
    try:
        value = fn()
        record(name, value == expected, value)
    except Exception as error:
        record(name, False, repr(error))
file_denials = {errno.EACCES, errno.EPERM, errno.ENOENT, errno.ENOTDIR, errno.EROFS}
def denied(name, fn, accepted=file_denials):
    try:
        fn()
        record(name, False, 'operation unexpectedly allowed')
    except OSError as error:
        record(name, error.errno in accepted, dict(errno=error.errno, error=error.strerror))
    except Exception as error:
        record(name, False, repr(error))
def open_write_without_mutating(path):
    fd = os.open(path, os.O_WRONLY)
    os.close(fd)
expect_value('read_allowed_job', lambda: read(c['allowedFile']), c['marker'])
expect_value('read_explicit_readonly', lambda: read(c['readOnlyFile']), c['marker'])
def write_allowed():
    with open(c['outFile'], 'x') as handle:
        handle.write('SYNTHETIC-OUTPUT\n')
    return read(c['outFile'])
expect_value('write_allowed_job', write_allowed, 'SYNTHETIC-OUTPUT\n')
denied('read_denied_outside', lambda: read(c['outsideFile']))
denied('read_denied_home_canary', lambda: read(c['homeFile']))
denied('write_denied_outside', lambda: open_write_without_mutating(c['outsideFile']))
denied('write_denied_readonly', lambda: open_write_without_mutating(c['readOnlyFile']))
denied('read_denied_symlink_escape', lambda: read(c['job'] + '/outside-link'))
denied('write_denied_symlink_escape', lambda: open_write_without_mutating(c['job'] + '/outside-link'))
denied('hardlink_import_denied', lambda: os.link(c['outsideFile'], c['job'] + '/imported-link'),
       file_denials | {errno.EXDEV})
denied('proc_self_root_escape_denied', lambda: read('/proc/self/root' + c['outsideFile']))
denied('proc_host_root_escape_denied', lambda: read('/proc/' + str(c['hostPid']) + '/root' + c['outsideFile']))
child_code = '''import errno,sys
try:
    open(sys.argv[1]).close()
except OSError as error:
    sys.exit(13 if error.errno in (errno.ENOENT,errno.ENOTDIR,errno.EPERM,errno.EACCES) else 14)
sys.exit(0)
'''
expect_value('subprocess_inherits_read_denial', lambda: subprocess.run(
    ['/usr/bin/python3', '-c', child_code, c['outsideFile']],
    stdin=subprocess.DEVNULL, stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=3).returncode, 13)
def tcp_connect():
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.settimeout(2)
        sock.connect(('127.0.0.1', c['tcpPort']))
def udp_send():
    with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as sock:
        sock.settimeout(2)
        sock.sendto(b'synthetic', ('127.0.0.1', c['udpPort']))
def unix_connect():
    with socket.socket(socket.AF_UNIX, socket.SOCK_STREAM) as sock:
        sock.settimeout(2)
        sock.connect(c['unixPath'])
denied('tcp_ipv4_denied', tcp_connect, {errno.EPERM, errno.EACCES})
denied('udp_ipv4_denied', udp_send, {errno.EPERM, errno.EACCES})
denied('unix_outside_path_denied', unix_connect)
for name, outer in c['hostNamespaces'].items():
    try:
        inner = os.readlink('/proc/self/ns/' + name)
        record(name + '_namespace_distinct', inner != outer, dict(host=outer, sandbox=inner))
    except OSError as error:
        record(name + '_namespace_distinct', False, repr(error))
status = dict(line.split(':', 1) for line in read('/proc/self/status').splitlines() if ':' in line)
record('no_new_privileges', status.get('NoNewPrivs', '').strip() == '1', status.get('NoNewPrivs', '').strip())
record('no_effective_capabilities', int(status.get('CapEff', '1').strip(), 16) == 0,
       status.get('CapEff', '').strip())
record('seccomp_filter_active', status.get('Seccomp', '').strip() == '2', status.get('Seccomp', '').strip())
print(json.dumps(dict(checks=checks, environmentKeys=sorted(os.environ.keys()))))
sys.exit(0 if all(check['passed'] for check in checks) else 1)
`;
  const execution = startup.code === 0 && !startup.stopReason
    ? await run([...args, '/usr/bin/python3', '-c', probeCode, JSON.stringify(config)])
    : null;
  let details = null, parseError = null;
  if (execution) {
    try { details = JSON.parse(execution.stdout); }
    catch (error) { parseError = String(error); }
  }
  const hostPostchecks = {
    outsideUnchanged: readFileSync(outsideFile, 'utf8') === marker,
    homeCanaryUnchanged: readFileSync(homeFile, 'utf8') === marker,
    readOnlyUnchanged: readFileSync(readOnlyFile, 'utf8') === marker,
    allowedOutputObserved: existsSync(outFile) && readFileSync(outFile, 'utf8') === 'SYNTHETIC-OUTPUT\n',
  };
  const passed = startup.code === 0 && execution?.code === 0 && !execution.stopReason
    && Array.isArray(details?.checks) && details.checks.length === 23
    && details.checks.every(check => check.passed) && Object.values(hostPostchecks).every(Boolean);
  const report = {schema: 'sovereign.isolation-preflight.v1', observedAt: new Date().toISOString(),
    simulation: false, passed, codex, fixtures: {base, homeBase, job},
    scriptSha256: createHash('sha256').update(readFileSync(fileURLToPath(import.meta.url))).digest('hex'),
    sandboxArgs: args, hostControls: controls, startup,
    execution: execution && {code: execution.code, signal: execution.signal,
      stopReason: execution.stopReason, stderr: execution.stderr},
    parseError, details, hostPostchecks,
    limits: ['Synthetic bounded probes only; not a production runner accreditation.',
      'Environment and FDs sanitized by this harness; no claim about arbitrary callers.',
      'No test of pre-existing hardlinks, hostile mounts, same-UID races or kernel exploits.',
      'No IPv6, abstract UNIX, descriptor injection, process escape, resource exhaustion or OS-crash suite.',
      'No real credentials accessed; no model calls, external requests, sudo or persisted policy changes.']};
  writeFileSync(output, JSON.stringify(report, null, 2) + '\n', {flag: 'wx', mode: 0o600});
  console.log(JSON.stringify({report: output, passed, startup: startup.code,
    checks: details?.checks.length ?? 0,
    failedChecks: details?.checks.filter(check => !check.passed) ?? [],
    parseError, hostPostchecks, stderr: execution?.stderr ?? startup.stderr}, null, 2));
  process.exitCode = passed ? 0 : 1;
} finally {
  if (tcp.listening) await new Promise(resolve => tcp.close(resolve));
  if (unix.listening) await new Promise(resolve => unix.close(resolve));
  try { udp.close(); } catch (error) { if (error.code !== 'ERR_SOCKET_DGRAM_NOT_RUNNING') throw error; }
}
