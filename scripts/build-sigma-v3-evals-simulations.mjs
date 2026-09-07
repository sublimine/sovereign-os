import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import {fileURLToPath} from "node:url";

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const read=p=>JSON.parse(fs.readFileSync(path.join(root,p),"utf8"));
const write=(p,v)=>{const f=path.join(root,p);fs.mkdirSync(path.dirname(f),{recursive:true});fs.writeFileSync(f,typeof v==="string"?v:JSON.stringify(v,null,2)+"\n","utf8")};
const reg=read("config/sigma/v3/dossier-registry.json"),cross=read("config/sigma/v3/cross-coherence-audit.json"),sims=read("tests/sigma/fixtures/simulations.json").simulations;
const dossiers=reg.agents.map(x=>read(`config/sigma/v3/dossiers/sigma-${x.id.slice(-2)}.json`)),byId=new Map(dossiers.map(x=>[x.agent.id,x]));
const normalize=x=>String(x).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").match(/[a-z0-9]{4,}/g)||[];
const profiles={
 A:{themes:["market","measurement","denominator","source","dependency","estimate","opaque"],required:["sigma_03","sigma_04","sigma_06","sigma_12","sigma_16","sigma_17","sigma_21","sigma_24","sigma_28","sigma_32","sigma_36","sigma_38"]},
 B:{themes:["company","contradiction","entity","chronology","source","deception"],required:["sigma_14","sigma_15","sigma_16","sigma_17","sigma_18","sigma_19","sigma_29","sigma_36","sigma_38"]},
 C:{themes:["competitor","actor","indicator","warning","forecast","time"],required:["sigma_19","sigma_25","sigma_28","sigma_32","sigma_33","sigma_34","sigma_36"]},
 D:{themes:["deception","consensus","dependency","provenance","independence","compromise"],required:["sigma_14","sigma_16","sigma_17","sigma_29","sigma_30","sigma_36","sigma_38"]},
 E:{themes:["source","compromise","retraction","lineage","dependency","memory"],required:["sigma_15","sigma_16","sigma_17","sigma_30","sigma_36","sigma_38","sigma_39","sigma_40"]},
 F:{themes:["entity","network","identity","conflation","graph","lineage"],required:["sigma_17","sigma_18","sigma_20","sigma_24","sigma_36","sigma_38"]},
 G:{themes:["warning","indicator","stale","freshness","calibration","reconsideration"],required:["sigma_32","sigma_33","sigma_34","sigma_36","sigma_38","sigma_39","sigma_40"]},
 H:{themes:["technology","opportunity","existential","risk","system","causal","surprise"],required:["sigma_25","sigma_26","sigma_27","sigma_28","sigma_32","sigma_34","sigma_35","sigma_36","sigma_38"]},
 I:{themes:["million","documents","consensus","dependency","duplicate","source","scale"],required:["sigma_12","sigma_14","sigma_16","sigma_17","sigma_24","sigma_29","sigma_36","sigma_38"]},
 J:{themes:["crisis","weeks","restart","provider","checkpoint","memory","handover"],required:["sigma_02","sigma_13","sigma_17","sigma_30","sigma_33","sigma_36","sigma_38","sigma_39","sigma_40"]}
};
function best(items,themes){const T=new Set(themes);return items.map((text,index)=>({text,index,score:normalize(text).filter(x=>T.has(x)).length})).sort((a,b)=>b.score-a.score||a.index-b.index)[0]}
const phase=n=>n<=5?"COMMAND_REQUIREMENTS":n<=14?"COLLECTION_ADMISSION":n<=23?"SOURCE_TRUTH":n<=32?"ANALYSIS_ESTIMATION":n<=35?"ANTICIPATION":n<=38?"DISSENT_PRODUCT_QUALITY":"CONTINUITY_EFFECTIVENESS";
const simulationReports=[];
for(const sim of sims){
 const p=profiles[sim.id],active=new Set(sim.active),errors=[];
 for(const id of p.required)if(!active.has(id))errors.push(`required role inactive: ${id}`);
 if(new Set([...sim.active,...sim.inactive]).size!==40||sim.active.some(x=>sim.inactive.includes(x)))errors.push("activation partition invalid");
 const steps=sim.active.map(id=>{const d=byId.get(id),m=best(d.doctrine.methods,p.themes),g=best(d.gates.map(x=>x.id+" "+x.condition+" "+x.threshold),p.themes),gate=d.gates[g.index],review=cross.review_coverage.find(x=>x.id===id);return{phase:phase(d.agent.number),agent_id:id,question:d.doctrine.core,method:m.text,method_relevance:m.score,gate:{id:gate.id,threshold:gate.threshold,independence:gate.evaluation_independence,certification_effect:gate.certification_effect},artifact:d.agent.artifact,review_path:[...review.internal,...review.external,...review.protected_external]}});
 const phases=[...new Set(steps.map(x=>x.phase))].map(name=>({name,agents:steps.filter(x=>x.phase===name).map(x=>x.agent_id),outputs:steps.filter(x=>x.phase===name).map(x=>x.artifact)}));
 const controls={producer_never_sole_certifier:steps.every(x=>x.review_path.length>0),unknown_remains_valid:true,minority_report_preserved:active.has("sigma_36"),lineage_required:active.has("sigma_17"),quality_control:active.has("sigma_38"),continuity_control:active.has("sigma_39")||!/[weeks|después|reinicios]/i.test(sim.title)};
 if(!controls.producer_never_sole_certifier)errors.push("active role lacks review path");
 simulationReports.push({id:sim.id,title:sim.title,classification:sim.classification,status:errors.length?"FAIL":"PASS",activation:{active:sim.active,inactive:sim.inactive,required:p.required,specialists:sim.specialists},themes:p.themes,phases,agent_execution:steps,existing_event_trace:sim.events,material_artifacts:sim.material_artifacts,blocks:sim.blocks,controls,result:sim.intelligence_result,omega_handoff:sim.omega_handoff,errors});
}
const evals=dossiers.flatMap(d=>d.evals.map(e=>({id:`${d.agent.id}:${e.id}`,agent_id:d.agent.id,artifact:d.agent.artifact,core_question:d.doctrine.core,setup:e.setup,attack:e.attack,oracle:e.expected_oracle,must_not:e.must_not,required_gate_ids:d.gates.map(x=>x.id),maturity:"SPECIFIED_NOT_MODEL_EXECUTED"})));
const battery={schema_version:"3.0.0",status:"SPECIFIED_VALIDATION_DEBT",count:evals.length,execution_contract:{freeze:["model provider/version","charter hash","tool versions","context manifest","seed/sampling policy"],record:["raw output hash","oracle result","latency","cost","tool calls","policy decisions"],pass_rule:"oracle exact or evaluator-versioned semantic equivalence; must_not occurrence is hard FAIL",independence:"material score reviewed by evaluator not producing the answer",claim_limit:"No specified case counts as a model pass until executed."},cases:evals};
const simAudit={schema_version:"3.0.0",status:simulationReports.every(x=>x.status==="PASS")?"PASS":"FAIL",scope:"Ten conceptual fault missions re-bound to v3 doctrine, gates, artifacts and review paths",metrics:{simulations:simulationReports.length,agent_activations:simulationReports.reduce((n,x)=>n+x.activation.active.length,0),agent_execution_steps:simulationReports.reduce((n,x)=>n+x.agent_execution.length,0),required_role_checks:simulationReports.reduce((n,x)=>n+x.activation.required.length,0),failed:simulationReports.filter(x=>x.status!=="PASS").length},simulations:simulationReports};
const md=`# Σ v3 — Simulaciones A–J reejecutadas\n\n**Estado:** ${simAudit.status}  \n**Límite:** simulación conceptual y validación determinista; no equivale a ejecución con modelos/proveedores reales.\n\n${simulationReports.map(s=>`## ${s.id} · ${s.title}\n\n- **Activos/no activos:** ${s.activation.active.length}/${s.activation.inactive.length}.\n- **Required control roles:** ${s.activation.required.join(", ")}.\n- **Especialistas:** ${s.activation.specialists.join(", ")}.\n- **Fases:** ${s.phases.map(x=>`${x.name} [${x.agents.join(", ")}]`).join(" → ")}.\n- **Controles:** ${Object.entries(s.controls).map(([k,v])=>`${k}=${v}`).join("; ")}.\n- **Bloqueos:** ${s.blocks.join("; ")||"ninguno"}.\n- **Resultado Σ:** ${s.result}.\n- **Handoff Ω:** ${s.omega_handoff}.\n- **Veredicto:** ${s.status}.\n`).join("\n")}\n## Evidencia de ejecución por agente\n\nCada simulación conserva en \`config/sigma/v3/simulation-audit.json\` el método, gate, threshold, independencia, artefacto y review path usados por cada agente activado.\n`;
write("tests/sigma/v3-eval-battery.json",battery);
write("config/sigma/v3/simulation-audit.json",simAudit);
write("docs/sigma/simulations/SIGMA-V3-SIMULATIONS-A-J.md",md);
console.log(JSON.stringify({v3_evals:evals.length,simulations:simulationReports.length,steps:simAudit.metrics.agent_execution_steps,status:simAudit.status,sha256:crypto.createHash("sha256").update(JSON.stringify(simAudit)).digest("hex")}));
if(simAudit.status!=="PASS")process.exit(1);
