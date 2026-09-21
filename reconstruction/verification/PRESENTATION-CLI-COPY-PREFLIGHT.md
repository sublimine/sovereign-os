# Compatibilidad de presentación en copia, no despliegue

14 septiembre2026. Reutilizar el procedimiento cerrado de mission-input-upgrade-copy
en archivos nuevos, sin modificar sus originales ni evidencias históricas.
Versión instalada244d749e, candidata84e7f687 y globalLkgzmK exactos; el candidato
debe tener regresión completa aprobada antes de ejecutar la copia.

Crear un backup coherente privado del estado instalado desde una conexión de
sólo lectura. Exigir que siga siendo la única misión histórica completada,
sin efectos ni archivos en su workspace. No ejecutar la base original.
Conservar cada versión original, hashes, cola, estado, política y aceptación.
Relocalizar exclusivamente el workspace vacío de la copia con registro explícito.

Abrir/consultar con244d, reentrar el resultado completado con84e7 y volver a
consultar/reentrar con244d en tres procesos acotados. Cero nuevos proveedores
ordinarios o nativos y cero llamadas al broker; sólo cambios de ownership y
validación en la copia. Esta comprobación mantiene protocolo2: NO representa
rollback una vez usada una selección de protocolo8/9. El rechazo de ejecutores
antiguos a esos protocolos sigue siendo obligatorio.

Después del cierre, auditar identidad de todos los procesos, bytes de capturas,
paquetes, regresión, registros y estado original actual. Si cambia el original
durante el ensayo, conservar el fallo, no atribuirle una equivalencia inventada.
El auditor vuelve a leer sin reejecutar la misión.

No autorización de instalación, parada de servicio, nueva misión ordinaria,
inferencia LIVE, corrección del par de coste inconcluso o cierre deR01–R16.
El resultado sólo cubre este historial completado conocido, no todos los estados
activos posibles. Las pruebas SIM de crashes y compatibilidad de floor9 tienen
su evidencia propia y no se presentan como caídas de la VPS.
