import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {compileEffectiveCharter, validateLease, authorizeAction, validateContextManifest, invalidateDescendants, evaluateEpistemicEligibility, evaluateGate} from "../../src/reference/omega-kernel.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const errors = [];
const matrix = JSON.parse(fs.readFileSync(path.join(root,"config","authority-actions.json"),"utf8"));
const now = new Date("2030-01-01T00:00:00Z");
const lease = {lease_id:"lease-0001",mission_id:"m1",subject:"instance-1",issuer:"omega_21",issued_at:"2029-12-01T00:00:00Z",expires_at:"2030-02-01T00:00:00Z",actions:["approve","access_secrets"],resources:["decision:1"],tool_profile:[],classification_ceiling:"CONFIDENTIAL",budgets:{tokens:1,compute_units:1,wall_seconds:1,children:0,external_cost:0},revocation_triggers:["MISSION_END"],signature:{algorithm:"test",key_id:"k1",value:"signed"}};

for(let i=1;i<=24;i++) if(!compileEffectiveCharter(root,"omega_"+String(i).padStart(2,"0")).ok) errors.push("charter compile failed "+i);
if(!validateLease(lease,now).ok) errors.push("valid lease rejected");
if(validateLease({...lease,expires_at:"2029-01-01T00:00:00Z"},now).reason!=="LEASE_EXPIRED") errors.push("expired lease accepted");
if(authorizeAction(matrix,"omega_01","approve",lease,{now,missionId:"m1",instanceId:"instance-1"}).effect!=="ALLOW") errors.push("valid approve denied");
if(authorizeAction(matrix,"omega_24","approve",lease,{now,missionId:"m1",instanceId:"instance-1"}).effect!=="DENY") errors.push("omega24 self approval allowed");
if(authorizeAction(matrix,"omega_01","access_secrets",lease,{now,missionId:"m1",instanceId:"instance-1"}).effect!=="HUMAN_REQUIRED") errors.push("secret approval not required");
const ctx={token_budget:10,always_loaded:[],mission_context:[],retrieved_context:[],evidence_context:[],historical_context:[],forbidden_context:[],blindness:{mode:"BLIND",hidden_fields:["conclusion"],contamination_action:"INVALIDATE_RESTART"},items:[{trust:"EXTERNAL_UNTRUSTED",purpose:"EVIDENCE",token_estimate:5}]};
if(!validateContextManifest(ctx).ok) errors.push("valid context rejected");
if(validateContextManifest(ctx,["conclusion"]).reason!=="BLIND_CONTEXT_CONTAMINATED") errors.push("blind leak not detected");
const descendants=invalidateDescendants(["a","b","c","d"],[["a","b"],["b","c"]],"a");
if(JSON.stringify(descendants)!==JSON.stringify(["b","c"])) errors.push("invalidation wrong");
if(evaluateEpistemicEligibility({provenance:true,entailment:"SUPPORTED",freshness:true,independent_roots:2,replication:"INDEPENDENT_PASS",contradiction:"NONE"}).state!=="VERIFIED") errors.push("verified eligibility failed");
if(evaluateEpistemicEligibility({provenance:true,entailment:"SUPPORTED",freshness:true,independent_roots:20,replication:"INDEPENDENT_PASS",contradiction:"OPEN"}).state!=="CONTRADICTED") errors.push("contradiction was voted away");
if(evaluateGate({outcome:"PASS",evidence_refs:[]}).ok) errors.push("empty gate passed");
if(evaluateGate({outcome:"WAIVE",waivable:false,waiver_ref:"w",evidence_refs:["e"]}).ok) errors.push("nonwaivable gate waived");

if(errors.length){console.error("REFERENCE KERNEL VALIDATION FAILED");errors.forEach(e=>console.error("- "+e));process.exit(1);}
console.log("REFERENCE KERNEL VALIDATION PASSED");
console.log(JSON.stringify({compiled_charters:24,authority_enforced:true,blindness_enforced:true,retraction_transitive:true,epistemic_ceiling:true}));

