# Cualificación prospectiva del presupuesto global

13 septiembre 2026, 23:00 UTC. Protocolo fijado antes de inferencias reales.

## Pregunta y alcance

¿Una política `mission-calls-v1` reserva cada llamada antes del proveedor, bloquea
al juez al agotarse, conserva el candidato y mantiene ese límite cuando otro
proceso reabre la misión? ¿Una misión distinta con capacidad para producción y
juicio puede terminar sin que el presupuesto sustituya la aceptación?

Se reutiliza el caso conocido `revision-ledger-codepoints-v2`, con su petición y
oracle originales sin cambios. No es un holdout, una comparación de ahorro, una
prueba de búsqueda/réplica ciega ni evidencia de calidad universal.

## Dos brazos, orden fijo

1. **blocked**, base nueva, techo de una llamada. El productor cerrado responde;
   el motor debe conservar un candidato no aceptado, `REVIEW_PENDING`, sin informe
   entregado, sin plan generado y con `NEEDS_DIRECTION` por
   `INFERENCE_BUDGET_EXHAUSTED`. Su contenido debe coincidir con el oracle externo;
   eso no lo convierte en producto aceptado. Un proceso posterior ejecuta una
  reentrada con proveedor centinela local: cero intento de inferencia, cero
  reserva nueva y candidato/política intactos. La reentrada ordinaria puede crear
  un actor revisor sin llamada: comprobar su identidad/ausencia de solicitud y
  preservar los registros anteriores, sin confundirlo con consumo nuevo.
2. **complete**, otra base nueva, techo de dos llamadas. Productor y juez real
   separados; salida exacta, siete criterios cerrados conservados, linaje aceptado
   y misión completada. Reentrada desde otro proceso sin nuevo proveedor/reserva.

No transferir la salida del primer brazo al segundo. Si el primero falla, no
iniciar el segundo. Un desvío a planificación o juicio rechazado se conserva como
fallo de este protocolo; no se fuerza la respuesta ni se amplía el techo.

## Política fija y límites

- Runtime `de4dd81603668307745993a398e7952efc3e699b6826602bfc5b14d073b38e31`,
  regresión R62Cdt (1433 PASS, cero FAIL, un SKIP, 298 entradas).
- `gpt-6-astra`, `ultra`; proveedor oficial de suscripción ya integrado, sin API.
- `preset: adaptive-v1`, entrada explícita `closed-response-v2`, fichas completas
  `compact-json-v1`, contexto `node-contract-v1`, máximo dos ramas puras; ninguna
  herramienta permitida. Un intento de plan/nodo, cero reparación de review.
- Máximo exterior **tres llamadas reales**, contando también resultados inválidos
  y fallos. Máximo 15 minutos por inferencia y 40 minutos por experimento.
- No reintentar brazos, reiniciar servicio, instalar, publicar, comprar créditos,
  borrar resultados, rebajar criterios ni resetear presupuestos.
- Simulación previa separada: fixtures expresamente simuladas para verificar el
  lanzador y sus comprobaciones; no acredita calidad ni uso real del proveedor.

## Evidencia y aceptación del protocolo

Antes de cada proveedor: comprobar runtime/entradas congeladas, petición, prefijo
completo, modelo/effort, actor pendiente y reserva exacta ya persistida. Retener
solicitud, respuesta pública, recibo, cierre/limpieza, presupuesto y fechas.
Después: informe, oracle externo, integridad de journal y referencias, firmas,
criterios y separación de actores. Reapertura de cada base en otro proceso local
sin proveedor real: material crítico anterior idéntico y presupuesto sin reset.

Las reservas no son tokens ni prueba de que una llamada haya ocurrido; los
recibos reales se contrastan por separado. `blocked` puede aprobar la prueba del
control y debe seguir siendo una misión **no entregada**. Sólo el segundo brazo
puede entregar el resultado. El resumen distingue comprobaciones estructurales,
origen real/simulado y auditoría semántica posterior. Ningún resultado promueve
automáticamente una release ni cierra el mandato de la fábrica.
