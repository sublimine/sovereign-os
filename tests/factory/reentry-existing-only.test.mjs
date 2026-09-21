import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {Store} from '../../factory/lib/store.mjs';
import {Authority} from '../../factory/lib/authority.mjs';
import {ToolBroker} from '../../factory/tools/broker.mjs';

const metadata=path=>{const stat=fs.lstatSync(path,{bigint:true});return {mode:stat.mode.toString(),mtimeNs:stat.mtimeNs.toString(),ctimeNs:stat.ctimeNs.toString()};};
const temporary=t=>{const root=fs.mkdtempSync(join(tmpdir(),'sovereign-existing-only-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));return root;};

test('existing-only Store rejects a missing durable database without creating its parent or changing it',t=>{
  const root=temporary(t),missingParent=join(root,'absent'),before=metadata(root);
  assert.throws(()=>new Store(join(missingParent,'state.sqlite'),{existingOnly:true}),{code:'STORAGE_PATH'});
  assert.equal(fs.existsSync(missingParent),false);
  assert.deepEqual(metadata(root),before);
});

test('existing-only Store opens a complete durable database without changing bytes, modes, or SQLite sidecars',t=>{
  const root=temporary(t),path=join(root,'state.sqlite'),writer=new Store(path);
  writer.put('fixture','sealed',{value:'retained'},{expectedVersion:0});writer.close();
  const before={database:fs.readFileSync(path),metadata:metadata(path),wal:fs.existsSync(path+'-wal'),shm:fs.existsSync(path+'-shm')};
  const reader=new Store(path,{existingOnly:true});
  try{assert.equal(reader.get('fixture','sealed').data.value,'retained');assert.ok(reader.verifyJournal());}
  finally{reader.close();}
  assert.deepEqual(fs.readFileSync(path),before.database);
  assert.deepEqual(metadata(path),before.metadata);
  assert.equal(fs.existsSync(path+'-wal'),before.wal);assert.equal(fs.existsSync(path+'-shm'),before.shm);
});

test('existing-only Store rejects a symlinked database ancestor before opening the durable file',t=>{
  const root=temporary(t),path=join(root,'state.sqlite'),writer=new Store(path);writer.close();
  const alias=join(root+'-alias');fs.symlinkSync(root,alias,'dir');t.after(()=>fs.unlinkSync(alias));
  const before={bytes:fs.readFileSync(path),metadata:metadata(path)};
  assert.throws(()=>new Store(join(alias,'state.sqlite'),{existingOnly:true}),{code:'STORAGE_PATH'});
  assert.deepEqual(fs.readFileSync(path),before.bytes);assert.deepEqual(metadata(path),before.metadata);
});

test('existing-only authority and workspace broker fail closed rather than inventing prerequisites',t=>{
  const root=temporary(t),path=join(root,'state.sqlite'),store=new Store(path);t.after(()=>store.close());
  const beforeAuthority=store.verifyJournal();
  assert.throws(()=>new Authority(store,{existingOnly:true}),{code:'AUTHORITY_KEY'});
  assert.equal(store.get('authority-key','local-authority-v1'),null);
  assert.deepEqual(store.verifyJournal(),beforeAuthority);
  const authority=new Authority(store),beforeWorkspace=store.verifyJournal(),workspaceRoot=join(root,'absent-workspace');
  assert.throws(()=>new ToolBroker({store,authority,workspaceRoot,requireExistingWorkspaceRoot:true}),{code:'WORKSPACE_PATH'});
  assert.equal(fs.existsSync(workspaceRoot),false);
  assert.deepEqual(store.verifyJournal(),beforeWorkspace);
});
