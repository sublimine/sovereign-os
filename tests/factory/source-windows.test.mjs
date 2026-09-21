import test from 'node:test';
import assert from 'node:assert/strict';
import {readSourceWindow,verifySourceWindow,sourceWindowContainsQuote,windowByteCoverage,MAX_SOURCE_WINDOW_BYTES} from '../../factory/lib/source-windows.mjs';
import {sha256} from '../../factory/lib/contracts.mjs';
const snapshot=(raw,id='source:fixture')=>({id,raw,hash:sha256(raw)});

test('literal windows preserve all UTF-8 scalar boundaries, CRLF, NFD and literal backslashes without normalization',()=>{
  const raw='Aé😀\r\ne\u0301\\n\\u0301\t中👩‍💻Z',s=snapshot(raw),scalars=Array.from(raw);
  const offsets=[0];for(const char of scalars)offsets.push(offsets.at(-1)+Buffer.byteLength(char));
  for(let i=0;i<offsets.length;i++)for(let maxBytes=4;maxBytes<=32;maxBytes++){
    const window=readSourceWindow(s,{startByte:offsets[i],maxBytes});
    let expected='',used=0;for(const char of scalars.slice(i)){const n=Buffer.byteLength(char);if(used+n>maxBytes)break;expected+=char;used+=n;}
    assert.equal(window.text,expected);assert.equal(window.endByte,offsets[i]+used);assert.equal(verifySourceWindow(s,window),true);
  }
  for(let offset=0;offset<Buffer.byteLength(raw);offset++)if(!offsets.includes(offset))
    assert.throws(()=>readSourceWindow(s,{startByte:offset,maxBytes:4}),{code:'SOURCE_WINDOW_RANGE'});
  assert.equal(s.raw,raw);
});
test('window text and metadata tampering or a different source fail exact verification',()=>{
  const s=snapshot('prefix é😀 suffix'),w=readSourceWindow(s,{startByte:0,maxBytes:12});
  for(const changed of [{text:w.text+'x'},{textSha256:'0'.repeat(64)},{sourceHash:'0'.repeat(64)},
    {sourceId:'source:other'},{sourceBytes:w.sourceBytes+1},{startByte:1},{endByte:w.endByte+1},
    {completeRawDocument:true},{schema:'unregistered'},{extra:'unrequested'}])
    assert.throws(()=>verifySourceWindow(s,{...w,...changed}));
  assert.throws(()=>verifySourceWindow(snapshot(s.raw,'source:other'),w));
  assert.throws(()=>readSourceWindow({...s,raw:s.raw+'changed'}),{code:'SOURCE_WINDOW_INTEGRITY'});
  assert.throws(()=>readSourceWindow(snapshot('\ud800')),{code:'SOURCE_WINDOW_INTEGRITY'});
});
test('byte windows are bounded, validate offsets, and distinguish EOF from complete raw exposure',()=>{
  const s=snapshot('hello');
  for(const args of [{maxBytes:3},{maxBytes:MAX_SOURCE_WINDOW_BYTES+1},{maxBytes:Infinity},{startByte:-1},{startByte:1.5},{startByte:6},{offset:1}])
    assert.throws(()=>readSourceWindow(s,args));
  const eof=readSourceWindow(s,{startByte:5});assert.equal(eof.text,'');assert.equal(eof.completeRawDocument,false);
  const empty=readSourceWindow(snapshot(''));assert.equal(empty.text,'');assert.equal(empty.completeRawDocument,true);
  assert.equal(windowByteCoverage(snapshot(''),[]).completeRawCoverage,true);
  assert.equal(windowByteCoverage(s,[]).completeRawCoverage,false);
  assert.equal(readSourceWindow(s).completeRawDocument,true);
});
test('literal citation cannot jump a gap, normalize characters or cite unobserved source text',()=>{
  const s=snapshot('BEFORE abc GAP def e\u0301 AFTER'),a=readSourceWindow(s,{startByte:0,maxBytes:10}),b=readSourceWindow(s,{startByte:14,maxBytes:9});
  assert.equal(sourceWindowContainsQuote(s,a,'abc'),true);assert.equal(sourceWindowContainsQuote(s,a,'AFTER'),false);
  assert.equal(sourceWindowContainsQuote(s,a,'abc def'),false);
  assert.equal(sourceWindowContainsQuote(s,b,'é'),false);assert.equal(sourceWindowContainsQuote(s,b,'e\u0301'),true);
  assert.throws(()=>sourceWindowContainsQuote(s,a,''));
  assert.equal(windowByteCoverage(s,[a,b]).completeRawCoverage,false);
});
test('a citation cannot select half of an astral scalar and fabricate UTF-8 quote offsets',()=>{
  const s=snapshot('before 😀 after'),w=readSourceWindow(s);
  assert.equal(sourceWindowContainsQuote(s,w,'😀'),true);
  for(const quote of ['\ud83d','\ude00','before \ud83d','\ude00 after'])
    assert.throws(()=>sourceWindowContainsQuote(s,w,quote),{code:'SOURCE_WINDOW_RANGE'});
});
test('coverage merges overlap/adjacency without double counting or manufacturing missing ranges',()=>{
  const s=snapshot('0123456789ABCDEFGHIJ'),a=readSourceWindow(s,{maxBytes:8}),b=readSourceWindow(s,{startByte:4,maxBytes:8}),c=readSourceWindow(s,{startByte:12,maxBytes:8});
  const partial=windowByteCoverage(s,[a,a,b]);assert.equal(partial.coveredBytes,12);assert.deepEqual(partial.gaps,[[12,20]]);
  const full=windowByteCoverage(s,[c,b,a,a]);assert.equal(full.coveredBytes,20);assert.equal(full.completeRawCoverage,true);assert.deepEqual(full.ranges,[[0,20]]);
  assert.equal(full.windowCount,4);assert.match(full.scope,/No claim of completed model exposure/);
  assert.throws(()=>windowByteCoverage(s,[a,{...b,text:'forged'}]));assert.throws(()=>windowByteCoverage(s,new Array(2)));
  assert.throws(()=>windowByteCoverage(s,Array(1025).fill(a)));
});
test('2MB acquired-document-sized fixture is reconstructed exactly through bounded windows, not hidden truncation',()=>{
  const raw=('prose é😀\n<script>UNTRUSTED DATA</script>\r\n').repeat(46000),s=snapshot(raw),windows=[];
  let startByte=0;while(startByte<Buffer.byteLength(raw)){const w=readSourceWindow(s,{startByte,maxBytes:MAX_SOURCE_WINDOW_BYTES});
    assert.ok(w.endByte>startByte);assert.ok(Buffer.byteLength(w.text)<=MAX_SOURCE_WINDOW_BYTES);windows.push(w);startByte=w.endByte;}
  assert.ok(Buffer.byteLength(raw)>2*1024*1024);assert.equal(windows.map(w=>w.text).join(''),raw);
  assert.equal(windowByteCoverage(s,windows).completeRawCoverage,true);
  const incomplete=windowByteCoverage(s,windows.slice(0,-1));assert.equal(incomplete.completeRawCoverage,false);assert.ok(incomplete.gaps.length);
  assert.ok(windows.every(w=>!w.completeRawDocument));assert.ok(windows.some(w=>w.text.includes('<script>UNTRUSTED DATA</script>')));
});
