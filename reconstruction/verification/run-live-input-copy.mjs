// One new isolated subscription-only diagnostic. No production queue, install,
// source modification, API fallback or automatic second experiment.
import * as fs from 'node:fs';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {verifyRuntimeRelease} from '../../factory/lib/runtime-release.mjs';
import {sha256} from '../../factory/lib/contracts.mjs';
import {inputCopyTrialAcceptance} from './input-copy-trial-acceptance.mjs';
const [directory,runtimeRoot]=process.argv.slice(2);
if(!directory||!runtimeRoot||fs.readdirSync(directory).length)throw Error('New empty diagnostic directory and frozen runtime required');
const release=verifyRuntimeRelease(runtimeRoot),self=new URL(import.meta.url),helper=new URL('./input-copy-trial-acceptance.mjs',import.meta.url);
const harnessHash=sha256(fs.readFileSync(self)),helperHash=sha256(fs.readFileSync(helper));
const frozen=()=>sha256(fs.readFileSync(self))===harnessHash&&sha256(fs.readFileSync(helper))===helperHash&&verifyRuntimeRelease(release.directory).releaseId===release.releaseId;
const module=path=>import(pathToFileURL(join(release.directory,path)));
const {FactoryEngine}=await module('factory/lib/engine.mjs'),{CodexProvider}=await module('factory/providers/codex.mjs');
const {inferenceRequestHash}=await module('factory/providers/instruction-profiles.mjs');
const {inputCopyEvidence}=await module('factory/lib/input-copy.mjs');
const write=(name,value)=>fs.writeFileSync(join(directory,name),JSON.stringify(value,null,2),{flag:'wx',mode:0o600});
const expected='Registro α: 0042\r\n🧭 Cafe\u0301  | no verificado';
const request='Conserva exactamente, como único cuerpo de entrega, el contenido situado entre las marcas <OBJETO_ENTREGA> y </OBJETO_ENTREGA> del siguiente bloque. Las marcas no forman parte del resultado. Mantén todos sus caracteres, espacios, salto CRLF y forma Unicode; no normalices, interpretes, calcules ni certifiques su verdad. No uses herramientas, archivos, comandos, búsquedas ni otras fuentes. Revisa de manera independiente que has seleccionado el objeto pedido y lo has conservado íntegro.\n'
  +'Bloque solicitado:\n<OBJETO_ENTREGA>'+expected+'</OBJETO_ENTREGA>\n'
  +'Dato de contexto que NO debes entregar: Registro α: 0043 | verificado. No sustituyas el objeto por este ejemplo ni por un resumen.';
const policy={preset:'adaptive-v1',entryMode:'planned',model:'gpt-6-astra',reasoningEffort:'ultra',allowedTools:[],maxParallelPureNodes:1,
  cardEncoding:'compact-json-v1',producerContext:'node-contract-v1',maxPlanAttempts:2,maxNodeAttempts:2};
const engine=new FactoryEngine({databasePath:join(directory,'state.sqlite'),workspaceRoot:join(directory,'workspaces'),onEvent:e=>process.stdout.write(JSON.stringify(e)+'\n')});
const captures=[];
engine.workers.providerFactory=()=>{const provider=new CodexProvider();return {async generate(input){
  if(!frozen()||captures.length>=8)throw Object.assign(Error('Frozen boundary or prospective 8-call ceiling reached'),{code:'EXPERIMENT_BOUNDARY'});
  const request={instructions:input.instructions,input:input.input,schema:input.schema,model:input.model,reasoningEffort:input.reasoningEffort,
    ...(input.instructionProfile?{instructionProfile:input.instructionProfile}:{})},requestHash=inferenceRequestHash(request);
  const pending=engine.store.list('run').filter(r=>r.data.expectedRequestHash===requestHash);
  if(pending.length!==1)throw Object.assign(Error('One exact pending actor required'),{code:'EXPERIMENT_BOUNDARY'});
  const actor=pending[0].data;
  if(!(actor.mode==='reviewer'||actor.mode==='producer'&&actor.nodeId==='planning'))
    throw Object.assign(Error('This diagnostic requires the native literal-copy path; an ordinary producing inference is not equivalent'),{code:'EXPERIMENT_BOUNDARY'});
  const capture={at:new Date().toISOString(),index:captures.length,runId:actor.id,nodeId:actor.nodeId,mode:actor.mode,requestHash,request};
  write(`request-${capture.index}.json`,capture);captures.push(capture);return provider.generate(input);
},close:()=>provider.close()};};
const mission=engine.create(request,policy),controller=new AbortController(),stop=()=>controller.abort();
write('qualification.json',{startedAt:new Date().toISOString(),missionId:mission.id,request,requestHash:sha256(request),policy,release,harnessHash,helperHash,
  expected:{body:expected,sha256:sha256(expected),utf8Bytes:Buffer.byteLength(expected)},maxProviderCalls:8,
  scope:'One prospective native literal-selection diagnostic with actual subscription planner/reviewers. Exact byte oracle, distractor, CRLF and decomposed Unicode. Not general efficiency calibration, production install or whole-mandate acceptance.'});
process.once('SIGTERM',stop);process.once('SIGINT',stop);
try{
  await engine.run(mission.id,{signal:controller.signal,pauseOnAbort:true});
  const report=engine.report(mission.id),base=inputCopyTrialAcceptance(report,expected),final=report.final;
  const proof=final?.payload.kind==='literal-input-copy'?inputCopyEvidence(engine.registry,final.id):null;
  const native=engine.store.list('input-copy-origin').filter(r=>r.data.signed.data.missionId===mission.id);
  const before=report.metrics.dispatched;if(report.mission.status==='COMPLETED')await engine.run(mission.id);
  const checks={...base,oneNativeOrigin:native.length===1&&!!proof&&proof.binding.run.id===native[0].id,
    actual:report.metrics.completed>0&&report.metrics.liveCompleted===report.metrics.completed&&report.metrics.simulatedCompleted===0,
    captured:captures.length===report.metrics.dispatched&&captures.every(c=>engine.store.get('run',c.runId).data.requests.some(r=>r.requestHash===c.requestHash)),
    onlyControlInferences:captures.every(c=>c.mode==='reviewer'||c.mode==='producer'&&c.nodeId==='planning'),
    noEffects:report.effects.length===0,noReplay:report.mission.status==='COMPLETED'&&engine.report(mission.id).metrics.dispatched===before,frozen:frozen()};
  const summary={completedAt:new Date().toISOString(),missionId:mission.id,status:report.mission.status,release,checks,passed:Object.values(checks).every(v=>v===true),
    metrics:report.metrics,pending:report.mission.pending,journal:engine.store.verifyJournal(),semanticAudit:'PENDING',
    caveat:'All actual selection contracts, reviewer reasons and evidence must be read separately. A single successful native path is not a paired timing/token benchmark or semantic generalization.'};
  write('report.json',report);if(proof)write('native-origin-proof.json',proof);write('summary.json',summary);
  process.stdout.write(JSON.stringify({directory,status:summary.status,passed:summary.passed,completedAt:summary.completedAt})+'\n');if(!summary.passed)process.exitCode=2;
}catch(error){write('failure.json',{at:new Date().toISOString(),code:error.code??'UNKNOWN',capturedRequests:captures.length});throw error;}
finally{process.removeListener('SIGTERM',stop);process.removeListener('SIGINT',stop);engine.close();}
