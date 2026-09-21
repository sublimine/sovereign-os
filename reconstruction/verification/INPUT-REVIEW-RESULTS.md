# Revisión independiente de entradas: resultado y límites

Estado a 14 septiembre 2026, 08:37 UTC: **LIVE LFYIrU cerrado y corrección
b7cb510c instalada**. No presentar este documento como aceptación de la fábrica. Contrato
completo en [MANDATE.md](../MANDATE.md); estado vigente en [STATUS.md](STATUS.md).

## Defecto causal, no retoque de instrucciones

La versión 68fae338 podía suministrar al juez la lectura histórica del productor
sin ejecutar una lectura propia del juez cuando el archivo no era un output.
El juez ordinario no dispone de un canal de propuestas de herramientas. Pedirle
que leyera no proporcionaba esa capacidad. El diagnóstico CVLfLT obtuvo una
aceptación SIM deliberadamente permisiva sin lectura propia; en WfS70I el modelo
real devolvió correctamente el candidato por ese defecto.

WfS70I permanece FALLIDO: once llamadas completas, duodécima cancelada por su
plazo, sin entrega y sin presupuesto repuesto. La corrección se hizo después de
[reconciliar el fallo](runs/adaptive-v2-live-WfS70I/post-close-failure-audit.json).
No se pretende que el nuevo caso cambie ese resultado.

## Corrección implementada y controles

- Vínculo con el candidato original y el snapshot del productor anterior a él.
- Política original del revisor `input-file-review-v1`, promoción atómica a
  protocolo 5 y rechazo de ejecutores antiguos incompatibles.
- Relectura propia de entradas observadas, posterior al candidato, misma
  versión completa, cita obligatoria y comprobación de estado al aceptar/entregar.
- No confundir entrada sólo leída con obligación de escritura; los archivos
  modificados deliberadamente conservan sus comprobaciones de versión de salida.
- Dos versiones directas contradictorias no se resuelven escogiendo la última
  del array. Lecturas fallidas no se convierten en fuentes exitosas.
- Un resultado histórico no se recertifica ni recibe pruebas retrospectivas.
  Una revisión nueva de un candidato antiguo sí debe cumplir la política nueva.

[Diseño y alcance](../design/INDEPENDENT-INPUT-REVIEW.md).

## Evidencia cerrada

Global TymHUs: 1693 pruebas, 1692 PASS, cero FAIL, un SKIP, 455211.088482 ms.
[Auditoría posterior](runs/suite-TymHUs/post-close-audit.json): 324 entradas
fijadas, cuatro streams íntegros, dos procesos propietarios ausentes. Snapshot
b7cb510c, 429 archivos/24.233.481 bytes. Esto no acredita conducta del modelo.

La global anterior U9qZO8 conserva 1690 PASS/1 FAIL/1 SKIP. Se separó una prueba
que esperaba el control de protocolo ciego después de una corrupción ya
rechazada por la nueva vinculación original. Se comprueban ambas fronteras sin
debilitar el motor. Las 114 pruebas dirigidas de replicación ciega pasan.

[Compatibilidad 2TAW1V](runs/input-review-compatibility-2TAW1V/post-close-audit.json):
cinco comprobaciones con el ejecutor anterior real, dos bases aisladas,
diecisiete versiones históricas preservadas. No es una prueba de toda migración
posible ni una intervención en la base instalada.

[SIM whNNS3](runs/input-review-sim-whNNS3/post-close-audit.json): siete respuestas
simuladas, diecisiete controles aprobados, dos productos aceptados, relectura
propia y reapertura sin nuevas llamadas; protocolo 5, journal 175. Cero cursores
y un cargo de productor: no se impuso agrupar operaciones ni listar el directorio.

## Ensayo real y revisión sustantiva cerrados

[Prerregistro](experiments/INPUT-REVIEW-QUALIFICATION.md). Único LIVE corregido
LFYIrU, 08:14:18.401–08:27:38.093. Petición/entrada conocidas, no holdout; doce llamadas
máximas y treinta minutos, sin reposición ni API. No se introdujeron el plan ni
las respuestas simuladas. Modelo gpt-6-astra, effort ultra, según sus recibos.

Leídas completas las siete respuestas y las dos fichas suministradas al
planificador. La entrada decide planificar por ausencia de datos; el planificador
solicita e inspecciona Veritas 07 y Omega 22. Su plan conserva nueve requisitos,
seis criterios de contenido y cuatro controles operativos, un producto sin
obligaciones de output de archivo y separación de producción/aceptación.
Justifica no añadir síntesis, custodia ni réplica ciega en este caso. El juez
aprobó los cinco criterios del plan sin declarar ya observadas las lecturas.

La revisión sustantiva comprobó, además de las firmas:

1. Que el plan fue revisado antes de la producción y que los métodos asignados
   caben en las fichas completas y en los canales realmente disponibles.
2. Que productor y juez observaron los mismos 478 bytes originales y que la
   lectura propia del juez es posterior a la creación del candidato.
3. Que el productor y el juez muestran cálculo desde los operandos originales:
   1200 mg + 250 mg + 5000 mg = 6450 mg; 6500 − 6450 = +50 mg, no consistente.
4. Que el juez cita sus propias pruebas, no sólo el cuerpo del candidato ni
   una lectura histórica prestada; conservar cualquier RETURN o UNKNOWN.
5. Que el informe distingue exactitud decimal de constatación física, preserva
   procedencia y límites, y mantiene el formato pedido sin autocertificarse.
6. Que se reconcilian todas las reservas, respuestas, cierres y consumo observado;
   un cancelado sin uso final no es consumo cero.
7. Que la reentrada devuelve la misma versión aceptada sin otra inferencia ni
   escritura del archivo, y que los cambios posteriores siguen detectándose.

El oráculo nuevo admite cadenas decimales exactas y tokens numéricos JSON sin
perder fracciones pequeñas por `Number`; dieciocho pruebas deterministas pasan.
No evalúa por sí solo la explicación, los roles, la independencia epistemológica
o la utilidad del método. La [auditoría sustantiva separada](runs/input-review-live-LFYIrU/semantic-disposition.json)
cerró 08:31:01.053 con ACCEPT_SCOPED_CORRECTION.

Diecisiete controles del ensayo pasan; dos dictámenes ACCEPT, cero reparaciones,
siete respuestas reales completas y sus siete cierres. [Auditoría sólo lectura](runs/input-review-live-LFYIrU/post-close-audit.json):
324+5 pins, 40 usos de citas, protocolo 5, journal 335 y owner ausente.
La secuencia durable es productor lee 199, snapshot original 232, candidato
237, juez lee 247, petición del juez 259, dictamen 317 y aceptación 318.
[Vínculos de secuencia](runs/input-review-live-LFYIrU/input-sequence-audit.json).
La reentrada preserva artefacto/política/presupuesto y añade sólo validación
de estado/lease de lectura permitidos. No reproduce inferencia.

## Eficiencia y mandato

Las siete llamadas reales consumieron **152.181 tokens observados**: 129.585
de entrada y 22.596 de salida. El proveedor informó 27.392 tokens de entrada
cacheados en la revisión final; son parte de la entrada y no se restan del
total. No se infiere precio, uso total de cuenta ni causa del cache hit. No es
una demostración de eficiencia. El catálogo de 154 capacidades ocupa
37.905 bytes decodificados en cada petición de planificación; cada plano de
serialización se contabiliza separado, no sumando padres e hijos.

Este dato permite formular comparaciones futuras, no quitar fichas o criterios
por su tamaño. El éxito de este caso sólo cualifica la corrección
integrada de la lectura. No cierra R01–R16, demuestra superioridad mundial,
aprendizaje mejorado, ejecución de 154 métodos ni operación continua de tres días.
