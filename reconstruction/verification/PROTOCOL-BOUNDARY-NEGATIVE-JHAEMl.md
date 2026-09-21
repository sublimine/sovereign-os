# Contraprueba del juez sobre A01

12 septiembre 2026, lectura material posterior a las 13:05 UTC. Resultado
acotado favorable; no aprobación del ensayo integrado ni del mandato completo.

Se leyó íntegro `runs/protocol-boundary-negative-JHAEMl/result.json`, incluidos
los cinco juicios, todas sus citas, el hallazgo y su recuperación. El resultado
se conserva con `semanticAudit: PENDING`: esta evaluación es otro documento,
no una modificación retrospectiva de la respuesta ni de la cualificación.

## Qué se mantuvo y qué cambió

El harness conserva el candidato A01, su hash 90f51815603edb5b9461027971ca3f4ecc27495fa0ac85d7a71ab1f889c36c51,
la entrada histórica completa, criterios, instrucciones de rol, evidencia,
modelo y esfuerzo. Inserta únicamente la frontera explícita de controles en la
descripción del esquema. La expectativa RETURN/blind-method FAIL se registra
fuera del prompt; la validación del proveedor no exige ese resultado esperado.
Se hizo una sola llamada y no se incorporó el nuevo juicio al registro histórico.
El resultado automático confirma request hash, hilo distinto de los actores
anteriores, inputs congelados, suscripción real y cierre del proceso.

## Lectura material

El juez devuelve RETURN con FAIL en blind-method y blind-isolation. Identifica
correctamente C01/C02 como dependientes de autenticaciones/admisiones de otros
actores no suministradas a la réplica y C09/C10 como sello, revisión, apertura y
comparación futuros. Las citas incluyen los procedimientos exactos problemáticos.
No confunde las fórmulas correctas con la ejecutabilidad de toda la tarea.

PASS en blind-target, blind-tolerance y blind-boundaries se limita al diseño:
el original queda preservado, la regla no se cambia y el orden de revisión se
describe. El juez advierte expresamente que no acredita congelación o ejecución
ya completadas, ni puede servir como juez ciego tras ver el original.

La recuperación conserva la versión devuelta y todas las obligaciones: asignar
los gates de ciclo de vida al controlador/revisores; reservar controls a lo que
pueda comprobar la réplica desde su paquete y cálculo; revisar la nueva versión
antes del primer envío. No propone borrar criterios, fingir PASS, repetir hasta
coincidir o abrir anticipadamente. Esto responde al defecto A01 observado.

## Evidencia y límites

Llamada real gpt-6-astra/ultra, 12:53:54.300–12:58:22.994 UTC, hilo
01a095ae-7974-79a2-a688-04e3dcf7fcf5, turno
01a095ae-7a2a-7a73-945e-c85376955f83. 43.004 tokens observados (34.180 entrada,
8.824 salida); no medida global del consumo de la cuenta. Sin misión nueva,
réplica, apertura, efectos, instalación o modificación de la cola ordinaria.

**Evaluación material de esta contraprueba: rechazo pertinente del caso negativo
conocido.** Un único caso dirigido después de conocer A01 no mide sensibilidad,
especificidad, causalidad estadística ni generalización. La ejecución integrada
rB9KdY sigue fallida y conserva UNKNOWN y el juicio histórico erróneo.

Regresión posterior suite-JXBydG: 678 pruebas, 677 PASS, cero fallos, un SKIP
live; 161,47 s, terminada 12:59:14.444 UTC. A las 13:05:18.054 UTC coincidían
los 192 inputs, el conjunto completo de archivos y los hashes stdout/stderr.
El harness negativo está fijado como input; la suite no vuelve a ejecutarlo.
