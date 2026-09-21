# Diagnóstico acotado de node:test — prerregistro

13 septiembre 2026, 02:42 UTC. tGHBOv conserva sus inputs y ejecución en curso.
Su primer comando real presenta exit0, tests1, pass1 aunque el archivo declara
21 tests. Response-6 detecta la discrepancia sin aceptar ni borrar el recibo.
Todavía no se sabe si es presentación agregada o ejecución incompleta.

Se ejecutarán tres snapshots sintéticos separados con el mismo runner congelado
7d9ba690 y Node24.19.0. No usan el producto ni la misión tGHBOv, no solicitan
inferencias y no cambian permisos, herramientas, límites, código o instalación.
Se guardan fixtures y hashes antes de lanzar el primer comando, y dueño/unidad/
scratch antes de cada ejecución. Nunca se importa este código en el controlador.

1. Tres tests node:test, dos correctos y uno con assert.equal(1,2): el proceso
   debe terminar con exit distinto de0; una mera línea «pass» no basta.
2. Error top-level explícito antes de registrar pruebas: debe terminar no0.
3. Dos tests correctos con promesas esperadas y contadores incrementados sólo
   después de las aserciones; al final assert.equal(completed,2): debe terminar0.

Para los tres, argv exacto node --test probe.test.mjs, cwd raíz. No modificar
fixtures según el resultado; conservar stdout/stderr/código y límites. Estos
controles distinguen fallos observables y completitud de callbacks de un conteo
visual del reporter, no garantizan toda integración ni cubren código hostil.
Si hay discrepancia, diagnosticar antes de cualquier cambio o promoción.

Referencia primaria consultada: [modelo de ejecución de node:test](https://nodejs.org/api/test.html#test-runner-execution-model).
La documentación describe procesos por archivo y que exit0 puede aprobar un
archivo aunque no use node:test. Por tanto un conteo agregado no basta por sí
solo para afirmar ejecución interna. Se inspecciona además el código incorporado
en la versión local, no se presupone identidad con la versión web actual.

Estado: prospectivo, resultados aún no obtenidos.
