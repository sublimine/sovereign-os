# Revisión acotada del método después de un rechazo material

14 septiembre 2026. Cambio posterior a e07/MUS7Oc/mB7oR4; esas pruebas no lo
cubren. Global v3wP0Y y ensayo acotado 2spDVa cerrados y auditados:
[resultados y límites](../verification/METHOD-RECOVERY-RESULTS.md). No instalado.

## Carencia y contrato

El coordinador conserva feedback y cambia propuestas dentro de un nodo, pero
METHODS_EXHAUSTED no activa una revisión del plan por un rechazo material del
juez. ensurePlan repara algunas contradicciones/revocaciones, no ese caso.

Se añade una opción explícita `methodRecovery: {mode:'reviewed-method-v1',
maxRounds:N}`; sin opción no cambia el recorrido histórico. Cada ronda reserva
antes de planificar una revisión global de método, conserva plan, nodo, producto
rechazado y revisión exactos. No se activa por cuota, timeout, cita mal formada,
efecto incierto o falta de permiso. No transforma una retirada humana en permiso.

El planificador recibe diagnóstico público íntegro y lo trata como historial,
no como hechos aceptados ni instrucciones con autoridad. Propone una variación
causal del método; otro juez evalúa el cambio y los cinco criterios normales del
plan. Cambiar un nombre, una justificación o espacio en blanco no basta.
La diferencia textual es sólo un filtro, nunca prueba de cambio semántico.

Se conservan literalmente todos los requisitos y todas las fronteras de producto
ya fijadas: IDs existentes, propósito, clases, criterios, efectos y alcance de
requisitos. Pueden añadirse pasos justificados y cambiar métodos, roles,
instrucciones, dependencias o herramientas autorizadas. Los nodos ya aceptados
deben permanecer exactamente iguales. Se preservan sus productos; se invalidan
los descendientes afectados mediante PlanLedger. No ofrece todavía jubilación
automática de una obligación local ni sustituciones semánticas de criterios.

Tras aceptación se habilita el presupuesto de intentos del método nuevo sólo
para el nodo materialmente rechazado. No se borra su historial, no cambia la
política original y no se devuelve ninguna reserva global de inferencia. Las
rondas globales tienen techo durable; reiniciar o renombrar nodos no lo aumenta.
Sin mejora aceptada, queda el resultado y el bloqueo concreto, no un PASS.

## Fronteras de recuperación y cualificación pendiente

Origen inmutable de ronda; candidato de plan ligado al origen; instalación,
checkpoint y conclusión de ronda en una transacción. La revisión de cuota
reanuda el mismo candidato. Sin permiso de efectos nuevos, compras o publicación.
Los recorridos sellados/ciegos y documentales requieren un contrato de revisión
compatible específico: no se importará su contexto privado a este mecanismo.

La primera prueba del opt-in falló porque el campo no existía: SCHEMA en create,
0 PASS/1 FAIL, 269.838414 ms. Eso demuestra ausencia de la función, no un fallo
de ejecución de un protocolo ya existente. Primera implementación: 1 PASS,
1490.865979 ms. Después, diez controles de integración: 10 PASS/0 FAIL,
6593.438974 ms; salida íntegra conservada en verification/experiments.

Ampliación vigente: 15 PASS/0 FAIL, 10022.609133 ms, en el motor; 14 PASS/0 FAIL,
7356.523944 ms en contrato y cinco SIGKILL reales; modelos simulados. CLI:
1 PASS/0 FAIL, 3705.554906 ms, sin inferencia, política/idempotencia/permanencia.
Se cubren cambios cosméticos, criterios debilitados, ancestro modificado,
rechazo del nuevo plan, cuota con nueve reservas exactas, techo de rondas,
citación inválida, transacción de instalación fallida, retirada de plan/input,
alteración de origen/vínculo y agotamiento del techo global de cuatro llamadas.
La prueba CLI precede al añadido del resumen en report; regresión posterior
todavía necesaria. Report se verifica en los cinco casos de caída sin cambiar
el journal. Pendientes regresión completa y cualificación real proporcionada.
Global dEyKIN/76407 cerró exit 1 a 02:19:32.854 UTC: 1552 tests, 1548 PASS,
tres FAIL, un SKIP; 336470.156571 ms. Los tres fallos están en report.test.mjs:
el nuevo lector asumía policy presente en registros históricos mínimos. Se
corrige el lector con acceso opcional, sin completar ni reescribir esos datos
ni cambiar las pruebas. Esa global permanece FALLIDA; no cualifica un runtime.
No declarar R06 cerrado.

## Cronología de ejecución después de cambiar de método

La global corregida p0mQNE/44093 aprobó 1551 PASS/0 FAIL/1 SKIP de 1552,
328684.935163 ms, cierre 02:27:48.242 y auditoría 02:29:59.103. Sin embargo,
una sonda adicional falló: dependencyGates comparaba el plan nuevo con el primer
intento del nodo antiguo, por lo que el oracle de linaje rechazaba el resultado.
El resultado rojo íntegro permanece como evidencia operativa privada; el caso
y su contrato reproducible se mantienen en esta publicación.
No se inició ningún ensayo real ni se congeló/instaló esa versión como solución.

La corrección posterior conserva TODOS los campos del primer intento global.
Añade una cronología `methodRevision` sólo con origen/completado inmutables,
plan exacto y registro de producción cuyo contrato corresponde al nodo revisado.
La instalación y conclusión preceden al nuevo actor por secuencia de journal.
El observador muestra por separado aceptación anterior al primer intento del
método revisado. Las obligaciones explícitas sobre el intento inicial o todos
los intentos siguen evaluándose contra la historia original, no contra esa
segunda frontera. El juez recibe esta distinción; el oracle de linaje comprueba
el recorrido autorizado actual sin afirmar aceptación retroactiva.

Sonda verde: COMPLETED, histórico global false, nueva frontera true, dos
artefactos en linaje aprobado; salida íntegra conservada. Los cinco cortes SIGKILL
comprueban ambas cronologías, reentrada y alteración de la conclusión. Una
conclusión alterada bloquea el producto nuevo, sin cambiar el histórico antiguo.
Integración posterior: 39 PASS/0 FAIL, 8385.794234 ms (6902 exit 0), en cinco
archivos de gates, procedencia, recuperación y reportes. La regresión posterior
v3wP0Y aprobó 1551 PASS/0 FAIL/1 SKIP el 14 septiembre a 02:43:19.925.
Su freeze 5bacdb46 se usó en 2spDVa: cinco inferencias reales tras tres semillas
SIM, 16 controles aprobados, 56 usos de citas auditados y reentrada sin repetir
trabajo. El coste fue 135.255 tokens reales observados; no acredita eficiencia
general. Las globales fallidas y la sonda roja anteriores siguen siendo históricas.
