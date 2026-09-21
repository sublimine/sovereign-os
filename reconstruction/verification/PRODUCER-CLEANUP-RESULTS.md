# Cierre durable del productor: cualificación acotada

14 septiembre 2026. Versión 68fd4472; no confundir esta prueba con finalización
del mandato ni con eficiencia general. Estado de instalación en STATUS.md.

## Defectos y controles

La primera sonda reprodujo tres fallos de consumo antes de cierre confirmado.
Se añadió prueba durable por petición y protocolo SQLite 3 al iniciar producción
protegida. Lecturas e invocaciones antiguas no se convierten en prueba retroactiva.
Una sonda posterior detectó un cuarto fallo: error del evento diagnóstico después
de CLOSED bloqueaba la recuperación. Corregido sin relajar UNCONFIRMED.
Los rojos, integraciones y sus alcances están en [el contrato](../design/PRODUCER-CLEANUP-BARRIER.md).

La global 97P0Jx pasó pero no se congeló por ese cuarto fallo. La global posterior
SdIPvT cerró 04:57:38.595: 1598 tests, 1597 PASS, cero FAIL, un SKIP,
346061.195876 ms. Auditoría 04:57:56.476: 315 entradas, cuatro streams y dos
owners ausentes. Snapshot 68fd4472, 426 archivos y 24.189.152 bytes.
La compatibilidad h5Xj0F usa los módulos antiguos reales efbdb0e9: bloqueo de
apertura/escritura antigua sobre protocolo 3 y preservación de registros legados.
Sólo bases aisladas, ninguna llamada real en esas pruebas.

## Ensayo de suscripción

[Preregistro](experiments/PRODUCER-CLEANUP-QUALIFICATION.md), sin cambiar el caso
conocido, fichas, modelo, criterios ni límites. SIM RBbJO1 pasó con cuatro
respuestas simuladas; auditoría de tres owners ausentes, nueve citas y tres
registros de cierre. El brazo real 9FZelU/49819 cerró exit 0 después de tres
llamadas y 19 comprobaciones aprobadas.

| Papel | Tokens observados | Resultado |
|---|---:|---|
| Productor, observación | 9.260 | Propuso listado y lectura como lote; broker ejecutó ambos |
| Productor, resultado | 14.010 | Informe numérico exacto, candidato sin autocertificación |
| Revisor independiente | 23.586 | Lecturas propias, recálculo explícito y ACCEPT |

Total: **46.856 tokens**, cero cacheados. No es una comparación de eficiencia
con una ejecución anterior. El coste sigue siendo elevado para el tamaño del
caso y no se presenta como óptimo.

Se leyeron las tres respuestas públicas completas. El informe calcula
1200 + 250 + 5000 = 6450 mg, diferencia declarado menos calculado +50 mg y
consistent=false; conserva el SHA-256 de la entrada, límites físicos y revisión
pendiente. El juez muestra su recálculo desde los decimales originales, cita su
listado/lectura posteriores y mantiene la incertidumbre sobre la causa y realidad
física. No se modificó el archivo ni hubo comandos, búsquedas o descargas.

El SIGKILL fue posterior a las dos salidas de proveedor observadas y sus registros
durables, pero anterior al candidato. Otro proceso recuperó exactamente el mismo
final, sin nueva inferencia de producción, efecto ni reserva. Un tercer proceso
devolvió el mismo artefacto aceptado sin trabajo adicional.

[Auditoría cerrada](runs/producer-cleanup-live-9FZelU/post-close-audit.json),
05:03:49.045: tres owners ausentes, 315+4 pins, trece usos de citas resolubles,
dos cierres de productor, protocolo 3 y journal 147 íntegro. Resumen SHA-256
`06747640b93371e802f38f3cbf0d18dcbc72bed14b8491f06d90b89f289afb58`;
DB `eae26012e8cf70e25ca570d3a04e0dfa5e6e8e34906c50fa0a62694c3d24efbd`.

## Límites

Es un nodo fijo conocido, no una misión con planificación real ni un holdout.
La misión del harness permanece NEW; no se falsifica COMPLETED. Los cortes
negativos antes/durante cierre usan modelos SIM y procesos/SQLite reales; aquí
no se mató un proveedor real todavía en ejecución. No prueba exactly-once remoto,
apagado de la VPS, días de operación ni reconciliación automática de todo cierre
desconocido. El cursor de lotes sigue pendiente.
