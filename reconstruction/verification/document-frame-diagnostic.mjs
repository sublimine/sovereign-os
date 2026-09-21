// Prepare only in a private SQLite backup of an exact preserved source run.
// No inference, mission recovery, source fetch, broker call or acceptance.
import * as fs from 'node:fs';
import {resolve,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {DatabaseSync,backup} from 'node:sqlite';
import {Store} from '../../factory/lib/store.mjs';
import {Authority} from '../../factory/lib/authority.mjs';
import {ArtifactRegistry} from '../../factory/lib/artifacts.mjs';
import {WorkerService} from '../../factory/lib/workers.mjs';
import {check,canonical,sha256,identifier} from '../../factory/lib/contracts.mjs';
import {findSourceLiteral} from '../../factory/lib/source-windows.mjs';
import {prepareSourceManifestGrant} from '../../factory/lib/source-manifest-grants.mjs';
import {prepareSourceWindowSelection} from '../../factory/lib/source-window-evidence.mjs';
import {documentContextRequestEvidence,readDocumentContextFrame} from '../../factory/lib/document-context-frames.mjs';
import {readHistoryFingerprint} from './read-history-fingerprint.mjs';

export async function documentFrameDiagnostic(databasePath,runId,outputDirectory){
  identifier(runId);const path=resolve(databasePath),directory=resolve(outputDirectory);
  check(fs.realpathSync(path)===path&&fs.lstatSync(path).isFile(),'DIAGNOSTIC_PATH','Exact preserved database file required');
  check(fs.realpathSync(directory)===directory&&fs.lstatSync(directory).isDirectory()&&fs.readdirSync(directory).length===0,
    'DIAGNOSTIC_PATH','New empty exact private output directory required');
  const write=(name,value)=>fs.writeFileSync(join(directory,name),JSON.stringify(value,null,2)+'\n',{flag:'wx',mode:0o600});
  const startedAt=new Date().toISOString(),source=new DatabaseSync(path,{readOnly:true,defensive:true,allowExtension:false});
  source.exec('PRAGMA query_only=ON; PRAGMA trusted_schema=OFF');
  let store;
  try{
    const originalBefore=readHistoryFingerprint(source);
    write('started.json',{startedAt,databasePath:path,runId,source:originalBefore,
      scriptHash:sha256(fs.readFileSync(new URL(import.meta.url))),scope:'Preparation-only private backup diagnostic; no inference or mission recovery authorized.'});
    await backup(source,join(directory,'state.sqlite'));
    check(canonical(readHistoryFingerprint(source))===canonical(originalBefore),'DIAGNOSTIC_MUTATION','Original changed during backup');
    store=new Store(join(directory,'state.sqlite'));
    check(canonical(readHistoryFingerprint(store.db))===canonical(originalBefore),'DIAGNOSTIC_MUTATION','Backup differs from original history');
    const authority=new Authority(store),registry=new ArtifactRegistry(store,authority),workers=new WorkerService({store,authority,registry,
      broker:{executionAvailable:()=>false,searchAvailable:()=>false},providerFactory:()=>{throw Error('Diagnostic must never infer');}});
    const actorBefore=store.get('run',runId),missionBefore=store.get('mission',actorBefore?.data.missionId),run=actorBefore.data;
    check(!run.expectedRequestHash,'DIAGNOSTIC_PENDING','A pending original request must be reconciled, not projected');
    const heads=()=>store.db.prepare('SELECT type,id,version FROM heads ORDER BY type,id').all().map(r=>({...r,hash:store.get(r.type,r.id,r.version).hash}));
    const beforeHeads=heads(),beforeJournal=store.verifyJournal();
    const sources=store.list('source').filter(r=>r.data.missionId===run.missionId&&run.toolObservations?.some(o=>o.id===r.data.receiptId));
    check(sources.length>0&&sources.length<=4,'DIAGNOSTIC_SCOPE','One to four already observed source acquisitions required');
    const selected=sources.map(({data:s})=>{
      const grant=prepareSourceManifestGrant(registry,{runId,sourceId:s.id,origin:{kind:'observed-acquisition'}});
      const queries=['NULL values','null values','DISTINCT'].map(literal=>findSourceLiteral(s,{literal,maxMatches:4}));
      const location=queries.find(q=>q.matches.length)?.matches[0]?.startByte??0;
      const window=prepareSourceWindowSelection(registry,{runId,sourceId:s.id,grantId:grant.grant.id,ranges:[{startByte:location,maxBytes:16384}]});
      return {sourceId:s.id,hash:s.hash,rawBytes:Buffer.byteLength(s.raw),queries,grant,window};
    });
    const task=JSON.stringify({diagnostic:'PREPARATION_ONLY_NO_DISPATCH',
      scope:'Synthetic diagnostic task, NOT reconstruction of the failed next task. Literal first matches are not evidence of relevance, full reading or factual support.',
      requirements:['Keep original failed mission, actor, acquisitions and all prior requests unchanged.','Prepare grants, windows and one signed bounded input only.'],
      queries:selected.map(s=>({sourceId:s.sourceId,locations:s.queries}))});
    const input=workers.prepareDocumentInput({runId,task,grantIds:selected.map(s=>s.grant.grant.id),selectionIds:selected.map(s=>s.window.selection.id)});
    check(canonical(readDocumentContextFrame(registry,input.documentContextFrame.id,{runId}))===canonical(input),
      'DIAGNOSTIC_INTEGRITY','Prepared frame cannot be read back exactly');
    let rejectedExposureCode=null;
    try{documentContextRequestEvidence(registry,{runId,frameId:input.documentContextFrame.id,requestHash:run.inferenceReceipt?.contextHash??'0'.repeat(64)});}
    catch(error){rejectedExposureCode=error.code;}
    check(['DOCUMENT_FRAME_REQUEST','DOCUMENT_FRAME_UNOBSERVED'].includes(rejectedExposureCode),
      'DIAGNOSTIC_INTEGRITY','Preparation must not reuse an old completion as exposure to this new frame');
    const afterHeads=heads(),newTypes=new Set(['source-manifest-grant','source-window-selection','document-context-frame']);
    check(beforeHeads.every(r=>afterHeads.some(a=>canonical(a)===canonical(r)))
      &&afterHeads.filter(r=>!beforeHeads.some(b=>b.type===r.type&&b.id===r.id)).every(r=>newTypes.has(r.type)),
    'DIAGNOSTIC_MUTATION','Only new documentary preparation records may be added in the backup');
    check(canonical(store.get('run',runId))===canonical(actorBefore)&&canonical(store.get('mission',run.missionId))===canonical(missionBefore),
      'DIAGNOSTIC_MUTATION','Original actor or failed mission changed in the backup');
    const originalAfter=readHistoryFingerprint(source);
    check(canonical(originalAfter)===canonical(originalBefore),'DIAGNOSTIC_MUTATION','Preserved source history changed');
    const result={schema:'sovereign.document-frame-diagnostic.v1',startedAt,completedAt:new Date().toISOString(),databasePath:path,directory,runId,
      originalBefore,originalAfter,copyBefore:beforeJournal,copyAfter:store.verifyJournal(),
      actorRecordHash:actorBefore.hash,missionRecordHash:missionBefore.hash,missionStatus:missionBefore.data.status,
      frame:input.documentContextFrame,logicalInputHash:sha256(input),logicalInputBytes:Buffer.byteLength(JSON.stringify(input)),
      catalogKinds:input.documentEvidenceCatalog.map(e=>e.kind),rejectedExposureCode,
      selected:selected.map(s=>({sourceId:s.sourceId,hash:s.hash,rawBytes:s.rawBytes,grant:s.grant.grant,selection:s.window.selection,
        windows:s.window.windows.map(w=>({startByte:w.startByte,endByte:w.endByte,textSha256:w.textSha256,completeRawDocument:w.completeRawDocument}))})),
      sourceSummariesUnchanged:true,actorAndMissionUnchanged:true,newInferenceCount:0,newAcquisitionCount:0,
      scope:'Private-backup preparation only. Exact real acquired snapshots and histories are preserved; new grants/windows/frame exist only in this copy. Diagnostic task and local first-match selection are NOT a historical next request, live model exposure, semantic relevance, source coverage, factual candidate, review, mission recovery or qualification of the failed trial.'};
    write('frame.json',input);write('result.json',result);return result;
  }finally{store?.close();source.close();}
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  check(process.argv.length===5,'DIAGNOSTIC_ARGS','Exact original database, actor ID and new empty output directory required');
  process.umask(0o077);
  process.stdout.write(JSON.stringify(await documentFrameDiagnostic(...process.argv.slice(2)),null,2)+'\n');
}
