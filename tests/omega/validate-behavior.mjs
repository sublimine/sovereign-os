import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..","..");
const errors=[];

// Root-cause correction: transitive, branch-aware and idempotent.
const fixture=JSON.parse(fs.readFileSync(path.join(root,"tests","omega","fixtures","dependency-graph.json"),"utf8"));
const next=new Map(fixture.nodes.map(n=>[n,[]]));
for(const [a,b] of fixture.edges) next.get(a).push(b);
const invalidate=rootNode=>{
  const out=new Set(), q=[rootNode];
  while(q.length){const x=q.shift();for(const y of next.get(x)??[]){if(!out.has(y)){out.add(y);q.push(y);}}}
  return [...out].sort();
};
const first=invalidate(fixture.retract), second=invalidate(fixture.retract);
if(JSON.stringify(first)!==JSON.stringify([...fixture.expected_invalid].sort())) errors.push("transitive invalidation incorrect");
if(JSON.stringify(first)!==JSON.stringify(second)) errors.push("invalidation not idempotent");
if(first.includes("unrelated_H")) errors.push("unrelated branch invalidated");

// Activation: deterministic hard rules and selective participation.
const policy=JSON.parse(fs.readFileSync(path.join(root,"config","activation-policy.json"),"utf8"));
const allIds=new Set(Array.from({length:24},(_,i)=>"omega_"+String(i+1).padStart(2,"0")));
const activate=m=>{
  const out=new Set(policy.baseline);
  const ge=(v,t)=>Number(v??0)>=t;
  if(m.decision_required) out.add("omega_01");
  if(m.materiality==="M4") out.add("omega_03");
  if(m.research_required){out.add("omega_05");out.add("omega_06");}
  if(ge(m.factual_sensitivity,3)){out.add("omega_07");out.add("omega_11");}
  if(ge(m.uncertainty,3)){["omega_09","omega_10","omega_12"].forEach(x=>out.add(x));}
  if(m.causality_material)["omega_08","omega_13","omega_15"].forEach(x=>out.add(x));
  if(ge(m.irreversibility,4))["omega_13","omega_14","omega_18","omega_19","omega_21","omega_22"].forEach(x=>out.add(x));
  if(m.simulation_required) out.add("omega_16");
  if(m.strategy_required)["omega_15","omega_17","omega_18","omega_19","omega_20","omega_21"].forEach(x=>out.add(x));
  if(ge(m.capital,4)) out.add("omega_20");
  if(ge(m.legitimacy,2)) out.add("omega_21");
  if(ge(m.duration,3)) out.add("omega_24");
  if(m.priority==="P0"||m.materiality==="M4")["omega_01","omega_03","omega_09","omega_10","omega_11","omega_12","omega_13","omega_14","omega_19","omega_21","omega_22","omega_23"].forEach(x=>out.add(x));
  return out;
};
const simple=activate({materiality:"M0",priority:"P3"});
if(simple.size!==4) errors.push("simple mission should activate exactly baseline 4");
const factual=activate({materiality:"M2",priority:"P2",research_required:true,factual_sensitivity:4,uncertainty:4});
for(const id of ["omega_05","omega_06","omega_07","omega_09","omega_10","omega_11","omega_12"]) if(!factual.has(id)) errors.push("factual route missing "+id);
if(factual.has("omega_01")||factual.has("omega_19")) errors.push("factual mission over-activated sovereign/risk");
const extreme=activate({materiality:"M4",priority:"P0",decision_required:true,research_required:true,factual_sensitivity:5,uncertainty:5,causality_material:true,irreversibility:5,simulation_required:true,strategy_required:true,capital:5,legitimacy:5,duration:5});
for(const id of allIds) if(!extreme.has(id)) errors.push("extreme mission missing "+id);

if(errors.length){console.error("BEHAVIOR VALIDATION FAILED");errors.forEach(e=>console.error("- "+e));process.exit(1);}
console.log("BEHAVIOR VALIDATION PASSED");
console.log(JSON.stringify({invalidation:first.length,simple_activation:simple.size,factual_activation:factual.size,extreme_activation:extreme.size}));

