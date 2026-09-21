// Frozen, synthetic engineering qualification. These are not measured role costs
// or a production routing policy. The oracle is authored before model execution.
export const request = `Build an auditable, deterministic robust portfolio selector in Node ESM, without dependencies or network. This is a synthetic engineering problem, not financial advice or measured agent-performance data.

Input to exported synchronous selectPortfolio(input) in portfolio.mjs is exactly {budget,required,projects}. budget is a nonnegative safe integer; required is a duplicate-free array of project IDs. projects has 0..16 objects, each exactly {id,cost,benefits,requires,excludes}. IDs match /^[A-Za-z0-9_-]{1,64}$/ and are unique. cost is a nonnegative safe integer; benefits is exactly two nonnegative safe integers for two possible scenarios. requires and excludes are duplicate-free arrays of existing IDs, with no self reference. required IDs must exist. The entire requires graph must be acyclic, even for projects not selected. Exclusion is symmetric in meaning: listing the pair in either direction forbids selecting both. A project may require and exclude the same other project; this is a valid but infeasible selection for that project. Reject unknown fields and all malformed inputs with an Error whose code is PORTFOLIO_INVALID, without mutating input. Also reject inputs if the sum of costs of ALL projects, either full scenario sum, or the sum of both full scenario sums exceeds Number.MAX_SAFE_INTEGER. This conservative validation happens before optimization, irrespective of budget or selections.

A feasible selection contains every required ID, all transitive prerequisites of every selected project, no excluded pair, and total cost <= budget. The empty selection is allowed. Rank feasible selections by: (1) highest minimum of the two scenario benefit sums, then (2) highest sum of both scenario benefit sums, then (3) lowest total cost, then (4) lexicographically smallest sorted ID array using JS string comparison, with a shorter exact prefix first. Return exactly {feasible:true,selected:[sorted IDs],cost,worstBenefit,totalBenefit}, or exactly {feasible:false,selected:[],cost:null,worstBenefit:null,totalBenefit:null} when none is feasible. Do not mutate even deeply frozen inputs; ordering of projects/requires/excludes/required must not affect results.

The design must contain two separately reviewed material prerequisites before implementation, not two agents merely congratulating each other. Produce an artifact of outputKind decision-model that formalizes the objective and constraints, compares at least three algorithmic alternatives including a greedy approach and an exact one, states their limitations, chooses a justified strategy for the explicit 16-project bound, and distinguishes mathematical guarantees from unmeasured runtime performance. Its body is JSON with objectiveOrder exactly ["max-worst-benefit","max-total-benefit","min-cost","lexicographic-ids"], chosenAlgorithm, algorithms (at least three objects with name, rationale and limitation), assumptions and limits. These are nonempty strings/arrays as appropriate; no files or executions are needed for this prerequisite.

Independently produce an artifact of outputKind counterexamples with a JSON body {cases:[{id,input,expected,why}]}, containing exactly one valid-input case for each ID greedy-trap, transitive-dependency, asymmetric-exclusion, robust-not-sum, prefix-tie and infeasible-required. Each expected is the complete selectPortfolio result, hand-derived from the specification, and why explains the failure mode it probes. Keep these six inputs to at most eight projects each. The counterexample producer must not consume the decision-model artifact: it challenges the specification independently. No files or execution are needed for this prerequisite. These named cases must genuinely exercise their described failure modes, not just carry labels.

Only after BOTH prerequisite products have been accepted, implement their integration as the final product. Its dependency references must bind those accepted artifacts and its body must explain how each influences the delivered design/tests. Deliver exactly portfolio.mjs, portfolio.test.mjs and README.md. Tests must be meaningful node:test assertions for the specified semantics, invalid inputs, six reviewed counterexamples, permutation invariance, frozen-input nonmutation and the 16-project boundary. Run node --test portfolio.test.mjs on the actual delivered snapshot; the independent reviewer must read the delivered files and rerun that exact command. README must document API, objective/tie-breaking, complexity, limitations, and mathematical rather than empirically measured guarantees. No package installation, external research, API keys, extra delivered files or host changes. Preserve the full specification; choose role facets for distinct contributions, and explain actual dependencies rather than creating unnecessary stages. The external qualification oracle is separate from your tests and will evaluate the delivered bytes.`;

export const compareIds = (a,b) => {
  for(let i=0;i<Math.min(a.length,b.length);i++){if(a[i]<b[i])return -1;if(a[i]>b[i])return 1;}
  return a.length-b.length;
};
const invalid=()=>{throw Object.assign(new Error('Invalid portfolio input'),{code:'PORTFOLIO_INVALID'});};
const exact=(o,ks)=>o!==null&&typeof o==='object'&&!Array.isArray(o)&&Object.keys(o).sort().join('|')===[...ks].sort().join('|');
const number=x=>Number.isSafeInteger(x)&&x>=0;
const ids=a=>Array.isArray(a)&&a.every(x=>typeof x==='string'&&/^[A-Za-z0-9_-]{1,64}$/.test(x))&&new Set(a).size===a.length;
export function portfolioOracle(input) {
  if(!exact(input,['budget','required','projects'])||!number(input.budget)||!ids(input.required)||!Array.isArray(input.projects)||input.projects.length>16)invalid();
  const p=input.projects;
  if(!p.every(x=>exact(x,['id','cost','benefits','requires','excludes'])&&ids([x.id])&&number(x.cost)&&Array.isArray(x.benefits)&&x.benefits.length===2&&x.benefits.every(number)&&ids(x.requires)&&ids(x.excludes))||new Set(p.map(x=>x.id)).size!==p.length)invalid();
  const map=new Map(p.map(x=>[x.id,x]));
  if(!input.required.every(x=>map.has(x))||!p.every(x=>[...x.requires,...x.excludes].every(d=>map.has(d)&&d!==x.id)))invalid();
  let cost=0n,a=0n,b=0n;
  for(const x of p){cost+=BigInt(x.cost);a+=BigInt(x.benefits[0]);b+=BigInt(x.benefits[1]);}
  if([cost,a,b,a+b].some(x=>x>BigInt(Number.MAX_SAFE_INTEGER)))invalid();
  // Kahn independently checks the whole graph, including optional cycles.
  const remaining=new Map(p.map(x=>[x.id,new Set(x.requires)]));
  while(remaining.size){const roots=[...remaining].filter(([,s])=>!s.size).map(([id])=>id);if(!roots.length)invalid();for(const id of roots){remaining.delete(id);for(const s of remaining.values())s.delete(id);}}
  let best=null;
  const walk=(i,chosen)=>{
    if(i<p.length){walk(i+1,chosen);walk(i+1,[...chosen,p[i]]);return;}
    const selected=chosen.map(x=>x.id).sort(),have=new Set(selected);
    if(!input.required.every(x=>have.has(x))||!chosen.every(x=>x.requires.every(d=>have.has(d))&&x.excludes.every(d=>!have.has(d))))return;
    const c=chosen.reduce((s,x)=>s+x.cost,0);if(c>input.budget)return;
    const sums=[0,1].map(k=>chosen.reduce((s,x)=>s+x.benefits[k],0));
    const value={feasible:true,selected,cost:c,worstBenefit:Math.min(...sums),totalBenefit:sums[0]+sums[1]};
    if(!best||value.worstBenefit>best.worstBenefit||value.worstBenefit===best.worstBenefit&&(value.totalBenefit>best.totalBenefit||value.totalBenefit===best.totalBenefit&&(value.cost<best.cost||value.cost===best.cost&&compareIds(value.selected,best.selected)<0)))best=value;
  };
  walk(0,[]);return best??{feasible:false,selected:[],cost:null,worstBenefit:null,totalBenefit:null};
}
const project=(id,cost,benefits,requires=[],excludes=[])=>({id,cost,benefits,requires,excludes});
export function portfolioCases() {
  const inputs=[
    {budget:0,required:[],projects:[]},
    {budget:10,required:[],projects:[project('a',6,[12,12]),project('b',5,[9,9]),project('c',5,[9,9])]},
    {budget:2,required:['end'],projects:[project('end',1,[10,10],['middle']),project('middle',1,[0,0],['root']),project('root',1,[0,0])]},
    {budget:10,required:[],projects:[project('__proto__',1,[4,4],[],['constructor']),project('constructor',1,[6,6])]},
    {budget:1,required:[],projects:[project('balanced',1,[5,5]),project('risky',1,[20,0])]},
    {budget:0,required:['a'],projects:[project('a',0,[0,0]),project('b',0,[0,0])]},
    {budget:2,required:['a'],projects:[project('a',1,[5,5],['b'],['b']),project('b',1,[2,2])]},
    {budget:Number.MAX_SAFE_INTEGER,required:[],projects:[project('safe',Number.MAX_SAFE_INTEGER,[Number.MAX_SAFE_INTEGER,0])]},
    {budget:16,required:[],projects:Array.from({length:16},(_,i)=>project('p'+String(i).padStart(2,'0'),1,[1,1]))},
  ];
  let state=0x4fc8a193;const random=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state;};
  const names=['a','A','__proto__','constructor','z','b-1','Z_2','zero'];
  for(let i=0;i<96;i++){
    const count=i%9,ps=names.slice(0,count).map((id,k)=>project(id,random()%6,[random()%11,random()%11],names.slice(0,k).filter(()=>random()%5===0),names.slice(k+1,count).filter(()=>random()%7===0)));
    const input={budget:random()%18,required:names.slice(0,count).filter(()=>random()%11===0),projects:ps};
    inputs.push(input);inputs.push({...input,required:[...input.required].reverse(),projects:[...ps].reverse().map(p=>({...p,requires:[...p.requires].reverse(),excludes:[...p.excludes].reverse()}))});
  }
  const base={budget:2,required:[],projects:[project('a',1,[1,1])]},bad=[null,[],{}, {...base,extra:1},{...base,budget:-1},{...base,budget:1.5},{...base,budget:'2'},
    {...base,required:['missing']},{...base,required:['a','a']},{...base,projects:[project('a',1,[1,1]),project('a',1,[1,1])]},
    {...base,projects:[project('a',1,[1,1],['missing'])]},{...base,projects:[project('a',1,[1,1],['a'])]},
    {...base,projects:[project('a',1,[1,1],['b','b']),project('b',1,[1,1])]},
    {...base,projects:[project('a',1,[1,1],[],['a'])]},
    {...base,projects:[project('a',1,[1,1],['b']),project('b',1,[1,1],['a'])]},
    {...base,projects:[project('a',-1,[1,1])]},{...base,projects:[project('a',1,[1])]},{...base,projects:[project('a',1,[1,1,1])]},
    {...base,projects:[project('a',1,[1.5,1])]},{...base,projects:[{...project('a',1,[1,1]),extra:true}]},
    {...base,projects:[project('bad.id',1,[1,1])]},{...base,projects:[project('',1,[1,1])]},
    {...base,projects:[project('a',Number.MAX_SAFE_INTEGER,[0,0]),project('b',1,[0,0])]},
    {...base,projects:[project('a',0,[Number.MAX_SAFE_INTEGER,1])]},
    {...base,projects:Array.from({length:17},(_,i)=>project('p'+i,0,[0,0]))}];
  return [...inputs.map((input,i)=>({id:'valid-'+i,input,expected:{value:portfolioOracle(input),unchanged:true}})),
    ...bad.map((input,i)=>({id:'invalid-'+i,input,expected:{error:{isError:true,code:'PORTFOLIO_INVALID'},unchanged:true}}))];
}
export const BRIDGE=`import fs from 'node:fs';
const inputs=JSON.parse(fs.readFileSync('.qualification-input.json','utf8'));
const freeze=x=>{if(x&&typeof x==='object'){Object.values(x).forEach(freeze);Object.freeze(x);}return x;};
const originals=inputs.map(x=>JSON.stringify(x.input));inputs.forEach(x=>freeze(x.input));
const {selectPortfolio}=await import('./portfolio.mjs');
const results=inputs.map((c,index)=>{let result;try{result={value:selectPortfolio(c.input)};}catch(e){result={error:{isError:e instanceof Error,code:e.code??null}};}return {id:c.id,...result,unchanged:JSON.stringify(c.input)===originals[index]};});
process.stdout.write(JSON.stringify(results));
`;
