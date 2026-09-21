# Ensayo acotado del transporte después de la reparación

Prerregistro 14 septiembre 2026, antes de ejecutar llamadas reales.

Objetivo: comprobar que el cliente reparado funciona con Codex App Server real
en dos generaciones secuenciales de una instancia, siempre con threads efímeros
nuevos. No activar reutilización en el worker, probar roles ni entregar misión.

Entrada fija: sumar [23,-5] en el caso `first`, y [90,-107] en `second`.
Salida estricta: `caseId` y `sum`, sin campos extra. Oráculo local anterior a las
llamadas: 18 y -17 respectivamente. No sustituir respuestas ni reparar el prompt.

Modelo solicitado por el propietario: `gpt-6-astra`, esfuerzo `ultra`, perfil
`scoped-v1`, ChatGPT oficial, ninguna API ni herramienta del modelo. Máximo dos
llamadas, sin reintentos del harness, 180 segundos por llamada. El proveedor
puede tener recuperación de transporte interna ya existente; el límite cuenta
generaciones lógicas, no intercambios HTTP. Cualquier fallo detiene el ensayo.

Condiciones previas: regresión global cerrada y todos sus inputs exactos; copia
de runtime verificada; archivos de este ensayo fijados antes de despachar.
Versión seleccionada después del cierre de `suite-6l7Jfp`:
`5aa542cf33e7e0d7a382335c55a9a1f183451d2cde28b995ae21198aa6727421`.
Guardar intención de llamada, petición completa y hash antes de cada generate.
Conservar respuestas originales, recibos, metadatos sin texto de razonamiento,
errores tipados y cierre observado. Al finalizar, confirmar runtime sin cambio.

Aceptación de transporte: ambas salidas pasan el oráculo y esquema, recibos
reales con hash/modelo/esfuerzo exactos, dos threads y dos turnos distintos,
sin fallos y proceso cerrado de forma observada. Releer resultados después
de terminar el proceso; comprobar propietario ausente y hashes guardados.

No es prueba de ahorro causal, calidad general, independencia cognitiva,
funcionamiento del buscador ni de los 154 roles. No se marcan R01–R16 completos.
