# Matriz de Relaciones Σ

**Fuente:** `config/sigma/relationships.json`  
**Dimensión lógica:** 40×40 dirigida; 507 edges relevantes.

## 1. Tipos

`COMMANDS` sólo tasking/prioridad; `REPORTS_TO` administrativo; `REQUESTS`
consume artefacto tipado; `FEEDS` produce dependencia; `VERIFIES` evalúa;
`AUDITS` reconstruye; `CHALLENGES` busca fallo; `BLOCKS` aplica gate;
`ESCALATES_TO` transfiere autoridad; `INDEPENDENT_FROM` prohíbe contaminación.

La ausencia de edge es ausencia de relación, no permiso implícito. Relaciones
opuestas no se infieren por simetría salvo `INDEPENDENT_FROM` declarado en
ambos sentidos.

## 2. Separaciones críticas

Las 17 separaciones bidireccionales están fijadas y testeadas:

```text
Σ3 requirements        ⟂ Σ5 consumer intent
Σ4 coverage            ⟂ Σ6 collection execution
Σ7 access              ⟂ Σ15 source reliability
Σ9 handling            ⟂ Σ30 counterintelligence
Σ13 source protection  ⟂ Σ17 provenance
Σ14 admission          ⟂ Σ24 fusion
Σ15 source quality     ⟂ Σ16 source independence
Σ18 entity identity    ⟂ Σ20 network construction
Σ19 chronology         ⟂ Σ27 causality
Σ24 fusion             ⟂ Σ36 dissent custody
Σ28 hypotheses         ⟂ Σ32 estimate commit
Σ29 target deception   ⟂ Σ30 internal compromise
Σ32 estimate           ⟂ Σ33 warning
Σ33 indicators         ⟂ Σ34 strategic surprise
Σ35 opportunity        ⟂ Σ37 product framing
Σ37 product            ⟂ Σ38 quality
Σ38 process quality    ⟂ Σ40 outcome utility
```

Independencia significa rutas/contextos/permisos separados hasta artifact
commit, no prohibición de reconciliación posterior.

## 3. Reglas contra circularidad

- Un producto no puede ser soporte originario de sus propios claims.
- Feedback Σ40 no cambia retrospectivamente estimate/product source.
- Knowledge graph indexa claims; no se cita a sí mismo como evidencia.
- Source assessment puede usar outcomes previos, pero no la conclusión actual.
- Dissent puede provocar reanálisis; el reanálisis no elimina el dissent record.
- Warning puede solicitar colección; la ausencia creada por ese tasking no
  demuestra la hipótesis alertada.

El validador construye el grafo y rechaza endpoints, tipos, duplicados y
separaciones protegidas ausentes.

