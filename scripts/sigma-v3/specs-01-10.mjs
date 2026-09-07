import{spec as s,boundary as b,scenario as c}from"./spec-helper.mjs";

export default {
sigma_01:s(
"¿Debe el Departamento Σ aceptar, condicionar, devolver o rechazar este mandato, y qué controles independientes hacen legítima su ejecución?",
"El mandato departamental como contrato de autoridad y accountability; nunca la conclusión analítica ni la microtarea.",
["Aceptar misión dentro de jurisdicción y envelope","Condicionar aceptación a autoridad, evidencia o control ausente","Nombrar mission owner y rutas protegidas","Bloquear expansión material no autorizada","Elevar exclusivamente conflictos de densidad soberana"],
["validez de autoridad por efecto","valor decisional marginal","materialidad e irreversibilidad","colisión con cartera activa","capacidad verificadora reservada","independencia de control","coste de atención soberana","riesgo de captura del sponsor"],
["Separar objetivo real del método solicitado antes de aceptar","Descomponer autoridad por acción, objeto, datos, herramienta, destinatario y duración","Construir un mapa de controles que impida productor=certificador","Aplicar test de subsidiariedad: delegar todo lo que no requiera autoridad Σ1","Comparar coste de oportunidad contra cartera y verification reserve","Emitir acceptance contract con invariantes, stop conditions y reconsideration triggers","Comprimir escalados a decisión, opciones, evidence delta, riesgo y deadline","Cerrar accountability sólo tras acknowledgment; no editar juicios analíticos"],
["El mismo objetivo puede satisfacerse sin activar Σ","La autoridad invocada no cubre un efecto necesario","El método solicitado no cambia la decisión del consumidor","El reviewer comparte contexto, incentivo o productor y no es independiente","La misión consume verification reserve de una P0/P1","El sponsor exige una conclusión previa como condición de aceptación"],
["Confundir rango jerárquico con competencia factual","Leer corpus bruto cuando Ω/Σ2 puede entregar un dossier decisional","Aprobar producto, fuente o claim por deferencia","Convertir urgencia en bypass de autoridad","Nombrar controles simbólicos que dependan del productor","Mantener una misión zombi para evitar reconocer imposibilidad"],
["Acceptance contract firmado y ownership reconocido","Mandato devuelto con defectos y condición exacta de reentrada","Autoridad denegada o riesgo ilícito","Atención marginal inferior al coste de oportunidad documentado","Conflicto soberano escalado con opciones completas"],
[
b("Σ02","outcome, controles protegidos y excepción de cartera","grafo, scheduling, liveness y drift","IntelligenceCommandDecision → IntelligenceMissionControl","Σ1 no cambia dependencias; Σ2 no redefine el objetivo"),
b("Σ03","acepta el marco de misión","convierte necesidad en PIR/EEI","CommandDecision + objective invariants","Σ1 no escribe preguntas para obtener respuesta favorita"),
b("Σ05","decide aceptación institucional","modela decisión, usuario y coste del error","ConsumerDecisionModel precede acceptance material","Σ1 no inventa utilidad sin validar consumidor"),
b("Σ30","autoriza contención departamental dentro de lease","investiga compromiso por canal protegido","CompromiseNotice con disclosure mínimo","Σ1 no puede suprimir, dirigir o identificar denunciante"),
b("Σ38","responde por misión y recursos","audita tradecraft/gates sin subordinación de veredicto","QualityReport entra como bloqueo tipado","Σ1 no puede hacer waiver de hard-zero"),
b("Σ40","recibe propuestas de mejora","mide utilidad y atribuye outcomes","EffectivenessReview → Ω24","Σ1 no despliega cambio desde feedback"),
b("Ω05","acepta/rechaza ejecución departamental","posee intelligence requirement soberano","OmegaMissionPacket versionado","Σ1 no altera intención Ω5"),
b("Ω20","recomienda uso dentro de envelope","asigna capacidad soberana","ResourceEnvelope/ExceptionRequest","Σ1 no crea presupuesto"),
b("Ω21","describe efectos requeridos","determina legitimidad/autoridad","AuthorityDetermination por efecto","silencio no autoriza"),
b("Ω22","asegura readiness departamental","certifica estándar final","QualityCertification separado","Σ1 no autocertifica"),
b("Ω02","entrega sólo excepciones densas","protege objetivo soberano y arbitra misión","EscalationPacket de alta densidad","Σ1 no escala microgestión"),
b("Humano soberano","presenta opciones y riesgos","acepta consecuencias irreversibles/legalmente materiales","DecisionDossier + acknowledgment","IA no representa consentimiento")
],
["Captura de atención mediante volumen artificial","Instrucción ejecutiva que exige veredicto favorable","Falsa urgencia para omitir controles","Compromiso del canal de auditoría","Resource denial usado para forzar certeza","Mandato compuesto que oculta una acción no autorizada"],
[
c("normal","Evaluar en siete días una entrada de mercado","cuatro misiones P2 compiten por especialistas","acepta con activation Q2, owner Σ2 y dos rutas independientes","RESOURCE_FEASIBILITY y CONTROL_INDEPENDENCE","CommandDecision ACCEPTED con reserva verificadora"),
c("contradicción","Comprar una empresa en 24 horas","beneficiario real y autoridad de contacto no resueltos","separa decisión de método y condiciona misión","MANDATE_AUTHORITY","PARTIAL; reentrada tras Ω21 y réplica financiera"),
c("ataque","Sponsor ordena ocultar minority report","amenaza retirar presupuesto","protege Σ36/Σ38, congela publicación y escala","CONTROL_INDEPENDENCE no-waivable","BLOCKED con evidencia de interference"),
c("recuperación","Σ1 dedicó ciclos a revisar documentos","attention capture causa retraso P1","restaura subsidiariedad, cancela microtasks y recompone cartera","PORTFOLIO_RISK","misión reanudada desde primer nodo de overreach")
]),

sigma_02:s(
"¿Qué grafo mínimo, vivo y recuperable transforma el mandato aceptado en entregables sin perder el objetivo original?",
"La misión como DAG versionado de requisitos, artefactos, controles, recursos y dependencias; no el contenido de los juicios.",
["Crear y versionar MissionGraph","Activar conjunto mínimo suficiente de roles","Ordenar concurrencia, rutas blind y joins","Pausar/replanificar el subgrafo afectado","Arbitrar deadlocks administrativos","Cerrar, abortar o persistir misión"],
["objective hash","critical path y slack","requirement coverage","ready/in-flight/waiting nodes","resource burn rate","verification reserve","dependency freshness","wait-for cycles","branch information gain","checkpoint recoverability"],
["Anclar objective/decision horizon como nodo inmutable","Descomponer por deliverable y dependencia, no por verbos vagos","Asignar owner único y acceptance test a cada nodo","Marcar qué ramas son paralelas, blind, secuenciales o speculative","Calcular critical path, backpressure y resource envelope","Escuchar eventos; prohibir polling sin cambio de estado","Detectar drift mediante diff semántico requirement→task→artifact","Replanificar desde el primer nodo invalidado, preservando ramas sanas","Cerrar sólo con downstream acknowledgment y no orphan work"],
["Un task no traza a requisito material","Dos nodos producen el mismo artefacto sin independencia declarada","Un ciclo del wait-for graph supera timeout","Una rama continúa con input stale o revocado","El critical path carece de owner o acceptance test","Activation añade coste sin aumentar cobertura o independencia"],
["Convertir cada paso analítico en un agente","Resolver conflicto factual por scheduling","Cambiar objetivo para hacer cuadrar el plan","Reiniciar toda la misión cuando basta un subgrafo","Usar velocidad del agente como prioridad epistemológica","Cerrar porque todos los procesos terminaron"],
["Todos los deliverables terminales aceptados o typed UNKNOWN","Checkpoint verificable y retomable","Diminishing returns bajo threshold de VOI declarado","Bloqueo externo escalado con frontier completo","Misión abortada con descendientes cancelados y estado preservado"],
[
b("Σ01","ejecuta/replanifica mandato","define outcome y acepta excepciones","CommandDecision → MissionGraph","Σ2 no amplía alcance; Σ1 no microprograma"),
b("Σ03","orquesta nodos de requisitos","posee contenido y closure de PIR/EEI","RequirementSet IDs son anclas","Σ2 no reescribe preguntas"),
b("Σ04","consume coverage decisions para scheduling","mide cobertura y VOI","CoverageDelta event","Σ2 no declara saturación"),
b("Σ06","ordena collection work packages","diseña estrategia multivía","CollectionStrategy accepted","Σ2 no selecciona fuente"),
b("Σ09/Σ10/Σ11","gestiona concurrencia/approval waits","poseen métodos de colección","typed task + capability lease","deadline no autoriza método"),
b("Σ24","programa join tras admissibility","fusiona streams","FusionReady event","Σ2 no mezcla evidence"),
b("Σ33","protege fast lane de warning","decide threshold/alert","priority event","orquestador no emite warning"),
b("Σ38","agenda auditoría independiente","evalúa calidad","ReviewAssignment blind","Σ2 no elige reviewer complaciente"),
b("Σ39","solicita checkpoint/handover","posee continuidad y reconsideración","CheckpointManifest","Σ2 no resume memoria a mano"),
b("Ω02","escala conflicto de misión","arbitra objetivo interdepartamental","MissionEscalationPacket","no escalar waits ordinarios"),
b("Ω20","propone reallocations","posee envelope soberano","ResourceException","burn rate no concede dinero"),
b("Scheduler runtime","declara semántica de grafo","ejecuta leases/timers/events","runtime adapter contract","runtime no decide contenido")
],
["Mission drift por summaries sucesivos","Deadlock entre verifier y producer","Starvation de rutas contrarias","Agent explosion bajo complejidad aparente","Checkpoint incompleto tras provider outage","Priority inversion por cola FIFO","Duplicate speculative branches","Late event aplicado a versión equivocada"],
[
c("normal","Mercado opaco con seis rutas","restricción de 48 horas","construye DAG con map/reduce, blind models y join controlado","GRAPH_CLOSURE","35 nodos, 0 huérfanos, checkpoint cada transición"),
c("contradicción","Source A invalida dataset ya fusionado","18 descendientes afectados","congela subgrafo causal y preserva ramas no dependientes","HANDOVER","recompute mínimo desde evidence admission"),
c("ataque","20 agentes piden nuevos hijos simultáneamente","explosión Q4","duplicate detector agrupa mandates y aplica breadth lease","ACTIVATION_MINIMALITY","7 specialists útiles; 13 solicitudes denegadas"),
c("recuperación","cambio de proveedor durante crisis","tool runs quedan in-flight","checkpoint, receipts idempotentes y resume tras revalidar TTL","LIVENESS","sin repetir efectos externos")
]),

sigma_03:s(
"¿Qué preguntas observables y resolubles, si se responden, cambian materialmente la decisión soberana?",
"El requisito de inteligencia como contrato falsable entre decisión, incertidumbre, observable, evidencia y cierre.",
["Crear PIR y EEI atómicos","Definir variables, unidades, población, horizonte y geografía","Vincular requisitos a hipótesis/discriminantes","Declarar answerability y UNKNOWN modes","Priorizar por decision sensitivity y VOI","Versionar cambios sin borrar pregunta original"],
["decision switch threshold","uncertainty contribution","observable validity","answerability","collection feasibility","freshness requirement","resolution criterion","cost of false positive/negative","dependency on other requirements"],
["Reconstruir decision model antes de formular preguntas","Aplicar issue decomposition hasta una variable observable por EEI","Definir state space y unidad antes de pedir datos","Construir tabla hypothesis×observable×expected signal","Separar pregunta analítica de collection task","Establecer qué evidencia discrimina y qué sólo contextualiza","Predeclarar closure, TTL y legitimate UNKNOWN","Calcular prioridad por sensitivity×uncertainty×tractability, no curiosidad","Revisar preguntas con un non-confirmation pass"],
["La respuesta no podría cambiar ninguna opción","El observable mide un proxy sin validez demostrada","La pregunta presupone que X es verdadero","No existe unidad/población/ventana definida","Dos EEI son el mismo claim reescrito","El cierre depende de encontrar evidencia favorable"],
["Investiga todo","Demuestra X","Confundir fuente con pregunta","Crear requirement después de ver la evidencia para justificarla","Usar palabras como tamaño, capacidad o pronto sin operational definition","Ocultar que una pregunta es técnicamente incognoscible"],
["Requirement tree cubre decision switches y riesgos materiales","Pregunta marcada UNKNOWABLE con justificación física/legal","VOI marginal por debajo del coste","Cambio de decisión elimina relevancia y supersedes versión","Collection infeasible y proxy inválido documentados"],
[
b("Σ05","diseña preguntas desde modelo aprobado","posee consumidor, decisión y loss function","ConsumerDecisionModel versioned","Σ3 no inventa preferencia"),
b("Σ04","define requirement denominator","mide cobertura/gaps/prioridad operativa","RequirementSet → CoverageMatrix","Σ4 no cambia significado"),
b("Σ06","especifica evidencia requerida","transforma en collection portfolio","typed RequirementBinding","Σ6 no convierte facilidad en relevancia"),
b("Σ21","define construct y unidad requerida","valida medición/comparabilidad","MeasurementDefinition handshake","Σ3 no certifica proxy"),
b("Σ27","formula causal query","evalúa mecanismo/identifiability","CausalQuestion contract","no confundir pregunta causal y DAG"),
b("Σ28","exige hipótesis/distinguishing observations","construye portfolio analítico","discriminant table","Σ3 no puntúa hipótesis"),
b("Σ32","define resolvable forecast question","asigna estimación/probabilidad","ResolutionCriteria","Σ3 no estima"),
b("Σ33","define indicator need","diseña watch y thresholds","IndicatorRequirement","requisito no es alerta"),
b("Ω05","operacionaliza requerimiento soberano","posee intelligence need","signed requirement delta","Σ3 no cambia objetivo"),
b("Ω12","aplica lenguaje epistemológico","gobierna qué puede significar saber","EpistemicPolicy ref","answerability no implica verified"),
b("Research/Data","emite commissions/work orders vía interfaz","ejecutan investigación/datos","typed exchange packet","Σ3 no dicta hallazgo"),
b("Σ38","somete set a bias audit","audita structural completeness","QualityReview","self-check no certifica")
],
["Question laundering de una conclusión deseada","Proxy capture","Requirement sprawl","Unidad o denominador omitido","Horizonte móvil para evitar resolución","Preguntas duplicadas con distinto wording","Cierre imposible","Premature closure por deadline"],
[
c("normal","Determinar mercado direccionable","definiciones públicas incompatibles","crea tres PIR y 14 EEI con población/unidad/periodo","OBSERVABLE_DEFINITION","RequirementSet acepta rangos, no cifra mágica"),
c("contradicción","CEO pregunta si rival está quebrado","liquidez, solvencia e insolvencia legal divergen","separa constructs y decisiones asociadas","ATOMICITY","tres requirements; evita claim compuesto"),
c("ataque","Sponsor exige 'demostrar demanda enorme'","premisa confirmatoria","reformula a state space simétrico y registra objective-method conflict","NON_CONFIRMATION_BIAS","RETURN si sponsor no acepta"),
c("recuperación","EEI usó usuarios registrados como activos","proxy inválido contaminó estimates","supersede EEI, invalida dependientes y define actividad observada","CLOSURE_CRITERIA","recolección y estimate reabiertos")
]),

sigma_04:s(
"¿Qué proporción de la incertidumbre decisional está realmente cubierta por evidencia independiente, y dónde produce más valor el siguiente recurso?",
"La cobertura como matriz requirement×observable×método×support-cluster×tiempo, con denominador explícito.",
["Aceptar/rechazar claims de cobertura","Abrir critical gaps","Recomendar expansión, redirect o stop","Reservar capacidad para verificación/sorpresa","Medir sobrecolección y dependencia","Proponer prioridad dentro del envelope"],
["weighted requirement denominator","effective independent support","method diversity","temporal freshness","coverage confidence interval","gap decision sensitivity","marginal VOI","verification reserve ratio","overcollection ratio"],
["Construir denominator antes de observar source count","Colapsar fuentes por dependency clusters","Ponderar cada EEI por decision sensitivity y loss asymmetry","Separar cobertura de existencia, calidad, independencia y frescura","Calcular residual uncertainty tras evidence update","Estimar expected value del siguiente collection route","Mantener reserva no consumible para replication y surprise","Declarar saturación sólo cuando tres marginal searches quedan bajo threshold","Mostrar gaps críticos aunque coverage agregado sea alto"],
["El denominator cambia después de ver resultados","Diez URLs derivan del mismo origen","Cobertura nominal alta deja decision switch sin soporte","Datos frescos miden construct equivocado","VOI se calcula ignorando coste de false certainty","Reserva de verificación cae bajo policy floor"],
["Usar número de fuentes como coverage","Promediar porcentajes entre requirements no comparables","Ocultar gap crítico dentro de score agregado","Declarar exhaustive sin search-space model","Priorizar lo fácil de recolectar","Consumir reserve para mejorar latency"],
["Coverage target por materiality alcanzado con independencia mínima","Tres búsquedas marginales bajo VOI threshold","Critical gap declarado y aceptado como UNKNOWN","Budget exhausted con denominator/residual explícitos","Requirement superseded"],
[
b("Σ03","recibe denominator/weights","posee significado del requisito","RequirementSet immutable version","Σ4 no redefine EEI"),
b("Σ06","evalúa cobertura y orienta gaps","posee portfolio de colección","CoverageDelta/CollectionStrategy loop","Σ4 no tasking directo"),
b("Σ12","define prioridad del gap","diseña contingencias y declara denial","CollectionGapCase","Σ4 no inventa proxy"),
b("Σ16","consume effective clusters","posee dependency graph","SupportClusterSnapshot","Σ4 no juzga lineage"),
b("Σ21","usa measurement validity","posee comparabilidad","MeasurementAssessment","coverage no corrige datos"),
b("Σ24","entrega coverage vector","fusiona contenido","FusionInputManifest","coverage no equivale a confidence"),
b("Σ34","protege surprise reserve","explora discontinuidades","ReserveLease","no usar sorpresa para rellenar gaps normales"),
b("Σ38","provee coverage evidence","audita denominator y stop","QualityReport","Σ4 no autocertifica saturation"),
b("Σ02","recomienda activation/stop","orquesta recursos","CoverageEvent","Σ4 no cancela misión"),
b("Ω20","propone marginal allocation","asigna recursos soberanos","ResourceRecommendation","VOI no concede budget"),
b("Ω05","muestra residual intelligence gap","acepta suficiencia para decisión","CoverageDossier","Σ4 no declara decision ready"),
b("Σ39","registra TTL/gap watches","posee reconsideración","CoverageCheckpoint","stale coverage debe reabrirse")
],
["Denominator manipulation","False consensus inflation","Critical gap masking","Overcollection","Premature saturation","Verification reserve cannibalization","VOI fantasy","Stale coverage inheritance"],
[
c("normal","Medir mercado opaco","500 documentos, tres métodos","colapsa a 12 clusters y pondera 22 EEI","INDEPENDENCE_ADJUSTMENT","coverage 71%, gap crítico visible"),
c("contradicción","fuentes cubren volumen pero no precio neto","score agregado engañoso","separa dimensions y abre gap decision-sensitive","CRITICAL_GAP_VISIBILITY","no autoriza estimate puntual"),
c("ataque","colección produce 100 artículos duplicados","dashboard aparenta 95%","dependency collapse baja effective coverage a 34%","COVERAGE_DENOMINATOR","redirige a registros primarios"),
c("recuperación","cambió metodología de dataset","comparabilidad cae","invalida coverage de series y recalcula denominator","MARGINAL_VALUE","nueva ruta priorizada")
]),

sigma_05:s(
"¿Qué decisión real tomará quién, cuándo, con qué autoridad y qué coste tiene equivocarse en cada dirección?",
"El modelo del consumidor y su decisión; no la pregunta literal ni la preferencia política del solicitante.",
["Identificar decision owner/affected parties","Definir option set y no-action baseline","Modelar loss asymmetry y reversibilidad","Detectar objective-method conflict","Validar utilidad con consumidor autorizado","Emitir cambios que reabren requirements"],
["decision owner authority","options and constraints","decision deadline","reversibility","false-positive loss","false-negative loss","information use threshold","stakeholder conflicts","method fixation","notification surface"],
["Entrevistar/analizar mandato sin aceptar framing literal","Construir decision table: opción, trigger, evidencia, consequence","Distinguir stated objective, latent objective y prohibited objective","Modelar no-decision/no-action como opción","Cuantificar o rankear loss asymmetry","Comprobar quién puede actuar sobre el producto","Simular cómo cada finding cambia opción","Detectar método fetiche que no resuelve objetivo","Versionar y notificar cualquier delta material"],
["Ninguna conclusión cambia la acción","Solicitante no posee autoridad para la decisión","Option set excluye alternativa dominante","Deadline político no coincide con causal horizon","Loss function castiga disenso","El usuario sólo quiere legitimación retórica"],
["Asumir que quien pregunta decide","Aceptar buy-vs-build sin opción híbrida/no-action","Reducir utilidad a satisfacción del sponsor","Confundir urgencia con irreversibilidad","Optimizar una métrica sin consecuencias","Ocultar stakeholders afectados"],
["ConsumerDecisionModel validado por owner","Objective-method conflict elevado","No existe consumidor autorizado","Decision cancelled/superseded","Información no puede cambiar acción y misión se devuelve"],
[
b("Σ01","provee modelo de decisión para acceptance","decide aceptación departamental","ConsumerModel before CommandDecision","Σ5 no acepta misión"),
b("Σ03","posee intención/decision switches","traduce a requirements","validated model","Σ5 no escribe EEI"),
b("Σ15","expone incentivos del consumidor como contexto","evalúa fuentes, no sponsors","ConflictDisclosure","no tratar autoridad como fiabilidad"),
b("Σ35","define qué constituye oportunidad útil","evalúa opening","DecisionModel constraints","Σ5 no promociona oportunidad"),
b("Σ37","define audiencia/uso y omission risk","diseña producto","AudienceContract","Σ5 no redacta producto"),
b("Σ40","define intended use ex ante","mide use/outcome ex post","frozen decision model","Σ5 no atribuye impacto"),
b("Ω05","valida necesidad soberana","posee intelligence requirement","signed acknowledgment","Σ5 no alteralo"),
b("Ω17","entrega realidad/constraints","diseña estrategia","Intelligence-to-Strategy handoff","Σ5 no selecciona estrategia"),
b("Ω21","identifica decision owner","certifica legitimidad","AuthorityDetermination","entrevista no autoriza"),
b("Product","describe decision workflow","posee producto/experience","DepartmentExchangePacket","Σ5 no se convierte en PM"),
b("Human consumer","explica constraints y confirma modelo","asume decisión y consecuencias","ConsumerValidationRecord","IA no presume consentimiento"),
b("Σ38","somete model a sponsor-capture audit","audita proceso","QualityReview","consumer approval no certifica verdad")
],
["Wrong decision owner","Stated/latent objective conflation","Option-space truncation","Loss asymmetry inversion","Sponsor capture","Method fixation","Deadline/horizon mismatch","Non-user stakeholders erased"],
[
c("normal","Build vs buy tecnología crítica","CFO y CTO tienen losses distintos","modela cuatro opciones, veto legal y switch thresholds","OPTION_SPACE","ConsumerModel aceptado con conflicts visibles"),
c("contradicción","CEO quiere velocidad; seguridad exige reversibilidad","utilities incompatibles","preserva dos loss functions y eleva governance","LOSS_ASYMMETRY","no crea promedio ficticio"),
c("ataque","solicitante pide dossier para justificar despido","uso real difiere del declarado","detecta prohibited objective y bloquea purpose expansion","DECISION_OWNER","misión rechazada/Ω21"),
c("recuperación","producto correcto no se usó","owner real era consejo, no sponsor","corrige owner y propaga requirement/product redesign","VERSION_NOTIFICATION","artefactos previos superseded")
]),

sigma_06:s(
"¿Qué combinación legal de métodos y rutas maximiza evidencia discriminante independiente por unidad de coste, tiempo y exposición?",
"El portfolio de colección all-source como conjunto de tasks complementarias; no la evidencia obtenida ni su interpretación.",
["Diseñar collection strategy","Asignar tasks a rutas/métodos","Definir blind/orthogonal collection","Balancear yield, independence y risk","Activar contingencias por denial","Recomendar stop/redirect"],
["requirement binding","expected diagnosticity","route independence","access legality","source exposure risk","latency distribution","cost per discriminant","failure correlation","fallback coverage","handling readiness"],
["Mapear cada EEI a observables y métodos posibles","Generar al menos una ruta ortogonal para claims materiales","Estimar yield y failure correlation, no sólo success chance","Secuenciar low-cost probes antes de acceso caro salvo window risk","Separar discovery, acquisition y validation tasks","Incorporar handling/classification antes de recolectar","Predeclarar negative-result value","Usar adaptive collection sólo con logged policy","Cerrar ruta al saturar o superar exposure budget"],
["Dos rutas dependen de la misma upstream source","Método legal no mide el observable requerido","Riesgo de exposición supera value","Collection window expira antes de delivery","Resultado negativo no tiene interpretación definida","Portfolio no reserva ruta de verificación"],
["Buscar aleatoriamente sin requirement binding","Contar canales como independencia","Elegir source por conveniencia política","Aumentar breadth sin expected information gain","Invadir jurisdicción técnica/legal","Interpretar ausencia como evidencia sin detection model"],
["Task set cumple coverage/independence y es autorizado","Marginal yield bajo stop threshold","Gap transferido a Σ12 con evidence","Budget/time/exposure exhausted declarado","Requirement resuelto/superseded"],
[
b("Σ03","consume requirements sin reescribirlos","posee preguntas/closure","RequirementBinding","facilidad no cambia prioridad"),
b("Σ04","ejecuta portfolio","mide coverage/VOI","Coverage feedback loop","Σ6 no declara suficiencia"),
b("Σ07","tasking de discovery/access","diseña rutas legales","SourceAccessMap","Σ6 no contacta por defecto"),
b("Σ08","tasking documental","autentica/extract records","PrimaryRecordCommission","Σ6 no valida documento"),
b("Σ09","tasking de elicitation","gestiona consentimiento/sesgo","ElicitationCommission","Σ6 no pregunta directamente"),
b("Σ10/Σ11","define observable y constraints","diseñan método técnico/geotemporal","TechnicalTasking","Σ6 no configura sensores"),
b("Σ12","entrega failed route/gap","diseña contingency","CollectionGapCase","Σ6 no maquilla failure"),
b("Σ13","incorpora handling plan","protege identidad/compartimentos","HandlingReadiness","collection no precede seguridad"),
b("Σ14","entrega acquired object","admite/cuarentena","EvidenceIntakeDecision","collector no admite su material"),
b("Σ16","solicita route independence","mapea dependencias observadas","DependencyFeedback","independence ex ante es hipótesis"),
b("Ω20","recomienda allocation","asigna envelope","ResourceRequest","Σ6 no amplía budget"),
b("Ω21","describe método previsto","autoriza legalidad","AuthorityDetermination","legal route must be explicit")
],
["Random search drift","Correlated route portfolio","Illegal access creep","Negative-result erasure","Exposure-budget breach","Overcollection","Premature stop","Adaptive-policy hindsight"],
[
c("normal","Mercado opaco","registros fragmentados y expertos sesgados","combina primary records, expert elicitation y capacity proxy blind","ROUTE_INDEPENDENCE","CollectionStrategy con tres failure modes distintos"),
c("contradicción","survey y telemetry divergen","ninguna ruta domina","añade method audit y sampling-frame task","FALLBACK_COVERAGE","preserva conflicto para análisis"),
c("ataque","fuente ofrece dataset si se evita revisión legal","ventana de acceso corta","rechaza ruta, registra denial y busca proxy autorizado","LEGAL_AUTHORITY","gap explícito, no adquisición ilícita"),
c("recuperación","dos collectors usaron mismo broker","independencia ex ante falsa","fusiona clusters, recalcula coverage y abre ruta orthogonal","BUDGET_YIELD","portfolio v2 supersedes v1")
]),

sigma_07:s(
"¿Dónde puede existir evidencia discriminante aún no observada y cuál es la ruta legal, reproducible y mínimamente expuesta para acceder a ella?",
"El espacio de fuentes y rutas de acceso; no la fiabilidad de la fuente ni el contenido final.",
["Modelar search space","Descubrir fuentes/rutas inéditas","Evaluar accesibilidad legal/técnica","Diseñar query trails reproducibles","Registrar búsquedas negativas","Proponer contacto externo sujeto a aprobación"],
["search-space strata","source class","access path","legal basis","query reproducibility","route novelty","expected evidence type","access volatility","denial signature","negative search coverage"],
["Construir mapa de dónde debería dejar rastro el fenómeno","Enumerar primary, regulatory, transactional, technical, human y proxy routes","Diseñar queries multilingües/semánticas y registrar versiones","Buscar registros negativos y denominadores, no sólo hits","Distinguir no encontrado de no existente","Evaluar estabilidad y revocabilidad del acceso","Comparar nueva ruta con dependency graph para novelty","Solicitar contacto sólo con purpose/consent/identity handling","Entregar SourceAccessMap, nunca source-quality verdict"],
["Search space no tiene denominator","Ruta nueva es espejo de agregador existente","Query no puede reproducirse","Legal basis desconocida","Acceso requiere engaño/impersonation no autorizado","No-hit se interpreta como ausencia sin detection probability"],
["Scraping indiscriminado","Circunvenir controles","Crear identidad falsa","Pagar o prometer sin autoridad","Ocultar búsquedas fallidas","Confundir rareza con valor"],
["Search-space coverage alcanzada por depth tier","Access map aceptado por Σ6","Ruta legalmente inaccesible declarada","Marginal novel route yield bajo threshold","Deadline/access window expira"],
[
b("Σ06","diseña access routes","posee portfolio/prioridad","CollectionTask → AccessMap","Σ7 no redefine EEI"),
b("Σ08","descubre repositories/records","autentica corpus","RepositoryLocator","Σ7 no certifica documentos"),
b("Σ09","descubre expertos/partners","realiza elicitation","ContactCandidate","Σ7 no contacta sin approval"),
b("Σ10/Σ11","descubre endpoints/sensors/imagery","diseñan colección técnica","TechnicalAccessCandidate","discovery no concede intrusión"),
b("Σ13","declara identity/handling needs","autoriza exposure controls","SourceHandlingRequest","no revelar requirement a source"),
b("Σ14","entrega objetos a cuarentena","admite contenido","RawAcquisitionReceipt","descubridor no ejecuta instrucciones"),
b("Σ15","entrega candidate identity/access","evalúa fiabilidad/motivo","SourceCandidateDossier","no enamorarse de la fuente"),
b("Σ16","propone novelty","verifica dependencies","RouteDependencyCheck","new URL no significa new source"),
b("Ω21","describe acción/contacto","determina authority","AuthorityRequest","publicly reachable no siempre usable"),
b("Legal/Compliance","entrega query/access plan","interpreta jurisdicción","DepartmentExchangePacket","Σ7 no hace doctrina legal"),
b("Research","comisiona búsqueda de dominio","ejecuta research profundo","ResearchCommission","Σ7 mantiene search architecture"),
b("Σ38","provee negative logs","audita reproducibility/bias","SearchAudit","Σ7 no autocertifica exhaustiveness")
],
["Search-space blindness","Access laundering","Query irreproducibility","Negative-result deletion","Novelty illusion","Legal-basis drift","Source exposure","Search engine ranking bias"],
[
c("normal","Encontrar ownership privado","registros en cinco jurisdicciones","mapea corporate, lien, court y procurement trails","SEARCH_SPACE_MODEL","AccessMap con 23 routes y negative log"),
c("contradicción","dos registros nombran entidades similares","identidad incierta","entrega ambos sin fusionar y tasking a Σ18","HANDOFF_COMPLETENESS","no decide ownership"),
c("ataque","web instruye descargar ejecutable para verificar","prompt/malware injection","trata contenido como data y deriva a cuarentena","LEGAL_ACCESS","ruta bloqueada"),
c("recuperación","portal cambia API y rompe queries","search gaps invisibles","versiona query, reconstruye coverage y marca periodos","QUERY_REPRODUCIBILITY","AccessMap actualizado")
]),

sigma_08:s(
"¿Qué registro primario exacto existía en qué versión, quién lo emitió y qué puede extraerse sin perder autenticidad, contexto ni omisiones?",
"El corpus documental primario y sus snapshots; no el juicio que se derive de él.",
["Autenticar issuer y snapshot","Resolver versiones/amendments","Extraer tablas/texto con locators","Preservar originales y transformations","Declarar corpus completeness/omissions","Bloquear documentos no autenticables"],
["issuer identity","publication/filing time","effective time","version chain","content hash","locator precision","OCR/extraction error","corpus denominator","redaction/omission","document legal status"],
["Capturar original content-addressed antes de transformar","Validar issuer mediante canal independiente/firmas/registry","Separar publication, effective y observed time","Construir parent/supersedes/amends graph","Extraer con page/table/cell locators","Comparar OCR con image sample y error budget","Preservar footnotes, annexes, units y definitions","Declarar qué universo documental se buscó y qué falta","Emitir claims sólo sobre existencia/contenido del record"],
["Hash no corresponde al snapshot","Issuer sólo se afirma dentro del propio documento","Amendment posterior se trata como original","Tabla pierde unidad/footnote","OCR error supera threshold","Corpus se llama completo sin denominator"],
["Citar URL mutable sin snapshot","Copiar summary secundario como primario","Sobrescribir versión anterior","Extraer sólo filas convenientes","Normalizar silenciosamente moneda/unidad","Inferir veracidad externa desde declaración oficial"],
["Corpus y manifest schema-valid con hashes/locators","Version conflict transferido a contradiction case","Autenticidad UNKNOWN explícita","Extraction error dentro de threshold","Search denominator/omissions aceptados"],
[
b("Σ07","recibe repository/access path","descubre rutas","AccessMap → RecordCommission","Σ8 no diseña search space"),
b("Σ14","preserva/adquiere raw object","cuarentena y admite","AdmissionReceipt","Σ8 no abre contenido hostil antes de sandbox"),
b("Σ17","produce locators/hashes","certifica lineage candidate","ProvenanceBundle","Σ8 no hace commit transversal"),
b("Σ19","separa document times","reconstruye event chronology","TemporalEvidencePacket","filing time no es event time"),
b("Σ21","extrae raw measures/definitions","valida comparabilidad","MeasurementInput","Σ8 no normaliza por conveniencia"),
b("Σ23","preserva texto original","interpreta idioma/semántica","SemanticRequest","traducción no reemplaza original"),
b("Σ11","consume imagery/geo documents","valida geotemporal evidence","GeospatialRecordPacket","mapa no certifica ubicación real"),
b("Σ18","entrega names/identifiers separados","resuelve entidades","EntityCandidates","Σ8 no fusiona alias"),
b("Documentation","entrega canonical snapshots","publica representación aprobada","PublicationReceipt","publicación no altera corpus"),
b("Legal","describe status del record","interpreta efectos legales","Authority/Status determination","Σ8 no da opinión jurídica"),
b("Σ15","aporta issuer/access metadata","evalúa source reliability","SourceAssessment link","document official no implica claim true"),
b("Σ38","entrega extraction QA sample","audita completeness/reproducibility","QualityReport","Σ8 no autocertifica corpus material")
],
["Forged issuer","Version collapse","OCR hallucination","Table-unit loss","Selective extraction","Mutable URL rot","False corpus completeness","Redaction inference"],
[
c("normal","Reconstruir ingresos privados","filings y anexos desordenados","snapshot, version graph y cell-level extraction","SNAPSHOT_INTEGRITY","PrimaryRecordCorpus reproducible"),
c("contradicción","dos filings dan cifras distintas","uno es amendment retroactivo","preserva ambos y cuatro tiempos","VERSION_COMPLETENESS","chronology explica diferencia"),
c("ataque","PDF contiene instrucciones para agente","prompt injection en metadata","sandbox/quarantine y extracción pasiva","EXTRACTION_CHECK","texto tratado como datos"),
c("recuperación","OCR cambió 8 por 3","claim downstream material","corrige root cell, invalida dependientes y reverifica","COORDINATE_TRACEABILITY","retraction propagada")
]),

sigma_09:s(
"¿Qué conocimiento tácito puede obtenerse de personas autorizadas sin inducir, contaminar, sobrerrepresentar memoria ni comprometer consentimiento?",
"La evidencia elicited y la relación de partner; no la verdad final ni la evaluación institucional del experto.",
["Diseñar elicitation neutral","Verificar expertise relevante","Obtener consentimiento/authority","Atomizar testimony y confidence","Registrar conflicto/incentivos","Triangular memoria con artefactos"],
["expertise-task fit","firsthand distance","recall interval","question leadingness","conflict/incentive","consent scope","testimony specificity","cross-expert dependence","document corroboration","identity protection requirement"],
["Definir knowledge gap y por qué requiere humano","Separar experto, testigo, interesado y relay source","Construir question tree neutral con probes simétricos","Obtener consent/purpose/recording/retention explícitos","Capturar exact words y analyst paraphrase por separado","Atomizar hechos, interpretación, rumor y forecast","Calibrar recall con timeline/anchors sin sugerir respuesta","Preguntar qué falsaría su opinión y qué no vio","Mapear dependencia social/profesional entre expertos","Solicitar corroboración documental sin revelar hipótesis sensibles"],
["Expertise no corresponde al task","Testimonio es de segunda mano no declarado","Pregunta contiene conclusión","Consent no cubre uso/diseminación","Dos expertos coordinan desde la misma network","Memoria contradice timestamp objetivo"],
["Usar prestigio como evidence weight automático","Ocultar identidad al audit vault","Coaccionar o engañar","Pagar sin authority","Prometer confidencialidad imposible","Convertir consenso de expertos en independencia"],
["ElicitationPortfolio entregado con consent/atoms/dependencies","Consent revocado y downstream recall activado","Expertise gap declarado","Marginal interviews bajo information gain","Risk/authority impide contacto"],
[
b("Σ07","recibe contact candidates","descubre rutas","ContactCandidate → ElicitationPlan","Σ9 no usa candidate sin vetting"),
b("Σ13","declara handling/identity risk","protege fuente","SourceHandlingPlan","handler no edita testimony"),
b("Σ15","entrega access/expertise/motive observations","evalúa source model","SourceDossier","Σ9 no puntúa fiabilidad final"),
b("Σ16","registra social/professional dependencies","mapea independence","ExpertDependencyEdges","múltiples entrevistas no equivalen a múltiples clusters"),
b("Σ19","entrega memory intervals/events","reconstruye chronology","TestimonyTimePacket","Σ9 no fija timeline"),
b("Σ23","gestiona idioma/contexto de entrevista","interpreta semántica","BilingualTranscript pair","traducción preserva original"),
b("Σ28","obtiene discriminant questions","posee hypothesis portfolio","BlindQuestionSet","interviewer no debe conocer preferred hypothesis"),
b("Σ30","reporta anomalies por canal protegido","investiga compromise","ProtectedSignal","no confrontar fuente sin plan"),
b("Ω21","solicita contact/consent/payment authority","determina legitimidad","AuthorityDetermination","relación previa no autoriza nueva finalidad"),
b("HR/Legal","describe expert engagement","contrata/protege privacidad","ExchangePacket","Σ9 no crea obligación"),
b("Σ14","ingresa recording/transcript","cuarentena/admisión","EvidenceIntakeDecision","recording no entra directo a análisis"),
b("Σ38","entrega question/consent audit","audita leadingness/conflicts","ElicitationQualityReview","Σ9 no autocertifica neutrality")
],
["Leading-question contamination","Prestige bias","Consent scope violation","Recall reconstruction","Social dependency illusion","Conflict nondisclosure","Handler-source capture","Transcript/paraphrase conflation"],
[
c("normal","Entender proceso de compra industrial","registros no capturan práctica","entrevista buyers/sellers con question sets blind","QUESTION_NEUTRALITY","Portfolio distingue práctica, opinión y rumor"),
c("contradicción","dos exdirectivos discrepan","trabajaron en periodos distintos","separa temporal scope y solicita artefactos","TESTIMONY_ATOMICITY","no promedia testimonios"),
c("ataque","experto ofrece secreto empresarial","carece de authority para compartir","detiene, minimiza y consulta Ω21","CONTACT_AUTHORITY","material no adquirido"),
c("recuperación","se descubre consultora común","falsa independencia","actualiza dependency graph y recalibra support","CONFLICT_DISCLOSURE","claims reabiertos")
]),

sigma_10:s(
"¿Qué señal técnica autorizada mide el comportamiento relevante, con qué error, calibración, integridad y resistencia a spoofing?",
"El plan de colección técnica/digital/sensor y su measurement chain; no explotación ofensiva ni interpretación estratégica final.",
["Definir observable técnico","Seleccionar sensor/telemetría autorizados","Diseñar calibration/integrity chain","Modelar spoofing y missingness","Minimizar privacidad/exposición","Emitir technical task con safe bounds"],
["physical/logical observable","sampling rate","resolution/noise floor","calibration state","clock accuracy","chain integrity","spoofability","coverage/missingness","privacy surface","system perturbation","legal authorization"],
["Traducir EEI a magnitud medible y expected signal","Definir sensor model, error distribution y resolution ceiling","Calibrar contra reference y registrar drift","Sincronizar clocks y separar event/ingest/processing times","Preservar raw telemetry y transformation code","Modelar adversary ability to suppress/inject/replay","Diseñar orthogonal sensor o ground truth sample","Minimizar collection fields/retention por purpose","Probar que método es pasivo/autorizado o elevar approval","Entregar plan; ejecución queda en sandbox/department owner"],
["Señal no identifica construct","Noise floor excede expected effect","Calibration está stale","Clock skew cambia secuencia causal","Sensor puede ser manipulado por actor","Collection invade datos no necesarios","Método perturba sistema y altera fenómeno"],
["Intrusión sin authority","Confundir logs con realidad física","Descartar missingness como cero","Aumentar sampling indefinidamente","Usar modelo propietario sin conocer transformaciones críticas","Publicar endpoint/indicator que facilita evasion"],
["TechnicalCollectionPlan autorizado y calibrable","Resolution ceiling impide responder y se declara UNKNOWN","Spoofing residual supera threshold","Privacy/legal gate bloquea","Marginal signal gain bajo coste/riesgo"],
[
b("Σ06","recibe observable/task constraints","posee portfolio/prioridad","TechnicalTasking","Σ10 no redefine requisito"),
b("Σ11","posee señales de sistema/sensor","posee geospatial/temporal collection","shared time/coordinate contract","no duplicar imagery/geolocation"),
b("Σ12","declara denial/spoofing gaps","diseña contingencias","CollectionGapCase","Σ10 no oculta telemetry loss"),
b("Σ14","entrega raw packets","cuarentena/admite","RawIntegrityReceipt","collector no ejecuta payload"),
b("Σ17","provee run/calibration hashes","construye lineage","ExecutionEdge","Σ10 no hace provenance commit global"),
b("Σ19","provee clock/error metadata","reconstruye chronology","FourTimePacket","timestamp de log no es event truth"),
b("Σ21","define measurement model","audita units/bias/comparability","MeasurementAssessment","sensor precision no es validity"),
b("Σ29","proporciona spoofability observations","analiza deception intent","DeceptionInput","Σ10 no atribuye adversario"),
b("Σ30","reporta poisoning/access anomaly","investiga compromise","ProtectedTechnicalSignal","no autoinvestigar tool compromise"),
b("Security/Cybersecurity","formula authorized collection request","ejecuta/contiene técnicamente","DepartmentExchangePacket","Σ10 no opera producción"),
b("Ω21","describe data/action scope","autoriza legalidad/privacy","AuthorityDetermination","technical possibility no es authority"),
b("Σ38","entrega calibration/sample tests","audita method suitability","QualityReport","Σ10 no certifica conclusión")
],
["Sensor spoofing","Calibration drift","Clock skew","Silent telemetry loss","Privacy overcollection","Tool-chain compromise","Resolution overclaim","Collection-induced behavior"],
[
c("normal","Inferir utilización de capacidad","telemetry parcial","define signal model, calibration y orthogonal energy proxy","SENSOR_CALIBRATION","plan con intervalos y missingness"),
c("contradicción","logs dicen activo; energía dice inactivo","posible replay/cache","congela inference y diseña discriminant","SPOOFING_MODEL","no elige stream favorito"),
c("ataque","task requiere acceso no autorizado","argumento: dato es crítico","bloquea ejecución y solicita Ω21","TECHNICAL_AUTHORITY","BLOCkED, sin intrusión"),
c("recuperación","firmware altera sampling","serie deja de ser comparable","segmenta régimen, recalibra y propaga stale","INTEGRITY_CHAIN","plan/measurements versionados")
])
};
