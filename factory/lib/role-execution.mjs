import {getRole, listCapabilities} from '../catalog/index.mjs';
import {check, list, unique, sha256} from './contracts.mjs';
import {validateSpecialistCharter} from './specialist-charter.mjs';
import {blindStage,validateBlindPlan} from './blind-plan.mjs';
import {isInputCopyNode,assertInputCopyNode} from './input-copy-contract.mjs';

// A catalog capability is a preserved specification, not an installed adapter.
// These are known hard incompatibilities, NOT a whitelist certifying all other
// methods. Keep the original cards intact, including unavailable capabilities.
export function roleExecutionConstraints(roleId) {
  const card = getRole(roleId);
  // Audited target omega_07 is an operational custody authority, not a model
  // asked to pronounce a hash plausible. Existing registry checks are narrower
  // than its native closure/seal/replay/notification contract. Do not generalize
  // this finding to every role grouped under the same broad capability label.
  if(card.id==='omega_07')return [{
    roleId:card.id,capability:'operational_provenance',unavailableModes:['producer','reviewer'],
    requiredProtocol:'deterministic graph closure -> integrity and replay checks -> ProvenanceSeal -> transitive invalidation and acknowledgements',
    reason:'Ordinary workers cannot operate the required custody service or issue its exact-graph ProvenanceSeal. Existing record hashes, signatures and acceptance/retraction gates are not the full omega_07 service, replay audit or propagation-acknowledgement protocol. A semantic review or a claimed seal does not implement them.',
    recovery:'Keep existing runtime integrity controls and the independent content review required by the unchanged request. Use compatible review facets for their actual scope, not an omega_07 label. If the user requires this full custody service, preserve the missing capability until an authorized native implementation is verified; a specialist cannot fabricate it.',
    contractHash:sha256(card),originalAudit:card.originalAudit,
  }];
  if (!card.canonicalCapabilities.some(c => c.id === 'blind_replication')) return [];
  return [{
    roleId: card.id, capability: 'blind_replication',
    unavailableModes: ['producer', 'reviewer'],
    requiredProtocol: 'freeze-protocol -> sealed-independent-result -> open-original -> compare-divergence',
    reason: 'Ordinary workers have no enforced sealed-blind-replication adapter. Reviewers receive the candidate before inference; ordinary producers have no registered hidden target, sealing and later unblinding protocol. A fresh thread, node-contract view or manual recalculation does not implement this method.',
    recovery: 'Choose an ordinary independent checking facet only if it satisfies the unchanged request. If blind replication itself is required, retain the missing capability; do not rename, waive or claim it completed.',
    originalAudit: card.originalAudit,
  }];
}

export function listRoleExecutionConstraints() {
  return listCapabilities().flatMap(c => roleExecutionConstraints(c.id));
}

export function assertRoleExecution(roleIds, mode) {
  check(['producer', 'reviewer'].includes(mode), 'RUN_MODE', 'Unknown execution mode');
  list(roleIds, 'role IDs', {min: 1, max: 30}); unique(roleIds);
  for (const roleId of roleIds) for (const constraint of roleExecutionConstraints(roleId)) {
    check(!constraint.unavailableModes.includes(mode), 'ROLE_EXECUTION_UNSUPPORTED',
      `${roleId} cannot run in ordinary ${mode} mode: ${constraint.reason} ${constraint.recovery}`, constraint);
  }
}

// Separate from validatePlan: old plan bodies remain readable and hash-stable.
// Execution admission is checked afresh, never inferred from historical ACCEPT.
export function assertPlanRoleExecution(plan) {
  list(plan.nodes, 'plan nodes', {min: 1, max: 256});
  validateBlindPlan(plan);
  for (const node of plan.nodes) {
    if(isInputCopyNode(node))assertInputCopyNode(node);
    else if(blindStage(node)){ /* Typed controller adapter; never ordinary worker permission. */ }
    else if (Array.isArray(node.roleIds) && node.roleIds.length === 0) validateSpecialistCharter(node.specialist);
    else assertRoleExecution(node.roleIds, 'producer');
    assertRoleExecution(node.reviewerRoleIds, 'reviewer');
  }
}
