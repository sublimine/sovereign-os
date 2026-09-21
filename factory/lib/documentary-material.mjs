// Typed response expansion and durable per-product/per-review bindings. No
// semantic verdict is invented here; the independent judge still decides it.
import {canonical,check,clone,keys,list} from './contracts.mjs';
import {documentaryRun} from './documentary-mode.mjs';
import {documentContextRequestEvidence,documentContextQuoteEvidenceBatch,documentContextMaterialEvidence} from './document-context-frames.mjs';

function materialActor(registry,run,binding,{latest=false}={}){
  check(documentaryRun(registry.store,run),'DOCUMENT_PROTOCOL','Material documentary proof requires its compiled protocol');
  keys(binding,['frameId','requestHash']);
  if(latest)check(run.inferenceReceipt?.contextHash===binding.requestHash,'DOCUMENT_REQUEST','Material output belongs to the latest completed request');
}
// Material functions below MUST also execute the completed quote batch, even
// when it is empty. It authenticates the full request/frame exactly once; this
// cheap private actor guard alone is never evidence of completed exposure.
export function documentaryExposure(registry,run,binding,options={}){
  materialActor(registry,run,binding,options);
  return documentContextRequestEvidence(registry,{runId:run.id,...binding});
}
const base=doc=>({frameId:doc.frameId,requestHash:doc.requestHash});
const quotes=(registry,run,binding,items)=>documentContextQuoteEvidenceBatch(registry,{runId:run.id,...base(binding),quotes:items}).quotes;
function rawReference(proof){
  check(proof.target.kind==='source-window','DOCUMENT_EVIDENCE','Empirical support requires an observed raw-source window, not metadata or artifact prose');
  return {sourceId:proof.target.sourceId,hash:proof.target.sourceHash,quote:proof.quote};
}
function reviewReference(proof,usage){
  const t=proof.target,kind=t.kind==='source-window'?'source':t.kind==='artifact-body'?'artifact':t.kind==='runtime-observation'?'runtime':t.kind==='tool-observation'?usage:null;
  check(kind&&['source','artifact','runtime','tool','tool-history'].includes(kind)
    &&(t.kind==='tool-observation'?['tool','tool-history'].includes(usage):usage===kind),
  'DOCUMENT_EVIDENCE','Typed review citation cannot relabel metadata, a body, raw source or tool history');
  return {kind,id:kind==='source'?t.sourceId:t.id,hash:kind==='source'?t.sourceHash:t.hash,quote:proof.quote};
}
export function expandDocumentClaims(registry,run,binding,claims){
  materialActor(registry,run,binding,{latest:true});const selectors=[];
  const items=claims.flatMap(c=>c.sources.map((s,index)=>{
    keys(s,['sourceKey','quote']);selectors.push({claimId:c.id,index,sourceKey:s.sourceKey});return s;
  }));
  const proofs=quotes(registry,run,binding,items);let offset=0;
  const expanded=claims.map(c=>({...clone(c),sources:c.sources.map(()=>rawReference(proofs[offset++]))}));
  return {claims:expanded,documentary:{...base(binding),claims:selectors}};
}
export function validateDocumentClaims(registry,run,claims,documentary,{latest=false}={}){
  keys(documentary,['frameId','requestHash','claims']);materialActor(registry,run,base(documentary),{latest});
  list(documentary.claims,'document claim bindings');let count=0;const items=[],expected=[];
  for(const c of claims)for(const [index,s]of c.sources.entries()){
    const selected=documentary.claims[count++];keys(selected,['claimId','index','sourceKey']);
    check(selected.claimId===c.id&&selected.index===index,'DOCUMENT_EVIDENCE','Claim selector order or identity changed');
    items.push({sourceKey:selected.sourceKey,quote:s.quote});expected.push(s);
  }
  check(count===documentary.claims.length,'DOCUMENT_EVIDENCE','Extra or missing document claim bindings');
  quotes(registry,run,documentary,items).forEach((proof,index)=>check(canonical(expected[index])===canonical(rawReference(proof)),
    'DOCUMENT_EVIDENCE','Claim source differs from its own observed literal window'));
}
export function expandDocumentReview(registry,run,binding,result,artifact){
  materialActor(registry,run,binding,{latest:true});const selectors=[];
  const items=result.checks.flatMap(c=>c.evidence.map((e,index)=>{
    keys(e,['sourceKey','quote','usage']);selectors.push({criterionId:c.criterionId,index,sourceKey:e.sourceKey,usage:e.usage});
    return {sourceKey:e.sourceKey,quote:e.quote};
  }));
  const {quotes:proofs,input}=documentContextMaterialEvidence(registry,{runId:run.id,...base(binding),quotes:items});let offset=0;
  const checks=result.checks.map(c=>({...clone(c),evidence:c.evidence.map(e=>reviewReference(proofs[offset++],e.usage))}));
  // Factual admission also requires the judge input to include each exact raw
  // support quoted by the producer. Search ONLY its current selected windows,
  // never the raw store or a producer frame. This is exposure, not entailment.
  const factual=[];
  if(result.decision==='ACCEPT')for(const c of artifact.payload.claims)for(const [index,s]of c.sources.entries()){
    const eligible=input.documentEvidenceCatalog.filter(e=>e.kind==='source-window'&&e.sourceId===s.sourceId&&e.sourceHash===s.hash);
    const found=eligible.find(e=>input.documentSourceViews.find(v=>v.selection.id===e.id)?.windows.some(w=>w.startByte===e.startByte&&w.endByte===e.endByte&&w.text.includes(s.quote)));
    check(found,'DOCUMENT_UNOBSERVED','Judge must independently select a window containing every declared raw support before acceptance');
    factual.push({claimId:c.id,index,sourceKey:found.sourceKey});
  }
  return {result:{...clone(result),checks},documentary:{...base(binding),checks:selectors,factual}};
}
export function validateDocumentReview(registry,run,result,artifact,documentary,{latest=false}={}){
  keys(documentary,['frameId','requestHash','checks','factual']);materialActor(registry,run,base(documentary),{latest});
  list(documentary.checks,'document check bindings');list(documentary.factual,'independently exposed claim support');
  const content=new Set(artifact.payload.criteria.filter(c=>(c.evaluation??'content')==='content').map(c=>c.id));let count=0;const items=[],expected=[];
  for(const c of result.checks.filter(c=>content.has(c.criterionId)))for(const [index,e]of c.evidence.entries()){
    const selected=documentary.checks[count++];keys(selected,['criterionId','index','sourceKey','usage']);
    check(selected.criterionId===c.criterionId&&selected.index===index,'DOCUMENT_EVIDENCE','Review selector order or identity changed');
    items.push({sourceKey:selected.sourceKey,quote:e.quote});expected.push({reference:e,usage:selected.usage,factual:false});
  }
  check(count===documentary.checks.length,'DOCUMENT_EVIDENCE','Extra or missing document review bindings');count=0;
  if(result.decision==='ACCEPT')for(const c of artifact.payload.claims)for(const [index,s]of c.sources.entries()){
    const selected=documentary.factual[count++];keys(selected,['claimId','index','sourceKey']);
    check(selected.claimId===c.id&&selected.index===index,
      'DOCUMENT_UNOBSERVED','Factual acceptance lacks its independent literal source exposure');
    items.push({sourceKey:selected.sourceKey,quote:s.quote});expected.push({reference:s,factual:true});
  }
  check(count===documentary.factual.length,'DOCUMENT_EVIDENCE','Extra or missing independent claim exposures');
  quotes(registry,run,documentary,items).forEach((proof,index)=>{
    const e=expected[index];check(canonical(e.reference)===canonical(e.factual?rawReference(proof):reviewReference(proof,e.usage)),
      e.factual?'DOCUMENT_UNOBSERVED':'DOCUMENT_EVIDENCE',e.factual?'Factual acceptance lacks its independent literal source exposure':'Review reference differs from its own completed exact input');
  });
}
