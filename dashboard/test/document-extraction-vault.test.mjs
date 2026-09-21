import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdtemp, readFile, readdir, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import test from 'node:test';

import {ProjectSpaceError, ProjectSpaceService} from '../project-spaces.mjs';

const LOCK_HASH = 'a'.repeat(64);

function digest(value) {
  return createHash('sha256').update(value).digest('hex');
}

function fakeDocumentRunner({outputs = null, failAt = null} = {}) {
  let calls = 0;
  return {
    get calls() { return calls; },
    async extract({kind}) {
      calls += 1;
      if (calls === failAt) throw new Error('simulated isolated parser failure');
      const content = Buffer.from(outputs?.[calls - 1] ?? ('Texto V2 verificable ' + calls + ' (' + kind + ').\n'), 'utf8');
      return {
        kind,
        derived: {sha256: digest(content), bytes: content.length, content},
        observations: kind === 'PDF'
          ? {pages: 1, textLayer: 'PRESENT'}
          : {entries: 1, expandedBytes: 128, bodyParts: 1},
        toolchainLockHash: LOCK_HASH,
      };
    },
  };
}

async function withSpaces(runner, callback) {
  const root = await mkdtemp(join(tmpdir(), 'sublimine-document-vault-v2-'));
  const spaces = await new ProjectSpaceService({rootDir: root, documentExtractionRunner: runner}).init();
  try {
    await callback({root, spaces});
  } finally {
    await rm(root, {recursive: true, force: true});
  }
}

async function uploadPdf(spaces, projectId, suffix) {
  const raw = Buffer.from('%PDF-1.7\nSublimine document ' + suffix + '\n', 'utf8');
  const reserved = await spaces.reserveAssetUpload(projectId, {
    filename: 'private-' + suffix + '.pdf',
    mediaType: 'application/pdf',
    size: raw.length,
    sha256: digest(raw),
  });
  async function* source() { yield raw; }
  return spaces.commitAssetUpload(projectId, reserved.reservation.id, source(), {
    contentLength: raw.length,
    contentType: 'application/pdf',
  });
}

async function preparedAdmission(spaces, project, requestId, assets) {
  return spaces.prepareMissionAdmission(project.id, {
    requestId,
    originalIntent: 'Procesa exclusivamente los documentos adjuntos.',
    entryMode: 'planned',
    preset: 'adaptive-v2',
    model: null,
    effort: null,
    factoryOptions: {},
    assetReferences: assets.map(asset => ({assetId: asset.id})),
  }, {resolveModelTarget: async () => ({model: 'gpt-5.6-terra', effort: 'high'})});
}

function prepare(spaces, projectId, admission) {
  return spaces.prepareDocumentAssetDerivationSet(projectId, {
    admission,
    admissionId: admission.admissionId,
    requestId: admission.requestId,
    references: admission.assetReferences,
  });
}

async function documentStoreEntries(paths) {
  const [objects, receipts, sets, bindings] = await Promise.all([
    readdir(paths.documentExtractionV2Objects),
    readdir(paths.documentExtractionV2Receipts),
    readdir(paths.documentExtractionV2Sets),
    readdir(paths.documentExtractionV2Bindings),
  ]);
  return {objects, receipts, sets, bindings};
}

test('V2 document sets are admission-bound, opaque to the caller, and idempotent without rerunning the parser', async () => {
  const runner = fakeDocumentRunner();
  await withSpaces(runner, async ({spaces}) => {
    const project = await spaces.createProject({name: 'Atlas documental'});
    const asset = await uploadPdf(spaces, project.id, 'atlas');
    const admission = await preparedAdmission(spaces, project, 'submission:11111111-1111-4111-8111-111111111111', [asset]);

    const first = await prepare(spaces, project.id, admission);
    const second = await prepare(spaces, project.id, admission);

    assert.equal(runner.calls, 1);
    assert.equal(second.setId, first.setId);
    assert.deepEqual(second.derivations, first.derivations);
    assert.match(first.setId, /^document-extraction-set:[a-f0-9]{64}$/);
    assert.match(first.derivations[0].inputPath, /^assets\/derived\/[a-f0-9]{48}\.txt$/);
    assert.equal(first.derivations[0].content.includes('Texto V2 verificable'), true);
    assert.equal(JSON.stringify(first).includes(asset.id), false);
    assert.equal(JSON.stringify(first).includes(asset.filename), false);
    assert.equal(JSON.stringify(first).includes('private-atlas.pdf'), false);
  });
});

test('V2 rejects a tampered set HMAC instead of silently reusing it', async () => {
  const runner = fakeDocumentRunner();
  await withSpaces(runner, async ({spaces}) => {
    const project = await spaces.createProject({name: 'Atlas sello'});
    const asset = await uploadPdf(spaces, project.id, 'seal');
    const admission = await preparedAdmission(spaces, project, 'submission:22222222-2222-4222-8222-222222222222', [asset]);
    const result = await prepare(spaces, project.id, admission);
    const path = spaces.documentExtractionSetPath(project.id, result.setId);
    const stored = JSON.parse(await readFile(path, 'utf8'));
    stored.integrity.hmac = 'f'.repeat(64);
    await writeFile(path, JSON.stringify(stored) + '\n', 'utf8');

    await assert.rejects(
      prepare(spaces, project.id, admission),
      error => error instanceof ProjectSpaceError && error.code === 'DOCUMENT_EXTRACTION_SET_INVALID',
    );
    assert.equal(runner.calls, 1);
  });
});

test('V2 sets are physically and cryptographically project-local', async () => {
  const runner = fakeDocumentRunner();
  await withSpaces(runner, async ({spaces}) => {
    const alpha = await spaces.createProject({name: 'Atlas aislamiento'});
    const beta = await spaces.createProject({name: 'Boreal aislamiento'});
    const alphaAsset = await uploadPdf(spaces, alpha.id, 'shared');
    const betaAsset = await uploadPdf(spaces, beta.id, 'shared');
    const alphaAdmission = await preparedAdmission(spaces, alpha, 'submission:33333333-3333-4333-8333-333333333333', [alphaAsset]);
    const betaAdmission = await preparedAdmission(spaces, beta, 'submission:44444444-4444-4444-8444-444444444444', [betaAsset]);
    const alphaResult = await prepare(spaces, alpha.id, alphaAdmission);
    const betaResult = await prepare(spaces, beta.id, betaAdmission);

    assert.notEqual(alphaResult.setId, betaResult.setId);
    assert.notEqual(spaces.documentExtractionSetPath(alpha.id, alphaResult.setId), spaces.documentExtractionSetPath(beta.id, betaResult.setId));

    const alphaBinding = await readFile(spaces.documentExtractionRequestBindingPath(alpha.id, alphaAdmission.requestId), 'utf8');
    await writeFile(spaces.documentExtractionRequestBindingPath(beta.id, betaAdmission.requestId), alphaBinding, 'utf8');
    await assert.rejects(
      prepare(spaces, beta.id, betaAdmission),
      error => error instanceof ProjectSpaceError && error.code === 'DOCUMENT_EXTRACTION_BINDING_INVALID',
    );
  });
});

test('V2 enforces real aggregate derived bytes before it publishes any document set', async () => {
  const runner = fakeDocumentRunner({
    outputs: [Buffer.alloc(400 * 1024, 0x61), Buffer.alloc(400 * 1024, 0x62), Buffer.alloc(300 * 1024, 0x63)],
  });
  await withSpaces(runner, async ({spaces}) => {
    const project = await spaces.createProject({name: 'Atlas presupuesto'});
    const assets = await Promise.all(['one', 'two', 'three'].map(value => uploadPdf(spaces, project.id, value)));
    const admission = await preparedAdmission(spaces, project, 'submission:55555555-5555-4555-8555-555555555555', assets);
    await assert.rejects(
      prepare(spaces, project.id, admission),
      error => error instanceof ProjectSpaceError && error.code === 'DOCUMENT_EXTRACTION_TOTAL_LIMIT',
    );
    assert.equal(runner.calls, 3);
    assert.deepEqual(await documentStoreEntries(spaces.projectPaths(project.id)), {objects: [], receipts: [], sets: [], bindings: []});
  });
});

test('a runner failure after one document leaves no partial V2 object, receipt, set, or request binding', async () => {
  const runner = fakeDocumentRunner({failAt: 2});
  await withSpaces(runner, async ({spaces}) => {
    const project = await spaces.createProject({name: 'Atlas atómico'});
    const assets = await Promise.all(['one', 'two'].map(value => uploadPdf(spaces, project.id, value)));
    const admission = await preparedAdmission(spaces, project, 'submission:66666666-6666-4666-8666-666666666666', assets);
    await assert.rejects(
      prepare(spaces, project.id, admission),
      error => error instanceof ProjectSpaceError && error.code === 'DOCUMENT_EXTRACTION_RUNNER_FAILED',
    );
    assert.equal(runner.calls, 2);
    assert.deepEqual(await documentStoreEntries(spaces.projectPaths(project.id)), {objects: [], receipts: [], sets: [], bindings: []});
  });
});

test('a service without an explicitly injected document runner remains fail-closed', async () => {
  await withSpaces(null, async ({spaces}) => {
    const project = await spaces.createProject({name: 'Atlas bloqueado'});
    const asset = await uploadPdf(spaces, project.id, 'blocked');
    const admission = await preparedAdmission(spaces, project, 'submission:77777777-7777-4777-8777-777777777777', [asset]);
    await assert.rejects(
      prepare(spaces, project.id, admission),
      error => error instanceof ProjectSpaceError && error.code === 'DOCUMENT_EXTRACTION_RUNNER_UNAVAILABLE',
    );
  });
});

test('a sealed V2 set can be re-materialized after the parser is unavailable', async () => {
  const runner = fakeDocumentRunner();
  await withSpaces(runner, async ({root, spaces}) => {
    const project = await spaces.createProject({name: 'Atlas reanudable'});
    const asset = await uploadPdf(spaces, project.id, 'reusable');
    const admission = await preparedAdmission(spaces, project, 'submission:88888888-8888-4888-8888-888888888888', [asset]);
    const first = await prepare(spaces, project.id, admission);

    const offline = await new ProjectSpaceService({rootDir: root, documentExtractionRunner: null}).init();
    const restored = await prepare(offline, project.id, admission);

    assert.equal(runner.calls, 1);
    assert.equal(restored.setId, first.setId);
    assert.deepEqual(restored.derivations, first.derivations);
  });
});

test('a failure after the binding write rolls back every V2 record and permits a clean retry', async () => {
  const runner = fakeDocumentRunner();
  await withSpaces(runner, async ({spaces}) => {
    const project = await spaces.createProject({name: 'Atlas transaccional'});
    const asset = await uploadPdf(spaces, project.id, 'atomic-binding');
    const admission = await preparedAdmission(spaces, project, 'submission:99999999-9999-4999-8999-999999999999', [asset]);
    const original = spaces.publishDocumentExtractionRequestBinding.bind(spaces);
    spaces.publishDocumentExtractionRequestBinding = async (...args) => {
      await original(...args);
      throw new Error('fault injected after binding publication');
    };

    await assert.rejects(
      prepare(spaces, project.id, admission),
      /fault injected after binding publication/,
    );
    assert.deepEqual(await documentStoreEntries(spaces.projectPaths(project.id)), {objects: [], receipts: [], sets: [], bindings: []});

    spaces.publishDocumentExtractionRequestBinding = original;
    const retry = await prepare(spaces, project.id, admission);
    assert.match(retry.setId, /^document-extraction-set:[a-f0-9]{64}$/);
    assert.equal(runner.calls, 2);
  });
});

test('the V2 aggregate source budget rejects before retaining or parsing a fifth near-limit document', async () => {
  const runner = fakeDocumentRunner();
  await withSpaces(runner, async ({spaces}) => {
    const project = await spaces.createProject({name: 'Atlas límite de fuente'});
    const sourceBytes = 16 * 1024 * 1024;
    const sourceHash = 'a'.repeat(64);
    let reads = 0;
    spaces.readAssetRecord = async (_projectId, assetId) => ({
      id: assetId,
      sha256: sourceHash,
      mediaType: 'application/pdf',
      size: sourceBytes,
    });
    spaces.readVerifiedAssetBytes = async () => {
      reads += 1;
      return Buffer.from('%PDF-1.7\n', 'ascii');
    };
    const snapshots = Array.from({length: 5}, (_, index) => ({
      id: 'asset:00000000-0000-4000-8000-' + String(index + 1).padStart(12, '0'),
      sha256: sourceHash,
      mediaType: 'application/pdf',
      size: sourceBytes,
    }));

    await assert.rejects(
      spaces.collectVerifiedDocumentSnapshots(project.id, snapshots),
      error => error instanceof ProjectSpaceError && error.code === 'DOCUMENT_EXTRACTION_SOURCE_TOTAL_LIMIT',
    );
    assert.equal(reads, 4);
    assert.equal(runner.calls, 0);
  });
});
