# Eficiencia observada del ciclo local

Fecha: 2026-09-09. Alcance: `factory/lib/engine.mjs`, `workers.mjs`, `plans.mjs` y `factory/catalog/index.mjs`. No cambia su implementación. Batería: `tests/factory/efficiency.test.mjs`.

## Método y límites

Ejecutar `node --test tests/factory/efficiency.test.mjs` con el Node del runtime compatible con SQLite. Resultado observado: 4 tests, 4 aprobados, 0 omitidos (4,1 s en esta ejecución; no benchmark de velocidad del proveedor). Cada diagnóstico JSON imprime llamadas y tamaños medidos en la frontera `provider.generate`.

El proveedor, el enrutamiento y el transporte HTTP son fixtures explícitamente simulados. Store/SQLite, autoridad, registro de artefactos, validación de esquemas, WorkerService, engine, recibos firmados del broker y archivos temporales son reales. Las respuestas de revisión constituyen un oráculo sintético: no prueban juicio semántico del modelo, exhaustividad del mandato ni calidad de producción. No se consumen suscripciones, red pública o API.

Se miden bytes UTF-8 de instrucciones, input y esquema, no tokens, coste monetario, cache hits, tiempo de razonamiento ni límites de la cuenta. Identificadores y fechas pueden variar ligeramente los tamaños; los tests fijan relaciones y llamadas, no snapshots exactos de bytes. Las comparaciones compacto/split conservan petición, criterio final, fuente adquirida u obligación de archivo; el DAG split es deliberadamente un control de coste, no evidencia de que el router real lo seleccionaría.

## Medición de esta ejecución

| Fixture | Nodos | Inferencias | Instrucciones B acumulados | Input B acumulados | Esquema B acumulados | Input B máximo | Efectos broker |
|---|---:|---:|---:|---:|---:|---:|---:|
| Texto compacto | 1 | 4 | 44 516 | 31 812 | 6 018 | 20 586 | 0 |
| Fuente compacta | 1 | 5 | 54 201 | 40 229 | 7 272 | 20 620 | 1 |
| Fuente split | 2 | 7 | 73 393 | 60 257 | 9 640 | 20 620 | 1 |
| Archivo compacto | 1 | 5 | 54 251 | 40 407 | 7 272 | 20 630 | 2 |
| Archivo split | 2 | 7 | 73 468 | 60 897 | 9 640 | 20 630 | 3 |
| Fuente compacta +64 KiB | 1 | 5 | 54 201 | 498 996 | 7 272 | 268 833 | 1 |

Todos conservan un requisito y aceptación independiente del plan y de cada producto. Los casos fuente terminan con una fuente y una afirmación respaldada por su hash/cita. Los casos archivo conservan una obligación tipada y comprueban el contenido real; el broker realiza una escritura y una lectura independiente por producto revisado. Los efectos contados no incluyen comprobaciones síncronas adicionales del filesystem realizadas por el control de estado actual.

## Interpretación causal

1. El runtime **no impone dos nodos**. El mínimo de este camino satisfactorio es planificador + revisor del plan + productor + revisor del producto: cuatro inferencias para un nodo sin herramientas. Para estos fixtures sin correcciones: `2 + 2 × nodos + propuestas de herramienta del productor`. La lectura del revisor es determinista y no exige inferencia adicional. No generalizar la fórmula a fallos, correcciones o futuras herramientas.
2. Pasar de uno a dos nodos añade dos inferencias (+40% en las comparaciones con herramienta), contexto de dependencia y aceptación intermedia. En el fixture de archivo añade otra lectura independiente. Esto resulta innecesario cuando el segundo producto sólo repite lo ya solicitado; puede ser imprescindible ante otra responsabilidad, aislamiento, falsador o aceptación realmente distintos.
3. Planificar envía el directorio compacto de las 154 capacidades. Los turnos reciben las fichas completas seleccionadas, no todas las fichas. La compilación de fichas se realiza al crear el run; el worker vuelve a enviar esas instrucciones completas en cada inferencia. El engine actual ya evita compilar por duplicado las fichas del planificador.
4. Cada propuesta de herramienta provoca otra inferencia con contexto creciente y otra instancia del proveedor. El productor recibe el plan aceptado completo como artefacto; el revisor recorre la ascendencia completa. Fuente, recibos y observaciones pueden contener representaciones repetidas del mismo material.
5. Añadir 65 536 bytes a la fuente aumenta 131 072 bytes el campo raw de fuentes acumulado, pero **458 767 bytes el input acumulado total**: aproximadamente siete veces el incremento original en este fixture. No es multiplicación de tokens demostrada: incluye otras representaciones y serialización. Reducir sólo `sources.raw` no resolvería toda la amplificación.
6. Los límites actuales fallan explícitamente ante exceso de contexto/instrucciones; no existe aquí selección adaptativa demostrada mediante una curva calidad-coste ni benchmark de routing real. Un bloqueo por contexto conserva honestidad, pero no completa el trabajo.

## Ajustes propuestos, no implementados

- Prioridad alta: dar al planificador un criterio explícito de justificación del producto intermedio. Si no introduce evidencia, transformación, autoridad o aceptación diferenciadas, preferir un solo producto final manteniendo revisor independiente. Evaluarlo con casos que sí necesitan separación, no fijar un número óptimo de agentes.
- Prioridad alta: instrumentar cada inferencia con tamaños por componente, digest de contenido repetido, llamadas y uso del proveedor cuando exista. Separar bytes enviados de tokens facturados/cacheados. Estos tests capturan la frontera offline; no añaden telemetría persistente al producto.
- Prioridad media: diseñar una exposición canónica de fuentes/recibos con contenido único y referencias verificables a bytes observados. Mantener originales íntegros en registro, hashes, citas y relación de autoridad; ninguna referencia invisible puede presentarse al modelo como fuente leída. Probar manipulación, citas inexistentes y límites antes de adoptarla.
- Prioridad media: proyección exacta y acotada del plan por nodo, preservando requisitos, criterios, obligaciones y referencias causales; la revisión del plan completo sigue siendo independiente. No basta cortar texto o resumir con pérdida silenciosa.
- Prioridad condicionada: seleccionar por capas el directorio de capacidades sólo tras comparar recall de capacidades necesarias y omisiones de mandato. El catálogo completo actual cuesta contexto, pero filtrarlo sin evaluación puede ahorrar bytes a costa de perder precisamente las facetas exigidas por el usuario.
- No eliminar para ahorrar: aceptación independiente, evidencia factual, comprobación de estado actual, obligaciones tipadas o recuperación/fencing. Cachear una aceptación no convierte un archivo mutable en evidencia vigente. Tampoco reducir reviewers a votos coincidentes.

## Evaluación siguiente necesaria

Extender con peticiones ambiguas, varios requisitos, fuentes contradictorias, devolución por defecto material, necesidad de aislamiento, cambio de archivo y límite de contexto. Comparar planes elegidos por proveedores reales con referencia humana de obligaciones y evidencias, medir corrección/omisiones además de llamadas, y registrar incertidumbre y presupuesto. La batería actual es una regresión reproducible de coste estructural y controles concretos; **no acredita «máxima eficiencia», autonomía general o completitud al cien por cien**.
