# Salida descendiente: fuentes primarias y siguiente diagnóstico

13 septiembre2026. Investigación separada mientras2cYEbW conserva sus inputs
congelados. Sin cambios del runner, Node, instalación o permisos.

La VPS informa Node24.19.0/libuv1.52.1 y codex-cli0.153.4. Eso identifica
versiones reportadas, no certifica equivalencia binaria con un tag publicado.

El código publicado de libuv1.52.1 clasifica un socket consultando getsockname
y después getsockopt(SO_TYPE); un error da tipo desconocido. Es compatible con
la rama de descarte observada localmente, pero aún no mide el errno de esta
VPS. [Fuente primaria](https://raw.githubusercontent.com/libuv/libuv/v1.52.1/src/unix/tty.c).

El filtro Restricted publicado en el tag Codexrust-v0.153.4 deniega ambas
consultas y devuelve EPERM. Esto apoya una hipótesis concreta para la pérdida,
no sustituye una prueba local del syscall ni autoriza relajar restricciones.
[Código del tag](https://raw.githubusercontent.com/openai/codex/rust-v0.153.4/codex-rs/linux-sandbox/src/landlock.rs).

La incidencia18473 del repositorio oficial, abierta18abril2026 y observada aún
abierta en esta consulta, describe el mismo contraste entre streams de Node y
escrituras por descriptor en otra versión/entorno. Es un reporte del autor,
no una prueba de nuestra instalación ni una solución publicada/verificada.
[Reporte reproducible](https://github.com/openai/codex/issues/18473).

El bootstrap local ya convierte stdout/stderr del programa raíz en pipes
anónimos. No controla los socketpairs que ese Node crea para sus propios hijos.
Repetir esa adaptación sólo en el proceso raíz no resolvería el caso descendiente.
No cambiar argv a --test-isolation=none, parchear Node, precargar shims, habilitar
red ni inventar líneas del reporte.

## Diagnóstico prerregistrado

Después de reconciliar2cYEbW, fijar una fixture propia y su expectativa antes
de ejecutarla en el mismo sandbox nativo. En un hijo con stdio heredado de los
socketpairs de Node, consultar directamente los fd1/2 existentes con
getsockname y getsockopt(SO_TYPE), reteniendo retornos/errno y tipo fstat mediante
write(2). No crear conexiones ni acceder a datos ajenos. Contrastar con pipes
del programa raíz y con el mismo probe fuera del sandbox. Preservar todos los
resultados y diferenciar observación directa de explicación por código.

Todavía falta diseñar/cualificar una solución transparente; no registrar como
arreglado el reporter a partir de esta investigación. [Evidencia local previa](NODE-CHILD-STDIO-RESULTS.md).

## Resultado local BqYXI2 — 11:30 UTC

Harness `diagnose-node-stdio-metadata.mjs`, SHA
a2a515de7e65e0f0118e7de53c2d2b6dcc512abb4269a9c5b3f23cea02577ca1;
fuente/expected completos fijados en qualification.json antes de ejecutar.
Snapshot567f1ac257ba9ff73a52e763c2c6b2fdbbea1196386e937bcb2abac09a7b2254,
runtime58d863ab intacto. Sesión61723exit0, terminado11:30:25.928.
Propietario2052907/startTicks48297455/boot2a077981 ausente11:31:36.824;
unidad exacta sovereign-exec-de906fa9-c24f-4878-ae0a-1a3efc408e3e.service
not-found/inactive y scratch propio ausente. Sin limpieza o señales adicionales.

| Frontera | Descriptor1/2 | getsockname / getsockopt | Stream Node |
|---|---|---|---|
| Control exterior, raíz | FIFO | -1/ENOTSOCK(88) | Emitido |
| Control exterior, hijo | socket | 0/éxito, SO_TYPE=1 | Emitido |
| Aislado, raíz | FIFO | -1/EPERM(1) | Emitido |
| Aislado, hijo | socket | -1/EPERM(1) | Descartado; callback sí |

Las cuatro consultas del hijo aislado fallan directamente conEPERM. En ese
mismo hijo Node informa Writable/_type=null; la marca escrita por descriptor
llega pero STREAM_CHILD no. El control con idéntico código fuera del sandbox
resuelve ambas consultas y emite esa marca. El FIFO raíz sí emite pese aEPERM,
coherente con la clasificación por fstat sin consulta de socket. Esto concreta
el fallo observado; no prueba modificación o corrección de libuv/seccomp.

Los originales de la prueba quedan en el registro operativo privado, junto con
sus hashes de cualificación, host, ejecución nativa y resumen.
Prueba sintética de infraestructura, cero inferencias/red/misiones ordinarias.
No se han cambiado permisos, binaries, argumentos pedidos por un trabajador
ni el runner instalado. La compatibilidad transparente sigue abierta.

## Revisión documental21:46 — sin cambio de aislamiento

La documentación oficial consultada vuelve a describir el aislamiento Linux con
bwrap y seccomp y el comando de diagnóstico local, pero no documenta en esa
página una corrección específica de getsockname/getsockopt ni del reporter Node.
No convertir la documentación general en prueba de una solución disponible.
[Agent approvals & security](https://learn.chatgpt.com/docs/agent-approvals-security).

UYEoVL repitió la mitigación por su cuenta: el productor observó reporte agregado,
reescribió su suite con barrera de44callbacks, la leyó y volvió a ejecutar el mismo
comando. Ese coste de coordinación se observa; no es una comparación causal de
cuánto ahorraría otra implementación. Véase READ-TEST-DEVELOPMENT-LIVE-UYEoVL.md.

Alternativa a evaluar, todavía NO implementada: exponer ANTES de la producción
la limitación de diagnóstico ya conocida del ejecutor y cómo acreditar terminación
sin inventar TAP ni cambiar el comando. El aviso actual llega con el primer
resultado de ejecución; comprobar su exposición temprana podría evitar descubrir
la misma restricción tras cada primera prueba. Debe distinguir limitación del
reporter, ejecución de callbacks y cobertura semántica, y quedar ligado al entorno
observado. No es arreglo de Node ni justifica abrir red, relajar seccomp, precargar
shims, modificar capturas históricas o añadir pistas a un ensayo activo.
