import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {existsSync} from 'node:fs';
import {mkdir, mkdtemp, readFile, rm, writeFile} from 'node:fs/promises';
import {get as httpGet} from 'node:http';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import test from 'node:test';

import {
  assertMissionId,
  assertRoleId,
  createDashboardServer,
  factoryFailure,
  parseFactoryJson,
  startDashboard,
} from '../server.mjs';
import {ProjectSpaceService} from '../project-spaces.mjs';
import {RuntimeReleaseRegistry} from '../runtime-release-registry.mjs';
import {buildRuntimeRelease} from '../../factory/lib/runtime-release.mjs';

const missionId = 'mission:12345678-1234-1234-1234-123456789abc';
const deliveredText = 'Entrega final verificada para la misión de prueba.\n';
const deliveredTextHash = createHash('sha256').update(deliveredText, 'utf8').digest('hex');

function fakeFactory(calls, {legacyContext = false, queueStatus = 'QUEUED', missionStatus = 'QUEUED', queueAttempts = 0} = {}) {
  const legacyIntent = legacyContext
    ? 'Mandato de prueba\n--- SOVEREIGN_PROJECT_CONTEXT_PACK_V1 ---\n{"private":"no debe reaparecer"}\n--- END_SOVEREIGN_PROJECT_CONTEXT_PACK_V1 ---'
    : 'Mandato de prueba';
  return async args => {
    calls.push(args);
    const command = args[0];
    if (command === 'service-status') {
      return {
        unit: 'sovereign-factory.service',
        active: true,
        properties: {MainPID: '42', NRestarts: '0', ActiveState: 'active', SubState: 'running'},
      };
    }
    if (command === 'queue') return [{missionId, status: queueStatus, desired: 'RUN', attempts: queueAttempts, createdAt: '2026-09-20T10:00:00.000Z'}];
    if (command === 'learn-status') return {
      totals: {candidateCount: 0, evaluationCount: 0},
      registration: {domainCount: 0},
      safety: {automaticActivation: false, stateChanges: 0},
      cycleProjection: {integrity: 'NOT_PROJECTED'},
    };
    if (command === 'doctor') return {
      provider: {ready: true, authentication: 'chatgpt', planType: 'pro'},
      models: [
        {id: 'gpt-6-astra', defaultReasoningEffort: 'medium', supportedReasoningEfforts: ['low', 'medium', 'high', 'xhigh', 'max', 'ultra']},
        {id: 'gpt-5.6-terra', defaultReasoningEffort: 'medium', supportedReasoningEfforts: ['low', 'medium', 'high', 'xhigh', 'max', 'ultra']},
        {id: 'gpt-5.6-luna', defaultReasoningEffort: 'medium', supportedReasoningEfforts: ['low', 'medium', 'high', 'xhigh', 'max']},
      ],
      codeRunner: {mode: 'snapshot-discard', reason: 'test'},
    };
    if (command === 'roles' && args.length === 1) {
      return [{id: 'omega_22', title: 'Revisión', canonicalCapabilities: ['independent_review']}];
    }
    if (command === 'roles') {
      return {id: args[1], title: 'Revisión', status: 'active', canonicalCapabilities: ['independent_review']};
    }
    if (command === 'status') {
      return {
        mission: {
          id: missionId,
          intent: legacyIntent,
          status: missionStatus,
          policy: {model: 'gpt-5.6-terra', reasoningEffort: 'high', maxPlanAttempts: 4, maxNodeAttempts: 4},
          history: [{status: missionStatus, at: '2026-09-20T10:00:00.000Z'}],
        },
        plan: {finalNodeId: 'output', nodes: [], requirements: [], routingRationale: 'test'},
        nodes: [],
        outcome: null,
      };
    }
    if (command === 'report') {
      return {
        snapshot: 'test snapshot',
        mission: {id: missionId, intent: legacyIntent, intentHash: 'abc'},
        sources: [],
        reviews: [],
        effects: [],
        metrics: {integrity: 'NOT_ATTESTED'},
        final: null,
      };
    }
    if (command === 'delivery') {
      return {
        schema: 'sovereign.public-text-delivery.v1',
        missionId: args[1],
        status: 'ACCEPTED',
        artifact: {id: 'artifact:accepted-final-test', payloadHash: 'a'.repeat(64)},
        content: {
          mediaType: 'text/plain; charset=utf-8',
          sha256: deliveredTextHash,
          bytes: Buffer.byteLength(deliveredText, 'utf8'),
          body: deliveredText,
        },
      };
    }
    if (command === 'submit') {
      const fileIndex = args.indexOf('--file');
      const manifestIndex = args.indexOf('--inputs');
      const projectContextIndex = args.indexOf('--project-context');
      const assetManifestIndex = args.indexOf('--asset-manifest');
      if (fileIndex >= 0) {
        const mandate = await readFile(args[fileIndex + 1], 'utf8');
        const manifest = manifestIndex >= 0 ? JSON.parse(await readFile(args[manifestIndex + 1], 'utf8')) : [];
        const inputs = await Promise.all(manifest.map(async entry => ({
          path: entry.path,
          content: await readFile(entry.source, 'utf8'),
        })));
        const projectContext = projectContextIndex >= 0
          ? JSON.parse(await readFile(args[projectContextIndex + 1], 'utf8'))
          : null;
        const assetManifest = assetManifestIndex >= 0
          ? JSON.parse(await readFile(args[assetManifestIndex + 1], 'utf8'))
          : null;
        calls.mandates ??= [];
        calls.mandates.push({args: [...args], mandate, inputManifest: manifest, inputs, projectContext, assetManifest});
      }
      return {missionId, status: 'QUEUED', desired: 'RUN'};
    }
    if (['pause', 'continue', 'cancel', 'retry-review'].includes(command)) return {missionId, status: 'PAUSED'};
    throw new Error('Unexpected factory command: ' + args.join(' '));
  };
}

async function withServer(callback, {
  legacyContext = false,
  deliveryReconciliationInitialDelayMs = undefined,
  documentExtractionRunner = null,
  projectSpaces: suppliedProjectSpaces = null,
  ...factoryOptions
} = {}) {
  const calls = [];
  const stateDirectory = await mkdtemp(join(tmpdir(), 'sovereign-console-test-'));
  const projectSpaces = suppliedProjectSpaces ?? new ProjectSpaceService({
    rootDir: join(stateDirectory, 'portfolio'),
    documentExtractionRunner,
  });
  const server = createDashboardServer({
    factoryRunner: fakeFactory(calls, {legacyContext, ...factoryOptions}),
    consoleStateDir: stateDirectory,
    projectSpaces,
    uiToken: 'test-ui-token',
    ...(deliveryReconciliationInitialDelayMs === undefined ? {} : {deliveryReconciliationInitialDelayMs}),
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  await server.ready;
  const {port} = server.address();
  const origin = 'http://127.0.0.1:' + port;
  try {
    await callback({calls, origin, projectSpaces});
  } finally {
    await server.shutdown();
    await server.waitForDeliveryReconcilerIdle();
    await rm(stateDirectory, {recursive: true, force: true});
  }
}

async function eventually(read, {timeoutMs = 1_500, intervalMs = 15} = {}) {
  const deadline = Date.now() + timeoutMs;
  let last = null;
  while (Date.now() < deadline) {
    last = await read();
    if (last) return last;
    await new Promise(resolve => setTimeout(resolve, intervalMs));
  }
  assert.fail('La condición asíncrona no se confirmó a tiempo. Último valor: ' + String(last));
}

function pinnedReleaseCliFixture(tracePath) {
  // This snapshot is deliberately tiny: it is not a replacement Factory, but
  // a forensic test double whose immutable CLI proves which command path the
  // dashboard actually selected.  The trace lives outside the snapshot so
  // changing it cannot alter the release identity after it has been built.
  return [
    "import {appendFileSync} from 'node:fs';",
    `const tracePath = ${JSON.stringify(tracePath)};`,
    "const [command, ...args] = process.argv.slice(2);",
    "appendFileSync(tracePath, JSON.stringify({command, args, executable: process.argv[0]}) + '\\n', {encoding: 'utf8', mode: 0o600});",
    "const respond = value => process.stdout.write(JSON.stringify(value));",
    "if (command === 'doctor') {",
    "  respond({provider: {ready: true, authentication: 'test', planType: 'test'}, models: [{id: 'gpt-6-astra', defaultReasoningEffort: 'ultra', supportedReasoningEfforts: ['low', 'medium', 'high', 'xhigh', 'max', 'ultra']}], codeRunner: {mode: 'snapshot-discard', reason: 'release-test'}});",
    "} else if (command === 'submit') {",
    `  respond({missionId: ${JSON.stringify(missionId)}, status: 'QUEUED', desired: 'RUN'});`,
    "} else {",
    "  process.stderr.write('unexpected release command');",
    "  process.exitCode = 1;",
    "}",
    '',
  ].join('\n');
}

test('strict parsing and identifiers reject ambiguous input', () => {
  assert.deepEqual(parseFactoryJson('\nnoise\n{"ok":true}\n'), {ok: true});
  assert.throws(() => parseFactoryJson('not json'), /JSON/);
  assert.equal(assertMissionId(missionId), missionId);
  assert.throws(() => assertMissionId('mission:anything'), /no es válido/);
  assert.equal(assertRoleId('omega_22'), 'omega_22');
  assert.throws(() => assertRoleId('../../etc/passwd'), /no es válido/);
});

test('factory subprocess diagnostics do not become browser error text', () => {
  const error = factoryFailure('FACTORY_COMMAND_FAILED', '/private/project/context.json sha256=secret');
  assert.equal(error.code, 'FACTORY_COMMAND_FAILED');
  assert.equal(error.message.includes('/private/project/context.json'), false);
  assert.equal(error.message.includes('secret'), false);
});

test('dashboard shutdown closes SSE idempotently without touching project workers', async () => {
  const calls = [];
  const stateDirectory = await mkdtemp(join(tmpdir(), 'sublimine-console-shutdown-'));
  let projectSupervisorCalls = 0;
  const projectRuntimeSupervisor = {
    async status() {
      projectSupervisorCalls += 1;
      return {available: false, active: false, state: 'NOT_STARTED', unit: null, properties: {}};
    },
    async start() {
      projectSupervisorCalls += 1;
      return {available: false, active: false, state: 'NOT_STARTED', unit: null, properties: {}};
    },
  };
  const server = createDashboardServer({
    factoryRunner: fakeFactory(calls),
    consoleStateDir: stateDirectory,
    projectRuntimeSupervisor,
    uiToken: 'shutdown-test-token',
  });
  let response;
  let closed = false;
  try {
    await server.ready;
    await new Promise((resolve, reject) => {
      server.once('error', reject);
      server.listen(0, '127.0.0.1', resolve);
    });
    const {port} = server.address();
    response = await new Promise((resolve, reject) => {
      const request = httpGet({host: '127.0.0.1', port, path: '/api/stream'}, resolve);
      request.once('error', reject);
    });
    const streamEnded = new Promise((resolve, reject) => {
      response.once('end', resolve);
      response.once('error', reject);
    });
    response.resume();

    const firstShutdown = server.shutdown();
    assert.equal(server.shutdown(), firstShutdown, 'shutdown must be idempotent while it is in progress');
    const result = await Promise.race([
      firstShutdown.then(() => 'closed'),
      new Promise(resolve => setTimeout(() => resolve('timeout'), 1_000)),
    ]);
    assert.equal(result, 'closed', 'an active EventSource must not hold shutdown open');
    await streamEnded;
    closed = true;
    assert.equal(projectSupervisorCalls, 0, 'console shutdown must not query or signal project workers');
  } finally {
    if (!closed) response?.destroy();
    await server.shutdown().catch(() => {});
    await rm(stateDirectory, {recursive: true, force: true});
  }
});

test('a fresh project pins its trusted release only at admission while an existing runtime stays legacy', async t => {
  const stateDirectory = await mkdtemp(join(tmpdir(), 'sublimine-release-admission-'));
  const releaseRoot = join(stateDirectory, 'releases');
  const releaseTracePath = join(stateDirectory, 'pinned-release.ndjson');
  const built = buildRuntimeRelease(releaseRoot, {
    files: [{
      path: 'factory/bin/sovereign.mjs',
      content: pinnedReleaseCliFixture(releaseTracePath),
    }],
  });
  const registry = new RuntimeReleaseRegistry({
    releaseRoot,
    nodeExecutable: process.execPath,
    defaultReleaseId: built.releaseId,
  });
  const globalCalls = [];
  const supervisorCalls = [];
  const projectRuntimeSupervisor = {
    async status({projectId}) {
      supervisorCalls.push({kind: 'status', projectId});
      return {available: false, active: false, state: 'NOT_STARTED', unit: null, properties: {}};
    },
    async start(request) {
      supervisorCalls.push({kind: 'start', ...request});
      return {
        available: false,
        active: false,
        state: 'NOT_SUPERVISED',
        unit: 'test-' + request.projectId.replace(/[^a-z0-9]/giu, '-'),
        started: false,
      };
    },
  };
  const projectSpaces = new ProjectSpaceService({rootDir: join(stateDirectory, 'portfolio')});
  const server = createDashboardServer({
    factoryRunner: fakeFactory(globalCalls),
    consoleStateDir: stateDirectory,
    projectSpaces,
    projectReleaseRegistry: registry,
    projectRuntimeSupervisor,
    uiToken: 'release-admission-token',
  });
  let listening = false;
  try {
    await server.ready;
    await new Promise((resolve, reject) => {
      server.once('error', reject);
      server.listen(0, '127.0.0.1', resolve);
    });
    listening = true;
    const origin = 'http://127.0.0.1:' + server.address().port;
    const headers = {
      'content-type': 'application/json',
      'x-sovereign-ui-token': 'release-admission-token',
      origin,
      'sec-fetch-site': 'same-origin',
    };

    const freshCreated = await fetch(origin + '/api/projects', {
      method: 'POST', headers,
      body: JSON.stringify({name: 'Proyecto release nueva'}),
    });
    assert.equal(freshCreated.status, 201);
    const fresh = (await freshCreated.json()).project;
    const freshBeforeRead = await projectSpaces.runtimeConfig(fresh.id);
    assert.equal(freshBeforeRead.runtimeReleaseId, null);
    assert.equal(freshBeforeRead.runtimeMode, 'LEGACY_GLOBAL_WRAPPER');
    assert.equal(existsSync(projectSpaces.projectPaths(fresh.id).runtimeReleaseBinding), false);

    // A normal project overview is intentionally a read-only operation. It
    // may inspect the provisioned queue but cannot create a private runtime
    // binding merely because somebody opened the project in the browser.
    const freshOverview = await fetch(origin + '/api/projects/' + encodeURIComponent(fresh.id));
    assert.equal(freshOverview.status, 200);
    const freshOverviewPayload = await freshOverview.json();
    assert.equal(JSON.stringify(freshOverviewPayload).includes(built.releaseId), false);
    assert.equal((await projectSpaces.runtimeConfig(fresh.id)).runtimeReleaseId, null);
    assert.equal(existsSync(projectSpaces.projectPaths(fresh.id).runtimeReleaseBinding), false);
    assert.equal(globalCalls.some(args => args[0] === 'doctor' || args[0] === 'submit'), false);

    const freshSubmitted = await fetch(origin + '/api/projects/' + encodeURIComponent(fresh.id) + '/missions', {
      method: 'POST', headers,
      body: JSON.stringify({
        requestId: 'submission:11111111-1111-4111-8111-111111111111',
        text: 'Diseña una estrategia operativa interna con criterios verificables.',
        entryMode: 'planned',
        preset: 'adaptive-v2',
      }),
    });
    assert.equal(freshSubmitted.status, 202);
    const freshSubmission = await freshSubmitted.json();
    assert.equal(JSON.stringify(freshSubmission).includes(built.releaseId), false, 'the browser must not learn the private runtime release identity');

    const freshAfterAdmission = await projectSpaces.runtimeConfig(fresh.id);
    assert.equal(freshAfterAdmission.runtimeReleaseId, built.releaseId);
    assert.equal(freshAfterAdmission.runtimeMode, 'PINNED');
    assert.equal(existsSync(projectSpaces.projectPaths(fresh.id).runtimeReleaseBinding), true);
    assert.equal(globalCalls.some(args => args[0] === 'doctor' || args[0] === 'submit'), false, 'new-project admission must not fall through to the mutable global runner');

    const releaseInvocations = (await readFile(releaseTracePath, 'utf8')).trim().split('\n').filter(Boolean).map(line => JSON.parse(line));
    assert.equal(releaseInvocations.some(call => call.command === 'doctor'), true, 'policy verification must run through the pinned release CLI');
    const releaseSubmit = releaseInvocations.find(call => call.command === 'submit');
    assert.ok(releaseSubmit, 'mission submission must run through the pinned release CLI');
    assert.equal(releaseSubmit.args.includes('--state-dir'), true);
    assert.equal(releaseSubmit.args.includes(freshAfterAdmission.stateDir), true);
    assert.equal(supervisorCalls.some(call => call.kind === 'start' && call.projectId === fresh.id && call.releaseId === built.releaseId), true, 'the project supervisor receives only the pinned release identifier');

    // Mark a second project as pre-existing before its first mission. The
    // new-release policy must not silently migrate it: it keeps the historic
    // global wrapper until an explicit migration mechanism exists.
    const legacyCreated = await fetch(origin + '/api/projects', {
      method: 'POST', headers,
      body: JSON.stringify({name: 'Proyecto runtime histórico'}),
    });
    assert.equal(legacyCreated.status, 201);
    const legacy = (await legacyCreated.json()).project;
    const legacyBefore = await projectSpaces.runtimeConfig(legacy.id);
    await mkdir(legacyBefore.stateDir, {recursive: true, mode: 0o700});
    await writeFile(join(legacyBefore.stateDir, 'state.sqlite'), 'legacy-state', {encoding: 'utf8', mode: 0o600});

    const legacyOverview = await fetch(origin + '/api/projects/' + encodeURIComponent(legacy.id));
    assert.equal(legacyOverview.status, 200);
    assert.equal((await projectSpaces.runtimeConfig(legacy.id)).runtimeReleaseId, null);
    assert.equal(existsSync(projectSpaces.projectPaths(legacy.id).runtimeReleaseBinding), false);
    const releaseInvocationCount = releaseInvocations.length;

    const legacySubmitted = await fetch(origin + '/api/projects/' + encodeURIComponent(legacy.id) + '/missions', {
      method: 'POST', headers,
      body: JSON.stringify({
        requestId: 'submission:22222222-2222-4222-8222-222222222222',
        text: 'Diseña una estrategia operativa interna para el historial existente.',
        entryMode: 'planned',
        preset: 'adaptive-v2',
      }),
    });
    assert.equal(legacySubmitted.status, 202);
    const legacyAfterAdmission = await projectSpaces.runtimeConfig(legacy.id);
    assert.equal(legacyAfterAdmission.runtimeReleaseId, null);
    assert.equal(legacyAfterAdmission.runtimeMode, 'LEGACY_GLOBAL_WRAPPER');
    assert.equal(existsSync(projectSpaces.projectPaths(legacy.id).runtimeReleaseBinding), false);
    assert.equal(globalCalls.some(args => args[0] === 'doctor'), true, 'legacy policy verification must preserve the global runner');
    assert.equal(globalCalls.some(args => args[0] === 'submit'), true, 'legacy mission submission must preserve the global runner');
    const releaseInvocationsAfterLegacy = (await readFile(releaseTracePath, 'utf8')).trim().split('\n').filter(Boolean).map(line => JSON.parse(line));
    assert.equal(releaseInvocationsAfterLegacy.length, releaseInvocationCount, 'legacy admission must not touch the release CLI');
    assert.equal(supervisorCalls.some(call => call.kind === 'start' && call.projectId === legacy.id && call.releaseId), false, 'legacy supervisor launch must not be handed a release id');
  } finally {
    if (listening) await new Promise(resolve => server.close(resolve));
    await rm(stateDirectory, {recursive: true, force: true});
  }
});

test('local dashboard serves immutable surface and read-only projections', async () => {
  await withServer(async ({origin}) => {
    const home = await fetch(origin + '/');
    assert.equal(home.status, 200);
    assert.match(home.headers.get('content-security-policy'), /default-src 'self'/);
    assert.match(home.headers.get('permissions-policy'), /microphone=\(self\)/);
    assert.match(await home.text(), /Sublimine/);

    const bootstrap = await fetch(origin + '/api/bootstrap');
    assert.equal(bootstrap.status, 200);
    const payload = await bootstrap.json();
    assert.equal(payload.token, 'test-ui-token');
    assert.equal(payload.overview.service.data.active, true);
    assert.equal(payload.overview.executionTargets.missionDefault.model, 'gpt-6-astra');
    assert.equal(payload.overview.executionTargets.schema, 'sovereign.execution-target-inventory.v2');
    assert.equal(payload.overview.executionTargets.pinnedFacilities.length, 1);
    assert.equal(payload.overview.executionTargets.pinnedFacilities[0].id, 'learning-control-plane-v1');
    const sourceDiscovery = payload.overview.executionTargets.inheritedFacilities[0];
    assert.deepEqual(sourceDiscovery, {
      id: 'public-source-discovery-v2',
      targetBinding: 'MISSION_FROZEN_TARGET',
      targetSource: 'mission.policy',
      historicalFallback: {
        id: 'public-source-discovery-v1',
        model: 'gpt-6-astra',
        effort: 'ultra',
        appliesWhen: 'NO_FROZEN_MISSION_TARGET',
      },
      scope: 'Dedicated public-source discovery inherits the exact model and reasoning effort frozen in the mission policy. The historical fallback is used only when no frozen mission target exists; this descriptor is not a per-run execution receipt.',
    });

    const exportResponse = await fetch(origin + '/api/missions/' + missionId + '/export');
    assert.equal(exportResponse.status, 200);
    assert.match(exportResponse.headers.get('content-disposition'), /attachment/);
  });
});

test('mission detail and export redact an inherited project context package at the API boundary', async () => {
  await withServer(async ({origin}) => {
    for (const suffix of ['', '/export']) {
      const response = await fetch(origin + '/api/missions/' + missionId + suffix);
      assert.equal(response.status, 200);
      const detail = await response.json();
      assert.equal(detail.legacyContextRedacted, true);
      assert.equal(JSON.stringify(detail).includes('SOVEREIGN_PROJECT_CONTEXT_PACK_V1'), false);
      assert.equal(JSON.stringify(detail).includes('no debe reaparecer'), false);
      assert.equal(detail.status.data.mission.intent, 'Mandato de prueba');
      assert.equal(detail.report.data.mission.intent, 'Mandato de prueba');
    }
  }, {legacyContext: true});
});

test('project mission export requires the local UI session and exports only the redacted public projection', async () => {
  await withServer(async ({origin}) => {
    const localHeaders = {
      'content-type': 'application/json',
      'x-sovereign-ui-token': 'test-ui-token',
      origin,
      'sec-fetch-site': 'same-origin',
    };
    const create = await fetch(origin + '/api/projects', {
      method: 'POST',
      headers: localHeaders,
      body: JSON.stringify({name: 'Exportación aislada'}),
    });
    assert.equal(create.status, 201);
    const project = (await create.json()).project;

    const submit = await fetch(origin + '/api/projects/' + encodeURIComponent(project.id) + '/missions', {
      method: 'POST',
      headers: localHeaders,
      body: JSON.stringify({
        requestId: 'submission:eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
        text: 'Prepara una proyección exportable.',
        entryMode: 'planned',
        preset: 'adaptive-v2',
      }),
    });
    assert.equal(submit.status, 202);

    const exportUrl = origin + '/api/projects/' + encodeURIComponent(project.id)
      + '/missions/' + encodeURIComponent(missionId) + '/export';
    const unauthenticated = await fetch(exportUrl);
    assert.equal(unauthenticated.status, 403);
    assert.equal((await unauthenticated.json()).code, 'INVALID_UI_SESSION');

    const crossOrigin = await fetch(exportUrl, {
      headers: {
        'x-sovereign-ui-token': 'test-ui-token',
        origin: 'https://untrusted.example',
        'sec-fetch-site': 'cross-site',
      },
    });
    assert.equal(crossOrigin.status, 403);
    assert.equal((await crossOrigin.json()).code, 'CROSS_ORIGIN_REQUEST');

    const exported = await fetch(exportUrl, {
      headers: {
        accept: 'application/json',
        'x-sovereign-ui-token': 'test-ui-token',
        origin,
        'sec-fetch-site': 'same-origin',
      },
    });
    assert.equal(exported.status, 200);
    assert.match(exported.headers.get('content-disposition'), /attachment; filename="sublimine-12345678-1234-1234-1234-123456789abc\.json"/);
    assert.equal(exported.headers.get('content-type'), 'application/json; charset=utf-8');
    assert.equal(exported.headers.get('cache-control'), 'no-store');
    assert.equal(exported.headers.get('x-content-type-options'), 'nosniff');

    const projection = await exported.json();
    assert.equal(projection.projectId, project.id);
    assert.equal(projection.missionId, missionId);
    assert.equal(projection.legacyContextRedacted, true);
    const serialized = JSON.stringify(projection);
    assert.equal(serialized.includes('SOVEREIGN_PROJECT_CONTEXT_PACK_V1'), false);
    assert.equal(serialized.includes('no debe reaparecer'), false);
    assert.equal(projection.status.data.mission.intent, 'Mandato de prueba');
    assert.equal(projection.report.data.mission.intent, 'Mandato de prueba');
  }, {legacyContext: true});
});

test('mutation endpoints require local session, same-origin request, and safe command arguments', async () => {
  await withServer(async ({origin, calls}) => {
    const body = {
      requestId: 'submission:aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      text: 'Analiza el alcance y prepara un plan.',
      entryMode: 'planned',
      preset: 'adaptive-v2',
      maxParallel: 2,
      missionCallLimit: 15,
      methodRecoveryRounds: 2,
    };
    const missingToken = await fetch(origin + '/api/missions', {
      method: 'POST',
      headers: {'content-type': 'application/json'},
      body: JSON.stringify(body),
    });
    assert.equal(missingToken.status, 403);

    const crossOrigin = await fetch(origin + '/api/missions', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-sovereign-ui-token': 'test-ui-token',
        origin: 'https://untrusted.example',
      },
      body: JSON.stringify(body),
    });
    assert.equal(crossOrigin.status, 403);

    const accepted = await fetch(origin + '/api/missions', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-sovereign-ui-token': 'test-ui-token',
        origin,
        'sec-fetch-site': 'same-origin',
      },
      body: JSON.stringify(body),
    });
    assert.equal(accepted.status, 202);
    const submitCall = calls.find(args => args[0] === 'submit');
    assert.deepEqual(submitCall, [
      'submit',
      '--file',
      submitCall[2],
      '--request-id',
      body.requestId,
      '--entry-mode',
      'planned',
      '--preset',
      'adaptive-v2',
      '--parallel-pure-nodes',
      '2',
      '--mission-call-limit',
      '15',
      '--method-recovery-rounds',
      '2',
    ]);

    const action = await fetch(origin + '/api/missions/' + missionId + '/action', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-sovereign-ui-token': 'test-ui-token',
        origin,
      },
      body: JSON.stringify({action: 'pause'}),
    });
    assert.equal(action.status, 200);
    assert.deepEqual(calls.find(args => args[0] === 'pause'), ['pause', missionId]);
  });
});

test('submission validation enforces route and input boundaries', async () => {
  await withServer(async ({origin}) => {
    const tokenHeaders = {
      'content-type': 'application/json',
      'x-sovereign-ui-token': 'test-ui-token',
      origin,
    };
    const invalidAdaptive = await fetch(origin + '/api/missions', {
      method: 'POST',
      headers: tokenHeaders,
      body: JSON.stringify({
        requestId: 'submission:bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        text: 'Respuesta',
        entryMode: 'sourced-response-v1',
        preset: 'adaptive-v3',
      }),
    });
    assert.equal(invalidAdaptive.status, 400);
    const invalidAttachment = await fetch(origin + '/api/missions', {
      method: 'POST',
      headers: tokenHeaders,
      body: JSON.stringify({
        requestId: 'submission:cccccccc-cccc-4ccc-8ccc-cccccccccccc',
        text: 'Lee el archivo.',
        entryMode: 'bounded-read-response-v1',
        preset: 'adaptive-v2',
        attachments: [{name: 'large.txt', base64: Buffer.alloc(65_537, 65).toString('base64')}],
      }),
    });
    assert.equal(invalidAttachment.status, 400);
    const unsupportedEffort = await fetch(origin + '/api/missions', {
      method: 'POST',
      headers: tokenHeaders,
      body: JSON.stringify({
        requestId: 'submission:dddddddd-dddd-4ddd-8ddd-dddddddddddd',
        text: 'Planifica esta petición.',
        entryMode: 'planned',
        preset: 'adaptive-v2',
        model: 'gpt-5.6-luna',
        effort: 'ultra',
      }),
    });
    assert.equal(unsupportedEffort.status, 400);
  });
});

test('project APIs isolate vault-backed context, model policy and project factory state', async () => {
  await withServer(async ({origin, calls}) => {
    const headers = {
      'content-type': 'application/json',
      'x-sovereign-ui-token': 'test-ui-token',
      origin,
      'sec-fetch-site': 'same-origin',
    };
    const missingToken = await fetch(origin + '/api/projects', {
      method: 'POST',
      headers: {'content-type': 'application/json', origin},
      body: JSON.stringify({name: 'Atlas'}),
    });
    assert.equal(missingToken.status, 403);

    const create = await fetch(origin + '/api/projects', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        name: 'Atlas',
        client: 'Cliente A',
        description: 'No debe filtrarse al otro proyecto.',
        modelPolicy: {model: 'gpt-5.6-terra', effort: 'high'},
      }),
    });
    assert.equal(create.status, 201);
    const project = (await create.json()).project;
    assert.match(project.id, /^project:/);
    assert.equal(project.isolation.crossProjectRead, false);

    const betaCreate = await fetch(origin + '/api/projects', {
      method: 'POST',
      headers,
      body: JSON.stringify({name: 'Boreal', client: 'Cliente B'}),
    });
    const beta = (await betaCreate.json()).project;

    const projects = await fetch(origin + '/api/projects');
    const listing = await projects.json();
    assert.equal(listing.projects.length, 2);
    assert.equal(JSON.stringify(listing.projects).includes('No debe filtrarse'), false);

    const message = await fetch(origin + '/api/projects/' + encodeURIComponent(project.id) + '/messages', {
      method: 'POST',
      headers,
      body: JSON.stringify({text: 'La clave de Atlas procede de una fuente verificable.', source: 'browser-voice-transcript'}),
    });
    assert.equal(message.status, 201);
    const recorded = await message.json();
    assert.equal(recorded.message.source, 'browser-voice-transcript');
    assert.equal(Object.hasOwn(recorded.message, 'rawAudio'), false);

    const search = await fetch(origin + '/api/projects/' + encodeURIComponent(project.id) + '/memory?query=clave%20Atlas');
    assert.equal(search.status, 200);
    assert.equal(JSON.stringify(await search.json()).includes('fuente verificable'), true);

    const crossProjectSearch = await fetch(origin + '/api/projects/' + encodeURIComponent(beta.id) + '/memory?query=clave%20Atlas');
    assert.equal(JSON.stringify(await crossProjectSearch.json()).includes('fuente verificable'), false);

    const submitted = await fetch(origin + '/api/projects/' + encodeURIComponent(project.id) + '/missions', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        requestId: 'submission:eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
        text: 'Prepara un plan con procedencia.',
        entryMode: 'planned',
        preset: 'adaptive-v2',
      }),
    });
    assert.equal(submitted.status, 202);
    const submission = await submitted.json();
    assert.equal(submission.policy.model, 'gpt-5.6-terra');
    assert.equal(submission.policy.effort, 'high');
    assert.equal(submission.context.selected >= 1, true);
    assert.equal(typeof submission.context.hash, 'string');
    assert.match(submission.admission.id, /^admission:/);
    assert.equal(submission.admission.state, 'LINKED');
    assert.equal(typeof submission.admission.renderedIntentHash, 'string');
    const projectSubmit = calls.find(args => args[0] === 'submit' && args.includes('--state-dir'));
    assert.ok(projectSubmit);
    assert.equal(projectSubmit.includes('gpt-5.6-terra'), true);
    assert.equal(projectSubmit.includes('high'), true);

    const replay = await fetch(origin + '/api/projects/' + encodeURIComponent(project.id) + '/missions', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        requestId: 'submission:eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
        text: 'Prepara un plan con procedencia.',
        entryMode: 'planned',
        preset: 'adaptive-v2',
      }),
    });
    assert.equal(replay.status, 202);
    assert.equal((await replay.json()).job.idempotent, true);
    assert.equal(calls.filter(args => args[0] === 'submit' && args.includes('--state-dir')).length, 1);

    const projectMissions = await fetch(origin + '/api/projects/' + encodeURIComponent(project.id) + '/missions');
    const missionList = await projectMissions.json();
    assert.equal(missionList.missions.length, 1);
    assert.equal(missionList.missions[0].contextPackHash, submission.context.hash);
    assert.equal(missionList.runtime.state, 'PROVISIONED');

    const liveStatus = await fetch(origin + '/api/projects/' + encodeURIComponent(project.id) + '/missions/' + missionId + '/status');
    assert.equal(liveStatus.status, 200);
    assert.equal((await liveStatus.json()).status.data.mission.id, missionId);

    const runtimeStart = await fetch(origin + '/api/projects/' + encodeURIComponent(project.id) + '/runtime/start', {
      method: 'POST', headers, body: JSON.stringify({}),
    });
    assert.equal(runtimeStart.status, 202);
    assert.equal((await runtimeStart.json()).supervisor.state, 'NOT_SUPERVISED');

    const deniedDetail = await fetch(origin + '/api/projects/' + encodeURIComponent(beta.id) + '/missions/' + missionId);
    assert.equal(deniedDetail.status, 404);
  });
});

test('project queue projects lifecycle separately from coordinator state', async () => {
  await withServer(async ({origin, projectSpaces}) => {
    const headers = {
      'content-type': 'application/json',
      'x-sovereign-ui-token': 'test-ui-token',
      origin,
      'sec-fetch-site': 'same-origin',
    };
    const created = await fetch(origin + '/api/projects', {
      method: 'POST',
      headers,
      body: JSON.stringify({name: 'Estados separados'}),
    });
    assert.equal(created.status, 201);
    const project = (await created.json()).project;
    const runtime = await projectSpaces.runtimeConfig(project.id);
    // The fake Factory reads no SQLite, but the console correctly treats this
    // project root as initialized only when its isolated state marker exists.
    await mkdir(runtime.stateDir, {recursive: true, mode: 0o700});
    await writeFile(join(runtime.stateDir, 'state.sqlite'), 'test-only', {mode: 0o600});

    const submitted = await fetch(origin + '/api/projects/' + encodeURIComponent(project.id) + '/missions', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        requestId: 'submission:ffffffff-ffff-4fff-8fff-ffffffffffff',
        text: 'Planifica sin confundir cola y ciclo.',
        entryMode: 'planned',
        preset: 'adaptive-v2',
      }),
    });
    assert.equal(submitted.status, 202);

    const overviewResponse = await fetch(origin + '/api/projects/' + encodeURIComponent(project.id));
    assert.equal(overviewResponse.status, 200);
    const overview = await overviewResponse.json();
    const job = overview.runtime.queue.find(item => item.missionId === missionId);
    assert.ok(job);
    assert.equal(job.status, 'RUNNING');
    assert.equal(job.attempts, 2);
    assert.deepEqual(job.lifecycle, {
      status: 'PLANNING',
      lastTransitionAt: '2026-09-20T10:00:00.000Z',
      pendingCodes: [],
    });

    const live = await fetch(origin + '/api/projects/' + encodeURIComponent(project.id) + '/missions/' + encodeURIComponent(missionId) + '/status');
    assert.equal(live.status, 200);
    assert.equal((await live.json()).status.data.mission.status, 'PLANNING');
  }, {queueStatus: 'RUNNING', missionStatus: 'PLANNING', queueAttempts: 2});
});

test('a completed project mission can stage, list and download only its verified text delivery', async () => {
  await withServer(async ({origin, calls}) => {
    const headers = {
      'content-type': 'application/json',
      'x-sovereign-ui-token': 'test-ui-token',
      origin,
      'sec-fetch-site': 'same-origin',
    };
    const create = await fetch(origin + '/api/projects', {
      method: 'POST', headers, body: JSON.stringify({name: 'Entrega Atlas'}),
    });
    const alpha = (await create.json()).project;
    const betaCreate = await fetch(origin + '/api/projects', {
      method: 'POST', headers, body: JSON.stringify({name: 'Entrega Boreal'}),
    });
    const beta = (await betaCreate.json()).project;

    const submitted = await fetch(origin + '/api/projects/' + encodeURIComponent(alpha.id) + '/missions', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        requestId: 'submission:abaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        text: 'Genera la entrega final verificable.',
        entryMode: 'planned',
        preset: 'adaptive-v2',
      }),
    });
    assert.equal(submitted.status, 202);

    const staged = await fetch(origin + '/api/projects/' + encodeURIComponent(alpha.id) + '/missions/' + missionId + '/deliverable', {
      method: 'POST', headers,
    });
    assert.equal(staged.status, 201);
    const stagedPayload = await staged.json();
    assert.match(stagedPayload.deliverable.id, /^delivery:[a-f0-9]{64}$/);
    assert.equal(stagedPayload.content.body, deliveredText);
    assert.equal(stagedPayload.deliverable.content.sha256, deliveredTextHash);
    assert.equal(calls.some(args => args[0] === 'delivery' && args[1] === missionId && args.includes('--state-dir')), true);

    const repeated = await fetch(origin + '/api/projects/' + encodeURIComponent(alpha.id) + '/missions/' + missionId + '/deliverable', {
      method: 'POST', headers,
    });
    assert.equal(repeated.status, 201);
    assert.equal((await repeated.json()).deliverable.id, stagedPayload.deliverable.id);

    const listed = await fetch(origin + '/api/projects/' + encodeURIComponent(alpha.id) + '/deliverables');
    assert.equal(listed.status, 200);
    const listPayload = await listed.json();
    assert.equal(listPayload.deliverables.length, 1);
    assert.equal(JSON.stringify(listPayload.deliverables).includes(deliveredText), false);

    const deliveryUrl = origin + '/api/projects/' + encodeURIComponent(alpha.id) + '/deliverables/' + encodeURIComponent(stagedPayload.deliverable.id) + '/content';
    const unauthenticated = await fetch(deliveryUrl);
    assert.equal(unauthenticated.status, 403);
    const downloaded = await fetch(deliveryUrl, {headers: {'x-sovereign-ui-token': 'test-ui-token', origin, 'sec-fetch-site': 'same-origin'}});
    assert.equal(downloaded.status, 200);
    assert.match(downloaded.headers.get('content-disposition'), /attachment/);
    assert.equal(downloaded.headers.get('content-type'), 'text/plain; charset=utf-8');
    assert.equal(await downloaded.text(), deliveredText);

    const betaList = await fetch(origin + '/api/projects/' + encodeURIComponent(beta.id) + '/deliverables');
    assert.equal((await betaList.json()).deliverables.length, 0);
    const crossProject = await fetch(
      origin + '/api/projects/' + encodeURIComponent(beta.id) + '/deliverables/' + encodeURIComponent(stagedPayload.deliverable.id) + '/content',
      {headers: {'x-sovereign-ui-token': 'test-ui-token', origin, 'sec-fetch-site': 'same-origin'}},
    );
    assert.equal(crossProject.status, 404);
  });
});

test('sealed delivery inbox is a local-session, same-origin, read-only projection', async () => {
  await withServer(async ({origin, calls, projectSpaces}) => {
    const headers = {
      'content-type': 'application/json',
      'x-sovereign-ui-token': 'test-ui-token',
      origin,
      'sec-fetch-site': 'same-origin',
    };
    const created = await fetch(origin + '/api/projects', {
      method: 'POST', headers, body: JSON.stringify({name: 'Buzón sellado'}),
    });
    assert.equal(created.status, 201);
    const project = (await created.json()).project;
    const expected = {
      schema: 'sublimine.delivery-inbox-projection.v1',
      projectId: project.id,
      items: [{
        state: 'SEALED_UNLINKED',
        delivery: {
          id: 'delivery:' + 'a'.repeat(64),
          missionId: 'mission:aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
          artifact: {id: 'artifact:sealed-inbox', payloadHash: 'b'.repeat(64)},
          content: {mediaType: 'text/plain; charset=utf-8', sha256: 'c'.repeat(64), bytes: 42},
          filename: 'sublimine-sealed-inbox.txt',
          createdAt: '2026-09-21T12:00:00.000Z',
        },
        conversation: {state: 'NO_VERIFIED_LINK'},
      }],
    };
    // Keep this HTTP contract test independent of the storage implementation
    // being introduced alongside it. The route must forward only the scoped
    // project id and return the service projection verbatim.
    const inboxCalls = [];
    projectSpaces.listUnlinkedSealedDeliveryInbox = async projectId => {
      inboxCalls.push(projectId);
      return expected;
    };
    const url = origin + '/api/projects/' + encodeURIComponent(project.id) + '/deliveries/inbox';

    const missingToken = await fetch(url, {headers: {origin, 'sec-fetch-site': 'same-origin'}});
    assert.equal(missingToken.status, 403);
    assert.equal((await missingToken.json()).code, 'INVALID_UI_SESSION');
    assert.deepEqual(inboxCalls, []);

    const crossOrigin = await fetch(url, {
      headers: {
        'x-sovereign-ui-token': 'test-ui-token',
        origin: 'https://untrusted.example',
        'sec-fetch-site': 'cross-site',
      },
    });
    assert.equal(crossOrigin.status, 403);
    assert.equal((await crossOrigin.json()).code, 'CROSS_ORIGIN_REQUEST');
    assert.deepEqual(inboxCalls, []);

    const beforeFactoryCalls = calls.length;
    const response = await fetch(url, {headers: {'x-sovereign-ui-token': 'test-ui-token', origin, 'sec-fetch-site': 'same-origin'}});
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), expected);
    assert.deepEqual(inboxCalls, [project.id]);
    assert.equal(calls.length, beforeFactoryCalls);
  });
});

test('a composer turn is linked to its mission and receives only the Factory-verified final delivery', async () => {
  await withServer(async ({origin}) => {
    const headers = {
      'content-type': 'application/json',
      'x-sovereign-ui-token': 'test-ui-token',
      origin,
      'sec-fetch-site': 'same-origin',
    };
    const created = await fetch(origin + '/api/projects', {
      method: 'POST', headers, body: JSON.stringify({name: 'Atlas conversación HTTP'}),
    });
    const project = (await created.json()).project;
    const prompt = 'Genera una propuesta institucional para Atlas.';
    const messageResponse = await fetch(origin + '/api/projects/' + encodeURIComponent(project.id) + '/messages', {
      method: 'POST', headers, body: JSON.stringify({text: prompt, source: 'typed'}),
    });
    assert.equal(messageResponse.status, 201);
    const message = await messageResponse.json();

    const submitted = await fetch(origin + '/api/projects/' + encodeURIComponent(project.id) + '/missions', {
      method: 'POST', headers,
      body: JSON.stringify({
        requestId: 'submission:f1f1f1f1-f1f1-4f1f-8f1f-f1f1f1f1f1f1',
        text: prompt,
        entryMode: 'planned',
        preset: 'adaptive-v2',
        conversationLink: {
          conversationId: message.conversation.id,
          sourceMessageId: message.message.id,
        },
      }),
    });
    assert.equal(submitted.status, 202);
    const submission = await submitted.json();
    assert.equal(submission.conversationLink.state, 'LINKED');
    assert.equal(submission.conversationLink.conversationId, message.conversation.id);

    const delivery = await fetch(origin + '/api/projects/' + encodeURIComponent(project.id) + '/missions/' + missionId + '/deliverable', {
      method: 'POST', headers,
    });
    assert.equal(delivery.status, 201);
    assert.equal((await delivery.json()).conversationTurn.state, 'FINAL_LINKED');

    const transcript = await fetch(origin + '/api/projects/' + encodeURIComponent(project.id) + '/conversations/' + encodeURIComponent(message.conversation.id) + '/messages');
    assert.equal(transcript.status, 200);
    const messages = (await transcript.json()).messages;
    assert.equal(messages.length, 2);
    assert.equal(messages[0].author, 'user');
    assert.equal(messages[1].author, 'agent');
    assert.equal(messages[1].source, 'verified-mission-delivery');
    assert.equal(messages[1].text, deliveredText);
    assert.deepEqual(messages[1].turn.presentation, {mode: 'inline-v1'});
    assert.equal(messages[1].turn.missionId, missionId);

    const repeated = await fetch(origin + '/api/projects/' + encodeURIComponent(project.id) + '/missions/' + missionId + '/deliverable', {
      method: 'POST', headers,
    });
    assert.equal((await repeated.json()).conversationTurn.idempotent, true);
    const transcriptAgain = await fetch(origin + '/api/projects/' + encodeURIComponent(project.id) + '/conversations/' + encodeURIComponent(message.conversation.id) + '/messages');
    assert.equal((await transcriptAgain.json()).messages.length, 2);

    const mismatch = await fetch(origin + '/api/projects/' + encodeURIComponent(project.id) + '/missions', {
      method: 'POST', headers,
      body: JSON.stringify({
        requestId: 'submission:f2f2f2f2-f2f2-4f2f-8f2f-f2f2f2f2f2f2',
        text: prompt + ' Alterado.',
        entryMode: 'planned',
        preset: 'adaptive-v2',
        conversationLink: {
          conversationId: message.conversation.id,
          sourceMessageId: message.message.id,
        },
      }),
    });
    assert.equal(mismatch.status, 409);
    assert.equal((await mismatch.json()).code, 'CONVERSATION_MISSION_SOURCE_MISMATCH');
  });
});

test('a bounded POST reconciliation delivers a completed linked mission without a selected inspector and never gives GET routes delivery side effects', async () => {
  await withServer(async ({origin, calls}) => {
    const headers = {
      'content-type': 'application/json',
      'x-sovereign-ui-token': 'test-ui-token',
      origin,
      'sec-fetch-site': 'same-origin',
    };
    const created = await fetch(origin + '/api/projects', {
      method: 'POST', headers, body: JSON.stringify({name: 'Conciliación Atlas'}),
    });
    const project = (await created.json()).project;
    const prompt = 'Devuelve la propuesta final sellada para Atlas.';
    const messageResponse = await fetch(origin + '/api/projects/' + encodeURIComponent(project.id) + '/messages', {
      method: 'POST', headers, body: JSON.stringify({text: prompt, source: 'typed'}),
    });
    const message = await messageResponse.json();
    const submitted = await fetch(origin + '/api/projects/' + encodeURIComponent(project.id) + '/missions', {
      method: 'POST', headers,
      body: JSON.stringify({
        requestId: 'submission:f3f3f3f3-f3f3-4f3f-8f3f-f3f3f3f3f3f3',
        text: prompt,
        entryMode: 'planned',
        preset: 'adaptive-v2',
        conversationLink: {
          conversationId: message.conversation.id,
          sourceMessageId: message.message.id,
        },
      }),
    });
    assert.equal(submitted.status, 202);

    // Project and message reads remain pure reads: an active page may poll
    // them freely without staging a Factory product behind the user's back.
    const overview = await fetch(origin + '/api/projects/' + encodeURIComponent(project.id));
    assert.equal(overview.status, 200);
    const before = await fetch(origin + '/api/projects/' + encodeURIComponent(project.id) + '/conversations/' + encodeURIComponent(message.conversation.id) + '/messages');
    assert.equal((await before.json()).messages.length, 1);
    assert.equal(calls.some(args => args[0] === 'delivery'), false);

    const reconciled = await fetch(origin + '/api/projects/' + encodeURIComponent(project.id) + '/deliveries/reconcile', {
      method: 'POST', headers,
    });
    assert.equal(reconciled.status, 200);
    const payload = await reconciled.json();
    assert.equal(payload.limit, 3);
    assert.equal(payload.outcomes.length, 1);
    assert.equal(payload.outcomes[0].missionId, missionId);
    assert.equal(payload.outcomes[0].state, 'STAGED');
    assert.equal(payload.outcomes[0].conversation.state, 'FINAL_LINKED');
    assert.equal(JSON.stringify(payload.outcomes[0]).includes(deliveredText), false);

    const transcript = await fetch(origin + '/api/projects/' + encodeURIComponent(project.id) + '/conversations/' + encodeURIComponent(message.conversation.id) + '/messages');
    const messages = (await transcript.json()).messages;
    assert.equal(messages.length, 2);
    assert.equal(messages[1].author, 'agent');
    assert.equal(messages[1].source, 'verified-mission-delivery');
    assert.equal(messages[1].text, deliveredText);

    // A later post is safe to repeat. It finds the sealed delivery and does
    // not add a second agent turn or invoke a new model.
    const repeated = await fetch(origin + '/api/projects/' + encodeURIComponent(project.id) + '/deliveries/reconcile', {
      method: 'POST', headers,
    });
    assert.equal(repeated.status, 200);
    assert.deepEqual((await repeated.json()).outcomes, []);
    const transcriptAgain = await fetch(origin + '/api/projects/' + encodeURIComponent(project.id) + '/conversations/' + encodeURIComponent(message.conversation.id) + '/messages');
    assert.equal((await transcriptAgain.json()).messages.length, 2);
  }, {missionStatus: 'COMPLETED'});
});

test('the server-owned reconciler returns a completed linked result after submission without a browser mutation or selected mission', async () => {
  await withServer(async ({origin, calls}) => {
    const headers = {
      'content-type': 'application/json',
      'x-sovereign-ui-token': 'test-ui-token',
      origin,
      'sec-fetch-site': 'same-origin',
    };
    const created = await fetch(origin + '/api/projects', {
      method: 'POST', headers, body: JSON.stringify({name: 'Entrega autónoma Atlas'}),
    });
    const project = (await created.json()).project;
    const prompt = 'Devuelve un resultado sellado sin que el navegador seleccione la misión.';
    const messageResponse = await fetch(origin + '/api/projects/' + encodeURIComponent(project.id) + '/messages', {
      method: 'POST', headers, body: JSON.stringify({text: prompt, source: 'typed'}),
    });
    const message = await messageResponse.json();
    const submitted = await fetch(origin + '/api/projects/' + encodeURIComponent(project.id) + '/missions', {
      method: 'POST', headers,
      body: JSON.stringify({
        requestId: 'submission:f4f4f4f4-f4f4-4f4f-8f4f-f4f4f4f4f4f4',
        text: prompt,
        entryMode: 'planned',
        preset: 'adaptive-v2',
        conversationLink: {
          conversationId: message.conversation.id,
          sourceMessageId: message.message.id,
        },
      }),
    });
    assert.equal(submitted.status, 202);

    const finalMessages = await eventually(async () => {
      const transcript = await fetch(origin + '/api/projects/' + encodeURIComponent(project.id) + '/conversations/' + encodeURIComponent(message.conversation.id) + '/messages');
      const messages = (await transcript.json()).messages;
      return messages.length === 2 ? messages : null;
    });
    assert.equal(finalMessages[1].author, 'agent');
    assert.equal(finalMessages[1].source, 'verified-mission-delivery');
    assert.equal(finalMessages[1].text, deliveredText);
    assert.equal(calls.some(args => args[0] === 'delivery' && args[1] === missionId), true);
  }, {missionStatus: 'COMPLETED', deliveryReconciliationInitialDelayMs: 1});
});

test('project identity endpoint requires the local UI session and exposes the audited live name', async () => {
  await withServer(async ({origin}) => {
    const headers = {
      'content-type': 'application/json',
      'x-sovereign-ui-token': 'test-ui-token',
      origin,
      'sec-fetch-site': 'same-origin',
    };
    const created = await fetch(origin + '/api/projects', {
      method: 'POST', headers,
      body: JSON.stringify({
        name: 'Sovereign Factory',
        description: 'Operación de Sovereign Factory.',
        objective: 'Mejorar Sovereign Factory.',
      }),
    });
    assert.equal(created.status, 201);
    const project = (await created.json()).project;

    const rejected = await fetch(origin + '/api/projects/' + encodeURIComponent(project.id) + '/identity', {
      method: 'PATCH',
      headers: {'content-type': 'application/json', origin},
      body: JSON.stringify({name: 'Sublimine'}),
    });
    assert.equal(rejected.status, 403);

    const renamed = await fetch(origin + '/api/projects/' + encodeURIComponent(project.id) + '/identity', {
      method: 'PATCH', headers, body: JSON.stringify({name: 'Sublimine'}),
    });
    assert.equal(renamed.status, 200);
    const payload = await renamed.json();
    assert.equal(payload.project.name, 'Sublimine');
    assert.match(payload.project.description, /Sublimine/);

    const overview = await fetch(origin + '/api/projects/' + encodeURIComponent(project.id));
    assert.equal(overview.status, 200);
    assert.equal((await overview.json()).project.name, 'Sublimine');

    const invalid = await fetch(origin + '/api/projects/' + encodeURIComponent(project.id) + '/identity', {
      method: 'PATCH', headers, body: JSON.stringify({name: 'Otro', client: 'No permitido'}),
    });
    assert.equal(invalid.status, 400);
  });
});

test('a project keeps the Factory mandate separate from its sealed context-pack evidence', async () => {
  await withServer(async ({origin, calls}) => {
    const headers = {
      'content-type': 'application/json',
      'x-sovereign-ui-token': 'test-ui-token',
      origin,
      'sec-fetch-site': 'same-origin',
    };
    const create = await fetch(origin + '/api/projects', {
      method: 'POST',
      headers,
      body: JSON.stringify({name: 'Atlas mandato separado'}),
    });
    assert.equal(create.status, 201);
    const project = (await create.json()).project;

    const recorded = await fetch(origin + '/api/projects/' + encodeURIComponent(project.id) + '/messages', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        text: 'Memoria de Atlas: una fuente primaria ya fue verificada.',
        source: 'browser-voice-transcript',
      }),
    });
    assert.equal(recorded.status, 201);

    const originalIntent = 'Prepara un informe de procedencia para Atlas.';
    const submitted = await fetch(origin + '/api/projects/' + encodeURIComponent(project.id) + '/missions', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        requestId: 'submission:efefefef-efef-4efe-8efe-efefefefefef',
        text: originalIntent,
        entryMode: 'planned',
        preset: 'adaptive-v2',
      }),
    });
    assert.equal(submitted.status, 202);
    const response = await submitted.json();
    assert.equal(typeof response.context.hash, 'string');
    assert.equal(response.context.selected >= 1, true);
    assert.equal(response.admission.contextPackHash, response.context.hash);

    const captured = calls.mandates?.find(entry => entry.args[0] === 'submit' && entry.args.includes('--state-dir'));
    assert.ok(captured, 'the fake Factory must receive the project mandate file');
    assert.equal(captured.mandate, originalIntent);
    assert.equal(captured.mandate.includes('SOVEREIGN_PROJECT_CONTEXT_PACK'), false);
    assert.equal(captured.mandate.includes('Memoria de Atlas:'), false);
    assert.equal(captured.args.includes('--project-context'), true);
    assert.deepEqual(captured.projectContext, {
      path: 'private/project-context.json',
      sha256: captured.projectContext.sha256,
      classification: 'project-context-untrusted-v1',
      requiredRead: true,
    });
    assert.equal(captured.inputs.some(input => input.path === 'private/project-context.json'), true);
    const privateContext = captured.inputs.find(input => input.path === 'private/project-context.json');
    assert.equal(privateContext.content.includes('Memoria de Atlas: una fuente primaria ya fue verificada.'), true);
    assert.equal(privateContext.content.includes('SOVEREIGN_PROJECT_CONTEXT_PACK'), false);
    assert.equal(captured.projectContext.sha256.length, 64);

    const missions = await fetch(origin + '/api/projects/' + encodeURIComponent(project.id) + '/missions');
    assert.equal(missions.status, 200);
    const mapping = (await missions.json()).missions[0];
    assert.equal(mapping.contextPackHash, response.context.hash);
    assert.equal(Array.isArray(mapping.selectedMemoryEventIds), true);
    assert.equal(mapping.selectedMemoryEventIds.length >= 1, true);
  });
});

test('a project refuses a route that cannot carry its private context instead of dropping it', async () => {
  await withServer(async ({origin, calls}) => {
    const headers = {
      'content-type': 'application/json',
      'x-sovereign-ui-token': 'test-ui-token',
      origin,
      'sec-fetch-site': 'same-origin',
    };
    const create = await fetch(origin + '/api/projects', {
      method: 'POST', headers, body: JSON.stringify({name: 'Atlas ruta incompatible'}),
    });
    const project = (await create.json()).project;
    const submitted = await fetch(origin + '/api/projects/' + encodeURIComponent(project.id) + '/missions', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        requestId: 'submission:cdcdcdcd-cdcd-4dcd-8dcd-cdcdcdcdcdcd',
        text: 'Resume este texto con contexto de proyecto.',
        entryMode: 'bounded-read-response-v1',
        preset: 'adaptive-v2',
      }),
    });
    assert.equal(submitted.status, 409);
    assert.equal((await submitted.json()).code, 'PROJECT_CONTEXT_ROUTE_UNSUPPORTED');
    assert.equal(calls.some(args => args[0] === 'submit'), false);
  });
});

test('a fresh car-listing question uses the v2 sealed source route and automatically delivers its completed result', async () => {
  await withServer(async ({origin, calls}) => {
    const headers = {
      'content-type': 'application/json',
      'x-sovereign-ui-token': 'test-ui-token',
      origin,
      'sec-fetch-site': 'same-origin',
    };
    const created = await fetch(origin + '/api/projects', {
      method: 'POST', headers,
      body: JSON.stringify({name: 'Ruta pública vehículos'}),
    });
    const project = (await created.json()).project;
    const memory = await fetch(origin + '/api/projects/' + encodeURIComponent(project.id) + '/messages', {
      method: 'POST', headers,
      body: JSON.stringify({text: 'Secreto de este proyecto: jamás debe llegar a una consulta pública.', source: 'typed'}),
    });
    assert.equal(memory.status, 201);

    const mandate = 'Pregunta, cuales son la informacion clave que deberia tener cada anuncio de coche. Es decir kilometraje, ciudad, año etc... cuales son las que deberian verse para el piblico. Aver que.';
    const messageResponse = await fetch(origin + '/api/projects/' + encodeURIComponent(project.id) + '/messages', {
      method: 'POST', headers,
      body: JSON.stringify({text: mandate, source: 'typed'}),
    });
    assert.equal(messageResponse.status, 201);
    const message = await messageResponse.json();
    const submitted = await fetch(origin + '/api/projects/' + encodeURIComponent(project.id) + '/missions', {
      method: 'POST', headers,
      body: JSON.stringify({
        requestId: 'submission:ababcdcd-abab-4bcd-8abc-ababcdabcdab',
        text: mandate,
        entryMode: 'planned',
        preset: 'adaptive-v2',
        conversationLink: {
          conversationId: message.conversation.id,
          sourceMessageId: message.message.id,
        },
      }),
    });
    assert.equal(submitted.status, 202);
    const response = await submitted.json();
    assert.equal(response.conversationLink.state, 'LINKED');
    assert.deepEqual(response.routing, {
      mode: 'PROJECT_PUBLIC_SOURCED_AUTOMATIC_V1',
      context: {mode: 'WITHHELD_NOT_SAMPLED', attached: false},
      escalation: 'EXPLICIT_NEW_PLANNED_ADMISSION_REQUIRED',
    });
    assert.deepEqual(response.context, {mode: 'WITHHELD_NOT_SAMPLED', attached: false});
    assert.equal(Object.hasOwn(response.admission, 'contextPackHash'), false);
    assert.equal(Object.hasOwn(response.admission, 'assetManifestHash'), false);
    assert.equal(Object.hasOwn(response.admission, 'assetCount'), false);
    assert.deepEqual(response.admission.routeBinding, {
      schema: 'sublimine.project-route-binding.v1',
      kind: 'project-public-sourced-v1',
      factoryEntryMode: 'sourced-response-v1',
      privateContext: 'WITHHELD_NOT_SAMPLED',
      assets: 'FORBIDDEN',
      fallback: 'EXPLICIT_NEW_PLANNED_ADMISSION_REQUIRED',
    });

    const captured = calls.mandates.find(entry => entry.args[0] === 'submit' && entry.args.includes('--state-dir'));
    assert.ok(captured);
    assert.equal(captured.mandate, mandate);
    assert.equal(captured.mandate.includes('Secreto de este proyecto'), false);
    assert.equal(captured.args.includes('--entry-mode'), true);
    assert.equal(captured.args[captured.args.indexOf('--entry-mode') + 1], 'sourced-response-v1');
    assert.equal(captured.args[captured.args.indexOf('--sourced-fallback') + 1], 'defer-only-v1');
    assert.equal(captured.args[captured.args.indexOf('--sourced-evidence-profile') + 1], 'es-used-car-listing-v2');
    assert.equal(captured.args.includes('--inputs'), false);
    assert.equal(captured.args.includes('--project-context'), false);
    assert.equal(captured.args.includes('--asset-manifest'), false);
    assert.deepEqual(captured.inputs, []);
    assert.equal(captured.projectContext, null);
    assert.equal(captured.assetManifest, null);

    const missions = await fetch(origin + '/api/projects/' + encodeURIComponent(project.id) + '/missions');
    const mapping = (await missions.json()).missions[0];
    assert.equal(mapping.schema, 'sublimine-project-mission-v3');
    assert.deepEqual(mapping.contextScope, {mode: 'WITHHELD_NOT_SAMPLED', attached: false});
    assert.equal(Object.hasOwn(mapping, 'contextPackHash'), false);
    assert.equal(Object.hasOwn(mapping, 'selectedMemoryEventIds'), false);
    assert.equal(Object.hasOwn(mapping, 'assetReferences'), false);
    const finalMessages = await eventually(async () => {
      const transcript = await fetch(origin + '/api/projects/' + encodeURIComponent(project.id) + '/conversations/' + encodeURIComponent(message.conversation.id) + '/messages');
      const messages = (await transcript.json()).messages;
      return messages.length === 2 ? messages : null;
    });
    assert.equal(finalMessages[1].author, 'agent');
    assert.equal(finalMessages[1].source, 'verified-mission-delivery');
    assert.equal(finalMessages[1].text, deliveredText);
    assert.equal(calls.some(args => args[0] === 'delivery' && args[1] === missionId), true);
  }, {missionStatus: 'COMPLETED', deliveryReconciliationInitialDelayMs: 1});
});

test('a conversational project check-in stays on the planned route and receives the completed delivery', async () => {
  await withServer(async ({origin, calls}) => {
    const headers = {
      'content-type': 'application/json',
      'x-sovereign-ui-token': 'test-ui-token',
      origin,
      'sec-fetch-site': 'same-origin',
    };
    const created = await fetch(origin + '/api/projects', {
      method: 'POST', headers,
      body: JSON.stringify({name: 'Conversación no investigable'}),
    });
    assert.equal(created.status, 201);
    const project = (await created.json()).project;
    const prompt = 'Buenas, Quien eres?';
    const messageResponse = await fetch(origin + '/api/projects/' + encodeURIComponent(project.id) + '/messages', {
      method: 'POST', headers,
      body: JSON.stringify({text: prompt, source: 'typed'}),
    });
    assert.equal(messageResponse.status, 201);
    const message = await messageResponse.json();
    const submitted = await fetch(origin + '/api/projects/' + encodeURIComponent(project.id) + '/missions', {
      method: 'POST', headers,
      body: JSON.stringify({
        requestId: 'submission:bbbbcdcd-bbbb-4bcd-8bbb-bbbbcdcdcdcd',
        text: prompt,
        entryMode: 'planned',
        preset: 'adaptive-v2',
        conversationLink: {
          conversationId: message.conversation.id,
          sourceMessageId: message.message.id,
        },
      }),
    });
    assert.equal(submitted.status, 202);
    const response = await submitted.json();
    assert.equal(Object.hasOwn(response, 'routing'), false);
    assert.equal(Object.hasOwn(response.admission, 'routeBinding'), false);
    assert.equal(response.conversationLink.state, 'LINKED');

    const captured = calls.mandates.find(entry => entry.args[0] === 'submit' && entry.args.includes('--state-dir'));
    assert.ok(captured);
    assert.equal(captured.mandate, prompt);
    assert.equal(captured.args[captured.args.indexOf('--entry-mode') + 1], 'planned');
    assert.equal(captured.args.includes('--sourced-fallback'), false);
    assert.equal(captured.args.includes('--sourced-evidence-profile'), false);
    assert.equal(captured.args.includes('--project-context'), true);

    const finalMessages = await eventually(async () => {
      const transcript = await fetch(origin + '/api/projects/' + encodeURIComponent(project.id) + '/conversations/' + encodeURIComponent(message.conversation.id) + '/messages');
      const messages = (await transcript.json()).messages;
      return messages.length === 2 ? messages : null;
    });
    assert.equal(finalMessages[1].author, 'agent');
    assert.equal(finalMessages[1].source, 'verified-mission-delivery');
    assert.equal(finalMessages[1].text, deliveredText);
    assert.equal(calls.some(args => args[0] === 'delivery' && args[1] === missionId), true);
  }, {missionStatus: 'COMPLETED', deliveryReconciliationInitialDelayMs: 1});
});

test('a prepared legacy admission without private transport cannot silently submit without its project context', async () => {
  await withServer(async ({origin, calls, projectSpaces}) => {
    const headers = {
      'content-type': 'application/json',
      'x-sovereign-ui-token': 'test-ui-token',
      origin,
      'sec-fetch-site': 'same-origin',
    };
    const project = await projectSpaces.createProject({
      name: 'Atlas legado limpio',
      modelPolicy: {model: 'gpt-5.6-terra', effort: 'high'},
    });
    const requestId = 'submission:edededed-eded-4ede-8ede-edededededed';
    const originalIntent = 'No pierdas el contexto privado de este proyecto.';
    const admissionInput = {
      requestId,
      originalIntent,
      entryMode: 'planned',
      preset: 'adaptive-v2',
      model: null,
      effort: null,
      factoryOptions: {maxParallel: null, missionCallLimit: null, methodRecoveryRounds: null},
      attachmentManifestHash: createHash('sha256').update('[]').digest('hex'),
    };
    const prepared = await projectSpaces.prepareMissionAdmission(project.id, admissionInput, {
      resolveModelTarget: async target => target,
    });
    const legacy = {...prepared, schema: 'sovereign-project-admission-v1'};
    delete legacy.factoryIntent;
    delete legacy.factoryIntentHash;
    delete legacy.contextTransport;
    await writeFile(projectSpaces.admissionPath(project.id, requestId), JSON.stringify(legacy, null, 2) + '\n', 'utf8');

    const response = await fetch(origin + '/api/projects/' + encodeURIComponent(project.id) + '/missions', {
      method: 'POST',
      headers,
      body: JSON.stringify({requestId, text: originalIntent, entryMode: 'planned', preset: 'adaptive-v2'}),
    });
    assert.equal(response.status, 409);
    assert.equal((await response.json()).code, 'LEGACY_CONTEXT_TRANSPORT_UNAVAILABLE');
    assert.equal(calls.some(args => args[0] === 'submit'), false);
  });
});

test('a project seals an exact provider target rather than an ambiguous default label', async () => {
  await withServer(async ({origin, calls}) => {
    const headers = {
      'content-type': 'application/json',
      'x-sovereign-ui-token': 'test-ui-token',
      origin,
      'sec-fetch-site': 'same-origin',
    };
    const created = await fetch(origin + '/api/projects', {
      method: 'POST', headers,
      body: JSON.stringify({name: 'Atlas sin política'}),
    });
    const project = (await created.json()).project;
    const submitted = await fetch(origin + '/api/projects/' + encodeURIComponent(project.id) + '/missions', {
      method: 'POST', headers,
      body: JSON.stringify({
        requestId: 'submission:abababab-abab-4bab-8bab-abababababab',
        text: 'Prepara un mandato verificable.',
        entryMode: 'planned',
        preset: 'adaptive-v2',
      }),
    });
    assert.equal(submitted.status, 202);
    const response = await submitted.json();
    assert.equal(response.policy.model, 'gpt-6-astra');
    assert.equal(response.policy.effort, 'ultra');
    assert.equal(response.policy.targetOrigin, 'factory-default-v1');
    const submit = calls.find(args => args[0] === 'submit' && args.includes('--state-dir'));
    assert.equal(submit.includes('--model'), true);
    assert.equal(submit.includes('gpt-6-astra'), true);
    assert.equal(submit.includes('--effort'), true);
    assert.equal(submit.includes('ultra'), true);
  });
});

test('a project model without effort seals the live provider default effort', async () => {
  await withServer(async ({origin, calls}) => {
    const headers = {
      'content-type': 'application/json',
      'x-sovereign-ui-token': 'test-ui-token',
      origin,
      'sec-fetch-site': 'same-origin',
    };
    const created = await fetch(origin + '/api/projects', {
      method: 'POST', headers,
      body: JSON.stringify({name: 'Terra por defecto', modelPolicy: {model: 'gpt-5.6-terra'}}),
    });
    assert.equal(created.status, 201);
    const project = (await created.json()).project;
    const submitted = await fetch(origin + '/api/projects/' + encodeURIComponent(project.id) + '/missions', {
      method: 'POST', headers,
      body: JSON.stringify({
        requestId: 'submission:cdcdcdcd-cdcd-4dcd-8dcd-cdcdcdcdcdcd',
        text: 'Prepara un mandato verificable.',
        entryMode: 'planned',
        preset: 'adaptive-v2',
      }),
    });
    assert.equal(submitted.status, 202);
    const response = await submitted.json();
    assert.equal(response.policy.model, 'gpt-5.6-terra');
    assert.equal(response.policy.effort, 'medium');
    assert.equal(response.policy.targetOrigin, 'provider-default-effort-v1');
    const submit = calls.find(args => args[0] === 'submit' && args.includes('--state-dir'));
    assert.equal(submit.includes('gpt-5.6-terra'), true);
    assert.equal(submit.includes('medium'), true);
  });
});

test('dashboard refuses a non-loopback listener', async () => {
  await assert.rejects(
    startDashboard({host: '0.0.0.0', port: 4176}),
    error => error?.code === 'NON_LOCAL_HOST',
  );
});

test('project asset HTTP flow isolates originals and admits only sealed bounded text derivatives to Factory', async () => {
  await withServer(async ({origin, calls}) => {
    const headers = {
      'content-type': 'application/json',
      'x-sovereign-ui-token': 'test-ui-token',
      origin,
      'sec-fetch-site': 'same-origin',
    };
    const createProject = async name => {
      const response = await fetch(origin + '/api/projects', {
        method: 'POST', headers, body: JSON.stringify({name, modelPolicy: {model: 'gpt-5.6-terra', effort: 'high'}}),
      });
      assert.equal(response.status, 201);
      return (await response.json()).project;
    };
    const alpha = await createProject('Atlas adjuntos');
    const beta = await createProject('Boreal adjuntos');
    const bytes = Buffer.from([0, 255, 16, 0, 42, 13, 10, 128]);
    const sha256 = createHash('sha256').update(bytes).digest('hex');
    const reservationResponse = await fetch(origin + '/api/projects/' + encodeURIComponent(alpha.id) + '/assets/reservations', {
      method: 'POST', headers,
      body: JSON.stringify({filename: '../../cliente\\contrato.bin', mediaType: 'application/octet-stream', size: bytes.length, sha256}),
    });
    assert.equal(reservationResponse.status, 201);
    const reservation = await reservationResponse.json();
    assert.equal(reservation.asset.filename, 'contrato.bin');
    assert.equal(reservation.upload.method, 'PUT');
    assert.equal(reservation.upload.url.includes('/assets/uploads/'), true);

    const uploaded = await fetch(origin + reservation.upload.url, {
      method: 'PUT',
      headers: {
        'x-sovereign-ui-token': 'test-ui-token',
        origin,
        'sec-fetch-site': 'same-origin',
        'content-type': 'application/octet-stream',
      },
      body: bytes,
    });
    assert.equal(uploaded.status, 201);
    const asset = (await uploaded.json()).asset;
    assert.equal(asset.sha256, sha256);
    assert.equal(asset.size, bytes.length);

    const list = await fetch(origin + '/api/projects/' + encodeURIComponent(alpha.id) + '/assets');
    assert.equal(list.status, 200);
    const listed = await list.json();
    assert.equal(listed.assets.length, 1);
    assert.equal(JSON.stringify(listed).includes(bytes.toString('base64')), false);
    assert.equal(JSON.stringify(listed).includes('assets/objects'), false);

    const unauthenticatedDownload = await fetch(origin + '/api/projects/' + encodeURIComponent(alpha.id) + '/assets/' + encodeURIComponent(asset.id) + '/original');
    assert.equal(unauthenticatedDownload.status, 403);
    const download = await fetch(origin + '/api/projects/' + encodeURIComponent(alpha.id) + '/assets/' + encodeURIComponent(asset.id) + '/original', {
      headers: {'x-sovereign-ui-token': 'test-ui-token', origin, 'sec-fetch-site': 'same-origin'},
    });
    assert.equal(download.status, 200);
    assert.match(download.headers.get('content-disposition'), /attachment/);
    assert.equal(download.headers.get('x-content-type-options'), 'nosniff');
    assert.deepEqual(Buffer.from(await download.arrayBuffer()), bytes);

    const crossProject = await fetch(origin + '/api/projects/' + encodeURIComponent(beta.id) + '/missions', {
      method: 'POST', headers,
      body: JSON.stringify({
        requestId: 'submission:cbcbcbcb-cbcb-4bcb-8bcb-cbcbcbcbcbcb',
        text: 'No debe aceptar un archivo de Atlas.', entryMode: 'planned', preset: 'adaptive-v2',
        assetReferences: [{assetId: asset.id}],
      }),
    });
    assert.equal(crossProject.status, 404);
    assert.equal((await crossProject.json()).code, 'ASSET_REFERENCE_UNAVAILABLE');

    const submitted = await fetch(origin + '/api/projects/' + encodeURIComponent(alpha.id) + '/missions', {
      method: 'POST', headers,
      body: JSON.stringify({
        requestId: 'submission:dcdcdcdc-dcdc-4dcd-8dcd-dcdcdcdcdcdc',
        text: 'Elabora un plan basado en el contrato adjunto.', entryMode: 'planned', preset: 'adaptive-v2',
        assetReferences: [{assetId: asset.id}],
      }),
    });
    assert.equal(submitted.status, 409);
    assert.equal((await submitted.json()).code, 'ASSET_EXTRACTION_UNSUPPORTED');

    const text = 'matricula,km,ciudad\n1234ABC,65000,Madrid\n';
    const textBytes = Buffer.from(text, 'utf8');
    const textSha256 = createHash('sha256').update(textBytes).digest('hex');
    const textReservationResponse = await fetch(origin + '/api/projects/' + encodeURIComponent(alpha.id) + '/assets/reservations', {
      method: 'POST', headers,
      body: JSON.stringify({filename: 'inventario-clientes.csv', mediaType: 'text/csv', size: textBytes.length, sha256: textSha256}),
    });
    assert.equal(textReservationResponse.status, 201);
    const textReservation = await textReservationResponse.json();
    const textUploaded = await fetch(origin + textReservation.upload.url, {
      method: 'PUT',
      headers: {
        'x-sovereign-ui-token': 'test-ui-token',
        origin,
        'sec-fetch-site': 'same-origin',
        'content-type': 'text/csv',
      },
      body: textBytes,
    });
    assert.equal(textUploaded.status, 201);
    const textAsset = (await textUploaded.json()).asset;

    const textSubmitted = await fetch(origin + '/api/projects/' + encodeURIComponent(alpha.id) + '/missions', {
      method: 'POST', headers,
      body: JSON.stringify({
        requestId: 'submission:dededede-dede-4ded-8ded-dededededede',
        text: 'Resume sólo los datos del inventario adjunto.', entryMode: 'planned', preset: 'adaptive-v2',
        assetReferences: [{assetId: textAsset.id}],
      }),
    });
    assert.equal(textSubmitted.status, 202);
    const submission = await textSubmitted.json();
    assert.equal(submission.admission.assetCount, 1);
    assert.deepEqual(submission.admission.assetInput, {mode: 'sealed-utf8-text-v1', count: 1});
    const mappings = await fetch(origin + '/api/projects/' + encodeURIComponent(alpha.id) + '/missions');
    const mapping = (await mappings.json()).missions[0];
    assert.deepEqual(mapping.assetReferences, [{id: textAsset.id, sha256: textSha256, mediaType: 'text/csv', size: textBytes.length}]);
    const captured = calls.mandates.find(entry => entry.args[0] === 'submit' && entry.args.includes('--state-dir'));
    assert.equal(JSON.stringify(captured).includes(bytes.toString('base64')), false);
    assert.equal(captured.args.includes('--asset-manifest'), false);
    assert.equal(captured.assetManifest, null);
    const derivedInput = captured.inputs.find(input => /^assets\/derived\/[a-f0-9]{48}\.txt$/.test(input.path));
    assert.ok(derivedInput);
    assert.equal(derivedInput.content, text);
    assert.equal(JSON.stringify(captured.inputs).includes('inventario-clientes.csv'), false);
    assert.equal(JSON.stringify(captured.inputs).includes(textAsset.id), false);
    assert.equal(JSON.stringify(captured.inputs).includes('assets/objects'), false);
    assert.equal(captured.inputManifest.some(entry => entry.source.includes('/assets/objects/')), false);
    assert.equal(captured.inputManifest.some(entry => entry.source.includes('/assets/extractions/')), false);

    const missionScopedDownload = await fetch(
      origin + '/api/projects/' + encodeURIComponent(alpha.id) + '/assets/' + encodeURIComponent(textAsset.id) + '/original?missionId=' + encodeURIComponent(missionId),
      {headers: {'x-sovereign-ui-token': 'test-ui-token', origin, 'sec-fetch-site': 'same-origin'}},
    );
    assert.equal(missionScopedDownload.status, 200);
    assert.deepEqual(Buffer.from(await missionScopedDownload.arrayBuffer()), textBytes);
    const betaDownload = await fetch(origin + '/api/projects/' + encodeURIComponent(beta.id) + '/assets/' + encodeURIComponent(asset.id) + '/original', {
      headers: {'x-sovereign-ui-token': 'test-ui-token', origin, 'sec-fetch-site': 'same-origin'},
    });
    assert.equal(betaDownload.status, 404);
  });
});

test('a qualified injected document runner admits a sealed PDF derivative without exposing its vault identity to Factory', async () => {
  const extractionCalls = [];
  const toolchainLockHash = 'd'.repeat(64);
  const documentExtractionRunner = {
    async extract({kind, source, bytes}) {
      extractionCalls.push({kind, source: {...source}, bytes: Buffer.from(bytes)});
      assert.equal(kind, 'PDF');
      assert.equal(source.sha256, createHash('sha256').update(bytes).digest('hex'));
      const content = Buffer.from('Cláusula primera: el contrato PDF fue extraído por el canal V2.\n', 'utf8');
      return {
        kind: 'PDF',
        toolchainLockHash,
        derived: {
          sha256: createHash('sha256').update(content).digest('hex'),
          bytes: content.length,
          content,
        },
        observations: {pages: 1, textLayer: 'PRESENT'},
      };
    },
  };
  await withServer(async ({origin, calls}) => {
    const headers = {
      'content-type': 'application/json',
      'x-sovereign-ui-token': 'test-ui-token',
      origin,
      'sec-fetch-site': 'same-origin',
    };
    const created = await fetch(origin + '/api/projects', {
      method: 'POST', headers,
      body: JSON.stringify({name: 'Atlas PDF V2', modelPolicy: {model: 'gpt-5.6-terra', effort: 'high'}}),
    });
    assert.equal(created.status, 201);
    const project = (await created.json()).project;
    const pdf = Buffer.from('%PDF-1.4\n1 0 obj\n<<>>\nendobj\n%%EOF\n', 'ascii');
    const pdfHash = createHash('sha256').update(pdf).digest('hex');
    const reservationResponse = await fetch(origin + '/api/projects/' + encodeURIComponent(project.id) + '/assets/reservations', {
      method: 'POST', headers,
      body: JSON.stringify({filename: 'contrato-confidencial.pdf', mediaType: 'application/pdf', size: pdf.length, sha256: pdfHash}),
    });
    assert.equal(reservationResponse.status, 201);
    const reservation = await reservationResponse.json();
    const uploaded = await fetch(origin + reservation.upload.url, {
      method: 'PUT',
      headers: {
        'x-sovereign-ui-token': 'test-ui-token', origin, 'sec-fetch-site': 'same-origin',
        'content-type': 'application/pdf',
      },
      body: pdf,
    });
    assert.equal(uploaded.status, 201);
    const asset = (await uploaded.json()).asset;

    const submitted = await fetch(origin + '/api/projects/' + encodeURIComponent(project.id) + '/missions', {
      method: 'POST', headers,
      body: JSON.stringify({
        requestId: 'submission:e1e1e1e1-e1e1-4e1e-8e1e-e1e1e1e1e1e1',
        text: 'Analiza el documento adjunto y prepara un resumen verificable.',
        entryMode: 'planned', preset: 'adaptive-v2', assetReferences: [{assetId: asset.id}],
      }),
    });
    assert.equal(submitted.status, 202);
    const payload = await submitted.json();
    assert.deepEqual(payload.admission.assetInput, {mode: 'sealed-document-text-v2', count: 1});
    assert.equal(extractionCalls.length, 1);
    assert.equal(extractionCalls[0].kind, 'PDF');
    assert.deepEqual(extractionCalls[0].bytes, pdf);

    const captured = calls.mandates.find(entry => entry.args[0] === 'submit' && entry.args.includes('--state-dir'));
    assert.ok(captured);
    const derived = captured.inputs.find(input => /^assets\/derived\/[a-f0-9]{48}\.txt$/.test(input.path));
    assert.ok(derived);
    assert.equal(derived.content, 'Cláusula primera: el contrato PDF fue extraído por el canal V2.\n');
    assert.equal(JSON.stringify(captured).includes('contrato-confidencial.pdf'), false);
    assert.equal(JSON.stringify(captured).includes(asset.id), false);
    assert.equal(JSON.stringify(captured).includes('/document-extractions-v2/'), false);
    assert.equal(captured.inputManifest.some(entry => entry.source.includes('/assets/objects/')), false);
    assert.equal(captured.inputManifest.some(entry => entry.source.includes('/document-extractions-v2/')), false);
  }, {documentExtractionRunner});
});
