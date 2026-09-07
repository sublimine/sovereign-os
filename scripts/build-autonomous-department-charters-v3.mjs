import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = file => JSON.parse(fs.readFileSync(path.join(root, file), "utf8"));
const write = (file, value) => { const target = path.join(root, file); fs.mkdirSync(path.dirname(target), { recursive: true }); fs.writeFileSync(target, `${JSON.stringify(value, null, 2)}\n`, "utf8"); };
const writeText = (file, value) => { const target = path.join(root, file); fs.mkdirSync(path.dirname(target), { recursive: true }); fs.writeFileSync(target, value, "utf8"); };
const registry = read("config/departments/registry.json"), interfaces = read("config/departments/v3/interface-contracts.json").interfaces, audit = read("config/departments/v3/audit-report.json"), simulation = read("config/departments/v3/simulation-traces.json");
const directives = {
  truth_verification: ["No permitir que una afirmación supere la evidencia que puede sostenerla.", "quien admite o custodia evidencia no la convierte por sí solo en veredicto", ["repetición confundida con independencia", "ausencia de evidencia convertida en evidencia de ausencia", "contradicción borrada bajo narrativa", "precisión superior a la medición"]],
  adversarial_attack: ["Encontrar rutas de error, explotación y autoengaño antes de producir efecto.", "quien ataca la tesis no la aprueba, corrige ni certifica", ["red team teatral sin cadena causal", "ataque que altera el sistema", "minoría silenciada por consenso", "amenaza sin mecanismo"]],
  prediction_decision: ["Formular recomendaciones condicionadas, reversibles y conscientes de ruina.", "quien modela opciones no asigna recursos ni activa efectos", ["forecast confundido con decisión", "media optimizada cruzando ruina", "escenario que renombra caso base", "trigger no observable"]],
  institutional_power: ["Delimitar si la institución puede actuar, con qué mandato, recursos, límites y reparación.", "quien instrumenta autoridad no decide estrategia ni audita su propia gobernanza", ["delegación implícita", "lease sin expiración", "compromiso externo sin instrumento", "revocación que deja efectos activos"]],
  final_quality_evolution: ["Determinar suficiencia para el efecto y aprender sin degradar garantías.", "quien certifica no produce el output certificado y quien aprende no cambia política", ["certificación por productor", "dossier sin trazabilidad", "cambio silencioso sin experimento", "rollback no ensayado"]]
};
const records = [];
for (const department of registry.departments) {
  const [mission, separation, risks] = directives[department.id];
  const agents = department.agents.map(id => read(`config/departments/v3/dossiers/${id}.json`));
  const iface = interfaces.filter(i => i.producer.department === department.id || i.consumer.department === department.id);
  const sims = simulation.simulations.filter(s => s.department === department.id);
  const file = `docs/departments/${department.id}/v3-department-charter.md`;
  const lines = [`# ${department.name} · Charter departamental V3`, "", "Estado: contractualmente especificado; pendiente de certificación independiente.", "", "## Misión", mission, "", "## Separación de deberes", separation, "", "## Equipo y artefactos únicos", "", "| ID | Autoridad | Artefacto | Frontera |", "|---|---|---|---|"];
  for (const a of agents) lines.push(`| ${a.agent.id} | ${a.agent.name} | ${a.agent.artifact} | ${a.agent.boundary} |`);
  lines.push("", "## Reglas de operación", "", "1. Admitir sólo input con owner, lease, hash, procedencia y freshness.", "2. Ejecutar método y falsificador de cada puesto antes del commit.", "3. Preservar evidencia contraria, disenso y UNKNOWN.", "4. Exigir revisión independiente material.", "5. Hacer handoff versionado sin transferir autoridad.", "", "## Riesgos propios");
  risks.forEach((risk, i) => lines.push(`${i + 1}. ${risk}. Respuesta: freeze, evidencia preservada, owner causal, supersesión y revisión independiente.`));
  lines.push("", "## Gates compartidos", "", "AUTHORITY_SCOPE, INPUT_LINEAGE, METHOD_EXECUTION, FALSIFIER_COVERAGE, BOUNDARY_SEPARATION, INDEPENDENT_REVIEW, OUTPUT_SCHEMA y HANDOFF_RECEIPT son no renunciables. Una ausencia material retorna o bloquea.", "", "## Interfaces");
  iface.forEach(i => lines.push(`- ${i.type}: ${i.producer.id}/${i.producer.artifact} → ${i.consumer.id}/${i.consumer.artifact}; preserva ${i.envelope.preserve.join(", ")}; autoridad=${i.transfer.authority}.`));
  lines.push("", "## Simulaciones y recuperación");
  sims.forEach(s => lines.push(`- ${s.id}: ${s.scenario.pressure} → ${s.scenario.oracle}; cinco roles, ${s.events.length} eventos, cero terminales COMPLETE.`));
  lines.push("Si se supersede un input: congelar dependientes, registrar impacto, regresar al owner causal y reejecutar gates afectados.", "", "## Observabilidad y terminación", "", "Registrar agente, misión, versiones, charter, estado, gate decisions, lease, contexto, coste, bloqueos y trigger de reconsideración.", "La coordinación termina sólo con artefactos schema-válidos, receipts independientes, handoffs reconocidos y UNKNOWN visible.", "", "## Consistencia interna actual", `- ${agents.reduce((n, a) => n + a.fmea.length, 0)} FMEA y ${agents.reduce((n, a) => n + a.evals.length, 0)} evaluaciones V3.`, `- Auditoría transversal: ${audit.metrics.detected_mutations}/${audit.metrics.mutations} mutaciones críticas detectadas.`, "- No declara certificación independiente: esa revisión debe ocurrir fuera del camino de generación.");
  writeText(file, `${lines.join("\n")}\n`);
  records.push({ id: department.id, name: department.name, charter: file, agents: agents.length, artifacts: agents.length, interfaces: iface.length, simulations: sims.length, risks: risks.length });
}
write("config/departments/v3/department-charters.json", { schema_version: "3.0.0", status: "SPECIFIED_PENDING_INDEPENDENT_CERTIFICATION", departments: records });
console.log(JSON.stringify({ charters: records.length, agents: records.reduce((n, x) => n + x.agents, 0), risks: records.reduce((n, x) => n + x.risks, 0) }));
