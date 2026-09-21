# Proyección de adquisiciones y permisos documentales — integración parcial

13 septiembre 2026. **No solución documental instalada ni fábrica terminada.**
Se distinguen una vista diagnóstica autenticada, un permiso de consulta y la
exposición literal completada por cada actor. Ninguno certifica soporte semántico.

## Qué cambia y por qué

`source-acquisition-projection.mjs` elimina sólo las copias de adquisición
definidas por contrato: `sources[].raw`, `toolObservations[].result.content`,
su `quoteText` completo y `artifacts[].payload.toolReceipts[].data.result.content`.
Verifica inventarios exactos, fuente, efecto comprometido, firma, actor, relación
y payload antes de emitir una vista con tipos distintos de los objetos originales.
Los recibos completos siguen almacenados. El hash de la vista nunca sustituye
al hash del payload ni a la firma del recibo original.

La vista conserva intención, tarea, feedback, correcciones, criterios, cuerpo,
claims, qualifiers, requisitos, planes, metadatos HTTP y operaciones no proyectadas.
No hace eliminación recursiva ni reemplazo global de cadenas. Un campo distinto
que repita el raw se mantiene; no existe garantía genérica de caber en presupuesto.
`documentContextPreview` es explícitamente read-only. `WorkerService.context`
e `infer` siguen usando el contexto íntegro anterior. El catálogo de revisión
antiguo rechaza esta vista: no se permite usar claves antiguas como si sus textos
omitidos hubieran sido observados. Las citas de metadatos revalidan registros;
no acreditan dispatch ni soporte factual.

`source-manifest-grants.mjs` registra permisos inmutables separados de `sourceIds`.
Una observación de adquisición propia/externa ya registrada o un producto
efectivamente asignado que declare esa fuente exacta puede originar el permiso.
El productor necesita un insumo ACCEPTED y usable; el revisor puede inspeccionar
su candidato/RETURNED o producto aceptado. Un ID de la misión no concede acceso.
Se ligan run, fuente, origen, política, propósito, rol y orden del journal.
No se conceden red, filesystem, ejecución ni autoridad del actor previo.

La selección de ventanas acepta ese permiso como alternativa explícita a los
grants legacy. Un revisor nuevo, sin `sourceIds` y sin observaciones del productor,
puede registrar su propia ventana y acreditar una cita sólo después de retener
y completar su propia solicitud exacta. Revocar el permiso o retirar la fuente
invalida esa prueba al consultarla, incluso si la solicitud terminó después.
Historiales, solicitudes y selecciones anteriores no se borran. La revocación
de un permiso no pretende eliminar otra autorización independiente válida.

Los validadores compartidos están en `source-documentary-scope.mjs`; la relación
OWN_ACTION/EXTERNAL_OBSERVATION se comprueba también al autorizar la selección.
No se modifica el esquema legacy de contexto ni sus identidades sin grant.

## Diagnóstico real preservado

Script `source-acquisition-diagnostic.mjs`; SQLite abierto con `readOnly`,
`query_only`, una transacción de lectura y sin constructor Store/migraciones.
No inferencia, adquisición, recuperación ni cambio del ensayo spVGwI fallido.

Ejecuciones **04:26:03.943** y, tras extraer los validadores compartidos,
**04:33:37.547 UTC**: resultado de tamaños y vista idéntico.

- Actor: `run:2fee09cc-cb49-4cd9-944d-36411e676a9c`.
- Contexto base íntegro: **6646609 bytes**; vista: **22483**;
  envoltorio completo del preview: **24399**.
- Estas cifras excluyen task/runtimeCapabilities que `infer()` añade después;
  **no son** la solicitud siguiente histórica reconstruida de6652843 bytes.
- SQLite:2033807 bytes, SHA `a6d38ca170dff62177e74e63297b44e567f673e7d2111de923e33b481560c140`.
- PostgreSQL:23119 bytes, SHA `71f20a96952c16dca637c3e9135dded2d78e73f32c375d9c9b1199730a0271f5`.
- Antes/después: journal **324**, head `f35ce8bf726b38af4c8c454ece0d95265180a2e89f26a9d6d99527b2656c3676`.
- ActorRecordHash `f37b9a6713be6a78f7c3dad6ac117c5544f58990aec600d2bcc953c8c161b63e`.
- Contexto original SHA `ee488fe2af89a206ca3eda13d26be6bb17e36df72a78fc62ba0037927e9578a7`.
- Vista SHA `1a6c66c9be0ba354ef1c12b2b21af1f08d838aea112a1361a63bc0c9e9794371`.
- Corte04:33: proyección SHA `7dc4ae962b7ac0cb843ed0e1b2d93e9efc40b25e6902321a3022070fb178826f`;
  scope SHA `1b169ce909517d9b6e7e3ff2ca08b036cebd27664c3a70fbe2d32281a2e81bb6`;
  workers SHA `e2eae381847b89400ea2bab205e1cb17346efb9a5a10d12f21ef3561cb1007ce`.

Se autentican y conservan los dos raws, recibos, planViews, relaciones de fuentes,
intención y contexto original. Los hechos pedidos siguen sin candidato ni juez
en ese ensayo: medir una vista sin raw no equivale a que un modelo lea la fuente.

## Pruebas dirigidas

Sesión18850:40/40 PASS (proyección15 + exposición25). Tras integrar permisos y
extraer validadores, sesión30865:52/52 PASS. Con controles adicionales de insumo
aceptado, RETURNED y revocación sin fallback, sesión44880: **55/55 PASS**,
cero fallos/skips;4638.622718ms. Son Store/firmas/retención reales y recibos
HTTP/modelo **sintéticos**, no una cualificación real de lectura o aceptación.

Controles incluyen todos los canales duplicados, >2MiB de raw, textos no
documentales >1MiB preservados, metadatos inesperados completos, firmas/relaciones
y payloads alterados, omisión de inventario, fuentes ajenas/retiradas, uso cerrado
o ciego, productor sin insumo aceptado, revisor sin observación propia, reversionado,
política cambiada, permiso revocado durante inferencia, snapshot sin adquisición
comprometida y rechazo de una cita legacy pese a ventana observada.

Regresión integral **aXRAcS en curso** desde04:33:58.628,262 inputs fijados,
sesión31093/PID1939318. No modificar inputs ni iniciar inferencias antes de
reconciliar resultado, inventario, hashes y streams. Esta sección se actualizará
al terminar; tests dirigidos no sustituyen la suite ni el ensayo integrado.

**Cierre04:37:46.684 UTC**: sesión31093 exit0;959 tests/958PASS/cero fallos/unSKIP,
227961.953412ms. Verificación04:38:19.121 comprueba262 inputs/72runtime, inventario
actual exacto, hashes de cada archivo y concordancia de streams parciales/finales;
PID1939318 ausente con su identidad boot/startTicks. Resumen SHA
`b930340ed049f1de682075ee86ba1da9881922a81504d394b08810c32110de01`.
Snapshot `764f75070718c9c47c1c0665209263ebeb74f39c5307d74780beee327485cda9`,
409archivos/23931852B verificado; **no instalado**. No inferencias reales en este
corte y ninguna aceptación nueva de la misión documental fallida.

## Próxima frontera concreta

1. Contrato versionado opt-in de contexto documental: identificadores de grants
   separados, selección actual acotada y archivada, proyección por solicitud;
   ningún cambio retroactivo a `sourceIds`, a una política v1 o a sus overlays.
2. Propuestas de productor Y revisor para localizar/leer los snapshots ya
   autorizados, sin otro fetch; preservación en reentrada y cuotas. Un grant
   no es por sí mismo una observación del manifiesto ni una lectura del raw.
3. Proyección de recibos y artefactos ligada a la solicitud realmente retenida,
   catálogo tipado y prueba de cita del cuerpo/metadatos correcto. El preview
   actual no es una autorización de dispatch y no cubre esa cadena todavía.
4. `create`, `review`, `assertUsable`, linaje/invalidation y reportes deben exigir
   rangos observados propios y vigentes, con soporte/contraevidencia evaluados.
   No basta introducir la ventana en el prompt o ampliar el schema de respuesta.
5. Suite completa/freeze y ensayo nuevo sobre el tamaño/contexto que bloqueó
   spVGwI, con productor, juez independiente, costes y pruebas externas. El
   fracaso anterior se conserva, sin rebajarlo o convertirlo retrospectivamente.

No instalar ni activar la proyección mientras estas fronteras sigan abiertas.

## Continuación 13 septiembre, 05:44 UTC

La [entrada documental firmada](DOCUMENT-CONTEXT-FRAMES.md) añade preparación
completa antes de dispatch, catálogo tipado y prueba del input exacto completado
por cada actor. Diagnóstico real en copia privada15ejSk:71735B con dos ventanas,
sin inferencia ni alteración del original. También se reproduce y bloquea una
vía de aceptación incorrecta al combinar esos inputs con gates legacy.
168/168 dirigidas PASS después de la corrección; ssVkLk en curso. No se activa
la ruta: siguen pendientes el contrato/protocolo, gates de aceptación propios,
consumo/linaje/reportes/reentrada/aprendizaje y ensayo integrado.

Cierre05:48: ssVkLk993tests/992PASS/cero fallos/unSKIP,265inputs/73runtime
e inventario/streams verificados. Snapshot4df02b11/410files/23953824B verificado,
no instalado. El [registro documental](DOCUMENT-CONTEXT-FRAMES.md) conserva
hashes, fallos/diagnósticos y puntos de integración aún pendientes.
