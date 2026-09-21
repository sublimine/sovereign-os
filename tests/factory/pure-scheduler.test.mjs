import test from 'node:test';
import assert from 'node:assert/strict';
import {selectPureReadyBatch} from '../../factory/lib/pure-scheduler.mjs';
const node=(id,dependencies=[],tools=[],requiredEffects=[])=>({id,dependencies:dependencies.map(nodeId=>({nodeId})),tools,requiredEffects});
const ready=spec=>({nodeId:spec.id,spec});
test('parallel selector bounds ready pure work without changing order, roles or dependencies',()=>{
  const nodes=['a','b','c','d','e'].map(id=>node(id)),plan={nodes};
  assert.deepEqual(selectPureReadyBatch({ready:nodes.map(ready),plan,limit:2}).map(n=>n.nodeId),['a','b']);
  assert.equal(selectPureReadyBatch({ready:nodes.map(ready),plan}).length,1);
  assert.equal(selectPureReadyBatch({ready:nodes.map(ready),plan,limit:4}).length,4);
  assert.deepEqual(selectPureReadyBatch({ready:[],plan,limit:2}),[]);
  for(const limit of [0,5,1.5,'2',null])assert.throws(()=>selectPureReadyBatch({ready:nodes.map(ready),plan,limit}));
});
test('tools, required effects and any effect-bearing ancestor keep work exclusive',()=>{
  for(const effect of [node('effect',[],['workspace.read']),node('effect',[],[],[{type:'file'}]),node('effect',[],['source.fetch'])]){
    const a=node('a'),b=node('b'),child=node('child',['effect']),grandchild=node('grandchild',['child']);
    const plan={nodes:[effect,a,b,child,grandchild]};
    assert.deepEqual(selectPureReadyBatch({ready:[effect,a,b].map(ready),plan,limit:4}).map(n=>n.nodeId),['effect']);
    assert.deepEqual(selectPureReadyBatch({ready:[grandchild,a,b].map(ready),plan,limit:4}).map(n=>n.nodeId),['grandchild']);
    assert.deepEqual(selectPureReadyBatch({ready:[a,grandchild,b].map(ready),plan,limit:4}).map(n=>n.nodeId),['a','b']);
  }
});
test('selector rejects a ready spec outside the frozen plan and malformed pure ancestry',()=>{
  const a=node('a'),b=node('b',['missing']),cycle=node('cycle',['cycle']);
  assert.throws(()=>selectPureReadyBatch({ready:[ready({...a,tools:['workspace.write']})],plan:{nodes:[a]},limit:2}),{code:'SCHEDULER'});
  assert.throws(()=>selectPureReadyBatch({ready:[ready(b)],plan:{nodes:[b]},limit:2}),{code:'SCHEDULER'});
  assert.throws(()=>selectPureReadyBatch({ready:[ready(cycle)],plan:{nodes:[cycle]},limit:2}),{code:'SCHEDULER'});
});
