# Reconsideration and Retraction Protocol

Triggers: source compromise, claim retraction, entity split/merge, time revision,
measurement change, ontology migration, estimate signpost, warning miss, new
counterevidence, expired TTL or audit finding.

```text
TRIGGER → FREEZE CONSUMERS → BACKTRACE
→ EARLIEST INVALID NODE → FORWARD IMPACT SET
→ STATUS INVALIDATED/STALE → RECOMPUTE MINIMAL SUBGRAPH
→ INDEPENDENT REVIEW → NEW VERSION → DIRECT NOTIFICATION
→ PROPAGATION ACK → CLOSE
```

Repeated trigger is idempotent. Parallel corrections branch and merge only after
conflict record. Affected sovereign decisions are never silently changed; Ω2/Ω23
receive impact and Ω1/human reviews action.

