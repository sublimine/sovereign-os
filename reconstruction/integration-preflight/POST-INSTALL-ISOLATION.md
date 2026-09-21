# Aislamiento después de instalar bubblewrap — 9 septiembre 2026

**Resultado: bloqueo de arranque superado; ejecutor de la fábrica todavía no integrado ni acreditado.**

## Intervención y estado observado

El propietario ejecutó en su propia terminal la instalación de `bubblewrap`, `apparmor-profiles`, `apparmor-utils` y dos dependencias de Python, copió el perfil `bwrap-userns-restrict` y lo cargó con `apparmor_parser`. La salida aportada no muestra errores. La verificación local observa `/usr/bin/bwrap` versión 0.9.0 y el perfil correspondiente. No se ha usado la contraseña del propietario, cambiado sudoers ni realizado una elevación desde el agente.

`kernel.apparmor_restrict_unprivileged_userns` permanece en `1`. El kernel activo sigue siendo `6.8.0-138-generic`. El gestor de paquetes avisó de un kernel pendiente `6.8.0-139-generic`; no se reinició la VPS. La carga del perfil sin reiniciar es el procedimiento documentado por [OpenAI Docs](https://learn.chatgpt.com/docs/sandboxing). No se usó la alternativa de desactivar globalmente la restricción.

## Ajuste del perfil mínimo del ensayo

La primera repetición dejó de fallar por UID-map, pero mostró `execvp .../bin/codex: No such file or directory`. El ejecutable estaba instalado bajo el home del usuario, que el perfil mínimo no exponía. Se añadió **sólo la lectura de ese archivo ejecutable exacto** a la configuración por comando, no del directorio `.codex` ni de sus credenciales. Entonces `/usr/bin/true` terminó con código 0.

El perfil del ensayo combina `:minimal=read`, el directorio sintético de trabajo con escritura, el binario exacto de Codex con lectura y un archivo sintético adicional de sólo lectura para probar ese límite. Red deshabilitada. No se cambiaron archivos de configuración de Codex. Los recursos básicos de `:minimal` son excepciones de runtime: no se afirma que el proceso sólo pueda leer el directorio de trabajo.

## Evidencia ejecutada

[Informe JSON real](../verification/post-install-isolation.json), observado a las 13:23:06 UTC. Contiene argumentos exactos, hash del script, namespaces observados, errno de cada denegación y ubicaciones de los fixtures conservados. No es una simulación ni una evaluación de un modelo.

| Grupo | Comprobaciones | Resultado |
|---|---:|---|
| Lectura y escritura permitidas | 3 | Lectura del job, lectura de la excepción readonly y creación de salida en el job |
| Límites de archivos y subprocesos | 10 | Denegación de lectura/escritura fuera, canario en home, escritura readonly, symlinks, importación de hardlink, rutas proc y lectura desde un subproceso |
| Comunicación con endpoints propios | 3 | TCP/UDP IPv4 y socket UNIX por ruta rechazados con EPERM |
| Separación de namespaces | 4 | PID, red, mounts y usuarios distintos del proceso controlador |
| Controles del proceso | 3 | NoNewPrivs=1, CapEff=0 y filtro seccomp activo |

Total: **23 de 23 comprobaciones aprobadas**. Además, cuatro verificaciones del controlador confirmaron que tres canarios seguían intactos y que la salida permitida existía con su contenido esperado. Antes del ensayo, los archivos externos y los endpoints TCP, UDP y UNIX eran accesibles al controlador; estos controles evitan confundir un archivo o servicio inexistente con aislamiento eficaz.

La suite existente de la fábrica se repitió tras el ensayo: 202 tests, 201 PASS, 0 FAIL y 1 SKIP live opt-in (12,295 segundos). Es una verificación separada: sus casos simulados siguen siendo simulados y no se suman a las 23 comprobaciones reales de aislamiento.

El programa de diagnóstico limita stdout/stderr y duración, proporciona un entorno explícito sin heredar credenciales, y sólo los descriptores stdio. Eso describe este programa, no una garantía automática del sandbox para cualquier invocador. No se contactaron destinos externos, no hubo inferencias ni gasto de tokens de modelo, y sólo se usaron archivos y endpoints sintéticos propios.

## Reproducción

Desde la raíz del repositorio:

```bash
/home/cardeex/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node reconstruction/integration-preflight/post-install-isolation-probe.mjs
```

Cada ejecución genera nuevos fixtures y un informe en un directorio temporal distinto; imprime su ruta. El segundo argumento opcional selecciona un archivo de informe que **no debe existir**. No se borran los fixtures para ocultar resultados ni se sobrescribe un informe anterior. El script no instala paquetes, no usa sudo, no consulta al modelo ni modifica políticas persistentes.

## Lo que no queda probado

- No es un ejecutor integrado: el broker aún rechaza `execution.run` por capacidad no acreditada.
- Faltan validaciones de IPv6, UNIX abstracto, descriptores heredados intencionadamente y procesos que intenten sobrevivir al supervisor.
- La importación de un hardlink desde una ruta invisible fue denegada. No equivale a comprobar hardlinks preexistentes dentro de un árbol importado.
- Quedan límites de CPU/memoria/procesos, timeout adversario, salida excesiva, cancelación, crash del sistema completo y reconciliación de efectos.
- No se afirma resistencia universal a exploits del kernel, mounts hostiles o un atacante concurrente con el mismo usuario del controlador.
- El resto de la aceptación de la fábrica —calidad, coste, misiones complejas, operación prolongada— sigue pendiente.
