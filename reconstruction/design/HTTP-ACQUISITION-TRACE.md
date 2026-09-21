# Recorrido de adquisiciones HTTP

Motivo observado: `IcWvS5Z8` adquirió RFC 2606 e IANA, pero el juez devolvió el
candidato porque los recibos sólo indicaban la URL final. La obligación de no
consultar otras páginas incluía posibles destinos intermedios y no podía
acreditarse retrospectivamente. No se fabrica esa evidencia ni se reescribe el
ensayo. El segundo productor conservó el bloqueo sin intentar simular trazas.

El broker existente controla cada petición HTTP y sigue redirecciones de forma
explícita, revalidando URL, DNS, conexión y autoridad. Se registra esa información
en el mismo flujo; no se necesita un proxy, SDK ni observación global de la VPS.

- Antes de invocar cada transporte se guarda un checkpoint `source-http-trace`
  con URL, momento y respuesta null. Null significa resultado no conocido, no
  ausencia de petición. Un fallo al guardar el checkpoint impide ese envío.
- Tras recibir y validar la respuesta se registra status, número de bytes y
  hash de los bytes recibidos. No se copian cuerpos de redirección, cookies,
  cabeceras de autenticación ni datos DNS ajenos al alcance de la prueba.
- El recibo satisfactorio añade `httpTrace`, con orden completo de peticiones,
  incluidas redirecciones seguidas. La última URL/status/hash coincide con el
  resultado adquirido. La firma original del recibo cubre la traza entera.
- Revocación, fallo, límite o cancelación no expone contenido ni una traza
  marcada completa como si la adquisición hubiera tenido éxito. El checkpoint
  local conserva el intento y el fallo. Una caída antes del commit mantiene el
  efecto DISPATCHED/UNCERTAIN y no autoriza repetición automática.
- Un HTTP 404 puede ser una respuesta completa del transporte, no una fuente
  factual admisible ni una prueba de disponibilidad. La admisión y el juicio
  semántico conservan sus controles independientes.

Las trazas nuevas no completan recibos antiguos. Un hash final igual después de
una nueva adquisición tampoco demuestra el recorrido de la consulta anterior.
La siguiente cualificación debe ser una misión nueva, con entradas y oráculo
congelados, no recuperación del histórico cuyo requisito sigue sin evidencia.
