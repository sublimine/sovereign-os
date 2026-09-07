# Protocolo de Escalado Ω

**Versión:** 1.0.0

## 1. Principio

Escalar significa transferir una decisión o bloqueo a la autoridad competente,
no enviar más prosa a Ω1. Cada escalado lleva owner actual, decisión exacta,
opciones, evidencia, deadline, coste de demora y autoridad necesaria.

## 2. Routing exacto

| Condición | Primer destino | Segundo | Ω1/humano sólo si |
|---|---|---|---|
| Input/schema/provenance inválido | productor → Ω7 | Ω2 | afecta M3/M4 o persiste |
| Contradicción factual | Ω11 | Ω10/Ω12 | cambia decisión soberana |
| Réplica diverge | Ω9 | Ω10/Ω11 | no hay método arbitral suficiente |
| Semántica/confianza | Ω12 | Ω22 | aceptación de riesgo decisional |
| Mission drift | Ω2 | Ω4 | cambia objetivo original |
| Over/under-decomposition | Ω4 | Ω2 | presupuesto/clase cambia |
| Presupuesto | Ω20 | Ω2 | reasignación estratégica o P0 |
| Legalidad/legitimidad/autoridad | Ω21 | humano jurídico | excepción soberana autorizable |
| Riesgo operativo | Ω18 | Ω19 | tolerancia superada/irreversible |
| Riesgo existencial | Ω19 | Ω21 + Ω1 | siempre P0 |
| Gate de calidad | Ω22 | owner + Ω2 | waiver o rechazo final |
| Fallo de proceso/abuso de poder | Ω3 | oversight humano | Ω1 implicado o material |
| Vulnerabilidad adversarial | Ω14 | Ω19/Ω21 | explotación material |
| Deadlock | Ω2 | árbitro de dominio | conflicto de autoridad restante |
| Modelo insuficiente | sponsor | Ω20 | Tier A adicional cambia budget |

## 3. Severidad

- E0 local: corregible en nodo.
- E1 branch: afecta subgrafo.
- E2 mission: afecta entregable.
- E3 strategic: afecta decisión, cartera o autoridad.
- E4 existential: daño catastrófico o violación constitucional.

E0/E1 no llegan a Ω1. E2 sólo si no puede resolver Ω2. E3/E4 requieren
SovereignAttentionPacket.

## 4. Estados

OPEN → ACKNOWLEDGED → INVESTIGATING → RESOLUTION_PROPOSED →
RESOLVED|REJECTED|SUPERSEDED. Si vence deadline: ESCALATED. Si falta acceso:
BLOCKED_AUTHORITY. Si riesgo inmediato: CONTAINED antes de investigar.

Un ACK no libera gate. Un timeout no equivale a aprobación.

## 5. Veto

VETO_ISSUED congela el scope mediante PolicyDecisionPoint. Liberación requiere
criterio original, evidencia de corrección y firma del owner o árbitro
constitucional. Ω1 puede emitir waiver sólo si el gate lo permite; el veto y
riesgo quedan adjuntos a la decisión.

## 6. Attention budget

Ω2 deduplica escalados con misma raíz, agrupa dependientes y devuelve paquetes
sin decisión concreta. El dashboard muestra cola soberana ordenada por riesgo
de demora, no por volumen ni insistencia del agente.

