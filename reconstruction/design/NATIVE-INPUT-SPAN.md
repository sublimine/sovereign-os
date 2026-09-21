# Selección de tramo original sin transcripción del cuerpo

12 septiembre 2026, 18:13 UTC. Desarrollo posterior a OZcLj2; no instalado.

## Problema observado y decisión

La cualificación real OZcLj2 falló antes de producir: su segundo plan sustituyó
un acento combinante por otra secuencia al redactar copyText y requestQuote.
El validador detectó correctamente que el fragmento no existía. Exigir que el
modelo transcriba exactamente el contenido introduce una transformación que
el propio adaptador pretende evitar. Repetir hasta conseguir una copia válida
o normalizar el Unicode debilitaría el contrato y ocultaría el defecto.

Se añade literal-input-span-v1, sin retirar ni reinterpretar v1. El planificador
selecciona dos límites literales, before y after. Cada uno debe aparecer una
sola vez en la petición completa; deben ser disjuntos, ordenados y encerrar un
tramo no vacío. El motor calcula offsets UTF-16 semiabiertos y copia la fuente
original, sin anclas, trim, normalización, cálculo, decodificación ni similitud.
El origen conserva las anclas, cita contextual derivada, cuerpo, hash y bytes.

Esto admite contenidos repetidos dentro de un bloque: la identidad del tramo
procede de sus límites, no de exigir que cada palabra del cuerpo sea única.
Las menciones repetidas de un delimitador obligan a ampliar el ancla con contexto
real. No se infieren delimitadores desde el inglés/español, no se cuenta una
ocurrencia elegida arbitrariamente y no se introduce un extractor semántico.

Alternativas descartadas: offsets escritos por el modelo son frágiles ante
Unicode; pedir de nuevo el cuerpo reproduce el problema; reparar escapes o
normalizar contradice la petición; generar una respuesta libre usa otra ruta
y no prueba el adaptador. Anclas también pueden ser incorrectas o ambiguas:
se conserva el rechazo, no se declara resuelta la selección semántica general.

## Aceptación y límites

Los mismos controles fijos se insertan antes de revisar el plan. No se produce
hasta aceptar sus requisitos y selección. El juez del producto ve petición
completa, plan aceptado y prueba nativa recomputada; comprueba el objeto pedido,
no sólo igualdad de bytes. El plan aceptado no sustituye ese juicio. No productor
LLM, roles de producción ficticios, herramientas, efectos ni claims factuales.
Un RETURN material no autoriza otra copia idéntica o una nueva votación.

Se conserva el formato del origen firmado: el contrato ejecutable y selector
versionado son datos explícitos dentro del mismo vínculo. La recomputación usa
su versión exacta; las selecciones v1 anteriores conservan su estructura y hash.

24 pruebas dirigidas PASS, 14650,91 ms: ambos selectores, negativos de unicidad,
solapamiento, orden, vacío, Unicode y campos ajenos; tres formatos de contexto
y revisión por selector; ocho salidas abruptas de un hijo de prueba cubren
cuatro fronteras de registro/claim/candidato/aceptación en ambos selectores.
Los jueces son simulados; las salidas de proceso son reales. Falta regresión
completa y prueba real prospectiva; no hay ahorro causal medido ni cierre R04.

## Próximo diagnóstico acotado, fijado antes de ejecutarlo

Se probará sólo la viabilidad de seleccionar límites, no otra misión completa.
Una llamada oficial por suscripción, gpt-6-astra/ultra, sin herramientas, reintento,
producción o jueces. Entrada: petición inmutable de OZcLj2, caso conocido con
marcas mencionadas dos veces, distractor, CRLF y NFD. El cuerpo esperado y su
hash quedan exclusivamente en el oracle local, no como respuesta proporcionada
al modelo. La respuesta contiene sólo kind/before/after. Se conserva el recibo
antes de aplicar el cotejo semántico y el hash del tramo derivado.

Requiere paquete posterior a regresión completa PASS; archivo de solicitud,
fuente y harness fijados por hash antes de despachar. No modifica OZcLj2 ni su
estado, no usa el harness anterior, no relaja un juez ni autoriza otro intento
al fallar. Una selección correcta sólo elimina una duda de viabilidad: quedan
pendientes planificador completo, plan/revisión del producto, generalización
y eficiencia comparativa. Los resultados irán en un directorio nuevo propio.

Preflight 18:20:36.800: suite-D4aqew terminó 18:19:41.415 con 748 pruebas,
747 PASS/cero fallos/cancelaciones/todo/un SKIP, 216697,40 ms. Coinciden los
214 inputs, conjunto completo y ambas salidas. Paquete nuevo
9748682be5a393d459d78b178e85eeed9fbc56e5c958c85e53e072175a1ce9b8,
397 archivos/23841112 bytes; sus 60 inputs runtime coinciden y no hay código
runtime adicional sin probar. No instalado. Harness leído completo:
run-native-span-probe.mjs,
fb867affe5f3fbc24efb7ca78f5deb22b0bff08baed2e2ea8d0fd75c56061f1c.
Fuente qualification.json de OZcLj2,
53600d74469bfb1e03bcbc52615ddacb81a924453c7cbe98abcca473b0583414.
Se procede con ese único diagnóstico; contrato y presupuesto anteriores intactos.

## Resultado real: no aprobado — 18:24 UTC

cVQFI4, 18:21:04.038–18:21:22.868: una llamada real completada, pero selector
rechazado INPUT_COPY_SELECTION. Sus anclas contienen U+005C U+006E («\\n»)
donde la petición original tiene U+000A. El esquema de respuesta es correcto;
la selección no existe en la fuente. No se decodifica, repara ni vuelve a probar
esa respuesta para aprobarla. No producto, plan ni misión creada. El experimento
terminó exit 2. Su summary original conserva semanticAudit=PENDING; aquí se
documenta la lectura íntegra de solicitud, respuesta, recibo y condición fallida.

Recibo real: modelo gpt-6-astra, ultra, simulation=false,
thread 01a096da-00bc-7ea3-80dc-007970e01d73,
turn 01a096da-0113-7cb0-905d-53ad7abde467,
requestHash 2e48100c5244b3d8a6ad01a7152d202b197c210efd73742bfc276ea503f301b7.
7769 tokens de entrada + 513 de salida = 8282 totales; 462 de razonamiento
incluidos en la salida, cero caché observado. No comparación causal de ahorro.

Verificado 18:24:08.119: paquete, harness y fuente íntegros, solicitud coincide
con su hash y con el recibo. SHA qualification
89031ed59f7d9fc9f9e1320554c06c9a55b04c13ec795c1a259e24f988e26043;
request 07cb252a5c699058ec87218d63f1a2285e1314718a2bdb53d5fd498b9f428788;
response 3211258c5b96d959f57c240186d1b2a22d3b90a2aaabe39bff67209a71915239;
summary 2beb5cf8e0a3aaa3475374d0add57cd5c748879571692a6d35e6bf13ec4eea28.

Conclusión limitada: evitar transcribir el cuerpo no elimina la transcripción
de anclas. Se añade un negativo de regresión para esta diferencia y para el
caso legítimo en que la fuente sí contiene backslash+n; reparar globalmente
escapes confundiría ambos. Las pruebas deterministas anteriores demuestran
preservación del tramo elegido, no acierto semántico del modelo.

Siguiente cuestión de diseño: separar selección del objeto y representación
de transporte, manteniendo la fuente única y todos los límites. Comparar una
vista de fuente literal inequívoca o referencias a límites generados por el
controlador; no presumir que un codec reversible por código es igualmente
legible por el modelo. Antes de una nueva prueba real, fijar un contrato nuevo,
su alcance, presupuesto y oráculo; no repetir este ensayo sin cambios. Revisar
también la redacción de la capacidad del planificador para distinguir claramente
la preferencia por anclas del selector literal v1 heredado. No instalar 9748682b
por el PASS de pruebas simuladas ni llamar resuelta a la cualificación pendiente.

Prueba del contraejemplo incorporada: 25 dirigidas PASS, 20192,87 ms. Sólo se
añadió código de prueba después de D4aqew; su recuento global sigue siendo
748/747 PASS/un SKIP. El runtime congelado no cambió y no se lanzó otro ensayo.
