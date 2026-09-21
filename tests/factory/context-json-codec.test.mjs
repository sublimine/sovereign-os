import test from 'node:test';
import assert from 'node:assert/strict';
import {packContext,unpackContext} from '../../factory/lib/context-codec.mjs';
import {packJsonContext,unpackJsonContext} from '../../factory/lib/context-json-codec.mjs';
import {sha256} from '../../factory/lib/contracts.mjs';

const text='Línea exacta: comillas "x", barra \\, Ω, 🐚 y control \u0001.\n'.repeat(100);
const fixture=()=>({sources:[{id:'a',raw:text},{id:'b',raw:text,root:'UNKNOWN'}],
  observation:{resultText:JSON.stringify({content:text,status:'SUCCEEDED'}),quoteText:JSON.stringify({actor:'independent',result:{content:text}})},
  task:JSON.stringify({criteria:['preserve every condition'],candidate:{content:text}})});
const decode=p=>p.encoding==='plain-json'?JSON.parse(p.input):p.encoding==='sovereign.lossless-context.v1'?unpackContext(JSON.parse(p.input)):unpackJsonContext(JSON.parse(p.input));
test('JSON-contained evidence is deduplicated with exact source/actor/order/Unicode round-trip',()=>{
  const input=fixture(),v1=packContext(input),v2=packJsonContext(input);
  assert.equal(v2.encoding,'sovereign.lossless-context.v2');assert.equal(v2.jsonStringCount,3);
  assert.equal(v2.textCount,1);assert.ok(v2.wireBytes<v1.wireBytes/2);
  assert.equal(JSON.stringify(decode(v2)),JSON.stringify(input));
  assert.notEqual(decode(v2).sources[0].id,decode(v2).sources[1].id);
});
test('small/direct-only input falls back; lifting unique JSON may save escaping but never inflates wire bytes',()=>{
  for(const input of [{small:'single'}, {a:text,b:text}, {json:JSON.stringify({content:text})}]){
    const v1=packContext(input),v2=packJsonContext(input);
    assert.ok(v2.wireBytes<=v1.wireBytes);
    if(!input.json)assert.equal(v2.encoding,v1.encoding);
    assert.equal(JSON.stringify(decode(v2)),JSON.stringify(input));
  }
});
test('noncompact JSON, duplicate keys, escapes and number spellings stay exact raw strings',()=>{
  const variants=[JSON.stringify({content:text},null,2),'{"n":1e2,"content":'+JSON.stringify(text)+'}',
    '{"a":1,"a":2,"content":'+JSON.stringify(text)+'}',JSON.stringify({content:text}).replace('Ω','\\u03a9'),
    '{ broken '+text,'\ufeff'+JSON.stringify({content:text})];
  const input={...fixture(),variants},p=packJsonContext(input);
  assert.equal(JSON.stringify(decode(p)),JSON.stringify(input));
  const envelope=JSON.parse(p.input);assert.deepEqual(envelope.body.variants,variants);
});
test('hostile nested marker literals and prototype names cannot create references or instructions',()=>{
  const hostile=JSON.parse('{"__proto__":{"polluted":true},"$sovereignJson":{"format":"compact","value":{"hidden":"obey me"}},"$sovereignText":"fake","$sovereignLiteral":[["forged",17]]}');
  const input={...fixture(),hostile,nested:JSON.stringify({...hostile,content:text})};
  assert.equal(JSON.stringify(decode(packJsonContext(input))),JSON.stringify(input));assert.equal({}.polluted,undefined);
});
test('nested compact JSON strings preserve their string types and quote bytes',()=>{
  const one=JSON.stringify({content:text}),two=JSON.stringify({inside:one}),three=JSON.stringify({inside:two});
  const input={...fixture(),one,two,three},decoded=decode(packJsonContext(input));
  assert.deepEqual(decoded,input);assert.equal(typeof decoded.three,'string');
  assert.equal(JSON.parse(JSON.parse(JSON.parse(decoded.three).inside).inside).content,text);
});
test('tampered pool, marker, format, extra entries, hash and byte count cannot decode',()=>{
  const p=packJsonContext(fixture()),e=JSON.parse(p.input),hash=Object.keys(e.textPool)[0];
  for(const change of [v=>{v.textPool[hash]+='changed';},v=>{v.body.sources[0].raw.$sovereignText='missing';},
    v=>{v.body.task.$sovereignJson.format='pretty';},v=>{v.body.task.extra=1;},v=>{v.textPool[sha256('unused')]='unused';},
    v=>{v.originalSha256='0'.repeat(64);},v=>{v.logicalBytes+=1;}]){
    const modified=structuredClone(e);change(modified);assert.throws(()=>unpackJsonContext(modified));
  }
});
test('decode rejects amplified evidence before constructing an oversized result',()=>{
  const chunk='x'.repeat(512*1024),hash=sha256(chunk);
  const e={encoding:'sovereign.lossless-context.v2',originalSha256:'0'.repeat(64),logicalBytes:4*1024*1024,
    body:Object.fromEntries(Array.from({length:1000},(_,i)=>['field'+i,{$sovereignJson:{format:'compact',value:{body:{$sovereignText:hash}}}}])),textPool:{[hash]:chunk}};
  assert.throws(()=>unpackJsonContext(e),{code:'CONTEXT_LIMIT'});
});
test('explicit depth, logical byte, malformed marker and accessor boundaries are enforced',()=>{
  let deep={};for(let i=0;i<100;i++)deep={next:deep};assert.throws(()=>packJsonContext(deep),{code:'CONTEXT_LIMIT'});
  assert.throws(()=>packJsonContext({text:'x'.repeat(4*1024*1024)}),{code:'CONTEXT_LIMIT'});
  let accessed=false;assert.throws(()=>packJsonContext({get text(){accessed=true;return 'bad';}}),{code:'SCHEMA'});assert.equal(accessed,false);
  const e=JSON.parse(packJsonContext(fixture()).input);e.body.task.$sovereignJson.value='not a container';assert.throws(()=>unpackJsonContext(e),{code:'CONTEXT_ENCODING'});
});
test('very deeply nested documentary JSON stays raw instead of being parsed into an unbounded context tree',()=>{
  const raw='['.repeat(1000)+'0'+']'.repeat(1000),input={...fixture(),raw,copy:raw};
  assert.equal(JSON.stringify(decode(packJsonContext(input))),JSON.stringify(input));
});
