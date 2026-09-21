// Two fixed, separate selector diagnostics. No retries, mission, installation,
// API fallback, provider tools, semantic judge or alteration of prior evidence.
import * as fs from 'node:fs';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {sha256} from '../../factory/lib/contracts.mjs';
import {verifyRuntimeRelease} from '../../factory/lib/runtime-release.mjs';
import {nativeSourceViewCases} from './native-source-view-cases.mjs';
const [directory,runtimeRoot,sourceFile]=process.argv.slice(2);
if(!directory||!runtimeRoot||!sourceFile||fs.readdirSync(directory).length)throw Error('New empty diagnostic directory, frozen runtime and explicit prior source required');
const sourceBytes=fs.readFileSync(sourceFile),cases=nativeSourceViewCases(JSON.parse(sourceBytes)),release=verifyRuntimeRelease(runtimeRoot);
const self=new URL(import.meta.url),helper=new URL('./native-source-view-cases.mjs',import.meta.url);
const harnessHash=sha256(fs.readFileSync(self)),helperHash=sha256(fs.readFileSync(helper));
const frozen=()=>sha256(fs.readFileSync(self))===harnessHash&&sha256(fs.readFileSync(helper))===helperHash
  &&sha256(fs.readFileSync(sourceFile))===sha256(sourceBytes)&&verifyRuntimeRelease(release.directory).releaseId===release.releaseId;
const module=path=>import(pathToFileURL(join(release.directory,path)));
const {CodexProvider}=await module('factory/providers/codex.mjs'),{inferenceRequestHash}=await module('factory/providers/instruction-profiles.mjs');
const {inputSpanExecutionSchema,selectInputCopy}=await module('factory/lib/input-copy-contract.mjs');
const {renderSourceTextView,readSourceTextView,SOURCE_TEXT_VIEW_INSTRUCTIONS}=await module('factory/lib/source-text-view.mjs');
const {keys,check,string}=await module('factory/lib/contracts.mjs');
const write=(name,value)=>fs.writeFileSync(join(directory,name),JSON.stringify(value,null,2),{flag:'wx',mode:0o600});
const startedAt=new Date().toISOString(),controller=new AbortController(),stop=()=>controller.abort(),results=[];
const instructions='Select literal source boundaries for the object the supplied request explicitly asks to preserve. Each before/after anchor must occur once in the ENTIRE ORIGINAL SOURCE, in source order with a nonempty gap. Distinguish marker mentions and distractors from the actual object using source context. The controller will copy the original substring strictly BETWEEN your anchors. Do not transcribe the body, supply offsets, use framing as an anchor, normalize characters or use tools. This diagnostic selects boundaries only; it does not execute the user task, judge acceptance or certify truth. '+SOURCE_TEXT_VIEW_INSTRUCTIONS;
write('qualification.json',{startedAt,sourceFile,sourceSha256:sha256(sourceBytes),release,harnessHash,helperHash,maxProviderCalls:2,cases,
  scope:'One attempt per fixed case with source-text-view.v1. Known diagnostic plus a prospectively fixed literal-backslash countercase. No causal comparison, full planner, judge, accepted product or generalization.'});
process.once('SIGTERM',stop);process.once('SIGINT',stop);
try{
  for(const [index,c]of cases.entries()){
    if(!frozen()||index>=2||controller.signal.aborted)throw Object.assign(Error('Prospective boundary reached'),{code:'EXPERIMENT_BOUNDARY'});
    const view=renderSourceTextView(c.request);check(readSourceTextView(view.input)===c.request,'EXPERIMENT_BOUNDARY','Source exposure changed');
    const request={instructions,input:view.input,schema:inputSpanExecutionSchema,model:'gpt-6-astra',reasoningEffort:'ultra'},requestHash=inferenceRequestHash(request);
    write(`request-${index}.json`,{caseId:c.id,request,requestHash,sourceView:view.metadata});
    const provider=new CodexProvider();let response;
    try{response=await provider.generate({...request,timeoutMs:600000,maxOutputBytes:8192,signal:controller.signal,
      validate:value=>{keys(value,['kind','before','after']);check(value.kind==='literal-input-span-v1','SCHEMA','Exact span selector required');
        string(value.before,'before',{min:0,max:8192});string(value.after,'after',{min:0,max:8192});return true;}});
      write(`response-${index}.json`,response);
    }finally{await provider.close();}
    let selection=null,selectionError=null;
    try{selection=selectInputCopy(c.request,response.value);}catch(e){selectionError=e.code??'UNKNOWN';}
    const checks={actual:response.receipt.status==='completed'&&response.receipt.simulation===false&&response.receipt.contextHash===requestHash
      &&response.receipt.model===request.model&&response.receipt.reasoningEffort===request.reasoningEffort,
      exactBody:selection?.body===c.expected,exactHash:selection?.bodySha256===c.expectedSha256,
      exactBytes:selection?.bodyUtf8Bytes===c.expectedUtf8Bytes,frozen:frozen()};
    const result={caseId:c.id,completedAt:new Date().toISOString(),checks,passed:Object.values(checks).every(v=>v===true),selection,selectionError};
    write(`result-${index}.json`,result);results.push(result);
    process.stdout.write(JSON.stringify({caseId:c.id,passed:result.passed,selectionError})+'\n');
  }
  const summary={startedAt,completedAt:new Date().toISOString(),passed:results.length===2&&results.every(r=>r.passed),results,
    semanticAudit:'PENDING',caveat:'No accepted mission/product. Manual audit of exact source, selected boundaries and both receipts is required; two cases are not broad semantic or efficiency calibration.'};
  write('summary.json',summary);if(!summary.passed)process.exitCode=2;
}catch(e){write('failure.json',{at:new Date().toISOString(),code:e.code??'UNKNOWN',completedCases:results.length});throw e;}
finally{process.removeListener('SIGTERM',stop);process.removeListener('SIGINT',stop);}
