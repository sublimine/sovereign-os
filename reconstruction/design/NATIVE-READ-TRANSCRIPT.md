# Transcripción nativa acotada: orden y bytes, no autoridad

14septiembre2026. Componente posterior al laboratorio1BuFGS, ahora integrado
en desarrollo opt-in; el instalado244d749e sigue sin modificación.

## Frontera

El adaptador actual da por terminado un pedido antes de admitir observaciones.
No se altera esa regla. Este componente puro modela una transcripción nueva
con exactamente una herramienta potencial. No abre archivos, llama modelos,
otorga permisos, firma recibos ni cambia el protocolo SQLite. El controlador
deberá persistir cada transición antes de la operación que habilita y verificar
por separado sus referencias de permiso, recibo y reserva. Referencias bien
formadas y hashes no demuestran autorización, persistencia ni verdad factual.

Se fija actor, requestHash, definición exacta de herramienta y presupuesto de
bytes. BIND vincula un thread/turn; CALL fija su identidad y argumentos; PREPARED
registra los bytes exactos de la respuesta y referencias externas; DISPATCH_INTENT
se guarda antes de escribir al proveedor; ACK exige su final de herramienta
coincidente; FINISH vincula salida pública y permite calcular la exposición.
ABORT conserva la fase alcanzada y la incertidumbre, sin borrar el consumo.

Cada frame encadena el hash anterior y su ordinal. La verificación reconstruye
el estado desde el origen, detectando alteraciones, truncamiento respecto del
hash esperado, orden inválido y campos desconocidos. Los hashes no son firmas
y un controlador malicioso podría fabricar una cadena: el consumidor necesita
un hash final/identidad guardados en su almacén confiable, no proporcionados por
el modelo. No hay recuperación automática basada sólo en el archivo del ledger.

## Invariantes y pruebas previas a conexión

- Una llamada como máximo; nunca refund por fallo, caída o repetición.
- Identidad thread/turn/call/namespace/herramienta inmutable. Una llamada de otro
  hilo, antes de BIND o duplicada falla. El resultado debe corresponder a CALL.
- Exactitud Unicode/UTF8 y límite de bytes, no número de caracteres; no recorte.
  No representar un surrogate aislado como sustitución UTF8 silenciosa.
- PREPARED no implica envío. Después de DISPATCH_INTENT y antes de ACK no se
  sabe si el proveedor recibió los bytes; nunca reenviar por defecto.
- ACK no es lectura semántica ni aceptación. FINISH sólo puede seguir a ACK,
  o a BIND cuando el modelo no necesitó herramientas.
- La vista de recuperación no llama nada ni propone un nuevo proveedor. Expone
  RECONCILE_DISPATCH cuando hubo intención, y sólo final completo permite usar
  el resultado retenido como candidato para validación posterior.
- Entradas/snapshots devueltos separados; la mutación del llamador no cambia
  una historia ya construida. Sin razonamiento privado en los frames.

Pruebas: todas las fases de caída, rehidratación JSON, cadenas alteradas/recortadas,
identidades cruzadas, doble llamada/envío/ACK/final, falso final previo al ACK,
bytes cambiados, límites exactos/multibyte/Unicode y ausencia de IO o proveedor.

## Integración y límites de estas pruebas

La integración de desarrollo se describe en [NATIVE-READ-INTEGRATION.md](NATIVE-READ-INTEGRATION.md).
PREPARED referencia native-read-continuation: consumo local inmutable incluso
si la misión no seleccionó techo global. El controlador comprueba además la
reserva global cuando existe. El componente puro sólo valida forma/orden/bytes.
Lo siguiente son obligaciones del controlador, no garantías del hash de cadena:

Fijar una política de transporte sólo al crear la misión; piso nuevo compatible
con historiales anteriores. Reusar el broker y sus permisos/recibos auténticos:
el modelo selecciona si leer y qué path, conservando planificación previa
exigida y negaciones. Reservar la continuación antes de devolver el resultado;
un turno nativo no convierte dos respuestas del modelo en una llamada gratis.
Retener petición, definición y respuesta exactas, junto a todos los hashes de
exposición; el marcador de inferencia completada no puede adelantarse a FINISH.

Juez separado, ficha completa, relectura propia posterior al candidato y las
mismas reglas de aceptación. No reusar thread del productor para el juez. No
importar un ledger de laboratorio como prueba. Antes de instalar: pruebas de
crash con procesos reales, compatibilidad, regresión completa y comparación
prospectiva de calidad/coste sobre peticiones de lectura reales.
