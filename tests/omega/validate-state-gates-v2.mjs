import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..","..");
const machines=JSON.parse(fs.readFileSync(path.join(root,"config","state-machines-v2.json"),"utf8"));
const gates=JSON.parse(fs.readFileSync(path.join(root,"config","quality-gates-v2.json"),"utf8"));
const errors=[];
for(let i=1;i<=24;i++){
  const id="omega_"+String(i).padStart(2,"0"), m=machines.agents[id], g=gates.agents[id];
  if(!m) errors.push(id+" machine missing");
  else {
    if(m.path[0]!==m.initial) errors.push(id+" initial mismatch");
    if(m.path.length<9) errors.push(id+" happy path too short");
    if(m.path.at(-1)!=="COMPLETED") errors.push(id+" no completed terminal");
    if(Object.keys(m.branches).length<6) errors.push(id+" insufficient branch semantics");
    if(new Set(m.path).size!==m.path.length) errors.push(id+" duplicate happy-path state");
  }
  if(!g) errors.push(id+" gates missing");
  else {
    if(g.gates.length<7) errors.push(id+" fewer than seven gates");
    if(g.nonwaivable.length<3) errors.push(id+" fewer than three hard gates");
    for(const hard of g.nonwaivable) if(!g.gates.includes(hard)) errors.push(id+" hard gate absent from gate set: "+hard);
  }
}
if(machines.timeout.actions.includes("CHECKPOINT")===false) errors.push("timeout does not checkpoint");
if(machines.deadlock.arbitrator!=="omega_02") errors.push("deadlock arbitrator wrong");
if(gates.outcomes.length!==6) errors.push("gate outcomes incomplete");
if(errors.length){console.error("STATE/GATE V2 VALIDATION FAILED");errors.forEach(e=>console.error("- "+e));process.exit(1);}
console.log("STATE/GATE V2 VALIDATION PASSED");
console.log(JSON.stringify({machines:24,gate_sets:24,timeout_checkpoint:true,deadlock_arbitrator:"omega_02"}));
