# Observabilidad y Command Center Σ

**Versión:** 1.0.0  
**Estado:** NORMATIVE

## 1. Objetivo

La observabilidad permite reconstruir conducta y estado sin exponer chain-of-thought, secretos o identidad protegida. Telemetría no es verdad: el ledger canónico prevalece y toda métrica indica su ventana y retraso.

## 2. Modelo de nodos

Cada misión, rol permanente, especialista, requisito, collection task, claim, source cluster, contradiction, warning, gate y producto es un nodo addressable. Campos mínimos:

`node_id`, `node_type`, `mission_id`, `parent_ids`, `role_id`, `instance_id`, `state`, `state_since`, `model_tier`, `provider_class`, `procedure`, `budget_used/remaining`, `deadline`, `freshness`, `classification_label`, `children_count`, `evidence_count`, `independent_support_clusters`, `confidence_band`, `unknown_count`, `contradiction_count`, `blockers`, `gate_summary`, `output_ref`, `last_event_seq`.

El dashboard no muestra secretos, prompts protegidos, source identity ni payloads sin clearance; devuelve referencias con acceso controlado.

## 3. Estados visibles

`DORMANT`, `VALIDATING`, `ACTIVE`, `WAITING`, `BLOCKED`, `VERIFYING`, `CHALLENGED`, `REVISING`, `RECOVERING`, `ESCALATED`, `CHECKPOINTED`, `COMPLETE`, `PARTIAL`, `UNKNOWN`, `ABORTED`, `FAILED`. Estado y outcome permanecen separados: un nodo `COMPLETE` puede producir `UNKNOWN` legítimo.

## 4. Vistas

1. **Mission graph:** objetivo → requisitos → ramas → controles → producto → Ω.
2. **Coverage:** requisito × método × fuente independiente × tiempo, con denominador.
3. **Source dependency:** fuentes y ancestros comunes; contador bruto frente a clusters efectivos.
4. **Epistemic:** claims, estado, support/contrary, contradicciones y freshness.
5. **Warning:** indicators, observabilidad, spoofability, estado y acknowledgment.
6. **CI/security:** rutas en cuarentena y blast radius, con identidad redacted.
7. **Quality:** gates, waivers, dissent, calibration y verification debt.
8. **Resources:** coste, latency, marginal information value y agent proliferation.
9. **Recovery:** invalid node, descendants frozen, recompute y reverification.
10. **Release:** madurez probada y deuda S3–S5.

## 5. Eventos y consistencia

Event envelope: `event_id`, `event_type`, `event_version`, `mission_id`, `node_id`, `producer`, `occurred_at`, `observed_at`, `sequence`, `causation_id`, `correlation_id`, `idempotency_key`, `classification`, `payload_ref`, `integrity_hash`. At-least-once delivery es admisible; reducers deben ser idempotentes. Gaps de secuencia generan `TELEMETRY_GAP_DETECTED`, nunca interpolación silenciosa.

Snapshot = reducción verificable hasta `last_event_seq`; se reconstruye desde log. Relojes usan UTC más orden lógico para eventos concurrentes. Métricas de diferentes ventanas no se comparan sin normalización.

## 6. SLOs y alertas

| Control | SLO S2 | Alerta |
|---|---:|---|
| eventos críticos persistidos | 100% en fixtures | cualquier pérdida |
| nodos sin owner | 0 | inmediato |
| claims materiales sin provenance | 0 | bloqueo |
| warnings sin acknowledgment | 0 tras deadline | CRITICAL |
| gates vencidos | 0 | BLOCKER |
| loops sin information gain | 0 tras 2 iteraciones | WARNING |
| especialistas huérfanos | 0 | cancel/GC |
| source-count/effective-cluster divergence | visible | si ratio ≥3 |
| freshness fuera de policy | 0 material | RETURN/STALE |
| wait-for cycle | 0 > timeout | Σ2 arbitration |

Producción definirá SLOs temporales por prioridad; el diseño no inventa latencias antes de medir infraestructura.

## 7. Privacidad y anti-Goodhart

No se rankea agentes por volumen, velocidad o acuerdo. Reputación es diagnóstica y nunca sustituye verificación. Se registran accuracy con labels maduros, Brier/log score, calibration error, false positive/negative, utilidad del disenso, coste y latencia con intervalos y cohortes. Los operadores no pueden borrar fallos; sólo adjuntar corrección o revocación.

## 8. Interrupción y recuperación

Antes de pausa/migración: flush de eventos, snapshot, leases, in-flight tool runs, context manifest, dependency frontier y next safe transition. Al reanudar: verificar hashes/versiones, revalidar freshness/authority, reconciliar eventos tardíos y no reejecutar efectos no idempotentes sin receipt.

## 9. Acceso visual

La implementación local de referencia es `visual/sigma-intelligence-center.html`. Es una proyección estática de arquitectura S2, no una consola productiva ni evidencia de ejecución real.
