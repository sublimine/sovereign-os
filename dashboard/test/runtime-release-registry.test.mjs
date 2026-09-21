import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import test from 'node:test';

import {buildRuntimeRelease} from '../../factory/lib/runtime-release.mjs';
import {
  RuntimeReleaseRegistry,
  RuntimeReleaseRegistryError,
  assertRuntimeReleaseId,
} from '../runtime-release-registry.mjs';

function fixture(t) {
  const root = fs.mkdtempSync(join(tmpdir(), 'sublimine-runtime-registry-'));
  t.after(() => fs.rmSync(root, {recursive: true, force: true}));
  const built = buildRuntimeRelease(root, {
    files: [{
      path: 'factory/bin/sovereign.mjs',
      content: '#!/usr/bin/env node\nprocess.stdout.write("fixture\\n");\n',
    }],
  });
  return {root, built};
}

function registryFor(fixtureValue) {
  return new RuntimeReleaseRegistry({
    releaseRoot: fixtureValue.root,
    nodeExecutable: process.execPath,
    defaultReleaseId: fixtureValue.built.releaseId,
  });
}

test('release registry returns an immutable verified CLI command for its trusted default', t => {
  const value = fixture(t);
  const registry = registryFor(value);
  const command = registry.commandFor();

  assert.equal(command.releaseId, value.built.releaseId);
  assert.equal(command.executable, fs.realpathSync(process.execPath));
  assert.deepEqual(command.argvPrefix, [join(value.built.directory, 'factory', 'bin', 'sovereign.mjs')]);
  assert.equal(command.cwd, value.built.directory);
  assert.equal(Object.isFrozen(command), true);
  assert.equal(Object.isFrozen(command.argvPrefix), true);
  assert.throws(() => { command.argvPrefix.push('serve'); }, TypeError);
});

test('release registry rejects unknown IDs and never discovers releases dynamically', t => {
  const value = fixture(t);
  const registry = registryFor(value);
  const unregistered = buildRuntimeRelease(value.root, {
    files: [{path: 'factory/bin/sovereign.mjs', content: '#!/usr/bin/env node\nprocess.stdout.write("unregistered\\n");\n'}],
  });
  assert.throws(() => registry.commandFor({releaseId: unregistered.releaseId}), {
    name: 'RuntimeReleaseRegistryError',
    code: 'RUNTIME_RELEASE_UNKNOWN',
  });
  assert.throws(() => assertRuntimeReleaseId('../' + value.built.releaseId), {
    name: 'RuntimeReleaseRegistryError',
    code: 'RUNTIME_RELEASE_ID',
  });
});

test('release registry accepts only an explicit immutable operator allowlist', t => {
  const value = fixture(t);
  const previous = buildRuntimeRelease(value.root, {
    files: [{path: 'factory/bin/sovereign.mjs', content: '#!/usr/bin/env node\nprocess.stdout.write("previous\\n");\n'}],
  });
  const registry = new RuntimeReleaseRegistry({
    releaseRoot: value.root,
    nodeExecutable: process.execPath,
    defaultReleaseId: value.built.releaseId,
    allowedReleaseIds: [previous.releaseId, value.built.releaseId],
  });

  const priorCommand = registry.commandFor({releaseId: previous.releaseId});
  assert.equal(priorCommand.releaseId, previous.releaseId);
  assert.equal(priorCommand.cwd, previous.directory);
  assert.deepEqual(registry.allowedReleaseIds, [previous.releaseId, value.built.releaseId]);
  assert.equal(Object.isFrozen(registry.allowedReleaseIds), true);
  assert.throws(() => { registry.allowedReleaseIds.push('f'.repeat(64)); }, TypeError);
  assert.throws(() => new RuntimeReleaseRegistry({
    releaseRoot: value.root,
    nodeExecutable: process.execPath,
    defaultReleaseId: value.built.releaseId,
    allowedReleaseIds: [previous.releaseId],
  }), {
    name: 'RuntimeReleaseRegistryError',
    code: 'RUNTIME_RELEASE_CONFIGURATION',
  });
});

test('release registry rejects path-shaped requests before release verification', t => {
  const value = fixture(t);
  const registry = registryFor(value);
  assert.throws(() => registry.commandFor({releaseId: '../' + value.built.releaseId}), {
    name: 'RuntimeReleaseRegistryError',
    code: 'RUNTIME_RELEASE_ID',
  });
  assert.throws(() => registry.commandFor({directory: value.built.directory}), {
    name: 'RuntimeReleaseRegistryError',
    code: 'RUNTIME_RELEASE_REQUEST',
  });
});

test('release registry verifies the release immediately before command use and rejects tampering', t => {
  const value = fixture(t);
  const registry = registryFor(value);
  const script = join(value.built.directory, 'factory', 'bin', 'sovereign.mjs');
  fs.chmodSync(script, 0o600);
  fs.writeFileSync(script, '#!/usr/bin/env node\nthrow Error("tampered");\n');

  assert.throws(() => registry.commandFor(), error => {
    assert.notEqual(error, null);
    assert.equal(error instanceof RuntimeReleaseRegistryError, false);
    assert.match(String(error.code), /^RELEASE_(?:INTEGRITY|PATH)$/);
    return true;
  });
});
