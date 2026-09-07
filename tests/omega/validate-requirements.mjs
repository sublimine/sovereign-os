import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..","..");
const file=fs.readFileSync(path.join(root,"docs","omega","14-OMEGA-REQUIREMENTS-TRACEABILITY.md"),"utf8");
const found=[...file.matchAll(/^\|\s*(\d+)\s*\|/gm)].map(m=>Number(m[1]));
const errors=[];
if(found.length!==80) errors.push("expected 80 requirement rows, got "+found.length);
for(let i=1;i<=80;i++) if(!found.includes(i)) errors.push("missing requirement "+i);
if(new Set(found).size!==80) errors.push("duplicate requirement number");
for(const term of ["Runtime neutrality","OBJECTIVE-","attention"]) if(!file.includes(term)) errors.push("missing additional coverage "+term);
if(errors.length){console.error("REQUIREMENTS VALIDATION FAILED");errors.forEach(e=>console.error("- "+e));process.exit(1);}
console.log("REQUIREMENTS VALIDATION PASSED");
console.log(JSON.stringify({requirements:80,additional:"runtime/provider/event/context"}));

