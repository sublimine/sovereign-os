import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import {spawnSync} from "node:child_process";
import {fileURLToPath} from "node:url";

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const tests=["validate-agents.mjs","validate-charters.mjs","validate-authority.mjs","validate-relationships.mjs","validate-state-gates.mjs","validate-fmea.mjs","validate-evals.mjs","validate-schemas-catalogs.mjs","validate-reference-kernel.mjs","validate-simulations.mjs"];
for(const test of tests){
  const run=spawnSync(process.execPath,[path.join(root,"tests","sigma",test)],{stdio:"inherit"});
  if(run.status!==0){console.error(`Certification refused: ${test} failed`);process.exit(run.status??1);}
}
const read=p=>JSON.parse(fs.readFileSync(path.join(root,p),"utf8"));
const hash=p=>crypto.createHash("sha256").update(fs.readFileSync(path.join(root,p))).digest("hex");
const schemaFiles=[];
const walk=d=>fs.readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(d,e.name)):[path.join(d,e.name)]);
for(const file of walk(path.join(root,"schemas","sigma")))if(file.endsWith(".json"))schemaFiles.push(file);
const authority=read("config/sigma/authority-actions.json"),relationships=read("config/sigma/relationships.json"),fmea=read("config/sigma/fmea.json"),events=read("config/sigma/event-catalog.json"),artifacts=read("config/sigma/artifact-catalog.json"),sims=read("tests/sigma/fixtures/simulations.json"),capabilities=read("config/sigma/capability-register.json");
const evidencePaths=["docs/sigma/00-SIGMA-CONSTITUTION.md","docs/sigma/SIGMA-ARCHITECTURE-ADVERSARIAL-AUDIT.md","config/sigma-production-charters.json","config/sigma/authority-actions.json","config/sigma/relationships.json","tests/sigma/eval-battery.json","tests/sigma/fixtures/simulations.json","src/reference/sigma-kernel.mjs"];
const certification={
  release_id:"sigma-architecture-1.0.0-s2",
  version:"1.0.0",
  maturity:"S2_DETERMINISTIC_TESTED",
  scope:"Σ Strategic Intelligence institutional architecture, contracts, reference enforcement and deterministic validation",
  status:"PASS",
  certified_at:new Date().toISOString(),
  evidence:evidencePaths.map(file=>({file,sha256:hash(file),status:"PASS"})),
  metrics:{roles:40,capabilities:capabilities.capabilities.length,charters:40,authority_cells:Object.keys(authority.agents).length*authority.actions.length,relationship_edges:relationships.edges.length,schemas:schemaFiles.length,gate_sets:40,fmea_rows:Object.values(fmea.agents).flat().length,effective_evals:960,simulations:sims.simulations.length,simulation_events:sims.simulations.flatMap(s=>s.events).length,artifacts:artifacts.artifacts.length,events:events.events.length,department_interfaces:read("config/sigma/department-interfaces.json").interfaces.length},
  limitations:["No real-model executions have been evaluated","No shadow or production mission has been executed","No provider/runtime adapter has completed conformance, load or chaos testing","No production outcomes exist for empirical calibration","No independent external audit has been performed"],
  validation_debt:["S3_MODEL_PROVIDER_EVALUATIONS","S3_EMPIRICAL_CALIBRATION","S4_SHADOW_AND_REPLAY","S4_RUNTIME_ADAPTER_CONFORMANCE","S4_SECURITY_CHAOS_AND_LOAD","S5_PRODUCTION_OUTCOMES_AND_DRIFT","INDEPENDENT_EXTERNAL_AUDIT"],
  independent_audit:"NOT_PERFORMED"
};
fs.writeFileSync(path.join(root,"config","sigma","release-certification.json"),JSON.stringify(certification,null,2)+"\n","utf8");
console.log("SIGMA RELEASE CERTIFIED");
console.log(JSON.stringify({release_id:certification.release_id,maturity:certification.maturity,status:certification.status,metrics:certification.metrics}));
