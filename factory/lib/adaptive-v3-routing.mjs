// Immutable, model-free routing envelope for adaptive-v3.  It deliberately
// recognizes a closed path only after the admission grammar has accepted an
// exact request under this module's frozen catalog.  This module does not
// create a mission, dispatch a provider, read a store, or perform an effect.
import {canonical,check,clone,sha256,string} from './contracts.mjs';
import {ADAPTIVE_V3_ADMISSION_POLICY_SCHEMA,ADAPTIVE_V3_FORMAL_OPERATORS,
  ADAPTIVE_V3_LITERAL_TRANSFORMS,admitAdaptiveV3Request} from './adaptive-v3-admission.mjs';

export const ADAPTIVE_V3_ROUTING_MODE='deterministic-adaptive-v3';
export const ADAPTIVE_V3_DIRECT_ENTRY_MODE='closed-response-v3';
export const ADAPTIVE_V3_PLANNED_ENTRY_MODE='planned';
export const ADAPTIVE_V3_ROUTING_REVISION=1;
export const ADAPTIVE_V3_ROUTING_CATALOG_SCHEMA='sovereign.adaptive-v3-routing-catalog.v1';
export const ADAPTIVE_V3_STATIC_POLICY_INPUT_SCHEMA='sovereign.adaptive-v3-static-policy-input.v1';
export const ADAPTIVE_V3_FINAL_POLICY_SCHEMA='sovereign.adaptive-v3-final-policy.v1';
export const ADAPTIVE_V3_ROUTE_DECISION_SCHEMA='sovereign.adaptive-v3-route-decision.v1';
export const ADAPTIVE_V3_CLOSED_MATERIALIZATION_PREFLIGHT_SCHEMA='sovereign.adaptive-v3-closed-materialization-preflight.v1';
export const ADAPTIVE_V3_ENTRY_MODES=Object.freeze([ADAPTIVE_V3_PLANNED_ENTRY_MODE,ADAPTIVE_V3_DIRECT_ENTRY_MODE]);
export const ADAPTIVE_V3_ROUTE_DISPOSITIONS=Object.freeze([
  'DIRECT_AS_ADMITTED','HARDENED_TO_PLANNED','PLANNED_AS_REQUESTED',
  'PLANNED_BY_ADMISSION','PLANNED_BY_SELECTOR_GUARD','PLANNED_FOR_INPUTS',
  'PLANNED_FOR_MATERIALIZATION_LIMIT'
]);

const MAX_TARGET_BYTES=8*1024;
const ROUTING_INPUT_CODE='ADAPTIVE_V3_ROUTING_INPUT';
const ROUTING_INTEGRITY_CODE='ADAPTIVE_V3_ROUTE_INTEGRITY';
const freeze=value=>{
  if(value&&typeof value==='object'&&!Object.isFrozen(value)){
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
};
const sortedUnique=values=>[...new Set(values)].sort();
const formalOperands=Object.freeze(Array.from({length:100},(_,value)=>String(value)).sort());

// The admission metadata is authority, not a caller-tunable prompt.  A future
// preset can pass this exact value (or a JSON-equivalent clone); any divergent
// metadata is conservatively routed to planning.
export const ADAPTIVE_V3_ADMISSION_METADATA=freeze({
  schema:ADAPTIVE_V3_ADMISSION_POLICY_SCHEMA,
  literalTransforms:Object.keys(ADAPTIVE_V3_LITERAL_TRANSFORMS).sort(),
  formalOperators:Object.keys(ADAPTIVE_V3_FORMAL_OPERATORS).sort(),
  formalOperands
});
export const ADAPTIVE_V3_ROUTING_CATALOG=freeze({
  schema:ADAPTIVE_V3_ROUTING_CATALOG_SCHEMA,
  revision:ADAPTIVE_V3_ROUTING_REVISION,
  routingMode:ADAPTIVE_V3_ROUTING_MODE,
  admissionPolicy:ADAPTIVE_V3_ADMISSION_METADATA,
  entryModes:ADAPTIVE_V3_ENTRY_MODES,
  inputManifestPolicy:'planning-required-when-present-v1'
});
export const ADAPTIVE_V3_SELECTOR_CATALOG_HASH=sha256(ADAPTIVE_V3_ROUTING_CATALOG);
const ADMISSION_METADATA_CANONICAL=canonical(ADAPTIVE_V3_ADMISSION_METADATA);

function routingInput(condition,message){
  check(condition,ROUTING_INPUT_CODE,message);
}
function strictRecord(value,fields,label,required=fields){
  routingInput(value!==null&&typeof value==='object'&&!Array.isArray(value)&&Object.getPrototypeOf(value)===Object.prototype,
    `${label} must be a plain object`);
  const descriptors=Object.getOwnPropertyDescriptors(value),own=Reflect.ownKeys(value);
  routingInput(own.every(key=>typeof key==='string'&&fields.includes(key)&&descriptors[key].enumerable&&Object.hasOwn(descriptors[key],'value')),
    `${label} contains an unknown, inherited, or accessor field`);
  routingInput(required.every(field=>Object.hasOwn(descriptors,field)),`${label} is missing a required field`);
  return Object.fromEntries(fields.filter(field=>Object.hasOwn(descriptors,field)).map(field=>[field,descriptors[field].value]));
}
function scalarText(value,label,max){
  try { string(value,label,{min:1,max}); }
  catch { routingInput(false,`${label} must be nonempty text within its byte limit`); }
  return value;
}
function digestOrNull(value,label){
  routingInput(value===null||(typeof value==='string'&&/^[a-f0-9]{64}$/.test(value)),`${label} must be null or a SHA256 digest`);
  return value;
}
function exactExecutionTarget(value,requestedModel,requestedReasoningEffort){
  let target;
  try { target=strictRecord(value,['model','reasoningEffort'],'executionTarget'); }
  catch(error){
    if(error?.code===ROUTING_INPUT_CODE)throw error;
    routingInput(false,'executionTarget must be plain canonical data');
  }
  scalarText(target.model,'executionTarget.model',256);
  scalarText(target.reasoningEffort,'executionTarget.reasoningEffort',128);
  routingInput(target.model===requestedModel&&target.reasoningEffort===requestedReasoningEffort,
    'executionTarget must exactly bind the requested model and reasoning effort');
  let serialized;
  try { serialized=canonical(target); }
  catch { routingInput(false,'executionTarget must be canonical JSON data'); }
  routingInput(Buffer.byteLength(serialized)<=MAX_TARGET_BYTES,'executionTarget exceeds its byte limit');
  return clone(target);
}
function normalizeInput(value){
  let input;
  try {
    const fields=['intent','metadata','inputManifestHash','requestedEntryMode','requestedModel','requestedReasoningEffort','executionTarget','closedMaterialization'];
    input=strictRecord(value,fields,'adaptive-v3 route input',fields.slice(0,-1));
  }catch(error){
    if(error?.code===ROUTING_INPUT_CODE)throw error;
    routingInput(false,'adaptive-v3 route input must be plain canonical data');
  }
  scalarText(input.intent,'intent',256*1024);
  digestOrNull(input.inputManifestHash,'inputManifestHash');
  routingInput(input.requestedEntryMode===null||typeof input.requestedEntryMode==='string',
    'requestedEntryMode must be null or text');
  if(input.requestedEntryMode!==null)scalarText(input.requestedEntryMode,'requestedEntryMode',128);
  scalarText(input.requestedModel,'requestedModel',256);
  scalarText(input.requestedReasoningEffort,'requestedReasoningEffort',128);
  const executionTarget=exactExecutionTarget(input.executionTarget,input.requestedModel,input.requestedReasoningEffort);
  return {...input,closedMaterialization:Object.hasOwn(input,'closedMaterialization')?input.closedMaterialization:null,executionTarget};
}
function metadataMatchesCatalog(metadata){
  try { return canonical(metadata)===ADMISSION_METADATA_CANONICAL; }
  catch { return false; }
}
function staticPolicyInput({requestedEntryMode,requestedModel,requestedReasoningEffort,executionTarget}){
  // This is derived before the selected policy and never includes a route or
  // decision hash.  Keeping it acyclic lets a future mission policy reference
  // the route decision without asking the route decision to hash that mission.
  return {
    schema:ADAPTIVE_V3_STATIC_POLICY_INPUT_SCHEMA,
    revision:ADAPTIVE_V3_ROUTING_REVISION,
    routingMode:ADAPTIVE_V3_ROUTING_MODE,
    selectorCatalogHash:ADAPTIVE_V3_SELECTOR_CATALOG_HASH,
    requestedEntryMode,
    requestedModel,
    requestedReasoningEffort,
    executionTarget:clone(executionTarget)
  };
}
function finalPolicy({staticPolicyHash,selectedEntryMode,requestedModel,requestedReasoningEffort,executionTarget}){
  // Deliberately no decisionHash here: the route decision may bind this final
  // policy, while a persisted mission may later bind the route decision.
  return {
    schema:ADAPTIVE_V3_FINAL_POLICY_SCHEMA,
    revision:ADAPTIVE_V3_ROUTING_REVISION,
    routingMode:ADAPTIVE_V3_ROUTING_MODE,
    staticPolicyHash,
    entryMode:selectedEntryMode,
    model:requestedModel,
    reasoningEffort:requestedReasoningEffort,
    executionTarget:clone(executionTarget)
  };
}
function normalizeClosedMaterialization(value,{intentHash,admissionDecisionHash,admissionPolicyHash}){
  if(value===null)return null;
  let preflight;
  try {
    preflight=strictRecord(value,['schema','revision','status','intentHash','inputManifestHash','selectorCatalogHash','admissionDecisionHash','admissionPolicyHash','outputHash'],
      'closedMaterialization');
  }catch(error){
    if(error?.code===ROUTING_INPUT_CODE)throw error;
    routingInput(false,'closedMaterialization must be plain canonical data');
  }
  routingInput(preflight.schema===ADAPTIVE_V3_CLOSED_MATERIALIZATION_PREFLIGHT_SCHEMA,'closedMaterialization schema is unsupported');
  routingInput(preflight.revision===ADAPTIVE_V3_ROUTING_REVISION,'closedMaterialization revision is unsupported');
  routingInput(['READY','RESOURCE_LIMIT'].includes(preflight.status),'closedMaterialization status is unsupported');
  digestOrNull(preflight.intentHash,'closedMaterialization.intentHash');
  digestOrNull(preflight.inputManifestHash,'closedMaterialization.inputManifestHash');
  digestOrNull(preflight.selectorCatalogHash,'closedMaterialization.selectorCatalogHash');
  digestOrNull(preflight.admissionDecisionHash,'closedMaterialization.admissionDecisionHash');
  digestOrNull(preflight.admissionPolicyHash,'closedMaterialization.admissionPolicyHash');
  digestOrNull(preflight.outputHash,'closedMaterialization.outputHash');
  routingInput(preflight.intentHash===intentHash&&preflight.inputManifestHash===null
    &&preflight.selectorCatalogHash===ADAPTIVE_V3_SELECTOR_CATALOG_HASH
    &&preflight.admissionDecisionHash===admissionDecisionHash&&preflight.admissionPolicyHash===admissionPolicyHash,
  'closedMaterialization is not bound to this exact route input');
  routingInput((preflight.status==='READY'&&typeof preflight.outputHash==='string')
    ||(preflight.status==='RESOURCE_LIMIT'&&preflight.outputHash===null),
  'closedMaterialization output binding does not match its status');
  return clone(preflight);
}
function requestedSelection({requestedEntryMode,directAllowed}){
  if(requestedEntryMode===null)return null;
  if(requestedEntryMode===ADAPTIVE_V3_PLANNED_ENTRY_MODE)return ADAPTIVE_V3_PLANNED_ENTRY_MODE;
  if(requestedEntryMode===ADAPTIVE_V3_DIRECT_ENTRY_MODE){
    check(directAllowed,'ROUTE_OVERRIDE_WEAKENS','closed-response-v3 cannot bypass adaptive-v3 planning requirements');
    return ADAPTIVE_V3_DIRECT_ENTRY_MODE;
  }
  check(false,'ROUTE_OVERRIDE_SCOPE','adaptive-v3 accepts only planned or closed-response-v3 entry mode overrides');
}
function disposition({requestedEntryMode,directAllowed,hasInputs,metadataAccepted,materializationBlocked}){
  if(requestedEntryMode===ADAPTIVE_V3_PLANNED_ENTRY_MODE){
    return directAllowed?'HARDENED_TO_PLANNED':'PLANNED_AS_REQUESTED';
  }
  if(directAllowed)return 'DIRECT_AS_ADMITTED';
  if(hasInputs)return 'PLANNED_FOR_INPUTS';
  if(materializationBlocked)return 'PLANNED_FOR_MATERIALIZATION_LIMIT';
  if(!metadataAccepted)return 'PLANNED_BY_SELECTOR_GUARD';
  return 'PLANNED_BY_ADMISSION';
}
function routingReasons({admission,metadataAccepted,hasInputs,materializationBlocked,requestedEntryMode,directAllowed}){
  const reasons=new Set(admission.reasonCodes);
  if(!metadataAccepted)reasons.add('ADMISSION_METADATA_MISMATCH');
  if(hasInputs)reasons.add('INPUT_MANIFEST_PRESENT');
  if(materializationBlocked)reasons.add('CLOSED_MATERIALIZATION_RESOURCE_LIMIT');
  if(requestedEntryMode===ADAPTIVE_V3_PLANNED_ENTRY_MODE&&directAllowed)reasons.add('EXPLICIT_PLANNED_HARDENING');
  return sortedUnique(reasons);
}
function freezeDecision(value){
  const base=clone(value);
  return freeze({...base,decisionHash:sha256(base)});
}

/**
 * Select the only two adaptive-v3 routes without using a model.  All inputs
 * requires resolved model/effort and their exact execution target, so this
 * selector cannot introduce an implicit model substitution.  The optional
 * closedMaterialization descriptor is normalized to null when absent.
 */
export function selectAdaptiveV3Route(value){
  const input=normalizeInput(value),metadataAccepted=metadataMatchesCatalog(input.metadata);
  // Always admit under the selector's own frozen authority.  Divergent caller
  // metadata is recorded as a guard failure and can never expand direct scope.
  const admission=admitAdaptiveV3Request(input.intent,ADAPTIVE_V3_ADMISSION_METADATA);
  const intentHash=sha256(input.intent);
  const closedMaterialization=normalizeClosedMaterialization(input.closedMaterialization,{intentHash,
    admissionDecisionHash:admission.decisionHash,admissionPolicyHash:admission.policyHash});
  routingInput(closedMaterialization===null||admission.route==='CLOSED',
    'closedMaterialization is only valid for an admission-closed request');
  const hasInputs=input.inputManifestHash!==null;
  const materializationBlocked=closedMaterialization?.status==='RESOURCE_LIMIT';
  const directAllowed=metadataAccepted&&!hasInputs&&!materializationBlocked&&admission.route==='CLOSED';
  const requested=requestedSelection({requestedEntryMode:input.requestedEntryMode,directAllowed});
  const selectedEntryMode=requested??(directAllowed?ADAPTIVE_V3_DIRECT_ENTRY_MODE:ADAPTIVE_V3_PLANNED_ENTRY_MODE);
  const staticInput=staticPolicyInput(input),staticPolicyHash=sha256(staticInput);
  const selectedPolicy=finalPolicy({staticPolicyHash,selectedEntryMode,requestedModel:input.requestedModel,
    requestedReasoningEffort:input.requestedReasoningEffort,executionTarget:input.executionTarget});
  const decision={
    schema:ADAPTIVE_V3_ROUTE_DECISION_SCHEMA,
    revision:ADAPTIVE_V3_ROUTING_REVISION,
    routingMode:ADAPTIVE_V3_ROUTING_MODE,
    selectorCatalogHash:ADAPTIVE_V3_SELECTOR_CATALOG_HASH,
    intentHash,
    inputManifestHash:input.inputManifestHash,
    admissionDecision:clone(admission),
    admissionDecisionHash:admission.decisionHash,
    admissionPolicyHash:admission.policyHash,
    closedMaterialization,
    closedMaterializationHash:sha256(closedMaterialization),
    requestedEntryMode:input.requestedEntryMode,
    selectedEntryMode,
    requestedModel:input.requestedModel,
    requestedReasoningEffort:input.requestedReasoningEffort,
    executionTarget:clone(input.executionTarget),
    staticPolicyInput:staticInput,
    staticPolicyHash,
    finalPolicy:selectedPolicy,
    finalPolicyHash:sha256(selectedPolicy),
    disposition:disposition({requestedEntryMode:input.requestedEntryMode,directAllowed,hasInputs,metadataAccepted,materializationBlocked}),
    reasonCodes:routingReasons({admission,metadataAccepted,hasInputs,materializationBlocked,requestedEntryMode:input.requestedEntryMode,directAllowed})
  };
  return freezeDecision(decision);
}

// Exact recomputation catches altered routes, hashes, policy overlays, target
// constraints, dispositions and nested admission proofs before an integrator
// can trust a caller-supplied decision.
export function verifyAdaptiveV3Route(value,candidate){
  const expected=selectAdaptiveV3Route(value);
  let matches=false;
  try { matches=canonical(candidate)===canonical(expected); }
  catch { matches=false; }
  check(matches,ROUTING_INTEGRITY_CODE,'Adaptive-v3 route differs from its deterministic selector result');
  return clone(expected);
}
export const verifyAdaptiveV3RouteDecision=verifyAdaptiveV3Route;
