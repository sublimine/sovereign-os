import test from 'node:test';
import assert from 'node:assert/strict';
import {getRole, listCapabilities, compileRoleInstructions} from '../../factory/catalog/index.mjs';
import {assertRoleExecution, assertPlanRoleExecution, roleExecutionConstraints, listRoleExecutionConstraints} from '../../factory/lib/role-execution.mjs';
import {sha256} from '../../factory/lib/contracts.mjs';

test('known blind-replication facets remain intact but cannot masquerade as ordinary workers', () => {
  const before = new Map(listCapabilities().map(c => [c.id, sha256(getRole(c.id))]));
  const constraints = listRoleExecutionConstraints();
  assert.deepEqual(constraints.map(c => c.roleId), ['omega_07', 'omega_09', 'veritas_04']);
  for (const c of constraints.filter(c=>c.capability==='blind_replication')) {
    assert.deepEqual(c.originalAudit, getRole(c.roleId).originalAudit);
    assert.equal(c.capability, 'blind_replication');
    assert.ok(c.requiredProtocol.includes('sealed-independent-result -> open-original'));
    for (const mode of ['producer', 'reviewer']) {
      assert.throws(() => assertRoleExecution([c.roleId], mode), {code: 'ROLE_EXECUTION_UNSUPPORTED'});
      assert.throws(() => assertRoleExecution(['omega_22', c.roleId], mode), {code: 'ROLE_EXECUTION_UNSUPPORTED'});
      assert.ok(compileRoleInstructions([c.roleId], {purpose: 'Inspect preserved description', mode}).includes(c.roleId));
    }
  }
  // This is a known-incompatibility gate, not proof of other methods.
  for (const c of listCapabilities()) assert.equal(sha256(getRole(c.id)), before.get(c.id));
  assert.deepEqual(roleExecutionConstraints('veritas_07'), []);
  assert.doesNotThrow(() => assertRoleExecution(['veritas_07', 'omega_22'], 'reviewer'));
  assert.throws(() => assertRoleExecution(['made_up'], 'reviewer'), {code: 'CATALOG_INVALID_ID'});
  assert.throws(() => assertRoleExecution(['omega_22'], 'blind'), {code: 'RUN_MODE'});
  assert.throws(() => assertRoleExecution(['omega_22', 'omega_22'], 'reviewer'));
});

test('every planned producer and reviewer binding is checked, not just final or first facet', () => {
  const p = {nodes: [
    {roleIds: ['veritas_07'], reviewerRoleIds: ['omega_22']},
    {roleIds: ['omega_23'], reviewerRoleIds: ['omega_22']},
  ]};
  assert.doesNotThrow(() => assertPlanRoleExecution(p));
  for (const index of [0, 1]) for (const field of ['roleIds', 'reviewerRoleIds']) {
    const bad = structuredClone(p); bad.nodes[index][field].push('veritas_04');
    assert.throws(() => assertPlanRoleExecution(bad), {code: 'ROLE_EXECUTION_UNSUPPORTED'});
  }
});

test('provenance custody cannot be assigned to an ordinary semantic worker without its native seal service', () => {
  const before=sha256(getRole('omega_07'));
  const constraints=roleExecutionConstraints('omega_07');
  assert.equal(constraints.length,1);
  assert.equal(constraints[0].capability,'operational_provenance');
  assert.equal(constraints[0].contractHash,before);
  assert.deepEqual(constraints[0].originalAudit,getRole('omega_07').originalAudit);
  assert.match(constraints[0].requiredProtocol,/ProvenanceSeal/);
  for(const mode of ['producer','reviewer']){
    assert.throws(()=>assertRoleExecution(['omega_07'],mode),{code:'ROLE_EXECUTION_UNSUPPORTED'});
    assert.throws(()=>assertRoleExecution(['omega_11','omega_07'],mode),{code:'ROLE_EXECUTION_UNSUPPORTED'});
    assert.ok(compileRoleInstructions(['omega_07'],{purpose:'Inspect preserved target contract',mode}).includes('ProvenanceSeal'));
  }
  assert.throws(()=>assertPlanRoleExecution({nodes:[{roleIds:['omega_06'],reviewerRoleIds:['omega_07','omega_11']}]}),{code:'ROLE_EXECUTION_UNSUPPORTED'});
  assert.equal(sha256(getRole('omega_07')),before);
});
