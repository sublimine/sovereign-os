# Historial verificable de ejecuciones anteriores

13 septiembre2026. Implementado en DESARROLLO, no instalado. La brecha apareció
en yIc6GW: un juez real devolvió16PASS/1UNKNOWN porque el inventario mostraba una
ejecución del revisor anterior pero no sus argumentos. El recibo sí existía.
Se conserva ese RETURN. Ver DEVELOPMENT-TIMEOUT-RECOVERY-RESULTS.md.

## Por qué una observación histórica distinta

`effect-inventory` y `node-effect-inventory` sirven para enumerar intenciones y
atribuirlas a misión/nodo, pero sus IDs/hashes no exponen el comando. Los recibos
del productor y las nuevas acciones del juez tampoco contienen, por sí solos,
las ejecuciones de revisores anteriores. Añadir una ejecución nueva no demuestra
qué se ejecutó antes. La solución es recuperar el registro existente.

`execution-history-v1` ofrece al revisor ordinario el conjunto completo de
intenciones execution.run de su misión, incluidos otros revisores, operaciones
fallidas, PREPARED y UNCERTAIN. No agrega permisos ni actúa sobre esas operaciones.
Planificadores, productores y revisores ciegos no reciben esta nueva exposición.
El filtro de revisión ciega sigue impidiendo revelar los argumentos privados de
otros nodos. El ámbito no se extiende a otros procesos o servicios del host.

Cada entrada conserva ID, actor, versión/hash de efecto y job, estado, argsHash,
argv/cwd registrados, procedencia de esos argumentos, hash de recibo y resultado,
fechas y una proyección del resultado. Antes de proyectarla se autentica el
recibo y se contrasta con la operación; el job, argumentos, resultado y snapshot
deben coincidir. Un job preparado demuestra argumentos registrados, NO ejecución.
Si faltan job y recibo completo, recordedArgs es null y origen UNAVAILABLE.

La proyección de resultados satisfactorios conserva exit, manifiesto, snapshot,
hashes/tamaños de stdout/stderr y STARTED sólo cuando el recibo ya lo incluía.
No duplica los cuerpos de salida ni los convierte en cobertura de tests observada.
Un recibo legacy nunca recibe un STARTED retroactivo. Los fallos siguen siendo
fallos; ausencia de exitCode no se transforma en cero. No se exponen conversaciones.

## Orden, integridad y frescura

La captura se hace ANTES de emitir la nueva inferencia. El journal fija un corte
por secuencia/hash; se reconstruyen las versiones de efecto/job vigentes hasta
ese corte, no los heads actuales con fecha antigua. La captura incluye toda la
historia de ejecución de la misión en ese punto. Su consulta histórica recalcula
el conjunto completo y sus proyecciones: una firma del controlador no excusa un
subconjunto omitido, argumentos cambiados o un corte inventado.

El corte sólo avanza con registros relevantes de efecto/job; otra inferencia o
append no genera un duplicado del mismo historial. Una ejecución posterior hace
que una referencia antigua deje de ser evidencia actual, pero no modifica su
historia. La observación runtime no se admite como tool ni OWN_ACTION. Los tests
actuales y las lecturas independientes posteriores al candidato siguen separados.

## Evidencia de desarrollo

- RED inicial2/2FAIL201.058187ms por no existir la exposición; luego19/19PASS
  con historia, límites, actores, HMAC, incertidumbre y reconstrucción paginada.
- Registro/trabajadores/motor194/194PASS56043.259293ms,98024exit0.
- Dos casos con3ejecuciones nativas cada uno: ámbito conforme y comando anterior
  diferente; decisiones SIMULADAS, acciones/recibos/snapshot reales. Ambos
  conservaron la identidad del revisor anterior y el control negativo devolvió.
- Historial/casos ciegos136/136PASS72668.792104ms,32197exit0. Incluye proyecciones
  firmadas falsas, omisión de operaciones y protección de argumentos privados.
- Auditoría encontró otra comprobación necesaria: job y resultado podían tener
  manifiestos individualmente válidos pero diferentes. RED1FAIL263.253308ms;
  tras exigir igualdad,25/25PASS4304.906708ms,83264exit0 (incluidos los nativos).
- Lectura de sólo lectura20:20:43.540 sobre geTKWd/yIc6GW conserva ambos hashes
  SQLite. Proyecciones reales de3/4ejecuciones,6614/8588B; todos sus comandos y
  recibos se recuperan. Esto NO crea una exposición de modelo ni cambia RETURN.
- Globald4UiBq CERRADA20:30:54.193/67049exit0:1345tests1344PASS/0FAIL/unSKIP,
  500641.882425ms.289inputs/capturas/owner ausente reconciliados20:32:06.841.
  Summary94d8e8b6e15181bfbfe47d9f4c9df6cd1fd2440469191aa3ea80f8574a08685b.
  Runtimec78c36ebc7c865104c6924f74e24efe232157317de2f3e77bd2c03fadd5b85d0
  congelado420archivos24095244B/cualificado20:32:07.485, NO instalado.

Los ensayos históricos conservan sus fallos y costes. La corrección está probada
estructuralmente; todavía no demuestra una revisión real posterior favorable,
recuperación de un RETURN material, eficiencia general ni aceptación de R01–R16.
