import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..","..");
const catalog=JSON.parse(fs.readFileSync(path.join(root,"config","production-charters.json"),"utf8"));
const schema=JSON.parse(fs.readFileSync(path.join(root,catalog.output_schema),"utf8"));
const errors=[];
const common=["result","claims","evidence_refs","assumptions","uncertainty","confidence","dissent","risks","provenance_refs","next_action","status","escalation","blockers","self_check"];
for(const k of common) if(!schema.required.includes(k)) errors.push("common output missing "+k);
if(Object.keys(schema.$defs).length!==24) errors.push("expected 24 payload definitions");
for(let i=1;i<=24;i++){
  const id="omega_"+String(i).padStart(2,"0"), def=schema.$defs[id], entry=catalog.agents.find(a=>a.id===id);
  if(!def) {errors.push(id+" payload missing");continue;}
  const type=def.properties?.artifact_type?.const;
  if(type!==entry.primary_artifact) errors.push(id+" artifact discriminator mismatch");
  if(def.required.length<5) errors.push(id+" payload under-specified");
}
const refs=schema.properties.payload.oneOf.map(x=>x.$ref);
if(new Set(refs).size!==24) errors.push("payload refs not unique");
if(errors.length){console.error("OUTPUT CONTRACT V2 VALIDATION FAILED");errors.forEach(e=>console.error("- "+e));process.exit(1);}
console.log("OUTPUT CONTRACT V2 VALIDATION PASSED");
console.log(JSON.stringify({common_fields:common.length,role_payloads:24,discriminated:true}));

