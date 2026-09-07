import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = file => JSON.parse(fs.readFileSync(path.join(root, file), "utf8"));
const registry = read("config/departments/v3/dossier-registry.json");
const errors = [];
if (registry.status !== "SPECIFIED_PENDING_INDEPENDENT_CERTIFICATION" || registry.agents.length !== 50) errors.push("V3 registry is incomplete or overclaims certification");
for (const entry of registry.agents) {
  const dossier = read(`config/departments/v3/dossiers/${entry.id}.json`);
  const doc = path.join(root, entry.documentation);
  const charter = path.join(root, dossier.production_charter);
  if (dossier.maturity !== "V3_CONTRACTUALLY_SPECIFIED_PENDING_INDEPENDENT_CERTIFICATION") errors.push(`${entry.id} maturity is invalid`);
  if (dossier.workflow.length !== 7 || dossier.gates.length !== 8 || dossier.variables.length < 6) errors.push(`${entry.id} lacks V3 operational structure`);
  if (dossier.fmea.length < 35 || dossier.evals.length < 45) errors.push(`${entry.id} lacks V3 causal/adversarial depth`);
  if (!dossier.fmea.every(f => typeof f.role_anchor === "string" && f.mechanism.includes(f.role_anchor)) || !dossier.evals.every(e => e.setup.includes("control anchor") || e.setup.includes(dossier.operating_doctrine.method))) errors.push(`${entry.id} lacks role-anchored causal depth`);
  if (!dossier.decision_rights.some(x => x.action === "self certify" && x.status === "DENY")) errors.push(`${entry.id} can self certify`);
  if (!fs.existsSync(charter) || fs.readFileSync(charter, "utf8").split(/\r?\n/).length < 45 || !fs.readFileSync(charter, "utf8").includes(dossier.operating_doctrine.method) || !fs.readFileSync(charter, "utf8").includes(dossier.operating_doctrine.falsifier)) errors.push(`${entry.id} production charter is weak`);
  if (!fs.existsSync(doc) || fs.readFileSync(doc, "utf8").split(/\r?\n/).length < 500) errors.push(`${entry.id} V3 dossier is shallow`);
}
if (errors.length) { console.error("AUTONOMOUS DEPARTMENTS V3 FAILED"); errors.forEach(x => console.error(`- ${x}`)); process.exit(1); }
console.log("AUTONOMOUS DEPARTMENTS V3 PASSED");
console.log(JSON.stringify({ dossiers: registry.agents.length, min_fmea: 35, min_evals: 45, min_lines: 500, independent_certification: false }));
