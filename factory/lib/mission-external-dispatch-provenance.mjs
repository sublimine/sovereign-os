// Durable provenance for inference-consuming operations that are not ordinary
// worker dispatches.  Search and a native callback have materially different
// authority and lifecycle contracts, so neither is represented as a fake
// `worker` reservation.  The proof records are signed after the relevant lease
// has been verified in the same SQLite transaction as the irreversible local
// dispatch marker.  They preserve historical authorization; a later lease
// revocation must block new work, never rewrite an already-reserved call.
import {canonical,check,clone,digest,identifier,instant,integer,keys,safeCode,sha256,string} from './contracts.mjs';
import {inferenceRequestHash} from '../providers/instruction-profiles.mjs';
import {inspectNativeReadTranscript} from '../providers/native-read-transcript.mjs';
import {readNativeReadSession} from './native-read-session.mjs';
import {
  MISSION_INFERENCE_ACTOR_ORIGIN_TYPE,
  MISSION_INFERENCE_PROVENANCE_INTEGRITY,
  assertMissionInferenceDispatchProvenance,
  missionInferenceRecordRef,
  readMissionInferenceActorOrigin
} from './mission-inference-provenance.mjs';

export const MISSION_SEARCH_DISPATCH_PROOF_TYPE='mission-search-dispatch-proof';
export const MISSION_SEARCH_DISPATCH_PROOF_SCHEMA='sovereign.mission-search-dispatch-proof.v1';
export const MISSION_SEARCH_DISPATCH_PROOF_KIND='mission.search-dispatch-proof';
export const MISSION_NATIVE_CONTINUATION_DISPATCH_PROOF_TYPE='mission-native-continuation-dispatch-proof';
export const MISSION_NATIVE_CONTINUATION_DISPATCH_PROOF_SCHEMA='sovereign.mission-native-continuation-dispatch-proof.v1';
export const MISSION_NATIVE_CONTINUATION_DISPATCH_PROOF_KIND='mission.native-continuation-dispatch-proof';

const SEARCH_PREFIX='mission-search-dispatch-proof:';
const NATIVE_PREFIX='mission-native-continuation-dispatch-proof:';
const EFFECT_TYPE='effect';
const LEASE_TYPE='lease';
const REQUEST_TYPE='inference-request';
const CALL_TYPE='mission-inference-call';
const NATIVE_SESSION_TYPE='native-read-session';
const NATIVE_CONTINUATION_TYPE='native-read-continuation';
const CLASSIFICATIONS=['PUBLIC','INTERNAL','CONFIDENTIAL','RESTRICTED'];

const integrity=(condition,message,details)=>check(condition,MISSION_INFERENCE_PROVENANCE_INTEGRITY,message,details);
const same=(left,right)=>canonical(left)===canonical(right);
const reference=record=>({type:record.type,id:record.id,version:record.version,hash:record.hash});

function dependencies(value){
  integrity(value&&typeof value==='object','Store and signing authority are required');
  const {store,authority}=value;
  integrity(store&&typeof store.get==='function'&&typeof store.put==='function'&&store.db,
    'A durable Store is required');
  integrity(authority&&typeof authority.seal==='function'&&typeof authority.open==='function'
    &&typeof authority.verify==='function','A signing Authority is required');
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

function classificationAtLeast(actual,required){
  integrity(CLASSIFICATIONS.includes(actual)&&CLASSIFICATIONS.includes(required),'Lease classification is unknown');
  return CLASSIFICATIONS.indexOf(required)<=CLASSIFICATIONS.indexOf(actual);
}

function historicalLease(store,authority,leaseReference,{signed=null,missionId,principalId,action,resource,classification,issuedAt}){
  const lease=exact(store,leaseReference,{type:LEASE_TYPE,label:'dispatch lease'});
  integrity(lease.version===1&&lease.data?.revoked===false&&lease.data?.signed,
    'Dispatch lease is not the immutable active lease observed at dispatch');
  if(signed!==null)integrity(same(lease.data.signed,signed),'Dispatch proof lease differs from the verified lease');
  let data;
  try{data=authority.open(lease.data.signed,'authority.lease');}catch(error){
    integrity(false,'Dispatch lease receipt does not verify',{cause:safeCode(error)});
  }
  keys(data,['id','missionId','principalId','actions','resources','issuedAt','expiresAt','classification','parentId','dispatch'],
    ['id','missionId','principalId','actions','resources','issuedAt','expiresAt','classification','parentId']);
  if(data.dispatch!==undefined){
    keys(data.dispatch,['operationId','tool','argsHash']);
    identifier(data.dispatch.operationId,'dispatch lease operation ID');identifier(data.dispatch.tool,'dispatch lease tool');
    digest(data.dispatch.argsHash,'dispatch lease arguments hash');
  }
  identifier(data.id,'dispatch lease ID');identifier(data.missionId,'dispatch lease mission ID');identifier(data.principalId,'dispatch lease principal ID');
  integrity(data.id===lease.id&&data.missionId===missionId&&data.principalId===principalId
    &&Array.isArray(data.actions)&&data.actions.includes(action)&&Array.isArray(data.resources)&&data.resources.includes(resource)
    &&classificationAtLeast(data.classification,classification),
  'Dispatch lease scope differs from the signed operation');
  const start=instant(data.issuedAt,'dispatch lease issuedAt'),end=instant(data.expiresAt,'dispatch lease expiresAt'),at=instant(issuedAt,'dispatch proof issuedAt');
  integrity(start<=at&&at<end,'Dispatch proof time falls outside its historical lease');
  return {record:lease,data};
}

function readSignedRecord(store,authority,referenceValue,{type,kind,label}){
  const record=exact(store,referenceValue,{type,label});keys(record.data,['signed']);let payload;
  try{payload=authority.open(record.data.signed,kind);}catch(error){
    integrity(false,`${label} receipt does not verify`,{cause:safeCode(error)});
  }
  return {record,payload};
}

export function missionSearchDispatchProofId(effectReference,callReference){
  const effect=assertReference(effectReference,'search effect');
  const call=assertReference(callReference,'search mission call');
  integrity(effect.type===EFFECT_TYPE,'Search proof requires an effect reference');
  integrity(call.type===CALL_TYPE,'Search proof requires a mission-call reference');
  return SEARCH_PREFIX+sha256([effect.id,effect.version,effect.hash,call.id,call.version,call.hash]);
}

export function missionNativeContinuationDispatchProofId(continuationReference,callReference){
  const continuation=assertReference(continuationReference,'native continuation');
  const call=assertReference(callReference,'native mission call');
  integrity(continuation.type===NATIVE_CONTINUATION_TYPE,'Native proof requires a continuation reference');
  integrity(call.type===CALL_TYPE,'Native proof requires a mission-call reference');
  return NATIVE_PREFIX+sha256([continuation.id,continuation.version,continuation.hash,call.id,call.version,call.hash]);
}

function searchPayload(store,authority,{effect,call,signedLease,issuedAt}){
  const dispatch=exact(store,effect,{type:EFFECT_TYPE,label:'search effect'}),d=dispatch.data;
  integrity(dispatch.version===2&&d&&d.state==='DISPATCHED'&&d.tool==='source.search',
    'Search proof requires the immutable initial DISPATCHED discovery effect');
  identifier(d.missionId,'search mission ID');identifier(d.principalId,'search principal ID');digest(d.argsHash,'search arguments hash');
  const verified=authority.verify(signedLease,{missionId:d.missionId,principalId:d.principalId,action:'source.search',resource:'public-web',classification:'PUBLIC'});
  integrity(verified.dispatch?.operationId===dispatch.id&&verified.dispatch.tool==='source.search'
    &&verified.dispatch.argsHash===d.argsHash,
  'A budgeted search requires one exact broker dispatch permit');
  const lease=store.get(LEASE_TYPE,verified.id);
  integrity(lease&&lease.version===1&&lease.data?.revoked===false&&same(lease.data.signed,signedLease),
    'Verified discovery lease is no longer its immutable active record');
  const payload={schema:MISSION_SEARCH_DISPATCH_PROOF_SCHEMA,effect:reference(dispatch),call:assertReference(call,'search proof mission call'),lease:reference(lease),leaseHash:sha256(signedLease),
    missionId:d.missionId,principalId:d.principalId,tool:d.tool,argsHash:d.argsHash,issuedAt};
  validateSearchPayload(store,authority,payload);return payload;
}

function validateSearchPayload(store,authority,payload){
  keys(payload,['schema','effect','call','lease','leaseHash','missionId','principalId','tool','argsHash','issuedAt']);
  integrity(payload.schema===MISSION_SEARCH_DISPATCH_PROOF_SCHEMA&&payload.tool==='source.search',
    'Search dispatch proof schema or tool is unknown');
  identifier(payload.missionId,'search proof mission ID');identifier(payload.principalId,'search proof principal ID');
  digest(payload.leaseHash,'search proof lease hash');digest(payload.argsHash,'search proof args hash');instant(payload.issuedAt,'search proof issuedAt');
  const effect=exact(store,payload.effect,{type:EFFECT_TYPE,version:2,label:'search proof effect'}),d=effect.data;
  integrity(d?.state==='DISPATCHED'&&d.missionId===payload.missionId&&d.principalId===payload.principalId
    &&d.tool===payload.tool&&d.argsHash===payload.argsHash,'Search dispatch proof differs from its effect');
  const call=exact(store,payload.call,{type:CALL_TYPE,version:1,label:'search proof mission call'}),callData=call.data;
  keys(callData,['schema','missionId','origin','ordinal','kind','binding','prior']);keys(callData.binding,['effect']);
  integrity(callData.schema==='sovereign.mission-inference-call.v1'&&callData.missionId===payload.missionId
    &&callData.kind==='search'&&same(callData.binding.effect,reference(effect)),
  'Search dispatch proof does not bind its exact global reservation');
  const lease=historicalLease(store,authority,payload.lease,{missionId:payload.missionId,principalId:payload.principalId,
    action:'source.search',resource:'public-web',classification:'PUBLIC',issuedAt:payload.issuedAt});
  integrity(lease.data.dispatch?.operationId===effect.id&&lease.data.dispatch.tool==='source.search'
    &&lease.data.dispatch.argsHash===d.argsHash,
  'Historical budgeted search lease is not its exact one-shot dispatch permit');
  authority.assertDispatchConsumed(lease.record.data.signed,{operationId:effect.id,tool:'source.search',argsHash:d.argsHash});
  integrity(sha256(lease.record.data.signed)===payload.leaseHash,'Search dispatch proof lease hash differs from its immutable lease');
  const chronology=expectOrder(store,[
    {ref:reference(lease.record),label:'search lease'},
    {ref:reference(effect),label:'search dispatched effect'},
    {ref:reference(call),label:'search mission call'}
  ],'Search dispatch proof prerequisite');
  return {effect,call,lease,chronology};
}

function issueSearchDispatchProof({store,authority},{effect,call,signedLease,issuedAt}){
  const payload=searchPayload(store,authority,{effect,call,signedLease,issuedAt});
  const proofId=missionSearchDispatchProofId(payload.effect,payload.call);
  integrity(!store.get(MISSION_SEARCH_DISPATCH_PROOF_TYPE,proofId),'Search dispatch proof already exists for this effect');
  return clone(store.put(MISSION_SEARCH_DISPATCH_PROOF_TYPE,proofId,
    {signed:authority.seal(MISSION_SEARCH_DISPATCH_PROOF_KIND,payload)},{expectedVersion:0}));
}

function signedSearchProof(store,authority,proofReference){
  const proof=readSignedRecord(store,authority,proofReference,{type:MISSION_SEARCH_DISPATCH_PROOF_TYPE,
    kind:MISSION_SEARCH_DISPATCH_PROOF_KIND,label:'search dispatch proof'});
  const lineage=validateSearchPayload(store,authority,proof.payload);
  integrity(proof.record.version===1&&proof.record.id===missionSearchDispatchProofId(proof.payload.effect,proof.payload.call),
    'Search dispatch proof identifier or version is invalid');
  const sequence=committedSequence(store,reference(proof.record),'search dispatch proof');
  integrity(lineage.chronology.at(-1)<sequence,'Search dispatch proof predates its mission-call reservation');
  return {...proof,lineage,sequence};
}

/** Verify that a budgeted search call derives from one exact signed dispatch. */
export function assertMissionSearchDispatchProvenance(deps,{effect,call}={}){
  return failClosed(()=>{
    const {store,authority}=dependencies(deps),effectRef=assertReference(effect,'search consumer effect'),callRef=assertReference(call,'search consumer call');
    integrity(effectRef.type===EFFECT_TYPE&&callRef.type===CALL_TYPE,'Search reservation references have unexpected types');
    const proof=store.get(MISSION_SEARCH_DISPATCH_PROOF_TYPE,missionSearchDispatchProofId(effectRef,callRef));
    integrity(proof,'No signed search dispatch proof exists for this exact effect');
    const result=signedSearchProof(store,authority,reference(proof));
    integrity(same(result.payload.effect,effectRef)&&same(result.payload.call,callRef),'Search proof differs from the consumer reservation');
    return clone({record:reference(result.record),effect:result.payload.effect,call:result.payload.call,lease:result.payload.lease,sequence:result.sequence,payload:result.payload});
  },'Search reservation lacks trusted dispatch provenance');
}

function retainedRequest(store,value,{runId,missionId,requestHash,label}){
  const request=exact(store,value,{type:REQUEST_TYPE,version:1,label});const d=request.data;
  integrity(d?.schema==='sovereign.inference-request.v1'&&request.id===`inference-request:${sha256([runId,requestHash])}`
    &&d.runId===runId&&d.missionId===missionId&&d.requestHash===requestHash&&d.retention==='BEFORE_DISPATCH',
  'Native continuation does not bind its exact retained prospective request');
  let parsed;try{parsed=JSON.parse(d.requestJson);}catch{integrity(false,'Native continuation request bytes are not valid JSON');}
  integrity(parsed&&inferenceRequestHash(parsed)===requestHash,'Native continuation request bytes differ from their request hash');
  return request;
}

function nativeContinuationLineage(store,authority,continuationReference){
  const continuation=exact(store,continuationReference,{type:NATIVE_CONTINUATION_TYPE,version:1,label:'native continuation'}),c=continuation.data;
  keys(c,['schema','missionId','runId','requestHash','session','request','operationId','callHash','charges','lease']);
  integrity(c.schema==='sovereign.native-read-continuation.v1'&&c.operationId===c.runId+':native-read:0'
    &&canonical(c.charges)===canonical({proposalSteps:1,brokerOperations:1}),
  'Native continuation schema or fixed accounting is invalid');
  identifier(c.missionId,'native continuation mission ID');identifier(c.runId,'native continuation run ID');digest(c.requestHash,'native continuation request hash');digest(c.callHash,'native continuation call hash');
  const session=exact(store,c.session,{type:NATIVE_SESSION_TYPE,label:'native callback session'}),s=session.data;
  keys(s,['schema','missionId','runId','requestHash','binding','transcript']);
  integrity(s.schema==='sovereign.native-read-session.v1'&&s.missionId===c.missionId&&s.runId===c.runId&&s.requestHash===c.requestHash,
    'Native continuation session differs from its continuation');
  // Reuse the native controller's canonical append-only/history validator.
  // Checking the single referenced frame alone would let a reversioned or
  // malformed later session head borrow an old apparently valid CALL frame.
  // First validate the complete, current append-only session through its
  // owner.  Then inspect the *immutable checkpoint* named by the
  // continuation: later PREPARED/FINISH frames are expected, and must not
  // make the earlier one-shot CALL frame disappear from its own lineage.
  readNativeReadSession({store},c.runId,{pending:false});
  const state=inspectNativeReadTranscript(s.transcript,s.transcript.head);
  integrity(state.phase==='CALLED'&&sha256(state.call)===c.callHash&&state.call?.arguments&&typeof state.call.arguments==='object',
    'Native continuation is not bound to one exact callback CALL frame');
  keys(s.binding,['mission','run','config','producer','request','limits']);
  const mission=exact(store,s.binding.mission,{type:'mission',id:c.missionId,version:1,label:'native continuation mission'});
  const run=exact(store,s.binding.run,{type:'run',id:c.runId,label:'native continuation pending run'});
  const configuration=exact(store,s.binding.config,{type:'worker-config',id:c.runId,version:1,label:'native continuation configuration'});
  const producer=exact(store,s.binding.producer,{type:'worker-production',id:c.runId,version:1,label:'native continuation production'});
  const request=retainedRequest(store,c.request,{runId:c.runId,missionId:c.missionId,requestHash:c.requestHash,label:'native continuation request'});
  integrity(same(c.request,s.binding.request)&&run.data?.expectedRequestHash===c.requestHash
    &&same(reference(request),s.binding.request)&&configuration.data?.prefixHash===sha256(configuration.data.instructions)
    &&producer.data?.status==='running'&&producer.data?.step===0,
  'Native continuation origin records do not bind one fresh bounded actor');
  const workerCalls=store.list(CALL_TYPE).filter(record=>{
    const d=record.data;
    return record.version===1&&d?.kind==='worker'&&d.missionId===c.missionId&&d.binding?.requestHash===c.requestHash
      &&same(d.binding?.run,s.binding.run)&&same(d.binding?.request,s.binding.request);
  });
  integrity(workerCalls.length===1,'Native continuation has no unique parent worker reservation');
  const workerCall=workerCalls[0];
  const parent=assertMissionInferenceDispatchProvenance({store,authority},{run:reference(run),request:reference(request),call:reference(workerCall),family:'native-bounded-producer'});
  const actor=readMissionInferenceActorOrigin({store,authority},parent.actorOrigin);
  integrity(actor.family==='native-bounded-producer'&&same(actor.mission,reference(mission))
    &&same(actor.workerConfiguration,reference(configuration)),
  'Native continuation actor origin differs from its bounded callback session');
  return {continuation,session,state,mission,run,configuration,producer,request,workerCall,parent,actor};
}

function nativePayload(store,authority,{continuation,call,signedLease,classification,issuedAt}){
  integrity(CLASSIFICATIONS.includes(classification),'Native continuation classification is unknown');
  const lineage=nativeContinuationLineage(store,authority,continuation),c=lineage.continuation.data;
  const verified=authority.verify(signedLease,{missionId:c.missionId,principalId:c.runId,action:'workspace.read',
    resource:`workspace:${c.missionId}`,classification});
  integrity(verified.dispatch?.operationId===c.operationId&&verified.dispatch.tool==='workspace.read'
    &&verified.dispatch.argsHash===sha256(lineage.state.call.arguments),
  'A budgeted native callback requires one exact broker dispatch permit');
  const lease=store.get(LEASE_TYPE,verified.id);
  integrity(lease&&lease.version===1&&lease.data?.revoked===false&&same(lease.data.signed,signedLease),
    'Verified native callback lease is no longer its immutable active record');
  const payload={schema:MISSION_NATIVE_CONTINUATION_DISPATCH_PROOF_SCHEMA,continuation:reference(lineage.continuation),
    session:reference(lineage.session),workerCall:reference(lineage.workerCall),call:assertReference(call,'native proof mission call'),actorOrigin:lineage.parent.actorOrigin,
    mission:reference(lineage.mission),lease:reference(lease),leaseHash:sha256(signedLease),
    missionId:c.missionId,runId:c.runId,requestHash:c.requestHash,operationId:c.operationId,callHash:c.callHash,
    argumentsHash:sha256(lineage.state.call.arguments),classification,issuedAt};
  validateNativePayload(store,authority,payload);return payload;
}

function validateNativePayload(store,authority,payload){
  keys(payload,['schema','continuation','session','workerCall','call','actorOrigin','mission','lease','leaseHash','missionId','runId','requestHash','operationId','callHash','argumentsHash','classification','issuedAt']);
  integrity(payload.schema===MISSION_NATIVE_CONTINUATION_DISPATCH_PROOF_SCHEMA&&CLASSIFICATIONS.includes(payload.classification),
    'Native continuation proof schema or classification is unknown');
  identifier(payload.missionId,'native proof mission ID');identifier(payload.runId,'native proof run ID');identifier(payload.operationId,'native proof operation ID');
  digest(payload.leaseHash,'native proof lease hash');digest(payload.requestHash,'native proof request hash');digest(payload.callHash,'native proof call hash');digest(payload.argumentsHash,'native proof arguments hash');instant(payload.issuedAt,'native proof issuedAt');
  const lineage=nativeContinuationLineage(store,authority,payload.continuation),c=lineage.continuation.data;
  integrity(same(payload.session,reference(lineage.session))&&same(payload.workerCall,reference(lineage.workerCall))
    &&same(payload.actorOrigin,lineage.parent.actorOrigin)&&same(payload.mission,reference(lineage.mission))
    &&payload.missionId===c.missionId&&payload.runId===c.runId&&payload.requestHash===c.requestHash
    &&payload.operationId===c.operationId&&payload.callHash===c.callHash&&payload.argumentsHash===sha256(lineage.state.call.arguments),
  'Native continuation proof differs from its exact callback lineage');
  const call=exact(store,payload.call,{type:CALL_TYPE,version:1,label:'native proof mission call'}),callData=call.data;
  keys(callData,['schema','missionId','origin','ordinal','kind','binding','prior']);keys(callData.binding,['continuation']);
  integrity(callData.schema==='sovereign.mission-inference-call.v1'&&callData.missionId===c.missionId
    &&callData.kind==='native-continuation'&&same(callData.binding.continuation,reference(lineage.continuation)),
  'Native continuation proof does not bind its exact global reservation');
  const lease=historicalLease(store,authority,payload.lease,{missionId:c.missionId,principalId:c.runId,
    action:'workspace.read',resource:`workspace:${c.missionId}`,classification:payload.classification,issuedAt:payload.issuedAt});
  integrity(lease.data.dispatch?.operationId===c.operationId&&lease.data.dispatch.tool==='workspace.read'
    &&lease.data.dispatch.argsHash===sha256(lineage.state.call.arguments),
  'Historical native callback lease is not its exact one-shot dispatch permit');
  integrity(same(lease.record.data.signed,c.lease)&&sha256(lease.record.data.signed)===payload.leaseHash,
    'Native continuation proof lease differs from its callback lease');
  const chronology=expectOrder(store,[
    {ref:lineage.parent.actorOrigin,label:'native actor origin'},
    {ref:lineage.parent.record,label:'native parent worker proof'},
    {ref:reference(store.get(NATIVE_SESSION_TYPE,c.runId,1)),label:'native callback session origin'},
    {ref:reference(lineage.session),label:'native callback CALL checkpoint'},
    {ref:reference(lease.record),label:'native callback lease'},
    {ref:reference(lineage.continuation),label:'native continuation'},
    {ref:reference(call),label:'native mission call'}
  ],'Native continuation proof prerequisite');
  // Lease issuance can precede the session, but the callback consumption must
  // always occur after the first bounded worker dispatch and before the proof.
  integrity(committedSequence(store,lineage.parent.record,'native parent worker proof')
    <committedSequence(store,reference(lineage.continuation),'native continuation'),
  'Native continuation predates its parent worker dispatch');
  return {lineage,lease,chronology};
}

function issueNativeContinuationDispatchProof({store,authority},{continuation,call,signedLease,classification,issuedAt}){
  const payload=nativePayload(store,authority,{continuation,call,signedLease,classification,issuedAt});
  const proofId=missionNativeContinuationDispatchProofId(payload.continuation,payload.call);
  integrity(!store.get(MISSION_NATIVE_CONTINUATION_DISPATCH_PROOF_TYPE,proofId),
    'Native continuation proof already exists for this callback');
  return clone(store.put(MISSION_NATIVE_CONTINUATION_DISPATCH_PROOF_TYPE,proofId,
    {signed:authority.seal(MISSION_NATIVE_CONTINUATION_DISPATCH_PROOF_KIND,payload)},{expectedVersion:0}));
}

function signedNativeProof(store,authority,proofReference){
  const proof=readSignedRecord(store,authority,proofReference,{type:MISSION_NATIVE_CONTINUATION_DISPATCH_PROOF_TYPE,
    kind:MISSION_NATIVE_CONTINUATION_DISPATCH_PROOF_KIND,label:'native continuation proof'});
  const lineage=validateNativePayload(store,authority,proof.payload);
  integrity(proof.record.version===1&&proof.record.id===missionNativeContinuationDispatchProofId(proof.payload.continuation,proof.payload.call),
    'Native continuation proof identifier or version is invalid');
  const sequence=committedSequence(store,reference(proof.record),'native continuation proof');
  integrity(committedSequence(store,proof.payload.call,'native mission call')<sequence,
    'Native continuation proof predates its mission-call reservation');
  return {...proof,lineage,sequence};
}

/** Verify that a budgeted native callback has the exact signed parent request,
 * bounded actor, lease and local continuation lineage. */
export function assertMissionNativeContinuationDispatchProvenance(deps,{continuation,call}={}){
  return failClosed(()=>{
    const {store,authority}=dependencies(deps),continuationRef=assertReference(continuation,'native consumer continuation'),callRef=assertReference(call,'native consumer call');
    integrity(continuationRef.type===NATIVE_CONTINUATION_TYPE&&callRef.type===CALL_TYPE,
      'Native reservation references have unexpected types');
    const proof=store.get(MISSION_NATIVE_CONTINUATION_DISPATCH_PROOF_TYPE,missionNativeContinuationDispatchProofId(continuationRef,callRef));
    integrity(proof,'No signed native continuation proof exists for this exact callback');
    const result=signedNativeProof(store,authority,reference(proof));
    integrity(same(result.payload.continuation,continuationRef)&&same(result.payload.call,callRef),
      'Native proof differs from the consumer reservation');
    return clone({record:reference(result.record),continuation:result.payload.continuation,lease:result.payload.lease,
      call:result.payload.call,actorOrigin:result.payload.actorOrigin,sequence:result.sequence,payload:result.payload});
  },'Native continuation reservation lacks trusted dispatch provenance');
}

// Narrow, process-local issuance capability for the two non-worker routes.
// A signed sidecar is valuable only if it is created with the *same material
// transaction* as its irreversible marker and exact reservation.  Checking
// `db.isTransaction` alone cannot establish that: a later transaction could
// otherwise sign a proof for a historic forged/shaped row.  Store's witness
// records freshly written immutable references in the active outer scope; the
// opaque preflight binds that witness to one intended proof and is consumed on
// every success or failure path.
//
// This is intentionally an API-misuse boundary, not a claim that hostile code
// holding Store, Authority and this control object is contained.  Those
// objects remain in the process TCB until signing is moved to a separate
// authority process.
export class MissionExternalDispatchProvenanceControl {
  #store; #authority; #searchPreflights=new WeakMap(); #nativePreflights=new WeakMap();
  constructor(deps){
    const {store,authority}=dependencies(deps);this.#store=store;this.#authority=authority;
  }
  #prepare(kind,record,{signedLease,classification=null,issuedAt}={}){
    const witness=this.#store.transactionWitness();
    const bound=reference(record);
    this.#store.assertCurrentTransactionWrite(witness,bound);
    const token=Object.freeze(Object.create(null));
    const target={witness,record:bound,signedLease:clone(signedLease),issuedAt,
      ...(classification===null?{}:{classification})};
    if(kind==='search')this.#searchPreflights.set(token,target);
    else this.#nativePreflights.set(token,target);
    return token;
  }
  prepareSearch({effectRecord,signedLease,issuedAt}={}){
    return failClosed(()=>{
      const effect=exact(this.#store,reference(effectRecord),{type:EFFECT_TYPE,version:2,label:'fresh search effect'}),d=effect.data;
      integrity(d?.state==='DISPATCHED'&&d.tool==='source.search','Search preflight requires its fresh DISPATCHED effect');
      // Verify live authority at the actual irreversible marker; issueSearch
      // repeats the complete signed payload validation after the call exists.
      const lease=this.#authority.verify(signedLease,{missionId:d.missionId,principalId:d.principalId,action:'source.search',resource:'public-web',classification:'PUBLIC'});
      integrity(lease.dispatch?.operationId===effect.id&&lease.dispatch.tool==='source.search'&&lease.dispatch.argsHash===d.argsHash,
        'Search preflight requires its exact one-shot broker dispatch permit');
      instant(issuedAt,'search preflight issuedAt');
      return this.#prepare('search',effect,{signedLease,issuedAt});
    },'Search dispatch provenance preflight cannot be prepared');
  }
  issueSearch(preflight,{callRecord}={}){
    const binding=this.#searchPreflights.get(preflight);
    try{
      integrity(binding,'Search dispatch provenance preflight is absent, expired or already consumed');
      const call=exact(this.#store,reference(callRecord),{type:CALL_TYPE,version:1,label:'fresh search mission call'});
      this.#store.assertCurrentTransactionWrite(binding.witness,binding.record);
      this.#store.assertCurrentTransactionWrite(binding.witness,reference(call),{after:binding.record});
      return issueSearchDispatchProof({store:this.#store,authority:this.#authority},{effect:binding.record,call:reference(call),
        signedLease:binding.signedLease,issuedAt:binding.issuedAt});
    }catch(error){
      if(error?.code===MISSION_INFERENCE_PROVENANCE_INTEGRITY)throw error;
      integrity(false,'Search dispatch provenance cannot be issued',{cause:safeCode(error)});
    }finally{if(preflight&&typeof preflight==='object')this.#searchPreflights.delete(preflight);}
  }
  prepareNativeContinuation({continuationRecord,signedLease,classification,issuedAt}={}){
    return failClosed(()=>{
      const continuation=exact(this.#store,reference(continuationRecord),{type:NATIVE_CONTINUATION_TYPE,version:1,label:'fresh native continuation'});
      // The lineage check includes its parent worker proof and exact CALL
      // checkpoint.  It is intentionally performed before the local global
      // reservation so an invalid callback cannot consume budget capacity.
      nativeContinuationLineage(this.#store,this.#authority,reference(continuation));
      integrity(CLASSIFICATIONS.includes(classification),'Native preflight classification is unknown');
      instant(issuedAt,'native preflight issuedAt');
      return this.#prepare('native',continuation,{signedLease,classification,issuedAt});
    },'Native continuation provenance preflight cannot be prepared');
  }
  issueNativeContinuation(preflight,{callRecord}={}){
    const binding=this.#nativePreflights.get(preflight);
    try{
      integrity(binding,'Native continuation provenance preflight is absent, expired or already consumed');
      const call=exact(this.#store,reference(callRecord),{type:CALL_TYPE,version:1,label:'fresh native mission call'});
      this.#store.assertCurrentTransactionWrite(binding.witness,binding.record);
      this.#store.assertCurrentTransactionWrite(binding.witness,reference(call),{after:binding.record});
      return issueNativeContinuationDispatchProof({store:this.#store,authority:this.#authority},{continuation:binding.record,call:reference(call),
        signedLease:binding.signedLease,classification:binding.classification,issuedAt:binding.issuedAt});
    }catch(error){
      if(error?.code===MISSION_INFERENCE_PROVENANCE_INTEGRITY)throw error;
      integrity(false,'Native continuation provenance cannot be issued',{cause:safeCode(error)});
    }finally{if(preflight&&typeof preflight==='object')this.#nativePreflights.delete(preflight);}
  }
}

function failClosed(fn,message){
  try{return fn();}catch(error){
    if(error?.code===MISSION_INFERENCE_PROVENANCE_INTEGRITY)throw error;
    integrity(false,message,{cause:safeCode(error)});
  }
}
