// External functional oracle, injected into a disposable execution snapshot
// only AFTER delivery. Never import generated code in the controller process.
// Finite functional testing, not a proof against deliberately hostile code.
import {canonical} from '../../factory/lib/contracts.mjs';
import {validateExecutionResult} from '../../factory/tools/execution.mjs';
export const INTERVAL_ORACLE_ID='integer-window-union-v1';
export const INTERVAL_ORACLE_MARKER='SOVEREIGN_INTERVAL_ORACLE_RESULT:';
export function intervalOracleProgram(){return `
import assert from 'node:assert/strict';
const {coalesceRanges:f}=await import('./merge-windows.mjs');
assert.equal(typeof f,'function');
let checks=0;
function check(input,expected){
 const frozen=Object.freeze(input.map(p=>Object.freeze([...p])));
 const output=f(frozen);assert.deepEqual(output,expected);assert.notEqual(output,frozen);
 assert(Array.isArray(output));for(const p of output){assert(Array.isArray(p));assert(!frozen.includes(p));}
 assert.deepEqual(frozen,input);checks++;
}
function discreteOracle(input){
 const points=new Set();for(const [a,b]of input)for(let n=a;n<=b;n++)points.add(n);
 const sorted=[...points].sort((a,b)=>a-b),result=[];
 for(const n of sorted){const last=result.at(-1);if(last&&n===last[1]+1)last[1]=n;else result.push([n,n]);}
 return result;
}
check([],[]);
const pairs=[];for(let a=-3;a<=3;a++)for(let b=a;b<=3;b++)pairs.push([a,b]);
for(const a of pairs){check([a],discreteOracle([a]));for(const b of pairs){
 check([a,b],discreteOracle([a,b]));
 for(const c of [[-3,-3],[0,0],[3,3]])check([a,b,c],discreteOracle([a,b,c]));
}}
check([[5,7],[1,2],[3,4],[9,9],[5,7]],[[1,7],[9,9]]);
check([[-0,0]],[[0,0]]);
const min=Number.MIN_SAFE_INTEGER,max=Number.MAX_SAFE_INTEGER;
check([[min,min+1],[min+2,min+3],[max-2,max-1],[max,max]],[[min,min+3],[max-2,max]]);
check([[min,min],[max,max]],[[min,min],[max,max]]);
check([[min,max]],[[min,max]]);
const sparseOuter=new Array(1),sparsePair=new Array(2);sparsePair[1]=2;
for(const input of [null,undefined,{},'x',1,NaN,[null],[[]],[[1]],[[1,2,3]],[[1.5,2]],
 [['1',2]],[[true,2]],[[NaN,2]],[[0,Infinity]],[[min-1,0]],[[0,max+1]],[[1n,2n]],
 sparseOuter,[sparsePair]]){assert.throws(()=>f(input),TypeError);checks++;}
for(const input of [[[2,1]],[[max,min]],[[-1,-2]]]){assert.throws(()=>f(input),RangeError);checks++;}
console.log('${INTERVAL_ORACLE_MARKER}'+JSON.stringify({oracle:'${INTERVAL_ORACLE_ID}',checks,passed:true}));
`;}
// 1 empty + 28 singleton + 28*28*(1 pair+3 triples) + 5 explicit + 20 TypeErrors + 3 RangeErrors.
export const INTERVAL_ORACLE_CHECKS=3193;
export function gradeIntervalExecution(result){
  try{validateExecutionResult(result);}catch{return {passed:false,reason:'EXECUTION_RECEIPT'};}
  if(result.cwd!=='.'||canonical(result.argv)!==canonical(['node','--input-type=module','--eval',intervalOracleProgram()]))
    return {passed:false,reason:'ORACLE_COMMAND'};
  if(result?.simulation!==false||result.exitCode!==0||result.outputTruncated!==false
    ||typeof result.stdout!=='string'||result.stderr!=='')return {passed:false,reason:'EXECUTION_OUTCOME'};
  const text=result.stdout.trimEnd();
  if(!text.startsWith(INTERVAL_ORACLE_MARKER)||text.includes('\n'))return {passed:false,reason:'ORACLE_OUTPUT'};
  try{const value=JSON.parse(text.slice(INTERVAL_ORACLE_MARKER.length));
    const passed=Object.keys(value).sort().join(',')==='checks,oracle,passed'&&value.oracle===INTERVAL_ORACLE_ID
      &&value.checks===INTERVAL_ORACLE_CHECKS&&value.passed===true;
    return {passed,reason:'FINITE_FUNCTIONAL_ORACLE',checks:value.checks};
  }catch{return {passed:false,reason:'ORACLE_OUTPUT'};}
}
