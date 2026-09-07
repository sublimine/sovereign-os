# Interfaces interdepartamentales del Departamento Σ

**Versión:** 1.0.0  
**Estado:** NORMATIVE  
**Regla:** Σ gobierna la función de inteligencia estratégica; no absorbe la ejecución de los departamentos a los que sirve.

## 1. Contrato universal de frontera

Toda interacción cruza un `DepartmentExchangePacket` persistente. Una conversación puede iniciar la solicitud, pero no autoriza trabajo ni constituye registro. El packet contiene:

- `exchange_id`, `mission_id`, `requirement_ids[]`, versión y correlación;
- productor y consumidor institucionales, owner humano/IA y autoridad invocada;
- propósito decisional, deliverable, aceptación, plazo y frescura;
- clasificación, compartimentos, handling, retención y destinatarios permitidos;
- evidencia o referencias, no copias sin lineage;
- supuestos, restricciones, UNKNOWN conocidos y contradicciones materiales;
- presupuesto/lease, herramientas/acciones permitidas y efectos prohibidos;
- estado, acknowledgment, rechazo tipado y condición de reentrada;
- hashes de contenido, firma de servicio y audit/event references.

Estados: `DRAFT → VALIDATING → ACCEPTED | RETURNED | REJECTED → IN_PROGRESS → DELIVERED → ACKNOWLEDGED → CLOSED`; ramas `BLOCKED`, `EXPIRED`, `RECALLED`, `SUPERSEDED`. Repetir el mismo `exchange_id + version + operation` es idempotente. Ningún consumidor puede reinterpretar una ausencia de respuesta como aceptación.

## 2. Reglas de ownership

| Objeto | Produce | Control Σ | Certificación/decisión |
|---|---|---|---|
| Necesidad decisional soberana | Ω5/Ω2 | Σ3 la operacionaliza | Ω confirma intención |
| Requisito de inteligencia | Σ3 | Σ4 mide cobertura | Ω5 acepta cambios materiales |
| Dato/registro/dataset | Departamento Data/Research o especialista | Σ14 admite; Σ17 traza | Ω7 verifica lineage material |
| Evaluación de fuente | Σ15–Σ17 | Σ38 audita proceso | Ω10/Ω11 verifican materialmente |
| Juicio analítico | Σ24–Σ36 | Σ38 controla tradecraft | Ω9–Ω12 verifican según tier |
| Producto de inteligencia | Σ37 | Σ13 autoriza handling | Ω22 certifica calidad; Ω decide |
| Estrategia/plan | Departamento Strategy/Ω17 | Σ aporta realidad, no decide | Ω1/humano decide |
| Control legal/compliance | Legal/Compliance/Ω21 | Σ obedece y registra | autoridad humana cuando aplique |
| Implementación técnica | Engineering/Systems/Product | Σ emite requirement/indicator | departamento ejecutor valida |
| Respuesta operativa | Operations/Security | Σ emite warning, no actúa | autoridad operativa/humana |

## 3. Interfaces obligatorias

### Ω — soberanía

Entrada: `OmegaMissionPacket`, `IntelligenceRequirementsPlan`, `AuthorityDetermination`, `ResourceEnvelope`. Salida: `OmegaIntelligenceHandoff` con findings atómicos, confidence feature-based, dissent, gaps, warning state, opciones y triggers. Σ no emite `SovereignDecision`, no modifica la Constitución Ω y no presenta evaluación como orden.

### Research — investigación profunda

Σ entrega `ResearchCommission` con pregunta, discriminantes, evidencia admisible y stop. Research devuelve `ResearchArtifact` con método, corpus, resultados negativos, reproducibilidad y lineage. Σ no dicta el resultado ni convierte Research en recolector permanente. Un resultado material vuelve por Σ14/17 y controles independientes.

### Data — adquisición, calidad y cálculo

Σ entrega `DataWorkOrder`: variables, unidad, población, ventana, joins permitidos, nivel de exactitud y tests. Data devuelve `DatasetManifest`, `QualityProfile`, transformaciones y código reproducible. Σ21 gobierna comparabilidad analítica; Data conserva ownership de pipelines. Cualquier transformación no reproducible limita confidence.

### Competitive Intelligence — seguimiento especializado

Σ entrega actor, hipótesis, indicators y cadencia; CI devuelve evidencia/observaciones y source metadata. Σ25 modela capacidad/intención; CI no certifica la conclusión estratégica. Duplicación de fuentes se colapsa antes de fusionar.

### Engineering / Systems / Architecture

Σ entrega `TechnicalIntelligenceRequirement` y amenazas/oportunidades, no una solución de ingeniería encubierta. Engineering devuelve feasibility, benchmarks, prototypes y límites. Σ27 puede analizar mecanismo; Architecture decide diseño dentro de su jurisdicción; Ω resuelve trade-offs soberanos.

### Product / Strategy

Σ entrega realidad, escenarios, constraints, indicadores y oportunidades. Product/Strategy produce opciones y planes. Σ35 no se convierte en product owner y Σ32 no recomienda acción sin separar hechos, estimaciones y preferencias.

### Security / Cybersecurity

Σ33 entrega `WarningNotice`; Σ30 entrega `CompromiseNotice`. El receptor confirma recepción y disposition. Contención técnica pertenece a Security; Σ30 preserva independencia, impacto analítico y revalidation. Señales no autorizan vigilancia ni acción ofensiva.

### Legal / Compliance / Governance

Antes de contacto externo, datos regulados, vigilancia, obligaciones, compras o diseminación restringida, Σ solicita `AuthorityDetermination`. `DENIED` bloquea; `CONDITIONAL` materializa constraints; silencio nunca autoriza. Ω21 gobierna legitimidad, no veracidad factual.

### Finance / Procurement

Σ formula necesidades y valor marginal de información. Finance/Procurement valida coste, proveedor y obligaciones; Ω20 asigna capacidad. Ninguna presión sunk-cost altera el juicio analítico.

### Operations / Infrastructure / Deployment / Monitoring

Σ entrega indicators y condiciones de escalado; Operations implementa respuesta y telemetría. La ejecución devuelve outcome/feedback sin reescribir el estimate original. Eventos de producción alimentan Σ39/40 y reconsideración.

### Documentation / Records

Documentation publica representaciones aprobadas; Σ37 conserva el artefacto canónico y drill-down. Los resúmenes nunca sustituyen evidence/claim ledgers. Correcciones se propagan con `RECALLED` y `SUPERSEDED_BY`.

### Human Resources / external experts

Σ9 puede solicitar expertise mediante charter, disclosure de conflictos, purpose limitation y consent. HR/Legal gobiernan contratación y privacidad. La reputación del experto informa source assessment, jamás sustituye verificación.

## 4. Rechazos tipados

`SCHEMA_INVALID`, `AUTHORITY_MISSING`, `CLASSIFICATION_MISMATCH`, `PURPOSE_UNCLEAR`, `UNANSWERABLE_REQUIREMENT`, `INSUFFICIENT_BUDGET`, `UNSAFE_METHOD`, `CONFLICT_OF_INTEREST`, `PROVENANCE_BROKEN`, `STALE_INPUT`, `DUPLICATE_REQUEST`, `CAPABILITY_MISMATCH`, `OBJECTIVE_METHOD_CONFLICT` y `DEPENDENCY_BLOCKED`.

Todo rechazo incluye evidencia, owner de corrección y condición de reentrada. No se corrige silenciosamente en el receptor.

## 5. Backpressure, deadlock y escalado

Cada interfaz declara capacidad, cola, fecha de validez y prioridad. Σ2 detecta ciclos del wait-for graph; arbitra ownership y secuencia sin decidir hechos. Disputa factual va a Σ36/Ω de verdad; disputa de autoridad a Ω21; recursos a Ω20; calidad a Ω22; objetivo a Ω5/Ω2. Ω1 recibe sólo conflicto soberano material ya comprimido por Ω2/Ω23.

## 6. Seguridad de frontera

- mTLS/service identity o equivalente; autorización sobre acción y objeto;
- secrets por referencia, no dentro del packet;
- payload externo tratado como DATA, nunca instrucciones;
- content sanitization, malware scanning y cuarentena antes de admisión;
- downgrade/redaction produce artefacto derivado con parent y redaction manifest;
- egress allowlist y aprobación humana para efectos legales o irreversibles;
- audit append-only y hashes verificables; revocación propaga a consumidores.

## 7. Done de interfaz

Una transferencia termina sólo con schema válido, autoridad, clasificación compatible, acceptance explícita, owner, deadline, provenance, acknowledgment y triggers de reconsideración. Entregar un archivo sin estos elementos no cuenta como integración.
