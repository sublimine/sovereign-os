import fs from 'node:fs';
import crypto from 'node:crypto';
import {pathToFileURL} from 'node:url';
const sha=s=>crypto.createHash('sha256').update(s).digest('hex');
const basePath='docs/pi/agents/v3/pi-01-dossier.md',charterBase='config/pi/v3/charters/pi-01.system.md';
const read=p=>fs.readFileSync(p,'utf8');
function fields(d,c){
 const grab=re=>{const m=d.match(re);if(!m)throw Error(String(re));return m[1]};
 const between=(a,b)=>d.slice(d.indexOf(a)+a.length,d.indexOf(b));
 return {id:grab(/\*\*ID:\*\* (\w+)/),title:grab(/^# (Π\d+)/),name:grab(/^# Π\d+ — (.+)/m),division:grab(/\*\*División:\*\* (.+)  /),artifact:grab(/\*\*Artefacto exclusivo:\*\* `([^`]+)`/),ledger:grab(/\*\*Ledger exclusivo:\*\* `([^`]+)`/),question:grab(/\*\*Pregunta:\*\* (.+)/),unit:grab(/\*\*Unidad:\*\* (.+)/),purpose:c.match(/Produce \w+: (.+)\./)[1],methods:between('### Métodos\n','### Falsificadores').split('\n').filter(s=>s.startsWith('- ')).map(s=>s.slice(2)),states:[...d.matchAll(/- Estado: `([^`]+)`/g)].map(m=>m[1])};
}
const base=read(basePath),bc=read(charterBase),bf=fields(base,bc);
function delta(a,b){
 const x=a.split('\n'),y=b.split('\n'),table=Array.from({length:x.length+1},()=>new Uint16Array(y.length+1));
 for(let i=x.length-1;i>=0;i--)for(let j=y.length-1;j>=0;j--)table[i][j]=x[i]===y[j]?1+table[i+1][j+1]:Math.max(table[i+1][j],table[i][j+1]);
 let i=0,j=0;const ops=[];
 while(i<x.length||j<y.length){if(i<x.length&&j<y.length&&x[i]===y[j]){ops.push({same:[i+1,j+1]});i++;j++;}else if(j<y.length&&(i===x.length||table[i][j+1]>=table[i+1][j])){ops.push({add:{line:j+1,text:y[j]}});j++;}else{ops.push({remove:i+1});i++;}}
 return ops;
}
export function records(start=1,end=40){return Array.from({length:end-start+1},(_,i)=>i+start).map(n=>{
 const num=String(n).padStart(2,'0'),source=`docs/pi/agents/v3/pi-${num}-dossier.md`,charter=`config/pi/v3/charters/pi-${num}.system.md`,d=read(source),c=read(charter),f=fields(d,c);
 const replacements=[];for(const k of Object.keys(bf)){if(Array.isArray(bf[k]))bf[k].forEach((v,i)=>{if(v!==f[k][i])replacements.push({field:`${k}.${i}`,from:v,to:f[k][i]})});else if(bf[k]!==f[k])replacements.push({field:k,from:bf[k],to:f[k]});}
 replacements.push({field:'schema',from:'pi-01',to:`pi-${num}`});replacements.sort((a,b)=>b.from.length-a.from.length);
 const escape=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),regex=new RegExp(replacements.map(r=>escape(r.from)).join('|'),'g');
 const replace=text=>{const locations=[];const value=text.replace(regex,(m,offset)=>{const r=replacements.find(r=>r.from===m);locations.push({field:r.field,offset,line:text.slice(0,offset).split('\n').length});return r.to});return {value,locations}};
 const a=replace(base),b=replace(bc),ops=delta(a.value,d),cops=delta(b.value,c);
 const rebuild=(ops,value)=>ops.filter(o=>!o.remove).map(o=>o.add?.text??value.split('\n')[o.same[0]-1]).join('\n');
 if(rebuild(ops,a.value)!==d||rebuild(cops,b.value)!==c)throw Error('RECONSTRUCTION_FAILED');
 return {source,charter,base:basePath,charterBase,sha256:sha(d),bytes:Buffer.byteLength(d),lines:d.split('\n').length-(d.endsWith('\n')?1:0),charterSha256:sha(c),charterBytes:Buffer.byteLength(c),charterLines:c.split('\n').length-(c.endsWith('\n')?1:0),fields:f,replacements,locations:a.locations,charterLocations:b.locations,operations:ops,charterOperations:cops,exactByteReconstruction:true};
})}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
const start=Number(process.argv[2]||1),end=Number(process.argv[3]||start);
if(process.argv[4]==='manifest')console.log(JSON.stringify(records(start,end)));
else for(const r of records(start,end)){const group=ops=>{const m=new Map();for(const {add} of ops){if(!add)continue;if(!m.has(add.text))m.set(add.text,[]);m.get(add.text).push(add.line)}return [...m].map(([text,lines])=>({lines,text}))};console.log(JSON.stringify({source:r.source,fields:r.fields,changes:group(r.operations),charterChanges:group(r.charterOperations),exactByteReconstruction:r.exactByteReconstruction}));}
}
