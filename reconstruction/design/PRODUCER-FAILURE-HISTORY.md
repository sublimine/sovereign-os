# Historial de fallos y prueba de cambio pertinente

14 septiembre 2026, 00:01 UTC. Construcción posterior a R62Cdt/de4dd816;
regresión completa y un caso controlado con modelo real aprobados; no instalada.

## Dos defectos reproducidos

El guard anterior era un Set local dentro de `produce`. Se vaciaba al crear un
productor nuevo aunque éste heredara los recibos del fallo anterior. Por tanto,
podía repetirse la misma operación fallida con otra identidad. A la vez, en la
misma invocación prohibía leer de nuevo un archivo que antes faltaba incluso
después de crearlo correctamente mediante el broker.

Dos tests de SQLite/archivos/broker reales y modelo SIMULADO fallaron antes de
corregir: 2 FAIL/687.560415 ms. El primero volvió a enviar la lectura y acabó en
WORKER_LIMIT; el segundo bloqueó la lectura posterior a la creación confirmada.

## Decisión y ámbito

Reutilizar los recibos autenticados ya admitidos al actor, incluidos los heredados
por el mecanismo de recuperación existente. No inventar una memoria global ni
añadir llamadas de modelo para deducir si la petición es exactamente la misma.
Se compara herramienta/hash de argumentos y el orden de commits, no nombres de
agentes, etiquetas de método, orden del array o tiempos aproximados.

- El último fallo material de la misma petición permanece bloqueante entre actores.
- Una escritura posterior confirmada en la ruta pertinente permite PROPONER una
  nueva lectura/listado; no certifica el estado actual ni la calidad del producto.
- Para ENOENT, un listado posterior del padre que identifica el archivo/directorio
  permite volver a observar tras una reparación externa. Un listado vacío no.
- No se permite usar escrituras ajenas al problema, anteriores al último fallo,
  otro actor o una etiqueta nueva como prueba de progreso.
- La excepción sólo permite nuevas observaciones workspace.read/list, nunca repetir
  mutaciones, comandos o solicitudes de red. Siguen pasando por autoridad y broker.
- Los errores clasificados de cuota, autenticación, capacidad, cancelación, timeout
  y transporte conservan su recuperación de infraestructura y presupuestos propios.
- El lote entero se valida antes de ejecutar su prefijo; una futura escritura
  propuesta en ese lote no es una reparación ya realizada.
- No transfiere acciones, autoridad ni aceptación del productor anterior. Sin prueba
  pertinente, elegir otra petición/observación o requerir dirección; no declarar éxito.

Esto NO demuestra que una nueva estrategia sea semánticamente mejor ni implementa
replanificación general después de cierre. Es una frontera concreta de R06/R14,
no sustituto del resto del requisito. Hash exacto no detecta toda equivalencia
semántica entre peticiones distintas. El broker y sus límites siguen obligatorios.

## Resultados intermedios

Después de los dos rojos, hubo errores del test/helper: referencia a un método
inexistente de registry (corregida a lectura del registro), lectura de status
desde la envoltura en vez del recibo firmado y fixture de lote cuyo techo de una
operación impedía llegar a la frontera de dos miembros. Se preservaron los dos
contraejemplos; el fixture de lote declara dos operaciones, sin cambiar límites
de producto para obtener éxito. Batería intermedia 8 PASS/1 FAIL, 1407.630523 ms.

Once casos dirigidos finalmente PASS, 1155.695098 ms / sesión 31952 exit 0:
herencia simple/transitiva, reparación misma invocación y después de reemplazo,
escritura ajena/anterior, orden de journal frente a array invertido, rechazo del
lote antes de prefijo, infraestructura timeout, petición distinta y existencia
externa observada frente a listado vacío. Son proveedores simulados con efectos
locales reales.

Batería de siete archivos cerró 302 PASS/cero FAIL, 98267.780168 ms,
sesión 92113 exit 0; incluyó motor, workers, broker, recuperación de candidatos,
presupuesto de misión/plan y CLI. Las reglas explicativas adicionales sólo se
envían cuando el actor tiene historial de fallo; no se cargan a producción limpia.
Las reobservaciones permitidas conservan un evento con operación fallida, prueba
posterior y secuencias de commit; ese evento no afirma que la nueva operación ocurrió.

Primer test de tres SIGKILL reales cerró 2 PASS/1 FAIL, 2263.41303 ms, 42574 exit 1.
El fixture asumía `toolObservations.length` cuando la caída previa a observar
dejaba ese campo ausente; corregido a colección vacía para llegar a la frontera
de recuperación. No se cambió runtime para ese fallo del test. Retest completo:
3 PASS, 2492.657677 ms / sesión 31329 exit 0. Caídas antes de observar, después
de observar y después de reparar: el proceso posterior conserva recibo/fallo,
bloquea replay injustificado y permite lectura nueva tras reparación sin repetir
la escritura. No es un ensayo de reboot OS o varios días.

Global `suite-4KDODc` cerró 23:38:16.237 UTC / sesión 34954 exit 0:
1448 tests, 1447 PASS/cero FAIL/un SKIP, 535639.237211 ms. Auditoría posterior
23:39:15.548: 301 entradas, comandos y cuatro streams concordantes, owner ausente.
Freeze `08fe308664a490433b9ec1df7f07dbb029bdf5e3c69ff4ef27702c051ae56c51`,
423 archivos/24.124.973 bytes. No instalado.

Caso real posterior `failure-recovery-live-PRFwPC`: cuatro llamadas/67.787 tokens,
recuperación de recibo previo a observar tras SIGKILL, listado pertinente y nueva
lectura, candidato correcto y juez separado con relectura propia. Auditoría de
veinte citas y cuatro reservas/recibos/limpiezas. Preparación e input externos
CONTROLADOS, no fallo espontáneo del modelo ni planificación real. Véanse
[resultado y límites](../verification/FAILURE-RECOVERY-RESULTS.md).
