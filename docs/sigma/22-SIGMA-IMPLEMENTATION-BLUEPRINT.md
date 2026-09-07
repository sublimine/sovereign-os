# Implementation Blueprint Σ

## Phase 0 — Governance freeze

Load constitutions, ADR, schema registry, charter hashes and release policy.
Exit: precedence and signature verification; no runtime effects.

## Phase 1 — Artifact/control kernel

Implement Registry, PolicyDecisionPoint, leases, event/state/audit stores,
content-addressed evidence and dependency graph. Exit: authority, idempotency,
retraction, pause/resume and disaster restore tests.

## Phase 2 — Safe intake/source plane

Quarantine/parser, SourceRegistry, handling/compartments, dependency graph and
operational provenance. Exit: malicious corpus, secret isolation, 20-source echo
and compromised-source replay tests.

## Phase 3 — Reality structures

EntityResolver, time normalization, network/measurement/semantic pipelines and
knowledge graph migration. Exit: false merge/split, clock/unit/edge and schema
rollback tests.

## Phase 4 — Analytic plane

HypothesisStore, fusion, actor/context/causal, deception, anomaly and estimate.
Exit: model differential evals, calibration baselines and no-self-certification.

## Phase 5 — Warning/product/continuity

IndicatorEngine, durable WatchScheduler, product/dissemination, notification,
handover and feedback. Exit: clock/restart/missed-warning/revocation tests.

## Phase 6 — Provider adapters

API/subscription/local/human adapters; exact model/version eval matrix. Exit S3.

## Phase 7 — Shadow and scale

Historical replay, live shadow, fault injection, red team, 100× corpus, provider
outage, partition, key compromise, queue backpressure. Exit S4.

## Phase 8 — Controlled production

Canary limited decisions, independent Ω3/security/legal audit, calibration and
outcome review. Exit S5 only after sufficient sample and rollback proof.

## Non-negotiable release gates

No placeholder credentials; no unversioned prompts/tools; no secret in logs;
zero schema/authority failure; all open hard findings closed; external effects
human-authorized; rollback and notification tested; maturity claim exactly
matches evidence.

