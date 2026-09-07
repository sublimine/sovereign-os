import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..",".."),read=p=>JSON.parse(fs.readFileSync(path.join(root,p),"utf8")),errors=[];
const battery=read("tests/sigma/v3-eval-battery.json"),sim=read("config/sigma/v3/simulation-audit.json");
if(battery.count<800||battery.cases.length!==battery.count)errors.push("v3 eval coverage below 800");
if(new Set(battery.cases.map(x=>x.id)).size!==battery.count)errors.push("v3 eval IDs not unique");
if(battery.cases.some(x=>!x.oracle||!x.must_not||!x.required_gate_ids.length||x.maturity!=="SPECIFIED_NOT_MODEL_EXECUTED"))errors.push("v3 eval contract incomplete/overclaimed");
for(const failure of ["hallucination","prompt_injection","false_consensus","context_overflow","tool_failure","model_failure"]){if(!battery.cases.some(x=>(x.attack+" "+x.id).toLowerCase().includes(failure)))errors.push(`missing eval family ${failure}`)}
if(sim.status!=="PASS"||sim.metrics.simulations!==10||sim.metrics.failed!==0)errors.push("simulation audit failed/incomplete");
for(const s of sim.simulations){if(!s.agent_execution.length||!s.phases.length||s.errors.length)errors.push(`simulation ${s.id} incomplete`);if(!s.controls.producer_never_sole_certifier)errors.push(`simulation ${s.id} self certification`);if(s.agent_execution.some(x=>!x.method||!x.gate.threshold||!x.review_path.length))errors.push(`simulation ${s.id} lacks executable trace`)}
if(errors.length){console.error("SIGMA V3 EVAL/SIMULATION FAILED");errors.forEach(x=>console.error(`- ${x}`));process.exit(1)}
console.log("SIGMA V3 EVAL/SIMULATION PASSED");console.log(JSON.stringify({evals:battery.count,simulations:sim.metrics.simulations,steps:sim.metrics.agent_execution_steps}));
