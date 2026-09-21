// Diagnostic harness, NOT a production provider. Upstream plan/approval are
// deliberately simulated. Only the supplied product reviewer can call a model.
import * as fs from 'node:fs';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {canonical,sha256,id} from '../../factory/lib/contracts.mjs';
import {judgeNativeSelectionReview} from './native-selection-review-cases.mjs';
import {independentlySelectedBody} from './native-input-trial-acceptance.mjs';

export const selectionReviewPolicy=Object.freeze({preset:'adaptive-v1',entryMode:'planned',contextEncoding:'source-text-v1',
  reviewEncoding:'evidence-catalog-v1',model:'gpt-6-astra',reasoningEffort:'ultra',allowedTools:[],maxParallelPureNodes:1,
  cardEncoding:'compact-json-v1',producerContext:'node-contract-v1',maxPlanAttempts:1,maxNodeAttempts:1});
const boundary=message=>Object.assign(Error(message),{code:'EXPERIMENT_BOUNDARY'});
const requireBoundary=(condition,message)=>{if(!condition)throw boundary(message);};
export const writeDiagnostic=(directory,name,value)=>fs.writeFileSync(join(directory,name),JSON.stringify(value,null,2),{flag:'wx',mode:0o600});

export async function runNativeSelectionCase({runtimeRoot,directory,fixture,reviewProviderFactory,frozen=()=>true,
  reviewSimulation=false,signal,onEvent}){
  requireBoundary(fs.readdirSync(directory).length===0,'New empty case directory required');
  const module=path=>import(pathToFileURL(join(runtimeRoot,path)));
  const {FactoryEngine}=await module('factory/lib/engine.mjs');
  const {readSourceContextView}=await module('factory/lib/source-context-view.mjs');
  const {compactCatalogReview}=await module('factory/lib/review-codec.mjs');
  const {inferenceRequestHash}=await module('factory/providers/instruction-profiles.mjs');
  const {inputCopyEvidence}=await module('factory/lib/input-copy.mjs');
  const engine=new FactoryEngine({databasePath:join(directory,'state.sqlite'),workspaceRoot:join(directory,'workspaces'),onEvent});
  const write=(name,value)=>writeDiagnostic(directory,name,value),captures=[],responses=[];
  let simulatedCalls=0,reviewCalls=0,dispatchFailure=null;
  const mission=engine.create(fixture.request,structuredClone(selectionReviewPolicy));
  write('qualification.json',{startedAt:new Date().toISOString(),missionId:mission.id,fixture,policy:selectionReviewPolicy,reviewSimulation,
    scope:'Operator-authored plan and deliberately simulated plan approval; native execution/origin and product review use the real engine. Fixture oracle is local only. One product inference, no repairs; no installation or general calibration claim.'});
  engine.workers.maxReviewRepairs=0;
  engine.workers.providerFactory=()=>{
    let provider;
    return {async generate(input){
      try{
        requireBoundary(frozen()&&!signal?.aborted,'Frozen input or interruption boundary');
        const sent={instructions:input.instructions,input:input.input,schema:input.schema,model:input.model,reasoningEffort:input.reasoningEffort,
          ...(input.instructionProfile?{instructionProfile:input.instructionProfile}:{})};
        const requestHash=inferenceRequestHash(sent),pending=engine.store.list('run').filter(r=>r.data.expectedRequestHash===requestHash);
        requireBoundary(pending.length===1,'One exact actor must own this inference request');
        const actor=pending[0].data,exposure=readSourceContextView(input.input),task=JSON.parse(exposure.task);
        requireBoundary(input.input.startsWith('SOVEREIGN_SOURCE_CONTEXT_VIEW_V1\n')&&exposure.missionIntent===fixture.request,'Complete admitted immutable source required');
        const candidate=actor.mode==='reviewer'?exposure.artifacts.find(a=>a.id===task.candidateId):null;
        const phase=actor.mode==='producer'&&actor.nodeId==='planning'?'simulated-plan'
          :actor.mode==='reviewer'&&actor.nodeId==='review:planning'&&candidate?.payload.kind==='mission-plan'?'simulated-plan-review'
          :actor.mode==='reviewer'&&actor.nodeId==='review:literal'&&candidate?.payload.kind==='literal-input-copy'?'product-review':null;
        requireBoundary(phase,'Unexpected model-producing path');
        const capture={at:new Date().toISOString(),index:captures.length,phase,runId:actor.id,requestHash,request:sent};
        write(`request-${capture.index}.json`,capture);captures.push(capture);
        let response;
        if(phase.startsWith('simulated-')){
          requireBoundary(simulatedCalls<2&&phase===(simulatedCalls===0?'simulated-plan':'simulated-plan-review'),'Exactly one fixture proposal and one fixture approval');
          simulatedCalls++;
          const value=phase==='simulated-plan'?structuredClone(fixture.plan):compactCatalogReview({artifactHash:candidate.hash,purpose:candidate.payload.purpose,decision:'ACCEPT',
            checks:task.criteria.map(c=>({criterionId:c.id,verdict:'PASS',reason:'SIMULATED upstream approval fixture; deliberately not semantic qualification of the selector.',
              evidence:[{kind:'artifact',id:candidate.id,hash:candidate.hash,quote:candidate.payload.body}]})),findings:[],
            uncertainty:'SIMULATED operator-authored upstream approval. This historical acceptance is not proof of correct selection; product acceptance remains independent.'},task.observedEvidenceCatalog);
          response={value,receipt:{kind:'inference',simulation:true,status:'completed',threadId:id('simulated-selection-fixture'),turnId:'fixture',
            model:input.model,reasoningEffort:input.reasoningEffort,contextHash:requestHash,scope:'NO MODEL CALL; operator fixture, not semantic evidence'}};
        }else{
          requireBoundary(simulatedCalls===2&&reviewCalls===0,'One product inference after both simulated upstream stages');
          requireBoundary(!Object.hasOwn(task,'expected')&&!Object.hasOwn(task,'oracleReason')&&!input.input.includes(fixture.oracleReason)
            &&!input.input.includes(fixture.id)&&!input.input.includes(fixture.scenarioId),'Oracle labels must not reach the product reviewer');
          requireBoundary(exposure.runtimeObservations.some(o=>o.kind==='artifact-input-copy'),'Authenticated native evidence must precede review');
          reviewCalls++;
          provider=reviewProviderFactory();
          // Preserve structured output and receipt BEFORE the unchanged worker
          // validator runs. Provider JSON/isolation/transport checks remain active.
          response=await provider.generate({...input,validate:async()=>true});
        }
        write(`response-${capture.index}.json`,response);responses.push({index:capture.index,phase,receipt:response.receipt});
        requireBoundary(response.receipt?.status==='completed'&&response.receipt.simulation===(phase==='product-review'?reviewSimulation:true)
          &&response.receipt.contextHash===requestHash&&response.receipt.model===input.model&&response.receipt.reasoningEffort===input.reasoningEffort,'Exact receipt and simulation classification required');
        await input.validate(response.value);
        return response;
      }catch(error){dispatchFailure??={code:error.code??'UNKNOWN',at:new Date().toISOString()};throw error;}
    },async close(){if(provider)await provider.close();}};
  };
  engine.blind.providerFactory=engine.workers.providerFactory;
  try{
    await engine.run(mission.id,{signal,pauseOnAbort:true});
    const report=engine.report(mission.id);write('report.json',report);
    const native=engine.store.list('artifact').filter(r=>r.data.payload.kind==='literal-input-copy');
    const candidate=native.length===1?native[0].data:null;
    const review=report.reviews.find(r=>r.artifactId===candidate?.id)??null;
    const proof=candidate?inputCopyEvidence(engine.registry,candidate.id):null;
    if(proof)write('native-origin-proof.json',proof);
    const selected=independentlySelectedBody(fixture.request,fixture.plan.nodes[0].execution);
    const material=()=>engine.store.db.prepare("SELECT type,id,version,hash FROM records WHERE type NOT IN ('engine','mission','workspace-validation') ORDER BY type,id,version").all().map(r=>({...r}));
    const before=engine.store.verifyJournal(),beforeMaterial=material(),beforeMission=engine.store.get('mission',mission.id),countBefore=captures.length;
    // A valid but wrong semantic verdict is retained, not retried. Exceptions,
    // invalid citations and incomplete reviews cannot trigger reentry or next case.
    if(review&&!dispatchFailure&&!signal?.aborted)await engine.run(mission.id,{signal,pauseOnAbort:true});
    const after=engine.report(mission.id),events=engine.store.events({after:before.events,limit:1000});
    const validations=events.filter(e=>e.kind==='workspace.validation').map(e=>engine.store.get('workspace-validation',e.data.validationId));
    const validated=validations.map(r=>engine.authority.open(r.data.signed,'workspace.validation'));
    const allowedEvents=events.every(e=>e.kind==='record.committed'&&['engine','mission','workspace-validation'].includes(e.data.type)
      ||e.kind==='workspace.validation'||e.kind==='mission.status'&&e.data.missionId===mission.id);
    const durableMandate=m=>{const {status,pending,history,updatedAt,...stable}=m;return stable;};
    const negativeReentry=events.length===6&&canonical(events.map(e=>[e.kind,e.data.type??null]))===canonical([
      ['record.committed','engine'],['record.committed','mission'],['mission.status',null],
      ['record.committed','mission'],['mission.status',null],['record.committed','engine']])
      &&canonical(events.filter(e=>e.kind==='mission.status').map(e=>e.data.status))===canonical(['RUNNING','NEEDS_DIRECTION'])
      &&engine.store.get('mission',mission.id).version===beforeMission.version+2
      &&canonical(durableMandate(after.mission))===canonical(durableMandate(report.mission));
    const noReplay=!!review&&captures.length===countBefore&&canonical(material())===canonical(beforeMaterial)
      &&after.mission.status===report.mission.status&&after.mission.finalArtifactId===report.mission.finalArtifactId&&allowedEvents
      &&(report.mission.status==='COMPLETED'?events.length===4&&validations.length===1&&engine.store.get('mission',mission.id).hash===beforeMission.hash
        &&validated.every(v=>v.artifactId===candidate.id&&v.artifactHash===candidate.payloadHash&&v.status==='UNCHANGED'
          &&v.files.length===0&&v.executions.length===0&&!(v.listings?.length)&&v.principalId===review.reviewerRunId)
        :report.mission.status==='NEEDS_DIRECTION'&&validations.length===0&&negativeReentry);
    write('reentry.json',{before,after:engine.store.verifyJournal(),beforeMaterialHash:sha256(beforeMaterial),afterMaterialHash:sha256(material()),
      beforeMission,afterMission:engine.store.get('mission',mission.id),events,validations,noReplay,
      scope:'No new origins/products/reviews/inferences. Completed reentry permits four lock/empty-validation events; rejected reentry may record coordinator/mission status only.'});
    const productResponse=responses.find(r=>r.phase==='product-review');
    const checks={...judgeNativeSelectionReview(review?.result,fixture),
      oneNativeOrigin:engine.store.list('input-copy-origin').length===1&&!!proof&&proof.selection.body===selected&&candidate?.payload.body===selected,
      selectionOracle:(selected===fixture.expected.body)===(fixture.expected.decision==='ACCEPT'),
      payloadIntegrity:!!candidate&&sha256(candidate.payload)===candidate.payloadHash,
      allCriteria:!!review&&canonical(review.result.checks.map(c=>c.criterionId).sort())===canonical(candidate.payload.criteria.map(c=>c.id).sort()),
      simulatedUpstream:simulatedCalls===2&&report.metrics.simulatedCompleted===(reviewSimulation?3:2),
      oneProductInference:reviewCalls===1&&!!productResponse&&report.metrics.liveCompleted===(reviewSimulation?0:1)
        &&report.metrics.dispatched===3&&report.metrics.completed===3&&report.metrics.failed===0,
      distinctJudge:!!review&&report.reviews.length===2&&report.reviews.every(r=>r===review||r.reviewerRunId!==review.reviewerRunId),
      expectedTerminal:fixture.expected.decision==='ACCEPT'?report.mission.status==='COMPLETED'&&report.final?.id===candidate?.id
        &&review?.result.checks.every(c=>c.verdict==='PASS'):report.mission.status==='NEEDS_DIRECTION'&&!report.final
          &&candidate?.status==='RETURNED'&&review?.result.findings.some(f=>f.severity==='material'),
      noEffects:report.effects.length===0&&!!candidate&&candidate.payload.claims.length===0&&candidate.payload.toolReceipts.length===0,
      noReplay,frozen:frozen()};
    const integrityKeys=['oneNativeOrigin','selectionOracle','payloadIntegrity','allCriteria','simulatedUpstream','oneProductInference','distinctJudge','noEffects','noReplay','frozen'];
    const fatal=dispatchFailure??(!review?{code:'NO_COMMITTED_PRODUCT_REVIEW',at:new Date().toISOString()}
      :integrityKeys.some(k=>checks[k]!==true)?{code:'EXPERIMENT_INTEGRITY',failedChecks:integrityKeys.filter(k=>checks[k]!==true),at:new Date().toISOString()}:null);
    const result={caseId:fixture.id,completedAt:new Date().toISOString(),missionId:mission.id,status:report.mission.status,
      candidateId:candidate?.id??null,candidateHash:candidate?.payloadHash??null,checks,passed:!fatal&&Object.values(checks).every(v=>v===true),fatal,
      review,productReceipt:productResponse?.receipt??null,metrics:report.metrics,journal:engine.store.verifyJournal(),semanticAudit:'PENDING'};
    write('result.json',result);return result;
  }catch(error){write('failure.json',{at:new Date().toISOString(),code:error.code??'UNKNOWN',simulatedCalls,reviewCalls,dispatchFailure});throw error;}
  finally{engine.close();}
}
