import test from 'node:test';
import assert from 'node:assert/strict';
import {findSourceLiteral,readSourceWindow} from '../../factory/lib/source-windows.mjs';
import {sha256} from '../../factory/lib/contracts.mjs';
const snapshot=raw=>({id:'source:literal-fixture',hash:sha256(raw),raw});

test('bounded pagination preserves overlapping matches and never consumes the first unreturned occurrence',()=>{
  const s=snapshot('aaaaa'),pages=[];let startByte=0;
  for(;;){const p=findSourceLiteral(s,{literal:'aa',maxMatches:2,startByte});pages.push(p);if(p.nextStartByte===null)break;
    assert.ok(p.nextStartByte>startByte);startByte=p.nextStartByte;}
  assert.deepEqual(pages.flatMap(p=>p.matches),[0,1,2,3].map(startByte=>({startByte,endByte:startByte+2})));
  assert.equal(pages[0].moreMatchesExist,true);assert.equal(pages[0].nextStartByte,2);
  assert.equal(pages[1].moreMatchesExist,false);assert.equal(pages[1].completeRawSearch,false);
  assert.equal(findSourceLiteral(s,{literal:'aa',maxMatches:4}).completeRawSearch,true);
});
test('all short binary words and all supplied queries match an independent scalar-position oracle at multiple page sizes',()=>{
  const alphabet=['a','é'],queries=['a','é','aa','aé','éa','éé','aaa','missing'];
  for(let n=0;n<=6;n++)for(let mask=0;mask<2**n;mask++){
    const chars=Array.from({length:n},(_,i)=>alphabet[(mask>>i)&1]),raw=chars.join(''),s=snapshot(raw);
    for(const literal of queries){const expected=[];
      for(let i=0;i<chars.length;i++)if(chars.slice(i).join('').startsWith(literal)){
        const startByte=Buffer.byteLength(chars.slice(0,i).join(''));expected.push({startByte,endByte:startByte+Buffer.byteLength(literal)});}
      for(let maxMatches=1;maxMatches<=3;maxMatches++){
        const got=[];let startByte=0;
        for(let page=0;;page++){
          assert.ok(page<=raw.length+1,'Pagination must terminate');
          const result=findSourceLiteral(s,{literal,maxMatches,startByte});got.push(...result.matches);
          assert.ok(result.matches.length<=maxMatches);if(!result.moreMatchesExist)break;
          assert.ok(result.nextStartByte>startByte);startByte=result.nextStartByte;
        }
        assert.deepEqual(got,expected);
      }
    }
  }
});
test('CRLF, decomposed text, astral characters and literal escapes retain exact original byte offsets',()=>{
  const raw='😀 e\u0301\r\n\\n é 😀 e\u0301',s=snapshot(raw);
  for(const literal of ['😀','e\u0301','é','\r\n','\\n']){
    const found=findSourceLiteral(s,{literal});
    for(const m of found.matches){
      assert.equal(Buffer.from(raw).subarray(m.startByte,m.endByte).toString(),literal);
      assert.ok(readSourceWindow(s,{startByte:m.startByte}).text.startsWith(literal));
    }
  }
  assert.equal(findSourceLiteral(snapshot('e\u0301'),{literal:'é'}).matches.length,0,'No normalization or approximate match');
  for(const startByte of [1,2,3])assert.throws(()=>findSourceLiteral(s,{literal:'😀',startByte}),{code:'SOURCE_WINDOW_RANGE'});
});
test('search is literal data, never a regular expression or instruction execution',()=>{
  const s=snapshot('x .* <script>throw Error("EXECUTE")</script> x [a-z]');
  assert.equal(findSourceLiteral(s,{literal:'.*'}).matches.length,1);
  assert.equal(findSourceLiteral(s,{literal:'[a-z]'}).matches.length,1);
  assert.equal(findSourceLiteral(s,{literal:'<script>throw Error("EXECUTE")</script>'}).matches.length,1);
  assert.match(findSourceLiteral(s,{literal:'absent'}).scope,/not model exposure/);
});
test('invalid queries, matcher objects, source mutation and unknown options fail closed',()=>{
  const s=snapshot('😀 abc');
  for(const options of [{literal:''},{literal:'\ud83d'},{literal:'X'.repeat(1025)},{literal:/abc/},{literal:'abc',maxMatches:0},
    {literal:'abc',maxMatches:65},{literal:'abc',startByte:-1},{literal:'abc',startByte:999},{literal:'abc',regex:true}])
    assert.throws(()=>findSourceLiteral(s,options));
  let called=false;assert.throws(()=>findSourceLiteral(s,{get literal(){called=true;return 'abc';}}));assert.equal(called,false);
  assert.throws(()=>findSourceLiteral({...s,raw:s.raw+'changed'},{literal:'abc'}),{code:'SOURCE_WINDOW_INTEGRITY'});
});
test('empty source, EOF and suffix-only search retain distinct coverage meanings',()=>{
  const empty=findSourceLiteral(snapshot(''),{literal:'x'});assert.deepEqual(empty.matches,[]);assert.equal(empty.completeRawSearch,true);
  const s=snapshot('x x'),eof=findSourceLiteral(s,{literal:'x',startByte:3});assert.deepEqual(eof.matches,[]);
  assert.equal(eof.completeRawSearch,false);assert.equal(eof.moreMatchesExist,false);
  assert.deepEqual(findSourceLiteral(s,{literal:'x',startByte:1}).matches,[{startByte:2,endByte:3}]);
});
test('large HTML fixture finds a late literal without stripping markup or replacing the raw source',()=>{
  const raw='<svg>'+('path é '.repeat(300000))+'</svg><p>Two NULL values are equal for this operation.</p>',s=snapshot(raw);
  const result=findSourceLiteral(s,{literal:'Two NULL values',maxMatches:1});
  assert.ok(Buffer.byteLength(raw)>2*1024*1024);assert.equal(result.matches.length,1);
  assert.ok(result.matches[0].startByte>2*1024*1024);assert.equal(result.completeRawSearch,true);
  assert.equal(s.raw,raw);assert.equal(s.hash,result.sourceHash);
  assert.match(readSourceWindow(s,{startByte:result.matches[0].startByte}).text,/^Two NULL values/);
});
