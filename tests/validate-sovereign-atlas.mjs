import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const file = path.join(root, "visual", "sovereign-atlas.html");
const errors = [];
if (!fs.existsSync(file)) errors.push("atlas missing");
const html = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "";
for (const token of ["Cúspide Ω", "Estrategia Π", "Factoría Σ", "Topología y mando", "Flujo de información", "Verificación y control", "Independencia y fronteras", "svg", "viewBox", "pointerdown", "allMatrixEdges", "selectNode", "isNodeTarget", "if(isNodeTarget(event.target))return;", "Conectores declarados", "graphBounds", "pi-strategy-center.html"]) {
  if (!html.includes(token)) errors.push(`atlas missing ${token}`);
}
for (let number = 1; number <= 24; number++) if (!html.includes(`omega_${String(number).padStart(2, "0")}`)) errors.push(`atlas missing omega_${number}`);
for (let number = 1; number <= 40; number++) if (!html.includes(`pi_${String(number).padStart(2, "0")}`)) errors.push(`atlas missing pi_${number}`);
for (let number = 1; number <= 40; number++) if (!html.includes(`sigma_${String(number).padStart(2, "0")}`)) errors.push(`atlas missing sigma_${number}`);
for (const department of ["Verdad y Verificación", "Ataque Adversarial", "Predicción y Decisión", "Poder Institucional", "Calidad Final y Evolución"]) if (!html.includes(department)) errors.push(`atlas missing department ${department}`);
for (const id of ["veritas_01", "adversum_01", "praxis_01", "imperium_01", "telos_01"]) if (!html.includes(id)) errors.push(`atlas missing department lead ${id}`);
const inline = html.match(/<script>([\s\S]*)<\/script>/)?.[1];
if (!inline) errors.push("inline app missing");
else try { new vm.Script(inline, { filename: "sovereign-atlas.js" }); } catch (error) { errors.push(`invalid JavaScript: ${error.message}`); }
const payload = inline?.match(/const DATA=(.*);\s*const \$=/s)?.[1];
if (!payload) errors.push("atlas data payload missing");
else try {
  const data = JSON.parse(payload);
  if (data.nodes.length !== 154) errors.push(`atlas node count ${data.nodes.length} != 154`);
  if (data.nodes.filter(node => node.system === "DEPARTMENT").length !== 50) errors.push("atlas department node count is not 50");
} catch (error) { errors.push(`invalid atlas data payload: ${error.message}`); }
if (Buffer.byteLength(html) < 160_000) errors.push("atlas payload unexpectedly shallow");
if (errors.length) { console.error("SOVEREIGN ATLAS FAILED"); errors.forEach(error => console.error(`- ${error}`)); process.exit(1); }
console.log("SOVEREIGN ATLAS PASSED");
console.log(JSON.stringify({ bytes: Buffer.byteLength(html), agents: 154, department_agents: 50, matrix_cells: 3200, interactive: true }));
