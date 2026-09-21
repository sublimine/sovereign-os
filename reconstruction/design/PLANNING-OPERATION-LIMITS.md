# Límite operativo visible antes de planificar

Estado22:14UTC: implementado en desarrollo para el modo explícito read-test-v1;
NO instalado ni evaluado todavía con nuevas inferencias reales. El hallazgo y
las decisiones previas se conservan abajo. No es una corrección de Node.

WorkerService.producerOperationalEnvelope obtiene límites reales de su instancia;
FactoryEngine lo incluye en runtimeCapabilities del planner tradicional y del
on-demand, y produce lo entrega con pasos restantes. El mismo contrato explica
que final consume un paso, diferencia operaciones de propuestas y advierte del
posible reporter agregado ANTES de la primera ejecución. No acredita cobertura,
no exige cambiar el comando y no aumenta presupuestos, permisos o intentos.
El planificador recibe información para decidir, no un validador aritmético que
declare suficiente cualquier plan. Esta primera integración queda en el modo
opt-in que ya separa scopes y no permite overlays anteriores; no se agrega una
opción nueva ni se cambia adaptive-v1 por defecto. La respuesta de plan retenida
conserva sus bytes originales. No hay promesa de capacidad futura reservada.

Pruebas nuevas: primer intento6FAIL incluía fallo de fixture, cuyo juez simulado
omitía citar el listado propio. Diagnosticado sin cambiar core; fixture corregida
a citar sus observaciones auténticas y contar efectos por productor, no los del
juez. RED relevante posterior5FAIL/1PASS3829.85338ms; tras implementación6PASS
3785.239979ms. Ampliación9PASS3936.749214ms: configuración no predeterminada,
planificación tradicional/on-demand, presupuestos decrecientes, final sin broker
restante, techo sin ampliación, aviso previo, baseline sin campo, copia no mutable,
rechazo de overlay antiguo y respuesta retenida sin nueva planificación. Modelos
y disponibilidad de capacidad SIMULADOS; SQLite/broker/listado reales. Regresión
amplia de seis archivos cerrada256PASS/0FAIL125821.167799ms,19189exit0. Incluye
ejecuciones nativas de ruta completa con modelosSIM y aprendizaje previo íntegro.
El par sintético conserva5→4llamadas y8efectos; al añadir metadatos el input nuevo
sube a86288B (baseline106246B), no los81257B anteriores. No esconder ese coste ni
presentarlo como tokens de suscripción. Global hWOjuv cerrada22:12:15.352/21227exit0:
1385tests1384PASS/0FAIL/unSKIP573563.123748ms.295inputs/cuatro streams/comandos y
owner ausente reconciliados22:14:25.861. Runtime7fad65239cee0c09a95ac2643ad63f98a42c828e85201a5176b589d5c48e7bbb
congelado421archivos24103644B, no instalado. Los cambios posteriores del presupuesto
compartido de misión requieren otra cualificación; esta batería no los cubre.

## Hallazgo y diseño anteriores a la implementación

13septiembre2026,21:27:41UTC. NO implementado ni incorporado al ensayo UYEoVL.
Los294inputs y la política de ese ensayo permanecen congelados.

## Evidencia observada

Lectura de capturas públicas de UYEoVL, sin acceder a su SQLite activo:

- request-1.json, planificación: runtimeCapabilities exterior sólo enumera
  isolatedCodeRunner, publicSourceDiscovery, executionMode y networkInExecution.
  El task añade suscripción, fuentes, restricciones de roles, fronteras de
  evidencia, especialistas, comparación ciega y copia literal; no límites del
  productor. Ninguna clave maxToolOperations/maxBatchOperations/
  remainingToolOperations/batchLimit aparece en ese input.
- request-4.json, productor implementacion: task.batchLimit=4 y
  task.remainingToolOperations=11, después del listado inicial.

El planificador recibe instrucciones de lotes acotados pero no sus valores
reales. El caso actual de tres archivos no prueba un fallo causado por esa
omisión: la ruta nominal puede caber en doce operaciones. No presentar este
hallazgo como causa del timeout previo o de un resultado todavía pendiente.

## Riesgo y siguiente comprobación

Un plan grande puede concentrar obligaciones cuya ejecución no cabe en un único
trabajador. Descubrirlo sólo en producción consume presupuesto de coordinación
y puede provocar un reintento improductivo del mismo plan. El ajuste a estudiar
es exponer antes de planificar el sobre operativo REAL del WorkerService, con
su alcance: límites por productor/propuesta, no una bolsa global nueva.

No basta añadir números fijos a un prompt: deben venir de la configuración
efectiva y corresponder a la ejecución posterior. Un techo no garantiza
suficiencia semántica, y contar archivos no demuestra cuántas escrituras hacen
falta si ya existen o proceden de dependencias. No imponer una estimación
inventada como lower bound ni aumentar límites para conseguir PASS.

Después del cierre/reconciliación del ensayo actual: primero un contraejemplo
dirigido con configuración distinta y sin modelo real; comprobar exposición
correcta, alcance, no ampliación de permisos/presupuesto y conservación de
criterios. Integración/regresión posteriores separadas, no modificación
retroactiva de la planificación UYEoVL ni nuevo brazo hasta verde.

## Lectura de implementación —21:43, sin modificación de código

WorkerService recibe maxSteps, maxBatchOperations y maxToolOperations (este último
por defecto igual a maxSteps). produce() consume un paso por propuesta de modelo,
incluida final; incrementa operaciones antes de cada intento del broker. Un fallo
de miembro conserva los anteriores y consume ese intento; los miembros restantes
no ejecutados no se cuentan, aunque la propuesta completa tuvo que caber en el
presupuesto antes de empezar. action=document consume pasos pero no ese contador
de broker. No traducir esos tres límites a un único número de llamadas global.

El planner se invoca desde FactoryEngine con esa misma instancia de workers.
El request completo queda retenido; una recuperación de respuesta ya cerrada no
debe reconstruirla con capacidades nuevas. La ficha compilada tampoco convierte
un límite en permiso de herramienta ni acredita presupuesto futuro del proveedor.

Contraejemplos dirigidos a cubrir antes de aceptar cualquier integración:

- Valores no predeterminados deben aparecer exactos, incluido maxToolOperations
  distinto de maxSteps. Configuración y no números copiados del ensayo.
- Final exige espacio en el techo de propuestas aunque queden cero operaciones.
- Planner tradicional y consulta on-demand deben recibir el mismo alcance real,
  sin reiniciar sus reservas ni omitir las fichas completas exigidas por su modo.
- Respuesta de planificación retenida y recuperación conservan los bytes originales;
  no añadir el campo a capturas o planes históricos ni fingir que se conoció antes.
- Herramientas autorizadas, criterios e intentos permanecen iguales. No aprobar
  automáticamente un plan por una suma de costes estimada o asumir que todo archivo
  exigido necesita una escritura nueva del mismo productor.
- Overlays evaluados bajo otro contexto no se transfieren silenciosamente al
  contexto modificado; explicitar el alcance de compatibilidad antes de integrar.

El diseño anterior ya se implementó según la cabecera. No añade un campo a UYEoVL, no aumenta sus12operaciones
y no atribuye causalidad a la ausencia de agrupación observada.
