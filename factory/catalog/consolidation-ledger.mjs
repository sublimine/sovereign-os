import { readFileSync, realpathSync } from 'node:fs';
import { dirname, isAbsolute, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ContractError, canonical, check, identifier, keys, list, object, sha256, string, unique } from '../lib/contracts.mjs';
import { getRole, listCapabilities } from './index.mjs';

// This is a derivation, not a new architectural approval.  In particular, a
// reconciliation marked proposed/not-approved remains a GAP instead of being
// silently promoted to a merge or retirement.
export const CONSOLIDATION_LEDGER_SCHEMA = 'sovereign.catalog-consolidation-ledger.v1';
export const CONSOLIDATION_DECISIONS = Object.freeze(['retain', 'merge', 'retire', 'gap']);

const root = realpathSync(resolve(dirname(fileURLToPath(import.meta.url)), '../..'));
const fail = (code, message, details = {}) => { throw new ContractError(code, message, details); };
const plain = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const nonempty = value => typeof value === 'string' && value.trim().length > 0;

function readInside(path) {
  if (typeof path !== 'string' || isAbsolute(path) || path.split('/').includes('..')) fail('LEDGER_SOURCE_PATH', 'source path is invalid', { path });
  const full = realpathSync(resolve(root, path));
  if (!full.startsWith(root + sep)) fail('LEDGER_SOURCE_PATH', 'source path escapes the repository', { path });
  return readFileSync(full);
}

function readPinnedJson(input) {
  const raw = readInside(input.path);
  check(sha256(raw) === input.sha256, 'LEDGER_SOURCE_DRIFT', `Pinned source changed: ${input.path}`);
  try { return JSON.parse(raw); }
  catch { fail('LEDGER_SOURCE_JSON', `Pinned source is not JSON: ${input.path}`); }
}

function readManifest() {
  const raw = readInside('factory/catalog/manifest.json');
  let manifest;
  try { manifest = JSON.parse(raw); }
  catch { fail('LEDGER_MANIFEST', 'Catalog manifest is not JSON'); }
  check(manifest?.version === 1 && Array.isArray(manifest.inputs) && Array.isArray(manifest.roles), 'LEDGER_MANIFEST', 'Catalog manifest is incomplete');
  return { raw, manifest };
}

function text(value) {
  if (typeof value === 'string') return value.trim();
  return '';
}

function dispositionText(record) {
  const disposition = record?.recommendedDisposition;
  if (typeof disposition === 'string') return disposition.trim();
  if (!plain(disposition)) return '';
  const fields = ['action', 'decision', 'status', 'reason', 'rationale', 'justification', 'condition', 'policy', 'meaning'];
  return fields
    .map(field => nonempty(disposition[field]) ? `${field}: ${disposition[field].trim()}` : '')
    .filter(Boolean)
    .join(' | ');
}

function mappingStatus(mapping) {
  if (!plain(mapping)) return '';
  if (nonempty(mapping.status)) return mapping.status.trim();
  if (plain(mapping.canonicalCapability) && nonempty(mapping.canonicalCapability.status)) return mapping.canonicalCapability.status.trim();
  return '';
}

function isUnapproved(value) {
  return /(?:proposal|propos(?:ed|al|to)|not[_ -]?approved|not[_ -]?implemented|pending|pendiente|evaluar)/i.test(value);
}

function classifyDecision(record, mapping, auditPath, pointer) {
  const auditedDisposition = dispositionText(record);
  const status = mappingStatus(mapping);
  if (isUnapproved(status)) {
    const sourceText = [`mapping status: ${status}`, auditedDisposition].filter(Boolean).join(' | ');
    return {
      decision: 'gap',
      classification: 'unapproved-reconciliation',
      sourceText,
      reason: `The reconciliation remains unapproved (${status})${auditedDisposition ? `; audited disposition: ${auditedDisposition}` : ''}.`,
    };
  }
  if (!auditedDisposition) {
    const sourceText = `${auditPath}${pointer}: no recommendedDisposition field`;
    return {
      decision: 'gap',
      classification: 'missing-disposition',
      sourceText,
      reason: `No recommendedDisposition is recorded at ${auditPath}${pointer}.`,
    };
  }
  if (isUnapproved(auditedDisposition)) {
    return {
      decision: 'gap',
      classification: 'unapproved-disposition',
      sourceText: auditedDisposition,
      reason: `The audited disposition is explicitly pending or unapproved: ${auditedDisposition}.`,
    };
  }
  if (/(?:share[- ]?execution|shared[- ]?production|\bmerge\b|consolidat|compart)/i.test(auditedDisposition)) {
    return { decision: 'merge', classification: 'explicit-disposition', sourceText: auditedDisposition, reason: auditedDisposition };
  }
  if (/(?:\bretire\b|retirar|deprecat|eliminar)/i.test(auditedDisposition)) {
    return { decision: 'retire', classification: 'explicit-disposition', sourceText: auditedDisposition, reason: auditedDisposition };
  }
  if (/(?:preserv|conserv|\bretain\b|\bseparate\b|separar)/i.test(auditedDisposition)) {
    return { decision: 'retain', classification: 'explicit-disposition', sourceText: auditedDisposition, reason: auditedDisposition };
  }
  return {
    decision: 'gap',
    classification: 'unsupported-disposition',
    sourceText: auditedDisposition,
    reason: `The audited disposition cannot be normalized without an unsupported inference: ${auditedDisposition}.`,
  };
}

function sourceEvidence(card) {
  // The catalog has already hash-verified every source reference before it
  // exposes a card. Clone it into plain JSON so the ledger is serializable.
  return JSON.parse(JSON.stringify(card.sourceRefs));
}

function loadContext() {
  const { raw: manifestRaw, manifest } = readManifest();
  const inputByPath = new Map();
  for (const input of manifest.inputs) {
    check(plain(input) && nonempty(input.path) && nonempty(input.kind) && /^[a-f0-9]{64}$/.test(input.sha256), 'LEDGER_MANIFEST', 'Catalog input is malformed');
    check(!inputByPath.has(input.path), 'LEDGER_MANIFEST', `Duplicate catalog input: ${input.path}`);
    inputByPath.set(input.path, input);
  }

  const records = new Map();
  for (const input of manifest.inputs.filter(item => item.kind === 'roles')) {
    const parsed = readPinnedJson(input);
    check(Array.isArray(parsed.roles), 'LEDGER_AUDIT', `Role source lacks roles: ${input.path}`);
    for (const [index, record] of parsed.roles.entries()) {
      identifier(record?.id, `${input.path} role id`);
      check(!records.has(record.id), 'LEDGER_AUDIT', `Duplicate role record: ${record.id}`);
      records.set(record.id, { record, input, index });
    }
  }

  const mappings = new Map();
  for (const input of manifest.inputs.filter(item => item.kind === 'pi-mapping' || item.kind === 'sigma-mapping')) {
    const parsed = readPinnedJson(input);
    check(Array.isArray(parsed.mappings), 'LEDGER_MAPPING', `Mapping source lacks mappings: ${input.path}`);
    for (const mapping of parsed.mappings) {
      const roleId = input.kind === 'pi-mapping' ? mapping?.piRole : mapping?.id;
      identifier(roleId, `${input.path} mapping role id`);
      check(!mappings.has(roleId), 'LEDGER_MAPPING', `Duplicate reconciliation mapping: ${roleId}`);
      mappings.set(roleId, { mapping, input });
    }
  }

  // listCapabilities/getRole also pin every original charter/dossier through
  // the catalog. This ledger therefore cannot use a stale audit subset.
  const cards = new Map(listCapabilities().map(({ id }) => [id, getRole(id)]));
  check(cards.size === records.size, 'LEDGER_COVERAGE', 'Catalog cards and audited records differ');
  for (const id of cards.keys()) check(records.has(id), 'LEDGER_COVERAGE', `Catalog card has no audited record: ${id}`);
  for (const id of records.keys()) check(cards.has(id), 'LEDGER_COVERAGE', `Audited record has no catalog card: ${id}`);
  for (const id of cards.keys()) {
    if (id.startsWith('pi_') || id.startsWith('sigma_')) check(mappings.has(id), 'LEDGER_MAPPING', `Mapped role has no reconciliation entry: ${id}`);
  }

  return { manifestRaw, manifest, inputByPath, records, mappings, cards };
}

function rowFor(context, roleId) {
  const card = context.cards.get(roleId);
  const audited = context.records.get(roleId);
  const mapped = context.mappings.get(roleId);
  const sourceAudit = card.originalAudit;
  check(sourceAudit.path === audited.input.path && sourceAudit.pointer === `/roles/${audited.index}` && sourceAudit.roleId === roleId,
    'LEDGER_AUDIT_LINK', `Catalog audit link does not resolve: ${roleId}`);

  const capabilities = card.canonicalCapabilities.map(capability => capability.id);
  let classified = classifyDecision(audited.record, mapped?.mapping, sourceAudit.path, sourceAudit.pointer);
  if (capabilities.length === 0 && classified.decision !== 'retire') {
    classified = {
      decision: 'gap',
      classification: 'missing-capability-destination',
      sourceText: classified.sourceText,
      reason: `${classified.reason} The verified catalog card has no canonical capability destination.`,
    };
  }

  const discardedCapabilities = classified.decision === 'retire' ? capabilities : [];
  const preservedCapabilities = classified.decision === 'retire' ? [] : capabilities;
  const destination = classified.decision === 'merge' && capabilities.length
    ? { kind: 'facet', id: capabilities[0] }
    : { kind: 'role', id: roleId };

  return {
    roleId,
    sourceAudit: JSON.parse(JSON.stringify(sourceAudit)),
    decision: classified.decision,
    reason: classified.reason,
    decisionEvidence: { classification: classified.classification, sourceText: classified.sourceText },
    preservedCapabilities,
    discardedCapabilities,
    destination,
    originEvidence: sourceEvidence(card),
  };
}

function sourceEntries(manifest) {
  return manifest.inputs.map(input => ({ path: input.path, kind: input.kind, sha256: input.sha256 }));
}

/**
 * Returns a JSON-serializable, deterministic R01/R02 consolidation ledger.
 * It deliberately emits GAP where the source only proposes a reconciliation.
 */
export function buildConsolidationLedger() {
  const context = loadContext();
  const ledger = {
    schema: CONSOLIDATION_LEDGER_SCHEMA,
    manifestSha256: sha256(context.manifestRaw),
    sources: sourceEntries(context.manifest),
    rows: [...context.cards.keys()].sort().map(roleId => rowFor(context, roleId)),
  };
  verifyConsolidationLedger(ledger, context);
  return JSON.parse(JSON.stringify(ledger));
}

function validateSourceAudit(value, label) {
  keys(value, ['path', 'sha256', 'pointer', 'roleId', 'roleSha256', 'kind'], undefined, label);
  string(value.path, `${label}.path`);
  check(/^[a-f0-9]{64}$/.test(value.sha256), 'LEDGER_AUDIT_LINK', `${label}.sha256 is invalid`);
  string(value.pointer, `${label}.pointer`);
  identifier(value.roleId, `${label}.roleId`);
  check(/^[a-f0-9]{64}$/.test(value.roleSha256), 'LEDGER_AUDIT_LINK', `${label}.roleSha256 is invalid`);
  check(value.kind === 'complete-audit-record', 'LEDGER_AUDIT_LINK', `${label}.kind is invalid`);
}

function validateOriginEvidence(value, label) {
  list(value, label, { min: 1, max: 100 });
  for (const [index, ref] of value.entries()) {
    object(ref, `${label}[${index}]`);
    string(ref.path, `${label}[${index}].path`);
    check(/^[a-f0-9]{64}$/.test(ref.sha256), 'LEDGER_ORIGIN_EVIDENCE', `${label}[${index}].sha256 is invalid`);
    string(ref.kind, `${label}[${index}].kind`);
  }
}

function validateCapabilities(value, label) {
  list(value, label, { max: 100 });
  for (const [index, capability] of value.entries()) identifier(capability, `${label}[${index}]`);
  unique(value, label);
}

function validateDecisionEvidence(value, decision, label) {
  keys(value, ['classification', 'sourceText'], undefined, label);
  check(['explicit-disposition', 'unapproved-reconciliation', 'missing-disposition', 'unapproved-disposition', 'unsupported-disposition', 'missing-capability-destination'].includes(value.classification),
    'LEDGER_DECISION', `${label}.classification is invalid`);
  string(value.sourceText, `${label}.sourceText`, { min: 1, max: 100000 });
  if (decision === 'gap') check(value.classification !== 'explicit-disposition', 'LEDGER_DECISION', 'A GAP must name an unresolved source condition');
  else check(value.classification === 'explicit-disposition', 'LEDGER_DECISION', 'A retain/merge/retire decision needs an explicit source disposition');
}

function validateDestination(value, roleIds, facetIds, label) {
  keys(value, ['kind', 'id'], undefined, label);
  check(value.kind === 'role' || value.kind === 'facet', 'LEDGER_DESTINATION', `${label}.kind is invalid`);
  identifier(value.id, `${label}.id`);
  const exists = value.kind === 'role' ? roleIds.has(value.id) : facetIds.has(value.id);
  check(exists, 'LEDGER_DESTINATION', `${label} does not exist in the verified catalog`);
}

/**
 * Rejects partial coverage, stale evidence, empty reasons, ambiguous decision
 * values, and destinations that do not exist in the verified catalog.
 */
export function verifyConsolidationLedger(ledger, suppliedContext) {
  keys(ledger, ['schema', 'manifestSha256', 'sources', 'rows'], undefined, 'consolidation ledger');
  check(ledger.schema === CONSOLIDATION_LEDGER_SCHEMA, 'LEDGER_SCHEMA', 'Unsupported consolidation ledger schema');
  check(/^[a-f0-9]{64}$/.test(ledger.manifestSha256), 'LEDGER_MANIFEST', 'Ledger manifest hash is invalid');
  list(ledger.sources, 'ledger.sources', { min: 1, max: 100 });
  list(ledger.rows, 'ledger.rows', { min: 1, max: 1000 });

  const context = suppliedContext ?? loadContext();
  check(ledger.manifestSha256 === sha256(context.manifestRaw), 'LEDGER_SOURCE_DRIFT', 'Ledger was built from a different catalog manifest');
  const expectedSources = sourceEntries(context.manifest);
  check(canonical(ledger.sources) === canonical(expectedSources), 'LEDGER_SOURCE_COVERAGE', 'Ledger does not cover the exact pinned source set');

  const roleIds = new Set(context.cards.keys());
  const facetIds = new Set([...context.cards.values()].flatMap(card => card.canonicalCapabilities.map(capability => capability.id)));
  const seen = new Set();
  for (const [index, row] of ledger.rows.entries()) {
    keys(row, ['roleId', 'sourceAudit', 'decision', 'reason', 'decisionEvidence', 'preservedCapabilities', 'discardedCapabilities', 'destination', 'originEvidence'], undefined, `ledger.rows[${index}]`);
    identifier(row.roleId, `ledger.rows[${index}].roleId`);
    check(roleIds.has(row.roleId) && !seen.has(row.roleId), 'LEDGER_COVERAGE', `Ledger role coverage is invalid: ${row.roleId}`);
    seen.add(row.roleId);
    validateSourceAudit(row.sourceAudit, `ledger.rows[${index}].sourceAudit`);
    check(CONSOLIDATION_DECISIONS.includes(row.decision), 'LEDGER_DECISION', `Ledger decision is ambiguous: ${String(row.decision)}`);
    string(row.reason, `ledger.rows[${index}].reason`, { min: 1, max: 100000 });
    check(row.reason.trim().length > 0, 'LEDGER_REASON', `Ledger reason is empty: ${row.roleId}`);
    validateDecisionEvidence(row.decisionEvidence, row.decision, `ledger.rows[${index}].decisionEvidence`);
    validateCapabilities(row.preservedCapabilities, `ledger.rows[${index}].preservedCapabilities`);
    validateCapabilities(row.discardedCapabilities, `ledger.rows[${index}].discardedCapabilities`);
    check(!row.preservedCapabilities.some(capability => row.discardedCapabilities.includes(capability)), 'LEDGER_CAPABILITY', `Capability is both preserved and discarded: ${row.roleId}`);
    validateDestination(row.destination, roleIds, facetIds, `ledger.rows[${index}].destination`);
    validateOriginEvidence(row.originEvidence, `ledger.rows[${index}].originEvidence`);
  }
  check(seen.size === roleIds.size, 'LEDGER_COVERAGE', 'Ledger coverage is incomplete');

  // Compare to the deterministic derivation after structural checks so callers
  // receive precise errors for malformed submissions instead of a vague drift.
  const expectedRows = [...roleIds].sort().map(roleId => rowFor(context, roleId));
  check(canonical(ledger.rows) === canonical(expectedRows), 'LEDGER_CONTENT_DRIFT', 'Ledger differs from the pinned audit/reconciliation derivation');
  const byDecision = Object.fromEntries(CONSOLIDATION_DECISIONS.map(decision => [decision, ledger.rows.filter(row => row.decision === decision).length]));
  return { roleCount: ledger.rows.length, sourceCount: ledger.sources.length, byDecision };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.stdout.write(`${JSON.stringify(buildConsolidationLedger(), null, 2)}\n`);
}
