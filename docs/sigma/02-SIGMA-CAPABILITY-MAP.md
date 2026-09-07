# Mapa de Capacidades y Diseño de los 40 Agentes Σ

**Versión:** 1.0.0  
**Decisión:** 40 roles permanentes; dominios y picos de trabajo son temporales.

## 1. Método de derivación

Se partió de 57 capacidades observables. Dos capacidades sólo se fusionaron si
comparten: outcome, inputs, ritmo, permisos, método, consumidores, riesgo y
ausencia de conflicto de separación de funciones. El test produjo 40 clusters.

El censo enumerado y verificable es `config/sigma/capability-register.json`.
La cifra 57 no es una afirmación narrativa: cada `CAP-001..CAP-057` declara
capacidad, owner y prueba operacional. El release falla ante ID duplicado,
owner inexistente o capacidad sin proof.

## 2. Registro de roles

| ID | Rol | Outcome exclusivo | Artefacto primario |
|---|---|---|---|
| Σ01 | Director Supremo de Inteligencia Estratégica | mandato Σ aceptado y accountable | IntelligenceCommandDecision |
| Σ02 | Canciller de Misiones y Cartera de Inteligencia | misión/cartera sin drift ni deadlock | IntelligenceMissionControl |
| Σ03 | Arquitecto de Requisitos de Inteligencia | necesidad decisional operacionalizada | IntelligenceRequirementSet |
| Σ04 | Gobernador de Prioridades, Cobertura y Gaps | cobertura explícita y priorizada | CoveragePortfolio |
| Σ05 | Custodio de Intención del Consumidor y Utilidad Decisional | modelo correcto de la decisión | ConsumerDecisionModel |
| Σ06 | Director de Colección All-Source | portfolio multivía ejecutable | CollectionStrategy |
| Σ07 | Arquitecto de Descubrimiento y Acceso a Fuentes | rutas de acceso legales y novedosas | SourceAccessMap |
| Σ08 | Director de Registros Primarios e Inteligencia Documental | corpus primario autenticado | PrimaryRecordCorpus |
| Σ09 | Director de Elicitación Experta e Inteligencia de Partners | evidencia experta trazable | ElicitationPortfolio |
| Σ10 | Arquitecto de Inteligencia Técnica, Digital y de Sensores | señales técnicas autorizadas | TechnicalCollectionPlan |
| Σ11 | Arquitecto de Colección Geoespacial y Temporal | observaciones espacio-tiempo | GeotemporalCollectionPlan |
| Σ12 | Director de Denial, Gaps y Contingencias de Colección | gap recuperado o declarado | CollectionGapCase |
| Σ13 | Custodio de Protección, Compartimentación y Handling de Fuentes | fuente protegida y usable | SourceHandlingPlan |
| Σ14 | Guardián de Ingesta, Cuarentena y Admisibilidad | input seguro/admisible | EvidenceIntakeDecision |
| Σ15 | Autoridad de Identidad, Fiabilidad y Motivación de Fuentes | source model explícito | SourceAssessment |
| Σ16 | Cartógrafo de Dependencia, Laundering y Ecos | independencia real modelada | SourceDependencyGraph |
| Σ17 | Custodio de Procedencia Operacional y Lineage | lineage completo candidato | OperationalProvenanceBundle |
| Σ18 | Arquitecto de Resolución de Entidades e Identidad | entidades no confladas | EntityResolutionCase |
| Σ19 | Arquitecto de Eventos, Cronología y Verdad Temporal | secuencia temporal reconciliada | EventChronology |
| Σ20 | Arquitecto de Redes, Relaciones y Estructuras Ocultas | red con incertidumbre de edges | NetworkAssessment |
| Σ21 | Gobernador de Medición, Calidad y Comparabilidad | medidas comparables y sesgo visible | MeasurementAssessment |
| Σ22 | Arquitecto de Ontologías y Knowledge Graph | semántica institucional consistente | KnowledgeGraphDelta |
| Σ23 | Director de Inteligencia Lingüística, Cultural y Semántica | significado preservado entre contextos | SemanticContextAssessment |
| Σ24 | Director de Fusión All-Source | integración sin falso consenso | AllSourceFusion |
| Σ25 | Arquitecto de Capacidades, Intención y Constraints de Actores | actor model discriminante | ActorAssessment |
| Σ26 | Arquitecto de Contexto, Sistemas y Entorno Estratégico | sistema y régimen modelados | StrategicEnvironmentModel |
| Σ27 | Director de Análisis Causal y de Mecanismos | mecanismos candidatos testeables | CausalMechanismAssessment |
| Σ28 | Maestro de Hipótesis Competidoras y Análisis Estructurado | alternativas discriminadas | AnalyticHypothesisSet |
| Σ29 | Director de Análisis de Engaño, Denial e Influencia | deception model y pruebas | DeceptionAssessment |
| Σ30 | Director de Contrainteligencia y Contaminación Analítica | compromiso contenido/investigado | CounterintelligenceCase |
| Σ31 | Arquitecto de Patrones, Anomalías y Señales Débiles | anomalías validadas/noise-separated | AnomalyPortfolio |
| Σ32 | Jefe de Inteligencia Estimativa | forecast/estimación calibrable | EstimateRecord |
| Σ33 | Director de Indicadores, Warning y Vigilancia Persistente | alerta o watch justificable | WarningNotice |
| Σ34 | Arquitecto de Sorpresa Estratégica y Discontinuidades | unknown-unknown surface atacada | StrategicSurpriseAssessment |
| Σ35 | Director de Inteligencia de Oportunidades | opening detectable y accionable | OpportunityAssessment |
| Σ36 | Custodio de Contradicciones, Disenso y Juicios Alternativos | minority material preservada | DissentRegisterDelta |
| Σ37 | Arquitecto de Productos y Diseminación de Inteligencia | producto correcto para audiencia autorizada | IntelligenceProduct |
| Σ38 | Gobernador de Integridad Analítica, Calibración y Tradecraft | proceso analítico medido | AnalyticQualityReport |
| Σ39 | Custodio de Memoria, Handover y Reconsideración | continuidad y reapertura correcta | WatchHandover |
| Σ40 | Inspector de Utilidad, Feedback y Aprendizaje de Inteligencia | outcome feedback atribuible | IntelligenceEffectivenessReview |

## 3. Conflictos evitados

| Pareja | Riesgo si se fusiona | Frontera |
|---|---|---|
| Σ3/Σ5 | requisitos se adaptan a método, no decisión | Σ5 modela consumo; Σ3 diseña preguntas |
| Σ4/Σ6 | cobertura “mejora” moviendo la métrica de colección | Σ4 evalúa; Σ6 ejecuta portfolio |
| Σ7/Σ15 | descubridor se enamora de su fuente | acceso ≠ fiabilidad |
| Σ9/Σ30 | handler oculta señales de compromiso | relación ≠ contrainteligencia |
| Σ13/Σ17 | protección elimina trazabilidad | referencias selladas, Ω7 auditable |
| Σ14/Σ24 | fusión admite lo que confirma narrativa | admissibility antes de análisis |
| Σ15/Σ16 | muchas fuentes aparente validan su propia fiabilidad | quality ≠ dependency |
| Σ18/Σ20 | red obliga identidades convenientes | entidades resueltas antes de edges |
| Σ19/Σ27 | narrativa causal reordena cronología | temporal reconstruction independiente |
| Σ24/Σ36 | fusión promedia discrepancias | dissent custodian separado |
| Σ28/Σ32 | hipótesis favorita monopoliza probabilidad | portfolio ≠ estimate commit |
| Σ29/Σ30 | analizar propaganda ≠ proteger proceso interno | target deception ≠ institutional CI |
| Σ32/Σ33 | forecast owner exagera alerta | estimate ≠ warning threshold |
| Σ33/Σ34 | watch esperado ignora discontinuidad | indicators ≠ surprise search |
| Σ35/Σ37 | producto vende oportunidad favorita | opportunity producer ≠ product framing |
| Σ37/Σ38 | autor certifica su narrativa | product ≠ analytic quality |
| Σ38/Σ40 | métrica interna declara utilidad | quality ≠ outcome evaluation |
| Σ40/Ω24 | evaluador despliega su mejora | propose ≠ institutional approve |

## 4. Capacidades no convertidas en roles permanentes

Country desk, sector desk, financial modeler, malware analyst, lawyer,
translator, statistician, geocoder, image analyst, archivist, survey designer,
engineer, procurement analyst, historian, anthropologist, field researcher y
forecast tournament operator son templates/department services. Se activan por
mandato; no justifican autoridad permanente en una cúspide de inteligencia.

## 5. Cobertura y minimalidad

Cada rol debe demostrar al menos un artefacto exclusivo, un gate que sólo él
puede evaluar internamente o una separación de deberes material. Si una futura
medición demuestra que dos roles operan siempre juntos, con mismo acceso,
método y outcome sin conflicto, Ω24 puede proponer fusión. Si aparece capacidad
sin owner, Σ2 abre `CAPABILITY_GAP`; no expande autoridad por improvisación.
