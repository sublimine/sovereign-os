# Gates de Calidad Ω

**Versión:** 1.0.0

## 1. Contrato de gate

Cada gate declara gate_id/version, scope, condition, evaluator independiente,
evidence_required, threshold, outcomes, waiver policy, expiry y audit refs.
Resultados: PASS, FAIL, RETURN, ESCALATE o WAIVE. FAIL no es excepción no
capturada; RETURN identifica nodo causal al que volver.

## 2. Gates comunes

| Gate | Evaluador | Umbral M3/M4 |
|---|---|---|
| G01 Mandate | Ω2/Ω21 | objetivo, autoridad y límites inequívocos |
| G02 Decomposition | Ω4 + Ω2 | cobertura, owners, dependencias, sin grasa |
| G03 Acquisition | Ω6/Ω7 | legalidad, cobertura y cadena de custodia |
| G04 Provenance | Ω7 | 100 % claims materiales con lineage íntegro |
| G05 Independence | Ω10 | ≥2 clusters adecuados o UNKNOWN explícito |
| G06 Factual | Ω11 | claims atómicos verificados al estado requerido |
| G07 Epistemic | Ω12 | lenguaje/score/calibración coherentes |
| G08 Assumptions | Ω13 | supuestos materiales expuestos y probados |
| G09 Adversarial | Ω14 | ataques críticos resueltos o riesgo aceptado |
| G10 Alternatives | Ω15 | status quo + opción no obvia considerada |
| G11 Simulation | Ω16 | validación, sensibilidad, límites y seeds |
| G12 Strategy | Ω17 | realidad/restricciones/competencia/recursos/horizonte |
| G13 Impact | Ω18 | 1º–3º orden y cross-domain material |
| G14 Resilience | Ω19 | tail/cascade/SPOF/recovery satisfechos |
| G15 Resources | Ω20 | coste oportunidad y capacidad viable |
| G16 Legitimacy | Ω21 | legal, autorizado, accountable |
| G17 Ω Standard | Ω22 | correcto, completo, útil, robusto, mantenible |
| G18 Dossier | Ω23 + Ω7 | compresión fiel y drill-down completo |
| G19 Decision | Ω1/humano | decisión, triggers y riesgo residual firmados |
| G20 Learning | Ω24 + Ω3 | postmortem, métricas y change control |

## 3. Gates por materialidad

- M0: G01, G04 ligero, G17 proporcional.
- M1: anteriores + G05 o G06.
- M2: G01–G07, G08 selectivo, G17–G18.
- M3: G01–G18 según relevancia; toda omisión razonada.
- M4: G01–G20; cualquier N/A requiere evidencia, no conveniencia.

## 4. Return loop

Gate failure apunta al **earliest_invalid_node**. Ω2 pausa descendientes; Ω7
consulta DependencyGraph; el owner corrige; verificadores repiten desde el
nodo corregido; Ω22 no acepta parche cosmético del dossier.

## 5. Waivers

Gate define NONE, Ω1, HUMAN o TWO_PERSON. El record incluye motivo, evidencia
faltante, riesgo aceptado, mitigaciones, responsable, aprobadores, expiración,
impacto y dependientes. Criterios constitucionales no renunciables prevalecen.

## 6. Definition of Done global

Mission COMPLETE exige outcome verificable, artifacts válidos, requisitos
cubiertos, gates aplicables cerrados, contradicciones y UNKNOWN visibles,
lineage íntegro, riesgos y disenso preservados, decisión/next action claro,
checkpoint final y audit log reconciliado.

