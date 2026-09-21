import assert from 'node:assert/strict';
import test from 'node:test';

import {missionIntentPresentation, missionTitlePresentation} from '../public/mission-presentation.js';

test('legacy mission presentation removes the historical project-context suffix before caching a title', () => {
  const privateContext = 'PRIVATE_PROJECT_CONTEXT_DO_NOT_RENDER';
  const presentation = missionIntentPresentation('Prepara el informe final.\n--- SOVEREIGN_PROJECT_CONTEXT_PACK_V1 ---\n' + privateContext);

  assert.deepEqual(presentation, {intent: 'Prepara el informe final.', legacyContextPack: true});
  const title = missionTitlePresentation({mapping: {missionId: 'mission:legacy'}, cachedIntent: presentation.intent});
  assert.deepEqual(title, {
    title: 'Prepara el informe final.',
    route: 'ADMITTED',
    source: 'DETAIL',
    legacyContextPack: false,
  });
  assert.doesNotMatch(JSON.stringify(title), new RegExp(privateContext));
});

test('hashed current mappings remain recoverable without guessing their mandate', () => {
  const mapping = {
    missionId: 'mission:hashed',
    intentHash: 'a'.repeat(64),
    renderedIntentHash: 'b'.repeat(64),
    projectContext: 'PRIVATE_CONTEXT_DO_NOT_RENDER',
  };
  const beforeDetail = missionTitlePresentation({mapping});
  const afterDetail = missionTitlePresentation({mapping, cachedIntent: 'Analiza los anuncios de coche publicados.'});

  assert.deepEqual(beforeDetail, {
    title: 'Mandato protegido — abrir misión',
    route: 'SEALED',
    source: 'WITHHELD',
    legacyContextPack: false,
  });
  assert.deepEqual(afterDetail, {
    title: 'Analiza los anuncios de coche publicados.',
    route: 'ADMITTED',
    source: 'DETAIL',
    legacyContextPack: false,
  });
  assert.doesNotMatch(JSON.stringify(beforeDetail) + JSON.stringify(afterDetail), /PRIVATE_CONTEXT_DO_NOT_RENDER/);
});

test('a sourced route uses its sealed label until its authorized exact question is cached in memory', () => {
  const input = {
    mapping: {
      missionId: 'mission:sourced',
      entryMode: 'sourced-response-v1',
      intent: 'PRIVATE_OR_WITHHELD_PUBLIC_QUESTION',
    },
  };
  const beforeDetail = missionTitlePresentation(input);
  const afterDetail = missionTitlePresentation({...input, cachedIntent: '¿Qué datos debe mostrar un anuncio de coche?'});

  assert.deepEqual(beforeDetail, {
    title: 'Respuesta pública con fuentes',
    route: 'SOURCED_PUBLIC',
    source: 'SEALED_ROUTE',
    legacyContextPack: false,
  });
  assert.deepEqual(afterDetail, {
    title: '¿Qué datos debe mostrar un anuncio de coche?',
    route: 'SOURCED_PUBLIC',
    source: 'DETAIL',
    legacyContextPack: false,
  });
  assert.doesNotMatch(JSON.stringify(beforeDetail) + JSON.stringify(afterDetail), /PRIVATE_OR_WITHHELD_PUBLIC_QUESTION/);
});
