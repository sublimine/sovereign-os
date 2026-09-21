// Read-only diagnostic on one explicitly selected preserved trial database.
// No Store constructor, inference, recovery, source fetch or acceptance mutation.
import * as fs from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {DatabaseSync} from 'node:sqlite';
import {Store} from '../../factory/lib/store.mjs';
import {check,sha256,canonical} from '../../factory/lib/contracts.mjs';
import {findSourceLiteral,readSourceWindow} from '../../factory/lib/source-windows.mjs';

export function sourceWindowDiagnostic(databasePath){
  const path=resolve(databasePath);
  check(fs.realpathSync(path)===path&&fs.lstatSync(path).isFile(),'DIAGNOSTIC_PATH','Exact real database file required');
  const db=new DatabaseSync(path,{readOnly:true,timeout:5000});
  db.exec('PRAGMA query_only=ON; PRAGMA trusted_schema=OFF; BEGIN');
  const store={db,get:Store.prototype.get,list:Store.prototype.list,events:Store.prototype.events,verifyJournal:Store.prototype.verifyJournal};
  try{
    const before=store.verifyJournal(),results=store.list('source').map(record=>{
      const s=record.data;check(sha256(s.raw)===s.hash,'SOURCE_INTEGRITY','Preserved raw hash differs');
      const queries=['NULL values','null values','DISTINCT'].map(literal=>{
        const locations=findSourceLiteral(s,{literal,maxMatches:4});
        const windows=locations.matches.map(m=>{const w=readSourceWindow(s,{startByte:m.startByte,maxBytes:700});
          return {startByte:w.startByte,endByte:w.endByte,textSha256:w.textSha256,completeRawDocument:w.completeRawDocument};});
        return {locations,windows};
      });
      return {sourceId:s.id,hash:s.hash,rawBytes:Buffer.byteLength(s.raw),url:s.url,queries};
    }),after=store.verifyJournal();
    check(canonical(before)===canonical(after),'DIAGNOSTIC_MUTATION','Preserved journal changed');
    return {schema:'sovereign.source-window-diagnostic.v1',checkedAt:new Date().toISOString(),databasePath:path,
      implementationSha256:sha256(fs.readFileSync(new URL('../../factory/lib/source-windows.mjs',import.meta.url))),before,after,results,
      scope:'Read-only literal locations on preserved acquired snapshots. No inference, recovery, new source download, completed actor exposure or factual acceptance. Case-sensitive absence of a string is not absence of a proposition; HTML boundaries and wording still require investigation.'};
  }finally{db.exec('ROLLBACK');db.close();}
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  check(process.argv.length===3,'DIAGNOSTIC_ARGS','Provide exactly one preserved database path');
  process.stdout.write(JSON.stringify(sourceWindowDiagnostic(process.argv[2]),null,2)+'\n');
}
