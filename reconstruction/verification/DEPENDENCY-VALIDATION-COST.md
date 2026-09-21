# Coste de revalidación documental: diagnóstico estructural

2026-09-13. Investigación local posterior al cierre deJOvy8z; **sin cambio
adoptado de caché general o de autoridad**. Antes de ampliar la optimización,
perfilar una lectura de frame heredado en la copia AJ4tmS readOnly/query_only.
Runtime014e6f13 y suiteLxDTPc fijados. El perfil del proceso propio separa muestras
en carga de registros, codificación/hashing y recorridos de dependencias; no
llama al modelo ni reanuda el motor. Instrumentación altera el tiempo: no usar
su duración como una comparación no instrumentada. Carpeta prospectiva
`runs/documentary-validation-profile-AeOy7b`, script fijado antes de iniciar.

## Hechos observados

Lector del mismo frame:117485→50779→24510ms tras lotes de pruebas y eliminación
de doble aceptación del mismo padre dentro del lector de grants. Contexto
idéntico,72registros únicos; aun1608Store.get y2,14GB acumulados de JSON devuelto.
Operación local real conservada, reproducida en nueva copiaJOvy8z:160226ms,
commit exacto, replay idempotente, ninguna lectura retroactiva ni efecto externo.
[Evidencia completa y límites](SOURCE-PROOF-BATCH-PREFLIGHT.md).

El código muestra varias revalidaciones de un mismo padre: cada grant y selección,
preparación y lectura de frame, prueba de request y nueva lectura del mismo frame.
Esa repetición puede multiplicarse con la profundidad de dependencias. El conteo
por sí solo no establece qué proporción de CPU consume cada función. Primero
perfilar; no introducir una caché que deje pasar revocaciones para obtener rapidez.

## Preflight de mecanismos existentes

LangGraph ofrece caché de nodos por clave derivada de entrada y TTL configurable.
Eso es útil para cálculos, pero es **inferencia de diseño local** que una clave
con sólo artifactId/propósito no describe nuestras dependencias variables:
fuentes, grants, revisión, efectos y caducidades pueden cambiar sin cambiar esos
argumentos. No adoptar caché TTL de dictámenes ni añadir otro runtime para este
lector. [Caché de nodos](https://docs.langchain.com/oss/javascript/langgraph/graph-api#node-caching).

SQLite WAL mantiene una instantánea durante la transacción de lectura, pero
las escrituras de la misma conexión son visibles antes del commit. La frontera
de transacción por sí sola no permite reutilizar sin control un resultado a
través de mutaciones locales. [Aislamiento](https://www.sqlite.org/isolation.html).
data_version sólo detecta commits de otras conexiones; no basta como contador
de mutaciones propias. [data_version](https://www.sqlite.org/pragma.html#pragma_data_version).
total_changes cuenta cambios de filas de la conexión, no certifica vigencia
de afirmaciones ni estado de archivos externos. [total_changes](https://www.sqlite.org/lang_corefunc.html#total_changes).

## Alternativas todavía NO implementadas

1. Eliminar duplicaciones concretas compartiendo factores existentes: prueba de
   request+frame en una única llamada y preparación de selección sin volver a
   leer el grant recién validado. Menor superficie; no resuelve por sí sola
   recorridos repetidos en grafos profundos.
2. Lectores por lote con dependencia común validada una vez al final de una
   instantánea síncrona, igualando cada prueba escalar. Evitar referencias
   mutables compartidas, parámetros de caché recibidos del llamador y autoridad
   que sobreviva a la llamada. Mantener pertenencias individuales y caducidad.
3. Verificador de dependencias con ámbito explícito de lectura. Sólo sería
   aceptable con estados activos separados de nodos ya terminados, detección
   de ciclos incluso a través de reentrada documental, ámbitos de misión/propósito
   exactos, revalidación tras cualquier escritura o salida de transacción,
   caducidades actuales y descarte ante error. Un Set genérico de IDs aceptados
   no cumple estas condiciones. Revisar antes todos los predicados que puedan
   depender de reloj o estado externo. No API pública para prestar dictámenes.

No se adopta aún ninguna alternativa. Si el perfil muestra predominio de
serialización/validación de los mismos bytes, evaluar primero reducir ese
trabajo con equivalencia exacta, sin cachear juicios. Cualquier intervención
requiere RED, retiradas de autoridad/fuente/aceptación, corrupción histórica,
mutaciones entre llamadas y en transacción externa, errores al final de lote,
límites y regresión global. No repetir bckJet ni gastar inferencias por confianza.

## Perfil cerrado y decisión prospectiva14:11

AeOy7b sesión89011exit0, resumen14:07:33.914, owner2106647ausente; script,
274inputs/runtime y base intactos14:11:00.046.20652muestras V8; frame correcto,
journal529 intacto. PerfilSHA8c8facf2deeddc55635cbd8d26dc320f3b71117fda581221720de09f00b76a35,
resumene849377353731eb43e2d70d50b6d99591924889512f0098afdf1c8c06c616d81.
Muestras hoja: Store.get34,8%, encode canónico25,7%, crypto.update20,8%, GC8,7%.
Inclusivas: assertUsable88,1%, Store.get53,0%, documentaryExposure33,1%.
Las inclusivas se solapan y no se suman. No son tiempos exactos ni costes del modelo.

Decisión: factorizar primero el trabajo idéntico **dentro de cada operación**,
sin caché de dictámenes, Store ni hashes y sin cambiar serialización canónica:

- Los validadores/expansores llaman documentaryExposure y luego al lote de
  citas, que ya autentica el mismo frame completo, incluso para lote vacío.
  Separar únicamente el guard de protocolo/actor/última petición; el lote conserva
  toda la prueba de completitud y cronología. Una reconstrucción por función.
- Añadir una API de material para devolver input completo, exposición y citas
  de la misma comprobación. La API de lotes existente conserva exactamente su
  forma; un factor privado común sirve ambas, sin callback o caché del llamador.
  El expansor de revisión usa ese input para encontrar apoyo propio; no relee
  otro frame ni consulta raw omitido. La operación de navegación usa el mismo
  resultado con cero citas, evitando autenticar y después releer el mismo frame.
- Preparar una selección con el grant recién leído y su fuente/hash comprobados
  una vez. No llamar authorized para volver a leer inmediatamente ese mismo
  grant. La lectura posterior de selección y las fronteras nuevas revalidan.

RED antes de editar producción: igualdad de input/exposición/pruebas en tres
codecs y una sola lectura de frame, batch vacío autenticado, aislamiento de
resultados, fallo tardío sin salida parcial; revalidación ante corrupción y
revocación entre llamadas. Integración con expansores/validadores completos y
contador de una reconstrucción; selección con una aceptación del padre, grant
ajeno rechazado. No modificar rutas, propuestas, fichas, criterios, presupuestos,
codec, fuentes, política instalada o ensayos históricos. Después comparar
material real recuperado y regresión global antes de otro diagnóstico del paso.

Implementación local iniciada después del cierre reconciliado deAeOy7b:
documentContextMaterialEvidence comparte el factor privado de lote y añade
sólo el input completo para consumidores de control; la API anterior conserva
su resultado. Guard privado materialActor no es exposición: todos los expansores
y validadores siguen ejecutando el lote completado incluso vacío. Navegación
usa ese material único; selección verifica sourceId/hash del grant recién leído.

RED inicial0/6PASS522.76814ms (API ausente y doble aceptación en selección).
RED integración0/4PASS3929.660938ms (dos reconstrucciones de claims, tres al
expandir revisión, dos al validarla). Tras implementación10/10PASS3573.088823ms,
sesión64780exit0. Añadidas además negativas de grant para fuente distinta con
bytes iguales y distintos, y conteo de una autenticación por operación local.
Regresión dirigida completa de cinco archivos: sesión5568exit0, 240/240 PASS,
88229.744129 ms. LxDTPc/014e6f13 sólo cualifican la versión anterior. No nuevo
diagnóstico vivo ni código instalado.

## Equivalencia conservada y medición local — 14:26 UTC

Primer diagnóstico hRF23c, sesión95613exit1: expansión exacta confirmada, pero
la aserción del script comparó el hash de `batch.quotes` con el hash histórico
de `{exposure,quotes}`. Se conserva el script y su qualification originales;
no tiene resumen de éxito ni se reetiqueta como aprobado. Base readOnly cerrada
en finally. No hubo cambio de producción para resolver esa discrepancia.

Nuevo diagnóstico l9xuBV, sesión87713exit0, cierre14:26:06.207: comparación
deepEqual directa entre el lote completo actual y el de runtime014e6f13.
Hash del lote completo:0fa771dd3ffbde3a4016725c7a231c3a0b2e8d6bfea7242798bd3738b17ee777;
hash de su lista de26pruebas:1c9899ad68126f96677ac04826512eb39cb25582f582358b3df13fac74f3b6ed.
Esto precisa la forma del hash histórico, no cambia las pruebas ni sus citas.
Material expandido exactamente igual al guardado:2a3a41c8894189f9f3793af7bc5d1ca97977e09df88883d1cf69a79cdda53ef9.
Contexto de síntesis íntegro e idéntico:54c3a917444f3bb53df257f87b2b55c7611fcec7e46864caa8570092f2e48430.

| Operación | Tiempo observado | Store.get | JSON devuelto acumulado |
|---|---:|---:|---:|
| Validar revisión real | 3848.683 ms | 225 | 309063072 B |
| Expandir revisión real | 3730.900 ms | 225 | 309063072 B |
| Leer frame heredado | 16575.715 ms | 1066 | 1419998021 B |

Comparables anteriores del frame:24509.899 ms/1608lecturas/2144580997 B.
Una muestra por operación en VPS compartida; no benchmark general ni ahorro
de tokens. El contador del lote de referencia incluye la creación del registry
y una lectura adicional de authority-key: no comparar su tiempo con el nuevo.
Ambas bases y los originales bckJet permanecen intactos; journal529 sin cambio.
La operación completa de160226ms todavía no se ha medido con esta versión.
Siguiente frontera: regresión global, freeze nuevo y diagnóstico local prospectivo
en otra copia; sin modelo, instalación ni reanudación del ensayo interrumpido.

Cierre reconciliado14:28:34.212: owners hRF23c2110308 y l9xuBV2110684 ausentes;
170inputs locales fijados por estos scripts, scripts originales y AJ4tmS íntegros.
Los274inputs corresponden al runner global, no a este inventario reducido.
Resumen l9xuBV97b48b0108c60a4544d1b89f26a9af713e0835e82fa42f98ca25bdd8ae7c5e02.
La comprobación inicial de los originales usó una ruta sin el subdirectorio del
brazo y falló ENOENT; no escribió nada. Tras localizarla en operator-interruption,
DB/WAL/SHM originales bckJet verificados en distinct-literal-windows-v1.

Regresión global uwAn0O iniciada14:27:48.583, sesión17132, owner2111158 /
boot2a077981-8aea-444e-8eff-44fa69814267 / startTicks49361861;274inputs fijados.
No editar producción, tests ni módulos de verificación hasta cierre reconciliado.

Inspección durante la regresión, todavía sin nuevo cambio: applyDocumentOperation
valida frame, sesión y cada preparación; luego relee selecciones al reemplazar
por fuente y al verificar el agregado. Son fronteras con razones diferentes.
Una futura factoración deberá conservar exclusividad por fuente, pertenencias,
grants revocados, recepción literal efectiva, límite global y rollback incluso
si el llamador captura el error. No reemplazar estas pruebas por sólo contar IDs
ni reutilizar autoridad de la solicitud anterior. Medir el paso actual primero.

Prerregistro del diagnóstico siguiente a uwAn0O: copia nueva exacta de AJ4tmS,
runtime nuevo congelado y cubierto por esa regresión, misma propuesta histórica
source.batch y mismos dos rangos fijados en JOvy8z. Ejecutar sólo una aplicación
local, replay idéntico y replay alterado; comprobar que ambas selecciones aún
son rechazadas como lectura de la solicitud anterior. Exigir inventario intacto
de misión/run/proveedor/efectos/fuentes/candidatos/revisiones y cuatro eventos
locales nuevos, sin reanudar engine.run. Comparar hash de operación y ventanas
con el resultado conservado de JOvy8z, no sólo cantidad de registros. Conservar
duración observada sin umbral de tiempo que transforme una VPS lenta en falso
fallo funcional. No repetir si no mejora ni usar una muestra como coste general.

La referencia congelada014e6f13 usada por l9xuBV fue verificada completa otra vez
14:32:15.806:413archivos24011009B, releaseId íntegro. Esa verificación sólo
autentica los archivos de referencia; no cualifica los inputs nuevos. Durante
uwAn0O no se cambiaron código/tests/harness y el worktree conserva sus entradas
previas; no se borraron prototipos, registros ni resultados históricos.

uwAn0O CERRADA14:33:07.711, sesión17132exit0/owner2111158ausente;1106tests,
1105PASS/ceroFAIL/unSKIP,319028.605822ms.274pins/started/streams íntegros al
cierre14:33:49.736. Resumen6aca905740084361a9d967883993636ce20f66bf46b98a779da88e4f9f252249.
Runtime0353100f64fbca8c0ca7d60e18394ce1019e680a79f8ecd826052f455587507b,
413archivos24012893B, cualificado14:34:09.557, NO instalado.

Diagnóstico5mv2fz iniciado14:34:47.079, sesión87998, owner2116191 /
boot2a077981-8aea-444e-8eff-44fa69814267 / startTicks49403643. ScriptSHA
dd84c9711c3dc8a2e5fb3775aaa1068475299c1e8a20ff6c6fda7e6ec23c9de7.
Después del lanzamiento, inspección14:34:59 detectó un error de instrumentación:
la aserción añadida usa journal.count, pero verifyJournal devuelve journal.events.
No editar el script iniciado ni anticipar un resultado PASS. Esperar el cierre,
conservar su fallo, verificar la copia y corregir únicamente el arnés en un
directorio nuevo con preflight de campos; no cambiar producción ni expectativas.
No hay inferencias o efectos externos en este diagnóstico.

5mv2fz CERRADO14:36:01.750, sesión87998exit1; fallo esperado de aserción NaN,
sin outcome aprobado. ResultadoSHA73f5618eb1c21223c3f87e055bb4d91ef4c603834425f1c41bc1b730ecfba9f0,
base cerradaecfcf0aad9dc0a8ca33df15f171074d0229cef350a685c393f3e0c91ad97edba.
Inspección readOnly14:37:09.803: owner ausente, script y274pins/runtime intactos,
journal533/headf53ebc6ede81b2b154bf0a6ad5b097eb8bc61b9b78e7ef937d4af04824be45b4,
operación hashb1ad569301faca7836368c0d03bc5e1d3199e61e30c0e0f593d1645caa004b37
exactamente igual a JOvy8z, inventario protegido idéntico. No se midió un tiempo
válido persistido ni se ejecutaron los controles posteriores: no llamarlo PASS.

Se corrigió sólo el script en directorio NUEVO6I1iBb: campo events correcto y
preflight del journal529 y del incremento4 del baseline antes de medir.
No cambios de producción, casos, criterios o runtime. Copia nueva de AJ4tmS,
sesión18411 iniciada después del cierre reconciliado; espera cierre y controles
restantes, sin inferencias ni modificación de originales o del ensayo fallido.

6I1iBb CERRADO14:38:41.259, sesión18411exit0/owner2116754ausente. Operación
69380.147166ms frente a160226.440427ms de JOvy8z, mismo hash b1ad5693... y
ventanas exactamente iguales. Replay1230ms sin eventos, replay alterado rechazado,
ambas lecturas retroactivas rechazadas; journal529→533 sólo en copia, resto de
inventario idéntico. Resultado071bd532da1c7e4305bd32e6c9a93d5b9e88c41947ccc197e7eb981740468213;
base09c7ea5b3ec75e72fea71d70e4105c3cc6da0d4b5dedb98bdf4a94ff242d2668.
Owner/script/274pins/release y originales/AJ4tmS reconciliados14:39:47.503.
Es una comparación local de caso conservado, no tokens, lectura completada,
entrega del ensayo bckJet ni cualificación general. 69segundos siguen siendo altos.

## Siguiente factor acotado: grants de un mismo padre

Decisión prospectiva después del cierre: añadir un lector por lote de grants
del mismo actor, con IDs explícitos únicos y tope64 igual al frame existente.
Cada grant conserva todas sus comprobaciones de actor original y actual, fuente,
hash, recibo, política, revocación y cronología. Sólo se difiere la aceptación
del padre productor hasta comprobar todos los miembros; se comprueba una vez
por tupla exacta artifactId/misión/propósito en esa misma llamada síncrona.
La API escalar sigue validando de inmediato. No caché global, callback, mapa de
autorizaciones del llamador, aceptación de un candidato del juez o nuevos permisos.
La llamada nueva no escribe y no devuelve resultados parciales si falla un miembro
o un padre. Una llamada posterior vuelve a validar, incluso en transacción externa.

RED primero: fuentes distintas del mismo padre, padres distintos, revocación/
retirada/corrupción tras una lectura correcta, pertenencias históricas y actuales,
entrada manipulada, vacío autenticado, aislamiento de resultados y journal intacto.
Después integrar únicamente los conjuntos de grants ya leídos en frame/sesión,
sin modificar aún lectores de selecciones ni memorizar dictámenes entre módulos.
No atribuir reducción de coste antes de medir ni reemplazar la regresión global.

Lector readSourceManifestGrants implementado tras RED0/12PASS512.168899ms.
Primera repetición11/12PASS743.343049ms: el test de retirada de segunda fuente
esperaba SOURCE_UNAVAILABLE antes de considerar que retractSource invalida
también el padre compartido. Corregida sólo esa expectativa con aserciones
adicionales: padre INVALIDATED, primera lectura escalar SOURCE_GRANT_SCOPE y
lectura individual de la segunda fuente SOURCE_UNAVAILABLE. No ampliar a una
lista vaga de errores aceptables ni cambiar producción para hacerlo pasar.
Archivo completo35/35PASS1245.582379ms, sesión49545exit0.

RED de integración adicional0/1PASS269.082707ms demuestra dos aceptaciones del
padre durante preparar frame. Integrado el lector nuevo en los conjuntos de
grants de preparación/lectura de frame y preparación/vista de sesión. Escalar
intacto; no cambios al lector de selecciones ni a los límites y propuestas.
Regresión dirigida de cinco archivos en curso, sesión95880. La versión0353100f
ya NO cualifica estas últimas modificaciones; no abrir otro diagnóstico de
operación ni editar la copia instalada antes de nueva regresión global.

Cinco archivos dirigidos CERRADOS: sesión95880exit0,253/253PASS83876.942321ms.
Se añadieron controles de último padre fallido sin reutilizar prefijo en el
intento siguiente y de vencimiento sin ninguna mutación de almacenamiento.
Archivo completo37/37PASS1439.397448ms, sesión23122exit0. El único cambio de
producción posterior fue aclarar el comentario del factor privado.

Regresión global PvhN1F iniciada14:49:33.356, sesión14407, owner2119603 /
boot2a077981-8aea-444e-8eff-44fa69814267 / startTicks49492341;274inputs fijados.
NO editar código/tests/harness hasta reconciliar cierre.0353100f/uwAn0O son
referencia anterior, no cualificación del nuevo lector. Después: freeze nuevo
y comparación local del mismo paso, con arnés6I1iBb ya corregido; no modelo.

## Huella estática observada durante la regresión — no migración

AJ4tmS readOnly/query_only,14:51:07.438, SHA idéntico al cerrar.169versiones
de registros suman83787911B de JSON; los42registros versionados de run suman
72442010B (máximo4522925B por registro). Sólo las7cabezas actuales de run suman
9109016B. Artefactos4463109B, efectos2156258B, fuentes2152472B, solicitudes
1314706B y frames637540B, contando versiones. No son tamaños de ficheros,
tokens, coste temporal o cantidad exacta de contenido duplicado.

Esto confirma que limitarse al número de fuentes o al tamaño del frame enviado
no describe el coste de releer historial de ejecución. Un cambio futuro hacia
referencias de contenido inmutable necesitaría un protocolo versionado y
compatibilidad de hashes, observaciones, recuperación y exposición exacta.
No está adoptado: no se borran versiones, migran bases ni se sustituyen recibos
por metadatos que hagan pasar una lectura no realizada. La corrección actual
sólo elimina repetición dentro de lectores, conservando todos los bytes.

## Cierre del lote de grants y comparación completa — 14:58

PvhN1F CERRADA14:54:45.544, sesión14407exit0/owner2119603ausente;
1120tests1119PASS/ceroFAIL/unSKIP312090.541143ms.274pins/started/streams
reconciliados14:55:33.718; resumenf48b1ac85c422de833d0532706a9a9788772dbcac18126768aa75257dcc2786e.
Runtime786639b52f22492b10fb7616555cf7cfa1541c088bedc95e43f0fe71a45df267,
413archivos24014708B cualificado14:55:54.271, NO instalado.

DiagnósticoFE40sy, nuevo directorio y copia exacta de AJ4tmS, iniciado14:56:18.952;
owner2124310/boot2a077981-8aea-444e-8eff-44fa69814267/startTicks49532845,
sesión51969. Script86f787a1a09a7a8f9754840dfa41eca193e75889f71e67066a4fcc1211ac25d7.
Mismo arnés corregido6I1iBb, sólo actualizadas referencias de runtime/suite/baseline.
CERRADO14:57:33.451, sesión51969exit0: paso54004.484760ms frente a69380.147166ms,
misma operación b1ad569301faca7836368c0d03bc5e1d3199e61e30c0e0f593d1645caa004b37
y mismas dos ventanas. Replay1298ms sin eventos; replay alterado y ambas lecturas
retroactivas rechazados. Journal529→533/head a2dff933df47a110229faf8ecf64f120faa058ab599e862a1a19351610fb6fc6;
basecerrada f22d7c7f83bf63450bc2ac5dc5a82917526d900b78bfff9c0eccb5aefa19fce3.
Misión/run/fuentes/efectos/inferencias/candidatos/revisiones intactos. No lectura
LLM nueva, reanudación de bckJet, entrega del original o cualificación general.

Secuencia de mediciones locales comparables del mismo paso:160226→69380→54004ms.
Una observación por versión en VPS compartida, no ahorro causal universal o
de tokens. El fallo5mv2fz permanece excluido de comparaciones de tiempo por su
instrumentación inválida; no se esconde ni se usa para mejorar la serie.

FE40sy reconciliado15:00:03.536: owner2124310ausente, script/274pins/runtime,
baseline6I1iBb y originales bckJet/AJ4tmS íntegros. Resultadodelarchivo completado
14:57:33.343, SHA9b881bd1a9601255cb3e6c3ecb61305035a2537a63a1da8c2eac5455a61b403c.
El evento stdout de cierre es posterior14:57:33.451, no otra ejecución.

## Siguiente lector acotado de selecciones — decisión, no implementación

Añadir lectura por lote de hasta16selecciones únicas del mismo actor (el límite
de conjuntos válidos ya existente), conservando exactamente cada vista escalar.
Autenticar primero sus identidades/actores y validar sus grants mediante el
lector por lote recién probado. La tabla de grants verificados es privada a
esa llamada síncrona; no parámetro del usuario, callback, veredicto persistente
ni caché reutilizable. El lector de cada selección mantiene fuente/recibo actual,
run histórico, política, ventanas UTF-8 exactas, hashes y cronología. Sólo evita
volver a validar inmediatamente el grant idéntico de ese mismo lote.

Integraciones previstas: conjuntos completos válidos del frame y la vista de
sesión; pruebas por lote de una solicitud deduplican sólo los IDs de selección
antes de leer, preservando cada cita y su orden. Evaluar el agregado final de
applyDocumentOperation con un guard previo de número de selecciones (cada una
tiene al menos una ventana), manteniendo después los límites de ventanas/bytes.
No cambiar el filtro intermedio de reemplazos: su colección puede ser transitoria
antes de la comprobación global. No estrechar presupuestos ni hacer parcial el
rollback para acomodar la API nueva.

RED antes de producción: igualdad de vistas/pruebas, un padre común validado
una vez, actores ajenos, grant que no coincide con la selección, fuente retirada,
ventana manipulada, request pendiente/ajeno, corrupción histórica, caducidad,
entrada no plana y getters no ejecutados, error tardío sin prefijo, no escrituras
y revocación entre llamadas/en transacción externa. Integración y regresión
global antes de otro paso local. Sin cambio general de Store, canonical o
recibos almacenados, ni inferencias nuevas por confianza.

Lector readSourceWindowSelections implementado tras RED0/10PASS326.443699ms;
primera repetición10/10PASS372.400659ms. Reutiliza sólo el actor/registro y tabla
de grants verificados de su propia llamada, como factores privados. No se reciben
desde la API escalar ni desde opciones públicas; vistas/clones preservados.
Las negativas de corrupción comparan códigos exactos, no un rechazo cualquiera.

RED de integración0/2PASS341.870826ms: el lote de citas validaba dos veces el
padre compartido, y el frame tres veces (una por grants y dos por selecciones).
Integrado ahora en pruebas por lote, preparación/lectura de frame y vista de
sesión. El agregado final de navegación comprueba primero número de selecciones
<=16 (cota necesaria), después valida lote y conserva conteo real/bytes. El filtro
intermedio de reemplazos sigue siendo escalar, sin un límite nuevo transitorio.
Dirigidas cinco archivos en curso, sesión81688, desde15:10. PvhN1F/786639b sólo
cualifican la versión anterior. No hay nuevo diagnóstico de operación o modelo.

Dirigidas266/266PASS85587.964483ms, sesión81688exit0; control adicional de
caducidad y conjunto de selecciones13/13PASS509.521415ms. VM8lJD iniciada
15:12:59.593/sesión42094/owner2127636, boot2a077981-8aea-444e-8eff-44fa69814267,
startTicks49632964,274inputs fijados. No editar hasta reconciliar cierre.

Durante la espera se reprodujo en memoria una debilidad de Authority.open con
getters JavaScript: devuelve contenido distinto del autenticado al releer data.
No es una demostración de ataque por JSON o remoto. Se prioriza corregirla
después del cierre de VM8lJD y ANTES de otra medición del paso. Ver
[cuerpo autenticado](AUTHORITY-AUTHENTICATED-SNAPSHOT.md). No instalar esta versión
ni usar una suite anterior como evidencia contra una negativa aún no añadida.

VM8lJD cerró15:18:25.982,1133tests1132PASS/unSKIP326277.225204ms;
owner/274pins/started/capturas reconciliados15:24:45.032, resumen
46eb873946a60e71b911bfe83d42ac356292f8d00dbffb273b16ddf4dcb7f004.
No release intermedio. Authority.open corregido posteriormente con RED4PASS/3FAIL
y dirigido final15/15PASS: devuelve los mismos bytes autenticados, rechaza
getters sin ejecutarlos y conserva firmas históricas. Regresión global nueva
en curso. VerAUTHORITY-AUTHENTICATED-SNAPSHOT.md; no medición del paso aún.

## Snapshot autenticado y selecciones por lote — cierre 15:36

Sn4ZOu posterior: 1.141 tests/1.140 PASS/un SKIP302174.871668ms;274pins y
capturas reconciliados15:33:15.967. Runtimefb9fa6678bbe163f753030305853663af9d2c6c0cf3e18e759164b32bd6d413c,
413archivos24018064B, cualificado15:33:37.922, no instalado.

MWDBfO, copia nueva, sesión81177exit0: paso45034.069521ms frente54004ms de
FE40sy. Operación b1ad569301faca7836368c0d03bc5e1d3199e61e30c0e0f593d1645caa004b37
y ambas ventanas exactamente iguales; cuatro eventos, replay sin eventos,
replay alterado rechazado y ambas citas retroactivas rechazadas. Cierre15:35:13.023;
owner2139099ausente/script/274pins/release/baseline/AJ4tmS/originalbck3archivos
reconciliados15:36:00.122. ResultadoSHA38660195dbd423110970da2c1a5dc4fa162c41b8c91633e9a941acacfb2c9680;
DB90c880dbd4396d360f3de58c5e1cd0aa5b2a9b36a1d2c5d2beef4ae0e32ab46a.
Journal533/7c4409133dd58d6c6a60fafd3d7ef5deb620746aaea8d03376284f7b8050c394.

Serie descriptiva:160226→69380→54004→45034ms, una observación por versión/VPS
compartida. El último cambio combina selecciones por lote y snapshot de firmas;
no separar sus aportaciones ni convertir tiempo en tokens/eficiencia general.
No completa la misión original ni cualifica el recorrido de extremo a extremo.

Siguiente diagnóstico sólo lectura: desglosar una lectura del frame de síntesis
original en fb9fa667, sin repetir la operación ni el modelo. Medir Store.get
por tipo/registro y tiempo de métodos de registro/Authority.open, señalando que
tiempos inclusivos se solapan y no deben sumarse. Mantener contexto SHA54c3a917...
exacto, journal529 y base AJ4tmS intactos. No caché, migración o modificación de
autorizaciones para medir; los contadores no forman parte del runtime.

## Desglose FlmqY8 y siguiente factor — 15:42

FlmqY8 sólo lectura, sesión95544exit0, cerrado15:38:42.771:7747.936122ms,
contexto54c3a917... exacto,561Store.get/78versiones/719660218B JSON acumulado.
Store.get4722.505ms; assertUsable2llamadas/6930.800ms inclusivos (la raíz
documental6928.481ms), verifiedToolReceipt62/1655.391ms, Authority.open79/
601.947ms, sourceReference19/82.030ms. Tiempos inclusivos solapados, no sumarlos.
El mismo run del juez4,5MB se leyó25veces, el productor23veces. No equivale a
719MB de disco o RAM. No justifica eliminar comprobación literal de citas: su
coste marginal observado es pequeño. Owner2140318 ausente/script/pins/base
reconciliados15:41:50.006; summary e145269bf5731ff0488af12c23b58a81f11860dad099180666a55031e679890f.

Factor propuesto: documentContextQuoteEvidenceBatch ya obtiene un completedFrame
privado. Este revalida todas las vistas, grants, fuentes/recibos, actor, política,
firma, petición retenida y cronología completa. Para citas de fuente vuelve a
llamar al lote genérico, repitiendo la misma petición y sus versiones del run.
En el lote ENMARCADO puede construir cada prueba desde su propio frame recién
validado, sin recibir un contexto validado del llamador ni guardarlo después.

Mantener: acquired fuente actual por ID dentro de la llamada, verificador puro
sourceWindowContainsQuote (mismos bytes/Unicode), selección única del frame,
selección→dispatch→retención→completion, metadatos exactos del recibo y mismos
campos/scope de prueba. El lector escalar/genérico conserva su validación
independiente para consultas sin frame y como comparación de equivalencia.
No nuevo parser, caché global, firma, permiso o texto expuesto. No cambiar
opciones públicas para aceptar supuestas autorizaciones precomprobadas.

Pruebas prospectivas: tres codecs con equivalencia escalar y una sola lectura
de request/selección, ventanas separadas y offsets multibyte, rechazo de cita
que salta un hueco y opciones falsas de cache/frame ya validado. RED inicial
2PASS/3FAIL668.228895ms: cada codec leía dos veces la solicitud, no una.
Mantener además regresión existente de revocación, corrupción, límites,
actor/completion ajenos, copia aislada y ausencia de resultado parcial.

Implementado sólo en document-context-frames.mjs: helper privado recibe el
completedFrame de esa misma llamada, nunca parámetros públicos preautorizados.
Conserva sourceWindowContainsQuote y adquisición actual por fuente; sólo compone
los mismos campos de evidencia a partir de comprobaciones ya efectuadas. La
ruta escalar sigue separada e idéntica, utilizada en deepEqual de pruebas.
Archivo51/51PASS8008.415247ms. Dirigida cuatro archivos existentes202/202PASS
75251.876324ms, sesión35761exit0; source-windows7/7PASS1036.768644ms por separado.
El comando dirigido incluyó por error documentary-material.test.mjs (no existe;
Node no lo convirtió en fallo). No se cuenta como archivo probado ni se afirma
que fueran cinco. La suite global enumera archivos reales y fija todos sus inputs.
Regresión global posterior iniciada tras cerrar ambas dirigidas.

mo5Fej CERRADA15:52:17.549/sesión57358exit0:1146tests1145PASS/unSKIP,
303250.738069ms. Owner2142619ausente/274pins/started/4capturas reconciliados
15:52:51.158, resumen94e0a2908cd305b24374870f3dbb63b95414c6f9c43e11519b21f36d708cceb8.
Runtime5e0ce61a6ee428d66772fbf29d953e7c75a98bb554da4f3505dad8791cc05148
413archivos24021003B, cualificado15:53:10.967, NO instalado.
DiagnósticoGDJx1P iniciado/sesión24488 en copia nueva deAJ4tmS: scriptMWDBfO
con sólo runtime/suite/baseline/hash cambiados. No tocar inputs ni duplicar
hasta cierre, identidad exacta/ventanas/replay/lecturasretroactivas obligatorios.

GDJx1P CERRADO15:54:27.587/sesión24488exit0:32128.716407ms frente45034ms.
Misma operación b1ad5693..., dos ventanas exactas, cuatro eventos, replay sin
eventos, petición alterada y dos lecturas retroactivas rechazadas. Owner2147482
ausente/script/274pins/release/baseline/AJ4tmS/bck3archivos reconciliados15:55:48.183.
Resultado c8e0bf2c5e0465ed11dc076b14751dd089ab7c637d554e717fd928e5a206b538;
DB876add60db3c9750c75d9b67d20c0641818c7050f1308a2bddfb0262acde92e9;
journal533/8c94018e35a83402a2f835880bbfbfe89ea35344ee92f46d57cdb23dc2d0c926.
Serie local descriptiva160226→69380→54004→45034→32129ms. No eficiencia general,
ahorro de tokens o entrega original inferidos de esta serie de un solo paso.

FyTUkH, sólo lectura de evidencias originales, CERRADO15:57:00.850/
sesión80138exit0:26pruebas y9selectoresfactuales, expansión igual al informe
guardado y hashes del lote/lista/material idénticos a l9xuBV. Respectivamente:
0fa771dd3ffbde3a4016725c7a231c3a0b2e8d6bfea7242798bd3738b17ee777,
1c9899ad68126f96677ac04826512eb39cb25582f582358b3df13fac74f3b6ed,
2a3a41c8894189f9f3793af7bc5d1ca97977e09df88883d1cf69a79cdda53ef9.
Owner2148316ausente/script/274pins/release/base/baseline reconciliados15:59:09.737;
summary41eb7fb2e8ec4fd16fabef42f3f34bf1e6e9c2f975f82cb15eca3bd3a63168a7.
No ensayo vivo, nueva lectura del modelo, cambio del original o instalación.
Siguiente fase: respuesta de planificación durable antes de consulta de fichas;
se conserva el límite de rendimiento restante (32s sigue alto) sin crear caché
global, normalizar almacenamiento a ciegas o seguir repitiendo el mismo paso.
