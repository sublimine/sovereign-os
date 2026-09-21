import * as fs from 'node:fs';
import {join} from 'node:path';
import {FactoryEngine} from '../../factory/lib/engine.mjs';
import {packContext,unpackContext} from '../../factory/lib/context-codec.mjs';
import {sha256} from '../../factory/lib/contracts.mjs';
const directory=process.argv[2],output=process.argv[3];if(!directory||!output)throw Error('Explicit state directory and new report file required');
const engine=new FactoryEngine({databasePath:join(directory,'state.sqlite'),workspaceRoot:join(directory,'workspaces')});
try{
  const rows=engine.store.list('run').map(r=>{const context=engine.workers.context(r.id),packed=packContext(context);
    return {runId:r.id,mode:r.data.mode,nodeId:r.data.nodeId,logicalBytes:packed.logicalBytes,wireBytes:packed.wireBytes,savedBytes:packed.savedBytes,encoding:packed.encoding,textCount:packed.textCount,
      roundTripVerified:sha256(JSON.stringify(context))===sha256(packed.encoding==='plain-json'?packed.input:JSON.stringify(unpackContext(JSON.parse(packed.input))))};});
  const summary={scope:'Offline lossless byte measurement of persisted runtime exposures; no model call, no claim of token savings or model-equivalent comprehension. Codec not enabled for live workers.',rows};
  fs.writeFileSync(output,JSON.stringify(summary,null,2),{flag:'wx',mode:0o600});process.stdout.write(JSON.stringify(summary)+'\n');
}finally{engine.close();}
