import * as fs from 'node:fs';
import {resolve} from 'node:path';
import {readRecordedContexts} from './read-recorded-contexts.mjs';
import {packContext,unpackContext} from '../../factory/lib/context-codec.mjs';
import {packJsonContext,unpackJsonContext} from '../../factory/lib/context-json-codec.mjs';
import {sha256} from '../../factory/lib/contracts.mjs';
const [output,...databases]=process.argv.slice(2);
if(!output||!databases.length||fs.existsSync(output))throw Error('Explicit new output and historical databases required');
const rows=databases.flatMap(path=>readRecordedContexts(path).map(({context,...record})=>{
  const v1=packContext(context),v2=packJsonContext(context);
  const restored=v2.encoding==='plain-json'?v2.input:JSON.stringify(v2.encoding==='sovereign.lossless-context.v2'?unpackJsonContext(JSON.parse(v2.input)):unpackContext(JSON.parse(v2.input)));
  if(restored!==JSON.stringify(context))throw Error('Historical source/receipt exposure changed');
  return {databasePath:resolve(path),...record,contextHash:sha256(JSON.stringify(context)),sources:context.sources.length,
    logicalBytes:v1.logicalBytes,v1WireBytes:v1.wireBytes,v2WireBytes:v2.wireBytes,jsonStringCount:v2.jsonStringCount,encoding:v2.encoding,roundTripVerified:true};
}));
const result={capturedAt:new Date().toISOString(),scope:'Read-only reconstruction of current recorded actor exposures without the task envelope; not complete historical inference requests, tokens or a model equivalence claim.',
  codecHash:sha256(fs.readFileSync(new URL('../../factory/lib/context-json-codec.mjs',import.meta.url))),rows};
fs.writeFileSync(output,JSON.stringify(result,null,2),{flag:'wx',mode:0o600});process.stdout.write(JSON.stringify(result,null,2)+'\n');
