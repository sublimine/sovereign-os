# Comparación de contexto conjunto: no cualificada

14 septiembre 2026. La comparación `joint-context-live-lUzFBz` / 98347 cerró
con exit 2 después de tres de las seis llamadas previstas. No se completó ni se
adoptó el formato. El paquete instalado sigue siendo efbdb0e9.

Preregistro: [JOINT-CONTEXT-QUALIFICATION.md](experiments/JOINT-CONTEXT-QUALIFICATION.md).
Tres pares de contextos históricos, no nuevas misiones ni evaluación integral.
El plan de prueba exigía preservar un vector de veredictos, incluyendo UNKNOWN
para selección en el caso incorrecto. Cuarenta y cuatro controles dirigidos
pasaron antes del preflight; FuVSSm pasó seis respuestas SIM, sin inferencias,
y auditoría 04:15:47.097: 314+13 pins, owner ausente y 56 usos de citas.

## Resultado observado

| Llamada | Entrada | Salida | Total | Resultado del oráculo registrado |
|---|---:|---:|---:|---|
| Productor actual | 12.374 | 463 | 12.837 | JSON exacto |
| Productor conjunto | 10.529 | 650 | 11.179 | El mismo JSON exacto |
| Juez negativo conjunto | 18.985 | 4.879 | 23.864 | RETURN correcto, vector de veredictos distinto |

Total de la ejecución: 47.880 tokens reales, cero cacheados. No se ejecutó el
juez negativo actual ni ninguno de los dos positivos. No comparar los agregados
de un brazo con una llamada y otro con dos como si fueran pares completos.
Sólo el par productor está completo: 1.845 tokens menos de entrada y 1.658 menos
totales; 18.163 ms frente a 22.685 ms de proveedor. No demuestra ahorro causal
ni general; el formato compacto tardó más en ese par.

La modificación conserva las instrucciones originales y añade 1.559 bytes de
interpretación. Reducción neta instrucciones+entrada+esquema: 5.594 bytes para
productor, **−193** para juez negativo y 9.669 hipotéticos para juez positivo
no ejecutado. La regresión de bytes negativa no se ocultó.

## Discrepancia y revisión sustantiva

Se leyeron las tres respuestas públicas completas. Ambos productores entregan
B, D, a, É, U+E000 y U+1F600, total 6, bajo el oráculo original. No solicitaron
herramientas ni produjeron claims inventados.

El juez negativo identifica correctamente A inactivo indebidamente incluido,
la suma correcta 6 frente a 11 y la necesidad de devolver el producto. Conserva
los cinco criterios. Sus 17 usos de citas resuelven literalmente contra los
objetos originales; respuesta SHA-256
`fabd1e54edd58b1ad9553ea90c99ef30ebe3e49d54b6b2921a1d1031cfa2db76`.
Marca selección PASS porque las proyecciones revision/amount coinciden con los
ganadores, pero declara expresamente desconocido el algoritmo interno. El
oráculo exigía UNKNOWN en ese campo por la imposibilidad de identificar dónde
se produjo el fallo interno. Es una discrepancia de **alcance del criterio**:
resultado observable frente a ejecución interna. La respuesta no afirma haber
observado ese algoritmo, no acepta el producto incorrecto y no se observó pérdida
de campos o citas. No atribuir esta diferencia causalmente al codec: falta el
control contemporáneo de ese par.

La condición UNKNOWN-only resultó más estrecha que la interpretación de contenido
que admite el criterio. Esa limitación del experimento no lo transforma en PASS:
se conserva el rechazo, no se relaja ni se repite el brazo. Una futura evaluación
necesitaría separar de antemano corrección del producto y evidencia del proceso,
sin imponer una etiqueta semánticamente ambigua como sustituto de la calidad.

## Integridad y decisión

[Auditoría de cierre](runs/joint-context-live-lUzFBz/post-close-audit.json),
04:19:58.979: owner 2449063 ausente, tres procesos proveedores cerrados, 314
entradas de regresión y 13 archivos de experimento/fuentes íntegros. Resumen
SHA-256 `dbcfae5922b9a6284d11d1bad36735709b7ffec8ed147052baa2d09001afc74d`.
Su contador quoteUses=0 recoge sólo grades completados; el juez rechazado no
generó grade. La revisión adicional de sus 17 usos se describe arriba y no
reescribe la auditoría. Cero nuevas misiones, efectos broker o modificaciones
del estado instalado; sólo inferencia de respuestas y archivos de cualificación.

Decisión: **no integrar el prototipo**, no repetir esta comparación ni anunciar
mejora global. Continuar con la otra causa de coste observada: propuestas de
herramientas y recuperación durable de lotes. No se cierran R04, R09 ni R16.
