// Mission titles have two very different data paths. Historic mappings may
// carry a public title, while current project mappings intentionally retain
// only a hash. The browser must never try to recover a title from that hash or
// from project context. A title read from an already-authorized mission detail
// is cached only for the selected project's local presentation.

const legacyProjectContextPackMarker = '--- SOVEREIGN_PROJECT_CONTEXT_PACK_V1 ---';

const object = value => value && typeof value === 'object' && !Array.isArray(value) ? value : {};

function compactText(value, maximum = 240) {
  if (typeof value !== 'string') return null;
  const compact = value.replace(/[\r\n\t]+/g, ' ').trim();
  if (!compact) return null;
  return compact.length > maximum ? compact.slice(0, Math.max(1, maximum - 1)) + '…' : compact;
}

function isPublicSourcedRoute(mapping) {
  const safe = object(mapping);
  const route = object(safe.routeBinding);
  const admissionRoute = object(object(safe.admission).routeBinding);
  return safe.entryMode === 'sourced-response-v1'
    || route.factoryEntryMode === 'sourced-response-v1'
    || admissionRoute.factoryEntryMode === 'sourced-response-v1';
}

/**
 * Remove the one historic execution-context suffix before a title is shown.
 * This is presentation-only: it never writes, hashes, or mutates a mission.
 */
export function missionIntentPresentation(value) {
  if (typeof value !== 'string') return Object.freeze({intent: null, legacyContextPack: false});
  const markerAt = value.indexOf(legacyProjectContextPackMarker);
  if (markerAt === -1) return Object.freeze({intent: value, legacyContextPack: false});
  const beforeMarker = value.slice(0, markerAt);
  const intent = beforeMarker.endsWith('\r\n')
    ? beforeMarker.slice(0, -2)
    : beforeMarker.endsWith('\n')
      ? beforeMarker.slice(0, -1)
      : beforeMarker;
  return Object.freeze({intent, legacyContextPack: true});
}

/**
 * Return a finite, human-facing mission title without serialising a mapping
 * or trying to recover hidden input. `cachedIntent` must be the already
 * redacted intent of a detail the operator opened in this project.
 */
export function missionTitlePresentation({mapping, cachedIntent = null} = {}) {
  const safe = object(mapping);
  const cached = compactText(cachedIntent);
  if (isPublicSourcedRoute(safe)) {
    return Object.freeze({
      // The exact question is allowed only after the operator opened the
      // mission detail that authorizes it. Until then, preserve the sealed
      // contract label rather than guessing from a mapping hash.
      title: cached ?? 'Respuesta pública con fuentes',
      route: 'SOURCED_PUBLIC',
      source: cached ? 'DETAIL' : 'SEALED_ROUTE',
      legacyContextPack: false,
    });
  }
  const direct = [safe.originalIntent, safe.intent, safe.label]
    .find(candidate => typeof candidate === 'string' && candidate.trim());
  if (direct) {
    const presentation = missionIntentPresentation(direct);
    const title = compactText(presentation.intent);
    if (title) return Object.freeze({
      title,
      route: 'ADMITTED',
      source: 'MAPPING',
      legacyContextPack: presentation.legacyContextPack,
    });
  }
  if (cached) return Object.freeze({
    title: cached,
    route: 'ADMITTED',
    source: 'DETAIL',
    legacyContextPack: false,
  });
  return Object.freeze({
    title: typeof safe.missionId === 'string' ? 'Mandato protegido — abrir misión' : 'Misión no verificable',
    route: typeof safe.missionId === 'string' ? 'SEALED' : 'UNVERIFIED',
    source: 'WITHHELD',
    legacyContextPack: false,
  });
}
