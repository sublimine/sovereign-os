# Estado de aceptación — 13 septiembre 2026

**Mandato completo pendiente. No es un certificado de release.** Distinguir implementación, ensayo aislado y comportamiento demostrado de extremo a extremo.

## Estado vigente — 13 septiembre, intervención local 22:44 UTC

Global R62Cdt activa22:43:29.439 / sesión31527 / owner2313502. 298 inputs fijados:
NO editarlos durante la batería. Esperado1434tests si no hay fallo/interrupción,
no resultado todavía. Presupuesto compartido integrado en desarrollo; nueve
archivos cerraron433PASS/0FAIL157220.439974ms (56604exit0 observado22:42:49).
Agotamiento no consume calidad; recibo sin reserva ahora rechazado; ambos
contraejemplos rojos conservados en MISSION-INFERENCE-BUDGET.md. No inferencia
real, instalación, cambio de servicio ni nuevo checkpoint. R01–R16 pendiente.

### Corte anterior — 22:35 UTC

En desarrollo: nuevo presupuesto explícito de misión mission-calls-v1 compartido
por entrada, planificación, producción, jueces, réplicas y source.search. Reservas
inmutables atómicas, no tokens ni refund tras caída; sin cambio del preset ni
instalación. Es implementación nueva posterior a 7fad/hWOjuv: NO cubierta por esa
global. Ver ../design/MISSION-INFERENCE-BUDGET.md.

35 pruebas iniciales PASS; ampliación a cuatro SIGKILL reales y dos procesos
compitiendo por la última reserva PASS. Batería 170 tests cerrada 169 PASS/1 FAIL,
82245.376251 ms / sesión 53411 exit1. Fallo confirmado: agotamiento global en
planificación se clasificaba como defecto de calidad, hasta NEEDS_DIRECTION
genérico. Corregida propagación; test exige cero qualityFailures y actor único.
Retest dirigido activo sesión 54767. No inferencias reales ni servicio modificado.
Producer checkpoint y reutilización de threads siguen sin implementar.

### Corte anterior — 22:14 UTC

Global hWOjuv cerrada 22:12:15.352 / sesión 21227 exit 0: 1385 tests,
1384 PASS, cero FAIL y un SKIP, 573563.123748 ms. Auditoría 22:14:25.861:
owner ausente, 295 entradas, comandos y cuatro streams concordantes.
Summary 295c9e5c174f8ba7c9b03f04eaa4422e08e279960dcd4dd9dd49006df212b747.
Runtime 7fad65239cee0c09a95ac2643ad63f98a42c828e85201a5176b589d5c48e7bbb
congelado/cualificado: 421 archivos, 24103644 B, NO instalado.

Exposición temprana de límites operativos implementada exclusivamente en
read-test-v1 opt-in: planificador y productor conocen pasos, operaciones,
tamaño de lote y riesgo conocido del reporter Node antes de actuar. No concede
permisos ni aumenta presupuestos; baseline sin selección conserva su contexto.
Nueve pruebas dirigidas y batería de seis archivos 256 PASS (19189 cerrada),
incluidas en la global anterior. Modelos simulados; ahorro real NO demostrado.
Detalle: ../design/PLANNING-OPERATION-LIMITS.md y runs/suite-hWOjuv/post-close-audit.json.

No hay sesiones activas ni nueva inferencia. Se examina reutilización de contexto
como alternativa de eficiencia; contrato de threads frescos NO modificado.
UYEoVL conserva producto aceptado y cualificación read-test fallida. No reabrir
ensayos, instalar, tocar servicio ni repetir checkpoint 09:24 de este mismo turno.
El mandato R01–R16 sigue sin aceptación completa.

### Corte anterior — 21:50

UYEoVL CERRADO21:46:09.429/35576exit2: producto COMPLETED/ACCEPT con12inferencias
REALES475172tokens y oracle externo3193. Wrapper NO CUALIFICADO: no se utilizó
ningún lote read-test; no rerun ni cambio de criterios para conseguirlo.
Auditoría readonly21:48:13.627/exit0 reconcilia294pins,12capturas/limpiezas,
fichas/requests,108usos literales de citas, tres jobs+oracle, linaje/reentrada y
DB intacta ee51ac0628961ded05a7d6b21c0d20def03420fba9742563d2a68f9986e7e060.
Journal705/afbe6f4bd9688458ab331609c8add07652aa59454a2055ef999e39a76d39344f.
Lectura manual completa de archivos/plan/juicios y versiones de test sin
incompatibilidad material detectada para ese contrato acotado. Detalle
READ-TEST-DEVELOPMENT-LIVE-UYEoVL.md. c31/CvYR permanecen sin instalar.
Sin sesiones activas. Siguiente construcción: capacidades/límites visibles antes
de planificar y producir; todavía no implementado. No repetir checkpoint09:24,
alterar servicio o antiguos ensayos. R01–R16 pendiente.

### Corte anterior — 21:14

GlobalCvYR2r CERRADA21:12:19.341/48401exit0:1376tests1375PASS/0FAIL/unSKIP,
549609.49279ms.294inputs/comandos/cuatro streams/owner ausente reconciliados
21:12:48.659. Summary8d30b0abcd8fb1b2b0a156a26b596b4f8c38125c6342ac77e4dad13c029fa59f.
Runtimec31b72231354b0943fce58cfbe81c476d601062a53775d3c40b9d47f754f17b1
congelado/cualificado21:12:49.403:421archivos24101137B, NO instalado.
PreflightvSfo5K cerrado21:13:38.952/exit0, cero modelos/misiones; owner/pins/
runtime reconciliados21:14:03.227. Auditor anidado audit-development-launch.mjs
ampliado con perfil read-test-v1, syntaxPASS; todavía sin auditoría real cerrada.

Ensayo REALread-test-development-live-UYEoVL ACTIVO21:14/sesión35576, misión
mission:4e681a6d-6992-48bc-8adb-4dd0b69febf3. Único brazo14calls/60min, mismos
requisitos/modelo/criterios y nueva opción explícita. No on-demand ni promoción.
294inputs + lanzador e2bee4493b44afad234c17db8e6c249dd0946edb00d7cbf6730cbddb810246bf
y prerregistro3dd4640ec0d4d03f98e7b415ff64c4a2f6f61eba3d32aedb62cc4404ee593c1d
CONGELADOS durante el ensayo. No editar ni reabrir geTKWd/yIc6GW. Resultados y
auditoría semántica/SQLite/HMAC/jobs pendientes. Servicio/checkpoint09:24 intactos;
R01–R16 abierto. Cuota consultada antes:53%semanal usado, ningún reset/API.

### Corte anterior — 21:03

read-test-v1 implementado OPT-IN en desarrollo: planificador/productor/CLI,
scope sin overlays, sólo lecturas/listados antes de una orden exacta congelada,
sin nuevos permisos ni presupuesto. Batería5archivos223PASS87383.683273ms,
91952exit0: incluye26casos nuevos, cinco cortes de proceso reales, bloqueo
DISPATCHED incierto, recuperación de recibo sin nueva ejecución y rechazo de
salida7 pese a productor deshonesto. Modelos/jueces de estos tests SIMULADOS.
Comparación sintética5→4llamadas con8efectos reales iguales, input106246→81257B;
no ahorro de suscripción medido. Harness completo24PASS17846.502651ms,
24367exit0: ruta nueva con3archivos/lecturas/lote/test propio/revisor/oracle3193/
reentrada; aún SIM semántico. Sus primeros fallos fueron aserciones de fixture,
documentados en PRODUCER-READ-TEST-BATCH.md, no éxitos reales inventados.

GlobalCvYR2r ACTIVA21:03:09.620/sesión48401/owner2269646/boot2a077981-8aea-
444e-8eff-44fa69814267/start51733969. No editar inputs hasta cierre y reconciliación.
Prerregistro READ-TEST-DEVELOPMENT-QUALIFICATION.md y lanzador anidado creados,
sintaxis comprobada; SIN preflight ni inferencia. Futuro único brazo nuevo,
14llamadas/60min, no on-demand, no reapertura de geTKWd/yIc6GW, no instalación.
c78 cualifica la versión ANTERIOR; R01–R16 pendientes. Servicio09:24 no repetir.

### Corte anterior — 20:46

Global d4UiBq CERRADA20:30:54.193/67049exit0:1345tests,1344PASS,0FAIL,
unSKIP;500641.882425ms.289inputs/capturas/owner ausente reconciliados
20:32:06.841. Summary94d8e8b6e15181bfbfe47d9f4c9df6cd1fd2440469191aa3ea80f8574a08685b.
Runtime c78c36ebc7c865104c6924f74e24efe232157317de2f3e77bd2c03fadd5b85d0
congelado/cualificado20:32:07.485,420archivos24095244B, NO instalado. Cubre
execution-history; no nuevo juicio real ni cambio de los rechazos originales.
Se inicia siguiente cambio opt-in de lotes lectura/prueba con comando fijado:
sin escrituras en ese lote, sin presupuesto nuevo ni reanudación automática.
La nueva implementación necesitará su propia regresión; c78 no la cubre.
Sin sesiones/inferencias activas ni cambio del servicio. R01–R16 pendientes.

### Corte anterior — 20:25

Historial execution-history-v1 implementado en desarrollo: completo por misión,
cutoff de journal, argumentos de recibo/job autenticados y ausencia explícita;
no OWN_ACTION, no retrospectiva de STARTED ni exposición a revisión ciega.
RED2FAIL; registro/workers/motor194PASS56043.259293ms/98024exit0; historial/
ciego136PASS72668.792104ms/32197exit0. Contraejemplo adicional de snapshots
divergentes RED1FAIL, corregido; archivo25PASS4304.906708ms/83264exit0, con
ejecuciones nativas y juiciosSIM explícitos. Diagnóstico readonly20:20:43.540
recupera los3/4recibos históricos reales en6614/8588B, sin modificar las DB.
Globald4UiBq ACTIVA20:22:33.481/sesión67049/owner2253743/boot2a077981-8aea-
444e-8eff-44fa69814267/start51490343,289inputs CONGELADOS. Sin modelo activo
ni nueva instalación. No reabrir geTKWd/yIc6GW; R01–R16 pendiente.
Detalle reconstruction/design/EXECUTION-HISTORY.md.

### Corte anterior — 20:10

yIc6GW CERRADO20:03:09.762/33231exit2: una llamada REAL completa83732tokens,
RETURN16PASS/1UNKNOWN por argumentos de una ejecución del revisor anterior no
expuestos. Se confirmó recibo auténtico y omisión en request; no defecto de código
ni ejecución prohibida demostrados. Motor conservó RETURN; guard bloqueó nuevo
productor. Original/copia/fichas/capturas/287pins/109usos de41citas reconciliados
20:05:44.732. DBcopiarf2f7829…/journal864/c611ce82…; originalgeTKWd intacto.
Detalle DEVELOPMENT-TIMEOUT-RECOVERY-RESULTS.md. Sin llamada o sesión activa.
Se implementa corrección causal de exposición de historial de ejecuciones;
WDa/8b451 califican la versión PREVIA, no cubrirán el cambio siguiente. No rerun
ni instalación. Checkpoint productor sólo preflight experimental20testsPASS,
sin integrar: prioridad a corregir la brecha de evidencia real. R01–R16 pendiente.

### Corte anterior — 19:50

WDaIpM CERRADA19:42:14.150/sesión98341exit0:1319tests1318PASS/0FAIL/unSKIP,
479188.551923ms.287inputs/capturas/owner ausente reconciliados19:43:50.255;
summary5405bd333aa8cabcb6159b805aa70a7350d9af0a04dc743ea694a0f4e439d739.
Runtime8b451fa36e3a9af74c85482610ddecf0dda599fa9675081060f62632e3fb6e4a
congelado y cualificado19:47:58.153:419archivos24086702B, NO instalado.
Recuperación en COPIA: simulaciónVUIE8X cerrada19:48:26.925/91564exit0,
15comprobaciones estructuralesPASS/oracle3193/reentrada sin producir ni escribir.
Juicio nuevo SIMULADO, no aceptación semántica real. Owner/pins/recibos/DB y
origen intacto reconciliados19:49:21.388. Ensayo de recuperación REALyIc6GW
ACTIVO/sesión33231, máximo UNA nueva revisión/25min, mismos criterios/modelo,
sin otra producción ni reparación de respuesta. Mantener287inputs/script/spec
congelados. OriginalgeTKWd permanece FAILED, sin oracle propio. Recuperación
no demostraría ruta inicial completa. Mandato R01–R16 pendiente; sin instalación.

### Corte anterior — 19:34

Batería motor/cola/proveedor CERRADA sesión36301exit0:162tests161PASS/0FAIL/
unSKIP54705.115042ms. Incluye7pruebas nuevas de timeout y recuperación sin
duplicar escritura; no prueba modelo real ni corrige la causa remota de geTKWd.
Global WDaIpM ACTIVA19:34:14.895/sesión98341/owner2236287,287inputs fijados.
No editar esas entradas hasta cierre/reconciliación. Sin nuevos modelos/runtime
o instalación; geTKWd sigue fallido y conservado. R01–R16 no terminado.

### Corte anterior — 19:31

geTKWd CERRADO19:22:14.715/sesión66181exit2: timeout de900000ms del juez de
producto.12llamadas/11respuestas completas REALES/384445tokens observados; uso
de la llamada vencida DESCONOCIDO. Tres ejecuciones auténticas con STARTED
post-exec, dos versiones; productor y revisor comparten snapshotv2. Sólo plan
aceptado; candidato CANDIDATE, sin dictamen final/oracle/reentrada. Owner/pins/
capturas/recibos/3jobs/DB reconciliados19:24:01.492, journal695/d6595462…,
DBc53294d4… sin cambio. Detalle DEVELOPMENT-LAUNCH-LIVE-geTKWd.md.
El timeout no consume calidad y la cola ya lo reintenta con presupuesto finito;
no era un fallo terminal de esa cola. En desarrollo se armoniza el estado a
WAITING_PROVIDER: RED4/4FAIL por recibir FAILED; después7/7dirigidasPASS
3832.664875ms, incluidas recuperación en4fases, cola legado/nueva y archivo real
sin repetir escritura. Proveedor SIMULADO en esas pruebas. Tres archivos
completos ACTIVO sesión36301 desde19:30:43; sin inferencias reales.
C5d78Q/ba266… NO cubren esta modificación posterior. No nuevo freeze/instalación.
PRODUCER-CHECKPOINT.md es PROPUESTA para reducir coordinación, no implementación
ni cambio de política de geTKWd. No reabrir original ni repetir hasta verde.
R01–R16 abierto; servicio instalado y único checkpoint09:24 sin cambios.

### Corte anterior — 19:10

geTKWd sigue ACTIVO (sesión66181). Plan aceptado por juez separado:14requisitos,
19criterios finales, un especialista autónomo de implementación y omega_22 como
revisor. Once llamadas reales cerradas; revisión de producto en curso. Leídos
íntegros módulo, test y README actuales, sin incompatibilidad material detectada
con su contrato acotado. El productor conservó su primer recibo (PASS agregado),
añadió barrera await/finalización de38casos y ejecutó de nuevo. Ambos recibos
observados tienen STARTED post-exec, exit0 y hashes de instantánea distintos:
no mezclar evidencia de versiones. Falta revisión propia del juez, oracle3193,
cierre y reconciliación de todos los execution-job/fuentes/capturas. No resultado
final ni aceptación general.287inputs/script/spec continúan congelados.

### Corte anterior — 18:50

C5d78Q CERRADA18:47:08.140/sesión36232exit0:1312tests1311PASS/0FAIL/unSKIP,
512855.011733ms.287entradas/started/cuatro capturas/owner2212962 ausente
reconciliados18:47:29.393; summary
ca02ed45d380870e2b61462c3582f826d62d8c59b8ad82a9ab84c40a22ab2fc1.
Runtimeba2662d3746e2f501f0078a43a55680bfdf56747bceddb4842b2abba553eff4a
cualificado18:48:20.225,419archivos24086684B,NO instalado. Preflight0Apwg7
cerrado18:48:30.700 con cero llamadas/misiones, owner/pins reconciliados18:48:57.622.
Ensayo REAL desarrollo geTKWd ACTIVO18:49:11.734/sesión66181/owner2219697/boot
2a077981-8aea-444e-8eff-44fa69814267/start50930155. Misión de ensayo
mission:1d560379-de07-4c01-9602-d936b8bea84e, entrada derivó correctamente a
planificación; propuesta en curso.18llamadas máximo/90min, tres archivos,
oracle3193 después de entrega. NO activa on-demand-v1. No editar287inputs ni
experiments/development-launch-qualification.mjs o su preregistro mientras corre.
Sin cambio de servicio/instalación ni replay de casos anteriores. R01–R16 abierto.

### Corte anterior — 18:45

Confirmación de arranque implementada en desarrollo: EXECUTION_START para fallo
sin post-exec; GO/READY no equivalen a ejecución. RED nativo0/1FAIL914.786446ms,
parser24/24PASS, tres nativas3/3PASS. Batería de tres archivos61/61PASS
43435.469902ms/sesión64049exit0. Incluye recuperación real, límites intactos,
broker FAILED durable/sin replay y cinco salidas inmediatas con señal drenada.
Global C5d78Q ACTIVA18:38:35.206/sesión36232/owner2212962/boot
2a077981-8aea-444e-8eff-44fa69814267/start50866529,287inputs fijados. No editar
hasta cierre/reconciliación. Sin nuevo runtime/instalación o modelos activos.
Siguiente prueba de desarrollo completo preregistrada en
DEVELOPMENT-LAUNCH-QUALIFICATION.md; lanzador anidado pasa node --check, todavía
sin ejecutar. No cambia el caso ni oracle existentes y NO activa on-demand-v1.

### Corte anterior — 18:31

CS6jHM CERRADO18:27:37.119/sesión71844exit0: tres inferencias REALES,73974tokens,
consulta→propuesta→juez, plan aceptado y reentrada exacta sin llamadas adicionales.
Owner ausente/pins/runtime/DB/capturas/20usos de9citas reconciliados18:30:20.111.
Lectura semántica acotada de fichas/plan/juicio sin incompatibilidad material
detectada; no producto ejecutado, ahorro demostrado ni aceptación completa.
Ver PLANNING-INSPECTION-LIVE-CS6jHM.md. Runtime3ac05ded NO instalado.
Defecto de ejecutor reproducido18:28: ejecutable inexistente registrado como
ejecución con exit1; programStarted se fijaba al enviar GO, no tras exec.
Corrección pendiente, ver EXECUTION-LAUNCH-PROOF.md. Sin nuevos modelos activos.

### Corte anterior — 18:18

r5T3EM CERRADA18:14:45.208/sesión98675exit0:1285tests1284PASS/0FAIL/unSKIP,
484033.161247ms.285entradas/started/cuatro capturas/owner2197800 ausente
reconciliados18:17:49.250; summary
e03cc0584aa40470c472f2f75793a72fbbc5fe457c75111eabd04a9bb93a4481.
Archivo de test serial (--test-concurrency=1), sin cambiar límites o concurrencia
interna. El fallo previo EAGAIN sigue sin causa demostrada ni corrección.
Runtime3ac05deddcbd3fa562aaaae6ae5dc0cbbed4f1fb2206a2a1fbece8554324d6fa
cualificado18:18:39.464,418archivos24081251B,NO instalado. SimuladoLDnmbz
falló por omitir propietario exclusivo en el harness, protección correcta.
Corregido sólo el harness: Qan9od cerrado18:20:18.353, tres llamadas simuladas,
controles estructurales PASS, sin suscripción real; reconciliado18:20:47.038.
Ensayo REAL CS6jHM ACTIVO18:21:58.684/sesión71844/owner2205273/boot
2a077981-8aea-444e-8eff-44fa69814267/start50766843. Plan-only3reservas/4llamadas
máximo, sin ejecutar productos. Primera consulta en curso, resultado pendiente.
No editar285inputs/script/caso/spec. No aceptación completa de la fábrica.

### Corte anterior — 18:07

6dsE55 CERRADA con FALLO18:01:47.448/sesión77989exit1:
1285tests1283PASS/unFAIL/unSKIP328322.099517ms.285inputs/started/cuatro capturas
y owner2191962 ausente reconciliados18:03:30.732; summary
10e1e9ed9f0750ba108546556762dc84f85003dce14902b40be5bb0250def0b2.
Fallo nativo: prueba TasksMax16, bootstrap recibió EAGAIN al lanzar el programa,
antes de que éste probara crear hijos. No es fallo de los18casos on-demand.
Padre user cgroup pids.max31475/current1254 y eventos max0 en diagnóstico
posterior; no demuestra estado exacto durante el fallo. Mismo test AISLADO
1/1PASS1120.899033ms/sesión20337exit0. Causa puntual no demostrada ni corregida.
Nueva global r5T3EM ACTIVA18:06:41.098/sesión98675/owner2197800/boot
2a077981-8aea-444e-8eff-44fa69814267/start50675119,285inputs, --test-concurrency=1.
La serialización de archivos no cambia TasksMax, pruebas,
aislamiento ni concurrencia interna comprobada. Sin nuevos modelos/freeze/instalación.

### Corte anterior — 17:58

Global adb7Hg CERRADA17:54:08.272/sesión93489exit0:1284tests1283PASS/unSKIP,
324488.499985ms;285inputs/started/cuatro capturas/owner2186260 ausente
reconciliados17:54:50.190; summaryd956757f7a5a4e131dfd05cda516cda4cac394383958241b2566125015e0d6ec.
NO freeze: diagnóstico posterior identificó close fallido tras respuesta durable
tratado como calidad. RED unitario0/1FAIL640.887589ms; corrección conserva active,
respuesta y calidad0, propaga CLEANUP_UNCONFIRMED sin certificar limpieza.
18/18dirigidasPASS13404.590533ms/sesión57330exit0. Global6dsE55 ACTIVA
17:56:19.026/sesión77989/owner2191962/boot2a077981-8aea-444e-8eff-44fa69814267/
start50612910,285inputs fijados. No editar hasta cierre. No runtime nuevo,
instalación o inferencias reales. Ensayo prospectivo plan-only escrito, sin ejecutar.

### Corte anterior — 17:38

Bucle de fichas on-demand implementado en desarrollo: respuesta durable, reserva
global, preparación idempotente, Engine/Worker, CLI e informe. No instalado ni
ensayado con modelo real.15/15 integración PASS15312.500653ms/sesión67502exit0,
incluyendo seis cortes reales de proceso/SQLite y proveedor simulado. Consulta
provisional no pasa al juez; faltan fichas→respuesta posterior. Techo sobrevive a
rechazo de calidad y cuota; persistencia fallida no compra otra respuesta.
Seis archivos dirigidos CERRADOS212/212PASS57754.533062ms/sesión81951exit0.
Después guarda compartida en creación de artefactos/recuperación:17/17dirigidas
PASS15345.870026ms/sesión67024exit0. Global K4eMBU CERRADA con FALLO
17:46:29.575/sesión55489exit1:1284tests1279PASS/cuatroFAIL/unSKIP324457.549927ms.
285inputs/started/cuatro capturas y owner2180577 ausente reconciliados17:47:28.666;
summary39e2c04cebaa537b70253a885bb639a806b8a2ab9a326ca2ab57a543cc6358e8.
Dos accesos nuevos suponían policy presente en registros sintéticos antiguos:
corregidos como opcionales, sin tocar fixtures ni activar el protocolo por defecto.
Report/production-scope11/11PASS405.191931ms. Nueva global ACTIVA sesión93489;
no editar inputs hasta cierre. vdN9yi/f5813eb… no
cualifica estos cambios. [Detalle](../design/PLANNING-CONTRACT-INSPECTION.md).

### Corte anterior — 17:21

Contrato opt-in inspect/plan y reserva global durable implementados en desarrollo,
todavía SIN integración en Engine/Worker/CLI/SDK. Tres archivos dirigidos CERRADOS
79/79 PASS,2515.834709ms/sesión67589exit0:29 catálogo,27 contrato,23 presupuesto.
Incluyen contención REAL de dos procesos por una sola reserva, reapertura SQLite,
rollback atómico y rechazo de reinicios del contador/ámbito/overlays incompatibles.
Son reservas prospectivas, NO llamadas ejecutadas, respuestas o planes aceptados.
RED conservado: módulo ausente en cada primer archivo nuevo (un fallo de carga,
no27/23 fallos de comportamiento). No proveedor real ni ensayo activo.
Global vdN9yi y runtime f5813eb… cualificado16:55:51.388 NO cubren estos cinco
archivos nuevos. Siguiente: respuesta de control durable, cursor y conexión al
flujo. No instalación, nueva misión, cambio de servicio ni reanudación de bckJet.

### Corte anterior — 16:54

Selección local de fichas íntegras, diagnóstico de cobertura y vínculo a petición
completada implementados en desarrollo. Módulo29/29PASS; integración en cuatro
formatos y negativas posteriores pasa25tests dirigidos de engine. Proveedor
simulado; se corrigió su parser de source-text-v1, no transporte de producción.
Engine/catálogo completos CERRADOS119/119PASS48218.008026ms/sesión41713exit0.
Global vdN9yi CERRADA16:53:23.420/sesión66656exit0:1196tests1195PASS/unSKIP,
314916.497427ms;276inputs/started/cuatro capturas y owner ausente reconciliados
16:53:58.933. Runtime f5813eb509612afd36483951c95f768e6962c666c34e9a75f5be71bccee8b073,
414archivos24037582B, verificado y NO instalado. El bucle de
consultas de fichas sigue sin implementar; esto no equivale a inspección on-demand
operativa ni aceptación de una asignación. [Detalle](../design/PLANNING-CONTRACT-INSPECTION.md).

### Corte anterior — 16:31

Respuesta de planificación durable implementada en desarrollo, NO instalada:
recibo y valor público atómicos, recuperación del mismo run/candidato, lectura
coherente y rechazo de alteraciones sin reiniciar planificación. Dirigidas19/19
PASS incluyen tres salidas abruptas de proceso con SQLite real y proveedor
simulado. Endurecimiento posterior de errores de ámbito incluido en regresión
dirigida de seis archivos CERRADA:227/227PASS,182211.243063ms/sesión8187exit0.
Global UWzy5t CERRADA16:30:26.814/sesión25318exit0:1165tests1164PASS/unSKIP,
305039.436678ms.276inputs/started/cuatro capturas y owner ausente reconciliados
16:31:23.023. Runtime fc4ef5fe1384915dd8f7a23e6cc367f6d6e488a290f0360248514e6691f5d2d7,
414archivos24031514B, verificado y NO instalado.
[Contrato, RED y límites](PLANNING-RESPONSE-DURABILITY.md).
La consulta interactiva de fichas sigue sin implementar. No hay inferencia
real ni ensayo de misión activo; no se declara completada la fábrica.

### Corte anterior — 15:59

VM8lJD cerrada: 1.133 tests, 1.132 PASS, cero FAIL y un SKIP; 274 inputs y
capturas reconciliados 15:24:45.032. Después se corrigió Authority.open:
devuelve exactamente los bytes autenticados, rechazando getters sin ejecutarlos.
RED 4 PASS/3 FAIL antes del cambio; archivo completo posterior 15/15 PASS.
Sn4ZOu cerrada: 1.141 tests/1.140 PASS/cero FAIL/un SKIP, 302174.871668ms;
274 inputs/capturas y owner ausente reconciliados 15:33:15.967. Runtime
fb9fa6678bbe163f753030305853663af9d2c6c0cf3e18e759164b32bd6d413c
cualificado 15:33:37.922, NO instalado. No se demuestra ataque por JSON/remoto.
[Hallazgo y criterio](AUTHORITY-AUTHENTICATED-SNAPSHOT.md).

Lector por lote de selecciones implementado e integrado, dirigido 266/266 PASS
y regresión VM8lJD cerrada. El último runtime cualificado 786639b y suite PvhN1F
NO cubren estas modificaciones; Sn4ZOu/fb9fa667 cubren ese cambio y firmas.
MWDBfO CERRADO: 45,0 s frente a 54,0 s, operación/ventanas/replay/rechazo
retroactivo exactos; owner, script, pins y originales reconciliados 15:36.
FlmqY8 sólo lectura cerrado: frame 7,75 s, 561 lecturas/719660218 B de JSON
acumulado (no disco/RAM/tokens), mismos bytes de contexto. Reconciliado 15:41.
Después se implementó composición privada de pruebas de fuente desde el mismo
frame completo recién validado: RED 2 PASS/3 FAIL, módulo 51/51 PASS.
Integración dirigida cerrada202/202PASS y ventanas7/7PASS. mo5Fej CERRADA:
1146tests/1145PASS/unSKIP303250.738069ms;274inputs/capturas reconciliados15:52:51.
Runtime5e0ce61a6ee428d66772fbf29d953e7c75a98bb554da4f3505dad8791cc05148
cualificado15:53:10.967, NO instalado. GDJx1P CERRADO:32,1s frente45,0s,
operación/ventanas/controles exactos; reconciliado15:55:48. FyTUkH sólo lectura
CERRADO:26pruebas/9selectores y expansión original idénticos; hashes conservados,
owner/script/pins/base/baseline reconciliados15:59:09. No queda ensayo activo.
En ese corte la respuesta de planificación durable seguía sin implementar;
véase el estado vigente. No se declara terminado R01–R16 ni eficiente toda la ruta.
Sin inferencias/API/servicios/misiones nuevas. [Detalle](DEPENDENCY-VALIDATION-COST.md).

### Historial de esta intervención

Factorización adicional de material documental implementada, NO instalada:
una reconstrucción completa por expansor/validador y operación, sin caché de
autoridad entre llamadas. 240/240pruebas dirigidasPASS; comparación readOnly
l9xuBV cerrada14:26:06.207 mantiene lote/material/contexto exactos. Revisión
6,4→3,8s; frame heredado24,5→16,6s. Fallo previo del script por confundir hash
de objeto y lista conservado, sin cambio de producción para hacerlo pasar.
LxDTPc/014e6f13 NO cualifican estas últimas modificaciones: regresión global
siguiente, antes de nuevo diagnóstico local completo. [Detalle](DEPENDENCY-VALIDATION-COST.md).

Actualización14:35: regresión uwAn0O CERRADA1106tests/1105PASS/ceroFAIL/unSKIP,
319028.605822ms;274pins/streams reconciliados14:33:49.736. Runtime0353100f...
cualificado14:34:09.557,413archivos24012893B, NO instalado. Diagnóstico local
5mv2fz en copia iniciado14:34:47; se detectó después un campo equivocado del
arnés (count frente a events), sin cambiar código o archivo iniciado. Esperar
cierre y conservar el fallo antes de corregir la instrumentación. No inferencias.

Actualización14:39: 5mv2fz cerrado y preservado como fallo del arnés; corrección
en copia nueva6I1iBb cerrada14:38:41.259. Paso completo69,4s frente a160,2s,
misma operación/ventanas, replay correcto y lecturas retroactivas rechazadas.
Owner/script/274pins/release/originales reconciliados14:39:47.503. Próximo cambio
local: grants de un mismo padre validados por lote; aún sin implementar ni medir.

Corte14:46: lector de grants por lote ya implementado e integrado en frame y
sesión;35/35tests del lectorPASS e integración RED conservada. Cinco archivos
dirigidos en curso/sesión95880.0353100f/uwAn0O sólo cualifican la versión anterior;
sin medición de coste nueva, instalación ni inferencias. [Detalles](DEPENDENCY-VALIDATION-COST.md).

Actualización14:51: dirigidas253/253PASS y lector37/37PASS con caducidad/fallo
tardío incluidos. Regresión PvhN1F ACTIVA, sesión14407/owner2119603,274inputs
fijados desde14:49:33.356. No editar ni iniciar medición del paso hasta cierre.

Corte14:58: PvhN1F CERRADA1120tests1119PASS/unSKIP312090.541143ms;
274pins/streams reconciliados14:55:33.718. Runtime786639b52f22492b10fb7616555cf7cfa1541c088bedc95e43f0fe71a45df267
cualificado y NO instalado. FE40sy CERRADO/sesión51969exit0: paso54,0s frente
a69,4s, misma operación/ventanas, replay y rechazo retroactivo correctos.
Originales intactos; no queda un ensayo activo. No representa cierre del mandato.

bckJet **INTERRUPTIDO, NO CUALIFICADO**. SIGTERM13:06 no fue atendido durante
validación síncrona; SIGKILL al propietario exacto13:14:40.579, sesión71690exit137,
owner ausente13:15:20.952. Once llamadas completas382575tokens, sin entrega.
Original DB/WAL/SHM preservados, recuperación únicamente en copia AJ4tmS con
integridad y estado lógico idénticos; misión original sigue RUNNING sin owner,
no se fabrica estado terminal. [Cierre](DOCUMENTARY-BATCH-bckJet.md).

Después del cierre se implementó prueba de ventanas por lote y cancelación
cooperativa entre pasos.162/162pruebas dirigidasPASS,9954.123875ms. Revisión real
recuperada:20368→6429ms,1075→381lecturas;26pruebas completas y material expandido
exactamente iguales al original, copia intacta. [Diseño y evidencia](SOURCE-PROOF-BATCH-PREFLIGHT.md).
Regresión global **LxDTPc CERRADA**13:51:04.121, sesión67848exit0/owner2099031
ausente;1093tests/1092PASS/ceroFAIL/unSKIP,323897.980356ms.274pins/streams
reconciliados13:51:36.567; resumen64307bafdead7eaabfd5afdb27c3d2c0f6a62eeec772fddf0408e12dd22bcf97.
Runtime014e6f13997cff19284b6646a0269b9f295c9b4c351216dd9d633bdd9305e868,
413archivos24011009B, cualificado13:52:55.860 y NO instalado. Incluye eliminación
adicional de doble aceptación del mismo padre en el lector de grants:
165/165dirigidasPASS,11054.441096ms; frame heredado117485→50779→24510ms,
7190→3142→1608lecturas, SHA de contexto original idéntico y copia intacta.
Nceuel/c561736b cualifican sólo el código anterior.
Coste recursivo heredado y cancelación dentro de operación larga siguen
abiertos. No nuevas inferencias ni reanudación de bckJet. R01–R16 pendientes,
sin instalación/API/compras/publicación/reinicio/misión ordinaria.
Checkpoint único09:24 no repetir; continuación existenteACTIVE intacta.

DiagnósticoJOvy8z CERRADO13:58:30.921, sesión5902exit0/owner2104326ausente.
Sólo operación local en copia nueva,160226ms; dos ventanas exactas, replay sin
eventos/replay alterado rechazado y sin lectura retroactiva. Journal529→533,
ninguna inferencia/efecto externo/candidato nuevo; originales intactos y274pins/
script/release reconciliados14:00:39.841. [Evidencia y límites](SOURCE-PROOF-BATCH-PREFLIGHT.md).
160segundos siguen siendo coste no satisfactorio. No transferir este resultado
a bckJet ni resumirlo como fábrica terminada. Siguiente: coste estructural de
revalidación de dependencias; consulta de contratos del planificador sigue diseño.

### Corte anterior — lote documental real

**bckJet: cierre controlado solicitado13:06:12.195**, sesión71690/PID2079140,
boot2a077981-8aea-444e-8eff-44fa69814267/startTicks48632011.
Misiónf30a23e8-8a44-45bd-8fc4-699a60315636: primer plan RETURN por frontera
forense ausente; segundo aceptado12:43:51.828, dos nodos con gate factual
antes de síntesis. Expediente efa1727e... aceptado12:55:16.970 con cuatro
criterios de contenido y gate runtime;26citas/nueve apoyos propios auditados.
Lotes productor y juez usados, dos fuentes nuevas. Once llamadas completas
382575tokens; síntesis sin entrega. Demora local previa al dispatch5min8s
y revalidación repetida del padre motivan SIGTERM diagnóstico al propietario
exacto, no timeout/cuota/techo de llamadas ni aceptación del recorrido.
Esperar cierre reconciliado antes de editar; no duplicar ni matar descendientes.
[Seguimiento](DOCUMENTARY-BATCH-bckJet.md).
Base nueva, caso conocido2c, protocolo por lotes,
adquisiciones nuevas y techo20llamadas. [Prerregistro](DOCUMENTARY-NAVIGATION-BATCH.md).
No editar274inputs ni duplicar hasta reconciliar propietario y cierre.

Nceuel cerrada12:25:12.607:1077tests/1076PASS/ceroFAIL/unSKIP,
346297.167022ms. Sesión28086exit0/owner muerto;274pins/streams/inventario/
releasec561736b verificados12:25:45.744. ResumenSHA63f3d2c840664871eb2ca57b29be5be46f3e15163a88e1f310ebe519005aeb7a.
Copia413archivos24004816B no instalada. G1ZuZR cerrado y auditado, oráculo
de duplicados reforzado; R01–R16/eficiencia general/stdio/learning pendientes.
Checkpoint único09:24 no repetir; servicio y continuación existentes intactos.

### Corte anterior — cierre del par y control de duplicados

G1ZuZR **CERRADO Y AUDITADO**: dos rutas correctas, seis llamadas reales
en total, cero reparaciones/efectos/replay. V2:2llamadas/20321tokens/103131ms;
planificada:4/82333/435862ms. Cierre12:12:38.237; owner muerto y274pins/release
c561736b íntegros12:13:13.379; auditoría readOnly12:14 de14citas exactas,
todos los criterios y bases intactas. [Resultados y límites](CLOSED-V2-REVISION-PREFLIGHT.md).
Un par conocido no cambia la política instalada ni cualifica todo el routing.

Carencia del oráculo de claves repetidas reproducida y corregida después del
cierre, sin reescribir resultados históricos. [Pruebas](JSON-ORACLE-UNIQUENESS.md):
ROJO3/4, luego45/45PASS y siete dirigidas finalesPASS. No había duplicados en
los dos cuerpos reales. Nueva regresión **Nceuel EN CURSO** desde12:19:26.209,
sesión28086/PID2074194/boot2a077981-8aea-444e-8eff-44fa69814267/
startTicks48591611;274pins. No editar inputs ni duplicar hasta cierre reconciliado.
Siguiente cobertura: lote documental real después de esta regresión; no nuevo
ensayo todavía. R01–R16/eficiencia general/stdio/learning abiertos, release no
instalada. Checkpoint único09:24 no repetir; servicio y continuación intactos.

### Corte anterior — par v2 real

**G1ZuZR EN CURSO**, cualificado12:03:38.872, sesión23783/PID2068010,
boot2a077981-8aea-444e-8eff-44fa69814267/startTicks48496876. Ruta adaptativa
cerrada12:05:22.160: dos llamadas reales20321tokens, respuesta exacta y revisión
independiente. Ruta planificada iniciada; falta su cierre y auditoría conjunta.
No duplicar ni editar274inputs mientras el propietario siga activo.
[Prerregistro y seguimiento](CLOSED-V2-REVISION-PREFLIGHT.md).

DfE1xm cerrada12:02:16.847:1070tests/1069PASS/ceroFAIL/unSKIP,
350190.432235ms; sesión48017exit0/owner muerto. Auditoría12:03:20.178:
274pins/inventario/streams/release íntegros; resumenSHA
4e426ff0b799db0db8c614bc053916c9e3540072b7d41526909c51f7d79486f7.
Releasec561736b... verificada, no instalada. Sigue sin cualificación real
el lote documental; un par cerrado no cubre calibración general ni R01–R16.
Checkpoint único09:24 no repetir; sin cambios de instalación o misión ordinaria.

### Corte anterior — preparación del par v2

**Regresión DfE1xm EN CURSO** desde11:56:26.559, sesión48017/PID2063352,
boot2a077981-8aea-444e-8eff-44fa69814267/startTicks48453665;274inputs fijados.
No editar inputs ni duplicar antes de reconciliar propietario y cierre.
Incluye nuevo harness/caso prospectivo v2 de revisiones/Unicode; cinco
dirigidasPASS, ningún brazo real aún. [Prerregistro](CLOSED-V2-REVISION-PREFLIGHT.md).
Sólo después de esta regresión, par v2/planificado con bases nuevas, ocho
llamadas por brazo, dieciséis máximo y parada de diagnóstico si falla el primero.

0S2ocg cerrada11:48:42.812:1066pruebas/1065PASS/ceroFAIL/unSKIP;
367275.985730ms. Verificada11:49:50.979:272pins/streams/inventario;
releasec561736bff1a70d243fac9fbd39100717af61e060ca11a9f8aaa07fefe18648c,
413archivos/24004816B, no instalada. [Lotes documentales](DOCUMENTARY-NAVIGATION-BATCH.md)
sin cualificación real todavía.2cYEbW sigue revalidando intacto.

**2cYEbW aprobado para el caso documental conocido**, cerrado11:05:17.430,
sesión48291exit0/owner muerto. Once llamadas reales311820tokens,21min31.685s;
plan, adquisiciones, revisión independiente, entrega y reentrada íntegros.
Auditoría externa:17citas exactas/13únicas, cuatro apoyos observados por ambos
actores, ocho controles de contenido y tres runtime. Journal395/998c9f50...;
271pins/release58d863ab verificados tras cierre. [Auditoría](DOCUMENTARY-LIVE-2cYEbW.md).
No es eficiencia satisfactoria para un caso pequeño ni aceptación R01–R16.
Sigue abierto el reporter descendiente, eficiencia proporcional, v2 real,
learning y cualificación general. No repetir el caso aprobado para fabricar
confianza. Diagnóstico nativoBqYXI2 cerrado11:30:25.928: getsockname/getsockopt
EPERM en ambos fd del hijo aislado; controles fuera del sandbox funcionan.
Confirma el mecanismo, no lo arregla. [Fuentes y observación](NODE-CHILD-STDIO-UPSTREAM.md).
Release no instalada; checkpoint único09:24 no repetir, continuación existente
ACTIVE y servicio ordinario intactos. Sin compras/API/publicación/reinicio.

### Corte anterior — 13 septiembre, 10:44 UTC

**Ensayo documental integrado2cYEbW EN CURSO**, cualificado10:43:44.748,
sesión48291/PID2041980,boot2a077981-8aea-444e-8eff-44fa69814267/
startTicks48017447. Misión13b11794-d200-4b51-9691-1b904977f100,
Plan aprobado en primer intento; dos adquisiciones verificadas y candidato
de cuatro hechos. Diez llamadas completas258354tokens al corte10:55:18;
el juez tiene sus propias dos ventanas y request10 en curso. Sin entrega todavía.
[Seguimiento](DOCUMENTARY-LIVE-2cYEbW.md). Base nueva, mismo caso/política/
oráculo y techo20llamadas; no reanuda fallos ni copia juicios previos.
No duplicar/editar271inputs mientras esté activo; reconciliar propietario,
cualificación, solicitudes y resultado antes de actuar.

TvBbu1 cerrada1048tests/1047PASS/ceroFAIL/unSKIP a10:42:27.241,
sesión81082exit0/owner muerto. Auditoría10:43:00.996:271pins/76runtime y
streams/inventario íntegros. Release58d863abde9ee4d1c2455f5d18306cdf043d923ee8e1edbbe96cb613dd096dc2,
413archivos/24001162B verificada, no instalada. Lote de validación reduce
medición local86364→16409ms, expansión real idéntica, sin cambiar controles.
[Medición y regresión](DOCUMENTARY-PROOF-BATCH.md).

bNXUDE mantiene aprobación de sólo revisión; UWr0Gu/KZ6Aeb sus fallos y
originales intactos. R01–R16/documentalintegrado/eficiencia general/v2real/
learning/stdio pendientes. Checkpoint único09:24 conservado/no repetir;
servicio10bbffa0/journal410 estable, continuación existenteACTIVE. Sin
compras/API/publicación/reinicio/instalación/misiónordinaria.

### Corte anterior — 13 septiembre, cierre bNXUDE

**bNXUDE aprobado como diagnóstico de revisión**, fin10:27:07.374,
sesión8732exit0/owner2032438 ausente;271pins y releasebd527154... íntegros
10:27:49.076. Tres llamadas reales/147249tokens, dos lecturas propias y juicio
independiente: once criterios de contenido y tres runtime PASS. Sus22citas
contrastadas con el input exacto; cinco apoyos de hechos en ventanas propias.
Journalcopia600/65b442dc...; original c82a6e11... intacto y FAILED. No nuevos
productos, adquisiciones o efectos; no entrega ni recuperación del original.
[Auditoría y límites](DOCUMENTARY-REVIEW-bNXUDE.md).

Validación por lote implementada, sin caché de autoridad entre llamadas.
Misma base cerrada:86364→16409ms,5015→907lecturas,28→2frames. Journal/bytes
intactos; expansión real coincide exactamente con la revisión original.
Siete negativos/equivalencias dirigidosPASS tras conservar ROJO e instrumentación
corregida. [Evidencia y prerregistro](DOCUMENTARY-PROOF-BATCH.md).
Regresión completa TvBbu1 EN CURSO desde10:36:51.899, sesión81082/PID2037085,
boot2a077981-8aea-444e-8eff-44fa69814267/startTicks47976197;271inputs.
No editar/duplicar hasta reconciliar. Recorrido documental completo real sólo
tras nueva regresión/freeze, mismo caso y techo20, base nueva sin reanudar fallos.
No nueva inferencia/instalación todavía. R01–R16/documentalintegrado/eficiencia/
v2real/learning/stdio pendientes.
Checkpoint único09:24 conservado, no repetir; servicio10bbffa0/journal410 estable,
continuación existenteACTIVE. Sin compras/API/publicación/reinicio/misiónordinaria.

### Corte anterior — 13 septiembre, 10:23 UTC

Diagnóstico **bNXUDE EN CURSO**, sesión8732/PID2032438,
boot2a077981-8aea-444e-8eff-44fa69814267/startTicks47856993; cualificado
10:17:22.000. Copia nueva del original UWr0Gu, no reanudación ni entrega.
Tres llamadas reales completas/147249tokens: dos lecturas propias y respuesta
action=review/ACCEPT con once criterios de contenido a10:21:21.868.
**Respuesta del proveedor no equivale a aceptación runtime:** falta reconciliar
el cierre, el registro de revisión y sus pruebas. No duplicar ni modificar
los271inputs fijados mientras siga vivo. [Seguimiento](DOCUMENTARY-REVIEW-bNXUDE.md).

FnbTQJ cerrada10:16:15.345, sesión88947exit0/owner2028114 ausente:
1041tests/1040PASS/ceroFAIL/unSKIP,323002.437808ms. ResumenSHA
fd53186b3c4fe7209bc357ae1ec78b797cf42071235e001d56cba01f31633240.
Auditoría10:16:41.494:271pins/76runtime, streams e inventario íntegros.
Freezebd52715434a2e4ad88794be38cd074a806390f5e587576da85cdadce22e7af19,
413archivos/23998328B verificado, no instalado. Misma política, criterios y
roles; seis pasos/llamadas máximo. Sin nuevos productores, fuentes o efectos.
UWr0Gu y KZ6Aeb siguen fallidos/conservados. Checkpoint único09:24 no repetir.
Servicio10bbffa0/journal410 estable; continuación existenteACTIVE. R01–R16
pendientes, sin compras/API/publicación/reinicio/instalación/misión ordinaria.

### Corte anterior — 13 septiembre, cierre KZ6Aeb

**KZ6Aeb cerrado NO CUALIFICADO**, fin09:58:00.162, sesión78538exit2 y
owner2020361 muerto,271pins/freeze639c5597 íntegros09:59:49.175. Seis
llamadas reales/301645tokens: sólo lecturas, última duplicada, cero juicio.
El esquema ya permite navegar; falta progreso hacia una decisión. Techo local
de seis llamadas respetado; no esTIMEOUT ni cuota. Candidato/original intactos,
journaloriginal496/copiad640, sin nuevos efectos o productores.
[Auditoría y siguiente intervención](DOCUMENTARY-REVIEW-KZ6Aeb.md).

Corrección en desarrollo: distinguir resultados históricos de selección del
texto ya presente en el frame actual; activeSelections derivado de ventanas
propias, sin verdictos anticipados; presupuesto restante explícito. El
diagnóstico conserva seis pasos/llamadas. No cambiar criterios ni aumentar
límites para forzar éxito. ROJO previo; dirigidas sesión97944 cerrada103PASS.
Inspección detectó párrafo exclusivo del juez añadido también al productor:
corregido tras otra pruebaROJA; siete dirigidasPASS. Regresión provisional
mIvGtf interrumpidaSIGTERM y conservada (no se cualifica). Nueva regresión
FnbTQJ sesión88947 EN CURSO, inicio10:10:52.237;PID2028114,
boot2a077981-8aea-444e-8eff-44fa69814267/startTicks47820234;271inputs.
No editar inputs ni duplicar antes de reconciliar.
No nuevo ensayo real hasta nueva regresión y freeze verificados. R01–R16
pendientes. Checkpoint único09:24 conservado/norepetir, servicio10bbffa0/
journal410 estable, continuaciónexistenteACTIVE. Sin compras/API/publicación/
reinicio/instalación/misiónordinaria. No reanudar UWr0Gu ni KZ6Aeb.

### Corte anterior — 13 septiembre, 09:55 UTC

**Diagnóstico de revisión KZ6Aeb EN CURSO**, sesión78538/PID2020361,
boot2a077981-8aea-444e-8eff-44fa69814267/startTicks47720793,
cualificación09:54:37.016. Primera llamada09:54:43→09:54:58.747 completada
real/41090tokens: petición propia de lectura SQLite conchecks=[] válida.
La nueva gramática permite navegar; juicio final todavía pendiente.
`runs/documentary-review-KZ6Aeb` contiene una copia del candidato UWr0Gu;
juez nuevo solamente, máximo6llamadas, sin planner/productor/fetch/efectos.
No significa reanudar ni aprobar el originalFAILED. Reconciliar propietario y
archivos de cualificación/llamadas; no duplicar ni editar271inputs fijados.

SuitexXVzSB cerrada09:51:51.919/sesión50474exit0/owner2015683 ausente:
1040tests/1039PASS/ceroFAIL/unSKIP,312915.477815ms. ResumenSHA
c2b41de739761f5d1ac2bb2476bbfad515703fdb9ed50200dc81327d2c828ce4.
Auditorías09:53:50/09:54:03:271inputs,76runtime,inventario y streams íntegros.
Freeze639c5597ca0b3a6e9639a7eb437a7ae81c046e6cfafebfd875f50bf827e22cdf,
413archivos23995939B verificado; noinstalado.
UWr0Gu conservaFAILED y journal496/aa414964...;170099tokens observados
más coste desconocido del timeout. [Defecto/corrección](DOCUMENTARY-LIVE-UWr0Gu.md).
Checkpoint único09:24 de esta continuación conservado; no repetir.
Servicio10bbffa0/journal410 estable; continuación existenteACTIVE.
MandatoR01–R16/documentalextremo-a-extremo/eficiencia/v2real/learning/stdio
pendientes. Sin compras/API/publicación/reinicio/instalación/misión ordinaria.

### Corte anterior — 13 septiembre, 09:49 UTC

**Mandato pendiente. UWr0Gu cerradoFAILED/TIMEOUT** a08:53:42.871,
sesión47970exit2/propietario2000926 ausente. Plan aceptado en primer intento,
dos adquisiciones reales y candidato documental con cuatro hechos/cinco apoyos
verificados. Nueve llamadas/ocho completadas,170.099tokens observados; coste
adicional del timeout desconocido. Cero revisiones factuales y cero entrega.
Journal original496/aa414964434fa3982cd1cb05832074f9f730d78ad746a724bbcbdc1b0d81f3d5
permanece intacto. [Diagnóstico y prerregistro](DOCUMENTARY-LIVE-UWr0Gu.md).

Defecto reproducido: el esquema del primer juez exigía11checks incluso para
action=document, cuyas instrucciones exigíanchecks=[]. El simulador omitía
esa restricción. Corrección acotada a navegación; juicio final conserva todos
los criterios, prueba propia y controles runtime. ROJO primero;38tests
documentalesPASS +5tests de retestPASS, modelos/HTTP simulados.
Regresión nueva xXVzSB EN CURSO, inicio09:46:38.909, sesión50474/PID2015683,
boot2a077981-8aea-444e-8eff-44fa69814267/startTicks47674901;271inputs.
No editar inputs/duplicar suite.

Retest siguiente prerregistrado sólo sobre una copia del candidato: juez nuevo,
grants/ventanas propios, mismo plan/roles/política; seis llamadas máximo; cero
productores, adquisiciones nuevas o efectos. Requiere suite y freeze nuevos
verificados. La misión original nunca cambia ni se entrega por ese diagnóstico.

Checkpoint único de esta continuación09:24:54.317,
muestra7aaff567-321b-4e8e-8ab9-6109fdf7c953; observador61/
82d511fb845e5a3e0ff099af06a22a407fe6065cc64628f380e2ea0091ac6f80.
30muestras26saludables4fallidas,OBSERVING/segmento0; hueco08:10→09:24
conservado. Servicio10bbffa0 verificado/PID989536 activo/gestorpermanente,
NRestarts0/journal ordinario410 sin cambios. No repetir checkpoint esta
continuación. R01–R16/documentalextremo-a-extremo/eficiencia/v2real/learning/
stdout descendiente siguen abiertos. Sin instalación/compras/API/publicación/
reinicio/nueva misión ordinaria; continuación existenteACTIVE.

### Corte anterior — 13 septiembre, 08:29 UTC

**Ensayo real UWr0Gu EN CURSO**, inicio08:28:12.537; sesión47970/PID2000926,
boot2a077981-8aea-444e-8eff-44fa69814267/startTicks47204238.
Misión448ad8d9-94fb-4c56-9bd1-282c6cccfeb1, brazo distinct-literal-windows-v1.
Primera solicitud auditada: petición íntegra, fichaomega_23 completa y guarda
omega_07 expuestas. Llamada0 completa08:31:23.910/27620tokens; propone
omega_11 productor/veritas_06+omega_22 revisores,14criterios completos pendientes
de juicio. Revisión del plan en curso08:33; no fuentes/entrega todavía.
[Seguimiento](DOCUMENTARY-LIVE-UWr0Gu.md).
No duplicar ni editar los270inputs fijados. Mismo caso/oráculo/20llamadas y
permisos; retest conocido tras corrección, noholdout ni recuperación anterior.

9jHXe7 cerrada08:27:26.204,1029tests/1028PASS/ceroFAIL/unSKIP; sesión57500exit0,
owner ausente. Auditoría08:27:56.176:270inputs/76runtime e inventario/streams
verificados; resumenSHA1f333aac3610d7c48fdd66f0f59b0b17d168a380c876f73d0dab9705d05444d9.
Release0695b9a46c7dfd5728f365ccb69e463ea99f9f326a344628b683093c4ed3b289,
413archivos/23994623B verificada; NO instalada.
ZxHWcv fallido/124423tokens/journal223 conservado, no reanudado ni reetiquetado.

Checkpoint único08:10 conservado, no repetir esta continuación. Servicio10bbffa0/
journal410 sin cambios; continuación existenteACTIVE. R01–R16/documentalreal/
eficiencia/v2real/learningdocumental/stdoutdescendiente pendientes. Sin compras,
API fallback, publicación,reinicio,instalación o nueva misión ordinaria.

### Corte anterior — 13 septiembre, 08:23 UTC

**Regresión9jHXe7 EN CURSO**, inicio08:22:12.475; sesión57500/PID1996584,
boot2a077981-8aea-444e-8eff-44fa69814267/startTicks47168243,270inputs fijados.
No duplicar ni editar inputs antes de reconciliar su resultado.

ZxHWcv cerrado07:29:47.781, sesión55142 exit2/propietario ausente. Dos planes
RETURN,4llamadas reales/124.423tokens; ninguna adquisición/entrega factual.
Prerrequisitoomega_23 corregido en plan2; nueva incompatibilidadomega_07.
Auditoría08:11:270pins y freeze50649873 íntegros; base readOnly/journal223
sin cambios. Citas45/20únicas comprobadas08:21; [diagnóstico](DOCUMENTARY-LIVE-ZxHWcv.md).
No se reanuda ni se sobrescribe. spVGwI y otras evidencias anteriores intactas.

Corrección en desarrollo: guarda de asignación ordinariaomega_07 hasta servicio
nativo verificado; ficha completaomega_23 visible desde el primer plan. No se
recortan originales ni se certifican otras capacidades. Negativo primero rojo,
70dirigidasPASS y dosrecorridos adicionalesPASS con modelo/jueces simulados.
Retest conocido prerregistrado sólo tras regresión y freeze nuevos, mismo caso,
oráculo,20llamadas/permisos,base nueva; aún no lanzado.

Checkpoint único de ESTA continuación08:10:12.926, muestrae376ca1b-e0d6-4f8c-9a10-3d636c21769d;
observador59/ccdae5c785a0b415d388984846ec0d42aa06c86aa8a5c94a9259e725d6f373f2.
29muestras/25saludables/4fallidas; OBSERVING,segmento0,hueco06:22→08:10 conservado.
Instalación10bbffa0 verificada/PID989536 activo/enabled/NRestarts0/gestorpermanente;
journal ordinario410/2f54d5b7... sin cambios. No repetir checkpoint esta continuación.
Sin instalación,compras,API fallback,publicación,reinicio,nueva misión ordinaria.
Continuación existenteACTIVE; R01–R16,eficiencia,semántica documental,v2real,
aprendizaje documental y stdout descendiente pendientes.

### Corte anterior — 13 septiembre, 07:21 UTC

**Ensayo documental real ZxHWcv EN CURSO**, sesión55142/PID1983749,
boot2a077981-8aea-444e-8eff-44fa69814267/startTicks46747229.
Directorio `runs/documentary-live-ZxHWcv`, misión
`mission:1d99417f-78f7-4031-89ff-2fff0dd4d87a`, brazo
`distinct-literal-windows-v1`. Primer plan RETURN por prerrequisito de entrada
aceptada de omega_23 ausente; segundo intento de planificación en curso.
Dos llamadas reales completadas/51.333 tokens observados antes del replan,
sin adquisición ni entrega. [Seguimiento](DOCUMENTARY-LIVE-ZxHWcv.md).
Máximo20 llamadas de suscripción Astra/ultra, sólo las dos fuentes primarias
originales; planificación explícita. No duplicar, reanudar ni modificar código,
tests, casos, harness u oráculos fijados mientras esté activo. Reconciliar
propietario/archivos de llamadas antes de actuar. Mantener cualquier fallo.

7d0wzx **cerrada y verificada**:1.025 tests/1.024PASS/cero fallos/unSKIP,
fin07:10:32.297, sesión2586/PID1979282 ausente. Auditoría07:11:27.785:
270 inputs/76runtime, inventario/inputs/streams parciales-finales coincidentes.
ResumenSHAc66fec138f544c657b776285afcc6a7ef4fe1529bbf3fc0414674a664c26378e.
Freeze50649873c3e8cf3ebc53cbc26eb0fee7fa70b143fab5c143f1a1f9eb60f6eb8a,
413archivos/23991666B verificado; **no instalado**. Cualificación del harness
07:11:49.776,270 pins íntegros y runtime coincidente antes del ensayo.
PVrsMM fallida e ymuSqn interrumpida permanecen, con diagnóstico y corrección
en [DOCUMENTARY-WORKFLOW.md](DOCUMENTARY-WORKFLOW.md).

Servicio10bbffa0/journal ordinario410 sin cambios; checkpoint único06:22
conservado, no repetir. Continuación existente ACTIVE. tGHBOv y fracaso spVGwI
intactos. R01–R16, semántica documental real, eficiencia, aprendizaje documental,
v2 real y stdout descendiente abiertos. Sin compras/API fallback/publicación/reinicio.

### Corte anterior — 13 septiembre, 07:05 UTC

**Regresión 7d0wzx EN CURSO**, inicio07:04:56.088,270 inputs;
sesión2586/PID1979282, boot2a077981-8aea-444e-8eff-44fa69814267/
startTicks46704612. No duplicar ni editar inputs hasta reconciliar.

PVrsMM cerrada:1.025 tests/992PASS/32FAIL/unSKIP, fin07:01:56.163,
resumenSHA6e4b88021262387d8bca44e17b57b94ed351827db1fd382250221d9d920a47ef.
Verificada07:03:24.525, inputs/streams íntegros y propietario ausente. Misma
causa en los32 fallos: detector documental sobre registros legacy sin policy.
Corregido sin conceder opt-in:33/33 dirigidas PASS; eliminación de política
de actor documental sigue bloqueando antes de dispatch. Se conserva también
ymuSqn interrumpida/SIGTERM por inicio después de un fallo de expectativa de
código, no regresión completa. [Diagnóstico íntegro](DOCUMENTARY-WORKFLOW.md).

Ruta vertical, reports/linaje/recuperación y harness real preparados como en el
corte previo. No ensayo real hasta suite cerrada/verificada y freeze válido;
no recuperación de spVGwI ni instalación. Checkpoint único06:22 conservado,
servicio10bbffa0/journal410 sin cambios; no repetir. Continuación ACTIVE.
R01–R16, v2 real, aprendizaje documental, stdout descendiente y eficiencia abiertos.

### Corte anterior — 13 septiembre, 06:57 UTC

**Regresión PVrsMM EN CURSO**, inicio06:56:43.116,270 inputs;
sesión70393/PID1974164, boot2a077981-8aea-444e-8eff-44fa69814267/
startTicks46655314. No duplicar ni modificar inputs hasta reconciliar.

[Ruta documental vertical](DOCUMENTARY-WORKFLOW.md): modo explícito
literal-windows-v1, órdenes locales ligadas a propuestas/solicitudes completas,
selección independiente por productor/juez, materialización y consumo vinculados,
linaje, retirada de fuentes, reportes y recuperación conectados. Recorrido del
motor con dos productos y jueces separados PASS **con modelos/HTTP sintéticos**;
13 llamadas/una adquisición. Se conserva el fallo de expectativa del journal
de reentrada y su corrección exacta. Archivos reales y negativos adicionales PASS.
Overlays deshabilitados: no se cualifica todavía aprendizaje documental.

Harness de ensayo real nuevo preparado, no lanzado: mismo texto/oráculo de
fuentes, planificación explícita, 20 llamadas máximas, fresh acquisitions y
release/suite verificadas antes de cada llamada. No recuperar spVGwI ni instalar.
Sólo después de PVrsMM cerrada/verificada y freeze válido; conservar todo fallo.

Checkpoint único06:22:23.530: muestra03d1e141-2430-4ac9-be6f-c25f223556e7,
observador57/4a061d94...,28muestras24healthy4failed, OBSERVING; hueco05:11→06:22
preservado, no72h. Instalación10bbffa0/PID989536/gestor permanente verificados,
journal ordinario410/2f54d5b7... sin cambios. No repetir checkpoint.
Continuación existente ACTIVE. tGHBOv/spVGwI intactos; v2 real, stdout
descendiente, eficiencia y R01–R16 abiertos. Sin compras/API/publicación/reinicio.

### Corte anterior — 13 septiembre, 05:48 UTC

**ssVkLk cerrada y verificada**:993 tests/992 PASS/cero fallos/un SKIP,
fin05:47:29.362, sesión87217 exit0/PID1957912 ausente con identidad kernel.
Auditoría05:48:12.632:265 inputs/73runtime, inventario y streams parciales/finales
idénticos a la captura. ResumenSHA45fa6413d2b4b4c55d5f37511a8ea673a5a4072095b1a76c43b7053348ec968c.
Snapshot4df02b115007fa1710c7064081b753e4cd0ccc94a66d8b77378a69e2ed689f60,
410archivos/23953824B verificado; **no instalado**. No ensayo/inferencia activa.

[Entrada documental firmada](DOCUMENT-CONTEXT-FRAMES.md) y guarda de materialización
legacy verificadas. Se conservan reproducción roja6 fallos y fallo posterior de
expectativa de código; dirigidas168/168 PASS y suite posterior cerrada. Diagnóstico
15ejSk sobre copia privada prepara71735B/dos ventanas sin prestar lectura antigua,
alterar raws/journal original324 o recuperar spVGwI. No aceptación documental real.

Continuar con **ruta vertical opt-in**: contrato/scope nuevo, protocolo de selección
independiente productor/juez, congelación de instrucciones antes del frame,
aceptación/consumo/linaje/reportes/reentrada/aprendizaje con vínculos persistentes
por candidato/revisión. Mantener la guarda hasta cubrir esa cadena y ensayarla
desde petición real, sin modificar preset v1 ni compartir lectura/overlays ajenos.
Puntos de conexión inspeccionados al final del documento enlazado.

Checkpoint único05:11 de este turno conservado; instalación10bbffa0/journal
ordinario410 sin cambios. Continuación existente ACTIVE; no repetir checkpoint.
tGHBOv/spVGwI intactos; v2 real/stdio descendiente/eficiencia/R01–R16 abiertos.
Sin compras/API fallback/publicación/reinicio ni nueva misión ordinaria.

### Corte anterior — 13 septiembre, 05:44 UTC

**Regresión ssVkLk EN CURSO**, inicio05:43:36.260,265 inputs;
sesión87217/PID1957912, boot2a077981-8aea-444e-8eff-44fa69814267/
startTicks46216635. No duplicar ni modificar inputs hasta reconciliar.

[Entrada documental firmada y pruebas](DOCUMENT-CONTEXT-FRAMES.md): preparación
completa ligada a la solicitud exacta de cada actor, catálogo tipado y citas de
campos/rangos observados. Guarda explícita impide utilizar esos inputs con
gates materiales antiguos. Un fallo real de composición fue reproducido con
6 negativos antes de corregirlo; **168/168 dirigidas PASS** después. No activación
del protocolo productor/revisor ni aceptación documental nueva. vsSO45 previa
983tests/982PASS/unSKIP cerrada/verificada, pero anterior a esa guarda.

Diagnóstico15ejSk en copia privada: entrada completa71735B/dos ventanas;
raws, actor, misión NEEDS_DIRECTION y journal original324/f35ce8bf intactos.
Rechaza préstamo de una finalización antigua; cero inferencias/recuperaciones.
Faltan protocolo versionado, gates materiales propios/consumo/linaje/reportes,
reentrada y scopes de aprendizaje antes del ensayo documental real.

Único checkpoint05:11:37.012: muestra01ffa8b0-2599-4567-b51c-62e3bbdfc846,
probeHasha11d64785044a8f1632778ebedbd0a1a1ad1b5db7df21049965ac0d2e9058701.
Observador55/b61d1daed5fc868b36c26b419df3a2aad6aec899ca2cffbe07bda5882d118dfc,
27muestras23healthy4failed, OBSERVING; hueco04:09→05:11 preservado, no72h.
Instalación10bbffa0 verificada385files/23689915B, PID989536 activo/enabled/
NRestarts0 y gestor permanente verificado. Journal ordinario410/2f54d5b7cc105de79871c8de1aa03d036ae574e9258bebc7094ba2e853c46f1a
sin cambios; no repetir checkpoint. Continuación existente ACTIVE.
tGHBOv y fracaso spVGwI intactos; v2 real, stdio descendiente, eficiencia y
R01–R16 pendientes. Sin compras/API/publicación/reinicio ni otra misión ordinaria.

### Corte anterior — 13 septiembre, 04:39 UTC

**aXRAcS cerrada y verificada**:959 tests/958 PASS/cero fallos/un SKIP,
fin04:37:46.684, sesión31093 exit0/PID1939318 ausente. Auditoría04:38:19.121:
262 inputs/72runtime, inventario y streams idénticos al inicio/retención.
ResumenSHA b930340ed049f1de682075ee86ba1da9881922a81504d394b08810c32110de01.
Snapshot764f75070718c9c47c1c0665209263ebeb74f39c5307d74780beee327485cda9,
409archivos/23931852B verificado; **no instalado**. No ensayo ni inferencia activa.

[Proyección y permisos documentales](SOURCE-ACQUISITION-PROJECTION.md) probados
como componentes: preview de adquisiciones y grants separados de sourceIds,
ligados a ventana propia y revocación. Diagnóstico real spVGwI conserva fuentes,
actor y journal; no hubo lectura del modelo ni solución de aquella misión.
Continuar integración versionada en protocolo productor/revisor, exposición por
solicitud, catálogo/citas/aceptación/reentrada y aprendizaje sin overlays ajenos.
No activar antes de cubrir esa cadena ni recortar criterios/correcciones.

Checkpoint único04:09 de este turno conservado, instalación10bbffa0/journal
ordinario410 sin cambios, continuación existente ACTIVE. No repetir checkpoint.
tGHBOv/uGS19o y fracaso spVGwI intactos; v2 real, defecto stdout descendiente,
eficiencia y **R01–R16 pendientes**. Sin compras/API fallback/publicación/otra misión.

### Corte anterior — 13 septiembre, 04:36 UTC

**Regresión aXRAcS EN CURSO**, inicio04:33:58.628,262 inputs; sesión31093/
PID1939318, boot2a077981-8aea-444e-8eff-44fa69814267/startTicks45798855.
No duplicar ni editar inputs antes de reconciliar su resultado e integridad.

Nueva proyección documental tipada read-only y grants inmutables separados de
sourceIds, conectados a selección/exposición propia de ventanas. **55/55 dirigidas
PASS** con recibos HTTP/modelo sintéticos. [Evidencia y fronteras pendientes](SOURCE-ACQUISITION-PROJECTION.md).
Diagnóstico spVGwI04:33:37.547: contexto base6646609B→vista22483B/preview completo
24399B; raws y journal324/f35ce8bf intactos, sin inferencia ni recuperación.
No equivale a lectura del modelo, soporte factual o solución del ensayo fallido.
Protocolo productor/revisor, scope nuevo, citas/aceptación/reentrada e integración
real pendientes. No se cambia infer() ni la instalación10bbffa0.

Único checkpoint de este turno **04:09:23.036**, muestra4da87d17-bb34-4c0b-9b9c-f44aa0efb20c,
probeHasha11d64785044a8f1632778ebedbd0a1a1ad1b5db7df21049965ac0d2e9058701.
Observador53/4e487a1a1cb9c3aa96d5be6d4b2bd1701017ce296049946a854912ebabadaf99:
26muestras22healthy4failed, OBSERVING; hueco00:31→04:09 conservado, no72h acreditadas.
Servicio10bbffa0 verificado385files/23689915B, PID989536 activo/enabled/NRestarts0,
gestor permanente verificado. Journal ordinario410/2f54d5b7cc105de79871c8de1aa03d036ae574e9258bebc7094ba2e853c46f1a
sin cambios, misma única misión completada; bytes del ejecutable vivo coinciden
con el configurado aunque su antigua ruta figure deleted. No equivale a inspección
de memoria. No repetir checkpoint por la misma continuación.

tGHBOv/uGS19o anteriores conservados; v2 real, defecto stdout descendiente,
eficiencia y R01–R16 pendientes. Continuación existente ACTIVE; sin compras,
API fallback, publicación, modificación de permisos o nueva misión ordinaria.

### Corte anterior — 13 septiembre, 03:34 UTC

**uGS19o cerrada**:929 tests/928 PASS/cero fallos/un SKIP, fin03:32:14.452,
sesión79490 exit0/PID1924900 ausente. Verificación03:33:03.929:256 inputs/69runtime,
inventario y streams íntegros. ResumenSHA7bc4ead0f3a67ed6067ba384da32153fc7baad02275aff911f1badf7de4c3364.
Snapshot9ab6ee219126e9d601d22ab700eaf361dfd2ba226e7bafa1f0fdece840a7b44b,
406archivos/23910909B verificados; **no instalado**. No ensayo ni inferencia activa.

Componentes documentales del corte anterior probados; [evidencia y frontera
de integración](SOURCE-WINDOW-EVIDENCE.md). Continuar con proyección tipada de
adquisiciones en sources/result/quoteText/toolReceipts, grants de manifiesto
separados del raw y selección propia de productor/revisor. No habilitar la ruta
antes de proteger citas frente a los campos omitidos y probar reentrada/revocación.
No recortar otros contenidos para eludir CONTEXT_LIMIT.

tGHBOv conserva su aceptación/auditoría de un caso,403909 tokens/36min22.856s;
spVGwI permanece fallido. Cualificación real v2, defecto stdout descendiente,
eficiencia y R01–R16 pendientes. Único checkpoint00:31 conservado; instalación
10bbffa0 no modificada por este trabajo. Continuación existente ACTIVE; sin
duplicados, compras, API fallback, publicación ni otra misión ordinaria.

### Corte anterior — 13 septiembre, 03:30 UTC

**Regresión uGS19o EN CURSO**, sesión79490/PID1924900, inicio03:28:04.339,
256 inputs; identidad bootId2a077981-8aea-444e-8eff-44fa69814267/startTicks45403407.
No duplicar ni editar inputs antes de reconciliar. Componentes nuevos: selección
de ventana ligada a actor/fuente/recibo, prueba de cita en solicitud prospectiva
completada propia y localizador literal paginado.25+7+7 dirigidas PASS tras
detectar/corregir medio surrogate y deriva de propósito. **No integración con
producción/revisión, no lectura real del modelo ni instalación**. Diagnóstico
read-only de fuentes spVGwI conserva journal324/f35ce8bf y ambos raws; [evidencia](SOURCE-WINDOW-EVIDENCE.md).

tGHBOv aceptado/auditado y QUDm3d895PASS conservados. Pendientes: protocolo y
proyección documental integrada, cualificación real v2, defecto stdout de hijos,
eficiencia y R01–R16. Único checkpoint00:31; servicio10bbffa0 no modificado por
este trabajo, continuación existente ACTIVE. No otra misión ni llamada nueva.

### Corte anterior — 13 septiembre, 03:12 UTC

**tGHBOv cerrado, aceptado y auditado**,11 llamadas reales/403909 tokens,
36min22.856s.19 criterios finales PASS y oracle externo3193 checks PASS;
reentrada sin llamadas/efectos nuevos ni cambio de snapshot. Auditoría read-only
03:05:03.856 de41 citas/17 checks semánticos, firmas y linaje; journal680/head
32203155 idéntico. Sesión57686 exit0/PID1903207 ausente; oracle/unidad/scratch
reconciliados. Es un caso de desarrollo, no aceptación de toda la fábrica ni
eficiencia satisfactoria. [Cierre y límites](FULL-DEVELOPMENT-tGHBOv.md).

Regresión posterior QUDm3d **895 PASS/cero fallos/un SKIP**, sesión9225 exit0,
03:10:55.205;252 inputs/68runtime e inventario/streams verificados03:11:52.924.
Tres controles negativos/de finalización reales añadidos y limitación de
stdout de hijos explicitada en recibos. Defecto de reporting **no resuelto**.
No proceso de ensayo activo ni instalación nueva. Continúa integración de
fuentes grandes y cualificación v2; R01–R16 pendientes. Único checkpoint00:31,
servicio10bbffa0 no modificado por este trabajo y continuación existente ACTIVE.

### Corte anterior — 13 septiembre, 02:55 UTC

**Desarrollo tGHBOv EN CURSO**, sesión57686/PID1903207, identidad kernel en
`runs/development-live-tGHBOv/owner.json`. Misión97dc7a64-c1cf-40ab-ad59-a9635f5d2a7e,
entrada derivada a planificación, plan1 aceptado02:31:15. Candidato4526c0a8
producido02:44:13 tras tres archivos y refuerzo de pruebas ante reporter agregado;
productor y revisor ejecutaron exit0 sobre snapshot9c6f4a12 idéntico. Revisor
8ccc628c en inferencia desde02:44:15;19 criterios y oracle final aún pendientes.
Primer intento del caso no iniciado
en spVGwI; aquel fallo sigue intacto. Máximo18 llamadas, Astra/ultra y presetv1
originales; no editar inputs congelados ni duplicar. [Auditoría](FULL-DEVELOPMENT-tGHBOv.md).

khy18s cerró exit0: **892 PASS/cero fallos/un SKIP**,252inputs/68runtime y streams
íntegros02:21:30.469. Snapshot7d9ba690/405archivos/23893635B no instalado. No hay
entrega aceptada de desarrollo todavía. Ventanas sólo núcleo puro, integración documental
y cualificación real v2 pendientes. Único checkpoint00:31 y servicio10bbffa0
intactos; continuación existente ACTIVE. R01–R16 pendientes.

Diagnósticos separados, sin inferencias: YZlT77 cerró tres controles del runner
(fallo de aserción y error top-level detectados; dos callbacks completos con
conteo agregado1). wxAt7u demuestra Writable de descarte en stdout/stderr del
hijo de Node: RAW/callback recibidos, escritura normal omitida. No es truncado
del capturador; tampoco prueba tests omitidos. [Defecto de reporting abierto](NODE-CHILD-STDIO-RESULTS.md).
Ambos procesos/unidades/scratch reconciliados, sin cambios de permisos ni del
ensayo. Después de tGHBOv: incorporar controles negativos a regresión, documentar
esta limitación y seguir integración de fuentes/v2. No reinterpretar el síntoma
como solución del ejecutor o aceptación general.

### Corte anterior — 13 septiembre, 02:20 UTC

oiZzgS cerró exit0: **886 PASS/cero fallos/un SKIP**, 250 inputs/67 runtime y
streams verificados02:13:43.162. Snapshot8966cef9,404archivos/23888222B, no instalado.
Después se implementó `source-windows.mjs`: ventanas exactas Unicode/UTF-8,
hash/rango/citas y cobertura de bytes sin duplicar solapamientos; seis dirigidas
PASS. Diagnóstico read-only02:16:53.873 reconstruye SQLite en32 ventanas y
PostgreSQL enuna, hashes/raw y journal324/f35ce8bf intactos; **no exposición del
modelo ni soporte factual**. Integración del protocolo aún pendiente.

**Nueva suite khy18s EN CURSO**, inicio02:16:55.138, 252 inputs; sesión17278/
PID1899169. No modificar inputs ni duplicar. Si pasa integridad: prerregistro
[desarrollo aislado](FULL-DEVELOPMENT-PREFLIGHT.md), primer intento del caso
que spVGwI nunca ejecutó; no reparar ni reescribir el ensayo fallido y no usar
un desarrollo aprobado para dar por resueltas fuentes o toda la fábrica.
Todavía no hay llamada nueva, instalación ni otro checkpoint. Continuación
existente ACTIVE, único checkpoint00:31, R01–R16 pendientes.

### Corte anterior — 13 septiembre, 02:12 UTC

**94 pruebas dirigidas PASS**, sesión11344 cerrada exit0. Contrato v2, reentrada,
cuota/cancelación, bloqueos de autoridad/exposición y ausencia de transferencia
de overlays al revisor; diagnóstico de contexto con fuente simulada de tamaño
real. V1 conserva hash histórico. **Regresión integral oiZzgS en curso**, inicio
02:09:29.931, 250 inputs; sesión91855/PID1894563 (child1894573). No editar inputs,
duplicar suite ni inferir antes de reconciliar su resultado e integridad.

spVGwI permanece cerrado/fallido; fuentes grandes aún no solucionadas. Diseño
[exposición acotada](../design/BOUNDED-SOURCE-EVIDENCE.md) separa raw, ventanas
realmente observadas y soporte semántico; no es código instalado ni un aprobado.
Checkpoint único00:31, servicio10bbffa0/continuación ACTIVE intactos. R01–R16 pendiente.

### Corte anterior — 13 septiembre, 02:07 UTC

**spVGwI cerrado y no cualificado** a 01:47:20.802, sesión88882 exit2 y PID1881442
ausente. Dos brazos de pedidos correctos; documental bloqueado tras dos descargas
HTTP200, sin análisis factual ni entrega; desarrollo no iniciado. 12 llamadas
reales / 250792 tokens. Contexto siguiente reconstruido: 6652843 bytes, raw y dos
copias en observaciones; cap codec4MiB/worker1MiB. Firmas y fuentes verificadas
read-only, journal324/f35ce8bf intacto. No duplicar el ensayo ni alterar su historia.
[Cierre y causa](FULL-ROUTE-spVGwI.md).

Implementación nueva **opt-in closed-response-v2**: contrato propio del controlador
en lugar de Ω02/Ω23; vincula intención/política/criterios/prefijo y prohíbe efectos,
fuentes, artefactos de entrada y overlays; mantiene revisor independiente. V1
conserva exactamente su hash contractual histórico f3650cab. Diagnóstico de
contexto agrega tamaños antes de packing/inferencia, sin recorte ni cap mayor.
Pruebas dirigidas en curso; todavía sin suite integral de esos nuevos inputs,
ensayo real v2 ni instalación. La exposición de fuentes grandes sigue pendiente.
Checkpoint único00:31 conservado; servicio instalado10bbffa0 no modificado,
continuación existente ACTIVE. **R01–R16 pendientes**, no fábrica terminada.

### Corte anterior — 13 septiembre, 01:39 UTC

**Plan documental2 cambia la dependencia y conserva todos los requisitos**:
paquete de cuatro hechos con revisión VERITAS06, después síntesis Ω23 sobre
esa versión aceptada. Propuesta recibida01:37:35, 40752 tokens/296986ms; revisión
de plan en curso, todavía sin recuperación ni entrega factual. La propuesta1
RETURN y su coste siguen intactos. SpVGwI EN CURSO, sesión88882/PID1881442;
no duplicar ni modificar inputs congelados. Desarrollo todavía pendiente.

Par pedidos mantiene resultados/costes correctos, pero la auditoría descubre
deuda contractual en la selección estática de Ω23 de la ruta rápida: no usar
el acierto numérico para certificarla plenamente. Diseño de contrato cerrado
propio en `../design/CLOSED-ENTRY-CONTRACT-V2.md`, **no implementado**; no cambia
este ensayo ni el servicio instalado. 8SfWEz/runtime14936f68 fijados. Único
checkpoint00:31, continuación existente activa, R01–R16 pendiente.

### Corte anterior — 13 septiembre, 01:33 UTC

**Plan documental1 RETURN por incompatibilidad real de contrato**, no por
falta de acceso. Ω23 exige insumos aceptados antes de síntesis, ausentes al
fusionar adquisición/verificación/síntesis en un nodo. Tres checks FAIL,
razones/citas leídas; 30494 tokens/356714ms de revisión preservados.
El motor ya está en planificación intento2, dentro del límite prospectivo,
con diagnóstico de raíz y necesidad de cambiar estructura/productor. No ha
recuperado fuentes ni entregado hechos. Desarrollo aún pendiente.

Ensayo spVGwI sigue **EN CURSO**, sesión88882/PID1881442; no duplicar ni editar
inputs. Par pedidos correcto/auditado 21387 frente74932 tokens se conserva sin
generalizar. [Auditoría y fallo](FULL-ROUTE-spVGwI.md). 8SfWEz/runtime14936f68
fijados, servicio instalado intacto, sólo checkpoint00:31. Continuación activa;
R01–R16 pendiente.

Hallazgo adicional de auditoría: la ruta cerrada fija omega_02/omega_23 sin
artefactos aceptados ni juez de asignaciones del plan. El mismo requisito de
entrada de Ω23 plantea una asimetría contractual por resolver. Sus resultados
numéricos/costes permanecen correctos e intactos, pero no califican plenamente
esa selección de fichas. Diseñar/probar contrato cerrado explícito después de
reconciliar el ensayo en curso; no conceder excepción por un oracle aprobado.

### Corte anterior — 13 septiembre, 01:24 UTC

**Par real completo spVGwI correcto y auditado; resto EN CURSO**,
sesión88882/PID1881442. Misma transformación: adaptativa2 llamadas/21387 tokens,
planificada4/74932; ambas sin corrección/efectos/replay y resultado exacto.
Primer brazo ocho citas/siete criterios; segundo33 citas/15 criterios/plan
aceptado antes de producir. Auditorías readOnly01:21 y01:23, registros intactos.
Diferencia de53545 tokens sólo observada en este par conocido, no causal/global.
[Resultados](FULL-ROUTE-spVGwI.md).

Fuentes misióne4283b42-6d94-4ce5-965c-f26cfcb79b33: derivación a plan correcta,
planificación intento1 en curso; recuperación/producto factual pendientes.
Desarrollo aún no iniciado. No duplicar ni editar inputs. Suite8SfWEz y
runtime14936f68 fijados/no instalado; checkpoint único00:31 conservado, servicio
ordinario intacto. Continuación existente ACTIVE, R01–R16 pendiente.

### Corte anterior — 13 septiembre, 01:21 UTC

**Primer brazo real spVGwI completado/auditado; ensayo sigue EN CURSO**,
sesión88882/PID1881442. Pedidos/adaptativa: dos inferencias reales, 21387 tokens,
siete criterios PASS, resultado externo exacto y reentrada sin replay. Lectura
semántica y auditoría readOnly01:21:05: ocho citas/firmas/linaje vigentes,
journal82 intacto. No extrapolar precisión o eficiencia general.
[Auditoría del ensayo](FULL-ROUTE-spVGwI.md).

Pedidos/planificada, misión7a69c25c-41ca-4737-ad37-f94d2a8f4ae9: plan aceptado,
especialista autónomo y un nodo en producción, intento1. Fuentes/desarrollo
aún pendientes. No duplicar ensayo ni cambiar inputs; 8SfWEz/245 inputs y
runtime14936f68 siguen fijados. Servicio instalado y único checkpoint00:31
intactos; continuación existente activa, R01–R16 pendiente.

### Corte anterior — 13 septiembre, 01:15 UTC

**Ensayo real spVGwI EN CURSO**, sesión propia **88882**, PID1881442. Primera
misión9f6cb6f8-3402-4904-ad67-e693b0994f83, pedidos/adaptativa. No duplicar ni
modificar inputs. Llamada inicial auditada: Astra/ultra, petición completa y
prefijo íntegro; resultado final/revisión/otros brazos todavía pendientes.

Suite definitiva **8SfWEz cerrada**, 860 pruebas/859 PASS/cero fallos/un SKIP,
01:14:31.460, sesión85128 exit0. 245 inputs/64 runtime, inventario y streams
íntegros a01:14:45.627; resumen85e326cb. Runtime14936f68/401 archivos verificado,
no instalado. [Prerregistro y evidencias](FULL-ROUTE-PREFLIGHT.md).
No más checkpoint que00:31; servicio instalado intacto, continuación existente
activa, R01–R16 pendiente. Reconciliar el proceso y sus resultados antes de
otro trabajo que cambie sus inputs. No equiparar suite o brazo con fábrica lista.

### Corte anterior — 13 septiembre, 01:11 UTC

**42 dirigidas PASS después de corregir comparación de argv**, sesión 99443
cerrada exit 0. Un comando con espacios JSON se rechazaba erróneamente; nuevo
test primero rojo, ahora se compara el array exacto y se siguen rechazando
argumentos distintos/JSON inválido. No cambió runtime, petición, modelo ni gold.

1rLSfH cerró **859 pruebas / 858 PASS / cero fallos / un SKIP**, 01:09:32.692,
sesión6684 exit0. Sus 245 inputs/64 runtime y streams se verificaron íntegros
antes de editar. Resumen 97e5d00e. No cubre la corrección posterior del evaluator.
**Nueva suite 8SfWEz EN CURSO**, sesión propia **85128**, PID1877655; reconciliar
antes de inferir y no cambiar inputs. Aún cero llamadas reales en los casos
nuevos; ensayo completo pendiente de esta suite definitiva e integridad.

Se conserva el único checkpoint 00:31: 25/21 saludables/cuatro fallidas y huecos;
servicio instalado intacto. Continuación existente ACTIVE, R01–R16 pendiente.

### Corte anterior — 13 septiembre, 01:06 UTC

**Calibración de rutas completas implementada/prerregistrada; aún sin llamadas
reales nuevas.** Tres familias/cuatro brazos: transformación adaptativa/plan,
fuentes recuperadas y desarrollo con ejecución real/revisión/oracle externo.
Fichas/preset/routing/runtime intactos, presupuestos prospectivos de 8/8/12/18
llamadas; no repetir ni reetiquetar ensayos históricos.
[Contrato, fundamentos y límites](FULL-ROUTE-PREFLIGHT.md).

**41 dirigidas PASS**, sesión 72967 cerrada exit 0. Incluyen desarrollo integrado
con modelo SIMULATED y tres ejecuciones nativas: productor, revisor y oracle
externo de 3193 comprobaciones; cinco ejecuciones nativas adicionales de oracle/
mutantes. Ningún test simulado puede aprobar la cualificación real. Dos fallos
del evaluador durante construcción quedan descritos: número no canónico y
permisos de lectura durante reentrada; corregidos con regresiones negativas,
sin cambiar resultados esperados ni abrir autoridad de escritura/ejecución.

Regresión **1rLSfH EN CURSO**, inicio 01:05:04.498, **245 inputs / 64 runtime**,
sesión propia **6684**, PID1873083/child1873093. No editar sus inputs ni lanzar
otro ensayo hasta reconciliar resultado. Runtime previsto 14936f68 no instalado;
GNIRNx previo no cubre estos inputs. Después de PASS e integridad: un único
ensayo `run-live-full-route.mjs`, nuevos IDs, respuesta/recibo guardados antes
de validación, aceptación operativa y oracle externo separados. No afirmar
eficiencia, precisión general ni mandato cumplido por estas muestras.

Checkpoint único de esta continuación ya hecho **00:31:02.258**, muestra
2321e75a-88a6-4819-a85d-283c2eb08429: **25 muestras / 21 saludables / 4 fallidas**.
Nuevo hueco 23:18–00:31 conservado; segmento actual 0, máximo 5132930 ms.
Observador journal 51/5df66b9f; servicio instalado 10bbffa0/PID989536 activo/
habilitado/NRestarts0, gestor permanente verificado; journal ordinario
410/2f54d5b7 intacto y misma misión COMPLETED v7. No otra muestra, instalación,
reinicio ni misión ordinaria nueva. Continuación existente ACTIVE comprobada
01:05, misma tarea. R01–R16 sigue pendiente.

### Corte anterior — 12 septiembre, 23:57 UTC

**Corrección de esquema verificada en dos juicios reales, sólo alcance diagnóstico.**
GV6waD terminó 23:52:09.774, sesión 20670 cerrada exit 0. Copia DOS correcta:
selección PASS/fidelidad PASS. Copia UNO excluida: selección FAIL/fidelidad PASS;
el juez localiza el selector del plan como primera causa. Ambos explicitan
upstream SIMULATED. Nueve citas, firmas, exposición y orígenes verificados
readOnly; dos candidatos CANDIDATE/misiones NEW, cero efectos/reparaciones/replay.
**36286 tokens / 166137 ms**, no eficiencia satisfactoria ni cualificación general.
[Auditoría completa](CONDITIONAL-ASSESSMENT-GV6WAD.md). u6DhJK sigue fallido;
con su llamada, la corrección consumió tres inferencias reales/53273 tokens.

GNIRNx: **818 pruebas/817 PASS/cero fallos/un SKIP**, sesión 21907 cerrada.
237 inputs/64 runtime/conjunto/streams y snapshot **14936f68 / 401 archivos /
23872655 bytes** íntegros al cierre 23:56:03.175. No instalado. Ningún proceso
propio en curso; no repetir GV6waD, u6DhJK, XrlCqq ni 24pcUY. Siguiente:
preregistrar calibración de rutas completas (transformación, hechos externos,
desarrollo) antes de modificar routing o declarar eficiencia y aceptación amplia.

Checkpoint único del turno 23:18:21.783: 24 muestras/20 saludables/cuatro
fallidas, huecos intactos, segmento actual 0. Servicio instalado 10bbffa0/PID989536
intacto; sin instalación/reinicio/misión ordinaria nueva. Continuación existente
ACTIVE comprobada en su configuración, misma tarea; R01–R16 pendiente.

### Corte anterior — 23:49 UTC

**u6DhJK falló por error de esquema nuestro, ya diagnosticado y corregido en
desarrollo.** Un objeto string compartido propagaba el enum del hash del
candidato a razones/citas. El juez no podía citar evidencia válida; su salida
fue rechazada. Una llamada real/16987 tokens/39097 ms; segundo caso NO ejecutado.
No es una evaluación semántica válida ni un resultado aceptado. Recibo y salida
preservados; candidato CANDIDATE, misión NEW, cero efectos. Sesión 19366 cerrada
exit 2. [Auditoría y corrección](CONDITIONAL-ASSESSMENT-U6DHJK.md).

Nuevo test del esquema serializado reprodujo el fallo antes del arreglo;
**23 dirigidas PASS** después, todas simuladas. Regresión **GNIRNx cerrada**,
817 PASS/cero fallos/un SKIP, sesión 21907 exit 0; 237 inputs/64 runtime y
streams íntegros verificados 23:48:50.571. Runtime nuevo **14936f68 / 401 archivos /
23872655 bytes** congelado/no instalado; sólo cambia el constructor de esquema.
**Retest GV6waD en curso, sesión propia 20670**, primer caso misión
995cf555-d1a9-4593-a9b5-a15f6fd41dd8. BD/identidades nuevas, mismos dos casos
conocidos, máximo dos llamadas/cero reparaciones; no reescribe u6DhJK ni cambia
prompt/criterios. Petición real auditada 23:49:46: el esquema permite razones y
citas; instrucciones/criterios exactamente iguales. No modificar inputs ni
duplicar el proceso. Resultado real aún pendiente.

Sigue un solo checkpoint este turno: **23:18:21.783**, 24 muestras/20 saludables/
cuatro fallidas, huecos conservados; segmento actual 0. Servicio instalado
10bbffa0/PID989536 intacto; no instalación/reinicio/cola ordinaria nueva.
Continuación existente activa, R01–R16 pendiente.

### Corte anterior — 23:39 UTC

**Vía diagnóstica condicional implementada, todavía no cualificada en vivo.**
Resultado firmado separado, sin ACCEPT operativo; actor bloqueado para revisión
material/herramientas. Contrato previo, criterios diagnósticos explícitos,
prerrequisitos/mandato/política fijados; fallos sin repetición automática y relectura
sin replay. 22 dirigidas PASS, sólo proveedores simulados. Se corrigió un error
del montaje de integración (faltaba propietario exclusivo al instalar plan),
sin modificar el control del runtime. [Contrato y casos nuevos](CONDITIONAL-ASSESSMENT-PREFLIGHT.md).

**Ensayo u6DhJK iniciado**, sesión propia **19366**, primer caso misión
755fb9d5-73ee-4a8e-bda4-865839c78d91. Máximo dos juicios reales/cero
reparaciones: copia correcta/DOS y equivocada/UNO, ambas fieles; upstream
simulado. Todavía sin resultado. No duplicar ni modificar inputs en curso.
Runtime **6d198c9f / 401 archivos / 23872507 bytes**, congelado/no instalado.
Regresión mrjFVh cerrada **817 pruebas/816 PASS/cero fallos/un SKIP**,
23:37:43.138, sesión 85261 exit 0; 237 inputs/64 runtime y streams íntegros
comprobados 23:38:10.924. Resumen 676e6d72. El resultado diagnóstico no puede
aceptar el producto. No repetir XrlCqq/24pcUY ni reinterpretar sus resultados.

**Checkpoint único 23:18:21.783**, saludable,
`soak-sample:8b69295d-7805-431e-8260-69794d8d21e8`, journal observador
49/d9cb5cf5. 24 muestras/20 saludables/cuatro fallidas; nuevo hueco
22:31–23:18 conservado, segmento actual 0/máximo 5132930 ms. Servicio
instalado 10bbffa0/PID989536 activo/habilitado/NRestarts 0; journal ordinario
410/2f54d5b7 y única misión COMPLETED v7 sin cambios. Sin instalación,
reinicio, misión ordinaria nueva ni otro checkpoint. Continuación existente
activa; R01–R16 pendiente.

### Corte anterior — 22:47 UTC

**Procedencia de inferencias de prerrequisitos implementada, no instalada.**
Observación firmada aditiva, REAL/SIMULATED/MIXED/UNKNOWN/NONE, recibos de
productor y revisor históricos. No altera criterios/decisiones ni pruebas
existentes; exposición sólo al revisor, fuera de revisión ciega cerrada.
28 dirigidas PASS, sin llamadas reales. [Diseño, hashes y evidencia](DEPENDENCY-INFERENCE-PROVENANCE.md).

Contraste readOnly 22:41:21: los cuatro casos XrlCqq muestran productor y
aprobador upstream SIMULATED, no puertas revisadas reales. Journals y pruebas
nativas originales idénticos, resumen f7e7a51d sin cambios y `passed:false`.
No se reinterpretan los positivos ni se reejecuta la prueba. La clasificación
estructurada no demuestra todavía cómo la entenderá un juez real.

Regresión **3wpIFU cerrada: 795 pruebas/794 PASS/cero fallos/un SKIP**,
22:41:20.357–22:45:00.035, 219572 ms. Sesión 97968 cerrada exit 0.
231 inputs / 63 runtime y salidas completos verificados 22:45:44.625.
Resumen 199511d5, runtime **36caa8fc / 400 archivos / 23859342 bytes**
congelado y verificado, no instalado. Ningún proceso propio en curso.
Siguiente: separar evaluación condicional diagnóstica de aceptación integrada
real, con contrato/oracle nuevos antes de otro ensayo; no repetir XrlCqq/24pcUY.

Checkpoint único de esta continuación: **22:31:34.722**, saludable,
`soak-sample:4405b671-e95c-4d0a-b58f-19297ef7535d`, journal observador
47/83ec9787. **23 muestras/19 saludables/cuatro fallidas**; nuevo hueco
21:22–22:31 conservado, segmento actual 0/máximo 5132930 ms. No acredita
72 horas, disponibilidad continua ni trabajo útil sostenido.
Servicio instalado 10bbffa0/PID989536 activo/habilitado/NRestarts 0; journal
ordinario 410/2f54d5b7 sin cambios, única misión ordinaria COMPLETED v7.
Sin instalación, reinicio, misión nueva, inferencias reales ni otro checkpoint.
Continuación existente ACTIVE, misma tarea, R01–R16 pendiente.

### Corte anterior — 21:54 UTC

**XrlCqq cerrado/auditado, contraste completo NO aprobado.** Cuatro llamadas
reales de revisión de producto, ocho pasos upstream simulados, cero reintentos/
efectos/replay. Ambos objetos equivocados detectados con selección FAIL y
fidelidad PASS. Los positivos difieren al interpretar el prerrequisito simulado:
case-0 RETURN/selección UNKNOWN, case-3 ACCEPT/PASS; ambos identifican el objeto
correcto. No etiquetar case-0 como confusión ALFA/BETA ni cambiar el oracle para
aprobar. Tres casos conformes de cuatro no son una estimación de precisión.
[Resultados, auditoría y cambio de método](NATIVE-SELECTION-REVIEW-XrlCqq.md).

Auditoría readOnly 21:52:09–21:52:10: 73 citas y 16 controles contrastados,
recibos/exposiciones/fichas completas y orígenes recalculados. Cuatro hilos reales
Astra/ultra, **91360 tokens/739235 ms de llamadas**, sin acreditar eficiencia
satisfactoria ni planificación real de todo el recorrido. Se conservan los
estados: tres NEEDS_DIRECTION, un COMPLETED de diagnóstico con upstream simulado.
Sesión 24690 cerrada exit 2; ninguna prueba propia en curso. No repetir XrlCqq,
24pcUY ni misiones antiguas; no nuevos permisos/API/compras/instalaciones.

NmrLo4 permanece 781 pruebas/780 PASS/cero fallos/un SKIP, 229 inputs idénticos;
runtime cb746cb7/399 archivos íntegro y NO instalado. El siguiente trabajo es
separar aceptación real de evaluación de fixtures y exponer procedencia
real/simulada/desconocida de los prerrequisitos, con diseño y pruebas antes de
otro ensayo. No rebajar controles o disfrazar un recibo simulado.

Checkpoint único sigue siendo 21:22:47.412: 22 muestras/18 saludables/cuatro
fallidas, huecos conservados, segmento actual 0; sin otra muestra este turno.
Servicio instalado 10bbffa0/PID989536 sin cambios. Continuación existente ACTIVE,
misma tarea, sin duplicarla. Mandato completo R01–R16 pendiente.

### Corte anterior — 21:38 UTC

**Ensayo XrlCqq iniciado**, sesión propia 24690; primer caso misión
351b2f60-b26f-4cb8-aeee-13442e9492d5. Cuatro juicios reales de producto como
máximo, con propuestas/aceptaciones previas SIMULADAS. No hay resultado todavía.
Runtime cb746cb7/harness 28a1e62a/runner ada8fa2a/casos bfb51bbd congelados;
no modificarlos ni duplicar el ensayo mientras corre. [Contrato](NATIVE-SELECTION-REVIEW-PREFLIGHT.md).
Regresión NmrLo4 final: 781 pruebas/780 PASS/cero fallos/un SKIP, 229 inputs
y salidas íntegras comprobados 21:37:51.260. Sesión 55287 cerrada exit 0.
Sólo checkpoint 21:22 en esta continuación; servicio instalado intacto.
La continuación existente sigue ACTIVE y R01–R16 pendiente.

### Corte anterior — 21:31 UTC

**Harness de contraste de selección implementado; regresión definitiva en curso.**
Once pruebas dirigidas PASS, proveedor simulado; incluyen falsos ACCEPT, citas
inválidas preservadas, cuota sin repetición, freeze y reentrada positiva/negativa.
Dos fallos iniciales del oracle de reentrada documentados y corregidos sin tocar
runtime. [Contrato y hashes](NATIVE-SELECTION-REVIEW-PREFLIGHT.md).
Suite NmrLo4 empezó 21:29:11.755 con 229 inputs; sesión propia 55287, aún sin
resultado. No modificar inputs hasta cierre. Casos/harness/runtime cb746cb7
congelados, máximo cuatro juicios reales después de regresión válida; ninguna
llamada real nueva todavía. No repetir 24pcUY ni usar el harness de role-fit.

**Checkpoint único de esta continuación:** 21:22:47.412 saludable, muestra
6bf2cfec-24b7-4d9e-8053-66bdf30bf1f1; journal observador 45/22af8223.
22 muestras/18 saludables/cuatro fallidas; otro OBSERVATION_GAP conservado,
segmento actual 0/máximo 5132930 ms, sin acreditar disponibilidad/trabajo continuo.
Servicio instalado 10bbffa0/PID989536 activo/habilitado/NRestarts 0; sin reinicio,
instalación o cola ordinaria nueva. Continuación existente ACTIVE confirmada,
misma tarea, no duplicada. R01–R16 pendiente.

### Corte anterior — 20:45 UTC

**24pcUY COMPLETED y auditado: copia nativa integrada cualificada en este caso
diagnóstico conocido.** Tres inferencias reales Astra/ultra, dos aceptaciones,
cero fallos/reparaciones/efectos. 18 checks del harness y doce criterios finales
PASS. Origen/cuerpo de 47 bytes exactos, reentrada sin nuevas inferencias ni
cambio material. Revalidación SQLite readOnly 20:39:57.022, journal
183/63dc0aa1. [Auditoría completa](SOURCE-NATIVE-LIVE-24pcUY.md).

**No equivale a eficiencia satisfactoria:** 70846 tokens y 476888 ms para el
diagnóstico con planificación forzada. No hay comparación causal ni calibración
amplia. Runtime cb746cb7 no instalado; sigue opt-in. Suite Bx7JMX cualifica el
corte de 224 inputs/62 runtime, no los dos archivos nuevos posteriores.

**Siguiente puerta preparada:** cuatro casos de selección correcta/equivocada
con copia nativa válida en todos, tres tests deterministas PASS. Casos/oracle
bfb51bbd, test b88df01e. [Contrato prospectivo](NATIVE-SELECTION-REVIEW-PREFLIGHT.md).
Falta implementar/probar el harness de juez real, regresión definitiva y un
ensayo acotado prospectivo; no usar directamente el harness antiguo de role-fit.
No se han hecho llamadas reales para estos casos. No repetir 24pcUY ni editar
sus datos brutos. Sesión 68905 cerrada exit 0; no ensayos propios en curso.

Checkpoint único permanece 20:07: 21 muestras/17 saludables/cuatro fallidas,
nuevo OBSERVATION_GAP conservado; no otra muestra este turno. Servicio instalado
10bbffa0/PID989536 sin cambios. Continuación existente ACTIVE confirmada;
sin otra automatización, instalación, reinicio o misión ordinaria. R01–R16 pendiente.

### Corte anterior — 20:30 UTC

**Ensayo integrado 24pcUY en ejecución.** Misión aislada
163ea070-3ca4-41b0-862c-978815acf64a, sesión propia 68905; planificador real
iniciado, ningún resultado aceptado todavía. Runtime cb746cb7, harness 24cd6640
y oracle 36ccbaaa congelados. Máximo cinco llamadas, un plan; no modificar estos
inputs mientras corre. Regresión definitiva Bx7JMX: 770 tests/769 PASS/cero
fallos/un SKIP, 224 inputs y 62 inputs runtime idénticos verificados 20:29:57.387.
Contrato y hashes en [preflight](SOURCE-NATIVE-INTEGRATED-PREFLIGHT.md).
No instalación, reinicio ni misión en cola ordinaria. No duplicar el ensayo.
El checkpoint único sigue siendo el de 20:07; no tomar otra muestra este turno.

### Corte anterior — 20:18 UTC

**Preparación de cualificación integrada, todavía sin llamadas reales nuevas.**
Harness nuevo y oracle independiente de v1/anclas, con máximo cinco llamadas,
un intento de plan y cero productor LLM/efectos. 30 dirigidas PASS tras corregir
la expectativa del verificador sobre reentrada: cuatro eventos legítimos,
dos del lock y dos de la comprobación vacía firmada; todo el trabajo anterior
se conserva. El runtime no cambió respecto a cb746cb7. Primera regresión en curso;
harness modificado durante ella para cerrar la ruta alternativa de inferencia,
por lo que no se atribuirán inputs actuales idénticos a ese resultado. Se repetirá
la suite definitiva antes de llamar. [Contrato prospectivo](SOURCE-NATIVE-INTEGRATED-PREFLIGHT.md).

**Checkpoint único:** 20:07:47.923 UTC saludable, muestra 448d4467-9dce-4521-b20f-c118d394b6ba;
journal observador 43/da1ae579, 21 muestras/17 saludables/cuatro fallidas.
OBSERVATION_GAP entre las últimas muestras, segmento actual 0; máximo 5132930 ms.
No acredita disponibilidad o trabajo continuo. Servicio 10bbffa0/PID989536
activo/habilitado, NRestarts 0; journal ordinario 410/2f54d5b7 y misión previa
sin cambios. Sin instalación/reinicio/cola nueva. Mandato completo pendiente.

### Corte anterior — 19:35 UTC

**Regresión de la integración finalizada: 765 pruebas, 764 PASS, cero fallos,
un SKIP.** Suite xy31zh, 19:30:57.900–19:34:18.766; 221 inputs/conjunto/salidas
verificados 19:35:07.323, 62 inputs runtime coinciden con cb746cb7 congelado,
399 archivos/23852062 bytes. No instalado; no inferencias reales en esa suite.
source-text-v1 sigue opt-in, sin cambiar preset o historial. Fichas, scope,
feedback y contexto ciego conservados. [Hashes y alcance](../design/SOURCE-TEXT-VIEW.md).

No hay procesos de ensayo propios en curso. fV56uy, dos selecciones reales
exactas, sigue ligado sólo a 837e2eba; no cualifica este wrapper completo.
Siguiente: harness/oracle nuevos para ambos selectores y cualificación integrada
de plan, origen nativo, revisión y reentrada; no reutilizar el oracle histórico
que sólo admite v1. Después siguen calibración amplia y operación prolongada.

Único checkpoint de esta continuación: el saludable de 18:59, con 20 muestras y
cuatro fallos históricos conservados. No otra muestra, misión ordinaria, reinicio,
instalación o llamada real posterior a fV56uy. Servicio instalado 10bbffa0.
Continuación existente confirmada ACTIVE en la misma tarea. Mandato R01–R16
pendiente; una versión congelada no se presenta como entrega final.

### Corte anterior — 19:31 UTC

**Integración opt-in en desarrollo; regresión completa en curso.** source-text-v1
conserva contexto íntegro, añade sólo missionIntent ya admitido y mantiene ciegas
la réplica y la revisión material. Scope/prefijos, límites, feedback retenido y
controles históricos admiten la nueva forma sin promover overlays anteriores.
Segunda batería dirigida terminó con exit 0 (203 pruebas); jueces simulados,
Store/broker y controles nativos reales. Primera batería conservada en el diseño:
194/195 PASS por una expectativa incorrecta de test, corregida a LEARNING_SCOPE.
No instalación ni llamada real adicional. Cualificación del planificador completo
con este wrapper pendiente; no usar 837e2eba como si incluyera esta integración.

### Corte anterior — 19:18 UTC

**fV56uy cerrado: dos selecciones reales exactas, ninguna reparación/repetición.**
Vista literal prospectiva del texto fuente; 47 y 59 bytes preservados, CRLF/NFD
y backslashes literales diferenciados. Dos llamadas Astra/ultra por suscripción,
16377 tokens, sin misión/producto/juez. Auditoría manual íntegra y revalidación
19:18:08.546. OZcLj2/cVQFI4 conservan sus fallos; no prueba de eficiencia general.
[Contrato, resultados y hashes](../design/SOURCE-TEXT-VIEW.md).

Suite 7GNpLy: 754 pruebas/753 PASS/cero fallos/un SKIP, terminada 19:08:54.879.
219 inputs/conjunto/salidas verificados 19:15:48.271; 61 inputs runtime coinciden
con 837e2eba, 398 archivos/23844842 bytes, congelado y no instalado. No ensayos
propios en curso. Siguiente: transporte opcional que añada la vista sólo a fuentes
ya admitidas, sin importar missionIntent privado a las rutas ciegas; pendiente
prueba del planificador completo y aceptación nativa independiente.

**Checkpoint único de esta continuación:** 18:59:08.611 saludable, muestra
4eaa71be-b30f-48fe-b293-0306d7462d3d; observador journal 41/16e038ac. 20 muestras,
16 saludables/cuatro fallidas; estado OBSERVING, segmento actual 0, máximo
5132930 ms. Se conserva el hueco de más de 50 horas. La comprobación del ejecutable
abierto verifica bytes idénticos entre archivos distintos; no memoria ni uptime.
Servicio 10bbffa0/PID989536 activo/habilitado, NRestarts 0; journal ordinario
410/2f54d5b7 y misión previa sin cambios. Sin reinicio, instalación o cola nueva.
Continuación existente activa; R01–R16 pendiente.

### Corte anterior — 18:26 UTC

**No hay ensayos propios en curso.** cVQFI4 cerró a las 18:21:22.868 sin
aprobar: una llamada real de 8282 tokens devolvió escapes literales en vez de
saltos de línea en las anclas. Fuente, recibo, paquete y harness verificados
18:24:08.119; no se reparó ni repitió la respuesta. OZcLj2 también conserva su
fallo. Ambos se mantienen separados del éxito integrado ODeAyj.

Se incorpora el contraejemplo real a la regresión: 25 dirigidas PASS,
20192,87 ms, sin modelo real. Incluye fuente con LF y fuente distinta con
backslash+n literal: no se permite convertir una en otra para aceptar.
Suite global previa D4aqew: 748 pruebas/747 PASS/cero fallos/un SKIP.
Después sólo cambió input-copy.test.mjs para añadir este negativo; los 60
inputs runtime de 9748682b siguen sin cambio. No atribuir 749 pruebas a la
suite anterior ni declarar sus 214 inputs actuales idénticos.

Servicio canónico confirmado activo/habilitado, PID 989536/NRestarts 0;
instalado 10bbffa0, sin activación/reinicio/cola nueva/checkpoint adicional.
Continuación existente continuar-sovereign-factory verificada ACTIVE, misma
tarea, sin duplicarla. R01–R16 continúa pendiente.

Próximo trabajo: resolver la ambigüedad entre fuente original y serialización
que afecta a la selección, comparar vistas/referencias sin transcripción y
aclarar la preferencia del selector nuevo frente a v1. Antes de otra llamada,
fijar contrato y prueba distintos; no repetir OZcLj2/cVQFI4 ni instalar por
tests simulados. [Resultado y límites](../design/NATIVE-INPUT-SPAN.md).
Después quedan calibración representativa, valor marginal de capacidades y
operación prolongada; el caso matemático integrado no las sustituye.

### Corte anterior — 18:21 UTC

Diagnóstico **native-span-probe-cVQFI4 en curso**, una llamada real sólo para
seleccionar límites. No es misión completa ni juez. Runtime 9748682b congelado,
397 archivos/23841112 bytes; no se instala ni se modifica durante la prueba.
Suite-D4aqew final: 748 pruebas/747 PASS/cero fallos/un SKIP, 216697,40 ms;
214 inputs/conjunto/salidas y 60 inputs runtime verificados 18:20:36.800.
[Contrato prospectivo](../design/NATIVE-INPUT-SPAN.md). No hay resultado aún.

### Corte anterior — 18:13 UTC

**OZcLj2 terminó NEEDS_DIRECTION**, 18:04:45.046: dos planes rechazados,
ningún producto ni juicio. El segundo transcribió incorrectamente un acento
combinante y su selección no existía en la petición. Fallo conservado y auditado;
paquete/harness/capturas verificados, sin reanudar ni instalar. Tokens rechazados
desconocidos, no cero. En desarrollo posterior, literal-input-span-v1 señala
dos anclas únicas y copia el tramo original sin transcribir su contenido.
24 dirigidas PASS (jueces simulados), pendiente regresión y prueba real.
[Contrato y razones](../design/NATIVE-INPUT-SPAN.md),
[auditoría del fallo](NATIVE-INPUT-LIVE-PREFLIGHT.md#cierre-y-auditoría-del-fallo--1813-utc).

### Corte anterior — 18:00 UTC

**OZcLj2 en curso**, un único diagnóstico real de selección literal desde
18:00:14.935, misión a6a8a9e3, runtime ba4e6ca4 congelado (397 archivos/
23837533 bytes). Sin resultado aún. Sustituye el preflight b00b565a antes de
su lanzamiento; no se ejecutó una misión en el paquete con el defecto de
recuperación. Suite cRbG5M: 739 pruebas/738 PASS/cero fallos/un SKIP, 213
inputs/salidas íntegros verificados 17:57:14.464; 60 inputs runtime coinciden
con ba4e6ca4 a las 17:58:03.198. Sólo selector y QA del inspector cambiaron
después de la batería, fuera de ese paquete y del harness real.
[Contrato prospectivo](NATIVE-INPUT-LIVE-PREFLIGHT.md).

Inspector integrado actualizado a ODeAyj: 380369 bytes, 6 fichas y 86 pruebas,
snapshot 17:58:04.172. QA Chrome PASS 17:59:46.007, controles de 24 PASS,
resultado MISMATCH exacto, fichas/citas desplegables, 736/360 claro/oscuro;
pantallas vistas. Snapshot wmUkhp archivado, no borrado. Preview propio cerrado
después; no es hosting ni enlace localhost entregable. Servicio instalado
verificado en lectura: PID 989536 activo/habilitado, NRestarts 0, gestor canónico;
sin instalación, reinicio, checkpoint adicional o misión ordinaria.

**ODeAyj COMPLETED y aprobado** a las 17:52:47.981. Nueve inferencias reales,
cinco ACCEPT/cero RETURN, una réplica/cero efectos; 296453 tokens observados,
49 min 30,739 s. Catorce condiciones del harness verdaderas, 24 criterios
finales PASS leídos íntegramente junto al informe y exposición pública bilateral.
Revalidación en lectura con 1588b9b9 PASS a las 17:55:39, journal 615/be8ba07d,
sin modificar historial. No instalación ni cierre de R01–R16; eficiencia general
pendiente. [Auditoría completa](PLANNED-BLIND-LIVE-ODeAyj.md).

### Corte anterior de esta continuación

Actualización 17:52: se detectó y corrigió una ventana de recuperación nativa:
salir después del claim antes del candidato duplicaba el origen. Registro y
claim ahora se comprometen juntos; el claim previo recupera su origen exacto,
sin sustituir silenciosamente uno ausente/alterado. Quince pruebas dirigidas
PASS, cuatro salidas reales de hijos propios/proveedor simulado. Regresión
posterior requerida; **no lanzar b00b565a ni instalarlo**. ODeAyj sigue intacto
en 1588b9b9, revisión final en curso.

**ODeAyj en curso**, desde 17:03:17.242, misión 52a897d8, runtime congelado
1588b9b9. Un solo ensayo diagnóstico, sin instalación ni modificaciones a fuentes.
Plan, original y protocolo aceptados y leídos íntegramente; réplica en curso
en el último corte. No final ni aprobación integrada todavía.

En desarrollo posterior: copia literal nativa con selección única de la petición,
plan previamente aceptado, origen firmado y juicio independiente; sin inferencia
productora ni claims factuales. 41 pruebas relacionadas PASS y una integración
cerrada adicional PASS sin filtrar el original ni repetir la réplica.
Regresión 6NYrsp: 734 pruebas/733 PASS/cero fallos/un SKIP; 209 inputs y salidas
verificados 17:28:16.441. Paquete b00b565a congelado después, sin instalar.
Regresión posterior bKBKdE, con el harness y oracle de selección añadidos:
735 pruebas/734 PASS/cero fallos/cancelaciones/todo/un SKIP, 206254,96 ms,
17:38:17.754–17:41:44.121. Los 212 inputs, conjunto completo y ambas salidas
coinciden a las 17:44:26.881; interruptedBy null. Los 60 inputs runtime coinciden
con b00b565a, 397 archivos/23836139 bytes, sin código runtime no probado.
Prueba real de copia con distractor/CRLF/Unicode preparada pero no lanzada:
primero se cerrará ODeAyj. No es ahorro real medido ni selección semántica
cualificada. [Contrato y negativos](../design/NATIVE-INPUT-PREFLIGHT.md).

**94TM7H terminó ACCEPT, 28 PASS y ninguna finding.** Se leyeron todas sus
razones/citas y la observación bilateral completa resuelve expresamente el
UNKNOWN anterior. Una llamada real, 96.219 tokens; once fronteras del ensayo
aprobadas. El informe conserva 62/61, distancia 1 y MISMATCH. Revalidación
read-only posterior PASS; fuente y rechazo intactos. **Ni la fuente ni la copia
se han reanudado o completado; no se instala 02be548e.**
[Auditoría y hashes](COMPARISON-EVIDENCE-BILATERAL.md).

GUF4WD: 718 pruebas/717 PASS/cero fallos/un SKIP, 240,13 s, después de reforzar
el harness. Seis pruebas dirigidas verifican UTF-8 fragmentado, SIGTERM real
sobre su propio hijo, salida parcial conservada, fallo de spawn y rechazo de
un exit 0 interrumpido. El runtime de 02be548e no cambió durante esa evaluación.

Después de GUF4WD se trabaja en una optimización de **posiciones históricas,
no de aceptación**: una revalidación repetía 474 lecturas del journal. Índice
efímero por validación, invalidado por escrituras, rollback, otra conexión y
cambio del lector; no conserva decisiones ni omite comprobaciones. La prueba
de rollback detectó un defecto inicial, corregido con identidad de cabecera;
cuatro dirigidas posteriores PASS, 1 página frente a 474 y 35 comprobaciones
individuales conservadas. Regresión ampliada: **151/151 PASS**, 114,77 s.
En el informe real: 1 frente a 4576 páginas y las mismas 1018 comprobaciones;
15171,58 frente a 25577,93 ms, una muestra por versión, sin ahorro de tokens
atribuido. [Contrato y medición](../design/VALIDATION-CHRONOLOGY-INDEX.md).
Regresión global **6HfZqD: 722 pruebas/721 PASS/cero fallos/un SKIP**, 190,63 s;
206 inputs y ambas salidas coinciden a las 17:01:47.204. Runtime congelado
**1588b9b9**, 395 archivos/23814804 bytes, 58 inputs runtime coincidentes,
sin instalar. ODeAyj preparado en ese corte previo para un único recorrido
integrado prospectivo del mismo caso; su lanzamiento posterior está arriba.
No es holdout ni recuperación de fuentes.
[Preflight](PLANNED-BLIND-LIVE-ODeAyj.md).

### Corte previo — 16:25 UTC

**Regresión i8xKuV aprobada:** 715 pruebas/714 PASS/cero fallos/un SKIP live,
237,37 s. A las 16:25:15.711 coincidían sus 204 inputs, el conjunto de archivos
y los hashes de ambas salidas; los 58 archivos runtime probados coinciden con
el paquete aislado **02be548e**, 395 archivos/23.812.686 bytes, no instalado.
Las 24 pruebas de planned-blind pasan después de corregir sus citas repetidas.

Evaluación bilateral **94TM7H en curso**, iniciada 16:25:25.606 UTC: copia de
wmUkhp y una única llamada real máxima. Solicitud retenida 16:25:28.301,
revisor `cb03f4bc-5d4e-455e-8501-0b0ffb1fbf6b`. No cambia fuente, original,
sello, informe, criterios, roles, modelo/esfuerzo ni servicio. Aceptarla no
completará ni reanudará la misión fuente. [Preflight y límites](COMPARISON-EVIDENCE-BILATERAL.md).

### Diagnóstico y corrección previos — 16:10–16:24 UTC

**wmUkhp terminó NEEDS_DIRECTION, no aprobado.** Informe devuelto: 27 PASS
y UNKNOWN en la noexposición bilateral. La evidencia final omitía los contextos
y solicitudes completadas de la réplica y de su juez material; no bastaban
la aprobación del protocolo ni el inventario del comparador. Once inferencias,
372.388 tokens, una réplica/cero efectos; no final. Auditoría completa de los
28 criterios en [wmUkhp](PLANNED-BLIND-LIVE-wmUkhp.md). Journal 731/020471fc
y rechazos conservados. **No activar 4b31034b; servicio instalado sin cambios.**

Corrección en desarrollo: evidencia bilateral posterior a apertura con registros
históricos exactos, solicitudes públicas completas, recibos y revisión material.
Las pruebas antiguas conservan su formato sin conocimiento retroactivo. Tres
regresiones iniciales fallan, luego cinco dirigidas PASS; el corte dirigido
ampliado da 100 PASS/dos FAIL por un fallo latente en la reparación de revisiones:
BLIND_REVIEW mezclaba cita ausente con hilo contaminado. Se separa el código
reparable BLIND_REVIEW_PROOF; el segundo caso detiene al actor sin otra inferencia.
Diez pruebas dirigidas posteriores PASS, incluida corrección legítima de cita
con dos solicitudes conservadas. DAsvOz completó la regresión 16:13:30 UTC:
712 pruebas/699 PASS/12 FAIL/un SKIP. Sus 202 inputs y salidas se verificaron
sin discrepancias; los fallos del simulador planned-blind se investigan y
se corrigen citas duplicadas, no presupuestos ni pruebas de entrada. Batería
dirigida posterior en curso. [Contrato bilateral](../design/CLOSED-EXPOSURE-CONVERGENCE.md).

El intento previo q4IseV recibió terminación (exit 143), sin resultado conservado;
se desconoce el emisor. No cuenta como regresión aprobada. Desde DAsvOz se
conservan manifiesto inicial y flujos parciales en disco. Además, el comprobador
de despliegue rechaza interrupción, cancelaciones, resúmenes incompletos y
conteos inconsistentes incluso ante exit 0; tres pruebas de ese predicado PASS.

Se preparó una única evaluación aislada del mismo informe con la nueva evidencia,
sin modificar fuente, original, sello, criterios, roles o política. El harness
previo A9wggt se archivó con hash exacto ff47449c antes
de adaptarlo a wmUkhp. Ninguna aceptación aislada rehabilitará la misión original.

Inspector de wmUkhp actualizado con estado terminal, 6 fichas/102 pruebas,
479.891 bytes; Chrome QA PASS 16:05:39 y pantallas claro/oscuro inspeccionadas.
La proyección mantiene los dos RETURN y no presenta final aceptado.

### Corte previo — 15:55 UTC

**wmUkhp está en curso, no aprobado.** Comenzó a las 15:06:34.813 UTC en
4b31034b, misión `38c9896a-e45c-4b5d-94d7-cecad1de43ba`, base aislada.
La primera propuesta (15:18:18), con cuatro etapas y comparación nativa final,
fue devuelta a las 15:23:08: omega_23 exige un dossier, incompatible con el
literal requerido en el nodo original. El planificador corrige la asignación
con feedback persistido. Su segunda propuesta fue aceptada a las 15:31:42,
con los mismos 22 requisitos/23 criterios y una ficha autónoma completa para
el original. La misión está RUNNING. Paquete 4b31034b preparado y verificado
en el directorio de releases, pero no activado; servicio y cola sin cambio.
[Contrato y lectura del ensayo](PLANNED-BLIND-LIVE-wmUkhp.md).

Original exacto `62` aceptado por fidelidad; protocolo completo aceptado con
seis controles matemáticos propios. Una sola réplica sellada obtuvo `61`,
con menores 34/−5/−4, términos 68/5/−12 y Sarrus 53−(−8). Lectura íntegra
de respuesta, controles, residual y juez material: cinco PASS, ACCEPT a las
15:49:22. Apertura sólo después de esa aceptación; informe nativo 62/61,
distancia 1/MISMATCH, bajo revisión final de 28 criterios. No final aceptado.
Prueba read-only 15:53:36: journal 675/b1533278 íntegro, aprobación histórica
exacta y respuesta completa idéntica al sello, una réplica/cero efectos.

Suite-AXwQ9H vuelve a dar 706 pruebas/705 PASS/cero fallos/un SKIP, 237,93 s.
Su script de QA visual cambió después del lanzamiento; el resto de los inputs
y las salidas coincidían en la comprobación posterior. QA independiente actual
PASS en Chrome (736/360, claro/oscuro); no atribuir ese cambio posterior a AXwQ9H.
Los 57 archivos runtime siguen idénticos a la release y regresión previas.

**suite-6gbyYo: 706 pruebas, 705 PASS, cero fallos/un SKIP**, 231,56 s.
Los 201 inputs, conjunto completo de archivos y hashes de salidas coincidían
a las 15:06:23.414, antes del lanzamiento. El ensayo conserva sus fuentes y
runtime congelados; no se modificarán mientras ejecute.

### Corte previo — 15:03 UTC

**La prueba adicional A9wggt aceptó el informe, no la misión.** Una llamada
real y cinco PASS; mismo candidato, sello, criterios y resultado, con el RETURN
anterior intacto. El nuevo juez cita la aprobación histórica ahora expuesta y
explica por qué resuelve la carencia. 33.965 tokens observados. La fuente xMileM
sigue NEEDS_DIRECTION, sin dossier ni final; no se reanudó ni siquiera la copia.
[Auditoría íntegra](COMPARISON-EVIDENCE-A9wggt.md).

Antes de otro recorrido se detectó y corrigió un fallo de compatibilidad:
la observación antigua no podía revalidarse con el formato nuevo. Contraprueba
real read-only y test FAIL, luego cuatro tests PASS y ambas bases históricas
válidas con sus formatos propios, sin conocimiento retroactivo. Cuerpos alterados
y ampliaciones parciales siguen rechazados. El desarrollo posterior a edfdf8fe
está congelado en **4b31034b**, 394 archivos/23.806.559 bytes, sin instalar.

Ocho pruebas de los predicados corregidos del harness PASS; versiones exactas
anteriores archivadas con hashes coincidentes. Suite-p2UhJG: 704 pruebas,
703 PASS/cero fallos/un SKIP antes del arreglo de compatibilidad; nueva regresión
completa en curso. Se ha reservado `runs/planned-blind-live-wmUkhp`, **todavía
sin lanzar**, para un recorrido independiente desde petición natural. No es un
holdout ni una calibración amplia; no rehabilitará ninguna ejecución anterior.

Servicio observado 14:46:58: enabled/active, PID 989536, cero reinicios.
La base ordinaria conserva journal 410/2f54d5b7 y la misma misión COMPLETED v7;
ningún checkpoint adicional. No hay nueva instalación ni misión ordinaria.
R01–R16 continúa pendiente; no se declara la fábrica terminada.

### Corte previo — 14:42 UTC

**xMileM terminó sin aprobación integrada.** Una réplica real produjo 61,
con cuentas correctas y dos controles PASS; su juez material la aceptó antes
de abrir el original 62. La comparación nativa conserva distancia 1/MISMATCH,
pero su juez la devolvió porque no se exponía la aprobación histórica del
protocolo con el original. Esa aprobación existe; falta su prueba en la frontera
del juez final. No hay dossier ni final aceptado. Once llamadas reales,
385.685 tokens observados; no se presenta ese coste como eficiencia satisfactoria.
Se conservan también los dos límites del harness detectados antes del resultado.
[Lectura completa de protocolo, intento, comparación y juicios](PLANNED-BLIND-LIVE-xMileM.md).

En desarrollo se reutiliza la comprobación histórica de freeze para exponer su
prueba sólo después de apertura, con juicio previo completo y citas. No se
revela al replicador ni al juez material, ni se reescribe la comparación.
95 pruebas de la ruta y tres de integración/imports PASS; suite-Yiv1Eq:
700 pruebas, 699 PASS/cero fallos/un SKIP, 222,52 s. Sus 200 inputs y salidas
coincidían a las 14:37:58.721; después se agregó el juicio íntegro a la proyección
(cuatro pruebas PASS, 2,54 s) y un harness de evaluación aislada de una llamada.
Regresión posterior en curso; **esa evaluación real todavía no se ha lanzado**.
No autoriza repetir la réplica, reanudar automáticamente la misión ni borrar RETURN.

Inspector actualizado 14:33:50, tres snapshots/10 fichas/106 pruebas únicas,
913.117 bytes. QA Chrome PASS y lectura visual real en 736 claro/360 oscuro,
con juicios, fuentes y fallos desplegables. Es snapshot, no controlador en vivo.
No hay instalación, reinicio, misión ordinaria nueva ni otro checkpoint.
R01–R16 continúa pendiente.

### Corte previo — 14:14 UTC

**xMileM sigue en curso:** segundo plan aceptado a las 14:06:54, original literal
aceptado 14:07:28, protocolo candidato bajo revisión. El plan agrega un dossier
posterior; el oráculo congelado exige comparación como final y no se modificará
para adaptarlo. Se separará ese predicado del estado real y la revisión material.
El protocolo completo leído ya atribuye sólo dos controles aritméticos propios
a la réplica; preserva los controles externos en sus etapas, sin repetir A01.
[Auditoría y límites](PLANNED-BLIND-LIVE-xMileM.md).

**suite-HrubKy no pasó:** 696 pruebas, 694 PASS, un FAIL/un SKIP. Detectó una
descripción de routing por encima del techo existente de 2.200 caracteres.
Se compactó a 1.916 sin subir el límite ni quitar restricciones; dos pruebas
dirigidas PASS, nueva regresión completa en curso. El corte previo c3Eu3n había
pasado 695 pruebas (694 PASS/un SKIP) antes de ese cambio. No hay instalación,
reinicio, nueva misión ordinaria ni nuevo checkpoint; R01–R16 sigue pendiente.

### Corte previo — 14:00 UTC

**xMileM sigue en curso, sin aprobación.** Primera propuesta RETURN a las
13:54:42 UTC por asignación incompatible de sigma_38 a revisión con el original
y una ambigüedad en el contrato de disponibilidad del protocolo público final.
Segunda propuesta en curso con feedback conservado. La primera causa es pertinente;
la segunda se contrastó con el código: el cuerpo nativo sí incluye el protocolo
público completo. Se corrigió su descripción prospectiva sólo en desarrollo,
con cuatro pruebas dirigidas PASS. El ensayo conserva cb2cb67c sin esa corrección.
[Auditoría abierta](PLANNED-BLIND-LIVE-xMileM.md).

Inspector cerrado disponible con tres snapshots, registros privados separados
de entrada pública, UNKNOWN/sello íntegros y ACCEPT contradictorio rechazado
desplegable. QA Chrome PASS en los cuatro perfiles (27 selecciones), fichas y
citas completas, claro/oscuro, 736/360. Es lectura histórica, no operación live.

**suite-eCgNms: 694 pruebas, 693 PASS, cero fallos/un SKIP**, 175,00 s,
finalizada 13:55:36.572 UTC. Sus 199 inputs y hashes de salida coincidían a las
13:57:12.734, antes de la corrección de descripción posterior. Nueva regresión
completa en curso. No hay instalación, modificación de misión ordinaria,
reinicio ni nuevo checkpoint. R01–R16 continúa pendiente.

### Corte previo — 13:35 UTC

**Nuevo ensayo integrado real en curso, no aprobado:**
`runs/planned-blind-live-xMileM`, misión
`mission:330b8627-ef3f-47f5-ae3f-a84c23627716`, iniciado 13:34 UTC.
Runtime congelado cb2cb67c (393 archivos, 23.799.691 bytes), sin instalar;
una misión aislada, gpt-6-astra/ultra por suscripción, techo de 24 llamadas.
Misma petición completa, original literal y comparación/tolerancia que rB9KdY;
oráculo esperado fuera de los contextos del modelo. No rehabilita el intento
anterior ni persigue una coincidencia. No duplicar ni editar harness/helper/runtime
congelados durante la ejecución. Falta resultado y auditoría material.

**suite-yN7d3d: 690 pruebas, 689 PASS, cero fallos/un SKIP**, 174,61 s;
finalizada 13:33:48.442 UTC. A las 13:34:31.874 coincidían sus 195 inputs y
el conjunto completo de archivos. No hay instalación, modificación de misión
ordinaria, reinicio ni nuevo checkpoint. R01–R16 continúa pendiente.

### Corte previo — 13:33 UTC

**a1RAAY no cualificado:** una llamada real completada; cinco PASS/ACCEPT junto
con un finding material upstream. El registro bloqueó la contradicción mediante
FAILED_GATE: candidato CANDIDATE, workflow NEEDS_RECONCILIATION, réplica UNKNOWN
íntegra; cero aperturas, comparaciones, efectos o nuevas réplicas. 36.841 tokens
observados. Base fuente intacta a las 13:28:49.624 UTC. [Lectura completa y prueba](UNKNOWN-ASSESSMENT-a1RAAY.md).
No se transforma el juicio ni se vuelve a votar para conseguir aceptación.

Replan corregido antes del primer freeze: nuevo protocolo con referencia exacta
al plan nuevo, original válido preservado. Después de congelar, cambiar de plan/ID
no autoriza otro experimento. Dos fallos reproducidos y dos pruebas posteriores
PASS. **suite-QOnp6h: 689 pruebas, 688 PASS, cero fallos/un SKIP**, 172,19 s.
Luego se hizo explícita al juez la prohibición existente de ACCEPT con findings
materiales, sin relajarla; una contraprueba PASS y nueva regresión en curso.
Desarrollo no instalado; ningún nuevo checkpoint ni cambio de misión ordinaria.

Siguiente cualificación: recorrido completo desde una petición natural bajo
runtime actualizado y congelado, sin reusar ni rehabilitar los intentos fallidos.
Se conservarán regla y tolerancia, resultado divergente y auditoría semántica;
no se declarará cualificado por iniciarse. Aún no lanzada en este corte.

### Corte previo — 13:19 UTC

La respuesta UNKNOWN completada ahora pasa por revisión material independiente,
sin autorizar apertura, comparación o cierre de misión aunque el registro fiel
sea aceptado. Diez pruebas dirigidas PASS; suite-y5xNzG: **685 pruebas, 684 PASS,
cero fallos/un SKIP**, 170,20 s. Sus 193 inputs coincidían a las 13:16:21.819 UTC.
[Contrato y fronteras](../design/UNKNOWN-ATTEMPT-REVIEW.md).

Un primer arranque del comprobador falló **antes de inferencia y copia de base**:
las filas SQLite de prototipo nulo no eran aceptadas por el hash canónico. Se
conservan fallo y harness exacto d862c49a en unknown-assessment-live-5KXCJL.
Se corrigió el lector (dos pruebas PASS) y se añadió fingerprint coherente de
heads/registros. Regresión completa posterior en curso.

**Única evaluación real en curso:** unknown-assessment-live-a1RAAY, desde
13:18:43.662 UTC, una revisión máxima en copia aislada del UNKNOWN de rB9KdY.
Runtime congelado 6d7c033d (393 archivos, 23.797.207 bytes), no instalado.
Prohibida nueva réplica por el comprobador; no se abre original ni se modifica
misión/plan/criterios de la base fuente. Esto no es reanudación de la cola ordinaria
ni convierte rB9KdY en cualificado. No duplicar ni editar harness/helper/runtime
congelados mientras esté en ejecución. Ningún nuevo checkpoint de servicio.

### Corte previo — 13:05 UTC

La contraprueba real del juez terminó: RETURN, blind-method y blind-isolation
FAIL sobre el mismo protocolo A01. Una llamada, sin nuevo intento de réplica;
43.004 tokens observados. La lectura completa confirma un rechazo pertinente,
sin atribuirle calibración general. [Auditoría separada](PROTOCOL-BOUNDARY-NEGATIVE-JHAEMl.md).
El ensayo integrado rB9KdY continúa **no aprobado**, con el fallo preservado.

**suite-JXBydG: 678 pruebas, 677 PASS, cero fallos, un SKIP live**, 161,47 s;
terminada 12:59:14.444 UTC. A las 13:05:18.054 coincidían los 192 inputs y su
conjunto completo, además de ambos hashes de salida. No hay cualificaciones ni
regresiones aún ejecutándose en este corte. Se continúa en recuperación de
planes/métodos; desarrollo no instalado, sin nuevo checkpoint ni misión ordinaria.

### Corte previo — 12:56 UTC

**Ensayo integrado terminado sin aprobación.** rB9KdY quedó NEEDS_DIRECTION /
REPLICA_INCONCLUSIVE. La réplica devolvió UNKNOWN por controles que exigían
registros no disponibles y eventos futuros. No abrió el original ni creó una
comparación. 8 llamadas, 7 completadas reales y un rechazo estructural; 179.730
tokens totales observados de las siete completadas, no coste total de la cuenta
ni de la llamada rechazada. El juez previo había aprobado un protocolo que el
replicador no podía ejecutar: [hallazgo material A01 y lectura completa](PLANNED-BLIND-LIVE-rB9KdY.md).

El harness además falló con SCHEMA al consultar un artifactId nulo. Se conservan
failure.json, base, respuestas y una copia exacta del harness usado (60c3577c).
[Informe recuperado sólo en lectura](runs/planned-blind-live-rB9KdY/reconciled-report.json)
y [resumen reconciliado](runs/planned-blind-live-rB9KdY/reconciled-summary.json):
journal 456 / 2c216328, un registro/una réplica, cero aperturas/comparaciones.
No se convierte ese fallo del comprobador en fallo matemático ni en éxito.

Desarrollo corregido, no instalado: contrato explícito de controles ejecutables
por la réplica y entrega al autor/jueces; prueba que conserva el protocolo
devuelto y corrige antes del primer envío sin cambiar requisitos. **suite-Rpg13I**:
674 pruebas, 673 PASS/cero fallos/un SKIP, 166,11 s, 189 inputs coincidentes
a las 12:51. Después se corrigió el helper del harness: cuatro pruebas dirigidas
PASS para nodos sin producto, identidad/hash/criterios y corrupción visible.
Nueva regresión completa en curso; no atribuirle aún el resultado anterior.

**Una contraprueba real acotada del juez está en curso**, no otra misión/réplica:
`runs/protocol-boundary-negative-JHAEMl`, una llamada máxima sobre el mismo
candidato y contexto histórico, cambiando sólo la instrucción explícita de
frontera de controles. No se modifica el juicio histórico ni se declara
calibración amplia. Harness `run-live-protocol-boundary-negative.mjs`; no duplicar
ni editar mientras esté en ejecución. No hay instalación ni nuevo checkpoint.

### Corte previo — 12:31 UTC

El ensayo único sigue en curso. Su primera propuesta fue rechazada con
`BLIND_PLAN`: añadió criterios no admitidos en el protocolo/intento cerrado.
El segundo intento recibe el diagnóstico exacto; no se han relajado los criterios
ni alterado el harness/runtime durante la ejecución. Los rechazos se conservan.

Observador corregido sin reinicio: lee el archivo abierto del kernel incluso
cuando su ruta fue eliminada y compara contenido e identidades con el configurado.
13 pruebas dirigidas PASS, incluida reproducción nativa de unlink/reemplazo y
rechazo de bytes diferentes. Lectura a las 12:21 UTC confirma bytes idénticos,
inodes distintos en PID989536. **No nuevo checkpoint**: permanecen 19 muestras,
cuatro fallidas. [Detalle](SERVICE-EXECUTABLE-20260912.md).
Regresión posterior **suite-tpPrFu** terminada a las 12:24:48.542 UTC:
672 pruebas, 671 PASS, cero fallos, un SKIP live, 148,30 s. Sus 188 inputs se
comprobaron coincidentes después de terminar. El corte suite-5ouAN6 describe la
versión anterior a los dos archivos del observador modificados.

### Corte de inicio del ensayo — 12:13 UTC

**Ensayo real en curso**, no duplicar ni cambiar sus inputs:
`runs/planned-blind-live-rB9KdY`, misión
`mission:36148467-adb5-46ea-b3af-6200df09d8a1`, runtime congelado ec3b8835.
Ejecuta `run-live-planned-blind.mjs` con gpt-6-astra/ultra por suscripción,
base aislada y techo prospectivo de 24 llamadas. No es la misión de producción.
La regresión previa **suite-5ouAN6** terminó 12:12:18.499 UTC: 670 pruebas,
669 PASS, cero fallos y un SKIP live, 153,32 s; 188 inputs comprobados sin cambios.
El ensayo no está aprobado por haberse iniciado; faltan resultado y lectura
semántica independiente de protocolo, argumento, controles y juicios. El snapshot
ec3b8835 está verificado pero no instalado. Servicio/observador no se reiniciaron
ni se ejecutó otro checkpoint.

### Corte anterior — 12:10 UTC

Actualización sobre el corte siguiente: **suite-9DOmxW** y **suite-jrbDmp**
terminaron con 667 pruebas, 666 PASS, cero fallos y un SKIP live; 218,98 s y
195,71 s respectivamente. La segunda incluye el timeline/contadores de réplica.
Después se reprodujo un defecto adicional: un juez simulado podía reutilizar
el hilo del autor privado del protocolo y aparentar aislamiento. Se corrigió
antes de aprobar el intento y al abrir, comprobando hilos de otros actores;
la reapertura usa versiones anteriores al juicio para no reescribir su pasado.
Tres nuevas pruebas PASS (2,84 s), con el fallo previo conservado en la ejecución
de la contraprueba. **Regresión completa posterior en curso**, sin inferencias
reales. Snapshot prospectivo `ec3b8835fb2c79fe398b0750938350c6b98f692469dcdda7d454c361694014f4`
verificado: 392 archivos, 23.794.117 bytes, en isolated-runtime-releases, no
instalado. El snapshot b7be9a76 anterior se conserva sin usar para cualificación.
El ensayo `run-live-planned-blind.mjs` sigue pendiente del resultado de la suite.

### Detalle del corte de integración — 11:59 UTC

- **Mandato completo pendiente; desarrollo no instalado.** La release de servicio
  sigue siendo 10bbffa0 y la misión ordinaria no se ha modificado ni duplicado.
- **Ruta cerrada integrada en FactoryEngine/PlanLedger:** protocolo ordinario
  revisado, intento cerrado y oráculo con sus nodos/productores/criterios reales.
  El ledger verifica dependencias privadas firmadas sin exponerlas al juez.
  La aceptación material del ledger precede a la apertura. Se conservan todos
  los criterios finales y la prohibición de usar fichas blind como workers
  ordinarios. [Decisiones y límites](../design/PLANNED-CLOSED-BLIND.md).
- **14 pruebas dirigidas PASS en dos bloques**, más dos pruebas de normalización
  incluidas en la primera regresión. Proveedor y juicios simulados; SQLite,
  reapertura, firmas, cálculo, ownership y registros reales. Cuota, cancelación,
  incertidumbre y RETURN no reemiten una réplica ni cambian criterios.
- **Regresión fallida conservada:** suite-RNUorv, 657 pruebas reportadas, 653 PASS,
  tres fallos de arranque de archivo y un SKIP live, 170,85 s. Una dependencia
  circular de inicialización del esquema impedía cargar tres grupos según el
  punto de entrada. Se separó un módulo de esquema sin dependencias. Los 12 tests
  de esos grupos y una prueba nueva de imports en frío ya pasan. El primer intento
  de esa prueba apuntaba a un módulo inexistente; se corrigió la ruta del test,
  no se declaró ese fallo como defecto del runtime.
- **Regresión completa posterior en curso.** No mezclar sus versiones con la
  primera ni presentar grupos no cargados como casos ejecutados. El reporte ya
  distingue oráculo sin inferencia y contabiliza despachos/fallos de réplica.
- **Ensayo real preparado, aún no ejecutado:** petición, política, controles y
  oráculo finito del determinante se fijarán con un runtime de sólo lectura.
  Detectará divergencia frente a un original deliberadamente distinto. Health
  oficial sin inferencia: suscripción ChatGPT disponible, Codex 0.153.4, modelo
  gpt-6-astra con ultra admitido. No se compran créditos ni se usa API de pago.
- **Checkpoint único:** 11:30:01.406 UTC ENOENT; 19 muestras, 15 saludables y cuatro
  fallidas, journal observador 39 / a26e1c73. Diagnóstico readOnly 11:45:31 UTC:
  PID989536 activo sin reinicios, bytes abiertos/configurados iguales, journal
  ordinario 410 / 2f54d5b7 y misma misión COMPLETED v7 / 986ed23c. Se preservan
  fallos/huecos. [Incidencia](SERVICE-EXECUTABLE-20260912.md).
- **Pendiente concreto:** terminar regresión, cualificar en proveedor real, leer
  semánticamente protocolo/argumentos/juicios y ampliar el cambio de método tras
  rechazo. La ruta conserva rechazos; todavía no genera automáticamente un nuevo
  protocolo prospectivo aceptado. No hay comparación semántica general, ensayo
  universal ni cierre de R01–R16. La continuación existente sigue activa.

### Corte previo — 12 septiembre, 10:52 UTC

- **R01–R16 sigue pendiente.** No se ha instalado desarrollo, enviado una misión/
  inferencia real, consumido un reset ni cambiado el servicio 10bbffa0.
- **Composición persistente implementada:** `runReviewed()` conecta réplica,
  revisión material, comparación determinista y revisión del informe, desde un
  protocolo ya aceptado. Congela jueces, hashes de fichas completas, prefijos
  base, formatos y presupuesto antes de ejecutar. Conserva los guardas ordinarios.
  [Contrato, pruebas y fronteras](../design/CLOSED-BLIND-WORKFLOW.md).
- **Recuperación sin otro voto por un checkpoint perdido:** una revisión ya
  comprometida se reconstruye por sus versiones anteriores al commit. Cuota/
  transporte explícitos permiten revisión pura acotada del mismo candidato;
  un desenlace incierto o rechazo material no generan otro voto. REPORT_ACCEPTED
  no modifica la misión ni acepta el original. Cancelar no cruza la apertura.
- **Defecto reproducido y corregido:** una ficha añadida después de una aprobación
  sintética podía aparentar ejecución válida. Ahora se exigen prefijo/scope
  congelados y configuración anterior a solicitud retenida, exposición completada
  anterior al juicio y modelo/esfuerzo exactos. Ausencia de orden no es precedencia.
  Sin overlays aprendidos aún no cualificados para ambos jueces de esta ruta;
  no se deshabilita el aprendizaje de otros trabajos.
- **20 tests nuevos PASS**, 21,72 s; **81 tests dirigidos acumulados**. Incluyen
  tres pares de codecs, dos puntos de cuota, retorno, presupuesto, cancelación,
  concurrencia y caída real de un proceso Node/SQLite: el sustituto recupera el
  propietario sin reemitir la réplica RUNNING. Modelo/juicios simulados.
- **suite-giIEN4: 650 pruebas, 649 PASS, cero fallos y un SKIP live**, 76,35 s,
  finalizada 10:38:27.542 UTC. [Resultados y hashes](runs/suite-giIEN4/summary.json).
  Los 183 inputs fijados coinciden con el código a las 10:52. No quedan suites,
  cualificaciones ni hijos de test ejecutándose. No es cualificación semántica real.
- **Único checkpoint de esta continuación:** 10:20:39.318 UTC, ENOENT; journal
  observador 37 / e63e888e, 18 muestras (15 saludables/tres fallidas). Se conservan
  huecos y SNAPSHOT_FAILED. A las 10:37:44 UTC, diagnóstico sólo en lectura:
  mismo PID 989536 active/running, NRestarts 0; bytes del ejecutable abierto y
  configurado iguales. DB ordinaria íntegra, journal 410 / 2f54d5b7, misma misión
  COMPLETED v7 / 986ed23c. [Incidencia conservada](SERVICE-EXECUTABLE-20260912.md).
- **Siguiente trabajo concreto:** asignación y referencias del plan antes del
  freeze, ownership y entrega de cada producto bajo sus criterios completos.
  PlanLedger exige nodeId/productor/dependencias exactos; el recorrido genérico
  de inputRefs filtraría el protocolo privado al juez cerrado. No copiar un
  producto a otro nodo ni relajar esos controles para anunciar integración.
  FactoryEngine/PLAN_SCHEMA todavía no habilitan la ruta. Después procede su
  cualificación real, manteniendo criterios y método previamente fijados.
  La continuación existente permanece activa, sin crear otra tarea.

### Corte previo — 12 septiembre, 09:47 UTC

- **R01–R16 permanece pendiente.** La release instalada sigue siendo 10bbffa0;
  no hay misión/inferencia real nueva, instalación, reinicio, publicación ni reset.
- **Comparación determinista acotada y revisión de su informe implementadas**
  en el adaptador de desarrollo. `compare()` sólo admite una regla ejecutable
  previamente aceptada en el protocolo: igualdad literal de cadenas completas
  o distancia decimal exacta con BigInt. No infiere tolerancias de prosa ni
  normaliza entradas para conseguir coincidencia. No añade inferencias para
  calcular. [Contrato, porqués y límites](../design/PREREGISTERED-COMPARISON.md).
- **Vínculo verificable completo hasta el informe:** intento sellado revisado,
  apertura, original histórico, actor determinista distinto, candidato firmado
  y evidencia autenticada propia para el juez. Copias, pruebas prestadas, hilos
  del original/réplica, cambios y revocaciones se rechazan. MATCH no acepta el
  original ni borra fallos, desviaciones o desconocidos. Un RETURN conserva el
  mismo intento/informe, sin repetición ni selección de resultados favorables.
- **Dos defectos de integración reproducidos y corregidos:** el guard cerrado
  bloqueaba la revisión de productos derivados ordinarios; un original aceptado
  después de abrir se consultaba como si ese estado fuera anterior. Ahora se
  distingue el propósito del producto revisado y se fija la versión histórica
  anterior a abrir, sin relajar el contexto del juez real del intento.
- **61 pruebas dirigidas PASS**; incluyen 627 combinaciones de referencia decimal
  dentro de un solo test, tres pares de codecs y revisión mediante WorkerService.
  Cálculo/SQLite reales, juicios/proveedor simulados. **suite-WDoQD8: 630 pruebas,
  629 PASS, cero fallos, un SKIP live**, 74,89 s, finalizada 09:46:07.110 UTC.
  [Resultados y hashes](runs/suite-WDoQD8/summary.json). Los 182 inputs fijados
  coinciden con el código en la comprobación de las 09:47; no quedaron suites
  ni pruebas en ejecución. Esto no cualifica el comportamiento del modelo real.
- **Sin nuevo checkpoint:** se conserva el único de esta continuación, 09:07 UTC,
  ENOENT; 17 muestras (15 saludables/dos fallidas), journal 35 / 45bb12b6 y hueco
  histórico de más de 50 horas. Servicio PID 989536, journal ordinario 410 /
  2f54d5b7 y misión v7 / 986ed23c verificados antes en lectura, sin nuevos trabajos.
  [Incidencia conservada](SERVICE-EXECUTABLE-20260912.md).
- **Siguiente frontera:** enlazar el adaptador en el planificador con dependencias
  y recuperación explícitas; cualificar el recorrido completo con proveedor real
  bajo reglas congeladas. Las dos reglas no implementan comparación semántica
  general ni sustituyen los criterios materiales de aceptación de la afirmación.
  La continuación existente se mantiene activa, sin crear otra tarea.

### Corte previo — 12 septiembre, 09:30 UTC

- **R01–R16 sigue pendiente.** Desarrollo separado de la release instalada
  10bbffa0, sin misión/inferencia real nueva, instalación, reinicio ni reset.
- **Intento sellado ya integrado con ArtifactRegistry/WorkerService:** candidato
  exacto, observación autenticada de protocolo público/solicitud/resultado y
  orden; revisión material independiente obligatoria antes de abrir el original.
  No se acepta el original al sellar, aceptar el intento ni abrirlo.
  [Implementación, razones y límites](../design/SEALED-MATERIAL-REVIEW.md).
- **Tres defectos de frontera reproducidos y corregidos:** petición global y
  antecedentes ambientales expuestos al juez; solicitud ordinaria previa
  disimulada por listas de documentos vacías; secuencia de journal ausente
  interpretada como aprobación anterior. No se borran exposiciones ni fallos.
  Tres pares de codecs conservan contenido completo. Juicios/proveedor simulados.
- **suite-YN9ifX: 608 pruebas, 607 PASS, cero fallos, un SKIP live**, 60,09 s,
  completada 09:27:00.211 UTC. [Resultados y hashes](runs/suite-YN9ifX/summary.json).
  39 pruebas dirigidas de réplica; los 181 inputs fijados coinciden con el árbol
  en la verificación de las 09:29. No cualifica al proveedor real.
- **Checkpoint único de esta continuación:** 09:07:32.659 UTC, ENOENT, 17 muestras
  (15 saludables/dos fallidas), journal observador 35 / 45bb12b6. Se conserva
  SNAPSHOT_FAILED y el hueco anterior de más de 50 horas. Servicio canónico PID
  989536 activo; DB ordinaria verificada sólo en lectura a las 09:24:33.869 UTC:
  journal 410 / 2f54d5b7, misma misión COMPLETED v7 / 986ed23c, sin trabajo nuevo.
  [Incidencia y comprobaciones](SERVICE-EXECUTABLE-20260912.md).
- **Siguiente frontera:** comparación independiente con tolerancia previamente
  fijada, evaluación del informe final e integración adaptativa del planificador.
  No confundir la integridad del registro con corrección material, coincidencia
  con verdad ni simulaciones con cualificación semántica real.

### Corte previo — 12 septiembre, 08:32 UTC

- **Mandato R01–R16 todavía pendiente.** No se ha instalado una nueva versión,
  enviado una misión/inferencia, consumido un reset ni cambiado el servicio.
- **Adaptador de réplica cerrada sellada en desarrollo**, fuera del planificador
  ordinario y NO instalado: protocolo aceptado → freeze → solicitud íntegra
  pública en hilo nuevo → conservación/sellado → apertura privada posterior.
  Conserva UNKNOWN, controles fallidos, divergencias e incertidumbre, sin repetir
  RUNNING al cambiar de coordinador. Los guardas de roles ordinarios siguen activos.
  [Contrato y límites](../design/SEALED-REPLICATION.md).
- **Corregido un fallo de aprobación retroactiva**: el juez del protocolo podía
  añadir el original después de aprobar y pasar indebidamente el control. Ahora
  se vinculan su exposición terminada y la del productor original por versiones
  anteriores al commit de la última revisión exacta. Un registro reescrito,
  aprobación antigua favorable o cambio de fecha no sustituyen esa evidencia.
  Normalización exclusivamente de evaluación ausente a `content`, sin relajar
  los cinco criterios. Los dos tests fallidos previos se reconciliaron antes de
  corregir; 25 pruebas dirigidas finales PASS (juicios/proveedor simulados,
  SQLite/segundo proceso reales). No acredita calidad semántica real.
- **Regresión suite-SK6sfG: 590 pruebas, 589 PASS, cero fallos, un SKIP live**,
  64,39 s, finalizada 08:21:40.637 UTC. [Resultados y hashes](runs/suite-SK6sfG/summary.json).
  Incluye la prueba CLI real de la combinación adaptativa/compacta/contrato propio/
  paralelismo dos, persistencia, idempotencia y conflictos sin inferencia. El corte
  anterior suite-yTpR2c (584/583 PASS) no incluía las últimas seis comprobaciones.
- **Último corte suite-kNP0Cc: 594 pruebas, 593 PASS, cero fallos, un SKIP live**,
  62,60 s. [Resultados y hashes](runs/suite-kNP0Cc/summary.json). Posterior a
  SK6sfG: tres fallos de inventario de replicadores reproducidos y corregidos,
  más una prueba de integración de réplica sellada con exposición al revisor.
  Se incluyen todos los intentos materiales del mismo nodo, con su modo real,
  y sus intents de operación, sin ocultarlos al cambiar de modo. 37 pruebas
  dirigidas PASS. [Causa, alcance y frontera pendiente](../design/REPLICA-REVIEW-HISTORY.md).
  Los 180 inputs fijados por la suite coinciden con los archivos actuales.
- **Muestra del servicio fallida**, única añadida en esta continuación:
  08:16:09.340 UTC, ENOENT, journal del observador 33 / 616bca12. Hay 16 muestras,
  15 saludables y una fallida, SNAPSHOT_FAILED. La anterior era del 10 septiembre,
  05:56:25.368 UTC: se conserva el intervalo sin observaciones; no se afirma trabajo
  continuo durante él. [Diagnóstico no mutante](SERVICE-EXECUTABLE-20260912.md).
  El proceso 989536 sigue active/running, sin reinicios; su ejecutable abierto
  apunta a una ruta sustituida/eliminada. Sus bytes y los del Node actual tienen
  igual SHA-256, pero no se convierte ese diagnóstico en un PASS retroactivo.
  Paquete 10bbffa0 íntegro y journal ordinario 410 / 2f54d5b7 sin cambios.
- **Siguiente frontera concreta:** revisión material del intento sellado,
  comparación distinta con el original y aceptación final integradas en una ruta
  del planificador. Las observaciones de producción/dependencias ya representan
  `replicator`, pero falta la vinculación de un producto al sello exacto y la
  proyección autenticada del paquete público para su juicio. La prueba conserva
  cobertura de feedback UNSUPPORTED_INPUT_SHAPE para el esquema cerrado: no se
  fabrican arrays vacíos ni se confunde una firma con corrección.

### Corte previo — 10 septiembre, 05:30 UTC

- **10bbffa0 INSTALADO y verificado**, servicio canónico PID **989536**, 154
  fichas, misma base y misión ordinaria v7/hash 986ed23c. Journal ordinario
  **410 / 2f54d5b7**, ampliación válida de 408, owner epoch 13. Paquete 385
  archivos / 23.689.915 bytes, 48 entradas runtime coincidentes con
  suite-MqaonR: **565 pruebas, 564 PASS, cero fallos, un SKIP live**, 51,55 s.
  [Activación](runtime-deployment-10bbffa0.json). Versión anterior conservada.
- **rjsI0udG COMPLETED tras b6jLY0q2**, 05:23:20 UTC: dos llamadas nuevas,
  79.007 tokens; total histórico diez llamadas reales / 243.589 tokens, cero
  efectos. Dos productores autónomos originales sin repetir; integración con
  scopes y feedback exactos; catorce criterios finales ACCEPT/PASS leídos.
  [Resultado y límites](FEEDBACK-RECOVERY-RESULTS.md). El harness conserva
  passed:false por contar dos gates sin el plan; [auditoría separada](feedback-recovery-b6jLY0q2-audit.json)
  verifica once invariantes, incluyendo las tres referencias exactas y su orden.
- Skill local validada: entrada adaptativa, fichas compactas completas, contrato
  propio y techo de dos ramas puras independientes; elecciones explícitas del
  usuario prevalecen, sin alterar políticas de misiones anteriores.
- Observador: **catorce muestras saludables**, última **05:28:00.799 UTC**.
  Cambio de proceso/release/entrada/owner registrado, nuevo segmento de cero.
  Sigue OBSERVING, no acredita 72 horas ni trabajo continuo.
- Inspector nuevo de especialistas generado **05:31:36 UTC**, 482.881 bytes,
  dos registros, seis fichas completas y 92 pruebas únicas. QA **DJpSbJGa PASS**:
  apertura de la misión recuperada, fichas/cartas/historiales completos, seis
  registros de recuperación/auditoría, móvil/escritorio, claro/oscuro y acciones
  conversacionales simuladas; capturas inspeccionadas. Inspectores anteriores
  conservados. Cuota observada de cuenta: 97 % semanal consumido; sin compras,
  resets, API ni cambio de modelo. No se ha cerrado R01–R16.

### Corte previo — 10 septiembre, 05:14 UTC

- **monpYO0G terminó WAITING_CAPABILITY**: una llamada adicional, 22.147 tokens;
  los dos scopes se entregaron y los registros se preservaron. Falta cobertura
  del feedback, que los hashes solos no acreditan. [Resultado](ACCEPTED-SCOPES-RECOVERY-RESULTS.md).
- **Desarrollo 10bbffa0 NO instalado**: retención de request público y vinculación
  de capturas antiguas sólo por hash existente, sin confundir ausencia con [] ni
  retención posterior con almacenamiento previo. Suite-KAm0mb **563/562 PASS,
  cero fallos, un SKIP**, 47,61 s. [Diseño](../design/PRODUCER-FEEDBACK-EVIDENCE.md).
  [Recuperación prospectiva](FEEDBACK-RECOVERY-PROTOCOL.md) preparada en b6jLY0q2.
- Servicio/skill siguen f452c286. Muestras y journal ordinarios sin cambios.

### Corte previo — 10 septiembre, 05:01 UTC

- **rjsI0udG terminó WAITING_CAPABILITY a las 04:54:26 UTC**: plan y dos
  productos aceptados; dos fichas autónomas ejecutadas realmente, siete llamadas
  reales, cero efectos. El integrador no recibió los historiales que exigía su
  contrato. [Auditoría](STANDALONE-RESULTS.md). Originales conservados; no entrega.
- **Corrección posterior NO instalada:** historiales de entradas materiales
  ya aceptadas y admitidas disponibles al productor consumidor. Dos pruebas
  nuevas, suite-m5fSdX **557/556 PASS, cero fallos, un SKIP**, 43,33 s.
  [Diseño y límites](../design/ACCEPTED-INPUT-SCOPES.md). Recuperación real pendiente.
- Servicio y skill siguen **f452c286**, journal ordinario 408 intacto.
  Trece muestras saludables; última **04:57:01.404 UTC**, segmento actual
  2.305.520 ms, OBSERVING. No acredita tres días ni trabajo continuo.

### Corte previo — 10 septiembre, 04:44 UTC

- **rjsI0udG RUNNING**, nueva misión
  `75bb5c2e-6743-4b64-a347-824b99232721`, iniciada **04:41:38.148 UTC**, unidad
  `sovereign-qualification-standalone-rjsi0udg.service`, PID 969810, paquete
  congelado **45dfce77**. Mismo harness/petición/catorce controles; además se
  inspeccionará si la ficha autónoma se ejecuta realmente. No alterar ni duplicar.
- **Cli4mRSN terminó NEEDS_DIRECTION a las 04:37:01 UTC**: seis llamadas reales
  completadas, una salida rechazada, 199.647 tokens observados; tres RETURN y
  ningún producto material. [Auditoría de los cuatro intentos](REVIEW-BOUNDARY-RESULTS.md).
  El orden de evidencia pasó los juicios del plan, pero no llegó a ejecutarse.
- Servicio y skill siguen **f452c286**. El nuevo paquete está bajo cualificación,
  no instalado ni certificado como fábrica terminada.

### Corte previo — 10 septiembre, 04:39 UTC

- **Desarrollo 45dfce77 congelado, NO instalado:** especialistas con ficha
  propia sin rol de catálogo incompatible, propósito literal en el directorio,
  fichas íntegras de asignaciones rechazadas en recuperación e informe con
  vinculación de ficha. [Diseño y límites](../design/STANDALONE-SPECIALISTS.md).
  Suite-jBh9yv: **555 pruebas, 554 PASS, cero fallos, un SKIP live**, 45,63 s.
  Paquete de 384 archivos / 23.683.525 bytes; sus 47 entradas runtime coinciden.
  [Protocolo del siguiente ensayo](STANDALONE-LIVE-PROTOCOL.md), reservado pero
  todavía no iniciado mientras Cli4mRSN termina su recuperación acotada.
- **Cli4mRSN RUNNING / revisión del cuarto intento**, mismo paquete 87472cfc.
  Tras dos RETURN, el tercer intento propuso especialistas sin roles adicionales:
  el runtime anterior rechazó `roleIds:[]` con SCHEMA. Eso motivó la corrección
  posterior, sin retocar el ensayo. El cuarto plan usa veritas_02 más especialistas
  y espera juicio. Todavía no hay producción material.
- Servicio/skill siguen f452c286. Doce muestras saludables; última
  04:18:35.881 UTC, PROBE_CHANGED conservado y journal ordinario 408 intacto.

### Corte previo — 10 septiembre, 04:19 UTC

- **Cli4mRSN RUNNING / tercer intento de plan**, misión
  `32b4c1ad-6080-4b9f-93f5-79b005fab8f7`, unidad
  `sovereign-qualification-review-boundary-cli4mrsn.service`, paquete inmutable
  **87472cfc**, 382 archivos / 23.669.623 bytes, 45 entradas runtime coincidentes
  con suite-EEmTXo (540/539 PASS, cero fallos, un SKIP).
  [Protocolo congelado](REVIEW-BOUNDARY-LIVE-PROTOCOL.md). No modificar ni duplicar.
  Primer plan RETURN: veritas_07 exige integridad de mediciones, no se presume
  productor general de pruebas combinatorias. Segundo plan RETURN: añadió
  especialistas pertinentes, pero omega_23 exige entradas ya aceptadas y no
  sirve para presentar el resultado todavía no aceptado del mismo nodo.
  Ambos juicios aprobaron el orden temporal de evidencias; no aprobaron el plan.
  Todavía no hay productos materiales ni cualificación completa.
- **Defecto de verificación persistente reproducido y corregido después de ese
  paquete**: journal íntegro no detectaba heads atrasados/ausentes, filas huérfanas
  o genealogía falsa. Nueve tests nuevos pasan; suite-oRTl57 **549 pruebas,
  548 PASS, cero fallos, un SKIP**, 45,93 s. Las cuatro bases reales inspeccionadas
  sólo en lectura pasan el control reforzado. [Diagnóstico, prueba y límites](STORAGE-HISTORY-INTEGRITY.md).
  Paquete posterior **4ad9f852**, 382 archivos / 23.671.822 bytes, 45 entradas
  runtime coincidentes con suite-oRTl57. Cambio NO instalado y NO contenido en
  el ensayo Cli4mRSN.
- Grafo local AST de 30 archivos, 318 nodos / 1.500 aristas: apoyo de navegación,
  no certificado de completitud (56 extremos ausentes y tres pares dirigidos
  potencialmente colapsables). Directorio `sovereign-core-graph-uoxllfwk`; caché
  generada trasladada fuera del runtime. El snapshot f1869d92 que la incluyó
  quedó rechazado por el control de coincidencia con la suite y nunca se instaló.
- Servicio/skill continúan f452c286; doce muestras saludables, última
  **04:18:35.881 UTC**. El verificador reforzado cambió el hash del probe:
  `PROBE_CHANGED` abre un segmento nuevo; no se enlaza silenciosamente el
  tiempo de observación anterior. Journal ordinario 408 intacto.
- Inspector adaptativo: captura 04:11:11 UTC, trece registros, 666.612 bytes,
  QA **SUI2QN6V PASS** con hash de fuente y capturas inspeccionadas. Conserva
  el bloqueo bilateral y distingue entrada requerida de aceptación real.

### Corte previo — 10 septiembre, 03:56 UTC

- **MztBjXHC WAITING_CAPABILITY**, cerrado a las 03:45:20 UTC, ocho llamadas
  reales / 149.204 tokens. Dos candidatos matemáticos correctos, pero los gates
  de ambas ramas exigían el historial bilateral no expuesto; no hubo integración.
  [Lectura y diagnóstico](ROLE-CONTRACT-RESULTS.md). Fallo conservado, sin reintento
  del mismo ensayo ni reparación de criterios históricos.
- **KS0q5j41: dos casos PASS**, dos revisiones reales sobre planes explícitamente
  simulados, 28.033 tokens. El juez aceptó veritas_07 para medición y devolvió
  sigma_09 por incompatibilidad de método. [Lectura completa y límites](PLAN-ROLE-REVIEW-RESULTS.md).
  Runtime ef3a4645 congelado, NO instalado.
- **Desarrollo posterior:** contrato de disponibilidad de evidencia y mapa de
  ascendencia por nodo para el planificador y el juez. Conserva la obligación
  bilateral completa al converger y controles propios en cada rama; no expone
  productos de hermanos a productores ni retoca MztBjXHC. Tres pruebas dirigidas
  PASS; regresión completa en curso. [Diseño y límites](../design/REVIEW-EVIDENCE-BOUNDARY.md).
- Servicio ordinario/skill siguen **f452c286**, PID 919774, journal 408 intacto.
  **Once muestras saludables**, última 03:55:41.151 UTC, segmento actual
  3.487.760 ms. Sigue OBSERVING; no acredita 72 horas ni trabajo sostenido.

### Corte previo — 10 septiembre, 03:41 UTC

- **MztBjXHC RUNNING**, misión `mission:928fdaef-5cd5-47fc-bb5d-ff855409d5c3`,
  unidad `sovereign-qualification-role-contract-mztbjxhc.service`, paquete
  inmutable 4506ceeb. Ya produjo su plan; no alterar ni duplicar el ensayo.
- **Desarrollo posterior:** el juez del plan recibe ahora las fichas completas
  de todos los roles asignados, deduplicadas y ligadas al ID/hash del candidato.
  [Causa, diseño y límites](../design/PLAN-ROLE-REVIEW.md). Regresión suite-3XeGUs:
  **537 pruebas, 536 PASS, cero fallos y un SKIP live**. Este cambio NO está en
  MztBjXHC ni instalado; su cualificación semántica está pendiente.
- Inspector adaptativo: doce registros, 528.421 bytes; QA Mk9vPrLP PASS, ambos
  temas y anchos 736/360 inspeccionados. Contiene contratos recibidos y hallazgo
  de rol separado del ACCEPT histórico. Servicio/skill siguen f452c286.

### Corte previo — 10 septiembre, 03:33 UTC

- **4506ceeb congelado, NO instalado**: incluye rechazo de roles incompatibles
  y aclaración de premisas tipadas. 380 archivos / 23.661.240 bytes; 43 archivos
  de código/datos runtime coinciden con suite-0FEuPz: **534 pruebas, 533 PASS,
  cero fallos y un SKIP live**. [Protocolo del ensayo nuevo](ROLE-CONTRACT-LIVE-PROTOCOL.md).
- **h53t6RZV COMPLETED a las 03:27:23 UTC**, 14 comprobaciones mecánicas PASS,
  12 inferencias / 243.421 tokens y cuatro correcciones. Productos correctos,
  pero asignación de veritas_04 no conforme: no hubo réplica ciega sellada.
  [Resultado y auditoría semántica](NODE-PLAN-VIEW-RESULTS.md).
- Inspector adaptativo regenerado con doce ejecuciones, contratos exactos
  recibidos por los productores y hallazgo posterior separado del ACCEPT
  histórico. Verificación de interfaz pendiente; no es monitor ni entrega final.
- Servicio ordinario y skill siguen f452c286. No hay instalación nueva todavía.

### Corte previo — 10 septiembre, 03:24 UTC

- **Hallazgo real de incompatibilidad de rol en h53t6RZV**: el plan asignó
  `veritas_04` a jueces que reciben el candidato desde el inicio. Reconstrucción
  matemática correcta no es réplica ciega sellada. No se retoca el ensayo ni
  sus veredictos. [Diagnóstico y corrección](../design/ROLE-EXECUTION-COMPATIBILITY.md).
- Control determinista en desarrollo para impedir asignaciones de las facetas
  `blind_replication` al trabajador ordinario: antes de aprobar/instalar el plan,
  crear trabajador y despachar uno persistido. Pruebas nuevas aún pendientes.
  El adaptador de réplica ciega real **no está implementado**. No es permiso
  para eliminar la capacidad ni sustituir una exigencia explícita del usuario.
- Servicio instalado sigue f452c286. **Diez muestras saludables**, última
  03:23:04.559 UTC (ID inspection-20260910-0327 no es su hora efectiva), journal
  ordinario 408 intacto. No acredita 72 horas ni finalización del mandato.

### Corte previo — 10 septiembre, 03:09 UTC

- **node-contract-v1: regresión completa PASS**, suite-ImGn5s: 527 pruebas,
  526 PASS, cero fallos y un SKIP live. Runtime congelado **f4867dc0**,
  379 archivos / 23.654.547 bytes, código coincidente con ese corte; NO instalado.
- **h53t6RZV RUNNING desde 03:08:47 UTC**, unidad
  `sovereign-qualification-node-plan-view-h53t6rzv.service`, directorio
  `/home/cardeex/codex-workspace/sovereign-node-plan-view-live-h53t6RZV`.
  Petición matemática previa conservada literalmente, pero misión nueva con
  Astra/ultra, catálogo de revisión, fichas compactas y contratos de nodo.
  Captura solicitudes exactas antes del envío, productos y gates; no es ensayo
  causal de ahorro ni prueba general de ceguera semántica. No modificar harness,
  origen de la petición o paquete, ni duplicar la misión.
- El servicio ordinario sigue **f452c286**, sin cambios desde su instalación.
  La skill no selecciona aún la vista de nodos. Los resultados de formato y
  facetas anteriores están completos y no requieren nuevas inferencias.

### Corte previo — 10 septiembre, 03:03 UTC

- **Instalado f452c286**, 378 archivos / 23.646.082 bytes; 154 fichas, código
  coincidente con suite-dzGw0g: 520 pruebas, 519 PASS, cero fallos, un SKIP live.
  PID 919774, gestor permanente verificado. Sólo cambió el servicio propio con
  cola sin pendientes; versiones anteriores conservadas.
  [Prueba de despliegue](runtime-deployment-f452c286.json).
- **ViVoid2v COMPLETED a las 02:54:40 UTC: 8/8 PASS**, razones/citas/probes leídos.
  Pretty: 36.559 tokens entrada / 40.496 total; compact: 32.886 / 37.020.
  Misma ficha íntegra, datos/candidato/schema/modelo/esfuerzo por par; ocho hilos
  nuevos. Reducción observada 10,05 % entrada / 8,58 % total, no ahorro general.
  [Resultado y límites](../design/CARD-ENCODING.md). Harness/casos/salidas intactos.
- Skill actualizada manualmente y validada: adaptive-v1 más la opción adicional
  compact-json-v1 para nuevas peticiones, respetando elecciones explícitas. Ni
  adaptive-v1 ni las políticas/prefijos de misiones previas fueron redefinidos.
- **node-contract-v1 en desarrollo, NO instalado**. Vista íntegra del contrato
  propio sin otras instrucciones del plan; identidad original y hash de vista
  separados, registro anterior a inferencia, no borrado/cambio en reentrada,
  requisitos finales completos y aprendizaje acotado al nuevo formato.
  Siete tests dirigidos PASS; no es garantía de ceguera semántica, workspace
  independiente o eficacia real todavía. [Contrato](../design/PRODUCER-PLAN-VIEW.md).
- Observador: **nueve muestras saludables**, última 02:57:33 UTC. Nuevo proceso
  y paquete registrados sin unir segmentos, journal ordinario 408 conserva su
  ancestro y la misión original. No acredita 72 horas ni trabajo sostenido.

### Corte previo — 10 septiembre, 02:45 UTC

- **Facetas ef9Tgb7e terminó 02:37:29 UTC: 16/16 PASS**. Ω22 y Ω22 más faceta
  aciertan ocho juicios cada uno, incluidos criterios, probes y citas; razones
  completas leídas contra el corpus. Coste 56.736 frente a 80.783 tokens: no se
  observa mejora de acierto y sí mayor coste. Son casos sintéticos cerrados,
  no equivalencia general ni permiso para borrar capacidades.
  [Resultado semántico y límites](FACET-ABLATION-RESULTS.md).
- **Fichas compact-json-v1 en desarrollo, no instalado**: sólo elimina
  indentación JSON, conserva 154 fichas completas, prólogo, límites lógicos,
  política persistente y scope separado de aprendizaje. Regresión suite-dzGw0g:
  **520 pruebas, 519 PASS, cero fallos, un SKIP live**. Paquete f452c286,
  378 archivos / 23.646.082 bytes, coincide con ese corte verificado.
- **ViVoid2v RUNNING**, comparación de ocho llamadas nuevas, mismos roles,
  candidatos, datos y modelo por par, sólo distinto formato JSON de fichas.
  Directorio `/home/cardeex/codex-workspace/sovereign-card-encoding-live-ViVoid2v`;
  unidad `sovereign-qualification-card-encoding-vivoid2v.service`, runtime
  f452c286 congelado. No duplicar ni modificar su harness/casos/paquete.
  No implica instalación automática ni ahorro demostrado antes del resultado.
- Servicio ordinario permanece **1d2c4b6e**, PID 895551, journal 406, sin reinicio.
  **Ocho muestras saludables**, última 02:44:56 UTC; segmento actual 1.725.490 ms.
  No son 72 horas ni trabajo prolongado de una misión.

### Corte previo — 10 septiembre, 02:18 UTC

- **BoYUO09A COMPLETED a las 02:13:19 UTC**, 18 controles PASS, seis inferencias
  reales / 124.663 tokens, cero correcciones. Las dos adquisiciones preceden al
  candidato; el juez independiente cita las fuentes y sus trazas HTTP completas.
  Plan y producto leídos junto con todos los motivos de revisión. El resultado
  original del oráculo v1 conserva FAIL por su techo no solicitado de 400
  caracteres; v2 fue congelado antes de la misión y sólo retira ese techo.
  [Resultado y límites](../design/EVIDENCE-CATALOG.md). IcWvS5Z8 no se reetiqueta.
- **Instalado 1d2c4b6e**, 378 archivos / 23.643.252 bytes, 154 fichas.
  Regresión suite-VDSdya: **511 pruebas, 510 PASS, cero fallos y un SKIP live**;
  coincidencia exacta con el código empaquetado. Sólo se reinició el servicio
  propio con cola sin trabajo pendiente. PID 895551, gestor canónico verificado.
  [Prueba de despliegue](runtime-deployment-1d2c4b6e.json). Versiones previas
  conservadas; sin push, publicación, API de pago ni instrucciones aprendidas.
- La skill de Sovereign selecciona **adaptive-v1 para nuevas peticiones**,
  manteniendo opciones explícitas. El CLI sin preset conserva sus valores
  anteriores; las misiones existentes no cambian. Actualización local manual de
  integración, no promoción de aprendizaje ni prueba de comportamiento universal.
- Observador: **siete muestras saludables**, última 02:16:10 UTC. El cambio de
  proceso/paquete/propietario se registra sin unir segmentos: previo 5.132.930 ms,
  nuevo 0 ms. Journal ordinario 404→406 conserva ancestro y misión anterior.
  No acredita 72 horas ni actividad sostenida de desarrollo.
- Inspector adaptativo actualizado a **02:19:21 UTC**: once registros, 368.495
  bytes, nueve fichas completas, 86 evidencias únicas y recorridos HTTP
  inspeccionables. Captura anterior archivada; QA `6gyvjoPT` PASS e inspección
  visual 736 claro / 360 oscuro realizada. No es un monitor live.
  R02/R04/R08/R09/R11/R14/R16 mantienen los límites explícitos de la matriz.

### Corte previo — 10 septiembre, 02:03 UTC

- **IcWvS5Z8 terminó 01:56:36 UTC: no aceptado globalmente.** Respuesta cerrada
  COMPLETED, dos llamadas / 20.454 tokens, vínculos de catálogo comprobados. Caso
  documental WAITING_CAPABILITY, siete llamadas / 147.172 tokens: fuentes reales
  adquiridas, catálogo correcto, juez RETURN por recorrido HTTP intermedio no
  acreditado. Segundo productor bloqueó sin reobtener ni inventar trazas. La
  evaluación no se cambia a PASS por haber funcionado el transporte del catálogo.
- **Corrección HTTP en desarrollo**: checkpoint durable antes de cada petición,
  respuesta/status/hash y traza completa en recibos satisfactorios. No se añade
  evidencia retroactiva a la misión anterior. [Contrato](../design/HTTP-ACQUISITION-TRACE.md).
  Regresión `suite-wlXB5H`: **509 pruebas, 508 PASS, cero fallos, un SKIP live**.
- **Preset `adaptive-v1`** para nuevas misiones: agrupa cuatro opciones ya
  implementadas, conserva definición/hash y opciones explícitas. No amplía
  permisos, modelo, concurrencia ni intentos; no cambia misiones existentes.
  El corte previo `suite-lzogEF` conserva un fallo del recibo del proveedor
  simulado, que omitía el perfil de instrucciones; corregido sin relajar el
  control de contexto. `suite-uaqMEW`: 505 pruebas, 504 PASS, cero fallos, un SKIP.
- Nuevo ensayo **RUNNING** desde **02:02:50 UTC**:
  `/home/cardeex/codex-workspace/sovereign-catalog-trace-live-BoYUO09A`, unidad
  `sovereign-qualification-catalog-trace-boyuo09a.service`, runtime **1d2c4b6e**,
  378 archivos / 23.643.252 bytes verificados, no instalado. Misma petición
  documental, nueva misión y adquisiciones; preset resuelto antes de inferencia.
  El oráculo v2 conserva también el resultado v1 y retira únicamente su límite
  no solicitado de 400 caracteres: el pasaje IANA anterior era literal, 415
  caracteres. La brevedad y el soporte semántico siguen a cargo del juez. No
  modificar casos, harness ni paquete durante el ensayo.
- Inspector adaptativo adicional: diez registros a **01:41:30 UTC**, 225.644
  bytes, siete fichas completas y 43 evidencias. Incluye decisión sin plan ni
  juez ficticio y los rechazos del controlador. QA `MqSdg7da` PASS, inspección
  visual 736 claro / 360 oscuro realizada. La captura es anterior al bloqueo
  documental y no se presenta como monitor live; el inspector histórico anterior
  permanece intacto. No cierra R16.
- Servicio ordinario sigue **c16b2168**, sin reinicio; quinta muestra saludable
  **01:42:14 UTC**, mismo PID 853569 y journal 404. Segmento observado 3.143.920 ms,
  no días. Cuenta: **80% semanal utilizado, 20% restante**, sin resets/créditos.

### Corte previo — 10 septiembre, 01:35 UTC

- **Entrada cerrada UndLIqUb terminó 01:24:57 UTC: ocho de ocho controles PASS**.
  Dos productos emparejados correctos y cuatro decisiones de derivación, no
  ejecución de los negativos. 17 inferencias / 209.418 tokens. Media: plan completo
  78.920 frente a entrada 19.760; transformación: 57.964 frente a 19.973.
  El primer brazo planificado incluye un rechazo por hash mal copiado, conservado.
  [Resultado y límites](../design/CLOSED-ENTRY.md). No acredita ahorro general.
- Desarrollo posterior **evidence-catalog-v1**, todavía no instalado ni probado
  con inferencia real: el juez elige referencias del contexto observado y el
  controlador expande identidades exactas; citas, criterios y veredictos no se
  reparan ni relajan. Responde al error de transcripción real anterior. Regresión
  `suite-jj3iI8`: **496 pruebas, 495 PASS, cero fallos, un SKIP live**.
- Servicio ordinario permanece c16b2168, sin reinicio. Observador: cuarta muestra
  saludable a **01:15:47 UTC**, mismo proceso, paquete y cola. Segmento actual
  1.557.140 ms; no acredita 72 horas ni actividad de misión sostenida.
- Siguiente cualificación acotada: formato de revisión con fuentes realmente
  adquiridas y distinción entre identidad de fuente e independencia probatoria.
  No confundir esa prueba ni la entrada cerrada con el cierre de R01–R16.

### Corte previo — 10 septiembre, 01:14 UTC

- **Entrada adaptativa cerrada implementada, no instalada ni predeterminada**:
  `entryMode: closed-response-v1` / CLI `--entry-mode`. Una respuesta elegible
  pasa por productor y juez independiente; fuentes, archivos, ejecución o etapas
  materiales llevan al plan completo. Se conservan criterios fijados antes de
  producción y no se admiten respuestas rechazadas como entradas del planificador.
  [Contrato y límites](../design/CLOSED-ENTRY.md).
- Regresión `suite-tmMO9m`: **488 pruebas, 487 PASS, cero fallos, un SKIP live**.
  Nueve nuevas pruebas de integración de la entrada y siete controles externos
  de los oráculos. Runtime congelado `5974b1e4`, **377 archivos / 23.632.516 bytes**,
  verificado; servicio ordinario sigue c16b2168, PID 853569, active/running.
- Ensayo real **RUNNING** desde **01:12:44 UTC**:
  `/home/cardeex/codex-workspace/sovereign-closed-entry-live-UndLIqUb`, unidad
  `sovereign-qualification-closed-entry-undliqub.service`, PID 861989.
  Dos tareas cerradas emparejadas con plan completo y cuatro decisiones de
  derivación, Astra/ultra idéntico. Los negativos son sólo prueba de entrada,
  no entrega de sus archivos/fuentes/productos. **No duplicar ni cambiar los
  módulos de casos/harness mientras esté activo. No hay ahorro probado aún.**
- `Q7iZzelI` terminó **01:00:34 UTC**, cuatro planes reales aceptados por sus
  jueces, cero efectos/fuentes/productos ejecutados. Topología elegida 1/1/1/3;
  ocho llamadas y 145.553 tokens. El FAIL original permanece. Reevaluación
  mecánica posterior sólo de whitespace: 3/4; la coma omitida en citas del cuarto
  sigue fallando. [Lectura semántica completa de planes](ROUTING-SEMANTIC-REVIEW.md)
  distingue ese fallo del contenido y conserva el riesgo de pistas incidentales
  al compartir el plan completo entre ramas.
- Cuenta observada: 76% de ventana semanal utilizado, 24% restante; no créditos
  ni resets disponibles. No es consumo atribuible exclusivamente a esta tarea.

### Corte previo — 10 septiembre, 00:50 UTC

- **Instalado c16b2168**, 376 archivos / 23.619.520 bytes. Corrige la identidad
  de propietario en motor, cola y conductor de aprendizaje: boot ID + PID + start
  ticks; conserva exclusión de procesos vivos/lentos y registros antiguos sin
  identidad. Contraprueba previa en 4793e99c: los tres quedan BUSY; misma prueba
  en c16b2168: los tres recuperan epoch 2. Es inyección de registros anteriores,
  **no reboot ni reutilización real de PID forzada**. Incluye prueba nativa de
  proceso hijo y salida observada. [Contrato](../../factory/lib/PROCESS-IDENTITY.md),
  [antes](pid-reuse-before-4793e99c.json), [después](pid-reuse-after-c16b2168.json).
- Regresión `suite-3Ryxcy`: **472 pruebas, 471 PASS, cero fallos, un SKIP live**.
  La suite y el paquete instalado coinciden; 154 fichas conservadas.
  [Despliegue verificado](runtime-deployment-c16b2168.json). Reinicio únicamente
  del servicio propio con cola sin trabajo pendiente; PID 853569, gestor canónico
  comprobado. No se interrumpe el ensayo de routing, fijado en su paquete anterior.
- Observador: tres muestras reales saludables. Cambio de proceso/paquete/entrada/
  propietario detectado y conservado en la tercera, **00:49:50 UTC**, sin unir
  segmentos. Segmento anterior 1.094.460 ms; nuevo segmento 0 ms. Journal de
  producción 402→404 conserva su ancestro y la misma misión 78af… COMPLETED.
  Ni la ventana de 72 horas ni el mandato completo están acreditados.
- Routing natural `Q7iZzelI`, **RUNNING** desde 00:37:48 UTC, unidad
  `sovereign-qualification-routing-q7izzeli.service`, PID 845653, runtime 4793e99c.
  Cuatro casos de planificación/revisión solamente; no ejecutar sus productos ni
  duplicar el ensayo. Primeros dos planes aceptados, cada uno de un solo producto,
  con facetas de cálculo frente a síntesis/verificación factual. Coste de plan +
  juez: 28.141 y 34.556 tokens. **No es eficiencia suficiente demostrada**.
  El oráculo externo del segundo conserva FAIL por cobertura literal: dos citas
  preservan ambas prohibiciones, pero queda fuera el espacio entre ellas. Debe
  revisarse como defecto mecánico del evaluador, preservando resultado original
  y sin cambiar criterios/harness mientras el ensayo está activo. Auditoría
  semántica de los cuatro planes todavía incompleta.

### Corte previo — 10 septiembre, 00:35 UTC

- Regresión `suite-wWzy8x`: **460 pruebas, 459 PASS, cero fallos y un SKIP live**.
  Incluye once pruebas del observador prolongado y cinco del prototipo estructural
  offline. No ha cambiado el código del paquete instalado 4793e99c.
- Primera muestra real del observador, **00:30:59 UTC**: proceso 836174 y paquete
  íntegros, journal de producción de 402 eventos y cola sin trabajo pendiente.
  Estado **OBSERVING**, duración del segmento 0 ms; no es una prueba de 72 horas.
  Su historial preserva fallos, cambios y huecos. Se añadió el checkpoint a la
  continuación nativa ya existente, sin otra tarea/scheduler ni restart del servicio.
  [Contrato, límites y reproducción](SERVICE-SOAK.md).
- Medición de estructuras repetidas: cuatro de 18 proyecciones reducen entre 4,06 %
  y 12,36 % sus bytes; las siete proyecciones matemáticas no mejoran. **Sólo offline,
  no instalado ni ahorro de tokens demostrado.** No se recortan fichas, criterios
  ni revisiones. [Decisión de no adoptarlo todavía](../design/CONTEXT-STRUCTURE-PREFLIGHT.md).

### Corte previo — 10 septiembre, 00:00 UTC

- Cartera `b0zgffSZ`: **COMPLETED, 21 controles PASS y 226/226 casos externos**.
  Revisión `review:efd35d3c-4714-447e-aeb6-401b0fbf3ed2` acepta los 33 criterios
  del mismo candidato `df8cd261…`, sin regenerar productos, repetir escrituras,
  alterar archivos o cambiar el oráculo. La secuencia histórica demuestra que
  las dos aceptaciones precedieron al primer productor. Su juez relee los tres
  archivos, ejecuta el comando exacto y revisa el contenido; el oráculo externo
  posterior no se hace pasar por conocimiento previo de ese juez. Fuentes y
  fallos de ambas recuperaciones previas conservados. Es recuperación entre
  versiones congeladas, no una ejecución desde cero íntegramente bajo 4793e99c.
- Coste agregado de esa genealogía: 20 inferencias, 1.084.948 tokens; la última
  recuperación añade una revisión y 124.408 tokens. No es una acreditación de
  eficiencia. En el ensayo matemático pequeño, revisión de productos representa
  112.498 de 227.261 tokens; en cartera, producción suma 694.333. Las siguientes
  optimizaciones deben medirse por fase y mantener las obligaciones completas.
- Conductor de aprendizaje `Zno5pAgw`: recorrido real **propuesta → ocho
  evaluaciones emparejadas → REJECTED / NO_MEASURED_IMPROVEMENT**, once controles
  de integridad PASS. Base y candidato aciertan los cuatro casos congelados de
  extracción literal; nueve inferencias / 72.386 tokens incluyendo diagnóstico.
  No hay promoción ni beneficio demostrado. Citas, entradas, respuestas, intentos
  y reentrada sin repetición están conservados. El contexto opt-in v2 seleccionó
  correctamente su representación v1 menor en los cuatro casos; no se afirma una
  prueba de envoltorios v2 ni de calidad semántica general por este ensayo.
- Regresión `suite-CUmp0J`: **444 pruebas, 443 PASS, cero fallos y un smoke live
  SKIP**. Añade tres pruebas del nuevo oráculo literal al corte previo de 441.
- **Instalado 4793e99c**, 374 archivos / 23.614.444 bytes. Cola inactiva reconciliada
  antes del cambio; wrapper y unidad apuntan al mismo paquete, todos sus archivos
  ejecutables coinciden con la suite y permanecen verificados. PID nuevo 836174,
  gestor permanente comprobado, 154 roles. Versiones previas conservadas; sin
  publicación, push, compra de créditos ni activación de instrucciones aprendidas.
  [Prueba del despliegue](runtime-deployment-4793e99c.json).
- Ambos ensayos anteriores han terminado, unidades inactive/dead con salida 0;
  no duplicarlos. El servicio habitual permanece activo; su cola no contiene estas
  bases privadas de cualificación. El mandato global no está certificado.
- Inspector actualizado a 00:01:55 UTC: nueve registros, nueve fichas completas
  seleccionadas y 421 pruebas únicas, 956.345 bytes. Muestra el resultado aceptado
  y ambos bloqueos anteriores; QA Chrome `OaXszgBB` PASS e inspección visual de
  capturas 736 claro / 360 oscuro realizada. Captura anterior archivada; sigue
  siendo historial verificable, no monitor live. [Lectura del aprendizaje](LEARNING-LITERAL.md).

### Corte previo — 9 septiembre, 23:47 UTC

- Concurrencia pura `Ikayye8G`: **COMPLETED, 15 controles PASS**. Los dos
  productores se solaparon realmente, se revisaron por separado y sólo después
  se consumieron sus productos aceptados en la integración. Diez inferencias,
  227.261 tokens; se conservan dos reparaciones internas de revisión. No es una
  comparación causal de ahorro ni demuestra eficiencia de esta tarea pequeña.
- Cartera `7NHFBdRo`: **WAITING_CAPABILITY, no aceptada**, pese a **226/226 casos
  externos PASS** y los tres archivos intactos. La revisión de integración
  `ab9364b3…` dejó un único UNKNOWN: faltaba evidencia histórica autenticada de
  aceptación de los prerrequisitos antes del primer intento de implementación.
  Los 960.540 tokens / 19 inferencias del informe incluyen el historial copiado
  anterior; no son sólo consumo de esta recuperación. El fallo se conserva.
- Corrección `artifact-dependency-gates`: entrega al juez decisiones, checks,
  identidades y secuencias históricas exactas de los padres consumidos; no cuerpos
  privados ni autorizaciones retroactivas. Replay sólo lectura: primer productor
  en 587; aceptaciones de modelo, contraejemplos y plan en 362, 571 y 155.
  [Contrato y controles](../design/DEPENDENCY-GATES.md).
- Nueva recuperación **RUNNING** desde 23:46 UTC en copia privada
  `/home/cardeex/codex-workspace/sovereign-portfolio-gates-live-b0zgffSZ`, unidad
  `sovereign-qualification-portfolio-gates-b0zgffsz.service`, PID inicial 825213.
  Mismo candidato `artifact:df8cd261-344e-495f-88df-66ccc36e50df`, mismo hash,
  política, tres archivos y oráculo. No se autoriza nueva producción ni repetición
  de escrituras. No hay resultado de esta revisión todavía.
- Runtime congelado `4793e99c28498d1c4d29452042d8022a1b7163f15820d1cbced7d83d4f809fbd`:
  374 archivos / 23.614.444 bytes, verificado, **no instalado**. Regresión
  `suite-A4KXyR`: **441 pruebas, 440 PASS, cero fallos, un smoke live SKIP**.
  `suite-jAakDc` conserva el fallo anterior de captura con fixture sin productor;
  se corrigió la precondición del capturador, no se eliminó la aserción.
- Aprendizaje: comprobación literal histórica de citas y propagación de cancelación
  a evaluaciones, con conservación de intentos/consumo completado sin calificarlos
  si se cancela. 36 pruebas dirigidas PASS. El rechazo real `b8c1322f…` contiene
  dos citas no literales entre trece; aún no hay nueva propuesta/evaluación real
  ni mejora positiva demostrada o activada por esta corrección.
- Inspector: nueve misiones, diez fichas completas, 304 pruebas únicas; instantánea
  **23:17:06 UTC**, por tanto anterior a los dos resultados indicados arriba.
  862.838 bytes, QA Chrome ancho/estrecho claro/oscuro PASS (`83geLp3r`). La
  visualización no es estado live; conserva los fallos y su fecha de corte.
- Servicio habitual comprobado a las 23:45 UTC: active/running, PID 741636,
  NRestarts=0, managerScopeVerified=true; cola sólo 78af… COMPLETED. Sigue
  `9b5fba01`, sin restart, promoción de instrucciones, push o publicación.

### Corte previo — 23:01 UTC

- Recuperación `7NHFBdRo`: **el mismo candidato de contraejemplos ya fue aceptado**
  por `review:dccfd62d-5995-42c3-b3ae-b2bbbc50125a`, citando la observación
  autenticada `artifact-production-scope`. ID/hash inmutables; no nueva producción
  de prerrequisitos. El motor reanudó el nodo (intento 3 de ledger) y empezó
  `implementation`, `run:c194d31d-0ddc-4a67-bb71-676fb9711d05`.
  Estado **RUNNING**; sólo un listado de workspace observado hasta este corte.
  No hay entrega ni resultado del oráculo de 226 casos todavía.
- Ensayo de concurrencia `Ikayye8G`: plan candidato bajo revisión, runtime
  `c9549da4` inalterado. Todavía no hay solapamiento real demostrado.
- Comparación antigua Sol/high `pMX76y4F` detenida mediante SIGTERM exclusivamente
  a su proceso principal: terminó **CANCELLED / no aprobada**, 12 envíos, diez
  inferencias completadas, dos fallos registrados y 229.996 tokens observados
  en completadas. Plan y modelo de decisión aceptados; el juez de contraejemplos
  volvió a detectar la misma ausencia de evidencia de admisión de contexto del
  controlador `d333742d`. Repetir sus casos no aporta ese registro. Se conserva
  todo el historial y ambos hashes de harness/runtime siguen válidos. No deriva
  de este par una clasificación de calidad/eficiencia Astra frente a Sol.
- Contabilidad nueva de correcciones en desarrollo: separa peticiones de nuevo
  intento de nodo, reparaciones internas del producto y de evidencia del revisor;
  cuenta juicios ACCEPT/RETURN/UNKNOWN por separado. No equipara una petición de
  corrección a su ejecución ni una inferencia completada a calidad sin errores.
  Replay sólo lectura de `GVMb9wMM`: una reparación interna, dos ACCEPT y un
  UNKNOWN. No se alteran los informes congelados. Regresión `suite-HHg1hM`:
  **431 pruebas, 430 PASS, cero fallos y un smoke live SKIP**. Este cambio posterior
  no está en los runtimes `c9549da4` que están ejecutando ni en el servicio instalado.
- Cola habitual comprobada: únicamente la misión 78af… COMPLETED; servicio
  canonical active/running, PID 741636, NRestarts=0, managerScopeVerified=true.
  Sigue `9b5fba01`. Consumo de cuenta observado: 65% de la ventana semanal usado;
  no créditos ni resets consumidos. Esto no es cuota atribuible sólo a esta tarea.

### Corte previo — 22:51 UTC

- Corte nuevo `c9549da4c8e3a923aed27f65a48d56b67adbec1abd56975d918ff1d13e1dd3c5`,
  373 archivos / 23.601.131 bytes, verificado y **no instalado**. Regresión
  `suite-vij6xr`: **430 pruebas, 429 PASS, cero fallos, un smoke live SKIP**.
  Servicio habitual sin cambios en `9b5fba01`; no restart, push ni publicación.
- El ensayo Astra `GVMb9wMM` terminó a las 22:29:24 UTC en
  **WAITING_CAPABILITY / no aprobado**, ocho inferencias y 241.394 tokens. Modelo
  de decisión aceptado; contraejemplos UNKNOWN por falta de evidencia autenticada
  de admisión de contexto (`blind_generation`), no por expectativas matemáticas
  incorrectas. Historial y runtime `d333742d` originales conservados.
- Nueva observación `artifact-production-scope`: historial de contextos admitidos
  para el candidato exacto y productores anteriores del nodo, cortado antes de
  su creación. No cuerpos de productos ni conversaciones. Pruebas adversarias
  incluyen contaminación anterior, exclusión temporal y ámbito del observador.
  [Causa y contrato](../design/PRODUCTION-SCOPE.md).
- Recuperación **en curso** sobre copia SQLite privada:
  `/home/cardeex/codex-workspace/sovereign-portfolio-recovery-live-7NHFBdRo`, unidad
  `sovereign-qualification-portfolio-recovery-7nhfbdro.service`, PID inicial 792412.
  Conserva `mission:0c55c67c-27f2-4792-ae81-54bc8b0159a0`, misma política y
  candidato `artifact:c3159755-a0f6-4935-b11b-a545ec5b1df6`. Sólo el workspace
  vacío y sin efectos previos se reubica explícitamente en la copia. Revisión real
  con nueva evidencia; no se acepta de antemano ni se repiten los prerrequisitos.
  Si se acepta, continuará con el mismo oráculo externo de 226 casos. Runtime
  nuevo `c9549da4`; no es un ensayo íntegro desde cero de esa versión.
- [Lectura semántica íntegra de ambos prerrequisitos](PORTFOLIO-SEMANTIC-REVIEW.md):
  cuatro alternativas diferenciadas y prueba por invariantes; seis contraejemplos
  cuyo mecanismo sí cambia el resultado. Sus seis expectativas coinciden con el
  oráculo exhaustivo al comprobar sus datos en lectura. Esto no sustituye la
  revisión pendiente de aislamiento ni demuestra código aún no entregado.
- Concurrencia **opt-in** `maxParallelPureNodes`/`--parallel-pure-nodes 1..4`:
  sólo nodos ya listos, sin herramientas ni efectos en toda su ascendencia.
  Cuota cancela y drena compañeros; aceptación independiente y trabajo conservado
  al reanudar. Misiones anteriores/predeterminado siguen seriales. Cualificación
  real nueva de esa frontera y propuesta de plan sin copias **en curso**:
  `/home/cardeex/codex-workspace/sovereign-pure-parallel-live-Ikayye8G`,
  `mission:8c22fff4-79a3-4384-9ac8-83bc2fa22602`, unidad
  `sovereign-qualification-pure-parallel-ikayye8g.service`, PID inicial 792423.
  Sol/high, runtime `c9549da4`, dos problemas matemáticos cerrados y su integración;
  no es sustituto del ensayo de cartera ni prueba de ahorro causal de latencia.
  [Frontera](../design/PURE-NODE-CONCURRENCY.md).
- Comparación Sol/high `pMX76y4F` sigue **RUNNING**, plan de tres productos aceptado
  tras conservar el primer `MANDATE_QUOTE`; primer producto bajo revisión. Runtime
  fijado `d333742d` no modificado. No duplicar estas tres ejecuciones al reanudar.

### Corte previo — 22:20 UTC

- Astra/ultra: `mission:0c55c67c-27f2-4792-ae81-54bc8b0159a0`, ensayo
  `sovereign-portfolio-live-GVMb9wMM`, tiene plan de tres productos aceptado y
  producción `decision_model` en curso. No hay todavía resultado integral ni
  veredicto del oráculo externo. Runtime y criterios siguen fijados en `d333742d`.
- Comparación separada Sol/high, mismo pedido, oráculo de 226 casos, runtime y
  condiciones de aceptación: `mission:1371bfbf-5dc4-48c3-a26b-8e53d222259c`,
  `sovereign-portfolio-sol-live-pMX76y4F`, unidad
  `sovereign-qualification-portfolio-sol-pmx76y4f.service`. Primer plan rechazado
  por `MANDATE_QUOTE`; segundo intento en curso. No se cambia la misión Astra
  ni el modelo predeterminado del servicio. Un par no calibra todas las tareas.
- Diagnóstico de revisión nuevo: se conserva el criterio y los identificadores
  autenticados del actor esperado/observado y recibo en el rechazo `TOOL_ACTOR`.
  Proyección acotada, sin cuerpos de archivos ni razonamiento privado. El conductor
  observa también UNKNOWN sin convertir incertidumbre en fallo demostrado.
- Las instrucciones aprendidas quedan vinculadas al modelo y nivel de razonamiento
  del dataset inmutable evaluado. Otros modelos usan su prefijo base; cambiar el
  destino de un worker con overlay congelado falla **antes** de llamar al proveedor.
  Corte `suite-PwSbet`: **415 pruebas, 414 PASS, cero fallos, un SKIP**.
  Estos cambios aún no están instalados ni afectan a las misiones congeladas.
- Optimización de propuesta de plan: los requisitos se escriben una vez y el
  controlador incorpora sus criterios completos al final antes de revisión.
  Planes almacenados e intermedios siguen siendo estrictos. 59 pruebas dirigidas
  PASS. Replay sólo lectura del plan Astra: 46.241 → 35.175 bytes hipotéticos
  de propuesta, reconstrucción exacta del plan y sus 33 criterios; **no** es ahorro
  de tokens observado. [Contrato y límites](../design/FINAL-COVERAGE.md).

### Corte previo — 21:51 UTC

- El ensayo multiproducto `4eCcdU4U` quedó **CANCELLED / no aprobado**, con
  193.099 tokens totales observados y el historial intacto. Se solicitó SIGTERM
  sólo a su proceso para evitar repetir un diagnóstico que necesitaba cambios
  del controlador. La primera revisión devolvió UNKNOWN por falta de evidencia
  independiente de ausencia de efectos **de la etapa**, no por un fallo de la
  matemática. No se cambió el runtime ni el harness de aquel ensayo.
- Corrección nueva: inventarios autenticados por nodo y por sus intentos,
  disponibles incluso sin operaciones previas y también para prerrequisitos
  expuestos. Una escritura de otro nodo no invalida la ausencia de efectos de
  una etapa anterior; una operación de esa misma etapa sí. Controles globales
  de la misión, independencia y snapshots permanecen. [Diagnóstico](../design/NODE-EFFECT-SCOPE.md).
  Corte `suite-Adtw29`: **413 pruebas, 412 PASS, cero fallos, un SKIP**.
- Repetición integral real **en curso** en
  `/home/cardeex/codex-workspace/sovereign-portfolio-live-GVMb9wMM`, unidad
  `sovereign-qualification-portfolio-gvmb9wmm.service`, runtime fijado
  `d333742d749a7dad8cdde873640b4aaf0cc7f6f77be22fdc69a40162f669c95d`.
  Conserva el mismo pedido, harness y oráculo de 226 casos. No duplicar ni editar
  sus inputs mientras ejecuta. El servicio habitual sigue `9b5fba01`.
- Dos cualificaciones reales del conductor: `4RY7Nqbi` (runtime `ba67132f`,
  23.509 tokens) y `vAqnjI3Q` (`c33459b9`, 26.410 tokens), ambas **SKIPPED**, nueve
  controles de integridad/reentrada PASS y sin comparación ni promoción. Primera:
  faltaban metadatos de actor. La segunda recibe 13 recibos autenticados del
  registro de exposición v17 previo al rechazo (secuencia 816, candidato 344);
  sigue considerando insuficiente el dato histórico para justificar otro overlay.
  Se mantienen ambas decisiones, sin convertir SKIPPED en mejora de modelo.
  La proyección nueva excluye cuerpos de archivos y observaciones posteriores.
  Bases históricas originales intactas; las pruebas usan copias SQLite privadas.

### Corte previo — 21:37 UTC

- Despliegue `9b5fba01` verificado por `runtime-deployment-9b5fba01.json`:
  PID 741636, 154 fichas, wrapper/unidad/runtime coincidentes. Sigue siendo el
  servicio habitual; los cambios nuevos de aprendizaje aún no están instalados.
- Misión multiproducto real **en curso**, `mission:15a3694f-3fa5-4718-a061-01991f033220`,
  `/home/cardeex/codex-workspace/sovereign-portfolio-live-4eCcdU4U`, unidad
  `sovereign-qualification-portfolio-4eccdu4u.service`. Runtime `9b5fba01`,
  harness/oráculo fijados: 226 casos externos, tres productos materiales,
  modelo de decisión y contraejemplos independientes antes de implementar.
  Plan aceptado con 27 obligaciones finales; no se afirma aún éxito del resultado.
  Es un problema matemático sintético, no una calibración económica de agentes.
- Nuevo `LearningConductor`: captura sin inferencia de fallos con ámbito
  registrado, una propuesta acotada, comparación mediante el evaluador existente,
  conservación de rechazo/interrupción y promoción aparte. Añadidos CLI de
  consulta/captura/propuesta e integración de captura al finalizar una misión.
  La cola no asigna de forma implícita presupuesto a experimentos ni crea oráculos.
- Pruebas dirigidas de aprendizaje: 49 PASS; integración de captura/CLI: 2 PASS.
  Corte completo `suite-ebMXW2`: **408 pruebas, 407 PASS, cero fallos y un SKIP**.
  Se conserva `suite-HkUv3q` anterior. Durante desarrollo se detectó un fallo real
  en la reentrada del checkpoint: la serialización canónica reordenaba el esquema
  anidado y cambiaba el hash de petición. Se corrigió guardando su JSON exacto;
  no se eliminó la comprobación de identidad. El caso de recuperación la ejercita.
  Estos tests son simulados para el juicio de aprendizaje, no prueba de mejora.
- Preparada cualificación real del ciclo a partir del rechazo TOOL_ACTOR
  `review-rejection:5da581b2-ce88-45a8-8233-7d3ad2b11374` del desarrollo P0aQr62D.
  Usará una copia SQLite privada, hasta una propuesta y ocho comparaciones
  de cuatro casos sintéticos congelados, sin promoción y sin modificar la base
  histórica original. Aún no se registra resultado ni mejora de modelo.

### Corte previo — 21:05 UTC

- Misión real v2 `sovereign-multisource-json-live-rDWGcCGs` COMPLETED a las
  21:01:36 UTC: **15 controles PASS**, cinco inferencias reales, cero fallos,
  209.127 tokens totales (184.773 input, 24.354 output; 67.968 input cacheados).
  Ambas adquisiciones conservan los mismos hashes documentales que el ensayo
  anterior, con revisión independiente, oráculo correcto y reentrada sin efectos.
  V1 había registrado 327.794 tokens con otro plan/condiciones; no se presenta
  la diferencia como comparación causal aislada o eficiencia óptima.
- Corte `9b5fba01` activado tras comprobar cola sin trabajo pendiente y preservar
  versiones anteriores. Wrapper y unidad apuntan al mismo runtime; doctor confirma
  suscripción ChatGPT y ejecutor aislado disponibles. La regresión corresponde a
  `suite-Dwsi2c` (389 PASS, cero fallos, un SKIP); la comprobación de despliegue
  queda en `runtime-deployment-9b5fba01.json`. No se activan formatos experimentales
  por defecto ni se promueve aprendizaje. No se reinició la VPS ni se abrió puerto
  público. Los ensayos real v2 y de codec de revisión ya han finalizado.
- Inspector verificado conservado; su servidor de QA sólo loopback terminó
  (salida 143) después de las comprobaciones de Chrome. El fragmento durable no
  depende de ese servidor. El mandato general continúa; próximos pendientes
  materiales: estrategia y ejecución real con varios productos, selección
  calibrada de capacidades y aprendizaje con mejora observada.

### Corte previo — 21:02 UTC

- Inspector de seis ejecuciones reales generado sin alterar sus bases, con
  journal comprobado, fichas completas de las siete facetas utilizadas y 259
  objetos de evidencia distintos referenciados por sus juicios. Incluye el fallo
  `WUrROCPs` y ambas variantes de coste, no sólo éxitos. Es snapshot histórico,
  no monitor en vivo ni prueba de terminación de toda la fábrica.
  Archivo: `/home/cardeex/.codex/visualizations/2026/09/08/01a082e8-066c-7153-a0cd-11e718db4fb0/sovereign-evidence-inspector.html`.
  Chrome real: `/home/cardeex/codex-workspace/sovereign-inspector-qa-mBUyk4uA/summary.json`,
  seis selecciones, temas claro/oscuro, 736/360 px, fichas/pruebas desplegadas y
  ausencia de overflow; llamada de seguimiento simulada, no mensaje real.
- Misión documental v2 `mission:506235e5-98c9-4aeb-a248-78871154c425`, directorio
  `sovereign-multisource-json-live-rDWGcCGs`: plan de 14 criterios aceptado,
  producción finalizada y **revisión en curso**. No se considera completada hasta
  leer el resultado y su oráculo. El revisor usa 244.698 bytes de entrada real;
  todavía no se atribuye ahorro integral al formato.
- Servicio instalado continúa `a5335da3`. El candidato `9b5fba01` sigue aislado
  del servicio habitual. Continuación nativa activa; no duplicar ensayos existentes.

### Corte previo — 20:41 UTC

- Regresión completa [390 pruebas, 389 PASS, cero fallos, un SKIP](runs/suite-Dwsi2c/summary.json).
  Runtime fijado `9b5fba01`, 369 archivos. No instalado; servicio `a5335da3` sigue
  active/running en el gestor permanente, PID 693576 y cero reinicios observados.
- `sovereign-json-context-live-AKYAUr1B` completo: **cuatro decisiones reales
  correctas**, dos casos v1/v2 en orden alternado. Conserva contradicción en el
  mismo grupo, distinción entre condiciones e ignorancia de órdenes incrustadas.
  Input 17.940 → 15.735 tokens; total 18.211 → 15.978. No generalizar a todas
  las tareas. [Contrato y mediciones](../design/CONTEXT-JSON-ENCODING.md).
- Replay actualizado con hash del codec de ese runtime:
  [exposiciones históricas reconstruidas sólo en lectura](json-context-historical-9b5fba01.json).
  No se alteró el replay anterior ni las bases que contienen los resultados.
- Nueva misión completa real v2 **en curso**, sin codec de salida de revisión:
  `/home/cardeex/codex-workspace/sovereign-multisource-json-live-rDWGcCGs`, unidad
  `sovereign-qualification-multisource-json-rdwgccgs.service`, runtime `9b5fba01`.
  Mismo pedido y oráculo originales de SQLite; vuelve a adquirir ambas páginas.
  No es un par causal contra el plan de la ejecución previa. No duplicar este
  ensayo al reanudar ni cambiar su runtime/harness/oráculo mientras ejecuta.

### Corte previo — 20:37 UTC

- Codec de salida real terminado a las 20:18:48 UTC: ambas variantes de
  `sovereign-review-encoding-live-p3fuowSY` pasan diez controles. Dos inferencias
  por variante, 27.221 → 27.063 tokens totales; sólo la fase de revisión cambia
  de 16.294 a 15.952. Ahorro pequeño y un solo par, no mejora general demostrada.
  [Contrato y evidencia](../design/REVIEW-ENCODING.md). Permanece opt-in.
- Instrucción del planificador corregida: orden parcial con razones materiales,
  lotes de operaciones independientes con argumentos conocidos, sin barreras
  artificiales por archivo. No cambia criterios ni planes guardados. Test de
  integración conserva dependencias realmente aceptadas y la autoridad de misión.
  Su primer fixture falló por consultar un ID de misión inexistente en el sobre;
  se corrigió el fixture, no se retiró la comprobación de dependencia.
  Falta medición real del cambio de instrucción.
- Nuevo transporte experimental `lossless-json-v2` conserva también las cadenas
  JSON reconstruibles exactamente, compartiendo texto dentro de recibos y fuentes.
  Sigue opt-in; no resume contenido, borra contradicciones ni elude el límite
  lógico. [Replay en SQLite sólo lectura](json-context-historical.json): exposición
  del revisor multifuente 811.536 bytes lógicos, 435.935 con v1, 240.219 con v2;
  round-trip exacto. No son tokens ni incluye el sobre de tarea de cada inferencia.
  El hash de ese replay es anterior al endurecimiento posterior de JSON profundo.
- Pasan 87 comprobaciones dirigidas de codecs, workers, aprendizaje y CLI;
  diez de los últimos casos de transporte hostil/JSON profundo también pasan.
  En el primer fixture se esperaba igualdad de tamaño para JSON único: se corrigió
  porque quitar su doble escape ya podía ahorrar bytes, manteniendo la obligación
  de no inflar y de reconstruir exactamente. No es un fallo ocultado del runtime.
  Nueva regresión completa y cuatro decisiones reales apareadas preparadas;
  **todavía no se ha ejecutado el ensayo de modelo v2**. Instalado sigue `a5335da3`.

### Corte previo — 20:16 UTC

- Corte completo [376 tests, 375 PASS, cero fallos, un SKIP](runs/suite-puAfTz/summary.json).
  Incluye cobertura final exacta, relaciones de fuentes, consumo por fase y codec
  opcional de pruebas de revisión. No equivale a completar el mandato ni a instalarlo.
- Comparación completa `sovereign-final-coverage-live-jtd854PN`: ambos recorridos
  pasan diez controles, pero el candidato es una **regresión de coste observada**:
  138.023 → 233.447 tokens totales, siete → once inferencias completadas.
  Baja de 16 a diez criterios finales, pero las propuestas pasan de agrupar tres
  escrituras y sus lecturas a alternarlas por archivo. El plan candidato pide
  leer tras cada escritura. No hay obligación del usuario de serializar archivos
  disjuntos. Un par no establece causalidad general; sí invalida afirmar ahorro.
  No se promueve esa versión como mejora de eficiencia.
- Ensayo multifuente `sovereign-multisource-live-fXM8DG2h` completado a las
  19:57:52 UTC: **12 controles PASS**, cinco inferencias reales, 327.794 tokens.
  Dos HTTP 200 de SQLite adquiridos antes del candidato, contraste condicional
  correcto, citas exactas y revisión independiente con ambas fuentes. No acredita
  raíces independientes, conflicto empírico entre editores ni coste satisfactorio.
- Codec de salida `evidence-refs-v1`, **opt-in**, conserva cada criterio y juicio;
  deduplica únicamente objetos de evidencia idénticos. La expansión vuelve al
  contrato original antes de validar o aceptar. Rechaza referencias colgantes,
  duplicadas, no utilizadas y expansiones excesivas. Predeterminado sin cambios.
  Replay histórico exacto: 15.742 → 11.828 y 10.084 → 9.289 bytes canónicos;
  no son tokens ni inferencias nuevas. Ensayo real de componente iniciado a las
  20:16 UTC, **en curso**: `sovereign-review-encoding-live-p3fuowSY`, runtime
  `4bf4117d`, unidad `sovereign-qualification-review-encoding-p3fuowsy.service`.
  Usa archivos preparados por el harness, finalización y revisión reales; no es
  un benchmark de planificación autónoma ni una misión completa de desarrollo.
- Servicio instalado sigue en `a5335da3`. Continuación nativa de esta tarea
  `continuar-sovereign-factory` activa; reconciliar este ensayo antes de lanzar
  otro. R01–R16 siguen abiertos donde la matriz señala evidencia pendiente.

### Corte previo — 19:45 UTC

- El baseline del ensayo apareado `jtd854PN` terminó a las 19:43 UTC:
  [diez comprobaciones aprobadas](</home/cardeex/codex-workspace/sovereign-final-coverage-live-jtd854PN/baseline/summary.json>),
  siete inferencias reales completadas, 138.023 tokens observados, 16 criterios
  finales para ocho criterios de requisitos. Candidato `3f9ed722`, misión
  `mission:b83ad0ab-ccfa-47f7-adce-856f5997ffc0`, **en curso**. No hay todavía
  comparación aprobada ni ahorro acreditado.
- Nuevo corte [365 tests, 364 PASS, cero fallos, un SKIP](runs/suite-Qbe8hT/summary.json):
  relaciones mecánicas entre fuentes expuestas. Agrupa hashes idénticos y origen
  HTTP compartido sin inventar derivación, veracidad, contradicción ni independencia.
  No añade contexto a peticiones con cero/una fuente; conserva bytes y limita la
  agrupación a las fuentes visibles de cada actor, también del revisor.
- Ensayo real multifuente iniciado a las 19:42:38 UTC, **en curso**:
  `/home/cardeex/codex-workspace/sovereign-multisource-live-fXM8DG2h`, misión
  `mission:2256c8a7-eebf-4793-adfa-169676320ce7`, runtime `93ee4d61` fijado,
  unidad permanente `sovereign-qualification-multisource-fxm8dg2h.service`.
  Contrasta condiciones de dos páginas de SQLite con adquisición real, revisión
  independiente y oráculo de campos/citas previamente fijado. URLs suministradas,
  no descubrimiento; mismo editor, no dos raíces independientes demostradas.
  Comparte VPS/suscripción con la comparación: no interpretar tiempos como
  un benchmark causal de latencia.
- Añadido desglose de consumo por fase al informe. Tres tests dirigidos pasan;
  este último cambio requiere su corte completo antes de instalar. Un contador
  ausente se representa como desconocido, no como cero.
- Servicio instalado continúa en `a5335da3`; las nuevas copias son candidatos
  de ensayo. Continuación nativa `continuar-sovereign-factory` activa. No se ha
  cerrado el mandato R01–R16.

### Corte previo — 19:32 UTC

- Desarrollo posterior: [357 tests, 356 PASS, cero fallos, un SKIP](runs/suite-XJaCtx/summary.json).
  Cobertura final normalizada antes de la revisión independiente: sólo texto y
  evaluador idénticos con identidad de requisito inequívoca comparten comprobación.
  Se mantienen requisitos, condiciones distintas, efectos y nodos previos; los
  planes guardados no se renormalizan. Cada cambio registra hashes y alias en
  `planning.coverage.normalized`. También rechaza colisiones de identificadores
  cualificados. [Contrato y evaluación](../design/FINAL-COVERAGE.md).
- [Análisis histórico sin inferencia](final-coverage-historical.json): dos planes
  reales siguen con 18 criterios cada uno. Sus repeticiones no son textualmente
  idénticas: no se vende la normalización exacta como ahorro observado en ellos.
  Se añadió al planificador la instrucción de reutilizar los criterios completos
  del requisito y añadir sólo obligaciones distintas.
- Comparación real apareada iniciada a las 19:32 UTC, **en curso y no aprobada**:
  `/home/cardeex/codex-workspace/sovereign-final-coverage-live-jtd854PN`.
  Misma petición literal de tres archivos, sin QUOTA inyectada, modelo/razonamiento,
  perfil y codec; baseline `a5335da3` frente a candidato `3f9ed722`. Ambos runtimes
  fijados, sin modificaciones durante el ensayo. Unidad permanente
  `sovereign-qualification-final-coverage-jtd854pn.service`.
  El servicio de producción sigue instalado en `a5335da3`; **no se ha actualizado**.
- Continuación de esta tarea creada con el mecanismo nativo de Codex:
  `continuar-sovereign-factory`, ACTIVE, cada 30 minutos, ligada a la tarea
  `01a082e8-066c-7153-a0cd-11e718db4fb0`. Reconcilia ensayos antes de continuar,
  conserva pruebas y sólo comunica cambios accionables. No es un segundo worker
  de la cola ni prueba de ejecución ininterrumpida o futura finalización.
- **El mandato general sigue pendiente**. Esta mejora y este ensayo no sustituyen
  calibración amplia, estrategia compleja, fuentes contradictorias, aprendizaje
  con mejora real ni entrega integrada.

### Corte previo — 19:12 UTC

- **Recuperación real completada a las 19:10:43 UTC**: [resumen original](</home/cardeex/codex-workspace/sovereign-production-recovery-live-8iIZV7fG/summary.json>),
  [dos procesos con salida 0](</home/cardeex/codex-workspace/sovereign-production-recovery-live-8iIZV7fG/process-pair.json>)
  e [informe íntegro](</home/cardeex/codex-workspace/sovereign-production-recovery-live-8iIZV7fG/report.json>).
  Misión `mission:f080a868-28f9-46df-9301-165741987ab3`, candidato
  `artifact:b1902927-c57f-4f47-86c8-bb2090aba3c1`: COMPLETED/ACCEPTED,
  diez comprobaciones aprobadas. Conserva las tres escrituras originales,
  recibe su historial autenticado, obtiene lecturas propias del revisor y un
  listado independiente, y repite la entrada sin nuevas inferencias ni efectos.
  Los PID de las fases son 688360 y 693514. La QUOTA sigue siendo inyectada;
  ocho inferencias reales completadas suman 163.230 tokens observados. No es
  eficiencia óptima ni una prueba de fallo real del proveedor o de tres días.
- Runtime de ese ensayo: `66578a76`, sin cambios durante ambas fases. El instalado
  `a5335da3` añade el guard de servicio posterior, probado por separado. No se
  confunden sus hashes ni se altera el anterior resultado fallido `WUrROCPs`.
- **Mandato general todavía pendiente**: calibración calidad/coste y selección,
  estrategia compleja, contraste de fuentes contradictorias, valor marginal de
  especializaciones, mejora real de aprendizaje y operación prolongada. El estado
  de la misión de cualificación no completa automáticamente R01–R16.

### Corte previo — 19:06 UTC

- Corte instalado [a5335da3](runtime-deployment-a5335da3.json):
  [347 tests, 346 PASS, cero fallos, un SKIP](runs/suite-Q8luaC/summary.json),
  PID 693576, cola sin trabajo activo al actualizar, 154 fichas y runtime verificado.
  Incluye el historial corregido y `ExecCondition` ligado al cgroup real.
- [Ensayo real de ambos gestores](service-managers-guard.json): el permanente
  permanece active/running; intentar arrancar la misma unidad en XRDP devuelve
  `Result=exec-condition`, status 1, sin MainPID ni segundo consumidor de la cola.
  Variables del bus permanente en el servicio no eluden la comprobación del cgroup.
  Esto no es un ensayo de logout, reboot o tres días.
- Cualificación `8iIZV7fG`: primera fase WAITING_QUOTA inyectada aprobada a las
  19:04:03 UTC. La segunda arrancó automáticamente en otro proceso, leyó los
  archivos y está en revisión independiente. Se ejecuta en la copia fijada
  `66578a76`; el guard posterior no modifica ese ensayo. Aún no se declara éxito.

### Corte previo — 19:01 UTC

- Servicio instalado [f74fbd58](runtime-deployment-f74fbd58.json), 154 fichas,
  wrapper/proceso ligados al corte [343 tests, 342 PASS, cero fallos, un SKIP](runs/suite-TPAM19/summary.json).
  **Se corrigió el gestor equivocado**: [antes](service-managers-before.json) estaba
  en el gestor anidado de XRDP; [después](service-managers-after.json), PID 683570
  en el bus `/run/user/1001/bus` y cgroup directo del gestor permanente, sin segunda
  instancia activa. Los registros anteriores de active/Linger no verificaban ese
  alcance. No se ensayó logout ni reinicio. Guard adicional de arranque en desarrollo.
- Se añadió `service-status`, sin inferencia, para comprobar ese alcance; skill
  local actualizada y validada. El informe ahora separa llamadas sin resultado final
  registrado de fallos conocidos; no interpreta consumo ausente como cero.
- Recuperación real `WUrROCPs`: tres archivos correctos conservados sin reescritura,
  pero **ensayo no aprobado**, detenido tras rechazos por historial omitido al
  revisor. [Diagnóstico y referencias exactas](production-recovery-WUrROCPs-diagnosis.md).
  Conserva resultado CANCELLED/passed=false y 218.434 tokens completados observados,
  no un supuesto éxito. La interrupción QUOTA inicial fue inyectada, no cuota real.
- La corrección posterior entrega inventario autenticado de efectos y un historial
  de workspace con actores, paths, hashes y fallos, también fuera de la cola. No
  transfiere identidad del productor ni sustituye lecturas/listados independientes.
  El histórico cambia de versión e invalida su prueba al aparecer otra operación;
  no duplica cuerpos de archivos ni vuelve a adjuntar un snapshot idéntico.
  [346 tests, 345 PASS, cero fallos, un SKIP](runs/suite-fiBkQ6/summary.json).
  [Primer corte fallido](runs/suite-HqFLF7/summary.json) conservado: añadió contexto
  innecesario a una consulta sin efectos y rompió equivalencia evaluada; se corrigió
  la selección, no se retiró la comprobación exacta.
- Nueva cualificación con mismo pedido literal y dos procesos automáticos:
  `/home/cardeex/codex-workspace/sovereign-production-recovery-live-8iIZV7fG`,
  `mission:f080a868-28f9-46df-9301-165741987ab3`, runtime fijado `66578a76`,
  lanzada a las 18:58:43 UTC en el gestor permanente. **En curso, no aprobada aún**.
  La versión instalada f74fbd58 no incluye la corrección posterior del historial.

### Corte previo — 18:20 UTC

Actualización de desarrollo posterior, **no incluida en la versión instalada**:
[340 tests, 339 PASS, cero fallos, un SKIP](runs/suite-6Js32G/summary.json).
Se añadió herencia controlada de observaciones tras interrupción del productor,
antes de crear candidato. El nuevo actor recibe recibos históricos como
EXTERNAL_OBSERVATION, sin adoptar identidad, autoridad, conversación ni pruebas
de estado actual del anterior. Tests con archivos/SQLite reales y proveedor
simulado recuperan sin repetir escritura; rechazan scope distinto, adulteración e
incertidumbre, no reactivan fuentes retiradas y cubren recibo confirmado antes de
su admisión en contexto. Los intentos PREPARED quedan registrados como no
despachados. Ensayo de modelo real con interrupción QUOTA **inyectada** y dos
procesos en curso: `/home/cardeex/codex-workspace/sovereign-production-recovery-live-WUrROCPs`.
No se afirma haber observado una cuota real de la cuenta ni haber terminado ese ensayo.

- Nuevo corte completo: [335 tests, 334 PASS, cero fallos y un SKIP](runs/suite-WCIlJS/summary.json). Corrige los errores de revocación/caducidad al entregar fuentes, valida todo el lote antes de relaciones entre operaciones y añade diagnóstico preciso de la frontera de citas. Ninguna comprobación de aceptación se ha eliminado.
- Comprobación HTTPS real posterior en `sovereign-revocation-live-j47TLs0z/summary.json`: todos los controles pasan; una petición HTTP 200, revocación antes de publicar, recibo FAILED sin contenido y repetición sin nueva petición. El fallo real previo queda en `sovereign-revocation-live-VZ1EgdJF/summary.json`. Ambas rutas bajo `/home/cardeex/codex-workspace`.
- Investigación real finalizada a las 18:16 UTC: `sovereign-discovery-live-HpaShoFu/summary.json`, COMPLETED, ocho controles aprobados y runtime sin cambios durante el ensayo. Se recuperó el mismo candidato después de la interrupción; una cita inválida fue reparada sin regenerarlo ni repetir búsqueda/descarga. Siete llamadas de trabajadores y una de descubrimiento completadas; 308.493 tokens observados, una inferencia interrumpida sin consumo final conocido. No es un coste eficiente demostrado.
- `contextEncoding` ahora puede fijarse en la política de misión y `--context-encoding` en CLI. Persistencia, idempotencia, rechazo de valores desconocidos y scope de productores/revisores probados sin inferencia. Se conserva el predeterminado ordinario y no se modifican misiones antiguas.
- Despliegue verificado del corte: [22e6028b](runtime-deployment-22e6028b.json), servicio enabled/active, PID 671630, wrapper y proceso en la misma versión, 154 fichas y cola sin misión en ejecución al activar. Conserva versiones previas; no se modificó OpenClaw ni se abrió puerto. Los cambios posteriores requieren otro corte para quedar instalados.

### Corte previo — 18:09 UTC

- Corte posterior a la integración de descubrimiento: [324 tests, 323 PASS, cero fallos y un SKIP](runs/suite-GRIHUG/summary.json). El primer corte de esa integración conservó un fallo de fixture por un campo nuevo; se corrigió la expectativa exacta, sin eliminar la comprobación de igualdad de entrada.
- Después de ese corte se confirmó un defecto de revocación en `source.fetch`: una respuesta que termina después de caducar/revocarse el permiso todavía podía producir un recibo SUCCEEDED. Tres tests de regresión reproducen descarga pendiente, revocación en la entrega al broker y caducidad/ancestría de permisos. Corrección y nuevo corte pendientes: el pase anterior no acredita esos tests nuevos.
- Ensayo web real `mission:f6bd68b9-5929-4114-adf6-e9713be2e9fc`: búsqueda nativa observada, adquisición HTTP 200 de documentación oficial de SQLite y candidato conservados. El proceso anterior terminó durante la revisión; reanudado a las 18:04 UTC desde el mismo candidato, sin repetir búsqueda/adquisición. No se registra COMPLETED hasta tener aceptación y resumen comprobados. Estado: `/home/cardeex/codex-workspace/sovereign-discovery-live-HpaShoFu`.
- Medición sin inferencias del contexto guardado de ese revisor: 237.740 → 140.754 bytes mediante deduplicación exacta, con round-trip verificado. Es contexto sin el sobre de tarea, no tokens ni equivalencia semántica demostrada; el ensayo actual conserva su codificación original.
- Continúa instalada la versión 34a57f5f, cola sin trabajo RUNNING y servicio activo comprobados al reanudar. La copia 80abae6f se preparó y pasó doctor, pero **no se activa con el defecto de revocación pendiente**. El despliegue requiere corregir, probar y producir otra versión.

### Corte previo — 16:59 UTC

- [Desarrollo completo real](live-development.json): COMPLETED, mismo candidato generado y revisado por actores distintos, tres archivos idénticos a los que aprobaron 174/174 casos externos. Reentrada sin nuevas inferencias ni operaciones. Se conservan los fallos anteriores y la autorización acotada de una revisión adicional. Las inferencias completadas suman 627.075 tokens; no se presenta ese coste como eficiencia satisfactoria.
- Último corte completo: [306 tests, 305 PASS, cero fallos, un live SKIP](runs/suite-YdZqSn/summary.json). Incluye lotes de propuestas, nueva comprobación independiente de directorios y recuperación sin eludir una aprobación retirada. La integración de descubrimiento web empezó después de este corte y requiere su propia regresión.
- Ocho decisiones reales de jueces sobre cuatro pares sintéticos: ocho decisiones aceptar/rechazar correctas, pasajes válidos; siete etiquetas completas de ocho coinciden con el oráculo. La etiqueta «contradiction» frente a «unsupported-value» tiene solapamiento no resuelto en esa taxonomía; se conserva el 7/8 original, no se altera a posteriori. Evidencia: `/home/cardeex/codex-workspace/sovereign-judgment-live-qEvYm7vR/summary.json`. No es investigación web real ni un certificado universal.
- [Descubrimiento real de la skill local](skill-discovery.json): Codex devuelve `sovereign-factory` habilitada, con ruta y hash exactos, sin inferencia. Permite manejar la CLI desde Codex; no crea notificaciones de chat por sí sola.
- Comparación real de lotes: nueve frente a cuatro inferencias completadas, 78.136 frente a 37.684 tokens totales observados; tres archivos idénticos aceptados en ambos recorridos y revisión independiente. `/home/cardeex/codex-workspace/sovereign-batch-live-578MIX6p/summary.json`. No incluye planificación autónoma ni acredita rendimiento general. El ensayo anterior conserva un timeout y un rechazo por usar un listado histórico como prueba de estado actual.
- El corte de concurrencia ilimitada [suite-Eb6cqg](runs/suite-Eb6cqg/summary.json) falló por timeout al cargar un paquete durante carga elevada. Esa prueba pasó aisladamente, sin ampliar su plazo, y la suite completa pasó con concurrencia de archivos limitada a dos. Se conserva el fallo; no se cambiaron sus criterios para aprobarlo.
- Versión instalada y proceso activo comprobados: [34a57f5f](runtime-deployment-34a57f5f.json). Cambios posteriores del árbol de desarrollo, incluidos lotes y descubrimiento web, no quedan instalados hasta un nuevo despliegue verificado.

## Matriz vigente del mandato

La cabecera de este documento y esta matriz identifican el estado vigente. Los
bloques cronológicos conservan las versiones, resultados y limitaciones de sus
fechas; por ejemplo, 34a57f5f ya no es la release instalada. No se borran ni se
reetiquetan esos resultados anteriores como pruebas de una versión posterior.

| Mandato | Evidencia obtenida | Lo que sigue pendiente |
|---|---|---|
| R01: borrador | 154 fichas actuales auditadas individualmente; suplementos históricos/de configuración con lectura heredada y residuales explícitos; hashes y cobertura | No se afirma lectura de todo el historial Git ni de todos los archivos del repositorio. |
| R02: capacidades | Reconciliaciones Π/Σ, agrupación causal y catálogo completo con fuentes fijadas; ablation real de 16 juicios sintéticos, empate de acierto y mayor coste con facetas | Validar aportación marginal de las combinaciones en tareas reales representativas; empate cerrado no elimina capacidades. |
| R03: dirección | FactoryEngine conserva petición, asigna, revisa y reporta; CLI/SDK y skill local; continuación nativa del trabajo configurada | La continuación nativa no es una garantía de actividad ininterrumpida; la cola por sí misma no envía mensajes al chat. |
| R04: eficiencia | Pares reales de perfiles/lotes/codecs y métricas por fase; entrada cerrada con dos pares correctos y cuatro derivaciones; multifuente v2 completo; formato de fichas completo comparado en cuatro pares reales con menor entrada; se conserva la regresión de cobertura final de 138.023 a 233.447 tokens. Copia nativa integrada 24pcUY correcta: tres inferencias reales, cero productor LLM/reparación/efectos/replay; 70846 tokens/476888 ms. OZcLj2/cVQFI4 conservan fallos, fV56uy dos selecciones aisladas exactas | La ruta forzada correcta sigue siendo costosa para 47 bytes, no eficiencia satisfactoria. El suplemento opt-in puede aumentar tokens. No atribuir causalidad a comparaciones entre planes diferentes o a un brazo con repetición por error. Routing/modelos y aportación marginal de facetas aún no calibrados ampliamente. |
| R05: planificación | Plan independiente, DAG, requisitos literales, cobertura final; cartera integrada con 226 casos; juez con fichas completas y tres incompatibilidades conservadas en Cli4mRSN; rjsI0udG llega a integración aceptada tras reparar dos fronteras de evidencia; ODeAyj completo desde petición natural con cuatro nodos y cinco revisiones aceptadas | ODeAyj es un caso diagnóstico conocido, no holdout ni calibración amplia. Ampliar diversidad y medir utilidad de alternativas. |
| R06: recuperación | Feedback durable, checkpoint de plan/candidato, separación cuota/calidad; recuperación real entre procesos sin reescrituras; revisión del UNKNOWN completado sin abrir original; replan previo al freeze conserva original válido. Correcciones de exposición cualificadas prospectivamente en ODeAyj. Copia nativa: registro/claim atómico y recuperación del origen validado, ocho salidas de proceso reales con proveedor simulado; 24pcUY reentrada real sin replay | a1RAAY, xMileM y wmUkhp conservan sus fallos, no se rehabilitan por ODeAyj. Falta autorización prospectiva de cambio de método después de un intento cerrado y evaluación amplia. No cambiar de plan/ID para buscar coincidencia. |
| R07: revisión | Prerrequisitos aceptados, retracción transitiva y estado de archivos; cartera con aceptación histórica antes de consumo; ruta cerrada con dependencias privadas firmadas. A9wggt/94TM7H aceptan informes en copias sin repetir réplicas ni borrar rechazos. ODeAyj integra prospectivamente todas las puertas: una réplica aceptada antes de apertura, informe 62/61/MISMATCH con 24 PASS y reentrada sin replay | Cualificación satisfactoria del caso diagnóstico, no reconciliación de las misiones anteriores ni comparación semántica general/calibración amplia. Aceptar intento/informe no acepta el original ni termina la fábrica. |
| R08: procedencia | Adquisición real de dos páginas primarias SQLite, condiciones reconciliadas, hashes/pasajes, revisión independiente y grupos de mismo origen; casos adversariales de contradicción frente a distinta condición | Las dos páginas comparten editor; independencia de raíces y resolución empírica de contradicciones a escala no demostradas. Firma no implica verdad. |
| R08, ampliación 13 septiembre | 2cYEbW: dos editores distintos, SQLite y PostgreSQL; adquisiciones frescas, cuatro hechos, ventanas propias de productor y juez, 17 citas externas contrastadas y entrega completa conservada | Dos editores distintos no prueban independencia epistemológica universal; este caso concuerda y no demuestra resolución general de contradicciones. Lote documental real aún pendiente. |
| R09: jueces | Contextos separados, no autocertificación, criterios íntegros y commit atómico; ocho decisiones sintéticas reales correctas y discrepancia conservada. Falso positivo A01 y contraprueba JHAEMl documentados; 24pcUY plan/producto aceptados con pasajes contrastados. XrlCqq: cuatro juicios, ambos objetos equivocados detectados sin confundir fidelidad; 73 citas/16 controles contrastados. Procedencia de inferencias de prerrequisitos expuesta. Diagnóstico condicional separado de aceptación en 14936f68: GV6waD dos juicios reales conformes, selección PASS/FAIL y fidelidad PASS/PASS, nueve citas auditadas, upstream SIMULATED explícito, cero aceptación del candidato/efectos/replay | XrlCqq completo NO pasa; positivos discrepantes ante upstream simulado, no confusión del objeto ni 75% de precisión. u6DhJK falló por enum compartido en nuestro esquema; evidencia preservada, test de frontera primero rojo y corrección verificada. GV6waD es retest de dos casos conocidos, no aceptación operativa, precisión general, cualificación end-to-end ni instalación. 36286 tokens sólo en retest, 53273 con el fallo: no eficiencia satisfactoria. Calibración de rutas completas/dominios diversos pendiente; no reetiquetar ni repetir juicios históricos. |
| R10: fichas | 154 fichas completas y procedencia conservadas; guard de incompatibilidad instalado; dos juicios reales de ajuste y dos especialistas ejecutados; fichas/prefijos cerrados congelados antes de réplica; exposición real auditada en rB9KdY y ODeAyj, este último integrado y aceptado | Ruta cerrada cualificada aisladamente, no instalada. Una faceta de preservación literal no acredita toda la capacidad documental de sigma_08; no se acredita ejecución de los 154 métodos, independencia cognitiva ni pericia universal. Comparación semántica general y afirmaciones fuera del alcance cerrado pendientes. |
| R11: aprendizaje | Baseline/candidato/casos congelados, prefijos exactos, promoción/rollback y destino modelo/effort evaluado; conductor real con propuesta, ocho comparaciones y rechazo por ausencia de mejora. Dos diagnósticos SKIPPED conservados; reentrada sin repetir inferencias | No hay mejora/promoción real demostrada; los cuatro casos sólo prueban extracción literal. No inventar un overlay para obtener resultado positivo. |
| R12: especialistas | Carta complementaria validada; dos fichas autónomas ligadas al plan aceptado y ejecutadas realmente en rjsI0udG, con producción/revisión completas; instaladas en 10bbffa0, sin repetir raíces al recuperar integración | Medición de valor frente a facetas existentes y generalización a otros dominios pendiente. No trasladar a la nueva versión la etiqueta de ensayo íntegro desde cero. |
| R13: suscripción | Codex App Server oficial autenticado con ChatGPT; misiones/inferencias reales; sin API fallback | No se afirma integración con otras suscripciones no configuradas. |
| R14: persistencia | SQLite/FULL/CAS/journal, ownership, fencing, reentrada, cuota, cancelación y efectos inciertos; recuperación real entre procesos; integridad de heads/versiones reforzada instalada; propietarios ligados a boot/PID/start ticks; caída de proceso cerrado sin reemitir réplica; gestor permanente/Linger/guard XRDP. 25 muestras, 21 saludables y cuatro fallidas por ruta eliminada del Node; journal ordinario sin cambio observado. Observador corregido con lectura del ejecutable abierto y prueba nativa de unlink/reemplazo; checkpoint único saludable 00:31 del 13 septiembre sin reiniciar servicio | Más de 50 horas sin muestras y los huecos 18:59–20:07–21:22–22:31–23:18–00:31 no acreditan trabajo ni disponibilidad continuos. Los fallos permanecen; segmento actual 0 y máximo 5132930 ms. Una muestra saludable no acredita una ventana futura ni trabajo continuo. Caída OS integral, cierre de sesiones y ensayo prolongado real pendientes. |
| R15: investigación | Comparación citada de fuentes primarias, preflight local, revisión de protocolos y contraejemplos ejecutados | Las recomendaciones pendientes requieren evaluación antes de convertirse en garantías. |
| R16: integrado | Núcleo nuevo instalado en 10bbffa0, CLI/SDK y skill adaptativa con fichas completas, contrato propio y paralelismo puro acotado; ejecutor aislado, cola, desarrollo y cartera multiproducto aceptados; adquisición multifuente con traza HTTP y descubrimiento; inspectores con fichas, cartas autónomas, pruebas y fallos conservados | Inspector no equivale a control en vivo. Calibración amplia, eficiencia proporcional y operación prolongada pendientes; no cierre del mandato completo. |

Ampliaciones posteriores a las filas históricas: G1ZuZR aporta un par completo
v2/planificado correcto con2/4llamadas y20321/82333tokens, auditoría de14citas
y reentrada sin repetir trabajo. Añade evidencia acotada aR04/R05/R07/R09/R10/
R12; no demuestra coste causal general ni todas las clases elegibles. La carta
del especialista planificado está ligada al plan aceptado y al hash5931539d...;
v2 conserva origen propio del controlador, no se atribuye roles ajenos.
2cYEbW entrega documental completa añade cobertura aR08/R16, pero11llamadas/
311820tokens no satisfacen eficiencia general. El checkpoint único09:24:54.317
registró30muestras/26saludables/4fallidas, sin convertir huecos en uptime;
no sustituye el ensayo prolongado pendiente deR14. Detalles y versiones en
la cabecera vigente y los informes vinculados.

## Verificaciones observadas

- Suite `node --test tests/factory/*.test.mjs`: 202 tests; 201 PASS; 0 FAIL; 1 SKIP live opt-in. Ejecución del 9 septiembre 2026, Node v24.19.0.
- Misión real `50a277cb-4702-4618-a6d7-8dc6690ca9cc`: COMPLETED, 1 producto, 1 adquisición, 6 inferencias completadas por Astra/ultra, 1 repetición de revisión por identificación inválida. Reentrada sin inferencias ni adquisiciones nuevas. El resumen conserva evidencia, no sólo una etiqueta de éxito.
- Misión predecesora `755835f2-9348-4ced-97a5-b5903d0edcd4`: no completada, errores conservados. Sirvió para detectar dos defectos de contrato posteriormente corregidos. No cuenta como éxito.
- Diagnóstico baseInstructions: 2 consultas aritméticas reales; ambas correctas. 7.300 frente a 3.251 input tokens; no acredita equivalencia de calidad general y no cambia la configuración habitual.
- Aislamiento, primer preflight: bwrap falló con `setting up uid map: Permission denied`; retirar sólo aislamiento de red no resolvió el problema. Es un resultado histórico, no el estado actual.
- Aislamiento, después de la intervención del propietario: instalación de bubblewrap 0.9.0 y carga del perfil específico de AppArmor. El 9 septiembre 2026 a las 13:23 UTC, `/usr/bin/true` arrancó con el perfil mínimo y lectura explícita del binario de Codex; pasaron 23 comprobaciones reales y cuatro verificaciones posteriores de archivos. Fuera del sandbox los archivos y endpoints sintéticos eran accesibles (controles positivos); dentro se observaron las denegaciones esperadas. La restricción global de AppArmor sigue a `1`; kernel en ejecución `6.8.0-138-generic`, sin reinicio. [Informe](post-install-isolation.json), [alcance y reproducción](../integration-preflight/POST-INSTALL-ISOLATION.md). Esto no acredita todavía un ejecutor integrado.

## Dependencia administrativa y siguiente fase

El propietario realizó la instalación y carga del perfil desde su terminal. **El bloqueo de arranque del sandbox está superado en las pruebas observadas; no se necesita una nueva autorización administrativa para repetirlas.** No se otorgó sudo permanente, no se usaron contraseñas desde el agente y no se desactivó AppArmor globalmente.

El ejecutor ya está integrado en el broker y el CLI. Pasa snapshots desechables, entorno limpio, límites de cgroup, comprobación de procesos terminados y recuperación de jobs conocidos. Las pruebas incluyen una muerte real del controlador y repetición independiente de comandos. [Contrato](../../factory/tools/EXECUTION.md). No se afirma seguridad universal ni tres días de operación continua.

## Trabajo posterior observado

- Corte de regresión: [237 tests; 236 PASS; 0 FAIL; 1 SKIP](runs/suite-tqGL8f/summary.json), con hashes de los archivos probados. Se añaden verificaciones después de ese corte.
- El perfil compacto está ligado a ID/hash reales de instrucciones base en el request y recibo; las promociones de aprendizaje no cruzan perfiles inadvertidamente. Cuatro casos reales de clasificación comparada usaron 37.999 tokens de entrada con la base ordinaria y 21.971 con scoped-v1. Dos resultados quedaron inicialmente mal calificados por una lista esperada no ordenada; se conservan original y corrección mecánica en `/home/cardeex/codex-workspace/sovereign-profile-eval-ENQQsX6Z`. No es generalización universal ni cambio automático del predeterminado.
- Ensayo real de escritura/revisión: `/home/cardeex/codex-workspace/sovereign-broker-boundary-iEia3fVO/result.json`, ACCEPTED; escritura de dos bytes, lectura del productor y relectura independiente, cuatro inferencias reales Astra/ultra. Es una cualificación de frontera con nodo suministrado, no planificación autónoma ni entrega de la fábrica.
- Ensayo anterior de esa frontera: la escritura y lectura sucedieron, pero la entrega falló por referencia documental inválida. Queda conservado en `/home/cardeex/codex-workspace/sovereign-broker-boundary-GGRrx2ut`. Se corrigió la separación entre fuentes documentales y recibos de operaciones, y se añadió reparación de candidatos sin repetir escrituras.
- Desarrollo con plan ordinario: `/home/cardeex/codex-workspace/sovereign-development-9O5AQCvQ` conserva timeout, continuación y bloqueo del productor por confusión de permisos. Su plan añadió controles globales incompatibles con la ejecución pedida; un nuevo validador rechaza esa contradicción.
- Desarrollo con scoped-v1: `/home/cardeex/codex-workspace/sovereign-development-scoped-P0aQr62D`, misión `d0ee6659-a52d-4e8e-8f20-52fb4fc786b7`. Plan de un producto, requisitos completos y especialista efímero; reanudada con aclaración de la frontera externa. Aún no se registra aquí como completada. Está preparado un oráculo independiente de 174 casos pequeños que no carga el código generado en el controlador.

## Corte posterior: operación y pruebas externas

- [258 tests; 257 PASS; 0 FAIL; 1 SKIP](runs/suite-AZBUtO/summary.json), con hashes. Cambios posteriores conservan sus pruebas adicionales; este corte no certifica archivos modificados después.
- El oráculo externo ya se ejecutó: 174/174 PASS sobre los tres archivos generados, snapshots sin mutación y salida 0; `/home/cardeex/codex-workspace/sovereign-graph-holdout-XgWLBp6A/summary.json`. No sustituye la aceptación independiente del motor ni acredita todos los grafos posibles.
- La revisión del desarrollo registró un exceso de volumen de protocolo y después un error remoto sin categoría conservada. Ambos fallos permanecen. Se separaron límites de eventos y respuesta; ahora se conservan sólo categorías oficiales finitas, códigos HTTP y contadores. Los eventos `willRetry` de fallos transitorios se respetan dentro del timeout; no se guardan mensajes privados del servidor.
- Aprendizaje real: seis inferencias, tres pares sobre casos visibles, todos correctos tanto con baseline como con candidato. El evaluador negó la promoción por ausencia de mejora, dejando la versión activa intacta. No es un benchmark de generalización ni un éxito de mejora.
- Cola local implementada y probada: envío idempotente, pausa, continuación, cancelación, recuperación, exclusión de coordinadores y backoff durable. CLI real arrancado dos veces y detenido con SIGTERM, sin inferencia en esos tests. `sovereign-factory.service` está enabled/active, con estado en `/home/cardeex/.local/state/sovereign-factory`; no abre puertos. `Linger=no`, sin afirmación de continuidad tras cerrar sesiones.
- Misión live de cola `mission:78afdee6-1b1c-4b97-a68e-bdbce1d0bb86`, creada desde `submit` y recogida por el servicio. No se registra aquí como completada hasta verificar su resultado.
- Codec de contexto sin pérdida aún no activado: round-trip exacto, escape de marcadores y comprobación de hashes. En el contexto guardado de revisión reduce bytes de 272.216 a 159.377. Es una medición offline de datos repetidos, no ahorro de tokens observado ni equivalencia semántica del modelo.

## Actualización posterior a ese corte

- Los estados anteriores de cola/Linger/codec describen aquel momento, no el estado vigente: [cola real COMPLETED y Linger=yes](live-queue.json), con fallo previo conservado. Once inferencias reales; no se acredita eficiencia aritmética.
- Codec pareado real: cuatro resultados correctos sobre dos casos congelados; 14.827 frente a 12.600 tokens de entrada. `/home/cardeex/codex-workspace/sovereign-codec-live-eIRUzo2W/summary.json`. Activado explícitamente para continuar la revisión del mismo candidato de desarrollo, no como predeterminado general.
- Corte [271 tests, 270 PASS, cero fallos y un SKIP](runs/suite-ebOTk7/summary.json). Después se añadieron renovación del lease de nodo, reparación acotada de citas sin repetir herramientas y empaquetado del runtime; requieren su propio corte de regresión.
- La revisión real de desarrollo con codec completó una inferencia, pero su aceptación fue rechazada por citar también una ejecución del productor como prueba de estado actual (`TOOL_ACTOR`). La repetición permanece registrada; no se sustituyó el dictamen por un PASS administrativo. El código generado conserva el mismo candidato y oráculo externo.
