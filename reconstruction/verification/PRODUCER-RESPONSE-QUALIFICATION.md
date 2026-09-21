# Cualificación previa: respuesta de productor tras caída

14 septiembre 2026. Un ensayo controlado conocido; no holdout ni aceptación
integral de la fábrica. No altera el servicio instalado.

## Versión y límites

Se exige `suite-nmUPLE` completa y aprobada, el snapshot derivado de sus inputs
exactos y una simulación cerrada del mismo launcher, caso y documento antes de
la única ejecución real. Todos esos hashes se fijan en qualification.json antes
del primer despacho. Ningún cambio de criterio, modelo, instrucciones o respuesta
entre simulación y real. No repetir un brazo real fallido para sustituirlo por éxito.

Caso reutilizado deliberadamente: `experiments/failure-recovery-case.mjs`,
inventario exacto de 6450 mg frente a 6500 mg declarados, productor VERITAS_07,
juez OMEGA_22, fichas completas. Sólo workspace.read/list; sin ejecución,
Internet, escrituras del agente, API, compras o cambio del preset. Modelo
gpt-6-astra, ultra. Máximo seis reservas compartidas, cuatro pasos y cuatro
operaciones de productor, cero reparaciones de juicio; treinta minutos totales.

Preparación corregida antes de cualquier llamada real: el nodo declara primero
listado de `.` y después lectura de entrada.json, tanto en SIM como en real. No
cambia petición, criterios, fuentes, cifras ni ficha. El primer preflight aRsAdG
omitió el listado en su proveedor simulado; el juez ordinario repite directorios
observados, por lo que no podía satisfacer el criterio de listado propio. El
ensayo fallido se conserva. No es una medición de elección autónoma de estrategia.

## Secuencia y criterio irrevocable

1. Proceso hijo crea misión aislada y archivo de entrada externo, ejecuta el
   productor auténtico. Conserva peticiones, respuestas, reservas y cierres.
2. Cuando `infer` retorna un final, su transacción debe haber guardado propuesta
   y recibo exactos, y el cierre del proveedor debe estar confirmado. Antes de
   materializar el candidato se registra el punto de corte y se envía SIGKILL
   al propio hijo. Nunca se mata deliberadamente un proveedor aún abierto.
3. Proceso padre verifica la muerte del propietario, reabre SQLite y recupera
   el final bajo el mismo productor. No llama al modelo, no ejecuta herramientas,
   no crea otro productor ni devuelve reservas durante esta materialización.
4. Oracle numérico/estructural fijo; después revisión independiente real, con
   lectura y listado propios posteriores al candidato y citas resolubles.
5. Tercer proceso reabre el candidato aceptado y prueba su identidad, evidencia
   utilizable y presupuesto intacto, con inferencia y broker expresamente vetados.

PASS exige cumplir todos los puntos, respuesta sin reescritura, artefacto único,
productor único, juez distinto, recibos reales y cierres confirmados, input
intacto, inventario completo de llamadas y prueba de reentrada sin replay.
Se conserva cualquier error o rechazo como tal. La auditoría posterior revisará
contenido y citas; un campo PASS del harness no sustituye esa auditoría.

## Alcance

Prueba real de workers, SQLite y SIGKILL local. El plan y el nodo son fijos y
conocidos; no se ejecuta engine.run ni se declara misión COMPLETED. La integración
automática del coordinador tiene pruebas separadas con modelos simulados. No
demuestra caída de OS, cursor de herramientas, recuperación de entrada cerrada,
exactly-once remoto, ahorro general ni tres días de operación.
