import fs from 'node:fs';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
const sha=x=>crypto.createHash('sha256').update(x).digest('hex');
const roles=JSON.parse(fs.readFileSync('reconstruction/audit/departments/roles.json')).roles;
const sources=[];
for(const r of roles){
 const m=JSON.parse(execFileSync(process.execPath,['reconstruction/audit/history-departments-sigma-complement/read-history.mjs','department',r.id,'manifest'],{maxBuffer:30_000_000}));
 sources.push({...m,role:r.id,coverage:'complete',method:r.id==='veritas_01'?'literal_complete_base':'literal_substitutions_all_positions_and_complete_residuals_byteexact',currentCounterpart:r.sources[0].path,differences:'Historical identity, artifact, role question and boundary retained in V3; generic ANALYZE becomes role-specific EXECUTE_METHOD; six gates become eight with no-self-certification retained as invariant; FMEA16 becomes richer role-specific coverage.',relevance:'No unique historical capability lost detected. Preserve METHOD_FIT as suitability, not mere method execution. See individual current role audit for semantic responsibilities.'});
}
for(let n=20;n<=40;n++){
 const m=JSON.parse(execFileSync(process.execPath,['reconstruction/audit/history-departments-sigma-complement/read-history.mjs','sigma',String(n),'manifest'],{maxBuffer:30_000_000}));
 sources.push({...m,role:`sigma_${n}`,coverage:'complete',method:n===20?'literal_complete_base':'literal_substitutions_all_positions_and_complete_residuals_byteexact',currentCounterpart:`docs/sigma/agents/v3/sigma-${n}-dossier.md`,differences:'Historical scope, exclusions, invariants, topology, six named gates, authority exceptions, specialists and illustrative example read individually against V3 current role audit.',relevance:'Preserve method-specific boundaries and authority exceptions; examples are not observed results. See analysis historical findings.'});
}
for(let n=20;n<=40;n++){
 const path=`config/sigma/v3/dossiers/sigma-${n}.json`,raw=fs.readFileSync(path);
 sources.push({source:path,sha256:sha(raw),bytes:raw.length,role:`sigma_${n}`,coverage:n===20?'partial':'not_complete',method:n===20?'initial_metadata_and_operational_object_literal_read':'candidate_fields_only_in_previous_audit',differences:null,relevance:'Auxiliary remains unclosed; no completeness inferred from hash or agreement of selected fields.'});
}
process.stdout.write(JSON.stringify({schemaVersion:1,date:'2026-09-09',status:'historical_complete_auxiliary_incomplete',scope:'50 department historical dossiers;21 Sigma20–40 historical dossiers;21 Sigma20–40 V3 auxiliary JSON',counts:{complete:71,partial:1,notComplete:20},note:'Hashes verify identity, not reading. Reconstruction coverage is distinct from repeated literal reading. No runtime claims.',sources},null,2)+'\n');
