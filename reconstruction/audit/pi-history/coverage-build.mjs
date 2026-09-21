import fs from 'node:fs';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {inspect} from './inspect.mjs';
const read=p=>fs.readFileSync(p,'utf8'),parse=p=>JSON.parse(read(p)),sha=x=>crypto.createHash('sha256').update(x).digest('hex');
const meta=path=>{const raw=read(path);return {path,sha256:sha(raw),bytes:Buffer.byteLength(raw),lines:raw.split('\n').length-Number(raw.endsWith('\n'))};};
const inherited=parse('reconstruction/audit/pi/sources.json');
const dossiers=Array.from({length:40},(_,i)=>inspect(i+1)),objects=dossiers.map(d=>parse(d.path));
const records=dossiers.map((d,i)=>{
 const credited=inherited.sources.find(s=>s.path===d.base);if(!credited||credited.sha256!==d.baseSha256)throw Error('Inherited base changed');
 return {...meta(d.path),status:'INHERITED_SEMANTIC_BASE_PLUS_LITERAL_RESIDUALS',ranges:[[1,d.lines]],method:d.method,
  inheritedBase:{path:d.base,sha256:d.baseSha256,manifest:'reconstruction/audit/pi/sources.json',coverage:credited.coverage},
  coordinateSystem:'zero-based UTF-16 string offsets, end-exclusive; original UTF-8 bytes reconstructed exactly without normalization',
  tokenReferences:d.references.map(r=>[...r.target,...r.base]),
  literalResiduals:d.residual,
  structuralContext:{rootKeys:Object.keys(objects[i]),agent:objects[i].agent,delegation:objects[i].delegation},
  exactByteReconstruction:true,
  differences:['JSON keys/typed relationships and operational control block are explicit beyond the rendered Markdown. See analysis.md; no extra agent is inferred.'],
  limitations:['Not a new literal reading of inherited Markdown. Token identity is a byte coverage aid, not proof of functional equivalence. JSON grammar, numeric controls, hierarchy and operational block were separately inspected.']};
});
const aggregates=[['fmea','agents','fmea'],['quality-gates','gate_sets','gates'],['authority-actions','agents','authority'],['state-machines','machines','operational.lifecycle']];
for(const [name,key,field]of aggregates){const path=`config/pi/${name}.json`,o=parse(path),rebuilt={...o,[key]:Object.fromEntries(objects.map(d=>[d.agent.id,field==='operational.lifecycle'?d.operational.lifecycle:d[field]]))};
 if(JSON.stringify(rebuilt,null,2)+'\n'!==read(path))throw Error('Aggregate reconstruction differs '+path);
 records.push({...meta(path),status:'EXACT_DERIVED_AGGREGATE',ranges:[[1,meta(path).lines]],method:'explicit JSON.stringify(object,null,2)+newline, exact whole-file byte comparison; no whitespace normalization assumed',bases:dossiers.map((d,i)=>({path:d.path,sha256:d.sha256,pointer:`/${field.replaceAll('.','/')}`,targetPointer:`/${key}/${objects[i].agent.id}`})),exactByteReconstruction:true,differences:name==='fmea'?['pi_39:false_consensus occurs twice with different causal rows']:[],limitations:['Coverage inherited through the dossier proof; not reread as 40 independent clone blocks.']});
}
const direct=['config/pi/v3/decision-arenas.json','config/pi/v3/simulation-audit.json','config/pi/release-certification.json','config/pi/v3/cross-coherence-audit.json','config/pi/v3/dossier-registry.json','docs/pi/agents/AGENT-DOSSIER-V3-STANDARD.md','docs/pi/PI-RELEASE-MANIFEST.md','docs/pi/PI-V3-CROSS-COHERENCE-AUDIT.md','docs/pi/simulations/PI-V3-SIMULATIONS-A-J.md'];
for(const path of direct)records.push({...meta(path),status:'LITERAL_CONTENT_READ',ranges:[[1,meta(path).lines]],method:path.endsWith('.json')?'complete parsed JSON content printed, preserving fields and order; source hash records original bytes':'full literal text',differences:[],limitations:['Reported PASS is a claim of the source, not this audit certification.']});
const relPath='config/pi/relationships.json',rel=parse(relPath),edges=rel.edges;
const edgeBases=edges.map(e=>{for(let i=0;i<objects.length;i++)for(const side of ['inbound','outbound']){const index=objects[i].relationships[side].findIndex(x=>JSON.stringify(x)===JSON.stringify(e));if(index>=0)return {path:dossiers[i].path,sha256:dossiers[i].sha256,pointer:`/relationships/${side}/${index}`};}throw Error('Unmapped edge');});
const edgeObjects=edgeBases.map(b=>b.pointer.split('/').slice(1).reduce((o,k)=>o[k],parse(b.path)));
if(JSON.stringify({...rel,edges:edgeObjects},null,2)+'\n'!==read(relPath))throw Error('Edges bytes differ');
records.push({...meta(relPath),status:'EXACT_DERIVED_AGGREGATE',ranges:[[1,meta(relPath).lines]],method:'all 278 ordered edges copied from equal dossier edge objects; explicit JSON rendering matches raw bytes; wrapper and allowed_types read',edgeBases,exactByteReconstruction:true,differences:[],limitations:['Information and command edges are not runtime capability grants.']});
const matrixPath='config/pi/v3/relationship-matrix.json',matrix=parse(matrixPath),cells={};
for(const a of objects){cells[a.agent.id]={};for(const b of objects)cells[a.agent.id][b.agent.id]=a.agent.id===b.agent.id?['SELF']:[...new Set(edges.filter(e=>e.from===a.agent.id&&e.to===b.agent.id).map(e=>e.type))];}
if(JSON.stringify({...matrix,cells},null,2)+'\n'!==read(matrixPath))throw Error('Matrix bytes differ');
records.push({...meta(matrixPath),status:'EXACT_DERIVED_AGGREGATE',ranges:[[1,meta(matrixPath).lines]],method:'all 1600 cells reconstructed from ordered relationship edge types; diagonal SELF; absent pair []; explicit JSON rendering equals source bytes',bases:[meta(relPath)],exactByteReconstruction:true,differences:[],limitations:['A matrix cell proves a declared relationship, not an executed exchange.']});
const regPath='config/pi/agent-registry.json',reg=parse(regPath);
const roles=objects.map(d=>Object.fromEntries(Object.keys(reg.roles[0]).map(k=>[k,k==='protected_channel'?['pi_38','pi_39'].includes(d.agent.id):k==='superior'&&d.agent.id==='pi_01'?null:d.agent[k]])));
if(JSON.stringify({...reg,roles},null,2)+'\n'!==read(regPath))throw Error('Registry bytes differ');
records.push({...meta(regPath),status:'EXACT_DERIVED_AGGREGATE_WITH_READ_DIFFERENCES',ranges:[[1,meta(regPath).lines]],method:'ordered role field projection from dossier.agent, with explicit superior=null for pi_01 and protected_channel true only pi_38/pi_39; full exact byte reconstruction',bases:dossiers.map(d=>({path:d.path,sha256:d.sha256,pointer:'/agent'})),exactByteReconstruction:true,differences:['pi_01 superior null instead of omega_17','protected_channel absent from dossier.agent; corresponds to PROTECTED_ASSURANCE_CHANNEL in pi_38/pi_39 independence'],limitations:['Null is not evidence of sovereign independence.']});
const paths=execFileSync('rg',['--files','docs/pi','config/pi'],{encoding:'utf8'}).trim().split('\n');
const excluded=paths.filter(p=>inherited.sources.some(s=>s.path===p));
if(records.length!==56||paths.some(p=>!excluded.includes(p)&&!records.some(r=>r.path===p)))throw Error('Inventory mismatch');
const result={group:'pi-history',date:'2026-09-09',scope:'Current checked-out docs/pi and config/pi absent from prior audit/pi manifest; no Git-history traversal',status:'SUPPLEMENTAL_CURRENT_CORPUS_COVERAGE_WITH_EXPLICIT_INHERITANCE',inventory:{total:paths.length,alreadyCovered:excluded.length,supplemental:records.length},historyLimit:'No v1/v2 role paths found in scoped current directories. This is not full repository or Git history coverage.',sources:records.sort((a,b)=>a.path.localeCompare(b.path)),excludedAsPreviouslyAudited:excluded.sort(),supportingReads:[{...meta('docs/pi/03-PI-AUTHORITY-MATRIX.md'),ranges:[[1,11]],method:'literal full text'},{...meta('scripts/build-pi-v3.mjs'),ranges:[[1,110],[384,384]],method:'partial targeted read; NOT full coverage'}]};
const target='reconstruction/audit/pi-history/coverage.json';
const patch='*** Begin Patch\n*** Add File: '+target+'\n'+JSON.stringify(result,null,2).split('\n').map(l=>'+'+l).join('\n')+'\n*** End Patch\n';
if(process.argv.includes('--write'))execFileSync('/home/cardeex/.codex/tmp/arg0/codex-arg07OqZTZ/apply_patch',[],{input:patch,maxBuffer:1024*1024});
console.log(JSON.stringify({sources:records.length,bytes:Buffer.byteLength(JSON.stringify(result)),verified:true}));
