// Durable provenance for a budgeted closed blind-replica dispatch.
//
// A replicator is intentionally not a worker: it has no worker-config, no
// worker-production record and no ordinary provider/tool authority.  Its
// durable root is the signed blind registration and the FROZEN lifecycle
// checkpoint.  Keeping this protocol nominally separate prevents a shaped
// worker reservation from being reinterpreted as a blind replication (or vice
// versa).
import {canonical,check,clone,digest,identifier,instant,integer,keys,safeCode,sha256,string} from './contracts.mjs';
import {inferenceRequestHash} from '../providers/instruction-profiles.mjs';
import {MISSION_INFERENCE_PROVENANCE_INTEGRITY} from './mission-inference-provenance.mjs';

export const MISSION_BLIND_REPLICA_DISPATCH_PROOF_TYPE='mission-blind-replica-dispatch-proof';
export const MISSION_BLIND_REPLICA_DISPATCH_PROOF_SCHEMA='sovereign.mission-blind-replica-dispatch-proof.v1';
export const MISSION_BLIND_REPLICA_DISPATCH_PROOF_KIND='mission.blind-replica-dispatch-proof';

const PROOF_PREFIX='mission-blind-replica-dispatch-proof:';
const CALL_TYPE='mission-inference-call';
const CALL_SCHEMA='sovereign.mission-inference-call.v1';
const REQUEST_TYPE='inference-request';
const RUN_TYPE='run';
const REGISTRATION_TYPE='blind-registration';
const REPLICATION_TYPE='blind-replication';
const MISSION_TYPE='mission';
const integrity=(condition,message,details)=>check(condition,MISSION_INFERENCE_PROVENANCE_INTEGRITY,message,details);
const same=(left,right)=>canonical(left)===canonical(right);
const reference=record=>({type:record.type,id:record.id,version:record.version,hash:record.hash});

function dependencies(value){
  integrity(value&&typeof value==='object','Store and authority are required');
  const {store,authority}=value;
  integrity(store&&typeof store.get==='function'&&typeof store.put==='function'&&typeof store.transactionWitness==='function'&&store.db,
    'A durable Store with transaction witnesses is required');
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

function committedSequence(store,value,label){
  const ref=assertReference(value,`${label} reference`);
  const rows=store.db.prepare(`SELECT seq FROM events
    WHERE kind='record.committed'
      AND json_extract(json,'$.type')=?
      AND json_extract(json,'$.id')=?
      AND json_extract(json,'$.version')=?
      AND json_extract(json,'$.hash')=?`).all(ref.type,ref.id,ref.version,ref.hash);
  integrity(rows.length===1&&Number.isSafeInteger(rows[0].seq)&&rows[0].seq>0,
    `${label} has no unique committed event`);
  return rows[0].seq;
}

function expectOrder(store,items,label){
  const sequence=items.map(item=>committedSequence(store,item.ref,item.label));
  integrity(sequence.every((value,index)=>index===0||sequence[index-1]<value),`${label} chronology changed`);
  return sequence;
}

function frozenMission(store,payload,registration,{current=true}={}){
  const origin=store.get(MISSION_TYPE,payload.missionId,1);
  const sameMandate=(mission,{allowLegacyMissingId=false}={})=>mission
    &&(mission.data?.id===payload.missionId||(allowLegacyMissingId&&mission.data?.id===undefined))&&typeof mission.data?.intent==='string'
    &&mission.data.intentHash===sha256(mission.data.intent)&&mission.data.intentHash===payload.missionIntentHash;
  const sameFrozenPolicy=(mission,options)=>sameMandate(mission,options)&&sha256(mission.data.policy)===payload.policyHash;
  let mission;
  if(payload.missionRef!==undefined){
    mission=exact(store,payload.missionRef,{type:MISSION_TYPE,id:payload.missionId,label:'blind frozen mission'});
    const legacy={allowLegacyMissingId:mission.data?.id===undefined};
    integrity(sameMandate(origin,legacy),'Blind registration mission mandate changed');
    integrity(sameFrozenPolicy(mission,legacy),'Blind registration frozen mission policy changed');
    if(current){
      const head=store.get(MISSION_TYPE,payload.missionId);
      integrity(sameFrozenPolicy(head,legacy),'Blind registration mission mandate or frozen policy changed');
    }
  }else{
    // Older registrations predate the explicit frozen mission reference.  For
    // their historical reading, locate the last matching policy that was
    // already committed before registration; never borrow a later rewrite.
    const legacy={allowLegacyMissingId:origin?.data?.id===undefined};
    integrity(sameMandate(origin,legacy),'Blind registration mission mandate changed');
    const before=committedSequence(store,reference(registration),'blind registration');
    const versions=store.db.prepare('SELECT version FROM records WHERE type=? AND id=? ORDER BY version DESC').all(MISSION_TYPE,payload.missionId);
    mission=versions.map(({version})=>store.get(MISSION_TYPE,payload.missionId,version)).find(candidate=>candidate
      &&sameFrozenPolicy(candidate,legacy)&&committedSequence(store,reference(candidate),'blind frozen mission')<before);
    integrity(mission,'Blind registration has no historical frozen mission policy');
    if(current){
      const head=store.get(MISSION_TYPE,payload.missionId);
      integrity(sameFrozenPolicy(head,legacy),'Blind registration mission mandate or frozen policy changed');
    }
  }
  return {mission,origin};
}

function parsedRegistration(store,authority,registrationReference,{current=true}={}){
  const registration=exact(store,registrationReference,{type:REGISTRATION_TYPE,version:1,label:'blind registration'});
  keys(registration.data,['signed']);let payload;
  try{payload=authority.open(registration.data.signed,'blind.registration');}catch(error){
    integrity(false,'Blind registration receipt does not verify',{cause:safeCode(error)});
  }
  integrity(payload&&typeof payload==='object','Blind registration payload is malformed');
  identifier(payload.replicationId,'blind replication ID');identifier(payload.missionId,'blind mission ID');identifier(payload.runId,'blind run ID');
  digest(payload.contextHash,'blind context hash');digest(payload.requestHash,'blind request hash');
  digest(payload.missionIntentHash,'blind mission intent hash');digest(payload.policyHash,'blind policy hash');
  string(payload.requestJson,'blind frozen request',{min:1,max:8*1024*1024});
  integrity(registration.id===payload.replicationId,'Blind registration record belongs to another replication');
  let request;try{request=JSON.parse(payload.requestJson);}catch{integrity(false,'Blind registration request bytes are not JSON');}
  integrity(request&&inferenceRequestHash(request)===payload.requestHash,'Blind registration request hash differs from frozen bytes');
  const {mission,origin}=frozenMission(store,payload,registration,{current});
  const run=store.get(RUN_TYPE,payload.runId,1),d=run?.data;
  integrity(run&&d&&d.id===run.id&&d.mode==='replicator'&&d.missionId===payload.missionId
    &&d.contextHash===payload.contextHash&&sha256(d.context)===d.contextHash
    &&Array.isArray(d.context?.artifactIds)&&d.context.artifactIds.length===0
    &&Array.isArray(d.context?.sourceIds)&&d.context.sourceIds.length===0&&d.context.producerConversationIncluded===false
    &&!(d.contextHistory?.length)&&!(d.toolObservations?.length)&&!(d.runtimeObservations?.length)
    &&!(d.requests?.length)&&!d.expectedRequestHash&&!d.inferenceReceipt&&!(d.inferenceReceipts?.length),
  'Blind registration does not bind its initial closed replicator');
  const chronology=expectOrder(store,[
    {ref:reference(mission),label:'blind mission'},
    {ref:reference(run),label:'blind initial run'},
    {ref:reference(registration),label:'blind registration'}
  ],'Blind registration prerequisite');
  return {registration,payload,request,mission,origin,run,chronology};
}

function frozenState(store,lineage,frozenReference){
  const frozen=exact(store,frozenReference,{type:REPLICATION_TYPE,id:lineage.payload.replicationId,version:1,label:'blind FROZEN state'}),d=frozen.data;
  keys(d,['state','registrationHash']);
  integrity(d.state==='FROZEN'&&d.registrationHash===lineage.registration.hash,
    'Blind FROZEN state differs from its signed registration');
  integrity(committedSequence(store,reference(lineage.registration),'blind registration')
    <committedSequence(store,reference(frozen),'blind FROZEN state'),
  'Blind FROZEN state predates its registration');
  return frozen;
}

function runningState(store,lineage,frozen){
  const running=store.get(REPLICATION_TYPE,lineage.payload.replicationId,2),d=running?.data;
  integrity(running&&d&&running.type===REPLICATION_TYPE&&running.id===lineage.payload.replicationId&&running.version===2,
    'Blind RUNNING checkpoint is absent');
  keys(d,['state','registrationHash','dispatchRequestHash']);
  integrity(d.state==='RUNNING'&&d.registrationHash===lineage.registration.hash&&d.dispatchRequestHash===lineage.payload.requestHash,
    'Blind RUNNING checkpoint differs from the frozen dispatch');
  return running;
}

function pendingRun(store,lineage,pendingReference){
  const pending=exact(store,pendingReference,{type:RUN_TYPE,id:lineage.payload.runId,label:'blind pending run'}),d=pending.data,initial=lineage.run.data;
  integrity(pending.version>lineage.run.version&&d?.id===lineage.run.id&&d.mode==='replicator'
    &&d.missionId===lineage.payload.missionId&&d.nodeId===initial.nodeId
    &&d.contextHash===lineage.payload.contextHash&&sha256(d.context)===d.contextHash
    &&canonical(d.context)===canonical(initial.context)
    &&!(d.contextHistory?.length)&&!(d.toolObservations?.length)&&!(d.runtimeObservations?.length)
    &&d.expectedRequestHash===lineage.payload.requestHash&&!d.inferenceReceipt&&!(d.inferenceReceipts?.length)
    &&Array.isArray(d.requests)&&d.requests.length===1&&d.requests[0]?.requestHash===lineage.payload.requestHash
    &&d.requests[0]?.contextHash===lineage.payload.contextHash,
  'Blind pending run is not one exact untouched closed dispatch');
  return pending;
}

function retainedRequest(store,lineage,requestReference){
  const request=exact(store,requestReference,{type:REQUEST_TYPE,version:1,label:'blind retained request'}),d=request.data;
  integrity(request.id===`inference-request:${sha256([lineage.payload.runId,lineage.payload.requestHash])}`
    &&d?.schema==='sovereign.inference-request.v1'&&d.runId===lineage.payload.runId&&d.missionId===lineage.payload.missionId
    &&d.requestHash===lineage.payload.requestHash&&d.retention==='BEFORE_DISPATCH'&&d.requestJson===lineage.payload.requestJson,
  'Blind retained request differs from its frozen public packet');
  let parsed;try{parsed=JSON.parse(d.requestJson);}catch{integrity(false,'Blind retained request bytes are not JSON');}
  integrity(inferenceRequestHash(parsed)===lineage.payload.requestHash,'Blind retained request bytes changed');
  return request;
}

function blindCall(store,lineage,frozen,pending,request,callReference){
  const call=exact(store,callReference,{type:CALL_TYPE,version:1,label:'blind mission inference call'}),d=call.data;
  keys(d,['schema','missionId','origin','ordinal','kind','binding','prior']);
  keys(d.binding,['registration','frozen','run','request','requestHash']);
  integrity(d.schema===CALL_SCHEMA&&d.missionId===lineage.payload.missionId&&d.kind==='blind-replica'
    &&same(d.binding.registration,reference(lineage.registration))&&same(d.binding.frozen,reference(frozen))
    &&same(d.binding.run,reference(pending))&&same(d.binding.request,reference(request))
    &&d.binding.requestHash===lineage.payload.requestHash,
  'Blind mission call does not bind its exact frozen request');
  return call;
}

/** Validate the closed binding before a mission-call row exists.  This is the
 * narrow form used by the allocator while it is about to create that row; the
 * full lineage verifier below additionally binds the resulting immutable call
 * and, for readers, its signed proof and RUNNING checkpoint. */
export function assertMissionBlindReplicaReservationBinding(deps,{registration,frozen,run,request,requestHash}={}, {current=true}={}){
  return failClosed(()=>{
    const {store,authority}=dependencies(deps);digest(requestHash,'blind consumer request hash');
    const lineage=parsedRegistration(store,authority,registration,{current}),frozenRecord=frozenState(store,lineage,frozen),
      pending=pendingRun(store,lineage,run),requestRecord=retainedRequest(store,lineage,request);
    integrity(requestHash===lineage.payload.requestHash,'Blind consumer request hash differs from frozen registration');
    return clone({registration:reference(lineage.registration),frozen:reference(frozenRecord),pendingRun:reference(pending),
      request:reference(requestRecord),mission:reference(lineage.mission),replicationId:lineage.payload.replicationId,
      missionId:lineage.payload.missionId,runId:lineage.payload.runId,requestHash:lineage.payload.requestHash,
      contextHash:lineage.payload.contextHash});
  },'Blind reservation binding cannot be read as trusted provenance');
}

function dispatchPayload(store,authority,input,issuedAt,{requireRunning=false,current=true}={}){
  keys(input,['registration','frozen','pendingRun','request','call']);instant(issuedAt,'blind dispatch proof issuedAt');
  const lineage=parsedRegistration(store,authority,input.registration,{current}),frozen=frozenState(store,lineage,input.frozen),
    pending=pendingRun(store,lineage,input.pendingRun),request=retainedRequest(store,lineage,input.request),
    call=blindCall(store,lineage,frozen,pending,request,input.call);
  const running=requireRunning?runningState(store,lineage,frozen):null;
  const payload={schema:MISSION_BLIND_REPLICA_DISPATCH_PROOF_SCHEMA,
    registration:reference(lineage.registration),frozen:reference(frozen),pendingRun:reference(pending),request:reference(request),call:reference(call),
    mission:reference(lineage.mission),replicationId:lineage.payload.replicationId,missionId:lineage.payload.missionId,
    runId:lineage.payload.runId,requestHash:lineage.payload.requestHash,contextHash:lineage.payload.contextHash,issuedAt};
  validateDispatchPayload(store,authority,payload,{requireRunning});
  return {payload,lineage,frozen,pending,request,call,running};
}

function validateDispatchPayload(store,authority,payload,{requireRunning=false,current=true}={}){
  keys(payload,['schema','registration','frozen','pendingRun','request','call','mission','replicationId','missionId','runId','requestHash','contextHash','issuedAt']);
  integrity(payload.schema===MISSION_BLIND_REPLICA_DISPATCH_PROOF_SCHEMA,'Blind dispatch proof schema is unknown');
  identifier(payload.replicationId,'blind proof replication ID');identifier(payload.missionId,'blind proof mission ID');identifier(payload.runId,'blind proof run ID');
  digest(payload.requestHash,'blind proof request hash');digest(payload.contextHash,'blind proof context hash');instant(payload.issuedAt,'blind proof issuedAt');
  const built=dispatchPayloadNoRecursion(store,authority,payload,{requireRunning,current});
  integrity(same(payload.registration,reference(built.lineage.registration))&&same(payload.frozen,reference(built.frozen))
    &&same(payload.pendingRun,reference(built.pending))&&same(payload.request,reference(built.request))&&same(payload.call,reference(built.call))
    &&same(payload.mission,reference(built.lineage.mission))&&payload.replicationId===built.lineage.payload.replicationId
    &&payload.missionId===built.lineage.payload.missionId&&payload.runId===built.lineage.payload.runId
    &&payload.requestHash===built.lineage.payload.requestHash&&payload.contextHash===built.lineage.payload.contextHash,
  'Blind dispatch proof differs from its exact closed lineage');
  const items=[
    {ref:reference(built.lineage.mission),label:'blind mission'},
    {ref:reference(built.lineage.run),label:'blind initial run'},
    {ref:reference(built.lineage.registration),label:'blind registration'},
    {ref:reference(built.frozen),label:'blind FROZEN state'},
    {ref:reference(built.pending),label:'blind pending run'},
    {ref:reference(built.request),label:'blind retained request'},
    {ref:reference(built.call),label:'blind mission call'}
  ];
  const chronology=expectOrder(store,items,'Blind dispatch prerequisite');
  if(requireRunning){
    const runningSequence=committedSequence(store,reference(built.running),'blind RUNNING checkpoint');
    // The proof itself is checked by signedProof below.  Its caller verifies
    // that this lifecycle checkpoint follows it, rather than allowing a
    // historical RUNNING record to backdate a later forged reservation.
    integrity(chronology.at(-1)<runningSequence,'Blind RUNNING checkpoint predates its mission call');
  }
  return {...built,chronology};
}

// `validateDispatchPayload` must reconstruct the same lineage without calling
// itself through `dispatchPayload`.  Keeping this small helper separate makes
// the proof parser total and avoids an accidental validation recursion.
function dispatchPayloadNoRecursion(store,authority,payload,{requireRunning=false,current=true}={}){
  const lineage=parsedRegistration(store,authority,payload.registration,{current}),frozen=frozenState(store,lineage,payload.frozen),
    pending=pendingRun(store,lineage,payload.pendingRun),request=retainedRequest(store,lineage,payload.request),
    call=blindCall(store,lineage,frozen,pending,request,payload.call),running=requireRunning?runningState(store,lineage,frozen):null;
  return {lineage,frozen,pending,request,call,running};
}

export function missionBlindReplicaDispatchProofId(replicationId,requestHash){
  identifier(replicationId,'blind replication ID');digest(requestHash,'blind request hash');
  return PROOF_PREFIX+sha256([replicationId,requestHash]);
}

function signedProof(store,authority,proofReference,{current=true}={}){
  const proof=exact(store,proofReference,{type:MISSION_BLIND_REPLICA_DISPATCH_PROOF_TYPE,version:1,label:'blind dispatch proof'});
  keys(proof.data,['signed']);let payload;
  try{payload=authority.open(proof.data.signed,MISSION_BLIND_REPLICA_DISPATCH_PROOF_KIND);}catch(error){
    integrity(false,'Blind dispatch proof receipt does not verify',{cause:safeCode(error)});
  }
  const lineage=validateDispatchPayload(store,authority,payload,{requireRunning:true,current});
  integrity(proof.id===missionBlindReplicaDispatchProofId(payload.replicationId,payload.requestHash),
    'Blind dispatch proof identifier differs from its frozen request');
  const sequence=committedSequence(store,reference(proof),'blind dispatch proof');
  integrity(lineage.chronology.at(-1)<sequence&&sequence<committedSequence(store,reference(lineage.running),'blind RUNNING checkpoint'),
    'Blind dispatch proof is not between its reservation and RUNNING checkpoint');
  return {proof,payload,lineage,sequence};
}

function failClosed(fn,message){
  try{return fn();}catch(error){
    if(error?.code===MISSION_INFERENCE_PROVENANCE_INTEGRITY)throw error;
    integrity(false,message,{cause:safeCode(error)});
  }
}

/** Validate a blind reservation before (or, when requested, after) its signed
 * proof.  The budget allocator uses the core form while creating a fresh row;
 * readers use the complete form and also require the RUNNING checkpoint. */
export function assertMissionBlindReplicaReservationLineage(deps,input={}, {current=true}={}){
  return failClosed(()=>{
    keys(input,['registration','frozen','run','request','requestHash','call','requireDispatchProof']);
    const {store,authority}=dependencies(deps),requireDispatchProof=input.requireDispatchProof===true;
    const base=assertMissionBlindReplicaReservationBinding({store,authority},input,{current});
    // A reader reconstructs only durable references.  It must never invoke a
    // newly configured clock while validating a historical signed proof.
    const built=dispatchPayloadNoRecursion(store,authority,{registration:input.registration,frozen:input.frozen,pendingRun:input.run,
      request:input.request,call:input.call},{requireRunning:requireDispatchProof,current});
    integrity(base.requestHash===built.lineage.payload.requestHash,'Blind consumer request hash differs from reservation lineage');
    if(!requireDispatchProof)return clone({registration:reference(built.lineage.registration),frozen:reference(built.frozen),
      pendingRun:reference(built.pending),request:reference(built.request),call:reference(built.call),
      mission:reference(built.lineage.mission),replicationId:built.lineage.payload.replicationId,missionId:built.lineage.payload.missionId,
      runId:built.lineage.payload.runId,requestHash:built.lineage.payload.requestHash,contextHash:built.lineage.payload.contextHash});
    const proof=store.get(MISSION_BLIND_REPLICA_DISPATCH_PROOF_TYPE,
      missionBlindReplicaDispatchProofId(built.lineage.payload.replicationId,built.lineage.payload.requestHash));
    integrity(proof,'No signed blind dispatch proof exists for this exact frozen request');
    const signed=signedProof(store,authority,reference(proof),{current});
    integrity(same(signed.payload.registration,reference(built.lineage.registration))&&same(signed.payload.frozen,reference(built.frozen))
      &&same(signed.payload.pendingRun,reference(built.pending))&&same(signed.payload.request,reference(built.request))
      &&same(signed.payload.call,reference(built.call)),
    'Blind signed proof differs from the consumer reservation');
    return clone({record:reference(signed.proof),registration:signed.payload.registration,frozen:signed.payload.frozen,
      pendingRun:signed.payload.pendingRun,request:signed.payload.request,call:signed.payload.call,
      mission:signed.payload.mission,replicationId:signed.payload.replicationId,missionId:signed.payload.missionId,
      runId:signed.payload.runId,requestHash:signed.payload.requestHash,contextHash:signed.payload.contextHash,sequence:signed.sequence});
  },'Blind reservation lacks trusted closed-dispatch provenance');
}

export function assertMissionBlindReplicaDispatchProvenance(deps,{replicationId,requestHash,registration=null,run=null,request=null,call=null}={}, {current=true}={}){
  return failClosed(()=>{
    identifier(replicationId,'blind consumer replication ID');digest(requestHash,'blind consumer request hash');
    const {store,authority}=dependencies(deps),proof=store.get(MISSION_BLIND_REPLICA_DISPATCH_PROOF_TYPE,
      missionBlindReplicaDispatchProofId(replicationId,requestHash));
    integrity(proof,'No signed blind dispatch proof exists for this exact closed request');
    const signed=signedProof(store,authority,reference(proof),{current}),p=signed.payload;
    integrity(p.replicationId===replicationId&&p.requestHash===requestHash,'Blind proof differs from the requested replica');
    const optional=[['registration',registration,p.registration],['run',run,p.pendingRun],['request',request,p.request],['call',call,p.call]];
    for(const [label,expected,actual] of optional)if(expected!==null)integrity(same(assertReference(expected,`expected blind ${label}`),actual),
      `Blind proof ${label} differs from consumer expectation`);
    return clone({record:reference(signed.proof),registration:p.registration,frozen:p.frozen,pendingRun:p.pendingRun,request:p.request,
      call:p.call,mission:p.mission,replicationId:p.replicationId,missionId:p.missionId,runId:p.runId,
      requestHash:p.requestHash,contextHash:p.contextHash,sequence:signed.sequence});
  },'Blind dispatch provenance cannot be read as trusted evidence');
}

/** Read the signed registration against the immutable freeze-time mission
 * record.  `current:false` deliberately avoids treating later unrelated
 * policy/ledger corruption as a rewrite of historical evidence. */
export function readMissionBlindReplicaRegistration(deps,registration,{current=true}={}){
  return failClosed(()=>{
    const {store,authority}=dependencies(deps),lineage=parsedRegistration(store,authority,registration,{current});
    return clone({registration:reference(lineage.registration),mission:reference(lineage.mission),missionPolicy:clone(lineage.mission.data.policy),
      replicationId:lineage.payload.replicationId,missionId:lineage.payload.missionId,runId:lineage.payload.runId,
      requestHash:lineage.payload.requestHash,contextHash:lineage.payload.contextHash});
  },'Blind registration cannot be read as trusted historical provenance');
}

/**
 * Process-local capability for the one closed BlindReplicationService path.
 * Preflights are opaque and tied to Store's active transaction witness.  A
 * later transaction cannot attach a proof to an old shaped pending run/request
 * /call trio.  This is an API-misuse boundary, not containment of code that
 * already owns Store and Authority (those remain the local TCB).
 */
export class MissionBlindReplicaProvenanceControl {
  #store; #authority; #preflights=new WeakMap();
  constructor(deps){const {store,authority}=dependencies(deps);this.#store=store;this.#authority=authority;}
  prepareBlindDispatch({replicationId,registrationRecord,frozenStateRecord}={}){
    return failClosed(()=>{
      identifier(replicationId,'blind preflight replication ID');
      integrity(this.#store.db.isTransaction,'Blind dispatch preflight must share its material transaction');
      const lineage=parsedRegistration(this.#store,this.#authority,reference(registrationRecord));
      integrity(lineage.payload.replicationId===replicationId,'Blind preflight registration belongs to another replica');
      const frozen=frozenState(this.#store,lineage,reference(frozenStateRecord));
      const currentState=this.#store.get(REPLICATION_TYPE,replicationId),currentRun=this.#store.get(RUN_TYPE,lineage.payload.runId);
      integrity(currentState&&same(reference(currentState),reference(frozen))&&currentRun&&same(reference(currentRun),reference(lineage.run)),
        'Blind preflight requires an untouched FROZEN replica and initial run');
      const token=Object.freeze(Object.create(null)),witness=this.#store.transactionWitness();
      this.#preflights.set(token,{witness,registration:reference(lineage.registration),frozen:reference(frozen),initialRun:reference(lineage.run),
        replicationId,missionId:lineage.payload.missionId,runId:lineage.payload.runId,requestHash:lineage.payload.requestHash,
        requestJson:lineage.payload.requestJson});
      return token;
    },'Blind dispatch provenance preflight cannot be prepared');
  }
  #entry(preflight){
    const entry=this.#preflights.get(preflight);
    integrity(entry,'Blind dispatch provenance preflight is absent, foreign, expired or already consumed');return entry;
  }
  abort({preflight}={}){
    // A failed nested mutation can be caught by an outer transaction.  Make
    // the opaque token unusable immediately instead of relying on rollback or
    // GC to clear it; its transaction witness is still a second-line guard.
    if(preflight&&typeof preflight==='object')this.#preflights.delete(preflight);
    return true;
  }
  assertPrepared({preflight,replicationId,runRecord,request,requestHash}={}){
    return failClosed(()=>{
      const entry=this.#entry(preflight);identifier(replicationId,'blind prepared replication ID');digest(requestHash,'blind prepared request hash');
      integrity(replicationId===entry.replicationId&&requestHash===entry.requestHash
        &&same(reference(runRecord),entry.initialRun)&&inferenceRequestHash(request)===entry.requestHash
        &&JSON.stringify(request)===entry.requestJson,
      'Blind request was not prepared from this exact frozen public packet');
      const state=this.#store.get(REPLICATION_TYPE,entry.replicationId),run=this.#store.get(RUN_TYPE,entry.runId);
      integrity(state&&same(reference(state),entry.frozen)&&run&&same(reference(run),entry.initialRun),
        'Blind FROZEN state or initial run changed before request retention');
      return clone({kind:'blind-replica',replicationId:entry.replicationId,requestHash:entry.requestHash});
    },'Blind dispatch preparation cannot be validated');
  }
  reservationBinding({preflight,pendingRun,requestRecord}={}){
    return failClosed(()=>{
      const entry=this.#entry(preflight),pending=reference(pendingRun),request=reference(requestRecord);
      integrity(pending.type===RUN_TYPE&&pending.id===entry.runId&&request.type===REQUEST_TYPE
        &&request.id===`inference-request:${sha256([entry.runId,entry.requestHash])}`,
      'Blind reservation records differ from its prepared replica');
      return clone({registration:entry.registration,frozen:entry.frozen,run:pending,request,requestHash:entry.requestHash});
    },'Blind reservation binding cannot be prepared');
  }
  issueBlindReservation({preflight,pendingRun,requestRecord,callRecord}={}){
    const entry=this.#preflights.get(preflight);
    try{return failClosed(()=>{
      integrity(entry,'Blind dispatch provenance preflight is absent, foreign, expired or already consumed');
      const pending=reference(pendingRun),request=reference(requestRecord),call=reference(callRecord);
      this.#store.assertCurrentTransactionWrite(entry.witness,pending);
      this.#store.assertCurrentTransactionWrite(entry.witness,request,{after:pending});
      this.#store.assertCurrentTransactionWrite(entry.witness,call,{after:request});
      const built=dispatchPayload(this.#store,this.#authority,{registration:entry.registration,frozen:entry.frozen,pendingRun:pending,request,call},this.#store.clock());
      integrity(built.payload.replicationId===entry.replicationId&&built.payload.requestHash===entry.requestHash,
        'Blind dispatch proof lineage differs from its preflight');
      const proofId=missionBlindReplicaDispatchProofId(entry.replicationId,entry.requestHash);
      integrity(!this.#store.get(MISSION_BLIND_REPLICA_DISPATCH_PROOF_TYPE,proofId),
        'Blind dispatch proof already exists for this frozen request');
      return clone(this.#store.put(MISSION_BLIND_REPLICA_DISPATCH_PROOF_TYPE,proofId,
        {signed:this.#authority.seal(MISSION_BLIND_REPLICA_DISPATCH_PROOF_KIND,built.payload)},{expectedVersion:0}));
    },'Blind dispatch provenance cannot be issued');
    }finally{if(preflight&&typeof preflight==='object')this.#preflights.delete(preflight);}
  }
  completeUnbudgetedBlindRequest({preflight,pendingRun:pendingRunRecord,requestRecord}={}){
    const entry=this.#preflights.get(preflight);
    try{return failClosed(()=>{
      integrity(entry,'Blind dispatch provenance preflight is absent, foreign, expired or already consumed');
      const pending=reference(pendingRunRecord),request=reference(requestRecord);
      this.#store.assertCurrentTransactionWrite(entry.witness,pending);
      this.#store.assertCurrentTransactionWrite(entry.witness,request,{after:pending});
      const lineage=parsedRegistration(this.#store,this.#authority,entry.registration);
      pendingRun(this.#store,lineage,pending);retainedRequest(this.#store,lineage,request);
      return true;
    },'Unbudgeted blind dispatch cannot be completed');
    }finally{if(preflight&&typeof preflight==='object')this.#preflights.delete(preflight);}
  }
}

// A single nominal blind control can be installed idempotently by multiple
// BlindReplicationService instances that share the exact local TCB.  It does
// not merge the worker control: their protocol roots and public Registry APIs
// remain deliberately distinct.
const controlsByStore=new WeakMap();
export function sharedMissionBlindReplicaProvenanceControl(deps){
  const {store,authority}=dependencies(deps);let byAuthority=controlsByStore.get(store);
  if(!byAuthority){byAuthority=new WeakMap();controlsByStore.set(store,byAuthority);}
  let control=byAuthority.get(authority);
  if(!control){control=new MissionBlindReplicaProvenanceControl({store,authority});byAuthority.set(authority,control);}
  return control;
}
