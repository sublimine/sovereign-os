import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = file => JSON.parse(fs.readFileSync(path.join(root, file), "utf8"));
const errors = [];
const registry = read("config/departments/registry.json");
const simulationAudit = read("config/departments/simulation-audit.json");
const relationshipMatrix = read("config/departments/relationship-matrix.json");
if (registry.totals.departments !== 5 || registry.totals.agents !== 50) errors.push("expected five departments and fifty agents");
if (simulationAudit.simulations.length !== 10 || simulationAudit.simulations.some(simulation => simulation.agents.length !== 5 || !simulation.oracle || simulation.invariants.length < 3)) errors.push("simulation coverage is incomplete");
if (relationshipMatrix.relations.length !== 52 || relationshipMatrix.relations.some(relation => !relation.invariant || !relation.type)) errors.push("relationship coverage is incomplete");
const ids = new Set(); const artifacts = new Set();
for (const department of registry.departments) {
  const dept = read(`config/departments/${department.id}/registry.json`);
  if (dept.agents.length !== 10) errors.push(`${department.id} does not have ten agents`);
  for (const item of dept.agents) {
    const agent = read(`config/departments/${department.id}/agents/${item.id}.json`);
    const dossier = path.join(root, `docs/departments/${department.id}/agents/${item.id}.md`);
    const schema = path.join(root, `schemas/departments/${department.id}/${item.id}.schema.json`);
    if (ids.has(item.id)) errors.push(`duplicate agent ${item.id}`); ids.add(item.id);
    if (artifacts.has(agent.agent.artifact)) errors.push(`duplicate artifact ${agent.agent.artifact}`); artifacts.add(agent.agent.artifact);
    if (agent.workflow.states.length < 7 || agent.quality_gates.length < 6 || agent.fmea.length < 16 || agent.evals.length < 16) errors.push(`${item.id} lacks operational depth`);
    if (!agent.authority.deny.includes("SELF_CERTIFY") || !agent.control.independent_review_required) errors.push(`${item.id} lacks independent-review control`);
    const doctrine = agent.operating_doctrine;
    if (!doctrine || typeof doctrine.method !== "string" || doctrine.method.length < 24 || typeof doctrine.evidence_required !== "string" || doctrine.evidence_required.length < 24 || typeof doctrine.falsifier !== "string" || doctrine.falsifier.length < 24 || typeof doctrine.handoff_condition !== "string" || doctrine.handoff_condition.length < 5 || typeof doctrine.acceptance !== "string" || doctrine.acceptance.length < 24) errors.push(`${item.id} lacks role-specific doctrine`);
    if (!fs.existsSync(schema)) errors.push(`${item.id} artifact schema is missing`);
    else {
      const contract = JSON.parse(fs.readFileSync(schema, "utf8"));
      if (contract.title !== agent.agent.artifact || contract.additionalProperties !== false || !agent.output_contract.required.every(field => contract.required.includes(field)) || !contract.$defs?.evidence_ref || !contract.$defs?.unknown || !contract.$defs?.gate_receipt || contract.properties?.status?.enum?.length !== 5 || contract.properties?.result?.type !== "object") errors.push(`${item.id} artifact schema is weak`);
    }
    if (!fs.existsSync(dossier) || fs.readFileSync(dossier, "utf8").split(/\r?\n/).length < 150) errors.push(`${item.id} dossier is missing or shallow`);
  }
}
if (errors.length) { console.error("AUTONOMOUS DEPARTMENTS FAILED"); errors.forEach(error => console.error(`- ${error}`)); process.exit(1); }
console.log("AUTONOMOUS DEPARTMENTS PASSED");
console.log(JSON.stringify({ departments: registry.totals.departments, agents: ids.size, unique_artifacts: artifacts.size, min_fmea: 16, min_evals: 16 }));
