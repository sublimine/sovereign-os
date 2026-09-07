# Quality Gates Σ

## 1. Gate contract

`gate_id/version`, scope, condition, evaluator, evidence, threshold, outcome,
nonwaivable, waiver authority, release condition, deadline and audit refs.
Outcomes: PASS, FAIL, RETURN, ESCALATE, WAIVE. `PENDING` is state, not outcome.

## 2. Global nonwaivable gates

1. AUTHORITY: charter+lease+object+effect.
2. NO_FABRICATION.
3. MATERIAL_LINEAGE.
4. MATERIAL_DISSENT_VISIBLE.
5. SAFE_EFFECT/LEGALITY.
6. NO_SELF_CERTIFICATION.

## 3. Stage gates

| Stage | Hard evidence |
|---|---|
| requirement | decision ref, observable, closure, non-confirmatory framing |
| collection | authority, source handling, route independence, stop |
| intake | raw hash, safe parse, classification, quarantine decision |
| source | identity/channel/access/motivation + dependency graph |
| reality | ambiguity, temporal precision, measurement and provenance |
| analysis | alternatives, counterevidence, method, sensitivity |
| estimate | resolution, horizon, base rate, frozen commit |
| warning | preregistered indicator, freshness, spoofing, consumer/window |
| product | epistemic language, dissent, drill-down, security |
| closure | gaps, downstream ACK, review triggers, continuity |

## 4. Quorum

No universal vote. M0/M1 may use producer+self-check+proportional reviewer.
M2 requires distinct reviewer. M3 requires method/source independence plus Σ38.
M4 requires multiple independent routes, Ω truth controls and no hard dissent
suppression. Any hard fail returns regardless of average score.

## 5. Waiver

`WaiverRecord` names precise gate, evidence unavailable, reason, risk accepted,
decision owner, compensating controls, affected artifacts, expiry and review.
Waiver cannot change claim state or make missing evidence exist.

