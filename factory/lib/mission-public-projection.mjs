// Public mission views are deliberately defined once. Status and report are
// read surfaces, not a second control plane: persisted JSON is not public just
// because it is local. Every nested object which crosses this boundary is
// parsed through its owning contract or reduced to a fixed, public shape.
import {clone,identifier,instant,integer,list,sha256,string,unique} from './contracts.mjs';
import {TOOL_NAMES} from './plans.mjs';
import {instructionProfile} from '../providers/instruction-profiles.mjs';
import {CARD_ENCODINGS} from '../catalog/index.mjs';
import {CONTEXT_ENCODINGS} from './context-codec.mjs';
import {REVIEW_ENCODINGS} from './review-codec.mjs';
import {PRODUCER_CONTEXT_MODES} from './producer-plan-view.mjs';
import {CLOSED_ENTRY_MODE,CLOSED_ENTRY_V2} from './closed-entry-spec.mjs';
import {BOUNDED_READ_MODE} from './bounded-read-spec.mjs';
import {SOURCED_RESPONSE_MODE,sourcedResponseAcquisition,sourcedResponseFallbackPolicy} from './sourced-response-spec.mjs';
import {sourcedEvidenceProfileForPolicy} from './sourced-evidence-profile.mjs';
import {ADAPTIVE_V3_DIRECT_ENTRY_MODE,ADAPTIVE_V3_PLANNED_ENTRY_MODE} from './adaptive-v3-routing.mjs';
import {planningInspectionPolicy} from './planning-inspection-contract.mjs';
import {producerBatchPolicy} from './producer-batch.mjs';
import {missionInferenceBudgetPolicy} from './mission-inference-budget.mjs';
import {methodRecoveryPolicy} from './method-recovery.mjs';
import {PLANNING_CLEANUP_PROTOCOL} from './planning-response.mjs';
import {missionDirectionPolicy} from './mission-direction.mjs';

const DIGEST=/^[a-f0-9]{64}$/;
const ENTRY_MODES=new Set(['planned',CLOSED_ENTRY_MODE,CLOSED_ENTRY_V2,BOUNDED_READ_MODE,SOURCED_RESPONSE_MODE,
  ADAPTIVE_V3_DIRECT_ENTRY_MODE,ADAPTIVE_V3_PLANNED_ENTRY_MODE]);
const PRESET_IDS=new Set(['adaptive-v1','adaptive-v2','adaptive-v3']);

// Public lifecycle labels are intentionally finite. A free-form persisted
// status would turn this small operational indicator into a disclosure field.
export const PUBLIC_MISSION_STATUSES=Object.freeze(['NEW','PLANNING','RUNNING','WAITING_QUOTA','WAITING_PROVIDER',
  'WAITING_CAPABILITY','NEEDS_DIRECTION','PAUSED','CANCELLING','CANCELLED','COMPLETED','FAILED']);
const PUBLIC_STATUS_SET=new Set(PUBLIC_MISSION_STATUSES);

export const PUBLIC_POLICY_FIELDS=Object.freeze(['model','reasoningEffort','allowedTools','maxPlanAttempts','maxNodeAttempts',
  'instructionProfile','contextEncoding','reviewEncoding','entryMode','nativeReadTransport','boundedReadPresentation',
  'cardEncoding','producerContext','documentContext','planningContracts','producerBatch','inferenceBudget','methodRecovery',
  'maxParallelPureNodes','planningCleanupProtocol','missionDirection','sourcedFallback','sourcedAcquisition','sourcedEvidenceProfile']);
const PUBLIC_POLICY_SET=new Set(PUBLIC_POLICY_FIELDS);

const plain=value=>value!==null&&typeof value==='object'&&!Array.isArray(value)&&Object.getPrototypeOf(value)===Object.prototype;
const text=(value,label,{min=1,max=100000}={})=>{string(value,label,{min,max});return value;};
const oneOf=(value,allowed,label)=>{
  text(value,label,{max:256});if(!allowed.includes(value))throw Error(`${label} is not a public contract value`);return value;
};
const exactKeys=(value,allowed,required=allowed,label='object')=>{
  if(!plain(value))throw Error(`${label} must be a plain object`);
  const own=Object.keys(value);if(!own.every(key=>allowed.includes(key))||!required.every(key=>Object.hasOwn(value,key)))
    throw Error(`${label} has an unexpected shape`);
  return value;
};

/** Parse a policy only through each feature's owner contract. Unknown
 * top-level fields remain intentionally private extension space; malformed
 * known fields are a public-integrity failure, never a partially cloned blob. */
export const inspectPublicPolicy=policy=>{
  if(policy===undefined||policy===null)return {valid:true,policy:null};
  if(!plain(policy))return {valid:false,policy:null};
  try{
    const projected={};
    if(Object.hasOwn(policy,'model'))projected.model=text(policy.model,'policy model',{max:256});
    if(Object.hasOwn(policy,'reasoningEffort'))projected.reasoningEffort=text(policy.reasoningEffort,'policy reasoning effort',{max:128});
    if(Object.hasOwn(policy,'allowedTools')){
      list(policy.allowedTools,'public allowed tools',{max:TOOL_NAMES.length});unique(policy.allowedTools,'public allowed tools');
      if(!policy.allowedTools.every(tool=>TOOL_NAMES.includes(tool)))throw Error('unknown public tool');
      projected.allowedTools=clone(policy.allowedTools);
    }
    if(Object.hasOwn(policy,'maxPlanAttempts')){integer(policy.maxPlanAttempts,'public maxPlanAttempts',{min:1,max:100});projected.maxPlanAttempts=policy.maxPlanAttempts;}
    if(Object.hasOwn(policy,'maxNodeAttempts')){integer(policy.maxNodeAttempts,'public maxNodeAttempts',{min:1,max:100});projected.maxNodeAttempts=policy.maxNodeAttempts;}
    if(Object.hasOwn(policy,'instructionProfile')){instructionProfile(policy.instructionProfile);projected.instructionProfile=policy.instructionProfile;}
    if(Object.hasOwn(policy,'contextEncoding'))projected.contextEncoding=oneOf(policy.contextEncoding,CONTEXT_ENCODINGS,'context encoding');
    if(Object.hasOwn(policy,'reviewEncoding'))projected.reviewEncoding=oneOf(policy.reviewEncoding,REVIEW_ENCODINGS,'review encoding');
    if(Object.hasOwn(policy,'entryMode'))projected.entryMode=oneOf(policy.entryMode,[...ENTRY_MODES],'entry mode');
    if(Object.hasOwn(policy,'sourcedFallback')){
      if(policy.entryMode!==SOURCED_RESPONSE_MODE)throw Error('sourced fallback is outside sourced entry');
      projected.sourcedFallback=sourcedResponseFallbackPolicy(policy.sourcedFallback);
    }
    if(Object.hasOwn(policy,'sourcedAcquisition')){
      if(policy.entryMode!==SOURCED_RESPONSE_MODE)throw Error('sourced acquisition is outside sourced entry');
      projected.sourcedAcquisition=clone(sourcedResponseAcquisition({policy}));
    }
    if(Object.hasOwn(policy,'sourcedEvidenceProfile')){
      if(policy.entryMode!==SOURCED_RESPONSE_MODE)throw Error('sourced evidence profile is outside sourced entry');
      projected.sourcedEvidenceProfile=sourcedEvidenceProfileForPolicy(policy).id;
    }
    if(Object.hasOwn(policy,'nativeReadTransport'))projected.nativeReadTransport=oneOf(policy.nativeReadTransport,['native-read-v1'],'native read transport');
    if(Object.hasOwn(policy,'boundedReadPresentation'))projected.boundedReadPresentation=oneOf(policy.boundedReadPresentation,['separate-evidence-v1'],'bounded read presentation');
    if(Object.hasOwn(policy,'cardEncoding'))projected.cardEncoding=oneOf(policy.cardEncoding,CARD_ENCODINGS,'card encoding');
    if(Object.hasOwn(policy,'producerContext'))projected.producerContext=oneOf(policy.producerContext,PRODUCER_CONTEXT_MODES,'producer context');
    if(Object.hasOwn(policy,'documentContext'))projected.documentContext=oneOf(policy.documentContext,['literal-windows-v1'],'document context');
    if(Object.hasOwn(policy,'planningContracts'))projected.planningContracts=planningInspectionPolicy(policy.planningContracts);
    if(Object.hasOwn(policy,'producerBatch'))projected.producerBatch=producerBatchPolicy(policy.producerBatch);
    if(Object.hasOwn(policy,'inferenceBudget'))projected.inferenceBudget=missionInferenceBudgetPolicy(policy.inferenceBudget);
    if(Object.hasOwn(policy,'methodRecovery'))projected.methodRecovery=methodRecoveryPolicy(policy.methodRecovery);
    if(Object.hasOwn(policy,'maxParallelPureNodes')){integer(policy.maxParallelPureNodes,'public parallelism',{min:1,max:4});projected.maxParallelPureNodes=policy.maxParallelPureNodes;}
    if(Object.hasOwn(policy,'planningCleanupProtocol')){
      if(policy.planningCleanupProtocol!==PLANNING_CLEANUP_PROTOCOL)throw Error('unknown planning cleanup protocol');
      projected.planningCleanupProtocol=PLANNING_CLEANUP_PROTOCOL;
    }
    if(Object.hasOwn(policy,'missionDirection'))projected.missionDirection=missionDirectionPolicy(policy.missionDirection,{allowLegacy:true});
    return {valid:true,policy:projected};
  }catch{return {valid:false,policy:null};}
};

export const publicPolicy=policy=>inspectPublicPolicy(policy).policy;

const inspectPublicPolicySelection=selection=>{
  if(selection===undefined||selection===null)return {valid:true,selection:null};
  if(!plain(selection))return {valid:false,selection:null};
  try{
    const projected={};
    if(Object.hasOwn(selection,'presetId')){
      const presetId=text(selection.presetId,'preset id',{max:64});
      // A future private preset name must not become a report side channel.
      if(PRESET_IDS.has(presetId))projected.presetId=presetId;
    }
    if(Object.hasOwn(selection,'definition')){
      const definition=inspectPublicPolicy(selection.definition);if(!definition.valid)throw Error('invalid selected definition');
      if(definition.policy!==null)projected.definition=definition.policy;
    }
    if(Object.hasOwn(selection,'definitionHash')){
      if(typeof selection.definitionHash!=='string'||!DIGEST.test(selection.definitionHash))throw Error('invalid definition hash');
      projected.definitionHash=selection.definitionHash;
    }
    if(Object.hasOwn(selection,'explicitOverrides')){
      list(selection.explicitOverrides,'explicit overrides',{max:PUBLIC_POLICY_FIELDS.length});
      const overrides=[];
      for(const value of selection.explicitOverrides){
        const field=text(value,'explicit override',{max:96});if(PUBLIC_POLICY_SET.has(field))overrides.push(field);
      }
      unique(overrides,'public explicit overrides');projected.explicitOverrides=overrides;
    }
    if(Object.hasOwn(selection,'effectivePolicyHash')){
      if(typeof selection.effectivePolicyHash!=='string'||!DIGEST.test(selection.effectivePolicyHash))throw Error('invalid effective policy hash');
      projected.effectivePolicyHash=selection.effectivePolicyHash;
    }
    return {valid:true,selection:Object.keys(projected).length?projected:null};
  }catch{return {valid:false,selection:null};}
};

export const publicPolicySelection=selection=>inspectPublicPolicySelection(selection).selection;

const publicPending=pending=>{
  const values=pending===undefined?[]:pending;
  try{
    list(values,'mission pending',{max:1000});
    return {valid:true,value:values.map((item,index)=>{
      exactKeys(item,['code','nodeId','operationId','reason','diagnosis'],['code'],`mission pending ${index}`);
      const code=text(item.code,'pending code',{max:160});
      if(!/^[A-Z_][A-Z0-9_]*$/.test(code))throw Error('pending code is not a public protocol code');
      // Reasons and diagnoses are operator/debug prose. They remain durable
      // internally but are deliberately not report data without a separately
      // signed diagnostic contract.
      if(Object.hasOwn(item,'reason'))text(item.reason,'pending reason',{min:0,max:16000});
      if(Object.hasOwn(item,'diagnosis'))text(item.diagnosis,'pending diagnosis',{min:0,max:16000});
      const projected={code};
      if(Object.hasOwn(item,'nodeId')){identifier(item.nodeId,'pending node id');projected.nodeId=item.nodeId;}
      if(Object.hasOwn(item,'operationId')){identifier(item.operationId,'pending operation id');projected.operationId=item.operationId;}
      return projected;
    })};
  }catch{return {valid:false,value:[]};}
};

const publicHistory=history=>{
  const values=history===undefined?[]:history;
  try{
    list(values,'mission history',{max:10000});
    return {valid:true,value:values.map((item,index)=>{
      exactKeys(item,['status','at'],['status','at'],`mission history ${index}`);
      if(!PUBLIC_STATUS_SET.has(item.status))throw Error('history status is not public');
      instant(item.at,'mission history timestamp');return {status:item.status,at:item.at};
    })};
  }catch{return {valid:false,value:[]};}
};

export const inspectPublicLifecycle=mission=>{
  if(!plain(mission)||!PUBLIC_STATUS_SET.has(mission.status))return {valid:false,status:'UNVERIFIED',pending:[],history:[],finalArtifactId:null};
  const pending=publicPending(mission.pending),history=publicHistory(mission.history);
  try{
    const finalArtifactId=mission.finalArtifactId===undefined||mission.finalArtifactId===null?null:identifier(mission.finalArtifactId,'final artifact id');
    return {valid:pending.valid&&history.valid,status:mission.status,pending:pending.value,history:history.value,finalArtifactId};
  }catch{return {valid:false,status:'UNVERIFIED',pending:[],history:[],finalArtifactId:null};}
};

/** Use this before touching any policy-driven public surface. It makes the
 * caller choose a quarantine rather than accidentally continuing with raw
 * nested mission state after `projectPublicMission` has redacted it. */
export const inspectPublicMission=mission=>{
  const policy=inspectPublicPolicy(mission?.policy),selection=inspectPublicPolicySelection(mission?.policySelection),
    lifecycle=inspectPublicLifecycle(mission);
  return {valid:policy.valid&&selection.valid&&lifecycle.valid,policyValid:policy.valid&&selection.valid,lifecycleValid:lifecycle.valid,
    mission:{id:typeof mission?.id==='string'?mission.id:null,intent:typeof mission?.intent==='string'?mission.intent:null,
      intentHash:typeof mission?.intentHash==='string'&&DIGEST.test(mission.intentHash)?mission.intentHash:null,
      status:lifecycle.valid?lifecycle.status:'UNVERIFIED',policy:policy.policy,finalArtifactId:lifecycle.finalArtifactId,
      pending:lifecycle.pending,history:lifecycle.history,...(selection.selection?{policySelection:selection.selection}:{})}};
};

// A projection is a whitelist, never a clone of the mutable control-plane
// envelope. Stable version-one extensions can still be confidential or an
// implementation detail that has no public reporting contract.
export const projectPublicMission=mission=>inspectPublicMission(mission).mission;

// This is narrower than a historical/admission quarantine: a legitimate
// terminal lifecycle may remain visible while its output pointer is withheld
// for recovery. It deliberately carries no plan or node projection itself.
export const deliveryRedactedMission=mission=>({...projectPublicMission(mission),finalArtifactId:null,deliveryIntegrity:'UNVERIFIED'});

export const deliveryQuarantineMission=mission=>({...projectPublicMission(mission),status:'UNVERIFIED',lifecycleIntegrity:'UNVERIFIED',
  finalArtifactId:null,pending:[],history:[],deliveryIntegrity:'UNVERIFIED'});

/** A failed admission is never represented by a partially trusted current
 * mission head. Retain only the key-bound identity and independently checked
 * version-one mandate; all mutable lifecycle and policy fields are withheld. */
export const quarantinedMission=(mission,origin,{admission=false,planningAdmission=false,adaptiveRoute=false,policy=false,lifecycle=false}={})=>{
  let admitted=null;try{
    if(origin?.id===mission.id&&typeof origin.intent==='string'&&typeof origin.intentHash==='string'
      &&origin.intentHash===sha256(origin.intent))admitted={intent:origin.intent,intentHash:origin.intentHash};
  }catch{}
  const projected={id:mission.id,intent:admitted?.intent??null,intentHash:admitted?.intentHash??null,
    status:'UNVERIFIED',lifecycleIntegrity:'UNVERIFIED',pending:[],history:[],finalArtifactId:null,
    policy:null,policyIntegrity:'UNVERIFIED',mandateIntegrity:admitted?'VERSION_ONE_ONLY':'UNVERIFIED'};
  if(admission)projected.admissionIntegrity='UNVERIFIED';
  if(planningAdmission)projected.planningAdmissionIntegrity='UNVERIFIED';
  if(adaptiveRoute)projected.adaptiveV3RouteIntegrity='UNVERIFIED';
  if(policy)projected.policyIntegrity='UNVERIFIED';
  if(lifecycle)projected.lifecycleIntegrity='UNVERIFIED';
  return projected;
};
