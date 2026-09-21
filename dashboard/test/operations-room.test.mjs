import assert from 'node:assert/strict';
import test from 'node:test';

import {publicOperationsProjection} from '../public/operations-room.js';

test('operations projection exposes only its declared public fields', () => {
  const sentinel = 'PRIVATE_OPERATIONS_SENTINEL_DO_NOT_PROJECT';
  const projection = publicOperationsProjection({
    project: {
      id: 'project:public',
      name: 'Espacio de prueba',
      privatePolicy: sentinel,
      ownerCredentials: sentinel,
    },
    runtime: {
      state: 'RUNNING',
      queue: [{
        missionId: 'mission:completed',
        lifecycle: {status: 'COMPLETED', privateReason: sentinel},
        rawProviderRequest: sentinel,
      }],
      privateRuntimeNotes: sentinel,
    },
    mappings: [{
      missionId: 'mission:completed',
      originalIntent: 'Publicar un resultado verificable',
      privatePrompt: sentinel,
      hiddenContext: {value: sentinel},
    }],
    deliverables: [{
      missionId: 'mission:completed',
      deliveryId: 'delivery:public',
      downloadUrl: sentinel,
      vaultReference: sentinel,
    }],
    deliveryReconciliation: {
      mode: 'SERVER_V2_OPT_IN',
      scope: 'NEW_LINKED_CONVERSATIONS_ONLY',
      state: 'CHECKING',
      nextCheckAt: '2026-09-21T12:00:00.000Z',
      privateBackoff: sentinel,
    },
    selectedMission: {
      privateReport: sentinel,
      status: {
        data: {
          mission: {
            id: 'mission:completed',
            status: 'COMPLETED',
            privateChainOfThought: sentinel,
          },
          nodes: [{
            id: 'public-node',
            title: 'Comprobación pública',
            status: 'COMPLETED',
            roles: ['reviewer'],
            dependsOn: [],
            hiddenPrompt: sentinel,
          }],
          rawProviderPayload: sentinel,
        },
      },
    },
  });

  assert.deepEqual(projection, {
    schema: 'sublimine.operations-room-projection.v1',
    project: {id: 'project:public', name: 'Espacio de prueba', runtime: 'RUNNING'},
    reconciliation: {
      mode: 'SERVER_V2_OPT_IN',
      scope: 'NEW_LINKED_CONVERSATIONS_ONLY',
      state: 'CHECKING',
      nextCheckAt: '2026-09-21T12:00:00.000Z',
    },
    totals: {missions: 1, queued: 1, deliveries: 1},
    missions: [{
      id: 'mission:completed',
      position: 0,
      label: 'Misión complete',
      title: 'Publicar un resultado verificable',
      route: 'ADMITTED',
      lifecycle: 'COMPLETED',
      terminal: true,
      delivery: true,
      selected: true,
    }],
    selected: {
      id: 'mission:completed',
      lifecycle: 'COMPLETED',
      nodes: [{
        id: 'public-node',
        title: 'Comprobación pública',
        state: 'COMPLETED',
        roles: ['reviewer'],
        dependencies: [],
      }],
    },
  });
  assert.doesNotMatch(JSON.stringify(projection), new RegExp(sentinel));
});

test('operations projection summarizes mappings and sealed deliverables without inventing a delivery', () => {
  const projection = publicOperationsProjection({
    project: {id: 'project:summary', name: 'Resumen'},
    runtime: {
      state: 'ACTIVE',
      queue: [
        {missionId: 'mission:running', lifecycle: {status: 'RUNNING'}},
        {missionId: 'mission:completed', status: 'COMPLETED'},
      ],
    },
    mappings: [
      {missionId: 'mission:running', originalIntent: 'Primera misión'},
      {missionId: 'mission:completed', originalIntent: 'Segunda misión'},
      {originalIntent: 'Mapa sin misión verificable'},
    ],
    deliverables: [
      {missionId: 'mission:completed'},
      {missionId: 'mission:outside'},
    ],
  });

  assert.deepEqual(projection.totals, {missions: 3, queued: 2, deliveries: 2});
  assert.deepEqual(projection.missions.map(mission => ({
    id: mission.id,
    lifecycle: mission.lifecycle,
    terminal: mission.terminal,
    delivery: mission.delivery,
  })), [
    {id: 'mission:running', lifecycle: 'RUNNING', terminal: false, delivery: false},
    {id: 'mission:completed', lifecycle: 'COMPLETED', terminal: true, delivery: true},
  ]);
  assert.equal(projection.selected, null);
});

test('operations projection names a sourced route from its sealed public contract when its prompt is withheld', () => {
  const projection = publicOperationsProjection({
    project: {id: 'project:sourced', name: 'Fuentes'},
    runtime: {state: 'ACTIVE', queue: [{missionId: 'mission:sourced', status: 'COMPLETED'}]},
    mappings: [{
      missionId: 'mission:sourced',
      entryMode: 'sourced-response-v1',
      routeBinding: {factoryEntryMode: 'sourced-response-v1'},
      privateOriginalPrompt: 'PRIVATE_SOURCE_PROMPT_DO_NOT_RENDER',
    }],
    deliverables: [{missionId: 'mission:sourced'}],
  });
  assert.equal(projection.missions[0].title, 'Respuesta pública con fuentes');
  assert.equal(projection.missions[0].route, 'SOURCED_PUBLIC');
  assert.doesNotMatch(JSON.stringify(projection), /PRIVATE_SOURCE_PROMPT_DO_NOT_RENDER/);
});

test('operations projection uses an in-memory title only after the selected detail authorized it', () => {
  const projection = publicOperationsProjection({
    project: {id: 'project:titles', name: 'Títulos'},
    runtime: {state: 'ACTIVE', queue: [{missionId: 'mission:sourced', status: 'RUNNING'}]},
    mappings: [{
      missionId: 'mission:sourced',
      entryMode: 'sourced-response-v1',
      intentHash: 'a'.repeat(64),
      privateMappingField: 'PRIVATE_MAPPING_DO_NOT_RENDER',
    }],
    titleForMission: missionId => missionId === 'mission:sourced' ? '¿Qué debe mostrar un anuncio de coche?' : null,
  });

  assert.equal(projection.missions[0].title, '¿Qué debe mostrar un anuncio de coche?');
  assert.equal(projection.missions[0].route, 'SOURCED_PUBLIC');
  assert.doesNotMatch(JSON.stringify(projection), /PRIVATE_MAPPING_DO_NOT_RENDER/);
});

test('operations projection retains only the selected public identity while its detail is loading', () => {
  const sentinel = 'PRIVATE_LOADING_DETAIL_DO_NOT_PROJECT';
  const projection = publicOperationsProjection({
    project: {id: 'project:loading', name: 'Lectura'},
    runtime: {state: 'ACTIVE', queue: [{missionId: 'mission:loading', lifecycle: {status: 'RUNNING'}}]},
    mappings: [{missionId: 'mission:loading', privatePrompt: sentinel}],
    selectedMissionId: 'mission:loading',
    selectedMission: {loading: true, missionId: 'mission:loading', privateDetail: sentinel},
  });

  assert.equal(projection.missions[0].selected, true);
  assert.deepEqual(projection.selected, {
    id: 'mission:loading',
    lifecycle: 'RUNNING',
    nodes: [],
    loading: true,
  });
  assert.doesNotMatch(JSON.stringify(projection), new RegExp(sentinel));
});

test('operations projection converts a valid sourced receipt into finite public checkpoints', () => {
  const projection = publicOperationsProjection({
    project: {id: 'project:receipt', name: 'Recibo'},
    selectedMission: {
      status: {
        data: {
          mission: {
            id: 'mission:receipt',
            status: 'COMPLETED',
            sourcedRouteProgress: {
              schema: 'sovereign.sourced-route-progress.v1',
              revision: 1,
              integrity: 'VERIFIED',
              phase: 'ACCEPTED',
              acquisition: {
                search: {used: 0, limit: 0},
                fetch: {used: 3, limit: 3},
                maxSourceBytes: 65536,
                discovery: 'SEALED_DISABLED',
              },
              independentReview: {required: true, state: 'ACCEPTED'},
              verifiedSourceAnchorCount: 3,
              delivery: {availability: 'AVAILABLE'},
              hiddenSourceUrl: 'https://must-not-render.invalid/',
            },
          },
        },
      },
    },
  });
  assert.deepEqual(projection.selected, {
    id: 'mission:receipt',
    lifecycle: 'COMPLETED',
    nodes: [],
    sourcedRoute: {
      phase: 'ACCEPTED',
      integrity: 'VERIFIED',
      fetch: {used: 3, limit: 3},
      anchors: 3,
      review: 'ACCEPTED',
      delivery: 'AVAILABLE',
    },
  });
  assert.doesNotMatch(JSON.stringify(projection), /must-not-render/);
});
