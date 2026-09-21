/**
 * Execution targets intentionally selected by trusted Factory control-plane
 * code. They are not role-card defaults and must not be presented as a
 * fictional per-role routing matrix.
 */

export const FACTORY_DEFAULT_EXECUTION_TARGET = Object.freeze({
  model: 'gpt-6-astra',
  reasoningEffort: 'ultra',
  id: 'factory-mission-default-v1',
});

export const PUBLIC_SOURCE_DISCOVERY_TARGET = Object.freeze({
  model: 'gpt-6-astra',
  reasoningEffort: 'ultra',
  id: 'public-source-discovery-v1',
});

export const LEARNING_CONTROL_PLANE_TARGET = Object.freeze({
  model: 'gpt-6-astra',
  reasoningEffort: 'ultra',
  id: 'learning-control-plane-v1',
});

function publicTarget(target) {
  return {id: target.id, model: target.model, effort: target.reasoningEffort};
}

// This is a public *selection descriptor*, not an execution target.  Public
// source discovery used to have a separately configured target, but new
// missions pass their already-frozen mission target to the discovery worker.
// Keep the old configured target visible only as an explicit compatibility
// fallback for callers that predate frozen mission targets.  In particular,
// do not expose that fallback as proof that current source discovery runs on
// Astra/ultra.
function publicInheritedSourceDiscovery() {
  return {
    id: 'public-source-discovery-v2',
    targetBinding: 'MISSION_FROZEN_TARGET',
    targetSource: 'mission.policy',
    historicalFallback: {
      ...publicTarget(PUBLIC_SOURCE_DISCOVERY_TARGET),
      appliesWhen: 'NO_FROZEN_MISSION_TARGET',
    },
    scope: 'Dedicated public-source discovery inherits the exact model and reasoning effort frozen in the mission policy. The historical fallback is used only when no frozen mission target exists; this descriptor is not a per-run execution receipt.',
  };
}

/**
 * Configuration-level disclosure. It is deliberately not a per-run receipt:
 * a dashboard must not turn a configured target into proof of an execution.
 */
export function executionTargetInventory() {
  return {
    schema: 'sovereign.execution-target-inventory.v2',
    missionDefault: publicTarget(FACTORY_DEFAULT_EXECUTION_TARGET),
    missionRoleRouting: {
      id: 'factory-mission-policy-v2',
      scope: 'Planning, production and review roles receive the model and reasoning effort frozen in their mission policy. That target is not a per-actor execution receipt.',
    },
    inheritedFacilities: [
      publicInheritedSourceDiscovery(),
    ],
    pinnedFacilities: [
      {
        ...publicTarget(LEARNING_CONTROL_PLANE_TARGET),
        scope: 'Bounded learning-control-plane proposal work for explicitly registered learning domains; not ordinary mission production.',
      },
    ],
  };
}
