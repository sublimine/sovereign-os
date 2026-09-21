import * as fs from 'node:fs';
import {join,resolve} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';

// A continuation may use a verified immutable release with exactly the original
// runtime hashes, freeing the development tree without changing the experiment.
const runtimeRoot=resolve(process.env.SOVEREIGN_QUALIFICATION_RUNTIME??fileURLToPath(new URL('../../',import.meta.url)));
const runtimeImport=path=>import(pathToFileURL(join(runtimeRoot,path)).href);
if(fs.existsSync(join(runtimeRoot,'RELEASE.json'))){
  const {verifyRuntimeRelease}=await runtimeImport('factory/lib/runtime-release.mjs');
  verifyRuntimeRelease(runtimeRoot);
}
const {FactoryEngine}=await runtimeImport('factory/lib/engine.mjs');
const {CodexProvider}=await runtimeImport('factory/providers/codex.mjs');
const {sha256}=await runtimeImport('factory/lib/contracts.mjs');

const directory=process.argv[2],resuming=process.argv[3]==='--resume';
if(process.argv.length>4||process.argv[3]&&!resuming||!directory||!fs.statSync(directory).isDirectory())throw Error('Specific qualification directory [--resume] required');
if(!resuming&&fs.readdirSync(directory).length)throw Error('Creation requires a new empty directory');
if(fs.existsSync(join(directory,'summary.json')))throw Error('Final result exists; never overwrite it');
const expected={'alpha.txt':'alpha=17\n','beta.txt':'beta=23\n','gamma.txt':'gamma=40\n'};
const intent='Crea solamente tres archivos de texto en el espacio de esta misión: alpha.txt con exactamente "alpha=17\\n", beta.txt con exactamente "beta=23\\n" y gamma.txt con exactamente "gamma=40\\n"; aquí \\n representa un único salto de línea LF real. No crees otros archivos, no ejecutes código ni investigues en Internet. Conserva cualquier archivo ya escrito cuyo contenido exacto sea correcto, compruébalo mediante lectura y no repitas su escritura. El revisor independiente debe comprobar los tres contenidos y que el directorio no contenga archivos adicionales. Entrega un resumen breve de lo realmente observado; no te autocertifiques.';
const files=fs.readdirSync(join(runtimeRoot,'factory'),{recursive:true}).map(p=>'factory/'+p).filter(p=>fs.statSync(join(runtimeRoot,p)).isFile()&&/\.(mjs|py|json)$/.test(p));
const hashes=()=>Object.fromEntries(files.map(p=>[p,sha256(fs.readFileSync(join(runtimeRoot,p)))]));
const codeHashes=hashes(),prior=resuming?JSON.parse(fs.readFileSync(join(directory,'qualification.json'),'utf8')):null;
if(prior&&(prior.intent!==intent||sha256(prior.expected)!==sha256(expected)||sha256(prior.codeHashes)!==sha256(codeHashes)))throw Error('Continuation requires the exact original intent, expected files and runtime');
const engine=new FactoryEngine({databasePath:join(directory,'state.sqlite'),workspaceRoot:join(directory,'workspaces'),onEvent:e=>process.stdout.write(JSON.stringify(e)+'\n')});
const mission=prior?engine.store.get('mission',prior.missionId)?.data:engine.create(intent,{allowedTools:['workspace.write','workspace.read','workspace.list'],instructionProfile:'scoped-v1',contextEncoding:'lossless-v1'});
if(!mission||mission.intent!==intent)throw Error('Exact mission missing');
let injected=false;
if(!resuming){
  fs.writeFileSync(join(directory,'qualification.json'),JSON.stringify({startedAt:new Date().toISOString(),pid:process.pid,missionId:mission.id,intent,expected,codeHashes,
    scope:'Real subscription planning/production/review and real files. A QUOTA exception is deliberately injected after a committed write and before the next model request; not an observed account limit. Resume must run in a second process.'},null,2),{flag:'wx',mode:0o600});
  engine.workers.providerFactory=()=>{
    const provider=new CodexProvider();
    return {async generate(request){
      if(!injected&&engine.store.list('effect').some(r=>r.data.missionId===mission.id&&r.data.tool==='workspace.write'&&r.data.state==='SUCCEEDED')){
        injected=true;throw Object.assign(Error('Controlled qualification quota after a committed effect; no provider request made for this call'),{code:'QUOTA'});
      }
      return provider.generate(request);
    },close:()=>provider.close()};
  };
}
const controller=new AbortController(),cancel=()=>controller.abort();process.once('SIGTERM',cancel);process.once('SIGINT',cancel);
try {
  const outcome=await engine.run(mission.id,{signal:controller.signal}),report=engine.report(mission.id);
  const effects=engine.store.list('effect').filter(r=>r.data.missionId===mission.id);
  if(!resuming){
    const writes=effects.filter(r=>r.data.tool==='workspace.write'&&r.data.state==='SUCCEEDED');
    const before={capturedAt:new Date().toISOString(),pid:process.pid,missionId:mission.id,injected,status:outcome.mission.status,
      writes:writes.map(r=>({id:r.id,path:r.data.receipt.data.result.path,hash:r.data.receipt.data.result.sha256,principalId:r.data.principalId})),
      productionCandidates:engine.store.list('artifact').filter(r=>r.data.missionId===mission.id&&writes.some(w=>w.data.principalId===r.data.payload.producerRunId)).map(r=>r.id),
      codeUnchanged:sha256(hashes())===sha256(codeHashes)};
    before.passed=injected&&before.status==='WAITING_QUOTA'&&before.writes.length>0&&before.productionCandidates.length===0&&before.codeUnchanged;
    fs.writeFileSync(join(directory,'interruption.json'),JSON.stringify(before,null,2),{flag:'wx',mode:0o600});
    process.stdout.write(JSON.stringify({phase:'interrupted',...before})+'\n');if(!before.passed)process.exitCode=2;
  }else{
    const before=JSON.parse(fs.readFileSync(join(directory,'interruption.json'),'utf8'));
    const workspace=engine.broker.workspace(mission.id),names=fs.readdirSync(workspace).sort();
    const filesMatch=JSON.stringify(names)===JSON.stringify(Object.keys(expected).sort())&&names.every(name=>{
      const path=join(workspace,name),stat=fs.lstatSync(path);return stat.isFile()&&!stat.isSymbolicLink()&&stat.size<1024&&fs.readFileSync(path,'utf8')===expected[name];
    });
    const inherited=report.timeline.filter(e=>e.kind==='worker.observations.inherited');
    const firstWritePaths=before.writes.map(w=>w.path),writeRecords=effects.filter(r=>r.data.tool==='workspace.write');
    const preserved=before.writes.every(w=>writeRecords.filter(r=>r.data.receipt?.data.result?.path===w.path).length===1&&engine.store.get('effect',w.id).data.state==='SUCCEEDED');
    const ownReviewReads=report.final?engine.store.list('run').filter(r=>r.data.mode==='reviewer'&&r.data.context.artifactIds.includes(report.final.id)).some(r=>Object.keys(expected).every(path=>(r.data.toolObservations??[]).some(o=>o.principalId===r.id&&o.signedReceipt.data.tool==='workspace.read'&&o.signedReceipt.data.result.path===path))):false;
    const snapshot={calls:report.metrics.dispatched,effects:effects.length};
    const repeated=outcome.mission.status==='COMPLETED'?await engine.run(mission.id):null,after=engine.report(mission.id);
    const checks={controlledInterruption:before.passed,differentProcess:before.pid!==process.pid,filesMatch,preservedCommittedWrites:preserved,
      observedHistory:before.writes.every(w=>inherited.some(e=>e.operationIds.includes(w.id))),ownReviewReads,
      noExternalResearchOrExecution:effects.every(r=>r.data.tool.startsWith('workspace.')),
      policyPreserved:outcome.mission.policy.contextEncoding==='lossless-v1',codeUnchanged:sha256(hashes())===sha256(prior.codeHashes),
      noReplay:repeated?.mission.status==='COMPLETED'&&after.metrics.dispatched===snapshot.calls&&after.effects.length===snapshot.effects};
    const result={capturedAt:new Date().toISOString(),stateDir:resolve(directory),runtimeRoot,missionId:mission.id,pid:process.pid,status:outcome.mission.status,pending:outcome.mission.pending,
      scope:prior.scope,checks,passed:outcome.mission.status==='COMPLETED'&&Object.values(checks).every(Boolean),firstWritePaths,metrics:report.metrics,workspace};
    fs.writeFileSync(join(directory,'report.json'),JSON.stringify(report,null,2),{flag:'wx',mode:0o600});
    fs.writeFileSync(join(directory,'summary.json'),JSON.stringify(result,null,2),{flag:'wx',mode:0o600});
    process.stdout.write(JSON.stringify(result)+'\n');if(!result.passed)process.exitCode=2;
  }
}finally{process.removeListener('SIGTERM',cancel);process.removeListener('SIGINT',cancel);engine.close();}
