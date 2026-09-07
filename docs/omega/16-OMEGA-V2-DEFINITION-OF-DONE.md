# Ω v2 — Contrato verificable de terminación

**Estado:** normativo  
**Versión:** 2.0.0  
**Propietarios:** Ω2 ejecución, Ω3 auditoría, Ω22 certificación, Ω1 aceptación

## 1. Propósito

Este contrato impide declarar completo un agente por extensión textual, número
de títulos o apariencia profesional. Un Ω está terminado únicamente si puede
ser instanciado, limitado, observado, interrumpido, evaluado y reconstruido sin
inventar decisiones operativas que el diseño dejó ambiguas.

La excelencia absoluta no es una propiedad autodeclarable. La versión se
certifica contra capacidades, invariantes y evidencia de evaluación explícitas.
Las afirmaciones de superioridad no verificables están prohibidas.

## 2. Gate de completitud individual `AGENT_READY_V2`

Cada Ω debe satisfacer simultáneamente los siguientes controles. `N/A` exige
justificación machine-readable y aprobación de Ω3; no equivale a silencio.

| Dimensión | Evidencia obligatoria | Umbral PASS |
|---|---|---|
| identidad | overlay + especificación | jurisdicción, propósito, ausencia-failure y superior inequívocos |
| separación | matriz de fronteras | todo solapamiento material asigna productor, validador, challenger, certifier y decider |
| autoridad | closure de acciones | las 19 acciones soberanas están ALLOW, CONDITIONAL, DENY o APPROVAL; default deny |
| invariantes | prompt + policy | al menos siete globales y cuatro específicas, comprobables por eval |
| activación | reglas deterministas | eventos, thresholds, exclusiones y deactivation; sin activación permanente implícita |
| cognición | decision procedure | entradas, operaciones, branches, criterio de revisión y artefactos intermedios |
| estados | transition table | initial, guards, actions, waits, retries, timeouts y todos los terminales |
| inputs | contratos tipados | productor, schema/version, obligatoriedad, TTL, clasificación, provenance y hash |
| outputs | schema resoluble | resultado, claims, evidencia, UNKNOWN, disenso, riesgos, dependencias y next action |
| epistemología | política aplicable | ningún número libre de confianza; state transition y reason codes explícitos |
| delegación | SpecialistMandate | los 17 campos, límites de proliferación, lease y verificación definidos |
| contexto | manifest | always/mission/retrieved/evidence/history/forbidden y blind controls |
| memoria | ACL | READ/APPEND/PROPOSE/VERIFY/COMMIT/REVOKE por store; no write ambiguo |
| gates | gate specs | condition, evaluator, evidence, threshold y seis outcomes |
| waiver | política | waivable/non-waivable; record y expiry; ningún bypass silencioso |
| FMEA | registro | fallos basales heredados + al menos ocho específicos con D/C/R/R/E |
| seguridad | capability profile | tools, filesystem, network, code, secrets, effects y human approval |
| presupuesto | límites | token/compute/time/children/API y BUDGET_EXHAUSTED seguro |
| concurrencia | política | parallel/sequential/quorum/speculative y conflictos de commit |
| terminación | predicado | success/saturation/unknown/impossible/unsafe/access/budget/authority |
| observabilidad | eventos | toda transición, tool call, coste, child y artefacto son correlacionables |
| prompt | charter de producción | precedencia, mandato, algoritmo, límites, contratos y self-check sin roleplay |
| evals | fixtures ejecutables | 16 basales + 8 específicas; todas con oracle/assertions, no sólo nombres |
| caso | trace completo | mission→inputs→states→children→gate→conflict→output→audit |

## 3. Profundidad útil, no duplicación

La política común se hereda por referencia inmutable y hash. No se copian 24
veces reglas idénticas porque la divergencia silenciosa sería un riesgo. Cada
overlay debe, sin embargo, demostrar cómo esa regla cambia el comportamiento
del agente. Una referencia sin especialización operacional no cuenta.

El presupuesto de contexto de producción no incluye la documentación completa.
El runtime compila un `EffectiveCharter` mínimo desde:

1. Constitución y versión fijada;
2. base policy y prompt kernel fijados;
3. overlay exclusivo del agente;
4. authority lease de la instancia;
5. MissionPacket y referencias lazy-load;
6. output schema y gate manifest aplicables.

## 4. Gate de sistema `OMEGA_SYSTEM_READY_V2`

El departamento no está terminado aunque los 24 overlays validen si falla
cualquiera de estas condiciones:

- relationship matrix sin doble autoridad incompatible;
- toda capacidad requerida tiene exactamente un accountable owner;
- producer y único certifier nunca son la misma instancia;
- Evidence/Claim/Decision ledgers soportan retraction transitiva;
- decisiones de efecto externo pasan por Policy Decision Point determinista;
- eventos usan outbox/idempotency y permiten replay desde snapshot;
- una caída de modelo, store o scheduler tiene failover definido;
- un input hostil no puede elevar autoridad ni escribir verdad institucional;
- misiones largas sobreviven cambio de modelo y migración de máquina;
- dashboard reconstruye estado desde eventos, no desde memoria conversacional;
- simulaciones A–G producen event traces y resultados verificables;
- diez pasadas de auditoría tienen finding, disposition y evidence.

## 5. Niveles de evidencia de madurez

| Nivel | Significado | Prohibición comunicativa |
|---|---|---|
| D0 DESIGN | contrato escrito, todavía no validado | no decir “funciona” |
| D1 STATIC_VALIDATED | schemas y consistencia pasan | no decir “se comporta” |
| D2 DETERMINISTIC_TESTED | enforcement y fixtures deterministas pasan | no decir “LLM fiable” |
| D3 MODEL_EVALUATED | evals ejecutadas por modelo/tier y versión | no generalizar fuera de suite |
| D4 SHADOW_VALIDATED | misiones reales sin autoridad decisional | no autorizar efectos |
| D5 PRODUCTION_CALIBRATED | outcomes, drift, incidentes y rollback medidos | no afirmar perfección |

La documentación puede alcanzar D1/D2 localmente. D3–D5 requieren proveedores,
datasets, humanos autorizados y tiempo operacional; cualquier ausencia se
registra como `VALIDATION_DEBT`, nunca se oculta como éxito.

## 6. Definition of Done del programa

`DONE` requiere un `CertificationRecord` firmado por Ω22 y auditado por Ω3 que
liste por agente: versiones efectivas, hashes, test report, excepciones,
validation debt, riesgo residual y última fecha de revisión. Ω1/humano acepta
el riesgo residual; no puede convertir un test fallido en PASS. Sólo puede
emitir un waiver permitido, temporal y visible.

