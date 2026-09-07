import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..","..");
const registry=JSON.parse(fs.readFileSync(path.join(root,"config/sigma/agent-registry.json"),"utf8"));
const catalog=JSON.parse(fs.readFileSync(path.join(root,"config/sigma-production-charters.json"),"utf8"));
const errors=[],ids=new Set(),artifacts=new Set(),procedures=new Set(),commits=new Set(),examples=new Set();
if(registry.roles.length!==40) errors.push("registry count != 40");
if(catalog.agents.length!==40) errors.push("charter catalog count != 40");
for(let i=1;i<=40;i++){
 const n=String(i).padStart(2,"0"),id=`sigma_${n}`,file=path.join(root,"config/sigma/agents",`sigma-${n}.json`);
 let c;try{c=JSON.parse(fs.readFileSync(file,"utf8"));}catch(e){errors.push(`${id} invalid config ${e.message}`);continue;}
 for(const key of ["schema_version","extends","production_ref","agent","scope","interfaces","delegation","routing","memory","gates","failures","authority_profile","external_contact","protected_channel"])if(!(key in c))errors.push(`${id} missing ${key}`);
 if(c.agent.id!==id||c.agent.number!==i)errors.push(`${id} identity mismatch`);
 for(const key of ["class","category","institutional_tier","position","direct_reports","peers","independence","jurisdiction"])if(!(key in c.agent))errors.push(`${id} identity missing ${key}`);
 if(c.production_ref!==`../../sigma-production-charters.json#/agents/${i-1}`)errors.push(`${id} production ref mismatch`);
 if(c.scope.steps.length<8||c.scope.invariants.length<6||c.scope.non_goals.length<5||c.scope.activation.length<5)errors.push(`${id} shallow role definition`);
 if(c.gates.length<6||c.failures.length!==8||c.delegation.specialists.length<4)errors.push(`${id} incomplete controls`);
 if(c.delegation.max_depth>3||c.delegation.child_default_max_children!==0)errors.push(`${id} proliferation control invalid`);
 if(c.memory.commit.length!==1)errors.push(`${id} must have one exclusive commit ledger`);
 for(const [set,value,label] of [[ids,id,"id"],[artifacts,c.agent.artifact,"artifact"],[procedures,c.agent.procedure,"procedure"],[commits,c.memory.commit[0],"commit ledger"]]){if(set.has(value))errors.push(`${id} duplicate ${label} ${value}`);set.add(value);}
 const doc=fs.readFileSync(path.join(root,c.agent.documentation),"utf8");
 for(const token of ["Identidad formal","Mandato y límites","Autoridad real","Modelo y ciclo cognitivo","FMEA","Ejemplo completo","Done, stop, audit"]){if(!doc.includes(token))errors.push(`${id} doc missing ${token}`);}
 if(!doc.includes(`config/sigma/agents/charters/sigma-${n}.system.md`))errors.push(`${id} doc lacks effective charter ref`);
 const example=doc.match(/## 15\. Ejemplo completo\s+([\s\S]*?)\s+## 16\./)?.[1]?.trim();
 if(!example||example.length<300)errors.push(`${id} shallow example`);else if(examples.has(example))errors.push(`${id} duplicate example`);else examples.add(example);
}
if(errors.length){console.error("SIGMA AGENT VALIDATION FAILED");errors.forEach(e=>console.error("- "+e));process.exit(1);}
console.log("SIGMA AGENT VALIDATION PASSED");console.log(JSON.stringify({agents:ids.size,unique_artifacts:artifacts.size,unique_procedures:procedures.size,unique_commit_ledgers:commits.size,unique_examples:examples.size,formal_identity:true}));
