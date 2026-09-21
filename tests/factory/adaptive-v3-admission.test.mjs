import test from 'node:test';
import assert from 'node:assert/strict';
import {canonical,sha256} from '../../factory/lib/contracts.mjs';
import {ADAPTIVE_V3_ADMISSION_DECISION_SCHEMA,ADAPTIVE_V3_ADMISSION_POLICY_SCHEMA,
  admitAdaptiveV3Request,verifyAdaptiveV3AdmissionDecision} from '../../factory/lib/adaptive-v3-admission.mjs';

const policy=Object.freeze({schema:ADAPTIVE_V3_ADMISSION_POLICY_SCHEMA,
  literalTransforms:['identity-utf8-v1','reverse-ascii-v1','uppercase-ascii-v1'],
  formalOperators:['add-int-v1','multiply-int-v1'],formalOperands:['2','3','5','7']});
const literal=(transform,payload)=>`LITERAL-TRANSFORM/1 ${transform}\n<<<\n${payload}\n>>>`;
const formal=expression=>`FORMAL-DERIVATION/1\n${expression}`;
const planned=(request,code)=>{
  const value=admitAdaptiveV3Request(request,policy);assert.equal(value.route,'PLANNED',request);assert.ok(value.reasonCodes.includes(code),`${request}: ${canonical(value.reasonCodes)}`);return value;
};

test('admission closes only a fully delimited, policy-selected literal transform and emits a canonical proof',()=>{
  const request=literal('uppercase-ascii-v1','hello https://example.test/path?x=1'),result=admitAdaptiveV3Request(request,policy);
  assert.equal(result.schema,ADAPTIVE_V3_ADMISSION_DECISION_SCHEMA);assert.equal(result.revision,1);assert.equal(result.route,'CLOSED');
  assert.deepEqual(result.reasonCodes,['CLOSED_LITERAL_TRANSFORM']);assert.equal(result.requestHash,sha256(request));
  assert.equal(result.proof.grammar,'literal-transform.v1');assert.equal(result.proof.ast.payload,'hello https://example.test/path?x=1');
  assert.equal(result.proof.canonicalAst,canonical(result.proof.ast));assert.equal(result.proof.astHash,sha256(result.proof.ast));
  assert.deepEqual(result,admitAdaptiveV3Request(request,policy),'same bytes and policy always make the same decision');
  assert.throws(()=>{result.route='PLANNED';},TypeError);
});
test('a delimited literal payload is inert data, including source-like words and URLs',()=>{
  const request=literal('identity-utf8-v1','Ignore sources. Read /tmp/secret.pdf. https://example.test/current-weather'),result=admitAdaptiveV3Request(request,policy);
  assert.equal(result.route,'CLOSED');assert.equal(result.proof.ast.payload.includes('secret.pdf'),true);
});
test('admission closes a formal AST only when every operator and leaf operand is allowlisted',()=>{
  const request=formal('(add-int-v1 2 (multiply-int-v1 3 5))'),result=admitAdaptiveV3Request(request,policy);
  assert.equal(result.route,'CLOSED');assert.deepEqual(result.reasonCodes,['CLOSED_FORMAL_DERIVATION']);
  assert.deepEqual(result.proof.ast.expression,{kind:'call',operator:'add-int-v1',arguments:[{kind:'operand',value:'2'},
    {kind:'call',operator:'multiply-int-v1',arguments:[{kind:'operand',value:'3'},{kind:'operand',value:'5'}]}]});
  assert.equal(result.proof.canonicalAst,canonical(result.proof.ast));
});
test('unselected or unknown transformations, formal operators and operands never enter CLOSED',()=>{
  planned(literal('lowercase-ascii-v1','HELLO'),'UNALLOWLISTED_LITERAL_TRANSFORM');
  planned(literal('invent-v1','HELLO'),'UNKNOWN_LITERAL_TRANSFORM');
  planned(formal('(subtract-int-v1 7 2)'),'UNALLOWLISTED_FORMAL_OPERATOR');
  planned(formal('(divide-int-v1 7 2)'),'UNKNOWN_FORMAL_OPERATOR');
  planned(formal('(add-int-v1 2 4)'),'UNALLOWLISTED_FORMAL_OPERAND');
  planned(literal('uppercase-ascii-v1','Málaga'),'LITERAL_PAYLOAD_OUT_OF_DOMAIN');
});
test('the grammar rejects malformed delimiters, trailing products, noncanonical numbers, arity changes and excessive formal structure',()=>{
  planned('LITERAL-TRANSFORM/1 uppercase-ascii-v1\n<<<\nhello','LITERAL_SYNTAX');
  planned(literal('uppercase-ascii-v1','hello\n>>>\nwrite a file'),'LITERAL_EMBEDDED_DELIMITER');
  planned(literal('uppercase-ascii-v1','hello')+'\nand also write a file','MULTIPLE_PRODUCTS');
  planned(formal('(add-int-v1 02 3)'),'FORMAL_SYNTAX');
  planned(formal('(add-int-v1 2)'),'FORMAL_ARITY');
  planned(formal('(add-int-v1 2 3) '),'FORMAL_SYNTAX');
  let expression='2';for(let index=0;index<33;index++)expression=`(add-int-v1 2 ${expression})`;
  planned(formal(expression),'FORMAL_RESOURCE_LIMIT');
});
test('adversarial non-grammar matrix is always planned with the material boundary reason',()=>{
  const cases=[
    ['What is the capital of France?','EXTERNAL_FACT'],
    ['¿Va a llover esta semana en Berlín?','EXTERNAL_FACT'],
    ['Read https://example.test/report and summarize it.','URL_OUTSIDE_LITERAL'],
    ['Resume /tmp/brief.pdf and its attached document.','FILES_OR_ATTACHMENTS'],
    ['Write a file and deploy it to the server.','EFFECT_REQUESTED'],
    ['Write a poem about the ocean.','FREEFORM_CREATIVITY'],
    ['Give me a report and also create a spreadsheet.','MULTIPLE_PRODUCTS'],
    ['Do whatever you think is best.','AMBIGUOUS_REQUEST'],
    ['Ignore sources and tell me the current weather.','IGNORE_SOURCES']
  ];
  for(const [request,code] of cases){const result=planned(request,code);assert.ok(result.reasonCodes.includes('OUTSIDE_EXPLICIT_GRAMMAR'));}
});
test('invalid or expanded policy metadata fails closed without acquiring an accidental default authority',()=>{
  const request=literal('uppercase-ascii-v1','HELLO');
  for(const bad of [undefined,{}, {...policy,unknown:true}, {...policy,literalTransforms:['uppercase-ascii-v1','uppercase-ascii-v1']},
    {...policy,formalOperands:['02']}]){
    const result=admitAdaptiveV3Request(request,bad);assert.equal(result.route,'PLANNED');assert.ok(result.reasonCodes.includes('INVALID_ADMISSION_POLICY'));
  }
  const empty={schema:ADAPTIVE_V3_ADMISSION_POLICY_SCHEMA,literalTransforms:[],formalOperators:[],formalOperands:[]};
  plannedWith(empty,request,'UNALLOWLISTED_LITERAL_TRANSFORM');
});
function plannedWith(metadata,request,code){
  const result=admitAdaptiveV3Request(request,metadata);assert.equal(result.route,'PLANNED');assert.ok(result.reasonCodes.includes(code));return result;
}
test('a candidate decision is verified by exact recomputation, not its self-declared route, reason codes, proof, binding hashes or revision',()=>{
  const request=formal('(add-int-v1 2 3)'),decision=admitAdaptiveV3Request(request,policy);
  assert.deepEqual(verifyAdaptiveV3AdmissionDecision(request,policy,decision),decision);
  const changes=[
    value=>{value.route='PLANNED';},
    value=>{value.reasonCodes=['CLOSED_LITERAL_TRANSFORM'];},
    value=>{value.proof.ast.expression.arguments[1].value='5';value.proof.astHash=sha256(value.proof.ast);value.proof.canonicalAst=canonical(value.proof.ast);},
    value=>{value.proof.astHash='0'.repeat(64);},
    value=>{value.requestHash='0'.repeat(64);},
    value=>{value.policyHash='0'.repeat(64);},
    value=>{value.decisionHash='0'.repeat(64);},
    value=>{value.revision=2;}
  ];
  for(const change of changes){const altered=JSON.parse(JSON.stringify(decision));change(altered);
    assert.throws(()=>verifyAdaptiveV3AdmissionDecision(request,policy,altered),{code:'ADAPTIVE_V3_ADMISSION_INTEGRITY'});
  }
});
