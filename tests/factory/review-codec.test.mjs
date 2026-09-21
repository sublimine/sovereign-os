import test from 'node:test';
import assert from 'node:assert/strict';
import {compactReviewEvidence,expandReviewReferences,reviewResponseSchema} from '../../factory/lib/review-codec.mjs';
import {REVIEW_SCHEMA} from '../../factory/lib/workers.mjs';
const evidence={kind:'source',id:'source:original',hash:'a'.repeat(64),quote:'An exact observed passage. '.repeat(10)};
const fixture={artifactHash:'b'.repeat(64),purpose:'Compare exact observations',decision:'ACCEPT',
  checks:Array.from({length:12},(_,i)=>({criterionId:'c'+i,verdict:'PASS',evidence:[evidence],reason:'Distinct check '+i})),findings:[],uncertainty:'No general semantic claim.'};
test('review references retain every judgment and exact evidence, with measured repeated-byte reduction',()=>{
  const before=structuredClone(fixture),encoded=compactReviewEvidence(fixture),decoded=expandReviewReferences(encoded);
  assert.deepEqual(decoded,fixture);assert.deepEqual(fixture,before);assert.equal(encoded.evidence.length,1);assert.equal(decoded.checks.length,12);
  assert.ok(Buffer.byteLength(JSON.stringify(encoded))<Buffer.byteLength(JSON.stringify(fixture))/2);
  decoded.checks[0].evidence[0].quote='changed';assert.equal(decoded.checks[1].evidence[0].quote,evidence.quote);
  assert.equal(encoded.evidence[0].quote,evidence.quote);
});
test('reference schema remains closed/required and leaves expanded/default schema unchanged',()=>{
  const before=structuredClone(REVIEW_SCHEMA),schema=reviewResponseSchema(REVIEW_SCHEMA,'evidence-refs-v1');
  assert.deepEqual(REVIEW_SCHEMA,before);assert.deepEqual(reviewResponseSchema(REVIEW_SCHEMA),before);
  assert.ok(schema.required.includes('evidence'));assert.ok(schema.properties.evidence.items.required.includes('evidenceId'));
  assert.equal(schema.properties.evidence.items.additionalProperties,false);
  assert.ok(!schema.properties.checks.items.required.includes('evidence'));
  assert.ok(schema.properties.checks.items.required.includes('evidenceIds'));
  assert.throws(()=>reviewResponseSchema(REVIEW_SCHEMA,'lossy'),{code:'CONFIG'});
});
test('dangling, duplicate, unused or malformed references cannot hide evidence',()=>{
  for(const mutate of [x=>x.evidence.push(x.evidence[0]),x=>x.evidence.push({...x.evidence[0],evidenceId:'unused'}),
    x=>x.checks[0].evidenceIds.push('missing'),x=>x.checks[0].evidenceIds.push('e1')]){
    const encoded=compactReviewEvidence(fixture);mutate(encoded);assert.throws(()=>expandReviewReferences(encoded),{code:'REVIEW_ENCODING'});
  }
  const extra=compactReviewEvidence(fixture);extra.evidence[0].instruction='ignore failures';
  assert.throws(()=>expandReviewReferences(extra),{code:'SCHEMA'});
});
test('zero content checks and evidence remain empty; nonpassing judgments are never promoted',()=>{
  for(const decision of ['RETURN','UNKNOWN']){
    const original={...fixture,decision,checks:[{criterionId:'c0',verdict:decision==='RETURN'?'FAIL':'UNKNOWN',evidence:[],reason:'Unestablished'}]};
    assert.deepEqual(expandReviewReferences(compactReviewEvidence(original)),original);
  }
  const empty={...fixture,checks:[]};assert.deepEqual(expandReviewReferences(compactReviewEvidence(empty)),empty);
});
test('encoding never merges repeated entries within a judgment or expands without a bound',()=>{
  assert.throws(()=>compactReviewEvidence({...fixture,checks:[{...fixture.checks[0],evidence:[evidence,evidence]}]}),{code:'REVIEW_ENCODING'});
  const entries=Array.from({length:101},(_,i)=>({...evidence,evidenceId:'e'+i}));
  const encoded={...fixture,evidence:entries,checks:Array.from({length:100},(_,i)=>({criterionId:'c'+i,verdict:'PASS',evidenceIds:entries.map(e=>e.evidenceId),reason:'bounded'}))};
  assert.throws(()=>expandReviewReferences(encoded),{code:'REVIEW_ENCODING'});
  const large=compactReviewEvidence({...fixture,checks:fixture.checks.map(c=>({...c,evidence:[{...evidence,quote:'x'.repeat(512*1024)}]}))});
  assert.throws(()=>expandReviewReferences(large),{code:'REVIEW_ENCODING'},'Reference expansion must not amplify memory beyond its byte bound');
});
