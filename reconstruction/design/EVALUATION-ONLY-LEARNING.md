# Evaluar ámbitos actuales sin autorizar su activación

Contrato previo,14 septiembre2026,19:30UTC. No está implementado ni cualificado
al escribir este apartado. R11 permanece abierto y0ec8 continúa instalado.

## Problema concreto

La inspección read-only aNOF4W de cuatro solicitudes reales conocidas conserva
los cuatro historiales y trece fuentes. Recompilar su proyección antigua produce
el prefijo y request exactos, pero elimina boundedReadReview, producerBatch e
inferenceBudgetHash. Igualdad textual no es equivalencia del contrato. Registrar
esa proyección permitiría atribuir el ensayo a un ámbito distinto del utilizado.
No se reutilizan esos casos conocidos como holdouts ni se repiten sus inferencias.

## Cambio elegido

Añadir una política explícita, opcional y congelada al dataset:
`policy.activation = "evaluation-only"`. Su ausencia conserva exactamente el
comportamiento anterior. No existe un valor que conceda activación por sí solo.

Sólo con esa política se podrá registrar el ámbito de un juez bounded actual,
con sus campos completos: boundedReadReview, producerBatch si está seleccionado,
e inferenceBudgetHash si existe. Se validan modo reviewer, contrato conocido,
modo de batch y digest; no se admite un ámbito productor, documental, de réplica,
controlador o desconocido mediante este cambio. El modelo, esfuerzo, fichas y
formatos siguen vinculados como antes; el input/schema completo sigue congelado.

La comparación conserva sus métricas y resultado reales. Incluso si la evaluación
pasa, tanto el registro básico como el servicio rechazarán promoción y exportación.
El resolver de ejecución no devuelve overlays de estos datasets. El bloqueo de
WorkerService no cambia. Una buena nota experimental no crea permiso operacional.

## Compatibilidad y aceptación

- La política nueva forma parte del hash del dataset. No se puede cambiar a
  activable sobrescribiendo un campo ni reutilizando el mismo resultado.
- El runtime anterior rechaza esa clave de policy al validar el dataset para
  evaluar/promover. Se comprobará con el paquete2898 real y copia aislada; no se
  presupone que ignorará la clave ni se alterará la base instalada.
- Ausencia de la opción: mismos registros y comportamiento histórico.
- Negativos: desconocidos, null/false, ámbitos incompletos/incompatibles,
  promoción directa y por servicio con autorización válida, resolver, export,
  corrupción o segunda versión del dataset/compilación; ningún modelo en estos
  tests, sólo callback SIM explícito.
- Prueba positiva: comparación exacta completada que conserva una mejora SIM,
  pero permanece inactiva. Eso acredita la separación técnica, no mejora real.
- Las peticiones reales conocidas sólo sirven para comprobar scope/prefix/input
  completos; no se declaran nuevos datos reservados ni una acreditación del juez.

El siguiente dominio real necesitará oráculo, regresiones, controles negativos
y datos fijados antes de producir una propuesta. La futura admisión operacional
será una decisión distinta; esta política no se podrá convertir retroactivamente.

## Avance19:42UTC

Implementado en candidato d77de83e,440archivos/24.328.887bytes, NO instalado.
El registro básico valida y bloquea la política; servicio y conductor conservan
la separación. No cambia el piso SQLite: el paquete anterior2898 rechaza la
clave nueva de policy antes de comparación/promoción. No se presupone que sus
etiquetas históricas entiendan EVALUATED_ONLY; la prueba cubre el bloqueo real.

Ochenta y ocho pruebas dirigidas PASS. Prueba de paqueteqqiFSS cerrada19:42:16.513:
scope completo de cuatro solicitudes conocidas y ocho callbacks locales; cada
baseline conserva exactamente su request y cada candidato la inserción prevista.
No hubo llamada al proveedor: la métrica es construcción exacta, no acierto del
modelo. Comparación passed=true/improved=false, activación bloqueada en versión
actual y anterior con concesión válida.19versiones/protocolo2/diario23 de la base
privada permanecen iguales tras los intentos; cuatro historiales origen intactos.
GlobalRwCzKm/71141 cerrado19:46:29.655, auditado19:47:27.053:
2040tests/2039PASS/0FAIL/1SKIP,521023.410259ms;357pins y cuatrostreams exactos,
ambos owners ausentes. Auditoría independiente deqqiFSS19:45:24.145 comprueba
ocho registros firmados, seis fuentes fijadas y bases intactas.
El componente queda cualificado en ese alcance, sin aceptación global ni instalación.
