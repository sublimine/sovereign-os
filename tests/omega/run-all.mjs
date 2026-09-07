import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const tests = ["validate-repository.mjs","validate-agent-configs.mjs","validate-production-charters.mjs","validate-reference-kernel.mjs","validate-eval-battery-v2.mjs","validate-state-gates-v2.mjs","validate-output-contract-v2.mjs","validate-fmea-v2.mjs","validate-simulation-traces-v2.mjs","validate-relationships.mjs","validate-authority.mjs","validate-catalogs.mjs","validate-behavior.mjs","validate-requirements.mjs","validate-release-v2.mjs","validate-final-integrity-v2.mjs"];
for (const test of tests) {
  const run = spawnSync(process.execPath, [path.join(here, test)], {stdio:"inherit"});
  if (run.status !== 0) process.exit(run.status ?? 1);
}
console.log("ALL OMEGA TESTS PASSED");
