import assert from 'node:assert/strict';
import {mkdtempSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import test from 'node:test';

import {NullProjectRuntimeSupervisor, ProjectRuntimeSupervisor} from '../project-runtime-supervisor.mjs';
import {RuntimeReleaseRegistry} from '../runtime-release-registry.mjs';
import {buildRuntimeRelease} from '../../factory/lib/runtime-release.mjs';

const projectId = 'project:12345678-1234-1234-1234-123456789abc';

function pinnedRelease(t) {
  const releasesDirectory = mkdtempSync(join(tmpdir(), 'sovereign-project-runtime-release-'));
  t.after(() => rmSync(releasesDirectory, {recursive: true, force: true}));
  const release = buildRuntimeRelease(releasesDirectory, {
    files: [{
      path: 'factory/bin/sovereign.mjs',
      content: '#!/usr/bin/env node\nprocess.exitCode = 0;\n',
    }],
  });
  return {
    release,
    releasesDirectory,
    cliPath: join(release.directory, 'factory', 'bin', 'sovereign.mjs'),
  };
}

test('project supervisor derives a narrow transient unit from trusted inputs only', async () => {
  const calls = [];
  const supervisor = new ProjectRuntimeSupervisor({
    factoryBinary: '/usr/bin/true',
    workingDirectory: '/tmp',
    environment: {PATH: '/usr/bin:/bin', HOME: '/tmp'},
    command: async (binary, args) => {
      calls.push({binary, args});
      if (binary === '/usr/bin/systemctl') return {stdout: 'LoadState=not-found\nActiveState=inactive\nSubState=dead\n'};
      return {stdout: 'Running as unit: sovereign-project-test.service\n'};
    },
  });
  const result = await supervisor.start({projectId, stateDir: '/tmp/sovereign-project-state'});
  assert.equal(result.started, true);
  const start = calls.find(call => call.binary === '/usr/bin/systemd-run');
  assert.ok(start);
  assert.equal(start.args.includes('/usr/bin/true'), true);
  assert.equal(start.args.includes('serve'), true);
  assert.equal(start.args.includes('--state-dir'), true);
  assert.equal(start.args.includes('/tmp/sovereign-project-state'), true);
  assert.equal(start.args.some(arg => arg.includes(projectId)), false);
  assert.equal(start.args.some(arg => arg.includes('ReadWritePaths=/tmp/sovereign-project-state')), true);
  assert.equal(start.args.some(arg => arg.startsWith('--setenv=XDG_RUNTIME_DIR=/run/user/')), true);
  assert.equal(start.args.some(arg => arg.startsWith('--setenv=DBUS_SESSION_BUS_ADDRESS=unix:path=/run/user/')), true);
});

test('project supervisor launches a server-resolved immutable release through an allowlisted Node binary', async t => {
  const fixture = pinnedRelease(t);
  const calls = [];
  const resolved = [];
  const registry = new RuntimeReleaseRegistry({
    releaseRoot: fixture.releasesDirectory,
    nodeExecutable: process.execPath,
    defaultReleaseId: fixture.release.releaseId,
  });
  const supervisor = new ProjectRuntimeSupervisor({
    factoryBinary: '/usr/bin/true',
    workingDirectory: '/tmp',
    allowedNodeBinaries: [process.execPath],
    allowedReleaseRoots: [fixture.releasesDirectory],
    releaseCommandResolver: async releaseId => {
      resolved.push(releaseId);
      return registry.commandFor({releaseId});
    },
    environment: {PATH: '/usr/bin:/bin', HOME: '/tmp'},
    command: async (binary, args, options) => {
      calls.push({binary, args, options});
      if (binary === '/usr/bin/systemctl') return {stdout: 'LoadState=not-found\nActiveState=inactive\nSubState=dead\n'};
      return {stdout: 'Running as unit: sovereign-project-test.service\n'};
    },
  });
  const stateDir = '/tmp/sovereign-project-state';
  const result = await supervisor.start({projectId, stateDir, releaseId: fixture.release.releaseId});
  assert.equal(result.started, true);
  assert.equal(result.releaseId, fixture.release.releaseId);
  assert.deepEqual(resolved, [fixture.release.releaseId]);
  const start = calls.find(call => call.binary === '/usr/bin/systemd-run');
  assert.ok(start);
  const binaryIndex = start.args.indexOf(process.execPath);
  assert.notEqual(binaryIndex, -1);
  assert.deepEqual(start.args.slice(binaryIndex), [
    process.execPath,
    fixture.cliPath,
    'serve', '--state-dir', stateDir,
  ]);
  assert.equal(start.args.includes('--property=WorkingDirectory=' + fixture.release.directory), true);
  assert.equal(start.options.cwd, fixture.release.directory);
  assert.equal(start.args.includes('/usr/bin/true'), false);
});

test('project supervisor refuses an unallowlisted or malformed pinned release before systemd-run', async t => {
  const fixture = pinnedRelease(t);
  const otherRoot = mkdtempSync(join(tmpdir(), 'sovereign-project-runtime-other-'));
  t.after(() => rmSync(otherRoot, {recursive: true, force: true}));
  const calls = [];
  const supervisor = new ProjectRuntimeSupervisor({
    factoryBinary: '/usr/bin/true',
    workingDirectory: '/tmp',
    allowedNodeBinaries: [process.execPath],
    allowedReleaseRoots: [otherRoot],
    releaseCommandResolver: async releaseId => ({
      releaseId,
      executable: process.execPath,
      argvPrefix: [fixture.cliPath],
      cwd: fixture.release.directory,
    }),
    command: async (binary, args) => {
      calls.push({binary, args});
      return {stdout: 'LoadState=not-found\nActiveState=inactive\nSubState=dead\n'};
    },
  });
  await assert.rejects(
    () => supervisor.start({projectId, stateDir: '/tmp/sovereign-project-state', releaseId: fixture.release.releaseId}),
    error => error?.code === 'PROJECT_RUNTIME_RELEASE_NOT_ALLOWED',
  );
  await assert.rejects(
    () => supervisor.start({projectId, stateDir: '/tmp/sovereign-project-state', releaseId: '../not-a-release'}),
    error => error?.code === 'PROJECT_RUNTIME_RELEASE_ID',
  );
  assert.equal(calls.length, 0);
});

test('project supervisor rejects a resolver result whose release identity differs from the server-selected id', async t => {
  const fixture = pinnedRelease(t);
  const supervisor = new ProjectRuntimeSupervisor({
    factoryBinary: '/usr/bin/true',
    workingDirectory: '/tmp',
    allowedNodeBinaries: [process.execPath],
    allowedReleaseRoots: [fixture.releasesDirectory],
    releaseCommandResolver: async () => ({
      releaseId: '0'.repeat(64),
      executable: process.execPath,
      argvPrefix: [fixture.cliPath],
      cwd: fixture.release.directory,
    }),
    command: async () => ({stdout: 'LoadState=not-found\nActiveState=inactive\nSubState=dead\n'}),
  });
  await assert.rejects(
    () => supervisor.start({projectId, stateDir: '/tmp/sovereign-project-state', releaseId: fixture.release.releaseId}),
    error => error?.code === 'PROJECT_RUNTIME_RELEASE_IDENTITY',
  );
});

test('project supervisor rejects a pinned command whose working directory is not its verified release root', async t => {
  const fixture = pinnedRelease(t);
  const calls = [];
  const supervisor = new ProjectRuntimeSupervisor({
    factoryBinary: '/usr/bin/true',
    workingDirectory: '/tmp',
    allowedNodeBinaries: [process.execPath],
    allowedReleaseRoots: [fixture.releasesDirectory],
    releaseCommandResolver: async releaseId => ({
      releaseId,
      executable: process.execPath,
      argvPrefix: [fixture.cliPath],
      cwd: '/tmp',
    }),
    command: async (binary, args) => {
      calls.push({binary, args});
      return {stdout: 'LoadState=not-found\nActiveState=inactive\nSubState=dead\n'};
    },
  });
  await assert.rejects(
    () => supervisor.start({projectId, stateDir: '/tmp/sovereign-project-state', releaseId: fixture.release.releaseId}),
    error => error?.code === 'PROJECT_RUNTIME_RELEASE_NOT_ALLOWED',
  );
  assert.equal(calls.length, 0);
});

test('project supervisor rejects a non-allowlisted Node binary for a valid release', async t => {
  const fixture = pinnedRelease(t);
  const supervisor = new ProjectRuntimeSupervisor({
    factoryBinary: '/usr/bin/true',
    workingDirectory: '/tmp',
    allowedNodeBinaries: [process.execPath],
    allowedReleaseRoots: [fixture.releasesDirectory],
    releaseCommandResolver: async releaseId => ({
      releaseId,
      executable: '/usr/bin/true',
      argvPrefix: [fixture.cliPath],
      cwd: fixture.release.directory,
    }),
    command: async () => ({stdout: 'LoadState=not-found\nActiveState=inactive\nSubState=dead\n'}),
  });
  await assert.rejects(
    () => supervisor.start({projectId, stateDir: '/tmp/sovereign-project-state', releaseId: fixture.release.releaseId}),
    error => error?.code === 'PROJECT_RUNTIME_NODE_NOT_ALLOWED',
  );
});

test('project supervisor keeps the legacy wrapper route explicit when no release id is selected', async () => {
  const calls = [];
  const supervisor = new ProjectRuntimeSupervisor({
    factoryBinary: '/usr/bin/true',
    workingDirectory: '/tmp',
    command: async (binary, args, options) => {
      calls.push({binary, args, options});
      if (binary === '/usr/bin/systemctl') return {stdout: 'LoadState=not-found\nActiveState=inactive\nSubState=dead\n'};
      return {stdout: ''};
    },
  });
  await supervisor.start({projectId, stateDir: '/tmp/sovereign-project-state'});
  const start = calls.find(call => call.binary === '/usr/bin/systemd-run');
  assert.ok(start);
  const binaryIndex = start.args.indexOf('/usr/bin/true');
  assert.deepEqual(start.args.slice(binaryIndex), ['/usr/bin/true', 'serve', '--state-dir', '/tmp/sovereign-project-state']);
  assert.equal(start.args.includes('--property=WorkingDirectory=/tmp'), true);
  assert.equal(start.options.cwd, '/tmp');
});

test('project supervisor never falls back to the wrapper when a pinned release cannot be resolved', async () => {
  const calls = [];
  const supervisor = new ProjectRuntimeSupervisor({
    factoryBinary: '/usr/bin/true',
    workingDirectory: '/tmp',
    command: async (binary, args) => {
      calls.push({binary, args});
      return {stdout: 'LoadState=not-found\nActiveState=inactive\nSubState=dead\n'};
    },
  });
  await assert.rejects(
    () => supervisor.start({projectId, stateDir: '/tmp/sovereign-project-state', releaseId: 'a'.repeat(64)}),
    error => error?.code === 'PROJECT_RUNTIME_RELEASE_UNAVAILABLE',
  );
  assert.equal(calls.length, 0);
});

test('project supervisor does not duplicate a running project worker', async () => {
  const calls = [];
  const supervisor = new ProjectRuntimeSupervisor({
    factoryBinary: '/usr/bin/true',
    workingDirectory: '/tmp',
    command: async (binary, args) => {
      calls.push({binary, args});
      return {stdout: 'LoadState=loaded\nActiveState=active\nSubState=running\nMainPID=42\nControlGroup=/user.slice/user-' + process.getuid() + '.slice/user@' + process.getuid() + '.service/app.slice/' + args[2] + '\n'};
    },
  });
  const result = await supervisor.start({projectId, stateDir: '/tmp/sovereign-project-state'});
  assert.equal(result.started, false);
  assert.equal(result.active, true);
  assert.equal(calls.some(call => call.binary === '/usr/bin/systemd-run'), false);
});

test('project supervisor rejects a worker owned by a nested manager', async () => {
  const supervisor = new ProjectRuntimeSupervisor({
    factoryBinary: '/usr/bin/true',
    workingDirectory: '/tmp',
    command: async () => ({stdout: 'LoadState=loaded\nActiveState=active\nSubState=running\nMainPID=42\nControlGroup=/user.slice/user-' + process.getuid() + '.slice/user@' + process.getuid() + '.service/app-systemd\\x2dsession.slice/systemd-session@11.service/app.slice/not-the-project.service\n'}),
  });
  const status = await supervisor.status({projectId});
  assert.equal(status.active, false);
  assert.equal(status.state, 'SUPERVISOR_SCOPE_INVALID');
  assert.equal(status.managerScopeVerified, false);
});

test('null supervisor makes lack of a worker explicit', async () => {
  const supervisor = new NullProjectRuntimeSupervisor();
  const status = await supervisor.status({projectId});
  assert.equal(status.state, 'NOT_SUPERVISED');
  assert.equal((await supervisor.start({projectId})).started, false);
});
