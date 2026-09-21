# Exposición documental acotada — ventanas, localización y prueba de exposición; integración pendiente

13 septiembre 2026. Causa: spVGwI recuperó correctamente las dos fuentes, pero
la página SQLite ocupó 2033807 bytes y el siguiente contexto repetido llegó a
6652843. Se conserva el fracaso; no se usará otra página pequeña para ocultarlo.

## Separaciones necesarias

La recuperación preserva el raw completo, hash, fecha, URL y recibo. Admisión
por integridad no equivale a lectura completa, soporte factual ni aceptación.
El acceso del trabajador a la fuente debe distinguir manifiesto, intervalos
observados y texto literal efectivamente enviado en una inferencia completada.
Un hash del documento no autoriza a citar pasajes que nunca recibió ese actor.

La deduplicación reversible existente ahorra transporte, pero no reduce el
contenido lógico admitido; no se puede usar para eludir el cap actual. Tampoco
basta quitar SVG/HTML con una regex: puede eliminar condiciones, ejemplos,
metadatos, diagramas o contraevidencia. Una extracción textual futura tendría
otra identidad y trazabilidad hacia el raw, nunca el mismo hash ni una garantía
de equivalencia semántica por afirmación del extractor.

## Reutilización propuesta

Reutilizar snapshots/recibos de source.fetch, SHA256, contexto retenido y registro
de exposición existentes. No abrir otra red, sesión de navegador, credencial ni
motor de búsqueda. El codec y source-text-view preservan literalmente entradas
pequeñas; no constituyen por sí mismos un lector de documentos grandes.

Primer componente: ventanas literales deterministas sobre el snapshot adquirido,
con límites UTF-8/Unicode explícitos, identidad de fuente y rango absoluto.
No resolver el rango mediante sustituciones aproximadas, normalización o anclas
ambiguas. Mantener íntegra la fuente almacenada; rangos nunca equivalen a todo
el documento salvo cobertura comprobada de todos sus bytes.

Segundo componente: protocolo versionado de lectura contextual, separado de
las operaciones externas. Sólo puede leer el snapshot ya autorizado de la misma
misión y visible al actor; no concede source.fetch, filesystem o ejecución.
Un recibo de adquisición expuesto como manifiesto debe marcar expresamente que
su contenido no fue expuesto íntegro. Cambiar el contexto de los trabajadores
antiguos silenciosamente rompería su prueba de exposición: nueva política
opt-in, scope de aprendizaje nuevo y compatibilidad histórica obligatoria.

Tercer componente: cada cita de productor y juez se liga al raw exacto, rango y
solicitud completada donde se observó; productor y revisor tienen observaciones
independientes. Un mapa de fuentes, resumen, cache o registro de acceso no
sustituye esa observación. No basta ampliar sourceIds. Los extractos conservan
el contexto pertinente y las objeciones; una afirmación de ausencia global o
revisión integral exige cobertura suficiente o queda UNKNOWN/RETURN.

Si el trabajo exige inspeccionar material mayor que el contexto de una llamada,
el plan debe dividir productos verificables, con controles de cobertura y
aceptación antes de integrarlos. No acumular ventanas indefinidamente ni truncar
las primeras; los fresh threads no deben aparentar recordar texto omitido.
La paginación resuelve acceso, no comprensión, entailment ni consistencia global.

## Pruebas mínimas previas a integración

Unicode multibyte y caracteres combinantes/CRLF/backslashes sin normalización;
límites a mitad de un carácter; rangos fuera de fuente; hash/version/actor/misión
incorrectos; fuente retractada; cita fuera de ventana o cruzando un hueco;
ventanas solapadas frente a cobertura íntegra; inyección en texto tratada como
datos; limites de páginas y bytes; reentrada/cuota/cancelación sin volver a
descargar; cita sin inferencia completada; revisor sin observación propia;
contraevidencia en sección no seleccionada y requisito explícito de lectura total.

No incorporar a adaptive-v1 ni a la instalación por aprobar un componente puro.
Reproducir el tamaño que bloqueó spVGwI sobre copia diagnóstica, mantener ese
ensayo cerrado, y fijar un ensayo integrado nuevo después de pruebas y freeze.

## Núcleo puro implementado — 02:17 UTC

`factory/lib/source-windows.mjs` implementa lectura literal de snapshots por
rangos UTF-8, máximo64KiB/ventana, sin normalización ni ejecución del contenido.
Valida identidad/hash/tamaño, rechaza inicio a mitad de un carácter y acota el
final al límite Unicode válido anterior. Cada ventana conserva texto/hash/rango
exactos y distingue fragmento de documento completo. Citas deben estar dentro
de una ventana íntegra; los huecos no pueden ensamblarse como un pasaje literal.
La cobertura une sólo rangos verificados del mismo raw; solapamientos y
duplicados no cuentan dos veces. **Cobertura de bytes no es lectura por un modelo.**

Seis pruebas dirigidas PASS: enumeración de fronteras Unicode para múltiples
presupuestos, CRLF/NFD/backslashes, metadatos/texto alterados, offsets/límites,
EOF/vacío, cita fuera de rango o normalizada, huecos/solapamientos y reconstrucción
de una fuente sintética mayor de2MiB. Sin proveedor ni red.

Diagnóstico read-only **02:16:53.873** sobre las fuentes reales preservadas de
spVGwI: SQLite2033807bytes se reconstruye en32 ventanas, PostgreSQL23119 enuna;
ambos raws y hashes quedan idénticos, cobertura de bytes completa. Journal324/
f35ce8bf726b38af4c8c454ece0d95265180a2e89f26a9d6d99527b2656c3676 intacto
antes/después. No recuperación de misión, lectura del modelo ni aceptación factual.

El helper no autentica por sí solo adquisición/actor/misión/revocación ni concede
herramientas. Siguen pendientes protocolo opt-in, solicitudes completadas ligadas
a rangos, admisión de citas y revisión independiente de esos mismos bytes.
No se retiran los límites ni se presenta este núcleo como solución integrada.

## Mapa de integración contrastado con el código — 02:36 UTC

Diseño pendiente, no nueva capacidad disponible. Lectura de workers.mjs,
artifacts.mjs, review-codec.mjs, production-scope.mjs e inference-request-evidence.mjs.
La prueba de desarrollo mantiene congelados estos inputs: sólo se documenta.

| Frontera actual | Riesgo de añadir sólo páginas | Cambio que debe probarse |
|---|---|---|
| WorkerService.createRun/context/tool e inheritProductionObservations | sourceIds significa raw íntegro; una adquisición vuelve a introducirlo automáticamente | Manifiestos/rangos en campo versionado separado, manteniendo sourceIds íntegro para compatibilidad; reentrada conserva acceso fechado, no lectura completada ni autoridad del productor anterior |
| ArtifactRegistry.registerRun/updateContext/exposureHash | Cambiar la selección durante inferencia o borrar historia podría simular una exposición | Selección de ventanas identificada antes del dispatch, historial inmutable, bloqueo mientras expectedRequestHash exista; hash de exposición incluye exactamente la vista |
| WorkerService.context y getToolObservations | Raw aparece también en result.content/quoteText y en toolReceipts dentro de artefactos | Proyección explícita, autenticada y versionada de adquisiciones en TODOS esos canales; manifiesto con recibo/hash no es el recibo completo expuesto ni autoriza citas de su contenido omitido |
| create/sourceReference/review y verificación posterior de aceptación | sourceIds.includes o raw.includes sólo prueban admisión/existencia, no observación de un fragmento por ese actor | Comprobar fuente vigente, rango literal y solicitud completada del productor Y del juez; ausencia/revocación/cita entre huecos bloquean aceptación |
| observedEvidenceCatalog/expandCatalogReview | Una clave del manifiesto podría convertirse indebidamente en evidencia factual | Catálogo separa adquisición, ventana y fuente íntegra; expansión preserva tipo/rango/hash sin reparar o fabricar la cita elegida |
| productionScope/producerInputEvidence y reporte | Inventario de IDs puede interpretarse como lectura completa; feedback puede contener texto adicional | Reportar admisión, ventanas realmente despachadas/completadas y cobertura por separado; no atribuir aislamiento total ni suprimir feedback público para ahorrar bytes |
| Contexto de revisión y linaje aceptado | Revisor recibe automáticamente todos los raws citados; copiar ventanas del productor no prueba revisión | Lectura propia del juez, identidad distinta y posibilidad de examinar contexto adicional; anterior aceptación no sustituye soporte ni vigencia actual |
| Prefijos/learning scope y rutas ciegas/cerradas | Overlay antiguo asumiría raw completo o permitiría fuentes en un ámbito que las prohíbe | Scope nuevo opt-in; rechazar transferencia de overlays y toda exposición documental en ámbitos cerrados/ciegos que no la autorizan |

No reinterpretar sourceIds como «sólo manifiestos»: varias comprobaciones existentes
lo usan como exposición íntegra. Una política nueva debe distinguirlo por campos
y versión; los lectores antiguos han de fallar explícitamente, no aceptar una
afirmación bajo un significado distinto. Los límites de campos y ventanas deben
aplicarse antes de serializar/compilar, sin ensanchar silenciosamente el presupuesto.

El texto de artefactos/feedback que legítimamente incluya material grande tampoco
puede recortarse bajo esta función. Sólo se pueden proyectar campos de adquisición
cuya identidad y significado estén definidos por el nuevo contrato. Si el resto
del contexto excede el límite, se conserva CONTEXT_LIMIT con diagnóstico y el
plan necesita otra frontera de producto; no hay una ruta genérica de eliminación.

Para una página HTML grande, una primera ventana puede contener sólo navegación
o gráficos. Elegirla no establece cobertura de los hechos pedidos. Un eventual
localizador literal sobre raw tendría contrato independiente: consulta acotada,
offsets exactos, límites, truncamiento explícito de resultados y sin red, regex
ejecutable ni permiso para concluir ausencia global a partir de una muestra.
No se implementará como sustitución silenciosa de source.fetch ni de lectura.

Pruebas adversarias de integración además del núcleo: fuente legítima de otra
misión, recibo no comprometido o sustituido, ID permitido sin lectura, lectura
pendiente/cancelada, historial de otro productor, manifest-only citado como raw,
raw filtrado por toolReceipts, bypass desde quoteText original no expuesto,
revocación entre dispatch y aceptación, cambio de ventanas durante inferencia,
cita del candidato sin observación propia del juez, claves de catálogo mezcladas,
control cerrado/ciego con ventana inyectada, y convivencia con una misión v1
histórica que debe conservar exactamente sus hashes y exposición completa.

## Componentes adicionales implementados — 03:30 UTC

[Pruebas de exposición/localizador](../verification/SOURCE-WINDOW-EVIDENCE.md).
El módulo source-window-evidence registra una selección propia antes de dispatch
y sólo acredita cita literal ante retención prospectiva y respuesta completada
del mismo actor, dentro de una ventana exacta. Revalida raw/recibo comprometido,
misión/política/propósito/autoridad de admisión y orden temporal en snapshot
SQLite. No cambia WorkerService ni sourceIds, no es herramienta del modelo ni
aceptación de citas en el flujo actual. Sus recibos sintéticos siguen marcados.
Se corrigió además la selección de medio surrogate y la deriva de propósito,
detectadas por tres pruebas rojas, no mediante relajación de los asserts.

findSourceLiteral localiza literales UTF-8 sin regex, normalización, extracción
HTML o red, con paginación explícita que preserva solapamientos. No selecciona
semánticamente ventanas ni transfiere lectura al modelo. El diagnóstico sobre
spVGwI conserva raw/journal, muestra tanto el pasaje tardío de SQLite como
coincidencias irrelevantes de navegación/SVG y literales ausentes por diferencias
de marcado/redacción. Ningún «sin matches» se convierte en ausencia de un hecho.

Fronteras pendientes siguen vigentes: integración del protocolo del productor
y juez, proyección marcada de TODOS los campos de adquisición, no transferencia
de overlays, admisión de citas por ventana realmente observada y verificación
integral con costes. No activar un campo de política que aparente esa integración
antes de implementarla. La vista actual del helper es un building block opt-in
del plano de control, sin reinterpretación retroactiva de exposición histórica.

## Proyección y grants del corte04:34 UTC

Implementación y resultados en [proyección de adquisiciones](../verification/SOURCE-ACQUISITION-PROJECTION.md).
Se proyectan con tipos e identidades propios las cuatro familias de campos de
adquisición, sin recortar el resto. Preview read-only en WorkerService; infer
no lo utiliza. Sobre el actor fallido spVGwI: contexto base6646609B, vista22483B,
preview completo24399B; raws y journal intactos, ninguna lectura del modelo.

Permisos de snapshot inmutables separados de sourceIds, derivados de adquisición
observada o fuente declarada en producto asignado. El productor requiere insumo
aceptado; el revisor no hereda la lectura del productor. Selección y prueba de
ventana admiten un grant explícito y revalidan su vigencia/origen.55 dirigidas
PASS con recibos sintéticos; regresión integral aXRAcS en curso. No policy opt-in
habilitada todavía, protocolos del modelo/citas/aceptación/reentrada/reportes
siguen pendientes. Mantener esas obligaciones, no presentar componentes como
una ruta documental integrada o una reducción real de tokens del proveedor.
