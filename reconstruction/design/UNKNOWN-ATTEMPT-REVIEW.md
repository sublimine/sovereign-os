# Revisar la incertidumbre sin convertirla en resultado

12 septiembre 2026. Cambio en desarrollo, no instalado.

Un UNKNOWN explícito y completado por el proveedor es un producto material:
contiene un argumento público, controles, desviaciones y afirmaciones sobre qué
faltaba. Esas afirmaciones también pueden ser falsas. Sellarlas sólo prueba su
integridad, no que la parada estuviera justificada. El ensayo real rB9KdY dejó
visible la carencia: tras UNKNOWN el flujo no solicitaba ningún juicio material.

## Distinción causal

`respuesta completada → sello → revisión del intento → [sin resultado: conservar diagnóstico y no abrir]`

Se usa el mismo candidato de intento y los mismos cinco criterios íntegros.
El juez conserva ficha, configuración, límites de reintento y exposición ciega
prerregistrados. No se añaden datos privados ni un agente ceremonial. Su tarea
incluye comprobar la justificación de parar, fidelidad de los controles y ausencia
de cálculos inventados; puede ACCEPT o RETURN. Aceptar el registro de una parada
justificada no acepta un resultado numérico, la verdad del original ni la misión.

La ruta entrega INCONCLUSIVE_ACCEPTED cuando ese registro pasa revisión. El
ledger puede aceptar el producto de evaluación; el nodo posterior queda sin
ejecución con REPLICA_INCONCLUSIVE. No se abre ni compara. Un RETURN conserva
MATERIAL_RETURNED. Reanudar cualquiera de esos desenlaces no emite otra réplica
ni otro voto. Cuota/transporte explícitos de la revisión mantienen su presupuesto
original; un commit perdido se recupera por su prueba histórica.

## Fronteras no relajadas

- Una respuesta perdida, truncada, inválida o una llamada incierta no se transforma
  en UNKNOWN. Sólo un recibo de inferencia completada y su salida validada/sellada
  permiten materializar este producto.
- El cuerpo completo debe coincidir exactamente con el sello, incluida cadena
  result vacía, controles y lista no vacía de desconocidos. No se normaliza a éxito.
- El estado mutable debe concordar con el tipo del resultado firmado. Cambiar
  INCONCLUSIVE a SEALED no permite abrir: la evidencia detecta la inconsistencia.
  open() además exige explícitamente RESULT en el sello.
- Se mantienen original, protocolo, tolerancia, criterios, actores y journal;
  no se permite reparar el intento después de verlo ni repetir hasta coincidir.

Esto produce una revisión utilizable para diagnóstico, **no** completa todavía
la autorización prospectiva de un método nuevo después de un intento cerrado.
Cambiar simplemente el ID/hash del plan no debe permitir saltarse esa frontera.
La recuperación automática antes del primer envío ya conserva las versiones de
protocolo devueltas; la recuperación posterior requiere contrato propio y pruebas.

## Verificación

La nueva contraprueba integrada falló antes del cambio (cero revisiones del
UNKNOWN frente a una exigida, 1,32 s) y pasó después (2,21 s). Diez casos dirigidos
PASS, 4,68 s: tres codecs sin exposición privada, UNKNOWN material aceptado o
devuelto, cuota, interrupción tras commit, inmutabilidad del sello, rechazo de
re-etiquetado de estado y misión que continúa no terminada tras reabrir SQLite.
Proveedor y juicios de esas pruebas simulados; controles de integridad y registro
reales. Regresión completa posterior en curso.

Se prepara una sola revisión real del UNKNOWN histórico en una copia SQLite
aislada. No vuelve a calcular ni modifica la misión fuente, no rehabilita el
protocolo A01 y no sustituye el fallo de cualificación original por una aprobación.
