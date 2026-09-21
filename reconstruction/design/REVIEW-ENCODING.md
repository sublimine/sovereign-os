# Referencias exactas en las salidas de revisión

9 septiembre 2026. `evidence-refs-v1` es opt-in; `expanded-json` sigue siendo el
predeterminado. El transporte pone cada objeto de evidencia una vez en un catálogo
y cada comprobación lo referencia. No agrupa criterios, votos o razonamientos.
Antes de aceptar, el runtime expande las referencias y aplica el contrato original,
incluyendo lecturas propias, pruebas de ejecución, vigencia y atomicidad del juicio.

La validación rechaza IDs duplicados, colgantes, repetidos en el mismo criterio y
entradas no utilizadas. La expansión tiene límites explícitos de cantidad y bytes.
Un error puede usar la reparación acotada existente, con los mismos datos, sin
repetir herramientas ni cambiar el producto. Se conservan respuesta original,
hash original y hash expandido. La configuración queda fijada por misión y separa
los ámbitos de aprendizaje; no traslada promociones de otro formato sin evaluación.

## Evidencia

- Corte `suite-puAfTz`: 375 PASS, cero fallos, un smoke live omitido. Incluye codec,
  persistencia, revisión con archivos reales y proveedor simulado: referencia
  inválida corregida sin nuevas lecturas; prueba del productor insuficiente;
  cambios de archivo posteriores todavía impiden aceptación.
- Replay histórico con round-trip exacto: 15.742 → 11.828 y 10.084 → 9.289 bytes
  canónicos en dos revisiones. No son tokens ni salidas nuevas del modelo.
- Ensayo real `sovereign-review-encoding-live-p3fuowSY`, terminado a las 20:18:48 UTC:
  ambas variantes pasan diez controles. Tres archivos preparados por el harness,
  finalización real y revisión independiente de seis criterios. Dos inferencias
  por variante; total 27.221 → 27.063 tokens. Sólo la fase de revisión pasa de
  16.294 a 15.952 tokens, con salida 2.505 → 2.028 e input 13.789 → 13.924.
  No hubo correcciones ni operaciones adicionales. No es un ahorro general
  acreditado: la diferencia integral es pequeña y sólo existe este par.

No se confunde la finalización por el modelo con autoría de los archivos del
harness. La misión permanece NEW porque esta prueba llama al componente de
producción/revisión, no a la planificación y ejecución autónomas del motor.
El runtime `4bf4117d` permaneció fijado durante todo el ensayo y no se instaló.
