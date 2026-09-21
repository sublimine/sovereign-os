import {DatabaseSync} from 'node:sqlite';
import {mkdirSync, chmodSync, lstatSync} from 'node:fs';
import {dirname, resolve, sep} from 'node:path';
import {AsyncLocalStorage} from 'node:async_hooks';
import {canonical, check, clone, identifier, integer, sha256, timestamp} from './contracts.mjs';

// Trusted control-plane storage. Never hand this object or database path to a worker.
export class Store {
  #transactionScope = new AsyncLocalStorage();
  // A transaction witness is process-local, nonserializable evidence that an
  // exact immutable record or journal event was created by the *current* outer
  // Store transaction. It is intentionally not a durable authorization: it
  // lets narrow control-plane capabilities reject a later transaction trying
  // to attach a proof to a historical row. Code with arbitrary Store/Authority
  // access is still inside the trusted computing base and is handled separately.
  #transactionWitnesses = new WeakMap();
  // Keep the transaction boundary behind the Store's private brand.  Callers
  // must not be able to replace `db.isTransaction` with a lookalike facade and
  // thereby present an uncommitted transaction as a durable boundary.
  #assertCommittedBoundary({code, message}) {
    const scope = this.#transactionScope.getStore();
    check(!scope?.active && !this.db.isTransaction, code, message);
    return this;
  }
  static #isGenuineStore(store) {
    try {
      void store.#transactionScope;
      return true;
    } catch {
      return false;
    }
  }
  static assertCommittedBoundary(store, {code = 'STORE_COMMIT_BOUNDARY', message = 'A previously committed Store boundary is required'} = {}) {
    check(store instanceof Store && Store.#isGenuineStore(store), code, message);
    return store.#assertCommittedBoundary({code, message});
  }
  constructor(path, {clock = timestamp, existingOnly = false} = {}) {
    this.clock = clock;
    check(typeof existingOnly === 'boolean', 'CONFIG', 'existingOnly must be boolean');
    if (existingOnly) check(path !== ':memory:', 'STORAGE_PATH', 'Existing-only storage requires a durable database file');
    if (path !== ':memory:') {
      path = resolve(path);
      if (existingOnly) {
        // A validation-only re-entry must never turn an absent or malformed
        // path into a database before its narrow validation boundary exists.
        try {
          let current=sep;
          for(const part of dirname(path).split(sep).filter(Boolean)){
            current=resolve(current,part);
            const parent=lstatSync(current);
            check(parent.isDirectory() && !parent.isSymbolicLink(), 'STORAGE_PATH', 'Existing-only database ancestry must be real directories');
          }
          const file = lstatSync(path);
          check(file.isFile() && !file.isSymbolicLink(), 'STORAGE_PATH', 'Existing-only database must be a regular non-symbolic file');
        } catch (error) {
          if (error?.code === 'ENOENT') check(false, 'STORAGE_PATH', 'Existing-only database and its parent must already exist');
          throw error;
        }
      } else {
        mkdirSync(dirname(path), {recursive: true, mode: 0o700});
        try { check(lstatSync(path).isFile() && !lstatSync(path).isSymbolicLink(), 'STORAGE_PATH', 'Database must be a regular file'); }
        catch (e) { if (e.code !== 'ENOENT') throw e; }
      }
    }
    this.db = new DatabaseSync(path, {timeout: 5000, enableForeignKeyConstraints: true, allowExtension: false, defensive: true});
    try {
    if (path !== ':memory:' && !existingOnly) chmodSync(path, 0o600);
    const sqlite = this.db.prepare('SELECT sqlite_version() AS version').get().version.split('.').map(Number);
    check(sqlite[0] > 3 || sqlite[0] === 3 && (sqlite[1] > 51 || sqlite[1] === 51 && sqlite[2] >= 3), 'STORAGE_VERSION', 'SQLite with WAL-reset fix is required');
    if (existingOnly) this.db.exec('PRAGMA foreign_keys=ON; PRAGMA trusted_schema=OFF;');
    else this.db.exec('PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA foreign_keys=ON; PRAGMA trusted_schema=OFF;');
    const version = this.db.prepare('PRAGMA user_version').get().user_version;
    check((existingOnly ? [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17] : [0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17]).includes(version), 'STORAGE_VERSION',
      existingOnly ? 'Existing-only database must already have a supported execution protocol' : 'Unsupported database schema or execution protocol');
    if (!existingOnly) this.db.exec(`
      CREATE TABLE IF NOT EXISTS records (
        type TEXT NOT NULL, id TEXT NOT NULL, version INTEGER NOT NULL CHECK(version>0),
        hash TEXT NOT NULL, json TEXT NOT NULL, created_at TEXT NOT NULL,
        PRIMARY KEY(type,id,version)
      ) STRICT;
      CREATE TABLE IF NOT EXISTS heads (
        type TEXT NOT NULL, id TEXT NOT NULL, version INTEGER NOT NULL,
        PRIMARY KEY(type,id), FOREIGN KEY(type,id,version) REFERENCES records(type,id,version)
      ) STRICT;
      CREATE TABLE IF NOT EXISTS events (
        seq INTEGER PRIMARY KEY, kind TEXT NOT NULL, json TEXT NOT NULL,
        previous_hash TEXT NOT NULL, hash TEXT NOT NULL, created_at TEXT NOT NULL
      ) STRICT;
      CREATE TRIGGER IF NOT EXISTS immutable_records_update BEFORE UPDATE ON records BEGIN SELECT RAISE(ABORT,'immutable record'); END;
      CREATE TRIGGER IF NOT EXISTS immutable_records_delete BEFORE DELETE ON records BEGIN SELECT RAISE(ABORT,'immutable record'); END;
      CREATE TRIGGER IF NOT EXISTS immutable_events_update BEFORE UPDATE ON events BEGIN SELECT RAISE(ABORT,'immutable event'); END;
      CREATE TRIGGER IF NOT EXISTS immutable_events_delete BEFORE DELETE ON events BEGIN SELECT RAISE(ABORT,'immutable event'); END;
    `);
    if (!existingOnly && version === 0) this.db.exec('PRAGMA user_version=1;');
    this.verifyJournal();
    } catch (error) { this.db.close(); throw error; }
  }
  // Protocol floor, not a change to historical rows or a defense against the
  // database owner. Existing old processes must be drained before upgrade.
  // This runs inside the SAME transaction as the impending material write.
  #requireWriteProtocol() {
    check(this.db.isTransaction, 'STORAGE_VERSION', 'Execution protocol promotion requires a transaction');
    const version = this.db.prepare('PRAGMA user_version').get().user_version;
    check([1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17].includes(version), 'STORAGE_VERSION', 'Unsupported database execution protocol');
    if (version === 1) this.db.exec('PRAGMA user_version=2;');
  }
  // Versioned features bind a stronger floor in the same outer transaction as
  // their first protocol record. Plain reads and legacy-only writes do not opt in.
  requireExecutionProtocol(minimum) {
    integer(minimum,'execution protocol',{min:2,max:17});
    check(this.db.isTransaction,'STORAGE_VERSION','Feature protocol promotion requires its material transaction');
    this.#requireWriteProtocol();
    const version=this.db.prepare('PRAGMA user_version').get().user_version;
    if(version<minimum)this.db.exec('PRAGMA user_version='+minimum+';');
  }
  transact(fn) {
    const inherited = this.#transactionScope.getStore();
    check(!inherited || inherited.active, 'ASYNC_TRANSACTION', 'Transaction scope has already ended');
    check(typeof fn === 'function' && Object.prototype.toString.call(fn) !== '[object AsyncFunction]', 'ASYNC_TRANSACTION', 'Async callbacks are rejected before invocation');
    const synchronous = value => {
      if (value?.then) {
        Promise.resolve(value).catch(() => {});
        if (this.#transactionScope.getStore()) this.#transactionScope.getStore().active = false;
        check(false, 'ASYNC_TRANSACTION', 'Transaction callback must be synchronous');
      }
      return value;
    };
    if (this.db.isTransaction) return synchronous(fn());
    const scope = {active: true,writes:new Map(),writeOrdinal:0,events:new Map(),eventOrdinal:0,afterCommit:[]};
    let callbacks=[];
    const result=this.#transactionScope.run(scope, () => {
      this.db.exec('BEGIN IMMEDIATE');
      try {
        const value = synchronous(fn());
        this.db.exec('COMMIT');
        callbacks=scope.afterCommit.slice();
        return value;
      }
      catch (error) { if (this.db.isTransaction) this.db.exec('ROLLBACK'); throw error; }
      finally { scope.active = false; }
    });
    // Observers run only after the outer transaction committed and outside the
    // private transaction scope. Their failures cannot turn a committed durable
    // mutation into a misleading caller failure.
    for(const callback of callbacks){try{callback();}catch{}}
    return result;
  }
  get(type, recordId, version = null) {
    identifier(type); identifier(recordId);
    if (version !== null) integer(version, 'version', {min: 1});
    const row = version === null
      ? this.db.prepare('SELECT r.* FROM records r JOIN heads h USING(type,id,version) WHERE r.type=? AND r.id=?').get(type, recordId)
      : this.db.prepare('SELECT * FROM records WHERE type=? AND id=? AND version=?').get(type, recordId, version);
    if (!row) return null;
    check(sha256(row.json) === row.hash, 'STORAGE_CORRUPTION', 'Record digest mismatch', {type, id: recordId});
    return {type, id: row.id, version: row.version, hash: row.hash, data: JSON.parse(row.json), createdAt: row.created_at};
  }
  list(type) {
    identifier(type);
    return this.db.prepare('SELECT id FROM heads WHERE type=? ORDER BY id').all(type).map(({id}) => this.get(type, id));
  }
  put(type, recordId, data, {expectedVersion} = {}) {
    identifier(type); identifier(recordId); integer(expectedVersion, 'expectedVersion');
    const json = canonical(data); check(Buffer.byteLength(json) <= 16 * 1024 * 1024, 'STORAGE_LIMIT', 'Record exceeds 16MiB');
    return this.transact(() => {
      this.#requireWriteProtocol();
      const previous = this.get(type, recordId);
      check((previous?.version ?? 0) === expectedVersion, 'VERSION_CONFLICT', 'Expected parent version differs from current head', {type, id: recordId});
      const version = expectedVersion + 1, hash = sha256(json), createdAt = this.clock();
      this.db.prepare('INSERT INTO records VALUES(?,?,?,?,?,?)').run(type, recordId, version, hash, json, createdAt);
      this.db.prepare('INSERT INTO heads VALUES(?,?,?) ON CONFLICT(type,id) DO UPDATE SET version=excluded.version').run(type, recordId, version);
      this.append('record.committed', {type, id: recordId, version, hash, parentHash: previous?.hash ?? null});
      const record={type, id: recordId, version, hash, data: clone(data), createdAt};
      const scope=this.#transactionScope.getStore();
      if(scope?.active){
        // `put()` has just made this exact immutable reference visible in the
        // current SQLite transaction.  It is recorded only after both the
        // row and its journal event exist, so a witness can never name a
        // half-written record.
        scope.writes.set(canonical([record.type,record.id,record.version,record.hash]),++scope.writeOrdinal);
      }
      return record;
    });
  }
  // These two methods expose no database mutation.  They are deliberately
  // narrow: a caller may prove only that a record was freshly written by the
  // current Store.transact() scope, and may not manufacture a witness for a
  // raw `db.exec('BEGIN')` transaction or reuse it after commit/rollback.
  transactionWitness() {
    const scope=this.#transactionScope.getStore();
    check(scope?.active&&this.db.isTransaction,'TRANSACTION_WITNESS',
      'A trusted current Store transaction is required');
    let witness=this.#transactionWitnesses.get(scope);
    if(!witness){witness=Object.freeze(Object.create(null));this.#transactionWitnesses.set(scope,witness);}
    return witness;
  }
  assertCurrentTransactionWrite(witness,record,{after=null}={}) {
    const scope=this.#transactionScope.getStore();
    check(scope?.active&&this.db.isTransaction&&this.#transactionWitnesses.get(scope)===witness,
      'TRANSACTION_WITNESS','Write witness is not active in this Store transaction');
    const normalize=(value,label)=>{
      check(value&&typeof value==='object','TRANSACTION_WITNESS',`${label} record is required`);
      identifier(value.type,`${label} type`);identifier(value.id,`${label} ID`);
      integer(value.version,`${label} version`,{min:1});
      check(typeof value.hash==='string'&&/^[a-f0-9]{64}$/.test(value.hash),'TRANSACTION_WITNESS',`${label} hash is invalid`);
      return canonical([value.type,value.id,value.version,value.hash]);
    };
    const key=normalize(record,'Current'),ordinal=scope.writes.get(key);
    check(Number.isSafeInteger(ordinal)&&ordinal>0,'TRANSACTION_WITNESS',
      'Record was not written by this current Store transaction');
    if(after!==null){
      const prior=scope.writes.get(normalize(after,'Prior'));
      check(Number.isSafeInteger(prior)&&prior>0&&prior<ordinal,'TRANSACTION_WITNESS',
        'Records were not written in the required current transaction order');
    }
    return ordinal;
  }
  assertCurrentTransactionEvent(witness,event) {
    const scope=this.#transactionScope.getStore();
    check(scope?.active&&this.db.isTransaction&&this.#transactionWitnesses.get(scope)===witness,
      'TRANSACTION_WITNESS','Event witness is not active in this Store transaction');
    check(event&&typeof event==='object','TRANSACTION_WITNESS','Current event is required');
    integer(event.seq,'current event sequence',{min:1});
    identifier(event.kind,'current event kind');
    check(typeof event.hash==='string'&&/^[a-f0-9]{64}$/.test(event.hash),'TRANSACTION_WITNESS','Current event hash is invalid');
    check(typeof event.previousHash==='string'&&/^[a-f0-9]{64}$/.test(event.previousHash),'TRANSACTION_WITNESS','Current event previous hash is invalid');
    check(typeof event.createdAt==='string','TRANSACTION_WITNESS','Current event timestamp is invalid');
    const key=canonical([event.seq,event.hash,event.previousHash,event.createdAt]),ordinal=scope.events.get(key);
    check(Number.isSafeInteger(ordinal)&&ordinal>0,'TRANSACTION_WITNESS',
      'Event was not appended by this current Store transaction');
    return ordinal;
  }
  afterCommit(callback) {
    const scope=this.#transactionScope.getStore();
    check(scope?.active&&this.db.isTransaction,'TRANSACTION_WITNESS','A trusted current Store transaction is required for a post-commit observer');
    check(typeof callback==='function','TRANSACTION_WITNESS','Post-commit observer must be a function');
    scope.afterCommit.push(callback);
    return this;
  }
  append(kind, data) {
    identifier(kind); const json = canonical(data);
    check(Buffer.byteLength(json) <= 1024 * 1024, 'STORAGE_LIMIT', 'Event exceeds 1MiB');
    return this.transact(() => {
      this.#requireWriteProtocol();
      const last = this.db.prepare('SELECT seq,hash FROM events ORDER BY seq DESC LIMIT 1').get();
      const event = {seq: (last?.seq ?? 0) + 1, kind, data: clone(data), previousHash: last?.hash ?? '0'.repeat(64), createdAt: this.clock()};
      const hash = sha256(event);
      this.db.prepare('INSERT INTO events VALUES(?,?,?,?,?,?)').run(event.seq, kind, json, event.previousHash, hash, event.createdAt);
      const committed={...event,hash};
      const scope=this.#transactionScope.getStore();
      if(scope?.active)scope.events.set(canonical([committed.seq,committed.hash,committed.previousHash,committed.createdAt]),++scope.eventOrdinal);
      return committed;
    });
  }
  events({after = 0, limit = 1000} = {}) {
    integer(after, 'after'); integer(limit, 'limit', {min: 1, max: 10000});
    return this.db.prepare('SELECT * FROM events WHERE seq>? ORDER BY seq LIMIT ?').all(after, limit)
      .map(row => ({seq: row.seq, kind: row.kind, data: JSON.parse(row.json), previousHash: row.previous_hash, hash: row.hash, createdAt: row.created_at}));
  }
  verifyJournal() {
    // A valid event hash chain alone does not establish the current heads or
    // complete record coverage. Read all three tables in ONE coherent snapshot.
    const ownSnapshot = !this.db.isTransaction;
    if (ownSnapshot) this.db.exec('BEGIN');
    try {
      let after = 0, previousHash = '0'.repeat(64), committedRecords = 0;
      const latest = new Map(), key = (type, id) => canonical([type, id]);
      for (;;) {
        const events = this.events({after, limit: 1000});
        if (!events.length) break;
        for (const event of events) {
          const {hash, ...body} = event;
          check(event.seq === after + 1 && event.previousHash === previousHash && sha256(body) === hash, 'STORAGE_CORRUPTION', 'Event chain failed verification', {seq: event.seq});
          if (event.kind === 'record.committed') {
            const d = event.data, prior = latest.get(key(d.type, d.id));
            check(d.version === (prior?.version ?? 0) + 1 && d.parentHash === (prior?.hash ?? null),
              'STORAGE_CORRUPTION', 'Record history has a duplicate, gap or wrong parent', {seq: event.seq});
            const r = this.get(d.type, d.id, d.version);
            check(r && r.hash === d.hash, 'STORAGE_CORRUPTION', 'Journal refers to missing or changed record');
            latest.set(key(d.type, d.id), {version:d.version, hash:d.hash}); committedRecords++;
          }
          after = event.seq; previousHash = hash;
        }
      }
      check(this.db.prepare('SELECT count(*) AS n FROM records').get().n === committedRecords,
        'STORAGE_CORRUPTION', 'Records exist outside the committed event history');
      const heads = this.db.prepare('SELECT type,id,version FROM heads').all();
      check(heads.length === latest.size, 'STORAGE_CORRUPTION', 'Current heads do not cover the complete committed history');
      for (const h of heads) check(latest.get(key(h.type, h.id))?.version === h.version,
        'STORAGE_CORRUPTION', 'Current head is not the latest committed version', {type:h.type, id:h.id});
      if (ownSnapshot) this.db.exec('COMMIT');
      return {events: after, head: previousHash};
    } catch (error) {
      if (ownSnapshot && this.db.isTransaction) this.db.exec('ROLLBACK');
      throw error;
    }
  }
  close() { this.db.close(); }
}

/**
 * Require the real Store instance to be outside every active transaction.  The
 * private-brand access rejects proxies and structural facades even when they
 * delegate to a Store and lie about `db.isTransaction`.
 */
export function assertCommittedStoreBoundary(store, options = {}) {
  return Store.assertCommittedBoundary(store, options);
}
