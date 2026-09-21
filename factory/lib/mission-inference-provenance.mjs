// Durable provenance for a *real* worker inference reservation.
//
// This module deliberately has no dependency on WorkerService, ArtifactRegistry
// or mission-inference-budget.  It is a narrow control-plane boundary that a
// caller can wire into those components without granting a generic record writer
// the ability to turn syntactically plausible run/request/call rows into a
// budget-valid dispatch.
import {canonical,check,clone,digest,identifier,instant,integer,keys,safeCode,sha256,string} from './contracts.mjs';
import {inferenceRequestHash} from '../providers/instruction-profiles.mjs';
import {CLOSED_ENTRY_MODE,CLOSED_ENTRY_NODE,PURPOSE as CLOSED_ENTRY_PURPOSE} from './closed-entry-spec.mjs';

export const MISSION_INFERENCE_PROVENANCE_INTEGRITY='INFERENCE_PROVENANCE_INTEGRITY';
export const MISSION_INFERENCE_ACTOR_ORIGIN_TYPE='mission-inference-actor-origin';
export const MISSION_INFERENCE_ACTOR_ORIGIN_SCHEMA='sovereign.mission-inference-actor-origin.v1';
export const MISSION_INFERENCE_ACTOR_ORIGIN_KIND='mission.inference-actor-origin';
export const MISSION_INFERENCE_DISPATCH_PROOF_TYPE='mission-inference-dispatch-proof';
export const MISSION_INFERENCE_DISPATCH_PROOF_SCHEMA='sovereign.mission-inference-dispatch-proof.v1';
export const MISSION_INFERENCE_DISPATCH_PROOF_KIND='mission.inference-dispatch-proof';

/** The only worker families covered by this version of the protocol.  Search
 * effects, blind replication, and native continuation callbacks deliberately
 * remain separate protocols: treating their records as worker dispatches would
 * reintroduce a cross-family accounting bypass. */
export const MISSION_INFERENCE_FAMILIES=Object.freeze([
  'ordinary-producer',
  'reviewer',
  'planning',
  'closed-entry-controller',
  'sourced-response-producer',
  'native-bounded-producer'
]);

const ACTOR_PREFIX='mission-inference-actor-origin:';
const DISPATCH_PREFIX='mission-inference-dispatch-proof:';
const CALL_TYPE='mission-inference-call';
const CALL_SCHEMA='sovereign.mission-inference-call.v1';
const REQUEST_TYPE='inference-request';
const REQUEST_SCHEMA='sovereign.inference-request.v1';
const RUN_TYPE='run';
const CONFIG_TYPE='worker-config';
const MISSION_TYPE='mission';
const PRODUCTION_TYPE='worker-production';

const integrity=(condition,message,details)=>check(condition,MISSION_INFERENCE_PROVENANCE_INTEGRITY,message,details);
const same=(left,right)=>canonical(left)===canonical(right);
const reference=record=>({type:record.type,id:record.id,version:record.version,hash:record.hash});

/** Stable IDs leave no caller-selected namespace in which a second origin or
 * proof can be hidden. */
export function missionInferenceActorOriginId(runId){
  identifier(runId,'run ID');return ACTOR_PREFIX+sha256(runId);
}
export function missionInferenceDispatchProofId(runId,requestHash){
  identifier(runId,'run ID');digest(requestHash,'request hash');return DISPATCH_PREFIX+sha256([runId,requestHash]);
}

/** Convert a stored immutable record into the exact four-field wire reference. */
export function missionInferenceRecordRef(record){
  integrity(record&&typeof record==='object','A durable record is required');
  return assertReference(reference(record),'record reference');
}

function dependencies(value){
  integrity(value&&typeof value==='object','Store and authority are required');
  const {store,authority}=value;
  integrity(store&&typeof store.get==='function'&&typeof store.put==='function'&&store.db,
    'A durable Store is required');
  integrity(authority&&typeof authority.seal==='function'&&typeof authority.open==='function',
    'A signing Authority is required');
  return {store,authority};
}

function assertReference(value,label='record reference'){
  keys(value,['type','id','version','hash']);
  identifier(value.type,`${label} type`);identifier(value.id,`${label} ID`);
  integer(value.version,`${label} version`,{min:1});digest(value.hash,`${label} hash`);
  return clone(value);
}

function exact(store,value,{type=null,id=null,version=null,label='record'}={}){
  const bound=assertReference(value,`${label} reference`);
  integrity((type===null||bound.type===type)&&(id===null||bound.id===id)&&(version===null||bound.version===version),
    `${label} reference has an unexpected identity`);
  const actual=store.get(bound.type,bound.id,bound.version);
  integrity(actual&&same(reference(actual),bound),`${label} reference is absent or changed`);
  return actual;
}

// Store records are paired one-for-one with record.committed events.  Looking
// up the event sequence makes temporal claims explicit without importing a
// registry instance or relying on mutable heads.
function committedSequence(store,value,label){
  const r=assertReference(value,`${label} reference`);
  const rows=store.db.prepare(`SELECT seq FROM events
    WHERE kind='record.committed'
      AND json_extract(json,'$.type')=?
      AND json_extract(json,'$.id')=?
      AND json_extract(json,'$.version')=?
      AND json_extract(json,'$.hash')=?`).all(r.type,r.id,r.version,r.hash);
  integrity(rows.length===1&&Number.isSafeInteger(rows[0].seq)&&rows[0].seq>0,
    `${label} has no unique committed event`);
  return rows[0].seq;
}

function expectOrder(store,items,label){
  const sequence=items.map(item=>committedSequence(store,item.ref,item.label));
  integrity(sequence.every((value,index)=>index===0||sequence[index-1]<value),`${label} chronology changed`);
  return sequence;
}

function currentActorFamily(run,configuration,mission=null){
  const d=run.data,c=configuration.data;
  integrity(run.type===RUN_TYPE&&run.version===1&&configuration.type===CONFIG_TYPE&&configuration.version===1
    &&run.id===configuration.id&&d?.id===run.id&&typeof d?.missionId==='string'&&typeof d?.nodeId==='string'
    &&['producer','reviewer'].includes(d?.mode)&&d?.context&&typeof d.context==='object'
    &&typeof d.context.purpose==='string'&&typeof d.contextHash==='string'&&sha256(d.context)===d.contextHash
    &&typeof c?.instructions==='string'&&typeof c?.prefixHash==='string'&&sha256(c.instructions)===c.prefixHash,
  'Initial run or worker configuration is malformed');
  if(d.mode==='reviewer')return 'reviewer';
  if(d.nodeId==='planning'&&d.context.purpose==='plan')return 'planning';
  // v1 has catalog roles but is still a single bounded controller entry.  Its
  // record is created immediately after the run, so classification must bind
  // the immutable selected mission policy rather than relying on a later
  // controller-config field that v1 intentionally never had.
  if(mission?.data?.policy?.entryMode===CLOSED_ENTRY_MODE
    &&d.nodeId===CLOSED_ENTRY_NODE&&d.context.purpose===CLOSED_ENTRY_PURPOSE)return 'closed-entry-controller';
  if(c.boundedReadContract!==undefined)return 'native-bounded-producer';
  if(c.sourcedResponseContract!==undefined)return 'sourced-response-producer';
  // `sourcedResponseContract` is a closed controller route too.  It uses a
  // different durable progress record from a closed response.  It is kept in
  // its own producer family above because the sourced route also has a
  // durable worker-production origin that must not disappear from proof.
  if(c.controllerContract!==undefined)return 'closed-entry-controller';
  return 'ordinary-producer';
}

function originPayload(store,runId,issuedAt){
  identifier(runId,'run ID');instant(issuedAt,'actor origin issuedAt');
  const run=store.get(RUN_TYPE,runId,1),configuration=store.get(CONFIG_TYPE,runId,1);
  integrity(run&&configuration,'Initial run and worker configuration are required');
  const missionId=run.data.missionId,mission=store.get(MISSION_TYPE,missionId,1);
  integrity(mission?.data?.id===missionId&&typeof mission.data.intent==='string'&&mission.data.intentHash===sha256(mission.data.intent),
    'Initial mission mandate is absent or changed');
  const family=currentActorFamily(run,configuration,mission);
  const payload={schema:MISSION_INFERENCE_ACTOR_ORIGIN_SCHEMA,family,
    mission:reference(mission),run:reference(run),workerConfiguration:reference(configuration),
    missionId,runId,nodeId:run.data.nodeId,mode:run.data.mode,purpose:run.data.context.purpose,
    initialContextHash:run.data.contextHash,prefixHash:configuration.data.prefixHash,issuedAt};
  validateActorPayload(store,payload);return payload;
}

function validateActorPayload(store,payload){
  keys(payload,['schema','family','mission','run','workerConfiguration','missionId','runId','nodeId','mode','purpose','initialContextHash','prefixHash','issuedAt']);
  integrity(payload.schema===MISSION_INFERENCE_ACTOR_ORIGIN_SCHEMA&&MISSION_INFERENCE_FAMILIES.includes(payload.family),
    'Actor origin schema or family is unknown');
  identifier(payload.missionId,'actor origin mission ID');identifier(payload.runId,'actor origin run ID');
  identifier(payload.nodeId,'actor origin node ID');string(payload.mode,'actor origin mode',{max:30});string(payload.purpose,'actor origin purpose');
  digest(payload.initialContextHash,'actor origin initial context hash');digest(payload.prefixHash,'actor origin prefix hash');instant(payload.issuedAt,'actor origin issuedAt');
  const mission=exact(store,payload.mission,{type:MISSION_TYPE,id:payload.missionId,version:1,label:'actor origin mission'}),
    run=exact(store,payload.run,{type:RUN_TYPE,id:payload.runId,version:1,label:'actor origin run'}),
    configuration=exact(store,payload.workerConfiguration,{type:CONFIG_TYPE,id:payload.runId,version:1,label:'actor origin worker configuration'});
  integrity(mission.data?.id===payload.missionId&&typeof mission.data.intent==='string'&&mission.data.intentHash===sha256(mission.data.intent)
    &&run.data?.id===payload.runId&&run.data.missionId===payload.missionId&&run.data.nodeId===payload.nodeId
    &&run.data.mode===payload.mode&&run.data.context?.purpose===payload.purpose
    &&run.data.contextHash===sha256(run.data.context)&&run.data.contextHash===payload.initialContextHash
    &&configuration.data?.prefixHash===sha256(configuration.data.instructions)&&configuration.data.prefixHash===payload.prefixHash
    &&currentActorFamily(run,configuration,mission)===payload.family,
  'Actor origin does not bind the initial mission, actor, context, compilation or family');
  const chronology=expectOrder(store,[
    {ref:reference(mission),label:'mission'},
    {ref:reference(run),label:'initial run'},
    {ref:reference(configuration),label:'initial worker configuration'}
  ],'Actor origin prerequisite');
  return {mission,run,configuration,chronology};
}

function signedActorRecord(store,authority,originReference){
  const origin=exact(store,originReference,{type:MISSION_INFERENCE_ACTOR_ORIGIN_TYPE,label:'actor origin'});
  integrity(origin.version===1&&origin.id===missionInferenceActorOriginId(origin.data?.signed?.data?.runId??''),
    'Actor origin record ID or version is invalid');
  keys(origin.data,['signed']);let payload;
  try{payload=authority.open(origin.data.signed,MISSION_INFERENCE_ACTOR_ORIGIN_KIND);}catch(error){
    integrity(false,'Actor origin receipt does not verify',{cause:safeCode(error)});
  }
  const lineage=validateActorPayload(store,payload);
  integrity(origin.id===missionInferenceActorOriginId(payload.runId),'Actor origin identifier differs from its signed run');
  const sequence=committedSequence(store,reference(origin),'actor origin');
  integrity(lineage.chronology.at(-1)<sequence,'Actor origin precedes its worker configuration');
  return {record:origin,payload,lineage,sequence};
}

function routeFor(family,configuration){
  if(family==='planning')return {type:'planning-progress'};
  if(family==='native-bounded-producer')return {type:'bounded-read-entry'};
  if(family==='sourced-response-producer')return {type:'sourced-response-entry'};
  if(family==='closed-entry-controller')return {type:'closed-entry'};
  return null;
}

function assertRoute(store,route,actor,family){
  const expected=routeFor(family,actor.lineage.configuration);
  if(!expected){integrity(route===null,'This worker family cannot attach a controller route');return null;}
  integrity(route!==null,'Controller route is required for this worker family');
  const record=exact(store,route,{type:expected.type,id:actor.payload.missionId,label:'controller route'}),d=record.data;
  // A route reference captures the controller state *at the dispatch*, not its
  // later head.  Membership in a historical runIds list is deliberately not
  // enough: a completed, returned or fallback actor must not regain a provider
  // dispatch merely because a public WorkerService method is called directly.
  // Later progress may legitimately move to review/acceptance, so readers
  // validate this immutable PRODUCING/active checkpoint rather than demanding
  // that the current controller head remain frozen forever.
  const bindsRun=family==='planning'
    ?d?.active?.runId===actor.payload.runId&&d.active?.artifactId===null
    :d?.status==='PRODUCING'&&d.runId===actor.payload.runId;
  // planning-progress predates this protocol and binds its mission through
  // its immutable record ID rather than a duplicated data field.  Every
  // other controller record carries the mission ID explicitly.
  const bindsMission=family==='planning'?record.id===actor.payload.missionId:d?.missionId===actor.payload.missionId;
  integrity(bindsMission&&bindsRun,
    'Controller route was not actively producing with this exact mission actor');
  return record;
}

function assertRequest(store,requestReference,runId,missionId){
  const request=exact(store,requestReference,{type:REQUEST_TYPE,version:1,label:'inference request'}),d=request.data;
  integrity(request.id===`inference-request:${sha256([runId,d?.requestHash])}`&&d?.schema===REQUEST_SCHEMA
    &&d.runId===runId&&d.missionId===missionId&&d.retention==='BEFORE_DISPATCH',
  'Inference request is not the exact retained prospective request');
  let parsed;try{parsed=JSON.parse(d.requestJson);}catch{integrity(false,'Inference request bytes are not valid JSON');}
  integrity(parsed&&inferenceRequestHash(parsed)===d.requestHash,'Inference request bytes do not match their original request hash');
  return {record:request,requestHash:d.requestHash};
}

function assertPendingRun(store,pendingReference,actor,requestHash){
  const run=exact(store,pendingReference,{type:RUN_TYPE,id:actor.payload.runId,label:'pending run'}),d=run.data;
  integrity(run.version>actor.payload.run.version&&d?.id===actor.payload.runId&&d.missionId===actor.payload.missionId
    &&d.mode===actor.payload.mode&&d.nodeId===actor.payload.nodeId&&d.context?.purpose===actor.payload.purpose
    &&d.expectedRequestHash===requestHash&&d.contextHash===sha256(d.context)
    &&Array.isArray(d.requests)&&d.requests.filter(item=>item?.requestHash===requestHash).length===1,
  'Pending run does not bind one exact prospective request');
  const configuration=store.get(CONFIG_TYPE,actor.payload.runId);
  integrity(configuration&&same(reference(configuration),actor.payload.workerConfiguration),
    'Worker configuration changed after its signed actor origin');
  return run;
}

function assertCall(store,callReference,pendingRun,request,actor,requestHash){
  const call=exact(store,callReference,{type:CALL_TYPE,version:1,label:'mission inference call'}),d=call.data;
  keys(d,['schema','missionId','origin','ordinal','kind','binding','prior']);
  keys(d.binding,['run','request','requestHash']);
  integrity(d.schema===CALL_SCHEMA&&d.missionId===actor.payload.missionId&&d.kind==='worker'
    &&same(d.binding.run,reference(pendingRun))&&same(d.binding.request,reference(request))&&d.binding.requestHash===requestHash,
  'Mission inference call does not bind this exact pending worker request');
  return call;
}

function assertProduction(store,productionReference,actor,family){
  const required=['ordinary-producer','native-bounded-producer','sourced-response-producer'].includes(family);
  if(!required){integrity(productionReference===null,'This worker family cannot attach a producer origin');return null;}
  integrity(productionReference!==null,'This worker family requires a producer origin');
  const production=exact(store,productionReference,{type:PRODUCTION_TYPE,id:actor.payload.runId,version:1,label:'worker production'});
  const d=production.data;
  // A record merely named `worker-production` is not an origin.  Bind the
  // proof to the immutable first invocation marker that the production
  // protocol itself requires; later mutable status rows cannot be substituted
  // for it.  We deliberately do not rederive the node contract here: its
  // exact task/input binding is established only once the retained request is
  // interpreted by the producer-response protocol.
  integrity(d&&typeof d==='object'&&d.status==='running'&&d.step===0
    &&d.responseRetention==='producer-response-v1'&&d.cleanupProtocol==='producer-cleanup-v1'
    &&typeof d.contractHash==='string'&&/^[a-f0-9]{64}$/.test(d.contractHash),
  'Worker production origin is not the initial durable production invocation');
  return production;
}

function dispatchPayload(store,authority,input,issuedAt){
  keys(input,['actorOrigin','pendingRun','request','call','production','route']);
  instant(issuedAt,'dispatch proof issuedAt');
  const actor=signedActorRecord(store,authority,input.actorOrigin),family=actor.payload.family,
    request=assertRequest(store,input.request,actor.payload.runId,actor.payload.missionId),
    pendingRun=assertPendingRun(store,input.pendingRun,actor,request.requestHash),
    call=assertCall(store,input.call,pendingRun,request.record,actor,request.requestHash),
    production=assertProduction(store,input.production,actor,family),route=assertRoute(store,input.route,actor,family);
  const payload={schema:MISSION_INFERENCE_DISPATCH_PROOF_SCHEMA,family,actorOrigin:reference(actor.record),
    mission:clone(actor.payload.mission),pendingRun:reference(pendingRun),request:reference(request.record),call:reference(call),
    production:production?reference(production):null,route:route?reference(route):null,
    missionId:actor.payload.missionId,runId:actor.payload.runId,requestHash:request.requestHash,
    contextHash:pendingRun.data.contextHash,prefixHash:actor.payload.prefixHash,issuedAt};
  validateDispatchPayload(store,authority,payload);return payload;
}

function validateDispatchPayload(store,authority,payload){
  keys(payload,['schema','family','actorOrigin','mission','pendingRun','request','call','production','route','missionId','runId','requestHash','contextHash','prefixHash','issuedAt']);
  integrity(payload.schema===MISSION_INFERENCE_DISPATCH_PROOF_SCHEMA&&MISSION_INFERENCE_FAMILIES.includes(payload.family),
    'Dispatch proof schema or family is unknown');
  identifier(payload.missionId,'dispatch proof mission ID');identifier(payload.runId,'dispatch proof run ID');
  digest(payload.requestHash,'dispatch proof request hash');digest(payload.contextHash,'dispatch proof context hash');digest(payload.prefixHash,'dispatch proof prefix hash');instant(payload.issuedAt,'dispatch proof issuedAt');
  const actor=signedActorRecord(store,authority,payload.actorOrigin);
  integrity(payload.family===actor.payload.family&&payload.missionId===actor.payload.missionId&&payload.runId===actor.payload.runId
    &&same(payload.mission,actor.payload.mission)&&payload.prefixHash===actor.payload.prefixHash,
  'Dispatch proof differs from its signed actor origin');
  const request=assertRequest(store,payload.request,payload.runId,payload.missionId);
  integrity(request.requestHash===payload.requestHash,'Dispatch proof request hash differs from its retained request');
  const pendingRun=assertPendingRun(store,payload.pendingRun,actor,payload.requestHash);
  integrity(pendingRun.data.contextHash===payload.contextHash,'Dispatch proof context differs from its pending actor');
  const call=assertCall(store,payload.call,pendingRun,request.record,actor,payload.requestHash);
  const production=assertProduction(store,payload.production,actor,payload.family),route=assertRoute(store,payload.route,actor,payload.family);
  const order=[{ref:reference(actor.record),label:'actor origin'}];
  if(production)order.push({ref:reference(production),label:'worker production'});
  if(route)order.push({ref:reference(route),label:'controller route'});
  // Routes can be established before a replacement actor exists, so they are
  // independently required to precede the pending request rather than forced
  // after the actor origin.  Production, by contrast, is this actor's own
  // state and must follow its signed creation origin.
  const actorSequence=committedSequence(store,reference(actor.record),'actor origin');
  if(production)integrity(actorSequence<committedSequence(store,reference(production),'worker production'),
    'Worker production predates its actor origin');
  if(route)integrity(committedSequence(store,reference(route),'controller route')<committedSequence(store,reference(pendingRun),'pending run'),
    'Controller route follows its pending request');
  const requestOrder=production
    ?[{ref:reference(production),label:'worker production'},{ref:reference(pendingRun),label:'pending run'},
      {ref:reference(request.record),label:'inference request'},{ref:reference(call),label:'mission inference call'}]
    :[{ref:reference(actor.record),label:'actor origin'},{ref:reference(pendingRun),label:'pending run'},
      {ref:reference(request.record),label:'inference request'},{ref:reference(call),label:'mission inference call'}];
  const chronology=expectOrder(store,requestOrder,'Dispatch proof prerequisite');
  return {actor,request,pendingRun,call,production,route,chronology};
}

function signedDispatchRecord(store,authority,proofReference){
  const proof=exact(store,proofReference,{type:MISSION_INFERENCE_DISPATCH_PROOF_TYPE,label:'dispatch proof'});
  keys(proof.data,['signed']);let payload;
  try{payload=authority.open(proof.data.signed,MISSION_INFERENCE_DISPATCH_PROOF_KIND);}catch(error){
    integrity(false,'Dispatch proof receipt does not verify',{cause:safeCode(error)});
  }
  const lineage=validateDispatchPayload(store,authority,payload);
  integrity(proof.version===1&&proof.id===missionInferenceDispatchProofId(payload.runId,payload.requestHash),
    'Dispatch proof identifier or version is invalid');
  const sequence=committedSequence(store,reference(proof),'dispatch proof');
  integrity(lineage.chronology.at(-1)<sequence,'Dispatch proof precedes its call reservation');
  return {record:proof,payload,lineage,sequence};
}

function failClosed(fn,message){
  try{return fn();}catch(error){
    if(error?.code===MISSION_INFERENCE_PROVENANCE_INTEGRITY)throw error;
    integrity(false,message,{cause:safeCode(error)});
  }
}

/** Read one signed actor origin from immutable storage.  Any malformed ref,
 * missing record, signature failure, hash mismatch, or temporal inversion is
 * normalized to INFERENCE_PROVENANCE_INTEGRITY. */
export function readMissionInferenceActorOrigin(deps,originReference){
  return failClosed(()=>{
    const {store,authority}=dependencies(deps),result=signedActorRecord(store,authority,originReference);
    return clone({record:reference(result.record),family:result.payload.family,mission:result.payload.mission,run:result.payload.run,
      workerConfiguration:result.payload.workerConfiguration,payload:result.payload,sequence:result.sequence});
  },'Actor origin cannot be read as trusted provenance');
}

/** Read and fully revalidate a signed dispatch proof.  `expected` lets a
 * consumer bind a proof to its already selected family/run/request/call rather
 * than accepting a valid proof for another reservation. */
export function readMissionInferenceDispatchProof(deps,proofReference,expected={}){
  return failClosed(()=>{
    keys(expected,['family','run','request','call'],[],'dispatch proof expectation');
    const {store,authority}=dependencies(deps),result=signedDispatchRecord(store,authority,proofReference),p=result.payload;
    if(Object.hasOwn(expected,'family'))integrity(expected.family===p.family,'Dispatch proof family differs from consumer expectation');
    if(Object.hasOwn(expected,'run'))integrity(same(assertReference(expected.run,'expected run'),p.pendingRun),'Dispatch proof run differs from consumer expectation');
    if(Object.hasOwn(expected,'request'))integrity(same(assertReference(expected.request,'expected request'),p.request),'Dispatch proof request differs from consumer expectation');
    if(Object.hasOwn(expected,'call'))integrity(same(assertReference(expected.call,'expected call'),p.call),'Dispatch proof call differs from consumer expectation');
    return clone({record:reference(result.record),family:p.family,actorOrigin:p.actorOrigin,mission:p.mission,pendingRun:p.pendingRun,
      request:p.request,call:p.call,production:p.production,route:p.route,payload:p,sequence:result.sequence});
  },'Dispatch proof cannot be read as trusted provenance');
}

/** Consumer-facing fail-closed lookup.  It derives the only possible proof ID
 * from the caller's exact run/request refs, so a request cannot be credited by
 * merely presenting some other signed proof in the same mission. */
export function assertMissionInferenceDispatchProvenance(deps,{run,request,call,family}={}){
  return failClosed(()=>{
    const {store}=dependencies(deps),runRef=assertReference(run,'consumer run'),requestRef=assertReference(request,'consumer request'),callRef=assertReference(call,'consumer call');
    integrity(family===undefined||MISSION_INFERENCE_FAMILIES.includes(family),'Consumer selected an unknown worker family');
    const requestRecord=exact(store,requestRef,{type:REQUEST_TYPE,version:1,label:'consumer inference request'}),requestHash=requestRecord.data?.requestHash;
    digest(requestHash,'consumer request hash');
    integrity(requestRef.id===`inference-request:${sha256([runRef.id,requestHash])}`,'Consumer request does not belong to its run');
    const proof=store.get(MISSION_INFERENCE_DISPATCH_PROOF_TYPE,missionInferenceDispatchProofId(runRef.id,requestHash));
    integrity(proof,'No signed dispatch proof exists for this exact worker request');
    // A caller that knows its route may require one exact family.  The global
    // budget reader intentionally accepts every supported worker family, but
    // still binds the proof to this exact run/request/call triple; it must not
    // manufacture a route name merely to make a valid proof unreadable.
    const expected={run:runRef,request:requestRef,call:callRef};
    if(family!==undefined)expected.family=family;
    return readMissionInferenceDispatchProof(deps,reference(proof),expected);
  },'Worker reservation lacks trusted dispatch provenance');
}

/**
 * Trusted control-plane capability.  Its opaque WeakMap preflights are not
 * serializable, cannot be reconstructed from database rows, and are consumed
 * only in the caller's material transaction.  Do not expose an instance to a
 * registry, worker, model, plugin, or generic request-retention API.
 */
export class MissionInferenceProvenanceControl {
  #actorPreflights=new WeakMap();
  #dispatchPreflights=new WeakMap();

  constructor({store,authority,clock=store?.clock}={}){
    const deps=dependencies({store,authority});
    integrity(typeof clock==='function','A provenance clock is required');
    this.store=deps.store;this.authority=deps.authority;this.clock=clock;
  }

  /** Prepare the immutable actor binding immediately after run@1 and
   * worker-config@1 are written.  The token intentionally reveals no payload. */
  prepareActorOrigin({runId}={}){
    const payload=originPayload(this.store,runId,this.clock()),token=Object.freeze(Object.create(null));
    integrity(!this.store.get(MISSION_INFERENCE_ACTOR_ORIGIN_TYPE,missionInferenceActorOriginId(runId)),
      'Actor origin already exists for this run');
    this.#actorPreflights.set(token,{payload:clone(payload)});return token;
  }

  /** Persist a preflight only inside the originating material transaction. */
  issueActorOrigin(token){
    const entry=this.#actorPreflights.get(token);
    integrity(entry,'Actor-origin preflight is absent, foreign, or already consumed');
    integrity(this.store.db.isTransaction,'Actor origin must share its worker creation transaction');
    const current=originPayload(this.store,entry.payload.runId,entry.payload.issuedAt);
    integrity(same(current,entry.payload),'Actor-origin preflight no longer matches immutable creation records');
    const record=this.store.put(MISSION_INFERENCE_ACTOR_ORIGIN_TYPE,missionInferenceActorOriginId(current.runId),
      {signed:this.authority.seal(MISSION_INFERENCE_ACTOR_ORIGIN_KIND,current)},{expectedVersion:0});
    this.#actorPreflights.delete(token);return clone(record);
  }

  /** Prepare the proof only after the caller has written the exact pending
   * run, retained request and immutable mission-call reservation.  Every ref
   * is re-read now; handing a raw row set to issueDispatchProof cannot work. */
  prepareDispatchProof(input={}){
    const captured=clone(input),payload=dispatchPayload(this.store,this.authority,captured,this.clock()),token=Object.freeze(Object.create(null));
    integrity(!this.store.get(MISSION_INFERENCE_DISPATCH_PROOF_TYPE,missionInferenceDispatchProofId(payload.runId,payload.requestHash)),
      'Dispatch proof already exists for this exact worker request');
    this.#dispatchPreflights.set(token,{input:captured,payload:clone(payload)});return token;
  }

  /** Seal and store the exact prepared dispatch in the same transaction as the
   * reservation.  A token is single-use even if a caller retains it in memory. */
  issueDispatchProof(token){
    const entry=this.#dispatchPreflights.get(token);
    integrity(entry,'Dispatch-proof preflight is absent, foreign, or already consumed');
    integrity(this.store.db.isTransaction,'Dispatch proof must share its request and reservation transaction');
    const current=dispatchPayload(this.store,this.authority,entry.input,entry.payload.issuedAt);
    integrity(same(current,entry.payload),'Dispatch-proof preflight no longer matches its exact lineage');
    const record=this.store.put(MISSION_INFERENCE_DISPATCH_PROOF_TYPE,
      missionInferenceDispatchProofId(current.runId,current.requestHash),
      {signed:this.authority.seal(MISSION_INFERENCE_DISPATCH_PROOF_KIND,current)},{expectedVersion:0});
    this.#dispatchPreflights.delete(token);return clone(record);
  }
}
