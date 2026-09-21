# Entrada cerrada v2: próximo par prospectivo

13 septiembre2026, después del cierre de0S2ocg. El contrato
closed-response-v2 tiene controles de integración, pero no se ha cualificado
con el proveedor real. El harness antiguo de ocho brazos no fija toda la
regresión ni cada dispatch; no se ejecutará sin esas garantías.

Siguiente caso nuevo: conciliación de un registro de revisiones suministrado
íntegramente. Seleccionar la revisión numérica mayor de cada ID; en empate,
su última aparición; después filtrar inactive, preservar ceros y negativos,
ordenar IDs por puntos de código sin normalización y sumar. El orden de llegada
no sustituye al número de revisión. Es distinto del par antiguo de media/texto
y de pedidos por última aparición.

Dos brazos completos, v2 primero y planificado después, únicamente si el
primero supera controles y oráculo. Ocho llamadas máximo por brazo/dieciséis
globales, incluidas correcciones, mismas instrucciones originales/modelo/
esfuerzo/fichas/transporte/criterios de aceptación pertinentes y sin resultados
del otro brazo en contexto. La diferencia explícita es la clase de entrada.
Planificación profunda y su revisión se conservan en el brazo planificado;
el cerrado usa su contrato propio y juez independiente, no Ω23 sin entradas
aceptadas. Un fallback no se cambia artificialmente a respuesta directa.

Petición/datos/oráculo se fijarán en código y pruebas antes de ejecutar.
Todos los dispatch/recibos/rechazos deben quedar guardados antes de validarlos;
cap, señal y congelación se comprueban en la frontera de cada llamada. Entrega,
linaje, estado actual, fuente de autoridad, revisión independiente y reentrada
sin trabajo adicional se auditan en ambos brazos. Los oráculos quedan fuera
de la inferencia. No se cambia política instalada, roles originales, API o cuota.

Una muestra pareada en orden fijo sólo permite describir sus costes. No prueba
ahorro causal general, composición/derivación formal, decisiones de escalado,
tolerancia multidía ni el mandato completo. Las pruebas negativas existentes
siguen siendo simuladas. Antes del ensayo: nueva regresión que incluya los
archivos de este harness, no atribuirlos retroactivamente a0S2ocg.

## Caso y conductor implementados

`closed-v2-revision-case.mjs` fija trece registros. Esperado externo:
IDsB,D,a,É,U+E000,U+1F600; importes0,-2,0,4,1,3;total6.
El carácter suplementario distingue orden por puntos de código del orden
UTF-16 habitual. Prueba externa cuadrática reconstruye máximos/empates,
filtra después y contrasta el esperado; mutaciones de orden, tipo de orden,
importe, baja, omisión y campos extra se rechazan.

`run-live-closed-v2-revision.mjs` exige regresión y todos los inputs fijados,
registra propietario boot/PID/start ticks antes de inferir y reutiliza el
harness completo con retención de peticiones/recibos, oráculo, linaje y
reentrada. `closedEntryVersion` sólo admitev2 para transformaciones sin efectos;
no cambia las misiones/casos anteriores ni permite convertir fuentes o código
en una ruta cerrada. Los dieciséis pasos máximos son techo, no objetivo.

Dirigidas sesión45270:5/5PASS,1317.273487ms. Incluyen ambos recorridos
simulados, origen explícito del controlador, siete criterios de v2,
dos/cuatro llamadas, no-replay, igualdad de políticas salvo entrada y no
cualificación de simulaciones como uso real. El runtime existentec561736b
ya contiene el contrato v2; el nuevo código de ensayo exige su propia
regresión posterior. No se ha ejecutado todavía ningún brazo real.

Regresión prospectiva DfE1xm iniciada11:56:26.559, sesión48017/PID2063352,
boot2a077981-8aea-444e-8eff-44fa69814267/startTicks48453665;274inputs.
No editar esos inputs ni duplicar antes de reconciliar cierre. La anterior
0S2ocg quedó cerrada1066tests/1065PASS/unSKIP y verificada11:49:50.979;
su releasec561736b tiene los mismos archivos runtime, no los nuevos archivos
externos de ensayo. No usar la regresión anterior como cobertura retroactiva.

## Corte real — G1ZuZR en curso

DfE1xm cerrada12:02:16.847, sesión48017exit0/owner muerto:1070tests,
1069PASS/ceroFAIL/unSKIP,350190.432235ms. ResumenSHA
4e426ff0b799db0db8c614bc053916c9e3540072b7d41526909c51f7d79486f7.
Auditoría12:03:20.178:274pins/inventario/streams/runtimec561736b íntegros.

Par G1ZuZR cualificado12:03:38.872, sesión23783/PID2068010,
boot2a077981-8aea-444e-8eff-44fa69814267/startTicks48496876.
CasoSHA5e4c209915ba037808fbd1a27ff9395a869dafd5bff03364e83300468c2da68f.
No duplicar ni modificar274inputs hasta cierre reconciliado.
Adaptativo misión5a2a1097-b8c4-4cc1-b4ec-7463026cb78c, COMPLETED12:05:22.160,
dos llamadas reales20321tokens; diez controles del harness verdaderos,
oráculoEXACT_TRANSFORMATION y reentrada sin trabajo adicional.
Planificado misión38e84197-5cb6-4c79-a891-c8c4efa7b659 en curso.
Falta cierre global, integridad final y auditoría semántica de ambos brazos.
El oráculo JSON.parse no rechaza por sí mismo claves duplicadas: inspección
del cuerpo original requerida. No modificar esa condición durante el ensayo.

## Cierre y auditoría principal — 12:14 UTC

G1ZuZR cerrado12:12:38.237, sesión23783exit0/propietario muerto. A12:13:13.379
se revalidaron274inputs, regresiónDfE1xm y releasec561736b antes de editar.
Resumen originalSHA8ee53ff1c20fbf867f2b6564fc9ca7bc851e7cc32f38409da35166c552a84ccb.
Los semanticAudit=PENDING del harness permanecen originales; este apartado
documenta la revisión externa posterior, no reescribe sus resultados.

| Observación real | Cerrada v2 | Planificada |
|---|---:|---:|
| Llamadas completas / reparaciones | 2 / 0 | 4 / 0 |
| Tokens entrada / salida | 17178 / 3143 | 68659 / 13674 |
| Total observado | 20321 | 82333 |
| Tiempo extremo a extremo | 103131ms | 435862ms |
| Controles finales contenido / runtime | 3 / 4 | 8 / 3 |
| Controles adicionales del plan | No hay plan generado | 5 |
| Fuentes / efectos / replay | 0 / 0 / 0 | 0 / 0 / 0 |

Mismo Astra/ultra, perfilscoped-v1, formato íntegro de fichas, política salvo
entrada y petición idéntica. Seis recibos reales completos, cero coste perdido
en este par; orden fijo, caso conocido y una muestra. No inferir ahorro causal
general, suficiencia del routing para otros dominios ni política predeterminada.

Auditoría principal readOnly12:14:37.937–12:14:38.040: linajes completos
revalidados desde firmas y exposiciones;14citas exactas y usadas en sus propios
inputs, petición inmutable y prefijos completos en las seis solicitudes.
Los dos cuerpos originales son exactamente JSON.stringify(expected), no sólo
objetos parseados iguales: sin claves repetidas, texto adicional o campos extra.
CuerpoSHAe2fb00f9ac8d423e3d3635496ed6c10ff84004f3d8216062c329e4529325e26c.
Recomputación: A pierde por último empate inactivo, C por máximo inactivo;
B conserva0, D conserva−2 pese a revisión posterior menor; a/É/U+E000/emoji
conservados, orden66,68,97,201,57344,128512 y total6.

V2 usa trusted-controller-contract, no rol de catálogo ni especialista
autorizado por un plan inexistente; juezomega_22 separado, siete criterios
originales intactos. Planificado preserva once grupos con citas de petición
literales, único nodo transformacion y carta propia con pregunta, método,
falsador, beneficio y cierre; su plan fue aceptado antes de producir. Selección
antes de filtro; suma y orden independientes entre sí después de seleccionar.
El juez de plan recibe omega_22 completa; se acredita esta revisión acotada,
no ejecución de todos los servicios nombrados como dependencias del catálogo.

Producto v2bc49224d-ef00-4d01-82e6-4f440d61d937/payloadca23d1e7...;
review1b63f2f0-eb73-4bbf-a996-bdaf0596dda0/recordda3a6bbb... .
Producto planificado7c6fb873-51f4-47a3-b3e8-a5eaf9e9016a/payloadb9e43bc9...;
reviewacac550f-4702-40db-916e-9ac1f3f181fa/record906522e9... .
Plan8649e543-8b82-40a2-a6e8-db436857a97a/payload3026b5ac...;
reviewe9510c01-866c-4293-8b9b-cb93d10af586/recorde9950e02... .

Bases cerradas antes/después idénticas:
v2c5c9c7137663e924433ec09f16fa6fab7c94fa6dd45d4aed0dc239ee303c526f;
planificada18a74f4a8e10f159673f01d0aa69fab905e5fe7ae891de876d03ed6c41f62f5d.
Journals86/24f8e2f5e5be312e05b2f16bbbdfd472c5afa8959888ee29ec9441f951e9570c
y188/bebb1c923f876d5b84a2819ffe28a3c9c0273c9dc3d7096de7781bf166cf85df.
Reentrada conserva material484c4347.../46c0b97b... y llamadas2/4; sólo
registros permitidos de motor/validación, cero nuevas leases de lectura.

Carencia del oráculo reproducida externamente: anteponer total999 antes del
total6 devuelveEXACT_TRANSFORMATION con el parser antiguo. No ocurrió en
los resultados reales, comprobados byte a byte. Se corregirá prospectivamente
sin cambiar petición, criterios, datos, resultado esperado ni evidencias cerradas.
El scope genérico del result menciona tres casos/cuatro brazos por reutilización;
el qualification y summary de este par fijan correctamente un caso/dos brazos.
Corregir esa etiqueta en futuros harness, no en archivos históricos.

Comprobación adicional del contrato planificado: campo correcto
worker-config.standaloneSpecialist, no specialist. La primera impresión
diagnóstica consultó el nombre incorrecto y mostró false; el binding real
se rederivó del plan aceptado y coincide con su copia y compilationScope,
SHA5931539d96adab2c4fc6f3d548f288ae57573f2e64bac0e1730f50e02ad2acea.
Base intacta. No confundir un error de inspección con ausencia de ficha.
