// Immutable mission-wide logical-call reservations. Not billed tokens, HTTP
// retry counts, provider availability, completed work or a permission grant.
import {canonical,check,clone,digest,identifier,integer,keys,sha256} from './contracts.mjs';
import {assertMissionInferenceDispatchProvenance} from './mission-inference-provenance.mjs';
import {assertMissionNativeContinuationDispatchProvenance,assertMissionSearchDispatchProvenance} from './mission-external-dispatch-provenance.mjs';
import {assertMissionBlindReplicaReservationBinding,assertMissionBlindReplicaReservationLineage} from './mission-blind-replica-provenance.mjs';

const TYPE='mission-inference-call',SCHEMA='sovereign.mission-inference-call.v1';
const prefixFor=missionId=>'mission-call:'+sha256(missionId)+':';
const ref=r=>({type:r.type,id:r.id,version:r.version,hash:r.hash});
const integrity=(ok,message)=>check(ok,'INFERENCE_BUDGET_INTEGRITY',message);

// Consumers may pass their trusted registry/broker/service envelope rather
// than a naked Store.  Legacy read-only callers without an Authority remain
// able to inspect a mission that has no worker reservations; a worker
// reservation, however, is deliberately unverifiable without the signer that
// validates its provenance receipt.
function dependencies(input){
  const store=input?.store??input,authority=input?.authority??null;
  integrity(store&&typeof store.get==='function'&&typeof store.transact==='function'&&store.db,
    'Mission inference accounting requires a durable Store');
  return {store,authority};
}

export function missionInferenceBudgetPolicy(input){
  const p=clone(input);keys(p,['mode','maxCalls']);
  check(p.mode==='mission-calls-v1','INFERENCE_BUDGET_POLICY','Unknown mission budget mode');
  integer(p.maxCalls,'mission logical-call ceiling',{min:1,max:1000});return p;
}
function policyFor(store,missionId){
  identifier(missionId);const current=store.get('mission',missionId),original=store.get('mission',missionId,1);
  // Standalone registry tests and legacy consumers may have no mission policy.
  if(current?.data.policy?.inferenceBudget===undefined&&original?.data.policy?.inferenceBudget===undefined)return null;
  integrity(current?.data.id===missionId&&original?.data.id===missionId
    &&original.data.policy?.inferenceBudget!==undefined&&current.data.intentHash===sha256(current.data.intent)
    &&current.data.intent===original.data.intent&&current.data.intentHash===original.data.intentHash
    &&canonical(current.data.policy)===canonical(original.data.policy),
  'Mission budget must be selected at creation; original mandate and policy cannot be replaced or removed');
  return {mission:current.data,origin:ref(original),policy:missionInferenceBudgetPolicy(original.data.policy.inferenceBudget)};
}
function boundRecord(store,r,{latest=false,projection=false}={}){
  keys(r,['type','id','version','hash']);identifier(r.type);identifier(r.id);integer(r.version,'bound version',{min:1});digest(r.hash);
  // Counting a reservation must not deserialize every historical multi-MB
  // prompt or run exposure again. For already committed reservations compare
  // indexed immutable record identities and the small binding fields only.
  // Complete content hashes are verified by their owning consumers/Store audit,
  // not claimed by this accounting projection. New reservations use full get().
  if(projection){
    const row=store.db.prepare(`SELECT r.type,r.id,r.version,r.hash,
      json_extract(r.json,'$.id') AS dataId,json_extract(r.json,'$.missionId') AS missionId,
      json_extract(r.json,'$.mode') AS mode,json_extract(r.json,'$.expectedRequestHash') AS expectedRequestHash,
      json_extract(r.json,'$.runId') AS runId,json_extract(r.json,'$.retention') AS retention,
      json_extract(r.json,'$.requestHash') AS requestHash,json_extract(r.json,'$.tool') AS tool,
      json_extract(r.json,'$.state') AS state,json_extract(r.json,'$.principalId') AS principalId,
      json_extract(r.json,'$.argsHash') AS argsHash
      FROM records r ${latest?'JOIN heads h USING(type,id,version)':''}
      WHERE r.type=? AND r.id=? ${latest?'':'AND r.version=?'}`).get(r.type,r.id,...(latest?[]:[r.version]));
    integrity(row&&canonical({type:row.type,id:row.id,version:row.version,hash:row.hash})===canonical(r),
      'Budget reservation references a missing or changed record');
    return {...r,data:{...row,id:row.dataId}};
  }
  const actual=store.get(r.type,r.id,latest?null:r.version);
  integrity(actual&&canonical(ref(actual))===canonical(r),'Budget reservation references a missing or changed record');return actual;
}
function validateBinding(deps,missionId,kind,binding,{projection=false,call=null,requireWorkerProvenance=false,requireExternalProvenance=false,requireBlindProvenance=false}={}){
  const {store,authority}=deps;
  if(kind==='native-continuation'){
    keys(binding,['continuation']);
    const c=boundRecord(store,binding.continuation,{latest:true}),d=c.data,
      mission=store.get('mission',missionId,1),session=boundRecord(store,d.session),request=boundRecord(store,d.request,{latest:true});
    const t=session.data.transcript,callback=t?.frames?.at(-1)?.event;
    integrity(c.type==='native-read-continuation'&&c.version===1&&d.schema==='sovereign.native-read-continuation.v1'
      &&d.missionId===missionId&&c.id===d.runId&&d.operationId===d.runId+':native-read:0'
      &&mission?.data.policy.nativeReadTransport==='native-read-v1'&&mission.data.policy.entryMode==='bounded-read-response-v1'
      // Protocol 12 adds learning-provenance custody; it does not change the
      // native continuation's original call accounting or callback binding.
      &&[8,9,10,11,12,13,14,15,16,17].includes(store.db.prepare('PRAGMA user_version').get().user_version)
      &&session.type==='native-read-session'&&session.id===d.runId&&session.version===3
      &&session.data.missionId===missionId&&session.data.requestHash===d.requestHash
      &&t?.header?.requestHash===d.requestHash&&callback?.kind==='CALL'&&d.callHash===sha256(callback)
      &&request.type==='inference-request'&&request.version===1&&request.data.runId===d.runId
      &&request.data.missionId===missionId&&request.data.requestHash===d.requestHash&&request.data.retention==='BEFORE_DISPATCH'
      &&canonical(d.charges)===canonical({proposalSteps:1,brokerOperations:1}),
      'Native continuation must bind its original selected policy, pending callback and prospective request');
    if(requireExternalProvenance){
      integrity(call&&call.type===TYPE&&call.version===1,'Native continuation has no immutable mission-call record');
      integrity(authority&&typeof authority.open==='function'&&typeof authority.seal==='function',
        'Native continuation provenance requires the mission signing authority');
      assertMissionNativeContinuationDispatchProvenance({store,authority},{continuation:ref(c),call:ref(call)});
    }
    return 'native-continuation:'+c.id;
  }
  if(kind==='blind-replica'){
    keys(binding,['registration','frozen','run','request','requestHash']);digest(binding.requestHash);
    integrity(authority&&typeof authority.open==='function'&&typeof authority.seal==='function',
      'Blind replica reservation provenance requires the mission signing authority');
    const base=assertMissionBlindReplicaReservationBinding({store,authority},{...binding});
    integrity(base.missionId===missionId,'Blind replica reservation belongs to another mission');
    if(requireBlindProvenance){
      integrity(call&&call.type===TYPE&&call.version===1,'Blind replica reservation has no immutable mission-call record');
      assertMissionBlindReplicaReservationLineage({store,authority},{...binding,call:ref(call),requireDispatchProof:true});
    }
    return 'blind-replica:'+sha256([base.replicationId,base.requestHash]);
  }
  if(kind==='worker'){
    keys(binding,['run','request','requestHash']);digest(binding.requestHash);
    const run=boundRecord(store,binding.run,{projection}),request=boundRecord(store,binding.request,{latest:true,projection});
    integrity(run.type==='run'&&run.data.missionId===missionId&&run.data.id===run.id
      &&['producer','reviewer'].includes(run.data.mode)&&run.data.expectedRequestHash===binding.requestHash
      &&request.type==='inference-request'&&request.version===1
      &&request.id==='inference-request:'+sha256([run.id,binding.requestHash])
      &&request.data.runId===run.id&&request.data.missionId===missionId&&request.data.retention==='BEFORE_DISPATCH'
      &&request.data.requestHash===binding.requestHash,'Worker reservation is not its exact prospective request and pending actor');
    if(requireWorkerProvenance){
      integrity(call&&call.type===TYPE&&call.version===1,'Worker reservation has no immutable mission-call record');
      integrity(authority&&typeof authority.open==='function'&&typeof authority.seal==='function',
        'Worker reservation provenance requires the mission signing authority');
      assertMissionInferenceDispatchProvenance({store,authority},{run:ref(run),request:ref(request),call:ref(call)});
    }
    return 'worker:'+sha256([run.id,binding.requestHash]);
  }
  integrity(kind==='search','Unknown budget reservation kind');keys(binding,['effect']);
  const effect=boundRecord(store,binding.effect,{projection}),latest=store.db.prepare(
    "SELECT json_extract(r.json,'$.missionId') AS missionId,json_extract(r.json,'$.principalId') AS principalId,json_extract(r.json,'$.tool') AS tool,json_extract(r.json,'$.argsHash') AS argsHash FROM records r JOIN heads h USING(type,id,version) WHERE r.type='effect' AND r.id=?").get(effect.id);
  integrity(effect.type==='effect'&&effect.data.missionId===missionId&&effect.data.tool==='source.search'
    &&effect.data.state==='DISPATCHED'&&latest
    &&['missionId','principalId','tool','argsHash'].every(k=>latest[k]===effect.data[k]),
  'Search reservation is not the exact dispatched mission discovery attempt');
  if(requireExternalProvenance){
    integrity(call&&call.type===TYPE&&call.version===1,'Search reservation has no immutable mission-call record');
    integrity(authority&&typeof authority.open==='function'&&typeof authority.seal==='function',
      'Search reservation provenance requires the mission signing authority');
    assertMissionSearchDispatchProvenance({store,authority},{effect:ref(effect),call:ref(call)});
  }
  return 'search:'+effect.id;
}
function budgetSnapshot(deps,missionId){
  const {store}=deps;
  const frozen=policyFor(store,missionId);if(!frozen)return null;
  const {mission,origin,policy}=frozen,prefix=prefixFor(missionId);
  const heads=store.db.prepare('SELECT id FROM heads WHERE type=? AND id>=? AND id<? ORDER BY id').all(TYPE,prefix,prefix+'\uffff');
  const count=store.db.prepare('SELECT count(*) AS n FROM records WHERE type=? AND id>=? AND id<?').get(TYPE,prefix,prefix+'\uffff').n;
  integrity(count===heads.length&&count<=policy.maxCalls,'Hidden, reversioned or excessive mission call reservations');
  const calls=heads.map(({id})=>store.get(TYPE,id)).sort((a,b)=>a.data.ordinal-b.data.ordinal),seen=new Set(),byKind={worker:0,search:0,
    ...(mission.policy.nativeReadTransport==='native-read-v1'?{'native-continuation':0}:{})};
  for(const [index,r]of calls.entries()){
    const d=r.data;keys(d,['schema','missionId','origin','ordinal','kind','binding','prior']);
    integrity(r.version===1&&d.schema===SCHEMA&&d.missionId===missionId&&d.ordinal===index+1
      &&r.id===prefix+(index+1)&&canonical(d.origin)===canonical(origin)
      &&canonical(d.prior)===canonical(index?ref(calls[index-1]):null),'Mission call reservation chain or frozen origin changed');
    const key=validateBinding(deps,missionId,d.kind,d.binding,{projection:true,call:r,requireWorkerProvenance:d.kind==='worker',
      requireExternalProvenance:d.kind==='search'||d.kind==='native-continuation',requireBlindProvenance:d.kind==='blind-replica'});
    integrity(!seen.has(key),'One logical attempt cannot be reserved twice');seen.add(key);
    if(!Object.hasOwn(byKind,d.kind))byKind[d.kind]=0;byKind[d.kind]++;
  }
  return {...frozen,calls,seen,view:{schema:'sovereign.mission-inference-budget.v1',missionId,
    mode:policy.mode,maxCalls:policy.maxCalls,reserved:calls.length,remaining:policy.maxCalls-calls.length,byKind,
    lastReservation:calls.length?ref(calls.at(-1)):null,
    scope:'Conservative logical-call reservations across this mission: workers including judges, closed blind replicas with their own signed closed-dispatch protocol, plus model-backed discovery attempts. Not actual dispatch/completion, billed tokens, internal transport retries or native search-tool counts. Failed, interrupted and pre-dispatch-crash reservations are never refunded. Remaining capacity is not reserved for future stages; preserve all requirements and independent review.'
      +(mission.policy.nativeReadTransport==='native-read-v1'?' Native bounded reading additionally reserves one continuation before its callback effect, including failures; it is not a free second model response.':'')}};
}
export function missionInferenceBudget(input,missionId){
  const deps=dependencies(input),{store}=deps;
  const own=!store.db.isTransaction;if(own)store.db.exec('BEGIN');
  try{return budgetSnapshot(deps,missionId)?.view??null;}
  finally{if(own&&store.db.isTransaction)store.db.exec('ROLLBACK');}
}
// Caller records the exact pending request or DISPATCHED effect in this SAME
// outer transaction. A failed reservation rolls that transition back. No I/O or
// provider call may occur before the enclosing commit returns.
export function reserveMissionInference(source,input){
  const deps=dependencies(source),{store}=deps;
  const captured=clone(input);keys(captured,['missionId','kind','binding']);const {missionId,kind,binding}=captured;
  return store.transact(()=>{
    const b=budgetSnapshot(deps,missionId);if(!b)return null;
    // The just-created worker call cannot prove itself until its immutable
    // call row exists.  ArtifactRegistry issues that sidecar in this same
    // outer transaction immediately after this function returns; every later
    // reader, completion and subsequent reservation requires it.  A direct
    // raw reservation therefore fails closed on its next observation rather
    // than becoming valid by row shape alone.
    const key=validateBinding(deps,missionId,kind,binding);
    check(!b.seen.has(key),'INFERENCE_PENDING','Existing logical attempt must be reconciled, not dispatched again');
    check(b.calls.length<b.policy.maxCalls,'INFERENCE_BUDGET_EXHAUSTED',
      'Frozen mission-wide call ceiling exhausted; preserve pending obligations, without automatic extension or a quality downgrade');
    const ordinal=b.calls.length+1;
    return store.put(TYPE,prefixFor(missionId)+ordinal,{schema:SCHEMA,missionId,origin:b.origin,ordinal,kind,binding:clone(binding),
      prior:b.calls.length?ref(b.calls.at(-1)):null},{expectedVersion:0});
  });
}
// Called inside the receipt-attachment transaction. A completed receipt cannot
// be used as a back door to manufacture an unreserved budgeted inference.
export function assertMissionInferenceReserved(source,run,receipt){
  const deps=dependencies(source),b=budgetSnapshot(deps,run.missionId);if(!b)return;
  const kind=run.mode==='replicator'?'blind-replica':'worker';
  integrity(typeof run.expectedRequestHash==='string'&&receipt.contextHash===run.expectedRequestHash
    &&b.calls.some(c=>c.data.kind===kind&&c.data.binding.run.id===run.id
      &&c.data.binding.requestHash===run.expectedRequestHash),'Budgeted completion has no exact pending prospective reservation');
}
export const missionBudgetRecordRef=ref;
