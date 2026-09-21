import test from 'node:test';
import assert from 'node:assert/strict';
import {portfolioOracle,portfolioCases,compareIds} from '../../reconstruction/verification/portfolio-case.mjs';
test('independent portfolio oracle honors robust objective, closure, asymmetry and prefix tie',()=>{
  const cs=portfolioCases();assert.equal(cs.length,226);assert.deepEqual(cs,portfolioCases());
  assert.deepEqual(cs[1].expected.value.selected,['b','c']);
  assert.equal(cs[2].expected.value.feasible,false);
  assert.deepEqual(cs[3].expected.value.selected,['constructor']);
  assert.deepEqual(cs[4].expected.value.selected,['balanced']);
  assert.deepEqual(cs[5].expected.value.selected,['a']);
  assert.equal(cs[6].expected.value.feasible,false);
  assert.equal(cs[8].expected.value.selected.length,16);
  assert(compareIds(['a'],['a','b'])<0);
  for(const c of cs){const before=structuredClone(c.input);if(c.expected.error)assert.throws(()=>portfolioOracle(c.input),{code:'PORTFOLIO_INVALID'});else assert.deepEqual(portfolioOracle(c.input),c.expected.value);assert.deepEqual(c.input,before);}
  for(let i=9;i<201;i+=2)assert.deepEqual(cs[i].expected,cs[i+1].expected);
});
