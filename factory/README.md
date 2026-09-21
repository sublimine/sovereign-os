# Sublimine Factory — reconstrucción en verificación

Núcleo nuevo y ejecutable de coordinación por productos, con fichas completas, adquisición de fuentes, revisión independiente, autoridad limitada, persistencia y aprendizaje versionado. **No es todavía la entrega completa ni un release de producción.** El prototipo rechazado no es su base.

El comando instalado verifica su propio paquete antes de abrir el estado. El
estado de una instalación, sus candidatos de desarrollo y sus recibos se
mantienen localmente: este repositorio no publica la memoria de misiones de un
operador. «Disponible» no significa activado por defecto ni cualificado para
todo dominio.

## Qué está implementado

- Catálogo trazable de las 154 fichas actuales: Ω24, Σ40, Π40 y 50 departamentales. Se seleccionan facetas por producto; no se crean 154 procesos ni un equipo fijo arbitrario.
- Mandato literal e inmutable, requisitos con citas de la petición, plan causal revisado y criterios observables. Las dependencias requieren productos aceptados para su finalidad y versión exactas.
- Inspección de fichas opt-in: consultas acotadas y durables antes del candidato, cobertura íntegra ligada a la petición completada y revisión independiente posterior. Disponible en el paquete efbdb0e9, sin activarse por defecto. No demuestra comprensión ni ahorro general. [Contrato operativo](OPERATIONS.md).
- Barrera de cierre de planificación en desarrollo: una respuesta retenida se mantiene privada hasta enlazarse a un cierre local CLOSED; ausencia, incertidumbre, manipulación o pérdida de retención bloquean consumo y reemplazo. El informe sólo observa ese estado y no filtra contenido en cuarentena. No está instalada ni acredita llamada física, exactly-once remoto, corrección o aceptación. [Contrato y límites](../reconstruction/design/PLANNING-CLEANUP-BARRIER.md).
- Propuestas estructuradas mediante Codex App Server oficial, autenticación ChatGPT y ninguna sustitución por API de pago. Workers sin entorno de ejecución; herramientas laterales cerradas.
- Broker separado para fuentes públicas UTF-8 y archivos del espacio de la misión. Recibos reales firmados localmente, protección de rutas/red, versiones y precondiciones de escritura.
- Fuentes recuperadas, hashes y pasajes exactos; hechos, inferencias, hipótesis y desconocidos separados. La retracción invalida también pruebas citadas mediante recibos y productos descendientes.
- Revisión en contexto separado, sin conversación privada del productor. El contenido lo juzga el revisor; independencia y ausencia de operaciones se comprueban por el motor en el mismo commit. No se pide una revisión previa de sí misma.
- Relectura independiente y comprobación síncrona del archivo antes de aceptar, consumir y volver a entregar. Un archivo prometido no puede acreditarse sólo con una frase.
- Ejecución nativa aislada integrada: snapshots desechables, sin red, límites reales de memoria/CPU/procesos/tiempo, cancelación y limpieza verificadas. El revisor repite las pruebas después del candidato. Un test fallido devuelve el código al productor, no a una revisión interminable del mismo defecto. [Contrato y pruebas](tools/EXECUTION.md).
- SQLite local, versiones inmutables, CAS, journal, bloqueo del coordinador y fencing. Cuota y reinicio conservan candidatos; un efecto incierto no se repite. Cancelación y salida del proveedor se observan.
- Presupuesto compartido opt-in: `--mission-call-limit` limita reservas lógicas de toda la misión, incluidos jueces, réplicas y búsquedas. No se reinicia al cambiar de actor o proceso y no cuenta reservas como llamadas completadas. Disponible en efbdb0e9; no es un techo de tokens ni está añadido al preset. [Contrato operativo](OPERATIONS.md#presupuesto-compartido-de-misión-en-desarrollo).
- Revisión del método opt-in: tras un rechazo material persistente, conserva el diagnóstico y las obligaciones; un plan causalmente distinto necesita su propia aceptación antes de otra producción. No restablece el presupuesto global. [Contrato y alcance real](../reconstruction/design/REVIEWED-METHOD-RECOVERY.md).
- Infraestructura opcional de aprendizaje: baseline, casos congelados, comparación con el padre, firma de observaciones, promoción autorizada, ámbito y rollback. La instalación todavía no tiene dominios configurados ni un overlay real promovido. El árbol de desarrollo añade procedencia firmada y protocolo 12 para dominios activables, pero esa ampliación aún no está desplegada; no se ha editado AGENTS.md global ni demostrado mejora general.
- CLI e informe de misión con roles, dependencias motivadas, criterios, revisiones, fuentes y contadores observados. El informe distingue datos históricos de una nueva comprobación externa.
- Cola persistente `submit`/`serve`, pausa/continuación/cancelación, exclusión de coordinadores y reintentos acotados de cuota, timeout o fallo transitorio tipado. [Operación y límites](OPERATIONS.md). El servicio de usuario está instalado y activo en esta VPS; su misión de cualificación se registra por separado.

## Ejecutar en un entorno propio

Para trabajo ordinario, usa el comando instalado: verifica su paquete antes de
abrir el estado. El árbol de este repositorio puede contener desarrollo posterior
a la versión en servicio. Comprueba `--version`, `service-status` y la política
de despliegue de tu propia instalación antes de mezclar ambos; no reinicies el
servicio con una cola ocupada.

```bash
SUBLIMINE_BIN="${SUBLIMINE_BIN:-sovereign}"
"$SUBLIMINE_BIN" --help
"$SUBLIMINE_BIN" queue
"$SUBLIMINE_BIN" service-status
"$SUBLIMINE_BIN" submit --file /ruta/privada/peticion.txt --request-id submission:ID_UNICO --preset adaptive-v2 --entry-mode bounded-read-response-v1 --bounded-read-presentation separate-evidence-v1 --parallel-pure-nodes 2
"$SUBLIMINE_BIN" status MISSION_ID
"$SUBLIMINE_BIN" report MISSION_ID --json
"$SUBLIMINE_BIN" roles sigma_08
```

Sustituir MISSION_ID por el identificador emitido. `resume` puede continuar trabajo y efectos autorizados pendientes; no es una mera consulta. `status`, `show`, `plan` y `report` no llaman al modelo. `show` muestra el estado guardado, no una revalidación del mundo.

La ruta e ID del ejemplo son marcadores, no archivos o envíos existentes.
Conserva texto completo, ID y opciones ante un envío de resultado incierto.
Comprueba primero que el --help instalado reconoce esas opciones. Esta selección
explícita conserva la petición completa: respuesta textual cerrada o una entrada
local acotada, revisión independiente y prueba fuera del cuerpo exacto solicitado.
Si requiere investigación, archivos de salida, ejecución o un proceso mayor,
deriva íntegra al plan. El techo de dos ramas puras no obliga a crear dos agentes.
No cambia modelo, esfuerzo, permisos ni intentos; las fichas conservan todos sus
campos. Respeta las elecciones explícitas y la política de misiones anteriores;
no añadas estas opciones a una reanudación.

La entrada `sourced-response-v1` está cualificada en desarrollo con una consulta
pública real y un contracaso del juez, pero no está instalada. Obtiene la fuente
antes del candidato y de su revisión; una cita auténtica no basta si la conclusión
está contradicha. No combines esa entrada con la presentación bounded del ejemplo,
no la selecciones contra una opción del usuario y verifica el paquete instalado
y sus capacidades antes de usarla.
Un caso aprobado y un rechazo controlado no prueban precisión universal ni ahorro.

Para desarrollo desde la raíz del repositorio, usa el runtime fijado y el
capturador de regresión, que no habilita inferencias live:

```bash
NODE_BIN="${NODE_BIN:-node}"
"$NODE_BIN" reconstruction/verification/run-suite.mjs
```

Estado por defecto: `~/.local/state/sovereign-factory/state.sqlite` y sus workspaces. `--state-dir` selecciona un directorio distinto. No introducir secretos innecesarios en peticiones; su texto y evidencias se conservan localmente y el contexto necesario se envía al proveedor oficial.

El modelo y el esfuerzo se configuran mediante `--model` y `--effort` al crear
una misión; la elección efectiva queda ligada al recibo de cada inferencia.
`--profile scoped-v1` selecciona un perfil compacto explícito con versión y hash;
el predeterminado sigue siendo `model-default`. Una comparación histórica de
cuatro casos redujo la entrada observada, pero no demuestra equivalencia general
ni un selector universal calibrado. Cada instalación debe comprobar su propio
servicio, cgroup y recuperación antes de atribuirle continuidad operativa.

## Evidencia y límites de publicación

Las ejecuciones reales conservan la petición, fuentes, adjuntos, recibos,
identificadores y contadores de una misión. Esos registros se mantienen en la
instalación privada que los generó y no se incluyen en un repositorio público.
El release sí incluye contratos, casos, oráculos y pruebas reproducibles. Una
ejecución local debe producir su propio informe verificable; nunca se debe
interpretar un resultado histórico ni un conteo de tests como una garantía
general de calidad, coste o disponibilidad.

Un corte histórico de regresión contabilizó 346 pruebas: 345 aprobadas y una
prueba live opt-in omitida. Sus recibos, entradas y hashes permanecen como
evidencia privada de operación y no se publican en este repositorio. Incluyó
revocación en la entrega asíncrona, validación integral de lotes, diagnóstico
exacto de citas, política durable del codec e historial autenticado de
operaciones entre productores. La protección posterior del arranque requiere su
propio corte de verificación. Los proveedores/HTTP simulados se identifican y
las pruebas nativas ejercitan procesos, archivos, SQLite y aislamiento reales.
`node reconstruction/verification/run-suite.mjs` genera un registro nuevo, sin
activar inferencias live. Un conteo de tests no certifica calidad general,
ausencia de defectos ni todos los métodos del catálogo.

Una cualificación histórica de desarrollo conservó fallos y recuperación de
revisión sin regenerar candidatos. Sus artefactos operativos son privados; la
fábrica no debe presentar ese antecedente como una certificación de rendimiento
actual ni como una mejora general de aprendizaje.

El [coordinador de aprendizaje](lib/LEARNING-CONDUCTOR.md) añade captura automática
de rechazos para ámbitos con evaluación registrada y un ciclo acotado de
diagnóstico → candidato → comparación → decisión. `learn-list` consulta sin
inferencias, `learn-observe` registra oportunidades y `learn-propose` genera como
máximo una propuesta, nunca su propia aceptación. El SDK permite ejecutar el
ciclo con un evaluador de dominio y autorización de promoción separados. No se
activa aprendizaje universal ni se inventan benchmarks para tareas desconocidas.

El motor de desarrollo conecta `learn-evaluate CICLO` con implementaciones de
evaluación registradas y `learn-evaluators` consulta su compatibilidad sin llamar
al modelo. El primer contrato, `exact-json-value-v1`, mide igualdad del valor JSON
completo contra respuestas congeladas; no sustituye un juez semántico. Requiere
la métrica exactMatch/higher/1 en todos los casos. Evaluar conserva la propuesta,
el dataset y el modelo/razonamiento; nunca propone de nuevo ni activa un overlay.
Un evaluador desconocido se rechaza antes de consumir la comparación. Los
dominios actuales de revisión no se convierten automáticamente a este criterio.

El bloque siguiente describe el **árbol de desarrollo**, no el wrapper instalado:
comprobar `sovereign --help` y la versión instalada antes de usar sus opciones
contra una base real. En ese árbol, `learn-register --file /ruta/privada/dominio.json` configura
un ámbito y sus casos sin escribir código SDK. Valida el manifiesto estructural
completo antes del registro, exige evaluador compatible, mejora y casos
separados de regresión; no inicia
propuesta/comparación/activación. Repetir el mismo dominio exacto es read-only;
cambiar su dataset o ámbito bajo el mismo ID se rechaza. [Contrato de registro](../reconstruction/design/LEARNING-DOMAIN-REGISTRATION.md).

Un dominio que pueda activar un overlay debe adjuntar una atestación de
procedencia por caso y el operador debe proporcionar una política Ed25519 externa
con `--provenance-policy RUTA` (o `SOVEREIGN_LEARNING_PROVENANCE_POLICY`). La
atestación vincula hashes de los expected/casos a fuentes ya admitidas y a un
labeler/reviewer de identidades criptográficas distintas; la política rechaza
reutilizar una misma clave pública con otro ID. Sus claves y roles no se toman
del manifiesto ni quedan almacenados como confianza del dominio; sólo se congela
su `policyId`, y el proceso que registra o usa el dominio debe volver a cargar
la política. En uso, el `policyId` de runtime debe coincidir exactamente con el
congelado en dominio y procedencia; reutilizar las mismas claves bajo otra
identidad de política se rechaza. Firma y fuente se vuelven a
comprobar en cada uso; una retracción bloquea el overlay. Esto acredita custodia
y revisión según política, no la verdad del expected, independencia humana ni
calidad/representatividad del dataset. Sin ella, el dominio ha de ser
`evaluation-only`.

Al evaluar un dominio atestado, cada caso y variante recibe antes del callback
una autorización durable ligada a evaluación/caso/variante/request/prefijo/ámbito
en la misma transacción de revalidación. No convierte la llamada al proveedor en
atómica. Tras el callback hay otra revalidación y el gate síncrono
`beforeComplete` corre dentro del commit de evaluación; sólo entonces se puede
ligar un prefijo reutilizable. Una revocación anterior bloquea el despacho; una
posterior conserva orden histórico tras la autorización y puede bloquear los
gates posteriores. Promoción y rollback vuelven a comprobar antes y después de
su cambio de puntero. Nada de ese historial acredita de nuevo una fuente, un
expected o una mejora.

Antes, `learn-validate --file /ruta/privada/dominio.json` comprueba el mismo
manifiesto **sólo estructuralmente** en memoria. Si recibe una política, también
comprueba su forma, pero no abre SQLite de destino, no reserva una identidad, no
verifica firmas con la política ni busca/revalida fuentes. Tampoco puede probar
que un expected sea correcto: es una puerta de revisión, no un registro ni una
inferencia.

`learn-status` ofrece una vista sólo lectura del ciclo de vida de cada ámbito:
registro, propuesta, evaluación y overlay activo. Oculta casos, expected,
prompts y payloads del proveedor; no llama modelos, no muta SQLite y no activa
punteros. También distingue una atestación almacenada de ámbitos no acreditados,
pero esa etiqueta no revalida firmas, fuentes ni revocaciones actuales; sólo el
runtime lo hace al intentar usar un dominio.
Un estado vacío significa exactamente que aún no hay evaluadores o
dominios configurados, no que exista aprendizaje implícito.

Una cualificación histórica de cola conservó su primer fallo y reanudó la misma
misión después de registrar observaciones operativas. Sus recibos permanecen
privados; no demuestran por sí solos eficiencia para una consulta breve.

`--parallel-pure-nodes 1..4` (SDK `maxParallelPureNodes`) habilita explícitamente
concurrencia limitada sólo para productos ya listos y sin herramientas ni efectos
en toda su ascendencia. Cada resultado se revisa por separado antes de consumo;
archivos, ejecución e investigación continúan exclusivos. El valor ausente mantiene
la planificación serial. [Frontera, recuperación y cualificación](../reconstruction/design/PURE-NODE-CONCURRENCY.md).

Codec opcional de contexto sin pérdida: identidad de texto, fuentes y metadatos comprobada por round-trip antes del envío; no se trunca nada ni se elude el límite lógico. En dos casos congelados, los cuatro resultados reales (con y sin codec) fueron correctos; entrada 14.827 frente a 12.600 tokens. No se generaliza a todas las revisiones. La cualificación de desarrollo lo prueba explícitamente; el predeterminado sigue siendo texto JSON ordinario.

La selección puede fijarse al crear/enviar una misión con
`--context-encoding lossless-v1` (SDK: `contextEncoding:'lossless-v1'`). Queda en
su política durable y se conserva en nuevos productores y revisores tras una
reanudación, sin depender de una variable del proceso anterior. Un mismo ID de
envío no puede cambiar esa selección. `plain-json` conserva la forma ordinaria;
no se reescriben misiones antiguas ni se activan promociones evaluadas para un
perfil diferente. Es una optimización explícita, no un resumen con pérdida.

La variante experimental `--context-encoding lossless-json-v2` extiende la
deduplicación al mismo texto contenido dentro de recibos serializados como JSON.
Sólo transforma cadenas reconstruibles byte a byte; no resume páginas ni oculta
pasajes. Conserva los límites de contexto lógico y los ámbitos de aprendizaje.
Puede volver al transporte v1/ordinario si no ahorra bytes. No cambia ninguna
misión anterior ni el valor predeterminado. Consulte el resultado real de su
cualificación en tu propia instalación antes de elegirla; los bytes ahorrados offline no prueban
ahorro de tokens o comprensión equivalente del modelo.

La opción `--context-encoding source-text-v1` añade al contexto
íntegro una vista literal de la petición ya autorizada, sin volver a escapar sus
caracteres como cadena JSON. No expone intención privada a las rutas ciegas,
no corrige respuestas y puede aumentar bytes/tokens. Está disponible en efbdb0e9,
sigue opt-in y no se activa en el preset; su mera disponibilidad no cualifica
la interpretación de todas las peticiones por el planificador.
[Alcance y diagnóstico real del selector](../reconstruction/design/SOURCE-TEXT-VIEW.md).

`--review-encoding evidence-refs-v1` selecciona por separado un catálogo de pruebas
en la salida del juez. Conserva cada criterio y expande las referencias antes de
la aceptación original; `expanded-json` sigue siendo el predeterminado. Un par
real conservó diez controles por variante con un ahorro integral pequeño, no
una mejora de coste general. [Contrato y mediciones](../reconstruction/design/REVIEW-ENCODING.md).

Una misión documental histórica con búsqueda real registró una búsqueda nativa,
una adquisición primaria, aceptación independiente y reentrada sin repetir
operaciones. Conserva una interrupción y la reparación de citas, sin regenerar
el candidato. Sus entradas y rutas de ejecución se mantienen privadas; este
release conserva contratos y pruebas reproducibles, no telemetría de una
instalación concreta.

La reparación acotada de citas de revisión conserva candidato, revisor y observaciones, sin repetir operaciones. Un resultado idéntico inválido detiene la reparación; un dato ausente puede terminar honestamente en UNKNOWN/RETURN. Ninguna reparación inventa un recibo o sustituye la comprobación del estado actual antes de aceptar.

## Pendiente antes de una entrega completa

1. **Ampliar desarrollo extremo a extremo.** La primera misión de desarrollo ya está completada y cruzada con un oráculo externo. Falta ampliar tamaño, diversidad, cambios de requisitos y recuperación en misiones más complejas. No se habilitó ejecución irrestricta ni se desactivó AppArmor globalmente.
2. **Evaluación de calidad y eficiencia en tareas representativas.** Los tests offline comparan rutas compactas/separadas conservando obligaciones. El diagnóstico de instrucciones base redujo entrada en dos consultas aritméticas, no demostró igual calidad compleja y no se adoptó como predeterminado.
3. **Misiones complejas reales:** investigación con contradicción, desarrollo con pruebas ejecutadas, estrategia, creación justificada de especialistas y medición de resultados de aprendizaje. Tener las fichas y contratos no equivale a haber ejercitado todas esas capacidades.
4. **Operación prolongada:** ampliar los ensayos del scheduler de cuotas/reanudación, reconciliación de efectos inciertos y observabilidad. Ya hay recuperación entre procesos reales, además de inyección de fallos y reapertura SQLite. El observador conserva muestras reales de identidad e integridad, separando cambios de versión/proceso; nada de eso se presenta como tres días de desarrollo continuo ni como un reinicio OS probado.
5. **Superficie de uso integrada:** CLI/SDK, reportes locales y skill `sovereign-factory` instalada y detectada por Codex. No es un canal independiente para cualquier aplicación ni un servicio de notificaciones al chat; el seguimiento conversacional usa los mecanismos propios de Codex.

## Decisiones y auditoría

- [Mandato R01–R16](../reconstruction/MANDATE.md)
- [Manifiesto de publicación](../RELEASE-MANIFEST.md)
- [Arquitectura y razones](../reconstruction/design/ARCHITECTURE.md)
- [Frontera adaptativa v3 y sus límites](../reconstruction/design/ADAPTIVE-ROUTING-V3.md)
- [Revisión de eficiencia](../reconstruction/design/EFFICIENCY-REVIEW.md)
- [Eficiencia offline](../reconstruction/design/EFFICIENCY-REVIEW.md)
- [Contrato de ejecución aislada](tools/EXECUTION.md)
- [Operación y límites](OPERATIONS.md)
- [Integración de aprendizaje](lib/LEARNING-SERVICE.md)

El borrador original y los cambios preexistentes del propietario se conservan en
su almacenamiento privado. Esta versión pública contiene el código, contratos,
pruebas y documentación publicables; no expone adjuntos, estados operativos ni
telemetría de una instalación concreta.
