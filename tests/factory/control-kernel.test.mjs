import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHmac} from 'node:crypto';
import {canonical, instant, sha256} from '../../factory/lib/contracts.mjs';
import {Store} from '../../factory/lib/store.mjs';
import {Authority} from '../../factory/lib/authority.mjs';

test('canonical data refuses values that JSON silently drops or changes', () => {
  for (const value of [{x: undefined}, NaN, Infinity, -0, new Date(), [undefined], Array(2)]) assert.throws(() => canonical(value));
  assert.equal(canonical({b: 2, a: 1}), canonical({a: 1, b: 2}));
  assert.notEqual(sha256({a: '1'}), sha256({a: 1}));
});
test('timestamps reject NaN, impossible dates, local times and normalized overflow', () => {
  for (const date of ['bad', '2026-02-30T00:00:00.000Z', '2026-09-09', '2026-09-09T25:00:00.000Z']) assert.throws(() => instant(date));
});
test('CAS, immutable versions and journal survive reopening', () => {
  const root = mkdtempSync(join(tmpdir(), 'sovereign-store-test-')); let s;
  try {
    s = new Store(join(root, 'state.sqlite'));
    const a = s.put('mission', 'mission:test', {intent: 'original'}, {expectedVersion: 0});
    assert.throws(() => s.put('mission', a.id, {intent: 'replacement'}, {expectedVersion: 0}), {code: 'VERSION_CONFLICT'});
    s.put('mission', a.id, {intent: 'original', status: 'RUNNING'}, {expectedVersion: 1});
    assert.equal(s.get('mission', a.id, 1).hash, a.hash);
    assert.throws(() => s.db.exec('DELETE FROM records'));
    const head = s.verifyJournal(); s.close(); s = new Store(join(root, 'state.sqlite'));
    assert.deepEqual(s.verifyJournal(), head); assert.equal(s.get('mission', a.id).version, 2);
  } finally { s?.close(); rmSync(root, {recursive: true, force: true}); }
});
test('transaction rolls back records and journal together', () => {
  const s = new Store(':memory:');
  try { assert.throws(() => s.transact(() => { s.put('mission', 'm', {a: 1}, {expectedVersion: 0}); throw Error('crash before commit'); }));
    assert.equal(s.get('mission', 'm'), null); assert.equal(s.events().length, 0);
    assert.throws(() => s.transact(() => Promise.resolve()), {code: 'ASYNC_TRANSACTION'});
  } finally { s.close(); }
});
function withAuthority(fn) {
  const s = new Store(':memory:'); let now = '2026-09-09T10:00:00.000Z'; const a = new Authority(s, {clock: () => now});
  const lease = a.issue({missionId: 'm', principalId: 'worker:1', actions: ['source.fetch'], resources: ['public-web'], expiresAt: '2026-09-09T11:00:00.000Z'});
  const request = {missionId: 'm', principalId: 'worker:1', action: 'source.fetch', resource: 'public-web'};
  try { fn({s, a, lease, request, setTime: t => now = t}); } finally { s.close(); }
}
test('forged algorithm, key and signature cannot authorize an effect', () => withAuthority(({a, lease, request}) => {
  assert.equal(a.verify(lease, request).principalId, 'worker:1');
  for (const field of ['algorithm', 'keyId', 'value']) {
    const forged = structuredClone(lease); forged.signature[field] = field === 'value' ? '0'.repeat(64) : 'fake';
    assert.throws(() => a.verify(forged, request), {code: 'BAD_SIGNATURE'});
  }
}));
test('missing attestation, wrong principal, out-of-lease resource and classification fail closed', () => withAuthority(({a, lease, request}) => {
  assert.throws(() => a.verify(lease, {...request, principalId: undefined}));
  assert.throws(() => a.verify(lease, {...request, principalId: 'worker:2'}), {code: 'PRINCIPAL'});
  assert.throws(() => a.verify(lease, {...request, resource: 'private-network'}), {code: 'AUTHORITY_SCOPE'});
  assert.throws(() => a.verify(lease, {...request, classification: 'UNKNOWN'}), {code: 'CLASSIFICATION'});
  assert.throws(() => a.verify(lease, {...request, classification: 'RESTRICTED'}), {code: 'CLASSIFICATION'});
}));
test('authority refuses invalid issue times, attenuation violations, revocation and expiry', () => withAuthority(({a, lease, request, setTime}) => {
  const spec = {missionId: 'm', principalId: 'child', actions: ['source.fetch'], resources: ['public-web'], expiresAt: '2026-09-09T10:30:00.000Z', parent: lease};
  assert.throws(() => a.issue({...spec, expiresAt: 'NaN'}), {code: 'INVALID_TIME'});
  assert.throws(() => a.issue({...spec, resources: ['private-network']}), {code: 'DELEGATION'});
  const child = a.issue(spec); a.revoke(lease.data.id, 'owner revoked');
  assert.throws(() => a.verify(child, {...request, principalId: 'child'}), {code: 'LEASE_REVOKED'});
  setTime('2026-09-09T11:00:00.000Z'); assert.throws(() => a.verify(lease, request), {code: 'LEASE_EXPIRED'});
}));

test('a one-shot dispatch permit binds exactly one operation and immutable argument hash',()=>{
  const s=new Store(':memory:'),a=new Authority(s,{clock:()=> '2026-09-09T10:00:00.000Z'});
  try{
    const argsHash=sha256({path:'deliverable.txt'}),lease=a.issue({missionId:'m',principalId:'worker:1',actions:['workspace.write'],
      resources:['workspace:m'],classification:'INTERNAL',expiresAt:'2026-09-09T11:00:00.000Z',
      dispatch:{operationId:'worker:1:step:0',tool:'workspace.write',argsHash}});
    const request={missionId:'m',principalId:'worker:1',action:'workspace.write',resource:'workspace:m',classification:'INTERNAL',
      operationId:'worker:1:step:0',argsHash};
    const consumed=s.transact(()=>a.consumeDispatch(lease,request));
    assert.ok(consumed);assert.deepEqual(a.assertDispatchConsumed(lease,{operationId:request.operationId,tool:'workspace.write',argsHash}),consumed);
    assert.throws(()=>s.transact(()=>a.consumeDispatch(lease,request)),{code:'VERSION_CONFLICT'});
    assert.throws(()=>s.transact(()=>a.consumeDispatch(lease,{...request,operationId:'worker:1:step:1'})),{code:'DISPATCH_PERMIT'});
    assert.throws(()=>s.transact(()=>a.consumeDispatch(lease,{...request,argsHash:sha256({path:'other.txt'})})),{code:'DISPATCH_PERMIT'});
    assert.throws(()=>a.issue({missionId:'m',principalId:'child',actions:['workspace.write'],resources:['workspace:m'],
      classification:'INTERNAL',expiresAt:'2026-09-09T10:30:00.000Z',parent:lease}),{code:'DELEGATION'});
  }finally{s.close();}
});

test('authority snapshot rejects changing data getter before execution', () => withAuthority(({a}) => {
  const original = {scope: 'fixture-read-only'}, signed = a.seal('fixture.snapshot', original); let reads = 0;
  Object.defineProperty(signed, 'data', {enumerable: true, get() { reads++; return reads === 1 ? original : {scope: 'fixture-unverified-write'}; }});
  assert.throws(() => a.open(signed, 'fixture.snapshot'), {code: 'SCHEMA'});
  assert.equal(reads, 0);
}));

test('authority snapshot returns authenticated bytes even when a JavaScript proxy changes its descriptors', () => withAuthority(({a}) => {
  const signed = a.seal('fixture.snapshot', {scope: 'read'}); let captures = 0;
  signed.data = new Proxy({scope: 'read'}, {getOwnPropertyDescriptor(target, key) {
    const descriptor = Reflect.getOwnPropertyDescriptor(target, key);
    if (key === 'scope') return {...descriptor, value: ++captures === 1 ? 'read' : 'write'};
    return descriptor;
  }});
  // Proxy traps can execute in a direct JS call. No claim that this is a JSON
  // input or that traps are inert: only the authenticated snapshot may return.
  assert.deepEqual(a.open(signed, 'fixture.snapshot'), {scope: 'read'});
  assert.equal(captures, 1);
}));

test('authority snapshot rejects accessors throughout envelope and signature without executing them', () => withAuthority(({a}) => {
  for (const path of [['kind'], ['signature'], ['signature', 'algorithm'], ['signature', 'keyId'], ['signature', 'value'], ['data', 'scope']]) {
    const signed = a.seal('fixture.snapshot', {scope: 'read'}), parent = path.length === 1 ? signed : signed[path[0]], name = path.at(-1), original = parent[name]; let reads = 0;
    Object.defineProperty(parent, name, {enumerable: true, get() { reads++; return original; }});
    assert.throws(() => a.open(signed, 'fixture.snapshot'), {code: 'SCHEMA'}, path.join('.'));
    assert.equal(reads, 0, path.join('.'));
  }
}));

test('authority snapshot rejects hidden and symbol properties in all signed layers', () => withAuthority(({a}) => {
  for (const location of ['envelope', 'signature', 'data']) for (const mode of ['hidden-extra', 'symbol', 'hidden-required']) {
    const signed = a.seal('fixture.snapshot', {scope: 'read'}), target = location === 'envelope' ? signed : signed[location];
    if (mode === 'symbol') target[Symbol('unsigned')] = 'extra';
    else if (mode === 'hidden-extra') Object.defineProperty(target, 'unsigned', {value: 'extra'});
    else Object.defineProperty(target, location === 'envelope' ? 'data' : location === 'signature' ? 'value' : 'scope', {enumerable: false});
    assert.throws(() => a.open(signed, 'fixture.snapshot'), {code: 'SCHEMA'}, location + ':' + mode);
  }
}));

test('authority snapshot rejects malformed envelopes, metadata, data and cycles', () => withAuthority(({a}) => {
  const mutations = [s => { delete s.data; }, s => { s.extra = true; }, s => { s.signature.extra = true; },
    s => { s.data.scope = undefined; }, s => { s.data.scope = NaN; }, s => { s.data.scope = -0; },
    s => { s.data.scope = Array(2); }, s => { s.data.self = s.data; }, s => { s.signature.self = s.signature; },
    s => { Object.setPrototypeOf(s, null); }, s => { Object.setPrototypeOf(s.signature, null); }, s => { s.data = new Date(); }];
  for (const mutate of mutations) { const signed = a.seal('fixture.snapshot', {scope: 'read'}); mutate(signed); assert.throws(() => a.open(signed, 'fixture.snapshot'), {code: 'SCHEMA'}); }
}));

test('authority snapshot authenticates body and every signature discriminator on each call', () => withAuthority(({a}) => {
  for (const mutate of [s => { s.kind = 'fixture.different'; }, s => { s.data.scope = 'write'; }, s => { s.signature.algorithm = 'SHA256'; },
    s => { s.signature.keyId = 'different-authority'; }, s => { s.signature.value = '0'.repeat(64); }]) {
    const signed = a.seal('fixture.snapshot', {scope: 'read'}); assert.deepEqual(a.open(signed, 'fixture.snapshot'), {scope: 'read'});
    mutate(signed); assert.throws(() => a.open(signed, 'fixture.snapshot'), {code: 'BAD_SIGNATURE'});
  }
  const signed = a.seal('fixture.snapshot', {}); signed.signature.value = 'malformed';
  assert.throws(() => a.open(signed, 'fixture.snapshot'), {code: 'SCHEMA'});
}));

test('authority snapshot accepts unchanged historical HMAC bytes and returns isolated JSON data', () => {
  const s = new Store(':memory:'), key = Buffer.alloc(32, 0x31), a = new Authority(s, {key});
  try {
    // Explicit historical wire bytes, independent of seal/canonical in this test.
    const body = '{"data":{"a":[null,true,"É😀",{}],"z":2},"kind":"fixture.snapshot"}';
    const signature = {algorithm: 'HMAC-SHA256', keyId: 'local-authority-v1', value: createHmac('sha256', key).update(body).digest('hex')};
    const signed = {...JSON.parse(body), signature}; assert.deepEqual(a.seal(signed.kind, signed.data), signed);
    const opened = a.open(signed, signed.kind); assert.deepEqual(opened, signed.data); opened.a[3].changed = true;
    assert.deepEqual(a.open(signed, signed.kind), JSON.parse(body).data);
    signed.data.a[3].changed = true; assert.throws(() => a.open(signed, signed.kind), {code: 'BAD_SIGNATURE'});
  } finally { s.close(); }
});

test('authority snapshot accepts frozen envelopes, scalars, arrays and repeated references without sharing', () => withAuthority(({a}) => {
  const shared = {text: 'é\u0301😀', empty: {}};
  for (const value of [null, false, 0, '', [], {}, [shared, shared], {left: shared, right: shared}]) {
    const signed = a.seal('fixture.snapshot', value); Object.freeze(signed.signature); Object.freeze(signed);
    const opened = a.open(signed, 'fixture.snapshot'); assert.deepEqual(opened, JSON.parse(canonical(value)));
    if (Array.isArray(opened) && opened.length) assert.notEqual(opened[0], opened[1]);
    if (opened?.left) assert.notEqual(opened.left, opened.right);
  }
}));
