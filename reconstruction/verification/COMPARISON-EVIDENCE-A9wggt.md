# Aprobación previa expuesta al juez — extensión A9wggt

12 septiembre 2026. Evaluación aislada, no reanudación de la misión original.

## Contrato fijado antes del juicio

Una revisión adicional del informe exacto devuelto en xMileM, incorporando la
prueba preexistente que su juez indicó como ausente. No se recalcula, no se
produce una réplica nueva, no se modifica original, tolerancia, criterios o
resultado. El juicio previo y su hallazgo material se entregan completos como
feedback. No se adapta la prueba al desenlace posterior de esta evaluación.

Harness `run-live-comparison-evidence-assessment.mjs`, SHA256
`ff47449ce71d2eafebc988a2f22e7e4188061a9c27c342aebc253c1092d282ee`;
lector de fingerprint
`34f1c293a01ef33fedfcb38fb21a9fcd3f23e4b461a1a11d5ceb742bd36a1e70`.
Runtime congelado `edfdf8feb763dbef6b03200ace6a1562ae90c2db7068aa19c7909838060dd23a`,
394 archivos/23.805.946 bytes, sin instalar. Suite-z6Y6Of: 700 pruebas,
699 PASS/cero fallos/un SKIP, 219,80 s; a las 14:45:02.225 coincidían los
201 inputs, conjunto completo de archivos y hashes de salida.

La base fuente se copia mediante backup SQLite en lectura. Su journal terminal
tiene 710 eventos/head `acd893c129d879f560aaf9735dc61f708f45b11aff59cdf5b0a8bcf74440ca6f`;
hashes de registros `b116f7f2356380e0577437939a3d8e217486616af40d9b1691f4d2e09035b88f`
y heads `f02b048258eaca7260edceb2e833683d7f78eb2be861ddd4c4779c444ca67932`.
Su summary conserva SHA256
`f2244892d3fcad0b52f0aa0fcaa438e600f8b3961c31b524034234f1ee172cee` y
`passed:false`; su inmutabilidad se vuelve a comprobar antes/después de la llamada.

## Exposición real observada

Inicio 14:45:25.472, solicitud retenida 14:45:27.652 UTC.
Revisor `run:13a39eda-59b3-4456-8acf-01f4cdc11758`, request SHA256
`84cacbc19bd3d7a669142e63c77b13dbdfe1262391da1c616cc0d569fe6ac6ab`.
gpt-6-astra/ultra oficial por suscripción; mismas fichas, prefijo y política
de revisión de comparación previamente congelados. Máximo una llamada.

Se recibe únicamente el candidato
`artifact:93221e4e-18d5-4b28-9790-29664d818bbe`, payload
`c0359d2b8b4c97ee5caeeb3cb0c48e35113f92f238a391f36383bef58f8696a9`,
y observaciones autenticadas para este revisor. Su observación nueva incluye
el juicio completo `review:f92d95f2-b306-4cbb-9c9c-14c6c509c912`, con los cinco
PASS, razones/citas y su versión histórica de revisor. Orden real: original
338, exposición completada del juez 517, juicio 523, protocolo aceptado 524,
freeze 530 y solicitud de réplica 539. No es una aceptación añadida después.

El task se transporta como texto JSON dentro del sobre decodificado; tras parsear
ese campo se cotejó íntegro `task.recoveryFeedback[0].result` con el RETURN
anterior `review:7730e23c-e1c6-45df-a302-b070e3ef8696`. Una consulta inicial
equivocada de `task.feedback` había devuelto false; no era ausencia de feedback
en la solicitud, y no se alteró ésta para corregir el diagnóstico.

## Alcance del resultado pendiente

Se leerán todos los criterios, razones, citas, findings e incertidumbre cuando
termine. Incluso ACCEPT sólo evalúa este informe con la prueba añadida: el
workflow, nodo, misión y base fuente permanecen sin reanudar y no adquieren
aprobación retroactiva. Un nuevo RETURN o fallo de formato se conserva sin otro
voto automático. No es calibración amplia, misión integrada desde cero ni cierre
del mandato de la fábrica. Los resultados se guardarán en
`runs/comparison-evidence-assessment-A9wggt/result.json` o, si falla antes, en
`failure.json`; no se presume el resultado por la existencia de la solicitud.

## Resultado y lectura completa — 14:51 UTC

Terminó a las 14:49:22.552. Los once controles del harness son true. Una llamada
real, 33.965 tokens observados (26.633 entrada/7.332 salida), sin otra réplica,
efecto o modificación del workflow/misión/base fuente. Recibo completado
14:49:12.408; hilo `01a09614-9b34-7680-98f4-5c4eaa861be6`, distinto de los anteriores.

Juicio `review:3c73eee1-ffa1-43b4-822b-eba89ee8458f`, 14:49:22.419:
ACCEPT, cinco PASS, cero findings. Se leyeron íntegramente razones, citas e
incertidumbre. El juez usa su observación nueva para vincular aprobación 523,
freeze 530 y envío 539 con el protocolo/original exactos; distingue esa prueba
de la revisión material/apertura posteriores. Identifica expresamente la prueba
que resuelve la brecha previa, no cambia de veredicto sin justificarlo.

También verifica |62−61|=1>0/MISMATCH, objetos completos, tolerancia cero,
conservación de ambos controles, desviaciones vacías y los tres unknowns. Limita
la aceptación al informe, sin convertir los límites de la réplica en hechos
observados por ella ni certificar verdad original/independencia/host. Es una
aceptación material pertinente de este informe con evidencia ampliada.

Journal de la copia: 771 eventos,
`08dc9a2065a21abe16acb65ac92069f7a1334f7214a42e2cecd5c6be792f8043`.
La base fuente sigue con su RETURN y 710 eventos; la misión, ledger y workflow
de la copia tampoco se reanudaron. No se debe llamar al flujo ordinario sobre
esta copia para esconder la diferencia entre su decisión histórica de etapa y
el nuevo juicio aislado. Falta cualificación integrada desde el inicio y un
contrato prospectivo de recuperación, no otra votación sobre este resultado.

## Compatibilidad histórica comprobada después — 15:01 UTC

Antes de otro ensayo se detectó una regresión de la nueva proyección: la
revalidación de una observación antigua sin `protocolApproval` la comparaba
contra el formato ampliado y fallaba RUNTIME_INTEGRITY. Se reprodujo con la
observación real de xMileM en una conexión SQLite read-only y con un test nuevo.
No se modificó la base ni se volvió a emitir aquel juicio.

Se añade selección explícita de formato `legacy`/`historical-v1` en el lector
de pruebas. La forma histórica exacta se conserva, sin añadir conocimiento
retroactivo a su actor. Las capturas nuevas siempre incluyen aprobación y
generan otra exposición que requiere una nueva inferencia completada. El uso
actual verifica igualmente la aprobación; la ausencia del campo no transforma
una prueba histórica incompleta en prueba de que ese juez conocía el gate.
Un campo ampliado parcial o un informe alterado siguen rechazándose.

Cuatro pruebas dirigidas PASS (3,83 s). Lectura directa 15:01:07–08 confirma:
xMileM válido con aprobación NO expuesta y journal 710 intacto; A9wggt válido
con aprobación expuesta y journal 771 intacto. El ensayo A9wggt sigue atribuido
a edfdf8fe, no a esta versión posterior; se prepara regresión completa nueva.
