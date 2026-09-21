import test from 'node:test';
import assert from 'node:assert/strict';
import {Store} from '../../factory/lib/store.mjs';
import {Authority} from '../../factory/lib/authority.mjs';
import {ArtifactRegistry, assertGenuineArtifactRegistry} from '../../factory/lib/artifacts.mjs';

test('ArtifactRegistry identity accepts a genuine registry bound to its Store', t => {
  const store = new Store(':memory:'), registry = new ArtifactRegistry(store, new Authority(store));
  t.after(() => store.close());
  assert.equal(assertGenuineArtifactRegistry(registry, {store}), registry);
});

test('ArtifactRegistry identity rejects a structurally matching object and a mismatched Store', t => {
  const store = new Store(':memory:'), otherStore = new Store(':memory:'), registry = new ArtifactRegistry(store, new Authority(store));
  t.after(() => { otherStore.close(); store.close(); });
  const facade = {store, assertUsable() {}, committedSequence() { return 1; }, reviewProgress() {}};
  Object.setPrototypeOf(facade, ArtifactRegistry.prototype);
  assert.equal(facade instanceof ArtifactRegistry, true);
  assert.throws(() => assertGenuineArtifactRegistry(facade, {
    store, code: 'FIXTURE_ARTIFACT_REGISTRY', message: 'fixture requires a genuine registry'
  }), {code: 'FIXTURE_ARTIFACT_REGISTRY'});
  assert.throws(() => assertGenuineArtifactRegistry(registry, {
    store: otherStore, code: 'FIXTURE_ARTIFACT_REGISTRY', message: 'fixture requires the matching Store'
  }), {code: 'FIXTURE_ARTIFACT_REGISTRY'});
});

test('ArtifactRegistry identity rejects a Proxy facade around a genuine registry', t => {
  const store = new Store(':memory:'), registry = new ArtifactRegistry(store, new Authority(store));
  t.after(() => store.close());
  const facade = new Proxy(registry, {});
  assert.equal(facade instanceof ArtifactRegistry, true);
  assert.throws(() => assertGenuineArtifactRegistry(facade, {
    store, code: 'FIXTURE_ARTIFACT_REGISTRY', message: 'fixture requires a genuine registry'
  }), {code: 'FIXTURE_ARTIFACT_REGISTRY'});
});
