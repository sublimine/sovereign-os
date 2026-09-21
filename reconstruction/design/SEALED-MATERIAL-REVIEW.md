# Del sello al juicio material

12 septiembre 2026. Desarrollo, no instalado. Integra el adaptador cerrado con
ArtifactRegistry y WorkerService; todavía no habilita una ruta del planificador
ni constituye cualificación semántica del proveedor real.

## Orden y responsabilidad

Protocolo previamente aceptado → solicitud retenida → réplica completada →
sello → candidato material → revisión independiente → apertura del original →
comparación distinta y revisión de su informe. La comparación determinista
acotada está descrita en [su contrato](PREREGISTERED-COMPARISON.md); la ruta
integrada del planificador y la aceptación final de la afirmación siguen pendientes.

El sello prueba qué se registró, no que el razonamiento sea correcto. Por eso
`materialize()` crea un candidato del mismo actor replicador, sin pedir otra
inferencia y sin reescribir su resultado. Su cuerpo conserva exactamente el
protocolo público y el resultado sellado. Cinco criterios fijados por el
controlador exigen vínculo, método, controles, límites y alcance de la evaluación.
El candidato comienza CANDIDATE. Reentrada devuelve el mismo ID/hash y su estado
actual; un RETURN permanece rechazado y no genera otra réplica.

`blind-material` v1 firma las referencias del candidato, registro de freeze,
sello y versión del actor completado. `artifact-blind-material` es una proyección
pública autenticada y ligada a su observador: incluye solicitud pública completa,
sección pública del protocolo, resultado, hashes y secuencias verificadas. No
entrega el registro privado de freeze ni el original. Copiar el cuerpo a otro
artefacto no copia este vínculo. Un hash visible por sí solo no es ese testimonio.

La revisión usa WorkerService existente, no otro productor ceremonial. Para
ACCEPT debe citar la observación autenticada que realmente recibió, además de
evaluar sustancialmente el intento. Un informe fiel de un control fallido no
demuestra réplica exitosa; el control y la divergencia no se corrigen ni se borran.
Se puede devolver el intento por defecto material. La aceptación de este registro
no acepta el original ni sustituye la comparación posterior.

## Cierre de la entrada del revisor

El WorkerService ordinario entregaba la petición global y podía añadir historial
de cola/operaciones. Una prueba nueva reprodujo esa filtración antes de corregirla.
La evaluación de un intento cerrado usa ahora `publicReviewMandate`, el candidato
completo y tres tipos de evidencia estrictamente propios: vínculo material,
historia de producción y operaciones del nodo. No recibe `missionIntent`, fuentes,
hermanos, herramientas, historial global, feedback externo ni overlays aprendidos
sin cualificación específica. No se cambia el contexto de los demás trabajadores.

Una segunda contraprueba mostró que un actor con documentos vacíos podía haber
visto antes texto privado en una solicitud ordinaria. Ahora se revisan también
sus solicitudes públicas retenidas, no sólo la lista de documentos: cada una
debe tener el sobre cerrado del mismo candidato. No se borran las exposiciones
anteriores. Las reparaciones internas de evidencia siguen acotadas; no autorizan
retocar el método, el candidato ni los criterios. Los tests con recibos sintéticos
sin solicitudes reales no son una prueba de la exposición de un modelo real.

`open()` ya no admite el antiguo camino directo después del sello. Exige candidato
aceptado y prueba citada, reconstruye el revisor histórico anterior a su decisión,
rechaza actores/hilos expuestos al original o al protocolo privado y liga esa
aceptación exacta al registro de apertura. Consultar o abrir no acepta el original.

Una contraprueba adicional reprodujo una aprobación indebidamente admitida cuando
faltaba la secuencia del revisor en el journal: `null` se comparaba como si fuera
un orden anterior. La apertura exige ahora secuencias enteras positivas tanto
para la revisión como para cada versión histórica que examina; ausencia no es
precedencia. El test falló antes de la corrección y pasó después.

## Vigencia y límites

Se comprueba en el punto de uso el protocolo vigente, su versión congelada,
original, política, resultado, actor sin nuevas exposiciones e inexistencia de
operaciones del replicador. Revocaciones impiden consumo/apertura. La proyección
histórica puede seguir leyéndose con `current:false`, sin reactivar su autoridad.
Cambiar el registro de vínculo inmutable se trata como adulteración, no revocación.

Los codecs existentes se reutilizan con contenido completo. Hay pruebas de
réplica → materialización → revisión por WorkerService → apertura en tres pares:
plain-json/expanded-json, lossless-v1/evidence-refs-v1 y
lossless-json-v2/evidence-catalog-v1. Las últimas dos usan transportes sin pérdida,
no resúmenes. El caso de entrada contiene deliberadamente el original en el
mandato global y una pista en la cola, y comprueba su exclusión del revisor.

Todas las decisiones del nuevo recorrido siguen siendo **simuladas** en estos
tests. Falta prueba real con protocolo sustancial revisado, comparador independiente,
informe final aceptado e integración adaptativa del planificador. Las dos reglas
deterministas posteriores no cubren toda comparación semántica. No se afirma
independencia cognitiva, seguridad contra un administrador malicioso ni cobertura
de todos los métodos del catálogo. Los guardas del trabajador ordinario para roles
de réplica permanecen activos. No hay un cambio instalado ni un cierre de R01–R16.

Corte de regresión 09:27:00.211 UTC: [suite-YN9ifX](../verification/runs/suite-YN9ifX/summary.json),
608 pruebas, 607 PASS, cero fallos y un SKIP live, 60,09 s; 39 casos dirigidos de
réplica. Los 181 inputs fijados coinciden con el árbol al comprobarse a las 09:29.
