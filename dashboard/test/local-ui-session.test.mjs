import assert from 'node:assert/strict';
import test from 'node:test';

import {createLocalUiSessionRecovery} from '../public/local-ui-session.js';

function jsonResponse(value, {status = 200} = {}) {
  return new Response(JSON.stringify(value), {
    status,
    headers: {'content-type': 'application/json'},
  });
}

test('an invalid local UI token is renewed through same-origin bootstrap without replaying the failed operation', async () => {
  const requests = [];
  const applied = [];
  const recovery = createLocalUiSessionRecovery({
    fetchImpl: async (...args) => {
      requests.push(args);
      return jsonResponse({token: 'fresh-local-ui-token-123456789', overview: {provider: {ready: true}}});
    },
    applyBootstrap: bootstrap => { applied.push(bootstrap); },
  });

  const failure = await recovery.errorForResponse(
    jsonResponse({message: 'La acción necesita una sesión local válida.', code: 'INVALID_UI_SESSION'}, {status: 403}),
    'fallback',
  );

  assert.equal(failure.code, 'LOCAL_UI_SESSION_RENEWED');
  assert.match(failure.message, /no se ha repetido/i);
  assert.equal(requests.length, 1);
  assert.equal(requests[0][0], '/api/bootstrap');
  assert.deepEqual(requests[0][1], {
    method: 'GET',
    headers: {'accept': 'application/json'},
    credentials: 'same-origin',
    cache: 'no-store',
  });
  assert.equal(applied.length, 1);
  assert.equal(applied[0].token, 'fresh-local-ui-token-123456789');
});

test('simultaneous stale-token failures share one bounded bootstrap renewal', async () => {
  let bootstrapCalls = 0;
  let resolveBootstrap;
  const pendingBootstrap = new Promise(resolve => { resolveBootstrap = resolve; });
  let applied = 0;
  const recovery = createLocalUiSessionRecovery({
    fetchImpl: async () => {
      bootstrapCalls += 1;
      return pendingBootstrap;
    },
    applyBootstrap: () => { applied += 1; },
  });

  const first = recovery.errorForResponse(jsonResponse({code: 'INVALID_UI_SESSION'}, {status: 403}), 'fallback');
  const second = recovery.errorForResponse(jsonResponse({code: 'INVALID_UI_SESSION'}, {status: 403}), 'fallback');
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(bootstrapCalls, 1);
  resolveBootstrap(jsonResponse({token: 'fresh-local-ui-token-123456789', overview: {}}));
  const [firstFailure, secondFailure] = await Promise.all([first, second]);
  assert.equal(firstFailure.code, 'LOCAL_UI_SESSION_RENEWED');
  assert.equal(secondFailure.code, 'LOCAL_UI_SESSION_RENEWED');
  assert.equal(applied, 1);
});

test('a non-session error neither bootstraps nor changes its server code', async () => {
  let bootstrapCalls = 0;
  const recovery = createLocalUiSessionRecovery({
    fetchImpl: async () => {
      bootstrapCalls += 1;
      return jsonResponse({token: 'fresh-local-ui-token-123456789', overview: {}});
    },
    applyBootstrap: () => {},
  });

  const failure = await recovery.errorForResponse(
    jsonResponse({message: 'No permitido.', code: 'CROSS_ORIGIN_REQUEST'}, {status: 403}),
    'fallback',
  );

  assert.equal(failure.code, 'CROSS_ORIGIN_REQUEST');
  assert.equal(failure.message, 'No permitido.');
  assert.equal(bootstrapCalls, 0);
});

test('a malformed or unavailable bootstrap does not accept a replacement token', async () => {
  let applied = 0;
  const recovery = createLocalUiSessionRecovery({
    fetchImpl: async () => jsonResponse({token: 'short', overview: {}}),
    applyBootstrap: () => { applied += 1; },
  });

  const failure = await recovery.errorForResponse(
    jsonResponse({code: 'INVALID_UI_SESSION'}, {status: 403}),
    'fallback',
  );

  assert.equal(failure.code, 'LOCAL_UI_SESSION_RENEWAL_FAILED');
  assert.match(failure.message, /no pudo renovarla/i);
  assert.equal(applied, 0);
});
