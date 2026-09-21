import fs from 'node:fs';
import crypto from 'node:crypto';
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
export function inspect(n){
 const num=String(n).padStart(2,'0'),path=`config/pi/v3/dossiers/pi-${num}.json`,base=`docs/pi/agents/v3/pi-${num}-dossier.md`;
 const raw=fs.readFileSync(path,'utf8'),md=fs.readFileSync(base,'utf8');
 JSON.parse(raw);const residual=[],references=[];let rebuilt='',cursor=0;
 for(const match of raw.matchAll(/"(?:[^"\\]|\\.)*"/g)){
  rebuilt+=raw.slice(cursor,match.index);const token=match[0],inner=token.slice(1,-1),offset=md.indexOf(inner);
  if(inner&&offset>=0){const exact=md.slice(offset,offset+inner.length);rebuilt+='"'+exact+'"';references.push({target:[match.index+1,match.index+token.length-1],base:[offset,offset+inner.length]});}
  else {rebuilt+=token;residual.push({line:raw.slice(0,match.index).split('\n').length,token});}
  cursor=match.index+token.length;
 }rebuilt+=raw.slice(cursor);if(rebuilt!==raw)throw Error('byte reconstruction failed');
 return {path,base,sha256:hash(raw),baseSha256:hash(md),bytes:Buffer.byteLength(raw),lines:raw.split('\n').length-Number(raw.endsWith('\n')),method:'exact_raw_token_substrings_from_inherited_audited_markdown_plus_literal_residual_and_JSON_structure',references,residual};
}
if(process.argv[2]==='residual'){
 const from=+(process.argv[3]??1),to=+(process.argv[4]??40),seen=new Map();
 for(let n=from;n<=to;n++)for(const r of inspect(n).residual){if(!seen.has(r.token))seen.set(r.token,[]);seen.get(r.token).push(`${n}:${r.line}`);}
 console.log(JSON.stringify([...seen].map(([token,at])=>({token,at})),null,2));
}
