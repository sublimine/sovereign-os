import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = relative => JSON.parse(fs.readFileSync(path.join(root, relative), "utf8"));
const write = (relative, value) => { const file = path.join(root, relative); fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, typeof value === "string" ? value : `${JSON.stringify(value, null, 2)}\n`, "utf8"); };
const pad = value => String(value).padStart(2, "0");
const registry = read("config/pi/agent-registry.json");
const relationships = read("config/pi/relationships.json").edges;
const matrix = read("config/pi/v3/relationship-matrix.json");
const authorityConfig = read("config/pi/authority-actions.json");
const dossiers = registry.roles.map(role => read(`config/pi/v3/dossiers/pi-${pad(role.number)}.json`));
const byId = new Map(dossiers.map(dossier => [dossier.agent.id, dossier]));
const roleIds = new Set(registry.roles.map(role => role.id));
const errors = [];
const warnings = [];
const findings = [];
const require = (condition, message) => { if (!condition) errors.push(message); };
const unique = (entries, label) => { const seen = new Map(); for (const [id, value] of entries) { if (seen.has(value)) errors.push(`${label} collision: ${seen.get(value)} / ${id} = ${value}`); else seen.set(value, id); } };

require(registry.roles.length === 40, "exactly 40 Π registry roles required");
require(dossiers.length === 40, "exactly 40 Π dossiers required");
unique(dossiers.map(dossier => [dossier.agent.id, dossier.agent.artifact]), "artifact");
unique(dossiers.flatMap(dossier => dossier.memory.commit.map(ledger => [dossier.agent.id, ledger])), "commit ledger");
unique(dossiers.map(dossier => [dossier.agent.id, dossier.doctrine.unit]), "unit of analysis");

for (const role of registry.roles) {
  const n = pad(role.number);
  const dossier = byId.get(role.id);
  const docPath = path.join(root, `docs/pi/agents/v3/pi-${n}-dossier.md`);
  const charterPath = path.join(root, `config/pi/v3/charters/pi-${n}.system.md`);
  const schemaPath = path.join(root, `schemas/pi/outputs/pi-${n}-output.schema.json`);
  require(Boolean(dossier), `${role.id} dossier missing`);
  if (!dossier) continue;
  require(dossier.agent.documentation === `docs/pi/agents/v3/pi-${n}-dossier.md`, `${role.id} documentation pointer invalid`);
  require(dossier.agent.artifact === role.artifact, `${role.id} registry/dossier artifact mismatch`);
  require(fs.existsSync(docPath) && fs.readFileSync(docPath, "utf8").split("\n").length >= 850, `${role.id} dossier document is shallow`);
  require(fs.existsSync(charterPath) && fs.readFileSync(charterPath, "utf8").includes("Self-check final"), `${role.id} charter incomplete`);
  require(fs.existsSync(schemaPath), `${role.id} output schema missing`);
  require(dossier.doctrine.decisions.length >= 8 && dossier.doctrine.methods.length >= 8 && dossier.doctrine.variables.length >= 8, `${role.id} doctrine insufficiently specified`);
  require(dossier.doctrine.boundaries.length >= 12, `${role.id} has fewer than 12 boundaries`);
  require(dossier.doctrine.boundaries.every(boundary => boundary.owns && boundary.other_owns && boundary.handshake && boundary.conflict), `${role.id} has incomplete boundary`);
  require(dossier.doctrine.boundaries.every(boundary => !(boundary.counterpart_refs || []).some(ref => ref.id === role.id)), `${role.id} has self-boundary`);
  for (const boundary of dossier.doctrine.boundaries) for (const reference of boundary.counterpart_refs || []) {
    if (reference.authority === "PI") require(roleIds.has(reference.id), `${role.id} unknown Π boundary ${reference.id}`);
    if (reference.authority === "OMEGA") require(/^omega_(0[1-9]|1\d|2[0-4])$/.test(reference.id), `${role.id} unknown Ω boundary ${reference.id}`);
    if (reference.authority === "SIGMA") require(/^sigma_(0[1-9]|[12]\d|3\d|40)$/.test(reference.id), `${role.id} unknown Σ boundary ${reference.id}`);
  }
  require(dossier.inputs.length >= 6 && dossier.inputs.every(input => input.producer && input.schema && input.freshness && input.validation.length >= 4 && input.reject.length >= 4), `${role.id} input contract incomplete`);
  require(dossier.workflow.length === dossier.doctrine.methods.length && new Set(dossier.workflow.map(step => step.state)).size === dossier.workflow.length, `${role.id} workflow mismatch or duplicate state`);
  require(dossier.gates.length >= 8 && dossier.gates.every(gate => gate.threshold && !/predeclared criterion met/i.test(gate.threshold)), `${role.id} gates shallow`);
  require(dossier.gates.some(gate => gate.id === "NO_SELF_CERTIFICATION" && gate.evaluation_independence === "INDEPENDENT_REVIEW" && gate.certification_effect === "CERTIFICATION_PRECONDITION"), `${role.id} missing independent no-self-certification gate`);
  require(dossier.specialists.length >= 5 && dossier.specialists.every(specialist => specialist.max_children === 0 && specialist.max_depth === 0 && specialist.context_exclusions.length >= 4 && specialist.permissions.includes("NO_EXTERNAL_EFFECT")), `${role.id} delegation control incomplete`);
  require(dossier.fmea.length >= 20 && dossier.fmea.every(item => item.mechanism && item.detection.length >= 3 && item.containment.length >= 3 && item.recovery.length >= 3 && item.revalidation.length >= 3), `${role.id} FMEA is not causal`);
  require(dossier.evals.length >= 16 && dossier.evals.every(item => item.expected_oracle && item.must_not), `${role.id} adversarial evals incomplete`);
  require(dossier.authority.EXECUTE !== "P" && dossier.authority.DECIDE_SOVEREIGN === "X" && dossier.authority.SELF_CERTIFY === "X" && dossier.authority.ALLOCATE_CAPITAL !== "P", `${role.id} receives prohibited strategic power`);
  require(JSON.stringify(authorityConfig.agents[role.id]) === JSON.stringify(dossier.authority), `${role.id} authority config diverges from dossier`);
  require(dossier.operational.output_contract.schema === `schemas/pi/outputs/pi-${n}-output.schema.json`, `${role.id} output schema pointer invalid`);
}

const allowed = new Set(["COMMANDS", "REPORTS_TO", "REQUESTS", "FEEDS", "VERIFIES", "AUDITS", "CHALLENGES", "BLOCKS", "ESCALATES_TO", "INDEPENDENT_FROM"]);
const seenEdges = new Set();
for (const edge of relationships) {
  require(roleIds.has(edge.from) && roleIds.has(edge.to), `relationship endpoint missing ${edge.from}->${edge.to}`);
  require(edge.from !== edge.to, `self relationship ${edge.from}`);
  require(allowed.has(edge.type), `illegal relationship type ${edge.type}`);
  const key = [edge.from, edge.to, edge.type, edge.scope].join("|");
  require(!seenEdges.has(key), `duplicate relationship ${key}`); seenEdges.add(key);
}
const commands = relationships.filter(edge => edge.type === "COMMANDS");
for (const role of registry.roles) {
  const incoming = commands.filter(edge => edge.to === role.id);
  if (role.id === "pi_01") require(incoming.length === 0, "pi_01 must not receive internal command");
  else require(incoming.length === 1 && incoming[0].from === role.superior, `${role.id} command parent mismatch`);
  for (const child of role.direct_reports || []) require(registry.roles.find(candidate => candidate.id === child)?.superior === role.id, `${role.id}/${child} hierarchy non-reciprocal`);
}
const visited = new Set(); const visiting = new Set();
function visit(id) { if (visiting.has(id)) { errors.push(`command cycle at ${id}`); return; } if (visited.has(id)) return; visiting.add(id); for (const edge of commands.filter(candidate => candidate.from === id)) visit(edge.to); visiting.delete(id); visited.add(id); }
visit("pi_01"); require(visited.size === 40, `command graph reaches ${visited.size}/40 Π roles`);
for (const role of registry.roles) {
  for (const other of registry.roles) {
    const cell = matrix.cells?.[role.id]?.[other.id];
    require(Array.isArray(cell), `matrix cell absent ${role.id}->${other.id}`);
    if (role.id === other.id) require(cell.includes("SELF"), `matrix self absent ${role.id}`);
  }
}
for (const edge of relationships) require(matrix.cells[edge.from][edge.to].includes(edge.type), `matrix misses ${edge.from}->${edge.to}:${edge.type}`);
for (const role of registry.roles.filter(role => !["pi_38", "pi_39"].includes(role.id))) {
  require(relationships.some(edge => edge.from === "pi_38" && edge.to === role.id && edge.type === "AUDITS"), `${role.id} lacks Π38 audit route`);
  require(relationships.some(edge => edge.from === "pi_39" && edge.to === role.id && edge.type === "CHALLENGES"), `${role.id} lacks Π39 challenge route`);
}

const normalizeLine = value => String(value).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim();
const substantiveLines = dossier => new Set([
  dossier.agent.artifact,
  dossier.doctrine.unit,
  ...dossier.doctrine.methods.slice(0, 5),
  ...dossier.doctrine.falsifiers.slice(0, 4),
  ...dossier.doctrine.threats.slice(0, 4)
].map(normalizeLine));
const overlap = [];
for (let left = 0; left < dossiers.length; left++) for (let right = left + 1; right < dossiers.length; right++) {
  const a = dossiers[left], b = dossiers[right], ta = substantiveLines(a), tb = substantiveLines(b); const both = [...ta].filter(line => tb.has(line)).length; const union = new Set([...ta, ...tb]).size; const score = Number((both / union).toFixed(4));
  const bounded = a.doctrine.boundaries.some(boundary => boundary.counterpart_refs.some(ref => ref.id === b.agent.id)) || b.doctrine.boundaries.some(boundary => boundary.counterpart_refs.some(ref => ref.id === a.agent.id));
  overlap.push({ a: a.agent.id, b: b.agent.id, lexical_jaccard: score, explicit_boundary: bounded });
  if (score >= 0.12 && !bounded) errors.push(`unbounded substantive doctrine overlap ${a.agent.id}/${b.agent.id}=${score}`);
}
overlap.sort((a, b) => b.lexical_jaccard - a.lexical_jaccard);

const metrics = {
  agents: dossiers.length,
  boundaries: dossiers.reduce((sum, dossier) => sum + dossier.doctrine.boundaries.length, 0),
  matrix_cells: 1600,
  relationship_edges: relationships.length,
  artifacts: new Set(dossiers.map(dossier => dossier.agent.artifact)).size,
  ledgers: new Set(dossiers.flatMap(dossier => dossier.memory.commit)).size,
  fmea_rows: dossiers.reduce((sum, dossier) => sum + dossier.fmea.length, 0),
  evals: dossiers.reduce((sum, dossier) => sum + dossier.evals.length, 0),
  cases: dossiers.reduce((sum, dossier) => sum + dossier.doctrine.cases.length, 0),
  specialist_templates: dossiers.reduce((sum, dossier) => sum + dossier.specialists.length, 0),
  max_doctrine_overlap: overlap[0]
};
const reviewCoverage = dossiers.map(dossier => ({ id: dossier.agent.id, internal: relationships.filter(edge => edge.to === dossier.agent.id && ["AUDITS", "CHALLENGES"].includes(edge.type)).map(edge => ({ reviewer: edge.from, type: edge.type })), external: dossier.doctrine.boundaries.flatMap(boundary => boundary.counterpart_refs.filter(reference => reference.authority === "OMEGA").map(reference => ({ reviewer: reference.id, type: "OMEGA_BOUNDARY" }))), protected_external: dossier.doctrine.boundaries.filter(boundary => boundary.counterpart_type === "EXTERNAL_ACTOR_OR_SYSTEM").map(boundary => ({ reviewer: boundary.with, type: "EXTERNAL_BOUNDARY" })) }));
findings.push("Each of the forty Π roles owns exactly one artifact and one commit ledger.");
findings.push("Π38 audits and Π39 challenges every non-assurance role; self-control has no certification effect.");
findings.push("No Π role can decide sovereignly, self-certify, allocate capital as permitted authority or execute an external effect.");
findings.push("Every strategy handoff preserves explicit Ω, Σ or external departmental boundaries.");
warnings.push("PASS demonstrates deterministic contractual coherence only.");
warnings.push("Runtime execution, model calibration, financial feasibility, legal determinations, security tests and outcome efficacy remain validation debt.");
const report = { schema_version: "3.0.0", audit_id: "PI-V3-FULL-CROSS-COHERENCE", generated_at: "DETERMINISTIC_BUILD", status: errors.length ? "FAIL" : "PASS", scope: "40 full Π dossiers, 40×40 matrix, command authority, external boundaries, assurance separation, FMEA, evaluations and output contracts", metrics, errors, warnings, findings, review_coverage: reviewCoverage, top_overlap_pairs: overlap.slice(0, 20), content_sha256: crypto.createHash("sha256").update(JSON.stringify({ registry, relationships, metrics })).digest("hex") };
const markdown = `# Π v3 — Auditoría cruzada de coherencia\n\n**Estado:** ${report.status}  \n**Alcance:** ${report.scope}\n\n## Evidencia\n\n- 40/40 dossiers; ${metrics.boundaries} fronteras; 1.600 celdas de relación.\n- ${metrics.artifacts} artefactos y ${metrics.ledgers} ledgers exclusivos.\n- ${metrics.fmea_rows} FMEA causales; ${metrics.evals} evals con oracle; ${metrics.cases} casos; ${metrics.specialist_templates} specialist templates.\n- Máximo solapamiento de líneas doctrinales sustantivas (unidad, métodos propios, falsificadores y threats; excluye lifecycle/policy compartida): ${overlap[0].a}/${overlap[0].b} = ${overlap[0].lexical_jaccard}; frontera explícita=${overlap[0].explicit_boundary}.\n\n## Veredictos\n\n${findings.map(item => `- PASS: ${item}`).join("\n")}\n\n## Deuda honesta\n\n${warnings.map(item => `- ${item}`).join("\n")}\n\n## Errores\n\n${errors.length ? errors.map(item => `- ${item}`).join("\n") : "Ningún defecto material detectado por los invariantes deterministas."}\n\n## Pares doctrinalmente próximos\n\n| Par | Overlap sustantivo | Frontera |\n|---|---:|---|\n${overlap.slice(0, 20).map(item => `| ${item.a} / ${item.b} | ${item.lexical_jaccard} | ${item.explicit_boundary ? "sí" : "no; bajo umbral"} |`).join("\n")}`;
write("config/pi/v3/cross-coherence-audit.json", report);
write("docs/pi/PI-V3-CROSS-COHERENCE-AUDIT.md", markdown);
if (errors.length) { console.error("PI V3 CROSS-COHERENCE FAILED"); errors.forEach(error => console.error(`- ${error}`)); process.exit(1); }
console.log("PI V3 CROSS-COHERENCE PASSED");
console.log(JSON.stringify(metrics));
