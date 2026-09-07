import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const scripts = ["build-pi-v3.mjs", "audit-pi-v3.mjs", "build-pi-command-center.mjs"];
for (const script of scripts) {
  const result = spawnSync(process.execPath, [path.join(root, "scripts", script)], { stdio: "inherit" });
  if (result.status !== 0) process.exit(result.status || 1);
}
for (const [directory, script] of [["tests/pi", "validate-council-foundation.mjs"], ["tests/pi", "validate-command-center.mjs"], ["scripts", "certify-pi-v3-release.mjs"]]) {
  const result = spawnSync(process.execPath, [path.join(root, directory, script)], { stdio: "inherit" });
  if (result.status !== 0) process.exit(result.status || 1);
}
console.log("ALL PI V3 TESTS PASSED");
