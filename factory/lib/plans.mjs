import {check, identifier, keys, list, sha256, string, unique, canonical, instant, integer} from './contracts.mjs';
import {getRole} from '../catalog/index.mjs';
import {assertPlanRoleExecution} from './role-execution.mjs';
import {validateSpecialistCharter} from './specialist-charter.mjs';
import {captureProcessIdentity,ownerProcessIsAlive} from './process-identity.mjs';
import {blindStage,validateBlindPlan,blindPlanProductDependency,assertProspectiveBlindReplan} from './blind-plan.mjs';
import {blindExecutionSchema} from './blind-plan-schema.mjs';
import {inputCopyExecutionSchema,inputSpanExecutionSchema,isInputCopyNode,validateInputCopyPlan} from './input-copy-contract.mjs';
import {assertMissionDirectionPlan} from './mission-direction.mjs';
import {assertProjectContextArtifactRead,isProjectContextIntakeNode,projectContextDescriptor,validateProjectContextPlan} from './project-context.mjs';
export {processIsAlive} from './process-identity.mjs';

const str = {type: 'string'};
const strings = {type: 'array', items: str};
const closed = properties => ({type: 'object', properties, required: Object.keys(properties), additionalProperties: false});
export const CRITERION_EVALUATORS = Object.freeze(['content', 'runtime.independent_review', 'runtime.no_file_writes', 'runtime.no_code_execution', 'runtime.no_source_fetch']);
export const criterionSchema = closed({id: str, text: str, evaluation: {type: 'string', enum: CRITERION_EVALUATORS}});
export const requiredEffectSchema = closed({type:{type:'string',enum:['file','execution']},path:str,command:str,expectedExit:{type:['integer','null']}});
const specialistSchema = closed({question: str, methods: strings, falsifier: str, expectedBenefit: str, completion: str});
export const PLAN_SCHEMA = closed({
  requirements: {type: 'array', items: closed({id: str, text: str, requestQuote: str, criteria: {type: 'array', items: criterionSchema}})},
  nodes: {type: 'array', items: closed({id: str, title: str, purpose: str, roleIds: strings, reviewerRoleIds: strings, requirementIds: strings,
    dependencies: {type: 'array', items: closed({nodeId: str, purpose: str, reason: str})},
    method: closed({id: str, rationale: str, alternatives: strings}), instructions: str, outputKind: str,
    criteria: {type: 'array', items: criterionSchema}, requiredEffects:{type:'array',items:requiredEffectSchema}, tools: strings, specialist: {anyOf: [specialistSchema, {type: 'null'}]},execution:{anyOf:[...blindExecutionSchema.anyOf,inputCopyExecutionSchema,inputSpanExecutionSchema]}})},
  finalNodeId: str, routingRationale: str,
});
export const TOOL_NAMES = Object.freeze(['source.fetch', 'source.search', 'workspace.list', 'workspace.read', 'workspace.write', 'execution.run']);

export function validateRequiredEffects(effects) {
  list(effects,'required effects',{max:1000});unique(effects.map(e=>canonical(e)),'required effects');
  for(const effect of effects) {
    keys(effect,['type','path','command','expectedExit']);
    check(['file','execution'].includes(effect.type),'EFFECT_SCHEMA','Unknown required effect type');
    string(effect.path,'effect path',{max:2048});string(effect.command,'effect command',{min:0,max:64000});
    const relative=effect.path!=='.'&&!effect.path.startsWith('/')&&!effect.path.includes('\\')&&effect.path.split('/').every(p=>p&&p!=='.'&&p!=='..');
    check(relative||(effect.type==='execution'&&effect.path==='.'),'EFFECT_SCHEMA','Effect path must be normalized workspace-relative');
    if(effect.type==='file')check(effect.command===''&&effect.expectedExit===null,'EFFECT_SCHEMA','File effects cannot contain execution fields');
    else {
      integer(effect.expectedExit,'expected exit',{min:0,max:255});
      let argv;try{argv=JSON.parse(effect.command);}catch{check(false,'EFFECT_SCHEMA','Execution command must encode an argv JSON array');}
      list(argv,'execution argv',{min:1,max:256});argv.forEach((arg,i)=>string(arg,'argv element',{min:i?0:1,max:16000}));
    }
  }
  return effects;
}
export function mergeRequiredEffects(...groups) {
  groups.forEach(validateRequiredEffects);
  return [...new Map(groups.flat().map(effect=>[canonical(effect),effect])).values()].sort((a,b)=>canonical(a).localeCompare(canonical(b)));
}

export function validateCriteria(criteria, label = 'criteria') {
  list(criteria, label, {min: 1, max: 1000}); unique(criteria.map(c => c.id), label);
  for (const c of criteria) {
    keys(c, ['id', 'text', 'evaluation'], ['id', 'text']); identifier(c.id); string(c.text, `${label} text`, {max: 20000});
    check(CRITERION_EVALUATORS.includes(c.evaluation ?? 'content'), 'CRITERION_EVALUATOR', 'Unknown criterion evaluator');
  }
}
export function validatePlan(plan, intent, options = {}) {
  return validatePlanShape(plan, intent, options, false);
}
// Only a fresh inference proposal may leave final node-local criteria empty:
// the controller must insert EVERY requirement criterion before review/storage.
// Installed plans and all intermediate products keep the strict validator above.
export function validatePlanProposal(plan, intent, options = {}) {
  return validatePlanShape(plan, intent, options, true);
}
function validatePlanShape(plan, intent, {previous = null, roleLookup = getRole, allowedTools = TOOL_NAMES, missionDirection = undefined, projectContext = null} = {}, proposal = false) {
  keys(plan, ['requirements', 'nodes', 'finalNodeId', 'routingRationale']); string(intent); string(plan.routingRationale);
  list(plan.requirements, 'requirements', {min: 1, max: 1000}); unique(plan.requirements.map(r => r.id), 'requirements');
  const requirementIds = new Set();
  for (const r of plan.requirements) {
    keys(r, ['id', 'text', 'requestQuote', 'criteria']); identifier(r.id); string(r.text); string(r.requestQuote);
    check(intent.includes(r.requestQuote), 'MANDATE_QUOTE', 'A requirement quote must exist verbatim in the immutable user request');
    validateCriteria(r.criteria); requirementIds.add(r.id);
  }
  if (previous) for (const r of previous.requirements) {
    const current = plan.requirements.find(c => c.id === r.id);
    check(current && canonical(current) === canonical(r), 'MANDATE_DRIFT', 'A replan may add omitted requirements, not remove or weaken frozen requirements');
  }
  list(plan.nodes, 'plan nodes', {min: 1, max: 256}); unique(plan.nodes.map(n => n.id), 'node IDs');
  if(previous) {
    // Automatic replanning may change methods, not erase accepted effect duties.
    // Legitimate path/command substitutions require a future explicit authorized
    // equivalence/change contract; this implementation does not pretend to offer it.
    const before=mergeRequiredEffects(...previous.nodes.map(n=>n.requiredEffects));
    const after=mergeRequiredEffects(...plan.nodes.map(n=>n.requiredEffects));
    check(before.every(e=>after.some(n=>canonical(e)===canonical(n))),'MANDATE_DRIFT','Replan cannot remove or weaken frozen required effects');
  }
  const nodes = new Map(plan.nodes.map(n => [n.id, n]));
  const allEffects = mergeRequiredEffects(...plan.nodes.map(n => n.requiredEffects));
  const allCriteria = [...plan.requirements.flatMap(r => r.criteria), ...plan.nodes.flatMap(n => n.criteria)];
  for (const [evaluation, type] of [['runtime.no_file_writes', 'file'], ['runtime.no_code_execution', 'execution']]) {
    check(!allCriteria.some(c => c.evaluation === evaluation) || !allEffects.some(e => e.type === type),
      'PLAN_CONTROL_CONFLICT', `${evaluation} is mission-wide and contradicts the required ${type} effects; do not reinterpret it as node-local`);
  }
  const covered = new Set();
  for (const n of plan.nodes) {
    const required=['id', 'title', 'purpose', 'roleIds', 'reviewerRoleIds', 'requirementIds', 'dependencies', 'method', 'instructions', 'outputKind', 'criteria', 'requiredEffects', 'tools', 'specialist'];
    keys(n,[...required,'execution'],required);
    identifier(n.id); check(!['planning', 'final-acceptance'].includes(n.id), 'PLAN_NODE_ID', 'Reserved control-plane node ID');
    string(n.title); string(n.purpose); string(n.instructions); identifier(n.outputKind);
    list(n.roleIds, 'roles', {max: 30}); list(n.reviewerRoleIds, 'reviewer roles', {min: 1, max: 30});
    check(n.roleIds.length > 0 || n.specialist !== null || blindStage(n)==='comparison'||isInputCopyNode(n), 'SPECIALIST_BINDING', 'An empty catalog assignment requires a complete mission-local specialist charter or declared native adapter');
    unique(n.roleIds).forEach(roleLookup); unique(n.reviewerRoleIds).forEach(roleLookup);
    list(n.requirementIds, 'served requirements', {min: 1}); unique(n.requirementIds).forEach(r => { check(requirementIds.has(r), 'PLAN_REQUIREMENT', 'Node cites an unknown requirement'); covered.add(r); });
    keys(n.method, ['id', 'rationale', 'alternatives']); identifier(n.method.id); string(n.method.rationale); list(n.method.alternatives, 'alternate methods').forEach(a => string(a));
    list(n.dependencies, 'dependencies'); unique(n.dependencies.map(d => d.nodeId));
    for (const d of n.dependencies) {
      keys(d, ['nodeId', 'purpose', 'reason']); string(d.reason); string(d.purpose);
      check(nodes.has(d.nodeId) && d.nodeId !== n.id, 'PLAN_DEPENDENCY', 'Dependency is missing or self-referential');
      check(nodes.get(d.nodeId).purpose === d.purpose, 'PLAN_PURPOSE', 'Dependency acceptance purpose must match its producer');
    }
    if(proposal&&n.id===plan.finalNodeId&&Array.isArray(n.criteria)&&n.criteria.length===0) {
      // No extra node-local obligation. Required criteria are nonempty above.
    } else if(proposal&&(isInputCopyNode(n)||blindStage(n)||n.purpose==='blind-protocol'&&plan.nodes.some(m=>blindStage(m)==='material'&&m.execution.protocolNodeId===n.id))&&Array.isArray(n.criteria)&&n.criteria.length===0){
      // Adapter gate normalization precedes plan review; execution still strict.
    } else validateCriteria(n.criteria);
    validateRequiredEffects(n.requiredEffects); list(n.tools, 'tools'); unique(n.tools).forEach(t => check(allowedTools.includes(t), 'PLAN_AUTHORITY', 'Plan asks for an unavailable or unauthorized tool'));
    if(n.requiredEffects.some(e=>e.type==='file'))check(allowedTools.includes('workspace.read'),'PLAN_AUTHORITY','File obligation requires authorized independent read');
    if(n.requiredEffects.some(e=>e.type==='execution'))check(allowedTools.includes('execution.run'),'PLAN_AUTHORITY','Execution obligation requires authorized independent execution');
    if (n.specialist !== null) {
      validateSpecialistCharter(n.specialist);
    }
  }
  // Check the private-context graph before generic orphan diagnostics so an
  // omitted intake dependency cannot be mistaken for an unrelated topology
  // error or normalized away by a later planner retry.
  validateProjectContextPlan(plan,projectContext);
  check([...requirementIds].every(r => covered.has(r)), 'PLAN_COVERAGE', 'Every requirement needs a producing path');
  check(nodes.has(plan.finalNodeId), 'PLAN_FINAL', 'The final product node must exist');
  const visiting = new Set(), visited = new Set(), ordering = [];
  const visit = nodeId => {
    check(!visiting.has(nodeId), 'PLAN_CYCLE', 'A material product cannot be its own prerequisite');
    if (visited.has(nodeId)) return;
    visiting.add(nodeId); nodes.get(nodeId).dependencies.forEach(d => visit(d.nodeId)); visiting.delete(nodeId); visited.add(nodeId); ordering.push(nodeId);
  };
  for (const n of nodes.keys()) visit(n);
  const ancestors = new Set();
  const collect = nodeId => { if (ancestors.has(nodeId)) return; ancestors.add(nodeId); nodes.get(nodeId).dependencies.forEach(d => collect(d.nodeId)); };
  collect(plan.finalNodeId);
  check(ancestors.size === nodes.size, 'ORPHAN_WORK', 'A node without a causal path to the requested final product is not justified');
  check([...requirementIds].every(r => plan.nodes.some(n => ancestors.has(n.id) && n.requirementIds.includes(r))), 'PLAN_COVERAGE', 'Final product has incomplete requirement ancestry');
  validateBlindPlan(plan,{proposal});
  validateInputCopyPlan(plan,intent,{proposal});
  assertMissionDirectionPlan(missionDirection,plan,{roleLookup});
  return {valid: true, hash: sha256(plan), ordering, requirements: requirementIds.size, nodes: nodes.size};
}

/** Deterministic execution metadata. A node lease is not authority to perform tools. */
export class PlanLedger {
  constructor(store, {registry, clock = () => new Date().toISOString()} = {}) {
    check(registry && typeof registry.assertUsable === 'function', 'REGISTRY_REQUIRED', 'A trusted artifact registry is required');
    this.store = store; this.registry = registry; this.clock = clock; this.engine = null;
  }
  acquireEngine({ownerId, pid = process.pid}) {
    identifier(ownerId); integer(pid, 'pid', {min: 1});
    return this.store.transact(() => {
      const previous = this.store.get('engine', 'exclusive');
      if (previous?.data.ownerId) {
        if (this.engine?.epoch === previous.data.epoch && this.engine.ownerId === ownerId && previous.data.pid === pid) return previous.data;
        check(!ownerProcessIsAlive(previous.data), 'ENGINE_BUSY', 'A live or unverified legacy process owns this Store; time expiry never steals engine ownership');
      }
      const data = {ownerId, pid, processIdentity:captureProcessIdentity(pid), epoch: (previous?.data.epoch ?? 0) + 1, acquiredAt: this.clock()};
      this.store.put('engine', 'exclusive', data, {expectedVersion: previous?.version ?? 0}); this.engine = data; return data;
    });
  }
  assertEngine(ownerId = this.engine?.ownerId) {
    const current = this.store.get('engine', 'exclusive')?.data;
    check(this.engine && current?.ownerId === ownerId && current.epoch === this.engine.epoch && current.pid === this.engine.pid,
      'ENGINE_OWNERSHIP', 'Operation requires the current exclusive engine owner');
    return current;
  }
  releaseEngine(ownerId) {
    return this.store.transact(() => {
      this.assertEngine(ownerId); const current = this.store.get('engine', 'exclusive');
      this.store.put('engine', 'exclusive', {...current.data, ownerId: null, releasedAt: this.clock()}, {expectedVersion: current.version});
      this.engine = null;
    });
  }
  acceptedArtifact(artifactId, missionId, nodeId, purpose) {
    const artifact = this.registry.assertUsable(artifactId, {missionId, purpose});
    check(artifact.payload.nodeId === nodeId, 'ARTIFACT_NODE', 'Accepted artifact belongs to another node'); return artifact;
  }
  assertProduct(node, artifactId = node.artifactId) {
    check(artifactId, 'ARTIFACT_MISSING', 'Accepted node must name its accepted product');
    const artifact = this.acceptedArtifact(artifactId, node.missionId, node.nodeId, node.spec.purpose);
    const projectContext=projectContextDescriptor(this.store,node.missionId);
    if(projectContext&&isProjectContextIntakeNode(node.spec))assertProjectContextArtifactRead(this.registry,artifact,projectContext);
    check(artifact.payload.kind === node.spec.outputKind, 'ARTIFACT_KIND', 'Artifact kind differs from the planned product');
    check(canonical(artifact.payload.criteria) === canonical(node.spec.criteria), 'ARTIFACT_CRITERIA', 'Artifact criteria differ from the frozen node');
    const inherited=[];
    for (const dependency of node.spec.dependencies) {
      const parent = this.store.get('node', `${node.missionId}:${dependency.nodeId}`)?.data;
      check(parent?.status === 'ACCEPTED', 'NODE_DEPENDENCY', 'Material prerequisite is not accepted');
      const input = this.acceptedArtifact(parent.artifactId, node.missionId, dependency.nodeId, dependency.purpose);
      const refs=blindStage(node.spec)?[blindPlanProductDependency(this.registry,node,artifact)]:artifact.payload.inputRefs;
      check(refs.some(ref => ref.artifactId === input.id && ref.hash === input.payloadHash && ref.purpose === dependency.purpose),
        'ARTIFACT_DEPENDENCY', 'Artifact omits or substitutes the current exact material prerequisite');
      inherited.push(input.payload.requiredEffects??[]);
    }
    const expected=mergeRequiredEffects(node.spec.requiredEffects,...inherited);
    check(canonical(mergeRequiredEffects(artifact.payload.requiredEffects??[]))===canonical(expected),'ARTIFACT_EFFECTS','Artifact omits or substitutes frozen required effects');
    return artifact;
  }
  invalidateNode(record, reason, status = 'INVALIDATED') {
    this.assertEngine();
    if (record.data.artifactId) this.registry.invalidate([record.data.artifactId], reason);
    const data = {...record.data, status, fence: record.data.fence + 1, runId: null, leaseUntil: null,
      history: [...record.data.history, {status, at: this.clock(), detail: reason}]};
    this.store.put('node', record.id, data, {expectedVersion: record.version}); return data;
  }
  sync(missionId) {
    this.assertEngine();
    const record = this.store.get('plan', missionId); if (!record) return false;
    let planValid = true;
    try { this.acceptedArtifact(record.data.acceptedPlanArtifactId, missionId, 'planning', 'plan'); }
    catch (error) { if (!error.code || error.code.startsWith('STORAGE')) throw error; planValid = false; }
    const missionDirection=this.store.get('mission',missionId)?.data?.policy?.missionDirection;
    const projectContext=projectContextDescriptor(this.store,missionId);
    const ordered = validatePlan(record.data.plan, record.data.intent, {allowedTools: TOOL_NAMES,missionDirection,...(projectContext?{projectContext}:{})}).ordering;
    for (const nodeId of ordered) {
      const node = this.store.get('node', `${missionId}:${nodeId}`);
      let reason = planValid ? null : {reason: 'Plan acceptance is no longer usable'};
      if (!reason && ['ACCEPTED', 'RUNNING', 'REVIEW_PENDING'].includes(node.data.status)) {
        try {
          for (const d of node.data.spec.dependencies) check(this.store.get('node', `${missionId}:${d.nodeId}`)?.data.status === 'ACCEPTED', 'NODE_DEPENDENCY', 'Prerequisite invalidated');
          if (node.data.status === 'ACCEPTED') this.assertProduct(node.data);
        } catch (error) { if (!error.code || error.code.startsWith('STORAGE')) throw error; reason = {reason: 'Material validity changed', code: error.code}; }
      }
      if (reason && !['INVALIDATED', 'CANCELLED'].includes(node.data.status)) this.invalidateNode(node, reason);
    }
    return planValid;
  }
  install(missionId, plan, {intent, acceptedPlanArtifactId, allowedTools} = {}) {
    return this.store.transact(() => {
      this.assertEngine();
      check(acceptedPlanArtifactId, 'UNACCEPTED_PLAN', 'Plan needs its independent acceptance artifact');
      const artifact = this.acceptedArtifact(acceptedPlanArtifactId, missionId, 'planning', 'plan');
      let body; try { body = JSON.parse(artifact.payload.body); } catch { check(false, 'PLAN_ARTIFACT', 'Accepted plan body must be JSON'); }
      check(canonical(body) === canonical(plan), 'PLAN_ARTIFACT', 'Installed plan differs from the independently accepted body');
      const previous = this.store.get('plan', missionId);
      check(!previous || previous.data.intentHash === sha256(intent), 'MANDATE_DRIFT', 'Immutable request changed');
      const replacing=previous&&previous.data.acceptedPlanArtifactId!==acceptedPlanArtifactId;
      if(replacing)assertProspectiveBlindReplan(this.registry,missionId);
      const missionDirection=this.store.get('mission',missionId)?.data?.policy?.missionDirection;
      const projectContext=projectContextDescriptor(this.store,missionId);
      const validation = validatePlan(plan, intent, {previous: previous?.data.plan ?? null, allowedTools,missionDirection,...(projectContext?{projectContext}:{})});
      assertPlanRoleExecution(plan);
      const privateProtocols=new Set([...plan.nodes.filter(n=>blindStage(n)==='material').map(n=>n.execution.protocolNodeId),
        ...plan.nodes.filter(isInputCopyNode).map(n=>n.id)]);
      const preserved = new Set();
      for (const nodeId of validation.ordering) {
        const spec = plan.nodes.find(n => n.id === nodeId), old = this.store.get('node', `${missionId}:${nodeId}`);
        // A private protocol binds its exact independently accepted plan in
        // inputRefs. An unchanged node spec cannot rebind that old artifact.
        if(replacing&&privateProtocols.has(nodeId))continue;
        if (old && canonical(old.data.spec) === canonical(spec) && spec.dependencies.every(d => preserved.has(d.nodeId)) && old.data.status !== 'CANCELLED') {
          try { if (old.data.status === 'ACCEPTED') this.assertProduct(old.data); preserved.add(nodeId); }
          catch (error) { if (!error.code || error.code.startsWith('STORAGE')) throw error; }
        }
      }
      for (const old of this.store.list('node').filter(n => n.data.missionId === missionId)) {
        if (preserved.has(old.data.nodeId)) continue;
        check(!['RUNNING', 'REVIEW_PENDING'].includes(old.data.status), 'NODE_RUNNING', 'Recover or finish active work before replacing it');
        this.invalidateNode(old, {reason: replacing&&privateProtocols.has(old.data.nodeId)
          ? 'Replacement plan requires a newly produced and reviewed exact native-input or private-protocol binding'
          : 'Replan changed or retired node or prerequisite'}, plan.nodes.some(n => n.id === old.data.nodeId) ? 'INVALIDATED' : 'CANCELLED');
      }
      const record = this.store.put('plan', missionId, {plan, intent, intentHash: sha256(intent), acceptedPlanArtifactId}, {expectedVersion: previous?.version ?? 0});
      for (const node of plan.nodes) {
        const key = `${missionId}:${node.id}`, existing = this.store.get('node', key);
        if (preserved.has(node.id)) { this.store.put('node', key, {...existing.data, planVersion: record.version}, {expectedVersion: existing.version}); continue; }
        this.store.put('node', key, {missionId, nodeId: node.id, planVersion: record.version, spec: node, status: 'PENDING', attempt: existing?.data.attempt ?? 0,
          fence: (existing?.data.fence ?? 0) + 1, leaseUntil: null, runId: null, artifactId: null, history: existing?.data.history ?? []}, {expectedVersion: existing?.version ?? 0});
      }
      return record;
    });
  }
  ready(missionId) {
    return this.store.transact(() => {
      this.assertEngine(); if (!this.sync(missionId)) return [];
      const plan = this.store.get('plan', missionId).data.plan;
      return plan.nodes.map(n => this.store.get('node', `${missionId}:${n.id}`).data).filter(n => ['PENDING', 'RETURNED', 'INVALIDATED'].includes(n.status)
        && n.spec.dependencies.every(d => this.store.get('node', `${missionId}:${d.nodeId}`)?.data.status === 'ACCEPTED'));
    });
  }
  claim(missionId, nodeId, {runId, ttlMs = 900000} = {}) {
    identifier(runId); check(Number.isSafeInteger(ttlMs) && ttlMs > 0 && ttlMs <= 3600000, 'LEASE_TIME', 'Node lease duration invalid');
    return this.store.transact(() => {
      this.assertEngine();
      const key = `${missionId}:${nodeId}`; check(this.store.get('node', key), 'NOT_FOUND', 'Node does not exist');
      check(this.ready(missionId).some(n => n.nodeId === nodeId), 'NODE_NOT_READY', 'Node is not ready or already owned');
      const node = this.store.get('node', key);
      const data = {...node.data, status: 'RUNNING', runId, attempt: node.data.attempt + 1, fence: node.data.fence + 1,
        engineEpoch: this.engine.epoch, leaseUntil: new Date(instant(this.clock()) + ttlMs).toISOString()};
      this.store.put('node', key, data, {expectedVersion: node.version}); return data;
    });
  }
  transition(missionId, nodeId, {fence, runId, status, artifactId = null, detail = {}}) {
    const allowed = {RUNNING: ['REVIEW_PENDING', 'RETURNED', 'BLOCKED', 'CANCELLED'], REVIEW_PENDING: ['ACCEPTED', 'RETURNED', 'BLOCKED', 'CANCELLED']};
    return this.store.transact(() => {
      this.assertEngine();
      const key = `${missionId}:${nodeId}`, node = this.store.get('node', key); check(node, 'NOT_FOUND', 'Node does not exist');
      check(node.data.fence === fence && node.data.runId === runId && node.data.engineEpoch === this.engine.epoch, 'STALE_WORKER', 'Late worker is not the current node owner');
      check(allowed[node.data.status]?.includes(status), 'NODE_TRANSITION', 'Invalid node state transition');
      check(Date.parse(this.clock()) < Date.parse(node.data.leaseUntil), 'STALE_WORKER', 'Node ownership lease expired');
      if (status === 'ACCEPTED') {
        this.acceptedArtifact(this.store.get('plan', missionId).data.acceptedPlanArtifactId, missionId, 'planning', 'plan');
        const artifact = this.assertProduct(node.data, artifactId);
        check(artifact.payload.producerRunId === runId, 'ARTIFACT_PRODUCER', 'Product belongs to a different attempt');
      }
      const data = {...node.data, status, artifactId: artifactId ?? node.data.artifactId,
        history: [...node.data.history, {status, runId, fence, at: this.clock(), detail}]};
      this.store.put('node', key, data, {expectedVersion: node.version}); return data;
    });
  }
  renew(missionId,nodeId,{runId,fence,ttlMs=3600000}) {
    identifier(runId);integer(fence,'fence',{min:1});integer(ttlMs,'renewal ttl',{min:1,max:3600000});
    return this.store.transact(()=>{
      this.assertEngine();const record=this.store.get('node',`${missionId}:${nodeId}`),node=record?.data;
      check(node&&['RUNNING','REVIEW_PENDING'].includes(node.status)&&node.runId===runId&&node.fence===fence
        &&node.engineEpoch===this.engine.epoch&&instant(this.clock())<instant(node.leaseUntil),'STALE_WORKER','Only the current unexpired node owner may renew');
      const data={...node,leaseUntil:new Date(instant(this.clock())+ttlMs).toISOString()};
      this.store.put('node',record.id,data,{expectedVersion:record.version});return data;
    });
  }
  recover(missionId, {ownerId} = {}) {
    return this.store.transact(() => {
      check(ownerId, 'ENGINE_OWNERSHIP', 'Recovery needs an explicit engine owner'); this.assertEngine(ownerId);
      const recovered = [];
      for (const node of this.store.list('node').filter(n => n.data.missionId === missionId && ['RUNNING', 'REVIEW_PENDING'].includes(n.data.status))) {
        // Ownership is fenced here; effect reconciliation is a separate broker obligation.
        const data = {...node.data, status: 'RETURNED', fence: node.data.fence + 1, recoveryRunId: node.data.runId, runId: null, leaseUntil: null,
          history: [...node.data.history, {status: 'RETURNED', at: this.clock(), detail: {reason: 'Owner restart; reconcile effects before retry'}}]};
        this.store.put('node', node.id, data, {expectedVersion: node.version}); recovered.push(data.nodeId);
      }
      return recovered;
    });
  }
}
