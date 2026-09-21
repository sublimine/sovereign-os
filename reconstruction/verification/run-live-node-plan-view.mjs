// Prospective integration qualification. Original pure-parallel request reused
// verbatim, not its old provider policy, results or success labels.
import * as fs from 'node:fs';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {verifyRuntimeRelease} from '../../factory/lib/runtime-release.mjs';
import {canonical,sha256} from '../../factory/lib/contracts.mjs';
const [directory,runtimeRoot]=process.argv.slice(2);
if(!directory||!runtimeRoot||fs.readdirSync(directory).length)throw Error('New empty directory and frozen runtime required');
const self=new URL(import.meta.url),origin=new URL('./run-live-pure-parallel.mjs',import.meta.url);
const originText=fs.readFileSync(origin,'utf8'),request=originText.match(/const request=`([\s\S]*?)`;/)?.[1];
if(!request||request.includes('${'))throw Error('Exact literal original request required; no evaluation or interpolation');
const release=verifyRuntimeRelease(runtimeRoot),harnessHash=sha256(fs.readFileSync(self)),originHash=sha256(originText);
const frozen=()=>sha256(fs.readFileSync(self))===harnessHash&&sha256(fs.readFileSync(origin))===originHash&&verifyRuntimeRelease(release.directory).releaseId===release.releaseId;
const module=path=>import(pathToFileURL(join(release.directory,path)));
const {FactoryEngine}=await module('factory/lib/engine.mjs'),{CodexProvider}=await module('factory/providers/codex.mjs');
const {inferenceRequestHash}=await module('factory/providers/instruction-profiles.mjs');
const {unpackJsonContext}=await module('factory/lib/context-json-codec.mjs'),{unpackContext}=await module('factory/lib/context-codec.mjs');
const write=(name,value)=>fs.writeFileSync(join(directory,name),JSON.stringify(value,null,2),{flag:'wx',mode:0o600});
const policy={preset:'adaptive-v1',entryMode:'planned',model:'gpt-6-astra',reasoningEffort:'ultra',allowedTools:[],maxParallelPureNodes:2,
  cardEncoding:'compact-json-v1',producerContext:'node-contract-v1'};
const engine=new FactoryEngine({databasePath:join(directory,'state.sqlite'),workspaceRoot:join(directory,'workspaces'),onEvent:e=>process.stdout.write(JSON.stringify(e)+'\n')});
const captures=[];
engine.workers.providerFactory=()=>{
  const provider=new CodexProvider();
  return {async generate(input){
    if(!frozen())throw Object.assign(Error('Frozen experiment changed'),{code:'EXPERIMENT_BOUNDARY'});
    const request={instructions:input.instructions,input:input.input,schema:input.schema,model:input.model,reasoningEffort:input.reasoningEffort,
      ...(input.instructionProfile?{instructionProfile:input.instructionProfile}:{})},requestHash=inferenceRequestHash(request);
    const pending=engine.store.list('run').filter(r=>r.data.expectedRequestHash===requestHash);
    if(pending.length!==1)throw Object.assign(Error('Unambiguous pending worker request required'),{code:'EXPERIMENT_BOUNDARY'});
    const capture={capturedAt:new Date().toISOString(),index:captures.length,runId:pending[0].id,nodeId:pending[0].data.nodeId,mode:pending[0].data.mode,requestHash,request};
    write(`request-${capture.index}.json`,capture);captures.push(capture);
    return provider.generate(input); // Identical object: no request/validator mutation.
  },close:()=>provider.close()};
};
const mission=engine.create(request,policy),controller=new AbortController(),stop=()=>controller.abort();
write('qualification.json',{startedAt:new Date().toISOString(),missionId:mission.id,request,requestHash:sha256(request),policy,release,harnessHash,originHash,
  scope:'Fresh real mission, two bounded independent mathematical products plus accepted integration. Actual requests captured before provider dispatch. Structural plan-view scope, causal gates and result correctness; not semantic blindness through every channel, broad efficiency, OS endurance or whole-mandate acceptance.'});
process.once('SIGTERM',stop);process.once('SIGINT',stop);
try{
  const outcome=await engine.run(mission.id,{signal:controller.signal}),report=engine.report(mission.id);
  const accepted=engine.store.list('artifact').map(r=>r.data).filter(a=>a.missionId===mission.id&&a.status==='ACCEPTED');
  const planArtifact=accepted.find(a=>a.payload.nodeId==='planning'),plan=planArtifact?JSON.parse(planArtifact.payload.body):null;
  const first=accepted.filter(a=>a.payload.kind==='hitting-set'),second=accepted.filter(a=>a.payload.kind==='topological-orders'),final=report.final;
  const parse=a=>{try{return JSON.parse(a?.payload.body);}catch{return null;}};
  const a=parse(first[0]),b=parse(second[0]),c=parse(final);
  const exactKeys=(v,keys)=>v&&canonical(Object.keys(v).sort())===canonical([...keys].sort());
  const text=v=>typeof v==='string'&&v.length>0;
  const A=['a','c'],optima=[['a','c'],['b','d']],orders=[['a','b','c','d'],['b','a','c','d']];
  const projections=captures.filter(c=>c.mode==='producer'&&c.nodeId!=='planning').map(c=>{
    const wire=JSON.parse(c.request.input),input=wire.encoding==='sovereign.lossless-context.v2'?unpackJsonContext(wire):wire.encoding==='sovereign.lossless-context.v1'?unpackContext(wire):wire;
    const task=JSON.parse(input.task),views=input.planViews??[],v=views[0],node=plan?.nodes.find(n=>n.id===c.nodeId);
    const expected=node?{schema:'sovereign.node-contract.v1',node,requirements:plan.requirements.filter(r=>node.id===plan.finalNodeId||node.requirementIds.includes(r.id)),isFinalProduct:node.id===plan.finalNodeId}:null;
    const run=engine.store.get('run',c.runId).data;
    const exact=Boolean(node&&views.length===1&&v.artifactId===planArtifact.id&&v.artifactHash===planArtifact.payloadHash&&v.planHash===sha256(plan)
      &&v.viewHash===sha256(expected)&&canonical(v.view)===canonical(expected)&&canonical(task.node)===canonical(node)
      &&input.missionIntent===request&&!input.artifacts.some(a=>a.id===planArtifact.id||a.payload.nodeId==='planning')
      &&run.context.planViews?.[0].viewHash===v.viewHash&&run.requests.some(r=>r.requestHash===c.requestHash));
    return {index:c.index,runId:c.runId,nodeId:c.nodeId,requestHash:c.requestHash,viewHash:v?.viewHash??null,exact,
      exposedArtifactIds:input.artifacts.map(a=>a.id),exposedRequirementIds:v?.view.requirements.map(r=>r.id)??[]};
  });
  const firstRun=first[0]?engine.store.get('run',first[0].payload.producerRunId)?.data:null,
    secondRun=second[0]?engine.store.get('run',second[0].payload.producerRunId)?.data:null,
    finalRun=final?engine.store.get('run',final.payload.producerRunId)?.data:null;
  const parents=[...first,...second].map(p=>({id:p.id,hash:p.payloadHash,
    consumed:!!final&&final.payload.inputRefs.some(r=>r.artifactId===p.id&&r.hash===p.payloadHash&&r.purpose===p.payload.purpose),
    acceptedBeforeConsumer:!!finalRun&&engine.registry.committedSequence('artifact',p.id,engine.store.get('artifact',p.id).version)<engine.registry.committedSequence('run',finalRun.id,1)}));
  const checks={completed:outcome.mission.status==='COMPLETED'&&final?.status==='ACCEPTED',
    requestedProducts:first.length===1&&second.length===1&&final?.payload.kind==='combined-proof',
    hittingSet:!!exactKeys(a,['chosen','minimumSize','allOptima','argument'])&&canonical(a.chosen)===canonical(A)&&a.minimumSize===2&&canonical(a.allOptima)===canonical(optima)&&text(a.argument),
    orders:!!exactKeys(b,['orders','count','argument'])&&canonical(b.orders)===canonical(orders)&&b.count===2&&text(b.argument),
    integration:!!exactKeys(c,['hittingSet','topologicalOrders','explanation'])&&canonical(c.hittingSet)===canonical(A)&&canonical(c.topologicalOrders)===canonical(orders)&&text(c.explanation),
    projections:projections.length>=3&&projections.every(p=>p.exact),
    noCrossRootProducts:!!firstRun&&!!secondRun&&firstRun.id!==secondRun.id&&!firstRun.context.artifactIds.includes(second[0].id)&&!secondRun.context.artifactIds.includes(first[0].id),
    gates:parents.length===2&&parents.every(p=>p.consumed&&p.acceptedBeforeConsumer),
    reviewed:accepted.length===4&&accepted.every(a=>{const r=engine.store.get('review',a.reviews.at(-1))?.data;return r&&r.reviewerRunId!==a.payload.producerRunId&&r.result.checks.every(c=>c.verdict==='PASS');}),
    noTools:report.effects.length===0,real:report.metrics.completed>0&&report.metrics.liveCompleted===report.metrics.completed&&report.metrics.simulatedCompleted===0,
    capturedBeforeDispatch:captures.length===report.metrics.dispatched&&captures.every(c=>engine.store.get('run',c.runId).data.requests.some(r=>r.requestHash===c.requestHash)),
    frozen:frozen()};
  if(outcome.mission.status==='COMPLETED')await engine.run(mission.id);
  const after=engine.report(mission.id);checks.noReplay=outcome.mission.status==='COMPLETED'&&after.metrics.dispatched===report.metrics.dispatched&&after.effects.length===report.effects.length;
  const summary={completedAt:new Date().toISOString(),missionId:mission.id,release,status:outcome.mission.status,passed:Object.values(checks).every(v=>v===true),checks,
    projections,parents,metrics:report.metrics,products:{hittingSet:a,orders:b,integration:c},pending:outcome.mission.pending,semanticAudit:'PENDING',
    caveat:'Full plans, contracts, products and review reasons need a separate semantic read. No hidden markers were injected into a real plan. Snapshot capture proves dispatched fields and hashes, not independence of every incidental string or model knowledge. Not a before/after efficiency experiment.'};
  write('report.json',report);write('summary.json',summary);process.stdout.write(JSON.stringify(summary)+'\n');if(!summary.passed)process.exitCode=2;
}catch(error){write('failure.json',{at:new Date().toISOString(),code:error.code??'UNKNOWN',capturedRequests:captures.length,requestHashes:captures.map(c=>c.requestHash)});throw error;}
finally{process.removeListener('SIGTERM',stop);process.removeListener('SIGINT',stop);engine.close();}
