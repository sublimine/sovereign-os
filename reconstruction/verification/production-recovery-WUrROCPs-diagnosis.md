# Recuperación real: rechazo conservado

Misión `mission:e1150665-9a3e-41c9-bdd2-00763075a33a`, estado bajo
`/home/cardeex/codex-workspace/sovereign-production-recovery-live-WUrROCPs`.

La primera fase creó tres archivos mediante el broker y se interrumpió con QUOTA
inyectada antes del siguiente request. La segunda usó el mismo runtime fijado
`b99cbfd0`, en otro proceso. Los productores recuperados leyeron y conservaron
los archivos, sin repetir escrituras. El revisor independiente recibió sus
propias lecturas, pero no el historial completo del productor anterior.

Los artefactos `artifact:511d9558-ca5f-48f8-971d-41471f62b25b` y
`artifact:24e15dcb-cc88-406e-ad93-dcf61d835260` recibieron RETURN por falta de
pruebas de exclusividad histórica y preservación. No se interpreta ese rechazo
como falta de calidad del revisor: detectó una omisión real de contexto.

Diagnóstico: `captureRuntimeObservations` sólo se invocaba para misiones en cola,
y el candidato sólo puede adjuntar recibos propios. Esa segunda restricción es
correcta y se conserva. Falta suministrar al revisor un inventario autenticado de
operaciones anteriores, independiente de las declaraciones del candidato.

Se solicita detener este ensayo de runtime ya fijado para no repetir el mismo
defecto estructural gastando inferencias. La parada no detiene el servicio de la
fábrica ni es una certificación: conserva los archivos, rechazos y resultado de
interrupción. La corrección requiere nuevas pruebas y un ensayo separado con
runtime nuevo; no se alteran el plan, los criterios ni las evidencias originales.
