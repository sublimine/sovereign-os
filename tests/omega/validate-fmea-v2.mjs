import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {buildEffectiveFmea} from "../../src/reference/effective-fmea.mjs";
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..","..");
const config=JSON.parse(fs.readFileSync(path.join(root,"config","fmea-v2.json"),"utf8"));
const battery=JSON.parse(fs.readFileSync(path.join(root,"tests","omega","eval-battery-v2.json"),"utf8"));
const errors=[];let total=0;
for(let i=1;i<=24;i++){
  const id="omega_"+String(i).padStart(2,"0"); let rows;
  try{rows=buildEffectiveFmea(config,battery,id);}catch(e){errors.push(id+" "+e.message);continue;}
  if(rows.length!==8) errors.push(id+" effective FMEA count not 8");
  for(const r of rows){
    total++;
    for(const k of ["detection","containment","recovery","revalidation","escalation"]) if(!Array.isArray(r[k])||!r[k].length) errors.push(r.id+" missing "+k);
  }
}
if(Object.keys(config.profiles).length<8) errors.push("insufficient response profiles");
if(total!==192) errors.push("expected 192 role-specific effective FMEA rows");
if(errors.length){console.error("FMEA V2 VALIDATION FAILED");errors.forEach(e=>console.error("- "+e));process.exit(1);}
console.log("FMEA V2 VALIDATION PASSED");
console.log(JSON.stringify({agents:24,role_specific_rows:192,response_profiles:Object.keys(config.profiles).length,dc_rre_complete:true}));

