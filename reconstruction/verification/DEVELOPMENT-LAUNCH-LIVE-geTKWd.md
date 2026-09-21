# Desarrollo real geTKWd: cerrado sin cualificación

13septiembre2026. Ensayo18:49:11.734–19:22:14.715UTC, sesión66181exit2.
Runtimeba2662d3746e2f501f0078a43a55680bfdf56747bceddb4842b2abba553eff4a,
regresiónC5d78Q, política original sin cambios. NO instalado. El ensayo falló:
timeout de900000ms en la revisión del producto. No hay entrega aceptada, dictamen
de ese revisor, oracle externo ni reentrada cualificada. No se reabre el original.

## Evidencia obtenida antes del fallo

Doce llamadas despachadas, once respuestas completas reales por suscripción.
384445tokens observados en esas once; consumo de la llamada vencida DESCONOCIDO,
no cero ni total completo. Doce cierres de proveedor con salida observada.

La entrada derivó a planificación. Plan:14requisitos,19criterios finales, un
especialista autónomo de implementación y omega_22 de revisión. Se leyeron
propuesta, fichas/cartas recibidas y juicio completos: no se detectó
incompatibilidad material en este caso acotado. El único ACCEPT es del plan,
con cinco criterios. Un plan aprobado no acredita la ejecución de su método.

Producto: tres archivos, leídos íntegros por el operador. El módulo valida
arrays densos propios/pares/Number seguros, copia antes de ordenar, normaliza
-0, usa comparaciones relacionales y protege la suma de adyacencia en MAX.
El barrido conserva huecos y evita reutilizar arrays de entrada. Sin imports
o instrucciones propias de I/O/procesos. La documentación explica uso, errores,
O(n log n)/O(n), límites y dependencia de revisión ajena; no finge haber ejecutado.

Los tests contienen38casos registrados,120permutaciones y3616listas pequeñas
contrastadas por conjuntos, además de extremos, errores, congelación,
identidad/referencias, mutaciones posteriores y huecos con índices heredados.
La primera ejecución informó un PASS agregado. El productor conservó ese
recibo, añadió await Promise.all y aserciones de registro/finalización de38casos,
leyó la nueva versión y volvió a ejecutar. Esa reparación fue decisión del
productor, no una corrección externa o un borrado del primer resultado.

Tres execution-job auténticos: productor v1, productor v2 y revisor v2.
Todosexit0/stderr vacío, STARTEDpost-exec firmado y scratch eliminado; el test
runner sigue informando un archivo, no38subtests individualizados. No hay
medición de cobertura por líneas ni prueba exhaustiva de todo JavaScript.

La instantánea v2 común a productor/revisor:
e3352061c2c24a9f2a0416951a5b120feb28e19dd7799ac1ce68ffa479847239.
Sus tres hashes son:

- merge-windows.mjs:644efa89756ed1b8474c29a72dc669a35ec9159673b8eb251ef1859f82ed7473
- merge-windows.test.mjs:fb038c3a74463fb362f3da2a42cf772a5b25fd4890f4997432dc453e3924856f
- README.md:d9c513f8cedd7822374efc7d953e648760fe9e970b2f7fb4e66d68bb957a37a4

## Frontera que falló

Petición11 del juez19:07:13.826, input179749B/schema8241B; errorTIMEOUT
19:22:13.884. Metadatos conservados: turn/started, dos agentMessage iniciados,
ningún agentMessage completado y ningún turn/completed.68muestras de progreso;
primera19:11:36.224, última19:17:18.574 con36199bytes. Diagnóstico final:
36563bytes de salida parcial y3272805bytes de protocolo. Cero provider.retry
observados. Los textos parciales no se convirtieron en juicio ni se recuperó
razonamiento privado. No sabemos por qué el proveedor no cerró la respuesta;
el tamaño del contexto por sí solo no demuestra la causa.

El motor guarda FAILED/TIMEOUT, nodoRETURNED con candidato todavía CANDIDATE.
TIMEOUT está excluido del contador de fallos de calidad. MissionQueue ya reconoce
FAILED/TIMEOUT como reintento de infraestructura con presupuesto finito; este
harness aislado no usa la cola y su contrato detiene el ensayo fallido. Por tanto
no se ha demostrado que la cola ordinaria se pare irreversiblemente por esto.

## Reconciliación de solo lectura

19:24:01.492: owner2219697 ausente,287inputs/runtime/dos pins intactos;
solicitudes retenidas, once recibos, doce cierres y tres jobs reconciliados con
SQLite readOnly/query_only/en una transacción. Firmas, nonce/unidad/PID/snapshot
y bootstrap del runtime exactos. Ninguna nueva firma, efecto, inferencia o cambio
en la base. Juez conserva expectedRequestHash sin completar; no se borra.

Journal695eventos/head
d659546268a1b3e2a23f16e59967cb1118a5513bd4e5fa82ae990a5c63b9f62c.
DB:c53294d47a02b13c1ded203234f8520cffdbf36747ea6dec7a2dcaed55e194ef.
Resultado:1a410b23aaa14beecd31376c05b182fef17f44441fb20e1899cacf49cfc4ca58.
Resumen:e84ebc369d1da7958137d813d675bd422a9a57ed810484c2f9fe1bf296597889.

El auditor nuevo experiments/audit-development-launch.mjs está preparado sólo
para brazos cerrados satisfactorios; node--check y rechazo antes de abrir una
base viva comprobados. NO se ha ejecutado satisfactoriamente contra este brazo
fallido ni se declara cualificado por la reconciliación diagnóstica anterior.

Una futura recuperación, si se ensaya, debe preservar este fallo y usar otro
ámbito explícito: candidato exacto, sin otro productor, sin writes, presupuesto
finito y criterio de no replay. Su resultado no rehabilitaría este ensayo como
una ejecución íntegra satisfactoria. R01–R16 continúa abierto.

[Resultado original](runs/development-launch-live-geTKWd/merge-integer-windows-adaptive/result.json),
[informe final](runs/development-launch-live-geTKWd/merge-integer-windows-adaptive/final-report.json).
