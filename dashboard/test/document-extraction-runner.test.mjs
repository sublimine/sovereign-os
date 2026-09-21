import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdtemp, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import test from 'node:test';

import {
  DOCUMENT_EXTRACTION_PREFLIGHT_SCHEMA,
  DOCUMENT_EXTRACTION_TOOLCHAIN_LOCK_SCHEMA,
  disabledDocumentToolchainLock,
  documentToolchainBindingHash,
} from '../document-extraction-contract.mjs';
import {
  DOCUMENT_EXTRACTOR_PROBE_SCHEMA,
  DOCUMENT_EXTRACTOR_RESULT_SCHEMA,
  DocumentExtractionRunner,
  DocumentExtractionRunnerError,
} from '../document-extraction-runner.mjs';

function canonical(value) {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (value && typeof value === 'object') return '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + canonical(value[key])).join(',') + '}';
  return JSON.stringify(value);
}
function digest(value) { return createHash('sha256').update(value).digest('hex'); }
function lock() {
  const unsigned = {
    schema: DOCUMENT_EXTRACTION_TOOLCHAIN_LOCK_SCHEMA,
    revision: 1,
    state: 'QUALIFIED',
    qualifiedAt: '2026-09-21T10:00:00.000Z',
    release: {
      id: '9'.repeat(64),
      root: '/opt/sublimine/document-extraction-v2/' + '9'.repeat(64),
    },
    tools: {
      pdfinfo: {path: '/usr/bin/pdfinfo', sha256: '1'.repeat(64), version: '24.02.0'},
      pdftotext: {path: '/usr/bin/pdftotext', sha256: '2'.repeat(64), version: '24.02.0'},
      python: {path: '/usr/bin/python3.12', sha256: '3'.repeat(64), version: '3.12.3'},
      extractor: {path: '/opt/sublimine/document-extraction-v2/' + '9'.repeat(64) + '/document-extractor.py', sha256: '4'.repeat(64), version: 'v1'},
    },
    dependencies: {
      defusedxml: {
        init: {path: '/usr/lib/python3/dist-packages/defusedxml/__init__.py', sha256: '8'.repeat(64), version: '0.7.1'},
        elementTree: {path: '/usr/lib/python3/dist-packages/defusedxml/ElementTree.py', sha256: 'a'.repeat(64), version: '0.7.1'},
      },
    },
    sandbox: {
      kind: 'bwrap-prlimit-v2',
      bwrap: {path: '/usr/bin/bwrap', sha256: '5'.repeat(64), version: '0.9.0'},
      prlimit: {path: '/usr/bin/prlimit', sha256: '7'.repeat(64), version: '2.39.3'},
      preflight: {schema: DOCUMENT_EXTRACTION_PREFLIGHT_SCHEMA, revision: 1, state: 'QUALIFIED', at: '2026-09-21T10:00:00.000Z', bindingHash: '0'.repeat(64), evidenceHash: '6'.repeat(64)},
    },
  };
  unsigned.sandbox.preflight.bindingHash = documentToolchainBindingHash(unsigned);
  return {...unsigned, lockHash: digest(canonical(unsigned))};
}

async function withRunner(executor, callback) {
  const root = await mkdtemp(join(tmpdir(), 'sublimine-document-runner-test-'));
  try {
    await callback(new DocumentExtractionRunner({
      toolchainLock: lock(),
      scratchRoot: root,
      execute: executor,
      verifyToolchain: async value => value,
    }), root);
  } finally {
    await rm(root, {recursive: true, force: true});
  }
}

function outputDirectory(args) {
  const index = args.indexOf('--bind');
  if (index < 0) throw new Error('missing output bind');
  return args[index + 1];
}

function passingExecutor({derivedText = 'Documento derivado verificable.'} = {}) {
  return async specification => {
    const output = outputDirectory(specification.args);
    const mode = specification.args[specification.args.indexOf('--mode') + 1];
    if (mode === 'probe') {
      await writeFile(join(output, 'probe.json'), JSON.stringify({
        schema: DOCUMENT_EXTRACTOR_PROBE_SCHEMA,
        revision: 1,
        state: 'QUALIFIED',
        assertions: {network: 'UNAVAILABLE', home: 'UNAVAILABLE', outsideWrite: 'DENIED'},
      }), 'utf8');
      return {code: 0, signal: null};
    }
    const extractionKind = specification.args[specification.args.indexOf('--kind') + 1];
    const fixture = specification.args.some(value => /\/fixture\.(?:pdf|docx)$/.test(String(value)));
    const fixtureText = fixture && extractionKind === 'PDF'
      ? 'Sublimine preflight PDF'
      : fixture && extractionKind === 'DOCX'
        ? 'Sublimine preflight DOCX'
        : derivedText;
    const body = Buffer.from(fixtureText, 'utf8');
    await writeFile(join(output, 'derived.txt'), body);
    await writeFile(join(output, 'result.json'), JSON.stringify({
      schema: DOCUMENT_EXTRACTOR_RESULT_SCHEMA,
      revision: 1,
      state: 'EXTRACTED',
      kind: extractionKind,
      derived: {sha256: digest(body), bytes: body.length},
      observations: extractionKind === 'PDF'
        ? {pages: 1, textLayer: 'PRESENT'}
        : {entries: 1, expandedBytes: 256, bodyParts: 1},
    }), 'utf8');
    return {code: 0, signal: null};
  };
}

test('the runner is unavailable by default and refuses to parse before qualified isolation', async () => {
  const runner = new DocumentExtractionRunner({toolchainLock: disabledDocumentToolchainLock()});
  const preflight = await runner.preflight();
  assert.deepEqual(preflight, {
    schema: DOCUMENT_EXTRACTION_PREFLIGHT_SCHEMA,
    revision: 1,
    state: 'UNAVAILABLE',
    code: 'DOCUMENT_EXTRACTION_TOOLCHAIN_UNAVAILABLE',
  });
  const bytes = Buffer.from('%PDF-1.7', 'ascii');
  await assert.rejects(
    runner.extract({kind: 'PDF', source: {sha256: digest(bytes), bytes: bytes.length}, bytes}),
    error => error instanceof Error && error.code === 'DOCUMENT_EXTRACTION_TOOLCHAIN_UNAVAILABLE',
  );
});

test('sandbox invocation is fixed, network-isolated, resource-bounded, shell-free and does not interpolate document data', async () => {
  const calls = [];
  await withRunner(async specification => {
    calls.push(specification);
    return passingExecutor()(specification);
  }, async runner => {
    const bytes = Buffer.from('%PDF-1.7\nPRIVATE_DOCUMENT_CONTENT', 'utf8');
    await runner.extract({kind: 'PDF', source: {sha256: digest(bytes), bytes: bytes.length}, bytes});
  });
  const invocation = calls.at(-1);
  assert.deepEqual(
    calls.slice(0, 3).map(call => call.args[call.args.indexOf('--mode') + 1] + ':' + (call.args.includes('--kind') ? call.args[call.args.indexOf('--kind') + 1] : 'NONE')),
    ['probe:NONE', 'extract:PDF', 'extract:DOCX'],
  );
  assert.equal(invocation.command, '/usr/bin/bwrap');
  assert.equal(invocation.env && Object.keys(invocation.env).length, 0);
  assert.ok(invocation.args.includes('--unshare-all'));
  assert.ok(invocation.args.includes('--unshare-net'));
  assert.ok(invocation.args.includes('--clearenv'));
  assert.ok(invocation.args.includes('--die-with-parent'));
  assert.ok(invocation.args.includes('--chdir'));
  assert.ok(invocation.args.includes('/usr/bin/prlimit'));
  assert.ok(invocation.args.some(value => String(value).startsWith('--as=')));
  assert.ok(invocation.args.some(value => String(value).startsWith('--nproc=')));
  assert.ok(invocation.args.includes('SUBLIMINE_DEFUSEDXML_INIT'));
  assert.ok(invocation.args.includes('/usr/lib/python3/dist-packages/defusedxml/__init__.py'));
  assert.ok(invocation.args.includes('SUBLIMINE_DEFUSEDXML_ELEMENT_TREE'));
  assert.ok(invocation.args.includes('/usr/lib/python3/dist-packages/defusedxml/ElementTree.py'));
  assert.ok(invocation.args.includes('/tool/document-extractor.py'));
  assert.doesNotMatch(invocation.args.join(' '), /PRIVATE_DOCUMENT_CONTENT|original\.pdf|https?:\/\//);
});

test('the runner accepts only a bounded verified result and returns opaque derived text', async () => {
  const calls = [];
  await withRunner(async specification => {
    calls.push(specification);
    return passingExecutor()(specification);
  }, async runner => {
    const bytes = Buffer.from('%PDF-1.7\nraw original PRIVATE_DOCUMENT_CONTENT', 'utf8');
    const result = await runner.extract({kind: 'PDF', source: {sha256: digest(bytes), bytes: bytes.length}, bytes});
    assert.equal(result.kind, 'PDF');
    assert.equal(result.derived.content.toString('utf8'), 'Documento derivado verificable.');
    assert.equal(result.observations.pages, 1);
    assert.equal(result.toolchainLockHash, lock().lockHash);
    assert.equal(calls.length, 4);
    for (const call of calls) {
      assert.equal(call.shell, undefined);
      assert.doesNotMatch(call.args.join(' '), /PRIVATE_DOCUMENT_CONTENT|original\.pdf/);
    }
  });
});

test('a valid lock is normalized once, so later caller mutation cannot switch the preflight binding', async () => {
  const candidate = lock();
  const root = await mkdtemp(join(tmpdir(), 'sublimine-document-runner-lock-test-'));
  try {
    const runner = new DocumentExtractionRunner({
      toolchainLock: candidate,
      scratchRoot: root,
      execute: passingExecutor(),
      verifyToolchain: async value => value,
    });
    candidate.tools.extractor.sha256 = '0'.repeat(64);
    candidate.sandbox.preflight.bindingHash = '0'.repeat(64);
    const preflight = await runner.preflight();
    assert.equal(preflight.state, 'QUALIFIED');
    assert.notEqual(preflight.bindingHash, '0'.repeat(64));
  } finally {
    await rm(root, {recursive: true, force: true});
  }
});

test('a malformed preflight or extra output fails closed before any document result is trusted', async () => {
  await withRunner(async specification => {
    const output = outputDirectory(specification.args);
    await writeFile(join(output, 'probe.json'), JSON.stringify({
      schema: DOCUMENT_EXTRACTOR_PROBE_SCHEMA,
      revision: 1,
      state: 'QUALIFIED',
      assertions: {network: 'AVAILABLE', home: 'UNAVAILABLE', outsideWrite: 'DENIED'},
    }), 'utf8');
    return {code: 0, signal: null};
  }, async runner => {
    const preflight = await runner.preflight();
    assert.equal(preflight.state, 'UNAVAILABLE');
    assert.equal(preflight.code, 'DOCUMENT_EXTRACTION_PREFLIGHT_ISOLATION_FAILED');
  });
});

test('a derived mismatch, unexpected file, source mismatch and non-text result are rejected', async () => {
  const cases = [
    async output => {
      await writeFile(join(output, 'derived.txt'), 'safe text', 'utf8');
      await writeFile(join(output, 'result.json'), JSON.stringify({schema: DOCUMENT_EXTRACTOR_RESULT_SCHEMA, revision: 1, state: 'EXTRACTED', kind: 'PDF', derived: {sha256: '0'.repeat(64), bytes: 9}, observations: {pages: 1, textLayer: 'PRESENT'}}), 'utf8');
    },
    async output => {
      const body = Buffer.from('safe text');
      await writeFile(join(output, 'derived.txt'), body);
      await writeFile(join(output, 'result.json'), JSON.stringify({schema: DOCUMENT_EXTRACTOR_RESULT_SCHEMA, revision: 1, state: 'EXTRACTED', kind: 'PDF', derived: {sha256: digest(body), bytes: body.length}, observations: {pages: 1, textLayer: 'PRESENT'}}), 'utf8');
      await writeFile(join(output, 'unexpected.txt'), 'no', 'utf8');
    },
  ];
  for (const makeOutput of cases) {
    await withRunner(async specification => {
      const output = outputDirectory(specification.args);
      const mode = specification.args[specification.args.indexOf('--mode') + 1];
      if (mode === 'probe') return passingExecutor()(specification);
      await makeOutput(output);
      return {code: 0, signal: null};
    }, async runner => {
      const bytes = Buffer.from('%PDF-1.7\nsource', 'utf8');
      await assert.rejects(
        runner.extract({kind: 'PDF', source: {sha256: digest(bytes), bytes: bytes.length}, bytes}),
        error => error instanceof DocumentExtractionRunnerError,
      );
    });
  }
  await withRunner(passingExecutor(), async runner => {
    const bytes = Buffer.from('%PDF-1.7\nsource', 'utf8');
    await assert.rejects(
      runner.extract({kind: 'PDF', source: {sha256: '0'.repeat(64), bytes: bytes.length}, bytes}),
      error => error instanceof DocumentExtractionRunnerError && error.code === 'DOCUMENT_EXTRACTION_SOURCE_SNAPSHOT_INVALID',
    );
  });
});
