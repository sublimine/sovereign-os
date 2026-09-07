# ADR-0002 — Event sourcing y artefactos versionados

**Estado:** ACCEPTED · **Versión:** 1.0.0

Decision: persistent typed artifacts and immutable events are the source of
truth; chat is not. Consequences: idempotency, forensic replay, retraction
propagation and long-run migration become implementable; storage/registry
operations must be engineered as first-class infrastructure.

