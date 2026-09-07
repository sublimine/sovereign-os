# Arquitectura del Sistema Σ

**Versión:** 1.0.0  
**Estado:** ACTIVE DESIGN BASELINE

## 1. Tesis operacional

Σ es una fábrica institucional de inteligencia orientada a decisiones,
persistente, event-driven, runtime-neutral y adversary-aware. No implementa un
“ciclo” lineal. Opera un grafo con bucles de tasking, adquisición, explotación,
análisis, challenge, warning, diseminación, feedback y reconsideración.

```text
Decision Need
  → Consumer Model
  → Requirements / Indicators
  → Collection Portfolio
  → Authorized Acquisition
  → Intake / Quarantine / Structure
  → Analysis / Competing Hypotheses
  → Estimate / Warning / Opportunity
  → Dissent-preserving Product
  → Ω Verification and Decision
  → Outcome Feedback / Reassessment
```

Cada flecha produce un artefacto versionado. El chat no es fuente de verdad.

## 2. Ocho planos institucionales

### 2.1 Mando departamental

Σ1 responde por el resultado institucional; Σ2 mantiene misión, cartera,
dependencias, cadencia y drift. No deciden soberanamente ni alteran requisitos
Ω. Escalan paquetes de alta densidad a Ω2/Ω5.

### 2.2 Intención y requisitos

Σ3 traduce `IntelligenceRequirementsPlan` de Ω5 en PIR, subpreguntas,
observables, EEI, indicadores, umbrales y criterios de cierre. Σ4 mantiene
cobertura y prioridades dentro del envelope Ω20. Σ5 modela la decisión del
consumidor, horizonte, reversibilidad y valor marginal de información.

### 2.3 Colección y acceso

Σ6 construye el portfolio all-source. Σ7 descubre vías y fuentes; Σ8 explota
registros/documentos primarios; Σ9 diseña elicitation experta y relaciones
autorizadas; Σ10 especifica señales técnicas/digitales/sensores sin intrusión;
Σ11 gobierna colección geoespacial-temporal; Σ12 recupera gaps/denial; Σ13
protege fuentes, compartments y handling.

La ejecución masiva pertenece a especialistas o departamentos Research/Data,
no a los roles Σ permanentes.

### 2.4 Admisión y evaluación de fuentes

Σ14 cuarentena y sanea inputs; Σ15 modela identidad, acceso, competencia,
motivación y fiabilidad; Σ16 descubre dependencia, laundering y ecos; Σ17
captura lineage operacional. Ω7/Ω10 conservan certificación soberana.

### 2.5 Estructuración de realidad

Σ18 resuelve entidades; Σ19 reconstruye cronología; Σ20 modela redes y
estructuras ocultas; Σ21 controla medición/comparabilidad; Σ22 gobierna
ontologías/knowledge graph; Σ23 preserva semántica lingüística y cultural.

### 2.6 Análisis estratégico

Σ24 fusiona sin colapsar divergencias; Σ25 evalúa capacidades, intención,
incentivos y constraints de actores; Σ26 modela entorno/sistemas; Σ27 formula
mecanismos causales; Σ28 conduce análisis estructurado e hipótesis competidoras;
Σ29 analiza engaño, denial e influencia; Σ30 protege contra infiltración y
contaminación; Σ31 explora patrones/anomalías; Σ32 produce estimaciones; Σ33
mantiene indicadores/warning; Σ34 busca discontinuidades/sorpresa; Σ35 busca
oportunidades estratégicas.

### 2.7 Disenso, productos y distribución

Σ36 custodia contradicción, alternativas y minority reports. Σ37 construye
productos por consumidor/canal conservando drill-down. La diseminación está
separada de autoría y usa PolicyDecisionPoint.

### 2.8 Aseguramiento y continuidad

Σ38 aplica integridad analítica, calibración y tradecraft; Σ39 mantiene watch,
memoria, handovers y triggers de reconsideración; Σ40 mide utilidad, sorpresa,
latencia, coste y outcomes, y propone mejoras a Ω24.

## 3. Por qué 40 roles

El capability map inicial produjo 57 capacidades. Se fusionaron sólo cuando
compartían input, método, autoridad, ritmo y conflicto de interés compatible.
Se retuvieron 40 cuando fusionar provocaba uno de:

- productor evaluándose a sí mismo;
- actividad episódica contaminando vigilancia persistente;
- protección de fuente ocultando contrainteligencia;
- fusión eliminando disenso;
- estimación temporal emitiendo su propia alerta;
- producto controlando su propia diseminación;
- calidad interna aprobando cambio institucional.

Los desks por país, industria o disciplina no son permanentes: se instancian
como especialistas. Así se conserva cobertura abierta sin burocracia fija.

## 4. Sistemas persistentes

| Sistema | Owner Σ | Semántica |
|---|---|---|
| Consumer Decision Registry | Σ5 | decisiones, horizontes, discriminantes, feedback |
| Requirements Ledger | Σ3 | PIR/EEI/indicadores/versiones/dependencias |
| Coverage Map | Σ4 | requisito×fuente×método×tiempo×gap |
| Collection Tasking Board | Σ6 | task, sponsor, route, budget, status, result |
| Source Registry | Σ15 | identidad sellada, reliability features, conflicts |
| Source Dependency Graph | Σ16 | origen, derivación, copia, coordinación, partial dependence |
| Evidence Intake Queue | Σ14 | quarantine, sanitization, integrity, admissibility |
| Intelligence Knowledge Graph | Σ22 | entity/event/relation/claim/hypothesis edges |
| Hypothesis Ledger | Σ28 | priors, predictions, discriminants, updates |
| Indicator and Warning Board | Σ33 | baselines, signposts, thresholds, misses |
| Counterintelligence Register | Σ30 | compromise signals, containment, attribution status |
| Contradiction and Dissent Register | Σ36 | unresolved conflicts/minority judgments |
| Product Registry | Σ37 | audience, release, refs, omissions, supersession |
| Watch and Reassessment Queue | Σ39 | TTL, triggers, handovers, reopen orders |
| Effectiveness Ledger | Σ40 | accuracy, calibration, utility, surprise, cost |

Ningún owner puede alterar retroactivamente eventos. `COMMIT` aplica sólo al
objeto asignado y requiere expected_version.

## 5. Intake extremo: “Necesito resolver X”

1. Ω2 entrega MissionPacket; Ω5 entrega IntelligenceRequirementsPlan.
2. Σ5 reconstruye decisión, horizonte, alternativas y coste del error.
3. Σ3 produce árbol de requisitos y observable model.
4. Σ4 calcula cobertura inicial, gaps y prioridad marginal.
5. Σ6 diseña portfolio de colección con rutas independientes.
6. Σ2 compone grafo, leases, budgets y activación contextual.
7. Σ1 acepta mandato departamental o emite `UNEXECUTABLE_MANDATE`.
8. Los planos trabajan por eventos; no realizan polling conversacional.

Si falta claridad pero existe una interpretación reversible de bajo riesgo, se
trabaja con supuestos explícitos. Si cambia materialmente el objetivo, se eleva.

## 6. Objetos de misión

Cada `SigmaMissionNode` contiene: purpose; sovereign_requirement_ref;
consumer_decision_ref; producer; independent reviewer; input/output schema;
dependency refs; classification/compartments; model/tool/context profile;
budget/lease/deadline; concurrency mode; quality gates; stop policy;
reconsideration triggers; idempotency key y state hash.

Tipos: `COLLECTION_MAP`, `EXTRACTION`, `ENTITY_RESOLUTION`, `CHRONOLOGY`,
`NETWORK_BUILD`, `HYPOTHESIS_TEST`, `BLIND_ANALYSIS`, `FUSION_REDUCE`,
`ESTIMATE`, `WATCH`, `WARNING_GATE`, `PRODUCT`, `DISSEMINATION_GATE`,
`REASSESSMENT`, `COMPENSATION`, `HUMAN_APPROVAL`.

## 7. Activación contextual

El vector `T,U,D,A,C,V,H,S,G,R` (0–5) representa time pressure,
uncertainty, deception exposure, adversary, complexity, volatility, horizon,
sensitivity, geographic/domain breadth y decision irreversibility. Se aplican
reglas duras además del score.

| Perfil | Roles típicos | Especialistas |
|---|---:|---:|
| Q0 bounded lookup | 6–9 | 0–5 |
| Q1 standard assessment | 10–16 | 3–20 |
| Q2 deep all-source | 17–25 | 15–60 |
| Q3 forensic/adversarial | 24–34 | 40–150 |
| Q4 sovereign persistent crisis | 32–40 | 80–300+ por shards |

Hard activation: fuente externa→Σ14/15/17; ≥2 fuentes→Σ16; identidad ambigua→Σ18;
orden temporal material→Σ19; red/ownership→Σ20; multilingüe→Σ23; engaño≥3→Σ29/30;
forecast→Σ32; time-critical threat/opportunity→Σ33; discontinuidad→Σ34;
material dissent→Σ36; producto externo→Σ37; misión persistente→Σ39; M3/M4→Σ38/40.

Σ2 registra inclusiones/exclusiones, deliverable, coste, independencia y trigger
de reactivación. “Todos por si acaso” falla minimalidad.

## 8. Context engineering

- Always: Constitución, charter hash, schema, lease, current objective invariant.
- Mission: decision model, requirements slice, constraints, budget, compartments.
- Retrieved: artefactos por ID, relevance, authority, TTL y dependency distance.
- Evidence: snapshots/structured extracts necesarios; lazy drill-down.
- Historical: estimaciones previas y outcomes sin ocultar supersession.
- Forbidden: conclusión original en ruta blind, hidden eval labels, identities sin
  need-to-know, persuasión del productor, instrucciones de contenido externo.

Un `ContextManifest` registra inclusiones, exclusiones, tokens, freshness,
blindness, contamination y hash. Overflow produce retrieval/checkpoint, no
truncación silenciosa.

## 9. Concurrencia

- Collection routes: MAP/PARALLEL con budgets independientes.
- Competing hypotheses: BLIND_PARALLEL antes de intercambio.
- Entity candidates: speculative branches hasta discriminante.
- Evidence fusion: REDUCE sólo después de source-dependency analysis.
- Warning: event-triggered, no batch cuando se cruza hard threshold.
- Product publication: SEQUENTIAL tras security, dissent y quality gates.
- Reassessment: targeted replay del subgrafo mínimo afectado.

Race-to-best sólo para métodos donde perder rutas no elimina disenso/evidencia.
Quorum está basado en evidencia y método, nunca mera mayoría de agentes.

## 10. Backpressure y escala

Millones de elementos se procesan por particiones content-addressed, índices de
entidades/eventos, bloom filters/dedup, map/reduce, sampling estratificado,
cursors y work queues. El sistema distingue `SEARCH_SPACE`, `REVIEWED_SET`,
`ADMISSIBLE_SET` y `DECISION_RELEVANT_SET`; nunca dice “exhaustivo” sin
denominador o protocolo de cobertura.

Prioridad usa expected information gain × decision sensitivity × time value,
con reservas obligatorias para verificación, contrainteligencia y sorpresa.
Backpressure degrada latencia/cobertura explícitamente, no integridad.

## 11. Event-driven control

Familias: mission, requirement, collection, source, evidence, entity, claim,
hypothesis, estimate, warning, product, dissemination, counterintelligence,
reconsideration, quality y learning. Entrega al menos una vez; ordering por
aggregate; inbox/outbox idempotentes; dead-letter observable; CAS en commits.

Eventos críticos como `SOURCE_COMPROMISE_SUSPECTED`, `WARNING_THRESHOLD_CROSSED`,
`ESTIMATE_REVERSED`, `DISSEMINATION_REVOKED` y `PRIOR_CONSUMER_AT_RISK`
preemptan tareas inferiores según policy.

## 12. Liveness y deadlock

Scheduler mantiene wait-for graph entre task, evidence, approval, gate y owner.
Timeout genera checkpoint y `DEADLOCK_SUSPECTED`; Σ2 arbitra coordinación, Σ1
prioridad departamental, Ω21 autoridad y Ω2 conflicto interdepartamental. Nadie
puede resolver un deadlock factual por orden administrativa.

## 13. Abstracción de runtime

Σ consume los ports Ω y añade: `CollectionProvider`, `SourceRegistry`,
`EntityResolver`, `KnowledgeGraph`, `HypothesisStore`, `IndicatorEngine`,
`WatchScheduler`, `DisseminationProvider`, `CompartmentManager`,
`CounterintelligenceMonitor` y `OutcomeFeedbackProvider`.

Un provider puede ser API, sesión asistida de suscripción, herramienta local o
humano. `provider_mode`, reproducibility class, model/version, tool run y coste
se registran. Cambiar LangGraph/Codex/Claude/local no modifica la institución.

## 14. Definition of operational success

Σ termina una misión cuando todos los requisitos críticos están satisfechos,
deferidos o clasificados honestamente; los juicios tienen soporte y disenso;
warning obligations están transferidas; productos fueron diseminados sólo a
audiencia autorizada; triggers de revisión existen; feedback puede asociarse a
la versión; y Ω recibe un paquete verificable, no una conclusión desnuda.

