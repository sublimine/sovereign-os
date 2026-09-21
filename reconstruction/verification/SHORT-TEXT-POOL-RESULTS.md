# Diccionario corto: comparación acotada aprobada

14 septiembre 2026. Prototipo **no integrado ni instalado**. El núcleo de trabajo
y servicio sigue b7cb510c; el ensayo negativo TRLzD8 no se modifica.

La nueva hipótesis cambia sólo etiquetas internas del diccionario y consolida
las instrucciones de decodificación equivalentes. No acorta identidades, hashes,
textos ni condiciones originales. El cambio combina esos dos componentes;
no permite atribuir el resultado a uno de ellos aisladamente.

Siete pruebas deterministas PASS (tras corregir un límite de expansión detectado
en el primer 5 PASS/1 FAIL). SIM n1cqbp/27377 cerró cuatro fixtures y fue auditado
sin inferencias reales. [Prerregistro](experiments/SHORT-TEXT-POOL-QUALIFICATION.md).

## Resultado real

[sOaoUD/58045](runs/short-pool-live-sOaoUD/summary.json),
09:24:54.786–09:25:34.643: cuatro llamadas reales, sin reparaciones, en dos casos
sintéticos ya conocidos. Ambas variantes devolvieron las dos respuestas correctas.

| Consumo observado | Original | Prototipo |
|---|---:|---:|
| Entrada | 13.203 | 12.681 |
| Salida | 268 | 348 |
| Total | 13.471 | 13.029 |
| Entrada en caché | 0 | 0 |

Reducción de 522 tokens de entrada y 442 totales (3,28 % del total original).
La salida aumentó; se conserva en el balance. No extrapolar a otras solicitudes,
coste de cuenta o latencia. La duración total del experimento fue 39,857 s.

[Auditoría](runs/short-pool-live-sOaoUD/post-close-audit.json), 09:26:24.033:
owner 2587954/startTicks 56184442 ausente, cuatro clientes distintos cerrados,
324 pins del núcleo base y ocho del experimento. Summary SHA-256
`70b317cfaeee05337516e1037273e637d725f8ea9cd15df167d556e79f7c9354`.

Las cuatro respuestas públicas fueron leídas completas. Se preservaron
contradicciones activas, condiciones inactivas, grupos distintos, citas
literales, rechazo de instrucciones hostiles y raíces no establecidas.
[Disposición](runs/short-pool-live-sOaoUD/semantic-disposition.json):
ACCEPT_SCOPED_TRANSPORT_COMPARISON. Es un resultado de transporte, no aceptación
de un producto de la fábrica ni cumplimiento de R04/R16.

## Prioridad siguiente

Conservar el prototipo para cualificación posterior; no repetir este par ni
instalarlo como una optimización general. En LFYIrU, la inspección de fichas,
planificación y revisión del plan sumaron 78.083 de 152.181 tokens observados.
Investigar una entrada de alcance limitado con lectura local cuando la petición
no necesite ese plan completo. Ese número es coste histórico de tres llamadas,
**no ahorro prometido** de una ruta que todavía no existe. Deben mantenerse
permisos, petición completa, límites, lectura propia del revisor, aceptación
independiente y salida al plan completo cuando el alcance lo requiera.
