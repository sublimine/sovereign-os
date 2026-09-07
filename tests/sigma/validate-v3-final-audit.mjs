import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..",".."),read=p=>JSON.parse(fs.readFileSync(path.join(root,p),"utf8")),errors=[];
const a=read("config/sigma/v3/final-sovereign-audit.json"),md=fs.readFileSync(path.join(root,"docs/sigma/SIGMA-ARCHITECTURE-ADVERSARIAL-AUDIT.md"),"utf8");
if(a.status!=="PASS"||a.passes.length!==10||a.passes.some(x=>x.status!=="PASS"))errors.push("ten-pass audit not PASS");
if(a.minimality.length!==40||a.minimality.some(x=>x.removable_without_loss||!x.owned_capabilities.length))errors.push("minimality proof incomplete");
if(a.universal_failures.length<21||a.metrics.fmea<1400||a.metrics.evals<1700)errors.push("failure/eval coverage shallow");
if(a.residual_risks.length<10||a.validation_debt.length<5)errors.push("residual/debt hidden");
for(let i=1;i<=10;i++)if(!md.includes(`Pasada ${i}`))errors.push(`markdown missing pass ${i}`);
if(!md.includes("S2")||!/No se afirma infalibilidad/i.test(md))errors.push("maturity overclaim guard missing");
if(errors.length){console.error("SIGMA V3 FINAL AUDIT FAILED");errors.forEach(x=>console.error(`- ${x}`));process.exit(1)}
console.log("SIGMA V3 FINAL AUDIT PASSED");console.log(JSON.stringify({passes:10,roles:40,fmea:a.metrics.fmea,evals:a.metrics.evals}));
