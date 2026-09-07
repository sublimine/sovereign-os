# Arquitectura de Colección All-Source

## 1. Principio

Colección es un portfolio de mecanismos de observación, no una lista de URLs.
Cada ruta se evalúa por acceso, legalidad, directness, uniqueness, latency,
coverage, deception exposure, reproducibility, handling, cost y expected yield.

## 2. Disciplinas abiertas

Open records, archival, documentary, expert elicitation, partner reports,
technical telemetry, public digital traces, licensed datasets, geospatial,
imagery, surveys, experiments y proxies. Los nombres no conceden autoridad;
cada operación debe cumplir policy. No existe acceso clandestino implícito.

## 3. CollectionTask

Incluye requirement/observable, query/sampling protocol, legal basis, source
scope, exclusions, tool allowlist, identity/compartment handling, budget,
deadline, retries, output schema, negative result semantics, stop, verification
y sponsor. Un task sin negative-result semantics no puede sustentar ausencia.

## 4. Portfolio

- Rutas paralelas para cobertura.
- Rutas blind para independencia.
- Ruta primaria + proxy para denial.
- Control negativo para artefactos de medición.
- Canary/honeypot defensivo sólo con aprobación para detectar contaminación.
- Reserve route no revelada al posible deceiver.

Σ6 no declara una ruta independiente: Σ16 mide después. Σ4 calcula coverage
ajustado y Σ12 recupera gaps.

## 5. Saturación

Stop exige search-space protocol, nuevas fuentes/claims por unidad de coste,
coverage de hipótesis, critical gaps, time value y rendimiento marginal. Cero
resultados sin denominador es `NOT_FOUND`, no `NONEXISTENT`.

## 6. Escala

Task shards por source/domain/time/keyspace; checkpoint cursor; dedup por raw
hash y semantic fingerprint; rate-limit; provenance por batch y record; sample
audit; backpressure. Shard completion no implica mission completion hasta
reduce de coverage/dependency.

