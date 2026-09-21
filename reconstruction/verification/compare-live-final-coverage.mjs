// Paired complete missions through two immutable releases. Real subscription
// inference and workspace effects; no injected quota, waived review or API use.
import * as fs from 'node:fs';
import {join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {sha256,canonical} from '../../factory/lib/contracts.mjs';
import {verifyRuntimeRelease} from '../../factory/lib/runtime-release.mjs';
const [directory,baselineRoot,candidateRoot]=process.argv.slice(2);
if(!directory||!baselineRoot||!candidateRoot||fs.readdirSync(directory).length)throw Error('New empty result directory and two exact release paths required');
const releases=[['baseline',baselineRoot],['candidate',candidateRoot]].map(([variant,path])=>({variant,...verifyRuntimeRelease(path)}));
const expected={'alpha.txt':'alpha=17\n','beta.txt':'beta=23\n','gamma.txt':'gamma=40\n'};
const intent='Crea solamente tres archivos de texto en el espacio de esta misión: alpha.txt con exactamente "alpha=17\\n", beta.txt con exactamente "beta=23\\n" y gamma.txt con exactamente "gamma=40\\n"; aquí \\n representa un único salto de línea LF real. No crees otros archivos, no ejecutes código ni investigues en Internet. Conserva cualquier archivo ya escrito cuyo contenido exacto sea correcto, compruébalo mediante lectura y no repitas su escritura. El revisor independiente debe comprobar los tres contenidos y que el directorio no contenga archivos adicionales. Entrega un resumen breve de lo realmente observado; no te autocertifiques.';
const policy={model:'gpt-6-astra',reasoningEffort:'ultra',allowedTools:['workspace.write','workspace.read','workspace.list'],instructionProfile:'scoped-v1',contextEncoding:'lossless-v1'};
const code=root=>JSON.parse(fs.readFileSync(join(root,'RELEASE.json'),'utf8')).files.filter(f=>f.path.startsWith('factory/')&&/\.(mjs|py|json)$/.test(f.path));
const before=code(baselineRoot),after=code(candidateRoot);
const changed=[...new Set([...before,...after].map(f=>f.path))].filter(path=>before.find(f=>f.path===path)?.sha256!==after.find(f=>f.path===path)?.sha256);
if(canonical(changed.sort())!==canonical(['factory/lib/engine.mjs','factory/lib/final-coverage.mjs']))throw Error('This paired comparison isolates only final-coverage normalization and its planning instruction');
const harnessHash=sha256(fs.readFileSync(new URL(import.meta.url)));
const write=(path,value)=>fs.writeFileSync(path,JSON.stringify(value,null,2),{flag:'wx',mode:0o600});
write(join(directory,'manifest.json'),{startedAt:new Date().toISOString(),scope:'Single paired full-mission comparison; not a universal routing/cost or quality claim.',intent,expected,policy,releases,changed,harnessHash});
const controller=new AbortController(),stop=()=>controller.abort();process.once('SIGTERM',stop);process.once('SIGINT',stop);
const results=[];
try {
  for(const release of releases){
    if(controller.signal.aborted)throw Error('Comparison cancelled before next variant');
    if(sha256(fs.readFileSync(new URL(import.meta.url)))!==harnessHash)throw Error('Comparison harness changed during experiment');
    const root=release.directory,stateDir=join(directory,release.variant);fs.mkdirSync(stateDir,{mode:0o700});
    const {FactoryEngine}=await import(pathToFileURL(join(root,'factory/lib/engine.mjs')));
    const engine=new FactoryEngine({databasePath:join(stateDir,'state.sqlite'),workspaceRoot:join(stateDir,'workspaces'),
      onEvent:e=>process.stdout.write(JSON.stringify({variant:release.variant,...e})+'\n')});
    const mission=engine.create(intent,policy),started=Date.now();
    write(join(stateDir,'mission.json'),{missionId:mission.id,intentHash:mission.intentHash,releaseId:release.releaseId});
    try {
      const outcome=await engine.run(mission.id,{signal:controller.signal}),report=engine.report(mission.id);
      const workspace=engine.broker.workspace(mission.id),names=fs.readdirSync(workspace).sort();
      const filesMatch=canonical(names)===canonical(Object.keys(expected).sort())&&names.every(name=>{
        const path=join(workspace,name),stat=fs.lstatSync(path);
        return stat.isFile()&&!stat.isSymbolicLink()&&stat.size<1024&&fs.readFileSync(path,'utf8')===expected[name];
      });
      const artifact=report.final,review=artifact?engine.store.get('review',artifact.reviews.at(-1))?.data:null;
      const reviewer=review?engine.store.get('run',review.reviewerRunId)?.data:null;
      const own=reviewer?.toolObservations?.filter(o=>o.principalId===reviewer.id&&o.signedReceipt.data.status==='SUCCEEDED')??[];
      const ownReviewReads=Object.keys(expected).every(path=>own.some(o=>o.signedReceipt.data.tool==='workspace.read'&&o.signedReceipt.data.result.path===path));
      const ownListing=own.some(o=>o.signedReceipt.data.tool==='workspace.list');
      const requirementCoverage=Boolean(report.plan&&artifact)&&report.plan.requirements.every(r=>r.criteria.every(c=>artifact.payload.criteria.some(a=>
        a.id===`req.${r.id}.${c.id}`&&a.text===c.text&&(a.evaluation??'content')===(c.evaluation??'content'))));
      const repeated=outcome.mission.status==='COMPLETED'?await engine.run(mission.id):null,later=engine.report(mission.id);
      const checks={accepted:outcome.mission.status==='COMPLETED'&&artifact?.status==='ACCEPTED',filesMatch,ownReviewReads,ownListing,
        independent:!!reviewer&&reviewer.id!==artifact.payload.producerRunId&&reviewer.context.producerConversationIncluded===false,
        requirementCoverage,noExternalResearchOrExecution:report.effects.every(e=>e.tool.startsWith('workspace.')),
        noReplay:repeated?.mission.status==='COMPLETED'&&later.metrics.dispatched===report.metrics.dispatched&&later.effects.length===report.effects.length,
        runtimeUnchanged:verifyRuntimeRelease(root).releaseId===release.releaseId,harnessUnchanged:sha256(fs.readFileSync(new URL(import.meta.url)))===harnessHash};
      const result={variant:release.variant,stateDir:resolve(stateDir),missionId:mission.id,releaseId:release.releaseId,status:outcome.mission.status,
        passed:Object.values(checks).every(Boolean),checks,elapsedMs:Date.now()-started,metrics:report.metrics,
        nodes:report.plan?.nodes.length??null,requirementCriteria:report.plan?.requirements.reduce((n,r)=>n+r.criteria.length,0)??null,
        finalCriteria:artifact?.payload.criteria.length??null,files:filesMatch?Object.fromEntries(Object.keys(expected).map(p=>[p,sha256(fs.readFileSync(join(workspace,p)))])):null};
      write(join(stateDir,'report.json'),report);write(join(stateDir,'summary.json'),result);results.push(result);
      process.stdout.write(JSON.stringify({event:'variant.completed',...result})+'\n');
      if(!result.passed)break; // Record failure; do not grant extra attempts or alter the task to pass.
    } finally {engine.close();}
  }
  const [baseline,candidate]=results;
  const comparable=results.length===2&&results.every(r=>r.passed)&&canonical(baseline.files)===canonical(candidate.files);
  const knownUsage=comparable&&results.every(r=>r.metrics.providerUsage.observedCompletedCalls===r.metrics.completed&&r.metrics.withoutFinalOutcome===0&&r.metrics.failed===0);
  const total=r=>r.metrics.providerUsage.byFieldObserved.totalTokens;
  const summary={completedAt:new Date().toISOString(),complete:results.length===2,comparable,results,
    observedTotalTokenChange:knownUsage?total(candidate)-total(baseline):null,
    finalCriteriaChange:comparable?candidate.finalCriteria-baseline.finalCriteria:null,
    interpretation:'One sequential paired run. Same request, model, effort, profile and codec. Both require exact external file checks, independent reads/listing and accepted final requirement coverage. Plan diversity and provider variability remain; no causal generalization or automatic deployment.'};
  write(join(directory,'summary.json'),summary);process.stdout.write(JSON.stringify({event:'comparison.completed',comparable,observedTotalTokenChange:summary.observedTotalTokenChange,finalCriteriaChange:summary.finalCriteriaChange})+'\n');
  if(!comparable)process.exitCode=2;
} finally {process.removeListener('SIGTERM',stop);process.removeListener('SIGINT',stop);}
