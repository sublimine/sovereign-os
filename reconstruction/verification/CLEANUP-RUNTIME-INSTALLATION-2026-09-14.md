# Instalación del cierre durable, 14 septiembre 2026

La versión **68fd4472be83e7bedaedfd099c4177c6c9883dbae11e8a9655255e93d5f2a43a**
sustituye a efbdb0e9 en el wrapper y la unidad del servicio del usuario.
No se editaron los paquetes anteriores. [Auditoría](runtime-deployment-68fd4472.json)
cerrada a **05:07:57.160 UTC**: servicio activo/enabled, PID 2475293, gestor y
cgroup canónicos, único proceso con la base abierta, NRestarts=0 en esa consulta.
Esto no demuestra actividad ininterrumpida antes o después de la consulta.

El preflight 05:05:18.883 encontró la cola libre, una misión histórica COMPLETED,
157 versiones de registros y journal 412. Se detuvo el proceso anterior 2441591
y se comprobó que no quedaban procesos con la base abierta. La parada añadió
sólo la liberación de queue-owner. Se guardó una copia SQLite coherente privada
con las 158 versiones detenidas; su hash y ubicación están en la auditoría.

Después se actualizó únicamente la referencia de versión en wrapper, directorio
de trabajo, condición y arranque de la unidad. Se conservó el resto de configuración,
se verificó la unidad, se recargó el gestor y se arrancó. Observado a 05:07:05.913.
Los comandos instalados help, queue y report cerraron correctamente. La primera
captura de report se truncó por el límite de salida de la herramienta; la segunda
captura íntegra de 102.274 caracteres es la usada por la auditoría. No hubo error
del comando ni inferencia nueva: sus once llamadas son históricas de septiembre 9.

Estado final: **159 versiones, journal 414**, 58 heads materiales sin cambios,
misma misión/cola/resultado. Se conservaron las 157 versiones originales; sólo se
añadieron queue-owner/exclusive 28 y 29. Cero misiones, inferencias o efectos de
misión durante la instalación. No se restauró ninguna copia sobre trabajo posterior.

La base instalada **permanece en protocolo 2** porque no se inició producción
protegida. La próxima producción nueva comprometerá su marcador junto a protocolo
3; no se eleva por declarar la versión instalada. La prueba aislada de productor
sí comprobó protocolo 3 y el rechazo de lectores/escritores antiguos.

Previos: [regresión SdIPvT](runs/suite-SdIPvT/post-close-audit.json), 1597 PASS,
cero FAIL y un SKIP; compatibilidad h5Xj0F, y [ensayo real 9FZelU](PRODUCER-CLEANUP-RESULTS.md),
tres llamadas/46.856 tokens con cierre durable, SIGKILL, recuperación exacta,
lecturas propias del juez y reentrada sin trabajo duplicado. El paquete coincide
con el snapshot cualificado: 426 archivos, 24.189.152 bytes.

No cambiar la cabecera para ejecutar una versión antigua ni reiniciar un servicio
ocupado para repetir estas verificaciones. El cursor de lotes y la eficiencia
proporcional siguen pendientes; esta instalación no cierra R01–R16.
