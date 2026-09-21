// Sublimine's read-only office / constellation projection.
//
// This is intentionally not a simulation of work.  It receives the output of
// `publicOperationsProjection()` only, and it renders a desk cell solely when
// a selected public node contains a verified, display-safe role receipt.  It
// does not fetch, schedule, animate, infer an agent, or inspect a mission's
// title, prompt, sources, artifacts, diagnostics, or private trace.

const OPERATIONS_SCHEMA = 'sublimine.operations-room-projection.v1';
const OBSERVATORY_SCHEMA = 'sublimine.office-observatory-projection.v1';
const MAX_PUBLISHED_MISSIONS = 12;
const MAX_PUBLISHED_NODES = 14;
const MAX_ROLES_PER_NODE = 4;
const MAX_DESKS = MAX_PUBLISHED_NODES * MAX_ROLES_PER_NODE;

// This mirrors the finite public state vocabulary of Operations Room.  A
// state not already accepted there is not rendered here as a plausible desk.
const publicStates = new Set([
  'NEW', 'PENDING', 'QUEUED', 'PLANNING', 'RUNNING', 'PAUSED', 'WAITING',
  'WAITING_PROVIDER', 'WAITING_CAPABILITY', 'WAITING_QUOTA', 'RETRY_WAIT',
  'NEEDS_DIRECTION', 'COMPLETED', 'CANCELLED', 'FAILED', 'REJECTED',
  'ACTIVE', 'INITIALIZED', 'START_REQUESTED', 'IDLE', 'SCHEDULED', 'CHECKING',
  'ADMITTED', 'ACQUIRING', 'CANDIDATE_PENDING_REVIEW', 'ESCALATED',
  'NOT_STARTED', 'RETURNED', 'ACCEPTED', 'AVAILABLE', 'NOT_AVAILABLE',
  'VERIFIED', 'UNVERIFIED', 'UNOBSERVED',
]);
const terminalMissionStates = new Set(['COMPLETED', 'CANCELLED', 'FAILED', 'REJECTED']);
const identifierPattern = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,179}$/;
// A role label is a bounded human-facing name, not an arbitrary report field.
// URLs, paths and colon-separated payloads are intentionally not labels here.
const rolePattern = /^[\p{L}\p{N}][\p{L}\p{N} ._'’-]{0,79}$/u;

const object = value => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
const array = value => Array.isArray(value) ? value : [];
const upper = value => String(value ?? '').toUpperCase();

function freeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) freeze(child);
  return Object.freeze(value);
}

function exactState(value, allowed) {
  const candidate = upper(value);
  return allowed.has(candidate) ? candidate : null;
}

function publicIdentifier(value) {
  return typeof value === 'string' && identifierPattern.test(value) ? value : null;
}

function publicName(value) {
  if (typeof value !== 'string') return null;
  const compact = value.replace(/[\r\n\t]+/g, ' ').trim();
  if (!compact || compact.length > 96 || /(?:https?:\/\/|www\.)/iu.test(compact)) return null;
  return compact;
}

function publicRole(value) {
  if (typeof value !== 'string') return null;
  const compact = value.normalize('NFC').replace(/[\r\n\t]+/g, ' ').trim();
  return rolePattern.test(compact) ? compact : null;
}

function emptyProjection({integrity = 'UNVERIFIED', projectName = 'Espacio no verificable', runtime = 'UNOBSERVED', detail} = {}) {
  return freeze({
    schema: OBSERVATORY_SCHEMA,
    integrity,
    project: {name: projectName, runtime},
    missionSummary: {published: 0, active: 0, terminal: 0},
    selectedMission: null,
    desks: [],
    receipt: {
      state: 'NO_PUBLIC_ROLE_RECEIPT',
      detail: detail ?? 'La proyección pública no superó la validación; no se muestran mesas.',
    },
  });
}

function parseProject(value) {
  const project = object(value);
  const id = publicIdentifier(project.id);
  const name = publicName(project.name);
  const runtime = exactState(project.runtime, publicStates);
  if (!id || !name || !runtime) return null;
  return {name, runtime};
}

function parseMissions(value) {
  if (!Array.isArray(value) || value.length > MAX_PUBLISHED_MISSIONS) return null;
  const missions = [];
  const ids = new Set();
  let selectedCount = 0;
  for (const candidate of value) {
    const mission = object(candidate);
    const id = publicIdentifier(mission.id);
    const lifecycle = exactState(mission.lifecycle, publicStates);
    if (!id || !lifecycle || typeof mission.selected !== 'boolean' || ids.has(id)) return null;
    ids.add(id);
    if (mission.selected) selectedCount += 1;
    if (selectedCount > 1) return null;
    missions.push({id, lifecycle, selected: mission.selected});
  }
  return missions;
}

function parseSelectedNodes(value) {
  if (!Array.isArray(value) || value.length > MAX_PUBLISHED_NODES) return null;
  const nodes = [];
  const ids = new Set();
  for (const candidate of value) {
    const node = object(candidate);
    const id = publicIdentifier(node.id);
    const state = exactState(node.state, publicStates);
    if (!id || !state || !Array.isArray(node.roles) || node.roles.length > MAX_ROLES_PER_NODE || ids.has(id)) return null;
    ids.add(id);
    const roles = [];
    const seenRoles = new Set();
    for (const value of node.roles) {
      const role = publicRole(value);
      if (!role || seenRoles.has(role)) return null;
      seenRoles.add(role);
      roles.push(role);
    }
    // Titles, dependencies and any extra data deliberately never cross this
    // boundary.  A node's role receipt is enough to occupy a desk cell.
    nodes.push({state, roles});
  }
  return nodes;
}

function parseSelectedMission(value, missions) {
  if (value === undefined || value === null) {
    return {kind: 'ABSENT', selected: null};
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const selected = object(value);
  const id = publicIdentifier(selected.id);
  const lifecycle = exactState(selected.lifecycle, publicStates);
  const nodes = parseSelectedNodes(selected.nodes);
  if (!id || !lifecycle || !nodes) return null;

  const declared = missions.filter(mission => mission.selected);
  if (declared.length && declared[0].id !== id) return null;
  const missionOrdinal = missions.findIndex(mission => mission.id === id);
  return {
    kind: 'PRESENT',
    selected: {
      lifecycle,
      ordinal: missionOrdinal === -1 ? null : missionOrdinal + 1,
      nodes,
    },
  };
}

function deskProjection(nodes) {
  const desks = [];
  for (const [nodeIndex, node] of nodes.entries()) {
    for (const role of node.roles) {
      if (desks.length >= MAX_DESKS) return null;
      desks.push({
        desk: desks.length + 1,
        role,
        node: nodeIndex + 1,
        nodeState: node.state,
      });
    }
  }
  return desks;
}

/**
 * Convert an already-public Operations Room projection into the much smaller
 * observatory document.  The function never accepts raw Factory detail; a
 * mismatched or malformed projection falls closed to an empty office.
 */
export function publicOfficeObservatoryProjection(value = {}) {
  const input = object(value);
  if (input.schema !== OPERATIONS_SCHEMA) return emptyProjection();

  const project = parseProject(input.project);
  const missions = parseMissions(input.missions);
  if (!project || !missions) return emptyProjection();

  const selectedResult = parseSelectedMission(input.selected, missions);
  if (!selectedResult) return emptyProjection({
    projectName: project.name,
    runtime: project.runtime,
  });

  const missionSummary = {
    published: missions.length,
    active: missions.filter(mission => !terminalMissionStates.has(mission.lifecycle)).length,
    terminal: missions.filter(mission => terminalMissionStates.has(mission.lifecycle)).length,
  };
  if (selectedResult.kind === 'ABSENT') {
    return freeze({
      schema: OBSERVATORY_SCHEMA,
      integrity: 'ABSENT',
      project,
      missionSummary,
      selectedMission: null,
      desks: [],
      receipt: {
        state: 'NO_PUBLIC_ROLE_RECEIPT',
        detail: 'No hay una misión pública seleccionada.',
      },
    });
  }

  const selected = selectedResult.selected;
  const desks = deskProjection(selected.nodes);
  if (!desks) return emptyProjection({
    projectName: project.name,
    runtime: project.runtime,
  });
  const selectedMission = {
    lifecycle: selected.lifecycle,
    ordinal: selected.ordinal,
    publishedNodes: selected.nodes.length,
  };
  const receipt = desks.length
    ? {
      state: 'PUBLIC_ROLE_RECEIPTS_AVAILABLE',
      detail: 'Cada mesa corresponde a un rol declarado por un nodo público; no infiere agentes ni trabajo adicional.',
    }
    : {
      state: 'NO_PUBLIC_ROLE_RECEIPT',
      detail: selected.nodes.length
        ? 'Hay nodos publicados, pero ninguno declaró un rol público para una mesa.'
        : 'La misión seleccionada no publicó nodos con roles para una mesa.',
    };
  return freeze({
    schema: OBSERVATORY_SCHEMA,
    integrity: 'VERIFIED',
    project,
    missionSummary,
    selectedMission,
    desks,
    receipt,
  });
}

function element(tag, {className = '', textContent = null, attrs = {}} = {}, children = []) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (textContent !== null) node.textContent = textContent;
  for (const [name, value] of Object.entries(attrs)) {
    if (value !== undefined && value !== null) node.setAttribute(name, String(value));
  }
  node.append(...children.filter(Boolean));
  return node;
}

function metric(label, value) {
  return element('div', {className: 'office-observatory-metric'}, [
    element('span', {className: 'office-observatory-metric-label', textContent: label}),
    element('strong', {className: 'office-observatory-metric-value', textContent: String(value)}),
  ]);
}

function deskCell(desk) {
  return element('li', {className: 'office-observatory-desk'}, [
    element('span', {className: 'office-observatory-desk-index', textContent: 'MESA ' + String(desk.desk).padStart(2, '0')}),
    element('strong', {className: 'office-observatory-role', textContent: desk.role}),
    element('span', {className: 'office-observatory-node', textContent: 'Nodo ' + desk.node + ' · ' + desk.nodeState}),
    element('span', {className: 'office-observatory-receipt', textContent: 'rol publicado'}),
  ]);
}

/**
 * Render a semantic, CSS-ownable office constellation.  It has no event
 * handlers or mutable behavior: callers refresh it only when their already
 * public Operations Room input changes.
 */
export function renderOfficeObservatory(operationsProjection = {}) {
  const projection = publicOfficeObservatoryProjection(operationsProjection);
  const root = element('section', {
    className: 'office-observatory',
    attrs: {
      'aria-label': 'Observatorio de roles publicados',
      'data-office-integrity': projection.integrity,
    },
  });
  const missionCopy = projection.selectedMission
    ? 'Misión seleccionada · ' + projection.selectedMission.lifecycle + ' · ' + projection.selectedMission.publishedNodes + ' nodo(s) publicados'
    : 'Sin misión pública seleccionada';
  root.append(
    element('header', {className: 'office-observatory-header'}, [
      element('div', {}, [
        element('p', {className: 'eyebrow', textContent: 'OBSERVATORIO DE SUBLIMINE'}),
        element('h2', {textContent: projection.project.name}),
        element('p', {className: 'office-observatory-subtitle', textContent: missionCopy}),
      ]),
      element('span', {className: 'office-observatory-integrity', textContent: projection.integrity}),
    ]),
    element('div', {className: 'office-observatory-metrics', attrs: {'aria-label': 'Resumen público de misiones'}}, [
      metric('MISIONES PUBLICADAS', projection.missionSummary.published),
      metric('ACTIVAS', projection.missionSummary.active),
      metric('TERMINALES', projection.missionSummary.terminal),
      metric('MESAS CON RECIBO', projection.desks.length),
    ]),
    element('section', {className: 'office-observatory-floor', attrs: {'aria-label': 'Constelación de roles declarados'}}, [
      element('div', {className: 'office-observatory-floor-heading'}, [
        element('div', {}, [
          element('p', {className: 'eyebrow', textContent: 'CONSTELACIÓN DECLARADA'}),
          element('h3', {textContent: projection.desks.length ? 'Mesas con recibo público' : 'Sin mesas inferidas'}),
        ]),
        element('span', {className: 'office-observatory-receipt-state', textContent: projection.receipt.state}),
      ]),
      projection.desks.length
        ? element('ol', {className: 'office-observatory-desk-grid'}, projection.desks.map(deskCell))
        : element('p', {className: 'office-observatory-empty', textContent: projection.receipt.detail}),
    ]),
    element('p', {
      className: 'office-observatory-disclosure',
      textContent: 'Vista de recibos públicos: no muestra prompts, cadena de pensamiento, fuentes, URLs, cuerpos de artefactos ni actividad simulada.',
    }),
  );
  return root;
}
