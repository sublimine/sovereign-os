import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import vm from "node:vm";
import {spawnSync} from "node:child_process";
import {fileURLToPath} from "node:url";

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..",".."),errors=[];
const read=p=>JSON.parse(fs.readFileSync(path.join(root,p),"utf8")),hash=p=>crypto.createHash("sha256").update(fs.readFileSync(path.join(root,p))).digest("hex");
const files=(dir,re)=>fs.readdirSync(path.join(root,dir),{withFileTypes:true}).filter(x=>x.isFile()&&re.test(x.name)).map(x=>x.name);
const release=read("config/sigma/release-certification.json"),audit=read("config/sigma/v3/final-sovereign-audit.json"),cross=read("config/sigma/v3/cross-coherence-audit.json"),matrix=read("config/sigma/v3/relationship-matrix.json"),battery=read("tests/sigma/v3-eval-battery.json");
if(release.status!=="PASS"||release.version!=="3.0.0"||release.maturity!=="S2_V3_DETERMINISTICALLY_AUDITED")errors.push("release is not v3 S2 PASS");
if(release.independent_audit!=="NOT_PERFORMED"||!release.validation_debt.includes("INDEPENDENT_EXTERNAL_AUDIT"))errors.push("independent audit overclaimed");
if(release.validation_debt.some(x=>/DOSSIER_V3_RECONSTRUCTION/.test(x)))errors.push("closed reconstruction remains debt");
if(audit.status!=="PASS"||audit.passes.length!==10||cross.status!=="PASS")errors.push("v3 audits not PASS");
const expected={roles:40,capabilities:57,charters:40,authority_cells:960,relationship_edges:507,schemas:69,gate_sets:40,legacy_fmea_rows:320,legacy_effective_evals:960,simulations:10,simulation_events:177,artifacts:50,events:68,department_interfaces:12,v3_dossiers:40,v3_boundaries:480,v3_matrix_cells:1600,v3_unique_artifacts:40,v3_unique_ledgers:40,v3_fmea_rows:audit.metrics.fmea,v3_evals:battery.count,v3_cases:160,v3_specialist_templates:228,v3_simulation_steps:332,v3_mutation_tests:6,v3_audit_passes:10};
for(const [k,v] of Object.entries(expected))if(release.metrics?.[k]!==v)errors.push(`release metric ${k}: ${release.metrics?.[k]} != ${v}`);
for(const e of release.evidence||[])if(!fs.existsSync(path.join(root,e.file))||hash(e.file)!==e.sha256||e.status!=="PASS")errors.push(`release evidence invalid: ${e.file}`);
if(files("docs/sigma/agents/v3",/^sigma-\d\d-dossier\.md$/).length!==40||files("config/sigma/v3/dossiers",/^sigma-\d\d\.json$/).length!==40||files("config/sigma/v3/charters",/^sigma-\d\d\.system\.md$/).length!==40)errors.push("v3 40-role file symmetry broken");
if(Object.keys(matrix.cells).length!==40||Object.values(matrix.cells).some(x=>Object.keys(x).length!==40))errors.push("relationship matrix not 40x40");
for(let i=1;i<=40;i++){const n=String(i).padStart(2,"0"),d=read(`config/sigma/v3/dossiers/sigma-${n}.json`);if(!d.operational||d.fmea.length<35||d.evals.length<43||d.doctrine.boundaries.length<12)errors.push(`sigma_${n} density/operations incomplete`)}
const visual=fs.readFileSync(path.join(root,"visual/sigma-intelligence-center.html"),"utf8");
for(const token of ["40/40","1.600","Activación","Doctrina","Límites","Runtime","DATA_NOT_INSTRUCTIONS","openAgent"]){if(!visual.includes(token))errors.push(`visual missing ${token}`)}
const inline=visual.match(/<script>([\s\S]*)<\/script>/)?.[1];if(!inline)errors.push("visual app missing");else try{new vm.Script(inline,{filename:"sigma-v3-command-center.js"})}catch(e){errors.push(`visual JavaScript invalid: ${e.message}`)}
const debt=spawnSync(process.execPath,[path.join(root,"tests/sigma/run-model-evals.mjs")],{encoding:"utf8"});if(debt.status!==2||!debt.stdout.includes("VALIDATION_DEBT"))errors.push("model validation debt can falsely pass");
for(const dir of ["docs/sigma/agents/v3","config/sigma/v3/charters"]){for(const f of files(dir,/\.(md|json)$/)){const text=fs.readFileSync(path.join(root,dir,f),"utf8");if(/\b(?:TODO|TBD|FIXME)\b/.test(text)||/lorem ipsum/i.test(text))errors.push(`placeholder ${dir}/${f}`)}}
if(errors.length){console.error("SIGMA V3 FINAL INTEGRITY FAILED");errors.forEach(x=>console.error(`- ${x}`));process.exit(1)}
console.log("SIGMA V3 FINAL INTEGRITY PASSED");console.log(JSON.stringify({release:release.release_id,maturity:release.maturity,metrics:release.metrics,independent_audit_overclaim:false,model_validation_debt_enforced:true}));
