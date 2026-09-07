import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const agentsDir = path.join(root, "config", "agents");

for (let index = 0; index < 24; index += 1) {
  const number = String(index + 1).padStart(2, "0");
  const file = path.join(agentsDir, `omega-${number}.json`);
  const document = JSON.parse(fs.readFileSync(file, "utf8"));
  document.schema_version = "2.0.0";
  document.production_ref = `../production-charters.json#/agents/${index}`;
  fs.writeFileSync(file, `${JSON.stringify(document, null, 2)}\n`, "utf8");

  const specificationFile = path.join(root, "docs", "omega", "agents", `omega-${number}.md`);
  let specification = fs.readFileSync(specificationFile, "utf8");
  const v1Header = `**Charter:** OMEGA-${number} v1.0.0`;
  const v2Header = `**Especificación conceptual:** OMEGA-${number} v2.0.0`;
  if (specification.includes(v1Header)) specification = specification.replace(v1Header, v2Header);
  if (!specification.includes(v2Header)) throw new Error(`omega-${number} conceptual specification version is not migratable`);
  fs.writeFileSync(specificationFile, specification, "utf8");
}

const baseFile = path.join(agentsDir, "_base-policy.json");
const base = JSON.parse(fs.readFileSync(baseFile, "utf8"));
base.schema_version = "2.0.0";
base.standard_ref = "docs/omega/agents/AGENT-SPECIFICATION-STANDARD.md#2.0.0";
fs.writeFileSync(baseFile, `${JSON.stringify(base, null, 2)}\n`, "utf8");

console.log(JSON.stringify({ migrated_overlays: 24, migrated_specifications: 24, schema_version: "2.0.0" }));
