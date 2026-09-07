import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const release = JSON.parse(fs.readFileSync(path.join(root, "config/departments/v3/release-candidate.json"), "utf8"));
if (release.status !== "READY_FOR_INDEPENDENT_REVIEW" || release.independent_audit !== false || release.metrics.hashed_artifacts !== 155 || release.conditions.length !== 7 || !release.conditions.every(x => x.pass) || release.artifacts.some(x => !/^[a-f0-9]{64}$/.test(x.sha256))) { console.error("AUTONOMOUS V3 RELEASE VALIDATION FAILED"); process.exit(1); }
console.log("AUTONOMOUS V3 RELEASE VALIDATION PASSED");
console.log(JSON.stringify({ release: release.release_id, status: release.status, hashed_artifacts: release.metrics.hashed_artifacts, independent_audit: release.independent_audit }));
