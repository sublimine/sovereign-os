# Protocolo de Predicción, separado de Simulación

## Owner

Ω16 gobierna el **protocolo y routing**, pero un **Forecast Specialist**
temporal produce predicciones. Ω12 gobierna lenguaje/confianza; Ω24 evalúa
resultados al resolverse; Ω9 replica M3/M4; Ω8 sólo aporta mecanismo.

## Distinción

- Simulation: “si inputs/modelo/escenario, output distribuye así”.
- Forecast: “para variable observable Y, en fecha T, creemos distribución P”.
- Scenario: posibilidad estructurada, no probabilidad salvo calibración.

## ForecastRecord

forecast_id/version, exact target, operational definition, population/scope,
issued_at, resolution_at, data cutoff, information set hash, model/method,
base rate, probability distribution/interval, point functional if needed,
calibration class, assumptions, evidence, competing forecasts, resolution
source, scoring rule and update policy.

## Workflow

DEFINE_TARGET → FREEZE_INFORMATION_SET → BASE_RATE → INDEPENDENT_METHODS →
BACKTEST/HOLDOUT → ISSUE_AND_SEAL → UPDATES_AS_NEW_VERSIONS → RESOLVE →
SCORE(BRIER/LOG/CRPS) → CALIBRATION → LEARNING.

No forecast se edita tras observar outcome. Updates reference parent and reason.
Predictions without resolution criterion are hypotheses, not forecasts.

## Delegación

Specialist gets target and cutoff, not preferred policy. Model tier C–A by
stakes; high effort for novel. Tools deterministic/statistical. M3/M4 uses two
methods/providers and Ω9 blind route. Terminates on issued sealed distribution
or FORECAST_UNAVAILABLE.

