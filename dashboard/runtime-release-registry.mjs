/**
 * Trusted release selection for the dashboard-owned project workers.
 *
 * This is deliberately narrower than a package manager or a browser-facing
 * release picker.  The release parent, Node executable, and one default
 * content-addressed release ID are process configuration fixed when the
 * registry is constructed.  A caller can never supply a filesystem path.
 */
import * as fs from 'node:fs';
import {isAbsolute, join, relative, resolve, sep} from 'node:path';

import {verifyRuntimeRelease} from '../factory/lib/runtime-release.mjs';

const RELEASE_ID_PATTERN = /^[a-f0-9]{64}$/;
const RELEASE_CLI_PATH = Object.freeze(['factory', 'bin', 'sovereign.mjs']);

export class RuntimeReleaseRegistryError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'RuntimeReleaseRegistryError';
    this.code = code;
  }
}

function reject(code, message) {
  throw new RuntimeReleaseRegistryError(code, message);
}

function isPlainObject(value) {
  return value !== null
    && typeof value === 'object'
    && !Array.isArray(value)
    && Object.getPrototypeOf(value) === Object.prototype;
}

export function assertRuntimeReleaseId(value, label = 'releaseId') {
  if (typeof value !== 'string' || !RELEASE_ID_PATTERN.test(value)) {
    reject('RUNTIME_RELEASE_ID', `${label} debe ser un identificador SHA-256 de 64 caracteres en minúsculas.`);
  }
  return value;
}

function configuredDirectory(value, label) {
  if (typeof value !== 'string' || !isAbsolute(value) || value.includes('\0')) {
    reject('RUNTIME_RELEASE_CONFIGURATION', `${label} debe ser una ruta absoluta de configuración.`);
  }
  const requested = resolve(value);
  let stat;
  let actual;
  try {
    stat = fs.lstatSync(requested);
    actual = fs.realpathSync(requested);
  } catch {
    reject('RUNTIME_RELEASE_CONFIGURATION', `${label} no está disponible.`);
  }
  if (!stat.isDirectory() || stat.isSymbolicLink()) {
    reject('RUNTIME_RELEASE_CONFIGURATION', `${label} debe ser un directorio real.`);
  }
  return actual;
}

function configuredNodeExecutable(value) {
  if (typeof value !== 'string' || !isAbsolute(value) || value.includes('\0')) {
    reject('RUNTIME_RELEASE_CONFIGURATION', 'El ejecutable Node debe ser una ruta absoluta de configuración.');
  }
  const requested = resolve(value);
  let stat;
  let actual;
  try {
    stat = fs.lstatSync(requested);
    actual = fs.realpathSync(requested);
    fs.accessSync(actual, fs.constants.X_OK);
  } catch {
    reject('RUNTIME_RELEASE_CONFIGURATION', 'El ejecutable Node configurado no está disponible.');
  }
  if (!stat.isFile() && !stat.isSymbolicLink()) {
    reject('RUNTIME_RELEASE_CONFIGURATION', 'El ejecutable Node configurado debe ser un archivo ejecutable.');
  }
  const actualStat = fs.lstatSync(actual);
  if (!actualStat.isFile() || actualStat.isSymbolicLink()) {
    reject('RUNTIME_RELEASE_CONFIGURATION', 'El ejecutable Node configurado debe resolver a un archivo regular.');
  }
  return actual;
}

function assertStableReleaseRoot(root) {
  let stat;
  let actual;
  try {
    stat = fs.lstatSync(root);
    actual = fs.realpathSync(root);
  } catch {
    reject('RUNTIME_RELEASE_ROOT_UNAVAILABLE', 'La raíz de releases configurada ya no está disponible.');
  }
  if (!stat.isDirectory() || stat.isSymbolicLink() || actual !== root) {
    reject('RUNTIME_RELEASE_ROOT_CHANGED', 'La raíz de releases configurada cambió después del arranque.');
  }
}

function childReleasePath(root, releaseId) {
  const candidate = resolve(root, releaseId);
  const rel = relative(root, candidate);
  if (!rel || rel === '..' || rel.startsWith('..' + sep) || isAbsolute(rel)) {
    reject('RUNTIME_RELEASE_PATH', 'La release solicitada queda fuera de la raíz configurada.');
  }
  return candidate;
}

function assertReleaseCli(path) {
  let stat;
  try {
    stat = fs.lstatSync(path);
  } catch {
    reject('RUNTIME_RELEASE_CLI', 'La release verificada no contiene su CLI esperada.');
  }
  if (!stat.isFile() || stat.isSymbolicLink()) {
    reject('RUNTIME_RELEASE_CLI', 'La CLI de la release debe ser un archivo regular.');
  }
}

function configuredReleaseAllowlist(value, defaultReleaseId) {
  if (value === undefined) return Object.freeze([defaultReleaseId]);
  if (!Array.isArray(value) || value.length === 0 || value.length > 256) {
    reject('RUNTIME_RELEASE_CONFIGURATION', 'La lista de releases permitidas debe ser una lista acotada no vacía.');
  }
  const releaseIds = value.map((releaseId, index) => assertRuntimeReleaseId(releaseId, `allowedReleaseIds[${index}]`));
  if (new Set(releaseIds).size !== releaseIds.length) {
    reject('RUNTIME_RELEASE_CONFIGURATION', 'La lista de releases permitidas no puede contener duplicados.');
  }
  if (!releaseIds.includes(defaultReleaseId)) {
    reject('RUNTIME_RELEASE_CONFIGURATION', 'La release por defecto debe pertenecer a la lista de releases permitidas.');
  }
  return Object.freeze([...releaseIds]);
}

/**
 * Registry for a trusted, operator-configured immutable release allowlist.
 *
 * The default is always part of the explicit allowlist.  This preserves a
 * previously pinned project release during a controlled console rollout while
 * still preventing browser-driven discovery of arbitrary snapshots.
 */
export class RuntimeReleaseRegistry {
  constructor({releaseRoot, nodeExecutable, defaultReleaseId, allowedReleaseIds} = {}) {
    this.releaseRoot = configuredDirectory(releaseRoot, 'La raíz de releases');
    this.nodeExecutable = configuredNodeExecutable(nodeExecutable);
    this.defaultReleaseId = assertRuntimeReleaseId(defaultReleaseId, 'defaultReleaseId');
    this.allowedReleaseIds = configuredReleaseAllowlist(allowedReleaseIds, this.defaultReleaseId);
    Object.freeze(this);
  }

  /**
   * Resolve the fixed release into the exact command components needed to run
   * its CLI. `releaseId` is an ID only, never a path, and it must be present
   * in the immutable operator-configured allowlist.
   */
  commandFor(request = {}) {
    if (!isPlainObject(request)) {
      reject('RUNTIME_RELEASE_REQUEST', 'La selección de release debe usar una configuración estructurada.');
    }
    if (Object.keys(request).some(key => key !== 'releaseId')) {
      reject('RUNTIME_RELEASE_REQUEST', 'La selección de release no admite rutas ni campos adicionales.');
    }
    const releaseId = request.releaseId ?? this.defaultReleaseId;
    assertRuntimeReleaseId(releaseId);
    if (!this.allowedReleaseIds.includes(releaseId)) {
      reject('RUNTIME_RELEASE_UNKNOWN', 'La release solicitada no pertenece al registro de despliegue activo.');
    }

    assertStableReleaseRoot(this.releaseRoot);
    const directory = childReleasePath(this.releaseRoot, releaseId);
    // Verification is intentionally repeated for every command construction:
    // a release directory is content-addressed but still lives on a mutable
    // administrator-owned filesystem.
    const verified = verifyRuntimeRelease(directory, releaseId);
    const cli = join(verified.directory, ...RELEASE_CLI_PATH);
    assertReleaseCli(cli);

    return Object.freeze({
      executable: this.nodeExecutable,
      argvPrefix: Object.freeze([cli]),
      cwd: verified.directory,
      releaseId: verified.releaseId,
    });
  }
}

export function createRuntimeReleaseRegistry(configuration) {
  return new RuntimeReleaseRegistry(configuration);
}
