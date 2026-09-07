# Sistema de Indications, Warning y Vigilancia Persistente

## 1. Distinciones

- Indicator: observable predefinido que actualiza hipótesis.
- Signpost: cambio cualitativo/condicional relevante.
- Watch: obligación persistente de evaluar eventos.
- Advisory: cambio relevante sin threshold crítico.
- Warning: juicio accionable con ventana y severidad.
- Critical alert: threshold autorizado con daño/oportunidad temporal material.

Estimate Σ32 alimenta, pero Σ33 decide si se cumplen reglas de warning. Warning
no decide respuesta. Σ34 busca fallos fuera del set de indicadores conocido.

## 2. Indicator contract

`indicator_id`, hypothesis/requirement refs, observable, baseline, direction,
threshold, combination rule, source routes, observability, freshness, spoofing
risk, false-positive/negative cost, authorized consumers, review cadence,
resolution rule y owner.

Threshold puede ser hard, Bayesian, sequential o qualitative multi-signal. Un
modelo adaptable registra versión y no aprende con el evento ya observado sin
marcar leakage.

## 3. Event processing

```text
EVENT
→ integrity/freshness
→ entity/time normalization
→ source/deception check
→ indicator evaluation
→ threshold aggregation
→ independent duty review for M3+
→ NOTICE/ADVISORY/WARNING/CRITICAL
→ authorized dissemination
→ ACK and decision-window tracking
```

P0 preemption reduce latencia, no elimina comprobaciones de identidad,
integridad, spoofing y autoridad. Si no hay tiempo para corroborar, alerta se
emite como `UNVERIFIED_CRITICAL_SIGNAL` con limitaciones, nunca VERIFIED.

## 4. Warning failure ledger

Cada hit, false alarm, near miss y miss conserva versión de indicadores,
observaciones disponibles en ese momento, latency, consumer receipt/action y
contrafactual de detectabilidad. Se prohíbe hindsight que use datos posteriores.

## 5. Handover

Σ39 transfiere active watches, last evaluated cursor, pending events, stale
sources, triggered-but-unresolved indicators, consumer status y next deadline.
No hay watch “en la memoria del agente”.

