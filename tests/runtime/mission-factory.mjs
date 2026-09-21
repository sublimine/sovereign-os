import assert from "node:assert/strict";
import crypto from "node:crypto";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {SovereignMissionFactory} from "../../src/runtime/mission-factory.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const now = new Date("2026-09-08T12:00:00.000Z");
const sha = value => crypto.createHash("sha256").update(value).digest("hex");
const factory = new SovereignMissionFactory({root, now: () => now});
const mission = {id: "m-demo", objective: "Evaluate an evidence-backed strategic option", materiality: "M4", priority: "P0", decision_required: true, research_required: true, factual_sensitivity: 4, uncertainty: 4, irreversibility: 4, strategy_required: true, simulation_required: true, capital: 4, legitimacy: 2, duration: 3};
const lease = {lease_id: "lease-demo", mission_id: "m-demo", subject: "instance-demo", issuer: "human", issued_at: "2026-09-08T11:00:00.000Z", expires_at: "2026-09-08T13:00:00.000Z", actions: ["investigate"], resources: [], tool_profile: "read-only", classification_ceiling: "INTERNAL", budgets: {}, revocation_triggers: [], signature: {key_id: "test", value: "signed"}};
const contextManifest = {always_loaded: [], mission_context: [], retrieved_context: [], evidence_context: [], historical_context: [], forbidden_context: [], blindness: {mode: "NONE", hidden_fields: []}, items: [], token_budget: 100};

const instance = factory.createMission({mission, lease, contextManifest});
assert(instance.activated.includes("omega_01"));
assert(instance.activated.includes("omega_13"));
assert(instance.activated.includes("omega_24"));

const source = extra => ({id: extra.id, claimId: "claim-1", rawHash: sha(extra.id), acquisitionEventRef: `acq:${extra.id}`, independentRoot: extra.root, entailment: "SUPPORTED", freshness: true, replication: "INDEPENDENT_PASS", contradiction: "NONE", ...extra});
factory.admitEvidence(instance, source({id: "source-a", root: "primary-a"}));
assert.equal(factory.finalize(instance, {claimIds: ["claim-1"], producerId: "omega_05"}).status, "BLOCKED");
factory.admitEvidence(instance, source({id: "source-b", root: "primary-b"}));
assert.throws(() => factory.submitReview(instance, {reviewerId: "omega_05", producerId: "omega_05", claimId: "claim-1", verdict: "PASS", independenceAttested: true}), /SELF_CERTIFICATION/);
factory.submitReview(instance, {reviewerId: "omega_13", producerId: "omega_05", claimId: "claim-1", verdict: "PASS", independenceAttested: true});
assert.equal(factory.finalize(instance, {claimIds: ["claim-1"], producerId: "omega_05"}).status, "HUMAN_REQUIRED");
factory.requestHumanApproval(instance, {requestId: "approval-1", decision: "APPROVE", signer: "human"});
assert.equal(factory.finalize(instance, {claimIds: ["claim-1"], producerId: "omega_05"}).status, "DECISION_READY");
assert.equal(factory.verifyAuditChain(), true);
console.log(JSON.stringify({runtime: "mission-factory", activated: instance.activated.length, auditEvents: factory.audit.length, gates: ["evidence", "independent-review", "human-approval"]}));
