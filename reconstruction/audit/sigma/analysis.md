# Auditoría semántica Σ01–Σ19 — bloque asignado completo

## Síntesis final del bloque: no confundir controles diferentes

Σ09 preserva consentimiento, palabras y contexto humano; Σ10 planifica medición técnica autorizada y calibración, no ejecuta por autoridad inferida; Σ11 limita resolución geoespacial y temporal, sin convertir ausencia visible en inexistencia. Σ12 clasifica la causa de ausencia (datos, acceso, señal, método o denegación) antes de pedir otra adquisición. La recuperación útil cambia el método por causa, no repite la misma petición. Σ13 protege fuente/compartimento y revocación antes del acceso; su auditoría sellada no legitima hechos ni permite ocultar contrapruebas. Σ14 cuarentena y parsea de forma pasiva antes de consumo: admisible no significa verdadero. Referencias: dossiers respectivos §§1–6,11–13,16–18 y charters completos.

Σ15 caracteriza identidad/acceso/competencia/motivación/historial por tarea, sin score reputacional universal. Σ16 estima dependencia a nivel claim y campo: veinte medios no son veinte apoyos si comparten raíz; la diversidad cognitiva tampoco se deduce de distintos agentes. Σ17 liga original→transformación→ejecución→claim, preservando hashes, locators y retraction index; tener edges no demuestra autenticidad de una ejecución ni verdad de la conclusión. Σ18 resuelve identidad reversible antes de red y consumidor; coherencia de red no puede justificar circularmente un merge. Σ19 separa cuatro tiempos y conserva orden parcial/alternativas: precedencia no equivale causalidad. Referencias: dossiers15–19 §§1–6,11–12,16–18.

### Contradicciones que deben resolverse, no heredarse como reglas

- Σ09 §5 ConsentAuthority opcional y asociado a leadingness; Σ10 DataPolicy opcional asociado a clockaccuracy. Un contrato no debe volver facultativa autoridad necesaria por accidente de plantilla.
- Σ11 §16 C4 invoca FOUR_TIME_SEPARATION, ausente de su catálogo §11; existe en Σ19 pero no se declara importación vinculante. Σ17 C3 invoca ORIGINAL_PRESERVATION, ausente de su catálogo. Nombrar un gate no lo conecta con un verificador.
- Σ12 GAP_CLASSIFICATION usa un threshold de autoridad en lugar de clasificación causal; BudgetState exige validez proxy. Σ13 retención/borrado y ledger inmutable requieren diseño de contenido sellado vs recibo; no prometer recuperar copias ya exportadas.
- Σ14 exige toda adquisición por cuarentena mientras la activación genérica permite deferir por materialidad. El control mínimo de contenido hostil no debe omitirse por tarea pequeña. Sus FMEA relacionan prompt injection con hash y zipbomb con clasificación: ninguna asociación demuestra contener esas amenazas.
- Σ15 inputs/variables y FMEA mezclan reputación, identidad y motivación. Σ16 ejemplo de 1.4 clusters efectivos no define fórmula ni calibración: conservar dependencia parcial cualitativa, no adoptar esa cifra como algoritmo.
- Σ17 ClaimRefs/AgentRun opcionales chocan con cierre material; debe existir regla condicional explícita. Reproducción y autenticidad operacional necesitan evidencia, no sólo transitividad del grafo.
- Σ18 falsifier compara coste de false merge con confidence: magnitudes distintas requieren regla de pérdida esperada o umbral calibrado. Gate independiente nonwaivable admite excepción soberana en threshold; aclarar si la excepción afecta revisión o discriminante.
- Σ19 ClockUncertainty opcional pese TIME_BASIS nonwaivable; TimeZones requiere publicationtime, EventClaims skew, ClockUncertainty timezone. Los campos deben mapear a su semántica real. Muchos gates dicen evidencia suficiente sin especificar cómo detectar ciclos o intervalos incompatibles.

### Consolidación provisional y evaluación causal

No se propone número de agentes. Conviene separar capacidades persistentes de sesiones activas: normalización, snapshots, índices, hashes, controles de acceso y transiciones pueden compartir infraestructura determinista; la evaluación contextual y revisión material permanecen explícitas. Un solo proceso podría aplicar varios métodos si conserva sus precondiciones, artefactos, exclusiones y separación de revisión. Una sesión nueva sólo se justifica por capacidad, aislamiento, contexto o valor demostrado, no por nombre de departamento.

Comparaciones propuestas, no ejecutadas: routing proporcional vs activar todo (omisiones materiales/coste); bucle fijo vs recuperación causal de Σ12 (reintentos inútiles); reputación única vs vectorΣ15 (errores fuera dominio); conteoURLs vs clustersΣ16 (falso quorum y overmerge); presenciaedges vs replayΣ17 (cierres falsos); fuzzymerge vs candidatosΣ18 (falsemerge/falsesplit y reversión); sortfecha vs ordenparcialΣ19 (falsa precedencia y reapertura causal). `roles.json` añade positivos, negativos y comparaciones para cada rol01–19. Ninguna etiqueta de oracle en los dossiers acredita resultado experimental.

Antes de consumidores deben existir controles verificables: autoridad/handling antes de adquisición; aislamiento antes de parse; QA de extracción antes de análisis; soporte y dependencia antes de fusión; identidad y tiempo con incertidumbre antes de red/causalidad; review independiente antes de cierre material; notificación/acuse tras corrección. El acuse confirma recepción, no verdad. La implementación deberá demostrar estas propiedades, no emitir certificados que sólo repiten nombres de gates.

Este análisis parte exclusivamente del borrador original. No adopta el prototipo retirado ni sus conclusiones. No aprueba arquitectura, cardinalidad ni implementación.

## Lectura cerrada hasta este checkpoint

Constitución, arquitectura e interfaces Σ completas; dossiers y charters Σ01–Σ19 completos: 41 fuentes originales. `sources.json` registra hashes y rangos; `exact-line-coverage-NN.json` vincula cada línea repetida a su original byte-identical. Σ20–Σ40 corresponde a auditor complementario y no se declara leído aquí. Se leyó toda línea nueva sin truncación, sin normalización ni sustitución semántica. Las llamadas truncadas fueron repetidas en fragmentos completos antes de acreditar cobertura. No se leyeron aquí machine dossiers, schemas, effective configs ni versiones históricas; su congruencia sigue pendiente.

## Relaciones causales iniciales

La arquitectura §5 sitúa modelo del consumidor Σ05 antes de requisitos Σ03, cobertura Σ04, portfolio de colección Σ06 y grafo Σ02; Σ01 acepta finalmente. Esa secuencia permite diseño provisional, pero no debe convertir leases planeados o trabajo preparatorio en permiso para adquisición o efectos antes de aceptación. La constitución §§9–11 exige distinguir productor, revisión y certificación, además de reconsideración causal.

Σ01 acepta mandato y protege controles; Σ02 administra grafo, liveness y objetivo anclado; Σ03 convierte necesidad en observables discriminantes; Σ04 mide cobertura efectiva contra denominador y valor marginal; Σ05 valida quién decide, alternativas y pérdidas. Estas son capacidades diferentes. Su separación en sesiones/procesos requiere comparación, no se deduce de nombres distintos ni se descarta por proximidad.

## Hallazgos de Σ01 ya contrastados

- Dossier §11 G5 y charter Gates admiten excepción soberana en independencia; el caso §16 C3 la declara no-waivable. Resolver significado y prioridad antes de codificar política.
- Frontera §3 exige ConsumerDecisionModel antes de aceptación material, pero entradas §5 no lo incluyen; ResourceEnvelope/DepartmentStatus son opcionales aunque la doctrina requiere reserva verificadora y capacidad. Los contratos deben explicar una ausencia tipada o la referencia indirecta obligatoria.
- En §12 F12, compromiso del canal de auditoría se asocia a colisión de cartera y recuperación por subsidiariedad; esa cadena no acredita detectar ni remediar compromiso. Requiere prueba específica que discrimine el mecanismo y no sólo el nombre del fallo.
- §6 avanza métodos al tener schema válido; §18 exige INDEPENDENT_REVIEW antes de COMPLETED. La revisión interna de pasos y la habilitación de consumidores externos deben distinguirse para satisfacer R07.

Los casos de `roles.json` son propuestas para evaluación, no pruebas ejecutadas. Este bloque no reemplaza la integración independiente con Σ20–Σ40 y OMEGA.

## Colección y contratos: Σ02–Σ08

Σ02 requiere MissionGraph como entrada (§5 I3) aunque lo crea: necesita bootstrap explícito, no grafo ficticio. Σ04 requiere CollectionTaskResults para cobertura inicial: debe admitir un snapshot inicial vacío sin convertirlo en suficiencia. Σ06 requiere SourceAccessMap producido por Σ07, quien recibe CollectionTask de Σ06: el diseño debe diferenciar planificación preliminar de adquisición autorizada para romper esa circularidad sin saltar controles.

Σ05 §5 deja DecisionRights opcional mientras owner authority es condición de utilidad legítima. Σ06 §5 I4 y Σ07 §5 I4 hacen opcionales AuthorityDetermination/LegalConstraints aunque sus gates rechazan cualquier ausencia. No basta validar schema para resolver esta contradicción. El consumidor validando utilidad no certifica verdad, y un self gate llamado consumer_validation necesita el acuse externo del decisor real.

Σ06 §3/§4 separa hipótesis de independencia de rutas ex ante de dependencia observada Σ16. Este matiz debe sobrevivir cualquier agrupación: tres métodos diseñados no son tres observaciones independientes. Σ07 distingue URL inédita de origen nuevo y no-hit de inexistencia. Σ08 distingue autenticidad de emisor/contenido de verdad externa, preservando originales, versiones, unidades, anotaciones y locators. Son fronteras epistémicas útiles, no ceremonial organizativo.

Orden mínimo rescatable: handling Σ13 antes de adquisición; cuarentena Σ14 antes de abrir contenido hostil; snapshot original antes de transformación; QA de extracción antes de consumo; dependencia observada antes de contar independencia; revisión protegida Σ38 antes de cierre material. Estas obligaciones no obligan a ocho procesos permanentes ni justifican eliminar verificadores.

FMEA y delegación contienen asociaciones que requieren rediseño causal, no sólo reducción de texto. Ejemplos: Σ06 §12 F11 illegal access usa budget_yield; Σ07 F5 source_trust_leak valida engaño en vez de detectar promoción de confianza; Σ08 F2 ocr_hallucination enlaza filing time e issuer authentication, mientras §8 activa OCR verifier para separar tiempos y revision comparator para comparar OCR. Los nombres de tests DETECT_CONTAIN... en §15 no constituyen oráculos ejecutables ni resultados.

Comparaciones pendientes (no ejecutadas): intake Σ05/03 compartido contra separado con aprobación explícita; planner/scheduler compartiendo estado contra roles cognitivos separados; coverage real contra conteo de hits; búsqueda por estratos contra ranking; extracción primaria trazable contra resumen. Medir conservación del objetivo, falsa suficiencia, error material, coste, latencia y recuperación causal, no sólo número de agentes.
