# Recuperación del candidato tras timeout — evidencia separada

13 septiembre 2026. El original geTKWd permanece FAILED y no se reabre. Este
documento no lo convierte en una ejecución inicial correcta ni cierra R01–R16.
Prerregistro inmutable: DEVELOPMENT-TIMEOUT-RECOVERY.md.

## Versión y regresión

WDaIpM, cierre19:42:14.150, sesión98341exit0:1319tests,1318PASS,0FAIL,1SKIP;
479188.551923ms.287entradas y cuatro capturas reconciliadas19:43:50.255.
Summary SHA2565405bd333aa8cabcb6159b805aa70a7350d9af0a04dc743ea694a0f4e439d739.
Runtime8b451fa36e3a9af74c85482610ddecf0dda599fa9675081060f62632e3fb6e4a,
419archivos24086702B, congelado/cualificado19:47:58.153; NO instalado.
Cambio de motor: TIMEOUT se informa WAITING_PROVIDER, sin alterar el presupuesto
ni añadir reintentos. La cola ya manejaba TIMEOUT con límite. No cura el proveedor.

## Simulación del mecanismo VUIE8X

Directorio runs/development-timeout-sim-VUIE8X.19:48:19.426–19:48:26.925,
sesión91564exit0. Owner2243329/boot2a077981-8aea-444e-8eff-44fa69814267/
startTicks51284921 cerrado.15checks estructuralesPASS; `passed:false` porque
el NUEVO juicio es una fixture SIMULADA. Historial heredado:11inferencias reales
completas384445tokens, una llamada TIMEOUT de consumo desconocido. No sumar una
fixture como llamada real ni atribuir la aceptación simulada al modelo.

Reconciliación inicial19:49:21.388: pins/capturas/owner ausente, copias y origen
intactos. Result SHA256614033936af5f4c1621674ca1ca2bf40542a5509ec17ab7a79a53d42e789015b.
DB copia2515d034865c1673a119a5245bae84e5592b6f9191b04bb8ce56ad9c8dc06371;
journal803/head41102b4a9a0939e904606313b2583fe98f0291fcd0fc7f7e1eb15428e20d60da.
Nuevo reviewer6a79a297-76fc-44ca-910c-014f6f0b7634. Sólo cinco efectos nuevos:
tres lecturas, listado raíz y una ejecución. Cero nuevo productor o escritura.
Oracle nativo3193PASS sobre e3352061c2c24a9f2a0416951a5b120feb28e19dd7799ac1ce68ffa479847239;
reentrada sin inferencias/efectos nuevos salvo scoped-read-leases permitidos.
El oracle es evidencia funcional real y finita, no prueba de juicio semántico real.

### Auditor adicional de sólo lectura

experiments/audit-timeout-recovery.mjs, SHA256
816fb1650f98acab3b80e0ea4a572708e7e086d84cb5ebbbaa32e121df28d069.
Primera ejecución83784exit1 conservada: el auditor exigía incorrectamente una
sola fila de lineage; existen DOS, candidato y plan aceptado. Se corrigió el
auditor para exigir todos los artefactos originales y el candidato concreto,
no para omitir el plan. No cambió motor, fixture, resultado, DB ni ensayo activo.
Segunda ejecución66254exit0, reconciliación19:56:23.633.

Comprobó264versiones de registros y695eventos originales íntegros; mismos heads
de actores y efectos antiguos, incluida la revisión vencida pendiente; una
relocalización explícita de workspace, todos los bytes iguales, tres lecturas
nuevas propias y ejecución aislada de la misma versión. Contrasta petición
retenida completa, prefijo compilado,17criterios semánticos y dos runtime,
17juicios fixture,204usos de12citas distintas literales; esta literalidad de una
fixture NO demuestra la pertinencia de un juicio de modelo. Inspección firmada
de ejecución, nonce/PID/unit/STARTED/bootstrap/scratch eliminado y oracle3193.
Ambas SQLite abiertas readOnly/query_only/BEGIN sin constructor Store ni motor;
hashes antes/después idénticos. No instalación ni cambios de permisos/servicio.

## Ensayo real yIc6GW — CERRADO FALLIDO

Cierre20:03:09.762/sesión33231exit2. Una nueva inferencia REAL completa,
83732tokens (74788input/8944output; cachedInput70400, razonamiento1261),
duración808342ms de llamada capturada. No timeout nuevo. Dictamen RETURN:
16criteriosPASS y unoUNKNOWN, req.operaciones-acotadas.alcance-operativo.
Falta exposición del argv/cwd y recibo del antiguo revisor que sí ejecutó tests
antes de vencer su inferencia. El juez distingue esa brecha de custodia de un
defecto funcional o una operación prohibida: no encontró un defecto de código.

El motor conservó el RETURN y quiso pasar a reparación; el guard de este ensayo
rechazó crear otro productor ANTES de producirlo. MissionFAILED con pending
RECOVERY_EXPERIMENT_BOUNDARY, artefactoRETURNED. `noFailure:true` del resumen
sólo significa que engine.run devolvió su estado sin lanzar excepción al harness;
NO significa misión correcta. No oracle/reentrada/entrega en este ensayo real.
Los mismos tres archivos y payload se conservaron. Cinco efectos nuevos propios,
cero escritura/producción/segunda inferencia. Nuevo execution-job con STARTED,
nonce2671b9f1-bdcf-432c-8855-a7786512cda1/PID3/snapshot original, salida0 y
scratch eliminado. Cleanup de proveedor confirmado y owner2244003 ausente.

Leída respuesta COMPLETA (incluidos41pasajes distintos y hallazgo) al cierre.
Reconciliación20:05:44.732 de sólo lectura:287pins/harness/spec/runtime exactos,
264registros/695eventos originales conservados, heads anteriores iguales,
109usos de41citas literales contrastadas con la petición realmente completada,
prefijo completo y recibo vinculados a exposición durable. Nuevo juez
run:d7d0e17b-8721-4610-944c-91a22b9cd1ab, revisión
review:80c8e697-bb98-48b1-b865-cf19a8b8ca05, requestHash
24776ab4ede5efa7f4d1f8ea18db4a0be91e3c9b228106ac468c291240fdf67d.
Resultb3ff8efa6bf7e7d4aea4b68db80d305236f3aa6f17033bebf8c1edb2b405dd17,
response3790837b3e1ba63d8d0d908b4186004b5a14909cd1d84732cbf4fb6c0596210f.
DBcopiarf2f782902b787943667a448f8fecfff26b7d30b7fdcff63e5e77d5703da27fc7;
journal864/c611ce8262fdb0cf2ff4fc21f4805a98957ebd0ab1e3063e9cb87e17ebd1adaa.
Coste conjunto conocido468177tokens +una llamada original de uso desconocido.

Se verificó el recibo histórico que faltó al juez:
run:d9a62dd5-31a7-40fe-bbae-dfda16194c84:reexecute:0, hash
e37e0a0a889a97f9faa0506d2be0e0c2a2967ec1c85ee4464ba9a5f83a29bb4c,
argv [node,--test,merge-windows.test.mjs], cwd '.', exit0, mismo snapshote335…;
su ID aparecía sólo como metadato de inventario. Ni observación de herramienta
ni hash del recibo estaban en la exposición completada del nuevo juez. Se
confirma una omisión real de evidencia, no que el modelo ignorara un recibo dado.
Próximo cambio causal: historial de ejecuciones autenticado y versionado, incluidos
actores anteriores; no prestar su identidad como OWN_ACTION, alterar el dictamen,
repetir geTKWd/yIc6GW o afirmar que una nueva ejecución resuelve historia omitida.

### Preparación histórica

Iniciado19:49:37.405, sesión33231, owner2244003/boot anterior/startTicks51292724.
Máximo UNA llamada nueva, mismo modelo/ultra,900000ms por llamada y25min padre.
Sólo recuperación en otra copia material del candidato exacto. No segunda
llamada/reparación, otro productor, escrituras o cambios de criterio. No cambiar
287inputs ni fuentes del prerregistro mientras corre. Al cierre: reconciliar
owner/capturas/SQLite/snapshot/recibos, leer el juicio completo y auditar sus
citas y alcance antes de calificar esta recuperación. Hasta entonces NO PASS.
