# Operación de Sublimine Factory

Manual de uso, no certificado de aceptación. La versión instalada y sus pruebas
vigentes se identifican en los informes locales de cada instalación; el
repositorio público no publica estados de misiones ni telemetría de operadores.
Las observaciones tienen fecha: ni un estado COMPLETED ni un servicio activo en
una captura garantizan calidad general, vigencia externa o funcionamiento continuo.

## Punto de entrada en una instalación propia

Usar el wrapper verificado configurado para tu instalación, no el árbol de
desarrollo ni otro paquete por conveniencia. La cola y las evidencias viven en
un directorio de estado privado elegido por el operador. El servicio no abre una
API HTTP: sólo el propietario local envía solicitudes por CLI/SDK. No se usan
claves API, compras de créditos, otra cuenta ni extracción de credenciales como
fallback.

Antes de enviar trabajo, consultar:

```sh
SUBLIMINE_BIN="${SUBLIMINE_BIN:-sovereign}"
"$SUBLIMINE_BIN" --help
"$SUBLIMINE_BIN" queue
"$SUBLIMINE_BIN" service-status
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
"$SUBLIMINE_BIN" submit --file /ruta/peticion.txt --request-id submission:identificador-unico --preset adaptive-v2 --entry-mode bounded-read-response-v1 --parallel-pure-nodes 2
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
vacío habitual. [Contrato de admisión literal](../reconstruction/design/REQUEST-FILE-ADMISSION.md).

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

### Presentación exacta con pruebas separadas — opción versionada

La CLI que reconoce `--bounded-read-presentation separate-evidence-v1` lo admite
únicamente con `--entry-mode bounded-read-response-v1` en `submit`/`run` nuevos.
Esta selección exige protocolo 9 desde la creación; un ejecutor anterior que
no lo admita debe rechazar esa base. Antes de usarla con el wrapper instalado,
El paquete instalado debe acreditar compatibilidad. No es un nuevo preset ni modifica
adaptive-v1/v2, el transporte, la autoridad o los presupuestos.

El cuerpo contiene exactamente la entrega pedida. Las premisas, lecturas y
pruebas quedan conservadas fuera de él; el juez mantiene su lectura propia
posterior y justifica sus comprobaciones públicas. Si el encargo exige citas,
fuentes o explicación dentro del cuerpo, deben incluirse: separar evidencia
no elimina obligaciones del usuario ni autoriza entregar sin revisión.

El transporte `native-read-v1` sigue sin flag público. Las pruebas conocidas
de presentación no demuestran una reducción general del coste. La comparación
prospectiva de transporte quedó inconclusa por cobertura de uso desconocida
tras un reintento; no se cambia de transporte para anunciar un ahorro no probado.

### Respuesta factual pública — opción de desarrollo

`engine.create`/`queue.submit` con `entryMode: "sourced-response-v1"`, o
`submit`/`run --entry-mode sourced-response-v1` en un paquete que lo reconozca.
Consultar la versión y capacidades instaladas antes de usarlo: no se activa en la instalación por añadirlo
a este manual. No modifica los presets, el modelo, el razonamiento ni los permisos.
Exige protocolo 10 desde la admisión; sólo se selecciona al crear la misión.

Para una pregunta pública delimitada y un único resultado textual, el productor
usa un contrato propio completo y el juez conserva la ficha omega_22 íntegra.
Adquisición → candidato con claims → revisión independiente con fuentes crudas y
citas bajo `source-support` → entrega. Descubrimiento no es respaldo factual;
recuperar una página tampoco acredita que su contenido sea verdadero.

Una búsqueda y hasta dos adquisiciones íntegras de 65.536 bytes cada una forman
el sobre de esta vía, compartido entre recuperaciones. No son operaciones
obligatorias, una medida de calidad ni un techo global. URL conocida puede
evitar búsqueda; contraste sólo cuando sea pertinente. Si no basta o se requiere
investigación profunda, inputs locales, archivos, ejecución, decisiones de alto
riesgo o un proceso previo explícito, se conserva el encargo íntegro para el plan
completo. No mezclar con contexto documental, transporte nativo ni presentación
bounded. Los datos locales adjuntos van directamente al plan, sin actor público.

El juez comprueba soporte, contradicciones, emisor, fechas, lugar, versión y
vigencia. Los registros permiten comprobar cita, identidad y orden, no sustituyen
el juicio semántico. No hay overlays cualificados para estos nuevos ámbitos.
La retirada/caducidad de respaldo impide reutilizar la respuesta anterior.
Una consulta `report` sigue siendo una instantánea, no una nueva verificación web.

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
- **Ámbitos de aprendizaje.** Esta sintaxis de procedencia/protocolo 12 describe
  el árbol de desarrollo; comprobar `sovereign --help` y la versión instalada antes de usarla
  contra el wrapper instalado. `learn-list`, `learn-status` y
  `learn-evaluators` sólo consultan; `learn-observe`/`learn-propose` tienen
  efectos y/o inferencias. `learn-evaluate CICLO` ejecuta la comparación ya
  registrada, nunca una propuesta ni una promoción nuevas. El evaluador
  `exact-json-value-v1` requiere igualdad JSON completa y exactMatch/higher/1;
  no certifica la verdad del expected ni valida JSON Schema en general.
- `learn-status` es una proyección read-only de registros, ciclos, evaluaciones
  y punteros: oculta casos, expected, propuestas y payloads; no llama al modelo,
  no muta SQLite y no activa overlays. Una atestación mostrada sólo significa que
  hay un registro almacenado compatible; la consulta no revalida firmas,
  fuentes ni revocaciones actuales.
- `learn-validate --file DOMINIO` acepta sólo `--json`, `--file` y,
  opcionalmente, `--provenance-policy`; no acepta `--state-dir`. Valida en
  memoria la forma cerrada del manifiesto, el ámbito/dataset/binding y la forma
  de la política si se aportó. No abre ni muta el Store de destino, no verifica
  criptográficamente las firmas ni busca fuentes, por lo que no acredita la
  verdad de un expected ni la disponibilidad/conflictos de producción.
- `learn-register --file DOMINIO` añade al registro normal `--file` y la misma
  configuración externa de política. Primero hace el preflight estructural; en
  la transacción real exige evaluador compatible, mejora/holdout y, para un
  dominio activable, procedencia por caso bajo una política Ed25519 externa
  (`--provenance-policy` o `SOVEREIGN_LEARNING_PROVENANCE_POLICY`). Las claves y
  roles de la política no viajan en el manifiesto ni se convierten en confianza
  persistida: sólo queda congelado su `policyId`, y debe estar configurada en el
  proceso que registra y en los que usan el dominio. En runtime, ese `policyId`
  debe coincidir con el congelado en dominio y procedencia; las mismas claves
  bajo otra identidad de política se rechazan. Se
  revalidan firmas, hashes, pasajes y admisión vigente de fuentes al registrar y
  en evaluación/promoción/resolución/exportación; retirar una fuente bloquea
  usos futuros sin borrar historial. Sin procedencia, el dominio sólo puede ser
  `evaluation-only`; incluso con un ciclo aprobado queda `EVALUATED_ONLY`, no
  listo para promoción o exportación. No se inicia una inferencia, misión ni
  promoción por registrar.
- Al evaluar un dominio atestado, cada caso/variante recibe una autorización
  durable con evaluación, caso/hash, variante, request/prefijo/ámbito. Se escribe
  junto a la revalidación y después se llama al callback: no es atomicidad física
  con el proveedor. Tras el callback hay recheck, y el gate síncrono
  `beforeComplete` revalida dentro del commit de evaluación antes de ligar un
  prefijo reutilizable. Una revocación previa bloquea el despacho; una posterior
  queda ordenada tras la autorización y puede bloquear completar, reutilizar o
  promover. Promoción y rollback revalidan antes y después de su puntero dentro
  de la transacción. Los registros conservan secuencia, no nueva acreditación.
- Un dominio atestado eleva la base a protocolo 12. Los lectores/escritores
  anteriores deben estar drenados y un binario compatible debe ser cualificado
  antes de esa promoción. Los dominios v1 guardan su historia, pero su
  compilación requiere protocolo 11: no hay downgrade ni mezcla operativa
  automática en una base ya elevada. No presentar este texto como despliegue;
  el paquete instalado necesita su propia verificación. [Formato y límites](../reconstruction/design/LEARNING-DOMAIN-REGISTRATION.md).
- El SDK permite datasets explícitos `policy.activation: "evaluation-only"`
  para cualificar ámbitos completos sin desplegar instrucciones. La comparación
  aún necesita un oráculo acreditado. Proponer instrucciones no las activa ni
  demuestra mejora; evaluación, promoción y reversión conservan versiones,
  evidencias y ámbito. No escribir un AGENTS.md global para eludirlas.
  En versiones que exponen `report.learning`, consultar ámbitos registrados,
  ciclos de la misión y selección original de cada trabajador. EXCLUDED explica
  un bloqueo conservado; NO_MATCHING_OVERLAY registra una consulta sin selección.
  OVERLAY_FROZEN no es una promoción nueva ni la versión activa actual.
  NOT_RECORDED conserva la incertidumbre histórica. Ningún contador acredita
  un evaluador operativo o aprendizaje automático; el informe no inicia ciclos.

Los contratos detallados de planificación, presupuesto, admisión, entrada
acotada, método revisado y cursor se conservan en el dossier de diseño privado
de la instalación. Esta publicación incluye los contratos de runtime necesarios
para ejecutar y probar la fábrica.
Los resultados y fallos se conservan en los registros privados de la instalación.

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
6 para entrada bounded, 7 para admisión de originales, 8 para transporte nativo,
9 para presentación bounded separada, 10 para entrada pública con fuentes, 11
para dominios de aprendizaje declarativos y 12 para dominios con procedencia
atestada. Consultar estado no activa por sí solo los nuevos; jamás rebajar
user_version para un rollback. El 12 no convierte retrospectivamente un dominio
v1 en atestado y deja inservible su compilación v1 en esa base, por lo que exige
un plan de migración o separación explícita.
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

El historial de operaciones de una instalación concreta se mantiene privado.
SHA-256
`b7eb6745f1521ea3bef1bf2afa6d80536b9245fecfe1ed880a94ad6972e2a9cd`.
Sus rutas relativas conservan la ubicación histórica factory/; sus observaciones
no sustituyen al estado vigente.
