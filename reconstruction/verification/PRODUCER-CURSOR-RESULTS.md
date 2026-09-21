# Resultado del cursor exacto recuperable

14 septiembre 2026. **Instalado 926c524d**, después de la cualificación y de
preservar la instalación anterior. [Instalación](CURSOR-RUNTIME-INSTALLATION-2026-09-14.md).
El mandato completo permanece pendiente. Este resultado tiene el siguiente alcance.

## Pruebas antes del uso real

Global G50Fbx: 1654 tests, 1653 PASS/0 FAIL/un SKIP, 400502.788131 ms.
Auditoría 06:07:45.248: 320 entradas, cuatro streams intactos y dos owners ausentes.
Incluye ocho fronteras SIGKILL del coordinador completo con modelos SIM y
archivos/ejecución nativos. La continuidad usa el mismo productor y el juez
mantiene sus propias lecturas/prueba. Un despacho sin resultado se reconcilia
como EXECUTION_INTERRUPTED, sin repetición ni candidato aceptado.

La primera batería del motor conservó 1 PASS/5 FAIL: exigía incorrectamente que
una reentrada del coordinador no escribiera adquisición/liberación de propiedad.
Se corrigió esa aserción, manteniendo comparación exacta de todos los registros
materiales, inferencias y efectos. [Resultado inicial](experiments/producer-batch-engine-initial.json).
No se rebajó la prueba de idempotencia material para conseguir un PASS.

SIM Mx2jtO: tres respuestas, 20 controles PASS; auditoría 06:12:39.301,
tres owners ausentes, 320+5 pins, nueve usos de citas, protocolo 4 y dos cargos.
No contabiliza tokens ni prueba semántica real.

## Ensayo prospectivo de suscripción

[Contrato previo](experiments/PRODUCER-CURSOR-QUALIFICATION.md).
[Auditoría bSXjkB](runs/producer-cursor-live-bSXjkB/post-close-audit.json).
Se reutilizó un caso CONOCIDO de cantidades exactas: 1200 mg + 0,25 g +
0,005 kg = 6450 mg frente a 6500 declarados. No es un holdout ni planificación
real: se asignó un único nodo conocido y la misión aislada permanece NEW.

| Llamada | Producto real | Entrada | Salida | Total |
|---|---|---:|---:|---:|
| 0 | Lote original list/read | 9641 | 134 | 9775 |
| 1 | Informe candidato después de reanudar | 12642 | 1746 | 14388 |
| 2 | Juicio independiente | 17187 | 5412 | 22599 |
| Total | Tres llamadas, cero tokens de entrada en caché | 39470 | 7292 | 46762 |

Primera llamada 06:13:09.195→06:13:17.184; última finalizó 06:16:59.549.
GPT-6 Astra/ultra por suscripción, sin API/fallback/reset/compra. Veritas 07 y
Omega 22 usaron sus fichas completas. Tras el listado real se mató el productor
antes de observarlo: estaban comprometidos un cargo, un recibo y el cursor
en posición cero; sólo había una reserva de inferencia. El proceso nuevo incorporó
ese recibo, despachó únicamente la lectura pendiente y cerró el lote con dos
cargos antes de pedir el final del paso 1. No hubo propuesta sustitutiva.

El juez hizo su propia lectura/listado posteriores al candidato y dio ACCEPT.
La tercera reentrada conservó el mismo producto aceptado sin nuevas llamadas,
herramientas o decisiones. 20 controles PASS; auditoría 06:18:02.325 con tres
owners ausentes, 320+5 pins, quince usos de citas exactas, journal 148.
Resumen SHA-256 `47d5b5199d013eda3d83cc822a484b73d1e74bccac048fb8d2f8905f34a7bcb4`.

## Revisión sustantiva del coordinador

Se leyeron completas las tres respuestas públicas. El primer lote no inventa
resultados; el candidato calcula correctamente las conversiones, +50 mg y
consistent=false, mantiene procedencia y no inventa incertidumbre instrumental.
Separa el cálculo documental de existencias físicas y causa de discrepancia,
que deja desconocidas. El juez vuelve a calcular desde las fracciones originales,
comprueba el hash y cita sus observaciones propias, el candidato y el inventario
del nodo; limita la ausencia de efectos a operaciones registradas por el broker.
El status CANDIDATE interno y gate_receipts vacío no se reescriben como si el
productor se hubiese aceptado a sí mismo: la decisión externa está separada.

Esto prueba esa trayectoria y sus fronteras verificadas. No demuestra que 46.762
tokens sean eficientes para cualquier encargo, una comparación contemporánea con
otro sistema, recuperación de todas las herramientas, tres días sin interrupción,
perfección o el mandato completo. El cursor no cubre escrituras, fuentes o
navegación documental como lotes recuperables; el resto conserva sus rutas.
