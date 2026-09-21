import {generateKeyPairSync,sign as signDetached} from 'node:crypto';
import {canonical,sha256} from '../../../factory/lib/contracts.mjs';
import {LEARNING_PROVENANCE_POLICY_SCHEMA,LEARNING_PROVENANCE_SCHEMA,learningProvenancePayload} from '../../../factory/lib/learning-provenance.mjs';

// Test-only keys: they exercise authentication and binding, never identity,
// human independence, factual truth, or production policy management.
const labeler=generateKeyPairSync('ed25519'),reviewer=generateKeyPairSync('ed25519');
const publicPem=pair=>pair.publicKey.export({type:'spki',format:'pem'});

export const learningProvenanceFixturePolicy={
  schema:LEARNING_PROVENANCE_POLICY_SCHEMA,
  policyId:'fixture-learning-provenance-policy',
  keys:[
    {keyId:'fixture-labeler',roles:['labeler'],publicKey:publicPem(labeler)},
    {keyId:'fixture-reviewer',roles:['reviewer'],publicKey:publicPem(reviewer)},
  ],
};

export function admitLearningProvenanceFixtureSource(store,{sourceId='source:learning-provenance-fixture',missionId='fixture-learning-provenance',raw='Fixture evidence: this is test-only custody material, not factual proof.'}={}){
  const source={id:sourceId,missionId,receiptId:'receipt:learning-provenance-fixture',
    receiptHash:sha256({sourceId,raw}),raw,hash:sha256(raw),url:'https://fixture.invalid/learning-provenance',httpStatus:200,
    retrievedAt:'2026-09-19T00:00:00.000Z',mediaType:'text/plain',status:'ADMITTED',rootGroup:null,rootAssessment:'UNKNOWN',revokedAt:null};
  store.put('source',sourceId,source,{expectedVersion:0});
  return source;
}

/** Build a detached, signed fixture attestation for the exact normalized
 * domain. The caller owns the Store and chooses an already-admitted source. */
export function signedLearningProvenanceFixture({service,domainId,roleId,datasetSpec,scope,source}){
  const domain=service.prepareDomain({domainId,roleId,datasetSpec,scope});
  const sourceRef={sourceId:source.id,hash:source.hash,quote:source.raw};
  const unsigned={schema:LEARNING_PROVENANCE_SCHEMA,binding:domain.provenanceBinding,
    caseEvidence:domain.datasetSpec.cases.map(c=>({caseId:c.id,sourceRefs:[sourceRef],derivation:`Fixture derivation for ${c.id}; authentication only.`})),
    reviewMethod:'Fixture dual-signature review; cryptographic binding only.',
    limitations:'This fixture does not establish factual truth, representative coverage, split independence, or human independence.',
    attestations:[{role:'labeler',keyId:'fixture-labeler',signature:'AA=='},{role:'reviewer',keyId:'fixture-reviewer',signature:'AA=='}]};
  const payload=Buffer.from(canonical(learningProvenancePayload(unsigned)),'utf8');
  return {...unsigned,attestations:[
    {role:'labeler',keyId:'fixture-labeler',signature:signDetached(null,payload,labeler.privateKey).toString('base64')},
    {role:'reviewer',keyId:'fixture-reviewer',signature:signDetached(null,payload,reviewer.privateKey).toString('base64')},
  ]};
}
