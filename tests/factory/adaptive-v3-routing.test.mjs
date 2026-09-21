import test from 'node:test';
import assert from 'node:assert/strict';
import {canonical,sha256} from '../../factory/lib/contracts.mjs';
import {ADAPTIVE_V3_ADMISSION_METADATA,ADAPTIVE_V3_CLOSED_MATERIALIZATION_PREFLIGHT_SCHEMA,ADAPTIVE_V3_DIRECT_ENTRY_MODE,ADAPTIVE_V3_FINAL_POLICY_SCHEMA,
  ADAPTIVE_V3_PLANNED_ENTRY_MODE,ADAPTIVE_V3_ROUTE_DECISION_SCHEMA,ADAPTIVE_V3_SELECTOR_CATALOG_HASH,
  selectAdaptiveV3Route,verifyAdaptiveV3Route} from '../../factory/lib/adaptive-v3-routing.mjs';

const literal=(transform,payload)=>`LITERAL-TRANSFORM/1 ${transform}\n<<<\n${payload}\n>>>`;
const routeInput=overrides=>({
  intent:literal('uppercase-ascii-v1','hello'),
  metadata:ADAPTIVE_V3_ADMISSION_METADATA,
  inputManifestHash:null,
  requestedEntryMode:null,
  requestedModel:'gpt-6-terra',
  requestedReasoningEffort:'high',
  executionTarget:{model:'gpt-6-terra',reasoningEffort:'high'},
  ...overrides
});
const materialization=(input,status='READY')=>{
  const decision=selectAdaptiveV3Route(input);
  return {schema:ADAPTIVE_V3_CLOSED_MATERIALIZATION_PREFLIGHT_SCHEMA,revision:1,status,
    intentHash:decision.intentHash,inputManifestHash:null,selectorCatalogHash:decision.selectorCatalogHash,
    admissionDecisionHash:decision.admissionDecisionHash,admissionPolicyHash:decision.admissionPolicyHash,
    outputHash:status==='READY'?'b'.repeat(64):null};
};

test('the frozen selector gives a deterministic direct route with an acyclic static policy and exact target constraints',()=>{
  const input=routeInput(),result=selectAdaptiveV3Route(input);
  assert.equal(result.schema,ADAPTIVE_V3_ROUTE_DECISION_SCHEMA);
  assert.equal(result.selectedEntryMode,ADAPTIVE_V3_DIRECT_ENTRY_MODE);
  assert.equal(result.disposition,'DIRECT_AS_ADMITTED');
  assert.equal(result.selectorCatalogHash,ADAPTIVE_V3_SELECTOR_CATALOG_HASH);
  assert.equal(result.intentHash,sha256(input.intent));
  assert.equal(result.admissionDecisionHash,result.admissionDecision.decisionHash);
  assert.equal(result.closedMaterialization,null);
  assert.equal(result.closedMaterializationHash,sha256(null));
  assert.equal(result.staticPolicyHash,sha256(result.staticPolicyInput));
  assert.equal(result.finalPolicyHash,sha256(result.finalPolicy));
  assert.equal(result.finalPolicy.schema,ADAPTIVE_V3_FINAL_POLICY_SCHEMA);
  assert.equal(result.finalPolicy.entryMode,ADAPTIVE_V3_DIRECT_ENTRY_MODE);
  assert.equal(result.finalPolicy.staticPolicyHash,result.staticPolicyHash);
  assert.equal(Object.hasOwn(result.finalPolicy,'decisionHash'),false,'the final policy cannot form a route hash cycle');
  assert.deepEqual(result.executionTarget,input.executionTarget);
  assert.equal(result.requestedModel,'gpt-6-terra');
  assert.equal(result.requestedReasoningEffort,'high');
  assert.deepEqual(result,selectAdaptiveV3Route(JSON.parse(JSON.stringify(input))));
  assert.throws(()=>{result.selectedEntryMode=ADAPTIVE_V3_PLANNED_ENTRY_MODE;},TypeError);
});

test('a URL inside a fully delimited literal payload remains inert under the frozen grammar',()=>{
  const input=routeInput({intent:literal('identity-utf8-v1','https://example.test/current-weather?source=untrusted')});
  const result=selectAdaptiveV3Route(input);
  assert.equal(result.selectedEntryMode,ADAPTIVE_V3_DIRECT_ENTRY_MODE);
  assert.equal(result.admissionDecision.route,'CLOSED');
  assert.equal(result.admissionDecision.proof.ast.payload,'https://example.test/current-weather?source=untrusted');
});

test('the frozen catalog admits only its finite formal operand set for direct formal derivations',()=>{
  const direct=selectAdaptiveV3Route(routeInput({intent:'FORMAL-DERIVATION/1\n(add-int-v1 2 (multiply-int-v1 3 5))'}));
  assert.equal(direct.selectedEntryMode,ADAPTIVE_V3_DIRECT_ENTRY_MODE);
  assert.equal(direct.admissionDecision.proof.grammar,'formal-derivation.v1');
  const planned=selectAdaptiveV3Route(routeInput({intent:'FORMAL-DERIVATION/1\n(add-int-v1 2 100)'}));
  assert.equal(planned.selectedEntryMode,ADAPTIVE_V3_PLANNED_ENTRY_MODE);
  assert.ok(planned.reasonCodes.includes('UNALLOWLISTED_FORMAL_OPERAND'));
});

test('an authenticated input manifest forces planning even when the closed grammar accepts the request',()=>{
  const input=routeInput({inputManifestHash:'a'.repeat(64)}),result=selectAdaptiveV3Route(input);
  assert.equal(result.admissionDecision.route,'CLOSED');
  assert.equal(result.selectedEntryMode,ADAPTIVE_V3_PLANNED_ENTRY_MODE);
  assert.equal(result.disposition,'PLANNED_FOR_INPUTS');
  assert.ok(result.reasonCodes.includes('INPUT_MANIFEST_PRESENT'));
  assert.throws(()=>selectAdaptiveV3Route({...input,requestedEntryMode:ADAPTIVE_V3_DIRECT_ENTRY_MODE}),{code:'ROUTE_OVERRIDE_WEAKENS'});
});

test('a strictly bound resource-limit preflight hardens closed grammar to planning before a provider is considered',()=>{
  const input=routeInput(),closedMaterialization=materialization(input,'RESOURCE_LIMIT');
  const ready=materialization(input);
  const readyResult=selectAdaptiveV3Route({...input,closedMaterialization:ready});
  assert.equal(readyResult.selectedEntryMode,ADAPTIVE_V3_DIRECT_ENTRY_MODE);
  assert.equal(readyResult.closedMaterializationHash,sha256(ready));
  const result=selectAdaptiveV3Route({...input,closedMaterialization});
  assert.equal(result.admissionDecision.route,'CLOSED');
  assert.equal(result.selectedEntryMode,ADAPTIVE_V3_PLANNED_ENTRY_MODE);
  assert.equal(result.disposition,'PLANNED_FOR_MATERIALIZATION_LIMIT');
  assert.equal(result.closedMaterializationHash,sha256(closedMaterialization));
  assert.ok(result.reasonCodes.includes('CLOSED_MATERIALIZATION_RESOURCE_LIMIT'));
  assert.throws(()=>selectAdaptiveV3Route({...input,closedMaterialization:{...closedMaterialization,intentHash:'0'.repeat(64)}}),
    {code:'ADAPTIVE_V3_ROUTING_INPUT'});
  assert.throws(()=>selectAdaptiveV3Route({...input,closedMaterialization:{...closedMaterialization,status:'READY'}}),
    {code:'ADAPTIVE_V3_ROUTING_INPUT'});
});

test('external facts, ambiguity, and requested effects all remain on the full planning route',()=>{
  for(const intent of ['¿Cuál es la capital actual de Francia?','Haz lo que quieras y decide tú.','Crea un archivo y despliega el resultado.']){
    const result=selectAdaptiveV3Route(routeInput({intent}));
    assert.equal(result.selectedEntryMode,ADAPTIVE_V3_PLANNED_ENTRY_MODE,intent);
    assert.equal(result.disposition,'PLANNED_BY_ADMISSION',intent);
    assert.ok(result.reasonCodes.includes('OUTSIDE_EXPLICIT_GRAMMAR'),canonical(result.reasonCodes));
  }
});

test('an explicit planned route may harden an otherwise direct result and records that disposition',()=>{
  const result=selectAdaptiveV3Route(routeInput({requestedEntryMode:ADAPTIVE_V3_PLANNED_ENTRY_MODE}));
  assert.equal(result.selectedEntryMode,ADAPTIVE_V3_PLANNED_ENTRY_MODE);
  assert.equal(result.disposition,'HARDENED_TO_PLANNED');
  assert.ok(result.reasonCodes.includes('EXPLICIT_PLANNED_HARDENING'));
  assert.equal(result.finalPolicy.entryMode,ADAPTIVE_V3_PLANNED_ENTRY_MODE);
});

test('closed v3 cannot weaken a planning requirement and legacy or other direct modes are out of scope',()=>{
  assert.throws(()=>selectAdaptiveV3Route(routeInput({intent:'What is the current weather?',requestedEntryMode:ADAPTIVE_V3_DIRECT_ENTRY_MODE})),
    {code:'ROUTE_OVERRIDE_WEAKENS'});
  for(const requestedEntryMode of ['closed-response-v1','closed-response-v2','bounded-read-v1','sourced-response-v1','anything-else']){
    assert.throws(()=>selectAdaptiveV3Route(routeInput({requestedEntryMode})),{code:'ROUTE_OVERRIDE_SCOPE'});
  }
  const direct=selectAdaptiveV3Route(routeInput({requestedEntryMode:ADAPTIVE_V3_DIRECT_ENTRY_MODE}));
  assert.equal(direct.selectedEntryMode,ADAPTIVE_V3_DIRECT_ENTRY_MODE);
});

test('metadata, target and model inputs never gain a default or silent substitution',()=>{
  const mismatched={...ADAPTIVE_V3_ADMISSION_METADATA,literalTransforms:['identity-utf8-v1']};
  const guarded=selectAdaptiveV3Route(routeInput({metadata:mismatched}));
  assert.equal(guarded.selectedEntryMode,ADAPTIVE_V3_PLANNED_ENTRY_MODE);
  assert.equal(guarded.disposition,'PLANNED_BY_SELECTOR_GUARD');
  assert.ok(guarded.reasonCodes.includes('ADMISSION_METADATA_MISMATCH'));
  assert.equal(selectAdaptiveV3Route(routeInput({metadata:null})).selectedEntryMode,ADAPTIVE_V3_PLANNED_ENTRY_MODE);
  assert.throws(()=>selectAdaptiveV3Route(routeInput({requestedModel:null})),{code:'ADAPTIVE_V3_ROUTING_INPUT'});
  assert.throws(()=>selectAdaptiveV3Route(routeInput({executionTarget:null})),{code:'ADAPTIVE_V3_ROUTING_INPUT'});
  assert.throws(()=>selectAdaptiveV3Route(routeInput({executionTarget:{model:'gpt-6-astra',reasoningEffort:'high'}})),{code:'ADAPTIVE_V3_ROUTING_INPUT'});
});

test('the verifier recomputes all bindings and rejects route, proof, policy, target and hash tampering',()=>{
  const input=routeInput(),result=selectAdaptiveV3Route(input);
  assert.deepEqual(verifyAdaptiveV3Route(input,result),JSON.parse(JSON.stringify(result)));
  const changes=[
    value=>{value.selectedEntryMode=ADAPTIVE_V3_PLANNED_ENTRY_MODE;},
    value=>{value.admissionDecision.proof.ast.payload='MUTATED';},
    value=>{value.staticPolicyInput.requestedModel='gpt-6-astra';},
    value=>{value.finalPolicy.executionTarget.model='gpt-6-astra';},
    value=>{value.selectorCatalogHash='0'.repeat(64);},
    value=>{value.decisionHash='0'.repeat(64);}
  ];
  for(const change of changes){
    const altered=JSON.parse(JSON.stringify(result));
    change(altered);
    assert.throws(()=>verifyAdaptiveV3Route(input,altered),{code:'ADAPTIVE_V3_ROUTE_INTEGRITY'});
  }
});
