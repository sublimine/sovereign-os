import * as fs from 'node:fs';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {verifyRuntimeRelease} from '../../factory/lib/runtime-release.mjs';
import {sha256} from '../../factory/lib/contracts.mjs';
import {facetCases,taskInstructions,inputFor,schemaFor,grade} from './facet-ablation-cases.mjs';
const [directory,runtimeRoot]=process.argv.slice(2);
if(!directory||!runtimeRoot||fs.readdirSync(directory).length)throw Error('Exact new empty experiment directory and frozen runtime required');
const release=verifyRuntimeRelease(runtimeRoot),self=new URL(import.meta.url),casesUrl=new URL('./facet-ablation-cases.mjs',import.meta.url);
const pinned={harnessHash:sha256(fs.readFileSync(self)),casesHash:sha256(fs.readFileSync(casesUrl))};
const {CodexProvider}=await import(pathToFileURL(join(release.directory,'factory/providers/codex.mjs')));
const {inferenceRequestHash}=await import(pathToFileURL(join(release.directory,'factory/providers/instruction-profiles.mjs')));
const {compileLearningPrefix,composeLearningRequest}=await import(pathToFileURL(join(release.directory,'factory/lib/learning-service.mjs')));
const write=(name,value)=>fs.writeFileSync(join(directory,name),JSON.stringify(value,null,2),{flag:'wx',mode:0o600});
const frozen=()=>verifyRuntimeRelease(release.directory).releaseId===release.releaseId&&sha256(fs.readFileSync(self))===pinned.harnessHash&&sha256(fs.readFileSync(casesUrl))===pinned.casesHash;
const arms=['general','general-plus-facet'];
const schedule=[];
for(const [i,c]of facetCases.entries())for(const [j,v]of (i%2?[...c.variants].reverse():c.variants).entries()){
  for(const arm of (i+j)%2?[...arms].reverse():arms){
    const roleIds=arm==='general'?['omega_22']:['omega_22',c.facet];
    const input=JSON.stringify(inputFor(c,v)),schema=schemaFor(c),prefix=compileLearningPrefix({roleIds,purpose:'frozen-facet-ablation-v1',mode:'reviewer'});
    const {request}=composeLearningRequest({prefix,taskInstructions,input,schema,model:'gpt-6-astra',reasoningEffort:'ultra',instructionProfile:'scoped-v1'});
    schedule.push({index:schedule.length,caseId:c.id,variantId:v.id,arm,roleIds,inputHash:sha256(input),prefixHash:sha256(prefix),schemaHash:sha256(schema),requestHash:sha256(request),instructionsBytes:Buffer.byteLength(request.instructions),request});
  }
}
// Persist every request and all evaluator gold before the first dispatch.
write('cases.json',facetCases);write('requests.json',schedule);
const manifest={startedAt:new Date().toISOString(),release,...pinned,casesDataHash:sha256(facetCases),scheduleHash:sha256(schedule),taskHash:sha256(taskInstructions),expectedCalls:schedule.length,
  scope:'16 fresh-thread real subscription judgments on four closed synthetic paired cases. Same candidate, records, schema, task, model and effort per arm pair; only the complete role prefix differs. Alternating arm/candidate order. One observation per cell, no statistical significance, no real acquisition, no universal superiority and no automatic role removal or learned instruction promotion.',
  cases:facetCases.map(c=>({id:c.id,facet:c.facet,reason:c.reason})),arms};
write('manifest.json',manifest);
const results=[],controller=new AbortController(),stop=()=>controller.abort();process.once('SIGTERM',stop);process.once('SIGINT',stop);
let failure=null;
try{
  for(const row of schedule){
    if(controller.signal.aborted||!frozen())throw Object.assign(Error('Cancelled or frozen inputs changed'),{code:'EXPERIMENT_BOUNDARY'});
    const {request,...metadata}=row,provider=new CodexProvider();let response=null,closure=null,problem=null;
    write(`${row.index}-dispatch.json`,{at:new Date().toISOString(),...metadata});
    process.stdout.write(JSON.stringify({event:'facet.started',...metadata})+'\n');
    try{
      // Preserve any schema-valid structured answer, even when our stronger
      // evaluator will reject empty/duplicated checks. Never repair a response.
      response=await provider.generate({...request,signal:controller.signal,timeoutMs:600000,maxOutputBytes:65536,validate:v=>v!==null&&typeof v==='object'&&!Array.isArray(v)});
    }catch(e){problem={code:e.code??'UNKNOWN',diagnostics:e.diagnostics??null};}
    finally{try{closure=await provider.close();}catch(e){problem={code:e.code??'CLEANUP_UNCONFIRMED',prior:problem};}}
    const c=facetCases.find(c=>c.id===row.caseId),v=c.variants.find(v=>v.id===row.variantId);
    const measured=response?grade(response.value,c,v):null;
    const integrity=Boolean(response&&response.receipt.simulation===false&&closure?.processExitObserved===true
      &&response.receipt.contextHash===inferenceRequestHash(request)&&response.receipt.model===request.model
      &&response.receipt.reasoningEffort===request.reasoningEffort&&frozen());
    const result={completedAt:new Date().toISOString(),...metadata,passed:Boolean(measured?.passed&&integrity&&!problem),integrity,measured,response,closure,failure:problem};
    write(`${row.index}-result.json`,result);results.push(result);
    process.stdout.write(JSON.stringify({event:'facet.completed',index:row.index,caseId:row.caseId,variantId:row.variantId,arm:row.arm,passed:result.passed,failure:problem,usage:response?.receipt.usage??null})+'\n');
    if(problem){failure=problem;break;} // No automatic retry, API fallback or quota work-around.
  }
}catch(e){failure={code:e.code??'EXPERIMENT_FAILURE'};}
finally{
  process.removeListener('SIGTERM',stop);process.removeListener('SIGINT',stop);
  const threadIds=results.filter(r=>r.response).map(r=>r.response.receipt.threadId),distinctThreads=new Set(threadIds).size===threadIds.length;
  const inputPairs=schedule.every(r=>schedule.filter(p=>p.caseId===r.caseId&&p.variantId===r.variantId).every(p=>p.inputHash===r.inputHash&&p.schemaHash===r.schemaHash));
  const variants=arms.map(arm=>{const rows=results.filter(r=>r.arm===arm);return {arm,calls:rows.length,passed:rows.filter(r=>r.passed).length,
    falseAcceptances:rows.filter(r=>r.measured?.expectedDecision==='RETURN'&&r.response?.value.decision==='ACCEPT').length,
    falseRejections:rows.filter(r=>r.measured?.expectedDecision==='ACCEPT'&&r.response?.value.decision!=='ACCEPT').length,
    usage:Object.fromEntries(['inputTokens','outputTokens','totalTokens'].map(key=>{const values=rows.map(r=>r.response?.receipt.usage?.[key]).filter(Number.isFinite);return [key,{observed:values.length,sum:values.length===rows.length?values.reduce((a,b)=>a+b,0):null}];}))};});
  const pairs=schedule.filter(r=>r.arm==='general').map(row=>{const pair=results.filter(r=>r.caseId===row.caseId&&r.variantId===row.variantId);return {caseId:row.caseId,variantId:row.variantId,general:pair.find(r=>r.arm==='general')?.passed??null,withFacet:pair.find(r=>r.arm==='general-plus-facet')?.passed??null};});
  const summary={...manifest,completedAt:new Date().toISOString(),failure,completed:results.length,distinctThreads,inputPairs,inputsUnchanged:frozen(),allPassed:!failure&&results.length===schedule.length&&results.every(r=>r.passed)&&distinctThreads&&inputPairs&&frozen(),variants,pairs,semanticAudit:'PENDING',
    interpretation:'A failed judgment remains failed. Equal observed accuracy does not establish equivalence or authorize deleting a facet. A measured improvement in one cell is not a general effect. Read every reason against the records before changing routing.',results};
  write('summary.json',summary);process.stdout.write(JSON.stringify({event:'facet.finished',completed:summary.completed,allPassed:summary.allPassed,failure,variants,pairs})+'\n');
  if(!summary.allPassed)process.exitCode=2;
}
