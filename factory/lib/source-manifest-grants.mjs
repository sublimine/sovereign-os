// Durable snapshot-access grants, separate from full-raw sourceIds and from
// completed inference. Control-plane integration only; no new model tool.
import {canonical,check,clone,identifier,keys,list,sha256,string,unique} from './contracts.mjs';
import {documentSourceActor,verifiedDocumentSource,verifiedAcquisitionObservation} from './source-documentary-scope.mjs';

const KIND='source-manifest-grant',SCHEMA='sovereign.source-manifest-grant.v1';
const ref=r=>({type:r.type,id:r.id,version:r.version,hash:r.hash});
function snapshot(registry,fn){const db=registry.store.db,own=!db.isTransaction;if(own)db.exec('BEGIN');try{return fn();}finally{if(own)db.exec('ROLLBACK');}}
function historical(registry,binding,type){
  keys(binding,['type','id','version','hash']);const r=registry.store.get(binding.type,binding.id,binding.version);
  check(binding.type===type&&r?.hash===binding.hash,'SOURCE_GRANT_INTEGRITY','Historical grant binding changed');return r;
}
function originBinding(registry,run,source,origin,{checkAcceptance=true}={}){
  keys(origin,['kind','artifactId'],['kind']);
  if(origin.kind==='observed-acquisition'){
    check(!Object.hasOwn(origin,'artifactId'),'SOURCE_GRANT_SCOPE','Observed acquisition cannot borrow an artifact');
    const o=verifiedAcquisitionObservation(registry,run,source);
    return {kind:origin.kind,operationId:o.id,receiptHash:o.hash,principalId:o.principalId,relation:o.relation};
  }
  check(origin.kind==='assigned-artifact','SOURCE_GRANT_SCOPE','Only an actual acquisition observation or assigned product can grant snapshot access');
  identifier(origin.artifactId);
  check(run.context.artifactIds.includes(origin.artifactId)&&!(run.forbiddenArtifactIds??[]).includes(origin.artifactId),
    'SOURCE_GRANT_SCOPE','Source origin is not an allowed assigned artifact');
  const r=registry.store.get('artifact',origin.artifactId),a=r?.data;
  check(a?.missionId===run.missionId&&a.payloadHash===sha256(a.payload)
    &&(run.mode==='producer'?a.status==='ACCEPTED':['CANDIDATE','RETURNED','ACCEPTED'].includes(a.status)),
  'SOURCE_GRANT_SCOPE','Assigned artifact is unavailable, invalidated or not an accepted producer input');
  check(a.payload.claims.some(c=>c.sources.some(s=>s.sourceId===source.id&&s.hash===source.hash)),
    'SOURCE_GRANT_SCOPE','Assigned product does not declare this exact acquired source');
  if(run.mode==='producer'&&checkAcceptance)registry.assertUsable(a.id,{missionId:run.missionId,purpose:a.payload.purpose});
  return {kind:origin.kind,artifactRecord:ref(r),payloadHash:a.payloadHash};
}
function view(record,source){
  const d=record.data;
  return {schema:'sovereign.source-manifest-grant-view.v1',grant:ref(record),runId:d.runId,missionId:d.missionId,
    source:{sourceId:source.id,sourceHash:source.hash,rawBytes:Buffer.byteLength(source.raw),url:source.url,
      httpStatus:source.httpStatus,retrievedAt:source.retrievedAt,mediaType:source.mediaType,
      acquisitionId:source.receiptId,receiptHash:source.receiptHash},
    exposure:'METADATA_ONLY_NOT_RAW_DOCUMENT',
    scope:'Permission to select bounded literal windows from this already acquired snapshot only. No network, filesystem, tool authority, full-raw sourceIds, completed reading, factual support or acceptance is granted.'};
}
export function prepareSourceManifestGrant(registry,options){
  canonical(options);keys(options,['runId','sourceId','origin']);
  return registry.store.transact(()=>{
    const runRecord=documentSourceActor(registry,options.runId),run=runRecord.data;
    check(!run.expectedRequestHash,'INFERENCE_PENDING','Cannot create a document grant during a dispatched inference');
    const source=verifiedDocumentSource(registry,options.sourceId,run.missionId),mission=registry.store.get('mission',run.missionId);
    check(mission?.data.policy,'SOURCE_GRANT_SCOPE','Frozen mission policy required');
    const binding={schema:SCHEMA,runId:run.id,missionId:run.missionId,nodeId:run.nodeId,mode:run.mode,purpose:run.context.purpose,
      policyHash:sha256(mission.data.policy),runRecord:ref(runRecord),sourceRecord:ref(source),
      origin:originBinding(registry,run,source.data,options.origin)};
    const grantId=KIND+':'+sha256(binding),old=registry.store.get(KIND,grantId);
    if(old)check(old.version===1&&canonical(old.data)===canonical(binding),'SOURCE_GRANT_INTEGRITY','Immutable manifest grant changed');
    check(!registry.store.get('source-manifest-revocation',grantId),'SOURCE_GRANT_REVOKED','Grant was explicitly revoked');
    return view(old??registry.store.put(KIND,grantId,binding,{expectedVersion:0}),source.data);
  });
}
export function readSourceManifestGrant(registry,grantId,{runId}){
  return snapshot(registry,()=>readGrant(registry,grantId,runId));
}
function readGrant(registry,grantId,runId,parents=null){
    identifier(grantId);const current=documentSourceActor(registry,runId),record=registry.store.get(KIND,grantId),d=record?.data;
    check(record?.version===1&&d.schema===SCHEMA&&record.id===KIND+':'+sha256(d),'SOURCE_GRANT_INTEGRITY','Grant is missing, changed or re-versioned');
    check(d.runId===runId&&d.missionId===current.data.missionId&&d.nodeId===current.data.nodeId&&d.mode===current.data.mode
      &&d.purpose===current.data.context.purpose&&d.policyHash===sha256(registry.store.get('mission',d.missionId)?.data.policy),
    'SOURCE_GRANT_SCOPE','Grant belongs to a different actor, purpose or policy');
    check(!registry.store.get('source-manifest-revocation',grantId),'SOURCE_GRANT_REVOKED','Grant was explicitly revoked');
    const admitted=historical(registry,d.runRecord,'run'),original=historical(registry,d.sourceRecord,'source');
    check(admitted.id===runId&&admitted.data.contextHash===sha256(admitted.data.context),'SOURCE_GRANT_INTEGRITY','Original actor binding changed');
    const source=verifiedDocumentSource(registry,original.id,d.missionId);
    check(original.data.hash===source.data.hash&&original.data.raw===source.data.raw&&original.data.receiptHash===source.data.receiptHash,
      'SOURCE_GRANT_INTEGRITY','Granted snapshot changed');
    const origin=d.origin.kind==='assigned-artifact'?{kind:d.origin.kind,artifactId:d.origin.artifactRecord.id}:{kind:d.origin.kind};
    // Both actor memberships remain mandatory. Scalar reads check their shared
    // current parent immediately. A batch defers only that obligation until
    // every member has passed, then validates each distinct parent before
    // returning. Private factors only; no cached verdict survives the call.
    const expected=originBinding(registry,admitted.data,source.data,origin,{checkAcceptance:false}),
      now=originBinding(registry,current.data,source.data,origin,{checkAcceptance:parents===null});
    if(d.origin.kind==='assigned-artifact'){
      const artifact=historical(registry,d.origin.artifactRecord,'artifact');
      check(artifact.data.payloadHash===d.origin.payloadHash&&sha256(artifact.data.payload)===d.origin.payloadHash
        &&expected.payloadHash===d.origin.payloadHash&&now.payloadHash===d.origin.payloadHash,
      'SOURCE_GRANT_INTEGRITY','Assigned source product changed');
      if(parents&&current.data.mode==='producer'){
        const obligation={artifactId:artifact.id,missionId:current.data.missionId,purpose:artifact.data.payload.purpose};
        parents.set(canonical(obligation),obligation);
      }
    }else check(canonical(expected)===canonical(d.origin)&&canonical(now)===canonical(d.origin),
      'SOURCE_GRANT_INTEGRITY','Acquisition observation changed');
    const sequence=registry.committedSequence(KIND,grantId,1);
    check(registry.committedSequence('run',admitted.id,admitted.version)<sequence
      &&registry.committedSequence('source',original.id,original.version)<sequence
      &&(d.origin.kind!=='assigned-artifact'||registry.committedSequence('artifact',d.origin.artifactRecord.id,d.origin.artifactRecord.version)<sequence),
    'SOURCE_GRANT_INTEGRITY','Grant must follow its actual actor and source admission');
    return view(record,source.data);
}
/** Validate every member and each distinct producer parent in ONE synchronous
 * snapshot. Deferred obligations are private to this call; no caller-supplied
 * authority, cache, callback, mutation or partial result. Later calls recheck.
 * Reviewers still receive assigned candidates without certifying acceptance. */
export function readSourceManifestGrants(registry,options){
  canonical(options);keys(options,['runId','grantIds']);const {runId,grantIds}=options;
  identifier(runId);list(grantIds,'document grants',{max:64});grantIds.forEach(id=>identifier(id));unique(grantIds);
  return snapshot(registry,()=>{
    if(!grantIds.length)documentSourceActor(registry,runId);
    const parents=new Map(),views=grantIds.map(id=>readGrant(registry,id,runId,parents));
    for(const {artifactId,missionId,purpose}of parents.values())registry.assertUsable(artifactId,{missionId,purpose});
    return views;
  });
}
export function revokeSourceManifestGrant(registry,grantId,{runId,reason}){
  string(reason,'grant revocation reason');
  return registry.store.transact(()=>{
    const old=registry.store.get('source-manifest-revocation',grantId);
    if(old){check(old.version===1&&old.data.runId===runId&&old.data.reason===reason,'SOURCE_GRANT_REVOKED','Revocation is already committed with a different binding');return clone(old.data);}
    const grant=readSourceManifestGrant(registry,grantId,{runId});
    const data={schema:'sovereign.source-manifest-revocation.v1',grant:grant.grant,runId,reason};
    registry.store.put('source-manifest-revocation',grantId,data,{expectedVersion:0});return clone(data);
  });
}
