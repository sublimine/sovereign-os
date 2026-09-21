# Barrera de protocolo de escritura y reversión

14 septiembre 2026. Cambio posterior a 5bac/v3wP0Y, instalado con efbdb0e9
tras pruebas de copia y reconciliación: [resultado](../verification/RUNTIME-UPGRADE-2026-09-14.md).

La matriz oPJuG8 leyó cuatro estados históricos con versiones original, nueva y
antigua: doce controles de lectura correctos. Eso no acredita ejecución compatible.
La sonda mXyDjF dejó una misión SIM con techo de una llamada ya consumido:
5bac hizo cero intentos; 10bb hizo un intento al proveedor inyectado, que lo bloqueó
antes de cualquier inferencia real. La versión antigua desconoce inferenceBudget.
Ambas copias conservaron las 22 versiones originales. Auditoría sólo lectura:
03:16:54.060, 16 owners ausentes, 312 inputs concordantes. Registros íntegros en
verification/runs/read-compatibility-oPJuG8 y budget-downgrade-mXyDjF.
El primer diagnóstico jlqGWO no se ejecutó: una precondición del harness confundía
WAL vacío/SHM residual con transacciones pendientes. Su fallo sigue conservado;
se corrigió admitiendo WAL vacío y rechazando WAL material, sin borrar archivos.

## Decisión

SQLite user_version deja de describir sólo la forma de las tablas: también marca
el protocolo mínimo de escritura. La nueva implementación entiende 1 y 2;
conserva 1 al abrir/leer y eleva a 2 en la misma transacción que su primera
escritura de registro o evento. Toda escritura nueva usa 2, incluso cuando
parece compatible: una lista parcial de nombres de opciones dejaría fuera
respuestas durables, controles y futuros cambios semánticos.

Las versiones antiguas existentes sólo aceptan 0/1 y por ello rechazan una nueva
apertura antes de ejecutar misiones. El código nuevo no rebaja 2 al reabrir ni
admite versiones futuras. Una transacción fallida revierte cabecera y datos;
el histórico de registros/eventos no se reescribe ni se inventan revisiones.

Esto implica que reanudar un resultado terminado, al escribir ownership, puede
elevar el protocolo aunque no consuma inferencia. No es una migración reversible
mediante cambiar el wrapper. Una consulta que sólo lee no debe elevarlo. Para
volver al binario antiguo haría falta una copia previa reconciliada y preservar
todo trabajo posterior; nunca se propone restablecer datos automáticamente.

## Alcance y condiciones operativas

No protege contra un administrador que manipule la cabecera, ni contra un
proceso antiguo que ya tenía abierta la base y no conoce esta verificación.
La instalación debe detener y reconciliar todos los escritores anteriores
antes de introducir la versión nueva; no se permite mezcla de versiones.
La base instalada no se modifica durante construcción ni pruebas aisladas.
Rojo dirigido: ocho pruebas, tres PASS/cinco FAIL, 459.250792 ms; salida íntegra
conservada. Primer verde de tres archivos: 32 PASS/0 FAIL, 612.793908 ms.
Integración posterior con CLI: 49 PASS/0 FAIL, 27156.534317 ms, incluidos cinco
SIGKILL reales antes/después del commit, conexión concurrente y reapertura.
El recuento de 49 está observado en terminal; no se retuvo otro stream completo.

Sonda con implementación antigua auténtica `storage-floor-1nmG36` cerró exit 0
a 03:23:38.318. 10bb escribe versión 1; la lectura nueva la conserva; la primera
escritura nueva cambia a 2 conservando la versión original del registro. Otro
proceso 10bb rechaza abrir con STORAGE_VERSION; nueva reapertura confirma versión
2 e historial intactos. No equivale a un rollback de servicio ni a una misión
completa. La global SncT0v posterior aprobó 1565 PASS/0 FAIL/1 SKIP de 1566 tests,
356258.294284 ms; copia IeOxWG con seis procesos también aprobada y auditada.
Después se instaló efbdb0e9 preservando toda la historia material. Esa instalación
no cambia los límites de la barrera. 5bac/v3wP0Y no cubren esta reparación.
