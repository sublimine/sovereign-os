#!/usr/bin/env node
/**
 * Sublimine Console
 *
 * A local-only control surface for the verified Sublimine runtime.
 * The browser never reads SQLite or launches arbitrary shell commands. Every
 * operation crosses this small allowlisted bridge to the verified CLI.
 */
import {createServer} from 'node:http';
import {spawn} from 'node:child_process';
import {appendFile, readFile, mkdir, writeFile, rm} from 'node:fs/promises';
import {existsSync, readFileSync} from 'node:fs';
import {dirname, extname, join, resolve, sep} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {homedir} from 'node:os';
import {createHash, randomBytes, randomUUID} from 'node:crypto';
import {pipeline} from 'node:stream/promises';
import {
  ProjectSpaceError,
  ProjectSpaceService,
  PROJECT_CONTEXT_CLASSIFICATION,
  PROJECT_PUBLIC_SOURCED_CONTEXT_SCOPE,
  PROJECT_PUBLIC_SOURCED_ENTRY_MODE,
  PROJECT_PUBLIC_SOURCED_ROUTE_BINDING_SCHEMA,
  PROJECT_PUBLIC_SOURCED_ROUTE_KIND,
  MAX_PROJECT_ASSET_REFERENCES,
  assertAssetId,
  assertDeliverableId,
  assertConversationId,
  assertMemoryId,
  assertProjectId,
  normalizeModelPolicy,
} from './project-spaces.mjs';
import {DocumentExtractionRunner} from './document-extraction-runner.mjs';
import {DOCUMENT_EXTRACTION_LIMITS, disabledDocumentToolchainLock} from './document-extraction-contract.mjs';
import {NullProjectRuntimeSupervisor, ProjectRuntimeSupervisor} from './project-runtime-supervisor.mjs';
import {RuntimeReleaseRegistry, RuntimeReleaseRegistryError} from './runtime-release-registry.mjs';
import {FACTORY_DEFAULT_EXECUTION_TARGET, executionTargetInventory} from '../factory/lib/execution-targets.mjs';
import {PUBLIC_MISSION_STATUSES} from '../factory/lib/mission-public-projection.mjs';
import {ES_USED_CAR_LISTING_EVIDENCE_PROFILE_V2_ID,isEsUsedCarListingPublicFieldsQuestion} from '../factory/lib/sourced-evidence-profile.mjs';

const moduleDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(moduleDir, '..');
const defaultFactoryBinary = join(homedir(), '.local', 'bin', 'sovereign');
const defaultFactoryState = join(homedir(), '.local', 'state', 'sovereign-factory');
const defaultConsoleState = join(homedir(), '.local', 'state', 'sovereign-console');
const defaultRuntimeReleasesRoot = join(homedir(), '.local', 'share', 'sovereign-factory', 'releases');
const staticDirectory = join(moduleDir, 'public');
const defaultDocumentExtractionToolchainLockPath = join(moduleDir, 'document-extraction-toolchain.lock.json');

const MIME_TYPES = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.svg', 'image/svg+xml; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
]);

const ENTRY_MODES = new Set([
  'planned',
  'bounded-read-response-v1',
  'sourced-response-v1',
  'closed-response-v1',
  'closed-response-v2',
  'closed-response-v3',
]);
const PRESETS = new Set(['adaptive-v1', 'adaptive-v2', 'adaptive-v3']);
const EFFORTS = new Set(['low', 'medium', 'high', 'xhigh', 'max', 'ultra']);
const ACTIONS = new Set(['pause', 'continue', 'cancel', 'retry-review']);
const MAX_INTENT_BYTES = 256 * 1024;
const MAX_BODY_BYTES = 2 * 1024 * 1024;
// The two independently sealed derivation profiles have their own aggregate
// limits (512 KiB for V1 text and 1 MiB for V2 documents).  This is the
// narrow request-directory ceiling when the server materializes either
// profile; no original vault byte crosses this boundary.
const MAX_FACTORY_DERIVED_ASSET_BYTES = (512 * 1024) + DOCUMENT_EXTRACTION_LIMITS.maxTotalDerivedBytes;
const DOCUMENT_ASSET_MEDIA_TYPES = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);
const LEGACY_PROJECT_CONTEXT_PACK_MARKER = '--- SOVEREIGN_PROJECT_CONTEXT_PACK_V1 ---';
const EMPTY_ATTACHMENT_MANIFEST_HASH = createHash('sha256').update('[]').digest('hex');
const PUBLIC_MISSION_STATUS_SET = new Set(PUBLIC_MISSION_STATUSES);
const PROJECT_QUEUE_LIFECYCLE_READ_CONCURRENCY = 4;
// A reconciliation is deliberately a bounded server action, never a hidden
// side effect of opening a project or polling its status. Three candidates
// give the local console a path through a backlog without turning one
// scheduler tick into an unbounded Factory sweep.
const PROJECT_DELIVERY_RECONCILIATION_LIMIT = 3;
const PROJECT_DELIVERY_RECONCILIATION_CONCURRENCY = 2;
const PROJECT_DELIVERY_RECONCILIATION_INITIAL_DELAY_MS = 2_500;
const PROJECT_DELIVERY_RECONCILIATION_ACTIVE_DELAY_MS = 5_000;
const PROJECT_DELIVERY_RECONCILIATION_MAX_DELAY_MS = 60_000;
const PUBLIC_SOURCED_MAX_INTENT_BYTES = 1_400;
const PUBLIC_SOURCED_QUERY_MARKER = /(?:[¿?]|\b(?:qué|que|cuál|cual|cuáles|cuales|cómo|como|cuándo|cuando|dónde|donde|quién|quien|which|what|how|when|where)\b)/iu;
const PUBLIC_SOURCED_ESCALATION_TERMS = /\b(?:archivo|adjunt|documento|contrato|código|codigo|repositorio|proyecto|cliente|memoria|contexto|planifica(?:r|ción|cion)?|desarroll|implement|crea(?:r|ción|cion)?|investig|compar|informe|an[aá]lis(?:is)?|estrateg|jur[ií]dic|legal|ley|m[eé]dic|salud|diagn[oó]st|financ|invers|presupuesto|reclam|privad|confidenc)\b/iu;
// A question marker alone is not enough to establish a public factual
// question. In particular, conversational check-ins such as "¿quién eres?"
// or "¿me recibes?" are requests about this assistant or its availability,
// not requests whose answer should be acquired from public sources. Keep this
// deliberately narrow and anchored: a bare word such as "recibes" may be part
// of an ordinary factual question, while a whole presence check-in is not.
// Ordinary factual questions (including "¿quién es ...?") retain the sourced
// route.
const PUBLIC_SOURCED_CONVERSATIONAL_CHECK_IN = /^(?:(?:hola|buenas(?:\s+(?:d[ií]as|tardes|noches))?|hey|saludos)[\s,;:¡!¿?.]*)*[\s,;:¡!¿?.]*(?:(?:qu[ií]en|quien)\s+(?:eres|sois)|(?:qu[eé]|que)\s+(?:eres|puedes|sabes)(?:\s+hacer)?|(?:c[oó]mo|como)\s+(?:est[aá]s|estais|están)|(?:qu[eé]|que)\s+tal|todo\s+bien|me\s+(?:recibes|escuchas|oyes|lees)|(?:est[aá]s|estas|sigues)\s+(?:ah[ií]|ahi)|hay\s+alguien(?:\s+(?:ah[ií]|ahi))?)[\s,;:¡!¿?.]*$/iu;
const PROJECT_PUBLIC_SOURCED_ROUTE_BINDING = Object.freeze({
  schema: PROJECT_PUBLIC_SOURCED_ROUTE_BINDING_SCHEMA,
  kind: PROJECT_PUBLIC_SOURCED_ROUTE_KIND,
  factoryEntryMode: PROJECT_PUBLIC_SOURCED_ENTRY_MODE,
  privateContext: 'WITHHELD_NOT_SAMPLED',
  assets: 'FORBIDDEN',
  fallback: 'EXPLICIT_NEW_PLANNED_ADMISSION_REQUIRED',
});

function defaultDocumentExtractionToolchainLock() {
  try {
    return JSON.parse(readFileSync(defaultDocumentExtractionToolchainLockPath, 'utf8'));
  } catch {
    // A missing/corrupt local configuration is never an implicit reason to
    // parse an untrusted document.  The injected runner reports the stable
    // unavailable state only if a document mission actually reaches it.
    return disabledDocumentToolchainLock('La toolchain documental local no está disponible o no es legible.');
  }
}

function configuredDocumentExtractionRunner(options) {
  if (Object.hasOwn(options, 'documentExtractionRunner')) return options.documentExtractionRunner;
  const toolchainLock = Object.hasOwn(options, 'documentExtractionToolchainLock')
    ? options.documentExtractionToolchainLock
    : defaultDocumentExtractionToolchainLock();
  return new DocumentExtractionRunner({toolchainLock});
}

// Deliberately conservative, deterministic admission selector for a project
// public question. It is not a model call and it never reads project memory:
// any ambiguity remains on the full planned route. The resulting binding is
// persisted by ProjectSpaceService and validated again before Factory intake.
function isPublicSourcedQuestion(textValue) {
  if (typeof textValue !== 'string' || Buffer.byteLength(textValue, 'utf8') > PUBLIC_SOURCED_MAX_INTENT_BYTES) return false;
  const normalized = textValue.normalize('NFKC').trim().toLocaleLowerCase('es-ES');
  if (!normalized || !PUBLIC_SOURCED_QUERY_MARKER.test(normalized) || PUBLIC_SOURCED_ESCALATION_TERMS.test(normalized)
    || PUBLIC_SOURCED_CONVERSATIONAL_CHECK_IN.test(normalized)) return false;
  // Several paragraphs or enumerated work products are a reliable ambiguity
  // signal. We intentionally do not try to infer whether a long task could
  // perhaps be simplified into a direct answer.
  if (/\n\s*\n/u.test(normalized) || /(?:^|\s)[1-9][.)]\s/u.test(normalized)) return false;
  return normalized.split(/[.!?…]+/u).filter(Boolean).length <= 4;
}

function projectPublicSourcedRouteBinding() {
  return {...PROJECT_PUBLIC_SOURCED_ROUTE_BINDING};
}

function selectProjectExecutionRoute(submission) {
  const explicitlySourced = submission.entryMode === PROJECT_PUBLIC_SOURCED_ENTRY_MODE;
  const canUsePublicSourced = submission.preset === 'adaptive-v2'
    && submission.assetReferences.length === 0
    && isPublicSourcedQuestion(submission.text);
  if (explicitlySourced && !canUsePublicSourced) {
    throw new ConsoleError('La ruta pública con fuentes sólo admite una pregunta factual pública acotada, sin archivos ni contexto privado. Esta petición requiere la ruta planificada.', 409, 'PROJECT_PUBLIC_SOURCE_ROUTE_INELIGIBLE');
  }
  if (explicitlySourced || (submission.entryMode === 'planned' && canUsePublicSourced)) {
    const sourcedEvidenceProfile=isEsUsedCarListingPublicFieldsQuestion(submission.text)
      ?ES_USED_CAR_LISTING_EVIDENCE_PROFILE_V2_ID:null;
    return {
      submission: {...submission, entryMode: PROJECT_PUBLIC_SOURCED_ENTRY_MODE},
      routeBinding: projectPublicSourcedRouteBinding(),
      sourcedFallback: 'defer-only-v1',
      sourcedEvidenceProfile,
      routing: {
        mode: 'PROJECT_PUBLIC_SOURCED_AUTOMATIC_V1',
        context: {...PROJECT_PUBLIC_SOURCED_CONTEXT_SCOPE},
        escalation: 'EXPLICIT_NEW_PLANNED_ADMISSION_REQUIRED',
      },
    };
  }
  if (submission.entryMode !== 'planned') {
    throw new ConsoleError('Las misiones de proyecto con memoria privada requieren la ruta planificada; las rutas cerradas o de respuesta acotada no admiten un segundo contexto.', 409, 'PROJECT_CONTEXT_ROUTE_UNSUPPORTED');
  }
  return {submission, routeBinding: null, sourcedFallback: null, sourcedEvidenceProfile:null, routing: null};
}

export class ConsoleError extends Error {
  constructor(message, status = 400, code = 'CONSOLE_REQUEST') {
    super(message);
    this.name = 'ConsoleError';
    this.status = status;
    this.code = code;
  }
}

export function parseFactoryJson(output) {
  const trimmed = String(output ?? '').trim();
  if (!trimmed) throw new ConsoleError('La fábrica no devolvió una respuesta legible.', 502, 'FACTORY_EMPTY_RESPONSE');
  try {
    return JSON.parse(trimmed);
  } catch {
    const firstObject = Math.min(...['{', '['].map(char => {
      const index = trimmed.indexOf(char);
      return index < 0 ? Number.POSITIVE_INFINITY : index;
    }));
    if (!Number.isFinite(firstObject)) {
      throw new ConsoleError('La respuesta de la fábrica no era JSON válido.', 502, 'FACTORY_INVALID_RESPONSE');
    }
    try {
      return JSON.parse(trimmed.slice(firstObject));
    } catch {
      throw new ConsoleError('La respuesta de la fábrica no era JSON válido.', 502, 'FACTORY_INVALID_RESPONSE');
    }
  }
}

export function assertMissionId(value) {
  if (typeof value !== 'string' || !/^mission:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) {
    throw new ConsoleError('El identificador de misión no es válido.', 400, 'INVALID_MISSION_ID');
  }
  return value;
}

export function assertRoleId(value) {
  if (typeof value !== 'string' || !/^[a-z][a-z0-9_]{1,80}$/i.test(value)) {
    throw new ConsoleError('El identificador de rol no es válido.', 400, 'INVALID_ROLE_ID');
  }
  return value;
}

function json(response, status, payload) {
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
  });
  response.end(JSON.stringify(payload));
}

function text(response, status, payload, contentType = 'text/plain; charset=utf-8') {
  response.writeHead(status, {
    'content-type': contentType,
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
  });
  response.end(payload);
}

function securityHeaders(response) {
  response.setHeader('content-security-policy', [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self'",
    "connect-src 'self'",
    "img-src 'self' data:",
    "font-src 'self'",
    "object-src 'none'",
    "base-uri 'none'",
    "frame-ancestors 'none'",
    "form-action 'self'",
  ].join('; '));
  response.setHeader('cross-origin-opener-policy', 'same-origin');
  response.setHeader('cross-origin-resource-policy', 'same-origin');
  response.setHeader('referrer-policy', 'no-referrer');
  response.setHeader('x-frame-options', 'DENY');
  // Voice is opt-in in the browser. The console stores only a reviewed text
  // transcript; it deliberately exposes no audio upload endpoint.
  response.setHeader('permissions-policy', 'geolocation=(), microphone=(self), camera=()');
}

function publicError(error) {
  if (error instanceof ConsoleError) {
    return {status: error.status, code: error.code, message: error.message};
  }
  if (error instanceof ProjectSpaceError) {
    return {status: error.status, code: error.code, message: error.message};
  }
  return {status: 500, code: 'CONSOLE_INTERNAL', message: 'La consola encontró un error inesperado.'};
}

function asOptionalString(value, name, max = 160) {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string' || Buffer.byteLength(value, 'utf8') > max) {
    throw new ConsoleError(name + ' no es válido.', 400, 'INVALID_OPTION');
  }
  return value;
}

function numberOption(value, name, minimum, maximum) {
  if (value === undefined || value === null || value === '') return null;
  const number = Number(value);
  if (!Number.isInteger(number) || number < minimum || number > maximum) {
    throw new ConsoleError(name + ' debe estar entre ' + minimum + ' y ' + maximum + '.', 400, 'INVALID_OPTION');
  }
  return number;
}

function normalizeAssetReferences(value) {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value) || value.length > MAX_PROJECT_ASSET_REFERENCES) {
    throw new ConsoleError('Las referencias de archivos no son válidas.', 400, 'INVALID_ASSET_REFERENCES');
  }
  const seen = new Set();
  return value.map((reference, index) => {
    if (!reference || typeof reference !== 'object' || Array.isArray(reference)
      || Object.keys(reference).length !== 1 || typeof reference.assetId !== 'string') {
      throw new ConsoleError('La referencia de archivo ' + (index + 1) + ' no es válida.', 400, 'INVALID_ASSET_REFERENCES');
    }
    try {
      assertAssetId(reference.assetId);
    } catch {
      throw new ConsoleError('La referencia de archivo ' + (index + 1) + ' no es válida.', 400, 'INVALID_ASSET_REFERENCES');
    }
    if (seen.has(reference.assetId)) {
      throw new ConsoleError('Un archivo no puede adjuntarse dos veces a la misma misión.', 400, 'DUPLICATE_ASSET_REFERENCE');
    }
    seen.add(reference.assetId);
    return {assetId: reference.assetId};
  });
}

function normalizeConversationLink(value) {
  if (value === undefined || value === null) return null;
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || Object.keys(value).length !== 2
    || !Object.hasOwn(value, 'conversationId') || !Object.hasOwn(value, 'sourceMessageId')) {
    throw new ConsoleError('El vínculo de conversación no es válido.', 400, 'INVALID_CONVERSATION_LINK');
  }
  try {
    return {
      conversationId: assertConversationId(value.conversationId),
      sourceMessageId: assertMemoryId(value.sourceMessageId),
    };
  } catch {
    throw new ConsoleError('El vínculo de conversación no es válido.', 400, 'INVALID_CONVERSATION_LINK');
  }
}

function isExactUtf8(value) {
  return typeof value === 'string' && Buffer.from(value, 'utf8').toString('utf8') === value;
}

// ProjectSpaceService is the only component allowed to read the private asset
// vault.  Before the Factory can see a textual derivative, independently
// verify the sealed projection again and materialize it below this one-shot
// request directory.  The provider receives only an opaque workspace path and
// untrusted UTF-8 bytes -- never a vault path, original filename, media type,
// asset ID, extraction receipt, or a host file handle.  This is deliberately
// profile-neutral: the service has already authenticated whether a bounded
// derivative came from V1 text or the separately sealed V2 document channel.
async function materializeVerifiedAssetInput(requestDirectory, derivation) {
  if (!derivation || typeof derivation !== 'object'
    || typeof derivation.inputPath !== 'string'
    || !/^assets\/derived\/[a-f0-9]{48}\.txt$/i.test(derivation.inputPath)
    || !isExactUtf8(derivation.content) || !derivation.content.length || derivation.content.includes('\0')
    || !Number.isSafeInteger(derivation.bytes) || derivation.bytes < 1 || derivation.bytes > DOCUMENT_EXTRACTION_LIMITS.maxDerivedBytes
    || typeof derivation.sha256 !== 'string' || !/^[a-f0-9]{64}$/i.test(derivation.sha256)) {
    throw new ConsoleError('La proyección textual sellada del archivo no es válida.', 409, 'ASSET_DERIVATION_INVALID');
  }
  const contentBytes = Buffer.byteLength(derivation.content, 'utf8');
  const contentHash = createHash('sha256').update(derivation.content, 'utf8').digest('hex');
  if (contentBytes !== derivation.bytes || contentHash !== derivation.sha256.toLowerCase()) {
    throw new ConsoleError('La proyección textual sellada del archivo no coincide con su recibo.', 409, 'ASSET_DERIVATION_INTEGRITY');
  }
  const root = resolve(requestDirectory);
  const source = resolve(root, ...derivation.inputPath.split('/'));
  if (!source.startsWith(root + sep)) {
    throw new ConsoleError('La proyección textual intentó salir de su espacio temporal.', 409, 'ASSET_DERIVATION_PATH');
  }
  await mkdir(dirname(source), {recursive: true, mode: 0o700});
  await writeFile(source, derivation.content, {encoding: 'utf8', mode: 0o600});
  return {source, path: derivation.inputPath};
}

function isDocumentAssetReference(reference) {
  return reference && typeof reference === 'object'
    && DOCUMENT_ASSET_MEDIA_TYPES.has(reference.mediaType);
}

function assertDistinctBoundedAssetDerivations(derivations) {
  if (!Array.isArray(derivations) || derivations.length > MAX_PROJECT_ASSET_REFERENCES) {
    throw new ConsoleError('Las proyecciones selladas de archivos no son válidas.', 409, 'ASSET_DERIVATION_INVALID');
  }
  const paths = new Set();
  let total = 0;
  for (const derivation of derivations) {
    if (!derivation || typeof derivation !== 'object'
      || typeof derivation.inputPath !== 'string'
      || !/^assets\/derived\/[a-f0-9]{48}\.txt$/i.test(derivation.inputPath)
      || !Number.isSafeInteger(derivation.bytes) || derivation.bytes < 1
      || derivation.bytes > DOCUMENT_EXTRACTION_LIMITS.maxDerivedBytes
      || paths.has(derivation.inputPath)) {
      throw new ConsoleError('Las proyecciones selladas de archivos no son válidas.', 409, 'ASSET_DERIVATION_INVALID');
    }
    paths.add(derivation.inputPath);
    total += derivation.bytes;
    if (!Number.isSafeInteger(total) || total > MAX_FACTORY_DERIVED_ASSET_BYTES) {
      throw new ConsoleError('Las proyecciones de archivos superan el límite agregado de la misión.', 413, 'ASSET_DERIVATION_TOTAL_LIMIT');
    }
  }
}

function validateSubmission(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new ConsoleError('La solicitud de misión debe ser un objeto JSON.', 400, 'INVALID_SUBMISSION');
  }
  if (!isExactUtf8(payload.text) || !payload.text.length || payload.text.includes('\0') || Buffer.byteLength(payload.text, 'utf8') > MAX_INTENT_BYTES) {
    throw new ConsoleError('El mandato debe ser texto UTF-8 no vacío de hasta 256 KiB.', 400, 'INVALID_INTENT');
  }
  const entryMode = payload.entryMode ?? 'planned';
  const preset = payload.preset ?? 'adaptive-v2';
  if (!ENTRY_MODES.has(entryMode) || !PRESETS.has(preset)) {
    throw new ConsoleError('La ruta o el preset seleccionado no es válido.', 400, 'INVALID_ROUTE');
  }
  if (preset === 'adaptive-v3' && !['planned', 'closed-response-v3'].includes(entryMode)) {
    throw new ConsoleError('Adaptive v3 sólo permite la ruta planificada o cerrada v3.', 400, 'INVALID_ROUTE');
  }
  if (entryMode === 'closed-response-v3' && preset !== 'adaptive-v3') {
    throw new ConsoleError('La ruta cerrada v3 requiere el preset adaptive-v3.', 400, 'INVALID_ROUTE');
  }
  // File bytes never travel through a mission JSON body. They must first be
  // sealed in the project-local asset vault, then referenced by immutable ID.
  if (Object.hasOwn(payload, 'attachments') && (!Array.isArray(payload.attachments) || payload.attachments.length > 0)) {
    throw new ConsoleError('Los archivos se adjuntan mediante assetReferences tras una carga privada; no se admite base64 ni multipart en la misión.', 400, 'RAW_ATTACHMENTS_UNSUPPORTED');
  }
  const model = asOptionalString(payload.model, 'El modelo');
  if (model && !/^[a-z0-9._-]{2,80}$/i.test(model)) {
    throw new ConsoleError('El modelo no es válido.', 400, 'INVALID_MODEL');
  }
  const effort = asOptionalString(payload.effort, 'El razonamiento');
  if (effort && !EFFORTS.has(effort)) {
    throw new ConsoleError('El nivel de razonamiento no es válido.', 400, 'INVALID_EFFORT');
  }
  const requestId = payload.requestId;
  if (requestId !== undefined && (typeof requestId !== 'string' || !/^submission:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(requestId))) {
    throw new ConsoleError('El identificador idempotente de envío no es válido.', 400, 'INVALID_REQUEST_ID');
  }
  return {
    requestId: requestId ?? ('submission:' + randomUUID()),
    text: payload.text,
    entryMode,
    preset,
    model,
    effort,
    maxParallel: numberOption(payload.maxParallel, 'El paralelismo', 1, 4),
    missionCallLimit: numberOption(payload.missionCallLimit, 'El presupuesto de llamadas', 1, 1000),
    methodRecoveryRounds: numberOption(payload.methodRecoveryRounds, 'Las rondas de recuperación', 1, 100),
    assetReferences: normalizeAssetReferences(payload.assetReferences),
    conversationLink: normalizeConversationLink(payload.conversationLink),
  };
}

export function factoryFailure(code) {
  // Factory diagnostics may include private workspace paths, sealed-input
  // metadata or provider detail. The browser receives a stable failure code;
  // it never becomes an accidental second diagnostic channel for subprocess
  // stderr. Operators can inspect the verified runtime status separately.
  return new ConsoleError('La fábrica rechazó la operación. Consulta el estado verificable de la misión para diagnosticarla.', 502, code || 'FACTORY_COMMAND_FAILED');
}

export function createFactoryRunner({
  factoryBinary = process.env.SOVEREIGN_BIN || defaultFactoryBinary,
  cwd = projectRoot,
  // This prefix is server-owned deployment configuration (for example, the
  // immutable release CLI after a trusted Node executable). It is never
  // constructed from a browser request.
  argvPrefix = [],
} = {}) {
  if (!Array.isArray(argvPrefix) || argvPrefix.some(value => typeof value !== 'string' || !value || value.includes('\0'))) {
    throw new ConsoleError('La configuración de la CLI de fábrica no es válida.', 500, 'FACTORY_COMMAND_CONFIGURATION');
  }
  return function runFactory(commandArgs, {timeoutMs = 30_000, maxOutputBytes = 6 * 1024 * 1024} = {}) {
    return new Promise((resolvePromise, rejectPromise) => {
      if (!Array.isArray(commandArgs) || !commandArgs.length) {
        rejectPromise(new ConsoleError('La operación de fábrica no está definida.', 500, 'FACTORY_OPERATION'));
        return;
      }
      if (!Number.isSafeInteger(maxOutputBytes) || maxOutputBytes < 1 || maxOutputBytes > 32 * 1024 * 1024) {
        rejectPromise(new ConsoleError('El límite de salida de fábrica no es válido.', 500, 'FACTORY_OUTPUT_LIMIT_INVALID'));
        return;
      }
      const command = commandArgs.includes('--json') ? commandArgs : [...commandArgs, '--json'];
      const args = [...argvPrefix, ...command];
      const child = spawn(factoryBinary, args, {
        cwd,
        shell: false,
        windowsHide: true,
        env: {...process.env, NO_COLOR: '1'},
      });
      let stdout = '';
      let stderr = '';
      let settled = false;
      let timeout;
      let forceKill;
      const terminate = () => {
        if (child.exitCode !== null || child.killed) return;
        child.kill('SIGTERM');
        forceKill = setTimeout(() => child.kill('SIGKILL'), 5_000);
        forceKill.unref?.();
      };
      const finish = callback => value => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        clearTimeout(forceKill);
        callback(value);
      };
      const fail = finish(rejectPromise);
      const succeed = finish(resolvePromise);
      timeout = setTimeout(() => {
        terminate();
        fail(new ConsoleError('La operación de fábrica superó el tiempo permitido.', 504, 'FACTORY_TIMEOUT'));
      }, timeoutMs);
      child.stdout.setEncoding('utf8');
      child.stderr.setEncoding('utf8');
      child.stdout.on('data', chunk => {
        stdout += chunk;
        if (Buffer.byteLength(stdout, 'utf8') > maxOutputBytes) {
          terminate();
          fail(new ConsoleError('La respuesta de fábrica excedió el límite de consola.', 502, 'FACTORY_OUTPUT_LIMIT'));
        }
      });
      child.stderr.on('data', chunk => {
        stderr += chunk;
        if (Buffer.byteLength(stderr, 'utf8') > 256 * 1024) {
          terminate();
          fail(new ConsoleError('El diagnóstico de fábrica excedió el límite de consola.', 502, 'FACTORY_ERROR_LIMIT'));
        }
      });
      child.once('error', () => fail(new ConsoleError('No se pudo iniciar la fábrica verificada.', 503, 'FACTORY_UNAVAILABLE')));
      child.once('close', code => {
        if (settled) return;
        if (code !== 0) {
          fail(factoryFailure('FACTORY_COMMAND_FAILED'));
          return;
        }
        try {
          succeed(parseFactoryJson(stdout));
        } catch (error) {
          fail(error);
        }
      });
    });
  };
}

async function readJsonBody(request) {
  const headerLength = Number(request.headers['content-length'] ?? 0);
  if (Number.isFinite(headerLength) && headerLength > MAX_BODY_BYTES) {
    throw new ConsoleError('La solicitud supera el límite permitido.', 413, 'BODY_TOO_LARGE');
  }
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) {
      throw new ConsoleError('La solicitud supera el límite permitido.', 413, 'BODY_TOO_LARGE');
    }
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw new ConsoleError('El cuerpo debe ser JSON válido.', 400, 'INVALID_JSON');
  }
}

function rawContentLength(request) {
  const value = request.headers['content-length'];
  if (value === undefined) return null;
  if (Array.isArray(value) || !/^(?:0|[1-9][0-9]*)$/.test(value)) {
    throw new ConsoleError('La longitud de carga no es válida.', 400, 'INVALID_ASSET_CONTENT_LENGTH');
  }
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) {
    throw new ConsoleError('La longitud de carga no es válida.', 400, 'INVALID_ASSET_CONTENT_LENGTH');
  }
  return parsed;
}

function rawContentType(request) {
  const value = request.headers['content-type'];
  if (value === undefined) return null;
  if (Array.isArray(value) || typeof value !== 'string') {
    throw new ConsoleError('El tipo de carga no es válido.', 400, 'INVALID_ASSET_CONTENT_TYPE');
  }
  const type = value.split(';', 1)[0].trim().toLowerCase();
  if (!type || type.includes(',')) {
    throw new ConsoleError('El tipo de carga no es válido.', 400, 'INVALID_ASSET_CONTENT_TYPE');
  }
  return type;
}

async function streamOriginalAsset(response, projectSpaces, projectId, assetId, {missionId = null} = {}) {
  const original = await projectSpaces.openAssetOriginal(projectId, assetId, {missionId});
  response.writeHead(200, {
    'content-type': original.asset.mediaType,
    'content-length': String(original.asset.size),
    'content-disposition': 'attachment; filename="' + original.asset.filename.replace(/["\\]/g, '-') + '"',
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
  });
  await pipeline(original.stream, response);
}

// Final text is material belonging to one project, just as much as an
// original attachment.  It is never reconstructed from a report or exposed
// as a loose artifact payload: the ProjectSpaceService opens the immutable,
// hash-checked public delivery record and gives us only its text stream.
async function streamTextDeliverable(response, projectSpaces, projectId, deliveryId) {
  const opened = await projectSpaces.openTextDeliverable(projectId, deliveryId);
  response.writeHead(200, {
    'content-type': opened.deliverable.content.mediaType,
    'content-length': String(opened.deliverable.content.bytes),
    'content-disposition': 'attachment; filename="' + opened.deliverable.filename.replace(/["\\]/g, '-') + '"',
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
  });
  await pipeline(opened.stream, response);
}

function roleGroups(roles) {
  const groups = {};
  for (const role of roles) {
    const group = String(role.id ?? '').split('_')[0] || 'otros';
    groups[group] = (groups[group] ?? 0) + 1;
  }
  return groups;
}

function resultOf(settled) {
  return settled.status === 'fulfilled'
    ? {ok: true, data: settled.value}
    : {ok: false, error: publicError(settled.reason)};
}

function responseSnapshot(value) {
  return {generatedAt: new Date().toISOString(), ...value};
}

function plainRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function unobservedQueueLifecycle(status = 'UNOBSERVED') {
  return {status, lastTransitionAt: null, pendingCodes: []};
}

// Queue ownership and mission lifecycle are distinct durable records.  The
// coordinator can correctly be RUNNING while the mission is PLANNING, so this
// deliberately copies only a small, validated public lifecycle projection
// instead of treating `queue-job.status` as a mission phase.
function projectQueueLifecycleProjection(value) {
  const mission = plainRecord(value?.mission) ? value.mission : null;
  if (!mission || typeof mission.status !== 'string' || !PUBLIC_MISSION_STATUS_SET.has(mission.status)) {
    return unobservedQueueLifecycle('UNVERIFIED');
  }
  let lastTransitionAt = null;
  if (Array.isArray(mission.history)) {
    for (let index = mission.history.length - 1; index >= 0; index -= 1) {
      const entry = mission.history[index];
      if (plainRecord(entry) && typeof entry.at === 'string' && !Number.isNaN(Date.parse(entry.at))) {
        lastTransitionAt = entry.at;
        break;
      }
    }
  }
  const pendingCodes = [];
  if (Array.isArray(mission.pending)) {
    for (const item of mission.pending) {
      const code = plainRecord(item) ? item.code : null;
      if (typeof code === 'string' && /^[A-Z_][A-Z0-9_]{0,159}$/.test(code) && !pendingCodes.includes(code)) {
        pendingCodes.push(code);
        if (pendingCodes.length === 100) break;
      }
    }
  }
  return {status: mission.status, lastTransitionAt, pendingCodes};
}

async function projectQueueLifecycleProjections(queue, run) {
  if (!Array.isArray(queue) || !queue.length) return [];
  const projections = queue.map(() => unobservedQueueLifecycle());
  let next = 0;
  const readOne = async () => {
    for (;;) {
      const index = next;
      next += 1;
      if (index >= queue.length) return;
      const job = queue[index];
      const missionId = plainRecord(job) && typeof job.missionId === 'string'
        && /^mission:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(job.missionId)
        ? job.missionId
        : null;
      if (!missionId) continue;
      try {
        projections[index] = projectQueueLifecycleProjection(await run(['status', missionId], {timeoutMs: 30_000}));
      } catch {
        // A transient read cannot rewrite the coordinator's truthful queue
        // record.  The UI can distinguish no observation from a lifecycle
        // phase and may retry through its existing refresh path.
        projections[index] = unobservedQueueLifecycle();
      }
    }
  };
  await Promise.all(Array.from({length: Math.min(PROJECT_QUEUE_LIFECYCLE_READ_CONCURRENCY, queue.length)}, readOne));
  return projections;
}

// Version-one project admissions appended a private context package to the
// Factory mandate. Historic records stay immutable, but a read API must not
// reproduce that package through status, report or export. This operates on a
// response copy only; it never rewrites the Factory record or project ledger.
function redactLegacyProjectContextPacks(value) {
  let redacted = false;
  const seen = new WeakMap();
  const visit = item => {
    if (typeof item === 'string') {
      const markerAt = item.indexOf(LEGACY_PROJECT_CONTEXT_PACK_MARKER);
      if (markerAt === -1) return item;
      redacted = true;
      const beforeMarker = item.slice(0, markerAt);
      return beforeMarker.endsWith('\r\n')
        ? beforeMarker.slice(0, -2)
        : beforeMarker.endsWith('\n')
          ? beforeMarker.slice(0, -1)
          : beforeMarker;
    }
    if (!item || typeof item !== 'object') return item;
    if (seen.has(item)) return seen.get(item);
    const copy = Array.isArray(item) ? [] : {};
    seen.set(item, copy);
    for (const [key, child] of Object.entries(item)) copy[key] = visit(child);
    return copy;
  };
  return {value: visit(value), redacted};
}

function projectLegacySafeSnapshot(value) {
  const safe = redactLegacyProjectContextPacks(responseSnapshot(value));
  return safe.redacted ? {...safe.value, legacyContextRedacted: true} : safe.value;
}

export function createDashboardServer(options = {}) {
  const factoryRunner = options.factoryRunner ?? createFactoryRunner(options);
  const configuredFactoryBinary = options.factoryBinary ?? process.env.SOVEREIGN_BIN ?? defaultFactoryBinary;
  const assetsRoot = resolve(options.staticDirectory ?? staticDirectory);
  const consoleStateRoot = resolve(options.consoleStateDir ?? process.env.SOVEREIGN_CONSOLE_STATE_DIR ?? defaultConsoleState);
  const requestsRoot = resolve(consoleStateRoot, 'requests');
  const projectSpaces = options.projectSpaces ?? new ProjectSpaceService({
    rootDir: join(consoleStateRoot, 'portfolio'),
    documentExtractionRunner: configuredDocumentExtractionRunner(options),
  });
  const spacesReady = projectSpaces.init();
  // New project workers can be bound to one of the console's explicitly
  // configured, content-addressed releases. Existing projects remain
  // untouched until an operator deliberately migrates them; no read route
  // ever creates a binding.
  const configuredDefaultProjectRelease = options.defaultProjectReleaseId
    ?? process.env.SUBLIMINE_NEW_PROJECT_RELEASE_ID
    ?? null;
  const configuredProjectReleaseAllowlist = options.projectReleaseAllowlist
    ?? (process.env.SUBLIMINE_PROJECT_RELEASE_ALLOWLIST
      ? process.env.SUBLIMINE_PROJECT_RELEASE_ALLOWLIST.split(',').map(value => value.trim()).filter(Boolean)
      : null);
  const projectReleaseRegistry = options.projectReleaseRegistry
    ?? (configuredDefaultProjectRelease
      ? new RuntimeReleaseRegistry({
        releaseRoot: options.projectReleaseRoot ?? process.env.SUBLIMINE_FACTORY_RELEASES_ROOT ?? defaultRuntimeReleasesRoot,
        nodeExecutable: options.projectReleaseNodeExecutable ?? process.execPath,
        defaultReleaseId: configuredDefaultProjectRelease,
        ...(configuredProjectReleaseAllowlist ? {allowedReleaseIds: configuredProjectReleaseAllowlist} : {}),
      })
      : null);

  function runtimeReleaseFailure(error) {
    const code = error instanceof RuntimeReleaseRegistryError
      ? error.code
      : (typeof error?.code === 'string' && /^RELEASE_[A-Z_]+$/.test(error.code)
        ? 'RUNTIME_RELEASE_INTEGRITY'
        : 'RUNTIME_RELEASE_UNAVAILABLE');
    return new ConsoleError('La release verificable de este proyecto no está disponible. La fábrica no usará una versión distinta como sustitución.', 503, code);
  }

  function releaseCommandFor(projectReleaseId) {
    if (!projectReleaseRegistry) {
      throw new ConsoleError('Este proyecto está anclado a una release verificable que esta consola no tiene autorizada.', 503, 'RUNTIME_RELEASE_UNAVAILABLE');
    }
    try {
      return projectReleaseRegistry.commandFor({releaseId: projectReleaseId});
    } catch (error) {
      throw runtimeReleaseFailure(error);
    }
  }

  // Resolve the release immediately before *each* CLI call. The registry
  // re-checks the content-addressed manifest every time; a corrupted release
  // fails closed instead of falling back to the mutable global wrapper.
  function releaseFactoryRunner(projectReleaseId) {
    return (commandArgs, commandOptions = {}) => {
      const command = releaseCommandFor(projectReleaseId);
      return createFactoryRunner({
        factoryBinary: command.executable,
        cwd: command.cwd,
        argvPrefix: command.argvPrefix,
      })(commandArgs, commandOptions);
    };
  }

  const releaseSupervisorResolver = projectReleaseRegistry
    ? async releaseId => releaseCommandFor(releaseId)
    : null;
  const projectRuntimeSupervisor = options.projectRuntimeSupervisor
    ?? (options.factoryRunner
      ? new NullProjectRuntimeSupervisor()
      : new ProjectRuntimeSupervisor({
        factoryBinary: configuredFactoryBinary,
        workingDirectory: options.cwd ?? projectRoot,
        ...(releaseSupervisorResolver ? {
          releaseCommandResolver: releaseSupervisorResolver,
          allowedReleaseRoots: [projectReleaseRegistry.releaseRoot],
          allowedNodeBinaries: [projectReleaseRegistry.nodeExecutable],
        } : {}),
      }));
  const uiToken = options.uiToken ?? randomBytes(32).toString('base64url');
  // Test-only callers may shorten the initial wake-up; production keeps the
  // conservative default. This option is not an HTTP input and stays bounded
  // by the same scheduler ceiling.
  const deliveryReconciliationInitialDelayMs = Number.isSafeInteger(options.deliveryReconciliationInitialDelayMs)
    && options.deliveryReconciliationInitialDelayMs >= 0
    && options.deliveryReconciliationInitialDelayMs <= PROJECT_DELIVERY_RECONCILIATION_MAX_DELAY_MS
    ? options.deliveryReconciliationInitialDelayMs
    : PROJECT_DELIVERY_RECONCILIATION_INITIAL_DELAY_MS;
  const streamClients = new Set();
  const caches = new Map();
  // The vault and conversation ledgers are independently idempotent, but an
  // in-process coalescer avoids launching duplicate read-only delivery
  // commands when two local tabs reconcile the same project at once.
  const deliveryReconciliations = new Map();
  const scheduledDeliveryReconciliations = new Map();
  const deliveryReconciliationTasks = new Set();
  const deliveryReconciliationBackoff = new Map();
  let activeDeliveryReconciliations = 0;
  let deliveryReconciliationStopped = false;
  const auditPath = join(consoleStateRoot, 'console-audit.ndjson');
  let liveOverview = null;
  let shuttingDown = false;
  let shutdownPromise = null;

  async function audit(kind, fields = {}) {
    try {
      await mkdir(dirname(auditPath), {recursive: true, mode: 0o700});
      await appendFile(auditPath, JSON.stringify({
        at: new Date().toISOString(),
        kind,
        ...fields,
      }) + '\n', {encoding: 'utf8', mode: 0o600});
    } catch {
      // Observability must never turn a factory command into a different action.
    }
  }

  async function memo(key, ttl, load) {
    const cached = caches.get(key);
    if (cached && Date.now() - cached.at < ttl) return cached.value;
    const value = await load();
    caches.set(key, {at: Date.now(), value});
    return value;
  }

  async function catalog() {
    return memo('catalog', 60_000, () => factoryRunner(['roles']));
  }

  async function doctor() {
    return memo('doctor', 30_000, () => factoryRunner(['doctor'], {timeoutMs: 45_000}));
  }

  async function doctorForRunner(run) {
    // The global dashboard may cache its global-wrapper doctor. A project
    // pinned to a release must ask that release directly, because admission
    // policy is part of the immutable mission contract.
    return run === factoryRunner
      ? doctor()
      : run(['doctor'], {timeoutMs: 45_000});
  }

  async function resolveExecutionTarget(model, effort, {useFactoryDefault = false, runner = factoryRunner} = {}) {
    const requestedModel = model ?? null;
    const requestedEffort = effort ?? null;
    if (!requestedModel && !requestedEffort && !useFactoryDefault) return null;
    if (!requestedModel && requestedEffort) {
      throw new ConsoleError('Un nivel de razonamiento fijado necesita un modelo fijado.', 400, 'INVALID_MODEL_POLICY');
    }
    const effectiveModel = requestedModel ?? FACTORY_DEFAULT_EXECUTION_TARGET.model;
    const effectiveEffort = requestedEffort ?? (requestedModel ? null : FACTORY_DEFAULT_EXECUTION_TARGET.reasoningEffort);
    let modelCatalog;
    try {
      const provider = await doctorForRunner(runner);
      modelCatalog = Array.isArray(provider.models) ? provider.models : [];
    } catch {
      throw new ConsoleError('No se puede verificar el modelo solicitado porque el proveedor no respondió.', 503, 'PROVIDER_TARGET_UNVERIFIED');
    }
    const selectedModel = modelCatalog.find(item => item.id === effectiveModel || item.model === effectiveModel);
    if (!selectedModel) {
      throw new ConsoleError('El modelo solicitado no está disponible en el proveedor actual.', 400, 'UNKNOWN_MODEL');
    }
    const resolvedEffort = effectiveEffort ?? selectedModel.defaultReasoningEffort ?? null;
    if (!resolvedEffort) {
      throw new ConsoleError('El proveedor no declaró un razonamiento por defecto para ese modelo; elige uno explícitamente.', 409, 'MODEL_DEFAULT_EFFORT_UNVERIFIED');
    }
    if (!(Array.isArray(selectedModel.supportedReasoningEfforts) ? selectedModel.supportedReasoningEfforts : []).includes(resolvedEffort)) {
      throw new ConsoleError('Ese modelo no admite el nivel de razonamiento seleccionado.', 400, 'UNSUPPORTED_MODEL_EFFORT');
    }
    return {
      model: selectedModel.id ?? selectedModel.model,
      effort: resolvedEffort,
      targetOrigin: !requestedModel
        ? 'factory-default-v1'
        : (!requestedEffort ? 'provider-default-effort-v1' : 'explicit-target-v1'),
    };
  }

  async function verifyModelSelection(model, effort, {runner = factoryRunner} = {}) {
    await resolveExecutionTarget(model, effort, {runner});
  }

  /*
   * Project creation keeps an inherited policy as inherited. Exact targets are
   * resolved only under the project's admission lock, immediately before the
   * immutable mandate/context snapshot is written.
   */
  async function resolveProjectMissionTarget(policy, runner) {
    return resolveExecutionTarget(policy?.model ?? null, policy?.effort ?? null, {useFactoryDefault: true, runner});
  }

  async function ensureProjectRuntimeRelease(projectId) {
    await spacesReady;
    assertProjectId(projectId);
    let config = await projectSpaces.runtimeConfig(projectId);
    if (config.runtimeReleaseId) {
      // Validate the existing private binding before we return a runner. A
      // missing/corrupt release is a hard stop, never a silent legacy route.
      releaseCommandFor(config.runtimeReleaseId);
      return config;
    }
    if (!projectReleaseRegistry) return config;

    // Bind only a truly new project at an admission/start boundary. Reading
    // an overview never changes it, and any existing mission, state database
    // or active worker retains its historic runtime behavior.
    const [mappings, supervisor] = await Promise.all([
      projectSpaces.listMissions(projectId),
      projectRuntimeSupervisor.status({projectId}),
    ]);
    if (mappings.length || existsSync(join(config.stateDir, 'state.sqlite')) || supervisor.active) return config;
    if (supervisor.state === 'SUPERVISOR_UNAVAILABLE') {
      throw new ConsoleError('No se puede comprobar el supervisor del proyecto antes de fijar su release.', 503, 'PROJECT_RUNTIME_SUPERVISOR_UNAVAILABLE');
    }
    let command;
    try {
      command = projectReleaseRegistry.commandFor();
    } catch (error) {
      throw runtimeReleaseFailure(error);
    }
    await projectSpaces.bindRuntimeRelease(projectId, command.releaseId);
    config = await projectSpaces.runtimeConfig(projectId);
    // Detect a concurrent or tampered binding rather than accepting a
    // different release after the first verified selection.
    if (config.runtimeReleaseId !== command.releaseId) {
      throw new ConsoleError('La release anclada del proyecto no coincide con la selección verificada.', 409, 'RUNTIME_RELEASE_BINDING_MISMATCH');
    }
    return config;
  }

  async function projectRuntime(projectId) {
    await spacesReady;
    assertProjectId(projectId);
    const config = await projectSpaces.runtimeConfig(projectId);
    const baseRunner = config.runtimeReleaseId
      ? releaseFactoryRunner(config.runtimeReleaseId)
      : factoryRunner;
    const run = (args, options = {}) => baseRunner([...args, '--state-dir', config.stateDir], options);
    return {config, run};
  }

  async function projectQueue(projectId) {
    const {config, run} = await projectRuntime(projectId);
    const supervisor = await projectRuntimeSupervisor.status({projectId});
    if (!existsSync(join(config.stateDir, 'state.sqlite'))) {
      return {
        state: 'PROVISIONED',
        queue: [],
        supervisor,
        note: 'La raíz aislada está lista. La cola y su supervisor se inicializan con la primera misión del proyecto.',
      };
    }
    const queue = await run(['queue']);
    const lifecycle = await projectQueueLifecycleProjections(queue, run);
    return {
      state: supervisor.active ? 'ACTIVE' : (supervisor.state === 'START_REQUESTED' ? 'START_REQUESTED' : 'INITIALIZED'),
      queue: Array.isArray(queue)
        ? queue.map((job, index) => plainRecord(job)
          ? {...job, lifecycle: lifecycle[index] ?? unobservedQueueLifecycle()}
          : job)
        : queue,
      supervisor,
      note: supervisor.active
        ? 'El supervisor de proyecto atiende exclusivamente esta cola.'
        : 'La cola existe pero el supervisor no confirma actividad todavía.',
    };
  }

  async function startProjectRuntime(projectId) {
    await ensureProjectRuntimeRelease(projectId);
    const {config} = await projectRuntime(projectId);
    const supervisor = await projectRuntimeSupervisor.start({
      projectId,
      stateDir: config.stateDir,
      ...(config.runtimeReleaseId ? {releaseId: config.runtimeReleaseId} : {}),
    });
    await audit('project.runtime.start_requested', {projectId, unit: supervisor.unit ?? null, state: supervisor.state, started: supervisor.started});
    return responseSnapshot({projectId, supervisor});
  }

  async function projectOverview(projectId) {
    await spacesReady;
    const [capsule, runtime] = await Promise.all([
      projectSpaces.contextCapsule(projectId),
      projectQueue(projectId),
    ]);
    return responseSnapshot({
      ...capsule,
      runtime,
      deliveryReconciliation: projectDeliveryReconciliationProjection(projectId),
      separation: {
        projectState: 'separate --state-dir root',
        queue: 'project-scoped',
        workspaces: 'project-scoped',
        memory: 'project-scoped',
        vault: 'project-scoped',
        graph: 'project-scoped',
        globalIndex: 'metadata-only',
      },
    });
  }

  function projectDeliveryReconciliationProjection(projectId) {
    const entry = scheduledDeliveryReconciliations.get(projectId) ?? null;
    return {
      schema: 'sublimine.delivery-reconciliation-projection.v1',
      mode: 'SERVER_V2_OPT_IN',
      scope: 'NEW_LINKED_CONVERSATIONS_ONLY',
      state: entry?.active ? 'CHECKING' : entry ? 'SCHEDULED' : 'IDLE',
      ...(entry?.dueAt ? {nextCheckAt: entry.dueAt} : {}),
      concurrencyLimit: PROJECT_DELIVERY_RECONCILIATION_CONCURRENCY,
      historicalLinks: 'EXPLICIT_PER_MISSION_ONLY',
    };
  }

  async function overview({fresh = false} = {}) {
    const existing = caches.get('overview');
    if (!fresh && existing && Date.now() - existing.at < 2_000) return existing.value;
    if (liveOverview) return liveOverview;
    liveOverview = (async () => {
      try {
        const [service, queue, learning, provider, roles] = await Promise.allSettled([
          factoryRunner(['service-status']),
          factoryRunner(['queue']),
          factoryRunner(['learn-status']),
          doctor(),
          catalog(),
        ]);
        const roleList = roles.status === 'fulfilled' && Array.isArray(roles.value) ? roles.value : [];
        const value = responseSnapshot({
          service: resultOf(service),
          queue: resultOf(queue),
          learning: resultOf(learning),
          provider: resultOf(provider),
          executionTargets: executionTargetInventory(),
          catalog: {
            ok: roles.status === 'fulfilled',
            count: roleList.length,
            groups: roleGroups(roleList),
            error: roles.status === 'rejected' ? publicError(roles.reason) : null,
          },
          transport: {
            mode: 'local-only',
            address: '127.0.0.1',
            note: 'La consola consulta la CLI verificada; no abre SQLite ni expone un puerto público. El loopback es una frontera de usuario local, no autenticación multiusuario.',
          },
        });
        caches.set('overview', {at: Date.now(), value});
        return value;
      } finally {
        liveOverview = null;
      }
    })();
    return liveOverview;
  }

  async function missionDetail(missionId) {
    const id = assertMissionId(missionId);
    const [status, report] = await Promise.allSettled([
      factoryRunner(['status', id]),
      factoryRunner(['report', id], {timeoutMs: 45_000}),
    ]);
    return projectLegacySafeSnapshot({missionId: id, status: resultOf(status), report: resultOf(report)});
  }

  async function roleDetail(roleId) {
    return responseSnapshot({role: await factoryRunner(['roles', assertRoleId(roleId)])});
  }

  async function submitMission(payload, {projectId = null} = {}) {
    let submission = validateSubmission(payload);
    const originalIntent = submission.text;
    let run = factoryRunner;
    let projectSupervisor = null;
    let contextPack = null;
    let projectAdmission = null;
    let projectRoute = null;
    let conversationRequest = null;
    let conversationLink = null;
    if (projectId) {
      await spacesReady;
      // First admission is the only point at which a fresh project may be
      // assigned the console's verified release. The runner below is then
      // used both for target resolution and for the immutable Factory submit.
      await ensureProjectRuntimeRelease(projectId);
      ({run} = await projectRuntime(projectId));
      projectRoute = selectProjectExecutionRoute(submission);
      submission = projectRoute.submission;
      projectAdmission = await projectSpaces.prepareMissionAdmission(projectId, {
        requestId: submission.requestId,
        originalIntent,
        entryMode: submission.entryMode,
        preset: submission.preset,
        model: submission.model,
        effort: submission.effort,
        factoryOptions: {
          maxParallel: submission.maxParallel,
          missionCallLimit: submission.missionCallLimit,
          methodRecoveryRounds: submission.methodRecoveryRounds,
          ...(projectRoute.sourcedFallback ? {sourcedFallback: projectRoute.sourcedFallback} : {}),
          ...(projectRoute.sourcedEvidenceProfile ? {sourcedEvidenceProfile: projectRoute.sourcedEvidenceProfile} : {}),
        },
        ...(projectRoute.routeBinding ? {routeBinding: projectRoute.routeBinding} : {}),
        // Preserve the prior no-attachment fingerprint so a historic retry
        // does not become a second project admission. Asset-bearing missions
        // instead seal their object identity inside ProjectSpaceService.
        ...(projectRoute.routeBinding ? {}
          : submission.assetReferences.length
          ? {assetReferences: submission.assetReferences}
          : {attachmentManifestHash: EMPTY_ATTACHMENT_MANIFEST_HASH}),
      }, {resolveModelTarget: policy => resolveProjectMissionTarget(policy, run)});
      contextPack = projectAdmission.contextPack ?? null;
      // A historic admission may have been sealed by the old renderer that
      // appended private project memory to the user mandate. It remains
      // immutable evidence, but it must never be retried as a new Factory
      // submission under a different payload. Linked admissions simply return
      // their existing mission below.
      if (projectAdmission.state !== 'LINKED' && projectAdmission.renderedIntent !== projectAdmission.originalIntent) {
        throw new ConsoleError('Esta admisión histórica contiene un mandato contaminado por contexto interno. Se conserva para auditoría, pero debe reenviarse con un nuevo identificador.', 409, 'LEGACY_CONTEXT_ADMISSION');
      }
      // A clean v1 admission has no sealed private transport at all. Replaying
      // it would create a new Factory mission that silently loses the project
      // context, so only an already accepted/linked historic mission may be
      // reconciled. A fresh request ID creates the v2 transport instead.
      if (!projectRoute.routeBinding && !projectAdmission.contextTransport
        && !['LINKED', 'FACTORY_ACCEPTED'].includes(projectAdmission.state)) {
        throw new ConsoleError('Esta admisión histórica no tiene transporte privado de contexto. Se conserva para auditoría; reenvíala con un nuevo identificador.', 409, 'LEGACY_CONTEXT_TRANSPORT_UNAVAILABLE');
      }
      submission = {
        ...submission,
        // The Factory's immutable mandate is exactly what the operator wrote.
        // Project context has a separate, sealed transport; it is never
        // concatenated into this visible/executable field.
        text: projectAdmission.factoryIntent ?? projectAdmission.originalIntent,
        model: projectAdmission.policySnapshot.model,
        effort: projectAdmission.policySnapshot.effort,
      };
      if (submission.effort && !submission.model) {
        throw new ConsoleError('La política del proyecto no puede fijar razonamiento sin fijar modelo.', 409, 'PROJECT_MODEL_POLICY_INVALID');
      }
      if (submission.conversationLink) {
        // The browser can identify a user turn, but it cannot assert that a
        // mission belongs to it.  This server-side receipt verifies the
        // exact sealed user message before the Factory sees the mandate.
        conversationRequest = await projectSpaces.prepareConversationMissionRequest(projectId, {
          ...submission.conversationLink,
          requestId: submission.requestId,
          intent: originalIntent,
          assetManifestHash: projectRoute?.routeBinding ? null : (projectAdmission.attachmentManifestHash ?? null),
        });
      }
    } else if (submission.assetReferences.length) {
      throw new ConsoleError('Las referencias de archivos sólo pueden pertenecer a una misión dentro de un proyecto.', 409, 'ASSET_PROJECT_REQUIRED');
    } else if (submission.conversationLink) {
      throw new ConsoleError('Una conversación sólo puede vincularse dentro de un espacio de proyecto.', 409, 'CONVERSATION_PROJECT_REQUIRED');
    }
    await verifyModelSelection(submission.model, submission.effort, {runner: run});
    const requestId = submission.requestId;
    let requestDirectory = null;
    let assetDerivations = null;
    let assetInputMode = null;
    try {
      let job;
      if (projectAdmission?.state === 'LINKED') {
        job = {missionId: projectAdmission.missionId, state: 'LINKED', idempotent: true};
      } else if (projectAdmission?.state === 'FACTORY_ACCEPTED') {
        projectAdmission = await projectSpaces.finalizeMissionAdmission(projectId, requestId);
        job = {missionId: projectAdmission.missionId, state: 'FACTORY_ACCEPTED', idempotent: true};
      } else {
        requestDirectory = join(requestsRoot, randomUUID());
        await mkdir(join(requestDirectory, 'input'), {recursive: true, mode: 0o700});
        const mandatePath = join(requestDirectory, 'mandate.txt');
        const manifestPath = join(requestDirectory, 'inputs.json');
        const contextDescriptorPath = join(requestDirectory, 'project-context-descriptor.json');
        await writeFile(mandatePath, submission.text, {encoding: 'utf8', mode: 0o600});
        const inputManifest = [];
        let projectContextDescriptor = null;
        if (projectAdmission?.contextTransport) {
          const transport = projectAdmission.contextTransport;
          const source = join(requestDirectory, ...transport.inputPath.split('/'));
          await mkdir(dirname(source), {recursive: true, mode: 0o700});
          await writeFile(source, transport.content, {encoding: 'utf8', mode: 0o600});
          inputManifest.push({source, path: transport.inputPath});
          projectContextDescriptor = {
            path: transport.inputPath,
            sha256: transport.inputSha256,
            classification: PROJECT_CONTEXT_CLASSIFICATION,
            requiredRead: true,
          };
          await writeFile(contextDescriptorPath, JSON.stringify(projectContextDescriptor), {encoding: 'utf8', mode: 0o600});
        }
        if (projectAdmission?.assetReferences?.length) {
          const references = projectAdmission.assetReferences;
          const documentReferences = references.filter(isDocumentAssetReference);
          if (documentReferences.length && documentReferences.length !== references.length) {
            // The individual V1 and V2 channels are each admission-bound and
            // atomic. Do not pretend a cross-profile collection is atomic
            // until it has its own whole-set receipt: a mixed request fails
            // before either parser publishes or Factory sees a derivative.
            throw new ConsoleError('Una misma misión todavía no puede mezclar documentos PDF/DOCX con adjuntos de texto. Divide la solicitud en misiones separadas hasta que exista un contrato atómico entre perfiles.', 409, 'MIXED_ASSET_EXTRACTION_UNSUPPORTED');
          }
          if (documentReferences.length) {
            const documentSet = await projectSpaces.prepareDocumentAssetDerivationSet(projectId, {
              admission: projectAdmission,
              admissionId: projectAdmission.admissionId,
              requestId,
              references,
            });
            assetDerivations = documentSet.derivations;
            assetInputMode = 'sealed-document-text-v2';
          } else {
            // V1 is deliberately narrow but real: the vault resolves only
            // exact, bounded UTF-8 text into a receipt-bound derivative. The
            // Factory gets that derivative as a normal immutable *untrusted*
            // input snapshot, never an original vault object, filename,
            // media type, asset ID, receipt or host handle.
            assetDerivations = await projectSpaces.prepareTextAssetDerivations(projectId, {
              admissionId: projectAdmission.admissionId,
              requestId,
              references,
            });
            assetInputMode = 'sealed-utf8-text-v1';
          }
          assertDistinctBoundedAssetDerivations(assetDerivations);
          for (const derivation of assetDerivations) {
            inputManifest.push(await materializeVerifiedAssetInput(requestDirectory, derivation));
          }
        }
        const args = [
          'submit',
          '--file', mandatePath,
          '--request-id', requestId,
          '--entry-mode', submission.entryMode,
          '--preset', submission.preset,
        ];
        if (projectRoute?.sourcedFallback) args.push('--sourced-fallback', projectRoute.sourcedFallback);
        if (projectRoute?.sourcedEvidenceProfile) args.push('--sourced-evidence-profile', projectRoute.sourcedEvidenceProfile);
        if (submission.entryMode === 'bounded-read-response-v1') args.push('--bounded-read-presentation', 'separate-evidence-v1');
        if (submission.model) args.push('--model', submission.model);
        if (submission.effort) args.push('--effort', submission.effort);
        if (submission.maxParallel) args.push('--parallel-pure-nodes', String(submission.maxParallel));
        if (submission.missionCallLimit) args.push('--mission-call-limit', String(submission.missionCallLimit));
        if (submission.methodRecoveryRounds) args.push('--method-recovery-rounds', String(submission.methodRecoveryRounds));
        if (inputManifest.length) {
          await writeFile(manifestPath, JSON.stringify(inputManifest), {encoding: 'utf8', mode: 0o600});
          args.push('--inputs', manifestPath);
        }
        if (projectContextDescriptor) args.push('--project-context', contextDescriptorPath);
        job = await run(args, {timeoutMs: 45_000});
        if (projectId) {
          const missionId = job?.missionId ?? job?.id ?? job?.mission?.id;
          if (typeof missionId !== 'string' || !/^mission:[0-9a-f-]{36}$/i.test(missionId)) {
            throw new ConsoleError('La fábrica aceptó una respuesta sin identidad de misión verificable; la admisión queda preparada para reconciliación idempotente.', 502, 'PROJECT_MISSION_ID_UNCERTAIN');
          }
          projectAdmission = await projectSpaces.acceptMissionAdmission(projectId, requestId, missionId);
          projectAdmission = await projectSpaces.finalizeMissionAdmission(projectId, requestId);
        }
      }
      if (projectId) {
        try {
          projectSupervisor = (await startProjectRuntime(projectId)).supervisor;
        } catch (error) {
          projectSupervisor = {available: false, active: false, state: 'START_FAILED', started: false, error: error?.code ?? 'UNKNOWN'};
          await audit('project.runtime.start_failed', {projectId, requestId, code: error?.code ?? 'UNKNOWN'});
        }
      }
      if (projectId && conversationRequest && projectAdmission?.state === 'LINKED') {
        const linkedMissionId = job?.missionId ?? job?.id ?? job?.mission?.id ?? projectAdmission.missionId;
        try {
          conversationLink = await projectSpaces.linkConversationMission(projectId, {
            request: conversationRequest,
            missionId: linkedMissionId,
            admissionId: projectAdmission.admissionId,
            mapping: projectAdmission.mapping,
            intentHash: projectAdmission.originalIntentHash,
            assetManifestHash: projectRoute?.routeBinding ? null : (projectAdmission.attachmentManifestHash ?? null),
          });
          await audit('project.conversation.mission_linked', {
            projectId,
            missionId: linkedMissionId,
            requestId,
            conversationId: conversationLink.conversationId,
            idempotent: conversationLink.idempotent,
          });
        } catch (error) {
          // Factory acceptance and its immutable project mapping remain real
          // even if the optional chat projection needs reconciliation.  The
          // next replay of this exact request retries only the receipt link;
          // it never creates a duplicate mission or invents a chat response.
          conversationLink = {
            state: 'PENDING_RECONCILIATION',
            requestKey: conversationRequest.requestKey,
            requestId,
            conversationId: conversationRequest.conversationId,
            sourceMessageId: conversationRequest.sourceMessageId,
            code: error?.code ?? 'CONVERSATION_LINK_UNAVAILABLE',
          };
          await audit('project.conversation.mission_link_pending', {
            projectId,
            missionId: linkedMissionId,
            requestId,
            code: conversationLink.code,
          });
        }
      }
      caches.delete('overview');
      await audit('mission.submitted', {requestId, projectId, missionId: job?.missionId ?? null, admissionId: projectAdmission?.admissionId ?? null, assetCount: projectAdmission?.assetReferences?.length ?? 0, ...(assetDerivations ? {assetInputMode, assetInputCount: assetDerivations.length} : {}), entryMode: submission.entryMode, preset: submission.preset, model: submission.model, effort: submission.effort, ...(projectRoute?.routing ? {routing: projectRoute.routing.mode} : {})});
      if (projectId && conversationLink?.state === 'LINKED') scheduleProjectDeliveryReconciliation(projectId);
      const publicSourcedAdmission = projectAdmission?.routeBinding?.kind === PROJECT_PUBLIC_SOURCED_ROUTE_KIND;
      return responseSnapshot({
        requestId,
        projectId,
        job,
        supervisor: projectSupervisor,
        policy: projectAdmission?.policySnapshot ?? {model: submission.model, effort: submission.effort, admission: 'mission-snapshot-v1'},
        ...(projectRoute?.routing ? {routing: projectRoute.routing} : {}),
        context: publicSourcedAdmission
          ? {...PROJECT_PUBLIC_SOURCED_CONTEXT_SCOPE}
          : (contextPack ? {hash: contextPack.hash, selected: contextPack.selection.selected.length, dropped: contextPack.selection.dropped.length, maxBytes: contextPack.selection.maxBytes, integrity: contextPack.integrity} : null),
        admission: projectAdmission ? {
          id: projectAdmission.admissionId,
          state: projectAdmission.state,
          renderedIntentHash: projectAdmission.renderedIntentHash,
          ...(publicSourcedAdmission
            ? {routeBinding: projectAdmission.routeBinding, contextScope: projectAdmission.contextScope}
            : {
              contextPackHash: projectAdmission.contextPackHash,
              assetManifestHash: projectAdmission.attachmentManifestHash,
              assetCount: projectAdmission.assetReferences?.length ?? 0,
              ...(assetDerivations ? {assetInput: {mode: assetInputMode, count: assetDerivations.length}} : {}),
            }),
        } : null,
        ...(conversationRequest ? {
          conversationLink: conversationLink ?? {
            state: 'PENDING_RECONCILIATION',
            requestKey: conversationRequest.requestKey,
            requestId,
            conversationId: conversationRequest.conversationId,
            sourceMessageId: conversationRequest.sourceMessageId,
            code: 'CONVERSATION_LINK_NOT_FINALIZED',
          },
        } : {}),
      });
    } finally {
      if (requestDirectory) {
        try {
          await rm(requestDirectory, {recursive: true, force: true});
        } catch {
          await audit('console.cleanup_failed', {requestId});
        }
      }
    }
  }

  async function missionAction(missionId, payload) {
    const id = assertMissionId(missionId);
    const action = payload?.action;
    if (!ACTIONS.has(action)) {
      throw new ConsoleError('La acción solicitada no está permitida.', 400, 'INVALID_ACTION');
    }
    const args = [action, id];
    if (action === 'retry-review') {
      const node = asOptionalString(payload?.node, 'El nodo', 120);
      const reason = asOptionalString(payload?.reason, 'La justificación', 4_000);
      if (!node || !reason) {
        throw new ConsoleError('Un reintento de revisión necesita nodo y justificación.', 400, 'MISSING_REVIEW_RETRY_DATA');
      }
      if (reason.length < 20) {
        throw new ConsoleError('Un reintento de revisión necesita una justificación de al menos 20 caracteres.', 400, 'MISSING_REVIEW_RETRY_DATA');
      }
      args.push('--node', node, '--reason', reason);
    }
    const result = await factoryRunner(args, {timeoutMs: 30_000});
    caches.delete('overview');
    await audit('mission.action_requested', {missionId: id, action, ...(action === 'retry-review' ? {node: payload.node} : {})});
    return responseSnapshot({missionId: id, action, result});
  }

  async function projectMissionDetail(projectId, missionId) {
    await spacesReady;
    const id = assertMissionId(missionId);
    const mappings = await projectSpaces.listMissions(projectId);
    if (!mappings.some(mapping => mapping.missionId === id)) {
      throw new ConsoleError('La misión no pertenece al espacio activo.', 404, 'PROJECT_MISSION_NOT_FOUND');
    }
    const {run} = await projectRuntime(projectId);
    const [status, report] = await Promise.allSettled([
      run(['status', id]),
      run(['report', id], {timeoutMs: 45_000}),
    ]);
    return projectLegacySafeSnapshot({projectId, missionId: id, status: resultOf(status), report: resultOf(report)});
  }

  async function projectMissionStatus(projectId, missionId) {
    await spacesReady;
    const id = assertMissionId(missionId);
    const mappings = await projectSpaces.listMissions(projectId);
    if (!mappings.some(mapping => mapping.missionId === id)) {
      throw new ConsoleError('La misión no pertenece al espacio activo.', 404, 'PROJECT_MISSION_NOT_FOUND');
    }
    const {run} = await projectRuntime(projectId);
    const status = await run(['status', id], {timeoutMs: 30_000});
    return projectLegacySafeSnapshot({projectId, missionId: id, status: {ok: true, data: status}});
  }

  async function projectMissionDelivery(projectId, missionId) {
    await spacesReady;
    const id = assertMissionId(missionId);
    const mappings = await projectSpaces.listMissions(projectId);
    if (!mappings.some(mapping => mapping.missionId === id)) {
      throw new ConsoleError('La misión no pertenece al espacio activo.', 404, 'PROJECT_MISSION_NOT_FOUND');
    }

    // The Factory command is a purpose-built, read-only public delivery
    // boundary.  It independently validates the accepted artifact; this
    // console does not infer a final answer from status, report or node text.
    const {run} = await projectRuntime(projectId);
    // A 4 MiB textual product can expand while encoded as JSON (newlines and
    // quotes are escaped). This larger, command-local ceiling is still
    // bounded and applies only to the narrow delivery contract.
    const factoryDelivery = await run(['delivery', id, '--json'], {timeoutMs: 45_000, maxOutputBytes: 32 * 1024 * 1024});
    if (!factoryDelivery || typeof factoryDelivery !== 'object' || factoryDelivery.missionId !== id) {
      throw new ConsoleError('La fábrica devolvió una entrega que no corresponde a la misión solicitada.', 502, 'FACTORY_DELIVERY_MISMATCH');
    }

    // Staging verifies the narrow transport schema, body bytes and hashes a
    // second time, and refuses a result belonging to another project.  The
    // returned record is immutable and can later be re-downloaded without
    // asking a provider to regenerate it.
    const deliverable = await projectSpaces.stageTextDeliverable(projectId, factoryDelivery);
    // The conversation receives a final answer only after the public Factory
    // delivery contract has been validated and the exact bytes have been
    // sealed in this project's vault.  The browser never supplies this text.
    const conversationTurn = await projectSpaces.recordMissionFinalConversationTurn(projectId, {
      missionId: id,
      deliveryId: deliverable.id,
    });
    await audit('project.mission.delivery.staged', {
      projectId,
      missionId: id,
      deliveryId: deliverable.id,
      artifactId: deliverable.artifact.id,
      contentSha256: deliverable.content.sha256,
      bytes: deliverable.content.bytes,
      conversationState: conversationTurn.state,
    });
    return responseSnapshot({
      projectId,
      missionId: id,
      deliverable,
      conversationTurn,
      // This response crosses the authenticated local UI boundary only. It
      // contains the same final text that can be downloaded from the sealed
      // vault, never the Factory's internal artifact, trace or receipts.
      content: {
        mediaType: factoryDelivery.content.mediaType,
        sha256: factoryDelivery.content.sha256,
        bytes: factoryDelivery.content.bytes,
        body: factoryDelivery.content.body,
      },
    });
  }

  function reconciliationSourcedDeliveryAvailability(status) {
    const progress = plainRecord(status?.mission?.sourcedRouteProgress)
      ? status.mission.sourcedRouteProgress
      : null;
    const delivery = plainRecord(progress?.delivery) ? progress.delivery : null;
    return typeof delivery?.availability === 'string' ? delivery.availability : null;
  }

  function reconciliationErrorProjection(error) {
    const safe = publicError(error);
    return {status: safe.status, code: safe.code};
  }

  // Reconcile a small batch of this project's *already completed* missions.
  // It cannot run a model, retry a node, or manufacture an answer: every
  // successful row still crosses projectMissionDelivery(), whose only source
  // is Factory's verified public delivery command and the sealed vault.
  async function reconcileProjectMissionDeliveries(projectId, {missionIds = null} = {}) {
    const existing = deliveryReconciliations.get(projectId);
    if (existing) return existing;
    const run = (async () => {
      await spacesReady;
      assertProjectId(projectId);
      const [mappings, existingDeliverables] = await Promise.all([
        projectSpaces.listMissions(projectId),
        projectSpaces.listTextDeliverables(projectId),
      ]);
      const restrictedMissionIds = Array.isArray(missionIds)
        ? new Set(missionIds.filter(missionId => typeof missionId === 'string'))
        : null;
      const deliverablesByMission = new Map(existingDeliverables.map(delivery => [delivery.missionId, delivery]));
      const candidates = [];
      const seenMissionIds = new Set();
      let pendingCandidateCount = 0;
      for (const mapping of mappings) {
        const missionId = typeof mapping?.missionId === 'string' ? mapping.missionId : null;
        if (!missionId || seenMissionIds.has(missionId) || (restrictedMissionIds && !restrictedMissionIds.has(missionId))) continue;
        try {
          assertMissionId(missionId);
        } catch {
          // ProjectSpaceService normally rejects malformed mappings.  If a
          // historic ledger is malformed, a reconciliation must not widen it
          // into a Factory invocation.
          continue;
        }
        seenMissionIds.add(missionId);
        const existingDeliverable = deliverablesByMission.get(missionId) ?? null;
        // A server-v2 recovery may be resuming after a crash between writing
        // the sealed vault record and appending the conversation turn. Repair
        // that latter immutable projection directly; do not ask Factory again.
        if (existingDeliverable && !restrictedMissionIds) continue;
        pendingCandidateCount += 1;
        if (candidates.length < PROJECT_DELIVERY_RECONCILIATION_LIMIT) {
          candidates.push({
            missionId,
            ...(existingDeliverable ? {delivery: existingDeliverable} : {}),
          });
        }
      }

      let factoryRun = null;
      const outcomes = [];
      for (const candidate of candidates) {
        const missionId = candidate.missionId;
        if (candidate.delivery) {
          try {
            const conversationTurn = await projectSpaces.recordMissionFinalConversationTurn(projectId, {
              missionId,
              deliveryId: candidate.delivery.id,
            });
            if (conversationTurn.state !== 'FINAL_LINKED') {
              outcomes.push({missionId, state: 'FINAL_LINK_BLOCKED'});
              continue;
            }
            outcomes.push({
              missionId,
              state: 'FINAL_LINKED',
              deliverable: {id: candidate.delivery.id, content: {...candidate.delivery.content}},
              conversation: {
                state: conversationTurn.state,
                ...(conversationTurn.conversationId ? {conversationId: conversationTurn.conversationId} : {}),
              },
            });
          } catch (error) {
            outcomes.push({missionId, state: 'FINAL_LINK_BLOCKED', error: reconciliationErrorProjection(error)});
          }
          continue;
        }
        let status;
        try {
          if (!factoryRun) ({run: factoryRun} = await projectRuntime(projectId));
          status = await factoryRun(['status', missionId], {timeoutMs: 30_000});
        } catch (error) {
          outcomes.push({missionId, state: 'UNOBSERVED', error: reconciliationErrorProjection(error)});
          continue;
        }
        const mission = plainRecord(status?.mission) ? status.mission : null;
        const lifecycle = typeof mission?.status === 'string' && PUBLIC_MISSION_STATUS_SET.has(mission.status)
          ? mission.status
          : 'UNVERIFIED';
        if (lifecycle !== 'COMPLETED') {
          outcomes.push({missionId, state: 'NOT_COMPLETED', lifecycle});
          continue;
        }
        const availability = reconciliationSourcedDeliveryAvailability(status);
        if (availability && availability !== 'AVAILABLE') {
          outcomes.push({missionId, state: 'DELIVERY_UNAVAILABLE', lifecycle, availability});
          continue;
        }
        try {
          const staged = await projectMissionDelivery(projectId, missionId);
          outcomes.push({
            missionId,
            state: 'STAGED',
            lifecycle,
            deliverable: {
              id: staged.deliverable.id,
              content: {...staged.deliverable.content},
            },
            conversation: {
              state: staged.conversationTurn.state,
              ...(staged.conversationTurn.conversationId ? {conversationId: staged.conversationTurn.conversationId} : {}),
            },
          });
        } catch (error) {
          // Keep the error diagnostic finite and non-content-bearing.  The
          // next explicit reconciliation may retry only the same narrow
          // verified delivery boundary; it never changes the mission itself.
          outcomes.push({missionId, state: 'DELIVERY_BLOCKED', lifecycle, error: reconciliationErrorProjection(error)});
        }
      }
      const staged = outcomes.filter(outcome => outcome.state === 'STAGED');
      const finalLinked = outcomes.filter(outcome => outcome.state === 'FINAL_LINKED');
      await audit('project.mission.delivery.reconciled', {
        projectId,
        examined: outcomes.length,
        staged: staged.map(outcome => ({
          missionId: outcome.missionId,
          deliveryId: outcome.deliverable.id,
          conversationState: outcome.conversation.state,
        })),
        finalLinked: finalLinked.map(outcome => ({
          missionId: outcome.missionId,
          deliveryId: outcome.deliverable.id,
          conversationState: outcome.conversation.state,
        })),
      });
      return responseSnapshot({
        projectId,
        limit: PROJECT_DELIVERY_RECONCILIATION_LIMIT,
        pendingCandidateCount,
        outcomes,
      });
    })();
    deliveryReconciliations.set(projectId, run);
    try {
      return await run;
    } finally {
      if (deliveryReconciliations.get(projectId) === run) deliveryReconciliations.delete(projectId);
    }
  }

  function reconciliationNeedsFollowUp(result) {
    if (!plainRecord(result)) return true;
    const outcomes = Array.isArray(result.outcomes) ? result.outcomes : [];
    const resolvedCount = outcomes.filter(outcome => outcome?.state === 'STAGED' || outcome?.state === 'FINAL_LINKED').length;
    // `pendingCandidateCount` is calculated before the batch runs. Every
    // STAGED row removes exactly one candidate on the next pass; all other
    // observed states still need a later, read-only check.
    return Number(result.pendingCandidateCount ?? 0) > resolvedCount;
  }

  function reconciliationRetryDelay(projectId, result) {
    const outcomes = Array.isArray(result?.outcomes) ? result.outcomes : [];
    if (outcomes.some(outcome => outcome?.state === 'STAGED' || outcome?.state === 'FINAL_LINKED')) {
      deliveryReconciliationBackoff.delete(projectId);
      return PROJECT_DELIVERY_RECONCILIATION_ACTIVE_DELAY_MS;
    }
    const previous = deliveryReconciliationBackoff.get(projectId) ?? 0;
    const next = previous
      ? Math.min(PROJECT_DELIVERY_RECONCILIATION_MAX_DELAY_MS, previous * 2)
      : PROJECT_DELIVERY_RECONCILIATION_ACTIVE_DELAY_MS;
    deliveryReconciliationBackoff.set(projectId, next);
    return next;
  }

  // This is server-owned rather than browser-owned so a final can return to
  // its linked conversation after a tab switch, browser close or console
  // restart. It is intentionally a small, unref'd scheduler: it reads only
  // status/delivery contracts, cannot run a provider, and never executes from
  // an HTTP GET route. Durable vault records and final keys make every retry
  // semantically idempotent across restarts.
  function scheduleProjectDeliveryReconciliation(projectId, {delayMs = deliveryReconciliationInitialDelayMs} = {}) {
    if (deliveryReconciliationStopped || shuttingDown || scheduledDeliveryReconciliations.has(projectId)) return;
    const safeDelay = Math.max(0, Math.min(PROJECT_DELIVERY_RECONCILIATION_MAX_DELAY_MS, Number(delayMs) || 0));
    const entry = {timer: null, active: false, dueAt: new Date(Date.now() + safeDelay).toISOString()};
    scheduledDeliveryReconciliations.set(projectId, entry);
    const execute = async () => {
      entry.timer = null;
      entry.dueAt = null;
      if (deliveryReconciliationStopped || shuttingDown) {
        if (scheduledDeliveryReconciliations.get(projectId) === entry) scheduledDeliveryReconciliations.delete(projectId);
        return;
      }
      if (activeDeliveryReconciliations >= PROJECT_DELIVERY_RECONCILIATION_CONCURRENCY) {
        if (scheduledDeliveryReconciliations.get(projectId) === entry) scheduledDeliveryReconciliations.delete(projectId);
        scheduleProjectDeliveryReconciliation(projectId, {delayMs: deliveryReconciliationInitialDelayMs});
        return;
      }
      entry.active = true;
      activeDeliveryReconciliations += 1;
      let result = null;
      try {
        const missionIds = await projectSpaces.listPendingServerDeliveryReconciliations(projectId);
        // A v1/historical project has no v2 opt-in. Do not even emit an audit
        // row for it: recovery must remain a silent, read-only no-op rather
        // than look like work was performed on a project it cannot touch.
        result = missionIds.length
          ? await reconcileProjectMissionDeliveries(projectId, {missionIds})
          : {projectId, pendingCandidateCount: 0, outcomes: []};
      } catch (error) {
        await audit('project.mission.delivery.reconcile_background_failed', {
          projectId,
          error: reconciliationErrorProjection(error),
        });
      } finally {
        activeDeliveryReconciliations -= 1;
        if (scheduledDeliveryReconciliations.get(projectId) === entry) scheduledDeliveryReconciliations.delete(projectId);
      }
      if (!deliveryReconciliationStopped && !shuttingDown && reconciliationNeedsFollowUp(result)) {
        scheduleProjectDeliveryReconciliation(projectId, {delayMs: reconciliationRetryDelay(projectId, result)});
      } else if (result) {
        deliveryReconciliationBackoff.delete(projectId);
      }
    };
    entry.timer = setTimeout(() => {
      const task = execute();
      entry.task = task;
      deliveryReconciliationTasks.add(task);
      void task.finally(() => deliveryReconciliationTasks.delete(task));
    }, safeDelay);
    entry.timer.unref?.();
  }

  function stopDeliveryReconciliationScheduler() {
    deliveryReconciliationStopped = true;
    deliveryReconciliationBackoff.clear();
    for (const entry of scheduledDeliveryReconciliations.values()) {
      if (entry?.timer) clearTimeout(entry.timer);
    }
    scheduledDeliveryReconciliations.clear();
  }

  async function waitForDeliveryReconcilerIdle() {
    // A task may schedule its immediate successor while settling. Loop until
    // the scheduler has neither an active operation nor a queued timer; this
    // is used by shutdown-aware local tooling and keeps temporary test state
    // from being recreated after its owning server has closed.
    for (;;) {
      const tasks = [...deliveryReconciliationTasks];
      if (!tasks.length) return;
      await Promise.allSettled(tasks);
      if (!deliveryReconciliationTasks.size) return;
    }
  }

  async function projectMissionAction(projectId, missionId, payload) {
    await spacesReady;
    const id = assertMissionId(missionId);
    const mappings = await projectSpaces.listMissions(projectId);
    if (!mappings.some(mapping => mapping.missionId === id)) {
      throw new ConsoleError('La misión no pertenece al espacio activo.', 404, 'PROJECT_MISSION_NOT_FOUND');
    }
    const action = payload?.action;
    if (!ACTIONS.has(action)) {
      throw new ConsoleError('La acción solicitada no está permitida.', 400, 'INVALID_ACTION');
    }
    const args = [action, id];
    if (action === 'retry-review') {
      const node = asOptionalString(payload?.node, 'El nodo', 120);
      const reason = asOptionalString(payload?.reason, 'La justificación', 4_000);
      if (!node || !reason || reason.length < 20) {
        throw new ConsoleError('Un reintento de revisión necesita nodo y una justificación de al menos 20 caracteres.', 400, 'MISSING_REVIEW_RETRY_DATA');
      }
      args.push('--node', node, '--reason', reason);
    }
    const {run} = await projectRuntime(projectId);
    const result = await run(args, {timeoutMs: 30_000});
    await audit('project.mission.action_requested', {projectId, missionId: id, action, ...(action === 'retry-review' ? {node: payload.node} : {})});
    return responseSnapshot({projectId, missionId: id, action, result});
  }

  function requireUiToken(request) {
    if (request.headers['x-sovereign-ui-token'] !== uiToken) {
      throw new ConsoleError('La acción necesita una sesión local válida.', 403, 'INVALID_UI_SESSION');
    }
  }

  function requireSameOriginMutation(request) {
    const host = request.headers.host;
    const origin = request.headers.origin;
    if (origin && origin !== 'http://' + host) {
      throw new ConsoleError('La acción sólo se acepta desde esta consola local.', 403, 'CROSS_ORIGIN_REQUEST');
    }
    const fetchSite = request.headers['sec-fetch-site'];
    if (fetchSite && !['same-origin', 'none'].includes(fetchSite)) {
      throw new ConsoleError('La acción sólo se acepta desde esta consola local.', 403, 'CROSS_ORIGIN_REQUEST');
    }
  }

  async function serveAsset(response, pathname) {
    const assetPath = pathname === '/' ? '/index.html' : pathname;
    const resolved = resolve(assetsRoot, '.' + assetPath);
    if (!resolved.startsWith(assetsRoot + sep) || !existsSync(resolved)) {
      text(response, 404, 'No encontrado.');
      return;
    }
    const extension = extname(resolved).toLowerCase();
    const contentType = MIME_TYPES.get(extension);
    if (!contentType) {
      text(response, 404, 'No encontrado.');
      return;
    }
    const body = await readFile(resolved);
    response.writeHead(200, {
      'content-type': contentType,
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
    });
    response.end(body);
  }

  const server = createServer(async (request, response) => {
    securityHeaders(response);
    try {
      const url = new URL(request.url ?? '/', 'http://127.0.0.1');
      const {pathname} = url;
      if (request.method === 'GET' && pathname === '/healthz') {
        json(response, 200, {ok: true, service: 'sovereign-console'});
        return;
      }
      if (request.method === 'GET' && pathname === '/api/bootstrap') {
        json(response, 200, {token: uiToken, overview: await overview()});
        return;
      }
      if (request.method === 'GET' && pathname === '/api/overview') {
        json(response, 200, await overview({fresh: url.searchParams.get('fresh') === '1'}));
        return;
      }
      if (request.method === 'GET' && pathname === '/api/projects') {
        await spacesReady;
        json(response, 200, responseSnapshot({projects: await projectSpaces.listProjects()}));
        return;
      }
      if (request.method === 'POST' && pathname === '/api/projects') {
        requireSameOriginMutation(request);
        requireUiToken(request);
        const input = await readJsonBody(request);
        const modelPolicy = normalizeModelPolicy(input?.modelPolicy);
        await verifyModelSelection(modelPolicy.model, modelPolicy.effort);
        await spacesReady;
        const project = await projectSpaces.createProject({...input, modelPolicy});
        await audit('project.created', {projectId: project.id, model: project.modelPolicy.model, effort: project.modelPolicy.effort});
        json(response, 201, responseSnapshot({project}));
        return;
      }
      const projectRoute = pathname.match(/^\/api\/projects\/([^/]+)(?:\/(.*))?$/);
      if (projectRoute) {
        const projectId = assertProjectId(decodeURIComponent(projectRoute[1]));
        const route = projectRoute[2] ?? '';
        if (request.method === 'GET' && !route) {
          json(response, 200, await projectOverview(projectId));
          return;
        }
        if (request.method === 'GET' && route === 'assets') {
          await spacesReady;
          json(response, 200, responseSnapshot({projectId, assets: await projectSpaces.listAssets(projectId)}));
          return;
        }
        if (request.method === 'GET' && route === 'deliverables') {
          await spacesReady;
          json(response, 200, responseSnapshot({projectId, deliverables: await projectSpaces.listTextDeliverables(projectId)}));
          return;
        }
        if (request.method === 'GET' && route === 'deliveries/inbox') {
          // The inbox describes sealed delivery metadata for this project.
          // It is deliberately local-session scoped like final delivery bytes:
          // a cross-origin page must not be able to learn whether a client
          // delivery exists, and this read path must not create an audit event
          // or mutate Factory/project state.
          requireSameOriginMutation(request);
          requireUiToken(request);
          await spacesReady;
          json(response, 200, await projectSpaces.listUnlinkedSealedDeliveryInbox(projectId));
          return;
        }
        if (request.method === 'POST' && route === 'deliveries/reconcile') {
          requireSameOriginMutation(request);
          requireUiToken(request);
          // This endpoint intentionally accepts no caller-selected mission,
          // text, model or retry instruction. It only reconciles a small,
          // server-v2 opted-in batch through the verified delivery boundary;
          // historical links retain their explicit per-mission path.
          const missionIds = await projectSpaces.listPendingServerDeliveryReconciliations(projectId);
          json(response, 200, await reconcileProjectMissionDeliveries(projectId, {missionIds}));
          return;
        }
        const deliverableContentRoute = route.match(/^deliverables\/([^/]+)\/content$/);
        if (request.method === 'GET' && deliverableContentRoute) {
          // A final can be confidential client work. Listing metadata is a
          // local projection, but reading bytes requires the active local UI
          // session exactly like an original project attachment.
          requireSameOriginMutation(request);
          requireUiToken(request);
          await spacesReady;
          const deliveryId = assertDeliverableId(decodeURIComponent(deliverableContentRoute[1]));
          await streamTextDeliverable(response, projectSpaces, projectId, deliveryId);
          await audit('project.deliverable.downloaded', {projectId, deliveryId});
          return;
        }
        if (request.method === 'POST' && route === 'assets/reservations') {
          requireSameOriginMutation(request);
          requireUiToken(request);
          await spacesReady;
          const reservation = await projectSpaces.reserveAssetUpload(projectId, await readJsonBody(request));
          const uploadUrl = '/api/projects/' + encodeURIComponent(projectId) + '/assets/uploads/' + encodeURIComponent(reservation.reservation.id);
          await audit('project.asset.reserved', {projectId, assetId: reservation.asset.id, size: reservation.asset.size, sha256: reservation.asset.sha256});
          json(response, 201, responseSnapshot({projectId, ...reservation, upload: {method: 'PUT', url: uploadUrl}}));
          return;
        }
        const assetUploadRoute = route.match(/^assets\/uploads\/([^/]+)$/);
        if (request.method === 'PUT' && assetUploadRoute) {
          requireSameOriginMutation(request);
          requireUiToken(request);
          await spacesReady;
          const asset = await projectSpaces.commitAssetUpload(projectId, decodeURIComponent(assetUploadRoute[1]), request, {
            contentLength: rawContentLength(request),
            contentType: rawContentType(request),
          });
          await audit('project.asset.published', {projectId, assetId: asset.id, size: asset.size, sha256: asset.sha256});
          json(response, 201, responseSnapshot({projectId, asset}));
          return;
        }
        const assetOriginalRoute = route.match(/^assets\/([^/]+)\/original$/);
        if (request.method === 'GET' && assetOriginalRoute) {
          // Original bytes are confidential project material. A list can be a
          // local projection; a download always requires the active local UI
          // session and remains scoped to this project (and optionally mission).
          requireSameOriginMutation(request);
          requireUiToken(request);
          await spacesReady;
          const assetId = decodeURIComponent(assetOriginalRoute[1]);
          const missionId = url.searchParams.has('missionId') ? url.searchParams.get('missionId') : null;
          await streamOriginalAsset(response, projectSpaces, projectId, assetId, {missionId});
          await audit('project.asset.downloaded', {projectId, assetId, missionId});
          return;
        }
        if (request.method === 'GET' && route === 'conversations') {
          await spacesReady;
          json(response, 200, responseSnapshot({projectId, conversations: await projectSpaces.listConversations(projectId)}));
          return;
        }
        if (request.method === 'POST' && route === 'messages') {
          requireSameOriginMutation(request);
          requireUiToken(request);
          await spacesReady;
          const recorded = await projectSpaces.recordMessage(projectId, await readJsonBody(request));
          await audit('project.message.recorded', {projectId, conversationId: recorded.conversation.id, source: recorded.message.source});
          json(response, 201, responseSnapshot({projectId, ...recorded}));
          return;
        }
        const conversationRoute = route.match(/^conversations\/([^/]+)\/messages$/);
        if (request.method === 'GET' && conversationRoute) {
          await spacesReady;
          const conversationId = assertConversationId(decodeURIComponent(conversationRoute[1]));
          json(response, 200, responseSnapshot({projectId, conversationId, messages: await projectSpaces.listMessages(projectId, conversationId)}));
          return;
        }
        if (request.method === 'GET' && route === 'memory') {
          await spacesReady;
          json(response, 200, responseSnapshot({projectId, ...(await projectSpaces.searchMemory(projectId, url.searchParams.get('query') ?? ''))}));
          return;
        }
        if (request.method === 'GET' && route === 'missions') {
          const [mappings, runtime] = await Promise.all([projectSpaces.listMissions(projectId), projectQueue(projectId)]);
          json(response, 200, responseSnapshot({projectId, missions: mappings, runtime}));
          return;
        }
        if (request.method === 'POST' && route === 'missions') {
          requireSameOriginMutation(request);
          requireUiToken(request);
          json(response, 202, await submitMission(await readJsonBody(request), {projectId}));
          return;
        }
        if (request.method === 'PATCH' && route === 'identity') {
          requireSameOriginMutation(request);
          requireUiToken(request);
          await spacesReady;
          const project = await projectSpaces.renameProject(projectId, await readJsonBody(request));
          caches.delete('overview');
          await audit('project.identity.renamed', {projectId});
          json(response, 200, responseSnapshot({project}));
          return;
        }
        if (request.method === 'POST' && route === 'model-policy') {
          requireSameOriginMutation(request);
          requireUiToken(request);
          const nextPolicy = normalizeModelPolicy(await readJsonBody(request));
          const project = await projectSpaces.updateProjectModelPolicy(projectId, nextPolicy, {
            verifyModel: policy => verifyModelSelection(policy.model, policy.effort),
          });
          await audit('project.model_policy.updated', {projectId, model: project.modelPolicy.model, effort: project.modelPolicy.effort});
          json(response, 200, responseSnapshot({project}));
          return;
        }
        if (request.method === 'POST' && route === 'runtime/start') {
          requireSameOriginMutation(request);
          requireUiToken(request);
          json(response, 202, await startProjectRuntime(projectId));
          return;
        }
        const projectMissionRoute = route.match(/^missions\/([^/]+)(?:\/(action|export|deliverable|status))?$/);
        if (projectMissionRoute) {
          const missionId = decodeURIComponent(projectMissionRoute[1]);
          const action = projectMissionRoute[2] ?? '';
          if (request.method === 'GET' && !action) {
            json(response, 200, await projectMissionDetail(projectId, missionId));
            return;
          }
          if (request.method === 'GET' && action === 'export') {
            // A mission projection can include confidential client-facing
            // operational data.  It is a read, but unlike ordinary list
            // metadata it is an explicit local export, so require the same
            // active local UI boundary as other project byte-bearing reads.
            requireSameOriginMutation(request);
            requireUiToken(request);
            const detail = await projectMissionDetail(projectId, missionId);
            response.setHeader('content-disposition', 'attachment; filename="sublimine-' + missionId.slice(8) + '.json"');
            json(response, 200, detail);
            return;
          }
          if (request.method === 'GET' && action === 'status') {
            json(response, 200, await projectMissionStatus(projectId, missionId));
            return;
          }
          if (request.method === 'POST' && action === 'action') {
            requireSameOriginMutation(request);
            requireUiToken(request);
            json(response, 200, await projectMissionAction(projectId, missionId, await readJsonBody(request)));
            return;
          }
          if (request.method === 'POST' && action === 'deliverable') {
            requireSameOriginMutation(request);
            requireUiToken(request);
            // No body is accepted here: a delivery is derived only from the
            // immutable mission ID and its Factory-verified final artifact.
            json(response, 201, await projectMissionDelivery(projectId, missionId));
            return;
          }
        }
      }
      if (request.method === 'GET' && pathname === '/api/roles') {
        json(response, 200, responseSnapshot({roles: await catalog()}));
        return;
      }
      if (request.method === 'GET' && pathname.startsWith('/api/roles/')) {
        json(response, 200, await roleDetail(decodeURIComponent(pathname.slice('/api/roles/'.length))));
        return;
      }
      if (request.method === 'GET' && pathname.startsWith('/api/missions/')) {
        const suffix = pathname.slice('/api/missions/'.length);
        const missionId = decodeURIComponent(suffix.replace(/\/export$/, ''));
        const detail = await missionDetail(missionId);
        if (suffix.endsWith('/export')) {
          response.setHeader('content-disposition', 'attachment; filename="sublimine-' + missionId.slice(8) + '.json"');
        }
        json(response, 200, detail);
        return;
      }
      if (request.method === 'GET' && pathname === '/api/stream') {
        if (shuttingDown) {
          text(response, 503, 'La consola se está reiniciando.');
          return;
        }
        response.writeHead(200, {
          'content-type': 'text/event-stream; charset=utf-8',
          'cache-control': 'no-store',
          connection: 'keep-alive',
          'x-accel-buffering': 'no',
        });
        response.write('retry: 5000\n\n');
        streamClients.add(response);
        overview().then(snapshot => {
          if (!response.writableEnded) response.write('event: overview\ndata: ' + JSON.stringify(snapshot) + '\n\n');
        }).catch(() => {});
        request.once('close', () => streamClients.delete(response));
        return;
      }
      if (request.method === 'POST' && pathname === '/api/missions') {
        requireSameOriginMutation(request);
        requireUiToken(request);
        json(response, 202, await submitMission(await readJsonBody(request)));
        return;
      }
      const actionMatch = pathname.match(/^\/api\/missions\/(.+)\/action$/);
      if (request.method === 'POST' && actionMatch) {
        requireSameOriginMutation(request);
        requireUiToken(request);
        json(response, 200, await missionAction(decodeURIComponent(actionMatch[1]), await readJsonBody(request)));
        return;
      }
      if (pathname.startsWith('/api/')) {
        json(response, 404, {code: 'API_NOT_FOUND', message: 'La ruta de consola no existe.'});
        return;
      }
      await serveAsset(response, pathname);
    } catch (error) {
      void audit('console.request_failed', {
        method: request.method,
        path: request.url?.slice(0, 512) ?? '/',
        code: error?.code ?? 'CONSOLE_INTERNAL',
      });
      const safe = publicError(error);
      if (!response.headersSent) json(response, safe.status, {code: safe.code, message: safe.message});
      else response.end();
    }
  });

  // Recovery is intentionally asynchronous: bringing up the local console
  // never waits for pending client work. Each project is queued with a small
  // stagger and the scheduler's global cap prevents a restart from fanning
  // out into an uncontrolled status sweep.
  void spacesReady.then(async () => {
    const projects = await projectSpaces.listProjects();
    projects.forEach((project, index) => {
      if (typeof project?.id !== 'string') return;
      scheduleProjectDeliveryReconciliation(project.id, {
        delayMs: deliveryReconciliationInitialDelayMs + (index * 500),
      });
    });
  }).catch(error => audit('project.mission.delivery.reconcile_recovery_failed', {
    error: reconciliationErrorProjection(error),
  }));

  const poll = setInterval(async () => {
    if (!streamClients.size) return;
    try {
      const snapshot = await overview({fresh: true});
      for (const client of streamClients) {
        if (!client.writableEnded) client.write('event: overview\ndata: ' + JSON.stringify(snapshot) + '\n\n');
      }
    } catch {
      // A transient CLI problem is projected by the next overview snapshot.
    }
  }, 5_000);
  server.once('close', () => {
    clearInterval(poll);
    stopDeliveryReconciliationScheduler();
  });

  // `server.close()` waits for active responses.  The UI intentionally keeps
  // an EventSource open, so a bare close on SIGTERM otherwise waits forever
  // for the browser and reaches systemd's TimeoutStopSec.  This shutdown
  // boundary owns only console HTTP/SSE state: project queue workers are
  // separate user-systemd units created by ProjectRuntimeSupervisor.
  function shutdown() {
    if (shutdownPromise) return shutdownPromise;
    shuttingDown = true;
    clearInterval(poll);
    stopDeliveryReconciliationScheduler();
    for (const client of streamClients) {
      try {
        if (!client.writableEnded) client.end('event: shutdown\ndata: {"reason":"console-restarting"}\n\n');
      } catch {
        // A browser can disappear while the local console is stopping.
      }
    }
    streamClients.clear();
    // Node 24 already closes idle keep-alives through close(), but this keeps
    // the intent explicit and remains harmless on earlier supported runtimes.
    server.closeIdleConnections?.();
    shutdownPromise = new Promise((resolvePromise, rejectPromise) => {
      server.close(error => {
        if (error && error.code !== 'ERR_SERVER_NOT_RUNNING') {
          rejectPromise(error);
          return;
        }
        resolvePromise();
      });
    });
    return shutdownPromise;
  }
  server.shutdown = shutdown;
  // Internal lifecycle hook for local integration tests and CLI embedding;
  // it is deliberately not an HTTP endpoint or user-facing control.
  server.waitForDeliveryReconcilerIdle = waitForDeliveryReconcilerIdle;
  // Consumers that construct the bare HTTP server (tests and local tooling)
  // can wait for project-space integrity migration before tearing state down.
  server.ready = spacesReady;
  return server;
}

export async function startDashboard({host = process.env.SOVEREIGN_CONSOLE_HOST || '127.0.0.1', port = Number(process.env.SOVEREIGN_CONSOLE_PORT || 4177), ...options} = {}) {
  if (!['127.0.0.1', '::1'].includes(host)) {
    throw new ConsoleError('La consola sólo puede escuchar en loopback (127.0.0.1 o ::1).', 500, 'NON_LOCAL_HOST');
  }
  if (!Number.isInteger(port) || port < 1024 || port > 65535) {
    throw new ConsoleError('El puerto de consola no es válido.', 500, 'INVALID_PORT');
  }
  const server = createDashboardServer(options);
  await server.ready;
  await new Promise((resolvePromise, rejectPromise) => {
    server.once('error', rejectPromise);
    server.listen(port, host, () => {
      server.off('error', rejectPromise);
      resolvePromise();
    });
  });
  process.stdout.write('Sublimine Console escuchando en http://' + host + ':' + port + '\n');
  let stopping = false;
  const close = () => {
    if (stopping) return;
    stopping = true;
    void server.shutdown().then(
      () => process.exit(0),
      () => process.exit(1),
    );
  };
  process.once('SIGTERM', close);
  process.once('SIGINT', close);
  return server;
}

const invokedAsScript = process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (invokedAsScript) {
  startDashboard().catch(error => {
    process.stderr.write((error?.code ?? 'CONSOLE_START') + ': ' + (error?.message ?? 'No se pudo iniciar la consola.') + '\n');
    process.exitCode = 1;
  });
}
