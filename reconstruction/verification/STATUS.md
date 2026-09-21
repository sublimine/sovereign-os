# Estado de aceptación de Sovereign Factory

Actualizado: **20 septiembre 2026, desarrollo en curso**.
**Mandato completo pendiente.** [MANDATE.md](../MANDATE.md) conserva R01–R16.
Tests, productos conocidos e instalación no equivalen a perfección ni aceptación global.

## Trabajo activo

**Barrera de cierre del planificador en desarrollo; no instalada.**
El árbol de trabajo marca únicamente misiones nuevas de entrada `planned` con
`planning-cleanup-v1` y sube a protocolo SQLite 15 en la misma transacción de
creación. Antes de cada despacho conserva solicitud exacta/origen; una respuesta
estructuralmente válida queda retenida pero no pública hasta que un cierre local
`CLOSED` se enlace con esa respuesta, la configuración y la reserva de
inspección si existe. Un cierre ausente o no confirmado queda
`PENDING_CLEANUP`; una respuesta validada no retenida queda
`RECONCILIATION_REQUIRED`; un origen, enlace u orden alterado queda
`UNVERIFIED`. Ninguno autoriza consumo, reemplazo, refund ni una segunda
inspección sobre el mismo actor. La política íntegra se congela en el registro
de misión v1: quitar `planningContracts` o el marcador de limpieza no degrada
una misión v15 a la ruta heredada. Entre actores, un `NO_DURABLE_RESPONSE`
requiere además su token de fallo exacto, posterior al cierre, antes de reservar
o despachar sustitución. El informe `planningCleanup` no expone la respuesta en
cuarentena ni detalles del adaptador; `planningInspection` sólo proyecta acción,
motivo/cobertura o token de fallo tras lectores estrictos. Una discordancia con
la política v1 se muestra `UNVERIFIED` sin presupuesto; un ledger de inspección
alterado falla cerrado, no se maquilla como histórico. Las misiones realmente
históricas conservan `NOT_APPLICABLE` sólo cuando su admisión v1 no tenía este
protocolo y existe una solicitud identificable.

La regresión archivada anterior al endurecimiento actual cerró con
`node --test tests/factory/*.test.mjs`: **2377 tests / 2376 PASS / 0 FAIL /
1 SKIP**, 318757.318005 ms. Incluye SQLite real, caídas de proceso en origen,
respuesta y cierre, reentrada, informe JSON/texto de sólo lectura, alteración de
registros y el bloqueo de intentos anteriores no cerrados. Las 142 pruebas de
`engine.test.mjs` y las 50 pruebas CLI afectadas también pasaron por separado.
No acredita por sí sola los nuevos cierres de actor cruzado y degradación de
política; la regresión completa de este árbol sigue pendiente de cierre y no se
declara como completada aquí.
Los proveedores del corte son simulados cuando se indica; no se ha hecho
inferencia live, instalación, reinicio del servicio ni cambio de una cola real.
El cierre local no acredita llamada física, entrega remota exactly-once, liveness,
corrección semántica, aceptación ni cumplimiento completo de R14. Véase
[contrato y límites](../design/PLANNING-CLEANUP-BARRIER.md).

**Validación de aprendizaje instalada y auditada, sin aprendizaje activado.**
El release `e3dfb8244d2637df7c744f990d45579af153375d787435d7e04b930831c51b4c`
añade `learn-validate --file`: ejecuta la misma validación estructural del
manifiesto y sus casos dentro de SQLite `:memory:`, antes de abrir el motor o
el estado productivo. Sólo devuelve metadatos seguros. Un resultado `VALID` no
registra ni reserva nada, no detecta conflictos con producción y no certifica
la verdad de los `expected`, cobertura, ausencia de contaminación o preparación
del evaluador. Conserva `learn-status`, proyección sólo lectura que no expone
casos/esperados, propuestas ni payloads de proveedor y declara `providerCalls: 0`,
`stateChanges: 0` y `automaticActivation: false`. La regresión completa
`suite-wdKawU` cerró con **2210 tests / 2209 PASS / 0 FAIL / 1 SKIP**,
`inputsStillMatch` y archivo de entradas íntegros. El paquete verificado tiene
447 archivos y 24.403.028 bytes; roles 154, ninguna misión activa y servicio
canónico activo/enabled con PID 3971116 (`NRestarts: 0`). El backup privado
previo es `/home/cardeex/.local/state/sovereign-factory/backups/before-e3dfb824-validate/state.sqlite`
con hash `e98b9be0e9ead27d24f2d7a503640841ab118c394e6adc334b0be8ed6733dac6`.
La consulta instalada devuelve 0 ámbitos, 0 propuestas y 0 evaluaciones: no se
han creado dominios ficticios ni overlays. [Auditoría de despliegue](runtime-deployment-e3dfb824-suite-wdKawU.json).
La muestra posterior `soak-sample:e4c71492-e3c6-440e-aa93-4b0daa4b14a6`
observó el release nuevo con `SAME_FILE` del ejecutable Node, PID 3971116,
owner epoch 25, journal 434 y misión histórica COMPLETED. El acumulado queda
en 59 muestras / 55 saludables / 4 fallidas, estado OBSERVING: la sustitución
del proceso y el hueco de observación reinician el segmento; no acreditan 72 horas.
La coartada de enrutamiento `registro → evaluación → resolver → worker` queda
documentada en [LEARNING-ROUTING-AUDIT](../design/LEARNING-ROUTING-AUDIT.md),
con fuentes y pruebas exactas; no cambia el estado vacío de producción.

**Registro declarativo corregido, instalado y auditado; no aprendizaje operacional.**
Nuevo334744c8b9288113b1f8aa9d928bef23f17dc70dd796c8d11b2d6abc89d07e1b,
446archivos/24.394.723bytes. `learn-register --file` valida ámbito y casos en
memoria ANTES de construir el motor; registro atómico, repetición exacta
read-only, conflicto conservado. Exige evaluador compatible, mejora y holdout;
no registra casos ficticios en producción ni lanza inferencias/activaciones.
SDK previo intacto, mismo piso11 y mismo significado del evaluador JSON.
Primera implementaciónc451 pasó124dirigidos y globalqdB6Bw
2201tests/2200PASS/0FAIL/1SKIP, auditada23:43:54.234 con374inputs íntegros.
La comprobación posteriorg3nQ8b descubrió inicialización de Authority sobre
una base vacía antes de rechazar el archivo. Tres nuevos tests fallaron;
corregido mediante preflight antes de FactoryEngine.64dirigidos finales PASS,
24594.144079ms. C451 no se instala y sus pruebas no acreditan esta corrección.
[Negativo y corrección](REGISTRATION-PREFLIGHT-CORRECTION.md),
[resultados](experiments/learning-registration-empty-corrected.json).
PaqueteRotqPT:10CLI reales con proveedor/fetch bloqueados; valida los tres
rechazos sin cambio sobre base vacía y luego registra sólo un dominio privado,
legible por08498, con idempotencia/conflictos y cero llamadas. Auditoría
23:47:45.521 aprobada:6versiones/protocolo11/diario7, owner ausente y base
intacta. No es aprendizaje real. [Auditoría](runs/domain-registration-RotqPT/post-close-audit.json).
Globalsr2IvH/51100 cerró23:52:42.686:2204tests/2203PASS/0FAIL/1SKIP,
399243.01963ms;374inputs/3.622.363bytes archivados antes del ensayo y cuatro
streams exactos. Auditoría23:53:10.455 con owners ausentes. Resumen
bb9e1e243569a15c2b3c5acf596f15128b2637327a7bcc37f8422362efc9bb85.
El único SKIP es LIVE opt-in; no se declara nueva inferencia real.
[Regresión auditada](runs/suite-sr2IvH/post-close-audit.json).
Copia históricaKmpL4Z auditada23:53:29.585:08498→334744→08498 conserva
las173versiones originales y58heads materiales;180registros en la copia,
protocolo2/diario438. Cero proveedor/broker, tres procesos cerrados, original
intacto. No acredita rollback después de activar protocolo11 ni cargas activas.
[Copia auditada](runs/registration-upgrade-copy-KmpL4Z/post-close-audit.json).

Instalación controlada23:58UTC siguiendo las [puertas previas](REGISTRATION-RUNTIME-PROMOTION-PREFLIGHT.md):
cola ociosa comprobada, antiguo escritor ausente, backup privado coherente
de174versiones y cambio exclusivo de punteros. Runtime334744 activo/enabled,
PID3012448, único holder;175versiones finales,58heads materiales conservados,
protocolo2/diario430/head03e0227a8c8c83eac51194d8c28a6d1b012e0fb400c543eaf547638dc3ed1666.
Se conservan173versiones previas y sus hashes; sólo dos nuevos registros de
liberación/adquisición de cola. Ayuda, cola, informe humano/JSON completo y
learn-evaluators ejecutados. Cero misiones nuevas, inferencias, efectos o dominios
registrados. Auditoría23:59:29.184 aprobada; backup y08498 conservados.
[Instalación auditada](runs/registration-runtime-installation-EwvEW1/post-install-audit.json).
Skill incorpora registro por archivo con expected/ámbito justificados, sin
inferencias ni activación implícitas; conserva antes/después y validación
estructural PASS. No es prueba de aprendizaje real o del comportamiento del modelo.
[Validación](runs/registration-runtime-installation-EwvEW1/skill-validation.json).

**Instalación anterior08498 auditada, sustituida por334744 arriba.**
Transición controlada23:17–23:18UTC tras cola ociosa, regresión archivada,
prueba CLI y copia histórica. Conserva las171versiones originales y58heads
materiales;173finales sólo por release/acquire del propietario de cola.
Protocolo2,diario428/head2b17f4b3d5a6e689f5f2a92ab7b642ae097e5e8d9d4b60038ba626a6eb38f986.
PID2981172/start61182602, propietarioepoch22, único holder de la base;
gestor canónico active/enabled/NRestarts0. Backup privado coherente después
de parar el anterior; éste permanece conservado. Cero nuevas misiones,
inferencias, efectos o dominios de aprendizaje. Ayuda, cola, informe JSON
completo y evaluadores consultados; una captura truncada se conserva y se
distingue de su consulta completa posterior. Auditoría23:18:57.288 aprobada.
[Instalación auditada](runs/integrated-runtime-installation-aINdRc/post-install-audit.json),
[decisión previa](INTEGRATED-RUNTIME-PROMOTION-PREFLIGHT.md).
Copia privadaIkTtq8 auditada23:09:41.495:0ec8→08498→0ec8 conserva el
historial material y protocolo2, cero proveedor/broker; no acredita rollback
de una base con protocolos10/11. El EISDIR de preparaciónK6TRCq se conserva.
[Auditoría de copia](runs/registered-evaluator-copy-IkTtq8/post-close-audit.json).
Skill actualizada: Codex selecciona respuesta local acotada, pregunta pública
con adquisición/revisión o planificación según el encargo completo, conservando
opciones explícitas. No es un clasificador autónomo de la CLI. Aprendizaje
explícito distingue consulta de compatibilidad, propuesta y comparación sin
activación. Bytes anteriores y posteriores guardados; validación estructural
aprobada con Python del sistema (el entorno graphify carecía de PyYAML).
No es una prueba independiente del comportamiento de la skill.
[Validación](runs/integrated-runtime-installation-aINdRc/skill-validation-system-python.json).

**Evaluador ejecutable conectado al motor y CLI; componente cualificado.**
Paquete08498be9bf76aefd2fcf4a3d21b354abe8326f01b7b622568119235244d2e1a3,
444archivos/24.385.545bytes, instalado después de estas pruebas. `learn-evaluators` consulta
compatibilidad; `learn-evaluate` compara una propuesta guardada, sin proponer,
activar, exportar ni cambiar el modelo/razonamiento congelado. Registro cerrado
`exact-json-value-v1`: igualdad JSON completa, exactMatch/higher/1, no juez
semántico ni validación general de JSON Schema. Se conserva expected fuera del
input; desconocido/incompatible no consume evaluación. Reentrada terminal sin
escrituras; comparación interrumpida no se repite. Primero se observó ausencia
de integración (1FAIL);89dirigidos PASS; la CLI detectó dos errores del montaje
de pruebas (ruta y aserción demasiado amplia), corregidos sin relajar producción.
Selección final **111PASS/0FAIL/7906.406172ms**, toda inferencia SIM.
Global **suite-VhkSft/81692** cerró23:02:31.334 y se auditó23:03:31.461:
2171tests/**2170PASS/0FAIL/1SKIP** en434254.719138ms,372inputs/3.605.059bytes
archivados antes del ensayo, cuatro streams exactos; owners2966884/2966916
ausentes. Resumend5cbca5a730bc22563a98f1e3b6c1d8d96870989edb37fd9dc2cbdb523c2c9be.
[Regresión auditada](runs/suite-VhkSft/post-close-audit.json).
Prueba empaquetada **registered-evaluator-ZoQ6Wu/2370**
cerró22:59:10.139:dos dominios, ocho procesos CLI, una propuesta y cuatro
comparaciones SIM; baseline permanece activo, dominio desconocido PROPOSED.
Diario65/head79d6b6a7bb8739c99500406f54a39f7f11afdac1a8fa9d60663b87352faf0ad6.
Auditoría posterior23:00:15.902:59versiones, cuatro métricas recalculadas desde
respuesta/expected, peticiones reconstruidas, firmas y cierres verificados,
owner y ocho children ausentes; base sin cambios. Resumen
63306351d2f8d336ba6b49cff0d8f91759b0958709d8cf73be1d17ba7b6588fe.
[Auditoría del paquete](runs/registered-evaluator-ZoQ6Wu/post-close-audit.json).
Cero modelos reales o mejora real en esta cualificación SIM; instalación posterior arriba.
[Contrato](../design/REGISTERED-LEARNING-EVALUATOR.md),
[resultados dirigidos](experiments/registered-learning-evaluator-directed.json).

**Ámbito sourced de evaluación aislada cualificado como componente.**
Candidatoadc3052587283678af03925e2ae3c23258e86ea7b7e7c31518956cf2d36e82d1,
443archivos/24.376.819bytes, NO instalado. Admite exactamente un discriminador
de revisor reconocido y sólo evaluation-only; conserva batch/hash del presupuesto
y todo el ámbito. No cambia WorkerService, autoridad ni promoción.15pruebas
previas11PASS/4FAIL confirmaron ausencia de admisión; tras implementar,81pruebas
dirigidas PASS/1613.460474ms, cero inferencia real. Global **suite-qHW0wG/53795**
cerró22:33:47.031 y se auditó22:35:11.051:2140tests/2139PASS/0FAIL/1SKIP,
427145.224957ms,368inputs/3.574.867bytes archivados prospectivamente y
cuatrostreams exactos. Owners2951041/2951055 ausentes. Resumen
35063b5a2295344548ee75abe770fde1e836a4b2a396f0cde5b1dd36668f9737.
[Regresión auditada](runs/suite-qHW0wG/post-close-audit.json).
[Negativo previo](experiments/sourced-review-learning-scope-first-red.json),
[dirigidos](experiments/sourced-review-learning-scope-directed.json).
Componente **sourced-review-learning-wx5JNg/79051** cerró22:28:44.546 y se
auditó22:31:12.612:dos dominios/ámbitos históricos completos, cuatro callbacks
locales de construcción exacta, ambas variantes iguales, SIN mejora.16bloqueos
de promoción/rollback/export enadc y54dc; el antiguo sí lee el ámbito y mantiene
evaluation-only, no se afirma que rechace su lectura.27versiones/diario35 privado
intacto; nuevepins y dos bases fuente conservados; cero proveedor/instalación.
[Auditoría del componente](runs/sourced-review-learning-wx5JNg/post-close-audit.json).
No es un evaluador semántico ni aprendizaje operacional. La integración ejecutable
posterior se describe arriba; estos dominios de revisión conservan sus criterios
originales y no se convierten a igualdad JSON para conseguir una aprobación.

**Medición retrospectiva del contexto con fuentes, sin optimización aplicada.**
5yCQsa cerró22:33:59.159:cuatro llamadas reales históricas, excluidos los dos
productores SIM.79.720tokens de entrada/7.323salida/87.043total observados;
195.102bytes input/52.594instrucciones/24.520schema. V2 ya reduce142.368→54.107
bytes del segundo productor y199.335→67.411 del juez positivo conservando todo.
Cambiar mínimo a256 sólo reduce29/1580/1580bytes en las tres exposiciones grandes;
el primer productor no cambia. Son3189bytes, no tokens. Joint experimental
ofrece717/3902/3915bytes de input, sin contar instrucciones adicionales ni
comprensión. No rehabilita sus pruebas LIVE negativas ni se integra.
[Medición íntegra](runs/sourced-context-measurement-5yCQsa/summary.json).

**Exportación de dominios corregida y cualificada como componente.**
Candidato54dc10f68590d90ed5448f3972e28c569f1312c553b69a16c091d9a407dd9c14,
443archivos/24.374.006bytes, NO instalado. Un export nuevo identifica rol real,
dominio/política y ámbito/dataset/targets, manteniendo permiso/CAS. Un export
histórico sin formato permanece exacto e idempotente. Archivos editados no se
sobrescriben. La hipótesis de colisión se REFUTÓ: el hash ya incluye policyId;
la ruta no se cambió. Negativo1/0PASS/1FAIL fue falta de metadatos del rol real,
no colisión.46dirigidos PASS; ampliación99PASS/1509.988765ms, luego99PASS/
1737.20903ms con comprobación reforzada de base íntegra en relectura histórica.
Global **suite-BHZEiZ/9212** cerró22:23:19.624 y se auditó22:24:38.529:
2125tests/2124PASS/0FAIL/1SKIP,453038.962436ms;367inputs/3.567.117bytes
archivados prospectivamente, cuatrostreams exactos y owners2940208/2940288
ausentes. Resumenb4e0ced5cf296626d7a668e99c182f2236e17a333d239b3f60c46078045cf9ac.
[Regresión del export auditada](runs/suite-BHZEiZ/post-close-audit.json).
El ámbito sourced de evaluación se añadió después; no lo acredita este corte.
[Negativo preservado](experiments/learning-domain-export-first-red.json),
[selección previa a refuerzo](experiments/learning-domain-export-directed-before-strengthening.json),
[compatibilidad prerregistrada](experiments/LEARNING-DOMAIN-EXPORT-PREFLIGHT.md).
Paquetes **learning-domain-export-CMUjrg/79802** cerrados22:18:20.284 y auditados
22:19:40.231: antiguo4456 crea formato histórico;54dc lo conserva y exporta otro
dominio con metadatos;4456 rechaza reexportar el nuevo conEXPORT_CHANGED sin
escrituras;54dc relee ambos idempotentemente. Dos promociones y cuatro callbacks
son SIM explícitos, cero modelos reales.32versiones/diario44 privado intacto.
[Auditoría de exports](runs/learning-domain-export-CMUjrg/post-close-audit.json).
Inspección posterior **sourced-learning-scope-Uij350** cerrada22:21:26.831:
dos requests reales históricos del juez, prefijo9700bytes y petición recompuesta
exactos, pero54dc rechaza inscribir sourcedResponseReview incluso evaluation-only.
Bases fuente/diarios129 y98 intactos; cero inferencia, replay o registro operacional.
El segundo request revisó un productor SIM; no se declara error real para aprender.
Siguiente componente: admitir este ámbito íntegro sólo en evaluación aislada,
sin quitar el discriminador ni habilitar overlays. Los hashes de presupuesto
de los dos casos son distintos: no se agrupan por tener el mismo prefijo.
[Diagnóstico](runs/sourced-learning-scope-Uij350/summary.json),
[contrato previo](../design/SOURCED-REVIEW-LEARNING-EVALUATION.md).

**Dominios separados: regresión y compatibilidad cerradas; exportación en revisión.**
Snapshot4456a49bb6327ffa694ab1516b7db588ddd5d43da117c0b9a28677920c295c87,
443archivos/24.372.364bytes, NO instalado. API registerDomain separa ficha y
policyId; dataset/ámbito/targets/autoridad propios, sin solapamiento ni mezcla de
overlays. Protocolo11 sólo al inscribir, IDs legacy conservados. Conductor y
configuración histórica guardan política/rol real; observaciones nuevas exigen
target completado y excluyen SIM salvo opción explícita de prueba. Exclusiones
adaptativas y evaluation-only permanecen. No hay dominio operacional acreditado.
84dirigidos legacy PASS; primer test nuevo10/9PASS/1FAIL por faltar workspaceRoot
en la fixture, corregido. Selección94PASS y selección ampliada final96PASS,
1758.339855ms, sin modelos reales. Global **suite-p1Ta1T/88785** cerró22:07:05.093:
2122tests/2121PASS/0FAIL/1SKIP,427215.51198ms. Auditada22:07:49.513;
367inputs/3.561.625bytes archivados prospectivamente, cuatrostreams exactos,
owners2927508/2927521 ausentes. Resumen0bbd32a74e593a37832267313d2bca2be5ae88d29ac2b76ee1449c49ddab29ef.
Paquetes reales **learning-domain-protocol-qyTNIO** cerraron22:01:40.356:
dos dominios/mismo omega_22, protocolo11;50a anterior rechaza abrir y escribir
registro/evento desde una conexión previa. Diario14 privado, primera fila legacy
intacta; cero proveedor/broker/promoción/instalación. Auditoría posterior22:09:39.210
PASS, base intacta,12versiones/diario14 y ambos dominios verificados.
Copia histórica **learning-domain-upgrade-copy-W6UYfG/83987** cerrada y auditada
22:10:21.301:171versiones originales/58heads materiales preservados;178versiones
finales privadas, diario436. Tres procesos0ec8→4456→0ec8 cerrados sin
proveedor/broker. Origen171versiones/diario426/protocolo2 intacto; no prueba
rollback de una base que ya activó11 ni instala el candidato.
[Regresión auditada](runs/suite-p1Ta1T/post-close-audit.json),
[protocolo auditado](runs/learning-domain-protocol-qyTNIO/post-close-audit.json),
[copia auditada](runs/learning-domain-upgrade-copy-W6UYfG/post-close-audit.json).
La comprobación posterior descartó colisión porque el hash ya incorpora la
política. Se corrigió sólo identificación/ámbito del AGENTS exportado, en54dc;
este corte4456 no acredita ese cambio posterior.
[Paquete](runs/learning-domain-protocol-qyTNIO/summary.json),
[contrato previo](../design/LEARNING-DOMAINS.md).

**Inspector actualizado; regresión correspondiente cerrada.**
El perfil sources muestra cronología real visible, candidato, dictamen, fuentes
crudas íntegras, contrato propio e instrucciones históricas de productor y juez.
Caso xPHjHG:3 llamadas reales/ACCEPT;01EeX4:2 productor SIM/1 juez real/RETURN,
sin entrega ni planificación ejecutada. No simula un flujo ni certifica toda la fábrica.
Chrome hintNS cerró21:42:26.858 PASS en360/736px y claro/oscuro, ambos casos,
fichas/pruebas desplegadas y hash de instrucciones comprobado; cero errores de
página/desbordamiento. Se conserva Xpk89G fallido por omitir el prefijo review:,
corregido sin rebajar la expectativa de dos instrucciones históricas.10dirigidos
PASS. Snapshot224836bytes/SHA b3faf0a1fd9e35332963bc49034a7040381f64333b22eb68e2f6c8b80e2c3efe.
[QA actual](runs/source-inspector-qa-hintNS/summary.json),
[historial y alcance](../visualization/README.md).
Global **suite-9qNicg/37562** cerró21:50:08.097 y se auditó21:50:19.537:
2110tests/2109PASS/0FAIL/1SKIP,418068.222453ms;366inputs/3.543.999bytes
archivados antes de los tests, cuatrostreams exactos y owners2914719/2914777
ausentes. Resumen1c77c0a7848d4966aeaab184b11d59e251c491ac0f8f697656d92f158602e231.
[Auditoría del corte](runs/suite-9qNicg/post-close-audit.json).
El corte anterior FnBRLP queda histórico con sus bytes originales archivados;
no se le atribuyen los cambios posteriores de presentación.
La consulta instalada learn-list volvió a dar[]; no se ha configurado un dominio.
Diagnóstico aislado0jwFUq cerrado21:49:37.832: confirmado un único ámbito por rol;
segunda finalidad rechazada conLEARNING_EXISTS y primer registro intacto.
Comienza la separación explícita rol/dominio con contrato previo, sin instalar:
[diseño](../design/LEARNING-DOMAINS.md),
[diagnóstico cerrado](runs/learning-domain-cardinality-0jwFUq/summary.json).
Cuota observada21:44UTC:96% semanal consumido/4% restante, sin créditos/reset;
no se inició inferencia durante esta ampliación del inspector.

**Archivo prospectivo de regresión integrado; corte cerrado y auditado.**
Las entradas ahora se conservan byte a byte antes de lanzar los tests, además de
los hashes/streams. La validación final comprueba archivo y árbol actual por
separado; un0del proceso no basta si falla integridad. El consumidor comprueba
el archivo, resumen y streams también al verificar frozen. No es snapshot del OS
ni prueba de ausencia de cambios/restauraciones externas durante la ejecución.
22dirigidos iniciales PASS; guard inicial5/3PASS/2FAIL corregido; selección30PASS.
Una prueba adversaria posterior encontró que quitar TODOS los campos nuevos
permitía fingir un resumen legacy: probe positivo y test6/5PASS/1FAIL conservados.
Corregido mediante el módulo de archivo ya presente en el mapa de entradas;
31dirigidos finales PASS/767.065249ms. No se cambia el criterio para admitirlo.
Global **suite-FcSjCi/10794** interrumpida deliberadamente21:14:52.409 mediante
SIGTERM al owner verificado, antes de cambiar código. Auditada21:16:25.839 como
INTERRUPTED_NOT_QUALIFIED: ambosowners2893464/2893527 ausentes; los
364inputs y3.526.735bytes archivados íntegros, cuatrostreams coincidentes; no
conteo final ni pase de regresión. Servicio2817012/0reinicios conservado.
La nueva global **suite-FnBRLP/81680**, iniciada21:16:55.841, cerró21:25:04.691
y fue auditada21:26:09.217:2104tests/2103PASS/0FAIL/1SKIP,
485921.658064ms. El SKIP es el smoke oficial LIVE desactivado explícitamente.
Ambos owners2899233/2899261 ausentes; cuatrostreams exactos. Archivo prospectivo
364inputs/3.527.161bytes, capturado antes de lanzar el hijo; integridad de archivo
y árbol comprobada por separado. Resumen SHA b71f069869ad51036129629f70a43a9bb23302d64f574bbcf671810ed7d6832c.
Seis controles posteriores sobre COPIAS privadas, **regression-consumer-negatives-3rKGrW**,
cerraron21:26:28.180: alterar blob, manifiesto, integridad final, borrar todos los
campos nuevos, vínculo de inicio o TAP provoca frozen=false y rechazo de nueva
cualificación. El original sigue intacto. Son fixtures adversarias, no seis
regresiones adicionales ni evidencia semántica de productos.
[Corte auditado](runs/suite-FnBRLP/post-close-audit.json),
[controles del consumidor](runs/regression-consumer-negatives-3rKGrW/summary.json).
Runtime **50a629c2cb574679d8b31b9d5461b33ba9e114e312078aa0f9c1f155298bd84b**,
443archivos/24.365.810bytes, sólo README difiere de fdf: código del motor intacto.
Guía de uso corregida a la selección instalada adaptive-v2/bounded/presentación
separada; distingue aprendizaje no configurado y entrada con fuentes no instalada.
No instalación ni nuevas inferencias en este cambio de verificación/documentación.
Trabajo posterior: actualizar el inspector histórico para entradas con contrato
propio y fuentes; no sustituye el mandato ni modifica los casos cerrados.
[Diseño](../design/REGRESSION-INPUT-ARCHIVE.md),
[pruebas](experiments/regression-input-archive-directed.json),
[corrección del downgrade](experiments/regression-archive-downgrade-fix.json),
[corte interrumpido](runs/suite-FcSjCi/post-close-audit.json).
El corte previo t5pMx9 conserva sus362archivos fuente por hash,3.509.474bytes, en
ZLVMZY: captura posterior explícita21:04:19.414 y auditoría independiente21:12:56.097.
No se inventa una captura anterior al ensayo ni se reejecuta el corte.
[Archivo histórico auditado](runs/sourced-closed-inputs-ZLVMZY/post-close-audit.json).

**Entrada factual pública: un caso real y copia histórica cualificados; no instalada.**
`sourced-response-v1` conserva una pregunta pública completa, adquiere fuentes y
somete su candidato al juez independiente antes de entregar. El criterio de
respaldo debe citar cada fuente utilizada en claims; presencia en contexto no
basta. Contrato propio íntegro, ficha omega_22 completa, sin overlays y sin cambiar
presets/modelo/razonamiento. Límites de vía compartidos entre recuperaciones:
una búsqueda opcional/dos adquisiciones íntegras de65.536bytes; no prueba de calidad
ni techo global. Fuera de alcance pasa íntegra al plan, con historia preservada.
Protocolo10 desde creación; paqueteB35WpL cerrado20:25/auditado20:29:51.847:
ejecutor d77 real rechaza apertura y escritura previa sobre10;3versiones antiguas
preservadas/5finales, diario7 privado, cero inferencias/efectos. La CLI usa la
opción de entrada existente, nunca al reanudar.
Candidato **fdf7a1957d301e4d5e03636263dbaa8e5c2b5027218ce9a3a6b5e9af3eec77e8**,
443archivos/24.364.784bytes, NO instalado. Dirigidos35PASS/ceroFAIL,
24658.50842ms; CLI4PASS/ceroFAIL,2226.598098ms, cero inferencias/red.
Se conservan negativos iniciales1FAIL y18tests/13PASS/5FAIL: falta de compatibilidad
del ledger de herramientas con10 y repetición de candidato inválido sin derivar.
Tras corregir esos puntos,91PASS en selección cruzada. Ampliación45/44PASS/1FAIL
detectó clasificación demasiado fatal de una referencia no observada; ahora es
un error de propuesta corregible, nunca una fuente admitida. No criterios rebajados.
Global **suite-8zFoem/42486** cerrado20:32:47.842, auditado20:34:27.773:
2079tests/2077PASS/1FAIL/1SKIP,587451.464641ms;362pins/cuatrostreams exactos,
owners2862642/2862655 ausentes. Fallo: test suponía orden productor/juez por UUID.
Su archivo original queda retenido conSHA8333ba22214dac3a22b56ad9e47498410cd9f4b31f9c72433b247cd07007a61d.
Corregida sólo la selección del test mediante IDs del productor y dictamen;
dirigido1PASS,1237.918203ms. No se cambió el runtime ni la aceptación.
Segunda global **suite-t5pMx9/83062**, cerrada20:43:26.577, auditada20:43:45.819:
2079tests/2078PASS/0FAIL/1SKIP,493971.312918ms;362pins/cuatrostreams exactos,
owners2873555/2873565 ausentes. SHA de resumen32a2097712b9d74a372683128273a24a89f0325d2428b74230706a99b27043af.
SIM **sourced-response-sim-3QBwFG**, tres inferencias y una adquisición simuladas,
cinco comprobaciones estructurales aprobadas; auditado20:44:20.703 con diario88
intacto/citas propias del juez/reentrada sin otra actividad. No acredita LIVE.
Prueba real **sourced-response-live-xPHjHG/74412** cerrada20:47:29.135,
auditada20:48:06.663: tres inferencias reales, una adquisición oficial completa,
cuatro citas de fuente del juez y reentrada sin actividad; diario129 intacto.
JSON conocido aprobado, fuente42.143bytes/f3467b53, ficha completa omega_22.
El juez cita también la excepción relevante, no sólo la frase favorable.
59.082tokens observados en contadores de cierre/161.526ms; no coste integral,
ahorro comparado ni eficiencia universal demostrados. Cero correcciones/retry
notificado; un warning redactado por llamada no permite inferir su contenido.
Caso/prerregistro/runner fijados antes de SIM; sólo source.fetch,6reservas máximas,
misma petición/Astra/ultra. Cuota previa20:44:20:94%consumido/6%restante semanal;
sin créditos/reset/API. No es holdout, comparación de eficiencia o aceptación global.
[Contrato](../design/SOURCED-RESPONSE-ENTRY.md),
[historial de desarrollo](experiments/sourced-response-development-tests.json),
[dirigidos finales](experiments/sourced-response-final-directed.json),
[CLI](experiments/sourced-response-cli-directed.json).
[Regresión fallida conservada](runs/suite-8zFoem/post-close-audit.json),
[rechazo por paquete anterior](runs/sourced-protocol-B35WpL/post-close-audit.json).
[Regresión cerrada](runs/suite-t5pMx9/post-close-audit.json),
[SIM auditado](runs/sourced-response-sim-3QBwFG/post-close-audit.json),
[prerregistro real](experiments/SOURCED-RESPONSE-LIVE-QUALIFICATION.md).
[Auditoría real](runs/sourced-response-live-xPHjHG/post-close-audit.json),
[alcance semántico](runs/sourced-response-live-xPHjHG/semantic-disposition.json).
Copia histórica **sourced-entry-upgrade-copy-bJPQPk/29887** cerrada y auditada
20:48:29.475:171versiones originales/58heads materiales intactos;178versiones
finales sólo con reubicación privada/control. Tres ejecutores reales separados
0ec8→fdf→0ec8 cerrados, cero intentos de proveedor/broker, protocolo2 conservado;
origen171/diario426 intacto, copia diario436. No rollback tras optar por10.
[Copia auditada](runs/sourced-entry-upgrade-copy-bJPQPk/post-close-audit.json).
Contracaso **sourced-countercase-live-01EeX4/73809** cerrado20:59:47.984,
auditado21:01:32.302: productor SIM controlado, adquisición HTTP real y un juez
real/Astra/ultra. La cita favorable existe, pero el juez identifica la excepción
material: RETURN, complete-request FAIL/source-support FAIL, candidato RETURNED,
ninguna entrega y derivación ordinaria al plan. El harness pausa antes del plan:
no acredita una corrección ejecutada.27.961tokens observados de un cierre real,
diario98 intacto, adquisición seq36<candidato49<juez52. SIMxpUN7P/30775 pasó
previamente y fue auditado20:57:51.727. No es holdout ni tasa general de precisión.
[Protocolo](experiments/SOURCED-REVIEW-COUNTERCASE.md),
[auditoría del contracaso](runs/sourced-countercase-live-01EeX4/post-close-audit.json).
Calibración amplia, coste total y aceptación global siguen pendientes; no repetir
ninguno de estos casos para mejorar una nota.

**Evaluación aislada de ámbitos actuales cualificada como componente; no instalada.**
Dataset opcional `policy.activation: evaluation-only`, inmutable. Admite conservar
los campos de ámbito del juez bounded sin activar overlays ni ampliar los
contratos de los trabajadores. El conductor conserva una aprobación experimental
como EVALUATED_ONLY, no READY_FOR_PROMOTION; reentrada sin nuevas comparaciones.
Dirigidos88PASS/ceroFAIL,1594.596081ms, sólo callbacks/propuestas SIM. Negativo
inicial21/0PASS conservado; tras corregir la suposición del fixture sobre el
registro inicial de Authority,15PASS/6FAIL acreditan la función todavía ausente.
Candidato **d77de83e3d38f2d0754b50fdf60cad45fe4efbeaf6a4a98c6f2838d0915e5c12**,
440archivos/24.328.887bytes, NO instalado. GlobalRwCzKm/71141 cerrado19:46:29.655,
auditado19:47:27.053:2040tests/2039PASS/0FAIL/1SKIP,521023.410259ms;357pins y
cuatrostreams exactos, owners2843870/2843881 ausentes. El SKIP es el smoke LIVE.
Cualificación localqqiFSS cerrada19:42:16.513: cuatro requests históricos exactos,
ocho callbacks de construcción, cero proveedor; comparación aprobada SIN mejora.
Cinco comprobaciones de bloqueo: actual servicio/registro rechazan activar;
paquete2898 real rechaza evaluar/promover la nueva política antes de callbacks.
19versiones/protocolo2/diario23 privados conservados ante esos intentos; las cuatro
bases origen intactas. Auditoría posterior19:45:24.145 conserva ocho registros
firmados de callback/seis fuentes fijadas y ausencia de actores del proveedor.
No es un oráculo de calidad, ni holdout, ni dominio instalado.
[Contrato](../design/EVALUATION-ONLY-LEARNING.md),
[resultado de componente](runs/learning-evaluation-only-qqiFSS/summary.json).
[Auditoría del componente](runs/learning-evaluation-only-qqiFSS/post-close-audit.json),
[auditoría de regresión](runs/suite-RwCzKm/post-close-audit.json).

**Selección de aprendizaje observable: desarrollo cualificado, no instalado.**
Nuevo candidato `2898f24fe3130b4ebc328e5bd30069f1e3d95e00f43d080d311c3fb3facac003`,
440 archivos/24.324.795 bytes. Congela el motivo real de exclusión/consulta y
las versiones seleccionadas al crear cada trabajador; el informe sólo las lee.
Conserva el predicado anterior en 4.096 combinaciones y valores explícitos false/null;
no habilita ámbitos, modelos, permisos, promoción ni ejecución automática.
Historial sin decisión sigue NOT_RECORDED, no se diagnostica retrospectivamente.
Dirigidos finales: 26 PASS y una prueba adicional del bloqueo bounded PASS.
Se conservan los fallos iniciales, incluidos dos fixtures sin expectedVersion:0;
se corrigieron los fixtures sin relajar almacenamiento ni aceptación.
Global **suite-8kFjNw/85465** cerrado19:23:16.292, auditado19:24:21.500:
2016tests/2015PASS/0FAIL/1SKIP,568940.186392ms;356pins/cuatrostreams exactos,
owners2829068/2829078 ausentes. El SKIP es sólo el smoke LIVE opt-in.
Comparación read-only del historial instalado19:14:30.202: todos los campos
JSON previos iguales,8decisiones históricas desconocidas,11inferencias antiguas;
171versiones/protocolo2/diario426 intactos, cero llamadas/misiones/escrituras nuevas.
[Evidencia del historial](experiments/learning-report-history-comparison.json),
[auditoría global](runs/suite-8kFjNw/post-close-audit.json).
El desarrollo ya NO coincide con0ec8; la instalación y su proceso se conservan.
Esto cierra la observabilidad de selección, no el autoaprendizaje R11.

**Duplicación del contexto medida; laboratorio NO integrado.** FRl5RS cerrado
18:50:27.800 con trece fuentes y diez requests públicos íntegros. Los únicos
subesquemas idénticos tienen17/5bytes; no justifican$defs en este corpus.
Laboratoriol9rzUX cerrado18:55:39.105/auditado18:56:50.940: doce tests PASS,
190.686253ms;84referencias y diez entradas reconstruidas exactamente. Reducción
neta13495/423737bytes al incluir instrucciones extra; una petición crece499bytes.
No tokens/velocidad/calidad acreditados, cero LIVE/SIM, sin promoción.
[Diseño y resultados](../design/FIXED-CONTEXT-DUPLICATION.md). 439archivos del
runtime de desarrollo iguales a0ec8 a19:01:56.182.

**Aprendizaje: infraestructura presente, instalación sin configurar.** learn-list
vacío y consulta SQLite read-only18:59:17.094 confirman cero registros learning-*;
171versiones/protocolo2/diario426 conservados. No hay autoaprendizaje operacional
ni overlay promovido en la instalación. La prueba real histórica de citas sigue
rechazada4/4 frente a4/4; no fabricar mejora. Siguiente integración: hacer visible
esa diferencia y acreditar un evaluador de dominio antes de activar ciclos.
[Brecha y trabajo siguiente](../design/LEARNING-OPERATIONAL-GAP.md).

**CLI de presentación integrada, instalada y auditada en su alcance.** Opción
creation-only `--bounded-read-presentation separate-evidence-v1` con entrada
bounded; no cambia transporte, presets, permisos o presupuesto. Pruebas21PASS,
27099.811641ms: CLI real/SQLite, con inferencia SIM sólo en dos recorridos de
ejecución. Literal sin lectura, lectura propia del juez y reentrada sin llamada.
Negativos iniciales y tres errores de fixture conservados, sin relajar el motor.
[Pruebas dirigidas](experiments/presentation-cli-directed-tests.json).
Candidato**84e7f68750b28df253c860cf3c67ccf422928a1d5a12e701a8881712503690d3**,
439archivos/24.319.439bytes. Sólo CLI y manual difieren del núcleo c989e75b.
Global**suite-LkgzmK/40149** cerrado18:20:50.503, auditado18:21:22.520:
2008tests/2007PASS/0FAIL/1SKIP,547813.713931ms;354pins/cuatrostreams exactos,
owners2803889/2803899 ausentes. PaqueteEvmwkR cerrado/auditado18:22:19.854:
cinco comandos reales/cinco respuestas SIM, relectura propia y reentrada sin
inferencia. CopiaSlkYv5 auditada18:22:19.920:169versiones originales/58heads
materiales conservados, cero nuevas inferencias/efectos, origen intacto.

**0ec8d59f913f75b79d08e7c83d7532162a4e010d761ed9c643676d30922b4a81 instalado**,
439archivos/24.319.438bytes. Sólo documentación de aplicabilidad difiere84e7;
mismos354inputs ejecutables y ayuda/reporte completos idénticos, sin otra suite.
Instalación83w1PG auditada18:31:52.334, tras cola ociosa/parada/backup privado:
169versiones originales/58heads conservados;171finales sólo por ownership40/41.
PID2817012/start59460653 único holder canónico,protocolo2,diario426.
Cero nuevas misiones/inferencias/efectos. Skill actualizada/validada después.
Native-read-v1 está en el SDK pero NO seleccionado en CLI/preset/skill; no flag
nativo ni promoción de eficiencia. [Instalación y evidencias](PRESENTATION-CLI-INSTALLATION-2026-09-14.md).

**Comparación real de transporte/presentación CERRADA: bDrx5k/42780.**
Prerregistro [PRESENTATION-PAIRED-QUALIFICATION.md](experiments/PRESENTATION-PAIRED-QUALIFICATION.md):
dos casos NUEVOS conocidos, intervalos semiabiertos y circuito ternario; mismo
c989e75b/contrato9/modelo/criterios en ambos brazos, sólo transporte difiere.
Máximo10turnos/12unidades/2callbacks,15min por turno. No repetir casos anteriores.
Oráculos3PASS,228.135771ms. SIMIOGXuA cerrado17:35:39.722, auditado17:35:48.624:
352+6pins/61archivos/40usos de citas,10turnos simulados/12unidades/2callbacks.
LIVE cerrado17:55:57.757, auditado17:56:30.762; sesiones42780 y40823 cerradas0.
352+6pins,64archivos de cierre,57usos de citas; owner y diez proveedores ausentes.
Diez contratos/contextos/resultados públicos completos inspeccionados; recálculo
independiente de intervalos y veinte nodos del circuito. Los cuatro productos
conocidos pasan, con relectura propia posterior por cada juez. Tres llamadas
ordinarias frente a dos nativas por caso; mismas tres unidades reservadas.
**Eficiencia INCONCLUSIVE**: baseline intervalos registra retry/secuencia133,
responseStreamDisconnected, sin cobertura acreditada del intento interrumpido.
Contadores finales97812baseline/88090native no certifican ahorro total.
No repetir el par para eliminar ese hueco ni promover un preset conjunto.
[Disposición semántica y límites](runs/presentation-read-pair-bDrx5k/semantic-disposition.json).
Cuota previa88%semanal consumido/12%restante compartido, sin créditos/reset/API.
Los seis inputs y tres prerrequisitos quedan congelados después del cierre.
Integración posterior: sólo corrección de presentación explícita al crear;
políticas existentes conservadas, sin selección nativa.
[Decisión y matriz de pruebas](../design/NATIVE-PRESENTATION-PUBLIC-INTEGRATION.md).

## Evidencia previa conservada

Global posterior a la sonda **suite-1YR91T/92042 cerrado17:34:37.629**:
1987tests/1986PASS/0FAIL/1SKIP,516767.233283ms; auditoría17:35:33.323:
352pins/cuatrostreams/owners ausentes, runtime439archivos exacto c989e75b,
sin modificación de factory/ ni instalación. No suma una segunda cobertura LIVE.

**Admisión literal de --file cerrada e instalada en su alcance.**
Contraejemplo sintético cerrado12:57:31.914: la CLI instalada guardaba61efbfbd28
al recibir61c328, sustitución UTF-8 silenciosa; cola privada nunca servida,
cero actores/inferencias/efectos. No corrupción observada de datos del usuario.
[Diseño y negativo](../design/REQUEST-FILE-ADMISSION.md).

Ambas ramas submit/run reutilizan ahora la captura estricta existente. Archivo
regular sin enlaces, doble lectura y UTF-8 exacto; no se convierte el encargo en
adjunto, no floor nuevo, no cambio del máximo256KiB. Veintinueve pruebas CLI
nuevas, incluyendo FIFO, padres symlink, inválidos, BOM/CRLF/Unicode, idempotencia,
--text/--inputs y límites. Dirigidos93478:74 PASS/ceroFAIL,11548.236689ms.
La primera ejecución15/3PASS/12FAIL queda conservada: diez diferencias de admisión
(directorios/tamaño ya rechazados pero con otro código) y dos errores del test
sobre bytes/workspace, corregidos sin modificar el motor.
[Pruebas](experiments/request-file-directed-tests-20260914.json).

Regresión **2v6ckJ/35755 cerrada13:22:32.609**:1837tests/1836PASS/0FAIL/1SKIP,
490822.072406ms. Auditoría13:23:21.851:339pins/cuatrostreams/owners ausentes.
PaqueteiSRH2a cerrado13:23:36.266/auditado13:25:00.610: seis comandosCLI reales,
malformados rechazados antes de publicar,39bytes válidos exactos, idempotencia,
cero inferencias; tres DBs intactas en auditoría. Sólo CLI/manual difieren25d34.

**3305fe6155767301a822ed88af4ec91e9b46a5aab3b504fe976e6d8e53841a0a instalado anteriormente**,
435archivos/24.260.040bytes. AuditoríaBJWPFq13:28:31.520:165versiones originales
y58heads materiales conservados; sólo ownership release/acquire,167versiones,
protocolo2, PID2690559/start57634304 canónico y único holder. Backup privado
previo conservado, cero misiones/inferencias/efectos nuevos. CapturaJSON truncada
del primer intento de auditoría conservada; consulta completa posterior sin
rebajar comprobaciones. [Instalación y pruebas](REQUEST-FILE-INSTALLATION-2026-09-14.md).
Skill actualizada/validada. Manual15563bytes/nueveenlaces; anterior744líneas
archivado con hashidéntico. No nuevas inferencias atribuidas a pruebas antiguas.

**Cobertura de uso tras retry nativo cualificada e instalada en su alcance.**
El informe de desarrollo explicita notificaciones/actores/secuencias y sus fases,
sin cambiar contadores, llamadas, fallos o recibos. Cobertura del intento cortado:
NOT_ESTABLISHED; ausencia de telemetría no prueba ausencia de retries.
[Diseño](../design/NATIVE-RETRY-USAGE-COVERAGE.md). Dirigidos63tests/62PASS/0FAIL/1SKIP,
1016.434846ms; primer6/4PASS/2FAIL conservado (función ausente y error de fixture
SQLite, corregido sin relajar canonical). Se corrigió además el nombre del tipo
input-preparation en una aserción de --file; no cambio funcional ni nuevo test.

**244d749e5b151f0a476a9baddb06ea8eb3769311757e1e3f7cc30ecacf31fba7 instalado**,
435archivos/24.261.721bytes; sólo factory/lib/report.mjs difiere3305.
GlobalzUEZhV/62604 cerrado13:43:43.176:1839tests/1838PASS/0FAIL/1SKIP,
440987.352185ms; auditado13:44:30.046,339pins/cuatrostreams/owners ausentes.
cboydF/50383 cerrado13:44:42.427 y auditado13:46:51.897: cuatro DBs de7Q6DCK
byte-idénticas, todos los campos previos del reporte iguales y mismos contadores;
retries0/0/0/1 y única referenciaB-baseline/secuencia86. No nueva inferencia,
imputación de tokens, cambio del veredicto ni reapertura de misión histórica.
InstalaciónfsMIqv auditada13:48:34.527:167versiones originales/58heads conservados,
169finales sólo por queue-owner38/39,protocolo2. PID2703657/start57762768 único
holder canónico, backup privado previo. [Pruebas/instalación](NATIVE-RETRY-REPORT-INSTALLATION-2026-09-14.md).

**Continuación nativa: capacidad de callback comprobada, sin promoción.**
Laboratorio1BuFGS/18823 cerrado14:06:57.354 y auditado14:09:05.551. Misma
petición/GPT6Astra/ultra: namespace ordinario UNAVAILABLE sin callback;
namespace directo OBSERVED con nonce de memoria exacto, una llamada completada.
4039/7301tokens notificados: no comparación de ahorro entre no ejecutar/ejecutar.
19SIM PASS; negativo inicial de lifecycle conservado y corregido. Once pins
intactos, tres procesos ausentes,169versiones/64heads instalados idénticos,
PID2703657/protocolo2. [Resultados](NATIVE-TOOL-LAB-RESULTS.md).

**Transcripción nativa: pruebas iniciales del componente conservadas.**
51pruebas propias, incluyendo cuatro procesos fixture muertos conSIGKILL tras
commit y reapertura SQLite. Dirigidos85890:106/105PASS/0FAIL/1SKIP,
1087.749172ms; sin inferencia. Negativo inicialnull→TypeError conservado y
corregido con rechazo tipado. [Resultados](NATIVE-READ-TRANSCRIPT-RESULTS.md).
No autoridad por referencias/ledger solos. No cambio de instalado, proveedor
operativo, protocolo SQLite ni misión. Desarrollo posterior ya no es244d exacto.

**Adaptador nativo: pruebas iniciales conservadas; integración posterior abajo.**
Perfil separado liga base y herramienta; etapas del controlador verificadas,
cancelación y limpieza pendiente distinguidas.27tests de transporte SIM;
dirigidos41856 cerrados133/132PASS/0FAIL/1SKIP,1075.490534ms.
La captura truncada anterior se conserva; repetición sólo para retener salida
completa. No nuevoLIVE. [Contrato e integración pendiente](../design/NATIVE-READ-INTEGRATION.md).
El controlador de pruebas usa referencias sintéticas, no permisos acreditados.
Proveedor operativo instalado sigue244d749e; no se lanzó una misión nativa.

**Integración nativa conectada en desarrollo opt-in; NO instalada.**
WorkerService selecciona perfil nativo sólo para productor bounded; juez conserva
perfil y relectura propia posterior. CALL+consumo local/global preceden al broker;
lease real, recibo firmado, bytes completos, intención de envío, ACK y FINISH.
retainOutcome compromete propuesta pública+recibo+exposición antes de retornar;
recupera resultado exacto sólo con cierre confirmado. La API ordinaria de
observaciones sigue rechazando mutación de exposición pendiente. Piso8 sólo
para misiones nuevas con nativeReadTransport:'native-read-v1'; instalado en2.
Sin presupuesto global, persiste consumo local; con él, inicial+continuación+juez
reservan tres unidades aunque sean dos invocaciones completas de proveedor.

29tests de integración,31de adaptador,51del componente puro y7crashes del
controlador fixture. Todos con inferencia SIM; broker/SQLite/SIGKILL reales.
Dirigidos50565:73PASS;25274:61PASS;3654:84/83PASS/ceroFAIL/1SKIP.
Negativos iniciales13/12 y205/204 conservados: dos errores de expectativas de
tests, corregidos sin alterar el resultado del motor. [Evidencias](NATIVE-READ-INTEGRATION-RESULTS.md).

Paquete564901430de58ea5da07a78dc60183d2d87c28d18ca70148917caf9579939f9f
congelado:438archivos/24.311.607bytes. Global**fg0l0i/11039 cerrado15:37:10.395**:
1957tests/1956PASS/ceroFAIL/1SKIP,465904.689133ms. Auditoría15:38:15.134:
347pins/cuatrostreams/owners ausentes. Compatibilidad5faW7G cerrada/auditada:
244d749e rechaza abrir/escribir8, incluso con conexión previa; base aislada,
original conservado, cero actores/inferencias/efectos. No base instalada abierta.

Par nuevo SIMuL68DG cerrado/auditado. **LIVEvZIKxX cerrado15:57:26.492,
INCONCLUSIVE**, auditado15:57:48.701:347+6pins,31archivos de cierre,15usos de
citas, cinco procesos ausentes y bases intactas. Baseline de revisiones: tres
llamadas/48605tokens, producto y juicio completos correctos. Productor nativo:
lectura real/callback/retención y propuesta exacta; su juez agotó180000ms sin
respuesta completa. Cinco llamadas totales, una con uso desconocido; los dos
brazos Unicode NO se ejecutaron. No coste nativo total, ahorro, aceptación
nativa ni promoción. El límite de3min era del ensayo, frente a15min del motor;
no ampliar ni repetir el par para alterar su nota.

Copia de recuperaciónIvS8ls cerrada16:03:23.103/auditada16:04:47.827: conserva
73registros originales, propuesta nativa, presupuesto3/3 y cero inferencias
nuevas. NEEDS_DIRECTION por presupuesto agotado; no entrega. Una lectura nueva
del juez ocurre antes de descubrir esa falta de capacidad: siguiente mejora,
comprobar agotamiento conocido antes de crear otro revisor o hacer sus efectos.
La primera copia3LIsPD no llegó a esa comprobación: WORKSPACE_PATH al trasladar
entradas ligadas a path/inode. Se conserva; IvS8ls sólo copia la DB y reutiliza
entradas originales para lectura, identidad/bytes y DB originales comprobados.

**Admisión de revisión corregida en desarrollo, no instalada.** Consulta el
presupuesto antes de crear juez/leases/efectos; capacidad disponible no es una
reserva y la reserva atómica posterior sigue decidiendo la contención. No cambia
el techo, devuelve consumo ni rebaja revisión. Ocho pruebas nuevas y189dirigidos
PASS/ceroFAIL,10535.041546ms. Negativos conservados: tres reproducciones, un error
del fixture de corrupción; después una incompatibilidad de la implementación
con misiones antiguas sin campo data.id, corregida usando artifact.missionId.
La captura de esa incompatibilidad está explícitamente truncada; no fabricar
su total de tests. [Diseño](../design/REVIEW-BUDGET-ADMISSION.md).

Candidato**34f1053bc722c481f61ba8bb599b8bea91ed227b3eacecea91e9c776f7e8ef4c**,
438archivos/24.312.241bytes; sólo workers.mjs difiere de56490143 en runtime.
Global**suite-4FEbL2/12091 cerrado16:21:13.959**:1965tests/1964PASS/ceroFAIL/1SKIP,
478996.937996ms. Auditoría16:26:42.393:348pins/cuatrostreams y ambos owners
ausentes, candidato exacto. Copia**review-budget-copy-Xe7nzd** cerrada/auditada
16:27:09.878:73registros originales, propuesta, entradas y presupuesto conservados;
cero nuevos actores, lecturas e inferencias. Journal121; originalLIVE byte-idéntico.
Confirma la admisión temprana frente a la lectura extra observada enIvS8ls.
No completa el juicio interrumpido, repite el par ni autoriza promoción.
No preleer por adjunto: el modelo debe respetar negaciones y planificación previa;
el juez evalúa la elección del archivo contra el mandato íntegro.

**Cualificación operacional separada RECHAZADA**, no repetición del par de coste.
[Prerregistro](experiments/NATIVE-OPERATIONAL-QUALIFICATION.md): dos casos nuevos
conocidos, cálculo de DAG y negación explícita de lectura; máximo4turnos/5unidades,
una continuación admitida, timeout ordinario900000ms. SIMfUK80y cerrado16:32:48.848,
auditado16:33:03.022:348+6pins,28archivos de cierre,17usos de citas,4turnos simulados,
lecturas2/0 y reentrada sin inferencia. Tres tests de oráculo PASS,124.640389ms.
LIVEmWI9Fs/16320 cerrado16:35:07.559, auditado16:36:32.056:348+6pins,13archivos
de cierre, owner y único proveedor ausentes, DB intacta. Un turno/22870tokens;
lectura/callback correctos, pero productor blocked: JSON exacto incompatible con
la obligación de citas/justificación en body impuesta por el controlador.
No timeout, juez, producto ni segundo caso. Fallback reservó la tercera unidad,
pero fue rechazado por el guard antes de crear otro proveedor. Tres actores/dos
peticiones persistidas no equivalen a tres llamadas. [Revisión semántica](runs/native-operational-mWI9Fs/semantic-disposition.json).
Los seis inputs del ensayo quedan congelados. Desarrollo siguiente: separar
entrega/evidencia mediante selección versionada, sin retroadaptar misiones viejas.
[Diseño previo](../design/BOUNDED-RESPONSE-PRESENTATION.md). Uso de cuota observado16:29UTC:
86% consumido en ventana semanal compartida; no reserva ni garantía futura.

**Presentación separada cualificada en dos casos reales conocidos, no instalada.** Selección
creation-only boundedReadPresentation:'separate-evidence-v1', piso9 transaccional,
node/hash distintos sólo si se selecciona. Los siete criterios, juez, límites y
herramientas se conservan; schema del productor ya no exige prueba dentro del
cuerpo exacto. El juez recibe instrucciones explícitas de justificar en sus checks,
sin dispensar explicaciones/citas que el usuario pida dentro de la entrega.
Baseline15/1PASS/14FAIL conservado: característica ausente; tres rechazos ya existían
como SCHEMA. Primer dirigido192/188PASS/4FAIL: cuatro errores del fixture después
de resultados aceptados (serializar callbacks y campo review equivocado), corregidos.
Dirigido34220 cerrado:294PASS/ceroFAIL,31074.89487ms; incluye storage-protocol
correcto. [Captura completa](experiments/bounded-presentation-directed-tests.json).
Se movieron dos tests de protocolo futuro de9 a10 sin eliminar su rechazo.
Paquetec989e75b11fdf9e708b7ee0b11e9dacb535f8ed7a2c95dba25fb5e7f34b571db,
439archivos/24.317.563bytes, congelado. Global**suite-ZzKrIb/44994 cerrado16:58:22.128**:
1980tests/1979PASS/ceroFAIL/1SKIP,498553.617848ms. Auditoría16:58:39.497:
350pins/cuatrostreams exactos y ambos owners ausentes. No promoción todavía.
Piso9NOTe9H cerrado/auditado16:59:17.276:34f1053b rechaza abrir/escribir9, incluso
con conexión anterior; un original conservado/tres registros finales, cero actores.
Copia5joak0 auditada16:59:17.393:97registros, resultado/política/materiales antiguos
intactos; cero modelos/efectos nuevos, una lectura de comprobación del snapshot.
OriginalLIVE y su path/inode/bytes intactos. Nueva selección9 queda NEW sin ejecutar.

Nuevo ensayo prospectivo de presentación: fracciones exactas y literal sin lectura,
no repetición deDAG/pares fallidos. [Contrato](experiments/PRESENTATION-OPERATIONAL-QUALIFICATION.md).
Tres tests de oráculo PASS,120.057991ms. SIMqPA3vZ cerrado17:01:20.917 y auditado
17:02:06.424:350+6pins,28archivos de cierre,17usos de citas,4turnos simulados,
5unidades y lecturas2/0. **LIVEVj7vZz/98901 cerrado17:06:54.116**, cuatro turnos
reales/5unidades/una continuación; 68.833tokens conocidos, cero retries observados.
Auditoría17:08:32.114:350+6pins/31archivos/26usos de citas, owner y cuatro
proveedores ausentes. Fracciones: JSON completo exacto, suma9/4, media1/4,
mediana1/3 y lectura propia posterior. Literal:20codepoints/26bytes exactos,
acento NFD y cero lecturas; adjunto ausente de los dos contextos.
Leídos los cuatro contratos/schemas/contextos y resultados públicos completos;
recálculo independiente y comparación con expectativas literales separadas.
[Aceptación semántica limitada](runs/presentation-operational-Vj7vZz/semantic-disposition.json).
No eficiencia acreditada, holdout, promoción ni cierre del mandato.
Cuota consultada al prepararLIVE:87% semanal consumido/13% restante compartido;
no créditos, reset, API ni reserva de disponibilidad. Los seis inputs del ensayo
y los dos prerrequisitos de compatibilidad permanecen congelados tras el cierre.

**Guía acotada5a5e: promoción RECHAZADA y retirada recuperablemente.**
LIVE7Q6DCK/88724 cerró12:59:50.001; auditoría13:00:18.616,340+10pins/70citas,
cuatro bases intactas, doce cierres y owner ausente. Los cuatro productos conocidos
y sus oráculos pasaron; todas las respuestas/contratos públicos y lecturas propias
se leyeron. Total25d34:99254tokens;5a5e:100313 (+1059/+1,06696%). No satisface el
ahorro agregado fijado. B-baseline tuvo un retry nativo con salida parcial sin
contador separado: cobertura de ese intento DESCONOCIDA, no imputarla para
cambiar el veredicto. [Resultados completos](BOUNDED-WIRE-RESULTS.md).

La optimización nunca se instaló. Sus cuatro archivos originales se conservaron
en experiments/rejected-bounded-wire-20260914-1303 antes de retirarla. A13:04:57.023
se comprobó igualdad de435 archivos runtime/338 pins de regresión con25d34/UaXbwc;
después empezó el cambio distinto de --file. No repetir el LIVE buscando otra nota.

**Aplicabilidad LIVE GoZbep/15807**, cerrada 11:02, auditada 11:07:22.802.
Tres casos prospectivos, sin cambiar modelo/esfuerzo, criterios ni presupuesto:

- quoted-record-transform: controles de entrega/oráculo aprobados, 3 llamadas
  reales, 41.090 tokens. Relectura propia y preservación literal comprobadas.
- closed-formal-graph: controles aprobados, 2 llamadas reales / 25.865 tokens;
  sin herramientas, recálculo independiente con partición alternativa del conteo.
- mandatory-reviewed-plan: entrada directa rechazada por condición de proceso;
  fichas VERITAS_07/Ω22 inspeccionadas, plan candidato con especialista autónomo
  y doce requisitos. Plan aceptado en secuencia 171 antes del productor 178;
  producto 223 y revisión final independiente aceptados. 6 llamadas / 142.746 tokens.

[Contrato previo](experiments/BOUNDED-APPLICABILITY-QUALIFICATION.md).
SIM JZFeGq/46986 cerrado, 3/2/6 respuestas simuladas; auditoría
10:42:38.657: 331+9 pins, quince usos de citas y reentrada sin inferencia.
Dos tests de oráculo PASS; enumeración independiente de 720 permutaciones.
LIVE: 11 llamadas, 209.701 tokens, 61 usos literales de citas, cero uso desconocido.
331+9 pins intactos en auditoría. Todas las respuestas y contratos asignados leídos;
[aceptación semántica acotada](runs/bounded-applicability-live-GoZbep/semantic-disposition.json).
No eficiencia general ni holdout. Conservar los nueve inputs congelados.

**Integración de admisión de archivos cerrada en su alcance**, carencia real de integración.
--file carga la petición, no adjuntos; los ensayos anteriores preparaban los datos
antes de arrancar. [Diseño previo](../design/MISSION-INPUT-ADMISSION.md): originales
durables y preparación recuperable antes de cualquier inferencia, sin carrera
con la cola. Carencia detectada antes de esta implementación. Promoción de 3d2 como entrada integrada
aplazada; sus resultados acotados siguen conservados.

Admisión ya implementada en desarrollo: --inputs separado de --file, originales
atómicos con la cola, protocolo7, preparación por identidad antes de inferencia,
recuperación sin sustitución y linaje de escrituras posteriores. [Resultados](MISSION-INPUT-RESULTS.md).
El núcleo de desarrollo YA NO es 3d2. Nuevos cambios requieren nueva cualificación.
95529 cerró 120 PASS/cero FAIL en 9051.930435ms. Proveedor SIM, FS/SQLite reales.
Se conserva el fallo 51155: metadatos solos no detectaban siempre una reescritura
rápida del mismo tamaño; corregido mediante doble lectura exacta, sin rebajar test.
**Global UaXbwc/53704 cerrado** 11:36:59.648: 1808 tests/1807 PASS/cero FAIL/un SKIP.
Auditoría 11:37:47.991: 338 pins, cuatro streams exactos y owners ausentes.
Snapshot nuevo **25d34a9259798af52d0c1d784e2c34755207b3a7854be7dac2f86297115b455f**,
435 archivos/24.295.299 bytes. No editar sus inputs para conservar la cualificación.

[Ensayo CLI/cola](experiments/MISSION-INPUT-QUALIFICATION.md): SIM Rlbnbs cerrado,
auditado 11:38:23.403; LIVE c6Q9gq cerrado con tres llamadas reales/47.264 tokens,
cero uso desconocido. Auditoría 11:44:15.267: 338+9 pins, trece usos literales de
citas y DB intacta. CLI real, adjunto durable y preparación por la cola, sin
archivo sembrado manualmente; origen retirado de su ruta antes de ejecutar.
Petición y respuestas completas revisadas; [aceptación semántica acotada](runs/mission-input-live-c6Q9gq/semantic-disposition.json).
No comparación causal de coste, holdout ni prueba de verdad física.

Compatibilidad dsnhri auditada 11:41:40.443: ejecutores antiguos b7/3d2 rechazan
floor7 para abrir/escribir/ejecutar, sin inferencias ni mutación de originales.
Copia del historial Qe5ekf cerrada y auditada 11:53:47.139: b7→25d34→b7,
163 versiones originales y 58 heads materiales conservados, protocolo2,
cero llamadas nuevas. No rollback después de usar floor7.

**25d34 instalado y auditado12:00:47.322**, tras preflight de cola ociosa,
parada controlada y backup coherente. 163 versiones originales/58 heads materiales
conservados; sólo cambios de ownership. Skill actualizada y validada estructuralmente.
[Instalación y límites](MISSION-INPUT-INSTALLATION-2026-09-14.md). La siguiente mejora
debe atender la desproporción de contexto/coste sin perder contrato ni revisión.

## Instalado frente a candidato

| Estado | Versión exacta / prueba |
|---|---|
| Instalado actual, registro declarativo y evaluación explícita | 334744c8b9288113b1f8aa9d928bef23f17dc70dd796c8d11b2d6abc89d07e1b |
| Regresión exacta actual y cualificación CLI | sr2IvH/51100,2204tests:2203PASS/0FAIL/1SKIP;374pins;RotqPT diez CLI sin inferencia |
| Instalado anterior08498, conservado | 08498be9bf76aefd2fcf4a3d21b354abe8326f01b7b622568119235244d2e1a3 |
| Regresión y cualificación históricas08498 | VhkSft/81692,2171tests:2170PASS/0FAIL/1SKIP;372pins;ZoQ6Wu SIM |
| Instalado anterior0ec8, conservado | 0ec8d59f913f75b79d08e7c83d7532162a4e010d761ed9c643676d30922b4a81 |
| Regresión histórica0ec8 y paquete84e7 | LkgzmK/40149,2008tests:2007PASS/0FAIL/1SKIP;354pins;0ec8 sólo cambia manual |
| Instalado anterior244d749e, conservado | 244d749e5b151f0a476a9baddb06ea8eb3769311757e1e3f7cc30ecacf31fba7 |
| Regresión del instalado244d749e | zUEZhV/62604,1839tests:1838PASS/0FAIL/1SKIP;339pins |
| Instalado anterior3305fe61, conservado | 3305fe6155767301a822ed88af4ec91e9b46a5aab3b504fe976e6d8e53841a0a |
| Regresión histórica3305fe61 | 2v6ckJ/35755,1837tests:1836PASS/0FAIL/1SKIP;339pins |
| Instalado anterior25d34, conservado | 25d34a9259798af52d0c1d784e2c34755207b3a7854be7dac2f86297115b455f |
| Regresión histórica25d34 | UaXbwc/53704, 1808 tests: 1807 PASS, 0 FAIL, 1 SKIP |
| Candidato rechazado por no ahorrar, nunca instalado | 5a5e3f3f1f32dd24652a45716969f0f383764a6d3fc358f0b23d0a3980bc48e1 |
| Regresión histórica5a5e3f3f, no eficiencia | y6gnE5/63718, 1822 tests: 1821 PASS, 0 FAIL, 1 SKIP |
| Candidato anterior, nunca instalado | 3d2f562a8388ef7445b5ac5640eed10300aa35907b6c14a0dd1c420f21dcb27f |
| Regresión del candidato congelado 3d2, no del desarrollo posterior | wm3d8Q/65729, 1749 tests: 1748 PASS, 0 FAIL, 1 SKIP |
| Cierre de regresión / auditoría | 10:17:40.262 / 10:25:06.747, 331 inputs y cuatro streams, ambos owners ausentes |

El candidato anterior 3d2 tiene 432 archivos/24.266.432 bytes. Su modo explícito
`bounded-read-response-v1` necesita protocolo 6 desde la creación de la misión.
Una entrada UTF-8 completa de hasta 65.536 bytes como máximo delimita el atajo,
no el encargo; fuera de alcance se conserva para planificación. Productor con
contrato propio y juez con ficha completa, relectura propia posterior al candidato.
No cambia los presets adaptive-v1/v2 ni políticas de misiones anteriores.
[Diseño](../design/BOUNDED-READ-ENTRY.md), [pruebas y fallos](BOUNDED-READ-RESULTS.md).

Instalación histórica b7cb510c: [auditoría](INPUT-REVIEW-INSTALLATION-2026-09-14.md).
Su muestra de 08:33:28.520/08:35:15.077 no es estado vivo: PID 2564734,
gestor/cgroup canónicos y único holder entonces, DB protocolo 2, 163 versiones,
58 heads materiales y journal 418. No asumir inactividad actual sin comprobarla
cuando corresponda cambiar el servicio. Backup privado previo conservado.
[Promoción condicionada](BOUNDED-READ-PROMOTION-PREFLIGHT.md), no ejecutada.

[Copia de compatibilidad 3EleeI/44298](BOUNDED-READ-UPGRADE-COPY-RESULTS.md)
cerrada y auditada 10:55:19.101: las 163 versiones y 58 heads materiales originales
conservados, cero proveedor/broker nuevos, tres procesos y original intacto.
Protocolo 2 conservado; no rollback tras usar protocolo 6 ni prueba de estados activos.

## Mejora anterior de coste, alcance conservado

**Inventario ocSk6B/58072**, cierre 10:30:41.720, aceptación acotada.
Misma petición, 478 bytes, modelo/esfuerzo/permisos/oráculo que LFYIrU;
única diferencia de política: entrada explícita. 3 llamadas / **42.946 tokens**
frente a 7 / 152.181 históricos: reducción observada **71,779657%**,
supera el 25% fijado antes del ensayo. No comparación causal ni ahorro general.

Auditoría 10:34:40.810: 331+7 pins, tres cierres, once usos literales de citas,
owner ausente y DB intacta. Secuencia: lectura 39 → candidato 74 →
relectura juez 82 → juicio 138 → aceptación 139. Reentrada sin inferencia.
Revisión de todas las respuestas, ficha/criterios y recálculo 6450 mg/+50:
[disposición semántica](runs/bounded-read-live-ocSk6B/semantic-disposition.json).
No repetir este LIVE ni instalar sólo por haber aprobado un inventario.

## Evidencias anteriores que no deben repetirse ni mezclarse

- LFYIrU cualificó la relectura independiente de entradas y precedió a b7cb510c;
  TymHUs 1693/1692 PASS/1 SKIP cubre ese núcleo, **no** el candidato actual.
- Selector adaptativo TRLzD8: rechazado, 13884 frente a 13491 tokens. Retirado y
  archivado con restauración comprobada. [Resultado](ADAPTIVE-CONTEXT-RESULTS.md).
- Diccionario corto sOaoUD: mejora acotada de 3,28% en dos casos sintéticos;
  no incorporado ni instalado. [Resultado](SHORT-TEXT-POOL-RESULTS.md).
- Compatibilidad zYQ8Rk: b7 real rechazó protocolo 6 y conservó 50 versiones
  antiguas. Sus diez pins son anteriores a tres refuerzos posteriores;
  no afirmar que cubre íntegramente el snapshot actual.
- Costes y errores de desarrollo UYEoVL, cuotas, rechazo de aprendizaje,
  recuperación, blinding y fuentes siguen conservados en el historial enlazado.
  Un cambio posterior no rehabilita automáticamente un ensayo fallido.

## Cobertura y obligaciones abiertas

Esta tabla resume la [matriz detallada conservada](STATUS-HISTORY-2026-09-13-2244.md#matriz-vigente-del-mandato).
No reemplaza el criterio de aceptación de cada requisito.

| Mandato | Evidencia obtenida | Obligación pendiente |
|---|---|---|
| R01, borrador | 154 fichas actuales auditadas individualmente, suplementos históricos y fuentes fijadas | No equivale a lectura de todo el historial Git; conservar residuales explícitos |
| R02, capacidades | Catálogo, consolidaciones Π/Σ y comparación real de 16 juicios sintéticos | Utilidad marginal en tareas representativas; el empate no autoriza eliminar capacidades |
| R03, dirección | Motor, CLI/SDK y skill con petición, asignación, revisión y reporte trazables | Cola no implica notificación al chat ni actividad ininterrumpida |
| R04, eficiencia | Rutas adaptativas, pares reales y métricas; presupuesto global probado localmente | Costes reales todavía desproporcionados en varios casos; calibración amplia y eficiencia sin perder calidad |
| R05, estrategia | Plan independiente, dependencias y cobertura; ODeAyj integrado desde petición natural | Diversidad de casos y utilidad comparada de alternativas; conocido no significa holdout |
| R06, corrección | Feedback durable; PRFwPC tras fallo/caída; 2spDVa revisa y acepta un método causal distinto antes de corregir un error controlado | Evaluación amplia y otros recorridos; un caso conocido con origen SIM no prueba estrategia general ni eficiencia |
| R07, revisión | Aceptación antes de consumo, retracción transitiva, ODeAyj; corrección CVLfLT/WfS70I cualificada con LFYIrU e instalada en b7cb510c | Comparación semántica y calibración amplia; una lectura propia auténtica no prueba independencia cognitiva ni verdad universal |
| R08, fuentes | Recuperación primaria, pasajes/hashes, hechos e inferencias; dos editores en 2cYEbW | Independencia epistemológica y resolución de contradicciones a escala; firma no implica verdad |
| R09, jueces | Contextos separados, criterios íntegros, pruebas externas y falsos positivos conservados | Calibración de rutas/dominios diversos; GV6waD condicional no es aceptación operativa |
| R10, roles | 154 fichas completas, métodos y procedencia; especialistas reales y controles de incompatibilidad | No acredita ejecución de 154 métodos ni independencia cognitiva o pericia universales |
| R11, aprendizaje | Propuesta real y comparaciones sin mejora; dominios disjuntos, exportación contextual y ámbitos evaluation-only cualificados; registro/evaluación CLI, `learn-status` y validación in-memory `learn-validate` instalados en e3dfb824 y auditados | Instalación sin dominios registrados; rutas adaptativas no cualificadas para overlays. Oráculos de dominio, mejora y promoción reales todavía no demostrados |
| R12, especialistas | Dos fichas autónomas justificadas y ejecutadas; soporte instalado en 10bbffa0 | Medición de valor frente a facetas existentes y generalización |
| R13, suscripciones | Codex App Server oficial con ChatGPT y recibos reales, sin API fallback | No afirmar otras suscripciones no configuradas |
| R14, persistencia | SQLite, ownership/fencing, cuota/cancelación/efectos inciertos y caídas de procesos; sonda desacoplada del desarrollo mutable; barrera de cierre del planificador protocol15 en desarrollo, con respuesta cuarentenada, reentrada y reporte de sólo lectura | Ensayo prolongado real, caída OS y cierre de sesiones; 59 muestras/55 saludables/4 fallidas, segmento nuevo por instalación, no prueban uptime continuo. La barrera nueva no está instalada ni cualifica proveedor real |
| R15, investigación | Comparativas primarias y contraejemplos ejecutados; [decisiones](../design/RESEARCH-DECISIONS.md) | Evaluar recomendaciones antes de convertirlas en garantías |
| R16, integración | Núcleo e3dfb824 instalado, respuestas acotadas/públicas y aprendizaje explícito; CLI/paquete/copia/regresión/backup/skill/servicio comprobados | Calibración, eficiencia proporcional y operación prolongada pendientes. Instalación no es cierre del mandato; 68fae338 permanece fallido |

## Siguiente trabajo autorizado

1. Conservar e3dfb824 instalado y sus pruebas. El [plan de promoción](REGISTRATION-RUNTIME-PROMOTION-PREFLIGHT.md)
   ya se ejecutó; no repetirlo ni editar sus precondiciones retrospectivamente.
2. Globalfg0l0i, compatibilidad, global4FEbL2 y copiaXe7nzd cerrados/auditados;
   parvZIKxX sigue inconcluso. Conservar sus seis entradas congeladas. Preparar
   mWI9Fs cerrado y rechazado. Correcciónc989e75b con global/compatibilidad/copia
   cerradas; LIVE de presentaciónVj7vZz/98901 cerrado, auditado y aceptado sólo en
   sus dos casos conocidos tras revisión pública completa. No repetir los ensayos
   anteriores para obtener nota ni modificar sus entradas fijadas. No promover
   transporte nativo como ahorro; la corrección explícita de presentación ya está instalada.
3. Mantener5a5e3f3f rechazado; continuar calibración, aprendizaje basado en mejora
   real y persistencia prolongada. No repetir pares LIVE cerrados buscando otra nota.
4. Dependencias de sonda desacopladas y cualificadas:28pruebas dirigidas, copia
   históricaOUt5JJ auditada y primera captura real saludable. Conservar la versión
   fijada y el historial; no repetir muestras para fingir tiempo transcurrido.
5. Analizar contexto/enrutamiento de las peticiones cortas sin repetir pares LIVE;
   [medidas y decisión](../design/PRESENTATION-TRANSPORT-COST.md). Nuevo par
   bDrx5k/42780 cerrado/auditado: cuatro productos conocidos aceptados, coste
   INCONCLUSIVE por retry sin cobertura completa. No editar sus seis inputs ni
   promover transporte. LkgzmK, paqueteEvmwkR y copiaSlkYv5 cerrados/auditados;
   integración0ec8 instalada. Duplicación medida y laboratorio cerrado sin
   integración: ahorro de bytes modesto, no de tokens, con una regresión de tamaño.
   Conservar sus entradas; no seguir repitiendo este corpus buscando una nota.
6. Continuar la integración de aprendizaje: `learn-status` ya hace observable el
   estado real, que sigue vacío (0 dominios, 0 ciclos). Antes de cualquier
   `learn-register`, pasar el manifiesto real por `learn-validate --file`; su
   éxito no sustituye la justificación independiente ni toca producción. Delimitar
   dominio/evaluador y crear sólo casos reales, sin cambiar permisos, promover
   overlays no evaluados o alterar los contratos cerrados bounded. Mantener
   e3dfb824 para el nuevo ensayo prolongado.

Soak: última captura11:17:38.211 saludable, e3dfb824/PID3971116;
59muestras/55sanas/4fallidas, diario observador119. Segmento actual0ms: hueco y
cambio de proceso, versión, entrypoint y propietario por la instalación controlada.
No se incluye tiempo del proceso anterior. La sonda permanece idéntica,
d05ddf42388bbf8fe6e63ced6700398e06137c55bd04156d8bae65388884a3da, con helpers
c989e75b fijos. Observer113/head28e95ab87c9cfe7a7b6be8f9a4e3024158b04ca6a57c71c9f5b5c981f608e3e9.
[Captura posterior334744](runs/registration-runtime-installation-EwvEW1/soak-after-install.json),
[captura previa08498](experiments/soak-08498-before-registration.json),
[captura previa0ec8](runs/integrated-runtime-installation-aINdRc/soak-before-install.json).
La captura de instalación y su reinicio de segmento quedan preservados en
[soak-after-install](runs/presentation-cli-installation-83w1PG/soak-after-install.json).
La captura previa18:21:21.801 cerró el segmento de244d con3624050ms observados;
43muestras/39sanas/4fallidas. Se conserva en
experiments/soak-pinning-third-real-checkpoint.json. Máximo histórico17024780ms,
sin mezclar procesos/versiones para acreditar continuidad. CopiaOUt5JJ conserva
40muestras/41registros originales y dos sucesores sólo sintéticos.
No hay nuevas inferencias ni72h acreditadas.
[Diseño, negativos y pruebas](../design/SOAK-DEPENDENCY-PINNING.md).
Próxima muestra periódica útil no antes de aproximadamente00:29UTC, salvo cambio
o incidente material. No rellenar huecos o atribuir desarrollo a la cola ociosa.

Sin nuevas misiones ordinarias, publicación GitHub, APIs, créditos, resets,
subtareas de Codex ni automatizaciones duplicadas. El servicio no crea por sí
solo una notificación al chat. Conservar cambios ajenos de package.json,
src/runtime y tests/runtime.

## Historial íntegro

La versión anterior de este estado se conserva sin cambiar sus bytes en
[STATUS-HISTORY-2026-09-14-1046.md](STATUS-HISTORY-2026-09-14-1046.md):
553 líneas, 43281 bytes, SHA-256
`a64f4e5c25a533dedb8400fb6022ce2033a438119302bcbb0d483122bfb5ae0f`.
Incluye el vínculo al historial anterior de 3225 líneas del día 13.
Sus sesiones/órdenes siguientes son históricas, no instrucciones para repetirlas.
