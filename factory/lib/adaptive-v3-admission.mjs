// Pure, fail-closed admission for a future adaptive-v3 route.  This module
// neither plans nor executes: it recognizes two deliberately tiny languages.
// Everything outside those languages is evidence for the ordinary planner.
import {canonical,check,clone,sha256,string} from './contracts.mjs';

export const ADAPTIVE_V3_ADMISSION_POLICY_SCHEMA='sovereign.adaptive-v3-admission-policy.v1';
export const ADAPTIVE_V3_ADMISSION_DECISION_SCHEMA='sovereign.adaptive-v3-admission-decision.v1';
export const ADAPTIVE_V3_ADMISSION_PROOF_SCHEMA='sovereign.adaptive-v3-admission-proof.v1';
export const ADAPTIVE_V3_ADMISSION_ROUTES=Object.freeze(['CLOSED','PLANNED']);

// These are names for fully specified future operations, not natural-language
// instructions.  An admission policy can select only a subset of this catalog.
export const ADAPTIVE_V3_LITERAL_TRANSFORMS=Object.freeze({
  'identity-utf8-v1':Object.freeze({payloadDomain:'utf8'}),
  'lowercase-ascii-v1':Object.freeze({payloadDomain:'ascii'}),
  'reverse-ascii-v1':Object.freeze({payloadDomain:'ascii'}),
  'trim-ascii-v1':Object.freeze({payloadDomain:'ascii'}),
  'uppercase-ascii-v1':Object.freeze({payloadDomain:'ascii'})
});
export const ADAPTIVE_V3_FORMAL_OPERATORS=Object.freeze({
  'add-int-v1':Object.freeze({arity:2}),
  'multiply-int-v1':Object.freeze({arity:2}),
  'negate-int-v1':Object.freeze({arity:1}),
  'subtract-int-v1':Object.freeze({arity:2})
});

const REQUEST_MAX_BYTES=256*1024;
const LITERAL_MAX_BYTES=64*1024;
const FORMAL_MAX_DEPTH=32;
const FORMAL_MAX_NODES=256;
const FORMAL_MAX_INTEGER_DIGITS=128;
const LITERAL_PREFIX='LITERAL-TRANSFORM/1 ';
const FORMAL_PREFIX='FORMAL-DERIVATION/1\n';
const BEGIN_LITERAL='\n<<<\n';
const END_LITERAL='\n>>>';
const freeze=value=>{if(value&&typeof value==='object'&&!Object.isFrozen(value)){Object.values(value).forEach(freeze);Object.freeze(value);}return value;};
const sortedUnique=values=>[...new Set(values)].sort();

function plainDataObject(value){
  if(value===null||typeof value!=='object'||Array.isArray(value)||Object.getPrototypeOf(value)!==Object.prototype)return null;
  const descriptors=Object.getOwnPropertyDescriptors(value);
  if(!Reflect.ownKeys(value).every(key=>typeof key==='string'&&descriptors[key].enumerable&&Object.hasOwn(descriptors[key],'value')))return null;
  return descriptors;
}
function denseDataArray(value){
  if(!Array.isArray(value))return null;
  const descriptors=Object.getOwnPropertyDescriptors(value);
  if(Reflect.ownKeys(value).length!==value.length+1)return null;
  for(let index=0;index<value.length;index++){
    const descriptor=descriptors[index];
    if(!descriptor||!descriptor.enumerable||!Object.hasOwn(descriptor,'value'))return null;
  }
  return value;
}
function scalarText(value){
  for(let index=0;index<value.length;index++){
    const code=value.charCodeAt(index);
    if(code>=0xd800&&code<=0xdbff){if(index+1>=value.length||value.charCodeAt(index+1)<0xdc00||value.charCodeAt(index+1)>0xdfff)return false;index++;}
    else if(code>=0xdc00&&code<=0xdfff)return false;
  }
  return true;
}
function normalizeSelected(value,known){
  const entries=denseDataArray(value);
  if(!entries||entries.length>64||entries.some(entry=>typeof entry!=='string'||!scalarText(entry)||!Object.hasOwn(known,entry)))return null;
  const normalized=sortedUnique(entries);
  return normalized.length===entries.length?normalized:null;
}
function normalizeOperands(value){
  const entries=denseDataArray(value),pattern=new RegExp(`^(?:0|[1-9][0-9]{0,${FORMAL_MAX_INTEGER_DIGITS-1}})$`);
  if(!entries||entries.length>128||entries.some(entry=>typeof entry!=='string'||!pattern.test(entry)))return null;
  const normalized=sortedUnique(entries);
  return normalized.length===entries.length?normalized:null;
}
function normalizePolicy(metadata){
  const descriptors=plainDataObject(metadata);
  if(!descriptors)return {valid:false,reason:'INVALID_ADMISSION_POLICY'};
  const expected=['formalOperands','formalOperators','literalTransforms','schema'];
  if(canonical(Object.keys(descriptors).sort())!==canonical(expected))return {valid:false,reason:'INVALID_ADMISSION_POLICY'};
  if(descriptors.schema.value!==ADAPTIVE_V3_ADMISSION_POLICY_SCHEMA)return {valid:false,reason:'INVALID_ADMISSION_POLICY'};
  const literalTransforms=normalizeSelected(descriptors.literalTransforms.value,ADAPTIVE_V3_LITERAL_TRANSFORMS);
  const formalOperators=normalizeSelected(descriptors.formalOperators.value,ADAPTIVE_V3_FORMAL_OPERATORS);
  const formalOperands=normalizeOperands(descriptors.formalOperands.value);
  if(!literalTransforms||!formalOperators||!formalOperands)return {valid:false,reason:'INVALID_ADMISSION_POLICY'};
  return {valid:true,policy:{schema:ADAPTIVE_V3_ADMISSION_POLICY_SCHEMA,literalTransforms,formalOperators,formalOperands}};
}
function literalAttempt(request){
  if(!request.startsWith(LITERAL_PREFIX))return {status:'absent'};
  const headerEnd=request.indexOf('\n');
  if(headerEnd<0)return {status:'invalid',code:'LITERAL_SYNTAX'};
  const transform=request.slice(LITERAL_PREFIX.length,headerEnd);
  if(!/^[a-z][a-z0-9-]*-v1$/.test(transform)||!request.startsWith(BEGIN_LITERAL,headerEnd))return {status:'invalid',code:'LITERAL_SYNTAX'};
  const payloadStart=headerEnd+BEGIN_LITERAL.length;
  const closing=request.lastIndexOf(END_LITERAL);
  if(closing<payloadStart)return {status:'invalid',code:'LITERAL_SYNTAX'};
  const payload=request.slice(payloadStart,closing),tail=request.slice(closing+END_LITERAL.length);
  if(tail)return {status:'invalid',code:'LITERAL_TRAILING_TEXT',transform,payloadStart,closing,tail};
  if(!payload||Buffer.byteLength(payload)>LITERAL_MAX_BYTES)return {status:'invalid',code:'LITERAL_PAYLOAD_LIMIT',transform,payloadStart,closing};
  // A closing delimiter is terminal, never a quote-like marker that could be
  // interpreted differently by another parser or a future controller.
  if(payload.includes(END_LITERAL))return {status:'invalid',code:'LITERAL_EMBEDDED_DELIMITER',transform,payloadStart,closing};
  return {status:'parsed',transform,payload,payloadStart,closing};
}
function formalAttempt(request){
  if(!request.startsWith(FORMAL_PREFIX))return {status:'absent'};
  const expression=request.slice(FORMAL_PREFIX.length);
  if(!expression||expression.includes('\n')||expression.includes('\r')||expression.includes('\t'))return {status:'invalid',code:'FORMAL_SYNTAX'};
  let index=0,nodes=0;
  const fail=(code='FORMAL_SYNTAX')=>({status:'invalid',code,offset:index});
  const boundary=()=>index===expression.length||expression[index]===' '||expression[index]===')';
  const parseNode=depth=>{
    if(depth>FORMAL_MAX_DEPTH)throw fail('FORMAL_RESOURCE_LIMIT');
    if(++nodes>FORMAL_MAX_NODES)throw fail('FORMAL_RESOURCE_LIMIT');
    if(expression[index]==='('){
      index++;const operatorStart=index;
      while(index<expression.length&&expression[index]!==' '&&expression[index]!==')')index++;
      const operator=expression.slice(operatorStart,index);
      if(!/^[a-z][a-z0-9-]*-v1$/.test(operator)||index>=expression.length)throw fail();
      const argumentsList=[];
      while(expression[index]!==')'){
        if(expression[index]!==' ')throw fail();index++;
        if(index>=expression.length||expression[index]===' '||expression[index]===')')throw fail();
        argumentsList.push(parseNode(depth+1));
      }
      index++;return {kind:'call',operator,arguments:argumentsList};
    }
    const start=index;
    if(expression[index]==='0')index++;
    else if(/[1-9]/.test(expression[index]??'')){while(/[0-9]/.test(expression[index]??''))index++;}
    else throw fail();
    const value=expression.slice(start,index);
    if(value.length>FORMAL_MAX_INTEGER_DIGITS||!boundary())throw fail();
    return {kind:'operand',value};
  };
  try{
    const ast=parseNode(0);
    if(index!==expression.length)return fail();
    return {status:'parsed',ast};
  }catch(error){return error?.status==='invalid'?error:fail();}
}
function maskLiteralPayload(request,literal){
  if(!literal||!['parsed','invalid'].includes(literal.status)||!Number.isInteger(literal.payloadStart)||!Number.isInteger(literal.closing))return request;
  return request.slice(0,literal.payloadStart)+request.slice(literal.closing+END_LITERAL.length);
}
function hazardCodes(text){
  const codes=new Set();
  if(/https?:\/\/|www\./i.test(text))codes.add('URL_OUTSIDE_LITERAL');
  if(/(?:file:\/\/|(?:^|[\s"'`])(?:\.?\.?\/|\/)[^\s]+|\.(?:pdf|docx|xlsx|csv|txt|md)(?:\b|$)|\b(?:file|files|archivo|archivos|adjunto|adjuntos|attachment|attachments|document|documents|documento|documentos|carpeta|folder)\b)/iu.test(text))codes.add('FILES_OR_ATTACHMENTS');
  if(/\b(?:ignore|disregard|bypass|omit|skip|ignora|ignorar|omite|omitir|salta|saltar)\s+(?:las?\s+|the\s+)?(?:sources?|citations?|evidence|fuentes?|citas?|evidencia)\b/iu.test(text)
    ||/\b(?:sin|without|no)\s+(?:fuentes?|sources?|citas?|citations?|evidencia|evidence)\b/iu.test(text))codes.add('IGNORE_SOURCES');
  if(/\b(?:write|compose|invent|brainstorm|redacta|redactar|comp[oó]n|componer|inventa|inventar|imagina|imaginar)\b[^\n]{0,80}\b(?:poem|poetry|story|novel|song|slogan|historia|poema|novela|canci[oó]n|eslogan)\b/iu.test(text))codes.add('FREEFORM_CREATIVITY');
  if(/\b(?:write|create|delete|modify|save|send|email|post|publish|deploy|execute|run|install|download|upload|commit|push|edit|escribe|crea|borra|modifica|guarda|env[ií]a|publica|despliega|ejecuta|instala|descarga|sube|edita)\b[^\n]{0,80}\b(?:file|files|archivo|archivos|email|correo|message|mensaje|repository|repo|server|servidor|website|sitio|database|base de datos|terminal|command|comando)\b/iu.test(text))codes.add('EFFECT_REQUESTED');
  if(/\b(?:what|who|when|where|which|cu[aá]l|qu[eé]|qui[eé]n|cu[aá]ndo|d[oó]nde)\b[^\n]{0,120}\?|\b(?:today|now|current|latest|recent|hoy|ahora|actual|[uú]ltim[oa])\b|\b(?:capital|president|ceo|weather|clima|rain|llover|llueve|population|price|precio|law|ley|cotizaci[oó]n)\b/iu.test(text))codes.add('EXTERNAL_FACT');
  if(/\b(?:whatever|something|etc\.?|you decide|as you see fit|lo que quieras|como quieras|algo|etc[eé]tera|ambigu[oa])\b/iu.test(text))codes.add('AMBIGUOUS_REQUEST');
  if(/\b(?:and|also|then|y|adem[aá]s|tambi[eé]n)\s+(?:also|then|write|create|make|give|provide|escribe|crea|haz|dame|proporciona)\b/iu.test(text))codes.add('MULTIPLE_PRODUCTS');
  return codes;
}
function formalValidation(ast,policy){
  const reasons=new Set();
  const walk=node=>{
    if(node.kind==='operand'){
      if(!policy.formalOperands.includes(node.value))reasons.add('UNALLOWLISTED_FORMAL_OPERAND');
      return;
    }
    const definition=ADAPTIVE_V3_FORMAL_OPERATORS[node.operator];
    if(!definition)reasons.add('UNKNOWN_FORMAL_OPERATOR');
    else {
      if(!policy.formalOperators.includes(node.operator))reasons.add('UNALLOWLISTED_FORMAL_OPERATOR');
      if(node.arguments.length!==definition.arity)reasons.add('FORMAL_ARITY');
    }
    node.arguments.forEach(walk);
  };
  walk(ast);return reasons;
}
function proof(grammar,ast,requestHash,policyHash){
  const normalized=clone(ast),canonicalAst=canonical(normalized);
  return {schema:ADAPTIVE_V3_ADMISSION_PROOF_SCHEMA,grammar,requestHash,policyHash,ast:normalized,canonicalAst,astHash:sha256(normalized)};
}
function decision({route,reasonCodes,requestHash,policyHash,grammar,ast}){
  const value={schema:ADAPTIVE_V3_ADMISSION_DECISION_SCHEMA,revision:1,route,reasonCodes:sortedUnique(reasonCodes),requestHash,policyHash,
    proof:proof(grammar,ast,requestHash,policyHash)};
  return freeze({...value,decisionHash:sha256(value)});
}
function rejectionAst({literal,formal,hazards,policyValid}){
  return {kind:'admission-rejection',grammar:'adaptive-v3-admission.v1',policyValid,
    literal:{status:literal.status,code:literal.code??null,transform:literal.transform??null},
    formal:{status:formal.status,code:formal.code??null,offset:formal.offset??null},
    hazards:sortedUnique(hazards)};
}

/**
 * Decide a route without a model.  The policy is an authority-limiting set,
 * not a prompt: only its predeclared operations and operands may be closed.
 *
 * Accepted literal grammar (exact bytes):
 *   LITERAL-TRANSFORM/1 <allowlisted-transform>\n<<<\n<payload>\n>>>
 * Accepted formal grammar (exact bytes):
 *   FORMAL-DERIVATION/1\n(<allowlisted-operator> <allowlisted-operand> ...)
 */
export function admitAdaptiveV3Request(request,metadata){
  string(request,'request',{min:1,max:REQUEST_MAX_BYTES});
  const requestHash=sha256(request),policyResult=normalizePolicy(metadata),policyHash=policyResult.valid
    ?sha256(policyResult.policy):sha256({schema:ADAPTIVE_V3_ADMISSION_POLICY_SCHEMA,status:'INVALID'});
  const literal=literalAttempt(request),formal=formalAttempt(request),hazards=hazardCodes(maskLiteralPayload(request,literal));
  const reasons=new Set(hazards);
  if(!scalarText(request))reasons.add('NONSCALAR_TEXT');
  if(!policyResult.valid)reasons.add(policyResult.reason);
  if(literal.status==='parsed'){
    const ast={kind:'literal-transform',grammar:'literal-transform.v1',transform:literal.transform,payload:literal.payload};
    if(!Object.hasOwn(ADAPTIVE_V3_LITERAL_TRANSFORMS,literal.transform))reasons.add('UNKNOWN_LITERAL_TRANSFORM');
    else if(!policyResult.valid||!policyResult.policy.literalTransforms.includes(literal.transform))reasons.add('UNALLOWLISTED_LITERAL_TRANSFORM');
    else if(ADAPTIVE_V3_LITERAL_TRANSFORMS[literal.transform].payloadDomain==='ascii'&&!/^[\x09\x0a\x0d\x20-\x7e]*$/.test(literal.payload))reasons.add('LITERAL_PAYLOAD_OUT_OF_DOMAIN');
    return reasons.size===0
      ?decision({route:'CLOSED',reasonCodes:['CLOSED_LITERAL_TRANSFORM'],requestHash,policyHash,grammar:'literal-transform.v1',ast})
      :decision({route:'PLANNED',reasonCodes:reasons,requestHash,policyHash,grammar:'literal-transform.v1',ast});
  }
  if(formal.status==='parsed'){
    const reasonsFromAst=policyResult.valid?formalValidation(formal.ast,policyResult.policy):new Set(['INVALID_ADMISSION_POLICY']);
    reasonsFromAst.forEach(reason=>reasons.add(reason));
    return reasons.size===0
      ?decision({route:'CLOSED',reasonCodes:['CLOSED_FORMAL_DERIVATION'],requestHash,policyHash,grammar:'formal-derivation.v1',ast:{kind:'formal-derivation',grammar:'formal-derivation.v1',expression:formal.ast}})
      :decision({route:'PLANNED',reasonCodes:reasons,requestHash,policyHash,grammar:'formal-derivation.v1',ast:{kind:'formal-derivation',grammar:'formal-derivation.v1',expression:formal.ast}});
  }
  reasons.add('OUTSIDE_EXPLICIT_GRAMMAR');
  if(literal.status==='invalid')reasons.add(literal.code);
  if(formal.status==='invalid')reasons.add(formal.code);
  if(literal.code==='LITERAL_TRAILING_TEXT')reasons.add('MULTIPLE_PRODUCTS');
  return decision({route:'PLANNED',reasonCodes:reasons,requestHash,policyHash,grammar:'rejection.v1',
    ast:rejectionAst({literal,formal,hazards:[...hazards],policyValid:policyResult.valid})});
}

// Recompute rather than trusting a caller-provided route, hash, or AST.  This
// is intentionally pure so a future engine can bind it before any side effect.
export function verifyAdaptiveV3AdmissionDecision(request,metadata,candidate){
  const expected=admitAdaptiveV3Request(request,metadata);
  check(canonical(candidate)===canonical(expected),'ADAPTIVE_V3_ADMISSION_INTEGRITY','Admission decision differs from its deterministic closed grammar');
  return clone(expected);
}
