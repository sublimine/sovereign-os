// OFFLINE PREFLIGHT ONLY. Not a selectable worker encoding or installed default.
// Pool repeated complete JSON structures on top of the existing lossless codec.
// No field, old snapshot, contradiction, identity or quoted byte is discarded.
import {check,sha256,keys,integer} from '../../factory/lib/contracts.mjs';
import {packJsonContext,unpackJsonContext} from '../../factory/lib/context-json-codec.mjs';
import {unpackContext} from '../../factory/lib/context-codec.mjs';
const FORMAT='sovereign.lossless-structure.prototype-v1',REF='$sovereignObject',LITERAL='$sovereignObjectLiteral';
const CAP=4*1024*1024,MAX_DEPTH=96,MAX_NODES=100000,MAX_WORK=64*1024*1024;
const isObject=v=>v!==null&&typeof v==='object',size=v=>Buffer.byteLength(JSON.stringify(v));

export function packStructurePrototype(value,{minObjectBytes=256,minSavingsBytes=512}={}){
  integer(minObjectBytes,'object minimum',{min:32});integer(minSavingsBytes,'savings minimum');
  const base=packJsonContext(value),tree=JSON.parse(base.input),counts=new Map();let work=0,exhausted=false;
  const count=v=>{
    if(!isObject(v)||exhausted)return;
    const text=JSON.stringify(v),bytes=Buffer.byteLength(text);work+=bytes;
    if(work>MAX_WORK){exhausted=true;return;}
    if(bytes>=minObjectBytes)counts.set(text,(counts.get(text)??0)+1);
    Object.values(v).forEach(count);
  };count(tree);
  if(exhausted)return {...base,structureCount:0,prototypeUsed:false,preflightWorkBoundReached:true};
  const index=new Map(),objectPool=[];let references=0;
  const encode=v=>{
    if(!isObject(v))return v;
    const raw=JSON.stringify(v);
    if((counts.get(raw)??0)>1){
      if(!index.has(raw)){index.set(raw,objectPool.length);objectPool.push(v);}
      references++;return {[REF]:index.get(raw)};
    }
    if(Array.isArray(v))return v.map(encode);
    const entries=Object.entries(v).map(([k,x])=>[k,encode(x)]);
    return [REF,LITERAL].some(k=>Object.hasOwn(v,k))?{[LITERAL]:entries}:Object.fromEntries(entries);
  };
  const body=encode(tree),envelope={encoding:FORMAT,packedEncoding:base.encoding,packedSha256:sha256(base.input),packedBytes:Buffer.byteLength(base.input),body,objectPool};
  const input=JSON.stringify(envelope),wireBytes=Buffer.byteLength(input);
  if(!objectPool.length||base.wireBytes-wireBytes<minSavingsBytes)return {...base,structureCount:0,prototypeUsed:false,preflightWorkBoundReached:false};
  check(wireBytes<=CAP,'CONTEXT_LIMIT','Prototype wire budget exceeded');
  let restored;
  try{restored=unpackStructurePrototype(input);}catch(error){
    if(error.code!=='CONTEXT_LIMIT')throw error;
    return {...base,structureCount:0,prototypeUsed:false,preflightWorkBoundReached:false,preflightExpansionBoundReached:true};
  }
  check(JSON.stringify(restored)===JSON.stringify(value),'CONTEXT_INTEGRITY','Structure prototype changed original serialization');
  return {...base,encoding:FORMAT,input,wireBytes,savedBytes:base.logicalBytes-wireBytes,
    priorEncoding:base.encoding,priorWireBytes:base.wireBytes,structureCount:objectPool.length,references,prototypeUsed:true,preflightWorkBoundReached:false};
}

export function unpackStructurePrototype(input){
  check(typeof input==='string'&&Buffer.byteLength(input)<=CAP,'CONTEXT_LIMIT','Bounded JSON wire string required');
  const envelope=JSON.parse(input);let nodes=0;
  const bounded=(v,depth=0)=>{check(depth<=MAX_DEPTH&&++nodes<=MAX_NODES,'CONTEXT_LIMIT','Wire tree depth/node bound exceeded');if(isObject(v))Object.values(v).forEach(x=>bounded(x,depth+1));};bounded(envelope);
  keys(envelope,['encoding','packedEncoding','packedSha256','packedBytes','body','objectPool']);
  check(envelope.encoding===FORMAT&&['plain-json','sovereign.lossless-context.v1','sovereign.lossless-context.v2'].includes(envelope.packedEncoding),'CONTEXT_ENCODING','Unknown prototype or inner encoding');
  integer(envelope.packedBytes,'packed bytes',{min:1,max:CAP});
  check(Array.isArray(envelope.objectPool)&&envelope.objectPool.length<=MAX_NODES,'CONTEXT_ENCODING','Explicit object pool required');
  const used=new Set(),sizes=envelope.objectPool.map(v=>{check(isObject(v),'CONTEXT_ENCODING','Pool entries are whole structures');return size(v);});
  let spent=0;nodes=0; // Distinct encoded and expanded node budgets.
  const charge=n=>{spent+=n;check(spent<=envelope.packedBytes,'CONTEXT_LIMIT','Expansion exceeds declared byte bound');};
  const decode=(v,depth=0)=>{
    check(depth<=MAX_DEPTH&&++nodes<=MAX_NODES,'CONTEXT_LIMIT','Expanded tree depth/node bound exceeded');
    if(!isObject(v)){charge(size(v));return v;}
    if(!Array.isArray(v)&&Object.keys(v).length===1&&Object.hasOwn(v,REF)){
      const index=v[REF];integer(index,'object reference',{min:0});check(index<envelope.objectPool.length,'CONTEXT_ENCODING','Dangling structure reference');
      charge(sizes[index]);used.add(index);
      // A pool value is literal original JSON, NEVER recursively interpreted as
      // another reference. Deep clone prevents shared decoded mutable objects.
      const result=JSON.parse(JSON.stringify(envelope.objectPool[index]));bounded(result,depth);return result;
    }
    if(Array.isArray(v)){charge(2);return v.map((x,i)=>{if(i)charge(1);return decode(x,depth+1);});}
    let entries;
    if(Object.keys(v).length===1&&Object.hasOwn(v,LITERAL)){
      entries=v[LITERAL];check(Array.isArray(entries)&&entries.every(e=>Array.isArray(e)&&e.length===2&&typeof e[0]==='string')&&new Set(entries.map(e=>e[0])).size===entries.length,'CONTEXT_ENCODING','Invalid literal entries');
    }else{check(!Object.hasOwn(v,REF)&&!Object.hasOwn(v,LITERAL),'CONTEXT_ENCODING','Unescaped reserved key');entries=Object.entries(v);}
    charge(2);return Object.fromEntries(entries.map(([k,x],i)=>{charge(size(k)+1+(i?1:0));return [k,decode(x,depth+1)];}));
  };
  const packed=decode(envelope.body),serialized=JSON.stringify(packed);
  check(used.size===envelope.objectPool.length&&spent===envelope.packedBytes&&Buffer.byteLength(serialized)===envelope.packedBytes&&sha256(serialized)===envelope.packedSha256,'CONTEXT_INTEGRITY','Unused structure, byte accounting or inner digest differs');
  return envelope.packedEncoding==='sovereign.lossless-context.v2'?unpackJsonContext(packed):envelope.packedEncoding==='sovereign.lossless-context.v1'?unpackContext(packed):packed;
}
