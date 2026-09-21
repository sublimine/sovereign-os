# Cobertura de feedback público recibido — 10 septiembre 2026

## Causa concreta

La recuperación monpYO0G bajo 0251b72a terminó WAITING_CAPABILITY con una sola
llamada adicional (22.147 tokens): los dos scopes sí se entregaron, pero sólo
contenían hashes de solicitudes y admisiones de artefactos. R5 también exigía
descartar resultados del hermano transmitidos por feedback. El integrador no
confundió un inventario de artefactos con cobertura del texto recibido. Se
conservan la solicitud original, los dos ACCEPT y ambos bloqueos.

Las capturas previas al despacho de los dos productores originales contienen
feedback:[], corrections:[], failedMethod:null y step:0. Es una observación de
campos públicos realmente enviados, no acceso al razonamiento privado del modelo
ni una inferencia a partir de que el grafo tenga dos ramas. Sus hashes coinciden
con solicitudes registradas antes de crear los candidatos.

## Retención prospectiva y vinculación histórica explícita

Cada nueva solicitud pública de WorkerService se conserva antes del despacho,
en la misma transacción que su registro de request, con instrucciones, input,
schema, modelo/esfuerzo y perfil exactos. Se guarda como cadena JSON para conservar
el orden original del schema que forma parte del contrato de hash anterior.
El registro de control tiene máximo 8 MiB y no se expone completo a otros workers.
La SQLite privada conserva estas entradas: pueden incluir texto del usuario y
fuentes ya autorizadas para esa misión. No se añade red, proveedor ni herramienta.

Una solicitud antigua sólo puede vincularse por operación del controlador a
un hash ya existente en el historial de ese mismo run. HASH_BOUND_HISTORICAL
distingue esa retención posterior de BEFORE_DISPATCH; no se fecha hacia atrás ni
se modifica el productor original. Es idempotente y rechaza cambios de bytes,
schema, identidad o payloads no correspondientes. No es una acción disponible
al modelo. Un hash sin bytes conservados sigue siendo NOT_RETAINED.

El scope histórico añade por solicitud los campos íntegros feedback, corrections,
failedMethod y step cuando reconoce el contrato ordinario del mismo productor.
Las formas desconocidas siguen siendo UNSUPPORTED_INPUT_SHAPE; nunca se convierten
en listas vacías. Incluye referencia al registro exacto y origen de retención.
Las observaciones antiguas firmadas se conservan; una captura nueva puede añadir
esta cobertura sin reescribir el inventario antiguo. El corte de solicitudes
sigue siendo anterior al candidato, aunque su vinculación de bytes sea posterior.

Esto no certifica por sí solo no contaminación: un feedback con un resultado
del hermano se expone literalmente para que el juez lo examine. Las instrucciones
compartidas y otros textos necesitan inspección semántica separada; no acredita
ceguera sellada, pretraining, aislamiento del host ni verdad de los resultados.

## Pruebas y estado

Cuatro pruebas nuevas fallaron antes de implementar. Seis pasan después:
retención previa, orden de schema conservado, feedback resultante literal,
codecs v1/v2, legado desconocido/vinculación posterior idempotente y rechazo de
alteraciones. La integración simulada comprueba feedback vacío de ambas raíces.
Suite-KAm0mb: **563 pruebas, 562 PASS, cero fallos, un SKIP live**, 47,61 segundos.
No se ha cualificado todavía la nueva recuperación real ni instalado este cambio.
