// Mission control-room presentation model.
//
// This is deliberately a small allow-listed view over the public mission
// projection already loaded by the dashboard. It is not a generic report
// renderer: prompts, source bytes, provider output, diagnostics, IDs outside
// the published node labels, and project-private context never enter this
// model. Keeping the model DOM-free makes its readiness and blocking semantics
// testable before a browser turns them into controls.

const object = value => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
const array = value => Array.isArray(value) ? value : [];
const upper = value => String(value ?? '').toUpperCase();

const missionStates = new Set([
  'NEW', 'QUEUED', 'PLANNING', 'RUNNING', 'WAITING_CAPABILITY', 'WAITING_PROVIDER', 'WAITING_QUOTA',
  'PAUSED', 'NEEDS_DIRECTION', 'COMPLETED', 'CANCELLED', 'FAILED', 'REJECTED', 'UNVERIFIED',
]);
// Queue coordination is a separate, public state machine.  In particular,
// RETRY_WAIT is not a mission lifecycle state: it means the durable queue has
// a bounded provider retry scheduled.  Treating it as an unknown mission
// state made a real retry look like an unobserved coordinator in the UI.
const queueStates = new Set([...missionStates, 'RETRY_WAIT', 'WAITING']);
const nodeStates = new Set([
  'NEW', 'PENDING', 'READY', 'RUNNING', 'PLANNING', 'REVIEW_PENDING', 'RETURNED', 'ACCEPTED',
  'COMPLETED', 'BLOCKED', 'FAILED', 'CANCELLED', 'SKIPPED', 'UNVERIFIED',
]);
const sourcedPhases = new Set(['ADMITTED', 'ACQUIRING', 'CANDIDATE_PENDING_REVIEW', 'ACCEPTED', 'ESCALATED', 'UNVERIFIED']);
const terminalStates = new Set(['COMPLETED', 'CANCELLED', 'FAILED', 'REJECTED']);
// Node and mission lifecycles are not the same machine.  In particular an
// accepted review is terminal for its node even though ACCEPTED is not a
// mission lifecycle terminal state. Mixing these made a completed mission
// falsely advertise a RUNNING assignment in the operator console.
const terminalNodeStates = new Set(['ACCEPTED', 'COMPLETED', 'FAILED', 'CANCELLED', 'SKIPPED']);
const codePattern = /^[A-Z_][A-Z0-9_]{0,159}$/;
const identifierPattern = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,179}$/;
// A model policy is not free-form status text. The detail projection may be
// backed by a historical runtime object, so only display a model that also
// appears in the current independently projected provider catalogue. This
// prevents an arbitrary field in mission.policy from becoming UI content.
const modelIdentifierPattern = /^[a-z0-9][a-z0-9._-]{1,79}$/i;
const reasoningEfforts = new Set(['low', 'medium', 'high', 'xhigh', 'max', 'ultra']);

function knownMissionState(value) {
  const state = upper(value);
  return missionStates.has(state) ? state : 'UNVERIFIED';
}

function knownQueueState(value) {
  const state = upper(value);
  return queueStates.has(state) ? state : 'UNVERIFIED';
}

function publicRetrySchedule(queueJob, queueStatus) {
  if (queueStatus !== 'RETRY_WAIT') return null;
  const job = object(queueJob);
  const at = typeof job.nextAttemptAt === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(job.nextAttemptAt)
    && Number.isFinite(Date.parse(job.nextAttemptAt))
    ? job.nextAttemptAt
    : null;
  const automaticRetries = Number.isSafeInteger(job.automaticRetries) && job.automaticRetries >= 1 && job.automaticRetries <= 12
    ? job.automaticRetries
    : null;
  // A retry wait without a validated future instant remains a valid observed
  // queue state, but it must not gain an invented schedule in the UI.
  return at ? Object.freeze({at, automaticRetries}) : null;
}

// A queue that has already consumed one bounded automatic retry can be RUNNING
// while the last durable mission snapshot is still WAITING_PROVIDER. That is
// not a contradiction and it must not look like the work silently stopped.
// Project this very narrow fact only when all of its public fields agree; never
// infer a retry merely from a RUNNING queue or from an elapsed clock.
function publicRetryInFlight(queueJob, queueStatus) {
  if (queueStatus !== 'RUNNING') return null;
  const job = object(queueJob);
  const attempts = Number.isSafeInteger(job.attempts) && job.attempts >= 2 && job.attempts <= 13
    ? job.attempts
    : null;
  const automaticRetries = Number.isSafeInteger(job.automaticRetries) && job.automaticRetries >= 1 && job.automaticRetries <= 12
    ? job.automaticRetries
    : null;
  const lastLifecycleStatus = knownMissionState(object(job.lifecycle).status);
  if (!attempts || !automaticRetries || !lastLifecycleStatus.startsWith('WAITING_')) return null;
  return Object.freeze({attempts, automaticRetries, lastLifecycleStatus});
}

function knownNodeState(value) {
  const state = upper(value);
  return nodeStates.has(state) ? state : 'UNVERIFIED';
}

function boundedText(value, fallback, maximum = 160) {
  if (typeof value !== 'string') return fallback;
  const compact = value.replace(/[\r\n\t]+/g, ' ').trim();
  if (!compact) return fallback;
  return compact.slice(0, maximum);
}

function publicCode(value) {
  return typeof value === 'string' && codePattern.test(value) ? value : null;
}

function publicRoles(value) {
  const values = [];
  for (const item of array(value)) {
    const role = boundedText(item, '', 96);
    if (role && !values.includes(role)) values.push(role);
    if (values.length === 3) break;
  }
  return values;
}

function publicIdentifier(value) {
  return typeof value === 'string' && identifierPattern.test(value) ? value : null;
}

function publicDependencies(value) {
  const dependencies=[];
  for(const item of array(value)){
    const candidate=typeof item==='string'?item:object(item).nodeId;
    const id=publicIdentifier(candidate);
    if(!id||dependencies.includes(id))return null;
    dependencies.push(id);
    if(dependencies.length>24)return null;
  }
  return Object.freeze(dependencies);
}

function nodeCard(value) {
  const node = object(value);
  const spec = object(node.spec);
  const status = knownNodeState(node.status);
  const id=publicIdentifier(node.id ?? spec.id);
  const dependencies=publicDependencies(array(node.dependencies).length?node.dependencies:spec.dependencies);
  return Object.freeze({
    id,
    title: boundedText(node.title ?? spec.title ?? node.id ?? spec.id, 'Nodo no publicado'),
    status,
    roles: Object.freeze(publicRoles(array(node.roles).length ? node.roles : spec.roleIds)),
    dependencies,
  });
}

function executionGraph(nodes, {isSourcedRoute = false} = {}) {
  if(isSourcedRoute)return Object.freeze({nodes:Object.freeze([]),edges:Object.freeze([]),integrity:'NOT_APPLICABLE'});
  const cards=Object.freeze(array(nodes).slice(0,24).map(nodeCard));
  if(!cards.length)return Object.freeze({nodes:cards,edges:Object.freeze([]),integrity:'ABSENT'});
  if(cards.some(card=>!card.id||card.dependencies===null))return Object.freeze({nodes:cards,edges:Object.freeze([]),integrity:'UNVERIFIED'});
  const byId=new Map(cards.map(card=>[card.id,card]));
  if(byId.size!==cards.length)return Object.freeze({nodes:cards,edges:Object.freeze([]),integrity:'UNVERIFIED'});
  for(const card of cards)if(card.dependencies.some(id=>id===card.id||!byId.has(id)))
    return Object.freeze({nodes:cards,edges:Object.freeze([]),integrity:'UNVERIFIED'});
  const visiting=new Set(),levels=new Map();
  const levelFor=id=>{
    if(levels.has(id))return levels.get(id);
    if(visiting.has(id))return null;
    visiting.add(id);
    const dependencyLevels=[];
    for(const dependency of byId.get(id).dependencies){
      const level=levelFor(dependency);
      if(level===null){visiting.delete(id);return null;}
      dependencyLevels.push(level);
    }
    visiting.delete(id);
    const level=dependencyLevels.length?Math.max(...dependencyLevels)+1:0;
    levels.set(id,level);
    return level;
  };
  for(const card of cards)if(levelFor(card.id)===null)
    return Object.freeze({nodes:cards,edges:Object.freeze([]),integrity:'UNVERIFIED'});
  const graphNodes=Object.freeze(cards.map(card=>Object.freeze({...card,level:levels.get(card.id)})));
  const edges=Object.freeze(graphNodes.flatMap(card=>card.dependencies.map(from=>Object.freeze({from,to:card.id}))));
  return Object.freeze({nodes:graphNodes,edges,integrity:'VERIFIED'});
}

function blockingCodes(mission, queueJob) {
  const codes = [];
  const append = value => {
    const code = publicCode(value);
    if (code && !codes.includes(code) && codes.length < 6) codes.push(code);
  };
  for (const item of array(object(mission).pending)) append(object(item).code);
  for (const code of array(object(queueJob).lifecycle?.pendingCodes)) append(code);
  return Object.freeze(codes);
}

function blockingState(status, codes, retryInFlight = null) {
  if (retryInFlight) {
    return Object.freeze({
      state: 'RECOVERING',
      label: codes.length ? 'REINTENTO ACTIVO · ' + codes.join(' · ') : 'REINTENTO ACTIVO',
    });
  }
  if (codes.length) return Object.freeze({state: 'BLOCKED', label: codes.join(' · ')});
  if (status === 'NEEDS_DIRECTION') return Object.freeze({state: 'DIRECTION_REQUIRED', label: 'DIRECCIÓN REQUERIDA'});
  if (status === 'PAUSED') return Object.freeze({state: 'PAUSED', label: 'PAUSADA POR OPERADOR'});
  if (status.startsWith('WAITING_')) return Object.freeze({state: 'WAITING', label: status});
  if (terminalStates.has(status)) return Object.freeze({state: 'CLEAR', label: 'SIN BLOQUEO ACTIVO'});
  return Object.freeze({state: 'NOT_PUBLISHED', label: 'SIN BLOQUEO PUBLICADO'});
}

function reviewReturned(report, sourcedProgress) {
  if (upper(object(sourcedProgress).independentReview?.state) === 'RETURNED') return true;
  return array(object(report).reviews).some(value => {
    const review = object(value);
    return ['RETURN', 'RETURNED'].includes(upper(review.status)) || ['RETURN', 'RETURNED'].includes(upper(review.decision));
  });
}

function publicCount(value, maximum = 10_000) {
  return Array.isArray(value) && value.length <= maximum ? value.length : null;
}

function knownModelIds(value) {
  const ids = [];
  for (const item of array(value)) {
    const candidate = typeof item === 'string' ? item : object(item).id ?? object(item).model;
    if (typeof candidate !== 'string' || !modelIdentifierPattern.test(candidate) || ids.includes(candidate)) continue;
    ids.push(candidate);
    if (ids.length === 64) break;
  }
  return Object.freeze(ids);
}

function publicPolicy(mission, allowedModelIds) {
  const policy = object(object(mission).policy);
  const attempts = Number.isSafeInteger(policy.maxNodeAttempts) && policy.maxNodeAttempts >= 0 && policy.maxNodeAttempts <= 10_000
    ? String(policy.maxNodeAttempts)
    : 'NO PROYECTADO';
  const model = typeof policy.model === 'string' && allowedModelIds.includes(policy.model)
    ? policy.model
    : 'NO PROYECTADO';
  const reasoningEffort = typeof policy.reasoningEffort === 'string' && reasoningEfforts.has(policy.reasoningEffort)
    ? policy.reasoningEffort
    : 'NO PROYECTADO';
  return Object.freeze({
    model,
    reasoningEffort,
    maxNodeAttempts: attempts,
  });
}

/**
 * An allow-listed technical card for the mission inspector. It deliberately
 * replaces the former generic JSON panel: it has no path through which a
 * project-context pack, provider response, prompt, arbitrary report field, or
 * future nested value can reach the DOM.
 */
export function missionTechnicalProjection({mission, plan, nodes, report, sourcedProgress, isSourcedRoute = false, detailReady = false, reportReady = false, knownProviderModels = []} = {}) {
  const safeMission = object(mission);
  const safePlan = object(plan);
  const sourcedPhase = upper(object(sourcedProgress).phase);
  const execution = executionGraph(nodes, {isSourcedRoute});
  const finalNodeId = publicIdentifier(safePlan.finalNodeId);
  const sourceCount = publicCount(object(report).sources);
  const reviewCount = publicCount(object(report).reviews);
  return Object.freeze({
    schema: 'sublimine.mission-technical-projection.v1',
    availability: Object.freeze({
      detail: detailReady === true ? 'AVAILABLE' : 'UNAVAILABLE',
      report: reportReady === true ? 'AVAILABLE' : 'UNAVAILABLE',
    }),
    route: isSourcedRoute ? 'SOURCED_PUBLIC' : 'PLANNED',
    status: knownMissionState(safeMission.status),
    policy: publicPolicy(safeMission, knownModelIds(knownProviderModels)),
    topology: Object.freeze(isSourcedRoute
      ? {state: 'NOT_APPLICABLE', integrity: 'NOT_APPLICABLE', nodes: 0, finalNodeId: null}
      : {
        state: execution.nodes.length ? 'PUBLISHED' : 'NOT_PUBLISHED',
        integrity: execution.integrity,
        nodes: execution.nodes.length,
        finalNodeId,
      }),
    evidence: Object.freeze({
      state: reportReady === true ? 'PUBLISHED' : 'NOT_PUBLISHED',
      sources: sourceCount,
      reviews: reviewCount,
    }),
    sourcedRoute: Object.freeze(isSourcedRoute
      ? {phase: sourcedPhases.has(sourcedPhase) ? sourcedPhase : 'UNVERIFIED'}
      : {phase: 'NOT_APPLICABLE'}),
  });
}

/**
 * Build the single mission-level operating model used by the dashboard.
 * Callers pass only project-scoped public projections. The return value is
 * finite, frozen and display-ready; it never forwards an arbitrary input field.
 */
export function missionControlRoom({mission, queueJob, nodes, plan, report, sourcedProgress, isSourcedRoute = false, detailReady = false, reportReady = false} = {}) {
  const safeMission = object(mission);
  const status = knownMissionState(safeMission.status);
  // A sourced route has no public plan/node graph by contract. Do not turn a
  // malformed adjacent node projection into a visible “execution graph”.
  const execution=executionGraph(nodes,{isSourcedRoute});
  const publicNodes = execution.nodes;
  const missionTerminal = terminalStates.has(status);
  const activeNode = missionTerminal
    ? null
    : publicNodes.find(node => !terminalNodeStates.has(node.status) && node.status !== 'UNVERIFIED') ?? null;
  const queueStatus = knownQueueState(object(queueJob).status);
  const retrySchedule = publicRetrySchedule(queueJob, queueStatus);
  const retryInFlight = publicRetryInFlight(queueJob, queueStatus);
  const sourcedPhase = upper(object(sourcedProgress).phase);
  // A defer-only sourced escalation is deliberately not a live queue item.
  // The coordinator may retain WAITING as historical ownership, but presenting
  // that as active work made an already-closed route look stalled.
  const explicitSourcedEscalation = isSourcedRoute && sourcedPhase === 'ESCALATED';
  const phase = missionTerminal
    ? Object.freeze({label: 'CICLO DE MISIÓN', value: status})
    : isSourcedRoute && sourcedPhases.has(sourcedPhase)
      ? Object.freeze({label: 'RUTA CON FUENTES', value: sourcedPhase})
      : Object.freeze({label: activeNode ? 'NODO ACTIVO' : 'CICLO DE MISIÓN', value: activeNode ? activeNode.status : status});
  const assignment = missionTerminal
    ? Object.freeze({label: 'ASIGNACIÓN', value: 'EJECUCIÓN CERRADA', roles: Object.freeze([])})
    : isSourcedRoute
      ? Object.freeze({label: 'ASIGNACIÓN', value: 'PRODUCTOR DE RESPUESTA PÚBLICA', roles: Object.freeze([])})
    : activeNode
      ? Object.freeze({label: 'ASIGNACIÓN', value: activeNode.title, roles: activeNode.roles})
      : Object.freeze({label: 'ASIGNACIÓN', value: 'SIN NODO ACTIVO PUBLICADO', roles: Object.freeze([])});
  const codes = blockingCodes(safeMission, queueJob);
  const hasPlan = !isSourcedRoute && (publicNodes.length > 0 || Boolean(object(plan).finalNodeId));
  const canRetry = !isSourcedRoute && !missionTerminal && reviewReturned(report, sourcedProgress);
  return Object.freeze({
    schema: 'sublimine.mission-control-room.v1',
    status,
    phase,
    coordination: Object.freeze({
      label: 'COORDINACIÓN',
      value: explicitSourcedEscalation
        ? 'RUTA CERRADA · SIN REEJECUCIÓN'
        : queueStatus === 'UNVERIFIED' ? 'NO OBSERVADA' : 'COLA · ' + queueStatus,
      ...(retrySchedule ? {retrySchedule} : {}),
      ...(retryInFlight ? {retryInFlight} : {}),
    }),
    assignment,
    blocking: blockingState(status, codes, retryInFlight),
    blockingCodes: codes,
    execution: Object.freeze({...execution,activeNodeTitle: activeNode?.title ?? null}),
    tabs: Object.freeze({
      trace: Object.freeze({enabled: true, reason: ''}),
      summary: Object.freeze({enabled: true, reason: ''}),
      plan: Object.freeze(isSourcedRoute
        ? {enabled: false, reason: 'No aplica: esta ruta pública acotada no crea un grafo de nodos.'}
        : hasPlan
          ? {enabled: true, reason: ''}
          : {enabled: false, reason: 'La fábrica aún no publicó una topología verificable para esta misión.'}),
      evidence: Object.freeze(reportReady
        ? {enabled: true, reason: ''}
        : {enabled: false, reason: 'El informe público aún no está disponible; la evidencia no se infiere.'}),
      technical: Object.freeze(detailReady
        ? {enabled: true, reason: ''}
        : {enabled: false, reason: 'La proyección de misión aún no está disponible.'}),
    }),
    controls: Object.freeze({
      runtimeActions: Object.freeze(terminalStates.has(status) || explicitSourcedEscalation
        ? {enabled: false, reason: explicitSourcedEscalation
          ? 'La ruta con fuentes terminó en escalado explícito; requiere una nueva admisión planificada y no continúa desde estos controles.'
          : 'La misión ya está cerrada; no admite más acciones de runtime.'}
        : {enabled: true, reason: ''}),
      export: Object.freeze(detailReady && reportReady
        ? {enabled: true, reason: ''}
        : {enabled: false, reason: 'La descarga se habilita sólo cuando estado e informe públicos están confirmados.'}),
      retryReview: Object.freeze(canRetry
        ? {enabled: true, reason: ''}
        : {enabled: false, reason: 'El reintento se habilita sólo tras una revisión publicada como RETURNED.'}),
    }),
  });
}

// A tab selection is stateful in the browser, but its validity is determined
// exclusively by the current frozen UI model. A status refresh can therefore
// move an operator back to the live trace when their former panel became
// unavailable, instead of leaving a blank or inert panel on screen.
export function missionControlRoomSelectedTab(room, requested = 'trace') {
  const tabs = object(room).tabs;
  const candidate = typeof requested === 'string' ? requested : 'trace';
  return object(tabs[candidate]).enabled === true ? candidate : 'trace';
}
