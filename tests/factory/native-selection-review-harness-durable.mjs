// Test-only durable variant of the historical selection-review diagnostic.
//
// The production-facing mission report deliberately withholds review rows,
// actor identities and operational telemetry.  This harness needs those facts
// to prove its own simulated call discipline, so it obtains them exclusively
// from the Store and the Engine-owned ArtifactRegistry.  It must never turn
// this private diagnostic view into a reason to expand the public report.
import * as fs from 'node:fs';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {canonical,sha256,id} from '../../factory/lib/contracts.mjs';
import {judgeNativeSelectionReview} from '../../reconstruction/verification/native-selection-review-cases.mjs';
import {independentlySelectedBody} from '../../reconstruction/verification/native-input-trial-acceptance.mjs';
import {selectionReviewPolicy} from '../../reconstruction/verification/native-selection-review-harness.mjs';

const boundary=message=>Object.assign(Error(message),{code:'EXPERIMENT_BOUNDARY'});
const requireBoundary=(condition,message)=>{if(!condition)throw boundary(message);};

export const writeDiagnostic=(directory,name,value)=>fs.writeFileSync(join(directory,name),JSON.stringify(value,null,2),{flag:'wx',mode:0o600});

function durableMission(engine,missionId){
  const record=engine.store.get('mission',missionId);
  requireBoundary(record?.data?.id===missionId,'Mission durable record is missing or has a mismatched identity');
  return record.data;
}

function durableCandidate(engine,missionId){
  const records=engine.store.list('artifact').filter(record=>record.data.missionId===missionId
    &&record.data.payload?.kind==='literal-input-copy');
  // A frozen boundary can stop before deterministic native materialization.
  // Absence is therefore an observed failed diagnostic condition, not a
  // harness exception; multiple candidates are still an integrity failure.
  if(records.length===0)return null;
  requireBoundary(records.length===1,'Exactly one durable native input-copy candidate is required');
  const candidate=records[0].data;
  requireBoundary(candidate.id===records[0].id&&candidate.payloadHash===sha256(candidate.payload),
    'Native candidate identity or payload hash changed');
  return candidate;
}

function durableProductReview(engine,candidate){
  if(!candidate)return null;
  const reviewId=candidate.reviews?.at(-1);
  if(typeof reviewId!=='string')return null;
  const record=engine.store.get('review',reviewId),review=record?.data;
  const reviewer=review&&engine.store.get('run',review.reviewerRunId)?.data;
  if(!review||review.id!==reviewId||review.artifactId!==candidate.id
    ||review.result?.artifactHash!==candidate.payloadHash||review.result?.purpose!==candidate.payload.purpose
    ||reviewer?.id!==review.reviewerRunId||reviewer.missionId!==candidate.missionId||reviewer.mode!=='reviewer')return null;
  return review;
}

function durableMissionReviews(engine,missionId){
  return engine.store.list('review').map(record=>record.data).filter(review=>{
    const artifact=engine.store.get('artifact',review.artifactId)?.data;
    return artifact?.missionId===missionId&&artifact.id===review.artifactId;
  });
}

function durableInferenceMetrics(engine,missionId){
  const runs=engine.store.list('run').map(record=>record.data).filter(run=>run.missionId===missionId);
  const completed=runs.filter(run=>['completed','COMPLETED'].includes(run.inferenceReceipt?.status));
  return {
    integrity:'TEST_PRIVATE_DURABLE',
    scope:'Test-only aggregation of durable run receipts and retained requests; not a public telemetry attestation.',
    simulatedCompleted:completed.filter(run=>run.inferenceReceipt.simulation===true).length,
    liveCompleted:completed.filter(run=>run.inferenceReceipt.simulation===false).length,
    dispatched:runs.reduce((total,run)=>total+(run.requests?.length??0),0),
    completed:completed.length,
    failed:runs.filter(run=>(run.requests?.length??0)>0&&!run.inferenceReceipt&&!run.expectedRequestHash).length,
  };
}

export async function runNativeSelectionCaseDurably({runtimeRoot,directory,fixture,reviewProviderFactory,frozen=()=>true,
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
        const requestHash=inferenceRequestHash(sent),pending=engine.store.list('run').filter(record=>record.data.expectedRequestHash===requestHash);
        requireBoundary(pending.length===1,'One exact actor must own this inference request');
        const actor=pending[0].data,exposure=readSourceContextView(input.input),task=JSON.parse(exposure.task);
        requireBoundary(input.input.startsWith('SOVEREIGN_SOURCE_CONTEXT_VIEW_V1\n')&&exposure.missionIntent===fixture.request,'Complete admitted immutable source required');
        const candidate=actor.mode==='reviewer'?exposure.artifacts.find(artifact=>artifact.id===task.candidateId):null;
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
            checks:task.criteria.map(criterion=>({criterionId:criterion.id,verdict:'PASS',reason:'SIMULATED upstream approval fixture; deliberately not semantic qualification of the selector.',
              evidence:[{kind:'artifact',id:candidate.id,hash:candidate.hash,quote:candidate.payload.body}]})),findings:[],
            uncertainty:'SIMULATED operator-authored upstream approval. This historical acceptance is not proof of correct selection; product acceptance remains independent.'},task.observedEvidenceCatalog);
          response={value,receipt:{kind:'inference',simulation:true,status:'completed',threadId:id('simulated-selection-fixture'),turnId:'fixture',
            model:input.model,reasoningEffort:input.reasoningEffort,contextHash:requestHash,scope:'NO MODEL CALL; operator fixture, not semantic evidence'}};
        }else{
          requireBoundary(simulatedCalls===2&&reviewCalls===0,'One product inference after both simulated upstream stages');
          requireBoundary(!Object.hasOwn(task,'expected')&&!Object.hasOwn(task,'oracleReason')&&!input.input.includes(fixture.oracleReason)
            &&!input.input.includes(fixture.id)&&!input.input.includes(fixture.scenarioId),'Oracle labels must not reach the product reviewer');
          requireBoundary(exposure.runtimeObservations.some(observation=>observation.kind==='artifact-input-copy'),'Authenticated native evidence must precede review');
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
    // Keep the actual public projection as a diagnostic artifact, but do not
    // use its intentionally redacted fields as an internal control surface.
    const publicReport=engine.report(mission.id);write('report.json',publicReport);
    const candidate=durableCandidate(engine,mission.id);
    const review=durableProductReview(engine,candidate);
    const proof=candidate?inputCopyEvidence(engine.registry,candidate.id):null;
    if(proof)write('native-origin-proof.json',proof);
    const selected=independentlySelectedBody(fixture.request,fixture.plan.nodes[0].execution);
    // Lifecycle receipts are observer records, not a new candidate, review,
    // source, inference or effect.  A rejected re-entry legitimately emits
    // signed public receipts for its RUNNING → NEEDS_DIRECTION transitions;
    // keep those receipts under an explicit shape/count check below while the
    // material comparison remains scoped to execution-bearing records.
    const traceRecordTypes=['sublimine-public-mission-trace','sublimine-public-mission-trace-head'];
    const nonMaterialTypes=['engine','mission','workspace-validation',...traceRecordTypes];
    const material=()=>engine.store.db.prepare(`SELECT type,id,version,hash FROM records WHERE type NOT IN (${nonMaterialTypes.map(type=>`'${type}'`).join(',')}) ORDER BY type,id,version`).all().map(row=>({...row}));
    const before=engine.store.verifyJournal(),beforeMaterial=material(),beforeMission=engine.store.get('mission',mission.id),countBefore=captures.length;
    // A valid but wrong semantic verdict is retained, not retried. Exceptions,
    // invalid citations and incomplete reviews cannot trigger reentry or next case.
    if(review&&!dispatchFailure&&!signal?.aborted)await engine.run(mission.id,{signal,pauseOnAbort:true});
    const afterPublic=engine.report(mission.id),afterMission=durableMission(engine,mission.id),events=engine.store.events({after:before.events,limit:1000});
    const validations=events.filter(event=>event.kind==='workspace.validation').map(event=>engine.store.get('workspace-validation',event.data.validationId));
    const validated=validations.map(record=>engine.authority.open(record.data.signed,'workspace.validation'));
    const allowedEvents=events.every(event=>event.kind==='record.committed'&&['engine','mission','workspace-validation',...traceRecordTypes].includes(event.data.type)
      ||event.kind==='workspace.validation'||event.kind==='mission.status'&&event.data.missionId===mission.id);
    const durableMandate=stored=>{const {status,pending,history,updatedAt,...stable}=stored;return stable;};
    // Each emitted public status is atomically paired with exactly one signed
    // trace receipt and one moving trace head.  They prove visibility without
    // reopening execution; accepting an arbitrary extra record here would
    // weaken the no-replay claim.
    const negativeReentry=events.length===10&&canonical(events.map(event=>[event.kind,event.data.type??null]))===canonical([
      ['record.committed','engine'],['record.committed','mission'],['mission.status',null],
      ['record.committed','sublimine-public-mission-trace'],['record.committed','sublimine-public-mission-trace-head'],
      ['record.committed','mission'],['mission.status',null],
      ['record.committed','sublimine-public-mission-trace'],['record.committed','sublimine-public-mission-trace-head'],
      ['record.committed','engine']])
      &&canonical(events.filter(event=>event.kind==='mission.status').map(event=>event.data.status))===canonical(['RUNNING','NEEDS_DIRECTION'])
      &&engine.store.get('mission',mission.id).version===beforeMission.version+2
      &&canonical(durableMandate(afterMission))===canonical(durableMandate(beforeMission.data));
    const noReplay=!!review&&captures.length===countBefore&&canonical(material())===canonical(beforeMaterial)
      &&afterMission.status===beforeMission.data.status&&afterMission.finalArtifactId===beforeMission.data.finalArtifactId&&allowedEvents
      &&(beforeMission.data.status==='COMPLETED'?events.length===4&&validations.length===1&&engine.store.get('mission',mission.id).hash===beforeMission.hash
        &&validated.every(validation=>validation.artifactId===candidate.id&&validation.artifactHash===candidate.payloadHash&&validation.status==='UNCHANGED'
          &&validation.files.length===0&&validation.executions.length===0&&!(validation.listings?.length)&&validation.principalId===review.reviewerRunId)
        :beforeMission.data.status==='NEEDS_DIRECTION'&&validations.length===0&&negativeReentry);
    write('reentry.json',{before,after:engine.store.verifyJournal(),beforeMaterialHash:sha256(beforeMaterial),afterMaterialHash:sha256(material()),
      beforeMission,afterMission:engine.store.get('mission',mission.id),events,validations,noReplay,
      scope:'No new origins/products/reviews/inferences. Completed reentry permits four lock/empty-validation events; rejected reentry may record coordinator/mission status only.'});
    const productResponse=responses.find(response=>response.phase==='product-review');
    const metrics=durableInferenceMetrics(engine,mission.id),missionReviews=durableMissionReviews(engine,mission.id);
    const checks={...judgeNativeSelectionReview(review?.result,fixture),
      oneNativeOrigin:engine.store.list('input-copy-origin').length===1&&!!proof&&proof.selection.body===selected&&candidate?.payload.body===selected,
      selectionOracle:(selected===fixture.expected.body)===(fixture.expected.decision==='ACCEPT'),
      payloadIntegrity:!!candidate&&sha256(candidate.payload)===candidate.payloadHash,
      allCriteria:!!review&&canonical(review.result.checks.map(check=>check.criterionId).sort())===canonical(candidate?.payload.criteria.map(criterion=>criterion.id).sort()),
      simulatedUpstream:simulatedCalls===2&&metrics.simulatedCompleted===(reviewSimulation?3:2),
      oneProductInference:reviewCalls===1&&!!productResponse&&metrics.liveCompleted===(reviewSimulation?0:1)
        &&metrics.dispatched===3&&metrics.completed===3&&metrics.failed===0,
      distinctJudge:!!review&&missionReviews.length===2&&missionReviews.every(other=>other.id===review.id||other.reviewerRunId!==review.reviewerRunId),
      expectedTerminal:fixture.expected.decision==='ACCEPT'?afterMission.status==='COMPLETED'&&afterMission.finalArtifactId===candidate?.id
        &&review?.result.checks.every(check=>check.verdict==='PASS'):afterMission.status==='NEEDS_DIRECTION'&&afterMission.finalArtifactId===null
          &&candidate?.status==='RETURNED'&&review?.result.findings.some(finding=>finding.severity==='material'),
      noEffects:engine.store.list('effect').filter(record=>record.data.missionId===mission.id).length===0
        &&(candidate?.payload.claims.length??0)===0&&(candidate?.payload.toolReceipts.length??0)===0,
      noReplay,frozen:frozen()};
    const integrityKeys=['oneNativeOrigin','selectionOracle','payloadIntegrity','allCriteria','simulatedUpstream','oneProductInference','distinctJudge','noEffects','noReplay','frozen'];
    const fatal=dispatchFailure??(!review?{code:'NO_COMMITTED_PRODUCT_REVIEW',at:new Date().toISOString()}
      :integrityKeys.some(key=>checks[key]!==true)?{code:'EXPERIMENT_INTEGRITY',failedChecks:integrityKeys.filter(key=>checks[key]!==true),at:new Date().toISOString()}:null);
    const result={caseId:fixture.id,completedAt:new Date().toISOString(),missionId:mission.id,status:afterMission.status,
      candidateId:candidate?.id??null,candidateHash:candidate?.payloadHash??null,checks,passed:!fatal&&Object.values(checks).every(value=>value===true),fatal,
      review,productReceipt:productResponse?.receipt??null,metrics,journal:engine.store.verifyJournal(),semanticAudit:'PENDING',
      publicProjection:{metricsIntegrity:afterPublic.metrics?.integrity,reviewsProjected:afterPublic.reviews?.length??null}};
    write('result.json',result);return result;
  }catch(error){write('failure.json',{at:new Date().toISOString(),code:error.code??'UNKNOWN',simulatedCalls,reviewCalls,dispatchFailure});throw error;}
  finally{engine.close();}
}
