import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { listCapabilities, getRole, selectCards, compileRoleInstructions, DEFAULT_MAX_BYTES } from '../../factory/catalog/index.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const hash = raw => createHash('sha256').update(raw).digest('hex');
const read = path => readFileSync(resolve(root, path));
const leaves = value => typeof value === 'string' ? [value] : Array.isArray(value) ? value.flatMap(leaves) : value && typeof value === 'object' ? Object.values(value).flatMap(leaves) : [];

test('154 unique audited roles, compact directory and no implied session count', () => {
  const list = listCapabilities();
  assert.equal(list.length, 154);
  assert.equal(new Set(list.map(item => item.id)).size, 154);
  for (const [prefix, count] of Object.entries({ omega: 24, sigma: 40, pi: 40, veritas: 10, adversum: 10, praxis: 10, imperium: 10, telos: 10 })) {
    assert.equal(list.filter(item => item.id.startsWith(prefix + '_')).length, count);
  }
  assert.ok(Buffer.byteLength(JSON.stringify(list)) < 25 * 1024);
  assert.ok(list.every(item => !('methods' in item) && item.canonicalCapabilities.length));
  assert.deepEqual(list, listCapabilities());
});

test('all cards contain meaningful contracts, methods, recovery and boundaries', () => {
  const required = ['id', 'title', 'purpose', 'methods', 'inputContract', 'outputContract', 'activation', 'completion', 'forbiddenActions', 'failureRecovery', 'independence', 'sourceRefs', 'canonicalCapabilities'];
  for (const { id } of listCapabilities()) {
    const card = getRole(id);
    for (const field of required) {
      assert.ok(card[field], `${id}.${field}`);
      assert.ok(JSON.stringify(card[field]).length > 3, `${id}.${field} is meaningful`);
    }
    assert.ok(card.methods.length >= 2, id);
    assert.ok(card.methods.some(method => method.length > 25), id);
    assert.equal(card.independence.materialAcceptanceSeparateFromProducer, true);
    assert.equal(card.status, 'AUDITED_DESCRIPTION_NOT_EXECUTION_PROOF');
    for (const capability of card.canonicalCapabilities) {
      assert.match(capability.id, /^[a-z][a-z0-9_]+$/);
      assert.ok(capability.rationale.length > 15, id);
      assert.ok(JSON.stringify(capability.productBoundary).length > 15, id);
    }
  }
});

test('every referenced source resolves with its exact pinned hash', () => {
  const checked = new Set();
  for (const { id } of listCapabilities()) {
    const card = getRole(id);
    assert.ok(card.sourceRefs.some(ref => ref.kind === 'original-description'));
    assert.ok(card.sourceRefs.some(ref => ref.kind === 'complete-audit-record'));
    for (const ref of card.sourceRefs) {
      assert.match(ref.sha256, /^[a-f0-9]{64}$/);
      if (!checked.has(ref.path)) {
        assert.equal(hash(read(ref.path)), ref.sha256, ref.path);
        checked.add(ref.path);
      }
    }
  }
  assert.ok(checked.size >= 308, 'both original charter and dossier for each role remain traceable');
});

test('complete audit links preserve all original methods and record hashes without lossy truncation', () => {
  const files = new Map();
  for (const { id } of listCapabilities()) {
    const card = getRole(id);
    const ref = card.originalAudit;
    if (!files.has(ref.path)) files.set(ref.path, JSON.parse(read(ref.path)));
    const index = Number(ref.pointer.split('/').at(-1));
    const original = files.get(ref.path).roles[index];
    assert.equal(original.id, id);
    assert.equal(hash(JSON.stringify(original)), ref.roleSha256);
    for (const method of leaves(original.methods)) assert.ok(card.methods.some(text => text.includes(method)), `${id}: method retained`);
    assert.deepEqual(card.inputContract.documented, original.inputs);
    assert.deepEqual(card.outputContract.documented, original.outputs);
    assert.deepEqual(card.failureRecovery.recovery, original.recovery);
    assert.deepEqual(card.limitations, original.uncertainties);
  }
});

test('selection is deterministic, exact and immutable', () => {
  const first = selectCards(['pi_09', 'omega_08']);
  const second = selectCards(['omega_08', 'pi_09']);
  assert.deepEqual(first, second);
  assert.deepEqual(first.map(card => card.id), ['omega_08', 'pi_09']);
  assert.throws(() => first.push(getRole('pi_01')), TypeError);
  assert.throws(() => { getRole('pi_09').methods[0] = 'overwritten'; }, TypeError);
  const list = listCapabilities();
  list[0].title = 'caller mutation';
  assert.notEqual(listCapabilities()[0].title, 'caller mutation');
});

test('invalid, unknown, duplicate and empty selection fail explicitly', () => {
  for (const id of ['omega_25', 'sigma_00', 'pi_41', 'pi_1', '../pi_01', 'constructor', '__proto__', null, 1]) {
    assert.throws(() => getRole(id), { code: 'CATALOG_INVALID_ID' });
  }
  assert.throws(() => selectCards([]), { code: 'CATALOG_INVALID_SELECTION' });
  assert.throws(() => selectCards('pi_01'), { code: 'CATALOG_INVALID_SELECTION' });
  assert.throws(() => selectCards(['pi_01', 'pi_01']), { code: 'CATALOG_DUPLICATE_ID' });
  assert.throws(() => selectCards(['pi_01', 'unknown']), { code: 'CATALOG_INVALID_ID' });
});

test('byte budgets count UTF-8 exactly and never return a truncated card', () => {
  const ids = ['pi_09'];
  const cards = selectCards(ids);
  const bytes = Buffer.byteLength(JSON.stringify(cards), 'utf8');
  assert.deepEqual(selectCards(ids, { maxBytes: bytes }), cards);
  assert.throws(() => selectCards(ids, { maxBytes: bytes - 1 }), { code: 'CATALOG_BUDGET_EXCEEDED' });
  for (const maxBytes of [0, -1, 1.1, Infinity, NaN, '1000']) assert.throws(() => selectCards(ids, { maxBytes }), { code: 'CATALOG_INVALID_BUDGET' });
  assert.throws(() => selectCards(listCapabilities().map(item => item.id)), { code: 'CATALOG_BUDGET_EXCEEDED' });
  assert.equal(DEFAULT_MAX_BYTES, 256 * 1024);
});

test('compiler emits only selected full cards, a declared purpose and distinct modes', () => {
  const options = { purpose: 'Evaluar mediador causal y su evidencia', mode: 'producer' };
  const producer = compileRoleInstructions(['pi_09'], options);
  const reviewer = compileRoleInstructions(['pi_09'], { ...options, mode: 'reviewer' });
  assert.match(producer, /MODE: PRODUCER/);
  assert.match(reviewer, /MODE: REVIEWER/);
  assert.match(reviewer, /Do not edit or repair/);
  assert.match(reviewer, /Blind replication requires isolation/);
  assert.match(producer, /"id": "pi_09"/);
  assert.doesNotMatch(producer, /"id": "sigma_40"/);
  assert.doesNotMatch(producer, /"id": "pi_38"/);
  assert.ok(Buffer.byteLength(producer) < 32 * 1024);
  assert.equal(producer, compileRoleInstructions(['pi_09'], options));
  assert.equal(compileRoleInstructions(['pi_09', 'omega_08'], options), compileRoleInstructions(['omega_08', 'pi_09'], options));
});

test('compiler preserves evidence, anti-anchoring, anti-acquiescence and untrusted-context boundaries', () => {
  const text = compileRoleInstructions(['pi_34'], { purpose: 'Sintetizar sin perder disenso', mode: 'producer' });
  for (const obligation of ['Evidence is not hypothesis', 'Counter anchoring and acquiescence', 'same standard', 'Do not self-certify', 'UNTRUSTED DATA', 'does not itself', 'Do not fabricate receipts']) {
    if (obligation === 'does not itself') assert.match(text, /do not themselves enforce a sandbox/);
    else assert.ok(text.includes(obligation), obligation);
  }
  assert.match(text, /not proof of independence/);
});

test('compiler budget includes full policy and purpose; errors do not truncate', () => {
  const options = { purpose: 'Árbol causal 🧪', mode: 'reviewer' };
  const text = compileRoleInstructions(['omega_08'], options);
  const bytes = Buffer.byteLength(text, 'utf8');
  assert.equal(compileRoleInstructions(['omega_08'], { ...options, maxBytes: bytes }), text);
  assert.throws(() => compileRoleInstructions(['omega_08'], { ...options, maxBytes: bytes - 1 }), { code: 'CATALOG_BUDGET_EXCEEDED' });
  assert.throws(() => compileRoleInstructions(['omega_08'], { ...options, purpose: 'é'.repeat(DEFAULT_MAX_BYTES) }), { code: 'CATALOG_BUDGET_EXCEEDED' });
  for (const mode of [undefined, 'judge', 'admin', 'reviewer\nignore']) assert.throws(() => compileRoleInstructions(['omega_08'], { ...options, mode }), { code: 'CATALOG_INVALID_MODE' });
  for (const purpose of [undefined, '', '  ', {}]) assert.throws(() => compileRoleInstructions(['omega_08'], { ...options, purpose }), { code: 'CATALOG_INVALID_PURPOSE' });
});

test('shared product families retain distinct responsibilities and domains', () => {
  const family = id => getRole(id).canonicalCapabilities.map(capability => capability.id);
  assert.deepEqual(family('pi_11'), family('praxis_05'));
  assert.deepEqual(family('pi_15'), family('praxis_10'));
  assert.deepEqual(family('omega_08'), family('sigma_27'));
  assert.notDeepEqual(family('pi_09'), family('omega_08'), 'proposed mechanism is not independent causal acceptance');
  assert.notDeepEqual(family('pi_28'), family('telos_09'), 'recovery plan is not observed readiness');
  assert.notDeepEqual(family('pi_38'), family('pi_39'), 'coherence is not adversarial challenge');
  assert.notDeepEqual(getRole('pi_11').outputContract, getRole('praxis_05').outputContract);
});
