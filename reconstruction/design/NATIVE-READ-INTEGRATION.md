# Integración nativa: contrato de desarrollo, todavía no instalado

14septiembre2026, actualización16:11UTC. El laboratorio1BuFGS demostró un callback
en memoria, no ahorro. La integración de WorkerService, broker, presupuestos,
registro y recuperación ya existe en desarrollo opt-in.244d749e sigue operativo.
Paquete56490143 congelado para cualificación; regresión y compatibilidad cerradas,
par prospectivo LIVEvZIKxX inconcluso por timeout del juez, sin promoción ni ahorro.

## Adaptador implementado

Constructor nativeRead:true y perfil native-read-v1, mutuamente excluyentes de
public-search-v1. La huella del perfil liga baseInstructions y la definición
completa de la única herramienta. Los perfiles anteriores conservan sus hashes.
Se conserva threadnuevo/efímero, environments[], readOnly/networkfalse,
approvalnever, MCP/apps/plugins/hooks/shell/code-mode-host cerrados y mismos
modelo/esfuerzo. Sólo namespace sovereign_workspace/read_input directo.

El proveedor exige un nativeSession confiable: checkpoint,bind,prepare,dispatch,
ack,finish,retainOutcome. Checkpoints de commit síncronos; prepare puede esperar al broker.
Valida extensión exacta de historia, argumentos, respuesta, turno y payload
final; comprueba inicio→request→respuesta→ack. Un callback duplicado, ajeno,
otra herramienta o final sin ACK falla. Cancelación/timeout aborta el callback;
si su controlador no termina, close no declara limpieza completa aunque el
proceso del proveedor haya salido. No se graba razonamiento privado.

31pruebas propias de transporte SIM después de añadir retención pública previa
al retorno. Las pruebas anteriores41856/133 pertenecen al adaptador sin esa
integración, no se presentan como pruebas de la revisión nueva.

## Controlador implementado y orden causal

1. Política seleccionada al crear la misión, sólo para productor de entrada
   bounded, sin aplicarla a juez, catálogo, descubrimiento o misiones antiguas.
   Perfil nativo sólo para ese actor; el juez conserva su perfil y ficha.
2. Guardar petición original completa y pendingRequestHash, y crear el origen
   de transcripción bajo el owner actual. Un checkpoint preexistente no permite
   reabrir el turno automáticamente.
3. Al pedir lectura, validar el callback y guardarlo; comprobar el permiso real
   y el límite de una lectura. Reservar continuidad antes del efecto
   o de responder; no convertir dos respuestas nativas en una llamada gratis.
4. Ejecutar únicamente broker.execute(workspace.read) con lease del productor,
   operationId durable y los límites originales de pasos/herramientas. Verificar recibo
   firmado contra efecto real, identidad, argumentos, tamaño y bytes íntegros.
5. Persistir PREPARED con observación completa y reservas reales; después
   DISPATCH_INTENT antes de responder. ACK vincula exactamente lo devuelto.
   Un hash de referencia no sustituye ninguna de estas verificaciones.
6. No añadir observaciones al run mientras la inferencia está pendiente.
   Mantenerlas en la transcripción; al recibir FINISH y el recibo real, validar
   la cadena y añadir observaciones + adjuntar inferencia en una transacción.
   Así se conserva el rechazo general INFERENCE_PENDING del registro antiguo.
7. retainOutcome compromete el final público, recibo y exposición antes de
   devolver la respuesta al WorkerService. Una caída después de ese commit
   recupera la propuesta original sólo si existe constancia de cierre; una caída
   con FINISH pero sin recibo/propuesta retenidos exige reconciliación.
   Retener respuesta/final y cierre para recuperación sin nueva inferencia;
   todavía no es aceptación. Crear candidato por la vía ordinaria y mantener
   revisión independiente con relectura propia posterior del mismo archivo.

## Selección, contabilidad y compatibilidad

nativeReadTransport:'native-read-v1' es una opción de creación del SDK, sólo
con entryMode:'bounded-read-response-v1'. No cambia presets ni la CLI instalada.
El perfil nativo no se admite como instructionProfile global: el juez y la
planificación posterior conservan sus perfiles y conversaciones independientes.
La misión seleccionada fija piso8 en su transacción; lectores actuales aceptan
historiales2–7 sin reescribirlos. Si la creación falla, el piso vuelve al anterior.
La comprobación cruzada5faW7G con el paquete244d749e rechazó abrir/escribir8,
incluida conexión abierta antes del cambio. Fue una base aislada, nunca la instalada.

native-read-continuation es siempre un registro inmutable local: una unidad
adicional de propuesta/continuación y una operación, ligado al CALL y petición
prospectiva. PREPARED referencia ese registro, no una reserva global ficticia.
La llamada inicial ya consume un paso; leer y responder requiere al menos dos.
No se fabrica un JSON action=tool ni un cierre previo que no ocurrieron.
Si existe techo mission-calls-v1, se añade kind:native-continuation a sus reservas
antes del efecto. Si no existe, la reserva local sigue vigente. Fallos y caídas
no la devuelven. El informe distingue dos invocaciones completas productor/juez
de tres unidades presupuestadas cuando hubo callback; no inventa tokens facturados.

Una caída antes de envío permite reconciliar el estado, no asumir un efecto;
después de intención de envío no reenviar automáticamente. ACK sin final no
autoriza a comprar una respuesta sustituta ni descartar la lectura consumida.
La cancelación debe detener callback y proveedor; no reiniciar misión hasta
reconciliar ambos. No heredar conversación a juez ni ocultar una exposición
previa al recuperar un productor.

29pruebas de integración cubren permisos, reservas, cancelación, manipulación de
historia/efecto/propuesta, retención y relectura propia. Siete procesos fixture
con broker/SQLite reales reciben SIGKILL antes/después de commits; el proveedor
está SIMULADO. No prueban una caída del proveedor real o del SO. Nunca se mata
el servicio instalado. [Resultados](../verification/NATIVE-READ-INTEGRATION-RESULTS.md).

Globalfg0l0i cerrado/auditado:1957tests/1956PASS/ceroFAIL/1SKIP,347pins.
Compatibilidad anterior sobre base aislada cerrada/auditada. Un callback y
propuesta nativos reales quedaron comprometidos; juezTIMEOUT a3min del ensayo,
no aceptado. Cierre de los cinco procesos observado. Copia de recuperación
preserva propuesta y rechaza nueva inferencia con presupuesto agotado; detecta
una lectura inútil anterior a esa comprobación. Cambio posterior de admisión
en desarrollo separado, sin heredar la regresión56490143.
Pendiente: calidad final nativa y comparación válida
prospectiva de calidad/coste con la misma petición/modelo/esfuerzo y reglas de
aceptación. No prometer ahorro, cobertura universal ni instalación antes.
