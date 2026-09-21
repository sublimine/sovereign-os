import test from 'node:test';
import assert from 'node:assert/strict';
import {sha256} from '../../factory/lib/contracts.mjs';
import {IsolatedExecutionRunner,validateExecutionResult} from '../../factory/tools/execution.mjs';
import {intervalOracleProgram,gradeIntervalExecution,INTERVAL_ORACLE_CHECKS,INTERVAL_ORACLE_MARKER} from '../../reconstruction/verification/interval-union-oracle.mjs';

// Independent reference implementation for the oracle test only, never supplied
// to a live producer. The oracle instead enumerates bounded integer point sets.
const reference=`export function coalesceRanges(ranges){
 if(!Array.isArray(ranges))throw new TypeError('array required');
 const copy=[];for(const p of ranges){
  if(!Array.isArray(p)||p.length!==2||![...p].every(Number.isSafeInteger))throw new TypeError('safe pair required');
  if(p[0]>p[1])throw new RangeError('reversed');copy.push(p.map(n=>n===0?0:n));
 }
 copy.sort((a,b)=>a[0]<b[0]?-1:a[0]>b[0]?1:0);const result=[];
 for(const p of copy){const last=result.at(-1);if(!last||BigInt(p[0])>BigInt(last[1])+1n)result.push(p);
  else if(p[1]>last[1])last[1]=p[1];}
 return result;
}`;
async function execute(content){
 const file={path:'merge-windows.mjs',content,sha256:sha256(content)},manifest=[{type:'file',path:file.path,bytes:Buffer.byteLength(content),sha256:file.sha256}];
 const runner=new IsolatedExecutionRunner();assert.equal(runner.available().available,true,'Native isolation is required for this VPS test');
 const result=await runner.run({args:{argv:['node','--input-type=module','--eval',intervalOracleProgram()],cwd:'.'},snapshot:{manifest,files:[file],hash:sha256(manifest)}});
 validateExecutionResult(result);return result;
}
test('NATIVE external interval oracle accepts independent implementation on exactly 3193 checks in a discarded isolated snapshot',async()=>{
 const result=await execute(reference);assert.equal(gradeIntervalExecution(result).passed,true,result.stderr);
 assert.equal(gradeIntervalExecution(result).checks,INTERVAL_ORACLE_CHECKS);assert.equal(result.isolation.network,false);
 for(const mutate of [r=>({...r,exitCode:1}),r=>({...r,simulation:true}),r=>({...r,stdout:r.stdout+'unexpected\n'}),
   r=>({...r,argv:['node','--test','merge-windows.test.mjs']}),r=>({...r,manifest:[]}),
   r=>({...r,isolation:{...r.isolation,network:true}}),
   r=>({...r,stdout:INTERVAL_ORACLE_MARKER+'{"oracle":"integer-window-union-v1","checks":1,"passed":true}\n'})])
  assert.equal(gradeIntervalExecution(mutate(result)).passed,false);
});
for(const [name,content]of [
 ['overlap-only',reference.replace('BigInt(last[1])+1n','BigInt(last[1])')],
 ['invalid-float-accepted',reference.replace('every(Number.isSafeInteger)','every(Number.isFinite)')],
 ['aliases-empty-input',reference.replace('const copy=[];','if(ranges.length===0)return ranges;const copy=[];')],
 ['exits-zero-without-oracle','process.exit(0); export function coalesceRanges(){return [];}'],
])test(`NATIVE external oracle rejects ${name} without executing generated code in the controller`,async()=>{
 const result=await execute(content);assert.equal(gradeIntervalExecution(result).passed,false);
});
