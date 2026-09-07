export const decisionArenas = [
  {
    id: "ARENA_MARKET_ENTRY",
    decision: "Entrar, esperar o no entrar en una arena nueva con señales contradictorias.",
    sovereign_consumer: "omega_17 → omega_01/human",
    lead: "pi_15",
    participants: ["pi_01","pi_03","pi_04","pi_05","pi_06","pi_07","pi_08","pi_09","pi_10","pi_13","pi_14","pi_15","pi_23","pi_27","pi_29","pi_30","pi_33","pi_34","pi_38","pi_39"],
    required_conflict: "La oportunidad de entrar temprano contra el daño de un compromiso antes de saber qué escenario rige.",
    cannot_close_without: ["no-acción modelada por pi_06", "escenarios discriminantes de pi_08", "permission request de pi_30", "dissent de pi_39 si la tesis depende de una sola claim"],
    reopen_on: ["Σ retracta o degrada una claim material", "la ventana de pi_04 cambia", "un stakeholder sin voz aparece en pi_29"]
  },
  {
    id: "ARENA_IRREVERSIBLE_PLATFORM",
    decision: "Tomar o rechazar una apuesta de plataforma que crea lock-in tecnológico, financiero y de seguridad.",
    sovereign_consumer: "omega_01/human with omega_20, omega_21 and omega_19 determinations",
    lead: "pi_14",
    participants: ["pi_04","pi_11","pi_12","pi_14","pi_18","pi_21","pi_22","pi_23","pi_26","pi_27","pi_30","pi_31","pi_32","pi_38","pi_39"],
    required_conflict: "El upside de plataforma contra la pérdida de reversibilidad, exposición y dependencia de proveedor.",
    cannot_close_without: ["reversal path o prueba de imposibilidad de pi_14", "security review solicitada por pi_31", "resource elasticity de pi_23", "contratesis de pi_12"],
    reopen_on: ["se rompe una dependencia de pi_22", "cambia la exposición de seguridad", "un experimento de pi_21 invalida el mecanismo"]
  },
  {
    id: "ARENA_TRANSFORMATION_SEQUENCE",
    decision: "Cómo convertir una estrategia aceptada en programas sin confundir diseño con ejecución.",
    sovereign_consumer: "omega_17 and receiving departmental authorities",
    lead: "pi_16",
    participants: ["pi_02","pi_16","pi_17","pi_18","pi_19","pi_20","pi_23","pi_25","pi_26","pi_28","pi_35","pi_38","pi_40"],
    required_conflict: "Velocidad de transformación contra capacidad institucional, slack y reserva de resiliencia.",
    cannot_close_without: ["dependency graph de pi_17", "operating model de pi_19", "acceptance packet del departamento receptor", "assurance de pi_38"],
    reopen_on: ["un receptor rechaza el handoff", "un nodo de ruta crítica se retrasa", "outcome guardrail de pi_35 se rompe"]
  },
  {
    id: "ARENA_BUILD_BUY_PARTNER",
    decision: "Elegir construir, comprar, asociarse, licenciar o retirarse de una capacidad.",
    sovereign_consumer: "omega_17 → omega_20/omega_21 and authorized procurement",
    lead: "pi_22",
    participants: ["pi_05","pi_07","pi_10","pi_13","pi_18","pi_22","pi_23","pi_24","pi_25","pi_27","pi_29","pi_30","pi_31","pi_32","pi_39"],
    required_conflict: "Tiempo de acceso contra dependencia, control, legitimidad y destrucción de capacidad propia.",
    cannot_close_without: ["capability target de pi_18", "countermove de pi_10", "constraint y permission path de pi_30", "externality review de pi_32"],
    reopen_on: ["cambia el poder de negociación", "el partner altera el control efectivo", "los economics de pi_24 pierden sensibilidad"]
  },
  {
    id: "ARENA_STRATEGIC_OPTION_PORTFOLIO",
    decision: "Mantener, ejercer, abandonar o renovar un conjunto de apuestas asimétricas.",
    sovereign_consumer: "omega_17 with omega_20 resource envelope",
    lead: "pi_11",
    participants: ["pi_02","pi_04","pi_05","pi_06","pi_08","pi_11","pi_12","pi_20","pi_21","pi_23","pi_27","pi_35","pi_37","pi_38"],
    required_conflict: "Diversificación aparente contra correlación oculta y coste de mantener opciones muertas.",
    cannot_close_without: ["exercise and expiry triggers de pi_11", "learning design de pi_21", "portfolio congestion de pi_02", "assumption expiry de pi_37"],
    reopen_on: ["una opción deja de ser barata", "dos apuestas comparten el mismo failure mode", "nuevo escenario cambia el right-not-obligation"]
  },
  {
    id: "ARENA_LEGITIMACY_EXTERNALITIES",
    decision: "Avanzar, rediseñar o abandonar una estrategia con impacto distributivo y licencia social incierta.",
    sovereign_consumer: "omega_01/human after omega_21 determination",
    lead: "pi_29",
    participants: ["pi_03","pi_05","pi_09","pi_14","pi_27","pi_29","pi_30","pi_32","pi_34","pi_38","pi_39"],
    required_conflict: "Valor estratégico interno contra consentimiento, daño distribuido y efectos de segundo orden.",
    cannot_close_without: ["affected-map de pi_29", "non-compensable loss statement de pi_05", "legal determination request de pi_30", "counterfactual harm model de pi_32"],
    reopen_on: ["nuevo afectado material", "cambio de permiso", "la mitigación traslada el daño a otra población"]
  },
  {
    id: "ARENA_OUTCOME_REVERSAL",
    decision: "Reabrir, adaptar o retirar una estrategia tras señales de outcome adversas.",
    sovereign_consumer: "omega_17 → omega_01/human if decision boundary changes",
    lead: "pi_37",
    participants: ["pi_03","pi_08","pi_09","pi_15","pi_16","pi_24","pi_27","pi_33","pi_35","pi_36","pi_37","pi_38","pi_40"],
    required_conflict: "La tentación de atribuir fracaso a ejecución contra la posibilidad de que la tesis fuera falsa.",
    cannot_close_without: ["frozen prediction record de pi_37", "signal lineage de pi_36", "causal explanation de pi_09", "version propagation de pi_40"],
    reopen_on: ["guardrail breach", "claim retraction", "outcome diverges beyond predeclared range"]
  },
  {
    id: "ARENA_ADVERSARIAL_REVIEW",
    decision: "Determinar si un paquete puede circular al decisor con disenso irreductible.",
    sovereign_consumer: "omega_17/omega_01/human",
    lead: "pi_38",
    participants: ["pi_01","pi_06","pi_14","pi_15","pi_27","pi_30","pi_31","pi_33","pi_34","pi_38","pi_39","pi_40"],
    required_conflict: "Necesidad de cierre contra integridad de evidencia, límites y challenge protegido.",
    cannot_close_without: ["trace audit de pi_38", "red-team release condition de pi_39", "decision brief de pi_34", "change lineage de pi_40"],
    reopen_on: ["un dissent se suprime", "un gate se waives sin autoridad", "el decisor pide una simplificación que altera el meaning"]
  }
];
