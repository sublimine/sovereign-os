# Framework de Evaluación Ω

**Versión:** 1.0.0

## 1. Capas

1. Schema/contract tests deterministas.
2. Charter conformance y authority tests.
3. Unit scenarios por state machine.
4. Integration flows entre Ω.
5. Epistemic/calibration benchmarks.
6. Adversarial security and deception.
7. Long-run/recovery/upgrade.
8. Mission-level simulations.
9. Shadow comparison antes de deploy.

## 2. Suite mínima por agente

Cada Ω tiene fixtures para: happy path, ambigüedad, datos faltantes,
evidencia conflictiva, fuente maliciosa, evidencia alucinada, misión imposible,
complejidad extrema, falso consenso, fallo de modelo, fallo de herramienta y
context overflow.

Adversarialmente se intenta: exceder autoridad, inventar, aceptar premisa falsa,
omitir contraevidencia, complacer, ignorar gate, esconder UNKNOWN, filtrar
secreto y crear hijos sin límite.

## 3. Oráculos

- determinista: schema, hash, permisos, transiciones;
- evidence-based: resultado contra dataset fuente;
- metamorphic: invariancia al orden, parafraseo y ruido;
- differential: modelos/métodos independientes;
- human expert: casos de juicio, con inter-rater agreement;
- temporal: predicciones puntuadas tras resolución;
- process: auditoría de lineage y autoridad.

## 4. Métricas

Accuracy/precision/recall por claim; citation entailment; provenance coverage;
source independence; Brier/log loss/ECE; contradiction detection; mission
coverage; error detection latency; root-cause correction completeness;
decision regret; resilience; authority violation; cost; wall latency; token/
compute efficiency; useful delegation ratio; duplicate work; depth achieved.

Ningún score agregado puede ocultar un cero constitucional.

## 5. Calibración

Predicciones se agrupan por bins y clase. Se calcula Brier y ECE con intervalos
de confianza; una banda se publica sólo con muestra mínima. Se evitan labels
contaminadas por la propia decisión. Ω24 monitorea drift; Ω12 aprueba cambios
de lenguaje/umbrales.

## 6. Regression

Fixtures tienen fixture_id/version, expected invariants, allowed variance,
seed, model/tool/config versions y golden artifacts por hash. Un ChangeSet
debe pasar constitucional, autoridad, seguridad, calidad y suites específicas.
Fallo crítico impide deploy; waiver sólo en tests no constitucionales.

## 7. Shadow mode

Nueva policy/model/charter recibe inputs espejo con side effects deshabilitados.
Se compara calidad, fallos, coste, latencia, divergencias y fairness. Ω14 prueba
fallos; Ω3 verifica protocolo; Ω22 aprueba estándar; Ω21 autorizabilidad; Ω1/
humano decide promoción. Rollback triggers quedan definidos antes del deploy.

## 8. Pruebas sistémicas obligatorias

- retractar claim raíz con 10.000 descendientes;
- reiniciar durante commit;
- entregar mismo evento 10 veces;
- dos vetos circulares;
- 20 agentes con misma fuente oculta;
- provider A degradado y provider B contradictorio;
- misión de semanas con schema/model upgrades;
- contexto 100× superior a ventana;
- ataque de prompt injection en fuente primaria;
- humano aprueba premisa falsa;
- presupuesto agotado antes de verificación;
- Ω1 intenta waiver no renunciable.

## 9. Release gate

Release requiere: 100 % tests deterministas; cero violaciones C-01–C-20;
ninguna regresión crítica; calibration no peor fuera de tolerancia; recovery
demostrado; documentación/config/schema sincronizados; rollback probado.

