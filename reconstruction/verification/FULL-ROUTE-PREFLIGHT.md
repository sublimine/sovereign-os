# Calibración prospectiva de rutas completas — 13 septiembre 2026

## Decisión y alcance

El siguiente ensayo ejecuta `engine.run` hasta su resultado material, no sólo
la decisión de entrada ni la aceptación del plan. No cambia prompts, routing,
modelo, fichas, preset, copia instalada ni criterios para conseguir un aprobado.
Tres casos nuevos escritos por el operador; cuatro brazos en orden fijo.
Son calibración conocida, **no un holdout amplio, una estimación de precisión,
una prueba de superioridad ni aceptación de R01–R16**.

Antes de gastar inferencias se fijan entradas, resultados observables, límites y
evaluadores. Se reutilizan el motor, registro, trazas y aislamiento existentes.
Las guías oficiales distinguen criterios por etapa y resultado de todo el flujo;
la evaluación de trazas ayuda a localizar un fallo que un resultado final solo
no explica. Esto motiva contrastar producto y linaje por separado, no instalar
un servicio de evaluación ni usar una API de pago.
[Evaluación](https://developers.openai.com/api/docs/guides/evaluation-best-practices),
[evaluación de trazas](https://developers.openai.com/api/docs/guides/trace-grading).

## Casos fijados antes de inferir

| Orden | Caso / ruta | Qué tiene que ocurrir | Límite de llamadas |
|---|---|---|---|
| 1 | Pedidos / adaptativa | Última aparición por ID, cancelaciones y reasignaciones antes de agrupar; totales/cuentas/orden exactos; entrada cerrada y revisión independiente, sin herramientas | 8 |
| 2 | Mismos pedidos / planificación forzada | Misma petición y política, salvo entrada; plan, revisión, producto y aceptación completa; mismo oracle externo | 8 |
| 3 | DISTINCT / adaptativa | Derivar a plan; recuperar realmente dos documentos primarios; contrastar duplicados/NULL, citas y alcance; hechos apoyados en el linaje aceptado | 12 |
| 4 | Unión de intervalos / adaptativa | Derivar a plan; crear exactamente tres archivos, ejecutar tests, revisión independiente de la misma versión y repetición de tests; oracle funcional externo después de entrega | 18 |

Textos íntegros y gold: `full-route-cases.mjs`. El modelo recibe la petición,
no el gold, corpus de mutantes ni programa del oracle externo. El orden
adaptativa→planificada no está contrabalanceado: una diferencia observada de
coste no demuestra causalidad ni ahorro general. No se ejecutan más brazos
si uno no se cualifica: primero se diagnostica y se conserva su fallo.

La transformación aplica la última aparición física antes del filtro paid;
conserva clientes con total cero y cuenta pedidos, no filas históricas. Gold
contrastado con una implementación independiente en tests.

La comparación documental es exclusivamente SELECT DISTINCT ordinario, no
igualdad SQL general, DISTINCT ON ni UNION. Las dos páginas documentan la
eliminación de duplicados y el trato de NULL en ese contexto.
[SQLite](https://www.sqlite.org/lang_select.html),
[PostgreSQL](https://www.postgresql.org/docs/current/queries-select-lists.html).
El ensayo debe recuperarlas nuevamente con recibos reales, no usar esta lectura
del operador. Se admite el redirect de PostgreSQL a la versión numérica del
mismo documento; no otros hosts, rutas, parámetros o fragmentos. Una cita debe
estar literalmente en el contenido recuperado y expresar igualdad de NULL;
mencionar solamente NULL no pasa. Máximo 25 palabras por cita. Se conservan
fecha, bytes, hash y traza HTTP; dos editoriales no prueban independencia causal.

## Política de ejecución

Todos los brazos: suscripción oficial `CodexProvider`, gpt-6-astra/ultra,
preset adaptive-v1 intacto, compact-json-v1 y node-contract-v1, techo de dos
ramas puras. Dos intentos de plan y dos de nodo, fijados ahora para permitir una
corrección del runtime sin presupuesto abierto. Se conserva cada corrección
interna y su consumo. Límite total prospectivo: 46 llamadas, no objetivo de uso.
Se cuentan también recibos rechazados; consumo ausente permanece desconocido.
La creación del proveedor sólo sucede después de verificar congelación,
interrupción, presupuesto, actor, petición completa y prefijo íntegro.

El broker queda limitado a lo solicitado: ninguna herramienta para pedidos;
sólo las dos URLs iniciales para fuentes; para desarrollo sólo listado de raíz,
lectura/escritura de los tres nombres y `node --test merge-windows.test.mjs`
desde `.`. Este último límite también está escrito en la petición. No es un
permiso implícito para usar otros comandos, instalar, consultar credenciales,
publicar o modificar la VPS. Los redirects siguen los controles públicos de
DNS/HTTP del broker y su URL final se contrasta posteriormente.

BD, IDs, workspaces y evidencias nuevos y privados por brazo. No tocar ni repetir
GV6waD, u6DhJK, XrlCqq, 24pcUY u otros ensayos cerrados. No se envía una misión
ordinaria ni se instala el runtime de desarrollo. El ejecutor externo sólo
opera una copia desechable, sin montar estado, credenciales o workspace original.
Su unidad/scratch/inodo se registran antes de arrancar para reconciliación
exacta si hay interrupción; no permite limpieza amplia o reinicio de VPS.

## Evaluadores y aceptación

1. Producto final COMPLETED y artefacto utilizable actual, no sólo un plan.
2. Linaje completo, incluida planificación; todos los nodos aceptados y ligados
   a entrega. Criterios completos PASS, revisores distintos sin conversación
   productora y con hilos completados disjuntos. Dependencias aceptadas antes
   del primer intento material consumidor, no aceptación backdated.
3. Fuentes: recibos firmados contra operaciones existentes, adquisición actual,
   cuerpo/hash/URL/HTTP/fecha exactos; ambos documentos sostienen hechos
   explícitos del linaje antes de que se produzca el candidato factual.
4. Desarrollo: tres archivos exactos y obligaciones de archivo/ejecución
   congeladas en el plan. Pruebas de productor y revisor en la misma versión;
   oracle externo de 3.193 comprobaciones sobre el snapshot entregado, no una
   respuesta textual de “tests passed”. El controlador nunca importa el módulo.
5. Reentrada después de entrega: cero inferencias, operaciones o modificaciones
   materiales. Se permiten nuevos registros de ownership/validación y sólo
   permisos de lectura de ese workspace para su revisor aprobador, comprobados
   individualmente. El journal puede crecer legítimamente: no se afirma intacto.

El oracle usa conjuntos de puntos discretos para 28 intervalos pequeños, pares
y triples; añade extremos enteros seguros, adyacencia, huecos, -0, inmutabilidad,
aliasing y errores de tipos/rangos. Esto es cobertura funcional finita. No prueba
corrección para todo programa, complejidad asintótica, cobertura de README o
resistencia a código deliberadamente hostil que falsifique el proceso de tests.
Esos aspectos siguen exigiendo inspección semántica. La marca `semanticAudit`
permanece PENDING hasta leer productos, fichas asignadas, razones y citas reales.

Una aprobación del runtime que falle el oracle externo **no se reescribe**:
la misión guarda su decisión original y la cualificación falla por separado.
Los tests con proveedores simulados jamás pueden dar `actualSubscription=true`
ni aprobar un ensayo real. Los recibos son metadata del proveedor oficial,
no una atestación independiente externa de su identidad.

## Evidencia de construcción anterior a inferencias reales

- Primera batería de contenido: 19/20; `JSON.parse('1e999')` producía Infinity
  y el comparador canónico lanzaba una excepción no capturada. Corregido para
  fallar cerrado. No se cambia un resultado esperado para aprobarlo.
- 25 dirigidas posteriores PASS, incluidas cinco ejecuciones reales aisladas:
  implementación independiente correcta y cuatro mutantes rechazados.
- Primera integración de desarrollo, sesión 38968, 00:55:33: 12/13 PASS.
  Archivos, ambas ejecuciones y oracle externo correctos; el evaluador de
  reentrada era demasiado estricto al contar nuevos permisos de lectura como
  repetición. Se verificó `WorkerService.lease` y se añadió validación individual
  de esos permisos; no se excluyeron escrituras, ejecuciones ni cambios previos.
- Sesión 72967 cerrada exit 0: **41 dirigidas PASS**, seis segundos. Desarrollo
  completo con proveedor SIMULATED, tres ejecuciones nativas (productor, revisor,
  oracle); más cinco ejecuciones nativas de mutantes/referencia. Cero llamadas
  reales al modelo. Nueva regresión completa y congelación aún necesarias.
- Suite 1rLSfH cerrada 01:09:32.692, sesión 6684 exit 0: 859 tests, 858 PASS,
  cero fallos, un SKIP live. 245 inputs/64 runtime y streams íntegros verificados
  01:10:09.763; resumen SHA256
  `97e5d00e16915c6fb002ae4ad0ffee3966173ef8eb2d083531abeaf9ea21fa23`.
  Después se reprodujo otro defecto del evaluador, **antes de cualquier llamada
  real**: comparaba literalmente la serialización de `command` aunque el runtime
  admite espacios JSON. El test nuevo falló primero; se compara ahora el array
  de argumentos decodificado, sin admitir otros argumentos o JSON inválido.
  Se conserva 1rLSfH como prueba de sus propios inputs; no cubre esta corrección
  posterior y es necesaria otra regresión íntegra antes del ensayo real.
- Corrección verificada: sesión 99443 cerrada, 42 dirigidas PASS. Suite definitiva
  **8SfWEz**, 01:10:44.187–01:14:31.460: **860 tests / 859 PASS / cero fallos /
  un SKIP**, sesión85128 cerrada exit0. 245 inputs/64 runtime, inventario, streams
  y runtime íntegros verificados **01:14:45.627**. Resumen SHA256
  `85e326cba37bac6449127b1164b78fa8e85bea1baa4b8cd4d630b9ff0c6ece28`.
  Sólo cambian el test y comparador respecto de 1rLSfH; ningún archivo runtime.

## Ejecución iniciada

Ensayo `runs/full-route-live-spVGwI`, sesión propia **88882**. Primera misión
`9f6cb6f8-3402-4904-ad67-e693b0994f83`, pedidos/adaptativa. Se verificaron todos
los inputs antes de iniciar; el runner guarda sus propias pruebas prospectivas.
No modificar inputs ni repetir el proceso mientras corre. Resultado pendiente;
este inicio no acredita ningún brazo completado ni aceptación del mandato.

Runtime esperado: `14936f68c59dc739101764df8a4a24034280669ae8c0d8b43ef894f22bc05987`,
401 archivos/23872655 bytes, no instalado. GNIRNx anterior **no cubre los nuevos
inputs**. `run-live-full-route.mjs` exige suite completa posterior, inventario
idéntico, hashes de todos sus inputs y streams, y runtime congelado coincidente
antes de cualquier llamada. Esta nota no sustituye esas verificaciones.
