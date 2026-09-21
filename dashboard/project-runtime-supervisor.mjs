/**
 * A narrow, per-project queue supervisor.
 *
 * It starts only the verified Sovereign CLI with an internally-derived state
 * directory. Browser input never becomes an executable, a unit name, a path,
 * or a systemd property.
 */
import {spawn} from 'node:child_process';
import {createHash} from 'node:crypto';
import {lstatSync, realpathSync} from 'node:fs';
import {homedir} from 'node:os';
import {basename, dirname, isAbsolute, join, resolve} from 'node:path';

import {ProjectSpaceError, assertProjectId} from './project-spaces.mjs';
import {verifyRuntimeRelease} from '../factory/lib/runtime-release.mjs';

const RELEASE_ID_PATTERN = /^[a-f0-9]{64}$/;
const RELEASE_CLI_SUFFIX = ['factory', 'bin', 'sovereign.mjs'];

function hash(value) {
  return createHash('sha256').update(value).digest('hex');
}

function unitName(projectId) {
  assertProjectId(projectId);
  return 'sovereign-project-' + hash(projectId).slice(0, 18) + '.service';
}

function expectedControlGroup(unit) {
  const uid = typeof process.getuid === 'function' ? process.getuid() : null;
  if (!Number.isInteger(uid) || uid < 0) return null;
  return `/user.slice/user-${uid}.slice/user@${uid}.service/app.slice/${unit}`;
}

function parseSystemctl(output) {
  const properties = {};
  for (const line of String(output ?? '').split('\n')) {
    const index = line.indexOf('=');
    if (index < 1) continue;
    properties[line.slice(0, index)] = line.slice(index + 1);
  }
  return properties;
}

function safeRuntimePath(stateDir) {
  if (typeof stateDir !== 'string' || !isAbsolute(stateDir)) {
    throw new ProjectSpaceError('La raíz de runtime del proyecto no es válida.', 'PROJECT_RUNTIME_PATH', 500);
  }
  return resolve(stateDir);
}

function absolutePath(value, code, message) {
  if (typeof value !== 'string' || !value || !isAbsolute(value)) {
    throw new ProjectSpaceError(message, code, 500);
  }
  return resolve(value);
}

function realDirectory(value, code, message) {
  const requested = absolutePath(value, code, message);
  try {
    const actual = realpathSync(requested);
    if (!lstatSync(actual).isDirectory()) throw new Error('not-directory');
    return actual;
  } catch {
    throw new ProjectSpaceError(message, code, 500);
  }
}

function realRegularFile(value, code, message) {
  const requested = absolutePath(value, code, message);
  try {
    const actual = realpathSync(requested);
    if (!lstatSync(actual).isFile()) throw new Error('not-file');
    return actual;
  } catch {
    throw new ProjectSpaceError(message, code, 500);
  }
}

function normalizeNodeBinaries(value) {
  if (!Array.isArray(value) || !value.length) {
    throw new ProjectSpaceError('La lista de binarios Node permitidos no es válida.', 'PROJECT_RUNTIME_NODE_ALLOWLIST', 500);
  }
  return new Set(value.map(binary => realRegularFile(
    binary,
    'PROJECT_RUNTIME_NODE_ALLOWLIST',
    'La lista de binarios Node permitidos no es válida.',
  )));
}

function normalizeReleaseRoots(value) {
  if (!Array.isArray(value) || !value.length) {
    throw new ProjectSpaceError('La lista de releases permitidas no es válida.', 'PROJECT_RUNTIME_RELEASE_ALLOWLIST', 500);
  }
  return new Set(value.map(directory => realDirectory(
    directory,
    'PROJECT_RUNTIME_RELEASE_ALLOWLIST',
    'La lista de releases permitidas no es válida.',
  )));
}

function requestedReleaseId(value) {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string' || !RELEASE_ID_PATTERN.test(value)) {
    throw new ProjectSpaceError('La release de runtime solicitada no es válida.', 'PROJECT_RUNTIME_RELEASE_ID', 500);
  }
  return value;
}

function releaseCommandShape(value, releaseId) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) {
    throw new ProjectSpaceError('La release de runtime no pudo resolverse.', 'PROJECT_RUNTIME_RELEASE_UNAVAILABLE', 503);
  }
  const keys = Object.keys(value).sort();
  const expected = ['argvPrefix', 'cwd', 'executable', 'releaseId'];
  if (keys.length !== expected.length || keys.some((key, index) => key !== expected[index])) {
    throw new ProjectSpaceError('La release de runtime no pudo resolverse.', 'PROJECT_RUNTIME_RELEASE_UNAVAILABLE', 503);
  }
  if (value.releaseId !== releaseId) {
    throw new ProjectSpaceError('La release de runtime no coincide con la misión.', 'PROJECT_RUNTIME_RELEASE_IDENTITY', 500);
  }
  return value;
}

function pinnedReleaseCommand(value, releaseId, {allowedNodeBinaries, allowedReleaseRoots}) {
  const command = releaseCommandShape(value, releaseId);
  if (!Array.isArray(command.argvPrefix) || command.argvPrefix.length !== 1 || typeof command.argvPrefix[0] !== 'string') {
    throw new ProjectSpaceError('La CLI de la release no pudo resolverse.', 'PROJECT_RUNTIME_RELEASE_UNAVAILABLE', 503);
  }
  const executable = realRegularFile(
    command.executable,
    'PROJECT_RUNTIME_RELEASE_COMMAND',
    'El binario Node de la release no es válido.',
  );
  if (!allowedNodeBinaries.has(executable)) {
    throw new ProjectSpaceError('El binario Node de la release no está permitido.', 'PROJECT_RUNTIME_NODE_NOT_ALLOWED', 500);
  }

  const cliPath = absolutePath(
    command.argvPrefix[0],
    'PROJECT_RUNTIME_RELEASE_COMMAND',
    'La CLI de la release no es válida.',
  );
  const releaseDirectory = dirname(dirname(dirname(cliPath)));
  const workingDirectory = absolutePath(
    command.cwd,
    'PROJECT_RUNTIME_RELEASE_CWD',
    'El directorio de trabajo de la release no es válido.',
  );
  const expectedCliPath = join(releaseDirectory, ...RELEASE_CLI_SUFFIX);
  if (cliPath !== expectedCliPath || workingDirectory !== releaseDirectory || basename(releaseDirectory) !== releaseId || !allowedReleaseRoots.has(dirname(releaseDirectory))) {
    throw new ProjectSpaceError('La CLI de la release no está permitida.', 'PROJECT_RUNTIME_RELEASE_NOT_ALLOWED', 500);
  }

  let release;
  try {
    release = verifyRuntimeRelease(releaseDirectory, releaseId);
  } catch {
    throw new ProjectSpaceError('La integridad de la release no pudo verificarse.', 'PROJECT_RUNTIME_RELEASE_INTEGRITY', 503);
  }
  if (release.releaseId !== releaseId || release.directory !== releaseDirectory) {
    throw new ProjectSpaceError('La identidad de la release no pudo verificarse.', 'PROJECT_RUNTIME_RELEASE_INTEGRITY', 503);
  }
  try {
    if (!lstatSync(cliPath).isFile() || lstatSync(cliPath).isSymbolicLink()) throw new Error('invalid-cli');
  } catch {
    throw new ProjectSpaceError('La CLI de la release no pudo verificarse.', 'PROJECT_RUNTIME_RELEASE_INTEGRITY', 503);
  }
  return Object.freeze({releaseId, executable, argvPrefix: Object.freeze([cliPath]), workingDirectory});
}

function persistentUserManagerEnvironment({home, path}) {
  // An XRDP/nested systemd session can export a private session bus. Project
  // workers must join the persistent user manager instead, otherwise they
  // disappear with that session while the main console remains alive.
  const uid = typeof process.getuid === 'function' ? process.getuid() : null;
  if (!Number.isInteger(uid) || uid < 0) {
    throw new ProjectSpaceError('No se pudo resolver el gestor de usuario persistente.', 'PROJECT_RUNTIME_MANAGER', 503);
  }
  const runtimeDirectory = '/run/user/' + uid;
  return {
    HOME: home,
    PATH: path,
    XDG_RUNTIME_DIR: runtimeDirectory,
    DBUS_SESSION_BUS_ADDRESS: 'unix:path=' + join(runtimeDirectory, 'bus'),
  };
}

export function execute(binary, args, {cwd, env, timeoutMs = 20_000} = {}) {
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(binary, args, {
      cwd,
      env: {...process.env, ...env},
      shell: false,
      windowsHide: true,
    });
    let stdout = '';
    let stderr = '';
    let settled = false;
    let forceKill;
    const finish = callback => value => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      clearTimeout(forceKill);
      callback(value);
    };
    const fail = finish(rejectPromise);
    const succeed = finish(resolvePromise);
    const timer = setTimeout(() => {
      child.kill('SIGTERM');
      forceKill = setTimeout(() => child.kill('SIGKILL'), 3_000);
      forceKill.unref?.();
      fail(new ProjectSpaceError('El supervisor local superó el tiempo permitido.', 'PROJECT_RUNTIME_TIMEOUT', 504));
    }, timeoutMs);
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', chunk => { stdout += chunk; });
    child.stderr.on('data', chunk => { stderr += chunk; });
    child.once('error', () => fail(new ProjectSpaceError('No se pudo iniciar el supervisor local.', 'PROJECT_RUNTIME_UNAVAILABLE', 503)));
    child.once('close', code => {
      if (settled) return;
      if (code !== 0) {
        fail(new ProjectSpaceError((stderr || 'El supervisor local rechazó la operación.').trim().slice(0, 600), 'PROJECT_RUNTIME_COMMAND', 502));
        return;
      }
      succeed({stdout, stderr});
    });
  });
}

export class NullProjectRuntimeSupervisor {
  async status() { return {available: false, state: 'NOT_SUPERVISED', unit: null, properties: {}}; }
  async start({projectId}) { return {available: false, state: 'NOT_SUPERVISED', unit: unitName(projectId), started: false}; }
}

export class ProjectRuntimeSupervisor {
  constructor({
    factoryBinary,
    workingDirectory,
    // This resolver is server configuration, not browser input. A caller can
    // choose only an immutable release id at start time; it never provides a
    // binary, a CLI path, a working directory, or arbitrary arguments to
    // systemd-run. The resolver's full command is validated below.
    releaseCommandResolver = null,
    allowedReleaseRoots = [],
    allowedNodeBinaries = [process.execPath],
    systemdRunBinary = '/usr/bin/systemd-run',
    systemctlBinary = '/usr/bin/systemctl',
    command = execute,
    environment = {},
  } = {}) {
    if (!factoryBinary || typeof factoryBinary !== 'string' || !isAbsolute(factoryBinary)) {
      throw new ProjectSpaceError('El binario de fábrica del supervisor no es válido.', 'PROJECT_RUNTIME_BINARY', 500);
    }
    if (!workingDirectory || typeof workingDirectory !== 'string' || !isAbsolute(workingDirectory)) {
      throw new ProjectSpaceError('El directorio de trabajo del supervisor no es válido.', 'PROJECT_RUNTIME_CWD', 500);
    }
    this.factoryBinary = resolve(factoryBinary);
    this.workingDirectory = resolve(workingDirectory);
    this.systemdRunBinary = systemdRunBinary;
    this.systemctlBinary = systemctlBinary;
    this.command = command;
    if (releaseCommandResolver !== null && typeof releaseCommandResolver !== 'function') {
      throw new ProjectSpaceError('El resolvedor de releases del supervisor no es válido.', 'PROJECT_RUNTIME_RELEASE_RESOLVER', 500);
    }
    this.releaseCommandResolver = releaseCommandResolver;
    this.allowedNodeBinaries = releaseCommandResolver ? normalizeNodeBinaries(allowedNodeBinaries) : new Set();
    this.allowedReleaseRoots = releaseCommandResolver ? normalizeReleaseRoots(allowedReleaseRoots) : new Set();
    this.environment = persistentUserManagerEnvironment({
      // The two values below are deployment configuration, never browser
      // input. XDG/DBUS are intentionally *not* inherited from a nested shell.
      home: environment.HOME || homedir(),
      path: environment.PATH || process.env.PATH || '/usr/local/bin:/usr/bin:/bin',
    });
  }

  async resolvePinnedReleaseCommand(releaseId) {
    if (!this.releaseCommandResolver) {
      throw new ProjectSpaceError('No hay una release de runtime autorizada para este supervisor.', 'PROJECT_RUNTIME_RELEASE_UNAVAILABLE', 503);
    }
    let unresolved;
    try {
      unresolved = await this.releaseCommandResolver(releaseId);
    } catch {
      throw new ProjectSpaceError('La release de runtime no pudo resolverse.', 'PROJECT_RUNTIME_RELEASE_UNAVAILABLE', 503);
    }
    return pinnedReleaseCommand(unresolved, releaseId, {
      allowedNodeBinaries: this.allowedNodeBinaries,
      allowedReleaseRoots: this.allowedReleaseRoots,
    });
  }

  async status({projectId}) {
    const unit = unitName(projectId);
    try {
      const result = await this.command(this.systemctlBinary, [
        '--user', 'show', unit,
        '--property=LoadState,ActiveState,SubState,MainPID,NRestarts,UnitFileState,ControlGroup',
      ], {cwd: this.workingDirectory, env: this.environment, timeoutMs: 8_000});
      const properties = parseSystemctl(result.stdout);
      const expected = expectedControlGroup(unit);
      const nativeActive = properties.ActiveState === 'active' && properties.SubState === 'running';
      const managerScopeVerified = nativeActive && Boolean(expected) && properties.ControlGroup === expected;
      const active = nativeActive && managerScopeVerified;
      const missing = ['not-found', ''].includes(properties.LoadState ?? '');
      const state = active ? 'ACTIVE' : (missing ? 'NOT_STARTED' : (nativeActive ? 'SUPERVISOR_SCOPE_INVALID' : String(properties.ActiveState || 'UNKNOWN').toUpperCase()));
      return {available: !missing, active, state, unit, properties, expectedControlGroup: expected, managerScopeVerified};
    } catch (error) {
      // An unavailable user manager is an operational state, not a reason to
      // accidentally fall back to a shared global queue.
      return {available: false, active: false, state: 'SUPERVISOR_UNAVAILABLE', unit, properties: {}, error: error.code ?? 'UNKNOWN'};
    }
  }

  async start({projectId, stateDir, releaseId = null}) {
    const state = safeRuntimePath(stateDir);
    const pinnedReleaseId = requestedReleaseId(releaseId);
    // Verify the sealed release immediately before every launch. Release
    // directories are immutable by deployment policy, but an administrator
    // could still alter files; the worker must not start from stale trust.
    const pinnedCommand = pinnedReleaseId
      ? await this.resolvePinnedReleaseCommand(pinnedReleaseId)
      : null;
    const before = await this.status({projectId});
    if (before.active) return {...before, started: false, ...(pinnedReleaseId ? {requestedReleaseId: pinnedReleaseId} : {})};
    const unit = unitName(projectId);
    const launch = pinnedCommand
      ? {
        binary: pinnedCommand.executable,
        args: pinnedCommand.argvPrefix,
        workingDirectory: pinnedCommand.workingDirectory,
      }
      : {binary: this.factoryBinary, args: [], workingDirectory: this.workingDirectory};
    const args = [
      '--user', '--no-block', '--collect', '--unit', unit.slice(0, -8),
      '--property=Type=simple',
      '--property=Restart=on-failure',
      '--property=RestartSec=5',
      '--property=TimeoutStopSec=45',
      '--property=KillMode=mixed',
      '--property=UMask=0077',
      '--property=NoNewPrivileges=true',
      '--property=PrivateTmp=true',
      '--property=ProtectSystem=full',
      '--property=ReadWritePaths=' + state,
      '--property=WorkingDirectory=' + launch.workingDirectory,
      '--setenv=HOME=' + this.environment.HOME,
      '--setenv=PATH=' + this.environment.PATH,
      '--setenv=XDG_RUNTIME_DIR=' + this.environment.XDG_RUNTIME_DIR,
      '--setenv=DBUS_SESSION_BUS_ADDRESS=' + this.environment.DBUS_SESSION_BUS_ADDRESS,
      launch.binary,
      ...launch.args,
      'serve', '--state-dir', state,
    ];
    await this.command(this.systemdRunBinary, args, {cwd: launch.workingDirectory, env: this.environment, timeoutMs: 15_000});
    return {
      unit,
      available: true,
      active: false,
      state: 'START_REQUESTED',
      started: true,
      ...(pinnedCommand ? {releaseId: pinnedCommand.releaseId} : {}),
    };
  }
}
