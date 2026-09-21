# Respuesta pública de productor: persistencia y recuperación del final

14 septiembre 2026. Persistencia incluida en el paquete instalado efbdb0e9;
global nmUPLE y ensayo real j4OB9h son pruebas históricas del alcance descrito.
La corrección posterior instalada en 68fd4472 exige [cierre durable explícito](PRODUCER-CLEANUP-BARRIER.md)
antes de consumir la respuesta. La ausencia de un error de cierre no basta.
Las expectativas históricas que permitían recuperación inmediatamente después
del commit de respuesta fueron insuficientes: ese corte debe bloquear hasta
tener evidencia del cierre. El ensayo real j4OB9h sí cortó después de close,
pero no cualifica el nuevo registro de cierre ni su promoción de protocolo.
No es el macro de lecturas/tests de
[PRODUCER-CHECKPOINT.md](PRODUCER-CHECKPOINT.md).

## Problema reproducido

Antes se guardaba el recibo en `infer`, y la propuesta pública después de retornar
a `produce`. Fallar entre ambos dejaba una inferencia completada sin su respuesta.
El coordinador arrancaba otro productor, aun habiendo recibido el resultado.
En el contraejemplo con cuatro reservas, el reemplazo consumía la unidad necesaria
para la revisión independiente: terminaba NEEDS_DIRECTION, no COMPLETED.

Dos pruebas inicialmente rojas: pérdida después de recibir el final y fallo de
persistencia que dejaba recibo huérfano. [Salida conservada](../verification/experiments/producer-response-durability-red.json).
El primer run, 69150, produjo 2 FAIL/1797.639695 ms; el segundo guardó la salida
completa de esos mismos fallos sin cambios de runtime entre ambos.

## Contrato y orden

1. `produce` fija identidad de invocación, nodo completo e inputRefs, sin cambiar
   instrucciones, roles, schema del modelo ni límites.
2. La petición exacta y su reserva siguen guardándose antes del despacho.
3. Tras validar la forma pública, recibo y `worker-proposal` se comprometen juntos.
   La propuesta incluye referencias exactas de petición, configuración y versión
   del run completado, hashes de valor/mandato/política y vínculo documental cuando existe.
4. Un final ordinario no consumido puede materializarse bajo el mismo productor,
   contrato y exposición. Candidato y checkpoint se guardan en una transacción.
   No hay inferencia ni herramienta nueva; los inputs siguen teniendo que estar aceptados.
5. La revisión independiente continúa por el recorrido normal. Candidato recuperado
   no equivale a ACCEPT, y el presupuesto no se amplía ni se reembolsa.

Un lector en snapshot verifica versiones, hash de petición, orden de commits,
recibo único, configuración, contexto y contrato. Alterar nodo, inputs, política,
prefijo, respuesta, marcador de protocolo o evidencia falla cerrado.
Una llamada pendiente posterior o nueva exposición no autoriza reutilizar un final.
El cierre no confirmado del proveedor conserva su bloqueo, incluso con respuesta.

## Rechazos y límites deliberados

Una propuesta rechazada al materializarse conserva disposición REJECTED.
Un artefacto devuelto por el juez o invalidado tampoco puede resucitar desde su
respuesta anterior. La primera integración detectó dos regresiones precisamente
en este último caso: 220 PASS/2 FAIL. Se reprodujeron y corrigieron, manteniendo
las mismas pruebas y los criterios originales.
[Rojo](../verification/experiments/producer-response-reviewed-return-red.json),
[verde posterior](../verification/experiments/producer-response-reviewed-return-green.json).

La recuperación automática implementada es la del **final ordinario de un nodo
planificado**, no un cursor de herramientas. Propuestas tool/batch/document se
conservan, pero este lector no las ejecuta. El protocolo documental conserva su
binding sin prestar ventanas a la recuperación ordinaria. Las rutas cerradas de
entrada y otros protocolos que invocan infer directamente mantienen su mecanismo
anterior; no se les atribuye esta ampliación. El legado sin respuesta no se completa
inventando contenido. Una caída anterior al commit no prueba exactly-once remoto.

## Verificación obtenida

[26 pruebas dirigidas](../verification/experiments/producer-response-directed.json),
26 PASS, 5505.57131 ms, modelos explícitamente simulados. Incluyen cuatro formatos
de contexto, rechazo/alteración/cleanup, respuesta de herramienta sin despacho,
idempotencia de candidato y cinco SIGKILL **reales**:

- Antes de commit de respuesta: ni propuesta ni recibo quedan comprometidos;
  petición pendiente y reserva permanecen.
- Después: se conserva exactamente la respuesta con su recibo.
- Antes de commit de candidato: no queda artefacto parcial.
- Después: se devuelve la misma identidad, sin otro candidato.
- Dentro del motor completo: nuevo proceso recupera el mismo productor, usa
  sólo la cuarta reserva para su juez y completa; reentrada posterior sin llamadas.

El informe existente cuenta recibos guardados, no sólo eventos de finalización:
el test exige cuatro completadas y una sola producción, incluso si la caída
precede al evento `worker.inference.completed`. `worker.final.recovered` explica
la materialización posterior sin fingir una inferencia nueva.

Integración de seis archivos cerrada (64416, exit 0): 318 tests, 318 PASS,
cero FAIL, 79531.913454 ms. Recuento observado en terminal; no se conservó el
stream completo de esa integración. Global nmUPLE posterior: 1487 tests, 1486 PASS,
cero FAIL, un SKIP; 305 inputs/four streams auditados. Snapshot d6f5dd47,
424 archivos/24.139.333 bytes. [Ensayo real j4OB9h](../verification/PRODUCER-RESPONSE-RESULTS.md):
3 llamadas, 45.228 tokens, SIGKILL después del cierre del proveedor, mismo final
recuperado sin inferencia/herramienta, juez separado ACCEPT y reentrada en tercer
proceso sin replay. Auditoría de doce usos de citas y SQLite íntegra. Es un nodo
fijo conocido, no plan real ni engine.run completo. La batería 6l7Jfp y el ensayo
fD2w4s son anteriores: **no cualifican este cambio posterior**.
No se equiparan estos casos de durabilidad con inteligencia universal, ahorro
general, tres días de operación ni cierre del mandato R01–R16.
