# Π: auditoría suplementaria de configuración y auxiliares

Fecha: 2026-09-09. Resultado: 56 fuentes suplementarias identificadas y contrastadas en el árbol actual; no se modifica el catálogo ni las fichas originales. Esta carpeta se llama `pi-history` por la tarea asignada, pero el material encontrado es principalmente **configuración V3 y auxiliares actuales**, no cuarenta agentes históricos adicionales.

## Alcance y lectura verificable

`docs/pi` y `config/pi` contienen 146 archivos: 90 ya constaban en `reconstruction/audit/pi/sources.json`; quedan 40 dossiers JSON y 16 auxiliares. No se localizaron rutas v1/v2 dentro de esos dos directorios. No se recorrió el historial Git ni se certifican los 1177 archivos del repositorio. Las versiones de schema `1.0.0` en agregados no prueban que sean versiones antiguas de los agentes.

`coverage.json` registra cada ruta, SHA-256 de bytes originales, tamaño, líneas, método, herencia y limitaciones. Para los 40 JSON, la cobertura semántica del texto idéntico proviene explícitamente de los dossiers Markdown ya auditados en `audit/pi`: no se atribuye otra lectura literal de esos megabytes. Se verificaron sus hashes contra el manifiesto previo. `inspect.mjs` reconstruye exactamente el JSON sustituyendo interiores de tokens por substrings raw idénticos del Markdown, sin desescapar, normalizar ni cambiar acentos; registra todas las posiciones y residuales. Los offsets son UTF-16, no offsets de bytes: la igualdad final se comprueba sobre el texto completo y su hash UTF-8.

Se leyeron los tokens residuales únicos completos de Π01 y, después, Π02–10, Π11–20, Π21–30 y Π31–40, con primera ubicación visible y todas las ocurrencias registradas. Se inspeccionaron además jerarquía de cada agente, controles numéricos/booleanos y el bloque operacional de Π01 íntegro (líneas 2428–2823), cuya política común reaparece en los otros dossiers. La comparación lexical es una ayuda de cobertura, no demostración de equivalencia funcional: la interpretación se apoya en la ficha heredada y en el contexto JSON.

FMEA, gates, autoridad y máquinas de estado se reconstruyeron desde los 40 subárboles correspondientes: serialización explícita `JSON.stringify(obj,null,2)+newline` y comparación de todo el archivo, **no** una normalización que esconda diferencias. Las 278 relaciones tienen objeto idéntico en inbound/outbound de los dossiers. Las 1600 celdas se reconstruyeron desde esas relaciones (diagonal SELF, ausencia `[]`). El registro de agentes se reconstruyó por proyección con dos excepciones leídas y anotadas. Los restantes nueve auxiliares se leyeron completos, en texto literal o JSON completo impreso conservando campos/orden. Salidas truncadas no se acreditaron: se repitieron las lecturas necesarias en formato compacto sin omitir residuales.

`coverage-build.mjs` reproduce las comprobaciones y genera únicamente el manifiesto nuevo mediante apply_patch. No ejecutar el generador original de Π para comprobar esta auditoría: escribe los originales. El script original se consultó sólo por rangos para esclarecer el dominio de hashes; su lectura completa no se reclama.

## Hallazgos que afectan al compilador

### P1 — PASS conceptual no significa aceptación independiente

`docs/pi/simulations/PI-V3-SIMULATIONS-A-J.md`, casos C, E y J, y `config/pi/v3/simulation-audit.json` declaran `status: PASS` junto a `independent_review: false`. C corresponde a transformación; E a innovación/experimento; J a handover. No basta trasladar esa marca a una aceptación runtime. La arena de transformación, en cambio, exige assurance de Π38 antes de cerrar (`config/pi/v3/decision-arenas.json`, ARENA_TRANSFORMATION_SEQUENCE).

El release manifest y `release-certification.json` reconocen expresamente que no hay evaluación de modelos reales, misión shadow/producción, conformance de adaptadores, determinaciones vivas de departamentos ni auditoría externa. `agent_execution_steps: 87` en la simulación es una cuenta conceptual, no 87 ejecuciones de agentes observadas. Conservar estas limitaciones en cualquier importación. Prueba propuesta: un registro PASS con revisión ausente nunca habilita un consumidor material.

### P1 — Código C y contradicción de permisos

La leyenda auténtica es **C = condicionado y con approval externo**, no «consultado» (`docs/pi/03-PI-AUTHORITY-MATRIX.md`). `config/pi/authority-actions.json` asigna C a EXECUTE/DEPLOY/HIRE/PURCHASE/ALLOCATE_CAPITAL/CHANGE_POLICY; asigna BLOCK=P a todos. El estándar de dossiers prohíbe que Π ejecute efectos externos, y la matriz Markdown restringe el bloqueo a control tipado Π38/Π39. El bloque operacional mezcla out_of_scope external execution con conditional_scope external effect after human/Omega approval.

Resolución propuesta: mantener la prohibición constitucional y default-deny; C representa una necesidad de autorización y handoff a un ejecutor competente, no licencia autoexpandible del agente Π. BLOCK no debe conceder poder de cancelar trabajo ajeno fuera del contrato material propio. Una cadena de texto `approval` jamás basta como capacidad. Pruebas: aprobación no verificable, actor equivocado y alcance distinto se rechazan; una recomendación de compra no ejecuta la compra.

### P1 — ID FMEA duplicado y mecanismos distintos

`config/pi/v3/dossiers/pi-39.json`, `/fmea/5` y `/fmea/23`, y agregado `config/pi/fmea.json`, repiten `pi_39:false_consensus`. La primera fila trata `false consensus` y corrompe horizonte/ventana/punto de no retorno, con revalidación LEGITIMACY_CONSTRAINT. La segunda trata `false_consensus` y corrompe señal de outcome, con NO_SELF_CERTIFICATION. Son dos filas causales, no un clon idéntico. Un Map por ID descartaría silenciosamente una. Rechazar colisión o conservar identificador de procedencia+índice y proponer IDs distintos; no «arreglar» mediante deduplicación semántica automática.

### P1 — Máquina declarativa con destino sin estado

En `/operational/lifecycle`, VALIDATING.branches.invalid apunta a RETURN_FOR_INPUT, pero ese ID no aparece entre los estados. `config/pi/state-machines.json` reproduce el mismo bloque. No compilarlo como una máquina ejecutable sin resolver el destino. Propuesta: estado explícito con receptor y condición de nueva entrada, conservando autoridad/frescura al reanudar. Prueba de cierre de grafo: todo target no nulo debe existir; no convertir un estado desconocido en COMPLETED.

### P2 — Jerarquía y dominio de hashes

`config/pi/agent-registry.json` establece superior=null para Π01; el dossier JSON `agent.superior` y `formal.superior` dicen omega_17. La jerarquía de los demás coincide; `protected_channel` sólo se añade como true para Π38/39, coherente con PROTECTED_ASSURANCE_CHANNEL. Null no significa soberanía de Π01: mantener el enlace institucional Ω17 y separar mando administrativo del juicio protegido.

`config/pi/v3/dossier-registry.json` usa SHA-256 y bytes de **JSON compacto del objeto**, no del archivo Markdown ni del JSON indentado. Comprobados 40/40 contra `JSON.stringify(dossier)`. El campo lines se calcula por un renderer Markdown original, mientras el archivo actual Π01 tiene 926 líneas y el registro dice 916. No tratar esa combinación como un manifiesto de bytes del dossier Markdown vigente. Mantener hashes etiquetados por representación; los hashes de `coverage.json` sí son de archivos raw. Prueba: un consumidor no acepta un hash de objeto serializado como identidad del archivo observado.

### P2 — Cifras de densidad y similitud no acreditan calidad

`cross-coherence-audit.json` informa lexical_jaccard=0 para los pares doctrinales mostrados. Es una medida declarada sobre líneas seleccionadas, no ausencia demostrada de solapamiento funcional. Los 1160 FMEA y 640 evals son especificaciones; los ocho gates de cada rol comparten plantilla y umbrales. Evitar que cardinalidad, nombres irrepetibles o esa distancia lexical se conviertan en prueba de aportación marginal.

## Capacidades adicionales que merece conservar el compilador

El bloque operacional JSON hace más explícito que el render Markdown:

- Activación exige consumidor de decisión y decision switch; rechaza capacidad ya leased, contaminación, autoridad/presupuesto/input ausente y ejecución disfrazada de estrategia. No obliga a convocar cuarenta roles.
- UNKNOWN tiene subtipos (no encontrado, inaccesible, no verificable, contradictorio, probablemente inexistente, técnicamente incognoscible, presupuesto agotado y bloqueo de autoridad) y exige espacio investigado, intentos, límites, impacto y siguiente prueba. No transformar ausencia en viabilidad o permiso.
- Contexto selectivo por decisión, dependencias inmutables bajo demanda, evidencia a favor/en contra y vigencia. La historia calibra rendimiento, **no concede autoridad**. Excluye conclusión preferida del sponsor, secretos innecesarios, etiquetas ocultas de evaluación y razonamiento privado.
- Reserva de verificación mínima del 20% del envelope y agotamiento honesto. Es un requisito normativo del borrador, no garantía de presupuesto implementada ni porcentaje óptimo probado.
- Especialistas: hasta tres hijos por rol, profundidad uno; cada especialista no crea hijos ni efectos externos ni memoria durable propia. Cinco plantillas no significan cinco activaciones obligatorias. Conservar justificación, falsador y finalización antes de ampliar paralelismo.
- Interrupción con checkpoint/hash/recibo; reanudación tras revalidar autoridad/frescura y cierre de dependencias invalidadas; revisión independiente antes de completar. Un lease de ayer no autoriza el efecto de hoy.
- Ruta blind antes de observar la propuesta, disenso minoritario no borrable por voto, cambio de modelo/método/herramienta cuando tenga valor. Una sesión nueva que ya recibe el resultado original no es réplica ciega.

## Lectura individual del suplemento

Los propósitos especializados siguen las fichas auditadas; la configuración no añade cuarenta nuevos ejecutores. Esta tabla explicita qué responsabilidad conserva cada lectura y qué error de compilación debe evitarse al compartir políticas:

| Rol | Capacidad conservada y frontera |
|---|---|
| Π01 | Admitir mandato con consumidor y accountability; Ω17 sigue siendo superior, no soberanía autónoma. |
| Π02 | Cartera viva, cadencia y dependencias; una relación REQUESTS no dicta juicio de otro rol. |
| Π03 | Intención verificable separada de método preferido; no lavar deseo como hecho. |
| Π04 | Ventanas y reversibilidad; cambio temporal reabre el caso, no permiso por urgencia. |
| Π05 | Valor y trade-offs; pérdida no compensable no desaparece agregando puntuaciones. |
| Π06 | Diseño de opciones y composición mínima; sus ocho reportes no son ocho sesiones obligatorias. |
| Π07 | Espacio de opciones/combinaciones/no-acción; simplificar sin eliminar alternativas materiales. |
| Π08 | Escenarios condicionales; no convertir escenario en predicción certificada. |
| Π09 | Mecanismo causal opción→resultado; correlación o actividad no demuestran mecanismo. |
| Π10 | Interacción adversarial/competitiva; modelo de contraparte no equivale a contacto externo. |
| Π11 | Opcionalidad asimétrica; conservar ejercicio/expiry y coste de opción muerta. |
| Π12 | Tesis de innovación/sustitución; contratesis y falsador antes de certeza tecnológica. |
| Π13 | Fronteras y adyacencias; expansión no inventa una capacidad disponible. |
| Π14 | Compromisos difíciles de revertir; approval owner y ruta de reversión separados de la recomendación. |
| Π15 | Integración de recomendaciones; preservar disenso al componer, no votar verdad. |
| Π16 | Arquitectura de programas; diseño de transformación no ejecución operacional. |
| Π17 | Dependencias y ruta crítica; grafo material acíclico distinto de jerarquía de mando. |
| Π18 | Capacidad requerida/madura/deficitaria; registro de capacidad no prueba disponibilidad efectiva. |
| Π19 | Modelo operativo y accountability; HR/Operations conservan aceptación y ejecución. |
| Π20 | Hitos y transiciones; milestone exige evidencia, no calendario o relato. |
| Π21 | Diseño de experimentos reversibles; no atribuir ejecución a simulación conceptual E. |
| Π22 | Build/buy/partner; comparar opciones no comprar ni comprometer partner. |
| Π23 | Capital/coste/financiación; caso de capital no asignación Ω20/Finance. |
| Π24 | Economía unitaria y valor realizado; conservar denominador, sensibilidad y outcome. |
| Π25 | Capacidad organizativa/talento; no contratar ni gestionar personas por C. |
| Π26 | Blueprint tecnológico/producto; Ingeniería acepta implementación, blueprint no despliegue. |
| Π27 | Downside/premortem; riesgo descrito no autorización para asumirlo. |
| Π28 | Resiliencia/readiness; reversal path necesita posibilidad real, no rollback narrado. |
| Π29 | Stakeholders/legitimidad; afectado nuevo reabre, consentimiento no inferido por mayoría. |
| Π30 | Restricciones regulatorias/contratos/permisos; pedir determinación no emitirla. |
| Π31 | Exposición de seguridad estratégica; Security retiene control operacional. |
| Π32 | Externalidades/licencia social; mitigación no traslada daño ocultándolo. |
| Π33 | Inteligencia→estrategia; preservar clasificación, procedencia y retractación Σ. |
| Π34 | Brief de consejo; compresión no altera meaning ni borra disenso. |
| Π35 | Arquitectura de métricas; baseline/denominador/ventana/guardrail antes de evaluar outcome. |
| Π36 | Registro de señales; señal observada no interpretación causal definitiva. |
| Π37 | Renovación de supuestos; predicción congelada e historia superseded, no reescritura retrospectiva. |
| Π38 | Auditoría protegida de coherencia; self-control con effect NONE no aceptación independiente. |
| Π39 | Challenge protegido; preservar ambos mecanismos FMEA false_consensus y reviewer externo cuando corresponda. |
| Π40 | Versionado/handover/continuidad; receptor debe reconocer entrega, no completar por envío unilateral. |

## Arenas: rutas propuestas, no DAGs universales

Las ocho arenas mantienen conflictos concretos: entrada temprana frente a compromiso prematuro; plataforma frente a lock-in; velocidad de transformación frente a capacidad/slack; acceso rápido frente a dependencia en build-buy-partner; diversificación frente a correlación de opciones; valor interno frente a daños distribuidos; fracaso de ejecución frente a falsedad de tesis; cierre frente a evidencia/disenso. Cada una contiene cannot_close_without y reopen_on: traducir esas obligaciones a artefactos y eventos, no activar todos los participants por costumbre.

En particular, retractación Σ debe invalidar premisas Π; cambio de seguridad/recurso/permiso reabre compromiso; pérdida de lineage o supresión de dissent bloquea briefing. Las dependencias de revisión Π38/Π39 y sus canales externos son relaciones de aceptación: no introducir ciclos donde ambos necesiten antes el resultado aceptado del otro. Fijar producto, versión y quién revisa a cada asegurador.

## Qué queda fuera de esta conclusión

No se ha ejecutado una misión estratégica real ni calibrado un modelo. No se reaudita toda la semántica de las cuarenta fichas desde cero: se extiende la lectura heredada con sus JSON y auxiliares. No se ha recorrido el historial Git ni todo `scripts`, `schemas`, `tests` o `visual`; el alcance cerrado son las 56 rutas faltantes de docs/pi/config/pi. No hay autorización implícita para cambiar el manifiesto fijado del catálogo: las contradicciones anteriores son propuestas de resolución para dirección y pruebas futuras, no parches silenciosos al borrador.
