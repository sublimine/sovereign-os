// Read-only current-code preview over one exact preserved actor/database.
// Does not reconstruct a dispatch, migrate a store, recover a run or infer.
import * as fs from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {DatabaseSync} from 'node:sqlite';
import {Store} from '../../factory/lib/store.mjs';
import {Authority} from '../../factory/lib/authority.mjs';
import {ArtifactRegistry} from '../../factory/lib/artifacts.mjs';
import {WorkerService} from '../../factory/lib/workers.mjs';
import {check,sha256,canonical,identifier} from '../../factory/lib/contracts.mjs';

export function sourceAcquisitionDiagnostic(databasePath,runId){
  const path=resolve(databasePath);identifier(runId);
  check(fs.realpathSync(path)===path&&fs.lstatSync(path).isFile(),'DIAGNOSTIC_PATH','Exact real database file required');
  const db=new DatabaseSync(path,{readOnly:true,timeout:5000});
  db.exec('PRAGMA query_only=ON; PRAGMA trusted_schema=OFF; BEGIN');
  const store={db,get:Store.prototype.get,list:Store.prototype.list,events:Store.prototype.events,verifyJournal:Store.prototype.verifyJournal};
  try{
    check(store.get('authority-key','local-authority-v1'),'DIAGNOSTIC_AUTHORITY','Existing authority required, never create a key');
    const before=store.verifyJournal(),authority=new Authority(store),registry=new ArtifactRegistry(store,authority);
    const workers=new WorkerService({store,authority,registry,broker:{executionAvailable:()=>false,searchAvailable:()=>false},
      providerFactory:()=>{throw Error('Read-only diagnostic may not infer');}});
    const runBefore=store.get('run',runId),context=workers.context(runId),preview=workers.documentContextPreview(runId);
    check(canonical(runBefore)===canonical(store.get('run',runId))&&canonical(context)===canonical(workers.context(runId)),
      'DIAGNOSTIC_MUTATION','Actor or its full-raw context changed');
    const after=store.verifyJournal();check(canonical(before)===canonical(after),'DIAGNOSTIC_MUTATION','Preserved journal changed');
    const implementationFiles=['source-acquisition-projection.mjs','source-documentary-scope.mjs','workers.mjs'];
    return {schema:'sovereign.source-acquisition-diagnostic.v1',checkedAt:new Date().toISOString(),databasePath:path,runId,
      implementationSha256:Object.fromEntries(implementationFiles.map(name=>[name,sha256(fs.readFileSync(new URL('../../factory/lib/'+name,import.meta.url)))])),
      before,after,actorRecordHash:runBefore.hash,originalContextHash:preview.originalContextHash,viewHash:preview.viewHash,
      bytes:{...preview.bytes,completePreviewEnvelope:Buffer.byteLength(JSON.stringify(preview))},
      sources:preview.view.sourceManifests.map(m=>({sourceId:m.sourceId,hash:m.sourceHash,rawBytes:m.rawBytes,url:m.url})),
      omittedFields:preview.omittedFields,
      preservedTopLevelFields:Object.keys(context).filter(k=>!['sources','artifacts','toolObservations'].includes(k)).map(key=>({
        key,sha256:sha256(context[key]),unchanged:canonical(context[key])===canonical(preview.view[key])})),
      scope:'Current-code WorkerService core-context preview only; excludes task/runtimeCapabilities appended by infer(), so these bytes are NOT the historical full-next-request size. No dispatch, model reading, factual candidate, review, recovery, new acquisition, grant or change to sourceIds. Original acquired bytes/receipts/run and full-raw context remain unchanged; the preserved failure stays failed.'};
  }finally{db.exec('ROLLBACK');db.close();}
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  check(process.argv.length===4,'DIAGNOSTIC_ARGS','Provide exactly one preserved database path and actor ID');
  process.stdout.write(JSON.stringify(sourceAcquisitionDiagnostic(process.argv[2],process.argv[3]),null,2)+'\n');
}
