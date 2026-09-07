# Quórum, Paneles e Independencia

## 1. Quórum no equivale a verdad

No existe regla “n agentes de acuerdo = claim verdadero”. El quórum autoriza
una transición sólo cuando cada voto está respaldado por un rol/método
independiente y se satisfacen los predicates de evidencia.

## 2. Modos

| Caso | Regla |
|---|---|
| Claim M0/M1 | fuente/método suficiente + fact check proporcional |
| Claim M2 | Ω7 lineage + Ω11 + Ω12; Ω10 si múltiples fuentes |
| Claim M3 | Ω7 + Ω11 + Ω12 + Ω9 o Ω10 según naturaleza; challenge |
| Claim M4 | Ω7 + Ω9 + Ω10 + Ω11 + Ω12; cualquier hard fail bloquea |
| Causal M3/M4 | Ω8 + método independiente Ω9 + challenge Ω13/Ω15 |
| Quality M4 | dos instancias Ω22 con provider/context diversity; cualquier hard fail RETURN; material disagreement → third evaluator + Ω3 process review |
| Governance high risk | Ω21 + segunda persona/counsel; prohibited no se vota |
| Risk P0 | Ω19 veto permanece hasta release criteria; mayoría no lo levanta |
| Audit M4 | lead Ω3 + peer audit instance; caso sobre Ω3 → external/human oversight |
| Strategy | opciones comparadas; Ω17 recomienda; Ω1/humano decide, no mayoría |

## 3. Votos y dissent

Tipos: UNANIMITY sólo para release de hard controls especificados; MAJORITY
para preferencias no epistémicas reversibles; WEIGHTED sólo con pesos
pre-registrados por competencia y jamás reputación sola; EVIDENCE_QUORUM para
claims; ARBITER cuando métodos divergen; SOVEREIGN_OVERRIDE para acción
renunciable, no truth.

Toda opinión minoritaria material se serializa con claim/evidence/risk,
condición que la haría dominante y signer. Ω23 la lleva al mismo layer que la
decisión si cambia downside.

## 4. Multi-instancia

Un AgentRole puede tener múltiples AgentInstances. Independencia se puntúa por
model lineage, provider, prompt, method, context, evidence order, tool and
communication isolation. Dos instancias idénticas valen una ruta. El scheduler
evita common failure domain para M4.

## 5. Auditor del auditor

Ω3 no cierra unilateralmente auditorías M4 sobre su propia conducta. El caso se
preserva en AuditStore, un peer instance aislado reejecuta sample y oversight
humano resuelve conflicto. La selección de peer no la controla el audited
instance.

