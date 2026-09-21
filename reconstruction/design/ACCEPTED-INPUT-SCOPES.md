# Historial de entradas aceptadas — 10 septiembre 2026

## Defecto observado

El ensayo rjsI0udG, paquete 45dfce77, produjo y aceptó dos resultados mediante
especialistas autónomos. El integrador terminó WAITING_CAPABILITY: su contrato
exigía comprobar ambos historiales de producción, pero el runtime sólo entregaba
esas observaciones a revisores. La captura request-6.json no contiene ninguna
runtimeObservation. No es un fallo matemático ni autorización para omitir R5.

## Cambio posterior, no aplicado retroactivamente

ArtifactRegistry entrega al productor consumidor el production-scope de cada
entrada material que ya esté ACCEPTED y admitida en su contexto. WorkerService
lo captura también cuando la misión es pura y no está en una cola. El contrato
prospectivo de evidencias añade producerInputs: es un campo descriptivo aditivo,
no una reinterpretación de observaciones históricas ni cambio de sus firmas.

No se exponen historiales de hermanos no admitidos, borradores no aceptados,
planes como productos materiales ni la futura producción del candidato actual.
Los registros de gates del candidato siguen siendo sólo evidencia de revisión.
El contenido sigue siendo metadatos autenticados con corte antes de la creación
exacta de cada entrada, sin cuerpos privados ni un veredicto de no contaminación.
Los metadatos no acreditan ausencia de toda pista incidental, conocimiento previo
del modelo o aislamiento ciego sellado. La validación de entradas aceptadas se
mantiene; una revocación no es autorización para consumirlas.

## Pruebas

La prueba de integración con modelos explícitamente simulados falló antes del
cambio: FAILED en lugar de COMPLETED. Ahora pasa: dos raíces sin exposición
mutua, integración con dos historiales exactos y ocho llamadas simuladas, cero
efectos. La prueba de límites verifica entrada aceptada, borrador, hermano,
planning, revocación, vinculación al actor y ausencia de cuerpos privados.

Suite-m5fSdX: 557 pruebas, 556 PASS, cero fallos, un SKIP live; 43,33 segundos.
Su evidencia está en verification/runs/suite-m5fSdX. Esto no demuestra todavía
la recuperación real ni certifica la fábrica completa. La recuperación deberá
conservar la petición, política, plan, criterios, productos y fallos originales,
con nuevos requests e informe separados y un paquete nuevo congelado.
