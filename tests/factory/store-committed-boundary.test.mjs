import test from 'node:test';
import assert from 'node:assert/strict';
import {Store, assertCommittedStoreBoundary} from '../../factory/lib/store.mjs';

test('committed Store boundary accepts a genuine Store outside a transaction', t => {
  const store = new Store(':memory:');
  t.after(() => store.close());
  assert.equal(assertCommittedStoreBoundary(store), store);
});

test('committed Store boundary rejects a genuine Store during its transaction', t => {
  const store = new Store(':memory:');
  t.after(() => store.close());
  assert.throws(() => store.transact(() => assertCommittedStoreBoundary(store, {
    code: 'FIXTURE_COMMIT_BOUNDARY', message: 'fixture requires a committed boundary'
  })), {code: 'FIXTURE_COMMIT_BOUNDARY'});
});

test('committed Store boundary rejects a raw SQLite transaction on the genuine Store', t => {
  const store = new Store(':memory:');
  t.after(() => store.close());
  store.db.exec('BEGIN IMMEDIATE');
  try {
    assert.throws(() => assertCommittedStoreBoundary(store, {
      code: 'FIXTURE_COMMIT_BOUNDARY', message: 'fixture requires a committed boundary'
    }), {code: 'FIXTURE_COMMIT_BOUNDARY'});
  } finally {
    if (store.db.isTransaction) store.db.exec('ROLLBACK');
  }
});

test('committed Store boundary rejects a delegated facade that lies about db state', t => {
  const store = new Store(':memory:');
  t.after(() => store.close());
  const facade = {
    get: (...args) => store.get(...args),
    put: (...args) => store.put(...args),
    transact: callback => store.transact(callback),
    events: (...args) => store.events(...args),
    db: {isTransaction: false}
  };
  Object.setPrototypeOf(facade, Store.prototype);
  assert.equal(facade instanceof Store, true);
  assert.throws(() => assertCommittedStoreBoundary(facade, {
    code: 'FIXTURE_COMMIT_BOUNDARY', message: 'fixture requires a genuine Store'
  }), {code: 'FIXTURE_COMMIT_BOUNDARY'});
});

test('post-commit observers run only after a successful outer commit and never after rollback', t => {
  const store = new Store(':memory:');
  t.after(() => store.close());
  const observations = [];
  store.transact(() => {
    store.put('fixture', 'fixture:committed', {state: 'READY'}, {expectedVersion: 0});
    store.afterCommit(() => observations.push(store.get('fixture', 'fixture:committed')?.data.state));
    assert.deepEqual(observations, []);
  });
  assert.deepEqual(observations, ['READY']);
  assert.throws(() => store.transact(() => {
    store.afterCommit(() => observations.push('ROLLBACK_SENTINEL'));
    throw Object.assign(Error('rollback fixture'), {code: 'ROLLBACK_FIXTURE'});
  }), {code: 'ROLLBACK_FIXTURE'});
  assert.deepEqual(observations, ['READY']);
});
