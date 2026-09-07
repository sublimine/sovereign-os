import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const file = path.join(root, "visual", "pi-strategy-center.html");
const errors = [];
const html = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "";
if (!html) errors.push("Π command center missing");
for (const token of ["40/40", "720", "1.600", "SovereignDecision", "Doctrina", "Límites", "Inputs", "Workflow", "Delegación", "Autoridad", "Gates", "FMEA", "Evals", "Casos", "Relaciones", "Runtime", "Memoria", "openAgent", "data-agent"]) if (!html.includes(token)) errors.push(`visual missing ${token}`);
for (let number = 1; number <= 40; number++) if (!html.includes(`pi_${String(number).padStart(2, "0")}`)) errors.push(`visual missing pi_${number}`);
const inline = html.match(/<script>([\s\S]*)<\/script>/)?.[1];
if (!inline) errors.push("inline app missing"); else try { new vm.Script(inline, { filename: "pi-command-center.js" }); } catch (error) { errors.push(`invalid JavaScript: ${error.message}`); }
if (Buffer.byteLength(html) < 500_000) errors.push("Π visual payload unexpectedly shallow");
if (errors.length) { console.error("PI COMMAND CENTER FAILED"); errors.forEach(error => console.error(`- ${error}`)); process.exit(1); }
console.log("PI COMMAND CENTER PASSED");
console.log(JSON.stringify({ bytes: Buffer.byteLength(html), agents: 40, tabs: 14, matrix_cells: 1600 }));
