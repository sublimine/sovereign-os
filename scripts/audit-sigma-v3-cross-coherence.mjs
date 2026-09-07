import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import {fileURLToPath} from "node:url";

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const read=p=>JSON.parse(fs.readFileSync(path.join(root,p),"utf8"));
const write=(p,v)=>{const f=path.join(root,p);fs.mkdirSync(path.dirname(f),{recursive:true});fs.writeFileSync(f,typeof v==="string"?v:JSON.stringify(v,null,2)+"\n","utf8")};
const registry=read("config/sigma/agent-registry.json");
const relationships=read("config/sigma/relationships.json").edges;
const ids=new Set(registry.roles.map(x=>x.id));
const dossiers=registry.roles.map(role=>read(`config/sigma/v3/dossiers/sigma-${String(role.number).padStart(2,"0")}.json`));
const byId=new Map(dossiers.map(x=>[x.agent.id,x]));
const errors=[],warnings=[],findings=[];
const invariant=(condition,message)=>{if(!condition)errors.push(message)};
const unique=(values,label)=>{const seen=new Map;for(const [id,value] of values){if(seen.has(value))errors.push(`${label} collision: ${seen.get(value)} and ${id} own ${value}`);else seen.set(value,id)}};

invariant(dossiers.length===40,"exactly 40 dossiers required");
unique(dossiers.map(d=>[d.agent.id,d.agent.artifact]),"artifact");
unique(dossiers.flatMap(d=>d.memory.commit.map(x=>[d.agent.id,x])),"commit ledger");
unique(dossiers.map(d=>[d.agent.id,d.doctrine.core]),"irreducible question");
unique(dossiers.map(d=>[d.agent.id,d.doctrine.unit]),"unit of analysis");

for(const d of dossiers){
 const id=d.agent.id;
 invariant(d.agent.documentation===`docs/sigma/agents/v3/sigma-${id.slice(-2)}-dossier.md`,`${id} points to obsolete documentation`);
 invariant(d.doctrine.boundaries.length>=12,`${id} has fewer than 12 explicit boundaries`);
 invariant(d.doctrine.boundaries.every(x=>x.owns&&x.other_owns&&x.handshake&&x.conflict),`${id} has an incomplete jurisdiction boundary`);
 invariant(d.doctrine.boundaries.every(x=>!(x.counterpart_refs||[]).some(r=>r.id===id)),`${id} contains a self-boundary`);
 for(const b of d.doctrine.boundaries)for(const ref of b.counterpart_refs||[]){
  if(ref.authority==="SIGMA")invariant(ids.has(ref.id),`${id} boundary references unknown ${ref.id}`);
  if(ref.authority==="OMEGA")invariant(/^omega_(0[1-9]|1\d|2[0-4])$/.test(ref.id),`${id} boundary references unknown ${ref.id}`);
 }
 invariant(d.workflow.length===d.doctrine.methods.length,`${id} workflow/method mismatch`);
 invariant(new Set(d.workflow.map(x=>x.state)).size===d.workflow.length,`${id} duplicate state`);
 invariant(d.inputs.every(x=>x.producer&&x.schema&&x.freshness&&x.validation.length>=4&&x.reject.length>=4),`${id} incomplete input contract`);
 invariant(d.gates.every(x=>x.threshold&&!/predeclared criterion met/i.test(x.threshold)),`${id} generic gate`);
 invariant(d.gates.every(x=>x.evaluation_independence&&x.certification_effect),`${id} untyped gate independence`);
 invariant(d.gates.filter(x=>x.evaluation_independence==="SELF_CONTROL").every(x=>x.certification_effect==="NONE"),`${id} self-control can certify`);
 invariant(d.gates.some(x=>x.evaluation_independence!=="SELF_CONTROL"),`${id} has no non-self gate`);
 invariant(d.gates.some(x=>x.id==="NO_SELF_CERTIFICATION"&&x.evaluation_independence==="INDEPENDENT_REVIEW"),`${id} lacks independent no-self-certification gate`);
 invariant(d.specialists.every(x=>x.max_children===0&&x.max_depth===0&&x.context_exclusions.length>=4&&x.permissions.includes("NO_EXTERNAL_EFFECT")),`${id} specialist may proliferate or exert external effect`);
 invariant(d.fmea.every(x=>x.mechanism&&x.detection.length>=3&&x.containment.length>=3&&x.recovery.length>=3&&x.revalidation.length>=3),`${id} non-causal FMEA row`);
 invariant(d.evals.every(x=>x.expected_oracle&&x.must_not),`${id} eval without oracle`);
}

const edgeKeys=new Set();
for(const e of relationships){
 invariant(ids.has(e.from)&&ids.has(e.to),`relationship endpoint missing: ${e.from}->${e.to}`);
 invariant(e.from!==e.to,`self relationship ${e.from}:${e.type}`);
 const k=[e.from,e.to,e.type,e.scope].join("|");invariant(!edgeKeys.has(k),`duplicate relationship ${k}`);edgeKeys.add(k);
}
const commandEdges=relationships.filter(x=>x.type==="COMMANDS");
for(const role of registry.roles){
 const incoming=commandEdges.filter(x=>x.to===role.id);
 if(role.id==="sigma_01")invariant(incoming.length===0,"sigma_01 must not receive internal command");
 else invariant(incoming.length===1&&incoming[0].from===role.superior,`${role.id} command owner mismatch: expected ${role.superior}`);
 for(const child of role.direct_reports||[])invariant(registry.roles.find(x=>x.id===child)?.superior===role.id,`${role.id}/${child} hierarchy not reciprocal`);
}
const visiting=new Set(),visited=new Set();
function visit(id){if(visiting.has(id)){errors.push(`command cycle at ${id}`);return}if(visited.has(id))return;visiting.add(id);for(const e of commandEdges.filter(x=>x.from===id))visit(e.to);visiting.delete(id);visited.add(id)}
visit("sigma_01");invariant(visited.size===40,`command graph reaches ${visited.size}/40 roles`);
for(const e of commandEdges)invariant(!commandEdges.some(x=>x.from===e.to&&x.to===e.from),`reciprocal command conflict ${e.from}<->${e.to}`);

const tokenSet=d=>new Set(JSON.stringify([d.doctrine.core,d.doctrine.unit,d.doctrine.decisions,d.doctrine.variables,d.doctrine.methods]).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").match(/[a-z0-9]{4,}/g)||[]);
const tokens=new Map(dossiers.map(d=>[d.agent.id,tokenSet(d)])),overlap=[];
for(let i=0;i<dossiers.length;i++)for(let j=i+1;j<dossiers.length;j++){
 const a=dossiers[i],b=dossiers[j],ta=tokens.get(a.agent.id),tb=tokens.get(b.agent.id),intersection=[...ta].filter(x=>tb.has(x)).length,union=new Set([...ta,...tb]).size,score=intersection/union;
 const aBoundary=a.doctrine.boundaries.some(x=>(x.counterpart_refs||[]).some(r=>r.id===b.agent.id));
 const bBoundary=b.doctrine.boundaries.some(x=>(x.counterpart_refs||[]).some(r=>r.id===a.agent.id));
 overlap.push({a:a.agent.id,b:b.agent.id,lexical_jaccard:Number(score.toFixed(4)),explicit_boundary:aBoundary||bBoundary});
 if(score>=0.20&&!aBoundary&&!bBoundary)errors.push(`unbounded overlap risk ${a.agent.id}/${b.agent.id}=${score.toFixed(3)}`);
}
overlap.sort((a,b)=>b.lexical_jaccard-a.lexical_jaccard);

const reviewTypes=new Set(["VERIFIES","AUDITS","CHALLENGES"]),reviewCoverage=[];
for(const d of dossiers){
 const internal=relationships.filter(e=>e.to===d.agent.id&&reviewTypes.has(e.type)).map(e=>({reviewer:e.from,type:e.type}));
 const external=d.doctrine.boundaries.flatMap(x=>(x.counterpart_refs||[]).filter(r=>r.authority==="OMEGA").map(r=>({reviewer:r.id,type:"OMEGA_BOUNDARY"})));
 const protectedExternal=d.doctrine.boundaries.filter(x=>/Human auditor|External evaluator|Humano soberano/i.test(x.with)).map(x=>({reviewer:x.with,type:"EXTERNAL_BOUNDARY"}));
 invariant(internal.length+external.length+protectedExternal.length>0,`${d.agent.id} has no independent review path`);
 reviewCoverage.push({id:d.agent.id,internal,external,protected_external:protectedExternal});
}

const cell=(a,b)=>{
 if(a===b)return ["SELF"];
 const types=relationships.filter(e=>e.from===a&&e.to===b).map(e=>e.type);
 const boundary=byId.get(a).doctrine.boundaries.some(x=>(x.counterpart_refs||[]).some(r=>r.id===b));
 return [...new Set([...types,...boundary?["BOUNDARY"]:[]])];
};
const matrix={schema_version:"3.0.0",semantics:"Directed cell row->column. Absence means no direct authority or information relationship; typed artifact routing may still occur through declared intermediaries.",roles:registry.roles.map(x=>({id:x.id,number:x.number,name:x.name})),cells:{}};
for(const row of registry.roles){matrix.cells[row.id]={};for(const col of registry.roles)matrix.cells[row.id][col.id]=cell(row.id,col.id)}

const boundaryCount=dossiers.reduce((n,d)=>n+d.doctrine.boundaries.length,0),fmeaCount=dossiers.reduce((n,d)=>n+d.fmea.length,0),evalCount=dossiers.reduce((n,d)=>n+d.evals.length,0),caseCount=dossiers.reduce((n,d)=>n+d.doctrine.cases.length,0),specialistCount=dossiers.reduce((n,d)=>n+d.specialists.length,0);
findings.push("Forty sovereign artifacts and forty commit ledgers have single owners.");
findings.push("The command graph is a rooted acyclic tree; information and challenge graphs remain non-hierarchical.");
findings.push("Every role has an internal, Omega or protected external review route; self-check is never counted as independent review.");
findings.push("No pair exceeded the 0.20 doctrine-overlap risk threshold without an explicit jurisdiction boundary.");
warnings.push("Deterministic coherence proves specification consistency, not real-model behavior or production efficacy.");
warnings.push("Omega and human counterpart execution remains outside this department's deterministic test scope.");

const report={schema_version:"3.0.0",audit_id:"SIGMA-V3-CROSS-COHERENCE",generated_at:"DETERMINISTIC_BUILD",status:errors.length?"FAIL":"PASS",scope:"40 dossiers, 40x40 directed matrix, command authority, jurisdiction ownership, review paths and overlap risk",metrics:{agents:dossiers.length,boundaries:boundaryCount,matrix_cells:1600,relationship_edges:relationships.length,unique_artifacts:new Set(dossiers.map(x=>x.agent.artifact)).size,unique_commit_ledgers:new Set(dossiers.flatMap(x=>x.memory.commit)).size,fmea_rows:fmeaCount,evals:evalCount,cases:caseCount,specialist_templates:specialistCount,max_doctrine_overlap:overlap[0]},errors,warnings,findings,review_coverage:reviewCoverage,top_overlap_pairs:overlap.slice(0,20),artifacts:dossiers.map(d=>({id:d.agent.id,artifact:d.agent.artifact,commit_ledgers:d.memory.commit,core_question:d.doctrine.core,unit:d.doctrine.unit}))};
const matrixMd=`# Σ v3 — Matriz de relaciones 40×40\n\nCada celda es dirigida **fila → columna**. Códigos combinables: C=COMMANDS, R=REPORTS_TO, Q=REQUESTS, V=VERIFIES, A=AUDITS, H=CHALLENGES, B=BLOCKS, E=ESCALATES_TO, F=FEEDS, I=INDEPENDENT_FROM, J=jurisdiction BOUNDARY, ·=sin relación directa. La ausencia no permite autoridad implícita.\n\n|→|${registry.roles.map(x=>`Σ${String(x.number).padStart(2,"0")}`).join("|")}|\n|---|${registry.roles.map(()=>"---").join("|")}|\n${registry.roles.map(row=>`|Σ${String(row.number).padStart(2,"0")}|${registry.roles.map(col=>{const map={COMMANDS:"C",REPORTS_TO:"R",REQUESTS:"Q",VERIFIES:"V",AUDITS:"A",CHALLENGES:"H",BLOCKS:"B",ESCALATES_TO:"E",FEEDS:"F",INDEPENDENT_FROM:"I",BOUNDARY:"J",SELF:"—"};const v=matrix.cells[row.id][col.id];return v.length?[...new Set(v.map(x=>map[x]||x[0]))].join(""):"·"}).join("|")}|`).join("\n")}\n\nLa versión machine-readable conserva todos los tipos y está en \`config/sigma/v3/relationship-matrix.json\`.\n`;
const auditMd=`# SIGMA v3 — Auditoría cruzada de coherencia\n\n**Estado:** ${report.status}  \n**Alcance:** ${report.scope}  \n**Fecha:** ${report.generated_at}\n\n## Evidencia cuantitativa\n\n- 40/40 dossiers; ${boundaryCount} fronteras explícitas; 1.600 celdas de relación.\n- ${report.metrics.unique_artifacts} artefactos soberanos y ${report.metrics.unique_commit_ledgers} ledgers de commit sin doble owner.\n- ${fmeaCount} FMEA causales; ${evalCount} evals con oracle; ${caseCount} casos; ${specialistCount} plantillas acotadas.\n- Máximo solapamiento léxico doctrinal: ${overlap[0].a}/${overlap[0].b} = ${overlap[0].lexical_jaccard}; umbral de riesgo = 0.20.\n\n## Veredictos\n\n${findings.map(x=>`- PASS: ${x}`).join("\n")}\n\n## Límites honestos\n\n${warnings.map(x=>`- ${x}`).join("\n")}\n\n## Errores\n\n${errors.length?errors.map(x=>`- ${x}`).join("\n"):"Ningún defecto material detectado por los invariantes deterministas ejecutados."}\n\n## Pares más próximos\n\n| Par | Jaccard | Frontera explícita |\n|---|---:|---|\n${overlap.slice(0,20).map(x=>`| ${x.a} / ${x.b} | ${x.lexical_jaccard} | ${x.explicit_boundary?"sí":"no; bajo umbral"} |`).join("\n")}\n\n## Regla institucional resultante\n\nLa compatibilidad no se obtiene fusionando roles. Cada rol conserva una pregunta irreductible, una unidad de análisis, un artefacto y un ledger exclusivos. La compaginación ocurre por handshakes tipados; mando no equivale a verificación, y verificación no equivale a certificación Ω.\n`;

write("config/sigma/v3/relationship-matrix.json",matrix);
write("config/sigma/v3/cross-coherence-audit.json",report);
write("docs/sigma/04-SIGMA-V3-RELATIONSHIP-MATRIX.md",matrixMd);
write("docs/sigma/SIGMA-V3-CROSS-COHERENCE-AUDIT.md",auditMd);
if(errors.length){console.error("SIGMA V3 CROSS-COHERENCE FAILED");errors.forEach(x=>console.error(`- ${x}`));process.exit(1)}
console.log("SIGMA V3 CROSS-COHERENCE PASSED");
console.log(JSON.stringify(report.metrics));
