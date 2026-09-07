# Matriz de Autoridad Ω

**Versión:** 1.0.0  
**Leyenda:** O=owner/decide; A=approve; X=execute/produce; V=verify; C=challenge;
B=block dentro de jurisdicción; U=audit; R=request/recommend; —=sin autoridad.

La matriz exhaustiva por agente y por las 19 acciones obligatorias es
**config/authority-actions.json**. Sus valores P/C/X/A se aplican junto con el
objeto y jurisdicción de este documento; la condición se resuelve mediante el
charter individual y PolicyDecisionPoint. Este diseño evita que “permitido”
para solicitar datos se interprete como acceso a cualquier dato.

## 1. Matriz por objeto

| Ω | Mandato | Misión | Evidencia | Claims | Estrategia | Riesgo | Recursos | Legitimidad | Calidad | Memoria/cambio |
|---|---|---|---|---|---|---|---|---|---|---|
| Ω1 | O | A | — | — | O | O/A | A | A | waive limitado | A |
| Ω2 | X/B | O | R | R | R | R | R | R | R | R |
| Ω3 | U/C | U/C | U/C | U/C | U/C | U/C | U/C | U/C | U/C | U/C |
| Ω4 | — | X | R | — | — | — | R | — | R | — |
| Ω5 | — | R | R | X | — | — | — | — | R | — |
| Ω6 | — | — | X | R | — | — | — | — | R | — |
| Ω7 | — | B | O/V/B lineage | V/B lineage | — | — | — | — | B | R |
| Ω8 | — | R | R | X | R | R | — | — | R | — |
| Ω9 | — | — | X/V | V/B réplica | — | — | — | — | B | — |
| Ω10 | — | — | V | V/B independencia | — | — | — | — | B | — |
| Ω11 | — | — | V | V/B factual | — | — | — | — | B | — |
| Ω12 | — | — | R | O/V/B estado | — | R | — | — | B lenguaje | R |
| Ω13 | — | C | C | C | C | C | C | C | C/B | — |
| Ω14 | — | C | C | C | C | C/B | C | C | C/B | C |
| Ω15 | — | R | R | X | R | R | — | — | R | — |
| Ω16 | — | R | R | X | R | R | R | — | R | — |
| Ω17 | — | R | R | R | X/R | R | R | R | R | — |
| Ω18 | — | R | R | X | R | X/R | R | R | R | — |
| Ω19 | — | B P0 | R | X | R | X/R/B | R | R | B | — |
| Ω20 | — | R | — | — | R | R | O/X/B | — | R | — |
| Ω21 | R | B | — | — | R | R/B | R | O/X/B | B | A/R |
| Ω22 | — | B gate | R | V | R | V | V | V | O/V/B | R |
| Ω23 | — | — | R | R | R | R | R | R | X/B dossier | — |
| Ω24 | — | R | — | R | — | R | R | R | R | O/X |

## 2. Acciones transversales

La tabla no reemplaza las matrices individuales. Reglas globales:

| Acción | Regla |
|---|---|
| Investigar | Ω5–Ω19 pueden encargar investigación en jurisdicción; Ω no ejecuta búsqueda masiva salvo diagnóstico. |
| Solicitar datos | Todos pueden REQUEST dentro de misión; acceso se filtra por clasificación y necesidad. |
| Crear agentes | Ω2 y Ω4 coordinan; cada Ω crea sólo especialistas de su capacidad y dentro de budget/charter. |
| Destruir agentes | Runtime termina instancias; sponsor puede cancelar hijos reversibles; preservar artefactos/audit. |
| Bloquear | Sólo por gate o riesgo dentro de jurisdicción, con razón y criterio de liberación. |
| Cancelar misión | Ω1; Ω2 por mandato/budget bajo límites; Ω19 por peligro inmediato hasta revisión; humano siempre. |
| Reiniciar nodo | Sponsor u Ω2; requiere nueva idempotency key si efectos externos no son idempotentes. |
| Modificar prioridad | Ω1/Ω2; Ω20 recomienda por capacidad; P0 downgrade requiere Ω1/humano. |
| Asignar recursos | Ω20 owner; Ω2 asigna dentro de envelope aprobado; Ω1 cambia cartera. |
| Cambiar herramientas | ToolProvider + sponsor dentro del perfil; elevación de privilegio requiere Ω21/humano. |
| Acceder memoria | PolicyDecisionPoint por scope; Ω3 audit-read; Ω7 lineage-read; nadie obtiene secretos por título. |
| Acceder secretos | Need-to-know, lease temporal, secreto aislado; high-risk requiere aprobación. |
| Contactar inferiores | Permitido por packet y event bus; bypass jerárquico sólo emergencia/auditoría y queda registrado. |
| Emitir alerta | Todos; severidad basada en schema; abuso medido. |
| Emitir veto | Ω3 proceso, Ω7 lineage, Ω9 réplica, Ω11 factual, Ω12 epistemología, Ω14 adversarial crítico, Ω19 existencial, Ω21 legitimidad, Ω22 calidad. |
| Aprobar | Sólo el objeto asignado; aprobar no certifica hechos. |
| Declarar UNKNOWN | Todos pueden proponer; Ω12 verifica etiqueta en claims M2+; Ω22 revisa suficiencia de búsqueda. |
| Ordenar replicación | Ω9 owner; Ω1/Ω2/Ω3/Ω10/Ω11/Ω12/Ω22 pueden requerirla. |

## 3. Límites de veto

Un veto contiene scope, evidencia, gate, severidad, owner, criterio de
liberación y deadline de revisión. No expira silenciosamente. Un conflicto:

- factual → Ω11, con Ω12 para estado;
- independencia → Ω10;
- lineage → Ω7;
- proceso → Ω3;
- legitimidad → Ω21;
- riesgo existencial → Ω19;
- suficiencia final → Ω22;
- conflicto entre dominios → Ω2 comprime; Ω1 decide acción, sin alterar hechos.

## 4. Autoridad de Ω3 sobre Ω1

Ω3 no manda a Ω1 ni revoca su decisión. Puede leer el registro, abrir un
finding, bloquear certificación por incumplimiento procesal, exigir respuesta
y escalar al humano/órgano de supervisión. Ω1 puede actuar con waiver sólo si
el gate es renunciable; el finding queda íntegro.

## 5. Default deny

Una celda vacía o ambigua es **—**. Ningún nombre grandilocuente concede
permisos implícitos. Tool, memory, network, secrets y efectos se evalúan por
capability token ligado a mission_id, agent_instance_id, scope y expiración.
