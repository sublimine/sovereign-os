import fs from 'node:fs';
import crypto from 'node:crypto';
const sha=s=>crypto.createHash('sha256').update(s).digest('hex');
const num=Number(process.argv[2]||20);
const tag=n=>String(n).padStart(2,'0');
const basePath='docs/sigma/agents/v3/sigma-20-dossier.md';
const bp='config/sigma/v3/dossiers/sigma-20.json';
const tp=`config/sigma/v3/dossiers/sigma-${tag(num)}.json`;
const b=JSON.parse(fs.readFileSync(bp)),t=JSON.parse(fs.readFileSync(tp));
const pairs=[];
function pair(key,x,y){if(typeof x==='string'&&typeof y==='string'&&x!==y&&x.length>=4)pairs.push({key,from:x,to:y});}
for(const k of ['id','name','category','superior','jurisdiction','artifact','documentation'])pair('agent.'+k,b.agent[k],t.agent[k]);
for(const k of ['core','unit'])pair('doctrine.'+k,b.doctrine[k],t.doctrine[k]);
for(const k of ['decisions','variables','methods','falsifiers','forbidden','stops','threats'])for(let i=0;i<b.doctrine[k].length;i++)pair(`doctrine.${k}.${i}`,b.doctrine[k][i],t.doctrine[k][i]);
for(let i=0;i<b.agent.failures.length;i++)pair(`agent.failures.${i}`,b.agent.failures[i],t.agent.failures[i]);
for(let i=0;i<b.workflow.length;i++)for(const k of Object.keys(b.workflow[i]))if(typeof b.workflow[i][k]==='string'&&b.workflow[i][k].startsWith('DOCTRINE'))pair(`workflow.${i}.${k}`,b.workflow[i][k],t.workflow[i]?.[k]);
for(let i=0;i<b.inputs.length;i++)for(const k of ['name','artifact','schema'])pair(`inputs.${i}.${k}`,b.inputs[i][k],t.inputs[i]?.[k]);
for(let i=0;i<b.specialists.length;i++)for(const k of ['name','id'])pair(`specialists.${i}.${k}`,b.specialists[i][k],t.specialists[i]?.[k]);
for(let i=0;i<b.gates.length;i++)for(const k of ['id','name'])pair(`gates.${i}.${k}`,b.gates[i][k],t.gates[i]?.[k]);
pair('memory.commit',b.memory.commit,t.memory.commit);
pair('charter',b.production_charter,t.production_charter);pair('machine',bp,tp);
// Exact spellings in repeated derived labels are extracted from corresponding strings,
// never used to treat two source spans as equal after normalization.
for(const p of [...pairs]){
 const candidates=[['lower',p.from.toLowerCase(),p.to.toLowerCase()],['slug',p.from.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/^_|_$/g,''),p.to.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/^_|_$/g,'')]];
 for(const [k,x,y]of candidates){pair(p.key+'.'+k,x,y);pair(p.key+'.'+k+'.upper',x.toUpperCase(),y.toUpperCase());}
}
const unique=[...new Map(pairs.map(p=>[p.from,p])).values()].sort((a,b)=>b.from.length-a.from.length);
const esc=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
const re=unique.length?new RegExp(unique.map(p=>esc(p.from)).join('|'),'g'):null;
const records=[];
for(const [base,source] of [[basePath,`docs/sigma/agents/v3/sigma-${tag(num)}-dossier.md`],[b.production_charter,t.production_charter]]){
 const a=fs.readFileSync(base,'utf8'),z=fs.readFileSync(source,'utf8'),occ=[];
 const rebuilt=re?a.replace(re,(s,offset)=>{const p=unique.find(x=>x.from===s);occ.push({key:p.key,baseLine:a.slice(0,offset).split('\n').length,baseByteOffset:Buffer.byteLength(a.slice(0,offset))});return p.to;}):a;
 const al=rebuilt.split('\n'),zl=z.split('\n');
 // Exact line LCS: unchanged lines retain full literal identity; all residual lines printed.
 const n=al.length,m=zl.length,dp=Array.from({length:n+1},()=>new Uint16Array(m+1));
 for(let i=n-1;i>=0;i--)for(let j=m-1;j>=0;j--)dp[i][j]=al[i]===zl[j]?1+dp[i+1][j+1]:Math.max(dp[i+1][j],dp[i][j+1]);
 let i=0,j=0;const changes=[],equal=[];
 while(i<n||j<m){if(i<n&&j<m&&al[i]===zl[j]){equal.push({rebuiltLine:++i,targetLine:++j,sha256:sha(al[i-1])});continue;}const c={rebuiltStart:i+1,targetStart:j+1,removed:[],added:[]};while(i<n||j<m){if(i<n&&j<m&&al[i]===zl[j])break;if(j<m&&(i===n||dp[i][j+1]>dp[i+1][j]))c.added.push(zl[j++]);else c.removed.push(al[i++]);}changes.push(c);}
 let cursor=0,final=[];for(const c of changes){final.push(...al.slice(cursor,c.rebuiltStart-1),...c.added);cursor=c.rebuiltStart-1+c.removed.length;}final.push(...al.slice(cursor));if(final.join('\n')!==z)throw Error('reconstruction');
 const defs=unique.filter(p=>occ.some(x=>x.key===p.key));
 records.push({source,sha256:sha(z),bytes:Buffer.byteLength(z),lines:zl.length-1,base,baseSha256:sha(a),definitions:defs,occurrences:occ,residuals:changes,equalLines:equal,verifiedByteReconstruction:true});
}
if(process.argv[3]==='manifest')process.stdout.write(JSON.stringify(records));
else if(process.argv[3]==='lean'){
 console.log('Exact replacement keys reference the fully read sigma20 base; D=dossier base line; C=charter base line. Literal target strings follow, never equality by normalization.');
 for(const d of unique){const positions=records.map((r,i)=>`${i?'C':'D'}:${r.occurrences.filter(x=>x.key===d.key).map(x=>x.baseLine).join(',')}`).filter(x=>!x.endsWith(':'));if(positions.length)console.log(`${d.key} => ${JSON.stringify(d.to)} @ ${positions.join(' ')}`);}
 for(const r of records){console.log('RESIDUAL '+r.source+' BYTE-VERIFIED');for(const c of r.residuals)console.log(JSON.stringify({baseTransformedRange:[c.rebuiltStart,c.rebuiltStart+c.removed.length-1],targetStart:c.targetStart,actual:c.added}));}
}
else if(process.argv[3]==='compact'){
 for(const d of unique){const positions=records.map(r=>({source:r.source,base:r.base,lines:r.occurrences.filter(x=>x.key===d.key).map(x=>x.baseLine)})).filter(x=>x.lines.length);if(positions.length)console.log(JSON.stringify({key:d.key,from:d.from,to:d.to,positions}));}
 for(const r of records){console.log('RESIDUAL '+r.source+' BYTE-VERIFIED');for(const c of r.residuals)console.log(JSON.stringify(c));}
}else for(const r of records){console.log('SOURCE '+r.source+' BYTE-VERIFIED');for(const d of r.definitions)console.log(JSON.stringify({...d,positions:r.occurrences.filter(x=>x.key===d.key).map(x=>x.baseLine)}));for(const c of r.residuals)console.log(JSON.stringify(c));}
