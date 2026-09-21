import {createHmac, randomBytes, timingSafeEqual} from 'node:crypto';
import {canonical, check, clone, digest, id, identifier, instant, keys, list, sha256, string, timestamp, unique} from './contracts.mjs';

export const CLASSIFICATIONS = Object.freeze(['PUBLIC', 'INTERNAL', 'CONFIDENTIAL', 'RESTRICTED']);
const classify = value => { check(CLASSIFICATIONS.includes(value), 'CLASSIFICATION', 'Unknown classification'); return CLASSIFICATIONS.indexOf(value); };
const subset = (child, parent) => child.every(value => parent.includes(value));
const dispatchBinding=value=>{
  keys(value,['operationId','tool','argsHash']);
  identifier(value.operationId,'dispatch operation ID');identifier(value.tool,'dispatch tool');digest(value.argsHash,'dispatch arguments hash');
  return clone(value);
};
const dispatchConsumptionId=({id,operationId,argsHash})=>`authority-dispatch-consumption:${sha256([id,operationId,argsHash])}`;

// The control plane holds signing material. A model receives scope, never signing keys.
export class Authority {
  constructor(store, {clock = timestamp, key = null, keyId = 'local-authority-v1', existingOnly = false} = {}) {
    this.store = store; this.clock = clock; this.keyId = identifier(keyId);
    check(typeof existingOnly === 'boolean', 'CONFIG', 'existingOnly must be boolean');
    let record = store.get('authority-key', keyId);
    if (!record) {
      check(!existingOnly, 'AUTHORITY_KEY', 'Existing-only authority requires its already persisted signing key');
      record = store.put('authority-key', keyId, {hex: (key ?? randomBytes(32)).toString('hex')}, {expectedVersion: 0});
    }
    this.key = Buffer.from(record.data.hex, 'hex'); check(this.key.length === 32, 'AUTHORITY_KEY', 'Invalid authority key');
  }
  seal(kind, data) {
    const body = {kind, data: clone(data)};
    return {...body, signature: {algorithm: 'HMAC-SHA256', keyId: this.keyId, value: createHmac('sha256', this.key).update(canonical(body)).digest('hex')}};
  }
  open(signed, expectedKind) {
    keys(signed, ['kind', 'data', 'signature']);
    // Capture data properties without invoking accessors. The returned payload
    // must come from the exact bytes authenticated below, never a second read.
    const fields = Object.getOwnPropertyDescriptors(signed);
    check(Reflect.ownKeys(fields).length === 3 && ['kind', 'data', 'signature'].every(k =>
      Object.hasOwn(fields, k) && fields[k].enumerable && Object.hasOwn(fields[k], 'value')),
    'SCHEMA', 'Signed envelopes require exactly three enumerable data properties');
    const kind = fields.kind.value, signature = clone(fields.signature.value);
    keys(signature, ['algorithm', 'keyId', 'value']);
    check(kind === expectedKind && signature.algorithm === 'HMAC-SHA256' && signature.keyId === this.keyId,
      'BAD_SIGNATURE', 'Signature type, algorithm or signing authority is invalid');
    digest(signature.value, 'signature');
    const body = canonical({kind, data: fields.data.value});
    const expected = createHmac('sha256', this.key).update(body).digest();
    check(timingSafeEqual(expected, Buffer.from(signature.value, 'hex')), 'BAD_SIGNATURE', 'Signature did not verify');
    return JSON.parse(body).data;
  }
  issue({missionId, principalId, actions, resources, expiresAt, classification = 'PUBLIC', parent = null, dispatch = null}) {
    identifier(missionId); identifier(principalId); list(actions, 'actions', {min: 1}); list(resources, 'resources', {min: 1});
    unique(actions).forEach(a => identifier(a)); unique(resources).forEach(r => string(r, 'resource', {max: 1000})); classify(classification);
    const issuedAt = this.clock(); check(instant(expiresAt) > instant(issuedAt), 'INVALID_TIME', 'Lease expiry must be in the future');
    check(dispatch===null||typeof dispatch==='object','SCHEMA','Dispatch binding must be null or an exact object');
    const boundDispatch=dispatch===null?null:dispatchBinding(dispatch);
    if(boundDispatch!==null)check(actions.includes(boundDispatch.tool),'AUTHORITY_SCOPE',
      'A one-shot dispatch binding must name an action granted by its lease');
    let parentId = null;
    if (parent) {
      const p = this.open(parent, 'authority.lease'); this.assertActive(p);
      check(p.missionId === missionId && subset(actions, p.actions) && subset(resources, p.resources) && classify(classification) <= classify(p.classification)
        && instant(expiresAt) <= instant(p.expiresAt), 'DELEGATION', 'Delegation exceeds its parent scope');
      check(p.dispatch===undefined,'DELEGATION','A one-shot dispatch permit cannot be delegated or widened');
      parentId = p.id;
    }
    const data = {id: id('lease'), missionId, principalId, actions: [...actions], resources: [...resources], issuedAt, expiresAt, classification, parentId,
      ...(boundDispatch===null?{}:{dispatch:boundDispatch})};
    const signed = this.seal('authority.lease', data);
    this.store.put('lease', data.id, {signed, revoked: false}, {expectedVersion: 0}); return signed;
  }
  assertActive(data, visited = new Set()) {
    check(!visited.has(data.id), 'DELEGATION', 'Lease ancestry is cyclic'); visited.add(data.id);
    check(instant(data.issuedAt) <= instant(this.clock()) && instant(this.clock()) < instant(data.expiresAt), 'LEASE_EXPIRED', 'Lease is not currently active');
    classify(data.classification);
    const stored = this.store.get('lease', data.id);
    check(stored && !stored.data.revoked && canonical(this.open(stored.data.signed, 'authority.lease')) === canonical(data), 'LEASE_REVOKED', 'Lease is absent, altered or revoked');
    if (data.parentId) {
      const parent = this.store.get('lease', data.parentId);
      check(parent, 'DELEGATION', 'Parent lease is missing'); this.assertActive(this.open(parent.data.signed, 'authority.lease'), visited);
    }
  }
  verify(signed, {missionId, principalId, action, resource, classification = 'PUBLIC'}) {
    identifier(missionId); identifier(principalId); identifier(action); string(resource, 'resource'); classify(classification);
    const data = this.open(signed, 'authority.lease'); this.assertActive(data);
    check(data.missionId === missionId && data.principalId === principalId, 'PRINCIPAL', 'Actual caller and mission must match the lease');
    check(data.actions.includes(action) && data.resources.includes(resource), 'AUTHORITY_SCOPE', 'Action or exact resource is outside the lease');
    check(classify(classification) <= classify(data.classification), 'CLASSIFICATION', 'Data exceeds classification ceiling'); return data;
  }
  // Consume a one-shot dispatch permit in the same transaction that crosses
  // the irreversible effect boundary.  Legacy/general leases intentionally
  // remain valid for administrative control-plane APIs; WorkerService issues
  // this bound form for every concrete agent tool operation.
  consumeDispatch(signed,{missionId,principalId,action,resource,classification='PUBLIC',operationId,argsHash}) {
    identifier(operationId,'dispatch operation ID');digest(argsHash,'dispatch arguments hash');
    check(this.store.db.isTransaction,'DISPATCH_PERMIT','One-shot dispatch consumption requires the material transaction');
    const data=this.verify(signed,{missionId,principalId,action,resource,classification});
    if(data.dispatch===undefined)return null;
    const binding=dispatchBinding(data.dispatch);
    check(binding.operationId===operationId&&binding.tool===action&&binding.argsHash===argsHash,
      'DISPATCH_PERMIT','Lease is not bound to this exact operation, tool and arguments');
    const recordId=dispatchConsumptionId({id:data.id,...binding});
    const record=this.store.put('authority-dispatch-consumption',recordId,{schema:'sovereign.authority-dispatch-consumption.v1',
      leaseId:data.id,operationId:binding.operationId,tool:binding.tool,argsHash:binding.argsHash,consumedAt:this.clock()},{expectedVersion:0});
    return {type:record.type,id:record.id,version:record.version,hash:record.hash};
  }
  // Historical provenance readers must not call `verify()` after revocation:
  // they need to establish what the broker consumed at the original dispatch,
  // not whether the permission remains live today.
  assertDispatchConsumed(signed,{operationId,tool,argsHash}) {
    identifier(operationId,'dispatch operation ID');identifier(tool,'dispatch tool');digest(argsHash,'dispatch arguments hash');
    const data=this.open(signed,'authority.lease');
    if(data.dispatch===undefined)return null;
    const binding=dispatchBinding(data.dispatch);
    check(binding.operationId===operationId&&binding.tool===tool&&binding.argsHash===argsHash,
      'DISPATCH_PERMIT','Historical lease dispatch binding differs from the effect');
    const record=this.store.get('authority-dispatch-consumption',dispatchConsumptionId({id:data.id,...binding}),1);
    check(record&&record.data?.schema==='sovereign.authority-dispatch-consumption.v1'
      &&record.data.leaseId===data.id&&record.data.operationId===binding.operationId
      &&record.data.tool===binding.tool&&record.data.argsHash===binding.argsHash,
    'DISPATCH_PERMIT','Historical one-shot dispatch has no immutable consumption record');
    return {type:record.type,id:record.id,version:record.version,hash:record.hash};
  }
  revoke(leaseId, reason) {
    string(reason, 'revocation reason'); const record = this.store.get('lease', leaseId); check(record, 'NOT_FOUND', 'Lease does not exist');
    return this.store.put('lease', leaseId, {...record.data, revoked: true, reason, revokedAt: this.clock()}, {expectedVersion: record.version});
  }
}
