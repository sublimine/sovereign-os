import fs from "node:fs";import path from "node:path";import{fileURLToPath}from"node:url";
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..",".."),e=JSON.parse(fs.readFileSync(path.join(root,"tests/sigma/eval-battery.json"),"utf8")),errors=[],ids=new Set(),artifacts=new Set();let effective=0;
if(e.common.length!==16)errors.push("common !=16");
for(let i=1;i<=40;i++){const id=`sigma_${String(i).padStart(2,"0")}`,cases=e.agents[id];if(cases?.length!==8){errors.push(`${id} specific !=8`);continue;}effective+=e.common.length+cases.length;for(const c of cases){if(ids.has(c.id))errors.push(`duplicate ${c.id}`);ids.add(c.id);artifacts.add(c.required_artifact);if(!c.stimulus||!c.expected_code||!c.must_not||c.required_behavior.length!==5)errors.push(`${c.id} incomplete oracle`);}}
if(effective!==960)errors.push(`effective ${effective} !=960`);if(artifacts.size!==40)errors.push(`role artifacts ${artifacts.size} !=40`);
if(errors.length){console.error("SIGMA EVAL VALIDATION FAILED");errors.forEach(e=>console.error("- "+e));process.exit(1);}
console.log("SIGMA EVAL VALIDATION PASSED");console.log(JSON.stringify({agents:40,common_per_agent:16,specific_per_agent:8,effective_cases:effective,role_artifacts:artifacts.size}));

