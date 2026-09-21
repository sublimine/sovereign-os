// One prospective subscription-only integration trial. No production queue,
// installation, result editing, provider fallback or automatic second trial.
import * as fs from 'node:fs';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {verifyRuntimeRelease} from '../../factory/lib/runtime-release.mjs';
import {sha256} from '../../factory/lib/contracts.mjs';
import {allTrialNodesAccepted,acceptedFinalConsumesComparison,comparisonPreservesResiduals} from './trial-acceptance.mjs';
const [directory,runtimeRoot]=process.argv.slice(2);
if(!directory||!runtimeRoot||fs.readdirSync(directory).length)throw Error('New empty trial directory and frozen runtime required');
const release=verifyRuntimeRelease(runtimeRoot),self=new URL(import.meta.url),harnessHash=sha256(fs.readFileSync(self));
const acceptanceSource=new URL('./trial-acceptance.mjs',import.meta.url),acceptanceHash=sha256(fs.readFileSync(acceptanceSource));
const frozen=()=>sha256(fs.readFileSync(self))===harnessHash&&sha256(fs.readFileSync(acceptanceSource))===acceptanceHash&&verifyRuntimeRelease(release.directory).releaseId===release.releaseId;
const module=path=>import(pathToFileURL(join(release.directory,path)));
const {FactoryEngine}=await module('factory/lib/engine.mjs'),{CodexProvider}=await module('factory/providers/codex.mjs');
const {inferenceRequestHash}=await module('factory/providers/instruction-profiles.mjs');
const {unpackJsonContext}=await module('factory/lib/context-json-codec.mjs'),{unpackContext}=await module('factory/lib/context-codec.mjs');
const write=(name,value)=>fs.writeFileSync(join(directory,name),JSON.stringify(value,null,2),{flag:'wx',mode:0o600});
const request=`Necesito un informe de replicación ciega cerrada, con protocolo prerregistrado y revisión independiente de cada producto material, sobre el determinante de la matriz [[2,1,3],[0,4,5],[1,-2,6]]. El objeto original de comparación es el texto decimal completo "62": consérvalo exactamente como cuerpo del producto de entrada, no como JSON ni como una afirmación verdadera certificada. Su aceptación sólo comprueba que se ha conservado ese objeto para compararlo.
Diseña y aprueba un protocolo que contenga las premisas públicas completas de la matriz, un método ejecutable sin herramientas, controles verificables, condiciones de parada y limitaciones; mantén privado el original y cualquier conclusión o pista sobre él. El protocolo debe ser revisado con el objeto original real antes de enviar la réplica. Usa la ruta cerrada registrada, no un trabajador ordinario que ya haya visto el original. La réplica debe devolver el determinante como texto decimal completo, argumento público comprobable, controles, desviaciones y desconocidos. Ni ella ni su juez material deben recibir el original, el plan global o conversaciones de otros productores. Acepta o devuelve el intento antes de abrir el original.
Fija antes de la réplica la comparación decimal-distance-v1 con absoluteTolerance="0" y unit="determinante de matriz numérica adimensional". Tras aceptar el intento y abrir el original, calcula y revisa el informe nativo de comparación sin volver a producir ni alterar el resultado. Quiero el informe completo con ambos textos, distancia exacta, resultado MATCH/MISMATCH/UNKNOWN, controles y límites, no sólo una etiqueta. Una divergencia no es un fallo del informe ni autoriza modificar tolerancia, original, regla o repetir hasta coincidir. Conserva los fallos e incertidumbre y no declares verdad universal o independencia cognitiva. Esta tarea está completamente definida por los datos suministrados: no uses búsquedas, fuentes externas, archivos, comandos, compras o cambios de configuración.`;
const policy={preset:'adaptive-v1',entryMode:'planned',model:'gpt-6-astra',reasoningEffort:'ultra',allowedTools:[],maxParallelPureNodes:1,
  cardEncoding:'compact-json-v1',producerContext:'node-contract-v1',maxPlanAttempts:4,maxNodeAttempts:4};
const engine=new FactoryEngine({databasePath:join(directory,'state.sqlite'),workspaceRoot:join(directory,'workspaces'),onEvent:e=>process.stdout.write(JSON.stringify(e)+'\n')});
const captures=[],providerFactory=()=>{
  const provider=new CodexProvider();
  return {async generate(input){
    if(!frozen()||captures.length>=24)throw Object.assign(Error('Frozen boundary or prospective 24-call trial ceiling reached'),{code:'EXPERIMENT_BOUNDARY'});
    const request={instructions:input.instructions,input:input.input,schema:input.schema,model:input.model,reasoningEffort:input.reasoningEffort,
      ...(input.instructionProfile?{instructionProfile:input.instructionProfile}:{})},requestHash=inferenceRequestHash(request);
    const pending=engine.store.list('run').filter(r=>r.data.expectedRequestHash===requestHash);
    if(pending.length!==1)throw Object.assign(Error('One exact pending actor required'),{code:'EXPERIMENT_BOUNDARY'});
    const capture={at:new Date().toISOString(),index:captures.length,runId:pending[0].id,nodeId:pending[0].data.nodeId,mode:pending[0].data.mode,requestHash,request};
    write(`request-${capture.index}.json`,capture);captures.push(capture);
    return provider.generate(input);
  },close:()=>provider.close()};
};
engine.workers.providerFactory=providerFactory;engine.blind.providerFactory=providerFactory;
const mission=engine.create(request,policy),controller=new AbortController(),stop=()=>controller.abort();
// Independent finite permutation oracle, computed outside every model context.
const matrix=[[2,1,3],[0,4,5],[1,-2,6]],permutations=[[0,1,2],[0,2,1],[1,0,2],[1,2,0],[2,0,1],[2,1,0]];
const determinant=permutations.reduce((sum,p)=>{let inversions=0;for(let i=0;i<3;i++)for(let j=i+1;j<3;j++)if(p[i]>p[j])inversions++;
  return sum+(-1)**inversions*matrix.reduce((product,row,i)=>product*row[p[i]],1);},0);
write('qualification.json',{startedAt:new Date().toISOString(),missionId:mission.id,request,requestHash:sha256(request),policy,release,harnessHash,acceptanceHash,
  gold:{matrix,permutations,determinant,original:'62',distance:'1',outcome:'MISMATCH'},maxProviderCalls:24,
  source:'https://learn.chatgpt.com/docs/app-server#auth-endpoints',scope:'Real subscription-only closed planned integration. Gold oracle withheld from model contexts. No semantic universal certification, production install, queue mission or efficiency superiority claim.'});
process.once('SIGTERM',stop);process.once('SIGINT',stop);
try{
  const outcome=await engine.run(mission.id,{signal:controller.signal,pauseOnAbort:true}),report=engine.report(mission.id);
  const artifacts=engine.store.list('artifact').filter(r=>r.data.missionId===mission.id).map(r=>r.data);
  const plan=report.plan,attempt=artifacts.find(a=>a.payload.kind==='closed-blind-attempt'),comparison=artifacts.find(a=>a.payload.purpose==='closed-blind-comparison');
  const parse=a=>{try{return JSON.parse(a.payload.body);}catch{return null;}},body=parse(comparison),registration=engine.store.list('blind-registration');
  const replicaCalls=captures.filter(c=>c.mode==='replicator');
  const decoded=c=>{const wire=JSON.parse(c.request.input);return wire.encoding==='sovereign.lossless-context.v2'?unpackJsonContext(wire):wire.encoding==='sovereign.lossless-context.v1'?unpackContext(wire):wire;};
  const materialCalls=captures.filter(c=>c.mode==='reviewer'&&decoded(c).publicReviewMandate?.schema==='sovereign.closed-blind-review.v1');
  const privateArtifacts=artifacts.filter(a=>['plan','blind-protocol'].includes(a.payload.purpose)||a.id===body?.original.id);
  const seq=(type,id,version)=>engine.registry.committedSequence(type,id,version);
  const opening=engine.store.list('blind-opening')[0],materialNode=attempt?engine.store.get('node',`${mission.id}:${attempt.payload.nodeId}`):null;
  const acceptedNodes=allTrialNodesAccepted(report,id=>engine.store.get('artifact',id)?.data);
  const beforeReplay=report.metrics.dispatched;if(outcome.mission.status==='COMPLETED')await engine.run(mission.id);
  const sealed=registration.length===1?engine.store.get('blind-seal',registration[0].id)?.data.signed.data.result:null;
  const checks={completed:outcome.mission.status==='COMPLETED'&&acceptedFinalConsumesComparison(report,comparison,id=>engine.store.get('artifact',id)?.data),
    exactResult:body?.replica.result===String(determinant)&&body?.original.body==='62'&&body?.comparison.calculation.absoluteDistance==='1'&&body?.comparison.outcome==='MISMATCH',
    exactRule:body?.publicProtocol?.comparison?.kind==='decimal-distance-v1'&&body.publicProtocol.comparison.absoluteTolerance==='0'
      &&body.publicProtocol.comparison.unit==='determinante de matriz numérica adimensional',
    residualsFaithfullyPreserved:comparisonPreservesResiduals(body,sealed),
    oneReplica:registration.length===1&&replicaCalls.length===1&&materialCalls.length>=1,
    privateBindingsExcluded:replicaCalls.length===1&&materialCalls.length>=1&&[...replicaCalls,...materialCalls].every(c=>
      privateArtifacts.every(a=>![a.id,a.payloadHash].some(hidden=>c.request.input.includes(hidden))))
      &&materialCalls.every(c=>{const d=decoded(c);return d.artifacts.length===1&&!Object.hasOwn(d,'missionIntent');}),
    materialLedgerBeforeOpening:!!opening&&!!materialNode&&seq(materialNode.type,materialNode.id,materialNode.version)>0
      &&seq(materialNode.type,materialNode.id,materialNode.version)<seq(opening.type,opening.id,opening.version),
    realPlanAndGates:!!plan&&plan.nodes.some(n=>n.execution?.kind==='closed-blind-material-v1')&&plan.nodes.some(n=>n.execution?.kind==='closed-blind-comparison-v1')&&acceptedNodes,
    allRequirements:!!plan&&plan.requirements.every(r=>r.criteria.every(c=>report.final?.payload.criteria.some(f=>f.text===c.text&&(f.evaluation??'content')===(c.evaluation??'content')))),
    noEffects:report.effects.length===0,real:report.metrics.completed>0&&report.metrics.liveCompleted===report.metrics.completed&&report.metrics.simulatedCompleted===0,
    captured:captures.length===report.metrics.dispatched&&captures.every(c=>engine.store.get('run',c.runId).data.requests.some(r=>r.requestHash===c.requestHash)),
    noReplay:outcome.mission.status==='COMPLETED'&&engine.report(mission.id).metrics.dispatched===beforeReplay,frozen:frozen()};
  const summary={completedAt:new Date().toISOString(),missionId:mission.id,release,status:outcome.mission.status,checks,passed:Object.values(checks).every(v=>v===true),
    metrics:report.metrics,pending:outcome.mission.pending,semanticAudit:'PENDING',caveat:'Full protocol, argument, controls and reviewer reasons require separate substantive reading. Exact ID exclusion is not semantic leak detection. This single trial is not broad calibration or complete mandate acceptance.'};
  write('report.json',report);write('summary.json',summary);process.stdout.write(JSON.stringify(summary)+'\n');if(!summary.passed)process.exitCode=2;
}catch(error){write('failure.json',{at:new Date().toISOString(),code:error.code??'UNKNOWN',capturedRequests:captures.length});throw error;}
finally{process.removeListener('SIGTERM',stop);process.removeListener('SIGINT',stop);engine.close();}
