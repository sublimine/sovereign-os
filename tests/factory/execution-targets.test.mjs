import assert from 'node:assert/strict';
import test from 'node:test';

import {executionTargetInventory} from '../../factory/lib/execution-targets.mjs';

test('public source discovery is described as inheriting the frozen mission target', () => {
  const inventory = executionTargetInventory();
  assert.equal(inventory.schema, 'sovereign.execution-target-inventory.v2');
  assert.equal(inventory.pinnedFacilities.length, 1);
  assert.equal(inventory.pinnedFacilities[0].id, 'learning-control-plane-v1');

  assert.equal(inventory.inheritedFacilities.length, 1);
  const sourceDiscovery = inventory.inheritedFacilities[0];
  assert.equal(sourceDiscovery.id, 'public-source-discovery-v2');
  assert.equal(sourceDiscovery.targetBinding, 'MISSION_FROZEN_TARGET');
  assert.equal(sourceDiscovery.targetSource, 'mission.policy');
  assert.equal(Object.hasOwn(sourceDiscovery, 'model'), false);
  assert.equal(Object.hasOwn(sourceDiscovery, 'effort'), false);
  assert.deepEqual(sourceDiscovery.historicalFallback, {
    id: 'public-source-discovery-v1',
    model: 'gpt-6-astra',
    effort: 'ultra',
    appliesWhen: 'NO_FROZEN_MISSION_TARGET',
  });
  assert.match(sourceDiscovery.scope, /inherits the exact model and reasoning effort frozen in the mission policy/i);
});

test('execution-target inventory returns a fresh public descriptor rather than mutable configuration', () => {
  const first = executionTargetInventory();
  first.inheritedFacilities[0].historicalFallback.model = 'not-a-real-target';
  const next = executionTargetInventory();
  assert.equal(next.inheritedFacilities[0].historicalFallback.model, 'gpt-6-astra');
});
