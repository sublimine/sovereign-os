export type Ref = string;
export type Version = string;
export type Classification =
  | "PUBLIC" | "INTERNAL" | "CONFIDENTIAL" | "SECRET" | "RESTRICTED";
export type MissionStatus =
  | "CREATED" | "AUTHORIZING" | "READY" | "ACTIVE" | "WAITING_EVENT"
  | "VERIFYING" | "CHALLENGED" | "BLOCKED" | "ESCALATED" | "PAUSED"
  | "RECOVERING" | "COMPLETE" | "PARTIAL" | "UNKNOWN" | "ABORTED" | "FAILED";

export interface InvocationContext {
  missionId: Ref;
  agentRoleId: Ref;
  agentInstanceId: Ref;
  capabilityLeaseId: Ref;
  classification: Classification;
  correlationId: Ref;
  causationId?: Ref;
  idempotencyKey: Ref;
  deadline: string;
}

export interface ArtifactRef {
  id: Ref;
  version: number;
  schemaId: Ref;
  schemaVersion: Version;
  contentHash: string;
}

export interface CapabilityAssessment {
  supported: boolean;
  minimumTier?: "A" | "B" | "C" | "D" | "LOCAL_DETERMINISTIC";
  evalMargin?: number;
  limits: string[];
  independenceLineage: Record<string, string>;
}

export interface AgentRuntime {
  start(charter: ArtifactRef, mission: ArtifactRef, ctx: InvocationContext): Promise<Ref>;
  step(instanceId: Ref, event: OmegaEvent, ctx: InvocationContext): Promise<ArtifactRef[]>;
  checkpoint(instanceId: Ref, ctx: InvocationContext): Promise<ArtifactRef>;
  pause(instanceId: Ref, reason: string, ctx: InvocationContext): Promise<void>;
  resume(instanceId: Ref, checkpoint: ArtifactRef, ctx: InvocationContext): Promise<void>;
  terminate(instanceId: Ref, reason: string, ctx: InvocationContext): Promise<void>;
}

export interface ModelRequest {
  capability: string;
  minimumTier: "A" | "B" | "C" | "D" | "LOCAL_DETERMINISTIC";
  maximumTier: "A" | "B" | "C" | "D" | "LOCAL_DETERMINISTIC";
  effort: "low" | "medium" | "high" | "maximum";
  contextManifest: ArtifactRef;
  outputSchema: Ref;
  blindRouteId?: Ref;
}

export interface ModelResult {
  output: unknown;
  providerMode: "API_AUTOMATED" | "MEMBERSHIP_ASSISTED" | "LOCAL_MODEL" | "DETERMINISTIC";
  provider: string;
  modelVersion: string;
  promptVersion: string;
  usage: Record<string, number>;
  lineage: Record<string, string>;
}

export interface ModelProvider {
  assess(request: ModelRequest, ctx: InvocationContext): Promise<CapabilityAssessment>;
  invoke(request: ModelRequest, ctx: InvocationContext): Promise<ModelResult>;
  cancel(invocationId: Ref, ctx: InvocationContext): Promise<void>;
}

export interface ToolCall {
  toolId: Ref;
  toolVersion: Version;
  effectClass: "READ" | "COMPUTE" | "WORKSPACE_WRITE" | "EXTERNAL_EFFECT" | "DANGEROUS_EFFECT";
  arguments: unknown;
  outputSchema: Ref;
}

export interface ToolProvider {
  discover(capability: string, ctx: InvocationContext): Promise<Ref[]>;
  authorize(call: ToolCall, ctx: InvocationContext): Promise<Ref>;
  invoke(call: ToolCall, authorization: Ref, ctx: InvocationContext): Promise<ArtifactRef>;
  revoke(authorization: Ref, ctx: InvocationContext): Promise<void>;
}

export type MemoryAction = "READ" | "APPEND" | "PROPOSE" | "VERIFY" | "COMMIT" | "REVOKE";
export interface MemoryProvider {
  read(ref: ArtifactRef, ctx: InvocationContext): Promise<unknown>;
  write(action: MemoryAction, artifact: unknown, expectedVersion: number | null, ctx: InvocationContext): Promise<ArtifactRef>;
}

export interface EvidenceStore {
  put(bytes: Uint8Array, metadata: unknown, ctx: InvocationContext): Promise<ArtifactRef>;
  get(ref: ArtifactRef, ctx: InvocationContext): Promise<Uint8Array>;
  snapshot(locator: string, ctx: InvocationContext): Promise<ArtifactRef>;
  verifyHash(ref: ArtifactRef, ctx: InvocationContext): Promise<boolean>;
  quarantine(ref: ArtifactRef, reason: string, ctx: InvocationContext): Promise<void>;
}

export interface StateStore {
  appendEvent(event: OmegaEvent, expectedAggregateVersion: number, ctx: InvocationContext): Promise<void>;
  snapshot(aggregateId: Ref, ctx: InvocationContext): Promise<ArtifactRef>;
  load(aggregateId: Ref, ctx: InvocationContext): Promise<OmegaEvent[]>;
}

export interface AuditStore {
  append(event: OmegaEvent, ctx: InvocationContext): Promise<void>;
  verifyChain(aggregateId: Ref): Promise<boolean>;
  export(scope: Ref, ctx: InvocationContext): Promise<ArtifactRef>;
  anchor(hash: string, ctx: InvocationContext): Promise<Ref>;
}

export interface OmegaEvent {
  eventId: Ref;
  eventType: string;
  eventVersion: number;
  aggregateId: Ref;
  aggregateVersion: number;
  missionId: Ref;
  actor: Ref;
  occurredAt: string;
  correlationId: Ref;
  causationId?: Ref;
  idempotencyKey: Ref;
  payloadHash: string;
  payload: unknown;
}

export interface EventBus {
  publish(event: OmegaEvent, ctx: InvocationContext): Promise<void>;
  subscribe(eventTypes: string[], consumer: Ref, ctx: InvocationContext): Promise<Ref>;
  acknowledge(subscription: Ref, eventId: Ref, ctx: InvocationContext): Promise<void>;
  deadLetter(event: OmegaEvent, reason: string, ctx: InvocationContext): Promise<void>;
}

export interface Scheduler {
  schedule(mandate: ArtifactRef, ctx: InvocationContext): Promise<Ref>;
  lease(instanceId: Ref, budget: ArtifactRef, ctx: InvocationContext): Promise<Ref>;
  renew(leaseId: Ref, ctx: InvocationContext): Promise<void>;
  preempt(instanceId: Ref, reason: string, ctx: InvocationContext): Promise<void>;
  setBackpressure(queue: Ref, level: number, ctx: InvocationContext): Promise<void>;
}

export interface Sandbox {
  create(profile: Ref, ctx: InvocationContext): Promise<Ref>;
  mount(sandbox: Ref, artifact: ArtifactRef, mode: "READ_ONLY" | "READ_WRITE", ctx: InvocationContext): Promise<void>;
  setNetworkPolicy(sandbox: Ref, policy: ArtifactRef, ctx: InvocationContext): Promise<void>;
  execute(sandbox: Ref, call: ToolCall, ctx: InvocationContext): Promise<ArtifactRef>;
  destroy(sandbox: Ref, ctx: InvocationContext): Promise<void>;
}

export interface HumanApprovalProvider {
  request(action: ArtifactRef, ctx: InvocationContext): Promise<Ref>;
  decide(requestId: Ref, decision: "APPROVE" | "DENY", signer: Ref, ctx: InvocationContext): Promise<ArtifactRef>;
  expire(requestId: Ref, ctx: InvocationContext): Promise<void>;
  verify(approval: ArtifactRef, ctx: InvocationContext): Promise<boolean>;
}

export interface PolicyDecisionPoint {
  evaluate(subject: Ref, action: string, resource: Ref, ctx: InvocationContext): Promise<{
    effect: "ALLOW" | "DENY" | "HUMAN_REQUIRED";
    policyVersion: Version;
    reasons: string[];
    conditions: string[];
  }>;
  revoke(capabilityLease: Ref, reason: string, ctx: InvocationContext): Promise<void>;
}

export interface DependencyGraph {
  link(from: ArtifactRef, relation: string, to: ArtifactRef, ctx: InvocationContext): Promise<void>;
  ancestors(ref: ArtifactRef, cursor?: Ref): Promise<{items: ArtifactRef[]; cursor?: Ref}>;
  descendants(ref: ArtifactRef, cursor?: Ref): Promise<{items: ArtifactRef[]; cursor?: Ref}>;
  invalidate(ref: ArtifactRef, reason: Ref, ctx: InvocationContext): Promise<Ref>;
  closePropagation(jobId: Ref, ctx: InvocationContext): Promise<ArtifactRef>;
}

export interface ArtifactRegistry {
  register(artifact: unknown, schema: Ref, ctx: InvocationContext): Promise<ArtifactRef>;
  resolve(id: Ref, version: number, ctx: InvocationContext): Promise<ArtifactRef>;
  supersede(oldRef: ArtifactRef, replacement: ArtifactRef, ctx: InvocationContext): Promise<void>;
  migrate(ref: ArtifactRef, targetSchemaVersion: Version, ctx: InvocationContext): Promise<ArtifactRef>;
}

