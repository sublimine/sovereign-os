import {check,sha256} from './contracts.mjs';
import {validatePlan} from './plans.mjs';
import {blindStage} from './blind-plan.mjs';
import {isInputCopyNode} from './input-copy-contract.mjs';

// Payload availability is different from ancestry availability. These are
// prospective field contracts, not future values or evidence of an execution.
// Integration tests bind every field to the actual reviewer input/observation.
export function closedProductExposure(stage){
  const common={schema:'Exact native schema discriminator.',replicationId:'Identity of the preregistered attempt.',
    publicProtocol:'COMPLETE frozen public protocol section, including question, premises/scope, method, controls, stopping, varying dimensions, shared roots, limitations and exact comparison rule. This is content, not only a hash or approval label.'};
  if(stage==='material')return {schema:'sovereign.closed-blind-attempt.v1',fields:{...common,
    result:'COMPLETE sealed response: status, result text, public argument, control observations/verdicts, deviations and unknowns.'},
    excluded:'Original body and private protocol wrapper/bindings, global plan and other producers conversations remain excluded.'};
  if(stage==='comparison')return {schema:'sovereign.closed-blind-comparison.v1',fields:{...common,
    original:'Opened original ID/hash, COMPLETE body and status at opening. Its body is not automatically a certified fact.',
    materialArtifact:'Exact reviewed material artifact ID/hash.',opening:'Committed opening record reference.',
    replica:'COMPLETE sealed response, unchanged from the accepted material attempt.',
    comparison:'Exact native rule evaluation, distance when valid, outcome, control residuals and remaining obligations.'},
    authenticatedEvidence:'The actor-scoped artifact-blind-comparison observation additionally binds the historical protocol/original approval and bilateral closed exposure: exact completed replica and material-reviewer context versions, retained public requests, inference receipts and material judgment before opening. Inspect full request content; RECORDED is coverage, not semantic nonexposure. Missing retention stays UNKNOWN. These proofs exist only after opening, not as extra report-body fields, private reasoning or automatic semantic verdicts.',
    excluded:'Private protocol WRAPPER and upstream artifact histories are not exposed by inputRef ancestry. This does NOT exclude the complete publicProtocol content embedded in this report.'};
  return null;
}

/** Prospective availability contract, not evidence that an operation happened. */
export function reviewEvidenceBoundary() {
  return {schema:'sovereign.review-evidence-boundary.v1',
    candidate:'The exact current candidate is reviewed after its production. Its own independent review is committed atomically, not required as a previous completed event.',
    factualClaims:{acquisition:'A direct fact or inference premise must name an exact ADMITTED source whose raw bytes, metadata and hash still match its signed successful source.fetch receipt and committed broker effect. Acquisition establishes provenance, not factual truth or acceptance.',
      verification:'For ordinary ACCEPT, a reviewer with a separate run, provider thread and private context must independently cite every direct acquired source version used by a factual claim. Documentary ACCEPT instead binds the reviewer to its own literal source window for each premise. Accepted input products retain their own exact review path; this rule does not require duplicate fetching.',
      limits:'A cited source proves acquired bytes and reviewer exposure, not entailment. The applicable content criteria and independent judgment still decide support, contradictions, UNKNOWN and acceptance.'},
    localFileInputs:{protocol:'input-file-review-v1',acquisition:'Before ordinary or documentary judgment, the controller issues reviewer-owned workspace.read operations for the original file inputs actually observed by the producer. It binds the pre-candidate producer observations, requires the same complete version, and exposes the new receipts for the independent calculation and citations. Written output paths keep their existing output-version checks.',
      limits:'The ordinary judge returns a judgment, not tool proposals. Do not invent a request/resume channel for it or add a ceremonial producer to trigger this acquisition. A read-only input is not a required file-writing effect. Conflicting observed input versions require explicit disposition. Source documents and accepted ancestor products retain their separate contracts; this is not blanket re-acquisition of all historical material.',
      acceptance:'Every bound file input needs a cited own post-candidate read and a current-state check. The contract describes available control behavior, not evidence that any future read, recalc or review has occurred.'},
    ancestry:'Ordinary reviewers receive candidate and declared inputRef ancestry. Typed closed stages carry private controller-verified dependencies, not model-visible inputRefs: the material judge sees only its public attempt and authenticated public scope; the comparison judge sees the exact report with the opened original embedded and authenticated recomputation. Traversal stops at these closed products. Production-scope inventories describe actual admitted artifacts, not promised exposure.',
    closedProductContent:{material:closedProductExposure('material'),comparison:closedProductExposure('comparison'),
      interpretation:'An unexposedProductNodeId means the upstream artifact is not traversed, NOT that all of its public content is absent. Both native bodies embed the complete publicProtocol; the comparison also embeds the complete opened original. Those actual bytes can support semantic inspection of public method and incidental hints once produced. At plan time these are guaranteed shapes only, not a passed check. Actual actor-scoped artifact-blind-material/comparison observations bind and recompute the respective bodies; they do not replace substantive review or disclose private upstream conversations.'},
    producerInputs:'Execution producers can inspect production-scope inventories only for accepted material inputs already admitted to their context. They do not receive unrelated sibling histories, unaccepted draft histories, prospective current-candidate scopes or current-candidate independent acceptance. Final integration can inspect both accepted parent scopes without exposing either root to the other.',
    excluded:'An unrelated sibling, downstream product or future attempt is not automatically exposed. A plan listing a node is not exposure of its product or its production history. No cross-branch completion barrier is provided for a node review.',
    placement:'Place each node-local obligation where its evidence exists. For two independent branches, check each producer own non-consumption at its own boundary; preserve the complete bilateral obligation at the downstream convergence that has both accepted inputs and both production scopes. Do not copy the complete bilateral obligation into each branch when it requires unexposed sibling history. Do not add product dependencies between independent producers just to expose that history.',
    authority:'Never drop or narrow an original requirement or its final criterion to fit this boundary. If the user explicitly requires a different temporal or disclosure protocol, retain it as an unresolved capability, not a silent rewrite.',
    limits:'Metadata proves recorded context admissions and chronology, not all incidental text, model pretraining, host-wide isolation or future events. Missing evidence stays UNKNOWN. This contract describes runtime behavior; it is not a source, receipt or acceptance verdict.'};
}

/** Enumerate the ordinary review ancestry from the exact candidate plan.
 * IDs only: no sibling solutions or invented future artifact identities.
 */
export function planReviewEvidenceContext(artifact,intent) {
  if(artifact.payload.nodeId!=='planning'||artifact.payload.purpose!=='plan'||artifact.payload.kind!=='mission-plan')return null;
  check(artifact.payloadHash===sha256(artifact.payload),'ARTIFACT_INTEGRITY','Review boundary requires the exact planning candidate');
  const plan=JSON.parse(artifact.payload.body);validatePlan(plan,intent);
  const byId=new Map(plan.nodes.map(n=>[n.id,n]));
  const nodes=plan.nodes.map(node=>{
    const included=new Set();
    const visit=id=>{if(included.has(id))return;included.add(id);if(!blindStage(byId.get(id)))byId.get(id).dependencies.forEach(d=>visit(d.nodeId));};
    visit(node.id);
    return {nodeId:node.id,...(isInputCopyNode(node)?{execution:node.execution,candidateBody:{kind:'literal-input-copy',content:'Complete exact selected user text, not JSON, normalized prose or a certified fact.'},authenticatedEvidence:'artifact-input-copy supplies the exact selection, source quote, request hash, prior accepted plan and native chronology; the reviewer also receives the original mission request and plan. Matching bytes alone do not establish correct selection.'}
      :blindStage(node)?{execution:node.execution,privateControlPrerequisites:node.dependencies.map(d=>d.nodeId),candidateBody:closedProductExposure(blindStage(node))}:{}),reviewedProductNodeIds:[...included].sort(),
      unexposedProductNodeIds:plan.nodes.map(n=>n.id).filter(id=>!included.has(id)).sort()};
  });
  return {artifactId:artifact.id,artifactHash:artifact.payloadHash,boundary:reviewEvidenceBoundary(),nodes,
    scope:'Prospective plan topology only. IDs name plan nodes, not acquired artifacts or completed reviews. Each review must still obtain and check actual bound evidence at execution.'};
}
