import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { genesis } from "../../scripts/pi-v3/genesis.mjs";
import { decisionArenas } from "../../scripts/pi-v3/decision-arenas.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const errors = [];
const entries = Object.entries(genesis);
if (entries.length !== 40) errors.push("Π requires exactly forty genesis contracts");
for (let number = 1; number <= 40; number++) {
  const id = `pi_${String(number).padStart(2, "0")}`;
  const contract = genesis[id];
  if (!contract) { errors.push(`missing ${id}`); continue; }
  for (const field of ["question", "proof", "conflict"]) {
    if (typeof contract[field] !== "string" || contract[field].trim().length < 30) errors.push(`${id}.${field} is not substantive`);
  }
}
for (const field of ["question", "proof", "conflict"]) {
  const seen = new Map();
  for (const [id, contract] of entries) {
    const normalized = contract[field].toLocaleLowerCase("es").replace(/[^a-záéíóúüñ0-9]+/g, " ").trim();
    if (seen.has(normalized)) errors.push(`duplicated ${field}: ${id} and ${seen.get(normalized)}`);
    seen.set(normalized, id);
  }
}
if (decisionArenas.length !== 8) errors.push("exactly eight decision arenas are required");
const arenaParticipation = new Map(entries.map(([id]) => [id, 0]));
for (const arena of decisionArenas) {
  for (const field of ["decision", "sovereign_consumer", "lead", "required_conflict"]) {
    const minimum = field === "lead" ? 5 : 20;
    if (typeof arena[field] !== "string" || arena[field].trim().length < minimum) errors.push(`${arena.id}.${field} is incomplete`);
  }
  if (!Array.isArray(arena.participants) || arena.participants.length < 10) errors.push(`${arena.id} has insufficient deliberation coverage`);
  if (!Array.isArray(arena.cannot_close_without) || arena.cannot_close_without.length < 3) errors.push(`${arena.id} has no real closure conditions`);
  for (const id of arena.participants || []) {
    if (!arenaParticipation.has(id)) errors.push(`${arena.id} references unknown participant ${id}`);
    else arenaParticipation.set(id, arenaParticipation.get(id) + 1);
  }
}
for (const [id, count] of arenaParticipation) if (!count) errors.push(`${id} has no decision arena`);
const council = fs.readFileSync(path.join(root, "docs/pi/06-PI-COUNCIL-OPERATING-SYSTEM.md"), "utf8");
const map = fs.readFileSync(path.join(root, "docs/pi/07-PI-AGENT-GENESIS-MAP.md"), "utf8");
for (const token of ["Framing session", "Option underwriting", "Decision-readiness review", "Reconsideration session", "READY_WITH_DISSENT", "BLOCKED_ASSURANCE", "Π38", "Π39"]) {
  if (!council.includes(token)) errors.push(`council operating system missing ${token}`);
}
for (let number = 1; number <= 40; number++) if (!map.includes(`Π${String(number).padStart(2, "0")}`)) errors.push(`genesis map missing Π${number}`);
if (errors.length) {
  console.error("PI COUNCIL FOUNDATION FAILED");
  errors.forEach(error => console.error(`- ${error}`));
  process.exit(1);
}
console.log("PI COUNCIL FOUNDATION PASSED");
console.log(JSON.stringify({ council_seats: 9, conditional_seats: 2, assurance_organs: 2, genesis_contracts: entries.length, decision_arenas: decisionArenas.length, non_interchangeability_checks: entries.length * 3 }));
