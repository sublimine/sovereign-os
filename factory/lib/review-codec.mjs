import {check, clone, keys, list, string, identifier, canonical, digest} from './contracts.mjs';

export const REVIEW_ENCODINGS = Object.freeze(['expanded-json','evidence-refs-v1','evidence-catalog-v1']);
export function reviewResponseSchema(expanded, encoding = 'expanded-json', observedCatalog = null) {
  check(REVIEW_ENCODINGS.includes(encoding), 'CONFIG', 'Unknown review response encoding');
  const schema = clone(expanded);
  if (encoding === 'expanded-json') return schema;
  const checkSchema = schema.properties.checks.items;
  const evidence = clone(checkSchema.properties.evidence.items);
  evidence.properties.evidenceId = {type:'string'};
  evidence.required.push('evidenceId');
  schema.properties.evidence = {type:'array', items:evidence};
  schema.required.push('evidence');
  delete checkSchema.properties.evidence;
  checkSchema.properties.evidenceIds = {type:'array', items:{type:'string'}, minItems:1};
  checkSchema.required = checkSchema.required.map(key => key === 'evidence' ? 'evidenceIds' : key);
  schema.description = (schema.description ?? '') + ' Evidence reference encoding: place each exact evidence object once in the top-level evidence array, with a unique short evidenceId. Each check cites the relevant evidenceIds instead of repeating objects. All IDs must resolve, every catalog entry must be used, and no check may repeat an ID. Do not merge judgments or omit criteria. The runtime expands each reference into its complete evidence before the unchanged acceptance checks. Every semantic check must cite at least one relevant observed evidence object; do not use an empty evidenceIds array.';
  if(encoding==='evidence-catalog-v1'){
    validateObservedCatalog(observedCatalog);
    schema.properties.evidence.items={type:'object',additionalProperties:false,
      properties:{evidenceId:{type:'string'},sourceKey:{type:'string',...(observedCatalog.length?{enum:observedCatalog.map(e=>e.sourceKey)}:{})},quote:{type:'string'}},
      required:['evidenceId','sourceKey','quote']};
    schema.description+=' Observed-catalog encoding: task.observedEvidenceCatalog binds each sourceKey to an ALREADY EXPOSED kind/id/hash. Your top-level evidence entries contain ONLY evidenceId, sourceKey and an exact quote from that observed object. Do not copy or invent hashes/IDs. The controller expands the chosen sourceKey, without changing your quote, verdict, reason or referenced source. A key is neither support nor acceptance: inspect the actual observed body/raw/quoteText and choose the correct kind. tool-history is historical evidence only, never a substitute for an OWN_ACTION current-state proof. Unselected observed objects remain in the context; this is not a source summary or a license to omit criteria.';
  }
  return schema;
}

const evidenceKinds=['artifact','source','tool','tool-history','runtime'];
function validateObservedCatalog(catalog){
  list(catalog,'observed evidence catalog',{max:5000});
  const seen=new Set(),references=new Set();
  for(const entry of catalog){
    keys(entry,['sourceKey','kind','id','hash']);identifier(entry.sourceKey);identifier(entry.id);digest(entry.hash);
    check(evidenceKinds.includes(entry.kind),'REVIEW_ENCODING','Unknown observed evidence kind');
    const identity=canonical([entry.kind,entry.id,entry.hash]);
    check(!seen.has(entry.sourceKey)&&!references.has(identity),'REVIEW_ENCODING','Ambiguous observed evidence catalog');
    seen.add(entry.sourceKey);references.add(identity);
  }
  return catalog;
}

/** Called only on the trusted Worker's actual complete context, never on a
 * model-supplied catalog. It contains no new source bytes or authority claims.
 */
export function observedEvidenceCatalog(context){
  const entries=[];
  const add=(kind,items)=>{for(const item of items)entries.push({kind,id:item.id,hash:item.hash});};
  add('artifact',context.artifacts);add('source',context.sources);add('tool',context.toolObservations);
  add('tool-history',context.toolObservations.filter(o=>['workspace.read','execution.run'].includes(o.tool)));
  add('runtime',context.runtimeObservations??[]);
  entries.sort((a,b)=>canonical([a.kind,a.id,a.hash]).localeCompare(canonical([b.kind,b.id,b.hash]),'en'));
  return validateObservedCatalog(entries.map((e,index)=>({sourceKey:'o'+(index+1),...e})));
}

// This is deliberately narrower than observedEvidenceCatalog().  A sourced
// reviewer receives raw admitted sources but does not own the producer's
// source-fetch receipts.  Its only controller proof is an exact, signed
// answer-boundary observation; exposing generic tool/history/runtime entries
// here would create an unauthorised second evidence route.
const sourcedCatalogError=(condition,message)=>check(condition,'REVIEW_ENCODING',message);
const sourcedCatalogGuard=(fn,message)=>{
  try{return fn();}
  catch(error){
    if(error?.code==='REVIEW_ENCODING')throw error;
    sourcedCatalogError(false,message);
  }
};
const sourcedCatalogIdentity=(value,{label,kind}={})=>sourcedCatalogGuard(()=>{
  const fields=kind===undefined?['id','hash']:['id','hash','kind'];
  keys(value,fields,fields,`${label} identity`);
  identifier(value.id,`${label} id`);digest(value.hash,`${label} hash`);
  if(kind!==undefined)sourcedCatalogError(value.kind===kind,`${label} kind is not the required sourced review boundary`);
  return kind===undefined?{id:value.id,hash:value.hash}:{id:value.id,hash:value.hash,kind:value.kind};
},`${label} identity is malformed`);
const sourcedContextIdentities=(items,{label,requireKind=false}={})=>sourcedCatalogGuard(()=>{
  list(items,`${label} context`,{max:5000});
  const seenIds=new Set(),seenIdentities=new Set();
  return items.map(item=>{
    sourcedCatalogError(item!==null&&typeof item==='object'&&!Array.isArray(item)
      &&Object.getPrototypeOf(item)===Object.prototype,`${label} context entry is malformed`);
    identifier(item.id,`${label} context id`);digest(item.hash,`${label} context hash`);
    if(requireKind)string(item.kind,`${label} context kind`,{max:180});
    const identity=canonical([item.id,item.hash]);
    sourcedCatalogError(!seenIds.has(item.id)&&!seenIdentities.has(identity),`${label} context has an ambiguous exact identity`);
    seenIds.add(item.id);seenIdentities.add(identity);
    return requireKind?{id:item.id,hash:item.hash,kind:item.kind}:{id:item.id,hash:item.hash};
  });
},`${label} context is malformed`);

/**
 * Construct the sole evidence menu for a sourced-response reviewer.  The
 * caller supplies controller-owned target and boundary identities, then this
 * helper proves they name exactly one item already exposed in the full worker
 * context.  It intentionally never reads tool observations and never exposes
 * non-target artifacts or non-boundary runtime observations.
 */
export function sourcedResponseReviewEvidenceCatalog(context,{targetArtifact,boundaryRuntimeObservation}={}){
  const target=sourcedCatalogIdentity(targetArtifact,{label:'Sourced review target artifact'});
  const boundary=sourcedCatalogIdentity(boundaryRuntimeObservation,{label:'Sourced review boundary runtime observation',kind:'sourced-answer-boundary'});
  const artifacts=sourcedContextIdentities(context?.artifacts,{label:'Artifact'});
  const sources=sourcedContextIdentities(context?.sources,{label:'Source'});
  const runtimes=sourcedContextIdentities(context?.runtimeObservations,{label:'Runtime observation',requireKind:true});
  const targetMatches=artifacts.filter(item=>item.id===target.id&&item.hash===target.hash);
  sourcedCatalogError(targetMatches.length===1,'Sourced review target artifact is not exactly exposed in this context');
  const boundaryMatches=runtimes.filter(item=>item.id===boundary.id&&item.hash===boundary.hash&&item.kind===boundary.kind);
  sourcedCatalogError(boundaryMatches.length===1,'Sourced review boundary runtime observation is not exactly exposed in this context');
  const entries=[{kind:'artifact',id:target.id,hash:target.hash},...sources.map(source=>({kind:'source',id:source.id,hash:source.hash})),
    {kind:'runtime',id:boundary.id,hash:boundary.hash}];
  sourcedCatalogError(entries.length<=5000,'Sourced review evidence catalog exceeds its explicit bound');
  entries.sort((a,b)=>canonical([a.kind,a.id,a.hash]).localeCompare(canonical([b.kind,b.id,b.hash]),'en'));
  return validateObservedCatalog(entries.map((entry,index)=>({sourceKey:'o'+(index+1),...entry})));
}

/** ID/hash are copied from the caller's exact admitted catalog, not guessed or
 * repaired from an incorrect model hash. Quotes and judgments remain unchanged;
 * existing registry acceptance still checks exposure, provenance and actors.
 */
export function expandCatalogReview(encoded,observed){
  validateObservedCatalog(observed);const byKey=new Map(observed.map(e=>[e.sourceKey,e]));
  keys(encoded,['artifactHash','purpose','decision','checks','evidence','findings','uncertainty']);
  list(encoded.evidence,'generated evidence',{max:1000});
  const expanded={...clone(encoded),evidence:encoded.evidence.map(entry=>{
    keys(entry,['evidenceId','sourceKey','quote']);identifier(entry.sourceKey);
    const source=byKey.get(entry.sourceKey);check(source,'REVIEW_ENCODING','Evidence key not present in the exact observed catalog');
    const {sourceKey,...identity}=source;
    return {...identity,evidenceId:entry.evidenceId,quote:entry.quote};
  })};
  return expandReviewReferences(expanded);
}

/** Offline/fixture transform only. Does not alter a saved judgment. */
export function compactCatalogReview(expanded,observed){
  validateObservedCatalog(observed);
  const byIdentity=new Map(observed.map(e=>[canonical([e.kind,e.id,e.hash]),e.sourceKey]));
  const compact=compactReviewEvidence(expanded);
  return {...compact,evidence:compact.evidence.map(e=>{
    const sourceKey=byIdentity.get(canonical([e.kind,e.id,e.hash]));
    check(sourceKey,'REVIEW_ENCODING','Original proof is absent from the observed catalog');
    return {evidenceId:e.evidenceId,sourceKey,quote:e.quote};
  })};
}

/** Reference expansion is a transport transform, not acceptance or entailment.
 * Unknown/unused entries fail, so no generated evidence vanishes unexamined.
 */
export function expandReviewReferences(encoded) {
  keys(encoded,['artifactHash','purpose','decision','checks','evidence','findings','uncertainty']);
  list(encoded.evidence,'review evidence catalog',{max:1000});
  list(encoded.checks,'review checks',{max:1000});
  const catalog = new Map(), used = new Set(), sizes = new Map();
  for (const entry of encoded.evidence) {
    keys(entry,['evidenceId','kind','id','hash','quote']); identifier(entry.evidenceId);
    check(!catalog.has(entry.evidenceId),'REVIEW_ENCODING','Duplicate evidence identifier');
    const {evidenceId,...proof} = entry; catalog.set(evidenceId,proof);
    sizes.set(evidenceId,Buffer.byteLength(canonical(proof))+1);
  }
  const {evidence: omittedCatalog, checks: omittedChecks, ...header} = encoded;
  let expandedBytes = Buffer.byteLength(canonical(header)) + 32;
  const byteBound = () => check(expandedBytes <= 4*1024*1024,'REVIEW_ENCODING','Expanded review exceeds the explicit 4 MiB bound');
  byteBound();
  let expandedEntries = 0;
  const checks = encoded.checks.map(checkValue => {
    keys(checkValue,['criterionId','verdict','evidenceIds','reason']);
    list(checkValue.evidenceIds,'check evidence identifiers',{max:1000});
    const {evidenceIds: omittedIds,...checkHeader} = checkValue;
    expandedBytes += Buffer.byteLength(canonical(checkHeader)) + 32; byteBound();
    const seen = new Set();
    const evidence = checkValue.evidenceIds.map(id => {
      identifier(id);
      check(catalog.has(id)&&!seen.has(id),'REVIEW_ENCODING','Dangling or repeated evidence reference');
      check(++expandedEntries<=10000,'REVIEW_ENCODING','Expanded evidence count exceeds explicit bound');
      expandedBytes += sizes.get(id); byteBound();
      used.add(id);seen.add(id);return clone(catalog.get(id));
    });
    const {evidenceIds,...rest} = checkValue;
    return {...rest,evidence};
  });
  check(used.size===catalog.size,'REVIEW_ENCODING','Unused generated evidence must not disappear during expansion');
  const {evidence,...rest} = encoded;
  return {...clone(rest),checks};
}

/** Offline/fixture encoder for equivalence and size measurement. Does not
 * rewrite a saved review or assert that a model will use this encoding well.
 */
export function compactReviewEvidence(expanded) {
  const catalog=[], byValue=new Map();
  const checks=expanded.checks.map(checkValue=>{
    const evidenceIds=checkValue.evidence.map(evidence=>{
      const key=canonical(evidence);
      if(!byValue.has(key)){const id=`e${byValue.size+1}`;byValue.set(key,id);catalog.push({...clone(evidence),evidenceId:id});}
      return byValue.get(key);
    });
    check(new Set(evidenceIds).size===evidenceIds.length,'REVIEW_ENCODING','Cannot encode duplicate evidence within one check without loss');
    const {evidence,...rest}=checkValue;return {...clone(rest),evidenceIds};
  });
  return {...clone(expanded),checks,evidence:catalog};
}
