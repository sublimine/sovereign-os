# Evidencia de admisión de contexto por candidato

9 septiembre 2026. Causa real: el ensayo Astra `sovereign-portfolio-live-GVMb9wMM`
terminó a las 22:29:24 UTC en **WAITING_CAPABILITY**, no en una entrega.
Ocho inferencias completadas, 241.394 tokens observados. El modelo de decisión
estaba aceptado; el juez de contraejemplos devolvió UNKNOWN por `blind_generation`:
la instrucción de aislamiento no prueba qué recibió realmente el productor.
Se mantienen el resultado y su consumo. No se reinstala ni reescribe su runtime.

## Corrección

`artifact-production-scope` es una observación autenticada por el controlador,
citada como evidencia `runtime`. Incluye el identificador/hash exactos del
candidato, su secuencia de creación inmutable y los registros de sus productores
anteriores de la misma misión/nodo **hasta ese corte**, no hasta la revisión.
Expone cada contexto retenido: identidad/tipo/finalidad de artefactos admitidos,
hashes de fuentes, hashes de peticiones y threads de inferencias completadas.
No incluye cuerpos de productos, fuentes ni conversación privada.

No se borra una exposición contaminada anterior al candidato. Las admisiones o
intentos posteriores tampoco se atribuyen retrospectivamente a él. Cada contexto
se verifica contra su digest; cada referencia histórica permanece vinculada a
versión/hash inmutables. Los inventarios se separan por candidato observado, no
por un nombre ambiguo de rol; un revisor ajeno no puede reutilizar esa prueba.
Los productores no reciben este inventario de otros productores.

La observación acredita admisión por el controlador, no ausencia universal de
información en cualquier texto, conocimiento preentrenado, verdad semántica ni
vigilancia del host. El juez sigue interpretando el requisito exacto: no hay un
campo `independent:true` autoconcedido. La planificación no recibe certificados
prospectivos de independencia de un producto que todavía no existe.

## Evidencia local

109 tests dirigidos de motor/workers/observaciones PASS antes de los cuatro casos
adversarios específicos; estos cuatro también pasan. Cubren contaminación previa,
exposición posterior, historial de peticiones, ámbito del revisor, varios productos,
estabilidad tras efectos de otro nodo y rechazo de referencias extranjeras/hash
de contexto incorrecto. Nueva regresión completa en curso al escribir este corte.

Proyección **sólo lectura** del candidato real
`artifact:c3159755-a0f6-4935-b11b-a545ec5b1df6`, hash
`e944a2795fe6d757500dd271918e5281300357e5a671de0639a08fac2acbea52`:
creación secuencia 415, un productor, dos versiones de contexto y una inferencia
completada. Los únicos artefactos admitidos eran de tipo `mission-plan`, no
`decision-model`. Proyección de 2.828 bytes; el journal original no se modifica.

## Recuperación preparada, no aprobada de antemano

`run-live-portfolio-recovery.mjs` conserva la ejecución fallida y crea una copia
SQLite privada mediante backup. Sólo permite este checkpoint sin operaciones y
su workspace vacío: registra explícitamente la nueva ubicación del workspace en
la copia. No retoca la petición, política, criterios, cuerpos, historiales ni sus
versiones anteriores. Una revisión real nueva examina el mismo candidato UNKNOWN
con la evidencia de admisión que faltaba. No es un permiso para ignorar FAIL.

Sólo si ese juez lo acepta se reanuda el motor. Los dos productos previos pueden
reutilizarse por identidad exacta; la implementación aún deberá ejecutar sus tests,
obtener revisión independiente y superar el mismo oráculo externo de 226 casos.
El informe conserva el coste acumulado previo y distingue el runtime de origen
del nuevo. Esto cualifica una recuperación entre versiones, no un recorrido nuevo
íntegro del último runtime. El aprendizaje y el modelo predeterminado no cambian.

### Avance real — 23:01 UTC

La revisión `review:dccfd62d-5995-42c3-b3ae-b2bbbc50125a` acepta el mismo candidato
y cita su observación autenticada `runtime-observation:cbca5608-658a-4804-848b-8e1716ddc7fd`.
El juez distingue el plan compartido de la respuesta del productor del modelo
de decisión; examina los dos contextos admitidos y la ausencia de esa respuesta
en ellos. No se cambió el texto del criterio ni el cuerpo del producto.
La copia de recuperación `sovereign-portfolio-recovery-live-7NHFBdRo` prosigue
con la implementación. Los archivos finales y sus pruebas siguen pendientes;
esto demuestra superación del bloqueo de procedencia, no aceptación integral.
