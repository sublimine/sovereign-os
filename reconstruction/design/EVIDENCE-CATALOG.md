# Referencias a evidencia observada — evidence-catalog-v1

Estado 2026-09-10: instalado en 1d2c4b6e; disponible explícitamente o dentro de
adaptive-v1, seleccionado por la skill para nuevas peticiones. El CLI sin preset
conserva su predeterminado; no se reescriben revisiones guardadas.

## Problema y elección

En UndLIqUb, la revisión real `run:f948e4ff-87d3-4dc9-9f98-84f2cc2e8b48`
copió incompleto un hash de evidencia del candidato
`artifact:aaa5a40a-e859-4161-84ea-24e994cdc8be`. La revisión se rechazó correctamente
por SCHEMA y se repitió; se conserva el rechazo. El hash principal sí era correcto.
La fidelidad mecánica al copiar identificadores no es el juicio que necesitamos
del revisor. Ya existe un transporte de referencias y se amplía localmente: no
requiere otro SDK, base de datos o agente.

El controlador enumera los objetos del contexto real completo y añade un catálogo
`sourceKey → kind/id/hash`. El juez selecciona una clave y escribe la cita literal.
La expansión toma la identidad exacta del catálogo de **esa inferencia**, sin
buscar coincidencias aproximadas, adivinar otra fuente o corregir su cita. El
registro conserva respuesta cruda, catálogo/hash, hash de exposición completada,
recibo de inferencia y hash de la expansión.

## Obligaciones que no cambian

- Siguen expuestos el cuerpo completo, fuentes crudas, observaciones y criterios;
  no se resumen fichas ni se omiten criterios. Clave válida no significa verdad.
- El registro de aceptación original vuelve a comprobar cita, exposición,
  identidad, actor, orden, efectos, independencia y veredicto. Este transporte no
  reemplaza esas comprobaciones ni demuestra por sí mismo soporte semántico.
- `tool-history` permanece diferente de una lectura/ejecución propia actual.
  El catálogo no transfiere una acción de otro actor ni su autorización.
- Sólo se reconocen claves del catálogo efectivo de esa inferencia. No se acepta
  un catálogo del modelo, claves inventadas, evidencias sin usar, campos de hash
  adicionales o expansión por encima de los límites originales.
- Un intento de reparación conserva catálogo y respuesta anteriores como historia;
  las nuevas claves se interpretan con el catálogo nuevo, no con posiciones antiguas.
- El ámbito de aprendizaje incluye este formato. Una instrucción evaluada para
  otro formato no queda validada automáticamente para éste.

El hash principal del candidato sigue en la respuesta. La selección de objeto y
la cita pueden equivocarse: se rechazan, no se arreglan en silencio. Identidad,
proveniencia, soporte y relación entre fuentes son propiedades diferentes.

## Pruebas y límites

Ocho pruebas nuevas: cinco de transporte/adversarias y tres de integración con
SQLite, broker, escritura/lectura propias y proveedor simulado. Incluyen cita
falsa rechazada, reparación sin nuevo candidato y reentrada sin inferencia.
Regresión `suite-jj3iI8`: 496 totales, 495 PASS, un SKIP live, cero fallos.

La cualificación siguiente fija casos, oráculo, harness y paquete antes de la
inferencia. Incluye una respuesta cerrada y una petición documental que debe
derivarse y adquirir dos fuentes reales de orígenes HTTP distintos sin inventar
independencia probatoria. No es una comparación causal de tokens ni demuestra
menor tasa general de error por una sola ejecución satisfactoria.

### IcWvS5Z8 — resultados originales conservados

La respuesta cerrada se completó con dos llamadas y 20.454 tokens. Sus vínculos
de catálogo, exposición/recibo y expansión fueron correctos. En la tarea
documental se adquirieron las dos fuentes y el catálogo también preservó los
juicios y sus citas, pero el producto quedó WAITING_CAPABILITY. El juez devolvió
un UNKNOWN sobre recorridos intermedios de redirección no registrados por el
broker; el siguiente productor no inventó esa evidencia. Siete llamadas y
147.172 tokens en ese caso, sin entrega. El resultado global sigue siendo FAIL.

La revisión documental completa se leyó: factualidad, relación normativa y
límites operativos fueron PASS; faltaba prueba histórica de destinos intermedios.
Omega_23 produjo, Omega_11 y Omega_10 revisaron en otro hilo. Sus fichas se
conservaron completas; el uso conjunto no prueba su valor marginal frente a una
sola faceta. El error motivó [trazas HTTP](HTTP-ACQUISITION-TRACE.md), no una
relajación del juicio. Una misión nueva `BoYUO09A` cualificó esa corrección;
no certifica retrospectivamente el recorrido de IcWvS5Z8.

### BoYUO09A — nueva adquisición completada

Finalizó el 10 septiembre a las 02:13:19 UTC: 18 controles PASS, seis inferencias
reales / 124.663 tokens, sin correcciones. El preset quedó resuelto y firmado
antes de inferencia. La entrada derivó correctamente; plan, adquisiciones,
candidato y juez ocurrieron en ese orden. Las dos trazas completas contienen
un único HTTP 200 cada una, con URL y hash final concordantes con las fuentes
citadas. No se observan otros efectos en esta misión.

La lectura semántica del plan, producto, claims y motivos de sus cinco checks de
plan y catorce de producto confirmó la lista de dominios, el estado registral,
la remisión IANA → RFC y la diferencia entre esa relación y raíces probatorias
independientes. El plan conserva un lapsus «ocho claves» seguido inmediatamente
de su resolución explícita a las siete enumeradas; el juez lo detectó y el
producto contiene siete. No se corrige retrospectivamente ese registro.

El oráculo original sigue FAIL por su techo no solicitado de 400 caracteres;
el pasaje literal IANA tiene 415. El oráculo v2, congelado antes de esta misión,
retira únicamente ese techo y conserva estructura, valores, URLs y literalidad.
Ambos resultados se publican juntos. La revisión semántica acepta el pasaje
continuo que respalda registro y referencia; no hubo normalización de sus bytes.

Resultado: `/home/cardeex/codex-workspace/sovereign-catalog-trace-live-BoYUO09A/summary.json`.
Producto `artifact:867ed35c-a1f9-458a-bd07-cc5692610c3b`, hash
`76674516c582b85772fc91a86839810be20e6d64f90b8bba348cc0675334e8db`;
revisión `review:8668ef04-9f7a-4288-9065-a8e572b2477a`.
La regresión del paquete instalado es suite-VDSdya: 511 pruebas, 510 PASS,
cero fallos y un SKIP live. No es una medición causal de ahorro ni un certificado
de calidad universal, de raíces independientes o del mandato completo.
