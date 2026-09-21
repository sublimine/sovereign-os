// Read-only, whole-lineage qualification. Recorded model judgments are evidence
// of a review, not external proof of correctness; the content oracle is separate.
import {canonical,sha256} from '../../factory/lib/contracts.mjs';
import {dependencyGates} from '../../factory/lib/dependency-gates.mjs';
import {inputCopyEvidence} from '../../factory/lib/input-copy.mjs';
import {DOCUMENT_URLS,DEVELOPMENT_FILES,DEVELOPMENT_COMMAND,sourceUrlMatches} from './full-route-cases.mjs';

const ensure=(value,message)=>{if(!value)throw Object.assign(Error(message),{code:'ROUTE_AUDIT'});};
export function auditRouteTool(spec,tool,args){
  ensure(spec.allowedTools.includes(tool),'Tool outside case authority');
  if(tool==='source.fetch')ensure(Object.values(DOCUMENT_URLS).includes(args.url),'Only the two requested initial URLs');
  if(tool==='workspace.list')ensure(args.path==='.'||args.path==='','Only the mission root listing');
  if(['workspace.read','workspace.write'].includes(tool))ensure(DEVELOPMENT_FILES.includes(args.path),'Only the three requested files');
  if(tool==='execution.run')ensure(args.cwd==='.'&&canonical(args.argv)===canonical(DEVELOPMENT_COMMAND),'Only the exact requested test command');
}

export function verifiedRouteSources(engine,missionId,startedAt){
  const rows=engine.store.list('source').filter(r=>r.data.missionId===missionId).map(r=>r.data);
  for(const source of rows){
    const effect=engine.store.get('effect',source.receiptId)?.data;
    ensure(effect?.receipt,'Acquisition operation must exist');
    const receipt=engine.registry.verifiedToolReceipt(effect.receipt),result=receipt.result;
    ensure(receipt.missionId===missionId&&receipt.tool==='source.fetch'&&receipt.status==='SUCCEEDED'
      &&source.receiptHash===sha256(effect.receipt)&&source.status==='ADMITTED'&&!source.revokedAt
      &&source.hash===sha256(source.raw)&&source.hash===result.sha256&&source.raw===result.content
      &&source.url===result.finalUrl&&source.httpStatus===result.status&&result.status===200
      &&source.retrievedAt===result.retrievedAt&&Date.parse(receipt.startedAt)>=Date.parse(startedAt)
      &&Date.parse(result.retrievedAt)>=Date.parse(receipt.startedAt)&&Date.parse(result.retrievedAt)<=Date.parse(receipt.completedAt)
      &&result.httpTrace?.complete===true&&result.httpTrace.hops?.length>0
      &&Object.keys(DOCUMENT_URLS).some(name=>sourceUrlMatches(name,source.url)),
    'Exact current acquisition, primary URL, body, dates and HTTP trace required');
  }
  return rows;
}

export function auditRouteLineage(engine,missionId){
  const {store,registry}=engine,mission=store.get('mission',missionId)?.data;
  ensure(mission?.status==='COMPLETED'&&mission.finalArtifactId,'A plan or candidate is not delivery');
  const visited=new Set(),rows=[];
  const visit=artifactId=>{
    if(visited.has(artifactId))return;visited.add(artifactId);
    const stored=store.get('artifact',artifactId)?.data;
    ensure(stored,'Missing exact artifact');
    const a=registry.assertUsable(artifactId,{missionId,purpose:stored.payload.purpose});
    const producer=store.get('run',a.payload.producerRunId)?.data,review=store.get('review',a.reviews.at(-1))?.data;
    const reviewer=review&&store.get('run',review.reviewerRunId)?.data;
    ensure(producer&&reviewer&&review.result.decision==='ACCEPT'&&review.artifactId===a.id
      &&review.result.artifactHash===a.payloadHash&&review.result.purpose===a.payload.purpose
      &&canonical(review.result.checks.map(c=>c.criterionId).sort())===canonical(a.payload.criteria.map(c=>c.id).sort())
      &&review.result.checks.every(c=>c.verdict==='PASS'),'Complete bound accepting review required');
    registry.requireCompletedExposure(reviewer,{documentary:review.documentary?{frameId:review.documentary.frameId,requestHash:review.documentary.requestHash}:null});
    const threads=new Set((producer.inferenceReceipts??[]).map(r=>r.threadId));
    ensure(reviewer.id!==producer.id&&reviewer.mode==='reviewer'&&reviewer.context.producerConversationIncluded===false
      &&reviewer.inferenceReceipts?.length>0&&reviewer.inferenceReceipts.every(r=>!threads.has(r.threadId)),
    'Reviewer must be separate from the producer and its completed threads');
    let origin='inference';
    if(producer.inferenceReceipts?.length)registry.requireCompletedExposure(producer,{documentary:a.payload.documentary?{frameId:a.payload.documentary.frameId,requestHash:a.payload.documentary.requestHash}:null});
    else{ensure(a.payload.kind==='literal-input-copy','Unqualified producer origin');inputCopyEvidence(registry,a.id);origin='native-input-copy';}
    const gates=dependencyGates(registry,a.id);
    const gateDependencies=gates.methodRevision?.dependencies??gates.dependencies;
    ensure(gateDependencies.every(d=>(gates.methodRevision?d.acceptedBeforeFirstRevisionAttempt:d.acceptedBeforeFirstAttempt)&&d.review?.completePassingChecks
      &&d.review.separateCompletedReviewerExposure),'No downstream use before independent acceptance');
    rows.push({artifactId:a.id,artifactHash:a.payloadHash,nodeId:a.payload.nodeId,producerRunId:producer.id,
      reviewerRunId:reviewer.id,reviewId:review.id,origin,gates,criteria:a.payload.criteria,
      requiredEffects:a.payload.requiredEffects,reviewChecks:review.result.checks});
    for(const ref of a.payload.inputRefs)visit(ref.artifactId);
  };
  visit(mission.finalArtifactId);
  const planRecord=store.get('plan',missionId)?.data;
  if(planRecord){
    visit(planRecord.acceptedPlanArtifactId);
    for(const spec of planRecord.plan.nodes){
      const node=store.list('node').find(r=>r.data.missionId===missionId&&r.data.nodeId===spec.id)?.data;
      ensure(node?.status==='ACCEPTED'&&visited.has(node.artifactId),'Every planned product must be accepted and reach delivery');
    }
  }
  return rows;
}

export function gradeDevelopmentBinding(snapshot,lineage,execution){
  const files=snapshot.manifest.filter(f=>f.type==='file').map(f=>f.path).sort();
  const effects=lineage.flatMap(a=>a.requiredEffects??[]);
  const matchesCommand=e=>{try{return canonical(JSON.parse(e.command))===canonical(DEVELOPMENT_COMMAND);}catch{return false;}};
  return {exactFiles:snapshot.manifest.length===3&&canonical(files)===canonical(DEVELOPMENT_FILES),
    frozenFiles:DEVELOPMENT_FILES.every(path=>effects.some(e=>e.type==='file'&&e.path===path)),
    frozenExecution:effects.some(e=>e.type==='execution'&&e.path==='.'&&e.expectedExit===0&&matchesCommand(e)),
    sameSnapshot:execution?.snapshotHash===snapshot.hash&&canonical(execution?.manifest)===canonical(snapshot.manifest)};
}

export function auditSourceUse(engine,missionId,lineage,sources){
  const uses=[];
  for(const row of lineage){
    const a=engine.store.get('artifact',row.artifactId).data;
    for(const claim of a.payload.claims.filter(c=>c.kind==='fact'))for(const ref of claim.sources){
      const source=engine.registry.sourceReference(ref,missionId);
      ensure(sources.some(s=>s.id===source.id&&s.hash===source.hash),'Fact must use a verified acquisition');
      const acquisitionSequence=engine.registry.committedSequence('source',source.id,1);
      const candidateSequence=engine.registry.committedSequence('artifact',a.id,1);
      ensure(acquisitionSequence<candidateSequence,'Source must exist before the supported factual candidate');
      uses.push({sourceId:source.id,sourceHash:source.hash,url:source.url,artifactId:a.id,claimId:claim.id,
        acquisitionSequence,candidateSequence,reviewId:row.reviewId});
    }
  }
  ensure(Object.keys(DOCUMENT_URLS).every(name=>uses.some(u=>sourceUrlMatches(name,u.url))),
    'Both acquired publishers must support explicit factual claims in accepted delivery lineage');
  return uses;
}

// Re-entry legitimately appends engine ownership and a fresh workspace
// validation. Everything else (including failed runs and proposals) must remain.
export function routeMaterialState(store){
  return store.db.prepare("SELECT type,id,version,hash FROM records WHERE type NOT IN ('engine','workspace-validation') ORDER BY type,id,version")
    .all().map(r=>({...r}));
}

export function compareRouteMaterial(before,after,registry,{missionId,reviewerRunId}){
  const key=r=>canonical([r.type,r.id,r.version]),old=new Map(before.map(r=>[key(r),r.hash]));
  const next=new Map(after.map(r=>[key(r),r.hash]));
  ensure(before.every(r=>next.get(key(r))===r.hash),'Existing material records changed during re-entry');
  const extra=after.filter(r=>!old.has(key(r))),readLeases=[];
  for(const r of extra){
    ensure(r.type==='lease'&&r.version===1,'Only fresh scoped read leases may accompany workspace validation');
    const record=registry.store.get('lease',r.id);
    ensure(record?.hash===r.hash&&record.version===1&&!record.data.revoked,'Read lease changed');
    const lease=registry.authority.open(record.data.signed,'authority.lease');
    ensure(lease.missionId===missionId&&lease.principalId===reviewerRunId&&lease.classification==='INTERNAL'
      &&lease.actions.length===1&&['workspace.read','workspace.list'].includes(lease.actions[0])
      &&canonical(lease.resources)===canonical([`workspace:${missionId}`])&&!lease.parentId,
      'Re-entry may only reauthorize current-state reading by the actual accepting reviewer');
    readLeases.push({id:r.id,hash:r.hash,action:lease.actions[0]});
  }
  return {unchangedExceptScopedReads:true,readLeases};
}

const digest=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
const nonEmpty=value=>typeof value==='string'&&value.length>0;
const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const same=(left,right)=>canonical(left)===canonical(right);

function reentryRecord(store,event,type,id){
  ensure(nonEmpty(id)&&event?.kind==='record.committed'&&event.data?.type===type&&event.data?.id===id
    &&Number.isSafeInteger(event.data.version)&&event.data.version>=1&&digest(event.data.hash),
  'Re-entry journal contains an unexpected committed record');
  const record=store.get(type,id,event.data.version);
  ensure(record?.hash===event.data.hash&&record.version===event.data.version&&record.type===type&&record.id===id,
    'Re-entry journal does not bind to its immutable record');
  return record;
}

function signedLease(registry,record,{missionId,reviewerRunId}){
  ensure(record.version===1&&record.data?.revoked===false&&record.data.signed,'Re-entry read lease was changed or revoked');
  let lease;
  try{lease=registry.authority.open(record.data.signed,'authority.lease');}
  catch{ensure(false,'Re-entry read lease signature is invalid');}
  ensure(lease.id===record.id&&lease.missionId===missionId&&lease.principalId===reviewerRunId&&lease.classification==='INTERNAL'
    &&lease.parentId===null&&lease.actions.length===1&&['workspace.read','workspace.list'].includes(lease.actions[0])
    &&same(lease.resources,[`workspace:${missionId}`]),
  'Re-entry may only issue a direct INTERNAL workspace read/list lease to the accepting reviewer');
  return {id:record.id,hash:record.hash,action:lease.actions[0]};
}

function observationRows(rows,label){
  ensure(Array.isArray(rows),'Signed workspace validation has invalid '+label);
  const paths=new Set();
  for(const row of rows){
    ensure(object(row)&&nonEmpty(row.path)&&digest(row.sha256)&&nonEmpty(row.observedReceiptId)&&digest(row.observedReceiptHash)
      &&!paths.has(row.path),'Signed workspace validation has an invalid or duplicate '+label+' observation');
    paths.add(row.path);
  }
}

function committedBefore(registry,type,id,version,beforeJournal,label){
  let sequence;
  try{sequence=registry.committedSequence(type,id,version);}
  catch{ensure(false,'Cannot locate immutable '+label+' before reviewer re-entry');}
  ensure(Number.isSafeInteger(sequence)&&sequence>0&&sequence<=beforeJournal.events,
    'Reviewer re-entry cannot rely on '+label+' first committed during or after its checkpoint');
}

function acceptedReentryContext(store,registry,{missionId,reviewerRunId,beforeJournal}){
  const missionRecord=store.get('mission',missionId),mission=missionRecord?.data;
  ensure(mission?.id===missionId&&mission.status==='COMPLETED'&&nonEmpty(mission.finalArtifactId),
    'Reviewer re-entry requires an already completed mission with its final artifact');
  const artifactRecord=store.get('artifact',mission.finalArtifactId),artifact=artifactRecord?.data;
  ensure(artifact?.id===mission.finalArtifactId&&artifact.missionId===missionId&&artifact.status==='ACCEPTED'
    &&object(artifact.payload)&&digest(artifact.payloadHash)&&sha256(artifact.payload)===artifact.payloadHash
    &&Array.isArray(artifact.reviews)&&artifact.reviews.length>0,
  'Completed mission final artifact is absent, unaccepted or altered');
  const reviewRecord=store.get('review',artifact.reviews.at(-1)),review=reviewRecord?.data;
  ensure(review?.artifactId===artifact.id&&review.reviewerRunId===reviewerRunId&&review.result?.decision==='ACCEPT'
    &&review.result.artifactHash===artifact.payloadHash,
  'Reviewer re-entry must use the final artifact\'s exact accepting review');
  const reviewerRecord=store.get('run',reviewerRunId),reviewer=reviewerRecord?.data;
  ensure(reviewer?.id===reviewerRunId&&reviewer.missionId===missionId&&reviewer.mode==='reviewer'
    &&Array.isArray(reviewer.context?.artifactIds)&&reviewer.context.artifactIds.includes(artifact.id)
    &&(reviewer.toolObservations===undefined||Array.isArray(reviewer.toolObservations))
    &&object(reviewer.inferenceReceipt)&&reviewer.inferenceReceipt.status==='completed'
    &&(reviewer.expectedRequestHash===null||reviewer.expectedRequestHash===undefined)&&digest(reviewer.completedExposureHash),
  'Reviewer re-entry requires the actual accepting reviewer and its durable observations');
  try{registry.requireCompletedExposure(reviewer);}
  catch{ensure(false,'Reviewer re-entry requires the accepting reviewer\'s exact completed exposure');}
  committedBefore(registry,'mission',missionRecord.id,missionRecord.version,beforeJournal,'completed mission');
  committedBefore(registry,'artifact',artifactRecord.id,artifactRecord.version,beforeJournal,'accepted final artifact');
  committedBefore(registry,'review',reviewRecord.id,reviewRecord.version,beforeJournal,'accepting review');
  committedBefore(registry,'run',reviewerRecord.id,reviewerRecord.version,beforeJournal,'accepting reviewer');
  return {mission,artifact,review,reviewer};
}

function reviewerReceipt(registry,reviewer,{id:receiptId,hash:receiptHash},expectedTool,{missionId,reviewerRunId,beforeJournal}){
  const observations=(reviewer.toolObservations??[]).filter(observation=>observation.id===receiptId&&observation.hash===receiptHash);
  ensure(observations.length===1&&observations[0].principalId===reviewerRunId&&observations[0].relation==='OWN_ACTION'
    &&observations[0].signedReceipt&&sha256(observations[0].signedReceipt)===receiptHash&&nonEmpty(observations[0].resultText),
  'Workspace validation observation is not an exact own reviewer receipt');
  let receipt;
  try{receipt=registry.verifiedToolReceipt(observations[0].signedReceipt);}
  catch{ensure(false,'Workspace validation observation receipt is invalid');}
  const effect=registry.store.get('effect',receipt.id);
  ensure(receipt.id===receiptId&&receipt.missionId===missionId&&receipt.principalId===reviewerRunId
    &&receipt.tool===expectedTool&&receipt.status==='SUCCEEDED'&&effect?.data.state==='SUCCEEDED'
    &&effect.data.missionId===missionId&&effect.data.principalId===reviewerRunId&&effect.data.tool===expectedTool
    &&observations[0].resultText===canonical(receipt.result),
  'Workspace validation observation does not bind to a successful reviewer effect');
  committedBefore(registry,'effect',effect.id,effect.version,beforeJournal,'reviewer observation effect');
  return receipt;
}

function bindValidationObservations(registry,validation,accepted,beforeJournal){
  const options={missionId:accepted.mission.id,reviewerRunId:accepted.reviewer.id,beforeJournal},used=new Set();
  for(const row of validation.listings??[]){
    ensure(!used.has(row.observedReceiptId),'Workspace validation reuses one reviewer receipt');used.add(row.observedReceiptId);
    const receipt=reviewerReceipt(registry,accepted.reviewer,{id:row.observedReceiptId,hash:row.observedReceiptHash},'workspace.list',options);
    ensure(receipt.result?.path===row.path&&sha256(receipt.result)===row.sha256,
      'Workspace validation listing differs from its exact reviewer receipt');
  }
  for(const row of validation.files){
    ensure(!used.has(row.observedReceiptId),'Workspace validation reuses one reviewer receipt');used.add(row.observedReceiptId);
    const receipt=reviewerReceipt(registry,accepted.reviewer,{id:row.observedReceiptId,hash:row.observedReceiptHash},'workspace.read',options);
    ensure(receipt.result?.path===row.path&&receipt.result.sha256===row.sha256,
      'Workspace validation file differs from its exact reviewer receipt');
  }
  for(const row of validation.executions){
    ensure(!used.has(row.operationId),'Workspace validation reuses one reviewer receipt');used.add(row.operationId);
    const receipt=reviewerReceipt(registry,accepted.reviewer,{id:row.operationId,hash:row.receiptHash},'execution.run',options);
    ensure(receipt.result?.snapshotHash===row.snapshotHash,
      'Workspace validation execution differs from its exact reviewer receipt');
  }
}

function signedWorkspaceValidation(registry,record,event,{missionId,reviewerRunId,accepted}){
  ensure(record.version===1&&record.data?.signed,'Re-entry workspace validation record is invalid');
  let validation;
  try{validation=registry.authority.open(record.data.signed,'workspace.validation');}
  catch{ensure(false,'Re-entry workspace validation signature is invalid');}
  ensure(validation.id===record.id&&validation.missionId===missionId&&validation.principalId===reviewerRunId
    &&validation.artifactId===accepted.artifact.id&&validation.artifactHash===accepted.artifact.payloadHash&&validation.status==='UNCHANGED'
    &&nonEmpty(validation.checkedAt)&&Array.isArray(validation.executions),
  'Signed workspace validation is not bound to this completed reviewer re-entry');
  observationRows(validation.files,'file');
  if(Object.hasOwn(validation,'listings'))observationRows(validation.listings,'listing');
  for(const execution of validation.executions)ensure(object(execution)&&nonEmpty(execution.operationId)
    &&digest(execution.receiptHash)&&digest(execution.snapshotHash),'Signed workspace validation has an invalid execution observation');
  const expected={validationId:validation.id,missionId,runId:reviewerRunId,artifactId:validation.artifactId,status:'UNCHANGED',fileCount:validation.files.length};
  ensure(event?.kind==='workspace.validation'&&same(event.data,expected),'Workspace validation event is not the exact signed validation result');
  return validation;
}

/**
 * Audits the immutable journal delta produced by a completed reviewer re-entry.
 * It is intentionally read-only: every permitted state transition must have an
 * exact journal event, a current immutable record, and (where applicable) a
 * valid Authority signature. Any other event is a re-entry side effect.
 */
export function auditRouteReentryJournal({store,registry,missionId,reviewerRunId,beforeJournal}){
  ensure(store&&typeof store.verifyJournal==='function'&&typeof store.events==='function'&&typeof store.get==='function'
    &&registry?.store===store&&typeof registry.authority?.open==='function'&&typeof registry.verifiedToolReceipt==='function'
    &&typeof registry.committedSequence==='function','Re-entry audit requires one verified Store and its Authority registry');
  ensure(nonEmpty(missionId)&&nonEmpty(reviewerRunId)&&object(beforeJournal)&&Number.isSafeInteger(beforeJournal.events)
    &&beforeJournal.events>=0&&digest(beforeJournal.head),'Re-entry journal checkpoint is invalid');
  const afterJournal=store.verifyJournal(),events=[];
  ensure(afterJournal.events>beforeJournal.events,'Completed reviewer re-entry has no journal delta');
  let cursor=beforeJournal.events;
  while(cursor<afterJournal.events){
    const page=store.events({after:cursor,limit:1000});
    ensure(page.length>0&&page.at(-1).seq<=afterJournal.events,'Journal changed while its re-entry delta was being audited');
    events.push(...page);cursor=page.at(-1).seq;
  }
  ensure(events.length===afterJournal.events-beforeJournal.events&&events[0]?.seq===beforeJournal.events+1
    &&events[0].previousHash===beforeJournal.head&&events.at(-1)?.seq===afterJournal.events
    &&events.at(-1).hash===afterJournal.head,'Re-entry journal delta does not bind to the verified checkpoint');

  // The causal order is deliberate: ownership first, then at most scoped reads,
  // then the signed current-state observation, then release. This makes any
  // producer action, failed attempt, broker call, or post-release mutation fail.
  ensure(events.length>=4,'Completed reviewer re-entry is missing required custody and validation events');
  const accepted=acceptedReentryContext(store,registry,{missionId,reviewerRunId,beforeJournal});
  const acquireEvent=events[0],releaseEvent=events.at(-1),validationEvent=events.at(-2),validationCommitEvent=events.at(-3);
  const acquired=reentryRecord(store,acquireEvent,'engine','exclusive');
  const released=reentryRecord(store,releaseEvent,'engine','exclusive');
  ensure(nonEmpty(acquired.data.ownerId)&&Number.isSafeInteger(acquired.data.pid)&&acquired.data.pid>=1
    &&Number.isSafeInteger(acquired.data.epoch)&&acquired.data.epoch>=1&&object(acquired.data.processIdentity)
    &&acquired.data.processIdentity.pid===acquired.data.pid&&nonEmpty(acquired.data.acquiredAt)
    &&!Object.hasOwn(acquired.data,'releasedAt'),'Re-entry engine acquisition is malformed');
  ensure(released.version===acquired.version+1&&releaseEvent.data.parentHash===acquired.hash&&released.data.ownerId===null
    &&released.data.pid===acquired.data.pid&&released.data.epoch===acquired.data.epoch
    &&same(released.data.processIdentity,acquired.data.processIdentity)&&released.data.acquiredAt===acquired.data.acquiredAt
    &&nonEmpty(released.data.releasedAt),'Re-entry engine release does not close the exact acquisition');

  const readLeases=[];let sawWorkspaceRead=false;
  for(const event of events.slice(1,-3)){
    const record=reentryRecord(store,event,'lease',event.data?.id);
    const lease=signedLease(registry,record,{missionId,reviewerRunId});
    ensure(lease.action!=='workspace.list'||!sawWorkspaceRead,'Re-entry listing must precede every revalidated file read');
    if(lease.action==='workspace.read')sawWorkspaceRead=true;
    readLeases.push(lease);
  }
  ensure(new Set(readLeases.map(lease=>lease.id)).size===readLeases.length,'Re-entry reused a read lease record');
  const validationRecord=reentryRecord(store,validationCommitEvent,'workspace-validation',validationCommitEvent.data?.id);
  const validation=signedWorkspaceValidation(registry,validationRecord,validationEvent,{missionId,reviewerRunId,accepted});
  bindValidationObservations(registry,validation,accepted,beforeJournal);
  const listings=validation.listings??[];
  ensure(readLeases.length===validation.files.length+listings.length
    &&readLeases.filter(lease=>lease.action==='workspace.read').length===validation.files.length
    &&readLeases.filter(lease=>lease.action==='workspace.list').length===listings.length,
  'Signed workspace validation does not account for every temporary re-entry lease');
  return {
    journal:{before:{events:beforeJournal.events,head:beforeJournal.head},after:afterJournal,eventCount:events.length},
    engine:{acquired:{version:acquired.version,hash:acquired.hash,epoch:acquired.data.epoch},released:{version:released.version,hash:released.hash,epoch:released.data.epoch}},
    readLeases,
    validation:{id:validation.id,hash:validationRecord.hash,artifactId:validation.artifactId,artifactHash:validation.artifactHash,
      status:validation.status,fileCount:validation.files.length,listingCount:listings.length,executionCount:validation.executions.length},
  };
}
