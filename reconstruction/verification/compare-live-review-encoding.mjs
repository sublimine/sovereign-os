// Component qualification: real broker-prepared files, real model finalization
// and independent reviews. No autonomous planning, injected quota or API fallback.
import * as fs from 'node:fs';
import {join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {verifyRuntimeRelease} from '../../factory/lib/runtime-release.mjs';
import {sha256,canonical} from '../../factory/lib/contracts.mjs';
const [directory,runtimeRoot]=process.argv.slice(2);
if(!directory||!runtimeRoot||fs.readdirSync(directory).length)throw Error('New empty results directory and immutable runtime required');
const release=verifyRuntimeRelease(runtimeRoot),harnessHash=sha256(fs.readFileSync(new URL(import.meta.url)));
const {FactoryEngine}=await import(pathToFileURL(join(release.directory,'factory/lib/engine.mjs')));
const expected={'alpha.txt':'alpha=17\n','beta.txt':'beta=23\n','gamma.txt':'gamma=40\n'};
const intent='Review the exact prepared file fixture: alpha.txt contains alpha=17 followed by LF, beta.txt contains beta=23 followed by LF, gamma.txt contains gamma=40 followed by LF. Use real independent reads of all three, and reject wrong bytes or missing evidence. Do not execute code, fetch external sources or modify any file during model finalization or review. The harness prepared these files; do not claim the model independently generated them.';
const criteria=[...Object.entries(expected).map(([path,content],i)=>({id:'content'+i,text:`The independently read complete ${path} has exactly ${JSON.stringify(content)} as its content.`,evaluation:'content'})),
  {id:'line-endings',text:'All three files have exactly one trailing LF and no CR or BOM, based on the reviewer own complete observations.',evaluation:'content'},
  {id:'bytes',text:'The exact files have 9, 8 and 9 UTF-8 bytes respectively; cite independent proof for each.',evaluation:'content'},
  {id:'accountability',text:'The summary attributes preparation to the trusted harness and does not pretend a model generated the files or accepted its own output.',evaluation:'content'}];
const node={id:'fixture',purpose:'independent-file-review-codec-qualification',roleIds:['omega_23'],reviewerRoleIds:['omega_22'],
  instructions:'The trusted harness already prepared these exact files through recorded broker writes. Do not call tools. Return a short candidate summary saying the harness prepared the files and their independent review is pending. Preserve the recorded observations and do not claim unobserved reads or self-acceptance.',
  outputKind:'fixture-summary',criteria,requiredEffects:Object.keys(expected).map(path=>({type:'file',path,command:'',expectedExit:null})),tools:[],specialist:null};
const write=(path,value)=>fs.writeFileSync(path,JSON.stringify(value,null,2),{flag:'wx',mode:0o600});
write(join(directory,'manifest.json'),{startedAt:new Date().toISOString(),intent,expected,node,release,harnessHash,
  scope:'Two fixed-node component variants: real harness broker writes, real subscription producer finalization and real independent reviewer. No planning/router benchmark, no asserted universal efficiency.'});
const controller=new AbortController(),stop=()=>controller.abort();process.once('SIGTERM',stop);process.once('SIGINT',stop);
const results=[];
try{
  for(const encoding of ['expanded-json','evidence-refs-v1']){
    if(controller.signal.aborted)throw Error('Qualification cancelled');
    const stateDir=join(directory,encoding);fs.mkdirSync(stateDir,{mode:0o700});
    const engine=new FactoryEngine({databasePath:join(stateDir,'state.sqlite'),workspaceRoot:join(stateDir,'workspaces')});
    try{
      const mission=engine.create(intent,{allowedTools:['workspace.write','workspace.read'],instructionProfile:'scoped-v1',contextEncoding:'lossless-v1',reviewEncoding:encoding});
      write(join(stateDir,'mission.json'),{missionId:mission.id,encoding});
      const run=engine.workers.createRun({missionId:mission.id,nodeId:node.id,mode:'producer',purpose:node.purpose,roleIds:node.roleIds});
      for(const [path,content]of Object.entries(expected))await engine.workers.tool(run.id,'workspace.write',{path,content,expectedHash:null},run.id+':harness:'+path);
      process.stdout.write(JSON.stringify({event:'variant.started',encoding,missionId:mission.id})+'\n');
      const candidate=await engine.workers.produce({missionId:mission.id,node,runId:run.id,signal:controller.signal});
      const artifact=await engine.workers.review({artifact:candidate,reviewerRoleIds:node.reviewerRoleIds,missionIntent:intent,signal:controller.signal});
      const report=engine.report(mission.id),review=engine.store.get('review',artifact.reviews.at(-1))?.data;
      const reviewer=review?engine.store.get('run',review.reviewerRunId)?.data:null;
      const workspace=engine.broker.workspace(mission.id),effects=engine.store.list('effect').map(r=>r.data);
      const checks={accepted:artifact.status==='ACCEPTED',allCriteria:review?.result.checks.length===criteria.length,
        independent:reviewer?.context.producerConversationIncluded===false&&reviewer.id!==run.id,
        ownReads:Object.keys(expected).every(path=>reviewer?.toolObservations?.some(o=>o.principalId===reviewer.id&&o.signedReceipt.data.tool==='workspace.read'&&o.signedReceipt.data.status==='SUCCEEDED'&&o.signedReceipt.data.result.path===path)),
        exactFiles:canonical(fs.readdirSync(workspace).sort())===canonical(Object.keys(expected).sort())&&Object.entries(expected).every(([path,content])=>fs.readFileSync(join(workspace,path),'utf8')===content),
        onlyHarnessWrites:effects.filter(e=>e.tool==='workspace.write').length===3&&effects.filter(e=>e.tool==='workspace.write').every(e=>e.principalId===run.id),
        noExtraEffects:effects.every(e=>['workspace.write','workspace.read'].includes(e.tool)),
        fullDecodedProof:review?.result.checks.every(c=>Array.isArray(c.evidence)&&!('evidenceIds'in c)),
        runtimeUnchanged:verifyRuntimeRelease(release.directory).releaseId===release.releaseId,harnessUnchanged:sha256(fs.readFileSync(new URL(import.meta.url)))===harnessHash};
      const result={encoding,missionId:mission.id,stateDir:resolve(stateDir),passed:Object.values(checks).every(x=>x===true),checks,
        componentStatus:artifact.status,missionStatus:report.mission.status,metrics:report.metrics,encodingRecords:engine.store.list('worker-review-encoding').map(r=>({id:r.id,rawResponseHash:r.data.rawResponseHash,expandedResponseHash:r.data.expandedResponseHash}))};
      write(join(stateDir,'report.json'),report);write(join(stateDir,'summary.json'),result);write(join(stateDir,'accepted-artifact.json'),artifact);
      results.push(result);process.stdout.write(JSON.stringify({event:'variant.completed',...result})+'\n');
      if(!result.passed)break;
    }catch(error){write(join(stateDir,'failure.json'),{code:error.code??'INTERNAL',message:error.message,at:new Date().toISOString()});throw error;}
    finally{engine.close();}
  }
  const comparable=results.length===2&&results.every(r=>r.passed);
  const summary={completedAt:new Date().toISOString(),comparable,results,
    caveat:'Component results only. Mission remains NEW because autonomous planning/engine execution was deliberately not invoked. Each variant had real prepared files and model finalization/review. Repeated trials and whole-mission evaluation remain necessary.'};
  write(join(directory,'summary.json'),summary);process.stdout.write(JSON.stringify({event:'comparison.completed',comparable})+'\n');if(!comparable)process.exitCode=2;
}finally{process.removeListener('SIGTERM',stop);process.removeListener('SIGINT',stop);}
