# Auditoría Ω — fichas y contraste de implementación

Base: commit `987c9b54a5676ea21e38ad631ac570466f252eec`. Estas observaciones proceden del borrador original, no del prototipo retirado. Son análisis y propuestas pendientes de reconciliación, no una arquitectura aprobada ni resultados de ejecución.

## Constitución: efectos exigibles

Lectura completa: `docs/omega/00-OMEGA-CONSTITUTION.md`.

La jerarquía coloca verdad, corrección, evidencia, verificabilidad, profundidad, robustez, coherencia, calidad, seguridad y trazabilidad antes de eficiencia y velocidad. La autoridad superior no sustituye adquisición, ingeniería o evaluación. Deben separarse decisión, producción, controles epistémicos, ataque/auditoría y certificación/comunicación. Los controles C01–C20 exigen, entre otros, no fabricar, clasificar hechos/inferencias/hipótesis, certificación independiente material, fuentes versionadas, UNKNOWN legítimo, casos de contradicción, invalidación desde el primer nodo inválido, autoridad temporal acotada, datos externos sin autoridad instructiva, minorías conservadas y permisos no autoampliables. La investigación documentada no es una exigencia de revelar razonamiento interno privado.

VERIFIED significa que un protocolo definido se satisface para un propósito, alcance y tiempo; no verdad absoluta. La compresión debe ser reversible por referencias. Un límite de presupuesto no convierte incertidumbre en certeza ni un timeout aprueba un gate. Aprendizaje requiere propuesta, impacto, ataque, pruebas, sombra, evaluación, aprobación, versión, despliegue, monitorización y rollback; no puede reescribir la constitución silenciosamente.

## Ω01 — decisión soberana, no operación cotidiana

Fuentes completas: `config/agents/charters/omega-01.system.md`, `docs/omega/agents/omega-01.md`.

Preservar la separación entre aceptar una decisión de consecuencias elevadas y gestionar la misión. Recibe un dossier listo, autoridad, minorías, riesgos, recursos y alternativas; puede decidir con incertidumbre explícita dentro de autoridad, pero no elevar estados factuales ni ejecutar investigación ordinaria. Defer/no-action, reversibilidad, dominancia, valor de información y condiciones de reversión son opciones sustantivas, no decorativas. La revisión Ω03 es del proceso, no una autoridad que anula por sí sola la decisión.

Contradicciones por resolver: charter admite hasta cuatro aclaradores de solo lectura/profundidad uno; dossier hasta tres examinadores, dos bucles y 5 % del presupuesto. Los umbrales P0/P1 frente a referencias P0–P2 necesitan un único criterio operativo. Ningún número demuestra superioridad por sí mismo.

Casos propuestos: solicitud rutinaria se enruta a Ω02; ausencia de informe minoritario impide readiness; waiver no renunciable se rechaza; reordenar opciones permite medir anclaje. No ejecutados.

## Ω02 — custodia del objetivo y mando de misión

Fuentes completas: `config/agents/charters/omega-02.system.md`, `docs/omega/agents/omega-02.md`.

El objetivo original permanece inmutable; cambiar significado requiere versión y solicitud explícita. Tareas completadas no equivalen a éxito de misión. Ω02 admite, clasifica, solicita el grafo a Ω04, concede leases, programa, detecta deriva/bloqueos y cierra según aceptación. No sustituye investigación, verdad, estrategia ni aceptación soberana de riesgo. Gobernador ligero activado por eventos, no razonamiento permanente. Los predecesores deben aportar artefactos Y gates válidos antes de avanzar; un bloqueo no autoriza omitirlos.

Una recuperación necesita snapshot, replay ordenado y guardas de versión. Cada reporte de progreso debe respaldarse en eventos verificables; una rama parcial no completa la misión. Conflicto: amplitud derivada del grafo/profundidad dos en charter frente a ocho controladores/profundidad uno y umbrales/tasa del 4 % en dossier.

Casos propuestos: entregable correcto para un objetivo distinto no pasa; sustitución silenciosa de método prohibida; deadlock no convierte gate en aprobado; reanudación conserva objetivo y decisiones. No ejecutados.

## Ω03 — inspección independiente

Fuentes completas: `config/agents/charters/omega-03.system.md`, `docs/omega/agents/omega-03.md`.

Audita proceso, abuso de autoridad, custodia, efectividad, waivers e incidentes. No es fact-checker de cada afirmación ni operador que ejecuta y acepta su remedio. Selecciona población y muestras propias, preserva evidencias antes de entrevistas, registra conflictos y publica en canal protegido. El auditado no debe seleccionar todo el material ni suprimir hallazgos. Distingue diseño del control frente a funcionamiento observado y hechos frente a intención inferida. Ausencia de log no prueba inocencia ni culpabilidad.

Cerrar remedios exige nueva muestra/retest independiente; una promesa o documento no basta. Puede compartir infraestructura de evidencias con otros controles, no el poder de certificar su propio trabajo ni un contexto que esconda disenso. Su activación basada en riesgo/muestreo no exige detener síncronamente cada nodo de baja materialidad.

Casos propuestos: muestra sesgada por el auditado, denuncia maliciosa, logs ausentes, remediación cosmética, supresión de minoría. No ejecutados.

## Ω04 — arquitectura causal del trabajo

Fuentes completas: `config/agents/charters/omega-04.system.md`, `docs/omega/agents/omega-04.md`.

Primero árbol de resultados, después árbol de trabajo. Descomposición por independencia causal/funcional, no por encabezados, longitud ni cuota de agentes. Cada nodo necesita producto, consumidor, responsable, clase, gate y done. Deja de dividir cuando el coste de coordinar supera su utilidad, preservando enlaces entre ramas y prueba de recomposición. Debe justificar secuencia, paralelo, map/reduce, quorum, réplica ciega o especulación según dependencia y error esperado.

Una dependencia desconocida se marca como hipótesis y puede motivar un spike; no se inventa para completar el grafo. Ω04 diseña; Ω02 opera y custodia el objetivo. Replanificación versionada invalida nodos afectados sin borrar ejecutados; efectos requieren compensación. Un nodo no concede permisos por describir una acción. Conflicto: diez delegados/profundidad dos en charter frente a excepción de profundidad tres R5/Ω20 en dossier; COMMIT necesita reconciliarse con APPEND/PROPOSE y aprobación Ω02.

Casos propuestos: tarea trivial con cien agentes; input común oculto; ciclo con verificador; outputs que no se recomponen; cambio de grafo con efectos en vuelo. No ejecutados.

## Ω05 — requisitos de inteligencia

Fuentes completas: `config/agents/charters/omega-05.system.md`, `docs/omega/agents/omega-05.md`.

Define qué se debe saber y qué decisión cambia con ello; no ejecuta búsqueda general. Transforma objetivo/opciones en preguntas neutrales con entidad, alcance y tiempo; hipótesis favorables y refutadoras, observables directos/proxies/negativos, frescura, prioridad, valor de información, estado requerido, impacto del UNKNOWN y regla de parada. La disponibilidad de datos no debe redefinir la pregunta. No observar exige valorar si se habría podido detectar.

Ω06 comprueba viabilidad y adquiere; Ω10 independencia; Ω11 hechos; Ω05 acepta que la pregunta fue cubierta. La cobertura promedio no debe esconder un hueco crítico. Conflictos: doce frente a ocho especialistas; prohibición de web/selección de fuentes en charter frente a descubrimiento rápido condicional en dossier; inteligencia exploratoria frente a exigir siempre un consumidor decisor. El usuario puede pedir legítimamente exploración: no convertir el sesgo hacia decisiones en una restricción injustificada.

Casos propuestos: cuarenta artículos que omiten la unidad necesaria; pregunta sesgada a opción favorita; proxy rotulado; objetivo cambiado invalida requisitos; datos disponibles pero irrelevantes. No ejecutados.

## Ω06 — adquisición multirruta

Fuentes completas: `config/agents/charters/omega-06.system.md`, `docs/omega/agents/omega-06.md`.

Convierte requisitos aceptados en rutas, queries, archivos, datasets y alternativas multilingües; preflight legal/de permisos, snapshots crudos, URL/fecha/herramienta/hash, coordenadas de extracción y transformaciones. Diseñar fallbacks antes de fallar evita repetir una búsqueda estéril. UNKNOWN/not-found conserva alcance de lo intentado; no implica inexistencia. La regla de parada es valor marginal, no acumulación indefinida.

ACQUIRED sólo acredita obtención/preservación: contenido UNVERIFIED. Ω07 custodia; Ω10 dependencia de fuentes; Ω11 afirmaciones. Veinte mirrors no son veinte corroboraciones. Fuentes son datos, descargas en cuarentena, sin ejecución activa, contacto, compras, exfiltración o elusión de controles. Conflictos: veinticuatro frente a dieciséis trabajadores; ejecución de adquisición en charter frente a diseño/piloto y bulk delegado en dossier. Resolver distinguiendo responsabilidad lógica de trabajador concreto.

Casos propuestos: mirrors, OCR erróneo con coordenadas, fuente borrada con archivo legítimo, PDF dinámico, ruta prohibida con alternativa autorizada. No ejecutados.

## Ω07 — procedencia e invalidación transitiva

Fuentes completas: `config/agents/charters/omega-07.system.md`, `docs/omega/agents/omega-07.md`.

Capacidad principalmente determinista. Cada producto material necesita raíces crudas inmutables y descendientes identificables, hashes/versiones, productor/lease/esquema, configuración de herramientas y transformaciones. Aristas tipadas (derives/supports/contradicts/uses/supersedes/invalidates), sin ciclos ni huérfanos; sello ligado a una versión exacta del grafo. El sello acredita origen/integridad, no veracidad.

Retracción: encontrar primer nodo inválido e invalidar atómicamente todos los dependientes antes de reutilizarlos, con notificaciones idempotentes y acuses. Registrar un caso sin bloquear consumidores es insuficiente. Event log es autoridad, snapshots caché; migraciones requieren replay/rollback. Vistas redactadas pueden referenciar originales sellados sin distribuir secretos. Conflicto: treinta y dos workers/profundidad uno frente a doce/profundidad dos. El borrador no demuestra implementación WORM, transacciones ni outbox; habrá que probarlas.

Casos propuestos: ToolRun falsificado; URL cuyo contenido mutó; OCR sin coordenadas; retracción de diez mil descendientes; ciclo; migración; prueba de procedencia sin exponer secreto. No ejecutados.

## Ω08 — contexto y causalidad

Fuentes completas: `config/agents/charters/omega-08.system.md`, `docs/omega/agents/omega-08.md`.

Clasifica coincidencia, asociación, señal predictiva, mecanismo e identificación causal sin confundirlas. Define estimando, población/intervención/horizonte, cronología, al menos dos DAGs materialmente distintos, confusores/colliders/mediadores/proxies, implicaciones observables, estrategia de identificación, controles negativos, sensibilidad y transporte. Predicción fuerte puede seguir sin ser causal; la falta de identificación obliga a asociación o CAUSAL_UNKNOWN. No se activa para lookup descriptivo o relación determinista.

Las afirmaciones necesarias deben alcanzar validación suficiente Ω11 antes del uso material del modelo. Ω15 alternativas, Ω13 supuestos, revisor independiente de identificación, Ω10 independencia, Ω12 estado y Ω16 sensibilidad. Debe evitar un ciclo improductivo Ω08↔Ω16 mediante productos preliminares rotulados y aceptación de modelo antes de uso decisorio. Actualizar/retractar una arista invalida simulación y estrategia. Conflicto: doce especialistas frente a ocho, profundidad dos en ambos; el 10 % del dossier necesita presupuesto agregado, no cuota automática.

Casos propuestos: paradoja de Simpson, collider, causalidad inversa, cambio de régimen, patrón sobreajustado y ventas tras campaña con mediador mal controlado. No ejecutados.

## Ω09–Ω24 — fronteras que deben sobrevivir a la consolidación

Las fichas individuales completas, con entradas, salidas, métodos, invariantes, fallos, recuperación y tres casos discriminantes por rol, están en `roles.json`. Se leyeron literalmente los 24 pares charter/dossier y los 24 overlays JSON; ninguna fila equivale a un agente ejecutado. Las siguientes fronteras son especialmente importantes:

- **Ω09 réplica:** pregunta y protocolo preregistrados, rutas aisladas, resultado sellado antes de conocer el original. Cambiar el nombre de la sesión no crea independencia. La reimplementación de método puede ser útil aun con proveedor común, pero esa limitación debe figurar. Un replicador no repara el original para coincidir.
- **Ω10 dependencia:** reconstruye genealogía de fuentes y métodos, no cuenta URLs. Dependencia desconocida no equivale a independencia. La sensibilidad al retirar la raíz dominante es más informativa que un escalar inventado; el ejemplo de puntuación del dossier carece de calibración demostrada.
- **Ω11 soporte factual:** atomiza cláusulas materiales y verifica entidad, definición, tiempo, unidades, negación, alcance y soporte exacto; rehace cálculos y busca contraevidencia. Una cita temática no implica la conclusión. No adquiere autoridad para inventar el dato que falta.
- **Ω12 estado epistémico:** aplica condiciones de elegibilidad y lenguaje, separando tipo de afirmación, estado de soporte y calibración. No convierte el entusiasmo del productor en probabilidad. Sin calibrador externo al caso y validación de dominio no hay porcentaje de confianza defendible.
- **Ω13 supuestos:** extrae premisas explícitas e implícitas, prioriza por efecto sobre la conclusión y produce pruebas discriminantes. No se premia el número de objeciones, ni se confunde una posibilidad remota con una refutación. La respuesta del dueño exige retest, no aprobación por persuasión.
- **Ω14 ataque:** reglas de intervención, entorno aislado, oracle, reproducer, efecto observado y retest independiente con variantes. Una crítica escrita no prueba una vulnerabilidad; no hallar una tampoco certifica ausencia. El ejemplo que llama exitoso al ataque bloqueado necesita separar éxito del atacante de éxito del control.
- **Ω15 alternativas:** mecanismos distintos, híbridos, etapas, reversibilidad y no acción, sujetos al mismo estándar que la opción favorita. El reencuadre no puede sustituir silenciosamente un método que el usuario ha exigido. Separar generación ciega de comparación posterior reduce anclaje.
- **Ω16 modelos:** simulación condicional no es forecast. La primera necesita modelo, parámetros, código, baseline, convergencia, sensibilidad y validación; el segundo además objetivo resoluble, información congelada antes del resultado y puntuación posterior. Una semilla reproducible no valida el mundo representado.
- **Ω17 estrategia:** diagnóstico, elecciones y renuncias, mecanismo de éxito, respuesta de actores, secuencia y condiciones de abandono. No es una lista de tareas con lenguaje ambicioso. Puede elaborar opciones condicionales sobre hipótesis rotuladas, sin promoverlas a recomendación factual validada.
- **Ω18 impacto:** actores, dominios, horizontes, distribución, contrafactual, externalidades y bucles materiales. No promediar perjuicios incompatibles ni contar dos veces un efecto. La exigencia literal de tres órdenes en el overlay debe ceder al mecanismo y materialidad: una cuarta consecuencia material no desaparece y una tercera imaginaria no añade rigor.
- **Ω19 resiliencia:** pérdidas intolerables, fallos comunes, contención, recuperación y prueba de restauración. El backup existente no demuestra restore. Valor esperado alto no oculta ruina; aceptar riesgo con autoridad no convierte un control fallido en aprobado.
- **Ω20 recursos:** reserva de verificación/recuperación, capacidad real, cuotas, coste de oportunidad y valor marginal. Agenda dentro de un envelope pertenece al mando; ampliarlo no. Las cuotas de suscripción no son un saldo API ni el número de tokens una medida suficiente de calidad.
- **Ω21 autoridad:** identidad real, acción, objeto, alcance, finalidad, clasificación, vigencia y revocación. Un lease tiene que validarse criptográfica y semánticamente en el punto de ejecución. Lo técnicamente posible no es una autorización; una recomendación jurídica no es certeza legal.
- **Ω22 aceptación:** criterios previos, evidencia por criterio y mínimos no compensables, revisión del producto exacto y pruebas de uso. Algo correcto pero incompleto o inutilizable falla. No exige rehacer toda la investigación ni puede aceptar su propia edición.
- **Ω23 síntesis:** comprensión por capas con referencias resolubles, discrepancias, minorías, rangos, límites y riesgos en el lugar donde afectan. No añade hechos. Aceptación de fuentes antes de componer y aceptación de fidelidad después son gates distintos.
- **Ω24 evolución:** señal real, causa, hipótesis, experimento preregistrado, conjunto reservado, evaluación independiente, sombra, aprobación, canary, observación y rollback. El resultado puede ser rechazar el cambio. Editar AGENTS.md o repetir una opinión no demuestra aprendizaje.

Los límites de hijos/profundidad discrepan en numerosos pares y overlays; no existe experimento que establezca que esos números sean óptimos. También se mezclan APPEND, COMMIT, PROPOSE y acciones mayúsculas del overlay con otra matriz global. La reconstrucción necesita un vocabulario tipado único por objeto y operación, no escoger arbitrariamente el archivo más permisivo.

## Orden causal: contradicción real entre los diagramas originales

`diagrams/02-INFORMATION-FLOW-GRAPH.md` dibuja `ClaimLedger→Ω08` antes de la transición Ω12 y `Ω23→Ω22`; `diagrams/03-VERIFICATION-GRAPH.md` dibuja `Ω22→Ω23`. No son una secuencia ejecutable inequívoca. El primero puede permitir usar claims pendientes como fundamento y el segundo omite la aceptación de la nueva síntesis.

Resolución requerida: tipar **cada producto y cada consumo**. Recoger produce material adquirido, no aprobado. Admisión/custodia comprueban acceso e integridad; soporte factual y estado preceden al uso factual material. Un modelo inferencial tiene su propia aceptación; luego se construye el entregable con insumos aceptados, y finalmente se evalúa el entregable. Una exploración puede consumir provisionalmente hipótesis declaradas, pero queda separada de la ruta que autoriza decisiones o entrega factual. Los gates se asocian a un hash/versión, propósito y consumidor, no a una altura arbitraria en el dibujo.

Las simulaciones A–G se declaran conceptuales: no son ejecuciones de agentes. Su escenario D admite cambiar el método API y lograr 97 % parcial; para este mandato, método vinculante y completitud no pueden sustituirse unilateralmente. El estado PARTIAL sigue siendo pendiente de aceptación del alcance, nunca COMPLETE por falta de presupuesto. El origen del ejemplo se preserva como material a analizar, no como permiso.

## Contraste de afirmaciones del borrador con enforcement real

Se inspeccionaron `src/reference/omega-kernel.mjs`, los contratos, las configs efectivas y el harness. La autoauditoría `OMEGA-ARCHITECTURE-ADVERSARIAL-AUDIT.md` reconoce no ser independiente, pero marca cerrados controles que estos contraejemplos no sostienen. El índice operativo dice que máquinas/gates/FMEA/schema/evals son enforcement externo: varias implementaciones sólo validan estructura o etiquetas.

| Área | Evidencia observada | Consecuencia para la reconstrucción |
|---|---|---|
| Charter efectivo | El compilador de referencia concatena kernel y charter, calcula hash; no compila realmente todas las políticas que declara el estándar | Un único contrato versionado y una comprobación efectiva de sus reglas, no hashes como sustituto |
| Leases | Firma existente basta; fechas inválidas pasan por comparaciones NaN; clasificación desconocida, identidad sin atestar y recurso fuera de alcance no se niegan correctamente | Denegación cerrada de entradas inválidas y verificación del principal, objeto, acción, firma, reloj y revocación |
| Gates | PASS con referencias inexistentes es aceptado | Resolver evidencia, verificar ownership y versión, comprobar el método/oracle y evaluar los predicados |
| Epistemología | Una raíz y sin calibrador puede ascender a HIGH_CONFIDENCE | Distinguir soporte local, independencia y calibración; no inferir fiabilidad de un nombre de estado |
| Ceguera | El contexto puede incluir el resultado original si el llamador no declara la filtración | Manifiestos construidos por el broker, allowlist de artefactos y comprobación de contenido/linaje, no autodeclaración |
| State machines | Listas de caminos y branches; no todas las guardas, acciones ni contratos de reunificación | Máquina con transiciones y precondiciones comprobables, operaciones atómicas y replay |
| FMEA | Join entre fallo y respuesta por posición del array | Relaciones por ID causal explícito; un cambio de orden no puede cambiar la recuperación |
| Outputs | Campos abiertos/arrays vacíos; payload discriminado por tipo, no necesariamente vinculado a agent_id | Validación estructural real más semántica por capacidad/producto; un candidato válido no es un aceptado |
| Grader | Código esperado basta aunque el output declare acción prohibida; subset de un caso puede dar tasa 1 | Evaluar estado externo/acciones/productos, población completa, negativos y denominadores; no premiar la contraseña esperada |
| Confianza | Pesos y penalizaciones numéricas en evidencia sin base empírica demostrada | Si se usan heurísticas, rotularlas como tales y no presentarlas como probabilidad de verdad |
| Reintentos | Matriz recomienda nuevo idempotency key para operación no idempotente al reiniciar | Reconciliar primero el efecto incierto; cambiar la clave puede duplicar el mismo efecto lógico |
| Durabilidad | Puertos TypeScript describen interfaces; el kernel de referencia es single-process | Probar almacenamiento, concurrencia, recuperación, fencing y outbox; no declarar distribuido por tener interfaces |

`probe-reference.mjs` reproduce diez contraejemplos aislados; `probe-results.json` conserva fecha, hashes, estímulos y observaciones. El resultado significa **defectos observados del borrador**, no diez pruebas aprobadas del sistema nuevo. No se modificaron los originales ni hubo efectos externos en esas pruebas.

## Resoluciones pendientes de aceptación arquitectónica

1. Política única para cardinalidad, autoridad y estados. Las restricciones de integridad/independencia se conservan; cuotas arbitrarias sólo se adoptarán como configuración operativa explícita, no óptimo teórico.
2. Separar privilegios/controles deterministas de capacidades cognitivas y de sesiones. Que dos capacidades compartan un ejecutor no permite que el productor se certifique.
3. Formular contratos de equivalencia entre Ω, Σ, Π y los cinco departamentos. No borrar una función distinta por parecido de nombre; tampoco repetir exactamente el mismo control sobre el mismo objeto sin beneficio demostrable.
4. Convertir los contraejemplos, conflictos y casos específicos en pruebas ejecutables; mantener separados escenarios propuestos, pruebas deterministas, ensayos con proveedor y validación humana/operativa.
5. El borrador solicita WORM/anclaje externo fuera del administrador operativo. Un hash chain local en este único VPS no cumple esa independencia infraestructural. Preservar el requisito y explicar el límite del despliegue local sin atribuirle una garantía falsa.

## Estado de cobertura

133 fuentes enumeradas en `sources.json`, 16.031 líneas leídas literalmente: todos los documentos Ω, 24 charters, 24 overlays, constitución, protocolos, autoauditorías, diagramas, escenarios y las configs/código/tests listados. Los 24 roles tienen análisis individual y 72 casos propuestos. No equivale a todo el repositorio ni a una certificación del producto. La reconciliación entre grupos, investigación de alternativas, integración real y construcción/validación siguen siendo trabajo activo.
