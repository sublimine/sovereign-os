import fs from 'node:fs';import {join} from 'node:path';import {Store} from '../../../factory/lib/store.mjs';
import {captureProcessIdentity} from '../../../factory/lib/process-identity.mjs';
const [directory,boundary,kind]=process.argv.slice(2),store=new Store(join(directory,'state.sqlite'));
const cut=()=>{fs.writeFileSync(join(directory,'cut.json'),JSON.stringify({owner:captureProcessIdentity(),boundary,kind,
  protocol:store.db.prepare('PRAGMA user_version').get().user_version}),{flag:'wx',mode:0o600});process.kill(process.pid,'SIGKILL');};
const write=()=>kind==='record'?store.put('fixture','record',{value:1},{expectedVersion:0}):store.append('fixture.event',{value:1});
if(boundary==='before-write')store.transact(cut);
else if(boundary==='before-commit')store.transact(()=>{write();cut();});
else if(boundary==='after-commit'){write();cut();}
else throw Error('Unknown crash boundary');
