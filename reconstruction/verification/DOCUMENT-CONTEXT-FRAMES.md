# Entrada documental firmada y exposición por solicitud

Este documento conserva el corte histórico de preparación y guarda legacy.
La continuación opt-in de integración vertical está en
[DOCUMENTARY-WORKFLOW.md](DOCUMENTARY-WORKFLOW.md); no elimina los fallos ni
atribuye retrospectivamente esa implementación al corte descrito aquí.

13 septiembre 2026. **Integración parcial, no activada ni instalada.** Preparar
una entrada, demostrar sus bytes observados y aceptar su contenido son operaciones
distintas. Este corte implementa las dos primeras y bloquea su uso accidental con
los controles materiales legacy; no declara completada la misión spVGwI ni R01–R16.

## Contrato y justificación

`factory/lib/document-context-frames.mjs` reutiliza proyección de adquisiciones,
grants separados del raw, selecciones literales, codecs y retención de solicitudes.
`WorkerService.prepareDocumentInput` añade un punto de preparación explícito;
`infer`, `produce`, `review`, políticas, modelos y fichas instaladas no lo activan.
La construcción de controles propios se debe a sus vínculos con Store/Authority
y la identidad de cada actor; no se añade infraestructura ni dependencia pagada.

1. Antes de dispatch se captura una entrada completa: intención, criterios,
   feedback/correcciones/tarea, capacidades, productos, operaciones y observaciones
   operativas. Sólo se proyectan los canales de adquisición ya autenticados.
   Un cuerpo grande ajeno a esos canales no se recorta para hacerlo caber.
2. Un registro inmutable firmado liga esa vista a actor, modo, nodo, propósito,
   misión/política, compilación, fuentes, efectos, productos, permisos y ventanas.
   Referencias y hashes distinguen siempre el original de la vista.
3. El máximo de la entrada lógica completa es **1.000.000 bytes**, no 1 MiB:
   también debe cumplir la guarda más estrecha de retención de solicitudes.
   Hasta 16 ventanas y 256 KiB literales agregados por entrada. La comprobación
   previa evita registros parciales; la futura codificación también deberá
   respetar el límite de transporte y no autoriza truncamiento.
4. La prueba de exposición exige el input entero idéntico tras decodificación,
   instrucciones con el hash congelado, retención BEFORE_DISPATCH y una sola
   finalización propia. Orden de journal: preparación < registro del dispatch
   < retención < finalización. Cambiar la exposición del actor entre esos puntos
   invalida la vinculación. Una finalización histórica distinta no se presta.
5. El catálogo por solicitud tiene clases diferentes: cuerpo del producto,
   metadatos de adquisición, observación de herramienta íntegra, observación
   operativa, manifiesto y ventana literal. Las claves d1/d2 son locales a una
   entrada; no son alias globales ni sustitutos de hashes o de citas.
6. La cita debe estar exactamente en el campo tipado elegido. Una ventana
   requiere además su prueba de rango/fuente/actor/solicitud. Los metadatos HTTP
   no respaldan citas del cuerpo omitido; un recibo embebido no es una operación
   del revisor. No se corrigen silenciosamente citas, hashes ni selectores.

Revalidación: firma, versiones inmutables, política/compilación y propósito,
fuentes admitidas, permisos no revocados, origen asignado y bytes de recibos y
productos. Las observaciones operativas de esta prueba son **históricas**; un
inventario vacío antes de una operación posterior no certifica ausencia actual.
La prueba no equivale a vigencia de un archivo, soporte semántico, cobertura de
un documento entero, revisión independiente ni aceptación. simulation=true/null
se conserva explícitamente: las pruebas unitarias no son inferencias reales.

## Fallo de composición detectado y corrección

La primera suite vsSO45 pasó, pero una inspección adicional detectó que
`sourceIds`/`completedExposureHash` legacy todavía acreditaban admisión de raw
íntegro aunque un caller del plano de control hubiese enviado la entrada nueva
proyectada. En una base en memoria se pudo crear un candidato y aceptar una
revisión citando `UNSEEN_RAW_ONLY count=99`, ausente de los bytes enviados.
Es un fallo del helper nuevo combinado con gates antiguos, **no un resultado
material observado en una misión real ni un cambio de la instalación**.

Se conservan estas evidencias, sin reetiquetar los fallos como éxitos:

- Intento preliminar inline: error de fixture SCHEMA por timestamps faltantes
  en el recibo sintético; no demuestra un fallo funcional. Corregido en el
  fixture de la prueba reproducible siguiente, sin tocar datos de una misión.
- `runs/document-frame-legacy-gate-red-0CCIIu`: fin05:40:46.849, exit1,
  **32 tests,26 PASS/6 FAIL**. Los seis fallos son las excepciones esperadas que
  faltaban: productor en tres transportes, juez, entrada sin fuentes y etiqueta
  deterministic-result. ResumenSHA
  `a32856f87b1ec30d9f8bf7bcd1942521086eecc114327a23a734717002bd4691`.
- `runs/document-frame-legacy-gate-green-xR60Uq`: fin05:41:59.423, exit1,
  **168 tests,167 PASS/1 FAIL**. Los nuevos controles pasan; una prueba anterior
  esperaba UNOBSERVED_SOURCE y recibió el rechazo nuevo anterior
  DOCUMENT_FRAME_NOT_INTEGRATED. Se actualiza a exigir ambos controles en sus
  rutas correspondientes, no se permite una aceptación ni se elimina el caso.
  ResumenSHA `fb38f9d35ceb3eaffef6e6f8f5d1823d3cad0864f9c33e78f55df5c8bde561b7`.
- `runs/document-frame-legacy-gate-green-47ZZBU`: fin05:43:28.576, exit0,
  **168/168 PASS**, sin skips,11429.709385ms. ResumenSHA
  `904a890f1801cfb9d710cd31a14afeb6274c1dca16ade88985336f68d25bcff5`.

`ArtifactRegistry.requireLegacyMaterialContext` verifica identidad/hash de la
solicitud pública retenida y decodifica su raíz. Campos documentales reservados,
incluso con claves JSON escapadas o valores null, impiden materialización mediante
`create`/`review` legacy. El caso deterministic-result tampoco evita la guarda.
No se confunde una mención dentro de task con el sobre documental. Preparar un
registro sin utilizarlo, o enviar después una solicitud legacy íntegra, no
contamina la ruta anterior. Recibos legacy sin retención y formatos opacos
históricos mantienen su compatibilidad: esta guarda **no redefine ni cualifica**
esa exposición histórica como un frame autenticado.

El bloqueo es deliberado hasta implementar la aceptación versionada completa.
No retirarlo sólo para que pase un ensayo; no inventar que `assertUsable`,
retraction, linaje, aprendizaje o reportes ya consumen las pruebas documentales.

## Diagnóstico con los documentos reales, sin inferencia

`document-frame-diagnostic.mjs` abre spVGwI en modo readOnly/query_only y genera
una **copia privada nueva** mediante SQLite backup. Sólo en ella registra dos
grants, dos selecciones y un frame; ningún registro previo cambia. No crea
candidatos/revisiones ni llama al proveedor, broker o recuperación de misión.

Resultado conservado en `runs/document-frame-diagnostic-15ejSk`:

- 05:30:10.418–05:30:18.901 UTC, sesión52032 exit0.
- Actor `run:2fee09cc-cb49-4cd9-944d-36411e676a9c`;
  misión original **NEEDS_DIRECTION**, no recuperada.
- Entrada lógica completa: **71735 bytes**, dos ventanas de16KiB.
  SHA `4d79b36356284e93363726933265b31f971e8dc1036a70b96a9a11f7cbebea51`.
- Frame `document-context-frame:5fa20e333b9589673cf9427867bb3c4824ff60966c08c3e96b4545ba4b929774`;
  recordHash `68395fe407fb348e160e7716a14f6ecb1f8cb3efe08dddf06d7e8763076cf35d`.
- Fuente SQLite2033807B/SHAa6d38ca170dff62177e74e63297b44e567f673e7d2111de923e33b481560c140,
  rango1421462–1437846. Fuente PostgreSQL23119B/SHA71f20a96952c16dca637c3e9135dded2d78e73f32c375d9c9b1199730a0271f5,
  rango918–17302. Raws originales conservados completos.
- Original antes/después: journal324/head
  `f35ce8bf726b38af4c8c454ece0d95265180a2e89f26a9d6d99527b2656c3676`;
  recordsHash `dec9aa212b3480a508269e6e46269c4722d2122f4306fc5f20ce087843fcb021`;
  headsHash `60fe5bea08f9370fa82fc77c0d7010216018b121b7388747c1ffe062bf502a24`.
- Sólo la copia llega a journal329/head
  `eeaf813a7aa380a5a581e22171d520792f01bd424a6dd2bf3e446472d691c354`.
- Intentar acreditar lectura mediante la finalización antigua se rechaza con
  DOCUMENT_FRAME_REQUEST. Cero inferencias, adquisiciones o productos nuevos.
- result.json SHA `6cd130b8c209668a51957566e064ede8f62b07cbda9353324976f908757b5975`;
  frame.json SHA `7130df718c540803aca60ac4d36f2a8cea507e6f8d3b7d478b706494e5ebbdc5`.

La tarea usada en el diagnóstico es nueva y sintética, no una reconstrucción
de la siguiente petición histórica. El primer resultado del localizador literal
no acredita relevancia semántica, cobertura ni ausencia de contraevidencia. El
diagnóstico precede a la guarda material y sólo acredita preparación preservada.

## Regresión y próxima conexión

vsSO45 (anterior a la guarda):05:31:36.847–05:35:14.858, exit0,
983 tests/982 PASS/1 SKIP. Verificación05:39:20.492:265 inputs, inventario y
streams coinciden, PID1952315 ausente. ResumenSHA
`23af2d8cca60b9060f4827f1f28264df710f87cbaf5b67f3d08dd1920281b6d0`.
Esta suite **no** incluye la corrección material descubierta después.

Regresión posterior **ssVkLk en curso**, inicio05:43:36.260,265 inputs fijados,
sesión87217/PID1957912/boot2a077981-8aea-444e-8eff-44fa69814267/
startTicks46216635. No modificar inputs ni duplicar antes de reconciliar.

**Cierre ssVkLk05:47:29.362**: sesión87217 exit0,993 tests/992 PASS/cero
fallos/un SKIP,232970.523009ms. Verificación05:48:12.632:265 inputs/73runtime,
inventario exacto y hashes de streams parciales/finales coinciden; PID1957912
ausente comprobado con su identidad de kernel. ResumenSHA
`45fa6413d2b4b4c55d5f37511a8ea673a5a4072095b1a76c43b7053348ec968c`.
Snapshot `4df02b115007fa1710c7064081b753e4cd0ccc94a66d8b77378a69e2ed689f60`,
410archivos/23953824B verificado; **no instalado**. El SKIP corresponde al smoke
de suscripción desactivado por contrato de esta suite; las pruebas nativas de
aislamiento de VPS son reales. No ensayos ni inferencias activas al cierre.

Próximo bloque necesario: un contrato versionado opt-in de selección documental
con productor y juez independientes, protocolos locate/read sin otro fetch,
presupuesto/reentrada/cuota/cancelación y registro de la selección por actor.
Congelar sus instrucciones antes de preparar cada frame; ligar cada claim/check
a su propia solicitud completada. Conectar aceptación, consumo, invalidación,
reportes y scopes de aprendizaje antes de permitir materialización. Después,
suite/freeze y ensayo nuevo real sobre los documentos grandes con los criterios
originales completos. spVGwI fallido se conserva como tal.

### Puntos de conexión comprobados para continuar

- `WorkerService.createRun` importa automáticamente los sourceIds de los claims
  de cada producto asignado. `tool` e `inheritProductionObservations` añaden el
  raw admitido después de fetch/recuperación. La ruta nueva deberá conceder
  permisos de manifiesto explícitos en esos tres sitios, sin reinterpretar los
  IDs legacy ni atribuir al sucesor lectura del predecesor.
- `infer` captura runtimeObservations y compone instrucciones antes del dispatch,
  pero hoy actualiza instructionsHash **después** de construir el sobre. Para
  preparar frames debe congelar primero las instrucciones completas, refrescar
  el actor y sólo entonces capturar/fijar la entrada. Nunca preparar contra el
  hash del prefijo antiguo o perder observaciones al usar una variable run vieja.
- `produce` admite tool/batch/final/blocked y conserva pasos/recibos; `finishReview`
  admite una revisión final con reparaciones acotadas. La localización/lectura
  documental requiere propuestas explícitas y un estado persistente propio en
  ambas rutas, no una selección automática compartida que ancle al juez ni un
  esquema nuevo de final sobre una máquina de estados que no lo ejecuta.
- El catálogo legacy de `finishReview` se calcula antes de infer y luego se
  revalida. El nuevo catálogo debe proceder del frame preciso de la solicitud;
  no convertir d1 en una referencia global ni reconstruirlo después sobre una
  selección distinta. Preservar la respuesta original junto a la prueba ligada.
- `FactoryEngine` valida un conjunto cerrado de opciones; `adaptive-v1` ya está
  congelado. Añadir opción versionada opt-in, sin cambiar retrospectivamente el
  preset. El scope de compilación/learning debe distinguir el protocolo nuevo
  antes de consultar overlays; también productores especialistas y revisores.
- `ArtifactRegistry.create` valida hechos y sourceIds; `review` exige fuentes
  recibidas por el juez; `assertUsable` vuelve a comprobar fuentes/linaje y
  `retractSource` invalida descendientes. Todos necesitan el vínculo persistente
  documental del candidato/revisión correspondiente, no el último frame de un
  run que pudo continuar después. Mantener íntegros los gates de efectos y
  pruebas operativas existentes. El bloqueo temporal no implementa esa cadena.

Estos son puntos inspeccionados en el código actual, no cambios ya ejecutados
ni una aceptación anticipada del diseño. El siguiente cambio debe entregar una
ruta vertical verificable a través de ellos, con negativos de mezcla de versiones,
revocación/reentrada y selección independiente, antes de retirar la guarda.
