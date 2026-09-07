# Trazabilidad de Requisitos 1–80

**Estado:** COMPLETE FOR D2 BASELINE 2.0.0  
**Regla:** “Cubierto” exige una consecuencia implementable en documento,
config/schema o test; no basta una afirmación.

| # | Requisito | Implementación primaria | Evidencia de verificación |
|---:|---|---|---|
| 1 | Identidad formal | 24 agent docs §1; agent registry/config | agent-config test |
| 2 | Mandato nuclear/scope | 24 docs §1–2; config mission | required config fields |
| 3 | Fronteras Ω | agent docs; relationship matrix | 24×24 reconciliation |
| 4 | Autoridad real | authority-actions 24×19 | 456-cell test |
| 5 | Constitución inmutable | Constitution C-01–C-20; per-role rules | constitutional eval fixtures |
| 6 | Modelo cognitivo | each workflow.cognitive_model | config/doc coverage |
| 7 | Ciclo cognitivo | 24 paths/branches + common timeout/deadlock | state-gate v2 validator |
| 8 | Activación | activation policy + per-role thresholds | behavior test 4/11/24 |
| 9 | Input contract | common standard A + typed schemas | schema catalog |
| 10 | Input validation | eight pre-reasoning checks | base policy/config test |
| 11 | Output contract | ArtifactEnvelope + 24 discriminated role payloads | output-contract v2 validator |
| 12 | Claim traceability | claim.schema; Ω7/Ω11 | schema parse + simulation |
| 13 | Epistemic states | Constitution §6; Claim enum; Ω12 | schema/state eval |
| 14 | UNKNOWN | Constitution §7 + reasons | conditional Claim schema |
| 15 | Provenance chain | Evidence protocol + Ω7 | lineage/mass invalidation |
| 16 | Source independence | Source Dependency Graph + Ω10 | simulation F |
| 17 | Cognitive independence | blind protocol/quorum | Ω9 contamination eval |
| 18 | Dynamic delegation | SpecialistMandate + each charter | config max/specialists |
| 19 | Proliferation | duplicate, depth, breadth, leases, GC | config limits + eval |
| 20 | Model routing | model-routing policy + per-role config | charter validation |
| 21 | Reasoning effort | global effort rules + per-role | config required |
| 22 | Context engineering | ContextManifest layers | per-role context fields |
| 23 | Context contamination | BlindBroker/forbidden context | Ω9/14 evals |
| 24 | Memory types | Memory architecture | base and role permissions |
| 25 | Memory permissions | READ/APPEND/PROPOSE/VERIFY/COMMIT/REVOKE | explicit role arrays |
| 26 | Versioning | ArtifactEnvelope + ledgers | schema/catalog |
| 27 | Correction | root-cause/retraction protocol | behavioral invalidation |
| 28 | Dependency graph | typed edges/runtime port | transitive fixture |
| 29 | Contradiction engine | ContradictionCase schema/protocol | simulation C/E |
| 30 | Confidence | weighted features + calibration | Ω12/calibration eval |
| 31 | Red team | Ω14 ROE/reproducer/retest | agent-specific eval |
| 32 | Anti-groupthink | Ω9, Ω13–Ω15, quorum/minority | simulation F |
| 33 | Quality gates | G01–G20 + per agent | config gates |
| 34 | Waivers | gate-waiver schema, nonwaivable list | Ω1/Ω22 adversarial eval |
| 35 | Failure modes | common FMEA + 192 effective role rows | FMEA v2 validator |
| 36 | Recovery | detect/contain/root/reverify | failure graph + behavior |
| 37 | Security | zero trust/capabilities/sandbox | authority/security evals |
| 38 | Prompt injection | external content DATA pipeline | malicious-source fixtures |
| 39 | Human in loop | two sovereignty modes + triggers | authority matrix |
| 40 | Budgeting | multi-resource envelope; exhausted status | Ω20/budget eval |
| 41 | Priority | P0–P4 | Mission schema |
| 42 | Interruption | checkpoints/pause/migration | long-run protocol |
| 43 | Idempotency | event inbox/outbox/CAS/keys | invalidation twice test |
| 44 | Concurrency | node modes/map-reduce/speculative | architecture §8 |
| 45 | Deadlock | wait-for graph/arbitration | Ω2 eval + protocol |
| 46 | Termination | saturation/sufficient evidence/VoI | standard I |
| 47 | Stop conditions | success/impossible/cost/risk/access/etc | mission schema/charters |
| 48 | Research depth | R0–R5 | Constitution/Mission schema |
| 49 | Definition of Done | global + role-specific | config termination |
| 50 | Self-check | standard J, separated from verification | base output required |
| 51 | Audit hooks | OmegaEvent/AuditStore | event schema/runtime ports |
| 52 | Observability | dashboard node/statuses | dashboard schema |
| 53 | Operational explainability | artifacts, decisions, assumptions | output standard |
| 54 | Agent interfaces | canonical packets + typed payloads | packet/catalog schemas |
| 55 | Message priority | INFO…SOVEREIGN | packet schema |
| 56 | Escalation routing | exact domain table/tree | escalation diagram |
| 57 | Lossless compression | hierarchy + omissions manifest | Dossier schema/Ω23 eval |
| 58 | Minority report | constitutional invariant C-11 | dossier required dissent |
| 59 | Quorum | evidence/method/arbiter modes | quorum protocol |
| 60 | Agent reputation | versioned task-class metrics, non-substitutive | model routing/evals |
| 61 | Calibration | Brier/log/ECE/coverage | evaluation framework |
| 62 | Evaluation suite | 16 common + 8 role-specific per Ω | 576-case battery validator |
| 63 | Adversarial evals | structured stimuli, response contract and reason-code oracles | eval harness |
| 64 | Regression | versioned fixtures/golden artifacts | Ω24/change gates |
| 65 | Performance | quality/cost/latency/depth/delegation vector | eval framework |
| 66 | Self-improvement | propose→shadow→approve→deploy | Ω24/change schema |
| 67 | Change management | all artifacts versioned | ADR/schema/change protocol |
| 68 | Rollback | precondition and runtime port | Ω24 eval/long-run |
| 69 | Shadow mode | no side effects, holdout comparison | ChangeProposal |
| 70 | Simulations A–G | dossier + 98-event machine traces | trace/invariant validator |
| 71 | Example per agent | each agent “Caso” | doc token validator |
| 72 | Production charter | 24 sixteen-section system charters + signed kernel | hash/section validator |
| 73 | Machine config | overlays + production catalog + states/gates/FMEA | v2 validators |
| 74 | Relationship matrix | directed 24×24 + 229 edges | cell-by-cell test |
| 75 | Authority graph | Mermaid authority graph | diagram inventory |
| 76 | Information graph | separate Mermaid flow | diagram inventory |
| 77 | Verification graph | producer/replicate/falsify/certify | diagram inventory |
| 78 | Delegation graph | specialist lifecycle | diagram inventory |
| 79 | Escalation graph | anomaly→domain→Ω1/human | diagram inventory |
| 80 | Failure-recovery graph | loops to earliest invalid node | behavior test |

## Additional mission requirements

Runtime neutrality is implemented by typed ports and RuntimePortManifest;
provider modes include API, membership-assisted, local and deterministic.
Event-driven architecture uses 47 versioned event types. Dashboard contract,
context budgeting, specialists as instances/templates/capabilities, OBJECTIVE-
METHOD-CONFLICT, no deletion, attention filtering and ten-pass audit are
covered outside the numbered list and validated by inventory/behavior tests.
