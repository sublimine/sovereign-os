# Protocolo de Requisitos de Inteligencia

## 1. Cadena de derivación

```text
Sovereign decision need
→ consumer decision model
→ uncertainty inventory
→ PIR
→ EEI/subquestion
→ observable/indicator
→ collection or analytic task
→ satisfaction evidence
→ decision relevance test
```

Cada edge declara por qué la respuesta podría cambiar opción, timing, riesgo o
confianza. Un requisito que no cambia nada se elimina o baja prioridad.

## 2. PIR bien formado

Campos: question; decision_ref; owner; horizon; geography/domain; atomic scope;
candidate answers; unknown code; observable model; evidence needed; forbidden
shortcuts; independence; freshness; materiality; closure; reopen triggers.

No se aceptan “investiga todo”, “demuestra X”, “encuentra datos positivos” o
preguntas sin unidad/población/tiempo cuando esos campos cambian significado.

## 3. Satisfacción

Estados: NOT_STARTED, PARTIAL, SATISFIED, SATURATED_UNKNOWN, BLOCKED_ACCESS,
UNIDENTIFIABLE, STALE, SUPERSEDED. `SATISFIED` requiere evidencia sobre cada
candidate answer material, counterevidence search, coverage threshold y Σ38.

## 4. Valor de información

Priority no es “interés”. Usa decision sensitivity, probability of changing
choice, cost of error, time decay, acquisition cost, risk y independence gain.
Σ4 protege reservas de falsación, CI y sorpresa incluso cuando la respuesta
preferida parece clara.

## 5. Drift

Σ5 compara decisión vigente; Σ3 diff de requisitos; Σ2 invalida ramas sin
contribución. Cambio de método no cambia objetivo. Cambio de objetivo requiere
MissionDelta autorizado y notificación a todo consumer de artefactos previos.

