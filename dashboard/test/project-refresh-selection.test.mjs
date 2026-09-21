import assert from 'node:assert/strict';
import test from 'node:test';

import {missionSelectionAfterProjectReload} from '../public/project-refresh-selection.js';

const selectedMissionId = 'mission:9f49ee63-4498-4ae8-96fe-448feef7bb9b';

test('manual project refresh retains only a selected mission still owned by the same project', () => {
  assert.equal(missionSelectionAfterProjectReload({
    preserveMission: true,
    previousProjectId: 'project:alpha',
    projectId: 'project:alpha',
    selectedMissionId,
    mappings: [{missionId: selectedMissionId}, {missionId: 'mission:other'}],
  }), selectedMissionId);
});

test('manual project refresh clears stale, cross-project, and malformed mission selections', () => {
  const shared = {
    preserveMission: true,
    previousProjectId: 'project:alpha',
    projectId: 'project:alpha',
    selectedMissionId,
  };
  assert.equal(missionSelectionAfterProjectReload({...shared, mappings: [{missionId: 'mission:other'}]}), null);
  assert.equal(missionSelectionAfterProjectReload({...shared, previousProjectId: 'project:beta', mappings: [{missionId: selectedMissionId}]}), null);
  assert.equal(missionSelectionAfterProjectReload({...shared, selectedMissionId: '', mappings: [{missionId: selectedMissionId}]}), null);
  assert.equal(missionSelectionAfterProjectReload({...shared, mappings: null}), null);
});
