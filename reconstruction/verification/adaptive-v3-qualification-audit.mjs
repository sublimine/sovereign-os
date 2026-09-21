// Post-close, read-only reconciliation for one CI adaptive-v3 qualification
// directory.  It never constructs an engine, broker, provider or runner and
// it opens SQLite defensively read-only.  Its row decision is deliberately
// narrower than model quality, factual truth, live availability or factory
// completion.
import * as fs from 'node:fs';
import {join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {DatabaseSync} from 'node:sqlite';
import {canonical,sha256} from '../../factory/lib/contracts.mjs';
import {Store} from '../../factory/lib/store.mjs';
import {Authority} from '../../factory/lib/authority.mjs';
import {ArtifactRegistry} from '../../factory/lib/artifacts.mjs';
import {missionReport} from '../../factory/lib/report.mjs';
import {ADAPTIVE_V3_DIRECT_CERTIFICATION_TYPE,ADAPTIVE_V3_DIRECT_ENTRY_NODE,ADAPTIVE_V3_DIRECT_ENTRY_PURPOSE,
  ADAPTIVE_V3_DIRECT_ORIGIN_TYPE} from '../../factory/lib/adaptive-v3-deterministic-entry.mjs';
import {assertAdaptiveV3MissionRoute} from '../../factory/lib/adaptive-v3-route-contract.mjs';
import {DOCUMENT_URLS,gradeRouteContent} from './full-route-cases.mjs';
import {gradeIntervalExecution} from './interval-union-oracle.mjs';
import {auditRouteLineage,auditRouteReentryJournal,auditSourceUse,gradeDevelopmentBinding,routeMaterialState,verifiedRouteSources} from './full-route-audit.mjs';
import {ADAPTIVE_V3_QUALIFICATION_CASES,ADAPTIVE_V3_SPECIALIST_CHARTER,adaptiveV3QualificationCase} from './adaptive-v3-qualification-cases.mjs';
import {fullRoutePolicy} from './full-route-harness.mjs';
import {ADAPTIVE_V3_EXTERNAL_EXECUTION_KIND,ADAPTIVE_V3_EXTERNAL_EXECUTION_RECORD_TYPE,
  adaptiveV3ExternalExecutionEvidence} from './adaptive-v3-external-execution-evidence.mjs';

const required=['qualification.json','result.json','report.json','final-report.json','lineage.json','reentry.json','external-oracle.json','state.sqlite'];
const ensure=(condition,message)=>{if(!condition)throw Object.assign(Error(message),{code:'ADAPTIVE_V3_READ_ONLY_AUDIT'});};
const json=path=>JSON.parse(fs.readFileSync(path,'utf8'));
const hash=path=>sha256(fs.readFileSync(path));
const recordRef=record=>record?{type:record.type,id:record.id,version:record.version,hash:record.hash}:null;
const safeError=error=>({code:error?.code??'UNKNOWN',message:error?.message??'Unknown audit failure'});
const SQLITE_SIDECARS=new Set(['state.sqlite-wal','state.sqlite-shm']);
const FIXTURE_SCOPE='Control-plane fixture classification. SIMULATED provider/transport is not subscription or factual-truth evidence; real local isolated execution, when present, is separately receipt-bound.';
const ownKeys=(value,keys)=>value!==null&&typeof value==='object'&&!Array.isArray(value)
  &&canonical(Object.keys(value).sort())===canonical([...keys].sort());

// `readOnly` alone still lets SQLite create WAL/SHM coordination files.  The
// qualification is closed evidence, so reject an uncheckpointed sidecar and
// open the base database with SQLite's immutable URI flag instead.
const immutableSqliteUri=path=>{
  const url=pathToFileURL(path);url.searchParams.set('immutable','1');return url.href;
};
function evidenceSnapshot(root){
  const rows=[];
  const visit=(path,relative)=>{
    const stat=fs.lstatSync(path,{bigint:true});
    ensure(!stat.isSymbolicLink(),'Qualification evidence may not contain symbolic links');
    const common={path:relative,mode:stat.mode.toString(),mtimeNs:stat.mtimeNs.toString(),ctimeNs:stat.ctimeNs.toString()};
    if(stat.isDirectory()){
      rows.push({...common,type:'directory'});
      for(const entry of fs.readdirSync(path,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name)))
        visit(join(path,entry.name),relative==='.'?entry.name:`${relative}/${entry.name}`);
      return;
    }
    ensure(stat.isFile(),'Qualification evidence contains a non-regular artifact');
    rows.push({...common,type:'file',bytes:stat.size.toString(),sha256:hash(path)});
  };
  visit(root,'.');return rows;
}

function auditFixtureClassification({row,declaration,store,registry,missionId}){
  const base={provider:'SIMULATED',network:'NOT_USED',execution:row==='development'?'REAL_LOCAL_ISOLATED':'NOT_USED',scope:FIXTURE_SCOPE};
  if(row!=='sources'){
    ensure(ownKeys(declaration,['provider','transport','network','execution','scope'])
      &&canonical(declaration)===canonical({...base,transport:'NOT_USED'}),
    'Non-source V3 row lacks its exact closed simulated fixture declaration');
    return {provider:declaration.provider,transport:declaration.transport,network:declaration.network,execution:declaration.execution};
  }
  ensure(ownKeys(declaration,['provider','transport','network','execution','scope','sourceFixtureId','sourceUrls','sourceResponseHashes'])
    &&declaration.provider==='SIMULATED'&&declaration.transport==='SIMULATED_FIXTURE'&&declaration.network==='DISABLED'
    &&declaration.execution==='NOT_USED'&&declaration.scope===FIXTURE_SCOPE,'Sources row lacks its exact simulated fixture declaration');
  const urls=Object.values(DOCUMENT_URLS).sort(),responses=declaration.sourceResponseHashes;
  ensure(canonical(declaration.sourceUrls)===canonical(urls)&&Array.isArray(responses)&&responses.length===urls.length,
    'Source fixture does not bind exactly the preregistered primary URLs');
  for(const [index,url] of urls.entries()){
    const response=responses[index];
    ensure(ownKeys(response,['url','contentType','sha256','bytes'])&&response.url===url
      &&response.contentType==='text/plain; charset=utf-8'&&typeof response.sha256==='string'&&/^[a-f0-9]{64}$/.test(response.sha256)
      &&Number.isSafeInteger(response.bytes)&&response.bytes>=0,'Source fixture response declaration is malformed');
  }
  const fixtureId=sha256({schema:'sovereign.source-fixture.v1',transport:'SIMULATED',network:'DISABLED',responses});
  ensure(declaration.sourceFixtureId===fixtureId,'Source fixture identity is not derived from its declared exact response bytes');
  const acquisition={schema:'sovereign.source-transport.v1',classification:'SIMULATED_FIXTURE',network:'DISABLED',fixtureId};
  const sources=store.list('source').filter(record=>record.data.missionId===missionId).map(record=>record.data);
  ensure(sources.length===urls.length,'Sources row has an unexpected number of admitted acquisitions');
  for(const source of sources){
    const expected=responses.find(response=>response.url===source.url),effect=store.get('effect',source.receiptId)?.data;
    ensure(expected&&effect?.receipt,'Source fixture receipt or URL binding is absent');
    const receipt=registry.verifiedToolReceipt(effect.receipt);
    ensure(receipt.missionId===missionId&&receipt.tool==='source.fetch'&&receipt.status==='SUCCEEDED'
      &&canonical(receipt.result.acquisition)===canonical(acquisition)&&canonical(source.acquisition)===canonical(acquisition)
      &&source.hash===expected.sha256&&source.raw.length===expected.bytes&&receipt.result.sha256===expected.sha256
      &&receipt.result.bytes===expected.bytes&&source.raw===receipt.result.content,
    'Signed source receipt, admitted source and closed fixture declaration diverge');
  }
  return {provider:declaration.provider,transport:declaration.transport,network:declaration.network,execution:declaration.execution,
    fixtureId,sourceUrls:urls};
}

function signedReentryWorkspaceReads({store,registry,journal,missionId,reviewerRunId}){
  const validationRecord=store.get('workspace-validation',journal.validation.id);
  ensure(validationRecord?.version===1&&validationRecord.hash===journal.validation.hash&&validationRecord.data?.signed,
    'Re-entry journal does not resolve to its immutable signed workspace validation');
  let validation;
  try{validation=registry.authority.open(validationRecord.data.signed,'workspace.validation');}
  catch{ensure(false,'Re-entry workspace validation signature is invalid');}
  ensure(validation.id===journal.validation.id&&validation.missionId===missionId&&validation.principalId===reviewerRunId
    &&validation.artifactId===journal.validation.artifactId&&validation.artifactHash===journal.validation.artifactHash
    &&validation.status==='UNCHANGED'&&Array.isArray(validation.files)&&Array.isArray(validation.executions)
    &&(validation.listings===undefined||Array.isArray(validation.listings)),
  'Signed workspace validation no longer matches the re-entry journal');
  const verifyObservation=(row,tool)=>{
    ensure(ownKeys(row,['path','sha256','observedReceiptId','observedReceiptHash'])&&typeof row.path==='string'
      &&/^[a-f0-9]{64}$/.test(row.sha256)&&/^[a-f0-9]{64}$/.test(row.observedReceiptHash),
    'Signed workspace validation has a malformed re-entry observation');
    const effect=store.get('effect',row.observedReceiptId);
    ensure(effect?.data?.missionId===missionId&&effect.data.principalId===reviewerRunId&&effect.data.tool===tool
      &&effect.data.state==='SUCCEEDED'&&effect.data.receipt&&sha256(effect.data.receipt)===row.observedReceiptHash,
    'Signed workspace validation observation is not bound to the original reviewer effect receipt');
    const receipt=registry.verifiedToolReceipt(effect.data.receipt);
    ensure(receipt.missionId===missionId&&receipt.principalId===reviewerRunId&&receipt.tool===tool&&receipt.status==='SUCCEEDED'
      &&receipt.result?.path===row.path,'Signed workspace validation observation path differs from its authenticated effect');
    if(tool==='workspace.read')ensure(receipt.result.sha256===row.sha256&&sha256(receipt.result.content)===row.sha256,
      'Signed workspace read validation digest differs from its authenticated effect');
    else ensure(sha256(receipt.result)===row.sha256,'Signed workspace listing validation digest differs from its authenticated effect');
    return {tool,path:row.path};
  };
  return [...(validation.listings??[]).map(row=>verifyObservation(row,'workspace.list')),
    ...validation.files.map(row=>verifyObservation(row,'workspace.read'))];
}

function auditReentryEvidence({reentry,store,registry,missionId,reviewerRunId}){
  ensure(reentry&&typeof reentry==='object'&&reentry.noReplay===true
    &&ownKeys(reentry.before,['material','journal','calls','snapshot'])
    &&ownKeys(reentry.after,['material','journal','calls','snapshot'])
    &&ownKeys(reentry.journal,['journal','engine','readLeases','validation'])
    &&Number.isSafeInteger(reentry.before.calls)&&reentry.before.calls>=0
    &&Number.isSafeInteger(reentry.after.calls)&&reentry.after.calls>=0
    &&typeof reentry.before.material==='string'&&typeof reentry.after.material==='string',
  'Qualification lacks a complete re-entry record with its durable journal delta');
  const restart=reentry.restart,guards=restart?.guards;
  ensure(ownKeys(restart,['mode','initialEngineClosed','freshInstance','freshStore','freshLedger','freshBroker','brokerReadOnlyFacade',
    'existingStoreOnly','existingAuthorityOnly','existingWorkspaceRootOnly','sourceTransportClassification','sourceNetwork','executionRunnerPresent','guards'])
    &&restart.mode==='fresh-engine-validation-only-v1'&&restart.initialEngineClosed===true
    &&restart.freshInstance===true&&restart.freshStore===true&&restart.freshLedger===true&&restart.freshBroker===true
    &&restart.brokerReadOnlyFacade===true&&restart.existingStoreOnly===true&&restart.existingAuthorityOnly===true&&restart.existingWorkspaceRootOnly===true
    &&restart.sourceTransportClassification==='UNAVAILABLE'&&restart.sourceNetwork==='DISABLED'
    &&restart.executionRunnerPresent===false,
  'Re-entry restart attestation does not declare a fresh capability-reduced validation-only engine');
  ensure(ownKeys(guards,['phase','blocked','workspaceReads','reentrySnapshots','postCheckSnapshots'])&&guards.phase==='postcheck'
    &&Array.isArray(guards.blocked)&&guards.blocked.length===0&&Array.isArray(guards.workspaceReads)
    &&Number.isSafeInteger(guards.reentrySnapshots)&&guards.reentrySnapshots>=0
    &&Number.isSafeInteger(guards.postCheckSnapshots)&&guards.postCheckSnapshots>=0,
  'Re-entry runtime guard trace is malformed or recorded a forbidden surface');
  const journal=auditRouteReentryJournal({store,registry,missionId,reviewerRunId,beforeJournal:reentry.before.journal});
  ensure(canonical(reentry.journal)===canonical(journal)
    &&canonical(reentry.before.journal)===canonical(journal.journal.before)
    &&canonical(reentry.after.journal)===canonical(journal.journal.after),
  'Stored re-entry journal delta differs from the durable signed observation');
  const workspaceReads=signedReentryWorkspaceReads({store,registry,journal,missionId,reviewerRunId});
  ensure(canonical(guards.workspaceReads)===canonical(workspaceReads)
    &&guards.reentrySnapshots===journal.validation.executionCount,
  'Re-entry runtime guard trace does not match the durable validation journal');
  // `restart` is a harness-time attestation.  The audit can require its exact
  // declared constraints and bind its observation trace to SQLite, but object
  // identity / a separate JS process are not durable facts recoverable here.
  return {restartAttestation:{mode:restart.mode,engineEpoch:journal.engine.acquired.epoch},journal,
    workspaceReadCount:workspaceReads.length};
}

function expectedArtifacts(row,store,missionId){
  const artifacts=store.list('artifact').filter(record=>record.data.missionId===missionId);
  if(row==='recovery'){
    ensure(artifacts.filter(record=>record.data.payload.body==='9').length===1,
      'Recovery row must retain the rejected candidate exactly once');
    ensure(artifacts.filter(record=>record.data.payload.body==='13'&&record.data.status==='ACCEPTED').length===1,
      'Recovery row must retain one accepted corrected candidate');
  }
  if(row==='specialist'){
    const config=store.list('worker-config').find(record=>record.data.standaloneSpecialist)?.data;
    ensure(config&&canonical(config.roleIds)===canonical([]),'Specialist row requires exactly the standalone producer configuration');
    ensure(canonical(config.standaloneSpecialist.charter)===canonical(ADAPTIVE_V3_SPECIALIST_CHARTER),
      'Specialist charter differs from its preregistered content');
    const plan=store.get('plan',missionId)?.data;
    ensure(plan&&config.standaloneSpecialist.planArtifactId===plan.acceptedPlanArtifactId,
      'Specialist config is not bound to the accepted plan artifact');
    ensure(store.list('effect').filter(record=>record.data.missionId===missionId).length===0,
      'Zero-tool specialist row recorded an effect');
  }
  return artifacts;
}

function auditSealedExternalExecution({store,registry,missionId,lineage,snapshot,execution,owner,external}){
  const receiptRecord=store.get(ADAPTIVE_V3_EXTERNAL_EXECUTION_RECORD_TYPE,missionId);
  ensure(receiptRecord?.type===ADAPTIVE_V3_EXTERNAL_EXECUTION_RECORD_TYPE&&receiptRecord.id===missionId&&receiptRecord.version===1
    &&ownKeys(receiptRecord.data,['signed']),'Development external execution has no immutable Authority-sealed receipt');
  let sealed;
  try{sealed=registry.authority.open(receiptRecord.data.signed,ADAPTIVE_V3_EXTERNAL_EXECUTION_KIND);}
  catch{ensure(false,'Development external execution receipt signature is invalid');}
  const missionRecord=store.get('mission',missionId),finalArtifactRecord=store.get('artifact',missionRecord?.data?.finalArtifactId),
    finalLineage=lineage.find(item=>item.artifactId===finalArtifactRecord?.id),
    reviewerRunRecord=store.get('run',finalLineage?.reviewerRunId),reviewRecord=store.get('review',finalLineage?.reviewId);
  let expected;
  try{expected=adaptiveV3ExternalExecutionEvidence({missionRecord,finalArtifactRecord,reviewerRunRecord,reviewRecord,
    lineage,snapshot,execution,owner,oracle:external});}
  catch{ensure(false,'Development external execution evidence is malformed or not one bounded operation');}
  ensure(canonical(sealed)===canonical(expected),'Sealed development execution receipt diverges from SQLite lineage or its JSON projections');
  return {record:recordRef(receiptRecord),resultHash:sealed.execution.resultHash,ownerHash:sealed.owner.hash,
    snapshotHash:sealed.snapshot.hash,lineageHash:sealed.lineage.hash};
}

function auditRowSpecific({row,spec,store,registry,missionId,startedAt,lineage,external,directory,report}){
  if(row==='sources'){
    const sources=verifiedRouteSources({store,registry},missionId,startedAt);
    const expectedBindings=sources.map(({raw,...source})=>source);
    ensure(canonical(expectedBindings)===canonical(json(join(directory,'source-bindings.json'))),
      'Source binding projection differs from durable authenticated receipts');
    const uses=auditSourceUse({store,registry},missionId,lineage,sources);
    ensure(canonical(uses)===canonical(json(join(directory,'source-use.json'))),
      'Source use projection differs from accepted lineage');
    ensure(gradeRouteContent(spec,report.final?.payload?.body,{sources}).passed===true&&external.passed===true,
      'Sources row failed its independent bounded content oracle');
    return {sources:sources.map(source=>({id:source.id,hash:source.hash,url:source.url})),sourceUses:uses.length};
  }
  if(row==='development'){
    const evidenceNames=['delivered-snapshot.json','external-execution.json','external-execution-owner.json'];
    ensure(evidenceNames.every(name=>fs.existsSync(join(directory,name))),
      'Development external execution projection is incomplete');
    const snapshot=json(join(directory,'delivered-snapshot.json')),
      execution=json(join(directory,'external-execution.json')),owner=json(join(directory,'external-execution-owner.json')),
      binding=gradeDevelopmentBinding(snapshot,lineage,execution),content=gradeIntervalExecution(execution);
    ensure(execution.simulation===false,'Development external execution must retain its real-local-isolated classification');
    ensure(ownKeys(external,['binding','content','unchanged','passed'])&&canonical(external.binding)===canonical(binding)
      &&canonical(external.content)===canonical(content)&&external.unchanged===true
      &&content.passed===true&&Object.values(binding).every(Boolean)&&external.passed===true,
      'Development row failed its immutable snapshot binding or independent finite oracle');
    const receipt=auditSealedExternalExecution({store,registry,missionId,lineage,snapshot,execution,owner,external});
    return {snapshotHash:snapshot.hash,execution:{simulation:execution.simulation,checks:content.checks},binding,receipt};
  }
  if(row==='recovery'){
    const recovery=report.methodRecovery;
    ensure(recovery?.rounds?.length===1&&recovery.rounds[0].status==='INSTALLED_HISTORICALLY',
      'Recovery row must retain exactly one installed method revision');
    const failure=recovery.rounds[0].failures?.[0];
    ensure(failure?.previousMethod?.id==='direct-synthesis'&&failure?.replacementMethod?.id==='independent-reconstruction',
      'Recovery method did not remain causally distinct from the rejected method');
    ensure(gradeRouteContent(spec,report.final?.payload?.body).passed===true&&external.passed===true,
      'Recovery row failed its independent bounded content oracle');
    return {rounds:recovery.rounds.length,previousMethod:failure.previousMethod.id,replacementMethod:failure.replacementMethod.id};
  }
  if(row==='specialist'){
    ensure(gradeRouteContent(spec,report.final?.payload?.body).passed===true&&external.passed===true,
      'Specialist row failed its independent bounded content oracle');
    const node=report.nodes.find(item=>item.id==='derive');
    ensure(node?.specialistMode==='standalone'&&canonical(node.specialist)===canonical(ADAPTIVE_V3_SPECIALIST_CHARTER),
      'Specialist public projection differs from the accepted charter');
    return {specialistMode:node.specialistMode,charterHash:sha256(node.specialist)};
  }
  ensure(false,'Unknown adaptive-v3 qualification row');
}

/**
 * Reconcile a completed temporary qualification arm after `runFullRouteCase`
 * has closed its engine.  `row` is mandatory to prevent a result from being
 * interpreted using a neighbouring row's oracle.  The returned status means
 * only that the declared CI evidence survived this audit.
 */
export function auditAdaptiveV3QualificationCase({directory,row}={}){
  const spec=adaptiveV3QualificationCase(row),root=typeof directory==='string'?resolve(directory):null;
  if(!root||!spec||!fs.existsSync(root)||!fs.statSync(root).isDirectory())return {
    status:'NOT_RUN',row:row??null,scope:'No explicit existing adaptive-v3 qualification directory and preregistered row were supplied.'};
  const paths=Object.fromEntries(required.map(name=>[name,join(root,name)]));
  if(required.some(name=>!fs.existsSync(paths[name])))return {
    status:'NOT_RUN',row,scope:'Required closed qualification evidence is absent; this audit did not create or reconstruct it.'};
  const dbPath=paths['state.sqlite'];
  let db=null,before=null,audit={row,status:'OBSERVED_NOT_QUALIFIED',checks:{},details:{},error:null,
    scope:'Post-close read-only reconciliation of one simulated adaptive-v3 planned CI row. It does not validate a subscription, model competence, factual truth, future availability or factory completion.'};
  try{
    before=evidenceSnapshot(root);
    ensure(!before.some(entry=>SQLITE_SIDECARS.has(entry.path)),
      'Closed qualification evidence contains a SQLite WAL/SHM sidecar and cannot be immutably audited');
    const qualification=json(paths['qualification.json']),result=json(paths['result.json']),reportFile=json(paths['report.json']),finalReportFile=json(paths['final-report.json']),
      storedLineage=json(paths['lineage.json']),reentry=json(paths['reentry.json']),external=json(paths['external-oracle.json']);
    ensure(qualification.caseId===spec.id&&qualification.mode==='adaptive-v3-planned'&&qualification.simulation===true,
      'Qualification does not bind this exact simulated adaptive-v3 arm');
    ensure(qualification.specHash===sha256(spec),'Qualification does not bind the exact preregistered case bytes');
    // Recompute rather than trusting the copied policy JSON.
    const expectedPolicy=fullRoutePolicy(spec,'adaptive-v3-planned');
    ensure(canonical(qualification.policy)===canonical(expectedPolicy),'Qualification policy differs from the frozen adaptive-v3 arm policy');
    ensure(result.caseId===spec.id&&result.mode==='adaptive-v3-planned'&&result.missionId===qualification.missionId
      &&result.structuralPassed===true&&result.actualSubscription===false&&result.passed===false,
      'Result classification does not preserve simulated-vs-subscription scope');

    db=new DatabaseSync(immutableSqliteUri(dbPath),{readOnly:true,defensive:true,allowExtension:false});
    db.exec('PRAGMA query_only=ON; PRAGMA trusted_schema=OFF; BEGIN');
    const store=Object.create(Store.prototype);store.db=db;
    ensure(store.get('authority-key','local-authority-v1'),'Existing authority key required; a read-only audit must never create one');
    const authority=new Authority(store),registry=new ArtifactRegistry(store,authority);
    const mission=store.get('mission',result.missionId)?.data;
    ensure(mission?.status==='COMPLETED'&&mission.intent===spec.request,'Completed mission differs from preregistered request');
    const fixture=auditFixtureClassification({row,declaration:qualification.fixtureDeclaration,store,registry,missionId:result.missionId});
    const route=assertAdaptiveV3MissionRoute(store,authority,result.missionId);
    ensure(route.decision.selectedEntryMode==='planned'&&route.decision.requestedEntryMode==='planned'
      &&route.routing.requestedEntryMode==='planned'&&mission.policy.entryMode==='planned','Signed route is not explicitly planned');
    ensure(store.get(ADAPTIVE_V3_DIRECT_ORIGIN_TYPE,result.missionId)===null
      &&store.list(ADAPTIVE_V3_DIRECT_CERTIFICATION_TYPE).length===0
      &&store.list('run').every(record=>record.data.missionId!==result.missionId||record.data.nodeId!==ADAPTIVE_V3_DIRECT_ENTRY_NODE)
      &&store.list('artifact').every(record=>record.data.missionId!==result.missionId||record.data.payload?.purpose!==ADAPTIVE_V3_DIRECT_ENTRY_PURPOSE),
    'A direct-route record, actor or artifact appeared in a planned qualification');
    const report=missionReport(store,result.missionId,{registry});
    ensure(canonical(report)===canonical(finalReportFile),
      'Final public report differs from its closed evidence projection');
    ensure(reportFile.mission?.id===result.missionId&&reportFile.adaptiveV3?.selectedEntryMode==='planned'
      &&reportFile.adaptiveV3.originRecord===null&&reportFile.adaptiveV3.deterministicCertificationRecord===null,
      'Pre-reentry public report does not preserve the planned V3 projection');
    ensure(report.adaptiveV3?.selectedEntryMode==='planned'&&report.adaptiveV3.originRecord===null
      &&report.adaptiveV3.deterministicCertificationRecord===null,'Public V3 projection exposes an invalid direct state');
    const lineage=auditRouteLineage({store,registry},result.missionId);
    ensure(canonical(lineage)===canonical(storedLineage),'Accepted lineage differs from stored closed evidence');
    ensure(lineage[0]?.reviewerRunId,'Accepted lineage lacks the reviewer identity required to authenticate re-entry');
    const receipts=store.list('run').filter(record=>record.data.missionId===result.missionId)
      .flatMap(record=>record.data.inferenceReceipts??[]);
    ensure(receipts.length===result.calls.length&&receipts.every(receipt=>receipt.status==='completed'&&receipt.simulation===true),
      'Provider receipts are missing, unaccounted for, incomplete or misclassified');
    ensure(canonical(store.verifyJournal())===canonical(result.journal),'Journal differs from result evidence');
    const reentryAudit=auditReentryEvidence({reentry,store,registry,missionId:result.missionId,reviewerRunId:lineage[0].reviewerRunId});
    ensure(reentry.before.calls===reentry.after.calls&&reentry.after.calls===result.calls.length
      &&reentry.before.snapshot===reentry.after.snapshot&&sha256(routeMaterialState(store))===reentry.after.material,
      'Re-entry evidence permits a material change or does not bind the final store');
    const finalArtifact=store.get('artifact',mission.finalArtifactId)?.data;
    ensure(finalArtifact?.status==='ACCEPTED','Completed planned mission lacks an accepted final artifact');
    const artifacts=expectedArtifacts(row,store,result.missionId);
    const specific=auditRowSpecific({row,spec,store,registry,missionId:result.missionId,startedAt:qualification.startedAt,
      lineage,external,directory:root,report});
    audit.checks={signedPlannedRoute:true,noDirectRouteMaterial:true,publicProjection:true,completeLineage:true,
      fixtureClassification:true,simulatedReceiptAccounting:true,noReplay:true,reentryRestartAttestation:true,rowSpecific:true,
      ...(row==='development'?{sealedExternalExecution:true}:{})};
    audit.details={missionId:result.missionId,route:recordRef(route.routeRecord),lineage:lineage.map(item=>({artifactId:item.artifactId,nodeId:item.nodeId})),
      artifactCount:artifacts.length,fixture,reentry:reentryAudit,specific};
    audit.status='QUALIFIED_FOR_DECLARED_ROW';
  }catch(error){audit.error=safeError(error);}
  finally{
    try{if(db?.isTransaction)db.exec('ROLLBACK');}finally{db?.close();}
    let after=null,unchanged=false;
    try{after=evidenceSnapshot(root);unchanged=before!==null&&canonical(before)===canonical(after);}
    catch(error){audit.error??=safeError(error);}
    audit.checks.readOnly=unchanged;
    if(!unchanged){audit.status='OBSERVED_NOT_QUALIFIED';audit.error??={code:'READ_ONLY_MUTATION',message:'Evidence bytes changed while auditing'};}
  }
  return audit;
}

export {ADAPTIVE_V3_QUALIFICATION_CASES};
