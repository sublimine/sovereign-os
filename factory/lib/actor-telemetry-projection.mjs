// Minimal, read-only actor telemetry for a local console.  This is a
// projection boundary, not a diagnostic dump: a persisted Factory row is not
// public merely because it is available to the control plane.
import {canonical,sha256} from './contracts.mjs';
import {inferenceRequestHash} from '../providers/instruction-profiles.mjs';
import {missionInferenceBudget} from './mission-inference-budget.mjs';
import {assertMissionInferenceDispatchProvenance,missionInferenceActorOriginId,missionInferenceRecordRef,readMissionInferenceActorOrigin} from './mission-inference-provenance.mjs';

export const ACTOR_TELEMETRY_SCHEMA='sovereign.actor-telemetry.v1';

const DIGEST=/^[a-f0-9]{64}$/;
const MODEL=/^gpt-[a-z0-9][a-z0-9._-]{0,123}$/;
const EFFORTS=new Set(['low','medium','high','xhigh','max','ultra']);
const USAGE_FIELDS=Object.freeze(['inputTokens','outputTokens','cachedInputTokens','cacheWriteInputTokens','reasoningOutputTokens','totalTokens']);
const USAGE_SCOPES=new Set(['fresh-thread-total','last-response-only']);

const plain=value=>value!==null&&typeof value==='object'&&!Array.isArray(value)&&Object.getPrototypeOf(value)===Object.prototype;
const safeModel=value=>typeof value==='string'&&MODEL.test(value);
const safeEffort=value=>typeof value==='string'&&EFFORTS.has(value);
const digest=value=>typeof value==='string'&&DIGEST.test(value);
const completed=value=>value==='completed'||value==='COMPLETED';

function empty({integrity='UNVERIFIED'}={}){
  return {schema:ACTOR_TELEMETRY_SCHEMA,integrity,coverage:{actors:0,completedRecorded:0,pendingRecords:0,
    created:0,noRecordedCompletion:0,unverified:0,notCovered:0},actors:[],
    scope:'Read-only, local record-chain projection. It never exposes prompts, inputs, schemas, outputs, private IDs, provider thread/turn IDs, hashes, transcripts, diagnostics or credentials. COMPLETED_RECORDED is a locally retained receipt, not provider attestation, billing evidence, semantic truth or quality certification.'};
}

function same(left,right){
  try{return canonical(left)===canonical(right);}catch{return false;}
}

function sanitizedUsage(value){
  if(!plain(value))return null;
  const usage={};
  for(const field of USAGE_FIELDS)if(Number.isSafeInteger(value[field])&&value[field]>=0)usage[field]=value[field];
  return Object.keys(usage).length?usage:null;
}

function receiptOrigin(receipt){
  return receipt?.simulation===false?'REAL':receipt?.simulation===true?'SIMULATED':'UNKNOWN';
}

function publicActor(index,kind,state,integrity,extra={}){
  // An ordinal is deliberately not derived from or coupled to any Store,
  // provider, request, thread, turn or record identifier.
  return {actor:`Actor ${index}`,kind,state,integrity,...extra};
}

function knownContextHashes(run){
  const hashes=new Set();
  try{
    if(!plain(run.context)||!digest(run.contextHash)||sha256(run.context)!==run.contextHash)return null;
    hashes.add(run.contextHash);
    if(run.contextHistory===undefined)return hashes;
    if(!Array.isArray(run.contextHistory))return null;
    for(const item of run.contextHistory){
      if(!plain(item)||!plain(item.context)||!digest(item.contextHash)||sha256(item.context)!==item.contextHash)return null;
      hashes.add(item.contextHash);
    }
    return hashes;
  }catch{return null;}
}

function ordinaryActor(runRecord,missionId){
  const run=runRecord?.data;
  if(runRecord?.type!=='run'||!plain(run)||run.id!==runRecord.id||run.missionId!==missionId
    ||!['producer','reviewer'].includes(run.mode)||typeof run.nodeId!=='string'||run.nodeId.length===0)return null;
  // Controller, native and sourced-response actors have route-specific
  // contracts.  They are intentionally outside this generic projection.
  const contexts=knownContextHashes(run);
  if(!contexts)return null;
  return {run,contexts,kind:run.mode==='producer'?'PRODUCER':'REVIEWER'};
}

function ordinaryWorkerConfig(store,runId){
  try{
    const record=store.get('worker-config',runId,1),data=record?.data;
    if(record?.type!=='worker-config'||record.version!==1||!plain(data)||!Array.isArray(data.roleIds)
      ||!data.roleIds.every(value=>typeof value==='string')||typeof data.instructions!=='string'||!digest(data.prefixHash)
      ||sha256(data.instructions)!==data.prefixHash)return null;
    if(['controllerContract','boundedReadContract','sourcedResponseContract'].some(field=>Object.hasOwn(data,field)))return null;
    return record;
  }catch{return null;}
}

const reference=record=>({type:record.type,id:record.id,version:record.version,hash:record.hash});

function pendingRunFor(store,runId,requestHash){
  try{
    const head=store.get('run',runId),matches=[];
    for(let version=head?.version??0;version>=1;version--){
      const candidate=store.get('run',runId,version);
      if(candidate?.data?.expectedRequestHash===requestHash)matches.push(candidate);
    }
    return matches.length===1?matches[0]:null;
  }catch{return null;}
}

function budgetDispatchFor(source,store,missionId,run,requestRecord,requestHash,actorOrigin){
  if(!source?.authority||!actorOrigin)return false;
  try{
    const pendingRun=pendingRunFor(store,run.id,requestHash);
    if(!pendingRun)return false;
    const expectedRun=reference(pendingRun),expectedRequest=reference(requestRecord),calls=store.list('mission-inference-call').filter(record=>{
      const call=record?.data,binding=call?.binding;
      return record?.type==='mission-inference-call'&&record.version===1&&plain(call)&&call.missionId===missionId&&call.kind==='worker'
        &&plain(binding)&&binding.requestHash===requestHash&&same(binding.run,expectedRun)&&same(binding.request,expectedRequest);
    });
    if(calls.length!==1)return false;
    assertMissionInferenceDispatchProvenance({store,authority:source.authority},{run:expectedRun,request:expectedRequest,
      call:reference(calls[0]),family:actorOrigin.family});
    return true;
  }catch{return false;}
}

function requestFor(source,store,run,contexts,requestHash,{budgeted=false,actorOrigin=null}={}){
  if(!digest(requestHash)||!Array.isArray(run.requests))return null;
  const recorded=run.requests.some(item=>plain(item)&&item.requestHash===requestHash&&contexts.has(item.contextHash));
  if(!recorded)return null;
  try{
    const record=store.get('inference-request','inference-request:'+sha256([run.id,requestHash]),1),data=record?.data;
    if(record?.type!=='inference-request'||record.version!==1||!plain(data)||data.schema!=='sovereign.inference-request.v1'
      ||data.runId!==run.id||data.missionId!==run.missionId||data.requestHash!==requestHash||typeof data.requestJson!=='string')return null;
    const request=JSON.parse(data.requestJson);
    if(!plain(request)||inferenceRequestHash(request)!==requestHash||!safeModel(request.model)||!safeEffort(request.reasoningEffort))return null;
    if(budgeted&&!budgetDispatchFor(source,store,run.missionId,run,record,requestHash,actorOrigin))return null;
    return {target:{model:request.model,reasoningEffort:request.reasoningEffort}};
  }catch{return null;}
}

function receiptsFor(run){
  try{
    const hasPointer=Object.hasOwn(run,'inferenceReceipt');
    const receipts=run.inferenceReceipts??(hasPointer?[run.inferenceReceipt]:[]);
    if(!Array.isArray(receipts)||receipts.some(receipt=>!plain(receipt)))return null;
    if(hasPointer&&(!receipts.length||!same(receipts.at(-1),run.inferenceReceipt)))return null;
    return receipts;
  }catch{return null;}
}

function validatedReceipt(source,store,run,contexts,receipt,{budgeted=false,actorOrigin=null}={}){
  if(!plain(receipt)||receipt.kind!=='inference'||!completed(receipt.status)||typeof receipt.threadId!=='string'||receipt.threadId.length===0
    ||typeof receipt.turnId!=='string'||receipt.turnId.length===0||!digest(receipt.contextHash))return null;
  const request=requestFor(source,store,run,contexts,receipt.contextHash,{budgeted,actorOrigin});
  if(!request||receipt.model!==request.target.model||receipt.reasoningEffort!==request.target.reasoningEffort)return null;
  const execution={origin:receiptOrigin(receipt)};
  const usage=sanitizedUsage(receipt.usage);
  if(usage)execution.usage=usage;
  if(USAGE_SCOPES.has(receipt.usageScope))execution.usageScope=receipt.usageScope;
  return {target:request.target,execution};
}

function budgetedMission(store,missionId){
  try{
    // A later mutable head must not erase the fact that this actor was created
    // under the stricter budgeted-dispatch protocol.
    const current=store.get('mission',missionId),initial=store.get('mission',missionId,1);
    return current?.data?.policy?.inferenceBudget!==undefined||initial?.data?.policy?.inferenceBudget!==undefined;
  }catch{return false;}
}

function budgetLineage(source,store,missionId,runRecord){
  // A budgeted ordinary actor must have the signed creation origin.  The
  // request-specific proof is checked separately below. Neither assertion is
  // provider attestation.
  if(!source?.authority||!source?.registry)return null;
  try{
    const origin=store.get('mission-inference-actor-origin',missionInferenceActorOriginId(runRecord.id));
    const verified=readMissionInferenceActorOrigin({store,authority:source.authority},missionInferenceRecordRef(origin));
    if(verified.payload.missionId!==missionId||verified.payload.runId!==runRecord.id)return null;
    missionInferenceBudget(source.registry,missionId);
    return verified;
  }catch{return null;}
}

function classify({source,store,missionId,runRecord,index,budgeted,budgetVerified}){
  const actor=ordinaryActor(runRecord,missionId);
  if(!actor)return publicActor(index,'NOT_COVERED','NOT_COVERED','NOT_COVERED');
  const config=ordinaryWorkerConfig(store,runRecord.id);
  if(!config)return publicActor(index,actor.kind,'NOT_COVERED','NOT_COVERED');
  const lineage=budgeted&&budgetVerified?budgetLineage(source,store,missionId,runRecord):budgeted?null:true;
  if(!lineage)return publicActor(index,actor.kind,'UNVERIFIED','UNVERIFIED');
  const {run,contexts,kind}=actor;
  const integrity=budgeted?'SIGNED_LOCAL_LINEAGE':'LOCAL_RECORD_CHAIN';
  if(run.expectedRequestHash!==undefined&&run.expectedRequestHash!==null){
    const pending=requestFor(source,store,run,contexts,run.expectedRequestHash,{budgeted,actorOrigin:lineage});
    if(!pending)return publicActor(index,kind,'UNVERIFIED','UNVERIFIED');
    return publicActor(index,kind,'PENDING_RECORD',integrity,{target:pending.target,execution:{origin:'UNKNOWN'}});
  }
  const receipts=receiptsFor(run);
  if(receipts===null)return publicActor(index,kind,'UNVERIFIED','UNVERIFIED');
  if(!receipts.length){
    return publicActor(index,kind,Array.isArray(run.requests)&&run.requests.length?'NO_RECORDED_COMPLETION':'CREATED',integrity);
  }
  const validated=receipts.map(receipt=>validatedReceipt(source,store,run,contexts,receipt,{budgeted,actorOrigin:lineage}));
  if(validated.some(value=>value===null))return publicActor(index,kind,'UNVERIFIED','UNVERIFIED');
  const latest=validated.at(-1);
  return publicActor(index,kind,'COMPLETED_RECORDED',integrity,{target:latest.target,execution:latest.execution});
}

function summarize(actors){
  const coverage={actors:actors.length,completedRecorded:0,pendingRecords:0,created:0,noRecordedCompletion:0,unverified:0,notCovered:0};
  for(const actor of actors){
    if(actor.state==='COMPLETED_RECORDED')coverage.completedRecorded++;
    else if(actor.state==='PENDING_RECORD')coverage.pendingRecords++;
    else if(actor.state==='CREATED')coverage.created++;
    else if(actor.state==='NO_RECORDED_COMPLETION')coverage.noRecordedCompletion++;
    else if(actor.state==='UNVERIFIED')coverage.unverified++;
    else if(actor.state==='NOT_COVERED')coverage.notCovered++;
  }
  return coverage;
}

/**
 * Project one mission's ordinary actor metadata without exporting any raw
 * Factory records. `source` may be a FactoryEngine or `{store, authority,
 * registry}`. A bare Store is accepted only for unbudgeted local-chain views.
 */
export function projectMissionActorTelemetry(source,missionId){
  const store=source?.store??source;
  if(!store||typeof store.list!=='function'||typeof store.get!=='function'||typeof store.verifyJournal!=='function'
    ||typeof missionId!=='string'||missionId.length===0)return empty();
  try{store.verifyJournal();}catch{return empty();}
  let runs;
  try{runs=store.list('run').filter(record=>record?.data?.missionId===missionId).sort((left,right)=>left.id.localeCompare(right.id));}
  catch{return empty();}
  const budgeted=budgetedMission(store,missionId);
  let budgetVerified=!budgeted;
  if(budgeted&&source?.registry)try{missionInferenceBudget(source.registry,missionId);budgetVerified=true;}catch{}
  const actors=runs.map((run,index)=>classify({source,store,missionId,runRecord:run,index:index+1,budgeted,budgetVerified}));
  return {schema:ACTOR_TELEMETRY_SCHEMA,integrity:'LOCAL_RECORD_CHAIN',coverage:summarize(actors),actors,
    scope:'Ordinary producer/reviewer actors only. Each completed entry is bound to a retained request hash and a locally retained completed receipt. Signed local lineage is shown only for budgeted missions with validated actor-origin and dispatch-reservation records. No provider attestation, billed cost, semantic truth, quality verdict, prompt, input, schema, output, private identifier, thread, turn, hash, transcript, diagnostic or credential is projected.'};
}
