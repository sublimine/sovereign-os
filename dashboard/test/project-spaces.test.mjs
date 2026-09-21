import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {existsSync} from 'node:fs';
import {lstat, mkdtemp, readFile, rm, symlink, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import test from 'node:test';

import {
  PROJECT_PUBLIC_SOURCED_ADMISSION_SCHEMA,
  PROJECT_PUBLIC_SOURCED_CONTEXT_SCOPE,
  PROJECT_PUBLIC_SOURCED_ENTRY_MODE,
  PROJECT_PUBLIC_SOURCED_MISSION_SCHEMA,
  PROJECT_PUBLIC_SOURCED_ROUTE_BINDING_SCHEMA,
  PROJECT_PUBLIC_SOURCED_ROUTE_KIND,
  ProjectSpaceError,
  ProjectSpaceService,
  assertProjectId,
  normalizeModelPolicy,
} from '../project-spaces.mjs';

const linkedMissionId = 'mission:12345678-1234-1234-1234-123456789abc';

function canonical(value) {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (value && typeof value === 'object') {
    return '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + canonical(value[key])).join(',') + '}';
  }
  return JSON.stringify(value);
}

function rehash(events) {
  let previousHash = null;
  for (const [index, event] of events.entries()) {
    event.sequence = index + 1;
    event.previousHash = previousHash;
    delete event.hash;
    event.hash = createHash('sha256').update(canonical(event)).digest('hex');
    previousHash = event.hash;
  }
  return events;
}

async function withSpaces(callback) {
  const root = await mkdtemp(join(tmpdir(), 'sovereign-project-spaces-'));
  const spaces = await new ProjectSpaceService({rootDir: root}).init();
  try {
    await callback({root, spaces});
  } finally {
    await rm(root, {recursive: true, force: true});
  }
}

test('a project provisions a private vault, memory ledger and independent factory state', async () => {
  await withSpaces(async ({spaces}) => {
    const alpha = await spaces.createProject({
      name: 'Atlas',
      client: 'Cliente A',
      description: 'Contexto que no debe aparecer fuera de Atlas.',
      objective: 'Preparar una entrega verificable.',
      modelPolicy: {model: 'gpt-5.6-terra', effort: 'high'},
    });
    const beta = await spaces.createProject({name: 'Boreal', client: 'Cliente B'});

    assert.notEqual(alpha.id, beta.id);
    assert.equal(alpha.isolation.crossProjectRead, false);
    assert.equal(alpha.modelPolicy.model, 'gpt-5.6-terra');
    assert.equal(alpha.modelPolicy.effort, 'high');
    assert.notEqual((await spaces.runtimeConfig(alpha.id)).stateDir, (await spaces.runtimeConfig(beta.id)).stateDir);

    const paths = spaces.projectPaths(alpha.id);
    assert.match(await readFile(join(paths.vault, 'AGENTS.md'), 'utf8'), /No enumeres, leas ni mezcles proyectos/);
    assert.match(await readFile(join(paths.runtime, 'README.md'), 'utf8'), /--state-dir/);
    assert.match(await readFile(join(paths.graph, 'README.md'), 'utf8'), /exclusivamente/);

    const listed = await spaces.listProjects();
    assert.equal(listed.length, 2);
    assert.equal(Object.hasOwn(listed[0], 'description'), false);
    assert.equal(Object.hasOwn(listed[0], 'objective'), false);
  });
});

test('runtime releases are pinned privately per project while unbound projects retain the legacy wrapper', async () => {
  await withSpaces(async ({spaces}) => {
    const alpha = await spaces.createProject({name: 'Atlas'});
    const beta = await spaces.createProject({name: 'Boreal'});
    const alphaPaths = spaces.projectPaths(alpha.id);

    const legacy = await spaces.runtimeConfig(alpha.id);
    assert.equal(legacy.runtimeReleaseId, null);
    assert.equal(legacy.runtimeMode, 'LEGACY_GLOBAL_WRAPPER');
    assert.equal(existsSync(alphaPaths.runtimeReleaseBinding), false);
    assert.equal(Object.hasOwn(await spaces.getProject(alpha.id), 'runtimeReleaseId'), false);
    assert.equal(Object.hasOwn((await spaces.listProjects()).find(project => project.id === alpha.id), 'runtimeMode'), false);

    const releaseId = 'a'.repeat(64);
    const bound = await spaces.bindRuntimeRelease(alpha.id, releaseId);
    assert.deepEqual(bound, {
      schema: 'sublimine.project-runtime-release-binding.v1',
      projectId: alpha.id,
      releaseId,
      createdAt: bound.createdAt,
      mode: 'PINNED',
    });
    const stored = await readFile(alphaPaths.runtimeReleaseBinding, 'utf8');
    assert.deepEqual(JSON.parse(stored), bound);

    const replay = await spaces.bindRuntimeRelease(alpha.id, releaseId.toUpperCase());
    assert.deepEqual(replay, bound);
    assert.equal(await readFile(alphaPaths.runtimeReleaseBinding, 'utf8'), stored);

    const pinned = await spaces.runtimeConfig(alpha.id);
    assert.equal(pinned.runtimeReleaseId, releaseId);
    assert.equal(pinned.runtimeMode, 'PINNED');
    const independent = await spaces.runtimeConfig(beta.id);
    assert.equal(independent.runtimeReleaseId, null);
    assert.equal(independent.runtimeMode, 'LEGACY_GLOBAL_WRAPPER');

    await assert.rejects(
      spaces.bindRuntimeRelease(alpha.id, 'b'.repeat(64)),
      error => error instanceof ProjectSpaceError && error.code === 'RUNTIME_RELEASE_BINDING_CONFLICT',
    );
    assert.equal((await spaces.runtimeConfig(alpha.id)).runtimeReleaseId, releaseId);
  });
});

test('runtime release binding rejects malformed or transplanted private state without overwriting it', async () => {
  await withSpaces(async ({spaces}) => {
    const alpha = await spaces.createProject({name: 'Atlas'});
    const beta = await spaces.createProject({name: 'Boreal'});
    const releaseId = 'c'.repeat(64);
    const alphaBinding = await spaces.bindRuntimeRelease(alpha.id, releaseId);
    const betaPaths = spaces.projectPaths(beta.id);

    await writeFile(betaPaths.runtimeReleaseBinding, JSON.stringify(alphaBinding) + '\n', 'utf8');
    await assert.rejects(
      spaces.runtimeConfig(beta.id),
      error => error instanceof ProjectSpaceError && error.code === 'RUNTIME_RELEASE_BINDING_INVALID',
    );

    await writeFile(betaPaths.runtimeReleaseBinding, JSON.stringify({...alphaBinding, projectId: beta.id, unexpected: true}) + '\n', 'utf8');
    const tampered = await readFile(betaPaths.runtimeReleaseBinding, 'utf8');
    await assert.rejects(
      spaces.runtimeConfig(beta.id),
      error => error instanceof ProjectSpaceError && error.code === 'RUNTIME_RELEASE_BINDING_INVALID',
    );
    await assert.rejects(
      spaces.bindRuntimeRelease(beta.id, releaseId),
      error => error instanceof ProjectSpaceError && error.code === 'RUNTIME_RELEASE_BINDING_INVALID',
    );
    assert.equal(await readFile(betaPaths.runtimeReleaseBinding, 'utf8'), tampered);

    await assert.rejects(
      spaces.bindRuntimeRelease(alpha.id, 'not-a-content-addressed-release'),
      error => error instanceof ProjectSpaceError && error.code === 'RUNTIME_RELEASE_ID_INVALID',
    );
  });
});

test('a project identity rename updates live projections while preserving historical evidence', async () => {
  await withSpaces(async ({spaces}) => {
    const project = await spaces.createProject({
      name: 'Sovereign Factory',
      client: 'Operación interna',
      description: 'Espacio maestro de Sovereign Factory para la operación interna.',
      objective: 'Gobernar Sovereign Factory con trazabilidad.',
      modelPolicy: {model: 'gpt-5.6-terra', effort: 'high'},
    });
    const historicalText = 'La evidencia histórica se registró bajo Sovereign Factory.';
    const recorded = await spaces.recordMessage(project.id, {text: historicalText});
    const paths = spaces.projectPaths(project.id);
    const decisionsPath = join(paths.vault, '02_DECISIONS.md');
    await writeFile(decisionsPath, (await readFile(decisionsPath, 'utf8')) + '\n## Nota manual\n\nNo reescribir esta decisión libre.\n', 'utf8');
    const admissionInput = {
      requestId: 'submission:11111111-1111-4111-8111-111111111111',
      originalIntent: 'Conserva el contexto admitido antes del cambio de nombre.',
      entryMode: 'planned',
      preset: 'adaptive-v2',
      model: null,
      effort: null,
      factoryOptions: {},
      attachmentManifestHash: '0'.repeat(64),
    };
    const frozenAdmission = await spaces.prepareMissionAdmission(project.id, admissionInput, {
      resolveModelTarget: async policy => ({...policy, model: 'gpt-5.6-terra', effort: 'high'}),
    });
    const frozenContext = frozenAdmission.contextTransport.content;

    const renamed = await spaces.renameProject(project.id, {name: 'Sublimine'});
    assert.equal(renamed.name, 'Sublimine');
    assert.equal(renamed.client, 'Operación interna');
    assert.deepEqual(renamed.modelPolicy.model, 'gpt-5.6-terra');
    assert.match(renamed.description, /Sublimine/);
    assert.match(renamed.objective, /Sublimine/);
    assert.equal((await spaces.getProject(project.id)).name, 'Sublimine');
    assert.equal((await spaces.listProjects()).find(entry => entry.id === project.id).name, 'Sublimine');

    const home = await readFile(join(paths.vault, '00_HOME.md'), 'utf8');
    assert.match(home, /name: "Sublimine"/);
    assert.match(home, /^# Sublimine$/m);
    for (const filename of ['01_CONTEXT.md', '02_DECISIONS.md', '03_WORKING_MEMORY.md', '04_EVIDENCE.md', 'AGENTS.md']) {
      assert.match(await readFile(join(paths.vault, filename), 'utf8'), /name: "Sublimine"/);
    }
    assert.match(await readFile(decisionsPath, 'utf8'), /No reescribir esta decisión libre\./);
    assert.match(await readFile(join(paths.runtime, 'README.md'), 'utf8'), /Sublimine/);

    const replay = await spaces.prepareMissionAdmission(project.id, admissionInput, {
      resolveModelTarget: async policy => ({...policy, model: 'gpt-5.6-terra', effort: 'high'}),
    });
    assert.equal(replay.contextTransport.content, frozenContext);
    assert.equal((await spaces.contextPack(project.id)).project.name, 'Sublimine');

    const messages = await spaces.listMessages(project.id, recorded.conversation.id);
    assert.equal(messages[0].text, historicalText);
    const events = (await readFile(paths.memoryLedger, 'utf8')).trim().split('\n').map(line => JSON.parse(line));
    const rename = events.at(-1);
    assert.equal(rename.kind, 'space.identity.renamed');
    assert.deepEqual(rename.data.previousName, 'Sovereign Factory');
    assert.deepEqual(rename.data.name, 'Sublimine');
    assert.equal((await spaces.contextPack(project.id)).integrity.mode, 'hash-linked-hmac-anchor-v2');
    await spaces.renameProject(project.id, {name: 'Sublimine'});
    assert.equal((await readFile(paths.memoryLedger, 'utf8')).trim().split('\n').length, events.length);

    await assert.rejects(
      spaces.renameProject(project.id, {name: 'Otra identidad', client: 'No permitido'}),
      error => error instanceof ProjectSpaceError && error.code === 'INVALID_PROJECT_IDENTITY',
    );
  });
});

test('memory and conversations remain physically and logically isolated by project', async () => {
  await withSpaces(async ({spaces}) => {
    const alpha = await spaces.createProject({name: 'Atlas'});
    const beta = await spaces.createProject({name: 'Boreal'});
    const alphaMessage = await spaces.recordMessage(alpha.id, {
      text: 'La llave azul de Atlas procede del contrato firmado.',
      source: 'browser-voice-transcript',
    });
    await spaces.recordMessage(beta.id, {text: 'La llave verde de Boreal no pertenece a Atlas.'});

    const alphaTranscript = await spaces.listMessages(alpha.id, alphaMessage.conversation.id);
    assert.equal(alphaTranscript.length, 1);
    assert.equal(alphaTranscript[0].source, 'browser-voice-transcript');
    assert.equal(alphaTranscript[0].text.includes('llave azul'), true);

    const alphaSearch = await spaces.searchMemory(alpha.id, 'llave azul contrato');
    assert.equal(alphaSearch.results.some(result => result.text.includes('llave azul')), true);
    assert.equal(alphaSearch.results.some(result => result.text.includes('Boreal')), false);

    const capsule = await spaces.contextCapsule(alpha.id);
    assert.equal(JSON.stringify(capsule).includes('Boreal'), false);
    assert.equal(capsule.project.stats.integrity, 'VERIFIED_HMAC_ANCHOR');

    const pack = await spaces.contextPack(alpha.id, {maxBytes: 8 * 1024});
    assert.equal(pack.project.id, alpha.id);
    assert.equal(pack.memory.some(entry => entry.text.includes('llave azul')), true);
    assert.equal(JSON.stringify(pack).includes('llave verde'), false);
    assert.equal(pack.memory.every(entry => entry.trust === 'untrusted-observation'), true);
    assert.equal(typeof pack.hash, 'string');
  });
});

test('a valid chain cannot be transplanted from one project into another', async () => {
  await withSpaces(async ({spaces}) => {
    const alpha = await spaces.createProject({name: 'Atlas'});
    const beta = await spaces.createProject({name: 'Boreal'});
    await spaces.recordMessage(alpha.id, {text: 'Secreto exclusivo de Atlas.'});
    const alphaPaths = spaces.projectPaths(alpha.id);
    const betaPaths = spaces.projectPaths(beta.id);
    await writeFile(betaPaths.memoryLedger, await readFile(alphaPaths.memoryLedger, 'utf8'), {encoding: 'utf8'});
    await writeFile(betaPaths.memoryHead, await readFile(alphaPaths.memoryHead, 'utf8'), {encoding: 'utf8'});

    await assert.rejects(
      spaces.contextPack(beta.id),
      error => error instanceof ProjectSpaceError && error.code === 'MEMORY_INTEGRITY_BLOCKED',
    );
    await assert.rejects(
      spaces.searchMemory(beta.id, 'secreto Atlas'),
      error => error instanceof ProjectSpaceError && error.code === 'MEMORY_INTEGRITY_BLOCKED',
    );
  });
});

test('a coherent local rehash without the anchor key is blocked', async () => {
  await withSpaces(async ({spaces}) => {
    const project = await spaces.createProject({name: 'Atlas'});
    await spaces.recordMessage(project.id, {text: 'Registro original verificable.'});
    const paths = spaces.projectPaths(project.id);
    const events = (await readFile(paths.memoryLedger, 'utf8')).trim().split('\n').map(line => JSON.parse(line));
    events.at(-1).text = 'Registro reescrito y rehasheado.';
    await writeFile(paths.memoryLedger, rehash(events).map(event => JSON.stringify(event)).join('\n') + '\n', {encoding: 'utf8'});

    await assert.rejects(
      spaces.contextPack(project.id),
      error => error instanceof ProjectSpaceError && error.code === 'MEMORY_INTEGRITY_BLOCKED',
    );
    assert.equal(spaces.integrityKeyPath.startsWith(paths.root), false);
  });
});

test('a project admission freezes one policy and one exact context pack before factory acceptance', async () => {
  await withSpaces(async ({spaces}) => {
    const project = await spaces.createProject({
      name: 'Atlas',
      modelPolicy: {model: 'gpt-5.6-terra', effort: 'high'},
    });
    await spaces.recordMessage(project.id, {text: 'La decisión A debe conservar procedencia.'});
    const input = {
      requestId: 'submission:eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
      originalIntent: 'Prepara una misión con trazabilidad.',
      entryMode: 'planned',
      preset: 'adaptive-v2',
      model: null,
      effort: null,
      factoryOptions: {maxParallel: 2, missionCallLimit: 12, methodRecoveryRounds: 1},
      attachmentManifestHash: '0'.repeat(64),
    };
    const prepared = await spaces.prepareMissionAdmission(project.id, input);
    assert.equal(prepared.schema, 'sovereign-project-admission-v2');
    assert.equal(prepared.state, 'PREPARED');
    assert.equal(prepared.policySnapshot.model, 'gpt-5.6-terra');
    assert.equal(prepared.policySnapshot.effort, 'high');
    assert.equal(prepared.factoryIntent, input.originalIntent);
    assert.equal(prepared.renderedIntent, input.originalIntent);
    assert.equal(prepared.renderedIntentHash, createHash('sha256').update(prepared.renderedIntent).digest('hex'));
    assert.equal(prepared.contextPackHash, prepared.contextPack.hash);
    assert.equal(prepared.contextTransport.inputPath, 'private/project-context.json');
    assert.equal(prepared.contextTransport.contextPackHash, prepared.contextPackHash);
    assert.equal(createHash('sha256').update(prepared.contextTransport.content).digest('hex'), prepared.contextTransport.inputSha256);
    assert.equal(prepared.contextTransport.content.includes('La decisión A debe conservar procedencia.'), true);
    assert.equal(prepared.selectedMemoryEventIds.length >= 1, true);

    await spaces.updateProjectModelPolicy(project.id, {model: 'gpt-5.6-luna', effort: 'max'});
    const replay = await spaces.prepareMissionAdmission(project.id, input);
    assert.equal(replay.admissionId, prepared.admissionId);
    assert.deepEqual(replay.policySnapshot, prepared.policySnapshot);
    assert.equal(replay.contextTransport.content, prepared.contextTransport.content);
    assert.equal(replay.contextTransport.inputSha256, prepared.contextTransport.inputSha256);
    await assert.rejects(
      spaces.prepareMissionAdmission(project.id, {...input, originalIntent: 'Mandato distinto.'}),
      error => error instanceof ProjectSpaceError && error.code === 'ADMISSION_IDEMPOTENCY_CONFLICT',
    );

    await spaces.acceptMissionAdmission(project.id, input.requestId, linkedMissionId);
    const linked = await spaces.finalizeMissionAdmission(project.id, input.requestId);
    assert.equal(linked.state, 'LINKED');
    assert.equal(linked.mapping.contextPackHash, prepared.contextPackHash);
    const mappings = await spaces.listMissions(project.id);
    assert.equal(mappings.length, 1);
    assert.equal(mappings[0].admissionId, prepared.admissionId);
    const memory = await spaces.searchMemory(project.id, 'trazabilidad');
    assert.equal(memory.results.some(result => result.data?.admissionId === prepared.admissionId), true);
  });
});

test('a project-public-sourced admission is project-local yet withholds context and assets from every sealed record', async () => {
  await withSpaces(async ({spaces}) => {
    const alpha = await spaces.createProject({
      name: 'Atlas público',
      modelPolicy: {model: 'gpt-5.6-terra', effort: 'high'},
    });
    const beta = await spaces.createProject({name: 'Boreal aislado'});
    const privateMemory = 'Secreto de Atlas: la clave privada no debe llegar a una pregunta pública.';
    await spaces.recordMessage(alpha.id, {text: privateMemory});
    const input = {
      requestId: 'submission:99999999-9999-4999-8999-999999999999',
      originalIntent: '¿Qué información clave debe mostrar un anuncio de coche al público?',
      entryMode: PROJECT_PUBLIC_SOURCED_ENTRY_MODE,
      preset: 'adaptive-v2',
      model: null,
      effort: null,
      factoryOptions: {sourcedFallback: 'defer-only-v1'},
      routeBinding: {
        schema: PROJECT_PUBLIC_SOURCED_ROUTE_BINDING_SCHEMA,
        kind: PROJECT_PUBLIC_SOURCED_ROUTE_KIND,
        factoryEntryMode: PROJECT_PUBLIC_SOURCED_ENTRY_MODE,
        privateContext: 'WITHHELD_NOT_SAMPLED',
        assets: 'FORBIDDEN',
        fallback: 'EXPLICIT_NEW_PLANNED_ADMISSION_REQUIRED',
      },
    };
    const originalContextPackUnlocked = spaces.contextPackUnlocked;
    spaces.contextPackUnlocked = async () => {
      throw new Error('La ruta pública no debe muestrear la memoria privada.');
    };
    try {
      const prepared = await spaces.prepareMissionAdmission(alpha.id, input, {
        resolveModelTarget: async policy => ({...policy, model: 'gpt-5.6-terra', effort: 'high', targetOrigin: 'provider-catalog-v1'}),
      });
      assert.equal(prepared.schema, PROJECT_PUBLIC_SOURCED_ADMISSION_SCHEMA);
      assert.equal(prepared.state, 'PREPARED');
      assert.deepEqual(prepared.contextScope, PROJECT_PUBLIC_SOURCED_CONTEXT_SCOPE);
      assert.deepEqual(prepared.routeBinding, input.routeBinding);
      assert.equal(prepared.policySnapshot.model, 'gpt-5.6-terra');
      assert.equal(prepared.policySnapshot.effort, 'high');
      assert.match(prepared.requestFingerprint, /^[0-9a-f]{64}$/);
      assert.match(prepared.admissionFingerprint, /^[0-9a-f]{64}$/);
      for (const protectedField of [
        'contextPack', 'contextPackHash', 'contextTransport', 'selectedMemoryEventIds',
        'droppedMemoryEventIds', 'integrity', 'attachmentManifestHash', 'assetReferences',
      ]) {
        assert.equal(Object.hasOwn(prepared, protectedField), false, protectedField + ' must be omitted, not null');
      }
      assert.equal(JSON.stringify(prepared).includes(privateMemory), false);

      await spaces.updateProjectModelPolicy(alpha.id, {model: 'gpt-5.6-luna', effort: 'max'});
      const replay = await spaces.prepareMissionAdmission(alpha.id, input, {
        resolveModelTarget: async policy => ({...policy, model: 'gpt-5.6-luna', effort: 'max', targetOrigin: 'provider-catalog-v1'}),
      });
      assert.equal(replay.admissionId, prepared.admissionId);
      assert.deepEqual(replay.policySnapshot, prepared.policySnapshot);
      await assert.rejects(
        spaces.prepareMissionAdmission(alpha.id, {...input, preset: 'adaptive-v3'}),
        error => error instanceof ProjectSpaceError && error.code === 'ADMISSION_IDEMPOTENCY_CONFLICT',
      );
      await assert.rejects(
        spaces.prepareMissionAdmission(alpha.id, {...input, factoryOptions: {sourcedFallback: 'different'}}),
        error => error instanceof ProjectSpaceError && error.code === 'ADMISSION_IDEMPOTENCY_CONFLICT',
      );
      await assert.rejects(
        spaces.prepareMissionAdmission(alpha.id, {...input, assetReferences: []}),
        error => error instanceof ProjectSpaceError && error.code === 'PUBLIC_SOURCED_SCOPE_INVALID',
      );

      await spaces.acceptMissionAdmission(alpha.id, input.requestId, linkedMissionId);
      const linked = await spaces.finalizeMissionAdmission(alpha.id, input.requestId);
      assert.equal(linked.state, 'LINKED');
      assert.equal(linked.mapping.schema, PROJECT_PUBLIC_SOURCED_MISSION_SCHEMA);
      assert.deepEqual(linked.mapping.contextScope, PROJECT_PUBLIC_SOURCED_CONTEXT_SCOPE);
      assert.deepEqual(linked.mapping.routeBinding, input.routeBinding);
      for (const protectedField of [
        'contextPack', 'contextPackHash', 'contextTransport', 'selectedMemoryEventIds',
        'droppedMemoryEventIds', 'integrity', 'attachmentManifestHash', 'assetReferences',
      ]) {
        assert.equal(Object.hasOwn(linked.mapping, protectedField), false, protectedField + ' must be omitted from the mapping');
      }
      assert.equal(JSON.stringify(linked.mapping).includes(privateMemory), false);
      assert.equal((await spaces.listMissions(beta.id)).length, 0);
      assert.deepEqual((await spaces.listMissions(alpha.id))[0], linked.mapping);

      const events = (await readFile(spaces.projectPaths(alpha.id).memoryLedger, 'utf8')).trim().split('\n').map(line => JSON.parse(line));
      const submission = events.find(event => event.data?.admissionId === prepared.admissionId);
      assert.deepEqual(submission.data.contextScope, PROJECT_PUBLIC_SOURCED_CONTEXT_SCOPE);
      assert.deepEqual(submission.data.routeBinding, input.routeBinding);
      for (const protectedField of [
        'contextPackHash', 'selectedMemoryEventIds', 'droppedMemoryEventIds', 'integrity', 'assetManifestHash', 'assetCount',
      ]) {
        assert.equal(Object.hasOwn(submission.data, protectedField), false, protectedField + ' must be omitted from the memory event');
      }

      const admissionPath = spaces.admissionPath(alpha.id, input.requestId);
      const tampered = JSON.parse(await readFile(admissionPath, 'utf8'));
      tampered.routeBinding.privateContext = 'PRIVATE_CONTEXT';
      await writeFile(admissionPath, JSON.stringify(tampered, null, 2) + '\n', 'utf8');
      await assert.rejects(
        spaces.prepareMissionAdmission(alpha.id, input),
        error => error instanceof ProjectSpaceError && error.code === 'PUBLIC_SOURCED_ROUTE_INVALID',
      );
    } finally {
      spaces.contextPackUnlocked = originalContextPackUnlocked;
    }
  });
});

test('context selection prioritizes relevant durable memory without crossing the byte budget', async () => {
  await withSpaces(async ({spaces}) => {
    const project = await spaces.createProject({name: 'Atlas'});
    await spaces.appendMemoryEvent(project.id, {
      kind: 'decision.documented',
      author: 'system',
      source: 'system',
      text: 'Decisión: cada informe de cumplimiento debe citar su evidencia primaria.',
      data: {category: 'governance'},
    });
    await spaces.recordMessage(project.id, {text: 'Ruido no relacionado. '.repeat(8_000)});
    const pack = await spaces.contextPack(project.id, {maxBytes: 4 * 1024, query: 'cumplimiento evidencia primaria'});
    assert.equal(pack.selection.algorithm, 'relevance-and-recent-canonical-events-v2');
    assert.equal(pack.memory.some(event => event.kind === 'decision.documented'), true);
    assert.equal(Buffer.byteLength(JSON.stringify(pack), 'utf8') <= 4 * 1024, true);
  });
});

test('hash-linked memory blocks new records after an integrity failure instead of silently repairing content', async () => {
  await withSpaces(async ({spaces}) => {
    const project = await spaces.createProject({name: 'Atlas'});
    await spaces.recordMessage(project.id, {text: 'Registro original.'});
    const paths = spaces.projectPaths(project.id);
    await writeFile(paths.memoryLedger, '{"forged":true}\n', {encoding: 'utf8'});

    await assert.rejects(
      spaces.recordMessage(project.id, {text: 'No debe escribirse encima de una cadena dañada.'}),
      error => error instanceof ProjectSpaceError && error.code === 'MEMORY_INTEGRITY_BLOCKED',
    );
  });
});

test('project identifiers and model policy have narrow contracts', () => {
  assert.throws(() => assertProjectId('../project:anything'), /no es válido/);
  const policy = normalizeModelPolicy({model: 'gpt-6-astra', effort: 'ultra'});
  assert.equal(policy.model, 'gpt-6-astra');
  assert.equal(policy.effort, 'ultra');
  assert.equal(policy.admission, 'mission-snapshot-v1');
  assert.equal(policy.roleRouting, 'factory-mission-policy-v2');
  assert.equal(policy.version, 1);
  assert.throws(() => normalizeModelPolicy({model: '../../shell'}), /modelo no es válido/i);
  assert.throws(() => normalizeModelPolicy({effort: 'impossible'}), /razonamiento no es válido/i);
});

test('project asset vault preserves binary originals, seals mission snapshots, and rejects unsafe or aborted intake', async () => {
  await withSpaces(async ({root, spaces}) => {
    const alpha = await spaces.createProject({name: 'Atlas assets', modelPolicy: {model: 'gpt-5.6-terra', effort: 'high'}});
    const beta = await spaces.createProject({name: 'Boreal assets', modelPolicy: {model: 'gpt-5.6-terra', effort: 'high'}});
    const binary = Buffer.from([0, 255, 1, 0, 13, 10, 128, 64, 42]);
    const sha256 = createHash('sha256').update(binary).digest('hex');
    const reserved = await spaces.reserveAssetUpload(alpha.id, {
      filename: '../../contrato\\evidencia.bin',
      mediaType: 'application/octet-stream',
      size: binary.length,
      sha256,
    });
    async function* binarySource() { yield binary; }
    const asset = await spaces.commitAssetUpload(alpha.id, reserved.reservation.id, binarySource(), {contentLength: binary.length, contentType: 'application/octet-stream'});
    assert.equal(asset.filename, 'evidencia.bin');
    assert.equal(asset.sha256, sha256);
    assert.deepEqual(await readFile(spaces.assetObjectPath(alpha.id, sha256)), binary);
    const paths = spaces.projectPaths(alpha.id);
    for (const directory of [
      paths.assets,
      paths.assetStaging,
      paths.assetObjects,
      paths.assetRecords,
      paths.deliverables,
      paths.deliverableObjects,
      paths.deliverableRecords,
    ]) {
      assert.equal((await lstat(directory)).mode & 0o777, 0o700);
    }
    const listed = await spaces.listAssets(alpha.id);
    assert.deepEqual(listed, [asset]);
    assert.equal(JSON.stringify(listed).includes('objectPath'), false);
    assert.equal(JSON.stringify(listed).includes(binary.toString('base64')), false);

    const requestId = 'submission:abababab-abab-4bab-8bab-abababababab';
    const admission = await spaces.prepareMissionAdmission(alpha.id, {
      requestId,
      originalIntent: 'Usa el contrato adjunto como evidencia del proyecto.',
      entryMode: 'planned',
      preset: 'adaptive-v2',
      model: null,
      effort: null,
      factoryOptions: {},
      assetReferences: [{assetId: asset.id}],
    }, {resolveModelTarget: async policy => ({...policy, model: 'gpt-5.6-terra', effort: 'high'})});
    assert.deepEqual(admission.assetReferences, [{id: asset.id, sha256, mediaType: 'application/octet-stream', size: binary.length}]);
    assert.equal(JSON.stringify(admission.assetReferences).includes('objectPath'), false);
    assert.deepEqual(await spaces.assetManifestForAdmission(alpha.id, admission.assetReferences), [{
      assetId: asset.id,
      sha256,
      mediaType: 'application/octet-stream',
      size: binary.length,
      filename: 'evidencia.bin',
    }]);
    await spaces.acceptMissionAdmission(alpha.id, requestId, linkedMissionId);
    const linked = await spaces.finalizeMissionAdmission(alpha.id, requestId);
    assert.deepEqual(linked.mapping.assetReferences, admission.assetReferences);
    const original = await spaces.openAssetOriginal(alpha.id, asset.id, {missionId: linkedMissionId});
    const downloaded = Buffer.concat(await (async () => {
      const chunks = [];
      for await (const chunk of original.stream) chunks.push(chunk);
      return chunks;
    })());
    assert.deepEqual(downloaded, binary);

    await assert.rejects(
      spaces.prepareMissionAdmission(beta.id, {
        requestId: 'submission:bcbcbcbc-bcbc-4bcb-8bcb-bcbcbcbcbcbc',
        originalIntent: 'Intenta tomar un archivo de otro proyecto.',
        entryMode: 'planned',
        preset: 'adaptive-v2',
        model: null,
        effort: null,
        factoryOptions: {},
        assetReferences: [{assetId: asset.id}],
      }, {resolveModelTarget: async policy => ({...policy, model: 'gpt-5.6-terra', effort: 'high'})}),
      error => error instanceof ProjectSpaceError && error.code === 'ASSET_REFERENCE_UNAVAILABLE',
    );

    const mismatchData = Buffer.from('not-the-reserved-content');
    const mismatch = await spaces.reserveAssetUpload(alpha.id, {
      filename: 'mismatch.bin', mediaType: 'application/octet-stream', size: mismatchData.length,
      sha256: createHash('sha256').update('different-content-here').digest('hex'),
    });
    async function* mismatchSource() { yield mismatchData; }
    await assert.rejects(
      spaces.commitAssetUpload(alpha.id, mismatch.reservation.id, mismatchSource(), {contentLength: mismatchData.length, contentType: 'application/octet-stream'}),
      error => error instanceof ProjectSpaceError && error.code === 'ASSET_UPLOAD_HASH_MISMATCH',
    );
    assert.equal(existsSync(spaces.assetStagePath(alpha.id, mismatch.reservation.id)), false);
    assert.equal(existsSync(spaces.assetReservationPath(alpha.id, mismatch.reservation.id)), false);

    const oversize = await spaces.reserveAssetUpload(alpha.id, {
      filename: 'oversize.bin', mediaType: 'application/octet-stream', size: 2,
      sha256: createHash('sha256').update(Buffer.from([1, 2])).digest('hex'),
    });
    async function* oversizeSource() { yield Buffer.from([1, 2, 3]); }
    await assert.rejects(
      spaces.commitAssetUpload(alpha.id, oversize.reservation.id, oversizeSource(), {contentType: 'application/octet-stream'}),
      error => error instanceof ProjectSpaceError && error.code === 'ASSET_UPLOAD_TOO_LARGE',
    );
    assert.equal(existsSync(spaces.assetStagePath(alpha.id, oversize.reservation.id)), false);
    assert.equal(existsSync(spaces.assetReservationPath(alpha.id, oversize.reservation.id)), false);

    const aborted = await spaces.reserveAssetUpload(alpha.id, {
      filename: 'aborted.bin', mediaType: 'application/octet-stream', size: 4,
      sha256: createHash('sha256').update(Buffer.from([1, 2, 3, 4])).digest('hex'),
    });
    async function* abortedSource() {
      yield Buffer.from([1, 2]);
      const error = new Error('connection closed');
      error.code = 'ECONNRESET';
      throw error;
    }
    await assert.rejects(
      spaces.commitAssetUpload(alpha.id, aborted.reservation.id, abortedSource(), {contentType: 'application/octet-stream'}),
      error => error instanceof ProjectSpaceError && error.code === 'ASSET_UPLOAD_ABORTED',
    );
    assert.equal(existsSync(spaces.assetStagePath(alpha.id, aborted.reservation.id)), false);
    assert.equal(existsSync(spaces.assetReservationPath(alpha.id, aborted.reservation.id)), false);

    const recordPath = spaces.assetRecordPath(alpha.id, asset.id);
    const poisonPath = join(root, 'unsafe-record.json');
    await writeFile(poisonPath, '{"not":"a record"}\n', 'utf8');
    await rm(recordPath, {force: true});
    await symlink(poisonPath, recordPath);
    await assert.rejects(
      spaces.listAssets(alpha.id),
      error => error instanceof ProjectSpaceError && error.code === 'ASSET_PATH_UNSAFE',
    );
  });
});

test('text asset derivation is admission-bound, hash-verified, project-local, and refuses unsupported binaries', async () => {
  await withSpaces(async ({spaces}) => {
    const project = await spaces.createProject({name: 'Atlas extracción'});
    const text = 'Cliente Atlas\nDato de entrada no verificado.\n';
    const raw = Buffer.from(text, 'utf8');
    const sha256 = createHash('sha256').update(raw).digest('hex');
    const reservation = await spaces.reserveAssetUpload(project.id, {
      filename: 'brief.csv', mediaType: 'text/csv', size: raw.length, sha256,
    });
    async function* source() { yield raw; }
    const asset = await spaces.commitAssetUpload(project.id, reservation.reservation.id, source(), {
      contentLength: raw.length, contentType: 'text/csv',
    });
    const requestId = 'submission:dddddddd-dddd-4ddd-8ddd-dddddddddddd';
    const admission = await spaces.prepareMissionAdmission(project.id, {
      requestId,
      originalIntent: 'Analiza sólo el archivo adjunto.',
      entryMode: 'planned', preset: 'adaptive-v2', model: null, effort: null,
      factoryOptions: {}, assetReferences: [{assetId: asset.id}],
    }, {resolveModelTarget: async () => ({model: 'gpt-5.6-terra', effort: 'high'})});

    const derivations = await spaces.prepareTextAssetDerivations(project.id, {
      admissionId: admission.admissionId,
      requestId,
      references: admission.assetReferences,
    });
    assert.equal(derivations.length, 1);
    assert.equal(derivations[0].assetId, asset.id);
    assert.equal(derivations[0].assetSha256, sha256);
    assert.equal(derivations[0].content, text);
    assert.match(derivations[0].inputPath, /^assets\/derived\/[a-f0-9]{48}\.txt$/);
    assert.notEqual(derivations[0].inputPath.includes(asset.filename), true);

    const repeated = await spaces.prepareTextAssetDerivations(project.id, {
      admissionId: admission.admissionId,
      requestId,
      references: admission.assetReferences,
    });
    assert.equal(repeated[0].extractionId, derivations[0].extractionId);
    assert.equal(repeated[0].content, text);

    const binary = Buffer.from([37, 80, 68, 70, 45, 0, 255]);
    const binaryReservation = await spaces.reserveAssetUpload(project.id, {
      filename: 'contrato.pdf', mediaType: 'application/pdf', size: binary.length,
      sha256: createHash('sha256').update(binary).digest('hex'),
    });
    async function* binarySource() { yield binary; }
    const unsupported = await spaces.commitAssetUpload(project.id, binaryReservation.reservation.id, binarySource(), {
      contentLength: binary.length, contentType: 'application/pdf',
    });
    await assert.rejects(
      spaces.prepareTextAssetDerivations(project.id, {
        admissionId: admission.admissionId,
        requestId,
        references: [{id: unsupported.id, sha256: unsupported.sha256, mediaType: unsupported.mediaType, size: unsupported.size}],
      }),
      error => error instanceof ProjectSpaceError && error.code === 'ASSET_EXTRACTION_ADMISSION_BINDING',
    );

    const pdfRequestId = 'submission:eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
    const pdfAdmission = await spaces.prepareMissionAdmission(project.id, {
      requestId: pdfRequestId,
      originalIntent: 'Analiza el PDF adjunto.',
      entryMode: 'planned', preset: 'adaptive-v2', model: null, effort: null,
      factoryOptions: {}, assetReferences: [{assetId: unsupported.id}],
    }, {resolveModelTarget: async () => ({model: 'gpt-5.6-terra', effort: 'high'})});
    await assert.rejects(
      spaces.prepareTextAssetDerivations(project.id, {
        admissionId: pdfAdmission.admissionId,
        requestId: pdfRequestId,
        references: pdfAdmission.assetReferences,
      }),
      error => error instanceof ProjectSpaceError && error.code === 'ASSET_EXTRACTION_UNSUPPORTED',
    );

    const bomText = '\ufeffcabecera,valor\nuno,dos\n';
    const bomRaw = Buffer.from(bomText, 'utf8');
    const bomReservation = await spaces.reserveAssetUpload(project.id, {
      filename: 'bom.csv', mediaType: 'text/csv', size: bomRaw.length,
      sha256: createHash('sha256').update(bomRaw).digest('hex'),
    });
    async function* bomSource() { yield bomRaw; }
    const bomAsset = await spaces.commitAssetUpload(project.id, bomReservation.reservation.id, bomSource(), {
      contentLength: bomRaw.length, contentType: 'text/csv',
    });
    const bomRequestId = 'submission:ffffffff-ffff-4fff-8fff-ffffffffffff';
    const bomAdmission = await spaces.prepareMissionAdmission(project.id, {
      requestId: bomRequestId,
      originalIntent: 'Analiza el CSV UTF-8 adjunto.',
      entryMode: 'planned', preset: 'adaptive-v2', model: null, effort: null,
      factoryOptions: {}, assetReferences: [{assetId: bomAsset.id}],
    }, {resolveModelTarget: async () => ({model: 'gpt-5.6-terra', effort: 'high'})});
    const bomDerivation = await spaces.prepareTextAssetDerivations(project.id, {
      admissionId: bomAdmission.admissionId,
      requestId: bomRequestId,
      references: bomAdmission.assetReferences,
    });
    assert.equal(bomDerivation[0].content, bomText);
    assert.equal(bomDerivation[0].sha256, createHash('sha256').update(bomRaw).digest('hex'));

    const maxFile = Buffer.alloc(256 * 1024, 0x61);
    const extraByte = Buffer.from('z');
    const uploadText = async (filename, value, mediaType = 'text/plain') => {
      const reservation = await spaces.reserveAssetUpload(project.id, {
        filename, mediaType, size: value.length,
        sha256: createHash('sha256').update(value).digest('hex'),
      });
      async function* source() { yield value; }
      return spaces.commitAssetUpload(project.id, reservation.reservation.id, source(), {
        contentLength: value.length, contentType: mediaType,
      });
    };
    const masquerade = await uploadText('not-a-pdf.txt', Buffer.from('%PDF-1.7\nnot actually a text document\n', 'utf8'));
    const masqueradeRequestId = 'submission:12121212-1212-4121-8121-121212121212';
    const masqueradeAdmission = await spaces.prepareMissionAdmission(project.id, {
      requestId: masqueradeRequestId,
      originalIntent: 'Lee el supuesto texto adjunto.',
      entryMode: 'planned', preset: 'adaptive-v2', model: null, effort: null,
      factoryOptions: {}, assetReferences: [{assetId: masquerade.id}],
    }, {resolveModelTarget: async () => ({model: 'gpt-5.6-terra', effort: 'high'})});
    await assert.rejects(
      spaces.prepareTextAssetDerivations(project.id, {
        admissionId: masqueradeAdmission.admissionId,
        requestId: masqueradeRequestId,
        references: masqueradeAdmission.assetReferences,
      }),
      error => error instanceof ProjectSpaceError && error.code === 'ASSET_EXTRACTION_UNSUPPORTED',
    );

    const malformedJson = await uploadText('malformed.json', Buffer.from('{"incomplete":', 'utf8'), 'application/json');
    const malformedRequestId = 'submission:13131313-1313-4131-8131-131313131313';
    const malformedAdmission = await spaces.prepareMissionAdmission(project.id, {
      requestId: malformedRequestId,
      originalIntent: 'Lee el JSON adjunto.',
      entryMode: 'planned', preset: 'adaptive-v2', model: null, effort: null,
      factoryOptions: {}, assetReferences: [{assetId: malformedJson.id}],
    }, {resolveModelTarget: async () => ({model: 'gpt-5.6-terra', effort: 'high'})});
    await assert.rejects(
      spaces.prepareTextAssetDerivations(project.id, {
        admissionId: malformedAdmission.admissionId,
        requestId: malformedRequestId,
        references: malformedAdmission.assetReferences,
      }),
      error => error instanceof ProjectSpaceError && error.code === 'ASSET_EXTRACTION_JSON_INVALID',
    );

    const jsonLd = await uploadText('context.jsonld', Buffer.from('{"@context":"https://example.invalid/context"}', 'utf8'), 'application/ld+json');
    const jsonLdRequestId = 'submission:14141414-1414-4141-8141-141414141414';
    const jsonLdAdmission = await spaces.prepareMissionAdmission(project.id, {
      requestId: jsonLdRequestId,
      originalIntent: 'Lee el JSON-LD adjunto.',
      entryMode: 'planned', preset: 'adaptive-v2', model: null, effort: null,
      factoryOptions: {}, assetReferences: [{assetId: jsonLd.id}],
    }, {resolveModelTarget: async () => ({model: 'gpt-5.6-terra', effort: 'high'})});
    await assert.rejects(
      spaces.prepareTextAssetDerivations(project.id, {
        admissionId: jsonLdAdmission.admissionId,
        requestId: jsonLdRequestId,
        references: jsonLdAdmission.assetReferences,
      }),
      error => error instanceof ProjectSpaceError && error.code === 'ASSET_EXTRACTION_UNSUPPORTED',
    );
    const [largeA, largeB, overflow] = await Promise.all([
      uploadText('a.txt', maxFile), uploadText('b.txt', maxFile), uploadText('overflow.txt', extraByte),
    ]);
    const totalRequestId = 'submission:abababab-cdef-4abc-8def-abcdefabcdef';
    const totalAdmission = await spaces.prepareMissionAdmission(project.id, {
      requestId: totalRequestId,
      originalIntent: 'Compara los tres textos adjuntos.',
      entryMode: 'planned', preset: 'adaptive-v2', model: null, effort: null,
      factoryOptions: {}, assetReferences: [{assetId: largeA.id}, {assetId: largeB.id}, {assetId: overflow.id}],
    }, {resolveModelTarget: async () => ({model: 'gpt-5.6-terra', effort: 'high'})});
    await assert.rejects(
      spaces.prepareTextAssetDerivations(project.id, {
        admissionId: totalAdmission.admissionId,
        requestId: totalRequestId,
        references: totalAdmission.assetReferences,
      }),
      error => error instanceof ProjectSpaceError && error.code === 'ASSET_EXTRACTION_TOTAL_LIMIT',
    );
  });
});

test('a verified final delivery returns to exactly one linked conversation without trusting browser-supplied agent text', async () => {
  await withSpaces(async ({spaces}) => {
    const project = await spaces.createProject({name: 'Atlas conversación'});
    const intent = 'Prepara una respuesta final con procedencia para Atlas.';
    const user = await spaces.recordMessage(project.id, {text: intent});
    const requestId = 'submission:abababab-abab-4bab-8bab-abababababab';
    const admission = await spaces.prepareMissionAdmission(project.id, {
      requestId,
      originalIntent: intent,
      entryMode: 'planned',
      preset: 'adaptive-v2',
      model: null,
      effort: null,
      factoryOptions: {},
      attachmentManifestHash: null,
    }, {resolveModelTarget: async () => ({model: 'gpt-5.6-terra', effort: 'high'})});
    const request = await spaces.prepareConversationMissionRequest(project.id, {
      conversationId: user.conversation.id,
      sourceMessageId: user.message.id,
      requestId,
      intent,
      assetManifestHash: null,
    });
    const repeatedRequest = await spaces.prepareConversationMissionRequest(project.id, {
      conversationId: user.conversation.id,
      sourceMessageId: user.message.id,
      requestId,
      intent,
      assetManifestHash: null,
    });
    assert.equal(repeatedRequest.idempotent, true);
    assert.equal(repeatedRequest.requestKey, request.requestKey);
    await assert.rejects(
      spaces.prepareConversationMissionRequest(project.id, {
        conversationId: user.conversation.id,
        sourceMessageId: user.message.id,
        requestId: 'submission:cdcdcdcd-cdcd-4dcd-8dcd-cdcdcdcdcdcd',
        intent: intent + ' alterado',
        assetManifestHash: null,
      }),
      error => error instanceof ProjectSpaceError && error.code === 'CONVERSATION_MISSION_SOURCE_MISMATCH',
    );

    const accepted = await spaces.acceptMissionAdmission(project.id, requestId, linkedMissionId);
    const finalized = await spaces.finalizeMissionAdmission(project.id, requestId);
    assert.equal(accepted.missionId, linkedMissionId);
    const link = await spaces.linkConversationMission(project.id, {
      request,
      missionId: linkedMissionId,
      admissionId: finalized.admissionId,
      mapping: finalized.mapping,
      intentHash: finalized.originalIntentHash,
      assetManifestHash: null,
    });
    assert.equal(link.state, 'LINKED');
    assert.equal(link.conversationId, user.conversation.id);
    assert.deepEqual(await spaces.listPendingServerDeliveryReconciliations(project.id), [linkedMissionId]);

    const body = 'Entrega final verificable para Atlas.\n';
    const staged = await spaces.stageTextDeliverable(project.id, {
      schema: 'sovereign.public-text-delivery.v1',
      missionId: linkedMissionId,
      status: 'ACCEPTED',
      artifact: {id: 'artifact:atlas-conversation-final', payloadHash: 'c'.repeat(64)},
      content: {
        mediaType: 'text/plain; charset=utf-8',
        sha256: createHash('sha256').update(body).digest('hex'),
        bytes: Buffer.byteLength(body, 'utf8'),
        body,
      },
    });
    const final = await spaces.recordMissionFinalConversationTurn(project.id, {
      missionId: linkedMissionId,
      deliveryId: staged.id,
    });
    assert.equal(final.state, 'FINAL_LINKED');
    assert.equal(final.presentation.mode, 'inline-v1');
    assert.equal((await spaces.recordMissionFinalConversationTurn(project.id, {
      missionId: linkedMissionId,
      deliveryId: staged.id,
    })).idempotent, true);
    assert.deepEqual(await spaces.listPendingServerDeliveryReconciliations(project.id), []);

    const messages = await spaces.listMessages(project.id, user.conversation.id);
    assert.equal(messages.length, 2);
    assert.equal(messages[1].author, 'agent');
    assert.equal(messages[1].source, 'verified-mission-delivery');
    assert.equal(messages[1].text, body);
    assert.deepEqual(messages[1].turn, {
      kind: 'verified-final-delivery',
      missionId: linkedMissionId,
      deliveryId: staged.id,
      artifactId: 'artifact:atlas-conversation-final',
      content: staged.content,
      presentation: {mode: 'inline-v1'},
    });
  });
});

test('a historical v1 conversation link remains deliverable but is never opted into restart recovery', async () => {
  await withSpaces(async ({spaces}) => {
    const project = await spaces.createProject({name: 'Atlas vínculo histórico'});
    const intent = 'Entrega histórica que conserva su contrato original.';
    const user = await spaces.recordMessage(project.id, {text: intent});
    const requestId = 'submission:acacacac-acac-4cac-8cac-acacacacacac';
    const admission = await spaces.prepareMissionAdmission(project.id, {
      requestId,
      originalIntent: intent,
      entryMode: 'planned',
      preset: 'adaptive-v2',
      model: null,
      effort: null,
      factoryOptions: {},
      attachmentManifestHash: null,
    }, {resolveModelTarget: async () => ({model: 'gpt-5.6-terra', effort: 'high'})});
    const request = await spaces.prepareConversationMissionRequest(project.id, {
      conversationId: user.conversation.id,
      sourceMessageId: user.message.id,
      requestId,
      intent,
      assetManifestHash: null,
    });
    await spaces.acceptMissionAdmission(project.id, requestId, linkedMissionId);
    const finalized = await spaces.finalizeMissionAdmission(project.id, requestId);
    await spaces.appendMemoryEvent(project.id, {
      kind: 'conversation.mission.linked',
      author: 'system',
      source: 'system',
      conversationId: user.conversation.id,
      missionId: linkedMissionId,
      text: 'Vínculo histórico v1.',
      data: {
        schema: 'sublimine.conversation-mission-link.v1',
        requestKey: request.requestKey,
        requestId,
        admissionId: finalized.admissionId,
        sourceMessageId: user.message.id,
        intentHash: finalized.originalIntentHash,
        mappingHash: createHash('sha256').update(canonical(finalized.mapping)).digest('hex'),
      },
    });
    assert.deepEqual(await spaces.listPendingServerDeliveryReconciliations(project.id), []);

    const body = 'Entrega histórica comprobable.\n';
    const staged = await spaces.stageTextDeliverable(project.id, {
      schema: 'sovereign.public-text-delivery.v1',
      missionId: linkedMissionId,
      status: 'ACCEPTED',
      artifact: {id: 'artifact:atlas-historical-final', payloadHash: 'd'.repeat(64)},
      content: {
        mediaType: 'text/plain; charset=utf-8',
        sha256: createHash('sha256').update(body).digest('hex'),
        bytes: Buffer.byteLength(body, 'utf8'),
        body,
      },
    });
    assert.equal((await spaces.recordMissionFinalConversationTurn(project.id, {
      missionId: linkedMissionId,
      deliveryId: staged.id,
    })).state, 'FINAL_LINKED');
  });
});

test('sealed delivery inbox only exposes one unambiguous, unlinked no-body delivery per mission', async () => {
  await withSpaces(async ({spaces}) => {
    const project = await spaces.createProject({name: 'Atlas inbox sellado'});
    const ids = {
      visible: 'mission:10101010-1010-4010-8010-101010101010',
      linked: 'mission:20202020-2020-4020-8020-202020202020',
      final: 'mission:30303030-3030-4030-8030-303030303030',
      duplicateDelivery: 'mission:40404040-4040-4040-8040-404040404040',
      duplicateMapping: 'mission:50505050-5050-4050-8050-505050505050',
    };
    const stage = async (missionId, label) => {
      await spaces.recordMission(project.id, {missionId, intent: 'Misión de inbox ' + label + '.'});
      const body = 'Contenido sellado que nunca debe aparecer en el inbox: ' + label + '.\n';
      return spaces.stageTextDeliverable(project.id, {
        schema: 'sovereign.public-text-delivery.v1',
        missionId,
        status: 'ACCEPTED',
        artifact: {
          id: 'artifact:inbox-' + label,
          payloadHash: createHash('sha256').update('payload:' + label).digest('hex'),
        },
        content: {
          mediaType: 'text/plain; charset=utf-8',
          sha256: createHash('sha256').update(body).digest('hex'),
          bytes: Buffer.byteLength(body, 'utf8'),
          body,
        },
      });
    };

    const visible = await stage(ids.visible, 'visible');
    await stage(ids.linked, 'linked');
    await spaces.appendMemoryEvent(project.id, {
      kind: 'conversation.mission.linked',
      author: 'system',
      source: 'system',
      conversationId: 'conversation:20202020-2020-4020-8020-202020202020',
      missionId: ids.linked,
      text: 'Vínculo incluso si sus detalles posteriores son incompletos.',
      data: {legacy: true},
    });
    await stage(ids.final, 'final');
    await spaces.appendMemoryEvent(project.id, {
      kind: 'conversation.message',
      author: 'agent',
      source: 'verified-mission-delivery',
      conversationId: 'conversation:30303030-3030-4030-8030-303030303030',
      missionId: ids.final,
      text: 'Registro de entrega que bloquea una recuperación ciega.',
      data: {legacy: true},
    });
    await stage(ids.duplicateDelivery, 'duplicate-a');
    await spaces.stageTextDeliverable(project.id, {
      schema: 'sovereign.public-text-delivery.v1',
      missionId: ids.duplicateDelivery,
      status: 'ACCEPTED',
      artifact: {id: 'artifact:inbox-duplicate-b', payloadHash: 'b'.repeat(64)},
      content: {
        mediaType: 'text/plain; charset=utf-8',
        sha256: createHash('sha256').update('Segundo candidato sellado.\n').digest('hex'),
        bytes: Buffer.byteLength('Segundo candidato sellado.\n', 'utf8'),
        body: 'Segundo candidato sellado.\n',
      },
    });
    await stage(ids.duplicateMapping, 'duplicate-mapping');
    await spaces.recordMission(project.id, {missionId: ids.duplicateMapping, intent: 'Segundo mapping ambiguo.'});

    const inbox = await spaces.listUnlinkedSealedDeliveryInbox(project.id);
    assert.deepEqual(inbox, {
      schema: 'sublimine.delivery-inbox-projection.v1',
      projectId: project.id,
      items: [{
        state: 'SEALED_UNLINKED',
        delivery: visible,
        conversation: {state: 'NO_VERIFIED_LINK'},
      }],
    });
    assert.equal(JSON.stringify(inbox).includes('Contenido sellado que nunca debe aparecer'), false);
    assert.equal(Object.hasOwn(inbox.items[0].delivery.content, 'body'), false);
  });
});

test('sealed delivery inbox blocks on a non-verifiable memory ledger', async () => {
  await withSpaces(async ({spaces}) => {
    const project = await spaces.createProject({name: 'Atlas inbox íntegro'});
    const missionId = 'mission:60606060-6060-4060-8060-606060606060';
    await spaces.recordMission(project.id, {missionId, intent: 'Misión con entrega sellada.'});
    const body = 'Resultado sellado.\n';
    await spaces.stageTextDeliverable(project.id, {
      schema: 'sovereign.public-text-delivery.v1',
      missionId,
      status: 'ACCEPTED',
      artifact: {id: 'artifact:inbox-integrity', payloadHash: 'c'.repeat(64)},
      content: {
        mediaType: 'text/plain; charset=utf-8',
        sha256: createHash('sha256').update(body).digest('hex'),
        bytes: Buffer.byteLength(body, 'utf8'),
        body,
      },
    });
    await writeFile(spaces.projectPaths(project.id).memoryLedger, '{"forged":true}\n', 'utf8');
    await assert.rejects(
      spaces.listUnlinkedSealedDeliveryInbox(project.id),
      error => error instanceof ProjectSpaceError && error.code === 'MEMORY_INTEGRITY_BLOCKED',
    );
  });
});

test('text final deliverables stay project-scoped, exclude their body from listings, and reject tampering', async () => {
  await withSpaces(async ({spaces}) => {
    const alpha = await spaces.createProject({name: 'Atlas deliverables'});
    const beta = await spaces.createProject({name: 'Boreal deliverables'});
    const alphaMissionId = 'mission:aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    const betaMissionId = 'mission:bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
    await spaces.recordMission(alpha.id, {
      missionId: alphaMissionId,
      intent: 'Genera una entrega final verificable para Atlas.',
    });
    await spaces.recordMission(beta.id, {
      missionId: betaMissionId,
      intent: 'Genera una entrega final verificable para Boreal.',
    });

    const body = 'Resultado final verificable de Atlas.\n';
    const delivery = {
      schema: 'sovereign.public-text-delivery.v1',
      missionId: alphaMissionId,
      status: 'ACCEPTED',
      artifact: {
        id: 'artifact:atlas-final-v1',
        payloadHash: 'a'.repeat(64),
      },
      content: {
        mediaType: 'text/plain; charset=utf-8',
        sha256: createHash('sha256').update(body).digest('hex'),
        bytes: Buffer.byteLength(body, 'utf8'),
        body,
      },
    };

    const staged = await spaces.stageTextDeliverable(alpha.id, delivery);
    assert.match(staged.id, /^delivery:[0-9a-f]{64}$/);
    assert.equal(staged.missionId, alphaMissionId);
    assert.deepEqual(staged.artifact, delivery.artifact);
    assert.equal(Object.hasOwn(staged.content, 'body'), false);
    assert.equal(JSON.stringify(staged).includes(body), false);

    const listed = await spaces.listTextDeliverables(alpha.id);
    assert.deepEqual(listed, [staged]);
    assert.equal(JSON.stringify(listed).includes(body), false);
    assert.deepEqual(await spaces.stageTextDeliverable(alpha.id, delivery), staged);

    const opened = await spaces.openTextDeliverable(alpha.id, staged.id);
    const received = Buffer.concat(await (async () => {
      const chunks = [];
      for await (const chunk of opened.stream) chunks.push(chunk);
      return chunks;
    })()).toString('utf8');
    assert.equal(received, body);
    assert.deepEqual(opened.deliverable, staged);

    await assert.rejects(
      spaces.stageTextDeliverable(alpha.id, {
        ...delivery,
        content: {...delivery.content, body: body + 'alterado'},
      }),
      error => error instanceof ProjectSpaceError && error.code === 'DELIVERY_CONTENT_MISMATCH',
    );
    await assert.rejects(
      spaces.stageTextDeliverable(beta.id, delivery),
      error => error instanceof ProjectSpaceError && error.code === 'DELIVERABLE_MISSION_NOT_FOUND',
    );
    await assert.rejects(
      spaces.openTextDeliverable(beta.id, staged.id),
      error => error instanceof ProjectSpaceError && error.code === 'DELIVERABLE_NOT_FOUND',
    );

    await writeFile(spaces.deliverableObjectPath(alpha.id, staged.content.sha256), 'contenido sustituido', 'utf8');
    await assert.rejects(
      spaces.openTextDeliverable(alpha.id, staged.id),
      error => error instanceof ProjectSpaceError && error.code === 'DELIVERABLE_OBJECT_CHANGED',
    );

    const recordPath = spaces.deliverableRecordPath(alpha.id, staged.id);
    const record = JSON.parse(await readFile(recordPath, 'utf8'));
    // `createdAt` is intentionally outside the deterministic payload ID so
    // a repeated Factory read stays idempotent. It must nevertheless be
    // sealed by the service-local receipt MAC rather than silently mutable.
    record.createdAt = '2026-01-01T00:00:00.000Z';
    await writeFile(recordPath, JSON.stringify(record) + '\n', 'utf8');
    await assert.rejects(
      spaces.listTextDeliverables(alpha.id),
      error => error instanceof ProjectSpaceError && error.code === 'DELIVERABLE_RECORD_INVALID',
    );
  });
});
