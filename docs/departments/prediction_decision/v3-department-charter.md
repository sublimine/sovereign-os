# Predicción y Decisión · Charter departamental V3

Estado: contractualmente especificado; pendiente de certificación independiente.

## Misión
Formular recomendaciones condicionadas, reversibles y conscientes de ruina.

## Separación de deberes
quien modela opciones no asigna recursos ni activa efectos

## Equipo y artefactos únicos

| ID | Autoridad | Artefacto | Frontera |
|---|---|---|---|
| praxis_01 | Dirección de decisión | DecisionMissionLedger | decisión soberana |
| praxis_02 | Arquitectura de escenarios | ScenarioGraph | forecast calibrado |
| praxis_03 | Forecast y calibración | ForecastScorecard | evidencia de verdad |
| praxis_04 | Simulación reproducible | SimulationRunLedger | aprobación de modelo |
| praxis_05 | Ciencia de opciones | OptionPortfolio | asignación de recursos |
| praxis_06 | Impacto sistémico | SystemicImpactGraph | preferencia de un sponsor |
| praxis_07 | Riesgo de cola y ruina | RuinBoundaryCase | optimización local |
| praxis_08 | Reversibilidad y triggers | ReversalTriggerRegister | ejecución de efectos |
| praxis_09 | Valor de información | InformationValueCase | recolección de inteligencia |
| praxis_10 | Recomendación condicionada | ConditionalDecisionPacket | autorización institucional |

## Reglas de operación

1. Admitir sólo input con owner, lease, hash, procedencia y freshness.
2. Ejecutar método y falsificador de cada puesto antes del commit.
3. Preservar evidencia contraria, disenso y UNKNOWN.
4. Exigir revisión independiente material.
5. Hacer handoff versionado sin transferir autoridad.

## Riesgos propios
1. forecast confundido con decisión. Respuesta: freeze, evidencia preservada, owner causal, supersesión y revisión independiente.
2. media optimizada cruzando ruina. Respuesta: freeze, evidencia preservada, owner causal, supersesión y revisión independiente.
3. escenario que renombra caso base. Respuesta: freeze, evidencia preservada, owner causal, supersesión y revisión independiente.
4. trigger no observable. Respuesta: freeze, evidencia preservada, owner causal, supersesión y revisión independiente.

## Gates compartidos

AUTHORITY_SCOPE, INPUT_LINEAGE, METHOD_EXECUTION, FALSIFIER_COVERAGE, BOUNDARY_SEPARATION, INDEPENDENT_REVIEW, OUTPUT_SCHEMA y HANDOFF_RECEIPT son no renunciables. Una ausencia material retorna o bloquea.

## Interfaces
- EVIDENCE_CONSTRAINS_FORECAST: veritas_10/VerifiedTruthPacket → praxis_01/DecisionMissionLedger; preserva unknowns, evidence_against, provenance, gate_receipts, boundary; autoridad=NONE; consumer retains only its pre-existing authority.
- CHALLENGE_CONSTRAINS_RECOMMENDATION: adversum_10/AdversarialDisposition → praxis_01/DecisionMissionLedger; preserva unknowns, evidence_against, provenance, gate_receipts, boundary; autoridad=NONE; consumer retains only its pre-existing authority.
- RECOMMENDATION_REQUESTS_AUTHORITY: praxis_10/ConditionalDecisionPacket → imperium_01/InstitutionalMandateLedger; preserva unknowns, evidence_against, provenance, gate_receipts, boundary; autoridad=NONE; consumer retains only its pre-existing authority.
- DECISION_PACKET_ENTERS_FINAL_REVIEW: praxis_10/ConditionalDecisionPacket → telos_01/QualityMissionLedger; preserva unknowns, evidence_against, provenance, gate_receipts, boundary; autoridad=NONE; consumer retains only its pre-existing authority.

## Simulaciones y recuperación
- SIM:prediction_decision:1: Independent-looking evidence shares a hidden dependency → LOWER_CONFIDENCE_AND_RECOMPUTE; cinco roles, 30 eventos, cero terminales COMPLETE.
- SIM:prediction_decision:2: The producer proposes its own final review → ROUTE_TO_INDEPENDENT_REVIEWER; cinco roles, 30 eventos, cero terminales COMPLETE.
Si se supersede un input: congelar dependientes, registrar impacto, regresar al owner causal y reejecutar gates afectados.

## Observabilidad y terminación

Registrar agente, misión, versiones, charter, estado, gate decisions, lease, contexto, coste, bloqueos y trigger de reconsideración.
La coordinación termina sólo con artefactos schema-válidos, receipts independientes, handoffs reconocidos y UNKNOWN visible.

## Consistencia interna actual
- 350 FMEA y 450 evaluaciones V3.
- Auditoría transversal: 6/6 mutaciones críticas detectadas.
- No declara certificación independiente: esa revisión debe ocurrir fuera del camino de generación.
