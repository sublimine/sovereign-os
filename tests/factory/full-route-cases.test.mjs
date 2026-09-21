import test from 'node:test';
import assert from 'node:assert/strict';
import {FULL_ROUTE_CASES as cases,DOCUMENT_URLS,gradeRouteContent,sourceUrlMatches} from '../../reconstruction/verification/full-route-cases.mjs';
import {CLOSED_V2_REVISION_CASE,REVISION_RECORDS} from '../../reconstruction/verification/closed-v2-revision-case.mjs';
const transform=cases[0],research=cases[1];
test('external JSON oracle rejects duplicate names before last-wins parsing hides them',()=>{
  const valid=JSON.stringify(CLOSED_V2_REVISION_CASE.expected);
  for(const body of ['{"total":999,'+valid.slice(1),'{"total":6,'+valid.slice(1),
    valid.replace('"amount":0','"amount":999,"amount":0'),
    valid.replace('"amount":0','"amount":0,"amou\\u006et":0'),
    valid.replace('"total":6','"t\\u006ftal":999,"total":6')]){
    assert.deepEqual(JSON.parse(body),CLOSED_V2_REVISION_CASE.expected,'Mutation is invisible after ordinary parsing');
    assert.deepEqual(gradeRouteContent(CLOSED_V2_REVISION_CASE,body),{passed:false,reason:'BODY_DUPLICATE_KEYS'});
  }
});
test('duplicate JSON keys fail in nested objects, arrays and escaped Unicode names',()=>{
  for(const body of [String.raw`{"":1,"":1}`,String.raw`{"__proto__":0,"__proto__":0}`,
    String.raw`{"x":{"a":1,"a":1}}`,String.raw`[{"x":[{"a":1,"a":1}]}]`,
    String.raw`{"😀":1,"\ud83d\ude00":1}`,String.raw`{"a\\b":1,"a\u005Cb":1}`,
    String.raw`{"a\"b":1,"a\u0022b":1}`,String.raw`{"a/b":1,"a\/b":1}`]){
    const expected=JSON.parse(body);
    assert.deepEqual(gradeRouteContent({family:'transformation',expected},body),{passed:false,reason:'BODY_DUPLICATE_KEYS'});
  }
});
test('uniqueness check preserves per-object scope, raw string boundaries and Unicode distinctions',()=>{
  for(const body of [String.raw`{"a":1,"nested":{"a":2},"list":[{"a":3},{"a":4}]}`,
    String.raw`{"a":"{\"a\":1,\"a\":2}","b":"[}:,\\\"]"}`,
    String.raw`{"É":1,"E\u0301":2}`,String.raw`{"__proto__":{"polluted":true},"constructor":0}`,
    ' \r\n\t {"a" \t : [true,false,null,-2.5e3,"a",{}]} \n ', '"literal,{}[]:\\u0041"']){
    const expected=JSON.parse(body);
    assert.equal(gradeRouteContent({family:'transformation',expected},body).passed,true,body);
  }
  assert.equal({}.polluted,undefined);
});
test('generated duplicate-key negatives cannot be masked by final expected values',()=>{
  const keys=['a','',':{}[]','a"b','a\\b','É','😀','\u0000','__proto__'];
  for(const key of keys)for(const value of [null,true,0,'literal {":',[],{nested:[1,2]}]){
    const pair=JSON.stringify(key)+':'+JSON.stringify(value),body='{'+pair+','+pair+'}',expected=JSON.parse(body);
    assert.equal(gradeRouteContent({family:'transformation',expected},body).passed,false,body);
    const separate='[{'+pair+'},{'+pair+'}]';
    assert.equal(gradeRouteContent({family:'transformation',expected:JSON.parse(separate)},separate).passed,true,separate);
  }
});
test('new v2 external revision oracle distinguishes numeric revision, tie order, inactive state and Unicode scalar order',()=>{
  const c=CLOSED_V2_REVISION_CASE,retained=REVISION_RECORDS.filter((r,i)=>!REVISION_RECORDS.some((s,j)=>s.id===r.id&&(s.revision>r.revision||s.revision===r.revision&&j>i)));
  // Independent quadratic selection, not a copy of a worker algorithm. All
  // fixture IDs deliberately have exactly one Unicode scalar (not code unit).
  assert.ok(retained.every(r=>Array.from(r.id).length===1));
  const items=retained.filter(r=>r.active).sort((a,b)=>a.id.codePointAt(0)-b.id.codePointAt(0)).map(({id,revision,amount})=>({id,revision,amount}));
  assert.deepEqual({items,total:items.reduce((n,r)=>n+r.amount,0)},c.expected);
  assert.equal(gradeRouteContent(c,JSON.stringify(c.expected)).passed,true);
  assert.notEqual(c.request,transform.request);assert.notEqual(c.id,transform.id);assert.equal(c.maxCalls,8);
  for(const mutate of [v=>v.items.reverse(),v=>v.items.sort((a,b)=>a.id<b.id?-1:a.id>b.id?1:0),v=>v.items.splice(0,1),
    v=>v.total++,v=>v.items[0].amount=7,v=>v.items.push({id:'C',revision:2,amount:100}),v=>v.items[0].active=true]){
    const wrong=structuredClone(c.expected);mutate(wrong);assert.equal(gradeRouteContent(c,JSON.stringify(wrong)).passed,false);
  }
});
const quotes={sqlite:'two NULL values are considered to be equal',postgresql:'Null values are considered equal in this comparison.'};
function sourceFixture(){
  const sources=Object.entries(DOCUMENT_URLS).map(([engine,url])=>({id:'synthetic:'+engine,url,raw:'SYNTHETIC test fixture: '+quotes[engine]}));
  const body={scope:'documented-only'};for(const engine of ['sqlite','postgresql'])body[engine]={...research.expected[engine],url:DOCUMENT_URLS[engine],quote:quotes[engine]};
  return {sources,body};
}
test('preregistered corpus contains three different full-product families and only one paired comparison',()=>{
  assert.equal(cases.length,3);assert.equal(new Set(cases.map(c=>c.id)).size,3);
  assert.deepEqual(cases.map(c=>c.family),['transformation','sources','development']);
  assert.equal(cases.flatMap(c=>c.modes).length,4);assert.deepEqual(transform.allowedTools,[]);
  assert.deepEqual(research.allowedTools,['source.fetch']);
  assert(cases[2].allowedTools.includes('execution.run'));assert(!cases[2].allowedTools.includes('source.fetch'));
  for(const c of cases){assert(c.request.length>200);assert(Number.isSafeInteger(c.maxCalls)&&c.maxCalls>0);}
});
test('transformation reference independently accounts for last-record cancellation, reassignment, zero values and ordering',()=>{
  const input=JSON.parse(transform.request.slice(transform.request.indexOf('\n')+1)),latest=new Map();
  for(const row of input)latest.set(row.id,row);
  const totals=new Map();for(const row of latest.values())if(row.status==='paid'){
    const old=totals.get(row.customer)??{customer:row.customer,totalCents:0,orders:0};old.totalCents+=row.amountCents;old.orders++;totals.set(row.customer,old);
  }
  assert.deepEqual([...totals.values()].sort((a,b)=>a.customer<b.customer?-1:a.customer>b.customer?1:0),transform.expected);
  assert.equal(gradeRouteContent(transform,JSON.stringify(transform.expected)).passed,true);
});
for(const label of ['wrong-total','missing-zero-customer','wrong-count','wrong-order','extra-field','string-number'])test(`transformation rejects ${label}`,()=>{
  const value=structuredClone(transform.expected);
  if(label==='wrong-total')value[1].totalCents=1798;if(label==='missing-zero-customer')value.pop();
  if(label==='wrong-count')value[0].orders=1;if(label==='wrong-order')value.reverse();
  if(label==='extra-field')value[0].accepted=true;if(label==='string-number')value[0].totalCents='175';
  assert.equal(gradeRouteContent(transform,JSON.stringify(value)).passed,false);
});
test('untrusted malformed, overflowing, prose and Markdown answers fail closed',()=>{
  for(const body of [null,undefined,42,'null','NaN','1e999','[1e999]','```json\n[]\n```','Here is []'])
    assert.equal(gradeRouteContent(transform,body).passed,false,String(body));
});
test('source oracle requires both exact observed publishers and their NULL-equality passages',()=>{
  const f=sourceFixture();assert.equal(gradeRouteContent(research,JSON.stringify(f.body),f).passed,true);
  assert.equal(gradeRouteContent(research,JSON.stringify(f.body)).passed,false);
  assert.equal(gradeRouteContent(research,JSON.stringify(f.body),{sources:f.sources.slice(0,1)}).passed,false);
});
test('source JSON duplicate facts and scope cannot be hidden behind final correct values',()=>{
  const f=sourceFixture(),valid=JSON.stringify(f.body);
  for(const body of ['{"scope":"invented",'+valid.slice(1),
    valid.replace('"nulls":"equal"','"nulls":"different","nulls":"equal"')]){
    assert.deepEqual(JSON.parse(body),f.body);
    assert.deepEqual(gradeRouteContent(research,body,f),{passed:false,reason:'BODY_DUPLICATE_KEYS'});
  }
});
for(const label of ['wrong-fact','unknown','extra-fact','bad-scope','wrong-publisher','absent-quote','label-only','too-long'])test(`source oracle rejects ${label}`,()=>{
  const f=sourceFixture();
  if(label==='wrong-fact')f.body.sqlite.nulls='different';if(label==='unknown')f.body.postgresql.duplicateRows='unknown';
  if(label==='extra-fact')f.body.sqlite.tested=true;if(label==='bad-scope')f.body.scope='all-sql';
  if(label==='wrong-publisher')f.body.postgresql.url=DOCUMENT_URLS.sqlite;
  if(label==='absent-quote')f.body.sqlite.quote='NULL values are considered equal, unobserved suffix.';
  if(label==='label-only')f.body.sqlite.quote='NULL';
  if(label==='too-long'){f.body.sqlite.quote=quotes.sqlite+' '+Array(30).fill('padding').join(' ');f.sources[0].raw+=f.body.sqlite.quote;}
  assert.equal(gradeRouteContent(research,JSON.stringify(f.body),f).passed,false);
});
test('PostgreSQL version redirect stays within the exact primary document, not arbitrary same-host paths',()=>{
  assert(sourceUrlMatches('postgresql','https://www.postgresql.org/docs/18/queries-select-lists.html'));
  for(const url of ['http://www.postgresql.org/docs/18/queries-select-lists.html','https://www.postgresql.org.evil.test/docs/18/queries-select-lists.html',
    'https://www.postgresql.org/docs/18/queries-select-lists.html?x=1','https://www.postgresql.org/docs/18/other.html'])assert(!sourceUrlMatches('postgresql',url));
});
test('development cannot pass by returning prose or a JSON claim of successful tests',()=>{
  assert.equal(gradeRouteContent(cases[2],'{"passed":true}').passed,false);
});
