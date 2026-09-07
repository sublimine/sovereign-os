import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = file => JSON.parse(fs.readFileSync(path.join(root, file), "utf8"));
const hash = file => crypto.createHash("sha256").update(fs.readFileSync(path.join(root, file))).digest("hex");
const write = (file, value) => { const target = path.join(root, file); fs.mkdirSync(path.dirname(target), { recursive: true }); fs.writeFileSync(target, `${JSON.stringify(value, null, 2)}\n`, "utf8"); };
const registry = read("config/departments/registry.json"), dossiers = read("config/departments/v3/dossier-registry.json"), audit = read("config/departments/v3/audit-report.json"), simulations = read("config/departments/v3/simulation-traces.json"), interfaces = read("config/departments/v3/interface-contracts.json"), charters = read("config/departments/v3/department-charters.json");
const agentArtifacts = dossiers.agents.flatMap(item => { const dossier = read(`config/departments/v3/dossiers/${item.id}.json`); return [{ id: `${item.id}:dossier`, file: `config/departments/v3/dossiers/${item.id}.json` }, { id: `${item.id}:dossier_doc`, file: item.documentation }, { id: `${item.id}:charter`, file: dossier.production_charter }]; });
const departmentArtifacts = charters.departments.map(item => ({ id: `${item.id}:department_charter`, file: item.charter }));
const artifacts = [...agentArtifacts, ...departmentArtifacts].map(item => ({ ...item, sha256: hash(item.file) }));
const conditions = [
  { id: "FIFTY_AGENTS", pass: registry.totals.agents === 50 && dossiers.agents.length === 50 },
  { id: "ROLE_UNIQUENESS", pass: audit.metrics.unique_artifacts === 50 && audit.metrics.unique_methods === 50 },
  { id: "CAUSAL_DEPTH", pass: audit.metrics.fmea >= 1750 && audit.metrics.evals >= 2250 },
  { id: "SIMULATION_COVERAGE", pass: simulations.simulations.length === 10 && new Set(simulations.simulations.flatMap(x => x.agents)).size === 50 },
  { id: "BOUNDED_INTERFACES", pass: interfaces.interfaces.length === 7 && interfaces.interfaces.every(x => x.transfer.authority.startsWith("NONE")) },
  { id: "MUTATION_RESISTANCE", pass: audit.metrics.detected_mutations === audit.metrics.mutations && audit.metrics.mutations === 6 },
  { id: "CHARTER_COVERAGE", pass: charters.departments.length === 5 && artifacts.length === 155 }
];
const release = { release_id: "autonomous-departments-v3-rc1", status: conditions.every(x => x.pass) ? "READY_FOR_INDEPENDENT_REVIEW" : "BLOCKED", maturity: "V3_CONTRACTUALLY_SPECIFIED_DETERMINISTICALLY_AUDITED", independent_audit: false, metrics: { ...audit.metrics, simulations: simulations.simulations.length, department_charters: charters.departments.length, hashed_artifacts: artifacts.length }, conditions, independent_reviewer_must_verify: ["execution against real data and tools", "evidence quality and domain fitness", "authority holder approval for any external effect", "adversarial review outside this generation path"], artifacts };
write("config/departments/v3/release-candidate.json", release);
if (release.status !== "READY_FOR_INDEPENDENT_REVIEW") { console.error("AUTONOMOUS V3 RELEASE BLOCKED"); process.exit(1); }
console.log("AUTONOMOUS V3 RELEASE CANDIDATE READY");
console.log(JSON.stringify(release.metrics));
