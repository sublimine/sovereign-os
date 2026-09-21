# Persistencia de la respuesta de entrada cerrada

14 septiembre 2026. Cambio posterior a d6f/nmUPLE/j4OB9h; no instalado.
Global MUS7Oc y ensayo real mB7oR4 cerrados y auditados. La reparación previa del productor planificado no
cubría `runClosedEntry`, que invoca infer directamente.

## Fallos reproducidos y reparación

Seis pruebas originalmente fallidas, dos versiones × tres límites:
fallo del evento después de recibir respuesta, fallo del checkpoint de entrada,
y cierre de proveedor no confirmado. Los dos primeros compraban una producción
de reemplazo y agotaban un techo de dos llamadas antes del juez. El tercero
dejaba el cierre como TIMEOUT ordinario, sin bloqueo durable.
[Rojo conservado](../verification/experiments/closed-entry-response-red.json):
2473 exit 1, seis FAIL, 2008.265696 ms. Tras reparación: 99043 exit 0, seis PASS,
1693.615464 ms; este primer recuento procede de la salida de terminal.

La nueva entrada fija `closed-entry-response-v1` desde su primer registro.
Infer compromete juntos recibo y respuesta pública inmutable. Se comprueban
actor, versión de entrada, misión, política, roles completos o contrato del
controlador v2, petición exacta, schema, criterios y exposición. No cambia la
respuesta solicitada al modelo, presupuesto ni condiciones de aceptación.

Después del retorno de provider.close se guarda su disposición por separado.
CLOSED significa que el adaptador de confianza retornó sin error; el dato
processExitObserved se conserva sólo si el adaptador lo proporciona. No se
inventa observación de proceso para stubs que no la entregan. UNCONFIRMED o
registro ausente tras un despacho bloquea reutilización y reemplazo automáticos.
Una caída entre respuesta y cierre queda, por tanto, expresamente incierta.

El lector usa snapshot SQLite, referencias/versiones exactas, hash del valor y
orden petición → recibo → respuesta → disposición de cierre. El checkpoint de
entrada se reconstruye a partir del original, bajo el mismo actor y sin llamar
de nuevo al proveedor. Su candidato continúa al juez independiente normal.
Un `plan` retenido deriva a planificación sin exponer su razón como premisa.

## Compatibilidad y límites

Entradas históricas sin marcador conservan su recorrido anterior; no se inventa
respuesta perdida ni se migra retrospectivamente una inferencia. Una llamada
fallida sin recibo, pero con cierre confirmado, puede conservar el reintento
anterior bajo un actor nuevo, sin borrar su coste ni incertidumbre remota.

Este cambio no añade un reconciliador de procesos para un cierre desconocido,
ni prueba exactly-once remoto, apagado de OS o todas las misiones. Un registro de
cierre alterado no se admite como confirmación. No pretende cubrir las otras
rutas de inferencia ni reemplazar su protocolo de persistencia.

Ampliación: 35 PASS, cero FAIL, 9381.048406 ms (77730, exit 0), con doce SIGKILL
reales en seis límites para cada versión. [Salida íntegra](../verification/experiments/closed-entry-response-35-corrected-tests.json).
Los cortes sin disposición de cierre bloquean; después del cierre recuperan con
una sola llamada restante para revisión. Cuatro codecs, nueve alteraciones y
legado comprobados. Integración previa de cinco archivos: 273 PASS, cero FAIL,
54871.529418 ms (57877), recuento de terminal, no stream completo conservado.

Se reprodujo y corrigió además `processExitObserved:false` sin excepción: no es
cierre confirmado. El primer retest de 35 tuvo 33 PASS y dos fallos porque la
prueba esperaba NEEDS_DIRECTION en lugar del WAITING_CAPABILITY que el motor ya
asigna a CLEANUP_UNCONFIRMED. Se corrigió la categoría esperada, no el criterio
de bloqueo. Ambas salidas previas permanecen en verification/experiments.
La global KrAomV/84272 fue lanzada prematuramente; se interrumpió con SIGTERM
el 14 septiembre 01:34:23.553, salida cerrada exit 1, sin recuento final. No PASS.

Global MUS7Oc/32637: 1522 tests, 1521 PASS, cero FAIL, un SKIP,
320965.140068 ms; cierre 01:41:08.368 UTC. Auditoría 01:42:51.962 verificó
308 entradas, cuatro streams, comandos y ausencia del propietario.
Freeze `e07a8b33322dd4c2e2bddf46f9e9b9064a052b779b11b4ededbae4c97afa3589`.
Ensayo real mB7oR4/46910: dos llamadas, 19.531 tokens, corte SIGKILL después
del cierre y antes del candidato, recuperación por engine.run y juez separado.
Auditoría 01:50:37.973 y lectura sustantiva del resultado completas.
[Resultados y alcance](../verification/CLOSED-ENTRY-RESPONSE-RESULTS.md).
No demuestra recuperación sin prueba de cierre, otras clases de trabajo,
eficiencia general ni operación de la versión instalada. R01–R16 no cerrados.
