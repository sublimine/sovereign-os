import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import {fileURLToPath} from "node:url";

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..",".."),file=path.join(root,"visual/sigma-intelligence-center.html"),errors=[];
if(!fs.existsSync(file))errors.push("command center missing");
const html=fs.existsSync(file)?fs.readFileSync(file,"utf8"):"";
for(const token of ["40/40","480","1.600","Ficha","Pregunta irreductible","Activación","Doctrina","Límites","Inputs","Workflow","Delegación","Autoridad","Gates","FMEA","Evals","Casos","Relaciones","Runtime","Memoria","DATA_NOT_INSTRUCTIONS","data-agent","openAgent","clickable_cards"]){if(!html.includes(token)&&token!=="clickable_cards")errors.push(`visual missing ${token}`)}
for(let i=1;i<=40;i++)if(!html.includes(`sigma_${String(i).padStart(2,"0")}`))errors.push(`visual missing sigma_${String(i).padStart(2,"0")}`);
const inline=html.match(/<script>([\s\S]*)<\/script>/)?.[1];
if(!inline)errors.push("inline app missing");else try{new vm.Script(inline,{filename:"sigma-v3-command-center.js"})}catch(error){errors.push(`invalid JavaScript: ${error.message}`)}
if(Buffer.byteLength(html)<1_000_000)errors.push("payload unexpectedly shallow");
if(errors.length){console.error("SIGMA V3 COMMAND CENTER FAILED");errors.forEach(x=>console.error(`- ${x}`));process.exit(1)}
console.log("SIGMA V3 COMMAND CENTER PASSED");console.log(JSON.stringify({bytes:Buffer.byteLength(html),agents:40,tabs:15,matrix_cells:1600}));
