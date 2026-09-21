# Prerregistro: identificación de stdout en el hijo de node:test

13 septiembre 2026. Después de YZlT77, pregunta distinta: por qué faltan eventos
de subtests si los controles prueban ejecución y detección de fallos.
La versión local24.19.0 contiene en internal/bootstrap/switches/is_main_thread
una salida Writable que descarta bytes si guessHandleType no identifica el fd;
el código del runner crea procesos hijos y usa un reporter serializado en ellos.
Eso es una hipótesis de mecanismo, todavía no un resultado observado.

Una única fixture sintética propia, en snapshot separado y el mismo runtime
7d9ba690. Ejecutar exactamente node --test probe.test.mjs. La fixture informa
mediante fs.writeSync sobre fd1/2: clase, _type y naturaleza socket/FIFO; luego
escribe una marca distinta mediante process.stdout.write y otra mediante su
callback. No hace red, lee archivos ajenos ni cambia permisos. El controlador
no importa la fixture. Guardar fuente/expected observations antes de ejecutar.

Lectura del resultado: la marca RAW acredita bytes recibidos de la fixture;
CALLBACK acredita invocación de callback, no entrega de STREAM. Si RAW/CALLBACK
están pero STREAM no, y la clase es Writable sin _type, coincide con la rama
de descarte del código local. No afirma aún qué syscall causa esa clasificación.
Si hay otra salida, conservarla sin ajustar la fixture ni imponer la hipótesis.
No usarlo para cambiar el juicio o contexto del ensayo tGHBOv.

Estado: prospectivo.
