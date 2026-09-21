import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {Store} from '../../factory/lib/store.mjs';
import {readHistoryFingerprint} from '../../reconstruction/verification/read-history-fingerprint.mjs';

test('history fingerprint accepts real SQLite null-prototype rows and leaves a read-only source unchanged',t=>{
  const directory=mkdtempSync(join(tmpdir(),'history-fingerprint-')),path=join(directory,'state.sqlite');
  t.after(()=>rmSync(directory,{recursive:true,force:true}));
  const store=new Store(path);store.put('fixture','item',{value:1},{expectedVersion:0});
  const journal=store.verifyJournal(),before=readHistoryFingerprint(store.db);store.close();
  const db=new DatabaseSync(path,{readOnly:true});
  try{
    assert.equal(Object.getPrototypeOf(db.prepare('SELECT * FROM events LIMIT 1').get()),null);
    assert.deepEqual(readHistoryFingerprint(db),before);assert.equal(db.isTransaction,false);
    assert.deepEqual(before.head,{seq:journal.events,hash:journal.head});
    db.exec('BEGIN');assert.deepEqual(readHistoryFingerprint(db),before);assert.equal(db.isTransaction,true);db.exec('COMMIT');
  }finally{db.close();}
});

test('fingerprint detects a changed head even without new records/events; failed reads leave no owned transaction',()=>{
  const store=new Store(':memory:');
  try{
    store.put('fixture','item',{value:1},{expectedVersion:0});store.put('fixture','item',{value:2},{expectedVersion:1});
    const before=readHistoryFingerprint(store.db);
    store.db.prepare('UPDATE heads SET version=1 WHERE type=? AND id=?').run('fixture','item');
    const after=readHistoryFingerprint(store.db);assert.deepEqual(after.head,before.head);assert.equal(after.recordsHash,before.recordsHash);
    assert.notEqual(after.headsHash,before.headsHash);
  }finally{store.close();}
  const empty=new DatabaseSync(':memory:');try{assert.throws(()=>readHistoryFingerprint(empty));assert.equal(empty.isTransaction,false);}finally{empty.close();}
});
