# Trabajador restringido y runner — segunda ronda

## Resultado

Structured output real funciona. Exclusión total de herramientas nativas y puente dynamicTools todavía no acreditados. Runner con acceso sólo al jobdir tampoco disponible con las configuraciones comprobadas. No habilitar ejecución host no aislada por defecto.

## Contrato comprobado CLI0.153.4

`protocol-schema-experimental/v2/ThreadStartParams.json` incorpora `environments`, `dynamicTools` y `permissions`. La descripción de environments dice que una lista vacía deshabilita acceso al entorno para turns sin override. No describe una allowlist global de herramientas. `dynamicTools` no aparece como propiedad del esquema estable; exige initialize.capabilities.experimentalApi. `TurnStartParams.outputSchema` sí está en el esquema estable. `DynamicToolCallParams` y `DynamicToolCallResponse` describen `item/tool/call` y respuesta `{contentItems:[{type:'inputText',text:...}],success:boolean}`. Aceptar el request no significa exponer o ejecutar la herramienta.

La prueba structured-probe usa thread efímero, cwd/tmp, environments[], dynamicTools[], sandboxread-only, approvalnever y outputSchema objeto cerrado. El servidor devolvió instructionSources[] y política readOnly/networkfalse. Respuesta final `{status:'PREFLIGHT_OK',number:4}` sin toolitems. Eso acredita inferencia estructurada sólo, no completitud del aislamiento.

Se desactivaron explícitamente para ese proceso los features shell_tool,unified_exec,code_mode,code_mode_host,apps,plugins,hooks,multi_agent,browser_use,computer_use,image_generation,view_image; además `mcp_servers.node_repl.enabled=false`, `web_search="disabled"`. Son overrides de proceso, no archivos globales. MCP inventory conservó el nombre node_repl pero tools[]. No se encontró opción apply_patch enable/disable en la referencia oficial ni feature vigente inequívoco (`apply_patch_freeform` figura removed, no usar como garantía). Desactivar shell o code mode no demuestra por sí solo que apply_patch no exista. Tampoco environments[] demuestra eliminación de herramientas hosted ajenas a ejecución. Debe verificarse catálogo efectivo y denegación runtime, no confiar en prompting.

La documentación confirma que apps/hosted/MCP no quedan controlados por el sandbox de comandos. Por ello un broker cerrado exige apagar esas superficies de forma verificable además del sandbox. La referencia documenta enabled por MCP y plugins; no basta approvalnever. [Configuración](https://learn.chatgpt.com/docs/config-file/config-reference)

## DynamicTools: resultados negativos útiles

dynamic-probe añadió un echo in-memory con challenge, handler exacto y sin efectos. No se recibió item/tool/call. El modelo devolvió número4 sin recibo; NO ES PASS. dynamic-default-environment-probe repitió sin environments[] y con deferLoadingfalse: tampoco callback; el último mensaje número0 declaró indisponibilidad implícita. Hubo mensaje previo4. No reutilizar el primer agentMessage como final ni como prueba de ejecución. Hace falta reconciliar todos los eventos y exigir recibo del broker antes de claims de acción. Posibles interacciones de features/transporte siguen sin causa determinada; no afirmar que dynamicTools no funciona en general.

## Landlock y contención

`--enable use_legacy_landlock -P :read-only` permite `/usr/bin/true`. Python dentro de ese mismo sandbox comprobó apertura O_WRONLY de fixture sin escribir bytes: EACCES. TCP127.0.0.1:9: EPERM. Query syscall Landlock devolvió ABI4. Estos resultados sólo prueban denegaciones concretas. No prueban lectura secreta denegada; el perfil read-only tiene lectura amplia.

Perfil custom de proceso: `permissions.preflight.filesystem={":minimal"="read","/tmp/sovereign-preflight.c4ltj0/job"="write"}`, networkfalse, cwdjob. Con legacyLandlock aborta exit101: `permission profiles requiring direct runtime enforcement are incompatible with --use-legacy-landlock`. Con backendpredeterminado falla bwrap RTM_NEWADDR. Ambos antes de ejecutar true. Por tanto no se pudieron ejecutar de forma válida probes de readallowed/readdenied,writeallowed/writedenied,symlinkescape o subprocessinheritance con ese perfil. No se rebajó a lectura global para fabricar un éxito.

No hay docker,podman,nerdctl,firejail,bwrap externo ni compilador cc/gcc en PATH comprobado; sockets /var/run/docker.sock y /run/podman/podman.sock no presentes. No se buscó/inventar acceso a daemons privados. Existe bwrap empaquetado con Codex; no puede crear su loopback en este contexto. Unshare confirma restricción uid_map. Son observaciones, no diagnóstico concluyente de configuración del proveedor.

Los fixtures `/tmp/sovereign-preflight.c4ltj0/job/allowed.txt` y `outside/denied.txt` contienen sólo texto sintético; se conservaron para reproducibilidad. No se tocó ningún secreto real. El diseño de runner deberá usar entorno limpio (sin heredar auth/proxies/tokens ni descriptores del app-server), cwdjob y pruebas de lectura/escritura/red/herencia/symlink antes de admitir código no confiable. No se construyó ese runner aquí.

## Siguiente decisión

Mantener fail-closed para código. Para trabajo textual, el contrato estructurado puede servir como canal de propuestas sin efecto, pero no certificar aún una superficie sin herramientas. Para broker scoped, resolver exposición dynamicTools y catálogo nativo a partir del código/documentación de la versión; repetir challenge que sólo el broker puede devolver y exigir callback+resultado. No sustituir challenge con número fácil de inferir. Si no se puede demostrar exclusión nativa, usar host aislado dedicado y permisos verificables antes de conectar fuentes sensibles.
