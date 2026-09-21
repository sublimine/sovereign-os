# Activación condicionada de 4b31034b

**No activar: wmUkhp terminó NEEDS_DIRECTION a las 15:56 UTC.** La comparación
fue devuelta por no entregar al juez su evidencia de exposición bilateral.
Se conserva este preflight sin ejecutar; paquete y servicio anterior intactos.

## Antes de la decisión

Paquete preparado y verificado a las 15:29 UTC del 12 septiembre:
`/home/cardeex/.local/share/sovereign-factory/releases/4b31034bb20072b06615085f4611bce6f5caed9d3a07befc462684c2c815c7df`.
394 archivos / 23.806.559 bytes. Los 57 archivos runtime de código/datos
coinciden con suite-6gbyYo: 706 pruebas, 705 PASS, cero fallos/un SKIP;
todos sus 201 inputs y salidas estaban verificados antes del ensayo wmUkhp.
Suite-AXwQ9H repite 705 PASS/cero fallos/un SKIP. Su verificador de interfaz
cambió después del lanzamiento y se comprobó por separado en Chrome; no atribuir
la identidad actual de ese script a AXwQ9H. No cambió el código runtime.

La cualificación wmUkhp está en curso y la activación todavía NO está aprobada.
Requiere conclusión, criterios finales completos, lectura material separada,
referencias auténticas, residuales intactos y reentrada sin nuevas operaciones.
No bastan la regresión, el ACCEPT del protocolo o un resultado matemático correcto.
Ni una eventual aceptación acotada sustituye la matriz general R01–R16.

## Reconciliación de la instalación — 15:53 UTC

Servicio canónico enabled/active, PID 989536, NRestarts 0, managerScopeVerified.
La cola ordinaria sólo contiene 78afdee6 COMPLETED, sin trabajo pendiente.
Unidad y wrapper siguen apuntando exactamente a 10bbffa0; se leyeron completos.
No se cambió ninguna ruta ni se detuvo el proceso. Repetir la reconciliación
inmediatamente antes del cambio por si la cola recibe trabajo entre ambas lecturas.

Conservar la release 10bbffa0, la base ordinaria y sus versiones. Archivar copia
exacta de la unidad y wrapper antes de sustituir únicamente WorkingDirectory,
ExecCondition, ExecStart y la ruta ejecutada por el wrapper. No cambiar entorno,
límites, arranque persistente, permisos globales, credenciales o servicios ajenos.
Usar el bus canónico `/run/user/1001/bus`. Detener sólo este servicio ocioso,
recargar la unidad y arrancarlo; verificar PID, argv, cgroup, paquete, catálogo
154 y cola con `record-runtime-deployment.mjs`, generando un registro nuevo.
Si falla, restituir las rutas archivadas a 10bbffa0 y verificar el rollback.

La activación crea un nuevo proceso y segmento del observador. En esta
continuación ya se tomó una muestra; NO generar otra por el cambio de versión
ni reinterpretar los cuatro fallos históricos. La siguiente continuación podrá
observar el nuevo segmento. No presentar esta activación como prueba de días
de disponibilidad, cierre de sesión o reinicio del sistema operativo.
