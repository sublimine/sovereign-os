# Respuesta de planificación durable

Estado 2026-09-13 16:31 UTC: implementada en desarrollo, no instalada.
Regresión dirigida de seis archivos cerrada (sesión 8187, exit0):227/227 PASS,
182211.243063ms. Global UWzy5t CERRADA16:30:26.814, sesión25318exit0:
1165tests/1164PASS/ceroFAIL/unSKIP305039.436678ms. Owner2155326/startTicks50067134,
boot2a077981-8aea-444e-8eff-44fa69814267 ausente;276inputs/started/cuatro
capturas reconciliados16:31:23.023. Resumen SHA256
45e46c33137b27beef65bfa290bfb3be73b76c1af6fcdcc9b9d32dfedc8c2969.
Runtime fc4ef5fe1384915dd8f7a23e6cc367f6d6e488a290f0360248514e6691f5d2d7
con414archivos/24031514bytes, generado y verificado; NO instalado. La inspección
interactiva de fichas continúa siendo diseño, no una capacidad entregada.

Ampliación16:54: el lector interno comparte ahora su evidencia decodificada con
readPlanningContractCoverage, sin cambiar el resultado público de recuperación.
Vincula cobertura íntegra de fichas al request/response exactos; no es aceptación
ni el protocolo on-demand. Engine/catálogo119/119PASS; global vdN9yi posterior
CERRADA1196tests1195PASS/unSKIP314916.497427ms.276inputs/capturas/owner ausente
reconciliados16:53:58.933; resumen eca87db8afff691e053f2e920ac5c43f2bfa26d91442d144ece0ac37222c5f6a.
Runtime f5813eb509612afd36483951c95f768e6962c666c34e9a75f5be71bccee8b073,
414archivos24037582B, verificado y NO instalado.
Ver [inspección y evidencia de cobertura](../design/PLANNING-CONTRACT-INSPECTION.md).

## Defecto y solución acotada

El planificador conservaba su recibo de inferencia pero no la respuesta pública
antes de crear el candidato. Una caída en ese intervalo perdía el plan concreto
y provocaba otro productor al reentrar. Los tests previos de cuota durante la
revisión sólo cubrían candidatos ya creados, no ese intervalo.

Se reutilizan Store/SQLite, recordInferenceRequest, attachInference y los
validadores de planes existentes. No se incorpora otra librería de orquestación,
un segundo almacén ni un agente adicional: el resultado y su recibo necesitan la
misma transacción local que ya soporta el controlador. Este es el preflight de
solución existente para esta frontera, no una investigación de proveedores.

`planning-response-v1` es una retención explícita de la respuesta final del
productor planning/plan con fichas omega_04 y omega_05. No altera PLAN_SCHEMA,
modelo, esfuerzo, política de herramientas o presupuesto. Antes del dispatch
rechaza un actor, modo de retención o esquema ajeno. Los otros productores y
jueces mantienen su protocolo anterior.

La solicitud pública íntegra queda guardada antes del dispatch. Tras validar el
valor solicitado, attachInference y el registro planning-response se confirman
juntos: error o caída dentro de la transacción no dejan un recibo completo sin
respuesta. Sólo se retienen value y su recibo explícito, no otros campos privados
del proveedor. Un identificador estable por run impide ocultar una respuesta
existente cambiando el hash del último recibo del actor.

El lector usa una instantánea SQLite propia de sólo lectura o conserva la
transacción del llamador. Comprueba misión/intención/política, configuración e
instrucciones, schema, solicitud prospectiva exacta, exposición del run,
finalización única, valor y hashes de registros, además del orden de commits
solicitud → finalización → respuesta. No cachea autoridad entre lecturas.

La reentrada busca primero un candidato durable (incluido el huérfano creado
antes de guardar planning-progress), después la respuesta durable y sólo luego
la ausencia real de ambos. Una respuesta recuperada sigue pasando validación
contra el mandato y plan anterior, normalización y revisión independiente. No
otorga aceptación, no reinicia qualityFailures y no cuenta como otra llamada de
planificación. La corrupción contractual no se trata como defecto de calidad
que autorice gastar otro intento.

## Evidencia obtenida y fallos conservados

- RED inicial: 0 PASS / 3 FAIL, 1189.111049 ms (sesión 76055): no existía
  respuesta recuperable, ni transacción de retención donde inyectar el fallo.
- Primeras implementaciones: 4/4 PASS; ampliación de ámbito y alteraciones,
  14/14 PASS, 4752.827480 ms (sesión 95010).
- Segunda tanda previa a endurecer: 0/5 PASS, 3380.761984 ms (sesión 46617).
  Dos fallos eran reales: esquema ajeno alcanzaba el proveedor y lectura sin
  instantánea. Los otros tres eran un error del test: se esperaba RUNNING,
  aunque ensurePlan guarda PLANNING antes de inferir. Se corrigió esa expectativa
  desde el contrato de engine, sin cambiar estados de producción para pasar.
- Después: 19/19 PASS, 6878.681810 ms (sesión 10509). Incluye salida abrupta
  del proceso propio con código 86 en tres fronteras y recuperación SQLite real.
  El proveedor es simulado en todos esos casos, no son inferencias de suscripción.
- Tercera tanda: 1 PASS / 1 FAIL, 1467.729925 ms (sesión 1017). Otro escritor
  SQLite durante una lectura ya no mezcla versiones; corrupción introducida
  durante generate todavía consumía correcciones y acababa NEEDS_DIRECTION.
  Se añadió propagación explícita de PLANNING_RESPONSE_INTEGRITY/SCOPE al estado
  de fallo, sin borrar evidencia ni autorizar otro productor. Regresión dirigida
  posterior227/227PASS incluye las21pruebas específicas y las rutas de engine,
  workers, plans, plan-role-review, planned-blind e input-copy.

Negativas cubiertas: respuesta reversionada/alterada, recibo eliminado, distinto
o duplicado, nueva solicitud pendiente, política/configuración/solicitud/contexto
cambiados, productor no autorizado, retención desconocida, esquema ajeno y
modificación del contexto durante generate. Se comprueba aislamiento del objeto
devuelto y que la lectura no escribe ni cierra transacciones ajenas. Una segunda
conexión puede confirmar un cambio mientras la primera termina con su instantánea;
la siguiente lectura detecta la modificación, no reutiliza un resultado cacheado.

## Alcance de las tres caídas de proceso

1. Antes de confirmar la respuesta: solicitud pendiente conservada; respuesta,
   recibo completo y candidato ausentes. No se fabrica un resultado perdido.
2. Después de confirmar respuesta y antes de crear candidato: se conserva el
   mismo run/valor; tras reabrir sólo infieren juez del plan, productor del
   resultado y juez del resultado. No se vuelve a planificar.
3. Después de crear candidato y antes de enlazar el progreso: se recupera ese
   candidato exacto, no uno nuevo con la misma prosa.

No es una garantía de exactly-once remoto. Si el proceso muere después de que el
proveedor responda pero antes del commit, sólo queda la solicitud pendiente. La
política anterior ante ausencia de respuesta no se convierte en recuperación
de bytes que nunca se guardaron. Tampoco demuestra comportamiento ante apagado
de la VPS, eficacia semántica del planificador, inspección de fichas implementada,
reducción medida de tokens o finalización de R01–R16.
