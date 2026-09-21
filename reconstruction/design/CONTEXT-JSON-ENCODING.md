# Transporte exacto de texto incluido en JSON

9 septiembre 2026. La política `lossless-json-v2` es experimental y opt-in. No
filtra fuentes ni selecciona pasajes. Resuelve una amplificación observada: una
fuente completa estaba en `raw`, en resultados estructurados y dentro de cadenas
JSON como `resultText` y `quoteText`. V1 compartía strings iguales, pero no el
mismo texto incrustado dentro de esas cadenas escapadas.

## Contrato

Sólo una cadena JSON de objeto/array que puede reconstruirse **byte por byte** con
`JSON.stringify` sin indentación se representa mediante `$sovereignJson`.
El marcador conserva el tipo original: sigue siendo una cadena, no un nuevo
documento o una instrucción. Sus componentes resuelven el mismo pool de texto que
los campos directos. No cambia el registro de adquisición, el hash de la fuente,
actor, metadata, criterios, citas ni manifestación de exposición del runtime.

Whitespace no canónico, escapes Unicode diferentes, duplicados de keys y números
escritos de otra forma siguen como texto literal. Objetos de datos que usan nombres
de marcadores se escapan; nunca se convierten por accidente en referencias. JSON
documental demasiado profundo permanece texto completo. El decoder comprueba
formato, pool íntegro y utilizado, referencias, hash/longitud lógica, profundidad,
cantidad de nodos y expansión incremental de bytes. No ejecuta el contenido.

Se elige v1/JSON ordinario si v2 no reduce suficientemente los bytes. Tanto el
límite lógico del codec como el límite más estricto del worker siguen vigentes;
la compresión no concede más contexto. La política queda fijada en misión y en
los ámbitos de instrucciones aprendidas. Se conservan los valores predeterminados.

## Evidencia

- Corte `suite-Dwsi2c`: 390 pruebas, 389 PASS, cero fallos, un smoke live omitido.
  Casos incluyen Unicode/control, JSON anidado, strings originales, marcadores
  hostiles, claves de prototipo, manipulación, referencias no usadas, amplificación,
  límites, CLI/reentrada, revisión independiente y retracción posterior de fuente.
  Proveedores simulados se identifican; broker, SQLite y archivos son reales.
- Replay en SQLite sólo lectura, `json-context-historical-9b5fba01.json`: conserva
  exactamente nueve exposiciones guardadas sin emitir claves ni realizar efectos.
  Revisor multifuente: 811.536 bytes lógicos → 435.935 con v1 → 240.219 con v2;
  productor: 599.728 → 412.155 → 216.437. No incluye el sobre de tarea de cada
  inferencia, no mide tokens y no demuestra comprensión equivalente.
- Ensayo real `sovereign-json-context-live-AKYAUr1B`: cuatro decisiones sobre dos
  casos sintéticos de evidencia contradictoria, condiciones diferentes y órdenes
  incrustadas. Se alternó el orden v1/v2. **Cuatro aciertos**: inputs 17.940 →
  15.735 tokens; totales 18.211 → 15.978. Mismo input lógico, tarea, rol y modelo;
  las instrucciones necesarias para interpretar cada formato son distintas.
  Es un par por caso, no calibración universal o adquisición real de esas fuentes.
- Ensayo de misión completa con dos adquisiciones reales preparado por separado:
  `run-live-multisource-json.mjs`, mismo pedido/oráculo documental anterior,
  runtime fijado `9b5fba01`. Estado actual en STATUS; no se presupone aprobación.

### Misión completa observada

`sovereign-multisource-json-live-rDWGcCGs` terminó a las 21:01:36 UTC, COMPLETED,
15 controles PASS y cinco inferencias reales sin fallos. Se adquirieron ambas
páginas con los mismos hashes de bytes que en la cualificación anterior; sus
raíces siguen UNKNOWN. La revisión independiente conserva todos los campos del
oráculo, citas, condiciones, ausencia de código/archivos y reentrada sin efectos.

Consumo observado: 184.773 tokens de entrada, 24.354 de salida, 209.127 totales;
67.968 de entrada cacheados. Revisor: contexto lógico 816.155 bytes, transporte
244.698. La ejecución anterior v1 totalizó 327.794 tokens con otro plan (15 frente
a 14 criterios) y otras condiciones de ejecución: **no es un par causal aislado**.
El resultado acredita funcionamiento completo de este caso con v2, no eficiencia
óptima, latencia garantizada ni igualdad general de razonamiento.

Ni deduplicación exacta ni un juicio coincidente garantizan la veracidad de una
fuente. Las comprobaciones de procedencia, soporte, independencia y vigencia
siguen siendo obligaciones distintas después de adquirir el contenido.
