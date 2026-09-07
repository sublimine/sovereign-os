import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..","..");
const fixture=JSON.parse(fs.readFileSync(path.join(root,"tests","omega","fixtures","simulations-v2.json"),"utf8"));
const catalog=JSON.parse(fs.readFileSync(path.join(root,"config","event-catalog.json"),"utf8"));
const errors=[],all=new Set(Array.from({length:24},(_,i)=>"omega_"+String(i+1).padStart(2,"0")));
if(fixture.simulations.length!==7) errors.push("expected seven simulations");
for(const sim of fixture.simulations){
  const a=new Set(sim.active), inactive=new Set(sim.inactive);
  for(const id of a) if(inactive.has(id)) errors.push(sim.id+" active/inactive overlap "+id);
  const union=new Set([...a,...inactive]);
  for(const id of all) if(!union.has(id)) errors.push(sim.id+" activation partition misses "+id);
  if(union.size!==24) errors.push(sim.id+" activation partition has unknown IDs");
  if(!sim.specialists.length) errors.push(sim.id+" no specialists");
  let expected=1;
  for(const e of sim.events){
    if(e.seq!==expected++) errors.push(sim.id+" noncontiguous event sequence");
    if(!catalog.events.includes(e.type)) errors.push(sim.id+" unknown event "+e.type);
    if(!e.actor||!e.artifact) errors.push(sim.id+" incomplete event "+e.seq);
  }
  for(const t of ["MISSION_CREATED","AGENT_SPAWNED","EVIDENCE_ACQUIRED","VERIFICATION_PASSED","MISSION_COMPLETED"])
    if(!sim.events.some(e=>e.type===t)) errors.push(sim.id+" missing event "+t);
  if(!sim.decision.status||!sim.decision.reason) errors.push(sim.id+" decision incomplete");
  for(const art of sim.material_artifacts){
    if(art.certifiers.includes(art.producer)) errors.push(sim.id+" self certification "+art.id);
  }
}
const F=fixture.simulations.find(s=>s.id==="F"),E=fixture.simulations.find(s=>s.id==="E"),G=fixture.simulations.find(s=>s.id==="G");
if(!F.events.some(e=>e.type==="SOURCE_DEPENDENCY_DISCOVERED")) errors.push("F misses dependency collapse");
if(!E.events.some(e=>e.type==="CLAIM_RETRACTED")||!E.events.some(e=>e.type==="CLAIM_STALE")) errors.push("E misses root correction propagation");
if(G.active.length!==24) errors.push("G must activate all 24");
if(errors.length){console.error("SIMULATION TRACE V2 VALIDATION FAILED");errors.forEach(e=>console.error("- "+e));process.exit(1);}
console.log("SIMULATION TRACE V2 VALIDATION PASSED");
console.log(JSON.stringify({simulations:7,event_traces:fixture.simulations.reduce((n,s)=>n+s.events.length,0),activation_partitions:true,no_self_certification:true}));

