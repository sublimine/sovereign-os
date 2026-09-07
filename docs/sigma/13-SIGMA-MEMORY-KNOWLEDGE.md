# Memoria, Knowledge Graph y Continuidad Σ

## 1. Stores

- Working: efímera, por instancia, no verdad.
- Mission: event log/checkpoints/artifacts del objetivo.
- Source: identities, handling, reliability features y history por task class.
- Evidence: immutable content-addressed snapshots/extractions.
- Entity/Event/Network: estructuras versionadas con incertidumbre.
- Hypothesis/Estimate: frozen commits y resolution outcomes.
- Indicator/Watch: persistent timers/cursors/thresholds.
- Product/Consumer: versions, audiences, corrections.
- Effectiveness: outcomes, calibration, utility, cost.

## 2. Permissions

Roles COMMIT un único ledger exclusivo definido en config. Otros cambios son
PROPOSE o VERIFY. Cross-compartment retrieval requiere purpose-bound lease. Ω3
audit-read y Ω7 lineage-read no implican unrestricted secret plaintext.

## 3. Knowledge graph

Nodes distinguen source, evidence, datum, entity, event, relation, claim,
hypothesis, estimate, indicator, product y decision. Edge type no se sobrecarga:
`SUPPORTED_BY` ≠ `DERIVED_FROM` ≠ `PREDICTS` ≠ `CONTRADICTS` ≠ `DEPENDS_ON`.
Hypothesis edges nunca se consultan como fact edges.

## 4. Versioning

ID estable + immutable version; parent(s); author; charter/model/tool versions;
time; status; hash; evidence/dependency; superseded_by. Migrations breaking usan
dual-read, backfill, validation, cutover y rollback; no silent `latest` en
misión activa.

## 5. Retrieval

Authority→objective→relevance→freshness→dependency distance→diversity→token
budget. Retrieved summary incluye source refs and omissions. Lazy load conserva
drill-down. Poisoned memory se cuarentena y sus consumidores se invalidan.

## 6. Long-run

Snapshots no contienen autoridad viva; leases revalidan. Provider/model changes
crean new execution branch. Handover preserva open gaps, dissent, active watches,
consumer obligations and next events. Weeks-long missions survive process/machine
restart from state+artifacts, not transcript.

