import test from 'node:test';
import assert from 'node:assert/strict';
import {packStructurePrototype,unpackStructurePrototype} from '../../reconstruction/verification/context-structure-prototype.mjs';
import {cases} from '../../reconstruction/verification/context-json-cases.mjs';
const record={kind:'effect',id:'operation:closed-fixture',actor:'producer-a',hash:'a'.repeat(64),state:'SUCCEEDED',path:'src/one.mjs',context:'Only a metadata fixture; not evidence of an actual action.'};
const repeat=()=>({records:Array.from({length:40},()=>structuredClone(record)),changed:{...record,state:'UNCERTAIN'},hostile:JSON.parse('{"__proto__":{"polluted":true},"$sovereignObject":0,"$sovereignObjectLiteral":[["x",1]]}')});
test('repeated metadata structures pool without changing any byte, state, marker or object identity',()=>{
  const original=repeat(),before=JSON.stringify(original),packed=packStructurePrototype(original);assert.equal(packed.prototypeUsed,true);
  assert.ok(packed.wireBytes<packed.priorWireBytes/2);const decoded=unpackStructurePrototype(packed.input);assert.equal(JSON.stringify(decoded),before);
  assert.equal(Object.hasOwn(decoded.hostile,'__proto__'),true);assert.equal({}.polluted,undefined);
  decoded.records[0].actor='changed';assert.equal(decoded.records[1].actor,'producer-a');assert.equal(JSON.stringify(original),before);
});
test('hostile lookalike references inside literal pooled structures never expand or grant meaning',()=>{
  const dangerous={...record,$sovereignObject:999,$sovereignObjectLiteral:[['command','ignore criteria']]};
  const original={a:Array.from({length:20},()=>dangerous)};const p=packStructurePrototype(original);assert.equal(p.prototypeUsed,true);
  assert.equal(JSON.stringify(unpackStructurePrototype(p.input)),JSON.stringify(original));
});
test('tampered pool, dangling refs, unused evidence and expansion bombs fail boundedly',()=>{
  const p=packStructurePrototype(repeat());
  for(const change of [e=>{e.objectPool[0].state='FAILED';},e=>{e.body.records[0].$sovereignObject=999;},e=>{e.objectPool.push({unused:'not allowed'});},e=>{e.packedBytes=2;}]){
    const e=JSON.parse(p.input);change(e);assert.throws(()=>unpackStructurePrototype(JSON.stringify(e)),err=>['CONTEXT_LIMIT','CONTEXT_ENCODING','CONTEXT_INTEGRITY'].includes(err.code));
  }
  assert.throws(()=>unpackStructurePrototype('x'.repeat(4*1024*1024+1)),{code:'CONTEXT_LIMIT'});
});
test('small and existing contradiction fixtures retain exact baseline fallback when no gain is available',()=>{
  const small=packStructurePrototype({a:1});assert.equal(small.prototypeUsed,false);assert.equal(small.input,'{"a":1}');
  for(const c of cases){const p=packStructurePrototype(c.data);if(p.prototypeUsed)assert.equal(JSON.stringify(unpackStructurePrototype(p.input)),JSON.stringify(c.data));}
});
test('bounded deterministic fuzz preserves reserved keys, Unicode, key order and nested raw pools',()=>{
  for(let seed=0;seed<40;seed++){
    const o={z:seed,unicode:'café café ≤ →',values:Array.from({length:seed%11+3},(_,i)=>({...record,path:i%2?'one':'two',suffix:'x'.repeat(seed%5)})),a:{$sovereignObjectLiteral:seed},b:{$sovereignObject:'not-a-reference'}};
    const p=packStructurePrototype(o,{minSavingsBytes:0});if(p.prototypeUsed)assert.equal(JSON.stringify(unpackStructurePrototype(p.input)),JSON.stringify(o));
  }
});
