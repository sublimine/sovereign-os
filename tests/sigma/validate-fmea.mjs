import fs from "node:fs";import path from "node:path";import{fileURLToPath}from"node:url";
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..",".."),f=JSON.parse(fs.readFileSync(path.join(root,"config/sigma/fmea.json"),"utf8")),errors=[];let count=0;
for(let i=1;i<=40;i++){const id=`sigma_${String(i).padStart(2,"0")}`,rows=f.agents[id];if(rows?.length!==8){errors.push(`${id} rows !=8`);continue;}for(const row of rows){count++;for(const key of ["failure","profile","detection","containment","recovery","revalidation","escalation"])if(!Array.isArray(row[key])&&!["failure","profile"].includes(key)||Array.isArray(row[key])&&row[key].length===0)errors.push(`${row.id} incomplete ${key}`);}}
if(count!==320)errors.push(`rows ${count} !=320`);if(Object.keys(f.profiles).length!==8)errors.push("profiles !=8");
if(errors.length){console.error("SIGMA FMEA VALIDATION FAILED");errors.forEach(e=>console.error("- "+e));process.exit(1);}
console.log("SIGMA FMEA VALIDATION PASSED");console.log(JSON.stringify({agents:40,role_specific_rows:count,profiles:8,DC_RRE_complete:true}));

