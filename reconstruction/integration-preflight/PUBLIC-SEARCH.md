# Descubrimiento web por suscripción — integración bajo verificación

La fábrica recupera URLs conocidas, pero eso no descubre por sí solo fuentes
para una petición abierta. No se añade un servicio con API de pago ni se abre
la ejecución de comandos a internet para cubrir ese hueco.

La documentación oficial separa búsqueda web de la red de los comandos; permite
`web_search="live"` manteniendo el sandbox de comandos. Los resultados siguen
siendo entrada no confiable. [Búsqueda](https://learn.chatgpt.com/docs/web-search),
[fronteras de red](https://learn.chatgpt.com/docs/agent-approvals-security).
Consultadas el 9 de septiembre de 2026. Esa documentación no demuestra que
nuestro adaptador concreto ya funcione.

El protocolo generado de Codex 0.153.4 contiene `ThreadItem.webSearch`, con `id`,
`query`, `action` y resultados opacos opcionales. `WebSearchAction` distingue
search/openPage/findInPage. La política por turno puede conservar Live con
permisos read-only si el proveedor lo permite: `core/src/config/mod.rs`, función
`resolve_web_search_mode_for_turn`, del checkout oficial fijado en el preflight.

## Frontera prevista

Un cliente dedicado recibe sólo una consulta pública corta, sin archivos,
historial de misión, credenciales, herramientas nativas de host o conectores.
Su perfil separado puede observar eventos nativos de búsqueda; el proveedor
ordinario de producción/revisión sigue rechazándolos. Shell, MCP, hooks, apps,
plugins y navegador permanecen cerrados. La nueva capacidad no debe colarse
por cambiar únicamente un prompt.

Los títulos/URLs sugeridos después de una búsqueda observada son **candidatos
no verificados**, no hechos ni fuentes adquiridas. Incluso una URL encontrada
realmente puede apuntar a una página incorrecta, obsoleta o dependiente de otra.
Sólo `source.fetch`, con sus controles de destino, bytes, hash y fecha, permite
admitir contenido para afirmaciones. La búsqueda no prueba independencia,
vigencia, autoría, veracidad ni haber leído el texto final.

Antes de habilitarla en la cola: pruebas negativas del protocolo, consulta real
con cierre observado, integración de permisos/recibos, prueba búsqueda→adquisición
→afirmación→revisión y regresión completa. Este documento no registra todavía
esos pasos como completados.

## Diagnóstico real y cambio comprobado

Se conservaron tres ensayos `SEARCH_UNOBSERVED` sin aceptar los enlaces de
memoria: `sovereign-search-live-kmUk2dBi`, `sovereign-search-live-TtuLWMXc` y
`sovereign-search-live-2SIA9rxQ`, en `/home/cardeex/codex-workspace`.

En el checkout oficial `rust-v0.153.4`, `app-server/src/extensions.rs` instala
`codex_web_search_extension`. `ext/web-search/src/extension.rs` registra `web.run`
cuando el proveedor y el modo web lo permiten. `core/src/tools/spec_plan.rs`
selecciona la herramienta standalone y permite exposición `DirectModelOnly`
sin activar ejecución Code Mode. Esas fuentes se leyeron; no se afirma haber
compilado ni ejecutado sus tests Rust.

La configuración efectiva reveló el defecto: `--disable code_mode` se aplica
como override booleano y sustituye la tabla de `features.code_mode`, borrando
`direct_only_tool_namespaces`. No bastaba con que el argumento estuviera en la
línea de lanzamiento. La política específica omite ese interruptor redundante y
conserva `features.code_mode={enabled=false,direct_only_tool_namespaces=["web"]}`,
con `features.standalone_web_search=true`. No cambia la configuración global.
Los proveedores ordinarios mantienen la prohibición de búsqueda. El adaptador
consulta ahora la configuración efectiva antes de la inferencia y falla si esa
exposición o el cierre de Code Mode no se confirman.

El ensayo `/home/cardeex/codex-workspace/sovereign-search-live-4F7TyiPk/result.json`
registró una búsqueda nativa real y tres candidatos del dominio oficial SQLite,
con salida del proceso observada. Acredita **descubrimiento**, no una misión
completa ni la veracidad de esos enlaces. Sus contadores históricos procedían
de `tokenUsage.last`, no del total de las respuestas internas de la búsqueda:
no presentarlos como coste completo. La implementación posterior utiliza
`tokenUsage.total` del hilo efímero nuevo, etiqueta el alcance y no suma dos veces
las notificaciones acumuladas. El consumo interno no informado del servicio
web o de llamadas fallidas permanece desconocido.

## Integración de control

`source.search {query,limit}` es una capacidad explícita de misión/nodo, con
lease para `public-web`, consulta de hasta 2.000 caracteres y 1–10 candidatos.
Se ejecuta por separado, no dentro de un lote. El broker registra intención,
operación estable y resultado firmado; comprueba revocación cada 100 ms y antes
de aceptar. Cancelar espera al cierre del proveedor; un cierre incierto conserva
`UNCERTAIN` y no repite la operación. Los resultados no crean registros `source`.
Sólo la adquisición posterior, con DNS/destino/bytes/hash/fecha controlados,
puede hacerlo. El control histórico `runtime.no_source_fetch` excluye también
intentos de búsqueda, para no eludir una prohibición de investigación externa.

La consulta es el único contenido de misión enviado al cliente de descubrimiento;
esa minimización **no es un detector perfecto de secretos**. No enviar fragmentos
privados como consultas. Una misión sin autoridad externa debe excluir tanto
`source.fetch` como `source.search`; no confundir URL pública con permiso de
divulgar cualquier contenido. Las políticas nativas permiten la herramienta web
del proveedor, no un filtro previo del broker sobre cada subconsulta que el
modelo realice dentro de ella. Se conservan observaciones acotadas y se exige una
búsqueda completada; la exactitud semántica de las consultas no está certificada.

Las pruebas nuevas cubren permisos, idempotencia, revocación, cuota, separación
entre descubrimiento y fuente, rechazo de candidatos locales, incertidumbre de
limpieza, exposición como datos no confiables y búsqueda→adquisición→afirmación
→revisión con inferencias/transporte simulados. El recorrido completo real se
ensaya aparte con `reconstruction/verification/run-live-discovery.mjs`.

## Recorrido real completado — 18:16 UTC

Misión `mission:f6bd68b9-5929-4114-adf6-e9713be2e9fc`, estado y resumen en
`/home/cardeex/codex-workspace/sovereign-discovery-live-HpaShoFu/summary.json`.
Plan autónomo, búsqueda nativa por suscripción, HTTP 200 de la fuente oficial
SQLite, candidato y aceptación independiente: COMPLETED, ocho controles de
cualificación aprobados. El orden registrado es búsqueda → adquisición →
candidato → revisión; la reentrada no genera nuevas inferencias ni efectos.

Se conservó una interrupción durante la revisión y se reanudó el mismo candidato
sin repetir la búsqueda ni la descarga. Un primer dictamen posterior tenía citas
de qualifiers presentadas como pasajes del cuerpo del artefacto; el control lo
rechazó. La reparación pasó bajo el contrato original, sin cambiar candidato,
criterios ni código durante el ensayo (`sourceUnchanged=true`). El ajuste posterior
de instrucciones/diagnóstico explicita `payload.body`; no amplía los pasajes
aceptables ni convierte el dictamen rechazado en una prueba válida.

Siete inferencias de trabajadores completadas y una de descubrimiento; una
inferencia interrumpida carece de resultado/consumo final. Los contadores
completados suman 308.493 tokens, incluidos 147.072 de entrada cacheada según el
proveedor. No se presenta ese consumo como eficiente para una consulta breve,
ni la misión como demostración de todos los dominios o independencia de fuentes.
