# Definition of Done — Departamento Σ v1

**Versión:** 1.0.0  
**Regla:** longitud, elegancia o cantidad de agentes no equivalen a completitud.

## 1. SIGMA_AGENT_READY

Cada uno de los 40 roles debe tener:

1. identidad, jerarquía, jurisdicción y fallo de ausencia;
2. accountable outcome y artefacto primario exclusivos;
3. in/out/conditional scope y fronteras materiales;
4. 24 acciones de autoridad con P/C/X/A y condición;
5. invariantes globales + mínimo seis específicas;
6. algoritmo cognitivo role-specific, no adjetivos;
7. state machine con initial, loops, waits, timeout, blocked, escalation y terminales;
8. activation/deactivation y negative triggers;
9. contratos input/output versionados;
10. rejection table antes de razonar;
11. política de evidencia/UNKNOWN/confianza/independencia;
12. context manifest con contenido forbidden/blind;
13. memoria READ/APPEND/PROPOSE/VERIFY/COMMIT/REVOKE;
14. delegación completa, límites y specialist outputs;
15. model/tool/reasoning routing y quality escalation;
16. gates con outcomes PASS/FAIL/RETURN/ESCALATE/WAIVE;
17. FMEA D/C/R/R/E para mínimo ocho fallos específicos;
18. seguridad, prompt injection, secretos y human approval;
19. termination predicate, saturation y stop reasons;
20. caso realista completo y output machine-readable;
21. charter de producción hash-fijado;
22. overlay machine-readable enlazado al charter;
23. mínimo 16 evals comunes + 8 role-specific con oracle;
24. self-check separado de verificación independiente.

Un solo elemento ausente bloquea `SIGMA_AGENT_READY`.

## 2. SIGMA_SYSTEM_READY

- Constitución y precedencia.
- 40/40 agents ready.
- Capability map y minimality/capability-gap tests.
- Authority matrix 40×24 cerrada default-deny.
- Relationship matrix 40×40 dirigida y reconciliada.
- Interfaces Ω↔Σ y límites con futuros departamentos.
- Requirements, collection, source, analysis, warning, CI, product y feedback loops.
- Schemas de todos los artefactos decisivos.
- Source dependency, knowledge, hypothesis y decision dependency graphs.
- Context contamination, blind routes y compartments.
- Memory, versioning, retraction y long-run recovery.
- State machines, gates, FMEA, model routing y observabilidad.
- Event catalog e idempotencia.
- Simulaciones con traces y no-autocertificación.
- Auditoría adversarial y correcciones en archivos.
- Release certification con límites y deuda explícitos.

## 3. Escala de madurez

| Nivel | Evidencia | Prohibición de claim |
|---|---|---|
| S0 DOCUMENTED | documentos existen | no decir implementable |
| S1 STATIC_VALIDATED | JSON/schemas/refs/matrices pasan | no decir comportamiento |
| S2 DETERMINISTIC_TESTED | kernels/oracles/traces deterministas pasan | no decir LLM fiable |
| S3 MODEL_EVALUATED | suite ejecutada por modelo/tier/version | no extrapolar fuera de suite |
| S4 SHADOW_VALIDATED | misiones replay/shadow, faults y seguridad | no autorizar decisión real |
| S5 OPERATIONALLY_CALIBRATED | outcomes, drift, auditoría independiente | no decir infalible |

El diseño local puede alcanzar S2. S3–S5 requieren proveedores, tiempo,
infraestructura, labels externos y auditoría independiente.

## 4. Criterios cuantitativos mínimos S2

- 40 hashes de charters válidos y únicos.
- 960 decisiones de autoridad explícitas.
- 40 payloads discriminados.
- 40 state machines y 40 gate sets.
- ≥320 FMEA role-specific D/C/R/R/E.
- 960 evals efectivas: (16 comunes + 8 específicas) × 40.
- ≥10 simulaciones, incluidas deception, false consensus, warning miss,
  compromised source, entity conflation, stale estimate, leakage y surprise.
- cero self-certification en artefactos materiales.
- cero placeholders, referencias huérfanas o claims de madurez superior.

## 5. Final review

La certificación debe responder: qué está probado; qué sólo está especificado;
qué fallaría primero a 100×; qué depende de humanos/proveedores; qué riesgos no
pueden eliminarse; y quién debe cerrar cada deuda. Si la respuesta oculta una
limitación para parecer más avanzada, el release falla S-02 y S-22.

