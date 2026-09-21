// One assessment of an already completed UNKNOWN in an isolated SQLite fork.
// No new replica, opening, comparison, mission, installation, or source mutation.
import * as fs from 'node:fs';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {DatabaseSync,backup} from 'node:sqlite';
import {sha256,canonical,check} from '../../factory/lib/contracts.mjs';
import {verifyRuntimeRelease} from '../../factory/lib/runtime-release.mjs';
import {readHistoryFingerprint} from './read-history-fingerprint.mjs';
const [directory,runtimeRoot]=process.argv.slice(2);
if(!directory||!runtimeRoot||fs.readdirSync(directory).length)throw Error('New empty output directory and verified runtime required');
const release=verifyRuntimeRelease(runtimeRoot),self=new URL(import.meta.url),harnessHash=sha256(fs.readFileSync(self));
const helper=new URL('./read-history-fingerprint.mjs',import.meta.url),helperHash=sha256(fs.readFileSync(helper));
const sourceDirectory=new URL('./runs/planned-blind-live-rB9KdY/',import.meta.url);
const sourceQualification=JSON.parse(fs.readFileSync(new URL('qualification.json',sourceDirectory)));
const source=new DatabaseSync(new URL('state.sqlite',sourceDirectory),{readOnly:true,defensive:true,allowExtension:false});
const before=readHistoryFingerprint(source),sourceUnchanged=()=>canonical(readHistoryFingerprint(source))===canonical(before);
await backup(source,join(directory,'state.sqlite'));
check(sourceUnchanged(),'EXPERIMENT_BOUNDARY','Source changed during isolated snapshot');
const mod=path=>import(pathToFileURL(join(release.directory,path)));
const {FactoryEngine}=await mod('factory/lib/engine.mjs'),{CodexProvider}=await mod('factory/providers/codex.mjs');
const {inferenceRequestHash}=await mod('factory/providers/instruction-profiles.mjs');
const {unpackContext}=await mod('factory/lib/context-codec.mjs'),{unpackJsonContext}=await mod('factory/lib/context-json-codec.mjs');
const {BLIND_MATERIAL_PURPOSE}=await mod('factory/lib/blind-material.mjs');
const write=(name,value)=>fs.writeFileSync(join(directory,name),JSON.stringify(value,null,2),{flag:'wx',mode:0o600});
const engine=new FactoryEngine({databasePath:join(directory,'state.sqlite'),workspaceRoot:join(directory,'workspaces')});
const {store}=engine,mission=store.get('mission',sourceQualification.missionId),journal=store.verifyJournal();
check(journal.events===before.head.seq&&journal.head===before.head.hash,'EXPERIMENT_BOUNDARY','Fork does not match the exact source journal');
const registrations=store.list('blind-registration');check(registrations.length===1,'EXPERIMENT_BOUNDARY','Exactly one historical registered attempt required');
const registration=registrations[0],replicationId=registration.id,registered=engine.authority.open(registration.data.signed,'blind.registration');
const seal=store.get('blind-seal',replicationId),sealed=engine.authority.open(seal.data.signed,'blind.result');
check(engine.blind.status(replicationId).state==='INCONCLUSIVE'&&sealed.result.status==='UNKNOWN'&&sealed.result.result===''
  &&sealed.receipt.simulation===false&&sealed.receipt.status==='completed','EXPERIMENT_BOUNDARY','A completed real UNKNOWN is required, never a lost response');
check(store.list('blind-opening').length===0&&store.list('blind-comparison').length===0,'EXPERIMENT_BOUNDARY','Original must remain unopened');
const oldRunIds=new Set(store.list('run').map(r=>r.id)),priorThreads=store.list('run').flatMap(r=>r.data.inferenceReceipts??[]).map(r=>r.threadId);
const privateIds=[registered.originalRef.artifactId,registered.protocolRef.id,registered.planBinding.planArtifact.id];
const hidden=privateIds.flatMap(id=>{const a=store.get('artifact',id);return [id,a.data.payloadHash];});
const frozen=()=>harnessHash===sha256(fs.readFileSync(self))&&helperHash===sha256(fs.readFileSync(helper))
  &&verifyRuntimeRelease(runtimeRoot).releaseId===release.releaseId&&sourceUnchanged();
const captures=[];
const providerFactory=()=>{const provider=new CodexProvider();return {async generate(input){
  check(frozen()&&captures.length<1,'EXPERIMENT_BOUNDARY','One review maximum; immutable runtime and source required');
  const wire=JSON.parse(input.input),exposure=wire.encoding==='sovereign.lossless-context.v2'?unpackJsonContext(wire):wire.encoding==='sovereign.lossless-context.v1'?unpackContext(wire):wire;
  check(exposure.publicReviewMandate?.schema==='sovereign.closed-blind-review.v1'&&exposure.artifacts.length===1
    &&exposure.artifacts[0].payload.purpose===BLIND_MATERIAL_PURPOSE&&!Object.hasOwn(exposure,'missionIntent')
    &&hidden.every(s=>!input.input.includes(s)),'EXPERIMENT_BOUNDARY','Only closed assessment of the exact public attempt is authorized');
  const request={instructions:input.instructions,input:input.input,schema:input.schema,model:input.model,reasoningEffort:input.reasoningEffort,
    ...(input.instructionProfile?{instructionProfile:input.instructionProfile}:{})};
  const capture={at:new Date().toISOString(),requestHash:inferenceRequestHash(request),request};
  captures.push(capture);write('request.json',capture);return provider.generate(input);
},close:()=>provider.close()};};
engine.workers.providerFactory=providerFactory;
engine.blind.providerFactory=()=>({generate(){throw Object.assign(Error('No replacement replica is permitted in this assessment'),{code:'EXPERIMENT_BOUNDARY'});},async close(){}});
write('qualification.json',{startedAt:new Date().toISOString(),source:sourceDirectory.pathname,sourceMissionId:mission.id,sourceJournal:before,
  sourceFailureHash:sha256(fs.readFileSync(new URL('failure.json',sourceDirectory))),runtime:release,harnessHash,helperHash,replicationId,
  registrationHash:registration.hash,sealHash:seal.hash,expectedResultHash:sha256(sealed.result),priorThreads,maxProviderCalls:1,
  expected:{decision:['ACCEPT','RETURN'],replicaState:'INCONCLUSIVE',openingCount:0,comparisonCount:0,missionUnchanged:true},
  scope:'Prospective assessment extension in an isolated exact-history fork. A faithful UNKNOWN may be accepted as an attempt record, never as a numeric result or finished mission. A justified RETURN is preserved. No repeat until acceptance; separate semantic audit required.'});
try{
  check(frozen(),'EXPERIMENT_BOUNDARY','Inputs changed before assessment');
  const result=await engine.blind.runReviewed(replicationId,{workers:engine.workers,through:'material'});
  const artifact=store.get('artifact',result.materialArtifactId)?.data;
  const review=artifact?store.get('review',artifact.reviews.at(-1))?.data:null;
  const runs=store.list('run').filter(r=>!oldRunIds.has(r.id));
  const receipt=runs.length===1?runs[0].data.inferenceReceipt:null;
  const checks={assessed:!!artifact&&['ACCEPTED','RETURNED'].includes(artifact.status)&&['INCONCLUSIVE_ACCEPTED','MATERIAL_RETURNED'].includes(result.status),
    exactAttempt:!!artifact&&sha256(JSON.parse(artifact.payload.body).result)===sha256(sealed.result),
    oneClosedReview:captures.length===1&&runs.length===1&&runs[0].data.mode==='reviewer'&&runs[0].data.context.artifactIds.length===1,
    real:receipt?.simulation===false&&receipt.status==='completed',exactRequest:receipt?.contextHash===captures[0]?.requestHash,
    freshThread:typeof receipt?.threadId==='string'&&!priorThreads.includes(receipt.threadId),
    originalStillClosed:store.list('blind-opening').length===0&&store.list('blind-comparison').length===0,
    noReplica:store.list('blind-registration').length===1&&store.get('blind-registration',replicationId).hash===registration.hash
      &&store.get('blind-seal',replicationId).hash===seal.hash&&engine.blind.status(replicationId).state==='INCONCLUSIVE',
    missionUnchanged:store.get('mission',mission.id).hash===mission.hash,noEffects:store.list('effect').length===0,frozen:frozen()};
  const summary={completedAt:new Date().toISOString(),checks,passed:Object.values(checks).every(v=>v===true),result,review,receipt,
    journal:store.verifyJournal(),semanticAudit:'PENDING',caveat:'A reviewed incomplete attempt, not a successful replication or completed factory mission. Exact ID exclusion is not universal semantic leak detection.'};
  write('report.json',engine.report(mission.id));write('result.json',summary);process.stdout.write(JSON.stringify(summary)+'\n');
  if(!summary.passed)process.exitCode=2;
}catch(error){write('failure.json',{at:new Date().toISOString(),code:error.code??'UNKNOWN',capturedRequests:captures.length,journal:store.verifyJournal()});throw error;}
finally{engine.close();source.close();}
