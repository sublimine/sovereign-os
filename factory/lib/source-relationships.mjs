import {check, digest, identifier, list, string, unique} from './contracts.mjs';

/** Mechanical relationships among the sources actually exposed to one run.
 * Content equality and HTTP origin are observations, NOT provenance verdicts.
 * No pairwise explosion, network calls, eTLD assumptions or credibility scores.
 */
export function describeSourceRelationships(sources) {
  list(sources, 'exposed sources', {max: 10000});
  unique(sources.map(s => s.id), 'exposed source IDs');
  const bytes = new Map(), origins = new Map();
  for (const source of sources) {
    identifier(source.id); digest(source.hash); string(source.url);
    let url;
    try { url = new URL(source.url); } catch { check(false, 'SOURCE_URL', 'Malformed acquired-source URL'); }
    check(['https:', 'http:'].includes(url.protocol) && !url.username && !url.password, 'SOURCE_URL', 'Source relationships require HTTP metadata without credentials');
    for (const [map, key] of [[bytes, source.hash], [origins, url.origin]]) {
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(source.id);
    }
  }
  const groups = (map, keyName) => [...map].filter(([, ids]) => ids.length > 1)
    .sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)
    .map(([key, ids]) => ({[keyName]: key, sourceIds: [...ids].sort()}));
  return {sourceCount: sources.length, uniqueContentCount: bytes.size,
    identicalContent: groups(bytes, 'hash'), sharedHttpOrigin: groups(origins, 'origin'),
    rootIndependence: 'NOT_ESTABLISHED',
    interpretation: 'Only exact acquired byte hashes and final HTTP origins are compared. Identical bytes alone do not establish an independent observation; different bytes or origins do not prove independent evidence. A shared origin does not prove one author or one observation. No derivation, credibility, factual truth or contradiction verdict is inferred. Establish provenance and relevant scope from acquired evidence before counting corroborations.'};
}
