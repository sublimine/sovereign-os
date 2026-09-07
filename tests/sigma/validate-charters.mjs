import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import {fileURLToPath} from "node:url";
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..","..");
const catalog=JSON.parse(fs.readFileSync(path.join(root,"config/sigma-production-charters.json"),"utf8"));
const hash=text=>crypto.createHash("sha256").update(text).digest("hex"),errors=[];
const kernel=fs.readFileSync(path.join(root,catalog.kernel.path),"utf8");
if(hash(kernel)!==catalog.kernel.sha256)errors.push("kernel hash mismatch");
for(const entry of catalog.agents){
 const text=fs.readFileSync(path.join(root,entry.path),"utf8");
 if(hash(text)!==entry.sha256)errors.push(`${entry.id} hash mismatch`);
 for(let section=1;section<=16;section++)if(!text.includes(`## ${section}.`))errors.push(`${entry.id} missing section ${section}`);
 for(const token of ["must","never","require","only","BLOCKED","UNKNOWN","BUDGET_EXHAUSTED","Self-check is not independent verification"]){if(!text.toLowerCase().includes(token.toLowerCase()))errors.push(`${entry.id} lacks normative token ${token}`);}
 if(/\b(?:TODO|TBD|FIXME|lorem ipsum)\b/i.test(text))errors.push(`${entry.id} placeholder`);
 if(text.split(/\r?\n/).length<105)errors.push(`${entry.id} charter too shallow`);
}
if(errors.length){console.error("SIGMA CHARTER VALIDATION FAILED");errors.forEach(e=>console.error("- "+e));process.exit(1);}
console.log("SIGMA CHARTER VALIDATION PASSED");console.log(JSON.stringify({charters:catalog.agents.length,sections:16,hashes:true,kernel_hash:true}));

