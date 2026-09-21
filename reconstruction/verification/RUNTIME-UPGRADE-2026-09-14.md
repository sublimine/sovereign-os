# Instalación verificada del núcleo, 14 septiembre 2026

La versión `efbdb0e9c6231699c5c69f2c2e2c3c6facff196badf6c9b2f0e83cbd716a2bc0`
quedó instalada y observada activa a 03:44:56.608 UTC; auditoría posterior a
03:48:11.710. PID 2441591, gestor permanente del usuario y cgroup correctos,
único proceso con la base abierta, servicio enabled y NRestarts=0 en esa consulta.
No se afirma continuidad anterior/posterior ni persistencia de tres días.

La cola estaba libre antes de parar: una sola misión histórica COMPLETED,
155 versiones de registros, journal 410. Se detuvo el escritor 989536 y se
comprobó su ausencia y la ausencia de handles sobre la base antes del cambio.
La parada añadió únicamente la liberación de ownership. Se guardó una copia
SQLite coherente, privada, con protocolo 1 y las 156 versiones de ese instante,
en el directorio local de backups de la fábrica; su ubicación y hash están en
la auditoría, no se publicó ni se restauró sobre datos posteriores.

Se conservaron las versiones antiguas del ejecutor. Wrapper y unidad se cambiaron
al mismo paquete nuevo, se verificó la unidad, se recargó el gestor y se arrancó.
La primera adquisición de ownership promovió el protocolo a 2. El estado final
tiene 157 versiones y journal 412; las únicas dos versiones añadidas desde el
preflight son queue-owner/exclusive 26 y 27. Se conservaron las 155 originales,
las 58 cabeceras materiales, la misión, su resultado y la cola. **Cero misiones,
inferencias o efectos de misión nuevos durante la instalación.**

Los comandos instalados help, queue y report terminaron correctamente. El
informe conserva once inferencias históricas de septiembre 9: no son llamadas
de esta actualización ni un ejemplo actual de eficiencia.

## Pruebas previas y razón de la barrera

La lectura cruzada de cuatro estados con tres versiones pasó doce controles,
pero una prueba SIM posterior demostró que el ejecutor antiguo intentaba superar
un presupuesto nuevo agotado. El proveedor inyectado bloqueó el intento antes
de cualquier llamada real. Por eso no basta con que un informe antiguo abra.

Se añadió promoción transaccional de user_version a 2 al escribir registros o
eventos; abrir y sólo leer conserva 1. El rojo original de cinco pruebas y todos
los fallos previos se conservan. Integración: 49 PASS, incluidos cinco SIGKILL.
La implementación antigua auténtica rechazó después la apertura del protocolo 2.

Regresión completa `suite-SncT0v`, sesión 22853, cerrada 03:30:17.684:
1566 tests, **1565 PASS, cero FAIL, un SKIP**, 356258.294284 ms. Auditoría
03:33:15.966: 314 entradas, comandos, cuatro streams y owner ausente verificados.
Paquete: 426 archivos/24.180.631 bytes, identidad igual a la copia cualificada.

`execution-protocol-upgrade-IeOxWG`, sesión 29339, probó dos copias y seis
procesos: reentrada actual, rechazo del ejecutor antiguo y nueva reentrada.
La entrega histórica siguió COMPLETED; la semilla SIM de presupuesto siguió
NEEDS_DIRECTION por agotamiento. Sin inferencias, sin efectos, originales
intactos. Auditoría 03:35:48.353: siete owners ausentes, 314+2 pins concordantes.

[Auditoría de instalación](runtime-deployment-efbdb0e9.json),
[auditoría de las copias](runs/execution-protocol-upgrade-IeOxWG/post-close-audit.json),
[regresión](runs/suite-SncT0v/post-close-audit.json).

## Límites que no desaparecen al instalar

No se debe volver a 10bb cambiando sólo el binario, ni rebajar manualmente la
cabecera de la base. La barrera tampoco agrega comprobaciones a procesos antiguos
que ya la tuvieran abierta: deben drenarse antes de actualizar. No hay rollback
automático que descarte trabajo posterior.

Las opciones experimentales siguen siendo explícitas; no se cambió adaptive-v1,
el modelo, el razonamiento ni políticas existentes para obtener un PASS. La
instalación incorpora las implementaciones cualificadas, no convierte sus casos
acotados en garantías de precisión, eficiencia, aprendizaje o autonomía generales.
R01–R16 siguen abiertos donde lo indica STATUS; ésta no es la entrega total de
la fábrica ni una certificación de perfección.
