import {check,clone,sha256} from './contracts.mjs';

// Named selections are immutable versions, not a mutable pointer consulted on
// resume. No tools, model, effort or parallelism are expanded. V2 explicitly
// selects one bounded reviewed method-revision round, never a hidden reset.
const freeze=value=>{if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value;};
export const MISSION_PRESETS=freeze({
  'adaptive-v1':{instructionProfile:'scoped-v1',contextEncoding:'lossless-json-v2',reviewEncoding:'evidence-catalog-v1',entryMode:'closed-response-v1'},
  'adaptive-v2':{instructionProfile:'scoped-v1',contextEncoding:'lossless-json-v2',reviewEncoding:'evidence-catalog-v1',entryMode:'closed-response-v2',
    cardEncoding:'compact-json-v1',producerContext:'node-contract-v1',planningContracts:{mode:'on-demand-v1',maxCalls:12},
    producerBatch:'read-test-cursor-v1',methodRecovery:{mode:'reviewed-method-v1',maxRounds:1}},
  // V3 is an admission selector rather than another fixed closed entry.  The
  // engine binds the selected mode, target and signed route for each mission;
  // therefore this preset intentionally does not contain entryMode.
  'adaptive-v3':{instructionProfile:'scoped-v1',contextEncoding:'lossless-json-v2',reviewEncoding:'evidence-catalog-v1',
    cardEncoding:'compact-json-v1',producerContext:'node-contract-v1',planningContracts:{mode:'on-demand-v1',maxCalls:12},
    producerBatch:'read-test-cursor-v1',methodRecovery:{mode:'reviewed-method-v1',maxRounds:1},routingMode:'deterministic-adaptive-v3'}
});
export function resolveMissionPreset(input){
  const {preset,...supplied}=input;
  if(preset===undefined)return {options:supplied,selection:null};
  check(typeof preset==='string'&&Object.hasOwn(MISSION_PRESETS,preset),'POLICY','Unknown versioned mission preset');
  const overrides=Object.fromEntries(Object.entries(supplied).filter(([,value])=>value!==undefined));
  const definition=MISSION_PRESETS[preset];
  return {options:{...clone(definition),...overrides},selection:{presetId:preset,definition:clone(definition),definitionHash:sha256(definition),explicitOverrides:Object.keys(overrides).sort()}};
}
