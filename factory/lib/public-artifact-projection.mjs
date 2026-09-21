// A usable artifact is evidence for internal consumers, not automatically a
// public document. Its canonical payload deliberately retains producer
// custody, tool receipts, dependency material and reviewer obligations so
// later validators can re-check the result. Those fields can include raw
// workspace/source/provider bytes. Public readers therefore get a dedicated
// delivery view rather than a clone (or a recursively redacted clone) of the
// accepted artifact.
import {digest,identifier,sha256,string} from './contracts.mjs';

export const PUBLIC_DELIVERY_VIEW_SCHEMA='sovereign.public-delivery-view.v1';

const plain=value=>value!==null&&typeof value==='object'&&!Array.isArray(value)&&Object.getPrototypeOf(value)===Object.prototype;

/**
 * Project an artifact only after the caller has obtained it through its
 * route-specific usable assertion (for example `ArtifactRegistry.assertUsable`
 * or the authenticated adaptive-v3 evidence verifier). This function
 * independently rechecks identity and the payload digest so it remains
 * fail-closed when wired into a new read path.
 *
 * The public contract intentionally contains only the delivered body. It is
 * not a partial artifact payload: tool receipts, claims, source quotations,
 * dependencies, criteria, required effects, documentary bindings, producer
 * run identity and every future payload extension remain internal evidence.
 * A later public provenance API must derive each field from its own verified
 * lineage; it must not grow this whitelist by copying a new payload member.
 */
export function projectPublicArtifact(artifact) {
  try {
    if(!plain(artifact)||!plain(artifact.payload))return null;
    identifier(artifact.id,'public delivery artifact id');
    identifier(artifact.missionId,'public delivery mission id');
    if(artifact.status!=='ACCEPTED')return null;
    digest(artifact.payloadHash,'public delivery payload hash');
    if(artifact.payloadHash!==sha256(artifact.payload))return null;

    const payload=artifact.payload;
    identifier(payload.missionId,'public delivery payload mission id');
    if(payload.missionId!==artifact.missionId)return null;
    // A deterministic transform can legitimately produce an empty byte
    // sequence. Ordinary producer admission has already imposed its stricter
    // non-empty requirement where applicable.
    string(payload.body,'public delivery body',{min:0,max:4*1024*1024});

    return {
      schema:PUBLIC_DELIVERY_VIEW_SCHEMA,
      id:artifact.id,
      missionId:artifact.missionId,
      status:'ACCEPTED',
      payloadHash:artifact.payloadHash,
      payload:{body:payload.body},
      scope:'Delivered body only. This view is not the canonical artifact payload and does not disclose internal receipts, provenance material, dependency inputs, criteria, effects, documentary bindings, actor identities or extension metadata.'
    };
  } catch { return null; }
}
