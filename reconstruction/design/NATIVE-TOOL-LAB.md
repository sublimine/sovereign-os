# Laboratorio de herramienta nativa: hipótesis, no promoción

14 septiembre 2026. Instalado244d749e permanece intacto. Este trabajo no es
una misión de usuario ni una nueva ruta del motor. Sigue R04/R13: investigar
coste de continuidad sin modificar modelo, revisión, autoridad o presupuesto.

## Evidencia previa y pregunta

La [documentación oficial](https://learn.chatgpt.com/docs/app-server), abierta
el14sept, describe dynamicTools e item/tool/call como experimentales. El esquema
generado por la CLI0.153.4 se conserva en
../verification/experiments/dynamic-tool-schema-wBooe5. No demuestra ejecución.
Los probes del9sept no observaron callback y no se convierten en éxitos.

Fuente primaria local: commit3d2ee51ca2d5db578f328aa75e20aa22c0197c9a de
openai/codex, checkout /tmp/sovereign-preflight.c4ltj0/codex-source. En
codex-rs/core/src/tools/mod.rs requested_tool_mode da prioridad al modo del
modelo. spec_plan.rs apply_direct_model_only_namespace_overrides cambia la
exposición de namespaces explícitos a DirectModelOnly; is_hidden_by_code_mode_only
oculta otras herramientas compatibles con code mode. No habilita el host de
ejecución. handlers/dynamic.rs convierte el callback en contenido de herramienta
y emite inicio/final. Lectura de fragmentos y handler, no tests Rust ejecutados
ni prueba reproducible de correspondencia binario/fuente.

Hipótesis: un namespace dinámico explícitamente directo puede producir callback
sin habilitar code_mode_host, entorno ni herramientas host. No se atribuye aún
el fallo antiguo a esta causa: usó otro contexto/target y no es control causal.

## Ensayo delimitado, fijado antes del LIVE

Dos brazos nuevos secuenciales, mismo GPT6Astra/ultra, instrucciones, esquema y
límites. Única diferencia de exposición: namespace ordinario frente a
direct_only_tool_namespaces=[sovereign_probe]. Cada uno tiene thread efímero
nuevo, sin entornos, approvalnever, readOnly/networkfalse y MCP/apps/plugins/
hooks/shell/web/code_mode_host cerrados. No reusa ningún hilo de revisión.

Única herramienta: sovereign_probe.get_nonce({challenge:'native-tool-lab-v1'}),
una vez por turno como máximo. Devuelve un nonce aleatorio de memoria que NO
está en el prompt. No filesystem, red, cola, broker, datos del usuario ni otro
efecto. Se exige vínculo thread/turn/call/namespace, evento de inicio anterior,
respuesta exacta y final coincidente. Cualquier request ajeno se deniega y
falla el proceso. Mensajes privados de razonamiento no se guardan ni imprimen.

El modelo devuelve OBSERVED con el nonce exacto después del callback o
UNAVAILABLE/null. Final OBSERVED sin callback es negativo, no éxito.
UNAVAILABLE se registra como resultado negativo de capacidad, sin fabricar
evidencia. Tokens reales notificados y su alcance se conservan; un turno puede
contener varias respuestas nativas. No equiparar dos RPCturn con dos inferencias
de modelo ni deducir ahorro de una prueba de nonce. Retry nativo: cobertura de
intento interrumpido no establecida. Máximo1 callback/900000ms/65536bytes de
salida/8388608bytes de protocolo por brazo. No reintentos del harness, cambio
de modelo, API fallback ni créditos. AUTH/QUOTA detienen los brazos restantes.

Primero pruebas adversariales de transporte SIM (sin suscripción). Luego
congelar hashes del módulo, contrato, runner, fuentes y esquema relevante.
Ejecutar como máximo una pareja LIVE bajo esos hashes. Conservar error/salida
pública y cierre real de procesos. No reiniciar el servicio ni instalar el lab.

## Barreras antes de una eventual integración

Incluso un callback válido no demuestra ahorro, herramienta de archivos segura
ni satisfacción del mandato. El contrato actual TOOL-OBSERVATION-CONTRACT exige
observaciones entre inferencias completas y thread nuevo por inferencia. No
relajarlo para acomodar el ensayo. Una integración necesita un contrato nuevo
de exposición incremental con bytes exactos y secuencia, recibos verificables,
identidad de permisos revalidada por callback, caída antes/después del resultado,
cancelación y límite real de llamadas internas. Una revisión conserva su propio
hilo y relectura posterior al candidato. Un resultado devuelto por un callback
no es por sí solo aceptación ni prueba de consumo por el modelo.

Si el laboratorio falla, conservar el negativo y revisar su causa concreta;
no abrir shell/code execution ni mover el límite de éxito. Si funciona, sólo
abre esa siguiente investigación;244d749e sigue instalado.
