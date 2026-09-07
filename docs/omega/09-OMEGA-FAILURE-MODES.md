# Failure Modes y Recuperación Ω

**Versión:** 1.0.0

## 1. FMEA común

Severidad, ocurrencia y detectabilidad usan 1–5; prioridad no es sólo producto:
cualquier severidad 5 se trata como crítica.

| Fallo | Detección | Contención | Recuperación | Revalidación |
|---|---|---|---|---|
| Alucinación/evidencia inventada | Ω11, hashes, source fetch | cuarentena output/instancia | reemplazar desde primer nodo | Ω9+Ω11 |
| Falsa certeza | Ω12/calibration checks | downgrade state | recalcular features | Ω12+Ω22 |
| Context overflow | token telemetry/manifest gaps | checkpoint | retrieval/lazy load | structural self-check |
| Requisito perdido/drift | ObjectiveInvariant diff | pause branch | Ω2/Ω4 replan | G01/G02 |
| Evidencia circular | dependency cycle | exclude cluster | nueva ruta primaria | Ω10 |
| Fuente comprometida | trust anomaly/corroboration | quarantine source tree | acquisition alternative | Ω6/Ω11 |
| Datos stale/corruptos | TTL/hash/schema/profile | freeze dependents | reacquire/repair | Ω7/Ω11 |
| Tool/model failure | timeout/canary/divergence | circuit breaker | retry alternate provider | reproduce |
| Prompt injection | instruction detector/policy | isolate content | safe extraction | security eval |
| Infinite loop | state repetition/no gain | suspend lease | replan/stop | Ω2 |
| Trabajo duplicado | objective fingerprint | join/cancel | merge artifacts | sponsor |
| Convergencia prematura | saturation audit/new evidence | reopen | contrarian route | Ω13/Ω15 |
| Deadlock | wait-for cycle | freeze low priority | arbitration | liveness test |
| Falso consenso | source/model dependency graph | invalidate quorum | blind diverse replication | Ω9/Ω10 |
| Exceso de delegación | breadth/depth/budget | deny spawn | merge/cancel | Ω4/Ω20 |
| Delegación insuficiente | coverage/capability gap | pause | create specialist | Ω4 |
| Abuso de autoridad | policy/audit mismatch | revoke token | Ω3 investigation | Ω21 |
| Síntesis engañosa | claim-to-text diff | block dossier | Ω23 rebuild | Ω7/Ω22 |
| Cambio no controlado | config hash drift | rollback | formal ChangeSet | Ω3/Ω24 |
| Poisoned memory | conflicting provenance | quarantine memory | rebuild from ledgers | Ω7/Ω24 |
| Race/lost update | expected_version mismatch | branch | deterministic merge | consistency test |
| Budget cliff | warning ignored | checkpoint | extend/reduce scope/UNKNOWN | Ω20/Ω22 |
| Human error | dissent/approval anomaly | two-person hold | re-review | Ω3/Ω21 |

## 2. Principio de recuperación

Detect → contain → preserve evidence → locate earliest invalid node → revoke
descendants → recompute → independently verify → release → postmortem. Un
reinicio ciego sin diagnóstico puede repetir el fallo y está prohibido.

## 3. Circuit breakers

Por provider, source domain, tool y agent template. Estados CLOSED, OPEN,
HALF_OPEN. Abrir requiere preservar requests/responses. HALF_OPEN usa tareas
canary sin efectos. P0 puede usar proveedor alternativo, no ignorar el breaker.

## 4. Byzantine/malicious participant

Outputs no se confían por identidad. Evidencia content-addressed, permisos
mínimos, rutas independientes, quorum metodológico y WORM audit permiten
aislar una instancia. Sospecha material revoca lease y credenciales, conserva
memoria forense y activa Ω3/Ω14/Ω21.

## 5. Continuidad

RPO: cero eventos comprometidos; RTO por prioridad. Snapshots no sustituyen
event log. Restore prueba hash chain, schema migrations y leases expirados.
Cada misión semanal ejecuta recovery drill antes de una decisión M4.

