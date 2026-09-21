# Lecturas locales independientes en una propuesta — prerregistro

13 septiembre2026, después de cerrar2cYEbW. Sus271inputs y release fueron
verificados antes de cualquier cambio siguiente. El caso queda conservado.

Problema medido:11llamadas/311820tokens/21min31.685s para dos documentos y
cuatro hechos. Localizar dos fuentes ya admitidas, o seleccionar dos rangos
ya determinados, no requiere una inferencia entre cada fuente. Actualmente
el protocolo sólo admite una operación local por respuesta, aunque el broker
ya admite lotes de adquisiciones. Las decisiones dependientes sí requieren
observar el resultado anterior. No retirar planificación, jueces, fichas,
criterios, fuentes o validación para ocultar el coste.

Cambio acotado propuesto: action=document/tool=source.batch con
argsJson={operations:[{tool,args},...]},2..8lecturas/localizaciones sobre grants
**distintos y ya expuestos a ese actor**. Sólo source.locate/source.read;
sin anidamiento, fetch, ejecución, placeholders ni operaciones dependientes
sobre el mismo grant. No es paralelismo ni una autoridad nueva.

Un lote es una transacción SQLite: conserva propuesta completa previa,
resultados separados, orden y reemplazo explícito por fuente. Todo o nada
para esos cambios locales; no confundir con el lote de herramientas externas,
que puede dejar éxitos parciales. El presupuesto24 cobra cada suboperación,
no sólo una llamada. Se mantienen16ventanas/256KiB actuales, revocación,
identidad, petición completada y cronología. El productor y el juez seleccionan
por separado; seleccionar no es haber observado el próximo input ni aceptar.

Verificación prevista antes de nueva inferencia: ROJO previo, integración en
tres codecs, equivalencia de resultados/payloads respecto a operaciones sueltas,
replay sin gasto, rollback de un último miembro inválido, grants ajenos o
revocados, duplicados, anidamiento, techo por miembro, límite agregado de
ventanas/bytes y juicio sin préstamo de lectura. Regresión completa y nueva
release congelada antes de cualificación real. No volver a ejecutar el caso
aprobado por defecto; el próximo escenario deberá aportar cobertura distinta.
Menos propuestas observadas en una fixture no equivalen a ahorro real medido.

## Implementación y pruebas dirigidas

Implementados el esquema de productor/juez, instrucciones visibles para ambos,
validación de miembros, resultados separados, presupuesto por suboperación y
savepoint privado. Las navegaciones antiguas mantienen su proyección y sus
hashes; no se añaden campos retroactivamente a frames anteriores.

Historial de pruebas conservado en esta conversación:

- ROJO previo, sesión93274:10pruebas/7PASS/3FAIL,8472.614650ms; los tres
  recorridos rechazaban el enum nuevo, aún no implementado.
- Primera implementación, sesión78338:10/10PASS,13745.299322ms.
- Negativo adicional de transacción ajena: ROJO,717.148073ms; un miembro
  dejaba un evento parcial49 frente a48 si el llamante atrapaba el fallo.
  Se añadió SAVEPOINT/ROLLBACK TO, conservando la transacción del llamante.
- Sesión92878:16/16PASS,18770.412740ms, incluidos presupuesto por miembro,
  revocación, grants ajenos, topes agregados y rollback anidado.
- Archivo documental completo, sesión1426:62pruebas/61PASS/1FAIL,
  133757.153535ms. El fallo fue precedencia del error en replay alterado:
  SCHEMA se anticipaba al IDEMPOTENCY_CONFLICT histórico. Se restauró esa
  precedencia en código, sin cambiar la expectativa original.
- Sesión19409:19/19PASS,22157.194568ms; incluye los18nuevos casos y el
  replay histórico. Mezcla de locate/read independiente y rechazo de un
  juez que sólo observa una de las dos fuentes incluidos.

En las tres codificaciones, el mismo contenido/claims conserva ambos apoyos
con seis propuestas simuladas frente a nueve. Productor y juez mantienen
cuatro/dos operaciones locales, respectivamente, y dos adquisiciones; cambia
el número de peticiones, no el de obligaciones cumplidas. Replay no cambia
journal ni presupuesto. No es un benchmark de proveedor ni ahorro certificado.

Revalidación readOnly11:40:33.329 del producto/revisión históricos2cYEbW con
el código nuevo: claims y juicio válidos, baseSHA31eab884... intacta. Observación
adicional, no sustituye regresión completa. Falta cerrar esa regresión y
congelar release antes de cualquier cualificación real nueva.

Regresión completa0S2ocg iniciada11:42:35.406, sesión37379/PID2056483,
boot2a077981-8aea-444e-8eff-44fa69814267/startTicks48370550;272inputs.
El nuevo harness diagnóstico nativo queda fijado como input, no se declara
ejecutado por la suite por estar en el inventario. No editar/duplicar mientras
la regresión permanezca activa. No hay todavía resumen completo ni nueva release.

## Cierre de regresión y copia verificada

0S2ocg cerrada11:48:42.812, sesión37379exit0/propietario muerto:
1066pruebas,1065PASS,ceroFAIL,unSKIP explícito de suscripción;
367275.985730ms. ResumenSHA
8755c33f7b2f94bc58d72f14289025bbb4664f1ba5e73684430ed06ac66a5ee8.
A11:49:50.979 se verificaron272pins, inventario, streams parciales/finales y
runtime. Nueva copia local c561736bff1a70d243fac9fbd39100717af61e060ca11a9f8aaa07fefe18648c,
413archivos/24004816B. No instalada. Esto cualifica la regresión del cambio,
no mide todavía su coste o comportamiento con proveedor real.

## Siguiente ensayo real — cobertura del protocolo, no repetición de confianza

Después del par G1ZuZR y de cerrar la nueva regresión Nceuel, un único recorrido
documental en base nueva y con adquisiciones nuevas, conductor existente
run-live-documentary.mjs. Se conserva exactamente el caso conocido2cYEbW,
petición, ocho criterios de contenido/tres restricciones originales y techo20.
La cobertura nueva es source.batch real desde selección propia hasta frames,
claims y revisión: aún no se ha ejecutado con el proveedor. Reutilizar el caso
conocido permite comprobar este cambio concreto; no se presenta como un caso
nuevo, holdout ni repetición independiente de confianza en el resultado SQL.

Antes del dispatch quedan fijados aquí los resultados distinguibles:

- Recorrido de contenido: entrega, fuentes frescas, citas exactas observadas,
  juicio completo, linaje, conservación al reentrar e integridad de inputs.
- Protocolo por lotes: al menos un source.batch completado por el productor y
  otro por su juez independiente; miembros propios, sources distintos,
  ventanas efectivamente incluidas en inputs posteriores completados y usadas
  como apoyo. Verificar el coste por miembro, no contar un lote como una lectura.
- Si el modelo elige sólo operaciones escalares, el contenido puede aprobar,
  pero la cobertura por lotes queda NO OBSERVADA. No forzar una repetición,
  cambiar criterios ni convertir selección en prueba de lectura.
- Coste: llamadas, tokens observados, correcciones, propuestas y miembros por
  actor, tiempo total. Comparación temporal con2cYEbW sólo descriptiva: URLs
  actuales, planes generados y caché pueden variar. No prometer ahorro causal.

Misma suscripción Astra/ultra y políticas; sin instalación, API, cambios de
seguridad, cola ordinaria o transferencia de juicios. El oráculo externo
endurecido contra duplicados no se envía al modelo ni reetiqueta pruebas viejas.
Sin otro ensayo si hay fallo, presupuesto agotado o pérdida de congelación:
primero diagnóstico de la causa exacta, manteniendo historial completo.

Nceuel cerrada1077tests/1076PASS/unSKIP y revalidada12:25:45.744.
Ensayo **bckJet iniciado12:26:10.194**, sesión71690/PID2079140,
274inputs fijados. [Seguimiento separado](DOCUMENTARY-BATCH-bckJet.md).
No hay todavía resultado de contenido ni uso de lotes cualificado.

Nota de12:30 sobre la cardinalidad: los ocho criterios de contenido citados
arriba pertenecían al plan histórico2c. El nuevo plan autónomo propone doce,
con tres runtime, bajo la petición original sin cambios; véase seguimiento.
No se congela ni reutiliza el plan histórico, ni se quitan criterios del nuevo
para igualarlos. Costes sólo descriptivos, sin atribución causal al lote.

## Cierre real bckJet — cobertura parcial, no cualificación de recorrido

Primer plan devuelto por incumplir salida de omega_11; segundo aceptado con
expediente→gate→síntesis. Productor y juez completaron lotes propios sobre dos
fuentes distintas y usaron las ventanas en sus inputs completados y pruebas.
Expediente aceptado12:55:16.970, cuatro criterios de contenido y gate runtime;
26citas propias y nueve apoyos auditados. Eso cubre el protocolo en ese nodo,
no la entrega de la misión. Once llamadas completas382575tokens, sin JSON final.

El consumidor heredado repitió recursivamente la validación del expediente:
preparación previa5min8s y propuesta de lectura posterior sin commit. Se pidió
SIGTERM13:06; trabajo síncrono impidió atenderlo. Interrupción forzada del único
owner13:14:40.579, sesión71690exit137, propietario ausente y entradas originales
reconciliadas antes de editar. No timeout automático, agotamiento de cuota,
reanudación ni PASS artificial. Véase [cierre y recuperación](DOCUMENTARY-BATCH-bckJet.md).

Siguiente intervención únicamente determinista en copia recuperada: [prueba
por lote y cancelación cooperativa](SOURCE-PROOF-BATCH-PREFLIGHT.md). Las
adquisiciones, propuestas, revisiones y fallo originales permanecen intactos.
