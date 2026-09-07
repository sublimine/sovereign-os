import fs from "node:fs";
import path from "node:path";
import {spawnSync} from "node:child_process";
import {fileURLToPath} from "node:url";

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..","..");
const run=spawnSync(process.execPath,[path.join(root,"scripts/audit-sigma-v3-cross-coherence.mjs")],{encoding:"utf8"});
if(run.stdout)process.stdout.write(run.stdout);
if(run.stderr)process.stderr.write(run.stderr);
if(run.status!==0)process.exit(run.status??1);
const audit=JSON.parse(fs.readFileSync(path.join(root,"config/sigma/v3/cross-coherence-audit.json"),"utf8"));
const matrix=JSON.parse(fs.readFileSync(path.join(root,"config/sigma/v3/relationship-matrix.json"),"utf8"));
const errors=[];
if(audit.status!=="PASS"||audit.metrics.agents!==40||audit.metrics.matrix_cells!==1600)errors.push("audit status/coverage invalid");
if(audit.metrics.unique_artifacts!==40||audit.metrics.unique_commit_ledgers!==40)errors.push("ownership is not exclusive");
if(Object.keys(matrix.cells).length!==40||Object.values(matrix.cells).some(row=>Object.keys(row).length!==40))errors.push("matrix not 40x40");
if(audit.errors.length)errors.push(...audit.errors);
if(errors.length){console.error("SIGMA V3 CROSS ARTIFACTS FAILED");errors.forEach(x=>console.error(`- ${x}`));process.exit(1)}
console.log("SIGMA V3 CROSS ARTIFACTS PASSED");
