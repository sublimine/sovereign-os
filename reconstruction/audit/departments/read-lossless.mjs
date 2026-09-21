import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
const root=process.cwd();
const basePath='docs/departments/truth_verification/agents/v3/veritas_01-dossier.md';
const sha=s=>crypto.createHash('sha256').update(s).digest('hex');
function fields(s){
 const get=re=>{const m=s.match(re);if(!m)throw Error(String(re));return m[1];};
 return {id:get(/^# (\w+) —/m),name:get(/^# \w+ — (.+) · Dossier/m),department:get(/\*\*Departamento:\*\* (.+)  /),artifact:get(/\*\*Artefacto exclusivo:\*\* `([^`]+)`/),boundary:get(/\*\*Frontera:\*\* no sustituye a (.+)\./),question:get(/## 1\. Pregunta irreductible\n\n(.+)\n/),method:get(/\*\*M1 — Operación:\*\* (.+)\./),floor:get(/\*\*Evidencia mínima:\*\* (.+)\./),falsifier:get(/\*\*Falsificador:\*\* (.+)\./),handoff:get(/\*\*Handoff:\*\* (.+)\./),schema:get(/se valida contra `([^`]+)`/)};
}
const base=fs.readFileSync(basePath,'utf8'),b=fields(base);
const dirs=['truth_verification','adversarial_attack','prediction_decision','final_quality_evolution','institutional_power'];
const records=[];
for(const dept of dirs)for(const name of fs.readdirSync(`docs/departments/${dept}/agents/v3`).sort()){
 const source=`docs/departments/${dept}/agents/v3/${name}`,target=fs.readFileSync(source,'utf8'),f=fields(target);
 const replacements=Object.keys(b).filter(k=>b[k]!==f[k]).map(k=>({field:k,from:b[k],to:f[k]})).sort((x,y)=>y.from.length-x.from.length);
 const esc=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
 const regex=new RegExp(replacements.map(r=>esc(r.from)).join('|'),'g');
 const locations=[];
 const reconstructed=replacements.length?base.replace(regex,(match,offset)=>{const r=replacements.find(r=>r.from===match);locations.push({field:r.field,baseOffset:Buffer.byteLength(base.slice(0,offset)),baseLine:base.slice(0,offset).split('\n').length});return r.to;}):base;
 const charter=`config/departments/v3/charters/${f.id}.system.md`;
 const residuals=[];const actualLines=target.split('\n'),rebuiltLines=reconstructed.split('\n');
 for(let i=0;i<Math.max(actualLines.length,rebuiltLines.length);i++)if(actualLines[i]!==rebuiltLines[i])residuals.push({line:i+1,reconstructed:rebuiltLines[i],actual:actualLines[i]});
 const charterBasePath='config/departments/v3/charters/veritas_01.system.md',charterBase=fs.readFileSync(charterBasePath,'utf8'),charterText=fs.readFileSync(charter,'utf8');
 const charterLocations=[];
 const charterRebuilt=replacements.length?charterBase.replace(regex,(match,offset)=>{const r=replacements.find(r=>r.from===match);charterLocations.push({field:r.field,line:charterBase.slice(0,offset).split('\n').length});return r.to;}):charterBase;
 const charterResiduals=[];const ac=charterText.split('\n'),rc=charterRebuilt.split('\n');
 for(let i=0;i<Math.max(ac.length,rc.length);i++)if(ac[i]!==rc[i])charterResiduals.push({line:i+1,reconstructed:rc[i],actual:ac[i]});
 records.push({source,sha256:sha(target),bytes:Buffer.byteLength(target),lines:target.split('\n').length-1,base:basePath,baseSha256:sha(base),replacements,locations,exact:reconstructed===target,residuals,fields:f,charter,charterBasePath,charterSha256:sha(charterText),charterBytes:Buffer.byteLength(charterText),charterLines:ac.length-1,charterExact:charterRebuilt===charterText,charterLocations,charterResiduals});
}
if(process.argv[2]==='manifest')process.stdout.write(JSON.stringify(records));
else{
 const group=process.argv[2]||'truth_verification';
 const maps=new Map();
 for(const r of records){
  const positions=Object.fromEntries(r.replacements.map(x=>[x.field,r.locations.filter(l=>l.field===x.field).map(l=>l.baseLine)]));
  const ordered=Object.fromEntries(Object.entries(positions).sort(([a],[b])=>a.localeCompare(b))),key=sha(JSON.stringify(ordered));
  const prior=maps.get(key);if(!prior)maps.set(key,r.source);
  if(!r.source.includes(`/${group}/`))continue;
  console.log(JSON.stringify({source:r.source,exactByteReconstruction:r.exact,fields:r.fields}));
  console.log(JSON.stringify({positions:prior?{exactMapSameAs:prior,sha256:key}:positions,residuals:r.residuals,charterExact:r.charterExact,charterLocations:r.charterLocations,charterResiduals:r.charterResiduals}));
 }
}
