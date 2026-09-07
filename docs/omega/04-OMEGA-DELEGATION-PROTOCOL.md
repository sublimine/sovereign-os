# Protocolo de Delegación y Especialistas Temporales

**Versión:** 1.0.0

## 1. Distinciones

- **AgentCapability:** capacidad abstracta, p. ej. extracción de tablas.
- **AgentRole:** autoridad permanente Ω o departamental.
- **AgentTemplate:** charter reutilizable sin ejecución viva.
- **AgentInstance:** ejecución con identidad, lease, budget y estado.

Reutilizar una template no significa compartir memoria ni independencia.

## 2. Taxonomía abierta

Familias iniciales: research specialist, domain expert, source hunter,
archivist, data extractor, data analyst, statistician, causal analyst,
forecaster, simulator, software engineer, systems engineer, security
specialist, legal analyst, compliance analyst, financial analyst, procurement
analyst, verifier, forensic auditor, red teamer, assumption hunter,
counterfactual analyst, translator, documentation specialist y evaluator.

Una especialidad inédita se expresa como capabilities + constraints; no exige
añadir un rol Ω permanente.

## 3. Flujo de creación

~~~text
NEED_DETECTED
→ CAPABILITY_GAP_DEFINED
→ REGISTRY_SEARCH
→ REUSE_TEMPLATE | GENERATE_DERIVED_CHARTER
→ CONFLICT_AND_DUPLICATE_CHECK
→ MODEL_TOOL_CONTEXT_ROUTE
→ POLICY_AUTHORIZE
→ SANDBOX
→ SPAWN_WITH_LEASE
→ EXECUTE_AND_CHECKPOINT
→ SELF_CHECK
→ INDEPENDENT_VERIFICATION_IF_MATERIAL
→ RETURN_ARTIFACT
→ TERMINATE_INSTANCE
→ RETAIN_OR_RETIRE_TEMPLATE
~~~

## 4. SpecialistMandate

Campos obligatorios:

| Campo | Regla |
|---|---|
| spawn_trigger | Evento y condición verificable. |
| specialist_type/capabilities | Capacidad exacta; tipo puede ser nuevo. |
| mission | Una pregunta o deliverable acotado. |
| context_scope | IDs autorizados y máximo de contexto. |
| context_exclusions | Conclusiones blind, secretos, fuentes o instrucciones prohibidas. |
| tools | Allowlist y parámetros de seguridad. |
| permissions | Read/write/effect capabilities default deny. |
| model_tier | Mínimo/máximo y diversidad requerida. |
| reasoning_effort | low/medium/high/maximum con trigger. |
| budget | Tokens, compute, wall time, API, especialistas hijos. |
| max_children/max_depth | Límite duro; default children=0. |
| deadline | UTC o condición de evento. |
| output_schema | ID y versión exacta. |
| verification_policy | Self-check y verificador independiente. |
| termination_condition | Saturación, éxito, timeout, riesgo o imposibilidad. |
| memory_policy | Scopes, TTL y promoción prohibida/permitida. |
| sponsor | Ω responsable de utilidad y coste. |

## 5. Control de proliferación

Antes de spawn, el **DuplicateWorkDetector** compara objetivo normalizado,
capabilities, evidence scope y output schema. Similitud alta produce REUSE,
JOIN o MERGE. Límites:

- profundidad normal ≤2 desde Ω; R5 puede llegar a 4 con aprobación Ω4/Ω20;
- breadth por sponsor definido en config; expansión >2× exige replan;
- cada hijo consume reserva del padre; no crea presupuesto;
- un especialista no crea hijos por defecto;
- templates se reutilizan; instancias y working memory no;
- scheduler cancela ramas dominadas, duplicadas o sin valor decisional;
- garbage collector termina leases huérfanos y preserva artifacts/audit.

## 6. Independencia cognitiva

Cuando el objetivo sea validación:

- proveedor o familia de modelo distinta cuando sea posible;
- charter/método distinto;
- evidence order aleatorizado y registrado;
- no revelar conclusión ni confianza original;
- herramientas o dataset alternativos;
- comunicación entre rutas bloqueada hasta commit;
- reconciliación sólo después de artifacts firmados.

La independencia obtiene un score de Ω10; nunca se asume por contar agentes.

## 7. Presupuestos

El envelope cubre token, compute, time, external_api, human_attention y child
count. Alertas al 60/80/95 %. Al 100 % la instancia checkpointa y devuelve
BUDGET_EXHAUSTED con cobertura, brechas y valor esperado de extensión. No
infiere lo que no pudo comprobar.

## 8. Terminación y destrucción

“Destruir agente” significa revocar lease, credenciales y acceso de la
instancia. Nunca elimina evidencia, logs o outputs. El sponsor solicita;
runtime ejecuta. Acciones con side effects primero compensan o transfieren
ownership. Estado final: COMPLETE, PARTIAL, UNKNOWN, ABORTED o FAILED.

## 9. Evaluación de templates

Retener template requiere outputs válidos, cero violaciones, valor recurrente
y métricas suficientes. Reputation registra accuracy, calibration, FP/FN,
coste, latencia y disagreement quality; influye routing, no verdad. Un template
degradado pasa a SHADOW, luego RETIRED si no recupera.

## 10. Especialistas permitidos por Ω

Cada charter declara familias y límites. Regla de frontera: un Ω puede crear
analistas que sirvan a su jurisdicción, no una copia de otro Ω. Por ejemplo,
Ω17 puede crear evaluadores de opciones, pero no un “certificador de verdad”
que eluda Ω9–Ω12.

