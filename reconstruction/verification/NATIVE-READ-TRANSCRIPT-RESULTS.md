# Transcripción de lectura: componente en desarrollo

14septiembre2026. Implementado
[native-read-transcript.mjs](../../factory/providers/native-read-transcript.mjs),
todavía no conectado al adaptador, WorkerService o una misión operativa.
[Contrato](../design/NATIVE-READ-TRANSCRIPT.md).

El componente reconstruye BIND/CALL/PREPARED/DISPATCH_INTENT/ACK/FINISH/ABORT
desde frames encadenados y un hash final retenido aparte. Vincula un actor,
pedido, herramienta, thread/turn/call; limita a una llamada y valida bytes
UTF8/canonización. No habilita IO, permisos o inferencias. Una referencia
sintácticamente válida no acredita una reserva o un recibo auténticos.

51 pruebas propias. Cuatro terminan con SIGKILL un proceso hijo exclusivamente
de fixture después del commit SQLite: PREPARED, DISPATCH_INTENT, ACKNOWLEDGED
y COMPLETED. Reapertura/journal/hash esperados conservados, cero misiones,
actores y efectos; CAS rechaza una segunda escritura con versión vieja.
Es una prueba de checkpoint local, no caída de proveedor con lectura real ni
reinicio del sistema operativo. Los directorios temporales del test se eliminan
al cerrar; sus resultados y código permanecen.

Primera ejecución51/50PASS/1FAIL conservada: evento null producía TypeError en
lugar de rechazo de contrato tipado. Añadida validación de objeto; no se relajó
la aserción. [Negativo](experiments/native-transcript-initial-tests.json).
Dirigidos85890 cerrados:106tests/105PASS/0FAIL/1SKIP,1087.749172ms. Incluyen
proveedor cerrado y reporte existentes, no nueva llamada de suscripción.
[Salida completa](experiments/native-transcript-directed-tests.json).

**No instalable todavía.** Falta el controlador que verifica/persiste cada
transición, la reserva de continuación, el broker, el adaptador y su cancelación,
contrato de exposición versionado, recuperación del proveedor y revisión del
producto. El desarrollo incluye un módulo nuevo; la regresión zUEZhV sigue
perteneciendo a244d749e, no se atribuye a este árbol posterior. No repetir
el laboratorio1BuFGS para contar estas pruebas como nueva capacidad LIVE.
