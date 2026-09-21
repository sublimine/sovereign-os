#!/usr/bin/env node
import {parseArgs} from 'node:util';
import {resolve, join,dirname,basename} from 'node:path';
import {fileURLToPath} from 'node:url';
import {homedir} from 'node:os';
import {existsSync} from 'node:fs';
import {FactoryEngine} from '../lib/engine.mjs';
import {Store} from '../lib/store.mjs';
import {Authority} from '../lib/authority.mjs';
import {ArtifactRegistry} from '../lib/artifacts.mjs';
import {readPublicTextDelivery} from '../lib/public-text-delivery.mjs';
import {CodexProvider} from '../providers/codex.mjs';
import {PublicSearch} from '../providers/public-search.mjs';
import {getRole, listCapabilities} from '../catalog/index.mjs';
import {formatMissionReport, safeDisplay} from '../lib/report.mjs';
import {IsolatedExecutionRunner} from '../tools/execution.mjs';
import {MissionQueue} from '../lib/queue.mjs';
import {captureMissionInputs} from '../lib/mission-inputs.mjs';
import {verifyRuntimeRelease} from '../lib/runtime-release.mjs';
import {inspectUserService} from '../lib/service-status.mjs';
import {prepareLearningDomainRegistration,validateLearningDomainRegistration} from '../lib/learning-domain-registration.mjs';
import {learningStatusReport} from '../lib/learning-status.mjs';
import {normalizeLearningProvenancePolicy} from '../lib/learning-provenance.mjs';
import {publicLearningActionAcknowledgement,publicLearningCycleList} from '../lib/learning-conductor.mjs';
import {parseSublimineAssetManifestBytes,SUBLIMINE_ASSET_MANIFEST_OPTION_SCHEMA} from '../lib/mission-assets.mjs';
import {sha256} from '../lib/contracts.mjs';

const runtimeRoot=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const runtimeId=/^[a-f0-9]{64}$/.test(basename(runtimeRoot))?basename(runtimeRoot):null;
if(runtimeId||existsSync(join(runtimeRoot,'RELEASE.json')))verifyRuntimeRelease(runtimeRoot,runtimeId);

const usage = `Sublimine Factory — reconstrucción en verificación

  doctor                         Comprueba proveedor oficial y modelos disponibles
  service-status                 Consulta el servicio en el gestor permanente del usuario; sin inferencia
  submit --text 'petición'        Guarda una petición en la cola persistente
  serve                          Atiende la cola local; SIGTERM pausa y conserva trabajo
  queue                          Lista cola, reintentos y solicitudes de intervención
  pause ID                       Solicita pausa durable de una misión en cola
  continue ID                    Reanuda explícitamente una misión en cola
  cancel ID                      Cancela una misión en cola, sin borrar evidencias
  run --text 'petición'           Crea y ejecuta una misión nueva
  run --file petición.txt         Lee UTF-8 literal de un archivo regular sin enlaces
  submit --text '...' --inputs adjuntos.json
                                 Adjunta snapshots UTF-8 antes de ejecutar; no sincroniza el host
  resume ID                      Retoma una misión conservando su mandato
  retry-review ID --node N --reason TEXTO
                                 Autoriza un intento de revisión del candidato exacto; no ejecuta
  status ID                      Estado y obligaciones pendientes
  show ID                        Último entregable y estado de aceptación
  plan ID                        Plan causal y criterios de la misión
  report ID                      Roles, razones, fuentes, revisiones y métricas registradas
  delivery ID --json             Entrega final textual ACCEPTED, verificada y mínima; sólo JSON
  roles [ID]                     Directorio o ficha completa
  learn-list                     Ciclos de aprendizaje guardados; sin inferencia
  learn-status                   Estado de registros, evaluaciones y activación; sólo lectura
  learn-observe ID                Registra fallos de una misión con evaluación ya configurada
  learn-propose CICLO             Una propuesta acotada; no evalúa ni activa instrucciones
  learn-evaluators                Compatibilidad de evaluadores congelados; sin inferencia
  learn-evaluate CICLO            Compara una propuesta guardada; no propone ni activa
  learn-validate --file DOMINIO   Valida ámbito/casos privados en memoria; no abre ni escribe estado
  learn-register --file DOMINIO   Registra casos/ámbito congelados; sin inferencia ni activación

Opciones: --state-dir RUTA, --model MODELO, --effort NIVEL, --profile model-default|scoped-v1, --request-id ID (submit idempotente), --json
          --inputs MANIFIESTO (submit/run: array JSON de {source,path}; archivos explícitos, source relativo al cwd, path relativo a la misión)
          --project-context DESCRIPTOR_JSON (submit/run junto con --inputs; JSON exacto {path,sha256,classification:"project-context-untrusted-v1",requiredRead:true} que enlaza una sola entrada admitida; el descriptor no contiene bytes)
          --asset-manifest MANIFIESTO_JSON (submit/run junto con --inputs; manifiesto Sublimine sellado exactamente en assets/manifest.json; sólo metadatos, sin bytes ni lector de activos)
          --preset adaptive-v1 (sólo nuevas misiones; selección versionada, opciones explícitas prevalecen)
          --preset adaptive-v2 (opt-in: entrada v2, fichas bajo demanda, cursor y una revisión de método; sin contexto documental)
          --preset adaptive-v3 (opt-in: selector estricto; sólo un lenguaje determinista mínimo sin adjuntos puede cerrar directo; el resto pasa a planned)
          --allowed-tools LISTA (nuevas misiones; nombres separados por comas; cadena vacía = ninguna; no amplía permisos al reanudar)
          --card-encoding pretty-json|compact-json-v1 (nuevas misiones; mismas fichas completas, formato persistente)
          --producer-context full-plan|node-contract-v1 (nuevas misiones; proyección del contrato propio, no garantía de ceguera)
          --producer-batch read-test-v1 (nuevas misiones; lecturas y una prueba final fijada, sin escrituras ni aumento de presupuesto)
          --producer-batch read-test-cursor-v1 (opt-in nuevo; recuperación del lote exacto y cargos durables; exige ejecutor compatible con protocolo 4)
          --context-encoding plain-json|lossless-v1|lossless-json-v2|source-text-v1 (se conserva con la misión)
          --review-encoding expanded-json|evidence-refs-v1|evidence-catalog-v1 (opcional; sin cambio de predeterminado)
          --parallel-pure-nodes 1..4 (opcional; sólo nodos sin herramientas ni efectos en su ascendencia)
          --entry-mode planned|closed-response-v1|closed-response-v2|closed-response-v3 (experimental opt-in; v2 usa contrato propio sin roles prestados)
                       closed-response-v3 sólo con adaptive-v3: ruta determinista estrecha; una solicitud no admisible no se fuerza y v3 normal cae a planned
                       bounded-read-response-v1 (experimental opt-in; hasta una entrada local completa y revisión propia, sin cambiar presets)
                       sourced-response-v1 (experimental opt-in; pregunta factual pública, adquisición y revisión con citas; protocolo 10, sin cambiar presets)
          --sourced-fallback defer-only-v1 (sólo nueva sourced-response-v1: si no cierra, queda NEEDS_DIRECTION y exige una nueva admisión planned explícita; nunca escala contexto o adjuntos en silencio)
          --sourced-evidence-profile es-used-car-listing-v2 (perfil actual para nueva pregunta pública española de campos de anuncio de coche: tres fuentes públicas selladas —ficha, ubicación y fotos—, sin búsqueda libre; v1 permanece sólo para misiones históricas)
          --bounded-read-presentation separate-evidence-v1 (sólo nuevas misiones con entrada bounded-read-response-v1; protocolo 9)
                       Separa evidencia y cuerpo sin quitar la revisión ni las citas pedidas; no cambia transporte ni presets
          --planning-contracts on-demand-v1 --planning-call-limit 1..100 (nuevas misiones; reservas globales de consultas/propuestas del planificador, no llamadas del juez)
          --planning-card-bytes 1..262144 (opcional con las dos anteriores; fichas completas, sin truncar)
          --mission-call-limit 1..1000 (nuevas misiones; techo compartido de reservas de inferencia, incluidos jueces/réplicas/búsqueda; no tokens ni reintentos internos)
          --method-recovery-rounds 1..100 (nuevas misiones; revisión independiente del método tras rechazo material, sin borrar historial ni reponer inferencias)
          --provenance-policy RUTA (política local JSON de claves de procedencia de aprendizaje; alternativa: SOVEREIGN_LEARNING_PROVENANCE_POLICY)
                       Nunca se toma del manifiesto de dominio. learn-validate sólo valida su forma y no abre estado;
                       las fuentes, firmas y revocaciones se verifican al registrar o usar un dominio.
El estado queda en ~/.local/state/sovereign-factory por defecto.
Sin API fallback. Ejecución aislada por snapshot desechable, sin red, con controles en cada operación.
`;
const {values, positionals} = parseArgs({allowPositionals: true, strict: true, options: {
  text: {type: 'string'}, file: {type: 'string'}, 'state-dir': {type: 'string'}, model: {type: 'string'}, effort: {type: 'string'}, profile: {type: 'string'}, preset: {type:'string'}, 'card-encoding':{type:'string'}, 'producer-context':{type:'string'}, 'context-encoding': {type:'string'}, 'review-encoding': {type:'string'}, 'parallel-pure-nodes':{type:'string'}, 'entry-mode':{type:'string'}, 'request-id': {type:'string'}, node:{type:'string'},reason:{type:'string'},json: {type: 'boolean'}, help: {type: 'boolean'},
  'planning-contracts':{type:'string'},'planning-call-limit':{type:'string'},'planning-card-bytes':{type:'string'},
  'producer-batch':{type:'string'},
  'bounded-read-presentation':{type:'string'},'sourced-fallback':{type:'string'},'sourced-evidence-profile':{type:'string'},
  'mission-call-limit':{type:'string'},
  'method-recovery-rounds':{type:'string'},
  'allowed-tools':{type:'string'},
  'provenance-policy':{type:'string'},
  inputs:{type:'string'},'project-context':{type:'string'},'asset-manifest':{type:'string'},
}});
const [command, missionId] = positionals;
const missionOptions=()=>({...(values.inputs!==undefined?{inputs:readInputManifest(values.inputs)}:{}),...(values['project-context']!==undefined?{projectContext:readProjectContextDescriptor(values['project-context'])}:{}),...(values['asset-manifest']!==undefined?{assetManifest:readSublimineAssetManifest(values['asset-manifest'])}:{}),...(values.preset!==undefined?{preset:values.preset}:{}),
  ...(values['allowed-tools']!==undefined?{allowedTools:values['allowed-tools']===''?[]:values['allowed-tools'].split(',').map(x=>x.trim())}:{}),
  ...(values.model?{model:values.model}:{}),...(values.effort?{reasoningEffort:values.effort}:{}),
  ...(values.profile?{instructionProfile:values.profile}:{}),...(values['context-encoding']?{contextEncoding:values['context-encoding']}:{}),
  ...(values['review-encoding']?{reviewEncoding:values['review-encoding']}:{}),
  ...(values['card-encoding']!==undefined?{cardEncoding:values['card-encoding']}:{}),
  ...(values['producer-context']!==undefined?{producerContext:values['producer-context']}:{}),
  ...(values['producer-batch']!==undefined?{producerBatch:values['producer-batch']}:{}),
  ...(values['bounded-read-presentation']!==undefined?{boundedReadPresentation:values['bounded-read-presentation']}:{}),
  ...(values['sourced-fallback']!==undefined?{sourcedFallback:values['sourced-fallback']}:{}),
  ...(values['sourced-evidence-profile']!==undefined?{sourcedEvidenceProfile:values['sourced-evidence-profile']}:{}),
  ...(values['mission-call-limit']!==undefined?{inferenceBudget:{mode:'mission-calls-v1',maxCalls:Number(values['mission-call-limit'])}}:{}),
  ...(values['method-recovery-rounds']!==undefined?{methodRecovery:{mode:'reviewed-method-v1',maxRounds:Number(values['method-recovery-rounds'])}}:{}),
  ...(values['planning-contracts']!==undefined?{planningContracts:{mode:values['planning-contracts'],maxCalls:Number(values['planning-call-limit']),
    ...(values['planning-card-bytes']!==undefined?{maxBytes:Number(values['planning-card-bytes'])}:{})}}:{}),
  ...(values['parallel-pure-nodes']!==undefined?{maxParallelPureNodes:Number(values['parallel-pure-nodes'])}:{}),
  ...(values['entry-mode']!==undefined?{entryMode:values['entry-mode']}:{})});
let engine;
let learningProvenancePolicy=null;

/**
 * Policy files are operator configuration, not mission/domain input. Capture
 * them with the same regular-file/no-link/complete-read admission path used
 * for explicit CLI inputs, but retain the parsed JSON: the normalized value
 * contains KeyObjects and must never become the persisted runtime policy.
 */
function readLearningProvenancePolicy(path){
  if(typeof path!=='string'||path.length===0)throw Error('La política de procedencia debe indicar una ruta JSON no vacía.');
  const raw=captureMissionInputs([{source:path,path:'learning-provenance-policy.json'}])[0].content;
  let policy;
  try{policy=JSON.parse(raw.toString('utf8'));}catch{throw Error('La política de procedencia debe ser JSON UTF-8 válido.');}
  normalizeLearningProvenancePolicy(policy);
  return policy;
}

const withLearningProvenancePolicy=options=>({...options,learningProvenancePolicy});

function readRequestFile(path){
  // Capture strictly before decoding: never substitute malformed bytes, follow
  // links or publish the request as a mission data attachment.
  return captureMissionInputs([{source:path,path:'request.txt'}],engine.broker)[0].content.toString('utf8');
}
function readInputManifest(path){
  const raw=captureMissionInputs([{source:path,path:'manifest.json'}],engine.broker)[0].content;
  let manifest;try{manifest=JSON.parse(raw.toString('utf8'));}catch{throw Error('El manifiesto de adjuntos debe ser JSON UTF-8 válido.');}
  return captureMissionInputs(manifest,engine.broker);
}
function readProjectContextDescriptor(path){
  if(typeof path!=='string'||path.length===0)throw Error('El descriptor de contexto de proyecto debe indicar una ruta JSON no vacía.');
  const raw=captureMissionInputs([{source:path,path:'project-context-descriptor.json'}],engine.broker)[0].content;
  try{return JSON.parse(raw.toString('utf8'));}
  catch{throw Error('El descriptor de contexto de proyecto debe ser JSON UTF-8 válido.');}
}
function readSublimineAssetManifest(path){
  if(typeof path!=='string'||path.length===0)throw Error('El manifiesto de activos debe indicar una ruta JSON no vacía.');
  const raw=captureMissionInputs([{source:path,path:'sublimine-asset-manifest.json'}],engine.broker)[0].content;
  return {schema:SUBLIMINE_ASSET_MANIFEST_OPTION_SCHEMA,inputSha256:sha256(raw),
    manifest:parseSublimineAssetManifestBytes(raw)};
}
let executionRunner = null, runnerStatus;
// Delivery neither runs code nor reports runtime availability. Avoid even
// constructing an execution adapter on this narrow read path.
if(command!=='delivery'&&!values.help){
  try { executionRunner = new IsolatedExecutionRunner(); runnerStatus = executionRunner.available(); }
  catch (error) { runnerStatus = {available: false, code: error.code ?? 'CAPABILITY', reason: 'No se ha podido inicializar el ejecutor aislado; no existe fallback sin aislamiento.'}; }
}
try {
  // `delivery` is intentionally a tiny read endpoint, rather than another
  // report/status spelling.  Reject unrelated known flags before loading an
  // optional learning policy or opening state, so they cannot create hidden
  // configuration dependencies or broaden the command's surface over time.
  if(command==='delivery'&&!values.help){
    if(positionals.length!==2||!missionId)throw Error('delivery requiere exactamente un identificador de misión.');
    if(Object.keys(values).some(key=>!['state-dir','json'].includes(key)))throw Error('delivery sólo admite --state-dir y --json.');
    if(!values.json)throw Error('delivery requiere --json para conservar su contrato textual mínimo y estable.');
  }
  // An explicit command flag wins over the environment. Do not load this for
  // --help: help must remain available even if an operator's old environment
  // variable points at a removed policy file.
  const configuredPolicyPath=values['provenance-policy']??process.env.SOVEREIGN_LEARNING_PROVENANCE_POLICY;
  if(!values.help&&command!=='delivery'&&configuredPolicyPath!==undefined&&configuredPolicyPath!==null&&configuredPolicyPath!==''){
    learningProvenancePolicy=readLearningProvenancePolicy(configuredPolicyPath);
  } else if(!values.help&&values['provenance-policy']===''){
    throw Error('La política de procedencia debe indicar una ruta JSON no vacía.');
  }
  if(values.inputs!==undefined&&!values.help&&!['submit','run'].includes(command))throw Error('Los adjuntos sólo se admiten al crear una misión; no sustituyen archivos ni originales de una existente.');
  if(values['project-context']!==undefined&&!values.help&&!['submit','run'].includes(command))throw Error('El contexto de proyecto sólo se admite al crear una misión; no sustituye ni reinterpreta el contexto de una existente.');
  if(values['project-context']!==undefined&&values.inputs===undefined&&!values.help)throw Error('El contexto de proyecto requiere --inputs con el snapshot privado nombrado por el descriptor.');
  if(values['asset-manifest']!==undefined&&!values.help&&!['submit','run'].includes(command))throw Error('El manifiesto de activos sólo se admite al crear una misión; no sustituye ni reinterpreta activos de una existente.');
  if(values['asset-manifest']!==undefined&&values.inputs===undefined&&!values.help)throw Error('El manifiesto de activos requiere --inputs con la misma instantánea UTF-8 en assets/manifest.json.');
  if(!values.help&&['planning-contracts','planning-call-limit','planning-card-bytes'].some(k=>values[k]!==undefined)){
    if(!['submit','run'].includes(command))throw Error('La inspección de fichas sólo se selecciona al crear una misión; no cambia una existente.');
    if(values['planning-contracts']===undefined||values['planning-call-limit']===undefined)throw Error('La inspección requiere modo y límite global explícitos.');
  }
  if(values.preset!==undefined&&!values.help&&!['submit','run'].includes(command))throw Error('El preset sólo se selecciona al crear una misión; no cambia misiones existentes.');
  if(values['allowed-tools']!==undefined&&!values.help&&!['submit','run'].includes(command))throw Error('La autoridad de herramientas sólo se selecciona al crear una misión; no amplía ni sustituye permisos existentes.');
  if(values['entry-mode']!==undefined&&!values.help&&!['submit','run'].includes(command))throw Error('La ruta de entrada sólo se selecciona al crear una misión.');
  if(values['sourced-fallback']!==undefined&&!values.help&&!['submit','run'].includes(command))throw Error('El fallback sourced sólo se selecciona al crear una misión.');
  if(values['sourced-fallback']!==undefined&&!values.help&&values['entry-mode']!=='sourced-response-v1')throw Error('El fallback sourced requiere --entry-mode sourced-response-v1 en la nueva misión.');
  if(values['bounded-read-presentation']!==undefined&&!values.help&&!['submit','run'].includes(command))throw Error('La presentación acotada sólo se selecciona al crear una misión; no cambia una existente.');
  if(values['card-encoding']!==undefined&&!values.help&&!['submit','run'].includes(command))throw Error('El formato de fichas sólo se selecciona al crear una misión.');
  if(values['producer-context']!==undefined&&!values.help&&!['submit','run'].includes(command))throw Error('La exposición del plan sólo se selecciona al crear una misión.');
  if(values['producer-batch']!==undefined&&!values.help&&!['submit','run'].includes(command))throw Error('El modo de lotes sólo se selecciona al crear una misión; no cambia una existente.');
  if(values['mission-call-limit']!==undefined&&!values.help&&!['submit','run'].includes(command))throw Error('El presupuesto de misión sólo se selecciona al crearla; no cambia ni reinicia una existente.');
  if(values['method-recovery-rounds']!==undefined&&!values.help&&!['submit','run'].includes(command))throw Error('Las rondas de revisión de método sólo se autorizan al crear una misión; no reinician una existente.');
  if (!command || values.help) { process.stdout.write(usage); }
  else if (command === 'roles') {
    process.stdout.write(JSON.stringify(missionId ? getRole(missionId) : listCapabilities(), null, 2) + '\n');
  } else if (command === 'service-status') {
    process.stdout.write(JSON.stringify(inspectUserService(),null,2)+'\n');
  } else if (command === 'doctor') {
    const provider = new CodexProvider();
    try {
      const result = {provider: await provider.start(), models: await provider.models(), node: process.version,
        codeRunner: {...runnerStatus, integrated: true, perRunGatesRequired: true,
          reason: 'Disponibilidad de infraestructura, no certificación universal. Cada trabajo exige aislamiento, límites y terminación comprobados.'}};
      process.stdout.write(JSON.stringify(result, null, 2) + '\n');
    } finally { await provider.close(); }
  } else if (['submit','serve','queue','pause','continue','cancel'].includes(command)) {
    const stateDir=resolve(values['state-dir']??join(homedir(),'.local/state/sovereign-factory'));
    if(!['submit','serve'].includes(command)&&!existsSync(join(stateDir,'state.sqlite')))throw Error('No existe estado guardado en esa ruta.');
    engine=new FactoryEngine(withLearningProvenancePolicy({databasePath:join(stateDir,'state.sqlite'),workspaceRoot:join(stateDir,'workspaces'),executionRunner,searchProvider:new PublicSearch(),
      onEvent:event=>process.stderr.write(JSON.stringify(event)+'\n')}));
    const queue=new MissionQueue({engine});
    if(command==='submit'){
      if(Boolean(values.text)===Boolean(values.file))throw Error('Indica exactamente una petición: --text o --file.');
      const intent=values.file?readRequestFile(values.file):values.text;
      const job=queue.submit(intent,missionOptions(),values['request-id']);
      process.stdout.write(JSON.stringify(job,null,2)+'\n');
    } else if(command==='queue')process.stdout.write(JSON.stringify(queue.list(),null,2)+'\n');
    else if(command==='serve'){
      const stop=new AbortController(),handler=()=>stop.abort();process.once('SIGINT',handler);process.once('SIGTERM',handler);
      process.stderr.write(JSON.stringify({kind:'queue.starting',stateDir,transport:'local-sqlite-no-listening-port'})+'\n');
      try{await queue.serve({signal:stop.signal});}finally{process.removeListener('SIGINT',handler);process.removeListener('SIGTERM',handler);}
    } else {
      if(!missionId)throw Error('Falta el identificador de misión.');
      process.stdout.write(JSON.stringify(queue.request(missionId,command),null,2)+'\n');
    }
  } else if(['learn-list','learn-status','learn-observe','learn-propose','learn-evaluators','learn-evaluate','learn-validate','learn-register'].includes(command)) {
    const registration=command==='learn-register';
    const validation=command==='learn-validate';
    const learningOptions=validation?['json','file','provenance-policy']:['state-dir','json','provenance-policy',...(registration?['file']:[])];
    if(positionals.length>(['learn-list','learn-status','learn-evaluators','learn-validate','learn-register'].includes(command)?1:2)
      ||Object.keys(values).some(key=>!learningOptions.includes(key)))throw Error('Los comandos de aprendizaje conservan la configuración congelada: sólo --state-dir/--json/--provenance-policy y, para learn-register/learn-validate, --file; learn-validate no abre estado.');
    if((registration||validation)&&!values.file)throw Error((registration?'El registro':'La validación')+' requiere --file con un manifiesto de dominio completo.');
    let manifest,validationInfo;
    if(registration||validation){
      // Validate even malformed files/scopes before Authority or the workspace
      // constructor can initialize an otherwise empty existing state database.
      const raw=captureMissionInputs([{source:values.file,path:'domain.json'}])[0].content;
      try{manifest=JSON.parse(raw.toString('utf8'));}catch{throw Error('El dominio debe ser JSON UTF-8 válido.');}
      validationInfo=validateLearningDomainRegistration(manifest);
    }
    if(validation){
      process.stdout.write(JSON.stringify({...validationInfo,validation:'VALID',readOnly:true,
        caveat:'Validated entirely in memory: no destination state was opened, no domain was registered, and no inference, evaluation, activation or export occurred.'},null,2)+'\n');
    } else {
    const stateDir=resolve(values['state-dir']??join(homedir(),'.local/state/sovereign-factory'));
    if(!existsSync(join(stateDir,'state.sqlite')))throw Error('No existe estado guardado en esa ruta.');
    if(!['learn-list','learn-status','learn-evaluators','learn-register'].includes(command)&&!missionId)throw Error('Falta el identificador de misión o ciclo.');
    let commitRegistration;
    if(registration){
      commitRegistration=prepareLearningDomainRegistration(manifest);
    }
    engine=new FactoryEngine(withLearningProvenancePolicy({databasePath:join(stateDir,'state.sqlite'),workspaceRoot:join(stateDir,'workspaces'),executionRunner}));
    let result;
    if(command==='learn-list')result=publicLearningCycleList();
    else if(command==='learn-status')result=learningStatusReport(engine.store);
    else if(command==='learn-evaluators')result=engine.learningEvaluation.list();
    else if(registration)result=commitRegistration(engine.learning);
    else if(command==='learn-observe'){
      engine.status(missionId); // Do not silently claim an absent mission was observed.
      engine.learningConductor.observeMission(missionId);
      result=publicLearningActionAcknowledgement('OBSERVE');
    }else{
      const stop=new AbortController(),handler=()=>stop.abort();process.once('SIGINT',handler);process.once('SIGTERM',handler);
      try{
        if(command==='learn-evaluate')await engine.learningEvaluation.evaluate(missionId,{signal:stop.signal});
        else await engine.learningConductor.advance(missionId,{signal:stop.signal});
        result=publicLearningActionAcknowledgement(command==='learn-evaluate'?'EVALUATE':'PROPOSE');
      }finally{process.removeListener('SIGINT',handler);process.removeListener('SIGTERM',handler);}
    }
    process.stdout.write(JSON.stringify(result,null,2)+'\n');
    }
  } else {
    if (!['run', 'resume', 'status', 'show', 'plan', 'report','delivery','retry-review'].includes(command)) throw Error('Comando desconocido. Usa --help.');
    if (command !== 'run' && !missionId) throw Error('Falta el identificador de misión.');
    const stateDir = resolve(values['state-dir'] ?? join(homedir(), '.local/state/sovereign-factory'));
    const databasePath = join(stateDir, 'state.sqlite');
    if (command !== 'run' && !existsSync(databasePath)) throw Error('No existe estado guardado en esa ruta.');
    let target = missionId;
    if(command==='delivery'){
      if(!values.json)throw Error('delivery requiere --json para conservar su contrato textual mínimo y estable.');
      // Do not construct FactoryEngine here: its broker prepares a workspace
      // directory. Existing-only state/key reopening plus this narrow reader
      // makes `delivery` an actual no-write retrieval command.
      const readStore=new Store(databasePath,{existingOnly:true});
      try{
        const readAuthority=new Authority(readStore,{existingOnly:true}),readRegistry=new ArtifactRegistry(readStore,readAuthority);
        // `existingOnly` prevents bootstrap; `query_only` additionally turns
        // any accidental future mutation in this command path into an SQLite
        // failure instead of silently changing a mission database.
        readStore.db.exec('PRAGMA query_only=ON; PRAGMA trusted_schema=OFF;');
        process.stdout.write(JSON.stringify(readPublicTextDelivery({registry:readRegistry,missionId:target}),null,2)+'\n');
      }finally{readStore.close();}
    } else {
    engine = new FactoryEngine(withLearningProvenancePolicy({databasePath, workspaceRoot: join(stateDir, 'workspaces'), executionRunner, searchProvider:new PublicSearch(),onEvent: event => {
      if (['run', 'resume'].includes(command)) process.stderr.write(JSON.stringify(event) + '\n');
    }}));
    if (command === 'run') {
      if (Boolean(values.text) === Boolean(values.file)) throw Error('Indica exactamente una petición: --text o --file.');
      const intent = values.file ? readRequestFile(values.file) : values.text;
      const mission = engine.create(intent, missionOptions()); target = mission.id;
      process.stderr.write(`Misión: ${target}\n`);
    }
    const controller = new AbortController();
    const cancel = () => controller.abort(); process.once('SIGINT', cancel); process.once('SIGTERM', cancel);
    const report = ['run', 'resume'].includes(command) ? await engine.run(target, {signal: controller.signal}) : engine.status(target);
    process.removeListener('SIGINT', cancel); process.removeListener('SIGTERM', cancel);
    if(command==='retry-review')process.stdout.write(JSON.stringify(engine.grantReviewRetry(target,{nodeId:values.node,reason:values.reason}),null,2)+'\n');
    else if (command === 'report') {
      const evidence = engine.report(target);
      process.stdout.write(values.json ? JSON.stringify(evidence, null, 2) + '\n' : formatMissionReport(evidence));
    }
    else if (command === 'plan') process.stdout.write(JSON.stringify(report.plan, null, 2) + '\n');
    else if (values.json) process.stdout.write(JSON.stringify(report, null, 2) + '\n');
    else {
      process.stdout.write(`${report.mission.id}\nEstado guardado: ${report.mission.status}\n`);
      for (const pending of report.mission.pending) process.stdout.write(safeDisplay(`Pendiente [${pending.code}]${pending.nodeId?`: ${pending.nodeId}`:pending.operationId?`: ${pending.operationId}`:''}\n`));
      if (report.outcome && command !== 'status') process.stdout.write(safeDisplay(`\n${report.outcome.payload.body}\n\nArtefacto: ${report.outcome.id}\nEstado del artefacto: ${report.outcome.status}\n`));
      else for (const node of report.nodes) process.stdout.write(safeDisplay(`  ${node.id}: ${node.status} — ${node.spec.title}\n`));
    }
    if (['run', 'resume'].includes(command) && report.mission.status !== 'COMPLETED') process.exitCode = 2;
    }
  }
} catch (error) {
  process.stderr.write(safeDisplay(`${error.code ?? 'ERROR'}: ${error.message}\n`)); process.exitCode = 1;
} finally { engine?.close(); }
