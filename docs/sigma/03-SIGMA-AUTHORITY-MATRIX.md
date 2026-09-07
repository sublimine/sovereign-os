# Matriz de Autoridad Σ

**Fuente exhaustiva:** `config/sigma/authority-actions.json`  
**Dimensión:** 40 roles × 24 acciones = 960 decisiones explícitas  
**Semántica:** P permitted; C conditional; X prohibited; A external approval.

## 1. Regla de evaluación

Una celda P no basta. `PolicyDecisionPoint` evalúa:

```text
role policy
AND active CapabilityLease
AND mission/object scope
AND classification/compartment
AND tool/effect capability
AND freshness
AND required approvals
AND no active veto
```

Ausencia, ambigüedad o fallo produce DENY. Las 24 acciones son: investigar,
solicitar datos, crear/terminar especialistas, bloquear/cancelar/reiniciar,
cambiar prioridad/presupuesto/tool, leer/escribir memoria, acceder secreto,
contactar exterior/inferiores, bypass, alertar/vetar/aprobar, declarar UNKNOWN,
ordenar réplica, publicar, diseminar sensible y modificar policy.

## 2. Autoridad por objeto

| Objeto | Owner productor | Control interno | Control Ω |
|---|---|---|---|
| mandato Σ | Σ1 | Σ2/Σ38 proceso | Ω2/Ω5/Ω21 |
| decisión del consumidor | Σ5 | Σ3/Σ38 | Ω2/Ω5 |
| requisitos | Σ3 | Σ4/Σ5/Σ38 | Ω5 |
| cobertura/prioridad interna | Σ4 | Σ2/Σ38 | Ω20 |
| collection portfolio | Σ6 | Σ4/Σ12/Σ38 | Ω6/Ω21 |
| acceso a fuentes | Σ7 | Σ13/Σ30 | Ω6/Ω21 |
| contacto experto/partner | Σ9 | Σ13/Σ30 | Ω21/humano |
| admisibilidad | Σ14 | Σ17/Σ30/Σ38 | Ω7/Ω11 |
| source assessment | Σ15 | Σ16/Σ29/Σ38 | Ω10–Ω12 |
| dependency graph | Σ16 | Σ38 | Ω10 |
| lineage operacional | Σ17 | Σ38 | Ω7 |
| entity/event/network | Σ18/19/20 | Σ38 | Ω7/Ω8/Ω11 |
| medición/semántica | Σ21/23 | Σ38 | Ω8/Ω11/Ω12 |
| knowledge graph | Σ22 | migration gate/Σ38 | Ω7/Ω12/Ω24 |
| fusion | Σ24 | Σ36/Σ38 | Ω10–Ω12 |
| actor/context/causal | Σ25–27 | Σ28/Σ36/Σ38 | Ω8/Ω13/Ω15 |
| hipótesis | Σ28 | Σ36/Σ38 | Ω9/Ω13/Ω15 |
| deception | Σ29 | Σ30/Σ36/Σ38 | Ω10/Ω14 |
| counterintelligence | Σ30 | protected Ω3 channel | Ω3/Ω14/Ω21 |
| estimate | Σ32 | Σ33/Σ38 | Ω12/Ω16 |
| warning | Σ33 | Σ38 | Ω12/Ω19/Ω23 |
| surprise/opportunity | Σ34/35 | Σ36/Σ38 | Ω15–Ω20 |
| dissent | Σ36 | protected channel | Ω3/Ω12/Ω22/Ω23 |
| product/dissemination | Σ37 | Σ13/Σ36/Σ38 | Ω21/Ω22/Ω23 |
| quality | Σ38 | independent instance | Ω3/Ω22 |
| continuity | Σ39 | Σ38 | Ω2/Ω7/Ω24 |
| effectiveness/change proposal | Σ40 | Ω3/Ω24 | Ω24/Ω1 |

## 3. Bloqueos legítimos

- Σ13 bloquea exposición de fuente/compartment, no el juicio.
- Σ14 bloquea admisión de contenido inseguro, no prueba que sea falso.
- Σ17 bloquea publicación interna por lineage material roto.
- Σ30 congela rutas ante compromiso, con mínimo blast radius y revisión.
- Σ33 preempta por warning válido, no decide la respuesta.
- Σ36 bloquea ocultación de contradicción/disenso material.
- Σ38 bloquea calidad interna, no certifica Ω.

Todo veto declara objeto, gate, evidencia, severidad, release condition, owner y
review deadline. No expira silenciosamente.

## 4. Contacto y efectos externos

Sólo un lease específico puede permitir contacto. Σ9 posee capacidad
operacional condicionada; Σ13 controla handling; Ω21/humano autoriza cuando hay
representación, obligación, pago, datos sensibles o riesgo. Descubrimiento Σ7,
documentos Σ8, sensores Σ10 y geoespacial Σ11 no obtienen contacto por función.

## 5. Independencia protegida

Σ1/Σ2 pueden activar y priorizar Σ30/Σ36/Σ38/Σ40, pero no dictar hallazgo,
cerrar caso, alterar evidencia ni bloquear canal protegido. Abuso produce
`INDEPENDENCE_VIOLATION`, audit trail Ω3 y freeze del objeto afectado.

