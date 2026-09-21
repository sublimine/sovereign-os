// Durable controller contract for the deliberately narrow adaptive-v3 route.
// The selector is pure, but a mission can live for longer than the process
// which selected it.  This module therefore signs and re-derives the exact
// selector result from mission@1 before an integrator can enter either path.
// It owns no provider, worker, broker, artifact or mission-state mutation.
import {canonical,check,clone,digest,identifier,keys,sha256,string} from './contracts.mjs';
import {missionInputManifest} from './mission-inputs.mjs';
import {admitAdaptiveV3Request} from './adaptive-v3-admission.mjs';
import {
  ADAPTIVE_V3_ADMISSION_METADATA,
  ADAPTIVE_V3_CLOSED_MATERIALIZATION_PREFLIGHT_SCHEMA,
  ADAPTIVE_V3_DIRECT_ENTRY_MODE,
  ADAPTIVE_V3_ROUTING_MODE,
  ADAPTIVE_V3_ROUTING_REVISION,
  ADAPTIVE_V3_SELECTOR_CATALOG_HASH,
  selectAdaptiveV3Route
} from './adaptive-v3-routing.mjs';
import {materializeAdaptiveV3ClosedOutput} from './adaptive-v3-materialization.mjs';

export const ADAPTIVE_V3_ROUTE_RECORD_TYPE='adaptive-v3-route';
export const ADAPTIVE_V3_ROUTE_RECORD_KIND='adaptive-v3.route';
export const ADAPTIVE_V3_ROUTE_RECORD_SCHEMA='sovereign.adaptive-v3-route-record.v1';
export const ADAPTIVE_V3_MISSION_ROUTING_SCHEMA='sovereign.adaptive-v3-mission-routing.v1';
// A scalar const is already immutable.  Keeping this a named exported floor
// makes the stored schema revision explicit instead of trusting a caller.
export const ADAPTIVE_V3_MISSION_ROUTING_REVISION=1;

const ROUTE_INTEGRITY='ADAPTIVE_V3_ROUTE_INTEGRITY';
const LIFECYCLE_FIELDS=Object.freeze(['finalArtifactId','history','pending','status','updatedAt']);
const ROUTING_FIELDS=Object.freeze([
  'schema','revision','routingMode','selectorCatalogHash','decisionHash',
  'staticPolicyHash','finalPolicyHash','requestedEntryMode'
]);
const ROUTE_RECORD_FIELDS=Object.freeze([
  'schema','revision','missionRef','intentHash','policyHash','inputManifestHash',
  'routing','decision','decisionHash'
]);
const MISSION_REF_FIELDS=Object.freeze(['type','id','version','hash']);

const freeze=value=>{
  if(value&&typeof value==='object'&&!Object.isFrozen(value)){
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
};
const integrity=(condition,message,details={})=>check(condition,ROUTE_INTEGRITY,message,details);
const same=(actual,expected)=>{
  try{return canonical(actual)===canonical(expected);}catch{return false;}
};
const cloneOrIntegrity=(value,label)=>{
  try{return clone(value);}catch{integrity(false,`${label} is not canonical immutable JSON data`);}
};
const hashOrNull=(value,label)=>{
  integrity(value===null||(typeof value==='string'&&/^[a-f0-9]{64}$/.test(value)),`${label} must be null or a SHA-256 digest`);
  return value;
};
const missionInputHash=mission=>hashOrNull(mission?.inputManifestHash??null,'mission input manifest hash');

function exactKeys(value,fields,label){
  try { keys(value,fields,fields,label); }
  catch { integrity(false,`${label} has an unsupported shape`); }
  return value;
}

function exactRouting(value){
  exactKeys(value,ROUTING_FIELDS,'adaptive-v3 mission routing');
  integrity(value.schema===ADAPTIVE_V3_MISSION_ROUTING_SCHEMA,'Adaptive-v3 mission routing schema changed');
  integrity(value.revision===ADAPTIVE_V3_MISSION_ROUTING_REVISION,'Adaptive-v3 mission routing revision changed');
  integrity(value.routingMode===ADAPTIVE_V3_ROUTING_MODE,'Adaptive-v3 mission routing mode changed');
  for(const field of ['selectorCatalogHash','decisionHash','staticPolicyHash','finalPolicyHash'])hashOrNull(value[field],`routing.${field}`);
  integrity(value.selectorCatalogHash===ADAPTIVE_V3_SELECTOR_CATALOG_HASH,'Adaptive-v3 selector catalog changed');
  integrity(value.requestedEntryMode===null||typeof value.requestedEntryMode==='string',
    'Adaptive-v3 requested entry mode must be null or text');
  if(value.requestedEntryMode!==null)string(value.requestedEntryMode,'adaptive-v3 requested entry mode',{max:128});
  return cloneOrIntegrity(value,'adaptive-v3 mission routing');
}

function executionTarget(model,reasoningEffort){
  string(model,'adaptive-v3 model',{min:1,max:256});
  string(reasoningEffort,'adaptive-v3 reasoning effort',{min:1,max:128});
  return {model,reasoningEffort};
}

function preflightDescriptor(intent,admission,status,outputHash){
  return freeze({
    schema:ADAPTIVE_V3_CLOSED_MATERIALIZATION_PREFLIGHT_SCHEMA,
    revision:ADAPTIVE_V3_ROUTING_REVISION,
    status,
    intentHash:sha256(intent),
    inputManifestHash:null,
    selectorCatalogHash:ADAPTIVE_V3_SELECTOR_CATALOG_HASH,
    admissionDecisionHash:admission.decisionHash,
    admissionPolicyHash:admission.policyHash,
    outputHash
  });
}

/**
 * Run the exact deterministic materializer only for an otherwise direct
 * request with no user input manifest.  The descriptor deliberately stores
 * only a hash: the direct-entry caller rematerializes rather than trusting a
 * retained answer.  A resource boundary hardens the route to planning; every
 * other materialization failure is an integrity failure and remains visible.
 */
export function createAdaptiveV3ClosedMaterializationPreflight(intent,{inputManifestHash=null}={}){
  string(intent,'adaptive-v3 intent',{min:1,max:256*1024});
  hashOrNull(inputManifestHash,'inputManifestHash');
  if(inputManifestHash!==null)return null;
  const admission=admitAdaptiveV3Request(intent,ADAPTIVE_V3_ADMISSION_METADATA);
  if(admission.route!=='CLOSED')return null;
  try{
    const output=materializeAdaptiveV3ClosedOutput(intent,ADAPTIVE_V3_ADMISSION_METADATA,admission);
    hashOrNull(output.outputHash,'deterministic closed output hash');
    return preflightDescriptor(intent,admission,'READY',output.outputHash);
  }catch(error){
    if(error?.code!=='ADAPTIVE_V3_CLOSED_OUTPUT_RESOURCE_LIMIT')throw error;
    return preflightDescriptor(intent,admission,'RESOURCE_LIMIT',null);
  }
}

function routingBinding(decision){
  const routing={
    schema:ADAPTIVE_V3_MISSION_ROUTING_SCHEMA,
    revision:ADAPTIVE_V3_MISSION_ROUTING_REVISION,
    routingMode:ADAPTIVE_V3_ROUTING_MODE,
    selectorCatalogHash:decision.selectorCatalogHash,
    decisionHash:decision.decisionHash,
    staticPolicyHash:decision.staticPolicyHash,
    finalPolicyHash:decision.finalPolicyHash,
    requestedEntryMode:decision.requestedEntryMode
  };
  return freeze(exactRouting(routing));
}

function selectedPolicyBinding(decision,{model,reasoningEffort}){
  integrity(decision.selectedEntryMode===decision.finalPolicy.entryMode,
    'Adaptive-v3 selected entry mode differs from its final selector policy');
  integrity(decision.requestedModel===model&&decision.requestedReasoningEffort===reasoningEffort,
    'Adaptive-v3 selector silently changed its requested model or reasoning effort');
  integrity(same(decision.executionTarget,executionTarget(model,reasoningEffort)),
    'Adaptive-v3 selector execution target differs from the requested model and reasoning effort');
  integrity(decision.finalPolicy.model===model&&decision.finalPolicy.reasoningEffort===reasoningEffort
    &&same(decision.finalPolicy.executionTarget,executionTarget(model,reasoningEffort)),
  'Adaptive-v3 final selector policy changed its execution target');
}

/**
 * Derive every adaptive-v3 policy binding before mission publication.  The
 * returned `routing` is intentionally small: it identifies a decision but
 * never includes the future signed-record hash, avoiding a policy/hash cycle.
 */
export function makeAdaptiveV3MissionRoute({missionId,intent,inputManifestHash=null,requestedEntryMode=null,model,reasoningEffort}){
  identifier(missionId,'adaptive-v3 mission id');
  string(intent,'adaptive-v3 intent',{min:1,max:256*1024});
  hashOrNull(inputManifestHash,'inputManifestHash');
  integrity(requestedEntryMode===null||typeof requestedEntryMode==='string',
    'Adaptive-v3 requested entry mode must be null or text');
  if(requestedEntryMode!==null)string(requestedEntryMode,'adaptive-v3 requested entry mode',{max:128});
  const target=executionTarget(model,reasoningEffort);
  const preflight=createAdaptiveV3ClosedMaterializationPreflight(intent,{inputManifestHash});
  const decision=selectAdaptiveV3Route({
    intent,
    metadata:ADAPTIVE_V3_ADMISSION_METADATA,
    inputManifestHash,
    requestedEntryMode,
    requestedModel:model,
    requestedReasoningEffort:reasoningEffort,
    executionTarget:target,
    closedMaterialization:preflight
  });
  selectedPolicyBinding(decision,{model,reasoningEffort});
  integrity(decision.inputManifestHash===inputManifestHash,'Adaptive-v3 selector input manifest binding changed');
  integrity(same(decision.closedMaterialization,preflight),'Adaptive-v3 selector preflight binding changed');
  const routing=routingBinding(decision);
  return freeze({decision:cloneOrIntegrity(decision,'adaptive-v3 route decision'),routing,preflight:cloneOrIntegrity(preflight,'adaptive-v3 preflight')});
}

function lifecycleFreeMission(mission){
  const copy=cloneOrIntegrity(mission,'mission');
  for(const field of LIFECYCLE_FIELDS)delete copy[field];
  return copy;
}

/** A policy-shape marker is only a reason to enter the strict route contract;
 * it is never route authority on its own. Keep this predicate shared by the
 * engine and public reporter so an incomplete/retrofit marker cannot escape
 * one boundary merely because another recognizes more marker spellings. */
export function isAdaptiveV3MissionMarker(mission){
  const policy=mission?.policy;
  return policy?.entryMode===ADAPTIVE_V3_DIRECT_ENTRY_MODE
    ||policy?.routing?.routingMode===ADAPTIVE_V3_ROUTING_MODE
    ||policy?.routing?.schema===ADAPTIVE_V3_MISSION_ROUTING_SCHEMA;
}

function missionRecordRef(record){
  return {type:'mission',id:record.id,version:1,hash:record.hash};
}

function validateMissionForRoute(mission,missionId){
  integrity(mission&&mission.id===missionId,'Adaptive-v3 route mission identity changed');
  string(mission.intent,'adaptive-v3 mission intent',{min:1,max:256*1024});
  integrity(mission.intentHash===sha256(mission.intent),'Adaptive-v3 route mission intent hash changed');
  integrity(mission.policy&&typeof mission.policy==='object'&&!Array.isArray(mission.policy),
    'Adaptive-v3 route mission policy is missing');
  string(mission.policy.model,'adaptive-v3 mission model',{min:1,max:256});
  string(mission.policy.reasoningEffort,'adaptive-v3 mission reasoning effort',{min:1,max:128});
  return mission;
}

function expectedRouteForMission(mission,missionId){
  const routing=exactRouting(mission.policy.routing);
  const route=makeAdaptiveV3MissionRoute({
    missionId,
    intent:mission.intent,
    inputManifestHash:missionInputHash(mission),
    requestedEntryMode:routing.requestedEntryMode,
    model:mission.policy.model,
    reasoningEffort:mission.policy.reasoningEffort
  });
  integrity(same(routing,route.routing),'Mission routing binding differs from its deterministic selector result');
  integrity(mission.policy.entryMode===route.decision.selectedEntryMode,
    'Mission entry mode differs from its adaptive-v3 selector result');
  selectedPolicyBinding(route.decision,{model:mission.policy.model,reasoningEffort:mission.policy.reasoningEffort});
  return route;
}

function routeRecordPayload({missionRecord,mission,decision,routing}){
  return {
    schema:ADAPTIVE_V3_ROUTE_RECORD_SCHEMA,
    revision:ADAPTIVE_V3_MISSION_ROUTING_REVISION,
    missionRef:missionRecordRef(missionRecord),
    intentHash:mission.intentHash,
    policyHash:sha256(mission.policy),
    inputManifestHash:missionInputHash(mission),
    routing:cloneOrIntegrity(routing,'adaptive-v3 route record routing'),
    decision:cloneOrIntegrity(decision,'adaptive-v3 route record decision'),
    decisionHash:decision.decisionHash
  };
}

function exactRouteRecordPayload(value){
  exactKeys(value,ROUTE_RECORD_FIELDS,'adaptive-v3 route record');
  integrity(value.schema===ADAPTIVE_V3_ROUTE_RECORD_SCHEMA,'Adaptive-v3 route record schema changed');
  integrity(value.revision===ADAPTIVE_V3_MISSION_ROUTING_REVISION,'Adaptive-v3 route record revision changed');
  exactKeys(value.missionRef,MISSION_REF_FIELDS,'adaptive-v3 route record mission reference');
  integrity(value.missionRef.type==='mission'&&value.missionRef.version===1,'Adaptive-v3 route record must bind mission@1');
  identifier(value.missionRef.id,'adaptive-v3 route record mission id');digest(value.missionRef.hash,'adaptive-v3 route record mission hash');
  digest(value.intentHash,'adaptive-v3 route record intent hash');digest(value.policyHash,'adaptive-v3 route record policy hash');
  hashOrNull(value.inputManifestHash,'adaptive-v3 route record input manifest hash');
  exactRouting(value.routing);digest(value.decisionHash,'adaptive-v3 route record decision hash');
  integrity(value.decision?.decisionHash===value.decisionHash,'Adaptive-v3 route record decision hash binding changed');
  return cloneOrIntegrity(value,'adaptive-v3 route record');
}

function signedRoutePayload(authority,record){
  try{
    exactKeys(record?.data,['signed'],'adaptive-v3 stored route envelope');
    return exactRouteRecordPayload(authority.open(record.data.signed,ADAPTIVE_V3_ROUTE_RECORD_KIND));
  }catch(error){
    if(error?.code===ROUTE_INTEGRITY)throw error;
    integrity(false,'Adaptive-v3 route record is absent, unsigned or has an invalid signature',{cause:error?.code??'UNKNOWN'});
  }
}

function assertProtocol13(store){
  let version;
  try{version=store.db.prepare('PRAGMA user_version').get().user_version;}
  catch{integrity(false,'Adaptive-v3 route cannot read the execution protocol');}
  integrity(Number.isInteger(version)&&version>=13,'Adaptive-v3 route requires execution protocol 13 or later');
}

function assertJournal(store){
  try{store.verifyJournal();}
  catch(error){integrity(false,'Adaptive-v3 route cannot trust a reverted or tampered durable history',{cause:error?.code??'UNKNOWN'});}
}

function assertRouteRecordHistory(store,missionId,record){
  integrity(record?.version===1,'Adaptive-v3 route record must remain immutable at version 1');
  let history;
  try{history=store.db.prepare('SELECT count(*) AS count,min(version) AS firstVersion,max(version) AS lastVersion FROM records WHERE type=? AND id=?')
    .get(ADAPTIVE_V3_ROUTE_RECORD_TYPE,missionId);}
  catch{integrity(false,'Adaptive-v3 route record history cannot be read');}
  integrity(history?.count===1&&history.firstVersion===1&&history.lastVersion===1,
    'Adaptive-v3 route record was re-versioned or its head was reverted');
}

/**
 * A v3 route is bound to the whole durable mission lineage, not merely its
 * current head.  Comparing only v1 and the head would permit a malicious
 * policy/mandate/input mutation to authorize work at an intermediate version
 * and then be restored byte-for-byte before dispatch.  Every retained version
 * may change the explicitly lifecycle-only fields, and nothing else.
 */
function assertMissionHistoryFrozen(store,missionId,origin,currentRecord){
  let history;
  try{history=store.db.prepare('SELECT version FROM records WHERE type=? AND id=? ORDER BY version')
    .all('mission',missionId);}
  catch{integrity(false,'Adaptive-v3 mission history cannot be read');}
  integrity(Array.isArray(history)&&history.length===currentRecord.version
    &&history.every(({version},index)=>Number.isSafeInteger(version)&&version===index+1),
  'Adaptive-v3 mission history is non-contiguous or its head was reverted');
  const frozenOrigin=lifecycleFreeMission(origin);
  for(const {version} of history){
    const record=store.get('mission',missionId,version);
    integrity(record?.id===missionId&&record.version===version,
      'Adaptive-v3 mission history row is missing or malformed',{version});
    const candidate=validateMissionForRoute(record.data,missionId);
    integrity(isAdaptiveV3MissionMarker(candidate),
      'Adaptive-v3 mission marker was removed, changed or retrofitted',{version});
    integrity(same(lifecycleFreeMission(candidate),frozenOrigin),
      'Adaptive-v3 mission history changed outside its explicitly lifecycle-only fields',{version});
    integrity(candidate.intent===origin.intent&&candidate.intentHash===origin.intentHash&&same(candidate.policy,origin.policy),
      'Adaptive-v3 mission intent or policy drifted after mission@1',{version});
  }
}

function assertInputBinding(store,missionId,origin){
  const expectedHash=missionInputHash(origin);
  let manifest;
  try{manifest=missionInputManifest(store,missionId);}
  catch(error){integrity(false,'Adaptive-v3 route input manifest is missing, altered or unsupported',{cause:error?.code??'UNKNOWN'});}
  integrity((expectedHash===null&&manifest===null)||(expectedHash!==null&&manifest&&sha256(manifest)===expectedHash),
    'Adaptive-v3 route input manifest hash differs from mission@1');
  return manifest===null?null:cloneOrIntegrity(manifest,'adaptive-v3 mission input manifest');
}

/**
 * Create the data for one signed immutable `adaptive-v3-route` record.  The
 * caller performs the Store.put in its mission-publication transaction; this
 * helper deliberately never writes, and it never inserts a record hash into
 * the mission policy.
 */
export function makeAdaptiveV3RouteRecord({store,authority,mission,decision,routing}){
  const missionId=mission?.id;
  identifier(missionId,'adaptive-v3 mission id');
  validateMissionForRoute(mission,missionId);
  const origin=store.get('mission',missionId,1),head=store.get('mission',missionId);
  integrity(origin?.version===1&&head?.version===1&&same(origin.data,mission),
    'Adaptive-v3 route record must be created against the exact stored mission@1');
  const expected=expectedRouteForMission(mission,missionId);
  integrity(same(decision,expected.decision),'Adaptive-v3 supplied route decision differs from mission@1 recomputation');
  integrity(same(routing,expected.routing),'Adaptive-v3 supplied mission routing differs from mission@1 recomputation');
  const payload=routeRecordPayload({missionRecord:origin,mission,decision:expected.decision,routing:expected.routing});
  exactRouteRecordPayload(payload);
  return freeze({signed:authority.seal(ADAPTIVE_V3_ROUTE_RECORD_KIND,payload)});
}

/**
 * Read-only revalidation used immediately before adaptive-v3 dispatch and
 * before every later trust boundary.  It performs no provider call, broker
 * operation or Store write.  Legacy missions are deliberately out of scope.
 */
export function assertAdaptiveV3MissionRoute(store,authority,missionId){
  identifier(missionId,'adaptive-v3 mission id');
  const currentRecord=store.get('mission',missionId),originRecord=store.get('mission',missionId,1);
  const routeRecord=store.get(ADAPTIVE_V3_ROUTE_RECORD_TYPE,missionId);
  // The broker and its low-level unit tests can be used before a factory
  // mission exists.  No missing record may be treated as an adaptive-v3
  // marker; an existing partial or marked mission, however, remains fatal.
  if(!currentRecord&&!originRecord&&!routeRecord)return null;
  if(!isAdaptiveV3MissionMarker(currentRecord?.data)&&!isAdaptiveV3MissionMarker(originRecord?.data)&&!routeRecord)return null;
  assertProtocol13(store);assertJournal(store);
  integrity(currentRecord&&originRecord?.version===1,'Adaptive-v3 route mission@1 is missing');
  const current=validateMissionForRoute(currentRecord.data,missionId),origin=validateMissionForRoute(originRecord.data,missionId);
  integrity(isAdaptiveV3MissionMarker(origin)&&isAdaptiveV3MissionMarker(current),'Adaptive-v3 route marker was removed, changed or retrofitted');
  integrity(same(lifecycleFreeMission(current),lifecycleFreeMission(origin)),
    'Adaptive-v3 mission changed outside its explicitly lifecycle-only fields');
  integrity(current.intent===origin.intent&&current.intentHash===origin.intentHash&&same(current.policy,origin.policy),
    'Adaptive-v3 mission intent or policy drifted after mission@1');
  assertMissionHistoryFrozen(store,missionId,origin,currentRecord);
  const manifest=assertInputBinding(store,missionId,origin);
  assertRouteRecordHistory(store,missionId,routeRecord);
  const payload=signedRoutePayload(authority,routeRecord);
  let expected;
  try{expected=expectedRouteForMission(origin,missionId);}
  catch(error){
    if(error?.code===ROUTE_INTEGRITY)throw error;
    integrity(false,'Adaptive-v3 route cannot be recomputed from immutable mission@1',{cause:error?.code??'UNKNOWN'});
  }
  const expectedPayload=routeRecordPayload({missionRecord:originRecord,mission:origin,decision:expected.decision,routing:expected.routing});
  integrity(same(payload,expectedPayload),'Adaptive-v3 signed route record differs from immutable mission@1 recomputation');
  integrity(payload.inputManifestHash===(manifest===null?null:sha256(manifest)),
    'Adaptive-v3 signed route record input-manifest binding changed');
  return freeze({
    mission:cloneOrIntegrity(current,'adaptive-v3 current mission'),
    origin:cloneOrIntegrity(origin,'adaptive-v3 original mission'),
    decision:cloneOrIntegrity(expected.decision,'adaptive-v3 route decision'),
    routing:cloneOrIntegrity(expected.routing,'adaptive-v3 mission routing'),
    preflight:cloneOrIntegrity(expected.preflight,'adaptive-v3 preflight'),
    routeRecord:{type:routeRecord.type,id:routeRecord.id,version:routeRecord.version,hash:routeRecord.hash},
    inputManifestHash:missionInputHash(origin)
  });
}
