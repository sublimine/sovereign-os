// Signed, public operational receipts for a mission.
//
// The generic Store journal is an internal recovery surface.  It can contain
// private execution material and a matching mission ID alone does not prove
// that a row is suitable for a browser.  This module creates a second,
// deliberately small chain: each entry is a re-projection of one exact engine
// event, signed by the local Authority, linked to the immutable mission origin
// and to the preceding signed trace receipt.  It is not a transcript and it
// must never become one.
import {canonical, check, clone, digest, identifier, instant, integer, keys, sha256} from './contracts.mjs';
import {PUBLIC_ENGINE_EVENT_SCHEMA, projectPublicEngineEvent} from './public-engine-event.mjs';

export const PUBLIC_MISSION_TRACE_SCHEMA = 'sublimine.public-mission-trace.v1';
export const PUBLIC_MISSION_TRACE_REVISION = 1;
export const PUBLIC_MISSION_TRACE_KIND = 'sublimine.public-mission-trace';
export const PUBLIC_MISSION_TRACE_RECORD_TYPE = 'sublimine-public-mission-trace';
export const PUBLIC_MISSION_TRACE_HEAD_SCHEMA = 'sublimine.public-mission-trace-head.v1';
export const PUBLIC_MISSION_TRACE_HEAD_KIND = 'sublimine.public-mission-trace-head';
export const PUBLIC_MISSION_TRACE_HEAD_RECORD_TYPE = 'sublimine-public-mission-trace-head';

const EMPTY_SCOPE = 'No hay una traza pública firmada para esta misión. No se reconstruye retrospectivamente a partir del journal interno.';
const VERIFIED_SCOPE = 'Recibos operativos públicos, firmados y encadenados localmente. No son cadena de pensamiento, prompts, mensajes internos, diagnósticos, fuentes crudas, transcripciones, credenciales ni una certificación externa.';
const UNVERIFIED_SCOPE = 'La traza pública no pudo revalidar su cadena firmada. No se proyectan eventos ni detalles internos.';
const DIGEST = /^[a-f0-9]{64}$/;
const MAX_TRACE_ENTRIES = 4096;

const plain = value => value !== null && typeof value === 'object' && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype;
const same = (left, right) => canonical(left) === canonical(right);

function reference(record, {type = null, id = null, version = null} = {}) {
  check(record && typeof record === 'object', 'PUBLIC_TRACE_RECORD', 'A committed trace record is required');
  check(type === null || record.type === type, 'PUBLIC_TRACE_RECORD', 'Trace record type differs from its contract');
  check(id === null || record.id === id, 'PUBLIC_TRACE_RECORD', 'Trace record identifier differs from its contract');
  check(version === null || record.version === version, 'PUBLIC_TRACE_RECORD', 'Trace record version differs from its contract');
  identifier(record.type, 'trace record type');
  identifier(record.id, 'trace record ID');
  integer(record.version, 'trace record version', {min: 1});
  digest(record.hash, 'trace record hash');
  return {type: record.type, id: record.id, version: record.version, hash: record.hash};
}

function referenceShape(value, {type = null, id = null, version = null} = {}) {
  keys(value, ['type', 'id', 'version', 'hash']);
  identifier(value.type, 'trace reference type');
  identifier(value.id, 'trace reference ID');
  integer(value.version, 'trace reference version', {min: 1});
  digest(value.hash, 'trace reference hash');
  check(type === null || value.type === type, 'PUBLIC_TRACE_REFERENCE', 'Trace reference has an unexpected type');
  check(id === null || value.id === id, 'PUBLIC_TRACE_REFERENCE', 'Trace reference has an unexpected identifier');
  check(version === null || value.version === version, 'PUBLIC_TRACE_REFERENCE', 'Trace reference has an unexpected version');
  return clone(value);
}

function recordForReference(store, value, options = {}) {
  const ref = referenceShape(value, options);
  const record = store.get(ref.type, ref.id, ref.version);
  check(record && record.hash === ref.hash, 'PUBLIC_TRACE_REFERENCE', 'Trace reference does not resolve to its immutable record');
  return record;
}

function eventReference(event) {
  check(plain(event), 'PUBLIC_TRACE_EVENT', 'A durable engine event is required');
  integer(event.seq, 'trace event sequence', {min: 1});
  identifier(event.kind, 'trace event kind');
  digest(event.previousHash, 'trace previous event hash');
  digest(event.hash, 'trace event hash');
  instant(event.createdAt, 'trace event timestamp');
  return {seq: event.seq, hash: event.hash, previousHash: event.previousHash, at: event.createdAt};
}

function readExactEvent(store, ref) {
  keys(ref, ['seq', 'hash', 'previousHash', 'at']);
  integer(ref.seq, 'trace event sequence', {min: 1});
  digest(ref.hash, 'trace event hash');
  digest(ref.previousHash, 'trace previous event hash');
  instant(ref.at, 'trace event timestamp');
  const events = store.events({after: ref.seq - 1, limit: 1});
  check(events.length === 1, 'PUBLIC_TRACE_EVENT', 'Trace event is absent from the durable journal');
  const event = events[0];
  check(event.seq === ref.seq && event.hash === ref.hash && event.previousHash === ref.previousHash && event.createdAt === ref.at,
    'PUBLIC_TRACE_EVENT', 'Trace event reference differs from the durable journal');
  return event;
}

function publicEventFor(event) {
  const projected = projectPublicEngineEvent(event);
  check(plain(projected) && projected.schema === PUBLIC_ENGINE_EVENT_SCHEMA && projected.kind !== 'ENGINE_EVENT_RECORDED'
    && typeof projected.missionId === 'string', 'PUBLIC_TRACE_EVENT', 'Engine event has no eligible public mission projection');
  identifier(projected.missionId, 'public trace mission ID');
  return clone(projected);
}

// This scan is an integrity check only. It never projects journal rows to a
// caller: it proves that the signed chain covers every eligible, allow-listed
// engine event for this mission. Without it, a valid head could describe a
// truthful subset and still be mistaken for a complete operational trace.
function expectedPublicMissionEvents(store, missionId) {
  const expected=[];
  let after=0;
  for(;;){
    const events=store.events({after,limit:1000});
    if(!events.length)break;
    for(const event of events){
      let projected;
      try{projected=publicEventFor(event);}
      catch(error){
        // Unknown/internal journal kinds are intentionally not membership
        // candidates. Any other parse failure is an integrity failure, not a
        // reason to silently shrink coverage.
        if(error?.code==='PUBLIC_TRACE_EVENT')continue;
        throw error;
      }
      if(projected.missionId===missionId)expected.push(eventReference(event));
    }
    after=events.at(-1).seq;
  }
  check(expected.length<=MAX_TRACE_ENTRIES,'PUBLIC_TRACE_LIMIT','Trace coverage exceeds its verified traversal limit');
  return expected;
}

function traceRecordId(missionId, event) {
  identifier(missionId, 'trace mission ID');
  const ref = eventReference(event);
  return 'public-trace:' + sha256({missionId, seq: ref.seq, hash: ref.hash});
}

function openSignedRecord(authority, record, kind, label) {
  reference(record);
  keys(record.data, ['signed'], ['signed'], label + ' record');
  return authority.open(record.data.signed, kind);
}

function missionOrigin(store, missionId) {
  const record = store.get('mission', missionId, 1);
  return reference(record, {type: 'mission', id: missionId, version: 1});
}

function parseTracePayload(value, missionId) {
  keys(value, ['schema', 'revision', 'missionId', 'missionOriginRef', 'eventRef', 'event', 'previousTraceRef']);
  check(value.schema === PUBLIC_MISSION_TRACE_SCHEMA && value.revision === PUBLIC_MISSION_TRACE_REVISION,
    'PUBLIC_TRACE_SCHEMA', 'Trace receipt schema differs from the public contract');
  identifier(value.missionId, 'trace receipt mission ID');
  check(value.missionId === missionId, 'PUBLIC_TRACE_MISSION', 'Trace receipt belongs to another mission');
  const missionOriginRef = referenceShape(value.missionOriginRef, {type: 'mission', id: missionId, version: 1});
  keys(value.eventRef, ['seq', 'hash', 'previousHash', 'at']);
  integer(value.eventRef.seq, 'trace receipt event sequence', {min: 1});
  digest(value.eventRef.hash, 'trace receipt event hash');
  digest(value.eventRef.previousHash, 'trace receipt previous event hash');
  instant(value.eventRef.at, 'trace receipt event timestamp');
  check(plain(value.event) && value.event.schema === PUBLIC_ENGINE_EVENT_SCHEMA,
    'PUBLIC_TRACE_EVENT', 'Trace receipt public event is malformed');
  const previousTraceRef = value.previousTraceRef === null
    ? null
    : referenceShape(value.previousTraceRef, {type: PUBLIC_MISSION_TRACE_RECORD_TYPE, version: 1});
  return {
    schema: PUBLIC_MISSION_TRACE_SCHEMA,
    revision: PUBLIC_MISSION_TRACE_REVISION,
    missionId,
    missionOriginRef,
    eventRef: clone(value.eventRef),
    event: clone(value.event),
    previousTraceRef,
  };
}

function parseHeadPayload(value, missionId) {
  keys(value, ['schema', 'revision', 'missionId', 'latestTraceRef']);
  check(value.schema === PUBLIC_MISSION_TRACE_HEAD_SCHEMA && value.revision === PUBLIC_MISSION_TRACE_REVISION,
    'PUBLIC_TRACE_SCHEMA', 'Trace head schema differs from the public contract');
  identifier(value.missionId, 'trace head mission ID');
  check(value.missionId === missionId, 'PUBLIC_TRACE_MISSION', 'Trace head belongs to another mission');
  return {
    schema: PUBLIC_MISSION_TRACE_HEAD_SCHEMA,
    revision: PUBLIC_MISSION_TRACE_REVISION,
    missionId,
    latestTraceRef: referenceShape(value.latestTraceRef, {type: PUBLIC_MISSION_TRACE_RECORD_TYPE, version: 1}),
  };
}

function readHead(store, authority, missionId) {
  const record = store.get(PUBLIC_MISSION_TRACE_HEAD_RECORD_TYPE, missionId);
  if (!record) return null;
  reference(record, {type: PUBLIC_MISSION_TRACE_HEAD_RECORD_TYPE, id: missionId});
  return {record, payload: parseHeadPayload(openSignedRecord(authority, record, PUBLIC_MISSION_TRACE_HEAD_KIND, 'trace head'), missionId)};
}

function empty({integrity = 'ABSENT'} = {}) {
  return Object.freeze({
    schema: PUBLIC_MISSION_TRACE_SCHEMA,
    revision: PUBLIC_MISSION_TRACE_REVISION,
    integrity,
    coverage: integrity === 'ABSENT' ? 'ABSENT' : 'UNVERIFIED',
    entries: Object.freeze([]),
    scope: integrity === 'ABSENT' ? EMPTY_SCOPE : UNVERIFIED_SCOPE,
  });
}

/**
 * Bind one eligible public engine event to a mission-local signed trace.
 *
 * Callers must be inside the same Store transaction that appended `event`.
 * This is intentionally strict: a durable trace cannot claim that it observed
 * an engine event from a later, unrelated transaction.
 */
export function recordPublicMissionTrace({store, authority, event} = {}) {
  check(store && typeof store.transactionWitness === 'function' && typeof store.get === 'function' && typeof store.put === 'function'
    && typeof store.events === 'function' && typeof store.assertCurrentTransactionEvent === 'function', 'PUBLIC_TRACE_STORE', 'A trusted writable store is required');
  check(authority && typeof authority.seal === 'function' && typeof authority.open === 'function',
    'PUBLIC_TRACE_AUTHORITY', 'A trusted signing authority is required');
  // This verifies the actual private Store transaction rather than trusting a
  // duck-typed `db.isTransaction` facade.
  const witness=store.transactionWitness();
  store.assertCurrentTransactionEvent(witness,event);
  const eventRef = eventReference(event);
  const exactEvent = readExactEvent(store, eventRef);
  check(same(exactEvent, event), 'PUBLIC_TRACE_EVENT', 'Caller event differs from the durable journal event');
  let publicEvent;
  try { publicEvent = publicEventFor(exactEvent); }
  catch (error) {
    // Unknown engine events deliberately remain internal. They do not create
    // an empty or generic “receipt” that could be mistaken for a handoff.
    if (error?.code === 'PUBLIC_TRACE_EVENT') return null;
    throw error;
  }
  const missionId = publicEvent.missionId;
  const missionOriginRef = missionOrigin(store, missionId);
  const previous = readHead(store, authority, missionId);
  const previousTraceRef = previous?.payload.latestTraceRef ?? null;
  const payload = {
    schema: PUBLIC_MISSION_TRACE_SCHEMA,
    revision: PUBLIC_MISSION_TRACE_REVISION,
    missionId,
    missionOriginRef,
    eventRef,
    event: publicEvent,
    previousTraceRef,
  };
  const trace = store.put(PUBLIC_MISSION_TRACE_RECORD_TYPE, traceRecordId(missionId, exactEvent), {
    signed: authority.seal(PUBLIC_MISSION_TRACE_KIND, payload),
  }, {expectedVersion: 0});
  const latestTraceRef = reference(trace, {type: PUBLIC_MISSION_TRACE_RECORD_TYPE, version: 1});
  const head = store.put(PUBLIC_MISSION_TRACE_HEAD_RECORD_TYPE, missionId, {
    signed: authority.seal(PUBLIC_MISSION_TRACE_HEAD_KIND, {
      schema: PUBLIC_MISSION_TRACE_HEAD_SCHEMA,
      revision: PUBLIC_MISSION_TRACE_REVISION,
      missionId,
      latestTraceRef,
    }),
  }, {expectedVersion: previous?.record.version ?? 0});
  return Object.freeze({receipt: latestTraceRef, head: reference(head, {type: PUBLIC_MISSION_TRACE_HEAD_RECORD_TYPE, id: missionId})});
}

/**
 * Reopen only the linked, signed receipts for one mission. A bad signature,
 * changed origin, event mismatch, duplicate chain link or private-field
 * injection fails closed to a static result; the raw Store is never returned.
 */
export function readPublicMissionTrace({store, authority, missionId, limit = 256} = {}) {
  try {
    check(store && typeof store.get === 'function' && typeof store.events === 'function' && typeof store.verifyJournal === 'function',
      'PUBLIC_TRACE_STORE', 'A readable trusted store is required');
    check(authority && typeof authority.open === 'function', 'PUBLIC_TRACE_AUTHORITY', 'A trusted signing authority is required');
    identifier(missionId, 'trace mission ID');
    integer(limit, 'trace limit', {min: 1, max: MAX_TRACE_ENTRIES});
    store.verifyJournal();
    const origin = missionOrigin(store, missionId);
    const head = readHead(store, authority, missionId);
    if (!head) return empty();
    const backwards = [];
    const seen = new Set();
    let ref = head.payload.latestTraceRef;
    let priorSequence = Number.POSITIVE_INFINITY;
    while (ref !== null) {
      check(backwards.length < MAX_TRACE_ENTRIES, 'PUBLIC_TRACE_LIMIT', 'Trace chain exceeds its verified traversal limit');
      const key = canonical([ref.type, ref.id, ref.version, ref.hash]);
      check(!seen.has(key), 'PUBLIC_TRACE_CHAIN', 'Trace chain is cyclic');
      seen.add(key);
      const record = recordForReference(store, ref, {type: PUBLIC_MISSION_TRACE_RECORD_TYPE, version: 1});
      const payload = parseTracePayload(openSignedRecord(authority, record, PUBLIC_MISSION_TRACE_KIND, 'trace receipt'), missionId);
      check(same(payload.missionOriginRef, origin), 'PUBLIC_TRACE_ORIGIN', 'Trace receipt origin differs from the immutable mission admission');
      const event = readExactEvent(store, payload.eventRef);
      const reprojected = publicEventFor(event);
      check(reprojected.missionId === missionId && same(reprojected, payload.event),
        'PUBLIC_TRACE_EVENT', 'Trace receipt no longer matches its exact public event projection');
      check(event.seq < priorSequence, 'PUBLIC_TRACE_CHAIN', 'Trace chain event order is not strictly descending');
      priorSequence = event.seq;
      backwards.push({payload, record});
      ref = payload.previousTraceRef;
    }
    const ordered = backwards.reverse();
    check(ordered[0]?.payload.event.kind === 'mission.created', 'PUBLIC_TRACE_COVERAGE',
      'Trace began after the immutable mission admission');
    const expected=expectedPublicMissionEvents(store,missionId);
    check(expected.length===ordered.length,'PUBLIC_TRACE_COVERAGE',
      'Signed trace does not cover every eligible public engine event for this mission');
    for(let index=0;index<expected.length;index++){
      const actual=ordered[index].payload.eventRef, candidate=expected[index];
      check(actual.seq===candidate.seq&&actual.hash===candidate.hash&&actual.previousHash===candidate.previousHash&&actual.at===candidate.at,
        'PUBLIC_TRACE_COVERAGE','Signed trace order differs from eligible public engine event history');
    }
    const entries = ordered.slice(-limit).map(({payload, record}) => Object.freeze({
      revision: payload.eventRef.seq,
      at: payload.eventRef.at,
      event: clone(payload.event),
      receiptHash: record.hash,
    }));
    return Object.freeze({
      schema: PUBLIC_MISSION_TRACE_SCHEMA,
      revision: PUBLIC_MISSION_TRACE_REVISION,
      integrity: 'VERIFIED',
      coverage: entries.length === ordered.length ? 'FROM_ADMISSION' : 'FROM_ADMISSION_TRUNCATED',
      entries: Object.freeze(entries),
      scope: VERIFIED_SCOPE,
    });
  } catch (error) {
    // An absent head is the only benign empty state. Any malformed linked
    // material is deliberately indistinguishable from other failed checks.
    return empty({integrity: 'UNVERIFIED'});
  }
}
