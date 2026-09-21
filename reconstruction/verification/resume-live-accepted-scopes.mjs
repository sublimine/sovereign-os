// Scoped continuation of a diagnosed evidence-availability failure, not a new
// trial or a rewrite of its original verdict. No policy/criteria/provider edits.
import * as fs from 'node:fs';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {DatabaseSync} from 'node:sqlite';
import {canonical,sha256,check} from '../../factory/lib/contracts.mjs';
import {verifyRuntimeRelease} from '../../factory/lib/runtime-release.mjs';
import {Store} from '../../factory/lib/store.mjs';

const [directory,runtimeRoot,option]=process.argv.slice(2);
const source='/home/cardeex/codex-workspace/sovereign-standalone-live-rjsI0udG';
const missionId='mission:75bb5c2e-6743-4b64-a347-824b99232721';
check(directory&&runtimeRoot&&fs.readdirSync(directory).length===0,'EXPERIMENT_BOUNDARY','New empty output directory and frozen runtime required');
check(!option||option==='--check-only','EXPERIMENT_BOUNDARY','Unknown option');
const release=verifyRuntimeRelease(runtimeRoot,'0251b72a3802f181f1d3dcbbe51fc21f01d85dc30d9126f912b29d34c936d244');
const harnessHash=sha256(fs.readFileSync(new URL(import.meta.url)));
const originalFiles=Object.fromEntries(fs.readdirSync(source).filter(n=>n.endsWith('.json')).map(n=>[n,sha256(fs.readFileSync(join(source,n)))]));
const db=new DatabaseSync(join(source,'state.sqlite'),{readOnly:true});db.exec('BEGIN');
const readonly={db,get:Store.prototype.get,list:Store.prototype.list,events:Store.prototype.events};
const journal=Store.prototype.verifyJournal.call(readonly),mission=readonly.get('mission',missionId),plan=readonly.get('plan',missionId);
check(journal.events===332&&journal.head==='8114ad8a78b18ccc08e274fe0e3659e3ad3ee034af0b3e96ca352d41f0ce6767','EXPERIMENT_BOUNDARY','Original trial already advanced or differs');
check(mission?.data.status==='WAITING_CAPABILITY'&&mission.data.pending.length===1&&mission.data.pending[0].nodeId==='combined','EXPERIMENT_BOUNDARY','Exact diagnosed blocking state required');
const parents=readonly.list('artifact').filter(r=>r.data.missionId===missionId&&['hitting','orders'].includes(r.data.payload.nodeId));
check(parents.length===2&&parents.every(r=>r.data.status==='ACCEPTED'),'EXPERIMENT_BOUNDARY','Two original accepted parents required');
const protectedRecords=[plan,readonly.get('artifact',plan.data.acceptedPlanArtifactId),...parents,
  ...parents.flatMap(a=>[readonly.get('node',missionId+':'+a.data.payload.nodeId),readonly.get('run',a.data.payload.producerRunId),readonly.get('worker-config',a.data.payload.producerRunId),readonly.get('review',a.data.reviews.at(-1))])]
  .map(r=>({type:r.type,id:r.id,version:r.version,hash:r.hash}));
const beforeMetrics=JSON.parse(fs.readFileSync(join(source,'summary.json'))).metrics;
const before={journal,mission:{id:mission.id,version:mission.version,hash:mission.hash,intentHash:mission.data.intentHash,policy:mission.data.policy},protectedRecords,originalFiles,beforeMetrics};db.close();
const scope='Same mission recovery with accepted-input production scopes. Original 45dfce77 trial remains WAITING_CAPABILITY. Frozen request, policy, plan, criteria, parent products and their gates retained. Not a fresh full-runtime trial or a causal efficiency comparison.';
if(option==='--check-only'){process.stdout.write(JSON.stringify({checkOnly:true,release,harnessHash,before,scope})+'\n');process.exit(0);}
const mod=p=>import(pathToFileURL(join(release.directory,p)));
const {FactoryEngine}=await mod('factory/lib/engine.mjs'),{CodexProvider}=await mod('factory/providers/codex.mjs');
const {inferenceRequestHash}=await mod('factory/providers/instruction-profiles.mjs');
const {unpackJsonContext}=await mod('factory/lib/context-json-codec.mjs'),{unpackContext}=await mod('factory/lib/context-codec.mjs');
const {productionScope}=await mod('factory/lib/production-scope.mjs'),{dependencyGates}=await mod('factory/lib/dependency-gates.mjs');
const decode=input=>{const wire=JSON.parse(input);return wire.encoding==='sovereign.lossless-context.v2'?unpackJsonContext(wire):wire.encoding==='sovereign.lossless-context.v1'?unpackContext(wire):wire;};
const write=(name,value)=>fs.writeFileSync(join(directory,name),JSON.stringify(value,null,2),{flag:'wx',mode:0o600});
const unchanged=()=>Object.entries(originalFiles).every(([n,h])=>sha256(fs.readFileSync(join(source,n)))===h);
const frozen=()=>unchanged()&&sha256(fs.readFileSync(new URL(import.meta.url)))===harnessHash&&verifyRuntimeRelease(release.directory).releaseId===release.releaseId;
const engine=new FactoryEngine({databasePath:join(source,'state.sqlite'),workspaceRoot:join(source,'workspaces'),onEvent:e=>process.stdout.write(JSON.stringify(e)+'\n')});
const preserved=()=>protectedRecords.every(r=>{const now=engine.store.get(r.type,r.id);return now?.version===r.version&&now.hash===r.hash;})
  &&engine.store.get('mission',missionId).data.intentHash===before.mission.intentHash
  &&canonical(engine.store.get('mission',missionId).data.policy)===canonical(before.mission.policy);
const captures=[],controller=new AbortController(),stop=()=>controller.abort();
engine.workers.providerFactory=()=>{
  const provider=new CodexProvider();
  return {async generate(input){
    check(frozen()&&preserved(),'EXPERIMENT_BOUNDARY','Recovery scope changed');
    check(captures.length<6,'CAPABILITY','Prospective six-call recovery bound reached');
    const request={instructions:input.instructions,input:input.input,schema:input.schema,model:input.model,reasoningEffort:input.reasoningEffort,
      ...(input.instructionProfile?{instructionProfile:input.instructionProfile}:{})},requestHash=inferenceRequestHash(request);
    const pending=engine.store.list('run').filter(r=>r.data.expectedRequestHash===requestHash);
    check(pending.length===1&&pending[0].data.missionId===missionId&&['combined','review:combined'].includes(pending[0].data.nodeId),'EXPERIMENT_BOUNDARY','Only final integration and its review may dispatch');
    const capture={index:captures.length,capturedAt:new Date().toISOString(),runId:pending[0].id,nodeId:pending[0].data.nodeId,mode:pending[0].data.mode,requestHash,request};
    write(`request-${capture.index}.json`,capture);captures.push(capture);return provider.generate(input);
  },close:()=>provider.close()};
};
write('qualification.json',{startedAt:new Date().toISOString(),missionId,source,release,harnessHash,maxAdditionalCalls:6,before,scope});
engine.store.append('qualification.resume',{missionId,release,harnessHash,originalJournal:journal,outputDirectory:directory,reason:scope});
process.once('SIGTERM',stop);process.once('SIGINT',stop);
try{
  const outcome=await engine.run(missionId,{signal:controller.signal}),report=engine.report(missionId),final=report.final;
  const parse=a=>{try{return JSON.parse(a?.payload.body);}catch{return null;}};
  const first=parents.find(a=>a.data.payload.nodeId==='hitting').data,second=parents.find(a=>a.data.payload.nodeId==='orders').data;
  const a=parse(first),b=parse(second),c=parse(final),A=['a','c'],optima=[['a','c'],['b','d']],orders=[['a','b','c','d'],['b','a','c','d']];
  const exactKeys=(v,keys)=>v&&canonical(Object.keys(v).sort())===canonical([...keys].sort()),text=v=>typeof v==='string'&&v.length>0;
  const material=captures.filter(c=>c.mode==='producer').map(q=>({capture:q,input:decode(q.request.input)}));
  const expectedNode=plan.data.plan.nodes.find(n=>n.id==='combined'),planArtifact=engine.store.get('artifact',plan.data.acceptedPlanArtifactId).data;
  const projections=material.every(({input})=>{const expected={schema:'sovereign.node-contract.v1',node:expectedNode,requirements:plan.data.plan.requirements,isFinalProduct:true},v=input.planViews?.[0];
    return input.planViews?.length===1&&v.artifactId===planArtifact.id&&v.artifactHash===planArtifact.payloadHash&&v.planHash===sha256(plan.data.plan)&&v.viewHash===sha256(expected)&&canonical(v.view)===canonical(expected)&&canonical(JSON.parse(input.task).node)===canonical(expectedNode)&&input.missionIntent===mission.data.intent&&!input.artifacts.some(a=>a.payload.nodeId==='planning');});
  const exposedScopes=material.map(({capture,input})=>({runId:capture.runId,scopes:(input.runtimeObservations??[]).filter(o=>o.kind==='artifact-production-scope').map(o=>JSON.parse(o.quoteText).detail)}));
  const scopeChecks=exposedScopes.length>0&&exposedScopes.every(x=>x.scopes.length===2&&parents.every(p=>x.scopes.some(s=>canonical(s)===canonical(productionScope(engine.registry,p.id)))));
  const accepted=engine.store.list('artifact').map(r=>r.data).filter(a=>a.missionId===missionId&&a.status==='ACCEPTED');
  const finalGates=final?dependencyGates(engine.registry,final.id):null;
  const checks={completed:outcome.mission.status==='COMPLETED'&&final?.status==='ACCEPTED',requestedProducts:accepted.length===4&&final?.payload.kind==='combined-proof',
    hittingSet:!!exactKeys(a,['chosen','minimumSize','allOptima','argument'])&&canonical(a.chosen)===canonical(A)&&a.minimumSize===2&&canonical(a.allOptima)===canonical(optima)&&text(a.argument),
    orders:!!exactKeys(b,['orders','count','argument'])&&canonical(b.orders)===canonical(orders)&&b.count===2&&text(b.argument),
    integration:!!exactKeys(c,['hittingSet','topologicalOrders','explanation'])&&canonical(c.hittingSet)===canonical(A)&&canonical(c.topologicalOrders)===canonical(orders)&&text(c.explanation),
    projections:material.length>0&&projections,noCrossRootProducts:preserved()&&parents.every(p=>!engine.store.get('run',p.data.payload.producerRunId).data.context.artifactIds.some(id=>parents.some(other=>other.id!==p.id&&other.id===id))),
    gates:finalGates?.dependencies.length===2&&finalGates.dependencies.every(d=>d.acceptedBeforeFirstAttempt&&d.review.completePassingChecks&&d.review.separateCompletedReviewerExposure),
    reviewed:accepted.length===4&&accepted.every(a=>{const r=engine.store.get('review',a.reviews.at(-1))?.data;return r&&r.reviewerRunId!==a.payload.producerRunId&&r.result.checks.every(c=>c.verdict==='PASS');}),
    noTools:report.effects.length===0,real:report.metrics.completed>beforeMetrics.completed&&report.metrics.liveCompleted===report.metrics.completed&&report.metrics.simulatedCompleted===0,
    capturedBeforeDispatch:captures.length===report.metrics.dispatched-beforeMetrics.dispatched&&captures.every(c=>engine.store.get('run',c.runId).data.requests.some(r=>r.requestHash===c.requestHash)),
    frozen:frozen(),acceptedParentScopes:scopeChecks,originalRecordsPreserved:preserved(),onlyFinalDispatched:captures.length>0&&captures.every(c=>['combined','review:combined'].includes(c.nodeId))};
  if(outcome.mission.status==='COMPLETED')await engine.run(missionId);
  const after=engine.report(missionId);checks.noReplay=outcome.mission.status==='COMPLETED'&&after.metrics.dispatched===report.metrics.dispatched&&after.effects.length===report.effects.length;
  const summary={completedAt:new Date().toISOString(),missionId,release,status:outcome.mission.status,passed:Object.values(checks).every(x=>x===true),checks,exposedScopes,finalGates,
    products:{hittingSet:a,orders:b,integration:c},metrics:report.metrics,additionalCalls:report.metrics.dispatched-beforeMetrics.dispatched,pending:outcome.mission.pending,semanticAudit:'PENDING',scope};
  write('report.json',report);write('summary.json',summary);process.stdout.write(JSON.stringify({status:summary.status,passed:summary.passed,checks,additionalCalls:summary.additionalCalls,pending:summary.pending})+'\n');if(!summary.passed)process.exitCode=2;
}catch(error){write('failure.json',{at:new Date().toISOString(),code:error.code??'UNKNOWN',message:error.message,capturedRequests:captures.length});throw error;}
finally{process.removeListener('SIGTERM',stop);process.removeListener('SIGINT',stop);engine.close();}
