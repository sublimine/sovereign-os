// A mission's submission envelope is an admission boundary, never a mutable
// reporting hint.  This module is deliberately independent of any one route
// (planning, adaptive entry, budget or native transport) so a later feature
// cannot make its own authority visible merely by omitting a route-specific
// guard.
import {canonical,check,clone,identifier,sha256} from './contracts.mjs';

// These are the only mission properties that the engine is allowed to evolve
// after submission. `createdAt` is intentionally absent: it belongs to the
// historic admission envelope, like policy selection and input-manifest
// binding. Any other field added, removed or changed in an intermediate
// version is a failed admission, even if the current head is later restored.
export const MISSION_LIFECYCLE_FIELDS=Object.freeze(['finalArtifactId','history','pending','status','updatedAt']);

const same=(left,right)=>{
  try{return canonical(left)===canonical(right);}catch{return false;}
};
const admissionEnvelope=mission=>{
  const envelope=clone(mission);
  for(const field of MISSION_LIFECYCLE_FIELDS)delete envelope[field];
  return envelope;
};

/**
 * Revalidate the complete version-one mandate and admission envelope across
 * every mission version.  A policy-only freeze is insufficient: an arbitrary
 * future field, input binding or policy-selection record could otherwise be
 * written in a transient version and become a report disclosure channel.
 */
export function assertMissionAdmissionFrozen(registry,missionId,{code='MISSION_ADMISSION_INTEGRITY',requirePolicy=false}={}){
  identifier(missionId);
  const store=registry?.store,mission=store?.get('mission',missionId),origin=store?.get('mission',missionId,1);
  check(mission?.data?.id===missionId&&origin?.version===1&&origin.data?.id===missionId,code,
    'Mission or its version-one admission is absent');
  const versions=store.db.prepare('SELECT version FROM records WHERE type=? AND id=? ORDER BY version')
    .all('mission',missionId).map(row=>row.version);
  check(versions.length>0&&versions[0]===1&&versions.at(-1)===mission.version
    &&versions.every((version,index)=>Number.isSafeInteger(version)&&version===index+1),code,
  'Mission history is missing, non-contiguous or detached from its current head');
  const validAdmission=data=>data?.id===missionId&&typeof data.intent==='string'&&typeof data.intentHash==='string'
    &&data.intentHash===sha256(data.intent)&&(!requirePolicy||data.policy!==undefined);
  const originData=origin.data;
  check(validAdmission(originData),code,'Mission version-one mandate or admission envelope is malformed');
  let frozenOrigin;try{frozenOrigin=admissionEnvelope(originData);}catch{check(false,code,'Mission version-one admission envelope is noncanonical');}
  let hasHistoricalFinalArtifactClaim=false;
  for(const version of versions){
    const record=store.get('mission',missionId,version),data=record?.data;
    let sameEnvelope=false;try{sameEnvelope=validAdmission(data)&&same(admissionEnvelope(data),frozenOrigin);}catch{}
    check(record?.version===version&&sameEnvelope,code,
      'Mission admission envelope changed outside explicitly lifecycle-only fields');
    // A final pointer is lifecycle state, so it may legitimately be cleared
    // during recovery.  Its historical presence is nevertheless a delivery
    // claim: public readers must not rediscover a retired body through old
    // reviews/nodes merely because the current head erased the pointer.
    if(data.finalArtifactId!==null&&data.finalArtifactId!==undefined)hasHistoricalFinalArtifactClaim=true;
  }
  return {mission,origin,hasHistoricalFinalArtifactClaim};
}

// Compatibility name for policy consumers. They now receive the stronger
// envelope invariant rather than a narrower policy-only comparison.
export function assertMissionPolicyFrozen(registry,missionId,{code='MISSION_POLICY_INTEGRITY'}={}){
  return assertMissionAdmissionFrozen(registry,missionId,{code,requirePolicy:true});
}
