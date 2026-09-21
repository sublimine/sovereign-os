import test from 'node:test';
import assert from 'node:assert/strict';
import {Authority} from '../../factory/lib/authority.mjs';
import {ArtifactRegistry} from '../../factory/lib/artifacts.mjs';
import {id, sha256} from '../../factory/lib/contracts.mjs';
import {PlanLedger} from '../../factory/lib/plans.mjs';
import {readVerifiedPublicTopology} from '../../factory/lib/public-topology.mjs';
import {Store} from '../../factory/lib/store.mjs';

const intent = 'Build and independently verify the requested result.';
const criteria = [{id: 'verified', text: 'Observe the requested result'}];

function plan() {
  const node = {
    id: 'final', title: 'final', purpose: 'final', roleIds: ['omega_02'], reviewerRoleIds: ['omega_03'],
    requirementIds: ['r1'], dependencies: [], method: {id: 'inspect', rationale: 'Direct inspection', alternatives: ['Independent reconstruction']},
    instructions: 'Follow the frozen request', outputKind: 'answer', criteria, requiredEffects: [], tools: [], specialist: null
  };
  return {
    requirements: [{id: 'r1', text: intent, requestQuote: intent, criteria}], nodes: [node], finalNodeId: 'final',
    routingRationale: 'One causal product is sufficient for this intentionally minimal topology fixture.'
  };
}

function fixture(fn) {
  const store = new Store(':memory:'), authority = new Authority(store), registry = new ArtifactRegistry(store, authority);
  const ledger = new PlanLedger(store, {registry});
  const mission = {id: 'mission:topology', intent, intentHash: sha256(intent), policy: {allowedTools: []}};
  ledger.acquireEngine({ownerId: 'public-topology-test'});
  const run = (nodeId, mode = 'producer', artifactIds = []) => {
    const record = registry.registerRun({missionId: mission.id, nodeId, mode, context: {
      purpose: nodeId, artifactIds, sourceIds: [], instructionsHash: sha256('public topology fixture'), producerConversationIncluded: false
    }});
    registry.attachInference(record.id, {status: 'completed', threadId: id('synthetic-thread'), turnId: id('synthetic-turn')});
    return record.id;
  };
  const create = (nodeId, body, {purpose = nodeId, inputRefs = [], producerRunId = run(nodeId, 'producer', inputRefs.map(ref => ref.artifactId))} = {}) =>
    registry.create({missionId: mission.id, nodeId, producerRunId, kind: 'answer', purpose, body, claims: [], inputRefs, criteria});
  const accept = artifact => registry.review({artifactId: artifact.id, reviewerRunId: run(artifact.payload.nodeId, 'reviewer', [artifact.id]), result: {
    artifactHash: artifact.payloadHash, purpose: artifact.payload.purpose, decision: 'ACCEPT',
    checks: artifact.payload.criteria.map(criterion => ({criterionId: criterion.id, verdict: 'PASS', evidence: [
      {kind: 'artifact', id: artifact.id, hash: artifact.payloadHash, quote: artifact.payload.body}
    ], reason: 'Synthetic exact-body observation; not a semantic quality claim.'})), findings: [], uncertainty: 'Synthetic fixture'
  }});
  const install = (value = plan()) => {
    const accepted = accept(create('planning', JSON.stringify(value), {purpose: 'plan'}));
    ledger.install(mission.id, value, {intent: mission.intent, acceptedPlanArtifactId: accepted.id});
    return accepted;
  };
  const finish = () => {
    const producerRunId = run('final'), lease = ledger.claim(mission.id, 'final', {runId: producerRunId});
    const artifact = accept(create('final', 'Synthetic result', {producerRunId}));
    ledger.transition(mission.id, 'final', {...lease, status: 'REVIEW_PENDING', artifactId: artifact.id});
    ledger.transition(mission.id, 'final', {...lease, status: 'ACCEPTED', artifactId: artifact.id});
    return artifact;
  };
  try { fn({store, registry, ledger, mission, install, finish}); }
  finally { store.close(); }
}

test('verified public topology derives the plan and accepted product from their trusted contracts', () => fixture(({store, registry, mission, install, finish}) => {
  const acceptedPlan = install(), acceptedProduct = finish();
  const topology = readVerifiedPublicTopology({store, registry, mission});
  assert.equal(topology.integrity, 'VERIFIED');
  assert.deepEqual(topology.plan, plan());
  assert.deepEqual(topology.nodes, [{id: 'final', status: 'ACCEPTED', artifactId: acceptedProduct.id, spec: plan().nodes[0]}]);
  assert.notEqual(acceptedPlan.id, acceptedProduct.id);
  assert.doesNotMatch(JSON.stringify(topology), /history|leaseUntil|runId|fence/);
}));

test('forged plan or node heads fail closed and never become a raw public topology', () => fixture(({store, registry, mission, install}) => {
  install();
  const planRecord = store.get('plan', mission.id), forgedPlan = structuredClone(planRecord.data.plan);
  forgedPlan.routingRationale = 'PRIVATE_FORGED_PLAN_SENTINEL';
  store.put('plan', mission.id, {...planRecord.data, plan: forgedPlan}, {expectedVersion: planRecord.version});
  const planResult = readVerifiedPublicTopology({store, registry, mission});
  assert.deepEqual(planResult, {integrity: 'UNVERIFIED', plan: null, nodes: []});
  assert.ok(!JSON.stringify(planResult).includes('PRIVATE_FORGED_PLAN_SENTINEL'));

  const repaired = store.get('plan', mission.id);
  // Restore the accepted body but leave an independently forged node head.
  const acceptedBody = JSON.parse(registry.assertUsable(repaired.data.acceptedPlanArtifactId, {missionId: mission.id, purpose: 'plan'}).payload.body);
  store.put('plan', mission.id, {...repaired.data, plan: acceptedBody}, {expectedVersion: repaired.version});
  const node = store.get('node', `${mission.id}:final`), forgedNode = structuredClone(node.data);
  forgedNode.spec.instructions = 'PRIVATE_FORGED_NODE_SENTINEL';
  store.put('node', node.id, forgedNode, {expectedVersion: node.version});
  const nodeResult = readVerifiedPublicTopology({store, registry, mission});
  assert.deepEqual(nodeResult, {integrity: 'UNVERIFIED', plan: null, nodes: []});
  assert.ok(!JSON.stringify(nodeResult).includes('PRIVATE_FORGED_NODE_SENTINEL'));
}));

test('an ACCEPTED node exposes its pointer only after its exact product still verifies', () => fixture(({store, registry, mission, install, finish}) => {
  const acceptedPlan = install();
  finish();
  const node = store.get('node', `${mission.id}:final`);
  // The plan artifact is genuinely accepted, but it is not this node's exact
  // product.  This catches a pointer substitution that a raw status clone
  // would otherwise publish as an ACCEPTED final node.
  store.put('node', node.id, {...node.data, artifactId: acceptedPlan.id}, {expectedVersion: node.version});
  const topology = readVerifiedPublicTopology({store, registry, mission});
  assert.deepEqual(topology, {integrity: 'UNVERIFIED', plan: null, nodes: []});
  assert.ok(!JSON.stringify(topology).includes(acceptedPlan.id));
}));
