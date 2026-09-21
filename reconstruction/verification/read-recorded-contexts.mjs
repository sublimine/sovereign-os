// Historical measurement only. SQLite is opened read-only; no Engine/Broker is
// instantiated, no tool is repeated, and authority key material is never emitted.
import {DatabaseSync} from 'node:sqlite';
import {Store} from '../../factory/lib/store.mjs';
import {Authority} from '../../factory/lib/authority.mjs';
import {ArtifactRegistry} from '../../factory/lib/artifacts.mjs';
import {WorkerService} from '../../factory/lib/workers.mjs';

export function readRecordedContexts(databasePath) {
  const db=new DatabaseSync(databasePath,{readOnly:true,allowExtension:false,defensive:true});
  const store={db,get:Store.prototype.get,list:Store.prototype.list,put(){throw Error('Historical measurement cannot create records');}};
  try{
    if(!store.get('authority-key','local-authority-v1'))throw Error('Existing authority required; measurement never initializes one');
    const authority=new Authority(store),registry=new ArtifactRegistry(store,authority);
    const reader={store,registry,run:WorkerService.prototype.run,mission:WorkerService.prototype.mission};
    return store.list('run').map(r=>({runId:r.id,recordHash:r.hash,mode:r.data.mode,nodeId:r.data.nodeId,
      context:WorkerService.prototype.context.call(reader,r.id)}));
  }finally{db.close();}
}
