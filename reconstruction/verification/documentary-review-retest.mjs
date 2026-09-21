// A diagnostic branch of a CLOSED trial, never a resume or delivery of it.
// Keep its candidate, source snapshots, old failures and policy byte-for-byte;
// only one fresh documentary reviewer runs under the qualified new runtime.
import * as fs from 'node:fs';
import {join,resolve} from 'node:path';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {canonical,sha256} from '../../factory/lib/contracts.mjs';
import {captureProcessIdentity,ownerProcessIsAlive} from '../../factory/lib/process-identity.mjs';
import {qualifyFullRoute} from './run-live-full-route.mjs';
import {writeRouteEvidence} from './full-route-harness.mjs';
import {verifiedRouteSources} from './full-route-audit.mjs';
import {FULL_ROUTE_CASES,gradeRouteContent} from './full-route-cases.mjs';

const boundary=(ok,message)=>{if(!ok)throw Object.assign(Error(message),{code:'EXPERIMENT_BOUNDARY'});};
export function closedDatabaseHash(path){
  const stat=fs.lstatSync(path);
  boundary(stat.isFile()&&!stat.isSymbolicLink(),'Regular closed source database required');
  for(const suffix of ['-wal','-journal'])boundary(!fs.existsSync(path+suffix)||fs.lstatSync(path+suffix).isFile()&&fs.statSync(path+suffix).size===0,
    'Uncheckpointed or active database cannot be copied');
  return sha256(fs.readFileSync(path));
}

export async function runDocumentaryReviewRetest({runtimeRoot,directory,sourceDatabase,artifactId,reviewerRoleIds,
  sourceOwner,providerFactory,simulation=true,frozen=()=>true,signal,maxCalls=6,runtimeQualification=null}){
  boundary(fs.readdirSync(directory).length===0,'New empty diagnostic directory required');
  boundary(Number.isInteger(maxCalls)&&maxCalls>=1&&maxCalls<=6,'Explicit maximum of six calls');
  boundary(simulation||sourceOwner&&!ownerProcessIsAlive(sourceOwner),'Real trial owner must be positively inactive');
  boundary(frozen()&&!signal?.aborted,'Qualified runtime before copying');
  const originalHash=closedDatabaseHash(sourceDatabase),unchanged=()=>{
    try{return closedDatabaseHash(sourceDatabase)===originalHash&&frozen()&&!signal?.aborted
      &&(simulation||!ownerProcessIsAlive(sourceOwner));}catch{return false;}
  };
  const local=join(directory,'state.sqlite');fs.copyFileSync(sourceDatabase,local,fs.constants.COPYFILE_EXCL);fs.chmodSync(local,0o600);
  boundary(sha256(fs.readFileSync(local))===originalHash&&unchanged(),'Exact stable database copy required');
  const load=path=>import(pathToFileURL(join(runtimeRoot,path)));
  const {FactoryEngine}=await load('factory/lib/engine.mjs');
  const {readSourceContextView}=await load('factory/lib/source-context-view.mjs');
  const {inferenceRequestHash}=await load('factory/providers/instruction-profiles.mjs');
  const {validateDocumentClaims,validateDocumentReview}=await load('factory/lib/documentary-material.mjs');
  const engine=new FactoryEngine({databasePath:local,workspaceRoot:join(directory,'unused-workspace')});
  const {store,registry}=engine,write=(name,value)=>writeRouteEvidence(directory,name,value),calls=[];
  // The diagnostic ceiling is the real remaining step budget, not a hidden
  // limit that lets the worker announce twelve steps while only six can run.
  engine.workers.maxSteps=maxCalls;
  let candidate,mission,before,review=null,fatal=null,runId=null,candidateContentCheck=null,ownWindowCounts=[];
  engine.broker.execute=async()=>{boundary(false,'This diagnostic cannot acquire sources, execute code or operate workspace tools');};
  try{
    candidate=store.get('artifact',artifactId)?.data;mission=candidate&&store.get('mission',candidate.missionId);
    boundary(candidate?.status==='CANDIDATE'&&candidate.payload.documentary&&mission?.data.policy.documentContext==='literal-windows-v1'
      &&!mission.data.finalArtifactId&&(!simulation?mission.data.status==='FAILED':true),'Unaccepted documentary candidate from an incomplete mission required');
    boundary(store.list('effect').every(r=>r.data.missionId===mission.id&&r.data.tool==='source.fetch'&&r.data.state==='SUCCEEDED')
      &&store.list('artifact').every(r=>!(r.data.payload.requiredEffects?.length)),'Read-only source history without workspace obligations required');
    const spec=store.get('node',`${mission.id}:${candidate.payload.nodeId}`)?.data.spec;
    boundary(simulation||spec&&canonical(spec.reviewerRoleIds)===canonical(reviewerRoleIds),'Preserve the accepted plan reviewer assignments');
    validateDocumentClaims(registry,store.get('run',candidate.payload.producerRunId).data,candidate.payload.claims,candidate.payload.documentary);
    if(!simulation){
      boundary(mission.data.intent===FULL_ROUTE_CASES[1].request,'Known original request only');
      const sources=verifiedRouteSources(engine,mission.id,mission.data.createdAt);
      boundary(sources.length===2&&store.get('run',candidate.payload.producerRunId).data.inferenceReceipts.every(r=>r.simulation===false),
        'Two verified original acquisitions and a real producer required');
      candidateContentCheck=gradeRouteContent(FULL_ROUTE_CASES[1],candidate.payload.body,{sources});
    }
    before=store.db.prepare('SELECT r.type,r.id,r.version,r.hash FROM records r JOIN heads h USING(type,id,version) ORDER BY r.type,r.id').all().map(r=>({...r}));
    write('qualification.json',{startedAt:new Date().toISOString(),owner:{pid:process.pid,processIdentity:captureProcessIdentity()},simulation,
      sourceDatabase:resolve(sourceDatabase),originalHash,sourceOwner,sourceJournal:store.verifyJournal(),artifactId,candidateHash:candidate.payloadHash,
      mission:mission.data,reviewerRoleIds,maxCalls,historicalHeadsHash:sha256(before),runtimeQualification,
      scope:'Diagnostic copy only. No planner, producer, new acquisition, ordinary queue, policy change, historical failure reset or delivery. One fresh judge with its own grants/windows; six-call ceiling includes navigation and bounded corrections. A pass is not original mission recovery or full-route qualification.'});
    engine.workers.providerFactory=()=>{let provider;return {async generate(input){
      boundary(unchanged()&&calls.length<maxCalls,'Freeze, original database, interruption or call ceiling');
      const request={instructions:input.instructions,input:input.input,schema:input.schema,model:input.model,reasoningEffort:input.reasoningEffort,
        ...(input.instructionProfile?{instructionProfile:input.instructionProfile}:{})};
      const requestHash=inferenceRequestHash(request),actors=store.list('run').filter(r=>r.data.expectedRequestHash===requestHash);
      boundary(actors.length===1,'One exact pending reviewer');
      const actor=actors[0].data,exposure=readSourceContextView(input.input),task=JSON.parse(exposure.task),config=store.get('worker-config',actor.id).data;
      boundary(actor.mode==='reviewer'&&actor.nodeId===`review:${candidate.payload.nodeId}`&&(!runId||actor.id===runId)
        &&canonical(config.roleIds)===canonical(reviewerRoleIds)&&exposure.missionIntent===mission.data.intent
        &&task.candidateId===candidate.id&&task.artifactHash===candidate.payloadHash
        &&canonical([...task.criteria,...task.runtimeCriteria].sort((a,b)=>a.id.localeCompare(b.id)))===canonical([...candidate.payload.criteria].sort((a,b)=>a.id.localeCompare(b.id)))
        &&input.model===mission.data.policy.model&&input.reasoningEffort===mission.data.policy.reasoningEffort
        &&sha256(config.instructions)===config.prefixHash&&input.instructions.startsWith(config.instructions),'Exact frozen candidate, mandate, policy, full roles and criteria required');
      if(!runId)boundary(exposure.documentSourceViews.length===0&&exposure.documentNavigation.operations.length===0,'New judge must start without borrowed reading');
      runId=actor.id;ownWindowCounts.push(exposure.documentSourceViews.length);
      const call={index:calls.length,runId,requestHash,startedAt:new Date().toISOString(),receipt:null,error:null};calls.push(call);
      write(`request-${call.index}.json`,{...call,request,prefixHash:config.prefixHash});
      try{
        provider=providerFactory();const response=await provider.generate({...input,validate:async()=>true});
        write(`response-${call.index}.json`,response);call.receipt=response.receipt??null;
        boundary(unchanged(),'Runtime and original snapshot must remain fixed through completion');
        boundary(response.receipt?.status==='completed'&&response.receipt.simulation===simulation&&response.receipt.contextHash===requestHash
          &&response.receipt.model===input.model&&response.receipt.reasoningEffort===input.reasoningEffort,'Exact completed classified receipt');
        await input.validate(response.value);return response;
      }catch(error){call.error={code:error.code??'UNKNOWN'};throw error;}
      finally{call.completedAt=new Date().toISOString();write(`call-${call.index}.json`,call);}
    },async close(){if(provider)await provider.close();}};};
    const outcome=await engine.workers.review({artifact:candidate,reviewerRoleIds,missionIntent:mission.data.intent,signal});
    review=store.get('review',outcome.reviews.at(-1)).data;
    if(outcome.status==='ACCEPTED'){
      registry.assertUsable(outcome.id,{missionId:mission.id,purpose:outcome.payload.purpose});
      validateDocumentReview(registry,store.get('run',runId).data,review.result,outcome,review.documentary);
    }
  }catch(error){fatal={code:error.code??'UNKNOWN'};}
  try{
    const historicalHeadsUnchanged=!!before&&before.every(pin=>pin.type==='artifact'&&pin.id===artifactId
      ?canonical(store.get('artifact',artifactId).data.payload)===canonical(candidate.payload):store.get(pin.type,pin.id)?.hash===pin.hash);
    const added=before?store.db.prepare('SELECT type,id FROM heads ORDER BY type,id').all().filter(r=>!before.some(p=>p.type===r.type&&p.id===r.id)):[];
    const checks={historicalHeadsUnchanged,originalUnchanged:unchanged(),missionNotCompleted:!!mission&&store.get('mission',mission.id).hash===mission.hash&&!mission.data.finalArtifactId,
      noNewEffectsOrProducts:!!before&&!added.some(r=>['effect','artifact','source','mission','node','plan'].includes(r.type)),
      oneFreshReviewer:added.filter(r=>r.type==='run').length===1&&added.filter(r=>r.type==='run').every(r=>r.id===runId),
      sameCandidate:!!candidate&&store.get('artifact',artifactId).data.payloadHash===candidate.payloadHash,
      independentWindows:ownWindowCounts[0]===0&&!!review?.documentary&&review.reviewerRunId===runId&&runId!==candidate?.payload.producerRunId,
      completeReview:!!review&&canonical(review.result.checks.map(c=>c.criterionId).sort())===canonical(candidate.payload.criteria.map(c=>c.id).sort()),
      accepted:review?.result.decision==='ACCEPT',completeCalls:calls.length>0&&calls.every(c=>c.receipt&&!c.error)};
    const tokens=calls.map(c=>c.receipt?.usage?.totalTokens).filter(Number.isFinite);
    const summary={completedAt:new Date().toISOString(),passed:!fatal&&Object.values(checks).every(v=>v===true),fatal,checks,simulation,
      missionId:mission?.id,artifactId,candidateHash:candidate?.payloadHash,runId,review,ownWindowCounts,calls,
      totalTokensObserved:tokens.length?tokens.reduce((a,b)=>a+b,0):null,totalTokenCoverage:tokens.length===calls.length,
      originalHash,candidateContentCheck,journal:store.verifyJournal(),semanticAudit:'PENDING',scope:'Review-stage diagnostic copy only; original mission remains failed, never delivered or reclassified.'};
    write('summary.json',summary);return summary;
  }finally{engine.close();}
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  process.umask(0o077);
  const [directory,runtimeRoot,suitePath,sourceTrial,artifactId]=process.argv.slice(2);
  boundary(directory&&runtimeRoot&&suitePath&&sourceTrial&&artifactId&&process.argv.length===7,'Explicit new output, release, suite, original trial and candidate required');
  const qualified=qualifyFullRoute(runtimeRoot,suitePath),original=JSON.parse(fs.readFileSync(join(sourceTrial,'qualification.json'))),terminal=JSON.parse(fs.readFileSync(join(sourceTrial,'summary.json')));
  boundary(qualified.pins.some(p=>p.path===fileURLToPath(import.meta.url))&&terminal.passed===false&&terminal.missionStatus==='FAILED'
    &&original.spec?.id==='distinct-literal-windows-v1'&&!ownerProcessIsAlive(original.owner),'Pinned harness and closed failed documentary trial required');
  const sourceDatabase=join(sourceTrial,original.spec.id,'state.sqlite');
  const {CodexProvider}=await import(pathToFileURL(join(runtimeRoot,'factory/providers/codex.mjs')));
  const controller=new AbortController(),stop=()=>controller.abort();process.once('SIGTERM',stop);process.once('SIGINT',stop);
  try{
    const result=await runDocumentaryReviewRetest({runtimeRoot,directory,sourceDatabase,artifactId,reviewerRoleIds:['veritas_06','omega_22'],
      sourceOwner:original.owner,simulation:false,frozen:qualified.frozen,signal:controller.signal,providerFactory:()=>new CodexProvider(),
      runtimeQualification:{...qualified,frozen:undefined,originalTrial:sourceTrial,originalSummaryHash:sha256(fs.readFileSync(join(sourceTrial,'summary.json')))}});
    process.stdout.write(JSON.stringify({directory,passed:result.passed,fatal:result.fatal,runId:result.runId,calls:result.calls.length,tokens:result.totalTokensObserved})+'\n');
    process.exitCode=result.passed?0:2;
  }finally{process.removeListener('SIGTERM',stop);process.removeListener('SIGINT',stop);}
}
