# Observación prolongada del servicio

10 septiembre 2026. R14, comprobación acotada; **no cierre del mandato**.

## Diseño y por qué

El mecanismo existente de continuación de esta misma tarea ejecuta un checkpoint
por activación, sin añadir otro scheduler, cron, servicio ni tarea. Se reutilizan
el gestor canónico systemd, el verificador de paquetes y Store/SQLite con eventos
inmutables. No se instala un stack externo de monitorización: para esta prueba
local ya existen las fuentes de identidad/integridad necesarias. La petición
del propietario autoriza la reconstrucción y su seguimiento; no un reinicio OS.

El comprobador `service-soak.mjs` no inicia modelos, modifica la cola o repara el
servicio. Abre la base de producción en modo readOnly/query_only y una transacción
de lectura; comprueba su estructura y journal, propietario de cola y referencias
a misiones. Sólo guarda IDs, estados, hashes y contadores, no peticiones, productos
privados ni claves. Escribe exclusivamente su propio historial en
`service-soak/state.sqlite` dentro de este directorio. Un fallo de captura se
conserva como fallo, sin texto de diagnósticos que pueda filtrar credenciales.

Cada muestra vincula boot ID, reloj del kernel, PID y start ticks (para detectar
reutilización del PID), cgroup canónico, reinicios automáticos, ejecutable, paquete
completo de 374 archivos, wrapper/unidad, identidad del fichero SQLite y ancestro
del journal. Se vuelve a comprobar proceso/configuración al acabar para detectar
cambios durante la lectura. No es una instantánea atómica de todos los recursos
del kernel ni protege frente a un administrador que altere el propio observador.

## Criterio congelado y límites

Cadencia programada existente: 30 minutos. Ventana objetivo de muestras: 72 horas,
con separación máxima de 45 minutos. El margen de 15 minutos tolera retrasos;
superarlo registra `OBSERVATION_GAP` y empieza otro segmento. Cambios de proceso,
boot, versión, configuración, observador, propietario o identidad de base también
separan segmentos. Un retroceso o bifurcación del journal queda explícito. Reloj
de pared no sustituye tiempo de kernel; un desfase de más de dos minutos queda
registrado. Fallos y segmentos anteriores no se borran ni se fusionan.

`SAMPLED_WINDOW_MET` sólo significa que un segmento de muestras satisface ese
criterio. **No significa 72 horas de desarrollo, disponibilidad continua,
responsividad, supervivencia al cierre de sesión o recuperación de un reinicio**.
El informe siempre mantiene `continuousUptimeProven=false` y
`missionWorkProven=false`. La cola vacía o una misión completada ayer no suman
trabajo nuevo. No se extrapola tiempo anterior a la primera muestra.

La continuación depende de la aplicación y del host disponibles; no se promete
que sus disparos ocurran durante un turno ya activo. El script no consume
inferencias, pero la activación de la tarea agéntica sí puede consumir uso.
La documentación oficial diferencia tareas en el chat y trabajos independientes,
y exige disponibilidad de host/app para acceso local.
[Tareas programadas oficiales](https://learn.chatgpt.com/docs/automations?surface=app).

## Resultado inicial y reproducción

- Primera muestra: **2026-09-10T00:30:59.798Z**, saludable, estado `OBSERVING`,
  duración acreditada del segmento **0 ms**, no ventana prolongada aprobada.
- PID 836174, startTicks 18234141, boot
  `2a077981-8aea-444e-8eff-44fa69814267`, release `4793e99c…` íntegra.
- Journal de producción: 402 eventos,
  `f79cae728fe756666d9aa99e28ddca11140131b1d5996bda1d420aaa9884604a`.
  Únicamente la misión habitual 78af… COMPLETED; sin nueva misión.
- Once pruebas dirigidas: PASS. Cubren ventana sintética de 72 horas, huecos,
  relojes, reinicios/identidades, cambio de código, fallos, idempotencia y lectura
  real de SQLite sin alterar registros ni exponer su petición/clave sintéticas.
  Tiempo sintético del test **no cuenta como prueba prolongada real**.
- Regresión `suite-wWzy8x`: 460 pruebas, 459 PASS, cero fallos, un SKIP live.
  Incluye también cinco pruebas del prototipo offline de estructuras. Código de
  producción sin cambios; no se requiere otro despliegue.
- Se actualizó **la continuación existente** `continuar-sovereign-factory`,
  conservando identidad, misma tarea, frecuencia, silencio ante estado sin cambios
  y demás límites. No se creó otra automatización ni se reinició el servicio.

Desde el repositorio, con el Node 24.19.0 ya fijado:

```sh
/home/cardeex/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node reconstruction/verification/service-soak.mjs checkpoint
/home/cardeex/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node reconstruction/verification/service-soak.mjs report
```

`report` es sólo lectura. `checkpoint ID` conserva idempotencia de la misma
muestra; otro contenido con el mismo ID se rechaza. No usar el ID de la muestra
inicial para tomar muestras nuevas. Observadores concurrentes no añaden una
muestra con un ancestro obsoleto: fallan explícitamente y requieren nueva captura.
