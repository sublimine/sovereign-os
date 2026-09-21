import * as fs from 'node:fs';
import {join} from 'node:path';
import {FactoryEngine} from '../../factory/lib/engine.mjs';
import {WorkerService} from '../../factory/lib/workers.mjs';
import {canonical,sha256} from '../../factory/lib/contracts.mjs';
const directory=process.argv[2];
if(!directory||fs.readdirSync(directory).length)throw Error('Specific fresh qualification directory required');
const expected=[{path:'alpha.txt',content:'alpha=17\n'},{path:'beta.txt',content:'beta=23\n'},{path:'gamma.txt',content:'gamma=40\n'}];
const intent='Entrega exactamente tres archivos de texto: alpha.txt con "alpha=17\\n", beta.txt con "beta=23\\n" y gamma.txt con "gamma=40\\n". Cada \\n representa un único salto de línea LF real. No crees archivos adicionales, no uses fuentes externas y no ejecutes código. Comunica solamente acciones observadas. Usa el broker externo autorizado, no herramientas nativas.';
const node={id:'three-files',purpose:'batch-qualification',roleIds:['omega_23'],reviewerRoleIds:['omega_22'],instructions:intent,
  outputKind:'delivery',criteria:[{id:'exact-files',text:'Los tres archivos tienen exactamente los bytes solicitados, sin archivos adicionales; respaldar cada archivo con una relectura propia independiente.'}],
  requiredEffects:expected.map(e=>({type:'file',path:e.path,command:'',expectedExit:null})),tools:['workspace.write','workspace.read','workspace.list']};
const manifest={startedAt:new Date().toISOString(),scope:'Two real paired worker/broker qualifications with a supplied identical node, not autonomous planning or a representative quality benchmark. Same acceptance obligations; only batch operation cap differs. No code execution or paid API.',
  expectedHash:sha256(expected),intentHash:sha256(intent),nodeHash:sha256(node),workerSourceHash:sha256(fs.readFileSync(new URL('../../factory/lib/workers.mjs',import.meta.url)))};
fs.writeFileSync(join(directory,'manifest.json'),JSON.stringify(manifest,null,2),{flag:'wx',mode:0o600});
const results=[];
for(const [variant,maxBatchOperations]of [['single',1],['batch',4]]){
  const state=join(directory,variant);fs.mkdirSync(state,{mode:0o700});
  const engine=new FactoryEngine({databasePath:join(state,'state.sqlite'),workspaceRoot:join(state,'workspaces')});
  engine.workers=new WorkerService({store:engine.store,authority:engine.authority,registry:engine.registry,broker:engine.broker,maxBatchOperations,maxSteps:8,maxToolOperations:8});
  const mission=engine.create(intent,{instructionProfile:'scoped-v1',allowedTools:node.tools});
  const result={variant,maxBatchOperations,missionId:mission.id,simulation:false,startedAt:new Date().toISOString()};
  process.stdout.write(JSON.stringify({event:'batch.case.started',variant,missionId:mission.id})+'\n');
  try {
    const run=engine.workers.createRun({missionId:mission.id,nodeId:node.id,mode:'producer',purpose:node.purpose,roleIds:node.roleIds});
    const candidate=await engine.workers.produce({missionId:mission.id,node,runId:run.id});
    process.stdout.write(JSON.stringify({event:'batch.candidate',variant,artifactId:candidate.id})+'\n');
    const accepted=await engine.workers.review({artifact:candidate,reviewerRoleIds:node.reviewerRoleIds,missionIntent:intent});
    const workspace=engine.broker.workspace(mission.id),files=fs.readdirSync(workspace).sort();
    const exact=canonical(files)===canonical(expected.map(e=>e.path).sort())&&expected.every(e=>fs.readFileSync(join(workspace,e.path),'utf8')===e.content);
    const report=engine.report(mission.id),review=engine.store.get('review',accepted.reviews.at(-1))?.data;
    const own=engine.registry.getToolObservations(review.reviewerRunId).filter(o=>o.tool==='workspace.read'&&o.relation==='OWN_ACTION'&&o.status==='SUCCEEDED');
    const independent=review.reviewerRunId!==run.id&&expected.every(e=>own.some(o=>o.result.path===e.path&&o.result.content===e.content));
    Object.assign(result,{artifactId:accepted.id,status:accepted.status,passed:accepted.status==='ACCEPTED'&&exact&&independent,exact,independent,files:expected.map(e=>({path:e.path,sha256:sha256(fs.readFileSync(join(workspace,e.path)))})),
      metrics:report.metrics,operationCount:report.effects.length,proposalActions:engine.store.list('worker-proposal').map(p=>p.data.value.action),inferences:engine.store.list('run').flatMap(r=>r.data.inferenceReceipts??[])});
  }catch(error){Object.assign(result,{passed:false,error:{code:error.code??'INTERNAL',reason:error.message}});}
  finally{result.completedAt=new Date().toISOString();fs.writeFileSync(join(directory,variant+'.json'),JSON.stringify(result,null,2),{flag:'wx',mode:0o600});engine.close();}
  results.push(result);process.stdout.write(JSON.stringify({event:'batch.case.completed',variant,passed:result.passed,calls:result.metrics?.completed,usage:result.metrics?.providerUsage,error:result.error})+'\n');
}
const sourceUnchanged=manifest.workerSourceHash===sha256(fs.readFileSync(new URL('../../factory/lib/workers.mjs',import.meta.url)));
const summary={...manifest,completedAt:new Date().toISOString(),sourceUnchanged,allPassed:sourceUnchanged&&results.every(r=>r.passed),results};
fs.writeFileSync(join(directory,'summary.json'),JSON.stringify(summary,null,2),{flag:'wx',mode:0o600});
if(!summary.allPassed)process.exitCode=2;
