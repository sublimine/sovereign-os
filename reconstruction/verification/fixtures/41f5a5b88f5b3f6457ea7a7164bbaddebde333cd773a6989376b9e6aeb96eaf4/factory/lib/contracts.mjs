import {createHash, randomUUID} from 'node:crypto';

export class ContractError extends Error {
  constructor(code, message, details = {}) { super(message); this.name = 'ContractError'; this.code = code; this.details = details; }
}
export function check(condition, code, message, details) { if (!condition) throw new ContractError(code, message, details); }
export function object(value, label = 'object') {
  check(value !== null && typeof value === 'object' && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype,
    'SCHEMA', `${label} must be a plain object`); return value;
}
export function keys(value, allowed, required = allowed, label = 'object') {
  object(value, label);
  check(Object.keys(value).every(k => allowed.includes(k)), 'SCHEMA', `${label} contains an unknown field`);
  check(required.every(k => Object.hasOwn(value, k)), 'SCHEMA', `${label} is missing a required field`); return value;
}
export function string(value, label = 'string', {max = 1000000, min = 1} = {}) {
  check(typeof value === 'string' && value.length >= min && Buffer.byteLength(value) <= max && !value.includes('\0'),
    'SCHEMA', `${label} must be text within its byte limit`); return value;
}
export function integer(value, label, {min = 0, max = Number.MAX_SAFE_INTEGER} = {}) {
  check(Number.isSafeInteger(value) && value >= min && value <= max, 'SCHEMA', `${label} must be an integer in range`); return value;
}
export function list(value, label, {min = 0, max = 10000} = {}) {
  check(Array.isArray(value) && value.length >= min && value.length <= max, 'SCHEMA', `${label} must be a bounded array`); return value;
}
export function identifier(value, label = 'id') {
  string(value, label, {max: 180}); check(/^[A-Za-z0-9][A-Za-z0-9_.:-]*$/.test(value), 'SCHEMA', `${label} is invalid`); return value;
}
export function unique(values, label = 'values') { check(new Set(values).size === values.length, 'SCHEMA', `${label} must be unique`); return values; }
export function instant(value, label = 'timestamp') {
  string(value, label, {max: 40});
  check(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value,
    'INVALID_TIME', `${label} must be an exact valid UTC timestamp`); return Date.parse(value);
}
export function canonical(value) {
  const seen = new Set();
  function encode(v) {
    if (v === null || typeof v === 'boolean' || typeof v === 'string') return JSON.stringify(v);
    if (typeof v === 'number') { check(Number.isFinite(v) && !Object.is(v, -0), 'SCHEMA', 'Noncanonical number'); return JSON.stringify(v); }
    check(typeof v === 'object' && v !== null && !seen.has(v), 'SCHEMA', 'Only acyclic JSON data is accepted');
    seen.add(v); let result;
    const descriptors = Object.getOwnPropertyDescriptors(v);
    const ownKeys = Reflect.ownKeys(v);
    if (Array.isArray(v)) {
      check(v.length <= 1000000 && ownKeys.length === v.length + 1 && ownKeys.every(k => k === 'length' || typeof k === 'string'
        && /^(0|[1-9][0-9]*)$/.test(k) && Number(k) < v.length && descriptors[k].enumerable && Object.hasOwn(descriptors[k], 'value')),
      'SCHEMA', 'Sparse arrays, named properties and accessors are forbidden');
      result = `[${Array.from({length: v.length}, (_, index) => encode(descriptors[index].value)).join(',')}]`;
    } else {
      object(v); check(ownKeys.every(k => typeof k === 'string' && descriptors[k].enumerable && Object.hasOwn(descriptors[k], 'value')), 'SCHEMA', 'Only enumerable JSON data properties are accepted');
      result = `{${ownKeys.sort().map(k => `${JSON.stringify(k)}:${encode(descriptors[k].value)}`).join(',')}}`;
    }
    seen.delete(v); return result;
  }
  return encode(value);
}
export const sha256 = value => createHash('sha256').update(typeof value === 'string' || Buffer.isBuffer(value) ? value : canonical(value)).digest('hex');
export const clone = value => JSON.parse(canonical(value));
export const id = prefix => `${identifier(prefix)}:${randomUUID()}`;
export const timestamp = () => new Date().toISOString();
export function digest(value, label = 'hash') { check(typeof value === 'string' && /^[a-f0-9]{64}$/.test(value), 'SCHEMA', `${label} must be a SHA256 digest`); return value; }
// Versioned protocol boundaries use stable identifiers such as
// ADAPTIVE_V3_ROUTE_INTEGRITY.  Preserve the conservative all-uppercase
// machine-code surface while allowing decimal revisions within it; never pass
// arbitrary provider text, punctuation, whitespace or lowercase into status.
export function safeCode(error) { return typeof error?.code === 'string' && /^[A-Z_][A-Z0-9_]*$/.test(error.code) ? error.code : 'INTERNAL'; }
