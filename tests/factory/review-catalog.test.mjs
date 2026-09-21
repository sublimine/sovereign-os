import test from 'node:test';
import assert from 'node:assert/strict';
import {observedEvidenceCatalog,sourcedResponseReviewEvidenceCatalog,expandCatalogReview,compactCatalogReview,reviewResponseSchema} from '../../factory/lib/review-codec.mjs';
import {REVIEW_SCHEMA} from '../../factory/lib/workers.mjs';
const context={artifacts:[{id:'artifact:one',hash:'a'.repeat(64)}],sources:[{id:'source:one',hash:'b'.repeat(64)}],
  toolObservations:[{id:'operation:read',hash:'c'.repeat(64),tool:'workspace.read'},{id:'operation:write',hash:'d'.repeat(64),tool:'workspace.write'}],
  runtimeObservations:[{id:'runtime-observation:one',hash:'e'.repeat(64)}]};
const catalog=observedEvidenceCatalog(context);
const proof=(kind,id,hash,quote='Exact quoted text.')=>({kind,id,hash,quote});
const fixture={artifactHash:'a'.repeat(64),purpose:'Exact independent acceptance',decision:'ACCEPT',
  checks:[{criterionId:'result',verdict:'PASS',reason:'A substantive fixture judgment, not a real model proof.',
    evidence:[proof('artifact','artifact:one','a'.repeat(64)),proof('source','source:one','b'.repeat(64)),proof('tool','operation:read','c'.repeat(64)),proof('tool-history','operation:read','c'.repeat(64)),proof('runtime','runtime-observation:one','e'.repeat(64))]}],findings:[],uncertainty:'Fixture only.'};
test('catalog comes from all supplied observed identities, separates historical tools and does not invent write history',()=>{
  assert.equal(catalog.length,6);
  assert.equal(catalog.filter(e=>e.id==='operation:read').length,2);
  assert.equal(catalog.filter(e=>e.id==='operation:write').length,1);
  const reordered={...context,toolObservations:[...context.toolObservations].reverse()};
  assert.deepEqual(observedEvidenceCatalog(reordered),catalog);
  assert.throws(()=>observedEvidenceCatalog({...context,artifacts:[...context.artifacts,...context.artifacts]}),{code:'REVIEW_ENCODING'});
});
test('catalog transform retains exact source selection, quotes, judgments and hashes without model hash transcription',()=>{
  const original=structuredClone(fixture),encoded=compactCatalogReview(fixture,catalog);
  for(const e of encoded.evidence)assert.deepEqual(Object.keys(e).sort(),['evidenceId','quote','sourceKey']);
  assert.deepEqual(expandCatalogReview(encoded,catalog),fixture);assert.deepEqual(fixture,original);
  const schema=reviewResponseSchema(REVIEW_SCHEMA,'evidence-catalog-v1',catalog);
  assert.deepEqual(schema.properties.evidence.items.properties.sourceKey.enum,catalog.map(e=>e.sourceKey));
  assert.equal(schema.properties.evidence.items.properties.hash,undefined);
  assert.equal(schema.properties.evidence.items.additionalProperties,false);
  assert.throws(()=>reviewResponseSchema(REVIEW_SCHEMA,'evidence-catalog-v1'),{code:'SCHEMA'});
});
test('unknown keys, extra hashes, duplicate identifiers and unused generated quotes fail rather than being repaired',()=>{
  for(const mutate of [e=>{e.evidence[0].sourceKey='missing';},e=>{e.evidence.push({...e.evidence[0],evidenceId:'unused'});},e=>{e.evidence.push(e.evidence[0]);}]){
    const encoded=compactCatalogReview(fixture,catalog);mutate(encoded);
    assert.throws(()=>expandCatalogReview(encoded,catalog),{code:'REVIEW_ENCODING'});
  }
  const extra=compactCatalogReview(fixture,catalog);extra.evidence[0].hash='f'.repeat(64);
  assert.throws(()=>expandCatalogReview(extra,catalog),{code:'SCHEMA'});
  const wrong=structuredClone(fixture);wrong.checks[0].evidence[0].hash='f'.repeat(64);
  assert.throws(()=>compactCatalogReview(wrong,catalog),{code:'REVIEW_ENCODING'});
});
test('transport does not certify quotes or change nonpassing verdicts; duplicate catalog keys and malformed hashes fail',()=>{
  for(const decision of ['RETURN','UNKNOWN']){
    const value={...fixture,decision,checks:[{...fixture.checks[0],verdict:decision==='RETURN'?'FAIL':'UNKNOWN'}]};
    assert.deepEqual(expandCatalogReview(compactCatalogReview(value,catalog),catalog),value);
  }
  const encoded=compactCatalogReview(fixture,catalog);encoded.evidence[0].quote='A fake quote must reach unchanged registry validation, never silently repaired.';
  assert.equal(expandCatalogReview(encoded,catalog).checks[0].evidence[0].quote,encoded.evidence[0].quote);
  assert.throws(()=>expandCatalogReview(encoded,[...catalog,{...catalog[1],sourceKey:catalog[0].sourceKey}]),{code:'REVIEW_ENCODING'});
  assert.throws(()=>expandCatalogReview(encoded,catalog.map((e,i)=>i?e:{...e,hash:'bad'})),{code:'SCHEMA'});
});
test('catalog expansion inherits the bounded review anti-amplification control',()=>{
  const large={...fixture,checks:Array.from({length:30},(_,i)=>({criterionId:'c'+i,verdict:'PASS',reason:'bounded',
    evidence:[proof('artifact','artifact:one','a'.repeat(64),'x'.repeat(200000))]}))};
  assert.throws(()=>expandCatalogReview(compactCatalogReview(large,catalog),catalog),{code:'REVIEW_ENCODING'});
});
const sourcedContext={artifacts:[
  {id:'artifact:target',hash:'1'.repeat(64)},
  {id:'artifact:unrelated',hash:'2'.repeat(64)}
],sources:[
  {id:'source:one',hash:'3'.repeat(64)},
  {id:'source:two',hash:'4'.repeat(64)}
],toolObservations:[
  {id:'operation:source-fetch',hash:'5'.repeat(64),tool:'source.fetch'},
  {id:'operation:workspace-read',hash:'6'.repeat(64),tool:'workspace.read'}
],runtimeObservations:[
  {id:'runtime-observation:boundary',hash:'7'.repeat(64),kind:'sourced-answer-boundary'},
  {id:'runtime-observation:other',hash:'8'.repeat(64),kind:'effect-inventory'}
]};
const sourcedTarget={id:'artifact:target',hash:'1'.repeat(64)};
const sourcedBoundary={id:'runtime-observation:boundary',hash:'7'.repeat(64),kind:'sourced-answer-boundary'};
test('sourced reviewer catalog exposes only its exact candidate, admitted sources and controller boundary',()=>{
  const scoped=sourcedResponseReviewEvidenceCatalog(sourcedContext,{targetArtifact:sourcedTarget,boundaryRuntimeObservation:sourcedBoundary});
  assert.deepEqual(scoped.map(({sourceKey,...identity})=>identity),[
    {kind:'artifact',id:'artifact:target',hash:'1'.repeat(64)},
    {kind:'runtime',id:'runtime-observation:boundary',hash:'7'.repeat(64)},
    {kind:'source',id:'source:one',hash:'3'.repeat(64)},
    {kind:'source',id:'source:two',hash:'4'.repeat(64)}
  ]);
  assert.deepEqual(scoped.map(entry=>entry.sourceKey),['o1','o2','o3','o4']);
  assert.equal(scoped.some(entry=>entry.kind==='tool'||entry.kind==='tool-history'),false);
  assert.equal(scoped.some(entry=>entry.id==='artifact:unrelated'||entry.id==='runtime-observation:other'),false);
  const reordered={...sourcedContext,artifacts:[...sourcedContext.artifacts].reverse(),sources:[...sourcedContext.sources].reverse(),
    toolObservations:[...sourcedContext.toolObservations].reverse(),runtimeObservations:[...sourcedContext.runtimeObservations].reverse()};
  assert.deepEqual(sourcedResponseReviewEvidenceCatalog(reordered,{targetArtifact:sourcedTarget,boundaryRuntimeObservation:sourcedBoundary}),scoped);
});
test('sourced reviewer catalog fails closed on malformed, duplicate or non-exact controller identities',()=>{
  const catalogFor=({context=sourcedContext,targetArtifact=sourcedTarget,boundaryRuntimeObservation=sourcedBoundary}={})=>
    sourcedResponseReviewEvidenceCatalog(context,{targetArtifact,boundaryRuntimeObservation});
  assert.throws(()=>catalogFor({targetArtifact:{...sourcedTarget,extra:'no'}}),{code:'REVIEW_ENCODING'});
  assert.throws(()=>catalogFor({targetArtifact:{...sourcedTarget,hash:'9'.repeat(64)}}),{code:'REVIEW_ENCODING'});
  assert.throws(()=>catalogFor({boundaryRuntimeObservation:{...sourcedBoundary,kind:'effect-inventory'}}),{code:'REVIEW_ENCODING'});
  assert.throws(()=>catalogFor({context:{...sourcedContext,sources:[...sourcedContext.sources,sourcedContext.sources[0]]}}),{code:'REVIEW_ENCODING'});
  assert.throws(()=>catalogFor({context:{...sourcedContext,artifacts:[...sourcedContext.artifacts,sourcedContext.artifacts[0]]}}),{code:'REVIEW_ENCODING'});
  assert.throws(()=>catalogFor({context:{...sourcedContext,runtimeObservations:[...sourcedContext.runtimeObservations,sourcedContext.runtimeObservations[0]]}}),{code:'REVIEW_ENCODING'});
  const tooManySources=Array.from({length:4999},(_,index)=>({id:`source:bound:${index}`,hash:index.toString(16).padStart(64,'0')}));
  assert.throws(()=>catalogFor({context:{...sourcedContext,sources:tooManySources}}),{code:'REVIEW_ENCODING'});
});
