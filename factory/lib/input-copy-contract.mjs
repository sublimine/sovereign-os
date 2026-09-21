// Pure contract leaf: no registry, worker, plan service or provider imports.
import {canonical,check,clone,keys,sha256,string} from './contracts.mjs';

export const INPUT_COPY_KIND='literal-input-copy';
export const isInputCopyNode=node=>['literal-input-copy-v1','literal-input-span-v1'].includes(node?.execution?.kind);
export const isInputCopyArtifact=artifact=>artifact?.payload.kind===INPUT_COPY_KIND;
export const inputCopyExecutionSchema={type:'object',properties:{kind:{type:'string',enum:['literal-input-copy-v1']},
  requestQuote:{type:'string'},copyText:{type:'string'}},required:['kind','requestQuote','copyText'],additionalProperties:false};
export const inputSpanExecutionSchema={type:'object',properties:{kind:{type:'string',enum:['literal-input-span-v1']},
  before:{type:'string'},after:{type:'string'}},required:['kind','before','after'],additionalProperties:false};
export const INPUT_COPY_CRITERIA=Object.freeze([
  {id:'input-copy-selection',text:'The unique literal selection from the immutable user request is the object the user actually asked to preserve, not a merely matching example, instruction or unrelated passage. Inspect its source context and the independently accepted plan.'},
  {id:'input-copy-fidelity',text:'The cited authenticated artifact-input-copy observation recomputes this complete body from the exact mission request and prior accepted node contract, without normalization, interpretation or model production. Fidelity certifies copying only, not the truth of its contents or satisfaction of other user obligations.'},
].map(Object.freeze));
const equivalent=(a,b)=>canonical(a.map(c=>({...c,evaluation:c.evaluation??'content'})))===canonical(b.map(c=>({...c,evaluation:c.evaluation??'content'})));

export function selectInputCopy(intent,execution){
  if(execution?.kind==='literal-input-span-v1')return selectInputSpan(intent,execution);
  keys(execution,['kind','requestQuote','copyText']);
  check(execution.kind==='literal-input-copy-v1','INPUT_COPY_SELECTION','Unknown literal selection contract');
  for(const [name,value]of Object.entries({intent,requestQuote:execution.requestQuote,copyText:execution.copyText})){
    string(value,name,{max:4*1024*1024});
    check(value.isWellFormed(),'INPUT_COPY_SELECTION','Literal input must contain complete Unicode scalar values; no normalization or surrogate repair');
  }
  const {requestQuote,copyText}=execution,quoteStart=intent.indexOf(requestQuote),localStart=requestQuote.indexOf(copyText);
  check(quoteStart>=0&&intent.indexOf(requestQuote,quoteStart+1)<0,'INPUT_COPY_SELECTION','requestQuote must occur exactly once in the immutable request');
  check(localStart>=0&&requestQuote.indexOf(copyText,localStart+1)<0,'INPUT_COPY_SELECTION','copyText must occur exactly once inside the selected requestQuote');
  const start=quoteStart+localStart,end=start+copyText.length,body=intent.slice(start,end);
  check(body===copyText,'INPUT_COPY_SELECTION','Selection is not the exact requested substring');
  return {unit:'UTF-16 code units; half-open [start,end)',quoteStart,quoteEnd:quoteStart+requestQuote.length,
    start,end,requestQuote,body,bodySha256:sha256(body),bodyUtf8Bytes:Buffer.byteLength(body)};
}

// The model names boundaries, never transcribes the selected body. Both
// anchors must be globally unique, disjoint and in source order. No first-match
// fallback, delimiter inference, trimming, decoding or Unicode normalization.
function selectInputSpan(intent,execution){
  keys(execution,['kind','before','after']);
  for(const [name,value]of Object.entries({intent,before:execution.before,after:execution.after})){
    string(value,name,{max:4*1024*1024});
    check(value.isWellFormed(),'INPUT_COPY_SELECTION','Literal input must contain complete Unicode scalar values; no normalization or surrogate repair');
  }
  const {before,after}=execution,quoteStart=intent.indexOf(before),end=intent.indexOf(after);
  check(quoteStart>=0&&intent.indexOf(before,quoteStart+1)<0,'INPUT_COPY_SELECTION','before anchor must occur exactly once in the immutable request');
  check(end>=0&&intent.indexOf(after,end+1)<0,'INPUT_COPY_SELECTION','after anchor must occur exactly once in the immutable request');
  const start=quoteStart+before.length,quoteEnd=end+after.length;
  check(start<end,'INPUT_COPY_SELECTION','Anchors must enclose a nonempty literal body in source order without overlap');
  const body=intent.slice(start,end);
  return {unit:'UTF-16 code units; half-open [start,end)',quoteStart,quoteEnd,start,end,
    requestQuote:intent.slice(quoteStart,quoteEnd),body,bodySha256:sha256(body),bodyUtf8Bytes:Buffer.byteLength(body),
    selector:{kind:execution.kind,before,after}};
}

export function normalizeInputCopyPlan(value){
  const plan=clone(value),added=[];
  for(const node of plan.nodes.filter(isInputCopyNode))for(const gate of INPUT_COPY_CRITERIA){
    const old=node.criteria.find(c=>c.id===gate.id);
    check(!old||equivalent([old],[gate]),'INPUT_COPY_PLAN','A literal-copy gate cannot be weakened or redefined');
    if(!old){node.criteria.push(clone(gate));added.push({nodeId:node.id,criterionId:gate.id});}
  }
  return {plan,added};
}

export function assertInputCopyNode(node){
  check(isInputCopyNode(node)&&node.outputKind===INPUT_COPY_KIND&&node.roleIds.length===0&&node.specialist===null
    &&node.dependencies.length===0&&node.tools.length===0&&node.requiredEffects.length===0,
    'INPUT_COPY_PLAN','Native input copy has no model producer, specialist, tool, effect or product dependency; only its exact accepted plan and immutable mission request');
  check(INPUT_COPY_CRITERIA.every(g=>node.criteria.some(c=>equivalent([c],[g]))),
    'INPUT_COPY_PLAN','Both native selection and fidelity gates must precede independent plan review');
}

export function validateInputCopyPlan(plan,intent,{proposal=false}={}){
  if(proposal)plan=normalizeInputCopyPlan(plan).plan;
  for(const node of plan.nodes){
    if(!isInputCopyNode(node)){
      check(node.outputKind!==INPUT_COPY_KIND,'INPUT_COPY_PLAN','Literal-copy product kind is reserved for its explicit native adapter');continue;
    }
    selectInputCopy(intent,node.execution);
    assertInputCopyNode(node);
  }
}

export function inputCopyPlanningCapability(){
  return {version:'literal-input-selection-v3',
    boundaryContract:'Prefer execution={kind:"literal-input-span-v1",before,after} when a verbatim object is delimited in the immutable user request. before and after are exact nonempty anchors, each occurring once in the ENTIRE request, in that order with a nonempty gap. Include enough surrounding user context to disambiguate repeated marker mentions. The controller copies ONLY the original substring strictly between the anchors; anchors are excluded. Do not transcribe the body or supply offsets. Resolve the declared context transport first: actual source line breaks and literal backslash characters are distinct. Never normalize, unescape or repair the decoded original source. The exact source span and full source context are exposed before independent plan/product review. This is a literal span, not a semantic extractor. The shared boundaries below apply. If no unambiguous supported selection exists, preserve the limitation instead of inventing one.',
    contract:'Both literal adapters require an explicitly requested verbatim object already present in the immutable user request, outputKind="literal-input-copy", roleIds=[], specialist=null, dependencies=[], tools=[], requiredEffects=[]. Legacy alternative: execution={kind:"literal-input-copy-v1",requestQuote,copyText} requires requestQuote exactly once in the full request and copyText exactly once inside that quote; prefer the boundary selector above when its conditions hold rather than transcribing the body. The controller derives positions and copies actual request bytes, not a model answer. It inserts selection/fidelity gates before independent plan review. Keep every user requirement and other necessary gate; this can be final only for a genuine literal-copy delivery. It is not a parser, calculation, external source, semantic extraction or truth certificate. Reviewers require compatible complete role contracts. Substantive rejection stops this native candidate; it does not authorize another identical copy or another vote.'};
}
