import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const errors = [];
const readJson = relative => JSON.parse(fs.readFileSync(path.join(root, relative), "utf8"));

function walk(relative) {
  const absolute = path.join(root, relative);
  return fs.readdirSync(absolute, { withFileTypes: true }).flatMap(entry => {
    const child = path.join(relative, entry.name);
    return entry.isDirectory() ? walk(child) : [child];
  });
}

const jsonFiles = ["config", "schemas", "tests/omega/fixtures"]
  .flatMap(walk)
  .filter(file => file.endsWith(".json"));
for (const file of jsonFiles) {
  try { readJson(file); }
  catch (error) { errors.push(`${file} invalid JSON: ${error.message}`); }
}

const textFiles = ["docs", "config", "schemas", "src", "visual"]
  .flatMap(walk)
  .filter(file => /\.(?:md|json|mjs|ts|html)$/.test(file));
const encodingArtifacts = ["\uFFFD", "Ã", "Î©", "Â·", "â€”", "â€“", "â†’"];
for (const file of textFiles) {
  const text = fs.readFileSync(path.join(root, file), "utf8");
  for (const token of encodingArtifacts) {
    if (text.includes(token)) errors.push(`${file} contains encoding artifact ${JSON.stringify(token)}`);
  }
  if (/\b(?:TODO|TBD|FIXME)\b/.test(text)) errors.push(`${file} contains unresolved placeholder marker`);
}

// Ω schemas remain at schemas/*.json; department-specific schemas live in
// namespaced subdirectories and are validated by their own release suites.
const schemaFiles = fs.readdirSync(path.join(root, "schemas"), { withFileTypes: true })
  .filter(entry => entry.isFile() && entry.name.endsWith(".json"))
  .map(entry => path.join("schemas", entry.name));
if (schemaFiles.length !== 28) errors.push(`schema count ${schemaFiles.length} != 28`);
const schemaIds = new Set();
for (const file of schemaFiles) {
  const schema = readJson(file);
  if (schema.$schema !== "https://json-schema.org/draft/2020-12/schema") errors.push(`${file} is not JSON Schema 2020-12`);
  if (!schema.$id) errors.push(`${file} missing $id`);
  else if (schemaIds.has(schema.$id)) errors.push(`${file} duplicates $id ${schema.$id}`);
  else schemaIds.add(schema.$id);
}

const catalog = readJson("config/production-charters.json");
const release = readJson("config/release-certification-v2.json");
const evals = readJson("tests/omega/eval-battery-v2.json");
const fmea = readJson("config/fmea-v2.json");
const simulations = readJson("tests/omega/fixtures/simulations-v2.json");
if (catalog.agents.length !== 24) errors.push("production charter catalog is not 24 agents");
if (!fs.existsSync(path.join(root, catalog.kernel.path))) errors.push("production kernel path is missing");
for (let index = 0; index < catalog.agents.length; index += 1) {
  const entry = catalog.agents[index];
  const number = String(index + 1).padStart(2, "0");
  const overlay = readJson(`config/agents/omega-${number}.json`);
  if (!fs.existsSync(path.join(root, entry.path))) errors.push(`${entry.id} production charter path is missing`);
  if (overlay.agent.id !== entry.id) errors.push(`${entry.id} overlay/catalog identity mismatch`);
  if (overlay.production_ref !== `../production-charters.json#/agents/${index}`) errors.push(`${entry.id} production reference mismatch`);
}

const effectiveEvals = Object.values(evals.agents).reduce((total, cases) => total + evals.common.length + cases.length, 0);
const fmeaRows = Object.values(fmea.agent_profile_sequence).reduce((total, profiles) => total + profiles.length, 0);
const eventTraces = simulations.simulations.reduce((total, simulation) => total + simulation.events.length, 0);
if (effectiveEvals !== 576 || release.agent_coverage.effective_evals !== effectiveEvals) errors.push(`effective eval mismatch: ${effectiveEvals}`);
if (fmeaRows !== 192 || release.agent_coverage.fmea_rows !== fmeaRows) errors.push(`FMEA mismatch: ${fmeaRows}`);
if (eventTraces !== 98) errors.push(`simulation event mismatch: ${eventTraces}`);

const manifest = fs.readFileSync(path.join(root, "RELEASE-MANIFEST.md"), "utf8");
for (const statement of ["28 JSON Schema", "192 effective role FMEA", "98 validated events", "576 effective eval cases"]) {
  if (!manifest.includes(statement)) errors.push(`release manifest missing metric: ${statement}`);
}
const dashboard = fs.readFileSync(path.join(root, "visual", "omega-command-center.html"), "utf8");
for (const statement of [">576<", ">192<", ">98<", ">D2<", "D2 DETERMINISTIC TESTED"]) {
  if (!dashboard.includes(statement)) errors.push(`dashboard missing v2 evidence: ${statement}`);
}
if (!dashboard.includes("D2 no implica evaluación real de modelos ni producción")) errors.push("dashboard omits D2 scope warning");

if (errors.length) {
  console.error("FINAL INTEGRITY V2 VALIDATION FAILED");
  errors.forEach(error => console.error(`- ${error}`));
  process.exit(1);
}
console.log("FINAL INTEGRITY V2 VALIDATION PASSED");
console.log(JSON.stringify({json_files:jsonFiles.length, schemas:28, charters:24, effective_evals:effectiveEvals, fmea_rows:fmeaRows, simulation_events:eventTraces, encoding_clean:true}));
