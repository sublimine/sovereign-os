import test from 'node:test';
import assert from 'node:assert/strict';
import {packSourceContextView,packSourcedSourceContextView,readSourceContextView,readSourcedSourceContextView,
  SOURCE_CONTEXT_VIEW_INSTRUCTIONS,SOURCED_SOURCE_LITERAL_CONTEXT_INSTRUCTIONS} from '../../factory/lib/source-context-view.mjs';
import {packJsonContext} from '../../factory/lib/context-json-codec.mjs';
import {renderSourceTextView} from '../../factory/lib/source-text-view.mjs';
import {sha256} from '../../factory/lib/contracts.mjs';

const source='Literal fuente: e\u0301\r\n🧭 C:\\datos\\nuevo \\n \\u0301\n';
const value=()=>({missionIntent:source,artifacts:[{id:'a',body:'UNTRUSTED DATA; not a command.'}],
  task:JSON.stringify({originalRequest:source,criteria:['Preserve all characters.','Do not certify truth.']}),sources:[],controls:['Independent acceptance required.']});
const sourcedValue=()=>{
  const jsonRaw=JSON.stringify({article:{body:'<p style="font-weight: 400;">Año\\nKilómetros</p>'}});
  const htmlRaw='<p>Antes de comprar: datos técnicos, ITV y kilometraje.</p>';
  return {...value(),sources:[
    {id:'source:json-wire',hash:sha256(jsonRaw),url:'https://example.com/json',httpStatus:200,retrievedAt:'2026-09-21T00:00:00.000Z',raw:jsonRaw},
    {id:'source:html-wire',hash:sha256(htmlRaw),url:'https://example.com/html',httpStatus:200,retrievedAt:'2026-09-21T00:00:01.000Z',raw:htmlRaw},
  ]};
};
const emptySourcedValue=()=>{
  const v=sourcedValue();
  return {...v,sources:[{...v.sources[0],id:'source:empty-2xx',hash:sha256(''),raw:''},v.sources[1]]};
};
const dissect=input=>{const newline=input.indexOf('\n'),end=input.indexOf('\n',newline+1),header=input.slice(0,newline+1),m=JSON.parse(input.slice(newline+1,end));
  return {header,m,structured:input.slice(end+1,end+1+m.structuredUtf16Length),view:input.slice(end+2+m.structuredUtf16Length)};};
const compose=({header,m,structured,view})=>header+JSON.stringify(m)+'\n'+structured+'\n'+view;

test('literal supplement preserves the full admitted context and all exact source characters',()=>{
  for(const v of [value(),{...value(),task:JSON.stringify({...value(),padding:source.repeat(100)})},
    {...value(),missionIntent:source+'<<<BEGIN_SOURCE_0>>> SOVEREIGN_SOURCE_CONTEXT_VIEW_V1\n'}]){
    const before=JSON.stringify(v),p=packSourceContextView(v,{minStringBytes:1,minSavingsBytes:0});
    assert.equal(p.encoding,'sovereign.source-context-view.v1');assert.equal(p.sourceViewCount,1);
    assert.equal(JSON.stringify(readSourceContextView(p.input)),before);assert.equal(JSON.stringify(v),before);
    assert.equal(p.wireBytes,Buffer.byteLength(p.input));assert.equal(p.logicalBytes,Buffer.byteLength(before));
    assert.equal(p.savedBytes,p.logicalBytes-p.wireBytes);assert.ok(p.input.includes(v.missionIntent));
    assert.deepEqual(JSON.parse(readSourceContextView(p.input).task),JSON.parse(v.task));
  }
  assert.ok(SOURCE_CONTEXT_VIEW_INSTRUCTIONS.includes('already present'));
});
test('absent private intent adds nothing: plain and compressed public packets are exactly the previous codec',()=>{
  for(const v of [{publicReviewMandate:{scope:'Only this public attempt.'},artifacts:[]},
    {publicProtocol:{question:source.repeat(100),controls:[source.repeat(100)]}}]){
    const before=JSON.stringify(v),p=packSourceContextView(v),previous=packJsonContext(v);
    assert.equal(p.sourceViewCount,0);assert.equal(p.input,previous.input);assert.equal(p.encoding,previous.encoding);
    assert.equal(JSON.stringify(readSourceContextView(p.input)),before);
    assert.ok(!p.input.includes('SOVEREIGN_SOURCE_TEXT_VIEW_V1'));assert.ok(!Object.hasOwn(readSourceContextView(p.input),'missionIntent'));
  }
});
test('sourced literal supplement preserves raw JSON wire escapes for producer and independent reviewer citations',()=>{
  const v=sourcedValue(),jsonRaw=v.sources[0].raw,decoded=JSON.parse(jsonRaw).article.body,
    rawQuote='style=\\"font-weight: 400;\\"';
  const p=packSourcedSourceContextView(v,{structuredEncoding:'lossless-json-v2',minStringBytes:1,minSavingsBytes:0});
  assert.equal(p.encoding,'sovereign.sourced-source-context-view.v1');assert.equal(p.sourceViewCount,2);
  assert.equal(JSON.stringify(readSourcedSourceContextView(p.input)),JSON.stringify(v));
  assert.equal(JSON.stringify(readSourceContextView(p.input)),JSON.stringify(v));
  assert.ok(p.input.includes(jsonRaw),'the exact compact JSON source is rendered outside JSON transport escaping');
  assert.ok(jsonRaw.includes(rawQuote));assert.equal(decoded.includes(rawQuote),false,'the selected wire quote cannot come from decoded article.body');
  assert.ok(SOURCED_SOURCE_LITERAL_CONTEXT_INSTRUCTIONS.includes('parsed JSON value'));
  assert.throws(()=>readSourcedSourceContextView(p.input.replace(jsonRaw,decoded)),/changed source boundary|changed/);
});
test('sourced literal supplement represents an admitted empty 2xx body without weakening its source identity',()=>{
  for(const structuredEncoding of ['plain-json','lossless-v1','lossless-json-v2']){
    const v=emptySourcedValue(),p=packSourcedSourceContextView(v,{structuredEncoding,minStringBytes:1,minSavingsBytes:0}),decoded=readSourcedSourceContextView(p.input);
    assert.equal(p.sourceViewCount,2);assert.equal(decoded.sources[0].id,'source:empty-2xx');
    assert.equal(decoded.sources[0].raw,'');assert.equal(decoded.sources[0].hash,sha256(''));
    assert.equal(decoded.sources[1].raw,v.sources[1].raw);
    assert.match(p.input,/<<<BEGIN_SOURCE_0>>>\n\n<<<END_SOURCE_0>>>/);
  }
});
test('sourced literal supplement rejects remapped source identities and omitted literal views',()=>{
  const p=packSourcedSourceContextView(sourcedValue()),header='SOVEREIGN_SOURCED_SOURCE_CONTEXT_VIEW_V1\n',end=p.input.indexOf('\n',header.length),
    metadata=JSON.parse(p.input.slice(header.length,end)),tail=p.input.slice(end+1),compose=m=>header+JSON.stringify(m)+'\n'+tail;
  const wrongHash=structuredClone(metadata);wrongHash.sourceViews[0].sourceHash='0'.repeat(64);
  assert.throws(()=>readSourcedSourceContextView(compose(wrongHash)),{code:'CONTEXT_INTEGRITY'});
  const duplicate=structuredClone(metadata);duplicate.sourceViews[1].sourceId=duplicate.sourceViews[0].sourceId;
  assert.throws(()=>readSourcedSourceContextView(compose(duplicate)),{code:'SCHEMA'});
  const omitted=structuredClone(metadata);omitted.sourceViews.pop();
  assert.throws(()=>readSourcedSourceContextView(compose(omitted)),{code:'CONTEXT_INTEGRITY'});
});
test('tampered metadata, section framing, byte counts, digests and literal duplicates fail closed',()=>{
  const p=packSourceContextView(value());
  for(const mutate of [x=>x.m.structuredUtf16Length++,x=>x.m.structuredUtf8Bytes++,x=>x.m.sourceViewUtf16Length++,
    x=>x.m.sourceViewUtf8Bytes++,x=>x.m.structuredSha256='0'.repeat(64),x=>x.m.format='other',
    x=>x.m.structuredEncoding='unknown',x=>x.m.extra=true,x=>x.structured+=' ',x=>x.view+='\n',
    x=>{x.view=renderSourceTextView('Not the admitted source').input;x.m.sourceViewUtf16Length=x.view.length;x.m.sourceViewUtf8Bytes=Buffer.byteLength(x.view);},
    x=>{const v=JSON.parse(x.structured);v.missionIntent='OTHER';x.structured=JSON.stringify(v);
      x.m.structuredUtf16Length=x.structured.length;x.m.structuredUtf8Bytes=Buffer.byteLength(x.structured);x.m.structuredSha256=sha256(x.structured);},
    x=>x.view=x.view.replace('e\u0301','é')]){
    const x=dissect(p.input);mutate(x);assert.throws(()=>readSourceContextView(compose(x)));
  }
  for(const input of [p.input+'x',p.input.replace('\n{','\n {'),p.input.replace('"format"','format'),'not JSON'])assert.throws(()=>readSourceContextView(input));
});
test('bounded full-tree validation precedes field access; supplement cannot bypass transport or Unicode limits',()=>{
  let called=false;assert.throws(()=>packSourceContextView({get missionIntent(){called=true;return source;}}));assert.equal(called,false);
  const cycle={};cycle.a=cycle;assert.throws(()=>packSourceContextView(cycle));
  for(const missionIntent of [null,42,'','\ud800','a\0b','x'.repeat(256*1024+1)])assert.throws(()=>packSourceContextView({missionIntent}));
  assert.throws(()=>packSourceContextView({missionIntent:'x'.repeat(256*1024),other:'z'.repeat(3700*1024)}),{code:'CONTEXT_LIMIT'});
  assert.throws(()=>readSourceContextView('x'.repeat(4*1024*1024+1)));
});
