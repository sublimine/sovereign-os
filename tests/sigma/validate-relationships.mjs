import fs from "node:fs";import path from "node:path";import{fileURLToPath}from"node:url";
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..",".."),r=JSON.parse(fs.readFileSync(path.join(root,"config/sigma/relationships.json"),"utf8")),errors=[],ids=new Set(Array.from({length:40},(_,i)=>`sigma_${String(i+1).padStart(2,"0")}`)),keys=new Set();
for(const e of r.edges){const k=`${e.from}|${e.to}|${e.type}`;if(keys.has(k))errors.push(`duplicate ${k}`);keys.add(k);if(!ids.has(e.from)||!ids.has(e.to))errors.push(`bad endpoint ${k}`);if(!r.allowed_types.includes(e.type))errors.push(`bad type ${k}`);if(!e.scope)errors.push(`missing scope ${k}`);}
const mustIndependent=[[3,5],[4,6],[7,15],[9,30],[13,17],[14,24],[15,16],[18,20],[19,27],[24,36],[28,32],[29,30],[32,33],[33,34],[35,37],[37,38],[38,40]];
for(const[a,b]of mustIndependent){for(const[x,y]of[[a,b],[b,a]]){const k=`sigma_${String(x).padStart(2,"0")}|sigma_${String(y).padStart(2,"0")}|INDEPENDENT_FROM`;if(!keys.has(k))errors.push(`missing protected separation ${k}`);}}
if(errors.length){console.error("SIGMA RELATIONSHIP VALIDATION FAILED");errors.forEach(e=>console.error("- "+e));process.exit(1);}
console.log("SIGMA RELATIONSHIP VALIDATION PASSED");console.log(JSON.stringify({matrix:"40x40",directed_edges:r.edges.length,protected_bidirectional_separations:mustIndependent.length}));

