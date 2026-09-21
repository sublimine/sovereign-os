import {canonical, check, clone, digest, identifier, integer, keys, list, string, unique, sha256} from './contracts.mjs';
import {assertCommittedStoreBoundary} from './store.mjs';
import {assertGenuineArtifactRegistry} from './artifacts.mjs';

// The manifest is an authoring shape only. It cannot qualify an efficiency
// claim until the Store-backed ledger commits it as a durable prerequisite.
export const PREREGISTERED_EFFICIENCY_SCHEMA='sovereign.preregistered-efficiency-comparison.v2';
export const PREREGISTERED_EFFICIENCY_ARM_SCHEMA='sovereign.preregistered-efficiency-arm.v2';
export const PREREGISTERED_EFFICIENCY_EVIDENCE_SCHEMA='sovereign.preregistered-efficiency-evidence.v2';
export const PREREGISTERED_EFFICIENCY_RESULT_SCHEMA='sovereign.preregistered-efficiency-result.v2';
export const PREREGISTERED_EFFICIENCY_RECORD_TYPE='efficiency-preregistration';
export const PREREGISTERED_EFFICIENCY_ARM_RECORD_TYPE='efficiency-comparison-arm';
export const EFFICIENCY_MEASUREMENT_RECORD_TYPE='efficiency-measurement';
export const EFFICIENCY_MEASUREMENT_SCHEMA='sovereign.efficiency-measurement.v1';
export const EFFICIENCY_COVERAGE_RECORD_TYPE='efficiency-coverage-evidence';
export const EFFICIENCY_COVERAGE_SCHEMA='sovereign.efficiency-coverage-evidence.v1';
export const EFFICIENCY_DECISIONS=Object.freeze(['PASS','FAIL','UNKNOWN']);

const METRIC_KINDS=Object.freeze(['cost','latency']);
const OUTCOMES=Object.freeze(['PASS','FAIL','UNKNOWN']);
const ledgers=new WeakSet(),ledgerStates=new WeakMap(),evidenceAdapters=new WeakSet(),materialEvidenceAdapters=new WeakSet(),adapterMetadata=new WeakMap();
const same=(left,right)=>canonical(left)===canonical(right);
const referenceKey=value=>canonical(value);
const freeze=value=>{
  if(value&&typeof value==='object'&&!Object.isFrozen(value)){
    for(const item of Object.values(value))freeze(item);
    Object.freeze(value);
  }
  return value;
};

function recordRef(value,label){
  keys(value,['type','id','version','hash'],undefined,label);
  identifier(value.type,`${label}.type`);identifier(value.id,`${label}.id`);integer(value.version,`${label}.version`,{min:1});digest(value.hash,`${label}.hash`);
  return {type:value.type,id:value.id,version:value.version,hash:value.hash};
}

function recordReference(record,label='record'){
  check(record&&typeof record==='object','EFFICIENCY_REFERENCE',`${label} is missing`);
  return recordRef({type:record.type,id:record.id,version:record.version,hash:record.hash},label);
}

function evidence(value,label){
  list(value,label,{min:1,max:100});
  const parsed=value.map((item,index)=>recordRef(item,`${label}[${index}]`));
  unique(parsed.map(referenceKey),`${label} references`);
  return parsed.sort((a,b)=>referenceKey(a).localeCompare(referenceKey(b)));
}

function obligationSet(value,label){
  list(value,label,{min:1,max:1000});
  const parsed=value.map((item,index)=>recordRef(item,`${label}[${index}]`));
  unique(parsed.map(item=>canonical([item.type,item.id])),`${label} identities`);
  return parsed.sort((a,b)=>referenceKey(a).localeCompare(referenceKey(b)));
}

function metricSet(value,label){
  list(value,label,{min:2,max:100});
  const parsed=value.map((item,index)=>{
    keys(item,['id','kind','unit'],undefined,`${label}[${index}]`);
    identifier(item.id,`${label}[${index}].id`);
    check(METRIC_KINDS.includes(item.kind),'EFFICIENCY_METRIC',`${label}[${index}].kind must be cost or latency`);
    string(item.unit,`${label}[${index}].unit`,{min:1,max:64});
    check(item.unit.trim().length>0,'EFFICIENCY_UNIT',`${label}[${index}].unit must be explicit`);
    return {id:item.id,kind:item.kind,unit:item.unit};
  });
  unique(parsed.map(item=>item.id),`${label} ids`);
  check(parsed.some(item=>item.kind==='cost'),'EFFICIENCY_METRIC','At least one cost measurement is required');
  check(parsed.some(item=>item.kind==='latency'),'EFFICIENCY_METRIC','At least one latency measurement is required');
  return parsed.sort((a,b)=>a.id.localeCompare(b.id));
}

/** Validate an untrusted authoring manifest. This does not qualify evidence. */
export function preregisterEfficiencyComparison(value){
  keys(value,['schema','id','case','obligations','metrics'],undefined,'efficiency preregistration');
  check(value.schema===PREREGISTERED_EFFICIENCY_SCHEMA,'EFFICIENCY_SCHEMA','Unsupported preregistration schema');
  identifier(value.id,'efficiency preregistration id');
  const registered={schema:value.schema,id:value.id,case:recordRef(value.case,'efficiency case'),
    obligations:obligationSet(value.obligations,'efficiency obligations'),metrics:metricSet(value.metrics,'efficiency metrics')};
  return freeze(clone(registered));
}

function coverage(value,registration,label){
  list(value,label,{min:1,max:1000});
  const expected=registration.obligations.map(referenceKey).sort();
  const parsed=value.map((item,index)=>{
    keys(item,['obligation','verdict','evidence'],undefined,`${label}[${index}]`);
    const obligation=recordRef(item.obligation,`${label}[${index}].obligation`);
    check(OUTCOMES.includes(item.verdict),'EFFICIENCY_COVERAGE',`${label}[${index}].verdict is invalid`);
    return {obligation,verdict:item.verdict,evidence:evidence(item.evidence,`${label}[${index}].evidence`)};
  });
  unique(parsed.map(item=>referenceKey(item.obligation)),`${label} obligation references`);
  check(same(parsed.map(item=>referenceKey(item.obligation)).sort(),expected),'EFFICIENCY_COVERAGE',
    `${label} does not cover the preregistered obligations exactly`);
  return parsed.sort((a,b)=>referenceKey(a.obligation).localeCompare(referenceKey(b.obligation)));
}

function quality(value,registration,label){
  keys(value,['outcome','correctnessEvidence','reviewEvidence','coverage'],undefined,label);
  check(OUTCOMES.includes(value.outcome),'EFFICIENCY_QUALITY',`${label}.outcome is invalid`);
  const parsed={outcome:value.outcome,correctnessEvidence:evidence(value.correctnessEvidence,`${label}.correctnessEvidence`),
    reviewEvidence:evidence(value.reviewEvidence,`${label}.reviewEvidence`),coverage:coverage(value.coverage,registration,`${label}.coverage`)};
  check(!parsed.correctnessEvidence.some(ref=>parsed.reviewEvidence.some(other=>same(ref,other))),'EFFICIENCY_QUALITY',
    `${label} cannot relabel one record as both correctness and independent review evidence`);
  if(parsed.outcome==='PASS')check(parsed.coverage.every(item=>item.verdict==='PASS'),'EFFICIENCY_QUALITY',
    `${label} cannot claim PASS while any preregistered obligation is not PASS`);
  return parsed;
}

function measurements(value,registration,label){
  list(value,label,{min:registration.metrics.length,max:registration.metrics.length});
  const metricById=new Map(registration.metrics.map(metric=>[metric.id,metric]));
  const parsed=value.map((item,index)=>{
    check(item&&typeof item==='object'&&!Array.isArray(item),'SCHEMA',`${label}[${index}] must be an object`);
    identifier(item.metricId,`${label}[${index}].metricId`);
    const metric=metricById.get(item.metricId);
    check(metric,'EFFICIENCY_METRIC',`${label}[${index}] is not preregistered`);
    check(item.unit===metric.unit,'EFFICIENCY_UNIT',`${label}[${index}].unit differs from preregistration`);
    if(item.status==='KNOWN'){
      keys(item,['metricId','status','unit','value','evidence'],undefined,`${label}[${index}]`);
      check(Number.isFinite(item.value)&&item.value>=0,'EFFICIENCY_MEASUREMENT',`${label}[${index}].value must be a nonnegative finite number`);
      return {metricId:item.metricId,status:'KNOWN',unit:item.unit,value:item.value,evidence:recordRef(item.evidence,`${label}[${index}].evidence`)};
    }
    if(item.status==='UNKNOWN'){
      keys(item,['metricId','status','unit','reason','evidence'],undefined,`${label}[${index}]`);
      string(item.reason,`${label}[${index}].reason`,{min:1,max:16000});
      check(item.reason.trim().length>0,'EFFICIENCY_MEASUREMENT',`${label}[${index}].reason is empty`);
      return {metricId:item.metricId,status:'UNKNOWN',unit:item.unit,reason:item.reason,evidence:recordRef(item.evidence,`${label}[${index}].evidence`)};
    }
    check(false,'EFFICIENCY_MEASUREMENT',`${label}[${index}].status must be KNOWN or UNKNOWN`);
  });
  unique(parsed.map(item=>item.metricId),`${label} metric ids`);
  check(same(parsed.map(item=>item.metricId).sort(),registration.metrics.map(item=>item.id)),'EFFICIENCY_METRIC',
    `${label} does not cover the preregistered measurements exactly`);
  return parsed.sort((a,b)=>a.metricId.localeCompare(b.metricId));
}

function arm(value,registration,label){
  keys(value,['schema','registration','arm','case','obligations','quality','measurements'],undefined,label);
  check(value.schema===PREREGISTERED_EFFICIENCY_ARM_SCHEMA,'EFFICIENCY_SCHEMA',`${label} has an unsupported schema`);
  check(['baseline','candidate'].includes(value.arm),'EFFICIENCY_ARM',`${label}.arm is invalid`);
  const parsed={schema:value.schema,registration:recordRef(value.registration,`${label}.registration`),arm:value.arm,
    case:recordRef(value.case,`${label}.case`),obligations:obligationSet(value.obligations,`${label}.obligations`),
    quality:quality(value.quality,registration,`${label}.quality`),measurements:measurements(value.measurements,registration,`${label}.measurements`)};
  check(same(parsed.case,registration.case),'EFFICIENCY_CASE',`${label} used a different case than the preregistration`);
  check(same(parsed.obligations,registration.obligations),'EFFICIENCY_OBLIGATION',`${label} used different obligations than the preregistration`);
  return parsed;
}

function envelope(value){
  keys(value,['schema','registration','baseline','candidate'],undefined,'efficiency comparison evidence');
  check(value.schema===PREREGISTERED_EFFICIENCY_EVIDENCE_SCHEMA,'EFFICIENCY_SCHEMA','Unsupported evidence schema');
  const parsed={registration:recordRef(value.registration,'efficiency preregistration reference'),
    baseline:recordRef(value.baseline,'baseline arm reference'),candidate:recordRef(value.candidate,'candidate arm reference')};
  check(!same(parsed.baseline,parsed.candidate),'EFFICIENCY_ARM','Baseline and candidate must be distinct durable records');
  return parsed;
}

// createdAt is intentionally never consulted. The Store private-brand helper
// rejects facades and active Store transactions before a material boundary.
function requireCommittedBoundary(store,operation){
  return assertCommittedStoreBoundary(store,{code:'EFFICIENCY_COMMIT_BOUNDARY',message:`${operation} requires a previously committed journal boundary`});
}

function resolveRecord(store,value,label,{current=false}={}){
  const reference=recordRef(value,label),record=store.get(reference.type,reference.id,reference.version);
  check(record&&record.hash===reference.hash&&sha256(record.data)===reference.hash,'EFFICIENCY_REFERENCE',
    `${label} does not resolve to its exact immutable Store record`);
  if(current){
    const head=store.get(reference.type,reference.id);
    check(head&&head.version===reference.version&&head.hash===reference.hash,'EFFICIENCY_IMMUTABILITY',
      `${label} was superseded and cannot be reinterpreted as the active comparison boundary`);
  }
  return {reference,record};
}

function sequenceFor(store,reference,label){
  let after=0;
  for(;;){
    const events=store.events({after,limit:1000});
    for(const event of events)if(event.kind==='record.committed'&&event.data?.type===reference.type&&event.data?.id===reference.id
      &&event.data?.version===reference.version&&event.data?.hash===reference.hash)return event.seq;
    if(!events.length)break;
    after=events.at(-1).seq;
  }
  check(false,'EFFICIENCY_CHRONOLOGY',`${label} has no committed journal position`);
}

function assertBefore(store,prior,later,label){
  const priorSequence=sequenceFor(store,prior,`${label} prerequisite`),laterSequence=sequenceFor(store,later,`${label} dependent`);
  check(priorSequence<laterSequence,'EFFICIENCY_CHRONOLOGY',`${label} is not in committed prerequisite order`);
  return {priorSequence,laterSequence};
}

function registrationRecordId(definition){ return `efficiency-preregistration:${definition.id}`; }
function armRecordId(registration,side){ return `efficiency-arm:${sha256(registration)}:${side}`; }

function stateFor(ledger){
  check(ledgers.has(ledger),'EFFICIENCY_LEDGER','Qualification requires a Store-backed preregistration ledger');
  return ledgerStates.get(ledger);
}

function validateAdapter(adapter){
  check(evidenceAdapters.has(adapter),'EFFICIENCY_EVIDENCE_ADAPTER',
    'Evidence verification requires an explicit adapter created by createEfficiencyEvidenceAdapter()');
  return adapter;
}

function validateQualifyingAdapter(adapter,store){
  validateAdapter(adapter);
  check(materialEvidenceAdapters.has(adapter),'EFFICIENCY_EVIDENCE_ADAPTER',
    'Efficiency qualification requires createArtifactRegistryEfficiencyEvidenceAdapter(); generic callbacks are analysis-only');
  const metadata=adapterMetadata.get(adapter);
  check(metadata?.store===store,'EFFICIENCY_EVIDENCE_ADAPTER',
    'Material ArtifactRegistry evidence adapter belongs to another Store');
  return adapter;
}

/** The ledger resolves every Store ref/hash before calling these semantic
 * callbacks, so the callback cannot turn a caller-invented hash into proof. */
export function createEfficiencyEvidenceAdapter({assertCorrectness,assertReview}={}){
  check(typeof assertCorrectness==='function'&&typeof assertReview==='function','CONFIG',
    'A complete correctness and independent-review evidence adapter is required');
  const adapter=Object.freeze({assertCorrectness,assertReview});
  evidenceAdapters.add(adapter);return adapter;
}

/** ArtifactRegistry wiring for Factory artifacts. Generic external evidence
 * must use its own explicit semantic adapter. */
export function createArtifactRegistryEfficiencyEvidenceAdapter(registry){
  assertGenuineArtifactRegistry(registry,{code:'EFFICIENCY_EVIDENCE_ADAPTER',
    message:'A genuine ArtifactRegistry is required for material efficiency evidence'});
  const store=registry.store;
  const threadIds=run=>new Set([run?.providerThreadId,...(run?.inferenceReceipts??[]).map(receipt=>receipt.threadId),run?.inferenceReceipt?.threadId]
    .filter(value=>typeof value==='string'&&value.length>0));
  const adapter=createEfficiencyEvidenceAdapter({
    assertCorrectness:({reference,record})=>{
      check(reference.type==='artifact'&&record.data?.id===record.id&&record.data.status==='ACCEPTED'
        &&record.data.payloadHash===sha256(record.data.payload),'EFFICIENCY_CORRECTNESS',
      'Correctness evidence must be an accepted, intact Factory artifact');
      const head=store.get('artifact',record.id);
      check(head&&head.version===record.version&&head.hash===record.hash,'EFFICIENCY_CORRECTNESS',
        'Correctness artifact is no longer the current accepted record');
      registry.assertUsable(record.id,{missionId:record.data.missionId,purpose:record.data.payload.purpose});
    },
    assertReview:({reference,record,correctnessEvidence})=>{
      check(reference.type==='review'&&record.data?.id===record.id&&record.data.result?.decision==='ACCEPT','EFFICIENCY_REVIEW',
        'Review evidence must be a stored ACCEPT review');
      const review=record.data,artifact=store.get('artifact',review.artifactId);
      check(artifact?.data?.status==='ACCEPTED'&&artifact.data.payloadHash===review.result.artifactHash&&artifact.data.reviews?.includes(record.id),
        'EFFICIENCY_REVIEW','Review is not retained by its accepted artifact');
      const matched=correctnessEvidence.some(item=>item.reference.type==='artifact'&&item.reference.id===artifact.id
        &&item.reference.version===artifact.version&&item.reference.hash===artifact.hash);
      check(matched,'EFFICIENCY_REVIEW','Independent review must review a cited correctness artifact');
      const producer=store.get('run',artifact.data.payload.producerRunId)?.data,reviewer=store.get('run',review.reviewerRunId)?.data;
      check(producer&&reviewer?.mode==='reviewer'&&reviewer.missionId===artifact.data.missionId&&reviewer.id!==producer.id
        &&reviewer.context?.producerConversationIncluded===false,'EFFICIENCY_REVIEW',
      'Review evidence lacks an independent reviewer identity');
      const producerThreads=threadIds(producer),reviewerThreads=threadIds(reviewer);
      check(![...reviewerThreads].some(threadId=>producerThreads.has(threadId)),'EFFICIENCY_REVIEW',
        'Review evidence reuses the producer provider thread');
      check(Number.isSafeInteger(registry.committedSequence('review',record.id,record.version))
        &&Number.isSafeInteger(registry.committedSequence('artifact',artifact.id,artifact.version)),'EFFICIENCY_REVIEW',
      'Artifact review evidence lacks committed registry chronology');
      registry.reviewProgress(artifact.id);
      registry.assertUsable(artifact.id,{missionId:artifact.data.missionId,purpose:artifact.data.payload.purpose});
    }
  });
  materialEvidenceAdapters.add(adapter);adapterMetadata.set(adapter,{store});return adapter;
}

export function createPreregisteredEfficiencyComparisonLedger(store,{evidenceAdapter}={}){
  requireCommittedBoundary(store,'Efficiency qualification ledger');validateQualifyingAdapter(evidenceAdapter,store);
  let ledger;
  ledger=Object.freeze({
    preregister:value=>registerPreregisteredEfficiencyComparison(ledger,value),
    recordArm:value=>recordPreregisteredEfficiencyArm(ledger,value),
    evaluate:value=>evaluatePreregisteredEfficiencyComparison(ledger,value)
  });
  ledgers.add(ledger);ledgerStates.set(ledger,{store,evidenceAdapter});return ledger;
}

function resolveRegistration(ledger,value){
  const {store}=stateFor(ledger),resolved=resolveRecord(store,value,'durable preregistration',{current:true});
  check(resolved.record.type===PREREGISTERED_EFFICIENCY_RECORD_TYPE&&resolved.record.version===1,'EFFICIENCY_PREREGISTRATION',
    'Preregistration must be the immutable first Store record');
  const definition=preregisterEfficiencyComparison(resolved.record.data);
  check(resolved.record.id===registrationRecordId(definition),'EFFICIENCY_PREREGISTRATION',
    'Preregistration record identity does not bind its definition');
  for(const root of [definition.case,...definition.obligations]){
    resolveRecord(store,root,'preregistration root');assertBefore(store,root,resolved.reference,'case/obligation before preregistration');
  }
  return {...resolved,definition};
}

/** Commit only after case/obligation roots. Re-entry is allowed only for the
 * byte-identical first registration; a later writer can never update it. */
export function registerPreregisteredEfficiencyComparison(ledger,value){
  const {store}=stateFor(ledger);requireCommittedBoundary(store,'Preregistration');
  const definition=preregisterEfficiencyComparison(value),recordId=registrationRecordId(definition);
  return store.transact(()=>{
    for(const root of [definition.case,...definition.obligations])resolveRecord(store,root,'preregistration root');
    const existing=store.get(PREREGISTERED_EFFICIENCY_RECORD_TYPE,recordId);
    if(existing){
      check(existing.version===1&&same(existing.data,definition),'EFFICIENCY_PREREGISTRATION',
        'A preregistration identity already binds a different immutable definition');
      return resolveRegistration(ledger,recordReference(existing,'existing preregistration')).reference;
    }
    const record=store.put(PREREGISTERED_EFFICIENCY_RECORD_TYPE,recordId,definition,{expectedVersion:0}),reference=recordReference(record,'preregistration');
    for(const root of [definition.case,...definition.obligations])assertBefore(store,root,reference,'case/obligation before preregistration');
    return reference;
  });
}

function assertCoverageEvidence(store,item,side){
  const resolved=resolveRecord(store,item.evidence,'coverage evidence'),data=resolved.record.data;
  check(resolved.record.type===EFFICIENCY_COVERAGE_RECORD_TYPE,'EFFICIENCY_COVERAGE',
    'Coverage evidence must be a real efficiency-coverage Store record');
  keys(data,['schema','arm','obligation','verdict'],undefined,'stored coverage evidence');
  check(data.schema===EFFICIENCY_COVERAGE_SCHEMA&&data.arm===side&&data.verdict===item.verdict&&same(recordRef(data.obligation,'stored coverage obligation'),item.obligation),
    'EFFICIENCY_COVERAGE','Coverage evidence does not bind this arm, obligation and verdict');
  return resolved;
}

function assertMeasurementEvidence(store,item,side){
  const resolved=resolveRecord(store,item.evidence,'measurement evidence'),data=resolved.record.data;
  check(resolved.record.type===EFFICIENCY_MEASUREMENT_RECORD_TYPE,'EFFICIENCY_MEASUREMENT',
    'Measurement evidence must be a real efficiency-measurement Store record');
  if(item.status==='KNOWN'){
    keys(data,['schema','arm','metricId','status','unit','value'],undefined,'stored measurement evidence');
    check(data.schema===EFFICIENCY_MEASUREMENT_SCHEMA&&data.arm===side&&data.metricId===item.metricId&&data.status==='KNOWN'
      &&data.unit===item.unit&&data.value===item.value,'EFFICIENCY_MEASUREMENT',
    'Measurement evidence does not bind this arm and known value');
  }else{
    keys(data,['schema','arm','metricId','status','unit','reason'],undefined,'stored measurement evidence');
    check(data.schema===EFFICIENCY_MEASUREMENT_SCHEMA&&data.arm===side&&data.metricId===item.metricId&&data.status==='UNKNOWN'
      &&data.unit===item.unit&&data.reason===item.reason,'EFFICIENCY_MEASUREMENT',
    'Measurement evidence does not bind this arm and unknown value');
  }
  return resolved;
}

function validateArmEvidence(ledger,parsed,registration,{armReference=null}={}){
  const {store,evidenceAdapter}=stateFor(ledger),correctness=parsed.quality.correctnessEvidence.map(ref=>resolveRecord(store,ref,'correctness evidence')),
    reviews=parsed.quality.reviewEvidence.map(ref=>resolveRecord(store,ref,'independent review evidence')),
    coverageRecords=parsed.quality.coverage.flatMap(item=>item.evidence.map(ref=>assertCoverageEvidence(store,{...item,evidence:ref},parsed.arm))),
    measurementRecords=parsed.measurements.map(item=>assertMeasurementEvidence(store,item,parsed.arm));
  for(const item of correctness)evidenceAdapter.assertCorrectness({reference:item.reference,record:item.record,arm:parsed.arm,registration:registration.definition});
  for(const item of reviews)evidenceAdapter.assertReview({reference:item.reference,record:item.record,arm:parsed.arm,registration:registration.definition,
    correctnessEvidence:correctness});
  const records=[...correctness,...reviews,...coverageRecords,...measurementRecords];
  unique(records.map(item=>referenceKey(item.reference)),'arm evidence references');
  for(const item of records)assertBefore(store,registration.reference,item.reference,'preregistration before arm evidence');
  if(armReference){
    assertBefore(store,registration.reference,armReference,'preregistration before arm');
    for(const item of records)assertBefore(store,item.reference,armReference,'arm evidence before arm record');
  }
  return records.map(item=>item.reference);
}

function resolveArm(ledger,value,registration,side){
  const {store}=stateFor(ledger),resolved=resolveRecord(store,value,`${side} arm`,{current:true});
  check(resolved.record.type===PREREGISTERED_EFFICIENCY_ARM_RECORD_TYPE&&resolved.record.version===1,'EFFICIENCY_ARM',
    `${side} must be the immutable first arm record`);
  const parsed=arm(resolved.record.data,registration.definition,side);
  check(parsed.arm===side&&same(parsed.registration,registration.reference)&&resolved.record.id===armRecordId(registration.reference,side),
    'EFFICIENCY_ARM',`${side} arm does not bind this preregistration`);
  return {...resolved,parsed,evidenceReferences:validateArmEvidence(ledger,parsed,registration,{armReference:resolved.reference})};
}

/** Record an arm only after registration and every observation were committed.
 * The Store boundary makes a same-transaction post-hoc bundle impossible. */
export function recordPreregisteredEfficiencyArm(ledger,value){
  const {store}=stateFor(ledger);requireCommittedBoundary(store,'Efficiency arm');
  const registration=resolveRegistration(ledger,value?.registration),parsed=arm(value,registration.definition,'efficiency arm');
  check(same(parsed.registration,registration.reference),'EFFICIENCY_ARM','Arm must cite the exact durable preregistration record');
  const recordId=armRecordId(registration.reference,parsed.arm);
  return store.transact(()=>{
    const currentRegistration=resolveRegistration(ledger,registration.reference),existing=store.get(PREREGISTERED_EFFICIENCY_ARM_RECORD_TYPE,recordId);
    if(existing){
      check(existing.version===1&&same(existing.data,parsed),'EFFICIENCY_ARM','Arm identity already binds different immutable evidence');
      return resolveArm(ledger,recordReference(existing,'existing arm'),currentRegistration,parsed.arm).reference;
    }
    validateArmEvidence(ledger,parsed,currentRegistration);
    const record=store.put(PREREGISTERED_EFFICIENCY_ARM_RECORD_TYPE,recordId,parsed,{expectedVersion:0}),reference=recordReference(record,'efficiency arm');
    validateArmEvidence(ledger,parsed,currentRegistration,{armReference:reference});return reference;
  });
}

function qualityDecision(baseline,candidate){
  const outcomes=[baseline.quality.outcome,candidate.quality.outcome];
  if(outcomes.includes('FAIL'))return 'FAIL';
  if(outcomes.includes('UNKNOWN'))return 'UNKNOWN';
  return 'PASS';
}

/** Qualify only the durable three-record relation. The former one-argument
 * nested form is rejected because it can certify its own chronology. */
export function evaluatePreregisteredEfficiencyComparison(ledger,value){
  const {store}=stateFor(ledger);requireCommittedBoundary(store,'Efficiency qualification');
  const request=envelope(value),registration=resolveRegistration(ledger,request.registration),baseline=resolveArm(ledger,request.baseline,registration,'baseline'),
    candidate=resolveArm(ledger,request.candidate,registration,'candidate');
  check(!baseline.evidenceReferences.some(ref=>candidate.evidenceReferences.some(other=>same(ref,other))),'EFFICIENCY_ARM',
    'Baseline and candidate cannot reuse a result/evidence record');
  const quality=qualityDecision(baseline.parsed,candidate.parsed),baselineMeasurements=new Map(baseline.parsed.measurements.map(item=>[item.metricId,item])),
    candidateMeasurements=new Map(candidate.parsed.measurements.map(item=>[item.metricId,item]));
  const metrics=registration.definition.metrics.map(metric=>{
    const before=baselineMeasurements.get(metric.id),after=candidateMeasurements.get(metric.id);
    if(before.status==='UNKNOWN'||after.status==='UNKNOWN')return {id:metric.id,kind:metric.kind,unit:metric.unit,baseline:null,candidate:null,delta:null,relation:'UNKNOWN'};
    const delta=before.value-after.value;
    return {id:metric.id,kind:metric.kind,unit:metric.unit,baseline:before.value,candidate:after.value,delta,
      relation:delta>0?'LOWER':delta<0?'HIGHER':'EQUAL'};
  });
  let decision,reason;
  if(quality==='FAIL'){decision='FAIL';reason='QUALITY_OR_COVERAGE_FAILED';}
  else if(quality==='UNKNOWN'){decision='UNKNOWN';reason='QUALITY_OR_COVERAGE_UNKNOWN';}
  else if(metrics.some(metric=>metric.relation==='UNKNOWN')){decision='UNKNOWN';reason='MEASUREMENT_UNKNOWN';}
  else if(metrics.some(metric=>metric.relation==='HIGHER')){decision='FAIL';reason='CANDIDATE_COST_OR_LATENCY_INCREASED';}
  else if(metrics.every(metric=>metric.relation==='EQUAL')){decision='FAIL';reason='NO_MEASURED_SAVING';}
  else{decision='PASS';reason='MEASURED_SAVING_WITH_PRESERVED_QUALITY';}
  return clone({schema:PREREGISTERED_EFFICIENCY_RESULT_SCHEMA,preregistration:clone(registration.reference),preregistrationHash:registration.reference.hash,
    baseline:clone(baseline.reference),candidate:clone(candidate.reference),decision,efficiencyPass:decision==='PASS',reason,
    quality:{baseline:baseline.parsed.quality.outcome,candidate:candidate.parsed.quality.outcome},metrics,
    savings:decision==='PASS'?metrics.map(metric=>({metricId:metric.id,unit:metric.unit,delta:metric.delta})):null});
}
