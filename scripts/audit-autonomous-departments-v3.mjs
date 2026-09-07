import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = file => JSON.parse(fs.readFileSync(path.join(root, file), "utf8"));
const write = (file, value) => { const target = path.join(root, file); fs.mkdirSync(path.dirname(target), { recursive: true }); fs.writeFileSync(target, `${JSON.stringify(value, null, 2)}\n`, "utf8"); };
const registry = read("config/departments/registry.json");
const matrix = read("config/departments/relationship-matrix.json");
const interfaces = read("config/departments/v3/interface-contracts.json");
const dossiers = registry.departments.flatMap(department => department.agents.map(id => read(`config/departments/v3/dossiers/${id}.json`)));
const errors = [];
const invariant = ({ dossiers: candidateDossiers, interfaces: candidateInterfaces }) => {
  const failures = [];
  if (candidateDossiers.length !== 50) failures.push("agent_count");
  const artifactSet = new Set(candidateDossiers.map(d => d.agent.artifact));
  if (artifactSet.size !== candidateDossiers.length) failures.push("artifact_uniqueness");
  const methodSet = new Set(candidateDossiers.map(d => d.operating_doctrine.method));
  if (methodSet.size !== candidateDossiers.length) failures.push("method_identity");
  for (const d of candidateDossiers) {
    if (!d.decision_rights.some(x => x.action === "self certify" && x.status === "DENY")) failures.push(`self_certification:${d.agent.id}`);
    if (!d.gates.some(x => x.id === "FALSIFIER_COVERAGE")) failures.push(`falsifier_gate:${d.agent.id}`);
    if (d.fmea.length < 30 || d.evals.length < 40) failures.push(`causal_depth:${d.agent.id}`);
    if (!d.fmea.every(f => typeof f.role_anchor === "string" && f.role_anchor.length > 4 && f.mechanism.includes(f.role_anchor) && f.detection.includes(d.operating_doctrine.method))) failures.push(`role_specific_fmea:${d.agent.id}`);
    if (!d.evals.every(e => typeof e.setup === "string" && e.setup.includes(d.operating_doctrine.method) || typeof e.setup === "string" && e.setup.includes("control anchor"))) failures.push(`role_specific_eval:${d.agent.id}`);
    if (!d.workflow.some(s => s.state === "EXECUTE_METHOD" && s.action === d.operating_doctrine.method)) failures.push(`workflow_method_link:${d.agent.id}`);
  }
  const expectedTypes = new Set(["VERIFIED_TRUTH_FEEDS_CHALLENGE", "EVIDENCE_CONSTRAINS_FORECAST", "CHALLENGE_CONSTRAINS_RECOMMENDATION", "RECOMMENDATION_REQUESTS_AUTHORITY", "DECISION_PACKET_ENTERS_FINAL_REVIEW", "LEASE_AND_RESOURCE_RECEIPTS_ENTER_FINAL_REVIEW", "OUTCOME_REOPEN_TRIGGER"]);
  if (candidateInterfaces.interfaces.length !== 7 || candidateInterfaces.interfaces.some(i => i.transfer.authority !== "NONE; consumer retains only its pre-existing authority" || i.envelope.preserve.length < 5 || !expectedTypes.has(i.type))) failures.push("interface_integrity");
  return failures;
};
const baseline = invariant({ dossiers, interfaces });
if (baseline.length) errors.push(...baseline);
const clone = value => JSON.parse(JSON.stringify(value));
const mutations = [
  { id: "duplicate_artifact", mutate: c => { c.dossiers[1].agent.artifact = c.dossiers[0].agent.artifact; }, detects: "artifact_uniqueness" },
  { id: "duplicate_method", mutate: c => { c.dossiers[1].operating_doctrine.method = c.dossiers[0].operating_doctrine.method; }, detects: "method_identity" },
  { id: "self_certification", mutate: c => { c.dossiers[0].decision_rights.find(x => x.action === "self certify").status = "PERMIT"; }, detects: "self_certification" },
  { id: "remove_falsifier_gate", mutate: c => { c.dossiers[2].gates = c.dossiers[2].gates.filter(x => x.id !== "FALSIFIER_COVERAGE"); }, detects: "falsifier_gate" },
  { id: "erase_role_fmea_link", mutate: c => { c.dossiers[3].fmea.forEach(x => { x.mechanism = "generic mechanism"; }); }, detects: "role_specific_fmea" },
  { id: "transfer_authority", mutate: c => { c.interfaces.interfaces[0].transfer.authority = "TRANSFERRED"; }, detects: "interface_integrity" }
].map(mutation => { const candidate = { dossiers: clone(dossiers), interfaces: clone(interfaces) }; mutation.mutate(candidate); const detected = invariant(candidate).some(x => x.includes(mutation.detects)); return { id: mutation.id, detected, expected: mutation.detects }; });
for (const mutation of mutations) if (!mutation.detected) errors.push(`mutation_not_detected:${mutation.id}`);
const endpointSet = new Set(interfaces.interfaces.flatMap(i => [i.producer.id, i.consumer.id]));
const graphCoverage = matrix.relations.filter(r => endpointSet.has(r.from) && endpointSet.has(r.to)).length;
if (graphCoverage < 7) errors.push("interface_graph_coverage");
const report = { schema_version: "3.0.0", status: errors.length ? "FAIL" : "PASS_PENDING_INDEPENDENT_CERTIFICATION", metrics: { dossiers: dossiers.length, unique_artifacts: new Set(dossiers.map(d => d.agent.artifact)).size, unique_methods: new Set(dossiers.map(d => d.operating_doctrine.method)).size, fmea: dossiers.reduce((n, d) => n + d.fmea.length, 0), evals: dossiers.reduce((n, d) => n + d.evals.length, 0), interfaces: interfaces.interfaces.length, graph_coverage: graphCoverage, mutations: mutations.length, detected_mutations: mutations.filter(x => x.detected).length }, mutations, errors };
write("config/departments/v3/audit-report.json", report);
if (errors.length) { console.error("AUTONOMOUS V3 AUDIT FAILED"); errors.forEach(x => console.error(`- ${x}`)); process.exit(1); }
console.log("AUTONOMOUS V3 AUDIT PASSED");
console.log(JSON.stringify(report.metrics));
