// Project context is a controller-private input binding.  Its bytes live only
// in the ordinary immutable mission-input snapshot; neither the mission
// mandate nor the binding record contains a copy.  The binding is deliberately
// separate from `policy`: policy has a public projection contract, while this
// descriptor is a private routing/control-plane concern.
import {canonical,check,clone,digest,identifier,keys,sha256,string} from './contracts.mjs';
import {missionInputManifest} from './mission-inputs.mjs';
import {relativePath} from '../tools/workspace-files.mjs';

export const PROJECT_CONTEXT_BINDING_SCHEMA='sovereign.project-context-binding.v1';
export const PROJECT_CONTEXT_BINDING_TYPE='project-context-binding';
export const PROJECT_CONTEXT_CLASSIFICATION='project-context-untrusted-v1';
export const PROJECT_CONTEXT_INTAKE_METHOD='project-context-intake-v1';
export const PROJECT_CONTEXT_INTAKE_OUTPUT='project-context-intake';

const integrity=(condition,message)=>check(condition,'PROJECT_CONTEXT_INTEGRITY',message);
const admission=(condition,message)=>check(condition,'PROJECT_CONTEXT_ADMISSION',message);
const exact=(value,allowed,required=allowed,label='project context')=>keys(value,allowed,required,label);

function descriptor(value,{code='PROJECT_CONTEXT_ADMISSION'}={}){
  const assert=(condition,message)=>check(condition,code,message);
  try{exact(value,['path','sha256','classification','requiredRead']);}
  catch(error){if(error.code===code)throw error;throw Object.assign(error,{code});}
  try{relativePath(value.path);digest(value.sha256,'project context input hash');}
  catch(error){if(error.code===code)throw error;throw Object.assign(error,{code});}
  assert(value.classification===PROJECT_CONTEXT_CLASSIFICATION,
    'Project context classification is not the immutable untrusted-context contract');
  assert(value.requiredRead===true,'Project context must require an explicit broker read before use');
  return {path:value.path,sha256:value.sha256,classification:value.classification,requiredRead:true};
}

function bindingShape(value,{code='PROJECT_CONTEXT_INTEGRITY'}={}){
  const assert=(condition,message)=>check(condition,code,message);
  try{exact(value,['schema','missionId','intentHash','inputManifestHash','descriptor','scope']);
    identifier(value.missionId,'project context mission ID');digest(value.intentHash,'project context intent hash');
    digest(value.inputManifestHash,'project context input manifest hash');
    string(value.scope,'project context scope',{max:1000});
  }catch(error){if(error.code===code)throw error;throw Object.assign(error,{code});}
  assert(value.schema===PROJECT_CONTEXT_BINDING_SCHEMA,'Unknown project context binding schema');
  assert(value.scope===PROJECT_CONTEXT_SCOPE,'Project context binding scope changed');
  const normalized=descriptor(value.descriptor,{code});
  return {schema:PROJECT_CONTEXT_BINDING_SCHEMA,missionId:value.missionId,intentHash:value.intentHash,
    inputManifestHash:value.inputManifestHash,descriptor:normalized,scope:PROJECT_CONTEXT_SCOPE};
}

const PROJECT_CONTEXT_SCOPE='Controller-private admitted project context. The descriptor contains only a normalized workspace path, content hash, fixed untrusted classification and required-read control; it carries no source bytes, host provenance, policy authority, factual verification, public-report entitlement or provider instruction.';

/**
 * Normalize an admission-time descriptor against the already captured input
 * list.  The caller never supplies bytes here: the SHA-256 must name exactly
 * one immutable input snapshot which is committed in the same transaction.
 */
export function makeProjectContextBinding({missionId,intentHash,inputManifestHash,inputs,projectContext}={}){
  if(projectContext===undefined)return null;
  identifier(missionId,'project context mission ID');digest(intentHash,'project context intent hash');
  digest(inputManifestHash,'project context input manifest hash');
  admission(Array.isArray(inputs)&&inputs.length>0,'Project context requires an explicit admitted input manifest');
  const normalized=descriptor(projectContext),matches=inputs.filter(input=>input?.path===normalized.path&&input?.sha256===normalized.sha256);
  admission(matches.length===1,'Project context must bind exactly one named admitted input path and hash');
  return clone({schema:PROJECT_CONTEXT_BINDING_SCHEMA,missionId,intentHash,inputManifestHash,
    descriptor:normalized,scope:PROJECT_CONTEXT_SCOPE});
}

/** Write the private record only after the mission and its input manifest exist
 * in the same outer transaction.  `projectContextBindingHash` is in mission@1
 * solely as a private frozen commitment; it is intentionally omitted by every
 * public mission projection. */
export function commitProjectContextBinding(store,mission,binding){
  if(!binding)return null;
  integrity(store?.db?.isTransaction,'Project context admission requires the mission publication transaction');
  const normalized=bindingShape(binding);
  integrity(mission?.id===normalized.missionId&&mission.intentHash===normalized.intentHash
    &&mission.inputManifestHash===normalized.inputManifestHash,'Project context differs from the frozen mission/input admission');
  integrity(mission.projectContextBindingHash===sha256(normalized),'Mission does not commit the exact private project context binding');
  const manifest=missionInputManifest(store,mission.id);
  integrity(manifest&&sha256(manifest)===normalized.inputManifestHash,'Project context input manifest is absent or changed before binding');
  const file=manifest.files.filter(item=>item.path===normalized.descriptor.path&&item.sha256===normalized.descriptor.sha256);
  integrity(file.length===1,'Project context input no longer names one immutable admitted file');
  // A new execution protocol floor makes an older executor fail closed rather
  // than silently treating this required context as an ordinary attachment.
  store.requireExecutionProtocol(16);
  return store.put(PROJECT_CONTEXT_BINDING_TYPE,mission.id,normalized,{expectedVersion:0});
}

function missionVersions(store,missionId){
  return store.db.prepare('SELECT version FROM records WHERE type=? AND id=? ORDER BY version')
    .all('mission',missionId).map(row=>store.get('mission',missionId,row.version));
}

/**
 * Read a descriptor for an internal actor.  This is intentionally a strict
 * verifier, not a fallback: adding, replacing, re-versioning or later
 * removing the binding fails closed.  It returns no input bytes.
 */
export function projectContextDescriptor(store,missionId){
  identifier(missionId,'project context mission ID');
  const current=store.get('mission',missionId),origin=store.get('mission',missionId,1),record=store.get(PROJECT_CONTEXT_BINDING_TYPE,missionId);
  const originHas=Object.hasOwn(origin?.data??{},'projectContextBindingHash');
  const currentHas=Object.hasOwn(current?.data??{},'projectContextBindingHash');
  if(!originHas&&!currentHas&&!record)return null;
  integrity(current?.data?.id===missionId&&origin?.version===1&&origin.data?.id===missionId,
    'Project context requires the exact current mission and its version-one admission');
  integrity(originHas&&currentHas&&typeof origin.data.projectContextBindingHash==='string'
    &&origin.data.projectContextBindingHash===current.data.projectContextBindingHash,
    'Project context mission commitment was added, removed or changed after admission');
  digest(origin.data.projectContextBindingHash,'project context binding hash');
  const versions=missionVersions(store,missionId);
  integrity(versions.length>0&&versions.every(item=>item?.data?.projectContextBindingHash===origin.data.projectContextBindingHash),
    'Project context commitment changed in historical mission lifecycle');
  integrity(record?.type===PROJECT_CONTEXT_BINDING_TYPE&&record.id===missionId&&record.version===1
    &&store.get(PROJECT_CONTEXT_BINDING_TYPE,missionId,1)?.hash===record.hash,
    'Project context binding record is missing, replaced or re-versioned');
  const binding=bindingShape(record.data);
  integrity(sha256(binding)===origin.data.projectContextBindingHash,'Project context record differs from the frozen mission commitment');
  integrity(binding.missionId===missionId&&binding.intentHash===origin.data.intentHash&&binding.intentHash===current.data.intentHash
    &&binding.inputManifestHash===origin.data.inputManifestHash&&binding.inputManifestHash===current.data.inputManifestHash,
    'Project context binding differs from immutable mission/input identity');
  const manifest=missionInputManifest(store,missionId);
  integrity(manifest&&sha256(manifest)===binding.inputManifestHash,'Project context input manifest integrity failed');
  const matches=manifest.files.filter(file=>file.path===binding.descriptor.path&&file.sha256===binding.descriptor.sha256);
  integrity(matches.length===1,'Project context descriptor does not bind one immutable admitted file');
  return clone(binding.descriptor);
}

/**
 * The private descriptor is not itself evidence that an intake actor consumed
 * the bound snapshot.  A candidate must carry at least one authenticated own
 * broker read of that exact immutable path/hash.  This helper intentionally
 * operates only on signed receipts: it never receives, stores, or returns the
 * context bytes.
 */
export function assertProjectContextReadReceipts(registry,{missionId,producerRunId,toolReceipts,projectContext}={}){
  identifier(missionId,'project context receipt mission ID');identifier(producerRunId,'project context receipt producer ID');
  const context=descriptor(projectContext,{code:'PROJECT_CONTEXT_INTEGRITY'});
  const required=(condition,message)=>check(condition,'PROJECT_CONTEXT_READ_REQUIRED',message);
  integrity(registry&&typeof registry.verifiedToolReceipt==='function','Project context receipt verifier is unavailable');
  integrity(Array.isArray(toolReceipts),'Project context candidate receipts are malformed');
  let exactRead=null;
  for(const signed of toolReceipts){
    const receipt=registry.verifiedToolReceipt(signed);
    if(receipt.missionId!==missionId||receipt.principalId!==producerRunId||receipt.tool!=='workspace.read'
      ||receipt.status!=='SUCCEEDED'||receipt.result?.path!==context.path)continue;
    required(receipt.result.sha256===context.sha256&&typeof receipt.result.content==='string'
      &&sha256(receipt.result.content)===context.sha256,
    'Project context intake did not read the exact bound immutable bytes');
    exactRead??=receipt;
  }
  required(exactRead!==null,'Project context intake requires an authenticated own workspace.read of the exact bound file');
  return true;
}

export function assertProjectContextArtifactRead(registry,artifact,projectContext){
  if(!projectContext)return true;
  const payload=artifact?.payload;
  integrity(payload&&typeof payload==='object'&&payload.missionId===artifact.missionId,
    'Project context product payload is absent or belongs to another mission');
  return assertProjectContextReadReceipts(registry,{missionId:artifact.missionId,producerRunId:payload.producerRunId,
    toolReceipts:payload.toolReceipts,projectContext});
}

/** Private routing predicate.  The public plan contains only this fixed method
 * marker, never the path/hash, so a project-context plan can be audited
 * without turning its descriptor into report data. */
export const isProjectContextIntakeNode=node=>node?.method?.id===PROJECT_CONTEXT_INTAKE_METHOD;

/**
 * Enforce a first, reviewed intake boundary without putting the descriptor in
 * the plan.  All downstream products wait on the accepted intake artifact;
 * the intake producer/reviewer must independently read the descriptor path at
 * runtime (enforced by WorkerService and ordinary input-file review).
 */
export function validateProjectContextPlan(plan,projectContext){
  if(!projectContext)return null;
  const context=descriptor(projectContext,{code:'PROJECT_CONTEXT_INTEGRITY'});
  const serialized=canonical(plan);
  integrity(!serialized.includes(context.path)&&!serialized.includes(context.sha256),
    'A public plan must not copy the private project context path or hash');
  const intake=plan.nodes.filter(isProjectContextIntakeNode);
  integrity(intake.length===1,'Project context requires exactly one first intake node');
  const node=intake[0];
  integrity(node.id!==plan.finalNodeId&&node.dependencies.length===0&&node.outputKind===PROJECT_CONTEXT_INTAKE_OUTPUT
    &&node.requiredEffects.length===0&&node.tools.length===1&&node.tools[0]==='workspace.read',
    'Project context intake must be an effect-free root that only receives workspace.read authority');
  const byId=new Map(plan.nodes.map(item=>[item.id,item]));
  const dependsOnIntake=(nodeId,seen=new Set())=>{
    if(nodeId===node.id)return true;
    if(seen.has(nodeId))return false;seen.add(nodeId);
    return (byId.get(nodeId)?.dependencies??[]).some(dependency=>dependsOnIntake(dependency.nodeId,seen));
  };
  integrity(plan.nodes.filter(item=>item.id!==node.id).every(item=>dependsOnIntake(item.id)),
    'Every non-intake project-context product must causally follow the accepted intake');
  return {nodeId:node.id,method:PROJECT_CONTEXT_INTAKE_METHOD,scope:'A controller-bound untrusted project context must be read and independently reviewed before dependent work. The descriptor/path/hash remain private and are not plan/report data.'};
}
