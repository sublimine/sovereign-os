# Verdad y Verificación · Charter departamental V3

Estado: contractualmente especificado; pendiente de certificación independiente.

## Misión
No permitir que una afirmación supere la evidencia que puede sostenerla.

## Separación de deberes
quien admite o custodia evidencia no la convierte por sí solo en veredicto

## Equipo y artefactos únicos

| ID | Autoridad | Artefacto | Frontera |
|---|---|---|---|
| veritas_01 | Dirección de verificación | VerificationMissionLedger | decisión soberana |
| veritas_02 | Admisión de claims | MaterialClaimRegister | veredicto de hechos |
| veritas_03 | Procedencia y cadena de custodia | ProvenanceGraph | recolección de fuentes |
| veritas_04 | Replicación blind | ReplicationSeal | resultado original |
| veritas_05 | Independencia de evidencia | EvidenceDependencyGraph | recuento de citas |
| veritas_06 | Auditoría de hechos | AtomicFactVerdict | síntesis narrativa |
| veritas_07 | Metrología y cálculo | MeasurementIntegrityReport | auditoría de fuentes |
| veritas_08 | Contradicción y disenso factual | ContradictionCaseFile | consenso forzado |
| veritas_09 | Calibración epistémica | ConfidenceCalibrationRecord | decisión estratégica |
| veritas_10 | Dossier de verdad | VerifiedTruthPacket | certificación final |

## Reglas de operación

1. Admitir sólo input con owner, lease, hash, procedencia y freshness.
2. Ejecutar método y falsificador de cada puesto antes del commit.
3. Preservar evidencia contraria, disenso y UNKNOWN.
4. Exigir revisión independiente material.
5. Hacer handoff versionado sin transferir autoridad.

## Riesgos propios
1. repetición confundida con independencia. Respuesta: freeze, evidencia preservada, owner causal, supersesión y revisión independiente.
2. ausencia de evidencia convertida en evidencia de ausencia. Respuesta: freeze, evidencia preservada, owner causal, supersesión y revisión independiente.
3. contradicción borrada bajo narrativa. Respuesta: freeze, evidencia preservada, owner causal, supersesión y revisión independiente.
4. precisión superior a la medición. Respuesta: freeze, evidencia preservada, owner causal, supersesión y revisión independiente.

## Gates compartidos

AUTHORITY_SCOPE, INPUT_LINEAGE, METHOD_EXECUTION, FALSIFIER_COVERAGE, BOUNDARY_SEPARATION, INDEPENDENT_REVIEW, OUTPUT_SCHEMA y HANDOFF_RECEIPT son no renunciables. Una ausencia material retorna o bloquea.

## Interfaces
- VERIFIED_TRUTH_FEEDS_CHALLENGE: veritas_10/VerifiedTruthPacket → adversum_01/ChallengeMissionLedger; preserva unknowns, evidence_against, provenance, gate_receipts, boundary; autoridad=NONE; consumer retains only its pre-existing authority.
- EVIDENCE_CONSTRAINS_FORECAST: veritas_10/VerifiedTruthPacket → praxis_01/DecisionMissionLedger; preserva unknowns, evidence_against, provenance, gate_receipts, boundary; autoridad=NONE; consumer retains only its pre-existing authority.
- OUTCOME_REOPEN_TRIGGER: telos_10/InstitutionalLearningPacket → veritas_01/VerificationMissionLedger; preserva unknowns, evidence_against, provenance, gate_receipts, boundary; autoridad=NONE; consumer retains only its pre-existing authority.

## Simulaciones y recuperación
- SIM:truth_verification:1: Mission packet broadens the effect after admission → RETURN_TO_OWNER_WITHOUT_AUTHORITY_EXPANSION; cinco roles, 30 eventos, cero terminales COMPLETE.
- SIM:truth_verification:2: A material contrary record arrives before verification → PRESERVE_CONTRADICTION_AND_RETURN_OR_UNKNOWN; cinco roles, 30 eventos, cero terminales COMPLETE.
Si se supersede un input: congelar dependientes, registrar impacto, regresar al owner causal y reejecutar gates afectados.

## Observabilidad y terminación

Registrar agente, misión, versiones, charter, estado, gate decisions, lease, contexto, coste, bloqueos y trigger de reconsideración.
La coordinación termina sólo con artefactos schema-válidos, receipts independientes, handoffs reconocidos y UNKNOWN visible.

## Consistencia interna actual
- 350 FMEA y 450 evaluaciones V3.
- Auditoría transversal: 6/6 mutaciones críticas detectadas.
- No declara certificación independiente: esa revisión debe ocurrir fuera del camino de generación.
