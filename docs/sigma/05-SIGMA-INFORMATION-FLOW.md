# Flujo de Información y Contratos Σ

## 1. Jerarquía reversible

```text
RawAcquisition
→ EvidenceIntakeDecision
→ Source/Provenance/Dependency records
→ Entity/Event/Network/Measurement/Semantic structures
→ Atomic claims
→ AnalyticHypothesisSet
→ AllSourceFusion
→ Estimate | Warning | Opportunity
→ Dissent-preserving IntelligenceProduct
→ Ω verification / Sovereign Dossier
```

Cada capa conserva referencias completas, reglas de selección y omissions
manifest. Compresión oculta detalle por defecto; nunca lo destruye.

## 2. Paquetes principales

| Paquete | Productor | Consumidor | Rechazo típico |
|---|---|---|---|
| SigmaMissionPacket | Σ1/Σ2 | roles activos | objetivo/authority ausente |
| ConsumerDecisionModel | Σ5 | Σ3/Σ37 | decision owner inválido |
| IntelligenceRequirementSet | Σ3 | Σ4/Σ6 | no observable/no cierre |
| CoveragePortfolio | Σ4 | Σ2/Σ6 | denominador/independencia ausente |
| CollectionStrategy | Σ6 | collectors | ruta ilegal/sin handling |
| CollectionTask | Σ6 | especialista/departamento | lease/schema/stop ausente |
| EvidenceIntakeDecision | Σ14 | source/reality plane | raw/hash/quarantine fail |
| SourceAssessment | Σ15 | fusion/analysis | access/motive no evidenciados |
| SourceDependencyGraph | Σ16 | coverage/fusion | edges no claim-specific |
| OperationalProvenanceBundle | Σ17 | Ω7/consumidores | edge roto/hash mismatch |
| StructuredRealityPacket | Σ18–Σ23 | Σ24–Σ35 | ambiguity oculta |
| AnalyticHypothesisSet | Σ28 | fusion/estimate | null/discriminantes ausentes |
| EstimateRecord | Σ32 | Σ33/Σ37/Ω16 | no resolution rule |
| WarningNotice | Σ33 | consumidores autorizados | stale/spoofing/no threshold |
| DissentRegisterDelta | Σ36 | Σ37/Σ38/Ω | material dissent omitido |
| IntelligenceProduct | Σ37 | Ω/consumidor | quality/security gate abierto |
| WatchHandover | Σ39 | siguiente turno/runtime | active watch perdido |
| EffectivenessReview | Σ40 | Ω24 | outcome no ligado a versión |

## 3. Prioridad de mensajes

- INFO: agregable.
- REQUEST: ACK + deadline.
- BLOCKER: impide nodo exacto.
- WARNING: riesgo creciente sin threshold final.
- CRITICAL: gate/compromise/decision window material.
- SOVEREIGN: sólo Σ1/2/30/33/36/38/40 hacia router Ω, con densidad mínima.

Un mensaje nunca sustituye el artefacto. EventBus elimina polling: subscribers
reaccionan a transiciones y timers persistentes.

## 4. Densidad hacia Ω

El `OmegaIntelligencePacket` contiene: decisión/pregunta; 3–7 key judgments;
estado y evidencia crítica; source independence; UNKNOWN/gaps; dissent;
deception/CI risk; warning window; qué cambiaría el juicio; calidad/gates;
drill-down. Raw dumps o conversaciones se devuelven.

## 5. Corrección

`CLAIM_RETRACTED` o `SOURCE_COMPROMISE_SUSPECTED` recorre dependency graph,
marca estimates/warnings/products `STALE|INVALIDATED`, congela diseminación,
abre ReassessmentCase y notifica consumidores previos. La republicación usa
nueva versión; la antigua conserva status y superseded_by.

