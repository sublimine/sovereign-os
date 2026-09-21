# Recuperación de entrada cerrada: resultado real

14 septiembre 2026. Cualificación delimitada aprobada; no aceptación de todo el mandato.

## Procedimiento y resultado

El protocolo fijado antes del ensayo está en
[CLOSED-ENTRY-RESPONSE-QUALIFICATION.md](CLOSED-ENTRY-RESPONSE-QUALIFICATION.md).
El proceso productor recibió su respuesta real, comprometió recibo/respuesta y
confirmación de cierre, y sufrió SIGKILL antes de crear el candidato. El padre
reabrió SQLite y ejecutó engine.run. Recuperó la misma respuesta bajo el mismo
productor, creó el candidato y obtuvo revisión independiente. Un tercer proceso
reentró sin inferencia ni efecto y conservó el mismo resultado aceptado.

- Real `closed-entry-response-live-mB7oR4`, sesión 46910, exit 0.
  01:43:26.397 → 01:44:38.726 UTC, 19 controles aprobados.
- Dos llamadas reales por suscripción: 6.453 + 13.078 = **19.531 tokens**;
  cero tokens de entrada cacheados observados. Límite de misión dos, reservas
  dos y restante cero, sin devolución ni tercer despacho.
- Misión `mission:a218065d-fd69-46e2-9794-09b94908323e`, COMPLETED.
  Candidato `artifact:45c519e4-1989-4e1d-bf97-bd67b4a3892d`, hash
  `ec683a9e95a54c0b38d8cf719c56398c33d816ecb852687a7f1975ae24de4917`.
- Productor y juez en threads distintos; tres criterios de contenido del juez
  y cuatro criterios del runtime. Estos últimos no se atribuyen al modelo.
- [Auditoría posterior](runs/closed-entry-response-live-mB7oR4/post-close-audit.json)
  01:50:37.973: 308 entradas de regresión y cuatro pins experimentales intactos,
  tres propietarios ausentes, dos capturas/recibos/cierres/reservas concordantes,
  cuatro usos de citas contrastados literalmente, SQLite sin cambio de bytes.
  Respuesta en secuencia 30, cierre 32, corte en 32 y candidato en 36.

## Revisión sustantiva

Se leyó íntegra la respuesta pública y la revisión guardada, además de la
especificación del caso. La transformación selecciona primero revisión máxima
y último empate, y sólo después filtra activo. A queda fuera por su último
empate inactivo de revisión 3; C por revisión 4 inactiva, sin rescatar su versión
anterior. B conserva el cero del último empate; D conserva −2. El orden por
puntos de código es B, D, a, É, U+E000, U+1F600, diferente del error típico de
orden UTF-16 en los dos últimos. La suma exacta es 6. El JSON completo pasa el
oracle externo con detección de claves duplicadas, estructura y tipos exactos.
El juez explica esos mismos detalles y limita la ausencia de efectos al registro
de la misión, no a vigilancia de toda la máquina. No se encontró incumplimiento
material de este contrato delimitado. `summary.json` conserva su estado inicial
semanticAudit PENDING: esta revisión posterior se registra aquí, sin reescribir
el resumen original ni sus hashes.

## Controles anteriores y límites

SIM JVnipr/83713 cerró exit 0 a 01:42:54.230 con dos llamadas simuladas y 19
controles. Su auditoría de 01:45:53.022 está conservada en su directorio. La
regresión MUS7Oc cerró con 1521 PASS, cero FAIL, un SKIP de 1522 tests. Versión
inmutable e07a8b33322dd4c2e2bddf46f9e9b9064a052b779b11b4ededbae4c97afa3589,
425 archivos y 24.152.129 bytes. **No instalada**.

El caso de 13 registros es conocido y se reutiliza de otra cualificación, sin
transferir respuestas; no es holdout. Cubre el recorrido cerrado completo, no
un plan material, investigación ni aprendizaje. El corte real se hizo después
de comprobar el cierre: los cortes anteriores sin prueba de cierre siguen
bloqueados y se verifican con modelos simulados. No prueba apagado de OS,
exactly-once remoto, superioridad o eficiencia general. El coste observado se
conserva aunque resulte elevado para una transformación pequeña.
