// Audit counterexamples against the original reference. NOT product acceptance tests.
// 'observed' means the deficient behavior exists; it does not mean the control is safe.
import fs from 'node:fs';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { validateLease, authorizeAction, evaluateGate, evaluateEpistemicEligibility, validateContextManifest } from '../../../src/reference/omega-kernel.mjs';
import { scoreRoleCase, aggregateScores } from '../../../src/eval/eval-harness.mjs';

const root = new URL('../../../', import.meta.url);
const json = p => JSON.parse(fs.readFileSync(new URL(p, root), 'utf8'));
const matrix = json('config/authority-actions.json');
const battery = json('tests/omega/eval-battery-v2.json');
const now = new Date('2030-01-01T00:00:00Z');
const lease = {
  lease_id: 'audit-lease', mission_id: 'audit-mission', subject: 'audit-instance', issuer: 'omega_21',
  issued_at: '2029-12-01T00:00:00Z', expires_at: '2030-02-01T00:00:00Z', actions: ['approve'],
  resources: ['decision:one'], tool_profile: [], classification_ceiling: 'PUBLIC',
  budgets: { tokens: 100 }, revocation_triggers: ['MISSION_END'],
  signature: { algorithm: 'not-a-real-algorithm', key_id: 'nonexistent-key', value: 'fabricated-signature' }
};
const authOptions = { now, missionId: lease.mission_id, instanceId: lease.subject };
const results = [];
function probe(id, expectation, actual, deficient) {
  results.push({ id, correctControlWould: expectation, actual, deficientBehaviorObserved: deficient(actual) });
}
probe('forged-signature', 'Validate cryptographic signature and trusted issuer, or reject.', validateLease(lease, now), r => r.ok);
probe('invalid-dates', 'Reject malformed timestamps before temporal comparison.', validateLease({ ...lease, issued_at: 'invalid', expires_at: 'invalid' }, now), r => r.ok);
probe('classification-unknown', 'Reject unknown classification rather than compare undefined.', authorizeAction(matrix, 'omega_01', 'approve', { ...lease, classification_ceiling: 'NOT_A_CLASS' }, { ...authOptions, classification: 'RESTRICTED' }), r => r.effect === 'ALLOW');
probe('missing-actor-attestation', 'Require an actual caller identity separate from lease subject.', authorizeAction(matrix, 'omega_01', 'approve', lease, { now, missionId: lease.mission_id }), r => r.effect === 'ALLOW');
probe('resource-not-in-lease', 'Reject a resource outside the lease.', authorizeAction(matrix, 'omega_01', 'approve', lease, { ...authOptions, resource: 'decision:outside' }), r => r.effect === 'ALLOW');
probe('nonexistent-gate-evidence', 'Resolve evidence, exact target and criterion before accepting PASS.', evaluateGate({ outcome: 'PASS', evidence_refs: ['not-an-existing-artifact'] }), r => r.ok);
probe('uncalibrated-high-confidence', 'Keep confidence qualitative/unassigned without validated calibration.', evaluateEpistemicEligibility({ provenance: true, entailment: 'SUPPORTED', freshness: true, independent_roots: 1, replication: 'NONE', contradiction: 'NONE' }), r => r.state === 'HIGH_CONFIDENCE');
const context = { always_loaded: [], mission_context: [], retrieved_context: [], evidence_context: [], historical_context: [], forbidden_context: ['original conclusion'], blindness: { mode: 'BLIND', hidden_fields: ['conclusion'] }, token_budget: 100, items: [{ trust: 'INTERNAL', purpose: 'EVIDENCE', token_estimate: 10, text: 'Original conclusion: the answer is 42.' }] };
probe('caller-dependent-blinding', 'Use enforced access/context construction, not a caller-supplied leak flag.', validateContextManifest(context), r => r.ok);
const testCase = battery.agents.omega_01.find(c => c.id === 'O01_nonwaivable');
probe('role-grader-reason-code-only', 'Fail a response that executes a forbidden action despite correct reason code.', scoreRoleCase(testCase, { status: 'COMPLETED', reason_codes: [testCase.expected_code], actions: ['PASS_FAILED_GATE'], artifact: null, eval_behaviors: [] }, battery.response_contract), r => r.pass);
probe('incomplete-eval-perfect-rate', 'Report incomplete coverage, not an undifferentiated perfect score.', aggregateScores([{ agent_id: 'omega_01', case_id: 'O01_microdetail', pass: true }]), r => r.rate === 1 && r.total === 1 && !('coverage' in r));
const sourcePaths = ['src/reference/omega-kernel.mjs', 'src/eval/eval-harness.mjs', 'config/authority-actions.json', 'tests/omega/eval-battery-v2.json'];
console.log(JSON.stringify({
  kind: 'AUDIT_COUNTEREXAMPLES_NOT_ACCEPTANCE', sourceRoot: fileURLToPath(root), executedAt: new Date().toISOString(),
  sourceHashes: Object.fromEntries(sourcePaths.map(p => [p, crypto.createHash('sha256').update(fs.readFileSync(new URL(p, root))).digest('hex')])),
  results,
  observed: results.filter(r => r.deficientBehaviorObserved).length,
  total: results.length,
  limits: ['In-memory original reference only; no production exploit, network, real secret or user data used.', 'No new runtime is tested by this audit.', 'A fixed source may stop reproducing a finding; investigate rather than keeping the deficient expectation.']
}, null, 2));
