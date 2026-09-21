// Mission selection is page-local UI state. A project reload may retain it
// only when the user is still looking at the same project and the refreshed
// project projection still owns that mission. The caller re-reads the detail;
// this helper never permits keeping an old status/report payload.

export function missionSelectionAfterProjectReload({
  preserveMission = false,
  previousProjectId = null,
  projectId = null,
  selectedMissionId = null,
  mappings = [],
} = {}) {
  if (!preserveMission
    || previousProjectId !== projectId
    || typeof selectedMissionId !== 'string'
    || !selectedMissionId
    || !Array.isArray(mappings)) return null;

  return mappings.some(mapping => mapping
    && typeof mapping === 'object'
    && !Array.isArray(mapping)
    && mapping.missionId === selectedMissionId)
    ? selectedMissionId
    : null;
}
