# Composición persistente de la ruta cerrada

12 septiembre 2026. Desarrollo, no instalado. Este paso conecta los componentes
ya construidos en una llamada del controlador y cierra sus barreras de recuperación.
**Todavía no habilita esta ruta en FactoryEngine ni cambia PLAN_SCHEMA.** No se
presenta una llamada privada como recepción natural completa por el planificador.

## Contrato antes de ejecutar

El controlador aporta un protocolo ya aceptado y llama a `freeze()` con
`reviewers:{material:[...],comparison:[...]}`. Puede asignar las fichas compatibles
que justifique el caso; no hay un número universal de agentes ni un juez elegido
después de ver la respuesta. Los roles de réplica no pueden disfrazarse de jueces
ordinarios. Las fichas originales se conservan.

El registro firmado fija las listas de jueces, hashes de sus fichas completas,
formatos de contexto/revisión, perfil de instrucciones, representación de fichas,
scopes de compilación y hashes de ambos prefijos base. También fija el máximo de
intentos de revisión por etapa a partir de la política de misión. El resultado
sigue asociado al modelo/esfuerzo de la solicitud congelada. Cambiar cualquiera
de esas condiciones no reconfigura un trabajo ya iniciado.

Los dos prefijos se calculan con el compilador existente, antes de la réplica.
Esta ruta nueva no dispone todavía de overlays aprendidos cualificados; el juez
de comparación, igual que el material, usa su prefijo base. No se deshabilita el
aprendizaje de los demás trabajos ni se equipara excluir overlays aquí a probar
que los prefijos base sean óptimos.

Un protocolo antiguo sin jueces congelados no puede adquirirlos mediante
`runReviewed()` después de conocer su resultado. Los métodos privados anteriores
siguen disponibles para esos registros; no se reescriben sus historiales.

## Qué ejecuta una llamada

`service.runReviewed(replicationId,{workers,signal})` exige el mismo Store,
ArtifactRegistry y Authority para los trabajadores. Conserva la secuencia:

1. Ejecutar la única réplica congelada o reutilizar su sello existente.
2. Materializar el intento exacto y revisar ese candidato con el primer conjunto
   de fichas fijado. Un RETURN no abre el original.
3. Abrir sólo tras esa aceptación y calcular la comparación prerregistrada con
   el oráculo existente, sin inferencia adicional ni modificación del resultado.
4. Revisar el informe exacto con el segundo conjunto de fichas fijado.

`REPORT_ACCEPTED` significa aceptación del informe acotado, **no** de toda la
misión ni de la afirmación original. La respuesta mantiene una obligación
NOT_MISSION_ACCEPTANCE y no modifica `mission.finalArtifactId`, su estado ni el
original. MISMATCH, UNKNOWN, controles fallidos y límites no se eliminan.

Se reutilizan WorkerService y las revisiones de ArtifactRegistry, incluidos sus
codecs completos y reparaciones acotadas de citas. No se crea otro framework,
otro servicio, un agente para repetir el informe ni una mayoría de votos.
La revisión previa del protocolo sigue siendo una entrada exigida, no algo que
esta llamada finja haber efectuado.

## Exclusión y recuperación

`blind-workflow` conserva propietario, etapa, candidato/hash, intento, historial
y decisión. El propietario se vincula a PID, boot y start ticks con el control
de procesos ya existente. No se roba una ejecución por tardar, caducar un reloj
o carecer de permiso para observar su proceso. Cada avance verifica el propietario
vigente; la salida sólo libera su propio registro.

- Si la réplica está RUNNING, FAILED o INVALIDATED al volver, se conserva
  REPLICA_UNRESOLVED: no se relanza para reemplazar un resultado incierto.
- Una réplica UNKNOWN termina como REPLICA_INCONCLUSIVE, sin juez material,
  comparación ni apertura.
- MATERIAL_RETURNED y COMPARISON_RETURNED conservan la decisión, no buscan otro
  voto favorable ni producen otro candidato.
- Un error explícito QUOTA o TRANSIENT_PROVIDER de revisión, sin decisión
  material, permite reentrar sobre **el mismo candidato**. El nuevo juicio puro
  se cuenta y conserva la llamada fallida. No se promete exactly-once para ese
  reintento. El presupuesto por etapa no se reinicia al reentrar.
  Ese contador mide intentos de etapa: cada uno puede incluir las reparaciones
  de citas ya acotadas de WorkerService. No es un techo global de tokens ni debe
  confundirse con el número total de inferencias.
- Una revisión enviada cuyo desenlace sea incierto no se repite. Queda pendiente
  de reconciliación; no se la transforma en un fallo de cuota conveniente.
- Si ArtifactRegistry ya comprometió la decisión pero el coordinador no guardó
  su checkpoint, se reconstruye y reutiliza esa decisión exacta. No hay otro juez
  sólo porque fallara el retorno a la fase siguiente.
- Cancelar después de aprobar el intento conserva la aprobación, pero no cruza
  la barrera de apertura. Una reanudación posterior puede usar la decisión real.

La prueba de una barrera resuelve revisión, actor histórico, configuración y
solicitud exacta. Exige configuración anterior al request retenido antes del
envío, request anterior a exposición completada y ésta anterior a la decisión,
con secuencias positivas del journal. Comprueba prefijo, scope, candidato,
modelo/esfuerzo y referencias, no sólo nombres de roles o tiempos de pared.

Una contraprueba encontró que añadir una ficha después de una aceptación
sintética podía aparentar ejecución válida. Falló antes de la corrección; ahora
se rechaza. Una segunda prueba elimina la secuencia de configuración y confirma
que ausencia no equivale a precedencia. Los fixtures sintéticos no se presentan
como demostración de inferencia real.

## Pruebas de este paso

20 tests dirigidos PASS, 21,72 s. Hay recorrido completo en los tres pares de
codecs, idempotencia, roles/prefijos congelados, dos puntos de cuota, presupuesto,
RETURN de ambas fases, incertidumbre, cancelación, fallo después del commit,
coordinadores simultáneos y rechazo de aprobaciones fabricadas posteriormente.

La prueba de caída usa un proceso Node real y SQLite: se conserva el envío de
una réplica, se mata **ese proceso de test** y el sustituto recupera el propietario
sin emitir otra réplica. No reinicia ni mata el servicio de producción. El
proveedor y los juicios son simulados; las operaciones de proceso, persistencia
y comparación determinista son reales.

Regresión completa [suite-giIEN4](../verification/runs/suite-giIEN4/summary.json),
10:38:27.542 UTC: 650 pruebas, 649 PASS, cero fallos y un SKIP live, 76,35 s.
Los 183 inputs fijados coinciden con el código al verificarse a las 10:52. El
archivo de réplica contiene ahora 81 tests en total; los 20 de este paso no se
suman otra vez al total de la suite. No quedaron ensayos ni hijos de test activos.

## Frontera de integración que no debe saltarse

El motor ordinario exige que el producto tenga el nodeId, productor, criterios,
dependencias y efectos exactos del plan aceptado. El adaptador usa identidades
privadas propias; copiar el resultado a otro nodo o relajar esas comprobaciones
no constituye una integración válida.

El siguiente cambio debe fijar una asignación de plan antes del freeze y enlazar
cada producto material con su nodo/criterios reales. Debe distinguir dependencias
privadas de control del contenido que ve el modelo: añadir el protocolo privado
y el plan global a `inputRefs` y recorrerlos normalmente filtraría el original
al replicador o a su juez. La alternativa a evaluar es una ruta de productos
explícita con referencias privadas verificadas por el controlador, manteniendo
inalteradas las obligaciones de los nodos ordinarios.

También deben resolverse el ownership del nodo durante fases largas, la entrega
del productor exacto y la diferencia entre reintentar transporte y cambiar de
protocolo por un rechazo material. No se puede instalar otro protocolo bajo el
mismo ID para forzar coincidencia. Sólo después procede anunciar la capacidad
al planificador y cualificarla con el proveedor real y criterios congelados.
R01–R16 continúa pendiente.
