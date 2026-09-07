import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const data = JSON.parse(fs.readFileSync(path.join(root, "config/departments/v3/interface-contracts.json"), "utf8"));
const errors = [];
if (data.status !== "SPECIFIED_PENDING_INDEPENDENT_CERTIFICATION" || data.interfaces.length !== 7) errors.push("expected seven bounded interfaces");
for (const item of data.interfaces) {
  if (item.producer.department === item.consumer.department) errors.push(`${item.id} is not cross-department`);
  if (item.transfer.authority !== "NONE; consumer retains only its pre-existing authority") errors.push(`${item.id} transfers authority`);
  if (item.envelope.required.length < 12 || item.envelope.preserve.length < 5 || item.envelope.reject.length < 5) errors.push(`${item.id} has a weak envelope`);
  if (!item.transfer.correction.includes("superseding version") || !item.transfer.acknowledgement.includes("receipt")) errors.push(`${item.id} lacks causal correction`);
}
if (errors.length) { console.error("AUTONOMOUS INTERFACES FAILED"); errors.forEach(x => console.error(`- ${x}`)); process.exit(1); }
console.log("AUTONOMOUS INTERFACES PASSED");
console.log(JSON.stringify({ interfaces: data.interfaces.length, authority_transfer: false, causal_correction: true }));
