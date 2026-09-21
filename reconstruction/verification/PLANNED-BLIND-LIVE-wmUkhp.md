# Cualificación integrada wmUkhp

## Contrato fijado antes de ejecutar

Una misión aislada desde la petición completa, por suscripción oficial ChatGPT,
gpt-6-astra/ultra, sin herramientas ni efectos. Inicio 2026-09-12T15:06:34.813Z.
Misión `mission:38c9896a-e45c-4b5d-94d7-cecad1de43ba`; registros en
`runs/planned-blind-live-wmUkhp`. Techo prospectivo de 24 llamadas, cuatro
propuestas y cuatro intentos por nodo; no autoriza repetir una réplica sellada.
Runtime congelado
`4b31034bb20072b06615085f4611bce6f5caed9d3a07befc462684c2c815c7df`,
394 archivos/23.806.559 bytes, no instalado.

Harness SHA-256:
`7514792ece728a6c483f01cf7d8edb4e95d3d8a3b008ad3e7fbf3a0e04758f78`.
Helper de aceptación:
`1d6eb4fbe132f511f6b3022893d52420c88538e880da336b57b99a6b31a1b07a`.
No editar ninguno ni el runtime durante el ensayo. La petición, política,
oráculo externo y manifiesto completos están en `qualification.json`.

Matriz conocida `[[2,1,3],[0,4,5],[1,-2,6]]`; original literal `62`.
El oráculo externo enumera seis permutaciones y obtiene 61, distancia 1,
MISMATCH con tolerancia 0/unidad adimensional. No se envía ese oráculo a los
modelos. Esta matriz ya se usó para diagnosticar defectos: no es un holdout,
calibración amplia ni prueba de superioridad. No rehabilita rB9KdY/xMileM.

Las correcciones prospectivas del harness están documentadas antes del lanzamiento:
acepta una convergencia final sólo si consume por referencias reales el informe
aceptado exacto, y exige conservar residuales completos en vez de eliminarlos.
No cambia criterios de revisión, tolerancia, regla, original ni respuesta sellada.
La compatibilidad histórica se verificó sin modificar las bases anteriores.

Regresión previa: suite-6gbyYo, 706 pruebas/705 PASS/0 FAIL/1 SKIP, 231,56 s.
201 inputs, conjunto completo y hashes de salidas coincidentes a las
15:06:23.414 UTC. Sin cambios de código entre esa comprobación y el lanzamiento.

## Lectura durante ejecución — 15:22 UTC

Primer candidato de plan `artifact:2950bb97-e140-4b89-9a08-004d5782775f`,
payload `8482e3958103dd488a66ad52f148aea8acfc127abb558c024694a319ca70207f`,
creado 15:18:18.882. Revisor `run:77286194-d344-4322-803a-dcd2a9f50198`
en curso: todavía no hay aprobación ni productos ejecutados.

Propone original → protocolo → réplica → comparación nativa final. El primer
producto preserva el literal, sin certificarlo como correcto. El protocolo
depende del original real para su revisión, pero el enlace a la réplica es
privado. La revisión material del intento precede a la apertura y comparación.
El final incorpora los cinco gates fijos y 23 criterios de requisitos, incluidos
los controles runtime; no agrega una síntesis duplicada. La carta suplementaria
del protocolo aporta cofactores/Sarrus sin calcular una respuesta anticipada.
Ese orden responde a las condiciones explícitas de este ensayo, no es una
cadena obligatoria para toda petición de la fábrica.

La lectura final debe comprobar el protocolo completo realmente emitido, los
controles realmente asignados, cada operación/argumento del intento y todos los
juicios con sus citas. La corrección de un plan no demuestra por sí sola su
ejecución ni la calidad de los resultados. No basta el booleano del harness.

## Primera revisión — 15:23:08.603 UTC

RETURN `review:6e9170bc-8a07-4c82-a94e-19d21dbb608f`, registro
`16fc0d7d2f9dc55bb2362d0750dedfd8bb429d976c0ed82b68aef0a4147e9e67`.
Leídos íntegramente los cinco checks, citas, finding y límites. Tres PASS;
capability-fit y acceptance FAIL por la asignación del original a omega_23:
su ficha prescribe un dossier jerárquico, mientras el nodo exige sólo el literal.
No se considera que la concordancia numérica o la fidelidad permitan ignorar
esa frontera. El juez pide capacidad compatible o especialista autónomo completo,
con el original y su revisión independientes intactos. No pide otra réplica.

El plan, incluidos sus 22 requisitos/23 criterios, pasó también la validación
estructural en lectura; no hay citas inventadas ni cambio del pedido. El rechazo
material es distinto de un fallo de esquema. La segunda propuesta se inició
automáticamente con el feedback persistido, run
`run:d66c4636-fa45-4cd4-ad1b-6c7584850b2b`. No se ha intervenido en sus entradas.

Primer productor: 32.254 tokens observados (20.521 entrada/11.733 salida),
15:06:35.213–15:18:18.833. Primer juez: 38.059 (28.754/9.305), completado
15:23:08.547. Total parcial 70.313; no es eficiencia satisfactoria demostrada.
No atribuir a una reducción de nodos un ahorro causal antes de contar rechazos,
replanificación y calidad observada. La vía automática de corrección está activa,
no se salta el rechazo para conseguir una aceptación.

## Preflight de activación en lectura — 15:23:34

Segunda propuesta producida 15:27:35.622, candidato
`artifact:9a2dfe4d-97ae-42d4-8b0b-73c94fc33c9a`, payload
`789f1d45ab25442fe92411230f320b71a3a9b94360c9e52117ca51aed2bf3a6a`.
La comparación entre propuestas confirma identidad de los 22 requisitos y
de todos los criterios por nodo. Mantiene cuatro nodos, sin herramientas ni
efectos. Leídos instrucciones, alternativas y cartas: sustituye omega_23 por
un especialista autónomo de transcripción literal con falsificador exacto,
y aclara controles/retornos sin cambiar original, regla ni alcance. Revisión
`run:e8633193-d887-41bd-a986-3011476d2df7` pendiente; no se atribuye ACCEPT.

Revisión terminada 15:31:42.583: ACCEPT
`review:b62b42e5-cd99-4887-ae74-09102bf8df27`, hash de registro
`ab28bd1264048c377d83222096d69cb66b958895a799f1fb2e8b2d6641d7d271`.
Los cinco checks/citas y límites se leyeron íntegros: PASS pertinentes al plan,
sin findings ni aceptación de productos futuros. Se inició el productor del
original `run:fd538222-e7ce-45bd-90af-68bb92a1c986`; misión RUNNING.

Paquete 4b31034b íntegro y 57 archivos runtime de código/datos coincidentes con
la regresión, ninguno fuera del corte probado. Diecinueve archivos cambian
respecto a 10bbffa0. La cola ordinaria sólo contiene 78afdee6 COMPLETED;
servicio enabled/active, PID 989536/cgroup canónico, cero reinicios. Wrapper
`14e2e0604f715472c241a244701b5ed03e3fa3750e3c11290e88839060242781`
y unidad `b454ef141c74cc8d20bee111e1dee466674ba0836d7fa45622f039fdc006be78`
siguen apuntando a la release previa. No se copiaron ni activaron entrypoints.
La activación deberá reconciliar nuevamente cola/configuración y conservar
rollback; estas lecturas no sustituyen un resultado cualificado ni otro segmento
del observador. No se creó una muestra de servicio adicional.

15:29:41.281: paquete idéntico preparado en
`/home/cardeex/.local/share/sovereign-factory/releases/4b31034bb20072b06615085f4611bce6f5caed9d3a07befc462684c2c815c7df`,
con 394 archivos/23.806.559 bytes y verificación de identidad completa.
No activado: wrapper, unidad y PID conservan 10bbffa0. Su CLI devuelve 154
roles únicos; doctor confirma proveedor oficial 0.153.4, autenticación ChatGPT,
Astra/ultra disponible y ejecutor snapshot-discard sin red. Doctor sólo consultó
metadatos y cerró su proveedor; no es una inferencia ni un ensayo del ejecutor.

## Productos observados — 15:44 UTC

Original `artifact:b5c1bfee-7d68-46a6-95e4-f3d193a8de4a`, payload
`03502896e1f1da199592493c6a1ce6613213442b9141f327242bc6b37e9e9704`:
cuerpo exacto `62`, sin claims, con referencia al plan aceptado. ACCEPT de
fidelidad `review:216cbacd-7085-4cd6-b268-c6d689043e08`, 15:32:14.895;
registro `3abf5a36b11b9438b188985a786246e5f184d523f9ae1e65aab1e8294ca9540a`.
Se leyeron cuerpo, criterio, cita y razón completos. No acepta verdad matemática.

Protocolo `artifact:d9d3668c-8804-4ac2-9e23-1524c28631c9`, payload
`4550e939212d9dc5af02cd5ad91ffd46ca5713878d8789b9464da0011217c66e`.
Leído íntegro, incluidas sus secciones privadas y públicas. Contiene matriz
completa, expansión correcta por cofactores y Sarrus, sin resultado anticipado.
Seis controles propios, con observaciones y PASS/FAIL/UNKNOWN: entradas, signos,
cofactores, Sarrus, concordancia y trazabilidad. Aprobación, exposición ajena,
sellado, juicio y apertura quedan expresamente fuera de esos controles.
Tolerancia y unidad estructuradas coinciden exactamente con el contrato.

ACCEPT `review:36004e96-5838-4440-85f3-da47dc773c22`, 15:43:03.241;
registro `f3b8f258717dc7392b15a1b5821f7a7c379c64145bf549469b17744cd9f8ed3d`.
Juez `run:a5118b45-3b9a-43dd-86cd-cf0b4531c74e`, los cinco checks/citas,
razones y límites leídos completos. Cita original y plan realmente observados,
los cálculos prescritos y el orden; no se presenta esa aprobación como réplica.

Observación del coordinador al leer el protocolo, antes de consultar cualquier
respuesta de réplica: `stopping` usa etiquetas CALCULADO/DEVUELTO, mientras el
formato nativo exige RESULT/UNKNOWN y resultado vacío en UNKNOWN. Se deberá
comprobar cómo la respuesta real conserva ese significado sin violar el formato
fijado. No se han editado protocolo, instrucciones ni schema del ensayo y no se
presupone que la correspondencia esté resuelta por el ACCEPT del protocolo.

## Pendiente tras esos productos

Resultado, auditoría material completa, coste observado y prueba de reentrada.
No hay autorización de despliegue derivada de un estado RUNNING, ni cambio de
la cola ordinaria, ni checkpoint nuevo del observador. R01–R16 no está cerrado.

## Intento y apertura — lectura 15:52 UTC

La única réplica terminó 15:44:36.468, run
`run:3cf8d04f-a48e-4ddf-babb-f208191893ff`, 13.253 tokens observados.
Sello de registro
`1cd1e3c4448b8409a35d3b77516206d98b365cbdb1104e97a521a2fac483a827`;
solicitud de contexto
`a2e90688b0898fe217977e3db11f3c6120804f1cff8582378aba169b84f129cf`.
Se leyó la respuesta sellada completa: RESULT, decimal `61`, seis controles
PASS con sus observaciones, una declaración de ausencia de desviaciones
detectadas y tres desconocidos externos conservados. No equivale a tres fallos
matemáticos: el participante no acredita actuaciones privadas del controlador,
eventos posteriores ni contenido del original que no recibió.

Auditoría de las operaciones: coteja las nueve entradas, forma correctamente
los menores; productos/diferencias 24−(−10)=34, 0−5=−5, 0−4=−4;
ponderaciones 68, 5, −12 y suma 61. Sarrus expone sus seis ternas:
48+5+0=53; 12−20+0=−8; 53−(−8)=61. No hay redondeo ni ajuste al original.
Las dos formulaciones comparten calculista y premisas, tal como reconoce.
La duda sobre etiquetas queda resuelta en esta respuesta concreta: el campo
nativo es RESULT y el argumento empieza `Estado: CALCULADO. Resultado propuesto,
no aceptación independiente.` Se cumplen ambos contratos sin editar ninguno;
no se infiere de ello que toda futura respuesta manejará bien esa correspondencia.

Material `artifact:c41534ce-e8b3-4900-adb9-0a4b2ecaaa45`, payload
`abcb58b564e0ac833f0533b2b117b2b558c883fdab7104fc774d1b9419b610a0`.
ACCEPT `review:08b281b0-b47e-46cd-b5bf-385ed37e498d`, 15:49:22.455;
registro `7d35d0b7fbb40ce54fbe430342b4ab50131fe305b44ced16b5375e553d8b162d`.
Los cinco checks, sus razones, citas y límites fueron leídos completos. El juez
recomprueba las operaciones y cada control, distingue evidencia pública de
aprobaciones privadas y mantiene la incertidumbre del decodificador de contextos
ordinarios, contrastando la solicitud cerrada realmente expuesta.

Orden del registro: freeze 503 < solicitud 512 < término 517 < sello 518;
juez material completado 594 < revisión 600 < material aceptado 601 < apertura
609 < comparador nativo 612 < candidato 613 < vínculo 614. Informe candidato
`artifact:5d81cb75-fb75-4ea9-bda1-960fe223a7d8`, payload
`f242b19a88350d9ba66d5c0f6bd768859dfb35c565fb35d91c4ca77e5ea840f5`:
62 frente a 61, distancia 1, tolerancia 0, MISMATCH; conserva la respuesta y
residuales, `replicationEstablished=false`. Se revisa ahora, no está aceptado.

La observación final `runtime-observation:11dc8357-e614-4cf5-b96c-2a43c9ae55be`
incluye la aprobación histórica real, con original observado 306 < juez previo
490 < revisión 496 < protocolo aceptado 497 < freeze 503 < solicitud 512.
Es evidencia separada sólo tras apertura; no se insertó en el protocolo público
ni en la réplica ni en su juez. Su revisión final de 28 criterios sigue pendiente.

## Resultado terminal: NO aprobado — 15:56:31.411 UTC

RETURN `review:b43c58ba-89c8-49c1-b892-84b981c97e88`, registro
`d6b2ef95b262abb32e41a4dd1fd36b159e0ccdc60f9a0188d1f2ded78c23244a`.
Lectura final completa de los 28 checks, razones, citas, finding y límites:
27 PASS y UNKNOWN en `req.closed_exposure.bilateral_recorded_nonexposure`.
El juez distingue correctamente aprobación previa del protocolo de exposición
de la réplica y su juez material. La observación de producción del comparador
tampoco acredita esos dos participantes. No diagnostica contaminación ni un
fallo de aritmética; devuelve por evidencia bilateral no suministrada al gate.

Misión NEEDS_DIRECTION, informe RETURNED y final ausente. Once inferencias
reales completadas, 372.388 tokens totales observados, de ellos 294.659 de
entrada y 77.729 de salida; 46.976 de entrada en caché, ya incluidos en entrada,
no sumar otra vez. Ninguna corrección inline, dos propuestas y dos juicios de
plan; una sola réplica. No demuestra eficiencia satisfactoria ni calibración.
El harness mantiene sus checks fallidos, incluido noReplay, porque no alcanzó
el final al que se aplicaría esa comprobación. No se reinterpreta como un pase.

Lectura coherente 16:02:49.493: journal 731,
`020471fcdbabacfa9186abef75deea070bb8f14eb4e8f9805be31d424b93b03a`;
recordsHash `c03cc8a16970962b5749bd6325ec8b00948bed64e9c16d634b8c302b283dd50f`;
headsHash `01c71cea2296d172899002ec919e2c812228d0b5f5ddc037501079b748aba0cc`;
summaryHash `390824c645cac5534eeb79325a5c73ee4f8ed640eb088293d0b3993e3a143ba9`.
La consulta no cambió esos registros. No activar 4b31034b: la instalación anterior
continúa intacta y el preflight de activación queda sin ejecutar.

## Corrección posterior, separada del ensayo

Tres regresiones reprodujeron la falta de exposición. Se añade en desarrollo
una proyección posterior a apertura de las versiones exactas de ambos actores,
contextos, solicitudes públicas realmente retenidas, recibos y revisión material.
Se preserva UNKNOWN cuando una aprobación sintética carece de solicitud retenida;
RECORDED describe cobertura, no una garantía semántica. El cuerpo del informe
no cambia. Cinco tests dirigidos posteriores PASS; regresión ampliada en curso.
Dos fallos intermedios eran repetición sintética del inventario entero en cada
cita del fixture: se citaron pasajes exactos sin reducir la evidencia recibida
ni elevar el presupuesto real de salida.

Contraste read-only sobre esta base: proyección nueva de 208.696 bytes, solicitudes
completas de réplica y juez, una cada uno; términos 517/594 anteriores a apertura
609, cobertura RECORDED. La observación antigua sigue válida SIN ese campo: no
se atribuye al juez histórico conocimiento que no recibió. Esto es comprobación
del adaptador, no nueva aprobación. No se ha reanudado la misión, repetido el
intento ni hecho una nueva votación.
