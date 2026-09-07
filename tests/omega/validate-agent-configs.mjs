import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const dir = path.join(root, "config", "agents");
const errors = [];
const ids = new Set();
const required = [
  "schema_version","extends","production_ref","agent","mission","authority","activation","workflow",
  "delegation","model_routing","context","memory","quality_gates",
  "output_contract","escalation","failure_focus","security","termination"
];
const agentRequired = ["id","number","name","short_name","category","class","superior","independence","jurisdiction","documentation"];
const evals = JSON.parse(fs.readFileSync(path.join(root, "tests", "omega", "evaluation-cases.json"), "utf8"));
const evalMap = new Map(evals.agents.map(x => [x.id, x.specific]));
const base = JSON.parse(fs.readFileSync(path.join(dir, "_base-policy.json"), "utf8"));
if (base.defaults.minimum_evaluations.length < 12) errors.push("base has fewer than 12 evaluations");
if (base.schema_version !== "2.0.0") errors.push("base schema_version is not 2.0.0");
if (!base.standard_ref.endsWith("#2.0.0")) errors.push("base standard_ref is not v2");

for (let i = 1; i <= 24; i++) {
  const n = String(i).padStart(2, "0");
  const file = path.join(dir, "omega-" + n + ".json");
  let c;
  try { c = JSON.parse(fs.readFileSync(file, "utf8")); }
  catch (e) { errors.push("invalid config " + n + ": " + e.message); continue; }
  for (const k of required) if (!(k in c)) errors.push("omega-" + n + " missing " + k);
  if (c.schema_version !== "2.0.0") errors.push("omega-" + n + " schema_version is not 2.0.0");
  if (c.extends !== "_base-policy.json") errors.push("omega-" + n + " wrong extends");
  if (c.production_ref !== `../production-charters.json#/agents/${i - 1}`) errors.push("omega-" + n + " wrong production_ref");
  for (const k of agentRequired) if (!(k in c.agent)) errors.push("omega-" + n + " agent missing " + k);
  if (c.agent.number !== i) errors.push("omega-" + n + " wrong number");
  if (c.agent.id !== "omega_" + n) errors.push("omega-" + n + " wrong id");
  if (ids.has(c.agent.id)) errors.push("duplicate id " + c.agent.id);
  ids.add(c.agent.id);
  const doc = path.join(root, c.agent.documentation);
  if (!fs.existsSync(doc)) errors.push(c.agent.id + " documentation missing");
  if (!Array.isArray(c.quality_gates) || c.quality_gates.length < 1) errors.push(c.agent.id + " no gates");
  if (!Array.isArray(c.failure_focus) || c.failure_focus.length < 3) errors.push(c.agent.id + " shallow failure focus");
  if (!Array.isArray(c.delegation.specialists)) errors.push(c.agent.id + " no specialists");
  if (c.delegation.max_depth > 4) errors.push(c.agent.id + " max depth >4");
  if (!evalMap.has(c.agent.id) || evalMap.get(c.agent.id).length < 4) errors.push(c.agent.id + " missing specific evals");
  if (!Array.isArray(c.memory.commit)) errors.push(c.agent.id + " memory commit not explicit");
  if (!Array.isArray(c.authority.deny) || c.authority.deny.length < 1) errors.push(c.agent.id + " no explicit denial");
}

if (evalMap.size !== 24) errors.push("evaluation cases count is not 24");
if (errors.length) {
  console.error("AGENT CONFIG VALIDATION FAILED");
  errors.forEach(e => console.error("- " + e));
  process.exit(1);
}
console.log("AGENT CONFIG VALIDATION PASSED");
console.log(JSON.stringify({agents:ids.size, inherited_evals:base.defaults.minimum_evaluations.length, specific_evals_per_agent:4}));
