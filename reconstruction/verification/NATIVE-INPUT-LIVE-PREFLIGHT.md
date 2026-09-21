# Selección literal nativa: cualificación prospectiva

## Preparación — 12 septiembre 2026, 17:48 UTC

**Actualización 17:52: no lanzar b00b565a.** Una salida real del proceso de
prueba después del claim y antes del candidato detectó duplicación del origen
al recuperar (dos, no uno). Las otras dos fronteras conservaron candidato y
aceptación. Tras corregir una omisión del simulador de prueba (observaciones
opcionales del juez del plan), la primera batería válida dio 2 PASS/1 FAIL.
Se conserva ese resultado, no se atribuye a una ejecución de suscripción.

Corrección posterior: registrar origen y adquirir el nodo en una transacción;
al recuperar un claim previo, revalidar origen/entrada/plan exactos y reutilizar
su identidad, sin fallback para origen ausente o alterado. Quince pruebas
dirigidas PASS, incluidas cuatro salidas abruptas reales de un hijo de prueba:
antes del commit del claim, después del claim, después de materializar y después
del ACCEPT antes del ledger. No proveedor real en estas pruebas. Se amplía el
negativo de recuperación y se requiere regresión y un paquete nuevo antes del
ensayo. El contrato de selección, harness, criterios y modelo permanecen iguales.

**No lanzado.** Se cerrará y reconciliará primero ODeAyj, que sigue con su
informe final en revisión. No se solapan pruebas reales ni se modifica su
runtime. No se reserva todavía un directorio de experimento.

El nuevo adaptador evita una inferencia productora cuando el producto pedido
es un objeto literal ya presente en la entrada. La igualdad de bytes no basta:
hay que probar que un planificador real selecciona el objeto correcto y sus
jueces inspeccionan su contexto y origen sin certificar la verdad del texto.
Esto ejercita esa frontera, no la totalidad del mandato ni eficiencia general.

Runtime b00b565af039ba73bb69db4b824d0c91303fcd87e2796b229c8837f1d9b22884,
397 archivos/23836139 bytes, no instalado. Suite bKBKdE terminó 17:41:44.121:
735 pruebas/734 PASS/cero fallos/cancelaciones/todo/un SKIP, 206254,96 ms.
Verificados 17:44:26.881 los 212 inputs, conjunto íntegro, hashes de salida y
ausencia de interrupción; los 60 inputs runtime coinciden con el paquete.

Harness íntegro leído antes de cualquier lanzamiento:
`run-live-input-copy.mjs`, SHA-256
64924f90e442ca354b8aaa6ff6e5f88176965a12775d2d1ac49b9d136f25bcff.
Oracle `input-copy-trial-acceptance.mjs`, SHA-256
a4359f08ca6a93f1b8557140af148b8b86f2d2d7a69378295a9619929d25209b.
Su negativo simulado prueba 22 mutaciones, incluido un estado de éxito sin
producto, selección alterada, normalización Unicode y obligaciones omitidas.

## Contrato inmutable

### Nuevo paquete cualificado para el lanzamiento — 17:58 UTC

ODeAyj cerró COMPLETED a las 17:52:47.981 y fue auditado/revalidado sin cambios.
La regresión cRbG5M posterior a la corrección de recuperación terminó a las
17:55:53.868: 739 pruebas/738 PASS/cero fallos/cancelaciones/todo/un SKIP,
205661,59 ms. A las 17:57:14.464 coincidían los 213 inputs, conjunto íntegro y
ambas salidas; sin interrupción. Paquete nuevo
ba4e6ca49238d5c13489a37db0a01a7786d8a9eba35cb4c5fe57bb3c5df16929,
397 archivos/23837533 bytes; verificado 17:58:03.198, sus 60 inputs runtime
coinciden y no contiene código runtime adicional sin probar. No instalado.
El único input de la batería cambiado después es el selector del inspector,
que muestra ODeAyj; no forma parte del paquete ni del harness de inferencia.
Harness y oracle mantienen los hashes prospectivos indicados arriba.
Este corte sustituye el paquete b00b565a, no los datos ni criterios del ensayo.

Una sola petición natural con un objeto delimitado, `Registro α: 0042`, CRLF,
emoji, e con acento combinante y espacios significativos. Un dato distractor
0043 está expresamente excluido. Entrega única, literal, sin marcas, resumen,
normalización, interpretación ni certificación factual. Sin herramientas,
efectos, archivos externos o búsquedas. Juez independiente obligatorio.

Entrada planned, preset adaptive-v1, gpt-6-astra/ultra, suscripción oficial;
un nodo paralelo máximo, dos intentos de plan/nodo como techo. Ocho despachos
de proveedor como máximo absoluto, no objetivo. Sólo planificador y revisores:
un intento de producción ordinaria se rechaza antes de llamar al proveedor,
pues no equivaldría a probar el adaptador nativo. No API, compras, cola
ordinaria, instalación, segunda misión automática ni cambio de criterios.

Se conserva cada solicitud exacta antes del despacho. Se exigen cuerpo completo
exacto, un único producto nativo aceptado y su origen firmado, todas las
obligaciones del plan, cero claims/efectos, reentrada sin replay y paquete/harness
sin cambios. El oracle externo no sustituye la lectura semántica de todo el
plan, solicitud, selección, prueba y cada revisión. Una coincidencia parcial,
RETURN, salida sin producto o excepción no se convierte en éxito.

Tras el ensayo, el recuento y uso real se comunicarán como una observación.
No hay brazo de comparación que permita afirmar ahorro causal de tiempo/tokens,
ni una muestra permite generalizar precisión semántica a otros pedidos.

## Despacho — 12 septiembre, 18:00 UTC

Directorio nuevo vacío reservado `runs/native-input-live-OZcLj2`. Se autoriza
el único ensayo descrito con ba4e6ca4; ODeAyj ya cerrado y auditado. Se registra
el inicio real en qualification.json, sin anticipar respuesta ni aceptación.
La actualización y QA posterior del inspector sólo afecta la presentación,
no los 60 inputs runtime, el harness ni su oracle.

Inicio real 18:00:14.935, misión `mission:a6a8a9e3-00dd-4a0a-8a91-d4972aedb88c`.
Primer planificador `run:fb41f507-b51a-4909-bee4-96ef6fd0f778`. Cuerpo esperado
47 bytes UTF-8, hash c0469889c88aaa3a23def8cbb768144bad5634db2e6ca6270bda1eece5f0e44b.
No hay resultado ni juicio en este corte. Paquete, harness y helper quedan
inmutables durante la prueba; no habrá repetición automática.

## Primer rechazo estructural conservado — 18:03 UTC

El primer planificador devolvió un nodo que explica y pide copia nativa pero
declara execution.kind=closed-blind-comparison-v1/materialNodeId vacío. Su
routingRationale afirma que el schema no permite expresar literal-input-copy-v1
y pide al controlador sustituirlo antes de revisar. El controlador **no** hizo
esa sustitución: rechazó BLIND_PLAN, sin producto ni revisión ficticia.
Registro structured-rejection:ce2d9595-b1e9-4902-9f37-22e0bcf97b65,
hash fc9022f339ffc32c9778be8d849cbf245e7f5e5715d660d54837d7153aabafa5,
6691 bytes de propuesta íntegra conservada y leída.

La captura request-0 sí contiene la variante literal-input-copy-v1 con
requestQuote y copyText en nodes.items.properties.execution.anyOf; coincide con
PLAN_SCHEMA exportado. Eso contradice la explicación del modelo al nivel del
contrato enviado, pero no revela por sí solo cómo lo representó internamente el
proveedor. No se afirma un defecto del servidor ni ausencia real de capacidad.
Segundo y último intento de planificación autorizado por la política original:
run:e52b8ff2-d5f6-4618-8922-d930d8162f25. No se altera el runtime/harness/criterios,
ni se reemplaza la salida rechazada por el código que el modelo pidió inventar.

## Cierre y auditoría del fallo — 18:13 UTC

OZcLj2 cerró NEEDS_DIRECTION a las 18:04:45.046, exit 2. Dos despachos reales,
dos propuestas rechazadas estructuralmente, ningún plan aprobado, producto,
origen nativo, juicio ni efecto. No se reanuda ni se vuelve a lanzar. El raw
summary mantiene semanticAudit=PENDING; este análisis separado documenta la
lectura de ambas propuestas completas y las diferencias verificadas.

El segundo plan usa correctamente literal-input-copy-v1, pero requestQuote y
copyText sustituyen U+0301 por U+0003 seguido de «01» en posición UTF-16 25
del objeto. No es una normalización NFC ni una diferencia meramente visual.
INPUT_COPY_SELECTION impidió copiar una selección inexistente. Registro
structured-rejection:af4628e2-7c4c-4125-a5ba-e2d3e11bbd83,
hash c793af4b77b94939d80cb8a92bcb62f141e0cf1d9a0c6edcf63b7e03fcfd6a80.
La descripción correcta del acento en sus criterios no subsana el contrato
ejecutable incorrecto. El uso real de tokens no se conservó en un recibo
completado al rechazarse la validación: es desconocido, no cero.

Contraste posterior del transporte: ambos sobres lossless-context.v2 resuelven
missionIntent y task.originalRequest exactamente a la petición original, mismo
hash 6bdc23cd completo registrado arriba. El propio texto enviado contiene
Cafe seguido de U+0301, y no la secuencia U+0003/«01» de la salida rechazada.
La pérdida observada está en la propuesta de selección, no en una alteración
detectada por el codec. Esto no prueba ausencia de dificultades de lectura
del formato por el modelo ni una tasa de error general.

El cliente envía schema directamente en turn/start.outputSchema. La documentación
oficial consultada el 12 septiembre indica que [outputSchema se aplica al turno
actual](https://learn.chatgpt.com/docs/app-server#turns). Esto no explica el
primer error del modelo ni permite atribuirlo al servidor. La segunda propuesta
sí expresa la variante nativa; no se añade un workaround de transporte sin
evidencia de que sea necesario.

Verificación 18:13:16.069: ba4e6ca4 íntegro, harness/helper originales intactos,
ambas capturas coinciden con inferenceRequestHash. Snapshot SQLite de lectura
sin cambio antes/después: records
18c1255f85e33dad06ed703c24b03196872729b5b567abe7451f1c53f2a09c35,
heads 03c06620397cd4615cc48305725c9f6cdeea0ca8f90ccf4fded4fbdc22a9625d.
Journal final 86 eventos,
3d8f83852fa6b50d9b29f0d2b737e14c29ea40546202a9debe53843f8061d001.
SHA summary 721f48ac41bcc2e9d1986d2d0855c7776d26de636300d4c00f2b81bac37b38f3;
report f991496cfd862844ddf41a88a887f151026778323b3a956ca1f48f534724ac9a;
qualification 53600d74469bfb1e03bcbc52615ddacb81a924453c7cbe98abcca473b0583414.

Corrección prospectiva distinta, no reparación retroactiva: selección del
tramo entre dos anclas únicas para no exigir al planificador regenerar el
Unicode del cuerpo. Véase [contrato y límites](../design/NATIVE-INPUT-SPAN.md).
La cualificación semántica real sigue abierta.
