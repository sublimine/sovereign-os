// A deliberately small visual projection for Sublimine's control room.
// It is not a second runtime and never accepts writes.  Every label comes
// from the already-public project/mission projection that the console has
// verified for this browser session.

import {publicSourcedRouteProgress} from './mission-trace.js';

const terminal = new Set(['COMPLETED', 'CANCELLED', 'FAILED', 'REJECTED']);
// These are distinct finite public state machines: mission lifecycle, queue,
// runtime supervisor and the local delivery reconciler.  They deliberately
// share a renderer but never accept an arbitrary status string from a report.
const publicStates = new Set([
  'NEW', 'PENDING', 'QUEUED', 'PLANNING', 'RUNNING', 'PAUSED', 'WAITING',
  'WAITING_PROVIDER', 'WAITING_CAPABILITY', 'WAITING_QUOTA', 'RETRY_WAIT',
  'NEEDS_DIRECTION', 'COMPLETED', 'CANCELLED', 'FAILED', 'REJECTED',
  'ACTIVE', 'INITIALIZED', 'START_REQUESTED', 'IDLE', 'SCHEDULED', 'CHECKING',
  'ADMITTED', 'ACQUIRING', 'CANDIDATE_PENDING_REVIEW', 'ESCALATED',
  'NOT_STARTED', 'RETURNED', 'ACCEPTED', 'AVAILABLE', 'NOT_AVAILABLE',
  'VERIFIED',
  'UNVERIFIED', 'UNOBSERVED',
]);

function record(value) { return value && typeof value === 'object' && !Array.isArray(value) ? value : {}; }
function list(value) { return Array.isArray(value) ? value : []; }
function state(value, fallback = 'UNOBSERVED') {
  const candidate = String(value ?? '').toUpperCase();
  return publicStates.has(candidate) ? candidate : fallback;
}
function shortId(value) { return String(value ?? '').replace(/^mission:/, '').slice(0, 8) || '—'; }
function text(value, fallback = '—') { return typeof value === 'string' && value.trim() ? value.trim() : fallback; }
function cleanTitle(value) {
  const candidate = text(value, 'Misión sin título').replace(/\s+/g, ' ');
  return candidate.length > 94 ? candidate.slice(0, 91) + '…' : candidate;
}
function missionPresentation(mapping, id) {
  const safe = record(mapping);
  const direct = typeof safe.originalIntent === 'string' && safe.originalIntent.trim()
    ? safe.originalIntent
    : typeof safe.intent === 'string' && safe.intent.trim()
      ? safe.intent
      : typeof safe.label === 'string' && safe.label.trim()
        ? safe.label
        : null;
  if (direct) return {title: cleanTitle(direct), route: 'ADMITTED'};
  const route = record(safe.routeBinding);
  if (safe.entryMode === 'sourced-response-v1' || route.factoryEntryMode === 'sourced-response-v1') {
    // This path intentionally withholds the original user prompt from the
    // project mapping. Name the route from its sealed public contract rather
    // than replacing that boundary with a misleading empty title.
    return {title: 'Respuesta pública con fuentes', route: 'SOURCED_PUBLIC'};
  }
  return {title: id ? 'Misión sellada sin título público' : 'Misión no verificable', route: 'SEALED'};
}
function declarationNodes(selectedMission) {
  const detail = record(selectedMission);
  const data = record(detail.status?.data);
  const nodes = list(data.nodes);
  return nodes.slice(0, 14).map((node, index) => {
    const safe = record(node);
    const id = text(safe.id ?? safe.nodeId, 'nodo-' + (index + 1));
    const dependencies = list(safe.dependsOn ?? safe.dependencies ?? safe.inputs)
      .filter(value => typeof value === 'string' && value.length <= 160)
      .slice(0, 8);
    return {
      id,
      title: cleanTitle(safe.title ?? safe.name ?? id),
      state: state(safe.status),
      roles: list(safe.roles).filter(value => typeof value === 'string').map(value => value.slice(0, 80)).slice(0, 4),
      dependencies,
    };
  });
}

// Pure and browser-independent so we can test that the visual layer cannot
// accidentally serialise an internal prompt or arbitrary report field.
export function publicOperationsProjection(input = {}) {
  const project = record(input.project);
  const runtime = record(input.runtime);
  const mappings = list(input.mappings);
  const deliveries = list(input.deliverables);
  const deliveryMissionIds = new Set(deliveries.map(delivery => record(delivery).missionId).filter(value => typeof value === 'string'));
  const queueByMission = new Map(list(runtime.queue).map(job => [record(job).missionId, record(job)]));
  const selectedData = record(record(input.selectedMission).status?.data);
  const selected = record(selectedData.mission);
  const sourcedProgress = publicSourcedRouteProgress(selected.sourcedRouteProgress);
  const missions = mappings.slice(0, 12).map((mapping, index) => {
    const safe = record(mapping);
    const id = typeof safe.missionId === 'string' ? safe.missionId : null;
    const queue = id ? queueByMission.get(id) : null;
    const lifecycle = state(queue?.lifecycle?.status ?? queue?.status ?? (id === selected.id ? selected.status : null));
    const presentation = missionPresentation(safe, id);
    return {
      id,
      position: index,
      label: id ? 'Misión ' + shortId(id) : 'Misión no verificable',
      title: presentation.title,
      route: presentation.route,
      lifecycle,
      terminal: terminal.has(lifecycle),
      delivery: Boolean(id && deliveryMissionIds.has(id)),
      selected: Boolean(id && id === selected.id),
    };
  }).filter(mission => mission.id);
  const reconciliation = record(input.deliveryReconciliation);
  return {
    schema: 'sublimine.operations-room-projection.v1',
    project: {
      id: typeof project.id === 'string' ? project.id : null,
      name: cleanTitle(project.name ?? 'Espacio sin nombre'),
      runtime: state(runtime.state, 'UNOBSERVED'),
    },
    reconciliation: {
      mode: text(reconciliation.mode, 'NO_PROYECTADO'),
      scope: text(reconciliation.scope, 'NO_PROYECTADO'),
      state: state(reconciliation.state, 'UNOBSERVED'),
      nextCheckAt: typeof reconciliation.nextCheckAt === 'string' ? reconciliation.nextCheckAt : null,
    },
    totals: {
      missions: mappings.length,
      queued: list(runtime.queue).length,
      deliveries: deliveries.length,
    },
    missions,
    selected: selected.id ? {
      id: selected.id,
      lifecycle: state(selected.status),
      nodes: declarationNodes(input.selectedMission),
      ...(sourcedProgress ? {
        sourcedRoute: {
          phase: sourcedProgress.phase,
          integrity: sourcedProgress.integrity,
          fetch: {...sourcedProgress.acquisition.fetch},
          anchors: sourcedProgress.verifiedSourceAnchorCount,
          review: sourcedProgress.independentReview.state,
          delivery: sourcedProgress.delivery.availability,
        },
      } : {}),
    } : null,
  };
}

function element(tag, {className = '', textContent = null, attrs = {}, dataset = {}} = {}, children = []) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (textContent !== null) node.textContent = textContent;
  for (const [name, value] of Object.entries(attrs)) {
    if (value !== undefined && value !== null) node.setAttribute(name, String(value));
  }
  for (const [name, value] of Object.entries(dataset)) {
    if (value !== undefined && value !== null) node.dataset[name] = String(value);
  }
  node.append(...children.filter(Boolean));
  return node;
}

function statePill(value) {
  return element('span', {className: 'operations-state operations-state-' + state(value).toLowerCase(), textContent: state(value)});
}

function formatTime(value) {
  if (!value) return 'sin próximo control programado';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'hora no verificable';
  return new Intl.DateTimeFormat('es-ES', {hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short'}).format(date);
}

function flowSvg(missions) {
  const width = Math.max(640, missions.length * 118 + 120);
  const height = 188;
  const namespace = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(namespace, 'svg');
  svg.setAttribute('viewBox', '0 0 ' + width + ' ' + height);
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', 'Flujo de misiones confirmado por el runtime');
  svg.classList.add('operations-flow-svg');
  const title = document.createElementNS(namespace, 'title');
  title.textContent = 'Flujo de misiones del espacio';
  svg.append(title);
  const startX = 58;
  const y = 92;
  const gap = missions.length > 1 ? (width - 116) / Math.max(1, missions.length - 1) : 0;
  missions.forEach((mission, index) => {
    const x = startX + (gap * index);
    if (index) {
      const line = document.createElementNS(namespace, 'line');
      line.setAttribute('x1', String(startX + (gap * (index - 1)) + 25));
      line.setAttribute('y1', String(y));
      line.setAttribute('x2', String(x - 25));
      line.setAttribute('y2', String(y));
      line.classList.add('operations-flow-edge');
      svg.append(line);
    }
    const group = document.createElementNS(namespace, 'g');
    group.classList.add('operations-flow-node', 'operations-flow-' + mission.lifecycle.toLowerCase());
    const circle = document.createElementNS(namespace, 'circle');
    circle.setAttribute('cx', String(x));
    circle.setAttribute('cy', String(y));
    circle.setAttribute('r', mission.selected ? '22' : '18');
    group.append(circle);
    const label = document.createElementNS(namespace, 'text');
    label.setAttribute('x', String(x));
    label.setAttribute('y', String(y + 4));
    label.setAttribute('text-anchor', 'middle');
    label.textContent = String(index + 1);
    group.append(label);
    const caption = document.createElementNS(namespace, 'text');
    caption.setAttribute('x', String(x));
    caption.setAttribute('y', String(y + 47));
    caption.setAttribute('text-anchor', 'middle');
    caption.classList.add('operations-flow-caption');
    caption.textContent = shortId(mission.id);
    group.append(caption);
    svg.append(group);
  });
  return svg;
}

function selectedTopology(selected) {
  if (selected?.sourcedRoute) {
    const route = selected.sourcedRoute;
    const checkpoints = [
      {title: 'Ruta pública admitida', detail: 'Fase confirmada: ' + route.phase, state: route.phase},
      {title: 'Fuentes verificadas', detail: route.anchors + ' ancla(s) · ' + route.fetch.used + '/' + route.fetch.limit + ' lecturas selladas', state: route.integrity},
      {title: 'Revisión independiente', detail: route.review === 'ACCEPTED' ? 'Aceptada por revisión independiente' : 'Estado publicado: ' + route.review, state: route.review},
      {title: 'Entrega final', detail: route.delivery === 'AVAILABLE' ? 'Producto sellado disponible' : 'Estado publicado: ' + route.delivery, state: route.delivery},
    ];
    const nodes = element('ol', {className: 'operations-node-list'});
    for (const checkpoint of checkpoints) {
      nodes.append(element('li', {className: 'operations-node-row'}, [
        element('div', {className: 'operations-node-dot operations-node-' + state(checkpoint.state).toLowerCase()}),
        element('div', {className: 'operations-node-copy'}, [
          element('strong', {textContent: checkpoint.title}),
          element('span', {textContent: checkpoint.detail}),
        ]),
        statePill(checkpoint.state),
      ]));
    }
    return nodes;
  }
  if (!selected?.nodes?.length) {
    return element('div', {className: 'operations-empty', textContent: 'Selecciona una misión para ver la topología publicada. Sin misión seleccionada no se infiere una cadena de agentes.'});
  }
  const nodes = element('ol', {className: 'operations-node-list'});
  for (const node of selected.nodes) {
    const dependencies = node.dependencies.length ? 'Depende de: ' + node.dependencies.join(', ') : 'Sin dependencias publicadas';
    nodes.append(element('li', {className: 'operations-node-row'}, [
      element('div', {className: 'operations-node-dot operations-node-' + node.state.toLowerCase()}),
      element('div', {className: 'operations-node-copy'}, [
        element('strong', {textContent: node.title}),
        element('span', {textContent: dependencies}),
        node.roles.length ? element('span', {className: 'operations-node-roles', textContent: 'Roles: ' + node.roles.join(' · ')}) : null,
      ]),
      statePill(node.state),
    ]));
  }
  return nodes;
}

export function renderOperationsRoom(input = {}) {
  const projection = publicOperationsProjection(input);
  const root = element('div', {className: 'operations-grid'});
  root.append(
    element('section', {className: 'surface operations-summary'}, [
      element('div', {className: 'surface-header'}, [
        element('div', {}, [element('p', {className: 'eyebrow', textContent: 'PULSO DEL ESPACIO'}), element('h2', {textContent: projection.project.name})]),
        statePill(projection.project.runtime),
      ]),
      element('div', {className: 'operations-metrics'}, [
        element('div', {}, [element('span', {textContent: 'MISIONES'}), element('strong', {textContent: String(projection.totals.missions)})]),
        element('div', {}, [element('span', {textContent: 'EN COLA'}), element('strong', {textContent: String(projection.totals.queued)})]),
        element('div', {}, [element('span', {textContent: 'ENTREGAS'}), element('strong', {textContent: String(projection.totals.deliveries)})]),
      ]),
      element('p', {className: 'operations-disclosure', textContent: 'Estos contadores son proyecciones del espacio activo; no representan tokens, coste ni trabajo no confirmado.'}),
    ]),
    element('section', {className: 'surface operations-reconciliation'}, [
      element('div', {className: 'surface-header'}, [
        element('div', {}, [element('p', {className: 'eyebrow', textContent: 'ENTREGA AL CHAT'}), element('h2', {textContent: 'Conciliación verificable'})]),
        statePill(projection.reconciliation.state),
      ]),
      element('p', {className: 'operations-reconciliation-copy', textContent: projection.reconciliation.mode === 'SERVER_V2_OPT_IN'
        ? 'El servidor puede devolver una entrega aceptada a un hilo nuevo vinculado, incluso si cambias de pestaña. Los vínculos históricos siguen requiriendo su acción explícita.'
        : 'La conciliación automática no está proyectada para este espacio.'}),
      element('div', {className: 'operations-reconciliation-meta'}, [
        element('span', {textContent: 'Ámbito: ' + projection.reconciliation.scope.replaceAll('_', ' ').toLocaleLowerCase('es-ES')}),
        element('span', {textContent: 'Próxima comprobación: ' + formatTime(projection.reconciliation.nextCheckAt)}),
      ]),
    ]),
    element('section', {className: 'surface operations-flow'}, [
      element('div', {className: 'surface-header'}, [
        element('div', {}, [element('p', {className: 'eyebrow', textContent: 'RECORRIDO DEL ESPACIO'}), element('h2', {textContent: 'Misiones confirmadas'})]),
        element('span', {className: 'privacy-chip', textContent: 'datos públicos'})]),
      projection.missions.length
        ? element('div', {className: 'operations-flow-viewport'}, [flowSvg(projection.missions)])
        : element('div', {className: 'operations-empty', textContent: 'Todavía no hay misiones selladas en este espacio.'}),
      element('div', {className: 'operations-mission-list'}, projection.missions.map(mission => element('button', {
        className: 'operations-mission' + (mission.selected ? ' is-selected' : ''),
        attrs: {type: 'button', title: 'Abrir esta misión en el inspector'},
        dataset: {operationMissionId: mission.id},
      }, [
        element('span', {className: 'operations-mission-id', textContent: mission.label}),
        element('strong', {textContent: mission.title}),
        element('span', {className: 'operations-mission-meta', textContent: (mission.route === 'SOURCED_PUBLIC' ? 'Ruta pública con fuentes · ' : '') + (mission.delivery ? 'entrega sellada disponible' : 'sin entrega sellada todavía')}),
        statePill(mission.lifecycle),
        element('span', {className: 'operations-mission-open', textContent: 'Seleccionar trazabilidad →'}),
      ]))),
    ]),
    element('section', {className: 'surface operations-topology'}, [
      element('div', {className: 'surface-header'}, [
        element('div', {}, [element('p', {className: 'eyebrow', textContent: 'TOPOLOGÍA DE LA MISIÓN'}), element('h2', {textContent: projection.selected?.sourcedRoute ? 'Hitos públicos confirmados' : projection.selected ? 'Nodos y handoffs publicados' : 'Sin misión seleccionada'})]),
        projection.selected ? statePill(projection.selected.lifecycle) : null,
      ]),
      selectedTopology(projection.selected),
    ]),
  );
  return root;
}
