import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {
  compileEffectiveCharter,
  evaluateEpistemicEligibility,
  validateContextManifest,
  validateLease
} from "../reference/omega-kernel.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const defaultRoot = path.resolve(here, "..", "..");
const digest = value => crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex");
const readJson = (root, relative) => JSON.parse(fs.readFileSync(path.join(root, relative), "utf8"));
const rank = value => Number(String(value || "").replace(/^[A-Z]/, ""));

/**
 * A small executable spine for the existing Ω contracts.
 *
 * This is deliberately not a replacement hierarchy. It materialises the
 * existing activation policy into bounded worker invocations and refuses to
 * emit a decision-ready dossier until provenance, independent corroboration,
 * adversarial review and human approval have all been recorded.
 */
export class SovereignMissionFactory {
  constructor({root = defaultRoot, now = () => new Date()} = {}) {
    this.root = root;
    this.now = now;
    this.policy = readJson(root, "config/activation-policy.json");
    this.audit = [];
  }

  activate(mission) {
    const selected = new Set(this.policy.baseline);
    const atLeast = (field, threshold) => rank(mission[field]) >= rank(threshold);
    const apply = rule => {
      const w = rule.when;
      const matches =
        (w.decision_required === undefined || Boolean(mission.decision_required) === w.decision_required) &&
        (w.research_required === undefined || Boolean(mission.research_required) === w.research_required) &&
        (w.causality_material === undefined || Boolean(mission.causality_material) === w.causality_material) &&
        (w.simulation_required === undefined || Boolean(mission.simulation_required) === w.simulation_required) &&
        (w.strategy_required === undefined || Boolean(mission.strategy_required) === w.strategy_required) &&
        (w.factual_sensitivity_at_least === undefined || atLeast("factual_sensitivity", w.factual_sensitivity_at_least)) &&
        (w.uncertainty_at_least === undefined || atLeast("uncertainty", w.uncertainty_at_least)) &&
        (w.irreversibility_at_least === undefined || atLeast("irreversibility", w.irreversibility_at_least)) &&
        (w.capital_at_least === undefined || atLeast("capital", w.capital_at_least)) &&
        (w.legitimacy_at_least === undefined || atLeast("legitimacy", w.legitimacy_at_least)) &&
        (w.duration_at_least === undefined || atLeast("duration", w.duration_at_least)) &&
        (!w.materiality_at_least || atLeast("materiality", w.materiality_at_least)) &&
        (!w.priority_or_materiality || w.priority_or_materiality.includes(mission.priority) || w.priority_or_materiality.includes(mission.materiality));
      if (matches) rule.activate.forEach(agent => selected.add(agent));
    };
    this.policy.rules.forEach(apply);
    return [...selected].sort();
  }

  createMission({mission, lease, contextManifest}) {
    for (const field of ["id", "objective", "materiality", "priority"]) {
      if (!mission?.[field]) throw new Error(`MISSION_${field.toUpperCase()}_REQUIRED`);
    }
    const leaseCheck = validateLease(lease, this.now());
    if (!leaseCheck.ok) throw new Error(`LEASE_${leaseCheck.reason}`);
    if (lease.mission_id !== mission.id) throw new Error("LEASE_MISSION_MISMATCH");
    const contextCheck = validateContextManifest(contextManifest);
    if (!contextCheck.ok) throw new Error(`CONTEXT_${contextCheck.reason}`);

    const activated = this.activate(mission);
    const charters = activated.map(agentId => {
      const charter = compileEffectiveCharter(this.root, agentId);
      if (!charter.ok) throw new Error(`CHARTER_${agentId}_${charter.reason}`);
      return {agentId, procedure: charter.procedure, primaryArtifact: charter.primaryArtifact, hashes: charter.hashes};
    });
    const instance = {
      id: `mission:${mission.id}`,
      mission: structuredClone(mission),
      activated,
      charters,
      state: "ACTIVE",
      evidence: [],
      reviews: [],
      approvals: [],
      outputs: []
    };
    this.#append(instance.id, "MISSION_CREATED", {activated, charterHashes: charters.map(c => ({agentId: c.agentId, hashes: c.hashes}))});
    return instance;
  }

  admitEvidence(instance, evidence) {
    if (instance.state !== "ACTIVE") throw new Error("MISSION_NOT_ACTIVE");
    for (const field of ["id", "claimId", "rawHash", "acquisitionEventRef", "independentRoot", "entailment", "freshness", "replication", "contradiction"]) {
      if (!evidence?.[field]) throw new Error(`EVIDENCE_${field.toUpperCase()}_REQUIRED`);
    }
    if (!/^[a-f0-9]{64}$/.test(evidence.rawHash)) throw new Error("EVIDENCE_RAW_HASH_INVALID");
    if (evidence.embeddedInstructions || evidence.activeContent) throw new Error("EVIDENCE_QUARANTINED");
    instance.evidence.push(structuredClone(evidence));
    this.#append(instance.id, "EVIDENCE_ADMITTED", {id: evidence.id, claimId: evidence.claimId, rawHash: evidence.rawHash, independentRoot: evidence.independentRoot});
  }

  evaluateClaim(instance, claimId) {
    const evidence = instance.evidence.filter(item => item.claimId === claimId);
    if (!evidence.length) return {state: "UNVERIFIED", reason: "NO_EVIDENCE", independentRoots: 0};
    const eligible = evidence.map(item => evaluateEpistemicEligibility({
      provenance: Boolean(item.acquisitionEventRef),
      entailment: item.entailment,
      freshness: item.freshness,
      independent_roots: new Set(evidence.map(x => x.independentRoot)).size,
      replication: item.replication,
      contradiction: item.contradiction
    }));
    const independentRoots = new Set(evidence.map(item => item.independentRoot)).size;
    const blocking = eligible.find(item => ["REFUTED", "CONTRADICTED"].includes(item.state));
    if (blocking) return {...blocking, independentRoots};
    const best = eligible.some(item => item.state === "VERIFIED") && independentRoots >= 2
      ? {state: "VERIFIED", reason: "INDEPENDENT_CORROBORATION"}
      : eligible[0];
    return {...best, independentRoots};
  }

  submitReview(instance, review) {
    for (const field of ["reviewerId", "producerId", "claimId", "verdict", "independenceAttested"]) {
      if (!(field in (review || {}))) throw new Error(`REVIEW_${field.toUpperCase()}_REQUIRED`);
    }
    if (review.reviewerId === review.producerId || !review.independenceAttested) throw new Error("REVIEW_SELF_CERTIFICATION_BLOCKED");
    if (!instance.activated.includes(review.reviewerId)) throw new Error("REVIEWER_NOT_ACTIVATED");
    instance.reviews.push(structuredClone(review));
    this.#append(instance.id, "ADVERSARIAL_REVIEW", {reviewerId: review.reviewerId, producerId: review.producerId, claimId: review.claimId, verdict: review.verdict});
  }

  requestHumanApproval(instance, approval) {
    if (!approval?.requestId || !approval?.decision || !approval?.signer) throw new Error("APPROVAL_INCOMPLETE");
    if (!["APPROVE", "DENY"].includes(approval.decision)) throw new Error("APPROVAL_INVALID");
    instance.approvals.push(structuredClone(approval));
    this.#append(instance.id, "HUMAN_APPROVAL", {requestId: approval.requestId, decision: approval.decision, signer: approval.signer});
  }

  finalize(instance, {claimIds, producerId}) {
    if (instance.state !== "ACTIVE") throw new Error("MISSION_NOT_ACTIVE");
    const claims = claimIds.map(claimId => ({claimId, ...this.evaluateClaim(instance, claimId)}));
    const unresolved = claims.filter(claim => claim.state !== "VERIFIED");
    if (unresolved.length) return {status: "BLOCKED", reason: "EVIDENCE_GATE", claims, unresolved};
    const reviewFailures = claimIds.filter(claimId => !instance.reviews.some(review => review.claimId === claimId && review.producerId === producerId && review.independenceAttested && review.verdict === "PASS"));
    if (reviewFailures.length) return {status: "BLOCKED", reason: "ADVERSARIAL_GATE", claims, reviewFailures};
    const approved = instance.approvals.some(approval => approval.decision === "APPROVE");
    if (!approved) return {status: "HUMAN_REQUIRED", reason: "DECISION_GATE", claims};
    instance.state = "COMPLETE";
    const dossier = {missionId: instance.mission.id, status: "DECISION_READY", claims, producerId, auditHead: this.audit.at(-1)?.hash || null};
    instance.outputs.push(dossier);
    this.#append(instance.id, "DOSSIER_RELEASED", dossier);
    return {status: "DECISION_READY", dossier};
  }

  verifyAuditChain() {
    return this.audit.every((event, index) => {
      const expectedPrevious = index ? this.audit[index - 1].hash : "GENESIS";
      return event.previousHash === expectedPrevious && event.hash === digest({sequence: event.sequence, missionId: event.missionId, type: event.type, payload: event.payload, previousHash: event.previousHash});
    });
  }

  #append(missionId, type, payload) {
    const previousHash = this.audit.at(-1)?.hash || "GENESIS";
    const sequence = this.audit.length + 1;
    const event = {sequence, missionId, type, payload, previousHash};
    event.hash = digest(event);
    this.audit.push(event);
  }
}
