// Bounded real orchestration qualification, not a substitute for the portfolio
// integration or a proof of general strategic quality. Frozen before dispatch.
import * as fs from 'node:fs';
import {join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {canonical,sha256} from '../../factory/lib/contracts.mjs';
import {verifyRuntimeRelease} from '../../factory/lib/runtime-release.mjs';
const request=`Produce three distinct in-memory JSON artifacts for a bounded mathematical integration. No files, code execution, source acquisition or external tools are needed or authorized.
First independent prerequisite: outputKind hitting-set. For the universe ["a","b","c","d"] and sets [["a","b"],["b","c"],["c","d"],["a","d"]], derive a smallest hitting set. Its JSON body has exactly {chosen:string[],minimumSize:number,allOptima:string[][],argument:string}. Arrays use ascending JS string order, allOptima uses lexicographic array order, and chosen is the lexicographically first minimum-cardinality optimum. Give a complete short public correctness argument, distinguishing a lower bound from a feasible construction.
Second independent prerequisite: outputKind topological-orders. For vertices ["a","b","c","d"] and directed edges [["a","c"],["b","c"],["c","d"]], derive every topological order. Its JSON body has exactly {orders:string[][],count:number,argument:string}. List orders in lexicographic array order and justify exhaustiveness. Neither prerequisite may receive or consume the other prerequisite; their mathematical inputs are completely specified here.
Final product: outputKind combined-proof. Only after independent acceptance of both prerequisites, consume their exact artifact IDs and hashes and return JSON with exactly {hittingSet:string[],topologicalOrders:string[][],explanation:string}. Preserve both prerequisite results and explain how the integration depends on the two distinct accepted products. The runtime inputRefs are the binding evidence for consumed IDs/hashes; do not invent extra references or acceptance receipts in the JSON body.
Use only the material stages necessary for these three products, with independently reviewed acceptance at each boundary. Public mathematical derivations from the supplied specification are sufficient evidence for these closed problems; do not invent source IDs, executed tests, measurements, or previous completed review of the current candidate. This is an orchestration qualification, not a benchmark proving world superiority or general task quality.`;
const [directory,runtimeRoot]=process.argv.slice(2);
if(!directory||!runtimeRoot||fs.readdirSync(directory).length)throw Error('New empty directory and exact runtime required');
const release=verifyRuntimeRelease(runtimeRoot),harnessHash=sha256(fs.readFileSync(new URL(import.meta.url)));
const {FactoryEngine}=await import(pathToFileURL(join(release.directory,'factory/lib/engine.mjs')));
const policy={model:'gpt-5.6-sol',reasoningEffort:'high',allowedTools:[],maxParallelPureNodes:2,instructionProfile:'scoped-v1',contextEncoding:'lossless-json-v2',reviewEncoding:'evidence-refs-v1'};
const engine=new FactoryEngine({databasePath:join(directory,'state.sqlite'),workspaceRoot:join(directory,'workspaces'),onEvent:e=>process.stdout.write(JSON.stringify(e)+'\n')});
const write=(name,value)=>fs.writeFileSync(join(directory,name),JSON.stringify(value,null,2),{flag:'wx',mode:0o600});
const mission=engine.create(request,policy),controller=new AbortController(),stop=()=>controller.abort();
write('qualification.json',{startedAt:new Date().toISOString(),missionId:mission.id,request,policy,release,harnessHash,
  scope:'Real pure-node concurrency, causal acceptance and no-duplicate final proposal. Two small closed mathematical problems; no broad quality or token-efficiency inference.'});
process.once('SIGTERM',stop);process.once('SIGINT',stop);
try{
  const outcome=await engine.run(mission.id,{signal:controller.signal}),report=engine.report(mission.id);
  const accepted=engine.store.list('artifact').map(r=>r.data).filter(a=>a.missionId===mission.id&&a.status==='ACCEPTED');
  const pick=kind=>accepted.filter(a=>a.payload.kind===kind),a=pick('hitting-set'),b=pick('topological-orders'),final=report.final;
  const parse=a=>{try{return JSON.parse(a?.payload.body);}catch{return null;}};
  const av=parse(a[0]),bv=parse(b[0]),fv=parse(final);
  const expectedA={chosen:['a','c'],minimumSize:2,allOptima:[['a','c'],['b','d']]},expectedOrders=[['a','b','c','d'],['b','a','c','d']];
  const exactKeys=(o,names)=>!!o&&canonical(Object.keys(o).sort())===canonical(names.sort());
  const runFor=a=>a?engine.store.get('run',a.payload.producerRunId)?.data:null,ar=runFor(a[0]),br=runFor(b[0]),fr=runFor(final);
  const events=[];let after=0;
  for(;;){const page=engine.store.events({after,limit:1000});if(!page.length)break;events.push(...page);after=page.at(-1).seq;}
  const batches=events.filter(e=>e.kind==='nodes.parallel.started');
  const overlap=batches.map(batch=>{
    const starts=batch.data.nodeIds.map(nodeId=>events.find(e=>e.seq>batch.seq&&e.kind==='node.started'&&e.data.nodeId===nodeId));
    const intervals=starts.map(e=>{
      const runId=e?.data.runId,dispatch=events.find(x=>x.kind==='worker.inference.dispatched'&&x.data.runId===runId),done=events.find(x=>['worker.inference.completed','worker.inference.failed'].includes(x.kind)&&x.data.runId===runId);
      return {runId:runId??null,dispatch:dispatch?.seq??null,firstCompletion:done?.seq??null};
    });
    return {batchSeq:batch.seq,intervals,overlapped:intervals.length===2&&intervals.every(i=>i.dispatch!==null&&i.firstCompletion!==null)&&Math.max(...intervals.map(i=>i.dispatch))<Math.min(...intervals.map(i=>i.firstCompletion))};
  });
  const refs=[...a,...b].map(parent=>({id:parent.id,hash:parent.payloadHash,
    exactConsumption:!!final&&final.payload.inputRefs.some(ref=>ref.artifactId===parent.id&&ref.hash===parent.payloadHash&&ref.purpose===parent.payload.purpose),
    acceptedBeforeConsumer:!!fr&&engine.registry.committedSequence('artifact',parent.id,engine.store.get('artifact',parent.id).version)<engine.registry.committedSequence('run',fr.id,1)}));
  const coverage=events.filter(e=>e.kind==='planning.coverage.normalized').at(-1)?.data;
  const checks={completed:outcome.mission.status==='COMPLETED'&&final?.status==='ACCEPTED',threeMaterialProducts:a.length===1&&b.length===1&&final?.payload.kind==='combined-proof',
    hittingSet:exactKeys(av,['chosen','minimumSize','allOptima','argument'])&&canonical({chosen:av.chosen,minimumSize:av.minimumSize,allOptima:av.allOptima})===canonical(expectedA)&&typeof av.argument==='string'&&av.argument.length>0,
    topologicalOrders:exactKeys(bv,['orders','count','argument'])&&canonical(bv.orders)===canonical(expectedOrders)&&bv.count===2&&typeof bv.argument==='string'&&bv.argument.length>0,
    integratedResult:exactKeys(fv,['hittingSet','topologicalOrders','explanation'])&&canonical(fv.hittingSet)===canonical(expectedA.chosen)&&canonical(fv.topologicalOrders)===canonical(expectedOrders)&&typeof fv.explanation==='string'&&fv.explanation.length>0,
    separateIndependentProduction:!!ar&&!!br&&ar.id!==br.id&&!ar.context.artifactIds.includes(b[0]?.id)&&!br.context.artifactIds.includes(a[0]?.id),
    prerequisiteGates:refs.length===2&&refs.every(r=>r.exactConsumption&&r.acceptedBeforeConsumer),
    actualOverlap:overlap.some(o=>o.overlapped),
    independentReviews:accepted.length===4&&accepted.every(a=>{const r=engine.store.get('review',a.reviews.at(-1))?.data,run=r?engine.store.get('run',r.reviewerRunId)?.data:null;return !!run&&run.id!==a.payload.producerRunId&&run.context.producerConversationIncluded===false;}),
    noTools:report.effects.length===0,
    proposalAvoidedDuplicateFinalCriteria:coverage?.criteriaBefore===0&&coverage?.added.length>0&&coverage.criteriaAfter===coverage.requiredCriterionCount,
    realInference:report.metrics.completed>0&&report.metrics.liveCompleted===report.metrics.completed&&report.metrics.simulatedCompleted===0,
    runtimeUnchanged:verifyRuntimeRelease(release.directory).releaseId===release.releaseId,
    harnessUnchanged:sha256(fs.readFileSync(new URL(import.meta.url)))===harnessHash};
  if(outcome.mission.status==='COMPLETED')await engine.run(mission.id);
  const later=engine.report(mission.id);
  checks.noReplay=outcome.mission.status==='COMPLETED'&&later.metrics.dispatched===report.metrics.dispatched&&later.effects.length===report.effects.length;
  const summary={completedAt:new Date().toISOString(),stateDir:resolve(directory),missionId:mission.id,releaseId:release.releaseId,status:outcome.mission.status,passed:Object.values(checks).every(v=>v===true),checks,overlap,refs,coverage,products:{hittingSet:av,topologicalOrders:bv,combined:fv},metrics:report.metrics,pending:outcome.mission.pending,
    caveat:'Read public arguments for semantic adequacy. Overlap is journal-observed, not a serial/parallel causal latency comparison. No broad efficiency or complete mandate acceptance.'};
  write('report.json',report);write('summary.json',summary);process.stdout.write(JSON.stringify(summary)+'\n');if(!summary.passed)process.exitCode=2;
}finally{process.removeListener('SIGTERM',stop);process.removeListener('SIGINT',stop);engine.close();}
