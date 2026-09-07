import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = relative => JSON.parse(fs.readFileSync(path.join(root, relative), "utf8"));
const hash = relative => crypto.createHash("sha256").update(fs.readFileSync(path.join(root, relative))).digest("hex");
const required = [
  "docs/pi/00-PI-CONSTITUTION.md",
  "docs/pi/01-PI-SYSTEM-ARCHITECTURE.md",
  "docs/pi/agents/AGENT-DOSSIER-V3-STANDARD.md",
  "config/pi/v3/dossier-registry.json",
  "config/pi/v3/relationship-matrix.json",
  "config/pi/v3/cross-coherence-audit.json",
  "tests/pi/v3-eval-battery.json",
  "config/pi/v3/simulation-audit.json",
  "visual/pi-strategy-center.html"
];
const missing = required.filter(relative => !fs.existsSync(path.join(root, relative)));
if (missing.length) {
  console.error("PI RELEASE CERTIFICATION REFUSED");
  missing.forEach(relative => console.error(`- missing ${relative}`));
  process.exit(1);
}

const registry = read("config/pi/v3/dossier-registry.json");
const audit = read("config/pi/v3/cross-coherence-audit.json");
const simulation = read("config/pi/v3/simulation-audit.json");
const evals = read("tests/pi/v3-eval-battery.json");
const commandCenter = fs.readFileSync(path.join(root, "visual/pi-strategy-center.html"), "utf8");
const metrics = audit.metrics || {};
const errors = [];
if (audit.status !== "PASS") errors.push("cross coherence audit is not PASS");
if (registry.agents?.length !== 40 || metrics.agents !== 40) errors.push("exactly forty Π dossiers are required");
if (metrics.matrix_cells !== 1600 || metrics.artifacts !== 40 || metrics.ledgers !== 40) errors.push("matrix, artifacts or ledgers are incomplete");
if (metrics.boundaries < 480 || metrics.fmea_rows < 800 || metrics.evals < 640 || metrics.specialist_templates < 200) errors.push("assurance coverage below the Π v3 floor");
if (simulation.status !== "PASS" || simulation.metrics?.simulations !== 10) errors.push("ten conceptual simulations are required");
if (evals.count !== metrics.evals) errors.push("evaluation battery does not reconcile with audit");
if (!commandCenter.includes("40") || !commandCenter.includes("pi_40")) errors.push("command center does not expose all forty roles");
if (errors.length) {
  console.error("PI RELEASE CERTIFICATION REFUSED");
  errors.forEach(error => console.error(`- ${error}`));
  process.exit(1);
}

const certification = {
  release_id: "pi-architecture-3.0.0-s2-v3",
  version: "3.0.0",
  maturity: "S2_PI_V3_DETERMINISTICALLY_AUDITED",
  status: "PASS",
  certified_at: new Date().toISOString(),
  scope: "Π Strategy, Portfolio and Transformation: 40 full dossiers, typed contracts, assurance separation, adversarial evaluation specification, simulations and interactive command center.",
  evidence: required.map(file => ({ file, sha256: hash(file), status: "PASS" })),
  metrics: {
    roles: metrics.agents,
    dossiers: registry.agents.length,
    boundaries: metrics.boundaries,
    matrix_cells: metrics.matrix_cells,
    relationship_edges: metrics.relationship_edges,
    unique_artifacts: metrics.artifacts,
    unique_ledgers: metrics.ledgers,
    fmea_rows: metrics.fmea_rows,
    specified_evals: metrics.evals,
    cases: metrics.cases,
    specialist_templates: metrics.specialist_templates,
    simulations: simulation.metrics.simulations
  },
  limitations: [
    "No real-model execution has been scored.",
    "No shadow or production strategy mission has been executed.",
    "No finance, legal, security or operating department has issued a live determination.",
    "No runtime adapter has completed conformance, load or chaos testing.",
    "No empirical business outcome has calibrated the strategy assumptions.",
    "No independent external audit has been performed."
  ],
  validation_debt: audit.warnings,
  independent_audit: "NOT_PERFORMED"
};
fs.writeFileSync(path.join(root, "config/pi/release-certification.json"), JSON.stringify(certification, null, 2) + "\n", "utf8");
const manifest = `# Π release manifest · v3.0.0

**Release:** \`${certification.release_id}\`  
**Status:** ${certification.status}  
**Maturity:** ${certification.maturity}  
**Certified:** ${certification.certified_at}

## Demonstrado

- 40 autoridades con dossier, charter, contrato de salida, artefacto y ledger exclusivos.
- ${metrics.boundaries} fronteras, matriz dirigida 40×40 y ${metrics.relationship_edges} relaciones declaradas.
- ${metrics.fmea_rows} FMEA causales, ${metrics.evals} evaluaciones adversariales especificadas, ${metrics.cases} casos y ${metrics.specialist_templates} misiones efímeras acotadas.
- Diez simulaciones conceptuales y un Command Center interactivo; Π38 audita y Π39 desafía a cada rol no asegurador.

## No demostrado

${certification.limitations.map(item => `- ${item}`).join("\n")}

## Evidencia

${certification.evidence.map(item => `- \`${item.file}\` · \`${item.sha256}\``).join("\n")}
`;
fs.writeFileSync(path.join(root, "docs/pi/PI-RELEASE-MANIFEST.md"), manifest, "utf8");
console.log("PI V3 RELEASE CERTIFIED");
console.log(JSON.stringify({ release_id: certification.release_id, status: certification.status, maturity: certification.maturity, metrics: certification.metrics }));
