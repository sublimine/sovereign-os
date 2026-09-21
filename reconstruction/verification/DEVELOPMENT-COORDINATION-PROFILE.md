# Coste observado por fase — geTKWd

Actualización21:07: este perfil histórico permanece sin cambios. La alternativa
opt-in de lotes lectura/prueba se documenta en
`reconstruction/design/PRODUCER-READ-TEST-BATCH.md`; su ensayo nuevo está
prerregistrado en READ-TEST-DEVELOPMENT-QUALIFICATION.md. No se resta el coste
de llamadas de esta misión fallida para atribuirle ahorro al nuevo protocolo.

13 septiembre2026. Lectura de capturas cerradas request/call/response de
runs/development-launch-live-geTKWd/merge-integer-windows-adaptive. No se ejecuta
ni modifica la misión. Original FAILED; no se presenta como ruta eficiente o
completada. No son estimaciones de facturación monetaria ni ahorro causal.

| Llamada | Función/salida observada | Tokens informados | Input UTF-8 B | Salida pública B | Duración de llamada ms |
|---|---|---:|---:|---:|---:|
| 0 | Entrada: deriva a plan | 8237 | 4952 | 266 | 9417 |
| 1 | Propuesta de plan | 30012 | 58702 | 18090 | 256517 |
| 2 | Revisión del plan ACCEPT | 25047 | 48255 | 6253 | 207810 |
| 3 | Propuesta de listado raíz | 15432 | 38125 | 225 | 7608 |
| 4 | Propuesta de tres escrituras | 26199 | 43159 | 20344 | 279558 |
| 5 | Propuesta de listado y tres lecturas | 27625 | 73316 | 448 | 11675 |
| 6 | Propuesta de ejecución v1 | 34640 | 89874 | 223 | 15134 |
| 7 | Reparación del test: barrera de38casos | 45043 | 102140 | 13762 | 184128 |
| 8 | Propuesta de lectura del test reparado | 50147 | 130577 | 207 | 12075 |
| 9 | Propuesta de ejecución v2 | 57366 | 147374 | 240 | 14672 |
| 10 | Candidato final | 64697 | 161104 | 2379 | 72593 |
| 11 | Revisor de producto: TIMEOUT | DESCONOCIDO | 179749 | Sin respuesta completa | 900056 |

Once recibos completos,384445tokens observados; una llamada sin consumo conocido.
Las duraciones son diferencias startedAt/completedAt capturadas, no sólo tiempo
de razonamiento. Los bytes de salida corresponden a la respuesta pública
estructurada, nunca a razonamiento privado o deltas incompletos del proveedor.

Las llamadas5,6,8,9 consumieron169778tokens observados. No deducir que eliminarlas
ahorraría169778tokens: hacen propuestas públicas y la siguiente llamada tendría
otro contexto. Además la lectura produce nueva evidencia que NO puede quitarse.
La reparación7 es trabajo sustantivo provocado por la insuficiencia del resultado
agregado del runner; no es coordinación redundante.

El input del productor pasó de38125B a161104B; su contexto decodificado final
ocupa233026B, de los cuales115206B son toolObservations. El contexto del revisor
fallido ocupa287841B decodificados:132114B de observaciones y87157B de artefactos.
La codificación lossless ya evita parte de la repetición de bytes; esto no prueba
que haya evitado el coste cognitivo del historial. El tamaño no demuestra la
causa remota del timeout y no autoriza a truncar fichas, hechos o criterios.

## Hipótesis acotada, no beneficio proclamado

Un checkpoint explícito podría reunir el listado/lecturas/ejecución ya fijados
entre5y6 en una propuesta. Sigue ejecutando cinco operaciones independientes,
con recibos propios, y entrega todos sus resultados al productor antes de que
decida reparar o finalizar. El juicio independiente ocurre después del candidato.

El productor ya gastó12operaciones: dos listados, cuatro escrituras, cuatro
lecturas y dos ejecuciones. Su límite existente es12. Repetir un checkpoint
completo después de reparar el test añadiría lecturas redundantes de los otros
dos archivos y superaría ese límite. No elevarlo silenciosamente: el trabajador
puede conservar la primera agrupación y usar después la lectura/ejecución
específica restante, o bloquear una propuesta que exceda su presupuesto.
No prometer dos llamadas menos bajo el mismo límite con ese protocolo.

La validación pura experimental producer-checkpoint-contract.mjs tiene20tests
PASS230.270657ms, sin modelo, broker, archivo de misión o instalación. No ejecuta
el checkpoint, no reserva presupuesto durable ni implementa su recuperación.
Faltan vinculación a plan/run, observaciones base autenticadas, cursor durable,
reconciliación de efectos/caídas y exposición posterior completa antes de integrarlo.
Después hacen falta regresión completa y comparación prospectiva real, no usar
esta ruta fallida como un brazo retrospectivo favorable.
