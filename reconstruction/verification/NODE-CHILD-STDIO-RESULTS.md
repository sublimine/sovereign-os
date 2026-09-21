# Diagnóstico de salida descendiente — wxAt7u

13 septiembre 2026. Prerregistro y fixture íntegra conservados en el registro
operativo privado; ejecución sintética separada, sin inferencia, red, cambios de
permisos o modificación del candidato observado.

Ejecutado02:53:10.354–02:53:11.588, sesión26984 exit0. Resultado nativo íntegro
SHA2562e5686e959dfcc85dff5d175de10e842a6c2ac26b8bff712abb0cd685ac0db8e.
Snapshot1097ea9779f84e0e2c2cf179e7ad64c8158808ab8f98393b3028bbe0c6ecb127.
Reconciliación02:54:40.828: PID1913666 ausente; unidad exacta
sovereign-exec-3a77d840-cebc-4e9b-ae41-d94f5dd660d4.service not-found/inactive;
scratch ausente. No señales ni limpieza amplia.

La salida RAW informa fd1 y fd2 como sockets, objetos de clase Writable y _type
null. Se recibe CALLBACK_MARKER, pero no STREAM_MARKER. El código incorporado
de Node24.19.0, internal/bootstrap/switches/is_main_thread, líneas94–103, construye
precisamente un Writable que consume escrituras invocando callback sin emitirlas
cuando guessHandleType no identifica el descriptor. El runner interno configura
el hijo con NODE_TEST_CONTEXT=child-v8 y reporter serializado sobre stdout.

**Mecanismo observado:** las escrituras normales del hijo se descartan antes
de llegar al capturador; writeSync sí entrega bytes. Coincide con esa rama del
runtime local y explica la ausencia del detalle de subtests. Falta identificar
experimentalmente el syscall concreto y cualificar una solución transparente.
No se presenta una hipótesis de syscall como traza de kernel observada.

Esto NO significa que el truncamiento del capturador borrara bytes recibidos:
outputTruncated=false sólo describe su límite, no transparencia de toda cadena
de stdio. Tampoco implica que todos los tests se saltaran: YZlT77 detectó fallos
y verificó callbacks terminados. Ambas evidencias y sus alcances se conservan.

La mitigación de tGHBOv (guardias de terminación en21 cuerpos) no arregla el
reporter general. No cambiar silenciosamente argv a --test-isolation=none, no
fabricar líneas TAP, no parchear Node o habilitar red para obtener un reporte.
El defecto sigue abierto para diagnósticos detallados de procesos descendientes;
debe constar en capacidad/operación y evaluarse aparte después del ensayo fijo.
