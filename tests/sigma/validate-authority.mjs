import fs from "node:fs";import path from "node:path";import{fileURLToPath}from"node:url";
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..",".."),m=JSON.parse(fs.readFileSync(path.join(root,"config/sigma/authority-actions.json"),"utf8")),errors=[];
if(m.actions.length!==24)errors.push("actions != 24");if(Object.keys(m.agents).length!==40)errors.push("agents != 40");
for(let i=1;i<=40;i++){const id=`sigma_${String(i).padStart(2,"0")}`,row=m.agents[id];if(!row){errors.push(`${id} absent`);continue;}for(const action of m.actions){if(!["P","C","X","A"].includes(row[action]))errors.push(`${id}/${action} invalid`);}}
if(m.agents.sigma_40.MODIFY_POLICY!=="X")errors.push("sigma_40 must never modify policy");
if(m.agents.sigma_37.DISSEMINATE_SENSITIVE!=="A")errors.push("sigma_37 sensitive dissemination must require external approval");
if(m.agents.sigma_09.CONTACT_EXTERNAL!=="A")errors.push("sigma_09 external contact must require external approval");
for(const id of ["sigma_07","sigma_08","sigma_10","sigma_11"])if(m.agents[id].CONTACT_EXTERNAL!=="X")errors.push(`${id} unauthorized external contact`);
if(errors.length){console.error("SIGMA AUTHORITY VALIDATION FAILED");errors.forEach(e=>console.error("- "+e));process.exit(1);}
console.log("SIGMA AUTHORITY VALIDATION PASSED");console.log(JSON.stringify({agents:40,actions:24,explicit_cells:960,default_deny:true}));
