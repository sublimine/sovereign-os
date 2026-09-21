import fs from 'node:fs';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
const sha=x=>crypto.createHash('sha256').update(x).digest('hex');
const kind=process.argv[2],id=process.argv[3];
const root='reconstruction/audit/history-departments-sigma-complement/';
const dep=kind==='department';
let source,base,defs;
if(dep){const roles=JSON.parse(fs.readFileSync('reconstruction/audit/departments/roles.json')).roles;const r=roles.find(x=>x.id===id),b=roles.find(x=>x.id==='veritas_01');source=r.sources[0].path.replace('/v3/','/').replace('-dossier','');base=b.sources[0].path.replace('/v3/','/').replace('-dossier','');const manifest=JSON.parse(execFileSync(process.execPath,['reconstruction/audit/departments/read-lossless.mjs','manifest'],{maxBuffer:20_000_000}));defs=manifest.find(x=>x.fields.id===id).replacements.map(x=>({key:x.field,from:x.from,to:x.to}));}
else {const n=Number(id);source=kind==='json'?`config/sigma/v3/dossiers/sigma-${n}.json`:`docs/sigma/agents/sigma-${n}.md`;base=kind==='json'?'config/sigma/v3/dossiers/sigma-20.json':'docs/sigma/agents/sigma-20.md';const m=JSON.parse(execFileSync(process.execPath,['reconstruction/audit/sigma-complement/read-lossless.mjs',id,'manifest'],{maxBuffer:20_000_000}));defs=m[0].definitions;}
const a=fs.readFileSync(base,'utf8'),z=fs.readFileSync(source,'utf8'),occ=[];
const sorted=[...new Map(defs.map(x=>[x.from,x])).values()].sort((x,y)=>y.from.length-x.from.length);
const esc=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
const re=sorted.length?new RegExp(sorted.map(x=>esc(x.from)).join('|'),'g'):null;
const rebuilt=re?a.replace(re,(s,off)=>{const d=sorted.find(x=>x.from===s);occ.push({key:d.key,line:a.slice(0,off).split('\n').length,byteOffset:Buffer.byteLength(a.slice(0,off))});return d.to;}):a;
const al=rebuilt.split('\n'),zl=z.split('\n'),dp=Array.from({length:al.length+1},()=>new Uint16Array(zl.length+1));
for(let i=al.length-1;i>=0;i--)for(let j=zl.length-1;j>=0;j--)dp[i][j]=al[i]===zl[j]?1+dp[i+1][j+1]:Math.max(dp[i+1][j],dp[i][j+1]);
let i=0,j=0;const residuals=[],equal=[];
while(i<al.length||j<zl.length){if(i<al.length&&j<zl.length&&al[i]===zl[j]){equal.push({baseTransformedLine:++i,targetLine:++j,sha256:sha(al[i-1])});continue;}const r={start:i+1,targetStart:j+1,removed:[],added:[]};while(i<al.length||j<zl.length){if(i<al.length&&j<zl.length&&al[i]===zl[j])break;if(j<zl.length&&(i===al.length||dp[i][j+1]>dp[i+1][j]))r.added.push(zl[j++]);else r.removed.push(al[i++]);}residuals.push(r);}
let cursor=0,final=[];for(const r of residuals){final.push(...al.slice(cursor,r.start-1),...r.added);cursor=r.start-1+r.removed.length;}final.push(...al.slice(cursor));if(final.join('\n')!==z)throw Error('lossless');
const result={source,base,sha256:sha(z),baseSha256:sha(a),bytes:Buffer.byteLength(z),lines:zl.length-1,definitions:sorted.filter(d=>occ.some(x=>x.key===d.key)),occurrences:occ,residuals,equal,verifiedByteReconstruction:true};
if(process.argv[4]==='manifest')process.stdout.write(JSON.stringify(result));else {console.log(source);for(const d of result.definitions)console.log(JSON.stringify({...d,positions:occ.filter(x=>x.key===d.key).map(x=>x.line)}));for(const r of residuals)console.log(JSON.stringify({targetStart:r.targetStart,actual:r.added}));}
