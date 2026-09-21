# Ensayo integrado xMileM — auditoría abierta

Misión `mission:330b8627-ef3f-47f5-ae3f-a84c23627716`, iniciada 12 septiembre
2026 a las 13:34 UTC. Runtime congelado `cb2cb67c`, no instalado. Petición,
política, oráculo externo y techo de 24 llamadas están en
`runs/planned-blind-live-xMileM/qualification.json`. El resultado global permanece
pendiente. Esta auditoría no modifica entradas, juicios ni criterios del ensayo.

## Primera propuesta y devolución

Propuesta `artifact:d1814cf2-1a49-4f58-9b8d-c29c2362a520`, payload SHA256
`666c5fc38d64aba6f55f4f5bf4a5a9ef62e1de45aeda2ef9353dc558769fbf9b`.
Cuatro productos: original literal → protocolo → intento cerrado → comparación
nativa. La propuesta conserva 14 requisitos y 24 criterios finales, incluidos
los cinco gates nativos; usa un especialista complementario para diseñar el
método aritmético. No se instaló el plan rechazado ni se envió una réplica.

Juicio `review:09adf3f7-3578-4261-820c-b781933732d7`, 13:54:42.006 UTC:
RETURN; intent/authority PASS; causal-order/capability-fit/acceptance FAIL.
Revisor `run:9d0dcf02-c07e-4b3b-aa16-474422cab667`; recibo real por suscripción,
61.031 tokens observados (51.049 entrada, 9.982 salida). La planificación inicial
había observado 30.422 tokens. Son contadores de llamadas completadas, no factura
ni consumo completo de cuenta. La segunda propuesta se inició 13:54:42 UTC.

La lectura del juicio y del plan distingue dos causas:

1. **Asignación incompatible pertinente.** `sigma_38` exige ceguera inicial
   frente a conclusión original/respuesta preferida en su contrato epistémico.
   El protocolo, en cambio, debe ser revisado con el original real desde la
   entrada. Esta ejecución ordinaria no implementa dos fases de revelación.
   El rechazo evita ejecutar esa asignación; no acredita contaminación ya
   ocurrida. Conservar el original como objeto no certificado no elimina su
   función de referencia. Debe cambiar la asignación, no la exigencia del usuario.
2. **Ambigüedad del contrato de disponibilidad.** El juicio no presupone un
   contenido que el mapa prospectivo no explicaba. Ese mapa decía que el
   producto privado `protocol` no estaba expuesto, sin distinguirlo del campo
   `publicProtocol` íntegro que sí forma parte del informe nativo. El requisito
   de inspeccionar el contenido público no necesita revelar todo el envoltorio
   privado ni historias ajenas. El código `blindComparisonBody` ya incluye el
   campo completo y `blindComparisonEvidence` recomputa y vincula ese cuerpo.
   No se debe etiquetar esta objeción como prueba de que el runtime carece del
   contenido, ni rehabilitar por ello el plan: la primera incompatibilidad sigue.

## Corrección prospectiva separada — 14:00 UTC

En desarrollo, `review-evidence-boundary.mjs` describe ahora los campos completos
de ambos cuerpos cerrados y distingue ausencia de un artefacto upstream de
presencia de su sección pública embebida. El planificador y su juez reciben el
mismo contrato prospectivo; no se afirma que un producto futuro exista o pase
revisión. No se altera el cuerpo nativo, su evidencia, los criterios ni la
frontera privada del intento.

Cuatro pruebas dirigidas PASS: mapa causal ordinario, rechazos de identidad,
frontera privada y contraste de cada campo declarado con los cuerpos realmente
expuestos por el kernel y sus observaciones autenticadas. La última ejecuta
todo el flujo con proveedor simulado; no acredita calibración semántica real.
Duración del conjunto: 8,73 s. Nueva regresión completa en curso.

**El ensayo xMileM sigue usando cb2cb67c sin esta modificación.** No se inyecta
una corrección durante su ejecución ni se atribuye su resultado a otro runtime.
Quedan por leer las propuestas posteriores, todos los productos y todos los
juicios que lleguen a existir; tampoco se presupone comparación o aprobación.

## Segunda propuesta — lectura previa al resultado

`artifact:e7987fa4-fede-4ffd-9fd3-69301df49b58`, payload SHA256
`10915a41ed533e3f961c9ae1855fb37028a38300a5b7db483e983654baf12f70`:
cambia el juez del protocolo a omega_22 y agrega `dossier`, producido por
omega_23 y revisado por omega_22, después de los cuatro productos anteriores.
Conserva los 19 criterios de requisitos en ese final, los gates nativos en sus
etapas y el original/regla/tolerancia. La dependencia directa del dossier con
la comparación impide que la integración comience antes de la apertura;
los textos privados sólo entran a ese actor posterior, no al replicador.
La justificación de la integración invoca el mapa incompleto de exposición
que el ensayo congelado todavía suministra. Su necesidad marginal no queda
demostrada por existir esa justificación: el informe ya incluye el contenido
público, la respuesta completa y el original abierto.

**Limitación del oráculo del ensayo detectada antes del resultado:** el harness
congelado requiere `report.final.id === comparison.id` dentro de `checks.completed`.
Esta propuesta admite una integración posterior permitida por el runtime, por
lo que un dossier correcto no pasaría ese predicado de identidad. No se cambiará
el harness ni se rehabilitará su PASS/FAIL durante este ensayo. Se distinguirán
el estado real de la misión, los criterios del producto y ese resultado del
comprobador; no se etiquetará automáticamente un informe correcto como error
del motor por una restricción adicional del fixture. Tampoco se presumirá que
el dossier reproduce correctamente el informe: habrá que leerlo y verificarlo.

En desarrollo se aclara la selección: el comparador siempre recibe sus gates
fijos; el final recibe todos los criterios de requisitos, sea comparación o
convergencia posterior. No se añade un productor sólo para copiar el informe
ya completo. La convergencia legítima sigue soportada y probada: un recorrido
del kernel con proveedor simulado termina, conserva el informe exacto, expone
las entradas privadas sólo al integrador posterior, mantiene una sola réplica
y reabre sin nuevas inferencias (PASS, 21,99 s). No se aplica a xMileM.

Regresión intermedia suite-c3Eu3n: 695 pruebas, 694 PASS, cero fallos/un SKIP,
187,70 s, completada 14:04:16.780 UTC. Tras ella cambiaron blind-plan.mjs y su
test para la aclaración anterior; la regresión posterior está en curso.

## Plan aceptado y protocolo candidato — 14:14 UTC

El plan v2 recibió ACCEPT a las 14:06:54.066, cinco criterios PASS y ningún
hallazgo, juicio `review:278578eb-a821-48b1-94b4-0dac68081299`.
Lectura completa de sus cinco razones y citas: conserva mandato, orden,
asignaciones, autoridad y cobertura; esa aceptación es prospectiva, no evidencia
de que los pasos hayan ocurrido. El coste marginal de la convergencia no se
considera demostrado por el propio juicio.

Original `artifact:522f8e75-bb8a-4fc3-a825-b396a4c98f02`, SHA256
`7a9c45f38b41d797f19e978f79a15b366a9222ea0b69103c89db18e58e1d703b`, cuerpo
exacto `62`, aceptado por cotejo literal a las 14:07:28.283 mediante
`review:3077f07b-531f-4872-bbb2-9538d6b88d48`. No se certifica su verdad matemática.

Protocolo candidato `artifact:b2cfa22c-a0e9-42d7-88ce-f42ad19d1c8d`, hash
`8681e1cf4a287410df8ad223e8ca67525ccb364b5fac95de988d6146721c1caf`.
Lectura completa: vincula la misión y el original correctos en su envoltorio
privado; la pregunta pública conserva las nueve entradas y posiciones. Usa
cofactores y un control de seis productos con signo, además del cotejo
posicional. Fórmulas apropiadas; no resuelve numéricamente el problema ni revela
el original en la sección pública. La regla y la tolerancia son exactas.

Sólo hay dos controles en la respuesta de la réplica, ambos decidibles a partir
del paquete público y sus operaciones. Revisión, congelación, aislamiento,
sellado, juicio y apertura se atribuyen explícitamente al controlador/revisores,
no se presentan como controles de la réplica. Esto corrige la causa A01 observada
en rB9KdY sin alterar su protocolo histórico. La parada y las limitaciones
preservan UNKNOWN, fallos, raíces compartidas, ausencia de independencia
cognitiva y prohibición de remuestreo. Esta lectura no reemplaza la revisión
asignada del candidato ni acredita ejecución del método: la réplica aún no
ha producido un resultado en este corte.

Regresión suite-HrubKy conservada: 696 pruebas, 694 PASS, un FAIL/un SKIP,
209,92 s. El FAIL detectó que la descripción nueva de routing superaba el límite
existente de 2.200 caracteres; no era un fallo de cálculo o aislamiento.
Se compactó a 1.916 caracteres sin subir el límite, conservando las restricciones
y remitiendo al mapa detallado de campos. Dos pruebas posteriores PASS (22,93 s);
nueva regresión completa en curso. El runtime congelado del ensayo no cambió.

## Protocolo aprobado e intento sellado — 14:24 UTC

Protocolo ACCEPT 14:17:10.146 UTC, juicio
`review:f92d95f2-b306-4cbb-9c9c-14c6c509c912`, registro SHA256
`38f33614d6fcd3a50ffe9a9d923143568da2f53d624b27c83ef76d163d8b0828`.
Lectura íntegra de cinco razones, todas las citas y la incertidumbre: el juez
contrasta original/plan/protocolo efectivos, verifica las fórmulas y distingue
aprobación del diseño de prueba de actos futuros. No reproduce el error A01.

Única réplica `run:3283a58c-25aa-45bb-bff0-f2234c8eefb2`, real por suscripción,
14:17:11.274–14:18:16.200 UTC, 10.894 tokens observados. Registro
`planned-blind:c84b3c38f98713ad25a080419ccb478e9bd63005d51d350ddd121849180c709f`,
hash del registro de freeze
`adafeeb023ea025895b9c2d0c3ae75b29e28dbf9699ba130af02725123b6a41b`,
solicitud `ba42647401d342eca791432add5a6aec5cea0baf662fd1b93db69fe8f0f4c64c`.
Sello 14:18:16.341, SHA256
`28bb7f4b77804b07424bae75fea921ee3f28d02e5637f60b7e2d82004be2a809`.

Lectura completa del resultado: RESULT `61`, cofactores 68+5−12=61 y seis
productos 48+5+0−12−0−(−20)=61; cada sustitución, signo, producto y suma es
correcto. Dos controles PASS con observaciones pertinentes y ninguna desviación.
El resultado coincide con el oráculo de permutaciones que no recibió el modelo.
El juicio material sigue en curso; este cotejo no lo sustituye ni abre el original.

**Segundo límite del harness registrado antes del desenlace:** hay tres
`unknowns`, referidos a aprobación/freeze anteriores, aislamiento y actos de
otros actores o futuros que la réplica no puede observar. No son carencias de
sus premisas ni errores de cálculo. Su conservación es apropiada, sin presumir
cumplidas esas obligaciones; la evidencia del controlador debe demostrar las
que efectivamente ocurran. El predicado congelado `residuals` exige cero
desconocidos, de modo que no pasará aun preservándose legítimamente estos
límites. No se borrarán, reclasificarán en la respuesta ni cambiará el predicado
para aprobar. La revisión sustantiva y el resultado literal del harness se
informarán por separado, sin convertir conservación de incertidumbre en éxito
global ni en prueba automática de un defecto material.

Regresión suite-aJnb0n: 696 pruebas, 694 PASS, un FAIL/un SKIP, 217,28 s.
El límite de tamaño ya pasó; falló otra expectativa que exigía literalmente la
redacción previa de ese mismo contrato compactado. Se actualizan las dos
expectativas de texto y se añade la exigencia explícita de inserción de gates
completos antes del juicio. Todas las aserciones de ejecución, conservación del
rechazo, obligaciones originales y criterios exactos permanecen. Prueba dirigida
PASS 9,01 s; nueva regresión completa en ejecución. Fallos anteriores intactos.

## Resultado terminal — 14:31:42.691 UTC: no aprobado

11 llamadas completadas reales, 385.685 tokens totales observados, una sola
réplica; ninguna operación externa. La misión termina NEEDS_DIRECTION, no hay
dossier ni final aceptado. `summary.json` conserva `passed:false` y la auditoría
automática PENDING; esta lectura separada no reescribe ese documento.

Intento aceptado a las 14:28:01.400 mediante
`review:dad910d6-2175-4ce0-b8e3-4151c5a2efbb`, hash de registro
`48bc54d674110d64a0934240b5e03ed5eccf4eb0802b95fbc4134cdb8b87fbb5`,
cinco PASS/no findings. Lectura completa: confirma cuentas, dos controles,
preservación de los tres límites y la separación de responsabilidades.
La aceptación material no certifica aprobaciones privadas que ese juez no ve.

Comparación `artifact:93221e4e-18d5-4b28-9790-29664d818bbe`, payload SHA256
`c0359d2b8b4c97ee5caeeb3cb0c48e35113f92f238a391f36383bef58f8696a9`:
original completo 62, réplica completa 61, distancia exacta 1, tolerancia 0,
MISMATCH; protocolo público y respuesta sellada íntegra idénticos por cotejo
canónico. La cronología expuesta por el runtime conserva juez material 618,
juicio 624, aceptación 625, apertura 633, comparador 636, candidato 637 y
vínculo 638. No se abrió antes de aceptar ni se volvió a producir la réplica.

Juicio de comparación `review:7730e23c-e1c6-45df-a302-b070e3ef8696`,
14:31:42.356, registro SHA256
`9603aa164cb465fbd19fcff2e3346777b5bf5e5904966828b6ec7c4a77ee32b0`:
RETURN, cuatro PASS y `comparison-rule` UNKNOWN, un finding material.
Lectura íntegra de razones/citas/recuperación: acepta corrección aritmética,
objetos, vínculo, incertidumbres y límites. **Falta en lo expuesto la prueba
histórica de aprobación independiente del protocolo/regla con el original.**
El juicio no afirma que esa aprobación no existiera. Pide el registro
preexistente; una aceptación posterior no serviría. El hallazgo es pertinente:
la prueba nativa anterior no detallaba ese tramo privado previo al freeze.

Por tanto hay un rechazo material real adicional a los dos límites previamente
advertidos del harness. No puede atribuirse el resultado fallido únicamente al
predicado de final o a los unknowns legítimos. Se conserva todo el recorrido;
cambiar la comparación de RETURNED a ACCEPTED manualmente, repetir la réplica
o suprimir incertidumbres no son correcciones admisibles.

Journal terminal: 710 eventos,
`acd893c129d879f560aaf9735dc61f708f45b11aff59cdf5b0a8bcf74440ca6f`.
La preparación de evidencia adicional comenzó en desarrollo antes de leer este
juicio y no entró al runtime cb2cb67c del ensayo. Ocho pruebas iniciales y luego
95 pruebas de la ruta PASS; tres pruebas de integración/proyección/imports PASS.
Se reutiliza la comprobación histórica del freeze en un módulo hoja y se expone
su resultado sólo en la observación de comparación posterior a apertura.
No hay nueva aprobación de esta misión ni cualificación real de esa corrección.

Regresión anterior a esa extensión: suite-ulJVe5, 696 pruebas, 695 PASS,
cero fallos/un SKIP, 232,38 s. A las 14:27:37.398 coincidían sus 199 inputs,
conjunto completo de archivos y hashes de ambas salidas. Una nueva regresión
de la extensión está en curso. Ningún corte de desarrollo se ha instalado.

## Oráculo prospectivo posterior — no aplicado a xMileM

Antes de modificar el comprobador futuro se archivaron sus dos fuentes exactas
de este ensayo: `harness-used.mjs` (c9033eafa4528a7a567ea06c0218cb03ef49711f02d6e7ac1adb1955bb4e5a1f)
y `trial-acceptance-used.mjs` (038bc386bf4310665e15f415ec1ea4b1d653d8b1c4b433351e87eb16df4db56b).
Ambos hashes se contrastaron con qualification.json; ningún resultado se recalculó.

Para un ensayo distinto, `acceptedFinalConsumesComparison` admite comparación
final o convergencia realmente aceptada que consuma esa comparación exacta por
inputRefs: no basta un enlace declarado en el plan. Comprueba misión, final,
nodos aceptados, hashes, propósitos, ancestros y ausencia de ciclos; los errores
de almacenamiento no se convierten en false silencioso. Eso no prueba que una
prosa integradora sea fiel: la revisión y lectura materiales siguen obligatorias.

`comparisonPreservesResiduals` exige identidad completa de respuesta sellada,
controles pendientes, desviaciones y desconocidos, con replicationEstablished=false.
No exige borrar límites legítimos para obtener cero unknowns. Mantiene exactitud
del oráculo numérico y todos los gates originales de ejecución/revisión. Ocho
pruebas del helper PASS (0,12 s), incluyendo consumo ajeno/alterado/revocado,
errores de lectura, desaparición de controles/unknowns y cambio del resultado.
Suite-p2UhJG posterior: 704 pruebas, 703 PASS/cero fallos/un SKIP, 208,29 s,
antes del arreglo de compatibilidad histórica siguiente. No rehabilita xMileM.
