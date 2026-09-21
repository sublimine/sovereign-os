# Atribución de eventos a una inferencia nueva

14 septiembre 2026. Reparación de desarrollo; no servicio instalado ni pooling.

## Defecto reproducido antes de modificar el runtime

`CodexProvider.generate` abre un thread efímero por llamada. Antes de recibir
la respuesta RPC, todavía no había identificador con el que comparar eventos.
Tres contraejemplos simulados consiguieron aceptación indebida:

1. Un final tardío del thread anterior, durante `thread/start`, se incorporaba
   a la llamada nueva; con un validador de forma podía convertirse en su respuesta.
2. Un item de otro turno llegaba antes del acuse de `turn/start` y no se vinculaba
   al identificador que luego devolvía el servidor.
3. Dos items tempranos con turnos incompatibles se mezclaban sin rechazo.

[Registro previo](../verification/experiments/provider-event-boundary-red.json):
3 FAIL/1 PASS, 218.906638 ms. El control positivo conserva eventos válidos antes
del acuse, incluido cierre antes de recibir la respuesta RPC en el cliente.
No se ha demostrado explotación en las misiones históricas: el worker utiliza
una instancia por llamada y este diagnóstico es de transporte simulado.

## Cambio y motivos

- No admitir eventos de item/turno antes de solicitar el único turno del thread.
- Vincular inmediatamente identificadores no vacíos de eventos tempranos y
  contrastarlos con los demás eventos y con el acuse RPC posterior.
- No atribuir contadores previos al turno al nuevo recibo.
- Conservar aislamiento, política de herramientas, perfil, cancelación, límites
  de salida y protocolo, validación JSON y cierre observado del proceso.

La secuencia real puede entregar notificaciones antes de que el consumidor
resuelva la promesa RPC; por eso no basta con rechazar todos los eventos anteriores
al acuse. Se acepta el orden temprano coherente, no una identidad inconsistente.
Los errores invalidan toda la inferencia y cierran sólo su proceso; no se descarta
silenciosamente un final extranjero para continuar como si nada hubiera ocurrido.

## Pruebas y alcance

[Proveedor completo](../verification/experiments/provider-event-boundary-green.json):
49 tests, 48 PASS, cero FAIL, un smoke real omitido; 453.883073 ms.
Incluye once casos añadidos, consumo previo, identificadores vacíos/nulos/numéricos,
thread extranjero, búsqueda fuera de turno y orden temprano válido.
Regresión global `suite-6l7Jfp` cerrada 00:28:08.021 UTC: 1.459 tests,
1.458 PASS, cero FAIL, un SKIP; 317188.279438 ms. Auditoría posterior confirmó
301 inputs, cuatro streams y propietario ausente. Nueva copia verificada
`5aa542cf33e7e0d7a382335c55a9a1f183451d2cde28b995ae21198aa6727421`.

[Ensayo real fD2w4s](../verification/runs/provider-events-live-fD2w4s/post-close-audit.json)
cerrado 00:30:28.720, sesión 84808 exit 0: dos generaciones reales con Astra/ultra,
resultados exactos 18 y -17, threads y turnos distintos, 7.062 tokens y cierre
observado. Auditoría 00:32:08.846: propietario ausente, 301 inputs y dos archivos
de ensayo intactos, peticiones/recibos/respuestas y cronología concordantes.
El protocolo ordinario reparado funciona en este recorrido; no prueba todas
las permutaciones de eventos ni la ruta de búsqueda real. Cero caché comunicado
en ambas llamadas: no hay evidencia de ahorro derivado de reutilizar la conexión.

No se ha activado reutilización en workers, cambiado fichas, reducido revisiones
ni usado conversaciones del productor como contexto del juez. No se garantiza
ahorro de tokens ni se certifica perfección del protocolo. La compatibilidad con
eventos antiguos sin ID sigue limitada a su comportamiento existente; no permite
demostrar origen donde el servidor no lo proporciona.
