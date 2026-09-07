import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..",".."),read=p=>JSON.parse(fs.readFileSync(path.join(root,p),"utf8"));
const ds=Array.from({length:40},(_,i)=>read(`config/sigma/v3/dossiers/sigma-${String(i+1).padStart(2,"0")}.json`)),edges=read("config/sigma/relationships.json").edges;
const clone=x=>structuredClone(x),failures=[];
const detectors={
 duplicateArtifact:x=>new Set(x.map(d=>d.agent.artifact)).size!==x.length,
 duplicateLedger:x=>new Set(x.flatMap(d=>d.memory.commit)).size!==x.flatMap(d=>d.memory.commit).length,
 missingBoundary:x=>x.some(d=>d.doctrine.boundaries.length<12),
 selfCertification:x=>x.some(d=>d.gates.some(g=>g.evaluation_independence==="SELF_CONTROL"&&g.certification_effect!=="NONE")),
 specialistExplosion:x=>x.some(d=>d.specialists.some(s=>s.max_children>0||s.max_depth>0)),
 commandCycle:e=>e.filter(x=>x.type==="COMMANDS").some(x=>e.some(y=>y.type==="COMMANDS"&&y.from===x.to&&y.to===x.from))
};
const mutations=[
 ["duplicate artifact",()=>{const x=clone(ds);x[1].agent.artifact=x[0].agent.artifact;return detectors.duplicateArtifact(x)}],
 ["duplicate commit ledger",()=>{const x=clone(ds);x[1].memory.commit=x[0].memory.commit;return detectors.duplicateLedger(x)}],
 ["remove jurisdiction boundaries",()=>{const x=clone(ds);x[2].doctrine.boundaries=[];return detectors.missingBoundary(x)}],
 ["allow self certification",()=>{const x=clone(ds),g=x[3].gates.find(y=>y.evaluation_independence==="SELF_CONTROL");g.certification_effect="CERTIFY";return detectors.selfCertification(x)}],
 ["allow child proliferation",()=>{const x=clone(ds);x[4].specialists[0].max_children=3;return detectors.specialistExplosion(x)}],
 ["insert reciprocal command",()=>{const e=clone(edges),c=e.find(x=>x.type==="COMMANDS");e.push({from:c.to,to:c.from,type:"COMMANDS",scope:"malicious"});return detectors.commandCycle(e)}]
];
for(const [name,test] of mutations)if(!test())failures.push(`audit accepted mutation: ${name}`);
if(failures.length){console.error("SIGMA V3 MUTATION RESISTANCE FAILED");failures.forEach(x=>console.error(`- ${x}`));process.exit(1)}
console.log("SIGMA V3 MUTATION RESISTANCE PASSED");console.log(JSON.stringify({mutations:mutations.length,detected:mutations.length}));
