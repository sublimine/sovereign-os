# Calidad Final y Evolución · Charter departamental V3

Estado: contractualmente especificado; pendiente de certificación independiente.

## Misión
Determinar suficiencia para el efecto y aprender sin degradar garantías.

## Separación de deberes
quien certifica no produce el output certificado y quien aprende no cambia política

## Equipo y artefactos únicos

| ID | Autoridad | Artefacto | Frontera |
|---|---|---|---|
| telos_01 | Dirección de calidad | QualityMissionLedger | autocertificación del productor |
| telos_02 | Admisión de calidad final | FinalReviewQueue | verificación factual |
| telos_03 | Integridad de dossier | DossierCompletenessReport | síntesis ejecutiva |
| telos_04 | Trazabilidad de decisión | DecisionDrilldownIndex | procedencia de fuente |
| telos_05 | Certificación independiente | QualityCertificate | aprobación soberana |
| telos_06 | Experimentos de cambio | ChangeExperimentProtocol | cambio silencioso de política |
| telos_07 | Shadow y comparación | ShadowEvaluationReport | despliegue de producción |
| telos_08 | Memoria institucional | InstitutionalMemoryLedger | evidencia original |
| telos_09 | Rollback y continuidad | RollbackReadinessReceipt | corrección de contenido |
| telos_10 | Aprendizaje y evolución | InstitutionalLearningPacket | modificación autónoma |

## Reglas de operación

1. Admitir sólo input con owner, lease, hash, procedencia y freshness.
2. Ejecutar método y falsificador de cada puesto antes del commit.
3. Preservar evidencia contraria, disenso y UNKNOWN.
4. Exigir revisión independiente material.
5. Hacer handoff versionado sin transferir autoridad.

## Riesgos propios
1. certificación por productor. Respuesta: freeze, evidencia preservada, owner causal, supersesión y revisión independiente.
2. dossier sin trazabilidad. Respuesta: freeze, evidencia preservada, owner causal, supersesión y revisión independiente.
3. cambio silencioso sin experimento. Respuesta: freeze, evidencia preservada, owner causal, supersesión y revisión independiente.
4. rollback no ensayado. Respuesta: freeze, evidencia preservada, owner causal, supersesión y revisión independiente.

## Gates compartidos

AUTHORITY_SCOPE, INPUT_LINEAGE, METHOD_EXECUTION, FALSIFIER_COVERAGE, BOUNDARY_SEPARATION, INDEPENDENT_REVIEW, OUTPUT_SCHEMA y HANDOFF_RECEIPT son no renunciables. Una ausencia material retorna o bloquea.

## Interfaces
- DECISION_PACKET_ENTERS_FINAL_REVIEW: praxis_10/ConditionalDecisionPacket → telos_01/QualityMissionLedger; preserva unknowns, evidence_against, provenance, gate_receipts, boundary; autoridad=NONE; consumer retains only its pre-existing authority.
- LEASE_AND_RESOURCE_RECEIPTS_ENTER_FINAL_REVIEW: imperium_10/AuthorityRevocationReceipt → telos_01/QualityMissionLedger; preserva unknowns, evidence_against, provenance, gate_receipts, boundary; autoridad=NONE; consumer retains only its pre-existing authority.
- OUTCOME_REOPEN_TRIGGER: telos_10/InstitutionalLearningPacket → veritas_01/VerificationMissionLedger; preserva unknowns, evidence_against, provenance, gate_receipts, boundary; autoridad=NONE; consumer retains only its pre-existing authority.

## Simulaciones y recuperación
- SIM:final_quality_evolution:1: A consumer requests a clean COMPLETE despite a remaining UNKNOWN → PRESERVE_UNKNOWN_AND_BLOCK_HANDOFF; cinco roles, 30 eventos, cero terminales COMPLETE.
- SIM:final_quality_evolution:2: A consumed upstream artifact is superseded after handoff → FREEZE_DESCENDANTS_AND_REVALIDATE; cinco roles, 30 eventos, cero terminales COMPLETE.
Si se supersede un input: congelar dependientes, registrar impacto, regresar al owner causal y reejecutar gates afectados.

## Observabilidad y terminación

Registrar agente, misión, versiones, charter, estado, gate decisions, lease, contexto, coste, bloqueos y trigger de reconsideración.
La coordinación termina sólo con artefactos schema-válidos, receipts independientes, handoffs reconocidos y UNKNOWN visible.

## Consistencia interna actual
- 350 FMEA y 450 evaluaciones V3.
- Auditoría transversal: 6/6 mutaciones críticas detectadas.
- No declara certificación independiente: esa revisión debe ocurrir fuera del camino de generación.
