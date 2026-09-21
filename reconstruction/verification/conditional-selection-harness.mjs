import * as fs from 'node:fs';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {canonical,sha256,id} from '../../factory/lib/contracts.mjs';
import {conditionalSelectionCriteria,judgeConditionalSelection} from './conditional-selection-cases.mjs';

export const conditionalSelectionPolicy=Object.freeze({preset:'adaptive-v1',entryMode:'planned',allowedTools:[],
  model:'gpt-6-astra',reasoningEffort:'ultra',contextEncoding:'source-text-v1',reviewEncoding:'expanded-json',
  cardEncoding:'compact-json-v1',producerContext:'node-contract-v1',maxParallelPureNodes:1,maxPlanAttempts:1,maxNodeAttempts:1});
export const writeConditionalDiagnostic=(directory,name,value)=>fs.writeFileSync(join(directory,name),JSON.stringify(value,null,2),{flag:'wx',mode:0o600});
const boundary=(condition,message)=>{if(!condition)throw Object.assign(Error(message),{code:'EXPERIMENT_BOUNDARY'});};

export async function runConditionalSelectionCase({runtimeRoot,directory,fixture,assessmentProviderFactory,
  assessmentSimulation=false,frozen=()=>true,signal,onEvent}){
  boundary(fs.readdirSync(directory).length===0,'Fresh empty case directory required');
  const module=path=>import(pathToFileURL(join(runtimeRoot,path)));
  const {FactoryEngine}=await module('factory/lib/engine.mjs'),{ConditionalAssessmentService}=await module('factory/lib/conditional-assessment.mjs');
  const {registerInputCopyRun,materializeInputCopy,inputCopyEvidence}=await module('factory/lib/input-copy.mjs');
  const {readSourceContextView}=await module('factory/lib/source-context-view.mjs');
  const {inferenceRequestHash}=await module('factory/providers/instruction-profiles.mjs');
  const engine=new FactoryEngine({databasePath:join(directory,'state.sqlite'),workspaceRoot:join(directory,'workspace'),onEvent});
  const write=(name,value)=>writeConditionalDiagnostic(directory,name,value);let calls=0,simulatedCalls=0,assessmentCalls=0,candidate=null,contract=null;
  const mission=engine.create(fixture.request,structuredClone(conditionalSelectionPolicy));
  write('qualification.json',{startedAt:new Date().toISOString(),missionId:mission.id,fixture,criteria:conditionalSelectionCriteria,
    policy:conditionalSelectionPolicy,assessmentSimulation,scope:'Two simulated prior stages, native copy, then one conditional diagnostic inference. No product acceptance or operational mission completion.'});
  engine.workers.providerFactory=()=>{let provider;return {async generate(input){
    boundary(frozen()&&!signal?.aborted,'Frozen or interruption boundary');
    const request={instructions:input.instructions,input:input.input,schema:input.schema,model:input.model,reasoningEffort:input.reasoningEffort,
      ...(input.instructionProfile?{instructionProfile:input.instructionProfile}:{})};
    const requestHash=inferenceRequestHash(request),actors=engine.store.list('run').filter(r=>r.data.expectedRequestHash===requestHash);
    boundary(actors.length===1,'Exactly one pending actor required');
    const actor=actors[0].data,exposure=readSourceContextView(input.input),task=JSON.parse(exposure.task);
    boundary(exposure.missionIntent===fixture.request,'Complete immutable request required');
    const phase=actor.nodeId==='planning'&&actor.mode==='producer'?'simulated-plan'
      :actor.nodeId==='review:planning'&&actor.mode==='reviewer'?'simulated-plan-review'
      :actor.id===contract?.runId&&task.kind==='CONDITIONAL_DIAGNOSTIC'?'conditional-assessment':null;
    boundary(phase,'Unexpected inference path');const index=calls++;
    write(`request-${index}.json`,{at:new Date().toISOString(),phase,runId:actor.id,requestHash,request});
    let response;
    if(phase.startsWith('simulated-')){
      boundary(simulatedCalls<2&&phase===(simulatedCalls===0?'simulated-plan':'simulated-plan-review'),'Exactly two fixture upstream stages');simulatedCalls++;
      const a=exposure.artifacts.find(a=>a.id===task.candidateId);
      const value=phase==='simulated-plan'?structuredClone(fixture.plan):{artifactHash:a.hash,purpose:a.payload.purpose,decision:'ACCEPT',
        checks:task.criteria.map(c=>({criterionId:c.id,verdict:'PASS',reason:'SIMULATED operator fixture checkpoint, not semantic or real-workflow qualification.',
          evidence:[{kind:'artifact',id:a.id,hash:a.hash,quote:a.payload.body}]})),findings:[],uncertainty:'Simulated upstream approval.'};
      response={value,receipt:{status:'completed',simulation:true,threadId:id('simulated-conditional-fixture'),turnId:'fixture',
        model:input.model,reasoningEffort:input.reasoningEffort,contextHash:requestHash}};
    }else{
      boundary(simulatedCalls===2&&assessmentCalls===0&&!Object.hasOwn(task,'expected')&&!Object.hasOwn(input.schema.properties,'decision'),
        'One assessment without operational decision or oracle fields');
      boundary(exposure.runtimeObservations.some(o=>o.kind==='artifact-input-copy')&&exposure.runtimeObservations.some(o=>o.kind==='artifact-dependency-inferences'),
        'Native origin and structured prerequisite provenance must be exposed');
      assessmentCalls++;provider=assessmentProviderFactory();response=await provider.generate({...input,validate:async()=>true});
    }
    write(`response-${index}.json`,response);
    boundary(response.receipt?.status==='completed'&&response.receipt.simulation===(phase==='conditional-assessment'?assessmentSimulation:true)
      &&response.receipt.contextHash===requestHash&&response.receipt.model===input.model&&response.receipt.reasoningEffort===input.reasoningEffort,
    'Exact request and receipt classification required');
    await input.validate(response.value);return response;
  },async close(){if(provider)await provider.close();}};};
  const material=()=>engine.store.db.prepare("SELECT type,id,version,hash FROM records WHERE type IN ('artifact','review','input-copy-origin','mission','plan','node','effect') ORDER BY type,id,version").all().map(r=>({...r}));
  try{
    const ownerId=id('diagnostic-fixture-owner');engine.ledger.acquireEngine({ownerId});
    try{await engine.plan(mission,signal);}finally{engine.ledger.releaseEngine(ownerId);}
    const node=engine.store.get('plan',mission.id).data.plan.nodes[0],producer=registerInputCopyRun(engine.registry,mission.id,node);
    candidate=materializeInputCopy(engine.registry,producer.id);const native=inputCopyEvidence(engine.registry,candidate.id);
    write('native-origin-proof.json',native);
    const beforeMaterial=material(),service=new ConditionalAssessmentService(engine.workers);
    contract=service.prepare({artifactId:candidate.id,reviewerRoleIds:['omega_22'],criteria:conditionalSelectionCriteria});write('assessment-contract.json',contract);
    const assessment=await service.execute(contract.runId,{signal});write('assessment-result.json',assessment);
    const before=engine.store.verifyJournal(),again=await service.execute(contract.runId),after=engine.store.verifyJournal();
    const noReplay=canonical(before)===canonical(after)&&canonical(again)===canonical(assessment)&&calls===3;
    write('reentry.json',{before,after,noReplay,beforeMaterialHash:sha256(beforeMaterial),afterMaterialHash:sha256(material())});
    const report=engine.report(mission.id);write('report.json',report);
    const checks={...judgeConditionalSelection(assessment,fixture),nativeOrigin:sha256(candidate.payload.body)===fixture.expected.selectedBodyHash
      &&canonical(inputCopyEvidence(engine.registry,candidate.id))===canonical(native),
      materialUnchanged:canonical(beforeMaterial)===canonical(material()),noOperationalAcceptance:engine.store.get('artifact',candidate.id).data.status==='CANDIDATE'
        &&engine.store.list('review').length===1&&!engine.store.get('mission',mission.id).data.finalArtifactId&&engine.store.get('mission',mission.id).data.status!=='COMPLETED',
      oneAssessment:assessmentCalls===1&&simulatedCalls===2&&report.metrics.dispatched===3&&report.metrics.completed===3,
      noEffects:engine.store.list('effect').length===0,noReplay,frozen:frozen()};
    const broken=Object.keys(checks).filter(k=>!['selection','fidelity'].includes(k)&&checks[k]!==true);
    const fatal=broken.length?{code:'EXPERIMENT_INTEGRITY',checks:broken}:null;
    const result={caseId:fixture.id,completedAt:new Date().toISOString(),missionId:mission.id,candidateId:candidate.id,candidateHash:candidate.payloadHash,
      assessmentRunId:contract.runId,assessment,checks,metrics:report.metrics,journal:after,passed:!fatal&&Object.values(checks).every(v=>v===true),fatal,semanticAudit:'PENDING'};
    write('result.json',result);return result;
  }catch(error){
    const result={caseId:fixture.id,completedAt:new Date().toISOString(),missionId:mission.id,candidateId:candidate?.id??null,
      assessmentRunId:contract?.runId??null,calls,simulatedCalls,assessmentCalls,passed:false,fatal:{code:error.code??'UNKNOWN'},journal:engine.store.verifyJournal()};
    write('failure.json',result);return result;
  }finally{engine.close();}
}
