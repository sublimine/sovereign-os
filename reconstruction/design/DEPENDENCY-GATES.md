# Historial de aceptación previo al consumidor

10 septiembre 2026, 00:00 UTC. Corrección cualificada en recuperación privada
`b0zgffSZ` e instalada con el runtime 4793e99c.

El código integrado de `7NHFBdRo` pasó los 226 casos externos, pero su juez
`review:ab9364b3-a6e0-4857-86f8-3dd000bbebae` retuvo aceptación por un único
criterio UNKNOWN: `req.prerequisite_gates.accepted_before_implementation`.
La misión terminó WAITING_CAPABILITY. Los wrappers ACCEPTED y los nombres de
revisores no eran los registros de decisiones y cronología solicitados.
No se modifica aquel resultado ni se regenera código para reparar este defecto
de entrega de evidencia del controlador.

`artifact-dependency-gates` proyecta los inputRefs del candidato exacto. Para
cada uno selecciona la última versión previa al **primer intento productor del
nodo**, no sólo al intento que terminó generando el candidato. Incluye identidad
y hash del artefacto/revisión, criterios y resultados públicos del juicio,
identidad del revisor y digest de exposición completada, y secuencias del journal.
No incluye cuerpos de productos/fuentes, citas de evidencia ni conversaciones.
No expone hermanos arbitrarios ni la aceptación futura del candidato actual.

Una aceptación posterior no se retrotrae: el inventario conserva false/null.
Una revocación posterior no borra la historia pero impide usarla como evidencia
vigente; el punto de uso vuelve a exigir dependencias utilizables. La observación
está firmada para el revisor real y candidato exacto. Un PASS almacenado acredita
que hubo aquel juicio; no se convierte por hash en verdad universal.

Replay sólo lectura de `7NHFBdRo`: primer productor de implementación en secuencia
587; modelo aceptado en 362 con revisión 361 y cuatro checks PASS; contraejemplos
aceptados en 571 con revisión 570 y cinco checks PASS; plan en 155 con revisión
154 y cinco checks PASS. Exposiciones de los tres revisores completas y separadas.
La proyección íntegra mide 23.709 bytes, no tokens ni ahorro demostrado.

Cuatro pruebas nuevas PASS: decisiones/checks/versiones previas, intento antiguo
y aceptación tardía, revocación/ámbito/citas, y ausencia de exposición a productores
o de hermanos no consumidos. Motor y production-scope: 41 PASS. Regresión completa
del corte `suite-A4KXyR`: 441 pruebas, 440 PASS, cero fallos y un smoke live SKIP.
El fallo anterior de `suite-jAakDc` queda conservado. Runtime `4793e99c` congelado;
revisión real del mismo candidato en copia privada `b0zgffSZ` iniciada a las
23:46 UTC y terminada a las 23:58 UTC: COMPLETED, 21 controles PASS, 226/226 casos
externos, candidato y archivos intactos. El juez `efd35d3c…` cita la observación
histórica y aprueba los 33 criterios sin producción ni escrituras nuevas. Los
fallos previos no se alteran. Se instaló el paquete tras verificar la cola inactiva
y la regresión ampliada `suite-CUmp0J` de 444 pruebas (443 PASS, un SKIP).
