/**
 * Sublimine Document Extraction V2 sealed-set contract.
 *
 * A document set is a private, all-or-nothing admission fact.  It binds the
 * complete attachment snapshot for one project request to the exact V2
 * extraction receipts that produced its opaque derivatives.  This module is
 * deliberately data-only: it does not read a vault, own an HMAC key, verify
 * an HMAC, materialize a derivative, or create a Factory input.  Those powers
 * remain with the project-local parent that owns the sealed records.
 */
import {createHash} from 'node:crypto';

import {
  DOCUMENT_EXTRACTION_LIMITS,
  DOCUMENT_EXTRACTION_PROFILE,
  DOCUMENT_EXTRACTION_REVISION,
  documentExtractionIdFor,
} from './document-extraction-contract.mjs';

export const DOCUMENT_EXTRACTION_SET_SCHEMA = 'sublimine-project-document-extraction-set-v2';
export const DOCUMENT_EXTRACTION_SET_REVISION = 1;
export const DOCUMENT_EXTRACTION_SET_ID_PREFIX = 'document-extraction-set:';
// This is intentionally aligned with the project attachment-reference cap,
// but lives here as a local protocol bound rather than importing a service.
export const DOCUMENT_EXTRACTION_SET_MAX_ASSETS = 16;

const SHA256 = /^[a-f0-9]{64}$/i;
const PROJECT_ID = /^project:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ADMISSION_ID = /^admission:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const REQUEST_ID = /^submission:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ASSET_ID = /^asset:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EXTRACTION_ID = /^asset-extraction:[a-f0-9]{64}$/i;
const SET_ID = /^document-extraction-set:[a-f0-9]{64}$/i;
const ISO_UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const DOCUMENT_KINDS = new Set(['PDF', 'DOCX']);

export class DocumentExtractionSetContractError extends Error {
  constructor(message, code = 'DOCUMENT_EXTRACTION_SET_INVALID') {
    super(message);
    this.name = 'DocumentExtractionSetContractError';
    this.code = code;
  }
}

function record(value) {
  return value && typeof value === 'object' && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype ? value : null;
}

function hasOnlyKeys(value, keys) {
  const allowed = new Set(keys);
  return Object.keys(value).every(key => allowed.has(key)) && keys.every(key => Object.hasOwn(value, key));
}

function canonical(value) {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (value && typeof value === 'object') {
    return '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + canonical(value[key])).join(',') + '}';
  }
  return JSON.stringify(value);
}

function freeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) freeze(child);
  return Object.freeze(value);
}

function invalid(message, code = 'DOCUMENT_EXTRACTION_SET_INVALID') {
  throw new DocumentExtractionSetContractError(message, code);
}

function sha256(value, code = 'DOCUMENT_EXTRACTION_SET_INVALID') {
  if (typeof value !== 'string' || !SHA256.test(value)) invalid('El hash del conjunto documental no es válido.', code);
  return value.toLowerCase();
}

function exactUtc(value) {
  return typeof value === 'string' && ISO_UTC.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value;
}

function exactLimits(value) {
  const limits = record(value);
  if (!limits || !hasOnlyKeys(limits, Object.keys(DOCUMENT_EXTRACTION_LIMITS))) {
    invalid('Los límites del conjunto documental no coinciden con el perfil V2.', 'DOCUMENT_EXTRACTION_SET_LIMITS_INVALID');
  }
  for (const [key, expected] of Object.entries(DOCUMENT_EXTRACTION_LIMITS)) {
    if (limits[key] !== expected) {
      invalid('Los límites del conjunto documental no coinciden con el perfil V2.', 'DOCUMENT_EXTRACTION_SET_LIMITS_INVALID');
    }
  }
  return {...DOCUMENT_EXTRACTION_LIMITS};
}

function toolchainReference(value) {
  const toolchain = record(value);
  if (!toolchain || !hasOnlyKeys(toolchain, ['lockHash', 'profile'])
    || toolchain.profile !== DOCUMENT_EXTRACTION_PROFILE) {
    invalid('La referencia de toolchain documental no es válida.', 'DOCUMENT_EXTRACTION_SET_TOOLCHAIN_INVALID');
  }
  return {lockHash: sha256(toolchain.lockHash, 'DOCUMENT_EXTRACTION_SET_TOOLCHAIN_INVALID'), profile: DOCUMENT_EXTRACTION_PROFILE};
}

function snapshot(value) {
  const source = record(value);
  if (!source || !hasOnlyKeys(source, ['assetId', 'sha256', 'bytes', 'kind'])
    || typeof source.assetId !== 'string' || !ASSET_ID.test(source.assetId)
    || !Number.isSafeInteger(source.bytes) || source.bytes < 1 || source.bytes > DOCUMENT_EXTRACTION_LIMITS.maxSourceBytes) {
    invalid('La instantánea del activo documental no es válida.', 'DOCUMENT_EXTRACTION_SET_SNAPSHOT_INVALID');
  }
  const kind = String(source.kind ?? '').toUpperCase();
  if (!DOCUMENT_KINDS.has(kind)) {
    invalid('El tipo de la instantánea documental no está permitido.', 'DOCUMENT_EXTRACTION_SET_SNAPSHOT_INVALID');
  }
  return {
    assetId: source.assetId.toLowerCase(),
    sha256: sha256(source.sha256, 'DOCUMENT_EXTRACTION_SET_SNAPSHOT_INVALID'),
    bytes: source.bytes,
    kind,
  };
}

function receiptReference(value) {
  const receipt = record(value);
  if (!receipt || !hasOnlyKeys(receipt, ['id', 'derived'])
    || typeof receipt.id !== 'string' || !EXTRACTION_ID.test(receipt.id)) {
    invalid('La referencia al recibo documental no es válida.', 'DOCUMENT_EXTRACTION_SET_RECEIPT_INVALID');
  }
  const derived = record(receipt.derived);
  if (!derived || !hasOnlyKeys(derived, ['sha256', 'bytes'])
    || !Number.isSafeInteger(derived.bytes) || derived.bytes < 1 || derived.bytes > DOCUMENT_EXTRACTION_LIMITS.maxDerivedBytes) {
    invalid('El derivado referenciado por el conjunto documental no es válido.', 'DOCUMENT_EXTRACTION_SET_RECEIPT_INVALID');
  }
  return {
    id: receipt.id.toLowerCase(),
    derived: {
      sha256: sha256(derived.sha256, 'DOCUMENT_EXTRACTION_SET_RECEIPT_INVALID'),
      bytes: derived.bytes,
    },
  };
}

function assetReference(value, {projectId, admissionId, toolchainLockHash}) {
  const asset = record(value);
  if (!asset || !hasOnlyKeys(asset, ['snapshot', 'receipt'])) {
    invalid('La referencia de activo documental no es válida.', 'DOCUMENT_EXTRACTION_SET_ASSET_INVALID');
  }
  const normalizedSnapshot = snapshot(asset.snapshot);
  const normalizedReceipt = receiptReference(asset.receipt);
  let expectedReceiptId;
  try {
    expectedReceiptId = documentExtractionIdFor({
      projectId,
      assetId: normalizedSnapshot.assetId,
      admissionId,
      sourceSha256: normalizedSnapshot.sha256,
      kind: normalizedSnapshot.kind,
      toolchainLockHash,
    });
  } catch {
    invalid('La identidad del recibo documental no puede enlazarse a su instantánea.', 'DOCUMENT_EXTRACTION_SET_RECEIPT_ID_MISMATCH');
  }
  if (normalizedReceipt.id !== expectedReceiptId) {
    invalid('El recibo documental no pertenece a la instantánea, admisión y toolchain declaradas.', 'DOCUMENT_EXTRACTION_SET_RECEIPT_ID_MISMATCH');
  }
  return {snapshot: normalizedSnapshot, receipt: normalizedReceipt};
}

function normalizedAssets(value, identity) {
  if (!Array.isArray(value) || value.length < 1 || value.length > DOCUMENT_EXTRACTION_SET_MAX_ASSETS) {
    invalid('El conjunto documental debe contener un número acotado de activos.', 'DOCUMENT_EXTRACTION_SET_ASSETS_INVALID');
  }
  const assets = value.map(asset => assetReference(asset, identity));
  assets.sort((left, right) => left.snapshot.assetId.localeCompare(right.snapshot.assetId, 'en'));

  const seenAssets = new Set();
  const seenReceipts = new Set();
  let totalDerivedBytes = 0;
  for (const asset of assets) {
    if (seenAssets.has(asset.snapshot.assetId) || seenReceipts.has(asset.receipt.id)) {
      invalid('El conjunto documental contiene activos o recibos duplicados.', 'DOCUMENT_EXTRACTION_SET_DUPLICATE_REFERENCE');
    }
    seenAssets.add(asset.snapshot.assetId);
    seenReceipts.add(asset.receipt.id);
    totalDerivedBytes += asset.receipt.derived.bytes;
    if (!Number.isSafeInteger(totalDerivedBytes) || totalDerivedBytes > DOCUMENT_EXTRACTION_LIMITS.maxTotalDerivedBytes) {
      invalid('El conjunto documental supera el presupuesto agregado de derivados.', 'DOCUMENT_EXTRACTION_SET_TOTAL_DERIVED_EXCEEDED');
    }
  }
  return assets;
}

function identityFields(value) {
  const source = record(value);
  if (!source || !hasOnlyKeys(source, ['projectId', 'admissionId', 'requestId', 'profile', 'toolchain', 'limits', 'assets'])
    || typeof source.projectId !== 'string' || !PROJECT_ID.test(source.projectId)
    || typeof source.admissionId !== 'string' || !ADMISSION_ID.test(source.admissionId)
    || typeof source.requestId !== 'string' || !REQUEST_ID.test(source.requestId)
    || source.profile !== DOCUMENT_EXTRACTION_PROFILE) {
    invalid('La identidad del conjunto documental no es válida.', 'DOCUMENT_EXTRACTION_SET_IDENTITY_INVALID');
  }
  const toolchain = toolchainReference(source.toolchain);
  const limits = exactLimits(source.limits);
  const assets = normalizedAssets(source.assets, {
    projectId: source.projectId.toLowerCase(),
    admissionId: source.admissionId.toLowerCase(),
    toolchainLockHash: toolchain.lockHash,
  });
  return {
    projectId: source.projectId.toLowerCase(),
    admissionId: source.admissionId.toLowerCase(),
    requestId: source.requestId.toLowerCase(),
    profile: DOCUMENT_EXTRACTION_PROFILE,
    toolchain,
    limits,
    assets,
  };
}

function setIdentityPayload(identity) {
  return {
    schema: DOCUMENT_EXTRACTION_SET_SCHEMA,
    revision: DOCUMENT_EXTRACTION_SET_REVISION,
    projectId: identity.projectId,
    admissionId: identity.admissionId,
    requestId: identity.requestId,
    profile: DOCUMENT_EXTRACTION_PROFILE,
    toolchain: {...identity.toolchain},
    limits: {...identity.limits},
    assets: identity.assets.map(asset => ({
      snapshot: {...asset.snapshot},
      receipt: {id: asset.receipt.id, derived: {...asset.receipt.derived}},
    })),
  };
}

/**
 * Content-addressed identity for the complete atomic set.  It intentionally
 * excludes `createdAt` and the parent HMAC so a retry cannot manufacture a
 * different semantic set for the same verified attachment snapshot.
 */
export function documentExtractionSetIdFor(value) {
  const identity = identityFields(value);
  return DOCUMENT_EXTRACTION_SET_ID_PREFIX + createHash('sha256').update(canonical(setIdentityPayload(identity))).digest('hex');
}

function integrity(value) {
  const seal = record(value);
  if (!seal || !hasOnlyKeys(seal, ['algorithm', 'hmac']) || seal.algorithm !== 'HMAC-SHA-256') {
    invalid('El sello de integridad del conjunto documental no es válido.', 'DOCUMENT_EXTRACTION_SET_INTEGRITY_INVALID');
  }
  return {algorithm: 'HMAC-SHA-256', hmac: sha256(seal.hmac, 'DOCUMENT_EXTRACTION_SET_INTEGRITY_INVALID')};
}

/**
 * Strictly parse a private, sealed, whole-set record.  Parsing only checks
 * HMAC syntax; verification intentionally belongs to the project-local key
 * holder and is not exposed by this data contract.
 */
export function documentExtractionSet(value) {
  const set = record(value);
  const keys = ['schema', 'revision', 'id', 'projectId', 'admissionId', 'requestId', 'profile', 'createdAt', 'toolchain', 'limits', 'assets', 'integrity'];
  if (!set || !hasOnlyKeys(set, keys)
    || set.schema !== DOCUMENT_EXTRACTION_SET_SCHEMA
    || set.revision !== DOCUMENT_EXTRACTION_SET_REVISION
    || typeof set.id !== 'string' || !SET_ID.test(set.id)
    || !exactUtc(set.createdAt)) {
    invalid('El conjunto documental sellado no es válido.', 'DOCUMENT_EXTRACTION_SET_INVALID');
  }
  const identity = identityFields({
    projectId: set.projectId,
    admissionId: set.admissionId,
    requestId: set.requestId,
    profile: set.profile,
    toolchain: set.toolchain,
    limits: set.limits,
    assets: set.assets,
  });
  const expectedId = documentExtractionSetIdFor(identity);
  if (set.id.toLowerCase() !== expectedId) {
    invalid('La identidad del conjunto documental no coincide con sus referencias selladas.', 'DOCUMENT_EXTRACTION_SET_ID_MISMATCH');
  }
  return freeze({
    schema: DOCUMENT_EXTRACTION_SET_SCHEMA,
    revision: DOCUMENT_EXTRACTION_SET_REVISION,
    id: expectedId,
    projectId: identity.projectId,
    admissionId: identity.admissionId,
    requestId: identity.requestId,
    profile: DOCUMENT_EXTRACTION_PROFILE,
    createdAt: set.createdAt,
    toolchain: {...identity.toolchain},
    limits: {...identity.limits},
    assets: identity.assets.map(asset => ({
      snapshot: {...asset.snapshot},
      receipt: {id: asset.receipt.id, derived: {...asset.receipt.derived}},
    })),
    integrity: integrity(set.integrity),
  });
}

/**
 * Exact payload that a project-local parent must authenticate.  It deliberately
 * excludes the integrity wrapper: an HMAC never authenticates itself.  This is
 * not a Factory projection and includes no method to create one.
 */
export function documentExtractionSetUnsignedPayload(value) {
  const set = documentExtractionSet(value);
  const {integrity: ignoredIntegrity, ...unsigned} = set;
  return freeze(unsigned);
}

/** Stable canonical bytes for the parent-owned HMAC payload. */
export function canonicalDocumentExtractionSet(value) {
  return canonical(documentExtractionSetUnsignedPayload(value));
}
