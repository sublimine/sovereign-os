import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import test from 'node:test';

import {
  DOCUMENT_EXTRACTION_LIMITS,
  DOCUMENT_EXTRACTION_PROFILE,
  documentExtractionIdFor,
} from '../document-extraction-contract.mjs';
import {
  DOCUMENT_EXTRACTION_SET_SCHEMA,
  DocumentExtractionSetContractError,
  canonicalDocumentExtractionSet,
  documentExtractionSet,
  documentExtractionSetIdFor,
  documentExtractionSetUnsignedPayload,
} from '../document-extraction-set-contract.mjs';

const projectId = 'project:11111111-1111-4111-8111-111111111111';
const admissionId = 'admission:22222222-2222-4222-8222-222222222222';
const requestId = 'submission:33333333-3333-4333-8333-333333333333';
const lockHash = 'a'.repeat(64);

function assetId(index) {
  const suffix = String(index).padStart(12, '0');
  return 'asset:0000000' + index + '-000' + index + '-400' + index + '-800' + index + '-' + suffix;
}

function digest(seed) {
  return createHash('sha256').update(String(seed)).digest('hex');
}

function assetReference(index, {derivedBytes = 320, kind = 'PDF'} = {}) {
  const id = assetId(index);
  const sourceSha256 = digest('source-' + index);
  return {
    snapshot: {assetId: id, sha256: sourceSha256, bytes: 4096 + index, kind},
    receipt: {
      id: documentExtractionIdFor({
        projectId,
        assetId: id,
        admissionId,
        sourceSha256,
        kind,
        toolchainLockHash: lockHash,
      }),
      derived: {sha256: digest('derived-' + index), bytes: derivedBytes},
    },
  };
}

function validSet({assets = [assetReference(1), assetReference(2)], id = null} = {}) {
  const identity = {
    projectId,
    admissionId,
    requestId,
    profile: DOCUMENT_EXTRACTION_PROFILE,
    toolchain: {lockHash, profile: DOCUMENT_EXTRACTION_PROFILE},
    limits: {...DOCUMENT_EXTRACTION_LIMITS},
    assets,
  };
  return {
    schema: DOCUMENT_EXTRACTION_SET_SCHEMA,
    revision: 1,
    id: id ?? documentExtractionSetIdFor(identity),
    ...identity,
    createdAt: '2026-09-21T12:00:00.000Z',
    integrity: {algorithm: 'HMAC-SHA-256', hmac: 'b'.repeat(64)},
  };
}

test('sealed document extraction sets normalize order and bind the full atomic admission identity', () => {
  const input = validSet({assets: [assetReference(2), assetReference(1)]});
  const parsed = documentExtractionSet(input);
  assert.equal(parsed.assets[0].snapshot.assetId, assetId(1));
  assert.equal(parsed.assets[1].snapshot.assetId, assetId(2));
  assert.equal(parsed.id, input.id);
  assert.equal(Object.isFrozen(parsed), true);
  assert.equal(Object.isFrozen(parsed.assets[0].receipt.derived), true);
});

test('the aggregate V2 derived-byte budget fails closed even when every individual receipt fits', () => {
  const half = DOCUMENT_EXTRACTION_LIMITS.maxDerivedBytes;
  const input = validSet({
    assets: [
      assetReference(1, {derivedBytes: half}),
      assetReference(2, {derivedBytes: half}),
      assetReference(3, {derivedBytes: 1}),
    ],
    // Construction must not mint an identity for an over-budget set; this is
    // merely a syntactically shaped outer id so the parser reaches the budget
    // gate before any identity comparison.
    id: 'document-extraction-set:' + 'd'.repeat(64),
  });
  assert.throws(
    () => documentExtractionSet(input),
    error => error instanceof DocumentExtractionSetContractError
      && error.code === 'DOCUMENT_EXTRACTION_SET_TOTAL_DERIVED_EXCEEDED',
  );
});

test('altered receipt or asset snapshot identities invalidate the sealed set rather than silently rebinding it', () => {
  const original = validSet();
  const alteredReceipt = structuredClone(original);
  alteredReceipt.assets[0].receipt.id = 'asset-extraction:' + 'f'.repeat(64);
  assert.throws(
    () => documentExtractionSet(alteredReceipt),
    error => error instanceof DocumentExtractionSetContractError
      && error.code === 'DOCUMENT_EXTRACTION_SET_RECEIPT_ID_MISMATCH',
  );

  const alteredSnapshot = structuredClone(original);
  alteredSnapshot.assets[0].snapshot.sha256 = digest('tampered-source');
  alteredSnapshot.assets[0].receipt.id = documentExtractionIdFor({
    projectId,
    assetId: alteredSnapshot.assets[0].snapshot.assetId,
    admissionId,
    sourceSha256: alteredSnapshot.assets[0].snapshot.sha256,
    kind: alteredSnapshot.assets[0].snapshot.kind,
    toolchainLockHash: lockHash,
  });
  assert.throws(
    () => documentExtractionSet(alteredSnapshot),
    error => error instanceof DocumentExtractionSetContractError
      && error.code === 'DOCUMENT_EXTRACTION_SET_ID_MISMATCH',
  );
});

test('the parent HMAC is syntactically carried but excluded from stable canonical payload bytes', () => {
  const original = validSet();
  const changedHmac = {...original, integrity: {...original.integrity, hmac: 'c'.repeat(64)}};
  const unsigned = documentExtractionSetUnsignedPayload(original);
  assert.equal(Object.hasOwn(unsigned, 'integrity'), false);
  assert.equal(Object.isFrozen(unsigned), true);
  assert.equal(canonicalDocumentExtractionSet(original), canonicalDocumentExtractionSet(changedHmac));
  assert.doesNotMatch(canonicalDocumentExtractionSet(original), /HMAC-SHA-256|"hmac"/i);
});

test('strict manifest fields reject filenames, vault locations, raw receipt metadata and other leakage', () => {
  const original = validSet();
  const cases = [
    {...original, originalFilename: 'private-board-pack.pdf'},
    {...original, assets: [{...original.assets[0], snapshot: {...original.assets[0].snapshot, vaultPath: '/private/vault/a'}}]},
    {...original, assets: [{...original.assets[0], receipt: {...original.assets[0].receipt, originalFilename: 'secret.pdf'}}]},
    {
      ...original,
      assets: [{
        ...original.assets[0],
        receipt: {
          ...original.assets[0].receipt,
          derived: {...original.assets[0].receipt.derived, path: 'assets/derived/private.txt'},
        },
      }],
    },
  ];
  for (const candidate of cases) {
    assert.throws(() => documentExtractionSet(candidate), DocumentExtractionSetContractError);
  }
});
