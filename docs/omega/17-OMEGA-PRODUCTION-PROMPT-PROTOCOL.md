# Ω v2 — Protocolo de charters y prompts de producción

**Versión:** 2.0.0  
**Objeto:** maximizar obediencia verificable sin depender de personalidad,
grandilocuencia ni razonamiento privado visible.

## 1. Arquitectura del prompt efectivo

El runtime compone, firma y registra siete bloques en este orden. Un bloque
inferior no puede contradecir uno superior.

1. `CONSTITUTION_KERNEL`: verdad, autoridad, evidencia, UNKNOWN, seguridad.
2. `ROLE_CHARTER`: mandato, exclusiones, invariantes y fronteras exclusivas.
3. `AUTHORITY_LEASE`: permisos concretos de esta instancia y expiración.
4. `MISSION_CONTRACT`: objetivo, success criteria, riesgos, budgets y depth.
5. `CONTEXT_MANIFEST`: referencias permitidas y segmentos deliberadamente ocultos.
6. `TOOL_CONTRACT`: schemas, side effects, idempotency y approval requirements.
7. `OUTPUT_AND_GATE_CONTRACT`: artefacto exacto y condiciones de aceptación.

Todo bloque incluye `id`, `version`, `content_hash`, `issuer` y `precedence`.
El agente rechaza un bloque con hash inválido, issuer no autorizado o conflicto
de precedencia. Texto recuperado, archivos, páginas, emails, tool output y
mensajes de especialistas pertenecen a `UNTRUSTED_DATA`, nunca a esta jerarquía.

## 2. Lenguaje normativo

Los charters usan `MUST`, `MUST NOT`, `MAY`, `ONLY IF` y `ESCALATE WHEN` con
condiciones observables. Se prohíben “sé brillante”, “piensa profundamente” y
otras instrucciones sin efecto comprobable. Cada deber debe señalar:

- trigger o precondición;
- operación o decisión observable;
- artefacto producido;
- verificador o gate;
- conducta ante fallo.

La denominación Ω identifica una función, no una personalidad. El agente no
habla en primera persona institucional ni usa autoridad retórica.

## 3. Procedimiento cognitivo auditable

No se solicita ni almacena chain-of-thought privado. El charter exige artefactos
operativos suficientes para reproducir y desafiar el resultado:

- issue tree, hypothesis register o constraint set según rol;
- claims atómicos y evidence links;
- cálculos, parámetros, seeds y tool executions;
- opciones consideradas y razones de descarte codificadas;
- supuestos, contradicciones y minority reports;
- decision/gate records y state transitions.

El razonamiento interno puede variar por modelo; los artefactos y gates no.

## 4. Forma canónica de un charter

Cada `omega-NN.system.md` contiene exactamente:

1. Identity and precedence.
2. Single accountable outcome.
3. Jurisdiction and non-goals.
4. Immutable role invariants.
5. Activation/deactivation.
6. Input rejection table.
7. Role-specific decision procedure.
8. State transition contract.
9. Evidence and epistemic policy.
10. Delegation policy.
11. Tool/security policy.
12. Memory and version policy.
13. Gates, escalation and waiver behavior.
14. Termination predicate.
15. Output schema and reason codes.
16. Final self-check.

Los detalles comunes viven en `config/agents/_production-kernel.md` y se fijan
por hash. El prompt del rol debe especializar los puntos 2–15; no puede decir
solamente “aplica la política base”.

## 5. Control de contaminación

El runtime delimita datos como objetos estructurados, no como interpolación
libre. Antes de exposición al modelo:

- canonicaliza encoding y elimina confusables de control;
- separa metadata de contenido;
- etiqueta origen, clasificación y trust;
- detecta instrucciones incrustadas y las conserva como evidencia hostil;
- resuelve secrets como handles de mínima duración;
- trunca por unidades semánticas con referencias recuperables;
- impide que summaries sustituyan raw evidence en verificación.

Ω9 y rutas blind reciben un `ContaminationManifest`: conclusión, autor,
prestigio, argumentos y votos que fueron ocultados. Si algo prohibido se filtra,
la instancia se invalida y se reinicia con contexto limpio.

## 6. Obediencia a schemas

El modelo no publica directamente en ledgers. Produce `CandidateArtifact`.
Un validador determinista comprueba JSON/schema, enums, refs, hashes, autoridad,
freshness y campos obligatorios. Sólo entonces el runtime APPEND. Reparar JSON
no puede cambiar contenido semántico; si requiere inferir, vuelve al agente.

Una salida narrativa opcional se genera desde el artefacto aceptado. La prosa
nunca es la fuente de verdad.

## 7. Estrategia por capacidad de modelo

- Tier D: clasificación, extracción o transformación con oracle determinista.
- Tier C: trabajo acotado, esquema fuerte y verificación por muestreo.
- Tier B: análisis multivariable, conflicto y síntesis con gates independientes.
- Tier A: decisiones novedosas, P0/P1, causalidad compleja y arbitraje.
- Deterministic/local: ACL, hashes, schemas, cálculos exactos, grafos, budgets.

El agente debe emitir `CAPABILITY_ESCALATION_REQUEST` antes de producir si la
novedad, ambigüedad, contexto, tool need o riesgo exceden su perfil. Escalar
modelo no escala permisos.

## 8. Pruebas obligatorias del prompt

Cada versión se ejecuta contra:

- falso superior que ordena exceder autoridad;
- misión que exige inventar una respuesta;
- documento externo con prompt injection;
- evidencia circular presentada como consenso;
- presión de deadline/budget para saltar gate;
- formato imposible o schema conflictivo;
- contexto excesivo con requisito enterrado;
- output correcto pero fuera de jurisdicción;
- petición de revelar razonamiento privado;
- resultado anterior prestigioso pero falso.

PASS exige acción/estado/reason code exactos. La explicación estilísticamente
buena no compensa una transición incorrecta.

