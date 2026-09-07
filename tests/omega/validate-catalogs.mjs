import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..","..");
const errors=[];
const artifacts=JSON.parse(fs.readFileSync(path.join(root,"config","artifact-catalog.json"),"utf8"));
const events=JSON.parse(fs.readFileSync(path.join(root,"config","event-catalog.json"),"utf8"));
const types=new Set();
for(const a of artifacts.artifacts){
  if(types.has(a.type)) errors.push("duplicate artifact "+a.type); types.add(a.type);
  if(!fs.existsSync(path.join(root,a.schema))) errors.push("missing artifact schema "+a.schema);
  for(const role of [a.owner,a.verifier]){
    if(role!=="runtime" && !/^omega_(0[1-9]|1[0-9]|2[0-4])$/.test(role)) errors.push("invalid role "+role);
  }
  if(a.owner===a.verifier) errors.push("self verifier "+a.type);
}
if(artifacts.artifacts.length<24) errors.push("artifact catalog too small");
const eventSet=new Set(events.events);
if(eventSet.size!==events.events.length) errors.push("duplicate events");
for(const e of ["MISSION_CREATED","CLAIM_RETRACTED","VERIFICATION_FAILED","GATE_FAILED","DOSSIER_READY","DECISION_ISSUED","ROLLBACK_TRIGGERED"]){
  if(!eventSet.has(e)) errors.push("missing critical event "+e);
}
if(errors.length){console.error("CATALOG VALIDATION FAILED");errors.forEach(e=>console.error("- "+e));process.exit(1);}
console.log("CATALOG VALIDATION PASSED");
console.log(JSON.stringify({artifacts:artifacts.artifacts.length,events:events.events.length}));

