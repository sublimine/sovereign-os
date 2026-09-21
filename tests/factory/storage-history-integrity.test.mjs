import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {Store} from '../../factory/lib/store.mjs';
import {canonical,sha256} from '../../factory/lib/contracts.mjs';

// Deliberate corruption of isolated test databases, not live service state.
function fixture(t){const s=new Store(':memory:');t.after(()=>s.close());s.put('item','x',{state:'old'},{expectedVersion:0});s.put('item','x',{state:'current'},{expectedVersion:1});return s;}
for(const damage of ['rollback','missing'])test(`journal verification rejects a ${damage} current head despite intact record/event hashes`,t=>{
  const s=fixture(t);
  s.db.exec(damage==='rollback'?"UPDATE heads SET version=1 WHERE type='item' AND id='x'":"DELETE FROM heads WHERE type='item' AND id='x'");
  assert.throws(()=>s.verifyJournal(),{code:'STORAGE_CORRUPTION'});
});
test('journal verification rejects unjournaled records even without an extra visible head',t=>{
  const s=fixture(t),json=canonical({unrecorded:true});
  s.db.prepare('INSERT INTO records VALUES(?,?,?,?,?,?)').run('orphan','y',1,sha256(json),json,new Date().toISOString());
  assert.throws(()=>s.verifyJournal(),{code:'STORAGE_CORRUPTION'});
});
for(const damage of ['duplicate','parent','gap'])test(`journal verification rejects ${damage} version lineage even with a valid event hash chain`,t=>{
  const s=fixture(t),last=s.get('item','x');
  if(damage==='duplicate')s.append('record.committed',{type:'item',id:'x',version:2,hash:last.hash,parentHash:s.get('item','x',1).hash});
  else{
    const version=damage==='gap'?4:3,json=canonical({state:'forged'}),hash=sha256(json);
    s.db.prepare('INSERT INTO records VALUES(?,?,?,?,?,?)').run('item','x',version,hash,json,new Date().toISOString());
    s.db.prepare('UPDATE heads SET version=? WHERE type=? AND id=?').run(version,'item','x');
    s.append('record.committed',{type:'item',id:'x',version,hash,parentHash:damage==='parent'?'0'.repeat(64):last.hash});
  }
  assert.throws(()=>s.verifyJournal(),{code:'STORAGE_CORRUPTION'});
});
test('startup refuses stale heads without repairing or rewriting the evidence',t=>{
  const dir=mkdtempSync(join(tmpdir(),'sovereign-corrupt-startup-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));
  const path=join(dir,'state.sqlite'),s=new Store(path);
  s.put('item','x',{state:'old'},{expectedVersion:0});s.put('item','x',{state:'current'},{expectedVersion:1});
  s.db.exec("UPDATE heads SET version=1 WHERE type='item' AND id='x'");const events=s.events();s.close();
  assert.throws(()=>new Store(path),{code:'STORAGE_CORRUPTION'});
  // Read-only inspection: old head and original events remain, no automatic reset.
  const r=new DatabaseSync(path,{readOnly:true});try{
    assert.equal(r.prepare("SELECT version FROM heads WHERE type='item' AND id='x'").get().version,1);
    assert.equal(r.prepare('SELECT count(*) AS n FROM events').get().n,events.length);
  }finally{r.close();}
});
test('journal verification uses one read snapshot while another connection commits',t=>{
  const dir=mkdtempSync(join(tmpdir(),'sovereign-consistent-audit-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));
  const path=join(dir,'state.sqlite'),reader=new Store(path),writer=new Store(path);t.after(()=>{reader.close();writer.close();});
  reader.put('item','x',{state:'first'},{expectedVersion:0});const before=reader.verifyJournal();let changed=false;
  reader.events=function(options){const rows=Store.prototype.events.call(this,options);if(!changed){changed=true;writer.put('item','x',{state:'second'},{expectedVersion:1});}return rows;};
  assert.deepEqual(reader.verifyJournal(),before,'No mixture of pre- and post-commit states in one audit');
  assert.equal(reader.get('item','x').version,2);assert.equal(reader.verifyJournal().events,2);
});
test('tuple identities cannot collide and verification preserves an existing transaction',t=>{
  const s=new Store(':memory:');t.after(()=>s.close());assert.equal(s.verifyJournal().events,0);
  s.transact(()=>{
    s.put('a:b','c',{value:1},{expectedVersion:0});s.put('a','b:c',{value:2},{expectedVersion:0});
    assert.equal(s.verifyJournal().events,2);assert.equal(s.db.isTransaction,true);
  });
  assert.equal(s.db.isTransaction,false);assert.equal(s.get('a:b','c').data.value,1);assert.equal(s.get('a','b:c').data.value,2);
});
