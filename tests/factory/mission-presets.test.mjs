import test from 'node:test';
import assert from 'node:assert/strict';
import {resolveMissionPreset,MISSION_PRESETS} from '../../factory/lib/mission-presets.mjs';
import {sha256} from '../../factory/lib/contracts.mjs';
test('versioned adaptive preset expands only four explicit mechanisms, never permissions or model',()=>{
  const resolved=resolveMissionPreset({preset:'adaptive-v1'});
  assert.deepEqual(resolved.options,{instructionProfile:'scoped-v1',contextEncoding:'lossless-json-v2',reviewEncoding:'evidence-catalog-v1',entryMode:'closed-response-v1'});
  assert.equal(resolved.selection.definitionHash,sha256(MISSION_PRESETS['adaptive-v1']));
  assert.equal(resolved.options.allowedTools,undefined);assert.equal(resolved.options.model,undefined);assert.equal(resolved.options.maxParallelPureNodes,undefined);
});
test('explicit task constraints override preset and its definition remains immutable',()=>{
  const input={preset:'adaptive-v1',entryMode:'planned',allowedTools:[],contextEncoding:undefined};
  const resolved=resolveMissionPreset(input);assert.equal(resolved.options.entryMode,'planned');assert.deepEqual(resolved.options.allowedTools,[]);
  assert.equal(resolved.options.contextEncoding,'lossless-json-v2');assert.deepEqual(resolved.selection.explicitOverrides,['allowedTools','entryMode']);
  assert.equal(input.preset,'adaptive-v1');resolved.selection.definition.entryMode='bad';
  assert.equal(MISSION_PRESETS['adaptive-v1'].entryMode,'closed-response-v1');
});
test('adaptive v3 selects the routing controller without silently fixing a direct entry mode',()=>{
  const resolved=resolveMissionPreset({preset:'adaptive-v3'});
  assert.equal(resolved.options.routingMode,'deterministic-adaptive-v3');
  assert.equal(Object.hasOwn(resolved.options,'entryMode'),false);
  assert.equal(resolved.selection.definitionHash,sha256(MISSION_PRESETS['adaptive-v3']));
  for(const key of ['model','reasoningEffort','allowedTools','maxParallelPureNodes','inferenceBudget','documentContext'])assert.equal(resolved.options[key],undefined);
  assert.throws(()=>{MISSION_PRESETS['adaptive-v3'].routingMode='changed';},TypeError);
});
test('missing preset preserves compatibility and unknown versions fail closed',()=>{
  assert.deepEqual(resolveMissionPreset({model:'chosen',allowedTools:[]}),{options:{model:'chosen',allowedTools:[]},selection:null});
  for(const preset of ['','missing','toString','__proto__',null,42])assert.throws(()=>resolveMissionPreset({preset}),{code:'POLICY'});
});
