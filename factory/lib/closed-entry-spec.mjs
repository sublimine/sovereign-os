import {sha256} from './contracts.mjs';

export const CLOSED_ENTRY_MODE='closed-response-v1';
export const CLOSED_ENTRY_NODE='closed-entry';
export const PURPOSE='Answer the complete closed request, or require the full planning path.';
export const ROLES=['omega_02','omega_23'];
export const REVIEWERS=['omega_22'];
const ELIGIBILITY='The ENTIRE original request is a single closed response: all material premises are supplied in the request or are explicit formal definitions, and the answer is only a text transformation, creative composition or a checkable closed derivation. It requires no external empirical fact (even a remembered stable fact), source acquisition, external verification, missing material input, workspace/file delivery, execution, or separate/ordered/blind products. A URL alone is not its content. A partial answer, instructions for doing the work, or a disclaimer cannot replace any requested outcome. If any condition is uncertain or false, this direct candidate MUST NOT be accepted; the full planner must handle the unchanged request.';
export const CLOSED_ENTRY_CRITERIA=Object.freeze([
  {id:'closed-eligibility',text:ELIGIBILITY,evaluation:'content'},
  {id:'complete-request',text:'Compare the candidate against the complete immutable missionIntent, not a producer summary. Account for every requested outcome, restriction, format, language and depth. No omitted clause, narrowed substitute, fabricated completion or unsupported assumption. A brief answer is valid only when the request allows it.',evaluation:'content'},
  {id:'closed-correctness',text:'Independently check the substance: recalculate any closed result, check exact transformation fidelity and all relevant edge cases, or check every creative constraint. Every derivation states sufficient public premises/steps to check its result. No external empirical assertions or invented source citations. Supplied assertions remain attributed to the request, not promoted into independently verified facts. Report a concrete counterexample, ambiguity or missing support instead of acceptance when material.',evaluation:'content'},
  {id:'independent',text:'The exact candidate is accepted only by a separate reviewer with a disjoint completed provider thread and no producer conversation.',evaluation:'runtime.independent_review'},
  {id:'no-files',text:'The entire direct-response mission has no file-write intents.',evaluation:'runtime.no_file_writes'},
  {id:'no-code',text:'The entire direct-response mission has no code-execution intents.',evaluation:'runtime.no_code_execution'},
  {id:'no-research',text:'The entire direct-response mission has no external search or source-fetch intents.',evaluation:'runtime.no_source_fetch'},
].map(Object.freeze));
export const CLOSED_ENTRY_SCHEMA=Object.freeze({type:'object',additionalProperties:false,
  properties:{action:{type:'string',enum:['answer','plan']},body:{type:'string'},reason:{type:'string'}},required:['action','body','reason']});
export const INSTRUCTIONS=`This is an OPTIONAL closed-response entry, not a universal planner or permission to skip a requested process. ${ELIGIBILITY}
Choose action=plan, body="", and a concise public reason whenever full planning is needed. Do not attempt the product first in that case. Do not provide a proposed answer, subplan, or sibling hints in the reason.
Only for an eligible request choose action=answer with the complete candidate in body and a concise public eligibility reason. The separately assigned reviewer evaluates eligibility, EVERY original requirement and correctness; you cannot approve your own answer. The controller, not you, freezes all acceptance criteria before your response. No tools are exposed by this entry and no tool proposals are accepted. Return only the schema. A formal derivation is not a real-world factual claim. No private reasoning transcript: give only the requested answer and sufficient public checkable derivation.`;

export const CLOSED_ENTRY_V2='closed-response-v2';
export function entryContractHash(mode=CLOSED_ENTRY_MODE){return sha256({version:mode,purpose:PURPOSE,roleIds:mode===CLOSED_ENTRY_V2?[]:ROLES,reviewerRoleIds:REVIEWERS,
  instructions:INSTRUCTIONS,criteria:CLOSED_ENTRY_CRITERIA,schema:CLOSED_ENTRY_SCHEMA});}
