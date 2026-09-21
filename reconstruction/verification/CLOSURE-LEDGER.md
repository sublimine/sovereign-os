# Ledger de cierre del mandato

Actualizado: 20 septiembre 2026. Este documento sustituye los porcentajes de
avance por condiciones de aceptación comprobables. No es un certificado de
calidad ni de superioridad: una fila sólo pasa a `CERRADO` cuando su evidencia
es reproducible, su alcance está declarado y no deja una dependencia material
sin resolver.

## Regla de informe

- `CERRADO`: evidencia y condición de aceptación completas para el alcance
  declarado, más regresión pertinente limpia.
- `PARCIAL`: hay implementación o evidencia delimitada, pero no cubre toda la
  condición de aceptación.
- `ABIERTO`: no hay una demostración suficiente o falta una decisión/evidencia
  imprescindible.
- `BLOQUEADO`: no se puede continuar sin una autoridad, recurso o cambio
  externo concreto. No se usa para ocultar trabajo pendiente.

No se calcula una media de estas filas. Un sistema con quince filas cerradas y
una frontera de entrega sin probar no está terminado.

## Matriz R01–R16

| ID | Estado actual | Evidencia existente y delimitada | Condición para cerrar |
| --- | --- | --- | --- |
| R01 — estudio del borrador | PARCIAL | Catálogos, charters, auditorías y documentos normativos están presentes; el motor consulta fichas completas bajo demanda. | Inventario trazable de todo el borrador relevante, análisis individual y referencias exactas que demuestren qué se conservó, fusionó o descartó. |
| R02 — consolidación y eliminación de redundancia | PARCIAL | Matrices de roles, relaciones y autoridad; selección por facetas en vez de un equipo fijo. | Decisiones de consolidación completas, motivadas y contrastadas contra las capacidades originales, incluidas las lagunas añadidas. |
| R03 — dirección única | PARCIAL | `FactoryEngine`, cola persistente, mandato y reportes trazables. | Demostración integrada de asignación, supervisión, escalado y reporte sin que la coordinación ordinaria recaiga en el usuario. |
| R04 — activación adaptativa y eficiencia | PARCIAL | Rutas/presets adaptativos, límites y mediciones de contexto; no se fuerza un número fijo de agentes. | Casos representativos con costes y calidad comparables que prueben que el enrutamiento es proporcional sin omitir controles materiales. |
| R05 — planificación profunda | PARCIAL | Planes causales, alternativas, criterios, dependencias y revisión independiente; inspección de fichas opt-in. | Cierre de la barrera de planificación y cualificación end-to-end de rutas de planificación materiales, incluida recuperación. |
| R06 — cambio de método tras fallo | PARCIAL | Recuperación de método revisada, diagnósticos retenidos y pruebas de no repetición. | Evidencia integrada de que los cambios de método mejoran la vía pertinente sin regenerar o maquillar el mismo fallo. |
| R07 — revisión de cada producto material | PARCIAL | Artefactos versionados, revisiones independientes, invalidez transitiva y relectura/ejecución cuando aplica. | Validación global limpia de cada ruta habilitada y una definición de cobertura que no deje consumidores materiales fuera. |
| R08 — información verificable | PARCIAL | Procedencia, hashes, fuentes, citas, separación de hechos/inferencias y retracción. | Cualificación de investigación y contradicción en casos representativos de fuentes actuales; no basta con una consulta aislada. |
| R09 — jueces y aceptación final | PARCIAL | Jueces separados, criterios observables, oráculos de archivos/ejecución y límites contra autocertificación. | Evidencia de calibración y límites de los jueces en escenarios de éxito, rechazo, incertidumbre y corrección material. |
| R10 — especialización de agentes | PARCIAL | Catálogo de 154 fichas, charters, máquinas de estado y controles de rol. | Auditoría completa de asignación efectiva: cada ficha relevante debe tener responsabilidad no ceremonial, límites, escalado y prueba de uso correcto. |
| R11 — aprendizaje con evidencia | ABIERTO | Infraestructura de evaluación, procedencia, promoción y rollback; producción no tiene overlay activado ni mejora medida. | Dominio autorizado con baseline, holdout, resultado medido, revisión independiente, promoción/reversión segura y ausencia de regresión. |
| R12 — creación de especialistas | PARCIAL | Especialistas por misión con charter, justificación, límites y pruebas. | Política y cualificación que prueben cuándo crean valor frente a reutilizar roles, sin inflación de especialistas. |
| R13 — ejecución por suscripción | PARCIAL | Adaptador oficial y pruebas SIM; no hay fallback a API ni compra de créditos en el diseño. | Cualificación controlada de las rutas autorizadas por suscripción, con límites de cuota, cierre del proveedor y recuperación observados. |
| R14 — persistencia de trabajos largos | PARCIAL | SQLite, journal, fencing, recuperación, cancelación, cuotas y pruebas de caída/reentrada. | Ensayo operativo de duración y recuperación definido de antemano, con evidencia de servicio y de las incertidumbres no repetibles. |
| R15 — investigación de alternativas | ABIERTO | Hay documentos de comparación, auditorías y decisiones técnicas puntuales. | Investigación completa y fechada de alternativas relevantes con fuentes primarias, criterios de reutilización/construcción y decisiones explícitas. |
| R16 — entrega integrada comprobable | ABIERTO | CLI, servicio, manuales, pruebas y evidencias parciales existentes. | Todas las filas anteriores cerradas o declaradas explícitamente fuera de alcance por decisión humana; regresión global limpia, auditoría de instalación y entrega verificable. |

## Puertas que siguen abiertas ahora

1. Cerrar la regresión global del árbol de desarrollo posterior a las últimas
   fronteras de proyección pública. Un pase histórico no acredita código que
   cambió después.
2. Resolver y volver a ejecutar los arneses que antes leían telemetría pública:
   los verificadores de prueba deben consultar evidencia durable sin debilitar
   la frontera pública.
3. Convertir la cobertura de fichas y la investigación de alternativas en
   evidencia explícita de R01, R02, R10 y R15, no sólo en existencia de
   documentos.
4. Diseñar, antes de ejecutarlo, el plan de cualificación controlada por
   suscripción/operación para R13 y R14. No se debe gastar cuota ni modificar
   la instalación sólo para poder marcar una casilla.
5. Cerrar R16 únicamente después de las puertas anteriores. Ninguna cantidad
   de tests o agentes sustituye ese cierre.

## Forma de actualizarlo

Cada actualización debe indicar: requisito afectado, cambio verificable,
comando o evidencia exacta, resultado, alcance, y condición restante. Una
prueba roja reduce o mantiene estado; una verde aislada no eleva una fila a
`CERRADO`. Las afirmaciones de perfección, superioridad mundial o finalización
no aparecen en este ledger sin evidencia independiente suficiente.
