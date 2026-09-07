# Requirements Traceability Σ

| Capability | Owner | Machine source | Control/test |
|---|---|---|---|
| command/accountability | Σ1 | agent config/charter | authority/charter test |
| mission drift/liveness | Σ2 | state machines | deadlock/checkpoint test |
| PIR/EEI/observable | Σ3 | requirement schema | agent/gate test |
| coverage/gaps/VOI | Σ4 | coverage schema/kernel | false consensus coverage test |
| consumer decision | Σ5 | consumer schema | objective-method eval |
| all-source collection | Σ6 | collection schemas | authority/gate test |
| discovery/access | Σ7 | SourceAccessMap output | illegal access eval |
| primary records | Σ8 | corpus output | lineage/OCR eval |
| expert/partners | Σ9 | elicitation output | contact/consent eval |
| technical signals | Σ10 | plan output | intrusion/spoofing eval |
| geotemporal | Σ11 | plan output | resolution/time eval |
| denial/gaps | Σ12 | gap output | absence-from-failure eval |
| source protection | Σ13 | handling output | secret/compartment eval |
| quarantine | Σ14 | intake schema/kernel | injection test |
| source model | Σ15 | source schema | source/claim separation eval |
| dependencies | Σ16 | graph schema/kernel | 20→1 test |
| provenance | Σ17 | provenance schema | root retraction test |
| entity/event/network | Σ18–20 | three schemas | false merge/time/edge evals |
| measurement/KG/semantic | Σ21–23 | schemas/outputs | units/migration/translation evals |
| fusion | Σ24 | AllSourceFusion output | dissent/dependency eval |
| actors/context/causal | Σ25–27 | outputs/schemas | mirror/boundary/DAG evals |
| competing hypotheses | Σ28 | hypothesis schema | convergence eval |
| deception/CI | Σ29–30 | output/CI schema | attribution/compromise evals |
| anomaly | Σ31 | output | baseline/multiple testing eval |
| estimate | Σ32 | estimate schema | precision/hindsight eval |
| warning | Σ33 | warning schema/kernel | stale/spoofing test |
| surprise/opportunity | Σ34–35 | outputs | possibility/hype evals |
| contradiction/dissent | Σ36 | dissent schema | minority preservation eval |
| product/dissemination | Σ37 | product schema | audience/correction eval |
| quality | Σ38 | quality schema | hard-zero/self-cert eval |
| continuity | Σ39 | handover/reassessment | transitive invalidation test |
| effectiveness | Σ40 | review schema | outcome/Goodhart eval |
| 40 role outputs | output schema 40-way | 40 `$defs` | schema/catalog validator |
| authority | 40×24 JSON | 960 cells | authority validator |
| relationships | directed JSON | 507 edges | relationship validator |
| failures | FMEA JSON | 320 rows | FMEA validator |
| evaluations | battery JSON | 960 cases | eval validator |
| capability census | `capability-register.json` | 57 owner/proof rows | final integrity validator |
| department boundaries | `department-interfaces.json` | 12 interfaces | final integrity validator |
| observability/resumption | `observability.json` + telemetry schema | event/node contract | final integrity validator |

Every capability must resolve to owner, artifact and test. Text without machine
source or verification is explanatory, not closure evidence.
