# Deduplicación estructural: medición offline, no optimización instalada

10 septiembre 2026. Se investigó porque la genealogía de la cartera integrada
consumió 1.084.948 tokens y su último juez recibió muchos registros repetidos.
La medición separa un posible ahorro de representación de la decisión de reducir
obligaciones, profundidad o revisores: estos últimos no se modifican.

Se reutiliza el codec existente y se prueban referencias a objetos/arrays completos
idénticos; sólo se eligen cuando el ahorro neto supera 512 bytes. En otro caso se
conserva la representación actual. Hay límites de expansión, nodos y trabajo,
escape de marcadores literales y comprobación exacta de bytes/hash/JSON lógico.
Textos distintos, contradicciones y citas no se fusionan. No se instala biblioteca
de compresión binaria porque el modelo necesita poder interpretar la entrada.

El medidor sólo lee los contextos actualmente proyectados de dos bases privadas
finalizadas, con journal verificado. **No reconstruye el input histórico exacto
de cada inferencia**: sus instrucciones de tarea y esquema quedan fuera.
[Datos medidos](../verification/context-structure-preflight.json).

| Contexto proyectado | Codec actual, bytes | Prototipo, bytes | Reducción de bytes |
|---|---:|---:|---:|
| Productor de implementación | 249.209 | 218.410 | 30.799 (12,36 %) |
| Revisión final de cartera | 304.062 | 277.545 | 26.517 (8,72 %) |
| Revisión anterior de integración | 257.008 | 241.686 | 15.322 (5,96 %) |
| Intento anterior de implementación | 198.622 | 190.556 | 8.066 (4,06 %) |

En las siete proyecciones del caso matemático pequeño no hay ahorro. Son 18
contextos en total; no una muestra representativa de todas las misiones.
Cinco pruebas dirigidas PASS: referencias falsas/literales, claves especiales,
manipulación/expansión, fallback sin pérdida y 40 casos generativos deterministas.

**Decisión: no instalar ni hacer seleccionable todavía.** Estos números no son
tokens, latencia, calidad de lectura del modelo ni ahorro causal observado. Antes
de adoptar el formato habría que comparar entradas congeladas con el mismo modelo,
exigir citas y comprensión equivalentes y medir uso incluyendo sus instrucciones.
El mayor ahorro observado aquí tampoco resuelve por sí solo la eficiencia global:
la selección de trabajo y el tamaño de las revisiones siguen siendo importantes.
