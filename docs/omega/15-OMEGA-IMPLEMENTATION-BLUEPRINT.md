# Blueprint de Implementación Ω

## 1. Build order

1. **Immutable substrate:** IDs, clock, content hashes, ArtifactRegistry,
   EvidenceStore, Event/Audit stores and schema registry.
2. **Control plane:** PolicyDecisionPoint, capability leases, budgets,
   Scheduler, sandbox and HumanApprovalProvider.
3. **Mission kernel:** MissionSpec, state machines, event bus, inbox/outbox,
   checkpoint/recovery and DependencyGraph.
4. **Epistemic kernel:** Evidence/Claim/Contradiction, Ω7/Ω9–Ω12 gates and
   retraction propagation.
5. **Agent adapters:** load base policy + Ω overlay; enforce context manifest,
   model/tool route and structured output.
6. **Decision plane:** Ω13–Ω23 artifacts, quorum, dossier and decision ledger.
7. **Evolution plane:** Ω24 eval/shadow/canary/rollback.
8. **Command center:** render nodes/events/claims/gates from stores.

Do not begin with 24 long-running chat processes. Implement ledgers, policy and
state transitions first; roles are stateless workers over durable artifacts.

## 2. Minimum deployable architecture

- Relational metadata store with optimistic versioning.
- Object/blob store content-addressed by SHA-256.
- Directed graph store or indexed edge tables.
- Durable event bus supporting at-least-once and dead-letter.
- WORM audit copy outside operational administrator domain.
- Secret broker using short-lived handles.
- Sandbox execution service.
- Provider adapters for API, membership-assisted and local/deterministic modes.
- Stateless AgentRuntime workers and separate scheduler/control plane.

Technology selection is deferred; semantics in src/contracts are stable.

## 3. Persistence keys

- aggregate (type,id); monotonic version.
- artifact (id,version,schema_version,hash).
- event (event_id,aggregate_id,aggregate_version,idempotency_key).
- edge (from_ref,relation,to_ref,valid_from,valid_to).
- lease (principal,mission,capability,resource,expiry).
- claim resolution (claim_id,version,state,policy_version).

Never use mutable display title as identity.

## 4. Transaction boundaries

Artifact + outbox event commit together. Consumers store inbox receipt before
side effect. Claim COMMIT uses expected version. External effect saga records
authorization, request, provider acknowledgement, observed outcome and
compensation. Decision issuance and DecisionLedger append are atomic.

## 5. Enforcement, not prompting

Must be code/policy enforced: authority, secret/tool access, sandbox, schema,
budget, child/depth limits, blindness/communication isolation, WORM audit,
idempotency, gate transition and nonwaivable waiver denial. Prompts guide
analysis; they are not security boundaries.

## 6. Initial milestones

### M0 — Replayable skeleton

Mission create/pause/resume; artifact/event storage; schema validation; UI
status; provider stub. Exit: crash/restart replays same terminal state.

### M1 — Evidence integrity

Evidence/Claim/Provenance/Contradiction and root-correction. Exit: retract root
invalidates 10k descendants idempotently with no unrelated invalidation.

### M2 — Independent verification

Blind broker, routes, Ω9–Ω12 and dependency graph. Exit: simulation F catches
20 copied sources and blocks corroboration.

### M3 — Sovereign decision

Ω1–Ω23 activation, gates, dossier, waiver/human approval. Exit: simulations
A–G produce required states and no unauthorized effect.

### M4 — Institutional evolution

Ω24 eval/shadow/canary/rollback and long-run migration. Exit: model/schema
change rolls back during a multi-week replay without lineage loss.

## 7. Production acceptance

- all JSON Schema validated by a standards-compliant validator;
- all tests plus fault-injection and load suites;
- external Ω3-style audit;
- threat model and recovery drill;
- calibrators marked insufficient until real sample thresholds;
- no placeholder credentials/provider assumptions;
- runbooks for incident, veto, retraction, migration and rollback;
- explicit human principals and legal jurisdictions configured.

