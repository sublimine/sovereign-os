// A deliberately narrow no-provider completion path for adaptive-v3.  This is
// not a model review and it never claims to be one: the only admissible body
// is re-materialized byte-for-byte from the signed route's tiny grammar.
import {canonical,check,clone,digest,identifier,integer,keys,list,sha256,string} from './contracts.mjs';
import {ADAPTIVE_V3_ADMISSION_METADATA,ADAPTIVE_V3_DIRECT_ENTRY_MODE} from './adaptive-v3-routing.mjs';
import {materializeAdaptiveV3ClosedOutput,verifyAdaptiveV3ClosedOutput} from './adaptive-v3-materialization.mjs';
import {ADAPTIVE_V3_ROUTE_RECORD_TYPE,assertAdaptiveV3MissionRoute} from './adaptive-v3-route-contract.mjs';

export const ADAPTIVE_V3_DIRECT_ENTRY_NODE='adaptive-v3-direct';
export const ADAPTIVE_V3_DIRECT_ENTRY_PURPOSE='adaptive-v3-deterministic-closed-output';
export const ADAPTIVE_V3_DIRECT_ORIGIN_TYPE='adaptive-v3-origin';
export const ADAPTIVE_V3_DIRECT_CERTIFICATION_TYPE='adaptive-v3-certification';
export const ADAPTIVE_V3_DIRECT_ORIGIN_KIND='adaptive-v3.origin';
export const ADAPTIVE_V3_DIRECT_CERTIFICATION_KIND='adaptive-v3.certification';
export const ADAPTIVE_V3_DIRECT_ORIGIN_SCHEMA='sovereign.adaptive-v3-deterministic-origin.v1';
export const ADAPTIVE_V3_DIRECT_CERTIFICATION_SCHEMA='sovereign.adaptive-v3-deterministic-certification.v1';
export const ADAPTIVE_V3_DIRECT_ENTRY_REVISION=1;
export const ADAPTIVE_V3_DIRECT_ENTRY_INTEGRITY='ADAPTIVE_V3_DIRECT_ENTRY_INTEGRITY';

const freeze=value=>{
  if(value&&typeof value==='object'&&!Object.isFrozen(value)){
    Object.values(value).forEach(freeze);Object.freeze(value);
  }
  return value;
};

// These are verification obligations, not model-facing semantic criteria. A
// certificate establishes only these mechanical facts and says so explicitly.
export const ADAPTIVE_V3_DIRECT_CRITERIA=freeze([
  {id:'deterministic-output-exact',text:'The delivered bytes equal a fresh deterministic materialization of the immutable adaptive-v3 CLOSED request and signed route decision.'},
  {id:'deterministic-boundary',text:'The product was created without provider inference, tools, sources, inputs, effects, plan, ordinary reviewer or semantic model judgment.'}
]);

const DIRECT_CONTEXT_SCHEMA='sovereign.adaptive-v3-deterministic-producer-context.v1';
const DIRECT_CERTIFICATION=freeze({
  method:'deterministic-recomputation-v1',provider:'none',semanticReview:'none',reviewKind:'not-a-model-review-v1'
});
const REF_FIELDS=Object.freeze(['type','id','version','hash']);
const PAYLOAD_FIELDS=Object.freeze(['missionId','nodeId','producerRunId','kind','purpose','body','claims','inputRefs','toolReceipts','requiredEffects','criteria','provisional']);
const CANDIDATE_V1_FIELDS=Object.freeze(['id','payload','payloadHash','missionId','status','reviews','createdAt','invalidation']);
const RUN_FIELDS=Object.freeze(['id','missionId','nodeId','mode','context','contextHash','forbiddenArtifactIds','providerThreadId','createdAt']);
const CONTEXT_FIELDS=Object.freeze(['purpose','artifactIds','sourceIds','instructionsHash','producerConversationIncluded']);
const ORIGIN_FIELDS=Object.freeze(['schema','revision','mission','route','run','nodeId','purpose','criteriaHash','decisionHash','preflightHash','output','outputHash','contextHash','producer']);
const ORIGIN_PRODUCER_FIELDS=Object.freeze(['method','provider','semanticReview']);
const CERTIFICATION_FIELDS=Object.freeze(['schema','revision','mission','route','origin','run','candidate','candidatePayloadHash','criteriaHash','decisionHash','preflightHash','outputHash','bodyHash','certification']);
const CERTIFICATION_DECLARATION_FIELDS=Object.freeze(['method','provider','semanticReview','reviewKind']);

const integrity=(condition,message,details={})=>check(condition,ADAPTIVE_V3_DIRECT_ENTRY_INTEGRITY,message,details);
const same=(actual,expected)=>{
  try{return canonical(actual)===canonical(expected);}catch{return false;}
};
const stable=(value,label)=>{
  try{return clone(value);}catch{integrity(false,`${label} is not canonical immutable JSON data`);}
};
const exactKeys=(value,fields,label,required=fields)=>{
  try{keys(value,fields,required,label);}catch{integrity(false,`${label} has an unsupported shape`);}
  return value;
};
const ref=record=>{
  integrity(record&&typeof record==='object','A durable record reference is required');
  identifier(record.type,'record type');identifier(record.id,'record id');integer(record.version,'record version',{min:1});digest(record.hash,'record hash');
  return {type:record.type,id:record.id,version:record.version,hash:record.hash};
};

function exactRef(value,{type,id:recordId,version=1}={},label='record reference'){
  const data=stable(value,label);exactKeys(data,REF_FIELDS,label);
  identifier(data.type,`${label} type`);identifier(data.id,`${label} id`);integer(data.version,`${label} version`,{min:1});digest(data.hash,`${label} hash`);
  if(type!==undefined)integrity(data.type===type,`${label} has the wrong record type`);
  if(recordId!==undefined)integrity(data.id===recordId,`${label} has the wrong record id`);
  if(version!==undefined)integrity(data.version===version,`${label} has the wrong record version`);
  return data;
}

function exactRecord(store,reference,expected,label){
  const target=exactRef(reference,expected,label),record=store.get(target.type,target.id,target.version);
  integrity(record&&record.hash===target.hash,`${label} is missing or changed`);
  const current=store.get(target.type,target.id);
  integrity(current&&current.version===target.version&&current.hash===target.hash,`${label} was re-versioned or reverted`);
  return record;
}

// Mission lifecycle state (status, timestamps, final pointer) is intentionally
// allowed to advance after certification. The signed route contract separately
// proves that all non-lifecycle mission bytes still equal mission@1.
function exactHistoricalRecord(store,reference,expected,label){
  const target=exactRef(reference,expected,label),record=store.get(target.type,target.id,target.version);
  integrity(record&&record.hash===target.hash,`${label} historical version is missing or changed`);
  return record;
}

function sequence(registry,record,label){
  integrity(typeof registry?.committedSequence==='function','Deterministic entry requires chronological registry support');
  const value=registry.committedSequence(record.type,record.id,record.version);
  integrity(Number.isSafeInteger(value)&&value>0,`${label} lacks a committed chronological position`);
  return value;
}

function directContext({mission,route,output}){
  const binding={schema:DIRECT_CONTEXT_SCHEMA,revision:ADAPTIVE_V3_DIRECT_ENTRY_REVISION,
    mission:ref(mission),route:ref(route),outputHash:output.outputHash,criteriaHash:sha256(ADAPTIVE_V3_DIRECT_CRITERIA),
    nodeId:ADAPTIVE_V3_DIRECT_ENTRY_NODE,purpose:ADAPTIVE_V3_DIRECT_ENTRY_PURPOSE};
  return {purpose:ADAPTIVE_V3_DIRECT_ENTRY_PURPOSE,artifactIds:[],sourceIds:[],instructionsHash:sha256(binding),producerConversationIncluded:false};
}

function missionOrigin(store,missionId){
  const record=store.get('mission',missionId,1);
  integrity(record?.version===1&&record.data?.id===missionId,`Mission ${missionId} has no immutable origin`);
  integrity(record.data.intentHash===sha256(record.data.intent),'Mission origin request digest changed');
  return record;
}

function assertDirectFacts(registry,missionId){
  const {store,authority}=registry;
  const facts=assertAdaptiveV3MissionRoute(store,authority,missionId);
  integrity(facts,'Deterministic entry requires an authenticated adaptive-v3 route');
  const frozen=stable(facts,'adaptive-v3 route facts');
  integrity(frozen.decision?.selectedEntryMode===ADAPTIVE_V3_DIRECT_ENTRY_MODE,
    'Adaptive-v3 route does not authorize the deterministic direct entry');
  integrity(frozen.inputManifestHash===null,'Deterministic entry cannot receive an input manifest');
  integrity(frozen.preflight&&frozen.preflight.status==='READY'&&typeof frozen.preflight.outputHash==='string',
    'Deterministic entry requires a READY preflight with an exact output digest');
  integrity(same(frozen.decision.closedMaterialization,frozen.preflight)
    &&frozen.decision.closedMaterializationHash===sha256(frozen.preflight),
  'Direct route preflight differs from its frozen decision');
  const mission=missionOrigin(store,missionId),route=exactRecord(store,frozen.routeRecord,
    {type:ADAPTIVE_V3_ROUTE_RECORD_TYPE,id:missionId,version:1},'adaptive-v3 route record');
  integrity(same(mission.data,frozen.origin),'Route assertion origin differs from mission@1');
  const output=materializeAdaptiveV3ClosedOutput(mission.data.intent,ADAPTIVE_V3_ADMISSION_METADATA,frozen.decision.admissionDecision);
  integrity(output.outputHash===frozen.preflight.outputHash,'Direct preflight output hash differs from fresh deterministic materialization');
  return {facts:frozen,mission,route,output};
}

function linkedRecords(store,type,{missionId,runId}={}){
  return store.list(type).filter(record=>{
    const data=record.data;
    return missionId!==undefined&&data?.missionId===missionId||runId!==undefined&&data?.runId===runId;
  });
}

function eventsForRun(store,runId){
  const events=[];let after=0;
  for(;;){
    const page=store.events({after,limit:10000});events.push(...page.filter(event=>event.data?.runId===runId));
    if(page.length<10000)return events;after=page.at(-1).seq;
  }
}

function assertNoDirectWork(store,missionId,{runId=null,artifactId=null,current=true}={}){
  const origin=missionOrigin(store,missionId);
  integrity(!Object.hasOwn(origin.data,'inputManifestHash')&& !store.get('mission-input-manifest',missionId),
    'Deterministic direct entry cannot use mission inputs');
  integrity(!store.list('mission-input-bytes').some(record=>record.data.missionId===missionId),
    'Deterministic direct entry found retained mission input bytes');
  const staticConflicts=[
    ['plan',()=>store.get('plan',missionId)],
    ['planning-progress',()=>store.get('planning-progress',missionId)],
    ['closed-entry',()=>store.get('closed-entry',missionId)],
    ['bounded-read-entry',()=>store.get('bounded-read-entry',missionId)],
    ['sourced-response-entry',()=>store.get('sourced-response-entry',missionId)],
    ['tool-workspace',()=>store.get('tool-workspace',missionId)],
    ['input-preparation',()=>store.get('input-preparation',missionId)],
    ['input-directory',()=>store.list('input-directory').some(record=>record.data?.missionId===missionId)],
    ['input-prepared-file',()=>store.list('input-prepared-file').some(record=>record.data?.missionId===missionId)],
    ['execution-job',()=>store.list('execution-job').some(record=>record.data?.missionId===missionId)],
    ['source-http-trace',()=>store.list('source-http-trace').some(record=>record.data?.missionId===missionId)],
    // Learning is not inert metadata for a direct route: a registered dataset
    // can lead to proposal/evaluation provider work, a candidate can be
    // attributed to the native run, and a cycle can already have dispatched a
    // proposal before it owns a candidate.  These are durable causal roots;
    // deliberately do not reject generic observation events, which remain
    // zero-inference and do not by themselves establish work.
    ['learning-dataset',()=>store.list('learning-dataset').some(record=>record.data?.missionId===missionId)],
    ['learning-candidate',()=>store.list('learning-candidate').some(record=>
      record.data?.missionId===missionId||runId!==null&&record.data?.authorRunId===runId)],
    ['learning-cycle',()=>store.list('learning-cycle').some(record=>record.data?.missionId===missionId
      ||runId!==null&&record.data?.runId===runId)]
  ];
  for(const [name,read] of staticConflicts)integrity(!read(),`Deterministic direct entry conflicts with ${name}`);
  integrity(store.list('node').every(record=>record.data.missionId!==missionId),'Deterministic direct entry cannot coexist with plan nodes');
  integrity(store.list('effect').every(record=>record.data.missionId!==missionId),'Deterministic direct entry cannot coexist with broker effects');
  integrity(store.list('source').every(record=>record.data.missionId!==missionId),'Deterministic direct entry cannot coexist with acquired sources');
  const runs=store.list('run').filter(record=>record.data.missionId===missionId);
  if(runId===null)integrity(runs.length===0,'Deterministic direct entry cannot start after other mission actors');
  else integrity(runs.length===1&&runs[0].id===runId,'Deterministic direct entry requires exactly its single native producer');
  const artifacts=store.list('artifact').filter(record=>record.data.missionId===missionId);
  if(artifactId===null)integrity(artifacts.length===0,'Deterministic direct entry cannot create a second or foreign mission product');
  else integrity(artifacts.length===1&&artifacts[0].id===artifactId,'Deterministic direct entry requires exactly its unique candidate');
  if(runId!==null){
    integrity(!store.get('worker-config',runId),'Deterministic producer cannot receive worker configuration');
    const forbiddenTypes=['worker-production','worker-proposal','producer-cleanup','inference-request','runtime-observation'];
    for(const type of forbiddenTypes)integrity(linkedRecords(store,type,{missionId,runId}).length===0,
      `Deterministic producer has forbidden ${type} history`);
    const providerEvents=eventsForRun(store,runId).filter(event=>
      event.kind.startsWith('worker.inference.')||event.kind.startsWith('blind.inference.'));
    integrity(providerEvents.length===0,'Deterministic producer has provider-dispatch history');
  }
  // current=false preserves a historical proof view, while the immutable
  // admission exclusions above still prevent a forged alternate lineage.
  if(current){
    integrity(!store.list('review').some(record=>record.data.artifactId===artifactId),
      'Deterministic direct candidate cannot acquire an ordinary review');
  }
  return {origin,runs,artifacts};
}

function originBinding({facts,mission,route,run,output}){
  return {schema:ADAPTIVE_V3_DIRECT_ORIGIN_SCHEMA,revision:ADAPTIVE_V3_DIRECT_ENTRY_REVISION,
    mission:ref(mission),route:ref(route),run:ref(run),nodeId:ADAPTIVE_V3_DIRECT_ENTRY_NODE,purpose:ADAPTIVE_V3_DIRECT_ENTRY_PURPOSE,
    criteriaHash:sha256(ADAPTIVE_V3_DIRECT_CRITERIA),decisionHash:facts.decision.decisionHash,preflightHash:sha256(facts.preflight),
    output:clone(output),outputHash:output.outputHash,contextHash:run.data.contextHash,
    producer:{method:'deterministic-recomputation-v1',provider:'none',semanticReview:'none'}};
}

function exactOriginPayload(value){
  const data=stable(value,'adaptive-v3 deterministic origin');exactKeys(data,ORIGIN_FIELDS,'adaptive-v3 deterministic origin');
  integrity(data.schema===ADAPTIVE_V3_DIRECT_ORIGIN_SCHEMA&&data.revision===ADAPTIVE_V3_DIRECT_ENTRY_REVISION,
    'Deterministic origin schema or revision changed');
  exactRef(data.mission,{type:'mission',version:1},'deterministic origin mission');
  exactRef(data.route,{type:ADAPTIVE_V3_ROUTE_RECORD_TYPE,version:1},'deterministic origin route');
  exactRef(data.run,{type:'run',version:1},'deterministic origin run');
  integrity(data.nodeId===ADAPTIVE_V3_DIRECT_ENTRY_NODE&&data.purpose===ADAPTIVE_V3_DIRECT_ENTRY_PURPOSE,
    'Deterministic origin node or purpose changed');
  for(const [field,label] of [['criteriaHash','criteria'],['decisionHash','route decision'],['preflightHash','preflight'],['outputHash','output'],['contextHash','context']])
    digest(data[field],`deterministic origin ${label} hash`);
  exactKeys(data.producer,ORIGIN_PRODUCER_FIELDS,'deterministic origin producer');
  integrity(data.producer.method==='deterministic-recomputation-v1'&&data.producer.provider==='none'&&data.producer.semanticReview==='none',
    'Deterministic origin cannot claim a provider or semantic review');
  return data;
}

function signedOrigin(registry,missionId){
  const {store,authority}=registry,record=store.get(ADAPTIVE_V3_DIRECT_ORIGIN_TYPE,missionId);
  integrity(record?.version===1,'Deterministic origin is missing or re-versioned');
  exactKeys(record.data,['signed'],'deterministic origin envelope');
  let data;try{data=authority.open(record.data.signed,ADAPTIVE_V3_DIRECT_ORIGIN_KIND);}catch(error){
    integrity(false,'Deterministic origin is unsigned or has an invalid signature',{cause:error?.code??'UNKNOWN'});
  }
  return {record,data:exactOriginPayload(data)};
}

function expectedPayload({mission,run,output}){
  return {missionId:mission.id,nodeId:ADAPTIVE_V3_DIRECT_ENTRY_NODE,producerRunId:run.id,kind:'deterministic-result',
    purpose:ADAPTIVE_V3_DIRECT_ENTRY_PURPOSE,body:output.body,claims:[],inputRefs:[],toolReceipts:[],requiredEffects:[],
    criteria:clone(ADAPTIVE_V3_DIRECT_CRITERIA),provisional:false};
}

function exactPayload(value){
  const data=stable(value,'adaptive-v3 deterministic payload');exactKeys(data,PAYLOAD_FIELDS,'adaptive-v3 deterministic payload');
  identifier(data.missionId,'deterministic payload mission id');identifier(data.nodeId,'deterministic payload node id');identifier(data.producerRunId,'deterministic payload producer run id');
  string(data.purpose,'deterministic payload purpose',{min:1,max:512});string(data.body,'deterministic payload body',{min:0,max:4*1024*1024});
  list(data.claims,'deterministic payload claims');list(data.inputRefs,'deterministic payload input refs');list(data.toolReceipts,'deterministic payload tool receipts');list(data.requiredEffects,'deterministic payload required effects');list(data.criteria,'deterministic payload criteria',{min:1});
  integrity(data.kind==='deterministic-result'&&data.nodeId===ADAPTIVE_V3_DIRECT_ENTRY_NODE&&data.purpose===ADAPTIVE_V3_DIRECT_ENTRY_PURPOSE
    &&data.provisional===false,'Deterministic payload kind, node, purpose or provisional state changed');
  integrity(data.claims.length===0&&data.inputRefs.length===0&&data.toolReceipts.length===0&&data.requiredEffects.length===0,
    'Deterministic payload cannot claim sources, inputs, tools or effects');
  integrity(same(data.criteria,ADAPTIVE_V3_DIRECT_CRITERIA),'Deterministic payload criteria changed');
  return data;
}

function assertRun(registry,{facts,mission,route,origin,output}){
  const {store}=registry,runRecord=exactRecord(store,origin.run,{type:'run',version:1},'deterministic producer run');
  const run=stable(runRecord.data,'deterministic producer run');exactKeys(run,RUN_FIELDS,'deterministic producer run');
  integrity(run.id===origin.run.id&&run.missionId===mission.id&&run.nodeId===ADAPTIVE_V3_DIRECT_ENTRY_NODE&&run.mode==='producer',
    'Deterministic producer identity changed');
  integrity(run.contextHash===sha256(run.context)&&same(run.context,directContext({mission,route,output})),
    'Deterministic producer context changed');
  integrity(same(run.forbiddenArtifactIds,[])&&run.providerThreadId===null,'Deterministic producer acquired forbidden provider identity');
  integrity(!store.get('worker-config',run.id),'Deterministic producer cannot have worker configuration');
  return runRecord;
}

function assertOrigin(registry,missionId,{current=true}={}){
  const {store}=registry,{facts,mission,route,output}=assertDirectFacts(registry,missionId),signed=signedOrigin(registry,missionId);
  const origin=signed.data;
  const originMission=exactHistoricalRecord(store,origin.mission,{type:'mission',id:missionId,version:1},'deterministic origin mission');
  const originRoute=exactRecord(store,origin.route,{type:ADAPTIVE_V3_ROUTE_RECORD_TYPE,id:missionId,version:1},'deterministic origin route');
  integrity(originMission.hash===mission.hash&&originRoute.hash===route.hash,'Deterministic origin changed its mission or route binding');
  integrity(origin.criteriaHash===sha256(ADAPTIVE_V3_DIRECT_CRITERIA)&&origin.decisionHash===facts.decision.decisionHash
    &&origin.preflightHash===sha256(facts.preflight),'Deterministic origin criteria, decision or preflight changed');
  integrity(origin.outputHash===output.outputHash&&origin.contextHash===sha256(directContext({mission,route,output})),
    'Deterministic origin output or context binding changed');
  verifyAdaptiveV3ClosedOutput(mission.data.intent,ADAPTIVE_V3_ADMISSION_METADATA,facts.decision.admissionDecision,origin.output);
  integrity(same(origin.output,output),'Deterministic origin retained output differs from fresh materialization');
  const run=assertRun(registry,{facts,mission,route,origin,output});
  const order={mission:sequence(registry,mission,'mission'),route:sequence(registry,route,'route'),run:sequence(registry,run,'run'),origin:sequence(registry,signed.record,'deterministic origin')};
  integrity(order.mission<order.route&&order.route<order.run&&order.run<order.origin,
    'Deterministic origin journal order is invalid');
  // An already committed candidate is allowed only when it belongs to this
  // exact native producer.  Its full payload/acceptance is checked by the
  // public payload/evidence assertions below; this keeps origin recovery
  // possible after a crash between candidate and certification.
  const artifacts=store.list('artifact').filter(record=>record.data.missionId===missionId);
  integrity(artifacts.length<=1&&artifacts.every(record=>record.data.payload.producerRunId===run.id),
    'Deterministic origin has a foreign or duplicate mission candidate');
  const found=assertNoDirectWork(store,missionId,{runId:run.id,artifactId:artifacts[0]?.id??null,current});
  return {facts,mission,route,output,originRecord:signed.record,origin,run,order,found};
}

function candidateV1(store,artifactId){
  const record=store.get('artifact',artifactId,1);integrity(record?.version===1,'Deterministic candidate v1 is missing');
  const artifact=stable(record.data,'deterministic candidate v1');exactKeys(artifact,CANDIDATE_V1_FIELDS,'deterministic candidate v1');
  integrity(artifact.id===artifactId&&artifact.missionId===artifact.payload.missionId&&artifact.payloadHash===sha256(artifact.payload)
    &&artifact.status==='CANDIDATE'&&same(artifact.reviews,[])&&artifact.invalidation===null,
  'Deterministic candidate v1 changed before certification');
  return record;
}

/** Quick shape predicate only.  Trust still requires assertAdaptiveV3ClosedEvidence. */
export function isAdaptiveV3ClosedArtifact(artifact){
  try{
    const value=clone(artifact),payload=value?.payload;
    return Boolean(payload&&payload.kind==='deterministic-result'&&payload.nodeId===ADAPTIVE_V3_DIRECT_ENTRY_NODE
      &&payload.purpose===ADAPTIVE_V3_DIRECT_ENTRY_PURPOSE&&payload.provisional===false
      &&Array.isArray(payload.claims)&&payload.claims.length===0&&Array.isArray(payload.inputRefs)&&payload.inputRefs.length===0
      &&Array.isArray(payload.toolReceipts)&&payload.toolReceipts.length===0&&Array.isArray(payload.requiredEffects)&&payload.requiredEffects.length===0
      &&same(payload.criteria,ADAPTIVE_V3_DIRECT_CRITERIA));
  }catch{return false;}
}

/** Recompute a candidate payload from immutable mission@1, route and origin. */
function assertAdaptiveV3ClosedPayloadInternal(registry,payload,{current=true,allowExisting=false}={}){
  integrity(registry?.store&&registry?.authority,'Deterministic payload assertion requires registry, store and authority');
  const candidate=exactPayload(payload),missionId=candidate.missionId,proof=assertOrigin(registry,missionId,{current});
  integrity(candidate.producerRunId===proof.run.id,'Deterministic payload belongs to a different producer');
  integrity(same(candidate,expectedPayload({mission:proof.mission.data,run:proof.run.data,output:proof.output})),
    'Deterministic payload differs from fresh origin recomputation');
  const artifacts=registry.store.list('artifact').filter(record=>record.data.missionId===missionId);
  integrity(artifacts.length<=1&&artifacts.every(record=>record.data.payload.producerRunId===proof.run.id),
    'Deterministic producer or mission has more than one candidate');
  if(artifacts.length){
    integrity(allowExisting&&same(artifacts[0].data.payload,candidate),
      'Deterministic producer already has a candidate; no second materialization is allowed');
  }
  return {...proof,payload:candidate};
}

/** Recompute a candidate payload from immutable mission@1, route and origin. */
export function assertAdaptiveV3ClosedPayload(registry,payload,{current=true}={}){
  return assertAdaptiveV3ClosedPayloadInternal(registry,payload,{current,allowExisting:false});
}

function certificatePayload({proof,candidate}){
  return {schema:ADAPTIVE_V3_DIRECT_CERTIFICATION_SCHEMA,revision:ADAPTIVE_V3_DIRECT_ENTRY_REVISION,
    mission:ref(proof.mission),route:ref(proof.route),origin:ref(proof.originRecord),run:ref(proof.run),candidate:ref(candidate),
    candidatePayloadHash:candidate.data.payloadHash,criteriaHash:sha256(ADAPTIVE_V3_DIRECT_CRITERIA),decisionHash:proof.facts.decision.decisionHash,
    preflightHash:sha256(proof.facts.preflight),outputHash:proof.output.outputHash,bodyHash:proof.output.bodyHash,
    certification:clone(DIRECT_CERTIFICATION)};
}

function exactCertificatePayload(value){
  const data=stable(value,'adaptive-v3 deterministic certification');exactKeys(data,CERTIFICATION_FIELDS,'adaptive-v3 deterministic certification');
  integrity(data.schema===ADAPTIVE_V3_DIRECT_CERTIFICATION_SCHEMA&&data.revision===ADAPTIVE_V3_DIRECT_ENTRY_REVISION,
    'Deterministic certification schema or revision changed');
  exactRef(data.mission,{type:'mission',version:1},'deterministic certification mission');
  exactRef(data.route,{type:ADAPTIVE_V3_ROUTE_RECORD_TYPE,version:1},'deterministic certification route');
  exactRef(data.origin,{type:ADAPTIVE_V3_DIRECT_ORIGIN_TYPE,version:1},'deterministic certification origin');
  exactRef(data.run,{type:'run',version:1},'deterministic certification run');
  exactRef(data.candidate,{type:'artifact',version:1},'deterministic certification candidate');
  for(const [field,label] of [['candidatePayloadHash','candidate'],['criteriaHash','criteria'],['decisionHash','route decision'],['preflightHash','preflight'],['outputHash','output'],['bodyHash','body']])
    digest(data[field],`deterministic certification ${label} hash`);
  exactKeys(data.certification,CERTIFICATION_DECLARATION_FIELDS,'deterministic certification declaration');
  integrity(same(data.certification,DIRECT_CERTIFICATION),'Deterministic certification cannot claim model or semantic review authority');
  return data;
}

function signedCertification(registry,artifactId){
  const {store,authority}=registry,record=store.get(ADAPTIVE_V3_DIRECT_CERTIFICATION_TYPE,artifactId);
  integrity(record?.version===1,'Deterministic certification is missing or re-versioned');
  exactKeys(record.data,['signed'],'deterministic certification envelope');
  let data;try{data=authority.open(record.data.signed,ADAPTIVE_V3_DIRECT_CERTIFICATION_KIND);}catch(error){
    integrity(false,'Deterministic certification is unsigned or has an invalid signature',{cause:error?.code??'UNKNOWN'});
  }
  return {record,data:exactCertificatePayload(data)};
}

/**
 * Validate an accepted deterministic direct result without pretending that a
 * model reviewed it.  The caller can use this at every downstream trust edge.
 */
export function assertAdaptiveV3ClosedEvidence(registry,artifactId,{current=true}={}){
  integrity(registry?.store&&registry?.authority,'Deterministic evidence assertion requires registry, store and authority');identifier(artifactId,'deterministic artifact id');
  const {store}=registry,candidate=candidateV1(store,artifactId),payloadProof=assertAdaptiveV3ClosedPayloadInternal(registry,candidate.data.payload,{current,allowExisting:true});
  const proof=payloadProof,certification=signedCertification(registry,artifactId),cert=certification.data;
  const expected=certificatePayload({proof,candidate});
  integrity(same(cert,expected),'Deterministic certification differs from the exact candidate/origin recomputation');
  const certMission=exactHistoricalRecord(store,cert.mission,{type:'mission',id:proof.mission.id,version:1},'deterministic certification mission');
  const certRoute=exactRecord(store,cert.route,{type:ADAPTIVE_V3_ROUTE_RECORD_TYPE,id:proof.mission.id,version:1},'deterministic certification route');
  const certOrigin=exactRecord(store,cert.origin,{type:ADAPTIVE_V3_DIRECT_ORIGIN_TYPE,id:proof.mission.id,version:1},'deterministic certification origin');
  const certRun=exactRecord(store,cert.run,{type:'run',id:proof.run.id,version:1},'deterministic certification run');
  const candidateReference=exactRef(cert.candidate,{type:'artifact',id:artifactId,version:1},'deterministic certification candidate');
  const certCandidate=store.get(candidateReference.type,candidateReference.id,candidateReference.version);
  integrity(certCandidate&&certCandidate.hash===candidateReference.hash,'Deterministic certification candidate history is missing or changed');
  integrity(certMission.hash===proof.mission.hash&&certRoute.hash===proof.route.hash&&certOrigin.hash===proof.originRecord.hash
    &&certRun.hash===proof.run.hash&&certCandidate.hash===candidate.hash,'Deterministic certification reference hash changed');
  const expectedAccepted={...clone(candidate.data),status:'ACCEPTED',reviews:[],reviewDependencies:[],deterministicCertification:ref(certification.record)};
  const accepted=store.get('artifact',artifactId);
  integrity(accepted?.version===2&&same(accepted.data,expectedAccepted),'Deterministic candidate acceptance is not the exact certification transition');
  integrity(!store.list('review').some(record=>record.data.artifactId===artifactId),
    'Deterministic certification cannot coexist with an ordinary review');
  assertNoDirectWork(store,proof.mission.id,{runId:proof.run.id,artifactId,current});
  const order={...proof.order,candidate:sequence(registry,candidate,'deterministic candidate'),certification:sequence(registry,certification.record,'deterministic certification'),accepted:sequence(registry,accepted,'deterministic acceptance')};
  integrity(order.origin<order.candidate&&order.candidate<order.certification&&order.certification<order.accepted,
    'Deterministic candidate/certification journal order is invalid');
  return {artifact:accepted.data,candidate:candidate.data,certification:{record:ref(certification.record),data:cert},
    origin:{record:ref(proof.originRecord),data:clone(proof.origin)},output:clone(proof.output),route:ref(proof.route),order,
    scope:'Deterministic recomputation only: provider none; semantic review none; this certificate is not a model review or a factual-truth judgment.'};
}
