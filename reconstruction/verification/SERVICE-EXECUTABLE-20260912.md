# Incidencia de identidad del ejecutable — 12 septiembre 2026

## Observación, no reparación

Se registró **una** muestra a las 08:16:09.340 UTC: `healthy:false`, `ENOENT`,
ID `soak-sample:d91d31b4-811b-4356-971b-99596fb60a4e`. Journal del observador:
33 eventos, head `616bca12c4acf71a27c436842c71804d7e3db90e8052e294c774c8a57b9f26f1`.
Estado SNAPSHOT_FAILED, 16 muestras (15 saludables, una fallida). La anterior
era del 10 septiembre a las 05:56:25.368 UTC. No se rellenan esas más de 50 horas
sin observaciones ni se afirma trabajo útil continuo durante ellas.

El diagnóstico posterior sólo leyó proceso, gestor, paquete y base de cola:

- 08:20:36.987 UTC: servicio enabled/active/running, PID 989536, start ticks
  20197659, NRestarts 0, cgroup canónico confirmado.
- `/proc/989536/exe` apunta a
  `/home/cardeex/.cache/codex-runtimes/codex-primary-runtime.previous/dependencies/node/bin/node (deleted)`.
  Resolver ese enlace con `realpathSync` produce ENOENT. La comprobación falla
  antes de completar la captura; no demuestra una caída del servicio.
- La lectura del ejecutable abierto mediante `/proc/989536/exe` y del Node
  actualmente en la ruta configurada produce **el mismo SHA-256**:
  `bc17c508ffeed0ec622934f9b7fa72f8e78da65350e63c3eceb56fa688aa5e12`.
  Hay cambio de ubicación/entrada de filesystem, no una diferencia de bytes
  observada. No se atribuye una causa externa concreta sin su registro.
- Paquete `10bbffa0e97b63c0246ab338857987943a89d285cff137b65e0a91a0d041a7c4`
  íntegro: 385 archivos, 23.689.915 bytes.
- Base ordinaria consultada con SQLite readOnly/BEGIN: journal 410, head
  `2f54d5b7cc105de79871c8de1aa03d036ae574e9258bebc7094ba2e853c46f1a`, owner
  `queue-owner:3e22a16e-96c3-4526-9106-1da10e59e56f`, epoch 13.
- Única misión ordinaria `mission:78afdee6-1b1c-4b97-a68e-bdbce1d0bb86`:
  COMPLETED, dos intentos, v7/hash
  `986ed23c09d184a1adc97b9ccbf6f672012bf2ab135c5253f681fa3818f2d7ab`.

No se cambió unidad/wrapper/paquete, no se reinició el servicio ni el VPS, no
se envió misión ni inferencia. El fallo original permanece; la comprobación de
hash posterior no se transforma en una muestra saludable retroactiva. La ruta
mutable del runtime debe contemplarse en el diseño de instalación persistente.

## Segunda observación — continuación de las 09:02 UTC

Único checkpoint de esta continuación: 09:07:32.659 UTC,
`soak-sample:b5dbb32f-fc3e-4597-b9de-8b3158ae056d`, `healthy:false`, ENOENT.
Journal del observador: 35 eventos, head
`45bb12b6e991a3e16da4dcf1225489fbd2399789bba668883929a26a9c9c76bf`.
17 muestras: 15 saludables y dos fallidas. SNAPSHOT_FAILED, segmento actual cero;
segmento muestreado más largo 5.132.930 ms. No hay observaciones que rellenen el
hueco de más de 50 horas ni prueba de días de trabajo útil.

A las 09:24:33.869 UTC, la lectura transaccional de la base ordinaria volvió a
verificar journal 410 / `2f54d5b7`, mismo propietario/epoch 13 y única misión
COMPLETED v7 / `986ed23c`, sin inferencias nuevas ni operaciones de mantenimiento.
El proceso canónico sigue siendo 989536, sin reinicios. No se convierte el fallo
de ruta en PASS ni se altera la release instalada 10bbffa0.

## Tercera observación — continuación de las 10:20 UTC

Único checkpoint de esta continuación: 10:20:39.318 UTC,
`soak-sample:a79f6dd2-61d5-4741-871b-44021330832c`, `healthy:false`, ENOENT.
Journal del observador: 37 eventos, head
`e63e888e4b4f4888b70509dc5f90edeb13a23c9f8aadc6710e299e5828aebd3e`.
18 muestras: 15 saludables y tres fallidas, SNAPSHOT_FAILED. Se conservan los
huecos y el segmento actual cero; no acreditan actividad útil continua.

La comprobación canónica mantiene PID 989536, active/running y NRestarts 0.
A las 10:37:44.380 UTC se leyeron de nuevo el ejecutable abierto y el configurado:
ambos conservan el SHA-256 `bc17c508ffeed0ec622934f9b7fa72f8e78da65350e63c3eceb56fa688aa5e12`.
La consulta transaccional readOnly volvió a verificar journal ordinario 410 /
`2f54d5b7`, mismo owner/epoch 13 y única misión COMPLETED v7 / `986ed23c`.
No se modificó esa base, servicio, runtime instalado ni historial del observador
fuera del único checkpoint. Esta lectura posterior no es otra muestra ni un PASS.

## Cuarta observación — continuación de las 11:24 UTC

Único checkpoint: 11:30:01.406 UTC,
`soak-sample:9c85fcff-5ec1-4376-9a69-77b8eb9622e2`, healthy:false / ENOENT.
Journal observador 39, head
`a26e1c73a71594b0c61790c939fbd45a564d0fcf65e5f5c9b1da19105b975fd3`.
19 muestras, 15 saludables/cuatro fallidas, SNAPSHOT_FAILED. Huecos conservados.

A las 11:45:31.218 UTC, diagnóstico readOnly: servicio active/running, mismo PID
989536 y NRestarts 0; ruta del ejecutable anterior eliminada. Bytes abiertos y
configurados conservan SHA-256
`bc17c508ffeed0ec622934f9b7fa72f8e78da65350e63c3eceb56fa688aa5e12`.
Base ordinaria dev2049/ino2138013, journal 410 / `2f54d5b7`, owner epoch13 y
única misión COMPLETED v7 / `986ed23c`, sin trabajo nuevo. No se reinició ni
modificó el servicio, su base o la release. El diagnóstico no transforma ENOENT
en PASS ni rellena el hueco histórico de más de 50 horas.

## Corrección del observador — 12:21 UTC, sin nuevo checkpoint

El observador ahora abre `/proc/PID/exe` directamente y calcula el hash del
archivo abierto por el kernel, incluso si su nombre terminó en `(deleted)`.
Conserva dispositivo, inode, tamaño y tiempos de ambas entradas, comprueba
estabilidad durante la lectura y distingue `SAME_FILE` de
`IDENTICAL_BYTES_DIFFERENT_FILE`. Bytes distintos siguen siendo fallo; igualdad
de bytes no significa igualdad de inode ni integridad de toda la memoria.
La captura completa vuelve a verificar ambas identidades al terminar.

Prueba dirigida: 13 PASS, cero fallos/skips, 2.285,79 ms. Incluye un proceso Node
de test real: se elimina únicamente su copia temporal del ejecutable, se crea
otra idéntica en ese mismo nombre, se confirma que sigue vivo sin reinicio y
que el observador detecta los inodes diferentes. Modificar la copia configurada
produce `SOAK_EXECUTABLE`. El hijo y su directorio propio se eliminan al acabar;
no se toca el runtime instalado.

Lectura directa del nuevo helper, **no muestra del soak**, a las
12:21:17.112 UTC: PID 989536, dev2049, inode abierto 2118275/configurado 3416574,
tamaño 125.989.464 bytes en ambos y hash `bc17c508` completo ya registrado arriba.
Resultado `IDENTICAL_BYTES_DIFFERENT_FILE`, deleted:true. No se invoca
`captureSample`, no se añade checkpoint ni se reclasifican los cuatro fallidos.
La siguiente observación programada utilizará un nuevo hash de probe y deberá
iniciar su propia cobertura; no recupera el hueco previo ni prueba trabajo útil.
