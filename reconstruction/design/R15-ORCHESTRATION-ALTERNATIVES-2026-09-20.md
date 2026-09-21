# R15 — registro fechado de alternativas de orquestación

**Fecha de consulta:** 20 de septiembre de 2026 (Europe/Berlin).
**Estado:** investigación de fuentes primarias; no es instalación, prueba de
integración, cambio de servicio ni cualificación end-to-end.

## Alcance y frontera de la decisión

Este registro complementa, sin modificar, la investigación histórica
[RESEARCH-DECISIONS.md](RESEARCH-DECISIONS.md), cuyo corte fue el 9 de
septiembre. Se consultaron páginas oficiales/directas de cada proyecto; no se
usaron foros, credenciales, cuentas, precios ni ejemplos comunitarios como
evidencia de garantía.

Se evaluó sólo si una alternativa documenta mecanismos para:

1. orquestar trabajo y reanudarlo;
2. conservar estado/historial ante interrupción;
3. observar o evaluar ejecuciones; y
4. recibir trabajo por evento o suscripción.

No se evaluó rendimiento, coste, seguridad de despliegue, compatibilidad con la
VPS ni una garantía de calidad. Tampoco se infiere que una traza, checkpoint,
historial de workflow o evaluación de proveedor constituya por sí mismo un
recibo de efecto, una autorización, independencia de revisión, verdad factual o
cualificación de Sovereign.

En este documento, **suscripción de eventos** significa entrega pub/sub o un
mensaje a un workflow. Es distinta de la **suscripción ChatGPT/Codex** con la
que el adaptador actual obtiene propuestas. Ninguna fuente consultada acredita
que un producto alternativo pueda sustituir esa autenticación/entitlement; no se
consultaron ni copiaron credenciales para investigarlo.

Las condiciones de comparación locales son deliberadamente más estrechas: el
controlador conserva un journal SQLite con CAS/fencing, estados de efecto
incluidos `PREPARED`/`DISPATCHED`/`UNCERTAIN`, y no repite automáticamente un
efecto incierto; además, la evaluación y su activación están ligadas a casos y
autorizaciones durables. Véanse [factory/README.md](../../factory/README.md),
[EXECUTION-HISTORY.md](EXECUTION-HISTORY.md) y
[LEARNING-DOMAIN-REGISTRATION.md](LEARNING-DOMAIN-REGISTRATION.md). Esas son
fronteras de Sovereign, no propiedades atribuidas a los productos externos.

## Registro de alternativas

| Alternativa | URLs primarias consultadas (20-09-2026) | Capacidad observada | Limitación material para Sovereign | Decisión concreta |
|---|---|---|---|---|
| **LangGraph / LangSmith** | [persistencia](https://docs.langchain.com/oss/javascript/langgraph/persistence), [diseño por nodos/estado](https://docs.langchain.com/oss/javascript/langgraph/thinking-in-langgraph), [tipos de evaluación](https://docs.langchain.com/langsmith/evaluation-types) | LangGraph separa checkpoints por `thread` de un store entre threads; los checkpoints sirven para reanudar, interrupciones humanas y tolerancia a fallos. LangSmith documenta evaluaciones offline y online, incluidas de código y LLM-as-judge. | La propia documentación aclara que `MemorySaver`/`InMemorySaver` se pierden al reiniciar y exige un checkpointer persistente. Sus checkpoints/evaluaciones no documentan la autoridad de un efecto Sovereign, el recibo externo, una revisión independiente ni la conservación local de trazas privadas. | **REUTILIZAR sólo los conceptos** de estado por alcance, checkpoint y evaluación offline/online; **NO ADOPTAR** LangGraph/LangSmith como runtime o servicio de producción. Mantener el journal, los efectos y los evaluadores de Sovereign como fuentes de autoridad. |
| **Temporal** | [workflow execution](https://docs.temporal.io/workflow-execution), [event history](https://docs.temporal.io/encyclopedia/event-history/), [signals/queries/updates](https://docs.temporal.io/encyclopedia/workflow-message-passing), [visibility](https://docs.temporal.io/visibility) | Temporal documenta workflows durables, recuperación por Event History/replay, Signals asíncronos, Updates rastreables y búsqueda operativa de ejecuciones mediante Visibility. | Es un runtime con Temporal Service y workers; su modelo de comandos/activities debe incorporarse a la operación. Visibility es explícitamente eventual y no sirve como estado autoritativo de una ejecución concreta. La documentación consultada no convierte un activity externo ni un Signal en autorización o recibo Sovereign. | **NO ADOPTAR** como núcleo ahora. Sólo reconsiderar un adaptador tras una cualificación separada que preserve el ID de efecto, recibo externo, incertidumbre, cancelación, fencing y lectura autoritativa local; no sustituir SQLite/journal por Visibility. |
| **OpenAI Agents SDK (TypeScript)** | [tracing](https://openai.github.io/openai-agents-js/guides/tracing/), [sessions](https://openai.github.io/openai-agents-js/guides/sessions/), [human-in-the-loop](https://openai.github.io/openai-agents-js/guides/human-in-the-loop/), [testing](https://openai.github.io/openai-agents-js/guides/testing/) | Ofrece bucle de agente, handoffs, una interfaz de sesión persistente, estado de interrupción serializable/reanudable y trazas de generaciones, herramientas, handoffs y guardrails. Sus doubles de prueba son deterministas y sin llamadas de modelo. | La sesión es una interfaz de almacenamiento de conversación, no un journal de autorización/efectos. La guía de testing dice expresamente que sus doubles no prueban que un modelo real elija el comando ni el ciclo de vida de un proveedor/sandbox real. El tracing puede exportar fuera del proceso y necesita una política explícita de datos. | **NO ADOPTAR** como orquestador ni como ruta de suscripción. Conservar Codex app-server como frontera de propuestas autenticadas; no introducir `OPENAI_API_KEY` ni exportación de trazas por esta investigación. Una futura integración sólo puede ser un adaptador opt-in que mantenga las comprobaciones de Sovereign antes y después de todo efecto. |
| **AutoGen Core / AgentChat** | [mensajes y pub/sub](https://microsoft.github.io/autogen/dev/user-guide/core-user-guide/framework/message-and-communication.html), [estado](https://microsoft.github.io/autogen/dev/user-guide/agentchat-user-guide/tutorial/state.html), [tracing](https://microsoft.github.io/autogen/stable/user-guide/agentchat-user-guide/tracing.html) | Documenta agentes event-driven, mensajería asíncrona, topics/subscriptions, persistencia explícita por `save_state`/`load_state` y telemetría OpenTelemetry. | En broadcast, la publicación es unidireccional; una respuesta del handler se descarta y las excepciones del receptor se registran sin propagarse al publicador. Persistir estado es una operación explícita hacia disco/base de datos, no una prueba de entrega, aprobación o idempotencia de efecto. | **NO ADOPTAR**. El pub/sub puede servir como vocabulario de diseño, pero no se incorpora un runtime Python/.NET ni se delegan los gates de autoridad, aceptación, recibos o evaluación a sus mensajes. |
| **Dapr Workflow + Pub/Sub** *(alternativa adicional justificada)* | [workflow](https://docs.dapr.io/developing-applications/building-blocks/workflow/workflow-overview/), [pub/sub](https://docs.dapr.io/developing-applications/building-blocks/pubsub/pubsub-overview/), [observabilidad](https://docs.dapr.io/concepts/observability-concept/) | Es la única alternativa adicional incluida porque sus fuentes oficiales cubren conjuntamente workflows stateful de larga duración, actividades con pub/sub, APIs de pausa/reanudación/evento, historial opcionalmente firmado, pub/sub con outbox/dead-letter y trazas/métricas/logs mediante OpenTelemetry. | Pub/sub garantiza **al menos una vez**, no exactly-once. Requiere runtime/sidecar, componentes de state store y broker; el outbox es una integración adicional, no una acreditación de que el receptor ejecutó un efecto autorizado. Las métricas/trazas observan llamadas, no aceptación semántica. | **NO ADOPTAR** en la VPS/ruta actual. Es el candidato más relevante para una prueba futura de ejecución por evento, pero sólo después de definir un puente que dedupe por ID de efecto, conserve `UNCERTAIN`, no abra nuevas credenciales y pase casos congelados de entrega duplicada, caída, cancelación y retracción. |

## Decisión transversal R15

**Construir y conservar en Sovereign, no delegar:**

- admisión explícita de una suscripción/evento con identidad, alcance, versión y
  autorización; un topic, Signal o callback no activa por sí mismo una misión;
- puente idempotente con el mismo ID de efecto, recibo del receptor y estado
  `UNCERTAIN` cuando no sea posible saber si el receptor actuó;
- proyección local de observabilidad que no exporte prompts, fuentes o decisiones
  privadas por defecto, y que diferencie evento observado de efecto acreditado;
- evaluación con casos congelados, criterio independiente y regresiones. Las
  evaluaciones de framework/modelo pueden ser datos auxiliares, nunca la
  aceptación final; y
- una prueba de cualificación end-to-end antes de cualquier cambio de runtime:
  entrega duplicada, crash antes/después de commit, pausa/reanudación,
  cancelación, revocación, pérdida de receptor y verificación independiente del
  resultado.

Por tanto, el resultado actual de R15 es **no adoptar ninguna dependencia o
servicio externo**. LangGraph/LangSmith se reutilizan únicamente como referencia
de diseño ya compatible con la separación local de estado y evaluación; las
demás alternativas quedan como comparadores o candidatos de una futura prueba
acotada. Esta decisión no afirma que sean inadecuadas en otros entornos, ni que
la implementación local ya esté cualificada para todas las rutas de eventos.

## Evidencia y límites de lectura

Las URLs de la tabla son el registro de evidencia primaria directa y la fecha de
consulta es la indicada al inicio. Las afirmaciones de este documento se limitan
a las capacidades descritas por cada fuente oficial y a las fronteras locales
referenciadas. No se realizaron comandos de instalación, despliegue, reinicio,
conexión a broker, creación de cuentas, acceso a secretos ni pruebas live; por
eso no hay una afirmación de compatibilidad operativa, coste o garantía de
entrega para ninguna alternativa.
