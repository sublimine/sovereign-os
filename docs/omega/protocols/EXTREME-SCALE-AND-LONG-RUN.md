# Escala Extrema y Misiones de Larga Duración

## Millones de elementos

- Evidence blobs content-addressed and sharded; metadata indexed separately.
- Map workers process immutable partitions; reduce receives typed summaries
  with coverage and omission manifests.
- DependencyGraph partitioned by mission/claim cluster; cross-partition edges
  live in a durable edge index.
- Backpressure derives from storage/verification queues; no unbounded spawn.
- Approximate search can prioritize, never discard final candidates without
  recorded recall estimate.
- Reservoir/risk-based samples monitor extraction quality; material anomalies
  trigger full or targeted replay.

## Weeks and upgrades

Each node has lease, heartbeat, checkpoint, schema/model/tool pin and owner.
Daily reconciliation detects orphan tasks, stale evidence and schema drift.
Schema migrations use dual-read, shadow replay, checksum totals and rollback.
Model changes create a new execution version; no mid-node invisible swap.

## Failure domains

M4 replicas and gates distribute across providers, regions, credentials and
stores where feasible. WORM AuditStore has independent backup and external
hash anchor. Key compromise triggers revocation, re-attestation and audit
reconstruction; signatures alone do not validate content.

## Restart/migration

Restore snapshot + events, validate hash chain, expire leases, reauthorize
secrets, refresh TTL, replay pending inbox idempotently, and run canary before
ACTIVE. RPO zero committed events; RTO defined by P class.

## Load shedding

P4/P3 speculative nodes pause first; verification, audit, risk and lineage
reserves remain. If critical capacity unavailable, status CAPABILITY_UNAVAILABLE
or BUDGET_EXHAUSTED, never an unverified shortcut.

