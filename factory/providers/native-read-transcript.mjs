// Lifecycle and exact bytes only. NOT permission, persistence or provider proof.
// Not yet connected to WorkerService. Callers must persist/CAS each returned head
// before the corresponding I/O and independently verify external references.
import {canonical,check,clone,digest,identifier,integer,keys,object,sha256,string} from '../lib/contracts.mjs';

const SCHEMA='sovereign.native-read-transcript.v1';
const freeze=value=>{if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value;};
const requireState=(condition,message)=>check(condition,'NATIVE_TRANSCRIPT',message);
function text(value,label,max){string(value,label,{max});requireState(value.isWellFormed(),'Text must preserve exact UTF8');return value;}
function recordRef(value,type){keys(value,['type','id','version','hash']);requireState(value.type===type,'Unexpected external record reference');identifier(value.id);integer(value.version,'record version',{min:1});digest(value.hash);}
function header(input){
  const h=clone(input);keys(h,['actorId','requestHash','tool','limits']);identifier(h.actorId);digest(h.requestHash);
  keys(h.tool,['namespace','name','schemaHash']);identifier(h.tool.namespace);identifier(h.tool.name);digest(h.tool.schemaHash);
  keys(h.limits,['maxCalls','maxResultBytes','maxFinalBytes']);requireState(h.limits.maxCalls===1,'Native read transcript permits one callback only');
  integer(h.limits.maxResultBytes,'result bytes',{min:1,max:1024*1024});integer(h.limits.maxFinalBytes,'final bytes',{min:1,max:256*1024});return h;
}
function responseJson(value,max){
  text(value,'exact response JSON',max);let response;
  try{response=JSON.parse(value);}catch{requireState(false,'Invalid response JSON');}
  keys(response,['success','contentItems']);requireState(typeof response.success==='boolean','Response success must be explicit');
  requireState(Array.isArray(response.contentItems)&&response.contentItems.length===1,'One text result is required');
  const item=response.contentItems[0];keys(item,['type','text']);requireState(item.type==='inputText','Only text tool output is supported');
  // Empty tool-result text is valid; never use character count as byte count.
  requireState(typeof item.text==='string'&&item.text.isWellFormed(),'Malformed tool-result Unicode');
  requireState(canonical(response)===value,'Response JSON must have the exact canonical wire representation');
  return value;
}
function transition(state,event,h){
  requireState(!['COMPLETED','ABORTED'].includes(state.phase),'Transcript is terminal');
  object(event,'transcript event');
  const kind=event.kind;
  if(kind==='BIND'){
    keys(event,['kind','threadId','turnId']);requireState(state.phase==='CREATED','Provider binding cannot change');
    text(event.threadId,'thread id',256);text(event.turnId,'turn id',256);
    return {...state,phase:'BOUND',binding:{threadId:event.threadId,turnId:event.turnId}};
  }
  if(kind==='CALL'){
    keys(event,['kind','threadId','turnId','callId','namespace','tool','arguments']);
    requireState(state.phase==='BOUND','Callback is repeated or out of order');
    requireState(event.threadId===state.binding.threadId&&event.turnId===state.binding.turnId,'Foreign provider callback');
    requireState(event.namespace===h.tool.namespace&&event.tool===h.tool.name,'Unexpected callback tool');
    text(event.callId,'call id',256);keys(event.arguments,['path']);text(event.arguments.path,'input path',4096);
    const parts=event.arguments.path.split('/');requireState(!parts.some(p=>['','.','..'].includes(p))&&!event.arguments.path.includes('\\'),'Input path must be a normalized relative path');
    return {...state,phase:'CALLED',call:clone(event)};
  }
  if(kind==='PREPARED'){
    keys(event,['kind','callId','effectRef','continuationRef','responseJson']);
    requireState(state.phase==='CALLED'&&event.callId===state.call.callId,'Preparation must match the single callback');
    recordRef(event.effectRef,'effect');recordRef(event.continuationRef,'native-read-continuation');
    responseJson(event.responseJson,h.limits.maxResultBytes);
    return {...state,phase:'PREPARED',prepared:{...clone(event),responseHash:sha256(event.responseJson)}};
  }
  if(kind==='DISPATCH_INTENT'){
    keys(event,['kind','callId','responseHash']);digest(event.responseHash);
    requireState(state.phase==='PREPARED'&&event.callId===state.call.callId&&event.responseHash===state.prepared.responseHash,'Dispatch differs from the prepared response or is repeated');
    return {...state,phase:'DISPATCH_INTENT',dispatchIntended:true};
  }
  if(kind==='ACK'){
    keys(event,['kind','threadId','turnId','callId','responseJson']);
    requireState(state.phase==='DISPATCH_INTENT','Acknowledgement requires an unacknowledged dispatch intent');
    requireState(event.threadId===state.binding.threadId&&event.turnId===state.binding.turnId&&event.callId===state.call.callId,'Foreign callback acknowledgement');
    responseJson(event.responseJson,h.limits.maxResultBytes);
    requireState(event.responseJson===state.prepared.responseJson,'Acknowledged response bytes differ from prepared bytes');
    return {...state,phase:'ACKNOWLEDGED',acknowledged:true};
  }
  if(kind==='FINISH'){
    keys(event,['kind','threadId','turnId','outputJson']);
    requireState(['BOUND','ACKNOWLEDGED'].includes(state.phase),'Final cannot precede callback acknowledgement');
    requireState(event.threadId===state.binding.threadId&&event.turnId===state.binding.turnId,'Foreign final output');
    text(event.outputJson,'public final JSON',h.limits.maxFinalBytes);
    let value;try{value=JSON.parse(event.outputJson);}catch{requireState(false,'Final must be JSON');}
    requireState(canonical(value)===event.outputJson,'Final must retain its exact canonical representation');
    return {...state,phase:'COMPLETED',completion:{outputJson:event.outputJson,outputHash:sha256(event.outputJson)}};
  }
  if(kind==='ABORT'){
    keys(event,['kind','code']);identifier(event.code);
    return {...state,phase:'ABORTED',abort:{code:event.code,priorPhase:state.phase}};
  }
  requireState(false,'Unknown transcript transition');
}
export function createNativeReadTranscript(input){
  const h=header(input),root={schema:SCHEMA,header:h};
  return freeze({...root,frames:[],head:sha256(root)});
}
export function inspectNativeReadTranscript(input,expectedHead){
  digest(expectedHead);const t=clone(input);keys(t,['schema','header','frames','head']);
  requireState(t.schema===SCHEMA,'Unsupported transcript schema');const h=header(t.header);
  requireState(Array.isArray(t.frames)&&t.frames.length<=7,'Transcript frame limit exceeded');
  let prior=sha256({schema:SCHEMA,header:h});
  let state={phase:'CREATED',binding:null,call:null,prepared:null,dispatchIntended:false,acknowledged:false,completion:null,abort:null};
  for(const [index,frame]of t.frames.entries()){
    keys(frame,['seq','previousHash','event','hash']);
    requireState(frame.seq===index+1&&frame.previousHash===prior,'Transcript order or predecessor differs');
    requireState(frame.hash===sha256({seq:frame.seq,previousHash:frame.previousHash,event:frame.event}),'Transcript frame bytes changed');
    state=transition(state,frame.event,h);prior=frame.hash;
  }
  requireState(t.head===prior&&prior===expectedHead,'Transcript does not match the independently retained head');
  const disposition=state.phase==='COMPLETED'?'RETAINED_CANDIDATE_REQUIRES_VALIDATION'
    :state.dispatchIntended&&!state.acknowledged?'RECONCILE_DISPATCH'
    :state.phase==='ABORTED'?'TERMINAL_DIAGNOSIS'
    :state.acknowledged?'RECONCILE_TURN_COMPLETION':'RECONCILE_BEFORE_DISPATCH';
  return freeze({...state,head:prior,frames:t.frames.length,callbackCount:state.call?1:0,
    recovery:{disposition,mayResend:false,responseDelivery:state.acknowledged?'PROVIDER_ACKNOWLEDGED_NOT_SEMANTIC_PROOF':state.dispatchIntended?'UNKNOWN':'NO_DISPATCH_INTENT_RECORDED'},
    caveat:'This pure transcript grants no authority and proves neither durable storage, real provider events, semantic consumption nor acceptance. Verify external references and retain the expected head independently.'});
}
export function appendNativeReadFrame(input,event,expectedHead){
  const state=inspectNativeReadTranscript(input,expectedHead),t=clone(input),e=clone(event);
  transition(state,e,t.header);
  const body={seq:t.frames.length+1,previousHash:t.head,event:e},frame={...body,hash:sha256(body)};
  const next={...t,frames:[...t.frames,frame],head:frame.hash};
  inspectNativeReadTranscript(next,frame.hash);return freeze(next);
}
