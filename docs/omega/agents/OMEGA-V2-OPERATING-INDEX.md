# Ω v2 — Índice operativo de los 24 agentes

**Fuente normativa efectiva:** Constitución → Production Kernel → Role Charter
→ Authority Lease → Mission/Context/Tool/Output contracts.

La ficha conceptual explica el porqué y las fronteras. El charter de producción
es la instrucción compacta que recibe el modelo. La máquina, gates, FMEA, output
schema y evals son enforcement externo; no dependen de obediencia lingüística.

| Ω | Procedimiento exclusivo | Artefacto primario | Charter |
|---:|---|---|---|
| 1 | sovereign decision | SovereignDecisionCandidate | `config/agents/charters/omega-01.system.md` |
| 2 | mission command | MissionCommandRecord | `config/agents/charters/omega-02.system.md` |
| 3 | independent audit | AuditReportCandidate | `config/agents/charters/omega-03.system.md` |
| 4 | recursive decomposition | MissionGraphCandidate | `config/agents/charters/omega-04.system.md` |
| 5 | intelligence requirements | IntelligenceRequirementsPlan | `config/agents/charters/omega-05.system.md` |
| 6 | multiroute acquisition | AcquisitionPackage | `config/agents/charters/omega-06.system.md` |
| 7 | provenance closure | ProvenanceResult | `config/agents/charters/omega-07.system.md` |
| 8 | causal identification | CausalAssessment | `config/agents/charters/omega-08.system.md` |
| 9 | blind replication | ReplicationReport | `config/agents/charters/omega-09.system.md` |
| 10 | source dependency graph | TriangulationReport | `config/agents/charters/omega-10.system.md` |
| 11 | atomic fact audit | ForensicFactReport | `config/agents/charters/omega-11.system.md` |
| 12 | epistemic transition | EpistemicAssessment | `config/agents/charters/omega-12.system.md` |
| 13 | assumption prosecution | AssumptionIndictment | `config/agents/charters/omega-13.system.md` |
| 14 | authorized red team | RedTeamReport | `config/agents/charters/omega-14.system.md` |
| 15 | alternative portfolio | AlternativePortfolio | `config/agents/charters/omega-15.system.md` |
| 16 | simulation ensemble | SimulationReport | `config/agents/charters/omega-16.system.md` |
| 17 | strategy portfolio | StrategyPortfolio | `config/agents/charters/omega-17.system.md` |
| 18 | systemic impact | ImpactAssessment | `config/agents/charters/omega-18.system.md` |
| 19 | existential risk | ExistentialRiskAssessment | `config/agents/charters/omega-19.system.md` |
| 20 | marginal resource allocation | ResourcePlan | `config/agents/charters/omega-20.system.md` |
| 21 | authority determination | AuthorityDetermination | `config/agents/charters/omega-21.system.md` |
| 22 | Ω quality certification | QualityCertification | `config/agents/charters/omega-22.system.md` |
| 23 | lossless sovereign synthesis | DecisionDossier | `config/agents/charters/omega-23.system.md` |
| 24 | controlled evolution | ChangeProposal | `config/agents/charters/omega-24.system.md` |

## Prueba individual mínima

Para cualquier fila deben poder resolverse sin prosa adicional:

- las 19 decisiones de autoridad;
- happy path, seis o más branches, timeout y terminales;
- siete o más gates y tres o más hard gates;
- ocho fallos específicos con D/C/R/R/E;
- payload de salida exclusivo;
- 24 casos efectivos de evaluación;
- productor y certificador separados.

`tests/omega/run-all.mjs` impide liberar la versión si una fila no satisface
estas condiciones. `run-model-evals.mjs` conserva D3 como deuda hasta recibir
respuestas reales fijadas por proveedor/modelo/prompt.

