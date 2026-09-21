import {getRole,selectCards,DEFAULT_MAX_BYTES} from '../catalog/index.mjs';
import {validatePlan} from './plans.mjs';
import {check, clone, sha256,canonical,integer,keys,list,object,unique} from './contracts.mjs';
import {blindStage} from './blind-plan.mjs';
import {isInputCopyNode,inputCopyPlanningCapability} from './input-copy-contract.mjs';

/** Known prerequisite discovered by real rejected plans, supplied prospectively.
 * Preserve the WHOLE card, not a hand-written abbreviated substitute. This is
 * a bounded advisory supplement to the directory, not an availability whitelist
 * or proof that accepted inputs exist. The independent judge still sees all
 * selected cards. Other prerequisites remain subject to that same review.
 */
export function planningKnownRoleContracts() {
  const cards=['omega_23'].map(getRole);
  return {schema:'sovereign.planning-known-role-contracts.v1',cards,cardsHash:sha256(cards),
    scope:'Complete source-bound contracts for known input-order pitfalls, available before the first proposal. Inspect omega_23 input, activation, method and output conditions: it composes previously accepted inputs, not unaccepted acquisition or new factual derivation. A later review cannot supply those earlier inputs. Use it only when the necessary accepted products genuinely exist in the plan; do not add a ceremonial node solely to keep this role. Choose another compatible facet or a justified standalone producer when it can satisfy the same unchanged request. This is not an exhaustive prerequisite inventory and does not certify any role as implemented. Independent plan review retains every selected full contract.'};
}

/** Recovery must not ask the planner to guess the same rejected contracts again.
 * Whole cards only; no summarization of methods, inputs or hard preconditions.
 */
export function planningRoleRecoveryContracts(feedback) {
  const plans=feedback.filter(f=>f.rejectedPlan).map(f=>f.rejectedPlan);
  if(!plans.length)return null;
  const ids=[...new Set(plans.flatMap(p=>p.nodes.flatMap(n=>[...n.roleIds,...n.reviewerRoleIds])))].sort();
  const cards=ids.map(getRole);
  return {schema:'sovereign.planning-role-recovery.v1', rejectedPlanHashes:plans.map(sha256),cards,cardsHash:sha256(cards),
    scope:'Full current packaged contracts for roles in rejected planning attempts, deduplicated without field loss. Compare a replacement assignment against its real inputs, methods and outputs before proposing it. These are target specifications, not authority or evidence of implementation. Do not change the request to fit a role. A compatible standalone charter may supply genuinely missing producer expertise; it cannot supply missing effects or protocols.'};
}

/** Local catalog selection only. The caller must separately retain the control
 * decision and prove a later completed request actually included these bytes. */
export function inspectPlanningRoleContracts(ids,options={}){
  const selection=clone({ids,options});keys(selection.options,['maxBytes'],[]);
  const maxBytes=Object.hasOwn(selection.options,'maxBytes')?selection.options.maxBytes:DEFAULT_MAX_BYTES;
  integer(maxBytes,'planning contract bytes',{min:1,max:DEFAULT_MAX_BYTES});
  const cards=selectCards(selection.ids,{maxBytes});
  const result={schema:'sovereign.planning-role-inspection.v1',cards:clone(cards),cardsHash:sha256(cards),
    scope:'Full current source-bound role contracts selected locally; not a completed inference, observed reading, compatibility judgment, execution certificate or acceptance. Include every required contract in the final planning request and keep independent plan review.'};
  check(Buffer.byteLength(JSON.stringify(result))<=maxBytes,'PLANNING_CONTRACT_LIMIT','Complete planning contract envelope exceeds the byte limit; nothing truncated');
  return result;
}

const planningCollections=Object.freeze({knownRoleContracts:'sovereign.planning-known-role-contracts.v1',
  rejectedRoleContracts:'sovereign.planning-role-recovery.v1',inspectedRoleContracts:'sovereign.planning-role-inspection.v1'});
/** Pure presence diagnostic, NOT evidence of a dispatch, completed inference,
 * semantic fit or accepted plan. Only the three designated task collections
 * count. The eventual control-plane caller must bind this task to the exact
 * retained request/completion; a caller-supplied coverage object proves nothing. */
export function planningRoleCoverage(proposal,task){
  // Capture JSON once before field reads; accessors are not task evidence.
  const captured=clone({proposal,task});proposal=captured.proposal;task=captured.task;
  object(proposal);object(task);list(proposal.nodes,'proposed nodes',{min:1,max:256});
  const requiredRoleIds=[...new Set(proposal.nodes.flatMap(n=>{
    object(n);list(n.roleIds,'producer role IDs',{max:30});list(n.reviewerRoleIds,'reviewer role IDs',{min:1,max:30});
    unique(n.roleIds);unique(n.reviewerRoleIds);return [...n.roleIds,...n.reviewerRoleIds];
  }))].sort();requiredRoleIds.forEach(getRole);
  const available=new Map(readPlanningInventory(task).map(item=>[item.id,item]));
  const missingRoleIds=requiredRoleIds.filter(id=>!available.has(id));
  return {schema:'sovereign.planning-role-coverage.v1',requiredRoleIds,
    included:requiredRoleIds.filter(id=>available.has(id)).map(id=>available.get(id)),missingRoleIds,complete:missingRoleIds.length===0,
    scope:'Exact full-card presence in the supplied designated task fields, not completion, comprehension, compatibility, implementation or acceptance. Retained request/completion binding and independent substantive plan review remain required.'};
}
/** Entire validated inventory, including contracts not selected by a proposal.
 * Local presence only; the response reader supplies completed-request binding. */
export function planningContractInventory(task){return readPlanningInventory(clone(task));}
function readPlanningInventory(task){
  object(task);const available=new Map();
  for(const [location,schema]of Object.entries(planningCollections)){
    const collection=task[location];if(collection===undefined||collection===null)continue;
    const fields=['schema','cards','cardsHash','scope',...(location==='rejectedRoleContracts'?['rejectedPlanHashes']:[])];
    keys(collection,fields);
    check(collection.schema===schema,'PLANNING_CONTRACT_INTEGRITY','Unrecognized designated planning contract schema');
    list(collection.cards,'complete planning cards',{max:154});unique(collection.cards.map(c=>c.id));
    check(collection.cardsHash===sha256(collection.cards),'PLANNING_CONTRACT_INTEGRITY','Planning card collection hash differs');
    for(const card of collection.cards){
      check(canonical(card)===canonical(getRole(card.id)),'PLANNING_CONTRACT_INTEGRITY','Planning card differs from its full packaged contract');
      if(!available.has(card.id))available.set(card.id,{id:card.id,cardHash:sha256(card),locations:[]});
      available.get(card.id).locations.push(location);
    }
  }
  return [...available.values()].sort((a,b)=>a.id.localeCompare(b.id));
}

/** Exact current packaged contracts for the roles a plan proposes to assign.
 * These describe target obligations, never additional reviewer identities.
 */
export function planRoleReviewContext(artifact, intent) {
  if (artifact.payload.nodeId !== 'planning' || artifact.payload.purpose !== 'plan'
    || artifact.payload.kind !== 'mission-plan') return null;
  check(artifact.payloadHash === sha256(artifact.payload), 'ARTIFACT_INTEGRITY', 'Plan role review requires the exact candidate');
  const plan = JSON.parse(artifact.payload.body); validatePlan(plan, intent);
  const assignments = plan.nodes.map(n => ({nodeId:n.id, purpose:n.purpose,
    producerRoleIds:clone(n.roleIds), reviewerRoleIds:clone(n.reviewerRoleIds),
    ...(isInputCopyNode(n)?{execution:clone(n.execution),producerMode:'native-literal-copy',nativeContract:inputCopyPlanningCapability()}
      :blindStage(n)?{execution:clone(n.execution),producerMode:blindStage(n)==='comparison'?'deterministic-oracle':'closed-replicator'}
      :n.roleIds.length===0?{standaloneSpecialist:clone(n.specialist)}:{})}));
  const ids = [...new Set(assignments.flatMap(a => [...a.producerRoleIds, ...a.reviewerRoleIds]))].sort();
  const cards = ids.map(id => getRole(id));
  return {schema:'sovereign.plan-role-contracts.v1', artifactId:artifact.id,
    artifactHash:artifact.payloadHash, assignments, cards, cardsHash:sha256(cards),
    standaloneRule:'An empty producerRoleIds requires a full standaloneSpecialist charter, except the explicitly typed deterministic-oracle comparison or native-literal-copy: neither makes a producer inference or catalog-role claim. For a native literal copy, inspect the full nativeContract and source context: the selection must be the intended user object, not merely a matching substring; fidelity is not truth. A closed-replicator uses its whole blind card through its registered adapter, never an ordinary worker. Inspect the complete typed lane, prior protocol, private control edges, closed attempt review, subsequent opening and report review; only whole-text equality and exact decimal distance are implemented. Compare each specialist question, methods, falsifier, benefit and completion against the node and request. Declarations do not supply missing tools, protocols or evidence. Reviewers still require compatible full contracts. Preserve every frozen requirement.',
    scope:'Complete current packaged cards of every assigned target role, deduplicated by ID without omitting fields. Catalog descriptions are not implementation certificates or instructions to perform those roles. Compare proposed purpose, method, inputs, output and independence against them. Ordinary checking is not blind replication. Report incompatible assignments and unavailable material methods; do not approve merely from a plausible title. A source reference in a card is provenance, not a fetched source for the mission.'};
}
