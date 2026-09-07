# Runtime Integration and Ports Σ

## 1. Reused Ω ports

AgentRuntime, ModelProvider, ToolProvider, MemoryProvider, EvidenceStore,
StateStore, AuditStore, EventBus, Scheduler, Sandbox, HumanApprovalProvider,
PolicyDecisionPoint, DependencyGraph and ArtifactRegistry.

## 2. Σ-specific ports

| Port | Required operations | Invariant |
|---|---|---|
| CollectionProvider | plan/task/cancel/checkpoint/result | no authority expansion |
| SourceRegistry | register/resolve/assess/seal/revoke | identity and claim separate |
| EntityResolver | propose/merge/split/branch | reversible and evidenced |
| KnowledgeGraph | append/query/version/invalidate | typed edges + provenance |
| HypothesisStore | freeze/update/compare/resolve | no winner deletion |
| IndicatorEngine | register/evaluate/subscribe/resolve | event-time/freshness |
| WatchScheduler | schedule/handover/recover | durable timers/cursors |
| CompartmentManager | grant/revoke/seal/audit | purpose-bound least privilege |
| DisseminationProvider | authorize/publish/notify/revoke | audience/version tracked |
| CounterintelligenceMonitor | signal/freeze/case/handoff | protected channel |
| OutcomeFeedbackProvider | link/label/adjudicate | no hindsight rewrite |

## 3. Adapter contract

API, subscription-assisted coding agent, local model or human tool must expose
capability, reproducibility, context window, tool/effect profile, data residency,
version, cost and health. Unsupported operation returns typed failure. No
adapter can emulate success in prose.

## 4. Consistency

Transactional outbox for artifact+event; inbox dedup; expected_version CAS;
saga for external effects; content-addressed evidence; signed config hashes;
WORM audit; dead-letter queue. Event order only per aggregate.

## 5. Observability

Every node: agent role+instance, mission/requirement, state, model/provider,
tools, context tokens, duration, cost, children, source/evidence/claim counts,
effective independence, confidence basis, blockers, gates, output, retries and
next event. Sensitive payload hidden; metadata disclosure follows compartment.

## 6. Reference versus production

`src/reference/sigma-kernel.mjs` demonstrates semantics for authorization,
quarantine, dependency collapse, coverage, warning, retraction and completion.
It is single-process reference code, not durable production service.

