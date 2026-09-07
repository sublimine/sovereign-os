import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = rel => JSON.parse(fs.readFileSync(path.join(root, rel), "utf8"));
const pad = value => String(value).padStart(2, "0");
const positionSubtitles = {
  adversarial_test_authority: "Autoridad de Pruebas Adversariales",
  alternative_generation_authority: "Autoridad de Generación de Alternativas",
  assumption_prosecution_authority: "Autoridad de Examen de Supuestos",
  atomic_fact_verification_authority: "Autoridad de Verificación de Hechos Atómicos",
  capacity_allocation_authority: "Autoridad de Asignación de Capacidades",
  catastrophic_risk_authority: "Autoridad de Riesgo Catastrófico",
  causal_synthesis_authority: "Autoridad de Síntesis Causal",
  controlled_institutional_evolution: "Evolución Institucional Controlada",
  decision_synthesis_authority: "Autoridad de Síntesis de Decisiones",
  epistemic_policy_authority: "Autoridad de Política Epistémica",
  evidence_independence_authority: "Autoridad de Independencia de la Evidencia",
  final_decision_authority: "Autoridad de Decisión Final",
  final_excellence_certification: "Certificación Final de Excelencia",
  governance_authorization_authority: "Autoridad de Autorización de Gobierno",
  independent_audit_authority: "Autoridad de Auditoría Independiente",
  independent_replication_authority: "Autoridad de Replicación Independiente",
  intelligence_requirements_authority: "Autoridad de Requisitos de Inteligencia",
  mission_command_orchestrator: "Coordinación del Mando de Misiones",
  mission_graph_architect: "Arquitectura del Grafo de Misiones",
  provenance_control_authority: "Autoridad de Control de Procedencia",
  simulation_authority: "Autoridad de Simulación",
  source_acquisition_architect: "Arquitectura de Adquisición de Fuentes",
  strategy_design_authority: "Autoridad de Diseño Estratégico",
  systemic_impact_authority: "Autoridad de Impacto Sistémico",
  DEPARTMENT_HEAD: "Dirección de Departamento",
  SOVEREIGN_FUNCTIONAL_AUTHORITY: "Autoridad Funcional Soberana"
};
const positionSubtitle = role => positionSubtitles[role] || role;

const omegaRegistry = read("config/agent-registry.json");
const omega = omegaRegistry.agents.map(entry => {
  const number = Number(entry.id.slice(-2));
  const source = read(`config/agents/omega-${pad(number)}.json`);
  const agent = source.agent;
  return {
    id: agent.id,
    system: "OMEGA",
    number,
    name: agent.name,
    shortName: agent.short_name,
    group: agent.category,
    role: agent.class,
    roleSubtitle: positionSubtitle(agent.class),
    superior: entry.superior,
    peers: entry.peers,
    independence: entry.independence,
    jurisdiction: agent.jurisdiction,
    summary: source.mission.primary,
    artifact: source.authority.memory_commit?.join(", ") || "Decision record",
    documentation: `../docs/omega/agents/omega-${pad(number)}.md`,
    console: "omega-command-center.html"
  };
});

const sigmaRegistry = read("config/sigma/v3/dossier-registry.json");
const sigma = sigmaRegistry.agents.map(entry => {
  const number = Number(entry.id.slice(-2));
  const source = read(`config/sigma/v3/dossiers/sigma-${pad(number)}.json`);
  const agent = source.agent;
  return {
    id: agent.id,
    system: "SIGMA",
    number,
    name: agent.name,
    shortName: agent.short_name,
    group: agent.division,
    role: agent.position,
    roleSubtitle: positionSubtitle(agent.position),
    superior: agent.superior || "omega_02",
    peers: agent.peers,
    independence: agent.independence,
    jurisdiction: agent.jurisdiction,
    summary: source.doctrine.core,
    artifact: agent.artifact,
    documentation: `../docs/sigma/agents/v3/sigma-${pad(number)}-dossier.md`,
    console: `sigma-intelligence-center.html#${agent.id}`
  };
});

const piRegistry = read("config/pi/v3/dossier-registry.json");
const pi = piRegistry.agents.map(entry => {
  const number = Number(entry.id.slice(-2));
  const source = read(`config/pi/v3/dossiers/pi-${pad(number)}.json`);
  const agent = source.agent;
  return {
    id: agent.id,
    system: "PI",
    number,
    name: agent.name,
    shortName: agent.short_name,
    group: agent.division,
    role: agent.position,
    roleSubtitle: positionSubtitle(agent.position),
    superior: agent.superior,
    peers: agent.peers,
    independence: agent.independence,
    jurisdiction: agent.jurisdiction,
    summary: source.doctrine.core,
    artifact: agent.artifact,
    documentation: `../docs/pi/agents/v3/pi-${pad(number)}-dossier.md`,
    console: `pi-strategy-center.html#${agent.id}`
  };
});

const departmentRegistry = read("config/departments/registry.json");
const departmentRelationshipMatrix = read("config/departments/relationship-matrix.json");
const departments = departmentRegistry.departments.map(department => {
  const registry = read(`config/departments/${department.id}/registry.json`);
  return { ...registry.department, agents: registry.agents.map(agent => agent.id) };
});
const departmentAgents = departments.flatMap(department => department.agents.map(id => {
  const agent = read(`config/departments/${department.id}/agents/${id}.json`);
  return {
    id: agent.agent.id, system: "DEPARTMENT", number: agent.agent.number, name: agent.agent.name, shortName: agent.agent.name,
    group: department.name, role: agent.agent.artifact, roleSubtitle: `No sustituye a: ${agent.agent.boundary}`,
    superior: agent.agent.number === 1 ? "omega_02" : `${department.prefix}_01`, peers: [],
    independence: "autoridad autónoma; producer y reviewer separados", jurisdiction: [agent.accountable_question], summary: agent.accountable_question,
    artifact: agent.agent.artifact, documentation: `../docs/departments/${department.id}/agents/v3/${agent.agent.id}-dossier.md`, console: `autonomous-departments-center.html#${agent.agent.id}`
  };
}));

const nodeById = new Map([...omega, ...pi, ...sigma, ...departmentAgents].map(node => [node.id, node]));
const topology = [];
const seen = new Set();
const addEdge = (from, to, type, family, label) => {
  if (!nodeById.has(from) || !nodeById.has(to)) return;
  const key = `${from}|${to}|${type}|${family}`;
  if (seen.has(key)) return;
  seen.add(key);
  topology.push({ from, to, type, family, label: label || type });
};

for (const node of omega) {
  if (nodeById.has(node.superior)) addEdge(node.superior, node.id, "COMMANDS", "TOPOLOGY", "mando Ω");
  for (const peer of node.peers || []) addEdge(node.id, peer, "INDEPENDENT_FROM", "INDEPENDENCE", "canal independiente");
}
for (const node of sigma) {
  if (node.id !== "sigma_01" && nodeById.has(node.superior)) addEdge(node.superior, node.id, "REPORTS_TO", "TOPOLOGY", "mando Σ");
}
addEdge("omega_02", "sigma_01", "MANDATES", "TOPOLOGY", "mandato Ω → Σ");

for (const node of pi) {
  if (nodeById.has(node.superior)) addEdge(node.superior, node.id, node.id === "pi_01" ? "MANDATES" : "REPORTS_TO", "TOPOLOGY", node.id === "pi_01" ? "mandato Ω → Π" : "mando Π");
}
for (const node of departmentAgents) {
  if (nodeById.has(node.superior)) addEdge(node.superior, node.id, node.id.endsWith("_01") ? "MANDATES" : "COMMANDS", "TOPOLOGY", node.id.endsWith("_01") ? "mandato Ω" : "mando departamental");
}
for (const relation of departmentRelationshipMatrix.relations) {
  if (nodeById.has(relation.from) && nodeById.has(relation.to)) addEdge(relation.from, relation.to, relation.type, relation.type === "COMMANDS" ? "TOPOLOGY" : "INFORMATION", relation.type);
}

const relationshipMatrix = read("config/sigma/v3/relationship-matrix.json");
const piMatrix = read("config/pi/v3/relationship-matrix.json");
const payload = JSON.stringify({
  nodes: [...omega, ...pi, ...sigma, ...departmentAgents],
  departments,
  topology,
  matrices: { SIGMA: relationshipMatrix, PI: piMatrix },
  generatedAt: new Date().toISOString()
}).replaceAll("<", "\\u003c");

const html = String.raw`<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Sovereign OS · Atlas interactivo</title>
  <style>
    :root{--bg:#03080e;--panel:#07141d;--panel2:#0b1b26;--line:#1a3a4b;--text:#e9f7fb;--muted:#80a1ae;--cyan:#48dfeb;--gold:#ffc96a;--green:#69e8a4;--blue:#80adff;--violet:#c29aff;--red:#ff7387;--shadow:0 25px 80px #000a}
    *{box-sizing:border-box} html{background:var(--bg);color:var(--text);font:14px/1.45 Inter,Segoe UI,Arial,sans-serif} body{margin:0;min-height:100vh;background:radial-gradient(circle at 80% -10%,#133e50 0,transparent 30%),radial-gradient(circle at 7% 14%,#17275c66 0,transparent 25%),var(--bg)}
    button,input,select{font:inherit;color:inherit}.app{max-width:2100px;margin:auto;padding:18px}.top{display:flex;align-items:center;justify-content:space-between;gap:20px;padding:5px 4px 16px}.eyebrow{color:var(--cyan);font-size:10px;letter-spacing:.18em;text-transform:uppercase;font-weight:800}.top h1{margin:2px 0;font-size:clamp(22px,2.3vw,32px);letter-spacing:-.04em}.sub{color:var(--muted);max-width:900px}.live{display:flex;align-items:center;gap:9px;border:1px solid #2a6749;background:#0a261c;padding:8px 11px;border-radius:9px;color:var(--green);font-size:11px;font-weight:800;white-space:nowrap}.pulse{width:8px;height:8px;border-radius:50%;background:var(--green);box-shadow:0 0 16px var(--green)}
    .panel{background:linear-gradient(145deg,#0a1b26eF,#051018ed);border:1px solid var(--line);border-radius:13px;box-shadow:var(--shadow)}.intro{display:grid;grid-template-columns:1.25fr .75fr;gap:10px;padding:12px;margin-bottom:11px}.intro strong{color:var(--cyan)}.intro p{margin:0;color:var(--muted)}.metrics{display:grid;grid-template-columns:repeat(4,1fr);gap:7px}.metric{padding:8px;border:1px solid var(--line);border-radius:8px;background:#071721}.metric b{display:block;font-size:18px}.metric span{display:block;color:var(--muted);font-size:9px;letter-spacing:.1em;text-transform:uppercase}
    .toolbar{display:grid;grid-template-columns:minmax(280px,1.5fr) minmax(200px,.8fr) auto auto auto;gap:8px;align-items:center;padding:10px;margin-bottom:11px}.toolbar input,.toolbar select,.toolbtn{width:100%;background:#071823;border:1px solid var(--line);border-radius:8px;padding:9px 10px}.toolbtn{width:auto;cursor:pointer;white-space:nowrap}.toolbtn:hover,.toolbtn.active{border-color:var(--cyan);color:var(--cyan);background:#0b2935}.search-wrap{position:relative}.results{display:none;position:absolute;z-index:10;left:0;right:0;top:calc(100% + 5px);max-height:270px;overflow:auto;background:#091922;border:1px solid #286071;border-radius:8px;box-shadow:var(--shadow)}.results.show{display:block}.result{display:block;width:100%;border:0;border-bottom:1px solid var(--line);background:transparent;padding:9px 11px;text-align:left;cursor:pointer}.result:hover{background:#0d2a35}.result small{color:var(--muted)}
    .workspace{display:grid;grid-template-columns:minmax(0,1fr) minmax(310px,390px);gap:11px}.map-panel{min-width:0;overflow:hidden}.map-head{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 12px;border-bottom:1px solid var(--line)}.map-head b{font-size:12px}.hint{color:var(--muted);font-size:11px}.map-actions{display:flex;gap:5px}.map-actions button{background:#0b202a;border:1px solid var(--line);border-radius:6px;padding:4px 8px;cursor:pointer}.map-actions button:hover{border-color:var(--cyan)}
    .graph-wrap{height:min(78vh,940px);min-height:600px;background:linear-gradient(180deg,#07131bd9,#040b11d9);overflow:hidden;touch-action:none}.graph{display:block;width:100%;height:100%;cursor:grab}.graph.dragging{cursor:grabbing}.edge{fill:none;stroke:#578496;stroke-width:2.2;stroke-linecap:round;opacity:.38;pointer-events:stroke}.edge.topology{stroke:#4b94a8}.edge.command{stroke:var(--gold)}.edge.information{stroke:var(--blue)}.edge.control{stroke:var(--red)}.edge.independence{stroke:var(--violet);stroke-dasharray:7 6}.edge:hover{stroke-width:5;opacity:1}.node{cursor:pointer;outline:none}.node rect{fill:#091d27;stroke:#2d6374;stroke-width:2;rx:10;transition:.15s}.node.omega rect{fill:#0a2130;stroke:#42c9df}.node.pi rect{fill:#1d1230;stroke:#cf9fff}.node.sigma rect{stroke:#39748a}.node.department rect{fill:#20220d;stroke:#b3bd4c}.node.selected rect{stroke:#fff;stroke-width:4;filter:drop-shadow(0 0 14px #76f6ff)}.node.related rect{stroke:#ffda8a;stroke-width:3}.node.dim{opacity:.20}.node:hover rect{stroke:#fff;stroke-width:3}.node-id{fill:#7ceaf3;font-size:12px;font-weight:900;letter-spacing:.08em}.node.omega .node-id{fill:#9deeff}.node.pi .node-id{fill:#e0c0ff}.node.department .node-id{fill:#e4eb7b}.node-name{fill:#e8f8fb;font-size:10px;font-weight:650}.node-position{fill:#b9d5dd;font-size:7px;font-weight:650}.node-group{fill:#8eabb4;font-size:8px;letter-spacing:.09em}.lane{fill:#8eabb4;font-size:11px;font-weight:800;letter-spacing:.17em}.lane-line{stroke:#2b5260;stroke-width:1}.divider{stroke:#58dbe8;stroke-width:2;stroke-dasharray:8 8;opacity:.55}.divider-label{fill:#83dfe8;font-size:13px;font-weight:900;letter-spacing:.18em}
    .legend{display:flex;flex-wrap:wrap;gap:10px;padding:8px 12px;border-top:1px solid var(--line);font-size:10px;color:var(--muted)}.legend span::before{content:"";display:inline-block;width:20px;height:2px;vertical-align:middle;margin:-2px 5px 0 0;background:#4b94a8}.legend .command::before{background:var(--gold)}.legend .information::before{background:var(--blue)}.legend .control::before{background:var(--red)}.legend .independence::before{background:var(--violet)}
    .inspector{min-height:680px;overflow:hidden;display:flex;flex-direction:column}.inspect-head{padding:15px;border-bottom:1px solid var(--line)}.inspect-head h2{font-size:19px;line-height:1.15;margin:4px 0}.inspect-head p{margin:6px 0 0;color:var(--muted);font-size:12px}.badge{display:inline-block;border:1px solid #2a6377;color:var(--cyan);border-radius:20px;padding:3px 7px;font-size:9px;letter-spacing:.12em;font-weight:800}.inspect-body{padding:14px;overflow:auto}.empty{display:grid;place-items:center;min-height:440px;color:var(--muted);text-align:center;padding:30px}.empty b{color:var(--cyan)}.field{margin:0 0 13px}.field label{display:block;color:var(--muted);font-size:9px;font-weight:800;letter-spacing:.13em;text-transform:uppercase;margin-bottom:3px}.field div{font-size:12px}.summary{border-left:3px solid var(--cyan);background:#09212b;padding:9px 10px;border-radius:0 7px 7px 0}.chips{display:flex;flex-wrap:wrap;gap:5px}.chip{border:1px solid var(--line);background:#0a1d27;padding:4px 6px;border-radius:5px;color:#c8e5ea;font-size:10px}.connections{border-top:1px solid var(--line);margin-top:14px;padding-top:12px}.connection{display:grid;grid-template-columns:auto 1fr auto;gap:7px;align-items:center;width:100%;padding:7px 0;border:0;border-bottom:1px solid #153240;background:transparent;text-align:left;cursor:pointer}.connection:hover b{color:var(--cyan)}.connection span{font-size:9px;padding:2px 5px;border:1px solid var(--line);border-radius:4px;color:var(--muted)}.connection small{color:var(--muted);font-size:10px}.link{display:inline-block;border:1px solid #2b6580;border-radius:7px;color:var(--blue);padding:7px 8px;text-decoration:none;font-size:11px}.link:hover{border-color:var(--blue)}
    @media(max-width:1100px){.workspace{grid-template-columns:1fr}.inspector{min-height:360px}.inspect-body{max-height:450px}.toolbar{grid-template-columns:1fr 1fr auto auto}.toolbar .search-wrap{grid-column:1/-1}.intro{grid-template-columns:1fr}.graph-wrap{height:68vh}}@media(max-width:650px){.app{padding:9px}.top{align-items:flex-start}.live{display:none}.toolbar{grid-template-columns:1fr 1fr}.toolbar select{grid-column:1/-1}.toolbtn{width:100%}.metrics{grid-template-columns:repeat(2,1fr)}.graph-wrap{min-height:520px}.hint{display:none}}
  </style>
</head>
<body>
  <div class="app">
    <header class="top"><div><div class="eyebrow">Sovereign OS · Atlas de arquitectura</div><h1>Cúspide Ω + departamentos Σ y Π, en un único mapa</h1><div class="sub">Explora los 104 agentes, su cadena de mando y conexiones de información, control e independencia. Selecciona un nodo o conector para seguir cada relación.</div></div><div class="live"><span class="pulse"></span> ESPECIFICACIÓN AUDITADA</div></header>
    <section class="panel intro"><p><strong>Cómo usarlo:</strong> toca cualquier nodo para abrir su ficha. Cambia el filtro para revelar sus conectores declarados; usa rueda, pellizco o arrastre para acercarte. La vista inicial enseña la topología completa.</p><div class="metrics"><div class="metric"><b>24</b><span>agentes Ω</span></div><div class="metric"><b>40</b><span>agentes Π</span></div><div class="metric"><b>40</b><span>agentes Σ</span></div><div class="metric"><b>3.200</b><span>celdas Π + Σ</span></div><div class="metric"><b>1</b><span>mapa navegable</span></div></div></section>
    <section class="panel toolbar"><div class="search-wrap"><input id="search" autocomplete="off" placeholder="Busca un agente, división, artefacto o función…"><div id="results" class="results"></div></div><select id="filter"><option value="TOPOLOGY">Topología y mando</option><option value="COMMAND">Conectores de mando</option><option value="INFORMATION">Flujo de información</option><option value="CONTROL">Verificación y control</option><option value="INDEPENDENCE">Independencia y fronteras</option></select><button id="zoomIn" class="toolbtn" title="Acercar">＋ Acercar</button><button id="zoomOut" class="toolbtn" title="Alejar">－ Alejar</button><button id="reset" class="toolbtn">Recentrar</button></section>
    <main class="workspace"><section class="panel map-panel"><div class="map-head"><div><b id="mapTitle">Topología institucional</b><div class="hint" id="mapHint">154 nodos · la flecha sale del origen y llega al destinatario</div></div><div class="map-actions"><button id="focus" title="Centrar el nodo seleccionado">Enfocar</button></div></div><div class="graph-wrap"><svg id="graph" class="graph" viewBox="0 0 2200 3700" role="application" aria-label="Mapa interactivo de agentes y departamentos"><defs><marker id="arrow" markerWidth="8" markerHeight="8" refX="7" refY="3.5" orient="auto"><path d="M0,0 L8,3.5 L0,7 z" fill="#8eb9c7"></path></marker></defs><g id="scene"></g></svg></div><div class="legend"><span>topología</span><span class="command">mando</span><span class="information">información</span><span class="control">control</span><span class="independence">independencia</span></div></section><aside id="inspector" class="panel inspector"></aside></main>
  </div>
  <script>const DATA=__DATA__;
    const $=selector=>document.querySelector(selector);
    const esc=value=>String(value??"").replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[char]));
    const isNodeTarget=target=>target instanceof Element&&Boolean(target.closest(".node"));
    const svgNS="http://www.w3.org/2000/svg";
    const graph=$("#graph"),scene=$("#scene"),filter=$("#filter"),search=$("#search"),results=$("#results"),inspector=$("#inspector");
    const nodeById=new Map(DATA.nodes.map(node=>[node.id,node]));
    const piDivisions=["COMMAND","DIRECTION","STRATEGIC_DESIGN","TRANSFORMATION","CAPITAL_CAPABILITY","RISK_LEGITIMACY","INTEGRATION_OUTCOMES","ASSURANCE_CHANGE"];
    const sigmaDivisions=["COMMAND","REQUIREMENTS","COLLECTION","SOURCE","REALITY","ANALYSIS","WARNING","PRODUCT","ASSURANCE"];
    const classFor={TOPOLOGY:"topology",COMMAND:"command",INFORMATION:"information",CONTROL:"control",INDEPENDENCE:"independence"};
    const familyFor={COMMANDS:"COMMAND",REPORTS_TO:"COMMAND",MANDATES:"COMMAND",REQUESTS:"COMMAND",ESCALATES_TO:"COMMAND",FEEDS:"INFORMATION",VERIFIES:"CONTROL",AUDITS:"CONTROL",CHALLENGES:"CONTROL",BLOCKS:"CONTROL",INDEPENDENT_FROM:"INDEPENDENCE",BOUNDARY:"INDEPENDENCE"};
    const labelFor={COMMANDS:"manda",REPORTS_TO:"reporta a",MANDATES:"emite mandato",REQUESTS:"solicita",ESCALATES_TO:"escala a",FEEDS:"alimenta",VERIFIES:"verifica",AUDITS:"audita",CHALLENGES:"desafía",BLOCKS:"bloquea",INDEPENDENT_FROM:"independiente de",BOUNDARY:"frontera",TOPOLOGY:"mando"};
    const positions={}; let selected=null;
    const box={w:168,h:66};
    function pos(id,x,y){positions[id]={x,y};}
    function layout(){
      pos("omega_01",1016,92);pos("omega_02",1016,182);pos("omega_03",1900,92);
      const rest=DATA.nodes.filter(node=>node.system==="OMEGA"&&!['omega_01','omega_02','omega_03'].includes(node.id)).sort((a,b)=>a.number-b.number);
      rest.forEach((node,index)=>pos(node.id,60+(index%7)*300,308+Math.floor(index/7)*78));
      pos("pi_01",1016,610);
      piDivisions.forEach((division,row)=>{
        const members=DATA.nodes.filter(node=>node.system==="PI"&&node.group===division&&node.id!=="pi_01").sort((a,b)=>a.number-b.number);
        members.forEach((node,index)=>pos(node.id,275+index*180,724+row*82));
      });
      pos("sigma_01",1016,1480);
      sigmaDivisions.forEach((division,row)=>{
        const members=DATA.nodes.filter(node=>node.system==="SIGMA"&&node.group===division&&node.id!=="sigma_01").sort((a,b)=>a.number-b.number);
        members.forEach((node,index)=>pos(node.id,275+index*180,1594+row*82));
      });
      DATA.departments.forEach((department,row)=>department.agents.forEach((id,index)=>pos(id,275+(index%5)*360,2410+row*245+Math.floor(index/5)*78)));
      (DATA.departments||[]).forEach((department,row)=>{
        department.agents.forEach((id,index)=>pos(id,275+(index%5)*360,2410+row*245+Math.floor(index/5)*78));
      });
    }
    layout();
    function make(tag,attributes={},text="") {const element=document.createElementNS(svgNS,tag);Object.entries(attributes).forEach(([key,value])=>element.setAttribute(key,value));if(text)element.textContent=text;return element;}
    function truncate(text,length=24){return text.length>length?text.slice(0,length-1)+"…":text;}
    function allMatrixEdges(id){
      const node=nodeById.get(id),matrix=DATA.matrices[node?.system];
      if(!node||!matrix)return [];
      const edges=[];
      for(const other of matrix.roles){
        if(other.id===id)continue;
        for(const type of matrix.cells[id][other.id]||[])edges.push({from:id,to:other.id,type,family:familyFor[type]||"INDEPENDENCE",label:labelFor[type]||type});
        for(const type of matrix.cells[other.id][id]||[])edges.push({from:other.id,to:id,type,family:familyFor[type]||"INDEPENDENCE",label:labelFor[type]||type});
      }
      return edges;
    }
    function allEdgesFor(id){
      const base=DATA.topology.filter(edge=>edge.from===id||edge.to===id);
      return [...base,...allMatrixEdges(id)];
    }
    function shownEdges(){
      const wanted=filter.value;
      if(wanted==="TOPOLOGY")return DATA.topology.filter(edge=>edge.family==="TOPOLOGY");
      if(!selected)return [];
      return allEdgesFor(selected.id).filter(edge=>edge.family===wanted);
    }
    function edgePath(from,to){
      const a=positions[from],b=positions[to];if(!a||!b)return "";
      const x1=a.x+box.w/2,y1=a.y+box.h/2,x2=b.x+box.w/2,y2=b.y+box.h/2;
      const bend=Math.max(42,Math.abs(y2-y1)*.46);
      if(Math.abs(y2-y1)<20)return "M "+x1+" "+y1+" C "+(x1+48)+" "+y1+" "+(x2-48)+" "+y2+" "+x2+" "+y2;
      return "M "+x1+" "+y1+" C "+x1+" "+(y1+bend)+" "+x2+" "+(y2-bend)+" "+x2+" "+y2;
    }
    function render(){
      scene.replaceChildren(); const edges=shownEdges(); const connected=new Set();edges.forEach(edge=>{connected.add(edge.from);connected.add(edge.to)});
      const labels=make("g");labels.append(make("text",{x:28,y:35,class:"lane"},"CÚSPIDE SOBERANA Ω"));labels.append(make("line",{x1:28,y1:45,x2:2170,y2:45,class:"lane-line"}));labels.append(make("line",{x1:28,y1:557,x2:2170,y2:557,class:"divider"}));labels.append(make("text",{x:28,y:548,class:"divider-label"},"Ω · MANDATO, GOBIERNO Y ASEGURAMIENTO  →  Π · ESTRATEGIA, CARTERA Y TRANSFORMACIÓN"));labels.append(make("line",{x1:28,y1:1418,x2:2170,y2:1418,class:"divider"}));labels.append(make("text",{x:28,y:1409,class:"divider-label"},"Π · OPCIONES, PROGRAMAS Y CONSEJO  →  Σ · INTELIGENCIA E INCERTIDUMBRE"));
      piDivisions.forEach((division,row)=>{const y=750+row*82;labels.append(make("text",{x:30,y:y+12,class:"lane"},"Π · "+division));labels.append(make("line",{x1:30,y1:y+20,x2:248,y2:y+20,class:"lane-line"}));});sigmaDivisions.forEach((division,row)=>{const y=1620+row*82;labels.append(make("text",{x:30,y:y+12,class:"lane"},"Σ · "+division));labels.append(make("line",{x1:30,y1:y+20,x2:248,y2:y+20,class:"lane-line"}));});(DATA.departments||[]).forEach((department,row)=>{const y=2382+row*245;labels.append(make("text",{x:30,y:y+12,class:"divider-label"},"NUEVO DEPARTAMENTO · "+department.name.toUpperCase()));labels.append(make("line",{x1:30,y1:y+20,x2:2170,y2:y+20,class:"divider"}));});scene.append(labels);
      const edgeLayer=make("g");edges.forEach(edge=>{const path=make("path",{d:edgePath(edge.from,edge.to),class:"edge "+(classFor[edge.family]||"independence"),"marker-end":"url(#arrow)",tabindex:"0","aria-label":edge.from+" "+edge.label+" "+edge.to});path.append(make("title",{},edge.from+" → "+edge.to+" · "+edge.type));path.addEventListener("click",event=>{event.stopPropagation();selectNode(edge.to,edge.family);});edgeLayer.append(path);});scene.append(edgeLayer);
      const nodes=make("g");DATA.nodes.forEach(node=>{const p=positions[node.id];const mark=node.system==="OMEGA"?"Ω":node.system==="PI"?"Π":node.system==="DEPARTMENT"?"D":"Σ";const group=make("g",{transform:"translate("+p.x+" "+p.y+")",class:"node "+node.system.toLowerCase()+(selected?.id===node.id?" selected":"")+(selected&&connected.has(node.id)&&selected.id!==node.id?" related":"")+(selected&&filter.value!=="TOPOLOGY"&&!connected.has(node.id)&&selected.id!==node.id?" dim":""),tabindex:"0",role:"button","aria-label":"Abrir "+node.id+" "+node.name+" · "+node.roleSubtitle});group.append(make("title",{},node.id+" · "+node.name+" · "+node.roleSubtitle));group.append(make("rect",{width:box.w,height:box.h}));group.append(make("text",{x:10,y:17,class:"node-id"},mark+pad(node.number)));group.append(make("text",{x:10,y:31,class:"node-name"},truncate(node.shortName||node.name)));group.append(make("text",{x:10,y:44,class:"node-position"},truncate(node.roleSubtitle,31)));group.append(make("text",{x:10,y:58,class:"node-group"},truncate(node.group,22)));group.addEventListener("click",event=>{event.stopPropagation();selectNode(node.id);});group.addEventListener("keydown",event=>{if(event.key==="Enter"||event.key===" "){event.preventDefault();selectNode(node.id);}});nodes.append(group);});scene.append(nodes);
      const descriptor=filter.options[filter.selectedIndex].text;$("#mapTitle").textContent=selected?"Conectores de "+selected.id+" · "+descriptor:descriptor;$("#mapHint").textContent=selected&&filter.value!=="TOPOLOGY"?"Mostrando relaciones declaradas de este nodo. Pulsa un conector para seguir la ruta.":DATA.nodes.length+" nodos · la flecha sale del origen y llega al destinatario";
    }
    function pad(value){return String(value).padStart(2,"0");}
    function selectNode(id,forcedFilter){selected=nodeById.get(id);if(!selected)return;if(forcedFilter&&forcedFilter!=="TOPOLOGY"){filter.value=forcedFilter;}render();renderInspector();}
    function renderInspector(){
      if(!selected){inspector.innerHTML='<div class="empty"><div><b>Selecciona un nodo</b><br><br>El mapa enseña toda la estructura. Al tocar un agente aparecerán su función, jurisdicción, artefacto y conectores.</div></div>';return;}
      const relations=allEdgesFor(selected.id);const unique=[...new Map(relations.map(edge=>[edge.from+"|"+edge.to+"|"+edge.type,edge])).values()];
      const counterpart=edge=>edge.from===selected.id?edge.to:edge.from;const direction=edge=>edge.from===selected.id?"→":"←";
      const jurisdiction=Array.isArray(selected.jurisdiction)?selected.jurisdiction.join(" · "):selected.jurisdiction;
      const active=filter.value;const counts=["COMMAND","INFORMATION","CONTROL","INDEPENDENCE"].map(family=>[family,unique.filter(edge=>edge.family===family).length]).filter(pair=>pair[1]);
      inspector.innerHTML='<div class="inspect-head"><span class="badge">'+(selected.system==="OMEGA"?"CÚSPIDE Ω":"FACTORÍA Σ")+' · '+selected.id+'</span><h2>'+esc(selected.name)+'</h2><p>'+esc(selected.shortName||selected.role||selected.group)+' · '+esc(selected.roleSubtitle)+'</p></div><div class="inspect-body"><div class="field"><label>Propósito / pregunta de trabajo</label><div class="summary">'+esc(selected.summary)+'</div></div><div class="field"><label>Posición</label><div>'+esc(selected.roleSubtitle)+' · '+esc(selected.group)+'</div></div><div class="field"><label>Jurisdicción</label><div>'+esc(jurisdiction)+'</div></div><div class="field"><label>Artefacto o ledger</label><div>'+esc(selected.artifact)+'</div></div><div class="field"><label>Independencia protegida</label><div>'+esc(selected.independence)+'</div></div><div class="field"><label>Conectores declarados · '+unique.length+'</label><div class="chips">'+counts.map(pair=>'<button class="chip" data-family="'+pair[0]+'">'+pair[0]+' · '+pair[1]+'</button>').join("")+'</div></div><div class="field"><a class="link" target="_blank" href="'+esc(selected.console)+'">Abrir ficha completa</a> <a class="link" target="_blank" href="'+esc(selected.documentation)+'">Abrir documento fuente</a></div><section class="connections"><label>Rutas directas</label>'+unique.slice(0,36).map(edge=>'<button class="connection" data-target="'+counterpart(edge)+'" data-family="'+edge.family+'"><span>'+direction(edge)+'</span><div><b>'+esc(labelFor[edge.type]||edge.type)+'</b><br><small>'+esc(counterpart(edge))+" · "+esc(nodeById.get(counterpart(edge))?.shortName||"")+'</small></div><span>'+esc(edge.type)+'</span></button>').join("")+(unique.length>36?'<div class="hint">Se muestran 36 de '+unique.length+' rutas.</div>':"")+'</section></div>';
      const badge=inspector.querySelector(".badge");
      if(badge&&selected.system==="PI")badge.textContent="ESTRATEGIA Π · "+selected.id;
      inspector.querySelectorAll("[data-family]").forEach(button=>button.addEventListener("click",()=>{filter.value=button.dataset.family;render();renderInspector();}));
      inspector.querySelectorAll("[data-target]").forEach(button=>button.addEventListener("click",()=>selectNode(button.dataset.target,button.dataset.family)));
    }
    function searchResults(){const query=search.value.trim().toLowerCase();if(!query){results.classList.remove("show");results.innerHTML="";return;}const matches=DATA.nodes.filter(node=>JSON.stringify(node).toLowerCase().includes(query)).slice(0,12);results.innerHTML=matches.map(node=>{const label=node.system==="OMEGA"?"Cúspide Ω":node.system==="PI"?"Estrategia Π":"Factoría Σ";return '<button class="result" data-id="'+node.id+'"><b>'+node.id+' · '+esc(node.name)+'</b><br><small>'+esc(label+" · "+node.group)+'</small></button>';}).join("")||'<div class="result">Sin coincidencias</div>';results.classList.add("show");results.querySelectorAll("[data-id]").forEach(button=>button.addEventListener("click",()=>{selectNode(button.dataset.id);search.value="";results.classList.remove("show");focusSelected();}));}
    search.addEventListener("input",searchResults);search.addEventListener("keydown",event=>{if(event.key==="Enter"){const first=results.querySelector("[data-id]");if(first)first.click();}});document.addEventListener("click",event=>{if(!event.target.closest(".search-wrap"))results.classList.remove("show");});filter.addEventListener("change",()=>{render();renderInspector();});graph.addEventListener("click",event=>{if(isNodeTarget(event.target))return;selected=null;filter.value="TOPOLOGY";render();renderInspector();});
    const graphBounds={w:2200,h:3700},initial={x:0,y:0,w:graphBounds.w,h:graphBounds.h},view={...initial};function update(){graph.setAttribute("viewBox",view.x+" "+view.y+" "+view.w+" "+view.h);}
    function zoom(factor,cx=view.x+view.w/2,cy=view.y+view.h/2){const width=Math.max(300,Math.min(graphBounds.w,view.w*factor)),height=Math.max(250,Math.min(graphBounds.h,view.h*factor));view.x=Math.max(0,Math.min(graphBounds.w-width,cx-(cx-view.x)*width/view.w));view.y=Math.max(0,Math.min(graphBounds.h-height,cy-(cy-view.y)*height/view.h));view.w=width;view.h=height;update();}
    function reset(){Object.assign(view,initial);update();}function focusSelected(){if(!selected)return;const point=positions[selected.id];view.w=760;view.h=520;view.x=Math.max(0,Math.min(graphBounds.w-view.w,point.x+box.w/2-view.w/2));view.y=Math.max(0,Math.min(graphBounds.h-view.h,point.y+box.h/2-view.h/2));update();}
    $("#zoomIn").onclick=()=>zoom(.75);$("#zoomOut").onclick=()=>zoom(1.3);$("#reset").onclick=reset;$("#focus").onclick=focusSelected;graph.addEventListener("wheel",event=>{event.preventDefault();const rect=graph.getBoundingClientRect(),cx=view.x+(event.clientX-rect.left)/rect.width*view.w,cy=view.y+(event.clientY-rect.top)/rect.height*view.h;zoom(event.deltaY>0?1.18:.84,cx,cy);},{passive:false});let drag=null;graph.addEventListener("pointerdown",event=>{if(isNodeTarget(event.target))return;drag={x:event.clientX,y:event.clientY,vx:view.x,vy:view.y};graph.setPointerCapture(event.pointerId);graph.classList.add("dragging");});graph.addEventListener("pointermove",event=>{if(!drag)return;const rect=graph.getBoundingClientRect();view.x=Math.max(0,Math.min(graphBounds.w-view.w,drag.vx-(event.clientX-drag.x)/rect.width*view.w));view.y=Math.max(0,Math.min(graphBounds.h-view.h,drag.vy-(event.clientY-drag.y)/rect.width*view.w));update();});graph.addEventListener("pointerup",()=>{drag=null;graph.classList.remove("dragging");});
    render();renderInspector();
  </script>
</body>
</html>`;

fs.mkdirSync(path.join(root, "visual"), { recursive: true });
fs.writeFileSync(path.join(root, "visual", "sovereign-atlas.html"), html.replace("__DATA__", payload), "utf8");
console.log(JSON.stringify({ visual: "visual/sovereign-atlas.html", omega_agents: omega.length, pi_agents: pi.length, sigma_agents: sigma.length, department_agents: departmentAgents.length, total_agents: omega.length + pi.length + sigma.length + departmentAgents.length, topology_edges: topology.length, matrix_cells: 3200, bytes: Buffer.byteLength(html.replace("__DATA__", payload)) }));
