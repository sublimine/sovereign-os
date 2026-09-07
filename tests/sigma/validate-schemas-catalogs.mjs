import fs from "node:fs";import path from "node:path";import{fileURLToPath}from"node:url";
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..",".."),dir=path.join(root,"schemas/sigma"),walk=d=>fs.readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(d,e.name)):[path.join(d,e.name)]),files=walk(dir).filter(f=>f.endsWith(".json")),errors=[],ids=new Set();
for(const file of files){let s;try{s=JSON.parse(fs.readFileSync(file,"utf8"));}catch(e){errors.push(`${file} invalid JSON`);continue;}if(s.$schema!=="https://json-schema.org/draft/2020-12/schema")errors.push(`${file} wrong draft`);if(!s.$id||ids.has(s.$id))errors.push(`${file} missing/duplicate id`);ids.add(s.$id);}
if(files.length!==69)errors.push(`schemas ${files.length} !=69`);
const output=JSON.parse(fs.readFileSync(path.join(dir,"sigma-agent-output.schema.json"),"utf8"));if(Object.keys(output.$defs).length!==40||output.properties.result.oneOf.length!==40)errors.push("output not 40-way discriminated");
const artifacts=JSON.parse(fs.readFileSync(path.join(root,"config/sigma/artifact-catalog.json"),"utf8")),events=JSON.parse(fs.readFileSync(path.join(root,"config/sigma/event-catalog.json"),"utf8"));
if(artifacts.artifacts.length!==50||new Set(artifacts.artifacts.map(a=>a.type)).size!==50)errors.push("artifact catalog mismatch");
if(events.events.length!==68||new Set(events.events.map(e=>e.type)).size!==68)errors.push("event catalog mismatch");
for(const required of ["DepartmentExchangePacket","SigmaTelemetryEvent"])if(!artifacts.artifacts.some(a=>a.type===required))errors.push(`missing cross-system artifact ${required}`);
for(const required of ["TELEMETRY_GAP_DETECTED","WARNING_ACK_DEADLINE_MISSED","SPECIALIST_ORPHANED"])if(!events.events.some(e=>e.type===required))errors.push(`missing observability event ${required}`);
for(let i=1;i<=40;i++){const n=String(i).padStart(2,"0"),s=JSON.parse(fs.readFileSync(path.join(dir,"outputs",`sigma-${n}-output.schema.json`),"utf8"));if(!s.required.includes("gate_evidence")||Object.keys(s.properties.gate_evidence.properties).length<6)errors.push(`sigma-${n} output not role typed`);}
if(errors.length){console.error("SIGMA SCHEMA/CATALOG VALIDATION FAILED");errors.forEach(e=>console.error("- "+e));process.exit(1);}
console.log("SIGMA SCHEMA/CATALOG VALIDATION PASSED");console.log(JSON.stringify({schemas:files.length,role_output_schemas:40,output_payloads:40,artifacts:50,events:68}));
