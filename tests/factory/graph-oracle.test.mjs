import test from 'node:test';
import assert from 'node:assert/strict';
import {oracle,graphCases} from '../../reconstruction/verification/graph-oracle.mjs';
test('independent graph qualification oracle handles frontier, longest depth and full zero-duration paths',()=>{
  assert.deepEqual(oracle([]),{order:[],layers:[],criticalPath:[],totalDuration:0});
  const nodes=[{id:'a',dependencies:[],duration:0},{id:'b',dependencies:['a'],duration:0},{id:'z',dependencies:['a','b'],duration:0}];
  assert.deepEqual(oracle(nodes),{order:['a','b','z'],layers:[['a'],['b'],['z']],criticalPath:['a','b','z'],totalDuration:0});
  assert.deepEqual(oracle([{id:'z',dependencies:[],duration:2},{id:'a',dependencies:[],duration:1},{id:'b',dependencies:['a'],duration:1}]).criticalPath,['a','b']);
  const cases=graphCases();assert.equal(cases.length,174);assert.deepEqual(cases,graphCases());assert.equal(new Set(cases.map(c=>c.id)).size,cases.length);
});
