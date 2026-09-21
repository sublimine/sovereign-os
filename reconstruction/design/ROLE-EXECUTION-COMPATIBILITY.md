# Ficha preservada no equivale a método ejecutable

## Actualización — 13 septiembre 2026: custodia operacional

ZxHWcv, en50649873, rechazó su segundo plan: asignaba omega_07 como revisor
ordinario sin el servicio completo de ProvenanceSeal, cierre determinista,
replay e invalidación con acuses que exige su ficha. La auditoría independiente
contrastó ambas fuentes originales y la ficha compilada. No equivale a un
fallo de recuperación HTTP: no se llegó a adquirir ninguna fuente.
[Evidencia exacta](../verification/DOCUMENTARY-LIVE-ZxHWcv.md).

En desarrollo posterior se añade esa incompatibilidad a la admisión de roles,
ligada al hash de la ficha completa. Se comprueba antes de revisar el plan,
crear el trabajador y ejecutar un trabajador persistido. La ficha se mantiene
legible, intacta y auditable. La clasificación se limita aomega_07: agrupar
otros roles como operational_provenance no prueba que sus contratos completos
sean idénticos. No se emite una certificación de los roles no listados.

Los controles reales de Store/Authority/ArtifactRegistry siguen activos. No se
les atribuye automáticamente toda la custodia declarada: hacen falta adaptador,
contrato propio, pruebas de cierre/replay/notificación y cualificación integrada
antes de afirmar esa implementación. Si el usuario exige ese servicio, queda
como obligación pendiente; no se sustituye por una revisión semántica. Si pide
un resultado documental ordinario, un rol compatible puede revisar su contenido
y fuentes bajo los controles existentes, sin afirmar que ejecutóomega_07.

El bloque siguiente es histórico. La ruta cerrada de réplica se implementó y
ensayó después, con su contrato específico; no hace ordinarios los modos de
blind_replication ni convierte aquel ensayo antiguo en correcto.

## Hallazgo observado, 10 septiembre 2026, 03:24 UTC

La misión real `mission:30ccdd94-3493-47bb-a6e7-50491b0037a4` del ensayo
`sovereign-node-plan-view-live-h53t6RZV`, paquete inmutable `f4867dc0`, asignó
`veritas_04` como juez de ambos prerrequisitos. El plan recibió PASS en
capability-fit. Sin embargo, `WorkerService.review` expone el candidato antes
de la primera inferencia. Eso no implementa la ficha de réplica ciega.

- Plan: `artifact:81084611-5d1b-4d96-ac5a-73ea8fc69932`, hash
  `dd4b6ae5ad22ef0485471d12c9499897b62be7d1dd6411e7c35bceabde602e38`.
- Revisión del plan: `review:ee00f51e-3c05-4219-8e93-24d9702e1be0`.
- Revisión del hitting set: `review:50f4dcb7-3c3e-4947-80a8-65efdcb77977`.
  Su incertidumbre declara literalmente:
  “This manual review is not a sealed blind replication.”
- La revisión de órdenes topológicos
  `review:2f7490b1-accc-4170-8a3c-79203aaa0165` describe reconstrucción manual.
  Ambas razones matemáticas son correctas para los casos dados; eso no demuestra
  la ejecución del método particular de la ficha asignada.

Las fichas completas `veritas_04` y `omega_09`, releídas, pertenecen a
`blind_replication`: protocolo fijado, original oculto, resultado independiente
sellado, apertura posterior y comparación de divergencias. No se borran ni se
redefinen. Sus auditorías y hashes originales siguen en el catálogo íntegro.

## Corrección implementada en desarrollo; no calificada ni instalada todavía

`role-execution.mjs` declara incompatibilidades conocidas por capacidad, no por
el título que improvisa un plan. Ambos roles quedan indisponibles para el modo
ordinario productor/revisor mientras no exista su adaptador de réplica sellada.
La lista y la procedencia llegan al planificador; el control determinista rechaza
el plan antes de revisión y conserva la propuesta fallida. También se comprueba
al instalar un plan, crear un trabajador y antes de inferir con uno persistido.
Reanudar un plan incompatible exige nueva planificación y revisión sin borrar
requisitos ni efectos congelados. El validador estructural permite leer planes
históricos: el nuevo control no reescribe sus cuerpos, hashes o veredictos.

Una comprobación matemática ordinaria puede usar otra faceta si satisface el
mandato original. Si el usuario exige réplica ciega, la obligación continúa
pendiente; cambiar el nombre o crear otro hilo no la satisface. Tampoco la
satisface por sí sola una vista de nodo, que no sella ni abre un original.

Este control específico no acredita todos los métodos de los otros 152 roles.
El catálogo describe responsabilidades y sigue requiriendo evidencia operacional
de cada método material. El adaptador real de réplica ciega sigue pendiente.
El ensayo h53 no se modifica ni se duplica: cualquier PASS de su oráculo acotado
coexiste con este fallo de asignación, no lo elimina.
