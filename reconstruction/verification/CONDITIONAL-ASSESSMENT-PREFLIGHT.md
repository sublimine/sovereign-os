# Evaluación condicional separada — contrato prospectivo

Fecha: 12 septiembre 2026, 23:34 UTC. Ninguna llamada real de este ensayo
realizada al fijar este contrato. [Antecedente](DEPENDENCY-INFERENCE-PROVENANCE.md).

## Pregunta evaluada y alcance

¿Puede el juez distinguir selección y fidelidad de una copia nativa cuando la
aprobación previa es explícitamente un checkpoint de fixture, y entregar un
juicio diagnóstico que no se convierta en aceptación operativa?

El criterio diagnóstico es un objetivo nuevo y explícito. No modifica ni
reinterpreta la obligación original del producto, el oracle o los resultados
de XrlCqq. Sus fallos y desacuerdos permanecen. Tampoco se repite 24pcUY.

Los dos casos nuevos comparten petición completa con Lote UNO y Lote DOS,
identificadores 1837/1849, CRLF, emoji, Unicode descompuesto y backslashes
literales. La petición requiere DOS. Sólo cambia el selector del plan:

| Caso | Selector | Selección esperada | Fidelidad esperada |
|---|---|---|---|
| case-0 | DOS | PASS | PASS |
| case-1 | UNO | FAIL | PASS |

Son dos casos diagnósticos conocidos, correlacionados y preparados por el
operador; no un holdout amplio ni una estimación de precisión general.
Expectativas y hashes del oracle se conservan localmente; no son campos del
contexto del juez. La petición original, los artefactos y las pruebas completas
sí se exponen.

## Implementación

`ConditionalAssessmentService` usa la creación de trabajadores, fichas completas,
contexto, límites, transporte y registro de inferencias existentes. Conserva el
modelo/effort de la misión; este ensayo mantiene Astra/ultra y perfil del preset
adaptive-v1. No añade una API, un bypass de cuota ni otro proveedor.

El registro PREPARED fija producto, versiones de entradas, criterios diagnósticos,
hash de criterios originales, intención y política. La condición explícita sólo
permite tratar las aprobaciones previas como checkpoints de fixture: no supone
que su selección/conclusión sea correcta ni que sus autores sean modelos reales.

El resultado firmado tiene tipo CONDITIONAL_DIAGNOSTIC y
`operationalAcceptance:false`; no admite un campo decision/ACCEPT. Los criterios
diagnósticos son distintos de las obligaciones operativas originales, que no se
eliminan. Sólo soporta productos puros, sin claims empíricos ni efectos requeridos,
recibos de herramientas o operaciones de misión. La revisión ciega cerrada y los
informes de comparación quedan excluidos de esta vía.

Controles en código, no sólo en el prompt:

- El actor diagnóstico no puede pasar por `ArtifactRegistry.review` ni recibir
  leases de herramientas de `WorkerService`. El vínculo de la versión original
  se comprueba, incluso si posteriormente cambia la cabeza del registro.
- Una ejecución reclama DISPATCHED antes de inferir. Una llamada concurrente,
  fallida, cancelada o con salida inválida no se reintenta con la misma identidad.
- Se valida cobertura exacta, citas observadas, exposición completada, separación
  del productor y ausencia de cambios en candidato, prerrequisitos, política y
  efectos. Una revocación durante inferencia impide registrar el resultado.
- Un resultado ASSESSED se relee sin nuevas inferencias ni cambios de journal.
  Leerlo conserva su carácter histórico: no reactiva un producto revocado.
- El harness guarda solicitud y respuesta/recibo antes de la validación de
  aplicación. Un fallo de forma o evidencia es fallo, no un rechazo correcto.

Un PASS diagnóstico sigue siendo un juicio del modelo, no prueba de verdad.
La firma demuestra vínculo local, no pericia ni atestación del proveedor.

## Límites del ensayo

Máximo **dos inferencias reales**, una por caso, sin reparación de forma/evidencia
ni segundo voto. Dos pasos upstream simulados por caso, ambos etiquetados en
sus recibos. Materialización nativa sin productor LLM. Ninguna llamada al motor
completo después de la planificación de fixture, ningún ACCEPT del candidato,
ni misión operativa marcada COMPLETED. No instalación, reinicio, publicación,
compra, cambio de seguridad ni cola ordinaria nueva.

Un juicio semántico incorrecto válido se conserva y se pasa al siguiente caso
preespecificado. Fallos de transporte, cuota, esquema, evidencia, integridad,
freeze o interrupción detienen el resto. Los límites anteriores son del harness;
los eventos de transporte del proveedor se conservan aparte, sin ocultarlos.

Cada caso debe acreditar: origen nativo y cuerpo exactos; procedencia simulada
de prerrequisitos expuesta; petición y fichas completas; un solo juicio;
artefactos/reviews/misión/plan/nodos/orígenes/efectos sin cambios materiales por
el diagnóstico; cero efectos; reentrada sin journal nuevo. Tras terminar se leen
las razones/citas y recibos reales, se verifican hashes y se informa coste/duración.
No basta el booleano passed del harness para declarar cualificación semántica.

## Pruebas previas y error observado

22 dirigidas PASS: 16 del servicio y dos integraciones nativas simuladas incluidas,
más seis del harness (positiva/negativa, veredicto incorrecto, cita inválida,
cuota y freeze). Cero llamadas reales. Todos los proveedores son fixtures.

La primera ejecución de las dos integraciones falló con ENGINE_OWNERSHIP:
el montaje llamó a la planificación sin adquirir el propietario exclusivo antes
de instalar el plan. El runtime lo rechazó. Se corrigió el montaje para adquirir
y liberar el propietario; no se eliminó el control ni se alteraron criterios.

La regresión definitiva **suite-mrjFVh** comenzó a las 23:34:22.471 UTC,
sesión 85261, **237 inputs / 64 runtime**. No ejecutar el ensayo real hasta
resultado completo e íntegro y snapshot de runtime coincidente.

Puerta superada antes del ensayo (23:38:10.924 UTC): regresión terminada
23:37:43.138, **817 pruebas / 816 PASS / cero fallos / un SKIP live opt-in**,
200583.502722 ms. Sesión 85261 cerrada exit 0. Conjunto completo de 237 inputs,
64 runtime y streams verificados, sin adiciones/omisiones ni hashes distintos.
Resumen `676e6d7219aadcac3834f994c1d7a49d75fe55857f098a9220fff631da7e78f9`;
TAP `60e995a2d6dbdf5855ca42f9f5074166789a45cade5fdc2097fa2de09abc4d59`;
stderr vacío `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`.
Runtime aislado **401 archivos / 23872507 bytes**, 64 inputs coincidentes:
`6d198c9f38655d313bbf9e0e8672232974cf28db6901264d6904770e8579b5c1`.
No instalado. La lectura de cuota no mostró límite alcanzado; no se ha usado
ningún reset, crédito ni API. Esa lectura no garantiza cuota futura.

Resultado posterior: u6DhJK falló en la primera llamada por un esquema de salida
construido incorrectamente; no se ejecutó el segundo caso. Expectativas anteriores
intactas. [Causa, recibo, hashes, corrección y puerta nueva](CONDITIONAL-ASSESSMENT-U6DHJK.md).

## Inputs fijados

| Archivo | SHA-256 |
|---|---|
| factory/lib/conditional-assessment.mjs | `ff6fa75cfba4c1e750ab65fbb5a85275747d1edce1c84f8636897883efaade91` |
| factory/lib/artifacts.mjs | `7571fb7d11fe41aaefb37b8d71e2d1245ddc6ab63bfc6ba0112a463a013e076c` |
| factory/lib/workers.mjs | `04f2a2c6ea4b747fc72beb50bf241c88ba10cda53421b7f16088f1e41d4c782f` |
| conditional-selection-cases.mjs | `e07bbf18e7268c49f0887e274765eb32a09b7fa3ca4e5e1c1d81fd44d1a1f931` |
| conditional-selection-harness.mjs | `79df3257faf353f62659ce361f34845f2676c254cbc7763182bec4c4fdc14f8e` |
| run-live-conditional-selection.mjs | `998743f9a6f855609fcf20ad9307a3b7051cf66b47f95b0d9ea2225261aec3e7` |
| tests/factory/conditional-assessment.test.mjs | `5567158ec98cd0f6ba4c1e305d1d3d648652c1550530bdbad64dcb0a6d850c19` |
| tests/factory/conditional-selection-harness.test.mjs | `f2f5a912bd5df2cc9085f80d6595f79942069dc54ba0ef15db5fdba247a31b77` |

Los tres nombres sin prefijo están en reconstruction/verification/. Snapshot,
resultados y auditoría se añadirán sin reescribir esta expectativa inicial.

## Fuentes y decisiones propias

OpenAI recomienda definir el objetivo/dataset/métricas antes de evaluar y usar
clasificación o puntuación contra criterios específicos; no equiparar una
impresión favorable a evidencia. Esto orienta el contrato prospectivo, pero no
valida nuestro diseño ni sus resultados. [Evaluation best practices](https://developers.openai.com/api/docs/guides/evaluation-best-practices).

Se revisó la guía de prompting de Astra para precisar tarea y resolver posibles
conflictos de instrucciones. No se cambió modelo, effort, endpoint o API; la
separación entre diagnóstico y aceptación es una decisión de ingeniería propia,
verificada mediante los controles anteriores. [Guía de Astra](https://developers.openai.com/api/docs/guides/latest-model#prompting-best-practices).
