import {isProjectPublicSourcedRouteBinding, publicSourcedRouteProgress, renderOperationalTrace} from './mission-trace.js';
import {missionControlRoom, missionControlRoomSelectedTab, missionTechnicalProjection} from './mission-control-room.js';
import {publicOperationsProjection, renderOperationsRoom} from './operations-room.js';
import {renderOfficeObservatory} from './office-observatory.js';
import {createLocalUiSessionRecovery} from './local-ui-session.js';
import {missionSelectionAfterProjectReload} from './project-refresh-selection.js';
import {missionIntentPresentation, missionTitlePresentation} from './mission-presentation.js';

const state = {
  token: null,
  overview: null,
  projects: [],
  activeProjectId: null,
  project: null,
  projectLoading: false,
  roles: [],
  roleGroup: 'all',
  roleQuery: '',
  selectedRoleId: null,
  selectedRole: null,
  selectedConversationId: null,
  messages: [],
  selectedMissionId: null,
  selectedMission: null,
  selectedMissionTab: 'trace',
  // Current mission mappings intentionally store hashes, not a recoverable
  // mandate. Keep presentation titles only in this in-memory, project-scoped
  // cache after an operator has opened that mission's authorized detail.
  missionTitles: new Map(),
  missionAction: null,
  missionActionError: null,
  missionStatusRefresh: null,
  projectReadRefresh: null,
  assets: [],
  deliverables: [],
  deliveryInbox: [],
  deliverablePreview: null,
  deliveryAction: null,
  autoDeliveryAttempts: new Set(),
  projectRuntimeStartFailure: null,
  composerAssetIds: [],
  missionAssetIds: [],
  assetUpload: {active: false, scope: null, files: []},
  activeView: 'home',
  // A page must never reserve an HTTP/1.1 connection forever just to hear that
  // the local console changed.  A finite poll gives the same five-second
  // freshness as the former SSE heartbeat, without starving a seventh local
  // tab of connections needed to open its project.
  livePoll: {generation: 0, timer: null, controller: null, timeout: null},
  projectSelection: {generation: 0, projectId: null, controller: null, timeout: null, timedOut: false},
  refreshing: false,
  voice: {recognition: null, active: false, used: false, baseline: ''},
  speech: {utterance: null, messageKey: null},
};

const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];
const terminalStates = new Set(['COMPLETED', 'CANCELLED', 'FAILED', 'REJECTED']);
const exportObjectUrlRetentionMs = 60_000;
const livePollIntervalMs = 5_000;
const livePollTimeoutMs = 20_000;
const projectSelectionTimeoutMs = 45_000;

// The token intentionally lives only in this page and is invalidated whenever
// the local console process restarts. Rebinding happens only after the server
// itself rejects an old token; the failed operation is never replayed.
const localUiSessionRecovery = createLocalUiSessionRecovery({
  applyBootstrap: bootstrap => {
    state.token = bootstrap.token;
    state.overview = bootstrap.overview;
  },
});

function el(tag, options = {}, children = []) {
  const node = document.createElement(tag);
  if (typeof options === 'string') {
    node.textContent = options;
  } else {
    const {className, text, attrs, dataset} = options;
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = String(text);
    if (attrs) {
      for (const [key, value] of Object.entries(attrs)) {
        if (value !== undefined && value !== null) node.setAttribute(key, String(value));
      }
    }
    if (dataset) Object.assign(node.dataset, dataset);
  }
  for (const child of Array.isArray(children) ? children : [children]) {
    if (child !== null && child !== undefined) node.append(child);
  }
  return node;
}

function svgEl(tag, attrs = {}) {
  const node = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value !== undefined && value !== null) node.setAttribute(key, String(value));
  }
  return node;
}

function append(parent, ...children) {
  parent.append(...children.filter(Boolean));
  return parent;
}

function array(value) { return Array.isArray(value) ? value : []; }
function object(value) { return value && typeof value === 'object' && !Array.isArray(value) ? value : {}; }
function text(value, fallback = '—') { return value === undefined || value === null || value === '' ? fallback : String(value); }
function upper(value) { return String(value ?? '').toUpperCase(); }
function displayId(value) { return String(value ?? '').replace(/^mission:/, '').slice(0, 8) || '—'; }
function initial(value, fallback = 'S') { return String(value ?? fallback).trim().slice(0, 1).toLocaleUpperCase('es') || fallback; }
function pathValue(source, path, fallback = undefined) { return path.split('.').reduce((cursor, key) => cursor && cursor[key], source) ?? fallback; }
function formatNumber(value) { return Number.isFinite(Number(value)) ? new Intl.NumberFormat('es-ES').format(Number(value)) : '—'; }
function formatBytes(value) {
  const bytes = Number(value);
  if (!Number.isFinite(bytes) || bytes < 0) return '—';
  if (bytes < 1024) return formatNumber(bytes) + ' B';
  const units = ['KiB', 'MiB', 'GiB'];
  let amount = bytes / 1024;
  let index = 0;
  while (amount >= 1024 && index < units.length - 1) { amount /= 1024; index += 1; }
  return new Intl.NumberFormat('es-ES', {maximumFractionDigits: amount < 10 ? 1 : 0}).format(amount) + ' ' + units[index];
}
function byteLength(value) { return new TextEncoder().encode(String(value ?? '')).length; }

function mappingUsesPublicSourcedRoute(mapping) {
  const safeMapping = object(mapping);
  return isProjectPublicSourcedRouteBinding(safeMapping.routeBinding)
    || isProjectPublicSourcedRouteBinding(object(safeMapping.admission).routeBinding);
}

function sourcedProgressForDetail(mission, report) {
  return publicSourcedRouteProgress(object(mission).sourcedRouteProgress)
    || publicSourcedRouteProgress(object(object(report).mission).sourcedRouteProgress);
}

function sourcedProgressForMission(mission) {
  const selectedMission = object(state.selectedMission?.status?.data?.mission);
  const selectedReport = selectedMission.id === object(mission).id && state.selectedMission?.report?.ok
    ? object(state.selectedMission.report.data)
    : null;
  return sourcedProgressForDetail(mission, selectedReport);
}

function selectedMissionUsesPublicSourcedRoute(mission = object(state.selectedMission?.status?.data?.mission)) {
  const mapping = activeMappings().find(candidate => candidate.missionId === mission.id) ?? null;
  return mappingUsesPublicSourcedRoute(mapping) || Boolean(sourcedProgressForMission(mission));
}

// `NEEDS_DIRECTION` is normally a live lifecycle state. A sealed sourced
// route is different: once its verified public receipt says ESCALATED, that
// source entry has stopped and must not be portrayed as a job that controls can
// continue or that the browser should poll indefinitely.
function terminalMissionRefreshState(mission) {
  const status = upper(object(mission).status);
  if (terminalStates.has(status)) return true;
  const progress = sourcedProgressForMission(mission);
  return status === 'NEEDS_DIRECTION' && selectedMissionUsesPublicSourcedRoute(mission)
    && upper(progress?.phase) === 'ESCALATED';
}

function legacyMissionContextNotice() {
  return el('p', {className: 'eyebrow', text: 'MISIÓN HEREDADA · paquete técnico de contexto oculto; se muestra sólo el mandato original'});
}

function formatDate(value, {short = false} = {}) {
  if (!value) return 'sin fecha';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat('es-ES', short
    ? {hour: '2-digit', minute: '2-digit'}
    : {dateStyle: 'medium', timeStyle: 'short'}).format(date);
}

function relativeDate(value) {
  if (!value) return 'sin hora';
  const delta = Math.round((new Date(value).getTime() - Date.now()) / 1000);
  if (!Number.isFinite(delta)) return formatDate(value);
  const formatter = new Intl.RelativeTimeFormat('es', {numeric: 'auto'});
  if (Math.abs(delta) < 60) return formatter.format(delta, 'second');
  const minutes = Math.round(delta / 60);
  if (Math.abs(minutes) < 60) return formatter.format(minutes, 'minute');
  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 24) return formatter.format(hours, 'hour');
  return formatter.format(Math.round(hours / 24), 'day');
}

function statusTone(value) {
  const normalized = upper(value);
  if (['ACTIVE', 'READY', 'RUNNING', 'COMPLETED', 'ACCEPTED', 'AVAILABLE', 'VERIFIED_HASH_CHAIN', 'VERIFIED_HMAC_ANCHOR', 'INITIALIZED'].includes(normalized)) return 'success';
  if (['FAILED', 'CANCELLED', 'REJECTED', 'ERROR', 'START_FAILED', 'INTEGRITY_WARNING', 'UNVERIFIED', 'BLOCKED', 'DIRECTION_REQUIRED'].includes(normalized)) return 'danger';
  if (['QUEUED', 'PLANNING', 'PAUSED', 'WAITING_CAPABILITY', 'WAITING_PROVIDER', 'WAITING_QUOTA', 'PROVISIONED', 'NOT_AVAILABLE', 'ADMITTED', 'ACQUIRING', 'CANDIDATE_PENDING_REVIEW', 'ESCALATED', 'NEEDS_DIRECTION', 'RETURNED'].includes(normalized)) return 'warning';
  return '';
}

function pill(value, fallback = 'Sin estado') {
  return el('span', {className: 'status-pill ' + statusTone(value), text: value || fallback});
}

// A queue coordinator state and a mission lifecycle state are deliberately
// different dimensions.  Keep the original state as the value passed to
// `pill` so its visual tone remains truthful, then make the dimension explicit
// in the visible label.  This prevents a live planner from looking like it has
// already produced an answer merely because the queue owns its job.
function labeledStatusPill(label, value, fallback = 'NO OBSERVADO') {
  const stateValue = text(value, fallback);
  const node = pill(stateValue, fallback);
  node.textContent = label + ' · ' + stateValue;
  return node;
}

function queueExecutionSummary(job) {
  const stateValue = text(job?.status, 'NO OBSERVADA');
  const attempts = Number.isSafeInteger(job?.attempts) && job.attempts > 0
    ? ' · intento ' + job.attempts
    : '';
  return 'Cola · ' + stateValue + attempts;
}

function queueLifecycleState(job) {
  return text(job?.lifecycle?.status, 'NO OBSERVADO');
}

function runtimeStartFailureFor(projectId = state.activeProjectId) {
  const failure = object(state.projectRuntimeStartFailure);
  return failure.projectId === projectId && upper(failure.state) === 'START_FAILED' ? failure : null;
}

function runtimeStartFailureCode(supervisor) {
  const candidate = String(object(supervisor).error ?? '').toUpperCase();
  return /^[A-Z_][A-Z0-9_]{0,159}$/.test(candidate) ? candidate : 'PROJECT_RUNTIME_START_FAILED';
}

function rememberRuntimeStartFailure(projectId, supervisor) {
  if (upper(object(supervisor).state) !== 'START_FAILED') return false;
  state.projectRuntimeStartFailure = {
    projectId,
    state: 'START_FAILED',
    code: runtimeStartFailureCode(supervisor),
  };
  return true;
}

function clearRuntimeStartFailure(projectId = state.activeProjectId) {
  if (runtimeStartFailureFor(projectId)) state.projectRuntimeStartFailure = null;
}

function empty(target, title, description) {
  const template = $('#empty-row-template');
  const clone = template.content.firstElementChild.cloneNode(true);
  clone.querySelector('strong').textContent = title;
  clone.querySelector('p').textContent = description;
  target.replaceChildren(clone);
}

function toast(message, kind = '') {
  const notice = el('div', {className: 'toast' + (kind ? ' ' + kind : ''), text: message});
  $('#toast-region').append(notice);
  window.setTimeout(() => notice.remove(), 6_000);
}

function speechSynthesisApi() {
  const synthesis = globalThis.speechSynthesis;
  if (!synthesis || typeof synthesis.speak !== 'function' || typeof synthesis.cancel !== 'function' || typeof globalThis.SpeechSynthesisUtterance !== 'function') return null;
  return synthesis;
}

function messageSpeechKey(message, index) {
  const identity = message.id || message.eventId || message.sequence || [message.at, message.author, index].join(':');
  return String(state.selectedConversationId || 'no-conversation') + ':' + String(identity);
}

function refreshMessageSpeechControls() {
  const supported = Boolean(speechSynthesisApi());
  for (const button of $$('[data-speak-message-key]')) {
    const speaking = supported && button.dataset.speakMessageKey === state.speech.messageKey;
    button.disabled = !supported;
    button.classList.toggle('active', speaking);
    button.setAttribute('aria-pressed', String(speaking));
    button.title = supported
      ? (speaking ? 'Detener la lectura de este mensaje' : 'Escuchar con la síntesis de voz del navegador; la consola no recibe audio')
      : 'Este navegador no ofrece síntesis de voz.';
    const icon = button.querySelector('[data-speech-icon]');
    const label = button.querySelector('[data-speech-label]');
    if (icon) icon.textContent = speaking ? '■' : '▶';
    if (label) label.textContent = supported ? (speaking ? 'Detener audio' : 'Escuchar') : 'Audio no disponible';
  }
}

function clearMessageSpeech(utterance) {
  if (utterance && state.speech.utterance !== utterance) return;
  state.speech.utterance = null;
  state.speech.messageKey = null;
  refreshMessageSpeechControls();
}

function stopMessageSpeech({notify = false} = {}) {
  const hadSpeech = Boolean(state.speech.utterance || state.speech.messageKey);
  clearMessageSpeech();
  try { speechSynthesisApi()?.cancel(); } catch { /* browser cancellation is best effort */ }
  if (notify && hadSpeech) toast('Lectura detenida.');
}

function toggleMessageSpeech(index, key) {
  const message = state.messages[index];
  if (!message || messageSpeechKey(message, index) !== key) return;
  const content = String(message.text || '').trim();
  if (!content) { toast('Este mensaje no contiene texto para leer.', 'error'); return; }
  const synthesis = speechSynthesisApi();
  if (!synthesis) {
    toast('Este navegador no ofrece síntesis de voz. La fábrica no ha recibido ni almacenado audio.', 'error');
    return;
  }
  if (state.speech.messageKey === key) { stopMessageSpeech({notify: true}); return; }

  stopMessageSpeech();
  const utterance = new SpeechSynthesisUtterance(content);
  utterance.lang = navigator.language || 'es-ES';
  utterance.rate = 1;
  utterance.onend = () => clearMessageSpeech(utterance);
  utterance.onerror = event => {
    if (state.speech.utterance !== utterance) return;
    clearMessageSpeech(utterance);
    if (!['canceled', 'interrupted'].includes(event.error)) toast('La lectura se detuvo: ' + (event.error || 'error del navegador') + '.', 'error');
  };
  state.speech.utterance = utterance;
  state.speech.messageKey = key;
  try {
    synthesis.speak(utterance);
    refreshMessageSpeechControls();
  } catch {
    clearMessageSpeech(utterance);
    toast('El navegador no pudo iniciar la lectura.', 'error');
  }
}

function showNotice(message) {
  const bar = $('#notice-bar');
  bar.textContent = message;
  bar.classList.remove('is-hidden');
}

function hideNotice() { $('#notice-bar').classList.add('is-hidden'); }

async function api(path, options = {}) {
  const {method = 'GET', body, token = false, signal} = options;
  const headers = new Headers(options.headers || {});
  headers.set('accept', 'application/json');
  if (body !== undefined) headers.set('content-type', 'application/json');
  if (token) headers.set('x-sovereign-ui-token', state.token || '');
  const response = await fetch(path, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    credentials: 'same-origin',
    cache: 'no-store',
    signal,
  });
  if (!response.ok) throw await localConsoleResponseFailure(response, 'La consola no pudo completar la operación.');
  let payload = {};
  try { payload = await response.json(); } catch { /* readable HTTP error below */ }
  return payload;
}

async function localConsoleResponseFailure(response, fallback) {
  const failure = await localUiSessionRecovery.errorForResponse(response, fallback);
  if (failure.code === 'LOCAL_UI_SESSION_RENEWED') {
    // The bootstrap response is a bounded read. Updating the visible model
    // inventory and stream makes an already open tab usable again, while the
    // action that received 403 remains stopped at the server boundary.
    configureModelForms();
    renderSystem();
    connectStream();
  }
  return failure;
}

function activeProject() { return state.project?.project ?? null; }
function activeConversations() { return array(state.project?.conversations); }
function activeMappings() { return array(state.project?.missions); }
function projectQueue() { return array(state.project?.runtime?.queue); }
function projectAssets() { return array(state.assets); }
function findProjectAsset(assetId) { return projectAssets().find(asset => asset.id === assetId) ?? null; }
function projectDeliverables() { return array(state.deliverables); }
function findProjectDeliverable(deliveryId) { return projectDeliverables().find(delivery => delivery.id === deliveryId) ?? null; }
function projectDeliveryInbox() { return array(state.deliveryInbox); }

function rememberMissionTitleFromDetail(missionId, detail) {
  const mapping = activeMappings().find(candidate => candidate.missionId === missionId) ?? null;
  if (!mapping) return false;
  const mission = object(object(detail?.status).data?.mission);
  if (mission.id !== missionId) return false;
  const intent = missionIntentPresentation(mission.intent).intent;
  const presentation = missionTitlePresentation({mapping: {missionId}, cachedIntent: intent});
  if (presentation.source !== 'DETAIL') return false;
  state.missionTitles.set(missionId, presentation.title);
  return true;
}
// The home desk is a real shortcut into the conversation composer.  It shares
// only that draft's asset references; it never creates a second hidden file
// queue or a parallel project scope.
function assetIdsFor(scope) { return scope === 'mission' ? state.missionAssetIds : state.composerAssetIds; }
function setAssetIdsFor(scope, assetIds) {
  if (scope === 'mission') state.missionAssetIds = assetIds;
  else state.composerAssetIds = assetIds;
}
function models() { return array(pathValue(state.overview, 'provider.data.models', [])); }
function executionTargets() { return object(state.overview?.executionTargets); }
function factoryMissionDefault() { return object(executionTargets().missionDefault); }
function roleGroups() {
  return state.roles.reduce((groups, role) => {
    const group = String(role.id ?? 'otros').split('_')[0] || 'otros';
    groups[group] = (groups[group] ?? 0) + 1;
    return groups;
  }, {});
}

function setLiveStatus(label, kind = '') {
  const status = $('#stream-status');
  status.className = 'live-status' + (kind ? ' ' + kind : '');
  status.querySelector('span').textContent = label;
}

function projectSelectionRemembered() {
  try { return localStorage.getItem('sovereign.active-project'); } catch { return null; }
}

function rememberProject(id) {
  try { localStorage.setItem('sovereign.active-project', id); } catch { /* preference is optional */ }
}

function clearProjectPreference() {
  try { localStorage.removeItem('sovereign.active-project'); } catch { /* preference is optional */ }
}

function renderProjects() {
  const holder = $('#project-list');
  holder.replaceChildren();
  if (!state.projects.length) {
    holder.append(el('p', {className: 'section-label', text: 'Aún no hay espacios.'}));
    return;
  }
  for (const project of state.projects) {
    const button = el('button', {
      className: 'project-row' + (project.id === state.activeProjectId ? ' active' : ''),
      attrs: {type: 'button', role: 'listitem'},
      dataset: {projectId: project.id},
    });
    append(button,
      el('span', {className: 'project-avatar', text: initial(project.name)}),
      el('span', {className: 'project-row-copy'}, [
        el('strong', project.name),
        el('span', project.client || 'Sin cartera declarada'),
      ]),
    );
    holder.append(button);
  }
}

function renderShell() {
  const project = activeProject();
  const hasProject = Boolean(project);
  const loadingProject = Boolean(state.projectLoading && !hasProject);
  $('#empty-workspace').hidden = hasProject || loadingProject;
  $('#workspace-loading').hidden = !loadingProject;
  $('#workspace').hidden = !hasProject;
  $('#open-mission').disabled = !hasProject;
  $('#edit-project-identity').disabled = !hasProject;
  $('#crumb-client').textContent = project?.client || 'Portfolio';
  $('#crumb-project').textContent = project?.name || 'Selecciona un espacio';
  $('#rail-sync').textContent = state.overview?.generatedAt ? 'Actualizado ' + relativeDate(state.overview.generatedAt) : 'Sincronizando';
  renderProjects();
  if (!hasProject) {
    $('#inspector-project').replaceChildren(
      el('span', {className: 'project-avatar', text: 'S'}),
      el('div', {}, [el('strong', 'Sin espacio activo'), el('p', 'Crea o selecciona un proyecto')]),
    );
  }
}

function renderHome() {
  const project = activeProject();
  if (!project) return;
  const stats = object(project.stats);
  const runtime = object(state.project.runtime);
  const queue = array(runtime.queue);
  const active = queue.filter(item => !terminalStates.has(upper(item.status)));
  $('#home-eyebrow').textContent = project.client ? 'CLIENTE · ' + project.client : 'ESPACIO ACTIVO';
  $('#home-title').textContent = project.name;
  $('#home-description').textContent = project.description || project.objective || 'Este espacio todavía no tiene contexto descriptivo. Añádelo en conversación para que el proyecto lo conserve de forma aislada.';
  $('#signal-integrity').textContent = ['VERIFIED_HASH_CHAIN', 'VERIFIED_HMAC_ANCHOR'].includes(stats.integrity) ? 'Verificada' : text(stats.integrity);
  $('#signal-integrity-detail').textContent = stats.integrityDetail || 'Cadena local de ' + formatNumber(stats.memoryEntries || 0) + ' entradas';
  $('#signal-memory').textContent = formatNumber(stats.memoryEntries || 0);
  $('#signal-runs').textContent = formatNumber(active.length);
  $('#signal-runs-detail').textContent = active.length ? active.length + ' misión(es) no terminal(es)' : (runtime.state === 'PROVISIONED' ? 'Raíz lista; sin misión aún' : 'Sin trabajo pendiente');
  $('#signal-budget').textContent = 'No atestado';
  $('#conversation-count').textContent = String(stats.conversations || 0);
  $('#mission-count').textContent = String(stats.missions || 0);
  renderActivity();
  renderProtocol();
}

function renderActivity() {
  const holder = $('#activity-feed');
  holder.replaceChildren();
  const recent = array(state.project?.recent);
  if (!recent.length) {
    empty(holder, 'Aún no hay actividad.', 'El espacio no inventa memoria: aparecerá una entrada cuando guardes contexto o registres una misión.');
    return;
  }
  for (const entry of recent.slice(0, 10)) {
    const item = el('li');
    const content = el('div', {className: 'activity-content'});
    const label = entry.kind === 'conversation.message'
      ? (entry.author === 'user' ? 'Contexto del usuario' : 'Mensaje de agente')
      : entry.kind === 'mission.submitted' ? 'Misión registrada' : entry.kind === 'model.policy.updated' ? 'Política de modelo actualizada' : entry.kind;
    append(content,
      el('strong', label),
      el('p', entry.text || 'Entrada sin texto proyectado.'),
    );
    append(item, el('span', {className: 'activity-dot'}), content, el('time', {text: relativeDate(entry.at), attrs: {datetime: entry.at || ''}}));
    holder.append(item);
  }
}

function renderProtocol() {
  const list = $('#protocol-list');
  list.replaceChildren();
  for (const item of array(state.project?.protocol?.loadOrder)) list.append(el('li', item));
  $('#boundary-summary').textContent = state.project?.protocol?.boundary || 'El contexto se limita al espacio activo.';
}

function renderConversation() {
  if (!activeProject()) return;
  const conversations = activeConversations();
  const list = $('#conversation-list');
  list.replaceChildren();
  $('#thread-total').textContent = String(conversations.length);
  if (!conversations.length) {
    empty(list, 'Sin hilos todavía.', 'Escribe o dicta el primer contexto para abrir una conversación aislada.');
  } else {
    for (const conversation of conversations) {
      const button = el('button', {
        className: 'conversation-row' + (conversation.id === state.selectedConversationId ? ' active' : ''),
        attrs: {type: 'button'},
        dataset: {conversationId: conversation.id},
      });
      append(button,
        el('strong', conversation.title || 'Conversación sin título'),
        el('span', formatNumber(conversation.messageCount || 0) + ' mensajes · ' + relativeDate(conversation.updatedAt)),
      );
      list.append(button);
    }
  }
  const selected = conversations.find(item => item.id === state.selectedConversationId);
  $('#chat-title').textContent = selected?.title || (state.selectedConversationId ? 'Conversación nueva' : 'Nuevo contexto');
  renderMessages();
}

function renderMessages() {
  const holder = $('#message-list');
  const visibleSpeechKeys = new Set(state.messages.map((message, index) => messageSpeechKey(message, index)));
  if (state.speech.messageKey && !visibleSpeechKeys.has(state.speech.messageKey)) stopMessageSpeech();
  holder.replaceChildren();
  if (!state.selectedConversationId) {
    empty(holder, 'Abre el primer hilo.', 'Guarda un mensaje para crear automáticamente una conversación dentro de este espacio.');
    return;
  }
  if (!state.messages.length) {
    empty(holder, 'Conversación sin mensajes.', 'El historial se lee sólo de la memoria de este proyecto.');
    return;
  }
  for (const [index, message] of state.messages.entries()) {
    const user = message.author === 'user';
    const verifiedFinal = object(message.turn);
    const hasVerifiedFinal = verifiedFinal.kind === 'verified-final-delivery'
      && typeof verifiedFinal.deliveryId === 'string'
      && typeof verifiedFinal.missionId === 'string';
    const row = el('article', {className: 'message' + (user ? ' user' : '')});
    const body = el('div', {className: 'message-body'});
    const source = hasVerifiedFinal
      ? 'Entrega final verificada · recibo sellado en este proyecto'
      : message.source === 'browser-voice-transcript' ? 'Dictado de navegador · texto revisable' : message.source === 'typed' ? 'Texto local' : text(message.source, 'Contexto registrado');
    const key = messageSpeechKey(message, index);
    const supported = Boolean(speechSynthesisApi());
    const speaking = supported && state.speech.messageKey === key;
    const speaker = el('button', {
      className: 'message-speak-button' + (speaking ? ' active' : ''),
      attrs: {
        type: 'button',
        disabled: supported ? undefined : '',
        'aria-pressed': String(speaking),
        'aria-label': (speaking ? 'Detener lectura de ' : 'Escuchar con la síntesis de voz del navegador: ') + (user ? 'tu mensaje' : 'este mensaje'),
        title: supported
          ? (speaking ? 'Detener la lectura de este mensaje' : 'Escuchar con la síntesis de voz del navegador; la consola no recibe audio')
          : 'Este navegador no ofrece síntesis de voz.',
      },
      dataset: {speakMessageIndex: index, speakMessageKey: key},
    }, [
      el('span', {text: speaking ? '■' : '▶', attrs: {'aria-hidden': 'true', 'data-speech-icon': ''}}),
      el('span', {text: supported ? (speaking ? 'Detener audio' : 'Escuchar') : 'Audio no disponible', attrs: {'data-speech-label': ''}}),
    ]);
    const footer = [el('div', {className: 'message-source', text: source})];
    if (hasVerifiedFinal && verifiedFinal.presentation?.mode === 'sealed-delivery-reference-v1') {
      footer.push(el('button', {
        className: 'quiet-button message-delivery-link', text: 'Abrir entrega sellada', attrs: {type: 'button'},
        dataset: {conversationDeliveryId: verifiedFinal.deliveryId, conversationDeliveryMissionId: verifiedFinal.missionId},
      }));
    }
    footer.push(speaker);
    append(body,
      el('div', {className: 'message-meta'}, [el('strong', user ? 'Tú' : hasVerifiedFinal ? 'Sublimine' : text(message.author, 'Sistema')), el('span', formatDate(message.at, {short: true}))]),
      el('div', {className: 'message-text', text: message.text}),
      el('div', {className: 'message-footer'}, footer),
    );
    append(row, el('span', {className: 'message-avatar', text: user ? 'T' : hasVerifiedFinal ? 'S' : initial(message.author, 'S')}), body);
    holder.append(row);
  }
  holder.scrollTop = holder.scrollHeight;
}

function renderMissions() {
  if (!activeProject()) return;
  const mappings = activeMappings();
  const queue = projectQueue();
  const holder = $('#project-mission-list');
  const runtimeStartFailure = runtimeStartFailureFor(activeProject().id);
  const runtimeState = runtimeStartFailure?.state || state.project?.runtime?.state || '—';
  $('#project-runtime-state').textContent = runtimeState;
  $('#project-runtime-state').className = 'status-pill ' + statusTone(runtimeState);
  holder.replaceChildren();
  if (!mappings.length) {
    empty(holder, 'La cola de este proyecto está vacía.', 'Crear una misión aquí prepara una entrada sólo en el estado aislado de este espacio.');
    $('#mission-detail').replaceChildren();
    $('#mission-detail').append(el('div', {className: 'inspector-empty'}, [el('strong', 'Sin misión seleccionada'), el('p', 'Las misiones de otro proyecto nunca se proyectan en este panel.')]));
    return;
  }
  for (const mapping of mappings) {
    const job = queue.find(item => item.missionId === mapping.missionId) ?? null;
    const lifecycle = queueLifecycleState(job);
    const presentation = missionTitlePresentation({
      mapping,
      cachedIntent: state.missionTitles.get(mapping.missionId) ?? null,
    });
    const listTitle = presentation.title;
    const button = el('button', {
      className: 'mission-row' + (mapping.missionId === state.selectedMissionId ? ' active' : ''),
      attrs: {type: 'button'},
      dataset: {projectMissionId: mapping.missionId},
    });
    append(button,
      el('div', {className: 'mission-row-top'}, [el('strong', listTitle), labeledStatusPill('Ciclo', lifecycle)]),
      el('p', 'Modelo: ' + text(mapping.modelPolicy?.model, 'predeterminado') + ' · ' + text(mapping.modelPolicy?.effort, 'predeterminado')),
      el('span', {className: 'mission-queue-status', text: queueExecutionSummary(job), attrs: {title: 'El estado de cola indica quién coordina el trabajo; no sustituye el ciclo real de la misión.'}}),
      array(mapping.assetReferences).length ? el('span', {className: 'mission-attachment-count', text: array(mapping.assetReferences).length + ' archivo(s) sellado(s)'}) : null,
      presentation.source === 'WITHHELD' ? el('span', {className: 'mission-legacy-notice', text: 'Abre la misión para ver el mandato público disponible'}) : null,
      presentation.legacyContextPack ? el('span', {className: 'mission-legacy-notice', text: 'Contexto heredado oculto'}) : null,
      el('span', relativeDate(mapping.at)),
    );
    holder.append(button);
  }
  renderMissionDetail();
}

function detailBlock(title, content) {
  const block = el('section', {className: 'detail-block'});
  block.append(el('h3', title));
  if (typeof content === 'string') block.append(el('p', content));
  else block.append(content);
  return block;
}

function jsonBlock(value) {
  return el('pre', {text: JSON.stringify(value ?? null, null, 2)});
}

function publicEvidenceLabel(value, fields, fallback) {
  const safe = object(value);
  for (const field of fields) {
    const candidate = safe[field];
    if (typeof candidate !== 'string') continue;
    const compact = candidate.replace(/[\r\n\t]+/g, ' ').trim();
    if (compact) return compact.slice(0, 200);
  }
  return fallback;
}

// Cost is useful only when it is an attested scalar. Do not turn a future
// nested report field or arbitrary diagnostic text into a budget display.
function publicCostDisplay(report) {
  const cost = object(object(report).metrics).cost;
  if (typeof cost !== 'number' || !Number.isFinite(cost) || cost < 0 || cost > 1_000_000_000_000) {
    return 'NOT_ATTESTED: el runtime no emitió un recibo de coste verificable.';
  }
  return new Intl.NumberFormat('es-ES', {maximumFractionDigits: 6}).format(cost);
}

// This panel intentionally consumes the finite technical projection, not the
// selected mission detail. Unlike the old JSON panel it cannot reveal a
// context pack merely because a future server field happens to be present.
function renderMissionTechnicalProjection(projection) {
  const technical = object(projection);
  const availability = object(technical.availability);
  const policy = object(technical.policy);
  const topology = object(technical.topology);
  const evidence = object(technical.evidence);
  const route = object(technical.sourcedRoute);
  const count = value => Number.isSafeInteger(value) ? String(value) : 'NO PROYECTADO';
  const facts = rows => el('ul', {}, rows.map(([label, value]) => el('li', label + ': ' + value)));
  return el('div', {className: 'detail-grid mission-technical-projection'}, [
    detailBlock('Superficie publicada', facts([
      ['Estado', text(technical.status, 'UNVERIFIED')],
      ['Ruta', text(technical.route, 'UNVERIFIED')],
      ['Detalle de misión', text(availability.detail, 'UNAVAILABLE')],
      ['Informe público', text(availability.report, 'UNAVAILABLE')],
    ])),
    detailBlock('Política congelada', facts([
      ['Modelo', text(policy.model, 'NO PROYECTADO')],
      ['Razonamiento', text(policy.reasoningEffort, 'NO PROYECTADO')],
      ['Presupuesto de intentos', text(policy.maxNodeAttempts, 'NO PROYECTADO')],
    ])),
    detailBlock('Topología publicada', facts([
      ['Disponibilidad', text(topology.state, 'NOT_PUBLISHED')],
      ['Integridad', text(topology.integrity, 'UNVERIFIED')],
      ['Nodos', count(topology.nodes)],
      ['Nodo final', text(topology.finalNodeId, 'NO PROYECTADO')],
    ])),
    detailBlock('Evidencia publicada', facts([
      ['Disponibilidad', text(evidence.state, 'NOT_PUBLISHED')],
      ['Fuentes', count(evidence.sources)],
      ['Revisiones', count(evidence.reviews)],
      ['Fase de ruta', text(route.phase, 'NOT_APPLICABLE')],
    ])),
  ]);
}

// The control room is a concise, live-facing complement to the detailed trace.
// Its model is allow-listed in mission-control-room.js, so this renderer never
// receives provider messages, raw evidence, prompt text or private project
// context. Refreshes redraw this component only from confirmed local API data.
function missionExecutionLane(nodes) {
  return el('ol', {className: 'mission-execution-lane'}, nodes.map((node, index) => el('li', {className: 'mission-execution-node'}, [
    el('span', {className: 'mission-execution-index', text: String(index + 1), attrs: {'aria-hidden': 'true'}}),
    el('div', {className: 'mission-execution-copy'}, [
      el('strong', node.title),
      node.roles.length ? el('span', {text: 'Asignado: ' + node.roles.join(' · ')}) : el('span', {text: 'Sin roles publicables'}),
    ]),
    labeledStatusPill('Nodo', node.status),
  ])));
}

function missionExecutionGraph(execution) {
  const graph = object(execution);
  const nodes = array(graph.nodes);
  const edges = array(graph.edges);
  if (!nodes.length) return el('p', {className: 'mission-execution-empty', text: 'No hay grafo de nodos publicado para esta ruta. La traza operativa muestra sólo los hitos verificables disponibles.'});
  if (graph.integrity !== 'VERIFIED') {
    return el('div', {className: 'mission-graph-unverified'}, [
      el('p', {text: 'La topología publicada no forma un DAG verificable. Se muestran las fichas de nodo, pero no se dibujan conexiones inferidas.'}),
      missionExecutionLane(nodes),
    ]);
  }
  const levels = new Map();
  for (const node of nodes) {
    const level = Number.isSafeInteger(node.level) && node.level >= 0 && node.level <= 24 ? node.level : null;
    if (level === null) return el('div', {className: 'mission-graph-unverified'}, [
      el('p', {text: 'La topología publicada no contiene niveles verificables; no se dibujan conexiones.'}),
      missionExecutionLane(nodes),
    ]);
    const group = levels.get(level) ?? [];
    group.push(node);
    levels.set(level, group);
  }
  const maxLevel = Math.max(...levels.keys());
  const nodeWidth = 196, nodeHeight = 74, columnGap = 78, rowGap = 20, padding = 24;
  const maxRows = Math.max(...[...levels.values()].map(group => group.length));
  const width = padding * 2 + (maxLevel + 1) * nodeWidth + maxLevel * columnGap;
  const height = padding * 2 + maxRows * nodeHeight + Math.max(0, maxRows - 1) * rowGap;
  const positions = new Map();
  for (const [level, group] of levels.entries()) {
    group.forEach((node, row) => positions.set(node.id, {
      x: padding + level * (nodeWidth + columnGap),
      y: padding + row * (nodeHeight + rowGap),
    }));
  }
  const canvas = el('div', {className: 'mission-graph-canvas', attrs: {style: '--mission-graph-width:' + width + 'px;--mission-graph-height:' + height + 'px'}});
  const links = svgEl('svg', {class: 'mission-graph-links', viewBox: '0 0 ' + width + ' ' + height, width, height, 'aria-hidden': 'true'});
  const defs = svgEl('defs');
  const marker = svgEl('marker', {id: 'mission-graph-arrow', markerWidth: 8, markerHeight: 8, refX: 7, refY: 3.5, orient: 'auto', markerUnits: 'strokeWidth'});
  marker.append(svgEl('path', {d: 'M0,0 L0,7 L7,3.5 z', fill: 'currentColor'}));
  defs.append(marker);
  links.append(defs);
  for (const edge of edges) {
    const source = positions.get(edge.from);
    const target = positions.get(edge.to);
    if (!source || !target) continue;
    const x1 = source.x + nodeWidth, y1 = source.y + nodeHeight / 2;
    const x2 = target.x, y2 = target.y + nodeHeight / 2;
    const bend = Math.max(28, (x2 - x1) / 2);
    links.append(svgEl('path', {class: 'mission-graph-link', d: 'M ' + x1 + ' ' + y1 + ' C ' + (x1 + bend) + ' ' + y1 + ', ' + (x2 - bend) + ' ' + y2 + ', ' + x2 + ' ' + y2, 'marker-end': 'url(#mission-graph-arrow)'}));
  }
  canvas.append(links);
  for (const node of nodes) {
    const point = positions.get(node.id);
    if (!point) continue;
    canvas.append(el('article', {className: 'mission-graph-node', attrs: {style: '--mission-graph-x:' + point.x + 'px;--mission-graph-y:' + point.y + 'px'}}, [
      el('div', {className: 'mission-graph-node-head'}, [
        el('span', {className: 'mission-graph-node-level', text: 'Nivel ' + (node.level + 1)}),
        labeledStatusPill('Nodo', node.status),
      ]),
      el('strong', {text: node.title}),
      node.roles.length ? el('span', {text: node.roles.join(' · ')}) : el('span', {text: 'Sin roles publicables'}),
    ]));
  }
  return el('div', {className: 'mission-graph-scroll'}, [canvas]);
}

function renderMissionControlRoom(room) {
  const fact = (label, value, tone = value, note = null) => el('article', {className: 'mission-control-fact'}, [
    el('span', {className: 'eyebrow', text: label}),
    labeledStatusPill(label === 'BLOQUEO' ? 'Estado' : label === 'FASE' ? 'Fase' : label === 'COORDINACIÓN' ? 'Cola' : 'Estado', tone),
    el('strong', {text: value}),
    note ? el('small', {className: 'mission-control-note', text: note}) : null,
  ]);
  const execution = missionExecutionGraph(room.execution);
  const graphLabel = room.execution.integrity === 'VERIFIED'
    ? 'Grafo de ejecución verificado · ' + room.execution.nodes.length + ' nodo' + (room.execution.nodes.length === 1 ? '' : 's') + ' · ' + room.execution.edges.length + ' handoff' + (room.execution.edges.length === 1 ? '' : 's')
    : room.execution.integrity === 'UNVERIFIED'
      ? 'Topología no verificable · conexiones ocultas'
      : 'Grafo de ejecución publicado · ' + room.execution.nodes.length + ' nodo' + (room.execution.nodes.length === 1 ? '' : 's');
  const assignmentTone = room.assignment.value === 'SIN NODO ACTIVO PUBLICADO'
    ? 'UNVERIFIED'
    : terminalStates.has(room.status)
      ? room.status
      : 'RUNNING';
  return el('section', {className: 'mission-control-room', attrs: {'aria-label': 'Sala de control de la misión', 'aria-live': 'polite'}}, [
    el('div', {className: 'mission-control-room-head'}, [
      el('div', {}, [el('p', {className: 'eyebrow', text: 'SALA DE CONTROL'}), el('h3', 'Estado operativo confirmado')]),
      labeledStatusPill('Misión', room.status),
    ]),
    el('div', {className: 'mission-control-grid'}, [
      fact('FASE', room.phase.value),
      fact('COORDINACIÓN', room.coordination.value, room.coordination.value, room.coordination.retrySchedule
        ? 'Reintento automático ' + (room.coordination.retrySchedule.automaticRetries ?? 'programado') + ' · ' + formatDate(room.coordination.retrySchedule.at, {short: true})
        : room.coordination.retryInFlight
          ? 'Reintento automático en curso · intento ' + room.coordination.retryInFlight.attempts + ' · último estado confirmado: ' + room.coordination.retryInFlight.lastLifecycleStatus
        : null),
      fact('ASIGNACIÓN', room.assignment.value, assignmentTone),
      fact('BLOQUEO', room.blocking.label, room.blocking.state, room.coordination.retryInFlight
        ? 'El último código se conserva como evidencia; no se marca como resuelto hasta que el runtime publique un nuevo estado.'
        : null),
    ]),
    room.assignment.roles.length ? el('p', {className: 'mission-control-roles', text: 'Roles activos: ' + room.assignment.roles.join(' · ')}) : null,
    el('details', {className: 'mission-execution-graph', attrs: room.execution.nodes.length ? {open: ''} : {}}, [
      el('summary', graphLabel),
      execution,
    ]),
  ]);
}

function selectedMissionTab(room) {
  return missionControlRoomSelectedTab(room, state.selectedMissionTab || 'trace');
}

function activateMissionTab(tabId, {focus = false} = {}) {
  if (!state.selectedMission || !tabId) return false;
  state.selectedMissionTab = tabId;
  renderMissions();
  if (focus) {
    const activeTab = $$('[data-mission-tab]').find(button => button.dataset.missionTab === tabId && !button.disabled);
    activeTab?.focus();
  }
  return true;
}

const missionActionLabels = {
  pause: 'Pausar',
  continue: 'Continuar',
  cancel: 'Cancelar',
  'retry-review': 'Enviar reintento de revisión',
};

function missionActionLabel(action) {
  return missionActionLabels[action] || 'Acción';
}

function missionActionPending(missionId) {
  return state.missionAction?.missionId === missionId;
}

function missionDeliveryPending(missionId) {
  return state.deliveryAction?.missionId === missionId;
}

function missionDeliveryButton(mission) {
  const status = upper(mission.status);
  const existing = projectDeliverables().find(delivery => delivery.missionId === mission.id) ?? null;
  const pending = missionDeliveryPending(mission.id);
  const sourcedProgress = sourcedProgressForMission(mission);
  const sourcedAvailability = sourcedProgress?.delivery?.availability ?? null;
  const sourcedRecoveryBlocked = sourcedAvailability !== null && sourcedAvailability !== 'AVAILABLE';
  if (existing) {
    return el('button', {
      className: 'primary-button mission-delivery-button', text: 'Abrir entrega final', attrs: {type: 'button', disabled: pending ? '' : undefined, title: 'Abrir la entrega aceptada y sellada en la bóveda del proyecto.'},
      dataset: {missionDeliveryOpenId: existing.id},
    });
  }
  return el('button', {
    className: 'primary-button mission-delivery-button', text: pending ? 'Verificando entrega…' : sourcedAvailability === 'AVAILABLE' ? 'Recuperar entrega final' : 'Entrega final pendiente',
    attrs: {
      type: 'button',
      disabled: status !== 'COMPLETED' || pending || sourcedRecoveryBlocked ? '' : undefined,
      title: sourcedAvailability === 'AVAILABLE' && status !== 'COMPLETED'
        ? 'La ruta confirmó una entrega disponible, pero la misión aún no cerró como COMPLETED. La consola espera ese cierre antes de recuperarla.'
        : sourcedRecoveryBlocked
          ? 'La ruta con fuentes no confirmó una entrega final disponible. La consola no la recupera por inferencia.'
        : status === 'COMPLETED'
        ? 'Pedir a la fábrica únicamente el producto final ya aceptado; no genera una respuesta nueva.'
        : 'Disponible cuando el runtime confirme COMPLETED y exista un producto final aceptado.',
    },
    dataset: {missionDeliveryId: mission.id},
  });
}

function sourcedDeliveryStatus(mission) {
  const progress = sourcedProgressForMission(mission);
  if (!progress) return null;
  const availability = progress.delivery.availability;
  const guidance = availability === 'AVAILABLE'
    ? upper(mission.status) === 'COMPLETED'
      ? 'La entrega puede recuperarse ahora desde el control de la misión.'
      : 'La ruta la declara disponible; la consola espera el cierre confirmado de la misión antes de recuperarla.'
    : availability === 'UNVERIFIED'
      ? 'El runtime no confirmó la disponibilidad. La consola no habilita una recuperación por inferencia.'
      : 'La ruta aún no declara una entrega final recuperable.';
  return el('div', {className: 'mission-source-delivery-status', attrs: {'aria-label': 'Disponibilidad de entrega de la ruta con fuentes'}}, [
    el('span', {className: 'eyebrow', text: 'ENTREGA · RUTA CON FUENTES'}),
    labeledStatusPill('Entrega', availability),
    el('p', {text: guidance}),
  ]);
}

function missionActionButton(mission, action, {disabled = false, disabledReason = '', danger = false} = {}) {
  const pending = missionActionPending(mission.id);
  const isCurrentAction = pending && state.missionAction?.action === action;
  const unavailable = disabled || pending;
  return el('button', {
    className: (danger ? 'danger-button' : 'quiet-button') + ' mission-action-button',
    text: isCurrentAction ? 'Enviando…' : missionActionLabel(action),
    attrs: {
      type: 'button',
      disabled: unavailable ? '' : undefined,
      title: unavailable && disabledReason
        ? disabledReason
        : action === 'cancel'
        ? 'Solicitar cancelación: requiere una confirmación antes de llamar a la fábrica.'
        : 'Solicitar esta acción al runtime de la misión.',
    },
    dataset: {missionAction: action, missionId: mission.id},
  });
}

function missionControlPanel(mission, nodes, room) {
  const status = upper(mission.status);
  const terminal = terminalStates.has(status) || !room.controls.runtimeActions.enabled;
  const paused = status === 'PAUSED';
  const pending = missionActionPending(mission.id) || missionDeliveryPending(mission.id);
  const exportControl = room.controls.export;
  const retryControl = room.controls.retryReview;
  const retryError = state.missionActionError?.missionId === mission.id && state.missionActionError?.action === 'retry-review'
    ? state.missionActionError.message
    : '';
  const controls = el('div', {className: 'mission-control-actions'}, [
    missionActionButton(mission, 'pause', {disabled: terminal || paused || missionDeliveryPending(mission.id), disabledReason: terminal
      ? room.controls.runtimeActions.reason || 'La misión ya está cerrada; no se puede pausar.'
      : paused ? 'La misión ya está pausada.' : 'Hay una recuperación de entrega en curso.',}),
    missionActionButton(mission, 'continue', {disabled: terminal || !paused || missionDeliveryPending(mission.id), disabledReason: terminal
      ? room.controls.runtimeActions.reason || 'La misión ya está cerrada; no se puede continuar.'
      : !paused ? 'Continuar sólo está disponible cuando el runtime confirmó PAUSED.' : 'Hay una recuperación de entrega en curso.',}),
    missionActionButton(mission, 'cancel', {disabled: terminal || missionDeliveryPending(mission.id), disabledReason: terminal
      ? room.controls.runtimeActions.reason || 'La misión ya está cerrada; no se puede cancelar.' : 'Hay una recuperación de entrega en curso.', danger: true}),
    missionDeliveryButton(mission),
    el('button', {
      className: 'quiet-button mission-export-button',
      text: 'Descargar JSON',
      attrs: {type: 'button', disabled: pending || !exportControl.enabled ? '' : undefined,
        title: pending ? 'Hay una acción de misión en curso.' : exportControl.enabled
          ? 'Descargar la proyección pública actual de esta misión.' : exportControl.reason},
      dataset: {missionExportId: mission.id},
    }),
  ]);
  const retryForm = el('form', {
    className: 'mission-retry-form',
    attrs: {'data-mission-retry-form': '', 'data-mission-id': mission.id},
  });
  retryForm.append(
    el('div', {className: 'mission-retry-grid'}, [
      el('label', {className: 'field'}, [
        el('span', 'Nodo de revisión'),
        el('input', {attrs: {name: 'retry-node', required: '', maxlength: 120, placeholder: 'ID del nodo de revisión', disabled: pending || !retryControl.enabled ? '' : undefined}}),
      ]),
      el('label', {className: 'field'}, [
        el('span', 'Justificación'),
        el('textarea', {attrs: {name: 'retry-reason', required: '', minlength: 20, maxlength: 4000, placeholder: 'Qué falló, qué evidencia nueva hay y qué debe revisar de otro modo.', disabled: pending || !retryControl.enabled ? '' : undefined}}),
      ]),
    ]),
    el('p', {className: 'mission-action-feedback', text: retryError, attrs: {role: 'alert', 'aria-live': 'polite'}}),
    el('button', {
      className: 'primary-button mission-retry-submit',
      text: pending && state.missionAction?.action === 'retry-review' ? 'Enviando…' : missionActionLabel('retry-review'),
      attrs: {type: 'submit', disabled: pending || !retryControl.enabled ? '' : undefined,
        title: pending ? 'Hay una acción de misión en curso.' : retryControl.enabled ? 'Solicitar un reintento de la revisión publicada.' : retryControl.reason},
    }),
  );
  return el('section', {className: 'mission-controls', attrs: {'aria-label': 'Controles de la misión'}}, [
    el('div', {className: 'mission-controls-head'}, [
      el('div', {}, [el('p', {className: 'eyebrow', text: 'CONTROL DE OPERADOR'}), el('h3', 'Acciones verificadas por runtime')]),
      labeledStatusPill('Ciclo', mission.status),
    ]),
    el('p', {className: 'mission-control-note', text: terminal
      ? room.controls.runtimeActions.reason || 'La misión está en un estado terminal; no se envían pausa, continuación ni cancelación. La descarga sigue disponible.'
      : 'Estos controles solicitan una acción al runtime; el estado no cambia en la interfaz hasta que la fábrica lo confirme.'}),
    controls,
    sourcedDeliveryStatus(mission),
    el('details', {className: 'mission-retry-details'}, [
      el('summary', 'Reintentar una revisión concreta'),
      el('p', {className: 'mission-retry-note', text: retryControl.enabled
        ? 'El reintento requiere el ID del nodo y una justificación de al menos 20 caracteres. La fábrica valida si ese reintento sigue siendo aplicable.'
        : retryControl.reason}),
      retryForm,
    ]),
  ]);
}

// A delivery belongs to the mission that produced it, not only to the vault.
// Keep the final answer in the inspection flow where the operator can compare
// it with its route, review and export record. The bytes are still read only
// through the existing hash-checked project-vault endpoint.
function missionFinalDeliveryPanel(mission) {
  const delivery = projectDeliverables().find(candidate => candidate.missionId === mission.id) ?? null;
  if (!delivery) return null;
  const preview = state.deliverablePreview?.id === delivery.id ? state.deliverablePreview : null;
  const body = typeof preview?.body === 'string' ? preview.body : null;
  const opened = body !== null;
  const hash = String(delivery.content?.sha256 || '');
  return el('section', {className: 'mission-final-delivery', attrs: {'aria-label': 'Respuesta final aceptada'}}, [
    el('div', {className: 'mission-final-delivery-head'}, [
      el('div', {}, [
        el('p', {className: 'eyebrow', text: 'RESULTADO FINAL'}),
        el('h3', 'Respuesta aceptada y sellada'),
      ]),
      labeledStatusPill('Entrega', 'AVAILABLE'),
    ]),
    el('p', {className: 'mission-final-delivery-note', text: opened
      ? 'Este es el cuerpo final recuperado desde la bóveda de este proyecto. El hash se vuelve a comprobar antes de una descarga explícita.'
      : 'La entrega final está disponible. Ábrela aquí para leer el mismo cuerpo sellado que se puede descargar desde la bóveda.'}),
    el('div', {className: 'mission-final-delivery-meta'}, [
      el('span', {text: formatBytes(delivery.content?.bytes)}),
      el('code', {text: 'SHA-256 ' + (hash ? hash.slice(0, 16) + '…' : 'no proyectado')}),
    ]),
    el('div', {className: 'mission-final-delivery-actions'}, [
      el('button', {
        className: opened ? 'quiet-button' : 'primary-button',
        text: opened ? 'Ocultar respuesta' : 'Abrir respuesta final',
        attrs: {type: 'button'},
        dataset: {missionDeliveryOpenId: delivery.id},
      }),
      el('button', {
        className: 'quiet-button', text: 'Descargar', attrs: {type: 'button'},
        dataset: {deliverableDownloadId: delivery.id},
      }),
    ]),
    opened ? el('div', {className: 'deliverable-preview mission-final-delivery-preview'}, [
      el('div', {className: 'deliverable-preview-head'}, [
        el('span', 'CONTENIDO ENTREGADO'),
        el('span', preview.browserHashVerified ? 'SHA-256 LOCAL VERIFICADO' : 'HASH VERIFICADO POR EL VAULT'),
      ]),
      el('pre', {text: body}),
    ]) : null,
  ]);
}

function renderMissionDetail() {
  const holder = $('#mission-detail');
  const detail = state.selectedMission;
  if (!detail) {
    holder.replaceChildren(el('div', {className: 'inspector-empty'}, [el('div', {className: 'empty-orb small'}), el('strong', 'Selecciona una misión'), el('p', 'El inspector carga sólo los recibos pertenecientes a este espacio.')]));
    return;
  }
  holder.replaceChildren();
  if (!detail.status?.ok) {
    holder.append(el('div', {className: 'inspector-empty'}, [el('strong', 'No se pudo leer esta misión'), el('p', detail.status?.error?.message || 'La fábrica no devolvió una proyección legible.')]));
    return;
  }
  const data = detail.status.data;
  const mission = object(data.mission);
  const missionIntent = missionIntentPresentation(mission.intent);
  const legacyContextHidden = Boolean(detail.legacyContextRedacted || missionIntent.legacyContextPack);
  const plan = object(data.plan);
  const report = detail.report?.ok ? object(detail.report.data) : null;
  const nodes = array(data.nodes);
  const mapping = activeMappings().find(candidate => candidate.missionId === mission.id) ?? {};
  const publicSourcedRoute = mappingUsesPublicSourcedRoute(mapping);
  const sourcedRouteProgress = publicSourcedRoute ? sourcedProgressForDetail(mission, report) : null;
  const queueJob = projectQueue().find(candidate => candidate.missionId === mission.id) ?? null;
  const controlRoom = missionControlRoom({
    mission,
    queueJob,
    nodes,
    plan,
    report,
    sourcedProgress: sourcedRouteProgress,
    isSourcedRoute: publicSourcedRoute,
    detailReady: detail.status?.ok === true,
    reportReady: detail.report?.ok === true,
  });
  const technicalProjection = missionTechnicalProjection({
    mission,
    plan,
    nodes,
    report,
    sourcedProgress: sourcedRouteProgress,
    isSourcedRoute: publicSourcedRoute,
    detailReady: detail.status?.ok === true,
    reportReady: detail.report?.ok === true,
    knownProviderModels: models(),
  });
  const attachmentReferences = array(mapping.assetReferences);
  const derivedTextInputs = array(report?.inputs?.files).filter(file => /^assets\/derived\/[a-f0-9]{48}\.txt$/i.test(String(file?.path || '')));
  const derivedInputPreparation = object(report?.inputs?.preparation);
  const head = el('div', {className: 'mission-detail-head'});
  append(head,
    el('div', {}, [
      el('p', {className: 'eyebrow', text: 'MISIÓN ' + displayId(mission.id)}),
      el('h2', missionIntent.intent || 'Mandato no proyectado'),
      legacyContextHidden ? legacyMissionContextNotice() : null,
      el('p', 'Política congelada y evidencia del runtime de este proyecto.'),
    ]),
    labeledStatusPill('Ciclo', mission.status),
  );
  const tabs = el('div', {className: 'mission-tabs', attrs: {role: 'tablist', 'aria-label': 'Vistas de la misión'}});
  const panels = {};
  const initialTab = selectedMissionTab(controlRoom);
  state.selectedMissionTab = initialTab;
  const tabSpecs = [['trace', 'Traza operativa'], ['summary', 'Resumen'], ['plan', 'Plan'], ['evidence', 'Evidencia'], ['technical', 'Ficha técnica']];
  for (const [id, label] of tabSpecs) {
    const availability = controlRoom.tabs[id];
    tabs.append(el('button', {
      className: 'mission-tab' + (id === initialTab ? ' active' : ''), text: label,
      attrs: {type: 'button', id: 'mission-tab-' + id, role: 'tab', 'aria-selected': String(id === initialTab),
        'aria-controls': 'mission-panel-' + id, tabindex: id === initialTab ? '0' : '-1',
        disabled: availability.enabled ? undefined : '', title: availability.enabled ? 'Abrir ' + label : availability.reason},
      dataset: {missionTab: id},
    }));
    panels[id] = el('div', {attrs: {id: 'mission-panel-' + id, role: 'tabpanel', 'aria-labelledby': 'mission-tab-' + id,
      hidden: id === initialTab ? null : ''}, dataset: {missionPanel: id}});
  }
  const controls = missionControlPanel(mission, nodes, controlRoom);
  const finalDelivery = missionFinalDeliveryPanel(mission);
  panels.trace.append(renderOperationalTrace({detail, data, mission, plan, nodes, report, mapping}));
  const summary = el('div', {className: 'detail-grid'});
  summary.append(
    detailBlock('Target congelado', el('ul', {}, [
      el('li', 'Modelo: ' + technicalProjection.policy.model),
      el('li', 'Razonamiento: ' + technicalProjection.policy.reasoningEffort),
      el('li', 'Presupuesto de intentos: ' + technicalProjection.policy.maxNodeAttempts),
    ])),
    detailBlock('Estado', el('ul', {}, publicSourcedRoute
      ? [
        el('li', 'Estado: ' + technicalProjection.status),
        el('li', 'Ruta: respuesta pública con fuentes; sin grafo de nodos.'),
        el('li', 'Fase: ' + technicalProjection.sourcedRoute.phase),
      ]
      : [
        el('li', 'Estado: ' + technicalProjection.status),
        el('li', 'Nodos proyectados: ' + technicalProjection.topology.nodes),
        el('li', 'Final: ' + text(technicalProjection.topology.finalNodeId, 'no proyectado')),
      ])),
    detailBlock('Límite de coste', publicCostDisplay(report)),
    detailBlock('Razonamiento de routing', publicSourcedRoute
      ? 'La ruta acotada no expone prompts ni razonamiento de routing. Sus límites y estado público están en la traza operativa.'
      : technicalProjection.topology.state === 'PUBLISHED'
        ? 'La fábrica publicó una topología verificable. El recorrido, los roles y los handoffs confirmados están en Plan y Traza operativa; los mensajes internos no se presentan como evidencia.'
        : 'La fábrica aún no publicó una topología verificable para explicar el routing.'),
    detailBlock('Archivos sellados', publicSourcedRoute
      ? 'Esta ruta no admite adjuntos y no recibe contexto privado del proyecto.'
      : attachmentReferences.length
      ? el('div', {}, [
        el('ul', {}, attachmentReferences.map(reference => {
          const asset = findProjectAsset(reference.id);
          return el('li', (asset?.filename || displayId(reference.id)) + ' · ' + formatBytes(reference.size) + ' · SHA-256 ' + String(reference.sha256).slice(0, 12));
        })),
        el('p', {className: 'surface-note', text: derivedTextInputs.length
          ? derivedTextInputs.length + ' copia(s) textual(es) opaca(s) quedaron admitidas como material de usuario no verificado. Preparación: ' + text(derivedInputPreparation.status, 'no proyectada') + '. La preparación no afirma que un agente las haya leído; las lecturas y revisiones reales aparecen en la traza operativa.'
          : report?.assets?.inspect === 'UNAVAILABLE_NO_CAPABILITY_BOUND_RESOLVER'
          ? 'La fábrica confirmó la presencia de estos originales, pero no dispone todavía de un lector o extractor de bytes con capacidad revisada.'
          : 'Estos originales se vinculan por identidad sellada. La interfaz no afirma que un agente los haya leído sin un recibo de capacidad y revisión.'}),
      ])
      : 'Esta misión no tiene archivos adjuntos.'),
  );
  panels.summary.append(summary);
  const planGrid = el('div', {className: 'detail-grid'});
  if (publicSourcedRoute) {
    planGrid.append(
      detailBlock('Topología', 'No aplica: la respuesta pública con fuentes no crea un grafo de nodos ni handoffs.'),
      detailBlock('Cierre de ruta', sourcedRouteProgress
        ? 'Fase ' + sourcedRouteProgress.phase + ' · revisión independiente ' + sourcedRouteProgress.independentReview.state + ' · entrega ' + sourcedRouteProgress.delivery.availability + '.'
        : 'La fábrica aún no publicó una ficha pública de cierre para esta ruta.'),
    );
  } else {
    planGrid.append(detailBlock('Requisitos', array(plan.requirements).length ? el('ul', {}, array(plan.requirements).map(req => el('li', req.text || req.title || req.id))) : 'No se proyectaron requisitos.'));
    planGrid.append(detailBlock('Nodos y roles', nodes.length ? el('ul', {}, nodes.map(node => el('li', text(node.title || node.id) + ' · ' + array(node.roles || node.spec?.roleIds).join(', ')))) : 'No se proyectaron nodos.'));
  }
  panels.plan.append(planGrid);
  const evidenceGrid = el('div', {className: 'detail-grid'});
  if (publicSourcedRoute) {
    evidenceGrid.append(
      detailBlock('Anclas de fuentes', sourcedRouteProgress
        ? el('ul', {}, [
          el('li', 'Anclas verificadas: ' + sourcedRouteProgress.verifiedSourceAnchorCount),
          el('li', 'Búsqueda acotada: ' + sourcedRouteProgress.acquisition.search.used + ' / ' + sourcedRouteProgress.acquisition.search.limit),
          el('li', 'Obtenciones completas: ' + sourcedRouteProgress.acquisition.fetch.used + ' / ' + sourcedRouteProgress.acquisition.fetch.limit),
        ])
        : 'La fábrica no publicó una ficha de fuentes verificable.'),
      detailBlock('Revisión independiente', sourcedRouteProgress
        ? 'Obligatoria · ' + sourcedRouteProgress.independentReview.state + '. Esta vista no expone URLs, cuerpos de fuentes, prompts ni razonamiento interno.'
        : 'No hay un recibo de revisión publicable.'),
    );
  } else {
    evidenceGrid.append(
      detailBlock('Fuentes', report ? (array(report.sources).length ? el('ul', {}, array(report.sources).map(source => el('li', publicEvidenceLabel(source, ['title', 'id'], 'Fuente pública sin rótulo')))) : 'No se registraron fuentes en el informe.') : 'No hay informe legible.'),
      detailBlock('Revisiones', report ? (array(report.reviews).length ? el('ul', {}, array(report.reviews).map(review => el('li', publicEvidenceLabel(review, ['status', 'decision', 'id'], 'Revisión pública sin estado')))) : 'No se registraron revisiones en el informe.') : 'No hay informe legible.'),
    );
  }
  panels.evidence.append(evidenceGrid);
  panels.technical.append(renderMissionTechnicalProjection(technicalProjection));
  holder.append(...[head, renderMissionControlRoom(controlRoom), controls, finalDelivery, tabs, ...Object.values(panels)].filter(Boolean));
}

function renderMemory() {
  if (!activeProject()) return;
  const project = activeProject();
  $('#memory-integrity').textContent = ['VERIFIED_HASH_CHAIN', 'VERIFIED_HMAC_ANCHOR'].includes(project.stats?.integrity) ? 'MEMORIA ANCLADA' : text(project.stats?.integrity);
  const contract = $('#vault-contract');
  contract.replaceChildren();
  const facts = [
    ['◈', 'Memoria canónica', 'Registro local por proyecto con hash encadenado y bloqueo ante integridad dañada.'],
    ['⌁', 'Conversaciones', 'Cada hilo pertenece a un único espacio; no hay búsqueda transversal.'],
    ['◇', 'Bóveda', 'Markdown compatible con Obsidian y contrato AGENTS.md de alcance estricto.'],
    ['◎', 'Graphify', 'Directorio separado por proyecto; sólo se muestra una proyección generada de forma explícita.'],
    ['↗', 'Factory state', 'Raíz --state-dir y workspaces separados para las misiones de este espacio.'],
  ];
  for (const [icon, title, description] of facts) {
    contract.append(el('div', {className: 'contract-row'}, [el('span', {className: 'contract-icon', text: icon}), el('div', {}, [el('strong', title), el('span', description)])]));
  }
  renderAssets();
  renderDeliverables();
  if (!$('#memory-results').childElementCount) empty($('#memory-results'), 'Busca memoria del espacio.', 'Los resultados mostrarán procedencia y hash local, nunca contenido de otro proyecto.');
}

function selectedAssets(scope) {
  const selected = new Set(assetIdsFor(scope));
  return projectAssets().filter(asset => selected.has(asset.id));
}

function assetAnalysisReadiness(asset) {
  const mediaType = String(asset?.mediaType || '').toLocaleLowerCase('en-US');
  if (!['text/plain', 'text/markdown', 'text/csv', 'application/json'].includes(mediaType)) {
    return 'Conservado en bóveda · sin extractor textual V1';
  }
  if (Number(asset?.size) > 256 * 1024) return 'Texto conservado · supera 256 KiB para análisis V1';
  return 'Texto candidato · se verifica y sella al admitir';
}

function renderAssetSelection(scope) {
  const holders = {
    mission: '#mission-attachment-list',
    composer: '#composer-attachment-list',
    home: '#home-command-attachment-list',
  };
  const holder = $(holders[scope] || holders.composer);
  if (!holder) return;
  const assets = selectedAssets(scope);
  const removeLabel = scope === 'mission' ? 'Quitar este archivo de la próxima misión' : 'Quitar este archivo del borrador de conversación';
  holder.replaceChildren();
  if (!assets.length) {
    holder.append(el('span', {className: 'attachment-empty', text: 'Sin archivos adjuntos'}));
    return;
  }
  for (const asset of assets) {
    const row = el('div', {className: 'attachment-chip'});
    append(row,
      el('span', {className: 'attachment-chip-copy'}, [
        el('strong', asset.filename),
        el('span', formatBytes(asset.size) + ' · ' + assetAnalysisReadiness(asset)),
      ]),
      el('button', {
        className: 'attachment-remove', text: '×',
        attrs: {type: 'button', title: removeLabel, 'aria-label': 'Quitar ' + asset.filename},
        dataset: {assetRemoveId: asset.id, assetScope: scope},
      }),
    );
    holder.append(row);
  }
}

function renderComposerAssetSelections() {
  renderAssetSelection('composer');
  renderAssetSelection('home');
}

function setAssetUploadStatus(message) {
  for (const selector of ['#asset-upload-status', '#home-command-upload-status']) {
    const target = $(selector);
    if (target) target.textContent = message;
  }
}

function renderAssets() {
  const holder = $('#vault-asset-list');
  const summary = $('#vault-asset-summary');
  if (!holder || !summary) return;
  const assets = projectAssets();
  const bytes = assets.reduce((total, asset) => total + (Number(asset.size) || 0), 0);
  summary.textContent = assets.length
    ? formatNumber(assets.length) + ' archivo(s) · ' + formatBytes(bytes) + ' sellados en este proyecto'
    : 'Aún no hay originales en la bóveda de este proyecto.';
  holder.replaceChildren();
  if (!assets.length) {
    empty(holder, 'Sin archivos todavía.', 'Sube un original para obtener su hash y guardarlo dentro de este proyecto. Los bytes no viajan en el mandato de una misión.');
    renderComposerAssetSelections();
    renderAssetSelection('mission');
    return;
  }
  for (const asset of assets) {
    const row = el('article', {className: 'vault-asset'});
    const meta = el('div', {className: 'vault-asset-meta'}, [
      el('strong', asset.filename),
      el('span', asset.mediaType + ' · ' + formatBytes(asset.size)),
      el('code', 'SHA-256 ' + String(asset.sha256).slice(0, 16) + '…'),
    ]);
    const actions = el('div', {className: 'vault-asset-actions'}, [
      el('button', {
        className: 'quiet-button', text: 'Descargar', attrs: {type: 'button'}, dataset: {assetDownloadId: asset.id},
      }),
      el('button', {
        className: 'primary-button', text: 'Adjuntar a misión', attrs: {type: 'button'}, dataset: {assetAttachId: asset.id},
      }),
    ]);
    row.append(meta, actions);
    holder.append(row);
  }
  renderComposerAssetSelections();
  renderAssetSelection('mission');
}

function renderDeliverables() {
  const holder = $('#vault-deliverable-list');
  const summary = $('#vault-deliverable-summary');
  if (!holder || !summary) return;
  const deliverables = projectDeliverables();
  summary.textContent = deliverables.length
    ? formatNumber(deliverables.length) + ' entrega(s) final(es) aceptada(s) y sellada(s) en este proyecto'
    : 'Aún no hay una entrega final aceptada para este proyecto.';
  holder.replaceChildren();
  if (!deliverables.length) {
    empty(holder, 'Sin entregas finales todavía.', 'Cuando una misión llegue a COMPLETED, podrás recuperar su producto aceptado desde el inspector. No se inventa una respuesta a partir del estado o del informe.');
    return;
  }
  for (const delivery of deliverables) {
    const preview = state.deliverablePreview?.id === delivery.id ? state.deliverablePreview : null;
    const row = el('article', {className: 'vault-deliverable' + (preview ? ' open' : '')});
    const meta = el('div', {className: 'vault-deliverable-meta'}, [
      el('div', {className: 'vault-deliverable-title'}, [
        el('strong', delivery.filename || ('Entrega ' + displayId(delivery.missionId))),
        pill('ACCEPTED'),
      ]),
      el('span', 'Misión ' + displayId(delivery.missionId) + ' · ' + formatDate(delivery.createdAt, {short: true})),
      el('span', formatBytes(delivery.content?.bytes) + ' · SHA-256 ' + String(delivery.content?.sha256 || '').slice(0, 16) + '…'),
      el('code', 'Artefacto ' + String(delivery.artifact?.id || 'no proyectado')),
    ]);
    const actions = el('div', {className: 'vault-deliverable-actions'}, [
      el('button', {
        className: 'quiet-button', text: preview ? 'Cerrar vista' : 'Abrir', attrs: {type: 'button'},
        dataset: {deliverableOpenId: delivery.id},
      }),
      el('button', {
        className: 'primary-button', text: 'Descargar', attrs: {type: 'button'},
        dataset: {deliverableDownloadId: delivery.id},
      }),
    ]);
    row.append(meta, actions);
    if (preview) {
      row.append(el('div', {className: 'deliverable-preview'}, [
        el('div', {className: 'deliverable-preview-head'}, [
          el('span', 'CONTENIDO ENTREGADO'),
          el('span', preview.browserHashVerified ? 'SHA-256 LOCAL VERIFICADO' : 'HASH VERIFICADO POR EL VAULT'),
        ]),
        el('pre', {text: preview.body}),
      ]));
    }
    holder.append(row);
  }
}

// A sealed delivery with no verified conversation link is visible, but never
// silently turned into a chat message. This makes historical/manual missions
// recoverable without fabricating intent, ownership or message chronology.
function renderDeliveryInbox() {
  const holder = $('#vault-inbox-list');
  const summary = $('#vault-inbox-summary');
  if (!holder || !summary) return;
  const items = projectDeliveryInbox();
  summary.textContent = items.length
    ? formatNumber(items.length) + ' entrega(s) sellada(s) no pertenecen a ningún hilo verificable. Puedes abrir su misión o producto; Sublimine no crea un chat retrospectivo.'
    : 'No hay entregas selladas fuera de un hilo verificable en este proyecto.';
  holder.replaceChildren();
  if (!items.length) {
    empty(holder, 'Buzón despejado.', 'Las entregas vinculadas llegan a su conversación; las misiones manuales conservan su producto en la bóveda sin inventar un historial de chat.');
    return;
  }
  for (const item of items) {
    const delivery = object(item.delivery);
    if (!delivery.id || !delivery.missionId) continue;
    const preview = state.deliverablePreview?.id === delivery.id ? state.deliverablePreview : null;
    const row = el('article', {className: 'vault-deliverable vault-inbox-deliverable' + (preview ? ' open' : '')}, [
      el('div', {className: 'vault-deliverable-meta'}, [
        el('div', {className: 'vault-deliverable-title'}, [
          el('strong', delivery.filename || ('Entrega ' + displayId(delivery.missionId))),
          pill('SELLADA · SIN HILO'),
        ]),
        el('span', 'Misión ' + displayId(delivery.missionId) + ' · ' + formatDate(delivery.createdAt, {short: true})),
        el('span', formatBytes(delivery.content?.bytes) + ' · SHA-256 ' + String(delivery.content?.sha256 || '').slice(0, 16) + '…'),
        el('code', 'No existe vínculo de conversación verificable'),
      ]),
      el('div', {className: 'vault-deliverable-actions'}, [
        el('button', {className: 'quiet-button', text: 'Abrir producto', attrs: {type: 'button'}, dataset: {deliverableOpenId: delivery.id}}),
        el('button', {className: 'quiet-button', text: 'Abrir misión', attrs: {type: 'button'}, dataset: {inboxMissionId: delivery.missionId}}),
        el('button', {className: 'primary-button', text: 'Descargar', attrs: {type: 'button'}, dataset: {deliverableDownloadId: delivery.id}}),
      ]),
    ]);
    if (preview) {
      row.append(el('div', {className: 'deliverable-preview'}, [
        el('div', {className: 'deliverable-preview-head'}, [
          el('span', 'CONTENIDO ENTREGADO'),
          el('span', preview.browserHashVerified ? 'SHA-256 LOCAL VERIFICADO' : 'HASH VERIFICADO POR EL VAULT'),
        ]),
        el('pre', {text: preview.body}),
      ]));
    }
    holder.append(row);
  }
}

function changeAssetSelection(scope, assetId, {selected = true} = {}) {
  if (!findProjectAsset(assetId)) return;
  const ids = assetIdsFor(scope).filter(id => id !== assetId);
  if (selected) {
    if (ids.length >= 16) { toast('Una misión admite como máximo 16 referencias de archivo.', 'error'); return; }
    ids.push(assetId);
  }
  setAssetIdsFor(scope, ids);
  if (scope === 'home' || scope === 'composer') renderComposerAssetSelections();
  else renderAssetSelection(scope);
}

async function refreshAssets(projectId = state.activeProjectId, {signal, selection = null} = {}) {
  if (!projectId) return [];
  const payload = await api('/api/projects/' + encodeURIComponent(projectId) + '/assets', {signal});
  if (state.activeProjectId !== projectId || (selection && !isLiveProjectSelection(selection))) return [];
  state.assets = array(payload.assets);
  state.composerAssetIds = state.composerAssetIds.filter(assetId => findProjectAsset(assetId));
  state.missionAssetIds = state.missionAssetIds.filter(assetId => findProjectAsset(assetId));
  renderAssets();
  return state.assets;
}

async function refreshDeliverables(projectId = state.activeProjectId, {signal, selection = null} = {}) {
  if (!projectId) return [];
  const payload = await api('/api/projects/' + encodeURIComponent(projectId) + '/deliverables', {signal});
  if (state.activeProjectId !== projectId || (selection && !isLiveProjectSelection(selection))) return [];
  state.deliverables = array(payload.deliverables);
  if (state.deliverablePreview && !findProjectDeliverable(state.deliverablePreview.id)) {
    state.deliverablePreview = null;
  }
  renderDeliverables();
  renderDeliveryInbox();
  return state.deliverables;
}

async function refreshDeliveryInbox(projectId = state.activeProjectId, {signal, selection = null} = {}) {
  if (!projectId) return [];
  const payload = await api('/api/projects/' + encodeURIComponent(projectId) + '/deliveries/inbox', {token: true, signal});
  if (state.activeProjectId !== projectId || (selection && !isLiveProjectSelection(selection))) return [];
  state.deliveryInbox = array(payload.items);
  renderDeliveryInbox();
  return state.deliveryInbox;
}

async function sha256Text(value) {
  if (!globalThis.crypto?.subtle?.digest) return null;
  const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

async function readProjectDeliverable(deliveryId) {
  const delivery = findProjectDeliverable(deliveryId);
  const projectId = state.activeProjectId;
  if (!delivery || !projectId) throw new Error('La entrega ya no pertenece al espacio activo. Actualiza la bóveda antes de abrirla.');
  const response = await fetch('/api/projects/' + encodeURIComponent(projectId) + '/deliverables/' + encodeURIComponent(deliveryId) + '/content', {
    headers: {'accept': 'text/plain', 'x-sovereign-ui-token': state.token || ''},
    credentials: 'same-origin',
    cache: 'no-store',
  });
  if (!response.ok) {
    throw await localConsoleResponseFailure(response, 'No se pudo abrir la entrega final.');
  }
  const body = await response.text();
  if (byteLength(body) !== Number(delivery.content?.bytes)) {
    throw new Error('La entrega descargada no coincide con el tamaño sellado. No se mostrará.');
  }
  const browserHash = await sha256Text(body);
  if (browserHash && browserHash !== String(delivery.content?.sha256 || '').toLowerCase()) {
    throw new Error('La entrega descargada no coincide con su hash sellado. No se mostrará.');
  }
  return {delivery, body, browserHashVerified: Boolean(browserHash)};
}

async function openProjectDeliverable(deliveryId) {
  if (state.deliverablePreview?.id === deliveryId) {
    state.deliverablePreview = null;
    renderDeliverables();
    renderDeliveryInbox();
    return;
  }
  try {
    const opened = await readProjectDeliverable(deliveryId);
    state.deliverablePreview = {id: deliveryId, body: opened.body, browserHashVerified: opened.browserHashVerified};
    renderDeliverables();
    renderDeliveryInbox();
  } catch (error) {
    toast(error.message || 'No se pudo abrir la entrega final.', 'error');
  }
}

async function openMissionDeliverable(deliveryId) {
  const missionId = state.selectedMissionId;
  const projectId = state.activeProjectId;
  const delivery = findProjectDeliverable(deliveryId);
  if (!missionId || !projectId || !delivery || delivery.missionId !== missionId) {
    toast('La entrega ya no pertenece a la misión abierta. Actualiza el proyecto antes de volver a intentarlo.', 'error');
    return;
  }
  if (state.deliverablePreview?.id === deliveryId) {
    state.deliverablePreview = null;
    renderMissions();
    return;
  }
  try {
    const opened = await readProjectDeliverable(deliveryId);
    if (state.activeProjectId !== projectId || state.selectedMissionId !== missionId) return;
    state.deliverablePreview = {id: deliveryId, body: opened.body, browserHashVerified: opened.browserHashVerified};
    renderMissions();
  } catch (error) {
    toast(error.message || 'No se pudo abrir la respuesta final en esta misión.', 'error');
  }
}

async function openConversationDelivery(deliveryId, missionId) {
  const projectId = state.activeProjectId;
  if (!projectId || !deliveryId || !missionId || !hasActiveProjectMission(missionId)) {
    toast('La entrega verificada ya no pertenece al espacio activo.', 'error');
    return;
  }
  try {
    await refreshDeliverables(projectId);
    if (state.activeProjectId !== projectId) return;
    await selectMission(missionId);
    if (state.activeProjectId !== projectId || state.selectedMissionId !== missionId) return;
    switchView('missions');
    await openMissionDeliverable(deliveryId);
  } catch (error) {
    toast(error.message || 'No se pudo abrir la entrega sellada desde la conversación.', 'error');
  }
}

async function downloadProjectDeliverable(deliveryId) {
  try {
    const opened = await readProjectDeliverable(deliveryId);
    const link = document.createElement('a');
    const objectUrl = URL.createObjectURL(new Blob([opened.body], {type: opened.delivery.content?.mediaType || 'text/plain; charset=utf-8'}));
    link.href = objectUrl;
    link.download = opened.delivery.filename || ('sublimine-' + displayId(opened.delivery.missionId) + '.txt');
    link.hidden = true;
    document.body.append(link);
    link.click();
    link.remove();
    // Some Chromium WebViews start the download after the current task.  A
    // zero-delay revoke can therefore make a successful HTTP read look like a
    // dead download button. Keep this browser-local URL for the same bounded
    // period as the signed JSON export; it is never sent back to the console.
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), exportObjectUrlRetentionMs);
    toast('Entrega final descargada' + (opened.browserHashVerified ? ' tras verificar su hash local.' : '.'));
  } catch (error) {
    toast(error.message || 'No se pudo descargar la entrega final.', 'error');
  }
}

async function sha256File(file) {
  if (!globalThis.crypto?.subtle?.digest) throw new Error('Este navegador no ofrece SHA-256 local para verificar el archivo antes de subirlo.');
  const buffer = await file.arrayBuffer();
  const digest = await globalThis.crypto.subtle.digest('SHA-256', buffer);
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

function assetMediaTypeForUpload(file) {
  const declared = String(file?.type || '').trim().toLocaleLowerCase('en-US').split(';', 1)[0];
  if (['text/plain', 'text/markdown', 'text/csv', 'application/json'].includes(declared)) return declared;
  if (declared === 'text/x-markdown') return 'text/markdown';
  // Some browsers report an empty type (or application/octet-stream) for
  // Markdown/CSV/JSON despite the local filename being all the operator has
  // selected. This is only upload metadata; the server still verifies bytes,
  // signatures, UTF-8 and the sealed mission snapshot before analysis.
  if (!declared || declared === 'application/octet-stream') {
    const name = String(file?.name || '').toLocaleLowerCase('en-US');
    if (name.endsWith('.md') || name.endsWith('.markdown')) return 'text/markdown';
    if (name.endsWith('.csv')) return 'text/csv';
    if (name.endsWith('.json')) return 'application/json';
    if (name.endsWith('.txt')) return 'text/plain';
  }
  return declared || 'application/octet-stream';
}

async function uploadProjectAsset(file) {
  if (!activeProject()) throw new Error('Selecciona un espacio antes de subir un archivo.');
  if (!(file instanceof File) || !file.size) throw new Error('El archivo está vacío o no es válido.');
  if (file.size > 64 * 1024 * 1024) throw new Error('Cada archivo puede ocupar como máximo 64 MiB.');
  const projectId = state.activeProjectId;
  const mediaType = assetMediaTypeForUpload(file);
  const hash = await sha256File(file);
  if (state.activeProjectId !== projectId) throw new Error('El espacio cambió mientras se verificaba el archivo. Vuelve a intentarlo.');
  const reservation = await api('/api/projects/' + encodeURIComponent(projectId) + '/assets/reservations', {
    method: 'POST', token: true, body: {filename: file.name, mediaType, size: file.size, sha256: hash},
  });
  if (state.activeProjectId !== projectId) throw new Error('El espacio cambió antes de iniciar la subida.');
  const response = await fetch(reservation.upload.url, {
    method: 'PUT',
    headers: {'content-type': mediaType, 'x-sovereign-ui-token': state.token || ''},
    body: file,
    credentials: 'same-origin',
    cache: 'no-store',
  });
  if (!response.ok) throw await localConsoleResponseFailure(response, 'La bóveda no pudo aceptar el archivo.');
  let payload = {};
  try { payload = await response.json(); } catch { /* handled below */ }
  return payload.asset;
}

async function uploadFiles(files, scope = null) {
  const queue = [...(files || [])];
  if (!queue.length || state.assetUpload.active) return;
  const projectId = state.activeProjectId;
  state.assetUpload = {active: true, scope, files: queue.map(file => file.name)};
  setAssetUploadStatus('Preparando ' + formatNumber(queue.length) + ' archivo(s): hash local y subida verificada dentro de la frontera local…');
  try {
    const uploadedIds = [];
    for (const file of queue) {
      setAssetUploadStatus('Verificando y subiendo “' + file.name + '”…');
      const asset = await uploadProjectAsset(file);
      if (state.activeProjectId !== projectId) throw new Error('El espacio cambió durante la subida.');
      uploadedIds.push(asset.id);
    }
    await refreshAssets(projectId);
    if (scope) {
      for (const assetId of uploadedIds) changeAssetSelection(scope, assetId);
    }
    toast(queue.length === 1 ? 'Archivo sellado en la bóveda del proyecto.' : formatNumber(queue.length) + ' archivos sellados en la bóveda del proyecto.');
  } catch (error) {
    toast(error.message || 'No se pudo subir el archivo.', 'error');
  } finally {
    state.assetUpload = {active: false, scope: null, files: []};
    setAssetUploadStatus('Los originales se guardan con hash y quedan aislados dentro de este proyecto.');
  }
}

async function downloadProjectAsset(assetId) {
  const asset = findProjectAsset(assetId);
  if (!asset || !state.activeProjectId) { toast('El archivo ya no pertenece al espacio activo.', 'error'); return; }
  try {
    const response = await fetch('/api/projects/' + encodeURIComponent(state.activeProjectId) + '/assets/' + encodeURIComponent(assetId) + '/original', {
      headers: {'x-sovereign-ui-token': state.token || ''}, credentials: 'same-origin', cache: 'no-store',
    });
    if (!response.ok) {
      throw await localConsoleResponseFailure(response, 'No se pudo descargar el original.');
    }
    const link = document.createElement('a');
    const objectUrl = URL.createObjectURL(await response.blob());
    link.href = objectUrl;
    link.download = asset.filename;
    link.hidden = true;
    document.body.append(link);
    link.click();
    link.remove();
    // See downloadProjectDeliverable(): embedded Chromium can defer consuming
    // an object URL until after this click handler returns.
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), exportObjectUrlRetentionMs);
    toast('Descarga del original iniciada.');
  } catch (error) { toast(error.message || 'No se pudo descargar el original.', 'error'); }
}

function renderRoles() {
  const groups = roleGroups();
  $('#roles-note').textContent = state.roles.length
    ? formatNumber(state.roles.length) + ' fichas de rol disponibles. Esto es un catálogo, no ' + formatNumber(state.roles.length) + ' agentes ejecutándose.'
    : 'El catálogo no respondió todavía.';
  const groupHolder = $('#role-groups');
  groupHolder.replaceChildren();
  for (const group of ['all', ...Object.keys(groups).sort()]) {
    groupHolder.append(el('button', {
      className: 'role-group' + (group === state.roleGroup ? ' active' : ''),
      text: group === 'all' ? 'Todos · ' + state.roles.length : group + ' · ' + groups[group],
      attrs: {type: 'button'},
      dataset: {roleGroup: group},
    }));
  }
  const query = state.roleQuery.trim().toLocaleLowerCase('es');
  const grid = $('#role-grid');
  grid.replaceChildren();
  const roles = state.roles.filter(role => {
    const group = String(role.id ?? '').split('_')[0] || 'otros';
    const haystack = [role.id, role.title, ...array(role.canonicalCapabilities)].join(' ').toLocaleLowerCase('es');
    return (state.roleGroup === 'all' || group === state.roleGroup) && (!query || haystack.includes(query));
  });
  if (!roles.length) {
    empty(grid, 'No hay coincidencias.', 'Ajusta la búsqueda o el dominio.');
  } else {
    for (const role of roles) {
      const button = el('button', {
        className: 'role-card' + (role.id === state.selectedRoleId ? ' active' : ''),
        attrs: {type: 'button'},
        dataset: {roleId: role.id},
      });
      append(button,
        el('span', {className: 'role-id', text: role.id}),
        el('strong', role.title || role.id),
        el('p', array(role.canonicalCapabilities).join(' · ') || 'Sin capacidad canónica proyectada'),
      );
      grid.append(button);
    }
  }
  renderRoleDetail();
}

function detailValue(value) {
  if (Array.isArray(value)) return el('ul', {}, value.map(entry => el('li', typeof entry === 'string' ? entry : JSON.stringify(entry))));
  if (value && typeof value === 'object') return jsonBlock(value);
  return el('p', text(value));
}

function renderRoleDetail() {
  const holder = $('#role-detail');
  holder.replaceChildren();
  const role = state.selectedRole?.role;
  if (!role) {
    holder.append(el('div', {className: 'inspector-empty'}, [el('strong', 'Elige un rol'), el('p', 'La ficha se consulta desde el catálogo de fábrica. Un rol no equivale a un agente activo.')]));
    return;
  }
  append(holder, el('p', {className: 'role-id', text: role.id}), el('h2', role.title || role.id), pill(role.status || 'Registrado'));
  const fields = [
    ['Propósito', role.purpose], ['Activación', role.activation], ['Capacidades', role.canonicalCapabilities],
    ['Contrato de entrada', role.inputContract], ['Contrato de salida', role.outputContract], ['Independencia', role.independence],
    ['Límites', role.limitations], ['Acciones prohibidas', role.forbiddenActions], ['Criterio de terminación', role.completion],
    ['Recuperación', role.failureRecovery], ['Métodos', role.methods],
  ];
  for (const [heading, value] of fields) {
    if (value === undefined || value === null || (Array.isArray(value) && !value.length)) continue;
    holder.append(el('section', {className: 'role-detail-section'}, [el('h3', heading), detailValue(value)]));
  }
}

function renderSystem() {
  const project = activeProject();
  if (!project) return;
  const policy = object(project.modelPolicy);
  const factoryDefault = factoryMissionDefault();
  const resolvedModel = policy.model || factoryDefault.model || 'Sin target confirmado';
  const resolvedEffort = policy.effort || (policy.model ? 'Se resolverá al admitir' : (factoryDefault.effort || 'Sin target confirmado'));
  $('#policy-status').textContent = policy.model ? 'FIJADA' : 'HEREDADA';
  $('#policy-status').className = 'status-pill ' + (policy.model ? 'success' : 'warning');
  const detail = $('#model-policy-detail');
  detail.replaceChildren(
    policyCell('Modelo para próxima admisión', resolvedModel),
    policyCell('Razonamiento para próxima admisión', resolvedEffort),
    policyCell('Admisión', policy.admission || 'mission-snapshot-v1'),
    policyCell('Routing actual', policy.roleRouting || 'factory-mission-policy-v2'),
  );
  const provider = pathValue(state.overview, 'provider.data.provider', {});
  $('#provider-state').textContent = provider.ready ? 'PROVEEDOR LISTO' : 'SIN CONFIRMACIÓN';
  const inventory = $('#model-inventory');
  inventory.replaceChildren();
  if (!models().length) {
    inventory.append(el('p', {text: 'El proveedor no proyectó un catálogo de modelos.'}));
  } else {
    for (const model of models()) {
      inventory.append(el('div', {className: 'model-row'}, [
        el('strong', model.id || model.model),
        el('span', array(model.supportedReasoningEfforts).join(' · ') || 'esfuerzo no proyectado'),
      ]));
    }
  }
  const targets = $('#execution-targets');
  targets.replaceChildren();
  const routing = object(executionTargets().missionRoleRouting);
  const inherited = array(executionTargets().inheritedFacilities);
  const pinned = array(executionTargets().pinnedFacilities);
  if (!factoryDefault.model) {
    targets.append(el('p', {className: 'execution-target-note', text: 'La fábrica no proyectó aún sus destinos de ejecución.'}));
    return;
  }
  targets.append(el('div', {className: 'execution-target'}, [
    el('strong', 'Default de Factory'),
    el('span', factoryDefault.model + ' · ' + factoryDefault.effort),
    el('p', 'Se usa cuando el espacio hereda. Al admitir una misión, el target exacto queda sellado.'),
  ]));
  for (const facility of inherited) {
    const fallback = object(facility.historicalFallback);
    const inheritsMissionTarget = facility.targetBinding === 'MISSION_FROZEN_TARGET';
    const fallbackLabel = fallback.model
      ? ' Respaldo histórico sin target sellado: ' + fallback.model + ' · ' + text(fallback.effort) + '.'
      : '';
    targets.append(el('div', {className: 'execution-target'}, [
      el('strong', facility.id || 'Facilidad heredada'),
      el('span', inheritsMissionTarget ? 'HEREDADO · TARGET SELLADO' : 'HERENCIA NO VERIFICADA'),
      el('p', (facility.scope || 'La facilidad hereda el target sellado de la misión.') + fallbackLabel),
    ]));
  }
  for (const target of pinned) {
    targets.append(el('div', {className: 'execution-target'}, [
      el('strong', target.id || 'Facilidad controlada'),
      el('span', text(target.model) + ' · ' + text(target.effort)),
      el('p', target.scope || 'Target de infraestructura declarado por Factory.'),
    ]));
  }
  if (routing.scope) targets.append(el('p', {className: 'execution-target-note', text: routing.scope}));
}

function policyCell(label, value) { return el('div', {className: 'policy-cell'}, [el('span', label), el('strong', value)]); }

function renderInspector() {
  const project = activeProject();
  if (!project) return;
  const policy = object(project.modelPolicy);
  const factoryDefault = factoryMissionDefault();
  $('#inspector-project').replaceChildren(
    el('span', {className: 'project-avatar', text: initial(project.name)}),
    el('div', {}, [el('strong', project.name), el('p', project.client || 'Espacio privado')]),
  );
  $('#inspector-policy').replaceChildren(
    el('strong', policy.model || factoryDefault.model || 'Predeterminado de fábrica'),
    el('span', (policy.effort || (policy.model ? 'Se resuelve al admitir' : factoryDefault.effort) || 'Sin target confirmado') + ' · target congelado al admitir'),
  );
  const boundary = $('#inspector-boundary');
  boundary.replaceChildren(...[
    ['Memoria', 'Sólo este proyecto'], ['Bóveda', 'Obsidian aislado'], ['Graphify', 'Raíz separada'], ['Factory state', '—state-dir privado'],
  ].map(([label, value]) => el('div', {className: 'boundary-line'}, [el('span', label), el('strong', value)])));
  const stats = object(project.stats);
  $('#inspector-budget').replaceChildren(
    el('div', {className: 'budget-line'}, [el('span', 'Coste'), el('strong', 'NOT_ATTESTED')]),
    el('div', {className: 'budget-line'}, [el('span', 'Memoria'), el('strong', formatNumber(stats.memoryEntries || 0) + ' entradas')]),
    el('div', {className: 'budget-line'}, [el('span', 'Misiones'), el('strong', formatNumber(stats.missions || 0))]),
  );
  const runtime = object(state.project.runtime);
  const runtimeStartFailure = runtimeStartFailureFor(project.id);
  $('#inspector-runtime').replaceChildren(...[
    el('div', {className: 'runtime-line'}, [el('span', 'Estado'), el('strong', runtimeStartFailure?.state || runtime.state || '—')]),
    el('div', {className: 'runtime-line'}, [el('span', 'Cola'), el('strong', formatNumber(array(runtime.queue).length))]),
    el('div', {className: 'runtime-line'}, [el('span', 'Integridad'), el('strong', stats.integrity || '—')]),
    runtimeStartFailure ? el('div', {className: 'runtime-line'}, [el('span', 'Arranque'), el('strong', runtimeStartFailure.code)]) : null,
  ].filter(Boolean));
}

function renderAll() {
  renderShell();
  if (!activeProject()) return;
  renderHome();
  renderOperations();
  renderConversation();
  renderMissions();
  renderMemory();
  renderDeliveryInbox();
  renderRoles();
  renderSystem();
  renderInspector();
  switchView(state.activeView, {silent: true});
}

function renderOperations() {
  const holder = $('#operations-room');
  if (!holder) return;
  const project = activeProject();
  if (!project) {
    holder.replaceChildren();
    return;
  }
  const operationsInput = {
    project,
    runtime: state.project?.runtime,
    mappings: activeMappings(),
    deliverables: projectDeliverables(),
    selectedMission: state.selectedMission,
    deliveryReconciliation: state.project?.deliveryReconciliation,
    titleForMission: missionId => state.missionTitles.get(missionId) ?? null,
  };
  // Both views are independently derived from the same already-public
  // projection.  The observatory is a read-only visual companion, never a
  // second runtime or an inference layer over private mission material.
  const operationsProjection = publicOperationsProjection(operationsInput);
  holder.replaceChildren(
    renderOperationsRoom(operationsInput),
    renderOfficeObservatory(operationsProjection),
  );
}

function switchView(view, {silent = false} = {}) {
  if (!activeProject()) {
    if (!silent) openDialog('project-dialog');
    return;
  }
  const views = new Set(['home', 'operations', 'conversation', 'missions', 'memory', 'agents', 'system']);
  if (!views.has(view)) return;
  state.activeView = view;
  for (const panel of $$('[data-view-panel]')) {
    const active = panel.dataset.viewPanel === view;
    panel.hidden = !active;
    panel.classList.toggle('active', active);
  }
  for (const link of $$('.nav-link')) link.classList.toggle('active', link.dataset.view === view);
  $('#rail').classList.remove('open');
  $('#mobile-scrim').classList.remove('visible');
  $('#mobile-scrim').hidden = true;
}

function openDialog(id) {
  const dialog = $('#' + id);
  if (typeof dialog.showModal === 'function') dialog.showModal();
  else dialog.setAttribute('open', '');
}

function closeDialog(id) {
  const dialog = $('#' + id);
  if (typeof dialog.close === 'function') dialog.close();
  else dialog.removeAttribute('open');
}

async function reloadProjects() {
  const payload = await api('/api/projects');
  state.projects = array(payload.projects);
}

function ownsProjectSelection(selection) {
  return state.projectSelection === selection && state.activeProjectId === selection.projectId;
}

function isLiveProjectSelection(selection) {
  return ownsProjectSelection(selection) && !selection.controller.signal.aborted;
}

function finishProjectSelection(selection) {
  if (!ownsProjectSelection(selection)) return;
  if (selection.timeout !== null) window.clearTimeout(selection.timeout);
  selection.timeout = null;
}

function beginProjectSelection(projectId) {
  const previous = state.projectSelection;
  if (previous.timeout !== null) window.clearTimeout(previous.timeout);
  previous.controller?.abort();
  const controller = new AbortController();
  const selection = {
    generation: previous.generation + 1,
    projectId,
    controller,
    timeout: null,
    timedOut: false,
  };
  selection.timeout = window.setTimeout(() => {
    // Fetch has no browser-level deadline. Keep the project shell honest when
    // a local CLI read or an exhausted connection pool would otherwise leave
    // it permanently in “Abriendo espacio”.
    selection.timedOut = true;
    controller.abort();
  }, projectSelectionTimeoutMs);
  state.projectSelection = selection;
  return selection;
}

async function selectProject(projectId, {preserveConversation = false, preserveMission = false} = {}) {
  if (!projectId) return;
  // A manual refresh reloads the same isolated project. Preserve only the
  // selected mission identity across that bounded reload; the old detail is
  // deliberately discarded and re-read below, so no stale runtime receipt is
  // kept on screen. Project switches never carry a selected mission across.
  const projectBeforeReload = state.activeProjectId;
  const selectedMissionBeforeReload = state.selectedMissionId;
  const selection = beginProjectSelection(projectId);
  stopMessageSpeech();
  state.activeProjectId = projectId;
  state.project = null;
  state.projectLoading = true;
  state.assets = [];
  state.deliverables = [];
  state.deliveryInbox = [];
  state.deliverablePreview = null;
  state.deliveryAction = null;
  state.composerAssetIds = [];
  state.missionAssetIds = [];
  state.selectedMission = null;
  state.selectedMissionId = null;
  state.selectedMissionTab = 'trace';
  if (projectBeforeReload !== projectId) state.missionTitles.clear();
  state.missionStatusRefresh = null;
  state.projectReadRefresh = null;
  if (!preserveConversation) {
    state.selectedConversationId = null;
    state.messages = [];
  }
  renderShell();
  try {
    const payload = await api('/api/projects/' + encodeURIComponent(projectId), {signal: selection.controller.signal});
    if (!isLiveProjectSelection(selection)) return;
    state.project = payload;
    if (upper(payload?.runtime?.state) === 'ACTIVE') clearRuntimeStartFailure(projectId);
    state.projectLoading = false;
    rememberProject(projectId);
    try {
      await refreshAssets(projectId, {signal: selection.controller.signal, selection});
    } catch (assetError) {
      if (isLiveProjectSelection(selection)) {
        state.assets = [];
        toast('No se pudo cargar el vault de archivos: ' + (assetError.message || 'error desconocido') + '.', 'error');
      }
    }
    if (!isLiveProjectSelection(selection)) return;
    try {
      await refreshDeliverables(projectId, {signal: selection.controller.signal, selection});
    } catch (deliverableError) {
      if (isLiveProjectSelection(selection)) {
        state.deliverables = [];
        toast('No se pudo cargar las entregas del proyecto: ' + (deliverableError.message || 'error desconocido') + '.', 'error');
      }
    }
    if (!isLiveProjectSelection(selection)) return;
    try {
      await refreshDeliveryInbox(projectId, {signal: selection.controller.signal, selection});
    } catch (inboxError) {
      if (isLiveProjectSelection(selection)) {
        state.deliveryInbox = [];
        toast('No se pudo cargar el buzón de entregas: ' + (inboxError.message || 'error desconocido') + '.', 'error');
      }
    }
    if (!isLiveProjectSelection(selection)) return;
    const conversations = activeConversations();
    const next = preserveConversation && conversations.some(item => item.id === state.selectedConversationId)
      ? state.selectedConversationId
      : conversations[0]?.id ?? null;
    state.selectedConversationId = next;
    if (next) await loadConversation(next, {skipRender: true, signal: selection.controller.signal, selection});
    if (!isLiveProjectSelection(selection)) return;
    // A mission may have been removed from the project while the snapshot was
    // loading. Restore only an identity still owned by this exact project;
    // otherwise leave the cleared inspector rather than rendering old detail.
    const retainedMissionId = missionSelectionAfterProjectReload({
      preserveMission,
      previousProjectId: projectBeforeReload,
      projectId,
      selectedMissionId: selectedMissionBeforeReload,
      mappings: activeMappings(),
    });
    if (!isLiveProjectSelection(selection)) return;
    renderAll();
    hideNotice();
    // The project shell is now complete. A retained mission has its own
    // bounded detail read and must not keep the project-opening deadline alive.
    finishProjectSelection(selection);
    if (retainedMissionId && isLiveProjectSelection(selection)) await selectMission(retainedMissionId);
  } catch (error) {
    if (!ownsProjectSelection(selection)) return;
    state.project = null;
    state.projectLoading = false;
    clearProjectPreference();
    renderShell();
    if (selection.timedOut) {
      showNotice('El espacio tardó demasiado en responder. No se mostrará información parcial; vuelve a actualizarlo cuando el runtime local esté disponible.');
    } else if (!selection.controller.signal.aborted) {
      showNotice('No se pudo abrir el espacio: ' + error.message);
    }
  } finally {
    finishProjectSelection(selection);
  }
}

async function loadConversation(conversationId, {skipRender = false, signal, selection = null} = {}) {
  if (!activeProject() || !conversationId) return;
  stopMessageSpeech();
  const projectId = state.activeProjectId;
  state.selectedConversationId = conversationId;
  state.messages = [];
  if (!skipRender) renderConversation();
  try {
    const payload = await api('/api/projects/' + encodeURIComponent(projectId) + '/conversations/' + encodeURIComponent(conversationId) + '/messages', {signal});
    if (state.activeProjectId !== projectId || state.selectedConversationId !== conversationId || (selection && !isLiveProjectSelection(selection))) return;
    state.messages = array(payload.messages);
    renderConversation();
  } catch (error) {
    if (state.activeProjectId === projectId && state.selectedConversationId === conversationId && (!selection || isLiveProjectSelection(selection))) {
      empty($('#message-list'), 'No se pudo abrir el hilo.', error.message);
    }
  }
}

async function refresh({quiet = false} = {}) {
  if (state.refreshing) return;
  state.refreshing = true;
  $('#refresh-button').disabled = true;
  try {
    const [overview] = await Promise.all([api('/api/overview?fresh=1'), reloadProjects()]);
    state.overview = overview;
    if (state.activeProjectId) await selectProject(state.activeProjectId, {preserveConversation: true, preserveMission: true});
    else renderShell();
    setLiveStatus('Actualizado', 'connected');
    hideNotice();
    if (!quiet) toast('Estado actualizado desde la fábrica y el espacio activo.');
  } catch (error) {
    setLiveStatus('Sin conexión', 'error');
    showNotice('No se pudo actualizar la consola: ' + error.message);
    if (!quiet) toast(error.message, 'error');
  } finally {
    state.refreshing = false;
    $('#refresh-button').disabled = false;
  }
}

function populateModels(select, {selected = '', defaultLabel = 'Predeterminado de fábrica'} = {}) {
  const current = selected || select.value;
  select.replaceChildren(el('option', {text: defaultLabel, attrs: {value: ''}}));
  for (const model of models()) {
    const id = model.id || model.model;
    select.append(el('option', {text: id, attrs: {value: id}}));
  }
  select.value = [...select.options].some(option => option.value === current) ? current : '';
}

function populateEfforts(select, modelId, {selected = '', defaultLabel = 'Se resolverá al admitir'} = {}) {
  const current = selected || select.value;
  select.replaceChildren(el('option', {text: defaultLabel, attrs: {value: ''}}));
  const model = models().find(item => (item.id || item.model) === modelId);
  const allowed = model ? array(model.supportedReasoningEfforts) : [];
  for (const effort of allowed) select.append(el('option', {text: effort.toUpperCase(), attrs: {value: effort}}));
  select.disabled = !modelId;
  select.value = allowed.includes(current) ? current : '';
}

function configureMissionOverrideEffort() {
  const modelId = $('#mission-model').value;
  const hasOverride = Boolean(modelId);
  $('#mission-effort-label').textContent = 'Override de razonamiento';
  $('#mission-effort-note').textContent = hasOverride
    ? 'Sin esfuerzo explícito, la admisión sellará el default verificado del proveedor para este modelo. No hereda el esfuerzo del espacio.'
    : 'Sin override de modelo, se usa la política del espacio; el control queda desactivado.';
  populateEfforts($('#mission-effort'), modelId, {
    defaultLabel: hasOverride ? 'Default del proveedor al admitir' : 'Política del espacio',
  });
}

function configureModelForms() {
  populateModels($('#project-model'));
  populateEfforts($('#project-effort'), $('#project-model').value);
  populateModels($('#mission-model'), {defaultLabel: 'Política del espacio'});
  configureMissionOverrideEffort();
  const policy = object(activeProject()?.modelPolicy);
  populateModels($('#policy-model'), {selected: policy.model || ''});
  populateEfforts($('#policy-effort'), $('#policy-model').value, {selected: policy.effort || ''});
}

function updateMissionForm() {
  const bytes = byteLength($('#mission-text').value);
  $('#mission-count-text').textContent = formatNumber(bytes) + ' / 262.144 bytes';
  const entry = $('#mission-entry-mode').value;
  const preset = $('#mission-preset');
  const v3 = [...preset.options].find(option => option.value === 'adaptive-v3');
  const permitsV3 = entry === 'planned' || entry === 'closed-response-v3';
  if (v3) v3.disabled = !permitsV3;
  if (entry === 'closed-response-v3') { preset.value = 'adaptive-v3'; preset.disabled = true; }
  else { preset.disabled = false; if (!permitsV3 && preset.value === 'adaptive-v3') preset.value = 'adaptive-v2'; }
}

function updateComposerCount() { $('#composer-count').textContent = formatNumber(byteLength($('#composer-text').value)) + ' / 262.144 bytes'; }

function continueFromHomeCommand(event) {
  event.preventDefault();
  if (!activeProject()) return;
  if (state.assetUpload.active) {
    toast('Espera a que la verificación de los archivos termine antes de continuar.', 'error');
    return;
  }
  const source = $('#home-command-text');
  const draft = source.value.trim();
  const hasFiles = state.composerAssetIds.length > 0;
  if (!draft && !hasFiles) {
    toast('Escribe una petición o adjunta al menos un archivo para preparar la conversación.', 'error');
    return;
  }
  const composer = $('#composer-text');
  if (draft) {
    const existing = composer.value.trim();
    composer.value = existing ? existing + '\n\n' + draft : draft;
  }
  source.value = '';
  updateComposerCount();
  renderComposerAssetSelections();
  switchView('conversation');
  window.requestAnimationFrame(() => composer.focus());
  toast(hasFiles
    ? 'Borrador y archivos preparados en la conversación de este espacio.'
    : 'Borrador preparado en la conversación de este espacio.');
}

function openProjectDialog() {
  $('#project-form').reset();
  $('#project-form-error').textContent = '';
  configureModelForms();
  openDialog('project-dialog');
  $('#project-name').focus();
}

function openProjectIdentityDialog() {
  const project = activeProject();
  if (!project) return;
  $('#project-identity-form').reset();
  $('#project-identity-error').textContent = '';
  $('#project-identity-name').value = project.name || '';
  openDialog('project-identity-dialog');
  $('#project-identity-name').focus();
  $('#project-identity-name').select();
}

function openMissionDialog({prefill = '', assetIds = []} = {}) {
  if (!activeProject()) { openProjectDialog(); return; }
  $('#mission-form').reset();
  $('#mission-form-error').textContent = '';
  state.missionAssetIds = assetIds.filter(assetId => Boolean(findProjectAsset(assetId)));
  $('#mission-project-scope').textContent = 'La misión se registrará únicamente en “' + activeProject().name + '”. Su política se congela al admitirla y su raíz de fábrica usa --state-dir privado.';
  $('#mission-text').value = prefill;
  configureModelForms();
  updateMissionForm();
  renderAssetSelection('mission');
  openDialog('mission-dialog');
  $('#mission-text').focus();
}

function openPolicyDialog() {
  if (!activeProject()) return;
  $('#policy-form-error').textContent = '';
  configureModelForms();
  openDialog('policy-dialog');
  $('#policy-model').focus();
}

async function createProject(event) {
  event.preventDefault();
  const button = $('#project-form button[type="submit"]');
  const error = $('#project-form-error');
  error.textContent = '';
  const model = $('#project-model').value || null;
  const effort = $('#project-effort').value || null;
  button.disabled = true;
  try {
    const payload = await api('/api/projects', {
      method: 'POST', token: true,
      body: {
        name: $('#project-name').value,
        client: $('#project-client').value,
        objective: $('#project-objective').value,
        description: $('#project-description').value,
        modelPolicy: model ? {model, effort} : {},
      },
    });
    await reloadProjects();
    closeDialog('project-dialog');
    await selectProject(payload.project.id);
    toast('Espacio creado: bóveda, memoria, Graphify y raíz de fábrica aislados.');
  } catch (failure) {
    error.textContent = failure.message || 'No se pudo crear el espacio.';
  } finally { button.disabled = false; }
}

async function saveProjectIdentity(event) {
  event.preventDefault();
  const project = activeProject();
  if (!project) return;
  const button = $('#project-identity-form button[type="submit"]');
  const error = $('#project-identity-error');
  error.textContent = '';
  button.disabled = true;
  try {
    await api('/api/projects/' + encodeURIComponent(project.id) + '/identity', {
      method: 'PATCH', token: true, body: {name: $('#project-identity-name').value},
    });
    await reloadProjects();
    closeDialog('project-identity-dialog');
    await selectProject(project.id, {preserveConversation: true});
    toast('Nombre actualizado. Las evidencias y admisiones históricas permanecen intactas.');
  } catch (failure) {
    error.textContent = failure.message || 'No se pudo actualizar el nombre del espacio.';
  } finally { button.disabled = false; }
}

function numberField(selector) {
  const value = $(selector).value.trim();
  return value ? Number(value) : null;
}

function missionPayload(textValue) {
  return {
    requestId: 'submission:' + crypto.randomUUID(),
    text: textValue,
    entryMode: $('#mission-entry-mode').value,
    preset: $('#mission-preset').value,
    model: $('#mission-model').value || null,
    effort: $('#mission-effort').value || null,
    maxParallel: numberField('#mission-parallel'),
    missionCallLimit: numberField('#mission-call-limit'),
    methodRecoveryRounds: numberField('#mission-recovery-rounds'),
    assetReferences: state.missionAssetIds.map(assetId => ({assetId})),
  };
}

async function submitMission(event) {
  event.preventDefault();
  if (!activeProject()) return;
  const projectId = state.activeProjectId;
  const button = $('#submit-mission');
  const error = $('#mission-form-error');
  error.textContent = '';
  button.disabled = true;
  try {
    const response = await api('/api/projects/' + encodeURIComponent(projectId) + '/missions', {method: 'POST', token: true, body: missionPayload($('#mission-text').value)});
    const startFailed = rememberRuntimeStartFailure(projectId, response.supervisor);
    if (!startFailed) clearRuntimeStartFailure(projectId);
    closeDialog('mission-dialog');
    state.missionAssetIds = [];
    await selectProject(projectId, {preserveConversation: true});
    // The post response is the authoritative outcome of this particular
    // start request. A concurrent overview can still reflect an older active
    // runtime snapshot, so do not let that snapshot turn a START_FAILED into
    // a false success before the next confirmed runtime tick.
    if (startFailed) rememberRuntimeStartFailure(projectId, response.supervisor);
    const id = response.job?.missionId || response.job?.id || response.job?.mission?.id;
    if (id) await selectMission(id);
    switchView('missions');
    if (startFailed) {
      renderMissions();
      renderInspector();
      toast('Misión registrada, pero el runtime aislado devolvió START_FAILED (' + runtimeStartFailureCode(response.supervisor) + '). No se presentará como ejecutándose; corrige el runtime y actívalo desde Sistema.', 'error');
    } else {
      toast(response.routing?.mode === 'PROJECT_PUBLIC_SOURCED_AUTOMATIC_V1'
        ? 'Ruta pública con fuentes seleccionada; el contexto privado no se adjuntó.'
        : 'Misión registrada en la cola aislada del proyecto.');
    }
  } catch (failure) {
    error.textContent = failure.message || 'No se pudo registrar la misión.';
  } finally { button.disabled = false; }
}

async function sendComposer(event) {
  event.preventDefault();
  if (!activeProject()) return;
  const projectId = state.activeProjectId;
  const submitter = event.submitter;
  const action = submitter?.dataset.composeAction || 'save';
  const textValue = $('#composer-text').value.trim();
  if (!textValue) { toast('Escribe o dicta un contexto antes de enviarlo.', 'error'); return; }
  const controls = [$('#save-context'), $('#run-from-composer'), $('#voice-button')];
  controls.forEach(control => { control.disabled = true; });
  try {
    const recorded = await api('/api/projects/' + encodeURIComponent(projectId) + '/messages', {
      method: 'POST', token: true,
      body: {
        text: textValue,
        conversationId: state.selectedConversationId || null,
        source: state.voice.used ? 'browser-voice-transcript' : 'typed',
      },
    });
    state.selectedConversationId = recorded.conversation.id;
    state.voice.used = false;
    if (action === 'run') {
      const job = await api('/api/projects/' + encodeURIComponent(projectId) + '/missions', {
        method: 'POST', token: true,
        body: {
          requestId: 'submission:' + crypto.randomUUID(),
          text: textValue,
          entryMode: 'planned',
          preset: 'adaptive-v2',
          model: null,
          effort: null,
          maxParallel: null,
          missionCallLimit: null,
          methodRecoveryRounds: null,
          assetReferences: state.composerAssetIds.map(assetId => ({assetId})),
          conversationLink: {
            conversationId: recorded.conversation.id,
            sourceMessageId: recorded.message.id,
          },
        },
      });
      const startFailed = rememberRuntimeStartFailure(projectId, job.supervisor);
      if (!startFailed) clearRuntimeStartFailure(projectId);
      const id = job.job?.missionId || job.job?.id || job.job?.mission?.id;
      await selectProject(projectId, {preserveConversation: true});
      if (startFailed) rememberRuntimeStartFailure(projectId, job.supervisor);
      await loadConversation(recorded.conversation.id);
      $('#composer-text').value = '';
      state.composerAssetIds = [];
      renderAssetSelection('composer');
      updateComposerCount();
      if (id) await selectMission(id);
      switchView('missions');
      if (startFailed) {
        renderMissions();
        renderInspector();
        toast('Contexto guardado, pero el runtime aislado devolvió START_FAILED (' + runtimeStartFailureCode(job.supervisor) + '). La misión no se presentará como ejecutándose.', 'error');
      } else {
        toast(job.conversationLink?.state === 'LINKED'
          ? 'Contexto guardado, misión registrada y conversación vinculada de forma verificable.'
          : 'Contexto guardado y misión registrada. El vínculo del chat queda pendiente de conciliación verificable.');
      }
    } else {
      await selectProject(projectId, {preserveConversation: true});
      await loadConversation(recorded.conversation.id);
      $('#composer-text').value = '';
      updateComposerCount();
      toast('Contexto guardado en la memoria del espacio activo.');
    }
  } catch (failure) {
    toast(failure.message || 'No se pudo guardar el contexto.', 'error');
  } finally { controls.forEach(control => { control.disabled = false; }); }
}

async function selectMission(missionId) {
  if (!activeProject() || !missionId) return;
  const projectId = state.activeProjectId;
  if (state.selectedMissionId !== missionId) state.selectedMissionTab = 'trace';
  state.selectedMissionId = missionId;
  state.selectedMission = null;
  renderMissions();
  renderOperations();
  try {
    const detail = await api('/api/projects/' + encodeURIComponent(projectId) + '/missions/' + encodeURIComponent(missionId));
    if (state.activeProjectId !== projectId || state.selectedMissionId !== missionId) return;
    state.selectedMission = detail;
    rememberMissionTitleFromDetail(missionId, detail);
    renderMissions();
    renderOperations();
    void stageAcceptedMissionDeliveryOnce(missionId);
  } catch (error) {
    if (state.activeProjectId === projectId && state.selectedMissionId === missionId) {
      state.selectedMission = {status: {ok: false, error: {message: error.message}}};
      renderMissions();
      renderOperations();
    }
  }
}

async function refreshProjectQueueAtConfirmedMissionTick(projectId) {
  const snapshot = await api('/api/projects/' + encodeURIComponent(projectId));
  if (state.activeProjectId !== projectId) return false;
  // This is a shallow runtime snapshot only.  It deliberately does not call
  // selectProject(), which would clear a selected mission and make a confirmed
  // route look as if it had disappeared between polling ticks.
  state.project = snapshot;
  if (upper(snapshot?.runtime?.state) === 'ACTIVE') clearRuntimeStartFailure(projectId);
  renderHome();
  renderOperations();
  renderMissions();
  renderInspector();
  return true;
}

async function refreshSelectedMissionDetailAtConfirmedTick(projectId, missionId) {
  const detail = await api('/api/projects/' + encodeURIComponent(projectId) + '/missions/' + encodeURIComponent(missionId));
  if (state.activeProjectId !== projectId || state.selectedMissionId !== missionId) return null;
  state.selectedMission = detail;
  return detail;
}

// The finite overview poll only announces that the local console has fresh
// global state. This narrow read polls the selected project mission itself, so the
// operational trace advances from confirmed runtime state rather than a
// spinner or guessed elapsed time. Every nonterminal route rereads its public
// detail/report at each confirmed tick: plan, nodes, reviews and delivery can
// advance without changing the coarse mission lifecycle. It never polls raw
// journals or provider activity.
async function refreshSelectedMissionStatus() {
  const projectId = state.activeProjectId;
  const missionId = state.selectedMissionId;
  const current = state.selectedMission;
  const currentMission = object(current?.status?.data?.mission);
  if (!projectId || !missionId || !current || state.missionStatusRefresh
    || terminalMissionRefreshState(currentMission)
    || document.visibilityState === 'hidden') return;
  state.missionStatusRefresh = {projectId, missionId};
  try {
    const update = await api('/api/projects/' + encodeURIComponent(projectId) + '/missions/' + encodeURIComponent(missionId) + '/status');
    if (state.activeProjectId !== projectId || state.selectedMissionId !== missionId || !state.selectedMission) return;
    const previousStatus = state.selectedMission.status?.data ?? null;
    const nextStatus = update.status?.data ?? null;
    const nextMission = object(nextStatus?.mission);
    const observedMission = nextMission.id ? nextMission : currentMission;
    const statusChanged = JSON.stringify(previousStatus) !== JSON.stringify(nextStatus);
    if (statusChanged) {
      state.selectedMission = {...state.selectedMission, ...update};
      renderMissions();
    }

    const nonterminalMission = !terminalMissionRefreshState(observedMission);
    if (nonterminalMission) {
      // Every live mission rereads its public detail after a confirmed status
      // tick.  Planned routes can change plan, nodes, reviews and accepted
      // products without a coarse lifecycle transition, so limiting this to
      // sourced missions made the visible inspector stale while work ran.
      // A temporary problem with either read preserves the last confirmed
      // projection; it never overwrites the inspector with guessed activity.
      const [queueResult, detailResult] = await Promise.allSettled([
        refreshProjectQueueAtConfirmedMissionTick(projectId),
        refreshSelectedMissionDetailAtConfirmedTick(projectId, missionId),
      ]);
      if (state.activeProjectId !== projectId || state.selectedMissionId !== missionId) return;
      if (detailResult.status === 'fulfilled' && detailResult.value) {
        const refreshedMission = object(detailResult.value.status?.data?.mission);
        if (sourcedProgressForMission(refreshedMission)?.delivery?.availability === 'AVAILABLE') {
          try { await refreshDeliverables(projectId); } catch { /* Keep the confirmed route trace if the vault list is temporarily unavailable. */ }
        }
      }
      // `refreshProjectQueueAtConfirmedMissionTick` and the detail read each
      // redraw their own safe surface.  One final draw merges a successful
      // queue projection with a successful report projection in either order.
      if (queueResult.status === 'fulfilled' || detailResult.status === 'fulfilled') renderMissions();
    } else if (!terminalMissionRefreshState(object(previousStatus?.mission)) && terminalMissionRefreshState(observedMission)) {
      // A terminal transition can add the accepted final projection. Reopen
      // the full detail exactly once rather than leave the last live snapshot.
      await selectMission(missionId);
    }
  } catch {
    // A temporary status read never replaces the last confirmed trace with a
    // fabricated failure. Manual refresh still exposes persistent problems.
  } finally {
    if (state.missionStatusRefresh?.projectId === projectId && state.missionStatusRefresh?.missionId === missionId) {
      state.missionStatusRefresh = null;
    }
  }
}

// The background reconciler lives in the local console, not in the browser.
// This companion is therefore strictly read-only: it makes a completed final
// visible in the active chat and Deliverables shelf without requiring the
// user to select its mission or keeping a mutation-capable page process alive.
async function refreshActiveProjectReadModels() {
  const projectId = state.activeProjectId;
  const conversationId = state.selectedConversationId;
  if (!projectId || !activeProject() || state.projectLoading || state.projectReadRefresh
    || document.visibilityState === 'hidden') return;
  const refresh = {projectId, conversationId};
  state.projectReadRefresh = refresh;
  try {
    const [deliverablesResult, messagesResult, inboxResult] = await Promise.allSettled([
      api('/api/projects/' + encodeURIComponent(projectId) + '/deliverables'),
      conversationId
        ? api('/api/projects/' + encodeURIComponent(projectId) + '/conversations/' + encodeURIComponent(conversationId) + '/messages')
        : Promise.resolve(null),
      api('/api/projects/' + encodeURIComponent(projectId) + '/deliveries/inbox', {token: true}),
    ]);
    if (state.activeProjectId !== projectId || state.projectReadRefresh !== refresh) return;
    let changed = false;
    if (deliverablesResult.status === 'fulfilled') {
      const nextDeliverables = array(deliverablesResult.value.deliverables);
      if (JSON.stringify(nextDeliverables) !== JSON.stringify(state.deliverables)) {
        state.deliverables = nextDeliverables;
        if (state.deliverablePreview && !findProjectDeliverable(state.deliverablePreview.id)) state.deliverablePreview = null;
        changed = true;
      }
    }
    if (conversationId && state.selectedConversationId === conversationId && messagesResult.status === 'fulfilled') {
      const nextMessages = array(messagesResult.value?.messages);
      if (JSON.stringify(nextMessages) !== JSON.stringify(state.messages)) {
        state.messages = nextMessages;
        changed = true;
      }
    }
    if (inboxResult.status === 'fulfilled') {
      const nextInbox = array(inboxResult.value?.items);
      if (JSON.stringify(nextInbox) !== JSON.stringify(state.deliveryInbox)) {
        state.deliveryInbox = nextInbox;
        changed = true;
      }
    }
    if (changed) {
      renderDeliverables();
      renderDeliveryInbox();
      renderConversation();
      renderMissions();
      renderOperations();
    }
  } catch {
    // These reads are projections. A transient local read leaves the last
    // verified chat/deliverable state in place and never claims a failure as a
    // Factory result.
  } finally {
    if (state.projectReadRefresh === refresh) state.projectReadRefresh = null;
  }
}

function hasActiveProjectMission(missionId) {
  return activeMappings().some(mapping => mapping.missionId === missionId);
}

async function requestProjectMissionAction(missionId, action, {node = null, reason = null} = {}) {
  const projectId = state.activeProjectId;
  if (!projectId || !missionId || !hasActiveProjectMission(missionId)) {
    toast('La misión ya no pertenece al espacio activo. Actualiza la consola antes de volver a intentarlo.', 'error');
    return false;
  }
  if (!['pause', 'continue', 'cancel', 'retry-review'].includes(action) || state.missionAction) return false;
  if (action === 'cancel') {
    const approved = window.confirm(
      '¿Solicitar la cancelación de la misión ' + displayId(missionId) + '? La fábrica puede detener su ejecución. La interfaz no la marcará como cancelada hasta recibir una confirmación del runtime.',
    );
    if (!approved) return false;
  }
  state.missionAction = {missionId, action};
  state.missionActionError = null;
  renderMissions();
  try {
    await api('/api/projects/' + encodeURIComponent(projectId) + '/missions/' + encodeURIComponent(missionId) + '/action', {
      method: 'POST', token: true, body: {action, ...(node ? {node} : {}), ...(reason ? {reason} : {})},
    });
    toast('Solicitud de “' + missionActionLabel(action) + '” aceptada. Leyendo el estado confirmado por la fábrica…');
    if (state.activeProjectId === projectId) {
      await selectProject(projectId, {preserveConversation: true});
      if (state.activeProjectId === projectId) await selectMission(missionId);
    }
    return true;
  } catch (error) {
    state.missionActionError = {missionId, action, message: error.message || 'La fábrica no aceptó la acción solicitada.'};
    toast(state.missionActionError.message, 'error');
    return false;
  } finally {
    state.missionAction = null;
    if (state.activeProjectId === projectId) renderMissions();
  }
}

async function requestProjectMissionDelivery(missionId) {
  const projectId = state.activeProjectId;
  const mission = object(state.selectedMission?.status?.data?.mission);
  if (!projectId || !missionId || !hasActiveProjectMission(missionId)) {
    toast('La misión ya no pertenece al espacio activo. Actualiza la consola antes de recuperar una entrega.', 'error');
    return;
  }
  if (mission.id !== missionId || upper(mission.status) !== 'COMPLETED' || state.deliveryAction) {
    toast('La entrega sólo se solicita cuando esta misión concreta está confirmada como COMPLETED.', 'error');
    return;
  }
  const sourcedProgress = sourcedProgressForMission(mission);
  if (sourcedProgress && sourcedProgress.delivery.availability !== 'AVAILABLE') {
    toast('La ruta con fuentes no confirmó una entrega final disponible; la consola no la recupera por inferencia.', 'error');
    return;
  }
  state.deliveryAction = {missionId};
  renderMissions();
  try {
    const response = await api('/api/projects/' + encodeURIComponent(projectId) + '/missions/' + encodeURIComponent(missionId) + '/deliverable', {
      method: 'POST', token: true,
    });
    if (state.activeProjectId !== projectId) return;
    await refreshDeliverables(projectId);
    if (state.activeProjectId !== projectId) return;
    state.deliverablePreview = {
      id: response.deliverable.id,
      body: response.content.body,
      // The browser checks it once on a later explicit open/download too.
      // This just records the fact that the body came through the verified
      // local Factory→vault path, not a browser rehash claim.
      browserHashVerified: false,
    };
    renderDeliverables();
    renderMissions();
    if (response.conversationTurn?.conversationId === state.selectedConversationId) {
      await loadConversation(response.conversationTurn.conversationId);
    }
    toast('Entrega final aceptada, sellada y abierta en esta misión.');
  } catch (error) {
    toast(error.message || 'La fábrica no pudo recuperar una entrega final aceptada.', 'error');
  } finally {
    state.deliveryAction = null;
    if (state.activeProjectId === projectId) renderMissions();
  }
}

async function stageAcceptedMissionDeliveryOnce(missionId) {
  const projectId = state.activeProjectId;
  const mission = object(state.selectedMission?.status?.data?.mission);
  if (!projectId || mission.id !== missionId || upper(mission.status) !== 'COMPLETED'
    || state.deliveryAction || projectDeliverables().some(delivery => delivery.missionId === missionId)) return;
  const sourcedProgress = sourcedProgressForMission(mission);
  if (sourcedProgress && sourcedProgress.delivery.availability !== 'AVAILABLE') return;
  const key = projectId + '\u0000' + missionId;
  if (state.autoDeliveryAttempts.has(key)) return;
  state.autoDeliveryAttempts.add(key);
  await requestProjectMissionDelivery(missionId);
}

async function downloadProjectMissionExport(missionId) {
  const projectId = state.activeProjectId;
  if (!projectId || !missionId || !hasActiveProjectMission(missionId)) {
    toast('La misión ya no pertenece al espacio activo. Actualiza la consola antes de exportarla.', 'error');
    return;
  }
  let objectUrl = null;
  let link = null;
  try {
    const response = await fetch('/api/projects/' + encodeURIComponent(projectId) + '/missions/' + encodeURIComponent(missionId) + '/export', {
      headers: {'accept': 'application/json', 'x-sovereign-ui-token': state.token || ''},
      credentials: 'same-origin', cache: 'no-store',
    });
    if (!response.ok) {
      throw await localConsoleResponseFailure(response, 'No se pudo exportar la proyección de la misión.');
    }
    let payload;
    try {
      payload = JSON.parse(await response.text());
    } catch {
      throw new Error('La exportación no devolvió una proyección JSON legible.');
    }
    // HTTP 200 only confirms that the console served a JSON envelope.  A
    // partial detail (for example a failed status or report read) is not an
    // exportable operational record, so never turn it into a download.
    if (payload?.status?.ok !== true || payload?.report?.ok !== true) {
      throw new Error(payload?.status?.error?.message || payload?.report?.error?.message || 'La fábrica aún no confirmó una proyección completa para exportar.');
    }
    link = document.createElement('a');
    objectUrl = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], {type: 'application/json; charset=utf-8'}));
    link.href = objectUrl;
    link.download = 'sublimine-' + displayId(missionId) + '.json';
    link.hidden = true;
    document.body.append(link);
    link.click();
    const releasedUrl = objectUrl;
    objectUrl = null;
    // Revoking in the next macrotask can cancel a download in slower browsers.
    // Keep it bounded, then release it even if the page remains open.
    window.setTimeout(() => URL.revokeObjectURL(releasedUrl), exportObjectUrlRetentionMs);
    toast('Proyección pública confirmada y descargada.');
  } catch (error) {
    toast(error.message || 'No se pudo descargar el JSON de la misión.', 'error');
  } finally {
    link?.remove();
    if (objectUrl) URL.revokeObjectURL(objectUrl);
  }
}

function submitMissionRetryReview(form) {
  const missionId = form.dataset.missionId || '';
  const feedback = form.querySelector('.mission-action-feedback');
  const node = form.querySelector('[name="retry-node"]')?.value.trim() || '';
  const reason = form.querySelector('[name="retry-reason"]')?.value.trim() || '';
  if (!form.reportValidity()) return;
  if (!node || reason.length < 20) {
    if (feedback) feedback.textContent = 'Indica un nodo y una justificación de al menos 20 caracteres.';
    return;
  }
  if (feedback) feedback.textContent = '';
  void requestProjectMissionAction(missionId, 'retry-review', {node, reason});
}

async function searchMemory(event) {
  event.preventDefault();
  if (!activeProject()) return;
  const holder = $('#memory-results');
  const query = $('#memory-query').value.trim();
  if (!query) { empty(holder, 'Introduce una consulta.', 'La búsqueda no se expande a otros espacios si no encuentra coincidencias aquí.'); return; }
  try {
    const payload = await api('/api/projects/' + encodeURIComponent(state.activeProjectId) + '/memory?query=' + encodeURIComponent(query));
    holder.replaceChildren();
    if (!array(payload.results).length) {
      empty(holder, 'Sin coincidencias en este espacio.', 'No se ha buscado ni usado contexto de otro cliente o proyecto.');
      return;
    }
    for (const result of payload.results) {
      holder.append(el('article', {className: 'memory-result'}, [
        el('div', {className: 'memory-result-head'}, [el('strong', result.kind), el('span', formatDate(result.at))]),
        el('p', result.text),
        el('span', 'Coincidencias: ' + result.matches + ' · hash local ' + String(result.integrity || '').slice(0, 12)),
      ]));
    }
  } catch (error) { empty(holder, 'No se pudo buscar memoria.', error.message); }
}

async function selectRole(roleId) {
  if (!roleId) return;
  state.selectedRoleId = roleId;
  state.selectedRole = null;
  renderRoles();
  try {
    const response = await api('/api/roles/' + encodeURIComponent(roleId));
    if (state.selectedRoleId !== roleId) return;
    state.selectedRole = response;
    renderRoles();
  } catch (error) { toast(error.message, 'error'); }
}

async function saveModelPolicy(event) {
  event.preventDefault();
  if (!activeProject()) return;
  const button = $('#policy-form button[type="submit"]');
  const error = $('#policy-form-error');
  const model = $('#policy-model').value || null;
  const effort = $('#policy-effort').value || null;
  error.textContent = '';
  button.disabled = true;
  try {
    await api('/api/projects/' + encodeURIComponent(state.activeProjectId) + '/model-policy', {
      method: 'POST', token: true, body: {model, effort},
    });
    closeDialog('policy-dialog');
    await selectProject(state.activeProjectId, {preserveConversation: true});
    toast('Política actualizada; sólo cambiará las misiones creadas desde ahora.');
  } catch (failure) {
    error.textContent = failure.message || 'No se pudo guardar la política.';
  } finally { button.disabled = false; }
}

async function startProjectRuntime() {
  if (!activeProject()) return;
  const projectId = state.activeProjectId;
  const button = $('#start-runtime');
  button.disabled = true;
  try {
    const response = await api('/api/projects/' + encodeURIComponent(projectId) + '/runtime/start', {method: 'POST', token: true, body: {}});
    const supervisor = response.supervisor || {};
    const startFailed = rememberRuntimeStartFailure(projectId, supervisor);
    if (!startFailed) clearRuntimeStartFailure(projectId);
    await selectProject(projectId, {preserveConversation: true});
    if (startFailed) rememberRuntimeStartFailure(projectId, supervisor);
    if (startFailed) {
      renderSystem();
      renderMissions();
      renderInspector();
      toast('El runtime aislado devolvió START_FAILED (' + runtimeStartFailureCode(supervisor) + '). La misión no se marcará como activa hasta una confirmación real.', 'error');
    } else {
      toast(supervisor.started
        ? 'Supervisor de proyecto solicitado. La cola se actualizará cuando el gestor confirme actividad.'
        : 'El supervisor ya estaba activo o no necesita otro arranque.');
    }
  } catch (error) {
    toast('No se pudo activar el runtime aislado: ' + error.message, 'error');
  } finally { button.disabled = false; }
}

function setVoiceUi(active, message) {
  state.voice.active = active;
  $('#voice-button').classList.toggle('active', active);
  $('#voice-button').setAttribute('aria-pressed', String(active));
  $('#voice-button').querySelector('span:last-child').textContent = active ? 'Escuchando' : 'Voz';
  $('#voice-status').textContent = message;
}

function stopVoice() {
  try { state.voice.recognition?.stop(); } catch { /* recognition may already be stopped */ }
}

function toggleVoice() {
  if (state.voice.active) { stopVoice(); return; }
  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!Recognition) {
    toast('Este navegador no ofrece reconocimiento de voz web. Puedes seguir usando texto; la consola no finge una transcripción.', 'error');
    return;
  }
  const recognition = new Recognition();
  state.voice.recognition = recognition;
  state.voice.baseline = $('#composer-text').value.trim();
  let finalText = '';
  recognition.lang = navigator.language || 'es-ES';
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.maxAlternatives = 1;
  recognition.onstart = () => setVoiceUi(true, 'Dictando en el navegador. Revisa el texto antes de guardar o ejecutar.');
  recognition.onresult = event => {
    let interim = '';
    for (let index = event.resultIndex; index < event.results.length; index += 1) {
      const transcript = event.results[index][0]?.transcript || '';
      if (event.results[index].isFinal) finalText += transcript + ' ';
      else interim += transcript;
    }
    $('#composer-text').value = [state.voice.baseline, finalText.trim(), interim.trim()].filter(Boolean).join(state.voice.baseline ? ' ' : '');
    state.voice.used = true;
    updateComposerCount();
  };
  recognition.onerror = event => {
    const reason = event.error === 'not-allowed' ? 'El navegador no concedió permiso de micrófono.' : 'El dictado se detuvo: ' + event.error + '.';
    setVoiceUi(false, reason + ' No se ha subido audio a la fábrica.');
  };
  recognition.onend = () => {
    state.voice.recognition = null;
    if (state.voice.active) setVoiceUi(false, 'Dictado terminado. Revisa el texto antes de enviarlo.');
  };
  try { recognition.start(); } catch { toast('El dictado ya estaba iniciándose.'); }
}

function stopLivePolling() {
  const poll = state.livePoll;
  if (poll.timer !== null) window.clearTimeout(poll.timer);
  if (poll.timeout !== null) window.clearTimeout(poll.timeout);
  poll.controller?.abort();
  state.livePoll = {
    generation: poll.generation + 1,
    timer: null,
    controller: null,
    timeout: null,
  };
}

// The console's old EventSource emitted the same overview on a five-second
// timer, but held one HTTP/1.1 socket per browser tab. Six open local tabs
// could therefore strand the next tab before it even loaded its project. This
// finite read keeps the same update cadence and closes every connection after
// each response; it also puts a deadline on a stalled local request.
function connectStream() {
  stopLivePolling();
  const poll = state.livePoll;
  const current = () => state.livePoll === poll;
  const schedule = delay => {
    if (!current()) return;
    poll.timer = window.setTimeout(() => { void tick(); }, delay);
  };
  const tick = async () => {
    if (!current()) return;
    poll.timer = null;
    const controller = new AbortController();
    poll.controller = controller;
    poll.timeout = window.setTimeout(() => controller.abort(), livePollTimeoutMs);
    try {
      const overview = await api('/api/overview?fresh=1', {signal: controller.signal});
      if (!current() || controller.signal.aborted) return;
      state.overview = overview;
      configureModelForms();
      renderSystem();
      setLiveStatus('Actualizado · cada 5 s', 'connected');
      hideNotice();
      void refreshActiveProjectReadModels();
      void refreshSelectedMissionStatus();
    } catch {
      if (!current() || controller.signal.aborted) return;
      setLiveStatus('Reintentando actualización…', 'error');
    } finally {
      if (poll.timeout !== null) window.clearTimeout(poll.timeout);
      if (!current()) return;
      poll.timeout = null;
      if (poll.controller === controller) poll.controller = null;
      schedule(livePollIntervalMs);
    }
  };
  void tick();
}

function wireEvents() {
  document.addEventListener('submit', event => {
    const retryForm = event.target.closest('[data-mission-retry-form]');
    if (!retryForm) return;
    event.preventDefault();
    submitMissionRetryReview(retryForm);
  });
  document.addEventListener('click', event => {
    const operationMission = event.target.closest('[data-operation-mission-id]');
    if (operationMission) {
      // The Operations card promises traceability. Selection alone used to
      // redraw the hidden inspector, which looked like a dead button.
      switchView('missions');
      void selectMission(operationMission.dataset.operationMissionId || '');
      return;
    }
    const inboxMission = event.target.closest('[data-inbox-mission-id]');
    if (inboxMission) {
      void selectMission(inboxMission.dataset.inboxMissionId || '');
      switchView('missions');
      return;
    }
    const assetRemove = event.target.closest('[data-asset-remove-id]');
    if (assetRemove) {
      changeAssetSelection(assetRemove.dataset.assetScope || 'composer', assetRemove.dataset.assetRemoveId || '', {selected: false});
      return;
    }
    const assetDownload = event.target.closest('[data-asset-download-id]');
    if (assetDownload) {
      void downloadProjectAsset(assetDownload.dataset.assetDownloadId || '');
      return;
    }
    const assetAttach = event.target.closest('[data-asset-attach-id]');
    if (assetAttach) {
      openMissionDialog({assetIds: [assetAttach.dataset.assetAttachId || '']});
      return;
    }
    const deliverableOpen = event.target.closest('[data-deliverable-open-id]');
    if (deliverableOpen) {
      void openProjectDeliverable(deliverableOpen.dataset.deliverableOpenId || '');
      return;
    }
    const deliverableDownload = event.target.closest('[data-deliverable-download-id]');
    if (deliverableDownload) {
      void downloadProjectDeliverable(deliverableDownload.dataset.deliverableDownloadId || '');
      return;
    }
    const conversationDelivery = event.target.closest('[data-conversation-delivery-id]');
    if (conversationDelivery) {
      void openConversationDelivery(
        conversationDelivery.dataset.conversationDeliveryId || '',
        conversationDelivery.dataset.conversationDeliveryMissionId || '',
      );
      return;
    }
    const missionDeliveryOpen = event.target.closest('[data-mission-delivery-open-id]');
    if (missionDeliveryOpen) {
      void openMissionDeliverable(missionDeliveryOpen.dataset.missionDeliveryOpenId || '');
      return;
    }
    const missionDelivery = event.target.closest('[data-mission-delivery-id]');
    if (missionDelivery) {
      if (!missionDelivery.disabled) void requestProjectMissionDelivery(missionDelivery.dataset.missionDeliveryId || '');
      return;
    }
    const missionAction = event.target.closest('[data-mission-action]');
    if (missionAction) {
      if (!missionAction.disabled) void requestProjectMissionAction(missionAction.dataset.missionId || '', missionAction.dataset.missionAction || '');
      return;
    }
    const missionExport = event.target.closest('[data-mission-export-id]');
    if (missionExport) {
      if (!missionExport.disabled) void downloadProjectMissionExport(missionExport.dataset.missionExportId || '');
      return;
    }
    const missionTab = event.target.closest('[data-mission-tab]');
    if (missionTab) {
      if (!missionTab.disabled) activateMissionTab(missionTab.dataset.missionTab || 'trace');
      return;
    }
    const speaker = event.target.closest('[data-speak-message-index]');
    if (speaker) {
      const index = Number(speaker.dataset.speakMessageIndex);
      if (Number.isSafeInteger(index)) toggleMessageSpeech(index, speaker.dataset.speakMessageKey || '');
      return;
    }
    const close = event.target.closest('[data-close-dialog]');
    if (close) { closeDialog(close.dataset.closeDialog); return; }
    const view = event.target.closest('[data-view]');
    if (view) { switchView(view.dataset.view); return; }
    const project = event.target.closest('[data-project-id]');
    if (project) { selectProject(project.dataset.projectId); return; }
    const conversation = event.target.closest('[data-conversation-id]');
    if (conversation) { loadConversation(conversation.dataset.conversationId); return; }
    const mission = event.target.closest('[data-project-mission-id]');
    if (mission) { selectMission(mission.dataset.projectMissionId); return; }
    const role = event.target.closest('[data-role-id]');
    if (role) { selectRole(role.dataset.roleId); return; }
    const group = event.target.closest('[data-role-group]');
    if (group) { state.roleGroup = group.dataset.roleGroup; renderRoles(); return; }
  });
  document.addEventListener('keydown', event => {
    const target = event.target instanceof Element ? event.target : event.target?.parentElement;
    const currentTab = target?.closest?.('[data-mission-tab]');
    if (!currentTab || currentTab.disabled || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    const available = $$('[data-mission-tab]').filter(tab => !tab.disabled);
    const current = available.indexOf(currentTab);
    if (current < 0 || !available.length) return;
    let next = current;
    if (event.key === 'ArrowLeft') next = (current - 1 + available.length) % available.length;
    if (event.key === 'ArrowRight') next = (current + 1) % available.length;
    if (event.key === 'Home') next = 0;
    if (event.key === 'End') next = available.length - 1;
    event.preventDefault();
    activateMissionTab(available[next].dataset.missionTab || 'trace', {focus: true});
  });
  $('#refresh-button').addEventListener('click', () => refresh());
  $('#open-project').addEventListener('click', openProjectDialog);
  $('#new-project-rail').addEventListener('click', openProjectDialog);
  $('#empty-create-project').addEventListener('click', openProjectDialog);
  $('#open-mission').addEventListener('click', () => openMissionDialog());
  $('#hero-mission').addEventListener('click', () => openMissionDialog());
  $('#edit-project-identity').addEventListener('click', openProjectIdentityDialog);
  $('#missions-create').addEventListener('click', () => openMissionDialog());
  $('#operations-open-missions').addEventListener('click', () => switchView('missions'));
  $('#hero-voice').addEventListener('click', () => { switchView('conversation'); $('#composer-text').focus(); });
  $('#new-conversation').addEventListener('click', () => { stopMessageSpeech(); state.selectedConversationId = null; state.messages = []; renderConversation(); $('#composer-text').focus(); });
  $('#project-form').addEventListener('submit', createProject);
  $('#project-identity-form').addEventListener('submit', saveProjectIdentity);
  $('#mission-form').addEventListener('submit', submitMission);
  $('#policy-form').addEventListener('submit', saveModelPolicy);
  $('#composer-form').addEventListener('submit', sendComposer);
  $('#home-command-form').addEventListener('submit', continueFromHomeCommand);
  $('#memory-search-form').addEventListener('submit', searchMemory);
  $('#voice-button').addEventListener('click', toggleVoice);
  $('#asset-upload-button').addEventListener('click', () => $('#asset-upload-input').click());
  $('#composer-attach').addEventListener('click', () => $('#composer-asset-input').click());
  $('#home-command-attach').addEventListener('click', () => $('#home-command-asset-input').click());
  $('#mission-attach').addEventListener('click', () => $('#mission-asset-input').click());
  $('#asset-upload-input').addEventListener('change', event => {
    void uploadFiles(event.target.files, null);
    event.target.value = '';
  });
  $('#composer-asset-input').addEventListener('change', event => {
    void uploadFiles(event.target.files, 'composer');
    event.target.value = '';
  });
  $('#home-command-asset-input').addEventListener('change', event => {
    void uploadFiles(event.target.files, 'home');
    event.target.value = '';
  });
  $('#mission-asset-input').addEventListener('change', event => {
    void uploadFiles(event.target.files, 'mission');
    event.target.value = '';
  });
  $('#composer-text').addEventListener('input', updateComposerCount);
  $('#mission-text').addEventListener('input', updateMissionForm);
  $('#mission-entry-mode').addEventListener('change', updateMissionForm);
  $('#project-model').addEventListener('change', () => populateEfforts($('#project-effort'), $('#project-model').value));
  $('#mission-model').addEventListener('change', configureMissionOverrideEffort);
  $('#policy-model').addEventListener('change', () => populateEfforts($('#policy-effort'), $('#policy-model').value));
  $('#role-search').addEventListener('input', event => { state.roleQuery = event.target.value; renderRoles(); });
  $('#edit-model-policy').addEventListener('click', openPolicyDialog);
  $('#inspector-edit-policy').addEventListener('click', openPolicyDialog);
  $('#start-runtime').addEventListener('click', startProjectRuntime);
  $('#open-rail').addEventListener('click', () => { $('#rail').classList.add('open'); $('#mobile-scrim').hidden = false; $('#mobile-scrim').classList.add('visible'); });
  $('#close-rail').addEventListener('click', () => { $('#rail').classList.remove('open'); $('#mobile-scrim').classList.remove('visible'); $('#mobile-scrim').hidden = true; });
  $('#mobile-scrim').addEventListener('click', () => { $('#rail').classList.remove('open'); $('#mobile-scrim').classList.remove('visible'); $('#mobile-scrim').hidden = true; });
  for (const dialog of $$('dialog')) dialog.addEventListener('click', event => { if (event.target === dialog) closeDialog(dialog.id); });
  window.addEventListener('beforeunload', () => { stopVoice(); stopMessageSpeech(); stopLivePolling(); });
}

async function boot() {
  wireEvents();
  updateComposerCount();
  updateMissionForm();
  try {
    const [bootstrap, catalog, projects] = await Promise.all([api('/api/bootstrap'), api('/api/roles'), api('/api/projects')]);
    state.token = bootstrap.token;
    state.overview = bootstrap.overview;
    state.roles = array(catalog.roles);
    state.projects = array(projects.projects);
    configureModelForms();
    const remembered = projectSelectionRemembered();
    const candidate = state.projects.find(project => project.id === remembered) || state.projects[0];
    if (candidate) {
      state.activeProjectId = candidate.id;
      state.projectLoading = true;
    }
    renderAll();
    if (candidate) await selectProject(candidate.id);
    connectStream();
  } catch (error) {
    renderShell();
    showNotice('La consola no pudo iniciar: ' + error.message);
    setLiveStatus('Sin conexión', 'error');
  }
}

boot();
