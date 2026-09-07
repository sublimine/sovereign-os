# Arquitectura de Memoria Ω

**Versión:** 1.0.0

## 1. Stores separados

| Memoria | Alcance | Persistencia | Escritura |
|---|---|---|---|
| Working | instancia | efímera/checkpoint | instancia; no es verdad |
| Mission | misión | vida + retención | APPEND por participantes |
| Episodic | ejecuciones | histórica | AuditStore automática |
| Semantic | conocimiento reutilizable | versionada | PROPOSE; commit controlado |
| Institutional | políticas/charters | larga duración | ChangeSet aprobado |
| EvidenceLedger | evidencia | inmutable | APPEND Ω6/especialistas; VERIFY Ω7 |
| ClaimLedger | claims/estados | versionada | PROPOSE productores; VERIFY; COMMIT Ω12/policy |
| DecisionLedger | decisiones | inmutable/versionada | COMMIT Ω1/humano |
| AuditLedger | eventos/hallazgos | WORM | APPEND runtime/Ω3 |

## 2. Permisos

- **READ:** acceso por misión/clasificación/need-to-know.
- **APPEND:** añadir objeto nuevo; no editar anterior.
- **PROPOSE:** crear nueva versión candidata.
- **VERIFY:** adjuntar atestación, no alterar contenido.
- **COMMIT:** promover versión a estado institucional.
- **REVOKE:** marcar no vigente y disparar propagación.

Ningún agente obtiene COMMIT global. Ω7 verifica lineage; no decide verdad.
Ω12 commit de estado epistémico bajo protocolo; Ω1 commit de decisiones; Ω21
commit de política sólo tras aprobación; Ω24 sólo PROPOSE.

## 3. Versionado

Todo artefacto tiene ID estable, version semántica o monotonía por aggregate,
parent_version, author_instance, created_at UTC, status, evidence_refs,
dependency_refs, hash y superseded_by. No hay UPDATE destructivo. Ramas
concurrentes se comparan; el merge crea nueva versión con ambos padres.

## 4. Retrieval

Retrieval aplica: autorización → objetivo → relevancia → frescura → diversidad
→ token budget. Devuelve refs y extractos, no “memoria” sin fuente. Context
manifest registra query, ranker/version, candidatos omitidos y razón.
Summaries son artefactos derivados con dependencies; nunca sustituyen raw.

## 5. Interrupción y migración

Checkpoint contiene state, inputs/outputs por ref, pending events, leases,
budgets, random seeds, provider/model/tool versions y idempotency keys. Se
firma antes de PAUSED. Reanudar valida hashes, frescura y permisos; cambios de
mundo crean STALE events antes de READY.

## 6. Retención y borrado

Política por clasificación y ley. “Garbage collection” elimina working data y
credenciales efímeras; no borra ledgers sujetos a auditoría. Legal deletion
produce tombstone verificable y mantiene metadatos mínimos permitidos. Secretos
se cifran y separan de prompts/logs.

## 7. Dependencias e invalidación

DependencyGraph almacena typed edges: SUPPORTS, DERIVED_FROM, ASSUMES,
PARAMETERIZES, SUMMARIZES, CONTRADICTS, DECIDES_ON y INVALIDATES. Una
retractación ejecuta búsqueda transitiva, congela decisiones activas, emite
impact packets y agenda recomputación. Ω7 confirma cierre de propagación.

## 8. Memoria institucional segura

Lecciones de Ω24 entran como ChangeProposal, no como hechos. Deben citar
episodios, tamaño de muestra, efecto y riesgos. Tras shadow/eval/aprobación se
crea versión nueva; rollback restaura config previa sin borrar la nueva.

