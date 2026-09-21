import * as fs from 'node:fs';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {verifyRuntimeRelease} from '../../factory/lib/runtime-release.mjs';
import {sha256} from '../../factory/lib/contracts.mjs';
import {facetCases,taskInstructions,inputFor,schemaFor,grade} from './facet-ablation-cases.mjs';
const [directory,runtimeRoot]=process.argv.slice(2);
if(!directory||!runtimeRoot||fs.readdirSync(directory).length)throw Error('New empty result directory and frozen runtime required');
const release=verifyRuntimeRelease(runtimeRoot),self=new URL(import.meta.url),casePath=new URL('./facet-ablation-cases.mjs',import.meta.url);
const pinned={harnessHash:sha256(fs.readFileSync(self)),casesHash:sha256(fs.readFileSync(casePath))};
const {CodexProvider}=await import(pathToFileURL(join(release.directory,'factory/providers/codex.mjs')));
const {inferenceRequestHash}=await import(pathToFileURL(join(release.directory,'factory/providers/instruction-profiles.mjs')));
const {compileRoleInstructions,selectCards}=await import(pathToFileURL(join(release.directory,'factory/catalog/index.mjs')));
const {compileLearningPrefix,composeLearningRequest}=await import(pathToFileURL(join(release.directory,'factory/lib/learning-service.mjs')));
const write=(name,value)=>fs.writeFileSync(join(directory,name),JSON.stringify(value,null,2),{flag:'wx',mode:0o600});
const frozen=()=>verifyRuntimeRelease(release.directory).releaseId===release.releaseId&&sha256(fs.readFileSync(self))===pinned.harnessHash&&sha256(fs.readFileSync(casePath))===pinned.casesHash;
const encodings=['pretty-json','compact-json-v1'],schedule=[];
for(const [i,c]of facetCases.entries()){
  const variantId=i%2?'overclaim':'qualified',v=c.variants.find(v=>v.id===variantId),roleIds=['omega_22',c.facet],purpose='role-whitespace-qualification-v1',mode='reviewer';
  const payload={purpose,mode,cards:selectCards(roleIds)},body=JSON.stringify(payload,null,2),old=compileRoleInstructions(roleIds,{purpose,mode}),compact=compileRoleInstructions(roleIds,{purpose,mode,cardEncoding:'compact-json-v1'});
  if(!old.endsWith(body)||compact!==old.slice(0,-body.length)+JSON.stringify(JSON.parse(body)))throw Error('Role representation changed more than JSON whitespace');
  const base=compileLearningPrefix({roleIds,purpose,mode});
  for(const cardEncoding of i%2?[...encodings].reverse():encodings){
    const prefix=compileLearningPrefix({roleIds,purpose,mode,cardEncoding});
    if(cardEncoding==='compact-json-v1'&&prefix!==compact+base.slice(old.length))throw Error('Task controls changed');
    const input=JSON.stringify(inputFor(c,v)),schema=schemaFor(c);
    const {request}=composeLearningRequest({prefix,taskInstructions,input,schema,model:'gpt-6-astra',reasoningEffort:'ultra',instructionProfile:'scoped-v1'});
    schedule.push({index:schedule.length,caseId:c.id,variantId,cardEncoding,roleIds,inputHash:sha256(input),schemaHash:sha256(schema),prefixHash:sha256(prefix),requestHash:inferenceRequestHash(request),instructionsBytes:Buffer.byteLength(request.instructions),request});
  }
}
write('cases.json',facetCases);write('requests.json',schedule);
const manifest={startedAt:new Date().toISOString(),release,...pinned,scheduleHash:sha256(schedule),expectedCalls:8,
  scope:'Four fresh paired subscription judgments: same full cards, inputs, candidates, task, model, effort and schema; only JSON whitespace outside role string values differs. Two positive and two negative candidates; order alternated. No acquisition, files or execution by the provider. One observation per cell, not universal semantic equivalence, not a new mission acceptance and no automatic installation.'};
write('manifest.json',manifest);
const results=[],controller=new AbortController(),stop=()=>controller.abort();process.once('SIGTERM',stop);process.once('SIGINT',stop);let failure=null;
try{
  for(const row of schedule){
    if(controller.signal.aborted||!frozen())throw Object.assign(Error('Frozen comparison changed or cancelled'),{code:'EXPERIMENT_BOUNDARY'});
    const {request,...metadata}=row,provider=new CodexProvider();let response=null,closure=null,problem=null;
    write(`${row.index}-dispatch.json`,{at:new Date().toISOString(),...metadata});process.stdout.write(JSON.stringify({event:'card-encoding.started',...metadata})+'\n');
    try{response=await provider.generate({...request,signal:controller.signal,timeoutMs:600000,maxOutputBytes:65536,validate:v=>v!==null&&typeof v==='object'&&!Array.isArray(v)});}
    catch(e){problem={code:e.code??'UNKNOWN',diagnostics:e.diagnostics??null};}
    finally{try{closure=await provider.close();}catch(e){problem={code:e.code??'CLEANUP_UNCONFIRMED',prior:problem};}}
    const c=facetCases.find(c=>c.id===row.caseId),v=c.variants.find(v=>v.id===row.variantId),measured=response?grade(response.value,c,v):null;
    const integrity=Boolean(response&&response.receipt.simulation===false&&closure?.processExitObserved===true&&response.receipt.contextHash===row.requestHash&&response.receipt.model===request.model&&response.receipt.reasoningEffort===request.reasoningEffort&&frozen());
    const result={completedAt:new Date().toISOString(),...metadata,passed:Boolean(measured?.passed&&integrity&&!problem),integrity,measured,response,closure,failure:problem};
    results.push(result);write(`${row.index}-result.json`,result);process.stdout.write(JSON.stringify({event:'card-encoding.completed',index:row.index,caseId:row.caseId,cardEncoding:row.cardEncoding,passed:result.passed,usage:response?.receipt.usage??null,failure:problem})+'\n');
    if(problem){failure=problem;break;}
  }
}catch(e){failure={code:e.code??'EXPERIMENT_FAILURE'};}
finally{
  process.removeListener('SIGTERM',stop);process.removeListener('SIGINT',stop);
  const threads=results.filter(r=>r.response).map(r=>r.response.receipt.threadId),distinctThreads=new Set(threads).size===threads.length;
  const variants=encodings.map(cardEncoding=>{const rows=results.filter(r=>r.cardEncoding===cardEncoding);return {cardEncoding,calls:rows.length,passed:rows.filter(r=>r.passed).length,usage:Object.fromEntries(['inputTokens','outputTokens','totalTokens'].map(key=>{const values=rows.map(r=>r.response?.receipt.usage?.[key]).filter(Number.isFinite);return [key,{observed:values.length,sum:values.length===rows.length?values.reduce((a,b)=>a+b,0):null}];}))};});
  const summary={...manifest,completedAt:new Date().toISOString(),failure,completed:results.length,distinctThreads,inputsUnchanged:frozen(),allPassed:!failure&&results.length===8&&results.every(r=>r.passed)&&distinctThreads&&frozen(),variants,semanticAudit:'PENDING',results};
  write('summary.json',summary);process.stdout.write(JSON.stringify({event:'card-encoding.finished',completed:summary.completed,allPassed:summary.allPassed,failure,variants})+'\n');if(!summary.allPassed)process.exitCode=2;
}
