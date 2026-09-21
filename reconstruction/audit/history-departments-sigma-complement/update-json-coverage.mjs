import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
const path='reconstruction/audit/history-departments-sigma-complement/coverage.json';
const x=JSON.parse(fs.readFileSync(path));
const through=Number(process.argv[2]);
for(let n=20;n<=through;n++){
 const m=JSON.parse(execFileSync(process.execPath,['reconstruction/audit/history-departments-sigma-complement/read-history.mjs','json',String(n),'manifest'],{maxBuffer:30_000_000}));
 const i=x.sources.findIndex(s=>s.source===m.source);
 x.sources[i]={...m,role:`sigma_${n}`,coverage:'complete',method:n===20?'literal_complete_base_in_chunks_and_operational_object':'literal_substitutions_all_positions_and_complete_residuals_byteexact',currentCounterpart:`docs/sigma/agents/v3/sigma-${n}-dossier.md`,differences:'Auxiliary JSON read in full by exact reconstruction; preserves structured fields not always rendered by dossier. Semantic differences and wiring caveats in analysis.',relevance:'Normative contract, not executable proof; structured topology and arbitrary generation associations require semantic review.'};
}
x.counts={complete:x.sources.filter(s=>s.coverage==='complete').length,partial:x.sources.filter(s=>s.coverage==='partial').length,notComplete:x.sources.filter(s=>s.coverage==='not_complete').length};
x.status=x.counts.notComplete||x.counts.partial?'historical_complete_auxiliary_incomplete':'complete';
const old=fs.readFileSync(path,'utf8'),next=JSON.stringify(x,null,2)+'\n';
process.stdout.write('*** Begin Patch\n*** Update File: '+path+'\n@@\n'+old.trimEnd().split('\n').map(s=>'-'+s).join('\n')+'\n'+next.trimEnd().split('\n').map(s=>'+'+s).join('\n')+'\n*** End Patch\n');
