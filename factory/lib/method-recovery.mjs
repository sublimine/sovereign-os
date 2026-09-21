import {canonical,check,clone,integer,keys,sha256} from './contracts.mjs';
import {blindStage} from './blind-plan.mjs';
import {isInputCopyNode} from './input-copy-contract.mjs';
import {producerResponseContract,PRODUCER_RESPONSE_RETENTION} from './producer-response.mjs';

export const METHOD_RECOVERY_MODE='reviewed-method-v1';
export const METHOD_RECOVERY_CRITERION=Object.freeze({id:'recovery-method',text:'The proposed changed method causally addresses EACH recorded material rejection, using the exact historical diagnosis rather than accepting the rejected content as truth. Compare previous and proposed instructions, dependencies and role methods. A cosmetic rename, paraphrase or a new vote is not a changed approach. Preserve every frozen obligation and already accepted product. Return unresolved or unsupported changes.'});
const ROUND='method-recovery-round',DONE='method-recovery-completion',BINDING='method-recovery-candidate';
const ref=r=>({type:r.type,id:r.id,version:r.version,hash:r.hash});
const integrity=(ok,message)=>check(ok,'METHOD_RECOVERY_INTEGRITY',message);
const same=(a,b)=>canonical(a)===canonical(b);
const normalized=s=>s.normalize('NFC').replace(/\s+/gu,' ').trim();
export function methodRecoveryPolicy(value){
  keys(value,['mode','maxRounds']);check(value.mode===METHOD_RECOVERY_MODE,'POLICY','Unknown method-recovery protocol');
  integer(value.maxRounds,'method recovery rounds',{min:1,max:100});return clone(value);
}
function original(store,r){
  integrity(r&&typeof r.type==='string','Missing method-recovery reference');
  const found=store.get(r.type,r.id,r.version);integrity(found?.hash===r.hash,'Method-recovery historical reference changed');return found;
}
function rounds(store,missionId){return store.list(ROUND).filter(r=>r.data.missionId===missionId).sort((a,b)=>a.data.round-b.data.round);}
function readRound(store,record){
  integrity(record?.version===1&&record.data.schema==='sovereign.method-recovery-round.v1','Method-recovery origin is not immutable');
  integrity(same(ref(store.get(ROUND,record.id)),ref(record)),'Method-recovery origin head changed');
  const d=record.data,m=store.get('mission',d.missionId)?.data;
  integrity(m&&m.intentHash===sha256(m.intent)&&m.intentHash===d.intentHash&&sha256(m.policy)===d.policyHash,'Method recovery mandate changed');
  const p=original(store,d.parentPlan);integrity(p.id===m.id&&same(p.data.plan,d.previousPlan),'Recovery parent plan changed');
  for(const f of d.failures){
    integrity(same(original(store,f.nodeRecord).data,f.node)&&same(original(store,f.artifactRecord).data,f.artifact)
      &&same(original(store,f.reviewRecord).data,f.review),'Recovery diagnosis differs from its recorded evidence');
  }
  for(const a of d.acceptedInputs){original(store,a.nodeRecord);original(store,a.artifactRecord);original(store,a.reviewRecord);}
  return record;
}
export function activeMethodRecovery(store,missionId){
  const records=rounds(store,missionId);let active=null;
  for(let i=0;i<records.length;i++){
    const r=readRound(store,records[i]);integrity(r.data.round===i+1,'Method recovery sequence has a gap');
    const done=store.get(DONE,r.id);
    if(done){integrity(done.version===1&&same(done.data.origin,ref(r)),'Method recovery completion changed');original(store,done.data.replacementPlan);}
    else{integrity(!active&&i===records.length-1,'Multiple unresolved method revisions');active=r;}
  }
  if(active)assertCurrent(store,active);
  return active;
}
function assertCurrent(store,round){
  const d=round.data;integrity(same(ref(store.get('plan',d.missionId)),d.parentPlan),'The active method revision targets a different plan');
  for(const f of d.failures)integrity(same(ref(store.get('node',f.nodeRecord.id)),f.nodeRecord),'Rejected node changed during method revision');
}
/** Only genuine material RETURNs activate this opt-in. No quota, malformed
 * review, uncertain effect, changed operator acceptance or extra tool grant. */
export function beginMethodRecovery(engine,mission,exhausted){
  const policy=mission.policy.methodRecovery;if(!policy)return null;methodRecoveryPolicy(policy);
  const {store,registry,ledger}=engine;ledger.assertEngine();
  return store.transact(()=>{
    const active=activeMethodRecovery(store,mission.id);if(active)return active;
    const previous=rounds(store,mission.id);if(previous.length>=policy.maxRounds)return null;
    const plan=store.get('plan',mission.id);if(!plan)return null;
    if(mission.policy.documentContext||plan.data.plan.nodes.some(n=>blindStage(n)||isInputCopyNode(n)))return null;
    registry.assertUsable(plan.data.acceptedPlanArtifactId,{missionId:mission.id,purpose:'plan'});
    check(!store.list('effect').some(e=>e.data.missionId===mission.id&&['DISPATCHED','UNCERTAIN'].includes(e.data.state)),
      'EFFECT_UNCERTAIN','Method revision cannot bypass an unresolved operation');
    const failures=[];
    for(const node of exhausted){
      const n=store.get('node',`${mission.id}:${node.nodeId}`),last=n?.data.history.at(-1),a=store.get('artifact',n?.data.artifactId??'missing');
      if(n?.data.status!=='RETURNED'||!last?.detail?.reviewId||a?.data.status!=='RETURNED')continue;
      const r=store.get('review',last.detail.reviewId);
      if(r?.data.result.decision!=='RETURN'||!r.data.result.findings.some(f=>f.severity==='material'))continue;
      integrity(a.data.missionId===mission.id&&a.data.payload.nodeId===node.nodeId&&a.data.reviews.at(-1)===r.id
        &&r.data.artifactId===a.id&&r.data.result.artifactHash===a.data.payloadHash,'Rejected candidate/review binding changed');
      failures.push({nodeRecord:ref(n),node:clone(n.data),artifactRecord:ref(a),artifact:clone(a.data),reviewRecord:ref(r),review:clone(r.data)});
    }
    if(!failures.length)return null;
    const acceptedNodes=[],acceptedInputs=[];
    for(const n of plan.data.plan.nodes){const record=store.get('node',`${mission.id}:${n.id}`);
      check(!['RUNNING','REVIEW_PENDING'].includes(record.data.status),'NODE_RUNNING','Drain active work before revising methods');
      if(record.data.status==='ACCEPTED'){
        const a=ledger.assertProduct(record.data);acceptedNodes.push(n.id);
        acceptedInputs.push({nodeRecord:ref(record),artifactRecord:ref(store.get('artifact',a.id)),reviewRecord:ref(store.get('review',a.reviews.at(-1)))});
      }
    }
    const round=previous.length+1;
    const record=store.put(ROUND,`${mission.id}:${round}`,{schema:'sovereign.method-recovery-round.v1',missionId:mission.id,round,
      intentHash:mission.intentHash,policyHash:sha256(mission.policy),parentPlan:ref(plan),previousPlan:clone(plan.data.plan),failures,acceptedNodes,acceptedInputs,
      createdAt:engine.clock(),scope:'Historical rejected products and reviews are diagnostic data, not accepted premises or new authority. Preserve every requirement, node acceptance boundary and accepted node. Separate plan review must judge a substantive changed method.'},{expectedVersion:0});
    engine.emit('method.recovery.required',{missionId:mission.id,round,origin:ref(record),nodeIds:failures.map(f=>f.node.nodeId)});return record;
  });
}
export function methodRecoveryContext(round){return round?{origin:ref(round),...clone(round.data)}:null;}
export function assertMethodRecoveryInputs(registry,round){
  if(!round)return;const store=registry.store;readRound(store,round);assertCurrent(store,round);
  const d=round.data;
  try{
    const p=original(store,d.parentPlan);registry.assertUsable(p.data.acceptedPlanArtifactId,{missionId:d.missionId,purpose:'plan'});
    for(const a of d.acceptedInputs){
      check(same(ref(store.get('node',a.nodeRecord.id)),a.nodeRecord),'METHOD_RECOVERY_STALE','Accepted node changed during method revision');
      const prior=original(store,a.artifactRecord).data;
      registry.assertUsable(prior.id,{missionId:d.missionId,purpose:prior.payload.purpose});
      check(same(ref(store.get('artifact',a.artifactRecord.id)),a.artifactRecord),'METHOD_RECOVERY_STALE','Accepted product changed during method revision');
    }
  }catch(error){
    if(error.code?.startsWith('STORAGE')||error.code==='METHOD_RECOVERY_INTEGRITY')throw error;
    check(false,'METHOD_RECOVERY_STALE','Previously accepted plan or product is no longer the exact usable basis of this revision; reconcile its withdrawal before new work');
  }
}
export function validateMethodRevision(plan,round){
  if(!round)return;const d=round.data;
  check(same(plan.requirements,d.previousPlan.requirements),'MANDATE_DRIFT','Method revision preserves every exact requirement');
  for(const old of d.previousPlan.nodes){
    const n=plan.nodes.find(n=>n.id===old.id);check(n,'METHOD_RECOVERY_SCOPE','Method revision cannot retire an existing product boundary');
    for(const key of ['id','purpose','outputKind','requirementIds','criteria','requiredEffects','execution'])
      check(same(n[key]??null,old[key]??null),'MANDATE_DRIFT',`Method revision changed frozen node obligation ${old.id}.${key}`);
    if(d.acceptedNodes.includes(old.id))check(same(n,old),'METHOD_RECOVERY_SCOPE','Do not replay or rewrite an accepted node');
  }
  for(const f of d.failures){
    const n=plan.nodes.find(n=>n.id===f.node.nodeId),old=f.node.spec;
    check(normalized(n.instructions)!==normalized(old.instructions),'METHOD_UNCHANGED','A new method requires changed executable instructions, not titles, IDs, rationale or whitespace');
    check(normalized(n.method.rationale)!==normalized(old.method.rationale),'METHOD_UNCHANGED','Explain the causal change from the specifically rejected approach');
  }
}
export function bindMethodRecoveryCandidate(store,round,artifact){
  if(!round)return;readRound(store,round);assertCurrent(store,round);validateMethodRevision(JSON.parse(artifact.payload.body),round);
  const data={origin:ref(round),artifactId:artifact.id,artifactHash:artifact.payloadHash};
  const old=store.get(BINDING,artifact.id);
  if(old){integrity(old.version===1&&same(old.data,data),'Method revision candidate binding changed');return;}
  store.put(BINDING,artifact.id,data,{expectedVersion:0});
}
export function methodRecoveryReviewContext(store,artifact){
  const binding=store.get(BINDING,artifact.id);if(!binding){
    integrity(!artifact.payload.criteria.some(c=>same(c,METHOD_RECOVERY_CRITERION)),'Method criterion has no prospective recovery binding');return null;
  }
  integrity(binding.version===1&&binding.data.artifactId===artifact.id&&binding.data.artifactHash===artifact.payloadHash,
    'Method revision review candidate changed');
  const round=readRound(store,original(store,binding.data.origin));
  integrity(artifact.missionId===round.data.missionId&&artifact.payload.nodeId==='planning'&&artifact.payload.kind==='mission-plan'
    &&artifact.payload.criteria.some(c=>same(c,METHOD_RECOVERY_CRITERION)),'Method revision lacks its independent change criterion');
  validateMethodRevision(JSON.parse(artifact.payload.body),round);return methodRecoveryContext(round);
}
/** Called inside the same transaction as install + planning checkpoint. */
export function completeMethodRecovery(store,round){
  if(!round)return;readRound(store,round);
  const replacement=store.get('plan',round.data.missionId);validateMethodRevision(replacement.data.plan,round);
  integrity(replacement.hash!==round.data.parentPlan.hash,'Method revision was not installed');
  const artifact=store.get('artifact',replacement.data.acceptedPlanArtifactId)?.data;
  integrity(artifact?.status==='ACCEPTED','Method revision requires independent plan acceptance');methodRecoveryReviewContext(store,artifact);
  for(const a of round.data.acceptedInputs){const prior=original(store,a.nodeRecord).data,current=store.get('node',a.nodeRecord.id)?.data;
    integrity(current?.status==='ACCEPTED'&&current.artifactId===prior.artifactId,'Method revision did not preserve an accepted product');}
  return store.put(DONE,round.id,{origin:ref(round),replacementPlan:ref(replacement),completedAt:store.clock(),
    failures:round.data.failures.map(f=>({nodeId:f.node.nodeId,historyPrefix:f.node.history,
      newSpecHash:sha256(replacement.data.plan.nodes.find(n=>n.id===f.node.nodeId))}))},{expectedVersion:0});
}
/** A reviewed new method has its own original per-node allowance. History,
 * absolute attempts, round ceiling and mission-wide call reservations remain. */
export function methodFailureHistory(store,missionId,node){
  if(!store.get('mission',missionId)?.data.policy?.methodRecovery)return node.history;
  const plan=store.get('plan',missionId);let start=0;
  for(const r of rounds(store,missionId)){
    readRound(store,r);const done=store.get(DONE,r.id);if(!done)continue;
    integrity(done.version===1&&same(done.data.origin,ref(r)),'Method completion changed');
    if(!same(done.data.replacementPlan,ref(plan)))continue;
    const f=done.data.failures.find(f=>f.nodeId===node.nodeId);if(!f)continue;
    integrity(f.newSpecHash===sha256(node.spec)&&same(node.history.slice(0,f.historyPrefix.length),f.historyPrefix),'Method allowance lost its exact history or specification');
    start=Math.max(start,f.historyPrefix.length);
  }
  return node.history.slice(start);
}
export function methodRecoveryReport(store,missionId){
  const policy=store.get('mission',missionId)?.data.policy?.methodRecovery;if(!policy)return null;
  methodRecoveryPolicy(policy);const records=rounds(store,missionId);
  return {mode:policy.mode,maxRounds:policy.maxRounds,reservedRounds:records.length,remainingRounds:Math.max(0,policy.maxRounds-records.length),
    scope:'Recorded method-revision decisions, not semantic improvement certification or fresh validation of current external state. No inference budget is replenished.',
    rounds:records.map(record=>{
      const r=readRound(store,record),done=store.get(DONE,r.id);
      if(done)integrity(done.version===1&&same(done.data.origin,ref(r)),'Method completion changed');
      const replacement=done?original(store,done.data.replacementPlan):null;
      return {origin:ref(r),round:r.data.round,status:done?'INSTALLED_HISTORICALLY':'PENDING',parentPlan:r.data.parentPlan,
        replacementPlan:done?.data.replacementPlan??null,acceptedNodesPreserved:r.data.acceptedNodes,
        failures:r.data.failures.map(f=>({nodeId:f.node.nodeId,artifact:f.artifactRecord,review:f.reviewRecord,
          findings:clone(f.review.result.findings),previousMethod:clone(f.node.spec.method),
          replacementMethod:clone(replacement?.data.plan.nodes.find(n=>n.id===f.node.nodeId)?.method??null)}))};
    })};
}
/** A separately authorized execution epoch, NEVER a rewrite of the original
 * node's first-attempt history. Only the exact revised producer contract may
 * use it; earlier attempts and explicit whole-history obligations stay visible. */
export function methodRecoveryGateBoundary(registry,artifact){
  const {store}=registry,a=artifact;
  if(!store.get('mission',a.missionId)?.data.policy?.methodRecovery||a.payload.nodeId==='planning')return null;
  const producer=store.get('run',a.payload.producerRunId,1),producerSequence=registry.committedSequence('run',a.payload.producerRunId,1);
  const matches=[];
  for(const done of store.list(DONE)){
    const sequence=registry.committedSequence(DONE,done.id,1);
    if(!sequence||sequence>=producerSequence)continue;
    const raw=store.get(ROUND,done.data.origin?.id??'missing',1);if(raw?.data.missionId!==a.missionId)continue;
    const installed=original(store,done.data.replacementPlan),planArtifact=store.get('artifact',installed.data.acceptedPlanArtifactId,1)?.data;
    if(!planArtifact||!a.payload.inputRefs.some(r=>r.artifactId===planArtifact.id&&r.hash===planArtifact.payloadHash&&r.purpose==='plan'))continue;
    const target=done.data.failures.find(f=>f.nodeId===a.payload.nodeId);if(!target)continue;
    integrity(done.version===1,'Method execution epoch completion was altered');
    const round=readRound(store,original(store,done.data.origin)),node=installed.data.plan.nodes.find(n=>n.id===a.payload.nodeId);
    integrity(node&&target.newSpecHash===sha256(node)&&round.data.failures.some(f=>f.node.nodeId===node.id&&same(f.node.history,target.historyPrefix)),
      'Method execution epoch changed the authorized target/history');
    validateMethodRevision(installed.data.plan,round);methodRecoveryReviewContext(store,planArtifact);
    const origin=store.get('worker-production',producer.id,1);
    integrity(producer.data.mode==='producer'&&producer.data.missionId===a.missionId&&producer.data.nodeId===node.id
      &&producer.data.context.artifactIds.includes(planArtifact.id)&&origin?.data.responseRetention===PRODUCER_RESPONSE_RETENTION
      &&origin.data.contractHash===producerResponseContract({missionId:a.missionId,node,inputRefs:a.payload.inputRefs}),
      'Method epoch requires a new actor with the exact revised production contract and plan exposure');
    integrity(registry.committedSequence('plan',installed.id,installed.version)<sequence&&sequence<producerSequence,
      'Method epoch was not installed and completed before its producer');
    matches.push({origin:ref(round),completion:ref(done),installedPlan:ref(installed),planArtifactId:planArtifact.id,
      nodeSpecHash:sha256(node),afterSequence:sequence,
      scope:'Acceptance before the first attempt under this exact independently reviewed method revision only. Original node-first-attempt history remains separate and unchanged; this cannot satisfy a requirement applying to every earlier attempt.'});
  }
  integrity(matches.length<=1,'Ambiguous method execution epoch');return matches[0]??null;
}
