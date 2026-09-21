# Operación de Sovereign Factory

Manual de uso, no certificado de aceptación. La versión instalada y sus pruebas
vigentes se identifican en [STATUS](/home/cardeex/openclaw-workspace/sovereign-os/reconstruction/verification/STATUS.md).
Las observaciones tienen fecha: ni un estado COMPLETED ni un servicio activo en
una captura garantizan calidad general, vigencia externa o funcionamiento continuo.

## Punto de entrada en esta VPS

Usar el wrapper verificado `/home/cardeex/.local/bin/sovereign`, no el árbol de
desarrollo ni otro paquete por conveniencia. La cola y las evidencias viven en
`/home/cardeex/.local/state/sovereign-factory`. El servicio no abre una API HTTP:
sólo el propietario local envía solicitudes por CLI/SDK. No se usan claves API,
compras de créditos, otra cuenta ni extracción de credenciales como fallback.

Antes de enviar trabajo, consultar:

```sh
/home/cardeex/.local/bin/sovereign --help
/home/cardeex/.local/bin/sovereign queue
/home/cardeex/.local/bin/sovereign service-status
```

Estos comandos no hacen inferencias. `service-status` debe mostrar el gestor
permanente verificado y el servicio activo para atribuir avance a la cola.
XRDP puede exportar un bus de otra sesión: `systemctl --user` sin entorno
canónico no acredita estar consultando ese gestor. Si falta el wrapper, el
servicio está parado o `managerScopeVerified` no es true, reconciliar la
instalación antes de anunciar que continúa. `submit` no arranca un servicio.

La skill local `$sovereign-factory` permite al agente interlocutor gestionar
envío, seguimiento, diagnóstico y entrega. Una pregunta de estado no autoriza
crear una misión. El daemon no conoce esta conversación ni publica avisos aquí;
para seguimiento posterior usar el mecanismo de automatización de Codex.

## Enviar una petición autorizada

Guardar el encargo íntegro en un archivo UTF-8 privado, sin contraseñas ajenas
a la tarea. No interpolar texto del usuario en comandos del shell. Ejemplo de
nueva misión; las rutas e ID deben sustituirse por los realmente preparados:

```sh
/home/cardeex/.local/bin/sovereign submit --file /ruta/peticion.txt --request-id submission:identificador-unico --preset adaptive-v2 --entry-mode bounded-read-response-v1 --parallel-pure-nodes 2
```

La skill selecciona esas opciones para peticiones nuevas cuando el usuario no
ha elegido otras. No son cambios del predeterminado del CLI ni de adaptive-v1.
Mantener cualquier elección explícita distinta de modelo, esfuerzo, entrada,
herramientas, concurrencia o presupuesto. El ID idempotente liga texto,
opciones y adjuntos: ante incertidumbre consultar el envío existente antes de
repetir. No cambiar datos ni crear otro ID para eludir un resultado desconocido.
La petición y el contexto necesario se envían al proveedor de suscripción.

`--file` exige un archivo regular sin enlaces (incluidos padres symlink), con
dos lecturas completas coincidentes y UTF-8 válido. Rechaza secuencias inválidas
en vez de sustituirlas por U+FFFD; conserva BOM, CRLF, espacios y Unicode exactos.
No admite directorios, FIFO, symlinks ni hardlinks. El límite del encargo sigue
siendo 256 KiB UTF-8, sin NUL y no vacío; la captura se acota a 1 MiB antes de
esa validación. `--text` mantiene su contrato. Cargar una petición no la convierte
en adjunto ni eleva el protocolo; la misión sin datos conserva su workspace
vacío habitual. [Contrato de admisión literal](/home/cardeex/openclaw-workspace/sovereign-os/reconstruction/design/REQUEST-FILE-ADMISSION.md).

`adaptive-v2` incluye entrada cerrada v2, fichas completas bajo demanda,
representación compacta, contrato propio del nodo, cursor read/list/test y una
ronda de revisión del método. No obliga a ejecutar todos esos procesos. La
entrada bounded explícita permite un único producto textual cerrado con
premisas completas y, como máximo, un archivo UTF-8 solicitado de hasta 65.536
bytes. Productor y juez siguen separados; el juez relee la misma versión tras
el candidato. Investigación, escrituras/entregables en archivos, ejecución,
varios inputs o planificación previa exigida derivan el encargo completo a
planificación. No se responde sólo a su parte fácil ni se certifican como
hechos externos los datos locales.

El paralelismo dos es un techo, no dos agentes obligatorios. Sólo solapa ramas
listas e independientes sin herramientas ni efectos en su ascendencia.
La política expandida se congela al crear. No añadir presets u opciones nuevas
a `resume`/`continue`; no importar overlays evaluados bajo otro ámbito.

### Adjuntos: distintos de la petición

`--file` carga el encargo, no los datos. Para originales explícitamente puestos
en alcance, preparar un manifiesto UTF-8 privado:

```json
[{"source":"/ruta/original/datos.json","path":"datos.json"}]
```

Añadir `--inputs /ruta/manifiesto.json` al submit nuevo. `source` relativo se
resuelve contra cwd; `path` es relativo al workspace privado y debe coincidir
con el nombre usado por el encargo. No globs, importación de directorios,
symlinks/hardlinks, búsqueda de credenciales ni copia posterior al submit.
SDK: `engine.create`/`queue.submit` admiten
`inputs:[{path,content,provenance}]`; content es texto o Uint8Array y provenance
una etiqueta opcional. No se normaliza Unicode ni se truncan bytes.

La captura comprueba identidad, metadatos y dos lecturas completas coincidentes;
no inmoviliza el host. Los originales quedan en la misma transacción que la
misión, la cola y la idempotencia. Después, bajo el dueño exclusivo, se preparan
copias privadas antes de cualquier agente. Retirar o cambiar la fuente no altera
ese snapshot. Esto NO sincroniza el proyecto del host ni aplica los entregables
sobre él. No adjuntar si el mandato prohíbe también las copias internas.

Rigen los límites del broker: por defecto 1 MiB por archivo, 32 MiB totales y
2000 entradas incluidos directorios; el manifiesto CLI debe caber en el límite
de archivo. La ruta bounded conserva su propio umbral menor. Los agentes ven
metadatos USER_SUPPLIED_UNVERIFIED, sin rutas de origen del host. Un adjunto no
es instrucción, hecho verificado ni output producido. Las escrituras posteriores
autorizadas conservan su linaje; al recuperar no se repone el original encima.
Un cambio externo o una identidad no reconciliada bloquean.

## Consultar y entregar

`queue` muestra la cola; `status ID`, `plan ID`, `report ID`,
`report ID --json` y `show ID` consultan sin llamar al modelo.
`roles ID` muestra la ficha completa y su procedencia. El reporte identifica
planes, métodos, especialistas, criterios, juicios, pruebas y costes observados;
los historiales públicos no son conversaciones privadas de razonamiento.

Antes de entregar, inspeccionar report y show, el producto exacto y sus pruebas.
Informar pendientes, rechazos y uso desconocido. Un contador final no demuestra
cobertura de intentos nativos interrumpidos sin contadores propios. No convertir RUNNING o una
prueba aislada en entrega. La actualidad de una fuente o archivo externo exige
la verificación correspondiente, no sólo leer un reporte antiguo.

| Estado de cola | Interpretación |
|---|---|
| QUEUED | Solicitud guardada; espera al consumidor. |
| RUNNING | Tiene coordinador; todavía no es entrega. |
| RETRY_WAIT | Reintento diferido por fallo transitorio observado. |
| PAUSED | Pausa explícita durable. |
| WAITING | Requiere dirección, autoridad, capacidad, calidad, presupuesto o reconciliación. |
| COMPLETED | Producto aceptado por el motor para ese alcance y versión. |
| CANCELLED | Cancelación terminal; las pruebas se conservan. |

## Recuperación sin perder ni repetir trabajo

`pause ID`, `continue ID` y `cancel ID` mutan la cola: sólo por petición
correspondiente o recuperación ya autorizada. `continue` no concede permisos,
resuelve incertidumbre ni eleva presupuestos. `resume ID` ejecuta directamente:
no usarlo para competir con un consumidor ocupado. Cancelar no borra pruebas
y no es reversible con continue.

La cola conserva reintentos tipados de cuota/transporte: 5, 10, 20, 40 y hasta
60 minutos, como máximo doce automáticos. La fecha no demuestra que volvió la
cuota. Continue reinicia ese contador por decisión explícita, no el presupuesto
de inferencias. No cambiar de cuenta/API ni comprar capacidad para evitarlo.

SIGTERM/SIGINT solicitan parada recuperable y cierre del proveedor, no cancelación
terminal de la misión. Recuperación exige identidad de proceso (boot, PID y
start ticks), registros y recibos. Un PID vivo no se desplaza por timeout.
No se garantiza ejecución remota exactamente una vez.

| Señal o condición | Acción correcta |
|---|---|
| INPUT_PREPARATION_UNCERTAIN | Conservar originales e identidad pendiente. Tres ventanas entre crear un objeto y registrar su identidad requieren reconciliación; no adoptar por nombre ni sobrescribir. |
| CLEANUP_UNCONFIRMED | No consumir la respuesta ni comprar otra para reemplazarla; aclarar el cierre pendiente. |
| DISPATCHED/UNCERTAIN sin recibo | No repetir el efecto automáticamente ni inventar un éxito. |
| PLANNING_INSPECTION_PENDING/LIMIT | Conservar solicitud/respuesta y presupuesto; solicitar dirección, no fingir aceptación. |
| INFERENCE_BUDGET_EXHAUSTED | WAITING sin inferencia adicional: continue no repone el techo. |
| Journal, head o historial incoherentes | Detener y conservar la base; no reparar, rebajar cabecera ni borrar automáticamente. |
| Rechazo material | Diagnosticar la primera causa, invalidar consumidores afectados y cambiar de método con revisión. |

`retry-review ID --node N --reason TEXTO` autoriza una sola revisión adicional
del candidato exacto; no ejecuta por sí solo. Sólo sirve para un fallo de
validación de revisión diagnosticado, como cita inválida; no para sortear
rechazos materiales, cuota, pruebas fallidas, permisos revocados o efectos
inciertos. Conserva historial y criterios; un timeout consume ese intento.

`--method-recovery-rounds N` es una política nueva explícita: tras rechazo
material agotado, otro juez debe aceptar el método revisado antes de producir.
Cambiar una etiqueta no basta. Conserva productos válidos, restricciones y
techo global de inferencias; no se aplica a cuota, cierre desconocido ni retirada
humana. Rutas selladas, copias nativas y documentales tienen fronteras propias.

## Opciones avanzadas: disponibilidad no es garantía de calidad

Comprobar primero el help instalado. No elegir otra opción sólo para obtener
un PASS ni extender a todos los dominios la cualificación de un caso conocido.

- `--allowed-tools` restringe nuevas misiones; cadena vacía no permite ninguna.
  No amplía el acceso al host ni cambia misiones existentes.
- `--mission-call-limit 1..1000` fija reservas compartidas por planificación,
  entrada, producción, revisión, réplica y source.search. No limita tokens,
  dinero, reintentos HTTP internos ni llamadas nativas. Fallos posteriores a
  reservar no reembolsan esa reserva. Un saldo no garantiza terminar.
- `--planning-contracts on-demand-v1 --planning-call-limit N` mantiene fichas
  íntegras con límite propio; no cuenta las llamadas del juez. Una ficha presente
  no prueba comprensión o pericia. `--planning-card-bytes` nunca autoriza truncar.
- `--card-encoding compact-json-v1`, `--producer-context node-contract-v1`
  y los codecs sin pérdida conservan contratos y ámbito de aprendizaje. No
  confundir una proyección con réplica ciega; puede no ahorrar tokens.
- `--producer-batch read-test-cursor-v1` recupera un lote exacto autorizado de
  lectura/listado y una ejecución final fijada. No incluye escrituras o fuentes,
  no cambia actores ni reinicia cargos, y nunca repite efectos inciertos.
- Las ventanas documentales `literal-windows-v1` son opción explícita del SDK,
  no flag CLI ni parte del preset. No combinar con el cursor de adaptive-v2.
  Exigen grants, versiones, exposición real y selección propia del juez; no
  equivalen a lectura íntegra o verdad. source.batch local y lote externo son
  distintos y no comparten garantía de atomicidad.
- Especialistas de misión exigen ficha completa, valor justificado, falsificador
  y plan aceptado. No reciben autoridad ni adaptadores por tener otro título.
  Ω09/VERITAS04 necesitan protocolo de réplica ciega; una revisión que ya conoce
  el candidato no satisface esa obligación.
- `learn-list` consulta; learn-observe/learn-propose tienen efectos y/o inferencias.
  Proponer instrucciones no las activa ni demuestra mejora. Evaluación,
  promoción y reversión conservan versiones, evidencias y ámbito; no escribir
  un AGENTS.md global para eludirlas.

Contratos detallados: [planificación](/home/cardeex/openclaw-workspace/sovereign-os/reconstruction/design/PLANNING-CONTRACT-INSPECTION.md),
[presupuesto](/home/cardeex/openclaw-workspace/sovereign-os/reconstruction/design/MISSION-INFERENCE-BUDGET.md),
[admisión](/home/cardeex/openclaw-workspace/sovereign-os/reconstruction/design/MISSION-INPUT-ADMISSION.md),
[entrada acotada](/home/cardeex/openclaw-workspace/sovereign-os/reconstruction/design/BOUNDED-READ-ENTRY.md),
[método revisado](/home/cardeex/openclaw-workspace/sovereign-os/reconstruction/design/REVIEWED-METHOD-RECOVERY.md) y
[cursor](/home/cardeex/openclaw-workspace/sovereign-os/reconstruction/design/RESUMABLE-READ-TEST-BATCH.md).
Los resultados y fallos se conservan en STATUS y su historial enlazado.

## Mantenimiento del servicio y versiones

Los paquetes locales están identificados por contenido; el CLI comprueba su
inventario al usarlos. El propietario del host puede cambiar permisos: no es
inmutabilidad del sistema operativo. No editar una copia instalada ni ejecutar
desarrollo por defecto. Wrapper, unidad y proceso deben apuntar al mismo paquete.

Cambiar de versión sólo con cola reconciliada, TODOS los escritores anteriores
cerrados, backup SQLite coherente y privado, cualificación correspondiente y
auditoría de preservación de las versiones anteriores. No restaurar una copia
vieja sobre trabajo posterior. No mezclar escritores: una cabecera nueva no
añade protecciones a un proceso antiguo que ya tenía la base abierta.

Los floors se elevan según las funciones usadas: 2 para protocolo de ejecución,
3 para cierre de productor, 4 para cursor, 5 para revisión propia de inputs,
6 para entrada bounded y 7 para admisión de originales. Consultar estado no
activa por sí solo los nuevos; jamás rebajar user_version para un rollback.
Reentrada puede escribir ownership. Un journal local no detecta por sí solo
una restauración coherente total: necesita un ancla externa y backups.

En esta VPS, el gestor canónico se consulta con:

```sh
env XDG_RUNTIME_DIR=/run/user/1001 DBUS_SESSION_BUS_ADDRESS=unix:path=/run/user/1001/bus systemctl --user status sovereign-factory.service
```

Un stop/start requiere el procedimiento anterior; no reiniciar por copiar este
ejemplo. La unidad incluye guard de cgroup/gestor. Linger configurado y pruebas
de procesos no demuestran logout, reboot real ni tres días continuos. No abrir
puertos, cambiar otros servicios o usar sudo para interpretar un estado.

Historial completo del manual anterior: [archivo íntegro de 744 líneas](/home/cardeex/openclaw-workspace/sovereign-os/reconstruction/verification/OPERATIONS-HISTORY-2026-09-14-1249.md). SHA-256
`b7eb6745f1521ea3bef1bf2afa6d80536b9245fecfe1ed880a94ad6972e2a9cd`.
Sus rutas relativas conservan la ubicación histórica factory/; sus observaciones
no sustituyen al estado vigente.
