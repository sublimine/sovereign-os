import test from 'node:test';
import assert from 'node:assert/strict';
import {facetCases,inputFor,schemaFor,validateResponse,grade,equalProbe} from '../../reconstruction/verification/facet-ablation-cases.mjs';
const answer=(c,v)=>({decision:Object.values(v.expected).every(x=>x==='PASS')?'ACCEPT':'RETURN',checks:c.criteria.map(k=>({criterionId:k.id,verdict:v.expected[k.id],reason:'Synthetic oracle fixture, not a semantic evaluation.',support:[{sourceId:c.sources[0].id,quote:c.sources[0].raw}]})),probes:Object.entries(c.expectedProbes).map(([id,value])=>({id,value}))});
test('facet cases balance correct/incorrect candidates, keep oracle and role hints outside input',()=>{
  assert.equal(facetCases.length,4);
  for(const c of facetCases){assert.equal(c.variants.length,2);assert.equal(c.variants.filter(v=>Object.values(v.expected).every(x=>x==='PASS')).length,1);
    for(const v of c.variants){const input=inputFor(c,v);assert.deepEqual(Object.keys(input),['dataClassification','requirement','criteria','sources','candidate','probes']);assert.equal(input.expected,undefined);assert.equal(input.facet,undefined);assert.equal(input.variant,undefined);assert.equal(input.id,undefined);
      assert.deepEqual(Object.keys(v.expected).sort(),c.criteria.map(k=>k.id).sort());assert.deepEqual(Object.keys(c.expectedProbes).sort(),c.probes.map(k=>k.id).sort());assert.equal(schemaFor(c).additionalProperties,false);assert.equal(grade(answer(c,v),c,v).passed,true);}}
});
test('facet oracle rejects vacuous/duplicate checks, forged quotes and correct labels with wrong independent probes',()=>{
  for(const c of facetCases)for(const v of c.variants){
    for(const change of [a=>a.checks=[],a=>a.checks[0].support=[],a=>a.checks[0].support[0].quote='NOT A SOURCE PASSAGE',a=>a.probes[0].value='not-the-answer',a=>a.checks[1].criterionId=a.checks[0].criterionId,a=>a.probes[1].id=a.probes[0].id,a=>a.checks[0].verdict='UNKNOWN',a=>a.extra=true]){const a=answer(c,v);change(a);assert.equal(grade(a,c,v).passed,false);}
    assert.equal(validateResponse(answer(c,v),c),true);
  }
});
test('numerical oracle is independently recomputed from the stipulated units and prospective bins',()=>{
  const mass=facetCases.find(c=>c.id==='bounded-measurement');assert.equal((9.95+1990/1000).toFixed(2),mass.expectedProbes.lowerGrams);assert.equal((10.05+2010/1000).toFixed(2),mass.expectedProbes.upperGrams);
  assert.equal(293.15-273.15,20);assert.equal((68-32)*5/9,20);
  const predictions=[...Array(40).fill(0.25),...Array(40).fill(0.75)],outcomes=[...Array(20).fill(1),...Array(20).fill(0),...Array(20).fill(1),...Array(20).fill(0)];
  const scoring=facetCases.find(c=>c.id==='pooled-calibration');assert.equal(String(predictions.reduce((s,p,i)=>s+(p-outcomes[i])**2,0)/80),scoring.expectedProbes.brier);assert.equal(String(outcomes.reduce((s,y)=>s+(0.5-y)**2,0)/80),scoring.expectedProbes.comparatorBrier);
});
test('probe comparison accepts exact decimal formatting but no rounding-away of an unequal value',()=>{
  assert.equal(equalProbe('+0012.0600','12.06'),true);assert.equal(equalProbe('0.500','0.5'),true);assert.equal(equalProbe('12.0600000000000000001','12.06'),false);
  assert.equal(equalProbe('','0'),false);assert.equal(equalProbe('NaN','0'),false);assert.equal(equalProbe('false','0'),false);assert.equal(equalProbe('-0.000','0'),true);
});
