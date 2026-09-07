import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const readJson = relative => JSON.parse(fs.readFileSync(path.join(root, relative), "utf8"));
const digest = text => crypto.createHash("sha256").update(text).digest("hex");

export function compileSigmaCharter(agentId) {
  const catalog = readJson("config/sigma-production-charters.json");
  const entry = catalog.agents.find(agent => agent.id === agentId);
  if (!entry) throw new Error("UNKNOWN_SIGMA_AGENT");
  const kernel = fs.readFileSync(path.join(root, catalog.kernel.path), "utf8");
  const charter = fs.readFileSync(path.join(root, entry.path), "utf8");
  if (digest(kernel) !== catalog.kernel.sha256) throw new Error("SIGMA_KERNEL_HASH_MISMATCH");
  if (digest(charter) !== entry.sha256) throw new Error("SIGMA_CHARTER_HASH_MISMATCH");
  return {agent_id:agentId,procedure:entry.procedure,primary_artifact:entry.primary_artifact,effective_hash:digest(`${kernel}\n---ROLE---\n${charter}`)};
}

export function authorizeSigmaAction({agentId,action,lease,conditions=[],approvals=[]}) {
  const matrix = readJson("config/sigma/authority-actions.json");
  const decision = matrix.agents[agentId]?.[action] ?? "X";
  const leaseValid = lease && lease.agent_id === agentId && lease.actions?.includes(action) && Date.parse(lease.expires_at) > Date.now();
  if (!leaseValid) return {allowed:false,code:"LEASE_DENIED"};
  if (decision === "X") return {allowed:false,code:"POLICY_DENIED"};
  if (decision === "A" && approvals.length === 0) return {allowed:false,code:"EXTERNAL_APPROVAL_REQUIRED"};
  if (decision === "C" && conditions.length === 0 && approvals.length === 0) return {allowed:false,code:"CONDITION_UNRESOLVED"};
  return {allowed:true,code:"AUTHORIZED",decision};
}

export function validateSigmaContext(manifest) {
  const errors=[];
  if (!manifest.objective_ref) errors.push("OBJECTIVE_MISSING");
  if (!manifest.lease_ref) errors.push("LEASE_MISSING");
  if (manifest.tokens_used > manifest.tokens_budget) errors.push("CONTEXT_BUDGET_EXCEEDED");
  if (manifest.external_instructions_present) errors.push("EXTERNAL_INSTRUCTIONS_PRESENT");
  if (manifest.blind_route && (manifest.original_conclusion_present || manifest.producer_persuasion_present)) errors.push("BLIND_ROUTE_CONTAMINATED");
  if (manifest.secret_refs?.some(ref=>!manifest.authorized_secret_refs?.includes(ref))) errors.push("SECRET_SCOPE_VIOLATION");
  return {valid:errors.length===0,errors};
}

export function admitEvidence(input) {
  const reason_codes=[];
  if (!input.raw_hash || !/^[a-f0-9]{64}$/.test(input.raw_hash)) reason_codes.push("RAW_INTEGRITY_INVALID");
  if (!input.acquisition_event_ref) reason_codes.push("ACQUISITION_PROVENANCE_MISSING");
  if (input.active_content) reason_codes.push("ACTIVE_CONTENT_QUARANTINE");
  if (input.embedded_instructions) reason_codes.push("PROMPT_INJECTION_QUARANTINE");
  if (!input.supported_type) reason_codes.push("UNSUPPORTED_TYPE");
  const status = reason_codes.length ? "QUARANTINED" : "ADMISSIBLE";
  return {status,reason_codes,raw_preserved:true,semantic_truth_certified:false};
}

export function calculateEffectiveSupport({nodes,edges,claimId}) {
  const relevant=nodes.filter(node=>node.claim_ids?.includes(claimId));
  const ids=new Set(relevant.map(node=>node.id));
  const adjacency=new Map([...ids].map(id=>[id,new Set()]));
  for(const edge of edges){
    if(!ids.has(edge.from)||!ids.has(edge.to)) continue;
    if(["DERIVED_FROM","DUPLICATE_OF","SYNDICATED_FROM","COMMON_ORIGIN","SHARED_DATASET","SHARED_METHOD"].includes(edge.type)){
      adjacency.get(edge.from).add(edge.to); adjacency.get(edge.to).add(edge.from);
    }
  }
  const visited=new Set(),clusters=[];
  for(const id of ids){
    if(visited.has(id)) continue;
    const stack=[id],cluster=[]; visited.add(id);
    while(stack.length){const current=stack.pop();cluster.push(current);for(const next of adjacency.get(current)){if(!visited.has(next)){visited.add(next);stack.push(next);}}}
    clusters.push(cluster);
  }
  return {raw_source_count:relevant.length,effective_independent_clusters:clusters.length,clusters,false_consensus:relevant.length>=3&&clusters.length===1};
}

export function evaluateCoverage({requirements,routes,dependencyResult}) {
  const results=requirements.map(requirement=>{
    const supporting=routes.filter(route=>route.requirement_id===requirement.id&&route.status==="USABLE");
    const independent=new Set(supporting.map(route=>route.independence_cluster)).size;
    const covered=independent>=requirement.minimum_independent_routes && supporting.some(route=>route.fresh);
    return {requirement_id:requirement.id,critical:requirement.critical,supporting_routes:supporting.length,independent_routes:independent,covered};
  });
  const critical_gaps=results.filter(result=>result.critical&&!result.covered);
  return {results,critical_gaps,complete:critical_gaps.length===0&&!(dependencyResult?.false_consensus)};
}

export function evaluateWarning({indicator,observation,now=new Date().toISOString()}) {
  const codes=[];
  if (!indicator.registered_before_observation) codes.push("INDICATOR_NOT_PREREGISTERED");
  if (Date.parse(observation.observed_at)+indicator.ttl_ms < Date.parse(now)) codes.push("INDICATOR_STALE");
  if (observation.spoofing_unresolved) codes.push("SPOOFING_UNRESOLVED");
  if (!indicator.authorized_consumers?.length) codes.push("NO_AUTHORIZED_CONSUMER");
  const crossed = indicator.direction === "ABOVE" ? observation.value >= indicator.threshold : observation.value <= indicator.threshold;
  if (!crossed) codes.push("THRESHOLD_NOT_CROSSED");
  return {may_issue:codes.length===0,codes,status:codes.length===0?"WARNING_READY":"WATCH_OR_BLOCKED"};
}

export function invalidateSigmaDescendants(graph,invalidNodeId) {
  const children=new Map();
  for(const edge of graph.edges){if(!children.has(edge.from)) children.set(edge.from,[]);children.get(edge.from).push(edge.to);}
  const invalidated=new Set([invalidNodeId]),queue=[invalidNodeId];
  while(queue.length){const current=queue.shift();for(const child of children.get(current)||[]){if(!invalidated.has(child)){invalidated.add(child);queue.push(child);}}}
  return [...invalidated];
}

export function evaluateSigmaCompletion({agentId,result,gates,criticalGaps=[],downstreamAcknowledged=false,reconsiderationTriggers=[]}) {
  const compiled=compileSigmaCharter(agentId);
  const errors=[];
  if(result?.artifact_type!==compiled.primary_artifact) errors.push("WRONG_PRIMARY_ARTIFACT");
  if(gates.some(gate=>gate.nonwaivable&&gate.outcome!=="PASS")) errors.push("NONWAIVABLE_GATE_OPEN");
  if(criticalGaps.length) errors.push("CRITICAL_GAP_OPEN");
  if(!downstreamAcknowledged) errors.push("DOWNSTREAM_NOT_ACKNOWLEDGED");
  if(!reconsiderationTriggers.length) errors.push("RECONSIDERATION_TRIGGER_MISSING");
  return {complete:errors.length===0,errors,status:errors.length?"PARTIAL_OR_BLOCKED":"COMPLETE"};
}

export function enforceIndependentReview({producer,reviewers,material=true}) {
  if(!material) return {valid:true,code:"PROPORTIONAL_REVIEW"};
  const independent=reviewers.filter(reviewer=>reviewer.agent_id!==producer&&reviewer.independence_attested);
  return independent.length?{valid:true,code:"INDEPENDENT_REVIEW_PRESENT"}:{valid:false,code:"SELF_CERTIFICATION_BLOCKED"};
}

