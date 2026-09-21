// A public topology is a read-only, verified view of the *current* installed
// plan.  It intentionally does not reuse the mutable node records as a
// projection source: those records contain leases, run identities, recovery
// history and other control-plane data that do not belong on a read surface.
import {canonical, check, clone, digest, identifier, integer, keys, list, object, sha256, string, unique} from './contracts.mjs';
import {PlanLedger, TOOL_NAMES, validatePlan} from './plans.mjs';
import {assertPlanRoleExecution} from './role-execution.mjs';
import {projectContextDescriptor} from './project-context.mjs';

const UNVERIFIED = () => ({integrity: 'UNVERIFIED', plan: null, nodes: []});

const NODE_STATUSES = new Set([
  'PENDING', 'RUNNING', 'REVIEW_PENDING', 'RETURNED', 'BLOCKED',
  'CANCELLED', 'INVALIDATED', 'ACCEPTED'
]);

const NODE_FIELDS = Object.freeze([
  'missionId', 'nodeId', 'planVersion', 'spec', 'status', 'attempt', 'fence',
  'leaseUntil', 'runId', 'artifactId', 'history', 'engineEpoch', 'recoveryRunId'
]);

const nodeKey = (missionId, nodeId) => `${missionId}:${nodeId}`;

function assertRecord(record, type, recordId) {
  check(record && record.type === type && record.id === recordId, 'PUBLIC_TOPOLOGY_RECORD', 'Topology record identity differs from its storage key');
  integer(record.version, 'topology record version', {min: 1});
  digest(record.hash, 'topology record hash');
  return record;
}

function assertMissionMandate(mission) {
  object(mission, 'mission');
  identifier(mission.id, 'mission ID');
  string(mission.intent, 'mission intent');
  digest(mission.intentHash, 'mission intent hash');
  check(mission.intentHash === sha256(mission.intent), 'PUBLIC_TOPOLOGY_MANDATE', 'Mission intent hash differs from its immutable request');
  object(mission.policy, 'mission policy');
  list(mission.policy.allowedTools, 'mission allowed tools', {max: TOOL_NAMES.length});
  unique(mission.policy.allowedTools, 'mission allowed tools');
  for (const tool of mission.policy.allowedTools) {
    string(tool, 'mission allowed tool');
    check(TOOL_NAMES.includes(tool), 'PUBLIC_TOPOLOGY_POLICY', 'Mission policy contains an unknown tool authority');
  }
}

function assertNodeShape(record, missionId, spec, planVersion) {
  const expectedKey = nodeKey(missionId, spec.id);
  assertRecord(record, 'node', expectedKey);
  keys(record.data, NODE_FIELDS, [
    'missionId', 'nodeId', 'planVersion', 'spec', 'status', 'attempt', 'fence',
    'leaseUntil', 'runId', 'artifactId', 'history'
  ], 'node record');
  const node = record.data;
  check(node.missionId === missionId && node.nodeId === spec.id, 'PUBLIC_TOPOLOGY_NODE', 'Node belongs to another mission or planned node');
  integer(node.planVersion, 'node plan version', {min: 1});
  check(node.planVersion === planVersion, 'PUBLIC_TOPOLOGY_NODE', 'Node belongs to a retired or different plan version');
  check(canonical(node.spec) === canonical(spec), 'PUBLIC_TOPOLOGY_NODE', 'Node specification differs from the independently accepted plan');
  check(NODE_STATUSES.has(node.status), 'PUBLIC_TOPOLOGY_NODE', 'Node has an unknown lifecycle status');
  integer(node.attempt, 'node attempt', {min: 0});
  integer(node.fence, 'node fence', {min: 1});
  check(node.leaseUntil === null || typeof node.leaseUntil === 'string', 'PUBLIC_TOPOLOGY_NODE', 'Node lease has an invalid shape');
  check(node.runId === null || typeof node.runId === 'string', 'PUBLIC_TOPOLOGY_NODE', 'Node run identity has an invalid shape');
  check(node.artifactId === null || typeof node.artifactId === 'string', 'PUBLIC_TOPOLOGY_NODE', 'Node artifact pointer has an invalid shape');
  list(node.history, 'node history', {max: 100000});
  if (Object.hasOwn(node, 'engineEpoch')) integer(node.engineEpoch, 'node engine epoch', {min: 1});
  if (Object.hasOwn(node, 'recoveryRunId')) check(node.recoveryRunId === null || typeof node.recoveryRunId === 'string', 'PUBLIC_TOPOLOGY_NODE', 'Node recovery identity has an invalid shape');
  return node;
}

function projectNode(spec, node) {
  // `spec` comes from the accepted plan body, never `node.spec`; operational
  // metadata is deliberately reduced to its current public lifecycle state.
  return {
    id: spec.id,
    status: node.status,
    artifactId: node.status === 'ACCEPTED' ? node.artifactId : null,
    spec: clone(spec)
  };
}

/**
 * Return the current plan/node topology only when each public field can be
 * traced to the accepted plan and (for accepted nodes) an independently usable
 * product.  This function is a failure-closed read boundary: malformed input,
 * a revoked artifact, a stale plan, or a control-record mismatch always
 * becomes an opaque UNVERIFIED result rather than an exception or raw clone.
 */
export function readVerifiedPublicTopology({store, registry, mission} = {}) {
  try {
    check(store && typeof store.get === 'function', 'PUBLIC_TOPOLOGY_STORE', 'A readable store is required');
    check(registry && registry.store === store && typeof registry.assertUsable === 'function', 'PUBLIC_TOPOLOGY_REGISTRY', 'A same-store artifact registry is required');
    assertMissionMandate(mission);
    const projectContext=projectContextDescriptor(store,mission.id);

    const existingPlan=store.get('plan', mission.id);
    // A mission may legitimately still be awaiting planning. Absence is not a
    // malformed topology, but it also never authorizes enumeration of orphan
    // node rows that happen to name the mission.
    if(!existingPlan)return {integrity:'ABSENT',plan:null,nodes:[]};
    const planRecord = assertRecord(existingPlan, 'plan', mission.id);
    keys(planRecord.data, ['plan', 'intent', 'intentHash', 'acceptedPlanArtifactId'], undefined, 'plan record');
    const stored = planRecord.data;
    string(stored.intent, 'plan intent');
    digest(stored.intentHash, 'plan intent hash');
    identifier(stored.acceptedPlanArtifactId, 'accepted plan artifact ID');
    check(stored.intent === mission.intent && stored.intentHash === mission.intentHash,
      'PUBLIC_TOPOLOGY_MANDATE', 'Plan mandate differs from the mission mandate');
    check(stored.intentHash === sha256(stored.intent), 'PUBLIC_TOPOLOGY_MANDATE', 'Plan intent hash differs from the plan request');

    const ledger = new PlanLedger(store, {registry});
    const acceptedPlan = ledger.acceptedArtifact(stored.acceptedPlanArtifactId, mission.id, 'planning', 'plan');
    check(acceptedPlan?.id === stored.acceptedPlanArtifactId && acceptedPlan.missionId === mission.id,
      'PUBLIC_TOPOLOGY_PLAN_ARTIFACT', 'Accepted plan artifact identity differs from its reference');
    string(acceptedPlan.payload?.body, 'accepted plan body');
    let acceptedBody;
    try { acceptedBody = JSON.parse(acceptedPlan.payload.body); }
    catch { check(false, 'PUBLIC_TOPOLOGY_PLAN_ARTIFACT', 'Accepted plan body is not JSON'); }
    check(canonical(acceptedBody) === canonical(stored.plan), 'PUBLIC_TOPOLOGY_PLAN_ARTIFACT', 'Stored plan differs from the independently accepted plan body');

    const validation = validatePlan(stored.plan, mission.intent, {allowedTools: mission.policy.allowedTools,
      ...(projectContext?{projectContext}:{})});
    assertPlanRoleExecution(stored.plan);
    const specifications = new Map(stored.plan.nodes.map(spec => [spec.id, spec]));
    const nodes = new Map();

    // Read exactly the node keys named by the verified plan.  Retired and
    // unrelated node heads are neither a source of truth nor a public leak.
    for (const spec of stored.plan.nodes) {
      nodes.set(spec.id, assertNodeShape(store.get('node', nodeKey(mission.id, spec.id)), mission.id, spec, planRecord.version));
    }
    // Assert accepted products in dependency order.  This makes every exposed
    // accepted pointer satisfy the frozen criteria/effect/dependency contract.
    const acceptedArtifacts=new Map();
    for (const nodeId of validation.ordering) {
      const node = nodes.get(nodeId);
      if (node.status === 'ACCEPTED') acceptedArtifacts.set(nodeId,ledger.assertProduct({
        missionId: mission.id,
        nodeId,
        spec: specifications.get(nodeId),
        artifactId: node.artifactId
      }));
    }

    return {
      integrity: 'VERIFIED',
      plan: clone(stored.plan),
      nodes: stored.plan.nodes.map(spec => projectNode(spec, nodes.get(spec.id)))
    };
  } catch {
    return UNVERIFIED();
  }
}
