# Investigación comparada y decisiones de reconstrucción

Fecha de corte: 9 de septiembre de 2026. Investigación para este mandato, no clasificación mundial de productos. Las fuentes primarias se consultaron antes de elegir mecanismos; las inferencias de diseño se distinguen de sus afirmaciones. No se usó el prototipo retirado como base, benchmark ni evidencia.

## Pregunta y criterio

¿Qué arquitectura conserva las capacidades útiles del borrador, reduce trabajo redundante, se ejecuta con la suscripción del propietario y demuestra sus decisiones mediante productos, fuentes y pruebas? La unidad de evaluación es una petición resuelta correctamente, con sus efectos y restricciones; no cantidad de agentes, tamaño de prompts ni porcentaje de tests sin cobertura.

Se contrastaron: separación entre orquestación y juicio, aislamiento y autoridad, adquisición y soporte factual, durabilidad de efectos, adaptación del grafo, evaluación/ aprendizaje, coste observado e integración oficial. Los foros sirvieron para encontrar problemas/candidatos, no para acreditar garantías técnicas. Los informes locales de integración y auditoría son evidencia separada de la documentación de terceros.

## Sistemas y mecanismos contrastados

| Sistema | Evidencia primaria relevante | Decisión para este proyecto |
|---|---|---|
| Codex SDK / app-server | El SDK controla trabajos locales; app-server ofrece sesiones, autenticación, aprobaciones y eventos. | Usar app-server stdio versionado porque necesitamos controlar esos eventos. No confundir respuesta JSON con acción ejecutada. |
| LangGraph | Checkpoints persistentes, estado de threads, store transversal, grafos dinámicos y reanudación con replay. | Adoptar distinciones de estado y reentrada; evaluar si una dependencia añade valor sobre el journal local. No convertir el framework en juez de verdad. |
| LangSmith | Evaluación offline para cambios y online sobre trazas, con jueces de código, modelo y humanos. | Separar esas obligaciones en una plataforma local sin abrir cuenta ni enviar trazas privadas a un servicio nuevo. |
| Temporal | Historial durable y retry de actividades; idempotencia del efecto depende de la operación externa. | Modelar intentos, recibos e incertidumbre. No prometer ejecución exactly-once de comandos genéricos. |
| Sistemas multia­gente de Anthropic | Delegación con instrucciones específicas; utilidad dependiente de paralelismo y contexto compartido. | Especialistas a demanda y restricciones de independencia, no un consejo fijo para cada pregunta. |
| Hermes Agent | Núcleo reutilizado por CLI/gateway/protocolos, sesiones SQLite, memoria y skills. | Adoptar interfaz común y memoria por alcance; no equiparar autoedición de instrucciones con mejora comprobada. |
| OpenClaw | Subagentes/sesiones y operación con backpressure, recuperación y handoffs. | Usar como comparación operacional. Una sesión separada no implica aislamiento OS ni juez independiente. |
| GEPA | Optimización con métricas, reflexión sobre trazas, candidatos y selección. | Aprendizaje como experimento comparado y reversible. No entrenar contra una etiqueta que produzca el propio candidato. |

### Codex: integración por suscripción

La documentación describe SDK para automatización y app-server para clientes que necesitan gestionar sesiones, autenticación, aprobaciones y streaming. El SDK Python documentado también controla un app-server local. Eso no acredita por sí solo que cada función experimental esté disponible en nuestra CLI. No se utiliza el servidor MCP de Codex, señalado como obsoleto. [SDK oficial](https://learn.chatgpt.com/docs/codex-sdk)

El app-server admite autenticación ChatGPT administrada por Codex y expone información de cuenta/cuotas. La integración elegida conserva esa gestión: no lee, copia ni refresca tokens por cuenta propia. `outputSchema` y eventos de turno sirven para propuestas estructuradas; el recibo de una acción lo genera el ejecutor, nunca el texto del modelo. Se fija la versión local y se valida el protocolo generado. Las herramientas dinámicas son una superficie experimental, no un requisito del primer adaptador. [App-server oficial](https://learn.chatgpt.com/docs/app-server)

**Observación local:** CLI 0.153.4 autenticada mediante ChatGPT; hubo respuesta textual y salida estructurada reales. Los intentos de herramienta dinámica no produjeron callback: no se cuentan como ejecución. El contrato environmentless tiene prueba de código de la versión y fixtures adversariales, documentados aparte. No acredita aislamiento del proceso anfitrión ni elimina la confianza en el proveedor de inferencia. [Preflight local](../integration-preflight/README.md), [contrato de trabajador](../integration-preflight/ENVIRONMENTLESS-CONTRACT.md)

### LangGraph: persistencia y dependencias

La persistencia distingue checkpoints de un thread de un store entre threads; un backend en memoria no da continuidad tras reinicio. Esta separación informa el diseño de misión, memoria y versiones. No se adopta memoria global indiferenciada ni un resumen conversacional como autoridad sobre resultados. [Persistencia de LangGraph](https://docs.langchain.com/oss/python/langgraph/persistence)

Al reanudar un interrupt, la ejecución vuelve al comienzo del nodo; efectos anteriores pueden repetirse. La documentación exige idempotencia o separar dichos efectos. Por ello nuestra frontera es un efecto con identidad estable y reconciliación, no simplemente un nodo marcado como pendiente. [Interrupts](https://docs.langchain.com/oss/python/langgraph/interrupts)

El patrón orchestrator-worker genera subtareas dinámicas, y evaluator-optimizer separa producción de evaluación. Son patrones útiles, no protocolos suficientes de aceptación: un crítico que aprueba prosa no demuestra que se cumplan requisitos ni que la fuente sostenga la conclusión. Nuestro grafo se deriva de productos y contratos; la cantidad de sesiones es consecuencia de dependencias, riesgo e información compartida. [Workflows y agentes](https://docs.langchain.com/oss/python/langgraph/workflows-agents)

### Evaluación y durabilidad

LangSmith diferencia evaluaciones offline sobre datasets y online sobre trazas, y combina verificaciones de código, juicios de modelo y revisión humana. La reconstrucción mantiene un conjunto de regresión, casos de capacidad y observaciones reales; los fallos observados generan candidatos a casos nuevos, no cambian retrospectivamente el criterio del ensayo terminado. No se requiere LangSmith como servicio ni se autorizó subir trazas. [Evaluación LangSmith](https://docs.langchain.com/langsmith/evaluation)

Temporal recomienda actividades idempotentes: si el efecto ocurre pero no se registra su finalización, puede haber retry. La clave de idempotencia necesita aplicación real en el receptor; un campo en un JSON no basta. El diseño local registra `PREPARED`, `DISPATCHED`, resultado y `UNCERTAIN`; un efecto no reconciliable no se repite automáticamente con otra clave. Esto es una inferencia de arquitectura, no una garantía importada de Temporal. [Actividades de Temporal](https://docs.temporal.io/activity-definition)

Anthropic distingue la trayectoria del agente del resultado observable y combina jueces de código, modelo y humanos. Sus ejemplos de evaluación de investigación incluyen calidad de fuentes y soporte de afirmaciones; los de programación requieren resultados y comprobaciones ejecutables. Adoptamos esa distinción: mencionar el reason code esperado no da un aprobado si el agente ejecutó una acción prohibida. [Evaluaciones de agentes](https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents)

Su sistema de investigación explica por qué tareas paralelizables con herramientas y contextos delimitados pueden beneficiarse de especialistas. También reporta costes elevados de tokens en su propia configuración; no es una tasa universal ni justificación para reducir cualquier tarea a tres llamadas. La eficiencia se medirá comparando omisiones/falsos pases y consumo real sobre los mismos casos. [Sistema multia­gente de investigación](https://www.anthropic.com/engineering/multi-agent-research-system)

### Hermes y OpenClaw: operación, no certificados de calidad

Hermes documenta un núcleo compartido, registro de herramientas, sesiones SQLite/FTS5, linaje y memoria/contexto. Se adopta la idea de un motor accesible desde varias interfaces y memoria separada por alcance. Compresión es una representación con pérdidas: no reemplaza artefactos fuente, versiones ni efectos pendientes. No se reutiliza su resolución de credenciales para eludir autenticación oficial. [Arquitectura Hermes](https://hermes-agent.nousresearch.com/docs/developer-guide/architecture)

Sus interfaces programáticas distinguen protocolos y eventos de cancelación/aprobación. Un acuse de una instrucción encolada no significa que el agente la consumió, y suscripción a eventos no equivale a admisión durable. Nuestra interfaz debe informar estados observados y recuperar desde el journal, no prometer que un websocket mantendrá vivo el trabajo. [Integración programática Hermes](https://hermes-agent.nousresearch.com/docs/developer-guide/programmatic-integration)

OpenClaw distingue ejecución de subagentes y vida de sesiones; el aislamiento OS es una opción separada. Se conservan esa separación y límites de herramientas por instancia. Un nombre diferente, una sesión nueva o el mismo modelo con otro prompt no prueban independencia de evidencia. [Subagentes OpenClaw](https://docs.openclaw.ai/tools/subagents)

Su operación documenta concurrencia/backpressure, reconciliación de hijos interrumpidos, handoffs y cancelación por run. Eso motiva fencing de propietarios, estados de limpieza y cancelación de descendientes exactos. No se interpreta una interrupción solicitada como procesos efectivamente terminados. [Operación de subagentes](https://docs.openclaw.ai/tools/subagents/operations)

El harness Codex de OpenClaw constituye un ejemplo concreto de integración app-server y herramientas puente. Advierte sobre interacciones de política de herramientas y exec de gateway; no se instala como atajo hacia ejecución no aislada. La prueba de ausencia de herramientas nativas del nuevo trabajador procede del código OpenAI exacto, no de asumir que este plugin resolverá nuestros permisos. [Codex harness](https://docs.openclaw.ai/plugins/codex-harness)

### Aprendizaje: candidato no significa mejora

GEPA optimiza componentes mediante evaluación y feedback reflectivo sobre trazas, con candidatos y selección de soluciones. Su utilidad depende de la tarea, los datos y el objetivo medido. Para AGENTS/instrucciones se adopta la estructura experimental: baseline congelado, candidato, pruebas reservadas, guardrails, comparación y rollback. No se instala una dependencia de optimización ni se ejecutan ejemplos con API facturada. [Repositorio primario GEPA](https://github.com/gepa-ai/gepa)

### Almacenamiento y límites del VPS

Node 24 expone `node:sqlite`; la documentación vigente lo clasifica release candidate, no API estable. `DatabaseSync` es síncrono. Se fija runtime y se comprueba versión/configuración al arrancar; consultas parametrizadas, foreign keys, modo defensivo y límites explícitos. **Observación local:** Node24.19.0 y SQLite3.53.3. [Documentación Node24](https://nodejs.org/docs/latest-v24.x/api/sqlite.html)

SQLite WAL permite lectores concurrentes pero un solo escritor, requiere coordinación en el mismo host y necesita checkpoint. FULL sincroniza commits con condiciones distintas de NORMAL. Se elige para una instalación local con un escritor transaccional; no para un filesystem de red ni para afirmar consenso distribuido. La versión comprobada supera la corrección documentada del WAL-reset bug. [WAL de SQLite](https://www.sqlite.org/wal.html)

El sandbox Codex predeterminado falló en este VPS y legacy Landlock no admitió el perfil de filesystem mínimo. Se investigaron implementaciones mantenidas y diferencias ABI; no se construyó un jail ad hoc ni se deshabilitó el aislamiento para presentar un éxito. El worker de razonamiento sin entorno y el runner de código son fronteras distintas. El segundo sigue sujeto a preflight real antes de admitir código no confiable. [Informe local de restricciones](../integration-preflight/RESTRICTED-WORKER.md), [alternativas examinadas](../integration-preflight/ALTERNATIVES-ABI4.md)

## Decisiones propias y cómo podrían refutarse

1. **Control plane local y trabajadores por suscripción.** Reduce dependencias operativas en este VPS y permite un único registro de autoridad/estado. Se refuta si fallan recuperación, latencia o integridad frente a una alternativa mantenida bajo las mismas restricciones.
2. **Catálogo amplio; invocación selectiva.** Conserva las 154 facetas auditadas sin 154 llamadas por petición. Se refuta si la selección omite una obligación material o comparte contexto donde debía haber independencia.
3. **Aceptación por artefacto, propósito y versión.** Reutiliza pruebas válidas sin saltar controles. Se refuta con retracción, transformación semántica o cambio de finalidad que el consumidor no detecte.
4. **Propuestas del modelo, efectos del broker.** Ningún JSON del modelo puede autoatribuirse un recibo. Se refuta si existe una herramienta residual con efectos, un path escape, un permiso falsificable o un evento que salte autoridad.
5. **Aprendizaje evaluado y reversible.** Se refuta si la promoción puede alterar criterios de su propia prueba, aumentar autoridad, contaminar holdouts o degradar regresiones obligatorias.

Estas decisiones justifican implementación y ensayos, no un certificado de perfección. La auditoría de diez contraejemplos del runtime original aporta casos negativos para la reconstrucción; no acredita que el sistema nuevo ya los supere. [Pruebas del original](../audit/omega/probe-results.json)
