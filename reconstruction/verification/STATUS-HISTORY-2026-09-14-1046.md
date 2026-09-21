# Estado de aceptación de Sovereign Factory

Actualizado: **14 septiembre 2026, 10:45 UTC**.
**Mandato completo pendiente.** El contrato permanece en [MANDATE.md](../MANDATE.md).
Una implementación, una batería aprobada o un caso aceptado no cierran R01–R16.

## Situación actual

- **Aplicabilidad LIVE GoZbep/15807 en curso**, iniciada 10:43. Tres casos nuevos
  preregistrados: texto con duplicados/Unicode/instrucciones como datos, grafo
  formal sin herramientas y el mismo problema con planificación previa obligatoria.
  SIM JZFeGq/46986 cerrado (3/2/6 respuestas), auditoría 10:42:38.657: 331+9 pins,
  quince usos de citas y tres reentradas sin inferencia. Dos pruebas de oráculo
  PASS, incluidas 720 permutaciones independientes. No editar sus pins ni el
  núcleo durante LIVE. [Criterios](experiments/BOUNDED-APPLICABILITY-QUALIFICATION.md).
  [Promoción condicionada](BOUNDED-READ-PROMOTION-PREFLIGHT.md), todavía no ejecutada.
- **Entrada con lectura: primer LIVE aceptado de forma acotada, no instalada.**
  ocSk6B/58072 cerrado 10:30:41.720, tres llamadas reales y 42.946 tokens frente
  a siete/152.181 del mismo inventario histórico. Relectura propia del juez
  posterior al candidato, siete criterios íntegros y reentrada sin regeneración.
  Auditoría 10:34:40.810, 331+7 pins, once usos de citas, tres cierres; revisión
  semántica separada aprobada. [Resultados y límites](BOUNDED-READ-RESULTS.md).
  No es ahorro causal/general. Siguiente: aplicabilidad, datos adversariales y
  respeto real de planificación obligatoria; casos/oráculos ya definidos.
- **Regresión global de la entrada con lectura cerrada; snapshot no instalado.**
  wm3d8Q/65729 cerrada 10:17:40.262: 1749 tests, 1748 PASS, 0 FAIL, 1 SKIP.
  Auditoría 10:25:06.747: 331 pins, cuatro streams coincidentes y ambos owners
  ausentes. Snapshot verificado 3d2f562a, 432 archivos; no sustituye al instalado.
  Once SIGKILL reales 76804/11 PASS y dirigida conjunta 1415/104 PASS cerradas.
  Política protegida por protocolo 6 desde la creación; permisos CLI explícitos
  `--allowed-tools`, sin reautorizar misiones existentes. Antiguos presets intactos.
  [Evidencia y fallos conservados](BOUNDED-READ-RESULTS.md). Compatibilidad zYQ8Rk
  con b7 real cerrada y auditada antes del refuerzo posterior de tres archivos;
  no atribuirle pins actuales completos. Servicio sigue b7cb510c sin cambios.
  El SIM y LIVE posteriores del mismo inventario están cerrados arriba. Umbral
  previo conservado: 25% menos tokens históricos totales, sin cambiar petición,
  modelo, permisos, datos ni controles de calidad.
- **Ruta acotada con lectura implementada, no instalada.** Contrato explícito
  `bounded-read-response-v1`, separado de los modos/presets anteriores. Productor
  con contrato propio, una intención de lectura y 65.536 bytes completos como
  límites de esta ruta, no del encargo; fuera de alcance pasa al plan. Reutiliza
  conservación de propuestas y relectura propia del juez posterior al candidato.
  [Diseño y criterios](../design/BOUNDED-READ-ENTRY.md). La primera dirigida
  43766 cerró 21 tests: 20 PASS/1 FAIL, 10750.658631 ms. El control existente
  rechazó una respuesta anterior a la petición con cuota fallida; se corrigió la
  selección de recuperación, no el control. Las dirigidas posteriores y la
  regresión global arriba están cerradas. **El árbol de desarrollo ya difiere
  de b7cb510c; TymHUs no lo cualifica.** Servicio y freezes intactos.
- **Prototipo de diccionario corto, comparación acotada aprobada; no instalado.**
  sOaoUD/58045 cerrado 09:25:34.643: cuatro respuestas correctas, 13.029 tokens
  frente a 13.471 originales. Auditoría 09:26:24.033, owner ausente y 324+8 pins.
  [Resultado y límites](SHORT-TEXT-POOL-RESULTS.md). Siete pruebas locales y
  SIM n1cqbp/27377 cerrados. Todo permanece fuera del núcleo b7cb510c.
  No repetir el ensayo ni confundirlo con eficiencia general. La entrada con
  lectura investigada después ya tiene la evidencia separada descrita arriba;
  no atribuir ese ahorro al prototipo de transporte.
- **Selector adaptativo RECHAZADO por coste y retirado del núcleo activo.**
  LIVE TRLzD8/75406 cerrado 09:08:31.473: cuatro respuestas correctas,
  pero 13.884 tokens adaptativos frente a 13.491 originales (+393).
  Auditoría 09:09:55.823: owner ausente, cuatro clientes cerrados, 326+5 pins.
  [Resultado](ADAPTIVE-CONTEXT-RESULTS.md). No repetir ni instalar b5f506aa.
  A las 09:14:41.309 se verificó restauración exacta de los 324 inputs de
  b7cb510c/TymHUs: 17 archivos restaurados, dos adiciones retiradas, los 19
  conservados en archivo recuperable con hashes. Servicio sin cambios.
  La reducción offline de 17.699 bytes no fue ahorro de tokens demostrado.
  La hipótesis posterior de referencias cortas ya se ensayó arriba; no reactivar
  el selector fallido ni cambiar sus cinco archivos históricos.
- **Regresión del candidato retirado QdBxBN/87423 cerrada**, 09:05:53.570:
  1714 pruebas, 1713 PASS/0 FAIL/1 SKIP, 479051.064517 ms; freeze b5f506aa,
  430 archivos. No instalado. Sus 326 pins ya no describen el núcleo restaurado.
  SIM AWHgQd/15754 cerrado y auditado, cuatro fixtures sin inferencias reales.
  Las baterías aprobadas no impidieron el rechazo posterior por consumo real.
- **Instalado b7cb510c**, [preservación y auditoría](INPUT-REVIEW-INSTALLATION-2026-09-14.md).
  Captura 08:33:28.520 y auditoría 08:35:15.077: PID 2564734, gestor/cgroup
  canónicos, único holder, enabled/NRestarts=0 en esa consulta. Conservadas
  161 versiones y 58 heads materiales; sólo queue-owner 32/33 nuevos,
  journal 418 y 163 versiones. Backup privado coherente previo. Cero misiones,
  inferencias o efectos nuevos. Protocolo instalado permanece 2; revisores
  nuevos requieren 5. Help/queue/report humano y JSON verificados; se conserva
  el error inicial del auditor por intentar parsear el formato humano como JSON.
  Skill local actualizada para nuevas peticiones adaptive-v2, sin alterar
  misiones existentes; validación estructural aprobada. Sin sesiones activas
  de inferencia/prueba de esta cualificación. Seguir con eficiencia, no repetir
  otro estado idéntico del servicio ni el mismo LIVE.
- **LIVE corregido LFYIrU/1075 cerrado**, 08:27:38.093, siete llamadas reales,
  152.181 tokens observados, 17 controles PASS, plan y producto ACCEPT, sin
  reparaciones. Cuarenta usos de citas reconciliados; auditoría 08:28:34.189,
  324+5 pins, owner ausente, siete cierres, protocolo 5 y journal 335.
  Orden durable: lectura productor 199 → candidato 237 → lectura propia juez
  247 → petición juez 259 → dictamen 317 → aceptación 318. Mismos 478 bytes,
  cálculo propio 6450 mg, diferencia +50 y falso; reentrada sin inferencias.
  [Resultado y límites](INPUT-REVIEW-RESULTS.md). Revisión sustantiva 08:31:01.053:
  ACCEPT_SCOPED_CORRECTION antes de instalar. Caso conocido, no eficiencia
  general ni cierre R01–R16. No repetirlo ni cambiar sus cinco pins históricos.
- **Global corregida TymHUs/37691 cerrada**, 08:11:46.175: 1693 tests,
  1692 PASS/0 FAIL/1 SKIP, 455211.088482 ms. Auditoría 08:13:12.661:
  324 pins, cuatro streams y dos owners ausentes. Freeze **b7cb510c**,
  429 archivos/24.233.481 bytes, posteriormente instalado arriba.
  [Cierre y snapshot](runs/suite-TymHUs/post-close-audit.json).
  SIM corregido **whNNS3/7630 cerrado**, siete respuestas simuladas y 17 controles
  PASS, dos productos aceptados, cero cursores innecesarios, un cargo de productor,
  lectura propia posterior del juez y reapertura sin inferencias nuevas.
  Auditoría 08:14:04.233: 324+5 pins, once usos literales de citas, protocolo 5,
  journal 175, owner ausente. [Auditoría SIM](runs/input-review-sim-whNNS3/post-close-audit.json).
  Es evidencia de integración, no juicio real ni eficiencia general.
- **Global U9qZO8/25992 cerrada con fallo**, 07:55:33.446: 1692 tests,
  1690 PASS/1 FAIL/1 SKIP. Auditoría 08:01:58.889, 324 pins y cuatro streams
  intactos, dos owners ausentes. El fallo esperaba BLIND_PROTOCOL tras corromper
  candidato/review; ahora la vinculación original rechaza antes con
  INPUT_REVIEW_INTEGRITY. Se mantuvo ese contraejemplo y se añadió un caso
  genuino de gates operativos para comprobar también BLIND_PROTOCOL. Sin cambio
  del motor ni reducción de controles. Dirigida 90713: 114 PASS/0 FAIL,
  71690.032261 ms. Segunda global TymHUs/37691 cerrada arriba;
  no crear release a partir de U9qZO8.
  [Cierre fallido](runs/suite-U9qZO8/post-close-audit.json).
- Compatibilidad aislada **2TAW1V/69676 cerrada**, cinco controles PASS con
  código anterior 926c524d real: rechaza protocolo 5 ya abierto y al abrir,
  conserva 17 versiones antiguas sin recertificación y la revisión nueva sí
  relee la entrada. Auditoría 07:48:23.095, ocho pins, owner ausente, dos bases
  sin mutación por auditoría. [Evidencia](runs/input-review-compatibility-2TAW1V/post-close-audit.json).
  Ensayo completo corregido en curso, estado arriba, según
  [prerregistro](experiments/INPUT-REVIEW-QUALIFICATION.md). Sólo workspace.read,
  sin requiredEffects:file ni listado/cursor obligatorio. Oráculo prospectivo
  exacto, preserva tokens numéricos JSON además de cadenas decimales: 18 pruebas
  deterministas PASS. No modifica el ensayo WfS70I ni sus cinco pins históricos.
- **Corrección incluida en b7cb510c, no cualificada por la antigua 3nFPFN:** política
  `input-file-review-v1` en el origen de cada revisor, protocolo de ejecución 5,
  derivación de entradas desde el snapshot del productor anterior al candidato,
  lectura propia, versión/cita obligatorias y comprobación al aceptar/entregar.
  No cambia los orígenes de revisores históricos. Aprendizaje no cualificado
  excluido; revisión de archivos escritos conserva su versión de salida.
  Casos iniciales: 13 PASS/2 FAIL por dos errores del harness (expectedHash y
  raíz de reapertura); siguiente 15 PASS/2 FAIL por usar la proyección ordinaria
  en la prueba documental. Ambos resultados conservados. Integración 80380
  cerrada: 231 PASS/0 FAIL, 77417.637201 ms. Integridad más ocho cortes SIGKILL
  de motor 86574: 18 PASS/0 FAIL, 28637.669404 ms. La global actual incluye
  también la clasificación de errores editada durante la dirigida 80380.
- **LIVE WfS70I/52067 CERRADO**, exit 2, 07:31:15.122, misión PAUSED por el
  plazo original de 30 minutos. Once llamadas completas y duodécima CANCELLED;
  doce reservas consumidas sin devolución. Subtotal conocido **346.287 tokens**;
  consumo de la cancelada desconocido, no total cero. Un solo efecto, lectura
  del productor; cero lecturas propias del juez y cero entregas aceptadas.
  Juicios originales: plan ACCEPT, producto RETURN, recuperación RETURN.
  La última propuesta de tres nodos no obtuvo revisión completada ni ejecución.
  Auditoría forense sólo lectura 07:31:35.097: owner ausente, cierres de doce
  clientes confirmados, 321+5 pins, 73 usos exactos de citas, journal 519.
  [Auditoría del fallo](runs/adaptive-v2-live-WfS70I/post-close-failure-audit.json).
  Ya reconciliado antes de editar el núcleo. No reanudar/repetir este brazo,
  convertirlo en éxito ni instalar 68fae338. El oráculo final no llegó a
  ejecutarse; sus restricciones excesivas siguen siendo un defecto del ensayo.
- **Bloqueada la instalación de 68fae338 por defecto reproducido:** la revisión
  relee archivos escritos/declarados, pero no entradas sólo leídas por el
  productor. Diagnóstico aislado CVLfLT: tres respuestas SIM, aceptación con
  cero lecturas propias del juez y una lectura externa del productor. Es un juez
  SIM deliberadamente permisivo, no un falso positivo de un modelo real.
  [Auditoría sólo lectura](runs/readonly-review-diagnosis-CVLfLT/post-close-audit.json).
  LIVE WfS70I confirmó el efecto material: respuesta 6 RETURN, falta la relectura
  propia; el cálculo 6450 mg/+50 y el contenido sí fueron comprobados desde los
  operandos históricos. Respuesta 7 solicita fichas para la única recuperación
  autorizada; su cierre y posterior corrección en desarrollo constan arriba.
  No se debilitaron criterios ni ampliaron presupuestos durante el ensayo.
  El oráculo del ensayo, además, exige tipos numéricos y activación de cursor/list
  que el encargo no imponía: conservar su veredicto original y distinguir ese
  problema del ensayo del defecto auténtico de relectura. No reinterpretarlo
  retrospectivamente como prueba aprobada.
- **Desarrollo posterior a 926c524d:** integración opt-in `adaptive-v2` y rechazo
  prospectivo de documento/cursor incompatible. No instalada ni cualificada por
  G50Fbx: cambiaron mission-presets, engine, ayuda CLI y nuevas pruebas.
  [Decisión y fronteras](../design/ADAPTIVE-INTEGRATION-V2.md). Rojo inicial seis
  FAIL: v2 ausente y dos creaciones incompatibles que no se rechazaban. Nueve
  controles de selección/compatibilidad pasaron tras implementar. Integración
  inicial conservada: errores del harness en cierre doble, estado histórico y
  ruta de un campo de recibo; juez SIM omitió su listado propio y el control lo
  rechazó. Se conserva el presupuesto de ocho llamadas del recorrido material.
  Integración 75670 cerrada: 69 PASS/0 FAIL, 55989.216325 ms. CLI 70841:
  un PASS; frontera de presupuesto 20365: diez PASS/0 FAIL. Se conservaron
  los errores del harness, sin rebajar controles ni aumentar el techo.
- Global nueva **3nFPFN/14569** cerrada 06:53:08.320: 1665 tests,
  1664 PASS/0 FAIL/un SKIP, 361837.593939 ms. Auditoría 06:55:11.657:
  321 pins, cuatro streams y dos owners ausentes. Freeze **68fae338**,
  428 archivos/24.223.343 bytes, NO instalado.
  [Auditoría](runs/suite-3nFPFN/post-close-audit.json).
  Ensayo integrado según [prerregistro](experiments/ADAPTIVE-V2-QUALIFICATION.md).
  SIM mmkDqf/72798 cerrada: siete llamadas simuladas, quince controles PASS,
  misión COMPLETED, linaje completo de dos artefactos, cursor y reentrada.
  Auditoría 07:00:53.151: owner ausente, 321+5 pins, catorce usos de citas,
  protocolo 4, dos cargos y journal 194. [Auditoría](runs/adaptive-v2-sim-mmkDqf/post-close-audit.json).
  **LIVE WfS70I/52067 cerrado y reconciliado con fallo**, detalles arriba;
  no hubo semilla SIM en su motor/plan. Las ediciones posteriores invalidan la
  cualificación del desarrollo actual, no reescriben los pins históricos.
  Servicio sigue 926c524d.
- **Instalado 926c524d**, [preservación y auditoría](CURSOR-RUNTIME-INSTALLATION-2026-09-14.md).
  Captura 06:21:52.595, auditoría 06:22:16.278: PID 2505335, gestor/cgroup
  canónicos, único holder, enabled y NRestarts=0 en esa consulta. Se preservaron
  159 versiones originales y 58 heads materiales; sólo queue-owner 30/31 nuevos,
  journal 416 y 161 versiones. Backup coherente privado anterior al cambio.
  Cero misiones/inferencias/efectos nuevos durante la instalación. Base permanece
  en protocolo 2: no se inició un productor nuevo (3 ordinario, 4 cursor opt-in).
  Help/queue/report instalados completos comprobados. No hubo sesiones de
  cualificación/prueba activas al cerrar esa instalación; desarrollo posterior
  descrito arriba. Sigue la cobertura pendiente de R01–R16.
- LIVE del cursor bSXjkB/69583 cerrado exit 0: tres llamadas, **46.762 tokens**,
  20 controles PASS, juez ACCEPT. Auditoría 06:18:02.325: tres owners ausentes,
  320+5 pins, dos cargos, quince usos de citas, protocolo 4, journal 148.
  Las tres respuestas se leyeron completas. [Resultado y límites](PRODUCER-CURSOR-RESULTS.md).
  Caso conocido, Veritas 07 / Omega 22, sin planner real ni misión completa.
  No repetir el ensayo ni presentar un ahorro general por este resultado.
- SIM Mx2jtO/41160 cerrada: tres respuestas simuladas, 20 controles PASS.
  Auditoría 06:12:39.301: tres owners ausentes, 320+5 pins, protocolo 4,
  dos cargos durables, nueve usos de citas, journal 94. Corte real después
  del primer recibo/antes de observarlo; únicamente lectura pendiente después,
  final original y juez independiente. [Auditoría](runs/producer-cursor-sim-Mx2jtO/post-close-audit.json).
- Global G50Fbx/20265 cerrada: 1654 tests, 1653 PASS/0 FAIL/un SKIP,
  400502.788131 ms, 05:58:41.470→06:05:22.100. Auditoría 06:07:45.248:
  320 entradas, cuatro streams y dos owners ausentes. Snapshot 926c524d,
  428 archivos/24.221.107 bytes, posteriormente instalado arriba. [Auditoría y freeze](runs/suite-G50Fbx/post-close-audit.json).
  Compatibilidad y ocho fronteras SIGKILL de motor completas 57118: diez
  PASS/0 FAIL, 29767.156586 ms; estado aislado HANQFU conservado.
- Desarrollo previo del cursor exacto y cargos durables, opt-in
  `read-test-cursor-v1`, cabecera 4. Integración 99527: 152 PASS/0 FAIL,
  21909.975244 ms. Incluye seis SIGKILL del motor completo, modelo SIM,
  archivos/comandos aislados reales, mismo productor y juez con verificaciones
  propias. Integración posterior de límites/errores 4123: 72 PASS/0 FAIL,
  22151.601162 ms. Los cortes posteriores de declaración no comprometida
  y PREPARED ya están incluidos en G50Fbx. [Diseño y evidencia](../design/RESUMABLE-READ-TEST-BATCH.md).
  Cualificación/instalación completadas arriba; sin ahorro general demostrado.
- Compatibilidad iz0Fzj/64186: dos PASS/0 FAIL, 1456.225468 ms. 68fd4472
  real rechaza 4 al abrir y desde escritor ya abierto; mantiene lectura del final
  antiguo en 3 sin cargos/cursor añadidos. Auditoría 05:53:48.410: owner ausente,
  ocho pins intactos, dos bases conservadas. Cambios posteriores de engine no
  forman parte de esos pins. La regresión SdIPvT/LIVE 9FZelU NO cualifica el
  nuevo lector compartido, contador, cursor ni integración posteriores.
- Diagnóstico de lotes MAYwkd/55180 cerrado, cinco fronteras locales confirmadas.
  Después del corte se inspeccionó sin escribir: resultado ya guardado no es lo
  mismo que operación no despachada o incierta. El contador previo no representa
  todos los efectos comprometidos. Auditoría 05:17:41.148: seis owners ausentes,
  315+1 pins, journal y WAL conservados. [Diseño pendiente](../design/RESUMABLE-READ-TEST-BATCH.md).
  Diagnóstico previo a la implementación de desarrollo descrita arriba; no prueba
  ejecución de recuperación ni ahorro real.
- Instalación anterior **68fd4472**, [preservación y auditoría](CLEANUP-RUNTIME-INSTALLATION-2026-09-14.md).
  Observado activo 05:07:05.913, auditado 05:07:57.160: PID 2475293, gestor/cgroup
  canónicos, único holder, enabled, NRestarts=0 en esa consulta. Se preservaron
  157 versiones originales y 58 heads materiales; sólo queue-owner 28/29 nuevos,
  journal 414, 159 registros. Copia privada coherente previa. Cero misiones,
  inferencias o efectos nuevos durante el cambio. Base instalada sigue protocolo
  2: no se inició producción nueva que requiera 3. Help/queue/report comprobados.
  No quedan sesiones de inferencia/prueba activas; sigue el trabajo de eficiencia
  y recuperación durable de lotes, no otra muestra idéntica del servicio.
- LIVE 9FZelU/49819 cerró exit 0: tres llamadas/46.856 tokens, 19 controles
  aprobados, dos cierres de productor comprometidos antes del SIGKILL, final
  recuperado sin reproducción y juez independiente ACCEPT. Auditoría
  05:03:49.045: 315+4 pins, trece citas, tres owners ausentes, protocolo 3.
  [Revisión sustantiva y límites](PRODUCER-CLEANUP-RESULTS.md). Sin inferencias
  activas. Instalación de 68fd4472 completada arriba.
- SIM RBbJO1/93442 cerró PASS con cuatro respuestas simuladas; auditoría
  04:58:51.642: tres owners ausentes, 315+4 pins, nueve citas y tres registros
  durables de cierre, protocolo 3. Ensayo LIVE `producer-cleanup-live-9FZelU`
  / 49819 cerrado arriba sobre el mismo snapshot/contrato. Conservar sus cuatro
  pins y el núcleo cualificado; no repetir este brazo.
- Nueva global SdIPvT/96422 cerrada 04:57:38.595: 1598 tests, 1597 PASS,
  cero FAIL, un SKIP, 346061.195876 ms. Auditoría 04:57:56.476: 315 pins,
  cuatro streams y dos owners ausentes. Snapshot de desarrollo 68fd4472,
  426 archivos/24.189.152 bytes, después instalado. SIM `producer-cleanup-sim-RBbJO1`
  completada sobre ese snapshot; brazo real descrito arriba.
- Corrección del error diagnóstico: integración 8451 cerrada, 99 PASS/0 FAIL,
  13530.6721 ms; incluye el contraejemplo original y controles CLOSED/UNCONFIRMED.
  Compatibilidad posterior h5Xj0F/97905: tres PASS/0 FAIL, 1423.49107 ms.
  Nueva global `suite-SdIPvT` / 96422 cerrada arriba; sin inferencias reales activas.
- Regresión `suite-97P0Jx`, sesión 94778, cerrada 04:48:52.573: 1596 tests,
  1595 PASS/0 FAIL/un SKIP, 336937.758784 ms. Auditoría 04:50:50.038:
  315 pins, cuatro streams, dos owners ausentes. SIN freeze: sonda adicional
  reproducía bloqueo falso si fallaba el evento diagnóstico posterior a CLOSED
  (0 PASS/1 FAIL, 571.501004 ms). Corrección posterior separa error de diagnóstico
  y prueba durable; integración posterior descrita arriba. No inferencias reales lanzadas.
  [Rojo](experiments/producer-cleanup-event-boundary-red.json).
  Desarrollo ampliado anterior 92881
  cerró: 99 PASS/0 FAIL, 10946.222977 ms. Incluye dos cortes SIGKILL adicionales
  antes/después del commit de cierre, cuota/auth/cancelación, siete alteraciones
  con journal válido y compatibilidad contra los módulos reales efbdb0e9.
  [Salida](experiments/producer-cleanup-compatibility.json); estados aislados
  `runs/producer-cleanup-compatibility-CWMLKM`, sin modificar la base instalada.
  Se prepara cualificación posterior en SIM y suscripción con snapshot nuevo;
  no se ha lanzado ninguna inferencia real de este cambio.
- Desarrollo previo a la instalación 68fd4472: [cierre durable de productor](../design/PRODUCER-CLEANUP-BARRIER.md).
  Tres defectos reproducidos (0 PASS/3 FAIL, 2867.395569 ms, 33259) y primera
  reparación dirigida 3 PASS/0 FAIL, 1403.834295 ms. Falta cierre explícito por
  paso en efbdb0e9; el cambio conserva ese registro antes de consumo/herramientas
  y exige protocolo 3 al iniciar producción nueva. En esas pruebas no se promovió
  ninguna base histórica. La regresión SncT0v NO cualifica este cambio posterior.
  Integración 33642 cerrada: 83 PASS/0 FAIL, 11449.693841 ms, cuatro archivos
  de cierre, respuesta, almacenamiento y read-test. Salida íntegra en
  [producer-cleanup-integration.json](experiments/producer-cleanup-integration.json).
  Se conserva también la integración inicial 35 PASS/5 FAIL: tres expectativas
  anteriores permitían recuperar antes del cierre y dos usaban 3 como versión
  futura desconocida. Se mantienen los cortes negativos y se prueba 4 como futura.
- Cerró 98347 / `joint-context-live-lUzFBz`, exit 2, tras tres llamadas reales
  y 47.880 tokens. El productor dio el mismo JSON con 1.658 tokens menos, pero
  el juez negativo difirió del UNKNOWN exigido por el oráculo y no se lanzaron
  las otras tres llamadas. RETURN y 17 citas correctos; discrepancia entre
  criterio de contenido y prueba del proceso interno, no pérdida de datos
  demostrada. [Resultado y límites](JOINT-CONTEXT-RESULTS.md). Auditoría
  04:19:58.979: owner ausente, 314+13 pins, recibos/cierres íntegros. Sin sesiones
  de inferencia activas, sin integrar el codec ni repetir el brazo fallido.
- Diagnóstico offline de eficiencia ampliado a las cinco capturas reales de
  recuperación de método: 25 pruebas dirigidas PASS; contextos reconstruidos
  idénticos y recibos/prefijos contrastados. El prototipo conjunto reduce 41.287
  bytes sobre 287.530 de entrada antes de sus instrucciones adicionales.
  [Descomposición y decisión](../design/COST-DECOMPOSITION-2026-09-14.md).
  No son tokens ahorrados, no se ejecutaron inferencias ni se cambió el núcleo.
  Prueba de interpretación/coste cerrada sin cualificar arriba; el prototipo
  no está activado. Se mantienen los resultados negativos y todos los campos.
- **Instalación anterior, sustituida por 68fd4472:** [efbdb0e9](RUNTIME-UPGRADE-2026-09-14.md),
  426 archivos/24.180.631 bytes. Activo observado 03:44:56.608 y auditado
  03:48:11.710, PID 2441591, gestor/cgroup canónicos, único holder de la base,
  enabled, NRestarts=0 en esa consulta. Se preservaron 155 versiones originales,
  58 heads materiales, misión y cola; sólo cambiaron liberación/adquisición de
  queue-owner. Copia privada coherente previa, protocolo nuevo 2, cero misiones,
  inferencias o efectos nuevos. Help/queue/report instalados comprobados.
  No volver a un ejecutor antiguo bajando la cabecera o descartando trabajo.
  No quedaban sesiones de prueba/inferencia activas al cierre de esa auditoría;
  la comparación posterior ya cerrada se describe arriba.
  Sigue pendiente eficiencia proporcional y las obligaciones generales del mandato.
- NUEVO posterior a 5bac/v3wP0Y: [barrera de protocolo de escritura](../design/EXECUTION-PROTOCOL-FLOOR.md).
  Matriz oPJuG8: cuatro estados, doce lectores correctos. Sonda mXyDjF:
  la versión antigua intentó inferencia con presupuesto agotado; el proveedor
  SIM bloqueó el intento, sin llamadas reales. Nueva versión lo detuvo antes.
  Auditoría 03:16:54.060: 16 owners ausentes y 312 pins íntegros. Primer harness
  jlqGWO falló por rechazar WAL vacío; conservado y corregido. Store se modifica
  para elevar user_version a 2 atómicamente con cada primera escritura, conservar
  1 al sólo leer y rechazar aperturas antiguas posteriores. Rojo dirigido:
  ocho pruebas, tres PASS/cinco FAIL, 459.250792 ms. Reparación: 32 PASS;
  integración de cuatro archivos 49 PASS/0 FAIL, 27156.534317 ms, cinco SIGKILL.
  1nmG36 cerró 03:23:38.318: apertura antigua real bloqueada tras promoción;
  auditoría 03:26:04.003, tres owners ausentes, tres pins y DB intacta.
  22853 / suite-SncT0v cerró 03:30:17.684: 1566 tests, 1565 PASS, cero FAIL,
  un SKIP, 356258.294284 ms. Auditoría 03:33:15.966: 314 inputs, cuatro streams,
  comandos y owner ausente. Freeze efbdb0e9. Cualificación IeOxWG/29339 aprobada:
  dos copias, seis procesos, entrega retenida y presupuesto SIM aún bloqueado;
  auditoría 03:35:48.353, siete owners ausentes, 314+2 pins, originales intactos.
  Tras esas pruebas se hizo la instalación controlada descrita arriba.
- 70959 / [method-recovery-live-2spDVa](METHOD-RECOVERY-RESULTS.md) cerró
  exit 0 a 03:03:06.907. Tres semillas SIM y cinco inferencias reales, 16 controles
  aprobados, método revisado por juez antes de nueva producción, producto correcto
  y reentrada sin replay. Auditoría 67524 cerrada a 03:03:33.864: 312+4 pins,
  56 usos de citas, dos owners ausentes, recibos y SQLite íntegros. Revisión
  sustantiva completada. 135.255 tokens reales: coste elevado en un caso pequeño,
  no eficiencia general. Sin inferencias activas. Siguiente: compatibilidad
  operativa de los protocolos nuevos, sin tocar el servicio instalado.
- 47864 / `suite-v3wP0Y` cerró exit 0 a 02:43:19.925: 1552 tests,
  1551 PASS, cero FAIL, un SKIP; 339883.2159 ms. Auditoría 02:44:03.339:
  312 inputs, cuatro streams, comandos y owner ausente. Freeze
  `5bacdb46f67acd9a7a2acc4b3503125b7cc0e052d0fbb59f2f52641f02470ae1`,
  426 archivos/24.178.882 bytes, **no instalado**. Cubre la nueva cronología:
  histórico global intacto más frontera `methodRevision` autenticada.
  Sonda anterior verde; 39 controles de integración PASS/0 FAIL,
  8385.794234 ms (6902). Cinco SIGKILL comprueban ambos tiempos y manipulación
  de la conclusión. Resultado real acotado documentado arriba.
- 44093 / `suite-p0mQNE` cerró exit 0 a 02:27:48.242: 1552 tests,
  1551 PASS, cero FAIL, un SKIP, 328684.935163 ms; 312 inputs.
  Auditoría de cierre guardada. Sin freeze ni llamadas reales: una sonda adicional
  FALLÓ en cronología de dependencias después de la revisión del método. El
  observador conserva el primer intento global; aún falta representar por
  separado el primer intento del método revisado sin reescribir el histórico.
  Su rojo está en experiments/method-recovery-chronology-red.json.
  Antes de esa global cerró 27423: 18 PASS/0 FAIL/8454.153328 ms,
  reportes históricos y recuperación con cinco SIGKILL. Sin sesiones activas.
- 76407 / `suite-dEyKIN` cerró exit 1, 02:19:32.854 UTC: 1552 tests,
  1548 PASS, tres FAIL, un SKIP, 336470.156571 ms. Tres fallos en lectura de
  reportes históricos mínimos sin policy. Lector corregido; regresión posterior
  aún pendiente. Sin llamadas reales activas. Cambio posterior a e07:
  [revisión del método tras rechazo material](../design/REVIEWED-METHOD-RECOVERY.md).
  Motor/SDK/CLI/report construidos, opt-in, sin instalar. 15 controles del motor
  PASS, 14 de contrato/caídas PASS (cinco SIGKILL reales con modelos simulados),
  una prueba CLI PASS. La global nueva y la cualificación real siguen pendientes.
  No considerar e07/MUS7Oc como validación de este cambio posterior.
- 46910 cerró exit 0 a 01:44:38.726:
  [mB7oR4](CLOSED-ENTRY-RESPONSE-RESULTS.md), dos llamadas reales/19.531 tokens,
  19 controles aprobados. SIGKILL después del cierre y antes del candidato;
  engine.run recuperó la misma respuesta y llegó a COMPLETED con juez separado.
  Auditoría 01:50:37.973: 308+4 pins, cuatro usos de citas, tres owners ausentes,
  recibos/cierres/reservas y SQLite íntegros. Revisión sustantiva completada.
  Caso conocido de entrada cerrada; no plan material ni eficiencia general.
  Global MUS7Oc/32637 cerró 01:41:08.368: 1522 tests, 1521 PASS, cero FAIL,
  un SKIP; 320965.140068 ms. Auditoría 01:42:51.962: 308 pins/four streams,
  comandos concordantes y owner ausente. Freeze
  `e07a8b33322dd4c2e2bddf46f9e9b9064a052b779b11b4ededbae4c97afa3589`,
  425 archivos/24.152.129 bytes. **No instalado**; alcance real limitado arriba.
- 57877 cerró, 273 PASS/0 FAIL/54871.529418 ms en cinco archivos de una reparación POSTERIOR:
  persistencia de entrada cerrada v1/v2. Seis fallos reproducidos (2473 exit 1,
  2008.265696 ms), ahora seis PASS (99043 exit 0, 1693.615464 ms).
  Respuesta/recibo atómicos; cierre durable explícito, desconocido bloquea.
  Ampliación 77730 cerró: 35 PASS, cero FAIL, 9381.048406 ms, doce SIGKILL reales.
  Dos casos adicionales de salida de proceso negativa reproducidos y reparados;
  categoría de espera del test corregida, bloqueo conservado. Global KrAomV/84272
  interrumpida por lanzamiento prematuro, no PASS. Nueva global aprobada arriba.
  **d6f/nmUPLE/j4OB9h no cubren este cambio.**
  87010 cerró 01:14:13.326:
  [j4OB9h](PRODUCER-RESPONSE-RESULTS.md), tres llamadas reales/45.228 tokens;
  respuesta recuperada tras SIGKILL con el mismo productor, juez independiente
  ACCEPT y tercer proceso sin replay. Auditoría 01:14:27.327: tres owners ausentes,
  305+3 pins, doce usos de citas, recibos/cierres/reservas y SQLite íntegros.
  Alcance workers, nodo fijo conocido; misión NEW, no engine.run/plan real.
- 71098 cerró: `suite-nmUPLE`, 1487 tests, 1486 PASS, cero FAIL, un SKIP;
  354373.434722 ms, cierre 01:04:51.355. Auditoría 01:07:07.138:
  305 inputs, cuatro streams, comandos concordantes y owner ausente.
  Freeze `d6f5dd473dd0c295e1df072076c4cc7dbd25b936213fd9b0085287ab71f25fbf`,
  424 archivos, 24.139.333 bytes. **No instalado**; j4OB9h cualifica el final ordinario.
- Cerró 64416: integración de seis archivos tras construir
  [persistencia del final del productor](../design/PRODUCER-RESPONSE-DURABILITY.md).
  26 pruebas dirigidas PASS, incluidos cinco SIGKILL reales y recuperación por
  el coordinador sin repetir productor; modelos simulados. Dos fallos originales
  y dos regresiones de rechazo reproducidos y corregidos. Integración: 318 tests,
  318 PASS, cero FAIL, exit 0; 79531.913454 ms. Recuento observado en terminal,
  no se conservó el stream completo de esa integración. Global aprobada arriba;
  ensayo real j4OB9h aprobado arriba. **5aa/6l7Jfp/fD2w4s son anteriores y no la cubren.**
- `suite-6l7Jfp` / 65337 cerró
  00:28:08.021: 1459 tests, 1458 PASS, cero FAIL, un SKIP; 317188.279438 ms.
  Auditoría 00:29:40.427: 301 inputs, cuatro streams y owner ausente.
  Dos archivos modificados después de 4KDODc:
  cliente de Codex y sus tests, para impedir atribuir eventos tardíos a otra
  inferencia. Tres defectos reproducidos antes del cambio; proveedor 48 PASS,
  cero FAIL, un SKIP. [Diseño y evidencia](../design/PROVIDER-EVENT-BOUNDARY.md).
  **4KDODc/08fe NO cubre esta reparación posterior.** Ensayo real fD2w4s / 84808
  cerrado 00:30:28.720: dos llamadas, 7.062 tokens, respuestas y threads distintos,
  cierre confirmado. Auditoría 00:32:08.846 íntegra. No instalado ni pooling.
- [Diagnóstico de costes](../design/COST-DECOMPOSITION-2026-09-14.md): cuatro
  capturas reales descompuestas y 154 fichas medidas sin pérdida. Los nuevos
  codecs no se incorporan: reducción de bytes limitada, no ahorro de tokens probado.
- [Recuperación real PRFwPC](FAILURE-RECOVERY-RESULTS.md)
  cerró 13 septiembre 23:59:16.789 / 69561 exit 0: cuatro llamadas reales,
  67.787 tokens, progreso tras SIGKILL/ENOENT, candidato correcto y juez separado.
  Auditoría 00:00:16.463: veinte usos de citas, reservas, recibos, cierre y DB íntegros.
  Es cualificación de workers con fallo/input controlados, **no engine.run completo**.
- Global `suite-4KDODc` cerró
  23:38:16.237 / 34954 exit 0: **1448 tests, 1447 PASS, cero FAIL, un SKIP**,
  535639.237211 ms. Auditoría 23:39:15.548: owner ausente, 301 entradas y
  cuatro streams concordantes. [Cierre](runs/suite-4KDODc/post-close-audit.json).
  [Compatibilidad de copia histórica](UPGRADE-COMPATIBILITY-RESULTS.md) aprobada:
  xKgKjB cerró 23:43:29.061 / 52097 exit 0; tres procesos antiguo→nuevo→antiguo,
  155 versiones originales conservadas, cero inferencias/efectos, original intacto.
  No demuestra todas las misiones activas ni supone instalación.
- `mission-budget-live-8lANly` cerró
  23:05:48.955 / 82758 exit 0; auditoría sólo lectura 23:08:57.158 íntegra.
  Tres llamadas reales, 26.008 tokens, cuatro usos de citas contrastados,
  dos reaperturas desde procesos distintos sin nuevas llamadas.
- NUEVO después de esa auditoría: reparación del historial de fallos de productor.
  Dos defectos reproducidos antes de corregir; 11 tests dirigidos PASS,
  1155.695098 ms / 31952 exit 0. Integración de siete archivos: 302 PASS,
  98267.780168 ms / 92113 exit 0. Tres SIGKILL reales: 3 PASS,
  2492.657677 ms / 31329 exit 0. Global 4KDODc aprobada, nuevo freeze 08fe3086.
  **R62Cdt/de4dd816 NO cubren este cambio posterior.** No instalación.
- Núcleo instalado anterior: `10bbffa0e97b63c0246ab338857987943a89d285cff137b65e0a91a0d041a7c4`.
  Fue sustituido por efbdb0e9 después de reconciliarlo inactivo y conservar backup;
  el checkpoint 09:24 del día 13 es histórico, no la observación actual.
- Freeze histórico anterior: `5aa542cf33e7e0d7a382335c55a9a1f183451d2cde28b995ae21198aa6727421`.
  423 archivos, 24.125.726 bytes. **No instalado**; fD2w4s cualifica el transporte.
  PRFwPC usó el freeze previo 08fe3086 y cualifica sólo la recuperación
  controlada de workers y revisión, no todos los recorridos de esta versión.
  El ensayo 8lANly usó el freeze anterior de4dd816, 422 archivos/24.120.001 bytes.
- Global `suite-R62Cdt` cerrada 22:52:20.271 UTC, sesión 31527 exit 0:
  **1.434 tests, 1.433 PASS, cero FAIL, un SKIP**, 530754.774246 ms.
  Auditoría 22:53:38.505: propietario ausente; 298 entradas, comandos y cuatro
  streams concordantes. [Prueba de cierre](runs/suite-R62Cdt/post-close-audit.json).
- No se han creado misiones ordinarias, publicado GitHub, comprado créditos ni
  cambiado de modelo para obtener una etiqueta de éxito. Sí se detuvo/arrancó
  el servicio durante la actualización controlada y auditada del día 14.

## Cambio recién construido y alcance real

[Presupuesto compartido de inferencias](../design/MISSION-INFERENCE-BUDGET.md):
opción explícita `mission-calls-v1` / `--mission-call-limit N`, 1–1000 reservas
lógicas por misión, compartidas por entrada, plan, productor, jueces, réplicas y
`source.search`. Reserva atómica antes del despacho; sin devolución después del
commit, timeout o caída. `continue` no restablece el techo. Agotamiento devuelve
`NEEDS_DIRECTION`/cola `WAITING`, conserva candidatos y no penaliza calidad.

43 pruebas específicas más integración de motor, CLI y réplica ciega; nueve
archivos cerraron 433 PASS antes de la global. Se probaron cuatro SIGKILL reales,
competencia entre dos procesos y lectura tras reapertura SQLite. Modelos
simulados. [Ensayo real de presupuesto](MISSION-BUDGET-RESULTS.md) ya cerrado:
bloqueo antes de revisión con techo 1, entrega aceptada con techo 2, sin transferir
respuestas entre brazos; no ahorro general demostrado. Los dos contraejemplos inicialmente rojos y sus correcciones
permanecen documentados. No cambia el preset ni el servicio instalado.

[Límites operativos visibles](../design/PLANNING-OPERATION-LIMITS.md): el opt-in
`read-test-v1` comunica límites de pasos, operaciones y lotes antes de producir.
También advierte el riesgo observado del reporter Node bajo aislamiento. No
relaja permisos, no inventa TAP y no garantiza que el productor utilice el lote.
El cursor read-test del productor se implementó y cualificó posteriormente en
926c524d, con el alcance acotado descrito arriba. Reutilización de threads sigue
**sin implementar**; la persistencia del final ordinario no equivale a ella.

## Ensayo real de desarrollo anterior: resultado mixto, conservado

[UYEoVL](READ-TEST-DEVELOPMENT-LIVE-UYEoVL.md) cerró 21:46:09.429 UTC, exit 2:
producto COMPLETED/ACCEPT con 12 inferencias reales y 475.172 tokens observados;
16 criterios aprobados, oracle externo de 3.193 casos y reentrada sin replay.
**Cualificación `read-test-v1` FALLIDA:** no se ejecutó ningún lote read+test.
No se repetirá ese brazo ni cambiarán sus criterios para convertirlo en PASS.

Auditoría posterior de producto reconcilió 294 entradas, 12 capturas/limpiezas,
108 usos literales de citas, tres trabajos de ejecución, oracle, linaje y DB
intacta. Es un caso conocido, no holdout ni demostración de eficiencia general.
Su runtime `c31b7223…` tampoco se instaló. Los fallos anteriores `geTKWd`,
`yIc6GW`, `bckJet`, `XrlCqq` y las discrepancias de jueces permanecen históricos;
los cambios posteriores no los rehabilitan.

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
| R11, aprendizaje | Propuesta real, ocho comparaciones, rechazo por falta de mejora, promoción/rollback probados | Mejora y promoción reales todavía no demostradas; no fabricar un overlay exitoso |
| R12, especialistas | Dos fichas autónomas justificadas y ejecutadas; soporte instalado en 10bbffa0 | Medición de valor frente a facetas existentes y generalización |
| R13, suscripciones | Codex App Server oficial con ChatGPT y recibos reales, sin API fallback | No afirmar otras suscripciones no configuradas |
| R14, persistencia | SQLite, ownership/fencing, cuota/cancelación/efectos inciertos y caídas de procesos | Ensayo prolongado real, caída OS y cierre de sesiones; 30 muestras/26 saludables/4 fallidas no prueban uptime continuo |
| R15, investigación | Comparativas primarias y contraejemplos ejecutados; [decisiones](../design/RESEARCH-DECISIONS.md) | Evaluar recomendaciones antes de convertirlas en garantías |
| R16, integración | Núcleo b7cb510c instalado tras regresión, compatibilidad y lectura/revisión reales acotadas, backup y auditoría de preservación; skill, CLI y servicio comprobados | Calibración, eficiencia proporcional y operación prolongada pendientes. Instalación no es cierre del mandato; 68fae338 permanece fallido |

## Siguiente trabajo autorizado

1. Investigar costes observados sin perder contexto/evidencia ni mezclar productor
   y juez; no equiparar 67.787 tokens en un caso pequeño con eficiencia óptima.
2. Ampliar cualificación operativa donde falta; una copia histórica sin archivos
   compatible no basta para certificar todos los estados activos.
3. Continuar cerrando las obligaciones del mandato; no instalar cambios sólo por
   una batería aprobada ni equiparar límites de gasto con inteligencia/eficiencia.

No repetir la auditoría del servicio de 05:07 dentro de este mismo turno sólo
para obtener otra muestra. No abrir bases históricas cerradas con herramientas
que puedan escribir; usar copias cuando el diagnóstico lo requiera.

## Historial preservado

El registro previo completo está en
[STATUS-HISTORY-2026-09-13-2244.md](STATUS-HISTORY-2026-09-13-2244.md):
3.225 líneas, 232.612 bytes, SHA-256
`20a5cb3bebbda0b24d695663e5f277a0a63192c03433da90aaa2f57a06bba351`.
Movimiento sin cambio de bytes verificado el 13 septiembre 22:54 UTC; no se borró
ningún resultado. Sus estados y sesiones son históricos, no órdenes para reabrirlos.
Mantener este documento compacto; detalle experimental en informes específicos.
