import test from 'node:test';
import assert from 'node:assert/strict';
import { CONSOLIDATION_DECISIONS, CONSOLIDATION_LEDGER_SCHEMA, buildConsolidationLedger, verifyConsolidationLedger } from '../../factory/catalog/consolidation-ledger.mjs';
import { listCapabilities } from '../../factory/catalog/index.mjs';

const copy = value => JSON.parse(JSON.stringify(value));

test('consolidation ledger covers every verified card and pinned source without upgrading proposals', () => {
  const ledger = buildConsolidationLedger();
  assert.equal(ledger.schema, CONSOLIDATION_LEDGER_SCHEMA);
  assert.equal(ledger.rows.length, 154);
  assert.deepEqual(ledger.rows.map(row => row.roleId), listCapabilities().map(card => card.id));
  assert.equal(new Set(ledger.rows.map(row => row.roleId)).size, 154);
  assert.ok(ledger.sources.some(source => source.path === 'reconstruction/audit/omega/roles.json'));
  assert.ok(ledger.sources.some(source => source.path === 'reconstruction/design/pi-reconciliation.json'));
  assert.ok(ledger.rows.every(row => CONSOLIDATION_DECISIONS.includes(row.decision)));
  assert.ok(ledger.rows.every(row => row.reason.trim() && row.originEvidence.some(ref => ref.kind === 'complete-audit-record')));
  assert.ok(ledger.rows.every(row => row.destination.kind === 'role' || row.destination.kind === 'facet'));

  const pi = ledger.rows.find(row => row.roleId === 'pi_01');
  assert.equal(pi.decision, 'gap');
  assert.equal(pi.decisionEvidence.classification, 'unapproved-reconciliation');
  assert.match(pi.reason, /PROPOSED_NOT_APPROVED/);
  assert.ok(ledger.rows.some(row => row.decision === 'merge'), 'explicit share-execution recommendations remain visible');
  assert.deepEqual(verifyConsolidationLedger(ledger).roleCount, 154);
});

test('verifier rejects incomplete coverage, unknown targets, empty reasons and ambiguous decisions', () => {
  const ledger = buildConsolidationLedger();

  const incomplete = copy(ledger);
  incomplete.rows.pop();
  assert.throws(() => verifyConsolidationLedger(incomplete), { code: 'LEDGER_COVERAGE' });

  const unknownDestination = copy(ledger);
  unknownDestination.rows[0].destination.id = 'nonexistent_destination';
  assert.throws(() => verifyConsolidationLedger(unknownDestination), { code: 'LEDGER_DESTINATION' });

  const noReason = copy(ledger);
  noReason.rows[0].reason = '   ';
  assert.throws(() => verifyConsolidationLedger(noReason), { code: 'LEDGER_REASON' });

  const ambiguous = copy(ledger);
  ambiguous.rows[0].decision = 'retain-or-merge';
  assert.throws(() => verifyConsolidationLedger(ambiguous), { code: 'LEDGER_DECISION' });
});
