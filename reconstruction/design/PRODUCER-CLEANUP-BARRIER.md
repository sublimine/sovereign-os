# Cierre durable antes de consumir propuestas del productor

14 septiembre 2026. Reparación posterior a efbdb0e9, instalada en 68fd4472
y auditada a 05:07:57.160. [Instalación y preservación](../verification/CLEANUP-RUNTIME-INSTALLATION-2026-09-14.md).
Regresión SdIPvT y ensayo real 9FZelU; SncT0v no cualifica este cambio posterior.
El cursor de lotes continúa pendiente y depende de esta frontera.

## Fallo reproducido

Tres pruebas negativas contra el núcleo anterior fallaron: `close()` devolvía
`processExitObserved:false` y aun así se creaba un candidato; la misma respuesta
negativa permitía ejecutar una propuesta de escritura; y un SIGKILL después de
guardar la respuesta pero antes de cerrar el proveedor permitía recuperar el
final. [Rojo conservado](../verification/experiments/producer-close-boundary-red.json).
Son modelos simulados con SQLite/archivos y caída de controlador reales, no
un incidente observado en una misión del propietario.

El fallo no estaba en conservar el recibo: se confundía su presencia y la ausencia
de un error guardado con la confirmación del cierre. Algunas pruebas anteriores
aceptaban justamente esa recuperación temprana; sus expectativas no constituían
evidencia del cierre. Se mantienen los cortes antes y después de respuesta, y
se añade el corte posterior al commit de cierre como control positivo.

## Contrato

1. Al iniciar producción nueva, `worker-production` fija `producer-cleanup-v1`
   en la misma transacción que exige protocolo de ejecución SQLite 3. El origen
   inmutable y el estado posterior deben conservar ese marcador.
2. Petición y reserva preceden a inferencia; respuesta pública y recibo conservan
   su commit conjunto existente. La respuesta sola todavía no autoriza consumo.
3. Tras `provider.close`, cada paso conserva `producer-cleanup`, vinculado a
   petición exacta, origen, configuración y respuesta presente o ausente.
   `adapterCloseConfirmed` registra si el adaptador retornó sin error;
   `processExitObserved` es true/false/null. Un valor omitido no se inventa como
   true. El proveedor real entrega una observación explícita.
4. CLOSED exige retorno sin error y que la observación no sea explícitamente
   falsa. Error, resultado false, registro ausente o fallo de persistencia
   bloquean con CLEANUP_UNCONFIRMED antes del candidato o la herramienta.
5. Recuperación del final, herramientas e herencia hacia otro productor vuelven
   a comprobar el cierre. El coordinador lo comprueba antes de crear un reemplazo
   cuando no tiene candidato reutilizable. Cambios de identidad/versiones/orden
   no se reparan: fallan con error de integridad.
6. El evento diagnóstico posterior no constituye la prueba de cierre. Si falla
   después de comprometer CLOSED, se interrumpe la invocación actual sin consumir
   su resultado, pero se conserva la posibilidad de recuperarlo exactamente.
   Una sonda separada reprodujo el bloqueo falso de ese caso después de la primera
   global; [rojo](../verification/experiments/producer-cleanup-event-boundary-red.json).
   La corrección no permite recuperar UNCONFIRMED aunque también falle el evento.

Un fallo de generación seguido de cierre confirmado conserva una petición sin
respuesta, no un resultado fabricado. Los presupuestos siguen consumidos según
su contrato previo; no se devuelven unidades ni se compra un sustituto mientras
el cierre sea desconocido. El registro de cierre no certifica ejecución remota
exactamente una vez, ausencia de cualquier proceso del host ni aceptación.

## Compatibilidad

Los lectores actuales admiten SQLite 1/2/3. Sólo el inicio de una producción
protegida exige 3; una lectura o escritura exclusivamente antigua conserva su
contrato y nunca rebaja la cabecera. Una transacción abortada revierte marcador,
cabecera y registros juntos. efbdb0e9 y versiones anteriores no entienden 3: deben
rechazar nuevas aperturas de esa base, no ignorar el cierre nuevo.

Un final/propuesta legado v1 sin registro durable de cierre no recibe prueba
retroactiva ni se reconstruye con una inferencia adicional. Queda pendiente de
reconciliación explícita. Los artefactos ya aceptados no se reescriben ni se
describen como revisados otra vez por esta comprobación. No se cambia el protocolo
de entrada cerrada, que ya tenía su propia barrera, ni se concede autoridad a
productores para resolver por sí mismos su cierre incierto.

Antes de instalar se exigieron nueva regresión, pruebas de caída/compatibilidad,
ensayo de suscripción y reconciliación del escritor. La base instalada conserva
protocolo 2 al no iniciarse nueva producción durante la actualización; sólo el
origen de una producción protegida exige 3 en su transacción.
