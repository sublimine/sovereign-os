# Relaciones observables entre fuentes

9 septiembre 2026. `factory/lib/source-relationships.mjs` presenta las coincidencias
que el registro ya permite comprobar a partir de fuentes efectivamente expuestas.
El revisor recibe la misma clase de información, sin conversaciones del productor.

Se agrupan hashes de bytes idénticos y orígenes HTTP finales iguales. Una página
copiada puede estar en otro dominio; por eso no se cuentan dominios como votos.
Dos contenidos idénticos tampoco demuestran por sí solos que sus observaciones
sean independientes o dependientes. Igualmente, compartir origen no prueba que
sean del mismo autor. No se emiten puntuaciones de fiabilidad ni se inventa una
raíz independiente: se mantiene `NOT_ESTABLISHED` hasta que haya evidencia.

No se realizan solicitudes de red para estas agrupaciones, ni se borran o resumen
fuentes. La representación agrupa identificadores y evita enumerar todos los pares.
El contexto extra sólo aparece con varias fuentes. Los tests cubren copias entre
orígenes, distintos puertos/esquemas, hosts engañosos, 500 copias, datos inválidos y
aislamiento entre contextos. Corte `suite-Qbe8hT`: 364 PASS, cero fallos y un SKIP.

## Comprobación documental real

El ensayo `sovereign-multisource-live-fXM8DG2h` contrasta dos páginas oficiales de
SQLite: el estado normal desactivado y la opción de compilación que cambia el
estado inicial, junto a límites de configuración por conexión/transacción.
La interpretación de referencia distingue condiciones; no fabrica una disputa
entre dos mediciones incompatibles. Sus expectativas se fijaron tras leer
[Foreign Key Support](https://www.sqlite.org/foreignkeys.html) y
[Compile-time Options](https://www.sqlite.org/compile.html#default_foreign_keys).

El agente no recibe el oráculo. Recupera las páginas, produce una respuesta y la
somete a revisión independiente. El comprobador exige valores estructurados,
citas presentes, adquisición anterior al candidato y las dos fuentes en el contexto
del revisor. La ejecución local de SQLite y los archivos están fuera de permiso.
Este caso no prueba resolver contradicciones empíricas entre editores independientes.
El estado real del ensayo y sus eventuales fallos se conservan en STATUS.md y su
directorio; prepararlo no equivale a haberlo aprobado.

Resultado observado el 9 de septiembre de 2026 a las 19:57:52 UTC: COMPLETED,
12 controles PASS, cinco inferencias reales y 327.794 tokens observados. Ambas
páginas responden HTTP 200 y se adquieren antes del candidato. Los campos del
oráculo, las dos citas y la exposición de ambas fuentes al revisor pasan. Las
raíces siguen UNKNOWN; compartir SQLite no se vende como dos corroboraciones
independientes. Este éxito acotado no acredita eficiencia ni resolución universal
de fuentes contradictorias. Se conserva el informe íntegro en el directorio del
ensayo, sin sustituirlo por esta síntesis.
