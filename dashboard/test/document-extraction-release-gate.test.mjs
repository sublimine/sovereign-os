import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {mkdtemp, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import test from 'node:test';

import {
  deriveDocumentExtractionReleaseTarget,
  parseReleaseGateArguments,
} from '../bin/document-extraction-release-gate.mjs';

const executeFile = promisify(execFile);
const gatePath = new URL('../bin/document-extraction-release-gate.mjs', import.meta.url);

test('the release target is content-addressed and only plans a root-owned installation', async () => {
  const release = await deriveDocumentExtractionReleaseTarget();
  assert.match(release.id, /^[a-f0-9]{64}$/);
  assert.equal(release.sourceSha256, release.id);
  assert.equal(release.root, '/opt/sublimine/document-extraction-v2/' + release.id);
  assert.equal(release.extractor, release.root + '/document-extractor.py');
  assert.equal(release.installation, 'ROOT_OWNED_REQUIRED');
});

test('a blocked gate does not create an explicitly requested lock', async () => {
  const root = await mkdtemp(join(tmpdir(), 'sublimine-release-gate-test-'));
  const target = join(root, 'document-extraction-toolchain.lock.json');
  try {
    await assert.rejects(
      executeFile(process.execPath, [gatePath.pathname, '--write-lock', target], {encoding: 'utf8'}),
      error => {
        assert.equal(error.code, 1);
        const output = JSON.parse(error.stdout.trim());
        assert.equal(output.state, 'UNAVAILABLE');
        assert.equal(output.write.requested, true);
        assert.equal(output.write.state, 'REFUSED');
        assert.equal(output.candidateLock, null);
        assert.equal(output.preflight.state, 'NOT_RUN');
        assert.equal(output.preflight.code, 'DOCUMENT_EXTRACTION_TOOLCHAIN_UNAVAILABLE');
        return true;
      },
    );
    assert.equal(existsSync(target), false);
  } finally {
    await rm(root, {recursive: true, force: true});
  }
});

test('the default dry run does not create a runner directory or a lock', async () => {
  const root = await mkdtemp(join(tmpdir(), 'sublimine-release-gate-dry-run-'));
  const scratch = join(root, 'must-not-exist');
  try {
    await assert.rejects(
      executeFile(process.execPath, [gatePath.pathname], {
        encoding: 'utf8',
        env: {...process.env, SUBLIMINE_DOCUMENT_EXTRACTION_RUNTIME_DIR: scratch},
      }),
      error => {
        assert.equal(error.code, 1);
        const output = JSON.parse(error.stdout.trim());
        assert.equal(output.state, 'UNAVAILABLE');
        assert.equal(output.write.requested, false);
        assert.equal(output.write.state, 'NOT_REQUESTED');
        assert.equal(output.preflight.state, 'NOT_RUN');
        return true;
      },
    );
    assert.equal(existsSync(scratch), false);
  } finally {
    await rm(root, {recursive: true, force: true});
  }
});

test('the CLI refuses ambiguous writer arguments before any qualification run', () => {
  assert.throws(
    () => parseReleaseGateArguments(['--write-lock']),
    error => error?.code === 'DOCUMENT_EXTRACTION_LOCK_PATH_INVALID',
  );
  assert.throws(
    () => parseReleaseGateArguments(['--release-target', '--write-lock', '/tmp/example.json']),
    error => error?.code === 'DOCUMENT_EXTRACTION_RELEASE_GATE_ARGUMENT_INVALID',
  );
});
