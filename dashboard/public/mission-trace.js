// Public, operational trace renderer.
//
// This deliberately consumes only the reduced status/report projection already
// returned by the console. It does not inspect raw journals, provider payloads
// or hidden agent reasoning. A missing projection is shown as missing rather
// than reconstructed from a plausible-looking workflow.

const array = value => Array.isArray(value) ? value : [];
const object = value => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
const text = (value, fallback = '—') => value === undefined || value === null || value === '' ? fallback : String(value);
const upper = value => String(value ?? '').toUpperCase();

// This is deliberately an allow-list, rather than a generic route renderer.
// A project-public sourced admission is safe to describe only when every
// boundary of its frozen contract is present and exact.  We never interpolate
// route fields here: a malformed or future route must not turn a public trace
// into a channel for private context, identifiers, or diagnostics.
const PROJECT_PUBLIC_SOURCED_ROUTE = Object.freeze({
  schema: 'sublimine.project-route-binding.v1',
  kind: 'project-public-sourced-v1',
  factoryEntryMode: 'sourced-response-v1',
  privateContext: 'WITHHELD_NOT_SAMPLED',
  assets: 'FORBIDDEN',
  fallback: 'EXPLICIT_NEW_PLANNED_ADMISSION_REQUIRED',
});

// The sourced route has a deliberately small, public operational receipt.  Do
// not generalise this parser into a report renderer: the Factory may retain
// source records, diagnostics and provider material that are not suitable for
// this surface.  This projection is the only sourced-route payload consumed by
// the live trace.
const SOURCED_ROUTE_PROGRESS_SCHEMA = 'sovereign.sourced-route-progress.v1';
const SOURCED_ROUTE_PROGRESS_REVISION = 1;
const PUBLIC_MISSION_TRACE_SCHEMA = 'sublimine.public-mission-trace.v1';
const PUBLIC_MISSION_TRACE_REVISION = 1;
const PUBLIC_ENGINE_EVENT_SCHEMA = 'sovereign.public-engine-event.v1';
const sourcedRouteIntegrities = new Set(['VERIFIED', 'UNVERIFIED']);
const sourcedRoutePhases = new Set(['ADMITTED', 'ACQUIRING', 'CANDIDATE_PENDING_REVIEW', 'ACCEPTED', 'ESCALATED', 'UNVERIFIED']);
const sourcedRouteReviewStates = new Set(['NOT_STARTED', 'PENDING', 'ACCEPTED', 'RETURNED', 'UNVERIFIED']);
const sourcedRouteDeliveryStates = new Set(['AVAILABLE', 'NOT_AVAILABLE', 'UNVERIFIED']);
const SEALED_DISCOVERY_DISABLED = 'SEALED_DISABLED';
// Keep the parser fail-closed while accepting the sealed acquisition
// envelopes that this console can legitimately encounter: historic v1 (two
// fetches) and the current used-car v2 evidence packet (three fetches).
// The four-fetch value remains valid only for the pre-existing generic route
// without a sealed-discovery marker; it is not treated as an arbitrary range.
// This is intentionally not a range: a future policy must receive its own UI
// contract update rather than becoming renderable by accident.
const sourcedRouteFetchLimits = new Set([2, 3, 4]);
const publicTraceIntegrities = new Set(['VERIFIED', 'ABSENT', 'UNVERIFIED']);
const publicTraceCoverage = new Set(['FROM_ADMISSION', 'FROM_ADMISSION_TRUNCATED', 'ABSENT', 'UNVERIFIED']);
const publicTraceEventFields = Object.freeze({
  'mission.created': ['schema', 'kind', 'seq', 'at', 'missionId'],
  'mission.status': ['schema', 'kind', 'seq', 'at', 'missionId', 'status', 'pending'],
  'adaptive-v3.direct.accepted': ['schema', 'kind', 'seq', 'at', 'missionId', 'artifactId'],
  'review.retry.authorized': ['schema', 'kind', 'seq', 'at', 'missionId', 'nodeId', 'artifactId', 'attempt'],
  'planning.review.resumed': ['schema', 'kind', 'seq', 'at', 'missionId', 'attempt'],
  'planning.response.recovery': ['schema', 'kind', 'seq', 'at', 'missionId', 'attempt'],
  'planning.attempt': ['schema', 'kind', 'seq', 'at', 'missionId', 'attempt'],
  'planning.response.resumed': ['schema', 'kind', 'seq', 'at', 'missionId'],
  'planning.coverage.normalized': ['schema', 'kind', 'seq', 'at', 'missionId', 'artifactId', 'criteriaBefore', 'criteriaAfter', 'added'],
  'planning.closed-gates.normalized': ['schema', 'kind', 'seq', 'at', 'missionId', 'artifactId', 'added'],
  'planning.input-copy-gates.normalized': ['schema', 'kind', 'seq', 'at', 'missionId', 'artifactId', 'added'],
  'planning.accepted': ['schema', 'kind', 'seq', 'at', 'missionId', 'artifactId', 'nodes'],
  'planning.returned': ['schema', 'kind', 'seq', 'at', 'missionId', 'attempt', 'code'],
  'planning.recovery.required': ['schema', 'kind', 'seq', 'at', 'missionId'],
  'node.review.resumed': ['schema', 'kind', 'seq', 'at', 'missionId', 'nodeId', 'attempt'],
  'node.started': ['schema', 'kind', 'seq', 'at', 'missionId', 'nodeId', 'attempt'],
  'node.accepted': ['schema', 'kind', 'seq', 'at', 'missionId', 'nodeId', 'artifactId'],
  'node.returned': ['schema', 'kind', 'seq', 'at', 'missionId', 'nodeId', 'artifactId'],
  'nodes.parallel.started': ['schema', 'kind', 'seq', 'at', 'missionId', 'nodeIds', 'limit'],
  'node.waiting': ['schema', 'kind', 'seq', 'at', 'missionId', 'nodeId', 'code'],
  'node.correction.required': ['schema', 'kind', 'seq', 'at', 'missionId', 'nodeId', 'code'],
  'learning.observation.failed': ['schema', 'kind', 'seq', 'at', 'missionId', 'code'],
  'sourced-entry.started': ['schema', 'kind', 'seq', 'at', 'missionId'],
  'sourced-entry.producer.recovered': ['schema', 'kind', 'seq', 'at', 'missionId'],
  'sourced-entry.deferred': ['schema', 'kind', 'seq', 'at', 'missionId', 'code'],
  'sourced-entry.fallback': ['schema', 'kind', 'seq', 'at', 'missionId', 'code'],
  'sourced-entry.producer.final-rejected': ['schema', 'kind', 'seq', 'at', 'missionId', 'code'],
  'sourced-entry.accepted': ['schema', 'kind', 'seq', 'at', 'missionId', 'artifactId'],
});
const publicTraceStatuses = new Set(['NEW', 'PLANNING', 'RUNNING', 'WAITING_QUOTA', 'WAITING_PROVIDER', 'WAITING_CAPABILITY', 'NEEDS_DIRECTION', 'PAUSED', 'CANCELLING', 'CANCELLED', 'COMPLETED', 'FAILED']);
const publicTraceCode = /^[A-Z_][A-Z0-9_]{0,159}$/;
const publicTraceIdentifier = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,179}$/;
const publicTraceHash = /^[a-f0-9]{64}$/;

function isIntegerBetween(value, minimum, maximum) {
  return Number.isInteger(value) && value >= minimum && value <= maximum;
}

function exactPublicTraceTime(value) {
  return typeof value === 'string'
    && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)
    && Number.isFinite(Date.parse(value))
    && new Date(value).toISOString() === value;
}

function publicTraceId(value) {
  return typeof value === 'string' && publicTraceIdentifier.test(value) ? value : null;
}

function utf8ByteLength(value) {
  // TextEncoder is a browser-standard API (and is also present in the Node
  // test runtime).  Do not pull Node's Buffer into this module: this file is
  // served directly to the operator's browser.
  return new TextEncoder().encode(value).byteLength;
}

function publicTraceCodes(value) {
  if (!Array.isArray(value) || value.length > 1_000) return null;
  const codes = [];
  for (const item of value) {
    const pending = object(item);
    if (!Object.keys(pending).every(key => ['code', 'nodeId', 'operationId'].includes(key))
      || !Object.hasOwn(pending, 'code') || typeof pending.code !== 'string' || !publicTraceCode.test(pending.code)) return null;
    const row = {code: pending.code};
    if (Object.hasOwn(pending, 'nodeId')) {
      const nodeId = publicTraceId(pending.nodeId);
      if (!nodeId) return null;
      row.nodeId = nodeId;
    }
    if (Object.hasOwn(pending, 'operationId')) {
      const operationId = publicTraceId(pending.operationId);
      if (!operationId) return null;
      row.operationId = operationId;
    }
    codes.push(Object.freeze(row));
  }
  return Object.freeze(codes);
}

// A signed Factory receipt is still parsed field-by-field in the browser. The
// browser only uses an exact, finite vocabulary and never forwards an unknown
// future field into the DOM merely because a local signature exists.
function publicTraceEvent(value) {
  const event = object(value);
  const allowed = publicTraceEventFields[event.kind];
  if (!allowed || event.schema !== PUBLIC_ENGINE_EVENT_SCHEMA || !Object.keys(event).every(key => allowed.includes(key))
    || !allowed.every(key => Object.hasOwn(event, key)) || !isIntegerBetween(event.seq, 1, Number.MAX_SAFE_INTEGER)
    || !exactPublicTraceTime(event.at) || !publicTraceId(event.missionId)) return null;
  const safe = {schema: PUBLIC_ENGINE_EVENT_SCHEMA, kind: event.kind, seq: event.seq, at: event.at, missionId: event.missionId};
  const idFields = ['nodeId', 'artifactId'];
  for (const field of idFields) {
    if (Object.hasOwn(event, field)) {
      const id = publicTraceId(event[field]);
      if (!id) return null;
      safe[field] = id;
    }
  }
  if (Object.hasOwn(event, 'status')) {
    if (!publicTraceStatuses.has(event.status)) return null;
    safe.status = event.status;
  }
  if (Object.hasOwn(event, 'pending')) {
    const pending = publicTraceCodes(event.pending);
    if (!pending) return null;
    safe.pending = pending;
  }
  if (Object.hasOwn(event, 'code')) {
    if (typeof event.code !== 'string' || !publicTraceCode.test(event.code)) return null;
    safe.code = event.code;
  }
  for (const field of ['attempt', 'criteriaBefore', 'criteriaAfter', 'nodes', 'limit']) {
    if (Object.hasOwn(event, field)) {
      const maximum = field === 'limit' ? 4 : 10_000;
      const minimum = field === 'limit' ? 1 : 0;
      if (!isIntegerBetween(event[field], minimum, maximum)) return null;
      safe[field] = event[field];
    }
  }
  for (const field of ['added', 'nodeIds']) {
    if (Object.hasOwn(event, field)) {
      if (!Array.isArray(event[field]) || event[field].length < (field === 'nodeIds' ? 1 : 0) || event[field].length > 10_000) return null;
      const ids = event[field].map(publicTraceId);
      if (ids.some(value => !value) || new Set(ids).size !== ids.length) return null;
      safe[field] = Object.freeze(ids);
    }
  }
  return Object.freeze(safe);
}

/** Return a narrow browser-safe signed execution trace, or null on any mismatch. */
export function publicMissionTrace(value, {missionId: expectedMissionId = null} = {}) {
  const trace = object(value);
  const expected = expectedMissionId === null ? null : publicTraceId(expectedMissionId);
  if (trace.schema !== PUBLIC_MISSION_TRACE_SCHEMA || trace.revision !== PUBLIC_MISSION_TRACE_REVISION
    || !publicTraceIntegrities.has(trace.integrity) || !publicTraceCoverage.has(trace.coverage)
    || !Array.isArray(trace.entries) || trace.entries.length > 4_096
    || typeof trace.scope !== 'string' || utf8ByteLength(trace.scope) > 1200
    || !Object.keys(trace).every(key => ['schema', 'revision', 'integrity', 'coverage', 'entries', 'scope'].includes(key))
    || (expectedMissionId !== null && !expected)) return null;
  const entries = [];
  let priorRevision = 0;
  let traceMissionId = null;
  const seenHashes = new Set();
  for (const item of trace.entries) {
    const entry = object(item);
    if (!['revision', 'at', 'event', 'receiptHash'].every(key => Object.hasOwn(entry, key))
      || !Object.keys(entry).every(key => ['revision', 'at', 'event', 'receiptHash'].includes(key))
      || !isIntegerBetween(entry.revision, 1, Number.MAX_SAFE_INTEGER)
      || entry.revision <= priorRevision || !exactPublicTraceTime(entry.at)
      || typeof entry.receiptHash !== 'string' || !publicTraceHash.test(entry.receiptHash) || seenHashes.has(entry.receiptHash)) return null;
    const event = publicTraceEvent(entry.event);
    if (!event || event.seq !== entry.revision || event.at !== entry.at
      || (traceMissionId !== null && event.missionId !== traceMissionId)
      || (expected !== null && event.missionId !== expected)) return null;
    traceMissionId ??= event.missionId;
    priorRevision = entry.revision;
    seenHashes.add(entry.receiptHash);
    entries.push(Object.freeze({revision: entry.revision, at: entry.at, event, receiptHash: entry.receiptHash}));
  }
  if (trace.integrity === 'VERIFIED') {
    if (!['FROM_ADMISSION', 'FROM_ADMISSION_TRUNCATED'].includes(trace.coverage) || !entries.length) return null;
  } else if (entries.length || trace.coverage !== (trace.integrity === 'ABSENT' ? 'ABSENT' : 'UNVERIFIED')) return null;
  return Object.freeze({
    schema: PUBLIC_MISSION_TRACE_SCHEMA,
    revision: PUBLIC_MISSION_TRACE_REVISION,
    integrity: trace.integrity,
    coverage: trace.coverage,
    entries: Object.freeze(entries),
  });
}

/**
 * Return a fresh, allow-listed sourced-route receipt or null.
 *
 * A caller must never render the source object itself.  In particular, an
 * apparently harmless future field could carry a URL, prompt, raw source, or
 * internal diagnostic.  Keeping the copy explicit also makes the schema bump
 * fail closed in this UI.
 */
export function publicSourcedRouteProgress(value) {
  const progress = object(value);
  const acquisition = object(progress.acquisition);
  const search = object(acquisition.search);
  const fetch = object(acquisition.fetch);
  const review = object(progress.independentReview);
  const delivery = object(progress.delivery);
  if (progress.schema !== SOURCED_ROUTE_PROGRESS_SCHEMA
    || progress.revision !== SOURCED_ROUTE_PROGRESS_REVISION
    || !sourcedRouteIntegrities.has(progress.integrity)
    || !sourcedRoutePhases.has(progress.phase)
    || !([0, 1].includes(search.limit))
    || !isIntegerBetween(search.used, 0, search.limit)
    || !sourcedRouteFetchLimits.has(fetch.limit)
    || !isIntegerBetween(fetch.used, 0, fetch.limit)
    || acquisition.maxSourceBytes !== 65_536
    || review.required !== true
    || !sourcedRouteReviewStates.has(review.state)
    || !isIntegerBetween(progress.verifiedSourceAnchorCount, 0, fetch.limit)
    || !sourcedRouteDeliveryStates.has(delivery.availability)
    // Absence preserves the generic route's historical 1-search receipt.
    // The one added form is deliberately exact: a sealed packet discloses
    // no searchable source data, only that discovery is disabled and its
    // finite, named two- or three-fetch allowance.
    || (Object.hasOwn(acquisition, 'discovery')
      ? !(acquisition.discovery === SEALED_DISCOVERY_DISABLED && search.limit === 0 && search.used === 0 && [2, 3].includes(fetch.limit))
      : search.limit !== 1)) return null;

  return Object.freeze({
    schema: SOURCED_ROUTE_PROGRESS_SCHEMA,
    revision: SOURCED_ROUTE_PROGRESS_REVISION,
    integrity: progress.integrity,
    phase: progress.phase,
    acquisition: Object.freeze({
      search: Object.freeze({used: search.used, limit: search.limit}),
      fetch: Object.freeze({used: fetch.used, limit: fetch.limit}),
      maxSourceBytes: 65_536,
      ...(acquisition.discovery === SEALED_DISCOVERY_DISABLED ? {discovery: SEALED_DISCOVERY_DISABLED} : {}),
    }),
    independentReview: Object.freeze({required: true, state: review.state}),
    verifiedSourceAnchorCount: progress.verifiedSourceAnchorCount,
    delivery: Object.freeze({availability: delivery.availability}),
  });
}

export function isProjectPublicSourcedRouteBinding(value) {
  const binding = object(value);
  return Object.entries(PROJECT_PUBLIC_SOURCED_ROUTE)
    .every(([key, expected]) => binding[key] === expected);
}

function admissionRouteBindings(mapping, admission) {
  // `admission.routeBinding` is the current contract location. The second
  // location is accepted only for a compatible public projection. Neither
  // object is rendered dynamically.
  return [object(admission.routeBinding), object(object(mapping).routeBinding)];
}

function hasProjectPublicSourcedRoute(mapping, admission) {
  return admissionRouteBindings(mapping, admission)
    .some(isProjectPublicSourcedRouteBinding);
}

function hasDeclaredRouteBinding(mapping, admission) {
  return admissionRouteBindings(mapping, admission)
    .some(binding => Object.keys(binding).length > 0);
}

function element(tag, options = {}, children = []) {
  const node = document.createElement(tag);
  const {className, value, attrs, dataset} = options;
  if (className) node.className = className;
  if (value !== undefined && value !== null) node.textContent = String(value);
  if (attrs) {
    for (const [key, item] of Object.entries(attrs)) {
      if (item !== undefined && item !== null) node.setAttribute(key, String(item));
    }
  }
  if (dataset) Object.assign(node.dataset, dataset);
  for (const child of Array.isArray(children) ? children : [children]) {
    if (child !== null && child !== undefined) node.append(child);
  }
  return node;
}

function formatDate(value) {
  if (!value) return 'sin hora registrada';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'hora no proyectada';
  return new Intl.DateTimeFormat('es-ES', {dateStyle: 'medium', timeStyle: 'medium'}).format(date);
}

function statusClass(value) {
  const status = upper(value);
  if (['COMPLETED', 'ACCEPTED', 'AVAILABLE', 'VERIFIED', 'READY', 'RUNNING'].includes(status)) return 'success';
  if (['FAILED', 'CANCELLED', 'BLOCKED', 'INVALIDATED', 'UNVERIFIED'].includes(status)) return 'danger';
  if (['NEW', 'ADMITTED', 'ACQUIRING', 'CANDIDATE_PENDING_REVIEW', 'ESCALATED', 'NOT_AVAILABLE', 'PLANNING', 'PENDING', 'PENDING_RECORD', 'REVIEW_PENDING', 'RETURNED', 'WAITING_QUOTA', 'WAITING_PROVIDER', 'WAITING_CAPABILITY', 'NEEDS_DIRECTION', 'PAUSED', 'CANCELLING'].includes(status)) return 'warning';
  return '';
}

function statusPill(value, fallback = 'NO PROYECTADO') {
  return element('span', {className: 'trace-status ' + statusClass(value), value: text(value, fallback)});
}

// A trace stage deliberately has two semantic layers: a visible heading that
// names the confirmed boundary, and a native disclosure that contains its
// details.  Native <details> keeps this usable with a keyboard and without
// JavaScript state.  It also means that a long operational trace can be
// scanned without hiding whether a stage exists or its current status.
//
// `id` and `navigationLabel` are supplied only by this module's static stage
// definitions below.  They are never derived from a receipt, provider output,
// source, prompt, or agent message.
function traceStageId(value) {
  return typeof value === 'string' && /^trace-[a-z0-9-]{2,80}$/.test(value) ? value : null;
}

function disclosure({id = null, label = 'DETALLE', title = 'Actividad confirmada', state = null, body = null, expanded = false}) {
  const safeId = traceStageId(id);
  const attrs = {
    ...(safeId ? {id: safeId} : {}),
    ...(expanded ? {open: ''} : {}),
  };
  const heading = text(title, 'Actividad confirmada');
  return element('details', {className: 'trace-signed-receipt trace-disclosure', attrs}, [
    element('summary', {
      className: 'trace-signed-receipt-summary',
      attrs: {'aria-label': heading + '. Mostrar u ocultar detalle público confirmado.'},
    }, [
      element('span', {className: 'trace-signed-receipt-seq', value: text(label, 'DETALLE')}),
      element('strong', {value: heading}),
      state ? statusPill(state) : element('span', {className: 'trace-status', value: 'PÚBLICO'}),
    ]),
    element('div', {className: 'trace-signed-receipt-body'}, body ? [body] : [
      element('p', {value: 'No hay detalles públicos adicionales para esta sección.'}),
    ]),
  ]);
}

function stage({id = null, navigationLabel = null, label, title, state, at = null, body = null, meta = null, empty = false, expanded = true}) {
  const safeId = traceStageId(id);
  const titleId = safeId ? safeId + '-heading' : null;
  const card = element('article', {
    className: 'trace-stage' + (empty ? ' is-empty' : ''),
    attrs: {
      ...(safeId ? {id: safeId} : {}),
      ...(titleId ? {'aria-labelledby': titleId} : {}),
    },
    dataset: safeId ? {
      traceStageId: safeId,
      traceNavigationLabel: text(navigationLabel, title),
    } : undefined,
  });
  const rail = element('div', {className: 'trace-rail', attrs: {'aria-hidden': 'true'}}, [element('i')]);
  const header = element('header', {className: 'trace-stage-head'}, [
    element('div', {}, [
      element('p', {className: 'trace-label', value: label}),
      element('h3', {value: title, attrs: titleId ? {id: titleId} : undefined}),
    ]),
    statusPill(state),
  ]);
  const content = element('div', {className: 'trace-stage-content'});
  if (at) content.append(element('time', {className: 'trace-time', value: formatDate(at), attrs: {datetime: String(at)}}));
  if (typeof body === 'string') content.append(element('p', {value: body}));
  else if (body) content.append(body);
  if (meta) content.append(meta);
  const detail = disclosure({
    id: safeId ? safeId + '-details' : null,
    label: 'DETALLE',
    title: 'Actividad pública confirmada',
    state,
    body: content,
    expanded,
  });
  card.append(rail, element('div', {className: 'trace-stage-card'}, [header, detail]));
  return card;
}

function traceNavigation(stages) {
  const links = array(stages)
    .map(stageNode => ({
      id: traceStageId(stageNode?.dataset?.traceStageId),
      label: text(stageNode?.dataset?.traceNavigationLabel, ''),
    }))
    .filter(item => item.id && item.label)
    .map(item => element('li', {}, [
      element('a', {value: item.label, attrs: {href: '#' + item.id}}),
    ]));
  if (!links.length) return null;
  return element('nav', {className: 'trace-navigation', attrs: {'aria-label': 'Navegación de la traza operativa'}}, [
    element('p', {className: 'trace-label', value: 'NAVEGAR LA TRAZA'}),
    list(links, 'trace-list trace-navigation-list'),
  ]);
}

function list(items, className = 'trace-list') {
  const holder = element('ul', {className});
  for (const item of items) holder.append(item);
  return holder;
}

function nodeSpec(node) {
  const spec = object(node?.spec);
  return {
    id: text(node?.id ?? spec.id, 'nodo sin ID'),
    title: text(node?.title ?? spec.title ?? node?.id ?? spec.id, 'Nodo sin título'),
    status: text(node?.status, 'NO PROYECTADO'),
    roles: array(node?.roles).length ? array(node.roles) : array(spec.roleIds),
    reviewers: array(node?.reviewers).length ? array(node.reviewers) : array(spec.reviewerRoleIds),
    dependencies: array(node?.dependencies).length ? array(node.dependencies) : array(spec.dependencies),
    artifactId: node?.artifactId ?? null,
  };
}

function nodeTrace(nodes, {topologyIntegrity = null, sourcedRoute = false} = {}) {
  const visibleNodes = array(nodes).map(nodeSpec);
  if (!visibleNodes.length) {
    if (sourcedRoute) {
      return stage({
        id: 'trace-topology',
        navigationLabel: 'Topología',
        label: '05 · TOPOLOGÍA',
        title: 'No aplica a esta ruta acotada',
        state: 'NO APLICA',
        body: 'La respuesta pública con fuentes no construye un grafo de nodos ni handoffs. Su progreso se muestra en la ficha operativa de la ruta; la ausencia de topología no significa trabajo pendiente.',
        empty: true,
      });
    }
    const explanation = topologyIntegrity === 'UNVERIFIED'
      ? 'La topología no superó su verificación pública; no se muestran nodos ni se infiere una ruta alternativa.'
      : 'La fábrica aún no ha proyectado una topología de nodos verificable para esta misión.';
    return stage({
      id: 'trace-topology',
      navigationLabel: 'Topología',
      label: '05 · TOPOLOGÍA',
      title: 'Nodos y handoffs',
      state: topologyIntegrity || 'AUSENTE',
      body: explanation,
      empty: true,
    });
  }

  const items = visibleNodes.map((node, index) => {
    const roleText = node.roles.length ? node.roles.join(', ') : 'roles no proyectados';
    const reviewerText = node.reviewers.length ? node.reviewers.join(', ') : 'revisión no proyectada';
    const dependencyIds = node.dependencies.map(dependency => text(object(dependency).nodeId, typeof dependency === 'string' ? dependency : '')).filter(Boolean);
    const details = [
      element('span', {value: 'Roles: ' + roleText}),
      element('span', {value: 'Revisión: ' + reviewerText}),
      dependencyIds.length ? element('span', {value: 'Depende de: ' + dependencyIds.join(', ')}) : element('span', {value: 'Sin dependencias declaradas'}),
      node.artifactId ? element('span', {value: 'Producto aceptado: ' + node.artifactId}) : null,
    ].filter(Boolean);
    return element('li', {}, [
      disclosure({
        id: 'trace-topology-node-' + (index + 1),
        label: 'NODO ' + (index + 1),
        title: node.title,
        state: node.status,
        expanded: false,
        body: element('div', {className: 'trace-node-meta'}, [
          element('code', {value: node.id}),
          element('span', {value: 'Esta ficha refleja la asignación publicada del plan. No contiene mensajes entre agentes ni razonamiento privado.'}),
          ...details,
        ]),
      }),
    ]);
  });
  return stage({
    id: 'trace-topology',
    navigationLabel: 'Topología',
    label: '05 · TOPOLOGÍA PUBLICADA',
    title: visibleNodes.length + ' nodo' + (visibleNodes.length === 1 ? '' : 's') + ' proyectado' + (visibleNodes.length === 1 ? '' : 's'),
    state: topologyIntegrity || 'PROYECTADA',
    body: element('div', {className: 'trace-node-content'}, [
      element('p', {value: 'Cada estado corresponde al nodo publicado por la fábrica. Abre cada ficha para ver la asignación, dependencias y producto publicado; no se exponen mensajes internos ni razonamiento privado.'}),
      list(items, 'trace-node-list'),
    ]),
  });
}

function evidenceTrace(report) {
  if (!report) {
    return stage({
      id: 'trace-evidence',
      navigationLabel: 'Evidencia',
      label: '06 · EVIDENCIA',
      title: 'Informe aún no disponible',
      state: 'NO PROYECTADO',
      body: 'El estado puede estar disponible antes que el informe. No se deduce evidencia, revisiones ni consumo mientras falte la proyección del informe.',
      empty: true,
    });
  }
  const sources = array(report.sources);
  const reviews = array(report.reviews);
  const provenance = object(report.sourceProvenance);
  const metrics = object(report.metrics);
  const final = object(report.final);
  const metadata = [];
  metadata.push(element('li', {value: 'Proveniencia de fuentes: ' + text(provenance.integrity, 'NO PROYECTADA')}));
  metadata.push(element('li', {value: 'Fuentes verificadas proyectadas: ' + sources.length}));
  metadata.push(element('li', {value: 'Revisiones proyectadas: ' + reviews.length}));
  metadata.push(element('li', {value: 'Telemetría operacional: ' + text(metrics.operationalTelemetry, metrics.integrity === 'NOT_ATTESTED' ? 'NO ATTESTED' : 'NO PROYECTADA')}));
  if (final.id) metadata.push(element('li', {value: 'Entrega pública verificada: ' + final.id}));
  else metadata.push(element('li', {value: 'Entrega pública: no proyectada'}));
  const integrity = text(metrics.integrity, 'NO PROYECTADA');
  return stage({
    id: 'trace-evidence',
    navigationLabel: 'Evidencia',
    label: '06 · EVIDENCIA Y REVISIÓN',
    title: 'Recibos públicos del informe',
    state: integrity,
    body: 'Esta vista sólo cuenta los recibos que el informe público expone. Una ausencia no se presenta como una revisión hecha, una fuente leída ni una llamada al proveedor. Abre el inventario para auditar los conteos publicados.',
    meta: disclosure({
      id: 'trace-evidence-inventory',
      label: 'INVENTARIO',
      title: 'Conteos y recibos públicos',
      state: integrity,
      expanded: true,
      body: element('div', {}, [
        list(metadata),
        element('p', {value: 'Los títulos, URLs, cuerpos de fuente y diagnósticos no se convierten en evidencia mostrable aquí sin un contrato público específico.'}),
      ]),
    }),
  });
}

function lifecycleTrace(mission) {
  const history = array(mission.history);
  if (!history.length) {
    return stage({
      id: 'trace-lifecycle',
      navigationLabel: 'Cronología',
      label: '01 · CICLO DE VIDA',
      title: 'Sin cronología pública todavía',
      state: mission.status || 'NO PROYECTADO',
      body: 'No hay transiciones verificables proyectadas. La consola muestra el estado actual, pero no inventa marcas de tiempo ni pasos intermedios.',
      empty: true,
    });
  }
  const entries = history.map(entry => {
    const safeEntry = object(entry);
    return element('li', {className: 'trace-history-entry'}, [
    statusPill(safeEntry.status),
      element('time', {value: formatDate(safeEntry.at), attrs: {datetime: String(safeEntry.at)}}),
    ]);
  });
  return stage({
    id: 'trace-lifecycle',
    navigationLabel: 'Cronología',
    label: '01 · CICLO DE VIDA',
    title: history.length === 1 ? '1 transición confirmada' : history.length + ' transiciones confirmadas',
    state: mission.status,
    body: element('div', {}, [
      element('p', {value: 'Cronología de estados que la misión publicó. La vista no rellena huecos con actividad estimada.'}),
      list(entries, 'trace-history'),
    ]),
  });
}

// Public labels are deliberately static.  A receipt kind may identify an
// operational transition, but it never supplies a title, prose or an agent
// message for the browser to render.
const signedTraceTitles = Object.freeze({
  'mission.created': 'Misión admitida',
  'mission.status': 'Estado de la misión publicado',
  'adaptive-v3.direct.accepted': 'Salida directa aceptada',
  'review.retry.authorized': 'Reintento de revisión autorizado',
  'planning.review.resumed': 'Revisión de planificación reanudada',
  'planning.response.recovery': 'Recuperación de planificación iniciada',
  'planning.attempt': 'Intento de planificación registrado',
  'planning.response.resumed': 'Respuesta de planificación reanudada',
  'planning.coverage.normalized': 'Cobertura de planificación normalizada',
  'planning.closed-gates.normalized': 'Controles cerrados normalizados',
  'planning.input-copy-gates.normalized': 'Controles de entrada normalizados',
  'planning.accepted': 'Plan aceptado',
  'planning.returned': 'Plan devuelto para corrección',
  'planning.recovery.required': 'Recuperación de planificación requerida',
  'node.review.resumed': 'Revisión de nodo reanudada',
  'node.started': 'Nodo iniciado',
  'node.accepted': 'Nodo aceptado',
  'node.returned': 'Nodo devuelto',
  'nodes.parallel.started': 'Grupo paralelo iniciado',
  'node.waiting': 'Nodo en espera',
  'node.correction.required': 'Corrección de nodo requerida',
  'learning.observation.failed': 'Observación de aprendizaje no aplicable',
  'sourced-entry.started': 'Ruta pública con fuentes iniciada',
  'sourced-entry.producer.recovered': 'Productor de ruta pública recuperado',
  'sourced-entry.deferred': 'Ruta pública escalada',
  'sourced-entry.fallback': 'Ruta pública devuelta',
  'sourced-entry.producer.final-rejected': 'Candidato de ruta pública rechazado',
  'sourced-entry.accepted': 'Respuesta pública con fuentes aceptada',
});

function signedTraceSummary(event) {
  switch (event.kind) {
    case 'mission.created':
      return 'La admisión inmutable de la misión quedó registrada por la fábrica.';
    case 'mission.status':
      return 'La fábrica publicó el estado operativo indicado en este recibo.';
    case 'planning.returned':
    case 'node.returned':
    case 'node.correction.required':
      return 'Este recibo registra un retorno controlado; no inventa una corrección posterior.';
    case 'node.waiting':
      return 'Este recibo confirma una espera publicada, no un trabajo completado.';
    case 'learning.observation.failed':
      return 'La observación no se aplicó. No se muestra ningún contenido de aprendizaje ni diagnóstico interno.';
    case 'sourced-entry.started':
      return 'La ruta pública con fuentes inició su trabajo acotado. Las fuentes, URLs, prompts y conversaciones internas no forman parte de este recibo.';
    case 'sourced-entry.producer.recovered':
      return 'El productor se recuperó desde el estado autorizado. No se publican identificadores de ejecución ni contenido de intentos anteriores.';
    case 'sourced-entry.deferred':
      return 'La ruta pública cerró sin ampliar por sí sola el alcance privado del proyecto.';
    case 'sourced-entry.fallback':
      return 'La ruta no aceptó el candidato actual. Este recibo no contiene el motivo privado ni el contenido del candidato.';
    case 'sourced-entry.producer.final-rejected':
      return 'Un candidato retenido no superó su control de materialización; no se expone el texto rechazado.';
    case 'sourced-entry.accepted':
      return 'La respuesta de ruta pública fue aceptada con su evidencia y revisión requeridas. El producto sólo se habilita mediante la entrega verificada.';
    default:
      return 'Transición operativa registrada, firmada y encadenada por la fábrica.';
  }
}

function signedTraceFacts(entry) {
  const event = entry.event;
  const facts = [
    element('li', {value: 'Secuencia durable: ' + entry.revision}),
    element('li', {value: 'Hora confirmada: ' + formatDate(entry.at)}),
    element('li', {value: 'Recibo: ' + entry.receiptHash.slice(0, 16) + '…'}),
  ];
  if (event.status) facts.push(element('li', {value: 'Estado publicado: ' + event.status}));
  if (event.code) facts.push(element('li', {value: 'Código público: ' + event.code}));
  if (event.attempt !== undefined) facts.push(element('li', {value: 'Intento: ' + event.attempt}));
  if (event.nodeId) facts.push(element('li', {value: 'Nodo publicado: ' + event.nodeId}));
  if (event.artifactId) facts.push(element('li', {value: 'Artefacto público: ' + event.artifactId}));
  if (event.nodes !== undefined) facts.push(element('li', {value: 'Nodos declarados: ' + event.nodes}));
  if (event.limit !== undefined) facts.push(element('li', {value: 'Límite paralelo publicado: ' + event.limit}));
  if (event.criteriaBefore !== undefined) facts.push(element('li', {value: 'Criterios antes: ' + event.criteriaBefore}));
  if (event.criteriaAfter !== undefined) facts.push(element('li', {value: 'Criterios después: ' + event.criteriaAfter}));
  if (event.added) facts.push(element('li', {value: 'Referencias añadidas: ' + publicTraceListPreview(event.added)}));
  if (event.nodeIds) facts.push(element('li', {value: 'Nodos del grupo: ' + publicTraceListPreview(event.nodeIds)}));
  if (event.pending?.length) {
    const pending = event.pending.slice(0, 24).map(item => {
      const refs = [item.nodeId ? 'nodo ' + item.nodeId : null, item.operationId ? 'operación ' + item.operationId : null].filter(Boolean);
      return item.code + (refs.length ? ' · ' + refs.join(' · ') : '');
    });
    const suffix = event.pending.length > pending.length ? ' · +' + (event.pending.length - pending.length) + ' más en el recibo exportable' : '';
    facts.push(element('li', {value: 'Pendientes publicados: ' + pending.join(' | ') + suffix}));
  }
  return facts;
}

function publicTraceListPreview(values, limit = 24) {
  const visible = values.slice(0, limit);
  return visible.join(', ') + (values.length > visible.length ? ' · +' + (values.length - visible.length) + ' más en el recibo exportable' : '');
}

function signedTraceEntry(entry) {
  const event = entry.event;
  const title = signedTraceTitles[event.kind];
  // `publicMissionTrace` has already made unknown kinds impossible.  Keep a
  // static fallback nonetheless so this view can never render an untrusted
  // kind as operator-facing copy if the parser changes in the future.
  const safeTitle = title || 'Recibo operativo público';
  const summaryState = event.status || (event.code ? event.code : 'FIRMADO');
  return element('li', {className: 'trace-signed-receipt'}, [
    element('details', {attrs: {id: 'trace-receipt-' + entry.revision}}, [
      element('summary', {
        className: 'trace-signed-receipt-summary',
        attrs: {'aria-label': '#' + entry.revision + '. ' + safeTitle + '. Mostrar u ocultar recibo público firmado.'},
      }, [
        element('span', {className: 'trace-signed-receipt-seq', value: '#' + entry.revision}),
        element('strong', {value: safeTitle}),
        statusPill(summaryState),
      ]),
      element('div', {className: 'trace-signed-receipt-body'}, [
        element('p', {value: signedTraceSummary(event)}),
        list(signedTraceFacts(entry), 'trace-list trace-signed-receipt-facts'),
      ]),
    ]),
  ]);
}

function signedReceiptNavigation(entries) {
  if (!entries.length) return null;
  const links = entries.map(entry => {
    const title = signedTraceTitles[entry.event.kind] || 'Recibo operativo público';
    return element('li', {}, [
      element('a', {value: '#' + entry.revision + ' · ' + title, attrs: {href: '#trace-receipt-' + entry.revision}}),
    ]);
  });
  return element('nav', {className: 'trace-receipt-navigation', attrs: {'aria-label': 'Navegar por recibos firmados'}}, [
    element('p', {value: 'Cada enlace lleva al recibo desplegable correspondiente. Los recibos sólo contienen metadatos públicos firmados.'}),
    list(links, 'trace-list trace-receipt-navigation-list'),
  ]);
}

function signedExecutionTrace(report, {missionId = null} = {}) {
  if (!report || !Object.hasOwn(report, 'publicTrace')) {
    return stage({
      id: 'trace-receipts',
      navigationLabel: 'Recibos firmados',
      label: '01B · RECIBOS FIRMADOS',
      title: 'Traza firmada aún no proyectada',
      state: 'NO PROYECTADA',
      body: 'Este informe todavía no incluye recibos operativos firmados. La consola no reconstruye una cronología desde el journal interno ni desde actividad aparente.',
      empty: true,
    });
  }
  const trace = publicMissionTrace(report.publicTrace, {missionId});
  if (!trace) {
    return stage({
      id: 'trace-receipts',
      navigationLabel: 'Recibos firmados',
      label: '01B · RECIBOS FIRMADOS',
      title: 'Traza firmada no verificable',
      state: 'UNVERIFIED',
      body: 'La proyección no cumple el contrato público exacto. No se muestran eventos, hashes, prompts, diagnósticos ni sustitutos inferidos.',
      empty: true,
    });
  }
  if (trace.integrity === 'ABSENT') {
    return stage({
      id: 'trace-receipts',
      navigationLabel: 'Recibos firmados',
      label: '01B · RECIBOS FIRMADOS',
      title: 'Sin recibos firmados para esta misión',
      state: 'ABSENT',
      body: 'Esta misión se creó antes de que la fábrica emitiera una traza pública firmada, o aún no tiene una. No se reconstruye retrospectivamente a partir del journal interno.',
      empty: true,
    });
  }
  if (trace.integrity !== 'VERIFIED') {
    return stage({
      id: 'trace-receipts',
      navigationLabel: 'Recibos firmados',
      label: '01B · RECIBOS FIRMADOS',
      title: 'Cadena de recibos no verificable',
      state: 'UNVERIFIED',
      body: 'La cadena firmada no pudo revalidarse. La fábrica oculta las entradas y no transforma un fallo de integridad en una explicación plausible.',
      empty: true,
    });
  }
  const truncated = trace.coverage === 'FROM_ADMISSION_TRUNCATED';
  return stage({
    id: 'trace-receipts',
    navigationLabel: 'Recibos firmados',
    label: '01B · RECIBOS FIRMADOS',
    title: trace.entries.length + ' recibo' + (trace.entries.length === 1 ? '' : 's') + ' verificable' + (trace.entries.length === 1 ? '' : 's'),
    state: 'VERIFIED',
    body: truncated
      ? 'La cadena se verificó desde la admisión; por límite de vista se muestran los recibos más recientes. Abre cada uno para auditar su transición y metadatos públicos.'
      : 'Cadena completa desde la admisión de la misión. Abre cada recibo para auditar su transición y metadatos públicos; no contiene razonamiento privado.',
    meta: element('div', {}, [
      signedReceiptNavigation(trace.entries),
      list(trace.entries.map(signedTraceEntry), 'trace-signed-receipt-list'),
    ].filter(Boolean)),
  });
}

function pendingTrace(mission) {
  const pending = array(mission.pending);
  if (!pending.length) return null;
  const rows = pending.map(item => {
    const safeItem = object(item);
    const details = [safeItem.nodeId ? 'nodo ' + safeItem.nodeId : null, safeItem.operationId ? 'operación ' + safeItem.operationId : null].filter(Boolean);
    return element('li', {className: 'trace-pending-entry'}, [
      element('code', {value: text(safeItem.code, 'PENDIENTE')}),
      details.length ? element('span', {value: details.join(' · ')}) : null,
    ]);
  });
  return stage({
    id: 'trace-pending',
    navigationLabel: 'Pendientes',
    label: '03 · PENDIENTE',
    title: 'Bloqueos o decisiones publicados',
    state: mission.status,
    body: 'Sólo se muestran códigos e identificadores publicados por el runtime; el diagnóstico interno permanece fuera de la traza.',
    meta: disclosure({
      id: 'trace-pending-codes',
      label: 'PENDIENTES',
      title: pending.length + ' código' + (pending.length === 1 ? '' : 's') + ' publicado' + (pending.length === 1 ? '' : 's'),
      state: mission.status,
      expanded: true,
      body: list(rows, 'trace-pending-list'),
    }),
  });
}

// The factory's public report deliberately reduces actor telemetry to a small,
// non-identifying status projection.  Keep that boundary intact here: actor
// labels, target, coverage and local record state are useful for an operator;
// thread IDs, prompts, inputs, outputs and diagnostics are not.
function planningBudgetTrace(report, {sourcedRoute = false} = {}) {
  // A bounded sourced answer is not a planned graph.  Showing an absent plan
  // budget here would make a deliberate route boundary look like stalled work.
  if (sourcedRoute) return null;
  if (!report) return null;
  const inspection = object(report.planningInspection);
  const budget = object(inspection.budget);
  if (!inspection.integrity && !budget.mode) return null;
  const entries = [];
  if (budget.mode) entries.push(element('li', {value: 'Modo: ' + text(budget.mode)}));
  if (Number.isSafeInteger(budget.maxCalls)) entries.push(element('li', {value: 'Máximo de reservas: ' + budget.maxCalls}));
  if (Number.isSafeInteger(budget.reserved)) entries.push(element('li', {value: 'Reservas registradas: ' + budget.reserved}));
  if (Number.isSafeInteger(budget.remaining)) entries.push(element('li', {value: 'Reservas restantes: ' + budget.remaining}));
  if (!entries.length) entries.push(element('li', {value: 'No hay contadores de planificación proyectados.'}));
  return stage({
    id: 'trace-planning-budget',
    navigationLabel: 'Presupuesto',
    label: '02 · PRESUPUESTO DE PLANIFICACIÓN',
    title: 'Límite operativo publicado',
    state: text(inspection.integrity, 'NO PROYECTADO'),
    body: 'Estas cifras son reservas prospectivas de planificación. No son llamadas confirmadas, tokens, facturación ni una medida de calidad.',
    meta: list(entries),
  });
}

function actorTrace(report, {sourcedRoute = false} = {}) {
  if (!report) return null;
  const telemetry = object(report.actorTelemetry);
  const coverage = object(telemetry.coverage);
  const actors = array(telemetry.actors);
  if (!telemetry.integrity && !actors.length) return null;
  if (sourcedRoute && !actors.length) return null;
  const coverageEntries = [];
  for (const [label, key] of [
    ['Actores publicados', 'actors'],
    ['Recibos completos registrados', 'completedRecorded'],
    ['Recibos pendientes', 'pendingRecords'],
    ['Sin verificación local', 'unverified'],
  ]) {
    if (Number.isSafeInteger(coverage[key])) coverageEntries.push(element('li', {value: label + ': ' + coverage[key]}));
  }
  const actorCards = actors.map((value, index) => {
    const actor = object(value);
    const target = object(actor.target);
    const execution = object(actor.execution);
    const details = [];
    if (actor.kind) details.push(element('span', {value: 'Función: ' + text(actor.kind)}));
    if (target.model || target.reasoningEffort) details.push(element('span', {value: 'Target: ' + text(target.model, 'modelo no proyectado') + ' · ' + text(target.reasoningEffort, 'razonamiento no proyectado')}));
    if (execution.origin) details.push(element('span', {value: 'Procedencia de ejecución: ' + text(execution.origin)}));
    return element('li', {}, [
      disclosure({
        id: 'trace-actor-' + (index + 1),
        label: 'ACTOR ' + (index + 1),
        title: text(actor.actor, 'Actor no identificado'),
        state: text(actor.state, 'NO PROYECTADO'),
        expanded: false,
        body: element('div', {className: 'trace-node-meta'}, [
          element('span', {value: 'Esta ficha es telemetría pública mínima. No contiene hilo, prompt, entrada, salida ni diagnóstico interno.'}),
          ...(details.length ? details : [element('span', {value: 'No hay detalle adicional publicado para este actor.'})]),
        ]),
      }),
    ]);
  });
  return stage({
    id: 'trace-actors',
    navigationLabel: 'Actores',
    label: '04 · ACTORES Y COBERTURA',
    title: actors.length ? actors.length + ' actor' + (actors.length === 1 ? '' : 'es') + ' publicado' + (actors.length === 1 ? '' : 's') : 'Sin actores publicables todavía',
    state: text(telemetry.integrity, 'NO PROYECTADO'),
    body: actors.length
      ? 'Cada ficha es una proyección pública mínima del runtime. PENDING_RECORD significa que aún no existe un recibo completo retenido; no se presenta como trabajo terminado.'
      : 'La fábrica aún no publicó actores con telemetría verificable. No se rellena esta sección a partir de una suposición sobre agentes internos.',
    meta: element('div', {className: 'trace-actor-content'}, [
      coverageEntries.length ? disclosure({
        id: 'trace-actor-coverage',
        label: 'COBERTURA',
        title: 'Cobertura publicada',
        state: text(telemetry.integrity, 'NO PROYECTADO'),
        expanded: true,
        body: list(coverageEntries),
      }) : null,
      actorCards.length ? list(actorCards, 'trace-actor-list') : null,
    ].filter(Boolean)),
    empty: !actors.length,
  });
}

function admissionTrace({mission, mapping}) {
  const admission = object(mapping?.admission);
  const hasMapping = Boolean(mapping?.missionId);
  const isPublicSourcedRoute = hasProjectPublicSourcedRoute(mapping, admission);
  const hasUnrecognizedRouteBinding = hasDeclaredRouteBinding(mapping, admission) && !isPublicSourcedRoute;
  const linkedAt = mapping?.at || null;
  const state = admission.state || (hasMapping ? 'VINCULADA' : 'NO PROYECTADA');
  const body = isPublicSourcedRoute
    ? 'Esta misión usa una ruta pública acotada. El runtime recibe únicamente el mandato original como texto público exacto; el contexto privado del proyecto no se lee, transporta ni muestrea.'
    : hasUnrecognizedRouteBinding
      ? 'La admisión declara una ruta que esta versión de la interfaz no puede verificar. Para no convertir metadatos en una filtración, no muestra contexto, adjuntos ni identificadores de admisión.'
    : hasMapping
      ? 'La misión está vinculada a este espacio aislado. La política y las referencias de archivo se congelan en la admisión; esta traza no copia contexto privado ni bytes de adjuntos.'
      : 'No existe una vinculación pública del espacio para esta misión.';
  const metadata = [];
  if (isPublicSourcedRoute) {
    // These are static, contract-level facts. They deliberately do not repeat
    // a route binding, admission ID, project ID, context hash, memory count,
    // asset name, or user text from the runtime projection.
    metadata.push(element('li', {value: 'Ruta: respuesta pública con fuentes (sourced-response-v1).'}));
    metadata.push(element('li', {value: 'Contexto privado: WITHHELD_NOT_SAMPLED.'}));
    metadata.push(element('li', {value: 'Adjuntos: FORBIDDEN.'}));
    metadata.push(element('li', {value: 'Mandato: sólo el texto público exacto enviado por la persona operadora.'}));
    metadata.push(element('li', {value: 'Si esta ruta no puede cerrarse: requiere una nueva admisión planificada explícita; no escala contexto privado en silencio.'}));
  } else if (!hasUnrecognizedRouteBinding) {
    if (admission.id) metadata.push(element('li', {value: 'Admisión: ' + admission.id}));
    if (admission.assetCount !== undefined) metadata.push(element('li', {value: 'Adjuntos sellados: ' + text(admission.assetCount, '0')}));
    if (admission.contextPackHash) metadata.push(element('li', {value: 'Contexto sellado: ' + String(admission.contextPackHash).slice(0, 16) + '…'}));
  }
  return stage({
    id: 'trace-admission',
    navigationLabel: 'Admisión',
    label: '00 · ADMISIÓN',
    title: isPublicSourcedRoute ? 'Entrada pública acotada' : hasUnrecognizedRouteBinding ? 'Ruta de admisión no verificable' : 'Entrada de la misión',
    state,
    at: linkedAt,
    body,
    meta: metadata.length ? list(metadata) : null,
  });
}

function hasOwn(value, key) {
  return Object.prototype.hasOwnProperty.call(object(value), key);
}

function sourcedRouteReceipt({mission, report, mapping}) {
  const admission = object(mapping?.admission);
  if (!hasProjectPublicSourcedRoute(mapping, admission)) {
    return {route: false, progress: null, malformed: false, source: null};
  }

  // Status is the current authority while a report may be a preceding
  // confirmed snapshot.  Both pass the same strict parser; a report is used
  // only when the live status has not published the receipt yet.
  const reportMission = object(report).mission;
  const statusHasReceipt = hasOwn(mission, 'sourcedRouteProgress');
  const reportHasReceipt = hasOwn(reportMission, 'sourcedRouteProgress');
  const statusProgress = statusHasReceipt ? publicSourcedRouteProgress(mission.sourcedRouteProgress) : null;
  const reportProgress = reportHasReceipt ? publicSourcedRouteProgress(reportMission.sourcedRouteProgress) : null;
  if (statusProgress) return {route: true, progress: statusProgress, malformed: false, source: 'status'};
  if (reportProgress) return {route: true, progress: reportProgress, malformed: false, source: 'report'};
  return {route: true, progress: null, malformed: statusHasReceipt || reportHasReceipt, source: null};
}

function sourcedPhaseExplanation(phase, integrity) {
  if (integrity !== 'VERIFIED' || phase === 'UNVERIFIED') {
    return 'La fábrica no confirmó esta ficha de la ruta. La consola no infiere adquisiciones, revisión, anclas ni disponibilidad de entrega a partir de datos parciales.';
  }
  switch (phase) {
    case 'ADMITTED':
      return 'La pregunta pública fue admitida en la ruta acotada. Aún no se declara adquisición, candidato ni revisión como hechos realizados.';
    case 'ACQUIRING':
      return 'La ruta está adquiriendo evidencia pública dentro de límites fijos. Los contadores registran sólo operaciones confirmadas; no representan razonamiento, texto de búsqueda ni contenido de fuentes.';
    case 'CANDIDATE_PENDING_REVIEW':
      return 'Existe un candidato en revisión independiente. La consola no lo presenta como respuesta aceptada hasta que el recibo de revisión lo confirme.';
    case 'ACCEPTED':
      return 'La ruta confirmó el cierre de candidato y revisión independientes. La disponibilidad de entrega sigue siendo un hecho separado y se muestra abajo.';
    case 'ESCALATED':
      return 'Esta ruta acotada no continuará acumulando búsquedas ni usará memoria, adjuntos o contexto privado del proyecto. Para ampliar el encargo hace falta una nueva admisión planificada explícita.';
    default:
      return 'La fábrica publicó una fase de ruta reconocida, sin detalle interno adicional.';
  }
}

function sourcedRouteTrace(receipt) {
  if (!receipt.route) return null;
  if (!receipt.progress) {
    return stage({
      id: 'trace-sourced-route',
      navigationLabel: 'Ruta con fuentes',
      label: '02 · RUTA CON FUENTES',
      title: receipt.malformed ? 'Proyección de ruta no verificable' : 'Ficha operativa aún no publicada',
      state: receipt.malformed ? 'UNVERIFIED' : 'NO PROYECTADO',
      body: receipt.malformed
        ? 'La consola recibió una ficha de ruta que no cumple el contrato público exacto. No muestra sus campos ni deduce actividad, evidencia o entrega.'
        : 'Esta misión tiene una entrada pública acotada. El runtime todavía no publicó su ficha operativa verificable; la consola no rellena progreso por apariencia de actividad.',
      empty: true,
    });
  }

  const progress = receipt.progress;
  const acquisition = progress.acquisition;
  const review = progress.independentReview;
  const delivery = progress.delivery;
  const state = progress.integrity === 'VERIFIED' ? progress.phase : 'UNVERIFIED';
  const metadata = [
    element('li', {value: 'Fase publicada: ' + progress.phase}),
    element('li', {value: 'Búsqueda acotada: ' + acquisition.search.used + ' / ' + acquisition.search.limit}),
    ...(acquisition.discovery === SEALED_DISCOVERY_DISABLED
      ? [element('li', {value: 'Descubrimiento público: desactivado · paquete de fuentes sellado'})]
      : []),
    element('li', {value: 'Obtenciones completas: ' + acquisition.fetch.used + ' / ' + acquisition.fetch.limit}),
    element('li', {value: 'Límite por fuente: ' + new Intl.NumberFormat('es-ES').format(acquisition.maxSourceBytes) + ' bytes'}),
    element('li', {value: 'Anclas de fuentes verificadas: ' + progress.verifiedSourceAnchorCount}),
    element('li', {value: 'Revisión independiente requerida: sí · ' + review.state}),
    element('li', {value: 'Entrega final: ' + delivery.availability}),
  ];
  const routeSteps = [
    element('li', {className: 'trace-history-entry'}, [
      statusPill(progress.phase),
      element('span', {value: 'Adquisición: ' + acquisition.search.used + ' / ' + acquisition.search.limit + ' búsquedas · ' + acquisition.fetch.used + ' / ' + acquisition.fetch.limit + ' obtenciones confirmadas.'}),
    ]),
    element('li', {className: 'trace-history-entry'}, [
      statusPill(review.state),
      element('span', {value: 'Revisión independiente: requerida · estado publicado ' + review.state + '.'}),
    ]),
    element('li', {className: 'trace-history-entry'}, [
      statusPill(delivery.availability),
      element('span', {value: 'Entrega: disponibilidad publicada ' + delivery.availability + '.'}),
    ]),
  ];
  return stage({
    id: 'trace-sourced-route',
    navigationLabel: 'Ruta con fuentes',
    label: '02 · RUTA CON FUENTES',
    title: 'Ejecución pública acotada',
    state,
    body: sourcedPhaseExplanation(progress.phase, progress.integrity),
    meta: element('div', {}, [
      disclosure({
        id: 'trace-sourced-route-steps',
        label: 'RECORRIDO',
        title: 'Adquisición, revisión y entrega',
        state,
        expanded: true,
        body: element('div', {}, [
          element('p', {value: 'Estos tres puntos son el recorrido publicado de esta ruta. Sus estados son recibos operativos; no son una reconstrucción de pensamiento ni del contenido de fuentes.'}),
          list(routeSteps, 'trace-history'),
        ]),
      }),
      disclosure({
        id: 'trace-sourced-route-limits',
        label: 'LÍMITES',
        title: 'Límites y anclas publicados',
        state,
        expanded: false,
        body: list(metadata, 'trace-list trace-source-route-list'),
      }),
    ]),
  });
}

/**
 * Build a public-only operational trace for the selected mission.
 *
 * `detail` is intentionally the console response, not a raw Factory store.
 * The calling app provides all inputs already confined to the selected
 * project; this function has no networking, mutation, timers or storage.
 */
export function renderOperationalTrace({detail, data, mission, plan, nodes, report, mapping} = {}) {
  const safeData = object(data);
  const safeMission = object(mission);
  const safePlan = object(plan);
  const safeReport = report && typeof report === 'object' ? report : null;
  const sourcedReceipt = sourcedRouteReceipt({mission: safeMission, report: safeReport, mapping: object(mapping)});
  const stages = [
    admissionTrace({mission: safeMission, mapping: object(mapping)}),
    lifecycleTrace(safeMission),
    signedExecutionTrace(safeReport, {missionId: object(mapping).missionId ?? null}),
    sourcedRouteTrace(sourcedReceipt),
    planningBudgetTrace(safeReport, {sourcedRoute: sourcedReceipt.route}),
    pendingTrace(safeMission),
    actorTrace(safeReport, {sourcedRoute: sourcedReceipt.route}),
    nodeTrace(nodes, {topologyIntegrity: safeData.topologyIntegrity || safeReport?.topologyIntegrity || null, sourcedRoute: sourcedReceipt.route}),
    evidenceTrace(safeReport),
  ].filter(Boolean);
  const root = element('section', {className: 'mission-trace', attrs: {'aria-label': 'Traza operativa pública'}});
  root.append(element('div', {className: 'trace-intro'}, [
    element('div', {}, [
      element('p', {className: 'eyebrow', value: 'TRAZA OPERATIVA PÚBLICA'}),
      element('h3', {value: 'Qué está confirmado ahora'}),
    ]),
    element('p', {value: 'Muestra estados, topología y recibos ya proyectados por la fábrica. Usa los enlaces y desplegables para recorrer cada límite confirmado. No muestra cadena de pensamiento, prompts privados, mensajes internos ni actividad que no tenga un recibo público.'}),
  ]));
  const navigation = traceNavigation(stages);
  if (navigation) root.append(navigation);
  const timeline = element('ol', {className: 'trace-timeline'});
  for (const traceStage of stages) timeline.append(traceStage);
  root.append(timeline);

  const finalNode = sourcedReceipt.route
    ? 'La ruta pública acotada no publica un nodo final ni una topología de handoffs.'
    : safePlan.finalNodeId ? 'Nodo final declarado: ' + safePlan.finalNodeId + '.' : 'El plan no proyectó aún un nodo final.';
  root.append(element('p', {className: 'trace-boundary-note', value: finalNode + ' La cronología completa se actualiza al consultar el estado confirmado; no se simula progreso entre lecturas.'}));
  return root;
}
