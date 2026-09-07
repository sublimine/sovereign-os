import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const CLASSIFICATION = {PUBLIC:0, INTERNAL:1, CONFIDENTIAL:2, SECRET:3, RESTRICTED:4};
const sha256 = value => crypto.createHash("sha256").update(value).digest("hex");

export function compileEffectiveCharter(root, agentId) {
  const catalog = JSON.parse(fs.readFileSync(path.join(root, "config", "production-charters.json"), "utf8"));
  const entry = catalog.agents.find(a => a.id === agentId);
  if (!entry) return {ok:false, reason:"UNKNOWN_AGENT"};
  const kernel = fs.readFileSync(path.join(root, catalog.kernel.path));
  const charter = fs.readFileSync(path.join(root, entry.path));
  if (sha256(kernel) !== catalog.kernel.sha256) return {ok:false, reason:"KERNEL_HASH_MISMATCH"};
  if (sha256(charter) !== entry.sha256) return {ok:false, reason:"CHARTER_HASH_MISMATCH"};
  return {
    ok:true, agentId, version:entry.version, procedure:entry.procedure,
    primaryArtifact:entry.primary_artifact,
    effectivePrompt:kernel.toString("utf8") + "\n\n" + charter.toString("utf8"),
    hashes:{kernel:catalog.kernel.sha256, charter:entry.sha256}
  };
}

export function validateLease(lease, now = new Date()) {
  const required = ["lease_id","mission_id","subject","issuer","issued_at","expires_at","actions","resources","tool_profile","classification_ceiling","budgets","revocation_triggers","signature"];
  const missing = required.filter(k => !(k in lease));
  if (missing.length) return {ok:false, reason:"LEASE_INCOMPLETE", missing};
  if (Date.parse(lease.expires_at) <= now.getTime()) return {ok:false, reason:"LEASE_EXPIRED"};
  if (Date.parse(lease.issued_at) > now.getTime()) return {ok:false, reason:"LEASE_NOT_YET_VALID"};
  if (!Array.isArray(lease.actions) || new Set(lease.actions).size !== lease.actions.length) return {ok:false, reason:"LEASE_ACTIONS_INVALID"};
  if (!lease.signature.value || !lease.signature.key_id) return {ok:false, reason:"LEASE_UNSIGNED"};
  return {ok:true};
}

export function authorizeAction(matrix, agentId, action, lease, options = {}) {
  const leaseResult = validateLease(lease, options.now || new Date());
  if (!leaseResult.ok) return {effect:"DENY", reason:leaseResult.reason};
  if (lease.subject !== (options.instanceId || lease.subject)) return {effect:"DENY", reason:"LEASE_SUBJECT_MISMATCH"};
  if (lease.mission_id !== options.missionId) return {effect:"DENY", reason:"LEASE_MISSION_MISMATCH"};
  if (!matrix.actions.includes(action)) return {effect:"DENY", reason:"ACTION_UNKNOWN"};
  const code = matrix.agents[agentId]?.[action];
  if (!code || code === "X") return {effect:"DENY", reason:"ROLE_PROHIBITS_ACTION"};
  if (!lease.actions.includes(action)) return {effect:"DENY", reason:"LEASE_DOES_NOT_GRANT_ACTION"};
  if (options.classification && CLASSIFICATION[options.classification] > CLASSIFICATION[lease.classification_ceiling])
    return {effect:"DENY", reason:"CLASSIFICATION_EXCEEDS_LEASE"};
  if (code === "A" && !options.humanApproval) return {effect:"HUMAN_REQUIRED", reason:"APPROVAL_REQUIRED"};
  if (code === "C" && !(options.conditionsSatisfied === true)) return {effect:"DENY", reason:"CONDITIONS_UNSATISFIED"};
  return {effect:"ALLOW", reason:code === "P" ? "ROLE_AND_LEASE_ALLOW" : "CONDITIONS_SATISFIED"};
}

export function validateContextManifest(manifest, forbiddenLeak = []) {
  const required = ["always_loaded","mission_context","retrieved_context","evidence_context","historical_context","forbidden_context","blindness","items","token_budget"];
  const missing = required.filter(k => !(k in manifest));
  if (missing.length) return {ok:false, reason:"CONTEXT_MANIFEST_INCOMPLETE", missing};
  const tokens = manifest.items.reduce((n, x) => n + Number(x.token_estimate || 0), 0);
  if (tokens > manifest.token_budget) return {ok:false, reason:"CONTEXT_BUDGET_EXCEEDED", tokens};
  const instructionLeak = manifest.items.some(x => x.trust === "EXTERNAL_UNTRUSTED" && x.purpose === "INSTRUCTION");
  if (instructionLeak) return {ok:false, reason:"UNTRUSTED_INSTRUCTION"};
  if (manifest.blindness.mode !== "NONE" && forbiddenLeak.some(x => manifest.blindness.hidden_fields.includes(x)))
    return {ok:false, reason:"BLIND_CONTEXT_CONTAMINATED", action:"INVALIDATE_RESTART"};
  return {ok:true, tokens};
}

export function invalidateDescendants(nodes, edges, rootId) {
  const next = new Map(nodes.map(n => [n, []]));
  for (const [from, to] of edges) {
    if (!next.has(from) || !next.has(to)) throw new Error("UNKNOWN_GRAPH_NODE");
    next.get(from).push(to);
  }
  const seen = new Set(), queue = [rootId];
  while (queue.length) {
    const current = queue.shift();
    for (const child of next.get(current) || []) if (!seen.has(child)) { seen.add(child); queue.push(child); }
  }
  return [...seen].sort();
}

export function evaluateEpistemicEligibility(features) {
  const required = ["provenance","entailment","freshness","independent_roots","replication","contradiction"];
  const missing = required.filter(k => !(k in features));
  if (missing.length) return {state:"UNKNOWN", reason:"FEATURES_INCOMPLETE", missing};
  if (!features.provenance) return {state:"UNVERIFIED", reason:"PROVENANCE_MISSING"};
  if (features.contradiction === "REFUTED") return {state:"REFUTED", reason:"DIRECT_REFUTATION"};
  if (features.contradiction === "OPEN") return {state:"CONTRADICTED", reason:"UNRESOLVED_CONTRADICTION"};
  if (!features.freshness) return {state:"STALE", reason:"EVIDENCE_EXPIRED"};
  if (features.entailment !== "SUPPORTED") return {state:"UNVERIFIED", reason:"ENTAILMENT_INSUFFICIENT"};
  if (features.independent_roots < 2) return {state:"HIGH_CONFIDENCE", reason:"SINGLE_ROOT_CEILING"};
  if (features.replication !== "INDEPENDENT_PASS") return {state:"CORROBORATED", reason:"REPLICATION_REQUIRED_FOR_VERIFIED"};
  return {state:"VERIFIED", reason:"ALL_HARD_FEATURES_PASS"};
}

export function evaluateGate(gate) {
  if (gate.outcome === "WAIVE" && (!gate.waivable || !gate.waiver_ref)) return {ok:false, reason:"INVALID_WAIVER"};
  if (["PASS","FAIL","RETURN","ESCALATE","WAIVE","BLOCKED"].includes(gate.outcome) === false) return {ok:false, reason:"INVALID_OUTCOME"};
  if (!gate.evidence_refs?.length && gate.outcome === "PASS") return {ok:false, reason:"PASS_WITHOUT_EVIDENCE"};
  return {ok:true};
}

