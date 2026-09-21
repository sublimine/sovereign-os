# Admisión de originales: desarrollo y falsificadores

14 septiembre 2026, 12:02 UTC. Implementado, cualificado en el alcance siguiente e
[instalado con preservación auditada](MISSION-INPUT-INSTALLATION-2026-09-14.md). R01–R16 continúan abiertos.

## Por qué hace falta

Los ensayos ocSk6B y GoZbep preparaban datos antes de engine.run; sus lecturas y
revisiones están cualificadas en ese alcance, no la entrada normal desde CLI/cola.
--file sólo leía la petición. Copiar después de submit tenía una carrera real.
[Diseño previo](../design/MISSION-INPUT-ADMISSION.md); ningún resultado anterior
se reetiqueta como prueba de esta implementación nueva.

## Implementación

`mission-inputs.mjs`: fuentes explícitas/UTF-8/cuotas; originales por archivo en
base64 (evita multiplicar controles escapados más allá del límite por registro),
manifiesto vinculado a la misión original y floor7 en la publicación atómica.
`mission-input-workspace.mjs`: identidad de directorios y archivos, preparación
antes de inferencia, publicación sin sustitución, recuperación por pasos y
lineage de escrituras posteriores. Helpers de paths/UTF-8/límites del broker se
comparten, no se añade otro framework ni servicio. CLI --inputs y SDK options.inputs.

El workspace se difiere hasta ejecutar; la cola no publica una misión sin los
originales. Productor y juez reciben metadatos, no rutas privadas de origen ni
todo el contenido en cada prefijo. Broker sigue aportando lecturas auténticas.
El report diferencia copias del controlador y efectos del agente. Preparación
no confiere truth/acceptance ni ejecuta instrucciones del contenido.

## Pruebas cerradas (no sumar estas suites solapadas)

- 26507: 50 PASS, 0 FAIL, 1768.740779 ms. Admisión inicial, cola y broker.
- 71570: 97 PASS, 0 FAIL, 30192.740494 ms. Entrada bounded existente, admisión,
  protocolo y caídas del header. Proveedor SIM; almacenamiento/broker reales.
- 62649: 14 PASS, 0 FAIL, 12920.827498 ms. SIGKILL real: 10 recuperaciones hasta
  resultado con SIM, una transacción sin commit sin misión parcial y tres
  ventanas ambiguas conservadas sin inferencia ni sobrescritura.
- 44193: 3 PASS, 0 FAIL, 4170.035944 ms. CLI real y reanudación tras eliminar sólo
  las fuentes temporales explícitas del test; proveedor de producción SIM.
- **51155: 41 tests, 40 PASS, 1 FAIL**, 4637.930762 ms. La reescritura rápida del
  mismo tamaño a veces conserva los metadatos observados; el test esperaba un
  rechazo y no lo obtuvo. No repetir para mejorar la nota ni debilitar el test.
  Corrección: segunda lectura completa del MISMO fd por offset y comparación
  exacta de bytes, además de identidad/size/mtime/ctime y ruta actual. No se
  presenta esto como una exclusión mutua contra un escritor del host.
- 97190: 55 PASS, 0 FAIL, 14265.104942 ms. Reprueba corregida conjunta de admisión,
  CLI y todas las fronteras SIGKILL, además de linaje de identidad reforzado.

Una prueba inicial del módulo nuevo (antes de implementarlo) falló por importación
ausente, no fue un fallo de producción ni una validación funcional. Se conservan
también los errores de desarrollo; que un test pase después no borra el anterior.

## Límites y próximos cierres

La nueva regresión y cualificaciones se cerraron; wm3d8Q/3d2 no se heredan para
estos cambios. 25d34 sustituye a b7 tras reconciliar servicio ocioso, preservar
backup/configuración y verificar después del arranque. No crea nuevas misiones.
95529 cerrado: 120 PASS, cero FAIL, 9051.930435ms. Admisión, aprendizaje,
proyección y marcos documentales; incluidos guardas de llamada directa antes
de preparación e identidad reversionada. No incluye un modelo real.
Global UaXbwc/53704 cerrado 11:36:59.648, 1808 tests/1807PASS/ceroFAIL/unSKIP,
470617.878218ms. Auditoría11:37:47.991: 338 pins, cuatro streams/owners ausentes.
Release25d34a9259798af52d0c1d784e2c34755207b3a7854be7dac2f86297115b455f,
435 archivos/24.295.299 bytes. ResumenSHA5b87e3bcb4d335ae1eb3dd3db27150f510f2cae6c809427d642c3f5c16e92fca.

Ensayo CLI/cola: dos tests PASS167.39232ms; SIM Rlbnbs/73133 y LIVE c6Q9gq/43967
cerrados, auditados11:38:23.403 y11:44:15.267 respectivamente. Cada uno fija
338+9 inputs. CLI real publica originales y cola en la misma transacción; ruta
origen ausente al ejecutar. PreparaciónREADY secuencia17, después de job6 y antes
de cualquier worker. No preparación manual del workspace. SIM tres respuestas;
LIVE tres llamadas Astra/ultra,47.264 tokens(40.375entrada/6.889salida),cero uso desconocido.
Reentrada sin llamada nueva,13 usos de citas exactas, DB sin modificar por auditor.
Todas las respuestas públicas y contratos revisados; 6450mg frente a6500mg,
diferencia+50, false; juez con relectura propia de los478bytes. [Disposición](runs/mission-input-live-c6Q9gq/semantic-disposition.json).
Caso conocido, no holdout ni comparación de eficiencia con ensayos de política/contexto distintos.

dsnhri/57053: b7 y3d2 reales rechazan floor7 al abrir/escribir/ejecutar, cero
inferencias/efectos. Auditoría11:41:40.443. Qe5ekf/80651: copia coherente del historial
instalado b7→25d34→b7, tres procesos cerrados; auditoría11:53:47.139 confirma
163 versiones originales y58 heads materiales conservados, original intacto,
protocolo2, cero trabajo nuevo. [Auditoría](runs/mission-input-upgrade-copy-Qe5ekf/post-close-audit.json).
No compatibilidad de todos los estados activos ni rollback tras activar floor7.

La copia admite recuperación automática después de identidad observada, no en
las ventanas mkdir/open/write antes de registrar esa identidad. En esos casos
se conserva INPUT_PREPARATION_UNCERTAIN para el operador. No hay adopción por
nombre, borrado de desconocidos, reparación ciega ni garantía ante un administrador
hostil que modifique el host/SQLite. Ni firmas ni coincidencia de bytes implican
verdad de los datos. Los modelos de tests son explícitamente simulados.
