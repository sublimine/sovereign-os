# Inspección de contratos antes de comprometer el plan

## Estado vigente — 18:45 UTC

CS6jHM cerró18:27:37.119: inspect→plan→juicio independientes, tres inferencias
reales/73974tokens, sin reparaciones ni replay. Cobertura completa en la segunda
petición completada y plan aceptado; no ejecución del producto. Reconciliación
18:30:20.111 de pins/capturas/DB/owner y20usos de9citas. Lectura semántica
posterior de fichas/plan/juicio en
[CS6jHM](../verification/PLANNING-INSPECTION-LIVE-CS6jHM.md), sin incompatibilidad
material detectada en este caso, no calibración amplia o ahorro demostrado.
Runtime3ac05ded no instalado. Cambios posteriores de arranque tienen su propia
regresión activaC5d78Q; no extender a ellos la cualificación histórica deCS6jHM.

### Corte anterior — 18:23

Regresiónr5T3EM cerrada18:14:45.208:1285tests1284PASS/0FAIL/unSKIP,
285entradas/capturas reconciliadas18:17:49.250. EAGAIN previo no explicado.
Runtime3ac05deddcbd3fa562aaaae6ae5dc0cbbed4f1fb2206a2a1fbece8554324d6fa
cualificado18:18:39.464 y NO instalado. Ensayo simuladoQan9od pasó tres llamadas,
reentrada idéntica y todos los controles estructurales; no prueba suscripción.
El anteriorLDnmbz conserva fallo por omitir la adquisición de propietario en
el harness, corregido sólo allí. Ensayo REAL CS6jHM ACTIVO18:21:58.684,
sesión71844/owner2205273/boot2a077981-8aea-444e-8eff-44fa69814267/start50766843.
Plan-only, máximo3reservas/4llamadas, sin entrega ni producción. No cambiar
los285inputs/script/caso/spec durante la ejecución. Ver
[prerregistro](../verification/PLANNING-INSPECTION-QUALIFICATION.md).

### Corte anterior — 18:07

Actualización18:07: 6dsE55 terminó con un fallo nativo ajeno al protocolo:
TasksMax16 recibió EAGAIN en bootstrap.Popen antes del programa que crea hijos.
1285tests1283PASS/unFAIL/unSKIP328322.099517ms/sesión77989exit1;
fin18:01:47.448 y285pins/cuatro capturas/owner ausente reconciliados18:03:30.732.
El mismo test aislado1/1PASS1120.899033ms/sesión20337. No se ha demostrado
causa ni corregido ese comportamiento. Ningún límite/prueba se modifica. Nueva
global usa concurrencia de archivos1 para reducir contención, manteniendo
pruebas de concurrencia internas. No ejecutar ensayo de suscripción todavía.

### Corte anterior — 17:58

Actualización17:58: adb7Hg CERRADA17:54:08.272/sesión93489exit0,
1284tests1283PASS/unSKIP324488.499985ms,285inputs/started/cuatro capturas/owner
ausente reconciliados17:54:50.190. Se añadió después el test que reproduce close
fallido tras respuesta conservada: RED0/1FAIL640.887589ms. Worker.infer ahora
propaga el fallo de cierre de inspección como CLEANUP_UNCONFIRMED y engine.plan
conserva actor/quality0/respuesta. No afirma haber limpiado un proveedor real.
18/18dirigidasPASS13404.590533ms/sesión57330; seis cortes de proceso conservados.
Global6dsE55 ACTIVA17:56:19.026/sesión77989/owner2191962/start50612910/boot2a077981-8aea-444e-8eff-44fa69814267,
285inputs fijados; no editar hasta cierre. El harness plan-only está escrito y
pasa node --check, pero NO ejecutado ni simulado aún; no equivale a integración
con suscripción. Último runtime cualificado sigue siendo f5813eb… previo al bucle.

### Corte anterior — 17:52

Actualización17:52: K4eMBU terminó17:46:29.575/sesión55489exit1 con
1284tests1279PASS/cuatroFAIL/unSKIP324457.549927ms.285inputs/started/cuatro
capturas/owner2180577 ausente reconciliados17:47:28.666; summary
39e2c04cebaa537b70253a885bb639a806b8a2ab9a326ca2ab57a543cc6358e8.
Dos lectores nuevos suponían policy presente en fixtures históricos: acceso
opcional corregido, fixtures intactos,11/11PASS405.191931ms. Global adb7Hg
ACTIVA17:48:43.668/sesión93489/owner2186260/start50567377/boot2a077981-8aea-444e-8eff-44fa69814267,
285inputs fijados. NO editar antes del cierre. Diagnóstico sintético adicional
de cierre de proveedor confirmó un defecto pendiente: una respuesta durable
seguida de close PROTOCOL consume calidad y borra active (una llamada/un mensaje,
qualityFailures1/active null). Debe conservarse como fallo de infraestructura,
sin acreditar limpieza ni comprar otra respuesta. Aún no se corrigió ni se
ejecutó el ensayo de suscripción. El script prospectivo en experiments/ está
escrito pero no probado; K4eMBU NO cualifica ningún runtime.

## Estado vigente — 17:38 UTC

Implementados en desarrollo respuesta de control durable, reserva/padre de plan
versionado, preparación local idempotente, controlador inspect/plan, Worker/Engine,
CLI e informe. No instalados ni llamados con proveedor real. API explícita:
`planningContracts:{mode:'on-demand-v1',maxCalls:N,maxBytes?:B}`. CLI de desarrollo:
`--planning-contracts on-demand-v1 --planning-call-limit N`, con bytes opcionales.
No cambia misiones anteriores, preset, modelos/esfuerzo, permisos ni cuota. El
SDK es FactoryEngine existente; no se crea otra abstracción de orquestación.

Orden y razón:

| Frontera | Por qué está aquí | Qué NO acredita |
| --- | --- | --- |
| Reserva+solicitud exacta | Impedir gasto sin techo durable antes del proveedor | Dispatch o facturación completados |
| Mensaje+recibo atómicos | Recuperar el resultado público sin comprar un reemplazo | Calidad ni aceptación |
| Preparación de fichas | Resolver la petición de IDs íntegros para la llamada siguiente | Que el modelo ya las recibió |
| Cobertura de petición completada | Exigir las fichas de todas las asignaciones antes del candidato | Comprensión o compatibilidad semántica |
| Juez independiente | Revisar mandato, orden, métodos y fichas de la propuesta | Veracidad de datos aún no adquiridos |
| Producción/fuentes y revisión | Obtener datos antes de respaldar hechos y aceptar productos | Perfección universal |

No confundir comprobación de contratos del PLAN con verificación factual de
datos futuros. Esta opción no fuerza planificación en una entrada cerrada
elegible ni descarga154fichas. Si las fichas ya estaban en feedback válido, una
propuesta puede pasar sin una consulta ceremonial. Consulta redundante produce
PLANNING_INSPECTION_STALLED, no bucle infinito: conserva techo y feedback.
Fallo capturado de proveedor puede abandonar la inferencia, sin afirmar su
completitud remota; próxima recuperación usa otro actor y otra reserva. Caída
sin desenlace durable queda PENDING y no se repite. Persistencia tras respuesta
validada no consume un fallo de calidad. Se excluyen overlays planning anteriores.

Pruebas:97/97dirigidasPASS3265.696004ms/sesión54371exit0 antes de integración.
Primer archivo de respuesta RED: módulo ausente (0/1FAIL342.102569ms).
Primera ejecución respuesta+presupuesto:40PASS/1FAIL3616.449254ms; fallo del
arnés al pedir journal limpio tras borrar deliberadamente un head. Se corrigió
la comprobación comparando eventos; no se relajó el lector. Integración RED
0/6FAIL699.749244ms porque Engine.create no admitía aún la opción; después
6/6PASS4630.005397ms/sesión31964. Ampliación9/9PASS6244.575523ms/sesión86065.
Última dirigida15/15PASS15312.500653ms/sesión67502 incluye seis cortes REALES
exit86 en reserva, respuesta no confirmada, consulta confirmada, preparación,
plan confirmado y candidato confirmado. SQLite/Engine reales, modelo simulado.
Capturas originales de la fase documental no tocadas. No ensayo real activo.

Regresión de seis archivos CERRADA212/212PASS57754.533062ms/sesión81951exit0.
Incluye CLI/informe y engine/catálogo/contrato/reserva/respuesta completos, no sólo
el filtro on-demand. Después se añadió la misma guarda a ArtifactRegistry.create
y recuperación del candidato: una consulta no autoriza un artefacto-plan ni una
respuesta completada permite cambiar su cuerpo.17/17 dirigidas posteriores PASS,
15345.870026ms/sesión67024exit0. Global K4eMBU ACTIVA17:41:05.010,
sesión55489/owner2180577/boot2a077981-8aea-444e-8eff-44fa69814267/start50521471,
285inputs fijados. No editar inputs hasta cierre/reconciliación. La inspección
del directorio de suites falló inicialmente por una suite histórica sin started;
se corrigió sólo el comando de lectura, no el arnés ni sus inputs activos.
Último runtime f5813eb…/vdN9yi NO cubre estos cambios.

## Historial — 17:21 UTC

Implementados en desarrollo `planning-inspection-contract.mjs` y
`planning-inspection-budget.mjs`, con pruebas y fixture de contención real.
Contrato puro inspect/plan, política explícita con maxCalls obligatorio y
maxBytes≤262144, y reserva prospectiva global por misión en la misma transacción
que solicitud exacta/run pendiente. Deriva el consumo de registros inmutables,
no de un contador mutable ni del número de actores. No ejecuta al proveedor ni
implementa aún cursor, respuesta de control durable o política pública de Engine.
79/79 PASS2515.834709ms/sesión67589exit0 (29 catálogo+27 contrato+23 reservas).
Primer RED de cada módulo nuevo fue fallo de carga por módulo ausente. Contención
real: un proceso reserva y otro recibe PLANNING_INSPECTION_LIMIT; cero artefactos.
No overlay de planificación evaluado bajo otro protocolo ni extensión implícita
del presupuesto. Una reserva no demuestra dispatch, facturación ni respuesta.
Última global vdN9yi y runtime f5813eb… cualificado16:55:51.388 NO cubren estos
cambios. Pendiente respuesta durable enlazada a reserva/solicitud/recibo exactos,
cursor recuperable y activación explícita de Engine/Worker/CLI/SDK.

## Historial — 16:54 UTC

Estado16:54 UTC: bckJet está cerrado como INTERRUPTIDO/NO CUALIFICADO;
no hay un ensayo vivo esperando. La consulta de fichas sigue sin implementación.
La selección local íntegra, el diagnóstico de cobertura y su vínculo con una
respuesta final ya completada están implementados en desarrollo; todavía no
son el bucle de consultas.29/29pruebas del módulo y25pruebas dirigidas de engine
PASS (más un archivo sin tests seleccionados en el resultado26 del arnés).
Regresión completa de engine y plan-role-review CERRADA119/119PASS,
48218.008026ms/sesión41713exit0. Global vdN9yi CERRADA16:53:23.420:
1196tests1195PASS/unSKIP314916.497427ms,276inputs/capturas/owner ausente
reconciliados16:53:58.933. Runtime f5813eb509612afd36483951c95f768e6962c666c34e9a75f5be71bccee8b073,
414archivos24037582B, verificado y NO instalado. No inferencias reales nuevas.
Su prerrequisito de respuesta final de plan durable ya está implementado en
desarrollo:19/19pruebas dirigidas PASS, ampliación de integridad y regresión
de seis archivos cerrada227/227PASS. Global UWzy5t cerrada1165tests1164PASS/unSKIP;
276inputs/capturas/owner ausente reconciliados16:31:23.023. Runtimefc4ef5fe
verificado, NO instalado. Esto no cualifica un protocolo de consultas aún ausente.
Ver [frontera de recuperación](../verification/PLANNING-RESPONSE-DURABILITY.md).
Las métricas y argumentos siguientes son observaciones históricas, no nueva
política de inspección adoptada. La optimización documental local anterior cerró.

Estado2026-09-13: propuesta acotada, **no implementada ni adoptada**. No modifica
el ensayo vivo bckJet, sus274inputs o su segundo plan. Se escribe mientras se
espera su ejecución para no confundir investigación local con una reparación
externa del ensayo. Complementa [PLAN-ROLE-REVIEW.md](PLAN-ROLE-REVIEW.md).

## Problema observado y coste

En bckJet el plan inicial asigna omega_11 a un JSON sin representar sus salidas
forenses. El planificador ve ID, título, capacidades y propósito; el juez sí
ve la ficha íntegra y devuelve la incompatibilidad. La recuperación recibe
las fichas y propone expediente→aceptación→síntesis. El segundo plan pasa su
revisión, no demuestra todavía cumplimiento documental ni eficiencia general.

La primera propuesta/rechazo cuesta55916tokens; ambas rondas de planificación
suman128296tokens. No todo ese coste es evitable: una propuesta inicial y una
revisión independiente siguen siendo necesarias en la ruta planificada. Una
consulta añadida puede costar más que lo ahorrado, y no garantiza que el modelo
interprete correctamente las fichas. El problema es informativo y contractual,
no se resuelve renombrando el agente ni suprimiendo el juez.

Medición offline12:40:50.335 de objetos JSON íntegros del catálogo actual:

| Vista | Bytes |
| --- | ---: |
| Directorio154roles | 37905 |
| Todas las fichas completas | 3061603 |
| Directorio más todos los contratos de salida | 225981 |
| Directorio más contratos de entrada y salida | 765161 |
| Sólo fichas íntegrasomega_11/omega_22/veritas_06 | 19462 |

No son tokens, inferencias ni una mejora medida de calidad. Cargar todas las
fichas aumenta mucho la exposición y el coste; enviar sólo salidas continúa
omitiendo métodos, entradas e independencia. Añadir otro ID a una lista de
excepciones conserva el problema general. La medición de umbrales del codec
es independiente y tampoco permite atribuir calidad a unos bytes menos.

## Hipótesis de diseño a contrastar tras el cierre

La ruta planificada podría permitir consultas locales, acotadas y persistidas
de fichas completas **antes** de presentar un candidato al juez. No crear otro
agente ni una fase obligatoria para respuestas cerradas. Usar getRole/selectCards,
las fichas verificadas y recordInferenceRequest existentes; ninguna búsqueda
externa, copia resumida o parser paralelo del catálogo.

Contrato propuesto, pendiente de elegir interfaz y presupuesto:

- Consulta explícita por IDs exactos del directorio; no rutas, URLs, expresiones
  ni IDs improvisados. Un lote pequeño de candidatos independientes, no154roles.
- El controlador entrega cada ficha completa con su hash y originalAudit. Se
  conserva la solicitud que pidió las fichas y la solicitud posterior que las
  incluyó. Preparar fichas no equivale a haber completado esa inferencia.
- Una selección sólo puede llegar al juez si el mismo intento de planificador
  recibió sus contratos completos en una inferencia terminada. Las fichas ya
  presentes en knownRoleContracts/rejectedRoleContracts cuentan únicamente si
  los bytes y la exposición exacta se verifican. El juez conserva su colección
  completa y revisión independiente; no hereda un sello de compatibilidad.
- Una propuesta temprana puede servir de diagnóstico de contratos ausentes,
  pero no se acepta ni se ejecuta provisionalmente. Debe existir respuesta
  posterior del modelo con esos contratos; nunca autorrellenar un plan válido
  desde una propuesta no revisada ni llamar aceptación al simple envío de fichas.
- Persistir por misión, run, intento, política, solicitud y catálogo. Sin cache
  de autoridad entre misiones, IDs reusados, versiones, productores o jueces.
- Consultas, refinamientos y errores cuentan en coste y techo de llamadas.
  No consumir silenciosamente qualityFailures como si inspeccionar fuese un
  rechazo; tampoco crear un bucle ilimitado de consultas fuera de los límites.
- Retomar un candidato durable sólo su revisión; una consulta pendiente o una
  inferencia interrumpida no se convierte en observación completed. Diseñar
  explícitamente la recuperación de ese estado antes de añadir la nueva rama.
- Política versionada y opt-in; los paquetes, misiones cerradas y ruta v2 sin
  planificador conservan su semántica. Un contrato cambia obligaciones, no
  permisos; la ausencia de adaptador nativo continúa siendo ausencia real.

## Condiciones antes de implementar

Leer rutas actuales de plan(), infer(), progreso/reentrada, límites y catálogo
completas; evitar un segundo planificador paralelo. Resolver si la consulta se
expresa como unión discriminada o como respuesta de control separada. Determinar
límites a partir del presupuesto lógico y total, no de un número decorativo de
agentes. Congelar protocolo, criterio y negativas antes del ensayo real.

Pruebas mínimas: IDs inválidos/duplicados, ficha cambiada, truncación/contexto
excedido, recibo pendiente o de otro run, contratos parciales, rol nuevo en el
plan final, respuesta sin consulta previa cuando falta contrato, replay,
interrupción antes/después de persistir, agotamiento sin rebajar criterios,
revisión incompatible aun después de leer, rutas antiguas y cerradas intactas.
Verificar conservación íntegra del mandato, las fichas y cada propuesta fallida.

Prueba causal posterior sobre tareas distintas y prerregistradas, incluyendo
una sin defecto inicial: coste total, rechazos materiales, cobertura contractual
y entrega correcta. No duplicar bckJet para presentar el mismo caso aprendido
como validación general. Ni reducir tokens aislados ni pasar un juez certifican
superioridad mundial o que todo método del catálogo sea ejecutable.

## Inspección del flujo existente — 15:32 UTC

Leídos plan()/ensurePlan() en engine.mjs, createRun()/infer() en workers.mjs,
PLAN_SCHEMA/validatePlanProposal() y plan-role-review.mjs. El planificador hoy
recibe la ficha íntegra omega_23 como suplemento de un fallo conocido y las
fichas de asignaciones previamente rechazadas, no todos los contratos posibles.
El juez obtiene todas las fichas seleccionadas mediante planRoleReviewContext.

La integración no puede ser un bucle de consulta superficial añadido a plan():
cuando active no tiene candidato durable, la reentrada actual crea otro run.
Eso no conserva por sí solo el estado de una inspección nueva. infer() valida
la respuesta tanto en el callback del proveedor como tras generate(), de modo
que ese validador no debe guardar consultas ni gastar presupuesto como efecto
lateral. Adjunta el recibo y devuelve value; la capa llamadora debe conservar
la propuesta y resolver explícitamente una caída entre recibo y progreso.

Por tanto, antes de implementar hay que definir: registro idempotente de cada
respuesta de control con requestHash/recibo, estado de consulta que sobreviva a
reentrada sin equiparar PENDING con lectura, techo total de inferencias de este
protocolo y preservación de calidad/revisión independiente. No hay interfaz,
presupuesto o política nuevos adoptados en este corte. El parche de autenticación
y su medición local tienen prioridad; el código de planificación no se cambió.

## Frontera de respuesta durable — 15:52 UTC

Los tests existentes de cuota de revisión conservan el candidato de plan y no
repiten su producción; esto no prueba recuperación de una consulta sin candidato.
También verifican que qualityFailures/feedback no se reseteen al reabrir SQLite.
El nuevo protocolo deberá conservar ambas propiedades, sin convertir consultas
en candidatos aceptados o reiniciar el presupuesto por abrir otro proceso.

Antes de conectar inspección, se necesita un registro de respuesta estructurada
validada ligado a run, requestHash, schemaHash y recibo, persistido junto a la
finalización local. Guardar sólo el recibo no conserva qué fichas se pidieron
o qué plan se propuso. El callback validate de infer es invocado dos veces y
debe seguir sin efectos de persistencia/coste. La recuperación debe distinguir:

- Solicitud pendiente sin respuesta durable: no acreditar lectura completada.
- Respuesta inspect durable: resolver IDs exactos y construir fichas completas;
  su preparación todavía no es exposición completada al planificador.
- Petición posterior terminada con esas fichas: comprobar bytes/hashes y permitir
  únicamente las asignaciones cuyo contrato se incluyó de verdad.
- Respuesta plan durable sin candidato: materializar el mismo plan, sin repetir
  el modelo; normalizaciones existentes y revisión independiente siguen siendo
  obligatorias y se conservan como eventos distintos.
- Candidato durable: reanudar sólo su revisión, como ya hace el flujo vigente.

Una caída antes de persistir respuesta y recibo conserva una incertidumbre real;
un registro local no puede garantizar que una llamada remota nunca se repita.
No introducir recuperación ficticia de conversaciones del proveedor ni llamar
exactly-once a lo que todavía no está demostrado. No se ha elegido API de
retención, esquema, presupuesto o política pública, ni cambiado producción.

## Primera implementación acotada elegida — 16:03 UTC

Antes de la consulta de fichas, conservar la respuesta de PLAN_SCHEMA en un
registro planning-response v1, junto con attachInference en la MISMA transacción
local. Ligarlo a run productor/planning/purpose plan, misión/intención/política,
configuración del trabajador, solicitud previamente retenida, esquema exacto,
valor validado y recibo de finalización. No guardar campos privados del proveedor.
Reutilizar Store.transact, retención de solicitudes y validadores existentes;
no SDK, dependencia, caché, API o servicio nuevo para esta frontera local.

Sólo la llamada de planificación activa solicita esa retención; inferencias
ordinarias y revisores mantienen su contrato. No cambia texto/schema/modelo
enviado ni criterios, normalización final, juez o presupuesto. Es durabilidad,
todavía no el protocolo de inspección ni prueba de que el planificador leyó fichas.

Al reentrar sin candidato durable, buscar la respuesta exacta del run activo
antes de crear otro. Revalidar su integridad, ámbito, finalización y plan; crear
el candidato desde ese valor sin inferir otra vez y mantener revisión separada.
Un candidato ya existente conserva prioridad y no se recrea. Una respuesta
ausente en ejecuciones antiguas NO se reconstruye ni importa retrospectivamente.
Una respuesta existente alterada se rechaza, no se convierte en ausencia para
reintentar. La frontera sin respuesta durable conserva sus límites actuales;
no se declara exactly-once remoto ni nueva capacidad de recuperar conversaciones.

RED antes de producción: interrupción local tras respuesta y antes de candidato,
rollback conjunto si falla su persistencia, manipulación de respuesta durable,
y conservación de revisión pendiente sin duplicar planes. Después, ámbitos,
retención prospectiva, identidad/recibo/schema/política y rechazo de actores
ajenos; copia retornada sin alias y reentrada en proceso nuevo.

## Decisión de protocolo pendiente de integración — 16:29 UTC

Se descarta como solución general enviar siempre las154fichas o añadir una
selección obligatoria seguida de planificación para toda petición. Las rutas
cerradas siguen sin planificador. Para la ruta planificada opt-in, se elige una
respuesta de control discriminada: `action=inspect|plan`, IDs, motivo y plan
nullable. En inspect no hay plan ficticio; en plan no hay una operación local
disfrazada. Se reutiliza el patrón de acciones explícitas del protocolo
documental, no una herramienta de host arbitraria ni otro agente.

La rama inspect sólo admite IDs existentes y únicos, fichas íntegras de
getRole/selectCards y un límite agregado de bytes. Una selección nueva ha de
añadir información; repetir la misma no es un cambio de método. Las fichas
conocidas/de recuperación pueden evitar consultas, pero sólo si la solicitud
que obtiene el plan final contiene sus objetos completos e idénticos al catálogo.
Un directorio, resumen, hash aislado, IDs en una respuesta o ficha preparada
fuera de esa solicitud no satisfacen esa condición. La versión de catálogo se
conserva en el contexto/procedencia, no se infiere desde el nombre del rol.

El chequeo prospectivo de cobertura contractual debe ser un módulo puro antes
de conectar estado/inferencias: dado el plan propuesto y la solicitud retenida
exacta, identificar roles presentes completos, faltantes o alterados. Usarlo
para diagnosticar una propuesta no la acepta ni demuestra comprensión. El juez
continúa evaluando métodos, entradas, independencia y salidas con todas las
fichas; el control de exposición no puede sustituir ese juicio semántico.

La respuesta final durable implementada no basta para conservar una secuencia
de consultas. El protocolo nuevo necesita mensaje por solicitud y cursor de
control actualizados junto al recibo, más frontera de preparación/dispatch:
READY → PENDING → RESPONSE → READY o candidato. Una caída no puede localizar
otro mensaje a partir de un recibo cambiado, confundir una respuesta anterior
con la solicitud pendiente, ni repetir silenciosamente una llamada incierta.
El presupuesto de consultas se conserva por intento/misión, no por apertura
de proceso; los errores y las llamadas fallidas permanecen contabilizados.

Todavía no se ha adoptado una política CLI/SDK, un número de consultas o una
regla de reintento nuevo. Esos cambios requieren integración y negativas antes
de ensayo real. La siguiente pieza local es cobertura exacta de fichas en la
solicitud, seguida de retención/cursor y motor. No se promete ahorro causal:
añadir una consulta puede aumentar el coste cuando el primer plan ya era correcto.

## Primera pieza de inspección — implementada 16:45 UTC

`inspectPlanningRoleContracts` reutiliza selectCards y conserva todas las fichas
seleccionadas con sus referencias originales. El límite existente256KiB incluye
el sobre completo; se puede reducir pero no subir ni truncar. Rechaza selección
vacía, IDs ajenos, duplicados, valores de presupuesto inválidos y volcado completo
del catálogo. Seleccionar localmente sigue sin acreditar inferencia completada.

`planningRoleCoverage` compara todos los roles productores/revisores del plan
propuesto con las colecciones designadas knownRoleContracts,
rejectedRoleContracts e inspectedRoleContracts. Comprueba schemas, colección,
hash y contenido íntegro de cada ficha frente al catálogo, incluso si ya había
otra copia correcta. No cuenta directorios, campos arbitrarios, una declaración
de lectura ni certificados del llamador. Es un diagnóstico puro: no valida
semántica, finalización, candidatos o aceptación. Los accesores JS se rechazan
sin ejecutarlos, y se conservan aislados catálogo, entrada y objetos retornados.

`readPlanningContractCoverage` añade el vínculo real con la respuesta durable:
misma instantánea y verificación de solicitud/actor/política/configuración/recibo/
cronología de readPlanningResponse, reutilizando el task decodificado una vez.
Devuelve referencias exactas de solicitud y respuesta, cobertura y límites
explícitos sobre el plan original. No acepta ni cambia una misión, no suple
fichas ausentes y no mezcla los controles normalizados con comprensión del modelo.
Las APIs previas de recuperación conservan su resultado público anterior.

Evidencia: pruebas nuevas rojas por falta de las APIs, módulo posterior29/29PASS,
603.852593ms. La primera integración de cobertura quedó0/6PASS1964.295679ms;
tras implementar el vínculo quedó5PASS/1FAIL2128.852198ms. El fallo restante era
del proveedor simulado de engine.test: hacía JSON.parse antes de reconocer el
header source-text-v1. Se sustituyó por el decodificador íntegro existente
readSourceContextView, sin alterar transporte o criterios de producción.
Después, sesión33465exit0:25tests dirigidos de engine PASS6791.248634ms y un
archivo adicional sin casos seleccionados (26reportados en total). No contar
este último como29pruebas del catálogo. Se añadió rechazo explícito de presupuesto
null; engine y módulo completos CERRADOS119/119PASS48218.008026ms,
sesión41713exit0, antes de nueva global.

Incluye cuatro formatos de contexto, ficha ausente del juez, recuperación
posterior con fichas completas frente al directorio inicial y ficha acortada
que se rechaza aun dentro de una petición completada con hash coherente.
No se introduce todavía estado READY/PENDING/RESPONSE, presupuesto de consultas,
schema de control operativo, política CLI/SDK ni cambio de ruta en engine.

## Fronteras para la siguiente integración — 16:50 UTC

La inspección del código de aprendizaje muestra que sus overlays se evalúan
contra un ámbito y petición concretos, no contra este nuevo protocolo de control.
Una integración opt-in deberá excluir explícitamente overlays de planificación
no evaluados bajo ese contrato, como ya hacen los protocolos documentales/cerrados.
No cambiar modelo o esfuerzo ni importar el mismo prefijo aprendido porque las
fichas del productor tengan iguales IDs. Los otros trabajadores conservan su ruta.

El presupuesto nuevo debe ser explícito, global a la planificación de esa misión
y durable, separado de maxPlanAttempts (correcciones de calidad). No renacer al
crear otro run ni al reabrir proceso. Reservar un intento de inferencia junto a
la solicitud prospectiva, no dentro del callback validate invocado dos veces.
Contabilizar solicitudes intentadas y respuestas observadas por separado: una
cuota no es un rechazo semántico ni prueba de consumo de tokens. No elegir un
número óptimo sin medición; no activar la política por defecto en misiones viejas.

Cada respuesta de control necesita identidad propia ligada a la solicitud,
su run/version de finalización y cadena anterior. El cursor no puede localizar
una respuesta sólo desde un recibo mutable. La respuesta y el recibo se guardan
juntos; la selección de fichas y el avance del cursor se guardan como un paso
local separado e idempotente. Conservar READY, solicitud PENDING y RESPONSE
sin intercambiarlas. Un dispatch sin resultado ni fallo reconciliable no se
convierte en permiso implícito para repetir una llamada remota.

Una respuesta plan con contratos aún ausentes puede conservarse como propuesta
provisional y diagnóstico: preparar los contratos faltantes para la siguiente
solicitud, sin candidato aceptable todavía. Sigue haciendo falta una respuesta
posterior que los haya recibido. Esto evita repetir el mismo error por carecer
de las fichas y no cuenta una preparación local como lectura. Una selección
explícita o provisional debe añadir contratos faltantes; repetir lo ya aportado
no consume consultas ilimitadas ni se presenta como método distinto.

Pruebas antes de activar: reservas y commits atómicos, fallo de almacenamiento,
cuota/timeout/cancelación y salida de proceso en cada frontera; mensaje antiguo
con solicitud nueva pendiente; cursor/actor/política/catálogo alterados; mismos
IDs con diferentes bytes; presupuesto global persistente a través de retornos;
propuesta temprana no aceptada, lectura posterior completa y juez que aún puede
devolver incompatibilidad. Las normalizaciones actuales no crean nuevas fichas
de rol: sus controles completos siguen formando parte de la revisión del plan.
