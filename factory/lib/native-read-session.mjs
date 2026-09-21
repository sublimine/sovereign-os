// Trusted, durable controller for one native callback. The provider never
// receives Store, Authority, leases or the broker. No restart/replay API.
import {canonical,check,clone,integer,keys,sha256} from './contracts.mjs';
import {assertBoundedReadExposure,assertBoundedReadOperation} from './bounded-read-contract.mjs';
import {BOUNDED_READ_MODE,BOUNDED_READ_NODE,BOUNDED_READ_LIMITS} from './bounded-read-spec.mjs';
import {NATIVE_READ_PROFILE,NATIVE_READ_TOOL_BINDING} from '../providers/native-read-policy.mjs';
import {instructionProfile,inferenceRequestHash} from '../providers/instruction-profiles.mjs';
import {createNativeReadTranscript,appendNativeReadFrame,inspectNativeReadTranscript} from '../providers/native-read-transcript.mjs';
import {reserveMissionInference,missionInferenceBudget} from './mission-inference-budget.mjs';
import {assertMissionNativeContinuationDispatchProvenance,MissionExternalDispatchProvenanceControl} from './mission-external-dispatch-provenance.mjs';

const TYPE='native-read-session',SCHEMA='sovereign.native-read-session.v1';
const CONTINUATION='native-read-continuation';
const ref=r=>({type:r.type,id:r.id,version:r.version,hash:r.hash});
const integrity=(ok,message)=>check(ok,'NATIVE_READ_INTEGRITY',message);
const cancelled=signal=>check(!signal?.aborted,'CANCELLED','Native callback cancelled; retained consumption is not refunded');
export const nativeReadActor=(store,run)=>Boolean(run?.mode==='producer'&&run.nodeId===BOUNDED_READ_NODE
  &&store.get('mission',run.missionId)?.data.policy?.nativeReadTransport===NATIVE_READ_PROFILE);

function exact(store,r,{latest=false}={}){
  keys(r,['type','id','version','hash']);const actual=store.get(r.type,r.id,latest?null:r.version);
  integrity(actual&&canonical(ref(actual))===canonical(r),'Native controller reference changed or is missing');return actual;
}
function originBinding(registry,runId,requestHash){
  const store=registry.store,run=store.get('run',runId),mission=run&&store.get('mission',run.data.missionId,1),
    config=store.get('worker-config',runId),producer=store.get('worker-production',runId,1),
    request=store.get('inference-request','inference-request:'+sha256([runId,requestHash]));
  // Protocol 12 adds learning-provenance custody; native-read remains excluded
  // from overlays and is still checked against its original callback contract.
  integrity(nativeReadActor(store,run?.data)&&mission?.data.policy.nativeReadTransport===NATIVE_READ_PROFILE
    &&mission.data.policy.entryMode===BOUNDED_READ_MODE&&[8,9,10,11,12,13,14,15,16,17].includes(store.db.prepare('PRAGMA user_version').get().user_version),
    'Native transport needs its original bounded policy and supported execution floor');
  const binding=assertBoundedReadExposure(store,run.data);
  integrity(run.data.expectedRequestHash===requestHash&&!run.data.inferenceReceipt&&run.data.requests?.length===1
    &&!(run.data.toolObservations?.length)&&config?.version===1&&config.data.learnedInstructionVersions.length===0
    &&config.data.compilationScope.nativeReadTransport===NATIVE_READ_PROFILE
    &&config.data.prefixHash===sha256(config.data.instructions)
    &&producer?.data.nativeReadTransport===NATIVE_READ_PROFILE&&producer.data.toolAccounting===undefined
    &&producer.data.contractHash===sha256({missionId:mission.id,node:binding.node,inputRefs:[]})
    &&producer.data.responseRetention==='producer-response-v1'&&producer.data.cleanupProtocol==='producer-cleanup-v1',
    'Native actor must retain its original fresh production, request, full charter and isolated scope');
  const limits=clone(producer.data.executionLimits);keys(limits,['maxSteps','maxToolOperations','maxBatchOperations']);
  integer(limits.maxSteps,'native proposal cap',{min:1,max:100000});integer(limits.maxToolOperations,'native operation cap',{min:1,max:100});
  integer(limits.maxBatchOperations,'inherited batch cap',{min:1,max:8});
  let q;try{q=JSON.parse(request.data.requestJson);}catch{}
  integrity(request?.version===1&&request.data.retention==='BEFORE_DISPATCH'&&request.data.runId===runId
    &&request.data.missionId===mission.id&&request.data.requestHash===requestHash&&q
    &&q.instructionProfile===NATIVE_READ_PROFILE&&inferenceRequestHash(q)===requestHash
    &&q.instructions.startsWith(config.data.instructions),'Native request was not retained prospectively under its exact profile');
  return {mission:ref(mission),run:ref(run),config:ref(config),producer:ref(producer),request:ref(request),limits};
}
function sessionRecord(registry,runId,{pending=true}={}){
  const s=registry.store,r=s.get(TYPE,runId),origin=s.get(TYPE,runId,1);
  integrity(r&&origin,'Native session is missing');const d=r.data;
  keys(d,['schema','missionId','runId','requestHash','binding','transcript']);
  integrity(d.schema===SCHEMA&&d.runId===runId&&canonical({...d,transcript:null})===canonical({...origin.data,transcript:null})
    &&origin.data.transcript.frames.length===0,'Native session origin changed');
  const state=inspectNativeReadTranscript(d.transcript,d.transcript.head);
  integrity(r.version===state.frames+1&&s.db.prepare('SELECT count(*) AS n FROM records WHERE type=? AND id=?').get(TYPE,runId).n===r.version,
    'Native session history is incomplete or its head was rewound');
  for(let v=1;v<=r.version;v++){
    const prior=s.get(TYPE,runId,v);
    integrity(canonical({...prior.data,transcript:null})===canonical({...d,transcript:null})
      &&canonical(prior.data.transcript.header)===canonical(d.transcript.header)
      &&canonical(prior.data.transcript.frames)===canonical(d.transcript.frames.slice(0,v-1)),
      'Native checkpoint does not extend its exact committed history');
    inspectNativeReadTranscript(prior.data.transcript,prior.data.transcript.head);
  }
  if(pending)integrity(canonical(originBinding(registry,runId,d.requestHash))===canonical(d.binding),'Native pending actor or original configuration changed');
  else{
    for(const [key,latest] of [['mission',false],['run',false],['config',true],['producer',false],['request',true]])exact(s,d.binding[key],{latest});
    const run=s.get('run',runId)?.data;assertBoundedReadExposure(s,run);
    integrity(nativeReadActor(s,run),'Native completion cannot borrow another actor');
  }
  integrity(d.missionId===d.binding.mission.id&&d.transcript.header.actorId===runId
    &&d.transcript.header.requestHash===d.requestHash&&canonical(d.transcript.header.tool)===canonical(NATIVE_READ_TOOL_BINDING),
    'Transcript identity or tool binding changed');
  return {record:r,state};
}
// Read-only canonical verifier for consumers that need to prove an immutable
// historical callback checkpoint while the live session may already have
// advanced.  It deliberately exposes no mutator or authority capability.
export function readNativeReadSession(registry,runId,{pending=true}={}){
  return sessionRecord(registry,runId,{pending});
}
function continuationRecord(registry,session){
  const s=registry.store,d=session.record.data,state=session.state,r=s.get(CONTINUATION,d.runId);
  if(!state.call){integrity(!r,'Continuation cannot precede a callback');return null;}
  integrity(r?.version===1,'Callback needs its immutable local continuation charge');const c=r.data;
  keys(c,['schema','missionId','runId','requestHash','session','request','operationId','callHash','charges','lease']);
  const called=exact(s,c.session),calledState=inspectNativeReadTranscript(called.data.transcript,called.data.transcript.head);
  integrity(c.schema==='sovereign.native-read-continuation.v1'&&c.missionId===d.missionId&&c.runId===d.runId
    &&c.requestHash===d.requestHash&&canonical(c.request)===canonical(d.binding.request)
    &&called.type===TYPE&&called.id===d.runId&&calledState.phase==='CALLED'
    &&canonical(calledState.call)===canonical(state.call)&&c.callHash===sha256(state.call)
    &&c.operationId===d.runId+':native-read:0'&&canonical(c.charges)===canonical({proposalSteps:1,brokerOperations:1})
    &&d.binding.limits.maxSteps>=2&&d.binding.limits.maxToolOperations>=1,
    'Native local consumption is not bound to the exact callback and original limits');
  const all=s.list(CONTINUATION).filter(x=>x.data.missionId===d.missionId);
  integrity(all.length===1&&all[0].id===r.id,'Bounded native continuation cannot be refunded by another actor');
  const b=missionInferenceBudget(registry,d.missionId);
  if(b)integrity(s.list('mission-inference-call').some(x=>x.data.missionId===d.missionId&&x.data.kind==='native-continuation'
    &&canonical(x.data.binding.continuation)===canonical(ref(r))),'Native continuation has no global call reservation');
  return r;
}
function preparedObservation(registry,session){
  const {record,state}=session,d=record.data,c=continuationRecord(registry,session);
  if(!state.prepared)return null;
  integrity(c&&canonical(state.prepared.continuationRef)===canonical(ref(c)),'Prepared response references another consumption record');
  const effect=exact(registry.store,state.prepared.effectRef,{latest:true}),signed=effect.data.receipt,
    receipt=registry.verifiedToolReceipt(signed);
  integrity(effect.type==='effect'&&effect.id===c.data.operationId&&receipt.principalId===d.runId
    &&receipt.missionId===d.missionId&&receipt.tool==='workspace.read'&&receipt.argsHash===sha256(state.call.arguments),
    'Native result is not its exact signed broker operation');
  if(receipt.status==='SUCCEEDED'){
    integrity(receipt.result.path===state.call.arguments.path&&typeof receipt.result.content==='string'
      &&receipt.result.content.isWellFormed()&&sha256(receipt.result.content)===receipt.result.sha256,
      'Native input must preserve the exact requested path and complete UTF8 bytes');
    check(Buffer.byteLength(receipt.result.content)<=BOUNDED_READ_LIMITS.maxInputBytes,'BOUNDED_READ_SCOPE','Native input exceeds bound; never truncate');
  }
  integrity(state.prepared.responseJson===nativeResponse(receipt,signed),'Native tool output differs from the actual committed receipt');
  return {id:receipt.id,hash:sha256(signed),principalId:receipt.principalId,relation:'OWN_ACTION',signedReceipt:clone(signed),
    resultText:canonical(receipt.result),observedAt:record.createdAt};
}
function nativeResponse(receipt,signed){return canonical({success:receipt.status==='SUCCEEDED',contentItems:[{type:'inputText',
  text:canonical({operationId:receipt.id,receiptHash:sha256(signed),tool:receipt.tool,status:receipt.status,result:receipt.result})}]});}

export class NativeReadSession {
  #version; #preparing=false; #signal; #externalDispatchProvenance;
  constructor({registry,broker,lease,commitOutcome,runId,requestHash,maxFinalBytes}){
    check(typeof lease==='function','CONFIG','Native callback needs trusted lease issuance');
    check(typeof commitOutcome==='function'&&Object.prototype.toString.call(commitOutcome)!=='[object AsyncFunction]',
      'CONFIG','Native public outcome needs a synchronous trusted retention commit');
    integer(maxFinalBytes,'native final bytes',{min:1,max:256*1024});
    check(registry.store===broker.store&&registry.authority===broker.authority,'CONFIG',
      'Native callback registry and broker must share one trusted authority and store');
    Object.assign(this,{registry,broker,lease,commitOutcome,runId});
    this.#externalDispatchProvenance=new MissionExternalDispatchProvenanceControl({store:registry.store,authority:broker.authority});
    const r=registry.store.transact(()=>{
      check(!registry.store.get(TYPE,runId),'NATIVE_READ_RECONCILE','Existing native session must be reconciled, never opened as a new turn');
      const binding=originBinding(registry,runId,requestHash);
      return registry.store.put(TYPE,runId,{schema:SCHEMA,missionId:binding.mission.id,runId,requestHash,binding,
        transcript:createNativeReadTranscript({actorId:runId,requestHash,tool:NATIVE_READ_TOOL_BINDING,
          limits:{maxCalls:1,maxResultBytes:1024*1024,maxFinalBytes}})},{expectedVersion:0});
    });this.#version=r.version;
  }
  #read(){const value=sessionRecord(this.registry,this.runId);integrity(value.record.version===this.#version,'Native session is owned by another checkpoint writer');return value;}
  #commit(fn){const version=this.#version;try{return this.registry.store.transact(fn);}catch(error){this.#version=version;throw error;}}
  checkpoint(){return clone(this.#read().record.data.transcript);}
  #append(kind,payload){
    const current=this.#read(),t=current.record.data.transcript,next=appendNativeReadFrame(t,{kind,...clone(payload)},t.head),
      r=this.registry.store.put(TYPE,this.runId,{...current.record.data,transcript:next},{expectedVersion:this.#version});
    this.#version=r.version;return clone(next);
  }
  bind(payload){return this.#commit(()=>this.#append('BIND',payload));}
  async prepare({signal,...payload}){
    check(signal===undefined||signal instanceof AbortSignal,'SCHEMA','Native cancellation must be a trusted AbortSignal');
    check(!this.#preparing,'NATIVE_READ_RECONCILE','Native callback is already being prepared');this.#preparing=true;
    try{
      cancelled(signal);let reservation;
      // CALL and consumption share the transaction. No asynchronous broker
      // operation can escape a failed reservation or a local step limit.
      const savedVersion=this.#version;
      try{reservation=this.registry.store.transact(()=>{
        const before=this.#read();
        check(before.record.data.binding.limits.maxSteps>=2,'WORKER_LIMIT','Native callback and final exceed original proposal-step cap');
        assertBoundedReadOperation(this.registry.store,this.registry.store.get('run',this.runId).data,'workspace.read');
        check(!this.registry.store.list(CONTINUATION).some(r=>r.data.missionId===before.record.data.missionId),
          'BOUNDED_READ_SCOPE','One native producer read intent was already consumed');
        this.#append('CALL',payload);
        const called=this.#read(),operationId=this.runId+':native-read:0',signedLease=this.lease(this.runId,'workspace.read',operationId,payload.arguments);
        const c=this.registry.store.put(CONTINUATION,this.runId,{schema:'sovereign.native-read-continuation.v1',
          missionId:called.record.data.missionId,runId:this.runId,requestHash:called.record.data.requestHash,
          session:ref(called.record),request:called.record.data.binding.request,operationId,callHash:sha256(called.state.call),
          charges:{proposalSteps:1,brokerOperations:1},lease:clone(signedLease)},{expectedVersion:0});
        if(missionInferenceBudget(this.registry,c.data.missionId)){
          const continuation=ref(c);
          // The reservation must exist before its signed proof can bind its
          // exact immutable identity.  Both writes remain in this outer
          // callback transaction; a proof failure rolls the CALL frame,
          // continuation and reservation back together.
          const preflight=this.#externalDispatchProvenance.prepareNativeContinuation({continuationRecord:c,signedLease,
            classification:this.broker.workspaceClassification,issuedAt:this.registry.store.clock()});
          const call=reserveMissionInference(this.registry,{missionId:c.data.missionId,kind:'native-continuation',binding:{continuation}});
          check(call,'INFERENCE_PROVENANCE_CONTROL','A budgeted native callback must create one exact mission reservation');
          const callRef=ref(call);
          this.#externalDispatchProvenance.issueNativeContinuation(preflight,{callRecord:call});
          assertMissionNativeContinuationDispatchProvenance({store:this.registry.store,authority:this.broker.authority},{continuation,call:callRef});
        }
        return c;
      });}catch(error){this.#version=savedVersion;throw error;}
      this.#signal=signal;cancelled(signal);
      const c=reservation.data,signed=await this.broker.execute({missionId:c.missionId,principalId:this.runId,lease:c.lease,
        operationId:c.operationId,tool:'workspace.read',args:clone(payload.arguments),...(signal?{signal}:{})});
      cancelled(signal);
      const receipt=this.registry.verifiedToolReceipt(signed),effect=this.registry.store.get('effect',c.operationId);
      return this.#commit(()=>{
        const current=this.#read();continuationRecord(this.registry,current);this.#authorize(reservation);
        const result=this.#append('PREPARED',{callId:payload.callId,effectRef:ref(effect),continuationRef:ref(reservation),responseJson:nativeResponse(receipt,signed)});
        preparedObservation(this.registry,this.#read());return result;
      });
    }finally{this.#preparing=false;}
  }
  #authorize(c){this.broker.authority.verify(c.data.lease,{missionId:c.data.missionId,principalId:this.runId,
    action:'workspace.read',resource:'workspace:'+c.data.missionId,classification:this.broker.workspaceClassification});}
  dispatch(payload){return this.#commit(()=>{
    cancelled(this.#signal);
    const current=this.#read(),c=continuationRecord(this.registry,current);preparedObservation(this.registry,current);this.#authorize(c);
    return this.#append('DISPATCH_INTENT',payload);
  });}
  ack(payload){return this.#commit(()=>{preparedObservation(this.registry,this.#read());return this.#append('ACK',payload);});}
  finish(payload){return this.#commit(()=>{preparedObservation(this.registry,this.#read());return this.#append('FINISH',payload);});}
  retainOutcome(input){return this.#commit(()=>{
    const captured=clone(input);keys(captured,['value','receipt']);
    nativeReadCompletion(this.registry,this.registry.store.get('run',this.runId).data,captured.receipt,{value:captured.value});
    const committed=this.commitOutcome(clone(captured));
    if(committed?.then)Promise.resolve(committed).catch(()=>{});
    check(!committed?.then,'ASYNC_TRANSACTION','Public native outcome must commit synchronously');
    const p=this.registry.store.get('worker-proposal',this.runId+':proposal:0');
    integrity(p?.version===1&&p.data.requestHash===captured.receipt.contextHash&&canonical(p.data.value)===canonical(captured.value)
      &&p.data.inferenceReceiptHash===sha256(captured.receipt),'Native public outcome was not retained as its actual producer proposal');
    return {valueHash:sha256(captured.value),receiptHash:sha256(captured.receipt)};
  });}
}

// Only ArtifactRegistry's atomic completion path may merge these observations
// into a pending run. Ordinary recordToolObservation retains INFERENCE_PENDING.
export function nativeReadCompletion(registry,run,receipt,{value}={}){
  const session=sessionRecord(registry,run.id),{state,record}=session;
  integrity(state.phase==='COMPLETED'&&receipt.toolPolicy===NATIVE_READ_PROFILE
    &&receipt.contextHash===record.data.requestHash&&receipt.threadId===state.binding.threadId&&receipt.turnId===state.binding.turnId
    &&canonical(receipt.nativeTranscript)===canonical({schema:record.data.transcript.schema,head:state.head,callbackCount:state.callbackCount})
    &&canonical(receipt.instructionProfile)===canonical({id:NATIVE_READ_PROFILE,hash:instructionProfile(NATIVE_READ_PROFILE).hash}),
    'Completed inference is not the exact persisted native transcript and profile');
  if(value!==undefined)integrity(canonical(value)===state.completion.outputJson,'Retained public proposal differs from native FINISH');
  const observation=preparedObservation(registry,session);
  integrity(!observation||state.acknowledged,'Native observation was not acknowledged by the provider');
  return observation?[observation]:[];
}
export function nativeReadRecovery(registry,runId){
  const s=registry.store,own=!s.db.isTransaction;if(own)s.db.exec('BEGIN');
  try{const session=sessionRecord(registry,runId,{pending:false});preparedObservation(registry,session);
    return {...clone(session.state),record:ref(session.record),scope:'Durable lifecycle/consumption only; not authorization to resend or create a replacement inference.'};
  }finally{if(own&&s.db.isTransaction)s.db.exec('ROLLBACK');}
}
