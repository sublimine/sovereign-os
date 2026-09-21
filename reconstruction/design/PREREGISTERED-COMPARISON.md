# Comparación exacta después de la réplica revisada

12 septiembre 2026. Implementación en desarrollo; no instalada ni habilitada
en el planificador ordinario. Extiende el adaptador cerrado, no constituye otro
motor de orquestación. La cualificación semántica real sigue pendiente.

## Decisión y límites

Cuando comparar sólo requiere una igualdad literal o una distancia decimal
exacta, otra generación no aporta una operación más fiable. Se reutilizan las
operaciones nativas de JavaScript y BigInt para calcular, ArtifactRegistry para
el producto y WorkerService para su revisión independiente. La selección de la
regla y su ajuste al problema siguen siendo juicios materiales; no se sustituyen
por una firma, la coincidencia de dos cadenas ni un código de retorno.

El preflight de persistencia/comparación de LangGraph/LangSmith está documentado
en [réplica sellada](SEALED-REPLICATION.md). Aquí no se añade un segundo framework
ni un servicio de pago para comparar dos valores. Graphify situó el registro y
los trabajadores existentes; su grafo anterior no describía esta extensión y
se contrastó el código actual antes de integrar los puntos de revisión.

La API de controlador `BlindReplicationService.compare(replicationId)` no
acepta tolerancias, resultados, campos a seleccionar ni un modelo. Usa únicamente
la regla presente en el protocolo público aceptado **antes del freeze**. Exige
el intento sellado aceptado antes de abrir, calcula y crea un candidato. Después,
un revisor evalúa ese informe mediante el mismo WorkerService que el resto de
los productos. No se crea una nueva réplica para obtener una coincidencia.

## Contrato ejecutable prerregistrado

`public.comparison` es opcional para conservar protocolos anteriores. Si falta,
`compare()` devuelve BLIND_COMPARISON_RULE antes de abrir o crear un comparador;
no infiere un algoritmo de la tolerancia escrita en prosa.

Sólo existen dos reglas en esta versión:

- `{"kind":"exact-text-v1"}` compara el cuerpo completo del original con el
  campo `result` completo de la réplica. No recorta espacios, cambia mayúsculas,
  normaliza Unicode, extrae JSON, compara fragmentos ni equipara igualdad literal
  a equivalencia semántica.
- `{"kind":"decimal-distance-v1","absoluteTolerance":"0.2","unit":"dimensionless"}`
  compara `abs(original - result) <= absoluteTolerance`. Los tres operandos son
  cadenas decimales exactas; se alinean escalas con enteros BigInt. No hay números
  binarios de punto flotante. La unidad es una declaración que el juicio debe
  verificar, no una conversión de dimensiones efectuada por el controlador.

Los valores completos deben ser decimales ordinarios sin espacios ni exponente,
con hasta 300 dígitos enteros y 300 fraccionarios y hasta 600 caracteres. Una
tolerancia negativa, fuera de límite, no textual o con otra sintaxis se rechaza
al validar el protocolo. Una representación de resultado/original no soportada
produce UNKNOWN con motivo explícito. No se extrae un «42» de «42 metros» para
fabricar compatibilidad. Los límites acotan cálculo y memoria, no certifican
que 300 dígitos correspondan a precisión física justificada.

El revisor del protocolo debe comprobar que esta regla coincide con el alcance
y la tolerancia en prosa. El revisor del informe vuelve a evaluar su pertinencia.
La comprobación mecánica no pretende demostrar esa equivalencia semántica.

## Datos, procedencia y orden

El cuerpo conserva original completo, estado histórico al abrir, protocolo
público, réplica completa, cálculo, controles no PASS, desviaciones, desconocidos
y obligaciones restantes. MISMATCH y UNKNOWN son salidas legítimas. Incluso en
MATCH se conserva `replicationEstablished:false`: igualdad no acepta la afirmación
original, no salva controles fallidos ni prueba independencia cognitiva.

`blind-comparison` v1 firma el candidato exacto y las versiones de apertura,
original, intento aceptado y actor determinista nuevo. El actor no es el
replicador; no tiene solicitud, recibo de modelo, herramientas ni efectos. La
proyección `artifact-blind-comparison` recalcula el informe desde esas entradas
y valida referencias y secuencias positivas del journal. El orden exigido es:
vínculo del intento, exposición del juez, decisión, material aceptado, apertura,
actor comparador, candidato y vínculo de comparación. El original histórico
también debe existir antes de la apertura.

El original es un **objeto bruto de comparación**, no una premisa ya verificada.
Por eso no se lo hace pasar por `inputRefs` aceptados ni se le inventa una revisión.
La dependencia material real y la revocación se verifican explícitamente por el
vínculo de comparación: el intento debe seguir aceptado para su propósito exacto,
su última aprobación debe ser la que autorizó abrir, y protocolo, original,
política, actor, sello y apertura deben seguir vigentes. Estos registros siguen
visibles en el informe aunque el original permanezca CANDIDATE.

Para aceptar, el juez debe citar la observación autenticada que recibió él mismo,
además de evaluar los cinco criterios completos: vínculo, objetivo comparable,
regla, incertidumbres y alcance. Citar sólo el cuerpo o tomar la prueba de otro
actor se rechaza. El juez no puede reutilizar el hilo del productor original ni
el del replicador. Se conserva la revisión general y su prohibición de
autocertificación; no se añade una etiqueta de éxito automática al cálculo.

Reentrar devuelve el mismo candidato y su estado, incluido RETURNED, sin más
inferencias, actores ni informes. Una firma reescrita o cambio del original no
devuelve un éxito de caché. La lectura histórica `current:false` conserva los
hechos registrados sin reactivar una dependencia retirada. No es defensa frente
al administrador que controla tanto la base como su autoridad de firma.

## Defectos descubiertos al integrar

Una prueba mostró que el control de revisión cerrada también bloqueaba productos
ordinarios cuyo antecedente era un intento ya aceptado. Se separa ahora el
propósito del producto juzgado del tipo de sus antecesores. El juez real del
intento sigue necesitando propósito y candidato cerrados exactos; otra prueba
impide evitar ese control cambiando el propósito declarado. No se relajan las
restricciones de contexto de una réplica ni de su juicio material.

Otra prueba aprobó legítimamente el original después de abrir y antes de
comparar. Consultar su head actual producía una cronología imposible. Se conserva
ahora la última versión anterior a la apertura, vinculada al mismo contenido;
la aceptación posterior no se retrotrae y tampoco bloquea por sí sola una
comparación válida. Ambas contrapruebas fallaron antes de las correcciones.

## Verificación y siguiente frontera

### Evidencia de aprobación previa, 12 septiembre 14:35 UTC

La revisión real de xMileM devolvió la comparación correcta porque su observación
no mostraba el gate privado del protocolo. La comprobación existía en freeze y
apertura; su existencia en el controlador no equivale a exposición ante el juez.
No basta describir el campo público completo para acreditar ese acto previo.

En desarrollo, `blind-approval.mjs` reutiliza exactamente la resolución histórica
de aprobación usada por el freeze. `artifact-blind-comparison.protocolApproval`
vincula protocolo aceptado, juicio, versión del juez con inferencia completada y
original observado, productor original y secuencias anteriores a freeze/envío.
Usa la última aceptación exacta y el estado anterior a su commit, no el contexto
actual del revisor ni las fechas de pared. Un cambio posterior no retrocede en
el journal. Esta proyección no crea actores, aprobaciones, resultados o permisos.

Sólo la fase posterior a apertura incorpora esa evidencia; ni solicitud de réplica
ni juicio material reciben referencias privadas adicionales. El cuerpo original
de comparación, criterios, regla, sello y unknowns no cambian. El mapa prospectivo
explica la nueva observación, distinguiéndola de un nuevo campo del cuerpo.
La convergencia posterior sigue permitida cuando aporta una obligación real,
no se fuerza su eliminación basándose únicamente en tamaño del contexto.

Una prueba primero FAIL por falta de la proyección; después 95 tests de la ruta
PASS (47,27 s) y tres de integración/proyección/imports PASS (32,72 s). Incluyen
falta de historial, secuencia ausente o posterior, cambios de exposición después
del juicio, lectura histórica tras retractación y no filtración al intento.
Proveedor semántico simulado en estas pruebas: no constituyen validación real
del arreglo ni cambian el resultado histórico xMileM. Regresión completa en curso.

Extensión A9wggt posterior: una revisión real del mismo informe con evidencia
ampliada recibió cinco PASS/ACCEPT, preservando RETURN anterior, resultado y
controles; [lectura sustantiva y límites](../verification/COMPARISON-EVIDENCE-A9wggt.md).
No se reanudó la misión ni se reetiquetó la cualificación anterior. La proyección
incluye el juicio previo completo y sus citas, no sólo una referencia/status.

El archivo dirigido contiene 61 tests PASS, 17,97 s, incluyendo los 39 anteriores
y los casos añadidos. Un test recorre 627 combinaciones numéricas contra una
referencia de enteros pequeños escalados; no se cuentan como 627 tests separados.
Hay valores más allá de la precisión entera de Number, fracciones largas,
negativos, tolerancia límite, entradas no soportadas, revocación, evidencia
prestada, reutilización de hilo, retorno conservado y cambio de historia.

WorkerService revisa el informe con plain-json/expanded-json,
lossless-v1/evidence-refs-v1 y lossless-json-v2/evidence-catalog-v1, conservando
cuerpo, criterios y evidencia completos. El cálculo y SQLite son reales; los
juicios y el proveedor son dobles simulados. No hubo llamada de suscripción,
instalación, cambio del servicio ni modificación de una misión de producción.

Regresión completa [suite-WDoQD8](../verification/runs/suite-WDoQD8/summary.json),
completada 09:46:07.110 UTC: 630 pruebas, 629 PASS, cero fallos y un SKIP live,
74,89 s. Los 182 inputs fijados coinciden con el código a las 09:47. El corte
anterior suite-YN9ifX (608/607 PASS) se conserva y no se presenta como si incluyera
esta extensión posterior.

Faltan el enlace causal de esta ruta en el planificador, su recuperación integral
de extremo a extremo y la cualificación real con las mismas reglas previamente
fijadas. La comparación semántica general no está implementada por estas dos
reglas. Tampoco se ha implementado una aceptación automática del original: una
conclusión factual o empírica necesita sus obligaciones propias y una decisión
material distinta cuando proceda. R01–R16 permanece pendiente.
