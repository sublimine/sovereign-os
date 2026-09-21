# Coste observado y alternativas de representación

14 septiembre 2026. Estado: diagnóstico offline, no optimización instalada.

El caso real PRFwPC consumió 67.787 tokens en cuatro llamadas para recuperar un
fallo controlado y revisar una conversión de unidades. La corrección del resultado
no hace proporcional ese coste. Se miden sus **cuatro peticiones históricas
retenidas**, no contextos reconstruidos después de terminar la misión.

## Dónde están los bytes

[Descomposición exacta](../verification/runs/failure-recovery-live-PRFwPC/offline-cost-decomposition.json)
con hashes de capturas, uso real comunicado y reconstrucción idéntica de JSON:

| Llamada | Instrucciones B | Entrada enviada B | Esquema B | Tokens de entrada reales |
|---|---:|---:|---:|---:|
| Productor 0 | 21.462 | 9.263 | 2.830 | 10.873 |
| Productor 1 | 21.462 | 15.686 | 2.830 | 13.156 |
| Productor 2 | 21.462 | 24.662 | 2.830 | 16.480 |
| Revisor 3 | 11.135 | 31.442 | 8.122 | 18.354 |

Las observaciones de runtime crecen de 4.769 a 17.843 bytes en el productor.
Hay fichas completas, reglas y evidencia repetida; no se autoriza suprimirlas
por ser voluminosas. Los cuatro recibos comunican cero tokens cacheados.
Esto no identifica la causa ni demuestra que cambiar de proceso produzca caché.

## Comparación offline sobre las mismas entradas

| Llamada | Actual B | Codec v2 umbral 128 B | Estructuras B | Prototipo conjunto B |
|---|---:|---:|---:|---:|
| 0 | 9.263 | 8.638 | 9.263 | 9.263 |
| 1 | 15.686 | 14.344 | 15.686 | 14.715 |
| 2 | 24.662 | 21.621 | 24.662 | 20.834 |
| 3 | 31.442 | 28.614 | 28.296 | 27.276 |

[Estructuras](../verification/runs/failure-recovery-live-PRFwPC/offline-structure-decomposition.json)
reutiliza el prototipo previo; [composición conjunta](../verification/runs/failure-recovery-live-PRFwPC/offline-joint-decomposition.json)
combina extracción de JSON incrustado en cadenas y deduplicación estructural,
sin descartar prematuramente una representación intermedia mayor. Restaura la
serialización original, las citas, estados contradictorios y marcadores literales.
Conserva límites lógicos y fallback si la representación final no mejora.
Ninguna opción domina en todas las entradas. Son bytes, no tokens ni latencia;
no se han contado instrucciones adicionales de interpretación del nuevo formato.

El prototipo conjunto está sólo en `verification/experiments/`. Su primera
prueba tuvo 6 PASS/7 FAIL: el fixture ya se comprimía mejor con el codec base,
pero el test exigía indebidamente usar el formato nuevo. Se corrigió el fixture
y se conservó otro test que exige el fallback: 14 PASS, 619.849623 ms. No fue
una corrección de producción ni una evaluación de comprensión por el modelo.

## Fichas completas

[Medición de las 154 fichas](../verification/experiments/card-structure-cost.json):
3.071.766 bytes compactos frente a 2.752.963 estructurales en el agregado no
ponderado; 72 fichas se reducen, todas se reconstruyen idénticas. VERITAS_07
pasa de 11.100 a 9.384 bytes; OMEGA_02, OMEGA_04 y OMEGA_22 no mejoran.
No representa la frecuencia real de roles ni incluye instrucciones del decoder.
No se han recortado campos, sustituido métodos ni comprimido las fichas activas.

## Conexión y decisiones

La documentación oficial distingue inicializar una conexión de abrir una nueva
conversación con `thread/start`. Reutilizar la conexión no exige reutilizar
historia mediante `thread/resume` o `thread/fork`.
[Codex App Server](https://learn.chatgpt.com/docs/app-server), consultado 14 septiembre.

El proveedor ya permite llamadas secuenciales, pero el worker crea y cierra un
proveedor por llamada. Se detectaron y reprodujeron tres defectos de atribución
de eventos previos al acuse de turno; la reparación está descrita en
[integridad del transporte](PROVIDER-EVENT-BOUNDARY.md). No se activa pooling.

Decisión: **no incorporar los nuevos codecs ni anunciar ahorro causal**.
Corregir primero la integridad independiente del transporte. Una propuesta de
reutilización necesitaría vida acotada, cierre confirmado, aislamiento por actor,
threads nuevos, presupuesto por llamada y mediciones incluyendo fallos/cancelación.
La eficiencia principal sigue dependiendo de elegir trabajo proporcionado y
evitar repetir razonamiento/contexto sin utilidad, no sólo de reducir bytes.

## Recuperación de método: diagnóstico posterior, 04:05 UTC

Se descomponen las cinco capturas reales 3–7 de `method-recovery-live-2spDVa`,
sin ejecutar inferencias nuevas ni modificar sus peticiones o recibos.
[Medición reproducible](../verification/experiments/context-cost-method-recovery.json),
SHA-256 `477dc6ca2642c794b2a4e3cdff36d224610011c8f4bf03698b28f0e29039b5dc`.
El harness contrasta requestHash, recibo, prefijo y perfil de instrucciones;
reconstruye cada capa JSON exactamente y no suma capas ni duplicados solapados.
Validación dirigida del diagnóstico y prototipo: 25 PASS, cero FAIL,
830.279541 ms, salida observada en terminal. No es una nueva regresión del núcleo.

| Actor | Entrada enviada B | V2 umbral 256 B | Conjunto B | Instrucciones B | Esquema B |
|---|---:|---:|---:|---:|---:|
| Juez del rechazo original | 38.743 | 38.601 | 37.377 | 11.121 | 8.767 |
| Planificador de recuperación | 96.863 | 91.691 | 85.768 | 25.439 | 3.816 |
| Juez del plan revisado | 65.463 | 60.170 | 55.018 | 12.169 | 9.234 |
| Productor corregido | 22.657 | 20.676 | 15.504 | 12.584 | 2.830 |
| Juez del producto corregido | 63.804 | 58.395 | 52.576 | 11.121 | 8.767 |

Los contextos pasan de 287.530 a 246.243 bytes con el prototipo conjunto:
41.287 bytes menos antes de incluir instrucciones nuevas de interpretación.
Las instrucciones existentes suman otros 72.434 bytes y los esquemas 33.414;
el perfil fijo añade 570 por llamada, sin contabilizar el framing del proveedor.
Estos números no son ahorro de tokens ni prueba de comprensión del modelo.
Uso real histórico: 118.372 entrada, 16.883 salida, total 135.255; los 25.344
cacheados están incluidos en la entrada, no se descuentan otra vez.

Duplicaciones exactas localizadas en el contexto decodificado:

- Planificación: `previousPlan` de 9.702 bytes aparece también dentro de
  `methodRecovery`; su nodo de 4.515 bytes figura además en el fallo retenido.
- Producción: el nodo de 5.853 bytes aparece tanto en `planViews` como en `task`.
- Revisión final: feedback de 6.935 bytes aparece en el historial observado y en
  la tarea. Son ubicaciones distintas con significado de procedencia propio.
- Historial de recuperación: 27.178 bytes son fallos y 9.702 el plan anterior.
  No es ruido descartable: contiene las razones del rechazo y las obligaciones
  que no pueden rebajarse al proponer otro método.

Decisión: conservar todos esos campos. El codec conjunto merece una prueba
separada de comprensión y coste total, con sus instrucciones incluidas, antes
de hacerlo seleccionable. No cambiar defaults, métodos, actores ni criterios
para aparentar eficiencia. El núcleo instalado sigue siendo `efbdb0e9`.

Resultado posterior: [comparación no cualificada](../verification/JOINT-CONTEXT-RESULTS.md),
tres llamadas reales/47.880 tokens. El par productor conserva la salida y reduce
tokens, pero la discrepancia de alcance del oráculo de selección detiene el
segundo par. No hay comparación completa ni integración; se conserva el fallo.
