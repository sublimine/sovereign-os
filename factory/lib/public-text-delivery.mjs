// This is intentionally a narrower boundary than `status` or `report`.
// Those views help an operator understand a mission; this one is the
// transport contract for the final user-facing text only.  In particular, it
// must never become a convenient way to serialize a canonical artifact: a
// canonical payload contains internal actor, tool, dependency and evidence
// material that is required for later verification but is not delivery data.
import {check,digest,identifier,sha256} from './contracts.mjs';
import {assertMissionAdmissionFrozen} from './mission-policy-freeze.mjs';
import {inspectPublicLifecycle} from './mission-public-projection.mjs';
import {projectPublicArtifact} from './public-artifact-projection.mjs';
import {assertGenuineArtifactRegistry} from './artifacts.mjs';

export const PUBLIC_TEXT_DELIVERY_SCHEMA='sovereign.public-text-delivery.v1';
export const PUBLIC_TEXT_DELIVERY_MEDIA_TYPE='text/plain; charset=utf-8';
export const MAX_PUBLIC_TEXT_DELIVERY_BYTES=4*1024*1024;

const unavailable=()=>check(false,'DELIVERY_UNAVAILABLE','No accepted textual delivery is available for this mission');

/**
 * Read one final, independently accepted artifact through the Registry's
 * normal usable assertion and reduce it to a deliberately tiny UTF-8 text
 * contract.  This performs no recovery, inference, filesystem operation or
 * store mutation.  It is suitable for a project-scoped UI adapter once that
 * adapter supplies its own authorization/isolation boundary.
 */
export function readPublicTextDelivery({registry,missionId}={}){
  identifier(missionId,'delivery mission id');
  assertGenuineArtifactRegistry(registry);

  // Freeze validation is deliberately before any final pointer lookup.  A
  // transient changed admission envelope must not be able to steer this
  // public reader toward a different artifact and then be restored later.
  const admission=assertMissionAdmissionFrozen(registry,missionId,{code:'DELIVERY_INTEGRITY'}),
    mission=admission.mission?.data,
    lifecycle=inspectPublicLifecycle(mission);
  check(lifecycle.valid&&lifecycle.status==='COMPLETED'&&typeof lifecycle.finalArtifactId==='string',
    'DELIVERY_UNAVAILABLE','No accepted textual delivery is available for this mission');

  const artifactId=lifecycle.finalArtifactId,
    candidate=registry.store.get('artifact',artifactId)?.data,
    purpose=candidate?.payload?.purpose;
  if(typeof purpose!=='string'||purpose.length===0)unavailable();

  // `assertUsable` is the sole admission path for a deliverable final.  Its
  // detailed failure reasons are intentionally not surfaced here: publishing
  // an internal reviewer/provider/tool diagnosis would turn an unavailable
  // delivery into a disclosure channel.
  let accepted;
  try{accepted=registry.assertUsable(artifactId,{missionId,purpose});}
  catch{unavailable();}

  // The artifact projector validates the ordinary JS string contract.  Make
  // the transfer encoding explicit as well: JavaScript can hold unpaired
  // UTF-16 surrogates, while JSON/network clients need a lossless UTF-8 body.
  const body=accepted?.payload?.body;
  if(typeof body!=='string')check(false,'DELIVERY_TEXT_UNSUPPORTED','The accepted final is not textual UTF-8 content');
  const bytes=Buffer.from(body,'utf8');
  check(bytes.toString('utf8')===body,'DELIVERY_TEXT_ENCODING','The accepted final is not lossless UTF-8 text');
  check(bytes.length<=MAX_PUBLIC_TEXT_DELIVERY_BYTES,'DELIVERY_TEXT_SIZE','The accepted final exceeds the textual delivery limit');

  const projected=projectPublicArtifact(accepted);
  check(projected&&projected.payload.body===body,'DELIVERY_INTEGRITY',
    'Accepted final cannot be projected through the public delivery boundary');
  digest(projected.payloadHash,'accepted delivery payload hash');

  // Keep this whitelist small.  `payloadHash` proves the exact accepted
  // canonical product without copying it; `bodySha256` is the integrity value
  // for clients that persist or stream just this text representation.
  return Object.freeze({
    schema:PUBLIC_TEXT_DELIVERY_SCHEMA,
    missionId,
    status:'ACCEPTED',
    artifact:Object.freeze({id:projected.id,payloadHash:projected.payloadHash}),
    content:Object.freeze({
      mediaType:PUBLIC_TEXT_DELIVERY_MEDIA_TYPE,
      sha256:sha256(bytes),
      bytes:bytes.length,
      body
    })
  });
}
