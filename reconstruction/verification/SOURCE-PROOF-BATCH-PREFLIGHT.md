# Prerregistro: trabajo repetido al probar citas de ventanas

2026-09-13, posterior a observación12:57. Diagnóstico prospectivo, no cambio
del runtime vivo bckJet ni de sus274inputs. No inferencia adicional.

## Causa candidata en código

documentContextQuoteEvidenceBatch reconstruye el frame una vez, pero llama
sourceWindowRequestEvidence individualmente por cada cita factual. Esta última
vuelve a autenticar selección/source/grant, decodifica la petición completa y
recorre las versiones del run para hallar primera solicitud/completitud. Varias
citas del mismo actor/request/selección vuelven a hacer ese trabajo. Además,
la revisión y los consumidores revalidan legítimamente en sus propias fronteras.
No se deben eliminar esas comprobaciones posteriores ni convertir un ACCEPT
anterior en autoridad permanentemente cacheada.

En bckJet respuesta9 completa12:54:27.840; revisión registrada12:55:16.970;
node.accepted12:55:47.485. Son49.130s hasta el registro y79.645s hasta el evento.
Esto **no atribuye** todo el intervalo al helper: incluye otras validaciones y
VPS compartida. La revisión tiene26citas más nueve apoyos factuales. La medición
del helper se hará en una base cerrada para identificar coste y equivalencia.

## Experimento sin inferencia, después de reconciliar el ensayo activo

1. Conservar bckJet/2c cerrado sin cambios; propietario ausente, WAL/journal
   vacíos, hashes de base, resumen e inputs verificados antes de editar código.
2. Medir la validación original en readOnly/query_only, misma base/candidato/
   revisión; contar Store.get por tipo y bytes JSON observados sin registrar
   secretos ni cuerpos. Contadores locales sólo durante la llamada; no cambiar
   resultados, firmas, recibos o métodos del runtime original.
3. Si se confirma repetición, refactorizar una vía por lote en el módulo actual
   de evidencia de ventanas, no otro parser de fuentes ni caché global de Store.
   Un actor/request, una transacción síncrona de lectura, validación de cada
   selección única, cada fuente y cada cita en su ventana exacta. Claves y campos
   completos originales, con resultado idéntico a las pruebas individuales.
4. Conservar comprobaciones de actor, permisos/revocaciones, fuente original,
   ventana UTF-8, hashes, petición retained BEFORE_DISPATCH, unicidad de recibo,
   contexto, orden de commits y alcance. Nada de textos reconstruidos, fuentes
   manifiesto tratadas como contenido ni transferencia entre actores.
5. Resultado sin objetos mutables compartidos; error último devuelve fallo total,
   no subconjunto aprobado. Lote vacío exige aun actor/request válidos. Límites
   explícitos por cita y conjunto. Sin callback ejecutable ni persistencia de
   autoridad entre llamadas/commits. La transacción externa permanece intacta.
6. RED antes de implementación y equivalencia/negativas después: cada codec,
   múltiples selecciones/fuentes/ventanas/Unicode; cambio de hash, tipo o texto;
   clave/actor/request ajenos; petición pendiente; revocación entre llamadas;
   límites, duplicados, mutación del resultado y ausencia de escritura.
7. Repetir **sólo medición determinista**, misma entrada, comparar pruebas
   completas y base intacta; luego regresión completa y freeze. No reinterpretar
   tiempos del ensayo original ni lanzar otro caso real sólo por confianza.

Hipótesis separada de la consulta de fichas del planificador. Si el diagnóstico
no confirma coste relevante o no puede preservar garantías, conservarlo sin
adoptar el cambio. Menos trabajo local no demuestra menor consumo de tokens ni
mejora del juicio semántico.

## Frontera adicional observada durante el cierre

La síntesis de bckJet no tiene permiso de adquisición nuevo: sus grants usan
assigned-artifact sobre el expediente aceptado. readSourceManifestGrant llama
originBinding para la admisión histórica y para el actor actual; cada una
revalida assertUsable del padre cuando se trata de productor. Por ello, repetir
la lectura de una selección en cada cita multiplica una validación documental
recursiva, no sólo una comprobación SHA barata. Hay que preservar las dos
condiciones de pertenencia, pero autenticar una misma selección únicamente una
vez dentro de una petición/batch síncrono y su instantánea coherente.

Diseño de refactor previsto: factor privado de solicitud completada (actor,
retención, decodificación, recibo, primera admisión/completitud); resolver cada
selección única mediante el lector existente, sin abreviar sus condiciones;
resolver cada cita con su ventana exacta y devolver su prueba escalar original.
La API individual y el lote comparten esos factores; no mantener dos parsers.
Los mapas son privados, locales a la llamada y nunca recibidos del llamador.
Los resultados devuelven objetos independientes, no referencias mutables al
material de otro elemento. No introducir caché general de assertUsable.

Objetivo mecánico de pruebas: una decodificación/retención por request y una
validación por selección distinta, independientemente del número de citas.
El tiempo se mide después, no se usa una aserción temporal frágil en la VPS.
Agregar negativas para grants de productores con padres y revocaciones, además
de las de fuentes observadas directamente. Lote de pruebas no es source.batch
del trabajador: no cambia presupuesto de navegación ni autoridad de selección.

SIGTERM diagnóstico al propietario bckJet13:06:12.195; al corte13:08 no había
terminado. El trabajo síncrono también demora la entrega de cancelación del
conductor. No tratar envío de señal como cierre confirmado, no editar sus inputs
ni mezclar el tiempo de apagado con la latencia del proveedor. No se declara
correcta la cancelación hasta reconciliar evidencia y estado terminal.

## Intervención complementaria acotada: atender cancelación entre pasos

Prerregistro13:25: además del coste de prueba, el bucle de microtareas puede
encadenar una operación síncrona terminada con la preparación costosa de la
siguiente inferencia antes de procesar una cancelación pendiente del event loop.
Añadir una cesión cooperativa al inicio de infer(), fuera de cualquier
transacción de evidencia, y volver a comprobar AbortSignal antes de preparar
contexto/retener request/crear proveedor. Conservar la comprobación inmediata
para señales que ya estén canceladas. No es preempción de una validación
síncrona activa ni garantía de apagado en un plazo fijo.

Antes del cambio: pruebas RED de cancelación encolada antes de inferencia y
entre una escritura confirmada y la siguiente inferencia. Después: cero nuevas
solicitudes/proveedores tras atender esa cancelación; escritura previa correcta
conservada, sin repetirla ni deshacerla. No fabricar un recibo completed/cancelled
de una llamada que no fue emitida. Las negativas de efectos/progreso y toda la
regresión permanecen. El ensayo bckJet no se reanuda ni se reetiqueta.

## Ejecución y resultado local — 13 septiembre, corte13:28

bckJet cerró con interrupción forzada: SIGTERM13:06:12.195 no atendido durante
trabajo síncrono; SIGKILL al único propietario13:14:40.579, sesión71690exit137,
propietario ausente13:15:20.952. Once llamadas completas, ninguna inferencia en
vuelo. No fue un timeout automático ni una entrega. Su estado durable sigue
RUNNING sin propietario; no se reescribe como resultado terminal del motor.
El registro separado `runs/documentary-batch-live-bckJet/operator-interruption.json`
identifica la intervención, la ausencia de resumen automático y la recuperación.

Para respetar las evidencias, el paso1 previsto se ajustó a la realidad del
cierre: original DB/WAL/SHM preservados byte por byte y nunca abiertos para
escritura; copia nueva verificada antes de recuperar sólo su WAL. La copia
`runs/documentary-interruption-recovery-AJ4tmS/state.sqlite` pasa integrity_check,
conserva exactamente registros/heads/eventos y termina sin WAL/SHM. SHA de la
copia cerrada9396adac05349fcb2380ebc5f073e6b33e59f7b506d46581296484588cdb94f6;
journal529/c0afaf25a0daf4faa27df7c5c8753abcd55ff532b1291d21777387febad80857.
No se inició motor ni se reanudó misión en esa copia. La cualificación original
de274inputs/releasec561736b se reconcilió13:15:21.238 antes de editar.

Implementado sourceWindowRequestEvidenceBatch: una solicitud autenticada por
llamada y una validación por selección distinta; factores privados compartidos
con la API escalar, mapas locales dentro de la instantánea síncrona. Integrado
en documentContextQuoteEvidenceBatch. Se conserva revalidación entre llamadas.

Pruebas: primer RED detectó seis fallos y un falso positivo en una negativa
que aceptaba también la ausencia de la función; se corrigió exigiendo primero
la existencia de la API. RED correcto:0/7PASS,341.90265ms. Tras implementar:
88/88PASS,8819.286489ms. Cuatro negativas adicionales con grants de productores
heredados prueban retirada del padre, fuente, grant y dictamen de aceptación:
once casos dirigidosPASS,550.195324ms. No se debilitaron expectativas.

Mismo validateDocumentReview sobre revisión real
review:fbfd18dc-aa08-40bb-8064-0658cdb305a7, con26citas y nueve vínculos
factuales, misma copia query_only/readOnly/BEGIN:

| Código | Duración medida | Store.get | Bytes JSON acumulados devueltos |
| --- | ---: | ---: | ---: |
| Original congelado,13:16:43–13:17:04 | 20368.099455ms | 1075 | 1830770991 |
| Lote local,13:23:14–13:23:21 | 6428.690118ms | 381 | 508391410 |

Ambas mediciones aprobaron, con42registros únicos y base intacta. Bytes son
suma de tamaños de versiones devueltas, no I/O de disco, memoria residente,
tamaño único ni tokens. Contadores locales equivalentes; una muestra por
versión en VPS compartida, no benchmark general ni mejora semántica. Persiste
un coste alto de lectura/validación recursiva en consumidores heredados.

Comparación independiente13:28:24.957, sesión49068exit0: las26pruebas completas
del código original congelado y actual son deepEqual, SHA común
0fa771dd3ffbde3a4016725c7a231c3a0b2e8d6bfea7242798bd3738b17ee777.
Precisión verificada14:26: ese hash corresponde al objeto completo
`{exposure,quotes}`, no sólo a la lista de26pruebas; su lista tiene hash
1c9899ad68126f96677ac04826512eb39cb25582f582358b3df13fac74f3b6ed.
Comparación directa congelada y fallo del primer script preservados en
[coste de dependencias](DEPENDENCY-VALIDATION-COST.md).
El material expandido de contenido+documentary coincide exactamente con la
revisión guardada:2a3a41c8894189f9f3793af7bc5d1ca97977e09df88883d1cf69a79cdda53ef9,
nueve vínculos factuales; journal y SHA de base intactos13:28:25.704.

Cancelación cooperativa implementada al inicio de infer(), antes de preparar
contexto/retener solicitud/crear proveedor. RED0/2PASS846.397005ms. Primera
repetición: un caso correcto y un fallo del test por ws.root inexistente;
corregido a ws.path, sin cambiar la expectativa. Escritura ya confirmada se
conserva; no nace una segunda solicitud tras cancelar. No preempta validación
síncrona en curso. Sesión6934exit0: los cuatro archivos completos afectados
suman162/162PASS,9954.123875ms. Regresión global y coste del consumidor
heredado aún pendientes; no instalación ni nueva inferencia autorizada aquí.

## Consumidor heredado y siguiente eliminación local de duplicación

Sesión90818exit0,13:36:51.372–13:39:40.414, sólo readOnly/query_only/BEGIN en
la misma copia AJ4tmS. readDocumentContextFrame del consumidor
runa3cd38d0-98df-4c4b-9f79-25db5b1f6d05, frameb6f1f6a5adf9a27db08f7cf4e00e003346de7f56bdf4432230fadf632e847789:

| Código | Duración medida | Store.get | Bytes JSON acumulados devueltos |
| --- | ---: | ---: | ---: |
| Original c561 | 117485.143819ms | 7190 | 11709259427 |
| Lote local inicial | 50779.015538ms | 3142 | 4233677299 |

Ambos72registros únicos; los contextos completos son deepEqual, SHA común
54c3a917444f3bb53df257f87b2b55c7611fcec7e46864caa8570092f2e48430.
Base y journal intactos. Misma instrumentación y límites de interpretación que
la medición anterior. No se ejecutó applyDocumentOperation ni se reanudó motor.

Intervención siguiente prerregistrada antes de código: readSourceManifestGrant
comprueba pertenencia histórica y actual mediante originBinding, pero ambas
consultan el mismo padre actual dentro de una única instantánea. Cada una
llama assertUsable con idéntico artefacto/misión/propósito. Conservar ambas
pertenencias, origen declarado, hashes y cronología; ejecutar la comprobación
completa de aceptación sólo después de validar también la pertenencia actual.
La creación de grant conserva su única comprobación. No reutilizar aceptación
entre grants, llamadas, commits o actores; no caché general ni parámetro público
para omitirla. RED de contador exacto y retiro de pertenencia antes de validar
aceptación; comprobar revocaciones y retiro de dictamen con pruebas existentes.

Implementado mediante opción privada de originBinding únicamente en la
admisión histórica del lector; la rama actual y la creación siguen verificando
assertUsable. Ninguna API pública obtiene una vía para desactivarlo. Primer
RED: redundancia reproducida; la prueba de retiro actual intentaba borrar
exposición por updateContext y fue rechazada por el guard legítimo. Se corrigió
la preparación del ataque usando forbiddenArtifactIds en nueva versión del
run, conservando el historial. RED correcto1/3PASS284.523565ms:2validaciones
frente a1 esperada y1validación prematura frente a0 tras prohibir el padre.
Tras cambio, sesión29380exit0:165/165testsPASS11054.441096ms. Incluye las
negativas de revocación posterior, revisión RETURN bajo padre aparentemente
ACCEPTED, dos lecturas separadas y transacción externa intacta. No nueva
regresión global aún; se mide primero el mismo frame heredado sin inferencias.

Medición posterior sesión76009exit0,13:44:39.637–13:45:05.150: mismo frame,
24509.898950ms,1608Store.get,2144580997bytes JSON acumulados y72registros
únicos. SHA del contexto idéntico54c3a917444f3bb53df257f87b2b55c7611fcec7e46864caa8570092f2e48430;
base/journal intactos. Frente al original117485ms, se elimina trabajo redundante
sin afirmar eficiencia global ni preempción de operaciones largas. Una muestra
por código; no usar esta medición como umbral temporal de aceptación.

Regresión globalLxDTPc iniciada13:45:40.101, sesión67848/owner2099031,
boot2a077981-8aea-444e-8eff-44fa69814267/startTicks49109006,274inputs fijados.
Sin llamadas reales, dos archivos de test concurrentes, aislamiento nativo
normal. No editar inputs ni duplicar durante esta ejecución.165dirigidas no
significa ejecutar un archivo inexistente: el argumento documentary-session.test.mjs
no correspondía a una suite; la integración se llama documentary-workflow.test.mjs
y entra en esta regresión global por inventario completo.

LxDTPc cerrada13:51:04.121:1093tests/1092PASS/ceroFAIL/unSKIP,
323897.980356ms; sesión67848exit0/owner ausente13:51:36.567.274pins,
started/summary y streams parciales/finales verificados; resumenSHA
64307bafdead7eaabfd5afdb27c3d2c0f6a62eeec772fddf0408e12dd22bcf97.

## Prerregistro: reproducción local de la operación interrumpida

Después de congelar y cualificar el código anterior, crear otra copia nueva
desde AJ4tmS, cuyo SHA ya está verificado. Ejecutar únicamente la propuesta
source.batch conservada de request10 en esa copia, mediante
applyDocumentOperation del runtime cualificado. No engine.run, proveedor,
reanudación original, nueva petición del usuario ni efectos externos. Los
registros nuevos son navegación local diagnóstica posterior, no historia del
ensayo original ni prueba de lectura en una inferencia posterior.

Comprobar: propuesta exacta/actor/frame/request conservados; ambas ventanas
iguales a los rangos pedidos y fuente original; commit completo; replay idéntico
sin nuevos eventos; replay alterado rechazado sin mutación; ninguna selección
nueva permite citarla como si hubiera estado en request10 anterior; mismo número
de inferencias/recibos/efectos y ningún candidato nuevo. Medir coste local total,
conservar journal/resultados separados y dejar originales intactos. Si falla,
diagnosticar ese resultado, sin declarar bckJet aprobado ni disparar otro modelo.

JOvy8z CERRADO13:58:30.921, sesión5902exit0, owner2104326/boot2a077981-
8aea-444e-8eff-44fa69814267/startTicks49167026 ausente al auditar14:00:39.841.
Runtime014e6f13997cff19284b6646a0269b9f295c9b4c351216dd9d633bdd9305e868,
413archivos24011009B,274pins/script intactos. Script diagnóstico fijado antes
de ejecutar: d8a1d7fb880ab0575b7bdaae43ce5966a40e0403954fb6e811d7631f03faa29c.
La propuesta exacta de request10 coincide con response10 conservada.

Operación local completada en160226.440427ms: SQLite[1432000,1438500),
PostgreSQL[0,23119), texto exacto de snapshots originales. Dos selecciones,
una operación y nueva versión de sesión, cuatro eventos; journal529→533,
nueva cabecera094e25b63c58dae35a619883821687b28a44edbcf39c28ef372bb6cdb73adad5.
Replay idéntico sin eventos; replay alterado rechazado; ambas selecciones nuevas
rechazadas como lectura del request10 anterior. Inventarios de misión/run/
petición/efecto/artefacto/review/propuestas/source sin cambio, hash común
6dd4ae5630b5b946da0faf1468d521567475d3a8aa5a1764df2058ac40f47769.

Resultado diagnósticoSHA baf83365e8a9f6fd8acaed5df1a088d2f66cf0372cfcbac4c67e28f22ca01046;
DBcerrada cfcc419e317c8d6d30a0ba3b919314094b9d4437f7ae8ca411068f177e794870,
sin WAL/journal pendiente. AJ4tmS y los tres archivos originales DB/WAL/SHM
de bckJet siguen byte por byte intactos. No nuevo candidato/inferencia/efecto
externo, misión aún RUNNING, sin reentrada del motor ni resultado global.
**160segundos para navegación local sigue siendo coste no satisfactorio.**
La corrección permite terminar este paso; no resuelve el crecimiento del
recorrido de dependencias ni la cancelación síncrona a mitad de operación.
