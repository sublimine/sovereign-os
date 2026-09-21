# Agrupación explícita de lecturas y prueba fijada

13 septiembre2026. Implementación de desarrollo; NO instalada. No modifica las
misiones geTKWd/yIc6GW cerradas ni convierte sus fallos en aceptación.

## Por qué esta agrupación, y cuándo no

El perfil real DEVELOPMENT-COORDINATION-PROFILE.md muestra propuestas separadas
para leer archivos y para ejecutar argv/cwd que el plan ya había fijado. Esa
separación sí es necesaria cuando las lecturas determinan el comando, deciden
si debe ejecutarse o satisfacen una aprobación previa. No siempre es necesaria
para recopilar observaciones de archivos ya producidos y ejecutar una prueba
exacta que no depende del contenido leído para elegir sus argumentos.

`producerBatch: 'read-test-v1'` es una elección explícita de misión nueva; el
CLI la expone como `--producer-batch read-test-v1`. No forma parte de adaptive-v1
ni se añade en recuperación. El planificador y el productor reciben reglas
compatibles; el contrato anterior conserva su prohibición cuando no hay opt-in.

Un lote que contiene ejecución debe tener exactamente UNA ejecución, al final,
precedida sólo por workspace.read/workspace.list. Sus argv/cwd deben coincidir
con una obligación de ejecución congelada y sin resultados esperados ambiguos.
La validación ordinaria de todos los miembros, sus herramientas autorizadas y
argumentos ocurre antes de cualquier efecto; después se comprueba la combinación.
No se permiten escrituras, búsquedas, adquisiciones, comandos inventados o
placeholders de resultados en ese lote. Un comando no adquiere permiso porque
esté en requiredEffects: la intersección de herramientas y la autorización
individual siguen siendo obligatorias.

El contrato instruye a NO agrupar si antes de ejecutar debe intervenir una
interpretación del contenido. El controlador comprueba estructura y coincidencia
exacta; no afirma demostrar esa independencia semántica con un hash. Esa decisión
queda en el plan y revisión del método, sin omitir las obligaciones del usuario.

## Presupuesto, prueba y recuperación

Cada operación consume el mismo presupuesto: cuatro por lote y doce en total
por defecto. No se repiten listados ni lecturas automáticamente para completar
un paquete. Tras reparar sólo un test se puede proponer lectura de ese archivo
y ejecución, sin volver a leer todos los demás. Esto NO prueba que siempre sea
suficiente ni autoriza a omitir una lectura requerida de una versión diferente.

El productor debe observar todos los recibos antes de afirmar el resultado.
SUCCEEDED describe que el broker obtuvo un resultado; exitCode distinto del
requerido continúa siendo un test fallido. El juez vuelve a leer los archivos y
ejecuta su propio snapshot después del candidato. Un lote no autoacepta nada.

La ejecución continúa siendo secuencial, NO una transacción ni paralelismo.
Cada miembro recibe autorización nueva; fallo/cancelación detienen el resto,
sin deshacer prefijos confirmados. El cursor durable y los recibos existentes
se conservan. La reentrada del mismo productor se rechaza; recuperación importa
recibos auténticos como historia de otro actor, nunca OWN_ACTION. DISPATCHED sin
resultado conserva incertidumbre y bloquea herencia/replay hasta reconciliar.

Esto es una extensión pequeña del lote existente, NO la integración del
compilador experimental PRODUCER-CHECKPOINT.md ni una promesa de reanudar el
mismo productor. El checkpoint completo añadiría obligaciones distintas de
reserva/cursor/reconciliación. No se declara cumplido por este cambio.

El scope nuevo se guarda en worker-config. No se invoca el resolvedor de overlays
aprendidos para esta misión: evaluaciones del protocolo anterior no se transfieren.
La opción queda visible en la política e informe; no cambia modelo, criterios,
permisos, intentos ni concurrencia.

## Evidencia hasta ahora, y pendiente

- RED dirigido2/2FAIL2062.407351ms: opción desconocida y contrato productor antiguo.
  Un fallo previo de la propia prueba comparaba orden JSON en vez de contenido;
  se corrigió a canonical, sin cambiar el motor para disimularlo.
- Primeras18/18PASS3566.648097ms: preflight negativo, presupuesto, cancelación,
  archivos y ejecuciones nativas con respuestas de modelo SIMULADAS.
- Trayectoria sintética comparada:5→4inferencias, mismas8operaciones reales;
  input agregado106246→81257B. Dos ejecuciones nativas por variante, productor
  y juez distintos. No son tokens facturados ni una estimación de ahorro real.
- CLI/planificación3/3PASS4113.693765ms: persistencia/idempotencia, rechazo de
  cambios a misión existente e instrucciones coherentes sin nueva autoridad.
- Comparación de sólo lectura21:09:38.718 con runtimec78: texto íntegro de
  planificación predeterminado idéntico (SHA256
  a5a39f47b29b829accf00e4adbb256e2c2a7902781c3ece139b69ea05760b2e4),
  descripción de WORKER_SCHEMA y regla base de lote también idénticas.
  No es equivalencia binaria del runtime ni predicción del comportamiento LLM.
- Ampliación con cinco cortes de proceso, revocación entre operaciones y
  productor que miente sobre exit7:26tests nuevos incluidos en batería de
  cinco archivos223/223PASS87383.683273ms,91952exit0.
  Los primeros cortes detectaron un error de la fixture (threadId repetido) y
  una aserción sobre un array ausente; no eran fallos de recuperación del runtime.
- Harness completo24/24PASS17846.502651ms,24367exit0: nueva ruta con modelo
  SIMULADO, tres archivos/lecturas/lote/ejecuciones nativas/oracle3193/reentrada.
  Un primer fallo de aserción suponía que los efectos estaban ordenados por
  fase; se corrigió a búsqueda por identidad, sin alterar el inventario.

GlobalCvYR2r cerrada21:12:19.341/48401exit0:1376tests1375PASS/0FAIL/unSKIP,
549609.49279ms.294inputs/capturas/owner reconciliados21:12:48.659. Runtime
c31b72231354b0943fce58cfbe81c476d601062a53775d3c40b9d47f754f17b1 congelado/
cualificado21:12:49.403,421archivos24101137B, NO instalado. Tras preflight
vSfo5K con cero inferencias, UYEoVL real iniciado21:14/sesión35576; resultado
pendiente. No hay todavía cualificación de suscripción ni eficiencia general.
R01–R16 continúa pendiente.
