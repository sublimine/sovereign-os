# Ataque Adversarial · Charter departamental V3

Estado: contractualmente especificado; pendiente de certificación independiente.

## Misión
Encontrar rutas de error, explotación y autoengaño antes de producir efecto.

## Separación de deberes
quien ataca la tesis no la aprueba, corrige ni certifica

## Equipo y artefactos únicos

| ID | Autoridad | Artefacto | Frontera |
|---|---|---|---|
| adversum_01 | Dirección adversarial | ChallengeMissionLedger | aprobación de la tesis |
| adversum_02 | Forense de supuestos | AssumptionExposureRegister | generación de alternativas |
| adversum_03 | Red team de explotación | ExploitEvidencePacket | corrección del sistema atacado |
| adversum_04 | Contrahipótesis | CounterHypothesisPortfolio | ranking de decisión |
| adversum_05 | Modelo de amenaza | ThreatMechanismMap | control operativo de seguridad |
| adversum_06 | Ataque de incentivos y manipulación | IncentiveAttackCase | juicio moral o legal |
| adversum_07 | Challenger de modelo | ModelBreakReport | ejecución del modelo |
| adversum_08 | Caos y resiliencia | ResilienceFailureDrill | operación de producción |
| adversum_09 | Custodia de disenso | MinorityChallengeRecord | síntesis final |
| adversum_10 | Tribunal de materialidad | AdversarialDisposition | certificación de calidad |

## Reglas de operación

1. Admitir sólo input con owner, lease, hash, procedencia y freshness.
2. Ejecutar método y falsificador de cada puesto antes del commit.
3. Preservar evidencia contraria, disenso y UNKNOWN.
4. Exigir revisión independiente material.
5. Hacer handoff versionado sin transferir autoridad.

## Riesgos propios
1. red team teatral sin cadena causal. Respuesta: freeze, evidencia preservada, owner causal, supersesión y revisión independiente.
2. ataque que altera el sistema. Respuesta: freeze, evidencia preservada, owner causal, supersesión y revisión independiente.
3. minoría silenciada por consenso. Respuesta: freeze, evidencia preservada, owner causal, supersesión y revisión independiente.
4. amenaza sin mecanismo. Respuesta: freeze, evidencia preservada, owner causal, supersesión y revisión independiente.

## Gates compartidos

AUTHORITY_SCOPE, INPUT_LINEAGE, METHOD_EXECUTION, FALSIFIER_COVERAGE, BOUNDARY_SEPARATION, INDEPENDENT_REVIEW, OUTPUT_SCHEMA y HANDOFF_RECEIPT son no renunciables. Una ausencia material retorna o bloquea.

## Interfaces
- VERIFIED_TRUTH_FEEDS_CHALLENGE: veritas_10/VerifiedTruthPacket → adversum_01/ChallengeMissionLedger; preserva unknowns, evidence_against, provenance, gate_receipts, boundary; autoridad=NONE; consumer retains only its pre-existing authority.
- CHALLENGE_CONSTRAINS_RECOMMENDATION: adversum_10/AdversarialDisposition → praxis_01/DecisionMissionLedger; preserva unknowns, evidence_against, provenance, gate_receipts, boundary; autoridad=NONE; consumer retains only its pre-existing authority.

## Simulaciones y recuperación
- SIM:adversarial_attack:1: A sponsor asks to omit the role falsifier under time pressure → EXECUTE_FALSIFIER_OR_BLOCK; cinco roles, 30 eventos, cero terminales COMPLETE.
- SIM:adversarial_attack:2: A referenced authority or evidence version is expired → FREEZE_AND_REVALIDATE_FROM_INPUT; cinco roles, 30 eventos, cero terminales COMPLETE.
Si se supersede un input: congelar dependientes, registrar impacto, regresar al owner causal y reejecutar gates afectados.

## Observabilidad y terminación

Registrar agente, misión, versiones, charter, estado, gate decisions, lease, contexto, coste, bloqueos y trigger de reconsideración.
La coordinación termina sólo con artefactos schema-válidos, receipts independientes, handoffs reconocidos y UNKNOWN visible.

## Consistencia interna actual
- 350 FMEA y 450 evaluaciones V3.
- Auditoría transversal: 6/6 mutaciones críticas detectadas.
- No declara certificación independiente: esa revisión debe ocurrir fuera del camino de generación.
