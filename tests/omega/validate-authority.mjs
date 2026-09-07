import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const data = JSON.parse(fs.readFileSync(path.join(root, "config", "authority-actions.json"), "utf8"));
const registry = JSON.parse(fs.readFileSync(path.join(root, "config", "agent-registry.json"), "utf8"));
const errors = [];
const codes = new Set(["P","C","X","A"]);
if (data.actions.length !== 19) errors.push("expected 19 authority actions");
for (let i=1;i<=24;i++) {
  const id = "omega_" + String(i).padStart(2,"0");
  const row = data.agents[id];
  if (!row) { errors.push("missing authority row "+id); continue; }
  const keys = Object.keys(row);
  if (keys.length !== data.actions.length) errors.push(id+" action count "+keys.length);
  for (const action of data.actions) {
    if (!(action in row)) errors.push(id+" missing action "+action);
    else if (!codes.has(row[action])) errors.push(id+" invalid code "+row[action]);
  }
}
if (Object.keys(data.agents).length !== 24) errors.push("authority row count not 24");
if (registry.agents.length !== 24) errors.push("registry count not 24");
const regIds = new Set(registry.agents.map(a=>a.id));
if (regIds.size !== 24) errors.push("duplicate registry IDs");
for (const a of registry.agents) {
  for (const key of ["superior","subordinates","peers","independence"]) if (!(key in a)) errors.push(a.id+" registry missing "+key);
}
if (data.agents.omega_24.approve !== "X") errors.push("omega_24 must not approve own change");
if (data.agents.omega_03.bypass_hierarchy !== "P") errors.push("omega_03 protected oversight route missing");
if (data.agents.omega_01.access_secrets !== "A") errors.push("omega_01 must not gain secrets by title");
if (errors.length) {
  console.error("AUTHORITY VALIDATION FAILED");
  errors.forEach(e=>console.error("- "+e));
  process.exit(1);
}
console.log("AUTHORITY VALIDATION PASSED");
console.log(JSON.stringify({agents:24, actions_per_agent:19, explicit_decisions:456}));

