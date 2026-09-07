import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const data = JSON.parse(fs.readFileSync(path.join(root, "config/departments/v3/department-charters.json"), "utf8"));
const errors = [];
if (data.status !== "SPECIFIED_PENDING_INDEPENDENT_CERTIFICATION" || data.departments.length !== 5) errors.push("five department charters required");
for (const charter of data.departments) {
  const file = path.join(root, charter.charter);
  if (charter.agents !== 10 || charter.artifacts !== 10 || charter.risks !== 4 || charter.simulations !== 2 || !fs.existsSync(file) || fs.readFileSync(file, "utf8").split(/\r?\n/).length < 55) errors.push(`${charter.id} charter incomplete`);
}
if (errors.length) { console.error("AUTONOMOUS DEPARTMENT CHARTERS FAILED"); errors.forEach(x => console.error(`- ${x}`)); process.exit(1); }
console.log("AUTONOMOUS DEPARTMENT CHARTERS PASSED");
console.log(JSON.stringify({ charters: data.departments.length, agents: 50, risks: 20 }));
