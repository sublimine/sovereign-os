import * as fs from 'node:fs';
import {join} from 'node:path';
import {PublicSearch} from '../../factory/providers/public-search.mjs';
import {sha256} from '../../factory/lib/contracts.mjs';
const directory=process.argv[2];if(!directory||fs.readdirSync(directory).length)throw Error('Explicit new empty probe directory required');
const args={query:'site:sqlite.org foreign key constraints enable PRAGMA foreign_keys',limit:3};
const manifest={startedAt:new Date().toISOString(),scope:'Actual subscription-native public search in a dedicated host-tool-closed client. Discovery candidates only; not retrieved source bytes or full mission acceptance.',args,
  inputs:Object.fromEntries(['factory/providers/codex.mjs','factory/providers/public-search.mjs','factory/providers/instruction-profiles.mjs'].map(p=>[p,sha256(fs.readFileSync(p))]))};
fs.writeFileSync(join(directory,'manifest.json'),JSON.stringify(manifest,null,2),{flag:'wx',mode:0o600});
let result;
try{result=await new PublicSearch().search(args);result={...manifest,passed:result.candidates.length>0&&result.candidates.every(c=>new URL(c.url).hostname==='www.sqlite.org'||new URL(c.url).hostname==='sqlite.org'),result};}
catch(error){result={...manifest,passed:false,error:{code:error.code??'INTERNAL',reason:error.message,details:error.details??null}};}
fs.writeFileSync(join(directory,'result.json'),JSON.stringify(result,null,2),{flag:'wx',mode:0o600});
process.stdout.write(JSON.stringify(result)+'\n');if(!result.passed)process.exitCode=2;
