# Validación documental por lote — evidencia local

13 septiembre 2026. Mejora de trabajo redundante, no del criterio de aceptación.
No cambia prompts, modelos, permisos, fuentes ni historial. No instalada.

## Problema medido

Después de la respuesta final de [bNXUDE](DOCUMENTARY-REVIEW-bNXUDE.md), el
runtime reconstruía y autenticaba el mismo contexto por cada referencia. El
ensayo conserva su resultado y duración reales; no se le aplican tiempos nuevos.

Se ejecutó `validateDocumentReview` sobre su base cerrada, en modo SQLite
readOnly/query_only, sin inferencia ni escritor. La referencia usa la release
bd52715434a2e4ad88794be38cd074a806390f5e587576da85cdadce22e7af19. La segunda
medición usa los cambios locales, mismo candidato/revisión/base y contador de
`Store.get` activado únicamente dentro de la validación.

| Medición | Inicio UTC | Tiempo del método | Lecturas de registros | Lecturas del frame |
|---|---|---:|---:|---:|
| Referencia, sesión72689 | 10:28:58.280 | 86364.327542ms | 5015 | 28 |
| Lote, sesión53584 | 10:35:52.078 | 16408.768730ms | 907 | 2 |

Ambas validaciones pasan. En ambas, journal600/
65b442dce0acf3b614989c7c32f369a7a2b16aef964b6f7f317dcb66b7c1bea7 y baseSHA
364c012d1870e0066e3f23e2b3120f54ae996f2b0a94cdb437c219062c35d119 permanecen
idénticos. Tiempos descriptivos de una medición por versión en una VPS compartida;
no benchmark general, ahorro de tokens ni comparación de calidad. Las pruebas
breves del lote también se ejecutaron al inicio de la segunda medición.

Versiones medidas después:

- documentary-material.mjs:
  fe0db7b015d3ff6979dd31ee4981d30298c812e3af3a6e043f3b28e85d3ce26c
- document-context-frames.mjs:
  0781a8a63db200ccb0b95654fe26b0725d23a0667c6fa071748a1f65f143fa51

## Cambio y garantías conservadas

`documentContextQuoteEvidenceBatch` autentica un único frame completado dentro
de una instantánea de lectura y resuelve sus citas tipadas. No almacena cachés,
no expone callbacks y no reutiliza autoridad entre llamadas. Cada cita factual
mantiene su prueba propia de ventana, fuente, solicitud y cronología. No une
pasajes, cambia claves, repara citas ni decide implicación semántica.

Expansión y validación de hechos/revisiones usan el lote. La comprobación de
protocolo/última solicitud permanece separada: de ahí dos autenticaciones del
frame en la validación material, frente a una dentro del lote. Límites de los
selectores originales conservados; máximo20000citas por lote para cubrir los
dos conjuntos de hasta10000 de la revisión material. Lote vacío también exige
frame exacto completado. Un error no devuelve un subconjunto de pruebas.

Los objetos devueltos no comparten exposiciones mutables; una modificación del
resultado no se propaga a otras citas o llamadas. Una transacción del llamador
no se confirma ni se revierte por el helper. Los consumidores mantienen sus
comprobaciones al usar el resultado; una instantánea no promete estado externo
continuamente actual.

## Pruebas y equivalencia

- Primero ROJO: tres pruebas por ausencia de función,761.892160ms.
- Primera ejecución después: tresPASS/tresFAIL. El contador incluía una
  lectura del helper que construía los argumentos, no sólo del método medido.
  La ejecución dirigida posterior sesión87539 cerró106PASS/3FAIL,
  111990.189638ms por esa misma instrumentación. No se presenta como aprobada.
- Se movió la construcción del argumento fuera del contador, sin relajar el
  esperado de una reconstrucción. Se añadió una prueba de deriva posterior.
  Sesión28764: sietePASS/ceroFAIL,1551.774804ms.
- Se comprueban equivalencia con cada prueba individual bajo tres codecs,
  Unicode, claves ajenas, manifiestos, texto no expuesto, esquema/accesores,
  lote vacío, identidad, solicitud pendiente, retención, revocación de grant
  y fuente, cambio de frame/ventana/payload/política/recibo/cronología y ausencia
  de mutación o caché entre llamadas.
- Replay readOnly de la respuesta pública real2, sesión43283, fin10:37:17.455:
  expansión nueva **exactamente igual** al material original comprometido;
  hash12a2cd6ecf6c93c83af9bb62383be06c53e18b9c85fe3ab5185035cb4b277e87
  en ambos. Los cinco apoyos originales del productor también se validan.
  Journal/base sin cambios. No se genera una nueva respuesta del juez ni se
  reescribe su resumen `semanticAudit:PENDING`; esta auditoría es separada.

Regresión completa TvBbu1 cerrada:10:36:51.899→10:42:27.241,
sesión81082exit0/PID2037085 ausente.1048tests/1047PASS/ceroFAIL/unSKIP,
335235.983235ms. ResumenSHA809c9e37bc8cb37482d8ca89aa74b223400607980b4508219d0d608822a0bfc6.
Auditoría10:43:00.996:271inputs/76runtime, inventario y streams parciales/finales
íntegros. Nueva release58d863abde9ee4d1c2455f5d18306cdf043d923ee8e1edbbe96cb613dd096dc2,
413archivos/24001162B verificada, no instalada.

## Siguiente ensayo prerregistrado

Sólo si la nueva regresión y freeze se verifican: recorrido documental completo
en base nueva usando `run-live-documentary.mjs`, no otra copia de sólo revisión.
Mismo caso conocido DISTINCT, petición/oráculo, política,20llamadas máximo,
dos recuperaciones originales permitidas; plan, productor, juez, controles,
oráculo externo y reentrada sin repetir trabajo. Sin cambios de modelo/límites
para conseguir aceptación, sin pista de resultados previos en los prompts,
sin reanudar originales, instalar, publicar o ejecutar una misión ordinaria.
Preservar cualquier fallo. Un pase no cierra el mandato R01–R16 ni prueba calidad
general, eficiencia general, aprendizaje o recuperación tras cuota real.

Lanzado [2cYEbW](DOCUMENTARY-LIVE-2cYEbW.md), cualificado10:43:44.748,
sesión48291/PID2041980, bajo estas mismas condiciones. Reconciliar antes de
editar los271inputs; no duplicar la ejecución en curso.
