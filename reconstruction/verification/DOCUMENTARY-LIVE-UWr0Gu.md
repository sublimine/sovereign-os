# Ensayo documental UWr0Gu — cerrado fallido

## Cierre y auditoría — 13 septiembre, 09:48 UTC

Terminó08:53:42.871, **FAILED/TIMEOUT**, sesión47970exit2 y propietario2000926
ausente. Nueve llamadas enviadas, ocho completadas reales y una sin recibo.
170.099 tokens observados en las completadas; consumo del timeout desconocido,
no cero. ResumenSHA6fcda461b556c8adac473844471f24ed952437c217060fd60494d0c3fdcc243c.
09:25:20.335: los270pins/freeze0695b9a4 originales seguían íntegros antes de
editar desarrollo. No se recupera ni reescribe este brazo. Los cortes siguientes
que dicen «en curso» son históricos, no su estado actual.

El plan fue aceptado en su primer intento: llamada1 terminó08:35:27.117,
26.336tokens, cinco criteriosPASS/24referencias/diez citas únicas, leídas
íntegramente y comprobadas contra el cuerpo exacto en esta auditoría.
La composición omega_11/veritas_06+omega_22 fue juzgada
compatible para este alcance; no certifica todos sus métodos en otros encargos.

Productor `run:8f33ff05-c3c9-4934-9a09-e5144c12a1c1`: seis llamadas reales,
116.143tokens,08:35:27.413→08:38:00.323. Orden observado:
batch de las dos adquisiciones → localizar SQLite → leer6000B desde1433000 →
localizar PostgreSQL → leer5000B desde17600 → candidato con cuatro hechos y
cinco apoyos literales. Las fuentes son las dosURL pedidas; los rangos fueron
seleccionados por el productor, no dados de antemano por el operador.

Fuentes guardadas y recibos HTTP200/trazas completas verificados readOnly:

- SQLite:08:35:35.993,2033807B,
  SHAa6d38ca170dff62177e74e63297b44e567f673e7d2111de923e33b481560c140;
  reciboSHAfdb1ae5378585d9d98746184f350d26b590c3ef8e58005b74d4b32f336882fd3.
- PostgreSQL:08:35:36.758,23119B,
  SHA71f20a96952c16dca637c3e9135dded2d78e73f32c375d9c9b1199730a0271f5;
  reciboSHAfcf85779ccd7703c2742726569fa006527a9356a4ea4dc1d95955c048f0a7e4b.

Candidato `artifact:a237ff4e-4864-4a05-a10e-80a7f0e2d266`,
SHA1f1e92dcef5f80f0c5a92789e61b4f978ee1d8a0f77a64fa5c2d6d660d686480.
Ambos motores:removed/equal; scope documented-only; citas de NULL literales.
`validateDocumentClaims` verifica las cinco referencias contra las ventanas y
solicitud propia. El oráculo de contenido sobre el candidato pasa
DOCUMENTED_DISTINCT **sólo como diagnóstico posterior**, no como entrega ni
revisión que el ensayo hubiera completado. Metadatos de independencia de
origen siguen rootAssessmentUNKNOWN; dos dominios no certifican corroboración.

Base original auditada query_only/readOnly sin cambiar journal496:
`aa414964434fa3982cd1cb05832074f9f730d78ad746a724bbcbdc1b0d81f3d5`.
Sólo existe la revisión del plan; cero revisiones factuales comprometidas.

### Defecto reproducido en la frontera de revisión

Primera solicitud del juez, llamada8, `run:7bd853c0-6822-4292-8ad3-69982f6aabd7`,
hash52abacc8fd41d8a556177ad5c810ce2a110615690f6b047bee83fd8844615966:
08:38:41.752→08:53:41.756,900004ms. Entrada97247B, instrucciones23806B,
esquema7146B; dos grants propios, cero ventanas y cero operaciones locales.
Las instrucciones de action=document exigían checks=[] mientras el esquema
compartido imponía minItems=maxItems=11. Por tanto la navegación instruida era
imposible de representar válidamente. No era necesario prejuzgar las fuentes;
el contrato de salida estaba contradiciendo el orden correcto.

El cliente registra177 progresos,30082B de salida parcial y7722946B de protocolo,
sin mensaje completado, recibo de uso ni juicio. No hubo error remoto tipado.
El TIMEOUT es el límite local900000ms, no prueba de caída remota. La
[documentación oficial App Server](https://learn.chatgpt.com/docs/app-server)
distingue eventos de progreso y finalización de turno; los bytes parciales no
son un resultado completado. El defecto del esquema es demostrado; atribuir
**toda** la duración a él sigue siendo hipótesis hasta el ensayo corregido.
No se buscan ni guardan razonamientos privados ni texto parcial fuera del contrato.

### Corrección y pruebas

`documentReviewSchema` conserva el contrato base y fija minItems=0 sólo en el
contenedor documental compartido. maxItems e IDs no cambian. Descripciones
separan navegación inactiva de juicio completo. Antes de operar se exige
resultado inactivo exacto; antes de revisión se exigen todos los IDs una vez,
además de las pruebas originales y runtime. No se bajó ningún criterio final.

El simulador ahora comprueba recursivamente minItems/maxItems de la gramática
enviada **antes** de llamar al validador del worker. PrimeroROJO: sesión91320,
1test/1FAIL,1150.923432ms, `$.result.checks violates wire minItems=1`.
DespuésVERDE: sesión17137,38/38PASS,110957.416072ms. Incluye0/11criterios,
rechazo de finales vacíos/parciales/duplicados y de juicio oculto en navegación.
Modelos/HTTP son sintéticos; almacenamiento y validaciones son reales.

### Siguiente ensayo prerregistrado: copia del candidato, sólo revisión

`documentary-review-retest.mjs` crea un directorio nuevo y copia exacta del
SQLite cerrado/sinWAL pendiente tras verificar propietario muerto. Conserva
todos los heads históricos salvo el estado de aceptación del candidato en la
**copia**; conserva payload, plan, misión/política, adquisiciones y fallo viejo.
No ejecuta engine.run, planificador, productor ni broker de efectos. El juez
nuevo mantiene veritas_06+omega_22, contexto íntegro y ventanas/grants propios.
Máximo seis llamadas nuevas incluyendo navegación/correcciones, Astra/ultra
por suscripción; límites por llamada y reparaciones de producción no aumentan.
Se retienen salida/recibo antes de validación, fallos y uso desconocido.

La cualificación del runtime/suite y huella de la base original se registran
antes de la primera llamada y se verifican en cada frontera. Un posibleACCEPT
en la copia no cambia FAILED de la misión original ni demuestra recuperación
operativa, entrega o eficiencia global. Las expectativas SQL no entran al juez.
Cinco tests de harnessPASS en sesión4097/4549.877068ms: aceptación,timeout,
techo,juicio parcial y pérdida de freeze; originales y efectos permanecen.
La primera prueba del harness falló por buscar roles enrun en vez deworker-config;
corregido antes de inferencia real (sesión14857:5FAIL, cero llamadas reales).
Regresión completa nueva lanzada después de esos cambios; no retest real hasta
su cierre/verificación y freeze nuevo. No reescribir este ensayo como aprobado.

### Cualificación posterior y lanzamiento del diagnóstico

SuitexXVzSB cerrada09:51:51.919, sesión50474exit0/owner2015683 ausente;
1040tests/1039PASS/ceroFAIL/unSKIP,312915.477815ms. Inicio09:46:38.909.
ResumenSHAc2b41de739761f5d1ac2bb2476bbfad515703fdb9ed50200dc81327d2c828ce4.
Auditoría09:53:50.270:271inputs/start/summary/streams parciales-finales íntegros.
09:54:03.454:inventario y76runtime pins contra freeze nuevo verificados.
Release639c5597ca0b3a6e9639a7eb437a7ae81c046e6cfafebfd875f50bf827e22cdf,
413archivos/23995939B; no instalada.

Diagnóstico nuevo `runs/documentary-review-KZ6Aeb`, sesión78538, lanzado09:54.
No modificar271inputs antes de reconciliar. No duplicar ni transformar este
diagnóstico en recuperación del original. Primera cualificación y propietario
se guardan antes de llamar al proveedor; comprobar archivos, no inferir avance
por un proceso vivo. Resultado y semántica siguen pendientes.

KZ6Aeb cualificado09:54:37.016/PID2020361,
boot2a077981-8aea-444e-8eff-44fa69814267/startTicks47720793.
Huella binaria originalc82a6e118d4c30d0210ad59353cdb79d2f752ab3bdcf47ffb77b02f40da476ff,
journal496 intacto. Nuevo actor `run:a5c1b437-2e3c-47af-a4f6-9deba425d757`.
Primera solicitud61fb9c86a65f8a106c909e3f055e751070c360f6b098dc1a60daa358a18467e5,
09:54:43.057→09:54:58.747,41090tokens reales. Devuelve action=document,
source.read SQLite desde1430000/14000B, resultadoUNKNOWN/checks=[] inactivo;
565B completados. Es una navegación válida, no un juicio o aceptación.
Comparar16s contra900s es descriptivo de estas llamadas, no ahorro causal global.

## Registro histórico de inicio

13 septiembre2026. Retest **conocido**, noholdout ni entrega del mandato.
No modifica ni recupera ZxHWcv/spVGwI. Prerregistro y fallo que motiva la
intervención: [ZxHWcv](DOCUMENTARY-LIVE-ZxHWcv.md).

## Inicio y versiones fijadas

- Directorio `runs/documentary-live-UWr0Gu`, brazo `distinct-literal-windows-v1`.
- Inicio global08:28:12.537; brazo08:28:12.683.
- Sesión47970; PID2000926; boot2a077981-8aea-444e-8eff-44fa69814267;
  startTicks47204238. Reconciliar esta identidad antes de actuar.
- Misión `mission:448ad8d9-94fb-4c56-9bd1-282c6cccfeb1`.
- Release `0695b9a46c7dfd5728f365ccb69e463ea99f9f326a344628b683093c4ed3b289`,
  verificada413archivos/23994623B; no instalada.
- Suite9jHXe7:08:22:12.475→08:27:26.204; sesión57500exit0/owner1996584
  ausente;1029tests/1028PASS/ceroFAIL/unSKIP. Duración313540.485775ms.
  ResumenSHA `1f333aac3610d7c48fdd66f0f59b0b17d168a380c876f73d0dab9705d05444d9`.
  Auditoría08:27:56.176:270inputs/76runtime, capturas y streams parciales/finales
  coincidentes, inventario actual y freeze verificados. ÚnicoSKIP: smoke real
  de suscripción deshabilitado explícitamente; no se simuló aislamiento nativo.

No editar los270inputs de código/tests/harness/viz/casos/oráculos hasta cierre.
La cualificación se repite antes de inferencias/efectos dentro del harness.
No duplicar llamadas por ausencia temporal de salida de consola.

## Intervención y constantes

Exponer desde el primer plan el contrato completo de entrada deomega_23 y la
incompatibilidad ordinaria conocida deomega_07, que además se bloquea en runtime.
No introducir hechosSQL, sugerencias de cita, offsets ni respuestas esperadas.
Misma petición completa, dosURL primarias, oráculo y20llamadas máximas;dos
intentos de plan ydos de nodo. Planificación explícita, Astra/ultra por
suscripción, sinAPI fallback. Sin cambios de fichas, criterios, fuentes o permisos.
La revisión del plan conserva las fichas completas de todas las asignaciones.
La revisión factual sólo puede suceder tras adquirir/observar sus propias fuentes.

## Primer control de entrada

08:28:29.960: request0, hash
`8d13b95698eff233c73cfe4b267378fa002616cb85291a12c67c6785ec2daadb`,
contiene la petición íntegra tanto enmissionIntent como entask.originalRequest,
knownRoleContracts conomega_23 íntegro/hash correcto e incompatibilidades
omega_07/09/veritas_04. Modelo/razonamiento solicitados coinciden con la política.
Esto comprueba solicitud, no finalización ni resultado del modelo.

Actor inicial `run:0eba1330-bb17-412b-a456-2d6864d1721e`, planificaciónintento1.
Resultado pendiente. No aprobación factual, candidata, fuentes o ahorro observados
al escribir este corte. Conservar cualquier fallo y su coste.

### Primera propuesta recibida

Llamada0:08:28:13.132→08:31:23.910; simulation=false/sinerror,27.620tokens
observados (21.385entrada,6.235salida). Propone un solo producto
`distinct_documentation`, productoromega_11 y revisoresveritas_06/omega_22,
adquisición conjunta secuencial de las dos páginas antes de analizarlas,
sinomega_23/omega_07 ni especialista. La revisión independiente precede entrega.
Esto es propuesta, no certificación de compatibilidad de los nuevos roles.

La normalización incorpora14criterios derivados de12requisitos; no son los
IDs del plan rechazado de otra misión. La petición y el oráculo siguen idénticos.
El número14 frente a15 del casoanterior no demuestra por sí solo pérdida ni
equivalencia: revisar todas las obligaciones. Aquí la prohibición de memoria
comparte criterio con corpus cerrado, y lasURL se incluyen en campos exactos;
las cuatro propiedades se separan por motor. Cobertura/semántica queda al juez
y al contraste independiente del resultado, no a este conteo.

Artefacto `artifact:9cea1512-e365-4aac-9d7c-209114207472`;
planpropuestoSHAeb618bc0473d545ad30b35444ab7e3181fe124a4dd5f42c3816b00767ec5ffd1;
normalizadoSHA9ca90b7dbc530949d9fec238af0333c6d9c3d1f00f1f7c3c898f4589ad2f785d.
08:32:06.861:270pins aún íntegros después de las ediciones exclusivamente de
documentación. El plan está bajo revisión, no hay adquisición ni entrega aún.

## Condición de cierre

Reconciliar sesión/owner/resumen. Si hay entrega, contrastar por separado sus
obligaciones originales completas, raw/recibos HTTP y vigencia, citas/alcance,
ventanas propias de productor y juez, dependencias aceptadas, reentrada y
contabilidad completa. UnACCEPT no prueba esas condiciones por sí solo. Si no
hay entrega, distinguir fase noalcanzada de un fallo efectivamente observado.
No instalar ni cerrarR01–R16 por este único caso.
