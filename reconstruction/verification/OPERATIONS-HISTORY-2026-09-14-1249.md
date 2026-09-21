# Operación local persistente

La cola usa la misma SQLite que el motor. No abre puertos ni acepta comandos
HTTP; sólo el propietario local puede enviar peticiones mediante CLI/SDK.
Los modelos no reciben el almacén ni pueden darse permisos de administración.
No requiere claves API. `submit` guarda la petición y devuelve un ID; `serve`
la atiende con el proveedor oficial configurado, el broker y la revisión normal.

```bash
export SOVEREIGN_NODE=/home/cardeex/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node
"$SOVEREIGN_NODE" factory/bin/sovereign.mjs submit --text 'Petición completa' --request-id submission:mi-peticion-001
"$SOVEREIGN_NODE" factory/bin/sovereign.mjs serve
"$SOVEREIGN_NODE" factory/bin/sovereign.mjs queue
"$SOVEREIGN_NODE" factory/bin/sovereign.mjs pause MISSION_ID
"$SOVEREIGN_NODE" factory/bin/sovereign.mjs continue MISSION_ID
"$SOVEREIGN_NODE" factory/bin/sovereign.mjs cancel MISSION_ID
"$SOVEREIGN_NODE" factory/bin/sovereign.mjs report MISSION_ID
```

Usar el mismo `--state-dir` en todos los comandos si no se usa el predeterminado.
`--request-id` permite repetir un envío sin crear otra misión; si cambia el texto
o las opciones, el mismo ID se rechaza. `submit` por sí solo no inicia un servicio.
Una instancia `serve` atiende una misión a la vez. Los procesos aislados del
ejecutor tienen sus propios límites y comprobaciones; la cola no los omite.

Si se agotaron los intentos por una cita de revisión inválida, `retry-review ID
--node N --reason 'Diagnóstico y cambio concreto de método'` autoriza **un**
intento adicional sólo de revisión del candidato exacto. No ejecuta por sí solo:
usar después `resume ID`, o `continue ID` si está en cola. Es una decisión del
operador local, no una herramienta del modelo ni un reinicio automático del
presupuesto. Conserva historial/política/criterios; no permite volver a producir
archivos ni sobreponerse a un rechazo material. Si cambia plan/candidato, falla.
Un timeout también consume ese único intento; no compra ni evade cuota.

## Adjuntos explícitos — desarrollo, todavía no promovido

`--file` sigue significando **texto de la petición**. Para datos adjuntos, los
comandos de creación `submit` y `run` admiten `--inputs manifiesto.json`:

```json
[{"source":"/ruta/explicita/datos.json","path":"datos.json"}]
```

`source` se resuelve respecto al directorio desde el que se ejecuta el CLI;
`path` es el nombre relativo dentro de la misión. No hay glob, búsqueda de
directorios ni importación recursiva. El manifiesto y sus archivos deben ser
UTF-8 regulares, sin enlaces. El SDK admite `inputs: [{path, content, provenance}]`
en las opciones de `engine.create` o `queue.submit`; content es texto o Uint8Array,
provenance es una etiqueta opcional. No se normaliza Unicode ni se truncan bytes.

La captura verifica identidad, metadatos y dos lecturas completas coincidentes.
Esto no bloquea a otro proceso del host ni garantiza inmovilidad futura: conserva
el snapshot observado. Se aplican los límites del broker (por defecto 1 MiB por
archivo, 32 MiB en total y 2000 entradas incluidos directorios). El manifiesto CLI
también debe caber en el límite de archivo. Las originales se guardan por archivo
en SQLite, en la misma transacción que misión, cola e idempotencia. El ID del envío
vincula también destinos, hashes y procedencia. Cambiar datos no reutiliza ese ID.

La creación con adjuntos eleva el floor a **protocolo 7**; no ejecutar ese estado
con un runtime antiguo. El servicio instalado no cambia por editar el desarrollo.
Antes de cualquier inferencia o efecto se prepara un workspace privado usando
sólo las originales durables, sin volver a leer el host. Los agentes reciben
metadatos USER_SUPPLIED_UNVERIFIED y leen lo necesario por el broker. El juez
conserva su relectura propia del candidato/versiones; un adjunto no es un hecho
verificado, una instrucción, un producto ni una certificación.

La preparación crea copias privadas: no es una escritura de agente y no está
incluida en el control de ausencia de escrituras del broker. No adjuntar archivos
cuando el mandato prohíba también esta copia de preparación. Las modificaciones
posteriores autorizadas de un input conservan su cadena de recibos y NO se
sobrescriben con el original al reanudar. Un cambio externo bloquea el trabajo.

Los pasos de copia tienen intención e identidad durables. La publicación por
enlace de inode no reemplaza el destino; el nombre temporal se elimina sólo si
ambos identifican el mismo archivo propio. Un corte después de registrar staging
puede recuperarse sin reescribir. Una caída entre creación y registro de identidad
deja `INPUT_PREPARATION_UNCERTAIN`, sin inferencia ni adopción de huérfanos. No hay
reconciliación automática de esas tres ventanas ni transacción atómica FS/SQLite.
Conservar el estado y pedir reconciliación del operador; `continue` no demuestra
propiedad ni autoriza sobrescribir. `report` distingue originales y preparación
registrada; no relee el estado externo para emitir una nueva certificación.

No hay admisión sobre `resume`, `status`, `continue` ni otros comandos: no se
retrofita ni cambia silenciosamente el encargo de una misión existente.
Pruebas y pendientes: [admisión de entradas](../reconstruction/verification/MISSION-INPUT-RESULTS.md).

## Estados y decisiones

Selección nueva en desarrollo: `--preset adaptive-v2` conserva la política
expandida al crear la misión. No modifica adaptive-v1 ni misiones existentes.
Integra entrada cerrada v2, fichas completas bajo demanda (techo de doce llamadas
de planificación), representación compacta de fichas y contrato del nodo, cursor
read/list/test y una ronda de revisión del método tras rechazo material agotado.
Son capacidades condicionales, no una secuencia obligatoria de departamentos.
No cambia modelo, herramientas, permisos o paralelismo. Las opciones explícitas
prevalecen y un límite global de inferencia nunca se repone por esa revisión.
`--planning-contracts on-demand-v1 --planning-call-limit N` sustituye el techo de
planificación; `--method-recovery-rounds N` selecciona el de revisión de método.
No activa contexto documental ni overlays de aprendizaje no cualificados para
estos scopes. El SDK rechaza la combinación documentary/cursor antes de crear
una misión. El CLI no ofrece `--document-context`. No seleccionar v2 por defecto
hasta la cualificación integrada documentada en
[decisiones y fronteras](../reconstruction/design/ADAPTIVE-INTEGRATION-V2.md).
Estado efectivo y versión instalada: [aceptación](../reconstruction/verification/STATUS.md).

| Cola | Significado y próxima acción |
|---|---|
| QUEUED | Solicitud durable, ejecutable cuando le corresponda. |
| RUNNING | El coordinador ha tomado la misión; no equivale a entrega. |
| RETRY_WAIT | Cuota o timeout observados; fecha de reintento guardada. |
| PAUSED | Pausa explícita, persiste en reinicios. Sólo `continue` la levanta. |
| WAITING | Falta autoridad, capacidad, calidad, reconciliación o presupuesto de reintentos. No hay bucle ciego. |
| COMPLETED | El motor confirmó la aceptación del producto. `report` conserva su evidencia; revalidación del estado externo es otra operación. |
| CANCELLED | Cancelación explícita terminal; no borra datos ni se revierte con `continue`. |

Cuota/timeouts/fallos transitorios tipados del proveedor: esperas crecientes de 5, 10, 20, 40 y como máximo 60 minutos;
doce reintentos automáticos, conservados entre reinicios. La cuota real no se
predice ni se da por restablecida al vencer un temporizador: el proveedor debe
permitir la siguiente inferencia. `continue` es la decisión explícita de volver
a intentar y reinicia ese contador. No compra créditos ni usa otra cuenta/API.

SIGTERM/SIGINT al servicio solicitan parada con pausa, cierre observado del
proveedor y recuperación pendiente para el siguiente arranque. Una cancelación
explícita de misión sigue siendo terminal. Una muerte abrupta conserva registros
de efectos y vuelve a pasar por la recuperación del motor; no fabrica recibos ni
repite automáticamente efectos inciertos. Un PID vivo nunca se desplaza por un
timeout de ownership. Los propietarios nuevos se vinculan a boot ID, PID y
start ticks para distinguir una reutilización de PID. Registros antiguos o una
identidad no comprobable conservan el tratamiento conservador: puede exigir
reconciliación manual antes de permitir dos coordinadores simultáneos. Véase
[identidad de proceso](lib/PROCESS-IDENTITY.md); no es una prueba de reboot real.

Las pruebas CLI verifican un proceso real de servicio, pausa, dos arranques,
SIGTERM y SQLite sin llamar al modelo. Las pruebas de política de cola usan un
ejecutor simulado y se identifican como tales. No acreditan tres días continuos,
calidad general ni una integración automática con cualquier chat externo.

## Instalación observada en esta VPS

Servicio de usuario: `/home/cardeex/.config/systemd/user/sovereign-factory.service`,
habilitado y activo en la auditoría del 14 septiembre a las 03:48 UTC, estado
`/home/cardeex/.local/state/sovereign-factory`. Paquete observado: `efbdb0e9`.
[Actualización y preservación del estado](../reconstruction/verification/RUNTIME-UPGRADE-2026-09-14.md).
Esa observación no es una garantía de disponibilidad posterior.
`sovereign service-status` consulta el gestor permanente y contrasta el cgroup
del proceso; no llama al modelo ni modifica servicios. En esta VPS, XRDP puede
exportar un bus de sesión distinto: un `systemctl --user` sin entorno explícito
puede consultar o arrancar la unidad en el gestor equivocado.
El guard de arranque empaquetado `check-service-scope.mjs`, conectado como
`ExecCondition`, comprueba su cgroup real. Rechaza la copia de una sesión gráfica
aunque ésta exporte variables del bus permanente, sin iniciar un segundo
consumidor de la cola. Su código 1 hace que systemd omita el arranque, no que
entre en un bucle de reinicios. La comprobación de despliegue exige este guard.
Para mantenimiento autorizado, con la cola reconciliada y sin misión ocupada:

```sh
env XDG_RUNTIME_DIR=/run/user/1001 DBUS_SESSION_BUS_ADDRESS=unix:path=/run/user/1001/bus systemctl --user status sovereign-factory.service
env XDG_RUNTIME_DIR=/run/user/1001 DBUS_SESSION_BUS_ADDRESS=unix:path=/run/user/1001/bus systemctl --user restart sovereign-factory.service
```

`restart` solicita parada recuperable y vuelve a iniciar el servicio. No se
modificó el servicio preexistente de OpenClaw.
El 9 de septiembre se habilitó la permanencia del propio usuario mediante
`loginctl --no-ask-password enable-linger cardeex`; el gestor confirmó
`Linger=yes`. La primera comprobación consultaba el gestor anidado de XRDP:
ese resultado no acreditaba que el servicio estuviese unido al gestor permanente.
El registro vigente de despliegue exige ahora bus canónico y cgroup exacto del
proceso, además de Linger. No se cerraron tus sesiones ni se reinició la VPS para ensayarlo;
configuración observada no equivale a un ensayo de tres días. No se usó sudo
ni contraseña, se modificó AppArmor o se abrieron puertos para esta instalación.

La cualificación real de cola terminó a las 15:42 UTC: petición guardada,
servicio, plan, candidato y revisión independiente hasta COMPLETED. Conserva
el fallo previo por ausencia de observaciones operativas y la continuación.
[Evidencia](../reconstruction/verification/live-queue.json). Sus once inferencias
incluyen comprobar su propio trámite; no acreditan eficiencia para aritmética.

## Versiones de ejecución

`factory/bin/build-runtime.mjs DIRECTORIO_DE_VERSIONES` crea una copia local
identificada por el hash de sus archivos, incluidas las fuentes necesarias para
las 154 fichas. No copia credenciales, bases de misiones ni `.git`. Verifica el
inventario completo, escribe archivos sólo lectura y conserva versiones previas.
El CLI empaquetado comprueba los hashes antes de atender una orden. Un propietario
con control del sistema puede cambiar permisos: no es una frontera de seguridad.
El cambio del servicio se realiza con la cola inactiva, después de probar la copia;
los trabajos no deben adoptar modificaciones del árbol de desarrollo a mitad de ejecución.

Desde el paquete efbdb0e9, la primera escritura con el protocolo nuevo eleva atómicamente
SQLite user_version a 2, sin reescribir registros anteriores. Abrir y sólo leer
conserva la versión 1; reanudar, incluso un resultado terminado, puede escribir
ownership y elevarla. Las versiones antiguas que sólo entienden 1 rechazan nuevas
aperturas de esa base. No se debe rebajar la cabecera para eludir esa protección.
Leer reportes compatibles no demuestra que un ejecutor antiguo respete nuevas
políticas: se reprodujo un intento de superar un presupuesto agotado bajo 10bb,
detenido por un proveedor SIM de prueba. Ninguna inferencia real salió del ensayo.
Antes del cambio deben detenerse y reconciliarse TODOS los escritores anteriores:
la barrera no añade verificaciones a procesos antiguos que ya tenían la base
abierta. No mezclar versiones ni restablecer una copia previa descartando trabajo.
[Contrato, evidencia y límites](../reconstruction/design/EXECUTION-PROTOCOL-FLOOR.md).

El comando `/home/cardeex/.local/bin/sovereign` apunta a la versión instalada.
`sovereign queue`, `sovereign roles omega_04` y `sovereign report ID` se pueden
usar desde cualquier directorio, sin inferencias. El [registro de despliegue](../reconstruction/verification/runtime-deployment.json)
identifica la versión y el proceso comprobados; cambios posteriores del código
fuente no se instalan automáticamente.

`runtime-deployment.json` es el registro histórico inicial. Los cortes posteriores
se conservan como `runtime-deployment-<identificador>.json`; el bloque vigente de
[estado de aceptación](../reconstruction/verification/STATUS.md) identifica el
último despliegue observado. El servicio y el wrapper deben apuntar al mismo
directorio, cuyo manifiesto coincida con la regresión, antes de activar cambios.

Para una misión nueva, `--context-encoding lossless-v1` fija la deduplicación
sin pérdida en su política persistente. Se mantiene al reanudar y en la cola;
`plain-json` es el predeterminado. No reduce el límite de evidencia lógica ni
cambia fichas, criterios, permisos o perfiles de aprendizaje por reentrada.

La selección experimental `lossless-json-v2` mantiene además las cadenas JSON
como cadenas originales reconstruibles, compartiendo su contenido repetido.
El formato de misión queda fijado aunque una entrada concreta use v1/JSON
ordinario por resultar menor. `worker.context.encoding` registra la forma enviada,
bytes lógicos y físicos, cantidad de textos y envoltorios, y round-trip verificado.
No permite superar el límite lógico ni traslada instrucciones aprendidas para
otro formato. `--review-encoding evidence-refs-v1` es una selección distinta,
también opt-in; no agrupa criterios ni sustituye las pruebas del revisor.

En desarrollo, `--context-encoding source-text-v1` conserva el contexto anterior
íntegro y añade una vista literal de missionIntent sólo cuando ese campo ya
estaba autorizado para el agente. Las réplicas y sus revisores ciegos no reciben
esa intención privada ni suplemento alguno. La representación queda fijada en
política, prefijo y scope de aprendizaje; no modifica misiones ni promociones
anteriores. Los bytes adicionales cuentan contra el límite de transporte y
`sourceViewCount` registra si se envió la vista. Puede aumentar tokens; no es
un certificado de ahorro. Sólo el selector aislado cuenta con dos casos reales;
el planificador completo con este wrapper sigue pendiente de cualificación.
No se activa en el preset ni se instala automáticamente.
[Contrato y evidencia](../reconstruction/design/SOURCE-TEXT-VIEW.md).

`--review-encoding evidence-catalog-v1` conserva el mismo contenido y añade al
contexto un catálogo de identidades realmente observadas. El juez selecciona una
clave y una cita literal; el controlador expande kind/id/hash y aplica el mismo
registro de aceptación. No corrige citas ni juicios. Historial de herramientas
y acciones propias actuales siguen separados; claves no acreditan verdad ni
independencia de fuentes. Formato opt-in con cualificación limitada.

`--entry-mode closed-response-v1` activa, por misión nueva, una entrada adaptativa
para transformación/composición/derivación estrictamente cerrada con los datos
aportados. Produce un candidato y lo revisa en otra identidad, con criterios
fijados de antemano. La necesidad de adquirir fuentes, archivos, ejecución o
productos/etapas materiales independientes deriva al plan completo. Una petición
mixta no puede entregar sólo su parte fácil. El productor o su juez pueden
rechazar la elegibilidad; el planificador no recibe la respuesta descartada.
`planned` conserva la vía completa y es el comportamiento predeterminado.
`report` distingue respuesta cerrada sin plan de una misión planificada. El ensayo
inicial de entrada cubre dos productos cerrados y cuatro fronteras, no una
calibración general ni perfección. Reanudar una misión no cambia su política.

`--entry-mode closed-response-v2` es una alternativa experimental explícita en
desarrollo. Conserva petición, elegibilidad, criterios y revisión independiente,
pero su productor usa un contrato propio del controlador: no toma prestado Ω23
sin sus entradas aceptadas ni inventa un plan para justificarlo. Registra y
revalida identidad, alcance, propósito, política, criterios y prefijo completos.
No puede recibir fuentes, planes, observaciones ni permisos de herramientas,
aunque la misión los permita para su eventual ruta planificada. Productor y
revisor v2 no reutilizan overlays aprendidos bajo el contrato anterior.
`report` muestra esta procedencia y responsabilidad por separado. V1 conserva
su contrato e historia; su acierto numérico no acredita adecuación de todas sus
fichas. V2 tiene un par real conocido de transformación/revisión contrastado
con la vía planificada; eso no cualifica todas sus clases elegibles ni todos
los umbrales de escalado. Véase el [resultado acotado](../reconstruction/verification/CLOSED-V2-REVISION-PREFLIGHT.md).
No está instalada por sus tests o por ese par, y no cambia el preset adaptive-v1.
No añadir esta opción a una reanudación.

`--entry-mode bounded-read-response-v1` es otra ruta **en construcción, no
instalada ni cualificada por los ensayos de v2**. Permite un resultado cerrado
con los datos del mensaje y, si lo exige, un único archivo local explícitamente
solicitado de hasta 65.536 bytes completos. El límite sólo selecciona la ruta:
fuera de ese alcance se conserva el encargo entero para planificación. No admite
listado, escritura, ejecución ni investigación; el productor tiene contrato
propio y el revisor relee y cita la misma versión después del candidato. No es
un plan ficticio, una certificación de pericia o verdad de los datos locales.
Los presets adaptive-v1/v2 no cambian. Declarar esta política nueva eleva el
protocolo a 6 atómicamente al crear la misión: no usar un ejecutor antiguo para
esa base. No promueve la base instalada al consultar estado o por leer estas
instrucciones. El servicio y sus escritores deben estar reconciliados antes de
cualquier despliegue, y los trabajos antiguos conservan su política original.

`--allowed-tools workspace.read` limita explícitamente la autoridad de una misión
nueva; varios nombres se separan por comas y `--allowed-tools ''` no permite
ninguna herramienta. No modifica la autoridad de una misión existente; cambiarla
bajo el mismo request-id se rechaza. No aumenta permisos del host ni concede
lectura fuera del workspace de la misión. Omitirlo conserva el comportamiento
anterior. Las herramientas permitidas no equivalen a efectos ejecutados.

Un bloqueo `worker.context.blocked` registra tamaños por campo, identidades de
fuentes/observaciones y límites antes de enviar la inferencia. No contiene su
texto, no trunca evidencias, no aumenta límites y no prueba recuperación del
trabajo. Las fuentes HTML grandes pueden superar el contexto disponible aun
con deduplicación. La exposición por ventanas está implementada como opción
experimental explícita del SDK de desarrollo, descrita a continuación; no es
una capacidad de la release instalada por defecto.

### Inspección de fichas bajo demanda — desarrollo opt-in

`FactoryEngine.create` admite en nuevas misiones
`planningContracts:{mode:'on-demand-v1',maxCalls:5,maxBytes:262144}`.
El cinco es sólo un ejemplo de elección explícita, no una cantidad óptima ni un
predeterminado: maxCalls es obligatorio (1..100), compartido por todas las
consultas/propuestas/actores de planificación de esa misión. Los jueces y la
producción tienen sus controles propios; este techo no limita todos los tokens
de una misión. maxBytes es opcional (hasta262144) y no permite fichas parciales.

La CLI de efbdb0e9 expone `--planning-contracts on-demand-v1` junto con
`--planning-call-limit N` y opcionalmente `--planning-card-bytes B`. No añadir
flags a otra versión si su help no los reconoce, ni a una reanudación:
las misiones anteriores, el preset, modelo/esfuerzo/permisos y cuotas no cambian.
Una entrada cerrada elegible no tiene que ejecutar planificación por activar
esta opción. La opción sólo interviene cuando se usa la ruta de plan.

El planificador recibe el directorio y las fichas completas ya pertinentes;
puede pedir otras por ID exacto. La selección local no es una respuesta recibida.
Una propuesta sin TODAS sus fichas de productor y revisor se conserva como
provisional: se suministran las faltantes y se exige otra respuesta. Sólo un plan
con presencia probada en su petición completada pasa a las normalizaciones y al
juez independiente. Presencia no demuestra comprensión ni compatibilidad.

Solicitud pendiente y reserva global se guardan antes del proveedor. Recibo y
mensaje público se guardan juntos. Las preparaciones locales son idempotentes;
tras una caída se recupera el mismo actor/mensaje/candidato donde existe evidencia
durable, sin llamar otra vez para reemplazar un resultado conservado. Una llamada
pendiente sin desenlace durable produce PLANNING_INSPECTION_PENDING; agotar el
techo produce PLANNING_INSPECTION_LIMIT. Ambas requieren dirección, no se
convierten en aceptación. No hay garantía de exactamente una ejecución remota.

Un fallo de inferencia capturado antes de validar una respuesta puede abandonar
sólo esa inferencia y permitir otro actor bajo el presupuesto conservado y las
reglas de recuperación existentes. No acredita finalización remota ni reembolsa
la reserva. Fallar al guardar una respuesta recibida no es rechazo de calidad
ni permiso para sustituirla. La política excluye overlays de planificación
evaluados bajo el esquema anterior. No modifica AGENTS.md global ni los jueces.

`report` muestra el techo, reservas y última respuesta/fallo de cada actor,
con vínculos a registros exactos y cobertura; las métricas históricas cuentan
todas las llamadas observadas. Leer el informe no ejecuta modelos ni firma datos.
Integración simulada y cortes de proceso reales están probados. Regresión
r5T3EM cerrada el13septiembre18:14:45.208UTC:1285tests,1284PASS,0FAIL,1SKIP;
285entradas y cuatro capturas reconciliadas18:17:49.250. Ejecución serial por
archivo; conserva las pruebas internas de concurrencia y todos los límites.
La anterior6dsE55 falló al iniciar un proceso nativo con EAGAIN; ese fallo puntual
no queda explicado ni corregido por esta pasada. La medición del nuevo protocolo
con proveedor real cerró enCS6jHM: tres llamadas/73974tokens, plan aceptado,
fichas completas y reentrada sin replay. Auditoría posterior de fichas, plan,
juicio y capturas en
[CS6jHM](../reconstruction/verification/PLANNING-INSPECTION-LIVE-CS6jHM.md).
Es planificación de un caso conocido, sin ejecutar el producto. No afirmar
reducción de tokens, superioridad ni release instalada por esos tests.
[Diseño y evidencia](../reconstruction/design/PLANNING-CONTRACT-INSPECTION.md).

### Ventanas documentales experimentales — SDK de desarrollo

Al crear una misión nueva con `FactoryEngine`, la opción
`documentContext:'literal-windows-v1'` permite propuestas locales `source.locate`
y `source.read` sobre snapshots ya admitidos. No es un flag de la CLI instalada
ni forma parte del preset; no añadirlo a una misión persistida. Planificación,
protocolos ciegos y nodos de ejecución conservan sus fronteras respectivas.
Productor y revisor tienen grants, selecciones y frames propios. Una selección
no acredita lectura: el pasaje debe estar en una solicitud posterior completada
del actor que lo cita, con versión, fuente y byte range exactos. El contenido
no se considera verídico sólo por coincidir literalmente o tener firma.

`source.batch` agrupa de2a8 propuestas locales independientes de localización
o selección, cada una sobre una fuente y grant distinto ya expuesto. Cobra
cada miembro del presupuesto24, respeta el agregado16ventanas/256KiB y revierte
el lote local completo ante un miembro inválido. No incluye adquisiciones ni
otros efectos y no permite lecturas dependientes de resultados futuros.
El lote de herramientas externas sigue siendo distinto y puede conservar
éxitos parciales; no se le atribuye atomicidad de la transacción local.

La [ruta documental escalar2cYEbW](../reconstruction/verification/DOCUMENTARY-LIVE-2cYEbW.md)
completó un caso real conocido, con revisión propia y reentrada, pero su coste
no satisface eficiencia general. El [lote](../reconstruction/verification/DOCUMENTARY-NAVIGATION-BATCH.md)
tiene regresión e integración simulada; su ensayo realbckJet fue interrumpido
por coste de validación recursiva, sin entrega final ni cualificación del
recorrido. Productor y juez sí completaron sus lotes propios y el expediente
intermedio fue aceptado. Se conservaron DB/WAL/SHM; sólo una copia se recuperó
para diagnóstico, sin reanudar el original. La optimización local de pruebas
de ventanas conserva26pruebas exactas y supera162tests dirigidos al corte13:28;
no está instalada ni sustituye una regresión global o un ensayo del recorrido.
La regresión posteriorLxDTPc cerró13:51:04.121 con1093tests,1092PASS,
ceroFAIL y unSKIP de suscripción; no instala esta versión ni termina el mandato.
Después, la factoración de material comparte una única autenticación de frame
por expansor, validador u operación, incluso sin citas. No presta autorizaciones
entre llamadas. 240tests dirigidos y comparación exacta de material conservado
verificados14:26. La regresión posterior uwAn0O cerró con1106tests,
1105PASS/ceroFAIL/unSKIP de suscripción,319028.605822ms. No activa esta versión.
El paso completo de esa versión se comprobó en copia6I1iBb:69380ms frente a
160226ms anteriores, operación y ventanas exactas, replay sin trabajo nuevo y
lecturas retroactivas rechazadas. No es lectura completada ni entrega del original.
La siguiente factoración comprueba los grants de un actor por lote y cada padre
productor distinto una vez dentro de esa llamada síncrona; nunca cachea permisos
entre llamadas. PvhN1F:1120tests,1119PASS/ceroFAIL/unSKIP,312090.541143ms.
El paso local posteriorFE40sy cerró54004ms con mismos bytes/ventanas y controles,
sin entrega ni inferencias nuevas. El siguiente lector por lote de selecciones
superóVM8lJD:1133tests/1132PASS/ceroFAIL/unSKIP326277.225204ms. Se detectó después
un fallo de la API JavaScript Authority.open: releía el payload tras verificar.
La corrección devuelve exactamente el cuerpo autenticado y rechaza getters;
15tests dirigidosPASS; Sn4ZOu posterior cerró1.141tests/1.140PASS/ceroFAIL/unSKIP,
302174.871668ms, sin alterar entradas durante ejecución. No es evidencia
de ataque remoto ni habilita instalación. [Diagnóstico](../reconstruction/verification/DEPENDENCY-VALIDATION-COST.md),
[autenticación](../reconstruction/verification/AUTHORITY-AUTHENTICATED-SNAPSHOT.md).
MWDBfO posterior cerró45034ms frente54004ms, misma operación/ventanas y controles.
Después se compone la prueba de fuente del lote desde su propio frame completo
recién validado, sin volver a reconstruir idéntica petición/selección. La fuente,
los bytes, actor, grants, adquisición y orden temporal siguen comprobados; no
se aceptan cachés o frames preautorizados del llamador. mo5Fej:1.146tests,
1.145PASS/ceroFAIL/unSKIP303250.738069ms. GDJx1P posterior cerró32129ms,
misma operación/ventanas y controles, sólo en copia. FyTUkH contrastó26pruebas,
nueve selectores factuales y material expandido idénticos al original conservado.
Son muestras locales, no benchmark general ni entrega de bckJet; ni la regresión
ni el diagnóstico local habilitan una instalación por sí solos.
La cesión cooperativa antes de inferir atiende cancelación entre pasos, pero
no preempta una validación síncrona activa. [Evidencia y límites](../reconstruction/verification/SOURCE-PROOF-BATCH-PREFLIGHT.md).
Los overlays de aprendizaje documental permanecen
deshabilitados; no se importan mejoras evaluadas con exposición legada.

La planificación nueva conserva su respuesta pública validada y el recibo de
finalización en una sola transacción (`planning-response-v1`). Al reentrar,
un candidato durable conserva prioridad; si sólo está la respuesta, se crea
desde ella y se revisa por separado, sin otro planificador ni reiniciar intentos.
Su lector verifica ámbito, solicitud y configuración exactos, recibo único y
orden de commits desde una instantánea coherente. Alteraciones fallan cerradas,
no se convierten en ausencia ni se gastan como otra corrección de calidad.
Una solicitud sin respuesta durable no acredita que se guardó el resultado
remoto. No recupera conversaciones, garantiza exactly-once remoto, acredita
lectura de fichas ni sustituye la revisión independiente. Consulte
[pruebas y estado de cualificación](../reconstruction/verification/PLANNING-RESPONSE-DURABILITY.md)
antes de instalar; tres fronteras de salida abrupta están ensayadas con SQLite
real y proveedor simulado, no con apagado de la VPS ni con inferencia real.
La regresión UWzy5t cerró1165tests/1164PASS/ceroFAIL/unSKIP305039.436678ms;
276inputs, cuatro capturas y propietario ausente reconciliados16:31:23.023.
Eso no activa la versión ni cualifica la consulta interactiva de fichas.

Los helpers de inspección local conservan fichas íntegras y diagnostican presencia
en las tres colecciones designadas del task. El sobre de una selección está
acotado a256KiB como máximo, sin truncado. readPlanningContractCoverage liga esa
comparación a la solicitud exacta completada del plan original, con referencias
de respuesta/request y lectura coherente. No modifica el plan, da aceptación ni
certifica comprensión o ajuste del rol. No es todavía el bucle on-demand de
consultas, su cursor durable o una nueva política CLI/SDK. Engine y catálogo:
119/119pruebas dirigidasPASS48218.008026ms. Global vdN9yi cerrada1196tests,
1195PASS/ceroFAIL/unSKIP314916.497427ms;276inputs/cuatro capturas y owner ausente
reconciliados16:53:58.933. No instala esta ampliación ni habilita el bucle de
consultas aún ausente. [Alcance](../reconstruction/design/PLANNING-CONTRACT-INSPECTION.md).

`--preset adaptive-v1` (SDK `{preset:'adaptive-v1'}`) selecciona conjuntamente
`scoped-v1`, `lossless-json-v2`, `evidence-catalog-v1` y `closed-response-v1`.
Las opciones explícitas de la petición prevalecen. No cambia modelo/razonamiento,
herramientas, paralelismo ni presupuestos de intentos. La definición, su hash,
las claves sobrescritas y el hash de política efectiva quedan en `policySelection`
al crear la misión; ninguna reanudación vuelve a resolver el preset. Se mantiene
la compatibilidad de llamadas sin preset. El CLI rechaza elegirlo en `resume` o
consultas de estado. Una evolución de su definición exige otro nombre versionado.

`--card-encoding compact-json-v1` (SDK `cardEncoding`) es una selección distinta:
mantiene todos los campos y cadenas de las fichas completas, pero serializa su
JSON sin indentación. No modifica el texto de controles, overlays, la petición
ni las observaciones. `pretty-json` conserva el formato anterior. Se fija al crear
misión, se conserva en reentrada y delimita también el ámbito de aprendizaje;
no permite heredar instrucciones evaluadas con otro formato. Se mantienen los
límites de bytes de la representación lógica anterior. No forma parte de
adaptive-v1. Consulte el estado de cualificación antes de seleccionarlo: identidad
del JSON reconstruido no acredita por sí sola igual comprensión del modelo.

`--producer-context node-contract-v1` (SDK `producerContext`) selecciona por
misión una vista del plan para cada productor: nodo propio y requisitos servidos
íntegros; el nodo final conserva todos los requisitos. El artefacto del plan no
cambia: continúa siendo una dependencia aceptada con su hash original, mientras
`planViews` tiene identidad de vista separada. No expone otros contratos de nodo
ni el routing global. Planificador y jueces mantienen su exposición completa.
La política y las vistas se conservan al reanudar y el scope de aprendizaje del
productor distingue el formato. `full-plan` conserva la conducta anterior y
adaptive-v1 no incluye esta opción. No confundir esta separación estructural con
ceguera semántica frente a toda pista, feedback, conocimiento previo o archivo
compartido. Consulte la cualificación antes de seleccionarlo.

## Compatibilidad de método y modo

El catálogo íntegro conserva capacidades que el trabajador ordinario no sabe
ejecutar. En particular `omega_09` y `veritas_04` requieren réplica ciega sellada:
no pueden asignarse a un revisor que ya recibe el candidato, ni a un productor
ordinario sin protocolo de ocultación/sello/apertura. El runtime rechaza esas
asignaciones con `ROLE_EXECUTION_UNSUPPORTED` antes de aprobar/instalar el plan,
crear el trabajador o volver a despachar uno persistido. El planificador recibe
estas incompatibilidades y su procedencia; la recuperación conserva requisitos,
historial y límites. El catálogo y los planes históricos continúan legibles.

Una revisión ordinaria puede cumplir una petición que no exija ceguera usando
otra faceta apropiada. El árbol de desarrollo incorpora una ruta cerrada tipada
con protocolo previo, intento sellado, revisión material antes de apertura e
informe determinista revisado; compruebe su cualificación y la versión instalada
en STATUS antes de atribuirle disponibilidad operativa. Sin ese adaptador
verificado, la obligación de ceguera sigue pendiente: ni cambiar modelo ni
escribir «blind» en el prompt lo sustituye. Este control no certifica todos los
métodos de las otras fichas. Véase el diagnóstico en reconstrucción.

Al revisar un plan, el juez recibe `targetRoleContracts`: cada asignación de
productor/revisor y la ficha íntegra, deduplicada, de los roles propuestos.
Compara métodos y obligaciones reales de las fichas, no sólo sus títulos. Es
contexto del producto que audita, no un cambio de su identidad, herramientas o
autoridad. Se liga al candidato por ID/hash y conserva el límite de contexto
lógico sin truncar. No se añade esta colección a una revisión ordinaria de producto.

El planificador conoce `runtimeCapabilities.reviewEvidenceBoundary`; su juez
recibe además `reviewEvidenceContext`, un mapa derivado del plan exacto de qué
productos/ascendientes tendrá cada revisión. No son resultados futuros ni recibos.
Cada obligación debe evaluarse donde su evidencia exista: controles propios en
cada rama independiente y obligación conjunta íntegra en su convergencia. No se
crean dependencias entre productores independientes sólo para divulgar historiales,
ni se cambia una restricción temporal explícita del usuario para facilitar el gate.
La revisión ordinaria sigue sin recibir productos o historiales de hermanos ajenos.
Un criterio mal colocado debe volver a planificación, no certificarse sin evidencia.
Este mapa no sustituye al juicio semántico ni demuestra que éste siempre acierte.

## Especialistas de misión sin rol de catálogo prestado

Un nodo de producción cognitiva puede declarar `roleIds:[]` sólo si propone una ficha
`specialist` completa: pregunta, métodos, falsificador, aporte esperado y cierre.
No puede dejar vacíos los roles de revisión. La ficha pasa la revisión del plan
y sólo se compila desde su versión aceptada, con hash del plan/nodo y comprobación
de esa vinculación antes de cada inferencia. No se acepta una ficha libre enviada
al trabajador ni una versión cuyo plan haya sido retirado. `report` expone la
ficha completa y las vinculaciones de ejecución.

No se heredan overlays del catálogo, ni autoridad o adaptadores inexistentes.
Un especialista complementario tampoco elimina las precondiciones de los roles
que lo acompañan. El directorio proporciona propósitos exactos y la recuperación
adjunta las fichas completas de asignaciones rechazadas. Consulte STATUS antes
de atribuir esta capacidad a la versión instalada.

## Copia literal nativa (desarrollo; consultar cualificación)

`literal-input-copy-v1` es un adaptador explícito, no un especialista ficticio.
Su plan declara un `requestQuote` que aparece exactamente una vez en la petición
inmutable, y un `copyText` que aparece exactamente una vez dentro de esa cita.
El motor deriva posiciones y copia el fragmento real, preservando espacios,
CRLF y Unicode; no normaliza, calcula, adquiere fuentes ni interpreta prosa.
El nodo usa `outputKind:literal-input-copy`, roles productores vacíos,
specialist=null y ninguna dependencia productora, herramienta o efecto.

Para objetos delimitados se prefiere `literal-input-span-v1`: declara `before`
y `after`, anclas literales no vacías que deben aparecer una sola vez cada una
en la petición completa. Deben estar ordenadas, sin solaparse, y encerrar un
contenido no vacío. El motor copia exclusivamente el tramo entre ellas, sin
las anclas. Amplía cada ancla con contexto cuando las marcas se mencionen
también en las instrucciones; no toma la primera coincidencia ni decide por
similitud. El modelo no transcribe el cuerpo ni proporciona offsets. Fuente,
anclas, posiciones y contenido derivado quedan en el origen y en la prueba
visible al juez. Mantiene todos los controles del adaptador anterior y su
compatibilidad histórica; no convierte una selección errónea en aceptable.

La selección y los controles fijos de selección/fidelidad se aceptan en el
plan antes de producir. El candidato mantiene origen firmado, petición/plan,
identidad nativa única, cronología y revisión independiente; no recibos LLM
inventados. Su juez recibe evidencia `artifact-input-copy` y debe comprobar
que el fragmento es el objeto realmente solicitado. Fidelidad no es verdad y
el producto no emite claims factuales. Consumidores requieren su aceptación.
Registro nativo y claim del nodo se comprometen en una transacción. Una salida
antes del commit no deja un origen huérfano; tras el claim se recupera la misma
identidad, revalidando fuente, plan y origen firmados antes de materializar.
Un origen ausente o alterado detiene la recuperación, sin sustituirlo por otro.
Una cuota recupera el mismo candidato; un RETURN material no autoriza copiar
y votar de nuevo sin cambiar el método o resolver la evidencia pertinente.
Esta excepción y la comparación determinista permiten roles productores
vacíos sin carta cognitiva, nunca revisores vacíos. No se presume instalada.

## Integridad del estado al recuperar

El verificador comprueba en una sola lectura consistente la cadena de eventos,
la cobertura de todas las versiones inmutables, sus padres y la correspondencia
de cada head con la última versión comprometida. Una base con head atrasado,
historia incompleta o registros sin evento se rechaza; no se repara ni se elimina
automáticamente. Conserva una transacción externa y cierra sólo su propio snapshot.
La detección de una restauración total coherente requiere un ancla externa: el
journal local no sustituye copias de seguridad ni protege frente a un administrador
que reescriba toda la historia y sus hashes.

En `claims.basis`, `claimId` siempre resuelve una entrada real en los claims de
una versión declarada de entrada; no sirve un ID de requisito o pasaje del plan.
Una demostración cerrada con datos completamente dados puede conservar premisas
y argumento público en `body` con `claims:[]`, bajo revisión independiente.
Esto no exime fuentes empíricas ni la procedencia expresamente solicitada.

## Presupuesto compartido de misión (en desarrollo)

La CLI de efbdb0e9 admite `--mission-call-limit 1..1000` únicamente al crear
una misión (`submit`/`run`). SDK: `inferenceBudget: {mode: 'mission-calls-v1',
maxCalls: N}`. Es una selección explícita y congelada; no se añade al preset
ni a misiones anteriores. Está disponible en la instalación auditada del día 14,
sin imponer un límite nuevo a su cola existente. Comprobar el `--help` de
la versión que realmente se vaya a usar, sin ejecutar desarrollo por defecto.

La reserva incluye entrada, plan, productores, revisores, réplicas y operaciones
de descubrimiento por modelo (`source.search`). Se compromete antes del envío,
en la misma transacción que la solicitud exacta/run pendiente o DISPATCHED de
la búsqueda. Procesos concurrentes comparten el mismo límite. Un fallo de
persistencia previo al commit no consume una reserva; muerte después del commit,
timeout, rechazo o cierre fallido no la devuelven. Un recibo de búsqueda ya
guardado se consulta sin otra reserva y sin volver a buscar. Las operaciones
inciertas conservan su bloqueo, no reciben otra identidad para repetirse.

Es un límite conservador de solicitudes lógicas, NO de tokens, dinero, trabajo
completado, reintentos HTTP internos ni llamadas nativas de búsqueda. No modifica
modelos, razonamiento, herramientas, plazos, criterios ni el presupuesto de
planificación existente: si hay ambos techos, ambos deben permitir la solicitud.
Una unidad disponible no garantiza capacidad para completar la revisión final.

`INFERENCE_BUDGET_EXHAUSTED` deja la misión NEEDS_DIRECTION y su cola WAITING,
sin reintento automático ni desgaste del presupuesto de calidad. `continue`
no sube el techo: conserva candidatos y resultados, pero no puede hacer una
inferencia adicional si está agotado. No hay ampliación implícita ni comando de
reset del contador; cualquier futura extensión necesita su propio contrato.

El informe JSON incluye `inferenceBudget` con reservas por tipo, límite y saldo,
separado de las métricas observadas del proveedor. El planificador/productor no
ciego recibe una vista anterior a reservar su propia propuesta, expresamente no
garantizada ante concurrencia; jueces/réplicas no reciben ese canal adicional.
Los overlays previos quedan deshabilitados en ese ámbito no evaluado. La consulta
de presupuesto valida la cadena y referencias de registros, sin volver a cargar
todos los cuerpos históricos: no sustituye su auditoría sustantiva/criptográfica.

Pruebas y fallos de construcción: [diseño y evidencia](../reconstruction/design/MISSION-INFERENCE-BUDGET.md).
No declarar ahorro medido, independencia cognitiva ni aceptación completa a partir
de un contador menor o una prueba con modelos simulados.

## Integración con la conversación

### Respuestas finales de producción recuperables (desarrollo)

En nodos ordinarios planificados, las nuevas invocaciones guardan propuesta pública
y recibo en una transacción. Si el proceso cae antes de crear el candidato, puede
materializar el mismo final bajo el productor original y pasar después por su
juez independiente, sin otra inferencia de producción. No repite herramientas,
elimina rechazos ni reinicia presupuestos. Un cierre no confirmado permanece bloqueado.
Las propuestas de herramientas/documentales se conservan pero no reciben aquí
un cursor automático; tampoco cambia el checkpoint de la entrada cerrada.
El legado sin respuesta no se reconstruye desde un recibo.
[Contrato, pruebas y cualificación acotada](../reconstruction/design/PRODUCER-RESPONSE-DURABILITY.md).
Incluido en el paquete efbdb0e9; la cualificación citada tiene alcance acotado,
no constituye una garantía para todo trabajo o punto de caída.

Nueva frontera de cierre, posterior a efbdb0e9: las producciones nuevas
exigen `producer-cleanup-v1` y protocolo SQLite 3. Respuesta guardada no equivale
a proveedor cerrado. Cada paso debe conservar prueba de cierre antes de consumo,
herramientas, herencia o reemplazo; ausencia o cierre negativo bloquean. Un error
del evento diagnóstico posterior no invalida una prueba CLOSED ya comprometida,
pero sí interrumpe la invocación hasta recuperar su respuesta exacta. No bajar
la cabecera, inventar un cierre ni comprar otra inferencia para eludir la espera.
Un final antiguo aún no materializado no recibe esta prueba retrospectivamente.
[Contrato y estado actual](../reconstruction/design/PRODUCER-CLEANUP-BARRIER.md).

### Lotes exactos recuperables (opt-in nuevo en desarrollo)

`--producer-batch read-test-cursor-v1` conserva las reglas de argumentos de
read-test-v1 y añade un cursor exclusivamente a lotes ordinarios de lectura/listado
y, opcionalmente, una ejecución final ya fijada en requiredEffects. No convierte
escrituras, fuentes o navegación documental en operaciones recuperables por ese
cursor. La política antigua no se modifica retrospectivamente.

El origen fija límites de pasos/herramientas/lote y un registro durable de cada
intento, incluidos los fallidos y las escrituras previas del mismo productor.
Se exige protocolo SQLite 4 desde ese origen. Sólo se reanuda con los mismos
límites, productor, argumentos, inputs y orden. Una propuesta cerrada anterior
a la declaración conserva su preflight pendiente; no autoriza efectos por sí sola.
Resultado existente se verifica e incorpora, PREPARED se despacha bajo autoridad
actual, DISPATCHED/UNCERTAIN sin resultado exige reconciliación y nunca repetición
automática. Observación y avance forman una transacción distinta de la ejecución
externa. El fallo conserva método y correcciones; no se cobra un sufijo no intentado.

Los jueces mantienen sus propias verificaciones. Un cursor completo no certifica
semántica, actualidad de lecturas históricas, aceptación ni ahorro de tokens.
No rebajar la cabecera ni ejecutar una versión antigua contra bases nuevas.
En esta revisión del documento, 68fd4472 sigue instalado y no contiene el cursor;
la ampliación aún necesita regresión completa y cualificación de suscripción.
[Implementación, pruebas y estado](../reconstruction/design/RESUMABLE-READ-TEST-BATCH.md).

### Respuesta de entrada cerrada recuperable (desarrollo posterior)

Las entradas v1/v2 nuevas conservan, además, su respuesta pública exacta junto al
recibo de inferencia. El marcador de protocolo nace con la entrada; el legado no
se reescribe. Tras una caída posterior al cierre confirmado del proveedor, el
motor recupera esa respuesta bajo el mismo actor y conserva el juez independiente.
Si el adaptador falló al cerrar, informó explícitamente que el proceso no salió,
o el cierre no llegó a registrarse, permanece CLEANUP_UNCONFIRMED: no se compra
un reemplazo ni se interpreta `continue` como confirmación del proceso.
No hay todavía reconciliador automático para ese cierre desconocido. Cierre sin
error del adaptador y observación explícita de salida se registran por separado;
no se inventa la segunda si el adaptador no la entrega.
[Contrato y límites](../reconstruction/design/CLOSED-ENTRY-RESPONSE-DURABILITY.md).
Incluido en efbdb0e9, sin reescribir entradas antiguas. No es aceptación integral.

### Revisión del método tras rechazo material (opt-in en desarrollo)

`--method-recovery-rounds N` fija, sólo al crear una misión, un máximo de 1–100
rondas globales `reviewed-method-v1`. SDK: `methodRecovery:{mode:'reviewed-method-v1',maxRounds:N}`.
No cambia el preset ni una misión existente. Al agotarse los intentos de un nodo
con un rechazo material auténtico, el director conserva su diagnóstico y pide
un cambio de método al planificador. Otro juez debe aprobar ese cambio y todas
las obligaciones normales del plan antes de autorizar nueva producción.

Se conservan requisitos, efectos y fronteras de producto originales, además de
los nodos ya aceptados completos. Se pueden añadir pasos justificados o cambiar
instrucciones, métodos, roles, dependencias y herramientas ya autorizadas de los
nodos no aceptados. Una renombración no basta; una diferencia textual tampoco
certifica una mejora semántica. El juez evalúa el motivo concreto del cambio.
La nueva ronda habilita el presupuesto original de intentos del método revisado;
no borra historial, no reduce criterios ni repone el techo global de inferencia.

Cuota, cierre desconocido, errores de cita, efectos inciertos y retiradas humanas
no autorizan una nueva producción mediante este protocolo. Las rutas selladas,
de copia nativa y documentales no se revisan automáticamente por esta vía. Si
una evidencia aceptada se retira durante la revisión, se detiene con
METHOD_RECOVERY_STALE antes de inferir o instalar sobre ese fundamento.
`report` muestra las rondas, rechazos, métodos y referencias como decisiones
históricas, sin certificarlas como mejora o vigencia externas.
El observador de dependencias conserva el primer intento global sin cambios y
añade `methodRevision` para la cronología de la revisión exacta. La aceptación
del plan nuevo debe preceder al primer actor de ese método, no al intento viejo.
El vínculo exige la ronda completada, plan instalado y contrato productor
exactos. Esa segunda cronología no satisface retrospectivamente una condición
del usuario que se aplique a los intentos anteriores o a todo el historial.
[Diseño, pruebas y límites](../reconstruction/design/REVIEWED-METHOD-RECOVERY.md).
Disponible opt-in en efbdb0e9, sin cambiar la política de misiones anteriores
ni declarar R06 completo.

La skill local `/home/cardeex/.codex/skills/sovereign-factory/SKILL.md` describe
el envío, consulta, seguimiento y recuperación a través del comando instalado.
El App Server local la encontró habilitada mediante `skills/list`, sin crear
un hilo ni realizar una inferencia: [registro](../reconstruction/verification/skill-discovery.json).
La selección de skills corresponde a Codex; ese inventario no garantiza su
selección en todo chat ya abierto. No redirige tareas ajenas a Sovereign ni
modifica las instrucciones globales. La skill puede invocarse como
`$sovereign-factory`. Los avisos posteriores requieren el mecanismo de seguimiento
de Codex: el daemon de cola no conoce ni publica en esta conversación.
