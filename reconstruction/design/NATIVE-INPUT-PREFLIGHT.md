# Copias literales: contrato e implementación prospectiva

## Estado posterior — 12 septiembre, 17:44 UTC

Actualización 18:01: regresión cRbG5M completa, 739 pruebas/738 PASS/cero fallos/
un SKIP, 213 inputs/salidas verificados 17:57:14.464. Paquete ba4e6ca4 congelado,
397 archivos/23837533 bytes, 60 inputs runtime coincidentes 17:58:03.198.
OZcLj2 se lanzó una sola vez a las 18:00:14.935 en ese paquete, después de
auditar ODeAyj COMPLETED. Sigue en planificación; no hay aceptación ni ahorro
real demostrado aún. Harness/oracle conservados, servicio sin cambios.

Actualización 17:52: el paquete b00b565a no se lanzará en la cualificación.
Una salida real del controlador de prueba tras registrar/adquirir la copia,
antes de materializar, creó una segunda identidad al recuperar. Corregido con
commit conjunto de registro/claim y reutilización del origen exacto revalidado.
Quince pruebas dirigidas PASS, cuatro con salida abrupta real de proceso propio
y proveedor simulado; regresión posterior requerida. Los primeros fallos y el
preflight supersedido se conservan en NATIVE-INPUT-LIVE-PREFLIGHT.md.

Implementado **en desarrollo, no instalado ni cualificado con un juez real**.
Se conserva debajo el preflight previo, no se modifica el ensayo wmUkhp ni
ODeAyj (este último sigue ejecutando su runtime congelado 1588b9b9).

`literal-input-copy-v1` selecciona un requestQuote único dentro de la petición
inmutable y un copyText único dentro de ese quote. El motor deriva posiciones
UTF-16 semiabiertas y copia el fragmento real, conserva hash/bytes UTF-8,
espacios, CRLF y caracteres combinados. Rechaza ausencia, ambigüedad, solapamiento
y Unicode mal formado; no normaliza ni adivina qué ocurrencia escoger.

El plan debe ser aceptado previamente con los controles fijos de selección y
fidelidad, más todas las obligaciones adicionales. El nodo nativo tiene
roleIds=[], specialist=null y no puede pedir dependencias productoras,
herramientas ni efectos. No se inventa una ficha de razonamiento para copiar.
Mantiene una identidad nativa nueva, origen firmado y cronología:
petición → plan aceptado → identidad → origen → candidato → juicio independiente.
Su plan sigue siendo una dependencia aceptada y visible al juez; la política
node-contract-v1 se conserva en el contexto registrado del productor.

El juez recibe el objeto completo, la petición, plan y observación autenticada
artifact-input-copy. Debe citar esa evidencia y juzgar que se seleccionó el
objeto solicitado: una coincidencia literal no acredita pertinencia. El producto
no contiene claims ni recibos LLM/operaciones ficticios. Su identidad no se
reutiliza para otro candidato o tipo de producto. Aceptar fidelidad no acredita
verdad. Invalidar el plan invalida la copia y consumidores; un replan necesita
una nueva vinculación. La cuota recupera el candidato exacto; un RETURN material
detiene esta ruta, no genera idénticas copias y votos sucesivos.

Primer corte de pruebas: 3 PASS/7 FAIL, todos los fallos por PLAN_VIEW; el
productor no respetaba la vista de nodo seleccionada. Se reutilizó
producerPlanView en lugar de desactivar el guard. Después: 10/10 PASS, y batería
ampliada posterior 41/41 PASS, incluyendo tres codecs, consumidor posterior,
cuota/reanudación, revocación y origen/cuerpo/criterios adulterados. Prueba
adicional planned-blind PASS (14,585 s): sólo el autor del protocolo hace una
inferencia productora; una única réplica y no exposición del original/origen a
los actores cerrados. Reentrada sin llamadas nuevas. Juicios simulados.
Regresión completa 6NYrsp: 734 pruebas/733 PASS/cero fallos/un SKIP,
214599,30 ms; 209 inputs y salidas verificados 17:28:16.441. Congelado b00b565a
después, sin instalar. Tras añadir un harness y oracle externo de selección,
regresión bKBKdE: 735 pruebas/734 PASS/cero fallos/cancelaciones/todo/un SKIP,
206254,96 ms. Verificación 17:44:26.881: los 212 inputs, conjunto completo y
salidas coinciden, sin interrupción; los 60 inputs runtime coinciden con el
paquete b00b565a, 397 archivos/23836139 bytes, sin runtime adicional no probado.

El harness prospectivo run-live-input-copy.mjs plantea un objeto con CRLF,
Unicode descompuesto, espacios y un distractor. Su oracle prueba igualdad exacta,
nodo nativo aceptado, todas las obligaciones y ausencia de claims/efectos;
una prueba con 22 mutaciones PASS comprueba su rechazo. Sólo planificador y
jueces reales, máximo ocho despachos, sin inferencia productora ordinaria ni
segunda misión automática. Aún no lanzado: se espera el cierre del ensayo
integrado anterior, que no contiene esta implementación.

La reducción estructural de una llamada productora está probada en estas
integraciones simuladas. **No** se ha medido ahorro real de tokens/latencia,
precisión de selección de un planificador real ni eficiencia general.

## Preflight previo (conservado)

## Motivo observado

wmUkhp devolvió su primer plan por usar un rol de dossier para conservar dos
caracteres. La recuperación propone un especialista de transcripción. Se
mantiene ese ensayo intacto: cambiar ahora su ruta confundiría cualificación
con ajuste al resultado. El fallo y el coste están en
`../verification/PLANNED-BLIND-LIVE-wmUkhp.md`.

La crítica de eficiencia es distinta: cuando el usuario pide conservar un
fragmento exacto de su propia entrada, producirlo mediante una inferencia añade
latencia y una posibilidad de alteración que una copia exacta no necesita.
No se deduce que todo trabajo literal o todo requisito pueda omitir juicio.

## Reutilización inspeccionada

Graphify orientó a ArtifactRegistry, WorkerService y PlanLedger; sus líneas
históricas se contrastaron con el código actual. `ArtifactRegistry.create`
permite origen explícito `deterministic-result`; la comparación cerrada usa
un productor nativo sin recibo de inferencia, con binding firmado y recálculo.
`PlanLedger` conserva dependencia y aceptación. Es el patrón que se debería
reutilizar, no un segundo registro ni un sistema de autoridad paralelo.

El tag por sí solo no basta: no se ha encontrado un adaptador genérico de
entrada de misión con selección, atribución y prueba independiente completas.
No debe anunciarse como capacidad actual ni añadirse sólo al prompt.

## Condiciones para una implementación prospectiva

- Selección exacta y no ambigua de un fragmento de la petición inmutable,
  con hash de entrada, posición/unidad de índices y hash del resultado.
  No búsqueda semántica escondida, normalización, interpretación numérica,
  copia de datos de otro nodo ni fragmentos de otra misión.
- Selección y finalidad explícitas en un plan revisado antes de ejecutar.
  El juez del plan comprueba que el fragmento corresponde a lo pedido, no sólo
  que aparece en algún lugar. Una aparición exacta no prueba selección correcta.
- Productor nativo declarado y vinculaciones verificables, no recibos LLM
  fabricados ni rol ficticio que simule razonamiento o conocimiento.
- Aceptación de fidelidad separada de aceptación factual. Conservar `62` no
  lo convierte en el determinante correcto ni en una fuente empírica.
- Evidencia íntegra visible al juez; mismas reglas de invalidación, reentrada,
  propiedad y ausencia de efectos. Mantener la separación privada de la réplica.
- Negativos: selección desplazada/ambigua, Unicode, hash alterado, cambio de
  plan, reutilización de productor, criterio omitido, fuente ajena y promoción
  de una copia literal a afirmación verdadera. No ajustar pruebas para aprobar.

## Decisión de este corte

No implementado, activado ni aplicado a wmUkhp. Terminar primero su revisión
integrada y conservar una atribución limpia a 4b31034b. Después se puede comparar
una ruta nativa con la productora conservando pedido, plan, criterios y límites.
El ahorro esperado de una inferencia productora es una hipótesis estructural,
no ahorro de tokens/tiempo ya observado ni permiso para quitar otros procesos.
