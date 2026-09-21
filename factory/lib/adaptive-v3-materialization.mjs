// Deterministic materialization for the deliberately tiny adaptive-v3 CLOSED
// language.  It owns no provider, tool, clock, state or side effect: an exact
// admission decision is the sole authority to turn a request into an answer.
import {canonical,check,clone,digest,keys,list,object,sha256,string} from './contracts.mjs';
import {ADAPTIVE_V3_ADMISSION_DECISION_SCHEMA,ADAPTIVE_V3_ADMISSION_PROOF_SCHEMA,
  ADAPTIVE_V3_FORMAL_OPERATORS,ADAPTIVE_V3_LITERAL_TRANSFORMS,
  verifyAdaptiveV3AdmissionDecision} from './adaptive-v3-admission.mjs';

export const ADAPTIVE_V3_CLOSED_OUTPUT_SCHEMA='sovereign.adaptive-v3-closed-output.v1';
export const ADAPTIVE_V3_CLOSED_OUTPUT_REVISION=1;
// Text output can be useful up to 20 KiB. Arithmetic gets a tighter 12 KiB
// decimal budget so a formally admitted expression cannot consume the whole
// text envelope in intermediate BigInt products. Neither limit truncates.
export const ADAPTIVE_V3_CLOSED_OUTPUT_MAX_BYTES=20*1024;
export const ADAPTIVE_V3_CLOSED_OUTPUT_MAX_DECIMAL_BYTES=12*1024;

const LITERAL_MAX_BYTES=64*1024;
const FORMAL_MAX_DEPTH=32;
const FORMAL_MAX_NODES=256;
const FORMAL_MAX_INTEGER_DIGITS=128;
const OUTPUT_FIELDS=Object.freeze(['admissionDecisionHash','admissionProof','admissionProofHash','admissionReasonCodes',
  'astHash','body','bodyHash','grammar','kind','outputHash','policyHash','requestHash','revision','route','schema']);
const freeze=value=>{if(value&&typeof value==='object'&&!Object.isFrozen(value)){Object.values(value).forEach(freeze);Object.freeze(value);}return value;};
const integrity=(condition,message,details={})=>check(condition,'ADAPTIVE_V3_CLOSED_OUTPUT_INTEGRITY',message,details);
const resource=(condition,message,details={})=>check(condition,'ADAPTIVE_V3_CLOSED_OUTPUT_RESOURCE_LIMIT',message,details);
const isScalarText=value=>{
  for(let index=0;index<value.length;index++){
    const code=value.charCodeAt(index);
    if(code>=0xd800&&code<=0xdbff){if(index+1>=value.length||value.charCodeAt(index+1)<0xdc00||value.charCodeAt(index+1)>0xdfff)return false;index++;}
    else if(code>=0xdc00&&code<=0xdfff)return false;
  }
  return true;
};
const asciiPayload=value=>/^[\x09\x0a\x0d\x20-\x7e]*$/.test(value);

function validateProof(proof,{requestHash,policyHash}={}){
  keys(proof,['ast','astHash','canonicalAst','grammar','policyHash','requestHash','schema']);
  integrity(proof.schema===ADAPTIVE_V3_ADMISSION_PROOF_SCHEMA,'Admission proof schema changed');
  string(proof.grammar,'admission proof grammar',{max:120});
  digest(proof.requestHash,'admission proof request hash');digest(proof.policyHash,'admission proof policy hash');digest(proof.astHash,'admission proof AST hash');
  string(proof.canonicalAst,'canonical admission AST',{min:2,max:256*1024});
  integrity(proof.canonicalAst===canonical(proof.ast)&&proof.astHash===sha256(proof.ast),
    'Admission proof AST encoding or hash changed');
  if(requestHash!==undefined)integrity(proof.requestHash===requestHash,'Admission proof belongs to another request');
  if(policyHash!==undefined)integrity(proof.policyHash===policyHash,'Admission proof belongs to another policy');
  return proof;
}

function validateDecisionEnvelope(decision){
  keys(decision,['decisionHash','policyHash','proof','reasonCodes','requestHash','revision','route','schema']);
  integrity(decision.schema===ADAPTIVE_V3_ADMISSION_DECISION_SCHEMA&&decision.revision===1,
    'Admission decision schema or revision changed');
  digest(decision.decisionHash,'admission decision hash');digest(decision.requestHash,'admission request hash');digest(decision.policyHash,'admission policy hash');
  list(decision.reasonCodes,'admission reason codes',{min:1,max:64});decision.reasonCodes.forEach((code,index)=>string(code,`admission reason code ${index}`,{max:160}));
  validateProof(decision.proof,{requestHash:decision.requestHash,policyHash:decision.policyHash});
  const {decisionHash,...base}=decision;
  integrity(decisionHash===sha256(base),'Admission decision hash changed');
  return decision;
}

function closedDecision(request,metadata,candidate){
  // Recompute the deterministic admission before examining a claimed route or
  // AST. This rejects a caller's altered decision rather than treating it as
  // an authority input.
  const decision=verifyAdaptiveV3AdmissionDecision(request,metadata,candidate);
  validateDecisionEnvelope(decision);
  check(decision.route==='CLOSED','ADAPTIVE_V3_CLOSED_OUTPUT_ROUTE',
    'Only an exact deterministic CLOSED admission may materialize an output');
  return decision;
}

function literalAst(ast,proof){
  keys(ast,['grammar','kind','payload','transform']);
  integrity(proof.grammar==='literal-transform.v1'&&ast.kind==='literal-transform'&&ast.grammar==='literal-transform.v1',
    'Closed literal proof has an unexpected grammar');
  string(ast.transform,'literal transform',{max:120});string(ast.payload,'literal payload',{min:1,max:LITERAL_MAX_BYTES});
  integrity(isScalarText(ast.payload),'Closed literal payload is not UTF-8 scalar text');
  const definition=ADAPTIVE_V3_LITERAL_TRANSFORMS[ast.transform];
  integrity(definition,'Closed literal proof names an unknown transform');
  if(definition.payloadDomain==='ascii')integrity(asciiPayload(ast.payload),'Closed ASCII transform received non-ASCII payload');
  return {transform:ast.transform,payload:ast.payload};
}

function formalNode(node,state,depth=0){
  resource(depth<=FORMAL_MAX_DEPTH,'Formal expression depth exceeds the deterministic materialization budget',{depth,limit:FORMAL_MAX_DEPTH});
  resource(++state.nodes<=FORMAL_MAX_NODES,'Formal expression node count exceeds the deterministic materialization budget',
    {nodes:state.nodes,limit:FORMAL_MAX_NODES});
  object(node,'formal AST node');
  if(node.kind==='operand'){
    keys(node,['kind','value']);string(node.value,'formal operand',{max:FORMAL_MAX_INTEGER_DIGITS});
    integrity(/^(?:0|[1-9][0-9]{0,127})$/.test(node.value),'Formal operand is not canonical unsigned decimal');
    return;
  }
  if(node.kind==='call'){
    keys(node,['arguments','kind','operator']);string(node.operator,'formal operator',{max:120});
    const definition=ADAPTIVE_V3_FORMAL_OPERATORS[node.operator];integrity(definition,'Formal proof names an unknown operator');
    list(node.arguments,'formal arguments',{max:2});integrity(node.arguments.length===definition.arity,'Formal proof has an invalid operator arity');
    node.arguments.forEach(argument=>formalNode(argument,state,depth+1));return;
  }
  integrity(false,'Formal AST node kind is unknown');
}

function formalAst(ast,proof){
  keys(ast,['expression','grammar','kind']);
  integrity(proof.grammar==='formal-derivation.v1'&&ast.kind==='formal-derivation'&&ast.grammar==='formal-derivation.v1',
    'Closed formal proof has an unexpected grammar');
  formalNode(ast.expression,{nodes:0});return ast.expression;
}

function checkedBody(value){
  if(typeof value==='string')resource(Buffer.byteLength(value)<=ADAPTIVE_V3_CLOSED_OUTPUT_MAX_BYTES,
    'Deterministic output exceeds the closed text resource limit',{bytes:Buffer.byteLength(value),limit:ADAPTIVE_V3_CLOSED_OUTPUT_MAX_BYTES});
  string(value,'deterministic closed output',{min:0,max:ADAPTIVE_V3_CLOSED_OUTPUT_MAX_BYTES});
  integrity(isScalarText(value),'Deterministic output is not UTF-8 scalar text');return value;
}

function literalOutput({transform,payload}){
  let body;
  switch(transform){
    // Identity preserves the JavaScript scalar sequence exactly; scalar text is
    // a unique UTF-8 byte sequence, so no normalisation, re-encoding or prose
    // is inserted by this materializer.
    case 'identity-utf8-v1':body=payload;break;
    // ASCII operations intentionally use code-unit mappings, never locale or
    // Unicode casing. reverse reverses ASCII code units. trim removes only HT,
    // LF, CR and SPACE at the two boundaries, preserving every interior byte.
    case 'uppercase-ascii-v1':body=payload.replace(/[a-z]/g,character=>String.fromCharCode(character.charCodeAt(0)-32));break;
    case 'lowercase-ascii-v1':body=payload.replace(/[A-Z]/g,character=>String.fromCharCode(character.charCodeAt(0)+32));break;
    case 'reverse-ascii-v1':{const characters=new Array(payload.length);for(let index=0;index<payload.length;index++)characters[index]=payload[payload.length-index-1];body=characters.join('');break;}
    case 'trim-ascii-v1':{
      let start=0,end=payload.length;
      const edge=code=>code===0x09||code===0x0a||code===0x0d||code===0x20;
      while(start<end&&edge(payload.charCodeAt(start)))start++;
      while(end>start&&edge(payload.charCodeAt(end-1)))end--;
      body=payload.slice(start,end);break;
    }
    default:integrity(false,'Closed literal transform has no deterministic materializer');
  }
  return checkedBody(body);
}

function decimal(value,label){
  const text=value.toString();
  integrity(/^-?(?:0|[1-9][0-9]*)$/.test(text),'BigInt result is not signed canonical decimal');
  resource(Buffer.byteLength(text)<=ADAPTIVE_V3_CLOSED_OUTPUT_MAX_DECIMAL_BYTES,
    `${label} exceeds the deterministic decimal resource limit`,{bytes:Buffer.byteLength(text),limit:ADAPTIVE_V3_CLOSED_OUTPUT_MAX_DECIMAL_BYTES});
  return {value,text,magnitudeDigits:text.startsWith('-')?text.length-1:text.length};
}

function estimateDecimal(operator,values){
  let digits;
  switch(operator){
    case 'add-int-v1':case 'subtract-int-v1':digits=Math.max(values[0].magnitudeDigits,values[1].magnitudeDigits)+1;break;
    case 'multiply-int-v1':digits=values[0].magnitudeDigits+values[1].magnitudeDigits+1;break;
    case 'negate-int-v1':digits=values[0].magnitudeDigits+1;break;
    default:integrity(false,'Formal operator has no deterministic arithmetic materializer');
  }
  resource(digits<=ADAPTIVE_V3_CLOSED_OUTPUT_MAX_DECIMAL_BYTES,
    'Formal arithmetic result could exceed the deterministic decimal resource limit',
    {operator,estimatedDigits:digits,limit:ADAPTIVE_V3_CLOSED_OUTPUT_MAX_DECIMAL_BYTES});
}

function formalOutput(node){
  // This function runs only after the whole AST has passed formalAst(), so no
  // BigInt parse or operation can be induced by an unvalidated operator/leaf.
  if(node.kind==='operand')return decimal(BigInt(node.value),'Formal operand');
  const values=node.arguments.map(formalOutput);estimateDecimal(node.operator,values);
  switch(node.operator){
    case 'add-int-v1':return decimal(values[0].value+values[1].value,'Formal addition');
    case 'subtract-int-v1':return decimal(values[0].value-values[1].value,'Formal subtraction');
    case 'multiply-int-v1':return decimal(values[0].value*values[1].value,'Formal multiplication');
    case 'negate-int-v1':return decimal(-values[0].value,'Formal negation');
    default:integrity(false,'Formal operator has no deterministic arithmetic materializer');
  }
}

function outputRecord(decision,kind,body){
  const base={schema:ADAPTIVE_V3_CLOSED_OUTPUT_SCHEMA,revision:ADAPTIVE_V3_CLOSED_OUTPUT_REVISION,route:'CLOSED',kind,body:checkedBody(body),
    bodyHash:sha256(body),requestHash:decision.requestHash,policyHash:decision.policyHash,admissionDecisionHash:decision.decisionHash,
    admissionReasonCodes:clone(decision.reasonCodes),admissionProof:clone(decision.proof),admissionProofHash:sha256(decision.proof),
    grammar:decision.proof.grammar,astHash:decision.proof.astHash};
  return freeze({...base,outputHash:sha256(base)});
}

/** Materialize an exact response. It never delegates, infers, reads or writes. */
export function materializeAdaptiveV3ClosedOutput(request,metadata,decision){
  const verified=closedDecision(request,metadata,decision),ast=verified.proof.ast;
  if(verified.proof.grammar==='literal-transform.v1'){
    integrity(canonical(verified.reasonCodes)===canonical(['CLOSED_LITERAL_TRANSFORM']),'Closed literal decision has unexpected reasons');
    return outputRecord(verified,'literal-transform',literalOutput(literalAst(ast,verified.proof)));
  }
  if(verified.proof.grammar==='formal-derivation.v1'){
    integrity(canonical(verified.reasonCodes)===canonical(['CLOSED_FORMAL_DERIVATION']),'Closed formal decision has unexpected reasons');
    const expression=formalAst(ast,verified.proof);return outputRecord(verified,'formal-derivation',checkedBody(formalOutput(expression).text));
  }
  integrity(false,'CLOSED decision has no materializable grammar');
}

function outputCandidate(candidate){
  // canonical() first rejects accessors, prototypes, sparse data and cycles
  // without executing a caller-controlled getter during structural checks.
  const encoded=canonical(candidate);
  keys(candidate,OUTPUT_FIELDS);
  integrity(candidate.schema===ADAPTIVE_V3_CLOSED_OUTPUT_SCHEMA&&candidate.revision===ADAPTIVE_V3_CLOSED_OUTPUT_REVISION
    &&candidate.route==='CLOSED'&&['literal-transform','formal-derivation'].includes(candidate.kind),
    'Closed output schema, revision, route or kind changed');
  checkedBody(candidate.body);digest(candidate.bodyHash,'closed output body hash');digest(candidate.requestHash,'closed output request hash');
  digest(candidate.policyHash,'closed output policy hash');digest(candidate.admissionDecisionHash,'closed output admission decision hash');
  digest(candidate.admissionProofHash,'closed output admission proof hash');digest(candidate.astHash,'closed output AST hash');
  string(candidate.grammar,'closed output grammar',{max:120});digest(candidate.outputHash,'closed output record hash');
  list(candidate.admissionReasonCodes,'closed output admission reason codes',{min:1,max:64});
  candidate.admissionReasonCodes.forEach((code,index)=>string(code,`closed output admission reason code ${index}`,{max:160}));
  validateProof(candidate.admissionProof,{requestHash:candidate.requestHash,policyHash:candidate.policyHash});
  integrity(candidate.bodyHash===sha256(candidate.body),'Closed output body hash changed');
  integrity(candidate.admissionProofHash===sha256(candidate.admissionProof),'Closed output admission proof hash changed');
  integrity(candidate.grammar===candidate.admissionProof.grammar&&candidate.astHash===candidate.admissionProof.astHash,
    'Closed output grammar or AST binding changed');
  const {outputHash,...base}=candidate;
  integrity(outputHash===sha256(base),'Closed output record hash changed');
  return encoded;
}

/** Verify an untrusted retained candidate by rematerializing every byte. */
export function verifyAdaptiveV3ClosedOutput(request,metadata,decision,candidate){
  const expected=materializeAdaptiveV3ClosedOutput(request,metadata,decision),encoded=outputCandidate(candidate);
  integrity(encoded===canonical(expected),'Closed output differs from deterministic rematerialization');
  return expected;
}
