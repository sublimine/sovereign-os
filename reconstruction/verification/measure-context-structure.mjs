// Explicit, read-only OFFLINE context projection. Not the byte-for-byte original
// inference request: current admitted artifact statuses and no historical task.
import * as fs from 'node:fs';
import {join,resolve} from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {Store} from '../../factory/lib/store.mjs';
import {Authority} from '../../factory/lib/authority.mjs';
import {ArtifactRegistry} from '../../factory/lib/artifacts.mjs';
import {WorkerService} from '../../factory/lib/workers.mjs';
import {sha256,canonical} from '../../factory/lib/contracts.mjs';
import {packJsonContext} from '../../factory/lib/context-json-codec.mjs';
import {packStructurePrototype,unpackStructurePrototype} from './context-structure-prototype.mjs';
const [output,...directories]=process.argv.slice(2);
if(!output||fs.existsSync(output)||!directories.length)throw Error('New output path and explicit source directories required');
const results=directories.map(directory=>{
  const db=new DatabaseSync(join(directory,'state.sqlite'),{readOnly:true,allowExtension:false,defensive:true});
  const store={db,get:Store.prototype.get,list:Store.prototype.list,events:Store.prototype.events};
  try{
    db.exec('BEGIN');const journal=Store.prototype.verifyJournal.call(store);
    if(!store.get('authority-key','local-authority-v1'))throw Error('Existing authority required; read-only inspection never creates one');
    const authority=new Authority(store),registry=new ArtifactRegistry(store,authority),worker=Object.create(WorkerService.prototype);Object.assign(worker,{store,registry});
    const runs=store.list('run').filter(r=>(r.data.inferenceReceipts??[]).length&&r.data.nodeId!=='planning');
    const contexts=runs.map(({data:run})=>{
      const context=worker.context(run.id),base=packJsonContext(context),prototype=packStructurePrototype(context),before=sha256(JSON.stringify(context));
      if(prototype.prototypeUsed&&sha256(JSON.stringify(unpackStructurePrototype(prototype.input)))!==before)throw Error('Offline projection changed');
      return {runId:run.id,nodeId:run.nodeId,mode:run.mode,projectionHash:before,baseEncoding:base.encoding,baseWireBytes:base.wireBytes,logicalBytes:base.logicalBytes,
        prototypeWireBytes:prototype.wireBytes,prototypeUsed:prototype.prototypeUsed,structureCount:prototype.structureCount,bytesSaved:base.wireBytes-prototype.wireBytes};
    });
    const final=Store.prototype.verifyJournal.call(store);if(canonical(journal)!==canonical(final))throw Error('Read-only source snapshot changed');
    return {directory:resolve(directory),journal,contexts};
  }finally{if(db.isTransaction)db.exec('ROLLBACK');db.close();}
});
const report={capturedAt:new Date().toISOString(),scope:'Offline read-only projections of current stored worker contexts; neither original historical dispatch requests nor model calls. Exact original projection JSON round-trip required. No token, latency, acceptance or instruction-overhead claim; prototype is not installed or selectable.',
  prototypeHash:sha256(fs.readFileSync(new URL('./context-structure-prototype.mjs',import.meta.url))),results};
fs.writeFileSync(output,JSON.stringify(report,null,2),{flag:'wx',mode:0o600});process.stdout.write(JSON.stringify(report,null,2)+'\n');
