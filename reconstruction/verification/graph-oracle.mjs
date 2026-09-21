// Trusted exhaustive oracle for small frozen graphs, independent of the
// generated implementation. Never import generated code into this process.
const compare=(a,b)=>{for(let i=0;i<Math.min(a.length,b.length);i++){if(a[i]<b[i])return -1;if(a[i]>b[i])return 1;}return a.length-b.length;};
export function oracle(nodes){
  if(!nodes.length)return {order:[],layers:[],criticalPath:[],totalDuration:0};
  const byId=new Map(nodes.map(n=>[n.id,n])),orders=[];
  const permutations=(prefix,remaining)=>{
    if(!remaining.length){const index=new Map(prefix.map((id,i)=>[id,i]));if(nodes.every(n=>n.dependencies.every(d=>index.get(d)<index.get(n.id))))orders.push(prefix);return;}
    for(let i=0;i<remaining.length;i++)permutations([...prefix,remaining[i]],[...remaining.slice(0,i),...remaining.slice(i+1)]);
  };
  permutations([],nodes.map(n=>n.id));orders.sort(compare);
  if(!orders.length)throw Error('Oracle accepts only small valid DAGs');
  const roots=nodes.filter(n=>!n.dependencies.length),paths=[],depth=new Map(nodes.map(n=>[n.id,0]));
  const walk=path=>{
    const last=path.at(-1),children=nodes.filter(n=>n.dependencies.includes(last));
    depth.set(last,Math.max(depth.get(last),path.length-1));
    if(!children.length)paths.push(path);
    else for(const child of children)walk([...path,child.id]);
  };
  for(const root of roots)walk([root.id]);
  const sum=path=>path.reduce((n,id)=>n+byId.get(id).duration,0),totalDuration=Math.max(...paths.map(sum));
  const criticalPath=paths.filter(p=>sum(p)===totalDuration).sort(compare)[0];
  const layers=Array.from({length:Math.max(...depth.values())+1},(_,level)=>nodes.filter(n=>depth.get(n.id)===level).map(n=>n.id).sort());
  return {order:orders[0],layers,criticalPath,totalDuration};
}
export function graphCases(){
  let state=0x73e28a15;
  const random=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state;};
  const names=['a','A','__proto__','constructor','Z-1','0_x'],cases=[];
  for(let index=0;index<160;index++){
    const count=index%7,nodes=names.slice(0,count).map((id,i)=>({id,dependencies:names.slice(0,i).filter(()=>random()%4===0),duration:random()%5}));
    if(index%5===0)nodes.forEach(n=>n.duration=0);
    const expected=oracle(nodes);if(index%2)nodes.reverse();if(index%3===0)nodes.forEach(n=>n.dependencies.reverse());
    cases.push({id:'dag-'+index,input:nodes,expected:{value:expected,unchanged:true}});
  }
  const invalid=[null,{},[{}],[{id:'bad.id',dependencies:[],duration:0}],
    [{id:'x',dependencies:[],duration:1},{id:'x',dependencies:[],duration:2}],
    [{id:'a',dependencies:['missing'],duration:1}],
    [{id:'a',dependencies:[],duration:1},{id:'b',dependencies:['a','a'],duration:1}],
    [{id:'a',dependencies:['a'],duration:1}],
    [{id:'root',dependencies:[],duration:0},{id:'a',dependencies:['b'],duration:0},{id:'b',dependencies:['a'],duration:0}],
    [{id:'a',dependencies:[],duration:-1}],[{id:'a',dependencies:[],duration:1.5}],
    [{id:'a',dependencies:[],duration:'1'}],
    [{id:'a',dependencies:[],duration:Number.MAX_SAFE_INTEGER},{id:'b',dependencies:['a'],duration:1}],
  ];
  invalid.forEach((input,index)=>cases.push({id:'invalid-'+index,input,expected:{error:{isError:true,code:'GRAPH_INVALID'},unchanged:true}}));
  cases.push({id:'safe-limit',input:[{id:'a',dependencies:[],duration:Number.MAX_SAFE_INTEGER},{id:'b',dependencies:['a'],duration:0}],
    expected:{value:{order:['a','b'],layers:[['a'],['b']],criticalPath:['a','b'],totalDuration:Number.MAX_SAFE_INTEGER},unchanged:true}});
  return cases;
}
export const BRIDGE=`import fs from 'node:fs';
const inputs=JSON.parse(fs.readFileSync('.qualification-input.json','utf8'));
const freeze=x=>{if(x&&typeof x==='object'){Object.values(x).forEach(freeze);Object.freeze(x);}return x;};
const originals=inputs.map(x=>JSON.stringify(x.input));inputs.forEach(x=>freeze(x.input));
const {analyzeGraph}=await import('./graph.mjs');
const results=inputs.map((c,index)=>{let result;try{result={value:analyzeGraph(c.input)};}catch(e){result={error:{isError:e instanceof Error,code:e.code??null}};}return {id:c.id,...result,unchanged:JSON.stringify(c.input)===originals[index]};});
process.stdout.write(JSON.stringify(results));
`;
