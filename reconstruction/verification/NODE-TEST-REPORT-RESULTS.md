# node:test: controles negativos y finalización — YZlT77

13 septiembre 2026. Diagnóstico separado de tGHBOv, sin inferencias ni cambios
en su misión, código congelado, instalación o límites. Tres fixtures fijadas en
qualification.json antes de ejecutar. [Prerregistro](NODE-TEST-REPORT-DIAGNOSTIC.md).

Cerró02:42:57.103, sesión6386 exit0; proceso1910657 ausente02:43:50.277.
Resultado completo en runs/node-test-report-YZlT77/summary.json, SHA256
b4e6cf46ee168f69663fc1a14f81114c5d86fe7c9e76d5d2f42f2d4a74fdd1a8.

| Control | Esperado | Observado |
|---|---|---|
| Dos tests válidos y un assert.equal(1,2) | exit no0 | exit1, tests1/fail1 |
| Error top-level explícito | exit no0 | exit1, error exacto visible y tests1/fail1 |
| Dos callbacks esperados, contador sólo tras aserciones, guardia final igual2 | exit0 | exit0, tests1/pass1 |

Los tres resultados fueron nativos, sin red, snapshot exacto y cleanup confirmado.
Verificación read-only02:43:50.277: las tres unidades exactas not-found/inactive,
sus scratch ausentes, proceso propietario muerto. No cleanup amplio ni señales.

**Conclusión acotada:** tests1 no demuestra por sí mismo que se omitieran los
callbacks. La implementación incorrecta de la fixture no pasa; la fixture con
guardias demuestra que terminaron sus dos cuerpos pese al conteo por archivo.
Esto no prueba todavía los21 casos de tGHBOv, ni la ausencia de todos los fallos
de reporting. La causa exacta de que no se publique el detalle interno sigue
sin demostración experimental. No se cambia argv, aislamiento ni permisos para
obtener otro reporte, ni se inyecta el resultado en el contexto de tGHBOv.

Siguiente cambio después del cierre de tGHBOv: conservar estos controles de
falsos aprobados y callbacks completos como regresión del runner, con fixtures
propias y sin exigir un formato concreto de stdout. El test tiene que comprobar
el comportamiento del ejecutable, no contar por regex las pruebas del producto.
