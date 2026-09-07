# ADR-0003 — Arquitectura institucional independiente del runtime

**Estado:** ACCEPTED · **Versión:** 1.0.0

Decision: institutional semantics depend on AgentRuntime/ModelProvider/
ToolProvider/MemoryProvider/EvidenceStore/StateStore/AuditStore/EventBus/
Scheduler/Sandbox/HumanApprovalProvider abstractions, not LangGraph or any
vendor. Adapters may change; charters, authority and artifacts do not.

