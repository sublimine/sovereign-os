# Conservación de entradas de regresión

14 septiembre 2026. Brecha observada: run-suite guardaba el mapa de hashes,
comando y streams, pero no los bytes de sus tests/oráculos. Un cambio posterior
podía dejar una prueba histórica sin sus archivos exactos. Los paquetes del
runtime conservan sus propias dependencias, no todos los tests del repositorio.

Antes de modificar el capturador se archivaron los362inputs todavía coincidentes
de suite-t5pMx9:3.509.474bytes, sin reejecutarla. El registro ZLVMZY dice expresamente
post-close-matching: no se fabrica una captura prospectiva de una ejecución pasada.
No se atribuye esta conservación a otros cortes antiguos cuyos archivos cambiaron.

Nuevo capturador: archivo privado por contenido antes de lanzar el proceso de
tests, manifiesto escrito al final con fsync y vinculado a started.json/summary.
Preserva BOM, CRLF, Unicode, archivos vacíos, nombres y duplicados sin normalizar
contenido. Rechaza rutas que salen del ámbito y symlinks de archivo/padres; no
recorre otros datos del usuario ni sobrescribe un archivo cerrado. Una captura
parcial sin manifiesto validable no puede acreditar integridad.

Al cerrar, comprueba por separado el archivo y las entradas actuales. Un proceso
que devuelve0 y tests aprobados no cualifica si esas comprobaciones fallan.
El consumidor de regresión verifica además el vínculo del archivo prospectivo;
sus comprobaciones frozen incluyen manifiesto/blobs, resumen y streams. Los
resúmenes históricos sin los campos nuevos conservan su clasificación histórica,
sin atribuirles el archivo nuevo. Campos nuevos parciales no se admiten como legacy.

Esto es un archivo de las entradas declaradas, no una imagen del VPS ni un
sandbox de ejecución. No demuestra que un editor externo no cambiase/restaurase
bytes durante una prueba, ni conserva todas las dependencias del sistema operativo.
El árbol no debe modificarse durante una regresión. La verificación de pruebas,
paquete, resultado semántico e instalación siguen siendo obligaciones distintas.

Veintidós pruebas iniciales de archivo pasan. Negativo de integración: el guard
anterior aceptaba metadatos nuevos inconsistentes (5tests/3PASS/2FAIL). Tras
integrar el guard,30pruebas dirigidas pasan, incluyendo interrupción real del
capturador. Un control posterior encontró el downgrade mediante borrado de TODOS
los campos nuevos. Se conserva ese fallo: el módulo archivador ya presente en el
mapa de entradas ahora exige el nuevo contrato.31dirigidos finales PASS.

Se interrumpió deliberadamente suite-FcSjCi antes de corregirlo; queda auditada
como INTERRUPTED_NOT_QUALIFIED, sin conteo final inventado. El corte sustituto
suite-FnBRLP cerró21:25:04.691 y se auditó21:26:09.217:2104tests/2103PASS/
0FAIL/1SKIP;364inputs y3.527.161bytes conservados prospectivamente, owners cerrados,
cuatrostreams coincidentes. Smoke LIVE desactivado explícitamente.

Seis controles del consumidor sobre copias privadas en
regression-consumer-negatives-3rKGrW rechazaron cambios de blob, manifiesto,
integridad final, borrado de campos, vínculo de inicio y TAP: tanto frozen como
una nueva cualificación los rechazan. El original se volvió a comprobar intacto.
Son alteraciones sintéticas de metadatos, no nuevas ejecuciones de toda la suite.
