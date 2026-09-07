import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const catalog = JSON.parse(fs.readFileSync(path.join(root, "config", "production-charters.json"), "utf8"));
const authority = JSON.parse(fs.readFileSync(path.join(root, catalog.authority_matrix), "utf8"));
const errors = [];
const sha = data => crypto.createHash("sha256").update(data).digest("hex");

if (catalog.schema_version !== "2.0.0") errors.push("production catalog is not v2");
if (catalog.agents.length !== 24) errors.push("expected 24 production charters");
if (new Set(catalog.agents.map(a => a.id)).size !== 24) errors.push("duplicate production charter IDs");
if (authority.actions.length !== 19) errors.push("authority closure must contain 19 actions");
const kernel = fs.readFileSync(path.join(root, catalog.kernel.path));
if (sha(kernel) !== catalog.kernel.sha256) errors.push("production kernel hash mismatch");
const kernelText = kernel.toString("utf8");

for (let i = 1; i <= 24; i++) {
  const id = "omega_" + String(i).padStart(2, "0");
  const entry = catalog.agents.find(a => a.id === id);
  if (!entry) { errors.push("missing " + id); continue; }
  const full = path.join(root, entry.path);
  if (!fs.existsSync(full)) { errors.push(id + " charter absent"); continue; }
  const raw = fs.readFileSync(full);
  const text = raw.toString("utf8");
  const effective = kernelText + "\n" + text;
  if (sha(raw) !== entry.sha256) errors.push(id + " charter hash mismatch");
  for (let n = 1; n <= catalog.required_sections.length; n++) {
    const expected = "## " + n + ". " + catalog.required_sections[n - 1];
    if (!text.includes(expected)) errors.push(id + " missing section " + n);
  }
  const lineCount = text.split(/\r?\n/).length;
  if (lineCount < 120) errors.push(id + " charter too shallow: " + lineCount + " lines");
  const mustCount = (effective.match(/\bMUST\b/g) || []).length;
  if (mustCount < 24) errors.push(id + " effective charter lacks normative density: " + mustCount);
  for (const term of ["UNKNOWN", "BUDGET", "State transition", "Delegation", "Final self-check"])
    if (!effective.includes(term)) errors.push(id + " missing operational term " + term);
  if (/TODO|TBD|lorem ipsum/i.test(text)) errors.push(id + " contains placeholder");
  const row = authority.agents[id];
  if (!row || Object.keys(row).length !== 19) errors.push(id + " authority closure incomplete");
}

const procedures = new Set(catalog.agents.map(a => a.procedure));
const artifacts = new Set(catalog.agents.map(a => a.primary_artifact));
if (procedures.size !== 24) errors.push("procedures are not unique per agent");
if (artifacts.size !== 24) errors.push("primary artifacts are not unique per agent");
if (errors.length) {
  console.error("PRODUCTION CHARTER VALIDATION FAILED");
  errors.forEach(e => console.error("- " + e));
  process.exit(1);
}
console.log("PRODUCTION CHARTER VALIDATION PASSED");
console.log(JSON.stringify({agents:24, sections_per_agent:16, authority_decisions:456, unique_procedures:procedures.size}));
