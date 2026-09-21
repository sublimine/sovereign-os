import {canonical,check,clone,digest,id,identifier,instant,integer,keys,list,safeCode,sha256,string,unique} from './contracts.mjs';
import {assertAdaptiveV3MissionRoute} from './adaptive-v3-route-contract.mjs';
import {ADAPTIVE_V3_DIRECT_ENTRY_MODE} from './adaptive-v3-routing.mjs';

// Learning is an optional, separately governed control plane.  A completed
// adaptive-v3 direct result has no model work, historical rejection or
// evaluated execution to learn from.  Keep this fence in the lowest learning
// layer as well as at service/conductor entry points: callers can construct a
// LearningRegistry directly, and a public SDK path must not turn a direct
// deterministic mission into later provider work.
export const ADAPTIVE_V3_LEARNING_BOUNDARY='ADAPTIVE_V3_ROUTE_INTEGRITY';

const boundary=(condition,message,details={})=>check(condition,ADAPTIVE_V3_LEARNING_BOUNDARY,message,details);
const validIdentifier=value=>{
  try{identifier(value);return true;}catch{return false;}
};
const validDigest=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
const storedIdentifier=(value,label)=>{
  boundary(validIdentifier(value),`${label} is missing a valid mission identity`);
  return value;
};

/** Read an adaptive-v3 mission route without treating a direct route as
 * permission.  This remains useful to the conductor's zero-write discovery
 * path, which intentionally returns no opportunities for a direct mission. */
export function adaptiveV3LearningMissionFacts(store,authority,missionId,{subject='learning operation'}={}){
  storedIdentifier(missionId,`${subject} mission`);
  return assertAdaptiveV3MissionRoute(store,authority,missionId);
}

export function isAdaptiveV3DirectLearningMission(store,authority,missionId,{subject='learning operation'}={}){
  return adaptiveV3LearningMissionFacts(store,authority,missionId,{subject})?.decision?.selectedEntryMode===ADAPTIVE_V3_DIRECT_ENTRY_MODE;
}

export function assertAdaptiveV3LearningMissionAllowed(store,authority,missionId,{subject='learning operation'}={}){
  const facts=adaptiveV3LearningMissionFacts(store,authority,missionId,{subject});
  boundary(facts?.decision?.selectedEntryMode!==ADAPTIVE_V3_DIRECT_ENTRY_MODE,
    `${subject} is forbidden for an adaptive-v3 deterministic direct mission`,{missionId});
  return facts;
}

export function assertAdaptiveV3LearningDatasetAllowed(store,authority,datasetSpec,{subject='learning dataset'}={}){
  return assertAdaptiveV3LearningMissionAllowed(store,authority,storedIdentifier(datasetSpec?.missionId,`${subject} dataset`),{subject});
}

function assertAdaptiveV3LearningDatasetHashAllowed(store,authority,datasetHash,{subject='learning dataset'}={}){
  // A malformed ordinary frozen dataset is diagnosed by the pre-existing
  // learning/domain validators.  Only follow a *verifiable* linkage here so
  // the direct-v3 fence does not relabel legacy corruption as a v3 route error.
  if(!validDigest(datasetHash))return null;
  const record=store.get('learning-dataset',datasetHash);
  if(record?.version!==1||!record.data||typeof record.data!=='object'||!validIdentifier(record.data.missionId))return null;
  return assertAdaptiveV3LearningMissionAllowed(store,authority,record.data.missionId,{subject});
}

export function assertAdaptiveV3LearningRunAllowed(store,authority,runId,{subject='learning run'}={}){
  // Existing callers may use an external immutable author identity rather
  // than a Factory run record.  Absence therefore preserves legacy behavior;
  // an existing malformed record, however, never becomes a route bypass.
  identifier(runId,`${subject} id`);
  const record=store.get('run',runId);
  if(!record)return null;
  if(!validIdentifier(record.data?.missionId))return null;
  return assertAdaptiveV3LearningMissionAllowed(store,authority,record.data.missionId,{subject});
}

export function assertAdaptiveV3LearningRoleAllowed(store,authority,roleId,{subject='learning role'}={}){
  identifier(roleId,`${subject} id`);
  const record=store.get('learning-role',roleId);
  if(!record)return null;
  if(Object.hasOwn(record.data,'missionId')&&validIdentifier(record.data.missionId))
    assertAdaptiveV3LearningMissionAllowed(store,authority,record.data.missionId,{subject});
  return assertAdaptiveV3LearningDatasetHashAllowed(store,authority,record.data?.datasetHash,{subject});
}

function assertAdaptiveV3LearningCandidateOriginAllowed(store,authority,candidate,{subject='learning candidate'}={}){
  if(!candidate||typeof candidate!=='object')return null;
  // Keep this order intentional.  An explicit direct mission remains
  // attributable even when another retained field is malformed; do not let a
  // bad role/dataset/run shape turn a known direct candidate into a bypass.
  if(Object.hasOwn(candidate,'missionId')&&validIdentifier(candidate.missionId))
    assertAdaptiveV3LearningMissionAllowed(store,authority,candidate.missionId,{subject});
  if(validDigest(candidate.datasetHash))assertAdaptiveV3LearningDatasetHashAllowed(store,authority,candidate.datasetHash,{subject});
  if(validIdentifier(candidate.roleId))assertAdaptiveV3LearningRoleAllowed(store,authority,candidate.roleId,{subject});
  if(validIdentifier(candidate.authorRunId))assertAdaptiveV3LearningRunAllowed(store,authority,candidate.authorRunId,{subject});
  return null;
}

function candidatesForInstruction(store,roleId,instructionHash){
  return store.list('learning-candidate').filter(record=>record.data&&typeof record.data==='object'
    &&record.data.roleId===roleId&&record.data.instructionHash===instructionHash);
}

/**
 * A role persists only an instruction hash, while proposals persist the
 * author/dataset facts that make that hash admissible.  Resolve the complete
 * parent chain before treating a non-baseline hash as a safe parent.  There
 * must be exactly one retained candidate for every activated non-baseline
 * hash: accepting one of several matching rows would make the origin
 * ambiguous, and an attacker could hide a direct-v3 author behind a benign
 * duplicate.
 */
export function assertAdaptiveV3LearningInstructionLineageAllowed(store,authority,roleId,instructionHash,{subject='learning instruction lineage',seen=new Set()}={}){
  identifier(roleId,`${subject} role id`);
  if(!validDigest(instructionHash))return null;
  const roleRecord=store.get('learning-role',roleId);
  if(!roleRecord)return null;
  const role=roleRecord.data;
  assertAdaptiveV3LearningRoleAllowed(store,authority,roleId,{subject});
  if(!validDigest(role?.baselineHash)||instructionHash===role.baselineHash)return null;
  const key=`${roleId}:${instructionHash}`;
  boundary(!seen.has(key),`${subject} contains a cyclic instruction lineage`,{roleId,instructionHash});
  const next=new Set(seen);next.add(key);
  const candidates=candidatesForInstruction(store,roleId,instructionHash);
  boundary(candidates.length===1,`${subject} has an ambiguous or missing active candidate provenance`,
    {roleId,instructionHash,candidateCount:candidates.length});
  const candidate=candidates[0].data;
  assertAdaptiveV3LearningCandidateOriginAllowed(store,authority,candidate,{subject});
  const version=store.get('learning-instructions',instructionHash);
  boundary(version?.version===1&&version.data&&version.data.roleId===roleId&&version.data.hash===instructionHash
    &&validDigest(version.data.parentHash)&&candidate.parentHash===version.data.parentHash,
  `${subject} candidate and instruction lineage differ`,{roleId,instructionHash,candidateId:candidates[0].id});
  return assertAdaptiveV3LearningInstructionLineageAllowed(store,authority,roleId,version.data.parentHash,{subject,seen:next});
}

/** Validate the activated lineage, including legacy rows that predate this
 * boundary.  This is deliberately distinct from role/dataset validation: an
 * ordinary role can otherwise point at a direct-authored candidate. */
export function assertAdaptiveV3LearningActiveLineageAllowed(store,authority,roleId,{subject='learning active lineage'}={}){
  identifier(roleId,`${subject} role id`);
  const role=store.get('learning-role',roleId);
  if(!role)return null;
  assertAdaptiveV3LearningRoleAllowed(store,authority,roleId,{subject});
  return assertAdaptiveV3LearningInstructionLineageAllowed(store,authority,roleId,role.data?.activeHash,{subject});
}

export function assertAdaptiveV3LearningCandidateAllowed(store,authority,candidateId,{subject='learning candidate'}={}){
  identifier(candidateId,`${subject} id`);
  const record=store.get('learning-candidate',candidateId);
  if(!record)return null;
  const candidate=record.data;
  assertAdaptiveV3LearningCandidateOriginAllowed(store,authority,candidate,{subject});
  // Candidate rows bind the comparison parent, but the corresponding immutable
  // instruction version also carries that parent.  Reject a disagreement now:
  // otherwise a retained candidate could present a benign parent here while
  // its stored instruction record secretly descends from a direct lineage.
  if(validIdentifier(candidate?.roleId)&&validDigest(candidate?.instructionHash)&&validDigest(candidate?.parentHash)){
    const version=store.get('learning-instructions',candidate.instructionHash);
    if(version?.version===1&&version.data&&version.data.roleId===candidate.roleId&&version.data.hash===candidate.instructionHash
      &&validDigest(version.data.parentHash))
      boundary(version.data.parentHash===candidate.parentHash,`${subject} candidate and instruction lineage differ`,
        {candidateId,roleId:candidate.roleId,instructionHash:candidate.instructionHash});
  }
  // A normal-looking candidate may still descend from a formerly active
  // direct candidate.  Follow its immutable parent before evaluation,
  // promotion, export or provider dispatch can consume that lineage.
  if(validIdentifier(candidate?.roleId)&&validDigest(candidate?.parentHash))
    assertAdaptiveV3LearningInstructionLineageAllowed(store,authority,candidate.roleId,candidate.parentHash,{subject});
  return null;
}

export function assertAdaptiveV3LearningCycleDataAllowed(store,authority,cycle,{subject='learning cycle'}={}){
  if(!cycle||typeof cycle!=='object')return null;
  if(Object.hasOwn(cycle,'missionId')&&validIdentifier(cycle.missionId))
    assertAdaptiveV3LearningMissionAllowed(store,authority,cycle.missionId,{subject});
  if(Object.hasOwn(cycle,'runId')&&validIdentifier(cycle.runId))assertAdaptiveV3LearningRunAllowed(store,authority,cycle.runId,{subject});
  if(Object.hasOwn(cycle,'roleId')&&validIdentifier(cycle.roleId))assertAdaptiveV3LearningRoleAllowed(store,authority,cycle.roleId,{subject});
  if(cycle.candidateId!==null&&cycle.candidateId!==undefined)assertAdaptiveV3LearningCandidateAllowed(store,authority,cycle.candidateId,{subject});
  return null;
}

export function assertAdaptiveV3LearningCycleAllowed(store,authority,cycleId,{subject='learning cycle'}={}){
  identifier(cycleId,`${subject} id`);
  const record=store.get('learning-cycle',cycleId);
  if(!record)return null;
  return assertAdaptiveV3LearningCycleDataAllowed(store,authority,record.data,{subject});
}

/**
 * Evaluated instruction versions, not self-modifying permissions or intelligence.
 *
 * datasetSpec is frozen at baseline registration:
 * {missionId,evaluatorId,cases:[{id,input,expected,required,holdout,
 *   criteria:[{metric,direction:'higher'|'lower',threshold}]}],
 *  policy:{requireImprovement:boolean}}.
 * Case hashes cover input, expected results, criteria and split flags, not names alone.
 *
 * Trusted runCase(request) must actually execute the evaluated instructions and return:
 * {observations:{outcome:'pass'|'fail',metrics:{metric:finiteNumber},actual:JSON},
 *  receipt: authority.seal('evaluation.case', {
 *   evaluationId,datasetHash,caseId,caseHash,roleId,instructionHash,variant,
 *   evaluatorId,evaluatorRunId,executionId,observationsHash
 *  })}.
 * Bind fields come from request; observationsHash=sha256(observations). ExecutionId
 * is unique for each actual callback execution; evaluatorRunId is not authorRunId.
 * The trusted callback owns execution/measurement and signing. Do not expose the
 * callback, authority, expected answers, holdout data or this registry to a model.
 * A signature authenticates that trusted boundary; it does not establish external
 * truth, independence of an arbitrary callback, or universal quality improvement.
 *
 * getActive exposes only approved instructions. Proposal/evaluation never deploys.
 * Promotion requires instructions.promote; rollback requires instructions.rollback.
 * Neither operation edits filesystem AGENTS.md, datasets, authority or permissions.
 */
function dataset(value) {
  keys(value,['missionId','evaluatorId','cases','policy']);
  identifier(value.missionId);identifier(value.evaluatorId);
  keys(value.policy,['requireImprovement','activation'],['requireImprovement']);
  check(typeof value.policy.requireImprovement==='boolean','SCHEMA','Improvement policy must be explicit');
  check(!Object.hasOwn(value.policy,'activation')||value.policy.activation==='evaluation-only',
    'SCHEMA','Only an explicit evaluation-only activation restriction is supported');
  list(value.cases,'cases',{min:1,max:1000});unique(value.cases.map(c=>c.id),'case IDs');
  for(const c of value.cases) {
    keys(c,['id','input','expected','required','holdout','criteria']);identifier(c.id);
    canonical(c.input);canonical(c.expected);
    check(typeof c.required==='boolean'&&typeof c.holdout==='boolean','SCHEMA','Required and holdout flags must be explicit');
    list(c.criteria,'criteria',{min:1,max:100});unique(c.criteria.map(x=>x.metric),'metrics');
    for(const criterion of c.criteria) {
      keys(criterion,['metric','direction','threshold']);identifier(criterion.metric);
      check(['higher','lower'].includes(criterion.direction)&&Number.isFinite(criterion.threshold),'SCHEMA','Finite metric criteria required');
    }
  }
  check(value.cases.some(c=>c.required),'SCHEMA','At least one required case is necessary');
  return clone(value);
}
/** Validate/clone a frozen dataset without creating a baseline or changing a
 * Store. Domain registration uses this for its all-or-nothing preflight. */
export function validateLearningDataset(value) { return dataset(value); }

/**
 * A frozen dataset may be useful for an explicitly inactive experiment with
 * fewer cases, but it is not eligible to change a live instruction pointer.
 * Keep this invariant outside the CLI: SDK callers, retained domains and the
 * core promotion path must not get a weaker activation rule than the command
 * line happened to enforce at registration time.
 *
 * `holdout` is treated as required by assessment, yet require it to be marked
 * required here as well.  That makes the frozen split self-describing instead
 * of relying on an implementation detail of the assessor.
 */
export function assertActivatableLearningDatasetEligibility(value,{subject='Learning activation',code='LEARNING_ACTIVATION_POLICY'}={}) {
  const spec=dataset(value);
  if(spec.policy.activation==='evaluation-only')return spec;
  check(spec.policy.requireImprovement===true
    &&spec.cases.some(c=>c.required&&!c.holdout)
    &&spec.cases.some(c=>c.required&&c.holdout),code,
  `${subject} requires measured improvement, a required non-holdout case and a required holdout`);
  return spec;
}

// An active pointer is not sufficient evidence that an overlay reached the
// operational route.  This signed, immutable dossier is emitted only by
// LearningService after it has bound the service-level effective prefix.  The
// registry still verifies authority and parent CAS; it merely refuses to move
// a live pointer without this additional custody record.
export const LEARNING_ACTIVATION_SCHEMA='sovereign.learning-activation.v1';
export const LEARNING_ACTIVATION_BINDING_SCHEMA='sovereign.learning-activation-binding.v1';
export const LEARNING_DISPATCH_AUTHORIZATION_SCHEMA='sovereign.learning-dispatch-authorization.v1';
export const LEARNING_DISPATCH_COMPLETION_SCHEMA='sovereign.learning-dispatch-completion.v1';

const activationPayload=value=>{
  keys(value,['schema','activationId','candidateId','roleId','parentHash','instructionHash','datasetHash','scopeHash','prefixHash','targetSetHash',
    'evaluationId','evaluationHash','provenanceHash','provenancePolicyId','issuedAt']);
  check(value.schema===LEARNING_ACTIVATION_SCHEMA,'LEARNING_ACTIVATION_AUTHORIZATION','Unknown learning activation schema');
  for(const key of ['activationId','candidateId','roleId','evaluationId','issuedAt'])identifier(value[key],key);
  for(const key of ['parentHash','instructionHash','datasetHash','scopeHash','prefixHash','targetSetHash','evaluationHash'])digest(value[key],key);
  instant(value.issuedAt,'activation issuance time');
  const noProvenance=value.provenanceHash===null&&value.provenancePolicyId===null;
  const boundProvenance=value.provenanceHash!==null&&value.provenancePolicyId!==null;
  check(noProvenance||boundProvenance,'LEARNING_ACTIVATION_AUTHORIZATION','Activation provenance fields must be present together or absent together');
  if(boundProvenance){digest(value.provenanceHash,'provenance hash');identifier(value.provenancePolicyId,'provenance policy ID');}
  return clone(value);
};

const storedActivation=value=>{
  keys(value,['schema','activationId','candidateId','roleId','parentHash','instructionHash','datasetHash','scopeHash','prefixHash','targetSetHash',
    'evaluationId','evaluationHash','provenanceHash','provenancePolicyId','issuedAt','receipt']);
  const {receipt,...payload}=value;
  return {payload:activationPayload(payload),receipt:clone(receipt)};
};

/** Create the immutable promotion dossier in the same transaction that will
 * move the pointer.  Callers must already have proved the exact evaluated
 * prefix and present compilation; this function only persists and signs their
 * resulting binding. */
export function issueLearningActivationAuthorization({store,authority,candidate,evaluation,scopeHash,prefixHash,targetSetHash,
  provenanceHash=null,provenancePolicyId=null}={}) {
  check(store&&authority&&candidate&&evaluation,'CONFIG','Trusted activation dependencies required');
  identifier(candidate.candidateId,'candidate ID');identifier(candidate.roleId,'role ID');
  for(const key of ['parentHash','instructionHash','datasetHash'])digest(candidate[key],key);
  check(evaluation?.version===2&&evaluation.data?.status==='completed'&&evaluation.data.passed===true
    &&evaluation.data.candidateId===candidate.candidateId&&evaluation.data.datasetHash===candidate.datasetHash
    &&evaluation.data.parentHash===candidate.parentHash&&evaluation.data.instructionHash===candidate.instructionHash,
  'LEARNING_ACTIVATION_AUTHORIZATION','Completed passing evaluation is not bound to this candidate');
  for(const key of ['scopeHash','prefixHash','targetSetHash'])digest({scopeHash,prefixHash,targetSetHash}[key],key);
  const noProvenance=provenanceHash===null&&provenancePolicyId===null;
  const boundProvenance=provenanceHash!==null&&provenancePolicyId!==null;
  check(noProvenance||boundProvenance,'LEARNING_ACTIVATION_AUTHORIZATION','Activation provenance fields must be present together or absent together');
  if(boundProvenance){digest(provenanceHash,'provenance hash');identifier(provenancePolicyId,'provenance policy ID');}
  const payload={schema:LEARNING_ACTIVATION_SCHEMA,activationId:id('learning-activation'),candidateId:candidate.candidateId,roleId:candidate.roleId,
    parentHash:candidate.parentHash,instructionHash:candidate.instructionHash,datasetHash:candidate.datasetHash,scopeHash,prefixHash,targetSetHash,
    evaluationId:evaluation.data.evaluationId,evaluationHash:evaluation.hash,provenanceHash,provenancePolicyId,issuedAt:store.clock()};
  activationPayload(payload);
  return store.transact(()=>{
    store.requireExecutionProtocol(14);
    const data={...payload,receipt:authority.seal('learning.activation',payload)};
    store.put('learning-activation',payload.activationId,data,{expectedVersion:0});
    store.append('learning.activation.authorized',{activationId:payload.activationId,candidateId:payload.candidateId,roleId:payload.roleId,
      instructionHash:payload.instructionHash,evaluationHash:payload.evaluationHash,scopeHash:payload.scopeHash,prefixHash:payload.prefixHash,targetSetHash:payload.targetSetHash});
    return clone(payload);
  });
}

/** Verify a service-issued dossier before either changing an active pointer or
 * dispatching an overlay.  A normal caller cannot substitute an evaluation
 * receipt, a sibling candidate, or a different effective prefix. */
export function assertLearningActivationAuthorization({store,authority,activationId,candidate,evaluation}={}) {
  check(store&&authority&&candidate&&evaluation,'CONFIG','Trusted activation dependencies required');
  check(typeof activationId==='string','LEARNING_ACTIVATION_AUTHORIZATION','A service-issued activation authorization is required');identifier(activationId,'activation ID');
  const record=store.get('learning-activation',activationId);
  check(record?.version===1,'LEARNING_ACTIVATION_AUTHORIZATION','Activation authorization is absent or not immutable');
  const {payload,receipt}=storedActivation(record.data);
  check(payload.activationId===activationId,'LEARNING_ACTIVATION_AUTHORIZATION','Activation record identity differs from its key');
  check(canonical(authority.open(receipt,'learning.activation'))===canonical(payload),'LEARNING_ACTIVATION_AUTHORIZATION','Activation receipt differs from its signed dossier');
  check(payload.candidateId===candidate.candidateId&&payload.roleId===candidate.roleId&&payload.parentHash===candidate.parentHash
    &&payload.instructionHash===candidate.instructionHash&&payload.datasetHash===candidate.datasetHash,
  'LEARNING_ACTIVATION_AUTHORIZATION','Activation dossier does not bind this exact candidate');
  check(evaluation?.version===2&&evaluation.data?.status==='completed'&&evaluation.data.passed===true
    &&payload.evaluationId===evaluation.data.evaluationId&&payload.evaluationHash===evaluation.hash,
  'LEARNING_ACTIVATION_AUTHORIZATION','Activation dossier does not bind this exact completed evaluation');
  return payload;
}

/** The pointer transition itself is a distinct immutable fact.  Keep it out of
 * the pre-CAS dossier so the dispatch gate can prove exactly which durable
 * role head activated an otherwise valid candidate. */
export function bindLearningActivationAuthorization({store,activationId,roleRecord}={}) {
  check(store&&roleRecord,'CONFIG','Trusted activation binding dependencies required');
  identifier(activationId,'activation ID');
  check(roleRecord.type==='learning-role'&&roleRecord.id&&roleRecord.version>=1&&typeof roleRecord.hash==='string',
    'LEARNING_ACTIVATION_AUTHORIZATION','A committed learning-role head is required for activation binding');
  identifier(roleRecord.id,'role ID');integer(roleRecord.version,'role version',{min:1});digest(roleRecord.hash,'role record hash');
  const role=roleRecord.data;
  check(role?.activeActivationId===activationId&&typeof role.activeHash==='string','LEARNING_ACTIVATION_AUTHORIZATION',
    'Committed role head does not point at this activation');
  digest(role.activeHash,'active instruction hash');
  const data={schema:LEARNING_ACTIVATION_BINDING_SCHEMA,activationId,roleId:roleRecord.id,roleVersion:roleRecord.version,
    roleHash:roleRecord.hash,instructionHash:role.activeHash};
  return store.transact(()=>{
    store.requireExecutionProtocol(14);
    store.put('learning-activation-binding',activationId,data,{expectedVersion:0});
    store.append('learning.activation.bound',{activationId,roleId:data.roleId,roleVersion:data.roleVersion,roleHash:data.roleHash,instructionHash:data.instructionHash});
    return clone(data);
  });
}

export function assertLearningActivationBinding({store,activationId,roleRecord}={}) {
  check(store&&roleRecord,'CONFIG','Trusted activation binding dependencies required');
  identifier(activationId,'activation ID');
  const binding=store.get('learning-activation-binding',activationId);
  check(binding?.version===1,'LEARNING_ACTIVATION_AUTHORIZATION','Activation has no immutable committed-pointer binding');
  const data=binding.data;
  keys(data,['schema','activationId','roleId','roleVersion','roleHash','instructionHash']);
  check(data.schema===LEARNING_ACTIVATION_BINDING_SCHEMA&&data.activationId===activationId,'LEARNING_ACTIVATION_AUTHORIZATION','Activation binding schema or identity differs');
  identifier(data.roleId,'bound role ID');integer(data.roleVersion,'bound role version',{min:1});digest(data.roleHash,'bound role hash');digest(data.instructionHash,'bound instruction hash');
  check(roleRecord.type==='learning-role'&&roleRecord.id===data.roleId&&roleRecord.version===data.roleVersion&&roleRecord.hash===data.roleHash
    &&roleRecord.data?.activeActivationId===activationId&&roleRecord.data.activeHash===data.instructionHash,
  'LEARNING_ACTIVATION_AUTHORIZATION','Activation is not bound to the current committed role head');
  return clone(data);
}

const exactRecordReference=record=>{
  check(record&&typeof record.type==='string'&&typeof record.id==='string'&&Number.isSafeInteger(record.version)&&record.version>0&&typeof record.hash==='string',
    'LEARNING_DISPATCH_AUTHORIZATION','Exact durable record reference is required');
  identifier(record.type,'record type');identifier(record.id,'record ID');integer(record.version,'record version',{min:1});digest(record.hash,'record hash');
  return {type:record.type,id:record.id,version:record.version,hash:record.hash};
};
const storedRecordReference=(store,reference,type,label)=>{
  keys(reference,['type','id','version','hash']);
  check(reference.type===type,'LEARNING_DISPATCH_AUTHORIZATION',`${label} type differs from the dispatch authorization`);
  identifier(reference.id,`${label} ID`);integer(reference.version,`${label} version`,{min:1});digest(reference.hash,`${label} hash`);
  const record=store.get(reference.type,reference.id,reference.version);
  check(record?.hash===reference.hash,'LEARNING_DISPATCH_AUTHORIZATION',`${label} record is absent or changed`);
  return record;
};
const sameRecordReference=(reference,record,label)=>check(canonical(reference)===canonical(exactRecordReference(record)),
  'LEARNING_DISPATCH_AUTHORIZATION',`${label} is not the exact record authorized for dispatch`);
const dispatchAuthorizationPayload=value=>{
  keys(value,['schema','authorizationId','runId','requestHash','roleId','policyId','domainId','activationId','instructionHash','roleVersion','prefixHash','scopeHash',
    'activationRef','activationBindingRef','workerConfigRef','runRef','inferenceRequestRef','executionTarget','issuedAt']);
  check(value.schema===LEARNING_DISPATCH_AUTHORIZATION_SCHEMA,'LEARNING_DISPATCH_AUTHORIZATION','Unknown learning dispatch authorization schema');
  for(const key of ['authorizationId','runId','roleId','activationId'])identifier(value[key],key);
  for(const key of ['requestHash','instructionHash','prefixHash','scopeHash'])digest(value[key],key);
  integer(value.roleVersion,'role version',{min:1});instant(value.issuedAt,'dispatch authorization issuance time');
  for(const key of ['policyId','domainId'])check(value[key]===null||typeof value[key]==='string','LEARNING_DISPATCH_AUTHORIZATION',`${key} must be null or an identifier`);
  for(const key of ['policyId','domainId'])if(value[key]!==null)identifier(value[key],key);
  keys(value.executionTarget,['model','reasoningEffort']);string(value.executionTarget.model,'dispatch model');string(value.executionTarget.reasoningEffort,'dispatch reasoning effort');
  return clone(value);
};
const storedDispatchAuthorization=value=>{
  keys(value,['schema','authorizationId','runId','requestHash','roleId','policyId','domainId','activationId','instructionHash','roleVersion','prefixHash','scopeHash',
    'activationRef','activationBindingRef','workerConfigRef','runRef','inferenceRequestRef','executionTarget','issuedAt','receipt']);
  const {receipt,...payload}=value;return {payload:dispatchAuthorizationPayload(payload),receipt:clone(receipt)};
};

/** Verify the durable per-dispatch permit at the only generic receipt-acceptance
 * boundary. This makes a direct ArtifactRegistry caller unable to attach a
 * learned inference merely by knowing the request hash. */
export function assertLearningDispatchAuthorization({store,authority,authorizationId,runRecord,workerConfigRecord,inferenceRequestRecord}={}) {
  check(store&&authority&&runRecord&&workerConfigRecord&&inferenceRequestRecord,'CONFIG','Trusted learning dispatch dependencies required');
  identifier(authorizationId,'dispatch authorization ID');
  const authorization=store.get('learning-dispatch-authorization',authorizationId);
  check(authorization?.version===1,'LEARNING_DISPATCH_AUTHORIZATION','Dispatch authorization is absent or not immutable');
  const {payload,receipt}=storedDispatchAuthorization(authorization.data);
  check(payload.authorizationId===authorizationId,'LEARNING_DISPATCH_AUTHORIZATION','Dispatch authorization identity differs from its key');
  check(canonical(authority.open(receipt,'learning.dispatch-authorization'))===canonical(payload),
    'LEARNING_DISPATCH_AUTHORIZATION','Dispatch authorization receipt differs from its signed payload');
  sameRecordReference(payload.runRef,runRecord,'Run reference');
  sameRecordReference(payload.workerConfigRef,workerConfigRecord,'Worker configuration reference');
  sameRecordReference(payload.inferenceRequestRef,inferenceRequestRecord,'Inference request reference');
  check(payload.runId===runRecord.id&&payload.requestHash===runRecord.data.expectedRequestHash
    &&payload.requestHash===inferenceRequestRecord.data.requestHash&&inferenceRequestRecord.data.runId===runRecord.id
    &&inferenceRequestRecord.data.retention==='BEFORE_DISPATCH',
  'LEARNING_DISPATCH_AUTHORIZATION','Dispatch authorization differs from the pending retained request');
  const activation=storedRecordReference(store,payload.activationRef,'learning-activation','Activation reference');
  const binding=storedRecordReference(store,payload.activationBindingRef,'learning-activation-binding','Activation binding reference');
  const {payload:activationPayload,receipt:activationReceipt}=storedActivation(activation.data);
  check(canonical(authority.open(activationReceipt,'learning.activation'))===canonical(activationPayload)
    &&activationPayload.activationId===payload.activationId&&activationPayload.instructionHash===payload.instructionHash,
  'LEARNING_DISPATCH_AUTHORIZATION','Dispatch authorization does not bind a valid activation dossier');
  check(binding.data?.schema===LEARNING_ACTIVATION_BINDING_SCHEMA&&binding.data.activationId===payload.activationId
    &&binding.data.roleVersion===payload.roleVersion&&binding.data.instructionHash===payload.instructionHash,
  'LEARNING_DISPATCH_AUTHORIZATION','Dispatch authorization does not bind its committed activation pointer');
  const frozen=workerConfigRecord.data?.learnedInstructionVersions;
  check(Array.isArray(frozen)&&frozen.some(value=>value&&typeof value==='object'
    &&value.roleId===payload.roleId&&value.hash===payload.instructionHash&&value.version===payload.roleVersion
    &&value.prefixHash===payload.prefixHash&&value.scopeHash===payload.scopeHash&&value.activationId===payload.activationId
    &&canonical(value.activationRef)===canonical(payload.activationRef)&&canonical(value.activationBindingRef)===canonical(payload.activationBindingRef)),
  'LEARNING_DISPATCH_AUTHORIZATION','Dispatch authorization does not match the exact learned worker overlay');
  return {payload,record:authorization};
}

/** Consume one immutable dispatch permit exactly once while attaching the
 * corresponding provider receipt. A completion record gives the durable
 * authorization-to-receipt link without mutating the original authorization. */
export function consumeLearningDispatchAuthorization({store,authority,authorizationId,runRecord,workerConfigRecord,inferenceRequestRecord,receipt}={}) {
  check(store?.db?.isTransaction,'LEARNING_DISPATCH_AUTHORIZATION','Dispatch completion must share the receipt transaction');
  const {payload,record}=assertLearningDispatchAuthorization({store,authority,authorizationId,runRecord,workerConfigRecord,inferenceRequestRecord});
  check(receipt&&typeof receipt==='object'&&receipt.contextHash===payload.requestHash,
    'LEARNING_DISPATCH_AUTHORIZATION','Provider receipt does not bind the authorized request');
  string(receipt.threadId,'provider thread ID');string(receipt.turnId,'provider turn ID');canonical(receipt);
  const completionId='learning-dispatch-completion:'+authorizationId;
  const completion={schema:LEARNING_DISPATCH_COMPLETION_SCHEMA,completionId,authorizationId,
    authorizationRef:exactRecordReference(record),runRef:exactRecordReference(runRecord),workerConfigRef:exactRecordReference(workerConfigRecord),
    inferenceRequestRef:exactRecordReference(inferenceRequestRecord),requestHash:payload.requestHash,receiptHash:sha256(receipt),
    threadId:receipt.threadId,turnId:receipt.turnId,completedAt:store.clock()};
  keys(completion,['schema','completionId','authorizationId','authorizationRef','runRef','workerConfigRef','inferenceRequestRef','requestHash','receiptHash','threadId','turnId','completedAt']);
  check(completion.schema===LEARNING_DISPATCH_COMPLETION_SCHEMA,'LEARNING_DISPATCH_AUTHORIZATION','Unknown learning dispatch completion schema');
  identifier(completion.completionId,'dispatch completion ID');digest(completion.requestHash,'dispatch request hash');digest(completion.receiptHash,'provider receipt hash');instant(completion.completedAt,'dispatch completion time');
  store.requireExecutionProtocol(14);
  const data={...completion,receipt:authority.seal('learning.dispatch-completion',completion)};
  store.put('learning-dispatch-completion',completionId,data,{expectedVersion:0});
  store.append('learning.dispatch.completed',{completionId,authorizationId,runId:runRecord.id,requestHash:payload.requestHash,
    receiptHash:completion.receiptHash,threadId:receipt.threadId,turnId:receipt.turnId});
  return clone(completion);
}
const instructionHash=(roleId,instructions)=>sha256({roleId,instructions});
const freeze=value=>{if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value;};

export class LearningRegistry {
  constructor(store,authority) { this.store=store;this.authority=authority; }
  registerBaseline({roleId,instructions,datasetSpec}) {
    identifier(roleId);string(instructions,'instructions');
    const spec=dataset(datasetSpec),datasetHash=sha256(spec),hash=instructionHash(roleId,instructions);
    assertAdaptiveV3LearningDatasetAllowed(this.store,this.authority,spec,{subject:'Learning baseline registration'});
    return this.store.transact(()=>{
      assertAdaptiveV3LearningDatasetAllowed(this.store,this.authority,spec,{subject:'Learning baseline registration'});
      check(!this.store.get('learning-role',roleId),'LEARNING_EXISTS','Baseline is already registered');
      if(!this.store.get('learning-dataset',datasetHash))this.store.put('learning-dataset',datasetHash,spec,{expectedVersion:0});
      this.store.put('learning-instructions',hash,{roleId,instructions,hash,parentHash:null},{expectedVersion:0});
      this.store.put('learning-role',roleId,{roleId,activeHash:hash,baselineHash:hash,datasetHash,approvedHashes:[hash],activeActivationId:null},{expectedVersion:0});
      this.store.append('learning.baseline.registered',{roleId,hash,datasetHash});
      return this.getActive(roleId);
    });
  }
  #role(roleId) {const r=this.store.get('learning-role',roleId);check(r,'NOT_FOUND','Learning role not registered');return r;}
  #version(hash,roleId) {
    const r=this.store.get('learning-instructions',hash);
    check(r&&r.version===1&&r.data.roleId===roleId&&r.data.hash===hash&&instructionHash(roleId,r.data.instructions)===hash,'LEARNING_VERSION','Instruction version does not belong to this role');
    return r.data;
  }
  getActive(roleId) {
    const role=this.#role(roleId);
    assertAdaptiveV3LearningActiveLineageAllowed(this.store,this.authority,roleId,{subject:'Learning active instruction'});
    const version=this.#version(role.data.activeHash,roleId);
    const activationId=role.data.activeActivationId??null;
    check(activationId===null||typeof activationId==='string','LEARNING_ACTIVATION_AUTHORIZATION','Active activation identity is malformed');
    if(activationId!==null)identifier(activationId,'active activation ID');
    return {roleId,version:role.version,hash:version.hash,instructions:version.instructions,activationId};
  }
  propose({roleId,parentHash,instructions,rationale,authorRunId}) {
    identifier(roleId);digest(parentHash);string(instructions,'instructions');string(rationale,'rationale');identifier(authorRunId);
    assertAdaptiveV3LearningRoleAllowed(this.store,this.authority,roleId,{subject:'Learning proposal'});
    assertAdaptiveV3LearningActiveLineageAllowed(this.store,this.authority,roleId,{subject:'Learning proposal parent'});
    assertAdaptiveV3LearningRunAllowed(this.store,this.authority,authorRunId,{subject:'Learning proposal author'});
    return this.store.transact(()=>{
      assertAdaptiveV3LearningRoleAllowed(this.store,this.authority,roleId,{subject:'Learning proposal'});
      assertAdaptiveV3LearningActiveLineageAllowed(this.store,this.authority,roleId,{subject:'Learning proposal parent'});
      assertAdaptiveV3LearningRunAllowed(this.store,this.authority,authorRunId,{subject:'Learning proposal author'});
      const role=this.#role(roleId);
      check(role.data.activeHash===parentHash,'LEARNING_PARENT','Proposal parent is not active');
      const hash=instructionHash(roleId,instructions);
      check(hash!==parentHash,'LEARNING_UNCHANGED','Proposal must change instructions');
      const candidateId=id('candidate');
      if(!this.store.get('learning-instructions',hash))this.store.put('learning-instructions',hash,{roleId,instructions,hash,parentHash},{expectedVersion:0});
      const candidate={candidateId,roleId,parentHash,instructionHash:hash,datasetHash:role.data.datasetHash,rationale,authorRunId};
      this.store.put('learning-candidate',candidateId,candidate,{expectedVersion:0});
      this.store.append('learning.candidate.proposed',{candidateId,roleId,parentHash,instructionHash:hash,datasetHash:candidate.datasetHash});
      return clone(candidate);
    });
  }
  #candidate(candidateId) {
    identifier(candidateId);const c=this.store.get('learning-candidate',candidateId);
    check(c&&c.version===1,'NOT_FOUND','Immutable candidate not found');return c.data;
  }
  #spec(candidate) {
    const r=this.store.get('learning-dataset',candidate.datasetHash);
    check(r&&r.version===1&&sha256(r.data)===candidate.datasetHash,'LEARNING_DATASET','Frozen dataset mismatch');
    return dataset(r.data);
  }
  activationPolicy(roleId) {
    return this.#spec(this.#role(roleId).data).policy.activation??'evaluated-promotion';
  }
  #observation(result,request,authorRunId,usedExecutionIds) {
    keys(result,['observations','receipt']);
    const o=result.observations;keys(o,['outcome','metrics','actual']);
    check(['pass','fail'].includes(o.outcome),'LEARNING_OBSERVATION','Outcome must be explicit');
    const metrics=request.case.criteria.map(c=>c.metric);keys(o.metrics,metrics);
    check(Object.values(o.metrics).every(x=>typeof x==='number'&&Number.isFinite(x)),'LEARNING_METRIC','Metrics must be finite numbers');
    canonical(o.actual);
    const signed=this.authority.open(result.receipt,'evaluation.case');
    keys(signed,['evaluationId','datasetHash','caseId','caseHash','roleId','instructionHash','variant','evaluatorId','evaluatorRunId','executionId','observationsHash']);
    for(const k of ['evaluationId','datasetHash','caseId','caseHash','roleId','instructionHash','variant','evaluatorId'])check(signed[k]===request[k],'LEARNING_RECEIPT','Execution receipt context mismatch',{field:k});
    identifier(signed.evaluatorRunId);identifier(signed.executionId);
    check(signed.evaluatorRunId!==authorRunId,'LEARNING_INDEPENDENCE','Author run cannot evaluate its own candidate');
    check(!usedExecutionIds.has(signed.executionId),'LEARNING_DUPLICATE','Execution receipt reused');
    check(signed.observationsHash===sha256(o),'LEARNING_RECEIPT','Observation hash mismatch');
    usedExecutionIds.add(signed.executionId);
    return clone(result);
  }
  #assess(spec,results,context) {
    const issues=[];let improved=false;
    check(results.length===spec.cases.length*2,'LEARNING_COVERAGE','Incomplete paired evaluation');
    unique(results.map(r=>`${r.caseId}:${r.variant}`),'case variant pairs');
    const executions=new Set();
    for(const c of spec.cases) {
      const pair=Object.fromEntries(['baseline','candidate'].map(variant=>{
        const r=results.find(r=>r.caseId===c.id&&r.variant===variant);
        check(r&&r.caseHash===sha256(c),'LEARNING_COVERAGE','Frozen case missing or changed');
        const request=r.request;
        const hash=variant==='baseline'?context.parentHash:context.instructionHash;
        check(r.authorRunId===context.authorRunId&&request.evaluationId===context.evaluationId&&request.datasetHash===context.datasetHash&&request.roleId===context.roleId&&request.instructionHash===hash&&request.variant===variant&&request.caseId===c.id&&request.caseHash===sha256(c)&&request.evaluatorId===spec.evaluatorId&&canonical(request.case)===canonical(c)&&instructionHash(context.roleId,request.instructions)===hash,'LEARNING_RECEIPT','Stored evaluation context is not the frozen comparison');
        this.#observation(r.result,r.request,r.authorRunId,executions);
        return [variant,r.result.observations];
      }));
      const required=c.required||c.holdout;
      if(required&&pair.candidate.outcome!=='pass')issues.push({caseId:c.id,code:'OUTCOME_FAILED'});
      if(required&&pair.baseline.outcome==='pass'&&pair.candidate.outcome!=='pass')issues.push({caseId:c.id,code:'OUTCOME_REGRESSION'});
      // A passing optional example is useful diagnostic evidence, but it is
      // not enough to activate a live instruction pointer.  The required
      // split is the acceptance population: a claimed improvement must be
      // visible there, otherwise an optional fixture could manufacture the
      // only lift while every required/holdout case merely ties.
      if(required&&pair.baseline.outcome==='fail'&&pair.candidate.outcome==='pass')improved=true;
      for(const k of c.criteria) {
        const baseline=pair.baseline.metrics[k.metric],candidate=pair.candidate.metrics[k.metric];
        const sign=k.direction==='higher'?1:-1;
        if(required&&sign*candidate<sign*k.threshold)issues.push({caseId:c.id,metric:k.metric,code:'CRITERION_FAILED'});
        if(required&&sign*candidate<sign*baseline)issues.push({caseId:c.id,metric:k.metric,code:'METRIC_REGRESSION'});
        if(required&&sign*candidate>sign*baseline)improved=true;
      }
    }
    if(spec.policy.requireImprovement&&!improved)issues.push({code:'NO_MEASURED_IMPROVEMENT'});
    return {passed:issues.length===0,improved,issues};
  }
  async evaluate(candidateId,{runCase,beforeComplete}={}) {
    check(typeof runCase==='function','SCHEMA','A trusted executable evaluator callback is required');
    check(beforeComplete===undefined||typeof beforeComplete==='function','SCHEMA','Completion gate must be a synchronous function');
    assertAdaptiveV3LearningCandidateAllowed(this.store,this.authority,candidateId,{subject:'Learning evaluation'});
    const candidate=this.#candidate(candidateId),spec=this.#spec(candidate);
    const baseline=this.#version(candidate.parentHash,candidate.roleId),proposed=this.#version(candidate.instructionHash,candidate.roleId);
    const evaluationId=id('evaluation');
    this.store.transact(()=>{
      assertAdaptiveV3LearningCandidateAllowed(this.store,this.authority,candidateId,{subject:'Learning evaluation'});
      check(!this.store.get('learning-evaluation',candidateId),'LEARNING_EVALUATED','Each frozen candidate permits one evaluation');
      this.store.put('learning-evaluation',candidateId,{evaluationId,candidateId,datasetHash:candidate.datasetHash,status:'running'},{expectedVersion:0});
      this.store.append('learning.evaluation.started',{candidateId,evaluationId,datasetHash:candidate.datasetHash});
    });
    const results=[],used=new Set();
    try {
      for(const c of spec.cases)for(const variant of ['baseline','candidate']) {
        assertAdaptiveV3LearningCandidateAllowed(this.store,this.authority,candidateId,{subject:'Learning evaluation'});
        const version=variant==='baseline'?baseline:proposed;
        const request=freeze(clone({evaluationId,datasetHash:candidate.datasetHash,caseId:c.id,caseHash:sha256(c),roleId:candidate.roleId,instructionHash:version.hash,variant,evaluatorId:spec.evaluatorId,instructions:version.instructions,case:c}));
        const observed=await runCase(request);
        assertAdaptiveV3LearningCandidateAllowed(this.store,this.authority,candidateId,{subject:'Learning evaluation'});
        const result=this.#observation(observed,request,candidate.authorRunId,used);
        const row={caseId:c.id,caseHash:sha256(c),variant,request:clone(request),authorRunId:candidate.authorRunId,result};
        // Commit each observation before the next dependent comparison; interrupted
        // evaluations remain non-promotable, with their completed prefix retained.
        this.store.put('learning-case',id('case-result'),{candidateId,...row},{expectedVersion:0});
        results.push(row);
      }
      const assessment=this.#assess(spec,results,{...candidate,evaluationId});
      const record={evaluationId,candidateId,datasetHash:candidate.datasetHash,parentHash:candidate.parentHash,instructionHash:candidate.instructionHash,status:'completed',...assessment,results};
      this.store.transact(()=>{
        // A service-level custody gate must share the durable ordering of the
        // completed evaluation record. It is deliberately synchronous: this
        // transaction cannot make an external callback atomic.
        assertAdaptiveV3LearningCandidateAllowed(this.store,this.authority,candidateId,{subject:'Learning evaluation'});
        const gate=beforeComplete?.();
        check(!gate?.then,'ASYNC_TRANSACTION','Completion gate must not await inside a Store transaction');
        this.store.put('learning-evaluation',candidateId,record,{expectedVersion:1});
        this.store.append('learning.evaluation.completed',{candidateId,evaluationId,passed:assessment.passed,improved:assessment.improved,issues:assessment.issues});
      });
      return clone(record);
    } catch(e) {
      this.store.transact(()=>{
        // Do not append a new learning state transition after a concurrent
        // custody recheck discovered that this candidate is direct-v3 linked.
        // The pre-existing running checkpoint remains diagnostic evidence;
        // it must not be converted into a fresh direct-route evaluation row.
        assertAdaptiveV3LearningCandidateAllowed(this.store,this.authority,candidateId,{subject:'Learning evaluation'});
        this.store.put('learning-evaluation',candidateId,{evaluationId,candidateId,datasetHash:candidate.datasetHash,status:'failed',passed:false,errorCode:safeCode(e),completedPairs:results.length},{expectedVersion:1});
        this.store.append('learning.evaluation.failed',{candidateId,evaluationId,errorCode:safeCode(e),completedPairs:results.length});
      });
      throw e;
    }
  }
  promote(candidateId,{lease,principalId,activationId}={}) {
    return this.store.transact(()=>{
      assertAdaptiveV3LearningCandidateAllowed(this.store,this.authority,candidateId,{subject:'Learning promotion'});
      const c=this.#candidate(candidateId),role=this.#role(c.roleId),spec=this.#spec(c);
      assertAdaptiveV3LearningActiveLineageAllowed(this.store,this.authority,c.roleId,{subject:'Learning promotion parent'});
      check(spec.policy.activation!=='evaluation-only','LEARNING_EVALUATION_ONLY','This frozen dataset permits evaluation, never activation');
      assertActivatableLearningDatasetEligibility(spec,{subject:'Learning promotion'});
      this.authority.verify(lease,{missionId:spec.missionId,principalId,action:'instructions.promote',resource:`role:${c.roleId}`});
      check(role.data.activeHash===c.parentHash&&role.data.datasetHash===c.datasetHash,'LEARNING_PARENT','Active parent or dataset changed');
      const e=this.store.get('learning-evaluation',candidateId);
      check(e&&e.version===2&&e.data.status==='completed'&&e.data.candidateId===candidateId&&e.data.datasetHash===c.datasetHash&&e.data.parentHash===c.parentHash&&e.data.instructionHash===c.instructionHash,'LEARNING_EVALUATION','Completed comparable evaluation required');
      check(this.store.get('learning-evaluation',candidateId,1)?.data.evaluationId===e.data.evaluationId,'LEARNING_EVALUATION','Evaluation identity changed');
      const assessed=this.#assess(spec,e.data.results,{...c,evaluationId:e.data.evaluationId});
      check(assessed.passed&&e.data.passed&&canonical(assessed.issues)===canonical(e.data.issues),'LEARNING_REJECTED','Evaluation did not meet frozen promotion policy');
      const activation=assertLearningActivationAuthorization({store:this.store,authority:this.authority,activationId,candidate:c,evaluation:e});
      this.#version(c.instructionHash,c.roleId);
      const promotedRole=this.store.put('learning-role',c.roleId,{...role.data,activeHash:c.instructionHash,activeActivationId:activation.activationId,
        approvedHashes:[...new Set([...role.data.approvedHashes,c.instructionHash])]},{expectedVersion:role.version});
      bindLearningActivationAuthorization({store:this.store,activationId:activation.activationId,roleRecord:promotedRole});
      this.store.append('learning.instructions.promoted',{candidateId,roleId:c.roleId,parentHash:c.parentHash,instructionHash:c.instructionHash,
        evaluationId:e.data.evaluationId,activationId:activation.activationId,principalId});
      return this.getActive(c.roleId);
    });
  }
  rollback({roleId,targetHash,lease,principalId,reason,activationId}={}) {
    identifier(roleId);digest(targetHash);string(reason,'rollback reason');
    return this.store.transact(()=>{
      assertAdaptiveV3LearningRoleAllowed(this.store,this.authority,roleId,{subject:'Learning rollback'});
      assertAdaptiveV3LearningActiveLineageAllowed(this.store,this.authority,roleId,{subject:'Learning rollback active lineage'});
      assertAdaptiveV3LearningInstructionLineageAllowed(this.store,this.authority,roleId,targetHash,{subject:'Learning rollback target'});
      const role=this.#role(roleId),spec=this.#spec(role.data);
      check(spec.policy.activation!=='evaluation-only','LEARNING_EVALUATION_ONLY','Evaluation-only instructions cannot activate through rollback');
      // Returning to baseline removes an overlay and remains available as a
      // safe recovery action. Re-activating any non-baseline version is an
      // activation and therefore cannot bypass the split/improvement gate.
      if(targetHash!==role.data.baselineHash)
        assertActivatableLearningDatasetEligibility(spec,{subject:'Learning rollback activation'});
      this.authority.verify(lease,{missionId:spec.missionId,principalId,action:'instructions.rollback',resource:`role:${roleId}`});
      check(role.data.approvedHashes.includes(targetHash),'LEARNING_ROLLBACK','Rollback target was never approved for this role');
      this.#version(targetHash,roleId);
      let activation=null;
      if(targetHash!==role.data.baselineHash){
        const candidates=candidatesForInstruction(this.store,roleId,targetHash);
        check(candidates.length===1,'LEARNING_ACTIVATION_AUTHORIZATION','Rollback target does not have one unambiguous candidate dossier');
        const candidate=candidates[0].data,e=this.store.get('learning-evaluation',candidate.candidateId);
        activation=assertLearningActivationAuthorization({store:this.store,authority:this.authority,activationId,candidate,evaluation:e});
      }
      const restoredRole=this.store.put('learning-role',roleId,{...role.data,activeHash:targetHash,activeActivationId:activation?.activationId??null},{expectedVersion:role.version});
      if(activation)bindLearningActivationAuthorization({store:this.store,activationId:activation.activationId,roleRecord:restoredRole});
      this.store.append('learning.instructions.rolled-back',{roleId,fromHash:role.data.activeHash,targetHash,
        ...(activation?{activationId:activation.activationId}:{}),principalId,reason});
      return this.getActive(roleId);
    });
  }
}
