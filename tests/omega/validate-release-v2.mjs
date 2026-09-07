import fs from "node:fs";
import path from "node:path";
import {spawnSync} from "node:child_process";
import {fileURLToPath} from "node:url";
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..","..");
const release=JSON.parse(fs.readFileSync(path.join(root,"config","release-certification-v2.json"),"utf8"));
const pkg=JSON.parse(fs.readFileSync(path.join(root,"package.json"),"utf8"));
const audit=fs.readFileSync(path.join(root,"docs","omega","OMEGA-ARCHITECTURE-ADVERSARIAL-AUDIT.md"),"utf8");
const errors=[];
if(pkg.version!=="2.0.0"||release.version!=="2.0.0") errors.push("release version mismatch");
if(release.maturity!=="D2_DETERMINISTIC_TESTED") errors.push("release over/under claims maturity");
if(release.certification.scope_result!=="PASS") errors.push("D2 certification not pass");
if(release.independent_audit.status!=="NOT_PERFORMED") errors.push("independent audit falsely claimed");
for(const debt of ["D3_MULTI_MODEL_EXECUTION","D4_SHADOW_MISSIONS","D5_PRODUCTION_OUTCOMES","EXTERNAL_OMEGA3_AUDIT"])
  if(!release.validation_debt.includes(debt)) errors.push("missing validation debt "+debt);
for(const v of Object.values(release.agent_coverage)) if(typeof v!=="number"||v<24) errors.push("invalid agent coverage metric");
for(let i=1;i<=24;i++){
  const n=String(i).padStart(2,"0"), doc=fs.readFileSync(path.join(root,"docs","omega","agents","omega-"+n+".md"),"utf8");
  if(!doc.includes("config/agents/charters/omega-"+n+".system.md")) errors.push("omega-"+n+" missing v2 cross-reference");
  if(!doc.includes("**Especificación conceptual:** OMEGA-"+n+" v2.0.0")) errors.push("omega-"+n+" conceptual specification is not v2");
}
if(!audit.includes("OAA-2026-002")||!audit.includes("PASS_FOR_D2_ONLY")) errors.push("current adversarial audit missing");
const debtRun=spawnSync(process.execPath,[path.join(root,"tests","omega","run-model-evals.mjs")],{encoding:"utf8"});
if(debtRun.status!==2||!debtRun.stdout.includes("VALIDATION_DEBT")) errors.push("model eval debt is not enforced");
if(errors.length){console.error("RELEASE V2 VALIDATION FAILED");errors.forEach(e=>console.error("- "+e));process.exit(1);}
console.log("RELEASE V2 VALIDATION PASSED");
console.log(JSON.stringify({version:"2.0.0",maturity:release.maturity,debt_items:release.validation_debt.length,independent_audit:false}));
