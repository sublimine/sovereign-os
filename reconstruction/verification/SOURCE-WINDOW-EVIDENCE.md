# Ventanas documentales: identidad, observación y localización

13 septiembre 2026,03:30 UTC. Componentes implementados y pruebas dirigidas;
**todavía no conectados al flujo de producción/revisión ni instalados**.
No cambia el significado histórico de sourceIds ni resuelve por sí solo spVGwI.

## Control de exposición real de bytes

`factory/lib/source-window-evidence.mjs` usa Store/Authority/ArtifactRegistry
existentes. El plano de control puede preparar una selección inmutable sólo
para una fuente ya concedida al actor o una adquisición cuya observación firmada
recibió. Comprueba operación SUCCEEDED comprometida, identidad exacta del recibo,
raw/hash/URL/fecha/tipo y misión. No basta una fuente admitida o un recibo firmado
sin efecto correspondiente. No concede herramientas ni hace otra descarga.

Cada selección liga run/versión/contexto/política/fuente y hasta16 ventanas,
64KiB por ventana y256KiB agregados. Preserva todas las versiones; seleccionarla
no modifica el run, su exposición original ni la fuente. Selección durante una
inferencia pendiente, cambio de propósito/política y actores cerrados/ciegos o
con adaptador nativo se rechazan. Repetir la misma preparación es idempotente.

Una prueba de cita exige **una solicitud real retenida BEFORE_DISPATCH** cuyo
campo documentSourceViews contenga exactamente esa selección y los bytes de
esa ventana para ese actor. Debe existir su única inferencia completada y orden
de journal selección→dispatch→retención→finalización. La retención es posterior
al registro de dispatch pero anterior a la llamada al proveedor, según el contrato
existente. Se rechaza registro histórico ligado después, metadatos sustituidos,
lectura pendiente, cita de otro actor, manifiesto sin ventana, cita dentro de
otro campo incidental, salto entre huecos o medio carácter Unicode.

El resultado es read-only, coherente en una instantánea SQLite, identifica rango
absoluto UTF-8/solicitud/ventana y conserva simulation=true/null sin convertirlo
en llamada real. No prueba soporte semántico, lectura integral, ausencia de otros
canales ni aceptación. El consumidor deberá revalidar al usarlo. La firma de
recibo y retención prueban registros del controlador, no vigilancia del proveedor.
No sustituye requireCompletedExposure ni los controles de aceptación del registro.

## Pruebas y defectos encontrados

- Primera ejecución antes de implementación: importación falla ERR_MODULE_NOT_FOUND,
  sin inferencia ni pretendido resultado funcional.
- 18 pruebas iniciales PASS, sesión58115 exit0,3765.943096ms.
- Ampliación: sesión91351 exit1,32 pruebas/29 PASS/3 FAIL. Reveló dos defectos:
  cita de medio surrogate (falló en helper y prueba de offsets) y reutilización
  tras deriva del propósito. Fallos conservados en la salida de esa sesión.
- Corrección en sourceWindowContainsQuote y binding de propósito; consulta
  envuelta en snapshot SQLite. Sesión8408 exit0:39 PASS,4583.73352ms, incluyendo
  siete pruebas previas de retención,25 de exposición y siete de ventanas.
- Tras añadir localizador: sesión46586 exit0,39 PASS,4241.055664ms,25 de exposición,
  siete de ventanas y siete de localización. No son78 pruebas distintas.

HTTP/proveedor de estas pruebas son explícitamente **simulados**; Store,
Authority, registros, hashes y gates de bytes se ejecutan realmente. Un fixture
de más de2MiB conserva raw íntegro y expone menos de4KiB en la vista acotada;
esto no demuestra que el contexto completo de WorkerService ya esté proyectado.
Las pruebas negativas incluyen fuente extranjera/retirada, fuente sin operación,
manifiesto/ventana alterados, política/propósito, retención histórica o cambiada,
completitud desconocida/duplicada/fallida, préstamo productor→revisor, alcance
nativo/cerrado y límites agregados. El control de cronología contradictoria
inyecta un orden inconsistente al verificador; no falsifica el journal real.

## Localizador literal y diagnóstico del fallo conservado

findSourceLiteral opera sobre raw existente: consultas literales UTF-8 de hasta
1024B, hasta64 posiciones por página, coincidencias solapadas y cursor al primer
match no devuelto. No interpreta regex ni HTML, no normaliza ni ejecuta contenido.
Una búsqueda de sufijo no se etiqueta como búsqueda integral; ubicación de texto
no equivale a observación del modelo o cobertura semántica. Tests comparan todas
las palabras binarias de hasta seis caracteres a un oráculo independiente de
posiciones escalares, varias consultas y tres tamaños de página, además de casos
Unicode/CRLF/escapes/EOF/inyección/límites y HTML mayor de2MiB.

[Diagnóstico JSON read-only](SOURCE-WINDOW-LOCATOR-DIAGNOSTIC.json),
03:28:03.682, sobre la base preservada de spVGwI. SQLite2033807B y PostgreSQL23119B
conservan hashes originales. El literal NULL values localiza cuatro posiciones
iniciales en SQLite, incluida1435018; quedan más resultados y cursor2009642.
Las primeras coincidencias de DISTINCT incluyen navegación y SVG: **orden de
aparición no significa relevancia**. PostgreSQL no contiene los literales exactos
NULL values o null values; esto no demuestra ausencia de la proposición, pues
marcado, capitalización y redacción pueden interrumpirlos. No hubo inferencia.
Journal324/headf35ce8bf idéntico antes/después; ninguna recuperación ni escritura
en el ensayo fallido. Script reproducible source-window-diagnostic.mjs.

## Regresión integral cerrada — 03:33 UTC

uGS19o terminó03:32:14.452, sesión79490 exit0, **929 tests/928 PASS/cero fallos/
un SKIP**,249987.620513ms. Identidad de PID1924900 comprobada ausente03:33:03.929.
256 inputs/69 runtime idénticos a started.json y summary.json; inventario exacto,
streams parciales/finales y sus hashes verificados. ResumenSHA256
`7bc4ead0f3a67ed6067ba384da32153fc7baad02275aff911f1badf7de4c3364`.
Nueva instantánea verificada
`9ab6ee219126e9d601d22ab700eaf361dfd2ba226e7bafa1f0fdece840a7b44b`,
406 archivos/23910909B, incluye los69 inputs de runtime probados, **no instalada**.
La suite excluye el smoke de suscripción; no es cualificación real del protocolo.
No quedan ensayos/inferencias de este corte en curso ni se ha repetido checkpoint.

## Corte histórico del lanzamiento y trabajo pendiente

Suite uGS19o en curso desde03:28:04.339; sesión79490/PID1924900,
bootId2a077981-8aea-444e-8eff-44fa69814267/startTicks45403407.256 inputs fijados;
no modificarlos ni duplicar suite hasta reconciliar. No nueva release instalada.
Después, integrar proyección de adquisiciones en contexto y toolReceipts, protocolo
de selección del productor **y del revisor**, catálogo/citas ligados a estas
observaciones y scope de aprendizaje versionado. Conservar CONTEXT_LIMIT si otros
canales exceden el cap: no recortar feedback, artefactos o criterios para pasar.
El fallo spVGwI permanece; se necesitará otro ensayo prospectivo, con sus costes
y todos los criterios originales, después de la integración y regresión.

### Próxima frontera concreta

La integración no puede limitarse a añadir documentSourceViews y omitir sources:
result.content, quoteText y los recibos incrustados en payload.toolReceipts
seguirían reintroduciendo el raw. Definir una proyección de adquisición **tipada**
con referencia/hash del recibo íntegro y marca explícita de contenido no expuesto;
el payload proyectado no debe aparentar ser los bytes del payload íntegro bajo
su mismo hash. Revalidar citas de artefacto/herramienta contra lo efectivamente
expuesto, no contra la copia omitida. Sólo proyectar esos campos autenticados;
body, claims, feedback, correcciones y criterios permanecen íntegros y sujetos
al cap. No activar la política/ruta hasta cubrir todos los canales y los gates.

La selección del revisor debe poder pedir contexto adicional por su propio
protocolo, no limitarse silenciosamente a las ventanas que eligió el productor.
Los grants de manifiesto necesitan identidad separada de sourceIds (raw íntegro)
y la integración debe ampliar authorized sólo para ese contrato autenticado,
nunca para todos los IDs de la misión. Pruebas de independencia/cobertura/
reentrada/revocación antes de cualquier inferencia real con ese formato nuevo.
