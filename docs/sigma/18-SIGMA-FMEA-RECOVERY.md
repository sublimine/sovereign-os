# FMEA y Recuperación Σ

**Fuente efectiva:** `config/sigma/fmea.json` contiene 320 filas role-specific.

## 1. Familias

| Perfil | Detecta | Contiene | Recupera | Revalida | Escala |
|---|---|---|---|---|---|
| AUTHORITY | PDP/lease/audit | deny/freeze | resolve tuple | policy replay | Ω21/human |
| EVIDENCE | hash/lineage/claim | quarantine/freeze | reacquire/root-cause | Σ17/Ω11 | Ω3 |
| INDEPENDENCE | dependency/contamination | remove false quorum | blind route | Σ16/Ω9/10 | Ω3 |
| METHOD | oracle/calibration | invalidate/circuit break | alternate/replay | independent method | Ω24 |
| SECURITY | anomaly/CI | stop/revoke/isolate | restore/redesign | Σ30/Ω14 | Ω19/21 |
| OBJECTIVE | decision/requirement diff | pause/freeze root | restore/replan | Σ5/Σ3 | Ω2 |
| QUALITY | gate/audit | block commit | earliest owner | Σ38/Ω22 | Ω3 |
| LIVENESS | telemetry/wait graph | checkpoint/backpressure | failover/resume | liveness/budget | Ω20 |

## 2. Mandatory failure set

Además de ocho fallos específicos por rol: hallucination, false certainty,
context overflow, lost requirement, circular evidence, compromised source,
stale data, tool/model/provider failure, malicious input, injection, loop,
duplicate work, premature convergence, deadlock, false consensus, excessive/
under delegation, privilege leak, key compromise, clock drift, schema migration,
partition, backpressure collapse y notification failure.

## 3. Root-cause recovery

Contain side effects and publication; traverse graph backwards; choose earliest
invalid source/measurement/entity/method/assumption node; invalidate all forward
paths; recompute minimal subgraph; use independent revalidator; republish and
notify. Idempotency ensures repeated invalidation yields same set/status.

## 4. Disaster recovery

Independent backups, external hash anchor, key rotation/re-attestation, dual
provider and clean-room bootstrap. A “backup” passes only after restore drill,
artifact/hash reconciliation, lease invalidation and watch timer recovery.

