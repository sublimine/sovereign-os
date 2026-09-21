import * as fs from 'node:fs';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {canonical,sha256} from '../../factory/lib/contracts.mjs';
import {DOCUMENT_URLS,gradeRouteContent,sourceUrlMatches} from './full-route-cases.mjs';
import {intervalOracleProgram,gradeIntervalExecution} from './interval-union-oracle.mjs';
import {auditRouteTool,auditRouteLineage,verifiedRouteSources,gradeDevelopmentBinding,routeMaterialState,compareRouteMaterial,auditRouteReentryJournal,auditSourceUse} from './full-route-audit.mjs';
import {ADAPTIVE_V3_EXTERNAL_EXECUTION_KIND,ADAPTIVE_V3_EXTERNAL_EXECUTION_RECORD_TYPE,
  adaptiveV3ExternalExecutionEvidence} from './adaptive-v3-external-execution-evidence.mjs';

export const writeRouteEvidence=(directory,name,value)=>fs.writeFileSync(join(directory,name),JSON.stringify(value,null,2),{flag:'wx',mode:0o600});
const boundary=(ok,message)=>{if(!ok)throw Object.assign(Error(message),{code:'EXPERIMENT_BOUNDARY'});};
const SOURCE_FIXTURE_SCHEMA='sovereign.source-fixture.v1';
const ownPlainObject=value=>value!==null&&typeof value==='object'&&!Array.isArray(value)&&Object.getPrototypeOf(value)===Object.prototype;
function normalizeSourceFixture(value,{spec,mode,simulation}){
  if(value===null){
    boundary(!(mode==='adaptive-v3-planned'&&simulation===true&&spec.family==='sources'),
      'The simulated adaptive-v3 sources row requires its closed network-disabled fixture');
    return null;
  }
  boundary(mode==='adaptive-v3-planned'&&simulation===true&&spec.family==='sources',
    'Source fixtures are CI-only and limited to the simulated adaptive-v3 sources row');
  boundary(ownPlainObject(value)&&canonical(Object.keys(value).sort())===canonical(['network','responses','schema','transport']),
    'Source fixture must use the closed fixture schema');
  boundary(value.schema===SOURCE_FIXTURE_SCHEMA&&value.transport==='SIMULATED'&&value.network==='DISABLED',
    'Source fixture must declare simulated transport with network disabled');
  boundary(ownPlainObject(value.responses),'Source fixture responses must be a plain object');
  const urls=Object.values(DOCUMENT_URLS).sort();
  boundary(canonical(Object.keys(value.responses).sort())===canonical(urls),'Source fixture must bind exactly the preregistered primary URLs');
  const responses={};
  for(const url of urls){
    const response=value.responses[url];
    boundary(ownPlainObject(response)&&canonical(Object.keys(response).sort())===canonical(['body','contentType']),
      'Each source fixture response must have only body and contentType');
    boundary(typeof response.body==='string'&&!response.body.includes('\0')&&response.contentType==='text/plain; charset=utf-8',
      'Source fixture response has an invalid closed textual representation');
    const raw=Buffer.from(response.body,'utf8');
    boundary(raw.toString('utf8')===response.body&&raw.length<=2*1024*1024,'Source fixture body is not bounded lossless UTF-8');
    responses[url]={body:response.body,contentType:response.contentType,bytes:raw.length,sha256:sha256(raw)};
  }
  const fixtureId=sha256({schema:SOURCE_FIXTURE_SCHEMA,transport:value.transport,network:value.network,
    responses:Object.entries(responses).map(([url,response])=>({url,contentType:response.contentType,bytes:response.bytes,sha256:response.sha256}))});
  return {fixtureId,urls,responses,
    sourceLookup:async()=>[{address:'8.8.8.8',family:4}],
    sourceTransport:async({url,address})=>{
      boundary(address==='8.8.8.8','Source fixture transport received an unpinned address');
      const response=responses[url.href];boundary(response!==undefined,'Source fixture transport received an unbound URL');
      return {remoteAddress:address,statusCode:200,headers:{'content-type':response.contentType},body:Buffer.from(response.body,'utf8')};
    },
    sourceTransportDescriptor:{schema:'sovereign.source-transport.v1',classification:'SIMULATED_FIXTURE',network:'DISABLED',fixtureId}};
}
const adaptiveV3FixtureDeclaration=(spec,sourceFixture)=>({provider:'SIMULATED',
  transport:sourceFixture?'SIMULATED_FIXTURE':'NOT_USED',network:sourceFixture?'DISABLED':'NOT_USED',
  execution:spec.family==='development'?'REAL_LOCAL_ISOLATED':'NOT_USED',
  ...(sourceFixture?{sourceFixtureId:sourceFixture.fixtureId,sourceUrls:sourceFixture.urls,
    sourceResponseHashes:sourceFixture.urls.map(url=>({url,contentType:sourceFixture.responses[url].contentType,
      sha256:sourceFixture.responses[url].sha256,bytes:sourceFixture.responses[url].bytes}))}:{}),
  scope:'Control-plane fixture classification. SIMULATED provider/transport is not subscription or factual-truth evidence; real local isolated execution, when present, is separately receipt-bound.'});
export function fullRoutePolicy(spec,mode){
  const adaptiveV3Planned=mode==='adaptive-v3-planned';
  boundary(spec.modes.includes(mode),'Preregistered arm required');
  // V3 is deliberately an opt-in, separately named arm.  Do not add this
  // mode to the historical live cases: a fixture must declare that it is a
  // V3 qualification before the harness can select its immutable route.
  boundary(!adaptiveV3Planned||spec.adaptiveV3Qualification===true,
    'Explicit adaptive-v3 planned qualification required');
  boundary(spec.documentContext===undefined||spec.family==='sources'&&spec.documentContext==='literal-windows-v1','Explicit source-only documentary qualification');
  boundary(spec.closedEntryVersion===undefined||!adaptiveV3Planned&&spec.closedEntryVersion==='closed-response-v2'&&spec.family==='transformation'
    &&spec.allowedTools.length===0,'Explicit closed, effect-free v2 qualification only');
  boundary(spec.producerBatch===undefined||spec.producerBatch==='read-test-v1'&&spec.family==='development',
    'Read-test qualification is an explicit development-only selection');
  boundary(spec.qualificationMaxNodeAttempts===undefined||adaptiveV3Planned&&spec.adaptiveV3Qualification===true
    &&spec.qualificationMaxNodeAttempts===1,
  'Only the explicit adaptive-v3 recovery qualification may lower its node-attempt ceiling');
  return {preset:adaptiveV3Planned?'adaptive-v3':'adaptive-v1',
    // The V3 arm intentionally pins the current Terra/high target.  This
    // proves exact policy binding, not semantic capability of a simulated
    // provider.  Legacy arms retain their historical policy unchanged.
    model:adaptiveV3Planned?'gpt-5.6-terra':'gpt-6-astra',reasoningEffort:adaptiveV3Planned?'high':'ultra',allowedTools:[...spec.allowedTools],
    cardEncoding:'compact-json-v1',producerContext:'node-contract-v1',maxParallelPureNodes:2,
    maxPlanAttempts:2,maxNodeAttempts:spec.qualificationMaxNodeAttempts??2,...(adaptiveV3Planned||mode==='planned'?{entryMode:'planned'}:spec.closedEntryVersion?{entryMode:spec.closedEntryVersion}:{}),
    ...(spec.documentContext?{documentContext:spec.documentContext}:{}),
    ...(spec.producerBatch?{producerBatch:spec.producerBatch}:{})};
}

/** No simulated upstream stages in a real arm. Test injection is explicitly
 * simulated, can exercise structural checks, and can NEVER qualify live work.
 * No replay/resume of failed arms. Every raw receipt is retained before validators.
 */
export async function runFullRouteCase({runtimeRoot,directory,spec,mode,providerFactory,simulation=true,
  frozen=()=>true,signal,onEvent,sourceFixture=null}){
  boundary(fs.readdirSync(directory).length===0,'Fresh empty case directory');
  const adaptiveV3Planned=mode==='adaptive-v3-planned';
  boundary(typeof simulation==='boolean'&&(!adaptiveV3Planned||simulation===true),
    'Adaptive-v3 planned qualification is CI-only and cannot enter a subscription arm');
  boundary(typeof providerFactory==='function','A provider factory is required for an explicit harness arm');
  const normalizedSourceFixture=normalizeSourceFixture(sourceFixture,{spec,mode,simulation});
  const load=path=>import(pathToFileURL(join(runtimeRoot,path)));
  const {FactoryEngine}=await load('factory/lib/engine.mjs'),{Store}=await load('factory/lib/store.mjs'),
    {Authority}=await load('factory/lib/authority.mjs'),{ArtifactRegistry}=await load('factory/lib/artifacts.mjs'),
    {WorkerService}=await load('factory/lib/workers.mjs'),{ToolBroker}=await load('factory/tools/broker.mjs'),
    {IsolatedExecutionRunner}=await load('factory/tools/execution.mjs');
  const {readSourceContextView}=await load('factory/lib/source-context-view.mjs');
  const {inferenceRequestHash}=await load('factory/providers/instruction-profiles.mjs');
  const {missionReport}=await load('factory/lib/report.mjs');
  const {ADAPTIVE_V3_ROUTE_RECORD_TYPE,assertAdaptiveV3MissionRoute}=await load('factory/lib/adaptive-v3-route-contract.mjs');
  const {ADAPTIVE_V3_DIRECT_CERTIFICATION_TYPE,ADAPTIVE_V3_DIRECT_ENTRY_NODE,ADAPTIVE_V3_DIRECT_ENTRY_PURPOSE,
    ADAPTIVE_V3_DIRECT_ORIGIN_TYPE}=await load('factory/lib/adaptive-v3-deterministic-entry.mjs');
  const write=(name,value)=>writeRouteEvidence(directory,name,value),policy=fullRoutePolicy(spec,mode);
  const executionRunner=spec.family==='development'?new IsolatedExecutionRunner():null,
    databasePath=join(directory,'state.sqlite'),workspaceRoot=join(directory,'workspace');
  // The normal constructor is only used for the initial exercise. The V3
  // re-entry below receives a capability-reduced facade built before its
  // WorkerService and BlindReplicationService are constructed. It reopens
  // persisted state in a fresh in-process Engine instance; it does not claim
  // an OS-process restart or a resumed delivery run.
  const makeEngine=({initial=false}={})=>new FactoryEngine({databasePath,workspaceRoot,onEvent,
    ...(initial?{executionRunner,...(normalizedSourceFixture?{sourceLookup:normalizedSourceFixture.sourceLookup,
      sourceTransport:normalizedSourceFixture.sourceTransport,sourceTransportDescriptor:normalizedSourceFixture.sourceTransportDescriptor}:{} )}:{})});
  const makeReadOnlyReentryEngine=({missionId,guards})=>{
    // B must reject absent or malformed persisted dependencies instead of
    // initializing them before validation-only guards exist.  Its later lease
    // and workspace-validation commits remain explicit journaled operations.
    const store=new Store(databasePath,{existingOnly:true});
    let authority,registry,backing;
    try{
      authority=new Authority(store,{existingOnly:true});
      registry=new ArtifactRegistry(store,authority);
      backing=new ToolBroker({store,authority,workspaceRoot,requireExistingWorkspaceRoot:true});
    }catch(error){store.close();throw error;}
    const blocked=(surface,detail={})=>{
      guards.blocked.push({surface,...detail});
      // Surface names are fixed control-plane identifiers, not user/provider
      // payload. Keep the failure diagnostically attributable without leaking
      // untrusted arguments into CI evidence.
      throw Object.assign(Error(`Validation-only re-entry attempted forbidden ${surface}`),{code:'REENTRY_FORBIDDEN',details:{surface}});
    };
    const broker=Object.freeze({
      // This is intentionally a facade, not a patched ToolBroker. The backing
      // instance remains in this closure and is never reachable through Engine,
      // WorkerService or BlindReplicationService.
      workspaceClassification:backing.workspaceClassification,
      sourceTransport:Object.freeze({schema:'sovereign.reentry-broker.v1',classification:'UNAVAILABLE',network:'DISABLED',fixtureId:null}),
      executionAvailable:()=>false,searchAvailable:()=>false,
      workspaceTool:(reentryMissionId,tool,args,localSignal)=>{
        if(reentryMissionId!==missionId||!['workspace.read','workspace.list'].includes(tool))return blocked('broker.workspaceTool',{missionId:reentryMissionId??null,tool:tool??null});
        guards.workspaceReads.push({tool,path:args?.path??null});
        return backing.workspaceTool(reentryMissionId,tool,args,localSignal);
      },
      executionSnapshot:reentryMissionId=>{
        if(reentryMissionId!==missionId)return blocked('broker.executionSnapshot',{missionId:reentryMissionId??null});
        if(guards.phase==='reentry')guards.reentrySnapshots++;else guards.postCheckSnapshots++;
        return backing.executionSnapshot(reentryMissionId);
      },
      // A lease needs a local expiry horizon before its read/list observation.
      // This does not dispatch a broker operation or expose runner/network
      // configuration; only the two snapshot actions get a fixed bound.
      toolDeadline:tool=>['workspace.read','workspace.list'].includes(tool)?15_000:blocked('broker.toolDeadline',{tool:tool??null}),
      validateArgs:(tool,args)=>blocked('broker.validateArgs',{tool:tool??null}),
      execute:async input=>blocked('broker.execute',{tool:input?.tool??null}),
      fetchSource:async()=>blocked('broker.fetchSource'),searchSource:async()=>blocked('broker.searchSource'),
      runExecution:async()=>blocked('broker.runExecution'),reconcileExecutions:()=>blocked('broker.reconcileExecutions'),
      registerWorkspace:()=>blocked('broker.registerWorkspace'),workspace:()=>blocked('broker.workspace'),resolvePath:()=>blocked('broker.resolvePath')
    });
    const workers=new WorkerService({store,authority,registry,broker,
      providerFactory:()=>blocked('workers.providerFactory'),nativeProviderFactory:()=>blocked('workers.nativeProviderFactory')});
    Object.freeze(workers);
    let engine;
    try{
      engine=new FactoryEngine({store,authority,registry,broker,workers,workspaceRoot,onEvent});
      engine.learningConductor.observeMission=()=>blocked('learning.observeMission');
      Object.freeze(engine.learningConductor);Object.freeze(engine.blind);
      return engine;
    }catch(error){store.close();throw error;}
  };
  let engine=makeEngine({initial:true});
  const fixtureDeclaration=adaptiveV3Planned?adaptiveV3FixtureDeclaration(spec,normalizedSourceFixture):null;
  const startedAt=new Date().toISOString(),mission=engine.create(spec.request,policy),calls=[],errors=[];
  let reentering=false,fatal=null,external=null,lineage=[],sourceRows=[],noReplay=false;
  let adaptiveV3Initial=null,adaptiveV3BeforeReentry=null,adaptiveV3AfterReentry=null;
  const auditAdaptiveV3=report=>{
    if(!adaptiveV3Planned)return {required:false,passed:true};
    try{
      const route=assertAdaptiveV3MissionRoute(engine.store,engine.authority,mission.id);
      const noDirectOrigin=engine.store.get(ADAPTIVE_V3_DIRECT_ORIGIN_TYPE,mission.id)===null;
      const noDirectCertificate=engine.store.list(ADAPTIVE_V3_DIRECT_CERTIFICATION_TYPE).length===0;
      const noDirectActor=engine.store.list('run').every(record=>record.data.missionId!==mission.id
        ||record.data.nodeId!==ADAPTIVE_V3_DIRECT_ENTRY_NODE);
      const noDirectArtifact=engine.store.list('artifact').every(record=>record.data.missionId!==mission.id
        ||record.data.payload?.purpose!==ADAPTIVE_V3_DIRECT_ENTRY_PURPOSE);
      const checks={signedRoute:route.routeRecord.type===ADAPTIVE_V3_ROUTE_RECORD_TYPE&&route.routeRecord.version===1,
        selectedPlanned:route.decision.selectedEntryMode==='planned'&&mission.policy.entryMode==='planned',
        // Admission precedes a public report; once a report is available its
        // projection must expose planned routing without a direct origin or
        // certificate reference.
        publicProjection:report===null||(report?.adaptiveV3?.selectedEntryMode==='planned'&&report.adaptiveV3.originRecord===null
          &&report.adaptiveV3.deterministicCertificationRecord===null),
        noDirectOrigin,noDirectCertificate,noDirectActor,noDirectArtifact};
      return {required:true,routeRecord:{type:route.routeRecord.type,id:route.routeRecord.id,version:route.routeRecord.version,hash:route.routeRecord.hash},
        decisionHash:route.decision.decisionHash,checks,passed:Object.values(checks).every(Boolean)};
    }catch(error){return {required:true,passed:false,error:{code:error.code??'UNKNOWN'}};}
  };
  if(adaptiveV3Planned){
    adaptiveV3Initial=auditAdaptiveV3(null);
    boundary(adaptiveV3Initial.passed,'Adaptive-v3 planned admission must create a signed planned route without direct material');
  }
  write('qualification.json',{startedAt,missionId:mission.id,caseId:spec.id,mode,simulation,policy,
    request:spec.request,requestHash:sha256(spec.request),specHash:sha256(spec),maxCalls:spec.maxCalls,
    fixtureDeclaration,
    scope:'Known full-route case. External oracle remains outside inference context. Stored ACCEPT alone is not qualification.'});
  const execute=engine.broker.execute.bind(engine.broker);
  engine.broker.execute=async input=>{
    boundary(!reentering&&frozen()&&!signal?.aborted,'No effects after freeze failure, interruption or delivery re-entry');
    auditRouteTool(spec,input.tool,input.args);return execute(input);
  };
  engine.workers.providerFactory=()=>{let provider;return {async generate(input){
    boundary(!reentering&&frozen()&&!signal?.aborted&&calls.length<spec.maxCalls,'Frozen, interruption, re-entry or call ceiling');
    const request={instructions:input.instructions,input:input.input,schema:input.schema,model:input.model,reasoningEffort:input.reasoningEffort,
      ...(input.instructionProfile?{instructionProfile:input.instructionProfile}:{})};
    const requestHash=inferenceRequestHash(request),actors=engine.store.list('run').filter(r=>r.data.expectedRequestHash===requestHash);
    boundary(actors.length===1,'One exact pending inference actor');
    const actor=actors[0].data,config=engine.store.get('worker-config',actor.id)?.data,context=readSourceContextView(input.input);
    boundary(context.missionIntent===spec.request&&config?.instructions&&sha256(config.instructions)===config.prefixHash
      &&input.instructions.startsWith(config.instructions),'Full immutable mandate and complete compiled role prefix');
    const index=calls.length,call={index,runId:actor.id,nodeId:actor.nodeId,mode:actor.mode,requestHash,
      startedAt:new Date().toISOString(),receipt:null,error:null};calls.push(call);
    write(`request-${index}.json`,{...call,request,prefixHash:config.prefixHash});
    try{
      provider??=providerFactory();
      const response=await provider.generate({...input,validate:async()=>true});
      // Rejected output still consumed a real turn. Preserve it BEFORE checking.
      write(`response-${index}.json`,response);call.receipt=response.receipt??null;
      boundary(response.receipt?.status==='completed'&&response.receipt.simulation===simulation
        &&response.receipt.contextHash===requestHash&&response.receipt.model===input.model
        &&response.receipt.reasoningEffort===input.reasoningEffort,'Exact completed classified receipt');
      await input.validate(response.value);return response;
    }catch(error){call.error={code:error.code??'UNKNOWN'};throw error;}
    finally{call.completedAt=new Date().toISOString();write(`call-${index}.json`,call);}
  },async close(){if(provider)await provider.close();}};};
  try{
    boundary(frozen()&&!signal?.aborted,'Frozen inputs before running');
    if(executionRunner)boundary(executionRunner.available().available,'Native execution capability before any model call');
    await engine.run(mission.id,{signal,pauseOnAbort:true});
    const report=missionReport(engine.store,mission.id,{registry:engine.registry});write('report.json',report);
    if(report.mission.status==='COMPLETED'){
      lineage=auditRouteLineage(engine,mission.id);write('lineage.json',lineage);
      sourceRows=verifiedRouteSources(engine,mission.id,startedAt);
      write('source-bindings.json',sourceRows.map(({raw,...s})=>s));
      if(spec.family==='sources')write('source-use.json',auditSourceUse(engine,mission.id,lineage,sourceRows));
      if(spec.family==='development'){
        const snapshot=engine.broker.executionSnapshot(mission.id);write('delivered-snapshot.json',snapshot);
        boundary(frozen()&&!signal?.aborted,'Frozen before independent oracle');
        let externalExecutionOwner=null;
        const execution=await executionRunner.run({args:{argv:['node','--input-type=module','--eval',intervalOracleProgram()],cwd:'.'},snapshot,signal,
          verifyAuthority:()=>boundary(frozen()&&!signal?.aborted,'Frozen external oracle authority'),
          onCreated:metadata=>{externalExecutionOwner=metadata;write('external-execution-owner.json',metadata);}});
        write('external-execution.json',execution);
        const binding=gradeDevelopmentBinding(snapshot,lineage,execution),content=gradeIntervalExecution(execution);
        external={binding,content,unchanged:engine.broker.executionSnapshot(mission.id).hash===snapshot.hash};
        external.passed=content.passed&&external.unchanged&&Object.values(binding).every(Boolean);
        // The closed JSON files below are human-readable projections, not the
        // authority for an observed external program. Seal their compact,
        // bounded binding while A is still live, before any validation-only
        // re-entry can inspect the persisted mission.
        const missionRecord=engine.store.get('mission',mission.id),finalArtifactRecord=engine.store.get('artifact',missionRecord?.data?.finalArtifactId),
          finalLineage=lineage.find(row=>row.artifactId===missionRecord?.data?.finalArtifactId),
          reviewerRunRecord=engine.store.get('run',finalLineage?.reviewerRunId),reviewRecord=engine.store.get('review',finalLineage?.reviewId);
        boundary(externalExecutionOwner!==null&&missionRecord&&finalArtifactRecord&&finalLineage&&reviewerRunRecord&&reviewRecord,
          'External execution evidence lacks its completed mission lineage owner');
        const receipt=adaptiveV3ExternalExecutionEvidence({missionRecord,finalArtifactRecord,reviewerRunRecord,reviewRecord,
          lineage,snapshot,execution,owner:externalExecutionOwner,oracle:external});
        engine.store.put(ADAPTIVE_V3_EXTERNAL_EXECUTION_RECORD_TYPE,mission.id,
          {signed:engine.authority.seal(ADAPTIVE_V3_EXTERNAL_EXECUTION_KIND,receipt)},{expectedVersion:0});
      }else external=gradeRouteContent(spec,report.final?.payload.body,{sources:sourceRows});
      write('external-oracle.json',external);
      adaptiveV3BeforeReentry=auditAdaptiveV3(report);
      const beforeRecords=routeMaterialState(engine.store);
      const before={material:sha256(beforeRecords),journal:engine.store.verifyJournal(),calls:calls.length,
        snapshot:spec.family==='development'?engine.broker.executionSnapshot(mission.id).hash:null};
      let journalDelta=null,restart=null;
      reentering=true;
      if(adaptiveV3Planned){
        // This cannot be a second invocation against the same mutable engine:
        // close A before creating B against the exact persisted database and
        // workspace. Reference checks assert a fresh JS instance during this
        // test; the durable journal independently constrains its side effects.
        const guards={phase:'reentry',blocked:[],workspaceReads:[],reentrySnapshots:0,postCheckSnapshots:0};
        const initialEngine=engine;
        initialEngine.close();
        engine=makeReadOnlyReentryEngine({missionId:mission.id,guards});
        restart={mode:'fresh-engine-validation-only-v1',initialEngineClosed:true,
          freshInstance:engine!==initialEngine,freshStore:engine.store!==initialEngine.store,freshLedger:engine.ledger!==initialEngine.ledger,
          freshBroker:engine.broker!==initialEngine.broker,brokerReadOnlyFacade:Object.isFrozen(engine.broker),
          existingStoreOnly:true,existingAuthorityOnly:true,existingWorkspaceRootOnly:true,
          sourceTransportClassification:engine.broker.sourceTransport.classification,
          sourceNetwork:engine.broker.sourceTransport.network,executionRunnerPresent:Object.hasOwn(engine.broker,'executionRunner'),guards};
        boundary(restart.freshInstance&&restart.freshStore&&restart.freshLedger&&restart.freshBroker
          &&restart.brokerReadOnlyFacade&&restart.sourceTransportClassification==='UNAVAILABLE'&&restart.sourceNetwork==='DISABLED'
          &&!restart.executionRunnerPresent,
        'Adaptive-v3 re-entry must use a fresh capability-reduced validation-only facade');
        await engine.run(mission.id,{signal,pauseOnAbort:true,validationOnly:true});
        journalDelta=auditRouteReentryJournal({store:engine.store,registry:engine.registry,missionId:mission.id,
          reviewerRunId:lineage[0].reviewerRunId,beforeJournal:before.journal});
        boundary(guards.blocked.length===0&&guards.workspaceReads.length===journalDelta.readLeases.length
          &&canonical(guards.workspaceReads.map(row=>row.tool))===canonical(journalDelta.readLeases.map(row=>row.action))
          &&guards.reentrySnapshots===journalDelta.validation.executionCount,
        'Adaptive-v3 re-entry used an unapproved capability or its actual observation trace diverged from the signed journal');
      }else await engine.run(mission.id,{signal,pauseOnAbort:true});
      if(restart)restart.guards.phase='postcheck';
      const after={material:sha256(routeMaterialState(engine.store)),journal:engine.store.verifyJournal(),calls:calls.length,
        snapshot:spec.family==='development'?engine.broker.executionSnapshot(mission.id).hash:null};
      const material=compareRouteMaterial(beforeRecords,routeMaterialState(engine.store),engine.registry,
        {missionId:mission.id,reviewerRunId:lineage[0].reviewerRunId});
      noReplay=material.unchangedExceptScopedReads&&before.calls===after.calls&&before.snapshot===after.snapshot
        &&(!adaptiveV3Planned||Boolean(journalDelta&&restart&&restart.guards.blocked.length===0));
      write('reentry.json',{before,after,noReplay,material,...(journalDelta?{journal:journalDelta}:{}),...(restart?{restart}:{}),
        allowedNewRecords:['engine','workspace-validation','scoped reviewer read lease'],
        scope:'Fresh adaptive-v3 re-entry is validation-only. Any provider, effect, recovery, learning or non-snapshot state transition is a failure, not a replay pass.'});
      adaptiveV3AfterReentry=auditAdaptiveV3(missionReport(engine.store,mission.id,{registry:engine.registry}));
    }
  }catch(error){fatal={code:error.code??'UNKNOWN',...(error.code==='REENTRY_FORBIDDEN'&&typeof error.details?.surface==='string'
    ?{surface:error.details.surface}:{})};errors.push(fatal);write('failure.json',{at:new Date().toISOString(),fatal});}
  try{
    const report=missionReport(engine.store,mission.id,{registry:engine.registry});write('final-report.json',report);
    const entry=report.entry,checks={noFatal:!fatal,delivered:report.mission.status==='COMPLETED',
      externalOracle:external?.passed===true,completeLineage:lineage.length>0,noReplay,frozen:frozen(),
      routing:adaptiveV3Planned?Boolean(report.plan&&!entry&&adaptiveV3BeforeReentry?.passed&&adaptiveV3AfterReentry?.passed)
        :spec.family==='transformation'&&mode==='adaptive'?entry?.status==='ACCEPTED'&&!report.plan
        :!!report.plan&&(mode==='planned'?!entry:entry?.status==='FALLBACK'),
      adaptiveV3:!adaptiveV3Planned||Boolean(adaptiveV3Initial?.passed&&adaptiveV3BeforeReentry?.passed&&adaptiveV3AfterReentry?.passed),
      scopedEffects:report.effects.every(e=>spec.allowedTools.includes(e.tool))&&report.effects.every(e=>!['DISPATCHED','UNCERTAIN'].includes(e.state)),
      sources:spec.family==='sources'?['sqlite','postgresql'].every(name=>sourceRows.some(s=>sourceUrlMatches(name,s.url))):sourceRows.length===0,
      fullCallAccounting:report.metrics.dispatched===calls.length&&report.metrics.withoutFinalOutcome===0};
    const structuralPassed=Object.values(checks).every(Boolean);
    const actualSubscription=!adaptiveV3Planned&&simulation===false&&calls.length>0&&calls.every(c=>c.receipt?.simulation===false)
      &&report.metrics.simulatedCompleted===0&&report.metrics.unclassifiedCompleted===0;
    const result={completedAt:new Date().toISOString(),caseId:spec.id,mode,missionId:mission.id,missionStatus:report.mission.status,
      startedAt,checks,structuralPassed,actualSubscription,passed:structuralPassed&&actualSubscription,fatal,errors,calls,external,
      entryStatus:entry?.status??null,firstEntryDecision:entry?.response?.action??null,metrics:report.metrics,
      adaptiveV3:{initial:adaptiveV3Initial,beforeReentry:adaptiveV3BeforeReentry,afterReentry:adaptiveV3AfterReentry,
        ...(adaptiveV3Planned?{ciOnly:true,subscriptionQualification:false}:{} )},
      journal:engine.store.verifyJournal(),semanticAudit:'PENDING',simulation,
      scope:'One operator-authored case/arm; corpus and comparison scope belong to the enclosing qualification. Not general accuracy or full factory acceptance. Raw calls include rejected receipts; missing usage is unknown.'};
    write('result.json',result);return result;
  }finally{engine.close();}
}
