import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const data = JSON.parse(fs.readFileSync(path.join(root, "config", "relationships.json"), "utf8"));
const errors = [];
const validIds = new Set(Array.from({length:24}, (_,i) => "omega_" + String(i+1).padStart(2,"0")));
const validCodes = new Set(["C","R","Q","V","A","H","B","E","F","I"]);
const pairs = new Set();
for (const e of data.edges) {
  if (!validIds.has(e.from) || !validIds.has(e.to)) errors.push("invalid endpoint " + JSON.stringify(e));
  if (e.from === e.to) errors.push("self edge not allowed " + e.from);
  const key = e.from + ">" + e.to;
  if (pairs.has(key)) errors.push("duplicate pair " + key);
  pairs.add(key);
  for (const r of e.relations) if (!validCodes.has(r)) errors.push("invalid relation " + r);
}
for (let i = 1; i <= 24; i++) {
  const id = "omega_" + String(i).padStart(2,"0");
  if (![1,2,3].includes(i) && !data.edges.some(e => e.from === "omega_02" && e.to === id && e.relations.includes("C"))) {
    errors.push("omega_02 lacks mission command edge to " + id);
  }
}
for (let i = 1; i <= 24; i++) {
  if (i === 3) continue;
  const id = "omega_" + String(i).padStart(2,"0");
  if (!data.edges.some(e => e.from === "omega_03" && e.to === id && e.relations.includes("A"))) {
    errors.push("omega_03 lacks audit edge to " + id);
  }
}
if (!data.edges.some(e => e.from==="omega_01" && e.to==="omega_03" && e.relations.includes("I"))) errors.push("omega_01/03 independence missing");
if (!data.edges.some(e => e.from==="omega_19" && e.to==="omega_17" && e.relations.includes("B"))) errors.push("risk veto edge missing");
if (!data.edges.some(e => e.from==="omega_21" && e.to==="omega_24" && e.relations.includes("B"))) errors.push("change authority block missing");

const matrix = fs.readFileSync(path.join(root, "docs", "omega", "13-OMEGA-RELATIONSHIP-MATRIX.md"), "utf8");
const rows = matrix.split(/\r?\n/).filter(l => /^\| (0[1-9]|1[0-9]|2[0-4]) \|/.test(l));
if (rows.length !== 24) errors.push("matrix row count " + rows.length);
const edgeMap = new Map(data.edges.map(e => [e.from + ">" + e.to, [...e.relations].sort().join("/")]));
for (const row of rows) {
  const cells = row.split("|").slice(1,-1).map(x => x.trim());
  if (cells.length !== 25) errors.push("matrix row cell count " + cells[0] + "=" + cells.length);
  const from = "omega_" + cells[0];
  for (let col=1; col<=24; col++) {
    const to = "omega_" + String(col).padStart(2,"0");
    const shown = cells[col];
    if (from === to) {
      if (shown !== "S") errors.push("matrix diagonal must be S at " + from);
      continue;
    }
    const actual = edgeMap.get(from + ">" + to);
    if (!actual && shown !== "·") errors.push("matrix has undocumented edge " + from + ">" + to + "=" + shown);
    if (actual) {
      const normalized = shown.split("/").sort().join("/");
      if (normalized !== actual) errors.push("matrix drift " + from + ">" + to + " shown=" + normalized + " source=" + actual);
    }
  }
}

if (errors.length) {
  console.error("RELATIONSHIP VALIDATION FAILED");
  errors.forEach(e => console.error("- " + e));
  process.exit(1);
}
console.log("RELATIONSHIP VALIDATION PASSED");
console.log(JSON.stringify({directed_edges:data.edges.length, matrix:"24x24"}));
