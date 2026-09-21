# Preflight de integración por suscripción — 9 septiembre 2026

**Actualización posterior, 13:23 UTC:** el propietario instaló bubblewrap y cargó su perfil de AppArmor. El sandbox ya arranca y pasó 23 comprobaciones reales acotadas. [Resultado actual y límites](POST-INSTALL-ISOLATION.md). El resto de este documento conserva los hallazgos del preflight inicial; no es el estado vigente del arranque ni una acreditación del runner.

En el ensayo inicial, el modelo respondió por autenticación oficial ChatGPT, pero los comandos nativos aislados todavía no arrancaban en este VPS. Eran resultados distintos: no se consideró habilitada una fábrica de desarrollo segura.

## Evidencia local

CLI `0.153.4`; `codex login status` confirma ChatGPT. Handshake stdio, `account/read` sin refresh y cuotas funcionaron. La cuenta reporta plan `pro` actualmente, aunque el relato anterior mencionaba una suscripción de veinte; no se infiere ni cambia facturación. Se imprimieron sólo metadatos, sin email, identificadores de cuenta ni secretos. Las cuotas son una instantánea, no capacidad comprometida para días de trabajo.

`metadata-probe.mjs` reproduce consultas de lectura y filtra datos de cuenta. `response-probe.mjs` hizo un turno efímero en `/tmp`, sin herramientas solicitadas, con aprobación `never` y sandbox read-only/network false: el modelo predeterminado fue `gpt-5.6-terra`, respondió `PREFLIGHT_OK` y completó. Sólo se observaron items de usuario y agente. Esto verifica autenticación e inferencia, no acceso a shell ni calidad de una tarea real. No se cambió el modelo de la conversación actual.

`codex sandbox -P :read-only ... -- /usr/bin/true` falló con `bwrap: loopback: Failed RTM_NEWADDR: Operation not permitted`. `unshare -Ur /usr/bin/true` falló escribiendo uid_map con EPERM. No hay `bwrap` en PATH; el mensaje corresponde al helper usado por Codex. No se asume que ambos errores tengan una sola causa. No hubo cambio de sysctl, AppArmor, paquetes ni permisos. Una prueba inicial `-P read-only` omitía el prefijo de perfil integrado y falló por configuración; no se confunde con fallo del sandbox. Otra con sandbox_mode sin perfil no cumplía la CLI. La reproducción válida usa `:read-only`.

Se generó el esquema de la CLI instalada con `codex app-server generate-json-schema --out reconstruction/integration-preflight/protocol-schema`:304 archivos. Se inspeccionaron initialize, thread/start, turn/start y métodos de cuenta/perfiles relevantes; no se afirma leer todo el esquema. Los scripts son diagnósticos acotados, no un adaptador de producción. No se ejecutó npm test ni builders del proyecto.

## Camino recomendado

Usar app-server stdio local para el futuro cliente: ofrece eventos, aprobaciones y gestión de conversaciones. Mantener la sesión ChatGPT administrada por Codex; no extraer tokens ni simular navegador. La documentación oficial describe acceso por suscripción y distingue API facturada separadamente. [Autenticación](https://learn.chatgpt.com/docs/auth)

El SDK sirve para automatizar Codex; app-server encaja cuando se necesita controlar autenticación, historial, aprobaciones y streaming. No se instaló SDK en este preflight. Preferir una versión fijada y el esquema generado correspondiente; el CLI etiqueta app-server tooling experimental y las superficies pueden cambiar. No basar el nuevo sistema en `codex mcp-server`, documentado como deprecated. [SDK](https://learn.chatgpt.com/docs/codex-sdk)

Para transporte, preferir stdio sin puerto público. Completar initialize/initialized antes de otros métodos y no interpretar un turn completed como evidencia de que los comandos funcionaron. El futuro orquestador deberá distinguir eventos de fallo, cancelación y reanudación y validar sus propias obligaciones. [App-server](https://learn.chatgpt.com/docs/app-server)

Antes de habilitar construcción, pedir un entorno donde el sandbox nativo arranque, o una intervención administrativa específica tras diagnóstico de restricciones del VPS. La guía oficial contempla bubblewrap y restricciones de user namespaces/AppArmor; instalar un paquete por sí solo no garantiza resolver este host. No recomendar desactivar globalmente el aislamiento para cumplir el objetivo. Tras cualquier intervención, repetir true y pruebas controladas de denegación filesystem/red y escritura permitida sólo en un fixture desechable. Hasta entonces, inferencia textual sí; shell seguro no acreditado. [Sandbox](https://learn.chatgpt.com/docs/sandboxing)

Los perfiles `:read-only` y `:workspace` son integrados; seleccionar uno explícitamente y comprobar política efectiva. No convertir error de configuración en fallback a danger-full-access. Un perfil listado como permitido no demuestra que el kernel pueda aplicarlo. [Permisos](https://learn.chatgpt.com/docs/permissions)

OpenAI Docs impuso consulta y apertura de documentación oficial antes del diagnóstico. Sus indicaciones influyeron en la elección de stdio, credenciales administradas, esquemas versionados y distinción entre permisos declarados y aislamiento probado. Ningún resultado acredita duración ilimitada, independencia cognitiva ni arquitectura aprobada.
