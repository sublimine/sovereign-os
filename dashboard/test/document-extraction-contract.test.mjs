import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import test from 'node:test';

import {
  DOCUMENT_EXTRACTION_LIMITS,
  DOCUMENT_EXTRACTION_PREFLIGHT_SCHEMA,
  DOCUMENT_EXTRACTION_PROFILE,
  DOCUMENT_EXTRACTION_RECEIPT_SCHEMA,
  DOCUMENT_EXTRACTION_TOOLCHAIN_LOCK_SCHEMA,
  DocumentExtractionContractError,
  canonicalDocumentExtractionReceipt,
  disabledDocumentToolchainLock,
  documentExtractionReceiptUnsignedPayload,
  documentExtractionFactoryInput,
  documentExtractionIdFor,
  documentExtractionReceipt,
  documentToolchainBindingHash,
  documentToolchainLock,
  requireQualifiedDocumentToolchain,
} from '../document-extraction-contract.mjs';

const projectId = 'project:11111111-1111-4111-8111-111111111111';
const assetId = 'asset:22222222-2222-4222-8222-222222222222';
const admissionId = 'admission:33333333-3333-4333-8333-333333333333';
const sourceHash = 'a'.repeat(64);
const derivedHash = 'b'.repeat(64);

function canonical(value) {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (value && typeof value === 'object') return '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + canonical(value[key])).join(',') + '}';
  return JSON.stringify(value);
}

function hash(value) { return createHash('sha256').update(canonical(value)).digest('hex'); }

function qualifiedLock() {
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
      preflight: {
        schema: DOCUMENT_EXTRACTION_PREFLIGHT_SCHEMA,
        revision: 1,
        state: 'QUALIFIED',
        at: '2026-09-21T10:00:00.000Z',
        bindingHash: '0'.repeat(64),
        evidenceHash: '6'.repeat(64),
      },
    },
  };
  unsigned.sandbox.preflight.bindingHash = documentToolchainBindingHash(unsigned);
  return {...unsigned, lockHash: hash(unsigned)};
}

function validReceipt({kind = 'PDF'} = {}) {
  const toolchain = documentToolchainLock(qualifiedLock());
  const id = documentExtractionIdFor({
    projectId,
    assetId,
    admissionId,
    sourceSha256: sourceHash,
    kind,
    toolchainLockHash: toolchain.lockHash,
  });
  return {
    schema: DOCUMENT_EXTRACTION_RECEIPT_SCHEMA,
    revision: 1,
    id,
    profile: DOCUMENT_EXTRACTION_PROFILE,
    projectId,
    assetId,
    admissionId,
    createdAt: '2026-09-21T10:01:00.000Z',
    source: {sha256: sourceHash, bytes: 4096, kind},
    toolchain: {lockHash: toolchain.lockHash, profile: DOCUMENT_EXTRACTION_PROFILE},
    limits: {...DOCUMENT_EXTRACTION_LIMITS},
    derived: {path: 'assets/derived/' + 'c'.repeat(48) + '.txt', sha256: derivedHash, bytes: 331},
    observations: kind === 'PDF'
      ? {pages: 2, textLayer: 'PRESENT'}
      : {entries: 7, expandedBytes: 12000, bodyParts: 1},
    integrity: {algorithm: 'HMAC-SHA-256', hmac: 'd'.repeat(64)},
  };
}

test('a disabled toolchain lock is valid configuration but cannot enable extraction', () => {
  const disabled = disabledDocumentToolchainLock('Falta el preflight aislado.');
  assert.deepEqual(documentToolchainLock(disabled), disabled);
  assert.equal(Object.isFrozen(disabled), true);
  assert.throws(
    () => requireQualifiedDocumentToolchain(disabled),
    error => error instanceof DocumentExtractionContractError && error.code === 'DOCUMENT_EXTRACTION_TOOLCHAIN_UNAVAILABLE',
  );
});

test('a qualified lock must be exact and content-addressed', () => {
  const lock = qualifiedLock();
  const parsed = requireQualifiedDocumentToolchain(lock);
  assert.equal(parsed.state, 'QUALIFIED');
  assert.equal(parsed.tools.pdftotext.path, '/usr/bin/pdftotext');
  assert.equal(parsed.dependencies.defusedxml.elementTree.path, '/usr/lib/python3/dist-packages/defusedxml/ElementTree.py');
  assert.throws(
    () => documentToolchainLock({...lock, unexpected: 'PRIVATE_SENTINEL'}),
    error => error instanceof DocumentExtractionContractError && error.code === 'DOCUMENT_EXTRACTION_TOOLCHAIN_INVALID',
  );
  assert.throws(
    () => documentToolchainLock({...lock, lockHash: '0'.repeat(64)}),
    error => error instanceof DocumentExtractionContractError && error.code === 'DOCUMENT_EXTRACTION_TOOLCHAIN_HASH_MISMATCH',
  );
  const wrongBinding = {
    ...lock,
    sandbox: {...lock.sandbox, preflight: {...lock.sandbox.preflight, bindingHash: '0'.repeat(64)}},
  };
  // `lockHash` is calculated over the unsigned lock. Rebuild it without the
  // field so this asserts the binding check rather than a superficial hash.
  const {lockHash: ignored, ...wrongBindingUnsigned} = wrongBinding;
  wrongBinding.lockHash = hash(wrongBindingUnsigned);
  assert.throws(
    () => documentToolchainLock(wrongBinding),
    error => error instanceof DocumentExtractionContractError && error.code === 'DOCUMENT_EXTRACTION_PREFLIGHT_BINDING_MISMATCH',
  );
  const missingDependency = structuredClone(lock);
  delete missingDependency.dependencies;
  const {lockHash: missingIgnored, ...missingUnsigned} = missingDependency;
  missingDependency.lockHash = hash(missingUnsigned);
  assert.throws(
    () => documentToolchainLock(missingDependency),
    error => error instanceof DocumentExtractionContractError && error.code === 'DOCUMENT_EXTRACTION_TOOLCHAIN_INVALID',
  );
});

test('document receipt is immutable and its canonical authentication payload excludes the HMAC wrapper', () => {
  const receipt = validReceipt();
  const parsed = documentExtractionReceipt(receipt);
  assert.equal(parsed.schema, DOCUMENT_EXTRACTION_RECEIPT_SCHEMA);
  assert.equal(parsed.source.kind, 'PDF');
  assert.equal(Object.isFrozen(parsed), true);
  const unsigned = documentExtractionReceiptUnsignedPayload(receipt);
  assert.equal(Object.hasOwn(unsigned, 'integrity'), false);
  assert.equal(Object.isFrozen(unsigned), true);
  assert.match(canonicalDocumentExtractionReceipt(receipt), /sublimine-project-asset-extraction-v2/);
  assert.doesNotMatch(canonicalDocumentExtractionReceipt(receipt), /HMAC-SHA-256|\"hmac\"/i);

  const alternativeHmac = {
    ...receipt,
    integrity: {...receipt.integrity, hmac: 'e'.repeat(64)},
  };
  assert.equal(
    canonicalDocumentExtractionReceipt(alternativeHmac),
    canonicalDocumentExtractionReceipt(receipt),
    'the HMAC is an authenticator over the stable unsigned payload, not payload material itself',
  );
});

test('a syntactically valid but unverified receipt cannot create a Factory authority', () => {
  const receipt = validReceipt();
  assert.throws(
    () => documentExtractionFactoryInput(receipt),
    error => error instanceof DocumentExtractionContractError
      && error.code === 'DOCUMENT_EXTRACTION_FACTORY_AUTHORITY_REQUIRED',
  );
  // Changing the fixed-width digest does not turn an unverified receipt into
  // an authority either. The fail-closed API leaves HMAC verification to the
  // project-local key owner before a future projection is introduced.
  assert.throws(
    () => documentExtractionFactoryInput({...receipt, integrity: {...receipt.integrity, hmac: 'e'.repeat(64)}}),
    error => error instanceof DocumentExtractionContractError
      && error.code === 'DOCUMENT_EXTRACTION_FACTORY_AUTHORITY_REQUIRED',
  );
});

test('document receipt rejects leakage, changed identities, non-opaque paths and unsafe observations', () => {
  const receipt = validReceipt({kind: 'DOCX'});
  const cases = [
    {...receipt, originalFilename: 'PRIVATE_SENTINEL.docx'},
    {...receipt, id: 'asset-extraction:' + '0'.repeat(64)},
    {...receipt, derived: {...receipt.derived, path: '/home/operator/private.txt'}},
    {...receipt, source: {...receipt.source, bytes: DOCUMENT_EXTRACTION_LIMITS.maxSourceBytes + 1}},
    {...receipt, limits: {...receipt.limits, maxPdfPages: 151}},
    {...receipt, observations: {...receipt.observations, entries: 401}},
    {...receipt, integrity: {...receipt.integrity, algorithm: 'SHA-256'}},
  ];
  for (const candidate of cases) {
    assert.throws(() => documentExtractionReceipt(candidate), DocumentExtractionContractError);
  }
});

test('PDF receipts reject a missing text layer and DOCX receipts do not accept PDF fields', () => {
  const pdf = validReceipt();
  assert.throws(
    () => documentExtractionReceipt({...pdf, observations: {pages: 2, textLayer: 'ABSENT'}}),
    error => error instanceof DocumentExtractionContractError && error.code === 'DOCUMENT_EXTRACTION_OBSERVATIONS_INVALID',
  );
  const docx = validReceipt({kind: 'DOCX'});
  assert.throws(
    () => documentExtractionReceipt({...docx, observations: {pages: 1, textLayer: 'PRESENT'}}),
    error => error instanceof DocumentExtractionContractError && error.code === 'DOCUMENT_EXTRACTION_OBSERVATIONS_INVALID',
  );
});
