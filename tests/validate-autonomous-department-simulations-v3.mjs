import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const trace = JSON.parse(fs.readFileSync(path.join(root, "config/departments/v3/simulation-traces.json"), "utf8"));
const errors = [];
if (trace.status !== "DETERMINISTIC_SPECIFIED_PENDING_INDEPENDENT_EXECUTION" || trace.simulations.length !== 10) errors.push("simulation registry invalid");
const coverage = new Set();
for (const simulation of trace.simulations) {
  if (simulation.agents.length !== 5 || simulation.events.length !== 30 || simulation.invariants.length !== 5 || !simulation.scenario.oracle) errors.push(`${simulation.id} shallow`);
  for (const id of simulation.agents) {
    coverage.add(id);
    const events = simulation.events.filter(e => e.agent === id);
    if (events.map(e => e.state).join(",") !== "ADMIT,FRAME,EXECUTE_METHOD,CHALLENGE,VERIFY," + events.at(-1).state) errors.push(`${simulation.id}:${id} invalid state trace`);
    if (events.at(-1).state === "COMPLETE" || !["RETURN", "BLOCKED"].includes(events.at(-1).state) || !events.some(e => e.receipt === "FALSIFIER_RECEIPT") || !events.some(e => e.receipt === "INDEPENDENT_GATE_RECEIPT")) errors.push(`${simulation.id}:${id} unsafe terminal`);
  }
}
if (coverage.size !== 50) errors.push("not all agents simulated");
if (errors.length) { console.error("AUTONOMOUS V3 SIMULATIONS FAILED"); errors.forEach(x => console.error(`- ${x}`)); process.exit(1); }
console.log("AUTONOMOUS V3 SIMULATIONS PASSED");
console.log(JSON.stringify({ simulations: trace.simulations.length, events: trace.simulations.reduce((n, s) => n + s.events.length, 0), roles_covered: coverage.size, complete_terminals: 0 }));
