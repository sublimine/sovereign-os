import assert from "node:assert/strict";
import {
  compileSigmaCharter, authorizeSigmaAction, validateSigmaContext, admitEvidence,
  calculateEffectiveSupport, evaluateCoverage, evaluateWarning,
  invalidateSigmaDescendants, evaluateSigmaCompletion, enforceIndependentReview
} from "../../src/reference/sigma-kernel.mjs";

for(let i=1;i<=40;i++) assert.equal(compileSigmaCharter(`sigma_${String(i).padStart(2,"0")}`).agent_id,`sigma_${String(i).padStart(2,"0")}`);
const lease=(agent,action)=>({agent_id:agent,actions:[action],expires_at:"2999-01-01T00:00:00Z"});
assert.equal(authorizeSigmaAction({agentId:"sigma_40",action:"MODIFY_POLICY",lease:lease("sigma_40","MODIFY_POLICY")}).allowed,false);
assert.equal(authorizeSigmaAction({agentId:"sigma_37",action:"DISSEMINATE_SENSITIVE",lease:lease("sigma_37","DISSEMINATE_SENSITIVE")}).allowed,false);
assert.equal(authorizeSigmaAction({agentId:"sigma_37",action:"DISSEMINATE_SENSITIVE",lease:lease("sigma_37","DISSEMINATE_SENSITIVE"),approvals:["omega_21"]}).allowed,true);
assert.equal(validateSigmaContext({objective_ref:"o",lease_ref:"l",tokens_used:5,tokens_budget:10,blind_route:true,original_conclusion_present:true}).valid,false);
assert.equal(admitEvidence({raw_hash:"a".repeat(64),acquisition_event_ref:"e",active_content:false,embedded_instructions:true,supported_type:true}).status,"QUARANTINED");
const dep=calculateEffectiveSupport({claimId:"c",nodes:Array.from({length:20},(_,i)=>({id:`s${i}`,claim_ids:["c"]})),edges:Array.from({length:19},(_,i)=>({from:`s${i}`,to:`s${i+1}`,type:"DERIVED_FROM"}))});
assert.equal(dep.raw_source_count,20); assert.equal(dep.effective_independent_clusters,1); assert.equal(dep.false_consensus,true);
const coverage=evaluateCoverage({requirements:[{id:"r",critical:true,minimum_independent_routes:2}],routes:[{requirement_id:"r",status:"USABLE",fresh:true,independence_cluster:"one"},{requirement_id:"r",status:"USABLE",fresh:true,independence_cluster:"one"}],dependencyResult:dep});
assert.equal(coverage.complete,false); assert.equal(coverage.critical_gaps.length,1);
const warning=evaluateWarning({indicator:{registered_before_observation:true,ttl_ms:1000,direction:"ABOVE",threshold:5,authorized_consumers:["c"]},observation:{observed_at:"2020-01-01T00:00:00Z",value:9,spoofing_unresolved:false},now:"2020-01-01T00:00:02Z"});
assert.equal(warning.may_issue,false); assert(warning.codes.includes("INDICATOR_STALE"));
const invalid=invalidateSigmaDescendants({edges:[{from:"e",to:"c"},{from:"c",to:"f"},{from:"f",to:"p"},{from:"p",to:"d"}]},"e");
assert.deepEqual(invalid,["e","c","f","p","d"]);
assert.equal(enforceIndependentReview({producer:"sigma_24",reviewers:[{agent_id:"sigma_24",independence_attested:true}]}).valid,false);
const complete=evaluateSigmaCompletion({agentId:"sigma_32",result:{artifact_type:"EstimateRecord"},gates:[{nonwaivable:true,outcome:"PASS"}],criticalGaps:[],downstreamAcknowledged:true,reconsiderationTriggers:["resolve"]});
assert.equal(complete.complete,true);
console.log("SIGMA REFERENCE KERNEL VALIDATION PASSED");
console.log(JSON.stringify({compiled_charters:40,default_deny:true,prompt_injection_quarantined:true,false_consensus_collapsed:"20_to_1",warning_freshness:true,retraction_transitive:true,no_self_certification:true}));

