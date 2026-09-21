import {check,clone} from './contracts.mjs';

// Creation-only presentation selection. It does not remove epistemic or review
// obligations: the existing immutable artifact and independent checks keep them.
export const BOUNDED_READ_PRESENTATION='separate-evidence-v1';
export function separateBoundedEvidence(mission){
  const value=mission?.policy?.boundedReadPresentation;
  if(value===undefined)return false;
  check(value===BOUNDED_READ_PRESENTATION&&mission.policy.entryMode==='bounded-read-response-v1',
    'BOUNDED_READ_BINDING','Unsupported bounded presentation or scope');return true;
}
export const BOUNDED_PRESENTATION_INSTRUCTIONS='Presentation separate-evidence-v1: use claims:[]. Body is the COMPLETE requested deliverable, including its exact format, language and every requested clause. Do not append citations, premises, proof text or extra JSON fields when the original request expressly excludes them. If the original request requires citations, explanation, public derivation or provenance in the delivered text, include ALL of them in body in the requested form; this rule never waives such obligations. The original full mandate, actual complete input observations and signed tool receipts remain retained outside body. The independent reviewer must inspect those premises, perform its own verification and record sufficient public derivation and exact evidence in its review checks, separately from the delivered body. A short producer method is not proof or self-acceptance. Never fabricate sources, promote supplied data to empirical truth, omit an external premise or replace a mandatory planning process. A restricted output format alone is not a missing premise or reason to abandon an otherwise eligible complete request.';
export const BOUNDED_PRESENTATION_REVIEW='Presentation separate-evidence-v1: the candidate body is the complete requested deliverable, not a container for this independent review. Preserve and check EVERY original output requirement. When exact text or a closed JSON format excludes supplementary proof or citations, do not demand extra body fields: put sufficient public premises, recalculation and actual verbatim evidence in YOUR review check reasons/evidence. Inspect the full immutable request and your own post-candidate version-matched file observations when a file was used. If the user explicitly requested explanation, citations or provenance IN the deliverable, their omission is still a material defect. Neither format compliance, retained receipt metadata nor the producer method proves substantive correctness. Never repair or rewrite the candidate; unresolved obligations require RETURN or UNKNOWN.';
export function boundedPresentationSchema(base){
  const schema=clone(base);
  schema.properties.body.description=BOUNDED_PRESENTATION_INSTRUCTIONS;
  schema.properties.claims.maxItems=0;
  schema.properties.claims.description='Exactly [] for the selected closed-premise bounded response. Actual file observations are bound in signed toolReceipts, not fabricated documentary source IDs. Preserve all original output requirements in body; independent public verification is recorded in separate reviewer checks under separate-evidence-v1. No external factual claim is made supported merely by this empty array.';
  return schema;
}
