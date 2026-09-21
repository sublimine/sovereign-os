// One narrow subscription-only boundary-selection probe, not a mission, product,
// routing qualification or semantic judge. No automatic retry or installation.
import * as fs from 'node:fs';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {sha256} from '../../factory/lib/contracts.mjs';
import {verifyRuntimeRelease} from '../../factory/lib/runtime-release.mjs';
const [directory,runtimeRoot,sourceFile]=process.argv.slice(2);
if(!directory||!runtimeRoot||!sourceFile||fs.readdirSync(directory).length)throw Error('New empty probe directory, frozen runtime and explicit source required');
const sourceBytes=fs.readFileSync(sourceFile),source=JSON.parse(sourceBytes),release=verifyRuntimeRelease(runtimeRoot);
if(source.requestHash!==sha256(source.request)||source.expected?.sha256!==sha256(source.expected.body))throw Error('Source request and external byte oracle must be intact');
const self=new URL(import.meta.url),harnessHash=sha256(fs.readFileSync(self));
const frozen=()=>sha256(fs.readFileSync(self))===harnessHash&&sha256(fs.readFileSync(sourceFile))===sha256(sourceBytes)
  &&verifyRuntimeRelease(release.directory).releaseId===release.releaseId;
const module=path=>import(pathToFileURL(join(release.directory,path)));
const {CodexProvider}=await module('factory/providers/codex.mjs'),{inferenceRequestHash}=await module('factory/providers/instruction-profiles.mjs');
const {inputSpanExecutionSchema,selectInputCopy}=await module('factory/lib/input-copy-contract.mjs');
const {keys,check,string}=await module('factory/lib/contracts.mjs');
const write=(name,value)=>fs.writeFileSync(join(directory,name),JSON.stringify(value,null,2),{flag:'wx',mode:0o600});
const request={instructions:'Select the literal source boundaries for the object the supplied request explicitly asks to preserve. Return only the requested structured selector. Each before/after anchor must occur once in the ENTIRE request, in source order, with a nonempty gap. Use surrounding source context to distinguish marker mentions from the actual object. The runtime will copy the substring strictly BETWEEN the anchors, excluding them. Do not transcribe the body or supply positions. Do not normalize Unicode, repair escapes or use tools. This is a boundary-selection diagnostic, not execution, independent review, factual verification or permission to declare the user task completed.',
  input:JSON.stringify({request:source.request}),schema:inputSpanExecutionSchema,model:'gpt-6-astra',reasoningEffort:'ultra'};
const requestHash=inferenceRequestHash(request),startedAt=new Date().toISOString();
write('qualification.json',{startedAt,sourceFile,sourceSha256:sha256(sourceBytes),sourceRequestHash:source.requestHash,release,harnessHash,
  maxProviderCalls:1,scope:'One known-case selector feasibility probe. No full planner, role compilation, judge, accepted product, mutation of prior evidence or generalization.'});
write('request.json',{request,requestHash});
const provider=new CodexProvider(),controller=new AbortController(),stop=()=>controller.abort();
process.once('SIGTERM',stop);process.once('SIGINT',stop);
try{
  if(!frozen())throw Object.assign(Error('Frozen boundary changed'),{code:'EXPERIMENT_BOUNDARY'});
  const response=await provider.generate({...request,timeoutMs:600000,maxOutputBytes:8192,signal:controller.signal,
    validate:value=>{keys(value,['kind','before','after']);check(value.kind==='literal-input-span-v1','SCHEMA','Exact span selector required');
      string(value.before,'before',{min:0,max:8192});string(value.after,'after',{min:0,max:8192});return true;}});
  write('response.json',response);
  let selection=null,selectionError=null;
  try{selection=selectInputCopy(source.request,response.value);}catch(e){selectionError=e.code??'UNKNOWN';}
  const checks={actual:response.receipt.status==='completed'&&response.receipt.simulation===false&&response.receipt.contextHash===requestHash
      &&response.receipt.model===request.model&&response.receipt.reasoningEffort===request.reasoningEffort,
    exactBody:selection?.body===source.expected.body,exactHash:selection?.bodySha256===source.expected.sha256,
    exactBytes:selection?.bodyUtf8Bytes===source.expected.utf8Bytes,frozen:frozen()};
  const summary={startedAt,completedAt:new Date().toISOString(),checks,passed:Object.values(checks).every(v=>v===true),selection,selectionError,
    semanticAudit:'PENDING',caveat:'A correct selector is not an accepted plan or product; independent review and full planner integration remain unqualified.'};
  write('summary.json',summary);process.stdout.write(JSON.stringify({directory,passed:summary.passed,completedAt:summary.completedAt})+'\n');
  if(!summary.passed)process.exitCode=2;
}catch(e){write('failure.json',{at:new Date().toISOString(),code:e.code??'UNKNOWN',usage:'Unknown when no response receipt was retained'});throw e;}
finally{process.removeListener('SIGTERM',stop);process.removeListener('SIGINT',stop);await provider.close();}
