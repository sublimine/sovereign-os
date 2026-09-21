import {createPublicKey,verify as verifySignature} from 'node:crypto';
import {canonical,check,clone,digest,identifier,keys,list,sha256,string,unique} from './contracts.mjs';

/**
 * Provenance for a frozen learning oracle is deliberately separate from the
 * dataset and from the candidate/prompt. A matching hash is custody evidence,
 * not proof that an expected value is true or that two people are independent.
 */
export const LEARNING_PROVENANCE_SCHEMA='sovereign.learning-provenance.v1';
export const LEARNING_PROVENANCE_POLICY_SCHEMA='sovereign.learning-provenance-policy.v1';

const signatureValue=value=>{
  string(value,'Ed25519 signature',{min:1,max:8192});
  const bytes=Buffer.from(value,'base64');
  check(bytes.length>0&&bytes.toString('base64')===value,'SCHEMA','Signature must be canonical base64');
  return bytes;
};

function sourceRef(value){
  keys(value,['sourceId','hash','quote']);identifier(value.sourceId,'source ID');digest(value.hash,'source hash');
  string(value.quote,'source quote',{max:20000});return clone(value);
}

function caseBinding(value){
  keys(value,['caseId','caseHash','inputHash','expectedHash','criteriaHash','required','holdout']);
  identifier(value.caseId,'case ID');for(const key of ['caseHash','inputHash','expectedHash','criteriaHash'])digest(value[key],key);
  check(typeof value.required==='boolean'&&typeof value.holdout==='boolean','SCHEMA','Case split flags must be explicit');
  return clone(value);
}

/** Binding over normalized scope/dataset content, never over incidental JSON
 * whitespace or field order in a private manifest. */
export function learningProvenanceBinding({domainId,roleId,scopeHash,datasetHash,evaluatorId,cases}){
  identifier(domainId,'domain ID');identifier(roleId,'role ID');digest(scopeHash,'scope hash');digest(datasetHash,'dataset hash');identifier(evaluatorId,'evaluator ID');
  list(cases,'frozen cases',{min:1,max:1000});
  const bound=cases.map(c=>({caseId:c.id,caseHash:sha256(c),inputHash:sha256(c.input),expectedHash:sha256(c.expected),
    criteriaHash:sha256(c.criteria),required:c.required,holdout:c.holdout}));
  unique(bound.map(c=>c.caseId),'provenance case IDs');return clone({domainId,roleId,scopeHash,datasetHash,evaluatorId,cases:bound});
}

function binding(value){
  keys(value,['domainId','roleId','scopeHash','datasetHash','evaluatorId','cases']);
  identifier(value.domainId,'domain ID');identifier(value.roleId,'role ID');digest(value.scopeHash,'scope hash');digest(value.datasetHash,'dataset hash');identifier(value.evaluatorId,'evaluator ID');
  list(value.cases,'provenance cases',{min:1,max:1000});const cases=value.cases.map(caseBinding);
  unique(cases.map(c=>c.caseId),'provenance case IDs');return clone({...value,cases});
}

function attestation(value){
  keys(value,['role','keyId','signature']);check(['labeler','reviewer'].includes(value.role),'SCHEMA','Provenance signer role is invalid');
  identifier(value.keyId,'provenance key ID');signatureValue(value.signature);return clone(value);
}

/** The bytes that both independent roles sign. Signers themselves are included
 * by ID/role, while signatures are excluded to avoid a self-referential hash. */
export function learningProvenancePayload(provenance){
  const normalized=normalizeLearningProvenance(provenance);
  return {schema:normalized.schema,binding:normalized.binding,caseEvidence:normalized.caseEvidence,
    reviewMethod:normalized.reviewMethod,limitations:normalized.limitations,
    signers:normalized.attestations.map(({role,keyId})=>({role,keyId}))};
}

/** Pure schema/binding validation. It intentionally does not read state, keys
 * or sources, so learn-validate can safely run without a destination database. */
export function normalizeLearningProvenance(value){
  keys(value,['schema','binding','caseEvidence','reviewMethod','limitations','attestations']);
  check(value.schema===LEARNING_PROVENANCE_SCHEMA,'LEARNING_PROVENANCE','Unknown learning provenance schema');
  const frozenBinding=binding(value.binding);
  list(value.caseEvidence,'case evidence',{min:1,max:1000});
  const caseEvidence=value.caseEvidence.map(entry=>{
    keys(entry,['caseId','sourceRefs','derivation']);identifier(entry.caseId,'case ID');
    list(entry.sourceRefs,'case source refs',{min:1,max:32});const sourceRefs=entry.sourceRefs.map(sourceRef);
    unique(sourceRefs.map(canonical),'case source refs');string(entry.derivation,'expected derivation',{max:16000});
    return {caseId:entry.caseId,sourceRefs,derivation:entry.derivation};
  }).sort((a,b)=>a.caseId.localeCompare(b.caseId));
  check(canonical(caseEvidence.map(x=>x.caseId))===canonical(frozenBinding.cases.map(x=>x.caseId).sort()),
    'LEARNING_PROVENANCE','Case evidence must cover each frozen case exactly once');
  string(value.reviewMethod,'provenance review method',{max:16000});string(value.limitations,'provenance limitations',{max:16000});
  list(value.attestations,'provenance attestations',{min:2,max:2});const attestations=value.attestations.map(attestation).sort((a,b)=>a.role.localeCompare(b.role));
  check(canonical(attestations.map(a=>a.role))===canonical(['labeler','reviewer']),'LEARNING_PROVENANCE','Exactly one labeler and one reviewer attestation are required');
  check(attestations[0].keyId!==attestations[1].keyId,'LEARNING_PROVENANCE_INDEPENDENCE','Labeler and reviewer must use distinct trusted identities');
  return clone({schema:value.schema,binding:frozenBinding,caseEvidence,reviewMethod:value.reviewMethod,limitations:value.limitations,attestations});
}

export function validateLearningProvenance({provenance,expectedBinding}){
  const normalized=normalizeLearningProvenance(provenance),wanted=binding(expectedBinding);
  check(canonical(normalized.binding)===canonical(wanted),'LEARNING_PROVENANCE_BINDING','Provenance does not bind this exact normalized domain, scope, dataset and cases');
  return {provenance:normalized,provenanceHash:sha256(normalized),caseCount:normalized.binding.cases.length,
    sourceRefCount:normalized.caseEvidence.reduce((total,entry)=>total+entry.sourceRefs.length,0),
    labelerKeyId:normalized.attestations.find(a=>a.role==='labeler').keyId,
    reviewerKeyId:normalized.attestations.find(a=>a.role==='reviewer').keyId};
}

function policyKey(value){
  keys(value,['keyId','roles','publicKey']);identifier(value.keyId,'trusted provenance key ID');
  list(value.roles,'trusted provenance key roles',{min:1,max:2});unique(value.roles,'trusted provenance key roles');
  check(value.roles.every(role=>['labeler','reviewer'].includes(role)),'SCHEMA','Trusted provenance key role is invalid');
  string(value.publicKey,'Ed25519 public key',{max:8192});let key;
  try{key=createPublicKey(value.publicKey);}catch{check(false,'LEARNING_PROVENANCE_POLICY','Trusted provenance public key is invalid');}
  check(key.asymmetricKeyType==='ed25519','LEARNING_PROVENANCE_POLICY','Trusted provenance key must be Ed25519');
  return {keyId:value.keyId,roles:[...value.roles].sort(),publicKey:value.publicKey,
    keyFingerprint:sha256(key.export({type:'spki',format:'der'})),key};
}

/** The trust policy must arrive through trusted runtime configuration, never
 * through the domain manifest being assessed. */
export function normalizeLearningProvenancePolicy(value){
  keys(value,['schema','policyId','keys']);check(value.schema===LEARNING_PROVENANCE_POLICY_SCHEMA,'LEARNING_PROVENANCE_POLICY','Unknown learning provenance policy schema');
  identifier(value.policyId,'provenance policy ID');list(value.keys,'trusted provenance keys',{min:2,max:256});
  const entries=value.keys.map(policyKey);unique(entries.map(x=>x.keyId),'trusted provenance key IDs');
  check(new Set(entries.map(x=>x.keyFingerprint)).size===entries.length,'LEARNING_PROVENANCE_INDEPENDENCE',
    'Trusted labeler/reviewer identities must not reuse the same public key');
  return {schema:value.schema,policyId:value.policyId,keys:entries};
}

function assertedSource(store,ref,missionId){
  const record=store.get('source',ref.sourceId),source=record?.data;
  // A provenance reference binds the original immutable acquisition record.
  // A later record is currently only a retraction, never a fresh admission;
  // accepting it would let a mutable source record replace signed evidence.
  check(record?.version===1&&source?.id===ref.sourceId&&source.missionId===missionId&&source.status==='ADMITTED',
    'LEARNING_PROVENANCE_SOURCE','Provenance source is missing, outside this mission, outside immutable admission or retracted');
  check(source.hash===ref.hash&&typeof source.raw==='string'&&sha256(source.raw)===source.hash&&source.raw.includes(ref.quote),
    'LEARNING_PROVENANCE_SOURCE','Provenance source bytes, hash or exact passage are unavailable');
}

/** Resolve immutable same-mission sources and cryptographic signers under a
 * separately configured policy. Success proves bound custody/authentication only. */
export function verifyLearningProvenance({store,policy,provenance,expectedBinding,missionId}){
  check(store&&typeof store.get==='function','CONFIG','Trusted Store required for provenance verification');
  check(policy!==null&&policy!==undefined,'LEARNING_PROVENANCE_POLICY','No trusted learning provenance policy is configured');
  identifier(missionId,'learning mission ID');
  const result=validateLearningProvenance({provenance,expectedBinding}),trusted=normalizeLearningProvenancePolicy(policy);
  const payload=Buffer.from(canonical(learningProvenancePayload(result.provenance)),'utf8'),byId=new Map(trusted.keys.map(key=>[key.keyId,key]));
  for(const attestation of result.provenance.attestations){
    const key=byId.get(attestation.keyId);check(key&&key.roles.includes(attestation.role),'LEARNING_PROVENANCE_POLICY','Provenance signer is not trusted for its asserted role');
    check(verifySignature(null,payload,key.key,signatureValue(attestation.signature)),'LEARNING_PROVENANCE_SIGNATURE','Trusted provenance signature did not verify');
  }
  for(const entry of result.provenance.caseEvidence)for(const ref of entry.sourceRefs)assertedSource(store,ref,missionId);
  return {...result,policyId:trusted.policyId,provenanceStatus:'VERIFIED_CUSTODY_AND_REVIEW'};
}

export function storedLearningProvenance(store,domainPolicyId){
  identifier(domainPolicyId,'domain policy ID');
  const record=store.get('learning-provenance',domainPolicyId);
  check(record?.version===1,'LEARNING_PROVENANCE','Frozen learning provenance record is missing');
  keys(record.data,['schema','binding','provenance','provenanceHash','policyId']);
  check(record.data.schema===LEARNING_PROVENANCE_SCHEMA,'LEARNING_PROVENANCE','Frozen learning provenance record is malformed');
  identifier(record.data.policyId,'provenance policy ID');
  digest(record.data.provenanceHash,'provenance hash');check(record.data.provenanceHash===sha256(record.data.provenance),'LEARNING_PROVENANCE','Frozen learning provenance digest differs');
  return clone(record.data);
}
