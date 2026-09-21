// A generic `source` table scan is not provenance: it includes orphaned
// acquisitions and mutable/source-specific metadata. Public source anchors are
// derived only from claims on a currently usable delivered artifact.
import {check,digest,identifier,keys,list,string} from './contracts.mjs';

const plain=value=>value!==null&&typeof value==='object'&&!Array.isArray(value)&&Object.getPrototypeOf(value)===Object.prototype;

function sourceAnchor(store,missionId,reference){
  keys(reference,['sourceId','hash','quote'],['sourceId','hash','quote'],'delivered claim source reference');
  identifier(reference.sourceId,'delivered source id');
  digest(reference.hash,'delivered source hash');
  // Validate, but do not copy, the quoted acquired bytes.
  string(reference.quote,'delivered source quote',{max:20000});
  const source=store.get('source',reference.sourceId)?.data;
  check(plain(source)&&source.missionId===missionId&&source.status==='ADMITTED'&&source.hash===reference.hash
    &&typeof source.raw==='string'&&source.raw.includes(reference.quote),
  'PUBLIC_SOURCE_PROVENANCE','Delivered claim source no longer has its exact admitted bytes');
  return {sourceId:reference.sourceId,hash:reference.hash};
}

/**
 * Return opaque source identity anchors for the delivered product. URLs,
 * source text, citations/quotes, receipt IDs, HTTP metadata and acquisition
 * extensions are intentionally excluded. A future source-reader capability
 * must authenticate and authorize those details separately.
 */
export function readPublicSourceProvenance({registry,artifact}={}){
  try{
    check(registry?.store&&typeof registry.assertUsable==='function','PUBLIC_SOURCE_PROVENANCE','A trusted registry is required');
    check(plain(artifact),'PUBLIC_SOURCE_PROVENANCE','A delivered artifact is required');
    identifier(artifact.id,'delivered artifact id');
    identifier(artifact.missionId,'delivered artifact mission id');
    const accepted=registry.assertUsable(artifact.id,{missionId:artifact.missionId,purpose:artifact.payload?.purpose});
    check(accepted.id===artifact.id&&accepted.payloadHash===artifact.payloadHash,'PUBLIC_SOURCE_PROVENANCE','Delivered artifact changed during provenance projection');
    list(accepted.payload.claims,'delivered claims',{max:100000});
    const anchors=new Map();
    for(const claim of accepted.payload.claims){
      keys(claim,['id','text','kind','sources','basis','qualifiers','validUntil']);
      identifier(claim.id,'delivered claim id');list(claim.sources,'delivered claim sources',{max:100000});
      for(const reference of claim.sources){
        const anchor=sourceAnchor(registry.store,accepted.missionId,reference);
        anchors.set(`${anchor.sourceId}:${anchor.hash}`,anchor);
      }
    }
    return {integrity:'VERIFIED',sources:[...anchors.values()].sort((a,b)=>a.sourceId.localeCompare(b.sourceId)||a.hash.localeCompare(b.hash)),
      scope:'Opaque admitted-source identifiers and content hashes referenced by the currently usable delivered artifact only. No URL, source body, quote, receipt, HTTP metadata or acquisition extension is disclosed.'};
  }catch{return {integrity:'UNVERIFIED',sources:[],scope:'Delivered-source provenance could not be revalidated. No source metadata or body is projected.'};}
}
