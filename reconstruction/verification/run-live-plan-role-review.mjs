// Two REAL WorkerService reviews of explicitly SIMULATED operator plan fixtures.
// Not an end-to-end production benchmark, and not a hidden deployment command.
import * as fs from 'node:fs';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {intent,cases} from './plan-role-review-cases.mjs';
import {canonical,sha256} from '../../factory/lib/contracts.mjs';
import {verifyRuntimeRelease} from '../../factory/lib/runtime-release.mjs';
const [directory,runtimeRoot]=process.argv.slice(2);
if(!directory||!runtimeRoot||fs.readdirSync(directory).length)throw Error('New empty directory and frozen runtime required');
const files=[new URL(import.meta.url),new URL('./plan-role-review-cases.mjs',import.meta.url)],pins=files.map(f=>({path:f.pathname,hash:sha256(fs.readFileSync(f))}));
const release=verifyRuntimeRelease(runtimeRoot),frozen=()=>pins.every(p=>sha256(fs.readFileSync(p.path))===p.hash)&&verifyRuntimeRelease(runtimeRoot).releaseId===release.releaseId;
const module=path=>import(pathToFileURL(join(runtimeRoot,path)));
const {FactoryEngine}=await module('factory/lib/engine.mjs'),{CodexProvider}=await module('factory/providers/codex.mjs');
const {PLAN_SCHEMA,validatePlan}=await module('factory/lib/plans.mjs'),{normalizeFinalCoverage}=await module('factory/lib/final-coverage.mjs');
const {inferenceRequestHash}=await module('factory/providers/instruction-profiles.mjs'),{getRole}=await module('factory/catalog/index.mjs');
const {unpackJsonContext}=await module('factory/lib/context-json-codec.mjs'),{unpackContext}=await module('factory/lib/context-codec.mjs');
const write=(name,value)=>fs.writeFileSync(join(directory,name),JSON.stringify(value,null,2),{flag:'wx',mode:0o600});
const policy={preset:'adaptive-v1',entryMode:'planned',model:'gpt-6-astra',reasoningEffort:'ultra',allowedTools:[],cardEncoding:'compact-json-v1'};
const criteria=[{id:'capability-fit',text:'Chosen role facets are sufficient and causally useful; shared production preserves boundaries and independent acceptance.',evaluation:'content'}];
write('qualification.json',{startedAt:new Date().toISOString(),release,pins,casesHash:sha256(cases),policy,criteria,expectedLiveCalls:2,
  scope:'Role-fit review only. Candidate plans and their producer receipts are explicitly simulated operator fixtures; only the two independent reviews call the subscription model. No node execution, tools or installation. Labels and oracle reasons are not reviewer input. No repair allowance or rerun-until-green.'});
const rows=[];let failure=null;
for(const [index,c] of cases.entries()){
  if(!frozen())throw Error('Frozen experiment changed');
  const dir=join(directory,String(index));fs.mkdirSync(dir,{mode:0o700});
  const engine=new FactoryEngine({databasePath:join(dir,'state.sqlite'),workspaceRoot:join(dir,'workspaces')});
  try{
    engine.workers.maxReviewRepairs=0;
    const mission=engine.create(intent,policy),plan=normalizeFinalCoverage(c.plan).plan;
    validatePlan(plan,intent,{allowedTools:[]});
    // Deliberately simulated fixture origin, never described as a model plan.
    const run=engine.workers.createRun({missionId:mission.id,nodeId:'planning',mode:'producer',purpose:'plan',roleIds:['omega_04']});
    engine.workers.providerFactory=()=>({async generate(request){await request.validate(plan);return {value:plan,
      receipt:{kind:'inference',simulation:true,status:'completed',threadId:`simulated-fixture-thread:${index}`,turnId:`simulated-fixture-turn:${index}`,
        model:request.model,reasoningEffort:request.reasoningEffort,contextHash:inferenceRequestHash(request),scope:'Operator-authored fixture; NO MODEL CALL'}};},async close(){}});
    await engine.workers.infer({runId:run.id,instructions:'SIMULATED fixture transport only; preserve the operator-authored plan.',input:JSON.stringify({plan}),schema:PLAN_SCHEMA,
      validate:value=>canonical(value)===canonical(plan)});
    const candidate=engine.registry.create({missionId:mission.id,nodeId:'planning',producerRunId:run.id,kind:'mission-plan',purpose:'plan',body:JSON.stringify(plan,null,2),claims:[],inputRefs:[],criteria});
    const captures=[];
    engine.workers.providerFactory=()=>{
      const provider=new CodexProvider();return {async generate(input){
        if(!frozen())throw Error('Frozen experiment changed');
        const request={instructions:input.instructions,input:input.input,schema:input.schema,model:input.model,reasoningEffort:input.reasoningEffort,...(input.instructionProfile?{instructionProfile:input.instructionProfile}:{})};
        const requestHash=inferenceRequestHash(request),pending=engine.store.list('run').filter(r=>r.data.expectedRequestHash===requestHash);
        if(pending.length!==1||pending[0].data.mode!=='reviewer')throw Error('Exact real reviewer binding required');
        const capture={capturedAt:new Date().toISOString(),runId:pending[0].id,requestHash,request};
        write(`case-${index}-request-${captures.length}.json`,capture);captures.push(capture);return provider.generate(input);
      },close:()=>provider.close()};
    };
    const reviewed=await engine.workers.review({artifact:candidate,reviewerRoleIds:['omega_22'],missionIntent:intent});
    const review=engine.store.get('review',reviewed.reviews.at(-1)).data,reviewer=engine.store.get('run',review.reviewerRunId).data;
    const wire=JSON.parse(captures[0].request.input),input=wire.encoding==='sovereign.lossless-context.v2'?unpackJsonContext(wire):wire.encoding==='sovereign.lossless-context.v1'?unpackContext(wire):wire;
    const task=JSON.parse(input.task),contracts=task.targetRoleContracts,expectedIds=[...new Set(plan.nodes.flatMap(n=>[...n.roleIds,...n.reviewerRoleIds]))].sort();
    const checks={oneRealReview:captures.length===1&&reviewer.inferenceReceipts.length===1&&reviewer.inferenceReceipt.simulation!==true,
      exactCards:!!contracts&&canonical(contracts.cards)===canonical(expectedIds.map(getRole))&&contracts.cardsHash===sha256(contracts.cards)
        &&contracts.artifactId===candidate.id&&contracts.artifactHash===candidate.payloadHash,
      noOracleLabel:!Object.hasOwn(task,'expectedDecision')&&!Object.hasOwn(task,'oracleReason')&&!input.missionIntent.includes(c.oracleReason),
      expectedVerdict:review.result.decision===c.expectedDecision&&review.result.checks.length===1&&review.result.checks[0].criterionId==='capability-fit'&&review.result.checks[0].verdict===c.expectedFit,
      noEffects:engine.store.list('effect').length===0,noNodeExecution:engine.store.list('node').length===0,
      simulatedOrigin:engine.store.get('run',run.id).data.inferenceReceipt.simulation===true,
      frozen:frozen()};
    const row={caseId:c.id,missionId:mission.id,databasePath:join(dir,'state.sqlite'),candidateId:candidate.id,candidateHash:candidate.payloadHash,
      checks,passed:Object.values(checks).every(Boolean),result:review.result,inferenceReceipt:reviewer.inferenceReceipt,journal:engine.store.verifyJournal()};
    write(`case-${index}-result.json`,row);rows.push(row);process.stdout.write(JSON.stringify({caseId:c.id,passed:row.passed,decision:review.result.decision})+'\n');
  }catch(error){failure={caseId:c.id,code:error.code??'UNKNOWN',at:new Date().toISOString()};write(`case-${index}-failure.json`,failure);break;}
  finally{engine.close();}
}
const summary={completedAt:new Date().toISOString(),release,pins,failure,completedCases:rows.length,allPassed:!failure&&rows.length===2&&rows.every(r=>r.passed)&&frozen(),
  results:rows.map(r=>({caseId:r.caseId,passed:r.passed,decision:r.result.decision,checks:r.checks})),semanticAudit:'PENDING',
  caveat:'Two authored role-fit cases only, real reviewers and explicit simulated plan origins. No proof of broad calibration, end-to-end production, blind replication, causal superiority or the whole mandate.'};
write('summary.json',summary);process.stdout.write(JSON.stringify(summary)+'\n');process.exitCode=summary.allPassed?0:2;
