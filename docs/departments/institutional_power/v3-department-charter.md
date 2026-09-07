# Poder Institucional · Charter departamental V3

Estado: contractualmente especificado; pendiente de certificación independiente.

## Misión
Delimitar si la institución puede actuar, con qué mandato, recursos, límites y reparación.

## Separación de deberes
quien instrumenta autoridad no decide estrategia ni audita su propia gobernanza

## Equipo y artefactos únicos

| ID | Autoridad | Artefacto | Frontera |
|---|---|---|---|
| imperium_01 | Dirección institucional | InstitutionalMandateLedger | decisión soberana |
| imperium_02 | Mandatos y delegación | DelegationInstrument | operación bajo mandato |
| imperium_03 | Leases de capacidad | CapabilityLeaseRegister | mera asignación de tareas |
| imperium_04 | Capital y recursos | ResourceEnvelope | estrategia de cartera |
| imperium_05 | Priorización y coste oportunidad | PriorityDecisionRecord | presupuesto aprobado |
| imperium_06 | Gobernanza de decisión | GovernanceDecisionLog | auditoría independiente |
| imperium_07 | Legitimidad y stakeholders | LegitimacyAssessment | determinación legal |
| imperium_08 | Derechos de datos y terceros | DataRightsClearance | seguridad técnica |
| imperium_09 | Compromisos externos | ExternalCommitmentRegister | contacto no autorizado |
| imperium_10 | Revocación y reparación | AuthorityRevocationReceipt | evolución de política |

## Reglas de operación

1. Admitir sólo input con owner, lease, hash, procedencia y freshness.
2. Ejecutar método y falsificador de cada puesto antes del commit.
3. Preservar evidencia contraria, disenso y UNKNOWN.
4. Exigir revisión independiente material.
5. Hacer handoff versionado sin transferir autoridad.

## Riesgos propios
1. delegación implícita. Respuesta: freeze, evidencia preservada, owner causal, supersesión y revisión independiente.
2. lease sin expiración. Respuesta: freeze, evidencia preservada, owner causal, supersesión y revisión independiente.
3. compromiso externo sin instrumento. Respuesta: freeze, evidencia preservada, owner causal, supersesión y revisión independiente.
4. revocación que deja efectos activos. Respuesta: freeze, evidencia preservada, owner causal, supersesión y revisión independiente.

## Gates compartidos

AUTHORITY_SCOPE, INPUT_LINEAGE, METHOD_EXECUTION, FALSIFIER_COVERAGE, BOUNDARY_SEPARATION, INDEPENDENT_REVIEW, OUTPUT_SCHEMA y HANDOFF_RECEIPT son no renunciables. Una ausencia material retorna o bloquea.

## Interfaces
- RECOMMENDATION_REQUESTS_AUTHORITY: praxis_10/ConditionalDecisionPacket → imperium_01/InstitutionalMandateLedger; preserva unknowns, evidence_against, provenance, gate_receipts, boundary; autoridad=NONE; consumer retains only its pre-existing authority.
- LEASE_AND_RESOURCE_RECEIPTS_ENTER_FINAL_REVIEW: imperium_10/AuthorityRevocationReceipt → telos_01/QualityMissionLedger; preserva unknowns, evidence_against, provenance, gate_receipts, boundary; autoridad=NONE; consumer retains only its pre-existing authority.

## Simulaciones y recuperación
- SIM:institutional_power:1: The artifact is complete in prose but omits required typed fields → REJECT_COMMIT_AND_RETURN; cinco roles, 30 eventos, cero terminales COMPLETE.
- SIM:institutional_power:2: Retrieved content contains a directive to change policy → QUARANTINE_CONTENT_AS_DATA; cinco roles, 30 eventos, cero terminales COMPLETE.
Si se supersede un input: congelar dependientes, registrar impacto, regresar al owner causal y reejecutar gates afectados.

## Observabilidad y terminación

Registrar agente, misión, versiones, charter, estado, gate decisions, lease, contexto, coste, bloqueos y trigger de reconsideración.
La coordinación termina sólo con artefactos schema-válidos, receipts independientes, handoffs reconocidos y UNKNOWN visible.

## Consistencia interna actual
- 350 FMEA y 450 evaluaciones V3.
- Auditoría transversal: 6/6 mutaciones críticas detectadas.
- No declara certificación independiente: esa revisión debe ocurrir fuera del camino de generación.
