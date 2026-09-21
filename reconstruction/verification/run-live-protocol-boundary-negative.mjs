// One negative reviewer regression, NOT a new mission or a replica retry.
// The old candidate, request input, criteria and evidence stay byte-identical.
import * as fs from 'node:fs';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {DatabaseSync} from 'node:sqlite';
import {CLOSED_PROTOCOL_CONTROL_BOUNDARY} from '../../factory/lib/closed-protocol-boundary.mjs';
const [directory]=process.argv.slice(2);
if(!directory||fs.readdirSync(directory).length)throw Error('New empty output directory required');
const source=new URL('./runs/planned-blind-live-rB9KdY/request-6.json',import.meta.url);
const qualification=JSON.parse(fs.readFileSync(new URL('./runs/planned-blind-live-rB9KdY/qualification.json',import.meta.url)));
const mod=path=>import(pathToFileURL(join(qualification.release.directory,path)));
const {CodexProvider}=await mod('factory/providers/codex.mjs'),{inferenceRequestHash}=await mod('factory/providers/instruction-profiles.mjs');
const {unpackJsonContext}=await mod('factory/lib/context-json-codec.mjs'),{expandCatalogReview}=await mod('factory/lib/review-codec.mjs');
const {sha256,check,canonical}=await mod('factory/lib/contracts.mjs'),{verifyRuntimeRelease}=await mod('factory/lib/runtime-release.mjs');
const inputRecord=JSON.parse(fs.readFileSync(source)),request=structuredClone(inputRecord.request);
const marker=' Directory membership must use your OWN post-candidate workspace.list';
check(request.schema.description.split(marker).length===2,'EXPERIMENT_BOUNDARY','One exact schema insertion point required');
request.schema.description=request.schema.description.replace(marker,' '+CLOSED_PROTOCOL_CONTROL_BOUNDARY+marker);
const exposure=unpackJsonContext(JSON.parse(request.input)),task=JSON.parse(exposure.task);
const baselineRequestHash=inferenceRequestHash(inputRecord.request),requestHash=inferenceRequestHash(request);
const baselineDb=new DatabaseSync(new URL('./runs/planned-blind-live-rB9KdY/state.sqlite',import.meta.url),{readOnly:true,defensive:true,allowExtension:false});
let priorThreads;
try{priorThreads=baselineDb.prepare('SELECT r.json FROM records r JOIN heads h USING(type,id,version) WHERE r.type=?').all('run')
  .flatMap(r=>JSON.parse(r.json).inferenceReceipts??[]).map(r=>r.threadId);}
finally{baselineDb.close();}
check(priorThreads.length>0,'EXPERIMENT_BOUNDARY','Observed prior actor identities required');
check(request.input===inputRecord.request.input&&request.instructions===inputRecord.request.instructions,'EXPERIMENT_BOUNDARY','Only schema boundary instructions may change');
const boundaryFile=new URL('../../factory/lib/closed-protocol-boundary.mjs',import.meta.url),self=new URL(import.meta.url);
const hashes={source:sha256(fs.readFileSync(source)),boundary:sha256(fs.readFileSync(boundaryFile)),harness:sha256(fs.readFileSync(self))};
const frozen=()=>hashes.source===sha256(fs.readFileSync(source))&&hashes.boundary===sha256(fs.readFileSync(boundaryFile))
  &&hashes.harness===sha256(fs.readFileSync(self))&&verifyRuntimeRelease(qualification.release.directory).releaseId===qualification.release.releaseId;
const write=(name,data)=>fs.writeFileSync(join(directory,name),JSON.stringify(data,null,2),{flag:'wx',mode:0o600});
write('qualification.json',{startedAt:new Date().toISOString(),sourceTrial:qualification.missionId,candidateId:task.candidateId,candidateHash:task.artifactHash,
  runtime:qualification.release,hashes,baselineRequestHash,requestHash,request,priorThreads,expected:{decision:'RETURN',criterionId:'blind-method',verdict:'FAIL'},maxCalls:1,
  scope:'Known negative case from A01; exact historical context replay to a fresh reviewer with only the newly explicit replica-control boundary. No registry acceptance, new mission, replica, opening, production change or general calibration claim.'});
const provider=new CodexProvider();let response,observed=null,closure;
try{
  check(frozen(),'EXPERIMENT_BOUNDARY','Qualification inputs changed before dispatch');
  response=await provider.generate({...request,timeoutMs:900000,maxOutputBytes:65536,validate:value=>{
    if(value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).every(k=>Object.hasOwn(request.schema.properties,k)))observed=value;
    const result=expandCatalogReview(value,task.observedEvidenceCatalog);
    check(result.artifactHash===task.artifactHash&&result.purpose===task.purpose,'REVIEW_SCOPE','Exact historical candidate required');
    check(canonical(result.checks.map(c=>c.criterionId).sort())===canonical(task.criteria.map(c=>c.id).sort()),'REVIEW_COVERAGE','All unchanged criteria required');
    check(['ACCEPT','RETURN','UNKNOWN'].includes(result.decision),'REVIEW_DECISION','Unknown decision');
    for(const c of result.checks){check(['PASS','FAIL','UNKNOWN'].includes(c.verdict)&&c.evidence.length>0,'REVIEW_COVERAGE','Verdict and evidence required');
      for(const e of c.evidence){const collection=e.kind==='artifact'?exposure.artifacts:e.kind==='runtime'?exposure.runtimeObservations:e.kind==='source'?exposure.sources:exposure.toolObservations;
        const object=collection?.find(o=>o.id===e.id&&o.hash===e.hash),text=e.kind==='artifact'?object?.payload.body:e.kind==='source'?object?.raw:object?.quoteText;
        check(typeof e.quote==='string'&&e.quote.length>0&&typeof text==='string'&&text.includes(e.quote),'REVIEW_EVIDENCE','Exact actually exposed passage required');}}
    return true;
  }});
  closure=await provider.close();
  const result=expandCatalogReview(response.value,task.observedEvidenceCatalog),gate=result.checks.find(c=>c.criterionId==='blind-method');
  const checks={returned:result.decision==='RETURN',methodFailed:gate?.verdict==='FAIL',real:response.receipt.simulation===false,
    exactRequest:response.receipt.contextHash===requestHash,newThread:!priorThreads.includes(response.receipt.threadId),frozen:frozen(),closed:closure.processExitObserved===true};
  const summary={completedAt:new Date().toISOString(),checks,passed:Object.values(checks).every(v=>v===true),result,receipt:response.receipt,closure,
    semanticAudit:'PENDING',caveat:'One known-negative judgment with unchanged candidate/evidence, not a successful factory mission or broad sensitivity/specificity measurement.'};
  write('result.json',summary);process.stdout.write(JSON.stringify(summary)+'\n');if(!summary.passed)process.exitCode=2;
}catch(error){write('failure.json',{at:new Date().toISOString(),code:error.code??'UNKNOWN',output:observed,receipt:response?.receipt??null});throw error;}
finally{if(!closure)await provider.close();}
