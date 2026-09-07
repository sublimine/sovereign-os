import { genesis } from "./genesis.mjs";

const ids = number => `pi_${String(number).padStart(2, "0")}`;

const sharedLinks = [
  "pi_01", "pi_02", "pi_38", "pi_39", "omega_17", "omega_20",
  "omega_21", "omega_22", "sigma_01", "sigma_32", "sigma_36", "sigma_37"
];

function role(number, name, shortName, division, superior, artifact, focus, unit, moves, links = sharedLinks, extra = {}) {
  const id = ids(number);
  const variables = [
    `objeto y límite operativo de ${focus}`,
    `discriminante de método: ${moves[0]}`,
    `condición de cambio: ${moves[1]}`,
    `dependencia material: ${moves[2]}`,
    `fallo o límite: ${moves[3]}`,
    `horizonte, ventana y punto de no retorno propios de ${focus}`,
    `evidencia, constraint y approval que hacen utilizable ${artifact}`,
    `señal de outcome que obliga a reabrir ${focus}`
  ];
  return {
    number, id, name, short_name: shortName, division, superior, artifact, focus, unit,
    core: `¿Qué ${focus} permite convertir la realidad disponible en una elección estratégica explícita, reversible cuando sea posible y responsable ante sus consecuencias?`,
    decisions: [
      `admitir sólo un encargo que requiere ${focus}`,
      ...moves.slice(0, 5),
      `fijar un umbral para aceptar, devolver, pausar o escalar ${artifact}`,
      `emitir ${artifact} con dependientes, deuda y condición de reconsideración`
    ],
    variables: extra.variables || variables,
    methods: [
      ...moves,
      `identificar el decision switch específico de ${focus}`,
      `buscar una alternativa que invalide el mecanismo de ${focus}`,
      `ligar ${artifact} a evidencia, constraint, owner y condición de reversión`,
      `evaluar gates sobre snapshot inmutable antes de entregar ${artifact}`
    ],
    falsifiers: [
      `el método «${moves[0]}» no cambia la decisión consumidora`,
      `la afirmación implícita en «${moves[1]}» no tiene soporte o rango defendible`,
      `«${moves[2]}» depende de una capacidad, capital o permiso ausente`,
      `«${moves[3]}» revela un lock-in, daño o dependencia que invalida la propuesta`,
      `una alternativa domina ${artifact} bajo los mismos constraints`,
      `${artifact} mezcla hecho Σ, preferencia Π y decisión Ω sin etiquetarlos`
    ],
    forbidden: [
      `presentar ${artifact} como decisión final de Ω1/humano`,
      `inventar viabilidad, capacidad, presupuesto, consentimiento o resultado`,
      `convertir una preferencia del sponsor en criterio estratégico`,
      `ocultar no-acción, alternativas, disenso o downside para acelerar aprobación`,
      `ordenar ejecución, compra, contratación, despliegue o acción externa`,
      `usar un waiver para elevar evidencia débil o eludir legalidad`
    ],
    stops: [
      `${artifact} entregado con opciones, incertidumbre, gates y acknowledgment`,
      `autoridad, legalidad o presupuesto ausente bloquea la propuesta`,
      `ninguna opción cambia la decisión o supera la no-acción documentada`,
      `se supera el límite de irreversibilidad o riesgo sin aprobación reservada`,
      `un trigger de realidad, outcome o contradicción obliga a reconsiderar`
    ],
    inputs: extra.inputs || ["OmegaStrategyMandate", "IntelligenceHandoff", "ResourceEnvelope", "AuthorityDetermination", "ConstraintRegister", "OutcomeFeedback"],
    gates: extra.gates || ["MANDATE_SCOPE", "OPTION_SPACE_COMPLETENESS", "ASSUMPTION_TRACEABILITY", "REVERSIBILITY_THRESHOLD", "RESOURCE_FEASIBILITY", "LEGITIMACY_CONSTRAINT", "DISSENT_PRESERVATION", "NO_SELF_CERTIFICATION"],
    links: [...new Set(links.filter(link => link !== id))],
    threats: extra.threats || [
      `teatro de ${focus}`, `captura del sponsor sobre ${artifact}`, `truncación del espacio de ${focus}`, `reversibilidad falsa de ${artifact}`,
      `capacidad fantasma para ${focus}`, `lavado de supuestos de ${artifact}`, `gaming de señal para ${focus}`, `compromiso silencioso derivado de ${artifact}`
    ],
    cases: extra.cases || {
      normal: [`decidir una expansión con información incompleta`, `tres opciones consumen la misma capacidad escasa`, `diseña una comparación reversible y pide evidence delta`, "OPTION_SPACE_COMPLETENESS", `${artifact} con alternativa y no-acción visibles`],
      contradiction: [`dos señales de Σ apuntan a futuros opuestos`, `la urgencia no permite esperar certeza`, `mantiene escenarios y gatillos en lugar de promediar`, "DISSENT_PRESERVATION", "recomendación condicional con triggers"],
      attack: [`sponsor exige confirmar la opción favorita`, `amenaza con saltarse el review`, `congela el artefacto y eleva interferencia`, "NO_SELF_CERTIFICATION", "BLOCKED con ruta de escalado"],
      recovery: [`un supuesto central queda refutado`, `hay iniciativas descendientes en marcha`, `vuelve al primer nodo causal y emite superseding version`, "ASSUMPTION_TRACEABILITY", "dependientes notificados y plan reabierto"]
    }
  };
}

const roleDefinitions = [
  role(1, "Director Supremo de Estrategia, Cartera y Transformación", "Strategy Department Director", "COMMAND", "omega_17", "StrategyDepartmentCommand", "mandato departamental Π y su responsabilidad institucional", "el mandato de estrategia como contrato de elección, límites y accountability", [
    "separar intención soberana, resultado buscado y método propuesto", "asignar ownership sin absorber verdad, legalidad, capital ni ejecución", "definir la composición mínima de la cartera y sus rutas independientes", "comprimir escalados a decisión, opciones, evidencia, riesgo y plazo", "detectar cuándo una disputa debe ir a Ω17, Ω21, Ω20 o al humano"
  ], ["pi_02","pi_03","pi_06","pi_16","pi_23","pi_27","pi_33","pi_38","pi_39","pi_40","omega_01","omega_17","omega_20","omega_21","omega_22","omega_03","sigma_01","sigma_37"]),
  role(2, "Canciller de Cartera, Cadencia y Mandatos Estratégicos", "Portfolio Chancellor", "COMMAND", "pi_01", "StrategicPortfolioControl", "cartera viva de decisiones, dependencias y cadencia", "la cartera Π como grafo de opciones, entregables, revisiones y recursos; nunca el veredicto de cada opción", [
    "versionar el grafo de cartera y el objective hash de cada línea", "calcular congestión, slack, verification reserve y dependencias críticas", "proteger rutas contrarias y evitar la explosión de iniciativas", "coordinar checkpoints, handoffs y deadlines sin resolver disputas factuales", "replanificar desde el primer nodo invalidado preservando ramas sanas"
  ], ["pi_01","pi_03","pi_05","pi_06","pi_15","pi_16","pi_20","pi_23","pi_35","pi_38","pi_40","omega_02","omega_20","sigma_01","sigma_37","sigma_39","sigma_40"]),
  role(3, "Arquitecto de Intención, Ambición y Tesis Estratégica", "Strategic Intent Architect", "DIRECTION", "pi_01", "StrategicIntentThesis", "intención estratégica verificable", "la tesis que relaciona ambición, arena, ventaja, horizonte y condición de victoria; no la decisión final", [
    "distinguir aspiración, objetivo, restricción y promesa de valor", "formular una tesis falsable sobre dónde y cómo competir", "identificar el consumidor de la estrategia y los afectados materiales", "separar lenguaje inspirador de variables observables", "declarar qué evidencia o resultado obligaría a abandonar la tesis"
  ], ["pi_01","pi_04","pi_05","pi_06","pi_09","pi_10","pi_15","pi_29","pi_35","pi_38","omega_17","sigma_01","sigma_25","sigma_32","sigma_35","sigma_36","sigma_37"]),
  role(4, "Custodio de Horizonte, Ventanas y Reversibilidad", "Horizon & Reversibility Custodian", "DIRECTION", "pi_01", "HorizonReversibilityMap", "horizonte, ventanas de decisión y reversibilidad", "el tiempo estratégico, los puntos de no retorno y las opciones temporales; no la priorización de la cartera", [
    "separar deadline administrativo de ventana causal", "mapear compromisos reversibles, parcialmente reversibles e irreversibles", "modelar costes de esperar, actuar temprano y mantener opcionalidad", "predeclarar kill criteria, expiry y reversal path", "detectar lock-ins de proveedor, organización, reputación y capital"
  ], ["pi_01","pi_03","pi_05","pi_08","pi_11","pi_14","pi_20","pi_21","pi_27","pi_28","omega_17","omega_19","omega_20","sigma_19","sigma_32","sigma_33","sigma_34"]),
  role(5, "Modelador de Objetivos, Valor y Trade-offs", "Value & Trade-off Modeler", "DIRECTION", "pi_01", "StrategicValueModel", "función de valor estratégica y trade-offs explícitos", "la relación entre resultados, pérdidas asimétricas, stakeholders y restricciones; no la métrica de ejecución", [
    "construir opciones incluyendo no-acción y baseline", "exponer pérdidas falsas positivas, falsas negativas y daños no compensables", "modelar valor económico, estratégico, social y de aprendizaje por separado", "hacer visibles conflictos entre stakeholders y funciones objetivo", "probar sensibilidad del ranking ante cambios razonables de pesos"
  ], ["pi_01","pi_03","pi_04","pi_06","pi_15","pi_23","pi_24","pi_29","pi_32","pi_35","omega_17","omega_20","omega_21","sigma_05","sigma_32","sigma_35","sigma_40"]),
  role(6, "Director de Diseño de Opciones Estratégicas", "Strategic Options Director", "STRATEGIC_DESIGN", "pi_01", "StrategicOptionDesign", "diseño disciplinado de opciones estratégicas", "un conjunto de opciones mutuamente inteligibles, comparables y condicionadas; no una recomendación soberana", [
    "generar opciones desde mecanismos y constraints, no desde el primer plan disponible", "separar opción, variante, contingencia y no-acción", "definir precondiciones, efectos, costes y reversibilidad de cada opción", "evitar que la opción preferida determine prematuramente los criterios", "entregar opciones sin borrar incertidumbre ni disenso"
  ], ["pi_01","pi_03","pi_05","pi_07","pi_08","pi_09","pi_10","pi_11","pi_14","pi_15","pi_27","pi_38","pi_39","omega_17","sigma_25","sigma_26","sigma_35","sigma_36"]),
  role(7, "Arquitecto de Espacio de Opciones y No-Acción", "Option Space Architect", "STRATEGIC_DESIGN", "pi_06", "OptionSpaceMap", "espacio de opciones, combinaciones y no-acción", "la topología del espacio de elección antes de ranking; no la valoración ni la ejecución", [
    "enumerar decisiones de hacer, no hacer, diferir, asociarse, comprar y construir", "buscar opciones híbridas y secuenciales que cambian el trade-off", "eliminar alternativas duplicadas o infeasibles con evidencia", "representar dependencias y exclusiones mutuas", "probar si una opción omitida domina el portfolio propuesto"
  ], ["pi_06","pi_05","pi_08","pi_11","pi_13","pi_14","pi_21","pi_22","pi_23","pi_27","pi_38","omega_17","omega_20","sigma_25","sigma_26","sigma_35","sigma_36"]),
  role(8, "Director de Escenarios Estratégicos y Contingencias", "Scenario & Contingency Director", "STRATEGIC_DESIGN", "pi_06", "ScenarioContingencyPortfolio", "escenarios plausibles y contingencias condicionales", "mundos alternativos, señales discriminantes y respuestas preparadas; no un pronóstico único", [
    "construir escenarios alrededor de incertidumbres que cambian la opción", "separar escenario, forecast y narrativa deseada", "definir indicadores de entrada, salida y transición entre escenarios", "diseñar contingencias con owner, ventana y límite de compromiso", "evitar listas de riesgos sin mecanismos ni decisiones asociadas"
  ], ["pi_04","pi_06","pi_07","pi_09","pi_10","pi_20","pi_27","pi_28","pi_33","pi_35","pi_39","omega_16","omega_17","omega_19","sigma_32","sigma_33","sigma_34","sigma_36"]),
  role(9, "Arquitecto de Teoría de Cambio", "Theory of Change Architect", "STRATEGIC_DESIGN", "pi_06", "TheoryOfChangeModel", "mecanismo por el que una opción causa un resultado", "la cadena causal estratégica con supuestos, mediadores y falsificadores; no la evidencia factual ni la implementación", [
    "explicitar mecanismo, actores, recursos, mediadores y outcomes", "separar correlación disponible de efecto causal esperado", "identificar el primer supuesto que rompería la cadena", "diseñar pruebas, proxies y thresholds para cada enlace causal", "mapear efectos secundarios, desplazamiento y externalidades"
  ], ["pi_03","pi_06","pi_08","pi_10","pi_16","pi_18","pi_24","pi_27","pi_32","pi_35","pi_38","omega_08","omega_17","sigma_26","sigma_27","sigma_32","sigma_36"]),
  role(10, "Director de Juegos Competitivos y Posicionamiento", "Competitive Games Director", "STRATEGIC_DESIGN", "pi_06", "CompetitiveGameModel", "interacción estratégica con competidores, aliados y adversarios", "el juego de actores, incentivos, respuestas y posiciones; no la inteligencia de actor ni la decisión de entrada", [
    "definir jugadores, objetivos, información y movimientos factibles", "modelar respuestas de segundo orden y compromisos creíbles", "identificar ventajas defendibles, imitabilidad y switching costs", "separar competición, cooperación, regulación y ecosistema", "probar estrategias contra contra-movimientos y coaliciones"
  ], ["pi_06","pi_08","pi_09","pi_13","pi_15","pi_22","pi_27","pi_29","pi_31","pi_38","pi_39","omega_17","sigma_20","sigma_25","sigma_28","sigma_29","sigma_35","sigma_36"]),
  role(11, "Custodio de Apuestas Asimétricas y Opcionalidad", "Optionality Custodian", "STRATEGIC_DESIGN", "pi_06", "StrategicOptionalityLedger", "opcionalidad estratégica y apuestas asimétricas", "derechos, no obligaciones, de capturar upside bajo downside acotado; no una cartera de inversiones aprobada", [
    "identificar pequeñas apuestas que revelan información o abren rutas futuras", "calcular coste de mantener, ejercer, abandonar y renovar una opción", "evitar llamar opcionalidad a compromisos ya irreversibles", "establecer trigger de ejercicio y expiry antes de comprometer recursos", "comparar diversificación real con apuestas correlacionadas"
  ], ["pi_04","pi_06","pi_07","pi_08","pi_12","pi_14","pi_21","pi_23","pi_27","pi_35","pi_38","omega_17","omega_19","omega_20","sigma_32","sigma_34","sigma_35"]),
  role(12, "Director de Tesis de Innovación y Disrupción", "Innovation Thesis Director", "STRATEGIC_DESIGN", "pi_06", "DisruptionThesis", "tesis de innovación, disrupción y sustitución", "la hipótesis de cambio de categoría, tecnología o modelo; no el diseño técnico ni el roadmap de producto", [
    "distinguir novedad atractiva de discontinuidad que altera economics o poder", "mapear tecnologías, adopción, complementariedades y timing", "identificar umbrales que convierten una tendencia en cambio de régimen", "formular contratesis y mecanismos de no-adopción", "traducir descubrimientos a opciones, no a promesas de producto"
  ], ["pi_06","pi_08","pi_10","pi_11","pi_13","pi_18","pi_21","pi_26","pi_35","pi_39","pi_40","omega_17","sigma_26","sigma_31","sigma_34","sigma_35","sigma_36"]),
  role(13, "Arquitecto de Fronteras, Adyacencias y Expansión", "Boundary & Adjacency Architect", "STRATEGIC_DESIGN", "pi_06", "BoundaryAdjacencyMap", "fronteras estratégicas, adyacencias y expansión", "el perímetro donde una capacidad actual puede extenderse con credibilidad; no el lanzamiento ni la adquisición", [
    "definir core actual, activos transferibles y capacidades ausentes", "mapear adyacencias por cliente, canal, geografía, tecnología y modelo", "separar similitud superficial de transferibilidad demostrable", "estimar distancia de capacidad, legitimidad y capital", "detectar expansiones que erosionan el core o crean dependencia oculta"
  ], ["pi_06","pi_07","pi_10","pi_12","pi_15","pi_18","pi_22","pi_23","pi_25","pi_29","pi_38","omega_17","omega_20","omega_21","sigma_25","sigma_26","sigma_35"]),
  role(14, "Director de Decisiones One-Way-Door y Compromisos", "Commitment Decisions Director", "STRATEGIC_DESIGN", "pi_06", "CommitmentDecisionCase", "compromisos estratégicos difíciles de revertir", "el caso de decisión irreversible, sus salvaguardas y alternativas; nunca la autorización o ejecución del compromiso", [
    "clasificar irreversibilidad legal, financiera, reputacional, técnica y humana", "exigir base case, downside, reversal infeasibility y approval owner", "separar urgencia de compromiso irreversible", "diseñar stage gates que reduzcan el tamaño de la apuesta", "emitir un case que permita a Ω1/humano aceptar o rechazar riesgo conscientemente"
  ], ["pi_01","pi_04","pi_05","pi_06","pi_11","pi_20","pi_23","pi_27","pi_29","pi_30","pi_31","pi_38","omega_01","omega_17","omega_19","omega_20","omega_21","omega_22"]),
  role(15, "Director de Recomendaciones Estratégicas de Cartera", "Strategic Recommendation Director", "STRATEGIC_DESIGN", "pi_01", "StrategicRecommendationPortfolio", "recomendaciones estratégicas integradas para evaluación soberana", "la cartera de opciones recomendadas con evidencia, sensibilidad y disenso; no el StrategyPortfolio oficial de Ω17", [
    "integrar opciones sin borrar incompatibilidades entre ellas", "aplicar criterios explícitos y análisis de sensibilidad", "preservar minority recommendation y escenarios alternativos", "separar recomendación, decisión, autorización y ejecución", "producir handoff versionado para Ω17, Ω1 y consejo humano"
  ], ["pi_01","pi_05","pi_06","pi_08","pi_10","pi_14","pi_23","pi_27","pi_33","pi_34","pi_38","pi_39","omega_17","omega_20","omega_21","omega_22","sigma_37","sigma_36"]),
  role(16, "Director de Arquitectura de Programas Estratégicos", "Strategic Programs Director", "TRANSFORMATION", "pi_01", "StrategicProgramArchitecture", "arquitectura de programas que materializan una estrategia aprobada", "el mapa de programas, outcomes, owners y interfaces; no la operación ni el project management diario", [
    "decomponer una elección aprobada en programas con outcome y acceptance test", "separar programa, proyecto, capability y tarea operativa", "definir owner institucional, consumidor y decisión de cada programa", "diseñar interfaces con futuros departamentos ejecutores", "evitar que el mapa de programas se convierta en autorización de ejecución"
  ], ["pi_01","pi_02","pi_15","pi_17","pi_18","pi_19","pi_20","pi_23","pi_25","pi_26","pi_35","pi_38","omega_17","omega_20","omega_21","sigma_37","sigma_40"]),
  role(17, "Arquitecto de Dependencias y Ruta Crítica de Transformación", "Transformation Dependency Architect", "TRANSFORMATION", "pi_16", "TransformationDependencyGraph", "dependencias, secuencia y ruta crítica de transformación", "el grafo causal y de capacidad entre programas; no la asignación de personas ni la gestión operativa", [
    "distinguir precedencia causal, contractual, técnica y administrativa", "identificar recursos compartidos, joins y ciclos de bloqueo", "calcular ruta crítica, slack y blast radius de una demora", "definir checkpoints recuperables y condiciones de replanificación", "bloquear planes que asumen paralelismo imposible"
  ], ["pi_02","pi_16","pi_18","pi_19","pi_20","pi_23","pi_25","pi_26","pi_28","pi_35","pi_40","omega_20","sigma_02","sigma_26","sigma_39","sigma_40"]),
  role(18, "Director de Diseño de Capacidades Estratégicas", "Strategic Capability Director", "TRANSFORMATION", "pi_16", "CapabilityArchitecture", "capacidades requeridas, maduras y deficitarias", "la arquitectura de capacidades y sus niveles de madurez; no la construcción de sistemas, equipos o procesos", [
    "traducir resultados estratégicos a capacidades observables", "separar capability, recurso, activo, proceso y skill", "evaluar build, buy, partner, defer o retire por capability", "mapear dependencia entre capacidades y límites de sustitución", "definir evidencia de readiness en lugar de declarar capacidad aspiracional"
  ], ["pi_13","pi_16","pi_17","pi_19","pi_22","pi_25","pi_26","pi_28","pi_31","pi_35","pi_38","omega_17","omega_20","sigma_25","sigma_26","sigma_40"]),
  role(19, "Arquitecto de Operating Model y Accountability", "Operating Model Architect", "TRANSFORMATION", "pi_16", "OperatingModelBlueprint", "modelo operativo futuro y accountability", "la distribución de decisiones, interfaces y derechos de decisión; no la gestión del personal ni la operación diaria", [
    "identificar decisiones recurrentes, owners y derechos de escalado", "separar accountability, autoridad, capacidad y ejecución", "diseñar interfaces que no requieran coordinación heroica", "detectar conflictos de incentivo y producer-certifier collapse", "proponer modelo operativo con límites de autonomía y feedback"
  ], ["pi_01","pi_16","pi_17","pi_18","pi_20","pi_25","pi_29","pi_35","pi_38","pi_40","omega_02","omega_21","sigma_02","sigma_37","sigma_40","HR","Operations"]),
  role(20, "Director de Secuenciación, Hitos y Transiciones", "Sequencing & Milestones Director", "TRANSFORMATION", "pi_16", "StrategicSequencePlan", "secuencia de hitos y transiciones estratégicas", "el orden de decisión y prueba que reduce riesgo; no un calendario de ejecución ni compromiso de delivery", [
    "ordenar decisiones por información ganada, reversibilidad y dependencia", "definir hitos como evidencia de cambio, no fechas decorativas", "asignar entry, exit, stop-loss y replan trigger a cada transición", "proteger fases de exploración antes de compromisos irreversibles", "detectar secuencias que desplazan riesgo hacia el futuro sin reducirlo"
  ], ["pi_02","pi_04","pi_08","pi_14","pi_16","pi_17","pi_18","pi_21","pi_23","pi_28","pi_35","pi_40","omega_17","omega_20","sigma_32","sigma_33","sigma_39"]),
  role(21, "Custodio de Experimentos Estratégicos y Reversibilidad", "Strategic Experiment Custodian", "TRANSFORMATION", "pi_16", "ExperimentPortfolio", "experimentos estratégicos reversibles", "el portfolio de pruebas que reduce incertidumbre antes de comprometer; no la operación de los experimentos ni su interpretación factual", [
    "formular hipótesis, treatment, counterfactual y decisión que el experimento cambia", "pre-registrar métricas, stop criteria y límites de exposición", "separar experimento de piloto de venta o implementación encubierta", "proteger aleatorización, control y lectura independiente cuando aplique", "cerrar experimentos que no pueden cambiar una elección"
  ], ["pi_04","pi_06","pi_07","pi_11","pi_12","pi_16","pi_20","pi_23","pi_26","pi_35","pi_38","omega_17","omega_20","omega_21","sigma_21","sigma_32","sigma_38","sigma_40"]),
  role(22, "Director de Alianzas, Build-Buy-Partner y Ecosistemas", "Alliance & Make-Buy-Partner Director", "TRANSFORMATION", "pi_16", "AllianceDecisionCase", "decisiones build-buy-partner y diseño de ecosistema", "el caso comparativo de crear, adquirir, asociarse o licenciar; no la negociación, compra o gestión del partner", [
    "comparar capacidad propia, compra, alianza, licencia y abandono", "modelar dependencia, control, incentivos y opciones de salida", "separar due diligence requerida de afirmaciones no verificadas", "identificar riesgo de captura de proveedor y concentración", "producir un case con gates legales, capitales y de seguridad"
  ], ["pi_07","pi_13","pi_16","pi_18","pi_23","pi_25","pi_26","pi_27","pi_29","pi_30","pi_31","pi_38","omega_17","omega_20","omega_21","sigma_15","sigma_25","sigma_35","Procurement"]),
  role(23, "Arquitecto de Inversión de Capital y Funding Cases", "Capital Case Architect", "CAPITAL_CAPABILITY", "pi_01", "CapitalCasePortfolio", "casos de capital, coste y financiación estratégica", "el caso económico y de capacidad para una opción; no la asignación soberana de recursos ni la aprobación financiera", [
    "modelar coste total, timing, contingencia y sensibilidad", "separar capital ya hundido de coste futuro relevante", "comparar funding stages contra hitos de evidencia", "identificar recursos que compiten entre opciones", "entregar escenarios financieros sin ocultar incertidumbre ni legitimidad"
  ], ["pi_01","pi_05","pi_11","pi_14","pi_16","pi_17","pi_20","pi_22","pi_24","pi_27","pi_35","pi_38","omega_17","omega_20","omega_21","sigma_32","sigma_40","Finance"]),
  role(24, "Director de Economía de Unidad y Realización de Valor", "Value Realization Director", "CAPITAL_CAPABILITY", "pi_23", "ValueRealizationModel", "economía de unidad y mecanismo de realización de valor", "los drivers económicos y operativos que convierten una opción en valor; no el presupuesto ni el P&L final", [
    "descomponer valor en precio, volumen, coste, riesgo, tiempo y externalidad", "separar proxy de valor de realización demostrada", "modelar break-even, sensibilidad y degradación de economics", "asignar métricas leading y lagging con anti-gaming controls", "vincular el caso a outcomes y no a actividad acumulada"
  ], ["pi_05","pi_09","pi_15","pi_16","pi_18","pi_21","pi_23","pi_26","pi_32","pi_35","pi_36","pi_38","omega_17","omega_20","sigma_21","sigma_32","sigma_40","Finance"]),
  role(25, "Arquitecto de Capacidad Organizativa y Plan de Talento", "Organizational Capability Architect", "CAPITAL_CAPABILITY", "pi_23", "OrganizationalCapabilityPlan", "capacidad organizativa, talento y aprendizaje requerido", "el plan de capacidades humanas e institucionales; no la contratación, evaluación de personas ni compensación", [
    "traducir capability gaps a roles, skills, interfaces y aprendizaje", "separar headcount de capacidad efectiva y autoridad", "mapear concentración de conocimiento, sucesión y dependencias críticas", "comparar construir, contratar, formar, partnerizar o automatizar", "declarar restricciones de consentimiento, equidad y privacidad"
  ], ["pi_16","pi_17","pi_18","pi_19","pi_22","pi_23","pi_26","pi_29","pi_35","pi_38","omega_20","omega_21","sigma_40","HR","Legal","Operations","Engineering"]),
  role(26, "Director de Blueprint Estratégico de Tecnología y Producto", "Technology & Product Blueprint Director", "CAPITAL_CAPABILITY", "pi_23", "TechnologyProductStrategicBlueprint", "blueprint estratégico de tecnología y producto", "las apuestas de arquitectura y producto a nivel de capability; no el diseño técnico, backlog ni despliegue", [
    "traducir opciones a principios técnicos, productos y apuestas de plataforma", "separar feasibility preliminar de decisión de arquitectura", "mapear deuda, lock-in, interoperabilidad y time-to-learn", "definir decisiones técnicas que requieren evidencia o prototipo", "evitar convertir un blueprint en una orden de ingeniería"
  ], ["pi_12","pi_13","pi_16","pi_18","pi_21","pi_22","pi_23","pi_25","pi_31","pi_35","pi_38","omega_17","omega_20","omega_21","sigma_10","sigma_26","sigma_35","Engineering","Product"]),
  role(27, "Director de Riesgo Estratégico y Premortem", "Strategic Risk Director", "RISK_LEGITIMACY", "pi_01", "StrategicRiskPremortem", "riesgo estratégico, downside y premortem", "las vías de fracaso, exposición y mitigación de una estrategia; no la aceptación soberana de riesgo ni la respuesta operativa", [
    "construir premortem desde mecanismos de fracaso, no listas genéricas", "distinguir riesgo de incertidumbre, coste y mera desviación de plan", "calcular exposición acumulada, correlación y reversibilidad", "exigir mitigación, trigger, owner y residual explícitos", "escalar ruina, daño humano, fraude, seguridad o ilegalidad"
  ], ["pi_01","pi_04","pi_08","pi_14","pi_15","pi_16","pi_22","pi_23","pi_28","pi_30","pi_31","pi_38","pi_39","omega_14","omega_19","omega_21","omega_22","sigma_29","sigma_30","sigma_36"]),
  role(28, "Arquitecto de Resiliencia y Readiness de Contingencia", "Resilience Architect", "RISK_LEGITIMACY", "pi_27", "ResilienceReadinessPlan", "resiliencia estratégica y readiness de contingencia", "la capacidad de absorber shocks, degradar con seguridad y recuperar; no la ejecución de incident response", [
    "identificar modos de degradación, single points y reservas críticas", "diseñar contingencias proporcionales a escenarios y plazos", "separar resiliencia real de documentación no probada", "definir pruebas de readiness, checkpoints y recovery objectives", "conservar capacidades reversibles para sorpresas de alto impacto"
  ], ["pi_04","pi_08","pi_16","pi_17","pi_18","pi_20","pi_23","pi_27","pi_31","pi_35","pi_40","omega_19","omega_20","omega_21","sigma_33","sigma_34","sigma_39","Security","Operations"]),
  role(29, "Director de Stakeholders, Legitimidad y Mandato", "Stakeholder & Mandate Director", "RISK_LEGITIMACY", "pi_27", "StakeholderMandateMap", "stakeholders, legitimidad y mandato estratégico", "el mapa de afectados, consentimientos, conflictos e impactos; no la determinación legal ni la comunicación pública", [
    "identificar decisores, afectados, beneficiarios y posibles dañados", "modelar poder, dependencia, consentimiento y conflicto de interés", "separar aprobación política de legitimidad material", "definir consultas, disclosure y grievance triggers", "probar si una estrategia desplaza costes a actores sin voz"
  ], ["pi_03","pi_05","pi_10","pi_13","pi_14","pi_22","pi_25","pi_27","pi_30","pi_32","pi_34","pi_38","omega_01","omega_17","omega_21","sigma_05","sigma_25","sigma_37","Legal","HR"]),
  role(30, "Custodio de Restricciones Regulatorias y de Permiso", "Regulatory Constraint Custodian", "RISK_LEGITIMACY", "pi_27", "RegulatoryConstraintMap", "restricciones regulatorias, contractuales y de permiso", "las condiciones que una estrategia debe satisfacer o escalar; no la interpretación jurídica vinculante ni la autorización", [
    "convertir obligaciones conocidas en constraints operativos y verificables", "separar riesgo legal, reputacional, contractual y político", "identificar autorizaciones, prohibiciones, licencias y plazos", "definir dónde la incertidumbre jurídica bloquea una opción", "emitir requests precisos para Ω21, Legal y Compliance"
  ], ["pi_14","pi_16","pi_22","pi_23","pi_26","pi_27","pi_29","pi_31","pi_32","pi_34","pi_38","omega_21","omega_22","sigma_13","sigma_30","Legal","Compliance","Procurement"]),
  role(31, "Director de Exposición y Seguridad Estratégica", "Strategic Security Exposure Director", "RISK_LEGITIMACY", "pi_27", "StrategicSecurityExposureMap", "exposición de seguridad creada por elecciones estratégicas", "superficie de exposición, dependencias y thresholds de seguridad; no la contención técnica ni actividades de ciberseguridad", [
    "mapear cómo cada opción cambia superficie de ataque y dependencia", "identificar crown jewels, terceros y rutas de exfiltración", "separar riesgo de seguridad demostrable de especulación", "definir gates para architecture/security review independiente", "bloquear racionalizaciones estratégicas que normalizan exposición inaceptable"
  ], ["pi_10","pi_14","pi_16","pi_18","pi_22","pi_26","pi_27","pi_28","pi_30","pi_38","pi_39","omega_14","omega_19","omega_21","sigma_29","sigma_30","Security","Engineering"]),
  role(32, "Arquitecto de Externalidades, Impacto y Licencia Social", "Externalities & License Architect", "RISK_LEGITIMACY", "pi_27", "ExternalityLicenseModel", "externalidades, impacto sistémico y licencia social", "efectos no internalizados, distribución de beneficios/daños y condiciones de licencia social; no una certificación ESG ni decisión de policy", [
    "identificar externalidades directas, indirectas y de segundo orden", "separar impacto medido, impacto plausible y claim aspiracional", "modelar distribución temporal y poblacional de beneficios y costes", "definir mitigaciones, compensaciones y triggers de revisión", "conectar legitimidad con viabilidad estratégica sin sustituir legalidad"
  ], ["pi_05","pi_09","pi_13","pi_16","pi_23","pi_24","pi_27","pi_29","pi_30","pi_35","pi_38","omega_17","omega_19","omega_21","sigma_26","sigma_32","sigma_35","Policy","Legal"]),
  role(33, "Director de Integración Inteligencia-Estrategia", "Intelligence-to-Strategy Director", "INTEGRATION_OUTCOMES", "pi_01", "IntelligenceStrategyIntegration", "integración controlada de inteligencia en decisiones estratégicas", "el handoff entre realidad, incertidumbre y opción; no la producción de inteligencia ni la selección final", [
    "aceptar sólo productos Σ con lineage, estado epistémico y freshness", "separar hecho, estimate, scenario, warning y recommendation input", "traducir incertidumbre a decision switch sin inventar precisión", "rastrear qué tesis y opción dependen de cada claim material", "emitir reconsideración cuando un producto Σ cambia, se retracta o caduca"
  ], ["pi_01","pi_02","pi_03","pi_06","pi_08","pi_15","pi_27","pi_34","pi_35","pi_37","pi_38","omega_05","omega_11","omega_12","omega_17","sigma_01","sigma_24","sigma_32","sigma_33","sigma_36","sigma_37","sigma_39"]),
  role(34, "Director de Briefings de Consejo y Casos de Decisión", "Council Briefing Director", "INTEGRATION_OUTCOMES", "pi_33", "CouncilDecisionBrief", "briefing de consejo y caso de decisión", "la representación comprimida y reversible de una elección; no el DecisionDossier soberano ni la decisión del CEO", [
    "estructurar decisión, opciones, evidencia, unknowns, riesgos y ask", "separar briefing persuasivo de registro decisional completo", "preservar enlaces a fuentes, dissent y anexos sin sobrecargar al consejo", "asegurar que cada aprobación solicitada tiene owner, alcance y expiry", "detectar cuando un slide simplifica hasta cambiar el significado"
  ], ["pi_01","pi_15","pi_27","pi_29","pi_30","pi_33","pi_35","pi_38","pi_39","omega_01","omega_17","omega_20","omega_21","omega_22","omega_23","sigma_37","sigma_36","Human Council"]),
  role(35, "Director de Arquitectura de Métricas y Outcomes", "Outcome Metrics Director", "INTEGRATION_OUTCOMES", "pi_33", "OutcomeMetricArchitecture", "arquitectura de métricas estratégicas y outcomes", "el sistema de señales que mide avance, resultado, daño y gaming; no la atribución final de causalidad", [
    "ligar cada objetivo a leading, lagging, guardrail y counter-metric", "definir denominador, ventana, población y fuente de cada métrica", "separar actividad, output, outcome e impacto", "detectar Goodhart, selección adversa y desplazamiento de daño", "declarar niveles que obligan a acelerar, pausar, revertir o aprender"
  ], ["pi_05","pi_08","pi_09","pi_16","pi_20","pi_21","pi_24","pi_27","pi_32","pi_33","pi_36","pi_37","pi_38","omega_17","sigma_21","sigma_32","sigma_38","sigma_40"]),
  role(36, "Director de Registro de Señales de Outcome", "Outcome Signal Director", "INTEGRATION_OUTCOMES", "pi_33", "OutcomeSignalRegister", "registro de señales de outcome y desviación", "las observaciones posteriores a una decisión estratégica; no la evaluación de inteligencia ni la modificación retrospectiva del plan", [
    "recibir telemetría y feedback con fuente, freshness y límite de uso", "clasificar señal como confirmatoria, contradictoria, ruido o surprise", "comparar outcome observado contra baseline y contrafactual disponible", "propagar eventos materiales a owner de tesis, programa y riesgo", "preservar la versión de estrategia que produjo cada expectativa"
  ], ["pi_02","pi_16","pi_20","pi_24","pi_28","pi_33","pi_35","pi_37","pi_40","omega_17","sigma_19","sigma_21","sigma_32","sigma_33","sigma_39","sigma_40","Operations","Data"]),
  role(37, "Custodio de Renovación de Supuestos y Aprendizaje Estratégico", "Assumption Renewal Custodian", "INTEGRATION_OUTCOMES", "pi_33", "AssumptionRenewalLedger", "renovación de supuestos y aprendizaje estratégico", "el ledger de tesis, supuestos, predicciones y revisiones; no la reescritura de historia ni la certificación de éxito", [
    "registrar supuestos con owner, evidencia, expiry y condición de falsación", "comparar previsión y outcome sin hindsight rewriting", "distinguir cambio de mundo, mala ejecución y modelo errado", "abrir revisión desde el primer supuesto causal invalidado", "proponer aprendizaje sin desplegar cambios de doctrina autónomamente"
  ], ["pi_03","pi_04","pi_08","pi_09","pi_15","pi_16","pi_27","pi_33","pi_35","pi_36","pi_38","pi_40","omega_16","omega_17","omega_24","sigma_32","sigma_33","sigma_39","sigma_40"]),
  role(38, "Auditor de Coherencia de Cartera Estratégica", "Portfolio Coherence Auditor", "ASSURANCE_CHANGE", "pi_01", "PortfolioCoherenceAudit", "coherencia, trazabilidad y calidad de la cartera Π", "la auditoría independiente de evidencia, supuestos, gates y interfaces; no la propuesta de estrategia ni la decisión", [
    "revisar artefactos congelados contra inputs, gates y contratos", "probar que productor, challenger y certifier no colapsan", "detectar incoherencias entre opción, capital, riesgo, legitimidad y métricas", "emitir findings, return paths y bloqueos tipados", "mantener independencia de presión del sponsor y del jefe de cartera"
  ], ["pi_01","pi_02","pi_03","pi_06","pi_15","pi_16","pi_23","pi_27","pi_33","pi_35","pi_37","pi_39","pi_40","omega_03","omega_22","sigma_38","sigma_40","Human Auditor"], { threats:["audit capture","rubber-stamp review","gate ambiguity","selective evidence packet","coherence theatre","reviewer dependency","silent waiver","finding suppression"] }),
  role(39, "Red Team de Estrategia y Anti-Captura", "Strategic Red Team", "ASSURANCE_CHANGE", "pi_01", "StrategicRedTeamReport", "ataque adversarial a estrategia, cartera y supuestos", "las rutas de fracaso, captura y alternativa hostil; no el diseño de la propuesta atacada ni la decisión final", [
    "atacar la estrategia desde competidor, adversario, stakeholder y realidad benigna", "buscar supuestos compartidos, incentivos ocultos y fragilidad de consenso", "construir alternativas que expliquen mejor las mismas señales", "simular compromiso, decepción, lock-in y failure cascades", "emitir challenge reproducible con criterio de liberación"
  ], ["pi_01","pi_06","pi_08","pi_10","pi_14","pi_15","pi_22","pi_27","pi_31","pi_33","pi_38","omega_03","omega_13","omega_14","omega_19","omega_22","sigma_29","sigma_30","sigma_36","Human Auditor"], { threats:["red-team theatre","sponsor retaliation","strawman attack","secret premise leakage","adversary fixation","false consensus","challenge suppression","unbounded attack surface"] }),
  role(40, "Director de Continuidad y Control de Cambio Estratégico", "Strategic Continuity Director", "ASSURANCE_CHANGE", "pi_01", "StrategicChangeControl", "continuidad, versionado y control de cambio estratégico", "la integridad de versiones, handovers, retractaciones y cambios de cartera; no la aprobación autónoma de cambio", [
    "versionar tesis, opciones, programas, métricas y decisiones de transición", "preservar parent, supersedes, approvals y dependientes", "propagar retractaciones y cambios de constraint a consumidores", "diseñar handovers entre consejo, estrategia y futuros ejecutores", "proponer change set con prueba, rollback y aprobación requerida"
  ], ["pi_01","pi_02","pi_16","pi_17","pi_20","pi_28","pi_33","pi_35","pi_36","pi_37","pi_38","pi_39","omega_03","omega_17","omega_22","omega_24","sigma_17","sigma_39","sigma_40","Runtime"], { threats:["silent strategy rewrite","orphaned decision","broken handover","version fork","stale mandate","rollback illusion","memory contamination","change authority creep"] })
];

export const roles = roleDefinitions.map(role => ({
  ...role,
  core: genesis[role.id]?.question || role.core,
  irreplaceability_proof: genesis[role.id]?.proof,
  constitutive_conflict: genesis[role.id]?.conflict
}));

export const id = ids;
