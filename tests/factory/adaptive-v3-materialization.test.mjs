import test from 'node:test';
import assert from 'node:assert/strict';
import {canonical,sha256} from '../../factory/lib/contracts.mjs';
import {ADAPTIVE_V3_ADMISSION_POLICY_SCHEMA,admitAdaptiveV3Request} from '../../factory/lib/adaptive-v3-admission.mjs';
import {ADAPTIVE_V3_CLOSED_OUTPUT_MAX_BYTES,ADAPTIVE_V3_CLOSED_OUTPUT_MAX_DECIMAL_BYTES,
  ADAPTIVE_V3_CLOSED_OUTPUT_REVISION,ADAPTIVE_V3_CLOSED_OUTPUT_SCHEMA,
  materializeAdaptiveV3ClosedOutput,verifyAdaptiveV3ClosedOutput} from '../../factory/lib/adaptive-v3-materialization.mjs';

const policy=Object.freeze({schema:ADAPTIVE_V3_ADMISSION_POLICY_SCHEMA,
  literalTransforms:['identity-utf8-v1','lowercase-ascii-v1','reverse-ascii-v1','trim-ascii-v1','uppercase-ascii-v1'],
  formalOperators:['add-int-v1','multiply-int-v1','negate-int-v1','subtract-int-v1'],
  formalOperands:['0','2','3','5','7','9']});
const literal=(transform,payload)=>`LITERAL-TRANSFORM/1 ${transform}\n<<<\n${payload}\n>>>`;
const formal=expression=>`FORMAL-DERIVATION/1\n${expression}`;
const output=(request,metadata=policy)=>{
  const decision=admitAdaptiveV3Request(request,metadata);return {decision,value:materializeAdaptiveV3ClosedOutput(request,metadata,decision)};
};
const resealOutput=candidate=>{const {outputHash,...base}=candidate;candidate.outputHash=sha256(base);};

test('literal closed output has exact documented byte semantics and no provider-shaped authority',()=>{
  const vectors=[
    ['identity-utf8-v1','Málaga 🜁','Málaga 🜁'],
    ['uppercase-ascii-v1','aZ 9\r\n','AZ 9\r\n'],
    ['lowercase-ascii-v1','aZ 9\r\n','az 9\r\n'],
    ['reverse-ascii-v1','aBc 19','91 cBa'],
    ['trim-ascii-v1','\t \r\nhello world \n\r\t','hello world'],
    ['trim-ascii-v1','\t \r\n','']
  ];
  for(const [transform,payload,body] of vectors){
    const request=literal(transform,payload),{decision,value}=output(request);
    assert.equal(decision.route,'CLOSED');assert.equal(value.body,body);assert.equal(value.kind,'literal-transform');
    assert.equal(value.bodyHash,sha256(body));assert.equal(value.admissionDecisionHash,decision.decisionHash);
    assert.equal(value.astHash,decision.proof.astHash);assert.equal(value.admissionProofHash,sha256(decision.proof));
    assert.equal(value.schema,ADAPTIVE_V3_CLOSED_OUTPUT_SCHEMA);assert.equal(value.revision,ADAPTIVE_V3_CLOSED_OUTPUT_REVISION);
    assert.equal(Object.hasOwn(value,'provider'),false);assert.equal(Object.hasOwn(value,'receipt'),false);assert.equal(Object.isFrozen(value),true);
    assert.deepEqual(verifyAdaptiveV3ClosedOutput(request,policy,decision,value),value);
  }
});

test('formal output is exact signed canonical decimal with no prose or markdown',()=>{
  const vectors=[
    ['(add-int-v1 2 (multiply-int-v1 3 5))','17'],
    ['(subtract-int-v1 2 5)','-3'],
    ['(multiply-int-v1 (negate-int-v1 7) 3)','-21'],
    ['(negate-int-v1 0)','0']
  ];
  for(const [expression,body] of vectors){
    const request=formal(expression),{decision,value}=output(request);
    assert.equal(value.kind,'formal-derivation');assert.equal(value.body,body);assert.match(value.body,/^-?(?:0|[1-9][0-9]*)$/);
    assert.equal(value.body.includes('\n'),false);assert.equal(value.admissionProof.astHash,value.astHash);
    assert.deepEqual(materializeAdaptiveV3ClosedOutput(request,policy,decision),value);
  }
});

test('non-CLOSED or altered admission never turns into an exact output',()=>{
  const plannedRequest='What is the current capital of France?',planned=admitAdaptiveV3Request(plannedRequest,policy);
  assert.equal(planned.route,'PLANNED');assert.throws(()=>materializeAdaptiveV3ClosedOutput(plannedRequest,policy,planned),
    {code:'ADAPTIVE_V3_CLOSED_OUTPUT_ROUTE'});
  const request=formal('(add-int-v1 2 3)'),decision=admitAdaptiveV3Request(request,policy);
  for(const change of [
    value=>{value.route='PLANNED';},
    value=>{value.decisionHash='0'.repeat(64);},
    value=>{value.proof.ast.expression.arguments[1].value='5';value.proof.astHash=sha256(value.proof.ast);value.proof.canonicalAst=canonical(value.proof.ast);}
  ]){
    const altered=JSON.parse(JSON.stringify(decision));change(altered);
    assert.throws(()=>materializeAdaptiveV3ClosedOutput(request,policy,altered),{code:'ADAPTIVE_V3_ADMISSION_INTEGRITY'});
  }
});

test('the text and preflighted arithmetic budgets fail closed rather than truncate',()=>{
  const largeText='x'.repeat(ADAPTIVE_V3_CLOSED_OUTPUT_MAX_BYTES+1),literalRequest=literal('identity-utf8-v1',largeText),literalDecision=admitAdaptiveV3Request(literalRequest,policy);
  assert.equal(literalDecision.route,'CLOSED');assert.throws(()=>materializeAdaptiveV3ClosedOutput(literalRequest,policy,literalDecision),
    {code:'ADAPTIVE_V3_CLOSED_OUTPUT_RESOURCE_LIMIT'});
  const factor='9'.repeat(128),numericPolicy={schema:ADAPTIVE_V3_ADMISSION_POLICY_SCHEMA,
    literalTransforms:[],formalOperators:['multiply-int-v1'],formalOperands:[factor]};
  const multiply=values=>values.length===1?values[0]:`(multiply-int-v1 ${multiply(values.slice(0,values.length/2))} ${multiply(values.slice(values.length/2))})`;
  const numericRequest=formal(multiply(Array.from({length:128},()=>factor))),numericDecision=admitAdaptiveV3Request(numericRequest,numericPolicy);
  assert.equal(numericDecision.route,'CLOSED');assert.ok(128*128>ADAPTIVE_V3_CLOSED_OUTPUT_MAX_DECIMAL_BYTES);
  assert.throws(()=>materializeAdaptiveV3ClosedOutput(numericRequest,numericPolicy,numericDecision),
    {code:'ADAPTIVE_V3_CLOSED_OUTPUT_RESOURCE_LIMIT'});
});

test('candidate output cannot alter body, proof, hash, revision or record fields',()=>{
  const request=formal('(subtract-int-v1 2 5)'),{decision,value}=output(request);
  const changes=[
    candidate=>{candidate.body='3';},
    candidate=>{candidate.body='3';candidate.bodyHash=sha256(candidate.body);resealOutput(candidate);},
    candidate=>{candidate.bodyHash='0'.repeat(64);},
    candidate=>{candidate.admissionDecisionHash='0'.repeat(64);resealOutput(candidate);},
    candidate=>{candidate.astHash='0'.repeat(64);},
    candidate=>{candidate.admissionProofHash='0'.repeat(64);},
    candidate=>{candidate.admissionProof.ast.expression.arguments[1].value='3';candidate.admissionProof.canonicalAst=canonical(candidate.admissionProof.ast);candidate.admissionProof.astHash=sha256(candidate.admissionProof.ast);candidate.astHash=candidate.admissionProof.astHash;candidate.admissionProofHash=sha256(candidate.admissionProof);resealOutput(candidate);},
    candidate=>{candidate.revision=2;},
    candidate=>{candidate.revision=2;resealOutput(candidate);},
    candidate=>{candidate.outputHash='0'.repeat(64);},
    candidate=>{candidate.extra='not allowed';}
  ];
  for(const change of changes){const candidate=JSON.parse(JSON.stringify(value));change(candidate);
    assert.throws(()=>verifyAdaptiveV3ClosedOutput(request,policy,decision,candidate),error=>
      error?.code==='ADAPTIVE_V3_CLOSED_OUTPUT_INTEGRITY'||error?.code==='SCHEMA');
  }
});
