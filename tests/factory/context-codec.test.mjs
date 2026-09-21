import test from 'node:test';
import assert from 'node:assert/strict';
import {packContext,unpackContext} from '../../factory/lib/context-codec.mjs';

test('lossless context codec does not inflate small unique input',()=>{
  const input={intent:'small',sources:[]},r=packContext(input);
  assert.equal(r.encoding,'plain-json');assert.equal(r.input,JSON.stringify(input));assert.equal(r.savedBytes,0);
});
test('lossless context codec stores repeated source/file text once, exact ordering and Unicode intact',()=>{
  const text='Línea exacta con "comillas", barras \\ y Unicode 🐚.\n'.repeat(100);
  const input={artifact:{content:text},observations:[{content:text,actor:'producer'},{content:text,actor:'independent-reviewer'}],criteria:['all remain']};
  const r=packContext(input);assert.equal(r.encoding,'sovereign.lossless-context.v1');assert.ok(r.savedBytes>7000);
  assert.equal(r.textCount,1);assert.equal(JSON.stringify(unpackContext(JSON.parse(r.input))),JSON.stringify(input));
});
test('untrusted marker-shaped objects and prototype names cannot become references or mutate prototypes',()=>{
  const input=JSON.parse('{"__proto__":{"polluted":true},"$sovereignText":"invented","nested":{"$sovereignLiteral":[["a","b"]]}}');
  input.repeatA='long '.repeat(1000);input.repeatB=input.repeatA;
  const r=packContext(input),decoded=unpackContext(JSON.parse(r.input));assert.deepEqual(decoded,input);assert.equal({}.polluted,undefined);
});
test('changed text, fabricated references and extra pools are detected before use',()=>{
  const source='original evidence '.repeat(300),r=packContext({a:source,b:source}),envelope=JSON.parse(r.input),hash=Object.keys(envelope.textPool)[0];
  for(const mutate of [e=>{e.textPool[hash]+='altered';},e=>{e.body.a.$sovereignText='unknown';},e=>{e.originalSha256='0'.repeat(64);},e=>{e.body.a.extra='untrusted';}]){
    const changed=structuredClone(envelope);mutate(changed);assert.throws(()=>unpackContext(changed));
  }
});
