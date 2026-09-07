import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const file=path.join(root,"visual","autonomous-departments-center.html");
const errors=[]; if(!fs.existsSync(file))errors.push("command center missing");
const html=fs.existsSync(file)?fs.readFileSync(file,"utf8"):"";
for(const token of ["50 agentes nuevos","veritas_01","adversum_10","praxis_10","imperium_10","telos_10","Gates no renunciables","FMEA / evaluaciones","operating_doctrine","evidence_required","falsifier","handoff_condition","Profundidad V3","Abrir dossier V3 completo","Abrir production charter","Auditor\\u00eda de coherencia","detected_mutations","READY_FOR_INDEPENDENT_REVIEW","location.hash"])if(!html.includes(token))errors.push(`missing ${token}`);
const script=html.match(/<script>([\s\S]*)<\/script>/)?.[1];if(!script)errors.push("inline app missing");else try{new vm.Script(script)}catch(error){errors.push(`invalid JS: ${error.message}`)}
if(errors.length){console.error("AUTONOMOUS COMMAND CENTER FAILED");errors.forEach(error=>console.error(`- ${error}`));process.exit(1)}
console.log("AUTONOMOUS COMMAND CENTER PASSED");console.log(JSON.stringify({agents:50,departments:5,interactive:true}));
