// Engine callbacks feed CLI progress and UI integrations. The durable journal
// retains full operational detail for trusted recovery, but a callback is a
// public observation surface and must not become a second route around status
// and report projections.
import {digest,identifier,integer,list,string} from './contracts.mjs';
import {PUBLIC_MISSION_STATUSES} from './mission-public-projection.mjs';

export const PUBLIC_ENGINE_EVENT_SCHEMA='sovereign.public-engine-event.v1';

const statusSet=new Set(PUBLIC_MISSION_STATUSES);
const plain=value=>value!==null&&typeof value==='object'&&!Array.isArray(value)&&Object.getPrototypeOf(value)===Object.prototype;
const code=value=>{
  string(value,'public engine event code',{max:160});
  if(!/^[A-Z_][A-Z0-9_]*$/.test(value))throw Error('invalid public engine event code');
  return value;
};
const id=value=>{identifier(value,'public engine event identifier');return value;};
const hash=value=>{digest(value,'public engine event hash');return value;};
const count=(value,label,{min=0,max=1000000}={})=>{integer(value,label,{min,max});return value;};

function base(event,kind){
  if(!plain(event)||!plain(event.data)||typeof event.kind!=='string')throw Error('invalid engine event');
  const projected={schema:PUBLIC_ENGINE_EVENT_SCHEMA,kind};
  if(Number.isSafeInteger(event.seq)&&event.seq>0)projected.seq=event.seq;
  if(typeof event.createdAt==='string'){
    // Progress timestamps are useful but must be exact compact UTC values;
    // reject an arbitrary string rather than echoing it from the journal.
    if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(event.createdAt)
      ||new Date(event.createdAt).toISOString()!==event.createdAt)throw Error('invalid engine event timestamp');
    projected.at=event.createdAt;
  }
  return projected;
}

function pending(value){
  if(value===undefined)return [];
  list(value,'public engine pending',{max:1000});
  return value.map((item,index)=>{
    if(!plain(item))throw Error(`invalid pending ${index}`);
    const allowed=['code','nodeId','operationId','reason','diagnosis'];
    if(!Object.keys(item).every(key=>allowed.includes(key))||!Object.hasOwn(item,'code'))throw Error(`invalid pending ${index}`);
    const projected={code:code(item.code)};
    if(Object.hasOwn(item,'nodeId'))projected.nodeId=id(item.nodeId);
    if(Object.hasOwn(item,'operationId'))projected.operationId=id(item.operationId);
    // Reason/diagnosis are operational prose and never cross this boundary.
    return projected;
  });
}

const withMission=(event,kind)=>{
  const result=base(event,kind);result.missionId=id(event.data.missionId);return result;
};
const withNode=(event,kind,{artifact=false,attempt=false,codeField=false}={})=>{
  const result=withMission(event,kind);result.nodeId=id(event.data.nodeId);
  if(artifact)result.artifactId=id(event.data.artifactId);
  if(attempt)result.attempt=count(event.data.attempt,'public engine event attempt',{min:0,max:10000});
  if(codeField)result.code=code(event.data.code);
  return result;
};

/**
 * Return the public event envelope for a durable engine event. Unknown or
 * malformed events are reduced to chronology only. This allows progress UIs
 * to remain live without copying a future event's `data` object by default.
 */
export function projectPublicEngineEvent(event){
  try{
    switch(event?.kind){
      case 'mission.created': return withMission(event,'mission.created');
      case 'mission.status': {
        const result=withMission(event,'mission.status');
        if(!statusSet.has(event.data.status))throw Error('invalid public status');
        result.status=event.data.status;result.pending=pending(event.data.pending);return result;
      }
      case 'adaptive-v3.direct.accepted': {
        const result=withMission(event,'adaptive-v3.direct.accepted');result.artifactId=id(event.data.artifactId);return result;
      }
      case 'review.retry.authorized': return withNode(event,'review.retry.authorized',{artifact:true,attempt:true});
      case 'planning.review.resumed':
      case 'planning.response.recovery':
      case 'planning.attempt': {
        const result=withMission(event,event.kind);result.attempt=count(event.data.attempt,'public planning attempt',{min:0,max:10000});return result;
      }
      case 'planning.response.resumed': return withMission(event,'planning.response.resumed');
      case 'planning.coverage.normalized': {
        const result=withMission(event,'planning.coverage.normalized');result.artifactId=id(event.data.artifactId);
        result.criteriaBefore=count(event.data.criteriaBefore,'public planning criteria before');
        result.criteriaAfter=count(event.data.criteriaAfter,'public planning criteria after');
        list(event.data.added,'public planning added criteria',{max:10000});result.added=event.data.added.map(value=>id(value));return result;
      }
      case 'planning.closed-gates.normalized':
      case 'planning.input-copy-gates.normalized': {
        const result=withMission(event,event.kind);result.artifactId=id(event.data.artifactId);
        list(event.data.added,'public planning added gates',{max:10000});result.added=event.data.added.map(value=>id(value));return result;
      }
      case 'planning.accepted': {
        const result=withMission(event,'planning.accepted');result.artifactId=id(event.data.artifactId);result.nodes=count(event.data.nodes,'public plan node count');return result;
      }
      case 'planning.returned': {
        const result=withMission(event,'planning.returned');result.attempt=count(event.data.attempt,'public planning attempt',{min:0,max:10000});result.code=code(event.data.code);return result;
      }
      case 'planning.recovery.required': return withMission(event,'planning.recovery.required');
      case 'node.review.resumed': return withNode(event,'node.review.resumed',{attempt:true});
      case 'node.started': return withNode(event,'node.started',{attempt:true});
      case 'node.accepted': return withNode(event,'node.accepted',{artifact:true});
      case 'node.returned': return withNode(event,'node.returned',{artifact:true});
      case 'nodes.parallel.started': {
        const result=withMission(event,'nodes.parallel.started');list(event.data.nodeIds,'public parallel node ids',{min:1,max:10000});
        result.nodeIds=event.data.nodeIds.map(value=>id(value));result.limit=count(event.data.limit,'public parallelism',{min:1,max:4});return result;
      }
      case 'node.waiting': return withNode(event,'node.waiting',{codeField:true});
      case 'node.correction.required': return withNode(event,'node.correction.required',{codeField:true});
      case 'learning.observation.failed': {
        const result=withMission(event,'learning.observation.failed');result.code=code(event.data.code);return result;
      }
      // The sourced route has no generated plan graph, but its own fixed entry
      // transitions are useful public operational facts. Deliberately retain
      // only the named transition, optional public code and final artifact
      // reference; run IDs, review IDs, contract hashes, phases, scopes and
      // provider material remain internal.
      case 'sourced-entry.started':
      case 'sourced-entry.producer.recovered':
        return withMission(event,event.kind);
      case 'sourced-entry.deferred':
      case 'sourced-entry.fallback':
      case 'sourced-entry.producer.final-rejected': {
        const result=withMission(event,event.kind);result.code=code(event.data.code);return result;
      }
      case 'sourced-entry.accepted': {
        const result=withMission(event,'sourced-entry.accepted');result.artifactId=id(event.data.artifactId);return result;
      }
      default:return base(event,'ENGINE_EVENT_RECORDED');
    }
  }catch{
    try{return base(event,'ENGINE_EVENT_RECORDED');}
    catch{return {schema:PUBLIC_ENGINE_EVENT_SCHEMA,kind:'ENGINE_EVENT_RECORDED'};}
  }
}
