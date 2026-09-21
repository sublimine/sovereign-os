// Prospective integrated source-text-v1 qualification; old trials stay immutable.
import * as fs from 'node:fs';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {verifyRuntimeRelease} from '../../factory/lib/runtime-release.mjs';
import {sha256} from '../../factory/lib/contracts.mjs';
import {nativeInputTrialAcceptance} from './native-input-trial-acceptance.mjs';
const [directory,runtimeRoot,sourceFile]=process.argv.slice(2);
if(!directory||!runtimeRoot||!sourceFile||fs.readdirSync(directory).length)throw Error('New empty diagnostic directory, frozen runtime and explicit source required');
const sourceBytes=fs.readFileSync(sourceFile),prior=JSON.parse(sourceBytes),request=prior.request,expected=prior.expected?.body;
if(typeof request!=='string'||typeof expected!=='string'||sha256(request)!==prior.requestHash
  ||sha256(expected)!==prior.expected.sha256||Buffer.byteLength(expected)!==prior.expected.utf8Bytes)throw Error('Original source/oracle integrity failed');
const release=verifyRuntimeRelease(runtimeRoot),self=new URL(import.meta.url),helper=new URL('./native-input-trial-acceptance.mjs',import.meta.url);
const harnessHash=sha256(fs.readFileSync(self)),helperHash=sha256(fs.readFileSync(helper)),sourceHash=sha256(sourceBytes);
const frozen=()=>sha256(fs.readFileSync(self))===harnessHash&&sha256(fs.readFileSync(helper))===helperHash
  &&sha256(fs.readFileSync(sourceFile))===sourceHash&&verifyRuntimeRelease(release.directory).releaseId===release.releaseId;
const module=path=>import(pathToFileURL(join(release.directory,path)));
const {FactoryEngine}=await module('factory/lib/engine.mjs'),{CodexProvider}=await module('factory/providers/codex.mjs');
const {inferenceRequestHash}=await module('factory/providers/instruction-profiles.mjs');
const {inputCopyEvidence}=await module('factory/lib/input-copy.mjs'),{readSourceContextView}=await module('factory/lib/source-context-view.mjs');
const write=(name,value)=>fs.writeFileSync(join(directory,name),JSON.stringify(value,null,2),{flag:'wx',mode:0o600});
const policy={preset:'adaptive-v1',entryMode:'planned',contextEncoding:'source-text-v1',model:'gpt-6-astra',reasoningEffort:'ultra',
  allowedTools:[],maxParallelPureNodes:1,cardEncoding:'compact-json-v1',producerContext:'node-contract-v1',maxPlanAttempts:1,maxNodeAttempts:1};
const engine=new FactoryEngine({databasePath:join(directory,'state.sqlite'),workspaceRoot:join(directory,'workspaces'),onEvent:e=>process.stdout.write(JSON.stringify(e)+'\n')});
engine.workers.maxReviewRepairs=1;
const captures=[],responses=[],boundary=message=>Object.assign(Error(message),{code:'EXPERIMENT_BOUNDARY'});
engine.workers.providerFactory=()=>{const provider=new CodexProvider();return {async generate(input){
  if(!frozen()||captures.length>=5)throw boundary('Frozen boundary or prospective 5-call ceiling reached');
  const sent={instructions:input.instructions,input:input.input,schema:input.schema,model:input.model,reasoningEffort:input.reasoningEffort,
    ...(input.instructionProfile?{instructionProfile:input.instructionProfile}:{})},requestHash=inferenceRequestHash(sent);
  const pending=engine.store.list('run').filter(r=>r.data.expectedRequestHash===requestHash);
  if(pending.length!==1)throw boundary('One exact pending actor required');
  const actor=pending[0].data;
  if(!(actor.mode==='reviewer'||actor.mode==='producer'&&actor.nodeId==='planning'))throw boundary('Only planner and reviewers may infer; native product has no LLM producer');
  const capture={at:new Date().toISOString(),index:captures.length,runId:actor.id,nodeId:actor.nodeId,mode:actor.mode,requestHash,request:sent};
  write(`request-${capture.index}.json`,capture);captures.push(capture);
  const decoded=readSourceContextView(sent.input);
  if(!sent.input.startsWith('SOVEREIGN_SOURCE_CONTEXT_VIEW_V1\n')||decoded.missionIntent!==request)throw boundary('Complete admitted original source view required');
  const response=await provider.generate(input);write(`response-${capture.index}.json`,response);responses.push({index:capture.index,receipt:response.receipt});return response;
},close:()=>provider.close()};};
// The engine creates the closed adapter before this diagnostic wrapper. Bind
// that path too, so an unexpected planned adapter cannot escape the same actor
// and call-budget checks. Replicator actors are rejected before provider use.
engine.blind.providerFactory=engine.workers.providerFactory;
const mission=engine.create(request,policy),controller=new AbortController(),stop=()=>controller.abort();
write('qualification.json',{startedAt:new Date().toISOString(),missionId:mission.id,sourceFile,sourceHash,request,requestHash:sha256(request),
  expected:{body:expected,sha256:sha256(expected),utf8Bytes:Buffer.byteLength(expected)},policy,release,harnessHash,helperHash,maxProviderCalls:5,maxReviewRepairs:1,
  scope:'Known source diagnostic, one plan attempt, no ordinary LLM product or tools. Actual subscription planner and independent reviews with complete source-text-v1 context; native bytes and origin are checked separately. Not a new holdout, causal efficiency comparison, install or whole-mandate acceptance.'});
process.once('SIGTERM',stop);process.once('SIGINT',stop);
try{
  await engine.run(mission.id,{signal:controller.signal,pauseOnAbort:true});
  const report=engine.report(mission.id),final=report.final;
  write('report.json',report);
  const proof=final?.payload.kind==='literal-input-copy'?inputCopyEvidence(engine.registry,final.id):null;
  if(proof)write('native-origin-proof.json',proof);
  const native=engine.store.list('input-copy-origin').filter(r=>r.data.signed.data.missionId===mission.id);
  const coreState=(ignoreValidationId='')=>sha256(engine.store.db.prepare("SELECT type,id,version,hash FROM records WHERE type!='engine' AND NOT(type='workspace-validation' AND id=?) ORDER BY type,id,version").all(ignoreValidationId).map(r=>({...r})));
  const before=engine.store.verifyJournal(),beforeCore=coreState();if(report.mission.status==='COMPLETED')await engine.run(mission.id);
  const after=engine.report(mission.id);
  const reentryEvents=engine.store.events({after:before.events,limit:1000});
  const validationEvent=reentryEvents.find(e=>e.kind==='workspace.validation'),validationRecord=validationEvent?engine.store.get('workspace-validation',validationEvent.data.validationId):null;
  const validation=validationRecord?engine.authority.open(validationRecord.data.signed,'workspace.validation'):null;
  const validationId=validationRecord?.id??'';
  const unchangedReentry=report.mission.status==='COMPLETED'&&coreState(validationId)===beforeCore&&reentryEvents.length===4
    &&reentryEvents[0].kind==='record.committed'&&reentryEvents[0].data.type==='engine'&&reentryEvents[0].data.id==='exclusive'
    &&reentryEvents[1].kind==='record.committed'&&reentryEvents[1].data.type==='workspace-validation'&&reentryEvents[1].data.id===validationId
    &&reentryEvents[2]===validationEvent&&reentryEvents[3].kind==='record.committed'&&reentryEvents[3].data.type==='engine'&&reentryEvents[3].data.id==='exclusive'
    &&validationRecord?.version===1&&validation?.missionId===mission.id&&validation.artifactId===final.id&&validation.artifactHash===final.payloadHash
    &&validation.status==='UNCHANGED'&&validation.files.length===0&&validation.executions.length===0&&!(validation.listings?.length)
    &&validation.principalId===engine.store.get('review',final.reviews.at(-1)).data.reviewerRunId;
  write('reentry.json',{before,after:engine.store.verifyJournal(),beforeCore,afterCoreIgnoringNewValidation:coreState(validationId),events:reentryEvents,validation:validationRecord,
    scope:'Reentry acquires/releases the coordinator lock and records one authenticated empty workspace revalidation. Those four events are expected; every previous non-engine record version and all products, reviews, origins and inference counts must remain unchanged.'});
  const checks={...nativeInputTrialAcceptance(report,{request,expected}),oneNativeOrigin:native.length===1&&!!proof&&proof.binding.run.id===native[0].id,
    nativeBytes:!!proof&&proof.selection.body===expected&&proof.selection.bodySha256===sha256(expected)&&proof.selection.bodyUtf8Bytes===Buffer.byteLength(expected),
    actual:report.metrics.completed>0&&report.metrics.liveCompleted===report.metrics.completed&&report.metrics.simulatedCompleted===0,
    captured:captures.length===report.metrics.dispatched&&responses.length===report.metrics.completed&&responses.every(r=>r.receipt.simulation===false&&r.receipt.status==='completed'
      &&r.receipt.model==='gpt-6-astra'&&r.receipt.reasoningEffort==='ultra'&&r.receipt.contextHash===captures[r.index].requestHash),
    noEffects:report.effects.length===0,noReplay:report.mission.status==='COMPLETED'&&after.metrics.dispatched===report.metrics.dispatched
      &&after.final?.id===final.id&&unchangedReentry,frozen:frozen()};
  const summary={completedAt:new Date().toISOString(),missionId:mission.id,status:report.mission.status,release,checks,passed:Object.values(checks).every(v=>v===true),
    metrics:report.metrics,pending:report.mission.pending,journal:engine.store.verifyJournal(),semanticAudit:'PENDING',
    caveat:'Read the full accepted plan, exact source exposures, native proof and every independent reviewer reason. Rejected provider-call usage may be unknown. Passing this known diagnostic does not establish broad semantic correctness or efficiency.'};
  write('summary.json',summary);process.stdout.write(JSON.stringify({directory,status:summary.status,passed:summary.passed,completedAt:summary.completedAt})+'\n');
  if(!summary.passed)process.exitCode=2;
}catch(error){write('failure.json',{at:new Date().toISOString(),code:error.code??'UNKNOWN',capturedRequests:captures.length,completedResponses:responses.length});throw error;}
finally{process.removeListener('SIGTERM',stop);process.removeListener('SIGINT',stop);engine.close();}
