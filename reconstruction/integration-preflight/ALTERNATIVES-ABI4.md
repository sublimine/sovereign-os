# Alternativas sin namespaces ni setuid — investigación acotada

Conclusión: hay componentes reales, pero ninguna alternativa examinada está acreditada como runner completo bajo ABI4 para este requisito (jobdir sólo, sin secretos, red, IPC externo, señales/ptrace, escapes proc ni procesos supervivientes). No se instaló ni ejecutó software externo ni se escribió un jail casero. No se afirma inexistencia universal: ésta es la cobertura de fuentes indicada.

## Restricción de plataforma

ABI4 aporta restricciones de filesystem y TCP bind/connect; los scopes de señales y sockets UNIX abstractos llegaron en ABI6. IOCTL de dispositivos es posterior a ABI4. Por ello un wrapper Landlock sin otra capa no satisface por sí solo la prohibición de IPC/señales requerida aquí. No usar best-effort como sinónimo de mismas garantías. [Kernel ABI y scopes](https://docs.kernel.org/6.14/userspace-api/landlock.html)

La política se hereda a descendientes y limita ptrace hacia dominios más privilegiados, pero no virtualiza todo proc. Los permisos de descriptores ya abiertos y las operaciones no incluidas requieren cuidado adicional: cerrar FDs antes de ejecutar, no heredar entorno autenticado y no otorgar árboles del host por conveniencia. [Documentación Linux6.8](https://docs.kernel.org/6.8/userspace-api/landlock.html)

## Candidatos examinados

| Candidato | Ventaja real | Razón para no adoptarlo aún |
| --- | --- | --- |
| landrun | CLI sin privilegios con allowlist read/write/execute y entorno vacío por defecto | Actual targetABI9; best-effort enABI4 pierde scopes. README no establece filtro seccomp de señales/IPC que supla la ausencia. |
| sandboxec | CLI/MCP con políticas explícitas filesystem y TCP | restrict-scoped exigeABI6; no acreditada capa seccomp integral para ABI4. |
| Sandlock | Landlock+seccomp-BPF+supervisor, diseñado sin namespaces ni root | Requisito declarado Linux6.12+/ABI6. No rebajar protección para forzar ABI4. |
| agent6 hardened | Documenta LandlockABI>=3+seccomp sin namespaces | Admite acceso amplio /etc,/dev y tmp compartido; reconoce delegar trabajo a daemons UNIX existentes. Incumple aislamiento requerido. |
| ruby-landlock | CierreFDs, entorno, rlimits, captura, opción seccomp de red | La propia documentación niega aislamiento completo; filtro seccomp de red no es política general de señales/IPC. |

landrun conserva un modo estricto que falla si faltan capacidades; el modo degradado es útil para otros threat models pero no prueba éste. Debe fijarse versión y probar límites antes de adopción, no seguir @latest para un control crítico. [landrun](https://github.com/zouuup/landrun)

sandboxec distingue restricciones TCP de un firewall y limita scopes por versión. Su ejemplo de runtime amplio no es perfil secreto-safe. [sandboxec](https://github.com/sandboxec/sandboxec)

Sandlock es el candidato más cercano por alcance declarado, no una recomendación de instalación: requiere ABI6, comparte kernel y tiene supervisor complejo que merece auditoría propia. No ejecutado ni revisado íntegramente. [Sandlock](https://github.com/multikernel/sandlock)

agent6 describe explícitamente la brecha de sockets UNIX y tmp de host en hardened. Es una evidencia negativa concreta frente a la tentación de llamar hardened equivalente a strict. No instalar toda una fábrica de agentes para resolver un runner incompleto. [Threat model agent6](https://github.com/agent6-dev/agent6/security)

ruby-landlock declara que Landlock no cierra FDs ni limita recursos por sí mismo y que seccomp_deny_network sólo cubre red común. Es un componente, no certificación de jail general. [ruby-landlock](https://github.com/discourse/ruby-landlock)

También se examinó README necessary-nu/sandbox: herramienta low-level basada en namespaces con controles adicionales; no se encontró camino documentado sin namespaces que cumpla el conjunto requerido. No ejecutada. [necessary-nu/sandbox](https://github.com/necessary-nu/sandbox)

## Muestra kernel original

Se leyó sandboxer.c de Linuxv6.8 completo (374líneas, apertura inicial y final). Es una muestra real ABI4 de allowlist y no_new_privs, no un runner seccomp integral. Al omitir LL_TCP_BIND/LL_TCP_CONNECT elimina esas categorías del handled set: omitir variables NO significa denegar TCP. El exec hereda envp; no sustituye saneamiento de FDs/entorno, control procesos ni política de IPC. No se compiló ni adaptó. [Código kernelv6.8](https://raw.githubusercontent.com/torvalds/linux/v6.8/samples/landlock/sandboxer.c)

## Qué haría falta para avanzar

Opción operacional preferible: host dedicado compatible con aislamiento existente verificable, sin credenciales del app-server en el entorno del runner. Una intervención del proveedor que habilite bwrap permitiría repetir el perfil Codex mínimo; un entorno ABI6+ permitiría evaluar otro candidato, no aprobarlo automáticamente.

Si se mantiene ABI4, hace falta seleccionar una implementación mantenida cuyo seccomp compense explícitamente categorías faltantes, con auditoría por arquitectura/syscall, cierreFD, no_new_privs, límites y supervisor. Esto no está resuelto aquí. No combinar componentes ad hoc y llamarlo seguro.

Pruebas pendientes antes de admitir código: read/write allowed/denied sólo fixtures; symlink y hardlink fuera; inherited FD; acceso proc a sibling sintético; ptrace/process_vm/pidfd; señales a proceso test protegido; TCP/UDP/UNIX abstracto y pathname; subprocess/setsid/doblefork; timeout y agotamiento; outputcaps; persistencia y recuperación de fallo del supervisor. Deben ejecutarse contra procesos/archivos sintéticos en entorno aislado, nunca contra sesiones o secretos reales.

Separar avances: se puede diseñar y validar contratos, routing, evidencia y propuestas sin efectos mientras el runner permanece BLOCKED. No usar la presión por terminar como autorización para exponer el host.
