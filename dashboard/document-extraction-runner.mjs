/**
 * Parent-owned sandbox runner for Document Extraction V2.
 *
 * It has no Factory dependency and never receives a vault pathname or an
 * original filename.  The parent passes verified bytes and a kind; this runner
 * exposes those bytes to one fixed tool inside bwrap, validates the small
 * result protocol, then returns only untrusted derived text to its caller.
 */
import {constants as FS_CONSTANTS} from 'node:fs';
import {chmod, lstat, mkdir, mkdtemp, open, readdir, rm, writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {spawn} from 'node:child_process';
import {join, resolve} from 'node:path';
import {tmpdir} from 'node:os';

import {
  DOCUMENT_EXTRACTION_LIMITS,
  DOCUMENT_EXTRACTION_PREFLIGHT_SCHEMA,
  DOCUMENT_EXTRACTION_PROFILE,
  DOCUMENT_EXTRACTION_RESOURCE_LIMITS,
  DocumentExtractionContractError,
  documentToolchainBindingHash,
  documentToolchainLock,
  requireQualifiedDocumentToolchain,
} from './document-extraction-contract.mjs';

export const DOCUMENT_EXTRACTOR_RESULT_SCHEMA = 'sublimine.document-extractor-result.v1';
export const DOCUMENT_EXTRACTOR_PROBE_SCHEMA = 'sublimine.document-extractor-probe.v1';
export const DOCUMENT_EXTRACTOR_REVISION = 1;

const SHA256 = /^[a-f0-9]{64}$/i;
const O_NOFOLLOW = Number.isInteger(FS_CONSTANTS.O_NOFOLLOW) ? FS_CONSTANTS.O_NOFOLLOW : 0;
const READ_FLAGS = FS_CONSTANTS.O_RDONLY | O_NOFOLLOW;
const UTF8 = new TextDecoder('utf-8', {fatal: true, ignoreBOM: true});
const kinds = new Set(['PDF', 'DOCX']);

export class DocumentExtractionRunnerError extends Error {
  constructor(message, code = 'DOCUMENT_EXTRACTION_RUNNER_FAILED') {
    super(message);
    this.name = 'DocumentExtractionRunnerError';
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

function hashBytes(value) { return createHash('sha256').update(value).digest('hex'); }
function hash(value, code = 'DOCUMENT_EXTRACTION_RUNNER_PROTOCOL_INVALID') {
  if (typeof value !== 'string' || !SHA256.test(value)) throw new DocumentExtractionRunnerError('El hash del extractor no es válido.', code);
  return value.toLowerCase();
}
function kind(value) {
  const candidate = String(value ?? '').toUpperCase();
  if (!kinds.has(candidate)) throw new DocumentExtractionRunnerError('El tipo documental no está permitido.', 'DOCUMENT_EXTRACTION_KIND_INVALID');
  return candidate;
}
function canonical(value) {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (value && typeof value === 'object') return '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + canonical(value[key])).join(',') + '}';
  return JSON.stringify(value);
}

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function uint16(value) {
  const result = Buffer.allocUnsafe(2);
  result.writeUInt16LE(value, 0);
  return result;
}

function uint32(value) {
  const result = Buffer.allocUnsafe(4);
  result.writeUInt32LE(value >>> 0, 0);
  return result;
}

function fixedPdfFixture() {
  const objects = [
    '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n',
    '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n',
    '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>\nendobj\n',
    '4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n',
    '5 0 obj\n<< /Length 55 >>\nstream\nBT /F1 18 Tf 72 720 Td (Sublimine preflight PDF) Tj ET\nendstream\nendobj\n',
  ];
  let document = '%PDF-1.4\n';
  const offsets = [];
  for (const object of objects) {
    offsets.push(Buffer.byteLength(document, 'ascii'));
    document += object;
  }
  const xrefOffset = Buffer.byteLength(document, 'ascii');
  document += 'xref\n0 ' + (objects.length + 1) + '\n0000000000 65535 f \n';
  for (const offset of offsets) document += String(offset).padStart(10, '0') + ' 00000 n \n';
  document += 'trailer\n<< /Size ' + (objects.length + 1) + ' /Root 1 0 R >>\nstartxref\n' + xrefOffset + '\n%%EOF\n';
  return Buffer.from(document, 'ascii');
}

function fixedStoredZip(entries) {
  const chunks = [];
  const directory = [];
  let offset = 0;
  for (const {name, content} of entries) {
    const nameBytes = Buffer.from(name, 'utf8');
    const body = Buffer.from(content, 'utf8');
    const crc = crc32(body);
    const local = Buffer.concat([
      uint32(0x04034b50), uint16(20), uint16(0), uint16(0), uint16(0), uint16(0),
      uint32(crc), uint32(body.length), uint32(body.length), uint16(nameBytes.length), uint16(0), nameBytes, body,
    ]);
    chunks.push(local);
    directory.push({nameBytes, crc, bytes: body.length, offset});
    offset += local.length;
  }
  const centralOffset = offset;
  for (const entry of directory) {
    const central = Buffer.concat([
      uint32(0x02014b50), uint16(20), uint16(20), uint16(0), uint16(0), uint16(0), uint16(0),
      uint32(entry.crc), uint32(entry.bytes), uint32(entry.bytes), uint16(entry.nameBytes.length), uint16(0), uint16(0),
      uint16(0), uint16(0), uint32(0), uint32(entry.offset), entry.nameBytes,
    ]);
    chunks.push(central);
    offset += central.length;
  }
  chunks.push(Buffer.concat([
    uint32(0x06054b50), uint16(0), uint16(0), uint16(directory.length), uint16(directory.length),
    uint32(offset - centralOffset), uint32(centralOffset), uint16(0),
  ]));
  return Buffer.concat(chunks);
}

function fixedDocxFixture() {
  return fixedStoredZip([{
    name: 'word/document.xml',
    content: '<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Sublimine preflight DOCX</w:t></w:r></w:p></w:body></w:document>',
  }]);
}

const PREFLIGHT_FIXTURES = Object.freeze([
  Object.freeze({kind: 'PDF', filename: 'fixture.pdf', bytes: fixedPdfFixture(), expectedText: 'Sublimine preflight PDF'}),
  Object.freeze({kind: 'DOCX', filename: 'fixture.docx', bytes: fixedDocxFixture(), expectedText: 'Sublimine preflight DOCX'}),
]);
function freeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  // Node rejects Object.freeze(Buffer) when it contains indexed bytes.  The
  // containing protocol records remain immutable; callers receive a fresh
  // Buffer and must hash it again before any persistent publication.
  if (ArrayBuffer.isView(value)) return value;
  for (const child of Object.values(value)) freeze(child);
  return Object.freeze(value);
}

async function nativeExecute({command, args, cwd, env, timeoutMs}) {
  return new Promise((resolvePromise, reject) => {
    let settled = false;
    let child;
    try {
      child = spawn(command, args, {cwd, env, shell: false, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true});
    } catch (error) {
      reject(new DocumentExtractionRunnerError('No se pudo iniciar el sandbox documental.', 'DOCUMENT_EXTRACTION_SANDBOX_START_FAILED'));
      return;
    }
    const stdout = [];
    const stderr = [];
    let outputBytes = 0;
    const maximumOutput = 64 * 1024;
    let timer = null;
    const finish = callback => value => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      callback(value);
    };
    const rejectOnce = finish(reject);
    const resolveOnce = finish(resolvePromise);
    const accept = bucket => chunk => {
      outputBytes += chunk.length;
      if (outputBytes > maximumOutput) {
        child.kill('SIGKILL');
        rejectOnce(new DocumentExtractionRunnerError('El sandbox documental excedió el límite de salida.', 'DOCUMENT_EXTRACTION_SANDBOX_OUTPUT_EXCEEDED'));
        return;
      }
      bucket.push(Buffer.from(chunk));
    };
    child.stdout.on('data', accept(stdout));
    child.stderr.on('data', accept(stderr));
    child.on('error', () => rejectOnce(new DocumentExtractionRunnerError('El sandbox documental no pudo ejecutarse.', 'DOCUMENT_EXTRACTION_SANDBOX_START_FAILED')));
    child.on('close', (code, signal) => resolveOnce({code, signal, stdout: Buffer.concat(stdout), stderr: Buffer.concat(stderr)}));
    timer = setTimeout(() => {
      child.kill('SIGKILL');
      rejectOnce(new DocumentExtractionRunnerError('El sandbox documental excedió el tiempo permitido.', 'DOCUMENT_EXTRACTION_SANDBOX_TIMEOUT'));
    }, timeoutMs);
  });
}

async function ensurePrivateDirectory(path) {
  try {
    await mkdir(path, {recursive: true, mode: 0o700});
    const info = await lstat(path);
    if (!info.isDirectory() || info.isSymbolicLink() || info.uid !== process.getuid() || (info.mode & 0o077) !== 0) {
      throw new DocumentExtractionRunnerError('El directorio temporal documental no conserva el perfil privado requerido.', 'DOCUMENT_EXTRACTION_SCRATCH_UNSAFE');
    }
    await chmod(path, 0o700);
  } catch (error) {
    if (error instanceof DocumentExtractionRunnerError) throw error;
    throw new DocumentExtractionRunnerError('No se pudo preparar el directorio temporal documental.', 'DOCUMENT_EXTRACTION_SCRATCH_UNAVAILABLE');
  }
}

async function readRegularNoFollow(path, {maximumBytes, code}) {
  let handle;
  try {
    handle = await open(path, READ_FLAGS);
    const info = await handle.stat();
    if (!info.isFile() || info.uid !== process.getuid() || info.nlink !== 1 || info.size < 1 || info.size > maximumBytes) {
      throw new DocumentExtractionRunnerError('La salida del extractor no es un archivo regular acotado.', code);
    }
    return await handle.readFile();
  } catch (error) {
    if (error instanceof DocumentExtractionRunnerError) throw error;
    throw new DocumentExtractionRunnerError('No se pudo leer una salida segura del extractor.', code);
  } finally {
    await handle?.close().catch(() => {});
  }
}

// A qualified lock is not trusted merely because its JSON validates.  The
// parent re-hashes every fixed executable immediately before the bwrap probe;
// a package replacement or symlink swap disables extraction rather than
// silently running a different parser.
async function trustedPathParents(path, label) {
  const pieces = String(path).split('/').filter(Boolean);
  let current = '';
  for (const piece of pieces.slice(0, -1)) {
    current += '/' + piece;
    let info;
    try { info = await lstat(current); } catch {
      throw new DocumentExtractionRunnerError('La ruta de ' + label + ' no es verificable.', 'DOCUMENT_EXTRACTION_TOOLCHAIN_BINARY_INVALID');
    }
    if (!info.isDirectory() || info.isSymbolicLink() || info.uid !== 0 || (info.mode & 0o022) !== 0) {
      throw new DocumentExtractionRunnerError('La ruta de ' + label + ' no conserva propiedad inmutable.', 'DOCUMENT_EXTRACTION_TOOLCHAIN_BINARY_INVALID');
    }
  }
}

async function verifyLockedExecutable(path, expectedHash, label) {
  await trustedPathParents(path, label);
  let handle;
  try {
    handle = await open(path, READ_FLAGS);
    const info = await handle.stat();
    if (!info.isFile() || info.uid !== 0 || (info.mode & 0o022) !== 0 || info.size < 1 || info.size > 64 * 1024 * 1024) {
      throw new DocumentExtractionRunnerError('La identidad de ' + label + ' no conserva el perfil de release.', 'DOCUMENT_EXTRACTION_TOOLCHAIN_BINARY_INVALID');
    }
    const raw = await handle.readFile();
    if (hashBytes(raw) !== expectedHash) {
      throw new DocumentExtractionRunnerError('La identidad de ' + label + ' no coincide con el lock.', 'DOCUMENT_EXTRACTION_TOOLCHAIN_BINARY_MISMATCH');
    }
  } catch (error) {
    if (error instanceof DocumentExtractionRunnerError) throw error;
    throw new DocumentExtractionRunnerError('No se pudo verificar la identidad de ' + label + '.', 'DOCUMENT_EXTRACTION_TOOLCHAIN_BINARY_INVALID');
  } finally {
    await handle?.close().catch(() => {});
  }
}

export async function verifyQualifiedDocumentToolchainBinaries(lock) {
  const qualified = requireQualifiedDocumentToolchain(lock);
  await Promise.all([
    verifyLockedExecutable(qualified.tools.pdfinfo.path, qualified.tools.pdfinfo.sha256, 'pdfinfo'),
    verifyLockedExecutable(qualified.tools.pdftotext.path, qualified.tools.pdftotext.sha256, 'pdftotext'),
    verifyLockedExecutable(qualified.tools.python.path, qualified.tools.python.sha256, 'python'),
    verifyLockedExecutable(qualified.tools.extractor.path, qualified.tools.extractor.sha256, 'extractor'),
    verifyLockedExecutable(qualified.dependencies.defusedxml.init.path, qualified.dependencies.defusedxml.init.sha256, 'defusedxml.init'),
    verifyLockedExecutable(qualified.dependencies.defusedxml.elementTree.path, qualified.dependencies.defusedxml.elementTree.sha256, 'defusedxml.elementTree'),
    verifyLockedExecutable(qualified.sandbox.bwrap.path, qualified.sandbox.bwrap.sha256, 'bwrap'),
    verifyLockedExecutable(qualified.sandbox.prlimit.path, qualified.sandbox.prlimit.sha256, 'prlimit'),
  ]);
  return qualified;
}

function strictJson(bytes, code) {
  if (bytes.length > 64 * 1024) throw new DocumentExtractionRunnerError('El recibo del extractor excede el límite.', code);
  let parsed;
  try { parsed = JSON.parse(UTF8.decode(bytes)); } catch { throw new DocumentExtractionRunnerError('El recibo del extractor no es JSON UTF-8 válido.', code); }
  return record(parsed) ?? (() => { throw new DocumentExtractionRunnerError('El recibo del extractor debe ser un objeto.', code); })();
}

function resultObservations(value, documentKind) {
  const observations = record(value);
  if (documentKind === 'PDF') {
    if (!observations || !hasOnlyKeys(observations, ['pages', 'textLayer'])
      || !Number.isSafeInteger(observations.pages) || observations.pages < 1 || observations.pages > DOCUMENT_EXTRACTION_LIMITS.maxPdfPages
      || observations.textLayer !== 'PRESENT') {
      throw new DocumentExtractionRunnerError('Las observaciones del PDF no son válidas.', 'DOCUMENT_EXTRACTION_RUNNER_PROTOCOL_INVALID');
    }
    return {pages: observations.pages, textLayer: 'PRESENT'};
  }
  if (!observations || !hasOnlyKeys(observations, ['entries', 'expandedBytes', 'bodyParts'])
    || !Number.isSafeInteger(observations.entries) || observations.entries < 1 || observations.entries > DOCUMENT_EXTRACTION_LIMITS.maxDocxEntries
    || !Number.isSafeInteger(observations.expandedBytes) || observations.expandedBytes < 1 || observations.expandedBytes > DOCUMENT_EXTRACTION_LIMITS.maxDocxExpandedBytes
    || observations.bodyParts !== 1) {
    throw new DocumentExtractionRunnerError('Las observaciones del DOCX no son válidas.', 'DOCUMENT_EXTRACTION_RUNNER_PROTOCOL_INVALID');
  }
  return {entries: observations.entries, expandedBytes: observations.expandedBytes, bodyParts: 1};
}

function parseExtractionResult(value, expectedKind, derived) {
  if (!hasOnlyKeys(value, ['schema', 'revision', 'state', 'kind', 'derived', 'observations'])
    || value.schema !== DOCUMENT_EXTRACTOR_RESULT_SCHEMA || value.revision !== DOCUMENT_EXTRACTOR_REVISION
    || value.state !== 'EXTRACTED' || value.kind !== expectedKind) {
    throw new DocumentExtractionRunnerError('El resultado del extractor no cumple el protocolo V2.', 'DOCUMENT_EXTRACTION_RUNNER_PROTOCOL_INVALID');
  }
  const descriptor = record(value.derived);
  if (!descriptor || !hasOnlyKeys(descriptor, ['sha256', 'bytes'])
    || descriptor.bytes !== derived.length || descriptor.bytes < 1 || descriptor.bytes > DOCUMENT_EXTRACTION_LIMITS.maxDerivedBytes
    || hash(descriptor.sha256) !== hashBytes(derived)) {
    throw new DocumentExtractionRunnerError('El derivado documental no coincide con el recibo del extractor.', 'DOCUMENT_EXTRACTION_DERIVED_HASH_MISMATCH');
  }
  let text;
  try { text = UTF8.decode(derived); } catch { throw new DocumentExtractionRunnerError('El derivado documental no es UTF-8 válido.', 'DOCUMENT_EXTRACTION_DERIVED_UTF8_INVALID'); }
  if (!text.trim() || text.includes('\u0000')) {
    throw new DocumentExtractionRunnerError('El derivado documental no contiene texto admisible.', 'DOCUMENT_EXTRACTION_DERIVED_TEXT_INVALID');
  }
  return freeze({
    kind: expectedKind,
    derived: {sha256: hashBytes(derived), bytes: derived.length, content: Buffer.from(derived)},
    observations: resultObservations(value.observations, expectedKind),
  });
}

function parseProbe(value) {
  if (!hasOnlyKeys(value, ['schema', 'revision', 'state', 'assertions'])
    || value.schema !== DOCUMENT_EXTRACTOR_PROBE_SCHEMA || value.revision !== DOCUMENT_EXTRACTOR_REVISION || value.state !== 'QUALIFIED') {
    throw new DocumentExtractionRunnerError('El preflight documental no cumple el protocolo.', 'DOCUMENT_EXTRACTION_PREFLIGHT_PROTOCOL_INVALID');
  }
  const assertions = record(value.assertions);
  if (!assertions || !hasOnlyKeys(assertions, ['network', 'home', 'outsideWrite'])
    || assertions.network !== 'UNAVAILABLE' || assertions.home !== 'UNAVAILABLE' || assertions.outsideWrite !== 'DENIED') {
    throw new DocumentExtractionRunnerError('El preflight no acreditó el aislamiento requerido.', 'DOCUMENT_EXTRACTION_PREFLIGHT_ISOLATION_FAILED');
  }
  return {network: 'UNAVAILABLE', home: 'UNAVAILABLE', outsideWrite: 'DENIED'};
}

async function exactOutputEntries(outputPath, expected, code) {
  const entries = (await readdir(outputPath)).sort();
  if (entries.length !== expected.length || entries.some((entry, index) => entry !== expected[index])) {
    throw new DocumentExtractionRunnerError('El sandbox documental produjo archivos no permitidos.', code);
  }
}

/**
 * Construct a fixed bwrap invocation.  `inputPath`/`outputPath` are created
 * by this runner; document content never becomes a command argument, and the
 * original vault path is not part of this protocol.
 */
function documentSandboxInvocation(lock, {mode, inputPath = null, outputPath, kind: extractionKind = null}) {
  const qualified = requireQualifiedDocumentToolchain(lock);
  if (!['probe', 'extract'].includes(mode)) throw new DocumentExtractionRunnerError('El modo de sandbox documental no es válido.', 'DOCUMENT_EXTRACTION_SANDBOX_MODE_INVALID');
  if (typeof outputPath !== 'string' || !outputPath.startsWith('/')) throw new DocumentExtractionRunnerError('La salida del sandbox no es válida.', 'DOCUMENT_EXTRACTION_SANDBOX_PATH_INVALID');
  if (mode === 'extract' && (typeof inputPath !== 'string' || !inputPath.startsWith('/'))) {
    throw new DocumentExtractionRunnerError('La entrada del sandbox no es válida.', 'DOCUMENT_EXTRACTION_SANDBOX_PATH_INVALID');
  }
  if (mode === 'extract' && !kinds.has(String(extractionKind ?? '').toUpperCase())) {
    throw new DocumentExtractionRunnerError('El tipo documental del sandbox no es válido.', 'DOCUMENT_EXTRACTION_SANDBOX_MODE_INVALID');
  }
  const args = [
    '--unshare-all', '--unshare-net', '--die-with-parent', '--new-session', '--clearenv', '--chdir', '/',
    '--setenv', 'PATH', '/usr/bin:/bin', '--setenv', 'LANG', 'C', '--setenv', 'LC_ALL', 'C', '--setenv', 'HOME', '/nonexistent',
    '--setenv', 'SUBLIMINE_DEFUSEDXML_INIT', qualified.dependencies.defusedxml.init.path,
    '--setenv', 'SUBLIMINE_DEFUSEDXML_ELEMENT_TREE', qualified.dependencies.defusedxml.elementTree.path,
    '--ro-bind', '/usr', '/usr', '--ro-bind', '/bin', '/bin', '--ro-bind', '/lib', '/lib',
    '--ro-bind', '/lib64', '/lib64', '--proc', '/proc', '--dev', '/dev', '--tmpfs', '/tmp',
    '--dir', '/tool', '--ro-bind', qualified.tools.extractor.path, '/tool/document-extractor.py',
    '--dir', '/output', '--bind', outputPath, '/output',
  ];
  if (mode === 'extract') args.push('--dir', '/input', '--ro-bind', inputPath, '/input/document');
  args.push(
    '--', qualified.sandbox.prlimit.path,
    '--as=' + DOCUMENT_EXTRACTION_RESOURCE_LIMITS.addressSpaceBytes,
    '--cpu=' + DOCUMENT_EXTRACTION_RESOURCE_LIMITS.cpuSeconds,
    '--nproc=' + DOCUMENT_EXTRACTION_RESOURCE_LIMITS.processCount,
    '--fsize=' + DOCUMENT_EXTRACTION_RESOURCE_LIMITS.outputFileBytes,
    '--', qualified.tools.python.path, '-I', '/tool/document-extractor.py', '--mode', mode, '--output', '/output',
  );
  if (mode === 'extract') args.push('--input', '/input/document', '--kind', String(extractionKind).toUpperCase());
  return freeze({command: qualified.sandbox.bwrap.path, args, timeoutMs: DOCUMENT_EXTRACTION_LIMITS.timeoutMs, env: {}, lockHash: qualified.lockHash});
}

/**
 * A minimal isolated parser façade.  Pass `execute` only in tests or an
 * explicit host adapter; it receives a pre-built argv array and cannot turn
 * document text into shell syntax.
 */
export class DocumentExtractionRunner {
  constructor({toolchainLock, scratchRoot = process.env.SUBLIMINE_DOCUMENT_EXTRACTION_RUNTIME_DIR || join(tmpdir(), 'sublimine-document-extraction-v2'), execute = nativeExecute, verifyToolchain = verifyQualifiedDocumentToolchainBinaries} = {}) {
    // Valid locks become a frozen normalized value once, so extraction cannot
    // preflight one mutable object and execute another.  Invalid input remains
    // fail-closed and is translated by `preflight()` into a stable status.
    try { this.toolchainLock = documentToolchainLock(toolchainLock); } catch { this.toolchainLock = toolchainLock; }
    this.scratchRoot = resolve(String(scratchRoot));
    this.execute = execute;
    this.verifyToolchain = verifyToolchain;
  }

  async createScratch() {
    await ensurePrivateDirectory(this.scratchRoot);
    try {
      const scratch = await mkdtemp(join(this.scratchRoot, 'run-'));
      const info = await lstat(scratch);
      if (!info.isDirectory() || info.isSymbolicLink() || info.uid !== process.getuid() || (info.mode & 0o077) !== 0) {
        throw new DocumentExtractionRunnerError('El espacio temporal documental no conserva el perfil privado requerido.', 'DOCUMENT_EXTRACTION_SCRATCH_UNSAFE');
      }
      return scratch;
    } catch (error) {
      if (error instanceof DocumentExtractionRunnerError) throw error;
      throw new DocumentExtractionRunnerError('No se pudo crear el espacio temporal documental.', 'DOCUMENT_EXTRACTION_SCRATCH_UNAVAILABLE');
    }
  }

  async runFixedFixture(lock, scratch, fixture) {
    const inputPath = join(scratch, fixture.filename);
    const outputPath = join(scratch, 'fixture-' + fixture.kind.toLowerCase());
    await ensurePrivateDirectory(outputPath);
    try {
      await writeFile(inputPath, fixture.bytes, {encoding: undefined, mode: 0o600, flag: 'wx'});
    } catch (error) {
      if (error instanceof DocumentExtractionRunnerError) throw error;
      throw new DocumentExtractionRunnerError('No se pudo preparar un fixture documental fijo.', 'DOCUMENT_EXTRACTION_PREFLIGHT_FIXTURE_FAILED');
    }
    const invocation = documentSandboxInvocation(lock, {mode: 'extract', inputPath, outputPath, kind: fixture.kind});
    const result = await this.execute({...invocation, cwd: scratch});
    if (result?.code !== 0 || result?.signal) {
      throw new DocumentExtractionRunnerError('El fixture documental fijo no pudo ejecutarse.', 'DOCUMENT_EXTRACTION_PREFLIGHT_FIXTURE_FAILED');
    }
    await exactOutputEntries(outputPath, ['derived.txt', 'result.json'], 'DOCUMENT_EXTRACTION_PREFLIGHT_FIXTURE_PROTOCOL_INVALID');
    const [derived, resultBytes] = await Promise.all([
      readRegularNoFollow(join(outputPath, 'derived.txt'), {maximumBytes: DOCUMENT_EXTRACTION_LIMITS.maxDerivedBytes, code: 'DOCUMENT_EXTRACTION_PREFLIGHT_FIXTURE_PROTOCOL_INVALID'}),
      readRegularNoFollow(join(outputPath, 'result.json'), {maximumBytes: 64 * 1024, code: 'DOCUMENT_EXTRACTION_PREFLIGHT_FIXTURE_PROTOCOL_INVALID'}),
    ]);
    const parsed = parseExtractionResult(strictJson(resultBytes, 'DOCUMENT_EXTRACTION_PREFLIGHT_FIXTURE_PROTOCOL_INVALID'), fixture.kind, derived);
    if (!UTF8.decode(parsed.derived.content).includes(fixture.expectedText)) {
      throw new DocumentExtractionRunnerError('El fixture documental fijo no produjo el texto esperado.', 'DOCUMENT_EXTRACTION_PREFLIGHT_FIXTURE_PROTOCOL_INVALID');
    }
    return freeze({
      kind: fixture.kind,
      derived: {sha256: parsed.derived.sha256, bytes: parsed.derived.bytes},
      observations: {...parsed.observations},
    });
  }

  async preflight({toolchainLock = this.toolchainLock} = {}) {
    let lock;
    try { lock = requireQualifiedDocumentToolchain(toolchainLock); } catch (error) {
      const code = error instanceof DocumentExtractionContractError ? error.code : 'DOCUMENT_EXTRACTION_TOOLCHAIN_UNAVAILABLE';
      return freeze({schema: DOCUMENT_EXTRACTION_PREFLIGHT_SCHEMA, revision: DOCUMENT_EXTRACTOR_REVISION, state: 'UNAVAILABLE', code});
    }
    try {
      lock = await this.verifyToolchain(lock);
    } catch (error) {
      const code = error instanceof DocumentExtractionRunnerError || error instanceof DocumentExtractionContractError
        ? error.code : 'DOCUMENT_EXTRACTION_TOOLCHAIN_BINARY_INVALID';
      return freeze({schema: DOCUMENT_EXTRACTION_PREFLIGHT_SCHEMA, revision: DOCUMENT_EXTRACTOR_REVISION, state: 'UNAVAILABLE', code});
    }
    let scratch = null;
    try {
      const bindingHash = documentToolchainBindingHash(lock);
      if (lock.sandbox.preflight.bindingHash !== bindingHash) {
        throw new DocumentExtractionRunnerError('El preflight documental no pertenece a la toolchain bloqueada.', 'DOCUMENT_EXTRACTION_PREFLIGHT_BINDING_MISMATCH');
      }
      scratch = await this.createScratch();
      const outputPath = join(scratch, 'output');
      await ensurePrivateDirectory(outputPath);
      const invocation = documentSandboxInvocation(lock, {mode: 'probe', outputPath});
      const result = await this.execute({...invocation, cwd: scratch});
      if (result?.code !== 0 || result?.signal) {
        throw new DocumentExtractionRunnerError('El preflight documental no pudo ejecutar el sandbox.', 'DOCUMENT_EXTRACTION_PREFLIGHT_EXECUTION_FAILED');
      }
      const entries = await readdir(outputPath);
      if (entries.length !== 1 || entries[0] !== 'probe.json') {
        throw new DocumentExtractionRunnerError('El preflight produjo una salida no permitida.', 'DOCUMENT_EXTRACTION_PREFLIGHT_PROTOCOL_INVALID');
      }
      const probeBytes = await readRegularNoFollow(join(outputPath, 'probe.json'), {maximumBytes: 16 * 1024, code: 'DOCUMENT_EXTRACTION_PREFLIGHT_PROTOCOL_INVALID'});
      const assertions = parseProbe(strictJson(probeBytes, 'DOCUMENT_EXTRACTION_PREFLIGHT_PROTOCOL_INVALID'));
      const fixtures = [];
      for (const fixture of PREFLIGHT_FIXTURES) fixtures.push(await this.runFixedFixture(lock, scratch, fixture));
      return freeze({
        schema: DOCUMENT_EXTRACTION_PREFLIGHT_SCHEMA,
        revision: DOCUMENT_EXTRACTOR_REVISION,
        state: 'QUALIFIED',
        at: new Date().toISOString(),
        bindingHash,
        evidenceHash: hashBytes(Buffer.from(canonical({bindingHash, assertions, probeHash: hashBytes(probeBytes), fixtures}))),
      });
    } catch (error) {
      if (error instanceof DocumentExtractionRunnerError) return freeze({schema: DOCUMENT_EXTRACTION_PREFLIGHT_SCHEMA, revision: DOCUMENT_EXTRACTOR_REVISION, state: 'UNAVAILABLE', code: error.code});
      return freeze({schema: DOCUMENT_EXTRACTION_PREFLIGHT_SCHEMA, revision: DOCUMENT_EXTRACTOR_REVISION, state: 'UNAVAILABLE', code: 'DOCUMENT_EXTRACTION_PREFLIGHT_FAILED'});
    } finally {
      if (scratch) await rm(scratch, {recursive: true, force: true}).catch(() => {});
    }
  }

  async extract({kind: inputKind, source, bytes} = {}) {
    const lock = requireQualifiedDocumentToolchain(this.toolchainLock);
    const documentKind = kind(inputKind);
    const sourceRecord = record(source);
    if (!sourceRecord || !hasOnlyKeys(sourceRecord, ['sha256', 'bytes'])
      || !Buffer.isBuffer(bytes) || sourceRecord.bytes !== bytes.length || bytes.length < 1 || bytes.length > DOCUMENT_EXTRACTION_LIMITS.maxSourceBytes
      || hash(sourceRecord.sha256, 'DOCUMENT_EXTRACTION_SOURCE_HASH_INVALID') !== hashBytes(bytes)) {
      throw new DocumentExtractionRunnerError('El snapshot documental no coincide con sus bytes verificados.', 'DOCUMENT_EXTRACTION_SOURCE_SNAPSHOT_INVALID');
    }
    const preflight = await this.preflight({toolchainLock: lock});
    if (preflight.state !== 'QUALIFIED') {
      throw new DocumentExtractionRunnerError('La extracción documental sigue bloqueada: el preflight de aislamiento no está cualificado.', preflight.code || 'DOCUMENT_EXTRACTION_PREFLIGHT_UNAVAILABLE');
    }
    let scratch = null;
    try {
      scratch = await this.createScratch();
      const inputPath = join(scratch, 'input.bin');
      const outputPath = join(scratch, 'output');
      await ensurePrivateDirectory(outputPath);
      await writeFile(inputPath, bytes, {encoding: undefined, mode: 0o600, flag: 'wx'});
      const invocation = documentSandboxInvocation(lock, {mode: 'extract', inputPath, outputPath, kind: documentKind});
      const result = await this.execute({...invocation, cwd: scratch});
      if (result?.code !== 0 || result?.signal) {
        throw new DocumentExtractionRunnerError('El extractor documental no terminó correctamente.', 'DOCUMENT_EXTRACTION_EXECUTION_FAILED');
      }
      await exactOutputEntries(outputPath, ['derived.txt', 'result.json'], 'DOCUMENT_EXTRACTION_RUNNER_PROTOCOL_INVALID');
      const [derived, resultBytes] = await Promise.all([
        readRegularNoFollow(join(outputPath, 'derived.txt'), {maximumBytes: DOCUMENT_EXTRACTION_LIMITS.maxDerivedBytes, code: 'DOCUMENT_EXTRACTION_DERIVED_INVALID'}),
        readRegularNoFollow(join(outputPath, 'result.json'), {maximumBytes: 64 * 1024, code: 'DOCUMENT_EXTRACTION_RUNNER_PROTOCOL_INVALID'}),
      ]);
      const parsed = parseExtractionResult(strictJson(resultBytes, 'DOCUMENT_EXTRACTION_RUNNER_PROTOCOL_INVALID'), documentKind, derived);
      return freeze({...parsed, toolchainLockHash: lock.lockHash, preflight});
    } catch (error) {
      if (error instanceof DocumentExtractionRunnerError || error instanceof DocumentExtractionContractError) throw error;
      throw new DocumentExtractionRunnerError('La extracción documental no pudo completar su entorno privado.', 'DOCUMENT_EXTRACTION_EXECUTION_FAILED');
    } finally {
      if (scratch) await rm(scratch, {recursive: true, force: true}).catch(() => {});
    }
  }
}
