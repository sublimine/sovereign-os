# Contratos de Ports Runtime-Neutral

**Versión de interfaz:** 1.0

| Port | Operaciones mínimas | Garantías |
|---|---|---|
| AgentRuntime | start, step, checkpoint, pause, resume, terminate | charter enforced; state event emitted |
| ModelProvider | assess, invoke, cancel, usage, lineage | tier/capability not brand; exact version |
| ToolProvider | discover, authorize, invoke, revoke | allowlist, idempotency, effect class |
| MemoryProvider | read, append, propose, verify, commit, revoke | scope/version/CAS |
| EvidenceStore | put, get, snapshot, verifyHash, quarantine | content-addressed immutable |
| StateStore | appendEvent, snapshot, load, compareAndSwap | per-aggregate order |
| AuditStore | append, verifyChain, export, anchor | WORM, independent anchor |
| EventBus | publish, subscribe, ack, deadLetter | at-least-once; dedup key |
| Scheduler | schedule, lease, renew, preempt, backpressure | priority + protected reserves |
| Sandbox | create, mount, networkPolicy, execute, destroy | deny default; resource limits |
| HumanApprovalProvider | request, approve, deny, expire, verify | identity, exact action, no blanket |
| PolicyDecisionPoint | evaluate, explain, revoke | default deny, versioned policy |
| DependencyGraph | link, ancestors, descendants, invalidate, closure | typed edges, cursors |
| ArtifactRegistry | register, resolve, supersede, migrate | ID+version; no silent latest |

## Provider modes

ModelProvider supports API_AUTOMATED, MEMBERSHIP_ASSISTED, LOCAL_MODEL and
DETERMINISTIC. Membership-assisted work still requires artifact ingestion,
model/session identification when available, human/operator event, and no
assumption of programmatic concurrency. If automation cannot enforce blind
isolation, the route is marked lower independence or is not used for M4.

## Adapter conformance

An adapter must publish RuntimePortManifest, pass idempotency/recovery/authority
tests, demonstrate secret isolation and declare limits. Unsupported operation
returns CAPABILITY_UNAVAILABLE; it never silently emulates a security property.

