# Protocolo de Fuentes, Dependencia, Engaño y Denial

## 1. Modelo de fuente

Una “fuente” se separa en originator, observer, recorder, publisher, channel,
aggregator y access route. `SourceAssessment` mide autenticidad, acceso,
competencia, condiciones de observación, motivación, sinceridad, history y
vulnerabilidad. Ninguna etiqueta se aplica automáticamente al claim.

## 2. Dependency graph

Edges: PRIMARY_OBSERVATION, DERIVED_FROM, QUOTES, SYNDICATED_FROM,
DUPLICATE_OF, TRANSLATES, SHARED_DATASET, SHARED_METHOD, COMMON_ACCESS,
COORDINATED_WITH y PARTIAL_DEPENDENCE. Edges son claim-specific, temporalizados
y probabilísticos cuando inferidos.

Effective support se calcula por clusters/métodos y calidad; no source count.
Errores distintivos, orden temporal y texto ayudan a detectar laundering.

## 3. Deception model

Campos: target belief, actor capability/access, objective, observables
controlables, narrative, channels, costs, inconsistencies, hard-to-fake
discriminants, benign/error alternatives, collection plan y residual risk.

Σ29 analiza adversario externo; Σ30 compromiso interno. Attribution requiere
capacidad, oportunidad, linkage y alternativas, no sólo “quién se beneficia”.

## 4. Denial y evidencia negativa

Ausencia sólo informa si la observación habría sido probable bajo la hipótesis.
Se registra observability model, collection success probability, concealment,
latency y false-negative rate. Access failure jamás se convierte en ausencia.

## 5. Fuente comprometida

Contain: freeze nuevos commits, no destruir acceso/logs; scope artifacts; open
CI case; recompute dependency/source assessment; invalidate descendants;
reacquire orthogonal route; notify consumers; republish. Una fuente puede estar
comprometida parcialmente por periodo/claim; no se descarta todo sin análisis.

