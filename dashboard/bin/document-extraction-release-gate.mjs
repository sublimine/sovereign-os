#!/usr/bin/env node
/**
 * Non-mutating release gate for Sublimine Document Extraction V2.
 *
 * This is deliberately not an installer.  It derives the only acceptable
 * root-owned release destination from the checked-in extractor, inspects a
 * future installation there, and refuses to publish a lock unless every
 * contract-relevant fact is bound and freshly preflighted from this runtime.
 *
 * The `defusedxml` package is part of the same identity as the executable
 * tools: both imported files are discovered through the isolated interpreter,
 * constrained to the contract's system package locations, hash-locked and
 * rechecked by the runner before its fresh sandbox preflight.
 */
import {constants as FS_CONSTANTS} from 'node:fs';
import {
  chmod,
  lstat,
  open,
  realpath,
  rename,
  rm,
} from 'node:fs/promises';
import {createHash, randomBytes} from 'node:crypto';
import {spawn} from 'node:child_process';
import {basename, dirname, isAbsolute, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

import {
  DOCUMENT_EXTRACTION_REVISION,
  DOCUMENT_EXTRACTION_PREFLIGHT_SCHEMA,
  DOCUMENT_EXTRACTION_TOOLCHAIN_LOCK_SCHEMA,
  DocumentExtractionContractError,
  documentToolchainBindingHash,
  documentToolchainLock,
  requireQualifiedDocumentToolchain,
} from '../document-extraction-contract.mjs';
import {DocumentExtractionRunner} from '../document-extraction-runner.mjs';

const directory = dirname(fileURLToPath(import.meta.url));
const dashboard = join(directory, '..');
const extractorSourcePath = join(dashboard, 'tools', 'document-extractor.py');
const RELEASE_PREFIX = '/opt/sublimine/document-extraction-v2';
const GATE_SCHEMA = 'sublimine-document-extraction-release-gate-v1';
const GATE_REVISION = 1;
const VERSION = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$/;
const O_NOFOLLOW = Number.isInteger(FS_CONSTANTS.O_NOFOLLOW) ? FS_CONSTANTS.O_NOFOLLOW : 0;
const READ_FLAGS = FS_CONSTANTS.O_RDONLY | O_NOFOLLOW;
const WRITE_FLAGS = FS_CONSTANTS.O_WRONLY | FS_CONSTANTS.O_CREAT | FS_CONSTANTS.O_EXCL | O_NOFOLLOW;
const MAX_EXECUTABLE_BYTES = 64 * 1024 * 1024;
const MAX_EXTRACTOR_BYTES = 2 * 1024 * 1024;
const COMMAND_MAX_OUTPUT_BYTES = 32 * 1024;
const COMMAND_TIMEOUT_MS = 5_000;

const FIXED_TOOLS = Object.freeze([
  {name: 'pdfinfo', path: '/usr/bin/pdfinfo', versionArgs: ['-v'], versionPattern: /(?:pdfinfo\s+version\s+|version\s+)([0-9][A-Za-z0-9._:-]*)/i},
  {name: 'pdftotext', path: '/usr/bin/pdftotext', versionArgs: ['-v'], versionPattern: /(?:pdftotext\s+version\s+|version\s+)([0-9][A-Za-z0-9._:-]*)/i},
  {name: 'python', path: '/usr/bin/python3.12', versionArgs: ['--version'], versionPattern: /Python\s+([0-9][A-Za-z0-9._:-]*)/i},
  {name: 'bwrap', path: '/usr/bin/bwrap', versionArgs: ['--version'], versionPattern: /(?:bubblewrap|bwrap)\s+([0-9][A-Za-z0-9._:-]*)/i},
  {name: 'prlimit', path: '/usr/bin/prlimit', versionArgs: ['--version'], versionPattern: /(?:prlimit|util-linux)\s+(?:from\s+)?([0-9][A-Za-z0-9._:-]*)/i},
]);

const DEFUSEDXML_INIT = /^\/usr\/lib\/python3(?:\.\d+)?\/dist-packages\/defusedxml\/__init__\.py$/;
const DEFUSEDXML_ELEMENT_TREE = /^\/usr\/lib\/python3(?:\.\d+)?\/dist-packages\/defusedxml\/ElementTree\.py$/;

export class DocumentExtractionReleaseGateError extends Error {
  constructor(message, code = 'DOCUMENT_EXTRACTION_RELEASE_GATE_FAILED') {
    super(message);
    this.name = 'DocumentExtractionReleaseGateError';
    this.code = code;
  }
}

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function stableJson(value) {
  if (Array.isArray(value)) return '[' + value.map(stableJson).join(',') + ']';
  if (value && typeof value === 'object') {
    return '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + stableJson(value[key])).join(',') + '}';
  }
  return JSON.stringify(value);
}

function result({state, release, blockers = [], write = null, preflight = null, candidateLock = null}) {
  return {
    schema: GATE_SCHEMA,
    revision: GATE_REVISION,
    state,
    release,
    blockers,
    candidateLock,
    preflight,
    write,
  };
}

async function readRegularNoFollow(path, {maximumBytes, owner, label, requireImmutableMode = true, missingCode = 'DOCUMENT_EXTRACTION_RELEASE_MISSING'}) {
  let handle;
  try {
    handle = await open(path, READ_FLAGS);
    const info = await handle.stat();
    if (!info.isFile() || info.isSymbolicLink() || info.size < 1 || info.size > maximumBytes
      || (owner !== undefined && info.uid !== owner) || (requireImmutableMode && (info.mode & 0o022) !== 0)) {
      throw new DocumentExtractionReleaseGateError('El archivo de ' + label + ' no conserva el perfil requerido.', 'DOCUMENT_EXTRACTION_RELEASE_UNTRUSTED');
    }
    const bytes = await handle.readFile();
    return {bytes, sha256: sha256(bytes), size: info.size};
  } catch (error) {
    if (error instanceof DocumentExtractionReleaseGateError) throw error;
    if (error?.code === 'ENOENT') throw new DocumentExtractionReleaseGateError('Falta ' + label + '.', missingCode);
    throw new DocumentExtractionReleaseGateError('No se pudo leer ' + label + ' de forma segura.', 'DOCUMENT_EXTRACTION_RELEASE_UNTRUSTED');
  } finally {
    await handle?.close().catch(() => {});
  }
}

async function assertRootOwnedParents(path, label, missingCode = 'DOCUMENT_EXTRACTION_RELEASE_MISSING') {
  const parts = String(path).split('/').filter(Boolean);
  let current = '';
  for (const part of parts.slice(0, -1)) {
    current += '/' + part;
    let info;
    try {
      info = await lstat(current);
    } catch (error) {
      if (error?.code === 'ENOENT') throw new DocumentExtractionReleaseGateError('Falta la ruta de ' + label + '.', missingCode);
      throw new DocumentExtractionReleaseGateError('No se pudo inspeccionar la ruta de ' + label + '.', 'DOCUMENT_EXTRACTION_RELEASE_UNTRUSTED');
    }
    if (!info.isDirectory() || info.isSymbolicLink() || info.uid !== 0 || (info.mode & 0o022) !== 0) {
      throw new DocumentExtractionReleaseGateError('La ruta de ' + label + ' no es root-owned e inmutable.', 'DOCUMENT_EXTRACTION_RELEASE_UNTRUSTED');
    }
  }
}

async function inspectRootOwnedExecutable(path, label, {maximumBytes = MAX_EXECUTABLE_BYTES, missingCode = 'DOCUMENT_EXTRACTION_RELEASE_MISSING'} = {}) {
  await assertRootOwnedParents(path, label, missingCode);
  return readRegularNoFollow(path, {maximumBytes, owner: 0, label, missingCode});
}

function runFixedCommand(path, args) {
  return new Promise((resolvePromise, reject) => {
    let child;
    let settled = false;
    let timer = null;
    const stdout = [];
    const stderr = [];
    let outputBytes = 0;
    const settle = callback => value => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      callback(value);
    };
    const rejectOnce = settle(reject);
    const resolveOnce = settle(resolvePromise);
    const collect = bucket => chunk => {
      outputBytes += chunk.length;
      if (outputBytes > COMMAND_MAX_OUTPUT_BYTES) {
        child.kill('SIGKILL');
        rejectOnce(new DocumentExtractionReleaseGateError('La comprobación de versión excedió el límite de salida.', 'DOCUMENT_EXTRACTION_TOOL_PROBE_FAILED'));
        return;
      }
      bucket.push(Buffer.from(chunk));
    };
    try {
      child = spawn(path, args, {
        cwd: '/',
        env: {PATH: '/usr/bin:/bin', LANG: 'C', LC_ALL: 'C'},
        shell: false,
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: true,
      });
    } catch {
      rejectOnce(new DocumentExtractionReleaseGateError('No se pudo ejecutar una comprobación de herramienta.', 'DOCUMENT_EXTRACTION_TOOL_PROBE_FAILED'));
      return;
    }
    child.stdout.on('data', collect(stdout));
    child.stderr.on('data', collect(stderr));
    child.on('error', () => rejectOnce(new DocumentExtractionReleaseGateError('No se pudo ejecutar una comprobación de herramienta.', 'DOCUMENT_EXTRACTION_TOOL_PROBE_FAILED')));
    child.on('close', (code, signal) => resolveOnce({
      code,
      signal,
      output: Buffer.concat([...stdout, ...stderr]).toString('utf8'),
    }));
    timer = setTimeout(() => {
      child.kill('SIGKILL');
      rejectOnce(new DocumentExtractionReleaseGateError('La comprobación de versión agotó su tiempo.', 'DOCUMENT_EXTRACTION_TOOL_PROBE_FAILED'));
    }, COMMAND_TIMEOUT_MS);
  });
}

async function inspectFixedTool(specification) {
  const binary = await inspectRootOwnedExecutable(specification.path, specification.name, {missingCode: 'DOCUMENT_EXTRACTION_TOOL_MISSING'});
  const probe = await runFixedCommand(specification.path, specification.versionArgs);
  if (probe.code !== 0 || probe.signal) {
    throw new DocumentExtractionReleaseGateError('La herramienta ' + specification.name + ' no respondió a su comprobación fija.', 'DOCUMENT_EXTRACTION_TOOL_PROBE_FAILED');
  }
  const version = probe.output.match(specification.versionPattern)?.[1] ?? null;
  if (!version || !VERSION.test(version)) {
    throw new DocumentExtractionReleaseGateError('La versión de ' + specification.name + ' no se pudo fijar.', 'DOCUMENT_EXTRACTION_TOOL_VERSION_INVALID');
  }
  return {path: specification.path, sha256: binary.sha256, version};
}

async function inspectDefusedXml(pythonPath) {
  const command = await runFixedCommand(pythonPath, [
    '-I',
    '-c',
    'import defusedxml; from defusedxml import ElementTree; print(defusedxml.__file__); print(ElementTree.__file__); print(getattr(defusedxml, "__version__", "unknown"))',
  ]);
  if (command.code !== 0 || command.signal) {
    throw new DocumentExtractionReleaseGateError('El módulo DOCX requerido no está disponible para el intérprete fijado.', 'DOCUMENT_EXTRACTION_DEPENDENCY_MISSING');
  }
  const entries = command.output.trim().split(/\r?\n/);
  if (entries.length !== 3) {
    throw new DocumentExtractionReleaseGateError('La procedencia de las dependencias XML no se pudo determinar.', 'DOCUMENT_EXTRACTION_DEPENDENCY_PATH_INVALID');
  }
  const [reportedInit, reportedElementTree, version] = entries.map(value => value.trim());
  if (!version || !VERSION.test(version)) {
    throw new DocumentExtractionReleaseGateError('La versión del módulo DOCX no se pudo determinar.', 'DOCUMENT_EXTRACTION_DEPENDENCY_VERSION_INVALID');
  }
  let initPath;
  let elementTreePath;
  try {
    initPath = await realpath(reportedInit);
    elementTreePath = await realpath(reportedElementTree);
  } catch {
    throw new DocumentExtractionReleaseGateError('La ruta de las dependencias XML no se pudo resolver.', 'DOCUMENT_EXTRACTION_DEPENDENCY_PATH_INVALID');
  }
  if (!DEFUSEDXML_INIT.test(initPath) || !DEFUSEDXML_ELEMENT_TREE.test(elementTreePath)
    || initPath !== reportedInit || elementTreePath !== reportedElementTree) {
    throw new DocumentExtractionReleaseGateError('Las dependencias XML no proceden de la ubicación fija del perfil V2.', 'DOCUMENT_EXTRACTION_DEPENDENCY_PATH_INVALID');
  }
  const [init, elementTree] = await Promise.all([
    inspectRootOwnedExecutable(initPath, 'defusedxml.__init__', {maximumBytes: MAX_EXTRACTOR_BYTES, missingCode: 'DOCUMENT_EXTRACTION_DEPENDENCY_MISSING'}),
    inspectRootOwnedExecutable(elementTreePath, 'defusedxml.ElementTree', {maximumBytes: MAX_EXTRACTOR_BYTES, missingCode: 'DOCUMENT_EXTRACTION_DEPENDENCY_MISSING'}),
  ]);
  return {
    init: {path: initPath, sha256: init.sha256, version},
    elementTree: {path: elementTreePath, sha256: elementTree.sha256, version},
  };
}

/**
 * Derive (but never create) the unique root-owned installation destination
 * from the bytes currently tracked in this repository.
 */
export async function deriveDocumentExtractionReleaseTarget({sourcePath = extractorSourcePath} = {}) {
  const resolved = resolve(sourcePath);
  if (resolved !== extractorSourcePath) {
    throw new DocumentExtractionReleaseGateError('El gate sólo acepta el extractor V2 fijado del dashboard.', 'DOCUMENT_EXTRACTION_RELEASE_SOURCE_INVALID');
  }
  const source = await readRegularNoFollow(resolved, {
    maximumBytes: MAX_EXTRACTOR_BYTES,
    owner: process.getuid(),
    label: 'el extractor V2 local',
    // The checked-out source can be group-writable in a collaborative
    // workspace.  It is never executed by this command: its only role is to
    // derive a content-addressed *future* root-owned installation target.
    requireImmutableMode: false,
  });
  const id = source.sha256;
  return {
    id,
    root: RELEASE_PREFIX + '/' + id,
    extractor: RELEASE_PREFIX + '/' + id + '/document-extractor.py',
    sourceSha256: id,
    sourceBytes: source.size,
    installation: 'ROOT_OWNED_REQUIRED',
  };
}

async function inspectInstalledRelease(release) {
  const installed = await inspectRootOwnedExecutable(release.extractor, 'el release del extractor', {maximumBytes: MAX_EXTRACTOR_BYTES});
  if (installed.sha256 !== release.sourceSha256) {
    throw new DocumentExtractionReleaseGateError('El release root-owned no coincide con el extractor auditado.', 'DOCUMENT_EXTRACTION_RELEASE_CONTENT_MISMATCH');
  }
  return {path: release.extractor, sha256: installed.sha256, version: 'document-extractor-v1'};
}

function blocker(code) {
  return {code};
}

function lockWithPreflight({release, extractor, tools, dependencies, preflight, qualifiedAt = preflight.at}) {
  const unsigned = {
    schema: DOCUMENT_EXTRACTION_TOOLCHAIN_LOCK_SCHEMA,
    revision: DOCUMENT_EXTRACTION_REVISION,
    state: 'QUALIFIED',
    qualifiedAt,
    release: {id: release.id, root: release.root},
    tools: {
      pdfinfo: tools.pdfinfo,
      pdftotext: tools.pdftotext,
      python: tools.python,
      extractor,
    },
    dependencies: {defusedxml: dependencies},
    sandbox: {
      kind: 'bwrap-prlimit-v2',
      bwrap: tools.bwrap,
      prlimit: tools.prlimit,
      preflight,
    },
  };
  return {...unsigned, lockHash: sha256(Buffer.from(stableJson(unsigned), 'utf8'))};
}

function transientBootstrapLock({release, extractor, tools, dependencies}) {
  const at = new Date().toISOString();
  // `DocumentExtractionRunner.preflight()` needs a contract-valid lock so it
  // can independently rehash every binary before entering bwrap.  This
  // record is private to this function, never emitted or written, and is
  // replaced by the runner's fresh evidence before a candidate is created.
  const seed = {
    schema: DOCUMENT_EXTRACTION_PREFLIGHT_SCHEMA,
    revision: DOCUMENT_EXTRACTION_REVISION,
    state: 'QUALIFIED',
    at,
    bindingHash: '0'.repeat(64),
    evidenceHash: '0'.repeat(64),
  };
  const preliminary = lockWithPreflight({release, extractor, tools, dependencies, preflight: seed, qualifiedAt: at});
  const bindingHash = documentToolchainBindingHash(preliminary);
  const preflight = {
    ...seed,
    bindingHash,
    // This marker is only a schema bridge to reach a fresh isolated probe; it
    // is intentionally not a claimed observation and can never be published.
    evidenceHash: sha256(Buffer.from('sublimine-document-extraction-bootstrap-v1:' + bindingHash, 'utf8')),
  };
  return documentToolchainLock(lockWithPreflight({release, extractor, tools, dependencies, preflight, qualifiedAt: at}));
}

function finalCandidateLock({release, extractor, tools, dependencies, preflight}) {
  return documentToolchainLock(lockWithPreflight({
    release,
    extractor,
    tools,
    dependencies,
    preflight,
    qualifiedAt: preflight.at,
  }));
}

/**
 * Inspect every prerequisite without writing a release or lock.  A candidate
 * exists only after each contract-bound file is root-owned, content-locked and
 * the existing runner produces fresh in-context isolation evidence.
 */
export async function inspectDocumentExtractionRelease({writeLockPath = null} = {}) {
  const release = await deriveDocumentExtractionReleaseTarget();
  const blockers = [];
  const tools = {};
  let extractor = null;
  let dependencies = null;

  extractor = await inspectInstalledRelease(release).catch(error => {
    blockers.push(blocker(error?.code || 'DOCUMENT_EXTRACTION_RELEASE_UNAVAILABLE'));
    return null;
  });

  for (const specification of FIXED_TOOLS) {
    const observed = await inspectFixedTool(specification).catch(error => {
      blockers.push(blocker(error?.code || 'DOCUMENT_EXTRACTION_TOOL_UNAVAILABLE'));
      return null;
    });
    if (observed) tools[specification.name] = observed;
  }

  if (tools.python) {
    dependencies = await inspectDefusedXml(tools.python.path).catch(error => {
      blockers.push(blocker(error?.code || 'DOCUMENT_EXTRACTION_DEPENDENCY_UNAVAILABLE'));
      return null;
    });
  }

  const requiredToolNames = FIXED_TOOLS.map(specification => specification.name);
  if (!extractor || !dependencies || requiredToolNames.some(name => !tools[name])) {
    const write = writeLockPath === null
      ? {requested: false, state: 'NOT_REQUESTED'}
      : {requested: true, state: 'REFUSED', code: blockers[0]?.code || 'DOCUMENT_EXTRACTION_TOOLCHAIN_UNAVAILABLE'};
    return result({
      state: 'UNAVAILABLE',
      release,
      blockers,
      write,
      candidateLock: null,
      preflight: {
        schema: DOCUMENT_EXTRACTION_PREFLIGHT_SCHEMA,
        revision: DOCUMENT_EXTRACTION_REVISION,
        state: 'NOT_RUN',
        code: 'DOCUMENT_EXTRACTION_TOOLCHAIN_UNAVAILABLE',
      },
    });
  }

  let bootstrap;
  try {
    bootstrap = transientBootstrapLock({release, extractor, tools, dependencies});
  } catch (error) {
    blockers.push(blocker(error?.code || 'DOCUMENT_EXTRACTION_TOOLCHAIN_INVALID'));
    return result({
      state: 'UNAVAILABLE',
      release,
      blockers,
      write: writeLockPath === null ? {requested: false, state: 'NOT_REQUESTED'} : {requested: true, state: 'REFUSED', code: blockers.at(-1).code},
      candidateLock: null,
      preflight: {schema: DOCUMENT_EXTRACTION_PREFLIGHT_SCHEMA, revision: DOCUMENT_EXTRACTION_REVISION, state: 'NOT_RUN', code: blockers.at(-1).code},
    });
  }

  const preflight = await new DocumentExtractionRunner({toolchainLock: bootstrap}).preflight();
  if (preflight.state !== 'QUALIFIED') {
    blockers.push(blocker(preflight.code || 'DOCUMENT_EXTRACTION_PREFLIGHT_UNAVAILABLE'));
    return result({
      state: 'UNAVAILABLE',
      release,
      blockers,
      write: writeLockPath === null ? {requested: false, state: 'NOT_REQUESTED'} : {requested: true, state: 'REFUSED', code: blockers.at(-1).code},
      candidateLock: null,
      preflight,
    });
  }

  let candidate;
  try {
    candidate = finalCandidateLock({release, extractor, tools, dependencies, preflight});
  } catch (error) {
    blockers.push(blocker(error?.code || 'DOCUMENT_EXTRACTION_TOOLCHAIN_INVALID'));
    return result({
      state: 'UNAVAILABLE',
      release,
      blockers,
      write: writeLockPath === null ? {requested: false, state: 'NOT_REQUESTED'} : {requested: true, state: 'REFUSED', code: blockers.at(-1).code},
      candidateLock: null,
      preflight,
    });
  }

  const qualification = result({
    state: 'QUALIFIED',
    release,
    blockers: [],
    write: {requested: false, state: 'NOT_REQUESTED'},
    candidateLock: {lockHash: candidate.lockHash, state: 'QUALIFIED'},
    preflight,
  });
  if (writeLockPath === null) return qualification;
  try {
    const written = await writeQualifiedDocumentToolchainLockAtomically({path: writeLockPath, lock: candidate, qualification});
    return {...qualification, write: {requested: true, state: 'WRITTEN', ...written}};
  } catch (error) {
    return result({
      state: 'UNAVAILABLE',
      release,
      blockers: [blocker(error?.code || 'DOCUMENT_EXTRACTION_LOCK_WRITE_FAILED')],
      write: {requested: true, state: 'REFUSED', code: error?.code || 'DOCUMENT_EXTRACTION_LOCK_WRITE_FAILED'},
      candidateLock: {lockHash: candidate.lockHash, state: 'QUALIFIED'},
      preflight,
    });
  }
}

async function assertSafeLockDestination(path) {
  if (typeof path !== 'string' || !isAbsolute(path)) {
    throw new DocumentExtractionReleaseGateError('La ruta de lock debe ser absoluta y explícita.', 'DOCUMENT_EXTRACTION_LOCK_PATH_INVALID');
  }
  const target = resolve(path);
  if (target !== path || !target.endsWith('.json')) {
    throw new DocumentExtractionReleaseGateError('La ruta de lock no es una ruta JSON canónica.', 'DOCUMENT_EXTRACTION_LOCK_PATH_INVALID');
  }
  const parent = dirname(target);
  let parentInfo;
  try { parentInfo = await lstat(parent); } catch {
    throw new DocumentExtractionReleaseGateError('El directorio del lock no existe.', 'DOCUMENT_EXTRACTION_LOCK_PATH_INVALID');
  }
  if (!parentInfo.isDirectory() || parentInfo.isSymbolicLink() || parentInfo.uid !== process.getuid() || (parentInfo.mode & 0o022) !== 0) {
    throw new DocumentExtractionReleaseGateError('El directorio del lock no conserva el perfil privado requerido.', 'DOCUMENT_EXTRACTION_LOCK_PATH_INVALID');
  }
  try {
    const current = await lstat(target);
    if (!current.isFile() || current.isSymbolicLink() || current.uid !== process.getuid() || current.nlink !== 1 || (current.mode & 0o077) !== 0) {
      throw new DocumentExtractionReleaseGateError('El lock existente no conserva el perfil privado requerido.', 'DOCUMENT_EXTRACTION_LOCK_PATH_INVALID');
    }
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }
  return {target, parent};
}

/**
 * Writer kept separate from qualification.  Callers must pass a fresh
 * qualified gate result and a contract-validated lock; neither exists under
 * the current dependency-binding API, so the CLI below will not invoke it.
 */
export async function writeQualifiedDocumentToolchainLockAtomically({path, lock, qualification} = {}) {
  if (!qualification || qualification.state !== 'QUALIFIED') {
    throw new DocumentExtractionReleaseGateError('No existe una cualificación fresca para publicar el lock.', 'DOCUMENT_EXTRACTION_LOCK_WRITE_REFUSED');
  }
  let qualified;
  try { qualified = requireQualifiedDocumentToolchain(lock); } catch (error) {
    const code = error instanceof DocumentExtractionContractError ? error.code : 'DOCUMENT_EXTRACTION_TOOLCHAIN_INVALID';
    throw new DocumentExtractionReleaseGateError('El lock no está cualificado de forma válida.', code);
  }
  if (qualification.preflight?.state !== 'QUALIFIED'
    || stableJson(qualification.preflight) !== stableJson(qualified.sandbox.preflight)) {
    throw new DocumentExtractionReleaseGateError('El preflight fresco no pertenece al lock a publicar.', 'DOCUMENT_EXTRACTION_LOCK_WRITE_REFUSED');
  }
  const {target, parent} = await assertSafeLockDestination(path);
  const serialized = Buffer.from(JSON.stringify(qualified, null, 2) + '\n', 'utf8');
  const temporary = join(parent, '.' + basename(target) + '.' + randomBytes(16).toString('hex') + '.tmp');
  let handle;
  try {
    handle = await open(temporary, WRITE_FLAGS, 0o600);
    await handle.writeFile(serialized);
    await handle.sync();
    await handle.close();
    handle = null;
    await rename(temporary, target);
    await chmod(target, 0o600);
    return {path: target, lockHash: qualified.lockHash};
  } catch (error) {
    if (error instanceof DocumentExtractionReleaseGateError) throw error;
    throw new DocumentExtractionReleaseGateError('No se pudo publicar el lock de forma atómica.', 'DOCUMENT_EXTRACTION_LOCK_WRITE_FAILED');
  } finally {
    await handle?.close().catch(() => {});
    await rm(temporary, {force: true}).catch(() => {});
  }
}

export function parseReleaseGateArguments(argv) {
  let writeLockPath = null;
  let releaseTargetOnly = false;
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === '--release-target') {
      releaseTargetOnly = true;
      continue;
    }
    if (value === '--write-lock') {
      const next = argv[index + 1];
      if (!next || next.startsWith('--')) {
        throw new DocumentExtractionReleaseGateError('Falta una ruta explícita tras --write-lock.', 'DOCUMENT_EXTRACTION_LOCK_PATH_INVALID');
      }
      writeLockPath = next;
      index += 1;
      continue;
    }
    if (value === '--help' || value === '-h') return {help: true, writeLockPath: null, releaseTargetOnly: false};
    throw new DocumentExtractionReleaseGateError('Argumento no permitido: ' + value, 'DOCUMENT_EXTRACTION_RELEASE_GATE_ARGUMENT_INVALID');
  }
  if (releaseTargetOnly && writeLockPath !== null) {
    throw new DocumentExtractionReleaseGateError('--release-target no puede combinarse con --write-lock.', 'DOCUMENT_EXTRACTION_RELEASE_GATE_ARGUMENT_INVALID');
  }
  return {help: false, writeLockPath, releaseTargetOnly};
}

function usage() {
  return [
    'Uso: node dashboard/bin/document-extraction-release-gate.mjs [--release-target] [--write-lock /ruta/absoluta/lock.json]',
    'No instala paquetes, no crea /opt y no activa extracción automáticamente.',
  ].join('\n');
}

async function main() {
  const options = parseReleaseGateArguments(process.argv.slice(2));
  if (options.help) {
    process.stdout.write(usage() + '\n');
    return 0;
  }
  if (options.releaseTargetOnly) {
    const release = await deriveDocumentExtractionReleaseTarget();
    process.stdout.write(JSON.stringify({schema: GATE_SCHEMA, revision: GATE_REVISION, state: 'PLAN', release, write: {requested: false, state: 'NOT_REQUESTED'}}) + '\n');
    return 0;
  }
  const gate = await inspectDocumentExtractionRelease({writeLockPath: options.writeLockPath});
  process.stdout.write(JSON.stringify(gate) + '\n');
  return gate.state === 'QUALIFIED' ? 0 : 1;
}

const invokedAsScript = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedAsScript) {
  main().then(code => { process.exitCode = code; }).catch(error => {
    process.stdout.write(JSON.stringify({
      schema: GATE_SCHEMA,
      revision: GATE_REVISION,
      state: 'UNAVAILABLE',
      blockers: [{code: error?.code || 'DOCUMENT_EXTRACTION_RELEASE_GATE_FAILED'}],
      candidateLock: null,
      preflight: {schema: DOCUMENT_EXTRACTION_PREFLIGHT_SCHEMA, revision: 1, state: 'NOT_RUN'},
      write: {requested: false, state: 'NOT_REQUESTED'},
    }) + '\n');
    process.exitCode = 1;
  });
}
