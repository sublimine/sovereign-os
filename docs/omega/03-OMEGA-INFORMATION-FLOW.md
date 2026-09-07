# Flujo de Información Ω

**Versión:** 1.0.0

## 1. Artefactos, no conversación

Los agentes intercambian **ArtifactEnvelope** validados. La prosa libre sólo
puede vivir en campos narrative marcados y nunca sustituye campos obligatorios.
Cada envelope incluye artifact_id, schema_id/version, artifact_version,
parent_version, producer, mission, timestamps, classification, sensitivity,
provenance_refs, dependency_refs, content_hash, status y superseded_by.

## 2. Compresión reversible

~~~text
RawEvidence
  → EvidencePacket
  → AtomicClaim
  → Finding
  → VerifiedFinding
  → DecisionOption
  → ExecutiveSynthesis
  → SovereignDossier
  → SovereignDecision
~~~

Cada nivel guarda refs exhaustivas al inferior, reglas de selección, omissions
manifest y hash de contenido. Ω23 puede ocultar detalle por defecto, nunca
borrarlo. Drill-down resuelve Dossier→Claim→Evidence→SourceSnapshot→ToolRun.

## 3. Paquetes canónicos

| Paquete | Productor típico | Consumidor | Función |
|---|---|---|---|
| MissionPacket | Ω2/Ω4 | Ω activos | Intención, límites, grafo, budget. |
| IntelligenceRequirementPacket | Ω5 | Ω6/departamentos | Preguntas y criterios de respuesta. |
| AcquisitionPlan | Ω6 | especialistas | Vías legales, cobertura y contingencias. |
| EvidencePacket | especialistas/Ω6 | Ω7/Ω10/Ω11 | Evidencia inmutable y procedencia. |
| ClaimPacket | productor | Ω7/Ω11/Ω12 | Claims atómicos y soporte. |
| VerificationPacket | Ω9/Ω10/Ω11 | productor/Ω12/Ω22 | Método, resultado y discrepancias. |
| ContradictionPacket | cualquiera | owner asignado | Conflicto explícito. |
| ChallengePacket | Ω13/Ω14 | owner del artefacto | Ataque reproducible y severidad. |
| SimulationPacket | Ω16 | Ω17–Ω19 | Modelo, escenarios, sensibilidad. |
| RiskPacket | Ω18/Ω19 | Ω17/Ω21/Ω22 | Impacto y riesgo residual. |
| ResourceDecisionPacket | Ω20 | Ω2/scheduler | Envelope y coste de oportunidad. |
| GovernancePacket | Ω21 | Ω1/Ω2/gates | Autoridad y condiciones. |
| QualityGatePacket | Ω22 | Ω2/Ω23 | PASS/FAIL/RETURN/ESCALATE/WAIVE. |
| DecisionDossier | Ω23 | Ω1/humano | Síntesis decisional con drill-down. |
| DecisionPacket | Ω1/humano | Ω2/ledger | Decisión, límites y triggers. |
| AuditPacket | Ω3 | oversight/owners | Hallazgos inmutables. |
| ChangeProposal | Ω24 | Ω3/Ω14/Ω21/Ω22/Ω1 | Mejora controlada. |
| EscalationPacket | cualquiera vía routing | autoridad exacta | Bloqueo, opciones, coste de demora. |

## 4. Prioridad de mensajes

- **INFO:** no requiere respuesta; puede agruparse.
- **REQUEST:** requiere ACK y deadline negociado.
- **BLOCKER:** impide nodo; owner debe resolver o escalar.
- **WARNING:** riesgo creciente; no bloquea aún.
- **CRITICAL:** daño material o gate fallido; preempción permitida.
- **SOVEREIGN:** requiere atención de Ω1/humano; sólo Ω2, Ω3, Ω19, Ω21,
  Ω22 y Ω23 pueden enrutar directamente y deben cumplir densidad mínima.

## 5. Catálogo de eventos

Eventos de misión:
MISSION_CREATED, MISSION_AUTHORIZED, MISSION_ACTIVATED, MISSION_PAUSED,
MISSION_RESUMED, MISSION_DRIFT_DETECTED, OBJECTIVE_METHOD_CONFLICT,
MISSION_ESCALATED, MISSION_COMPLETED, MISSION_ABORTED.

Eventos de agentes:
AGENT_ACTIVATED, AGENT_SPAWNED, LEASE_RENEWED, AGENT_WAITING,
AGENT_BLOCKED, AGENT_TERMINATED, AGENT_FAILED, AGENT_RECOVERED.

Eventos epistémicos:
EVIDENCE_ACQUIRED, EVIDENCE_QUARANTINED, CLAIM_CREATED, CLAIM_STATE_CHANGED,
CLAIM_CONTRADICTED, CLAIM_STALE, CLAIM_RETRACTED, REPLICATION_STARTED,
REPLICATION_FAILED, VERIFICATION_PASSED, VERIFICATION_FAILED,
SOURCE_DEPENDENCY_DISCOVERED.

Eventos de decisión/control:
GATE_EVALUATED, GATE_FAILED, VETO_ISSUED, VETO_RELEASED, WAIVER_REQUESTED,
WAIVER_GRANTED, BUDGET_WARNING, BUDGET_EXHAUSTED, DEADLOCK_SUSPECTED,
DOSSIER_READY, DECISION_ISSUED, DECISION_REVIEW_DUE, CHANGE_PROPOSED,
SHADOW_RUN_COMPLETED, ROLLBACK_TRIGGERED.

## 6. Entrega y consistencia

- EventBus: entrega al menos una vez; orden sólo garantizado por aggregate_id.
- Productor: transactional outbox con commit de artefacto.
- Consumidor: inbox de deduplicación por event_id.
- Estado: optimistic concurrency con expected_version.
- Evento inválido: dead-letter queue + alert; no se descarta.
- Side effects: saga con compensación, approval y evidence de resultado.

## 7. Contaminación

Los datos externos se encapsulan con trust_zone=UNTRUSTED_CONTENT. Antes de
ser visibles al modelo: extracción de metadatos, neutralización de contenido
activo, separación DATA/INSTRUCTION, y policy filter. Las rutas blind reciben
un **BlindContextManifest** sin conclusión, reputación del productor ni
argumentos persuasivos originales, salvo lo estrictamente necesario.

## 8. Densidad soberana

Un SovereignAttentionPacket máximo contiene:

1. decisión concreta solicitada;
2. tres opciones como máximo más status quo;
3. recomendación y criterio;
4. cinco claims críticos con estado;
5. UNKNOWN y disenso material;
6. peor caso, reversibilidad y coste de demora;
7. gates, vetos, waivers;
8. referencias de drill-down.

Si no satisface el schema, Ω2 lo devuelve; Ω1 no microgestiona.

