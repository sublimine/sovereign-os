import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..", "..");
const errors = [];
const must = p => {
  const full = path.join(root, p);
  if (!fs.existsSync(full)) errors.push("missing: " + p);
  return full;
};

must("README.md");
for (let i = 0; i <= 12; i++) {
  const prefix = String(i).padStart(2, "0") + "-OMEGA-";
  const dir = path.join(root, "docs", "omega");
  const found = fs.readdirSync(dir).some(f => f.startsWith(prefix));
  if (!found) errors.push("missing normative doc prefix " + prefix);
}
[
  "agents", "protocols", "schemas", "decisions", "workflows",
  "failure-modes", "evaluations", "simulations", "examples", "diagrams"
].forEach(d => must(path.join("docs", "omega", d)));

const common = fs.readFileSync(must("docs/omega/agents/AGENT-SPECIFICATION-STANDARD.md"), "utf8");
for (const token of ["input", "output", "FMEA", "Seguridad", "Terminación", "Self-check"]) {
  if (!common.toLowerCase().includes(token.toLowerCase())) errors.push("common standard missing " + token);
}

for (let i = 1; i <= 24; i++) {
  const n = String(i).padStart(2, "0");
  const doc = must("docs/omega/agents/omega-" + n + ".md");
  must("config/agents/omega-" + n + ".json");
  if (fs.existsSync(doc)) {
    const text = fs.readFileSync(doc, "utf8").toLowerCase();
    for (const token of ["identidad", "autoridad", "workflow", "deleg", "fmea", "caso", "charter"]) {
      if (!text.includes(token)) errors.push("omega-" + n + " doc missing token " + token);
    }
  }
}

const schemaDir = path.join(root, "schemas");
const schemas = fs.readdirSync(schemaDir).filter(f => f.endsWith(".json"));
if (schemas.length < 8) errors.push("expected at least 8 schemas");
for (const file of schemas) {
  try { JSON.parse(fs.readFileSync(path.join(schemaDir, file), "utf8")); }
  catch (e) { errors.push("invalid schema JSON " + file + ": " + e.message); }
}

const diagrams = fs.readdirSync(path.join(root, "docs", "omega", "diagrams")).filter(f => f.endsWith(".md"));
if (diagrams.length < 6) errors.push("expected 6 independent diagrams");
const sim = fs.readFileSync(must("docs/omega/simulations/OMEGA-SIMULATIONS-A-G.md"), "utf8");
for (const label of ["## A.", "## B.", "## C.", "## D.", "## E.", "## F.", "## G."]) {
  if (!sim.includes(label)) errors.push("missing simulation " + label);
}

if (errors.length) {
  console.error("REPOSITORY VALIDATION FAILED");
  errors.forEach(e => console.error("- " + e));
  process.exit(1);
}
console.log("REPOSITORY VALIDATION PASSED");
console.log(JSON.stringify({agents:24, schemas:schemas.length, diagrams:diagrams.length, simulations:7}));

