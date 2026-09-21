/**
 * Sublimine Document Extraction V2 contract.
 *
 * This module is intentionally a data contract, not a parser.  It makes the
 * narrow document boundary explicit so the dashboard can reject an unqualified
 * toolchain before a Factory mission is created.  The only material that may
 * cross into Factory after extraction is the opaque, immutable text object
 * described by `derived`; an original filename, vault path, asset id or parser
 * diagnostic is never a Factory input.
 */
import {createHash} from 'node:crypto';

export const DOCUMENT_EXTRACTION_RECEIPT_SCHEMA = 'sublimine-project-asset-extraction-v2';
export const DOCUMENT_EXTRACTION_TOOLCHAIN_LOCK_SCHEMA = 'sublimine-document-extraction-toolchain-lock-v1';
export const DOCUMENT_EXTRACTION_PREFLIGHT_SCHEMA = 'sublimine-document-extraction-preflight-v1';
export const DOCUMENT_EXTRACTION_PROFILE = 'untrusted-document-text-v2';
export const DOCUMENT_EXTRACTION_REVISION = 1;

export const DOCUMENT_EXTRACTION_LIMITS = Object.freeze({
  maxSourceBytes: 16 * 1024 * 1024,
  maxDerivedBytes: 512 * 1024,
  maxTotalDerivedBytes: 1024 * 1024,
  maxPdfPages: 150,
  maxDocxEntries: 400,
  maxDocxExpandedBytes: 16 * 1024 * 1024,
  maxDocxCompressionRatio: 100,
  timeoutMs: 15_000,
});

// These limits are part of the qualified sandbox profile rather than a
// best-effort host setting.  `prlimit` applies them before Python or Poppler
// receives an untrusted byte.  A lock that does not name that fixed wrapper is
// not a V2-qualified lock.
export const DOCUMENT_EXTRACTION_RESOURCE_LIMITS = Object.freeze({
  addressSpaceBytes: 256 * 1024 * 1024,
  cpuSeconds: 12,
  processCount: 16,
  outputFileBytes: 1024 * 1024,
});

export const DOCUMENT_KINDS = Object.freeze(['PDF', 'DOCX']);
export const DOCUMENT_TOOLCHAIN_STATES = Object.freeze(['DISABLED', 'QUALIFIED']);
export const DOCUMENT_PREFLIGHT_STATES = Object.freeze(['UNAVAILABLE', 'QUALIFIED']);

const SHA256 = /^[a-f0-9]{64}$/i;
const PROJECT_ID = /^project:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ASSET_ID = /^asset:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ADMISSION_ID = /^admission:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EXTRACTION_ID = /^asset-extraction:[a-f0-9]{64}$/i;
const OPAQUE_DERIVED_PATH = /^assets\/derived\/[a-f0-9]{48}\.txt$/i;
const ASCII_IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$/;
const ABSOLUTE_PATH = /^\/[A-Za-z0-9._/+@=-]{1,500}$/;
const RELEASE_ID = /^[a-f0-9]{64}$/i;
const DOCUMENT_RELEASE_PREFIX = '/opt/sublimine/document-extraction-v2/';
const DEFUSEDXML_INIT = /^\/usr\/lib\/python3(?:\.\d+)?\/dist-packages\/defusedxml\/__init__\.py$/;
const DEFUSEDXML_ELEMENT_TREE = /^\/usr\/lib\/python3(?:\.\d+)?\/dist-packages\/defusedxml\/ElementTree\.py$/;
const ISO_UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const MAX_TEXT_BYTES = 1_200;
const KIND_SET = new Set(DOCUMENT_KINDS);

export class DocumentExtractionContractError extends Error {
  constructor(message, code = 'DOCUMENT_EXTRACTION_CONTRACT_INVALID') {
    super(message);
    this.name = 'DocumentExtractionContractError';
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

function exactUtc(value) {
  return typeof value === 'string' && ISO_UTC.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value;
}

function boundedText(value, {maximum = MAX_TEXT_BYTES, name = 'texto'} = {}) {
  if (typeof value !== 'string' || !value.trim() || Buffer.byteLength(value, 'utf8') > maximum) {
    throw new DocumentExtractionContractError('El ' + name + ' no es válido.', 'DOCUMENT_EXTRACTION_TEXT_INVALID');
  }
  return value;
}

function hash(value, code = 'DOCUMENT_EXTRACTION_HASH_INVALID') {
  if (typeof value !== 'string' || !SHA256.test(value)) {
    throw new DocumentExtractionContractError('El hash SHA-256 no es válido.', code);
  }
  return value.toLowerCase();
}

function positiveInteger(value, maximum, code) {
  if (!Number.isSafeInteger(value) || value < 0 || value > maximum) {
    throw new DocumentExtractionContractError('El límite o contador documental no es válido.', code);
  }
  return value;
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

function documentKind(value) {
  const kind = String(value ?? '').toUpperCase();
  if (!KIND_SET.has(kind)) throw new DocumentExtractionContractError('El tipo documental no está permitido.', 'DOCUMENT_EXTRACTION_KIND_INVALID');
  return kind;
}

function opaqueDerivedPath(value) {
  if (typeof value !== 'string' || !OPAQUE_DERIVED_PATH.test(value)) {
    throw new DocumentExtractionContractError('La ruta del derivado documental no es opaca y válida.', 'DOCUMENT_EXTRACTION_DERIVED_PATH_INVALID');
  }
  return value.toLowerCase();
}

function executable(value, name) {
  const tool = record(value);
  if (!tool || !hasOnlyKeys(tool, ['path', 'sha256', 'version'])
    || typeof tool.path !== 'string' || !ABSOLUTE_PATH.test(tool.path)
    || typeof tool.version !== 'string' || !ASCII_IDENTIFIER.test(tool.version)) {
    throw new DocumentExtractionContractError('La herramienta ' + name + ' no está bloqueada de forma válida.', 'DOCUMENT_EXTRACTION_TOOLCHAIN_INVALID');
  }
  return {path: tool.path, sha256: hash(tool.sha256, 'DOCUMENT_EXTRACTION_TOOLCHAIN_INVALID'), version: tool.version};
}

function qualifiedPreflight(value) {
  const preflight = record(value);
  if (!preflight || !hasOnlyKeys(preflight, ['schema', 'revision', 'state', 'at', 'bindingHash', 'evidenceHash'])
    || preflight.schema !== DOCUMENT_EXTRACTION_PREFLIGHT_SCHEMA
    || preflight.revision !== DOCUMENT_EXTRACTION_REVISION
    || preflight.state !== 'QUALIFIED'
    || !exactUtc(preflight.at)) {
    throw new DocumentExtractionContractError('El preflight de aislamiento no está cualificado.', 'DOCUMENT_EXTRACTION_PREFLIGHT_INVALID');
  }
  return {
    schema: DOCUMENT_EXTRACTION_PREFLIGHT_SCHEMA,
    revision: DOCUMENT_EXTRACTION_REVISION,
    state: 'QUALIFIED',
    at: preflight.at,
    bindingHash: hash(preflight.bindingHash, 'DOCUMENT_EXTRACTION_PREFLIGHT_INVALID'),
    evidenceHash: hash(preflight.evidenceHash, 'DOCUMENT_EXTRACTION_PREFLIGHT_INVALID'),
  };
}

function documentRelease(value) {
  const release = record(value);
  if (!release || !hasOnlyKeys(release, ['id', 'root'])
    || typeof release.id !== 'string' || !RELEASE_ID.test(release.id)
    || typeof release.root !== 'string' || release.root !== DOCUMENT_RELEASE_PREFIX + release.id.toLowerCase()) {
    throw new DocumentExtractionContractError('El release documental no está fijado de forma válida.', 'DOCUMENT_EXTRACTION_TOOLCHAIN_INVALID');
  }
  return {id: release.id.toLowerCase(), root: release.root};
}

function toolchainBindingPayload(lock) {
  return {
    schema: DOCUMENT_EXTRACTION_TOOLCHAIN_LOCK_SCHEMA,
    revision: DOCUMENT_EXTRACTION_REVISION,
    state: 'QUALIFIED',
    release: {...lock.release},
    tools: {
      pdfinfo: {...lock.tools.pdfinfo},
      pdftotext: {...lock.tools.pdftotext},
      python: {...lock.tools.python},
      extractor: {...lock.tools.extractor},
    },
    dependencies: {
      defusedxml: {
        init: {...lock.dependencies.defusedxml.init},
        elementTree: {...lock.dependencies.defusedxml.elementTree},
      },
    },
    sandbox: {
      kind: 'bwrap-prlimit-v2',
      bwrap: {...lock.sandbox.bwrap},
      prlimit: {...lock.sandbox.prlimit},
      resourceLimits: {...DOCUMENT_EXTRACTION_RESOURCE_LIMITS},
    },
  };
}

/**
 * Stable identity for every executable and every enforceable sandbox setting.
 * A historical qualification only applies to this identity; runtime preflight
 * must independently recreate a fresh observation of the same binding.
 */
export function documentToolchainBindingHash(value) {
  const lock = value?.state === 'QUALIFIED' && value?.release && value?.dependencies?.defusedxml && value?.sandbox?.prlimit
    ? value
    : requireQualifiedDocumentToolchain(value);
  return createHash('sha256').update(canonical(toolchainBindingPayload(lock))).digest('hex');
}

/** A small static disabled lock is valid data, but never enables parsing. */
export function disabledDocumentToolchainLock(reason = 'No existe una toolchain documental cualificada en este runtime.') {
  return freeze({
    schema: DOCUMENT_EXTRACTION_TOOLCHAIN_LOCK_SCHEMA,
    revision: DOCUMENT_EXTRACTION_REVISION,
    state: 'DISABLED',
    reason: boundedText(reason, {maximum: 600, name: 'motivo de bloqueo'}),
  });
}

/**
 * Parse a lock without accepting arbitrary future properties.  A qualified
 * lock contains fixed binary identities and evidence that bwrap was preflighted
 * from the console service context; a disabled lock has no binary details.
 */
export function documentToolchainLock(value) {
  const lock = record(value);
  if (!lock || lock.schema !== DOCUMENT_EXTRACTION_TOOLCHAIN_LOCK_SCHEMA || lock.revision !== DOCUMENT_EXTRACTION_REVISION) {
    throw new DocumentExtractionContractError('El lock de extracción documental no es válido.', 'DOCUMENT_EXTRACTION_TOOLCHAIN_INVALID');
  }
  if (lock.state === 'DISABLED') {
    if (!hasOnlyKeys(lock, ['schema', 'revision', 'state', 'reason'])) {
      throw new DocumentExtractionContractError('El lock documental deshabilitado contiene campos no permitidos.', 'DOCUMENT_EXTRACTION_TOOLCHAIN_INVALID');
    }
    return disabledDocumentToolchainLock(lock.reason);
  }
  if (lock.state !== 'QUALIFIED'
    || !hasOnlyKeys(lock, ['schema', 'revision', 'state', 'qualifiedAt', 'lockHash', 'release', 'tools', 'dependencies', 'sandbox'])) {
    throw new DocumentExtractionContractError('El lock documental cualificado no es válido.', 'DOCUMENT_EXTRACTION_TOOLCHAIN_INVALID');
  }
  if (!exactUtc(lock.qualifiedAt)) {
    throw new DocumentExtractionContractError('La fecha del lock documental no es válida.', 'DOCUMENT_EXTRACTION_TOOLCHAIN_INVALID');
  }
  const tools = record(lock.tools);
  if (!tools || !hasOnlyKeys(tools, ['pdfinfo', 'pdftotext', 'python', 'extractor'])) {
    throw new DocumentExtractionContractError('El conjunto de herramientas documental no es válido.', 'DOCUMENT_EXTRACTION_TOOLCHAIN_INVALID');
  }
  const normalized = {
    schema: DOCUMENT_EXTRACTION_TOOLCHAIN_LOCK_SCHEMA,
    revision: DOCUMENT_EXTRACTION_REVISION,
    state: 'QUALIFIED',
    qualifiedAt: lock.qualifiedAt,
    lockHash: hash(lock.lockHash, 'DOCUMENT_EXTRACTION_TOOLCHAIN_INVALID'),
    release: documentRelease(lock.release),
    tools: {
      pdfinfo: executable(tools.pdfinfo, 'pdfinfo'),
      pdftotext: executable(tools.pdftotext, 'pdftotext'),
      python: executable(tools.python, 'python'),
      extractor: executable(tools.extractor, 'extractor'),
    },
    dependencies: null,
    sandbox: null,
  };
  // The parser itself uses these fixed Poppler locations; accepting a
  // look-alike elsewhere would make the lock describe a different program
  // from the one actually executed in the sandbox.
  if (normalized.tools.pdfinfo.path !== '/usr/bin/pdfinfo'
    || normalized.tools.pdftotext.path !== '/usr/bin/pdftotext'
    || !(/^\/usr\/bin\/python3\.\d+$/).test(normalized.tools.python.path)
    || normalized.tools.extractor.path !== normalized.release.root + '/document-extractor.py') {
    throw new DocumentExtractionContractError('La ubicación de herramientas documentales no coincide con el perfil V2.', 'DOCUMENT_EXTRACTION_TOOLCHAIN_INVALID');
  }
  const dependencies = record(lock.dependencies);
  if (!dependencies || !hasOnlyKeys(dependencies, ['defusedxml'])) {
    throw new DocumentExtractionContractError('Las dependencias del parser documental no están bloqueadas de forma válida.', 'DOCUMENT_EXTRACTION_TOOLCHAIN_INVALID');
  }
  const defusedxml = record(dependencies.defusedxml);
  if (!defusedxml || !hasOnlyKeys(defusedxml, ['init', 'elementTree'])) {
    throw new DocumentExtractionContractError('La dependencia XML endurecida no está bloqueada de forma válida.', 'DOCUMENT_EXTRACTION_TOOLCHAIN_INVALID');
  }
  normalized.dependencies = {
    defusedxml: {
      init: executable(defusedxml.init, 'defusedxml.init'),
      elementTree: executable(defusedxml.elementTree, 'defusedxml.elementTree'),
    },
  };
  if (!DEFUSEDXML_INIT.test(normalized.dependencies.defusedxml.init.path)
    || !DEFUSEDXML_ELEMENT_TREE.test(normalized.dependencies.defusedxml.elementTree.path)) {
    throw new DocumentExtractionContractError('Las rutas de defusedxml no coinciden con el perfil V2.', 'DOCUMENT_EXTRACTION_TOOLCHAIN_INVALID');
  }
  const sandbox = record(lock.sandbox);
  if (!sandbox || !hasOnlyKeys(sandbox, ['kind', 'bwrap', 'prlimit', 'preflight']) || sandbox.kind !== 'bwrap-prlimit-v2') {
    throw new DocumentExtractionContractError('El sandbox documental no está bloqueado de forma válida.', 'DOCUMENT_EXTRACTION_TOOLCHAIN_INVALID');
  }
  normalized.sandbox = {
    kind: 'bwrap-prlimit-v2',
    bwrap: executable(sandbox.bwrap, 'bwrap'),
    prlimit: executable(sandbox.prlimit, 'prlimit'),
    preflight: qualifiedPreflight(sandbox.preflight),
  };
  if (normalized.sandbox.bwrap.path !== '/usr/bin/bwrap' || normalized.sandbox.prlimit.path !== '/usr/bin/prlimit') {
    throw new DocumentExtractionContractError('Las ubicaciones de bwrap y prlimit no coinciden con el perfil V2.', 'DOCUMENT_EXTRACTION_TOOLCHAIN_INVALID');
  }
  if (normalized.sandbox.preflight.bindingHash !== documentToolchainBindingHash(normalized)) {
    throw new DocumentExtractionContractError('El preflight histórico no pertenece a esta toolchain documental.', 'DOCUMENT_EXTRACTION_PREFLIGHT_BINDING_MISMATCH');
  }
  const unsigned = {...normalized};
  delete unsigned.lockHash;
  if (createHash('sha256').update(canonical(unsigned)).digest('hex') !== normalized.lockHash) {
    throw new DocumentExtractionContractError('El hash del lock documental no coincide.', 'DOCUMENT_EXTRACTION_TOOLCHAIN_HASH_MISMATCH');
  }
  return freeze(normalized);
}

/** Throws if parsing is not licensed by an exact, qualified toolchain lock. */
export function requireQualifiedDocumentToolchain(value) {
  const lock = documentToolchainLock(value);
  if (lock.state !== 'QUALIFIED') {
    throw new DocumentExtractionContractError('La extracción PDF/DOCX no está activada: la toolchain aislada no está cualificada.', 'DOCUMENT_EXTRACTION_TOOLCHAIN_UNAVAILABLE');
  }
  return lock;
}

export function documentExtractionIdFor({projectId, assetId, admissionId, sourceSha256, kind, toolchainLockHash}) {
  if (typeof projectId !== 'string' || !PROJECT_ID.test(projectId)
    || typeof assetId !== 'string' || !ASSET_ID.test(assetId)
    || typeof admissionId !== 'string' || !ADMISSION_ID.test(admissionId)) {
    throw new DocumentExtractionContractError('La identidad documental de extracción no es válida.', 'DOCUMENT_EXTRACTION_IDENTITY_INVALID');
  }
  const material = canonical({
    schema: DOCUMENT_EXTRACTION_RECEIPT_SCHEMA,
    revision: DOCUMENT_EXTRACTION_REVISION,
    profile: DOCUMENT_EXTRACTION_PROFILE,
    projectId,
    assetId,
    admissionId,
    sourceSha256: hash(sourceSha256),
    kind: documentKind(kind),
    toolchainLockHash: hash(toolchainLockHash),
  });
  return 'asset-extraction:' + createHash('sha256').update(material).digest('hex');
}

function exactLimits(value) {
  const limits = record(value);
  if (!limits || !hasOnlyKeys(limits, Object.keys(DOCUMENT_EXTRACTION_LIMITS))) {
    throw new DocumentExtractionContractError('Los límites documentales no coinciden con el perfil V2.', 'DOCUMENT_EXTRACTION_LIMITS_INVALID');
  }
  for (const [key, expected] of Object.entries(DOCUMENT_EXTRACTION_LIMITS)) {
    if (limits[key] !== expected) throw new DocumentExtractionContractError('Los límites documentales no coinciden con el perfil V2.', 'DOCUMENT_EXTRACTION_LIMITS_INVALID');
  }
  return {...DOCUMENT_EXTRACTION_LIMITS};
}

function extractionObservations(value, kind) {
  const observations = record(value);
  const allowed = kind === 'PDF' ? ['pages', 'textLayer'] : ['entries', 'expandedBytes', 'bodyParts'];
  if (!observations || !hasOnlyKeys(observations, allowed)) {
    throw new DocumentExtractionContractError('Las observaciones de extracción documental no son válidas.', 'DOCUMENT_EXTRACTION_OBSERVATIONS_INVALID');
  }
  if (kind === 'PDF') {
    if (!Number.isSafeInteger(observations.pages) || observations.pages < 1 || observations.pages > DOCUMENT_EXTRACTION_LIMITS.maxPdfPages
      || observations.textLayer !== 'PRESENT') {
      throw new DocumentExtractionContractError('La observación de PDF no es válida.', 'DOCUMENT_EXTRACTION_OBSERVATIONS_INVALID');
    }
    return {pages: observations.pages, textLayer: 'PRESENT'};
  }
  if (!Number.isSafeInteger(observations.entries) || observations.entries < 1 || observations.entries > DOCUMENT_EXTRACTION_LIMITS.maxDocxEntries
    || !Number.isSafeInteger(observations.expandedBytes) || observations.expandedBytes < 1 || observations.expandedBytes > DOCUMENT_EXTRACTION_LIMITS.maxDocxExpandedBytes
    || !Number.isSafeInteger(observations.bodyParts) || observations.bodyParts < 1 || observations.bodyParts > 1) {
    throw new DocumentExtractionContractError('La observación de DOCX no es válida.', 'DOCUMENT_EXTRACTION_OBSERVATIONS_INVALID');
  }
  return {entries: observations.entries, expandedBytes: observations.expandedBytes, bodyParts: observations.bodyParts};
}

/**
 * Validate the parent-owned sealed receipt.  The HMAC itself is produced and
 * checked by ProjectSpaceService because it owns the project-local key; this
 * contract only accepts its fixed-size, hexadecimal representation.
 */
export function documentExtractionReceipt(value) {
  const receipt = record(value);
  const keys = ['schema', 'revision', 'id', 'profile', 'projectId', 'assetId', 'admissionId', 'createdAt', 'source', 'toolchain', 'limits', 'derived', 'observations', 'integrity'];
  if (!receipt || !hasOnlyKeys(receipt, keys)
    || receipt.schema !== DOCUMENT_EXTRACTION_RECEIPT_SCHEMA
    || receipt.revision !== DOCUMENT_EXTRACTION_REVISION
    || receipt.profile !== DOCUMENT_EXTRACTION_PROFILE
    || typeof receipt.id !== 'string' || !EXTRACTION_ID.test(receipt.id)
    || typeof receipt.projectId !== 'string' || !PROJECT_ID.test(receipt.projectId)
    || typeof receipt.assetId !== 'string' || !ASSET_ID.test(receipt.assetId)
    || typeof receipt.admissionId !== 'string' || !ADMISSION_ID.test(receipt.admissionId)
    || !exactUtc(receipt.createdAt)) {
    throw new DocumentExtractionContractError('El recibo de extracción documental no es válido.', 'DOCUMENT_EXTRACTION_RECEIPT_INVALID');
  }
  const source = record(receipt.source);
  if (!source || !hasOnlyKeys(source, ['sha256', 'bytes', 'kind'])
    || !Number.isSafeInteger(source.bytes) || source.bytes < 1 || source.bytes > DOCUMENT_EXTRACTION_LIMITS.maxSourceBytes) {
    throw new DocumentExtractionContractError('El origen documental del recibo no es válido.', 'DOCUMENT_EXTRACTION_RECEIPT_INVALID');
  }
  const kind = documentKind(source.kind);
  const toolchain = record(receipt.toolchain);
  if (!toolchain || !hasOnlyKeys(toolchain, ['lockHash', 'profile']) || toolchain.profile !== DOCUMENT_EXTRACTION_PROFILE) {
    throw new DocumentExtractionContractError('La procedencia de toolchain del recibo no es válida.', 'DOCUMENT_EXTRACTION_RECEIPT_INVALID');
  }
  const derived = record(receipt.derived);
  if (!derived || !hasOnlyKeys(derived, ['path', 'sha256', 'bytes'])
    || !Number.isSafeInteger(derived.bytes) || derived.bytes < 1 || derived.bytes > DOCUMENT_EXTRACTION_LIMITS.maxDerivedBytes) {
    throw new DocumentExtractionContractError('El derivado documental del recibo no es válido.', 'DOCUMENT_EXTRACTION_RECEIPT_INVALID');
  }
  const integrity = record(receipt.integrity);
  if (!integrity || !hasOnlyKeys(integrity, ['algorithm', 'hmac']) || integrity.algorithm !== 'HMAC-SHA-256') {
    throw new DocumentExtractionContractError('El sello de integridad documental no es válido.', 'DOCUMENT_EXTRACTION_RECEIPT_INVALID');
  }
  const normalized = {
    schema: DOCUMENT_EXTRACTION_RECEIPT_SCHEMA,
    revision: DOCUMENT_EXTRACTION_REVISION,
    id: receipt.id.toLowerCase(),
    profile: DOCUMENT_EXTRACTION_PROFILE,
    projectId: receipt.projectId,
    assetId: receipt.assetId,
    admissionId: receipt.admissionId,
    createdAt: receipt.createdAt,
    source: {sha256: hash(source.sha256), bytes: source.bytes, kind},
    toolchain: {lockHash: hash(toolchain.lockHash), profile: DOCUMENT_EXTRACTION_PROFILE},
    limits: exactLimits(receipt.limits),
    derived: {path: opaqueDerivedPath(derived.path), sha256: hash(derived.sha256), bytes: derived.bytes},
    observations: extractionObservations(receipt.observations, kind),
    integrity: {algorithm: 'HMAC-SHA-256', hmac: hash(integrity.hmac, 'DOCUMENT_EXTRACTION_RECEIPT_INVALID')},
  };
  const expectedId = documentExtractionIdFor({
    projectId: normalized.projectId,
    assetId: normalized.assetId,
    admissionId: normalized.admissionId,
    sourceSha256: normalized.source.sha256,
    kind,
    toolchainLockHash: normalized.toolchain.lockHash,
  });
  if (normalized.id !== expectedId) {
    throw new DocumentExtractionContractError('El identificador del recibo no coincide con su identidad sellada.', 'DOCUMENT_EXTRACTION_RECEIPT_ID_MISMATCH');
  }
  return freeze(normalized);
}

/**
 * The exact payload that ProjectSpaceService must authenticate with its local
 * HMAC key.  `integrity` is deliberately absent: an HMAC must never cover
 * itself, and a caller must not be able to make a different integrity value
 * look like a different extraction fact.
 *
 * This is an internal receipt payload, not a Factory projection.  It still
 * carries source identity and toolchain facts so a parent can bind the HMAC to
 * the complete local receipt before it decides whether any derivative is
 * eligible for Factory admission.
 */
export function documentExtractionReceiptUnsignedPayload(value) {
  const receipt = documentExtractionReceipt(value);
  const {integrity, ...unsigned} = receipt;
  return freeze(unsigned);
}

/**
 * Stable canonical bytes for the payload authenticated by the project-local
 * HMAC.  The historical export name remains for compatibility, but it now
 * explicitly canonicalizes the unsigned payload rather than the HMAC-bearing
 * wrapper.
 */
export function canonicalDocumentExtractionReceipt(value) {
  return canonical(documentExtractionReceiptUnsignedPayload(value));
}

/**
 * The only document-derived descriptor allowed to reach Factory.  It is
 * intentionally incapable of carrying the original filename, vault location,
 * asset/admission identity, parser details or receipt HMAC.
 */
export function documentExtractionFactoryInput(value) {
  // Validate first so malformed data never receives a more authoritative
  // error than it deserves.  A syntactically shaped HMAC is not proof that
  // ProjectSpaceService verified it with the project-local integrity key.
  documentExtractionReceipt(value);
  throw new DocumentExtractionContractError(
    'La proyección documental hacia Factory está deshabilitada hasta que ProjectSpaceService verifique el HMAC local del recibo.',
    'DOCUMENT_EXTRACTION_FACTORY_AUTHORITY_REQUIRED',
  );
}
