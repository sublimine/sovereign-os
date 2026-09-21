import {canonical,check,clone,keys,sha256} from './contracts.mjs';
import {BLIND_PROTOCOL_CRITERIA} from './blind-replication.mjs';
import {BLIND_MATERIAL_KIND,BLIND_MATERIAL_PURPOSE,BLIND_MATERIAL_CRITERIA} from './blind-material.mjs';
import {BLIND_COMPARISON_PURPOSE,BLIND_COMPARISON_CRITERIA} from './blind-comparison.mjs';
import {CLOSED_PROTOCOL_CONTROL_BOUNDARY} from './closed-protocol-boundary.mjs';
import {isInputCopyNode} from './input-copy-contract.mjs';

export const blindStage=node=>node.execution?.kind==='closed-blind-material-v1'?'material'
  :node.execution?.kind==='closed-blind-comparison-v1'?'comparison':null;
const semantic=criteria=>criteria.map(c=>({...c,evaluation:c.evaluation??'content'}));
const exact=(a,b)=>canonical(a)===canonical(b);
const reference=r=>({type:r.type,id:r.id,version:r.version,hash:r.hash});

/** Add immutable adapter gates before plan review. Never paraphrase or silently
 * replace a colliding gate, remove a user criterion, or change ordinary plans. */
export function normalizeBlindPlan(value){
  const plan=clone(value),added=[];
  const apply=(node,criteria)=>{for(const c of criteria){const existing=node.criteria.find(v=>v.id===c.id);
    check(!existing||exact(semantic([existing]),semantic([c])),'BLIND_PLAN','A proposed mandatory gate cannot change its meaning');
    if(!existing){node.criteria.push(clone(c));added.push({nodeId:node.id,criterionId:c.id});}}};
  for(const material of plan.nodes.filter(n=>blindStage(n)==='material')){
    const protocol=plan.nodes.find(n=>n.id===material.execution.protocolNodeId),comparison=plan.nodes.find(n=>n.id===material.execution.comparisonNodeId);
    check(protocol&&comparison,'BLIND_PLAN','Missing required stage during gate normalization');
    apply(protocol,BLIND_PROTOCOL_CRITERIA);apply(material,BLIND_MATERIAL_CRITERIA);apply(comparison,BLIND_COMPARISON_CRITERIA);
  }
  return {plan,added};
}

export function blindPlanningCapability(){
  return {version:'closed-blind-plan-v1',scope:'Closed tool/effect-free ancestry only; exact whole-string equality or decimal distance, not general semantic comparison. Ordinary role prohibitions remain.',
    contract:'Use execution:null normally. Closed protocol: ordinary node purpose/outputKind=blind-protocol, exactly one raw comparison-target dependency. Material: execution={kind:closed-blind-material-v1,protocolNodeId,comparisonNodeId}, purpose=closed-blind-attempt-assessment, outputKind=closed-blind-attempt, roleIds exactly [veritas_04] or [omega_09], one protocol dependency. Comparison: execution={kind:closed-blind-comparison-v1,materialNodeId}, purpose=closed-blind-comparison, outputKind=deterministic-result, roleIds=[], specialist=null, one material dependency. Reviewers must be nonempty and compatible. Propose criteria:[] for protocol/material; no extra local criteria. Controller inserts their full fixed gates BEFORE independent plan review. Preserve ALL obligations in requirements; the final node receives every final criterion. Comparison always retains its fixed gates. The native report can be final when its complete content and bound evidence meet every obligation. It already embeds the full public protocol and sealed response; exact fields are in reviewEvidenceBoundary.closedProductContent. Add ordinary post-opening convergence only for a remaining deliverable/evidence boundary, with exact accepted dependencies, not merely to copy that report. Put public question, method, controls and exact comparison rule in protocol instructions; runtime supplies the author the full output contract and actual input IDs. Empty criteria describe only the pre-normalization proposal. Protocol/material cannot be final. Private control edges are NOT model-visible ancestry. Preserve returned attempts; never automatically resample. Accepting the raw target for comparison does not certify its claim.'};
}

export function plannedProtocolInstructions(store,missionId,node){
  if(node.purpose!=='blind-protocol'||node.outputKind!=='blind-protocol')return '';
  const plan=store.get('plan',missionId)?.data.plan,materials=plan?.nodes.filter(n=>blindStage(n)==='material'&&n.execution.protocolNodeId===node.id)??[];
  if(!materials.length)return '';
  check(new Set(materials.map(n=>n.roleIds[0])).size===1,'BLIND_PLAN','Shared protocol cannot bind different replica role cards');
  return '\nCLOSED PROTOCOL AUTHOR: Return body as complete JSON {schema:"sovereign.closed-blind-protocol.v1",missionIntentHash,original:{artifactId,hash},roleId,public:{purpose,question,scope,method,tolerance,stopping,controls:[{id,procedure,expected}],varyingDimensions,sharedRoots,limitations,comparison}}. Use missionIntentHash='
    +store.get('mission',missionId).data.intentHash+' and roleId='+materials[0].roleIds[0]
    +'. Bind original artifactId/hash from the actual raw-target accepted inputRef, not the plan or a guessed ID. Public string fields and string arrays must be complete and self-contained; controls nonempty with unique IDs. comparison is {kind:"exact-text-v1"} for complete literal strings, or {kind:"decimal-distance-v1",absoluteTolerance:"nonnegative decimal",unit:"declared unit"}. No inference of tolerance from prose after the outcome. The public packet must omit the private original answer, hints, author prestige and binding IDs/hashes. Retain all supplied independent premises, controls, stopping and limitations. claims=[], no tool/effect claims. Protocol approval is a separate reviewer seeing actual original and plan; it is not replication or original-claim acceptance. '+CLOSED_PROTOCOL_CONTROL_BOUNDARY;
}

/** A typed control edge is private to the controller, not an inputRef visible
 * to the closed judge. Ordinary nodes keep their exact inputRef obligations. */
export function validateBlindPlan(plan,{proposal=false}={}){
  if(proposal)plan=normalizeBlindPlan(plan).plan;
  const nodes=new Map(plan.nodes.map(n=>[n.id,n]));
  for(const node of plan.nodes){
    if(node.execution==null||isInputCopyNode(node))continue;
    const stage=blindStage(node);check(stage,'BLIND_PLAN','Unknown execution adapter');
    keys(node.execution,stage==='material'?['kind','protocolNodeId','comparisonNodeId']:['kind','materialNodeId']);
    const material=stage==='material'?node:nodes.get(node.execution.materialNodeId);
    check(material&&blindStage(material)==='material','BLIND_PLAN','Comparison must reference a closed material node');
    const protocol=nodes.get(material.execution.protocolNodeId),comparison=nodes.get(material.execution.comparisonNodeId);
    check(protocol&&comparison&&blindStage(comparison)==='comparison'&&comparison.execution.materialNodeId===material.id
      &&(stage!=='comparison'||comparison.id===node.id),'BLIND_PLAN','Closed stages must form one reciprocal assignment');
    check(!protocol.execution&&protocol.purpose==='blind-protocol'&&protocol.outputKind==='blind-protocol'
      &&protocol.dependencies.length===1&&nodes.has(protocol.dependencies[0].nodeId),
      'BLIND_PLAN','Protocol must be an ordinary independently reviewed product with one exact original prerequisite');
    check(protocol.id!==plan.finalNodeId&&material.id!==plan.finalNodeId,'BLIND_PLAN','Protocol or blind attempt cannot replace final integration');
    for(const [target,gates] of [[protocol,BLIND_PROTOCOL_CRITERIA],[material,BLIND_MATERIAL_CRITERIA]])
      check(exact(semantic(target.criteria),semantic(gates)),'BLIND_PLAN',
        `Node ${target.id}: only the exact fixed closed gates are permitted. Propose criteria:[] here; retain every user obligation in requirements and public method/control details in protocol instructions. Nothing may be silently discarded.`);
    check(material.purpose===BLIND_MATERIAL_PURPOSE&&material.outputKind===BLIND_MATERIAL_KIND
      &&material.roleIds.length===1&&['veritas_04','omega_09'].includes(material.roleIds[0])&&material.specialist===null,
      'BLIND_PLAN','Material uses exactly one complete blind-replication card, not an ordinary producer');
    check(comparison.purpose===BLIND_COMPARISON_PURPOSE&&comparison.outputKind==='deterministic-result'
      &&comparison.roleIds.length===0&&comparison.specialist===null,'BLIND_PLAN','Comparison is the declared deterministic oracle, not a ceremonial producer');
    check(BLIND_COMPARISON_CRITERIA.every(c=>semantic(comparison.criteria).some(v=>exact(v,{...c,evaluation:'content'}))),
      'BLIND_PLAN','Comparison cannot waive its mandatory gates; all additional user criteria remain');
    for(const [child,parent] of [[material,protocol],[comparison,material]])check(child.dependencies.length===1
      &&child.dependencies[0].nodeId===parent.id&&child.dependencies[0].purpose===parent.purpose,
      'BLIND_PLAN','Closed control prerequisite must be exact and exclusive');
    const visited=new Set(),pure=n=>{if(visited.has(n.id))return;visited.add(n.id);
      check(n.tools.length===0&&n.requiredEffects.length===0,'BLIND_PLAN','This closed lane cannot import tool/effect-bearing ancestry');
      for(const d of n.dependencies){const parent=nodes.get(d.nodeId);check(parent,'BLIND_PLAN','Missing closed ancestry');pure(parent);}};
    pure(comparison);
  }
}

export function createBlindPlanBinding(registry,missionId,materialNodeId,protocolArtifactId){
  const {store}=registry,plan=store.get('plan',missionId);
  check(plan,'BLIND_PLAN','Installed independently accepted plan required');validateBlindPlan(plan.data.plan);
  const material=plan.data.plan.nodes.find(n=>n.id===materialNodeId);
  check(blindStage(material??{})==='material','BLIND_PLAN','Exact material assignment required');
  const protocol=plan.data.plan.nodes.find(n=>n.id===material.execution.protocolNodeId);
  const comparison=plan.data.plan.nodes.find(n=>n.id===material.execution.comparisonNodeId);
  const accepted=store.get('artifact',plan.data.acceptedPlanArtifactId);
  const binding={schema:'sovereign.blind-plan-binding.v1',missionId,planArtifact:reference(accepted),
    planHash:sha256(plan.data.plan),protocol:clone(protocol),material:clone(material),comparison:clone(comparison),protocolArtifactId};
  assertBlindPlanBinding(registry,binding);return binding;
}

/** A different plan ID/hash is not a new-experiment authorization. Current
 * closed registrations bind the entire accepted plan, even before dispatch.
 * A future reviewed campaign/recovery contract must explicitly supersede that
 * boundary; ordinary automatic replanning cannot retroactively invent one. */
export function assertProspectiveBlindReplan(registry,missionId){
  for(const record of registry.store.list('blind-registration')){
    check(record.version===1,'BLIND_INTEGRITY','A closed registration cannot be rewritten');
    const data=registry.authority.open(record.data.signed,'blind.registration');
    check(!(data.missionId===missionId&&data.planBinding),'BLIND_REPLAN_REQUIRED',
      'A frozen closed attempt already binds this mission plan. Preserve its result, uncertainty, judgments and budget; a replacement plan alone cannot authorize another replica. An explicit prospective recovery contract is required.');
  }
}
export function assertBlindPlanBinding(registry,binding,{current=true,before=null}={}){
  const {store}=registry,r=binding?.planArtifact;
  check(binding?.schema==='sovereign.blind-plan-binding.v1'&&r?.type==='artifact','BLIND_PLAN_BINDING','Invalid planned binding');
  const artifact=store.get(r.type,r.id,r.version);
  check(artifact&&artifact.hash===r.hash&&artifact.data.status==='ACCEPTED'&&artifact.data.missionId===binding.missionId
    &&artifact.data.payload.purpose==='plan','BLIND_PLAN_BINDING','Exact accepted plan history required');
  const acceptedAt=registry.committedSequence(r.type,r.id,r.version);
  check(Number.isSafeInteger(acceptedAt)&&acceptedAt>0&&(before===null||Number.isSafeInteger(before)&&before>acceptedAt),
    'BLIND_PLAN_BINDING','Plan acceptance must have committed before registration, never be added retrospectively');
  let plan;try{plan=JSON.parse(artifact.data.payload.body);}catch{}
  check(plan&&sha256(plan)===binding.planHash,'BLIND_PLAN_BINDING','Plan body changed');validateBlindPlan(plan);
  for(const stage of ['protocol','material','comparison'])check(exact(plan.nodes.find(n=>n.id===binding[stage]?.id),binding[stage]),
    'BLIND_PLAN_BINDING','Stage assignment differs from the prior accepted plan');
  check(binding.material.execution.protocolNodeId===binding.protocol.id&&binding.material.execution.comparisonNodeId===binding.comparison.id,
    'BLIND_PLAN_BINDING','Stages belong to another lane');
  if(current){
    const now=store.get('plan',binding.missionId);
    check(now?.data.acceptedPlanArtifactId===r.id&&sha256(now.data.plan)===binding.planHash,
      'BLIND_PLAN_BINDING','Plan has been replaced; old sealed work cannot be rebound');
    registry.assertUsable(r.id,{missionId:binding.missionId,purpose:'plan'});
    const protocol=store.get('node',`${binding.missionId}:${binding.protocol.id}`)?.data;
    check(protocol?.status==='ACCEPTED'&&protocol.artifactId===binding.protocolArtifactId,
      'BLIND_PLAN_BINDING','Planned protocol prerequisite is not accepted');
  }
  return binding;
}

export function blindPlanProductDependency(registry,node,artifact){
  const stage=blindStage(node.spec);check(stage,'BLIND_PLAN_BINDING','Only a typed closed adapter uses private control edges');
  let body;try{body=JSON.parse(artifact.payload.body);}catch{}
  const registration=registry.store.get('blind-registration',body?.replicationId);
  check(registration?.version===1,'BLIND_PLAN_BINDING','Exact prior registration required');
  const data=registry.authority.open(registration.data.signed,'blind.registration'),binding=data.planBinding;
  assertBlindPlanBinding(registry,binding);
  check(exact(binding[stage],node.spec)&&data.missionId===node.missionId,'BLIND_PLAN_BINDING','Product belongs to another planned stage');
  if(stage==='material')return {artifactId:data.protocolRef.id,hash:registry.store.get('artifact',data.protocolRef.id).data.payloadHash,purpose:'blind-protocol'};
  const state=registry.store.get('blind-replication',data.replicationId)?.data,material=registry.store.get('artifact',state?.materialArtifactId)?.data;
  check(material,'BLIND_PLAN_BINDING','Comparison has no bound material input');
  return {artifactId:material.id,hash:material.payloadHash,purpose:BLIND_MATERIAL_PURPOSE};
}
