import test from 'node:test';
import assert from 'node:assert/strict';
import {CATALOG_SOURCE_URLS} from '../../reconstruction/verification/catalog-live-cases.mjs';
import {assessTraceAnswer} from '../../reconstruction/verification/catalog-trace-case.mjs';
const sources=CATALOG_SOURCE_URLS.map((url,i)=>({url,status:'ADMITTED',httpStatus:200,raw:('Controlled evidence '+i+' ').repeat(i?25:2)}));
const candidate=()=>({exampleSecondLevel:['example.com','example.net','example.org'],exampleComAvailableForRegistration:false,ianaReferencesRfc2606:true,independentCorroborationEstablished:false,provenanceReason:'Synthetic explanation only; semantics not certified by this fixture.',scope:'documentary-policy',sourceEvidence:sources.map(s=>({url:s.url,quote:s.raw}))});
const grade=v=>assessTraceAnswer(JSON.stringify(v),sources);
test('oracle v2 preserves original failure while removing only its unstated character ceiling',()=>{
  const result=grade(candidate());assert.equal(result.originalOracle.passed,false);assert.equal(result.passed,true);
  assert.ok(result.quoteLengths[1].length>400);assert.equal(result.originalOracle.checks.bothExactQuotes,false);
});
test('oracle v2 still rejects false statements, invented quote bytes, wrong schema and duplicate sources',()=>{
  for(const mutate of [v=>v.independentCorroborationEstablished=true,v=>v.exampleComAvailableForRegistration=true,v=>v.sourceEvidence[1].quote='Unobserved text.',v=>v.sourceEvidence[1]=v.sourceEvidence[0],v=>v.extra=true]){
    const v=candidate();mutate(v);assert.equal(grade(v).passed,false);
  }
  for(const value of [null,[],{},'not an object'])assert.equal(grade(value).passed,false);
  assert.equal(assessTraceAnswer('not JSON',sources).passed,false);
});
