// A sourced-route progress card is intentionally much narrower than the
// durable controller ledger.  It answers only a small set of browser-safe
// operational questions: which fixed stage is active, how much of the sealed
// acquisition allowance has been reserved, whether an independent judgment is
// pending/recorded, whether a final source anchor lineage revalidates, and
// whether the text-delivery boundary is currently readable.  It never copies
// source URLs/bodies/quotes, provider prompts, worker messages, actor IDs,
// operation IDs, review prose, or private controller diagnostics.
import {canonical,check,digest,identifier,instant,integer,keys,list,sha256,string,unique} from './contracts.mjs';
import {assertGenuineArtifactRegistry} from './artifacts.mjs';
import {assertMissionAdmissionFrozen} from './mission-policy-freeze.mjs';
import {inspectPublicLifecycle} from './mission-public-projection.mjs';
import {readPublicSourceProvenance} from './public-source-provenance.mjs';
import {readPublicTextDelivery} from './public-text-delivery.mjs';
import {SOURCED_RESPONSE_MODE,SOURCED_RESPONSE_CONTRACT,
  SOURCED_RESPONSE_ACQUISITION_V2,SOURCED_RESPONSE_DEFER_ONLY_FALLBACK,SOURCED_RESPONSE_LIMITS,SOURCED_RESPONSE_NODE,
  SOURCED_RESPONSE_PURPOSE,SOURCED_RESPONSE_REVIEWERS,sourcedResponseContractHash,
  sourcedResponseAcquisition,sourcedResponseDeferOnly,sourcedResponseNode} from './sourced-response-spec.mjs';
import {assertSourcedResponseCandidate,assertSourcedResponseExposure,assertSourcedResponseMission,
  isSourcedResponseReviewer,makeSourcedResponseBinding} from './sourced-response-contract.mjs';

export const PUBLIC_SOURCED_ROUTE_PROGRESS_SCHEMA='sovereign.sourced-route-progress.v1';
export const PUBLIC_SOURCED_ROUTE_PROGRESS_REVISION=1;
export const PUBLIC_SOURCED_ROUTE_PROGRESS_PHASES=Object.freeze([
  'ADMITTED','ACQUIRING','CANDIDATE_PENDING_REVIEW','ACCEPTED','ESCALATED','UNVERIFIED'
]);
export const PUBLIC_SOURCED_ROUTE_REVIEW_STATES=Object.freeze([
  'NOT_STARTED','PENDING','ACCEPTED','RETURNED','UNVERIFIED'
]);
export const PUBLIC_SOURCED_ROUTE_DELIVERY_AVAILABILITY=Object.freeze([
  'AVAILABLE','NOT_AVAILABLE','UNVERIFIED'
]);

const progressStatuses=new Set(['PRODUCING','REVIEW_PENDING','ACCEPTED','FALLBACK']);
const effectStates=new Set(['PREPARED','DISPATCHED','SUCCEEDED','FAILED','UNCERTAIN']);
const progressKeys=['version','missionId','intentHash','policyHash','contractHash','status','runId','runIds',
  'productionAttempts','roleIds','controllerContract','reviewerRoleIds','criteria','artifactId','createdAt',
  'sourcedFallback','disposition','completedAt','artifactHash','reviewId'];

const same=(left,right)=>canonical(left)===canonical(right);
const sourceRouteMarked=mission=>mission?.policy?.entryMode===SOURCED_RESPONSE_MODE;
const sealedDiscovery=limits=>limits?.schema==='sublimine.sealed-source-acquisition.v1'?'SEALED_DISABLED':null;

// Keep the fallback fixed-size and semantic-free.  In particular, a malformed
// internal row cannot smuggle a diagnostic, source URL, result body or provider
// message into a browser by causing progress validation to fail.
const publicProgress=({integrity='UNVERIFIED',phase='UNVERIFIED',searchUsed=0,fetchUsed=0,
  reviewState='UNVERIFIED',verifiedSourceAnchorCount=0,deliveryAvailability='UNVERIFIED',limits=SOURCED_RESPONSE_LIMITS}={})=>Object.freeze({
  schema:PUBLIC_SOURCED_ROUTE_PROGRESS_SCHEMA,
  revision:PUBLIC_SOURCED_ROUTE_PROGRESS_REVISION,
  integrity,
  phase,
  acquisition:Object.freeze({
    search:Object.freeze({used:searchUsed,limit:limits.maxSearchIntents}),
    fetch:Object.freeze({used:fetchUsed,limit:limits.maxFetchIntents}),
    maxSourceBytes:limits.maxSourceBytes,
    ...(sealedDiscovery(limits)?{discovery:sealedDiscovery(limits)}:{})
  }),
  independentReview:Object.freeze({required:true,state:reviewState}),
  verifiedSourceAnchorCount,
  delivery:Object.freeze({availability:deliveryAvailability})
});

const unverified=(limits=SOURCED_RESPONSE_LIMITS)=>publicProgress({limits});
const notAvailable=(phase,searchUsed,fetchUsed,reviewState,limits)=>publicProgress({integrity:'VERIFIED',phase,
  searchUsed,fetchUsed,reviewState,verifiedSourceAnchorCount:0,deliveryAvailability:'NOT_AVAILABLE',limits});
const markerLimits=mission=>mission?.policy?.sourcedAcquisition===undefined
  ?SOURCED_RESPONSE_LIMITS:sourcedResponseAcquisition(mission);

function hasSourcedRouteMarker(store,missionId){
  const current=store.get('mission',missionId)?.data,origin=store.get('mission',missionId,1)?.data;
  return sourceRouteMarked(current)||sourceRouteMarked(origin)
    ||Boolean(store.get('sourced-response-entry',missionId)?.version)
    ||Boolean(store.get('sourced-response-contract',missionId)?.version);
}

function checkProgressShape(data,mission,{origin=false}={}){
  keys(data,progressKeys,['version','missionId','intentHash','policyHash','contractHash','status','runId','runIds',
    'productionAttempts','roleIds','controllerContract','reviewerRoleIds','criteria','artifactId','createdAt'],'sourced route progress');
  check(data.version===SOURCED_RESPONSE_MODE&&data.missionId===mission.id&&data.intentHash===mission.intentHash
    &&data.policyHash===sha256(mission.policy)&&data.contractHash===sourcedResponseContractHash(mission),
  'SOURCED_PROGRESS_INTEGRITY','Sourced route progress is not bound to its frozen mission');
  check(progressStatuses.has(data.status),'SOURCED_PROGRESS_INTEGRITY','Unknown sourced-route stage');
  identifier(data.runId,'sourced progress current run');
  list(data.runIds,'sourced progress runs',{min:1,max:1000});data.runIds.forEach(value=>identifier(value,'sourced progress run'));
  unique(data.runIds,'sourced progress runs');
  integer(data.productionAttempts,'sourced production attempts',{min:1,max:1000});
  check(data.productionAttempts===data.runIds.length&&data.runIds.at(-1)===data.runId,
    'SOURCED_PROGRESS_INTEGRITY','Sourced progress attempt history changed');
  list(data.roleIds,'sourced progress roles',{max:0});
  check(data.controllerContract===SOURCED_RESPONSE_CONTRACT&&same(data.reviewerRoleIds,SOURCED_RESPONSE_REVIEWERS)
    &&same(data.criteria,sourcedResponseNode(mission).criteria),'SOURCED_PROGRESS_INTEGRITY',
  'Sourced progress role or review contract changed');
  check(data.artifactId===null||typeof data.artifactId==='string','SOURCED_PROGRESS_INTEGRITY','Invalid sourced candidate pointer');
  if(data.artifactId!==null)identifier(data.artifactId,'sourced candidate pointer');
  instant(data.createdAt,'sourced progress creation time');
  const deferOnly=sourcedResponseDeferOnly(mission);
  if(deferOnly)check(data.sourcedFallback===SOURCED_RESPONSE_DEFER_ONLY_FALLBACK,
    'SOURCED_PROGRESS_INTEGRITY','Sourced progress removed its sealed escalation policy');
  else check(!Object.hasOwn(data,'sourcedFallback'),'SOURCED_PROGRESS_INTEGRITY',
    'Legacy sourced progress acquired an unadmitted escalation policy');
  if(Object.hasOwn(data,'artifactHash'))digest(data.artifactHash,'sourced candidate hash');
  if(Object.hasOwn(data,'reviewId'))identifier(data.reviewId,'sourced progress review');
  if(Object.hasOwn(data,'completedAt'))instant(data.completedAt,'sourced progress completion time');
  if(Object.hasOwn(data,'disposition')){
    keys(data.disposition,['code','phase','artifactId','reviewId','status'],['code'],'sourced route disposition');
    string(data.disposition.code,'sourced route disposition code',{max:160});
    check(/^[A-Z_][A-Z0-9_]*$/.test(data.disposition.code),'SOURCED_PROGRESS_INTEGRITY',
      'Invalid sourced route disposition code');
    if(Object.hasOwn(data.disposition,'phase'))string(data.disposition.phase,'sourced route disposition phase',{max:160});
    if(Object.hasOwn(data.disposition,'artifactId'))identifier(data.disposition.artifactId,'sourced disposition artifact');
    if(Object.hasOwn(data.disposition,'reviewId'))identifier(data.disposition.reviewId,'sourced disposition review');
    if(Object.hasOwn(data.disposition,'status'))string(data.disposition.status,'sourced disposition status',{max:80});
  }
  if(data.status==='PRODUCING')check(data.artifactId===null&&!Object.hasOwn(data,'artifactHash')
    &&!Object.hasOwn(data,'reviewId')&&!Object.hasOwn(data,'completedAt')&&!Object.hasOwn(data,'disposition'),
  'SOURCED_PROGRESS_INTEGRITY','Production stage has later-stage fields');
  if(data.status==='REVIEW_PENDING')check(typeof data.artifactId==='string'&&typeof data.artifactHash==='string'
    &&!Object.hasOwn(data,'reviewId')&&!Object.hasOwn(data,'completedAt')&&!Object.hasOwn(data,'disposition'),
  'SOURCED_PROGRESS_INTEGRITY','Review-pending stage has invalid fields');
  if(data.status==='ACCEPTED')check(typeof data.artifactId==='string'&&typeof data.artifactHash==='string'
    &&typeof data.reviewId==='string'&&typeof data.completedAt==='string'&&!Object.hasOwn(data,'disposition'),
  'SOURCED_PROGRESS_INTEGRITY','Accepted stage has invalid fields');
  if(data.status==='FALLBACK')check(Object.hasOwn(data,'disposition')&&typeof data.completedAt==='string',
    'SOURCED_PROGRESS_INTEGRITY','Escalated stage lacks its durable disposition');
  if(origin)check(data.status==='PRODUCING'&&data.artifactId===null&&data.productionAttempts===1
    &&data.runIds.length===1&&!Object.hasOwn(data,'artifactHash')&&!Object.hasOwn(data,'reviewId')
    &&!Object.hasOwn(data,'completedAt')&&!Object.hasOwn(data,'disposition'),
  'SOURCED_PROGRESS_INTEGRITY','Sourced progress version one is not an initial production binding');
  return data;
}

function checkedEntry(registry,mission){
  const {store}=registry,record=store.get('sourced-response-entry',mission.id);
  if(!record)return null;
  const origin=store.get('sourced-response-entry',mission.id,1);
  check(origin?.version===1,'SOURCED_PROGRESS_INTEGRITY','Sourced progress has no immutable initial record');
  checkProgressShape(origin.data,mission,{origin:true});
  const progress=checkProgressShape(record.data,mission);
  check(progress.runIds[0]===origin.data.runId,'SOURCED_PROGRESS_INTEGRITY',
    'Sourced progress no longer starts with its original producer');
  const contract=store.get('sourced-response-contract',mission.id);
  check(contract?.version===1&&same(contract.data,makeSourcedResponseBinding(mission)),
    'SOURCED_PROGRESS_INTEGRITY','Sourced route contract is absent or changed');
  return {record,progress,runIds:new Set(progress.runIds)};
}

function checkedRuns(registry,mission,entry,{allowPostFallbackPlan=false}={}){
  const runs=[];
  for(const runId of entry.progress.runIds){
    const record=registry.store.get('run',runId),run=record?.data;
    check(record&&run?.id===runId&&run.missionId===mission.id&&run.mode==='producer'&&run.nodeId===SOURCED_RESPONSE_NODE
      &&run.context?.purpose===SOURCED_RESPONSE_PURPOSE,'SOURCED_PROGRESS_INTEGRITY',
    'Sourced progress references a non-source producer');
    if(allowPostFallbackPlan){
      // The legacy route can legitimately continue into an ordinary plan after
      // this source stage has stopped.  `assertSourcedResponseExposure` quite
      // correctly rejects a direct actor once a plan exists, so verify the
      // immutable worker binding without pretending its later plan is still
      // part of the source route.
      const config=registry.store.get('worker-config',runId)?.data;
      check(same(config?.sourcedResponseContract,makeSourcedResponseBinding(mission)),
        'SOURCED_PROGRESS_INTEGRITY','Historic sourced producer lost its frozen contract');
    }else assertSourcedResponseExposure(registry.store,run);
    runs.push(run);
  }
  return runs;
}

function checkedEffects(registry,mission,entry,{directOnly=true}={}){
  const {store}=registry,all=store.list('effect').filter(record=>record.data?.missionId===mission.id),
    scoped=all.filter(record=>entry.runIds.has(record.data?.principalId)),effects=[],limits=sourcedResponseAcquisition(mission);
  if(directOnly)check(scoped.length===all.length,'SOURCED_PROGRESS_INTEGRITY',
    'Direct sourced route has an operation outside its sealed producer history');
  for(const record of scoped){
    const effect=record.data;
    keys(effect,['missionId','principalId','tool','argsHash','state','startedAt','receipt'],
      ['missionId','principalId','tool','argsHash','state','startedAt'],'sourced acquisition effect');
    identifier(record.id,'sourced acquisition effect ID');identifier(effect.principalId,'sourced acquisition principal');
    digest(effect.argsHash,'sourced acquisition args hash');instant(effect.startedAt,'sourced acquisition start time');
    check(entry.runIds.has(effect.principalId)&&['source.search','source.fetch'].includes(effect.tool)
      &&effectStates.has(effect.state),'SOURCED_PROGRESS_INTEGRITY',
    'Sourced progress contains an unqualified operation');
    if(['SUCCEEDED','FAILED'].includes(effect.state)){
      check(Object.hasOwn(effect,'receipt'),'SOURCED_PROGRESS_INTEGRITY','Completed sourced operation lacks its receipt');
      const receipt=registry.verifiedToolReceipt(effect.receipt);
      check(receipt.id===record.id&&receipt.missionId===mission.id&&receipt.principalId===effect.principalId
        &&receipt.tool===effect.tool&&receipt.status===effect.state,'SOURCED_PROGRESS_INTEGRITY',
      'Sourced operation receipt is not bound to its durable operation');
      if(effect.tool==='source.fetch'&&effect.state==='SUCCEEDED'){
        check(typeof receipt.result?.content==='string'&&receipt.result.sha256===sha256(receipt.result.content)
          &&Buffer.byteLength(receipt.result.content)<=limits.maxSourceBytes
          &&(limits.acceptedHttpStatus!=='2xx-only'||Number.isInteger(receipt.result.status)
            &&receipt.result.status>=200&&receipt.result.status<300),
        'SOURCED_PROGRESS_INTEGRITY','Sourced acquisition exceeds its sealed byte allowance');
      }
    }else check(!Object.hasOwn(effect,'receipt'),'SOURCED_PROGRESS_INTEGRITY',
      'Unfinished sourced operation claims a receipt');
    effects.push(effect);
  }
  // A direct source response has no other execution lane.  Once the historic
  // legacy route has escalated to normal planning, its later operations are
  // deliberately out of scope for this *source-route* card.
  const searchUsed=effects.filter(effect=>effect.tool==='source.search').length,
    fetchUsed=effects.filter(effect=>effect.tool==='source.fetch').length;
  check(searchUsed<=limits.maxSearchIntents&&fetchUsed<=limits.maxFetchIntents,
    'SOURCED_PROGRESS_INTEGRITY','Sourced operation count exceeds its sealed allowance');
  return {searchUsed,fetchUsed,hasUncertain:effects.some(effect=>effect.state==='UNCERTAIN')};
}

function assertNoDirectPlan(store,mission,{deferOnly=false}={}){
  check(!store.get('plan',mission.id)&&!store.list('node').some(record=>record.data?.missionId===mission.id),
    'SOURCED_PROGRESS_INTEGRITY','Direct sourced route contains a generated plan or node');
  if(deferOnly)check(!store.get('tool-workspace',mission.id),'SOURCED_PROGRESS_INTEGRITY',
    'Sealed source-only route contains a workspace');
}

function checkedCandidate(registry,mission,entry,{allowedStatuses}={}){
  const {store}=registry,artifactId=entry.progress.artifactId;
  check(typeof artifactId==='string'&&typeof entry.progress.artifactHash==='string','SOURCED_PROGRESS_INTEGRITY',
    'Sourced candidate binding is absent');
  const record=store.get('artifact',artifactId),artifact=record?.data;
  check(record&&artifact?.id===artifactId&&artifact.missionId===mission.id&&artifact.payloadHash===entry.progress.artifactHash
    &&allowedStatuses.includes(artifact.status),'SOURCED_PROGRESS_INTEGRITY','Sourced candidate changed stage or identity');
  const sourcedArtifacts=store.list('artifact').filter(item=>item.data?.missionId===mission.id
    &&item.data?.payload?.kind==='sourced-response');
  check(sourcedArtifacts.length===1&&sourcedArtifacts[0].id===artifactId,'SOURCED_PROGRESS_INTEGRITY',
    'Sourced route has an unexpected candidate history');
  const producer=store.get('run',entry.progress.runId)?.data;
  check(producer?.id===entry.progress.runId&&artifact.payload?.producerRunId===producer.id,
    'SOURCED_PROGRESS_INTEGRITY','Sourced candidate does not belong to the current producer');
  assertSourcedResponseCandidate(store,producer,artifact.payload);
  return artifact;
}

function assertReturnedIndependentReview(registry,artifact){
  const reviews=artifact.reviews;
  list(reviews,'sourced returned reviews',{min:1,max:8});unique(reviews,'sourced returned reviews');
  const reviewId=reviews.at(-1);identifier(reviewId,'sourced returned review');
  const review=registry.store.get('review',reviewId)?.data,run=registry.store.get('run',review?.reviewerRunId)?.data;
  check(review?.artifactId===artifact.id&&review.result?.artifactHash===artifact.payloadHash
    &&review.result?.purpose===SOURCED_RESPONSE_PURPOSE&&['RETURN','UNKNOWN'].includes(review.result?.decision)
    &&isSourcedResponseReviewer(registry.store,run),'SOURCED_PROGRESS_INTEGRITY',
  'Sourced returned candidate lacks its independent review');
}

function assertAdmittedWithoutEntry(registry,mission){
  const {store}=registry;
  check(!store.get('sourced-response-contract',mission.id)&&!store.list('run').some(record=>record.data?.missionId===mission.id)
    &&!store.list('effect').some(record=>record.data?.missionId===mission.id)
    &&!store.list('artifact').some(record=>record.data?.missionId===mission.id),
  'SOURCED_PROGRESS_INTEGRITY','Unstarted sourced route has execution residue');
  assertNoDirectPlan(store,mission,{deferOnly:sourcedResponseDeferOnly(mission)});
  check(mission.finalArtifactId===null,'SOURCED_PROGRESS_INTEGRITY','Unstarted sourced route has a final delivery claim');
}

function sourcedProgress(registry,mission){
  const lifecycle=inspectPublicLifecycle(mission);
  check(lifecycle.valid,'SOURCED_PROGRESS_INTEGRITY','Sourced mission lifecycle cannot be projected');
  check(assertSourcedResponseMission(registry.store,mission),'SOURCED_PROGRESS_INTEGRITY',
    'Sourced route marker does not have its immutable mission binding');
  const limits=sourcedResponseAcquisition(mission);
  const entry=checkedEntry(registry,mission);
  if(!entry){
    assertAdmittedWithoutEntry(registry,mission);
    return notAvailable('ADMITTED',0,0,'NOT_STARTED',limits);
  }
  const deferOnly=sourcedResponseDeferOnly(mission),fallback=entry.progress.status==='FALLBACK',
    acquisition=checkedEffects(registry,mission,entry,{directOnly:!fallback||deferOnly});
  checkedRuns(registry,mission,entry,{allowPostFallbackPlan:fallback&&!deferOnly});
  if(acquisition.hasUncertain)return unverified(limits);
  if(entry.progress.status==='PRODUCING'){
    assertNoDirectPlan(registry.store,mission,{deferOnly});
    check(mission.finalArtifactId===null,'SOURCED_PROGRESS_INTEGRITY','Producing sourced route has a final delivery claim');
    return notAvailable('ACQUIRING',acquisition.searchUsed,acquisition.fetchUsed,'NOT_STARTED',limits);
  }
  if(entry.progress.status==='REVIEW_PENDING'){
    assertNoDirectPlan(registry.store,mission,{deferOnly});
    checkedCandidate(registry,mission,entry,{allowedStatuses:['CANDIDATE']});
    check(mission.finalArtifactId===null,'SOURCED_PROGRESS_INTEGRITY','Review-pending sourced route has a final delivery claim');
    return notAvailable('CANDIDATE_PENDING_REVIEW',acquisition.searchUsed,acquisition.fetchUsed,'PENDING',limits);
  }
  if(entry.progress.status==='ACCEPTED'){
    assertNoDirectPlan(registry.store,mission,{deferOnly});
    const artifact=checkedCandidate(registry,mission,entry,{allowedStatuses:['ACCEPTED']});
    check(mission.status==='COMPLETED'&&mission.finalArtifactId===artifact.id&&entry.progress.reviewId===artifact.reviews.at(-1),
      'SOURCED_PROGRESS_INTEGRITY','Accepted sourced route has no matching terminal delivery');
    const accepted=registry.assertUsable(artifact.id,{missionId:mission.id,purpose:SOURCED_RESPONSE_PURPOSE});
    check(accepted.id===artifact.id&&accepted.payloadHash===artifact.payloadHash,'SOURCED_PROGRESS_INTEGRITY',
      'Accepted sourced product changed during progress verification');
    const provenance=readPublicSourceProvenance({registry,artifact:accepted});
    check(provenance.integrity==='VERIFIED'&&provenance.sources.length>0
      &&provenance.sources.length<=limits.maxFetchIntents,
    'SOURCED_PROGRESS_INTEGRITY','Accepted sourced route lacks verified source anchors');
    const delivery=readPublicTextDelivery({registry,missionId:mission.id});
    check(delivery.status==='ACCEPTED'&&delivery.artifact?.id===artifact.id&&delivery.artifact?.payloadHash===artifact.payloadHash,
      'SOURCED_PROGRESS_INTEGRITY','Accepted sourced route lacks a verified text delivery');
    return publicProgress({integrity:'VERIFIED',phase:'ACCEPTED',searchUsed:acquisition.searchUsed,
      fetchUsed:acquisition.fetchUsed,reviewState:'ACCEPTED',verifiedSourceAnchorCount:provenance.sources.length,
      deliveryAvailability:'AVAILABLE',limits});
  }
  // FALLBACK means the source stage itself stopped.  The legacy entry may now
  // be advancing through its existing full-planning path, but this card does
  // not borrow that plan, its inputs or its later telemetry.  The sealed
  // project route additionally proves that a new planned admission is needed.
  check(entry.progress.status==='FALLBACK','SOURCED_PROGRESS_INTEGRITY','Unknown sourced route stage');
  let reviewState='NOT_STARTED';
  const legacyPlanContinuation=!deferOnly&&(Boolean(registry.store.get('plan',mission.id))
    ||registry.store.list('node').some(record=>record.data?.missionId===mission.id));
  if(entry.progress.artifactId!==null&&!legacyPlanContinuation){
    const artifact=checkedCandidate(registry,mission,entry,{allowedStatuses:['CANDIDATE','RETURNED']});
    if(artifact.status==='RETURNED'){assertReturnedIndependentReview(registry,artifact);reviewState='RETURNED';}
  }
  if(deferOnly){
    assertNoDirectPlan(registry.store,mission,{deferOnly:true});
    check(mission.status==='NEEDS_DIRECTION'&&mission.finalArtifactId===null&&Array.isArray(mission.pending)
      &&mission.pending.length===1&&mission.pending[0]?.code==='SOURCED_ROUTE_ESCALATION_REQUIRED',
    'SOURCED_PROGRESS_INTEGRITY','Sealed sourced escalation is not in its explicit direction state');
  }
  return notAvailable('ESCALATED',acquisition.searchUsed,acquisition.fetchUsed,reviewState,limits);
}

/**
 * Project the route-specific public progress card, or `null` for a mission
 * that was never a sourced-response route.  Failure is deliberately a fixed
 * `UNVERIFIED` card when any historic/current source marker exists, so a
 * corrupted route cannot disappear from a progress UI and look ordinary.
 */
export function projectPublicSourcedRouteProgress({registry,missionId,store:markerStore}={}){
  let marked=false,unverifiedLimits=SOURCED_RESPONSE_LIMITS;
  try{
    identifier(missionId,'sourced progress mission');
    // A caller may supply the already-open Store only to preserve the fixed
    // UNVERIFIED shell when it lacks a genuine Registry capability.  It is not
    // used for any positive projection before the Registry brand check below.
    const markerSource=registry?.store??markerStore;
    if(markerSource&&typeof markerSource.get==='function')marked=hasSourcedRouteMarker(markerSource,missionId);
    assertGenuineArtifactRegistry(registry);
    marked=hasSourcedRouteMarker(registry.store,missionId);
    if(!marked)return null;
    const admission=assertMissionAdmissionFrozen(registry,missionId,{code:'SOURCED_PROGRESS_INTEGRITY'}),mission=admission.mission?.data;
    check(mission?.id===missionId,'SOURCED_PROGRESS_INTEGRITY','Sourced mission head is absent');
    unverifiedLimits=markerLimits(mission);
    return sourcedProgress(registry,mission);
  }catch{return marked?unverified(unverifiedLimits):null;}
}
