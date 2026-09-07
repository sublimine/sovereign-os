# Arquitectura del Sistema Ω

**Versión:** 1.0.0  
**Estado:** ACTIVE

## 1. Modelo institucional

Ω es un sistema de control institucional orientado a artefactos, dirigido por
eventos y persistido por event sourcing. Los agentes son funciones con
autoridad y contratos; no personajes. Una ejecución concreta es una
**AgentInstance**. El rol estable es **AgentRole**. La receta reutilizable es
**AgentTemplate**. Una aptitud componible es **AgentCapability**.

## 2. Seis planos

### 2.1 Plano soberano

Ω1 decide; Ω2 protege intención y gestiona cartera; Ω21 confirma
autorizabilidad; Ω20 asigna capacidad. Sólo recibe paquetes de alta densidad.

### 2.2 Plano de diseño de misión

Ω4 convierte MissionSpec en grafo de trabajo. Ω5 traduce objetivos en
Priority Intelligence Requirements. Cada nodo declara productor, dependencias,
artefacto, presupuesto, gate y criterio de terminación.

### 2.3 Plano de realidad

Ω6 diseña adquisición multivía; Ω7 fuerza lineage; Ω8 construye mecanismos,
contexto y causalidad. Los departamentos inferiores ejecutan adquisiciones y
análisis intensivos.

### 2.4 Plano de verdad

Ω9 replica por ruta ciega; Ω10 calcula independencia y triangula; Ω11
atomiza y verifica claims; Ω12 gobierna estados y lenguaje epistémico. Este
plano no recibe autoridad de alterar la decisión.

### 2.5 Plano adversarial y prospectivo

Ω13 descubre supuestos; Ω14 provoca fallos reales; Ω15 busca contrahipótesis;
Ω16 simula; Ω17 diseña opciones estratégicas; Ω18 propaga impactos; Ω19 prueba
colas, cascadas y recuperación.

### 2.6 Plano de aseguramiento y aprendizaje

Ω3 audita proceso con canal independiente. Ω22 certifica estándar integral.
Ω23 construye dossier con drill-down. Ω24 gobierna aprendizaje y cambios.

## 3. Núcleo runtime-neutral

Interfaces requeridas:

| Interfaz | Semántica estable |
|---|---|
| AgentRuntime | Ejecuta state machine, aplica charter y emite eventos. |
| ModelProvider | Selecciona capacidad; soporta API, suscripción asistida o local. |
| ToolProvider | Descubre y concede herramientas mediante capabilities. |
| MemoryProvider | Lee/escribe scopes con control READ/APPEND/PROPOSE/VERIFY/COMMIT/REVOKE. |
| EvidenceStore | Almacén content-addressed, inmutable y versionado. |
| StateStore | Snapshots + log de eventos; compare-and-swap. |
| AuditStore | WORM append-only, firmas y export forense. |
| EventBus | Entrega al menos una vez, claves de idempotencia y dead letters. |
| Scheduler | Prioridad, presupuesto, leases, deadlines y fairness. |
| Sandbox | Aislamiento de red, filesystem, ejecución y secretos. |
| HumanApprovalProvider | Solicitudes firmadas, expiración y separación de funciones. |
| PolicyDecisionPoint | Evalúa autoridad, clasificación, riesgo y gate antes de actuar. |
| DependencyGraph | Relaciona evidence→claim→finding→modelo→decisión. |
| ArtifactRegistry | Schema, versión, estado, propietario y supersession. |

Un adaptador LangGraph, Codex, Claude Code u otro implementa estas interfaces;
no modifica la semántica institucional.

## 4. Ingesta de misión

Un texto breve se transforma sin exigir al usuario un workflow:

1. Ω2 crea **MissionIntentDraft**, preserva palabras originales y separa
   objetivo, método solicitado y restricciones.
2. Ω4 produce **MissionSpec** y un grafo mínimo suficiente.
3. Ω2 calcula prioridad, materialidad y vector de activación.
4. Ω21 marca acciones no autorizables o dependientes de aprobación.
5. Ω20 concede presupuesto inicial.
6. El scheduler activa únicamente roles necesarios.
7. Si el método no sirve al objetivo, se emite
   **OBJECTIVE_METHOD_CONFLICT**; Ω2 lo resuelve o escala.

La intención original se guarda por hash. Cada submisión enlaza a un
**ObjectiveInvariant** y prueba cómo contribuye.

## 5. Activación contextual

### 5.1 Vector

El **ActivationAssessment** puntúa 0–5:

- S: severidad;
- U: incertidumbre;
- I: irreversibilidad;
- F: sensibilidad factual;
- X: complejidad/interdependencia;
- R: riesgo adversarial/seguridad;
- C: capital comprometido;
- L: legitimidad/regulación;
- H: duración y continuidad;
- N: novedad.

No se reduce todo a una media. Hay reglas duras y perfiles por agente.

### 5.2 Bandas

| Banda | Condición orientativa | Ω típicos |
|---|---|---|
| A0 | todos ≤1, M0 | Ω2, Ω4, productor, Ω23, gate ligero Ω22 |
| A1 | max 2 o M1 | 5–9 Ω según dominio |
| A2 | max 3 o M2 | verificación y riesgo selectivos |
| A3 | max 4 o M3 | independencia completa; 12–18 Ω |
| A4 | cualquier 5, P0 o M4 | los 24 salvo exclusión razonada |

Reglas duras: F≥3 activa Ω7 y Ω11; U≥3 activa Ω9/Ω10/Ω12; I≥4 activa
Ω13/Ω14/Ω18/Ω19/Ω21/Ω22; C≥4 activa Ω20; H≥3 activa Ω24; evidencia externa
activa controles Ω6/Ω7; decisión estratégica activa Ω17.

Un agente se excluye si no tiene deliverable material, su capacidad ya está
cubierta sin pérdida de independencia, o el coste supera valor decisional. La
exclusión queda en **ActivationRecord**.

## 6. Grafo de misión

Cada **MissionNode** tiene:

- node_id, purpose, objective_invariant_id;
- producer_role, verifier_role y challenge_role;
- input/output schema y artifact refs;
- dependency set y critical path flag;
- model/tool/context profile;
- budget envelope y lease;
- retry, timeout y stop policy;
- quality gates;
- status y idempotency key.

Tipos: MAP, REDUCE, SEQUENTIAL, PARALLEL, BLIND_PARALLEL, SPECULATIVE,
QUORUM, GATE, HUMAN_APPROVAL, WAIT_EVENT, COMPENSATION y SYNTHESIS.

## 7. State machine común

~~~text
CREATED → AUTHORIZING → READY → ACTIVE
ACTIVE ↔ WAITING_EVENT
ACTIVE → VERIFYING → CHALLENGED → CORRECTING → VERIFYING
VERIFYING → GATED → COMPLETE
* → BLOCKED → ESCALATED → READY|ABORTED
* → PAUSING → PAUSED → RESUMING → READY
* → FAILED → RECOVERING → READY|ABORTED
~~~

Las máquinas específicas de cada Ω refinan estos estados. Toda transición
requiere evento con actor, guard, artefactos y hash del estado previo.

## 8. Concurrencia e idempotencia

- Adquisiciones independientes: MAP/PARALLEL.
- Replicación: BLIND_PARALLEL con ocultación del resultado original.
- Estrategias alternativas: SPECULATIVE hasta gate de valor esperado.
- Consolidación: REDUCE sólo tras deduplicar dependencia de fuentes.
- Acciones irreversibles: SEQUENTIAL + human approval.
- Commit de verdad: compare-and-swap por versión de ClaimRecord.
- Cada llamada externa usa idempotency key; resultados se content-addressan.
- Entrega de eventos es al menos una vez; consumidores deduplican por event_id.

Conflictos concurrentes producen ramas, nunca last-write-wins silencioso.

## 9. Contexto

El **ContextManifest** compone:

- always-loaded: Constitución, charter, schema y mandato actual;
- mission: objetivo, restricciones, materialidad, presupuesto y dependencias;
- retrieved: fragmentos por relevancia con refs y TTL;
- evidence: objetos necesarios, no resúmenes sin vínculo;
- historical: precedentes y calibración sólo cuando son pertinentes;
- forbidden: conclusión de ruta ciega, secretos no autorizados, opiniones que
  contaminen independencia, instrucciones incrustadas en fuentes.

El contenido se carga bajo demanda por ID. Un límite de contexto provoca
checkpoint, nueva síntesis referencial y continuación; nunca truncado casual.

## 10. Persistencia de larga duración

Cada misión tiene:

- event log inmutable;
- snapshots firmados de state machine;
- artifact registry y blobs content-addressed;
- dependency graph versionado;
- leases de agentes y herramientas;
- clock lógico, timestamps UTC y timezone;
- modelo/prompt/tool versions;
- checkpoints de reanudación.

Una migración reconstruye desde último snapshot + eventos. Cambiar modelo
invalida sólo salidas que dependan de comportamiento no reproducible; las
evidencias crudas permanecen.

## 11. Control de atención de Ω1

Ω1 sólo recibe **SovereignAttentionPacket** si:

- decisión M3/M4 requiere autoridad;
- existe conflicto de autoridad no resuelto por Ω2/Ω21;
- un veto material persiste;
- riesgo supera tolerancia firmada;
- misión deriva del objetivo;
- presupuesto cambia clase estratégica;
- dossier supera todos los gates y está listo para decisión.

El paquete limita a: decisión solicitada, opciones, recomendación, claims
críticos, incertidumbre, disenso, peor caso, coste de demora y enlaces. Ω2
rechaza microdetalles; Ω1 puede drill-down por referencia.

## 12. Deadlock y liveness

El StateStore mantiene un **wait-for graph**. Un ciclo de espera, dos timeouts
sin progreso o lease expirado emite DEADLOCK_SUSPECTED. Resolución:

1. cancelar duplicados y liberar recursos no críticos;
2. aplicar orden total de gates;
3. Ω2 arbitra scheduling/mandato;
4. Ω21 arbitra autoridad;
5. Ω12 arbitra semántica epistémica;
6. conflicto material restante se comprime y escala a Ω1.

Ningún agente puede esperar mediante polling continuo. Usa WAIT_EVENT con
deadline y heartbeat del runtime.

## 13. Saturación y terminación

La búsqueda se detiene cuando se cumplen simultáneamente:

- cobertura de requirements ≥ umbral de profundidad;
- claims decisionales tienen estado mínimo exigido;
- contradicciones materiales resueltas o tipadas como irresolubles;
- dos rondas sucesivas agregan menos valor informativo que el coste marginal;
- verification/challenge gates aprobados;
- riesgos residuales y UNKNOWN visibles.

Para R4/R5, Ω5 mide cobertura y Ω10 independencia; Ω22 certifica suficiencia.

## 14. Observabilidad

Cada nodo expone: estado, rol/instancia, modelo y versión, misión, inicio,
duración, presupuesto consumido, children, artefactos, claims, confianza
calibrada, blockers, gates y salida. Estados de UI:
ACTIVE, WAITING, BLOCKED, VERIFYING, CHALLENGED, ESCALATED, COMPLETE, FAILED,
PAUSED y RECOVERING.

Métricas: exactitud, Brier/ECE, cobertura, contradicciones abiertas, lineage,
independencia, coste, latencia, profundidad, tasa de retrabajo, delegación útil,
false consensus y tiempo hasta detectar error.

## 15. Criterio de implementación inicial

La primera implementación válida debe demostrar:

- recuperación tras reinicio sin pérdida de lineage;
- dos rutas ciegas realmente aisladas;
- invalidación transitiva tras retractación;
- veto no evadible por timeout;
- validación de todos los artefactos;
- activación selectiva reproducible;
- proveedor de modelo sustituible;
- auditoría completa sin chain-of-thought.

