import * as fs from 'node:fs';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {verifyRuntimeRelease} from '../../factory/lib/runtime-release.mjs';
import {canonical,sha256} from '../../factory/lib/contracts.mjs';
import {cases,taskInstructions,schema} from './context-json-cases.mjs';
const [directory,runtimeRoot]=process.argv.slice(2);
if(!directory||!runtimeRoot||fs.readdirSync(directory).length)throw Error('New empty result directory and immutable runtime required');
const release=verifyRuntimeRelease(runtimeRoot),harnessHash=sha256(fs.readFileSync(new URL(import.meta.url))),casesHash=sha256(fs.readFileSync(new URL('./context-json-cases.mjs',import.meta.url)));
const {CodexProvider}=await import(pathToFileURL(join(release.directory,'factory/providers/codex.mjs')));
const {packContext,unpackContext}=await import(pathToFileURL(join(release.directory,'factory/lib/context-codec.mjs')));
const {packJsonContext,unpackJsonContext}=await import(pathToFileURL(join(release.directory,'factory/lib/context-json-codec.mjs')));
const {compileLearningPrefix,composeLearningRequest}=await import(pathToFileURL(join(release.directory,'factory/lib/learning-service.mjs')));
const write=(name,value)=>fs.writeFileSync(join(directory,name),JSON.stringify(value,null,2),{flag:'wx',mode:0o600});
const frozen=()=>verifyRuntimeRelease(release.directory).releaseId===release.releaseId&&sha256(fs.readFileSync(new URL(import.meta.url)))===harnessHash&&sha256(fs.readFileSync(new URL('./context-json-cases.mjs',import.meta.url)))===casesHash;
const manifest={startedAt:new Date().toISOString(),release,harnessHash,casesHash,dataHash:sha256(cases),taskHash:sha256(taskInstructions),schemaHash:sha256(schema),
  scope:'Four real subscription decisions on two fixed synthetic evidence cases; v1/v2 order alternated. Same exact logical input, role, task, model and effort; encoding instructions necessarily differ. No actual web acquisition or universal judgment calibration.'};
write('manifest.json',manifest);
const results=[],controller=new AbortController(),stop=()=>controller.abort();process.once('SIGTERM',stop);process.once('SIGINT',stop);
try{
  for(const [i,c]of cases.entries())for(const encoding of i%2?['lossless-json-v2','lossless-v1']:['lossless-v1','lossless-json-v2']){
    if(!frozen()||controller.signal.aborted)throw Error('Frozen experiment changed or cancelled');
    const packed=encoding==='lossless-json-v2'?packJsonContext(c.data):packContext(c.data);
    if(encoding==='lossless-json-v2'&&packed.encoding!=='sovereign.lossless-context.v2')throw Error('Fixture did not exercise v2');
    const resolved=packed.encoding==='plain-json'?JSON.parse(packed.input):packed.encoding==='sovereign.lossless-context.v2'?unpackJsonContext(JSON.parse(packed.input)):unpackContext(JSON.parse(packed.input));
    if(JSON.stringify(resolved)!==JSON.stringify(c.data))throw Error('Input changed during transport');
    const prefix=compileLearningPrefix({roleIds:['omega_22'],purpose:'json-evidence-transport-qualification',mode:'reviewer',contextEncoding:encoding});
    const {request}=composeLearningRequest({prefix,taskInstructions,input:packed.input,schema,model:'gpt-6-astra',reasoningEffort:'ultra',instructionProfile:'scoped-v1'});
    const provider=new CodexProvider();let response,closure;
    process.stdout.write(JSON.stringify({event:'json-context.case.started',caseId:c.id,encoding})+'\n');
    try{response=await provider.generate({...request,signal:controller.signal,timeoutMs:600000,validate:v=>v&&Object.keys(v).length===5&&typeof v.decision==='string'&&Array.isArray(v.supportingIds)&&Array.isArray(v.contradictingIds)&&typeof v.rootAssessment==='string'&&typeof v.passage==='string'});}
    finally{closure=await provider.close();}
    const result={caseId:c.id,encoding,passed:canonical(response.value)===canonical(c.expected)&&closure.processExitObserved===true&&response.receipt.simulation===false&&frozen(),
      value:response.value,expected:c.expected,logicalHash:sha256(JSON.stringify(c.data)),wireBytes:packed.wireBytes,logicalBytes:packed.logicalBytes,
      instructionsBytes:Buffer.byteLength(request.instructions),receipt:response.receipt,closure};
    results.push(result);write(`${i}-${encoding}.json`,result);process.stdout.write(JSON.stringify({event:'json-context.case.completed',caseId:c.id,encoding,passed:result.passed,usage:response.receipt.usage??null})+'\n');
  }
  const variants=['lossless-v1','lossless-json-v2'].map(encoding=>{
    const rows=results.filter(r=>r.encoding===encoding);
    return {encoding,calls:rows.length,passed:rows.filter(r=>r.passed).length,
      usage:Object.fromEntries(['inputTokens','outputTokens','totalTokens'].map(key=>{const values=rows.map(r=>r.receipt.usage?.[key]).filter(Number.isFinite);return [key,{observed:values.length,sum:values.length===rows.length?values.reduce((a,b)=>a+b,0):null}];}))};
  });
  const summary={...manifest,completedAt:new Date().toISOString(),allPassed:results.every(r=>r.passed)&&frozen(),results,variants};
  write('summary.json',summary);process.stdout.write(JSON.stringify({event:'json-context.comparison.completed',allPassed:summary.allPassed,variants})+'\n');if(!summary.allPassed)process.exitCode=2;
}finally{process.removeListener('SIGTERM',stop);process.removeListener('SIGINT',stop);}
