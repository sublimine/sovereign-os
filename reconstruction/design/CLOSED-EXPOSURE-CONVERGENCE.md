# Convergencia posterior a apertura: exposición bilateral

## Fallo observado, no hipótesis de contaminación

El ensayo wmUkhp terminó NEEDS_DIRECTION el 12 de septiembre de 2026 a las
15:56:31 UTC. Su juez final aceptó 27 obligaciones y declaró UNKNOWN la
noexposición bilateral registrada. La prueba autenticada mostraba la aprobación
del protocolo y la producción del comparador, pero no las solicitudes completas
de los dos actores cerrados. No faltaba el cálculo: una sola réplica había
obtenido 61; el original 62, la distancia 1 y MISMATCH estaban preservados.
El hallazgo exige datos que existían antes de apertura, no repetir el experimento.

## Reutilización y ubicación

Se reutilizan ArtifactRegistry, la retención BEFORE_DISPATCH, los hashes de
exposición completada, las versiones del journal y la aprobación material.
`factory/lib/blind-exposure.mjs` sólo proyecta estos registros; no llama al
proveedor, añade votos, modifica el informe ni abre otra vez el original.

La proyección entra por `blindComparisonEvidence`, **después** de apertura y
**antes** de la nueva revisión final. No se añade a la entrada del replicador
ni a la de su juez material. La aprobación material precede a apertura; la
comparación y su revisión se realizan después. El control de alcance del plan
anterior al trabajo no se confunde con verificación de resultados aún inexistentes.

## Contrato comprobable

- Actores exactos: ejecución sellada y juez vinculado a la aceptación material.
- Corte temporal: versiones históricas referenciadas, no las últimas cabeceras.
- Secuencia: solicitud retenida antes de ejecución completada, luego revisión y
  apertura; registros tardíos no se presentan como conocimiento anterior.
- Cada solicitud incluye instrucciones, entrada, esquema, modelo y esfuerzo
  públicos completos, con digest y registro de procedencia. No incluye
  razonamiento privado del modelo ni credenciales del proveedor.
- Contextos admitidos y recibos se enlazan a todas las solicitudes completadas.
  RECORDED significa cobertura de esos registros, **no** independencia cognitiva,
  ausencia semántica de pistas, aislamiento del proveedor o seguridad del host.
- Cobertura incompleta es UNKNOWN. El juez debe inspeccionar el contenido real;
  un nombre de rol o una lista de identificadores excluidos no bastan.
- La comparación mantiene exactamente su cuerpo, criterios, regla, original,
  resultado, controles, incertidumbres y limitaciones previos.

## Compatibilidad y reintentos

Las observaciones firmadas antiguas se revalidan con su formato histórico; no
se les añade conocimiento retroactivo. Una captura nueva ofrece la proyección
bilateral sólo a una inferencia posterior. La presencia de un campo parcial o
adulterado no autoriza aceptar una prueba antigua como si estuviera completa.

Se separa BLIND_REVIEW_PROOF (falta de cita de vinculación reparable) de
BLIND_REVIEW (por ejemplo, contaminación del hilo, terminal). Un segundo intento
permitido debe preservar feedback, solicitudes y recibos, y usar un hilo nuevo.
No se repara un hilo contaminado reenviando la misma tarea.

## Pruebas y límites de aceptación

Regresiones dirigidas cubren exposición íntegra bilateral, ausencia de filtración
a actores cerrados, registros futuros que no reescriben la prueba, solicitudes
ausentes o retenidas fuera de orden, formatos históricos y reparación legítima
frente a contaminación terminal. En wmUkhp, una lectura transaccional read-only
produce la proyección nueva sin modificar journal, cuerpos, revisiones o resumen.

Suite-DAsvOz, 16:11:05–16:13:30 UTC: 712 pruebas, 699 PASS, 12 FAIL, un SKIP.
Los 202 inputs y hashes de stdout/stderr coincidían a las 16:16 UTC; las salidas
parciales también coincidían con las finales. Los fallos se concentran en el
simulador de planned-blind: copiaba repetidamente la prueba completa como cita
y excedía OUTPUT_LIMIT con la nueva evidencia. Se ajustan sus citas a un pasaje
exacto manteniendo la prueba completa en entrada y el presupuesto original.
Las 24 pruebas posteriores de planned-blind pasan (181,21 s), incluidos los
12 recorridos antes fallidos y la comparación exacta de entradas completas de
ambos actores contra su proyección. La regresión global i8xKuV da 715 pruebas,
714 PASS/cero fallos/un SKIP, 237,37 s; sus 204 inputs, conjunto de archivos y
salidas coinciden a las 16:25:15.711. DAsvOz no se transforma en aprobada.

El comprobador de despliegue también rechaza explícitamente interrupciones,
cancelaciones y resúmenes incompletos incluso con exit 0. Tres pruebas de ese
predicado pasan. DAsvOz demuestra conservación de flujos parciales durante una
terminación ordinaria de la batería; no se ha ejecutado todavía una prueba
dirigida de señales sobre el nuevo harness y no se atribuye ese resultado.

Una evaluación prospectiva de una llamada, sobre copia de wmUkhp, está preparada
para medir si la evidencia resuelve el hallazgo. Incluso un ACCEPT sería sólo
esa evaluación, no recuperación automática del workflow, cualificación de una
misión completa, calibración general ni finalización del mandato de la fábrica.

## Verificación posterior — 16:32–16:47 UTC

94TM7H terminó ACCEPT, 28 PASS y cero findings; se leyeron todos sus checks,
razones, citas y límites. Inspecciona las solicitudes reales de ambos actores
y resuelve la carencia concreta, manteniendo 62/61 y MISMATCH. La fuente y su
rechazo siguen intactos, y ninguna misión se ha reanudado o completado.
Una inferencia real, 96219 tokens: no se declara eficiencia satisfactoria.
[Resultado y lectura completa](../verification/COMPARISON-EVIDENCE-BILATERAL.md).

El harness también tiene ya prueba dirigida de SIGTERM real a su propio hijo:
conserva salidas parciales y rechaza el exit 0 interrumpido. Seis pruebas PASS
incluyen ese caso, bytes UTF-8 fragmentados y fallo de spawn. La regresión
GUF4WD posterior terminó con 718 pruebas/717 PASS/cero fallos/un SKIP, 240,13 s.
Estos resultados son posteriores al corte anterior; no lo reescriben.
