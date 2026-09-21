# Integración pública de las opciones cualificadas — preflight

14 septiembre2026. Diseño condicionado, NO implementación ni permiso de despliegue.

Carencia: nativeReadTransport y boundedReadPresentation existen como opciones
del SDK de creación. El servicio instalado244d749e no las implementa y la CLI
no ofrece una selección conjunta. La skill actual conoce el recorrido bounded
ordinario, que puede entrar en contradicción con un formato de salida cerrado.
No se corrige ese historial alterando políticas existentes.

Si la comparación de coste prospectiva y su revisión semántica son satisfactorias,
la integración deberá ser una selección pública versionada, no cambiar adaptive-v1
o adaptive-v2. Una propuesta es adaptive-v3: conserva las capacidades de v2 y
selecciona bounded-read-response-v1, native-read-v1 y separate-evidence-v1 al crear.
No añadir modelo, esfuerzo, herramientas, paralelismo o presupuesto a ese preset:
los límites/autorizaciones de la misión siguen decidiendo. Los overrides explícitos
deben resolverse consistentemente; una combinación incompatible debe rechazarse
antes de crear misión, manifiesto, cola, actor o elevar el protocolo.

La entrada sigue evaluando el encargo íntegro. Ni tener un adjunto autoriza leerlo,
ni el preset permite usar este atajo para investigación, ejecución, varios
entregables o planificación previa obligatoria. Fuera de alcance, conserva el
mandato completo y pasa al planificador, sin contaminarlo con respuesta rechazada.
Las tareas sin lectura no gastan continuación; las que la usan reservan inicial,
continuación y juez. Las revisiones no se eliminan por ahorro.

Antes de publicar esa selección: tests de política/preset, CLI real con estado
aislado, negativos antes de toda mutación, compatibilidad de nuevas selecciones
y contratos previos, regresión completa del nuevo paquete y una comprobación
integrada de la interfaz. Migración sólo con copia del estado instalado exacto,
conservación de registros/materiales, backup recuperable y servicio sin trabajo
activo. No rollback con un runtime que rechace el protocolo ya utilizado.
Actualizar manual y skill sólo para lo efectivamente instalado y verificado.

Este archivo no cierra R04/R14/R16 ni cambia el servicio. Si no hay mejora de
coste, decidir por evidencia y mantener el resultado; no repetir el par ni cambiar
su umbral después. El objetivo sigue siendo todo el mandato, no estos dos casos.

## Comprobaciones de integración preparadas antes del cierre del par

Inspección de `factory/bin/sovereign.mjs`, `factory/lib/mission-presets.mjs`,
`FactoryEngine.create` y `tests/factory/queue-cli.test.mjs`, 17:48 UTC.
La CLI ya acepta entrada bounded, pero no transporta las dos selecciones nuevas.
El motor las valida después de resolver el preset y antes de la transacción de
creación. Por tanto no hace falta otra máquina de estados ni reinterpretar la
petición. Los presets se expanden una vez; definición, overrides y política
efectiva quedan registrados. Esta inspección no prueba una CLI aún no implementada.

La corrección de presentación y el ahorro de transporte son decisiones distintas:
un par inconcluso o desfavorable no permite vender ahorro, pero tampoco borra el
conflicto de formato reproducido en mWI9Fs y corregido en Vj7vZz. En ese caso no
promover la selección conjunta propuesta. Valorar separadamente la exposición
explícita de presentación; no hacer depender una corrección de formato de adoptar
una optimización no acreditada. No cambiar el veredicto ni repetir el ensayo.

La batería de interfaz debe comprobar hechos, no sólo presencia de flags:

- Nuevas opciones sólo en `submit`/`run`; rechazo también al consultar, reanudar,
  continuar o servir. `--help` explica requisitos y no crea estado ni proveedor.
- `submit` real conserva texto Unicode, bytes de adjunto, selección completa y
  protocolo; registra cola pero cero actores, inferencias, efectos o propietarios.
- Mismo ID, texto, entradas y opciones devuelve la misma misión; cambiar una
  selección produce conflicto y conserva literalmente los registros anteriores.
- Opciones desconocidas, cadena vacía, entrada incompatible y representación
  documental incompatible se rechazan sin misión, manifest, cola, actor o subida
  del protocolo. No interpretar un rechazo del parser como validación del motor.
- Sin preset, v1 y v2 conservan sus definiciones y hashes anteriores. Probarlas
  también después de crear una misión de protocolo9 en la misma base privada.
- Si se incorpora v3, sus definiciones anidadas no son mutables y sus overrides
  explícitos se registran. No añadir modelos, esfuerzo, herramientas, intentos,
  presupuesto global o paralelismo. Cambiar entry-mode a planned con opciones
  bounded aún presentes debe rechazar, no ignorarlas silenciosamente.
- Ejecutar el recorrido integrado con respuesta y lectura realmente solicitada,
  revisión propia posterior y reentrada sin nuevas llamadas. La admisión CLI sin
  servicio no demuestra ese recorrido; SIM y LIVE se etiquetan por separado.
- Una nueva release exige regresión y verificación del paquete exacto. La copia
  de la base instalada debe conservar las versiones existentes; un floor mayor
  no permite volver a un ejecutor que lo rechace. No abrir el original con un
  ejecutor de desarrollo para simular esa prueba.

Mientras bDrx5k está activo no se editan motor, tests ni inputs fijados. Esta lista
no es una prueba ejecutada, permiso de despliegue o sustituto de sus resultados.

## Decisión después del cierre, 18:02 UTC

bDrx5k cerrado y auditado; sus cuatro productos conocidos se aceptan en alcance,
pero la comparación de consumo queda INCONCLUSIVE por cobertura desconocida del
intento interrumpido del primer juez. No se introduce adaptive-v3 ni se publica
native-read-v1 como optimización. Los inputs, umbrales y resultados se conservan.

Siguiente cambio autorizado de desarrollo: exponer únicamente
`--bounded-read-presentation separate-evidence-v1` al crear con
`--entry-mode bounded-read-response-v1`, reutilizando la validación transaccional
existente. Corrige la contradicción comprobada entre formato cerrado y evidencia
en el cuerpo. No cambia presets, transporte, permisos, modelos, presupuesto,
revisión, políticas históricas ni instalado. El cuerpo sigue incluyendo las
fuentes/explicaciones que el usuario pida; separar no significa quitar pruebas.

La CLI de transporte nativo queda sin publicar. Se aplican los negativos y las
comprobaciones de admisión anteriores a esta única opción. La ejecución integrada
y la aceptación de una release son obligaciones distintas del parseo del flag.
